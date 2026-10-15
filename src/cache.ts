import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import type { CachedUsage, FetchResult, PanelState, QuotaRow } from "./types.js";
import { fetchUsage } from "./api.js";
import { formatResetCountdown, clampPercent } from "./format.js";

const CACHE_DIR = join(homedir(), ".cache", "opencode-claudesub-quotas");
const CACHE_FILE = join(CACHE_DIR, "usage-cache.json");

const POLL_INTERVAL_MS = 90_000;
const STALE_THRESHOLD_MS = 5 * 60 * 1000;
const MAX_STALE_MS = 15 * 60 * 1000;

let cachedData: CachedUsage | null = null;
let lastFetchAttemptMs = 0;
let pollHandle: ReturnType<typeof setInterval> | null = null;

/**
 * Reads the on-disk cache file into memory. Called once at startup.
 * If the file is missing or corrupt, cachedData stays null.
 */
export async function loadCache(): Promise<void> {
  try {
    const raw = await readFile(CACHE_FILE, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (isValidCache(parsed)) {
      cachedData = parsed;
    }
  } catch {
    // No cache on disk, that's fine.
  }
}

/**
 * Persists the in-memory cache to disk. Best-effort, never throws.
 */
async function persistCache(data: CachedUsage): Promise<void> {
  try {
    await mkdir(dirname(CACHE_FILE), { recursive: true });
    await writeFile(CACHE_FILE, JSON.stringify(data), { mode: 0o600 });
  } catch {
    // Write failure is non-critical for a monitoring widget.
  }
}

/**
 * Fetches fresh data from the API if the cache is stale or missing,
 * updates the in-memory and on-disk caches, and returns the panel state.
 */
export async function refreshAndGetState(): Promise<PanelState> {
  const now = Date.now();
  const cacheAge = cachedData ? now - cachedData.fetchedAtMs : Infinity;
  const sinceLast = now - lastFetchAttemptMs;

  const needsFetch =
    cachedData === null ||
    cacheAge > POLL_INTERVAL_MS ||
    (cachedData.error && sinceLast > 15_000);

  if (needsFetch) {
    lastFetchAttemptMs = now;
    const result = await fetchUsage();

    if (result.ok) {
      cachedData = responseToCache(result);
      await persistCache(cachedData);
    } else if (cachedData === null) {
      cachedData = errorCache(result.error, now);
      await persistCache(cachedData);
    } else {
      cachedData = {
        ...cachedData,
        error: true,
        errorReason: result.error,
      };
      await persistCache(cachedData);
    }
  }

  return buildPanelState(cachedData, now);
}

/**
 * Returns the current panel state without triggering a fetch.
 * Uses whatever is in the in-memory cache.
 */
export function getStateSync(): PanelState {
  return buildPanelState(cachedData, Date.now());
}

/**
 * Starts a background polling loop. Safe to call multiple times;
 * subsequent calls are no-ops until stopPolling is called.
 */
export function startPolling(onUpdate: (state: PanelState) => void): void {
  if (pollHandle !== null) return;

  pollHandle = setInterval(async () => {
    const state = await refreshAndGetState();
    onUpdate(state);
  }, POLL_INTERVAL_MS);

  // Initial fetch on next tick
  void refreshAndGetState().then(onUpdate);
}

export function stopPolling(): void {
  if (pollHandle !== null) {
    clearInterval(pollHandle);
    pollHandle = null;
  }
}

function responseToCache(result: Extract<FetchResult, { ok: true }>): CachedUsage {
  const d = result.data;
  const fable = d.limits?.find(
    (l) =>
      l.kind === "weekly_scoped" &&
      l.scope?.model?.display_name?.toLowerCase().includes("fable"),
  );
  return {
    fetchedAtMs: result.fetchedAtMs,
    fiveHourPercent: clampPercent(d.five_hour.utilization),
    fiveHourResetsAt: d.five_hour.resets_at,
    weeklyPercent: clampPercent(d.seven_day.utilization),
    weeklyResetsAt: d.seven_day.resets_at,
    fablePercent: fable ? clampPercent(fable.percent) : null,
    fableResetsAt: fable?.resets_at ?? null,
    error: false,
  };
}

function errorCache(reason: CachedUsage["errorReason"], now: number): CachedUsage {
  return {
    fetchedAtMs: now,
    fiveHourPercent: 0,
    fiveHourResetsAt: "",
    weeklyPercent: 0,
    weeklyResetsAt: "",
    fablePercent: null,
    fableResetsAt: null,
    error: true,
    errorReason: reason,
  };
}

function buildPanelState(data: CachedUsage | null, now: number): PanelState {
  if (data === null) {
    return {
      title: "Plan usage",
      stale: false,
      rows: [
        loadingRow("5-hour limit"),
        loadingRow("Weekly \u00b7 all models"),
        loadingRow("Weekly \u00b7 Fable"),
      ],
    };
  }

  const age = now - data.fetchedAtMs;
  const stale = age > STALE_THRESHOLD_MS;
  const tooOld = age > MAX_STALE_MS;

  if (data.error && (tooOld || data.fiveHourResetsAt === "")) {
    return {
      title:
        data.errorReason === "auth"
          ? "Plan usage (auth required)"
          : "Plan usage (stale)",
      stale: true,
      rows: [],
    };
  }

  const title = stale ? "Plan usage (stale)" : "Plan usage";

  return {
    title,
    stale,
    rows: [
      makeRow("5-hour limit", data.fiveHourPercent, data.fiveHourResetsAt, now),
      makeRow("Weekly \u00b7 all models", data.weeklyPercent, data.weeklyResetsAt, now),
      ...(data.fablePercent != null && data.fableResetsAt != null
        ? [makeRow("Weekly \u00b7 Fable", data.fablePercent, data.fableResetsAt, now)]
        : []),
    ],
  };
}

function makeRow(
  label: string,
  percent: number,
  resetsAt: string,
  now: number,
): QuotaRow {
  const parsed = new Date(resetsAt).getTime();
  const resetsAtMs = Number.isFinite(parsed) ? parsed : 0;

  return {
    label,
    percent: Math.round(percent),
    resetText: resetsAt ? formatResetCountdown(resetsAt, now) : "--",
    resetsAtMs,
    status: "ok",
  };
}

function loadingRow(label: string): QuotaRow {
  return { label, percent: 0, resetText: "--", resetsAtMs: 0, status: "loading" };
}

function isValidCache(v: unknown): v is CachedUsage {
  if (typeof v !== "object" || v === null) return false;
  const obj = v as Record<string, unknown>;
  return (
    typeof obj["fetchedAtMs"] === "number" &&
    typeof obj["fiveHourPercent"] === "number" &&
    typeof obj["weeklyPercent"] === "number"
  );
}

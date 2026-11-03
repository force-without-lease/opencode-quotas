import type { QuotaRow } from "./types.js";
import { clampPercent, formatResetCountdown } from "./format.js";

const USAGE_URL = "https://chatgpt.com/backend-api/wham/usage";
const API_TIMEOUT_MS = 10_000;

interface UsageWindow {
  used_percent: number;
  limit_window_seconds: number;
  reset_at: number;
}

export interface ChatGptAuth {
  token: string;
  accountID?: string;
}

export type ChatGptResult =
  | { ok: true; rows: QuotaRow[] }
  | { ok: false; error: "auth" | "unavailable" };

export async function fetchChatGptRows(auth: ChatGptAuth): Promise<ChatGptResult> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${auth.token}`,
    "User-Agent": "opencode-quotas/0.1.0",
  };
  if (auth.accountID) headers["ChatGPT-Account-Id"] = auth.accountID;

  try {
    const response = await fetch(USAGE_URL, { headers, signal: AbortSignal.timeout(API_TIMEOUT_MS) });
    if (response.status === 401 || response.status === 403) return { ok: false, error: "auth" };
    if (!response.ok) return { ok: false, error: "unavailable" };
    const body = (await response.json()) as {
      rate_limit?: { primary_window?: UsageWindow | null; secondary_window?: UsageWindow | null } | null;
    };
    const now = Date.now();
    const windows = [body.rate_limit?.primary_window, body.rate_limit?.secondary_window].filter(isWindow);
    if (windows.length === 0) return { ok: false, error: "unavailable" };
    return { ok: true, rows: windows.map((window) => toRow(window, now)) };
  } catch {
    return { ok: false, error: "unavailable" };
  }
}

function isWindow(value: unknown): value is UsageWindow {
  if (typeof value !== "object" || value === null) return false;
  const window = value as Record<string, unknown>;
  return (
    typeof window["used_percent"] === "number" &&
    typeof window["limit_window_seconds"] === "number" &&
    typeof window["reset_at"] === "number"
  );
}

// The API does not keep a fixed order: some plans send the weekly window as
// primary with no 5-hour window, so the label comes from the window length.
function windowLabel(seconds: number): string {
  const hours = Math.round(seconds / 3600);
  if (hours === 5) return "5-hour limit";
  if (hours === 168) return "Weekly limit";
  if (hours % 24 === 0) return `${hours / 24}-day limit`;
  return `${hours}-hour limit`;
}

function toRow(window: UsageWindow, now: number): QuotaRow {
  const resetsAtMs = window.reset_at * 1000;
  return {
    label: windowLabel(window.limit_window_seconds),
    percent: Math.round(clampPercent(window.used_percent)),
    resetText: formatResetCountdown(new Date(resetsAtMs).toISOString(), now),
    resetsAtMs,
    status: "ok",
  };
}

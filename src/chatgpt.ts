import type { QuotaRow } from "./types.js";
import { clampPercent, formatResetCountdown } from "./format.js";

const USAGE_URL = "https://chatgpt.com/backend-api/wham/usage";
const API_TIMEOUT_MS = 10_000;

interface UsageWindow {
  used_percent: number;
  reset_at: number;
}

export interface ChatGptAuth {
  token: string;
  accountID?: string;
}

export async function fetchChatGptRows(auth: ChatGptAuth): Promise<QuotaRow[] | null> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${auth.token}`,
    "User-Agent": "opencode-claudesub-quotas/0.1.0",
  };
  if (auth.accountID) headers["ChatGPT-Account-Id"] = auth.accountID;

  try {
    const response = await fetch(USAGE_URL, { headers, signal: AbortSignal.timeout(API_TIMEOUT_MS) });
    if (!response.ok) return null;
    const body = (await response.json()) as {
      rate_limit?: { primary_window?: UsageWindow | null; secondary_window?: UsageWindow | null } | null;
    };
    const now = Date.now();
    const rows: QuotaRow[] = [];
    const primary = body.rate_limit?.primary_window;
    const secondary = body.rate_limit?.secondary_window;
    if (isWindow(primary)) rows.push(toRow("5-hour limit", primary, now));
    if (isWindow(secondary)) rows.push(toRow("Weekly", secondary, now));
    return rows.length > 0 ? rows : null;
  } catch {
    return null;
  }
}

function isWindow(value: unknown): value is UsageWindow {
  if (typeof value !== "object" || value === null) return false;
  const window = value as Record<string, unknown>;
  return typeof window["used_percent"] === "number" && typeof window["reset_at"] === "number";
}

function toRow(label: string, window: UsageWindow, now: number): QuotaRow {
  const resetsAtMs = window.reset_at * 1000;
  return {
    label,
    percent: Math.round(clampPercent(window.used_percent)),
    resetText: formatResetCountdown(new Date(resetsAtMs).toISOString(), now),
    resetsAtMs,
    status: "ok",
  };
}

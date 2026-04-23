import type { FetchResult, UsageApiResponse } from "./types.js";
import { resolveToken } from "./auth.js";

const USAGE_URL = "https://api.anthropic.com/api/oauth/usage";
const API_TIMEOUT_MS = 10_000;
const BETA_HEADER = "oauth-2025-04-20";
const USER_AGENT = "opencode-claudesub-quotas/0.1.0";

/**
 * Fetches usage data from the Anthropic OAuth usage endpoint.
 *
 * Returns a discriminated union: either the parsed response or an error tag.
 * Never throws. All failure modes are captured in the return type.
 */
export async function fetchUsage(): Promise<FetchResult> {
  const auth = await resolveToken();
  if (!auth.ok) {
    return { ok: false, error: "auth" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(USAGE_URL, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${auth.token}`,
        "anthropic-beta": BETA_HEADER,
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
      },
      signal: controller.signal,
    });
  } catch {
    return { ok: false, error: "network" };
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 429) {
    return { ok: false, error: "rate_limited" };
  }

  if (!response.ok) {
    return { ok: false, error: "network" };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { ok: false, error: "unknown" };
  }

  if (!isUsageResponse(body)) {
    return { ok: false, error: "unknown" };
  }

  return { ok: true, data: body, fetchedAtMs: Date.now() };
}

function isUsageResponse(v: unknown): v is UsageApiResponse {
  if (typeof v !== "object" || v === null) return false;
  const obj = v as Record<string, unknown>;
  return (
    isUsageBucket(obj["five_hour"]) &&
    isUsageBucket(obj["seven_day"])
  );
}

function isUsageBucket(v: unknown): boolean {
  if (typeof v !== "object" || v === null) return false;
  const obj = v as Record<string, unknown>;
  return (
    typeof obj["utilization"] === "number" &&
    typeof obj["resets_at"] === "string"
  );
}

/** Anthropic usage API response shape from GET /api/oauth/usage */
export interface UsageApiResponse {
  five_hour: UsageBucket;
  seven_day: UsageBucket;
  limits?: UsageLimit[] | null;
}

/** Entry of `limits`; per-model weekly caps have kind "weekly_scoped". */
export interface UsageLimit {
  kind?: string | null;
  percent?: number | null;
  resets_at?: string | null;
  is_active?: boolean | null;
  scope?: { model?: { display_name?: string | null } | null } | null;
}

export interface UsageBucket {
  utilization: number;
  resets_at: string;
}

/** Normalized row data for rendering */
export interface QuotaRow {
  label: string;
  percent: number;
  resetText: string;
  resetsAtMs: number;
  status: "ok" | "unavailable" | "loading" | "auth_required";
}

/** Cached usage data persisted to disk */
export interface CachedUsage {
  fetchedAtMs: number;
  fiveHourPercent: number;
  fiveHourResetsAt: string;
  weeklyPercent: number;
  weeklyResetsAt: string;
  fablePercent?: number | null;
  fableResetsAt?: string | null;
  error: boolean;
  errorReason?: "auth" | "network" | "rate_limited" | "unknown";
}

/** Result from fetching usage, before caching */
export type FetchResult =
  | { ok: true; data: UsageApiResponse; fetchedAtMs: number }
  | { ok: false; error: "auth" | "network" | "rate_limited" | "unknown" };

/** Credential data shape from ~/.claude/.credentials.json */
export interface CredentialFile {
  claudeAiOauth?: {
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
  };
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
}

/** Panel state passed to renderers */
export interface PanelState {
  title: string;
  rows: QuotaRow[];
  stale: boolean;
}

/** Render mode for the panel */
export type RenderMode = "tui" | "desktop";

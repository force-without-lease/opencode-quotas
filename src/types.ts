/** Anthropic usage API response shape from GET /api/oauth/usage */
export interface UsageApiResponse {
  five_hour: UsageBucket;
  seven_day: UsageBucket;
  seven_day_sonnet?: UsageBucket | null;
  seven_day_opus?: UsageBucket | null;
  seven_day_omelette?: UsageBucket | null;
  seven_day_oauth_apps?: UsageBucket | null;
  seven_day_cowork?: UsageBucket | null;
  iguana_necktie?: UsageBucket | null;
  omelette_promotional?: UsageBucket | null;
  extra_usage?: ExtraUsage | null;
}

export interface UsageBucket {
  utilization: number;
  resets_at: string;
}

export interface ExtraUsage {
  is_enabled: boolean;
  monthly_limit: number | null;
  used_credits: number | null;
  utilization: number | null;
  currency: string | null;
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
  weeklyDesignPercent: number | null;
  weeklyDesignResetsAt: string | null;
  sonnetPercent: number;
  sonnetResetsAt: string;
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
  rows: [QuotaRow, QuotaRow, QuotaRow, QuotaRow];
  stale: boolean;
}

/** Render mode for the panel */
export type RenderMode = "tui" | "desktop";

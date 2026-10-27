import type { TuiPlugin, TuiPluginModule } from "@opencode-ai/plugin/tui";
import { createSignal } from "solid-js";
import type { PanelState } from "./types.js";
import { loadCache, refreshAndGetState } from "./cache.js";
import { renderBarUnicode } from "./format.js";
import { renderPanelText } from "./panel.js";

const DEFAULT_POLL_MS = 90_000;
const MAX_POLL_MS = 120_000;
const KV_REFRESH_MODE = "quota.refreshMode";
const KV_REFRESH_INTERVAL = "quota.refreshInterval";

type RefreshMode = "poll" | "message";

const tuiPlugin: TuiPlugin = async (api, _options, _meta) => {
  const [state, setState] = createSignal<PanelState>({
    title: "Plan usage",
    rows: [
      { label: "5-hour limit", percent: 0, resetText: "--", resetsAtMs: 0, status: "loading" },
      { label: "Weekly \u00b7 all models", percent: 0, resetText: "--", resetsAtMs: 0, status: "loading" },
      { label: "Weekly \u00b7 Fable", percent: 0, resetText: "--", resetsAtMs: 0, status: "loading" },
    ],
  });

  async function refresh() {
    const s = await refreshAndGetState();
    setState(s);
  }

  // Polling state
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let eventUnsub: (() => void) | null = null;

  function getMode(): RefreshMode {
    return (api.kv.get<string>(KV_REFRESH_MODE) as RefreshMode) || "poll";
  }

  function getIntervalMs(): number {
    const stored = api.kv.get<number>(KV_REFRESH_INTERVAL);
    return typeof stored === "number" && stored >= 5000
      ? Math.min(stored, MAX_POLL_MS)
      : DEFAULT_POLL_MS;
  }

  function stopAll() {
    if (pollTimer !== null) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    if (eventUnsub !== null) {
      eventUnsub();
      eventUnsub = null;
    }
  }

  function applyMode() {
    stopAll();
    const mode = getMode();
    const ms = getIntervalMs();

    // Always run a polling timer (even in message mode, as a fallback)
    pollTimer = setInterval(() => void refresh(), mode === "message" ? DEFAULT_POLL_MS : ms);

    if (mode === "message") {
      eventUnsub = api.event.on("message.updated", () => void refresh());
    }
  }

  // --- Slot registration ---
  api.slots.register({
    slots: {
      sidebar_footer(ctx, _props) {
        const s = state();
        const theme = ctx.theme.current;
        if (s.rows.length === 0) return null;
        return (
          <box flexDirection="column" paddingX={1} gap={0}>
            <text color={theme.textMuted} dim>{"Plan usage"}</text>
            {s.rows.map((row) => {
              const pct = row.status === "ok" ? `${row.percent}%` : "--";
              const rst = row.status === "ok" ? `resets ${row.resetText}` : "";
              const info = rst ? `${pct} ${rst}` : pct;
              const bar = row.status === "ok"
                ? renderBarUnicode(row.percent, 28)
                : "";
              return (
                <box flexDirection="column" gap={0}>
                  <box flexDirection="row" justifyContent="space-between">
                    <text color={theme.text}>{row.label}</text>
                    <text color={theme.textMuted}>{info}</text>
                  </box>
                  {bar ? <text color={theme.primary}>{bar}</text> : null}
                </box>
              );
            })}
          </box>
        );
      },
    },
  });

  // --- Background data loading ---
  void loadCache().then(refresh);
  applyMode();
  api.lifecycle.onDispose(stopAll);

  // --- Commands ---
  const INTERVAL_OPTIONS = [
    { title: "Every message", value: "message", description: "Refresh after each message in/out" },
    { title: "Every 30 seconds", value: "30", description: "Polling every 30s" },
    { title: "Every 60 seconds", value: "60", description: "Polling every 60s" },
    { title: "Every 90 seconds (default)", value: "90", description: "Polling every 90s" },
    { title: "Every 2 minutes", value: "120", description: "Polling every 120s" },
  ];

  api.command.register(() => [
    {
      title: "Plan Usage",
      value: "quota",
      description: "Show current plan usage and quotas",
      category: "Quota",
      slash: { name: "quota" },
      onSelect() {
        const s = state();
        api.ui.toast({
          variant: "info",
          title: s.title,
          message: renderPanelText(s),
          duration: 8000,
        });
      },
    },
    {
      title: "Quota: Set refresh mode",
      value: "quota-refresh",
      description: "Choose how often quota data refreshes",
      category: "Quota",
      slash: { name: "quota-refresh" },
      onSelect() {
        api.ui.dialog.replace(() =>
          api.ui.DialogSelect({
            title: "Quota refresh mode",
            options: INTERVAL_OPTIONS,
            onSelect(option) {
              if (option.value === "message") {
                api.kv.set(KV_REFRESH_MODE, "message");
              } else {
                const secs = parseInt(option.value as string, 10);
                api.kv.set(KV_REFRESH_MODE, "poll");
                api.kv.set(KV_REFRESH_INTERVAL, secs * 1000);
              }
              applyMode();
              api.ui.dialog.clear();
              api.ui.toast({
                variant: "success",
                title: "Quota refresh updated",
                message: option.title,
                duration: 3000,
              });
            },
          })
        );
      },
    },
    {
      title: "Quota: Refresh now",
      value: "quota-now",
      description: "Force an immediate quota refresh",
      category: "Quota",
      slash: { name: "quota-now" },
      onSelect() {
        void refresh().then(() => {
          api.ui.toast({
            variant: "success",
            title: "Quota refreshed",
            message: renderPanelText(state()),
            duration: 5000,
          });
        });
      },
    },
  ]);
};

const plugin: TuiPluginModule & { id: string } = {
  id: "opencode-quotas",
  tui: tuiPlugin,
};
export default plugin;
export { tuiPlugin as tui };

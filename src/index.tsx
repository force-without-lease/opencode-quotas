import type { TuiPlugin, TuiPluginModule } from "@opencode-ai/plugin/tui";
import { createSignal } from "solid-js";
import type { PanelState } from "./types.js";
import { loadCache, refreshAndGetState } from "./cache.js";
import { renderBarUnicode } from "./format.js";
import { renderPanelText } from "./panel.js";

const POLL_MS = 90_000;

function pad(s: string, len: number): string {
  return s.length >= len ? s : s + " ".repeat(len - s.length);
}

const tuiPlugin: TuiPlugin = async (api, _options, _meta) => {
  const [state, setState] = createSignal<PanelState>({
    title: "Plan usage",
    stale: false,
    rows: [
      { label: "5-hour limit", percent: 0, resetText: "--", resetsAtMs: 0, status: "loading" },
      { label: "Weekly \u00b7 all models", percent: 0, resetText: "--", resetsAtMs: 0, status: "loading" },
      { label: "Weekly \u00b7 Claude Design", percent: 0, resetText: "--", resetsAtMs: 0, status: "loading" },
      { label: "Sonnet only", percent: 0, resetText: "--", resetsAtMs: 0, status: "loading" },
    ],
  });

  async function refresh() {
    const s = await refreshAndGetState();
    setState(s);
  }

  // Register slots FIRST so the panel renders immediately (with loading state).
  // Data loading happens in the background so the init function returns fast.
  api.slots.register({
    slots: {
      sidebar_footer(ctx, _props) {
        const s = state();
        const theme = ctx.theme.current;
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

  // Fire-and-forget: load cache then fetch, update signal when done
  void loadCache().then(refresh);
  const interval = setInterval(() => void refresh(), POLL_MS);
  api.lifecycle.onDispose(() => clearInterval(interval));

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
  ]);
};

const plugin: TuiPluginModule & { id: string } = {
  id: "opencode-claudesub-quotas",
  tui: tuiPlugin,
};
export default plugin;
export { tuiPlugin as tui };

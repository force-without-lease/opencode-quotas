/** @jsxImportSource solid-js */
import { createSignal, onCleanup, onMount } from "solid-js";
import type { PanelState, QuotaRow } from "./types.js";
import { loadCache, refreshAndGetState, stopPolling } from "./cache.js";
import { renderBarUnicode } from "./format.js";

const POLL_MS = 90_000;
const BAR_WIDTH = 20;

/**
 * Creates a reactive panel state that polls the usage API.
 * Returns a signal getter for the current PanelState.
 *
 * This is a standalone reactive primitive, not a component,
 * so it can be used from any rendering context.
 */
export function createQuotaPanelState() {
  const [state, setState] = createSignal<PanelState>({
    title: "Plan usage",
    stale: false,
    rows: [
      { label: "5-hour limit", percent: 0, resetText: "--", resetsAtMs: 0, status: "loading" },
      { label: "Weekly \u00b7 all models", percent: 0, resetText: "--", resetsAtMs: 0, status: "loading" },
      { label: "Weekly \u00b7 Fable", percent: 0, resetText: "--", resetsAtMs: 0, status: "loading" },
    ],
  });

  let interval: ReturnType<typeof setInterval> | null = null;

  async function refresh() {
    const s = await refreshAndGetState();
    setState(s);
  }

  onMount(() => {
    void loadCache().then(refresh);
    interval = setInterval(() => void refresh(), POLL_MS);
  });

  onCleanup(() => {
    if (interval !== null) clearInterval(interval);
    stopPolling();
  });

  return state;
}

/**
 * Returns a plain-text rendering of the quota panel for use
 * in opentui <text> elements or any string context.
 *
 * This avoids depending on opentui JSX intrinsics (<box>, <text>)
 * which are not importable as a library, only available as JSX
 * namespace intrinsics inside the OpenCode TUI runtime.
 */
export function renderPanelText(s: PanelState): string {
  const lines: string[] = [];
  lines.push("");
  lines.push(s.title);
  lines.push("");

  for (const row of s.rows) {
    lines.push(formatRowText(row));
  }

  lines.push("");
  return lines.join("\n");
}

function formatRowText(row: QuotaRow): string {
  if (row.status === "loading") {
    return `  ${row.label}\n    loading...`;
  }
  if (row.status === "auth_required") {
    return `  ${row.label}\n    auth required`;
  }
  if (row.status === "unavailable") {
    return `  ${row.label}\n    unavailable`;
  }

  const bar = renderBarUnicode(row.percent, BAR_WIDTH);
  const pct = `${row.percent}%`.padStart(4);
  const reset = `resets ${row.resetText}`;
  return `  ${row.label}${pct}\n    ${bar}  ${reset}`;
}

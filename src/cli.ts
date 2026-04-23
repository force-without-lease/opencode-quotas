#!/usr/bin/env bun
import { loadCache, refreshAndGetState } from "./cache.js";
import { renderTuiPanel, renderDesktopPanel } from "./format.js";

const args = process.argv.slice(2);
const mode = args.includes("--desktop") ? "desktop" : "tui";
const watch = args.includes("--watch");
const interval = parseInterval(args);

async function main(): Promise<void> {
  await loadCache();
  const state = await refreshAndGetState();
  render(state);

  if (watch) {
    setInterval(async () => {
      const updated = await refreshAndGetState();
      process.stdout.write("\x1b[2J\x1b[H");
      render(updated);
    }, interval);
  }
}

function render(state: { title: string; rows: ReadonlyArray<{ label: string; percent: number; resetText: string; status: string }> }): void {
  const output =
    mode === "desktop"
      ? renderDesktopPanel(state.title, state.rows)
      : renderTuiPanel(state.title, state.rows);
  console.log(output);
}

function parseInterval(argv: string[]): number {
  const idx = argv.indexOf("--interval");
  if (idx === -1 || idx + 1 >= argv.length) return 90_000;
  const val = Number(argv[idx + 1]);
  if (!Number.isFinite(val) || val < 5_000) return 90_000;
  return val;
}

main().catch((err: unknown) => {
  console.error("quota-panel: failed to start", err);
  process.exit(1);
});

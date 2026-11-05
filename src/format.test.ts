import assert from "node:assert/strict";
import { test } from "bun:test";
import { fetchChatGptRows } from "./chatgpt.js";
import { formatExhaustionCountdown, formatResetCountdown, renderResetBar, renderTuiPanel, renderDesktopPanel } from "./format.js";
import { renderPanelText } from "./panel.js";

test("사용 기간 평균 소진 속도로 남은 시간을 계산하고 표시", async () => {
  const now = Date.UTC(2026, 10, 4, 12);
  const hour = 3_600_000;
  const reset = now + 3 * hour;
  const estimate = (percent: number, at = now) =>
    formatExhaustionCountdown(percent, reset, 5 * hour, now, at);

  assert.equal(estimate(40), "ETA ~3h");
  assert.equal(estimate(80), "ETA ~30m");
  assert.equal(estimate(80, now + 5 * 60_000), "ETA ~25m");
  assert.equal(estimate(10), "ETA ~18h");
  assert.equal(estimate(0), "ETA --");
  assert.equal(estimate(100), "Exhausted");
  assert.equal(estimate(NaN), "ETA --");
  assert.equal(estimate(40, reset), "ETA --");
  assert.equal(formatExhaustionCountdown(40, now + 5 * hour, 5 * hour, now), "ETA --");
  assert.equal(formatExhaustionCountdown(40, NaN, 5 * hour, now), "ETA --");
  assert.equal(formatResetCountdown(new Date(reset).toISOString(), now), "3h 0m");
  assert.equal(formatResetCountdown(new Date(now + 24 * hour).toISOString(), now), "1d 0h");
  assert.equal(formatResetCountdown(new Date(now + 53 * hour).toISOString(), now), "2d 5h");
  assert.equal(formatResetCountdown(new Date(now + (5 * 24 + 18) * hour).toISOString(), now), "5d 18h");
  assert.equal(formatExhaustionCountdown(50, now + 119 * hour, 168 * hour, now), "ETA ~2d 1h");

  for (const width of [0, 8, 28, 36, 43]) {
    for (const percent of [0, 40, 100]) {
      const bar = renderResetBar(percent, width, "3h 0m");
      assert.equal(bar.filled.length, Math.round(percent / 100 * width));
      assert.equal(bar.filled.length + bar.empty.length, width);
      if (width >= 6) assert.ok((bar.filled + bar.empty).includes("3h 0m"));
      assert.ok(!(bar.filled + bar.empty).includes("resets"));
      if (width >= 6) {
        assert.equal((bar.filled + bar.empty).indexOf("3h 0m"), 1);
      }
    }
  }

  const originalFetch = globalThis.fetch;
  const originalNow = Date.now;
  try {
    Date.now = () => now;
    globalThis.fetch = (async () => Response.json({
      rate_limit: {
        primary_window: { used_percent: 50, limit_window_seconds: 604800, reset_at: (now + 96 * hour) / 1000 },
        secondary_window: { used_percent: 80, limit_window_seconds: 18000, reset_at: reset / 1000 },
      },
    })) as typeof fetch;
    const result = await fetchChatGptRows({ token: "test" });
    assert.ok(result.ok);
    assert.deepEqual(result.rows.map((row) => row.exhaustionText), ["ETA ~3d 0h", "ETA ~30m"]);

    const state = { title: "ChatGPT usage", rows: result.rows };
    for (const output of [
      renderPanelText(state),
      renderTuiPanel(state.title, state.rows),
      renderDesktopPanel(state.title, state.rows),
    ]) {
      const estimateLine = output.split("\n").find((line) => line.includes("ETA ~30m"));
      assert.ok(estimateLine?.includes("80%"));
      assert.ok(output.includes("ETA ~3d"));
      assert.ok(output.includes("resets 3h 0m"));
    }
    const estimateLine = renderDesktopPanel(state.title, state.rows).split("\n").find((line) => line.includes("ETA ~30m"));
    assert.ok(estimateLine);
    assert.equal(Bun.stringWidth(estimateLine), 52);
  } finally {
    globalThis.fetch = originalFetch;
    Date.now = originalNow;
  }
});

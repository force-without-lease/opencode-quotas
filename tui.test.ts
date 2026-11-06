import assert from "node:assert/strict";
import { mock, test } from "bun:test";
import { testRender } from "@opentui/solid";

test("패널 클릭 새로고침의 30초 제한", async () => {
  const calls: boolean[] = [];
  const state = {
    title: "Claude usage",
    rows: [{ label: "5-hour limit", percent: 78, resetText: "4h 15m", exhaustionText: "ETA ~9m", resetsAtMs: 1, status: "ok" }],
  };
  mock.module("./src/cache.js", () => ({
    loadCache: async () => {},
    refreshAndGetState: async (_token: unknown, force: boolean) => { calls.push(force); return state; },
    stopPolling: () => {},
  }));
  const { default: plugin } = await import("./tui.js");
  let section: () => any;
  const originalNow = Date.now;
  let now = originalNow();
  Date.now = () => now;
  const dispose = plugin.setup({
    client: { rpc: () => ({ chatgpt: async () => ({}) }) },
    theme: {
      text: { base: "#ffffff", muted: "#999999" },
      background: { base: "#101018", raised: { high: "#282834" } },
    },
    keymap: { layer: () => {} },
    ui: { slot: (input: any) => { section = input.render; return () => {}; }, toast: { show: () => {} } },
  } as any);
  const view = await testRender(() => section(), { width: 38, height: 6 });
  try {
    const frame = await view.waitForFrame((text) => text.includes("ETA ~9m"));
    assert.ok(frame.split("\n")[1]?.includes("4h 15m · ETA ~9m"));
    assert.ok(frame.split("\n")[2]?.includes("78%"));
    await view.mockMouse.click(2, 2);
    assert.deepEqual(calls, [false]);
    now += 10_000;
    await view.mockMouse.click(2, 2);
    assert.deepEqual(calls, [false]);
    now += 19_999;
    await view.mockMouse.click(2, 2);
    assert.deepEqual(calls, [false]);
    now += 1;
    await view.mockMouse.click(2, 2);
    await view.flush();
    assert.deepEqual(calls, [false, true]);
    await view.mockMouse.click(2, 2);
    now += 29_999;
    await view.mockMouse.click(2, 2);
    assert.equal(calls.length, 2);
    now += 1;
    await view.mockMouse.click(2, 2);
    await view.flush();
    assert.deepEqual(calls, [false, true, true]);
    console.log(frame);
  } finally {
    dispose?.();
    view.renderer.destroy();
    Date.now = originalNow;
    mock.restore();
  }
});

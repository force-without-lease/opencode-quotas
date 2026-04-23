/**
 * No-op server plugin entry.
 *
 * OpenCode's plugin loader requires every plugin in the config to
 * export a server() function from its main entry. This file satisfies
 * that requirement so the TUI entry (./tui) can be loaded separately
 * by the TUI plugin loader.
 */
import type { Plugin, PluginModule } from "@opencode-ai/plugin";

const server: Plugin = async () => {
  return {};
};

const plugin: PluginModule & { id: string } = {
  id: "opencode-claudesub-quotas",
  server,
};

export default plugin;
export { server };

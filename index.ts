import { Plugin } from "@opencode/plugin"
import { QuotaRpc } from "./src/rpc.js"

export default Plugin.define({
  id: "claudesub-quotas",
  async setup(context) {
    // ~/.claude/.credentials.json is refreshed only while Claude Code runs, so
    // hand the TUI opencode's own Claude login; resolve() refreshes it when it
    // is about to expire.
    const rpc = await context.rpc.register(QuotaRpc, {
      token: async () => {
        const connection = await context.integration.connection.active("anthropic")
        if (!connection) return {}
        const credential = await context.integration.connection.resolve(connection)
        return credential?.type === "oauth" ? { token: credential.access } : {}
      },
    })
    return () => rpc.dispose()
  },
})

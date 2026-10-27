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
      chatgpt: async () => {
        const connection = await context.integration.connection.active("openai")
        if (!connection) return {}
        const credential = await context.integration.connection.resolve(connection)
        if (credential?.type !== "oauth") return {}
        const accountID = credential.metadata?.["accountID"]
        return typeof accountID === "string" ? { token: credential.access, accountID } : { token: credential.access }
      },
    })
    return () => rpc.dispose()
  },
})

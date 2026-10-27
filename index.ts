import { Plugin } from "@opencode/plugin"
import { QuotaRpc } from "./src/rpc.js"

export default Plugin.define({
  id: "claudesub-quotas",
  async setup(context) {
    async function activeOAuthCredential(integrationID: string) {
      const connection = await context.integration.connection.active(integrationID)
      if (!connection) return undefined
      const credential = await context.integration.connection.resolve(connection)
      return credential?.type === "oauth" ? credential : undefined
    }

    // ~/.claude/.credentials.json is refreshed only while Claude Code runs, so
    // hand the TUI opencode's own Claude login; resolve() refreshes it when it
    // is about to expire.
    const rpc = await context.rpc.register(QuotaRpc, {
      token: async () => {
        const credential = await activeOAuthCredential("anthropic")
        return credential ? { token: credential.access } : {}
      },
      chatgpt: async () => {
        const credential = await activeOAuthCredential("openai")
        if (!credential) return {}
        const accountID = credential.metadata?.["accountID"]
        if (typeof accountID !== "string") return { token: credential.access }
        return { token: credential.access, accountID }
      },
    })
    return () => rpc.dispose()
  },
})

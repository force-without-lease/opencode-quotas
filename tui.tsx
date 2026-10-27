/** @jsxImportSource @opentui/solid */
import { createSignal, For } from "solid-js"
import { Plugin } from "@opencode/plugin/tui"
import { resolveToken, type TokenResult } from "./src/auth.js"
import { loadCache, refreshAndGetState } from "./src/cache.js"
import { QuotaRpc } from "./src/rpc.js"
import { renderBarUnicode } from "./src/format.js"
import { renderPanelText } from "./src/panel.js"
import { fetchChatGptRows } from "./src/chatgpt.js"
import type { PanelState, QuotaRow } from "./src/types.js"

const POLL_MS = 90_000
const STALE_MS = 5 * 60 * 1000

const loadingState = (): PanelState => ({
  title: "Claude usage",
  stale: false,
  rows: [
    { label: "5-hour limit", percent: 0, resetText: "--", resetsAtMs: 0, status: "loading" },
    { label: "Weekly · all models", percent: 0, resetText: "--", resetsAtMs: 0, status: "loading" },
    { label: "Weekly · Claude Design", percent: 0, resetText: "--", resetsAtMs: 0, status: "loading" },
    { label: "Sonnet only", percent: 0, resetText: "--", resetsAtMs: 0, status: "loading" },
  ],
})

export default Plugin.define({
  id: "claudesub-quotas.tui",
  setup(context) {
    const [state, setState] = createSignal<PanelState>(loadingState())
    const [chatgpt, setChatgpt] = createSignal<QuotaRow[]>([])
    let chatgptFetchedAt = 0
    const rpc = context.client.rpc(QuotaRpc)

    async function opencodeToken(): Promise<TokenResult> {
      const result = await rpc.token({}).catch(() => undefined)
      if (typeof result === "object" && result !== null && "token" in result && typeof result.token === "string") {
        return { ok: true, token: result.token }
      }
      return resolveToken()
    }

    async function refreshChatgpt() {
      const auth = await rpc.chatgpt({}).catch(() => undefined)
      const rows = typeof auth?.token === "string" ? await fetchChatGptRows({ token: auth.token, accountID: auth.accountID }) : null
      if (rows) {
        chatgptFetchedAt = Date.now()
        setChatgpt(rows)
      } else if (Date.now() - chatgptFetchedAt > STALE_MS) {
        setChatgpt([])
      }
    }

    async function refresh() {
      void refreshChatgpt()
      try {
        setState(await refreshAndGetState(opencodeToken))
      } catch (error) {
        context.ui.toast.show({
          variant: "error",
          message: `quota 조회 실패: ${String(error)}`,
          duration: 3000,
        })
      }
    }

    void loadCache().then(refresh)
    const timer = setInterval(() => void refresh(), POLL_MS)

    context.keymap.layer(() => ({
      mode: "global",
      commands: [
        {
          id: "claudesub.quota",
          title: "Claude usage",
          slash: { name: "quota" },
          run: () =>
            context.ui.toast.show({
              title: state().title,
              message: renderPanelText(state()) + (chatgpt().length > 0 ? renderPanelText({ title: "ChatGPT usage", rows: chatgpt() }) : ""),
              duration: 8000,
            }),
        },
      ],
    }))

    const unregister = context.ui.slot({
      append: "sidebar.footer",
      render: () => {
        const fg = context.theme.text.muted
        const section = (title: string, rows: QuotaRow[]) => (
          <box flexDirection="column">
            <text fg={fg}>{title}</text>
            <For each={rows}>
              {(row) => (
                <box flexDirection="column">
                  <box flexDirection="row" justifyContent="space-between">
                    <text>{row.label}</text>
                    <text fg={fg}>
                      {row.status === "ok" ? `${row.percent}% · resets ${row.resetText}` : "--"}
                    </text>
                  </box>
                  <text fg={context.theme.primary}>
                    {row.status === "ok" ? renderBarUnicode(row.percent, 28) : ""}
                  </text>
                </box>
              )}
            </For>
          </box>
        )
        return (
          <box flexDirection="column" paddingX={1}>
            {section("Claude usage", state().rows)}
            {chatgpt().length > 0 ? section("ChatGPT usage", chatgpt()) : null}
          </box>
        )
      },
    })

    return () => {
      clearInterval(timer)
      unregister()
    }
  },
})

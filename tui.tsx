/** @jsxImportSource @opentui/solid */
import { createSignal, For } from "solid-js"
import { Plugin } from "@opencode/plugin/tui"
import { resolveToken, type TokenResult } from "./src/auth.js"
import { loadCache, refreshAndGetState } from "./src/cache.js"
import { QuotaRpc } from "./src/rpc.js"
import { renderResetBar } from "./src/format.js"
import { renderPanelText } from "./src/panel.js"
import { fetchChatGptRows } from "./src/chatgpt.js"
import type { PanelState, QuotaRow } from "./src/types.js"

const POLL_MS = 90_000
const REFRESH_COOLDOWN_MS = POLL_MS
const STALE_MS = 5 * 60 * 1000
const BAR_WIDTH = 28
const CHATGPT_ERROR_TITLES = {
  auth: "ChatGPT usage (auth required)",
  unavailable: "ChatGPT usage (unavailable)",
}

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
  id: "opencode-quotas.tui",
  setup(context) {
    const [claudeState, setClaudeState] = createSignal<PanelState>(loadingState())
    const [chatgptState, setChatgptState] = createSignal<PanelState | null>(null)
    let chatgptFetchedAtMs = 0
    let lastRefreshMs = -Infinity
    let refreshing = false
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
      if (typeof auth?.token !== "string") {
        setChatgptState(null)
        return
      }
      const result = await fetchChatGptRows({ token: auth.token, accountID: auth.accountID })
      if (result.ok) {
        chatgptFetchedAtMs = Date.now()
        setChatgptState({ title: "ChatGPT usage", rows: result.rows })
      } else if (result.error === "auth" || Date.now() - chatgptFetchedAtMs > STALE_MS) {
        setChatgptState({ title: CHATGPT_ERROR_TITLES[result.error], rows: [] })
      }
    }

    function quotaText(): string {
      const claudeText = renderPanelText(claudeState())
      const chatgpt = chatgptState()
      if (!chatgpt) return claudeText
      return claudeText + renderPanelText(chatgpt)
    }

    async function refresh(force = false) {
      const now = Date.now()
      if (refreshing || now - lastRefreshMs < REFRESH_COOLDOWN_MS) return
      refreshing = true
      lastRefreshMs = now
      try {
        await Promise.all([
          refreshChatgpt(),
          refreshAndGetState(opencodeToken, force).then(setClaudeState),
        ])
      } catch (error) {
        context.ui.toast.show({
          variant: "error",
          message: `quota 조회 실패: ${String(error)}`,
          duration: 3000,
        })
      } finally {
        refreshing = false
      }
    }

    void loadCache().then(() => refresh())
    const timer = setInterval(() => void refresh(), POLL_MS)

    context.keymap.layer(() => ({
      mode: "global",
      commands: [
        {
          id: "opencode-quotas.quota",
          title: "Claude usage",
          slash: { name: "quota" },
          run: () =>
            context.ui.toast.show({
              title: claudeState().title,
              message: quotaText(),
              duration: 8000,
            }),
        },
      ],
    }))

    const unregister = context.ui.slot({
      append: "sidebar.footer",
      render: () => {
        const fg = context.theme.text.muted
        const renderSection = (title: string, rows: QuotaRow[]) => (
          <box flexDirection="column">
            <text fg={fg}>{title}</text>
            <For each={rows}>
              {(row) => {
                const [width, setWidth] = createSignal(BAR_WIDTH)
                const bar = () => renderResetBar(row.percent, width(), row.status === "ok" ? `${row.percent}%` : "--")
                return (
                  <box flexDirection="column">
                    <box flexDirection="row" justifyContent="space-between" gap={1}>
                      <text flexShrink={1} minWidth={0} wrapMode="none" truncate>{row.label}</text>
                      <text fg={fg} flexShrink={0}>
                        {row.status === "ok"
                          ? `${row.resetText} · ${row.exhaustionText ?? "ETA --"}`
                          : "--"}
                      </text>
                    </box>
                    {row.status === "ok" ? (
                      <text
                        width="100%"
                        height={1}
                        wrapMode="none"
                        onSizeChange={function () { setWidth(this.width) }}
                      >
                        <span style={{ bg: context.theme.text.base, fg: context.theme.background.base }}>
                          {bar().filled}
                        </span>
                        <span style={{ bg: context.theme.background.raised.high, fg: context.theme.text.base }}>
                          {bar().empty}
                        </span>
                      </text>
                    ) : null}
                  </box>
                )
              }}
            </For>
          </box>
        )
        const chatgptSection = () => {
          const state = chatgptState()
          return state ? renderSection(state.title, state.rows) : null
        }
        return (
          <box flexDirection="column" paddingX={1} onMouseDown={(event) => {
            if (event.button !== 0) return
            event.stopPropagation()
            void refresh(true)
          }}>
            {renderSection("Claude usage", claudeState().rows)}
            {chatgptSection()}
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

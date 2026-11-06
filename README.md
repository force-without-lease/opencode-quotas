# opencode-quotas

OpenCode V2 plugin that adds Claude and ChatGPT quota usage to the TUI sidebar.

## What it does

Displays quota rows in the sidebar footer:

- **5-hour limit** -- rolling 5-hour usage window
- **Weekly, all models** -- 7-day aggregate across all models
- **Weekly, Fable** -- 7-day Fable usage (per-model cap, hidden if the plan has none)

Each row shows a progress bar, percentage, reset countdown, and estimated exhaustion time.

## Install

Add the plugin directory to OpenCode V2's `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["file:///path/to/opencode-quotas"]
}
```

## Build

```sh
bun install
bun run build.ts
```

## Standalone CLI

```sh
bun run src/cli.ts            # TUI mode
bun run src/cli.ts --desktop   # boxed panel
bun run src/cli.ts --watch     # auto-refresh
```

## How it works

- The V2 server part reads Claude and ChatGPT OAuth credentials through OpenCode integrations.
- The TUI part requests credentials through typed RPC and polls usage APIs every 90 seconds.
- Caches responses in `~/.cache/opencode-quotas/usage-cache.json`
- Renders via opentui/solid JSX into the `sidebar.footer` slot
- Also registers a `/quota` slash command for on-demand viewing
- The standalone CLI reads Claude credentials from `~/.claude/.credentials.json` or `CLAUDE_CODE_OAUTH_TOKEN`.

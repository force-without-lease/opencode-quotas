# opencode-claudesub-quotas

OpenCode TUI plugin that adds a "Plan usage" panel to the sidebar, showing Claude subscription quota usage in real time.

## What it does

Displays three quota rows in the sidebar footer:

- **5-hour limit** -- rolling 5-hour usage window
- **Weekly, all models** -- 7-day aggregate across all models
- **Weekly, Fable** -- 7-day Fable usage (per-model cap, shown as unavailable if the plan has none)

Each row shows a progress bar, percentage, and reset countdown. Data is fetched from the Anthropic OAuth usage API and cached locally.

## Install

From OpenCode's plugin manager (`Ctrl+P` > Plugins > `Shift+I`):

```
file:///path/to/opencode-claudesub-quotas
```

Or add to `~/.config/opencode/opencode.json`:

```json
{
  "plugin": ["file:///path/to/opencode-claudesub-quotas"]
}
```

## Build

```sh
bun install
bun run build
```

## Standalone CLI

```sh
bun run src/cli.ts            # TUI mode
bun run src/cli.ts --desktop   # boxed panel
bun run src/cli.ts --watch     # auto-refresh
```

## How it works

- Reads OAuth credentials from `~/.claude/.credentials.json`
- Polls `api.anthropic.com/api/oauth/usage` every 90 seconds
- Caches responses in `~/.cache/opencode-claudesub-quotas/usage-cache.json`
- Renders via opentui/solid JSX into the `sidebar_footer` slot
- Also registers a `/quota` slash command for on-demand viewing

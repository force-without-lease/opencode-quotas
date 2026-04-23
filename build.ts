import { build } from "bun";
import solidPlugin from "@opentui/solid/bun-plugin";

const externals = [
  "@opencode-ai/plugin",
  "@opencode-ai/plugin/tui",
  "@opencode-ai/sdk",
  "@opencode-ai/sdk/v2",
  "@opentui/core",
  "@opentui/solid",
  "solid-js",
  "solid-js/web",
  "effect",
];

const buildOpts = {
  outdir: "dist",
  target: "bun" as const,
  format: "esm" as const,
  splitting: false,
  sourcemap: "external" as const,
  external: externals,
  plugins: [solidPlugin],
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
};

// Server entry: no-op server plugin so OpenCode's server loader doesn't reject us
const serverResult = await build({ ...buildOpts, entrypoints: ["src/server.ts"] });

// TUI entry: the actual quota panel plugin
const tuiResult = await build({ ...buildOpts, entrypoints: ["src/index.tsx"] });

// CLI entry: standalone usage
const cliResult = await build({ ...buildOpts, entrypoints: ["src/cli.ts"] });

const allResults = [serverResult, tuiResult, cliResult];
const result = allResults.every((r) => r.success)
  ? { success: true, outputs: allResults.flatMap((r) => r.outputs), logs: [] as unknown[] }
  : {
      success: false,
      outputs: [] as unknown[],
      logs: allResults.flatMap((r) => r.logs),
    };

if (!result.success) {
  console.error("Build failed:");
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

console.log(
  `Build succeeded: ${result.outputs.length} file(s) written to dist/`,
);
for (const output of result.outputs) {
  console.log(`  ${output.path} (${output.kind})`);
}

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import type { CredentialFile } from "./types.js";

const CREDENTIALS_FILENAME = ".credentials.json";

/**
 * Resolves the OAuth access token from available credential sources.
 *
 * Resolution order (first match wins):
 * 1. CLAUDE_CODE_OAUTH_TOKEN environment variable
 * 2. ~/.claude/.credentials.json file (claudeAiOauth.accessToken or flat accessToken)
 *
 * Linux secret-tool (GNOME Keyring) is intentionally skipped because spawning
 * a child process for secret-tool adds latency and failure modes that aren't
 * worth it for a polling widget. The file credential covers the common case.
 */
export async function resolveToken(): Promise<
  | { ok: true; token: string }
  | { ok: false; reason: "no_credentials" | "expired" }
> {
  const envToken = process.env["CLAUDE_CODE_OAUTH_TOKEN"];
  if (typeof envToken === "string" && envToken.length > 0) {
    return { ok: true, token: envToken };
  }

  const configDir =
    process.env["CLAUDE_CONFIG_DIR"] || join(homedir(), ".claude");
  const credPath = join(configDir, CREDENTIALS_FILENAME);

  let raw: string;
  try {
    raw = await readFile(credPath, "utf-8");
  } catch {
    return { ok: false, reason: "no_credentials" };
  }

  let parsed: CredentialFile;
  try {
    parsed = JSON.parse(raw) as CredentialFile;
  } catch {
    return { ok: false, reason: "no_credentials" };
  }

  const token =
    parsed.claudeAiOauth?.accessToken ?? parsed.accessToken ?? undefined;
  if (typeof token !== "string" || token.length === 0) {
    return { ok: false, reason: "no_credentials" };
  }

  const expiresAt =
    parsed.claudeAiOauth?.expiresAt ?? parsed.expiresAt ?? undefined;
  if (typeof expiresAt === "number" && expiresAt < Date.now()) {
    return { ok: false, reason: "expired" };
  }

  return { ok: true, token };
}

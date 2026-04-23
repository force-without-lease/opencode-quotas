/**
 * Clamps a numeric value to the 0-100 range.
 * Treats null, undefined, NaN, and Infinity as 0.
 */
export function clampPercent(v: number | null | undefined): number {
  if (v === null || v === undefined || !Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, v));
}

/**
 * Formats an ISO 8601 reset timestamp into a short human-readable countdown.
 * Examples: "5m", "1h", "15h", "1d", "2d", "now"
 */
export function formatResetCountdown(
  resetsAtIso: string,
  nowMs?: number,
): string {
  const now = nowMs ?? Date.now();
  const resetMs = new Date(resetsAtIso).getTime();
  if (!Number.isFinite(resetMs)) return "--";

  const deltaMs = resetMs - now;
  if (deltaMs <= 0) return "now";

  const minutes = deltaMs / 60_000;
  if (minutes < 60) {
    return `${Math.max(1, Math.round(minutes))}m`;
  }

  const hours = deltaMs / 3_600_000;
  if (hours < 24) {
    return `${Math.round(hours)}h`;
  }

  const days = hours / 24;
  return `${Math.round(days)}d`;
}

/**
 * Renders a TUI progress bar using # and . characters.
 * Width is the total character count inside the brackets.
 */
export function renderBar(percent: number, width: number): string {
  const clamped = clampPercent(percent);
  const filled = Math.round((clamped / 100) * width);
  const empty = width - filled;
  return "[" + "#".repeat(filled) + ".".repeat(empty) + "]";
}

/**
 * Renders a unicode progress bar using block characters.
 * For richer terminal rendering.
 */
export function renderBarUnicode(percent: number, width: number): string {
  const clamped = clampPercent(percent);
  const filled = Math.round((clamped / 100) * width);
  const empty = width - filled;
  return "\u2588".repeat(filled) + "\u2591".repeat(empty);
}

/**
 * Pads a string to a target length, left-aligning the content.
 */
export function padRight(s: string, len: number): string {
  return s.length >= len ? s : s + " ".repeat(len - s.length);
}

/**
 * Pads a string to a target length, right-aligning the content.
 */
export function padLeft(s: string, len: number): string {
  return s.length >= len ? s : " ".repeat(len - s.length) + s;
}

/**
 * Renders the full TUI-mode panel as a plain string.
 * Suitable for terminal output or embedding in a statusline.
 */
export function renderTuiPanel(
  title: string,
  rows: ReadonlyArray<{
    label: string;
    percent: number;
    resetText: string;
    status: string;
  }>,
): string {
  const BAR_WIDTH = 18;
  const LABEL_WIDTH = 24;
  const lines: string[] = [title];

  for (const row of rows) {
    const label = padRight(row.label, LABEL_WIDTH);
    let bar: string;
    let pct: string;
    let reset: string;

    if (row.status === "loading") {
      bar = "[loading...       ]";
      pct = " --";
      reset = "resets --";
    } else if (row.status === "auth_required") {
      bar = "[auth required     ]";
      pct = " --";
      reset = "resets --";
    } else if (row.status === "unavailable") {
      bar = "[unavailable       ]";
      pct = " --";
      reset = "resets --";
    } else {
      bar = renderBar(row.percent, BAR_WIDTH);
      pct = padLeft(`${row.percent}%`, 4);
      reset = `resets ${row.resetText}`;
    }

    lines.push(`${label}${bar} ${pct}  ${reset}`);
  }

  return lines.join("\n");
}

/**
 * Renders a boxed desktop-like panel using Unicode box drawing.
 * For richer terminal environments.
 */
export function renderDesktopPanel(
  title: string,
  rows: ReadonlyArray<{
    label: string;
    percent: number;
    resetText: string;
    status: string;
  }>,
): string {
  const INNER_WIDTH = 50;
  const BAR_INNER = 34;
  const lines: string[] = [];

  lines.push("\u250c" + "\u2500".repeat(INNER_WIDTH) + "\u2510");

  const titlePadded =
    "  " +
    title +
    " ".repeat(Math.max(0, INNER_WIDTH - title.length - 5)) +
    "\u203a  ";
  lines.push("\u2502" + titlePadded + "\u2502");
  lines.push("\u2502" + " ".repeat(INNER_WIDTH) + "\u2502");

  for (const row of rows) {
    let pctStr: string;
    let barLine: string;
    let resetStr: string;

    if (row.status !== "ok") {
      pctStr = "--";
      barLine = row.status === "loading"
        ? "loading..."
        : row.status === "auth_required"
          ? "auth required"
          : "unavailable";
      resetStr = "resets --";
    } else {
      pctStr = `${row.percent}%`;
      barLine = renderBarUnicode(row.percent, BAR_INNER);
      resetStr = `resets ${row.resetText}`;
    }

    const labelLine =
      "  " +
      row.label +
      " ".repeat(Math.max(1, INNER_WIDTH - row.label.length - pctStr.length - 4)) +
      pctStr +
      "  ";
    lines.push("\u2502" + labelLine + "\u2502");

    const barRight =
      "  " +
      padRight(barLine, INNER_WIDTH - resetStr.length - 4) +
      resetStr +
      "  ";
    lines.push("\u2502" + barRight + "\u2502");
    lines.push("\u2502" + " ".repeat(INNER_WIDTH) + "\u2502");
  }

  lines.push("\u2514" + "\u2500".repeat(INNER_WIDTH) + "\u2518");

  return lines.join("\n");
}

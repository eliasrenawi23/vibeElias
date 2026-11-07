const UNIT_MS: Record<string, number> = {
  ms: 1,
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  w: 604_800_000,
};

/**
 * Parses an ms-style duration (`900`, `45s`, `15m`, `12h`, `30d`, `2w`) into milliseconds.
 * A bare number is taken as seconds (like `jsonwebtoken`'s `expiresIn`).
 */
export function parseDurationMs(value: string): number {
  const m = /^\s*(\d+(?:\.\d+)?)\s*(ms|s|m|h|d|w)?\s*$/i.exec(value);
  if (!m) throw new Error(`Invalid duration: "${value}" (use e.g. 15m, 12h, 30d)`);
  const amount = Number(m[1]);
  const unit = (m[2] ?? 's').toLowerCase();
  const ms = Math.round(amount * (UNIT_MS[unit] as number));
  if (ms <= 0) throw new Error(`Duration must be positive: "${value}"`);
  return ms;
}

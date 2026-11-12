import { isIP } from 'node:net';

/**
 * Proxy hops in front of the API in the production stack (docker-compose.prod.yml):
 * Caddy (TLS) -> nginx (web container) -> API. nginx forwards `X-Forwarded-For: <client>, <caddy>`
 * and connects from its own address, so trusting two hops makes `req.ip` the client's address
 * (what the login throttle counts). In the local rehearsal without Caddy the header holds only the
 * client, and Express stops at the left-most entry, so 2 is right there as well.
 */
export const DEFAULT_PROXY_HOPS = 2;

/** Value for Express `app.set('trust proxy', ...)`; `false` = do not set it (direct clients). */
export type TrustProxySetting = false | number | string;

/** Named subnets understood by Express (`proxy-addr`). */
const PRESETS = new Set(['loopback', 'linklocal', 'uniquelocal']);

/** `10.0.0.0/8`, `fd00::/8`, `192.168.0.0/255.255.0.0` or a plain address. */
function isAddressOrSubnet(token: string): boolean {
  const slash = token.indexOf('/');
  if (slash === -1) return isIP(token) !== 0;
  const address = token.slice(0, slash);
  const range = token.slice(slash + 1);
  const family = isIP(address);
  if (family === 0) return false;
  if (/^\d+$/.test(range)) return Number(range) <= (family === 4 ? 32 : 128);
  return family === 4 && isIP(range) === 4;
}

/**
 * Parses `TRUST_PROXY`:
 * - empty / `false` / `no` / `off` / `0` -> `false` (no proxy; `req.ip` is the socket address);
 * - `true` / `yes` / `on` -> `DEFAULT_PROXY_HOPS` (Caddy + nginx), never the literal `true`,
 *   which would trust any client-supplied `X-Forwarded-For` (and which Express rejects as an
 *   address list when it arrives as the string "true");
 * - a whole number -> that many hops (Express semantics: `1` = only the nearest proxy);
 * - otherwise a comma-separated list of presets (`loopback`, `linklocal`, `uniquelocal`),
 *   addresses or subnets, passed through to Express as is (spaces around commas removed).
 * Throws on anything else, so a typo stops the API at boot with a readable message.
 */
export function parseTrustProxy(raw: string | null | undefined): TrustProxySetting {
  const value = (raw ?? '').trim();
  const lower = value.toLowerCase();
  if (!value || ['false', 'no', 'off', '0'].includes(lower)) return false;
  if (['true', 'yes', 'on'].includes(lower)) return DEFAULT_PROXY_HOPS;
  if (/^\d+$/.test(value)) {
    const hops = Number(value);
    if (hops > 10) throw new Error(`TRUST_PROXY hop count ${value} is not plausible (max 10)`);
    return hops;
  }
  const tokens = value.split(',').map((t) => t.trim());
  const bad = tokens.filter((t) => !PRESETS.has(t.toLowerCase()) && !isAddressOrSubnet(t));
  if (bad.length > 0) {
    throw new Error(
      `TRUST_PROXY: not a preset, address or subnet: ${bad.map((b) => `"${b}"`).join(', ')} ` +
        '(use true, a hop count such as 2, or e.g. loopback,uniquelocal)',
    );
  }
  return tokens.map((t) => (PRESETS.has(t.toLowerCase()) ? t.toLowerCase() : t)).join(',');
}

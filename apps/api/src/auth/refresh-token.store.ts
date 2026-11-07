import { Injectable } from '@nestjs/common';

/**
 * Remembers refresh-token ids (`jti`) that were already exchanged, so a rotated refresh token
 * cannot be used again. Logout and password changes are enforced through `User.tokenVersion`
 * (persistent); this store only adds single-use semantics on top. It is process-local: fine for
 * the single API container this app runs as; a restart forgets used ids (tokens stay bound to
 * `tokenVersion` and their 30-day expiry).
 *
 * Per-token tracking (instead of bumping `tokenVersion` on every refresh) keeps the office PC
 * and the phone logged in at the same time.
 */
@Injectable()
export class RefreshTokenStore {
  private readonly used = new Map<string, number>();
  private lastPrune = Date.now();

  /**
   * Marks `jti` as used. Returns false when it had been used before (replay of a rotated token).
   * @param expiresAtSec the token's `exp` claim; the entry is forgotten after that time.
   */
  consume(jti: string, expiresAtSec: number | undefined): boolean {
    this.prune();
    if (this.used.has(jti)) return false;
    const expiresAtMs = (expiresAtSec ?? Math.floor(Date.now() / 1000) + 86_400) * 1000;
    this.used.set(jti, expiresAtMs);
    return true;
  }

  private prune(): void {
    const now = Date.now();
    if (now - this.lastPrune < 60_000) return;
    this.lastPrune = now;
    for (const [jti, expiresAt] of this.used) if (expiresAt <= now) this.used.delete(jti);
  }
}

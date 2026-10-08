import { AiQuotaError } from "./errors";

/**
 * Sliding-window limiter for outgoing AI calls. The Gemini free tier allows only a few
 * requests per minute; it is better to hold jobs back locally than to burn retries on 429s.
 */
export class RateLimiter {
  private timestamps: number[] = [];

  constructor(
    private readonly limit: number,
    private readonly windowMs: number
  ) {}

  /** Records one request, or throws AiQuotaError saying how long to wait. */
  take(): void {
    const now = Date.now();
    this.timestamps = this.timestamps.filter((t) => now - t < this.windowMs);
    if (this.timestamps.length >= this.limit) {
      throw new AiQuotaError(this.timestamps[0] + this.windowMs - now);
    }
    this.timestamps.push(now);
  }
}

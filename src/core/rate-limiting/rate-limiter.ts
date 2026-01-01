/**
 * Rate Limiter
 *
 * Token bucket implementation for rate limiting API requests.
 * Supports adaptive rate adjustment based on API responses.
 */

/**
 * Rate limiter configuration
 */
export interface RateLimiterConfig {
  /** Maximum requests per minute */
  requestsPerMinute: number;
  /** Maximum burst size (tokens in bucket) */
  burstSize?: number;
  /** Enable adaptive rate limiting */
  adaptive?: boolean;
  /** Minimum rate when adapting (requests per minute) */
  minRate?: number;
  /** Rate recovery factor (0-1, how quickly to recover after rate limit) */
  recoveryFactor?: number;
}

/**
 * Rate limit status
 */
export interface RateLimitStatus {
  availableTokens: number;
  maxTokens: number;
  requestsPerMinute: number;
  isLimited: boolean;
  nextAvailableMs: number;
  recentRateLimitHits: number;
}

/**
 * Rate Limiter class implementing token bucket algorithm
 */
export class RateLimiter {
  private tokens: number;
  private maxTokens: number;
  private refillRate: number;  // tokens per millisecond
  private lastRefill: number;
  private requestsPerMinute: number;

  // Adaptive rate limiting state
  private adaptive: boolean;
  private minRate: number;
  private recoveryFactor: number;
  private rateLimitHits: number = 0;
  private lastRateLimitHit: number = 0;
  private baseRequestsPerMinute: number;

  // Request queue
  private waitQueue: Array<{
    resolve: () => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = [];

  constructor(config: RateLimiterConfig) {
    this.requestsPerMinute = config.requestsPerMinute;
    this.baseRequestsPerMinute = config.requestsPerMinute;
    this.maxTokens = config.burstSize ?? Math.ceil(config.requestsPerMinute / 6); // ~10 seconds burst
    this.tokens = this.maxTokens;
    this.refillRate = config.requestsPerMinute / 60000; // Convert to per ms
    this.lastRefill = Date.now();

    this.adaptive = config.adaptive ?? true;
    this.minRate = config.minRate ?? Math.max(1, Math.floor(config.requestsPerMinute / 4));
    this.recoveryFactor = config.recoveryFactor ?? 0.1;
  }

  /**
   * Refill tokens based on elapsed time
   */
  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = elapsed * this.refillRate;

    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  /**
   * Try to acquire a token (non-blocking)
   */
  tryAcquire(): boolean {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }

    return false;
  }

  /**
   * Acquire a token, waiting if necessary
   */
  async acquire(timeoutMs: number = 30000): Promise<void> {
    // Try immediate acquisition
    if (this.tryAcquire()) {
      return;
    }

    // Calculate wait time
    const tokensNeeded = 1 - this.tokens;
    const waitTime = Math.ceil(tokensNeeded / this.refillRate);

    if (waitTime > timeoutMs) {
      throw new Error(`Rate limit exceeded. Would need to wait ${waitTime}ms but timeout is ${timeoutMs}ms`);
    }

    // Queue the request
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.waitQueue.findIndex((item) => item.resolve === resolve);
        if (index !== -1) {
          this.waitQueue.splice(index, 1);
        }
        reject(new Error('Rate limit acquisition timeout'));
      }, timeoutMs);

      this.waitQueue.push({ resolve, reject, timeout });

      // Schedule retry
      setTimeout(() => {
        this.processQueue();
      }, waitTime);
    });
  }

  /**
   * Process waiting requests
   */
  private processQueue(): void {
    while (this.waitQueue.length > 0 && this.tryAcquire()) {
      const item = this.waitQueue.shift()!;
      clearTimeout(item.timeout);
      item.resolve();
    }
  }

  /**
   * Report a rate limit hit (429 response)
   */
  reportRateLimitHit(retryAfterMs?: number): void {
    this.rateLimitHits++;
    this.lastRateLimitHit = Date.now();

    if (this.adaptive) {
      // Reduce rate
      this.requestsPerMinute = Math.max(
        this.minRate,
        Math.floor(this.requestsPerMinute * 0.5)
      );
      this.refillRate = this.requestsPerMinute / 60000;

      // If retry-after is provided, pause for that duration
      if (retryAfterMs && retryAfterMs > 0) {
        this.tokens = 0;
        this.lastRefill = Date.now() + retryAfterMs;
      }
    }
  }

  /**
   * Report a successful request (for adaptive recovery)
   */
  reportSuccess(): void {
    if (!this.adaptive) {
      return;
    }

    // Only recover if we haven't hit rate limit recently (5 seconds)
    const timeSinceLastHit = Date.now() - this.lastRateLimitHit;
    if (timeSinceLastHit > 5000 && this.requestsPerMinute < this.baseRequestsPerMinute) {
      // Gradually recover rate
      const recovery = (this.baseRequestsPerMinute - this.requestsPerMinute) * this.recoveryFactor;
      this.requestsPerMinute = Math.min(
        this.baseRequestsPerMinute,
        this.requestsPerMinute + Math.max(1, Math.floor(recovery))
      );
      this.refillRate = this.requestsPerMinute / 60000;
    }
  }

  /**
   * Get current status
   */
  getStatus(): RateLimitStatus {
    this.refill();

    const tokensNeeded = Math.max(0, 1 - this.tokens);
    const nextAvailableMs = tokensNeeded > 0 ? Math.ceil(tokensNeeded / this.refillRate) : 0;

    return {
      availableTokens: Math.floor(this.tokens),
      maxTokens: this.maxTokens,
      requestsPerMinute: this.requestsPerMinute,
      isLimited: this.tokens < 1,
      nextAvailableMs,
      recentRateLimitHits: this.rateLimitHits,
    };
  }

  /**
   * Check if rate limited
   */
  isLimited(): boolean {
    this.refill();
    return this.tokens < 1;
  }

  /**
   * Get time until next token is available (ms)
   */
  getWaitTime(): number {
    this.refill();
    if (this.tokens >= 1) {
      return 0;
    }
    const tokensNeeded = 1 - this.tokens;
    return Math.ceil(tokensNeeded / this.refillRate);
  }

  /**
   * Reset the rate limiter
   */
  reset(): void {
    this.tokens = this.maxTokens;
    this.lastRefill = Date.now();
    this.requestsPerMinute = this.baseRequestsPerMinute;
    this.refillRate = this.requestsPerMinute / 60000;
    this.rateLimitHits = 0;
    this.lastRateLimitHit = 0;

    // Clear wait queue
    for (const item of this.waitQueue) {
      clearTimeout(item.timeout);
      item.reject(new Error('Rate limiter reset'));
    }
    this.waitQueue = [];
  }

  /**
   * Get queue length
   */
  getQueueLength(): number {
    return this.waitQueue.length;
  }
}

/**
 * Global rate limiter for shared rate limiting across test workers
 */
export class GlobalRateLimiter {
  private static instance: RateLimiter | null = null;

  static initialize(config: RateLimiterConfig): RateLimiter {
    if (!this.instance) {
      this.instance = new RateLimiter(config);
    }
    return this.instance;
  }

  static getInstance(): RateLimiter {
    if (!this.instance) {
      throw new Error('GlobalRateLimiter not initialized. Call initialize() first.');
    }
    return this.instance;
  }

  static reset(): void {
    if (this.instance) {
      this.instance.reset();
      this.instance = null;
    }
  }
}

export default RateLimiter;

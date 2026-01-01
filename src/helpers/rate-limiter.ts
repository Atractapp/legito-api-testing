import { logger } from '@utils/logger';

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  strategy: 'sliding' | 'fixed';
}

interface RequestRecord {
  timestamp: number;
}

/**
 * Rate limiter to prevent exceeding API rate limits
 * Supports both sliding window and fixed window strategies
 */
export class RateLimiter {
  private requests: RequestRecord[] = [];
  private windowStart: number = Date.now();

  constructor(private config: RateLimitConfig) {}

  /**
   * Wait if necessary to respect rate limits, then record the request
   */
  async throttle(): Promise<void> {
    await this.waitIfNeeded();
    this.recordRequest();
  }

  /**
   * Check if a request can be made without waiting
   */
  canMakeRequest(): boolean {
    this.cleanupOldRequests();
    return this.requests.length < this.config.maxRequests;
  }

  /**
   * Get the delay needed before the next request can be made
   */
  getDelay(): number {
    if (this.canMakeRequest()) {
      return 0;
    }

    if (this.config.strategy === 'fixed') {
      const windowEnd = this.windowStart + this.config.windowMs;
      return Math.max(0, windowEnd - Date.now());
    } else {
      // Sliding window: wait until the oldest request expires
      const oldestRequest = this.requests[0];
      if (oldestRequest) {
        const expiryTime = oldestRequest.timestamp + this.config.windowMs;
        return Math.max(0, expiryTime - Date.now());
      }
      return 0;
    }
  }

  /**
   * Wait if needed before making a request
   */
  private async waitIfNeeded(): Promise<void> {
    const delay = this.getDelay();

    if (delay > 0) {
      logger.warn('Rate limit approaching, waiting before next request', {
        delayMs: delay,
        currentRequests: this.requests.length,
        maxRequests: this.config.maxRequests,
      });

      await this.sleep(delay);

      // After waiting, check again in case window reset
      if (this.config.strategy === 'fixed') {
        this.resetWindowIfNeeded();
      } else {
        this.cleanupOldRequests();
      }
    }
  }

  /**
   * Record a request
   */
  private recordRequest(): void {
    this.requests.push({ timestamp: Date.now() });

    if (this.config.strategy === 'fixed') {
      this.resetWindowIfNeeded();
    } else {
      this.cleanupOldRequests();
    }
  }

  /**
   * Remove requests outside the current window (sliding window)
   */
  private cleanupOldRequests(): void {
    const cutoff = Date.now() - this.config.windowMs;
    this.requests = this.requests.filter((req) => req.timestamp > cutoff);
  }

  /**
   * Reset window if needed (fixed window)
   */
  private resetWindowIfNeeded(): void {
    const now = Date.now();
    if (now - this.windowStart >= this.config.windowMs) {
      this.windowStart = now;
      this.requests = [];
    }
  }

  /**
   * Get current rate limit statistics
   */
  getStats(): {
    requestsInWindow: number;
    remainingRequests: number;
    windowResetIn: number;
  } {
    this.cleanupOldRequests();

    return {
      requestsInWindow: this.requests.length,
      remainingRequests: Math.max(0, this.config.maxRequests - this.requests.length),
      windowResetIn: this.getDelay(),
    };
  }

  /**
   * Reset all counters
   */
  reset(): void {
    this.requests = [];
    this.windowStart = Date.now();
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Global rate limiters for different API endpoint categories
 */
export class RateLimiterManager {
  private limiters: Map<string, RateLimiter> = new Map();

  /**
   * Get or create a rate limiter for a category
   */
  getLimiter(category: string, config?: RateLimitConfig): RateLimiter {
    if (!this.limiters.has(category)) {
      const defaultConfig: RateLimitConfig = {
        maxRequests: parseInt(process.env.RATE_LIMIT_REQUESTS || '100', 10),
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '60000', 10),
        strategy: 'sliding',
      };

      this.limiters.set(category, new RateLimiter(config || defaultConfig));
    }

    return this.limiters.get(category)!;
  }

  /**
   * Throttle a request for a specific category
   */
  async throttle(category: string): Promise<void> {
    const limiter = this.getLimiter(category);
    await limiter.throttle();
  }

  /**
   * Get stats for all limiters
   */
  getAllStats(): Record<string, any> {
    const stats: Record<string, any> = {};

    this.limiters.forEach((limiter, category) => {
      stats[category] = limiter.getStats();
    });

    return stats;
  }

  /**
   * Reset all limiters
   */
  resetAll(): void {
    this.limiters.forEach((limiter) => limiter.reset());
  }
}

/**
 * Singleton instance of rate limiter manager
 */
export const rateLimiterManager = new RateLimiterManager();

/**
 * Create a rate limiter with configuration
 */
export function createRateLimiter(config?: Partial<RateLimitConfig>): RateLimiter {
  const defaultConfig: RateLimitConfig = {
    maxRequests: 100,
    windowMs: 60000,
    strategy: 'sliding',
  };

  return new RateLimiter({ ...defaultConfig, ...config });
}

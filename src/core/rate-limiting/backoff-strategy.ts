/**
 * Backoff Strategy
 *
 * Exponential backoff with jitter for retry logic.
 * Supports various backoff algorithms and custom strategies.
 */

/**
 * Backoff strategy type
 */
export type BackoffType =
  | 'exponential'      // Standard exponential backoff
  | 'linear'           // Linear increase
  | 'constant'         // Fixed delay
  | 'fibonacci'        // Fibonacci sequence
  | 'decorrelated';    // Decorrelated jitter (AWS style)

/**
 * Backoff configuration
 */
export interface BackoffConfig {
  /** Initial delay in milliseconds */
  baseDelayMs: number;
  /** Maximum delay in milliseconds */
  maxDelayMs: number;
  /** Maximum number of retries */
  maxRetries: number;
  /** Backoff strategy type */
  type?: BackoffType;
  /** Jitter factor (0-1, portion of delay to randomize) */
  jitterFactor?: number;
  /** Multiplier for exponential backoff */
  multiplier?: number;
}

/**
 * Retry context passed to callbacks
 */
export interface RetryContext {
  attempt: number;
  totalAttempts: number;
  lastError?: Error;
  elapsedMs: number;
  nextDelayMs: number;
}

/**
 * Retry options for execute function
 */
export interface RetryOptions<T> {
  /** Function to determine if error is retryable */
  isRetryable?: (error: Error) => boolean;
  /** Callback before each retry */
  onRetry?: (context: RetryContext) => void | Promise<void>;
  /** Callback on final failure */
  onFailure?: (context: RetryContext) => void | Promise<void>;
  /** Override delay for specific error types */
  delayOverride?: (error: Error, baseDelay: number) => number;
}

/**
 * Backoff Strategy class
 */
export class BackoffStrategy {
  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly maxRetries: number;
  private readonly type: BackoffType;
  private readonly jitterFactor: number;
  private readonly multiplier: number;

  // Fibonacci sequence cache
  private fibCache: number[] = [0, 1];

  constructor(config: BackoffConfig) {
    this.baseDelayMs = config.baseDelayMs;
    this.maxDelayMs = config.maxDelayMs;
    this.maxRetries = config.maxRetries;
    this.type = config.type ?? 'exponential';
    this.jitterFactor = config.jitterFactor ?? 0.25;
    this.multiplier = config.multiplier ?? 2;
  }

  /**
   * Calculate delay for a given attempt
   */
  getDelay(attempt: number): number {
    if (attempt < 1) {
      return 0;
    }

    let baseDelay: number;

    switch (this.type) {
      case 'exponential':
        baseDelay = this.baseDelayMs * Math.pow(this.multiplier, attempt - 1);
        break;

      case 'linear':
        baseDelay = this.baseDelayMs * attempt;
        break;

      case 'constant':
        baseDelay = this.baseDelayMs;
        break;

      case 'fibonacci':
        baseDelay = this.baseDelayMs * this.getFibonacci(attempt);
        break;

      case 'decorrelated':
        // Decorrelated jitter: delay = random(baseDelay, lastDelay * 3)
        const prevDelay = attempt > 1 ? this.getDelay(attempt - 1) : this.baseDelayMs;
        baseDelay = this.baseDelayMs + Math.random() * (prevDelay * 3 - this.baseDelayMs);
        break;

      default:
        baseDelay = this.baseDelayMs * Math.pow(this.multiplier, attempt - 1);
    }

    // Apply max delay cap
    baseDelay = Math.min(baseDelay, this.maxDelayMs);

    // Apply jitter
    const jitter = baseDelay * this.jitterFactor * (Math.random() * 2 - 1);
    const finalDelay = Math.max(0, baseDelay + jitter);

    return Math.round(finalDelay);
  }

  /**
   * Get Fibonacci number
   */
  private getFibonacci(n: number): number {
    if (n < 0) return 0;
    if (n < this.fibCache.length) return this.fibCache[n];

    for (let i = this.fibCache.length; i <= n; i++) {
      this.fibCache[i] = this.fibCache[i - 1] + this.fibCache[i - 2];
    }

    return this.fibCache[n];
  }

  /**
   * Check if should retry
   */
  shouldRetry(attempt: number): boolean {
    return attempt < this.maxRetries;
  }

  /**
   * Get all delays for visualization/planning
   */
  getAllDelays(): number[] {
    return Array.from({ length: this.maxRetries }, (_, i) => this.getDelay(i + 1));
  }

  /**
   * Get total potential wait time
   */
  getTotalPotentialDelay(): number {
    return this.getAllDelays().reduce((sum, delay) => sum + delay, 0);
  }

  /**
   * Sleep for the calculated delay
   */
  async sleep(attempt: number): Promise<number> {
    const delay = this.getDelay(attempt);
    await new Promise((resolve) => setTimeout(resolve, delay));
    return delay;
  }

  /**
   * Execute a function with retry logic
   */
  async execute<T>(
    fn: () => Promise<T>,
    options: RetryOptions<T> = {}
  ): Promise<T> {
    const startTime = Date.now();
    let lastError: Error | undefined;

    const isRetryable = options.isRetryable ?? (() => true);

    for (let attempt = 1; attempt <= this.maxRetries + 1; attempt++) {
      try {
        const result = await fn();
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if we should retry
        if (attempt > this.maxRetries || !isRetryable(lastError)) {
          const context: RetryContext = {
            attempt,
            totalAttempts: attempt,
            lastError,
            elapsedMs: Date.now() - startTime,
            nextDelayMs: 0,
          };

          if (options.onFailure) {
            await options.onFailure(context);
          }

          throw lastError;
        }

        // Calculate delay
        let delay = this.getDelay(attempt);
        if (options.delayOverride) {
          delay = options.delayOverride(lastError, delay);
        }

        const context: RetryContext = {
          attempt,
          totalAttempts: this.maxRetries + 1,
          lastError,
          elapsedMs: Date.now() - startTime,
          nextDelayMs: delay,
        };

        // Notify before retry
        if (options.onRetry) {
          await options.onRetry(context);
        }

        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    // Should never reach here, but TypeScript needs it
    throw lastError ?? new Error('Retry failed');
  }

  /**
   * Create iterator for manual retry control
   */
  *retryIterator(): Generator<{ attempt: number; delay: number; shouldRetry: boolean }> {
    for (let attempt = 1; attempt <= this.maxRetries + 1; attempt++) {
      yield {
        attempt,
        delay: this.getDelay(attempt),
        shouldRetry: attempt <= this.maxRetries,
      };
    }
  }

  /**
   * Get configuration
   */
  getConfig(): BackoffConfig {
    return {
      baseDelayMs: this.baseDelayMs,
      maxDelayMs: this.maxDelayMs,
      maxRetries: this.maxRetries,
      type: this.type,
      jitterFactor: this.jitterFactor,
      multiplier: this.multiplier,
    };
  }
}

/**
 * Create common backoff presets
 */
export const BackoffPresets = {
  /** Fast retry for transient errors */
  fast: () => new BackoffStrategy({
    baseDelayMs: 100,
    maxDelayMs: 2000,
    maxRetries: 3,
    type: 'exponential',
  }),

  /** Standard retry pattern */
  standard: () => new BackoffStrategy({
    baseDelayMs: 1000,
    maxDelayMs: 30000,
    maxRetries: 5,
    type: 'exponential',
  }),

  /** Aggressive retry for critical operations */
  aggressive: () => new BackoffStrategy({
    baseDelayMs: 500,
    maxDelayMs: 60000,
    maxRetries: 10,
    type: 'exponential',
    multiplier: 1.5,
  }),

  /** Rate limit specific backoff */
  rateLimit: () => new BackoffStrategy({
    baseDelayMs: 5000,
    maxDelayMs: 120000,
    maxRetries: 5,
    type: 'exponential',
    multiplier: 2,
    jitterFactor: 0.1,
  }),

  /** Linear backoff for predictable delays */
  linear: () => new BackoffStrategy({
    baseDelayMs: 1000,
    maxDelayMs: 10000,
    maxRetries: 5,
    type: 'linear',
  }),
};

export default BackoffStrategy;

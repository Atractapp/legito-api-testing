import { APIResponse } from '@playwright/test';
import { logger } from '@utils/logger';

interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  retryableStatusCodes: number[];
  exponentialBackoff: boolean;
}

interface RetryContext {
  attempt: number;
  lastError?: Error;
  lastResponse?: APIResponse;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
  exponentialBackoff: true,
};

/**
 * Smart retry handler with exponential backoff and configurable strategies
 */
export class RetryHandler {
  private config: RetryConfig;

  constructor(config?: Partial<RetryConfig>) {
    this.config = { ...DEFAULT_RETRY_CONFIG, ...config };
  }

  /**
   * Execute a function with retry logic
   */
  async execute<T>(
    fn: () => Promise<T>,
    options?: {
      operationName?: string;
      isIdempotent?: boolean;
      shouldRetry?: (error: any, response?: APIResponse) => boolean;
    }
  ): Promise<T> {
    const context: RetryContext = { attempt: 0 };
    const operationName = options?.operationName || 'API request';
    const isIdempotent = options?.isIdempotent ?? true;

    while (context.attempt <= this.config.maxRetries) {
      try {
        logger.debug(`Executing ${operationName}`, { attempt: context.attempt + 1 });
        const result = await fn();

        if (context.attempt > 0) {
          logger.info(`${operationName} succeeded after ${context.attempt} retries`);
        }

        return result;
      } catch (error) {
        context.lastError = error as Error;
        context.attempt++;

        const shouldRetry = await this.shouldRetryRequest(
          error,
          context,
          isIdempotent,
          options?.shouldRetry
        );

        if (!shouldRetry || context.attempt > this.config.maxRetries) {
          logger.error(`${operationName} failed after ${context.attempt} attempts`, {
            error: context.lastError,
          });
          throw error;
        }

        const delay = this.calculateDelay(context.attempt);
        logger.warn(`${operationName} failed, retrying in ${delay}ms`, {
          attempt: context.attempt,
          maxRetries: this.config.maxRetries,
          error: error instanceof Error ? error.message : String(error),
        });

        await this.sleep(delay);
      }
    }

    throw context.lastError || new Error('Retry limit exceeded');
  }

  /**
   * Execute an API request with retry logic
   */
  async executeRequest<T extends APIResponse>(
    requestFn: () => Promise<T>,
    options?: {
      operationName?: string;
      isIdempotent?: boolean;
    }
  ): Promise<T> {
    const context: RetryContext = { attempt: 0 };
    const operationName = options?.operationName || 'API request';
    const isIdempotent = options?.isIdempotent ?? true;

    while (context.attempt <= this.config.maxRetries) {
      try {
        const response = await requestFn();
        context.lastResponse = response;

        // Check if response indicates a retryable error
        if (this.isRetryableResponse(response)) {
          throw new Error(`Retryable status code: ${response.status()}`);
        }

        if (context.attempt > 0) {
          logger.info(`${operationName} succeeded after ${context.attempt} retries`);
        }

        return response;
      } catch (error) {
        context.lastError = error as Error;
        context.attempt++;

        const shouldRetry = await this.shouldRetryRequest(
          error,
          context,
          isIdempotent
        );

        if (!shouldRetry || context.attempt > this.config.maxRetries) {
          logger.error(`${operationName} failed after ${context.attempt} attempts`, {
            error: context.lastError,
            statusCode: context.lastResponse?.status(),
          });
          throw error;
        }

        // Check for rate limiting
        const rateLimitDelay = await this.getRateLimitDelay(context.lastResponse);
        const delay = rateLimitDelay || this.calculateDelay(context.attempt);

        logger.warn(`${operationName} failed, retrying in ${delay}ms`, {
          attempt: context.attempt,
          maxRetries: this.config.maxRetries,
          statusCode: context.lastResponse?.status(),
          rateLimited: !!rateLimitDelay,
        });

        await this.sleep(delay);
      }
    }

    throw context.lastError || new Error('Retry limit exceeded');
  }

  /**
   * Determine if request should be retried
   */
  private async shouldRetryRequest(
    error: any,
    context: RetryContext,
    isIdempotent: boolean,
    customCheck?: (error: any, response?: APIResponse) => boolean
  ): Promise<boolean> {
    // Don't retry non-idempotent operations by default
    if (!isIdempotent && context.attempt > 0) {
      return false;
    }

    // Use custom retry logic if provided
    if (customCheck) {
      return customCheck(error, context.lastResponse);
    }

    // Check if response has retryable status code
    if (context.lastResponse) {
      return this.isRetryableResponse(context.lastResponse);
    }

    // Retry on network errors
    if (this.isNetworkError(error)) {
      return true;
    }

    return false;
  }

  /**
   * Check if response should trigger a retry
   */
  private isRetryableResponse(response: APIResponse): boolean {
    const status = response.status();
    return this.config.retryableStatusCodes.includes(status);
  }

  /**
   * Check if error is a network error
   */
  private isNetworkError(error: any): boolean {
    const networkErrors = [
      'ECONNRESET',
      'ENOTFOUND',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ECONNABORTED',
    ];

    const errorMessage = error.message || String(error);
    return networkErrors.some((code) => errorMessage.includes(code));
  }

  /**
   * Get delay from rate limit headers
   */
  private async getRateLimitDelay(response?: APIResponse): Promise<number | null> {
    if (!response) return null;

    const status = response.status();
    if (status !== 429) return null;

    // Check for Retry-After header
    const headers = response.headers();
    const retryAfter = headers['retry-after'] || headers['x-ratelimit-reset'];

    if (retryAfter) {
      // If it's a timestamp
      if (/^\d+$/.test(retryAfter) && retryAfter.length > 5) {
        const resetTime = parseInt(retryAfter, 10) * 1000;
        return Math.max(resetTime - Date.now(), 0);
      }
      // If it's seconds
      return parseInt(retryAfter, 10) * 1000;
    }

    // Default delay for rate limiting
    return 5000;
  }

  /**
   * Calculate delay with exponential backoff
   */
  private calculateDelay(attempt: number): number {
    if (!this.config.exponentialBackoff) {
      return this.config.baseDelay;
    }

    const exponentialDelay = this.config.baseDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 1000; // Add jitter to prevent thundering herd
    const delay = Math.min(exponentialDelay + jitter, this.config.maxDelay);

    return Math.floor(delay);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Update retry configuration
   */
  updateConfig(config: Partial<RetryConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

/**
 * Create a retry handler with default or custom configuration
 */
export function createRetryHandler(config?: Partial<RetryConfig>): RetryHandler {
  return new RetryHandler(config);
}

/**
 * Decorator for retryable functions
 */
export function retryable(config?: Partial<RetryConfig>) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const retryHandler = new RetryHandler(config);

    descriptor.value = async function (...args: any[]) {
      return retryHandler.execute(
        () => originalMethod.apply(this, args),
        { operationName: propertyKey }
      );
    };

    return descriptor;
  };
}

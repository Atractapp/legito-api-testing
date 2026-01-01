/**
 * API Client
 *
 * Core HTTP client for Legito API v7 with built-in authentication,
 * rate limiting, retry logic, and observability.
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { createAuthStack, AuthStack, AuthStackConfig } from '../auth';
import { RateLimiter, RateLimiterConfig, GlobalRateLimiter } from '../rate-limiting/rate-limiter';
import { BackoffStrategy, BackoffPresets } from '../rate-limiting/backoff-strategy';

/**
 * API client configuration
 */
export interface ApiClientConfig {
  /** Base URL for the Legito API */
  baseUrl: string;
  /** API version (default: v7) */
  apiVersion?: string;
  /** Authentication configuration */
  auth: AuthStackConfig;
  /** Rate limiting configuration */
  rateLimit?: RateLimiterConfig;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Enable request/response logging */
  logging?: boolean;
  /** Custom headers to include in all requests */
  defaultHeaders?: Record<string, string>;
  /** Use global rate limiter (for parallel tests) */
  useGlobalRateLimiter?: boolean;
}

/**
 * Request options
 */
export interface RequestOptions extends Omit<AxiosRequestConfig, 'url' | 'method'> {
  /** Skip rate limiting for this request */
  skipRateLimit?: boolean;
  /** Skip authentication for this request */
  skipAuth?: boolean;
  /** Custom retry configuration */
  retry?: {
    enabled?: boolean;
    maxRetries?: number;
  };
}

/**
 * API response wrapper
 */
export interface ApiResponse<T> {
  data: T;
  status: number;
  headers: Record<string, string>;
  duration: number;
  requestId?: string;
}

/**
 * Request log entry
 */
export interface RequestLog {
  method: string;
  url: string;
  status: number;
  duration: number;
  timestamp: Date;
  requestId?: string;
  error?: string;
}

/**
 * API Client class
 */
export class ApiClient {
  private readonly axios: AxiosInstance;
  private readonly authStack: AuthStack;
  private readonly rateLimiter: RateLimiter;
  private readonly backoffStrategy: BackoffStrategy;
  private readonly logging: boolean;

  private requestLogs: RequestLog[] = [];
  private readonly maxLogEntries = 1000;

  constructor(config: ApiClientConfig) {
    const apiVersion = config.apiVersion ?? 'v7';
    const baseURL = `${config.baseUrl}/api/${apiVersion}`;

    // Create Axios instance
    this.axios = axios.create({
      baseURL,
      timeout: config.timeout ?? 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...config.defaultHeaders,
      },
    });

    // Setup authentication
    this.authStack = createAuthStack(this.axios, config.auth);

    // Setup rate limiting
    const rateLimitConfig: RateLimiterConfig = config.rateLimit ?? {
      requestsPerMinute: 60,
      burstSize: 10,
      adaptive: true,
    };

    if (config.useGlobalRateLimiter) {
      this.rateLimiter = GlobalRateLimiter.initialize(rateLimitConfig);
    } else {
      this.rateLimiter = new RateLimiter(rateLimitConfig);
    }

    // Setup backoff strategy
    this.backoffStrategy = BackoffPresets.standard();

    this.logging = config.logging ?? false;

    // Setup interceptors
    this.setupInterceptors();
  }

  /**
   * Setup request/response interceptors
   */
  private setupInterceptors(): void {
    // Request timing interceptor
    this.axios.interceptors.request.use((config) => {
      (config as any).__startTime = Date.now();
      return config;
    });

    // Response logging interceptor
    this.axios.interceptors.response.use(
      (response) => {
        this.logRequest(response);
        return response;
      },
      (error: AxiosError) => {
        this.logRequest(error.response, error);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Log a request
   */
  private logRequest(response?: AxiosResponse, error?: AxiosError): void {
    if (!this.logging) return;

    const config = response?.config ?? error?.config;
    if (!config) return;

    const startTime = (config as any).__startTime ?? Date.now();
    const duration = Date.now() - startTime;

    const logEntry: RequestLog = {
      method: config.method?.toUpperCase() ?? 'UNKNOWN',
      url: config.url ?? '',
      status: response?.status ?? error?.response?.status ?? 0,
      duration,
      timestamp: new Date(),
      requestId: response?.headers?.['x-request-id'],
      error: error?.message,
    };

    this.requestLogs.push(logEntry);

    // Trim logs if too many
    if (this.requestLogs.length > this.maxLogEntries) {
      this.requestLogs = this.requestLogs.slice(-this.maxLogEntries);
    }
  }

  /**
   * Execute request with rate limiting and retry
   */
  private async executeRequest<T>(
    method: string,
    url: string,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    // Rate limiting
    if (!options.skipRateLimit) {
      await this.rateLimiter.acquire();
    }

    const startTime = Date.now();

    const executeOnce = async (): Promise<AxiosResponse<T>> => {
      const config: AxiosRequestConfig = {
        method,
        url,
        ...options,
      };

      if (options.skipAuth) {
        (config as any).__skipAuth = true;
      }

      return this.axios.request<T>(config);
    };

    const shouldRetry = options.retry?.enabled !== false;
    const maxRetries = options.retry?.maxRetries ?? 3;

    let response: AxiosResponse<T>;

    if (shouldRetry) {
      response = await this.backoffStrategy.execute(executeOnce, {
        maxRetries,
        isRetryable: (error) => this.isRetryableError(error),
        onRetry: (context) => {
          if (this.logging) {
            console.log(
              `Retry attempt ${context.attempt}/${context.totalAttempts} ` +
              `for ${method} ${url} after ${context.nextDelayMs}ms`
            );
          }
        },
        delayOverride: (error, baseDelay) => {
          // Use Retry-After header if present
          const retryAfter = this.getRetryAfterMs(error);
          if (retryAfter) {
            return retryAfter;
          }

          // Rate limit hit - report and use extended delay
          if (this.isRateLimitError(error)) {
            this.rateLimiter.reportRateLimitHit(baseDelay * 2);
            return baseDelay * 2;
          }

          return baseDelay;
        },
      } as any);
    } else {
      response = await executeOnce();
    }

    // Report success for adaptive rate limiting
    this.rateLimiter.reportSuccess();

    return {
      data: response.data,
      status: response.status,
      headers: response.headers as Record<string, string>,
      duration: Date.now() - startTime,
      requestId: response.headers['x-request-id'],
    };
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: Error): boolean {
    if (!(error instanceof AxiosError)) {
      return false;
    }

    // Network errors
    if (!error.response) {
      return true;
    }

    const status = error.response.status;

    // Retry on rate limit, server errors, and specific client errors
    return (
      status === 429 ||  // Rate limit
      status === 408 ||  // Request timeout
      status === 502 ||  // Bad gateway
      status === 503 ||  // Service unavailable
      status === 504     // Gateway timeout
    );
  }

  /**
   * Check if error is rate limit
   */
  private isRateLimitError(error: Error): boolean {
    return error instanceof AxiosError && error.response?.status === 429;
  }

  /**
   * Get Retry-After header value in milliseconds
   */
  private getRetryAfterMs(error: Error): number | null {
    if (!(error instanceof AxiosError) || !error.response?.headers) {
      return null;
    }

    const retryAfter = error.response.headers['retry-after'];
    if (!retryAfter) {
      return null;
    }

    // Try parsing as seconds (most common)
    const seconds = parseInt(retryAfter, 10);
    if (!isNaN(seconds)) {
      return seconds * 1000;
    }

    // Try parsing as HTTP date
    const date = new Date(retryAfter);
    if (!isNaN(date.getTime())) {
      return Math.max(0, date.getTime() - Date.now());
    }

    return null;
  }

  // HTTP method shortcuts

  async get<T>(url: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.executeRequest<T>('GET', url, options);
  }

  async post<T>(url: string, data?: unknown, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.executeRequest<T>('POST', url, { ...options, data });
  }

  async put<T>(url: string, data?: unknown, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.executeRequest<T>('PUT', url, { ...options, data });
  }

  async patch<T>(url: string, data?: unknown, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.executeRequest<T>('PATCH', url, { ...options, data });
  }

  async delete<T>(url: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.executeRequest<T>('DELETE', url, options);
  }

  // Utility methods

  /**
   * Get request logs
   */
  getRequestLogs(): RequestLog[] {
    return [...this.requestLogs];
  }

  /**
   * Clear request logs
   */
  clearRequestLogs(): void {
    this.requestLogs = [];
  }

  /**
   * Get rate limiter status
   */
  getRateLimitStatus() {
    return this.rateLimiter.getStatus();
  }

  /**
   * Get the underlying Axios instance (for advanced usage)
   */
  getAxiosInstance(): AxiosInstance {
    return this.axios;
  }

  /**
   * Get auth stack (for token management)
   */
  getAuthStack(): AuthStack {
    return this.authStack;
  }
}

/**
 * Create API client with common defaults
 */
export function createApiClient(config: ApiClientConfig): ApiClient {
  return new ApiClient(config);
}

export default ApiClient;

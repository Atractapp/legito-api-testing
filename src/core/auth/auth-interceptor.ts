/**
 * Authentication Interceptor
 *
 * Axios interceptor for automatic JWT token injection into requests.
 * Handles token refresh, retry on 401, and authentication error management.
 */

import { AxiosInstance, AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { TokenCache } from './token-cache';

export interface AuthInterceptorConfig {
  tokenCache: TokenCache;
  contextId?: string;
  maxRetries?: number;
  onAuthError?: (error: AxiosError) => void;
}

// Extend AxiosRequestConfig to track retry attempts
interface ExtendedRequestConfig extends InternalAxiosRequestConfig {
  __authRetryCount?: number;
  __skipAuth?: boolean;
}

/**
 * Authentication Interceptor class
 */
export class AuthInterceptor {
  private readonly tokenCache: TokenCache;
  private readonly contextId: string;
  private readonly maxRetries: number;
  private readonly onAuthError?: (error: AxiosError) => void;

  constructor(config: AuthInterceptorConfig) {
    this.tokenCache = config.tokenCache;
    this.contextId = config.contextId ?? '__default__';
    this.maxRetries = config.maxRetries ?? 1;
    this.onAuthError = config.onAuthError;
  }

  /**
   * Apply interceptors to an Axios instance
   */
  apply(axiosInstance: AxiosInstance): void {
    // Request interceptor - add token
    axiosInstance.interceptors.request.use(
      async (config: ExtendedRequestConfig) => {
        // Skip auth if explicitly disabled
        if (config.__skipAuth) {
          return config;
        }

        try {
          const token = await this.tokenCache.getToken(this.contextId);
          config.headers = config.headers || {};
          config.headers['Authorization'] = `Bearer ${token}`;
        } catch (error) {
          console.error('[AuthInterceptor] Failed to get token:', error);
          throw error;
        }

        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor - handle 401
    axiosInstance.interceptors.response.use(
      (response: AxiosResponse) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as ExtendedRequestConfig | undefined;

        // Check if this is a 401 error and we can retry
        if (
          error.response?.status === 401 &&
          originalRequest &&
          !originalRequest.__skipAuth &&
          (originalRequest.__authRetryCount ?? 0) < this.maxRetries
        ) {
          originalRequest.__authRetryCount = (originalRequest.__authRetryCount ?? 0) + 1;

          try {
            // Invalidate current token and refresh
            this.tokenCache.invalidate(this.contextId);
            const newToken = await this.tokenCache.refresh(this.contextId);

            // Update the request with new token
            originalRequest.headers['Authorization'] = `Bearer ${newToken}`;

            // Retry the request
            const axiosInstance = error.config ? (error as any)?.request?.axiosInstance : null;
            if (axiosInstance) {
              return axiosInstance.request(originalRequest);
            }

            // Fallback: throw to let caller handle retry
            throw error;
          } catch (refreshError) {
            // Token refresh failed
            if (this.onAuthError) {
              this.onAuthError(error);
            }
            throw error;
          }
        }

        // Not a retryable auth error
        if (error.response?.status === 401 && this.onAuthError) {
          this.onAuthError(error);
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * Create a request config that skips authentication
   */
  static skipAuth<T extends object>(config: T): T & { __skipAuth: boolean } {
    return { ...config, __skipAuth: true };
  }

  /**
   * Get the current context ID
   */
  getContextId(): string {
    return this.contextId;
  }

  /**
   * Change the context ID (for multi-tenant scenarios)
   */
  setContextId(contextId: string): AuthInterceptor {
    return new AuthInterceptor({
      tokenCache: this.tokenCache,
      contextId,
      maxRetries: this.maxRetries,
      onAuthError: this.onAuthError,
    });
  }
}

/**
 * Factory function to create and apply auth interceptor
 */
export function createAuthInterceptor(
  axiosInstance: AxiosInstance,
  config: AuthInterceptorConfig
): AuthInterceptor {
  const interceptor = new AuthInterceptor(config);
  interceptor.apply(axiosInstance);
  return interceptor;
}

export default AuthInterceptor;

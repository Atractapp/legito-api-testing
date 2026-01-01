/**
 * Authentication Module Exports
 *
 * Centralized exports for all authentication-related components.
 */

export { JWTManager, type JWTManagerConfig, type JWTPayload, type TokenInfo } from './jwt-manager';
export { TokenCache, type TokenCacheConfig, type CacheStats } from './token-cache';
export {
  AuthInterceptor,
  createAuthInterceptor,
  type AuthInterceptorConfig,
} from './auth-interceptor';

/**
 * Factory function to create a complete authentication stack
 */
import { JWTManager, JWTManagerConfig } from './jwt-manager';
import { TokenCache } from './token-cache';
import { AuthInterceptor } from './auth-interceptor';
import { AxiosInstance } from 'axios';

export interface AuthStackConfig extends JWTManagerConfig {
  preRefreshBufferMs?: number;
  maxCacheSize?: number;
  contextId?: string;
  maxRetries?: number;
  onAuthError?: (error: any) => void;
}

export interface AuthStack {
  jwtManager: JWTManager;
  tokenCache: TokenCache;
  authInterceptor: AuthInterceptor;
}

/**
 * Create a complete authentication stack and apply to an Axios instance
 */
export function createAuthStack(
  axiosInstance: AxiosInstance,
  config: AuthStackConfig
): AuthStack {
  const jwtManager = new JWTManager({
    apiKey: config.apiKey,
    apiSecret: config.apiSecret,
    tokenTTLSeconds: config.tokenTTLSeconds,
    refreshThresholdSeconds: config.refreshThresholdSeconds,
  });

  const tokenCache = new TokenCache({
    jwtManager,
    preRefreshBufferMs: config.preRefreshBufferMs,
    maxCacheSize: config.maxCacheSize,
  });

  const authInterceptor = new AuthInterceptor({
    tokenCache,
    contextId: config.contextId,
    maxRetries: config.maxRetries,
    onAuthError: config.onAuthError,
  });

  authInterceptor.apply(axiosInstance);

  return {
    jwtManager,
    tokenCache,
    authInterceptor,
  };
}

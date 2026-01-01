/**
 * Token Cache for JWT Token Management
 *
 * Provides caching layer for JWT tokens with automatic refresh
 * and TTL-based invalidation to minimize token generation overhead.
 */

import { JWTManager, TokenInfo } from './jwt-manager';

export interface TokenCacheConfig {
  jwtManager: JWTManager;
  preRefreshBufferMs?: number;  // Time before expiry to trigger refresh
  maxCacheSize?: number;        // Max number of tokens to cache (for multi-tenant)
}

interface CachedToken {
  token: string;
  expiresAt: number;  // Unix timestamp in ms
  createdAt: number;  // Unix timestamp in ms
  useCount: number;
  lastUsedAt: number;
}

/**
 * Token Cache class with automatic refresh and TTL management
 */
export class TokenCache {
  private readonly jwtManager: JWTManager;
  private readonly preRefreshBufferMs: number;
  private readonly maxCacheSize: number;

  // Cache storage - keyed by context ID for multi-tenant scenarios
  private cache: Map<string, CachedToken> = new Map();

  // Default context for single-tenant usage
  private static readonly DEFAULT_CONTEXT = '__default__';

  // Refresh lock to prevent concurrent refresh operations
  private refreshLocks: Map<string, Promise<string>> = new Map();

  constructor(config: TokenCacheConfig) {
    this.jwtManager = config.jwtManager;
    this.preRefreshBufferMs = config.preRefreshBufferMs ?? 60000; // 1 minute default
    this.maxCacheSize = config.maxCacheSize ?? 100;
  }

  /**
   * Get a valid token, refreshing if necessary
   */
  async getToken(contextId: string = TokenCache.DEFAULT_CONTEXT): Promise<string> {
    const cached = this.cache.get(contextId);

    if (cached && !this.shouldRefresh(cached)) {
      // Update usage statistics
      cached.useCount++;
      cached.lastUsedAt = Date.now();
      return cached.token;
    }

    // Check if refresh is already in progress for this context
    const existingRefresh = this.refreshLocks.get(contextId);
    if (existingRefresh) {
      return existingRefresh;
    }

    // Perform refresh
    const refreshPromise = this.refresh(contextId);
    this.refreshLocks.set(contextId, refreshPromise);

    try {
      return await refreshPromise;
    } finally {
      this.refreshLocks.delete(contextId);
    }
  }

  /**
   * Force refresh of token for a context
   */
  async refresh(contextId: string = TokenCache.DEFAULT_CONTEXT): Promise<string> {
    // Enforce max cache size
    if (this.cache.size >= this.maxCacheSize && !this.cache.has(contextId)) {
      this.evictLeastRecentlyUsed();
    }

    const token = this.jwtManager.generateToken();
    const info = this.jwtManager.getTokenInfo(token);

    if (!info) {
      throw new Error('Failed to get token info after generation');
    }

    const now = Date.now();
    const cachedToken: CachedToken = {
      token,
      expiresAt: info.expiresAt.getTime(),
      createdAt: now,
      useCount: 1,
      lastUsedAt: now,
    };

    this.cache.set(contextId, cachedToken);
    return token;
  }

  /**
   * Check if a cached token should be refreshed
   */
  private shouldRefresh(cached: CachedToken): boolean {
    const now = Date.now();
    const timeUntilExpiry = cached.expiresAt - now;
    return timeUntilExpiry <= this.preRefreshBufferMs;
  }

  /**
   * Evict the least recently used token
   */
  private evictLeastRecentlyUsed(): void {
    let lruKey: string | null = null;
    let lruTime = Infinity;

    for (const [key, cached] of this.cache.entries()) {
      if (cached.lastUsedAt < lruTime) {
        lruTime = cached.lastUsedAt;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
    }
  }

  /**
   * Invalidate a specific context's token
   */
  invalidate(contextId: string = TokenCache.DEFAULT_CONTEXT): void {
    this.cache.delete(contextId);
  }

  /**
   * Clear all cached tokens
   */
  clear(): void {
    this.cache.clear();
    this.refreshLocks.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const now = Date.now();
    let totalUseCount = 0;
    let expiredCount = 0;
    let nearExpiryCount = 0;

    for (const cached of this.cache.values()) {
      totalUseCount += cached.useCount;
      if (cached.expiresAt <= now) {
        expiredCount++;
      } else if (cached.expiresAt - now <= this.preRefreshBufferMs) {
        nearExpiryCount++;
      }
    }

    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      totalUseCount,
      expiredCount,
      nearExpiryCount,
      preRefreshBufferMs: this.preRefreshBufferMs,
    };
  }

  /**
   * Get token info for a context (without refreshing)
   */
  getTokenInfo(contextId: string = TokenCache.DEFAULT_CONTEXT): TokenInfo | null {
    const cached = this.cache.get(contextId);
    if (!cached) {
      return null;
    }
    return this.jwtManager.getTokenInfo(cached.token);
  }

  /**
   * Check if a context has a valid cached token
   */
  hasValidToken(contextId: string = TokenCache.DEFAULT_CONTEXT): boolean {
    const cached = this.cache.get(contextId);
    if (!cached) {
      return false;
    }
    return cached.expiresAt > Date.now();
  }

  /**
   * Get time until token expires (in ms)
   */
  getTimeUntilExpiry(contextId: string = TokenCache.DEFAULT_CONTEXT): number | null {
    const cached = this.cache.get(contextId);
    if (!cached) {
      return null;
    }
    return Math.max(0, cached.expiresAt - Date.now());
  }

  /**
   * Cleanup expired tokens
   */
  cleanup(): number {
    const now = Date.now();
    let removedCount = 0;

    for (const [key, cached] of this.cache.entries()) {
      if (cached.expiresAt <= now) {
        this.cache.delete(key);
        removedCount++;
      }
    }

    return removedCount;
  }

  /**
   * Start automatic cleanup interval
   */
  startAutoCleanup(intervalMs: number = 60000): NodeJS.Timeout {
    return setInterval(() => {
      this.cleanup();
    }, intervalMs);
  }
}

export interface CacheStats {
  size: number;
  maxSize: number;
  totalUseCount: number;
  expiredCount: number;
  nearExpiryCount: number;
  preRefreshBufferMs: number;
}

export default TokenCache;

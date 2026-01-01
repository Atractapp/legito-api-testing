/**
 * Rate Limit Configuration
 *
 * Environment-specific rate limiting settings.
 */

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /** Requests per minute */
  requestsPerMinute: number;
  /** Maximum burst size */
  burstSize: number;
  /** Enable adaptive rate limiting */
  adaptive: boolean;
  /** Minimum rate when adapting */
  minRate: number;
  /** Recovery factor (0-1) */
  recoveryFactor: number;
  /** Per-endpoint overrides */
  overrides: Record<string, number>;
}

/**
 * Rate limit configurations by environment
 */
export const rateLimits: Record<string, RateLimitConfig> = {
  default: {
    requestsPerMinute: 60,
    burstSize: 10,
    adaptive: true,
    minRate: 10,
    recoveryFactor: 0.1,
    overrides: {
      download: 30,
      upload: 20,
    },
  },

  development: {
    requestsPerMinute: 120,
    burstSize: 20,
    adaptive: true,
    minRate: 20,
    recoveryFactor: 0.2,
    overrides: {
      download: 60,
      upload: 40,
    },
  },

  staging: {
    requestsPerMinute: 60,
    burstSize: 15,
    adaptive: true,
    minRate: 15,
    recoveryFactor: 0.15,
    overrides: {
      download: 30,
      upload: 20,
    },
  },

  production: {
    requestsPerMinute: 30,
    burstSize: 5,
    adaptive: true,
    minRate: 5,
    recoveryFactor: 0.05,
    overrides: {
      download: 15,
      upload: 10,
    },
  },

  ci: {
    requestsPerMinute: 60,
    burstSize: 15,
    adaptive: true,
    minRate: 10,
    recoveryFactor: 0.1,
    overrides: {
      download: 30,
      upload: 20,
    },
  },
};

/**
 * Get rate limit for specific environment
 */
export function getRateLimit(environment: string): RateLimitConfig {
  return rateLimits[environment] ?? rateLimits.default;
}

/**
 * Get rate limit for specific operation type
 */
export function getOperationRateLimit(
  environment: string,
  operationType: string
): number {
  const config = getRateLimit(environment);
  return config.overrides[operationType] ?? config.requestsPerMinute;
}

export default rateLimits;

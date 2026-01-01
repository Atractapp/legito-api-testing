/**
 * Configuration Aggregator
 *
 * Centralizes all configuration for the test framework.
 */

import { environments, Environment, getEnvironment } from './environments';
import { endpoints, EndpointConfig } from './endpoints';
import { rateLimits, RateLimitConfig } from './rate-limits';
import { testSuites, TestSuiteConfig } from './test-suites';

/**
 * Full configuration object
 */
export interface TestConfig {
  environment: Environment;
  endpoints: typeof endpoints;
  rateLimits: RateLimitConfig;
  testSuites: typeof testSuites;
  supabase: {
    url: string;
    anonKey: string;
    serviceRoleKey?: string;
  };
}

/**
 * Load configuration for specified environment
 */
export function loadConfig(envName?: string): TestConfig {
  const environment = getEnvironment(envName);
  const rateLimitConfig = rateLimits[environment.name as keyof typeof rateLimits] ?? rateLimits.default;

  return {
    environment,
    endpoints,
    rateLimits: rateLimitConfig,
    testSuites,
    supabase: {
      url: process.env.SUPABASE_URL ?? '',
      anonKey: process.env.SUPABASE_ANON_KEY ?? '',
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
  };
}

/**
 * Validate configuration
 */
export function validateConfig(config: TestConfig): string[] {
  const errors: string[] = [];

  if (!config.environment.apiUrl) {
    errors.push('API URL is required');
  }

  if (!config.environment.apiKey) {
    errors.push('API key is required');
  }

  if (!config.environment.apiSecret) {
    errors.push('API secret is required');
  }

  if (!config.supabase.url) {
    errors.push('Supabase URL is required');
  }

  if (!config.supabase.anonKey) {
    errors.push('Supabase anon key is required');
  }

  return errors;
}

export { environments, getEnvironment, Environment };
export { endpoints, EndpointConfig };
export { rateLimits, RateLimitConfig };
export { testSuites, TestSuiteConfig };

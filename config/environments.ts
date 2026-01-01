/**
 * Environment Configuration
 *
 * Defines settings for different test environments.
 */

/**
 * Environment definition
 */
export interface Environment {
  name: string;
  apiUrl: string;
  apiKey: string;
  apiSecret: string;
  apiVersion: string;
  timeout: number;
  parallelWorkers: number;
  features: {
    workflows: boolean;
    sharing: boolean;
    externalLinks: boolean;
    pushConnections: boolean;
  };
}

/**
 * Environment configurations
 */
export const environments: Record<string, Environment> = {
  development: {
    name: 'development',
    apiUrl: process.env.LEGITO_API_URL_DEV ?? 'https://api.dev.legito.com',
    apiKey: process.env.LEGITO_API_KEY_DEV ?? '',
    apiSecret: process.env.LEGITO_API_SECRET_DEV ?? '',
    apiVersion: 'v7',
    timeout: 30000,
    parallelWorkers: 2,
    features: {
      workflows: true,
      sharing: true,
      externalLinks: true,
      pushConnections: true,
    },
  },

  staging: {
    name: 'staging',
    apiUrl: process.env.LEGITO_API_URL_STAGING ?? 'https://api.staging.legito.com',
    apiKey: process.env.LEGITO_API_KEY_STAGING ?? '',
    apiSecret: process.env.LEGITO_API_SECRET_STAGING ?? '',
    apiVersion: 'v7',
    timeout: 30000,
    parallelWorkers: 4,
    features: {
      workflows: true,
      sharing: true,
      externalLinks: true,
      pushConnections: true,
    },
  },

  production: {
    name: 'production',
    apiUrl: process.env.LEGITO_API_URL ?? 'https://api.legito.com',
    apiKey: process.env.LEGITO_API_KEY ?? '',
    apiSecret: process.env.LEGITO_API_SECRET ?? '',
    apiVersion: 'v7',
    timeout: 60000,
    parallelWorkers: 4,
    features: {
      workflows: true,
      sharing: true,
      externalLinks: true,
      pushConnections: true,
    },
  },

  ci: {
    name: 'ci',
    apiUrl: process.env.LEGITO_API_URL ?? '',
    apiKey: process.env.LEGITO_API_KEY ?? '',
    apiSecret: process.env.LEGITO_API_SECRET ?? '',
    apiVersion: 'v7',
    timeout: 45000,
    parallelWorkers: 4,
    features: {
      workflows: true,
      sharing: true,
      externalLinks: true,
      pushConnections: false,  // Disabled in CI
    },
  },
};

/**
 * Get environment by name (defaults to process.env.TEST_ENV or 'development')
 */
export function getEnvironment(name?: string): Environment {
  const envName = name ?? process.env.TEST_ENV ?? 'development';
  const env = environments[envName];

  if (!env) {
    throw new Error(
      `Unknown environment: ${envName}. ` +
      `Available: ${Object.keys(environments).join(', ')}`
    );
  }

  return env;
}

/**
 * Check if running in CI
 */
export function isCI(): boolean {
  return process.env.CI === 'true' || process.env.TEST_ENV === 'ci';
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return process.env.TEST_ENV === 'production';
}

export default environments;

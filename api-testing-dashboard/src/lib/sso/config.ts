/**
 * SSO Testing Configuration
 */

import type { SsoServerConfig, SsoServerId } from '@/types/sso';

/**
 * SSO Server configurations
 */
export const SSO_SERVERS: Record<SsoServerId, SsoServerConfig> = {
  emea: {
    id: 'emea',
    name: 'EMEA',
    url: 'https://ssotesting.emea.legito.com',
    description: 'Europe, Middle East & Africa',
  },
  us: {
    id: 'us',
    name: 'US',
    url: 'https://ssotesting.us.legito.com',
    description: 'United States',
  },
  quarterly: {
    id: 'quarterly',
    name: 'Quarterly',
    url: 'https://ssotesting.quarterly.legito.com',
    description: 'Quarterly Release Server',
  },
};

/**
 * Get all server configs as array
 */
export const SSO_SERVER_LIST = Object.values(SSO_SERVERS);

/**
 * Validate server ID
 */
export function isValidServerId(id: string): id is SsoServerId {
  return id in SSO_SERVERS;
}

/**
 * Get server config by ID
 */
export function getServerConfig(id: SsoServerId): SsoServerConfig {
  return SSO_SERVERS[id];
}

/**
 * Environment variables for SSO testing
 * These are loaded from process.env on the server side
 */
export const SSO_ENV_KEYS = {
  WORKER_URL: 'SSO_WORKER_URL',
  SLACK_WEBHOOK: 'SLACK_WEBHOOK_URL',
  TEST_EMAIL: 'SSO_TEST_EMAIL',
  TEST_PASSWORD: 'SSO_TEST_PASSWORD',
} as const;

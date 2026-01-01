/**
 * Health Check Smoke Tests
 *
 * Quick verification that the Legito API is available and responding.
 * These tests should complete in under 30 seconds.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { ApiClient, createApiClient } from '../../src/core/client/api-client';
import { loadConfig } from '../../config';

describe('API Health Check', () => {
  let apiClient: ApiClient;
  let config: ReturnType<typeof loadConfig>;

  beforeAll(() => {
    config = loadConfig();

    apiClient = createApiClient({
      baseUrl: config.environment.apiUrl,
      auth: {
        apiKey: config.environment.apiKey,
        apiSecret: config.environment.apiSecret,
      },
      timeout: 10000,  // Short timeout for smoke tests
      logging: false,
    });
  });

  describe('Connectivity', () => {
    it('should connect to the API endpoint', async () => {
      // Most APIs have a health endpoint or we can check any read endpoint
      const response = await apiClient.get('/styles', {
        skipRateLimit: true,
      });

      expect(response.status).toBe(200);
    });

    it('should respond within acceptable time', async () => {
      const startTime = Date.now();

      await apiClient.get('/styles', {
        skipRateLimit: true,
      });

      const duration = Date.now() - startTime;

      // Response should be under 5 seconds
      expect(duration).toBeLessThan(5000);
    });
  });

  describe('Authentication', () => {
    it('should authenticate with valid credentials', async () => {
      const response = await apiClient.get('/users', {
        params: { limit: 1 },
      });

      expect(response.status).toBe(200);
    });

    it('should reject requests without authentication', async () => {
      // Create a client without auth
      const unauthClient = createApiClient({
        baseUrl: config.environment.apiUrl,
        auth: {
          apiKey: 'invalid-key',
          apiSecret: 'invalid-secret',
        },
        timeout: 10000,
      });

      await expect(
        unauthClient.get('/users')
      ).rejects.toMatchObject({
        response: { status: 401 },
      });
    });
  });

  describe('Core Endpoints Availability', () => {
    const coreEndpoints = [
      { name: 'Documents', path: '/documents', method: 'GET' },
      { name: 'Templates', path: '/template-suites', method: 'GET' },
      { name: 'Users', path: '/users', method: 'GET' },
      { name: 'Styles', path: '/styles', method: 'GET' },
      { name: 'Categories', path: '/categories', method: 'GET' },
    ];

    for (const endpoint of coreEndpoints) {
      it(`should respond to ${endpoint.name} endpoint (${endpoint.method} ${endpoint.path})`, async () => {
        const response = await apiClient.get(endpoint.path, {
          params: { limit: 1 },
        });

        expect([200, 204]).toContain(response.status);
      });
    }
  });

  describe('Response Format', () => {
    it('should return JSON content type', async () => {
      const response = await apiClient.get('/styles');

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    it('should include request ID in response headers', async () => {
      const response = await apiClient.get('/styles');

      // Many APIs include a request ID for tracing
      // This may vary - adjust based on actual API behavior
      expect(response.requestId ?? response.headers['x-request-id']).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent resources', async () => {
      await expect(
        apiClient.get('/documents/non-existent-id-12345')
      ).rejects.toMatchObject({
        response: { status: 404 },
      });
    });

    it('should return 400 for invalid request parameters', async () => {
      await expect(
        apiClient.get('/documents', {
          params: { limit: -1 },  // Invalid limit
        })
      ).rejects.toMatchObject({
        response: { status: 400 },
      });
    });
  });
});

import { test, expect } from '@playwright/test';
import { createAuthManager } from '@helpers/auth-manager';

/**
 * @smoke
 * Smoke tests for critical API health and authentication
 */
test.describe('API Health - Smoke Tests', () => {
  test.describe.configure({ mode: 'serial' });

  test('should successfully authenticate with valid credentials @smoke @critical', async ({
    request,
  }) => {
    const authManager = createAuthManager(request);

    await authManager.authenticate();

    expect(authManager.isAuthenticated()).toBe(true);
  });

  test('should refresh authentication token @smoke @critical', async ({ request }) => {
    const authManager = createAuthManager(request);

    await authManager.authenticate();
    const initialToken = await authManager.getAccessToken();

    // Simulate token expiration by clearing and re-authenticating
    authManager.clearTokens();
    await authManager.authenticate();

    const newToken = await authManager.getAccessToken();
    expect(newToken).toBeDefined();
    expect(newToken).not.toBe(initialToken);
  });

  test('should fail authentication with invalid credentials @smoke', async ({ request }) => {
    const authManager = createAuthManager(request, {
      username: 'invalid@example.com',
      password: 'wrongpassword',
    });

    await expect(authManager.authenticate()).rejects.toThrow();
  });

  test('should access API health endpoint @smoke @critical', async ({ request }) => {
    const response = await request.get(`${process.env.API_BASE_URL}/health`);

    expect(response.ok()).toBe(true);
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('status', 'healthy');
  });

  test('should access API version endpoint @smoke', async ({ request }) => {
    const response = await request.get(`${process.env.API_BASE_URL}/version`);

    expect(response.ok()).toBe(true);

    const data = await response.json();
    expect(data).toHaveProperty('version');
    expect(data.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  test('should return 401 for unauthenticated requests @smoke', async ({ request }) => {
    const response = await request.get(
      `${process.env.API_BASE_URL}/api/v1/document-records`
    );

    expect(response.status()).toBe(401);
  });

  test('should handle rate limiting headers @smoke', async ({ request }) => {
    const authManager = createAuthManager(request);
    await authManager.authenticate();

    const authHeader = await authManager.getAuthHeader();

    const response = await request.get(
      `${process.env.API_BASE_URL}/api/v1/document-records`,
      { headers: authHeader }
    );

    const headers = response.headers();
    expect(headers).toHaveProperty('x-ratelimit-limit');
    expect(headers).toHaveProperty('x-ratelimit-remaining');
  });

  test('should support OPTIONS preflight requests @smoke', async ({ request }) => {
    const response = await request.fetch(
      `${process.env.API_BASE_URL}/api/v1/document-records`,
      {
        method: 'OPTIONS',
      }
    );

    expect([200, 204]).toContain(response.status());

    const headers = response.headers();
    expect(headers).toHaveProperty('access-control-allow-methods');
    expect(headers).toHaveProperty('access-control-allow-headers');
  });
});

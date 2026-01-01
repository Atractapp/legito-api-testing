import { APIRequestContext } from '@playwright/test';
import { logger } from '@utils/logger';

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

interface AuthCredentials {
  username: string;
  password: string;
}

/**
 * Manages authentication tokens with automatic refresh capabilities
 * Handles token lifecycle, expiration, and refresh logic
 */
export class AuthManager {
  private tokens: AuthTokens | null = null;
  private refreshPromise: Promise<AuthTokens> | null = null;
  private readonly tokenBufferMs = 60000; // Refresh 1 minute before expiry

  constructor(
    private request: APIRequestContext,
    private credentials: AuthCredentials,
    private baseUrl: string
  ) {}

  /**
   * Get valid access token, refreshing if necessary
   */
  async getAccessToken(): Promise<string> {
    if (!this.tokens || this.isTokenExpiringSoon()) {
      await this.refreshTokens();
    }
    return this.tokens!.accessToken;
  }

  /**
   * Perform initial authentication
   */
  async authenticate(): Promise<void> {
    logger.info('Authenticating user', { username: this.credentials.username });

    try {
      const response = await this.request.post(`${this.baseUrl}/auth/login`, {
        data: {
          username: this.credentials.username,
          password: this.credentials.password,
        },
      });

      if (!response.ok()) {
        const error = await response.text();
        throw new Error(`Authentication failed: ${response.status()} - ${error}`);
      }

      const data = await response.json();
      this.setTokens(data);

      logger.info('Authentication successful');
    } catch (error) {
      logger.error('Authentication failed', { error });
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshTokens(): Promise<AuthTokens> {
    // Prevent concurrent refresh requests
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.performRefresh();

    try {
      const tokens = await this.refreshPromise;
      return tokens;
    } finally {
      this.refreshPromise = null;
    }
  }

  /**
   * Perform the actual token refresh
   */
  private async performRefresh(): Promise<AuthTokens> {
    logger.info('Refreshing authentication tokens');

    try {
      // If no tokens exist, perform initial authentication
      if (!this.tokens) {
        await this.authenticate();
        return this.tokens!;
      }

      const response = await this.request.post(`${this.baseUrl}/auth/refresh`, {
        data: {
          refreshToken: this.tokens.refreshToken,
        },
      });

      if (!response.ok()) {
        // If refresh fails, try re-authenticating
        logger.warn('Token refresh failed, attempting re-authentication');
        await this.authenticate();
        return this.tokens!;
      }

      const data = await response.json();
      this.setTokens(data);

      logger.info('Token refresh successful');
      return this.tokens!;
    } catch (error) {
      logger.error('Token refresh failed', { error });
      // Attempt full re-authentication as fallback
      await this.authenticate();
      return this.tokens!;
    }
  }

  /**
   * Set tokens and calculate expiration time
   */
  private setTokens(data: any): void {
    const expiresIn = data.expiresIn || 3600; // Default 1 hour
    this.tokens = {
      accessToken: data.accessToken || data.access_token,
      refreshToken: data.refreshToken || data.refresh_token,
      expiresAt: Date.now() + expiresIn * 1000,
    };
  }

  /**
   * Check if token is expiring soon
   */
  private isTokenExpiringSoon(): boolean {
    if (!this.tokens) return true;
    return Date.now() + this.tokenBufferMs >= this.tokens.expiresAt;
  }

  /**
   * Clear stored tokens (logout)
   */
  clearTokens(): void {
    this.tokens = null;
    logger.info('Tokens cleared');
  }

  /**
   * Check if currently authenticated
   */
  isAuthenticated(): boolean {
    return this.tokens !== null && !this.isTokenExpiringSoon();
  }

  /**
   * Get authorization header value
   */
  async getAuthHeader(): Promise<{ Authorization: string }> {
    const token = await this.getAccessToken();
    return { Authorization: `Bearer ${token}` };
  }
}

/**
 * Factory function to create AuthManager instance
 */
export function createAuthManager(
  request: APIRequestContext,
  credentials?: AuthCredentials
): AuthManager {
  const creds = credentials || {
    username: process.env.AUTH_USERNAME!,
    password: process.env.AUTH_PASSWORD!,
  };

  const baseUrl = process.env.API_BASE_URL!;

  return new AuthManager(request, creds, baseUrl);
}

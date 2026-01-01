/**
 * JWT Manager for Legito API Authentication
 *
 * Handles JWT token generation, validation, and lifecycle management
 * using HS256 signing algorithm as required by Legito API v7.
 */

import * as crypto from 'crypto';

export interface JWTPayload {
  iss: string;  // API key (issuer)
  iat: number;  // Issued at timestamp
  exp: number;  // Expiration timestamp
}

export interface JWTManagerConfig {
  apiKey: string;
  apiSecret: string;
  tokenTTLSeconds?: number;
  refreshThresholdSeconds?: number;
}

export interface TokenInfo {
  token: string;
  expiresAt: Date;
  issuedAt: Date;
  remainingSeconds: number;
}

/**
 * Base64URL encoding (RFC 4648)
 */
function base64UrlEncode(data: string | Buffer): string {
  const base64 = Buffer.isBuffer(data)
    ? data.toString('base64')
    : Buffer.from(data).toString('base64');

  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Base64URL decoding
 */
function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');

  // Add padding if necessary
  const padding = 4 - (base64.length % 4);
  if (padding !== 4) {
    base64 += '='.repeat(padding);
  }

  return Buffer.from(base64, 'base64').toString('utf8');
}

/**
 * JWT Manager class for handling authentication tokens
 */
export class JWTManager {
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly tokenTTLSeconds: number;
  private readonly refreshThresholdSeconds: number;

  constructor(config: JWTManagerConfig) {
    if (!config.apiKey || !config.apiSecret) {
      throw new Error('API key and secret are required for JWT generation');
    }

    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.tokenTTLSeconds = config.tokenTTLSeconds ?? 3600; // Default 1 hour
    this.refreshThresholdSeconds = config.refreshThresholdSeconds ?? 300; // Default 5 minutes
  }

  /**
   * Generate a new JWT token
   */
  generateToken(): string {
    const now = Math.floor(Date.now() / 1000);

    const header = {
      alg: 'HS256',
      typ: 'JWT',
    };

    const payload: JWTPayload = {
      iss: this.apiKey,
      iat: now,
      exp: now + this.tokenTTLSeconds,
    };

    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    const signatureInput = `${encodedHeader}.${encodedPayload}`;

    const signature = this.sign(signatureInput);

    return `${signatureInput}.${signature}`;
  }

  /**
   * Sign data using HS256 (HMAC-SHA256)
   */
  private sign(data: string): string {
    const hmac = crypto.createHmac('sha256', this.apiSecret);
    hmac.update(data);
    return base64UrlEncode(hmac.digest());
  }

  /**
   * Verify a JWT token signature and expiration
   */
  verifyToken(token: string): { valid: boolean; payload?: JWTPayload; error?: string } {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return { valid: false, error: 'Invalid token format' };
      }

      const [encodedHeader, encodedPayload, signature] = parts;

      // Verify signature
      const expectedSignature = this.sign(`${encodedHeader}.${encodedPayload}`);
      if (signature !== expectedSignature) {
        return { valid: false, error: 'Invalid signature' };
      }

      // Decode and parse payload
      const payload = JSON.parse(base64UrlDecode(encodedPayload)) as JWTPayload;

      // Check expiration
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp <= now) {
        return { valid: false, error: 'Token expired', payload };
      }

      // Verify issuer matches our API key
      if (payload.iss !== this.apiKey) {
        return { valid: false, error: 'Invalid issuer', payload };
      }

      return { valid: true, payload };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Token verification failed',
      };
    }
  }

  /**
   * Decode a JWT token without verification (for inspection)
   */
  decodeToken(token: string): { header: object; payload: JWTPayload } | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }

      const header = JSON.parse(base64UrlDecode(parts[0]));
      const payload = JSON.parse(base64UrlDecode(parts[1])) as JWTPayload;

      return { header, payload };
    } catch {
      return null;
    }
  }

  /**
   * Get detailed information about a token
   */
  getTokenInfo(token: string): TokenInfo | null {
    const decoded = this.decodeToken(token);
    if (!decoded) {
      return null;
    }

    const now = Math.floor(Date.now() / 1000);
    const remainingSeconds = Math.max(0, decoded.payload.exp - now);

    return {
      token,
      expiresAt: new Date(decoded.payload.exp * 1000),
      issuedAt: new Date(decoded.payload.iat * 1000),
      remainingSeconds,
    };
  }

  /**
   * Check if a token needs refresh (within threshold of expiration)
   */
  needsRefresh(token: string): boolean {
    const info = this.getTokenInfo(token);
    if (!info) {
      return true;
    }
    return info.remainingSeconds <= this.refreshThresholdSeconds;
  }

  /**
   * Check if a token is expired
   */
  isExpired(token: string): boolean {
    const info = this.getTokenInfo(token);
    if (!info) {
      return true;
    }
    return info.remainingSeconds <= 0;
  }

  /**
   * Get the configured TTL in seconds
   */
  getTokenTTL(): number {
    return this.tokenTTLSeconds;
  }

  /**
   * Get the refresh threshold in seconds
   */
  getRefreshThreshold(): number {
    return this.refreshThresholdSeconds;
  }
}

export default JWTManager;

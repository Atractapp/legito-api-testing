import { APIRequestContext, APIResponse } from '@playwright/test';
import { AuthManager } from '@helpers/auth-manager';
import { RetryHandler } from '@helpers/retry-handler';
import { rateLimiterManager } from '@helpers/rate-limiter';
import { logger } from '@utils/logger';

export interface RequestOptions {
  params?: Record<string, any>;
  data?: any;
  headers?: Record<string, string>;
  timeout?: number;
  isIdempotent?: boolean;
  skipAuth?: boolean;
  skipRateLimit?: boolean;
  rateLimitCategory?: string;
}

/**
 * Base API client with authentication, retry, and rate limiting support
 */
export class BaseApiClient {
  protected retryHandler: RetryHandler;

  constructor(
    protected request: APIRequestContext,
    protected authManager: AuthManager,
    protected baseUrl: string
  ) {
    this.retryHandler = new RetryHandler();
  }

  /**
   * Make a GET request
   */
  async get(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<APIResponse> {
    return this.executeRequest('GET', endpoint, options);
  }

  /**
   * Make a POST request
   */
  async post(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<APIResponse> {
    return this.executeRequest('POST', endpoint, {
      ...options,
      isIdempotent: options.isIdempotent ?? false,
    });
  }

  /**
   * Make a PUT request
   */
  async put(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<APIResponse> {
    return this.executeRequest('PUT', endpoint, {
      ...options,
      isIdempotent: options.isIdempotent ?? true,
    });
  }

  /**
   * Make a PATCH request
   */
  async patch(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<APIResponse> {
    return this.executeRequest('PATCH', endpoint, {
      ...options,
      isIdempotent: options.isIdempotent ?? false,
    });
  }

  /**
   * Make a DELETE request
   */
  async delete(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<APIResponse> {
    return this.executeRequest('DELETE', endpoint, {
      ...options,
      isIdempotent: options.isIdempotent ?? true,
    });
  }

  /**
   * Execute a request with all middleware
   */
  private async executeRequest(
    method: string,
    endpoint: string,
    options: RequestOptions
  ): Promise<APIResponse> {
    const url = this.buildUrl(endpoint, options.params);
    const headers = await this.buildHeaders(options);

    // Apply rate limiting
    if (!options.skipRateLimit) {
      const category = options.rateLimitCategory || 'default';
      await rateLimiterManager.throttle(category);
    }

    // Execute with retry logic
    return this.retryHandler.executeRequest(
      async () => {
        logger.debug(`${method} ${url}`, {
          headers: this.sanitizeHeaders(headers),
          data: options.data,
        });

        const response = await this.request.fetch(url, {
          method,
          headers,
          data: options.data,
          timeout: options.timeout,
        });

        logger.debug(`Response: ${response.status()}`, {
          url,
          status: response.status(),
        });

        return response;
      },
      {
        operationName: `${method} ${endpoint}`,
        isIdempotent: options.isIdempotent,
      }
    );
  }

  /**
   * Build full URL with query parameters
   */
  private buildUrl(endpoint: string, params?: Record<string, any>): string {
    const url = new URL(endpoint, this.baseUrl);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    return url.toString();
  }

  /**
   * Build request headers with authentication
   */
  private async buildHeaders(
    options: RequestOptions
  ): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...options.headers,
    };

    // Add authentication header
    if (!options.skipAuth) {
      const authHeader = await this.authManager.getAuthHeader();
      Object.assign(headers, authHeader);
    }

    return headers;
  }

  /**
   * Sanitize headers for logging (remove sensitive data)
   */
  private sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
    const sanitized = { ...headers };
    if (sanitized.Authorization) {
      sanitized.Authorization = 'Bearer ***';
    }
    return sanitized;
  }

  /**
   * Upload a file
   */
  async uploadFile(
    endpoint: string,
    filePath: string,
    fieldName: string = 'file',
    additionalData?: Record<string, any>
  ): Promise<APIResponse> {
    const FormData = require('form-data');
    const fs = require('fs');
    const form = new FormData();

    form.append(fieldName, fs.createReadStream(filePath));

    if (additionalData) {
      Object.entries(additionalData).forEach(([key, value]) => {
        form.append(key, value);
      });
    }

    const authHeader = await this.authManager.getAuthHeader();
    const url = this.buildUrl(endpoint);

    return this.retryHandler.executeRequest(
      async () => {
        const response = await this.request.fetch(url, {
          method: 'POST',
          headers: {
            ...authHeader,
            ...form.getHeaders(),
          },
          multipart: form,
        });

        return response;
      },
      {
        operationName: `Upload file to ${endpoint}`,
        isIdempotent: false,
      }
    );
  }

  /**
   * Download a file
   */
  async downloadFile(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<Buffer> {
    const response = await this.get(endpoint, options);

    if (!response.ok()) {
      throw new Error(`Download failed: ${response.status()}`);
    }

    return response.body();
  }

  /**
   * Parse JSON response with error handling
   */
  async parseJsonResponse<T>(response: APIResponse): Promise<T> {
    if (!response.ok()) {
      const error = await response.text();
      throw new Error(`API Error ${response.status()}: ${error}`);
    }

    try {
      return await response.json();
    } catch (error) {
      logger.error('Failed to parse JSON response', { error });
      throw new Error('Invalid JSON response');
    }
  }

  /**
   * Validate response status
   */
  validateResponse(
    response: APIResponse,
    expectedStatus: number | number[] = 200
  ): void {
    const expected = Array.isArray(expectedStatus)
      ? expectedStatus
      : [expectedStatus];

    if (!expected.includes(response.status())) {
      throw new Error(
        `Unexpected status code: ${response.status()}. Expected: ${expected.join(', ')}`
      );
    }
  }
}

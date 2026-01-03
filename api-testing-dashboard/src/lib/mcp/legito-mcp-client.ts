/**
 * Legito MCP Client
 * Wraps Legito API calls for use in MCP tools with JWT authentication
 */

import { createHmac } from 'crypto';
import type { LegitoCredentials, McpRequestResult } from '@/types/mcp';

/**
 * Get the base URL for a Legito region
 */
export function getBaseUrl(region: string): string {
  return `https://${region}.legito.com/api/v7`;
}

/**
 * Creates a JWT token for Legito API authentication
 * Uses HS256 (HMAC-SHA256) signing
 */
export function createJwtToken(apiKey: string, privateKey: string): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: apiKey,
    iat: now,
    exp: now + 3600, // 1 hour expiry
  };

  const base64UrlEncode = (data: string): string => {
    return Buffer.from(data)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  };

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const signatureInput = `${headerB64}.${payloadB64}`;

  // Create HMAC-SHA256 signature using the private key
  const signature = createHmac('sha256', privateKey)
    .update(signatureInput)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return `${headerB64}.${payloadB64}.${signature}`;
}

/**
 * Execute a request to the Legito API
 */
export async function executeLegitoRequest<T = unknown>(
  credentials: LegitoCredentials,
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: unknown,
  queryParams?: Record<string, string | number | boolean | undefined>
): Promise<McpRequestResult<T>> {
  const startTime = Date.now();

  try {
    const baseUrl = getBaseUrl(credentials.region);
    const jwt = createJwtToken(credentials.key, credentials.privateKey);

    // Build URL with query parameters
    let url = `${baseUrl}${endpoint}`;
    if (queryParams) {
      const params = new URLSearchParams();
      Object.entries(queryParams).forEach(([key, value]) => {
        if (value !== undefined) {
          params.append(key, String(value));
        }
      });
      const queryString = params.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }

    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const duration = Date.now() - startTime;
    const contentType = response.headers.get('content-type');

    let data: T | undefined;
    if (contentType?.includes('application/json')) {
      try {
        data = await response.json();
      } catch {
        data = undefined;
      }
    }

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
        status: response.status,
        duration,
        data,
      };
    }

    return {
      success: true,
      data,
      status: response.status,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration,
    };
  }
}

/**
 * Validate credentials by calling the /info endpoint
 */
export async function validateCredentials(
  credentials: LegitoCredentials
): Promise<boolean> {
  const result = await executeLegitoRequest(credentials, '/info');
  return result.success;
}

/**
 * Helper class for building Legito API requests
 */
export class LegitoMcpClient {
  constructor(private credentials: LegitoCredentials) {}

  async get<T = unknown>(
    endpoint: string,
    queryParams?: Record<string, string | number | boolean | undefined>
  ): Promise<McpRequestResult<T>> {
    return executeLegitoRequest<T>(this.credentials, endpoint, 'GET', undefined, queryParams);
  }

  async post<T = unknown>(
    endpoint: string,
    body?: unknown,
    queryParams?: Record<string, string | number | boolean | undefined>
  ): Promise<McpRequestResult<T>> {
    return executeLegitoRequest<T>(this.credentials, endpoint, 'POST', body, queryParams);
  }

  async put<T = unknown>(
    endpoint: string,
    body?: unknown,
    queryParams?: Record<string, string | number | boolean | undefined>
  ): Promise<McpRequestResult<T>> {
    return executeLegitoRequest<T>(this.credentials, endpoint, 'PUT', body, queryParams);
  }

  async delete<T = unknown>(
    endpoint: string,
    queryParams?: Record<string, string | number | boolean | undefined>
  ): Promise<McpRequestResult<T>> {
    return executeLegitoRequest<T>(this.credentials, endpoint, 'DELETE', undefined, queryParams);
  }

  // Document operations
  async createDocument(templateSuiteId: number, elements: unknown[]) {
    return this.post(`/document-version/data/${templateSuiteId}`, elements);
  }

  async updateDocument(documentRecordCode: string, elements: unknown[]) {
    return this.put(`/document-version/data/${documentRecordCode}`, elements);
  }

  async getDocumentRecord(code: string) {
    return this.get(`/document-record/${code}`);
  }

  async listDocumentRecords(params?: { search?: string; limit?: number; offset?: number }) {
    return this.get('/document-record', params);
  }

  async deleteDocumentRecord(code: string) {
    return this.delete(`/document-record/${code}`);
  }

  async anonymizeDocumentRecord(code: string) {
    return this.get(`/document-record/anonymize/${code}`);
  }

  async getDocumentElements(code: string) {
    return this.get(`/document-version/data/${code}`);
  }

  // Object operations
  async createObjectRecord(objectId: number, properties: unknown[]) {
    return this.post(`/object-record/${objectId}`, properties);
  }

  async updateObjectRecord(systemName: string, properties: unknown[]) {
    return this.put(`/object-record/${systemName}`, properties);
  }

  async getObjectRecord(systemName: string) {
    return this.get(`/object-record/${systemName}`);
  }

  async listObjectRecords(objectId: number) {
    return this.get('/object-record', { objectId });
  }

  async deleteObjectRecord(systemName: string) {
    return this.delete(`/object-record/${systemName}`);
  }

  async listObjects() {
    return this.get('/object');
  }

  // User operations
  async createUsers(users: unknown[]) {
    return this.post('/user', users);
  }

  async updateUser(id: number, data: unknown) {
    return this.put(`/user/${id}`, data);
  }

  async getUser(id: number) {
    return this.get(`/user/${id}`);
  }

  async listUsers() {
    return this.get('/user');
  }

  async deleteUser(id: number) {
    return this.delete(`/user/${id}`);
  }

  // User group operations
  async createUserGroup(data: unknown) {
    return this.post('/user-group', data);
  }

  async updateUserGroup(id: number, data: unknown) {
    return this.put(`/user-group/${id}`, data);
  }

  async getUserGroup(id: number) {
    return this.get(`/user-group/${id}`);
  }

  async listUserGroups() {
    return this.get('/user-group');
  }

  async deleteUserGroup(id: number) {
    return this.delete(`/user-group/${id}`);
  }

  // Sharing operations
  async shareToUser(documentCode: string, payload: unknown) {
    return this.post(`/share/user/${documentCode}`, payload);
  }

  async shareToGroup(documentCode: string, payload: unknown) {
    return this.post(`/share/user-group/${documentCode}`, payload);
  }

  async createExternalLink(documentCode: string, payload: unknown) {
    return this.post(`/share/external-link/${documentCode}`, payload);
  }

  async deleteExternalLink(linkId: number) {
    return this.delete(`/share/external-link/${linkId}`);
  }

  async listExternalLinks(documentCode: string) {
    return this.get(`/share/external-link/${documentCode}`);
  }

  // Template operations
  async listTemplateSuites() {
    return this.get('/template-suite');
  }

  async getTemplateSuite(id: number) {
    return this.get(`/template-suite/${id}`);
  }

  // Tag operations
  async listTags() {
    return this.get('/template-tag');
  }

  async createTag(data: unknown) {
    return this.post('/template-tag', data);
  }

  async getTag(id: number) {
    return this.get(`/template-tag/${id}`);
  }

  // Workflow operations
  async listWorkflows() {
    return this.get('/workflow');
  }

  async getWorkflow(id: number) {
    return this.get(`/workflow/${id}`);
  }

  // Reference data
  async getSystemInfo() {
    return this.get('/info');
  }

  async listCountries() {
    return this.get('/country');
  }

  async listCurrencies() {
    return this.get('/currency');
  }

  async listLanguages() {
    return this.get('/language');
  }

  async listTimezones() {
    return this.get('/timezone');
  }
}

/**
 * Create a new Legito MCP client instance
 */
export function createLegitoMcpClient(credentials: LegitoCredentials): LegitoMcpClient {
  return new LegitoMcpClient(credentials);
}

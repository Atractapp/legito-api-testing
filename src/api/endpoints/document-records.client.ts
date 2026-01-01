import { APIRequestContext, APIResponse } from '@playwright/test';
import { BaseApiClient } from '../clients/base-client';
import { AuthManager } from '@helpers/auth-manager';

export interface DocumentRecord {
  id?: string;
  code: string;
  name: string;
  description?: string;
  templateSuiteId?: string;
  metadata?: Record<string, any>;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface DocumentRecordListParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
  tags?: string[];
  templateSuiteId?: string;
}

/**
 * Client for Document Records API endpoints
 */
export class DocumentRecordsClient extends BaseApiClient {
  private readonly basePath = '/api/v1/document-records';

  constructor(request: APIRequestContext, authManager: AuthManager, baseUrl: string) {
    super(request, authManager, baseUrl);
  }

  /**
   * Create a new document record
   */
  async create(document: DocumentRecord): Promise<APIResponse> {
    return this.post(this.basePath, {
      data: document,
      rateLimitCategory: 'document-records',
    });
  }

  /**
   * Get document record by ID
   */
  async getById(id: string): Promise<APIResponse> {
    return this.get(`${this.basePath}/${id}`, {
      rateLimitCategory: 'document-records',
    });
  }

  /**
   * Get document record by code
   */
  async getByCode(code: string): Promise<APIResponse> {
    return this.get(`${this.basePath}/by-code/${code}`, {
      rateLimitCategory: 'document-records',
    });
  }

  /**
   * List document records with pagination and filtering
   */
  async list(params?: DocumentRecordListParams): Promise<APIResponse> {
    return this.get(this.basePath, {
      params,
      rateLimitCategory: 'document-records',
    });
  }

  /**
   * Update document record
   */
  async update(id: string, updates: Partial<DocumentRecord>): Promise<APIResponse> {
    return this.put(`${this.basePath}/${id}`, {
      data: updates,
      rateLimitCategory: 'document-records',
      isIdempotent: true,
    });
  }

  /**
   * Patch document record (partial update)
   */
  async patch(id: string, updates: Partial<DocumentRecord>): Promise<APIResponse> {
    return this.patch(`${this.basePath}/${id}`, {
      data: updates,
      rateLimitCategory: 'document-records',
    });
  }

  /**
   * Delete document record
   */
  async deleteById(id: string): Promise<APIResponse> {
    return this.delete(`${this.basePath}/${id}`, {
      rateLimitCategory: 'document-records',
    });
  }

  /**
   * Bulk create document records
   */
  async bulkCreate(documents: DocumentRecord[]): Promise<APIResponse> {
    return this.post(`${this.basePath}/bulk`, {
      data: { documents },
      rateLimitCategory: 'document-records',
      isIdempotent: false,
    });
  }

  /**
   * Bulk delete document records
   */
  async bulkDelete(ids: string[]): Promise<APIResponse> {
    return this.delete(`${this.basePath}/bulk`, {
      data: { ids },
      rateLimitCategory: 'document-records',
    });
  }

  /**
   * Add tags to document record
   */
  async addTags(id: string, tags: string[]): Promise<APIResponse> {
    return this.post(`${this.basePath}/${id}/tags`, {
      data: { tags },
      rateLimitCategory: 'document-records',
    });
  }

  /**
   * Remove tags from document record
   */
  async removeTags(id: string, tags: string[]): Promise<APIResponse> {
    return this.delete(`${this.basePath}/${id}/tags`, {
      data: { tags },
      rateLimitCategory: 'document-records',
    });
  }

  /**
   * Search document records
   */
  async search(query: string, filters?: Record<string, any>): Promise<APIResponse> {
    return this.post(`${this.basePath}/search`, {
      data: { query, filters },
      rateLimitCategory: 'document-records',
    });
  }
}

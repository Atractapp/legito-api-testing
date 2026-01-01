import { APIRequestContext, APIResponse } from '@playwright/test';
import { BaseApiClient } from '../clients/base-client';
import { AuthManager } from '@helpers/auth-manager';

export interface DocumentVersion {
  id?: string;
  documentRecordId: string;
  versionNumber?: number;
  data: Record<string, any>;
  status?: 'draft' | 'published' | 'archived';
  createdAt?: string;
  updatedAt?: string;
}

export type FileFormat = 'docx' | 'pdf' | 'pdfa' | 'htm' | 'rtf' | 'xml' | 'odt' | 'txt';

export interface VersionListParams {
  page?: number;
  limit?: number;
  status?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Client for Document Versions API endpoints
 */
export class DocumentVersionsClient extends BaseApiClient {
  private readonly basePath = '/api/v1/document-versions';

  constructor(request: APIRequestContext, authManager: AuthManager, baseUrl: string) {
    super(request, authManager, baseUrl);
  }

  /**
   * Create a new document version
   */
  async create(version: DocumentVersion): Promise<APIResponse> {
    return this.post(this.basePath, {
      data: version,
      rateLimitCategory: 'document-versions',
    });
  }

  /**
   * Get document version by ID
   */
  async getById(id: string): Promise<APIResponse> {
    return this.get(`${this.basePath}/${id}`, {
      rateLimitCategory: 'document-versions',
    });
  }

  /**
   * List versions for a document record
   */
  async listByDocumentRecord(
    documentRecordId: string,
    params?: VersionListParams
  ): Promise<APIResponse> {
    return this.get(`${this.basePath}/document/${documentRecordId}`, {
      params,
      rateLimitCategory: 'document-versions',
    });
  }

  /**
   * Update document version data
   */
  async updateData(id: string, data: Record<string, any>): Promise<APIResponse> {
    return this.put(`${this.basePath}/${id}/data`, {
      data,
      rateLimitCategory: 'document-versions',
      isIdempotent: true,
    });
  }

  /**
   * Patch document version data (partial update)
   */
  async patchData(id: string, data: Record<string, any>): Promise<APIResponse> {
    return this.patch(`${this.basePath}/${id}/data`, {
      data,
      rateLimitCategory: 'document-versions',
    });
  }

  /**
   * Update version status
   */
  async updateStatus(
    id: string,
    status: 'draft' | 'published' | 'archived'
  ): Promise<APIResponse> {
    return this.patch(`${this.basePath}/${id}/status`, {
      data: { status },
      rateLimitCategory: 'document-versions',
    });
  }

  /**
   * Download document version as specified format
   */
  async download(id: string, format: FileFormat): Promise<Buffer> {
    return this.downloadFile(`${this.basePath}/${id}/download/${format}`, {
      rateLimitCategory: 'file-downloads',
    });
  }

  /**
   * Download document version with custom options
   */
  async downloadWithOptions(
    id: string,
    format: FileFormat,
    options?: {
      includeComments?: boolean;
      includeTracking?: boolean;
      templateName?: string;
    }
  ): Promise<Buffer> {
    return this.downloadFile(`${this.basePath}/${id}/download/${format}`, {
      params: options,
      rateLimitCategory: 'file-downloads',
    });
  }

  /**
   * Get download URL for a document version
   */
  async getDownloadUrl(id: string, format: FileFormat): Promise<APIResponse> {
    return this.get(`${this.basePath}/${id}/download-url/${format}`, {
      rateLimitCategory: 'document-versions',
    });
  }

  /**
   * Create a new version from existing version
   */
  async clone(id: string, newData?: Record<string, any>): Promise<APIResponse> {
    return this.post(`${this.basePath}/${id}/clone`, {
      data: newData ? { data: newData } : {},
      rateLimitCategory: 'document-versions',
    });
  }

  /**
   * Compare two versions
   */
  async compare(versionId1: string, versionId2: string): Promise<APIResponse> {
    return this.get(`${this.basePath}/compare`, {
      params: {
        version1: versionId1,
        version2: versionId2,
      },
      rateLimitCategory: 'document-versions',
    });
  }

  /**
   * Delete document version
   */
  async deleteById(id: string): Promise<APIResponse> {
    return this.delete(`${this.basePath}/${id}`, {
      rateLimitCategory: 'document-versions',
    });
  }

  /**
   * Get version history for a document
   */
  async getHistory(documentRecordId: string): Promise<APIResponse> {
    return this.get(`${this.basePath}/history/${documentRecordId}`, {
      rateLimitCategory: 'document-versions',
    });
  }

  /**
   * Revert to a specific version
   */
  async revertTo(documentRecordId: string, versionId: string): Promise<APIResponse> {
    return this.post(`${this.basePath}/revert`, {
      data: {
        documentRecordId,
        versionId,
      },
      rateLimitCategory: 'document-versions',
    });
  }

  /**
   * Validate document version data against template
   */
  async validateData(id: string): Promise<APIResponse> {
    return this.post(`${this.basePath}/${id}/validate`, {
      rateLimitCategory: 'document-versions',
    });
  }

  /**
   * Generate document from template
   */
  async generateFromTemplate(
    templateId: string,
    data: Record<string, any>
  ): Promise<APIResponse> {
    return this.post(`${this.basePath}/generate`, {
      data: {
        templateId,
        data,
      },
      rateLimitCategory: 'document-versions',
    });
  }
}

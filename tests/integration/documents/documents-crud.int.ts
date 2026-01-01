/**
 * Documents CRUD Integration Tests
 *
 * Tests for document create, read, update, delete operations
 * against the Legito API v7.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { TestContext, TestContextProvider } from '../../../src/core/context';
import { ApiClient, createApiClient } from '../../../src/core/client/api-client';
import { loadConfig } from '../../../config';

// Types
interface Document {
  id: string;
  name: string;
  description?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

interface DocumentListResponse {
  data: Document[];
  total: number;
  page: number;
  pageSize: number;
}

describe('Documents CRUD', () => {
  let context: TestContext;
  let apiClient: ApiClient;

  beforeAll(async () => {
    const config = loadConfig();

    // Create test context
    context = await TestContextProvider.create({
      name: 'documents-crud',
      suite: 'integration',
      isolationLevel: 'suite',
      timeout: 60000,
    });

    // Create API client
    apiClient = createApiClient({
      baseUrl: config.environment.apiUrl,
      auth: {
        apiKey: config.environment.apiKey,
        apiSecret: config.environment.apiSecret,
      },
      rateLimit: config.rateLimits,
      logging: true,
      useGlobalRateLimiter: true,
    });
  });

  afterAll(async () => {
    // Cleanup all test resources
    if (context) {
      const result = await context.cleanup();
      console.log(`Cleanup completed: ${result.cleanedCount} resources cleaned`);
      if (result.failures.length > 0) {
        console.warn(`Cleanup failures: ${result.failures.length}`);
      }
    }
  });

  describe('Create Document', () => {
    it('should create a document with required fields', async () => {
      const documentData = {
        name: context.uniqueName('doc'),
        description: 'Test document created by integration test',
        status: 'draft',
      };

      const response = await apiClient.post<Document>('/documents', documentData);

      expect(response.status).toBe(201);
      expect(response.data).toBeDefined();
      expect(response.data.id).toBeDefined();
      expect(response.data.name).toBe(documentData.name);
      expect(response.data.status).toBe('draft');

      // Track for cleanup
      context.trackResource('documents', response.data.id, {
        cleanup: () => apiClient.delete(`/documents/${response.data.id}`).then(() => {}),
      });
    });

    it('should create a document with all optional fields', async () => {
      const documentData = {
        name: context.uniqueName('doc-full'),
        description: 'Full document with all fields',
        status: 'draft',
        metadata: {
          department: 'legal',
          priority: 'high',
        },
        tags: ['test', 'integration', 'full'],
        locale: 'en-US',
      };

      const response = await apiClient.post<Document>('/documents', documentData);

      expect(response.status).toBe(201);
      expect(response.data.name).toBe(documentData.name);

      context.trackResource('documents', response.data.id, {
        cleanup: () => apiClient.delete(`/documents/${response.data.id}`).then(() => {}),
      });
    });

    it('should fail to create document without required name', async () => {
      const documentData = {
        description: 'Missing name field',
      };

      await expect(
        apiClient.post('/documents', documentData)
      ).rejects.toThrow();
    });

    it('should fail to create document with invalid status', async () => {
      const documentData = {
        name: context.uniqueName('doc-invalid'),
        status: 'invalid_status',
      };

      await expect(
        apiClient.post('/documents', documentData)
      ).rejects.toThrow();
    });
  });

  describe('Read Document', () => {
    let testDocId: string;

    beforeEach(async () => {
      // Create a document for read tests
      const response = await apiClient.post<Document>('/documents', {
        name: context.uniqueName('doc-read'),
        description: 'Document for read tests',
        status: 'draft',
      });

      testDocId = response.data.id;

      context.trackResource('documents', testDocId, {
        cleanup: () => apiClient.delete(`/documents/${testDocId}`).then(() => {}),
      });
    });

    it('should get a document by ID', async () => {
      const response = await apiClient.get<Document>(`/documents/${testDocId}`);

      expect(response.status).toBe(200);
      expect(response.data.id).toBe(testDocId);
    });

    it('should return 404 for non-existent document', async () => {
      const fakeId = 'non-existent-id-12345';

      await expect(
        apiClient.get(`/documents/${fakeId}`)
      ).rejects.toMatchObject({
        response: { status: 404 },
      });
    });

    it('should list documents with pagination', async () => {
      const response = await apiClient.get<DocumentListResponse>('/documents', {
        params: {
          page: 1,
          pageSize: 10,
        },
      });

      expect(response.status).toBe(200);
      expect(response.data.data).toBeInstanceOf(Array);
      expect(response.data.page).toBe(1);
      expect(response.data.pageSize).toBeLessThanOrEqual(10);
    });

    it('should filter documents by status', async () => {
      const response = await apiClient.get<DocumentListResponse>('/documents', {
        params: {
          status: 'draft',
        },
      });

      expect(response.status).toBe(200);
      expect(response.data.data.every((doc) => doc.status === 'draft')).toBe(true);
    });

    it('should search documents by name prefix', async () => {
      const response = await apiClient.get<DocumentListResponse>('/documents', {
        params: {
          namePrefix: context.prefix,
        },
      });

      expect(response.status).toBe(200);
      // All returned docs should start with our test prefix
      expect(
        response.data.data.every((doc) => doc.name.startsWith(context.prefix))
      ).toBe(true);
    });
  });

  describe('Update Document', () => {
    let testDocId: string;

    beforeEach(async () => {
      const response = await apiClient.post<Document>('/documents', {
        name: context.uniqueName('doc-update'),
        description: 'Document for update tests',
        status: 'draft',
      });

      testDocId = response.data.id;

      context.trackResource('documents', testDocId, {
        cleanup: () => apiClient.delete(`/documents/${testDocId}`).then(() => {}),
      });
    });

    it('should update document name', async () => {
      const newName = context.uniqueName('doc-renamed');

      const response = await apiClient.patch<Document>(`/documents/${testDocId}`, {
        name: newName,
      });

      expect(response.status).toBe(200);
      expect(response.data.name).toBe(newName);
    });

    it('should update document status', async () => {
      const response = await apiClient.patch<Document>(`/documents/${testDocId}`, {
        status: 'pending',
      });

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('pending');
    });

    it('should update multiple fields at once', async () => {
      const updates = {
        name: context.uniqueName('doc-multi-update'),
        description: 'Updated description',
        status: 'approved',
      };

      const response = await apiClient.put<Document>(`/documents/${testDocId}`, updates);

      expect(response.status).toBe(200);
      expect(response.data.name).toBe(updates.name);
      expect(response.data.description).toBe(updates.description);
      expect(response.data.status).toBe(updates.status);
    });

    it('should preserve updatedAt timestamp', async () => {
      const beforeUpdate = await apiClient.get<Document>(`/documents/${testDocId}`);

      // Small delay to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 100));

      await apiClient.patch<Document>(`/documents/${testDocId}`, {
        description: 'Updated for timestamp test',
      });

      const afterUpdate = await apiClient.get<Document>(`/documents/${testDocId}`);

      expect(new Date(afterUpdate.data.updatedAt).getTime())
        .toBeGreaterThan(new Date(beforeUpdate.data.updatedAt).getTime());
    });
  });

  describe('Delete Document', () => {
    it('should delete a document', async () => {
      // Create a document to delete
      const createResponse = await apiClient.post<Document>('/documents', {
        name: context.uniqueName('doc-delete'),
        status: 'draft',
      });

      const docId = createResponse.data.id;

      // Delete it
      const deleteResponse = await apiClient.delete(`/documents/${docId}`);
      expect(deleteResponse.status).toBe(204);

      // Verify it's gone
      await expect(
        apiClient.get(`/documents/${docId}`)
      ).rejects.toMatchObject({
        response: { status: 404 },
      });
    });

    it('should return 404 when deleting non-existent document', async () => {
      const fakeId = 'non-existent-id-12345';

      await expect(
        apiClient.delete(`/documents/${fakeId}`)
      ).rejects.toMatchObject({
        response: { status: 404 },
      });
    });

    it('should handle concurrent delete requests gracefully', async () => {
      const createResponse = await apiClient.post<Document>('/documents', {
        name: context.uniqueName('doc-concurrent-delete'),
        status: 'draft',
      });

      const docId = createResponse.data.id;

      // Send two delete requests concurrently
      const results = await Promise.allSettled([
        apiClient.delete(`/documents/${docId}`),
        apiClient.delete(`/documents/${docId}`),
      ]);

      // One should succeed (204), one should fail (404)
      const statuses = results.map((r) =>
        r.status === 'fulfilled' ? r.value.status : (r.reason as any)?.response?.status
      );

      expect(statuses).toContain(204);
      // The second request should get 404 or could race and get 204
      expect(statuses.some((s) => s === 204 || s === 404)).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long document names', async () => {
      const longName = context.uniqueName('doc') + 'a'.repeat(200);

      const response = await apiClient.post<Document>('/documents', {
        name: longName,
        status: 'draft',
      });

      // API may truncate or reject - test expects defined behavior
      expect([201, 400]).toContain(response.status);

      if (response.status === 201) {
        context.trackResource('documents', response.data.id, {
          cleanup: () => apiClient.delete(`/documents/${response.data.id}`).then(() => {}),
        });
      }
    });

    it('should handle special characters in document name', async () => {
      const specialName = context.uniqueName('doc') + ' !@#$%^&*()_+-=[]{}|;:,.<>?';

      const response = await apiClient.post<Document>('/documents', {
        name: specialName,
        status: 'draft',
      });

      expect(response.status).toBe(201);

      context.trackResource('documents', response.data.id, {
        cleanup: () => apiClient.delete(`/documents/${response.data.id}`).then(() => {}),
      });
    });

    it('should handle unicode characters in document name', async () => {
      const unicodeName = context.uniqueName('doc') + ' Unicode Test';

      const response = await apiClient.post<Document>('/documents', {
        name: unicodeName,
        status: 'draft',
      });

      expect(response.status).toBe(201);
      expect(response.data.name).toContain('Unicode');

      context.trackResource('documents', response.data.id, {
        cleanup: () => apiClient.delete(`/documents/${response.data.id}`).then(() => {}),
      });
    });
  });
});

import { test, expect } from '@playwright/test';
import { DocumentRecordsClient } from '@api/endpoints/document-records.client';
import { DocumentVersionsClient } from '@api/endpoints/document-versions.client';
import { createAuthManager } from '@helpers/auth-manager';
import { faker } from '@faker-js/faker';

/**
 * @integration
 * Integration tests for document lifecycle workflows
 */
test.describe('Document Lifecycle - Integration Tests', () => {
  let recordsClient: DocumentRecordsClient;
  let versionsClient: DocumentVersionsClient;
  let documentRecordId: string;
  let versionIds: string[] = [];

  test.beforeAll(async ({ request }) => {
    const authManager = createAuthManager(request);
    await authManager.authenticate();

    const baseUrl = process.env.API_BASE_URL!;
    recordsClient = new DocumentRecordsClient(request, authManager, baseUrl);
    versionsClient = new DocumentVersionsClient(request, authManager, baseUrl);
  });

  test.afterAll(async () => {
    // Cleanup created test data
    if (documentRecordId) {
      await recordsClient.deleteById(documentRecordId);
    }
  });

  test('should create document record and initial version @integration', async () => {
    // Create document record
    const documentData = {
      code: `INT-TEST-${faker.string.alphanumeric(8).toUpperCase()}`,
      name: `Integration Test - ${faker.company.name()}`,
      description: faker.lorem.paragraph(),
      metadata: {
        category: 'legal',
        priority: 'high',
      },
    };

    const recordResponse = await recordsClient.create(documentData);
    expect(recordResponse.ok()).toBe(true);

    const record = await recordResponse.json();
    documentRecordId = record.id;
    expect(record.id).toBeDefined();
    expect(record.code).toBe(documentData.code);

    // Create initial version
    const versionData = {
      documentRecordId,
      data: {
        title: faker.lorem.words(5),
        content: faker.lorem.paragraphs(3),
        author: faker.person.fullName(),
      },
      status: 'draft' as const,
    };

    const versionResponse = await versionsClient.create(versionData);
    expect(versionResponse.ok()).toBe(true);

    const version = await versionResponse.json();
    versionIds.push(version.id);
    expect(version.documentRecordId).toBe(documentRecordId);
    expect(version.versionNumber).toBe(1);
  });

  test('should update version data and create new version @integration', async () => {
    expect(versionIds.length).toBeGreaterThan(0);
    const currentVersionId = versionIds[0];

    // Update existing version data
    const updatedData = {
      title: faker.lorem.words(5),
      content: faker.lorem.paragraphs(4),
      lastModified: new Date().toISOString(),
    };

    const updateResponse = await versionsClient.updateData(currentVersionId, updatedData);
    expect(updateResponse.ok()).toBe(true);

    const updated = await updateResponse.json();
    expect(updated.data.title).toBe(updatedData.title);

    // Create a new version
    const newVersionData = {
      documentRecordId,
      data: {
        title: faker.lorem.words(5),
        content: faker.lorem.paragraphs(5),
        author: faker.person.fullName(),
      },
      status: 'draft' as const,
    };

    const newVersionResponse = await versionsClient.create(newVersionData);
    expect(newVersionResponse.ok()).toBe(true);

    const newVersion = await newVersionResponse.json();
    versionIds.push(newVersion.id);
    expect(newVersion.versionNumber).toBe(2);
  });

  test('should publish version and verify status change @integration', async () => {
    expect(versionIds.length).toBeGreaterThan(1);
    const versionId = versionIds[1];

    const response = await versionsClient.updateStatus(versionId, 'published');
    expect(response.ok()).toBe(true);

    const version = await response.json();
    expect(version.status).toBe('published');

    // Verify by fetching
    const getResponse = await versionsClient.getById(versionId);
    const fetchedVersion = await getResponse.json();
    expect(fetchedVersion.status).toBe('published');
  });

  test('should list all versions for document @integration', async () => {
    const response = await versionsClient.listByDocumentRecord(documentRecordId);
    expect(response.ok()).toBe(true);

    const data = await response.json();
    expect(data.items).toBeDefined();
    expect(data.items.length).toBeGreaterThanOrEqual(2);
    expect(data.total).toBeGreaterThanOrEqual(2);
  });

  test('should compare two versions @integration', async () => {
    expect(versionIds.length).toBeGreaterThan(1);

    const response = await versionsClient.compare(versionIds[0], versionIds[1]);
    expect(response.ok()).toBe(true);

    const comparison = await response.json();
    expect(comparison).toHaveProperty('differences');
    expect(comparison).toHaveProperty('version1');
    expect(comparison).toHaveProperty('version2');
  });

  test('should clone version creating new draft @integration', async () => {
    expect(versionIds.length).toBeGreaterThan(0);

    const cloneResponse = await versionsClient.clone(versionIds[0], {
      title: 'Cloned Version',
      clonedAt: new Date().toISOString(),
    });

    expect(cloneResponse.ok()).toBe(true);

    const cloned = await cloneResponse.json();
    expect(cloned.id).toBeDefined();
    expect(cloned.id).not.toBe(versionIds[0]);
    expect(cloned.data.title).toBe('Cloned Version');
    expect(cloned.status).toBe('draft');

    versionIds.push(cloned.id);
  });

  test('should download version in multiple formats @integration', async () => {
    expect(versionIds.length).toBeGreaterThan(0);
    const versionId = versionIds[1]; // Use published version

    const formats = ['docx', 'pdf', 'txt'] as const;

    for (const format of formats) {
      const buffer = await versionsClient.download(versionId, format);
      expect(buffer).toBeDefined();
      expect(buffer.length).toBeGreaterThan(0);
    }
  });

  test('should archive old versions @integration', async () => {
    expect(versionIds.length).toBeGreaterThan(0);
    const versionId = versionIds[0];

    const response = await versionsClient.updateStatus(versionId, 'archived');
    expect(response.ok()).toBe(true);

    const archived = await response.json();
    expect(archived.status).toBe('archived');
  });

  test('should maintain version history @integration', async () => {
    const response = await versionsClient.getHistory(documentRecordId);
    expect(response.ok()).toBe(true);

    const history = await response.json();
    expect(history.versions).toBeDefined();
    expect(history.versions.length).toBeGreaterThanOrEqual(3);

    // Verify chronological order
    const versions = history.versions;
    for (let i = 1; i < versions.length; i++) {
      expect(versions[i].versionNumber).toBeGreaterThan(versions[i - 1].versionNumber);
    }
  });

  test('should update document record metadata @integration', async () => {
    const updates = {
      metadata: {
        category: 'contract',
        priority: 'medium',
        department: 'Legal',
        lastReviewed: new Date().toISOString(),
      },
      tags: ['contract', 'legal', 'reviewed'],
    };

    const response = await recordsClient.update(documentRecordId, updates);
    expect(response.ok()).toBe(true);

    const updated = await response.json();
    expect(updated.metadata.category).toBe('contract');
    expect(updated.tags).toContain('contract');
  });

  test('should handle concurrent version updates @integration', async () => {
    const versionId = versionIds[versionIds.length - 1];

    // Simulate concurrent updates
    const updates = [
      { field1: 'value1' },
      { field2: 'value2' },
      { field3: 'value3' },
    ];

    const promises = updates.map((data) =>
      versionsClient.patchData(versionId, data)
    );

    const responses = await Promise.all(promises);
    responses.forEach((response) => {
      expect(response.ok()).toBe(true);
    });

    // Verify final state
    const finalResponse = await versionsClient.getById(versionId);
    const final = await finalResponse.json();
    expect(final.data.field1).toBeDefined();
    expect(final.data.field2).toBeDefined();
    expect(final.data.field3).toBeDefined();
  });
});

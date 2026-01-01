import { test, expect } from '@playwright/test';
import { DocumentRecordsClient } from '@api/endpoints/document-records.client';
import { createAuthManager } from '@helpers/auth-manager';
import { faker } from '@faker-js/faker';

/**
 * @smoke
 * Smoke tests for critical Document Records operations
 */
test.describe('Document Records - Smoke Tests', () => {
  let client: DocumentRecordsClient;
  let documentId: string;

  test.beforeAll(async ({ request }) => {
    const authManager = createAuthManager(request);
    await authManager.authenticate();

    client = new DocumentRecordsClient(
      request,
      authManager,
      process.env.API_BASE_URL!
    );
  });

  test('should create a document record @smoke @critical', async () => {
    const document = {
      code: `TEST-${faker.string.alphanumeric(8).toUpperCase()}`,
      name: faker.company.catchPhrase(),
      description: faker.lorem.sentence(),
    };

    const response = await client.create(document);

    expect(response.ok()).toBe(true);
    expect(response.status()).toBe(201);

    const data = await response.json();
    expect(data).toHaveProperty('id');
    expect(data.code).toBe(document.code);
    expect(data.name).toBe(document.name);

    documentId = data.id;
  });

  test('should retrieve document record by ID @smoke @critical', async () => {
    expect(documentId).toBeDefined();

    const response = await client.getById(documentId);

    expect(response.ok()).toBe(true);
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.id).toBe(documentId);
  });

  test('should list document records @smoke @critical', async () => {
    const response = await client.list({
      page: 1,
      limit: 10,
    });

    expect(response.ok()).toBe(true);
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('items');
    expect(data).toHaveProperty('total');
    expect(data).toHaveProperty('page');
    expect(Array.isArray(data.items)).toBe(true);
  });

  test('should update document record @smoke @critical', async () => {
    expect(documentId).toBeDefined();

    const updates = {
      name: faker.company.catchPhrase(),
      description: faker.lorem.sentence(),
    };

    const response = await client.update(documentId, updates);

    expect(response.ok()).toBe(true);
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.name).toBe(updates.name);
    expect(data.description).toBe(updates.description);
  });

  test('should delete document record @smoke @critical', async () => {
    expect(documentId).toBeDefined();

    const response = await client.deleteById(documentId);

    expect(response.ok()).toBe(true);
    expect([200, 204]).toContain(response.status());
  });

  test('should return 404 for non-existent document @smoke', async () => {
    const fakeId = faker.string.uuid();
    const response = await client.getById(fakeId);

    expect(response.status()).toBe(404);
  });

  test('should validate required fields on create @smoke', async () => {
    const invalidDocument = {
      name: faker.company.name(),
      // Missing required 'code' field
    };

    const response = await client.create(invalidDocument as any);

    expect(response.ok()).toBe(false);
    expect([400, 422]).toContain(response.status());

    const error = await response.json();
    expect(error).toHaveProperty('message');
  });

  test('should prevent duplicate document codes @smoke', async () => {
    const code = `TEST-${faker.string.alphanumeric(8).toUpperCase()}`;

    const document = {
      code,
      name: faker.company.name(),
    };

    // Create first document
    const response1 = await client.create(document);
    expect(response1.ok()).toBe(true);

    const data1 = await response1.json();
    const createdId = data1.id;

    // Try to create duplicate
    const response2 = await client.create(document);
    expect([400, 409]).toContain(response2.status());

    // Cleanup
    await client.deleteById(createdId);
  });
});

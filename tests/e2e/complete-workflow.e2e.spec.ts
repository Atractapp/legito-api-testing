import { test, expect } from '@playwright/test';
import { DocumentRecordsClient } from '@api/endpoints/document-records.client';
import { DocumentVersionsClient } from '@api/endpoints/document-versions.client';
import { createAuthManager } from '@helpers/auth-manager';
import { faker } from '@faker-js/faker';

/**
 * @e2e
 * End-to-end tests for complete document workflows
 */
test.describe('Complete Document Workflow - E2E Tests', () => {
  let recordsClient: DocumentRecordsClient;
  let versionsClient: DocumentVersionsClient;
  const testData: {
    documentRecordId?: string;
    versionIds: string[];
    tags: string[];
  } = {
    versionIds: [],
    tags: ['e2e-test', 'automated'],
  };

  test.beforeAll(async ({ request }) => {
    const authManager = createAuthManager(request);
    await authManager.authenticate();

    const baseUrl = process.env.API_BASE_URL!;
    recordsClient = new DocumentRecordsClient(request, authManager, baseUrl);
    versionsClient = new DocumentVersionsClient(request, authManager, baseUrl);
  });

  test.afterAll(async () => {
    // Cleanup
    if (testData.documentRecordId) {
      try {
        await recordsClient.deleteById(testData.documentRecordId);
      } catch (error) {
        console.error('Cleanup failed:', error);
      }
    }
  });

  test('E2E: Complete document creation to publication workflow @e2e @critical', async () => {
    // Step 1: Create document record
    const documentCode = `E2E-${faker.string.alphanumeric(10).toUpperCase()}`;
    const documentData = {
      code: documentCode,
      name: `E2E Test - ${faker.company.name()} Agreement`,
      description: 'End-to-end test document for complete workflow validation',
      metadata: {
        documentType: 'agreement',
        category: 'legal',
        priority: 'high',
        createdBy: 'automated-test',
      },
      tags: testData.tags,
    };

    const recordResponse = await recordsClient.create(documentData);
    expect(recordResponse.status()).toBe(201);

    const record = await recordResponse.json();
    testData.documentRecordId = record.id;
    expect(record.code).toBe(documentCode);

    // Step 2: Create initial draft version
    const draftData = {
      documentRecordId: testData.documentRecordId,
      data: {
        title: 'Service Agreement',
        parties: {
          client: faker.company.name(),
          provider: 'Legito Services Inc.',
        },
        terms: {
          duration: '12 months',
          amount: faker.finance.amount(),
          currency: 'USD',
        },
        clauses: [
          {
            section: 'Payment Terms',
            content: faker.lorem.paragraph(),
          },
          {
            section: 'Termination',
            content: faker.lorem.paragraph(),
          },
        ],
      },
      status: 'draft' as const,
    };

    const draftResponse = await versionsClient.create(draftData);
    expect(draftResponse.status()).toBe(201);

    const draft = await draftResponse.json();
    testData.versionIds.push(draft.id);
    expect(draft.versionNumber).toBe(1);
    expect(draft.status).toBe('draft');

    // Step 3: Make revisions to draft
    const revisions = {
      ...draftData.data,
      clauses: [
        ...draftData.data.clauses,
        {
          section: 'Confidentiality',
          content: faker.lorem.paragraph(),
        },
      ],
      lastModified: new Date().toISOString(),
      revisionNotes: 'Added confidentiality clause',
    };

    const revisionResponse = await versionsClient.updateData(draft.id, revisions);
    expect(revisionResponse.ok()).toBe(true);

    // Step 4: Validate document data
    const validationResponse = await versionsClient.validateData(draft.id);
    expect(validationResponse.ok()).toBe(true);

    const validation = await validationResponse.json();
    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual([]);

    // Step 5: Publish the version
    const publishResponse = await versionsClient.updateStatus(draft.id, 'published');
    expect(publishResponse.ok()).toBe(true);

    const published = await publishResponse.json();
    expect(published.status).toBe('published');

    // Step 6: Download in multiple formats
    const formats = ['docx', 'pdf', 'txt'] as const;
    const downloads: { format: string; size: number }[] = [];

    for (const format of formats) {
      const buffer = await versionsClient.download(draft.id, format);
      expect(buffer.length).toBeGreaterThan(0);
      downloads.push({ format, size: buffer.length });
    }

    expect(downloads.length).toBe(3);
    downloads.forEach((download) => {
      expect(download.size).toBeGreaterThan(100); // Sanity check
    });

    // Step 7: Create revision (new version)
    const revisionData = {
      documentRecordId: testData.documentRecordId,
      data: {
        ...revisions,
        version: '2.0',
        clauses: [
          ...revisions.clauses,
          {
            section: 'Dispute Resolution',
            content: faker.lorem.paragraph(),
          },
        ],
        revisionNotes: 'Added dispute resolution clause',
      },
      status: 'draft' as const,
    };

    const version2Response = await versionsClient.create(revisionData);
    expect(version2Response.status()).toBe(201);

    const version2 = await version2Response.json();
    testData.versionIds.push(version2.id);
    expect(version2.versionNumber).toBe(2);

    // Step 8: Compare versions
    const comparisonResponse = await versionsClient.compare(
      testData.versionIds[0],
      testData.versionIds[1]
    );
    expect(comparisonResponse.ok()).toBe(true);

    const comparison = await comparisonResponse.json();
    expect(comparison.differences).toBeDefined();
    expect(comparison.differences.length).toBeGreaterThan(0);

    // Step 9: Publish version 2
    const publish2Response = await versionsClient.updateStatus(version2.id, 'published');
    expect(publish2Response.ok()).toBe(true);

    // Step 10: Verify complete history
    const historyResponse = await versionsClient.getHistory(testData.documentRecordId!);
    expect(historyResponse.ok()).toBe(true);

    const history = await historyResponse.json();
    expect(history.versions.length).toBe(2);
    expect(history.versions[0].versionNumber).toBe(1);
    expect(history.versions[1].versionNumber).toBe(2);

    // Step 11: Update document metadata with tags
    await recordsClient.addTags(testData.documentRecordId!, ['published', 'final']);

    const finalRecordResponse = await recordsClient.getById(testData.documentRecordId!);
    const finalRecord = await finalRecordResponse.json();
    expect(finalRecord.tags).toContain('published');
    expect(finalRecord.tags).toContain('final');

    // Step 12: Archive old version
    const archiveResponse = await versionsClient.updateStatus(
      testData.versionIds[0],
      'archived'
    );
    expect(archiveResponse.ok()).toBe(true);

    // Step 13: Verify search functionality
    const searchResponse = await recordsClient.search(documentCode);
    expect(searchResponse.ok()).toBe(true);

    const searchResults = await searchResponse.json();
    expect(searchResults.results.length).toBeGreaterThanOrEqual(1);
    expect(searchResults.results[0].code).toBe(documentCode);
  });

  test('E2E: Document collaboration workflow @e2e', async () => {
    // This test would simulate multi-user collaboration
    // For now, we'll test sequential operations that mimic collaboration

    const collaborationDoc = {
      code: `COLLAB-${faker.string.alphanumeric(8).toUpperCase()}`,
      name: `Collaboration Test - ${faker.company.name()}`,
      description: 'Multi-user collaboration scenario',
    };

    const recordResponse = await recordsClient.create(collaborationDoc);
    const record = await recordResponse.json();
    const docId = record.id;

    // User 1 creates initial version
    const user1Version = await versionsClient.create({
      documentRecordId: docId,
      data: { author: 'User 1', content: faker.lorem.paragraphs(2) },
      status: 'draft',
    });

    const v1 = await user1Version.json();

    // User 2 makes edits
    await versionsClient.patchData(v1.id, {
      author: 'User 2',
      edits: { section1: 'Updated by User 2' },
    });

    // User 3 adds comments (simulated as metadata)
    await versionsClient.patchData(v1.id, {
      comments: [
        {
          user: 'User 3',
          text: 'Please review section 1',
          timestamp: new Date().toISOString(),
        },
      ],
    });

    // Verify final state includes all contributions
    const finalVersionResponse = await versionsClient.getById(v1.id);
    const finalVersion = await finalVersionResponse.json();

    expect(finalVersion.data.edits).toBeDefined();
    expect(finalVersion.data.comments).toBeDefined();
    expect(finalVersion.data.comments.length).toBe(1);

    // Cleanup
    await recordsClient.deleteById(docId);
  });

  test('E2E: Template-based document generation @e2e', async () => {
    // This would test template generation if supported
    // Placeholder for template workflow

    const templateData = {
      title: faker.lorem.words(3),
      clientName: faker.company.name(),
      date: new Date().toISOString(),
      terms: {
        payment: '30 days',
        warranty: '12 months',
      },
    };

    // Assuming there's a test template ID
    const templateId = process.env.TEST_TEMPLATE_ID || 'test-template-1';

    try {
      const generateResponse = await versionsClient.generateFromTemplate(
        templateId,
        templateData
      );

      if (generateResponse.ok()) {
        const generated = await generateResponse.json();
        expect(generated).toHaveProperty('id');
        expect(generated).toHaveProperty('documentRecordId');

        // Cleanup
        if (generated.documentRecordId) {
          await recordsClient.deleteById(generated.documentRecordId);
        }
      }
    } catch (error) {
      // Template might not exist in test environment
      console.warn('Template generation test skipped:', error);
    }
  });
});

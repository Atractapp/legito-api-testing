import { faker } from '@faker-js/faker';
import { DocumentRecord } from '@api/endpoints/document-records.client';
import { DocumentVersion } from '@api/endpoints/document-versions.client';

/**
 * Factory for creating test document records
 */
export class DocumentFactory {
  /**
   * Create a basic document record
   */
  static createDocumentRecord(overrides?: Partial<DocumentRecord>): DocumentRecord {
    return {
      code: `DOC-${faker.string.alphanumeric(10).toUpperCase()}`,
      name: faker.company.catchPhrase(),
      description: faker.lorem.sentence(),
      metadata: {
        category: faker.helpers.arrayElement(['legal', 'contract', 'policy', 'agreement']),
        department: faker.commerce.department(),
        createdBy: faker.person.fullName(),
      },
      tags: faker.helpers.arrayElements(
        ['draft', 'review', 'approved', 'archived', 'urgent'],
        { min: 1, max: 3 }
      ),
      ...overrides,
    };
  }

  /**
   * Create a legal contract document
   */
  static createLegalContract(overrides?: Partial<DocumentRecord>): DocumentRecord {
    return this.createDocumentRecord({
      code: `CONTRACT-${faker.string.alphanumeric(8).toUpperCase()}`,
      name: `${faker.company.name()} Service Agreement`,
      description: 'Legal service agreement between parties',
      metadata: {
        category: 'contract',
        documentType: 'service-agreement',
        jurisdiction: faker.location.country(),
        effectiveDate: faker.date.future().toISOString(),
      },
      tags: ['legal', 'contract', 'binding'],
      ...overrides,
    });
  }

  /**
   * Create an NDA document
   */
  static createNDA(overrides?: Partial<DocumentRecord>): DocumentRecord {
    return this.createDocumentRecord({
      code: `NDA-${faker.string.alphanumeric(8).toUpperCase()}`,
      name: `NDA - ${faker.company.name()}`,
      description: 'Non-Disclosure Agreement',
      metadata: {
        category: 'legal',
        documentType: 'nda',
        confidentialityPeriod: '2 years',
        parties: [faker.company.name(), faker.company.name()],
      },
      tags: ['legal', 'nda', 'confidential'],
      ...overrides,
    });
  }

  /**
   * Create a policy document
   */
  static createPolicy(overrides?: Partial<DocumentRecord>): DocumentRecord {
    return this.createDocumentRecord({
      code: `POLICY-${faker.string.alphanumeric(8).toUpperCase()}`,
      name: `${faker.company.buzzNoun()} Policy`,
      description: 'Corporate policy document',
      metadata: {
        category: 'policy',
        documentType: 'corporate-policy',
        department: faker.commerce.department(),
        reviewCycle: 'annual',
      },
      tags: ['policy', 'corporate', 'internal'],
      ...overrides,
    });
  }

  /**
   * Create multiple documents
   */
  static createMultipleDocuments(
    count: number,
    overrides?: Partial<DocumentRecord>
  ): DocumentRecord[] {
    return Array.from({ length: count }, () => this.createDocumentRecord(overrides));
  }

  /**
   * Create a document with specific tags
   */
  static createWithTags(
    tags: string[],
    overrides?: Partial<DocumentRecord>
  ): DocumentRecord {
    return this.createDocumentRecord({ tags, ...overrides });
  }
}

/**
 * Factory for creating test document versions
 */
export class DocumentVersionFactory {
  /**
   * Create a basic document version
   */
  static createVersion(
    documentRecordId: string,
    overrides?: Partial<DocumentVersion>
  ): DocumentVersion {
    return {
      documentRecordId,
      data: this.generateVersionData(),
      status: 'draft',
      ...overrides,
    };
  }

  /**
   * Create a draft version
   */
  static createDraft(
    documentRecordId: string,
    overrides?: Partial<DocumentVersion>
  ): DocumentVersion {
    return this.createVersion(documentRecordId, {
      status: 'draft',
      data: {
        ...this.generateVersionData(),
        isDraft: true,
        lastModified: new Date().toISOString(),
      },
      ...overrides,
    });
  }

  /**
   * Create a published version
   */
  static createPublished(
    documentRecordId: string,
    overrides?: Partial<DocumentVersion>
  ): DocumentVersion {
    return this.createVersion(documentRecordId, {
      status: 'published',
      data: {
        ...this.generateVersionData(),
        publishedAt: new Date().toISOString(),
        publishedBy: faker.person.fullName(),
      },
      ...overrides,
    });
  }

  /**
   * Create an archived version
   */
  static createArchived(
    documentRecordId: string,
    overrides?: Partial<DocumentVersion>
  ): DocumentVersion {
    return this.createVersion(documentRecordId, {
      status: 'archived',
      data: {
        ...this.generateVersionData(),
        archivedAt: new Date().toISOString(),
        archivedBy: faker.person.fullName(),
        archiveReason: 'Superseded by newer version',
      },
      ...overrides,
    });
  }

  /**
   * Generate realistic version data
   */
  static generateVersionData(): Record<string, any> {
    return {
      title: faker.lorem.words(5),
      content: faker.lorem.paragraphs(3),
      sections: this.generateSections(),
      metadata: {
        author: faker.person.fullName(),
        createdAt: new Date().toISOString(),
        wordCount: faker.number.int({ min: 500, max: 5000 }),
        language: 'en',
      },
    };
  }

  /**
   * Generate document sections
   */
  static generateSections(count: number = 3): Array<{ title: string; content: string }> {
    return Array.from({ length: count }, () => ({
      title: faker.lorem.words(3),
      content: faker.lorem.paragraphs(2),
    }));
  }

  /**
   * Generate contract-specific data
   */
  static generateContractData(): Record<string, any> {
    return {
      title: 'Service Agreement',
      parties: {
        party1: {
          name: faker.company.name(),
          address: faker.location.streetAddress(),
          representative: faker.person.fullName(),
        },
        party2: {
          name: faker.company.name(),
          address: faker.location.streetAddress(),
          representative: faker.person.fullName(),
        },
      },
      terms: {
        effectiveDate: faker.date.future().toISOString(),
        duration: `${faker.number.int({ min: 6, max: 36 })} months`,
        renewalTerms: 'Auto-renewal unless terminated',
        paymentTerms: {
          amount: parseFloat(faker.finance.amount()),
          currency: 'USD',
          schedule: 'monthly',
          dueDate: 'Last day of month',
        },
      },
      clauses: [
        { section: 'Services', content: faker.lorem.paragraph() },
        { section: 'Payment', content: faker.lorem.paragraph() },
        { section: 'Termination', content: faker.lorem.paragraph() },
        { section: 'Liability', content: faker.lorem.paragraph() },
        { section: 'Confidentiality', content: faker.lorem.paragraph() },
      ],
      signatures: {
        party1: { signed: false, date: null },
        party2: { signed: false, date: null },
      },
    };
  }

  /**
   * Create multiple versions for a document
   */
  static createMultipleVersions(
    documentRecordId: string,
    count: number
  ): DocumentVersion[] {
    return Array.from({ length: count }, (_, index) =>
      this.createVersion(documentRecordId, {
        versionNumber: index + 1,
        status: index === count - 1 ? 'published' : 'archived',
      })
    );
  }
}

/**
 * Test data builder for complex scenarios
 */
export class TestDataBuilder {
  /**
   * Build a complete document with versions
   */
  static buildDocumentWithVersions(versionCount: number = 3): {
    document: DocumentRecord;
    versions: DocumentVersion[];
  } {
    const document = DocumentFactory.createDocumentRecord();

    // Simulate document ID for version creation
    const mockDocumentId = faker.string.uuid();

    const versions = DocumentVersionFactory.createMultipleVersions(
      mockDocumentId,
      versionCount
    );

    return { document, versions };
  }

  /**
   * Build a workflow scenario
   */
  static buildWorkflowScenario(): {
    document: DocumentRecord;
    draft: DocumentVersion;
    revisions: DocumentVersion[];
    published: DocumentVersion;
  } {
    const document = DocumentFactory.createLegalContract();
    const mockDocumentId = faker.string.uuid();

    const draft = DocumentVersionFactory.createDraft(mockDocumentId);
    const revisions = [
      DocumentVersionFactory.createDraft(mockDocumentId),
      DocumentVersionFactory.createDraft(mockDocumentId),
    ];
    const published = DocumentVersionFactory.createPublished(mockDocumentId);

    return { document, draft, revisions, published };
  }

  /**
   * Build test data for performance testing
   */
  static buildBulkTestData(documentCount: number): DocumentRecord[] {
    return DocumentFactory.createMultipleDocuments(documentCount);
  }
}

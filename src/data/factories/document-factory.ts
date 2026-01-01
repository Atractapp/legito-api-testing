/**
 * Document Factory
 *
 * Factory for creating document test data with various traits
 * for different testing scenarios.
 */

import { BaseFactory, FactoryContext } from './base-factory';

/**
 * Document data structure matching Legito API v7
 */
export interface DocumentData {
  name: string;
  description?: string;
  templateId?: string;
  templateSuiteId?: string;
  folderId?: string;
  status: DocumentStatus;
  metadata?: Record<string, unknown>;
  tags?: string[];
  locale?: string;
  expiresAt?: string;
}

export type DocumentStatus = 'draft' | 'pending' | 'approved' | 'published' | 'archived';

/**
 * Created document result from API
 */
export interface DocumentResult extends DocumentData {
  id: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  version: number;
}

/**
 * API client interface (to be injected)
 */
export interface DocumentApiClient {
  createDocument(data: DocumentData): Promise<DocumentResult>;
  deleteDocument(id: string): Promise<void>;
}

/**
 * Document Factory class
 */
export class DocumentFactory extends BaseFactory<DocumentData, DocumentResult> {
  private apiClient: DocumentApiClient;

  constructor(context: FactoryContext, apiClient: DocumentApiClient) {
    super(context);
    this.apiClient = apiClient;
  }

  protected getResourceType(): string {
    return 'documents';
  }

  protected getDefaults(): DocumentData {
    return {
      name: this.uniqueName('document'),
      description: `Test document created by automated tests`,
      status: 'draft',
      metadata: {},
      tags: ['test', 'automated'],
      locale: 'en-US',
    };
  }

  protected registerTraits(): void {
    // Status traits
    this.trait('draft', () => ({ status: 'draft' as DocumentStatus }));
    this.trait('pending', () => ({ status: 'pending' as DocumentStatus }));
    this.trait('approved', () => ({ status: 'approved' as DocumentStatus }));
    this.trait('published', () => ({ status: 'published' as DocumentStatus }));
    this.trait('archived', () => ({ status: 'archived' as DocumentStatus }));

    // Content traits
    this.trait('with_description', () => ({
      description: `Detailed description for ${this.uniqueName('doc')}`,
    }));

    this.trait('minimal', () => ({
      description: undefined,
      metadata: undefined,
      tags: undefined,
    }));

    // Expiration traits
    this.trait('expiring_soon', () => ({
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 1 day
    }));

    this.trait('expired', () => ({
      expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // yesterday
    }));

    // Locale traits
    this.trait('german', () => ({ locale: 'de-DE' }));
    this.trait('french', () => ({ locale: 'fr-FR' }));
    this.trait('spanish', () => ({ locale: 'es-ES' }));

    // Tagged traits
    this.trait('important', () => ({
      tags: ['test', 'automated', 'important', 'priority'],
    }));

    this.trait('review_required', () => ({
      tags: ['test', 'automated', 'review-required'],
      metadata: { requiresReview: true },
    }));
  }

  protected async createViaApi(data: DocumentData): Promise<DocumentResult> {
    return this.apiClient.createDocument(data);
  }

  protected async deleteViaApi(id: string): Promise<void> {
    return this.apiClient.deleteDocument(id);
  }

  protected extractId(result: DocumentResult): string {
    return result.id;
  }

  // Fluent builder methods

  /**
   * Set document name
   */
  withName(name: string): DocumentFactoryBuilder {
    return new DocumentFactoryBuilder(this).withName(name);
  }

  /**
   * Set template ID
   */
  withTemplate(templateId: string): DocumentFactoryBuilder {
    return new DocumentFactoryBuilder(this).withTemplate(templateId);
  }

  /**
   * Set folder ID
   */
  inFolder(folderId: string): DocumentFactoryBuilder {
    return new DocumentFactoryBuilder(this).inFolder(folderId);
  }

  /**
   * Set as draft
   */
  asDraft(): DocumentFactoryBuilder {
    return new DocumentFactoryBuilder(this).asDraft();
  }

  /**
   * Set as published
   */
  asPublished(): DocumentFactoryBuilder {
    return new DocumentFactoryBuilder(this).asPublished();
  }
}

/**
 * Fluent builder for document factory
 */
class DocumentFactoryBuilder {
  private factory: DocumentFactory;
  private overrides: Partial<DocumentData> = {};
  private traitNames: string[] = [];

  constructor(factory: DocumentFactory) {
    this.factory = factory;
  }

  withName(name: string): this {
    this.overrides.name = name;
    return this;
  }

  withDescription(description: string): this {
    this.overrides.description = description;
    return this;
  }

  withTemplate(templateId: string): this {
    this.overrides.templateId = templateId;
    return this;
  }

  withTemplateSuite(templateSuiteId: string): this {
    this.overrides.templateSuiteId = templateSuiteId;
    return this;
  }

  inFolder(folderId: string): this {
    this.overrides.folderId = folderId;
    return this;
  }

  withStatus(status: DocumentStatus): this {
    this.overrides.status = status;
    return this;
  }

  withMetadata(metadata: Record<string, unknown>): this {
    this.overrides.metadata = metadata;
    return this;
  }

  withTags(tags: string[]): this {
    this.overrides.tags = tags;
    return this;
  }

  withLocale(locale: string): this {
    this.overrides.locale = locale;
    return this;
  }

  expiringAt(date: Date | string): this {
    this.overrides.expiresAt = typeof date === 'string' ? date : date.toISOString();
    return this;
  }

  asDraft(): this {
    this.traitNames.push('draft');
    return this;
  }

  asPending(): this {
    this.traitNames.push('pending');
    return this;
  }

  asApproved(): this {
    this.traitNames.push('approved');
    return this;
  }

  asPublished(): this {
    this.traitNames.push('published');
    return this;
  }

  asArchived(): this {
    this.traitNames.push('archived');
    return this;
  }

  asMinimal(): this {
    this.traitNames.push('minimal');
    return this;
  }

  /**
   * Build in-memory document data
   */
  build(): DocumentData {
    return this.factory.build({
      overrides: this.overrides,
      traits: this.traitNames,
    });
  }

  /**
   * Create document via API
   */
  async create(): Promise<DocumentResult> {
    return this.factory.create({
      overrides: this.overrides,
      traits: this.traitNames,
    });
  }
}

export default DocumentFactory;

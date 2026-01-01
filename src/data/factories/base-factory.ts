/**
 * Base Factory for Test Data Generation
 *
 * Abstract factory pattern providing consistent interface for
 * creating test data with support for both in-memory and API creation.
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Factory build options
 */
export interface FactoryBuildOptions<T> {
  overrides?: Partial<T>;
  traits?: string[];
  sequence?: number;
}

/**
 * Factory create options (for API creation)
 */
export interface FactoryCreateOptions<T> extends FactoryBuildOptions<T> {
  cleanup?: boolean;  // Whether to register for cleanup (default: true)
}

/**
 * Trait definition
 */
export type TraitFn<T> = (data: T) => Partial<T>;

/**
 * Sequence generator function
 */
export type SequenceFn<R> = (n: number) => R;

/**
 * Resource cleanup callback
 */
export type CleanupCallback = () => Promise<void>;

/**
 * Context for factory operations
 */
export interface FactoryContext {
  prefix: string;
  registerCleanup: (resourceType: string, id: string, cleanup: CleanupCallback) => void;
  getSequence: (name: string) => number;
}

/**
 * Abstract Base Factory class
 */
export abstract class BaseFactory<T, CreateResult = T> {
  protected context: FactoryContext;
  protected traits: Map<string, TraitFn<T>> = new Map();
  protected sequences: Map<string, number> = new Map();

  constructor(context: FactoryContext) {
    this.context = context;
    this.registerTraits();
  }

  /**
   * Override to define the default attributes for the entity
   */
  protected abstract getDefaults(): T;

  /**
   * Override to register traits
   */
  protected registerTraits(): void {
    // Subclasses can override to register traits
  }

  /**
   * Override to define the resource type for cleanup
   */
  protected abstract getResourceType(): string;

  /**
   * Override to define how to create the entity via API
   */
  protected abstract createViaApi(data: T): Promise<CreateResult>;

  /**
   * Override to define how to delete the entity via API
   */
  protected abstract deleteViaApi(id: string): Promise<void>;

  /**
   * Override to extract ID from created result
   */
  protected abstract extractId(result: CreateResult): string;

  /**
   * Register a trait
   */
  protected trait(name: string, fn: TraitFn<T>): void {
    this.traits.set(name, fn);
  }

  /**
   * Get next sequence value
   */
  protected sequence(name: string = 'default'): number {
    const current = this.sequences.get(name) ?? 0;
    const next = current + 1;
    this.sequences.set(name, next);
    return next;
  }

  /**
   * Generate a unique prefixed name
   */
  protected uniqueName(base: string): string {
    const seq = this.sequence('name');
    return `${this.context.prefix}_${base}_${seq}`;
  }

  /**
   * Generate a unique prefixed ID
   */
  protected uniqueId(): string {
    return `${this.context.prefix}_${uuidv4().slice(0, 8)}`;
  }

  /**
   * Build an entity in memory (no API call)
   */
  build(options: FactoryBuildOptions<T> = {}): T {
    let data = { ...this.getDefaults() };

    // Apply traits
    if (options.traits) {
      for (const traitName of options.traits) {
        const traitFn = this.traits.get(traitName);
        if (traitFn) {
          data = { ...data, ...traitFn(data) };
        }
      }
    }

    // Apply overrides
    if (options.overrides) {
      data = { ...data, ...options.overrides };
    }

    return data;
  }

  /**
   * Build multiple entities in memory
   */
  buildMany(count: number, options: FactoryBuildOptions<T> = {}): T[] {
    return Array.from({ length: count }, (_, i) =>
      this.build({ ...options, sequence: i + 1 })
    );
  }

  /**
   * Create an entity via API
   */
  async create(options: FactoryCreateOptions<T> = {}): Promise<CreateResult> {
    const data = this.build(options);
    const result = await this.createViaApi(data);
    const id = this.extractId(result);

    // Register for cleanup unless explicitly disabled
    if (options.cleanup !== false) {
      this.context.registerCleanup(
        this.getResourceType(),
        id,
        () => this.deleteViaApi(id)
      );
    }

    return result;
  }

  /**
   * Create multiple entities via API
   */
  async createMany(
    count: number,
    options: FactoryCreateOptions<T> = {}
  ): Promise<CreateResult[]> {
    const results: CreateResult[] = [];
    for (let i = 0; i < count; i++) {
      const result = await this.create({ ...options, sequence: i + 1 });
      results.push(result);
    }
    return results;
  }

  /**
   * Create an entity with specific trait(s)
   */
  async createWith(
    traits: string | string[],
    overrides?: Partial<T>
  ): Promise<CreateResult> {
    const traitArray = Array.isArray(traits) ? traits : [traits];
    return this.create({ traits: traitArray, overrides });
  }

  /**
   * Reset sequences
   */
  resetSequences(): void {
    this.sequences.clear();
  }

  /**
   * Get the current context prefix
   */
  getPrefix(): string {
    return this.context.prefix;
  }
}

/**
 * Simple factory context implementation for testing
 */
export class SimpleFactoryContext implements FactoryContext {
  prefix: string;
  private cleanupRegistry: Map<string, Map<string, CleanupCallback>> = new Map();
  private globalSequences: Map<string, number> = new Map();

  constructor(prefix?: string) {
    this.prefix = prefix ?? `test_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  }

  registerCleanup(resourceType: string, id: string, cleanup: CleanupCallback): void {
    if (!this.cleanupRegistry.has(resourceType)) {
      this.cleanupRegistry.set(resourceType, new Map());
    }
    this.cleanupRegistry.get(resourceType)!.set(id, cleanup);
  }

  getSequence(name: string): number {
    const current = this.globalSequences.get(name) ?? 0;
    const next = current + 1;
    this.globalSequences.set(name, next);
    return next;
  }

  async cleanup(): Promise<void> {
    // Cleanup in reverse order of resource type priority
    const cleanupOrder = [
      'shares',
      'document_versions',
      'documents',
      'templates',
      'template_suites',
      'users',
      'user_groups',
      'workflows',
    ];

    for (const resourceType of cleanupOrder) {
      const resources = this.cleanupRegistry.get(resourceType);
      if (resources) {
        for (const [id, cleanupFn] of resources.entries()) {
          try {
            await cleanupFn();
          } catch (error) {
            console.warn(`Failed to cleanup ${resourceType} ${id}:`, error);
          }
        }
        resources.clear();
      }
    }
  }

  getRegisteredResources(): Map<string, string[]> {
    const result = new Map<string, string[]>();
    for (const [type, resources] of this.cleanupRegistry.entries()) {
      result.set(type, Array.from(resources.keys()));
    }
    return result;
  }
}

export default BaseFactory;

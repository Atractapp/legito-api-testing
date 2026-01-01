/**
 * Isolation Manager
 *
 * Manages test data isolation through unique prefixing and
 * namespace management to prevent test interference.
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Isolation level determining scope of isolation
 */
export type IsolationLevel =
  | 'none'      // No isolation - shared state
  | 'test'      // Each test is isolated
  | 'suite'     // Tests in same suite share state
  | 'worker'    // Tests in same worker share state
  | 'run';      // All tests in run share state

/**
 * Isolation manager configuration
 */
export interface IsolationManagerConfig {
  prefix: string;
  level: IsolationLevel;
  nameSeparator?: string;
  maxNameLength?: number;
}

/**
 * Namespace definition
 */
export interface Namespace {
  id: string;
  prefix: string;
  level: IsolationLevel;
  createdAt: Date;
  resourceCount: number;
}

/**
 * Isolation Manager class
 */
export class IsolationManager {
  private readonly prefix: string;
  private readonly level: IsolationLevel;
  private readonly nameSeparator: string;
  private readonly maxNameLength: number;

  private sequences: Map<string, number> = new Map();
  private namespaces: Map<string, Namespace> = new Map();

  constructor(prefix: string, level: IsolationLevel, options: Partial<IsolationManagerConfig> = {}) {
    this.prefix = prefix;
    this.level = level;
    this.nameSeparator = options.nameSeparator ?? '_';
    this.maxNameLength = options.maxNameLength ?? 64;

    // Create default namespace
    this.createNamespace('default');
  }

  /**
   * Create a new namespace
   */
  createNamespace(name: string): Namespace {
    const namespace: Namespace = {
      id: `${this.prefix}${this.nameSeparator}${name}`,
      prefix: this.prefix,
      level: this.level,
      createdAt: new Date(),
      resourceCount: 0,
    };

    this.namespaces.set(name, namespace);
    return namespace;
  }

  /**
   * Get or create a namespace
   */
  getNamespace(name: string = 'default'): Namespace {
    let namespace = this.namespaces.get(name);
    if (!namespace) {
      namespace = this.createNamespace(name);
    }
    return namespace;
  }

  /**
   * Generate a unique name for a resource
   */
  generateUniqueName(base: string, namespace: string = 'default'): string {
    const ns = this.getNamespace(namespace);
    const sequence = this.getNextSequence(base);
    ns.resourceCount++;

    const sanitizedBase = this.sanitizeName(base);
    const uniquePart = `${sequence}`;

    // Construct name: prefix_base_sequence
    let name = `${this.prefix}${this.nameSeparator}${sanitizedBase}${this.nameSeparator}${uniquePart}`;

    // Truncate if too long
    if (name.length > this.maxNameLength) {
      const overflow = name.length - this.maxNameLength;
      const truncatedBase = sanitizedBase.slice(0, Math.max(1, sanitizedBase.length - overflow));
      name = `${this.prefix}${this.nameSeparator}${truncatedBase}${this.nameSeparator}${uniquePart}`;
    }

    return name;
  }

  /**
   * Generate a unique ID
   */
  generateUniqueId(): string {
    const uuid = uuidv4().replace(/-/g, '').slice(0, 12);
    return `${this.prefix}${this.nameSeparator}${uuid}`;
  }

  /**
   * Generate a short unique ID (8 characters)
   */
  generateShortId(): string {
    const uuid = uuidv4().replace(/-/g, '').slice(0, 8);
    return uuid;
  }

  /**
   * Get next sequence number for a key
   */
  private getNextSequence(key: string): number {
    const current = this.sequences.get(key) ?? 0;
    const next = current + 1;
    this.sequences.set(key, next);
    return next;
  }

  /**
   * Sanitize a name for use in identifiers
   */
  private sanitizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, this.nameSeparator)
      .replace(new RegExp(`${this.nameSeparator}+`, 'g'), this.nameSeparator)
      .replace(new RegExp(`^${this.nameSeparator}|${this.nameSeparator}$`, 'g'), '')
      .slice(0, 32);
  }

  /**
   * Check if a name belongs to this isolation context
   */
  belongsToContext(name: string): boolean {
    return name.startsWith(this.prefix + this.nameSeparator);
  }

  /**
   * Extract the base name from an isolated name
   */
  extractBaseName(isolatedName: string): string | null {
    if (!this.belongsToContext(isolatedName)) {
      return null;
    }

    const parts = isolatedName.split(this.nameSeparator);
    // Remove prefix and sequence (first and last parts)
    if (parts.length >= 3) {
      return parts.slice(1, -1).join(this.nameSeparator);
    }
    return null;
  }

  /**
   * Get the current prefix
   */
  getPrefix(): string {
    return this.prefix;
  }

  /**
   * Get the isolation level
   */
  getLevel(): IsolationLevel {
    return this.level;
  }

  /**
   * Get all namespaces
   */
  getNamespaces(): Map<string, Namespace> {
    return new Map(this.namespaces);
  }

  /**
   * Get sequence statistics
   */
  getSequenceStats(): Record<string, number> {
    return Object.fromEntries(this.sequences);
  }

  /**
   * Reset sequences (useful between test runs)
   */
  resetSequences(): void {
    this.sequences.clear();
  }

  /**
   * Create a filter pattern for database queries
   * Returns a pattern that matches resources created by this context
   */
  createFilterPattern(): string {
    return `${this.prefix}${this.nameSeparator}%`;
  }

  /**
   * Create a regex pattern for matching isolated names
   */
  createRegexPattern(): RegExp {
    const escapedPrefix = this.prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedSep = this.nameSeparator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`^${escapedPrefix}${escapedSep}`);
  }
}

/**
 * Isolation level hierarchy for determining if contexts can share state
 */
const ISOLATION_HIERARCHY: Record<IsolationLevel, number> = {
  none: 0,
  run: 1,
  worker: 2,
  suite: 3,
  test: 4,
};

/**
 * Check if two isolation levels are compatible (can share state)
 */
export function canShareState(level1: IsolationLevel, level2: IsolationLevel): boolean {
  return ISOLATION_HIERARCHY[level1] <= ISOLATION_HIERARCHY[level2];
}

/**
 * Get the more restrictive isolation level
 */
export function getStricterLevel(level1: IsolationLevel, level2: IsolationLevel): IsolationLevel {
  return ISOLATION_HIERARCHY[level1] >= ISOLATION_HIERARCHY[level2] ? level1 : level2;
}

export default IsolationManager;

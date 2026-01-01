/**
 * Fixture Loader
 *
 * Manages loading, caching, and lifecycle of test fixtures.
 * Supports both static JSON fixtures and dynamically generated fixtures.
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Fixture metadata
 */
export interface FixtureMeta {
  name: string;
  type: 'static' | 'dynamic';
  path?: string;
  loadedAt?: Date;
  dependencies?: string[];
}

/**
 * Fixture set containing related fixtures
 */
export interface FixtureSet<T = unknown> {
  meta: FixtureMeta;
  data: T;
}

/**
 * Dynamic fixture generator function
 */
export type FixtureGenerator<T> = (context: FixtureContext) => T | Promise<T>;

/**
 * Context passed to dynamic fixture generators
 */
export interface FixtureContext {
  prefix: string;
  timestamp: number;
  getFixture: <T>(name: string) => Promise<T>;
}

/**
 * Fixture loader configuration
 */
export interface FixtureLoaderConfig {
  staticFixturesPath: string;
  cacheEnabled?: boolean;
  prefix?: string;
}

/**
 * Fixture Loader class
 */
export class FixtureLoader {
  private readonly staticPath: string;
  private readonly cacheEnabled: boolean;
  private readonly prefix: string;

  // Caches
  private staticCache: Map<string, FixtureSet> = new Map();
  private dynamicGenerators: Map<string, FixtureGenerator<unknown>> = new Map();
  private dynamicCache: Map<string, FixtureSet> = new Map();

  constructor(config: FixtureLoaderConfig) {
    this.staticPath = config.staticFixturesPath;
    this.cacheEnabled = config.cacheEnabled ?? true;
    this.prefix = config.prefix ?? `fixture_${Date.now()}`;
  }

  /**
   * Load a static fixture from JSON file
   */
  async loadStatic<T>(
    category: string,
    name: string,
    options: { cache?: boolean } = {}
  ): Promise<FixtureSet<T>> {
    const cacheKey = `${category}/${name}`;

    // Check cache first
    if (this.cacheEnabled && options.cache !== false) {
      const cached = this.staticCache.get(cacheKey);
      if (cached) {
        return cached as FixtureSet<T>;
      }
    }

    // Build file path
    const filePath = path.join(this.staticPath, category, `${name}.json`);

    // Load file
    if (!fs.existsSync(filePath)) {
      throw new Error(`Fixture not found: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content) as T;

    const fixture: FixtureSet<T> = {
      meta: {
        name: cacheKey,
        type: 'static',
        path: filePath,
        loadedAt: new Date(),
      },
      data,
    };

    // Cache if enabled
    if (this.cacheEnabled && options.cache !== false) {
      this.staticCache.set(cacheKey, fixture);
    }

    return fixture;
  }

  /**
   * Load multiple static fixtures from a category
   */
  async loadStaticCategory<T>(category: string): Promise<Map<string, FixtureSet<T>>> {
    const categoryPath = path.join(this.staticPath, category);

    if (!fs.existsSync(categoryPath)) {
      throw new Error(`Fixture category not found: ${categoryPath}`);
    }

    const files = fs.readdirSync(categoryPath).filter((f) => f.endsWith('.json'));
    const fixtures = new Map<string, FixtureSet<T>>();

    for (const file of files) {
      const name = file.replace('.json', '');
      const fixture = await this.loadStatic<T>(category, name);
      fixtures.set(name, fixture);
    }

    return fixtures;
  }

  /**
   * Register a dynamic fixture generator
   */
  registerDynamic<T>(name: string, generator: FixtureGenerator<T>): void {
    this.dynamicGenerators.set(name, generator as FixtureGenerator<unknown>);
  }

  /**
   * Generate a dynamic fixture
   */
  async generateDynamic<T>(
    name: string,
    options: { cache?: boolean; forceRegenerate?: boolean } = {}
  ): Promise<FixtureSet<T>> {
    // Check cache first (unless force regenerate)
    if (this.cacheEnabled && options.cache !== false && !options.forceRegenerate) {
      const cached = this.dynamicCache.get(name);
      if (cached) {
        return cached as FixtureSet<T>;
      }
    }

    const generator = this.dynamicGenerators.get(name);
    if (!generator) {
      throw new Error(`Dynamic fixture generator not found: ${name}`);
    }

    const context: FixtureContext = {
      prefix: this.prefix,
      timestamp: Date.now(),
      getFixture: async <U>(depName: string) => {
        const dep = await this.get<U>(depName);
        return dep.data;
      },
    };

    const data = (await generator(context)) as T;

    const fixture: FixtureSet<T> = {
      meta: {
        name,
        type: 'dynamic',
        loadedAt: new Date(),
      },
      data,
    };

    // Cache if enabled
    if (this.cacheEnabled && options.cache !== false) {
      this.dynamicCache.set(name, fixture);
    }

    return fixture;
  }

  /**
   * Get a fixture (static or dynamic)
   * Static fixtures use format: "category/name"
   * Dynamic fixtures use format: "dynamic:name"
   */
  async get<T>(identifier: string): Promise<FixtureSet<T>> {
    if (identifier.startsWith('dynamic:')) {
      const name = identifier.substring(8);
      return this.generateDynamic<T>(name);
    }

    const [category, name] = identifier.split('/');
    if (!category || !name) {
      throw new Error(`Invalid fixture identifier: ${identifier}. Use "category/name" format.`);
    }

    return this.loadStatic<T>(category, name);
  }

  /**
   * Preload multiple fixtures
   */
  async preload(identifiers: string[]): Promise<void> {
    await Promise.all(identifiers.map((id) => this.get(id)));
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.staticCache.clear();
    this.dynamicCache.clear();
  }

  /**
   * Clear specific cache entries
   */
  clearCacheEntry(identifier: string): void {
    if (identifier.startsWith('dynamic:')) {
      this.dynamicCache.delete(identifier.substring(8));
    } else {
      this.staticCache.delete(identifier);
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): FixtureCacheStats {
    return {
      staticCount: this.staticCache.size,
      dynamicCount: this.dynamicCache.size,
      dynamicGeneratorCount: this.dynamicGenerators.size,
    };
  }

  /**
   * List available static fixtures
   */
  listStaticFixtures(): string[] {
    const fixtures: string[] = [];

    if (!fs.existsSync(this.staticPath)) {
      return fixtures;
    }

    const categories = fs.readdirSync(this.staticPath, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    for (const category of categories) {
      const categoryPath = path.join(this.staticPath, category);
      const files = fs.readdirSync(categoryPath)
        .filter((f) => f.endsWith('.json'))
        .map((f) => `${category}/${f.replace('.json', '')}`);
      fixtures.push(...files);
    }

    return fixtures;
  }

  /**
   * List registered dynamic generators
   */
  listDynamicGenerators(): string[] {
    return Array.from(this.dynamicGenerators.keys());
  }
}

export interface FixtureCacheStats {
  staticCount: number;
  dynamicCount: number;
  dynamicGeneratorCount: number;
}

/**
 * Create a fixture loader with common dynamic generators
 */
export function createFixtureLoader(config: FixtureLoaderConfig): FixtureLoader {
  const loader = new FixtureLoader(config);

  // Register common dynamic generators
  loader.registerDynamic('timestamp', (ctx) => ({
    iso: new Date().toISOString(),
    unix: ctx.timestamp,
    prefix: ctx.prefix,
  }));

  loader.registerDynamic('unique_ids', (ctx) => ({
    uuid: `${ctx.prefix}_${Math.random().toString(36).slice(2)}`,
    numeric: ctx.timestamp,
    prefixed: `${ctx.prefix}_id`,
  }));

  return loader;
}

export default FixtureLoader;

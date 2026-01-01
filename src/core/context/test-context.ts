/**
 * Test Context
 *
 * Provides isolated execution context for each test with resource tracking,
 * cleanup management, and unique prefixing for test data isolation.
 */

import { v4 as uuidv4 } from 'uuid';
import { CleanupTracker, CleanupPriority } from './cleanup-tracker';
import { IsolationManager, IsolationLevel } from './isolation-manager';

/**
 * Test context configuration
 */
export interface TestContextConfig {
  name: string;
  suite?: string;
  isolationLevel?: IsolationLevel;
  timeout?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Created resource tracking
 */
export interface TrackedResource {
  type: string;
  id: string;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Test context state
 */
export type TestContextState = 'created' | 'running' | 'completed' | 'failed' | 'cleaned';

/**
 * Test Context class
 */
export class TestContext {
  readonly contextId: string;
  readonly prefix: string;
  readonly name: string;
  readonly suite: string | undefined;
  readonly isolationLevel: IsolationLevel;
  readonly startTime: Date;
  readonly timeout: number;
  readonly metadata: Record<string, unknown>;

  private state: TestContextState = 'created';
  private cleanupTracker: CleanupTracker;
  private isolationManager: IsolationManager;
  private resources: Map<string, TrackedResource[]> = new Map();
  private errors: Error[] = [];
  private endTime: Date | null = null;

  private constructor(config: TestContextConfig) {
    this.contextId = uuidv4();
    this.prefix = this.generatePrefix(config.name, config.suite);
    this.name = config.name;
    this.suite = config.suite;
    this.isolationLevel = config.isolationLevel ?? 'test';
    this.startTime = new Date();
    this.timeout = config.timeout ?? 30000;
    this.metadata = config.metadata ?? {};

    this.cleanupTracker = new CleanupTracker();
    this.isolationManager = new IsolationManager(this.prefix, this.isolationLevel);
  }

  /**
   * Create a new test context
   */
  static async create(config: TestContextConfig | string): Promise<TestContext> {
    const normalizedConfig: TestContextConfig =
      typeof config === 'string' ? { name: config } : config;

    const context = new TestContext(normalizedConfig);
    context.state = 'running';

    return context;
  }

  /**
   * Generate a unique prefix for this context
   */
  private generatePrefix(name: string, suite?: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).slice(2, 6);
    const sanitizedName = name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase().slice(0, 20);
    const sanitizedSuite = suite
      ? suite.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase().slice(0, 10) + '_'
      : '';

    return `${sanitizedSuite}${sanitizedName}_${timestamp}_${random}`;
  }

  /**
   * Track a created resource for cleanup
   */
  trackResource(
    type: string,
    id: string,
    options: {
      priority?: CleanupPriority;
      cleanup?: () => Promise<void>;
      metadata?: Record<string, unknown>;
    } = {}
  ): void {
    // Add to resources map
    if (!this.resources.has(type)) {
      this.resources.set(type, []);
    }
    this.resources.get(type)!.push({
      type,
      id,
      createdAt: new Date(),
      metadata: options.metadata,
    });

    // Register cleanup if provided
    if (options.cleanup) {
      this.cleanupTracker.register(
        type,
        id,
        options.cleanup,
        options.priority
      );
    }
  }

  /**
   * Generate a unique name for a resource
   */
  uniqueName(base: string): string {
    return this.isolationManager.generateUniqueName(base);
  }

  /**
   * Generate a unique ID
   */
  uniqueId(): string {
    return this.isolationManager.generateUniqueId();
  }

  /**
   * Get resources by type
   */
  getResources(type: string): TrackedResource[] {
    return this.resources.get(type) ?? [];
  }

  /**
   * Get all tracked resources
   */
  getAllResources(): Map<string, TrackedResource[]> {
    return new Map(this.resources);
  }

  /**
   * Record an error
   */
  recordError(error: Error): void {
    this.errors.push(error);
    if (this.state === 'running') {
      this.state = 'failed';
    }
  }

  /**
   * Get recorded errors
   */
  getErrors(): Error[] {
    return [...this.errors];
  }

  /**
   * Mark context as completed
   */
  complete(): void {
    if (this.state === 'running') {
      this.state = 'completed';
    }
    this.endTime = new Date();
  }

  /**
   * Perform cleanup of all tracked resources
   */
  async cleanup(): Promise<CleanupResult> {
    const result = await this.cleanupTracker.cleanup();
    this.state = 'cleaned';
    return result;
  }

  /**
   * Get current state
   */
  getState(): TestContextState {
    return this.state;
  }

  /**
   * Get test duration in milliseconds
   */
  getDuration(): number {
    const end = this.endTime ?? new Date();
    return end.getTime() - this.startTime.getTime();
  }

  /**
   * Check if context has exceeded timeout
   */
  isTimedOut(): boolean {
    return this.getDuration() > this.timeout;
  }

  /**
   * Get context summary
   */
  getSummary(): TestContextSummary {
    const resourceCounts: Record<string, number> = {};
    for (const [type, resources] of this.resources.entries()) {
      resourceCounts[type] = resources.length;
    }

    return {
      contextId: this.contextId,
      prefix: this.prefix,
      name: this.name,
      suite: this.suite,
      state: this.state,
      isolationLevel: this.isolationLevel,
      startTime: this.startTime,
      endTime: this.endTime,
      durationMs: this.getDuration(),
      resourceCounts,
      errorCount: this.errors.length,
      timedOut: this.isTimedOut(),
    };
  }

  /**
   * Create a child context (for nested tests)
   */
  async createChild(name: string): Promise<TestContext> {
    return TestContext.create({
      name,
      suite: this.name,
      isolationLevel: this.isolationLevel,
      timeout: this.timeout,
      metadata: {
        ...this.metadata,
        parentContextId: this.contextId,
      },
    });
  }
}

/**
 * Cleanup result type
 */
export interface CleanupResult {
  success: boolean;
  cleanedCount: number;
  failedCount: number;
  failures: Array<{ type: string; id: string; error: Error }>;
  durationMs: number;
}

/**
 * Test context summary
 */
export interface TestContextSummary {
  contextId: string;
  prefix: string;
  name: string;
  suite: string | undefined;
  state: TestContextState;
  isolationLevel: IsolationLevel;
  startTime: Date;
  endTime: Date | null;
  durationMs: number;
  resourceCounts: Record<string, number>;
  errorCount: number;
  timedOut: boolean;
}

/**
 * Context provider for sharing context in tests
 */
export class TestContextProvider {
  private static contexts: Map<string, TestContext> = new Map();
  private static current: TestContext | null = null;

  /**
   * Create and register a context
   */
  static async create(config: TestContextConfig | string): Promise<TestContext> {
    const context = await TestContext.create(config);
    this.contexts.set(context.contextId, context);
    this.current = context;
    return context;
  }

  /**
   * Get the current context
   */
  static getCurrent(): TestContext | null {
    return this.current;
  }

  /**
   * Set the current context
   */
  static setCurrent(context: TestContext): void {
    this.current = context;
  }

  /**
   * Get a context by ID
   */
  static get(contextId: string): TestContext | undefined {
    return this.contexts.get(contextId);
  }

  /**
   * Cleanup a specific context
   */
  static async cleanup(contextId: string): Promise<CleanupResult | null> {
    const context = this.contexts.get(contextId);
    if (!context) {
      return null;
    }

    const result = await context.cleanup();
    this.contexts.delete(contextId);

    if (this.current?.contextId === contextId) {
      this.current = null;
    }

    return result;
  }

  /**
   * Cleanup all contexts
   */
  static async cleanupAll(): Promise<Map<string, CleanupResult>> {
    const results = new Map<string, CleanupResult>();

    for (const [id, context] of this.contexts.entries()) {
      try {
        const result = await context.cleanup();
        results.set(id, result);
      } catch (error) {
        results.set(id, {
          success: false,
          cleanedCount: 0,
          failedCount: 1,
          failures: [{ type: 'context', id, error: error as Error }],
          durationMs: 0,
        });
      }
    }

    this.contexts.clear();
    this.current = null;

    return results;
  }

  /**
   * Reset provider state
   */
  static reset(): void {
    this.contexts.clear();
    this.current = null;
  }
}

export default TestContext;

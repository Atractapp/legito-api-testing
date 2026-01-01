/**
 * Cleanup Tracker
 *
 * Manages cleanup of test resources in the correct order
 * based on dependencies and priorities.
 */

/**
 * Cleanup priority levels (higher number = cleaned first)
 */
export enum CleanupPriority {
  // External dependencies cleaned first
  SHARES = 100,
  PERMISSIONS = 90,

  // Child resources
  DOCUMENT_VERSIONS = 80,
  WORKFLOW_STEPS = 75,

  // Main resources
  DOCUMENTS = 60,
  TEMPLATES = 55,
  TEMPLATE_SUITES = 50,
  WORKFLOWS = 45,

  // User resources
  USERS = 30,
  USER_GROUPS = 25,

  // System resources (cleaned last)
  FILES = 20,
  CATEGORIES = 10,
  SYSTEM_DATA = 5,

  // Default priority
  DEFAULT = 50,
}

/**
 * Resource type to priority mapping
 */
const TYPE_PRIORITY_MAP: Record<string, CleanupPriority> = {
  shares: CleanupPriority.SHARES,
  permissions: CleanupPriority.PERMISSIONS,
  document_versions: CleanupPriority.DOCUMENT_VERSIONS,
  workflow_steps: CleanupPriority.WORKFLOW_STEPS,
  documents: CleanupPriority.DOCUMENTS,
  templates: CleanupPriority.TEMPLATES,
  template_suites: CleanupPriority.TEMPLATE_SUITES,
  workflows: CleanupPriority.WORKFLOWS,
  users: CleanupPriority.USERS,
  user_groups: CleanupPriority.USER_GROUPS,
  files: CleanupPriority.FILES,
  categories: CleanupPriority.CATEGORIES,
  system_data: CleanupPriority.SYSTEM_DATA,
};

/**
 * Cleanup task definition
 */
export interface CleanupTask {
  type: string;
  id: string;
  priority: number;
  cleanup: () => Promise<void>;
  registeredAt: Date;
  attempts: number;
  lastError?: Error;
}

/**
 * Cleanup result
 */
export interface CleanupResult {
  success: boolean;
  cleanedCount: number;
  failedCount: number;
  failures: Array<{ type: string; id: string; error: Error }>;
  durationMs: number;
}

/**
 * Cleanup Tracker class
 */
export class CleanupTracker {
  private tasks: Map<string, CleanupTask> = new Map();
  private maxRetries: number;
  private retryDelayMs: number;

  constructor(options: { maxRetries?: number; retryDelayMs?: number } = {}) {
    this.maxRetries = options.maxRetries ?? 3;
    this.retryDelayMs = options.retryDelayMs ?? 1000;
  }

  /**
   * Generate task key
   */
  private getTaskKey(type: string, id: string): string {
    return `${type}:${id}`;
  }

  /**
   * Get priority for a resource type
   */
  private getPriority(type: string, explicitPriority?: CleanupPriority): number {
    if (explicitPriority !== undefined) {
      return explicitPriority;
    }
    return TYPE_PRIORITY_MAP[type] ?? CleanupPriority.DEFAULT;
  }

  /**
   * Register a resource for cleanup
   */
  register(
    type: string,
    id: string,
    cleanup: () => Promise<void>,
    priority?: CleanupPriority
  ): void {
    const key = this.getTaskKey(type, id);

    // Don't overwrite existing cleanup task
    if (this.tasks.has(key)) {
      return;
    }

    this.tasks.set(key, {
      type,
      id,
      priority: this.getPriority(type, priority),
      cleanup,
      registeredAt: new Date(),
      attempts: 0,
    });
  }

  /**
   * Unregister a resource (if already cleaned externally)
   */
  unregister(type: string, id: string): boolean {
    const key = this.getTaskKey(type, id);
    return this.tasks.delete(key);
  }

  /**
   * Check if a resource is registered
   */
  isRegistered(type: string, id: string): boolean {
    return this.tasks.has(this.getTaskKey(type, id));
  }

  /**
   * Get all registered tasks
   */
  getTasks(): CleanupTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Get tasks sorted by priority (descending - highest priority first)
   */
  getSortedTasks(): CleanupTask[] {
    return this.getTasks().sort((a, b) => b.priority - a.priority);
  }

  /**
   * Get count of registered tasks
   */
  getCount(): number {
    return this.tasks.size;
  }

  /**
   * Perform cleanup of all registered resources
   */
  async cleanup(): Promise<CleanupResult> {
    const startTime = Date.now();
    const sortedTasks = this.getSortedTasks();
    const failures: Array<{ type: string; id: string; error: Error }> = [];
    let cleanedCount = 0;
    let failedCount = 0;

    for (const task of sortedTasks) {
      const success = await this.executeCleanupTask(task);

      if (success) {
        cleanedCount++;
        this.tasks.delete(this.getTaskKey(task.type, task.id));
      } else {
        failedCount++;
        if (task.lastError) {
          failures.push({
            type: task.type,
            id: task.id,
            error: task.lastError,
          });
        }
      }
    }

    return {
      success: failedCount === 0,
      cleanedCount,
      failedCount,
      failures,
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Execute a single cleanup task with retries
   */
  private async executeCleanupTask(task: CleanupTask): Promise<boolean> {
    while (task.attempts < this.maxRetries) {
      task.attempts++;

      try {
        await task.cleanup();
        return true;
      } catch (error) {
        task.lastError = error instanceof Error ? error : new Error(String(error));

        // Log warning on retry
        if (task.attempts < this.maxRetries) {
          console.warn(
            `Cleanup attempt ${task.attempts}/${this.maxRetries} failed for ` +
            `${task.type}:${task.id}: ${task.lastError.message}. Retrying...`
          );
          await this.delay(this.retryDelayMs * task.attempts);
        }
      }
    }

    console.error(
      `Cleanup failed for ${task.type}:${task.id} after ${task.attempts} attempts: ` +
      `${task.lastError?.message}`
    );
    return false;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Clear all tasks without executing cleanup
   */
  clear(): void {
    this.tasks.clear();
  }

  /**
   * Get statistics about registered tasks
   */
  getStats(): CleanupStats {
    const byType: Record<string, number> = {};
    const byPriority: Record<number, number> = {};

    for (const task of this.tasks.values()) {
      byType[task.type] = (byType[task.type] ?? 0) + 1;
      byPriority[task.priority] = (byPriority[task.priority] ?? 0) + 1;
    }

    return {
      total: this.tasks.size,
      byType,
      byPriority,
    };
  }
}

export interface CleanupStats {
  total: number;
  byType: Record<string, number>;
  byPriority: Record<number, number>;
}

export default CleanupTracker;

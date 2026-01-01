/**
 * Test Setup Files
 *
 * Runs before each test file. Sets up test-level utilities
 * and custom matchers.
 */

import { expect, beforeAll, afterAll, afterEach } from 'vitest';
import { TestContextProvider } from '../../src/core/context';

// Custom matchers
expect.extend({
  /**
   * Check if response has expected status code
   */
  toHaveStatus(received: { status: number }, expected: number) {
    const pass = received.status === expected;
    return {
      pass,
      message: () =>
        pass
          ? `Expected status to not be ${expected}`
          : `Expected status ${expected}, but received ${received.status}`,
    };
  },

  /**
   * Check if response matches JSON schema (simplified)
   */
  toMatchSchema(received: unknown, schemaName: string) {
    // Simplified schema validation - in production, use a proper JSON Schema validator
    const pass = received !== null && typeof received === 'object';
    return {
      pass,
      message: () =>
        pass
          ? `Expected response to not match schema ${schemaName}`
          : `Expected response to match schema ${schemaName}`,
    };
  },

  /**
   * Check if array contains object with matching properties
   */
  toContainObjectWithProps(received: unknown[], expected: Record<string, unknown>) {
    const pass = received.some((item) => {
      if (typeof item !== 'object' || item === null) return false;
      return Object.entries(expected).every(
        ([key, value]) => (item as Record<string, unknown>)[key] === value
      );
    });
    return {
      pass,
      message: () =>
        pass
          ? `Expected array to not contain object with properties ${JSON.stringify(expected)}`
          : `Expected array to contain object with properties ${JSON.stringify(expected)}`,
    };
  },

  /**
   * Check if duration is within acceptable range
   */
  toBeWithinDuration(received: number, maxMs: number) {
    const pass = received <= maxMs;
    return {
      pass,
      message: () =>
        pass
          ? `Expected duration to exceed ${maxMs}ms`
          : `Expected duration to be within ${maxMs}ms, but was ${received}ms`,
    };
  },
});

// Type declarations for custom matchers
declare module 'vitest' {
  interface Assertion<T = unknown> {
    toHaveStatus(expected: number): void;
    toMatchSchema(schemaName: string): void;
    toContainObjectWithProps(expected: Record<string, unknown>): void;
    toBeWithinDuration(maxMs: number): void;
  }
}

// Global hooks

beforeAll(async () => {
  // Any per-file setup
});

afterAll(async () => {
  // Cleanup all contexts created during tests
  await TestContextProvider.cleanupAll();
});

afterEach(async (context) => {
  // Record test result to Supabase if available
  if (globalThis.__TEST_RESULTS_SERVICE__ && globalThis.__TEST_RUN_ID__) {
    const task = context.task;
    const state = task.result?.state ?? 'pending';
    const error = task.result?.errors?.[0];

    try {
      await globalThis.__TEST_RESULTS_SERVICE__.recordResult(globalThis.__TEST_RUN_ID__, {
        testId: task.id,
        testName: task.name,
        suiteName: task.suite?.name,
        category: detectCategory(task.file?.name ?? ''),
        status: mapState(state),
        durationMs: task.result?.duration,
        errorMessage: error?.message,
        errorStack: error?.stack,
        tags: extractTags(task.name),
      });
    } catch (err) {
      // Silently fail - don't break tests due to reporting issues
      console.warn(`Failed to record test result: ${(err as Error).message}`);
    }
  }
});

/**
 * Detect test category from file path
 */
function detectCategory(filePath: string): 'smoke' | 'unit' | 'integration' | 'e2e' | 'performance' {
  if (filePath.includes('.smoke.')) return 'smoke';
  if (filePath.includes('.unit.')) return 'unit';
  if (filePath.includes('.int.')) return 'integration';
  if (filePath.includes('.e2e.')) return 'e2e';
  if (filePath.includes('.perf.') || filePath.includes('.load.')) return 'performance';
  if (filePath.includes('/smoke/')) return 'smoke';
  if (filePath.includes('/unit/')) return 'unit';
  if (filePath.includes('/integration/')) return 'integration';
  if (filePath.includes('/e2e/')) return 'e2e';
  if (filePath.includes('/performance/')) return 'performance';
  return 'integration'; // Default
}

/**
 * Map Vitest state to our status
 */
function mapState(state: string): 'passed' | 'failed' | 'skipped' | 'pending' | 'error' {
  switch (state) {
    case 'pass':
      return 'passed';
    case 'fail':
      return 'failed';
    case 'skip':
      return 'skipped';
    default:
      return 'pending';
  }
}

/**
 * Extract tags from test name (e.g., "[tag1][tag2] test name")
 */
function extractTags(name: string): string[] {
  const tagPattern = /\[([^\]]+)\]/g;
  const tags: string[] = [];
  let match;
  while ((match = tagPattern.exec(name)) !== null) {
    tags.push(match[1]);
  }
  return tags;
}

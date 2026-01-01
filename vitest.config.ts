/**
 * Vitest Configuration
 *
 * Main test runner configuration for the Legito API test suite.
 */

import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // Test file patterns
    include: ['tests/**/*.{test,spec,int,e2e,smoke}.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],

    // Environment
    environment: 'node',

    // Globals (no need to import describe, it, expect)
    globals: true,

    // Setup files
    setupFiles: ['./tests/setup/setup-files.ts'],
    globalSetup: './tests/setup/global-setup.ts',

    // Timeouts
    testTimeout: 60000,
    hookTimeout: 30000,

    // Parallel execution
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        minThreads: 1,
        maxThreads: 4,
      },
    },

    // Retry flaky tests
    retry: 1,

    // Reporter
    reporters: ['default', 'html'],
    outputFile: {
      html: './reports/html/index.html',
      json: './reports/results.json',
    },

    // Coverage
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './reports/coverage',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/**/index.ts'],
    },

    // Sequence
    sequence: {
      shuffle: false,
    },

    // Type checking
    typecheck: {
      enabled: false,  // Run separately with tsc
    },
  },

  // Path aliases
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@config': resolve(__dirname, './config'),
      '@tests': resolve(__dirname, './tests'),
    },
  },

  // Environment variables
  define: {
    'process.env.NODE_ENV': JSON.stringify('test'),
  },
});

/**
 * Global Test Setup
 *
 * Runs once before all test suites. Sets up global resources
 * like database connections and test result tracking.
 */

import { loadConfig, validateConfig } from '../../config';
import { getSupabaseClient } from '../../src/services/supabase/client';
import { TestResultsService } from '../../src/services/supabase/results-service';
import { GlobalRateLimiter } from '../../src/core/rate-limiting/rate-limiter';
import * as dotenv from 'dotenv';

// Store the run ID globally
declare global {
  var __TEST_RUN_ID__: string | undefined;
  var __TEST_RESULTS_SERVICE__: TestResultsService | undefined;
}

export default async function globalSetup() {
  // Load environment variables
  dotenv.config({ path: '.env.test' });
  dotenv.config();  // Fallback to .env

  console.log('\n========================================');
  console.log('  Legito API Test Suite - Global Setup');
  console.log('========================================\n');

  // Load and validate configuration
  const config = loadConfig();
  const validationErrors = validateConfig(config);

  if (validationErrors.length > 0) {
    console.error('Configuration validation failed:');
    validationErrors.forEach((err) => console.error(`  - ${err}`));
    throw new Error('Invalid configuration. Please check your environment variables.');
  }

  console.log(`Environment: ${config.environment.name}`);
  console.log(`API URL: ${config.environment.apiUrl}`);
  console.log(`Parallel Workers: ${config.environment.parallelWorkers}`);

  // Initialize global rate limiter
  GlobalRateLimiter.initialize({
    requestsPerMinute: config.rateLimits.requestsPerMinute,
    burstSize: config.rateLimits.burstSize,
    adaptive: config.rateLimits.adaptive,
    minRate: config.rateLimits.minRate,
    recoveryFactor: config.rateLimits.recoveryFactor,
  });

  console.log(`Rate Limit: ${config.rateLimits.requestsPerMinute} req/min`);

  // Initialize Supabase connection for test results (if configured)
  if (config.supabase.url && config.supabase.anonKey) {
    try {
      const supabase = getSupabaseClient({
        url: config.supabase.url,
        anonKey: config.supabase.anonKey,
      });

      const resultsService = new TestResultsService(supabase);

      // Start a new test run
      const runId = await resultsService.startTestRun({
        environment: config.environment.name,
        branch: process.env.GIT_BRANCH ?? process.env.GITHUB_REF_NAME,
        commitSha: process.env.GIT_COMMIT ?? process.env.GITHUB_SHA,
        triggeredBy: process.env.CI ? 'ci' : process.env.USER ?? 'local',
        metadata: {
          nodeVersion: process.version,
          platform: process.platform,
          timestamp: new Date().toISOString(),
        },
      });

      globalThis.__TEST_RUN_ID__ = runId;
      globalThis.__TEST_RESULTS_SERVICE__ = resultsService;

      console.log(`Test Run ID: ${runId}`);
      console.log('Supabase: Connected');
    } catch (error) {
      console.warn('Supabase: Not connected (results will not be stored)');
      console.warn(`  Error: ${(error as Error).message}`);
    }
  } else {
    console.log('Supabase: Not configured (results will not be stored)');
  }

  console.log('\n----------------------------------------');
  console.log('Setup complete. Starting tests...\n');
}

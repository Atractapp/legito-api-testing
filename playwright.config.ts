import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';

dotenv.config({ path: `.env.${process.env.TEST_ENV || 'test'}` });

export default defineConfig({
  testDir: './tests',

  // Test execution settings
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 4 : undefined,

  // Timeouts
  timeout: 30000,
  expect: {
    timeout: 5000,
  },

  // Global setup/teardown
  globalSetup: require.resolve('./src/config/global-setup.ts'),
  globalTeardown: require.resolve('./src/config/global-teardown.ts'),

  // Reporting
  reporter: [
    ['list'],
    ['html', {
      outputFolder: 'reports/html',
      open: process.env.CI ? 'never' : 'on-failure'
    }],
    ['junit', {
      outputFile: 'reports/junit/results.xml'
    }],
    ['json', {
      outputFile: 'reports/json/results.json'
    }],
    ['./src/utils/reporters/custom-reporter.ts']
  ],

  use: {
    // Base API settings
    baseURL: process.env.API_BASE_URL,
    extraHTTPHeaders: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },

    // Tracing
    trace: process.env.CI ? 'retain-on-failure' : 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    // API-specific settings
    ignoreHTTPSErrors: process.env.IGNORE_HTTPS_ERRORS === 'true',
  },

  // Projects for different test types
  projects: [
    {
      name: 'smoke',
      testMatch: /.*smoke.*\.spec\.ts/,
      retries: 3,
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'integration',
      testMatch: /.*integration.*\.spec\.ts/,
      retries: 2,
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'e2e',
      testMatch: /.*e2e.*\.spec\.ts/,
      retries: 2,
      timeout: 60000,
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'api-smoke',
      testMatch: /tests\/smoke\/.*\.spec\.ts/,
      grep: /@smoke/,
      retries: 3,
    },
    {
      name: 'api-integration',
      testMatch: /tests\/integration\/.*\.spec\.ts/,
      grep: /@integration/,
      retries: 2,
    },
    {
      name: 'api-e2e',
      testMatch: /tests\/e2e\/.*\.spec\.ts/,
      grep: /@e2e/,
      retries: 2,
      timeout: 60000,
    },
  ],

  // Output directories
  outputDir: 'test-results',
});

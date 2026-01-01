import { FullConfig } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Global setup runs once before all tests
 */
async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting API Test Suite Global Setup...\n');

  // Load environment variables
  const envFile = `.env.${process.env.TEST_ENV || 'test'}`;
  const envPath = path.resolve(process.cwd(), envFile);

  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    console.log(`✅ Loaded environment from ${envFile}`);
  } else {
    console.warn(`⚠️  Environment file ${envFile} not found, using defaults`);
  }

  // Validate required environment variables
  const requiredEnvVars = ['API_BASE_URL', 'AUTH_USERNAME', 'AUTH_PASSWORD'];
  const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);

  if (missingVars.length > 0) {
    console.error(`❌ Missing required environment variables: ${missingVars.join(', ')}`);
    throw new Error('Required environment variables not set');
  }

  console.log(`✅ API Base URL: ${process.env.API_BASE_URL}`);
  console.log(`✅ Test User: ${process.env.AUTH_USERNAME}`);

  // Create necessary directories
  const directories = ['reports', 'reports/html', 'reports/junit', 'reports/json', 'logs'];

  directories.forEach((dir) => {
    const dirPath = path.resolve(process.cwd(), dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`📁 Created directory: ${dir}`);
    }
  });

  // Verify API health before running tests
  console.log('\n🏥 Checking API health...');
  try {
    const response = await fetch(`${process.env.API_BASE_URL}/health`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (response.ok) {
      console.log('✅ API is healthy and ready for testing');
    } else {
      console.warn(`⚠️  API health check returned status: ${response.status}`);
    }
  } catch (error) {
    console.error('❌ API health check failed:', error);
    throw new Error('API is not accessible');
  }

  // Log test configuration
  console.log('\n⚙️  Test Configuration:');
  console.log(`   Workers: ${config.workers}`);
  console.log(`   Retries: ${config.retries}`);
  console.log(`   Timeout: ${config.timeout}ms`);
  console.log(`   Fully Parallel: ${config.fullyParallel}`);

  console.log('\n✨ Global setup completed successfully!\n');
}

export default globalSetup;

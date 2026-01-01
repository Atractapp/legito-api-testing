import { FullConfig } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Global teardown runs once after all tests complete
 */
async function globalTeardown(config: FullConfig) {
  console.log('\n🧹 Starting Global Teardown...\n');

  // Generate test summary
  const reportPath = path.resolve(process.cwd(), 'reports/custom/test-report.json');

  if (fs.existsSync(reportPath)) {
    try {
      const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

      console.log('📊 Test Execution Summary:');
      console.log(`   Total Tests: ${report.summary.total}`);
      console.log(`   Passed: ${report.summary.passed}`);
      console.log(`   Failed: ${report.summary.failed}`);
      console.log(`   Skipped: ${report.summary.skipped}`);
      console.log(`   Duration: ${Math.round(report.summary.duration / 1000)}s`);

      const passRate = ((report.summary.passed / report.summary.total) * 100).toFixed(2);
      console.log(`   Pass Rate: ${passRate}%`);

      if (report.summary.flaky > 0) {
        console.log(`   ⚠️  Flaky Tests: ${report.summary.flaky}`);
      }
    } catch (error) {
      console.error('Failed to read test report:', error);
    }
  }

  // Archive old logs (keep last 7 days)
  const logsDir = path.resolve(process.cwd(), 'logs');
  if (fs.existsSync(logsDir)) {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    fs.readdirSync(logsDir).forEach((file) => {
      const filePath = path.join(logsDir, file);
      const stats = fs.statSync(filePath);

      if (stats.mtimeMs < sevenDaysAgo) {
        fs.unlinkSync(filePath);
        console.log(`🗑️  Removed old log file: ${file}`);
      }
    });
  }

  // Clean up temporary test data
  console.log('\n🗑️  Cleaning up temporary test data...');
  // Add any cleanup logic here (e.g., delete test records from API)

  console.log('\n✅ Global teardown completed!\n');
}

export default globalTeardown;

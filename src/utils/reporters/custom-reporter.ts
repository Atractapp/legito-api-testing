import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';
import * as fs from 'fs';
import * as path from 'path';

interface CustomTestResult {
  testName: string;
  suiteName: string;
  status: string;
  duration: number;
  retries: number;
  errors: string[];
  tags: string[];
  timestamp: string;
}

interface CustomReport {
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    flaky: number;
    duration: number;
    startTime: string;
    endTime: string;
  };
  tests: CustomTestResult[];
  performance: {
    averageDuration: number;
    slowestTests: Array<{ name: string; duration: number }>;
    fastestTests: Array<{ name: string; duration: number }>;
  };
  coverage: {
    endpoints: string[];
    categories: Record<string, number>;
  };
  metadata: {
    environment: string;
    baseUrl: string;
    workers: number;
  };
}

/**
 * Custom reporter for generating JSON reports with enhanced metrics
 */
class CustomReporter implements Reporter {
  private startTime: Date = new Date();
  private tests: CustomTestResult[] = [];
  private config: FullConfig | null = null;

  onBegin(config: FullConfig, suite: Suite) {
    this.config = config;
    this.startTime = new Date();
    console.log(`Starting test run with ${config.workers} workers`);
  }

  onTestEnd(test: TestCase, result: TestResult) {
    const tags = this.extractTags(test.title);
    const errors = result.errors.map((error) => error.message || String(error));

    const testResult: CustomTestResult = {
      testName: test.title,
      suiteName: test.parent.title,
      status: result.status,
      duration: result.duration,
      retries: result.retry,
      errors,
      tags,
      timestamp: new Date().toISOString(),
    };

    this.tests.push(testResult);
  }

  async onEnd(result: FullResult) {
    const endTime = new Date();
    const duration = endTime.getTime() - this.startTime.getTime();

    const report = this.generateReport(result, duration, endTime);

    // Write JSON report
    const reportDir = path.join('reports', 'custom');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const reportPath = path.join(reportDir, 'test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Write summary to console
    this.printSummary(report);

    // Write dashboard data
    this.writeDashboardData(report);
  }

  private generateReport(
    result: FullResult,
    duration: number,
    endTime: Date
  ): CustomReport {
    const passed = this.tests.filter((t) => t.status === 'passed').length;
    const failed = this.tests.filter((t) => t.status === 'failed').length;
    const skipped = this.tests.filter((t) => t.status === 'skipped').length;
    const flaky = this.tests.filter((t) => t.retries > 0 && t.status === 'passed')
      .length;

    const durations = this.tests.map((t) => t.duration);
    const averageDuration =
      durations.reduce((a, b) => a + b, 0) / durations.length || 0;

    const sortedTests = [...this.tests].sort((a, b) => b.duration - a.duration);
    const slowestTests = sortedTests.slice(0, 10).map((t) => ({
      name: `${t.suiteName} > ${t.testName}`,
      duration: t.duration,
    }));
    const fastestTests = sortedTests.slice(-10).reverse().map((t) => ({
      name: `${t.suiteName} > ${t.testName}`,
      duration: t.duration,
    }));

    // Extract endpoint coverage from test names
    const endpoints = new Set<string>();
    const categories: Record<string, number> = {};

    this.tests.forEach((test) => {
      test.tags.forEach((tag) => {
        if (tag.startsWith('@')) {
          const category = tag.substring(1);
          categories[category] = (categories[category] || 0) + 1;
        }
      });

      // Extract endpoint from test name (simplified)
      const endpointMatch = test.testName.match(/\/api\/[^\s]+/);
      if (endpointMatch) {
        endpoints.add(endpointMatch[0]);
      }
    });

    return {
      summary: {
        total: this.tests.length,
        passed,
        failed,
        skipped,
        flaky,
        duration,
        startTime: this.startTime.toISOString(),
        endTime: endTime.toISOString(),
      },
      tests: this.tests,
      performance: {
        averageDuration: Math.round(averageDuration),
        slowestTests,
        fastestTests,
      },
      coverage: {
        endpoints: Array.from(endpoints),
        categories,
      },
      metadata: {
        environment: process.env.TEST_ENV || 'test',
        baseUrl: process.env.API_BASE_URL || '',
        workers: this.config?.workers || 1,
      },
    };
  }

  private extractTags(title: string): string[] {
    const tagRegex = /@[\w-]+/g;
    return title.match(tagRegex) || [];
  }

  private printSummary(report: CustomReport): void {
    console.log('\n' + '='.repeat(60));
    console.log('Test Execution Summary');
    console.log('='.repeat(60));
    console.log(`Total Tests:     ${report.summary.total}`);
    console.log(`Passed:          ${report.summary.passed} (${this.percentage(report.summary.passed, report.summary.total)}%)`);
    console.log(`Failed:          ${report.summary.failed} (${this.percentage(report.summary.failed, report.summary.total)}%)`);
    console.log(`Skipped:         ${report.summary.skipped}`);
    console.log(`Flaky:           ${report.summary.flaky}`);
    console.log(`Duration:        ${this.formatDuration(report.summary.duration)}`);
    console.log(`Avg Test Time:   ${this.formatDuration(report.performance.averageDuration)}`);
    console.log('='.repeat(60));

    if (report.summary.failed > 0) {
      console.log('\nFailed Tests:');
      report.tests
        .filter((t) => t.status === 'failed')
        .forEach((t) => {
          console.log(`  - ${t.suiteName} > ${t.testName}`);
          if (t.errors.length > 0) {
            console.log(`    Error: ${t.errors[0]}`);
          }
        });
    }

    if (report.summary.flaky > 0) {
      console.log('\nFlaky Tests (passed after retry):');
      report.tests
        .filter((t) => t.retries > 0 && t.status === 'passed')
        .forEach((t) => {
          console.log(`  - ${t.suiteName} > ${t.testName} (${t.retries} retries)`);
        });
    }

    console.log('\n' + '='.repeat(60) + '\n');
  }

  private writeDashboardData(report: CustomReport): void {
    const dashboardDir = path.join('reports', 'dashboard');
    if (!fs.existsSync(dashboardDir)) {
      fs.mkdirSync(dashboardDir, { recursive: true });
    }

    // Write summary for dashboard
    const dashboardData = {
      timestamp: new Date().toISOString(),
      summary: report.summary,
      performance: report.performance,
      coverage: report.coverage,
      trends: {
        passRate: this.percentage(report.summary.passed, report.summary.total),
        flakyRate: this.percentage(report.summary.flaky, report.summary.total),
        failRate: this.percentage(report.summary.failed, report.summary.total),
      },
    };

    const dashboardPath = path.join(dashboardDir, 'latest.json');
    fs.writeFileSync(dashboardPath, JSON.stringify(dashboardData, null, 2));

    // Append to historical data
    const historyPath = path.join(dashboardDir, 'history.jsonl');
    fs.appendFileSync(historyPath, JSON.stringify(dashboardData) + '\n');
  }

  private percentage(value: number, total: number): number {
    return total === 0 ? 0 : Math.round((value / total) * 100);
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
}

export default CustomReporter;

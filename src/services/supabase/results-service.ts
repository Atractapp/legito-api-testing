/**
 * Test Results Service
 *
 * Handles storage and retrieval of test execution results in Supabase.
 * Supports real-time result streaming and comprehensive test metrics.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../../types/supabase/database';
import { v4 as uuidv4 } from 'uuid';

// Type aliases from database schema
type TestRun = Database['public']['Tables']['test_runs']['Row'];
type TestRunInsert = Database['public']['Tables']['test_runs']['Insert'];
type TestRunUpdate = Database['public']['Tables']['test_runs']['Update'];

type TestResult = Database['public']['Tables']['test_results']['Row'];
type TestResultInsert = Database['public']['Tables']['test_results']['Insert'];

type TestMetric = Database['public']['Tables']['test_metrics']['Row'];
type TestMetricInsert = Database['public']['Tables']['test_metrics']['Insert'];

/**
 * Test run status
 */
export type TestRunStatus = 'running' | 'passed' | 'failed' | 'cancelled' | 'timeout';

/**
 * Test result status
 */
export type TestResultStatus = 'passed' | 'failed' | 'skipped' | 'pending' | 'error';

/**
 * Test category
 */
export type TestCategory = 'smoke' | 'unit' | 'integration' | 'e2e' | 'performance';

/**
 * Configuration for starting a test run
 */
export interface StartTestRunConfig {
  environment: string;
  branch?: string;
  commitSha?: string;
  triggeredBy?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Test result data for recording
 */
export interface TestResultData {
  testId: string;
  testName: string;
  suiteName?: string;
  category: TestCategory;
  tags?: string[];
  status: TestResultStatus;
  durationMs?: number;
  errorMessage?: string;
  errorStack?: string;
  assertionsPassed?: number;
  assertionsFailed?: number;
  requestLogs?: Record<string, unknown>;
  responseLogs?: Record<string, unknown>;
  screenshots?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Endpoint metrics data
 */
export interface EndpointMetricData {
  endpoint: string;
  method: string;
  responseTimes: number[];
  errorCount: number;
}

/**
 * Test run summary
 */
export interface TestRunSummary {
  runId: string;
  status: TestRunStatus;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  durationMs: number;
  startedAt: Date;
  completedAt?: Date;
  passRate: number;
}

/**
 * Test Results Service
 */
export class TestResultsService {
  private client: SupabaseClient<Database>;
  private currentRunId: string | null = null;

  constructor(client: SupabaseClient<Database>) {
    this.client = client;
  }

  /**
   * Start a new test run
   */
  async startTestRun(config: StartTestRunConfig): Promise<string> {
    const runId = `run_${Date.now()}_${uuidv4().slice(0, 8)}`;

    const insert: TestRunInsert = {
      run_id: runId,
      environment: config.environment,
      branch: config.branch,
      commit_sha: config.commitSha,
      triggered_by: config.triggeredBy,
      status: 'running',
      metadata: config.metadata as any,
    };

    const { error } = await this.client
      .from('test_runs')
      .insert(insert);

    if (error) {
      throw new Error(`Failed to start test run: ${error.message}`);
    }

    this.currentRunId = runId;
    return runId;
  }

  /**
   * Record a test result
   */
  async recordResult(runId: string, result: TestResultData): Promise<void> {
    const insert: TestResultInsert = {
      run_id: runId,
      test_id: result.testId,
      test_name: result.testName,
      suite_name: result.suiteName,
      category: result.category,
      tags: result.tags,
      status: result.status,
      duration_ms: result.durationMs,
      error_message: result.errorMessage,
      error_stack: result.errorStack,
      assertions_passed: result.assertionsPassed,
      assertions_failed: result.assertionsFailed,
      request_logs: result.requestLogs as any,
      response_logs: result.responseLogs as any,
      screenshots: result.screenshots,
      metadata: result.metadata as any,
    };

    const { error } = await this.client
      .from('test_results')
      .insert(insert);

    if (error) {
      throw new Error(`Failed to record test result: ${error.message}`);
    }

    // Update run counters
    await this.updateRunCounters(runId, result.status);
  }

  /**
   * Record multiple test results (batch)
   */
  async recordResults(runId: string, results: TestResultData[]): Promise<void> {
    const inserts: TestResultInsert[] = results.map((result) => ({
      run_id: runId,
      test_id: result.testId,
      test_name: result.testName,
      suite_name: result.suiteName,
      category: result.category,
      tags: result.tags,
      status: result.status,
      duration_ms: result.durationMs,
      error_message: result.errorMessage,
      error_stack: result.errorStack,
      assertions_passed: result.assertionsPassed,
      assertions_failed: result.assertionsFailed,
      request_logs: result.requestLogs as any,
      response_logs: result.responseLogs as any,
      screenshots: result.screenshots,
      metadata: result.metadata as any,
    }));

    const { error } = await this.client
      .from('test_results')
      .insert(inserts);

    if (error) {
      throw new Error(`Failed to record test results: ${error.message}`);
    }

    // Update run counters
    const statusCounts = results.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    await this.updateRunCountersBatch(runId, statusCounts);
  }

  /**
   * Update test run counters
   */
  private async updateRunCounters(runId: string, status: TestResultStatus): Promise<void> {
    const { data: run, error: fetchError } = await this.client
      .from('test_runs')
      .select('total_tests, passed_tests, failed_tests, skipped_tests')
      .eq('run_id', runId)
      .single();

    if (fetchError || !run) {
      console.warn(`Failed to fetch run counters: ${fetchError?.message}`);
      return;
    }

    const update: TestRunUpdate = {
      total_tests: (run.total_tests ?? 0) + 1,
      passed_tests: run.passed_tests ?? 0,
      failed_tests: run.failed_tests ?? 0,
      skipped_tests: run.skipped_tests ?? 0,
    };

    switch (status) {
      case 'passed':
        update.passed_tests! += 1;
        break;
      case 'failed':
      case 'error':
        update.failed_tests! += 1;
        break;
      case 'skipped':
      case 'pending':
        update.skipped_tests! += 1;
        break;
    }

    await this.client
      .from('test_runs')
      .update(update)
      .eq('run_id', runId);
  }

  /**
   * Update counters in batch
   */
  private async updateRunCountersBatch(
    runId: string,
    statusCounts: Record<string, number>
  ): Promise<void> {
    const { data: run, error: fetchError } = await this.client
      .from('test_runs')
      .select('total_tests, passed_tests, failed_tests, skipped_tests')
      .eq('run_id', runId)
      .single();

    if (fetchError || !run) {
      return;
    }

    const totalNew = Object.values(statusCounts).reduce((a, b) => a + b, 0);

    const update: TestRunUpdate = {
      total_tests: (run.total_tests ?? 0) + totalNew,
      passed_tests: (run.passed_tests ?? 0) + (statusCounts['passed'] ?? 0),
      failed_tests: (run.failed_tests ?? 0) + (statusCounts['failed'] ?? 0) + (statusCounts['error'] ?? 0),
      skipped_tests: (run.skipped_tests ?? 0) + (statusCounts['skipped'] ?? 0) + (statusCounts['pending'] ?? 0),
    };

    await this.client
      .from('test_runs')
      .update(update)
      .eq('run_id', runId);
  }

  /**
   * Complete a test run
   */
  async completeTestRun(runId: string, status?: TestRunStatus): Promise<TestRunSummary> {
    const { data: run, error: fetchError } = await this.client
      .from('test_runs')
      .select('*')
      .eq('run_id', runId)
      .single();

    if (fetchError || !run) {
      throw new Error(`Failed to fetch test run: ${fetchError?.message}`);
    }

    const completedAt = new Date();
    const startedAt = new Date(run.started_at!);
    const durationMs = completedAt.getTime() - startedAt.getTime();

    // Determine status if not provided
    const finalStatus = status ?? (
      (run.failed_tests ?? 0) > 0 ? 'failed' : 'passed'
    );

    const update: TestRunUpdate = {
      status: finalStatus,
      completed_at: completedAt.toISOString(),
      duration_ms: durationMs,
    };

    const { error: updateError } = await this.client
      .from('test_runs')
      .update(update)
      .eq('run_id', runId);

    if (updateError) {
      throw new Error(`Failed to complete test run: ${updateError.message}`);
    }

    const totalTests = run.total_tests ?? 0;
    const passRate = totalTests > 0
      ? ((run.passed_tests ?? 0) / totalTests) * 100
      : 0;

    this.currentRunId = null;

    return {
      runId,
      status: finalStatus,
      totalTests,
      passedTests: run.passed_tests ?? 0,
      failedTests: run.failed_tests ?? 0,
      skippedTests: run.skipped_tests ?? 0,
      durationMs,
      startedAt,
      completedAt,
      passRate,
    };
  }

  /**
   * Record endpoint metrics
   */
  async recordMetrics(runId: string, metrics: EndpointMetricData[]): Promise<void> {
    const inserts: TestMetricInsert[] = metrics.map((m) => {
      const sorted = [...m.responseTimes].sort((a, b) => a - b);
      const p95Index = Math.floor(sorted.length * 0.95);
      const p99Index = Math.floor(sorted.length * 0.99);

      return {
        run_id: runId,
        endpoint: m.endpoint,
        method: m.method,
        avg_response_time_ms: sorted.reduce((a, b) => a + b, 0) / sorted.length,
        min_response_time_ms: sorted[0] ?? 0,
        max_response_time_ms: sorted[sorted.length - 1] ?? 0,
        p95_response_time_ms: sorted[p95Index] ?? 0,
        p99_response_time_ms: sorted[p99Index] ?? 0,
        request_count: m.responseTimes.length,
        error_count: m.errorCount,
        error_rate: m.responseTimes.length > 0
          ? m.errorCount / m.responseTimes.length
          : 0,
      };
    });

    const { error } = await this.client
      .from('test_metrics')
      .insert(inserts);

    if (error) {
      throw new Error(`Failed to record metrics: ${error.message}`);
    }
  }

  /**
   * Get test run by ID
   */
  async getTestRun(runId: string): Promise<TestRun | null> {
    const { data, error } = await this.client
      .from('test_runs')
      .select('*')
      .eq('run_id', runId)
      .single();

    if (error) {
      return null;
    }

    return data;
  }

  /**
   * Get test results for a run
   */
  async getTestResults(
    runId: string,
    options: {
      status?: TestResultStatus;
      category?: TestCategory;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<TestResult[]> {
    let query = this.client
      .from('test_results')
      .select('*')
      .eq('run_id', runId)
      .order('created_at', { ascending: true });

    if (options.status) {
      query = query.eq('status', options.status);
    }

    if (options.category) {
      query = query.eq('category', options.category);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit ?? 100) - 1);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get test results: ${error.message}`);
    }

    return data ?? [];
  }

  /**
   * Get failed tests for a run
   */
  async getFailedTests(runId: string): Promise<TestResult[]> {
    return this.getTestResults(runId, { status: 'failed' });
  }

  /**
   * Get recent test runs
   */
  async getRecentRuns(
    options: {
      environment?: string;
      status?: TestRunStatus;
      limit?: number;
    } = {}
  ): Promise<TestRun[]> {
    let query = this.client
      .from('test_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(options.limit ?? 10);

    if (options.environment) {
      query = query.eq('environment', options.environment);
    }

    if (options.status) {
      query = query.eq('status', options.status);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get recent runs: ${error.message}`);
    }

    return data ?? [];
  }

  /**
   * Get the current run ID (if any)
   */
  getCurrentRunId(): string | null {
    return this.currentRunId;
  }
}

export default TestResultsService;

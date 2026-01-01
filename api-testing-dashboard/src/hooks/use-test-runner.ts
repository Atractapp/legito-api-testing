'use client';

import { useCallback, useRef } from 'react';
import { useTestStore } from '@/store/test-store';
import type { TestResult, TestRun, LogEntry } from '@/types';

export function useTestRunner() {
  const {
    categories,
    selectedTests,
    configuration,
    setCurrentRun,
    setIsRunning,
    addTestResult,
    addLog,
    updateTestStatus,
    clearTestResults,
    clearLogs,
  } = useTestStore();

  const abortControllerRef = useRef<AbortController | null>(null);

  const log = useCallback(
    (level: LogEntry['level'], message: string, testId?: string) => {
      addLog({
        id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        level,
        message,
        testId,
      });
    },
    [addLog]
  );

  const runTests = useCallback(async () => {
    if (selectedTests.length === 0) {
      log('warn', 'No tests selected');
      return;
    }

    // Setup
    abortControllerRef.current = new AbortController();
    clearTestResults();
    clearLogs();
    setIsRunning(true);

    const testsToRun = categories
      .flatMap((cat) => cat.tests)
      .filter((test) => selectedTests.includes(test.id));

    const run: TestRun = {
      id: `run-${Date.now()}`,
      startTime: new Date().toISOString(),
      status: 'running',
      totalTests: testsToRun.length,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      results: [],
      configuration,
    };

    setCurrentRun(run);
    log('info', `Starting test run with ${testsToRun.length} tests`);
    log('info', `Configuration: ${configuration.name} (${configuration.environment})`);
    log('info', `Base URL: ${configuration.baseUrl}`);

    // Reset all test statuses
    testsToRun.forEach((test) => updateTestStatus(test.id, 'pending'));

    // Run tests
    for (const test of testsToRun) {
      if (abortControllerRef.current?.signal.aborted) {
        log('warn', 'Test run cancelled');
        break;
      }

      updateTestStatus(test.id, 'running');
      log('info', `Running: ${test.name}`, test.id);

      try {
        // Simulate test execution
        const result = await simulateTestExecution(test, configuration);

        updateTestStatus(test.id, result.status);
        addTestResult(result);

        if (result.status === 'passed') {
          run.passedTests++;
          log('info', `PASSED: ${test.name} (${result.duration}ms)`, test.id);
        } else if (result.status === 'failed') {
          run.failedTests++;
          log('error', `FAILED: ${test.name} - ${result.error?.message}`, test.id);
        } else if (result.status === 'skipped') {
          run.skippedTests++;
          log('warn', `SKIPPED: ${test.name}`, test.id);
        }

        run.results.push(result);
        setCurrentRun({ ...run });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        log('error', `Error running ${test.name}: ${errorMessage}`, test.id);
        updateTestStatus(test.id, 'failed');
        run.failedTests++;
      }
    }

    // Finalize
    run.endTime = new Date().toISOString();
    run.status = abortControllerRef.current?.signal.aborted ? 'cancelled' : 'completed';
    run.duration = new Date(run.endTime).getTime() - new Date(run.startTime).getTime();

    setCurrentRun(run);
    setIsRunning(false);

    log(
      'info',
      `Test run ${run.status}: ${run.passedTests} passed, ${run.failedTests} failed, ${run.skippedTests} skipped`
    );
    log('info', `Total duration: ${(run.duration / 1000).toFixed(2)}s`);
  }, [
    categories,
    selectedTests,
    configuration,
    setCurrentRun,
    setIsRunning,
    addTestResult,
    updateTestStatus,
    clearTestResults,
    clearLogs,
    log,
  ]);

  const stopTests = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsRunning(false);
    log('warn', 'Test run stopped by user');
  }, [setIsRunning, log]);

  const resetTests = useCallback(() => {
    categories.flatMap((cat) => cat.tests).forEach((test) => {
      updateTestStatus(test.id, 'pending');
    });
    clearTestResults();
    clearLogs();
    setCurrentRun(null);
    log('info', 'Tests reset');
  }, [categories, updateTestStatus, clearTestResults, clearLogs, setCurrentRun, log]);

  return {
    runTests,
    stopTests,
    resetTests,
  };
}

// Simulate test execution (replace with actual API calls in production)
async function simulateTestExecution(
  test: { id: string; name: string; category: string; endpoint: string; method: string; assertions: number },
  configuration: { baseUrl: string; authToken?: string; timeout: number }
): Promise<TestResult> {
  const startTime = Date.now();

  // Simulate network delay (200-1500ms)
  await new Promise((resolve) =>
    setTimeout(resolve, 200 + Math.random() * 1300)
  );

  const duration = Date.now() - startTime;

  // Simulate random results (80% pass rate)
  const passed = Math.random() > 0.2;
  const assertionResults = Array.from({ length: test.assertions }, (_, i) => ({
    name: `Assertion ${i + 1}`,
    passed: passed || Math.random() > 0.5,
    expected: passed ? 200 : 200,
    actual: passed ? 200 : 500,
    message: passed ? undefined : 'Expected status 200 but got 500',
  }));

  const allAssertionsPassed = assertionResults.every((a) => a.passed);

  return {
    id: `result-${Date.now()}-${test.id}`,
    testId: test.id,
    testName: test.name,
    category: test.category,
    status: allAssertionsPassed ? 'passed' : 'failed',
    duration,
    timestamp: new Date().toISOString(),
    request: {
      url: `${configuration.baseUrl}${test.endpoint}`,
      method: test.method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: configuration.authToken ? `Bearer ${configuration.authToken}` : '',
      },
      body: test.method !== 'GET' ? { data: 'sample' } : undefined,
    },
    response: {
      status: allAssertionsPassed ? 200 : 500,
      statusText: allAssertionsPassed ? 'OK' : 'Internal Server Error',
      headers: {
        'Content-Type': 'application/json',
        'X-Request-Id': `req-${Date.now()}`,
      },
      body: allAssertionsPassed
        ? { success: true, data: { id: 1, name: 'Sample' } }
        : { success: false, error: 'Internal server error' },
      size: Math.floor(Math.random() * 5000) + 500,
    },
    assertions: assertionResults,
    error: allAssertionsPassed
      ? undefined
      : {
          message: 'One or more assertions failed',
          stack: 'at runTest (test-runner.ts:123)\nat async runTests (test-runner.ts:45)',
        },
    logs: [
      {
        id: `log-${Date.now()}-1`,
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `Requesting ${test.method} ${test.endpoint}`,
        testId: test.id,
      },
      {
        id: `log-${Date.now()}-2`,
        timestamp: new Date().toISOString(),
        level: allAssertionsPassed ? 'info' : 'error',
        message: allAssertionsPassed
          ? `Response received: 200 OK`
          : `Response received: 500 Internal Server Error`,
        testId: test.id,
      },
    ],
  };
}

'use client';

import { useCallback, useRef } from 'react';
import { useTestStore } from '@/store/test-store';
import type { TestResult, TestRun, LogEntry } from '@/types';
import {
  generateJWT,
  legitoRequest,
  LEGITO_TESTS,
  runAssertion,
  type LegitoTest,
  type ApiResponse,
  type TestContext,
} from '@/lib/legito-api';

export function useTestRunner() {
  const {
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
  const jwtRef = useRef<string | null>(null);
  const contextRef = useRef<TestContext>({});

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
    // Get tests to run from LEGITO_TESTS based on selectedTests
    const testsToRun = LEGITO_TESTS.filter((test) =>
      selectedTests.includes(test.id)
    );

    if (testsToRun.length === 0) {
      log('warn', 'No tests selected');
      return;
    }

    // Setup
    abortControllerRef.current = new AbortController();
    contextRef.current = {}; // Reset context
    clearTestResults();
    clearLogs();
    setIsRunning(true);

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
    log('info', `Target: Legito API v7 (https://emea.legito.com/api/v7)`);

    // Generate JWT token
    const apiKey = configuration.apiKey || process.env.NEXT_PUBLIC_LEGITO_API_KEY;
    const privateKey = configuration.privateKey || process.env.NEXT_PUBLIC_LEGITO_PRIVATE_KEY;

    if (!apiKey || !privateKey) {
      log('error', 'Missing API credentials. Please configure API Key and Private Key.');
      setIsRunning(false);
      run.status = 'completed';
      run.endTime = new Date().toISOString();
      setCurrentRun(run);
      return;
    }

    try {
      log('info', 'Generating JWT token...');
      jwtRef.current = await generateJWT({ apiKey, privateKey });
      log('info', 'JWT token generated successfully');
    } catch (error) {
      log('error', `Failed to generate JWT: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsRunning(false);
      run.status = 'completed';
      run.endTime = new Date().toISOString();
      setCurrentRun(run);
      return;
    }

    // Reset all test statuses
    testsToRun.forEach((test) => updateTestStatus(test.id, 'pending'));

    // Run tests
    for (const test of testsToRun) {
      if (abortControllerRef.current?.signal.aborted) {
        log('warn', 'Test run cancelled');
        break;
      }

      // Check if test should be skipped
      if (test.skipIf && test.skipIf(contextRef.current)) {
        updateTestStatus(test.id, 'skipped');
        run.skippedTests++;
        log('warn', `⊘ SKIPPED: ${test.name} (dependencies not met)`, test.id);

        // Create skipped result
        const skippedResult: TestResult = {
          id: `result-${Date.now()}-${test.id}`,
          testId: test.id,
          testName: test.name,
          category: test.category,
          status: 'skipped',
          duration: 0,
          timestamp: new Date().toISOString(),
          request: {
            url: `https://emea.legito.com/api/v7${test.endpoint}`,
            method: test.method,
            headers: {},
          },
          response: {
            status: 0,
            statusText: 'Skipped',
            headers: {},
            body: null,
            size: 0,
          },
          assertions: [],
          logs: [],
        };
        addTestResult(skippedResult);
        run.results.push(skippedResult);
        setCurrentRun({ ...run });
        continue;
      }

      updateTestStatus(test.id, 'running');
      log('info', `Running: ${test.name}`, test.id);

      // Resolve dynamic endpoint
      const endpoint = test.dynamicEndpoint
        ? test.dynamicEndpoint(contextRef.current)
        : test.endpoint;
      log('info', `${test.method} ${endpoint}`, test.id);

      try {
        const result = await executeTest(
          test,
          endpoint,
          jwtRef.current!,
          configuration.timeout,
          contextRef.current,
          log
        );

        // Store context if test sets it
        if (test.setsContext && result.response.body) {
          contextRef.current[test.setsContext] = result.response.body;
          log('debug', `Stored context: ${test.setsContext}`, test.id);
        }

        updateTestStatus(test.id, result.status);
        addTestResult(result);

        if (result.status === 'passed') {
          run.passedTests++;
          log('info', `✓ PASSED: ${test.name} (${result.duration}ms)`, test.id);
        } else if (result.status === 'failed') {
          run.failedTests++;
          log('error', `✗ FAILED: ${test.name} - ${result.error?.message}`, test.id);
        } else if (result.status === 'skipped') {
          run.skippedTests++;
          log('warn', `⊘ SKIPPED: ${test.name}`, test.id);
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

    const passRate = run.totalTests > 0
      ? Math.round((run.passedTests / run.totalTests) * 100)
      : 0;

    log(
      'info',
      `Test run ${run.status}: ${run.passedTests} passed, ${run.failedTests} failed, ${run.skippedTests} skipped (${passRate}% pass rate)`
    );
    log('info', `Total duration: ${(run.duration / 1000).toFixed(2)}s`);
  }, [
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
    LEGITO_TESTS.forEach((test) => {
      updateTestStatus(test.id, 'pending');
    });
    clearTestResults();
    clearLogs();
    setCurrentRun(null);
    contextRef.current = {};
    log('info', 'Tests reset');
  }, [updateTestStatus, clearTestResults, clearLogs, setCurrentRun, log]);

  return {
    runTests,
    stopTests,
    resetTests,
  };
}

// Execute a single test against the real Legito API
async function executeTest(
  test: LegitoTest,
  resolvedEndpoint: string,
  jwt: string,
  timeout: number,
  context: TestContext,
  log: (level: LogEntry['level'], message: string, testId?: string) => void
): Promise<TestResult> {
  const startTime = Date.now();

  // Resolve dynamic body if present
  const body = test.dynamicBody ? test.dynamicBody(context) : test.body;

  // Make the actual API request
  const response: ApiResponse = await legitoRequest(resolvedEndpoint, {
    method: test.method,
    body,
    jwt,
    timeout,
  });

  const duration = Date.now() - startTime;

  // Log response details
  log('info', `Response: ${response.status} ${response.statusText} (${response.duration}ms)`, test.id);

  // Check if status is in expected range
  const expectedStatuses = Array.isArray(test.expectedStatus)
    ? test.expectedStatus
    : [test.expectedStatus];
  const statusOk = expectedStatuses.includes(response.status);

  // Run assertions
  const assertionResults = test.assertions.map((assertion) => {
    // For status assertion, check against expected statuses
    if (assertion.type === 'status') {
      return {
        name: assertion.name,
        passed: statusOk,
        expected: expectedStatuses,
        actual: response.status,
        message: statusOk
          ? `Status ${response.status} OK`
          : `Status ${response.status} not in expected [${expectedStatuses.join(', ')}]`,
      };
    }

    const result = runAssertion(assertion, response);
    return {
      name: assertion.name,
      passed: result.passed,
      expected: assertion.expected,
      actual: undefined,
      message: result.message,
    };
  });

  const allPassed = assertionResults.every((a) => a.passed);

  // Log assertion results
  assertionResults.forEach((a) => {
    if (a.passed) {
      log('info', `  ✓ ${a.name}: ${a.message}`, test.id);
    } else {
      log('error', `  ✗ ${a.name}: ${a.message}`, test.id);
    }
  });

  return {
    id: `result-${Date.now()}-${test.id}`,
    testId: test.id,
    testName: test.name,
    category: test.category,
    status: allPassed ? 'passed' : 'failed',
    duration,
    timestamp: new Date().toISOString(),
    request: {
      url: `https://emea.legito.com/api/v7${resolvedEndpoint}`,
      method: test.method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer [JWT]',
      },
      body,
    },
    response: {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      body: response.data,
      size: JSON.stringify(response.data || {}).length,
    },
    assertions: assertionResults,
    error: allPassed
      ? undefined
      : {
          message: response.error || 'One or more assertions failed',
          stack: assertionResults
            .filter((a) => !a.passed)
            .map((a) => `${a.name}: ${a.message}`)
            .join('\n'),
        },
    logs: [],
  };
}

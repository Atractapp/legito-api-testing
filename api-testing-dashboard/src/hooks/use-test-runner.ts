'use client';

import { useCallback, useRef } from 'react';
import { useTestStore } from '@/store/test-store';
import type { TestResult, TestRun, LogEntry } from '@/types';
import {
  generateJWT,
  legitoRequest,
  LEGITO_TESTS,
  runAssertion,
  createEmptyTestContext,
  recordCrudOperation,
  generateCrudReport,
  type LegitoTest,
  type ApiResponse,
  type TestContext,
  type ExternalLinkData,
} from '@/lib/legito-api';
import {
  saveTestRun,
  saveTestResults,
  updateHistoricalDataFromRun,
  calculateDashboardStats,
} from '@/lib/supabase';

export function useTestRunner() {
  const {
    selectedTests,
    activePreset,
    setCurrentRun,
    setIsRunning,
    addTestResult,
    addLog,
    updateTestStatus,
    clearTestResults,
    clearLogs,
    setStats,
    setHistoricalData,
  } = useTestStore();

  const abortControllerRef = useRef<AbortController | null>(null);
  const jwtRef = useRef<string | null>(null);
  const contextRef = useRef<TestContext>(createEmptyTestContext());

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
    contextRef.current = createEmptyTestContext(); // Reset context with CRUD tracking

    // Pass preset values to context for dynamic tests
    contextRef.current.templateSuiteId = activePreset?.selectedTemplateIds?.[0] || '64004';
    contextRef.current.objectId = activePreset?.selectedObjectIds?.[0] || '935';
    clearTestResults();
    clearLogs();
    setIsRunning(true);

    // Get credentials from active preset
    const apiKey = activePreset?.apiKey;
    const privateKey = activePreset?.privateKey;
    const baseUrl = activePreset?.baseUrl || 'https://api.legito.com/api/v7';
    const timeout = activePreset?.timeout || 30000;

    if (!activePreset || !apiKey || !privateKey) {
      log('error', 'No preset selected or missing API credentials. Please select a test preset.');
      setIsRunning(false);
      return;
    }

    // Build a minimal configuration object for the TestRun (for backwards compatibility)
    const runConfiguration = {
      id: activePreset.id,
      name: activePreset.name,
      baseUrl,
      authType: 'jwt' as const,
      apiKey,
      privateKey,
      templateIds: activePreset.selectedTemplateIds,
      documentIds: [],
      timeout,
      retryCount: activePreset.retryCount,
      parallelExecution: activePreset.parallelExecution,
      environment: 'production' as const,
      headers: { 'Content-Type': 'application/json' },
      createdAt: activePreset.createdAt,
      updatedAt: activePreset.updatedAt,
    };

    const run: TestRun = {
      id: `run-${Date.now()}`,
      startTime: new Date().toISOString(),
      status: 'running',
      totalTests: testsToRun.length,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      results: [],
      configuration: runConfiguration,
    };

    setCurrentRun(run);
    log('info', `Starting test run with ${testsToRun.length} tests`);
    log('info', `Preset: ${activePreset.name} (${activePreset.region.toUpperCase()})`);
    log('info', `Target: ${baseUrl}`);

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
            url: `${baseUrl}${test.endpoint}`,
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
          timeout,
          baseUrl,
          contextRef.current,
          log
        );

        // Store context ONLY if test passed AND sets context
        // This prevents storing error responses that could be used by dependent tests
        if (test.setsContext && result.response.body && result.status === 'passed') {
          // Unwrap single-element arrays (e.g., POST /user returns [{user}])
          let dataToStore = result.response.body;
          if (Array.isArray(dataToStore) && dataToStore.length === 1) {
            dataToStore = dataToStore[0];
          }
          contextRef.current[test.setsContext] = dataToStore;
          log('debug', `Stored context: ${test.setsContext}`, test.id);

          // Extract external link URL if this is the kept external link
          if (test.setsContext === 'externalLinkKept' && result.response.body) {
            const responseData = result.response.body as Record<string, unknown> | Record<string, unknown>[];
            // API returns array of created external links
            const linkData = Array.isArray(responseData) ? responseData[0] : responseData;

            if (linkData) {
              // Per API schema: url = full URL, link = token part
              const fullUrl = linkData.url as string | undefined;
              const linkToken = linkData.link as string | undefined;

              if (fullUrl) {
                // Use the full URL directly from the API
                contextRef.current.crudReport.externalLinkUrl = fullUrl;
                run.externalLinkUrl = fullUrl;
                log('info', `*** EXTERNAL LINK URL: ${fullUrl} ***`, test.id);
              } else if (linkToken) {
                // Construct URL from link token
                const externalUrl = `https://emea.legito.com/US/en/shared/${linkToken}/`;
                contextRef.current.crudReport.externalLinkUrl = externalUrl;
                run.externalLinkUrl = externalUrl;
                log('info', `*** EXTERNAL LINK URL: ${externalUrl} ***`, test.id);
              } else {
                // Log the response structure for debugging
                log('warn', `External link response (no url/link field): ${JSON.stringify(linkData)}`, test.id);
              }
            }
          }
        }

        // Record CRUD operation if test has CRUD metadata
        if (test.crudOperation && test.entityType) {
          const resourceId = result.response.body
            ? getResourceId(result.response.body)
            : 'unknown';
          recordCrudOperation(contextRef.current, {
            entityType: test.entityType,
            operation: test.crudOperation,
            resourceId,
            resourceName: getResourceName(result.response.body),
            resourceCategory: test.resourceCategory || 'n/a',
            success: result.status === 'passed',
            timestamp: new Date().toISOString(),
            duration: result.duration,
            error: result.error?.message,
          });
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

    // Generate CRUD report (for console/debugging)
    const crudReportText = generateCrudReport(contextRef.current);
    console.log(crudReportText); // Log full report to console
    log('info', '--- CRUD TEST REPORT ---');
    log('info', `Total CRUD Operations: ${contextRef.current.crudReport.totals.totalOperations}`);
    log('info', `Successful: ${contextRef.current.crudReport.totals.successfulOperations}`);
    log('info', `Failed: ${contextRef.current.crudReport.totals.failedOperations}`);
    log('info', `Resources Created: ${contextRef.current.crudReport.totals.resourcesCreated}`);
    log('info', `Resources Kept: ${contextRef.current.crudReport.totals.resourcesKept}`);
    log('info', `Resources Deleted: ${contextRef.current.crudReport.totals.resourcesDeleted}`);

    // IMPORTANT: Log external link URL prominently
    if (contextRef.current.crudReport.externalLinkUrl) {
      log('info', '========================================');
      log('info', '*** EXTERNAL SHARING LINK FOR TESTING ***');
      log('info', `URL: ${contextRef.current.crudReport.externalLinkUrl}`);
      log('info', '========================================');
    }

    // ========================================
    // SAVE TO DATABASE
    // ========================================
    try {
      log('info', 'Saving test run to database...');

      // Save the test run
      const savedRun = await saveTestRun(run);
      if (savedRun) {
        log('info', `Test run saved to database (ID: ${savedRun.id})`);

        // Save all test results
        const resultsToSave = run.results || [];
        if (resultsToSave.length > 0) {
          const resultsSaved = await saveTestResults(resultsToSave, run.id);
          if (resultsSaved) {
            log('info', `${resultsToSave.length} test results saved to database`);
          }
        }

        // Update historical data
        await updateHistoricalDataFromRun(run);
        log('info', 'Historical data updated');

        // Recalculate and update dashboard stats
        const newStats = await calculateDashboardStats();
        setStats(newStats);
        log('info', 'Dashboard statistics updated');
      } else {
        log('warn', 'Failed to save test run to database (Supabase may not be configured)');
      }
    } catch (dbError) {
      const errorMsg = dbError instanceof Error ? dbError.message : 'Unknown error';
      log('warn', `Database save error: ${errorMsg}`);
    }
  }, [
    selectedTests,
    activePreset,
    setCurrentRun,
    setIsRunning,
    addTestResult,
    updateTestStatus,
    clearTestResults,
    clearLogs,
    log,
    setStats,
    setHistoricalData,
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
    contextRef.current = createEmptyTestContext();
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
  baseUrl: string,
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
    baseUrl,
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
      url: `${baseUrl}${resolvedEndpoint}`,
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

// Helper function to extract resource ID from response
function getResourceId(data: unknown): string {
  if (!data || typeof data !== 'object') return 'unknown';

  // Handle arrays (return first item's ID)
  if (Array.isArray(data) && data.length > 0) {
    return getResourceId(data[0]);
  }

  const obj = data as Record<string, unknown>;
  return String(
    obj.systemName ||
    obj.code ||
    obj.documentRecordCode ||
    obj.id ||
    obj.email ||
    obj.token ||
    obj.name ||
    'unknown'
  );
}

// Helper function to extract resource name from response
function getResourceName(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined;

  // Handle arrays (return first item's name)
  if (Array.isArray(data) && data.length > 0) {
    return getResourceName(data[0]);
  }

  const obj = data as Record<string, unknown>;
  return obj.name as string | undefined;
}

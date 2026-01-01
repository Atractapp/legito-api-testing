# API Testing Platform - Implementation Guide

## Quick Start

### 1. Initialize Supabase Project

```bash
# Create Supabase project
supabase start

# Apply schema
psql -h localhost -U postgres -d postgres -f 01_database_schema.sql

# Verify tables created
psql -h localhost -U postgres -c "SELECT tablename FROM pg_tables WHERE schemaname='public';"
```

### 2. Install Dependencies

```bash
npm install @supabase/supabase-js
npm install --save-dev typescript @types/node jest ts-jest
```

### 3. Configure Environment

```bash
# .env.local
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
SUPABASE_ANON_KEY=your-anon-key
LEGITO_API_BASE_URL=https://api.legito.com
```

---

## Core Implementation Patterns

### Pattern 1: Test Execution with Context

```typescript
import { TestExecutionContextManager } from './03_context_management_service';
import { TestCase, TestRequestConfig, TestResponseSpec } from './02_context_management_types';

async function executeTestCase(
  testCase: TestCase,
  requestConfig: TestRequestConfig,
  responseSpec: TestResponseSpec,
  runId: string,
  contextManager: TestExecutionContextManager
) {
  // 1. Get current execution context
  const context = await contextManager.getTestRunContext(runId);
  if (!context) throw new Error('Context not found');

  // 2. Resolve dependencies
  const depContext = await contextManager.resolveDependencies(testCase.id);
  if (!depContext.isReady) {
    console.log('Test waiting for dependencies:', depContext.requiredVariables);
    // Queue test for later execution
    return { status: 'pending', reason: 'dependencies_not_ready' };
  }

  // 3. Build request with context injection
  const requestBuilder = new ContextAwareRequestBuilder(
    contextManager,
    environmentId
  );
  const requestContext = await requestBuilder.buildRequest(
    endpoint.path,
    requestConfig,
    context
  );

  // 4. Execute test
  const response = await fetch(requestContext.url, {
    method: requestContext.method,
    headers: requestContext.headers,
    body: requestContext.body ? JSON.stringify(requestContext.body) : undefined,
  });

  const responseTime = response.time; // from fetch timing
  const responseBody = await response.json();
  const responseHeaders = Object.fromEntries(response.headers);

  // 5. Create result record
  const testResult = await supabase.from('test_results').insert({
    run_id: runId,
    test_case_id: testCase.id,
    status: 'running',
    started_at: new Date(),
  }).select().single();

  // 6. Run assertions
  const assertionResults = [];

  // Status code assertion
  if (response.status !== responseSpec.expectedStatusCode) {
    assertionResults.push({
      result_id: testResult.id,
      assertion_name: 'Status Code',
      assertion_type: 'status-code',
      expected_value: responseSpec.expectedStatusCode,
      actual_value: response.status,
      passed: false,
      error_message: `Expected ${responseSpec.expectedStatusCode}, got ${response.status}`,
    });
  } else {
    assertionResults.push({
      result_id: testResult.id,
      assertion_name: 'Status Code',
      assertion_type: 'status-code',
      expected_value: responseSpec.expectedStatusCode,
      actual_value: response.status,
      passed: true,
    });
  }

  // Body schema assertion
  if (responseSpec.bodyMatchType === 'schema') {
    const isValid = validateJsonSchema(responseBody, responseSpec.expectedBody);
    assertionResults.push({
      result_id: testResult.id,
      assertion_name: 'Response Schema',
      assertion_type: 'schema',
      passed: isValid,
      error_message: isValid ? null : 'Response does not match expected schema',
    });
  }

  // Response time assertion
  if (responseSpec.responseTimeMaxMs) {
    const isPassing = responseTime <= responseSpec.responseTimeMaxMs;
    assertionResults.push({
      result_id: testResult.id,
      assertion_name: 'Response Time',
      assertion_type: 'response-time',
      expected_value: responseSpec.responseTimeMaxMs,
      actual_value: responseTime,
      passed: isPassing,
      error_message: isPassing ? null : `Response time ${responseTime}ms exceeds limit ${responseSpec.responseTimeMaxMs}ms`,
    });
  }

  // 7. Capture variables from response
  const capturedVars = await contextManager.captureVariablesFromResponse(
    runId,
    testCase.id,
    responseBody,
    responseSpec.captureVars
  );

  // 8. Store assertion results
  await supabase.from('assertion_results').insert(assertionResults);

  // 9. Store response details
  await supabase.from('test_result_details').insert({
    result_id: testResult.id,
    request_headers: requestContext.headers,
    request_body: requestContext.body,
    response_status_code: response.status,
    response_headers: responseHeaders,
    response_body: responseBody,
    response_time_ms: responseTime,
    assertions_passed: assertionResults.filter(a => a.passed).length,
    assertions_failed: assertionResults.filter(a => !a.passed).length,
    captured_variables: capturedVars,
  });

  // 10. Update test result status
  const testPassed = assertionResults.every(a => a.passed);
  await supabase
    .from('test_results')
    .update({
      status: testPassed ? 'passed' : 'failed',
      completed_at: new Date(),
      duration_ms: responseTime,
    })
    .eq('id', testResult.id);

  return {
    status: testPassed ? 'passed' : 'failed',
    assertions: assertionResults,
    capturedVariables: capturedVars,
  };
}
```

### Pattern 2: Managing Dependent Tests

```typescript
async function executeTestSuiteWithDependencies(
  suiteId: string,
  runId: string,
  contextManager: TestExecutionContextManager
) {
  // 1. Get all tests in suite
  const { data: tests } = await supabase
    .from('test_cases')
    .select('*')
    .eq('suite_id', suiteId)
    .eq('enabled', true)
    .order('order_index');

  // 2. Build dependency graph
  const dependencyMap = new Map<string, string[]>();
  for (const test of tests || []) {
    const depContext = await contextManager.resolveDependencies(test.id);
    dependencyMap.set(test.id, depContext.executionChain);
  }

  // 3. Topological sort to get execution order
  const executionOrder = topologicalSort(tests || [], dependencyMap);

  // 4. Update context with execution order
  await contextManager.updateTestExecutionOrder(
    runId,
    executionOrder.map(t => t.id)
  );

  // 5. Execute tests sequentially or with max concurrency
  const maxConcurrency = 3;
  const results = [];

  for (let i = 0; i < executionOrder.length; i += maxConcurrency) {
    const batch = executionOrder.slice(i, i + maxConcurrency);
    const batchPromises = batch.map(test => {
      // Check if dependencies are satisfied
      const requiredTests = dependencyMap.get(test.id) || [];
      const depsReady = requiredTests.every(depId => {
        const depResult = results.find(r => r.testCaseId === depId);
        return depResult?.status === 'passed';
      });

      if (!depsReady) {
        return Promise.resolve({ testCaseId: test.id, status: 'skipped' });
      }

      return executeTestCase(test, requestConfig, responseSpec, runId, contextManager);
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }

  return results;
}

/**
 * Topological sort using Kahn's algorithm
 */
function topologicalSort(tests: TestCase[], dependencyMap: Map<string, string[]>): TestCase[] {
  const sorted: TestCase[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function visit(testId: string) {
    if (visited.has(testId)) return;
    if (visiting.has(testId)) {
      throw new Error(`Circular dependency detected for test ${testId}`);
    }

    visiting.add(testId);

    const dependencies = dependencyMap.get(testId) || [];
    for (const depId of dependencies) {
      visit(depId);
    }

    visiting.delete(testId);
    visited.add(testId);

    const test = tests.find(t => t.id === testId);
    if (test) sorted.push(test);
  }

  for (const test of tests) {
    visit(test.id);
  }

  return sorted;
}
```

### Pattern 3: Real-time Test Progress

```typescript
async function subscribeToTestProgress(runId: string, onUpdate: (data: any) => void) {
  // Subscribe to context changes
  const contextSubscription = supabase
    .channel(`test-context:${runId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'test_execution_context',
        filter: `run_id=eq.${runId}`,
      },
      (payload) => {
        onUpdate({
          type: 'context_updated',
          context: payload.new,
        });
      }
    )
    .subscribe();

  // Subscribe to test results
  const resultsSubscription = supabase
    .channel(`test-results:${runId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'test_results',
        filter: `run_id=eq.${runId}`,
      },
      (payload) => {
        onUpdate({
          type: 'test_result',
          result: payload.new,
        });
      }
    )
    .subscribe();

  // Subscribe to run status
  const runSubscription = supabase
    .channel(`test-run:${runId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'test_runs',
        filter: `id=eq.${runId}`,
      },
      (payload) => {
        onUpdate({
          type: 'run_status',
          status: payload.new.status,
          stats: {
            passed: payload.new.passed_tests,
            failed: payload.new.failed_tests,
            total: payload.new.total_tests,
          },
        });
      }
    )
    .subscribe();

  // Return unsubscribe function
  return () => {
    contextSubscription.unsubscribe();
    resultsSubscription.unsubscribe();
    runSubscription.unsubscribe();
  };
}
```

### Pattern 4: Error Handling & Retry Logic

```typescript
async function executeTestWithRetries(
  testCase: TestCase,
  requestConfig: TestRequestConfig,
  responseSpec: TestResponseSpec,
  runId: string,
  contextManager: TestExecutionContextManager,
  maxRetries = 3
) {
  let lastError: Error | null = null;
  let attempt = 1;

  while (attempt <= maxRetries) {
    try {
      // Create test result record
      const testResult = await supabase
        .from('test_results')
        .insert({
          run_id: runId,
          test_case_id: testCase.id,
          status: 'running',
          attempt_number: attempt,
          started_at: new Date(),
        })
        .select()
        .single();

      // Execute test
      const result = await executeTestCase(
        testCase,
        requestConfig,
        responseSpec,
        runId,
        contextManager
      );

      if (result.status === 'passed') {
        return result;
      }

      // Test failed, retry if attempts remaining
      lastError = new Error(`Test assertion failed on attempt ${attempt}`);

      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt - 1) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      attempt++;
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxRetries) {
        // Network error, retry with backoff
        const delay = Math.pow(2, attempt - 1) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      attempt++;
    }
  }

  // All retries exhausted
  return {
    status: 'failed',
    error: lastError,
    attemptsExhausted: true,
  };
}
```

---

## Best Practices

### 1. Context Management

```typescript
// GOOD: Clean up context after use
async function executeTestRun(runId: string) {
  try {
    const context = await contextManager.getTestRunContext(runId);
    // ... execute tests ...
  } finally {
    // Clean up memory cache
    await contextManager.clearRunContext(runId);
  }
}

// GOOD: Validate context size
async function captureVariables(runId: string, variables: Record<string, any>) {
  try {
    await contextManager.updateSharedVariables(runId, variables);
  } catch (error) {
    if (error.message.includes('size')) {
      // Context too large, clean up old captures
      console.warn('Context approaching size limit, archiving old data');
    }
  }
}

// AVOID: Storing large objects in context
const hugeResponse = { /* 10MB response body */ };
await contextManager.updateSharedVariables(runId, { hugeResponse }); // BAD

// GOOD: Store only what you need
const essentialData = {
  userId: hugeResponse.data.user.id,
  token: hugeResponse.data.auth.token,
};
await contextManager.updateSharedVariables(runId, essentialData); // GOOD
```

### 2. Dependency Management

```typescript
// GOOD: Use semantic dependency types
const dependency = {
  dependent_test_id: 'test-2',
  required_test_id: 'test-1',
  dependency_type: 'data', // Not just 'order'
};

// GOOD: Validate captured data before using
const context = await contextManager.getTestRunContext(runId);
const productId = context.captured_data['test-1']?.product_id;
if (!productId) {
  throw new Error('Required variable product_id not found');
}

// GOOD: Set reasonable timeouts for dependent tests
const config = {
  timeout_ms: 30000,
  max_wait_for_dependencies: 60000,
};
```

### 3. Assertion Patterns

```typescript
// GOOD: Multiple specific assertions
const assertions = [
  { type: 'status-code', expected: 200, actual: response.status },
  { type: 'header', key: 'content-type', expected: 'application/json' },
  { type: 'body', path: 'data.user_id', expected: 'user-123' },
  { type: 'response-time', expected: 500, actual: responseTime },
];

// GOOD: Assert captured variables exist
if (!response.body.token) {
  throw new Error('Expected token in response, got undefined');
}

// AVOID: Too few assertions
expect(response.status).toBe(200); // Only checking status, not response content

// GOOD: Use jsonpath for complex assertions
const userId = jsonPath.query(response.body, '$..user.id');
expect(userId).toEqual(['user-123']);
```

### 4. Variable Substitution

```typescript
// GOOD: Use consistent variable naming
const captureSpec = {
  'user_id': '$.data.user.id', // Matches shared_variables key
  'access_token': '$.data.auth.token',
  'refresh_token': '$.data.auth.refresh_token',
};

// GOOD: Validate JSONPath expressions
function validateJsonPath(path: string) {
  try {
    jsonPath.parse(path);
  } catch (error) {
    throw new Error(`Invalid JSONPath: ${path}`);
  }
}

// GOOD: Handle missing values gracefully
const value = extractValueFromPath(response, '$.data.field');
if (value === undefined) {
  console.warn(`Field not found: $.data.field`);
  return null;
}
```

### 5. Error Handling

```typescript
// GOOD: Categorize errors
function categorizeFailure(error: Error, response: any): FailureCategory {
  if (response.status === 401 || response.status === 403) {
    return 'authentication';
  }
  if (response.status === 0 || error.message.includes('ECONNREFUSED')) {
    return 'connection';
  }
  if (error.message.includes('timeout')) {
    return 'timeout';
  }
  if (response.status >= 400 && response.status < 500) {
    return 'data-validation';
  }
  return 'other';
}

// GOOD: Store original error for debugging
await supabase.from('failure_analysis').insert({
  result_id: testResult.id,
  failure_category: category,
  root_cause_analysis: error.message,
  suggested_fix: getSuggestedFix(category, error),
});

// GOOD: Log full stack trace for server-side analysis
console.error('Test execution error:', {
  testCaseId: testCase.id,
  error: error.message,
  stack: error.stack,
  context: { runId, attempt },
});
```

### 6. Performance Optimization

```typescript
// GOOD: Use connection pooling
const supabase = createClient(url, key, {
  db: {
    schema: 'public',
    healthCheck: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 100,
    },
  },
});

// GOOD: Batch operations
const results = [/* 100+ test results */];
const batchSize = 1000;
for (let i = 0; i < results.length; i += batchSize) {
  const batch = results.slice(i, i + batchSize);
  await supabase.from('test_results').insert(batch);
}

// GOOD: Use prepared statements
const { data } = await supabase
  .from('test_results')
  .select('*')
  .eq('run_id', runId)
  .eq('status', 'passed')
  .limit(100);

// AVOID: N+1 queries
for (const testCase of testCases) {
  const { data: results } = await supabase
    .from('test_results')
    .select('*')
    .eq('test_case_id', testCase.id); // Bad: one query per test
}

// GOOD: Fetch all at once
const { data: results } = await supabase
  .from('test_results')
  .select('*')
  .in('test_case_id', testCases.map(t => t.id)); // Good
```

### 7. Security Best Practices

```typescript
// GOOD: Never log credentials
console.log({
  testId: test.id,
  requestHeaders: headers, // BAD: might contain Authorization header
  requestBody: body, // BAD: might contain API keys
});

// GOOD: Sanitize before logging
const sanitizedHeaders = { ...headers };
delete sanitizedHeaders['Authorization'];
delete sanitizedHeaders['X-API-Key'];
console.log({ testId: test.id, headers: sanitizedHeaders });

// GOOD: Use RLS policies
const { data, error } = await supabase
  .from('api_credentials')
  .select('*'); // User can only see their own credentials via RLS

// GOOD: Encrypt sensitive data
const encryptedSecret = await encryptWithKey(secret, encryptionKey);
await supabase.from('api_credentials').update({
  key_secret: encryptedSecret,
});

// GOOD: Use service role for admin operations
const serviceSupabase = createClient(url, serviceKey);
const { data } = await serviceSupabase
  .from('test_execution_context')
  .select('*') // Bypasses RLS for system operations
  .eq('run_id', runId);
```

---

## Testing Strategy

### Unit Tests

```typescript
describe('TestExecutionContextManager', () => {
  let contextManager: TestExecutionContextManager;
  let runId: string;

  beforeEach(() => {
    contextManager = new TestExecutionContextManager();
    runId = 'test-run-' + Date.now();
  });

  describe('Context Initialization', () => {
    it('should create initial context', async () => {
      const context = await contextManager.initializeTestRunContext(
        runId,
        'project-1',
        'env-1'
      );

      expect(context.run_id).toBe(runId);
      expect(context.shared_auth_tokens).toEqual({});
      expect(context.shared_variables).toEqual({});
      expect(context.captured_data).toEqual({});
    });

    it('should validate context size', async () => {
      const largeData = { data: 'x'.repeat(11 * 1024 * 1024) };

      await expect(
        contextManager.updateSharedVariables(runId, largeData)
      ).rejects.toThrow('Context size exceeded');
    });
  });

  describe('Variable Capture', () => {
    it('should capture variables using JSONPath', async () => {
      await contextManager.initializeTestRunContext(runId, 'project-1', 'env-1');

      const response = {
        data: {
          user: {
            id: 'user-123',
            name: 'John',
          },
        },
      };

      const captured = await contextManager.captureVariablesFromResponse(
        runId,
        'test-1',
        response,
        {
          user_id: '$.data.user.id',
          user_name: '$.data.user.name',
        }
      );

      expect(captured.user_id).toBe('user-123');
      expect(captured.user_name).toBe('John');
    });

    it('should handle missing paths gracefully', async () => {
      await contextManager.initializeTestRunContext(runId, 'project-1', 'env-1');

      const response = { data: {} };
      const captured = await contextManager.captureVariablesFromResponse(
        runId,
        'test-1',
        response,
        {
          missing_field: '$.data.nonexistent',
        }
      );

      expect(captured.missing_field).toBeUndefined();
    });
  });

  describe('Dependency Resolution', () => {
    it('should detect circular dependencies', async () => {
      // Create circular dependency: test-1 → test-2 → test-1
      await expect(
        contextManager.resolveDependencies('test-1')
      ).rejects.toThrow('Circular dependency');
    });

    it('should return correct execution chain', async () => {
      const chain = await contextManager.getExecutionChain('test-3');
      // test-3 depends on test-2, test-2 depends on test-1
      expect(chain).toEqual(['test-1', 'test-2']);
    });
  });
});
```

### Integration Tests

```typescript
describe('End-to-End Test Execution', () => {
  it('should execute dependent tests in order', async () => {
    const runId = await createTestRun('project-1', 'env-1');

    // Test 1: Login
    const login = await executeTest('test-1', runId); // POST /login
    expect(login.status).toBe('passed');

    // Test 2: Get Profile (depends on test-1 for token)
    const profile = await executeTest('test-2', runId); // GET /profile
    expect(profile.status).toBe('passed');
    expect(profile.capturedVariables).toHaveProperty('user_id');

    // Test 3: Update Profile (depends on test-2 for user_id)
    const update = await executeTest('test-3', runId); // PUT /profile
    expect(update.status).toBe('passed');
  });

  it('should skip dependent tests if dependency fails', async () => {
    const runId = await createTestRun('project-1', 'env-1');

    // Test 1: Login with wrong credentials (fails)
    const login = await executeTest('test-1-fail', runId);
    expect(login.status).toBe('failed');

    // Test 2: Get Profile should be skipped
    const profile = await executeTest('test-2', runId);
    expect(profile.status).toBe('skipped');
  });

  it('should detect flaky tests', async () => {
    // Run test 10 times
    for (let i = 0; i < 10; i++) {
      const runId = await createTestRun('project-1', 'env-1');
      await executeTest('test-flaky', runId);
    }

    // Query flaky tests
    const flaky = await getDetectedFlakyTests('project-1');
    const flakyTest = flaky.find(t => t.test_case_id === 'test-flaky');

    expect(flakyTest).toBeDefined();
    expect(flakyTest.flakiness_score).toBeGreaterThan(0.1);
  });
});
```

---

## Monitoring & Maintenance

### Key Metrics to Monitor

```typescript
// Context Cache Performance
const stats = contextManager.getMemoryStats();
console.log({
  cachedRuns: stats.cachedRuns,
  memoryUsageMB: stats.totalMemoryUsage / 1024 / 1024,
  avgAccessCount: stats.averageAccessCount,
});

// Query Performance
SELECT
  query,
  calls,
  total_time,
  mean_time
FROM pg_stat_statements
WHERE query LIKE '%test%'
ORDER BY total_time DESC;

// Storage Usage
SELECT
  tablename,
  pg_size_pretty(pg_total_relation_size('public.' || tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size('public.' || tablename) DESC;
```

### Health Checks

```typescript
async function performHealthCheck(): Promise<HealthStatus> {
  const checks = {
    database: await checkDatabaseConnection(),
    cache: await checkRedisConnection(),
    supabase: await checkSupabaseConnection(),
    legito_api: await checkLegito ApiConnection(),
  };

  return {
    status: Object.values(checks).every(c => c.status === 'healthy') ? 'healthy' : 'degraded',
    checks,
    timestamp: new Date(),
  };
}
```

---

## Conclusion

This implementation provides a robust, scalable foundation for an enterprise API Testing Platform with sophisticated context management, real-time updates, and comprehensive observability.

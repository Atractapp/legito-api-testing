# API Testing Platform - Data Architecture & Context Management

## 1. SYSTEM ARCHITECTURE OVERVIEW

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         API Testing Platform Architecture                    │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                          CLIENT APPLICATIONS                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                      │
│  │ Web UI       │  │ CLI Tool     │  │ CI/CD Plugin │                      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘                      │
└─────────┼──────────────────┼──────────────────┼──────────────────────────────┘
          │                  │                  │
          └──────────────────┼──────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     CONTEXT MANAGEMENT LAYER                                 │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ TestExecutionContextManager                                          │  │
│  │  • Initialize execution context                                      │  │
│  │  • Update shared tokens & variables                                 │  │
│  │  • Capture data from responses                                      │  │
│  │  • Resolve test dependencies                                        │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ In-Memory Cache Layer (Redis / Memory)                              │  │
│  │  • Active run contexts (TTL: 24 hours)                             │  │
│  │  • Frequently accessed variables                                    │  │
│  │  • Shared tokens                                                    │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      SUPABASE CORE LAYER                                     │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ PostgreSQL Database with Real-time Updates                           │ │
│  │                                                                       │ │
│  │ Tables Organized by Category:                                        │ │
│  │                                                                       │ │
│  │ [AUTH]                    [TEST CONFIG]        [EXECUTION]           │ │
│  │ • users                   • test_suites        • test_runs           │ │
│  │ • organizations           • test_cases         • test_results        │ │
│  │ • organization_members    • api_endpoints      • test_result_details │ │
│  │ • api_credentials         • test_dependencies  • assertion_results   │ │
│  │                           • test_request_configs                     │ │
│  │                           • test_response_specs                      │ │
│  │                                                                       │ │
│  │ [FIXTURES & CONFIG]       [CONTEXT & STATE]   [ANALYTICS]           │ │
│  │ • test_data_fixtures      • test_execution_   • performance_metrics  │ │
│  │ • fixture_usage             context           • test_run_history    │ │
│  │ • environments            • environment_      • failure_analysis     │ │
│  │ • environment_variables     variables                                │ │
│  │                                                                       │ │
│  │ [REPORTING]                                                          │ │
│  │ • report_templates                                                   │ │
│  │ • user_preferences                                                   │ │
│  │ • saved_searches                                                     │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ Real-time Subscriptions (WebSockets)                                 │ │
│  │  • test_execution_context changes                                    │ │
│  │  • test_results (live updates)                                       │ │
│  │  • test_runs status changes                                          │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TEST EXECUTION ENGINE                                     │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ Test Orchestrator                                                    │  │
│  │  • Dependency resolution                                            │  │
│  │  • Parallel/sequential execution                                    │  │
│  │  • Retry & timeout handling                                         │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ Request Builder (Context-Aware)                                      │  │
│  │  • Variable substitution                                            │  │
│  │  • Header injection (auth tokens)                                   │  │
│  │  • Request signing                                                  │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ Assertion Engine                                                     │  │
│  │  • Status code validation                                           │  │
│  │  • Response body matching                                           │  │
│  │  • Custom assertions                                                │  │
│  │  • Variable capture                                                 │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        LEGITO REST API                                       │
│  (Target API being tested)                                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. TEST EXECUTION DATA FLOW

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TEST EXECUTION FLOW WITH CONTEXT                          │
└─────────────────────────────────────────────────────────────────────────────┘

Step 1: Test Run Initialization
────────────────────────────────
  User triggers test run (suite/specific tests)
         │
         ▼
  Validate authorization (RLS policies)
         │
         ▼
  Create TestRun record
  ├─ id: UUID
  ├─ status: 'pending'
  ├─ started_by: user_id
  └─ created_at: NOW()
         │
         ▼
  Initialize TestExecutionContext
  ├─ shared_auth_tokens: {}
  ├─ shared_variables: {}
  ├─ captured_data: {}
  └─ test_order: [test_ids...]
         │
         ▼
  Cache context in memory (Redis/Memory)
  TTL: 24 hours
  Size limit: 10MB per context

────────────────────────────────────────────────────────────────────────────────

Step 2: Dependency Resolution & Execution Planning
───────────────────────────────────────────────────
  For each enabled test case:
         │
         ▼
  Query TestDependency table
  ├─ Get required_test_ids
  ├─ Get dependency_type ('order', 'data', 'token')
  └─ Build execution chain
         │
         ▼
  Topological sort to determine execution order
         │
         ▼
  Update TestExecutionContext.test_order
         │
         ▼
  Update TestRun with total_tests count

────────────────────────────────────────────────────────────────────────────────

Step 3: Environment Setup
─────────────────────────
  Load environment configuration:
         │
         ├─▶ Get base_url from Environments
         │
         ├─▶ Get all EnvironmentVariables
         │   ├─ Non-secret: visible in context
         │   └─ Secret: accessed via secure getter
         │
         ├─▶ Load user's API credentials
         │   ├─ From ApiCredentials table
         │   ├─ Decrypted on-demand
         │   └─ Stored in shared_auth_tokens
         │
         └─▶ Get TestDataFixtures
             ├─ Query by tags/names
             └─ Store in context.captured_data

────────────────────────────────────────────────────────────────────────────────

Step 4: Test Execution Loop (per test case)
────────────────────────────────────────────

  ┌─ For each test in execution order:
  │
  ├─▶ Load TestCase + RequestConfig + ResponseSpec
  │
  ├─▶ Check dependencies ready?
  │   ├─ If 'order' dependency: just ensure sequence
  │   ├─ If 'data' dependency: verify captured_data[required_test_id] exists
  │   └─ If 'token' dependency: verify shared_auth_tokens has token
  │
  ├─▶ Build HTTP request using ContextAwareRequestBuilder
  │   ├─ Replace {{variables}} in URL/headers/body
  │   ├─ Inject auth token from shared_auth_tokens
  │   ├─ Apply environment variables
  │   └─ Create RequestContext
  │
  ├─▶ Execute HTTP request
  │   ├─ Make HTTP call to Legito API
  │   ├─ Capture response (status, headers, body, duration)
  │   └─ Store in ResponseContext
  │
  ├─▶ Create TestResult record
  │   ├─ status: 'pending' → 'running'
  │   ├─ started_at: NOW()
  │   └─ attempt_number: 1
  │
  ├─▶ Run assertions
  │   │
  │   ├─ StatusCodeAssertion
  │   │  └─ actual: response.status_code
  │   │     expected: expected_status_code
  │   │
  │   ├─ HeaderAssertions
  │   │  └─ For each header in expected_headers
  │   │     Compare with response headers
  │   │
  │   ├─ BodyAssertions (based on bodyMatchType)
  │   │  ├─ 'exact': JSON deep equality
  │   │  ├─ 'schema': JSON schema validation
  │   │  ├─ 'partial': subset matching
  │   │  └─ 'contains': substring/value existence
  │   │
  │   ├─ ResponseTimeAssertion
  │   │  └─ response_time_ms <= response_time_max_ms
  │   │
  │   └─ Custom Assertions (from test config)
  │
  ├─▶ Capture variables from response
  │   │
  │   └─ For each key in ResponseSpec.capture_vars:
  │      ├─ Extract value using JSONPath
  │      ├─ Store in context.captured_data[test_id][var_name]
  │      └─ Also store in shared_variables if needed
  │
  ├─▶ Handle test-specific tokens
  │   │
  │   └─ If token capture in response:
  │      ├─ Extract token from response body/headers
  │      ├─ Store in shared_auth_tokens[token_name]
  │      └─ Update TestExecutionContext
  │
  ├─▶ Retry logic (if test failed and retryCount > 0)
  │   │
  │   ├─ If status != expected && attempt < retryCount:
  │   │  ├─ Wait (exponential backoff)
  │   │  ├─ Increment attempt_number
  │   │  └─ GOTO "Build HTTP request" step
  │   │
  │   └─ Else: Mark final status
  │
  ├─▶ Update TestResult
  │   ├─ status: 'passed' | 'failed'
  │   ├─ completed_at: NOW()
  │   ├─ duration_ms: elapsed time
  │   └─ exit_code: 0 | 1
  │
  ├─▶ Store TestResultDetail
  │   ├─ request_headers/body/params: what was sent
  │   ├─ response_status_code/headers/body: what was received
  │   ├─ response_time_ms: latency
  │   ├─ assertions_passed/failed: counts
  │   └─ captured_variables: extracted values
  │
  ├─▶ Store AssertionResults (one per assertion)
  │   ├─ assertion_name: 'Status code check'
  │   ├─ assertion_type: 'status-code'
  │   ├─ expected_value: 200
  │   ├─ actual_value: 200
  │   ├─ passed: true
  │   └─ error_message: null | error details
  │
  ├─▶ Trigger: Detect flakiness
  │   │
  │   └─ If same test failed recently:
  │      ├─ Query test_run_history for past 30 days
  │      ├─ Calculate failure rate
  │      └─ If > 10% failure rate: Mark as flaky
  │
  ├─▶ Update TestExecutionContext
  │   │
  │   └─ database.update('test_execution_context')
  │      ├─ shared_variables = {..., new_vars}
  │      ├─ captured_data = {..., test_data}
  │      └─ updated_at: NOW()
  │
  └─ Continue to next test in order...

────────────────────────────────────────────────────────────────────────────────

Step 5: Automatic Metrics Aggregation
──────────────────────────────────────
  PostgreSQL TRIGGER: update_performance_metrics()

  On INSERT into test_results:
         │
         ▼
  Calculate for today:
  ├─ total_runs: COUNT(*)
  ├─ successful_runs: COUNT(*) WHERE status='passed'
  ├─ failed_runs: COUNT(*) WHERE status='failed'
  ├─ average_response_time_ms: AVG(duration_ms)
  ├─ p95_response_time_ms: PERCENTILE_CONT(0.95)
  ├─ p99_response_time_ms: PERCENTILE_CONT(0.99)
  ├─ min/max_response_time_ms: MIN/MAX
  └─ success_rate: successful_runs/total_runs * 100
         │
         ▼
  INSERT/UPDATE performance_metrics
  (grouped by: test_case_id, environment_id, date)

────────────────────────────────────────────────────────────────────────────────

Step 6: Failure Analysis (if test failed)
──────────────────────────────────────────
  Create FailureAnalysis record:
         │
         ├─▶ Categorize failure:
         │   ├─ Status code mismatch → 'assertion'
         │   ├─ Response timeout → 'timeout'
         │   ├─ Connection refused → 'connection'
         │   ├─ 401/403 → 'authentication'
         │   ├─ Schema validation error → 'data-validation'
         │   ├─ Wrong base_url/endpoint → 'environment'
         │   └─ Other → 'other'
         │
         ├─▶ Detect flakiness:
         │   ├─ Query detect_flaky_tests()
         │   ├─ If failure_count >= 3 && success_rate < 90%:
         │   │  ├─ isFlaky: true
         │   │  ├─ flakinessScore: failures / total_runs
         │   │  └─ Trigger notification
         │   │
         │   └─ Else: isFlaky: false
         │
         └─▶ Suggest fix based on failure type

────────────────────────────────────────────────────────────────────────────────

Step 7: Test Run Completion
────────────────────────────
  TRIGGER: update_test_run_stats()

  On test_results INSERT/UPDATE:
         │
         ▼
  Aggregate all results for run:
  ├─ passed_tests: COUNT(*) WHERE status='passed'
  ├─ failed_tests: COUNT(*) WHERE status='failed'
  ├─ skipped_tests: COUNT(*) WHERE status='skipped'
  └─ total_duration_ms: SUM(duration_ms)
         │
         ▼
  Update TestRun:
  ├─ All 4 counters above
  ├─ status: 'completed'
  └─ completed_at: NOW()
         │
         ▼
  Clear memory cache (optionally keep for 1 hour)
         │
         ▼
  Broadcast WebSocket event: run_completed
  ├─ Summary stats
  ├─ Failed test details
  └─ Flaky tests list

────────────────────────────────────────────────────────────────────────────────

Step 8: Reporting & Notifications
──────────────────────────────────
  Load user's preferences:
         │
         ├─▶ Load UserPreferences
         │   ├─ emailOnFailure
         │   ├─ emailFrequency
         │   └─ notificationChannels
         │
         ├─▶ Load saved ReportTemplate
         │   ├─ includesFailures
         │   ├─ includesPerformance
         │   ├─ dateRangeDays
         │   └─ environments
         │
         └─▶ Generate report:
             ├─ Query test_results for report period
             ├─ Query performance_metrics
             ├─ Query failure_analysis
             ├─ Detect flaky_tests via function
             └─ Send notification
```

---

## 3. CONTEXT STATE DIAGRAM

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      TEST EXECUTION CONTEXT STATE                            │
└─────────────────────────────────────────────────────────────────────────────┘

Initial State (Empty Context)
───────────────────────────────
  {
    "run_id": "uuid-1",
    "shared_auth_tokens": {},
    "shared_variables": {},
    "captured_data": {},
    "test_order": ["test-a", "test-b", "test-c"]
  }


After Test A Execution (login endpoint)
───────────────────────────────────────
  Response: { "access_token": "jwt-abc123", "user_id": "user-123" }

  UPDATED CONTEXT:
  {
    "run_id": "uuid-1",
    "shared_auth_tokens": {
      "access_token": "jwt-abc123"           ◄── Captured from response
    },
    "shared_variables": {},
    "captured_data": {
      "test-a": {
        "user_id": "user-123",                ◄── Captured from response
        "token": "jwt-abc123"
      }
    },
    "test_order": ["test-a", "test-b", "test-c"]
  }


After Test B Execution (get user profile)
──────────────────────────────────────────
  Request: GET /users/{{user_id}}
           ▲
           └─ Uses shared_variables["user_id"] from test-a
           └─ Uses Authorization header from shared_auth_tokens["access_token"]

  Response: { "id": "user-123", "name": "John", "documents": [...] }

  UPDATED CONTEXT:
  {
    "run_id": "uuid-1",
    "shared_auth_tokens": {
      "access_token": "jwt-abc123"
    },
    "shared_variables": {
      "user_id": "user-123"                  ◄── Now in shared variables too
    },
    "captured_data": {
      "test-a": {
        "user_id": "user-123",
        "token": "jwt-abc123"
      },
      "test-b": {
        "user_id": "user-123",
        "name": "John",
        "document_count": 5
      }
    },
    "test_order": ["test-a", "test-b", "test-c"]
  }


After Test C Execution (create document)
────────────────────────────────────────
  Request: POST /documents
           Body: { "title": "New Doc", "user_id": "{{user_id}}" }

  Response: { "id": "doc-456", "status": "created" }

  FINAL CONTEXT:
  {
    "run_id": "uuid-1",
    "shared_auth_tokens": {
      "access_token": "jwt-abc123"
    },
    "shared_variables": {
      "user_id": "user-123"
    },
    "captured_data": {
      "test-a": {
        "user_id": "user-123",
        "token": "jwt-abc123"
      },
      "test-b": {
        "user_id": "user-123",
        "name": "John",
        "document_count": 5
      },
      "test-c": {
        "document_id": "doc-456",
        "status": "created"
      }
    },
    "test_order": ["test-a", "test-b", "test-c"]
  }
```

---

## 4. REAL-TIME UPDATE STRATEGY

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     REAL-TIME UPDATE ARCHITECTURE                            │
└─────────────────────────────────────────────────────────────────────────────┘

WebSocket Subscriptions (Supabase Realtime)
────────────────────────────────────────────

Client subscribes to:

  1. test_execution_context changes
     ├─ Listen on: run_id = current_run_id
     ├─ Events: INSERT, UPDATE
     └─ Broadcast: shared_tokens/variables updated
        → Update UI in real-time
        → Notify dependent tests they can proceed

  2. test_results changes
     ├─ Listen on: run_id = current_run_id
     ├─ Events: INSERT, UPDATE
     └─ Broadcast: Test completed
        → Update result in real-time
        → Show pass/fail immediately
        → Highlight assertions

  3. test_runs changes
     ├─ Listen on: id = current_run_id
     ├─ Events: UPDATE
     └─ Broadcast: Run status/stats update
        → Show progress bar
        → Update counters (passed/failed)
        → Show when run completes

Subscription Code:
──────────────────

  const subscription = supabase
    .channel(`test-run:${runId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'test_execution_context' },
      (payload) => {
        console.log('Context updated:', payload.new);
        // Update local state
        setExecutionContext(payload.new);
        // Trigger UI update
      }
    )
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'test_results' },
      (payload) => {
        console.log('Test completed:', payload.new);
        // Add to results list
        // Check for failures
        // Update metrics
      }
    )
    .subscribe();


Push Notifications (Server to Client)
──────────────────────────────────────

Test run completion:
  ├─ Message: "Test suite 'Login Flow' completed: 15 passed, 2 failed"
  ├─ Action: View detailed report
  └─ Timestamp: Run completion time

Flaky test detection:
  ├─ Message: "Test 'Create Document' is flaky (40% failure rate)"
  ├─ Action: View failure history
  └─ Timestamp: Latest failure


Performance Events
──────────────────

Degradation Detection:
  ├─ If avg_response_time > baseline * 1.5:
  │  └─ Emit: performance_degradation event
  │     ├─ test_case_id
  │     ├─ current_avg_ms
  │     ├─ baseline_avg_ms
  │     └─ percentage_increase
  │
  └─ Push notification to user


Polling Fallback
────────────────

If WebSocket fails:
  ├─ Poll every 2 seconds: GET /api/runs/{runId}/status
  ├─ Fetch: test_run + latest test_results
  ├─ Update local state
  └─ Resume WebSocket when available
```

---

## 5. DATABASE INDEXING STRATEGY

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      INDEX PERFORMANCE OPTIMIZATION                          │
└─────────────────────────────────────────────────────────────────────────────┘

Query Performance Analysis
──────────────────────────

HIGH FREQUENCY QUERIES (with indexes):

  1. Get context for active run
     Query:  SELECT * FROM test_execution_context WHERE run_id = $1
     Index:  idx_test_execution_context_run_id (UNIQUE)
     Speed:  O(1) - Direct lookup

  2. Get all results for a run
     Query:  SELECT * FROM test_results WHERE run_id = $1 ORDER BY created_at
     Index:  idx_test_results_run_id, idx_test_results_created_at
     Speed:  O(log n) - Index scan

  3. Get dependencies for test
     Query:  SELECT * FROM test_dependencies WHERE dependent_test_id = $1
     Index:  idx_test_dependencies_dependent_test_id (partial on depends on)
     Speed:  O(log n) - Index scan

  4. Get performance metrics for date range
     Query:  SELECT * FROM performance_metrics
              WHERE test_case_id = $1 AND date BETWEEN $2 AND $3
     Index:  idx_performance_metrics_test_case_id, idx_performance_metrics_date
     Speed:  O(log n) - Composite index

  5. Detect flaky tests
     Query:  SELECT tc.id, COUNT(*) as failures
              FROM test_cases tc
              JOIN test_results tr ON tc.id = tr.test_case_id
              WHERE organization_id = $1 AND status = 'failed'
              GROUP BY tc.id
              HAVING COUNT(*) >= 3
     Index:  idx_test_cases_suite_id → organization_id via join chain
     Speed:  O(n log n) - Aggregation with index support

MEDIUM FREQUENCY QUERIES:

  6. Get all tests in a suite
     SELECT * FROM test_cases WHERE suite_id = $1 AND enabled = true
     Indexes: idx_test_cases_suite_id, idx_test_cases_enabled
     Speed:   O(log n)

  7. Get test results with details
     SELECT tr.*, trd.* FROM test_results tr
     LEFT JOIN test_result_details trd ON tr.id = trd.result_id
     WHERE tr.run_id = $1
     Indexes: idx_test_results_run_id, idx_test_result_details_result_id
     Speed:   O(log n)

  8. Get credentials for user
     SELECT * FROM api_credentials WHERE user_id = $1
     Index:  idx_api_credentials_user_id
     Speed:  O(log n)

ANALYTICAL QUERIES:

  9. Aggregate metrics over time
     SELECT date, SUM(total_runs), SUM(successful_runs)
     FROM performance_metrics
     WHERE test_case_id = $1 AND date >= $2
     GROUP BY date ORDER BY date
     Index:  idx_performance_metrics_test_case_id, idx_performance_metrics_date
     Speed:  O(n log n) - Aggregation

  10. Detect performance regression
      SELECT t1.*, t2.* FROM performance_metrics t1
      JOIN performance_metrics t2 ON t1.test_case_id = t2.test_case_id
      WHERE t1.date = CURRENT_DATE - INTERVAL '1 day'
      AND t2.date = CURRENT_DATE
      AND t1.average_response_time_ms < t2.average_response_time_ms * 1.5
      Index:  idx_performance_metrics_test_case_id, idx_performance_metrics_date
      Speed:  O(log n) per table


Composite Index Strategy
───────────────────────

  CREATE INDEX idx_test_runs_lookup
  ON test_runs(project_id, status, created_at DESC);

  Benefits:
  ├─ Find recent failed runs for project: 3 columns covered
  ├─ Avoid separate full table scan on project_id
  └─ Created_at DESC enables efficient pagination

  CREATE INDEX idx_performance_metrics_lookup
  ON performance_metrics(test_case_id, environment_id, date DESC);

  Benefits:
  ├─ Covers most analytical queries
  ├─ Natural ordering for date sorting
  └─ Avoids separate sorts


Partial Indexes (for common filters)
────────────────────────────────────

  CREATE INDEX idx_test_cases_active
  ON test_cases(suite_id) WHERE enabled = true;

  Benefits:
  ├─ Smaller index size (only active tests)
  ├─ Faster for enabled test queries
  └─ Skips archived tests

  CREATE INDEX idx_test_runs_recent
  ON test_runs(project_id, created_at DESC)
  WHERE status IN ('running', 'pending');

  Benefits:
  ├─ Efficient for "active runs" queries
  ├─ Excludes completed historical runs
  └─ Perfect for dashboard queries


JSONB Operator Index
───────────────────

  CREATE INDEX idx_test_data_fixtures_tags
  ON test_data_fixtures USING GIN(tags);

  Benefits:
  ├─ Fast array containment checks: WHERE 'user' = ANY(tags)
  ├─ Used for fixture discovery by tags
  └─ GIN index optimized for array operations


Index Maintenance
─────────────────

  Weekly ANALYZE:
    ANALYZE test_results;
    ANALYZE performance_metrics;
    ANALYZE test_runs;

  Monthly REINDEX:
    REINDEX INDEX idx_performance_metrics_lookup;
    REINDEX INDEX idx_test_runs_lookup;

  Monitor:
    SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read
    FROM pg_stat_user_indexes
    ORDER BY idx_scan DESC;
```

---

## 6. DATA RETENTION & CLEANUP POLICIES

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     DATA RETENTION & ARCHIVE STRATEGY                        │
└─────────────────────────────────────────────────────────────────────────────┘

Retention Timeline
──────────────────

Table                          Retention Period    Action
──────────────────────────────────────────────────────────────────
test_runs (completed)          90 days            Archive to S3
test_results (passed)          90 days            Archive to S3
test_result_details            90 days            Archive to S3
assertion_results              90 days            Archive to S3

test_runs (failed)             180 days           Archive + Analyze
test_results (failed)          180 days           Archive + Analyze
failure_analysis               180 days           Keep for analysis

performance_metrics            2 years            Quarterly aggregation
test_run_history               1 year             Aggregate daily
test_execution_context         24 hours           Real-time only

test_cases                     Forever            Keep (config)
test_suites                    Forever            Keep (config)
test_request_configs           Forever            Keep (config)
test_response_specs            Forever            Keep (config)

api_endpoints                  Forever            Keep (config)
environments                   Forever            Keep (config)
environment_variables          Forever            Keep (config)

users                          Forever            Keep
organizations                  Forever            Keep
api_credentials                Forever            Keep


Cleanup Job Schedule
───────────────────

Daily (1 AM UTC):
  ├─ archive_old_test_results()
  │  └─ Delete test_results older than 90 days with status='passed'
  │
  ├─ Clear expired test_execution_context (> 24 hours old)
  │  └─ These are cached in memory anyway
  │
  └─ Log: Archived {X} records

Weekly (Sunday 2 AM UTC):
  ├─ aggregate_old_performance_metrics()
  │  ├─ For metrics > 90 days old
  │  ├─ Group by: test_case_id, environment_id, month
  │  ├─ Keep: min/max/avg response times only
  │  └─ Delete granular daily records
  │
  └─ aggregate_old_test_history()
     ├─ For history > 30 days old
     ├─ Roll up to daily summaries
     └─ Delete hourly records

Monthly (1st at 3 AM UTC):
  ├─ cleanup_old_failed_runs()
  │  ├─ Delete test_runs > 180 days old with status='failed'
  │  ├─ First: Archive to S3
  │  └─ Log failures for compliance
  │
  ├─ Orphaned data cleanup
  │  ├─ test_result_details without test_results
  │  ├─ fixture_usage without test_cases
  │  └─ assertion_results without test_results
  │
  ├─ VACUUM ANALYZE
  │  └─ Reclaim disk space
  │
  └─ Index statistics update

Quarterly (1st of Q at 4 AM UTC):
  ├─ Export performance_metrics to Parquet (S3)
  │  ├─ For all data > 90 days
  │  ├─ Partition by: test_case_id, month
  │  └─ Keep 2-year rolling window in cold storage
  │
  └─ Log export completion

Retention SQL Functions
──────────────────────

-- Archive function
CREATE OR REPLACE FUNCTION archive_old_test_results()
RETURNS TABLE(archived_count INTEGER, archived_bytes BIGINT) AS $$
DECLARE
  _archived_count INTEGER;
  _archived_bytes BIGINT;
  _archive_file TEXT;
BEGIN
  -- Export to S3 via pg_stat_statements extension
  SELECT json_agg(t) INTO _archive_file
  FROM (
    SELECT * FROM test_results
    WHERE created_at < NOW() - INTERVAL '90 days'
    AND status IN ('passed', 'skipped')
  ) t;

  -- Call S3 export (via trigger or external process)
  -- INSERT INTO s3_archives (data, path, created_at) VALUES (...)

  -- Count before deletion
  SELECT COUNT(*) INTO _archived_count
  FROM test_results
  WHERE created_at < NOW() - INTERVAL '90 days'
  AND status IN ('passed', 'skipped');

  -- Calculate storage saved
  SELECT pg_total_relation_size('test_results') INTO _archived_bytes;

  -- Delete
  DELETE FROM test_results
  WHERE created_at < NOW() - INTERVAL '90 days'
  AND status IN ('passed', 'skipped');

  RETURN QUERY SELECT _archived_count, _archived_bytes;
END;
$$ LANGUAGE plpgsql;


-- Aggregation function
CREATE OR REPLACE FUNCTION aggregate_old_performance_metrics()
RETURNS TABLE(aggregated_count INTEGER) AS $$
DECLARE
  _aggregated_count INTEGER;
BEGIN
  -- Create monthly summary
  INSERT INTO performance_metrics_monthly (
    test_case_id, environment_id, year_month,
    total_runs, successful_runs, failed_runs,
    min_response_time, max_response_time, avg_response_time
  )
  SELECT
    test_case_id, environment_id,
    DATE_TRUNC('month', date)::DATE,
    SUM(total_runs), SUM(successful_runs), SUM(failed_runs),
    MIN(min_response_time_ms), MAX(max_response_time_ms),
    AVG(average_response_time_ms)
  FROM performance_metrics
  WHERE date < (CURRENT_DATE - INTERVAL '90 days')
  GROUP BY test_case_id, environment_id, DATE_TRUNC('month', date)
  ON CONFLICT (test_case_id, environment_id, year_month) DO UPDATE SET
    total_runs = EXCLUDED.total_runs,
    successful_runs = EXCLUDED.successful_runs,
    failed_runs = EXCLUDED.failed_runs,
    min_response_time = EXCLUDED.min_response_time,
    max_response_time = EXCLUDED.max_response_time,
    avg_response_time = EXCLUDED.avg_response_time;

  GET DIAGNOSTICS _aggregated_count = ROW_COUNT;

  -- Delete old granular records
  DELETE FROM performance_metrics
  WHERE date < (CURRENT_DATE - INTERVAL '90 days');

  RETURN QUERY SELECT _aggregated_count;
END;
$$ LANGUAGE plpgsql;


Storage Estimates
─────────────────

Assuming: 1000 tests, 5 environments, running 10x daily average

Per day:
  ├─ test_results: 1000 * 5 * 10 = 50,000 records
  │  ├─ Size: 50,000 * 1KB = 50MB
  │  └─ 90 day retention: 4.5GB
  │
  ├─ test_result_details: 50,000 * 2KB = 100MB/day
  │  └─ 90 day retention: 9GB
  │
  ├─ assertion_results (avg 5 per test): 250,000 * 200B = 50MB/day
  │  └─ 90 day retention: 4.5GB
  │
  └─ performance_metrics: 1000 * 5 = 5,000 records/day
     └─ 2 year retention: 3.65GB total (after aggregation)

Total storage: ~25GB for 90-day hot data + ~10GB for 2-year cold storage

After cleanup:
  ├─ Archive 50,000 test_results/day → S3 (cost: $0.023 per GB)
  ├─ Aggregate performance metrics monthly → ~70% space savings
  └─ Estimated monthly cost: $20-30 for S3 storage
```

---

## 7. CONTEXT SHARING BETWEEN DEPENDENT TESTS

```
┌─────────────────────────────────────────────────────────────────────────────┐
│               CONTEXT FLOW FOR DEPENDENT TESTS                               │
└─────────────────────────────────────────────────────────────────────────────┘

Example: E-Commerce Order Flow
───────────────────────────────

Test Dependency Chain:
  Test 1: Login
    └─ Produces: auth_token, user_id

  Test 2: Get Catalog (depends on Test 1 for auth)
    ├─ Uses: auth_token
    └─ Produces: product_ids

  Test 3: Add to Cart (depends on Test 2 for product_id)
    ├─ Uses: auth_token, product_id
    └─ Produces: cart_id

  Test 4: Checkout (depends on Test 3 for cart_id)
    ├─ Uses: auth_token, cart_id
    └─ Produces: order_id

  Test 5: Confirm Payment (depends on Test 4 for order_id)
    └─ Uses: auth_token, order_id


Dependency Table Entries
────────────────────────

test_dependencies records:

  1. dependent: Test2, required: Test1, type: 'token'
     └─ Test 2 needs the auth token from Test 1

  2. dependent: Test3, required: Test1, type: 'token'
     └─ Test 3 needs the auth token from Test 1

  3. dependent: Test3, required: Test2, type: 'data'
     └─ Test 3 needs product_id from Test 2

  4. dependent: Test4, required: Test3, type: 'data'
     └─ Test 4 needs cart_id from Test 3

  5. dependent: Test5, required: Test4, type: 'data'
     └─ Test 5 needs order_id from Test 4


Context Evolution During Execution
───────────────────────────────────

BEFORE Test 1 (Login):
  context = {
    shared_auth_tokens: {},
    shared_variables: {},
    captured_data: {},
    test_order: ["test1", "test2", "test3", "test4", "test5"]
  }


AFTER Test 1 (Login → Response: { token, user_id }):
  context.shared_auth_tokens["auth_token"] = "jwt-xyz..."
  context.captured_data["test1"] = {
    token: "jwt-xyz...",
    user_id: "user-123"
  }

  WebSocket event → All clients notified
  Subscribers to Test 2 dependencies → "Ready to run"
  Test 2 starts automatically (if parallel enabled)


DURING Test 2 (Get Catalog):
  Request is built:
  ├─ Headers: Authorization: Bearer {{shared_auth_tokens.auth_token}}
  │            (injected automatically)
  └─ URL: GET /catalog

  Test 1 context is available but not required for this test


AFTER Test 2 (Get Catalog → Response: { products: [...] }):
  context.captured_data["test2"] = {
    product_ids: ["prod-1", "prod-2", "prod-3"],
    product_count: 3
  }

  Notify Test 3: "Your dependencies ready"
  Test 3 proceeds (was waiting for Test 2)


DURING Test 3 (Add to Cart):
  Request is built with variable substitution:
  ├─ Headers: Authorization: Bearer {{shared_auth_tokens.auth_token}}
  ├─ Body: {
  │   "product_id": "{{captured_data.test2.product_ids[0]}}",
  │   "quantity": 1
  │ }
  │ Resolves to: "prod-1"
  └─ URL: POST /cart

  Uses both Test 1 (token) and Test 2 (product_id) data


Dependency Resolution Algorithm
────────────────────────────────

function resolveDependencies(testId):
  1. Query test_dependencies WHERE dependent_test_id = testId

  2. For each dependency:
     IF dependency.type == 'token':
       ├─ Check: shared_auth_tokens has required token?
       └─ If missing: BLOCK test (wait for required test)

     ELSE IF dependency.type == 'data':
       ├─ Check: captured_data[required_test_id] exists?
       └─ If missing: BLOCK test (wait for required test)

     ELSE IF dependency.type == 'order':
       ├─ Check: required_test completed successfully?
       └─ If not: BLOCK test (enforce sequential order)

  3. IF all dependencies satisfied:
     └─ Mark test as READY_TO_RUN

  4. ELSE:
     └─ Mark test as WAITING_FOR_DEPENDENCIES
     └─ Register callback: notify when deps satisfied


Parallel Execution with Dependencies
─────────────────────────────────────

Configuration:
  ├─ parallel: true
  ├─ maxConcurrency: 3
  └─ Enable: auto-start tests when dependencies ready

Execution Timeline:

  Timeline:
  ├─ T=0s:  Test1 starts
  │
  ├─ T=0.5s: Test2 waiting (needs Test1)
  │           Test3 waiting (needs Test1 & Test2)
  │           Test4 waiting (needs Test3)
  │           Test5 waiting (needs Test4)
  │
  ├─ T=1s:   Test1 completes ✓
  │          Test2 starts (dep satisfied)
  │
  ├─ T=1.5s: Test2 completes ✓
  │          Test3 starts (all deps satisfied)
  │          Test4 waiting (still needs Test3)
  │
  ├─ T=2s:   Test3 completes ✓
  │          Test4 starts (dep satisfied)
  │
  ├─ T=2.5s: Test4 completes ✓
  │          Test5 starts (dep satisfied)
  │
  └─ T=3s:   Test5 completes ✓


Variable Substitution in Requests
──────────────────────────────────

Example: Test 3 (Add to Cart)

Test config:
{
  "endpoint": "POST /cart",
  "headers": {
    "Authorization": "Bearer {{auth_token}}"
  },
  "body": {
    "product_id": "{{product_id}}",
    "quantity": 1
  }
}

Context available:
{
  "shared_auth_tokens": {
    "auth_token": "jwt-xyz..."
  },
  "captured_data": {
    "test1": { "token": "jwt-xyz...", "user_id": "user-123" },
    "test2": { "product_ids": ["prod-1", "prod-2"], "product_count": 2 }
  },
  "shared_variables": {
    "product_id": "prod-1"  ← Could be set from TestCase config
  }
}

Substitution logic:
  1. Find {{product_id}} in body
  2. Check shared_variables first → "prod-1"
  3. If not found, check captured_data for path
  4. If not found, check environment variables
  5. If not found, use literal "{{product_id}}"

  Result body: { "product_id": "prod-1", "quantity": 1 }


Failure Handling with Dependencies
──────────────────────────────────

If Test 1 fails:
  ├─ Test1 status: FAILED
  ├─ Test2 status: SKIPPED (dependency failed)
  ├─ Test3 status: SKIPPED (dependency failed)
  ├─ Test4 status: SKIPPED (dependency failed)
  └─ Test5 status: SKIPPED (dependency failed)

  Run result: 0 passed, 1 failed, 4 skipped


If Test 2 passes but captures wrong data:
  ├─ Test1 status: PASSED ✓
  ├─ Test2 status: PASSED ✓ (but assertion on response might warn)
  ├─ Test3 starts with product_id = null or undefined
  │  └─ Request fails: "Invalid product_id"
  │  └─ Test3 status: FAILED
  └─ Test4,5 SKIPPED

  Note: Test 2 passed assertion but produced bad data
  → Need assertion on captured variables too!


Best Practices for Dependent Tests
──────────────────────────────────

1. Always assert captured variables exist:
   ├─ Not just: assert(response.status === 200)
   └─ Also: assert(response.body.token !== undefined)

2. Use timeout limits:
   ├─ If Test 1 is slow, don't wait forever in Test 2
   └─ Set: maxWaitForDependencies = 30 seconds

3. Capture data conservatively:
   ├─ Only capture what next test needs
   ├─ Avoid capturing huge response bodies
   └─ Use JSONPath to extract specific fields

4. Order tests logically:
   ├─ Group related tests in a suite
   ├─ Order within suite reflects API flow
   └─ Use explicit dependencies only for non-sequential needs

5. Test failure scenarios:
   ├─ What if dependency test returns bad data?
   ├─ Add validation assertions
   └─ Use test fixtures as backup values
```

---

## 8. SECURITY & RLS POLICIES

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                  ROW LEVEL SECURITY MATRIX                                   │
└─────────────────────────────────────────────────────────────────────────────┘

User Roles:
  ├─ Owner: Full control, billing, invite members
  ├─ Admin: Configure tests, view reports, manage environments
  ├─ Editor: Run tests, create/edit test cases
  └─ Viewer: View-only access to reports and test results


RLS Policy Application:
────────────────────────

Table                     SELECT    INSERT    UPDATE    DELETE    Notes
─────────────────────────────────────────────────────────────────────────────
users                     ✓ own     ✗         ✓ own     ✗        Own record
organizations             ✓ member  ✗         ✓ admin   ✓ owner  Member check
organization_members      ✓ member  ✓ admin   ✓ admin   ✓ admin  Admin control
projects                  ✓ member  ✓ admin   ✓ owner   ✓ owner  Via org
test_suites              ✓ member  ✓ editor  ✓ editor  ✓ admin  Via project
test_cases               ✓ member  ✓ editor  ✓ editor  ✓ admin  Via project
test_request_configs     ✓ member  ✓ editor  ✓ editor  ✓ admin  Via test
test_response_specs      ✓ member  ✓ editor  ✓ editor  ✓ admin  Via test
test_data_fixtures       ✓ member  ✓ editor  ✓ editor  ✓ admin  Via project
environments             ✓ member  ✓ admin   ✓ admin   ✓ admin  Via project
environment_variables    ✓ admin   ✓ admin   ✓ admin   ✓ admin  Secrets only
api_credentials          ✓ own     ✓         ✓ own     ✓ own    User-specific
test_runs                ✓ member  ✓ editor  ✗         ✗        Read-only
test_results             ✓ member  ✗         ✗         ✗        Automatic insert
test_execution_context   ✓ owner   ✗         ✗         ✗        System write
performance_metrics      ✓ member  ✗         ✗         ✗        System insert
failure_analysis         ✓ member  ✗         ✗         ✗        System insert
report_templates         ✓ owner   ✓ owner   ✓ owner   ✓ owner  User-specific
user_preferences         ✓ owner   ✓ owner   ✓ owner   ✓ owner  User-specific


RLS Policy Examples
───────────────────

1. API Credentials (Most Restrictive)
   ─────────────────────────────────
   CREATE POLICY api_credentials_user_access ON api_credentials
     FOR SELECT USING (user_id = auth.uid());

   CREATE POLICY api_credentials_user_write ON api_credentials
     FOR ALL USING (user_id = auth.uid())
     WITH CHECK (user_id = auth.uid());

   Effect:
   ├─ User can only see own credentials
   ├─ User can only modify own credentials
   └─ Organization admins CANNOT see member credentials (privacy)


2. Test Runs (Organization-Level Access)
   ──────────────────────────────────────
   CREATE POLICY test_runs_org_access ON test_runs
     FOR SELECT USING (
       EXISTS (
         SELECT 1 FROM projects p
         JOIN organization_members om ON om.organization_id = p.organization_id
         WHERE p.id = test_runs.project_id
         AND om.user_id = auth.uid()
       )
     );

   Effect:
   ├─ Any member of the organization can view test runs
   ├─ Cross-member visibility within same org
   └─ Cannot see tests from other organizations


3. Projects (Creator-Based Write)
   ────────────────────────────────
   CREATE POLICY projects_creator_write ON projects
     FOR ALL USING (created_by = auth.uid())
     WITH CHECK (created_by = auth.uid());

   CREATE POLICY projects_org_access ON projects
     FOR SELECT USING (
       EXISTS (
         SELECT 1 FROM organization_members
         WHERE organization_id = projects.organization_id
         AND user_id = auth.uid()
       )
     );

   Effect:
   ├─ Anyone can view projects in their organization
   ├─ Only creator can edit their project
   ├─ Admin can override via role check (separate policy)
   └─ Prevents accidental deletion by other members


Encryption at Rest
──────────────────

Sensitive columns encrypted with pgcrypto:

  api_credentials:
  ├─ key_secret: pgp_sym_encrypt(secret, encryption_key)
  ├─ token: pgp_sym_encrypt(token, encryption_key)
  └─ oauth_refresh_token: pgp_sym_encrypt(refresh, encryption_key)

  environment_variables (is_secret = true):
  └─ value: pgp_sym_encrypt(value, encryption_key)


Audit Logging
─────────────

Track sensitive operations:

  CREATE TABLE audit_logs (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    table_name TEXT,
    operation TEXT, -- INSERT, UPDATE, DELETE
    record_id UUID,
    old_values JSONB,
    new_values JSONB,
    created_at TIMESTAMP DEFAULT NOW()
  );

  Triggers on:
  ├─ api_credentials (all operations)
  ├─ environment_variables (DELETE, UPDATE)
  ├─ test_runs (INSERT, UPDATE to status)
  └─ organization_members (all operations)
```

---

## 9. PERFORMANCE BASELINES & THRESHOLDS

```
┌─────────────────────────────────────────────────────────────────────────────┐
│               PERFORMANCE METRICS & ALERT THRESHOLDS                         │
└─────────────────────────────────────────────────────────────────────────────┘

Default Thresholds
──────────────────

Metric                          Green       Yellow      Red
────────────────────────────────────────────────────────────
Test Pass Rate                  > 95%       80-95%      < 80%
Response Time (avg)             < 500ms     500-1000ms  > 1000ms
Response Time (p95)             < 1000ms    1000-2000ms > 2000ms
Test Execution Time (per test)  < 5s        5-10s       > 10s
Test Suite Duration             < 5min      5-10min     > 10min


Flaky Test Detection
───────────────────

A test is considered "flaky" when:
  ├─ Failure count >= 3 in last 7 days, AND
  ├─ Success rate < 90%, AND
  └─ Not caused by environment/configuration changes

Flakiness Score = failures / (failures + successes)

  Green:  < 0.10 (< 10% flaky) - Stable
  Yellow: 0.10 - 0.30 (10-30% flaky) - Watch
  Red:    > 0.30 (> 30% flaky) - Investigate


Performance Regression Detection
────────────────────────────────

Daily comparison:
  1. Get today's avg_response_time
  2. Get last 7-day avg_response_time
  3. Calculate: regression_pct = (today - baseline) / baseline

  If regression_pct > 20%:
    └─ Trigger: performance_degradation alert
       ├─ Send notification
       └─ Mark in failure_analysis

Example:
  ├─ Baseline (7-day avg): 450ms
  ├─ Today's avg: 580ms
  ├─ Regression: (580-450)/450 = 28.9% ⚠
  └─ Alert: "Test 'CreateDocument' 29% slower than baseline"


Storage Quota Management
───────────────────────

Organization limits (configurable):
  ├─ Small plan: 10GB test data per month
  ├─ Medium plan: 50GB test data per month
  ├─ Large plan: 500GB+ unlimited

Monitoring:
  SELECT
    org.id, org.name,
    SUM(pg_total_relation_size(tablename)::BIGINT) as total_size
  FROM organizations org
  CROSS JOIN (
    SELECT unnest(array[
      'test_results'::regclass,
      'test_result_details'::regclass,
      'performance_metrics'::regclass
    ]) as tablename
  ) tables
  GROUP BY org.id, org.name
  ORDER BY total_size DESC;

  If usage > 80% quota:
    └─ Alert: "Organization approaching storage limit"

  If usage > 100% quota:
    └─ Block: "Storage quota exceeded"
```

---

## 10. IMPLEMENTATION ROADMAP

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      IMPLEMENTATION PHASE PLAN                               │
└─────────────────────────────────────────────────────────────────────────────┘

Phase 1: Foundation (Week 1-2)
───────────────────────────────
  ├─ Create Supabase project & run schema.sql
  ├─ Set up RLS policies
  ├─ Implement TestExecutionContextManager
  ├─ Create TypeScript types
  ├─ Build Request/Response builders
  └─ Write unit tests for context management

Phase 2: Core Testing Engine (Week 3-4)
────────────────────────────────────────
  ├─ Build Test Orchestrator
  ├─ Implement Assertion Engine
  ├─ Add retry & timeout logic
  ├─ Build variable capture system
  ├─ Implement dependency resolution
  └─ Integration tests with test database

Phase 3: Observability & Analytics (Week 5)
────────────────────────────────────────────
  ├─ Build Performance Metrics aggregation
  ├─ Implement Failure Analysis
  ├─ Add Flaky Test Detection
  ├─ Create dashboards
  └─ Set up alerting system

Phase 4: Real-time Features (Week 6)
─────────────────────────────────────
  ├─ Wire up Supabase Realtime
  ├─ Build WebSocket subscriptions
  ├─ Implement live test progress
  ├─ Add push notifications
  └─ Build reactive UI components

Phase 5: Reporting & Export (Week 7)
─────────────────────────────────────
  ├─ Implement Report Templates
  ├─ Build Export functionality (PDF, CSV)
  ├─ Add scheduling/email reports
  ├─ Integrate with Slack webhooks
  └─ Create API for third-party integrations

Phase 6: Scaling & Optimization (Week 8)
─────────────────────────────────────────
  ├─ Implement Redis caching layer
  ├─ Add distributed test execution
  ├─ Optimize database indexes
  ├─ Set up data cleanup jobs
  └─ Load testing & performance tuning
```

---

## Summary

This architecture provides:

1. **Centralized Context Management**: All execution state in one place, accessible across tests
2. **Real-time Synchronization**: WebSocket updates for live test execution
3. **Scalability**: Partitioned data, intelligent caching, archive strategy
4. **Security**: RLS policies, credential encryption, audit logging
5. **Observability**: Comprehensive metrics, failure analysis, flaky test detection
6. **Flexibility**: Support for dependent tests, parallel execution, custom assertions

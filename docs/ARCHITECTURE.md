# Legito REST API v7 Testing Architecture

## Executive Summary

This document defines the comprehensive testing architecture for the Legito REST API v7. The architecture is designed for modularity, parallel execution, test isolation, and extensibility, with Supabase as the backend for storing test results, configurations, and reports.

---

## 1. High-Level Architecture Overview

```
+------------------------------------------------------------------+
|                    TEST EXECUTION LAYER                          |
+------------------------------------------------------------------+
|  Smoke Tests | Unit Tests | Integration Tests | E2E Tests        |
+------------------------------------------------------------------+
                              |
                              v
+------------------------------------------------------------------+
|                    TEST ORCHESTRATION LAYER                      |
+------------------------------------------------------------------+
|  Test Runner (Jest/Vitest) | Parallel Executor | Report Generator|
+------------------------------------------------------------------+
                              |
                              v
+------------------------------------------------------------------+
|                    CORE FRAMEWORK LAYER                          |
+------------------------------------------------------------------+
|  API Client | Auth Manager | Fixture Manager | Rate Limiter     |
|  Assertion Library | Test Context | Data Factory | Cleanup Svc  |
+------------------------------------------------------------------+
                              |
                              v
+------------------------------------------------------------------+
|                    INFRASTRUCTURE LAYER                          |
+------------------------------------------------------------------+
|  Legito API v7 | Supabase (Results/Config) | Test Environments  |
+------------------------------------------------------------------+
```

---

## 2. Folder Structure

```
legito-api-tests/
├── .env.example                    # Environment template
├── .env.test                       # Test environment config (gitignored)
├── jest.config.ts                  # Jest configuration
├── vitest.config.ts                # Vitest configuration (alternative)
├── package.json
├── tsconfig.json
│
├── config/
│   ├── index.ts                    # Configuration aggregator
│   ├── environments.ts             # Environment-specific settings
│   ├── endpoints.ts                # API endpoint definitions
│   ├── rate-limits.ts              # Rate limiting configuration
│   └── test-suites.ts              # Test suite definitions
│
├── src/
│   ├── core/
│   │   ├── client/
│   │   │   ├── api-client.ts       # Base HTTP client with interceptors
│   │   │   ├── request-builder.ts  # Fluent request construction
│   │   │   ├── response-handler.ts # Response parsing and validation
│   │   │   └── retry-handler.ts    # Retry logic with backoff
│   │   │
│   │   ├── auth/
│   │   │   ├── jwt-manager.ts      # JWT generation and validation
│   │   │   ├── token-cache.ts      # Token caching with TTL
│   │   │   └── auth-interceptor.ts # Request authentication
│   │   │
│   │   ├── rate-limiting/
│   │   │   ├── rate-limiter.ts     # Rate limit tracking
│   │   │   ├── throttle-queue.ts   # Request queue management
│   │   │   └── backoff-strategy.ts # Exponential backoff
│   │   │
│   │   ├── context/
│   │   │   ├── test-context.ts     # Test execution context
│   │   │   ├── isolation-manager.ts # Test data isolation
│   │   │   └── cleanup-tracker.ts  # Resource cleanup tracking
│   │   │
│   │   └── assertions/
│   │       ├── api-assertions.ts   # Custom API assertions
│   │       ├── schema-validator.ts # JSON Schema validation
│   │       └── matchers.ts         # Custom Jest matchers
│   │
│   ├── data/
│   │   ├── factories/
│   │   │   ├── base-factory.ts     # Abstract factory
│   │   │   ├── document-factory.ts # Document test data
│   │   │   ├── user-factory.ts     # User test data
│   │   │   ├── template-factory.ts # Template test data
│   │   │   ├── workflow-factory.ts # Workflow test data
│   │   │   └── index.ts            # Factory exports
│   │   │
│   │   ├── fixtures/
│   │   │   ├── static/             # Static test fixtures
│   │   │   │   ├── documents/
│   │   │   │   ├── templates/
│   │   │   │   └── users/
│   │   │   ├── dynamic/            # Dynamically generated
│   │   │   └── fixture-loader.ts   # Fixture management
│   │   │
│   │   └── seeds/
│   │       ├── base-seeder.ts      # Abstract seeder
│   │       ├── test-seeder.ts      # Test data seeding
│   │       └── cleanup-seeder.ts   # Cleanup utilities
│   │
│   ├── services/
│   │   ├── supabase/
│   │   │   ├── client.ts           # Supabase client setup
│   │   │   ├── results-service.ts  # Test results storage
│   │   │   ├── config-service.ts   # Configuration storage
│   │   │   ├── reports-service.ts  # Report generation
│   │   │   └── metrics-service.ts  # Test metrics tracking
│   │   │
│   │   └── legito/
│   │       ├── document-service.ts # Document API wrapper
│   │       ├── version-service.ts  # Version API wrapper
│   │       ├── template-service.ts # Template API wrapper
│   │       ├── user-service.ts     # User API wrapper
│   │       ├── sharing-service.ts  # Sharing API wrapper
│   │       ├── workflow-service.ts # Workflow API wrapper
│   │       └── system-service.ts   # System data wrapper
│   │
│   └── utils/
│       ├── logger.ts               # Structured logging
│       ├── timing.ts               # Performance timing
│       ├── id-generator.ts         # Unique ID generation
│       ├── file-helpers.ts         # File operations
│       └── crypto-helpers.ts       # Encryption utilities
│
├── tests/
│   ├── setup/
│   │   ├── global-setup.ts         # Global test setup
│   │   ├── global-teardown.ts      # Global cleanup
│   │   ├── test-environment.ts     # Custom test environment
│   │   └── setup-files.ts          # Per-file setup
│   │
│   ├── smoke/
│   │   ├── health-check.smoke.ts   # API health verification
│   │   ├── auth.smoke.ts           # Authentication smoke test
│   │   └── core-endpoints.smoke.ts # Core endpoint availability
│   │
│   ├── unit/
│   │   ├── auth/
│   │   │   ├── jwt-manager.unit.ts
│   │   │   └── token-cache.unit.ts
│   │   ├── client/
│   │   │   ├── api-client.unit.ts
│   │   │   └── retry-handler.unit.ts
│   │   └── utils/
│   │       └── helpers.unit.ts
│   │
│   ├── integration/
│   │   ├── documents/
│   │   │   ├── documents-crud.int.ts
│   │   │   ├── documents-versions.int.ts
│   │   │   └── documents-download.int.ts
│   │   ├── templates/
│   │   │   ├── templates-crud.int.ts
│   │   │   └── template-suites.int.ts
│   │   ├── users/
│   │   │   ├── users-crud.int.ts
│   │   │   └── user-groups.int.ts
│   │   ├── sharing/
│   │   │   ├── sharing-users.int.ts
│   │   │   ├── sharing-groups.int.ts
│   │   │   └── sharing-external.int.ts
│   │   ├── workflows/
│   │   │   ├── workflows-crud.int.ts
│   │   │   └── push-connections.int.ts
│   │   ├── files/
│   │   │   └── file-management.int.ts
│   │   └── system/
│   │       ├── styles.int.ts
│   │       ├── categories.int.ts
│   │       └── reference-data.int.ts
│   │
│   ├── e2e/
│   │   ├── scenarios/
│   │   │   ├── document-lifecycle.e2e.ts
│   │   │   ├── template-publishing.e2e.ts
│   │   │   ├── user-onboarding.e2e.ts
│   │   │   ├── sharing-workflow.e2e.ts
│   │   │   └── approval-workflow.e2e.ts
│   │   └── journeys/
│   │       ├── new-user-journey.e2e.ts
│   │       └── document-creation-journey.e2e.ts
│   │
│   └── performance/
│       ├── load/
│       │   └── document-endpoints.load.ts
│       └── stress/
│           └── concurrent-operations.stress.ts
│
├── reports/
│   ├── templates/
│   │   ├── html-report.hbs         # HTML report template
│   │   └── summary-report.hbs      # Summary template
│   └── generated/                  # Generated reports (gitignored)
│
├── scripts/
│   ├── run-smoke.ts                # Smoke test runner
│   ├── run-integration.ts          # Integration test runner
│   ├── run-e2e.ts                  # E2E test runner
│   ├── generate-report.ts          # Report generation
│   ├── cleanup-test-data.ts        # Test data cleanup
│   └── setup-supabase-schema.ts    # Supabase schema setup
│
└── types/
    ├── api/
    │   ├── documents.ts            # Document API types
    │   ├── templates.ts            # Template API types
    │   ├── users.ts                # User API types
    │   ├── sharing.ts              # Sharing API types
    │   ├── workflows.ts            # Workflow API types
    │   └── system.ts               # System data types
    ├── test/
    │   ├── context.ts              # Test context types
    │   ├── fixtures.ts             # Fixture types
    │   └── results.ts              # Test result types
    └── supabase/
        └── database.ts             # Generated Supabase types
```

---

## 3. Test Categories and Execution Strategy

### 3.1 Test Category Definitions

| Category    | Purpose                              | Execution Time | Frequency        | Isolation Level |
|-------------|--------------------------------------|----------------|------------------|-----------------|
| Smoke       | Verify API availability and auth     | < 30 seconds   | Every deployment | Shared          |
| Unit        | Test internal framework components   | < 1 minute     | Every commit     | Complete        |
| Integration | Test individual API endpoints        | 5-15 minutes   | Every PR         | Per-test        |
| E2E         | Test complete business workflows     | 15-30 minutes  | Nightly/Release  | Per-suite       |
| Performance | Load and stress testing              | 30+ minutes    | Weekly/Release   | Dedicated       |

### 3.2 Test Tagging Strategy

```typescript
// Test tags for selective execution
type TestTag =
  | 'smoke'           // Quick health checks
  | 'unit'            // Unit tests
  | 'integration'     // Integration tests
  | 'e2e'             // End-to-end tests
  | 'performance'     // Performance tests
  | 'documents'       // Document-related
  | 'templates'       // Template-related
  | 'users'           // User-related
  | 'sharing'         // Sharing-related
  | 'workflows'       // Workflow-related
  | 'system'          // System data
  | 'critical'        // Critical path tests
  | 'regression'      // Regression tests
  | 'destructive'     // Tests that modify data
  | 'read-only';      // Read-only tests
```

### 3.3 Execution Parallelization Strategy

```
PARALLEL EXECUTION MODEL
========================

Level 1: Suite-Level Parallelism
--------------------------------
[Documents Suite] [Templates Suite] [Users Suite] [Sharing Suite]
       |                 |               |              |
       v                 v               v              v
   Worker 1          Worker 2        Worker 3       Worker 4

Level 2: Test-Level Parallelism (within suite)
----------------------------------------------
Each suite can run multiple tests concurrently with isolated contexts:

Documents Suite (Worker 1):
  ├── [Test: Create Document]    -> TestContext-A (prefix: doc_a_)
  ├── [Test: Update Document]    -> TestContext-B (prefix: doc_b_)
  └── [Test: Delete Document]    -> TestContext-C (prefix: doc_c_)

Isolation via Naming Convention:
  - Each test context generates unique prefixes
  - Format: {suite}_{test}_{timestamp}_{random}
  - Example: documents_crud_1704067200_x7k2
```

---

## 4. Core Component Specifications

### 4.1 API Client Architecture

```
+-------------------------------------------------------------------+
|                         API CLIENT                                 |
+-------------------------------------------------------------------+
|                                                                   |
|  +------------------+     +------------------+                    |
|  | Request Builder  |---->| Auth Interceptor |                    |
|  +------------------+     +------------------+                    |
|          |                        |                               |
|          v                        v                               |
|  +------------------+     +------------------+                    |
|  | Rate Limiter     |---->| HTTP Transport   |                    |
|  +------------------+     +------------------+                    |
|          |                        |                               |
|          v                        v                               |
|  +------------------+     +------------------+                    |
|  | Retry Handler    |<----| Response Handler |                    |
|  +------------------+     +------------------+                    |
|          |                        |                               |
|          +--------+    +----------+                               |
|                   |    |                                          |
|                   v    v                                          |
|            +------------------+                                   |
|            | Response/Error   |                                   |
|            +------------------+                                   |
+-------------------------------------------------------------------+

Request Flow:
1. Request Builder constructs the request
2. Auth Interceptor adds JWT token
3. Rate Limiter checks/queues request
4. HTTP Transport sends request
5. Response Handler parses response
6. Retry Handler manages failures
```

### 4.2 JWT Authentication Manager

```
JWT TOKEN LIFECYCLE
===================

+------------------+     +------------------+     +------------------+
|  Token Request   |---->|  Token Cache     |---->|  Cache Hit?      |
+------------------+     +------------------+     +------------------+
                                                         |
                              +-------------+------------+
                              |             |
                              v             v
                         [Yes: Return]  [No: Generate]
                                            |
                                            v
                              +------------------+
                              |  JWT Generator   |
                              +------------------+
                              |  - iss: API Key  |
                              |  - iat: now      |
                              |  - exp: now+TTL  |
                              +------------------+
                                            |
                                            v
                              +------------------+
                              |  HS256 Sign      |
                              +------------------+
                                            |
                                            v
                              +------------------+
                              |  Store in Cache  |
                              +------------------+

Token Structure:
{
  "header": {
    "alg": "HS256",
    "typ": "JWT"
  },
  "payload": {
    "iss": "<api_key>",
    "iat": <unix_timestamp>,
    "exp": <unix_timestamp + 3600>
  }
}
```

### 4.3 Test Context and Isolation

```
TEST CONTEXT ISOLATION MODEL
============================

Per-Test Context:
+------------------------------------------------------------------+
|  TestContext                                                      |
+------------------------------------------------------------------+
|  - contextId: string (unique per test)                           |
|  - prefix: string (for resource naming)                          |
|  - createdResources: Map<ResourceType, ResourceId[]>             |
|  - cleanupQueue: PriorityQueue<CleanupTask>                      |
|  - apiClient: ApiClient (with context-specific settings)         |
|  - startTime: Date                                                |
|  - metadata: TestMetadata                                         |
+------------------------------------------------------------------+

Resource Tracking:
  TestContext tracks all resources created during test:

  createdResources = {
    'documents': ['doc_123', 'doc_456'],
    'users': ['user_789'],
    'templates': ['tmpl_abc'],
    'shares': ['share_def']
  }

Cleanup Priority (executed in reverse dependency order):
  1. Shares/Permissions (highest priority - must be removed first)
  2. Document Versions
  3. Documents
  4. Templates
  5. Users
  6. System Data (lowest priority)
```

---

## 5. Data Management Strategy

### 5.1 Test Data Factory Pattern

```
FACTORY PATTERN HIERARCHY
=========================

                    +-------------------+
                    |   BaseFactory<T>  |
                    +-------------------+
                    | + build(): T      |
                    | + create(): T     |
                    | + buildMany(n): T[]|
                    | + createMany(n): T[]|
                    +-------------------+
                            ^
            +---------------+---------------+
            |               |               |
   +----------------+ +----------------+ +----------------+
   |DocumentFactory | |TemplateFactory | |  UserFactory   |
   +----------------+ +----------------+ +----------------+
   | + withTitle()  | | + withTags()   | | + withRole()   |
   | + withContent()| | + withSuite()  | | + withGroup()  |
   | + asDraft()    | | + asPublished()| | + asAdmin()    |
   +----------------+ +----------------+ +----------------+

Usage Pattern:
  - build(): Creates in-memory object (no API call)
  - create(): Creates object via API (returns created resource)
  - Fluent interface for customization
```

### 5.2 Fixture Management

```
FIXTURE LIFECYCLE
=================

          +------------------+
          |  Test Suite      |
          |  beforeAll()     |
          +------------------+
                   |
                   v
          +------------------+
          |  Load Fixtures   |
          |  (Static/Dynamic)|
          +------------------+
                   |
        +----------+----------+
        |                     |
        v                     v
+----------------+    +----------------+
| Static Fixtures|    |Dynamic Fixtures|
| (JSON files)   |    | (Factories)    |
+----------------+    +----------------+
        |                     |
        +----------+----------+
                   |
                   v
          +------------------+
          |  Seed Test Data  |
          |  via API         |
          +------------------+
                   |
                   v
          +------------------+
          |  Run Tests       |
          +------------------+
                   |
                   v
          +------------------+
          |  Cleanup         |
          |  (afterAll)      |
          +------------------+
                   |
                   v
          +------------------+
          |  Verify Cleanup  |
          +------------------+
```

### 5.3 Test Data Isolation Strategies

```
ISOLATION LEVELS
================

1. COMPLETE ISOLATION (Unit Tests)
   - No external dependencies
   - All external calls mocked
   - No shared state

2. CONTEXT ISOLATION (Integration Tests)
   - Each test has unique prefix
   - Resources named: {prefix}_{resourceType}_{id}
   - Cleanup after each test
   - Example: "int_doc_a7x2_document_12345"

3. SUITE ISOLATION (E2E Tests)
   - Shared setup for entire suite
   - Resources shared within suite
   - Cleanup after suite completes
   - Example: "e2e_workflow_suite_template_shared"

4. ENVIRONMENT ISOLATION (Performance Tests)
   - Dedicated test environment
   - Pre-provisioned data sets
   - No cleanup during tests
   - Periodic full cleanup
```

---

## 6. Supabase Integration Design

### 6.1 Database Schema

```sql
-- Test Run Tracking
CREATE TABLE test_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id VARCHAR(100) UNIQUE NOT NULL,
    environment VARCHAR(50) NOT NULL,
    branch VARCHAR(100),
    commit_sha VARCHAR(40),
    triggered_by VARCHAR(100),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL DEFAULT 'running',
    total_tests INTEGER DEFAULT 0,
    passed_tests INTEGER DEFAULT 0,
    failed_tests INTEGER DEFAULT 0,
    skipped_tests INTEGER DEFAULT 0,
    duration_ms INTEGER,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Individual Test Results
CREATE TABLE test_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id VARCHAR(100) NOT NULL REFERENCES test_runs(run_id),
    test_id VARCHAR(200) NOT NULL,
    test_name VARCHAR(500) NOT NULL,
    suite_name VARCHAR(200),
    category VARCHAR(50) NOT NULL,
    tags TEXT[],
    status VARCHAR(20) NOT NULL,
    duration_ms INTEGER,
    error_message TEXT,
    error_stack TEXT,
    assertions_passed INTEGER DEFAULT 0,
    assertions_failed INTEGER DEFAULT 0,
    request_logs JSONB,
    response_logs JSONB,
    screenshots TEXT[],
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Test Configurations
CREATE TABLE test_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_name VARCHAR(100) UNIQUE NOT NULL,
    environment VARCHAR(50) NOT NULL,
    api_base_url VARCHAR(500) NOT NULL,
    rate_limit_rpm INTEGER DEFAULT 60,
    timeout_ms INTEGER DEFAULT 30000,
    retry_attempts INTEGER DEFAULT 3,
    parallel_workers INTEGER DEFAULT 4,
    feature_flags JSONB,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Test Metrics (for trending/analysis)
CREATE TABLE test_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id VARCHAR(100) NOT NULL REFERENCES test_runs(run_id),
    endpoint VARCHAR(200) NOT NULL,
    method VARCHAR(10) NOT NULL,
    avg_response_time_ms DECIMAL(10,2),
    min_response_time_ms INTEGER,
    max_response_time_ms INTEGER,
    p95_response_time_ms INTEGER,
    p99_response_time_ms INTEGER,
    request_count INTEGER,
    error_count INTEGER,
    error_rate DECIMAL(5,4),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Flaky Test Tracking
CREATE TABLE flaky_tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id VARCHAR(200) NOT NULL,
    test_name VARCHAR(500) NOT NULL,
    flake_count INTEGER DEFAULT 1,
    last_flake_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    first_flake_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    flake_history JSONB,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(test_id)
);

-- Test Reports
CREATE TABLE test_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id VARCHAR(100) NOT NULL REFERENCES test_runs(run_id),
    report_type VARCHAR(50) NOT NULL,
    format VARCHAR(20) NOT NULL,
    storage_path VARCHAR(500),
    public_url VARCHAR(500),
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_test_runs_status ON test_runs(status);
CREATE INDEX idx_test_runs_environment ON test_runs(environment);
CREATE INDEX idx_test_runs_started_at ON test_runs(started_at DESC);
CREATE INDEX idx_test_results_run_id ON test_results(run_id);
CREATE INDEX idx_test_results_status ON test_results(status);
CREATE INDEX idx_test_results_category ON test_results(category);
CREATE INDEX idx_test_metrics_run_id ON test_metrics(run_id);
CREATE INDEX idx_test_metrics_endpoint ON test_metrics(endpoint);
CREATE INDEX idx_flaky_tests_test_id ON flaky_tests(test_id);

-- Row Level Security
ALTER TABLE test_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE flaky_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_reports ENABLE ROW LEVEL SECURITY;
```

### 6.2 Supabase Data Flow

```
SUPABASE INTEGRATION DATA FLOW
==============================

Test Execution Flow:
+------------------+     +------------------+     +------------------+
|  Test Runner     |---->|  Results Service |---->|  Supabase DB     |
|  (Jest/Vitest)   |     |  (Real-time)     |     |  (PostgreSQL)    |
+------------------+     +------------------+     +------------------+
        |                        |                        |
        v                        v                        v
  [Test Events]           [Insert/Update]          [Stored Data]
  - started                - test_runs              - Results
  - passed                 - test_results           - Metrics
  - failed                 - test_metrics           - Reports
  - completed

Configuration Flow:
+------------------+     +------------------+     +------------------+
|  Test Setup      |<----|  Config Service  |<----|  Supabase DB     |
+------------------+     +------------------+     +------------------+
        |                        |                        |
        v                        v                        v
  [Apply Config]           [Fetch Active]          [Configurations]
  - Rate limits            - Environment           - API URLs
  - Timeouts               - Feature flags         - Limits
  - Workers                - Overrides             - Settings

Report Generation Flow:
+------------------+     +------------------+     +------------------+
|  Report Script   |---->|  Reports Service |---->|  Supabase        |
+------------------+     +------------------+     |  Storage         |
        |                        |               +------------------+
        v                        v                        |
  [Aggregate Data]         [Generate HTML/JSON]          v
  [Create Charts]          [Upload to Storage]     [Public URLs]
```

---

## 7. Rate Limiting Architecture

### 7.1 Rate Limiter Design

```
RATE LIMITING STRATEGY
======================

Token Bucket Algorithm:
+------------------------------------------------------------------+
|                     Rate Limiter                                  |
+------------------------------------------------------------------+
|  bucket: {                                                        |
|    capacity: 60,          // Max tokens (requests per window)     |
|    tokens: 60,            // Current available tokens             |
|    refillRate: 1,         // Tokens added per second              |
|    lastRefill: timestamp  // Last refill time                     |
|  }                                                                |
+------------------------------------------------------------------+

Request Flow:
                  +------------------+
                  |  Incoming        |
                  |  Request         |
                  +------------------+
                           |
                           v
                  +------------------+
                  |  Check Tokens    |
                  |  Available?      |
                  +------------------+
                           |
              +------------+------------+
              |                         |
              v                         v
        [Yes: Proceed]           [No: Queue/Wait]
              |                         |
              v                         v
        +------------------+    +------------------+
        |  Consume Token   |    |  Throttle Queue  |
        |  Execute Request |    |  with Backoff    |
        +------------------+    +------------------+
                                        |
                                        v
                                +------------------+
                                |  Retry when      |
                                |  Tokens Refill   |
                                +------------------+

Adaptive Rate Limiting:
- Monitor 429 responses
- Automatically reduce rate on limit hits
- Gradually increase after successful requests
- Per-endpoint rate tracking
```

### 7.2 Backoff Strategy

```
EXPONENTIAL BACKOFF WITH JITTER
===============================

Retry Sequence:
  Attempt 1: Wait 0ms (immediate)
  Attempt 2: Wait 1000ms + random(0-500)ms
  Attempt 3: Wait 2000ms + random(0-500)ms
  Attempt 4: Wait 4000ms + random(0-500)ms
  Attempt 5: Wait 8000ms + random(0-500)ms
  [Max attempts reached - fail]

Formula:
  delay = min(maxDelay, baseDelay * 2^attempt) + random(0, jitter)

  where:
    baseDelay = 1000ms
    maxDelay = 30000ms
    jitter = 500ms

Rate Limit Response Handling:
  - Parse Retry-After header if present
  - Use header value if available
  - Fall back to exponential backoff
  - Track rate limit hits for adaptive adjustment
```

---

## 8. Parallel Execution Architecture

### 8.1 Worker Pool Design

```
PARALLEL EXECUTION MODEL
========================

                    +------------------+
                    |  Test Runner     |
                    |  (Orchestrator)  |
                    +------------------+
                            |
            +---------------+---------------+
            |               |               |
            v               v               v
    +-------------+  +-------------+  +-------------+
    |  Worker 1   |  |  Worker 2   |  |  Worker 3   |
    | (Suite: Doc)|  | (Suite:Tmpl)|  | (Suite:User)|
    +-------------+  +-------------+  +-------------+
            |               |               |
            v               v               v
    +-------------+  +-------------+  +-------------+
    | TestContext |  | TestContext |  | TestContext |
    | (Isolated)  |  | (Isolated)  |  | (Isolated)  |
    +-------------+  +-------------+  +-------------+
            |               |               |
            +---------------+---------------+
                            |
                            v
                    +------------------+
                    |  Results         |
                    |  Aggregator      |
                    +------------------+
                            |
                            v
                    +------------------+
                    |  Supabase        |
                    |  (Results Store) |
                    +------------------+

Worker Isolation Rules:
1. Each worker has independent API client instance
2. Each worker has unique context prefix
3. Workers share rate limiter (global limits)
4. Workers share configuration (read-only)
5. Workers write independently to results store
```

### 8.2 Test Sharding Strategy

```
SHARDING FOR CI/CD
==================

Shard Distribution:
  Total Tests: 200
  CI Workers: 4
  Tests per Shard: 50

Shard 1 (Worker 1):          Shard 2 (Worker 2):
  - documents-crud-1-25      - documents-crud-26-50
  - templates-crud-1-25      - templates-crud-26-50

Shard 3 (Worker 3):          Shard 4 (Worker 4):
  - users-crud-1-25          - users-crud-26-50
  - sharing-crud-1-25        - sharing-crud-26-50

Sharding Algorithm:
  shardIndex = hash(testId) % totalShards

  Benefits:
  - Deterministic assignment
  - Even distribution
  - Test locality (related tests same shard)
```

---

## 9. Extensibility Design

### 9.1 Plugin Architecture

```
PLUGIN SYSTEM FOR NEW ENDPOINTS
===============================

                    +------------------+
                    |  Test Framework  |
                    |  Core            |
                    +------------------+
                            |
            +---------------+---------------+
            |               |               |
            v               v               v
    +-------------+  +-------------+  +-------------+
    | Documents   |  | Templates   |  | [New Plugin]|
    | Plugin      |  | Plugin      |  |             |
    +-------------+  +-------------+  +-------------+
            |               |               |
            v               v               v
    +-------------+  +-------------+  +-------------+
    | - Service   |  | - Service   |  | - Service   |
    | - Factory   |  | - Factory   |  | - Factory   |
    | - Tests     |  | - Tests     |  | - Tests     |
    | - Fixtures  |  | - Fixtures  |  | - Fixtures  |
    +-------------+  +-------------+  +-------------+

Adding New Endpoint Tests:
1. Create service wrapper (src/services/legito/new-service.ts)
2. Create data factory (src/data/factories/new-factory.ts)
3. Add fixtures (src/data/fixtures/static/new-resource/)
4. Create tests (tests/integration/new-resource/*.int.ts)
5. Register in config (config/endpoints.ts)
```

### 9.2 Test Template Pattern

```typescript
// Template for new endpoint tests
// tests/integration/_templates/endpoint.template.ts

import { TestContext } from '@/core/context/test-context';
import { NewResourceService } from '@/services/legito/new-resource-service';
import { NewResourceFactory } from '@/data/factories/new-resource-factory';

describe('NewResource API', () => {
  let context: TestContext;
  let service: NewResourceService;
  let factory: NewResourceFactory;

  beforeAll(async () => {
    context = await TestContext.create('new-resource');
    service = new NewResourceService(context.apiClient);
    factory = new NewResourceFactory(context);
  });

  afterAll(async () => {
    await context.cleanup();
  });

  describe('CRUD Operations', () => {
    it('should create a new resource', async () => {
      const data = factory.build();
      const result = await service.create(data);

      expect(result).toMatchSchema('NewResourceSchema');
      context.trackResource('new-resource', result.id);
    });

    it('should retrieve a resource', async () => {
      const created = await factory.create();
      const result = await service.get(created.id);

      expect(result.id).toBe(created.id);
    });

    // ... more tests
  });
});
```

---

## 10. Error Handling and Reporting

### 10.1 Error Classification

```
ERROR TAXONOMY
==============

Category: Test Failures
├── Assertion Failures
│   ├── Schema Mismatch
│   ├── Value Mismatch
│   └── Missing Field
├── API Errors
│   ├── 4xx Client Errors
│   │   ├── 400 Bad Request
│   │   ├── 401 Unauthorized
│   │   ├── 403 Forbidden
│   │   ├── 404 Not Found
│   │   └── 429 Rate Limited
│   └── 5xx Server Errors
│       ├── 500 Internal Error
│       ├── 502 Bad Gateway
│       └── 503 Service Unavailable
├── Infrastructure Errors
│   ├── Network Timeout
│   ├── Connection Refused
│   └── DNS Resolution
└── Test Infrastructure Errors
    ├── Setup Failure
    ├── Cleanup Failure
    └── Fixture Load Failure
```

### 10.2 Error Context Collection

```
ERROR CONTEXT CAPTURE
=====================

For each failed test, collect:

+------------------------------------------------------------------+
|  Error Context                                                    |
+------------------------------------------------------------------+
|  Test Information:                                                |
|    - testId: "documents-crud-create-01"                          |
|    - testName: "should create document with valid data"          |
|    - suite: "Documents CRUD"                                     |
|    - category: "integration"                                     |
|    - tags: ["documents", "crud", "create"]                       |
|                                                                   |
|  Request Context:                                                 |
|    - endpoint: "POST /api/v7/documents"                          |
|    - requestBody: { ... }                                        |
|    - headers: { ... }                                            |
|    - timestamp: "2024-01-01T10:00:00Z"                           |
|                                                                   |
|  Response Context:                                                |
|    - statusCode: 400                                              |
|    - responseBody: { error: "...", code: "..." }                 |
|    - responseTime: 234                                            |
|    - headers: { ... }                                            |
|                                                                   |
|  Error Details:                                                   |
|    - message: "Expected status 201 but got 400"                  |
|    - stack: "..."                                                 |
|    - assertion: "expect(status).toBe(201)"                       |
|                                                                   |
|  Environment:                                                     |
|    - environment: "staging"                                       |
|    - apiVersion: "v7"                                             |
|    - runId: "run_abc123"                                          |
+------------------------------------------------------------------+
```

---

## 11. CI/CD Integration

### 11.1 Pipeline Stages

```
CI/CD PIPELINE INTEGRATION
==========================

Stage 1: Smoke Tests (Gate)
┌─────────────────────────────────────────────────────┐
│  Trigger: Every commit                              │
│  Duration: < 1 minute                               │
│  Failure: Block pipeline                            │
│                                                     │
│  Tests:                                             │
│    - API health check                               │
│    - Authentication verification                    │
│    - Core endpoint availability                     │
└─────────────────────────────────────────────────────┘
                        │
                        v (if passed)
Stage 2: Unit Tests
┌─────────────────────────────────────────────────────┐
│  Trigger: After smoke tests pass                    │
│  Duration: < 2 minutes                              │
│  Failure: Block pipeline                            │
│                                                     │
│  Tests:                                             │
│    - Framework component tests                      │
│    - Utility function tests                         │
│    - Mock-based service tests                       │
└─────────────────────────────────────────────────────┘
                        │
                        v (if passed)
Stage 3: Integration Tests (Parallel)
┌─────────────────────────────────────────────────────┐
│  Trigger: After unit tests pass                     │
│  Duration: 5-15 minutes                             │
│  Failure: Block merge (configurable)                │
│                                                     │
│  Workers: 4 parallel                                │
│  Tests:                                             │
│    - All endpoint integration tests                 │
│    - Sharded across workers                         │
└─────────────────────────────────────────────────────┘
                        │
                        v (if passed)
Stage 4: E2E Tests (Nightly/Release)
┌─────────────────────────────────────────────────────┐
│  Trigger: Nightly schedule OR release branch        │
│  Duration: 15-30 minutes                            │
│  Failure: Alert, don't block (configurable)        │
│                                                     │
│  Tests:                                             │
│    - Business workflow scenarios                    │
│    - User journey tests                             │
│    - Cross-service integration                      │
└─────────────────────────────────────────────────────┘
                        │
                        v (reports generated)
Stage 5: Report & Notify
┌─────────────────────────────────────────────────────┐
│  Actions:                                           │
│    - Generate HTML report                           │
│    - Upload to Supabase Storage                     │
│    - Send Slack/Teams notification                  │
│    - Update GitHub commit status                    │
│    - Track flaky tests                              │
└─────────────────────────────────────────────────────┘
```

### 11.2 GitHub Actions Example

```yaml
# .github/workflows/api-tests.yml
name: Legito API Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 2 * * *'  # Nightly at 2 AM

jobs:
  smoke:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run test:smoke
        env:
          LEGITO_API_URL: ${{ secrets.LEGITO_API_URL }}
          LEGITO_API_KEY: ${{ secrets.LEGITO_API_KEY }}
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_KEY: ${{ secrets.SUPABASE_KEY }}

  unit:
    needs: smoke
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run test:unit

  integration:
    needs: unit
    runs-on: ubuntu-latest
    strategy:
      matrix:
        shard: [1, 2, 3, 4]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run test:integration -- --shard=${{ matrix.shard }}/4
        env:
          LEGITO_API_URL: ${{ secrets.LEGITO_API_URL }}
          LEGITO_API_KEY: ${{ secrets.LEGITO_API_KEY }}

  e2e:
    if: github.event_name == 'schedule' || github.ref == 'refs/heads/main'
    needs: integration
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run test:e2e

  report:
    needs: [smoke, unit, integration]
    if: always()
    runs-on: ubuntu-latest
    steps:
      - run: npm run report:generate
      - run: npm run report:upload
```

---

## 12. Summary

This architecture provides:

1. **Modularity**: Clear separation of concerns with pluggable components
2. **Scalability**: Parallel execution with worker pools and sharding
3. **Isolation**: Multi-level test isolation strategies
4. **Observability**: Comprehensive logging, metrics, and reporting via Supabase
5. **Resilience**: Rate limiting, retry logic, and graceful error handling
6. **Extensibility**: Plugin architecture for adding new endpoint tests
7. **CI/CD Ready**: Pipeline integration with staged execution

The architecture balances thoroughness with execution speed, enabling fast feedback loops for developers while maintaining comprehensive coverage for release validation.

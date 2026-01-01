/**
 * API Testing Platform - Context Management TypeScript Types
 * Defines all data structures for context management and test execution
 */

// ============================================================================
// 1. AUTHENTICATION & USER CONTEXT TYPES
// ============================================================================

export interface User {
  id: string;
  email: string;
  fullName?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Organization {
  id: string;
  userId: string;
  name: string;
  slug: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  createdAt: Date;
}

// ============================================================================
// 2. PROJECT STRUCTURE TYPES
// ============================================================================

export interface Project {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  baseUrl: string;
  status: 'active' | 'archived' | 'inactive';
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestSuite {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  orderIndex: number;
  enabled: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// 3. TEST CONFIGURATION TYPES
// ============================================================================

export interface ApiEndpoint {
  id: string;
  projectId: string;
  name: string;
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
  description?: string;
  tags: string[];
  documentationUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestCase {
  id: string;
  suiteId: string;
  endpointId: string;
  name: string;
  description?: string;
  orderIndex: number;
  enabled: boolean;
  timeoutMs: number;
  retryCount: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestDependency {
  id: string;
  dependentTestId: string;
  requiredTestId: string;
  dependencyType: 'order' | 'data' | 'token';
  createdAt: Date;
}

// ============================================================================
// 4. TEST REQUEST/RESPONSE TYPES
// ============================================================================

export interface TestRequestConfig {
  id: string;
  testCaseId: string;
  headers: Record<string, string | string[]>;
  queryParams: Record<string, string | string[]>;
  body?: any;
  bodyType?: 'json' | 'form-data' | 'x-www-form-urlencoded' | 'text' | 'xml';
  authType?: 'none' | 'bearer' | 'basic' | 'api-key' | 'oauth2';
  authTokenRef?: string;
  variablesUsed: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TestResponseSpec {
  id: string;
  testCaseId: string;
  expectedStatusCode: number;
  expectedHeaders: Record<string, string | string[]>;
  expectedBody?: any;
  bodyMatchType: 'exact' | 'schema' | 'partial' | 'contains';
  responseTimeMaxMs?: number;
  captureVars: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// 5. TEST DATA FIXTURE TYPES
// ============================================================================

export interface TestDataFixture {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  fixtureType: 'user' | 'document' | 'organization' | 'custom';
  data: Record<string, any>;
  tags: string[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FixtureUsage {
  id: string;
  fixtureId: string;
  testCaseId: string;
  createdAt: Date;
}

// ============================================================================
// 6. ENVIRONMENT CONFIGURATION TYPES
// ============================================================================

export interface Environment {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  baseUrl: string;
  orderIndex: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EnvironmentVariable {
  id: string;
  environmentId: string;
  key: string;
  value: string;
  isSecret: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// 7. USER CREDENTIALS TYPES
// ============================================================================

export type CredentialType = 'api-key' | 'bearer-token' | 'basic-auth' | 'oauth2';

export interface ApiCredential {
  id: string;
  userId: string;
  organizationId: string;
  credentialName: string;
  credentialType: CredentialType;
  keyId?: string;
  keySecret?: string; // Encrypted
  token?: string; // Encrypted
  tokenExpiresAt?: Date;
  oauthRefreshToken?: string; // Encrypted
  oauthScope?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// 8. TEST EXECUTION CONTEXT TYPES
// ============================================================================

/**
 * Runtime context shared across test execution
 * Contains tokens, variables, and data captured from previous tests
 */
export interface TestExecutionContext {
  id: string;
  runId: string;
  sharedAuthTokens: Record<string, string>;
  sharedVariables: Record<string, any>;
  capturedData: Record<string, any>;
  testOrder: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Complete test run state
 */
export interface TestRun {
  id: string;
  projectId: string;
  suiteId?: string;
  environmentId: string;
  startedBy: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  totalDurationMs: number;
  startedAt: Date;
  completedAt?: Date;
  createdAt: Date;
  metadata: Record<string, any>;
}

// ============================================================================
// 9. TEST RESULT TYPES
// ============================================================================

export type TestStatus = 'passed' | 'failed' | 'skipped' | 'error';

export interface TestResult {
  id: string;
  runId: string;
  testCaseId: string;
  status: TestStatus;
  exitCode?: number;
  errorMessage?: string;
  errorStack?: string;
  startedAt: Date;
  completedAt?: Date;
  durationMs?: number;
  attemptNumber: number;
  createdAt: Date;
}

export interface TestResultDetail {
  id: string;
  resultId: string;
  requestHeaders?: Record<string, string | string[]>;
  requestBody?: any;
  requestQueryParams?: Record<string, string | string[]>;
  responseStatusCode?: number;
  responseHeaders?: Record<string, string | string[]>;
  responseBody?: any;
  responseTimeMs?: number;
  assertionsPassed: number;
  assertionsFailed: number;
  capturedVariables: Record<string, any>;
  createdAt: Date;
}

export interface AssertionResult {
  id: string;
  resultId: string;
  assertionName: string;
  assertionType: 'status-code' | 'header' | 'body' | 'schema' | 'response-time' | 'custom';
  expectedValue?: any;
  actualValue?: any;
  passed: boolean;
  errorMessage?: string;
  createdAt: Date;
}

// ============================================================================
// 10. PERFORMANCE METRICS TYPES
// ============================================================================

export interface PerformanceMetric {
  id: string;
  projectId: string;
  testCaseId: string;
  environmentId: string;
  date: Date;
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  averageResponseTimeMs: number;
  p95ResponseTimeMs: number;
  p99ResponseTimeMs: number;
  minResponseTimeMs: number;
  maxResponseTimeMs: number;
  successRate: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestRunHistory {
  id: string;
  testCaseId: string;
  environmentId: string;
  status: TestStatus;
  durationMs?: number;
  recordedAt: Date;
  createdAt: Date;
}

// ============================================================================
// 11. FAILURE ANALYSIS TYPES
// ============================================================================

export type FailureCategory =
  | 'assertion'
  | 'timeout'
  | 'connection'
  | 'authentication'
  | 'data-validation'
  | 'environment'
  | 'other';

export interface FailureAnalysis {
  id: string;
  resultId: string;
  failureCategory?: FailureCategory;
  rootCauseAnalysis?: string;
  suggestedFix?: string;
  isFlaky: boolean;
  flakinessScore?: number;
  firstFailureAt?: Date;
  lastFailureAt?: Date;
  failureCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// 12. REPORTING TYPES
// ============================================================================

export interface ReportTemplate {
  id: string;
  userId: string;
  organizationId: string;
  name: string;
  description?: string;
  includesPerformance: boolean;
  includesFailures: boolean;
  includesFlakyTests: boolean;
  includesTrends: boolean;
  dateRangeDays: number;
  environments: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPreferences {
  id: string;
  userId: string;
  organizationId: string;
  emailOnFailure: boolean;
  emailOnSuiteCompletion: boolean;
  emailFrequency: 'immediate' | 'daily' | 'weekly';
  theme: 'light' | 'dark';
  defaultEnvironment?: string;
  timezone: string;
  notificationChannels: ('email' | 'slack' | 'webhook')[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SavedSearch {
  id: string;
  userId: string;
  organizationId: string;
  name: string;
  description?: string;
  filters: SearchFilters;
  createdAt: Date;
  updatedAt: Date;
}

export interface SearchFilters {
  status?: TestStatus[];
  suiteIds?: string[];
  environmentIds?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  failureCategories?: FailureCategory[];
  tags?: string[];
  [key: string]: any;
}

// ============================================================================
// 13. CONTEXT MANAGEMENT & ORCHESTRATION TYPES
// ============================================================================

/**
 * Request context for test execution
 */
export interface RequestContext {
  method: string;
  url: string;
  headers: Record<string, string | string[]>;
  body?: any;
  timeout?: number;
}

/**
 * Response context captured during execution
 */
export interface ResponseContext {
  statusCode: number;
  headers: Record<string, string | string[]>;
  body: any;
  durationMs: number;
  timestamp: Date;
}

/**
 * Execution context for a single test
 */
export interface SingleTestExecutionContext {
  testCaseId: string;
  environmentId: string;
  startedAt: Date;
  request?: RequestContext;
  response?: ResponseContext;
  capturedVariables: Record<string, any>;
  error?: Error;
  status: TestStatus;
}

/**
 * Context for managing dependent test execution
 */
export interface DependencyContext {
  testId: string;
  dependencies: TestDependency[];
  executionChain: string[];
  requiredVariables: Record<string, string>;
  isReady: boolean;
}

/**
 * Context for assertion execution
 */
export interface AssertionContext {
  testResultId: string;
  responseBody: any;
  responseHeaders: Record<string, string | string[]>;
  statusCode: number;
  variables: Record<string, any>;
  captureVars: Record<string, string>;
}

/**
 * Context for performance analysis
 */
export interface PerformanceContext {
  testCaseId: string;
  environmentId: string;
  responseTimes: number[];
  startDate: Date;
  endDate: Date;
  baseline?: number;
  threshold?: number;
}

// ============================================================================
// 14. DATA FLOW & PIPELINE TYPES
// ============================================================================

/**
 * Represents a step in the test execution pipeline
 */
export interface PipelineStep {
  id: string;
  name: string;
  stepType: 'setup' | 'test' | 'assertion' | 'cleanup' | 'reporting';
  order: number;
  inputContext: Record<string, any>;
  outputContext: Record<string, any>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  error?: Error;
  durationMs?: number;
}

/**
 * Represents the complete test execution pipeline
 */
export interface TestExecutionPipeline {
  runId: string;
  projectId: string;
  steps: PipelineStep[];
  globalContext: Record<string, any>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: Date;
  completedAt?: Date;
}

/**
 * Context aggregation for multi-test scenarios
 */
export interface AggregatedContext {
  runId: string;
  testResults: Map<string, TestResult>;
  executionContexts: Map<string, SingleTestExecutionContext>;
  sharedTokens: Map<string, string>;
  sharedVariables: Map<string, any>;
  metadata: Record<string, any>;
}

// ============================================================================
// 15. CACHE & MEMORY TYPES
// ============================================================================

/**
 * In-memory cache for test execution context
 */
export interface ContextCache {
  key: string;
  value: any;
  ttl: number;
  createdAt: Date;
  expiresAt: Date;
}

/**
 * Memory structure for tracking active test runs
 */
export interface ActiveRunMemory {
  runId: string;
  context: TestExecutionContext;
  lastAccessedAt: Date;
  accessCount: number;
  memoryUsage: number;
}

// ============================================================================
// 16. VECTOR DATABASE TYPES (for semantic search)
// ============================================================================

/**
 * Embedding for semantic test discovery
 */
export interface TestEmbedding {
  testCaseId: string;
  embedding: number[];
  description: string;
  tags: string[];
  createdAt: Date;
}

/**
 * Semantic search result
 */
export interface SemanticSearchResult {
  testCaseId: string;
  similarity: number;
  rank: number;
}

// ============================================================================
// 17. CHANGE TRACKING TYPES
// ============================================================================

export type ChangeAction = 'create' | 'update' | 'delete';

export interface DataChange {
  id: string;
  entityType: string;
  entityId: string;
  action: ChangeAction;
  oldValue?: any;
  newValue?: any;
  changedBy: string;
  changedAt: Date;
}

// ============================================================================
// 18. WEBHOOK & EVENT TYPES
// ============================================================================

export type EventType =
  | 'test_started'
  | 'test_completed'
  | 'test_failed'
  | 'run_started'
  | 'run_completed'
  | 'flaky_test_detected'
  | 'performance_degradation';

export interface PlatformEvent {
  id: string;
  eventType: EventType;
  projectId: string;
  data: Record<string, any>;
  timestamp: Date;
  userId?: string;
}

// ============================================================================
// 19. ERROR & EXCEPTION TYPES
// ============================================================================

export class TestExecutionError extends Error {
  constructor(
    public testCaseId: string,
    public category: FailureCategory,
    message: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'TestExecutionError';
  }
}

export class ContextManagementError extends Error {
  constructor(
    public operationType: string,
    message: string,
    public context?: any
  ) {
    super(message);
    this.name = 'ContextManagementError';
  }
}

// ============================================================================
// 20. API REQUEST/RESPONSE TYPES
// ============================================================================

export interface ApiRequest {
  method: string;
  endpoint: string;
  headers?: Record<string, string>;
  params?: Record<string, string>;
  body?: any;
  auth?: {
    type: CredentialType;
    credential: ApiCredential;
  };
}

export interface ApiResponse {
  statusCode: number;
  headers: Record<string, string | string[]>;
  body: any;
  durationMs: number;
  timestamp: Date;
}

// ============================================================================
// 21. BATCH OPERATIONS TYPES
// ============================================================================

export interface BatchTestRunRequest {
  projectId: string;
  suiteIds?: string[];
  testCaseIds?: string[];
  environmentId: string;
  parallel: boolean;
  maxConcurrency?: number;
  metadata?: Record<string, any>;
}

export interface BatchResult {
  totalTests: number;
  successfulTests: number;
  failedTests: number;
  skippedTests: number;
  totalDurationMs: number;
  errors: Array<{
    testCaseId: string;
    error: string;
  }>;
}

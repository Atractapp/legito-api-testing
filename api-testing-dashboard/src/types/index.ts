// Test Suite Types
export type TestStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';

export interface TestCase {
  id: string;
  name: string;
  description: string;
  category: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  status: TestStatus;
  duration?: number;
  lastRun?: string;
  assertions: number;
  passedAssertions?: number;
}

export interface TestResult {
  id: string;
  testId: string;
  testName: string;
  category: string;
  status: TestStatus;
  duration: number;
  timestamp: string;
  request: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: unknown;
  };
  response: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: unknown;
    size: number;
  };
  assertions: {
    name: string;
    passed: boolean;
    expected?: unknown;
    actual?: unknown;
    message?: string;
  }[];
  error?: {
    message: string;
    stack?: string;
  };
  logs: LogEntry[];
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  testId?: string;
  metadata?: Record<string, unknown>;
}

export interface TestRun {
  id: string;
  startTime: string;
  endTime?: string;
  status: 'running' | 'completed' | 'cancelled';
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  duration?: number;
  results: TestResult[];
  configuration: TestConfiguration;
  // External sharing link URL (if created during test)
  externalLinkUrl?: string;
}

export interface TestCategory {
  id: string;
  name: string;
  description: string;
  tests: TestCase[];
  icon?: string;
}

// Configuration Types
export interface TestConfiguration {
  id: string;
  name: string;
  baseUrl: string;
  authType: 'jwt' | 'apiKey' | 'none';
  authToken?: string;
  apiKey?: string;
  privateKey?: string; // For JWT signing (Legito API)
  templateIds: string[];
  documentIds: string[];
  timeout: number;
  retryCount: number;
  parallelExecution: boolean;
  environment: 'development' | 'staging' | 'production';
  headers: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

// Report Types
export interface TestReport {
  id: string;
  name: string;
  generatedAt: string;
  testRunId: string;
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
    passRate: number;
  };
  categoryBreakdown: {
    category: string;
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    avgDuration: number;
  }[];
  failedTests: TestResult[];
  performanceMetrics: {
    avgResponseTime: number;
    maxResponseTime: number;
    minResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
  };
}

export interface HistoricalData {
  date: string;
  totalTests: number;
  passed: number;
  failed: number;
  passRate: number;
  avgDuration: number;
}

export interface CoverageData {
  endpoint: string;
  method: string;
  covered: boolean;
  testCount: number;
  lastTested?: string;
}

// Dashboard Statistics
export interface DashboardStats {
  totalTestRuns: number;
  totalTests: number;
  avgPassRate: number;
  avgDuration: number;
  lastRunTime?: string;
  recentTrend: 'up' | 'down' | 'stable';
  todayRuns: number;
  weeklyRuns: number;
}

// Real-time Event Types
export interface TestEvent {
  type: 'test_start' | 'test_complete' | 'test_error' | 'run_complete' | 'log';
  payload: unknown;
  timestamp: string;
}

// Filter and Sort Types
export interface TestFilter {
  category?: string;
  status?: TestStatus;
  search?: string;
  dateRange?: {
    start: string;
    end: string;
  };
}

export type SortField = 'name' | 'status' | 'duration' | 'lastRun' | 'category';
export type SortOrder = 'asc' | 'desc';

/**
 * Test Suite Configuration
 *
 * Defines test suite organization and execution settings.
 */

/**
 * Test suite configuration
 */
export interface TestSuiteConfig {
  name: string;
  description: string;
  category: 'smoke' | 'unit' | 'integration' | 'e2e' | 'performance';
  tags: string[];
  timeout: number;
  retries: number;
  parallel: boolean;
  dependencies?: string[];  // Other suites that must run first
  enabled: boolean;
}

/**
 * Test suite definitions
 */
export const testSuites: Record<string, TestSuiteConfig> = {
  // Smoke Tests
  'smoke:health': {
    name: 'Health Check',
    description: 'Verify API availability and basic connectivity',
    category: 'smoke',
    tags: ['smoke', 'critical'],
    timeout: 30000,
    retries: 0,
    parallel: false,
    enabled: true,
  },
  'smoke:auth': {
    name: 'Authentication',
    description: 'Verify JWT authentication is working',
    category: 'smoke',
    tags: ['smoke', 'auth', 'critical'],
    timeout: 30000,
    retries: 0,
    parallel: false,
    dependencies: ['smoke:health'],
    enabled: true,
  },

  // Unit Tests
  'unit:auth': {
    name: 'Auth Module',
    description: 'Unit tests for JWT and token management',
    category: 'unit',
    tags: ['unit', 'auth'],
    timeout: 10000,
    retries: 0,
    parallel: true,
    enabled: true,
  },
  'unit:client': {
    name: 'API Client',
    description: 'Unit tests for HTTP client and interceptors',
    category: 'unit',
    tags: ['unit', 'client'],
    timeout: 10000,
    retries: 0,
    parallel: true,
    enabled: true,
  },
  'unit:rate-limiting': {
    name: 'Rate Limiting',
    description: 'Unit tests for rate limiter and backoff',
    category: 'unit',
    tags: ['unit', 'rate-limiting'],
    timeout: 10000,
    retries: 0,
    parallel: true,
    enabled: true,
  },

  // Integration Tests - Documents
  'integration:documents:crud': {
    name: 'Documents CRUD',
    description: 'Create, read, update, delete operations for documents',
    category: 'integration',
    tags: ['integration', 'documents', 'crud'],
    timeout: 60000,
    retries: 1,
    parallel: true,
    enabled: true,
  },
  'integration:documents:versions': {
    name: 'Document Versions',
    description: 'Version management and data manipulation',
    category: 'integration',
    tags: ['integration', 'documents', 'versions'],
    timeout: 60000,
    retries: 1,
    parallel: true,
    enabled: true,
  },
  'integration:documents:download': {
    name: 'Document Downloads',
    description: 'Download documents in various formats',
    category: 'integration',
    tags: ['integration', 'documents', 'download'],
    timeout: 120000,
    retries: 2,
    parallel: false,  // Sequential due to rate limits
    enabled: true,
  },

  // Integration Tests - Templates
  'integration:templates:crud': {
    name: 'Templates CRUD',
    description: 'Template management operations',
    category: 'integration',
    tags: ['integration', 'templates', 'crud'],
    timeout: 60000,
    retries: 1,
    parallel: true,
    enabled: true,
  },
  'integration:templates:suites': {
    name: 'Template Suites',
    description: 'Template suite and tag management',
    category: 'integration',
    tags: ['integration', 'templates', 'suites'],
    timeout: 60000,
    retries: 1,
    parallel: true,
    enabled: true,
  },

  // Integration Tests - Users
  'integration:users:crud': {
    name: 'Users CRUD',
    description: 'User management operations',
    category: 'integration',
    tags: ['integration', 'users', 'crud'],
    timeout: 60000,
    retries: 1,
    parallel: true,
    enabled: true,
  },
  'integration:users:groups': {
    name: 'User Groups',
    description: 'User group management',
    category: 'integration',
    tags: ['integration', 'users', 'groups'],
    timeout: 60000,
    retries: 1,
    parallel: true,
    enabled: true,
  },

  // Integration Tests - Sharing
  'integration:sharing:users': {
    name: 'Sharing with Users',
    description: 'Share documents with individual users',
    category: 'integration',
    tags: ['integration', 'sharing', 'users'],
    timeout: 60000,
    retries: 1,
    parallel: true,
    dependencies: ['integration:documents:crud', 'integration:users:crud'],
    enabled: true,
  },
  'integration:sharing:groups': {
    name: 'Sharing with Groups',
    description: 'Share documents with user groups',
    category: 'integration',
    tags: ['integration', 'sharing', 'groups'],
    timeout: 60000,
    retries: 1,
    parallel: true,
    dependencies: ['integration:documents:crud', 'integration:users:groups'],
    enabled: true,
  },
  'integration:sharing:links': {
    name: 'External Links',
    description: 'External sharing link management',
    category: 'integration',
    tags: ['integration', 'sharing', 'links'],
    timeout: 60000,
    retries: 1,
    parallel: true,
    dependencies: ['integration:documents:crud'],
    enabled: true,
  },

  // Integration Tests - Workflows
  'integration:workflows:crud': {
    name: 'Workflows CRUD',
    description: 'Workflow management operations',
    category: 'integration',
    tags: ['integration', 'workflows', 'crud'],
    timeout: 60000,
    retries: 1,
    parallel: true,
    enabled: true,
  },
  'integration:workflows:push': {
    name: 'Push Connections',
    description: 'Push connection management and testing',
    category: 'integration',
    tags: ['integration', 'workflows', 'push'],
    timeout: 60000,
    retries: 1,
    parallel: true,
    enabled: true,
  },

  // Integration Tests - System
  'integration:system:data': {
    name: 'System Data',
    description: 'System reference data (styles, categories, etc.)',
    category: 'integration',
    tags: ['integration', 'system', 'read-only'],
    timeout: 30000,
    retries: 1,
    parallel: true,
    enabled: true,
  },

  // E2E Tests
  'e2e:document-lifecycle': {
    name: 'Document Lifecycle',
    description: 'Full document lifecycle from creation to archival',
    category: 'e2e',
    tags: ['e2e', 'documents', 'critical'],
    timeout: 180000,
    retries: 2,
    parallel: false,
    dependencies: ['integration:documents:crud'],
    enabled: true,
  },
  'e2e:sharing-workflow': {
    name: 'Sharing Workflow',
    description: 'Complete sharing workflow with users and groups',
    category: 'e2e',
    tags: ['e2e', 'sharing'],
    timeout: 180000,
    retries: 2,
    parallel: false,
    dependencies: ['integration:sharing:users', 'integration:sharing:groups'],
    enabled: true,
  },
  'e2e:approval-workflow': {
    name: 'Approval Workflow',
    description: 'Document approval workflow with multiple steps',
    category: 'e2e',
    tags: ['e2e', 'workflows', 'approval'],
    timeout: 300000,
    retries: 2,
    parallel: false,
    dependencies: ['integration:workflows:crud'],
    enabled: true,
  },

  // Performance Tests
  'performance:load': {
    name: 'Load Test',
    description: 'API load testing for common endpoints',
    category: 'performance',
    tags: ['performance', 'load'],
    timeout: 600000,
    retries: 0,
    parallel: false,
    enabled: false,  // Disabled by default
  },
  'performance:stress': {
    name: 'Stress Test',
    description: 'API stress testing for rate limits',
    category: 'performance',
    tags: ['performance', 'stress'],
    timeout: 600000,
    retries: 0,
    parallel: false,
    enabled: false,  // Disabled by default
  },
};

/**
 * Get suites by category
 */
export function getSuitesByCategory(category: string): TestSuiteConfig[] {
  return Object.values(testSuites).filter((s) => s.category === category && s.enabled);
}

/**
 * Get suites by tag
 */
export function getSuitesByTag(tag: string): TestSuiteConfig[] {
  return Object.values(testSuites).filter((s) => s.tags.includes(tag) && s.enabled);
}

/**
 * Get suite execution order based on dependencies
 */
export function getSuiteExecutionOrder(suiteNames: string[]): string[] {
  const ordered: string[] = [];
  const visited = new Set<string>();

  function visit(name: string): void {
    if (visited.has(name)) return;
    visited.add(name);

    const suite = testSuites[name];
    if (!suite) return;

    // Visit dependencies first
    for (const dep of suite.dependencies ?? []) {
      if (suiteNames.includes(dep)) {
        visit(dep);
      }
    }

    ordered.push(name);
  }

  for (const name of suiteNames) {
    visit(name);
  }

  return ordered;
}

export default testSuites;

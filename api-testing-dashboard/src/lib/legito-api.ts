// Legito API Client with JWT Authentication

const LEGITO_BASE_URL = 'https://emea.legito.com/api/v7';

interface JWTConfig {
  apiKey: string;
  privateKey: string;
}

// Generate JWT token for Legito API
export async function generateJWT(config: JWTConfig): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: config.apiKey,
    iat: now,
    exp: now + 3600, // 1 hour
  };

  const encoder = new TextEncoder();

  const base64url = (data: object | string): string => {
    const str = typeof data === 'string' ? data : JSON.stringify(data);
    const bytes = encoder.encode(str);
    let binary = '';
    bytes.forEach(b => binary += String.fromCharCode(b));
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  };

  const headerB64 = base64url(header);
  const payloadB64 = base64url(payload);
  const message = `${headerB64}.${payloadB64}`;

  // Import the key for HMAC signing
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(config.privateKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  // Sign the message
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return `${message}.${signatureB64}`;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  status: number;
  statusText: string;
  data?: T;
  error?: string;
  duration: number;
  headers: Record<string, string>;
}

// Make authenticated API request
export async function legitoRequest<T = unknown>(
  endpoint: string,
  options: {
    method?: string;
    body?: unknown;
    jwt: string;
    timeout?: number;
  }
): Promise<ApiResponse<T>> {
  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeout || 30000);

  try {
    const response = await fetch(`${LEGITO_BASE_URL}${endpoint}`, {
      method: options.method || 'GET',
      headers: {
        'Authorization': `Bearer ${options.jwt}`,
        'Content-Type': 'application/json',
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const duration = Date.now() - startTime;

    // Get response headers
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    // Parse response body
    let data: T | undefined;
    let error: string | undefined;

    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      try {
        const json = await response.json();
        if (response.ok) {
          data = json;
        } else {
          error = json.message || json.error || JSON.stringify(json);
        }
      } catch {
        error = 'Failed to parse JSON response';
      }
    } else if (!response.ok) {
      error = await response.text();
    }

    return {
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      data,
      error,
      duration,
      headers,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    const duration = Date.now() - startTime;

    if (err instanceof Error && err.name === 'AbortError') {
      return {
        success: false,
        status: 408,
        statusText: 'Request Timeout',
        error: 'Request timed out',
        duration,
        headers: {},
      };
    }

    return {
      success: false,
      status: 0,
      statusText: 'Network Error',
      error: err instanceof Error ? err.message : 'Unknown error',
      duration,
      headers: {},
    };
  }
}

// Test definitions for Legito API
export interface LegitoTest {
  id: string;
  name: string;
  description: string;
  category: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: unknown;
  // Dynamic endpoint - resolved at runtime using context
  dynamicEndpoint?: (context: TestContext) => string;
  // Dynamic body - resolved at runtime using context
  dynamicBody?: (context: TestContext) => unknown;
  // Chain tests - runs after this test, using this test's response
  setsContext?: string; // Key to store response data in context
  usesContext?: string[]; // Keys this test depends on
  expectedStatus: number | number[];
  assertions: TestAssertion[];
  // Skip this test if conditions aren't met
  skipIf?: (context: TestContext) => boolean;
}

export interface TestAssertion {
  name: string;
  type: 'status' | 'hasData' | 'isArray' | 'hasField' | 'fieldEquals' | 'arrayNotEmpty' | 'statusCode';
  field?: string;
  expected?: unknown;
}

// Context for chaining tests together
export interface TestContext {
  // Store dynamic data from previous tests
  templateSuiteId?: string;
  templateElements?: unknown[];
  documentRecordId?: string;
  documentVersionId?: string;
  createdLabel?: { id?: string; [key: string]: unknown };
  createdPushConnection?: { id?: string; [key: string]: unknown };
  createdDocument?: { id?: string; [key: string]: unknown };
  users?: unknown[];
  userGroups?: unknown[];
  workflows?: unknown[];
  documentRecords?: unknown[];
  documentVersions?: unknown[];
  objects?: unknown[];
  firstObject?: unknown;
  templateSuites?: unknown[];
  pushConnections?: unknown[];
  [key: string]: unknown;
}

// Default template suite ID for tests (configurable)
export const DEFAULT_TEMPLATE_SUITE_ID = '10132';

// Define all Legito API tests - COMPREHENSIVE
export const LEGITO_TESTS: LegitoTest[] = [
  // ==================== SMOKE TESTS ====================
  {
    id: 'smoke-info',
    name: 'System Info',
    description: 'Get Legito system version and status',
    category: 'Smoke Tests',
    endpoint: '/info',
    method: 'GET',
    expectedStatus: 200,
    assertions: [
      { name: 'Returns 200 OK', type: 'status' },
      { name: 'Has version field', type: 'hasField', field: 'version' },
    ],
  },
  {
    id: 'smoke-countries',
    name: 'List Countries',
    description: 'Get list of available countries',
    category: 'Smoke Tests',
    endpoint: '/country',
    method: 'GET',
    expectedStatus: 200,
    assertions: [
      { name: 'Returns 200 OK', type: 'status' },
      { name: 'Returns array', type: 'isArray' },
      { name: 'Has data', type: 'hasData' },
    ],
  },
  {
    id: 'smoke-currencies',
    name: 'List Currencies',
    description: 'Get list of available currencies',
    category: 'Smoke Tests',
    endpoint: '/currency',
    method: 'GET',
    expectedStatus: 200,
    assertions: [
      { name: 'Returns 200 OK', type: 'status' },
      { name: 'Returns array', type: 'isArray' },
      { name: 'Has data', type: 'hasData' },
    ],
  },
  {
    id: 'smoke-languages',
    name: 'List Languages',
    description: 'Get list of available languages',
    category: 'Smoke Tests',
    endpoint: '/language',
    method: 'GET',
    expectedStatus: 200,
    assertions: [
      { name: 'Returns 200 OK', type: 'status' },
      { name: 'Returns array', type: 'isArray' },
    ],
  },
  {
    id: 'smoke-timezones',
    name: 'List Timezones',
    description: 'Get list of available timezones',
    category: 'Smoke Tests',
    endpoint: '/timezone',
    method: 'GET',
    expectedStatus: 200,
    assertions: [
      { name: 'Returns 200 OK', type: 'status' },
      { name: 'Returns array', type: 'isArray' },
    ],
  },

  // ==================== REFERENCE DATA ====================
  {
    id: 'ref-categories',
    name: 'List Categories',
    description: 'Get document categories',
    category: 'Reference Data',
    endpoint: '/category',
    method: 'GET',
    expectedStatus: 200,
    assertions: [
      { name: 'Returns 200 OK', type: 'status' },
      { name: 'Returns array', type: 'isArray' },
    ],
  },
  {
    id: 'ref-properties',
    name: 'List Properties',
    description: 'Get document properties',
    category: 'Reference Data',
    endpoint: '/property',
    method: 'GET',
    expectedStatus: 200,
    assertions: [
      { name: 'Returns 200 OK', type: 'status' },
      { name: 'Returns array', type: 'isArray' },
    ],
  },
  {
    id: 'ref-property-groups',
    name: 'List Property Groups',
    description: 'Get property group definitions',
    category: 'Reference Data',
    endpoint: '/property-group',
    method: 'GET',
    expectedStatus: 200,
    assertions: [
      { name: 'Returns 200 OK', type: 'status' },
      { name: 'Returns array', type: 'isArray' },
    ],
  },
  {
    id: 'ref-advanced-styles',
    name: 'List Advanced Styles',
    description: 'Get advanced style configurations',
    category: 'Reference Data',
    endpoint: '/advanced-style',
    method: 'GET',
    expectedStatus: 200,
    assertions: [
      { name: 'Returns 200 OK', type: 'status' },
      { name: 'Returns array', type: 'isArray' },
    ],
  },
  {
    id: 'ref-objects',
    name: 'List Objects',
    description: 'Get object type definitions',
    category: 'Reference Data',
    endpoint: '/object',
    method: 'GET',
    expectedStatus: 200,
    setsContext: 'objects',
    assertions: [
      { name: 'Returns 200 OK', type: 'status' },
      { name: 'Returns array', type: 'isArray' },
    ],
  },
  {
    id: 'ref-events',
    name: 'List Events',
    description: 'Get system events',
    category: 'Reference Data',
    endpoint: '/event',
    method: 'GET',
    expectedStatus: 200,
    assertions: [
      { name: 'Returns 200 OK', type: 'status' },
      { name: 'Returns array', type: 'isArray' },
    ],
  },

  // ==================== LABELS (CRUD) ====================
  {
    id: 'label-list',
    name: 'List Labels',
    description: 'Get available labels',
    category: 'Labels',
    endpoint: '/label',
    method: 'GET',
    expectedStatus: 200,
    assertions: [
      { name: 'Returns 200 OK', type: 'status' },
      { name: 'Returns array', type: 'isArray' },
    ],
  },
  {
    id: 'label-create',
    name: 'Create Label',
    description: 'Create a new label for testing',
    category: 'Labels',
    endpoint: '/label',
    method: 'POST',
    body: {
      name: `API-Test-Label-${Date.now()}`,
      color: '#FF5733',
    },
    setsContext: 'createdLabel',
    expectedStatus: [200, 201],
    assertions: [
      { name: 'Returns success', type: 'status' },
      { name: 'Has ID', type: 'hasField', field: 'id' },
    ],
  },
  {
    id: 'label-get',
    name: 'Get Label by ID',
    description: 'Get the created label details',
    category: 'Labels',
    usesContext: ['createdLabel'],
    dynamicEndpoint: (ctx) => `/label/${ctx.createdLabel?.id || 'unknown'}`,
    endpoint: '/label/{id}',
    method: 'GET',
    expectedStatus: 200,
    skipIf: (ctx) => !ctx.createdLabel?.id,
    assertions: [
      { name: 'Returns 200 OK', type: 'status' },
      { name: 'Has name field', type: 'hasField', field: 'name' },
    ],
  },
  {
    id: 'label-update',
    name: 'Update Label',
    description: 'Update the created label',
    category: 'Labels',
    usesContext: ['createdLabel'],
    dynamicEndpoint: (ctx) => `/label/${ctx.createdLabel?.id || 'unknown'}`,
    endpoint: '/label/{id}',
    method: 'PUT',
    dynamicBody: () => ({
      name: `API-Test-Label-Updated-${Date.now()}`,
      color: '#33FF57',
    }),
    expectedStatus: 200,
    skipIf: (ctx) => !ctx.createdLabel?.id,
    assertions: [
      { name: 'Returns 200 OK', type: 'status' },
    ],
  },
  {
    id: 'label-delete',
    name: 'Delete Label',
    description: 'Delete the test label (cleanup)',
    category: 'Labels',
    usesContext: ['createdLabel'],
    dynamicEndpoint: (ctx) => `/label/${ctx.createdLabel?.id || 'unknown'}`,
    endpoint: '/label/{id}',
    method: 'DELETE',
    expectedStatus: [200, 204],
    skipIf: (ctx) => !ctx.createdLabel?.id,
    assertions: [
      { name: 'Returns success', type: 'status' },
    ],
  },

  // ==================== TEMPLATES ====================
  {
    id: 'tmpl-list',
    name: 'List Template Suites',
    description: 'Get all available template suites',
    category: 'Templates',
    endpoint: '/template-suite',
    method: 'GET',
    expectedStatus: 200,
    setsContext: 'templateSuites',
    assertions: [
      { name: 'Returns 200 OK', type: 'status' },
      { name: 'Returns array', type: 'isArray' },
      { name: 'Has template data', type: 'hasData' },
    ],
  },
  {
    id: 'tmpl-get-single',
    name: 'Get Template Suite',
    description: 'Get a specific template suite by ID (10132)',
    category: 'Templates',
    endpoint: '/template-suite/10132',
    method: 'GET',
    expectedStatus: 200,
    assertions: [
      { name: 'Returns 200 OK', type: 'status' },
      { name: 'Has ID field', type: 'hasField', field: 'id' },
      { name: 'Has name field', type: 'hasField', field: 'name' },
    ],
  },
  {
    id: 'tmpl-elements',
    name: 'Get Template Elements',
    description: 'Get elements (fields) of template suite 10132',
    category: 'Templates',
    endpoint: '/template-suite/10132/element',
    method: 'GET',
    expectedStatus: 200,
    setsContext: 'templateElements',
    assertions: [
      { name: 'Returns 200 OK', type: 'status' },
      { name: 'Returns array', type: 'isArray' },
    ],
  },
  {
    id: 'tmpl-tags',
    name: 'List Template Tags',
    description: 'Get template tags',
    category: 'Templates',
    endpoint: '/template-tag',
    method: 'GET',
    expectedStatus: 200,
    assertions: [
      { name: 'Returns 200 OK', type: 'status' },
      { name: 'Returns array', type: 'isArray' },
    ],
  },

  // ==================== USERS & GROUPS ====================
  {
    id: 'user-list',
    name: 'List Users',
    description: 'Get list of workspace users',
    category: 'Users & Groups',
    endpoint: '/user',
    method: 'GET',
    expectedStatus: 200,
    setsContext: 'users',
    assertions: [
      { name: 'Returns 200 OK', type: 'status' },
      { name: 'Returns array', type: 'isArray' },
      { name: 'Has user data', type: 'hasData' },
    ],
  },
  {
    id: 'user-get-first',
    name: 'Get First User',
    description: 'Get details of first user in list',
    category: 'Users & Groups',
    usesContext: ['users'],
    dynamicEndpoint: (ctx) => {
      const users = ctx.users as unknown[];
      if (Array.isArray(users) && users.length > 0) {
        const firstUser = users[0] as { id?: string };
        return `/user/${firstUser.id}`;
      }
      return '/user/unknown';
    },
    endpoint: '/user/{id}',
    method: 'GET',
    expectedStatus: 200,
    skipIf: (ctx) => !Array.isArray(ctx.users) || ctx.users.length === 0,
    assertions: [
      { name: 'Returns 200 OK', type: 'status' },
      { name: 'Has ID', type: 'hasField', field: 'id' },
    ],
  },
  {
    id: 'user-groups',
    name: 'List User Groups',
    description: 'Get list of user groups',
    category: 'Users & Groups',
    endpoint: '/user-group',
    method: 'GET',
    expectedStatus: 200,
    setsContext: 'userGroups',
    assertions: [
      { name: 'Returns 200 OK', type: 'status' },
      { name: 'Returns array', type: 'isArray' },
    ],
  },
  {
    id: 'user-group-get',
    name: 'Get First User Group',
    description: 'Get details of first user group',
    category: 'Users & Groups',
    usesContext: ['userGroups'],
    dynamicEndpoint: (ctx) => {
      const groups = ctx.userGroups as unknown[];
      if (Array.isArray(groups) && groups.length > 0) {
        const first = groups[0] as { id?: string };
        return `/user-group/${first.id}`;
      }
      return '/user-group/unknown';
    },
    endpoint: '/user-group/{id}',
    method: 'GET',
    expectedStatus: [200, 404],
    skipIf: (ctx) => !Array.isArray(ctx.userGroups) || ctx.userGroups.length === 0,
    assertions: [
      { name: 'Returns response', type: 'status' },
    ],
  },

  // ==================== WORKFLOWS ====================
  {
    id: 'wf-list',
    name: 'List Workflows',
    description: 'Get workflow definitions',
    category: 'Workflows',
    endpoint: '/workflow',
    method: 'GET',
    expectedStatus: 200,
    setsContext: 'workflows',
    assertions: [
      { name: 'Returns 200 OK', type: 'status' },
      { name: 'Returns array', type: 'isArray' },
    ],
  },
  {
    id: 'wf-get-first',
    name: 'Get First Workflow',
    description: 'Get details of first workflow',
    category: 'Workflows',
    usesContext: ['workflows'],
    dynamicEndpoint: (ctx) => {
      const wfs = ctx.workflows as unknown[];
      if (Array.isArray(wfs) && wfs.length > 0) {
        const first = wfs[0] as { id?: string };
        return `/workflow/${first.id}`;
      }
      return '/workflow/unknown';
    },
    endpoint: '/workflow/{id}',
    method: 'GET',
    expectedStatus: [200, 404],
    skipIf: (ctx) => !Array.isArray(ctx.workflows) || ctx.workflows.length === 0,
    assertions: [
      { name: 'Returns response', type: 'status' },
    ],
  },
  {
    id: 'wf-stages',
    name: 'List Workflow Stages',
    description: 'Get workflow stages for first workflow',
    category: 'Workflows',
    usesContext: ['workflows'],
    dynamicEndpoint: (ctx) => {
      const wfs = ctx.workflows as unknown[];
      if (Array.isArray(wfs) && wfs.length > 0) {
        const first = wfs[0] as { id?: string };
        return `/workflow/${first.id}/stage`;
      }
      return '/workflow/unknown/stage';
    },
    endpoint: '/workflow/{id}/stage',
    method: 'GET',
    expectedStatus: [200, 404],
    skipIf: (ctx) => !Array.isArray(ctx.workflows) || ctx.workflows.length === 0,
    assertions: [
      { name: 'Returns response', type: 'status' },
    ],
  },

  // ==================== DOCUMENTS ====================
  {
    id: 'doc-list',
    name: 'List Document Records',
    description: 'Get list of document records',
    category: 'Documents',
    endpoint: '/document-record',
    method: 'GET',
    expectedStatus: 200,
    setsContext: 'documentRecords',
    assertions: [
      { name: 'Returns 200 OK', type: 'status' },
      { name: 'Returns array', type: 'isArray' },
    ],
  },
  {
    id: 'doc-list-limit',
    name: 'List Documents with Limit',
    description: 'Get documents with pagination (limit=5)',
    category: 'Documents',
    endpoint: '/document-record?limit=5',
    method: 'GET',
    expectedStatus: 200,
    assertions: [
      { name: 'Returns 200 OK', type: 'status' },
      { name: 'Returns array', type: 'isArray' },
    ],
  },
  {
    id: 'doc-list-offset',
    name: 'List Documents with Offset',
    description: 'Get documents with pagination (offset=0, limit=3)',
    category: 'Documents',
    endpoint: '/document-record?offset=0&limit=3',
    method: 'GET',
    expectedStatus: 200,
    assertions: [
      { name: 'Returns 200 OK', type: 'status' },
      { name: 'Returns array', type: 'isArray' },
    ],
  },
  {
    id: 'doc-get-first',
    name: 'Get First Document Record',
    description: 'Get details of first document record',
    category: 'Documents',
    usesContext: ['documentRecords'],
    dynamicEndpoint: (ctx) => {
      const docs = ctx.documentRecords as unknown[];
      if (Array.isArray(docs) && docs.length > 0) {
        const first = docs[0] as { id?: string };
        return `/document-record/${first.id}`;
      }
      return '/document-record/unknown';
    },
    endpoint: '/document-record/{id}',
    method: 'GET',
    expectedStatus: [200, 404],
    skipIf: (ctx) => !Array.isArray(ctx.documentRecords) || ctx.documentRecords.length === 0,
    assertions: [
      { name: 'Returns response', type: 'status' },
      { name: 'Has data', type: 'hasData' },
    ],
  },
  {
    id: 'doc-record-types',
    name: 'List Document Record Types',
    description: 'Get document record type definitions',
    category: 'Documents',
    endpoint: '/document-record-type',
    method: 'GET',
    expectedStatus: 200,
    assertions: [
      { name: 'Returns 200 OK', type: 'status' },
      { name: 'Returns array', type: 'isArray' },
    ],
  },

  // ==================== DOCUMENT VERSION ====================
  {
    id: 'docver-get-first',
    name: 'Get Document Versions',
    description: 'Get versions of first document record',
    category: 'Document Versions',
    usesContext: ['documentRecords'],
    dynamicEndpoint: (ctx) => {
      const docs = ctx.documentRecords as unknown[];
      if (Array.isArray(docs) && docs.length > 0) {
        const first = docs[0] as { id?: string };
        return `/document-record/${first.id}/document-version`;
      }
      return '/document-record/unknown/document-version';
    },
    endpoint: '/document-record/{id}/document-version',
    method: 'GET',
    expectedStatus: [200, 404],
    skipIf: (ctx) => !Array.isArray(ctx.documentRecords) || ctx.documentRecords.length === 0,
    setsContext: 'documentVersions',
    assertions: [
      { name: 'Returns response', type: 'status' },
    ],
  },

  // ==================== DOCUMENT CREATION (Full Flow) ====================
  {
    id: 'doc-create-new',
    name: 'Create Document from Template',
    description: 'Create new document record from template 10132 with data',
    category: 'Document Creation',
    endpoint: '/document-version/data/10132',
    method: 'POST',
    body: {
      name: `API-Test-Document-${Date.now()}`,
      // The API accepts data elements - we'll send minimal required data
      elements: {},
    },
    setsContext: 'createdDocument',
    expectedStatus: [200, 201, 400], // 400 if template requires specific elements
    assertions: [
      { name: 'Returns response', type: 'status' },
    ],
  },

  // ==================== FILES ====================
  {
    id: 'file-get-first-doc',
    name: 'Get Document Files',
    description: 'Get files attached to first document',
    category: 'Files',
    usesContext: ['documentRecords'],
    dynamicEndpoint: (ctx) => {
      const docs = ctx.documentRecords as unknown[];
      if (Array.isArray(docs) && docs.length > 0) {
        const first = docs[0] as { id?: string };
        return `/document-record/${first.id}/file`;
      }
      return '/document-record/unknown/file';
    },
    endpoint: '/document-record/{id}/file',
    method: 'GET',
    expectedStatus: [200, 404],
    skipIf: (ctx) => !Array.isArray(ctx.documentRecords) || ctx.documentRecords.length === 0,
    assertions: [
      { name: 'Returns response', type: 'status' },
    ],
  },

  // ==================== SHARING ====================
  {
    id: 'share-get-first-doc',
    name: 'Get Document Shares',
    description: 'Get shares for first document',
    category: 'Sharing',
    usesContext: ['documentRecords'],
    dynamicEndpoint: (ctx) => {
      const docs = ctx.documentRecords as unknown[];
      if (Array.isArray(docs) && docs.length > 0) {
        const first = docs[0] as { id?: string };
        return `/document-record/${first.id}/share`;
      }
      return '/document-record/unknown/share';
    },
    endpoint: '/document-record/{id}/share',
    method: 'GET',
    expectedStatus: [200, 404],
    skipIf: (ctx) => !Array.isArray(ctx.documentRecords) || ctx.documentRecords.length === 0,
    assertions: [
      { name: 'Returns response', type: 'status' },
    ],
  },
  {
    id: 'share-get-first-tmpl',
    name: 'Get Template Shares',
    description: 'Get shares for template 10132',
    category: 'Sharing',
    endpoint: '/template-suite/10132/share',
    method: 'GET',
    expectedStatus: [200, 404],
    assertions: [
      { name: 'Returns response', type: 'status' },
    ],
  },

  // ==================== WEBHOOKS / PUSH CONNECTIONS ====================
  {
    id: 'webhook-list',
    name: 'List Push Connections',
    description: 'Get webhook/push connection list',
    category: 'Webhooks',
    endpoint: '/push-connection',
    method: 'GET',
    expectedStatus: 200,
    setsContext: 'pushConnections',
    assertions: [
      { name: 'Returns 200 OK', type: 'status' },
      { name: 'Returns array', type: 'isArray' },
    ],
  },
  {
    id: 'webhook-create',
    name: 'Create Push Connection',
    description: 'Create a test webhook endpoint',
    category: 'Webhooks',
    endpoint: '/push-connection',
    method: 'POST',
    body: {
      name: `API-Test-Webhook-${Date.now()}`,
      url: 'https://webhook.site/test-legito-api',
      events: ['document.created'],
      active: false, // Keep inactive for testing
    },
    setsContext: 'createdPushConnection',
    expectedStatus: [200, 201, 400], // 400 if invalid config
    assertions: [
      { name: 'Returns response', type: 'status' },
    ],
  },
  {
    id: 'webhook-get',
    name: 'Get Push Connection',
    description: 'Get the created push connection',
    category: 'Webhooks',
    usesContext: ['createdPushConnection'],
    dynamicEndpoint: (ctx) => `/push-connection/${ctx.createdPushConnection?.id || 'unknown'}`,
    endpoint: '/push-connection/{id}',
    method: 'GET',
    expectedStatus: [200, 404],
    skipIf: (ctx) => !ctx.createdPushConnection?.id,
    assertions: [
      { name: 'Returns response', type: 'status' },
    ],
  },
  {
    id: 'webhook-delete',
    name: 'Delete Push Connection',
    description: 'Delete the test push connection (cleanup)',
    category: 'Webhooks',
    usesContext: ['createdPushConnection'],
    dynamicEndpoint: (ctx) => `/push-connection/${ctx.createdPushConnection?.id || 'unknown'}`,
    endpoint: '/push-connection/{id}',
    method: 'DELETE',
    expectedStatus: [200, 204, 404],
    skipIf: (ctx) => !ctx.createdPushConnection?.id,
    assertions: [
      { name: 'Returns response', type: 'status' },
    ],
  },

  // ==================== OBJECT RECORDS ====================
  {
    id: 'obj-get-first',
    name: 'Get First Object Type',
    description: 'Get details of first object type',
    category: 'Object Records',
    usesContext: ['objects'],
    dynamicEndpoint: (ctx) => {
      const objs = ctx.objects as unknown[];
      if (Array.isArray(objs) && objs.length > 0) {
        const first = objs[0] as { id?: string };
        return `/object/${first.id}`;
      }
      return '/object/unknown';
    },
    endpoint: '/object/{id}',
    method: 'GET',
    expectedStatus: [200, 404],
    skipIf: (ctx) => !Array.isArray(ctx.objects) || ctx.objects.length === 0,
    setsContext: 'firstObject',
    assertions: [
      { name: 'Returns response', type: 'status' },
    ],
  },
  {
    id: 'obj-records-list',
    name: 'List Object Records',
    description: 'List records for first object type',
    category: 'Object Records',
    usesContext: ['objects'],
    dynamicEndpoint: (ctx) => {
      const objs = ctx.objects as unknown[];
      if (Array.isArray(objs) && objs.length > 0) {
        const first = objs[0] as { id?: string };
        return `/object/${first.id}/record`;
      }
      return '/object/unknown/record';
    },
    endpoint: '/object/{id}/record',
    method: 'GET',
    expectedStatus: [200, 404],
    skipIf: (ctx) => !Array.isArray(ctx.objects) || ctx.objects.length === 0,
    assertions: [
      { name: 'Returns response', type: 'status' },
    ],
  },

  // ==================== NOTIFICATION SETTINGS ====================
  {
    id: 'notif-settings',
    name: 'Get Notification Settings',
    description: 'Get user notification settings',
    category: 'Notifications',
    endpoint: '/notification-setting',
    method: 'GET',
    expectedStatus: [200, 404],
    assertions: [
      { name: 'Returns response', type: 'status' },
    ],
  },

  // ==================== ADVANCED QUERIES ====================
  {
    id: 'doc-filter-template',
    name: 'Filter Docs by Template',
    description: 'Get documents filtered by template suite ID',
    category: 'Advanced Queries',
    endpoint: '/document-record?templateSuiteId=10132',
    method: 'GET',
    expectedStatus: 200,
    assertions: [
      { name: 'Returns 200 OK', type: 'status' },
      { name: 'Returns array', type: 'isArray' },
    ],
  },
  {
    id: 'tmpl-filter-active',
    name: 'Filter Active Templates',
    description: 'Get only active template suites',
    category: 'Advanced Queries',
    endpoint: '/template-suite?active=true',
    method: 'GET',
    expectedStatus: 200,
    assertions: [
      { name: 'Returns 200 OK', type: 'status' },
      { name: 'Returns array', type: 'isArray' },
    ],
  },
  {
    id: 'user-filter-active',
    name: 'Filter Active Users',
    description: 'Get only active users',
    category: 'Advanced Queries',
    endpoint: '/user?active=true',
    method: 'GET',
    expectedStatus: 200,
    assertions: [
      { name: 'Returns 200 OK', type: 'status' },
      { name: 'Returns array', type: 'isArray' },
    ],
  },

  // ==================== SIGNATURE ====================
  {
    id: 'sig-providers',
    name: 'List Signature Providers',
    description: 'Get available signature providers',
    category: 'Signatures',
    endpoint: '/signature-provider',
    method: 'GET',
    expectedStatus: [200, 404],
    assertions: [
      { name: 'Returns response', type: 'status' },
    ],
  },

  // ==================== AUDIT / HISTORY ====================
  {
    id: 'audit-first-doc',
    name: 'Get Document History',
    description: 'Get audit history of first document',
    category: 'Audit',
    usesContext: ['documentRecords'],
    dynamicEndpoint: (ctx) => {
      const docs = ctx.documentRecords as unknown[];
      if (Array.isArray(docs) && docs.length > 0) {
        const first = docs[0] as { id?: string };
        return `/document-record/${first.id}/history`;
      }
      return '/document-record/unknown/history';
    },
    endpoint: '/document-record/{id}/history',
    method: 'GET',
    expectedStatus: [200, 404],
    skipIf: (ctx) => !Array.isArray(ctx.documentRecords) || ctx.documentRecords.length === 0,
    assertions: [
      { name: 'Returns response', type: 'status' },
    ],
  },

  // ==================== COMMENTS ====================
  {
    id: 'comments-first-doc',
    name: 'Get Document Comments',
    description: 'Get comments on first document',
    category: 'Comments',
    usesContext: ['documentRecords'],
    dynamicEndpoint: (ctx) => {
      const docs = ctx.documentRecords as unknown[];
      if (Array.isArray(docs) && docs.length > 0) {
        const first = docs[0] as { id?: string };
        return `/document-record/${first.id}/comment`;
      }
      return '/document-record/unknown/comment';
    },
    endpoint: '/document-record/{id}/comment',
    method: 'GET',
    expectedStatus: [200, 404],
    skipIf: (ctx) => !Array.isArray(ctx.documentRecords) || ctx.documentRecords.length === 0,
    assertions: [
      { name: 'Returns response', type: 'status' },
    ],
  },

  // ==================== PERMISSIONS ====================
  {
    id: 'perms-first-doc',
    name: 'Get Document Permissions',
    description: 'Get permissions for first document',
    category: 'Permissions',
    usesContext: ['documentRecords'],
    dynamicEndpoint: (ctx) => {
      const docs = ctx.documentRecords as unknown[];
      if (Array.isArray(docs) && docs.length > 0) {
        const first = docs[0] as { id?: string };
        return `/document-record/${first.id}/permission`;
      }
      return '/document-record/unknown/permission';
    },
    endpoint: '/document-record/{id}/permission',
    method: 'GET',
    expectedStatus: [200, 404],
    skipIf: (ctx) => !Array.isArray(ctx.documentRecords) || ctx.documentRecords.length === 0,
    assertions: [
      { name: 'Returns response', type: 'status' },
    ],
  },
  {
    id: 'perms-first-tmpl',
    name: 'Get Template Permissions',
    description: 'Get permissions for template 10132',
    category: 'Permissions',
    endpoint: '/template-suite/10132/permission',
    method: 'GET',
    expectedStatus: [200, 404],
    assertions: [
      { name: 'Returns response', type: 'status' },
    ],
  },
];

// Run a single test assertion
export function runAssertion(
  assertion: TestAssertion,
  response: ApiResponse
): { passed: boolean; message: string } {
  switch (assertion.type) {
    case 'status':
      return {
        passed: response.success,
        message: response.success
          ? `Status ${response.status} OK`
          : `Expected success but got ${response.status} ${response.statusText}`,
      };

    case 'statusCode':
      const expectedCodes = Array.isArray(assertion.expected)
        ? assertion.expected
        : [assertion.expected];
      const codeMatch = expectedCodes.includes(response.status);
      return {
        passed: codeMatch,
        message: codeMatch
          ? `Status ${response.status} matches expected`
          : `Status ${response.status} not in expected [${expectedCodes.join(', ')}]`,
      };

    case 'hasData':
      const hasData = response.data !== null && response.data !== undefined;
      return {
        passed: hasData,
        message: hasData ? 'Response has data' : 'Response is empty',
      };

    case 'isArray':
      const isArray = Array.isArray(response.data);
      return {
        passed: isArray,
        message: isArray
          ? `Response is array with ${(response.data as unknown[]).length} items`
          : 'Response is not an array',
      };

    case 'arrayNotEmpty':
      const isNonEmptyArray = Array.isArray(response.data) && response.data.length > 0;
      return {
        passed: isNonEmptyArray,
        message: isNonEmptyArray
          ? `Array has ${(response.data as unknown[]).length} items`
          : 'Array is empty or not an array',
      };

    case 'hasField':
      const hasField =
        response.data !== null &&
        typeof response.data === 'object' &&
        assertion.field !== undefined &&
        assertion.field in (response.data as Record<string, unknown>);
      return {
        passed: hasField,
        message: hasField
          ? `Field '${assertion.field}' exists`
          : `Field '${assertion.field}' not found`,
      };

    case 'fieldEquals':
      if (!assertion.field || response.data === null || typeof response.data !== 'object') {
        return { passed: false, message: 'Invalid field check' };
      }
      const value = (response.data as Record<string, unknown>)[assertion.field];
      const equals = value === assertion.expected;
      return {
        passed: equals,
        message: equals
          ? `Field '${assertion.field}' equals expected value`
          : `Field '${assertion.field}' is '${value}', expected '${assertion.expected}'`,
      };

    default:
      return { passed: false, message: 'Unknown assertion type' };
  }
}

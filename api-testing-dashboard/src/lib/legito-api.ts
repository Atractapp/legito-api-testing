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
  dynamicEndpoint?: (context: TestContext) => string;
  dynamicBody?: (context: TestContext) => unknown;
  setsContext?: string;
  usesContext?: string[];
  expectedStatus: number | number[];
  assertions: TestAssertion[];
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
  createdLabel?: { id?: string; [key: string]: unknown };
  createdPushConnection?: { id?: string; [key: string]: unknown };
  permanentDocument?: { id?: string; code?: string; documentRecordId?: string; documentRecordCode?: string; [key: string]: unknown };
  tempDocumentForDelete?: { id?: string; code?: string; documentRecordCode?: string; [key: string]: unknown };
  documentElements?: unknown[];
  users?: unknown[];
  userGroups?: unknown[];
  workflows?: unknown[];
  documentRecords?: unknown[];
  documentVersions?: unknown[];
  objects?: unknown[];
  firstObject?: { id?: string; [key: string]: unknown };
  templateSuites?: unknown[];
  pushConnections?: unknown[];
  createdDocRecordType?: { id?: string; [key: string]: unknown };
  createdTemplateTag?: { id?: string; [key: string]: unknown };
  createdObjectRecord?: { systemName?: string; [key: string]: unknown };
  files?: unknown[];
  // New context properties for CRUD tests
  createdDocumentRecord?: { code?: string; [key: string]: unknown };
  createdUser?: { id?: string; email?: string; [key: string]: unknown };
  createdUserGroup?: { id?: string; [key: string]: unknown };
  uploadedFile?: { id?: string; [key: string]: unknown };
  createdUserShare?: unknown;
  createdUserGroupShare?: unknown;
  createdExternalLink?: { id?: string; [key: string]: unknown };
  jsonIntegrationDocument?: unknown;
  notificationSettings?: unknown;
  [key: string]: unknown;
}

// Default template suite ID for tests
export const DEFAULT_TEMPLATE_SUITE_ID = '10132';

// ============================================================================
// COMPREHENSIVE LEGITO API TESTS - ALL ENDPOINTS
// ============================================================================
export const LEGITO_TESTS: LegitoTest[] = [
  // ==================== SYSTEM INFO ====================
  {
    id: 'info-get',
    name: 'GET /info',
    description: 'Returns system information',
    category: 'System Info',
    endpoint: '/info',
    method: 'GET',
    expectedStatus: 200,
    assertions: [
      { name: 'Returns 200 OK', type: 'status' },
      { name: 'Has version field', type: 'hasField', field: 'version' },
    ],
  },

  // ==================== REFERENCE DATA ====================
  {
    id: 'country-list',
    name: 'GET /country',
    description: 'Returns country list',
    category: 'Reference Data',
    endpoint: '/country',
    method: 'GET',
    expectedStatus: 200,
    assertions: [
      { name: 'Returns 200 OK', type: 'status' },
      { name: 'Returns array', type: 'isArray' },
    ],
  },
  {
    id: 'currency-list',
    name: 'GET /currency',
    description: 'Returns currency list',
    category: 'Reference Data',
    endpoint: '/currency',
    method: 'GET',
    expectedStatus: 200,
    assertions: [
      { name: 'Returns 200 OK', type: 'status' },
      { name: 'Returns array', type: 'isArray' },
    ],
  },
  {
    id: 'language-list',
    name: 'GET /language',
    description: 'Returns list of languages',
    category: 'Reference Data',
    endpoint: '/language',
    method: 'GET',
    expectedStatus: 200,
    assertions: [
      { name: 'Returns 200 OK', type: 'status' },
      { name: 'Returns array', type: 'isArray' },
    ],
  },
  {
    id: 'timezone-list',
    name: 'GET /timezone',
    description: 'Returns a list of timezones',
    category: 'Reference Data',
    endpoint: '/timezone',
    method: 'GET',
    expectedStatus: 200,
    assertions: [
      { name: 'Returns 200 OK', type: 'status' },
      { name: 'Returns array', type: 'isArray' },
    ],
  },
  {
    id: 'category-list',
    name: 'GET /category',
    description: 'Returns category list',
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
    id: 'property-list',
    name: 'GET /property',
    description: 'Returns property list',
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
    id: 'property-group-list',
    name: 'GET /property-group',
    description: 'Returns Property Group list',
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
    id: 'advanced-style-list',
    name: 'GET /advanced-style',
    description: 'Returns Advanced Styles list',
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
    id: 'event-list',
    name: 'GET /event',
    description: 'Returns Event list',
    category: 'Reference Data',
    endpoint: '/event',
    method: 'GET',
    expectedStatus: 200,
    assertions: [
      { name: 'Returns 200 OK', type: 'status' },
      { name: 'Returns array', type: 'isArray' },
    ],
  },

  // ==================== OBJECTS ====================
  {
    id: 'object-list',
    name: 'GET /object',
    description: 'Returns Object list',
    category: 'Objects',
    endpoint: '/object',
    method: 'GET',
    expectedStatus: 200,
    setsContext: 'objects',
    assertions: [
      { name: 'Returns 200 OK', type: 'status' },
      { name: 'Returns array', type: 'isArray' },
    ],
  },

  // ==================== OBJECT RECORDS (CRUD) ====================
  {
    id: 'object-record-list',
    name: 'GET /object-record/{objectId}',
    description: 'Returns Object Record list for first object',
    category: 'Object Records',
    usesContext: ['objects'],
    dynamicEndpoint: (ctx) => {
      const objs = ctx.objects as unknown[];
      if (Array.isArray(objs) && objs.length > 0) {
        const first = objs[0] as { id?: string };
        ctx.firstObject = first;
        return `/object-record/${first.id}`;
      }
      return '/object-record/unknown';
    },
    endpoint: '/object-record/{objectId}',
    method: 'GET',
    expectedStatus: [200, 404],
    skipIf: (ctx) => !Array.isArray(ctx.objects) || ctx.objects.length === 0,
    assertions: [
      { name: 'Returns response', type: 'status' },
    ],
  },
  {
    id: 'object-record-create',
    name: 'POST /object-record/{objectId}',
    description: 'Creates new Object Record',
    category: 'Object Records',
    usesContext: ['objects'],
    dynamicEndpoint: (ctx) => {
      const objs = ctx.objects as unknown[];
      if (Array.isArray(objs) && objs.length > 0) {
        const first = objs[0] as { id?: string };
        return `/object-record/${first.id}`;
      }
      return '/object-record/unknown';
    },
    endpoint: '/object-record/{objectId}',
    method: 'POST',
    // ObjectRecord schema: properties array with systemName and value
    body: {
      properties: [
        {
          systemName: 'api-test-property',
          value: `API-Test-ObjectRecord-${Date.now()}`,
        },
      ],
    },
    setsContext: 'createdObjectRecord',
    expectedStatus: [200, 201, 400, 422],
    skipIf: (ctx) => !Array.isArray(ctx.objects) || ctx.objects.length === 0,
    assertions: [
      { name: 'Returns response', type: 'status' },
    ],
  },
  {
    id: 'object-record-update',
    name: 'PUT /object-record/{systemName}',
    description: 'Updates existing Object Record',
    category: 'Object Records',
    usesContext: ['createdObjectRecord'],
    dynamicEndpoint: (ctx) => {
      const rec = ctx.createdObjectRecord as { systemName?: string };
      return `/object-record/${rec?.systemName || 'unknown'}`;
    },
    endpoint: '/object-record/{systemName}',
    method: 'PUT',
    dynamicBody: (ctx) => ({
      name: `API-Test-ObjectRecord-Updated-${Date.now()}`,
    }),
    expectedStatus: [200, 204, 400, 404, 422],
    skipIf: (ctx) => !ctx.createdObjectRecord?.systemName,
    assertions: [
      { name: 'Returns response', type: 'status' },
    ],
  },
  {
    id: 'object-record-delete',
    name: 'DELETE /object-record/{systemName}',
    description: 'Removes Object Record (cleanup)',
    category: 'Object Records',
    usesContext: ['createdObjectRecord'],
    dynamicEndpoint: (ctx) => {
      const rec = ctx.createdObjectRecord as { systemName?: string };
      return `/object-record/${rec?.systemName || 'unknown'}`;
    },
    endpoint: '/object-record/{systemName}',
    method: 'DELETE',
    expectedStatus: [200, 204, 404],
    skipIf: (ctx) => !ctx.createdObjectRecord?.systemName,
    assertions: [
      { name: 'Returns response', type: 'status' },
    ],
  },

  // ==================== LABELS (CRUD) ====================
  {
    id: 'label-list',
    name: 'GET /label',
    description: 'Returns list of labels',
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
    name: 'POST /label',
    description: 'Creates new Label',
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
    id: 'label-delete',
    name: 'DELETE /label/{labelId}',
    description: 'Removes the Label (cleanup)',
    category: 'Labels',
    usesContext: ['createdLabel'],
    dynamicEndpoint: (ctx) => `/label/${ctx.createdLabel?.id || 'unknown'}`,
    endpoint: '/label/{labelId}',
    method: 'DELETE',
    expectedStatus: [200, 204],
    skipIf: (ctx) => !ctx.createdLabel?.id,
    assertions: [
      { name: 'Returns success', type: 'status' },
    ],
  },

  // ==================== TEMPLATE SUITES ====================
  {
    id: 'template-suite-list',
    name: 'GET /template-suite',
    description: 'Returns a list of Template Suites',
    category: 'Template Suites',
    endpoint: '/template-suite',
    method: 'GET',
    expectedStatus: 200,
    setsContext: 'templateSuites',
    assertions: [
      { name: 'Returns 200 OK', type: 'status' },
      { name: 'Returns array', type: 'isArray' },
      { name: 'Has data', type: 'hasData' },
    ],
  },

  // ==================== TEMPLATE TAGS (CRUD) ====================
  {
    id: 'template-tag-list',
    name: 'GET /template-tag',
    description: 'Returns a list of Template Tags',
    category: 'Template Tags',
    endpoint: '/template-tag',
    method: 'GET',
    expectedStatus: 200,
    assertions: [
      { name: 'Returns 200 OK', type: 'status' },
      { name: 'Returns array', type: 'isArray' },
    ],
  },
  {
    id: 'template-tag-create',
    name: 'POST /template-tag',
    description: 'Creates new Template Tag',
    category: 'Template Tags',
    endpoint: '/template-tag',
    method: 'POST',
    body: {
      name: `API-Test-Tag-${Date.now()}`,
    },
    setsContext: 'createdTemplateTag',
    expectedStatus: [200, 201, 400],
    assertions: [
      { name: 'Returns response', type: 'status' },
    ],
  },

  // ==================== USERS (CRUD) ====================
  {
    id: 'user-list',
    name: 'GET /user',
    description: 'Returns user list',
    category: 'Users',
    endpoint: '/user',
    method: 'GET',
    expectedStatus: 200,
    setsContext: 'users',
    assertions: [
      { name: 'Returns 200 OK', type: 'status' },
      { name: 'Returns array', type: 'isArray' },
      { name: 'Has data', type: 'hasData' },
    ],
  },
  {
    id: 'user-create',
    name: 'POST /user',
    description: 'Creates a new user with default permissions',
    category: 'Users',
    endpoint: '/user',
    method: 'POST',
    // User schema: email, name, position, timezone, customIdentifier
    body: {
      email: `api-test-user-${Date.now()}@test.legito.com`,
      name: 'API Test User',
      position: 'API Tester',
      timezone: 'Europe/Prague',
    },
    setsContext: 'createdUser',
    expectedStatus: [200, 201, 400, 409, 422],
    assertions: [
      { name: 'Returns response', type: 'status' },
    ],
  },
  {
    id: 'user-update',
    name: 'PUT /user/{userIdOrEmail}',
    description: 'Updates user details',
    category: 'Users',
    usesContext: ['createdUser'],
    dynamicEndpoint: (ctx) => {
      const user = ctx.createdUser as { id?: string; email?: string };
      return `/user/${user?.id || user?.email || 'unknown'}`;
    },
    endpoint: '/user/{userIdOrEmail}',
    method: 'PUT',
    dynamicBody: () => ({
      firstName: 'API-Updated',
      lastName: 'TestUser-Updated',
    }),
    expectedStatus: [200, 204, 400, 404, 422],
    skipIf: (ctx) => !ctx.createdUser?.id && !ctx.createdUser?.email,
    assertions: [
      { name: 'Returns response', type: 'status' },
    ],
  },
  {
    id: 'user-permission-get',
    name: 'GET /user/permission/{userIdOrEmail}',
    description: 'Returns list of user permissions for first user',
    category: 'Users',
    usesContext: ['users'],
    dynamicEndpoint: (ctx) => {
      const users = ctx.users as unknown[];
      if (Array.isArray(users) && users.length > 0) {
        const first = users[0] as { id?: string };
        return `/user/permission/${first.id}`;
      }
      return '/user/permission/unknown';
    },
    endpoint: '/user/permission/{userIdOrEmail}',
    method: 'GET',
    expectedStatus: [200, 404],
    skipIf: (ctx) => !Array.isArray(ctx.users) || ctx.users.length === 0,
    assertions: [
      { name: 'Returns response', type: 'status' },
    ],
  },
  {
    id: 'user-permission-update',
    name: 'PUT /user/permission/{userIdOrEmail}',
    description: 'Adds a user permission',
    category: 'Users',
    usesContext: ['createdUser'],
    dynamicEndpoint: (ctx) => {
      const user = ctx.createdUser as { id?: string; email?: string };
      return `/user/permission/${user?.id || user?.email || 'unknown'}`;
    },
    endpoint: '/user/permission/{userIdOrEmail}',
    method: 'PUT',
    body: {
      permission: 'document.read',
    },
    expectedStatus: [200, 204, 400, 404, 422],
    skipIf: (ctx) => !ctx.createdUser?.id && !ctx.createdUser?.email,
    assertions: [
      { name: 'Returns response', type: 'status' },
    ],
  },
  {
    id: 'user-delete',
    name: 'DELETE /user/{userIdOrEmail}',
    description: 'Removes user (cleanup)',
    category: 'Users',
    usesContext: ['createdUser'],
    dynamicEndpoint: (ctx) => {
      const user = ctx.createdUser as { id?: string; email?: string };
      return `/user/${user?.id || user?.email || 'unknown'}`;
    },
    endpoint: '/user/{userIdOrEmail}',
    method: 'DELETE',
    expectedStatus: [200, 204, 404],
    skipIf: (ctx) => !ctx.createdUser?.id && !ctx.createdUser?.email,
    assertions: [
      { name: 'Returns response', type: 'status' },
    ],
  },

  // ==================== USER GROUPS (CRUD) ====================
  {
    id: 'user-group-list',
    name: 'GET /user-group',
    description: 'Returns user group list',
    category: 'User Groups',
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
    id: 'user-group-create',
    name: 'POST /user-group',
    description: 'Inserts new user group',
    category: 'User Groups',
    endpoint: '/user-group',
    method: 'POST',
    body: {
      name: `API-Test-Group-${Date.now()}`,
    },
    setsContext: 'createdUserGroup',
    expectedStatus: [200, 201, 400, 409, 422],
    assertions: [
      { name: 'Returns response', type: 'status' },
    ],
  },
  {
    id: 'user-group-update',
    name: 'PUT /user-group/{userGroupId}',
    description: 'Updates existing user group',
    category: 'User Groups',
    usesContext: ['createdUserGroup'],
    dynamicEndpoint: (ctx) => {
      const group = ctx.createdUserGroup as { id?: string };
      return `/user-group/${group?.id || 'unknown'}`;
    },
    endpoint: '/user-group/{userGroupId}',
    method: 'PUT',
    dynamicBody: () => ({
      name: `API-Test-Group-Updated-${Date.now()}`,
    }),
    expectedStatus: [200, 204, 400, 404, 422],
    skipIf: (ctx) => !ctx.createdUserGroup?.id,
    assertions: [
      { name: 'Returns response', type: 'status' },
    ],
  },
  {
    id: 'user-group-add-user',
    name: 'POST /user-group/user/{userGroupId}',
    description: 'Adds user to user group',
    category: 'User Groups',
    usesContext: ['createdUserGroup', 'users'],
    dynamicEndpoint: (ctx) => {
      const group = ctx.createdUserGroup as { id?: string };
      return `/user-group/user/${group?.id || 'unknown'}`;
    },
    endpoint: '/user-group/user/{userGroupId}',
    method: 'POST',
    dynamicBody: (ctx) => {
      const users = ctx.users as unknown[];
      if (Array.isArray(users) && users.length > 0) {
        const first = users[0] as { id?: string; email?: string };
        return { userIdOrEmail: first.id || first.email };
      }
      return { userIdOrEmail: 'unknown' };
    },
    expectedStatus: [200, 201, 400, 404, 409, 422],
    skipIf: (ctx) => !ctx.createdUserGroup?.id || !Array.isArray(ctx.users) || ctx.users.length === 0,
    assertions: [
      { name: 'Returns response', type: 'status' },
    ],
  },
  {
    id: 'user-group-remove-user',
    name: 'DELETE /user-group/user/{userGroupId}/{userIdOrEmail}',
    description: 'Removes user from department',
    category: 'User Groups',
    usesContext: ['createdUserGroup', 'users'],
    dynamicEndpoint: (ctx) => {
      const group = ctx.createdUserGroup as { id?: string };
      const users = ctx.users as unknown[];
      if (Array.isArray(users) && users.length > 0) {
        const first = users[0] as { id?: string };
        return `/user-group/user/${group?.id || 'unknown'}/${first.id}`;
      }
      return '/user-group/user/unknown/unknown';
    },
    endpoint: '/user-group/user/{userGroupId}/{userIdOrEmail}',
    method: 'DELETE',
    expectedStatus: [200, 204, 404],
    skipIf: (ctx) => !ctx.createdUserGroup?.id || !Array.isArray(ctx.users) || ctx.users.length === 0,
    assertions: [
      { name: 'Returns response', type: 'status' },
    ],
  },
  {
    id: 'user-group-delete',
    name: 'DELETE /user-group/{userGroupId}',
    description: 'Removes user group (cleanup)',
    category: 'User Groups',
    usesContext: ['createdUserGroup'],
    dynamicEndpoint: (ctx) => {
      const group = ctx.createdUserGroup as { id?: string };
      return `/user-group/${group?.id || 'unknown'}`;
    },
    endpoint: '/user-group/{userGroupId}',
    method: 'DELETE',
    expectedStatus: [200, 204, 404],
    skipIf: (ctx) => !ctx.createdUserGroup?.id,
    assertions: [
      { name: 'Returns response', type: 'status' },
    ],
  },

  // ==================== WORKFLOWS ====================
  {
    id: 'workflow-list',
    name: 'GET /workflow',
    description: 'Returns workflow list',
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
    id: 'workflow-revision-get',
    name: 'GET /workflow/revision/{workflowRevisionId}',
    description: 'Returns schema of Workflow Revision for first workflow',
    category: 'Workflows',
    usesContext: ['workflows'],
    dynamicEndpoint: (ctx) => {
      const wfs = ctx.workflows as unknown[];
      if (Array.isArray(wfs) && wfs.length > 0) {
        const first = wfs[0] as { id?: string };
        return `/workflow/revision/${first.id}`;
      }
      return '/workflow/revision/unknown';
    },
    endpoint: '/workflow/revision/{workflowRevisionId}',
    method: 'GET',
    expectedStatus: [200, 404],
    skipIf: (ctx) => !Array.isArray(ctx.workflows) || ctx.workflows.length === 0,
    assertions: [
      { name: 'Returns response', type: 'status' },
    ],
  },

  // ==================== DOCUMENT RECORDS (CRUD) ====================
  {
    id: 'document-record-list',
    name: 'GET /document-record',
    description: 'Returns Document Record list',
    category: 'Document Records',
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
    id: 'document-record-create',
    name: 'POST /document-record',
    description: 'Creates new Document Record',
    category: 'Document Records',
    endpoint: '/document-record',
    method: 'POST',
    body: {
      name: `API-Test-DocRecord-${Date.now()}`,
      templateSuiteId: 10132,
    },
    setsContext: 'createdDocumentRecord',
    expectedStatus: [200, 201, 400, 422],
    assertions: [
      { name: 'Returns response', type: 'status' },
    ],
  },
  {
    id: 'document-record-update',
    name: 'PUT /document-record/{code}',
    description: 'Updates existing Document Record',
    category: 'Document Records',
    usesContext: ['createdDocumentRecord'],
    dynamicEndpoint: (ctx) => {
      const doc = ctx.createdDocumentRecord as { code?: string };
      return `/document-record/${doc?.code || 'unknown'}`;
    },
    endpoint: '/document-record/{code}',
    method: 'PUT',
    dynamicBody: (ctx) => ({
      name: `API-Test-DocRecord-Updated-${Date.now()}`,
    }),
    expectedStatus: [200, 204, 400, 404, 422],
    skipIf: (ctx) => !ctx.createdDocumentRecord?.code,
    assertions: [
      { name: 'Returns response', type: 'status' },
    ],
  },
  {
    id: 'document-record-anonymize',
    name: 'GET /document-record/anonymize/{code}',
    description: 'Anonymize Document Record (test with first doc)',
    category: 'Document Records',
    usesContext: ['documentRecords'],
    dynamicEndpoint: (ctx) => {
      const docs = ctx.documentRecords as unknown[];
      if (Array.isArray(docs) && docs.length > 0) {
        const first = docs[0] as { code?: string };
        return `/document-record/anonymize/${first.code}`;
      }
      return '/document-record/anonymize/unknown';
    },
    endpoint: '/document-record/anonymize/{code}',
    method: 'GET',
    expectedStatus: [200, 404, 400],
    skipIf: (ctx) => !Array.isArray(ctx.documentRecords) || ctx.documentRecords.length === 0,
    assertions: [
      { name: 'Returns response', type: 'status' },
    ],
  },

  // ==================== DOCUMENT RECORD TYPES (CRUD) ====================
  {
    id: 'document-record-type-list',
    name: 'GET /document-record-type',
    description: 'Returns list of Document Record Types',
    category: 'Document Record Types',
    endpoint: '/document-record-type',
    method: 'GET',
    expectedStatus: 200,
    assertions: [
      { name: 'Returns 200 OK', type: 'status' },
      { name: 'Returns array', type: 'isArray' },
    ],
  },
  {
    id: 'document-record-type-create',
    name: 'POST /document-record-type',
    description: 'Creates new Document Record Type',
    category: 'Document Record Types',
    endpoint: '/document-record-type',
    method: 'POST',
    body: {
      name: `API-Test-DocType-${Date.now()}`,
    },
    setsContext: 'createdDocRecordType',
    expectedStatus: [200, 201, 400],
    assertions: [
      { name: 'Returns response', type: 'status' },
    ],
  },
  {
    id: 'document-record-type-update',
    name: 'PUT /document-record-type/{documentRecordTypeId}',
    description: 'Updates the Document Record Type',
    category: 'Document Record Types',
    usesContext: ['createdDocRecordType'],
    dynamicEndpoint: (ctx) => `/document-record-type/${ctx.createdDocRecordType?.id || 'unknown'}`,
    endpoint: '/document-record-type/{documentRecordTypeId}',
    method: 'PUT',
    dynamicBody: (ctx) => ({
      name: `API-Test-DocType-Updated-${Date.now()}`,
    }),
    expectedStatus: [200, 204, 400, 404],
    skipIf: (ctx) => !ctx.createdDocRecordType?.id,
    assertions: [
      { name: 'Returns response', type: 'status' },
    ],
  },
  {
    id: 'document-record-type-delete',
    name: 'DELETE /document-record-type/{documentRecordTypeId}',
    description: 'Removes the Document Record Type (cleanup)',
    category: 'Document Record Types',
    usesContext: ['createdDocRecordType'],
    dynamicEndpoint: (ctx) => `/document-record-type/${ctx.createdDocRecordType?.id || 'unknown'}`,
    endpoint: '/document-record-type/{documentRecordTypeId}',
    method: 'DELETE',
    expectedStatus: [200, 204, 404],
    skipIf: (ctx) => !ctx.createdDocRecordType?.id,
    assertions: [
      { name: 'Returns response', type: 'status' },
    ],
  },

  // ==================== DOCUMENT VERSIONS ====================
  {
    id: 'document-version-create',
    name: 'POST /document-version/data/{templateSuiteId}',
    description: 'Creates new Document Record from template 10132 (KEPT)',
    category: 'Document Versions',
    endpoint: '/document-version/data/10132',
    method: 'POST',
    body: [
      { name: 'client_name', value: 'API Test Client Corp' },
      { name: 'contractor_name', value: 'API Test Contractor Ltd' },
    ],
    setsContext: 'permanentDocument',
    expectedStatus: [200, 201],
    assertions: [
      { name: 'Returns success', type: 'status' },
      { name: 'Has document code', type: 'hasField', field: 'code' },
      { name: 'Has document record ID', type: 'hasField', field: 'documentRecordId' },
    ],
  },
  {
    id: 'document-version-get-data',
    name: 'GET /document-version/data/{code}',
    description: 'Returns Elements data from created document',
    category: 'Document Versions',
    usesContext: ['permanentDocument'],
    dynamicEndpoint: (ctx) => {
      const doc = ctx.permanentDocument as { code?: string };
      return `/document-version/data/${doc?.code || 'unknown'}`;
    },
    endpoint: '/document-version/data/{code}',
    method: 'GET',
    expectedStatus: 200,
    skipIf: (ctx) => !ctx.permanentDocument?.code,
    setsContext: 'documentElements',
    assertions: [
      { name: 'Returns 200 OK', type: 'status' },
      { name: 'Returns array of elements', type: 'isArray' },
    ],
  },
  {
    id: 'document-version-download',
    name: 'GET /document-version/download/{code}/pdf',
    description: 'Downloads document as PDF (base64 encoded)',
    category: 'Document Versions',
    usesContext: ['permanentDocument'],
    dynamicEndpoint: (ctx) => {
      const doc = ctx.permanentDocument as { code?: string };
      return `/document-version/download/${doc?.code || 'unknown'}/pdf`;
    },
    endpoint: '/document-version/download/{code}/{format}',
    method: 'GET',
    expectedStatus: [200, 404],
    skipIf: (ctx) => !ctx.permanentDocument?.code,
    assertions: [
      { name: 'Returns response', type: 'status' },
    ],
  },
  {
    id: 'document-version-update',
    name: 'PUT /document-version/data/{documentRecordcode}',
    description: 'Updates document version with new element data',
    category: 'Document Versions',
    usesContext: ['permanentDocument'],
    dynamicEndpoint: (ctx) => {
      const doc = ctx.permanentDocument as { documentRecordCode?: string };
      return `/document-version/data/${doc?.documentRecordCode || 'unknown'}`;
    },
    endpoint: '/document-version/data/{documentRecordcode}',
    method: 'PUT',
    dynamicBody: () => ([
      { name: 'client_name', value: `API Test Client Updated - ${Date.now()}` },
    ]),
    expectedStatus: [200, 201, 400, 404, 422],
    skipIf: (ctx) => !ctx.permanentDocument?.documentRecordCode,
    assertions: [
      { name: 'Returns response', type: 'status' },
    ],
  },
  {
    id: 'document-version-json-integration',
    name: 'POST /document-version/json-integration',
    description: 'Maps json data to new document version',
    category: 'Document Versions',
    endpoint: '/document-version/json-integration',
    method: 'POST',
    body: {
      templateSuiteId: 10132,
      data: {
        client_name: 'JSON Integration Test Client',
        contractor_name: 'JSON Integration Test Contractor',
      },
    },
    setsContext: 'jsonIntegrationDocument',
    expectedStatus: [200, 201, 400, 422],
    assertions: [
      { name: 'Returns response', type: 'status' },
    ],
  },
  {
    id: 'document-version-create-for-delete',
    name: 'POST /document-version/data/{templateSuiteId} (for DELETE test)',
    description: 'Creates temporary Document for DELETE test',
    category: 'Document Versions',
    endpoint: '/document-version/data/10132',
    method: 'POST',
    body: [
      { name: 'client_name', value: 'TEMP - Delete Test Document' },
    ],
    setsContext: 'tempDocumentForDelete',
    expectedStatus: [200, 201],
    assertions: [
      { name: 'Returns success', type: 'status' },
      { name: 'Has document record code', type: 'hasField', field: 'documentRecordCode' },
    ],
  },
  {
    id: 'document-record-delete',
    name: 'DELETE /document-record/{code}',
    description: 'Removes the temporary Document Record (cleanup)',
    category: 'Document Versions',
    usesContext: ['tempDocumentForDelete'],
    dynamicEndpoint: (ctx) => {
      const doc = ctx.tempDocumentForDelete as { documentRecordCode?: string };
      return `/document-record/${doc?.documentRecordCode || 'unknown'}`;
    },
    endpoint: '/document-record/{code}',
    method: 'DELETE',
    expectedStatus: [200, 204],
    skipIf: (ctx) => !ctx.tempDocumentForDelete?.documentRecordCode,
    assertions: [
      { name: 'Returns success', type: 'status' },
    ],
  },

  // ==================== FILES (CRUD) ====================
  {
    id: 'file-list',
    name: 'GET /file/{documentRecordCode}',
    description: 'Returns files related to Document Record',
    category: 'Files',
    usesContext: ['documentRecords'],
    dynamicEndpoint: (ctx) => {
      const docs = ctx.documentRecords as unknown[];
      if (Array.isArray(docs) && docs.length > 0) {
        const first = docs[0] as { code?: string };
        return `/file/${first.code}`;
      }
      return '/file/unknown';
    },
    endpoint: '/file/{documentRecordCode}',
    method: 'GET',
    expectedStatus: [200, 404],
    skipIf: (ctx) => !Array.isArray(ctx.documentRecords) || ctx.documentRecords.length === 0,
    setsContext: 'files',
    assertions: [
      { name: 'Returns response', type: 'status' },
    ],
  },
  {
    id: 'file-upload',
    name: 'POST /file/{documentRecordCode}',
    description: 'Uploads external file into Document Record',
    category: 'Files',
    usesContext: ['permanentDocument'],
    dynamicEndpoint: (ctx) => {
      const doc = ctx.permanentDocument as { documentRecordCode?: string };
      return `/file/${doc?.documentRecordCode || 'unknown'}`;
    },
    endpoint: '/file/{documentRecordCode}',
    method: 'POST',
    // FileWithData schema: name, data (base64 with MIME prefix)
    body: {
      name: 'api-test-file.txt',
      data: 'data:text/plain;base64,QVBJIFRlc3QgRmlsZSBDb250ZW50',
    },
    setsContext: 'uploadedFile',
    expectedStatus: [200, 201, 400, 415, 422],
    skipIf: (ctx) => !ctx.permanentDocument?.documentRecordCode,
    assertions: [
      { name: 'Returns response', type: 'status' },
    ],
  },
  {
    id: 'file-download',
    name: 'GET /file/download/{fileId}',
    description: 'Downloads external file',
    category: 'Files',
    usesContext: ['uploadedFile'],
    dynamicEndpoint: (ctx) => {
      const file = ctx.uploadedFile as { id?: string };
      return `/file/download/${file?.id || 'unknown'}`;
    },
    endpoint: '/file/download/{fileId}',
    method: 'GET',
    expectedStatus: [200, 404],
    skipIf: (ctx) => !ctx.uploadedFile?.id,
    assertions: [
      { name: 'Returns response', type: 'status' },
    ],
  },
  {
    id: 'file-delete',
    name: 'DELETE /file/{fileId}',
    description: 'Removes external file from Document Record',
    category: 'Files',
    usesContext: ['uploadedFile'],
    dynamicEndpoint: (ctx) => {
      const file = ctx.uploadedFile as { id?: string };
      return `/file/${file?.id || 'unknown'}`;
    },
    endpoint: '/file/{fileId}',
    method: 'DELETE',
    expectedStatus: [200, 204, 404],
    skipIf: (ctx) => !ctx.uploadedFile?.id,
    assertions: [
      { name: 'Returns response', type: 'status' },
    ],
  },

  // ==================== PUSH CONNECTIONS (Webhooks) ====================
  {
    id: 'push-connection-list',
    name: 'GET /push-connection',
    description: 'Returns Push Connection list',
    category: 'Push Connections',
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
    id: 'push-connection-create',
    name: 'POST /push-connection',
    description: 'Creates new Push Connection',
    category: 'Push Connections',
    endpoint: '/push-connection',
    method: 'POST',
    // PushConnection schema: name (required), url (required), enabled, eventTypes, templateSuiteAll
    body: {
      name: `API-Test-Webhook-${Date.now()}`,
      url: 'https://webhook.site/test-legito-api',
      enabled: false,
      eventTypes: ['DocumentRecordCreated', 'DocumentRecordUpdated'],
      templateSuiteAll: true,
      documentRecordTypeAll: true,
    },
    setsContext: 'createdPushConnection',
    expectedStatus: [200, 201, 400],
    assertions: [
      { name: 'Returns response', type: 'status' },
    ],
  },
  {
    id: 'push-connection-delete',
    name: 'DELETE /push-connection/{pushConnectionId}',
    description: 'Removes Push connection (cleanup)',
    category: 'Push Connections',
    usesContext: ['createdPushConnection'],
    dynamicEndpoint: (ctx) => `/push-connection/${ctx.createdPushConnection?.id || 'unknown'}`,
    endpoint: '/push-connection/{pushConnectionId}',
    method: 'DELETE',
    expectedStatus: [200, 204, 404],
    skipIf: (ctx) => !ctx.createdPushConnection?.id,
    assertions: [
      { name: 'Returns response', type: 'status' },
    ],
  },

  // ==================== SHARING (CRUD) ====================
  {
    id: 'share-get',
    name: 'GET /share/{code}',
    description: 'Returns share lists for Document Record',
    category: 'Sharing',
    usesContext: ['documentRecords'],
    dynamicEndpoint: (ctx) => {
      const docs = ctx.documentRecords as unknown[];
      if (Array.isArray(docs) && docs.length > 0) {
        const first = docs[0] as { code?: string };
        return `/share/${first.code}`;
      }
      return '/share/unknown';
    },
    endpoint: '/share/{code}',
    method: 'GET',
    expectedStatus: [200, 404],
    skipIf: (ctx) => !Array.isArray(ctx.documentRecords) || ctx.documentRecords.length === 0,
    assertions: [
      { name: 'Returns response', type: 'status' },
    ],
  },
  {
    id: 'share-user-create',
    name: 'POST /share/user/{code}',
    description: 'Creates a user share for document record',
    category: 'Sharing',
    usesContext: ['permanentDocument', 'users'],
    dynamicEndpoint: (ctx) => {
      const doc = ctx.permanentDocument as { documentRecordCode?: string };
      return `/share/user/${doc?.documentRecordCode || 'unknown'}`;
    },
    endpoint: '/share/user/{code}',
    method: 'POST',
    // ShareUser schema: array of [{id or email, permission: LIST|READ|EDIT|MANAGE}]
    dynamicBody: (ctx) => {
      const users = ctx.users as unknown[];
      if (Array.isArray(users) && users.length > 0) {
        const first = users[0] as { id?: number; email?: string };
        return [
          {
            id: first.id,
            permission: 'READ',
          },
        ];
      }
      return [{ email: 'unknown@test.com', permission: 'READ' }];
    },
    setsContext: 'createdUserShare',
    expectedStatus: [200, 201, 400, 404, 422],
    skipIf: (ctx) => !ctx.permanentDocument?.documentRecordCode || !Array.isArray(ctx.users) || ctx.users.length === 0,
    assertions: [
      { name: 'Returns response', type: 'status' },
    ],
  },
  {
    id: 'share-user-delete',
    name: 'DELETE /share/user/{code}/{userIdOrEmail}',
    description: 'Removes the user share from Document record',
    category: 'Sharing',
    usesContext: ['permanentDocument', 'users'],
    dynamicEndpoint: (ctx) => {
      const doc = ctx.permanentDocument as { documentRecordCode?: string };
      const users = ctx.users as unknown[];
      if (Array.isArray(users) && users.length > 0) {
        const first = users[0] as { id?: string };
        return `/share/user/${doc?.documentRecordCode || 'unknown'}/${first.id}`;
      }
      return '/share/user/unknown/unknown';
    },
    endpoint: '/share/user/{code}/{userIdOrEmail}',
    method: 'DELETE',
    expectedStatus: [200, 204, 404],
    skipIf: (ctx) => !ctx.permanentDocument?.documentRecordCode || !Array.isArray(ctx.users) || ctx.users.length === 0,
    assertions: [
      { name: 'Returns response', type: 'status' },
    ],
  },
  {
    id: 'share-user-group-create',
    name: 'POST /share/user-group/{code}',
    description: 'Creates a user group share for document record',
    category: 'Sharing',
    usesContext: ['permanentDocument', 'userGroups'],
    dynamicEndpoint: (ctx) => {
      const doc = ctx.permanentDocument as { documentRecordCode?: string };
      return `/share/user-group/${doc?.documentRecordCode || 'unknown'}`;
    },
    endpoint: '/share/user-group/{code}',
    method: 'POST',
    // ShareUserGroup schema: array of [{id}]
    dynamicBody: (ctx) => {
      const groups = ctx.userGroups as unknown[];
      if (Array.isArray(groups) && groups.length > 0) {
        const first = groups[0] as { id?: number };
        return [{ id: first.id }];
      }
      return [{ id: 0 }];
    },
    setsContext: 'createdUserGroupShare',
    expectedStatus: [200, 201, 400, 404, 422],
    skipIf: (ctx) => !ctx.permanentDocument?.documentRecordCode || !Array.isArray(ctx.userGroups) || ctx.userGroups.length === 0,
    assertions: [
      { name: 'Returns response', type: 'status' },
    ],
  },
  {
    id: 'share-user-group-delete',
    name: 'DELETE /share/user-group/{code}/{userGroupId}',
    description: 'Removes the user group share from Document record',
    category: 'Sharing',
    usesContext: ['permanentDocument', 'userGroups'],
    dynamicEndpoint: (ctx) => {
      const doc = ctx.permanentDocument as { documentRecordCode?: string };
      const groups = ctx.userGroups as unknown[];
      if (Array.isArray(groups) && groups.length > 0) {
        const first = groups[0] as { id?: string };
        return `/share/user-group/${doc?.documentRecordCode || 'unknown'}/${first.id}`;
      }
      return '/share/user-group/unknown/unknown';
    },
    endpoint: '/share/user-group/{code}/{userGroupId}',
    method: 'DELETE',
    expectedStatus: [200, 204, 404],
    skipIf: (ctx) => !ctx.permanentDocument?.documentRecordCode || !Array.isArray(ctx.userGroups) || ctx.userGroups.length === 0,
    assertions: [
      { name: 'Returns response', type: 'status' },
    ],
  },
  {
    id: 'share-external-link-create',
    name: 'POST /share/external-link/{code}',
    description: 'Creates an External link for Document Record',
    category: 'Sharing',
    usesContext: ['permanentDocument'],
    dynamicEndpoint: (ctx) => {
      const doc = ctx.permanentDocument as { documentRecordCode?: string };
      return `/share/external-link/${doc?.documentRecordCode || 'unknown'}`;
    },
    endpoint: '/share/external-link/{code}',
    method: 'POST',
    // ExternalLink schema: array of [{active, type, permission, useMax}]
    body: [
      {
        active: true,
        type: 'document',
        permission: 'READ',
        useMax: 0,
      },
    ],
    setsContext: 'createdExternalLink',
    expectedStatus: [200, 201, 400, 404, 422],
    skipIf: (ctx) => !ctx.permanentDocument?.documentRecordCode,
    assertions: [
      { name: 'Returns response', type: 'status' },
    ],
  },
  {
    id: 'share-external-link-update',
    name: 'PUT /share/external-link/{externalLinkId}',
    description: 'Updates an External link',
    category: 'Sharing',
    usesContext: ['createdExternalLink'],
    dynamicEndpoint: (ctx) => {
      const link = ctx.createdExternalLink as { id?: string };
      return `/share/external-link/${link?.id || 'unknown'}`;
    },
    endpoint: '/share/external-link/{externalLinkId}',
    method: 'PUT',
    body: {
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    },
    expectedStatus: [200, 204, 400, 404],
    skipIf: (ctx) => !ctx.createdExternalLink?.id,
    assertions: [
      { name: 'Returns response', type: 'status' },
    ],
  },
  {
    id: 'share-external-link-delete',
    name: 'DELETE /share/external-link/{externalLinkId}',
    description: 'Deactivates and removes the External Link',
    category: 'Sharing',
    usesContext: ['createdExternalLink'],
    dynamicEndpoint: (ctx) => {
      const link = ctx.createdExternalLink as { id?: string };
      return `/share/external-link/${link?.id || 'unknown'}`;
    },
    endpoint: '/share/external-link/{externalLinkId}',
    method: 'DELETE',
    expectedStatus: [200, 204, 404],
    skipIf: (ctx) => !ctx.createdExternalLink?.id,
    assertions: [
      { name: 'Returns response', type: 'status' },
    ],
  },

  // ==================== NOTIFICATION SETTINGS ====================
  {
    id: 'notification-setting-get',
    name: 'GET /notification-setting/{userIdOrEmail}',
    description: 'Returns user notification settings',
    category: 'Notification Settings',
    usesContext: ['users'],
    dynamicEndpoint: (ctx) => {
      const users = ctx.users as unknown[];
      if (Array.isArray(users) && users.length > 0) {
        const first = users[0] as { id?: string };
        return `/notification-setting/${first.id}`;
      }
      return '/notification-setting/unknown';
    },
    endpoint: '/notification-setting/{userIdOrEmail}',
    method: 'GET',
    expectedStatus: [200, 404],
    skipIf: (ctx) => !Array.isArray(ctx.users) || ctx.users.length === 0,
    setsContext: 'notificationSettings',
    assertions: [
      { name: 'Returns response', type: 'status' },
    ],
  },
  {
    id: 'notification-setting-update',
    name: 'PUT /notification-setting/{userIdOrEmail}',
    description: 'Updates user notification settings',
    category: 'Notification Settings',
    usesContext: ['users'],
    dynamicEndpoint: (ctx) => {
      const users = ctx.users as unknown[];
      if (Array.isArray(users) && users.length > 0) {
        const first = users[0] as { id?: string };
        return `/notification-setting/${first.id}`;
      }
      return '/notification-setting/unknown';
    },
    endpoint: '/notification-setting/{userIdOrEmail}',
    method: 'PUT',
    // NotificationSetting schema: objects with web/email properties (Newer|My|Shared)
    body: {
      changeOwner: { web: 'Newer', email: 'My' },
      share: { web: 'Shared', email: 'Newer' },
      fileUpload: { web: 'Shared', email: 'Newer' },
      newDocumentVersion: { web: 'Shared', email: 'Newer' },
    },
    expectedStatus: [200, 201, 204, 400, 404, 422],
    skipIf: (ctx) => !Array.isArray(ctx.users) || ctx.users.length === 0,
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

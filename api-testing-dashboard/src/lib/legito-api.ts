// Legito API Client with JWT Authentication
// Comprehensive CRUD Test Suite

// Use local proxy to bypass CORS when running in browser
const PROXY_BASE_URL = '/api/legito';
const DEFAULT_BASE_URL = 'https://api.legito.com/api/v7';

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

// Proxy response format from our Next.js API route
interface ProxyResponse {
  data?: unknown;
  status: number;
  statusText: string;
  duration: number;
  error?: string;
}

// Make authenticated API request via proxy to bypass CORS
export async function legitoRequest<T = unknown>(
  endpoint: string,
  options: {
    method?: string;
    body?: unknown;
    jwt: string;
    timeout?: number;
    baseUrl?: string;
  }
): Promise<ApiResponse<T>> {
  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeout || 30000);

  try {
    // Use the proxy endpoint to bypass CORS
    const proxyUrl = `${PROXY_BASE_URL}${endpoint}`;

    // Build request headers, including custom base URL for proxy
    const requestHeaders: Record<string, string> = {
      'Authorization': `Bearer ${options.jwt}`,
      'Content-Type': 'application/json',
    };
    if (options.baseUrl) {
      requestHeaders['X-Legito-BaseUrl'] = options.baseUrl;
    }

    const response = await fetch(proxyUrl, {
      method: options.method || 'GET',
      headers: requestHeaders,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const duration = Date.now() - startTime;

    // Get response headers
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    // Parse the proxy response
    let proxyData: ProxyResponse;
    try {
      proxyData = await response.json();
    } catch {
      return {
        success: false,
        status: 0,
        statusText: 'Network Error',
        error: 'Failed to parse proxy response',
        duration,
        headers: responseHeaders,
      };
    }

    // Check for proxy-level errors
    if (proxyData.error && proxyData.status === 0) {
      return {
        success: false,
        status: 0,
        statusText: proxyData.statusText || 'Network Error',
        error: proxyData.error,
        duration: proxyData.duration || duration,
        headers: responseHeaders,
      };
    }

    // Extract the actual API response from proxy wrapper
    const actualStatus = proxyData.status;
    const actualStatusText = proxyData.statusText;
    const actualData = proxyData.data as T | undefined;
    const isSuccess = actualStatus >= 200 && actualStatus < 300;

    // Check for error in the response data
    let error: string | undefined;
    if (!isSuccess && actualData) {
      if (typeof actualData === 'object' && actualData !== null) {
        const errorData = actualData as Record<string, unknown>;
        error = (errorData.message || errorData.error || JSON.stringify(actualData)) as string;
      } else if (typeof actualData === 'string') {
        error = actualData;
      }
    }

    return {
      success: isSuccess,
      status: actualStatus,
      statusText: actualStatusText,
      data: actualData,
      error,
      duration: proxyData.duration || duration,
      headers: responseHeaders,
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
  // CRUD tracking
  crudOperation?: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'ANONYMIZE' | 'SHARE';
  resourceCategory?: 'kept' | 'to-delete' | 'n/a';
  entityType?: string;
}

export interface TestAssertion {
  name: string;
  type: 'status' | 'hasData' | 'isArray' | 'hasField' | 'fieldEquals' | 'arrayNotEmpty' | 'statusCode';
  field?: string;
  expected?: unknown;
}

// ============================================================================
// CRUD TRACKING TYPES
// ============================================================================

export interface CrudOperationRecord {
  entityType: string;
  operation: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'ANONYMIZE' | 'SHARE';
  resourceId: string;
  resourceName?: string;
  resourceCategory: 'kept' | 'to-delete' | 'n/a';
  success: boolean;
  timestamp: string;
  duration: number;
  error?: string;
}

export interface CrudReportSummary {
  operations: CrudOperationRecord[];
  byEntity: Record<string, {
    created: { kept: number; deleted: number };
    read: number;
    updated: number;
    deleted: number;
    anonymized: number;
    shared: number;
    errors: number;
  }>;
  totals: {
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    resourcesCreated: number;
    resourcesKept: number;
    resourcesDeleted: number;
  };
  // IMPORTANT: External link URL for easy access
  externalLinkUrl?: string;
}

// ============================================================================
// RESOURCE TRACKING
// ============================================================================

export interface TrackedResource<T = unknown> {
  data: T;
  createdAt: string;
  keep: boolean;
}

export interface ResourcePair<T = unknown> {
  kept: TrackedResource<T> | null;
  toDelete: TrackedResource<T> | null;
}

// ============================================================================
// CONTEXT FOR CHAINING TESTS
// ============================================================================

export interface ObjectRecordData {
  id?: number;
  systemName?: string;
  name?: string;
  properties?: Record<string, unknown>;
}

export interface DocumentData {
  id?: number;
  code?: string;
  documentRecordId?: number;
  documentRecordCode?: string;
  name?: string;
}

export interface UserData {
  id?: number;
  email?: string;
  name?: string;
}

export interface UserGroupData {
  id?: number;
  name?: string;
}

export interface ExternalLinkData {
  id?: number;
  token?: string;
  code?: string;
  hash?: string;
  url?: string;
  link?: string;
  shareUrl?: string;
  active?: boolean;
}

export interface TestContext {
  // Reference data
  objects?: unknown[];
  users?: unknown[];
  userGroups?: unknown[];
  workflows?: unknown[];
  documentRecords?: unknown[];
  templateSuites?: unknown[];
  templateElements?: unknown[];
  documentElements?: unknown[];

  // Object Records (CRUD pair)
  objectRecords: ResourcePair<ObjectRecordData>;
  lastCreatedObjectRecordSystemName?: string;

  // Documents (CRUD pair)
  documents: ResourcePair<DocumentData>;

  // Users (CRUD pair) - NEVER touch existing users
  testUsers: ResourcePair<UserData>;

  // User Groups (CRUD pair)
  testUserGroups: ResourcePair<UserGroupData>;

  // External Links (CRUD pair)
  externalLinks: ResourcePair<ExternalLinkData>;

  // Sharing
  userShare?: unknown;
  userGroupShare?: unknown;

  // CRUD Report
  crudReport: CrudReportSummary;

  // Legacy compatibility
  [key: string]: unknown;
}

// Initialize empty context
export function createEmptyTestContext(): TestContext {
  return {
    objectRecords: { kept: null, toDelete: null },
    documents: { kept: null, toDelete: null },
    testUsers: { kept: null, toDelete: null },
    testUserGroups: { kept: null, toDelete: null },
    externalLinks: { kept: null, toDelete: null },
    crudReport: {
      operations: [],
      byEntity: {},
      totals: {
        totalOperations: 0,
        successfulOperations: 0,
        failedOperations: 0,
        resourcesCreated: 0,
        resourcesKept: 0,
        resourcesDeleted: 0,
      },
    },
  };
}

// Record a CRUD operation
export function recordCrudOperation(
  context: TestContext,
  operation: CrudOperationRecord
): void {
  context.crudReport.operations.push(operation);

  // Initialize entity summary if needed
  if (!context.crudReport.byEntity[operation.entityType]) {
    context.crudReport.byEntity[operation.entityType] = {
      created: { kept: 0, deleted: 0 },
      read: 0,
      updated: 0,
      deleted: 0,
      anonymized: 0,
      shared: 0,
      errors: 0,
    };
  }

  const summary = context.crudReport.byEntity[operation.entityType];

  if (!operation.success) {
    summary.errors++;
    context.crudReport.totals.failedOperations++;
  } else {
    context.crudReport.totals.successfulOperations++;

    switch (operation.operation) {
      case 'CREATE':
        if (operation.resourceCategory === 'kept') {
          summary.created.kept++;
          context.crudReport.totals.resourcesKept++;
        } else {
          summary.created.deleted++;
        }
        context.crudReport.totals.resourcesCreated++;
        break;
      case 'READ':
        summary.read++;
        break;
      case 'UPDATE':
        summary.updated++;
        break;
      case 'DELETE':
        summary.deleted++;
        context.crudReport.totals.resourcesDeleted++;
        break;
      case 'ANONYMIZE':
        summary.anonymized++;
        break;
      case 'SHARE':
        summary.shared++;
        break;
    }
  }

  context.crudReport.totals.totalOperations++;
}

// ============================================================================
// CONSTANTS FROM TEMPLATE-REFERENCE.md
// ============================================================================

// Template Suite
export const TEMPLATE_SUITE_ID = 64004;

// Object: Testing Object
export const TESTING_OBJECT_ID = 935;

// Object Property SystemNames
export const OBJECT_PROPERTY_SYSTEM_NAMES = {
  name: 'a6c58533-e21f-48b2-8389-d0ae954d28e2',
  date: 'fffd692c-87a9-41bf-9bc1-0e9868d9a1ab',
  address: 'bfb218ce-59d7-46eb-b775-04f87bfd84a2',
  numerical: '8b0de562-386c-4004-abb8-0acb0d553380',
  financialValue: '3f2ebeea-d87c-45ad-a59e-d681dd8d3903',
  user: '01f1b2ef-e8bf-47a0-acb3-6c1629a9545f',
};

// Element UUIDs for Document 1
export const ELEMENT_UUIDS = {
  docName: '682b388c-d37d-4b20-8a5f-8ea90f598428',
  name: 'c596812a-bf43-4381-9a24-888247665824',
  date: '6302bd16-ec5e-461d-8e8b-17b7186510d6',
  switcher: '7c734db3-7a43-4750-8eae-52d49eaec9be',
  option: 'e65f0c64-a6f9-41a5-be5f-c508ed7029fc',
  multiOption: 'eaa0016e-4b8c-4735-9ff4-dbb464458dbd',
  singleChoice: 'c7ce9cfd-54d5-4351-8d18-d9a65e4ecff1',
  multiChoice: '9c39e564-af7a-4f27-8a2e-43e3c1709dea',
  testingObjectName: 'f16b51cf-d3ac-4e7c-b349-c7390ec31841',
  value: 'ecc4575b-dbb1-4081-9aee-bf92b725107d',
};

// Option/Select Values (UUIDs)
export const OPTION_VALUES = {
  // option (Question single): B
  optionB: '6df8e483-31a9-4f66-a96a-3ca10ffa56a7',
  // multi-option (Question multi): B, D
  multiOptionB: '2261e6fe-f68a-44c1-aec2-73e4156f582c',
  multiOptionD: 'fcee8ee4-636e-4ed6-9576-7389691ace4f',
  // single-choice (Select single): 2
  singleChoice2: '3a8bc084-0316-421a-b202-90622f89670b',
  // multi-choice (Select multi): 3, 4
  multiChoice3: '48d93b60-a8be-40c6-b00d-5a9f5904148a',
  multiChoice4: '202f5757-934a-4729-92e1-413a9e552cb1',
};

// User ID for object records
export const USER_ID = 44641;

// Currency IDs: CZK=1, GBP=2, USD=3, EUR=4
export const CURRENCY_CZK = 1;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Get current date formatted
export function getCurrentDateFormatted(): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  return `${day}-${month}-${year}`;
}

// Get current date ISO format
export function getCurrentDateISO(): string {
  const now = new Date();
  return now.toISOString().split('T')[0] + 'T00:00:00+01:00';
}

// Build Document 1 element data
// NOTE: testing-object-name expects Object Record ID (integer), not systemName!
// Clauses (a, b, c, d, e) are turned on by setting visible: true
export function buildDocument1ElementData(objectRecordId: number | null): Array<{ name: string; value?: unknown; visible?: boolean }> {
  const currentDate = getCurrentDateFormatted();
  const currentDateISO = getCurrentDateISO();

  const elements: Array<{ name: string; value?: unknown; visible?: boolean }> = [
    // Document fields
    { name: 'doc-name', value: `My Test Document ${currentDate}` },
    { name: 'name', value: 'John Doe' },
    { name: 'date', value: { date: currentDateISO.split('T')[0], monthByWord: true } },
    { name: 'switcher', value: true },
    { name: 'option', value: OPTION_VALUES.optionB },
    { name: 'multi-option', value: [OPTION_VALUES.multiOptionB, OPTION_VALUES.multiOptionD] },
    { name: 'single-choice', value: OPTION_VALUES.singleChoice2 },
    { name: 'multi-choice', value: [OPTION_VALUES.multiChoice3, OPTION_VALUES.multiChoice4] },
    { name: 'value', value: { number: '12345', currency: CURRENCY_CZK } },
    // Clauses - turn them all on (visible)
    { name: 'a', visible: true },
    { name: 'b', visible: true },
    { name: 'c', visible: true },
    { name: 'd', visible: true },
    { name: 'e', visible: true },
  ];

  // Only include testing-object-name if we have a valid object record ID
  if (objectRecordId !== null && objectRecordId > 0) {
    elements.push({ name: 'testing-object-name', value: objectRecordId });
  }

  return elements;
}

// Build Object Record properties
export function buildObjectRecordProperties(name: string, address: string, numerical: number, financialValue: number): Array<{ systemName: string; value: unknown }> {
  return [
    { systemName: OBJECT_PROPERTY_SYSTEM_NAMES.name, value: name },
    { systemName: OBJECT_PROPERTY_SYSTEM_NAMES.date, value: getCurrentDateISO() },
    { systemName: OBJECT_PROPERTY_SYSTEM_NAMES.address, value: address },
    { systemName: OBJECT_PROPERTY_SYSTEM_NAMES.numerical, value: numerical },
    { systemName: OBJECT_PROPERTY_SYSTEM_NAMES.financialValue, value: { value: financialValue, currencyId: CURRENCY_CZK } },
    { systemName: OBJECT_PROPERTY_SYSTEM_NAMES.user, value: USER_ID },
  ];
}

// ============================================================================
// COMPREHENSIVE LEGITO API TESTS - ALL CRUD OPERATIONS
// ============================================================================

export const LEGITO_TESTS: LegitoTest[] = [
  // ==================== PHASE 1: OBJECT RECORDS (RUN FIRST) ====================

  // 1.1 Create Object Record #1 (KEPT - will be used in document)
  {
    id: 'object-record-create-kept',
    name: 'POST /object-record/{objectId} (Record 1 - KEPT)',
    description: 'Creates Object Record #1 - kept for document template reference',
    category: 'Object Records',
    endpoint: '/object-record/{objectId}',
    method: 'POST',
    dynamicEndpoint: (ctx) => `/object-record/${ctx.objectId || TESTING_OBJECT_ID}`,
    dynamicBody: () => ({
      properties: buildObjectRecordProperties(
        `API-Test-Record-KEPT-${Date.now()}`,
        'Test City, Kept Street 1',
        1001,
        50000
      ),
    }),
    setsContext: 'objectRecordKept',
    expectedStatus: [200, 201],
    assertions: [
      { name: 'Returns success', type: 'status' },
      { name: 'Has systemName', type: 'hasField', field: 'systemName' },
    ],
    crudOperation: 'CREATE',
    resourceCategory: 'kept',
    entityType: 'ObjectRecord',
  },

  // 1.2 Create Object Record #2 (TO DELETE)
  {
    id: 'object-record-create-delete',
    name: 'POST /object-record/{objectId} (Record 2 - for DELETE)',
    description: 'Creates Object Record #2 - will be updated then deleted',
    category: 'Object Records',
    endpoint: '/object-record/{objectId}',
    method: 'POST',
    dynamicEndpoint: (ctx) => `/object-record/${ctx.objectId || TESTING_OBJECT_ID}`,
    dynamicBody: () => ({
      properties: buildObjectRecordProperties(
        `API-Test-Record-DELETE-${Date.now()}`,
        'Delete City, Temporary Ave 99',
        9999,
        1
      ),
    }),
    setsContext: 'objectRecordToDelete',
    expectedStatus: [200, 201],
    assertions: [
      { name: 'Returns success', type: 'status' },
      { name: 'Has systemName', type: 'hasField', field: 'systemName' },
    ],
    crudOperation: 'CREATE',
    resourceCategory: 'to-delete',
    entityType: 'ObjectRecord',
  },

  // 1.3 Update Object Record #2
  {
    id: 'object-record-update',
    name: 'PUT /object-record/{systemName} (Update Record 2)',
    description: 'Updates Object Record #2 before deletion',
    category: 'Object Records',
    usesContext: ['objectRecordToDelete'],
    dynamicEndpoint: (ctx) => {
      const rec = ctx.objectRecordToDelete as ObjectRecordData | undefined;
      return `/object-record/${rec?.systemName || 'unknown'}`;
    },
    endpoint: '/object-record/{systemName}',
    method: 'PUT',
    dynamicBody: () => ({
      properties: [
        { systemName: OBJECT_PROPERTY_SYSTEM_NAMES.name, value: `API-Test-Record-UPDATED-${Date.now()}` },
        { systemName: OBJECT_PROPERTY_SYSTEM_NAMES.address, value: 'Updated Address - About to be deleted' },
      ],
    }),
    expectedStatus: [200, 204],
    assertions: [
      { name: 'Returns success', type: 'status' },
    ],
    crudOperation: 'UPDATE',
    resourceCategory: 'to-delete',
    entityType: 'ObjectRecord',
  },

  // 1.4 Delete Object Record #2
  {
    id: 'object-record-delete',
    name: 'DELETE /object-record/{systemName} (Delete Record 2)',
    description: 'Deletes Object Record #2',
    category: 'Object Records',
    usesContext: ['objectRecordToDelete'],
    dynamicEndpoint: (ctx) => {
      const rec = ctx.objectRecordToDelete as ObjectRecordData | undefined;
      return `/object-record/${rec?.systemName || 'unknown'}`;
    },
    endpoint: '/object-record/{systemName}',
    method: 'DELETE',
    expectedStatus: [200, 204],
    assertions: [
      { name: 'Returns success', type: 'status' },
    ],
    crudOperation: 'DELETE',
    resourceCategory: 'to-delete',
    entityType: 'ObjectRecord',
  },

  // ==================== PHASE 2: USERS ====================

  // 2.1 Get user list first
  {
    id: 'user-list',
    name: 'GET /user',
    description: 'Returns user list for reference',
    category: 'Users',
    endpoint: '/user',
    method: 'GET',
    expectedStatus: 200,
    setsContext: 'users',
    assertions: [
      { name: 'Returns 200 OK', type: 'status' },
      { name: 'Returns array', type: 'isArray' },
    ],
    crudOperation: 'READ',
    resourceCategory: 'n/a',
    entityType: 'User',
  },

  // 2.2 Create User #1 (KEPT)
  // NOTE: POST /user expects an ARRAY of users and returns ARRAY of created users
  {
    id: 'user-create-kept',
    name: 'POST /user (User 1 - KEPT)',
    description: 'Creates User #1 - kept for document sharing',
    category: 'Users',
    endpoint: '/user',
    method: 'POST',
    dynamicBody: () => ([{
      email: `api-test-user-kept-${Date.now()}@test.legito.com`,
      name: 'API Test User KEPT',
      caption: 'API Tester (Kept)',
      timezone: 'Europe/Prague',
    }]),
    setsContext: 'userKept',
    expectedStatus: [200, 201],
    assertions: [
      { name: 'Returns success', type: 'status' },
      { name: 'Has user ID', type: 'hasField', field: 'id' },
    ],
    crudOperation: 'CREATE',
    resourceCategory: 'kept',
    entityType: 'User',
  },

  // 2.3 Create User #2 (TO DELETE)
  // NOTE: POST /user expects an ARRAY of users and returns ARRAY of created users
  {
    id: 'user-create-delete',
    name: 'POST /user (User 2 - for DELETE)',
    description: 'Creates User #2 - will be updated then deleted',
    category: 'Users',
    endpoint: '/user',
    method: 'POST',
    dynamicBody: () => ([{
      email: `api-test-user-delete-${Date.now()}@test.legito.com`,
      name: 'API Test User DELETE',
      caption: 'API Tester (To Delete)',
      timezone: 'Europe/Prague',
    }]),
    setsContext: 'userToDelete',
    expectedStatus: [200, 201],
    assertions: [
      { name: 'Returns success', type: 'status' },
      { name: 'Has user ID', type: 'hasField', field: 'id' },
    ],
    crudOperation: 'CREATE',
    resourceCategory: 'to-delete',
    entityType: 'User',
  },

  // 2.4 Update User #2
  {
    id: 'user-update',
    name: 'PUT /user/{id} (Update User 2)',
    description: 'Updates User #2 before deletion',
    category: 'Users',
    usesContext: ['userToDelete'],
    skipIf: (ctx) => {
      // Skip if user wasn't created successfully (no valid ID)
      const user = ctx.userToDelete as UserData | undefined;
      return !user?.id;
    },
    dynamicEndpoint: (ctx) => {
      const user = ctx.userToDelete as UserData | undefined;
      return `/user/${user?.id}`;
    },
    endpoint: '/user/{id}',
    method: 'PUT',
    dynamicBody: () => ({
      name: `API-Test-User-UPDATED-${Date.now()}`,
      position: 'Updated Position (About to delete)',
    }),
    expectedStatus: [200, 204],
    assertions: [
      { name: 'Returns success', type: 'status' },
    ],
    crudOperation: 'UPDATE',
    resourceCategory: 'to-delete',
    entityType: 'User',
  },

  // 2.5 Delete User #2
  {
    id: 'user-delete',
    name: 'DELETE /user/{id} (Delete User 2)',
    description: 'Deletes User #2',
    category: 'Users',
    usesContext: ['userToDelete'],
    skipIf: (ctx) => {
      // Skip if user wasn't created successfully (no valid ID)
      const user = ctx.userToDelete as UserData | undefined;
      return !user?.id;
    },
    dynamicEndpoint: (ctx) => {
      const user = ctx.userToDelete as UserData | undefined;
      return `/user/${user?.id}`;
    },
    endpoint: '/user/{id}',
    method: 'DELETE',
    expectedStatus: [200, 204],
    assertions: [
      { name: 'Returns success', type: 'status' },
    ],
    crudOperation: 'DELETE',
    resourceCategory: 'to-delete',
    entityType: 'User',
  },

  // ==================== PHASE 3: USER GROUPS ====================

  // 3.1 Get user group list
  {
    id: 'user-group-list',
    name: 'GET /user-group',
    description: 'Returns user group list for reference',
    category: 'User Groups',
    endpoint: '/user-group',
    method: 'GET',
    expectedStatus: 200,
    setsContext: 'userGroups',
    assertions: [
      { name: 'Returns 200 OK', type: 'status' },
      { name: 'Returns array', type: 'isArray' },
    ],
    crudOperation: 'READ',
    resourceCategory: 'n/a',
    entityType: 'UserGroup',
  },

  // 3.2 Create User Group #1 (KEPT)
  {
    id: 'user-group-create-kept',
    name: 'POST /user-group (Group 1 - KEPT)',
    description: 'Creates User Group #1 - kept for document sharing',
    category: 'User Groups',
    endpoint: '/user-group',
    method: 'POST',
    dynamicBody: () => ({
      name: `API-Test-Group-KEPT-${Date.now()}`,
    }),
    setsContext: 'userGroupKept',
    expectedStatus: [200, 201],
    assertions: [
      { name: 'Returns success', type: 'status' },
      { name: 'Has group ID', type: 'hasField', field: 'id' },
    ],
    crudOperation: 'CREATE',
    resourceCategory: 'kept',
    entityType: 'UserGroup',
  },

  // 3.3 Create User Group #2 (TO DELETE)
  {
    id: 'user-group-create-delete',
    name: 'POST /user-group (Group 2 - for DELETE)',
    description: 'Creates User Group #2 - will be updated then deleted',
    category: 'User Groups',
    endpoint: '/user-group',
    method: 'POST',
    dynamicBody: () => ({
      name: `API-Test-Group-DELETE-${Date.now()}`,
    }),
    setsContext: 'userGroupToDelete',
    expectedStatus: [200, 201],
    assertions: [
      { name: 'Returns success', type: 'status' },
      { name: 'Has group ID', type: 'hasField', field: 'id' },
    ],
    crudOperation: 'CREATE',
    resourceCategory: 'to-delete',
    entityType: 'UserGroup',
  },

  // 3.4 Update User Group #2
  {
    id: 'user-group-update',
    name: 'PUT /user-group/{id} (Update Group 2)',
    description: 'Updates User Group #2 before deletion',
    category: 'User Groups',
    usesContext: ['userGroupToDelete'],
    skipIf: (ctx) => {
      const group = ctx.userGroupToDelete as UserGroupData | undefined;
      return !group?.id;
    },
    dynamicEndpoint: (ctx) => {
      const group = ctx.userGroupToDelete as UserGroupData | undefined;
      return `/user-group/${group?.id}`;
    },
    endpoint: '/user-group/{id}',
    method: 'PUT',
    dynamicBody: () => ({
      name: `API-Test-Group-UPDATED-${Date.now()}`,
    }),
    expectedStatus: [200, 204],
    assertions: [
      { name: 'Returns success', type: 'status' },
    ],
    crudOperation: 'UPDATE',
    resourceCategory: 'to-delete',
    entityType: 'UserGroup',
  },

  // 3.5 Delete User Group #2
  {
    id: 'user-group-delete',
    name: 'DELETE /user-group/{id} (Delete Group 2)',
    description: 'Deletes User Group #2',
    category: 'User Groups',
    usesContext: ['userGroupToDelete'],
    skipIf: (ctx) => {
      const group = ctx.userGroupToDelete as UserGroupData | undefined;
      return !group?.id;
    },
    dynamicEndpoint: (ctx) => {
      const group = ctx.userGroupToDelete as UserGroupData | undefined;
      return `/user-group/${group?.id}`;
    },
    endpoint: '/user-group/{id}',
    method: 'DELETE',
    expectedStatus: [200, 204],
    assertions: [
      { name: 'Returns success', type: 'status' },
    ],
    crudOperation: 'DELETE',
    resourceCategory: 'to-delete',
    entityType: 'UserGroup',
  },

  // ==================== PHASE 4: DOCUMENTS ====================

  // 4.1 Create Document #1 (KEPT) with all element values
  {
    id: 'document-create-kept',
    name: 'POST /document-version/data/{templateSuiteId} (Document 1 - KEPT)',
    description: 'Creates Document #1 with ALL element values filled - kept for sharing and testing',
    category: 'Documents',
    endpoint: '/document-version/data/{templateSuiteId}',
    method: 'POST',
    usesContext: ['objectRecordKept'],
    dynamicEndpoint: (ctx) => `/document-version/data/${ctx.templateSuiteId || TEMPLATE_SUITE_ID}`,
    dynamicBody: (ctx) => {
      const objRec = ctx.objectRecordKept as ObjectRecordData | undefined;
      // Use object record ID (integer), not systemName!
      const objectRecordId = objRec?.id ?? null;
      return buildDocument1ElementData(objectRecordId);
    },
    setsContext: 'documentKept',
    expectedStatus: [200, 201],
    assertions: [
      { name: 'Returns success', type: 'status' },
      { name: 'Has document code', type: 'hasField', field: 'code' },
      { name: 'Has document record code', type: 'hasField', field: 'documentRecordCode' },
    ],
    crudOperation: 'CREATE',
    resourceCategory: 'kept',
    entityType: 'Document',
  },

  // 4.2 Create Document #2 "Document for delete"
  {
    id: 'document-create-delete',
    name: 'POST /document-version/data/{templateSuiteId} (Document 2 - for DELETE)',
    description: 'Creates Document #2 "Document for delete" - will be updated, deleted, anonymized',
    category: 'Documents',
    endpoint: '/document-version/data/{templateSuiteId}',
    method: 'POST',
    dynamicEndpoint: (ctx) => `/document-version/data/${ctx.templateSuiteId || TEMPLATE_SUITE_ID}`,
    body: [
      { name: 'doc-name', value: 'Document for delete' },
      { name: 'name', value: 'Delete Test User' },
    ],
    setsContext: 'documentToDelete',
    expectedStatus: [200, 201],
    assertions: [
      { name: 'Returns success', type: 'status' },
      { name: 'Has document code', type: 'hasField', field: 'code' },
    ],
    crudOperation: 'CREATE',
    resourceCategory: 'to-delete',
    entityType: 'Document',
  },

  // 4.3 Update Document #2
  {
    id: 'document-update',
    name: 'PUT /document-version/data/{documentRecordCode} (Update Document 2)',
    description: 'Updates Document #2 before deletion',
    category: 'Documents',
    usesContext: ['documentToDelete'],
    dynamicEndpoint: (ctx) => {
      const doc = ctx.documentToDelete as DocumentData | undefined;
      return `/document-version/data/${doc?.documentRecordCode || 'unknown'}`;
    },
    endpoint: '/document-version/data/{documentRecordCode}',
    method: 'PUT',
    body: [
      { name: 'doc-name', value: 'Document for delete - UPDATED' },
      { name: 'name', value: 'Updated Name Before Delete' },
    ],
    expectedStatus: [200, 201, 400, 404, 422],
    assertions: [
      { name: 'Returns response', type: 'status' },
    ],
    crudOperation: 'UPDATE',
    resourceCategory: 'to-delete',
    entityType: 'Document',
  },

  // 4.4 Delete Document #2
  {
    id: 'document-delete',
    name: 'DELETE /document-record/{code} (Delete Document 2)',
    description: 'Deletes Document Record #2',
    category: 'Documents',
    usesContext: ['documentToDelete'],
    dynamicEndpoint: (ctx) => {
      const doc = ctx.documentToDelete as DocumentData | undefined;
      return `/document-record/${doc?.documentRecordCode || 'unknown'}`;
    },
    endpoint: '/document-record/{code}',
    method: 'DELETE',
    expectedStatus: [200, 204, 404],
    assertions: [
      { name: 'Returns response', type: 'status' },
    ],
    crudOperation: 'DELETE',
    resourceCategory: 'to-delete',
    entityType: 'Document',
  },

  // 4.5 Anonymize Document #2
  {
    id: 'document-anonymize',
    name: 'GET /document-record/anonymize/{code} (Anonymize Document 2)',
    description: 'Anonymizes Document Record #2 after deletion',
    category: 'Documents',
    usesContext: ['documentToDelete'],
    dynamicEndpoint: (ctx) => {
      const doc = ctx.documentToDelete as DocumentData | undefined;
      return `/document-record/anonymize/${doc?.documentRecordCode || 'unknown'}`;
    },
    endpoint: '/document-record/anonymize/{code}',
    method: 'GET',
    expectedStatus: [200, 404, 400],
    assertions: [
      { name: 'Returns response', type: 'status' },
    ],
    crudOperation: 'ANONYMIZE',
    resourceCategory: 'to-delete',
    entityType: 'Document',
  },

  // ==================== PHASE 5: EXTERNAL SHARING LINKS ====================

  // 5.1 Create External Link #1 (KEPT) - URL MUST BE RETURNED
  // API expects array format: [{ active, type, permission, useMax }]
  {
    id: 'external-link-create-kept',
    name: 'POST /share/external-link/{code} (Link 1 - KEPT)',
    description: 'Creates External Link #1 - KEPT, URL will be returned in results!',
    category: 'External Links',
    usesContext: ['documentKept'],
    skipIf: (ctx) => {
      const doc = ctx.documentKept as DocumentData | undefined;
      return !doc?.documentRecordCode;
    },
    dynamicEndpoint: (ctx) => {
      const doc = ctx.documentKept as DocumentData | undefined;
      return `/share/external-link/${doc?.documentRecordCode || 'unknown'}`;
    },
    endpoint: '/share/external-link/{code}',
    method: 'POST',
    body: [
      {
        active: true,
        type: 'document',
        permission: 'EDIT',
        useMax: 0,
      },
    ],
    setsContext: 'externalLinkKept',
    expectedStatus: [200, 201],
    assertions: [
      { name: 'Returns success', type: 'status' },
      { name: 'Returns array', type: 'isArray' },
    ],
    crudOperation: 'CREATE',
    resourceCategory: 'kept',
    entityType: 'ExternalLink',
  },

  // 5.2 Create External Link #2 (TO DELETE)
  {
    id: 'external-link-create-delete',
    name: 'POST /share/external-link/{code} (Link 2 - for DELETE)',
    description: 'Creates External Link #2 - will be deleted',
    category: 'External Links',
    usesContext: ['documentKept'],
    skipIf: (ctx) => {
      const doc = ctx.documentKept as DocumentData | undefined;
      return !doc?.documentRecordCode;
    },
    dynamicEndpoint: (ctx) => {
      const doc = ctx.documentKept as DocumentData | undefined;
      return `/share/external-link/${doc?.documentRecordCode || 'unknown'}`;
    },
    endpoint: '/share/external-link/{code}',
    method: 'POST',
    body: [
      {
        active: true,
        type: 'document',
        permission: 'READ',
        useMax: 1,
      },
    ],
    setsContext: 'externalLinkToDelete',
    expectedStatus: [200, 201],
    assertions: [
      { name: 'Returns success', type: 'status' },
    ],
    crudOperation: 'CREATE',
    resourceCategory: 'to-delete',
    entityType: 'ExternalLink',
  },

  // 5.3 Delete External Link #2
  {
    id: 'external-link-delete',
    name: 'DELETE /share/external-link/{id} (Delete Link 2)',
    description: 'Deletes External Link #2',
    category: 'External Links',
    usesContext: ['externalLinkToDelete'],
    skipIf: (ctx) => {
      const links = ctx.externalLinkToDelete as ExternalLinkData[] | ExternalLinkData | undefined;
      const link = Array.isArray(links) ? links[0] : links;
      return !link?.id;
    },
    dynamicEndpoint: (ctx) => {
      const links = ctx.externalLinkToDelete as ExternalLinkData[] | ExternalLinkData | undefined;
      const link = Array.isArray(links) ? links[0] : links;
      return `/share/external-link/${link?.id || '1'}`;
    },
    endpoint: '/share/external-link/{id}',
    method: 'DELETE',
    expectedStatus: [200, 204],
    assertions: [
      { name: 'Returns success', type: 'status' },
    ],
    crudOperation: 'DELETE',
    resourceCategory: 'to-delete',
    entityType: 'ExternalLink',
  },

  // ==================== PHASE 6: DOCUMENT SHARING ====================

  // 6.1 Share Document #1 to User #1 (KEPT)
  {
    id: 'share-user',
    name: 'POST /share/user/{code} (Share to User 1)',
    description: 'Shares Document #1 to User #1 (both kept)',
    category: 'Document Sharing',
    usesContext: ['documentKept', 'userKept'],
    skipIf: (ctx) => {
      const doc = ctx.documentKept as DocumentData | undefined;
      const user = ctx.userKept as UserData | undefined;
      return !doc?.documentRecordCode || !user?.id;
    },
    dynamicEndpoint: (ctx) => {
      const doc = ctx.documentKept as DocumentData | undefined;
      return `/share/user/${doc?.documentRecordCode || 'unknown'}`;
    },
    endpoint: '/share/user/{code}',
    method: 'POST',
    dynamicBody: (ctx) => {
      const user = ctx.userKept as UserData | undefined;
      return [
        {
          id: user?.id,
          permission: 'EDIT',
        },
      ];
    },
    setsContext: 'userShare',
    expectedStatus: [200, 201],
    assertions: [
      { name: 'Returns success', type: 'status' },
    ],
    crudOperation: 'SHARE',
    resourceCategory: 'kept',
    entityType: 'DocumentShare',
  },

  // 6.2 Share Document #1 to User Group #1 (KEPT)
  {
    id: 'share-user-group',
    name: 'POST /share/user-group/{code} (Share to Group 1)',
    description: 'Shares Document #1 to User Group #1 (both kept)',
    category: 'Document Sharing',
    usesContext: ['documentKept', 'userGroupKept'],
    skipIf: (ctx) => {
      const doc = ctx.documentKept as DocumentData | undefined;
      const group = ctx.userGroupKept as UserGroupData | undefined;
      return !doc?.documentRecordCode || !group?.id;
    },
    dynamicEndpoint: (ctx) => {
      const doc = ctx.documentKept as DocumentData | undefined;
      return `/share/user-group/${doc?.documentRecordCode || 'unknown'}`;
    },
    endpoint: '/share/user-group/{code}',
    method: 'POST',
    dynamicBody: (ctx) => {
      const group = ctx.userGroupKept as UserGroupData | undefined;
      return [
        {
          id: group?.id,
        },
      ];
    },
    setsContext: 'userGroupShare',
    expectedStatus: [200, 201],
    assertions: [
      { name: 'Returns success', type: 'status' },
    ],
    crudOperation: 'SHARE',
    resourceCategory: 'kept',
    entityType: 'DocumentShare',
  },

  // ==================== REFERENCE DATA TESTS ====================

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
    ],
  },

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
      // Handle array responses - check first element if array
      let dataToCheck = response.data;
      if (Array.isArray(response.data) && response.data.length > 0) {
        dataToCheck = response.data[0];
      }
      const hasField =
        dataToCheck !== null &&
        typeof dataToCheck === 'object' &&
        assertion.field !== undefined &&
        assertion.field in (dataToCheck as Record<string, unknown>);
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

// Generate CRUD Report as formatted text
export function generateCrudReport(context: TestContext): string {
  const { crudReport } = context;

  let report = `
================================================================================
                     LEGITO API CRUD TEST REPORT
================================================================================
Generated: ${new Date().toISOString()}

================================================================================
                           SUMMARY
================================================================================
Total Operations:    ${crudReport.totals.totalOperations}
Successful:          ${crudReport.totals.successfulOperations}
Failed:              ${crudReport.totals.failedOperations}
Resources Created:   ${crudReport.totals.resourcesCreated}
Resources Kept:      ${crudReport.totals.resourcesKept}
Resources Deleted:   ${crudReport.totals.resourcesDeleted}
`;

  // IMPORTANT: External Link URL
  if (crudReport.externalLinkUrl) {
    report += `
================================================================================
             *** EXTERNAL SHARING LINK (for testing) ***
================================================================================
URL: ${crudReport.externalLinkUrl}
================================================================================
`;
  }

  report += `
================================================================================
                      BY ENTITY TYPE
================================================================================
`;

  for (const [entityType, summary] of Object.entries(crudReport.byEntity)) {
    report += `
${entityType}:
  - Created (Kept):    ${summary.created.kept}
  - Created (Deleted): ${summary.created.deleted}
  - Read:              ${summary.read}
  - Updated:           ${summary.updated}
  - Deleted:           ${summary.deleted}
  - Anonymized:        ${summary.anonymized}
  - Shared:            ${summary.shared}
  - Errors:            ${summary.errors}
`;
  }

  report += `
================================================================================
                      OPERATION TIMELINE
================================================================================
`;

  for (const op of crudReport.operations) {
    const status = op.success ? 'OK' : `FAIL: ${op.error}`;
    const category = op.resourceCategory !== 'n/a' ? ` [${op.resourceCategory}]` : '';
    report += `[${op.timestamp}] ${op.entityType} | ${op.operation}${category} | ${op.resourceId || 'N/A'} | ${status} (${op.duration}ms)
`;
  }

  report += `
================================================================================
                          END OF REPORT
================================================================================
`;

  return report;
}

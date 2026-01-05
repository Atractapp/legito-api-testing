/**
 * Operation Catalog - Defines all available API operations for test configuration
 */

import type { ApiOperation, ConfiguredTest } from '@/types';
import type { LegitoTest, TestContext } from './legito-api';

// Test file for file upload operations (minimal valid PDF)
export const TEST_PDF_BASE64 = 'JVBERi0xLjQKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL1R5cGUgL1BhZ2VzCi9LaWRzIFszIDAgUl0KL0NvdW50IDEKL01lZGlhQm94IFswIDAgNjEyIDc5Ml0KPj4KZW5kb2JqCjMgMCBvYmoKPDwKL1R5cGUgL1BhZ2UKL1BhcmVudCAyIDAgUgovUmVzb3VyY2VzIDw8Pj4KL0NvbnRlbnRzIDQgMCBSCj4+CmVuZG9iago0IDAgb2JqCjw8Ci9MZW5ndGggNDQKPj4Kc3RyZWFtCkJUCi9GMSAxMiBUZgoxMDAgNzAwIFRkCihBUEkgVGVzdCBGaWxlKSBUagpFVAplbmRzdHJlYW0KZW5kb2JqCnhyZWYKMCA1CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAwOSAwMDAwMCBuIAowMDAwMDAwMDU4IDAwMDAwIG4gCjAwMDAwMDAxNDUgMDAwMDAgbiAKMDAwMDAwMDI0NCAwMDAwMCBuIAp0cmFpbGVyCjw8Ci9TaXplIDUKL1Jvb3QgMSAwIFIKPj4Kc3RhcnR4cmVmCjMzNwolJUVPRgo=';
export const TEST_PDF_FILENAME = 'api-test-file.pdf';
export const TEST_PDF_MIMETYPE = 'application/pdf';

export type OperationCategory = 'Documents' | 'Objects' | 'Users' | 'User Groups' | 'Sharing' | 'Files' | 'Tags' | 'Push Connections' | 'Workflows' | 'Other';

export interface OperationDefinition {
  id: ApiOperation;
  name: string;
  description: string;
  category: OperationCategory;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  endpoint: string;
  requiresConfig: {
    templateSuiteId?: boolean;
    objectId?: boolean;
    userId?: boolean;
    userGroupId?: boolean;
    elementValues?: boolean;
    propertyValues?: boolean;
    useResultFrom?: boolean;
    sharePermission?: boolean;
    returnExternalLink?: 'optional';
    // File operations
    fileUpload?: boolean;
    downloadFormat?: 'optional';
    returnFileContent?: 'optional';
    // Tag operations
    tagName?: boolean;
    tagColor?: 'optional';
    tagId?: boolean;
    // Push connection operations
    eventTypes?: 'optional';
    verifyWebhook?: 'optional';
  };
  // For operations that depend on previous test results
  needsResultFrom?: ApiOperation[];
}

/**
 * All available API operations organized by category
 */
export const OPERATION_CATALOG: OperationDefinition[] = [
  // ============ Documents ============
  {
    id: 'GET_TEMPLATE_SUITES',
    name: 'Get Template Suites List',
    description: 'Retrieve list of all template suites',
    category: 'Documents',
    method: 'GET',
    endpoint: '/template-suite',
    requiresConfig: {},
  },
  {
    id: 'GET_TEMPLATE_SUITE',
    name: 'Get Template Suite Details',
    description: 'Retrieve details of a specific template suite',
    category: 'Documents',
    method: 'GET',
    endpoint: '/template-suite/{templateSuiteId}',
    requiresConfig: { templateSuiteId: true },
  },
  {
    id: 'CREATE_DOCUMENT',
    name: 'Create Document',
    description: 'Create a new document from a template with element values',
    category: 'Documents',
    method: 'POST',
    endpoint: '/document-version/data/{templateSuiteId}',
    requiresConfig: { templateSuiteId: true, elementValues: true },
  },
  {
    id: 'READ_DOCUMENT',
    name: 'Read Document',
    description: 'Read document data by document record code',
    category: 'Documents',
    method: 'GET',
    endpoint: '/document-version/data/{documentRecordCode}',
    requiresConfig: { useResultFrom: true },
    needsResultFrom: ['CREATE_DOCUMENT'],
  },
  {
    id: 'UPDATE_DOCUMENT',
    name: 'Update Document',
    description: 'Update document element values',
    category: 'Documents',
    method: 'PUT',
    endpoint: '/document-version/data/{documentRecordCode}',
    requiresConfig: { useResultFrom: true, elementValues: true },
    needsResultFrom: ['CREATE_DOCUMENT'],
  },
  {
    id: 'DELETE_DOCUMENT',
    name: 'Delete Document',
    description: 'Delete a document record',
    category: 'Documents',
    method: 'DELETE',
    endpoint: '/document-record/{documentRecordCode}',
    requiresConfig: { useResultFrom: true },
    needsResultFrom: ['CREATE_DOCUMENT'],
  },
  {
    id: 'ANONYMIZE_DOCUMENT',
    name: 'Anonymize Document',
    description: 'Anonymize document data (GDPR compliance)',
    category: 'Documents',
    method: 'PUT',
    endpoint: '/document-record/anonymize/{documentRecordCode}',
    requiresConfig: { useResultFrom: true },
    needsResultFrom: ['CREATE_DOCUMENT'],
  },
  {
    id: 'GET_DOCUMENT_RECORDS',
    name: 'Get Document Records',
    description: 'List document records with optional filters',
    category: 'Documents',
    method: 'GET',
    endpoint: '/document-record',
    requiresConfig: {},
  },

  // ============ Objects ============
  {
    id: 'GET_OBJECTS',
    name: 'Get Objects List',
    description: 'Retrieve list of all object definitions',
    category: 'Objects',
    method: 'GET',
    endpoint: '/object',
    requiresConfig: {},
  },
  {
    id: 'GET_OBJECT',
    name: 'Get Object Details',
    description: 'Retrieve details of a specific object definition',
    category: 'Objects',
    method: 'GET',
    endpoint: '/object/{objectId}',
    requiresConfig: { objectId: true },
  },
  {
    id: 'CREATE_OBJECT_RECORD',
    name: 'Create Object Record',
    description: 'Create a new object record with property values',
    category: 'Objects',
    method: 'POST',
    endpoint: '/object-record',
    requiresConfig: { objectId: true, propertyValues: true },
  },
  {
    id: 'READ_OBJECT_RECORD',
    name: 'Read Object Record',
    description: 'Read object record by system name',
    category: 'Objects',
    method: 'GET',
    endpoint: '/object-record/{systemName}',
    requiresConfig: { useResultFrom: true },
    needsResultFrom: ['CREATE_OBJECT_RECORD'],
  },
  {
    id: 'UPDATE_OBJECT_RECORD',
    name: 'Update Object Record',
    description: 'Update object record property values',
    category: 'Objects',
    method: 'PUT',
    endpoint: '/object-record/{systemName}',
    requiresConfig: { useResultFrom: true, propertyValues: true },
    needsResultFrom: ['CREATE_OBJECT_RECORD'],
  },
  {
    id: 'DELETE_OBJECT_RECORD',
    name: 'Delete Object Record',
    description: 'Delete an object record',
    category: 'Objects',
    method: 'DELETE',
    endpoint: '/object-record/{systemName}',
    requiresConfig: { useResultFrom: true },
    needsResultFrom: ['CREATE_OBJECT_RECORD'],
  },

  // ============ Users ============
  {
    id: 'GET_USERS',
    name: 'Get Users List',
    description: 'Retrieve list of all users',
    category: 'Users',
    method: 'GET',
    endpoint: '/user',
    requiresConfig: {},
  },
  {
    id: 'CREATE_USER',
    name: 'Create User',
    description: 'Create a new user account',
    category: 'Users',
    method: 'POST',
    endpoint: '/user',
    requiresConfig: {},
  },
  {
    id: 'UPDATE_USER',
    name: 'Update User',
    description: 'Update user details',
    category: 'Users',
    method: 'PUT',
    endpoint: '/user/{userId}',
    requiresConfig: { useResultFrom: true },
    needsResultFrom: ['CREATE_USER'],
  },
  {
    id: 'DELETE_USER',
    name: 'Delete User',
    description: 'Delete a user account',
    category: 'Users',
    method: 'DELETE',
    endpoint: '/user/{userId}',
    requiresConfig: { useResultFrom: true },
    needsResultFrom: ['CREATE_USER'],
  },

  // ============ User Groups ============
  {
    id: 'GET_USER_GROUPS',
    name: 'Get User Groups List',
    description: 'Retrieve list of all user groups',
    category: 'User Groups',
    method: 'GET',
    endpoint: '/user-group',
    requiresConfig: {},
  },
  {
    id: 'CREATE_USER_GROUP',
    name: 'Create User Group',
    description: 'Create a new user group',
    category: 'User Groups',
    method: 'POST',
    endpoint: '/user-group',
    requiresConfig: {},
  },
  {
    id: 'UPDATE_USER_GROUP',
    name: 'Update User Group',
    description: 'Update user group details',
    category: 'User Groups',
    method: 'PUT',
    endpoint: '/user-group/{userGroupId}',
    requiresConfig: { useResultFrom: true },
    needsResultFrom: ['CREATE_USER_GROUP'],
  },
  {
    id: 'DELETE_USER_GROUP',
    name: 'Delete User Group',
    description: 'Delete a user group',
    category: 'User Groups',
    method: 'DELETE',
    endpoint: '/user-group/{userGroupId}',
    requiresConfig: { useResultFrom: true },
    needsResultFrom: ['CREATE_USER_GROUP'],
  },

  // ============ Sharing ============
  {
    id: 'CREATE_EXTERNAL_LINK',
    name: 'Create External Link',
    description: 'Create an external sharing link for a document',
    category: 'Sharing',
    method: 'POST',
    endpoint: '/share/external-link/{documentRecordCode}',
    requiresConfig: { useResultFrom: true, returnExternalLink: 'optional' },
    needsResultFrom: ['CREATE_DOCUMENT'],
  },
  {
    id: 'DELETE_EXTERNAL_LINK',
    name: 'Delete External Link',
    description: 'Delete an external sharing link',
    category: 'Sharing',
    method: 'DELETE',
    endpoint: '/share/external-link/{externalLinkId}',
    requiresConfig: { useResultFrom: true },
    needsResultFrom: ['CREATE_EXTERNAL_LINK'],
  },
  {
    id: 'SHARE_TO_USER',
    name: 'Share to User',
    description: 'Share a document with a specific user',
    category: 'Sharing',
    method: 'PUT',
    endpoint: '/share/user/{documentRecordCode}',
    requiresConfig: { useResultFrom: true, sharePermission: true },
    needsResultFrom: ['CREATE_DOCUMENT', 'CREATE_USER'],
  },
  {
    id: 'SHARE_TO_USER_GROUP',
    name: 'Share to User Group',
    description: 'Share a document with a user group',
    category: 'Sharing',
    method: 'PUT',
    endpoint: '/share/user-group/{documentRecordCode}',
    requiresConfig: { useResultFrom: true, sharePermission: true },
    needsResultFrom: ['CREATE_DOCUMENT', 'CREATE_USER_GROUP'],
  },

  // ============ Document Versions ============
  {
    id: 'GET_DOCUMENT_VERSION',
    name: 'Get Document Version',
    description: 'Get document version details',
    category: 'Documents',
    method: 'GET',
    endpoint: '/document-version/{documentRecordCode}',
    requiresConfig: { useResultFrom: true },
    needsResultFrom: ['CREATE_DOCUMENT'],
  },
  {
    id: 'DOWNLOAD_DOCUMENT',
    name: 'Download Document',
    description: 'Download document in specified format (PDF, DOCX, etc.)',
    category: 'Documents',
    method: 'GET',
    endpoint: '/document-version/download/{documentRecordCode}',
    requiresConfig: { useResultFrom: true, downloadFormat: 'optional', returnFileContent: 'optional' },
    needsResultFrom: ['CREATE_DOCUMENT'],
  },
  {
    id: 'CLONE_DOCUMENT',
    name: 'Clone Document',
    description: 'Create a copy of an existing document',
    category: 'Documents',
    method: 'POST',
    endpoint: '/document-version/clone/{documentRecordCode}',
    requiresConfig: { useResultFrom: true },
    needsResultFrom: ['CREATE_DOCUMENT'],
  },
  {
    id: 'COMPARE_DOCUMENTS',
    name: 'Compare Documents',
    description: 'Compare two document versions',
    category: 'Documents',
    method: 'POST',
    endpoint: '/document-version/compare',
    requiresConfig: { useResultFrom: true },
    needsResultFrom: ['CREATE_DOCUMENT'],
  },

  // ============ Files ============
  {
    id: 'LIST_FILES',
    name: 'List Files',
    description: 'List all uploaded files',
    category: 'Files',
    method: 'GET',
    endpoint: '/file',
    requiresConfig: {},
  },
  {
    id: 'UPLOAD_FILE',
    name: 'Upload File',
    description: 'Upload a file (base64 encoded)',
    category: 'Files',
    method: 'POST',
    endpoint: '/file',
    requiresConfig: { fileUpload: true },
  },
  {
    id: 'GET_FILE',
    name: 'Get File',
    description: 'Get file details by ID',
    category: 'Files',
    method: 'GET',
    endpoint: '/file/{fileId}',
    requiresConfig: { useResultFrom: true },
    needsResultFrom: ['UPLOAD_FILE'],
  },
  {
    id: 'DELETE_FILE',
    name: 'Delete File',
    description: 'Delete an uploaded file',
    category: 'Files',
    method: 'DELETE',
    endpoint: '/file/{fileId}',
    requiresConfig: { useResultFrom: true },
    needsResultFrom: ['UPLOAD_FILE'],
  },

  // ============ Tags ============
  {
    id: 'LIST_TAGS',
    name: 'List Tags',
    description: 'List all available tags',
    category: 'Tags',
    method: 'GET',
    endpoint: '/tag',
    requiresConfig: {},
  },
  {
    id: 'CREATE_TAG',
    name: 'Create Tag',
    description: 'Create a new tag with name and color',
    category: 'Tags',
    method: 'POST',
    endpoint: '/tag',
    requiresConfig: { tagName: true, tagColor: 'optional' },
  },
  {
    id: 'GET_TAG',
    name: 'Get Tag',
    description: 'Get tag details by ID',
    category: 'Tags',
    method: 'GET',
    endpoint: '/tag/{tagId}',
    requiresConfig: { useResultFrom: true },
    needsResultFrom: ['CREATE_TAG'],
  },
  {
    id: 'DELETE_TAG',
    name: 'Delete Tag',
    description: 'Delete a tag',
    category: 'Tags',
    method: 'DELETE',
    endpoint: '/tag/{tagId}',
    requiresConfig: { useResultFrom: true },
    needsResultFrom: ['CREATE_TAG'],
  },

  // ============ Push Connections ============
  {
    id: 'GET_PUSH_CONNECTIONS',
    name: 'List Push Connections',
    description: 'List all webhook/push connections',
    category: 'Push Connections',
    method: 'GET',
    endpoint: '/push-connection',
    requiresConfig: {},
  },
  {
    id: 'CREATE_PUSH_CONNECTION',
    name: 'Create Push Connection',
    description: 'Create a new webhook endpoint for event notifications',
    category: 'Push Connections',
    method: 'POST',
    endpoint: '/push-connection',
    requiresConfig: { eventTypes: 'optional' },
  },
  {
    id: 'TEST_PUSH_CONNECTION',
    name: 'Test Push Connection',
    description: 'Send a test event to verify webhook is working',
    category: 'Push Connections',
    method: 'POST',
    endpoint: '/push-connection/{pushConnectionId}/test',
    requiresConfig: { useResultFrom: true, verifyWebhook: 'optional' },
    needsResultFrom: ['CREATE_PUSH_CONNECTION'],
  },
  {
    id: 'DELETE_PUSH_CONNECTION',
    name: 'Delete Push Connection',
    description: 'Delete a push connection',
    category: 'Push Connections',
    method: 'DELETE',
    endpoint: '/push-connection/{pushConnectionId}',
    requiresConfig: { useResultFrom: true },
    needsResultFrom: ['CREATE_PUSH_CONNECTION'],
  },

  // ============ Sharing (extended) ============
  {
    id: 'LIST_EXTERNAL_LINKS',
    name: 'List External Links',
    description: 'List all external sharing links for a document',
    category: 'Sharing',
    method: 'GET',
    endpoint: '/share/external-link/{documentRecordCode}',
    requiresConfig: { useResultFrom: true },
    needsResultFrom: ['CREATE_DOCUMENT'],
  },
  {
    id: 'LIST_DOCUMENT_SHARES',
    name: 'List Document Shares',
    description: 'List all user shares for a document',
    category: 'Sharing',
    method: 'GET',
    endpoint: '/share/user/{documentRecordCode}',
    requiresConfig: { useResultFrom: true },
    needsResultFrom: ['CREATE_DOCUMENT'],
  },
  {
    id: 'REMOVE_USER_SHARE',
    name: 'Remove User Share',
    description: 'Remove a user share from a document',
    category: 'Sharing',
    method: 'DELETE',
    endpoint: '/share/user/{documentRecordCode}/{userId}',
    requiresConfig: { useResultFrom: true },
    needsResultFrom: ['SHARE_TO_USER'],
  },

  // ============ Workflows ============
  {
    id: 'GET_WORKFLOWS',
    name: 'List Workflows',
    description: 'Retrieve list of all workflows',
    category: 'Workflows',
    method: 'GET',
    endpoint: '/workflow',
    requiresConfig: {},
  },
  {
    id: 'GET_WORKFLOW',
    name: 'Get Workflow Details',
    description: 'Get details of a specific workflow',
    category: 'Workflows',
    method: 'GET',
    endpoint: '/workflow/{workflowId}',
    requiresConfig: { useResultFrom: true },
    needsResultFrom: ['GET_WORKFLOWS'],
  },
];

/**
 * Get operations grouped by category
 */
export function getOperationsByCategory(): Record<string, OperationDefinition[]> {
  const grouped: Record<string, OperationDefinition[]> = {};

  for (const op of OPERATION_CATALOG) {
    if (!grouped[op.category]) {
      grouped[op.category] = [];
    }
    grouped[op.category].push(op);
  }

  return grouped;
}

/**
 * Get operation definition by ID
 */
export function getOperationById(id: ApiOperation): OperationDefinition | undefined {
  return OPERATION_CATALOG.find(op => op.id === id);
}

/**
 * Convert a ConfiguredTest to a LegitoTest that can be executed
 */
export function configuredTestToLegitoTest(
  test: ConfiguredTest,
  allTests: ConfiguredTest[]
): LegitoTest {
  const opDef = getOperationById(test.operation);
  if (!opDef) {
    throw new Error(`Unknown operation: ${test.operation}`);
  }

  // Build the endpoint with placeholders replaced
  let endpoint = opDef.endpoint;

  // Replace static config values
  if (test.config.templateSuiteId) {
    endpoint = endpoint.replace('{templateSuiteId}', String(test.config.templateSuiteId));
  }
  if (test.config.objectId) {
    endpoint = endpoint.replace('{objectId}', String(test.config.objectId));
  }

  // Build dynamic endpoint function if needed
  const needsDynamicEndpoint = endpoint.includes('{') && test.config.useResultFrom;

  // Build body based on operation type
  let body: unknown = undefined;
  let dynamicBody: ((ctx: TestContext) => unknown) | undefined = undefined;

  if (test.operation === 'CREATE_DOCUMENT' && test.config.elementValues) {
    body = buildDocumentBody(test.config.elementValues, test.config.templateSuiteId);
  } else if (test.operation === 'UPDATE_DOCUMENT' && test.config.elementValues) {
    body = buildDocumentBody(test.config.elementValues, test.config.templateSuiteId);
  } else if (test.operation === 'CREATE_OBJECT_RECORD' && test.config.objectId) {
    body = buildObjectRecordBody(test.config.objectId, test.config.objectName, test.config.propertyValues);
  } else if (test.operation === 'UPDATE_OBJECT_RECORD' && test.config.propertyValues) {
    body = { properties: test.config.propertyValues };
  } else if (test.operation === 'CREATE_USER') {
    body = buildUserBody(test.config);
  } else if (test.operation === 'CREATE_USER_GROUP') {
    body = buildUserGroupBody(test.config);
  } else if (test.operation === 'CREATE_EXTERNAL_LINK') {
    body = [{ active: true, type: 'document', permission: 'EDIT', useMax: 0 }];
  } else if (test.operation === 'SHARE_TO_USER' || test.operation === 'SHARE_TO_USER_GROUP') {
    // Will be built dynamically
    dynamicBody = buildShareBody(test, allTests);
  } else if (test.operation === 'UPLOAD_FILE') {
    body = buildFileUploadBody(test.config);
  } else if (test.operation === 'CREATE_TAG') {
    body = buildTagBody(test.config);
  } else if (test.operation === 'CREATE_PUSH_CONNECTION') {
    body = buildPushConnectionBody(test.config);
  }

  // Determine context key for storing results
  const setsContext = getContextKeyForOperation(test);

  // Determine what context this test uses
  const usesContext = test.config.useResultFrom
    ? [getContextKeyFromTestId(test.config.useResultFrom, allTests)]
    : undefined;

  return {
    id: test.id,
    name: test.name,
    description: opDef.description,
    category: opDef.category,
    endpoint: needsDynamicEndpoint ? opDef.endpoint : endpoint,
    method: opDef.method,
    body,
    dynamicBody,
    dynamicEndpoint: needsDynamicEndpoint
      ? buildDynamicEndpoint(test, allTests)
      : undefined,
    setsContext,
    usesContext,
    expectedStatus: getExpectedStatus(test.operation),
    crudOperation: getCrudOperation(test.operation),
    resourceCategory: 'n/a',
    entityType: getEntityType(test.operation),
    skipIf: usesContext
      ? (ctx: TestContext) => usesContext.some(key => !ctx[key])
      : undefined,
    assertions: [
      { name: 'Returns expected status', type: 'status' as const },
    ],
    // Webhook verification config for TEST_PUSH_CONNECTION
    webhookConfig: test.operation === 'TEST_PUSH_CONNECTION' && test.config.verifyWebhook
      ? {
          verifyWebhook: true,
          webhookCorrelationId: test.config.webhookCorrelationId,
          webhookTimeoutMs: test.config.webhookTimeoutMs || 30000,
        }
      : undefined,
  };
}

// ============ Helper Functions ============

function buildDocumentBody(
  elementValues: Record<string, unknown>,
  templateSuiteId?: number
): unknown {
  const elements = Object.entries(elementValues).map(([name, value]) => ({
    name,
    value,
  }));

  return {
    templateSuiteId,
    data: elements,
  };
}

function buildObjectRecordBody(
  objectId: number,
  objectName?: string,
  propertyValues?: Record<string, unknown>
): unknown {
  const timestamp = Date.now();
  return {
    objectId,
    name: objectName || `Test Record ${timestamp}`,
    systemName: `test-record-${timestamp}`,
    properties: propertyValues || {},
  };
}

function buildUserBody(config: ConfiguredTest['config']): unknown {
  const timestamp = Date.now();
  return {
    email: config.userEmail || `test-user-${timestamp}@test.legito.com`,
    name: config.userName || `Test User ${timestamp}`,
    password: 'TestPassword123!',
    role: 'user',
  };
}

function buildUserGroupBody(config: ConfiguredTest['config']): unknown {
  const timestamp = Date.now();
  return {
    name: config.userGroupName || `Test Group ${timestamp}`,
    description: 'Created by API test',
  };
}

function buildFileUploadBody(config: ConfiguredTest['config']): unknown {
  // Use test file or custom file
  const content = config.useTestFile ? TEST_PDF_BASE64 : config.fileBase64;
  const name = config.fileName || TEST_PDF_FILENAME;
  const mimeType = config.mimeType || TEST_PDF_MIMETYPE;

  return {
    content,
    name,
    mimeType,
  };
}

function buildTagBody(config: ConfiguredTest['config']): unknown {
  const timestamp = Date.now();
  return {
    name: config.tagName || `Test Tag ${timestamp}`,
    color: config.tagColor || '#3B82F6', // Default blue
  };
}

function buildPushConnectionBody(config: ConfiguredTest['config']): unknown {
  const timestamp = Date.now();
  const correlationId = config.webhookCorrelationId || `test-${timestamp}`;

  // Construct the webhook URL using environment variables or defaults
  const baseUrl = typeof window !== 'undefined'
    ? window.location.origin
    : (process.env.NEXT_PUBLIC_APP_URL ||
       (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'));

  return {
    name: `API Test Push ${timestamp}`,
    url: `${baseUrl}/api/webhook/legito/${correlationId}`,
    eventTypes: config.eventTypes || ['DocumentRecordCreated', 'DocumentRecordUpdated'],
    enabled: true,
    // Store correlation ID in metadata for later retrieval
    _correlationId: correlationId,
  };
}

function buildDynamicEndpoint(
  test: ConfiguredTest,
  allTests: ConfiguredTest[]
): (ctx: TestContext) => string {
  const opDef = getOperationById(test.operation)!;

  return (ctx: TestContext) => {
    let endpoint = opDef.endpoint;

    // Get result from referenced test
    if (test.config.useResultFrom) {
      const sourceTest = allTests.find(t => t.id === test.config.useResultFrom);
      if (sourceTest) {
        const contextKey = getContextKeyForOperation(sourceTest);
        const result = ctx[contextKey] as Record<string, unknown> | undefined;

        if (result) {
          // Replace placeholders based on what's in the result
          if (result.documentRecordCode) {
            endpoint = endpoint.replace('{documentRecordCode}', String(result.documentRecordCode));
          }
          if (result.systemName) {
            endpoint = endpoint.replace('{systemName}', String(result.systemName));
          }
          if (result.id) {
            endpoint = endpoint.replace('{userId}', String(result.id));
            endpoint = endpoint.replace('{userGroupId}', String(result.id));
            endpoint = endpoint.replace('{externalLinkId}', String(result.id));
            endpoint = endpoint.replace('{fileId}', String(result.id));
            endpoint = endpoint.replace('{tagId}', String(result.id));
            endpoint = endpoint.replace('{pushConnectionId}', String(result.id));
            endpoint = endpoint.replace('{workflowId}', String(result.id));
          }
        }
      }
    }

    return endpoint;
  };
}

function buildShareBody(
  test: ConfiguredTest,
  allTests: ConfiguredTest[]
): (ctx: TestContext) => unknown {
  return (ctx: TestContext) => {
    // Find the user or group from context
    const userTest = allTests.find(t =>
      t.operation === 'CREATE_USER' && test.config.useResultFrom?.includes(t.id)
    );
    const groupTest = allTests.find(t =>
      t.operation === 'CREATE_USER_GROUP' && test.config.useResultFrom?.includes(t.id)
    );

    if (test.operation === 'SHARE_TO_USER' && userTest) {
      const userCtx = ctx[getContextKeyForOperation(userTest)] as Record<string, unknown> | undefined;
      return [{
        id: userCtx?.id,
        permission: test.config.sharePermission || 'EDIT',
      }];
    }

    if (test.operation === 'SHARE_TO_USER_GROUP' && groupTest) {
      const groupCtx = ctx[getContextKeyForOperation(groupTest)] as Record<string, unknown> | undefined;
      return [{
        id: groupCtx?.id,
        permission: test.config.sharePermission || 'EDIT',
      }];
    }

    return [];
  };
}

function getContextKeyForOperation(test: ConfiguredTest): string {
  // Special case: if returnExternalLink is enabled, use the key that the test runner checks
  if (test.operation === 'CREATE_EXTERNAL_LINK' && test.config.returnExternalLink) {
    return 'externalLinkKept';
  }
  const opId = test.operation.toLowerCase().replace(/_/g, '-');
  return `${opId}-${test.id}`;
}

function getContextKeyFromTestId(testId: string, allTests: ConfiguredTest[]): string {
  const test = allTests.find(t => t.id === testId);
  return test ? getContextKeyForOperation(test) : testId;
}

function getExpectedStatus(operation: ApiOperation): number[] {
  switch (operation) {
    case 'CREATE_DOCUMENT':
    case 'CREATE_OBJECT_RECORD':
    case 'CREATE_USER':
    case 'CREATE_USER_GROUP':
    case 'CREATE_EXTERNAL_LINK':
    case 'UPLOAD_FILE':
    case 'CREATE_TAG':
    case 'CREATE_PUSH_CONNECTION':
    case 'CLONE_DOCUMENT':
      return [200, 201];
    case 'DELETE_DOCUMENT':
    case 'DELETE_OBJECT_RECORD':
    case 'DELETE_USER':
    case 'DELETE_USER_GROUP':
    case 'DELETE_EXTERNAL_LINK':
    case 'DELETE_FILE':
    case 'DELETE_TAG':
    case 'DELETE_PUSH_CONNECTION':
    case 'REMOVE_USER_SHARE':
      return [200, 204];
    default:
      return [200];
  }
}

function getCrudOperation(operation: ApiOperation): 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | undefined {
  if (operation.startsWith('CREATE_') || operation === 'UPLOAD_FILE' || operation === 'CLONE_DOCUMENT') return 'CREATE';
  if (operation.startsWith('GET_') || operation.startsWith('READ_') || operation.startsWith('LIST_') || operation === 'DOWNLOAD_DOCUMENT') return 'READ';
  if (operation.startsWith('UPDATE_') || operation === 'ANONYMIZE_DOCUMENT' || operation === 'TEST_PUSH_CONNECTION') return 'UPDATE';
  if (operation.startsWith('DELETE_') || operation === 'REMOVE_USER_SHARE') return 'DELETE';
  if (operation.startsWith('SHARE_')) return 'UPDATE';
  if (operation === 'COMPARE_DOCUMENTS') return 'READ';
  return undefined;
}

function getEntityType(operation: ApiOperation): string {
  if (operation.includes('DOCUMENT') || operation.includes('TEMPLATE')) return 'Document';
  if (operation.includes('OBJECT')) return 'ObjectRecord';
  if (operation.includes('USER_GROUP')) return 'UserGroup';
  if (operation.includes('USER')) return 'User';
  if (operation.includes('EXTERNAL_LINK')) return 'ExternalLink';
  if (operation.includes('SHARE')) return 'Share';
  if (operation.includes('FILE')) return 'File';
  if (operation.includes('TAG')) return 'Tag';
  if (operation.includes('PUSH') || operation.includes('WEBHOOK')) return 'PushConnection';
  if (operation.includes('WORKFLOW')) return 'Workflow';
  return 'Unknown';
}

/**
 * Convert all configured tests to LegitoTests for execution
 */
export function convertConfiguredTestsToLegito(tests: ConfiguredTest[]): LegitoTest[] {
  // Sort by order
  const sorted = [...tests].sort((a, b) => a.order - b.order);

  // Only include enabled tests
  const enabled = sorted.filter(t => t.enabled);

  // Convert each test
  return enabled.map(test => configuredTestToLegitoTest(test, tests));
}

/**
 * Operation Catalog - Defines all available API operations for test configuration
 */

import type { ApiOperation, ConfiguredTest } from '@/types';
import type { LegitoTest, TestContext } from './legito-api';
import { legitoRequest } from './legito-api';

export type OperationCategory = 'Documents' | 'Objects' | 'Users' | 'User Groups' | 'Sharing' | 'Files' | 'Workflows' | 'Other';

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
    downloadFormat?: boolean | 'optional';
    returnFileContent?: 'optional';
    // Label operations
    labelName?: boolean;
    labelId?: boolean;
    // Push connection operations
    eventTypes?: 'optional';
    // Document metadata operations
    ownerId?: boolean;
    // Parent document linking (Related Documents)
    linkToParentTestId?: 'optional';
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
    id: 'CREATE_DOCUMENT',
    name: 'Create Document',
    description: 'Create a new document from a template with element values',
    category: 'Documents',
    method: 'POST',
    endpoint: '/document-version/data/{templateSuiteId}',
    requiresConfig: { templateSuiteId: true, elementValues: true, linkToParentTestId: 'optional' },
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
    id: 'UPDATE_DOCUMENT_METADATA',
    name: 'Update Document Metadata',
    description: 'Update document record metadata (owner, name, etc.)',
    category: 'Documents',
    method: 'PUT',
    endpoint: '/document-record/{documentRecordCode}',
    requiresConfig: { useResultFrom: true, ownerId: true },
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
    method: 'GET',
    endpoint: '/document-record/anonymize/{code}',
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
    id: 'CREATE_OBJECT_RECORD',
    name: 'Create Object Record',
    description: 'Create a new object record with property values',
    category: 'Objects',
    method: 'POST',
    endpoint: '/object-record/{objectId}',
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
    endpoint: '/user/{userIdOrEmail}',
    requiresConfig: { useResultFrom: true },
    needsResultFrom: ['CREATE_USER'],
  },
  {
    id: 'DELETE_USER',
    name: 'Delete User',
    description: 'Delete a user account',
    category: 'Users',
    method: 'DELETE',
    endpoint: '/user/{userIdOrEmail}',
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
    method: 'POST',
    endpoint: '/share/user/{code}',
    requiresConfig: { useResultFrom: true, sharePermission: true },
    needsResultFrom: ['CREATE_DOCUMENT', 'CREATE_USER'],
  },
  {
    id: 'SHARE_TO_USER_GROUP',
    name: 'Share to User Group',
    description: 'Share a document with a user group',
    category: 'Sharing',
    method: 'POST',
    endpoint: '/share/user-group/{code}',
    requiresConfig: { useResultFrom: true, sharePermission: true },
    needsResultFrom: ['CREATE_DOCUMENT', 'CREATE_USER_GROUP'],
  },

  // ============ Document Versions ============
  {
    id: 'DOWNLOAD_DOCUMENT',
    name: 'Download Document',
    description: 'Download document in specified format (PDF, DOCX, etc.)',
    category: 'Documents',
    method: 'GET',
    endpoint: '/document-version/download/{code}/{format}',
    requiresConfig: { useResultFrom: true, downloadFormat: true },
    needsResultFrom: ['CREATE_DOCUMENT'],
  },

  // ============ Files ============
  // File operations require a documentRecordCode (from CREATE_DOCUMENT)
  {
    id: 'LIST_FILES',
    name: 'List Document Files',
    description: 'List all external files attached to a document',
    category: 'Files',
    method: 'GET',
    endpoint: '/file/{documentRecordCode}',
    requiresConfig: { useResultFrom: true },
    needsResultFrom: ['CREATE_DOCUMENT'],
  },
  {
    id: 'UPLOAD_FILE',
    name: 'Upload File to Document',
    description: 'Upload an external file to a document record',
    category: 'Files',
    method: 'POST',
    endpoint: '/file/{documentRecordCode}',
    requiresConfig: { useResultFrom: true },
    needsResultFrom: ['CREATE_DOCUMENT'],
  },
  {
    id: 'DOWNLOAD_FILE',
    name: 'Download File',
    description: 'Download an external file by ID',
    category: 'Files',
    method: 'GET',
    endpoint: '/file/download/{fileId}',
    requiresConfig: { useResultFrom: true },
    needsResultFrom: ['UPLOAD_FILE'],
  },
  {
    id: 'DELETE_FILE',
    name: 'Delete File',
    description: 'Remove an external file from a document',
    category: 'Files',
    method: 'DELETE',
    endpoint: '/file/{fileId}',
    requiresConfig: { useResultFrom: true },
    needsResultFrom: ['UPLOAD_FILE'],
  },

  // ============ Sharing (extended) ============
  {
    id: 'GET_DOCUMENT_SHARES',
    name: 'Get Document Shares',
    description: 'Get all shares (users, groups, external links) for a document',
    category: 'Sharing',
    method: 'GET',
    endpoint: '/share/{code}',
    requiresConfig: { useResultFrom: true },
    needsResultFrom: ['CREATE_DOCUMENT'],
  },
  {
    id: 'UPDATE_EXTERNAL_LINK',
    name: 'Update External Link',
    description: 'Update an existing external sharing link',
    category: 'Sharing',
    method: 'PUT',
    endpoint: '/share/external-link/{externalLinkId}',
    requiresConfig: { useResultFrom: true },
    needsResultFrom: ['CREATE_EXTERNAL_LINK'],
  },
  {
    id: 'REMOVE_USER_SHARE',
    name: 'Remove User Share',
    description: 'Remove a user share from a document',
    category: 'Sharing',
    method: 'DELETE',
    endpoint: '/share/user/{code}/{userIdOrEmail}',
    requiresConfig: { useResultFrom: true },
    needsResultFrom: ['SHARE_TO_USER'],
  },
  {
    id: 'REMOVE_USER_GROUP_SHARE',
    name: 'Remove User Group Share',
    description: 'Remove a user group share from a document',
    category: 'Sharing',
    method: 'DELETE',
    endpoint: '/share/user-group/{code}/{userGroupId}',
    requiresConfig: { useResultFrom: true },
    needsResultFrom: ['SHARE_TO_USER_GROUP'],
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
    name: 'Get Workflow Revision',
    description: 'Get schema of a specific workflow revision',
    category: 'Workflows',
    method: 'GET',
    endpoint: '/workflow/revision/{workflowRevisionId}',
    requiresConfig: { useResultFrom: true },
    needsResultFrom: ['GET_WORKFLOWS'],
  },

  // ============ Labels ============
  {
    id: 'LIST_LABELS',
    name: 'List Labels',
    description: 'Retrieve list of all labels',
    category: 'Other',
    method: 'GET',
    endpoint: '/label',
    requiresConfig: {},
  },
  {
    id: 'CREATE_LABEL',
    name: 'Create Label',
    description: 'Create a new label',
    category: 'Other',
    method: 'POST',
    endpoint: '/label',
    requiresConfig: {},
  },
  {
    id: 'DELETE_LABEL',
    name: 'Delete Label',
    description: 'Remove a label',
    category: 'Other',
    method: 'DELETE',
    endpoint: '/label/{labelId}',
    requiresConfig: { useResultFrom: true },
    needsResultFrom: ['CREATE_LABEL'],
  },

  // ============ Template Tags ============
  {
    id: 'LIST_TEMPLATE_TAGS',
    name: 'List Template Tags',
    description: 'Retrieve list of all template tags',
    category: 'Other',
    method: 'GET',
    endpoint: '/template-tag',
    requiresConfig: {},
  },
  {
    id: 'CREATE_TEMPLATE_TAG',
    name: 'Create Template Tag',
    description: 'Create a new template tag',
    category: 'Other',
    method: 'POST',
    endpoint: '/template-tag',
    requiresConfig: {},
  },

  // ============ Push Connections ============
  {
    id: 'GET_PUSH_CONNECTIONS',
    name: 'List Push Connections',
    description: 'Retrieve list of all webhook push connections',
    category: 'Other',
    method: 'GET',
    endpoint: '/push-connection',
    requiresConfig: {},
  },
  {
    id: 'CREATE_PUSH_CONNECTION',
    name: 'Create Push Connection',
    description: 'Create a webhook subscription for events',
    category: 'Other',
    method: 'POST',
    endpoint: '/push-connection',
    requiresConfig: {},
  },
  {
    id: 'DELETE_PUSH_CONNECTION',
    name: 'Delete Push Connection',
    description: 'Remove a push connection',
    category: 'Other',
    method: 'DELETE',
    endpoint: '/push-connection/{pushConnectionId}',
    requiresConfig: { useResultFrom: true },
    needsResultFrom: ['CREATE_PUSH_CONNECTION'],
  },
  {
    id: 'VERIFY_WEBHOOK',
    name: 'Verify Webhook Received',
    description: 'Verify that a webhook was received from Legito push API',
    category: 'Other',
    method: 'GET',  // Internal verification, not a Legito API call
    endpoint: '/api/webhook/legito/{correlationId}',  // Our internal endpoint
    requiresConfig: { useResultFrom: true },
    needsResultFrom: ['CREATE_PUSH_CONNECTION'],
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
    body = buildDocumentBody(test.config.elementValues);
  } else if (test.operation === 'UPDATE_DOCUMENT' && test.config.elementValues) {
    body = buildDocumentBody(test.config.elementValues);
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
  } else if (test.operation === 'CREATE_PUSH_CONNECTION') {
    body = buildPushConnectionBody(test.config);
  } else if (test.operation === 'CREATE_LABEL') {
    body = buildLabelBody(test.config);
  } else if (test.operation === 'UPDATE_DOCUMENT_METADATA') {
    body = buildDocumentMetadataBody(test.config);
  } else if (test.operation === 'UPLOAD_FILE') {
    body = buildFileUploadBody(test.config);
  }

  // Determine context key for storing results
  const setsContext = getContextKeyForOperation(test);

  // Determine what context this test uses
  const usesContext = test.config.useResultFrom
    ? [getContextKeyFromTestId(test.config.useResultFrom, allTests)]
    : undefined;

  // Build the base test object
  const baseTest: LegitoTest = {
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
  };

  // Special handling for VERIFY_WEBHOOK - internal test
  if (test.operation === 'VERIFY_WEBHOOK') {
    baseTest.isInternalTest = true;
    baseTest.assertions = [
      { name: 'Webhook received', type: 'status' as const },
    ];
    baseTest.internalTestHandler = async (ctx: TestContext) => {
      // Find the push connection test from useResultFrom config
      const sourceTestId = test.config.useResultFrom;
      if (!sourceTestId) {
        return { success: false, error: 'No source push connection test configured' };
      }

      const sourceTest = allTests.find(t => t.id === sourceTestId);
      if (!sourceTest) {
        return { success: false, error: `Source test not found: ${sourceTestId}` };
      }

      // Get correlation ID from the push connection context using proper context key
      const contextKey = getContextKeyForOperation(sourceTest);
      console.log('[VERIFY_WEBHOOK] Looking for context key:', contextKey);
      console.log('[VERIFY_WEBHOOK] All context keys:', Object.keys(ctx));

      const pushConnection = ctx[contextKey] as { _correlationId?: string; url?: string; id?: number } | undefined;
      console.log('[VERIFY_WEBHOOK] Push connection context:', JSON.stringify(pushConnection));

      const correlationId = pushConnection?._correlationId || pushConnection?.url?.split('/').pop();
      console.log('[VERIFY_WEBHOOK] Extracted correlation ID:', correlationId);

      if (!correlationId) {
        return { success: false, error: `No correlation ID found in context[${contextKey}]. Context value: ${JSON.stringify(pushConnection)}` };
      }

      // Wait for webhook with timeout (Legito takes 30-40 seconds to send webhooks)
      const timeout = test.config.webhookTimeout || 60000; // Default 60 seconds
      const expectedEventType = test.config.expectedEventType;

      try {
        const fetchUrl = `/api/webhook/legito/${correlationId}?wait=${timeout}`;
        console.log('[VERIFY_WEBHOOK] Fetching:', fetchUrl);

        const response = await fetch(fetchUrl, { method: 'GET' });
        console.log('[VERIFY_WEBHOOK] Response status:', response.status);

        const data = await response.json();
        console.log('[VERIFY_WEBHOOK] Response data:', JSON.stringify(data).substring(0, 500));

        if (!data.found) {
          return {
            success: false,
            error: `No webhook received within ${timeout}ms`,
            data
          };
        }

        // Check event type if specified
        if (expectedEventType && data.webhook?.event_type !== expectedEventType) {
          return {
            success: false,
            error: `Expected event type '${expectedEventType}', got '${data.webhook?.event_type}'`,
            data
          };
        }

        return { success: true, data: data.webhook };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Failed to verify webhook'
        };
      }
    };
  }

  // Special handling for CREATE_DOCUMENT with parent linking
  if (test.operation === 'CREATE_DOCUMENT' && test.config.linkToParentTestId) {
    const parentTestId = test.config.linkToParentTestId;

    baseTest.afterExecute = async (
      ctx: TestContext,
      result: unknown,
      jwt: string,
      baseUrl: string
    ) => {
      console.log('[ParentLink] Starting parent document linking...');
      console.log('[ParentLink] Result:', JSON.stringify(result).substring(0, 500));

      // Get the created document's code - handle array response
      let createdDoc = result as { documentRecordCode?: string; documentRecordId?: number } | undefined;
      if (Array.isArray(result) && result.length > 0) {
        createdDoc = result[0];
      }

      if (!createdDoc?.documentRecordCode) {
        console.log('[ParentLink] No documentRecordCode found in result');
        return { success: false, error: 'No documentRecordCode in created document' };
      }

      // Find the parent test and get its result from context
      const parentTest = allTests.find(t => t.id === parentTestId);
      if (!parentTest) {
        return { success: false, error: `Parent test not found: ${parentTestId}` };
      }

      const parentContextKey = getContextKeyForOperation(parentTest);
      console.log('[ParentLink] Parent context key:', parentContextKey);
      console.log('[ParentLink] Parent context:', JSON.stringify(ctx[parentContextKey]).substring(0, 500));

      const parentResult = ctx[parentContextKey] as { documentRecordId?: number } | undefined;

      if (!parentResult?.documentRecordId) {
        return { success: false, error: `Parent document ID not found in context[${parentContextKey}]` };
      }

      console.log('[ParentLink] Linking child', createdDoc.documentRecordCode, 'to parent', parentResult.documentRecordId);

      // Call PUT /document-record/{code} to set parentDocumentRecordId
      // The systemName is a UUID unique to each workspace - we must discover it first
      try {
        // First, fetch the child document record to find the Related Documents property
        console.log('[ParentLink] Fetching child document to discover Related Documents property...');
        const docResponse = await legitoRequest(`/document-record/${createdDoc.documentRecordCode}`, {
          method: 'GET',
          jwt,
          baseUrl,
        });

        if (!docResponse.data) {
          return { success: false, error: 'Failed to fetch child document record' };
        }

        // Find the property with systemType 'related_document_records'
        const docData = docResponse.data as { properties?: Array<{ systemName?: string; systemType?: string; name?: string }> };
        const relatedDocsProp = docData.properties?.find(p => p.systemType === 'related_document_records');

        if (!relatedDocsProp?.systemName) {
          console.log('[ParentLink] No Related Documents property found on this document');
          console.log('[ParentLink] Available properties:', docData.properties?.map(p => `${p.name} (${p.systemType})`).join(', '));
          return {
            success: false,
            error: 'Related Documents property not found on child document. Ensure the template has this property enabled.',
          };
        }

        console.log('[ParentLink] Found Related Documents property:', relatedDocsProp.name, '- systemName:', relatedDocsProp.systemName);

        // Now set the parent using the discovered systemName
        const linkBody = {
          properties: [{
            systemName: relatedDocsProp.systemName,
            value: {
              parentDocumentRecordId: parentResult.documentRecordId,
            },
          }],
        };
        console.log('[ParentLink] Setting parent with body:', JSON.stringify(linkBody));

        const response = await legitoRequest(`/document-record/${createdDoc.documentRecordCode}`, {
          method: 'PUT',
          jwt,
          baseUrl,
          body: linkBody,
        });

        console.log('[ParentLink] Response:', response.status, response.statusText);

        if (response.status >= 200 && response.status < 300) {
          console.log('[ParentLink] Successfully linked parent document!');
          return { success: true };
        } else {
          const errorMsg = response.error || JSON.stringify(response.data);
          console.log('[ParentLink] Failed:', errorMsg);
          return {
            success: false,
            error: `Failed to link parent: ${response.status} - ${errorMsg}`,
          };
        }
      } catch (err) {
        console.log('[ParentLink] Error:', err);
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Failed to link parent document',
        };
      }
    };
  }

  return baseTest;
}

// ============ Helper Functions ============

function buildDocumentBody(
  elementValues: Record<string, unknown>
): unknown {
  // Body should be just an array of { name, value } or { name, visible } objects
  // The templateSuiteId is already in the URL
  const elements = Object.entries(elementValues).map(([name, value]) => {
    // Check if this is a visibility element (stored as { __visible: boolean })
    if (typeof value === 'object' && value !== null && '__visible' in value) {
      return {
        name,
        visible: (value as { __visible: boolean }).__visible,
      };
    }
    // Regular element with value
    return {
      name,
      value,
    };
  });

  return elements;
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

function buildPushConnectionBody(config: ConfiguredTest['config']): unknown {
  const timestamp = Date.now();
  // Generate a unique correlation ID for this push connection
  // This will be used to verify webhooks are received
  const correlationId = config.correlationId || `webhook-${timestamp}-${Math.random().toString(36).substring(2, 8)}`;

  // Use the app's webhook endpoint with the correlation ID
  const webhookUrl = config.webhookUrl ||
    `https://api-testing-dashboard.vercel.app/api/webhook/legito/${correlationId}`;

  console.log('[PushConnection] Generated correlation ID:', correlationId);
  console.log('[PushConnection] Webhook URL:', webhookUrl);

  return {
    name: config.pushConnectionName || `Test Push Connection ${timestamp}`,
    url: webhookUrl,
    enabled: true,
    headers: [],
    eventTypes: config.eventTypes || [
      'DocumentRecordCreated',
      'DocumentRecordUpdated',
      'DocumentRecordDeleted',
    ],
    templateSuiteAll: true,
    templateSuites: [],
    documentRecordTypeAll: true,
    documentRecordTypes: [],
    attachFilesUploaded: false,
    attachFilesGenerated: false,
    fileTypes: ['pdf', 'docx'],
    // Store correlation ID in response context for VERIFY_WEBHOOK
    _correlationId: correlationId,
  };
}

function buildLabelBody(config: ConfiguredTest['config']): unknown {
  const timestamp = Date.now();
  return {
    name: config.labelName || `Test Label ${timestamp}`,
  };
}

function buildDocumentMetadataBody(config: ConfiguredTest['config']): unknown {
  // Build document record metadata update body
  // Only include fields that are set
  const body: Record<string, unknown> = {};

  if (config.ownerId) {
    body.ownerId = config.ownerId;
  }

  // Can add more metadata fields here in future:
  // - name (document name)
  // - documentRecordTypeId
  // - properties

  return body;
}

function buildFileUploadBody(config: ConfiguredTest['config']): unknown {
  // Build file upload body for Legito API
  // POST /file/{documentRecordCode} expects:
  // { fileName: string, attachment: boolean, data: "data:mime/type;base64,..." }
  const timestamp = Date.now();

  // Use provided filename or generate one
  const fileName = config.fileName || `test-file-${timestamp}.pdf`;

  // Determine MIME type from filename
  const ext = fileName.split('.').pop()?.toLowerCase() || 'pdf';
  const mimeTypes: Record<string, string> = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    txt: 'text/plain',
  };
  const mimeType = mimeTypes[ext] || 'application/octet-stream';

  // Use provided content or a minimal test PDF
  let base64Content = config.fileBase64;

  if (!base64Content && config.useTestFile !== false) {
    // Minimal valid PDF (creates a blank 1-page PDF)
    base64Content = 'JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSA+PgplbmRvYmoKeHJlZgowIDQKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDA5IDAwMDAwIG4gCjAwMDAwMDAwNTggMDAwMDAgbiAKMDAwMDAwMDExNSAwMDAwMCBuIAp0cmFpbGVyCjw8IC9TaXplIDQgL1Jvb3QgMSAwIFIgPj4Kc3RhcnR4cmVmCjE5NAolJUVPRgo=';
  }

  // Format as data URL: data:mime/type;base64,...
  const dataUrl = `data:${mimeType};base64,${base64Content || ''}`;

  return {
    fileName: fileName,
    attachment: false,
    data: dataUrl,
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
          // Document-related placeholders
          if (result.documentRecordCode) {
            endpoint = endpoint.replace('{documentRecordCode}', String(result.documentRecordCode));
            endpoint = endpoint.replace('{code}', String(result.documentRecordCode));
          }
          if (result.code) {
            endpoint = endpoint.replace('{code}', String(result.code));
          }
          // Object record placeholder
          if (result.systemName) {
            endpoint = endpoint.replace('{systemName}', String(result.systemName));
          }
          // ID-based placeholders
          if (result.id) {
            endpoint = endpoint.replace('{userId}', String(result.id));
            endpoint = endpoint.replace('{userIdOrEmail}', String(result.id));
            endpoint = endpoint.replace('{userGroupId}', String(result.id));
            endpoint = endpoint.replace('{externalLinkId}', String(result.id));
            endpoint = endpoint.replace('{fileId}', String(result.id));
            endpoint = endpoint.replace('{labelId}', String(result.id));
            endpoint = endpoint.replace('{pushConnectionId}', String(result.id));
            endpoint = endpoint.replace('{workflowRevisionId}', String(result.id));
          }
        }
      }
    }

    // Handle download format
    if (test.config.downloadFormat) {
      endpoint = endpoint.replace('{format}', test.config.downloadFormat);
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
    case 'CREATE_LABEL':
    case 'CREATE_TEMPLATE_TAG':
    case 'CREATE_PUSH_CONNECTION':
      return [200, 201];
    case 'DELETE_DOCUMENT':
    case 'DELETE_OBJECT_RECORD':
    case 'DELETE_USER':
    case 'DELETE_USER_GROUP':
    case 'DELETE_EXTERNAL_LINK':
    case 'DELETE_FILE':
    case 'DELETE_LABEL':
    case 'DELETE_PUSH_CONNECTION':
    case 'REMOVE_USER_SHARE':
    case 'REMOVE_USER_GROUP_SHARE':
      return [200, 204];
    default:
      return [200];
  }
}

function getCrudOperation(operation: ApiOperation): 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | undefined {
  if (operation.startsWith('CREATE_') || operation === 'UPLOAD_FILE') return 'CREATE';
  if (operation.startsWith('GET_') || operation.startsWith('READ_') || operation.startsWith('LIST_') || operation === 'DOWNLOAD_DOCUMENT' || operation === 'ANONYMIZE_DOCUMENT') return 'READ';
  if (operation.startsWith('UPDATE_')) return 'UPDATE';
  if (operation.startsWith('DELETE_') || operation === 'REMOVE_USER_SHARE' || operation === 'REMOVE_USER_GROUP_SHARE') return 'DELETE';
  if (operation.startsWith('SHARE_')) return 'UPDATE';
  return undefined;
}

function getEntityType(operation: ApiOperation): string {
  if (operation.includes('DOCUMENT') || operation.includes('TEMPLATE_TAG')) return 'Document';
  if (operation.includes('OBJECT')) return 'ObjectRecord';
  if (operation.includes('USER_GROUP')) return 'UserGroup';
  if (operation.includes('USER')) return 'User';
  if (operation.includes('EXTERNAL_LINK')) return 'ExternalLink';
  if (operation.includes('SHARE')) return 'Share';
  if (operation.includes('FILE')) return 'File';
  if (operation.includes('LABEL')) return 'Label';
  if (operation.includes('PUSH')) return 'PushConnection';
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

/**
 * Zod schemas for MCP tool input validation
 */

import { z } from 'zod';

// Common schemas
export const workspaceIdSchema = z.string().describe('Workspace ID to use for this request');

export const paginationSchema = z.object({
  limit: z.number().optional().describe('Maximum number of results to return'),
  offset: z.number().optional().describe('Number of results to skip'),
});

export const regionSchema = z.enum(['emea', 'us', 'ca', 'apac', 'quarterly']).describe('Legito region');

export const permissionSchema = z.enum(['EDIT', 'READ']).describe('Permission level');

// Document schemas
export const documentElementSchema = z.object({
  name: z.string().describe('Element system name (UUID)'),
  value: z.unknown().optional().describe('Element value'),
  visible: z.boolean().optional().describe('Whether element is visible'),
});

export const createDocumentSchema = z.object({
  workspaceId: workspaceIdSchema,
  templateSuiteId: z.number().describe('Template suite ID to create document from'),
  elements: z.array(documentElementSchema).describe('Array of element values'),
});

export const updateDocumentSchema = z.object({
  workspaceId: workspaceIdSchema,
  documentRecordCode: z.string().describe('Document record code'),
  elements: z.array(documentElementSchema).describe('Array of element updates'),
});

export const getDocumentSchema = z.object({
  workspaceId: workspaceIdSchema,
  code: z.string().describe('Document record code'),
});

export const listDocumentsSchema = z.object({
  workspaceId: workspaceIdSchema,
  search: z.string().optional().describe('Search query'),
  limit: z.number().optional().describe('Maximum results'),
  offset: z.number().optional().describe('Results offset'),
});

export const deleteDocumentSchema = z.object({
  workspaceId: workspaceIdSchema,
  code: z.string().describe('Document record code to delete'),
});

export const anonymizeDocumentSchema = z.object({
  workspaceId: workspaceIdSchema,
  code: z.string().describe('Document record code to anonymize'),
});

// Object schemas
export const objectPropertySchema = z.object({
  systemName: z.string().describe('Property system name (UUID)'),
  value: z.unknown().describe('Property value'),
});

export const createObjectRecordSchema = z.object({
  workspaceId: workspaceIdSchema,
  objectId: z.number().describe('Object definition ID'),
  properties: z.array(objectPropertySchema).describe('Array of property values'),
});

export const updateObjectRecordSchema = z.object({
  workspaceId: workspaceIdSchema,
  systemName: z.string().describe('Object record system name'),
  properties: z.array(objectPropertySchema).describe('Array of property updates'),
});

export const getObjectRecordSchema = z.object({
  workspaceId: workspaceIdSchema,
  systemName: z.string().describe('Object record system name'),
});

export const listObjectRecordsSchema = z.object({
  workspaceId: workspaceIdSchema,
  objectId: z.number().describe('Object definition ID'),
});

export const deleteObjectRecordSchema = z.object({
  workspaceId: workspaceIdSchema,
  systemName: z.string().describe('Object record system name to delete'),
});

export const listObjectsSchema = z.object({
  workspaceId: workspaceIdSchema,
});

// User schemas
export const createUserSchema = z.object({
  workspaceId: workspaceIdSchema,
  email: z.string().email().describe('User email address'),
  name: z.string().describe('User display name'),
  caption: z.string().optional().describe('User caption/title'),
  timezone: z.string().optional().describe('User timezone'),
  position: z.string().optional().describe('User position'),
});

export const updateUserSchema = z.object({
  workspaceId: workspaceIdSchema,
  id: z.number().describe('User ID'),
  email: z.string().email().optional().describe('User email address'),
  name: z.string().optional().describe('User display name'),
  caption: z.string().optional().describe('User caption/title'),
  timezone: z.string().optional().describe('User timezone'),
  position: z.string().optional().describe('User position'),
});

export const getUserSchema = z.object({
  workspaceId: workspaceIdSchema,
  id: z.number().describe('User ID'),
});

export const listUsersSchema = z.object({
  workspaceId: workspaceIdSchema,
});

export const deleteUserSchema = z.object({
  workspaceId: workspaceIdSchema,
  id: z.number().describe('User ID to delete'),
});

// User group schemas
export const createUserGroupSchema = z.object({
  workspaceId: workspaceIdSchema,
  name: z.string().describe('User group name'),
});

export const updateUserGroupSchema = z.object({
  workspaceId: workspaceIdSchema,
  id: z.number().describe('User group ID'),
  name: z.string().describe('New user group name'),
});

export const getUserGroupSchema = z.object({
  workspaceId: workspaceIdSchema,
  id: z.number().describe('User group ID'),
});

export const listUserGroupsSchema = z.object({
  workspaceId: workspaceIdSchema,
});

export const deleteUserGroupSchema = z.object({
  workspaceId: workspaceIdSchema,
  id: z.number().describe('User group ID to delete'),
});

// Sharing schemas
export const shareToUserSchema = z.object({
  workspaceId: workspaceIdSchema,
  documentCode: z.string().describe('Document record code'),
  userId: z.number().describe('User ID to share with'),
  permission: permissionSchema.optional().default('READ'),
});

export const shareToGroupSchema = z.object({
  workspaceId: workspaceIdSchema,
  documentCode: z.string().describe('Document record code'),
  groupId: z.number().describe('User group ID to share with'),
  permission: permissionSchema.optional().default('READ'),
});

export const createExternalLinkSchema = z.object({
  workspaceId: workspaceIdSchema,
  documentCode: z.string().describe('Document record code'),
  active: z.boolean().default(true).describe('Whether link is active'),
  permission: permissionSchema.default('READ'),
  useMax: z.number().default(0).describe('Maximum uses (0 for unlimited)'),
});

export const deleteExternalLinkSchema = z.object({
  workspaceId: workspaceIdSchema,
  linkId: z.number().describe('External link ID to delete'),
});

export const listExternalLinksSchema = z.object({
  workspaceId: workspaceIdSchema,
  documentCode: z.string().describe('Document record code'),
});

// Template schemas
export const listTemplateSuitesSchema = z.object({
  workspaceId: workspaceIdSchema,
});

export const getTemplateSuiteSchema = z.object({
  workspaceId: workspaceIdSchema,
  id: z.number().describe('Template suite ID'),
});

// Tag schemas
export const listTagsSchema = z.object({
  workspaceId: workspaceIdSchema,
});

export const createTagSchema = z.object({
  workspaceId: workspaceIdSchema,
  name: z.string().describe('Tag name'),
  color: z.string().optional().describe('Tag color (hex code)'),
  description: z.string().optional().describe('Tag description'),
});

export const getTagSchema = z.object({
  workspaceId: workspaceIdSchema,
  id: z.number().describe('Tag ID'),
});

// Workflow schemas
export const listWorkflowsSchema = z.object({
  workspaceId: workspaceIdSchema,
});

export const getWorkflowSchema = z.object({
  workspaceId: workspaceIdSchema,
  id: z.number().describe('Workflow ID'),
});

// Reference data schemas
export const referenceDataSchema = z.object({
  workspaceId: workspaceIdSchema,
});

// Export all schemas as a lookup
export const schemas = {
  // Documents
  createDocument: createDocumentSchema,
  updateDocument: updateDocumentSchema,
  getDocument: getDocumentSchema,
  listDocuments: listDocumentsSchema,
  deleteDocument: deleteDocumentSchema,
  anonymizeDocument: anonymizeDocumentSchema,

  // Objects
  createObjectRecord: createObjectRecordSchema,
  updateObjectRecord: updateObjectRecordSchema,
  getObjectRecord: getObjectRecordSchema,
  listObjectRecords: listObjectRecordsSchema,
  deleteObjectRecord: deleteObjectRecordSchema,
  listObjects: listObjectsSchema,

  // Users
  createUser: createUserSchema,
  updateUser: updateUserSchema,
  getUser: getUserSchema,
  listUsers: listUsersSchema,
  deleteUser: deleteUserSchema,

  // User groups
  createUserGroup: createUserGroupSchema,
  updateUserGroup: updateUserGroupSchema,
  getUserGroup: getUserGroupSchema,
  listUserGroups: listUserGroupsSchema,
  deleteUserGroup: deleteUserGroupSchema,

  // Sharing
  shareToUser: shareToUserSchema,
  shareToGroup: shareToGroupSchema,
  createExternalLink: createExternalLinkSchema,
  deleteExternalLink: deleteExternalLinkSchema,
  listExternalLinks: listExternalLinksSchema,

  // Templates
  listTemplateSuites: listTemplateSuitesSchema,
  getTemplateSuite: getTemplateSuiteSchema,

  // Tags
  listTags: listTagsSchema,
  createTag: createTagSchema,
  getTag: getTagSchema,

  // Workflows
  listWorkflows: listWorkflowsSchema,
  getWorkflow: getWorkflowSchema,

  // Reference data
  getSystemInfo: referenceDataSchema,
  listCountries: referenceDataSchema,
  listCurrencies: referenceDataSchema,
  listLanguages: referenceDataSchema,
  listTimezones: referenceDataSchema,
};

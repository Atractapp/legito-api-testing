/**
 * Document Tools
 * Tools for managing Legito documents
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { createLegitoMcpClient } from '../legito-mcp-client';
import { getMcpWorkspaceCredentials } from '@/store/mcp-store';

const workspaceIdSchema = z.string().describe('Workspace ID to use for this request');

const documentElementSchema = z.object({
  name: z.string().describe('Element system name (UUID)'),
  value: z.unknown().optional().describe('Element value'),
  visible: z.boolean().optional().describe('Whether element is visible'),
});

function getCredentialsOrError(workspaceId: string) {
  const credentials = getMcpWorkspaceCredentials(workspaceId);
  if (!credentials) {
    return { error: `Workspace "${workspaceId}" not found. Please configure a workspace first.` };
  }
  return { credentials };
}

export function registerDocumentTools(server: McpServer): void {
  // List Document Records
  server.tool(
    'legito_documents_list',
    'List all document records in the workspace',
    {
      workspaceId: workspaceIdSchema,
      search: z.string().optional().describe('Search query to filter documents'),
      limit: z.number().optional().describe('Maximum number of results'),
      offset: z.number().optional().describe('Number of results to skip'),
    },
    async ({ workspaceId, search, limit, offset }) => {
      const result = getCredentialsOrError(workspaceId);
      if ('error' in result) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: result.error }) }] };
      }

      const client = createLegitoMcpClient(result.credentials);
      const response = await client.listDocumentRecords({ search, limit, offset });
      return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
    }
  );

  // Search Documents
  server.tool(
    'legito_documents_search',
    'Search for documents by query',
    {
      workspaceId: workspaceIdSchema,
      query: z.string().describe('Search query'),
      limit: z.number().optional().default(20).describe('Maximum number of results'),
    },
    async ({ workspaceId, query, limit }) => {
      const result = getCredentialsOrError(workspaceId);
      if ('error' in result) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: result.error }) }] };
      }

      const client = createLegitoMcpClient(result.credentials);
      const response = await client.listDocumentRecords({ search: query, limit });
      return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
    }
  );

  // Create Document
  server.tool(
    'legito_documents_create',
    'Create a new document from a template suite',
    {
      workspaceId: workspaceIdSchema,
      templateSuiteId: z.number().describe('Template suite ID to create document from'),
      elements: z.array(documentElementSchema).describe('Array of element values to set'),
    },
    async ({ workspaceId, templateSuiteId, elements }) => {
      const result = getCredentialsOrError(workspaceId);
      if ('error' in result) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: result.error }) }] };
      }

      const client = createLegitoMcpClient(result.credentials);
      const response = await client.createDocument(templateSuiteId, elements);
      return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
    }
  );

  // Get Document Record
  server.tool(
    'legito_documents_get',
    'Get details of a specific document record by code',
    {
      workspaceId: workspaceIdSchema,
      code: z.string().describe('Document record code'),
    },
    async ({ workspaceId, code }) => {
      const result = getCredentialsOrError(workspaceId);
      if ('error' in result) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: result.error }) }] };
      }

      const client = createLegitoMcpClient(result.credentials);
      const response = await client.getDocumentRecord(code);
      return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
    }
  );

  // Get Document Elements
  server.tool(
    'legito_documents_get_elements',
    'Get element values of a document',
    {
      workspaceId: workspaceIdSchema,
      code: z.string().describe('Document record code'),
    },
    async ({ workspaceId, code }) => {
      const result = getCredentialsOrError(workspaceId);
      if ('error' in result) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: result.error }) }] };
      }

      const client = createLegitoMcpClient(result.credentials);
      const response = await client.getDocumentElements(code);
      return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
    }
  );

  // Update Document
  server.tool(
    'legito_documents_update',
    'Update element values of an existing document',
    {
      workspaceId: workspaceIdSchema,
      documentRecordCode: z.string().describe('Document record code'),
      elements: z.array(documentElementSchema).describe('Array of element updates'),
    },
    async ({ workspaceId, documentRecordCode, elements }) => {
      const result = getCredentialsOrError(workspaceId);
      if ('error' in result) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: result.error }) }] };
      }

      const client = createLegitoMcpClient(result.credentials);
      const response = await client.updateDocument(documentRecordCode, elements);
      return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
    }
  );

  // Delete Document
  server.tool(
    'legito_documents_delete',
    'Delete a document record from the workspace',
    {
      workspaceId: workspaceIdSchema,
      code: z.string().describe('Document record code to delete'),
    },
    async ({ workspaceId, code }) => {
      const result = getCredentialsOrError(workspaceId);
      if ('error' in result) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: result.error }) }] };
      }

      const client = createLegitoMcpClient(result.credentials);
      const response = await client.deleteDocumentRecord(code);
      return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
    }
  );

  // Anonymize Document
  server.tool(
    'legito_documents_anonymize',
    'Anonymize a document record (irreversible)',
    {
      workspaceId: workspaceIdSchema,
      code: z.string().describe('Document record code to anonymize'),
    },
    async ({ workspaceId, code }) => {
      const result = getCredentialsOrError(workspaceId);
      if ('error' in result) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: result.error }) }] };
      }

      const client = createLegitoMcpClient(result.credentials);
      const response = await client.anonymizeDocumentRecord(code);
      return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
    }
  );
}

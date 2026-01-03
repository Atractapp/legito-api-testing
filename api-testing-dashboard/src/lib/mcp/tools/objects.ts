/**
 * Object Tools
 * Tools for managing Legito object records
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { createLegitoMcpClient } from '../legito-mcp-client';
import { getMcpWorkspaceCredentials } from '@/store/mcp-store';

const workspaceIdSchema = z.string().describe('Workspace ID to use for this request');

const objectPropertySchema = z.object({
  systemName: z.string().describe('Property system name (UUID)'),
  value: z.unknown().describe('Property value'),
});

function getCredentialsOrError(workspaceId: string) {
  const credentials = getMcpWorkspaceCredentials(workspaceId);
  if (!credentials) {
    return { error: `Workspace "${workspaceId}" not found. Please configure a workspace first.` };
  }
  return { credentials };
}

export function registerObjectTools(server: McpServer): void {
  // List Objects (definitions)
  server.tool(
    'legito_objects_list_definitions',
    'List all object definitions in the workspace',
    { workspaceId: workspaceIdSchema },
    async ({ workspaceId }) => {
      const result = getCredentialsOrError(workspaceId);
      if ('error' in result) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: result.error }) }] };
      }

      const client = createLegitoMcpClient(result.credentials);
      const response = await client.listObjects();
      return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
    }
  );

  // List Object Records
  server.tool(
    'legito_objects_list',
    'List all object records for a specific object definition',
    {
      workspaceId: workspaceIdSchema,
      objectId: z.number().describe('Object definition ID'),
    },
    async ({ workspaceId, objectId }) => {
      const result = getCredentialsOrError(workspaceId);
      if ('error' in result) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: result.error }) }] };
      }

      const client = createLegitoMcpClient(result.credentials);
      const response = await client.listObjectRecords(objectId);
      return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
    }
  );

  // Create Object Record
  server.tool(
    'legito_objects_create',
    'Create a new object record',
    {
      workspaceId: workspaceIdSchema,
      objectId: z.number().describe('Object definition ID'),
      properties: z.array(objectPropertySchema).describe('Array of property values'),
    },
    async ({ workspaceId, objectId, properties }) => {
      const result = getCredentialsOrError(workspaceId);
      if ('error' in result) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: result.error }) }] };
      }

      const client = createLegitoMcpClient(result.credentials);
      const response = await client.createObjectRecord(objectId, properties);
      return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
    }
  );

  // Get Object Record
  server.tool(
    'legito_objects_get',
    'Get details of a specific object record by system name',
    {
      workspaceId: workspaceIdSchema,
      systemName: z.string().describe('Object record system name'),
    },
    async ({ workspaceId, systemName }) => {
      const result = getCredentialsOrError(workspaceId);
      if ('error' in result) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: result.error }) }] };
      }

      const client = createLegitoMcpClient(result.credentials);
      const response = await client.getObjectRecord(systemName);
      return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
    }
  );

  // Update Object Record
  server.tool(
    'legito_objects_update',
    'Update an existing object record',
    {
      workspaceId: workspaceIdSchema,
      systemName: z.string().describe('Object record system name'),
      properties: z.array(objectPropertySchema).describe('Array of property updates'),
    },
    async ({ workspaceId, systemName, properties }) => {
      const result = getCredentialsOrError(workspaceId);
      if ('error' in result) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: result.error }) }] };
      }

      const client = createLegitoMcpClient(result.credentials);
      const response = await client.updateObjectRecord(systemName, properties);
      return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
    }
  );

  // Delete Object Record
  server.tool(
    'legito_objects_delete',
    'Delete an object record from the workspace',
    {
      workspaceId: workspaceIdSchema,
      systemName: z.string().describe('Object record system name to delete'),
    },
    async ({ workspaceId, systemName }) => {
      const result = getCredentialsOrError(workspaceId);
      if ('error' in result) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: result.error }) }] };
      }

      const client = createLegitoMcpClient(result.credentials);
      const response = await client.deleteObjectRecord(systemName);
      return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
    }
  );
}

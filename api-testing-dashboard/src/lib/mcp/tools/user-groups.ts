/**
 * User Group Tools
 * Tools for managing Legito user groups
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { createLegitoMcpClient } from '../legito-mcp-client';
import { getMcpWorkspaceCredentials } from '@/store/mcp-store';

const workspaceIdSchema = z.string().describe('Workspace ID to use for this request');

function getCredentialsOrError(workspaceId: string) {
  const credentials = getMcpWorkspaceCredentials(workspaceId);
  if (!credentials) {
    return { error: `Workspace "${workspaceId}" not found. Please configure a workspace first.` };
  }
  return { credentials };
}

export function registerUserGroupTools(server: McpServer): void {
  // List User Groups
  server.tool(
    'legito_user_groups_list',
    'List all user groups in the workspace',
    { workspaceId: workspaceIdSchema },
    async ({ workspaceId }) => {
      const result = getCredentialsOrError(workspaceId);
      if ('error' in result) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: result.error }) }] };
      }

      const client = createLegitoMcpClient(result.credentials);
      const response = await client.listUserGroups();
      return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
    }
  );

  // Create User Group
  server.tool(
    'legito_user_groups_create',
    'Create a new user group',
    {
      workspaceId: workspaceIdSchema,
      name: z.string().describe('User group name'),
    },
    async ({ workspaceId, name }) => {
      const result = getCredentialsOrError(workspaceId);
      if ('error' in result) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: result.error }) }] };
      }

      const client = createLegitoMcpClient(result.credentials);
      const response = await client.createUserGroup({ name });
      return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
    }
  );

  // Get User Group
  server.tool(
    'legito_user_groups_get',
    'Get details of a specific user group by ID',
    {
      workspaceId: workspaceIdSchema,
      id: z.number().describe('User group ID'),
    },
    async ({ workspaceId, id }) => {
      const result = getCredentialsOrError(workspaceId);
      if ('error' in result) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: result.error }) }] };
      }

      const client = createLegitoMcpClient(result.credentials);
      const response = await client.getUserGroup(id);
      return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
    }
  );

  // Update User Group
  server.tool(
    'legito_user_groups_update',
    'Update an existing user group',
    {
      workspaceId: workspaceIdSchema,
      id: z.number().describe('User group ID'),
      name: z.string().describe('New user group name'),
    },
    async ({ workspaceId, id, name }) => {
      const result = getCredentialsOrError(workspaceId);
      if ('error' in result) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: result.error }) }] };
      }

      const client = createLegitoMcpClient(result.credentials);
      const response = await client.updateUserGroup(id, { name });
      return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
    }
  );

  // Delete User Group
  server.tool(
    'legito_user_groups_delete',
    'Delete a user group from the workspace',
    {
      workspaceId: workspaceIdSchema,
      id: z.number().describe('User group ID to delete'),
    },
    async ({ workspaceId, id }) => {
      const result = getCredentialsOrError(workspaceId);
      if ('error' in result) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: result.error }) }] };
      }

      const client = createLegitoMcpClient(result.credentials);
      const response = await client.deleteUserGroup(id);
      return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
    }
  );
}

/**
 * User Tools
 * Tools for managing Legito users
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

export function registerUserTools(server: McpServer): void {
  // List Users
  server.tool(
    'legito_users_list',
    'List all users in the workspace',
    { workspaceId: workspaceIdSchema },
    async ({ workspaceId }) => {
      const result = getCredentialsOrError(workspaceId);
      if ('error' in result) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: result.error }) }] };
      }

      const client = createLegitoMcpClient(result.credentials);
      const response = await client.listUsers();
      return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
    }
  );

  // Create User
  server.tool(
    'legito_users_create',
    'Create a new user in the workspace',
    {
      workspaceId: workspaceIdSchema,
      email: z.string().email().describe('User email address'),
      name: z.string().describe('User display name'),
      caption: z.string().optional().describe('User caption/title'),
      timezone: z.string().optional().describe('User timezone'),
      position: z.string().optional().describe('User position'),
    },
    async ({ workspaceId, email, name, caption, timezone, position }) => {
      const result = getCredentialsOrError(workspaceId);
      if ('error' in result) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: result.error }) }] };
      }

      const client = createLegitoMcpClient(result.credentials);
      // Legito expects an array of users
      const response = await client.createUsers([{ email, name, caption, timezone, position }]);
      return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
    }
  );

  // Get User
  server.tool(
    'legito_users_get',
    'Get details of a specific user by ID',
    {
      workspaceId: workspaceIdSchema,
      id: z.number().describe('User ID'),
    },
    async ({ workspaceId, id }) => {
      const result = getCredentialsOrError(workspaceId);
      if ('error' in result) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: result.error }) }] };
      }

      const client = createLegitoMcpClient(result.credentials);
      const response = await client.getUser(id);
      return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
    }
  );

  // Update User
  server.tool(
    'legito_users_update',
    'Update an existing user',
    {
      workspaceId: workspaceIdSchema,
      id: z.number().describe('User ID'),
      email: z.string().email().optional().describe('New email address'),
      name: z.string().optional().describe('New display name'),
      caption: z.string().optional().describe('New caption/title'),
      timezone: z.string().optional().describe('New timezone'),
      position: z.string().optional().describe('New position'),
    },
    async ({ workspaceId, id, email, name, caption, timezone, position }) => {
      const result = getCredentialsOrError(workspaceId);
      if ('error' in result) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: result.error }) }] };
      }

      const client = createLegitoMcpClient(result.credentials);
      const updateData: Record<string, unknown> = {};
      if (email !== undefined) updateData.email = email;
      if (name !== undefined) updateData.name = name;
      if (caption !== undefined) updateData.caption = caption;
      if (timezone !== undefined) updateData.timezone = timezone;
      if (position !== undefined) updateData.position = position;

      const response = await client.updateUser(id, updateData);
      return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
    }
  );

  // Delete User
  server.tool(
    'legito_users_delete',
    'Delete a user from the workspace',
    {
      workspaceId: workspaceIdSchema,
      id: z.number().describe('User ID to delete'),
    },
    async ({ workspaceId, id }) => {
      const result = getCredentialsOrError(workspaceId);
      if ('error' in result) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: result.error }) }] };
      }

      const client = createLegitoMcpClient(result.credentials);
      const response = await client.deleteUser(id);
      return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
    }
  );
}

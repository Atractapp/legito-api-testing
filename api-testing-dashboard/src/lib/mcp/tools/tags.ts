/**
 * Tag Tools
 * Tools for managing Legito template tags
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

export function registerTagTools(server: McpServer): void {
  // List Tags
  server.tool(
    'legito_tags_list',
    'List all template tags in the workspace',
    { workspaceId: workspaceIdSchema },
    async ({ workspaceId }) => {
      const result = getCredentialsOrError(workspaceId);
      if ('error' in result) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: result.error }) }] };
      }

      const client = createLegitoMcpClient(result.credentials);
      const response = await client.listTags();
      return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
    }
  );

  // Create Tag
  server.tool(
    'legito_tags_create',
    'Create a new template tag',
    {
      workspaceId: workspaceIdSchema,
      name: z.string().describe('Tag name'),
      color: z.string().optional().describe('Tag color (hex code like #FF0000)'),
      description: z.string().optional().describe('Tag description'),
    },
    async ({ workspaceId, name, color, description }) => {
      const result = getCredentialsOrError(workspaceId);
      if ('error' in result) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: result.error }) }] };
      }

      const client = createLegitoMcpClient(result.credentials);
      const response = await client.createTag({ name, color, description });
      return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
    }
  );

  // Get Tag
  server.tool(
    'legito_tags_get',
    'Get details of a specific tag by ID',
    {
      workspaceId: workspaceIdSchema,
      id: z.number().describe('Tag ID'),
    },
    async ({ workspaceId, id }) => {
      const result = getCredentialsOrError(workspaceId);
      if ('error' in result) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: result.error }) }] };
      }

      const client = createLegitoMcpClient(result.credentials);
      const response = await client.getTag(id);
      return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
    }
  );
}

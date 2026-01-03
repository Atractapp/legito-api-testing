/**
 * Template Tools
 * Tools for accessing Legito template information
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

export function registerTemplateTools(server: McpServer): void {
  // List Template Suites
  server.tool(
    'legito_templates_list_suites',
    'List all template suites in the workspace',
    { workspaceId: workspaceIdSchema },
    async ({ workspaceId }) => {
      const result = getCredentialsOrError(workspaceId);
      if ('error' in result) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: result.error }) }] };
      }

      const client = createLegitoMcpClient(result.credentials);
      const response = await client.listTemplateSuites();
      return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
    }
  );

  // Get Template Suite
  server.tool(
    'legito_templates_get_suite',
    'Get details of a specific template suite by ID',
    {
      workspaceId: workspaceIdSchema,
      id: z.number().describe('Template suite ID'),
    },
    async ({ workspaceId, id }) => {
      const result = getCredentialsOrError(workspaceId);
      if ('error' in result) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: result.error }) }] };
      }

      const client = createLegitoMcpClient(result.credentials);
      const response = await client.getTemplateSuite(id);
      return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
    }
  );

  // List Template Tags (alias for tag tools)
  server.tool(
    'legito_templates_list_tags',
    'List all template tags in the workspace (alias for legito_tags_list)',
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
}

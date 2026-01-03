/**
 * Sharing Tools
 * Tools for managing Legito document sharing
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { createLegitoMcpClient } from '../legito-mcp-client';
import { getMcpWorkspaceCredentials } from '@/store/mcp-store';

const workspaceIdSchema = z.string().describe('Workspace ID to use for this request');
const permissionSchema = z.enum(['EDIT', 'READ']).describe('Permission level');

function getCredentialsOrError(workspaceId: string) {
  const credentials = getMcpWorkspaceCredentials(workspaceId);
  if (!credentials) {
    return { error: `Workspace "${workspaceId}" not found. Please configure a workspace first.` };
  }
  return { credentials };
}

export function registerSharingTools(server: McpServer): void {
  // Share to User
  server.tool(
    'legito_sharing_share_to_user',
    'Share a document with a specific user',
    {
      workspaceId: workspaceIdSchema,
      documentCode: z.string().describe('Document record code'),
      userId: z.number().describe('User ID to share with'),
      permission: permissionSchema.optional().default('READ'),
    },
    async ({ workspaceId, documentCode, userId, permission }) => {
      const result = getCredentialsOrError(workspaceId);
      if ('error' in result) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: result.error }) }] };
      }

      const client = createLegitoMcpClient(result.credentials);
      const response = await client.shareToUser(documentCode, { id: userId, permission });
      return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
    }
  );

  // Share to Group
  server.tool(
    'legito_sharing_share_to_group',
    'Share a document with a user group',
    {
      workspaceId: workspaceIdSchema,
      documentCode: z.string().describe('Document record code'),
      groupId: z.number().describe('User group ID to share with'),
      permission: permissionSchema.optional().default('READ'),
    },
    async ({ workspaceId, documentCode, groupId, permission }) => {
      const result = getCredentialsOrError(workspaceId);
      if ('error' in result) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: result.error }) }] };
      }

      const client = createLegitoMcpClient(result.credentials);
      const response = await client.shareToGroup(documentCode, { id: groupId, permission });
      return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
    }
  );

  // Create External Link
  server.tool(
    'legito_sharing_create_link',
    'Create an external sharing link for a document',
    {
      workspaceId: workspaceIdSchema,
      documentCode: z.string().describe('Document record code'),
      active: z.boolean().optional().default(true).describe('Whether link is active'),
      permission: permissionSchema.optional().default('READ'),
      useMax: z.number().optional().default(0).describe('Maximum uses (0 for unlimited)'),
    },
    async ({ workspaceId, documentCode, active, permission, useMax }) => {
      const result = getCredentialsOrError(workspaceId);
      if ('error' in result) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: result.error }) }] };
      }

      const client = createLegitoMcpClient(result.credentials);
      const response = await client.createExternalLink(documentCode, {
        active,
        type: 'document',
        permission,
        useMax,
      });
      return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
    }
  );

  // List External Links
  server.tool(
    'legito_sharing_list_links',
    'List all external sharing links for a document',
    {
      workspaceId: workspaceIdSchema,
      documentCode: z.string().describe('Document record code'),
    },
    async ({ workspaceId, documentCode }) => {
      const result = getCredentialsOrError(workspaceId);
      if ('error' in result) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: result.error }) }] };
      }

      const client = createLegitoMcpClient(result.credentials);
      const response = await client.listExternalLinks(documentCode);
      return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
    }
  );

  // Delete External Link
  server.tool(
    'legito_sharing_delete_link',
    'Delete an external sharing link',
    {
      workspaceId: workspaceIdSchema,
      linkId: z.number().describe('External link ID to delete'),
    },
    async ({ workspaceId, linkId }) => {
      const result = getCredentialsOrError(workspaceId);
      if ('error' in result) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: result.error }) }] };
      }

      const client = createLegitoMcpClient(result.credentials);
      const response = await client.deleteExternalLink(linkId);
      return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
    }
  );
}

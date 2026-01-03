/**
 * MCP Server Setup
 * Configures and registers all Legito API tools
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerReferenceTools } from './tools/reference';
import { registerTagTools } from './tools/tags';
import { registerUserTools } from './tools/users';
import { registerUserGroupTools } from './tools/user-groups';
import { registerObjectTools } from './tools/objects';
import { registerDocumentTools } from './tools/documents';
import { registerSharingTools } from './tools/sharing';
import { registerTemplateTools } from './tools/templates';
import { registerWorkflowTools } from './tools/workflows';

/**
 * Initialize the MCP server with all Legito API tools
 */
export async function setupMcpServer(server: McpServer): Promise<void> {
  // Register tools in order of complexity (simplest first)
  registerReferenceTools(server);
  registerTagTools(server);
  registerUserTools(server);
  registerUserGroupTools(server);
  registerObjectTools(server);
  registerDocumentTools(server);
  registerSharingTools(server);
  registerTemplateTools(server);
  registerWorkflowTools(server);
}

/**
 * Server configuration
 */
export const serverInfo = {
  name: 'legito-mcp-server',
  version: '1.0.0',
};

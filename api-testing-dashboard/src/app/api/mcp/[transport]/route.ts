/**
 * MCP Route Handler
 * Handles MCP protocol requests using Streamable HTTP transport
 */

import { createMcpHandler } from 'mcp-handler';
import { setupMcpServer, serverInfo } from '@/lib/mcp';

const handler = createMcpHandler(
  setupMcpServer,
  {
    serverInfo,
  },
  {
    basePath: '/api/mcp',
    maxDuration: 60,
    verboseLogs: process.env.NODE_ENV === 'development',
    disableSse: true, // Use Streamable HTTP only (SSE is deprecated)
  }
);

export { handler as GET, handler as POST };

// Handle CORS preflight
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

/**
 * AI Chat API Route
 * Supports multiple AI providers (OpenAI, Anthropic Claude, Google Gemini)
 * with Legito API tools
 */

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText, tool, stepCountIs } from 'ai';
import { z } from 'zod';
import { createLegitoMcpClient, LegitoMcpClient } from '@/lib/mcp/legito-mcp-client';
import type { LegitoCredentials, McpRequestResult } from '@/types/mcp';

// Allow streaming responses up to 60 seconds
export const maxDuration = 60;

type AIProvider = 'openai' | 'anthropic' | 'google';

// Helper to get credentials from request headers
function getLegitoCredentials(request: Request): LegitoCredentials | null {
  const key = request.headers.get('X-Legito-Key');
  const privateKey = request.headers.get('X-Legito-Private-Key');
  const region = request.headers.get('X-Legito-Region') || 'emea';

  if (!key || !privateKey) {
    return null;
  }

  return {
    key,
    privateKey,
    region: region as LegitoCredentials['region'],
  };
}

// Get AI model based on provider
function getModel(provider: AIProvider, apiKey: string) {
  switch (provider) {
    case 'openai': {
      const client = createOpenAI({ apiKey });
      return client('gpt-4o-mini');
    }
    case 'anthropic': {
      const client = createAnthropic({ apiKey });
      return client('claude-sonnet-4-20250514');
    }
    case 'google': {
      const client = createGoogleGenerativeAI({ apiKey });
      return client('models/gemini-2.0-flash');
    }
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

// Helper to unwrap MCP result for AI tools
function unwrapResult<T>(result: McpRequestResult<T>): Record<string, unknown> {
  if (result.success && result.data !== undefined) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error || 'Unknown error' };
}

// Build Legito tools for the AI
function buildLegitoTools(client: LegitoMcpClient) {
  return {
    // Document tools
    listDocuments: tool({
      description: 'List all documents in the Legito workspace',
      inputSchema: z.object({
        search: z.string().optional().describe('Search query to filter documents'),
        limit: z.number().optional().describe('Maximum number of results'),
      }),
      execute: async (params) => {
        const result = await client.listDocumentRecords({ search: params.search, limit: params.limit });
        return unwrapResult(result);
      },
    }),

    getDocument: tool({
      description: 'Get details of a specific document by its code',
      inputSchema: z.object({
        code: z.string().describe('Document record code'),
      }),
      execute: async (params) => {
        const result = await client.getDocumentRecord(params.code);
        return unwrapResult(result);
      },
    }),

    // Template tools
    listTemplates: tool({
      description: 'List all available template suites for creating documents',
      inputSchema: z.object({}),
      execute: async () => {
        const result = await client.listTemplateSuites();
        return unwrapResult(result);
      },
    }),

    // User tools
    listUsers: tool({
      description: 'List all users in the Legito workspace',
      inputSchema: z.object({}),
      execute: async () => {
        const result = await client.listUsers();
        return unwrapResult(result);
      },
    }),

    getUser: tool({
      description: 'Get details of a specific user by ID',
      inputSchema: z.object({
        id: z.number().describe('User ID'),
      }),
      execute: async (params) => {
        const result = await client.getUser(params.id);
        return unwrapResult(result);
      },
    }),

    // Tag tools
    listTags: tool({
      description: 'List all template tags in the workspace',
      inputSchema: z.object({}),
      execute: async () => {
        const result = await client.listTags();
        return unwrapResult(result);
      },
    }),

    // Reference data tools
    getSystemInfo: tool({
      description: 'Get Legito system information',
      inputSchema: z.object({}),
      execute: async () => {
        const result = await client.getSystemInfo();
        return unwrapResult(result);
      },
    }),

    // Workflow tools
    listWorkflows: tool({
      description: 'List all workflows in the workspace',
      inputSchema: z.object({}),
      execute: async () => {
        const result = await client.listWorkflows();
        return unwrapResult(result);
      },
    }),

    // User group tools
    listUserGroups: tool({
      description: 'List all user groups in the workspace',
      inputSchema: z.object({}),
      execute: async () => {
        const result = await client.listUserGroups();
        return unwrapResult(result);
      },
    }),

    // External link/sharing tools
    createExternalLink: tool({
      description: 'Create an external sharing link for a document. Returns a URL that can be shared with external users.',
      inputSchema: z.object({
        documentCode: z.string().describe('Document record code'),
        active: z.boolean().optional().default(true).describe('Whether the link is active'),
        expiresAt: z.string().optional().describe('Expiration date in ISO format'),
      }),
      execute: async (params) => {
        const result = await client.createExternalLink(params.documentCode, {
          active: params.active,
          expiresAt: params.expiresAt,
        });
        return unwrapResult(result);
      },
    }),

    listExternalLinks: tool({
      description: 'List all external sharing links for a document',
      inputSchema: z.object({
        documentCode: z.string().describe('Document record code'),
      }),
      execute: async (params) => {
        const result = await client.listExternalLinks(params.documentCode);
        return unwrapResult(result);
      },
    }),

    deleteExternalLink: tool({
      description: 'Delete an external sharing link',
      inputSchema: z.object({
        linkId: z.number().describe('External link ID to delete'),
      }),
      execute: async (params) => {
        const result = await client.deleteExternalLink(params.linkId);
        return unwrapResult(result);
      },
    }),
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const messages = body.messages || [];
    const legitoCredentials = getLegitoCredentials(request);

    // Get AI provider settings from headers
    const provider = (request.headers.get('X-AI-Provider') || 'google') as AIProvider;
    const aiApiKey = request.headers.get('X-AI-API-Key');

    if (!aiApiKey) {
      return new Response(
        JSON.stringify({ error: `API key required for ${provider}` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create Legito client if credentials provided
    const client = legitoCredentials ? createLegitoMcpClient(legitoCredentials) : null;
    const legitoTools = client ? buildLegitoTools(client) : {};

    const systemPrompt = legitoCredentials
      ? `You are a helpful AI assistant with access to a Legito document management system. You can help users:
- Search and list documents using listDocuments
- Get document details with getDocument
- Create external sharing links with createExternalLink
- List external links for a document with listExternalLinks
- List templates, users, user groups, tags, and workflows
- Get system information

When users ask about documents, users, templates, sharing, or data - USE THE TOOLS to fetch real information from their Legito workspace.
Always be helpful and provide clear responses. Format data nicely using lists or tables.`
      : `You are a helpful AI assistant. To access Legito data, the user needs to configure their Legito API credentials in the MCP Workspaces settings.`;

    const model = getModel(provider, aiApiKey);

    // Use generateText with tools
    const { text } = await generateText({
      model,
      system: systemPrompt,
      messages,
      tools: legitoTools,
      maxRetries: 0,
      stopWhen: stepCountIs(5), // Allow up to 5 tool calls
    });

    return new Response(text, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch (error) {
    console.error('Chat API Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: `AI Provider Error: ${message}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

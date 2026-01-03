/**
 * AI Chat API Route
 * Supports multiple AI providers (OpenAI, Anthropic Claude, Google Gemini)
 * with Legito API tools
 */

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { streamText, stepCountIs } from 'ai';
import { tool, zodSchema } from '@ai-sdk/provider-utils';
import { z } from 'zod';
import { createLegitoMcpClient, LegitoMcpClient } from '@/lib/mcp/legito-mcp-client';
import type { LegitoCredentials, McpRequestResult } from '@/types/mcp';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

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
      return client('gemini-1.5-flash');
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
    listDocuments: tool<{ search?: string; limit?: number }, Record<string, unknown>>({
      description: 'List all documents in the Legito workspace',
      inputSchema: zodSchema(z.object({
        search: z.string().optional().describe('Search query to filter documents'),
        limit: z.number().optional().describe('Maximum number of results'),
      })),
      execute: async (params) => {
        const result = await client.listDocumentRecords({ search: params.search, limit: params.limit });
        return unwrapResult(result);
      },
    }),

    searchDocuments: tool<{ query: string }, Record<string, unknown>>({
      description: 'Search for documents by query',
      inputSchema: zodSchema(z.object({
        query: z.string().describe('Search query'),
      })),
      execute: async (params) => {
        const result = await client.listDocumentRecords({ search: params.query, limit: 20 });
        return unwrapResult(result);
      },
    }),

    getDocument: tool<{ code: string }, Record<string, unknown>>({
      description: 'Get details of a specific document by its code',
      inputSchema: zodSchema(z.object({
        code: z.string().describe('Document record code'),
      })),
      execute: async (params) => {
        const result = await client.getDocumentRecord(params.code);
        return unwrapResult(result);
      },
    }),

    getDocumentElements: tool<{ code: string }, Record<string, unknown>>({
      description: 'Get the element values (form fields) of a document',
      inputSchema: zodSchema(z.object({
        code: z.string().describe('Document record code'),
      })),
      execute: async (params) => {
        const result = await client.getDocumentElements(params.code);
        return unwrapResult(result);
      },
    }),

    // Template tools
    listTemplates: tool<Record<string, never>, Record<string, unknown>>({
      description: 'List all available template suites for creating documents',
      inputSchema: zodSchema(z.object({})),
      execute: async () => {
        const result = await client.listTemplateSuites();
        return unwrapResult(result);
      },
    }),

    // User tools
    listUsers: tool<Record<string, never>, Record<string, unknown>>({
      description: 'List all users in the workspace',
      inputSchema: zodSchema(z.object({})),
      execute: async () => {
        const result = await client.listUsers();
        return unwrapResult(result);
      },
    }),

    getUser: tool<{ id: number }, Record<string, unknown>>({
      description: 'Get details of a specific user by ID',
      inputSchema: zodSchema(z.object({
        id: z.number().describe('User ID'),
      })),
      execute: async (params) => {
        const result = await client.getUser(params.id);
        return unwrapResult(result);
      },
    }),

    // Tag tools
    listTags: tool<Record<string, never>, Record<string, unknown>>({
      description: 'List all template tags in the workspace',
      inputSchema: zodSchema(z.object({})),
      execute: async () => {
        const result = await client.listTags();
        return unwrapResult(result);
      },
    }),

    // Reference data tools
    getSystemInfo: tool<Record<string, never>, Record<string, unknown>>({
      description: 'Get Legito system information',
      inputSchema: zodSchema(z.object({})),
      execute: async () => {
        const result = await client.getSystemInfo();
        return unwrapResult(result);
      },
    }),

    listCountries: tool<Record<string, never>, Record<string, unknown>>({
      description: 'List all available countries',
      inputSchema: zodSchema(z.object({})),
      execute: async () => {
        const result = await client.listCountries();
        return unwrapResult(result);
      },
    }),

    listCurrencies: tool<Record<string, never>, Record<string, unknown>>({
      description: 'List all available currencies',
      inputSchema: zodSchema(z.object({})),
      execute: async () => {
        const result = await client.listCurrencies();
        return unwrapResult(result);
      },
    }),

    // Workflow tools
    listWorkflows: tool<Record<string, never>, Record<string, unknown>>({
      description: 'List all workflows in the workspace',
      inputSchema: zodSchema(z.object({})),
      execute: async () => {
        const result = await client.listWorkflows();
        return unwrapResult(result);
      },
    }),

    // Object tools
    listObjects: tool<Record<string, never>, Record<string, unknown>>({
      description: 'List all object definitions in the workspace',
      inputSchema: zodSchema(z.object({})),
      execute: async () => {
        const result = await client.listObjects();
        return unwrapResult(result);
      },
    }),

    listObjectRecords: tool<{ objectId: number }, Record<string, unknown>>({
      description: 'List object records for a specific object definition',
      inputSchema: zodSchema(z.object({
        objectId: z.number().describe('Object definition ID'),
      })),
      execute: async (params) => {
        const result = await client.listObjectRecords(params.objectId);
        return unwrapResult(result);
      },
    }),

    // User group tools
    listUserGroups: tool<Record<string, never>, Record<string, unknown>>({
      description: 'List all user groups in the workspace',
      inputSchema: zodSchema(z.object({})),
      execute: async () => {
        const result = await client.listUserGroups();
        return unwrapResult(result);
      },
    }),
  };
}

export async function POST(request: Request) {
  const { messages } = await request.json();
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
- Search and view documents
- List templates, users, tags, and workflows
- Get system information and reference data
- View object records and user groups

When users ask about documents or data, use the available tools to fetch real information from their Legito workspace.
Always be helpful and provide clear, concise responses. If a tool returns an error, explain it to the user.
Format data nicely when presenting results - use tables or lists where appropriate.`
    : `You are a helpful AI assistant. To access Legito data, the user needs to configure their Legito API credentials in the settings.
You can still answer general questions about Legito and document management.`;

  try {
    const model = getModel(provider, aiApiKey);

    const result = streamText({
      model,
      system: systemPrompt,
      messages,
      tools: legitoTools,
      stopWhen: stepCountIs(5), // Allow up to 5 tool calls in a conversation turn
    });

    return result.toTextStreamResponse();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: `AI Provider Error: ${message}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

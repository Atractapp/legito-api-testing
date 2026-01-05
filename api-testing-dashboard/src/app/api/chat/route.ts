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

// Build Legito tools for the AI - ALL available API methods
function buildLegitoTools(client: LegitoMcpClient) {
  return {
    // ============ DOCUMENT OPERATIONS ============
    createDocument: tool({
      description: 'Create a new document from a template suite. Returns the new document record code.',
      inputSchema: z.object({
        templateSuiteId: z.number().describe('Template suite ID to create document from'),
        elements: z.array(z.object({
          code: z.string().describe('Element code/identifier'),
          value: z.unknown().describe('Element value'),
        })).describe('Document elements/fields to populate'),
      }),
      execute: async (params) => {
        const result = await client.createDocument(params.templateSuiteId, params.elements);
        return unwrapResult(result);
      },
    }),

    updateDocument: tool({
      description: 'Update an existing document with new element values',
      inputSchema: z.object({
        documentRecordCode: z.string().describe('Document record code to update'),
        elements: z.array(z.object({
          code: z.string().describe('Element code/identifier'),
          value: z.unknown().describe('Element value'),
        })).describe('Document elements/fields to update'),
      }),
      execute: async (params) => {
        const result = await client.updateDocument(params.documentRecordCode, params.elements);
        return unwrapResult(result);
      },
    }),

    listDocuments: tool({
      description: 'List all documents in the Legito workspace',
      inputSchema: z.object({
        search: z.string().optional().describe('Search query to filter documents'),
        limit: z.number().optional().describe('Maximum number of results'),
        offset: z.number().optional().describe('Offset for pagination'),
      }),
      execute: async (params) => {
        const result = await client.listDocumentRecords(params);
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

    getDocumentElements: tool({
      description: 'Get all element values for a document',
      inputSchema: z.object({
        code: z.string().describe('Document record code'),
      }),
      execute: async (params) => {
        const result = await client.getDocumentElements(params.code);
        return unwrapResult(result);
      },
    }),

    deleteDocument: tool({
      description: 'Delete a document record',
      inputSchema: z.object({
        code: z.string().describe('Document record code to delete'),
      }),
      execute: async (params) => {
        const result = await client.deleteDocumentRecord(params.code);
        return unwrapResult(result);
      },
    }),

    anonymizeDocument: tool({
      description: 'Anonymize a document record (GDPR compliance)',
      inputSchema: z.object({
        code: z.string().describe('Document record code to anonymize'),
      }),
      execute: async (params) => {
        const result = await client.anonymizeDocumentRecord(params.code);
        return unwrapResult(result);
      },
    }),

    // ============ OBJECT OPERATIONS ============
    listObjects: tool({
      description: 'List all object definitions in the workspace',
      inputSchema: z.object({}),
      execute: async () => {
        const result = await client.listObjects();
        return unwrapResult(result);
      },
    }),

    listObjectRecords: tool({
      description: 'List all records for a specific object type',
      inputSchema: z.object({
        objectId: z.number().describe('Object definition ID'),
      }),
      execute: async (params) => {
        const result = await client.listObjectRecords(params.objectId);
        return unwrapResult(result);
      },
    }),

    getObjectRecord: tool({
      description: 'Get a specific object record by system name',
      inputSchema: z.object({
        systemName: z.string().describe('Object record system name'),
      }),
      execute: async (params) => {
        const result = await client.getObjectRecord(params.systemName);
        return unwrapResult(result);
      },
    }),

    createObjectRecord: tool({
      description: 'Create a new object record',
      inputSchema: z.object({
        objectId: z.number().describe('Object definition ID'),
        properties: z.array(z.object({
          code: z.string().describe('Property code'),
          value: z.unknown().describe('Property value'),
        })).describe('Object properties'),
      }),
      execute: async (params) => {
        const result = await client.createObjectRecord(params.objectId, params.properties);
        return unwrapResult(result);
      },
    }),

    updateObjectRecord: tool({
      description: 'Update an object record',
      inputSchema: z.object({
        systemName: z.string().describe('Object record system name'),
        properties: z.array(z.object({
          code: z.string().describe('Property code'),
          value: z.unknown().describe('Property value'),
        })).describe('Object properties to update'),
      }),
      execute: async (params) => {
        const result = await client.updateObjectRecord(params.systemName, params.properties);
        return unwrapResult(result);
      },
    }),

    deleteObjectRecord: tool({
      description: 'Delete an object record',
      inputSchema: z.object({
        systemName: z.string().describe('Object record system name to delete'),
      }),
      execute: async (params) => {
        const result = await client.deleteObjectRecord(params.systemName);
        return unwrapResult(result);
      },
    }),

    // ============ USER OPERATIONS ============
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

    createUsers: tool({
      description: 'Create one or more new users',
      inputSchema: z.object({
        users: z.array(z.object({
          email: z.string().describe('User email'),
          firstName: z.string().optional().describe('First name'),
          lastName: z.string().optional().describe('Last name'),
        })).describe('Array of users to create'),
      }),
      execute: async (params) => {
        const result = await client.createUsers(params.users);
        return unwrapResult(result);
      },
    }),

    updateUser: tool({
      description: 'Update a user',
      inputSchema: z.object({
        id: z.number().describe('User ID'),
        data: z.object({
          firstName: z.string().optional(),
          lastName: z.string().optional(),
          email: z.string().optional(),
        }).describe('User data to update'),
      }),
      execute: async (params) => {
        const result = await client.updateUser(params.id, params.data);
        return unwrapResult(result);
      },
    }),

    deleteUser: tool({
      description: 'Delete a user',
      inputSchema: z.object({
        id: z.number().describe('User ID to delete'),
      }),
      execute: async (params) => {
        const result = await client.deleteUser(params.id);
        return unwrapResult(result);
      },
    }),

    // ============ USER GROUP OPERATIONS ============
    listUserGroups: tool({
      description: 'List all user groups in the workspace',
      inputSchema: z.object({}),
      execute: async () => {
        const result = await client.listUserGroups();
        return unwrapResult(result);
      },
    }),

    getUserGroup: tool({
      description: 'Get details of a specific user group',
      inputSchema: z.object({
        id: z.number().describe('User group ID'),
      }),
      execute: async (params) => {
        const result = await client.getUserGroup(params.id);
        return unwrapResult(result);
      },
    }),

    createUserGroup: tool({
      description: 'Create a new user group',
      inputSchema: z.object({
        name: z.string().describe('Group name'),
        description: z.string().optional().describe('Group description'),
      }),
      execute: async (params) => {
        const result = await client.createUserGroup(params);
        return unwrapResult(result);
      },
    }),

    updateUserGroup: tool({
      description: 'Update a user group',
      inputSchema: z.object({
        id: z.number().describe('User group ID'),
        data: z.object({
          name: z.string().optional(),
          description: z.string().optional(),
        }).describe('Group data to update'),
      }),
      execute: async (params) => {
        const result = await client.updateUserGroup(params.id, params.data);
        return unwrapResult(result);
      },
    }),

    deleteUserGroup: tool({
      description: 'Delete a user group',
      inputSchema: z.object({
        id: z.number().describe('User group ID to delete'),
      }),
      execute: async (params) => {
        const result = await client.deleteUserGroup(params.id);
        return unwrapResult(result);
      },
    }),

    // ============ SHARING OPERATIONS ============
    shareToUser: tool({
      description: 'Share a document with a specific user',
      inputSchema: z.object({
        documentCode: z.string().describe('Document record code'),
        userId: z.number().describe('User ID to share with'),
        permission: z.enum(['read', 'write', 'admin']).optional().describe('Permission level'),
      }),
      execute: async (params) => {
        const result = await client.shareToUser(params.documentCode, {
          id: params.userId,
          permission: params.permission,
        });
        return unwrapResult(result);
      },
    }),

    shareToGroup: tool({
      description: 'Share a document with a user group',
      inputSchema: z.object({
        documentCode: z.string().describe('Document record code'),
        groupId: z.number().describe('User group ID to share with'),
        permission: z.enum(['read', 'write', 'admin']).optional().describe('Permission level'),
      }),
      execute: async (params) => {
        const result = await client.shareToGroup(params.documentCode, {
          id: params.groupId,
          permission: params.permission,
        });
        return unwrapResult(result);
      },
    }),

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

    // ============ TEMPLATE OPERATIONS ============
    listTemplates: tool({
      description: 'List all available template suites for creating documents',
      inputSchema: z.object({}),
      execute: async () => {
        const result = await client.listTemplateSuites();
        return unwrapResult(result);
      },
    }),

    getTemplate: tool({
      description: 'Get details of a specific template suite including its elements',
      inputSchema: z.object({
        id: z.number().describe('Template suite ID'),
      }),
      execute: async (params) => {
        const result = await client.getTemplateSuite(params.id);
        return unwrapResult(result);
      },
    }),

    // ============ TAG OPERATIONS ============
    listTags: tool({
      description: 'List all template tags in the workspace',
      inputSchema: z.object({}),
      execute: async () => {
        const result = await client.listTags();
        return unwrapResult(result);
      },
    }),

    getTag: tool({
      description: 'Get details of a specific tag',
      inputSchema: z.object({
        id: z.number().describe('Tag ID'),
      }),
      execute: async (params) => {
        const result = await client.getTag(params.id);
        return unwrapResult(result);
      },
    }),

    createTag: tool({
      description: 'Create a new template tag',
      inputSchema: z.object({
        name: z.string().describe('Tag name'),
        color: z.string().optional().describe('Tag color (hex code)'),
      }),
      execute: async (params) => {
        const result = await client.createTag(params);
        return unwrapResult(result);
      },
    }),

    // ============ WORKFLOW OPERATIONS ============
    listWorkflows: tool({
      description: 'List all workflows in the workspace',
      inputSchema: z.object({}),
      execute: async () => {
        const result = await client.listWorkflows();
        return unwrapResult(result);
      },
    }),

    getWorkflow: tool({
      description: 'Get details of a specific workflow',
      inputSchema: z.object({
        id: z.number().describe('Workflow ID'),
      }),
      execute: async (params) => {
        const result = await client.getWorkflow(params.id);
        return unwrapResult(result);
      },
    }),

    // ============ REFERENCE DATA ============
    getSystemInfo: tool({
      description: 'Get Legito system information',
      inputSchema: z.object({}),
      execute: async () => {
        const result = await client.getSystemInfo();
        return unwrapResult(result);
      },
    }),

    listCountries: tool({
      description: 'List all available countries',
      inputSchema: z.object({}),
      execute: async () => {
        const result = await client.listCountries();
        return unwrapResult(result);
      },
    }),

    listCurrencies: tool({
      description: 'List all available currencies',
      inputSchema: z.object({}),
      execute: async () => {
        const result = await client.listCurrencies();
        return unwrapResult(result);
      },
    }),

    listLanguages: tool({
      description: 'List all available languages',
      inputSchema: z.object({}),
      execute: async () => {
        const result = await client.listLanguages();
        return unwrapResult(result);
      },
    }),

    listTimezones: tool({
      description: 'List all available timezones',
      inputSchema: z.object({}),
      execute: async () => {
        const result = await client.listTimezones();
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
      ? `You are a helpful AI assistant with FULL access to a Legito document management system. You have 37 tools available:

DOCUMENTS: createDocument, updateDocument, listDocuments, getDocument, getDocumentElements, deleteDocument, anonymizeDocument
OBJECTS: listObjects, listObjectRecords, getObjectRecord, createObjectRecord, updateObjectRecord, deleteObjectRecord
USERS: listUsers, getUser, createUsers, updateUser, deleteUser
USER GROUPS: listUserGroups, getUserGroup, createUserGroup, updateUserGroup, deleteUserGroup
SHARING: shareToUser, shareToGroup, createExternalLink, listExternalLinks, deleteExternalLink
TEMPLATES: listTemplates, getTemplate
TAGS: listTags, getTag, createTag
WORKFLOWS: listWorkflows, getWorkflow
REFERENCE DATA: getSystemInfo, listCountries, listCurrencies, listLanguages, listTimezones

USE THE TOOLS to perform any requested action. To create a document:
1. Use listTemplates to find available templates
2. Use getTemplate to see required elements
3. Use createDocument with templateSuiteId and elements array

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

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
      description: 'Create a new document from a template suite ID. IMPORTANT: For option/choice elements, value MUST be UUID not label (e.g., use "6df8e483-..." not "B").',
      inputSchema: z.object({
        templateSuiteId: z.number().describe('Template suite ID (e.g. 64004)'),
        elements: z.array(z.object({
          name: z.string().describe('Element system name/code'),
          value: z.unknown().optional().describe('Element value. For options use UUID!'),
        })).optional().default([]).describe('Elements with values. Use UUIDs for option/choice types!'),
      }),
      execute: async (params) => {
        const result = await client.createDocument(params.templateSuiteId, params.elements || []);
        return unwrapResult(result);
      },
    }),

    updateDocument: tool({
      description: 'Update an existing document. IMPORTANT: For option/choice elements, value MUST be UUID not label (e.g., use "6df8e483-..." not "B").',
      inputSchema: z.object({
        documentRecordCode: z.string().describe('Document record code to update'),
        elements: z.array(z.object({
          name: z.string().describe('Element system name/code'),
          value: z.unknown().optional().describe('Element value. For options use UUID!'),
        })).optional().default([]).describe('Elements to update. Use UUIDs for option/choice types!'),
      }),
      execute: async (params) => {
        const result = await client.updateDocument(params.documentRecordCode, params.elements || []);
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

    updateDocumentMetadata: tool({
      description: 'Update document metadata like owner. Use PUT /document-record/{code} to change document owner.',
      inputSchema: z.object({
        documentRecordCode: z.string().describe('Document record code'),
        ownerId: z.number().optional().describe('New owner user ID'),
      }),
      execute: async (params) => {
        const body: Record<string, unknown> = {};
        if (params.ownerId) body.ownerId = params.ownerId;
        const result = await client.put(`/document-record/${params.documentRecordCode}`, body);
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
          name: z.string().describe('Property name/code'),
          value: z.unknown().optional().describe('Property value'),
        })).optional().default([]).describe('Object properties'),
      }),
      execute: async (params) => {
        const result = await client.createObjectRecord(params.objectId, params.properties || []);
        return unwrapResult(result);
      },
    }),

    updateObjectRecord: tool({
      description: 'Update an object record',
      inputSchema: z.object({
        systemName: z.string().describe('Object record system name'),
        properties: z.array(z.object({
          name: z.string().describe('Property name/code'),
          value: z.unknown().optional().describe('Property value'),
        })).optional().default([]).describe('Properties to update'),
      }),
      execute: async (params) => {
        const result = await client.updateObjectRecord(params.systemName, params.properties || []);
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
      description: 'Create new users. ALWAYS split full name into firstName and lastName (e.g., "John Doe" → firstName:"John", lastName:"Doe"). Include both firstName and lastName when user provides a name.',
      inputSchema: z.object({
        users: z.array(z.object({
          email: z.string().describe('User email'),
          firstName: z.string().optional().describe('First name (required if name provided)'),
          lastName: z.string().optional().describe('Last name (required if name provided)'),
        })).describe('Array of users to create with firstName/lastName split from full name'),
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
        permission: z.enum(['READ', 'EDIT']).optional().default('EDIT').describe('Permission level'),
      }),
      execute: async (params) => {
        // API expects array format: [{active, type, permission, useMax}]
        const result = await client.createExternalLink(params.documentCode, [{
          active: true,
          type: 'document',
          permission: params.permission,
          useMax: 0,
        }]);
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
      description: 'Search and list template suites. ALWAYS use search param to filter by name. Example: search="contractor" finds "Contractor Agreement". Excludes deleted templates.',
      inputSchema: z.object({
        search: z.string().optional().describe('Search term to filter templates by name. Use partial name like "contractor" or "agreement".'),
      }),
      execute: async (params) => {
        const result = await client.listTemplateSuites();
        if (result.success && Array.isArray(result.data)) {
          // Filter out deleted templates and templates with "do not use" in name
          type Template = { deleted?: number; name?: string; id?: number };
          let templates = (result.data as Template[]).filter((t) => {
            if (t.deleted === 1) return false;
            if (t.name?.toLowerCase().includes('do not use')) return false;
            return true;
          });
          if (params.search) {
            // Split search into words and match templates containing ALL words
            const searchWords = params.search.toLowerCase().split(/\s+/).filter(w => w.length > 2);
            templates = templates.filter((t) => {
              const name = t.name?.toLowerCase() || '';
              return searchWords.every(word => name.includes(word));
            });
          }
          // Return simplified data: just id and name
          const simplified = templates.map(t => ({ id: t.id, name: t.name }));
          return { success: true, data: simplified, count: simplified.length };
        }
        return unwrapResult(result);
      },
    }),

    getTemplate: tool({
      description: 'Get template element definitions by creating a temp document and reading its structure.',
      inputSchema: z.object({
        id: z.number().describe('Template suite ID'),
      }),
      execute: async (params) => {
        // Hardcoded elements for known templates
        if (params.id === 64004) {
          return {
            success: true,
            data: {
              id: 64004,
              name: 'Testing API',
              elements: [
                { name: 'doc-name', type: 'string', description: 'Document title' },
                { name: 'name', type: 'string', description: 'Person name' },
                { name: 'date', type: 'object', description: 'Date: {date:"YYYY-MM-DD", monthByWord:true}' },
                { name: 'switcher', type: 'boolean', description: 'Toggle on/off' },
                { name: 'option', type: 'uuid', description: 'Single option. A=f40c04d1-a10e-4ac6-886b-b0bcc352f769, B=6df8e483-31a9-4f66-a96a-3ca10ffa56a7, C=b233df25-49ce-4c23-89c2-a92244c0e625. MUST use UUID!' },
                { name: 'multi-option', type: 'uuid[]', description: 'Multi option array. B=2261e6fe-f68a-44c1-aec2-73e4156f582c, D=fcee8ee4-636e-4ed6-9576-7389691ace4f. MUST use UUIDs!' },
                { name: 'single-choice', type: 'uuid', description: 'Single choice. 2=3a8bc084-0316-421a-b202-90622f89670b. MUST use UUID!' },
                { name: 'multi-choice', type: 'uuid[]', description: 'Multi choice array. 3=48d93b60-a8be-40c6-b00d-5a9f5904148a, 4=202f5757-934a-4729-92e1-413a9e552cb1. MUST use UUIDs!' },
                { name: 'value', type: 'object', description: 'Money: {number:"12345", currency:1}' },
                { name: 'a', type: 'clause', description: 'Clause A visibility: {visible:true}' },
                { name: 'b', type: 'clause', description: 'Clause B visibility: {visible:true}' },
                { name: 'c', type: 'clause', description: 'Clause C visibility: {visible:true}' },
                { name: 'd', type: 'clause', description: 'Clause D visibility: {visible:true}' },
                { name: 'e', type: 'clause', description: 'Clause E visibility: {visible:true}' },
                { name: 'testing-object-name', type: 'integer', description: 'Object record ID (number)' },
              ],
            },
          };
        }

        // For other templates: create temp document, read elements, delete it
        try {
          // Create blank document from template
          const createResult = await client.createDocument(params.id, []);
          if (!createResult.success || !createResult.data) {
            return { success: false, error: `Failed to create temp document: ${createResult.error}` };
          }

          // Extract document code from response
          const docData = createResult.data as { code?: string };
          const docCode = docData.code;
          if (!docCode) {
            return { success: false, error: 'No document code returned' };
          }

          // Read document elements
          const elementsResult = await client.getDocumentElements(docCode);

          // Delete temp document
          await client.deleteDocumentRecord(docCode);

          if (!elementsResult.success) {
            return { success: false, error: `Failed to read elements: ${elementsResult.error}` };
          }

          // Parse elements from response - they come as array with name, value, type info
          const rawElements = elementsResult.data as Array<{ name?: string; code?: string; type?: string; value?: unknown }>;
          const elements = rawElements?.map((el) => ({
            name: el.name || el.code || 'unknown',
            type: el.type || typeof el.value || 'unknown',
            currentValue: el.value,
          })) || [];

          return {
            success: true,
            data: {
              id: params.id,
              elements,
              note: 'Elements discovered from template. Use element names to set values.',
            },
          };
        } catch (error) {
          return { success: false, error: `Element discovery failed: ${error instanceof Error ? error.message : 'Unknown error'}` };
        }
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
      ? `You are a Legito API assistant.

MANDATORY WORKFLOW FOR CREATING DOCUMENTS:

1. listTemplates(search="keyword") - find template
2. getTemplate(id) - get element names (REQUIRED before step 4!)
3. Map user data to elements from step 2
4. Show mapping and ask "Proceed?"
5. createDocument only after user says yes

FORBIDDEN:
- DO NOT call createDocument without first calling getTemplate
- DO NOT skip showing the element mapping confirmation
- DO NOT ask user for element codes - discover them via getTemplate

RULES:
- Use ONLY data user provided
- Create with partial data - empty fields OK
- "John Doe" for user → firstName:"John", lastName:"Doe"`
      : `You are a helpful AI assistant. To access Legito data, configure your Legito API credentials in MCP Workspaces settings.`;

    const model = getModel(provider, aiApiKey);

    // Use generateText with tools
    const { text } = await generateText({
      model,
      system: systemPrompt,
      messages,
      tools: legitoTools,
      maxRetries: 0,
      stopWhen: stepCountIs(8), // Allow more steps for complex workflows
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

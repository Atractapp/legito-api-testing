'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Search } from 'lucide-react';

interface Tool {
  name: string;
  description: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  endpoint: string;
  parameters: { name: string; type: string; required: boolean; description: string }[];
}

interface ToolCategory {
  name: string;
  description: string;
  tools: Tool[];
}

const TOOL_CATEGORIES: ToolCategory[] = [
  {
    name: 'Documents',
    description: 'Create, update, search, and manage documents',
    tools: [
      {
        name: 'legito_documents_list',
        description: 'List all document records in the workspace',
        method: 'GET',
        endpoint: '/document-record',
        parameters: [
          { name: 'workspaceId', type: 'string', required: true, description: 'Workspace ID' },
          { name: 'search', type: 'string', required: false, description: 'Search query' },
          { name: 'limit', type: 'number', required: false, description: 'Max results' },
          { name: 'offset', type: 'number', required: false, description: 'Skip results' },
        ],
      },
      {
        name: 'legito_documents_search',
        description: 'Search for documents by query',
        method: 'GET',
        endpoint: '/document-record?search=...',
        parameters: [
          { name: 'workspaceId', type: 'string', required: true, description: 'Workspace ID' },
          { name: 'query', type: 'string', required: true, description: 'Search query' },
          { name: 'limit', type: 'number', required: false, description: 'Max results (default 20)' },
        ],
      },
      {
        name: 'legito_documents_create',
        description: 'Create a new document from a template suite',
        method: 'POST',
        endpoint: '/document-version/data/{templateSuiteId}',
        parameters: [
          { name: 'workspaceId', type: 'string', required: true, description: 'Workspace ID' },
          { name: 'templateSuiteId', type: 'number', required: true, description: 'Template suite ID' },
          { name: 'elements', type: 'array', required: true, description: 'Element values array' },
        ],
      },
      {
        name: 'legito_documents_get',
        description: 'Get document record details by code',
        method: 'GET',
        endpoint: '/document-record/{code}',
        parameters: [
          { name: 'workspaceId', type: 'string', required: true, description: 'Workspace ID' },
          { name: 'code', type: 'string', required: true, description: 'Document record code' },
        ],
      },
      {
        name: 'legito_documents_get_elements',
        description: 'Get element values of a document',
        method: 'GET',
        endpoint: '/document-version/data/{code}',
        parameters: [
          { name: 'workspaceId', type: 'string', required: true, description: 'Workspace ID' },
          { name: 'code', type: 'string', required: true, description: 'Document record code' },
        ],
      },
      {
        name: 'legito_documents_update',
        description: 'Update element values of an existing document',
        method: 'PUT',
        endpoint: '/document-version/data/{code}',
        parameters: [
          { name: 'workspaceId', type: 'string', required: true, description: 'Workspace ID' },
          { name: 'documentRecordCode', type: 'string', required: true, description: 'Document code' },
          { name: 'elements', type: 'array', required: true, description: 'Element updates' },
        ],
      },
      {
        name: 'legito_documents_delete',
        description: 'Delete a document record',
        method: 'DELETE',
        endpoint: '/document-record/{code}',
        parameters: [
          { name: 'workspaceId', type: 'string', required: true, description: 'Workspace ID' },
          { name: 'code', type: 'string', required: true, description: 'Document code to delete' },
        ],
      },
      {
        name: 'legito_documents_anonymize',
        description: 'Anonymize a document record (irreversible)',
        method: 'GET',
        endpoint: '/document-record/anonymize/{code}',
        parameters: [
          { name: 'workspaceId', type: 'string', required: true, description: 'Workspace ID' },
          { name: 'code', type: 'string', required: true, description: 'Document code' },
        ],
      },
    ],
  },
  {
    name: 'Objects',
    description: 'Manage object records and definitions',
    tools: [
      {
        name: 'legito_objects_list_definitions',
        description: 'List all object definitions',
        method: 'GET',
        endpoint: '/object',
        parameters: [
          { name: 'workspaceId', type: 'string', required: true, description: 'Workspace ID' },
        ],
      },
      {
        name: 'legito_objects_list',
        description: 'List object records for a definition',
        method: 'GET',
        endpoint: '/object-record?objectId={id}',
        parameters: [
          { name: 'workspaceId', type: 'string', required: true, description: 'Workspace ID' },
          { name: 'objectId', type: 'number', required: true, description: 'Object definition ID' },
        ],
      },
      {
        name: 'legito_objects_create',
        description: 'Create a new object record',
        method: 'POST',
        endpoint: '/object-record/{objectId}',
        parameters: [
          { name: 'workspaceId', type: 'string', required: true, description: 'Workspace ID' },
          { name: 'objectId', type: 'number', required: true, description: 'Object definition ID' },
          { name: 'properties', type: 'array', required: true, description: 'Property values' },
        ],
      },
      {
        name: 'legito_objects_get',
        description: 'Get object record by system name',
        method: 'GET',
        endpoint: '/object-record/{systemName}',
        parameters: [
          { name: 'workspaceId', type: 'string', required: true, description: 'Workspace ID' },
          { name: 'systemName', type: 'string', required: true, description: 'System name' },
        ],
      },
      {
        name: 'legito_objects_update',
        description: 'Update an object record',
        method: 'PUT',
        endpoint: '/object-record/{systemName}',
        parameters: [
          { name: 'workspaceId', type: 'string', required: true, description: 'Workspace ID' },
          { name: 'systemName', type: 'string', required: true, description: 'System name' },
          { name: 'properties', type: 'array', required: true, description: 'Property updates' },
        ],
      },
      {
        name: 'legito_objects_delete',
        description: 'Delete an object record',
        method: 'DELETE',
        endpoint: '/object-record/{systemName}',
        parameters: [
          { name: 'workspaceId', type: 'string', required: true, description: 'Workspace ID' },
          { name: 'systemName', type: 'string', required: true, description: 'System name' },
        ],
      },
    ],
  },
  {
    name: 'Users',
    description: 'User management operations',
    tools: [
      {
        name: 'legito_users_list',
        description: 'List all users',
        method: 'GET',
        endpoint: '/user',
        parameters: [
          { name: 'workspaceId', type: 'string', required: true, description: 'Workspace ID' },
        ],
      },
      {
        name: 'legito_users_create',
        description: 'Create a new user',
        method: 'POST',
        endpoint: '/user',
        parameters: [
          { name: 'workspaceId', type: 'string', required: true, description: 'Workspace ID' },
          { name: 'email', type: 'string', required: true, description: 'Email address' },
          { name: 'name', type: 'string', required: true, description: 'Display name' },
          { name: 'caption', type: 'string', required: false, description: 'Caption/title' },
          { name: 'timezone', type: 'string', required: false, description: 'Timezone' },
          { name: 'position', type: 'string', required: false, description: 'Position' },
        ],
      },
      {
        name: 'legito_users_get',
        description: 'Get user by ID',
        method: 'GET',
        endpoint: '/user/{id}',
        parameters: [
          { name: 'workspaceId', type: 'string', required: true, description: 'Workspace ID' },
          { name: 'id', type: 'number', required: true, description: 'User ID' },
        ],
      },
      {
        name: 'legito_users_update',
        description: 'Update a user',
        method: 'PUT',
        endpoint: '/user/{id}',
        parameters: [
          { name: 'workspaceId', type: 'string', required: true, description: 'Workspace ID' },
          { name: 'id', type: 'number', required: true, description: 'User ID' },
          { name: 'email', type: 'string', required: false, description: 'New email' },
          { name: 'name', type: 'string', required: false, description: 'New name' },
        ],
      },
      {
        name: 'legito_users_delete',
        description: 'Delete a user',
        method: 'DELETE',
        endpoint: '/user/{id}',
        parameters: [
          { name: 'workspaceId', type: 'string', required: true, description: 'Workspace ID' },
          { name: 'id', type: 'number', required: true, description: 'User ID' },
        ],
      },
    ],
  },
  {
    name: 'User Groups',
    description: 'User group management',
    tools: [
      {
        name: 'legito_user_groups_list',
        description: 'List all user groups',
        method: 'GET',
        endpoint: '/user-group',
        parameters: [
          { name: 'workspaceId', type: 'string', required: true, description: 'Workspace ID' },
        ],
      },
      {
        name: 'legito_user_groups_create',
        description: 'Create a user group',
        method: 'POST',
        endpoint: '/user-group',
        parameters: [
          { name: 'workspaceId', type: 'string', required: true, description: 'Workspace ID' },
          { name: 'name', type: 'string', required: true, description: 'Group name' },
        ],
      },
      {
        name: 'legito_user_groups_get',
        description: 'Get user group by ID',
        method: 'GET',
        endpoint: '/user-group/{id}',
        parameters: [
          { name: 'workspaceId', type: 'string', required: true, description: 'Workspace ID' },
          { name: 'id', type: 'number', required: true, description: 'Group ID' },
        ],
      },
      {
        name: 'legito_user_groups_update',
        description: 'Update a user group',
        method: 'PUT',
        endpoint: '/user-group/{id}',
        parameters: [
          { name: 'workspaceId', type: 'string', required: true, description: 'Workspace ID' },
          { name: 'id', type: 'number', required: true, description: 'Group ID' },
          { name: 'name', type: 'string', required: true, description: 'New name' },
        ],
      },
      {
        name: 'legito_user_groups_delete',
        description: 'Delete a user group',
        method: 'DELETE',
        endpoint: '/user-group/{id}',
        parameters: [
          { name: 'workspaceId', type: 'string', required: true, description: 'Workspace ID' },
          { name: 'id', type: 'number', required: true, description: 'Group ID' },
        ],
      },
    ],
  },
  {
    name: 'Sharing',
    description: 'Document sharing and external links',
    tools: [
      {
        name: 'legito_sharing_share_to_user',
        description: 'Share document with a user',
        method: 'POST',
        endpoint: '/share/user/{code}',
        parameters: [
          { name: 'workspaceId', type: 'string', required: true, description: 'Workspace ID' },
          { name: 'documentCode', type: 'string', required: true, description: 'Document code' },
          { name: 'userId', type: 'number', required: true, description: 'User ID' },
          { name: 'permission', type: 'string', required: false, description: 'EDIT or READ' },
        ],
      },
      {
        name: 'legito_sharing_share_to_group',
        description: 'Share document with a group',
        method: 'POST',
        endpoint: '/share/user-group/{code}',
        parameters: [
          { name: 'workspaceId', type: 'string', required: true, description: 'Workspace ID' },
          { name: 'documentCode', type: 'string', required: true, description: 'Document code' },
          { name: 'groupId', type: 'number', required: true, description: 'Group ID' },
          { name: 'permission', type: 'string', required: false, description: 'EDIT or READ' },
        ],
      },
      {
        name: 'legito_sharing_create_link',
        description: 'Create external sharing link',
        method: 'POST',
        endpoint: '/share/external-link/{code}',
        parameters: [
          { name: 'workspaceId', type: 'string', required: true, description: 'Workspace ID' },
          { name: 'documentCode', type: 'string', required: true, description: 'Document code' },
          { name: 'active', type: 'boolean', required: false, description: 'Link active (default true)' },
          { name: 'permission', type: 'string', required: false, description: 'EDIT or READ' },
          { name: 'useMax', type: 'number', required: false, description: 'Max uses (0=unlimited)' },
        ],
      },
      {
        name: 'legito_sharing_list_links',
        description: 'List external links for document',
        method: 'GET',
        endpoint: '/share/external-link/{code}',
        parameters: [
          { name: 'workspaceId', type: 'string', required: true, description: 'Workspace ID' },
          { name: 'documentCode', type: 'string', required: true, description: 'Document code' },
        ],
      },
      {
        name: 'legito_sharing_delete_link',
        description: 'Delete external link',
        method: 'DELETE',
        endpoint: '/share/external-link/{id}',
        parameters: [
          { name: 'workspaceId', type: 'string', required: true, description: 'Workspace ID' },
          { name: 'linkId', type: 'number', required: true, description: 'Link ID' },
        ],
      },
    ],
  },
  {
    name: 'Templates',
    description: 'Template suite access',
    tools: [
      {
        name: 'legito_templates_list_suites',
        description: 'List all template suites',
        method: 'GET',
        endpoint: '/template-suite',
        parameters: [
          { name: 'workspaceId', type: 'string', required: true, description: 'Workspace ID' },
        ],
      },
      {
        name: 'legito_templates_get_suite',
        description: 'Get template suite by ID',
        method: 'GET',
        endpoint: '/template-suite/{id}',
        parameters: [
          { name: 'workspaceId', type: 'string', required: true, description: 'Workspace ID' },
          { name: 'id', type: 'number', required: true, description: 'Suite ID' },
        ],
      },
      {
        name: 'legito_templates_list_tags',
        description: 'List template tags',
        method: 'GET',
        endpoint: '/template-tag',
        parameters: [
          { name: 'workspaceId', type: 'string', required: true, description: 'Workspace ID' },
        ],
      },
    ],
  },
  {
    name: 'Tags',
    description: 'Tag management',
    tools: [
      {
        name: 'legito_tags_list',
        description: 'List all tags',
        method: 'GET',
        endpoint: '/template-tag',
        parameters: [
          { name: 'workspaceId', type: 'string', required: true, description: 'Workspace ID' },
        ],
      },
      {
        name: 'legito_tags_create',
        description: 'Create a new tag',
        method: 'POST',
        endpoint: '/template-tag',
        parameters: [
          { name: 'workspaceId', type: 'string', required: true, description: 'Workspace ID' },
          { name: 'name', type: 'string', required: true, description: 'Tag name' },
          { name: 'color', type: 'string', required: false, description: 'Hex color' },
          { name: 'description', type: 'string', required: false, description: 'Description' },
        ],
      },
      {
        name: 'legito_tags_get',
        description: 'Get tag by ID',
        method: 'GET',
        endpoint: '/template-tag/{id}',
        parameters: [
          { name: 'workspaceId', type: 'string', required: true, description: 'Workspace ID' },
          { name: 'id', type: 'number', required: true, description: 'Tag ID' },
        ],
      },
    ],
  },
  {
    name: 'Workflows',
    description: 'Workflow information',
    tools: [
      {
        name: 'legito_workflows_list',
        description: 'List all workflows',
        method: 'GET',
        endpoint: '/workflow',
        parameters: [
          { name: 'workspaceId', type: 'string', required: true, description: 'Workspace ID' },
        ],
      },
      {
        name: 'legito_workflows_get',
        description: 'Get workflow by ID',
        method: 'GET',
        endpoint: '/workflow/{id}',
        parameters: [
          { name: 'workspaceId', type: 'string', required: true, description: 'Workspace ID' },
          { name: 'id', type: 'number', required: true, description: 'Workflow ID' },
        ],
      },
    ],
  },
  {
    name: 'Reference',
    description: 'System info and reference data',
    tools: [
      {
        name: 'legito_info',
        description: 'Get system information',
        method: 'GET',
        endpoint: '/info',
        parameters: [
          { name: 'workspaceId', type: 'string', required: true, description: 'Workspace ID' },
        ],
      },
      {
        name: 'legito_countries',
        description: 'List all countries',
        method: 'GET',
        endpoint: '/country',
        parameters: [
          { name: 'workspaceId', type: 'string', required: true, description: 'Workspace ID' },
        ],
      },
      {
        name: 'legito_currencies',
        description: 'List all currencies',
        method: 'GET',
        endpoint: '/currency',
        parameters: [
          { name: 'workspaceId', type: 'string', required: true, description: 'Workspace ID' },
        ],
      },
      {
        name: 'legito_languages',
        description: 'List all languages',
        method: 'GET',
        endpoint: '/language',
        parameters: [
          { name: 'workspaceId', type: 'string', required: true, description: 'Workspace ID' },
        ],
      },
      {
        name: 'legito_timezones',
        description: 'List all timezones',
        method: 'GET',
        endpoint: '/timezone',
        parameters: [
          { name: 'workspaceId', type: 'string', required: true, description: 'Workspace ID' },
        ],
      },
    ],
  },
];

const METHOD_COLORS = {
  GET: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  POST: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  PUT: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  DELETE: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

export default function McpToolsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  const filteredCategories = TOOL_CATEGORIES.map((category) => ({
    ...category,
    tools: category.tools.filter(
      (tool) =>
        tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tool.description.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  })).filter(
    (category) =>
      (activeCategory === 'all' || category.name === activeCategory) &&
      category.tools.length > 0
  );

  const totalTools = TOOL_CATEGORIES.reduce((sum, cat) => sum + cat.tools.length, 0);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">MCP Tools Reference</h1>
        <p className="text-muted-foreground">
          {totalTools} tools available for Legito API operations
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search tools..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Category Tabs */}
      <Tabs value={activeCategory} onValueChange={setActiveCategory}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="all">All ({totalTools})</TabsTrigger>
          {TOOL_CATEGORIES.map((category) => (
            <TabsTrigger key={category.name} value={category.name}>
              {category.name} ({category.tools.length})
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeCategory} className="mt-6 space-y-6">
          {filteredCategories.map((category) => (
            <Card key={category.name}>
              <CardHeader>
                <CardTitle>{category.name}</CardTitle>
                <CardDescription>{category.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion type="multiple" className="w-full">
                  {category.tools.map((tool) => (
                    <AccordionItem key={tool.name} value={tool.name}>
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-3 text-left">
                          <Badge className={METHOD_COLORS[tool.method]}>
                            {tool.method}
                          </Badge>
                          <code className="font-mono text-sm">{tool.name}</code>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-4 pt-2">
                          <p className="text-muted-foreground">{tool.description}</p>

                          <div>
                            <p className="text-sm font-medium mb-1">Endpoint:</p>
                            <code className="text-sm bg-muted px-2 py-1 rounded">
                              {tool.endpoint}
                            </code>
                          </div>

                          <div>
                            <p className="text-sm font-medium mb-2">Parameters:</p>
                            <div className="border rounded-lg overflow-hidden">
                              <table className="w-full text-sm">
                                <thead className="bg-muted">
                                  <tr>
                                    <th className="text-left px-3 py-2">Name</th>
                                    <th className="text-left px-3 py-2">Type</th>
                                    <th className="text-left px-3 py-2">Required</th>
                                    <th className="text-left px-3 py-2">Description</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {tool.parameters.map((param) => (
                                    <tr key={param.name} className="border-t">
                                      <td className="px-3 py-2">
                                        <code>{param.name}</code>
                                      </td>
                                      <td className="px-3 py-2 text-muted-foreground">
                                        {param.type}
                                      </td>
                                      <td className="px-3 py-2">
                                        {param.required ? (
                                          <Badge variant="default" className="text-xs">
                                            Yes
                                          </Badge>
                                        ) : (
                                          <Badge variant="outline" className="text-xs">
                                            No
                                          </Badge>
                                        )}
                                      </td>
                                      <td className="px-3 py-2 text-muted-foreground">
                                        {param.description}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

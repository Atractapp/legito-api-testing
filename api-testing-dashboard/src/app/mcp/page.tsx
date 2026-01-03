'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Plug,
  Server,
  Wrench,
  KeyRound,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { useMcpStore, useMcpWorkspaces, useMcpServerStatus } from '@/store/mcp-store';
import Link from 'next/link';

const TOOL_CATEGORIES = [
  { name: 'Documents', count: 8, description: 'Create, update, search, delete documents' },
  { name: 'Objects', count: 6, description: 'Manage object records' },
  { name: 'Users', count: 5, description: 'User CRUD operations' },
  { name: 'User Groups', count: 5, description: 'User group management' },
  { name: 'Sharing', count: 5, description: 'Document sharing and external links' },
  { name: 'Templates', count: 3, description: 'Template suite access' },
  { name: 'Tags', count: 3, description: 'Tag management' },
  { name: 'Workflows', count: 2, description: 'Workflow information' },
  { name: 'Reference', count: 5, description: 'System info, countries, currencies' },
];

const TOTAL_TOOLS = TOOL_CATEGORIES.reduce((sum, cat) => sum + cat.count, 0);

export default function McpDashboardPage() {
  const workspaces = useMcpWorkspaces();
  const { status: serverStatus } = useMcpServerStatus();
  const [copied, setCopied] = useState(false);

  const connectedCount = workspaces.filter(w => w.connectionStatus === 'connected').length;

  const mcpUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/mcp/mcp`
    : '/api/mcp/mcp';

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(mcpUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">MCP Server</h1>
          <p className="text-muted-foreground">
            Model Context Protocol interface for AI assistants
          </p>
        </div>
        <Badge
          variant={serverStatus === 'running' ? 'default' : 'secondary'}
          className="text-sm"
        >
          <Server className="w-4 h-4 mr-1" />
          {serverStatus === 'running' ? 'Online' : 'Ready'}
        </Badge>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tools</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{TOTAL_TOOLS}</div>
            <p className="text-xs text-muted-foreground">
              Across {TOOL_CATEGORIES.length} categories
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Workspaces</CardTitle>
            <KeyRound className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{workspaces.length}</div>
            <p className="text-xs text-muted-foreground">
              {connectedCount} connected
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            <Plug className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <span className="text-lg font-medium">Ready</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Streamable HTTP transport
            </p>
          </CardContent>
        </Card>
      </div>

      {/* MCP Connection URL */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">MCP Connection</CardTitle>
          <CardDescription>
            Use this URL to connect Claude Desktop or other MCP clients
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <code className="flex-1 p-3 bg-muted rounded-md font-mono text-sm">
              {mcpUrl}
            </code>
            <Button variant="outline" size="icon" onClick={copyToClipboard}>
              {copied ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>

          <div className="text-sm text-muted-foreground">
            <p className="font-medium mb-2">Claude Desktop Configuration:</p>
            <pre className="p-3 bg-muted rounded-md overflow-x-auto">
{`{
  "mcpServers": {
    "legito": {
      "url": "${mcpUrl}"
    }
  }
}`}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Workspaces Overview */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Workspaces</CardTitle>
            <CardDescription>
              Configure Legito API credentials for each workspace
            </CardDescription>
          </div>
          <Button asChild>
            <Link href="/mcp/workspaces">
              Manage Workspaces
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {workspaces.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <KeyRound className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No workspaces configured yet.</p>
              <p className="text-sm">Add a workspace to start using MCP tools.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {workspaces.map((ws) => (
                <div
                  key={ws.workspace.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    {ws.connectionStatus === 'connected' ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : ws.connectionStatus === 'error' ? (
                      <XCircle className="h-5 w-5 text-red-500" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-yellow-500" />
                    )}
                    <div>
                      <p className="font-medium">{ws.workspace.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {ws.workspace.credentials.region.toUpperCase()} region
                        {ws.workspace.isDefault && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            Default
                          </Badge>
                        )}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={
                      ws.connectionStatus === 'connected'
                        ? 'default'
                        : ws.connectionStatus === 'error'
                          ? 'destructive'
                          : 'secondary'
                    }
                  >
                    {ws.connectionStatus}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tool Categories */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Available Tools</CardTitle>
            <CardDescription>
              {TOTAL_TOOLS} MCP tools for Legito API operations
            </CardDescription>
          </div>
          <Button variant="outline" asChild>
            <Link href="/mcp/tools">
              View All Tools
              <ExternalLink className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            {TOOL_CATEGORIES.map((category) => (
              <div
                key={category.name}
                className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">{category.name}</span>
                  <Badge variant="secondary">{category.count}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {category.description}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

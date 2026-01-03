/**
 * MCP Server Types for Legito API Integration
 */

import type { LegitoRegion, LegitoCredentials } from './tagger';

// Re-export shared types
export type { LegitoRegion, LegitoCredentials };

/**
 * MCP workspace configuration with unique ID
 */
export interface McpWorkspace {
  id: string;
  name: string;
  credentials: LegitoCredentials;
  isDefault?: boolean;
}

/**
 * MCP workspace connection status
 */
export type McpConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * MCP workspace state with connection info
 */
export interface McpWorkspaceState {
  workspace: McpWorkspace;
  connectionStatus: McpConnectionStatus;
  lastConnected?: Date;
  errorMessage?: string;
}

/**
 * MCP server status
 */
export type McpServerStatus = 'stopped' | 'starting' | 'running' | 'error';

/**
 * Tool category for grouping in UI
 */
export type ToolCategory =
  | 'documents'
  | 'objects'
  | 'users'
  | 'user-groups'
  | 'sharing'
  | 'templates'
  | 'tags'
  | 'workflows'
  | 'reference';

/**
 * Tool definition for documentation
 */
export interface ToolDefinition {
  name: string;
  category: ToolCategory;
  description: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  endpoint: string;
  parameters: ToolParameter[];
}

/**
 * Tool parameter definition
 */
export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  description: string;
}

/**
 * MCP request result
 */
export interface McpRequestResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  status?: number;
  duration?: number;
}

/**
 * Legito API response types
 */

// Document types
export interface LegitoDocumentRecord {
  id?: number;
  code?: string;
  name?: string;
  templateSuiteId?: number;
  templateSuiteName?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LegitoDocumentElement {
  name: string;
  value?: unknown;
  visible?: boolean;
}

// Object types
export interface LegitoObject {
  id: number;
  name: string;
  systemName: string;
}

export interface LegitoObjectRecord {
  id?: number;
  systemName?: string;
  name?: string;
  properties?: LegitoObjectProperty[];
}

export interface LegitoObjectProperty {
  systemName: string;
  value: unknown;
}

// User types
export interface LegitoUser {
  id?: number;
  email?: string;
  name?: string;
  caption?: string;
  timezone?: string;
  position?: string;
}

// User group types
export interface LegitoUserGroup {
  id?: number;
  name?: string;
}

// Sharing types
export interface LegitoSharePayload {
  id: number;
  permission?: 'EDIT' | 'READ';
}

export interface LegitoExternalLink {
  id?: number;
  token?: string;
  code?: string;
  hash?: string;
  url?: string;
  link?: string;
  shareUrl?: string;
  active?: boolean;
}

export interface LegitoExternalLinkPayload {
  active: boolean;
  type: 'document';
  permission: 'EDIT' | 'READ';
  useMax: number;
}

// Template types
export interface LegitoTemplateSuite {
  id: number;
  name: string;
  description?: string;
}

export interface LegitoTemplateTag {
  id: number;
  name: string;
  system?: boolean;
  color?: string;
}

// Workflow types
export interface LegitoWorkflow {
  id: number;
  name: string;
  description?: string;
}

// Reference data types
export interface LegitoSystemInfo {
  version?: string;
  region?: string;
}

export interface LegitoCountry {
  id: number;
  name: string;
  code: string;
}

export interface LegitoCurrency {
  id: number;
  name: string;
  code: string;
  symbol?: string;
}

export interface LegitoLanguage {
  id: number;
  name: string;
  code: string;
}

export interface LegitoTimezone {
  id: number;
  name: string;
  offset?: string;
}

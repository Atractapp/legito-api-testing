'use client';

import { generateJWT, legitoRequest } from './legito-api';
import type { WorkspaceResources, TemplateResource, ObjectResource, TemplateElement } from '@/types';

export interface ScanCredentials {
  apiKey: string;
  privateKey: string;
  baseUrl: string;
  region: string;
}

export interface ScanProgress {
  step: string;
  current: number;
  total: number;
  status: 'scanning' | 'completed' | 'error';
  message?: string;
}

/**
 * Scans a Legito workspace and retrieves all available resources
 */
export async function scanWorkspace(
  credentials: ScanCredentials,
  onProgress?: (progress: ScanProgress) => void
): Promise<WorkspaceResources> {
  const report = (step: string, current: number, total: number, status: 'scanning' | 'completed' | 'error' = 'scanning', message?: string) => {
    onProgress?.({ step, current, total, status, message });
  };

  // Generate JWT for authentication
  const jwt = await generateJWT({ apiKey: credentials.apiKey, privateKey: credentials.privateKey });

  const resources: WorkspaceResources = {
    id: crypto.randomUUID(),
    apiKeyHash: await hashApiKey(credentials.apiKey),
    region: credentials.region,
    templates: [],
    objects: [],
    documents: [],
    users: [],
    userGroups: [],
    scannedAt: new Date().toISOString(),
    scanStatus: 'scanning',
  };

  try {
    // Step 1: Fetch templates (template-suite)
    report('templates', 0, 5);
    resources.templates = await fetchTemplates(jwt, credentials.baseUrl);
    report('templates', 1, 5, 'completed', `Found ${resources.templates.length} templates`);

    // Step 2: Fetch objects (Smart Records schemas)
    report('objects', 1, 5);
    resources.objects = await fetchObjects(jwt, credentials.baseUrl);
    report('objects', 2, 5, 'completed', `Found ${resources.objects.length} objects`);

    // Step 3: Fetch recent documents
    report('documents', 2, 5);
    resources.documents = await fetchDocuments(jwt, credentials.baseUrl, 20);
    report('documents', 3, 5, 'completed', `Found ${resources.documents.length} documents`);

    // Step 4: Fetch users
    report('users', 3, 5);
    resources.users = await fetchUsers(jwt, credentials.baseUrl);
    report('users', 4, 5, 'completed', `Found ${resources.users.length} users`);

    // Step 5: Fetch user groups
    report('userGroups', 4, 5);
    resources.userGroups = await fetchUserGroups(jwt, credentials.baseUrl);
    report('userGroups', 5, 5, 'completed', `Found ${resources.userGroups.length} user groups`);

    resources.scanStatus = 'completed';
    return resources;
  } catch (error) {
    console.error('Error scanning workspace:', error);
    resources.scanStatus = 'failed';
    report('error', 0, 0, 'error', error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
}

/**
 * Fetches all document templates from the workspace
 * Legito API endpoint: /template-suite
 */
async function fetchTemplates(jwt: string, baseUrl: string): Promise<TemplateResource[]> {
  const response = await legitoRequest<RawTemplate[]>('/template-suite', {
    method: 'GET',
    jwt,
    baseUrl,
  });

  if (!response.success || !response.data) {
    console.warn('Failed to fetch templates:', response.error);
    return [];
  }

  // API returns array directly
  const templateList = Array.isArray(response.data) ? response.data : [];
  const templates: TemplateResource[] = [];

  for (const template of templateList) {
    // For now, don't fetch elements for each template (too many API calls)
    // Elements can be fetched on-demand when user selects a template
    templates.push({
      id: template.id,
      name: template.name,
      elements: [], // Will be populated on demand
    });
  }

  return templates;
}

/**
 * Fetches all Smart Records objects (schemas) from the workspace
 * Legito API endpoint: /object
 */
async function fetchObjects(jwt: string, baseUrl: string): Promise<ObjectResource[]> {
  const response = await legitoRequest<RawObject[]>('/object', {
    method: 'GET',
    jwt,
    baseUrl,
  });

  if (!response.success || !response.data) {
    console.warn('Failed to fetch objects:', response.error);
    return [];
  }

  // API returns array directly
  const objectList = Array.isArray(response.data) ? response.data : [];
  const objects: ObjectResource[] = [];

  for (const obj of objectList) {
    objects.push({
      id: obj.id,
      name: obj.name,
      properties: [], // Will be populated on demand
    });
  }

  return objects;
}

/**
 * Fetches recent documents from the workspace
 * Legito API endpoint: /document-record
 */
async function fetchDocuments(jwt: string, baseUrl: string, limit = 20): Promise<DocumentResource[]> {
  const response = await legitoRequest<RawDocument[]>(`/document-record?limit=${limit}`, {
    method: 'GET',
    jwt,
    baseUrl,
  });

  if (!response.success || !response.data) {
    console.warn('Failed to fetch documents:', response.error);
    return [];
  }

  // API returns array directly
  const docList = Array.isArray(response.data) ? response.data : [];

  return docList.map(doc => ({
    id: doc.id,
    name: doc.name || doc.code || `Document ${doc.id}`,
    templateId: doc.templateSuiteId || doc.template_suite_id,
    status: doc.status || 'unknown',
    createdAt: doc.createdAt || doc.created_at,
  }));
}

/**
 * Fetches all users from the workspace
 * Legito API endpoint: /user
 */
async function fetchUsers(jwt: string, baseUrl: string): Promise<UserResource[]> {
  const response = await legitoRequest<RawUser[]>('/user', {
    method: 'GET',
    jwt,
    baseUrl,
  });

  if (!response.success || !response.data) {
    console.warn('Failed to fetch users:', response.error);
    return [];
  }

  // API returns array directly
  const userList = Array.isArray(response.data) ? response.data : [];

  return userList.map(user => ({
    id: user.id,
    email: user.email,
    firstName: user.firstName || user.first_name || '',
    lastName: user.lastName || user.last_name || '',
    role: user.role || 'user',
  }));
}

/**
 * Fetches all user groups from the workspace
 * Legito API endpoint: /user-group
 */
async function fetchUserGroups(jwt: string, baseUrl: string): Promise<UserGroupResource[]> {
  const response = await legitoRequest<RawUserGroup[]>('/user-group', {
    method: 'GET',
    jwt,
    baseUrl,
  });

  if (!response.success || !response.data) {
    console.warn('Failed to fetch user groups:', response.error);
    return [];
  }

  // API returns array directly
  const groupList = Array.isArray(response.data) ? response.data : [];

  return groupList.map(group => ({
    id: group.id,
    name: group.name,
    description: group.description || '',
    memberCount: group.memberCount || group.member_count || 0,
  }));
}

/**
 * Hashes an API key for storage (we don't store the actual key in workspace_resources)
 */
async function hashApiKey(apiKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 64);
}

// Raw API response types
interface RawTemplate {
  id: number;
  name: string;
}

interface RawObject {
  id: number;
  name: string;
}

interface RawDocument {
  id: number;
  name?: string;
  code?: string;
  templateSuiteId?: number;
  template_suite_id?: number;
  status?: string;
  createdAt?: string;
  created_at?: string;
}

interface RawUser {
  id: number;
  email: string;
  firstName?: string;
  first_name?: string;
  lastName?: string;
  last_name?: string;
  role?: string;
}

interface RawUserGroup {
  id: number;
  name: string;
  description?: string;
  memberCount?: number;
  member_count?: number;
}

// Re-export types for consumers
export interface DocumentResource {
  id: number;
  name: string;
  templateId?: number;
  status: string;
  createdAt?: string;
}

export interface UserResource {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

export interface UserGroupResource {
  id: number;
  name: string;
  description: string;
  memberCount: number;
}

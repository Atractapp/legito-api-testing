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
    // Step 1: Fetch templates
    report('templates', 0, 5);
    resources.templates = await fetchTemplates(jwt, credentials.baseUrl);
    report('templates', 1, 5, 'completed', `Found ${resources.templates.length} templates`);

    // Step 2: Fetch objects (Smart Records schemas)
    report('objects', 1, 5);
    resources.objects = await fetchObjects(jwt, credentials.baseUrl);
    report('objects', 2, 5, 'completed', `Found ${resources.objects.length} objects`);

    // Step 3: Fetch recent documents (sample)
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
 */
async function fetchTemplates(jwt: string, baseUrl: string): Promise<TemplateResource[]> {
  const response = await legitoRequest<{ data: RawTemplate[] }>('/templates', {
    method: 'GET',
    jwt,
    baseUrl,
  });

  if (!response.success || !response.data?.data) {
    console.warn('Failed to fetch templates:', response.error);
    return [];
  }

  const templates: TemplateResource[] = [];

  for (const template of response.data.data) {
    // Fetch elements for each template
    const elementsResponse = await legitoRequest<{ data: RawElement[] }>(
      `/templates/${template.id}/elements`,
      { method: 'GET', jwt, baseUrl }
    );

    const elements: TemplateElement[] = (elementsResponse.data?.data || []).map(el => ({
      id: el.id,
      name: el.name,
      type: el.type,
      uuid: el.uuid,
      options: el.options?.map((opt: { uuid: string; name: string }) => ({
        uuid: opt.uuid,
        label: opt.name,
      })),
    }));

    templates.push({
      id: template.id,
      name: template.name,
      elements,
    });
  }

  return templates;
}

/**
 * Fetches all Smart Records objects (schemas) from the workspace
 */
async function fetchObjects(jwt: string, baseUrl: string): Promise<ObjectResource[]> {
  const response = await legitoRequest<{ data: RawObject[] }>('/smart-records/objects', {
    method: 'GET',
    jwt,
    baseUrl,
  });

  if (!response.success || !response.data?.data) {
    console.warn('Failed to fetch objects:', response.error);
    return [];
  }

  const objects: ObjectResource[] = [];

  for (const obj of response.data.data) {
    // Fetch properties for each object
    const propsResponse = await legitoRequest<{ data: RawProperty[] }>(
      `/smart-records/objects/${obj.id}/properties`,
      { method: 'GET', jwt, baseUrl }
    );

    const properties = (propsResponse.data?.data || []).map(prop => ({
      id: prop.id,
      name: prop.name,
      systemName: prop.systemName || prop.system_name || '',
      type: prop.type,
    }));

    objects.push({
      id: obj.id,
      name: obj.name,
      properties,
    });
  }

  return objects;
}

/**
 * Fetches recent documents from the workspace (for testing purposes)
 */
async function fetchDocuments(jwt: string, baseUrl: string, limit = 20): Promise<DocumentResource[]> {
  const response = await legitoRequest<{ data: RawDocument[] }>(`/documents?limit=${limit}`, {
    method: 'GET',
    jwt,
    baseUrl,
  });

  if (!response.success || !response.data?.data) {
    console.warn('Failed to fetch documents:', response.error);
    return [];
  }

  return response.data.data.map(doc => ({
    id: doc.id,
    name: doc.name,
    templateId: doc.templateId || doc.template_id,
    status: doc.status,
    createdAt: doc.createdAt || doc.created_at,
  }));
}

/**
 * Fetches all users from the workspace
 */
async function fetchUsers(jwt: string, baseUrl: string): Promise<UserResource[]> {
  const response = await legitoRequest<{ data: RawUser[] }>('/users', {
    method: 'GET',
    jwt,
    baseUrl,
  });

  if (!response.success || !response.data?.data) {
    console.warn('Failed to fetch users:', response.error);
    return [];
  }

  return response.data.data.map(user => ({
    id: user.id,
    email: user.email,
    firstName: user.firstName || user.first_name || '',
    lastName: user.lastName || user.last_name || '',
    role: user.role || 'user',
  }));
}

/**
 * Fetches all user groups from the workspace
 */
async function fetchUserGroups(jwt: string, baseUrl: string): Promise<UserGroupResource[]> {
  const response = await legitoRequest<{ data: RawUserGroup[] }>('/user-groups', {
    method: 'GET',
    jwt,
    baseUrl,
  });

  if (!response.success || !response.data?.data) {
    console.warn('Failed to fetch user groups:', response.error);
    return [];
  }

  return response.data.data.map(group => ({
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

interface RawElement {
  id: number;
  name: string;
  type: string;
  uuid: string;
  options?: { uuid: string; name: string }[];
}

interface RawObject {
  id: number;
  name: string;
}

interface RawProperty {
  id: number;
  name: string;
  systemName?: string;
  system_name?: string;
  type: string;
}

interface RawDocument {
  id: number;
  name: string;
  templateId?: number;
  template_id?: number;
  status: string;
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

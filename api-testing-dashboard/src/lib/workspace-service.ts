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
 * Fetches elements for a specific template by finding an existing document
 * and extracting element definitions from it.
 *
 * Legito API flow:
 * 1. Find a document using this template: /document-record?templateSuiteId={id}
 * 2. Get document version code from the document
 * 3. Fetch elements from: /document-version/data/{documentVersionCode}
 */
export async function fetchTemplateElements(
  credentials: ScanCredentials,
  templateSuiteId: number
): Promise<TemplateElement[]> {
  const jwt = await generateJWT({ apiKey: credentials.apiKey, privateKey: credentials.privateKey });

  // Step 1: Find a document using this template
  const docsResponse = await legitoRequest<RawDocumentWithVersions[]>(
    `/document-record?templateSuiteId=${templateSuiteId}&limit=5`,
    { method: 'GET', jwt, baseUrl: credentials.baseUrl }
  );

  if (!docsResponse.success || !docsResponse.data) {
    console.warn('No documents found for template:', templateSuiteId);
    return [];
  }

  const docs = Array.isArray(docsResponse.data) ? docsResponse.data : [];

  // Find a non-deleted document with document versions
  const validDoc = docs.find(doc => !doc.deleted && (doc.documentVersions?.length ?? 0) > 0);
  if (!validDoc || !validDoc.documentVersions || validDoc.documentVersions.length === 0) {
    console.warn('No valid documents with versions found for template:', templateSuiteId);
    return [];
  }

  // Get the latest document version code
  const latestVersion = validDoc.documentVersions[0];
  const docVersionCode = latestVersion.code;

  // Step 2: Fetch elements from document version
  const elementsResponse = await legitoRequest<RawElement[]>(
    `/document-version/data/${docVersionCode}`,
    { method: 'GET', jwt, baseUrl: credentials.baseUrl }
  );

  if (!elementsResponse.success || !elementsResponse.data) {
    console.warn('Failed to fetch elements for document version:', docVersionCode);
    return [];
  }

  const rawElements = Array.isArray(elementsResponse.data) ? elementsResponse.data : [];

  // Filter to only input elements (those with a name and editable types)
  const inputTypes = [
    'TextInput', 'Date', 'Switcher', 'Question', 'Select',
    'ObjectRecordsSelectbox', 'ObjectRecordsQuestion', 'Money',
    'Counter', 'Calculation', 'RichText', 'Image'
  ];

  const elements: TemplateElement[] = rawElements
    .filter(el => el.name && el.name.trim() !== '' && inputTypes.includes(el.type))
    .map(el => ({
      id: el.id,
      name: el.name,
      type: el.type,
      uuid: el.uuid,
      options: el.items ? Object.entries(el.items).map(([uuid, label]) => ({
        uuid,
        label: String(label)
      })) : undefined,
      objectId: el.objectId,
    }));

  // Remove duplicates (same name can appear multiple times if repeated in document)
  const uniqueElements = elements.reduce((acc, el) => {
    if (!acc.find(e => e.name === el.name)) {
      acc.push(el);
    }
    return acc;
  }, [] as TemplateElement[]);

  return uniqueElements;
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

interface RawDocumentWithVersions extends RawDocument {
  deleted?: boolean;
  documentVersions?: {
    id: number;
    code: string;
    templateSuiteId: number;
  }[];
}

interface RawElement {
  id: number;
  name: string;
  type: string;
  uuid: string;
  value?: unknown;
  items?: Record<string, string>;
  objectId?: number;
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

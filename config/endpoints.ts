/**
 * API Endpoints Configuration
 *
 * Defines all Legito API v7 endpoints for test coverage.
 */

/**
 * Endpoint configuration
 */
export interface EndpointConfig {
  path: string;
  methods: string[];
  requiresAuth: boolean;
  category: string;
  rateLimit?: number;  // Override default rate limit
  tags: string[];
}

/**
 * All API endpoints
 */
export const endpoints: Record<string, EndpointConfig> = {
  // Document Records
  'documents.list': {
    path: '/documents',
    methods: ['GET'],
    requiresAuth: true,
    category: 'documents',
    tags: ['documents', 'read'],
  },
  'documents.create': {
    path: '/documents',
    methods: ['POST'],
    requiresAuth: true,
    category: 'documents',
    tags: ['documents', 'write', 'create'],
  },
  'documents.get': {
    path: '/documents/{id}',
    methods: ['GET'],
    requiresAuth: true,
    category: 'documents',
    tags: ['documents', 'read'],
  },
  'documents.update': {
    path: '/documents/{id}',
    methods: ['PUT', 'PATCH'],
    requiresAuth: true,
    category: 'documents',
    tags: ['documents', 'write', 'update'],
  },
  'documents.delete': {
    path: '/documents/{id}',
    methods: ['DELETE'],
    requiresAuth: true,
    category: 'documents',
    tags: ['documents', 'write', 'delete', 'destructive'],
  },

  // Document Versions
  'versions.list': {
    path: '/documents/{documentId}/versions',
    methods: ['GET'],
    requiresAuth: true,
    category: 'versions',
    tags: ['documents', 'versions', 'read'],
  },
  'versions.get': {
    path: '/documents/{documentId}/versions/{versionId}',
    methods: ['GET'],
    requiresAuth: true,
    category: 'versions',
    tags: ['documents', 'versions', 'read'],
  },
  'versions.download': {
    path: '/documents/{documentId}/versions/{versionId}/download',
    methods: ['GET'],
    requiresAuth: true,
    category: 'versions',
    rateLimit: 30,  // Lower rate for downloads
    tags: ['documents', 'versions', 'download', 'read'],
  },
  'versions.downloadFormat': {
    path: '/documents/{documentId}/versions/{versionId}/download/{format}',
    methods: ['GET'],
    requiresAuth: true,
    category: 'versions',
    rateLimit: 30,
    tags: ['documents', 'versions', 'download', 'read'],
  },

  // Template Suites
  'templateSuites.list': {
    path: '/template-suites',
    methods: ['GET'],
    requiresAuth: true,
    category: 'templates',
    tags: ['templates', 'suites', 'read'],
  },
  'templateSuites.get': {
    path: '/template-suites/{id}',
    methods: ['GET'],
    requiresAuth: true,
    category: 'templates',
    tags: ['templates', 'suites', 'read'],
  },
  'templateSuites.create': {
    path: '/template-suites',
    methods: ['POST'],
    requiresAuth: true,
    category: 'templates',
    tags: ['templates', 'suites', 'write', 'create'],
  },
  'templateSuites.update': {
    path: '/template-suites/{id}',
    methods: ['PUT'],
    requiresAuth: true,
    category: 'templates',
    tags: ['templates', 'suites', 'write', 'update'],
  },
  'templateSuites.delete': {
    path: '/template-suites/{id}',
    methods: ['DELETE'],
    requiresAuth: true,
    category: 'templates',
    tags: ['templates', 'suites', 'write', 'delete', 'destructive'],
  },

  // Template Tags
  'templateTags.list': {
    path: '/template-tags',
    methods: ['GET'],
    requiresAuth: true,
    category: 'templates',
    tags: ['templates', 'tags', 'read'],
  },
  'templateTags.create': {
    path: '/template-tags',
    methods: ['POST'],
    requiresAuth: true,
    category: 'templates',
    tags: ['templates', 'tags', 'write', 'create'],
  },

  // Files
  'files.list': {
    path: '/files',
    methods: ['GET'],
    requiresAuth: true,
    category: 'files',
    tags: ['files', 'read'],
  },
  'files.upload': {
    path: '/files',
    methods: ['POST'],
    requiresAuth: true,
    category: 'files',
    rateLimit: 20,  // Lower rate for uploads
    tags: ['files', 'write', 'upload'],
  },
  'files.get': {
    path: '/files/{id}',
    methods: ['GET'],
    requiresAuth: true,
    category: 'files',
    tags: ['files', 'read'],
  },
  'files.delete': {
    path: '/files/{id}',
    methods: ['DELETE'],
    requiresAuth: true,
    category: 'files',
    tags: ['files', 'write', 'delete', 'destructive'],
  },

  // Sharing - Users
  'sharing.users.list': {
    path: '/documents/{documentId}/sharing/users',
    methods: ['GET'],
    requiresAuth: true,
    category: 'sharing',
    tags: ['sharing', 'users', 'read'],
  },
  'sharing.users.add': {
    path: '/documents/{documentId}/sharing/users',
    methods: ['POST'],
    requiresAuth: true,
    category: 'sharing',
    tags: ['sharing', 'users', 'write'],
  },
  'sharing.users.remove': {
    path: '/documents/{documentId}/sharing/users/{userId}',
    methods: ['DELETE'],
    requiresAuth: true,
    category: 'sharing',
    tags: ['sharing', 'users', 'write', 'delete'],
  },

  // Sharing - Groups
  'sharing.groups.list': {
    path: '/documents/{documentId}/sharing/groups',
    methods: ['GET'],
    requiresAuth: true,
    category: 'sharing',
    tags: ['sharing', 'groups', 'read'],
  },
  'sharing.groups.add': {
    path: '/documents/{documentId}/sharing/groups',
    methods: ['POST'],
    requiresAuth: true,
    category: 'sharing',
    tags: ['sharing', 'groups', 'write'],
  },

  // Sharing - External Links
  'sharing.links.list': {
    path: '/documents/{documentId}/sharing/links',
    methods: ['GET'],
    requiresAuth: true,
    category: 'sharing',
    tags: ['sharing', 'links', 'read'],
  },
  'sharing.links.create': {
    path: '/documents/{documentId}/sharing/links',
    methods: ['POST'],
    requiresAuth: true,
    category: 'sharing',
    tags: ['sharing', 'links', 'write', 'create'],
  },
  'sharing.links.revoke': {
    path: '/documents/{documentId}/sharing/links/{linkId}',
    methods: ['DELETE'],
    requiresAuth: true,
    category: 'sharing',
    tags: ['sharing', 'links', 'write', 'delete'],
  },

  // Users
  'users.list': {
    path: '/users',
    methods: ['GET'],
    requiresAuth: true,
    category: 'users',
    tags: ['users', 'read'],
  },
  'users.get': {
    path: '/users/{id}',
    methods: ['GET'],
    requiresAuth: true,
    category: 'users',
    tags: ['users', 'read'],
  },
  'users.create': {
    path: '/users',
    methods: ['POST'],
    requiresAuth: true,
    category: 'users',
    tags: ['users', 'write', 'create'],
  },
  'users.update': {
    path: '/users/{id}',
    methods: ['PUT'],
    requiresAuth: true,
    category: 'users',
    tags: ['users', 'write', 'update'],
  },
  'users.delete': {
    path: '/users/{id}',
    methods: ['DELETE'],
    requiresAuth: true,
    category: 'users',
    tags: ['users', 'write', 'delete', 'destructive'],
  },

  // User Groups
  'userGroups.list': {
    path: '/user-groups',
    methods: ['GET'],
    requiresAuth: true,
    category: 'users',
    tags: ['users', 'groups', 'read'],
  },
  'userGroups.get': {
    path: '/user-groups/{id}',
    methods: ['GET'],
    requiresAuth: true,
    category: 'users',
    tags: ['users', 'groups', 'read'],
  },
  'userGroups.create': {
    path: '/user-groups',
    methods: ['POST'],
    requiresAuth: true,
    category: 'users',
    tags: ['users', 'groups', 'write', 'create'],
  },

  // Object Records
  'objectRecords.list': {
    path: '/object-records',
    methods: ['GET'],
    requiresAuth: true,
    category: 'objects',
    tags: ['objects', 'read'],
  },
  'objectRecords.get': {
    path: '/object-records/{id}',
    methods: ['GET'],
    requiresAuth: true,
    category: 'objects',
    tags: ['objects', 'read'],
  },
  'objectRecords.create': {
    path: '/object-records',
    methods: ['POST'],
    requiresAuth: true,
    category: 'objects',
    tags: ['objects', 'write', 'create'],
  },

  // System Data
  'system.styles': {
    path: '/styles',
    methods: ['GET'],
    requiresAuth: true,
    category: 'system',
    tags: ['system', 'styles', 'read'],
  },
  'system.categories': {
    path: '/categories',
    methods: ['GET'],
    requiresAuth: true,
    category: 'system',
    tags: ['system', 'categories', 'read'],
  },
  'system.countries': {
    path: '/countries',
    methods: ['GET'],
    requiresAuth: true,
    category: 'system',
    tags: ['system', 'countries', 'read'],
  },
  'system.currencies': {
    path: '/currencies',
    methods: ['GET'],
    requiresAuth: true,
    category: 'system',
    tags: ['system', 'currencies', 'read'],
  },

  // Workflows
  'workflows.list': {
    path: '/workflows',
    methods: ['GET'],
    requiresAuth: true,
    category: 'workflows',
    tags: ['workflows', 'read'],
  },
  'workflows.get': {
    path: '/workflows/{id}',
    methods: ['GET'],
    requiresAuth: true,
    category: 'workflows',
    tags: ['workflows', 'read'],
  },
  'workflows.create': {
    path: '/workflows',
    methods: ['POST'],
    requiresAuth: true,
    category: 'workflows',
    tags: ['workflows', 'write', 'create'],
  },
  'workflows.trigger': {
    path: '/workflows/{id}/trigger',
    methods: ['POST'],
    requiresAuth: true,
    category: 'workflows',
    tags: ['workflows', 'write', 'trigger'],
  },

  // Push Connections
  'pushConnections.list': {
    path: '/push-connections',
    methods: ['GET'],
    requiresAuth: true,
    category: 'workflows',
    tags: ['workflows', 'push', 'read'],
  },
  'pushConnections.create': {
    path: '/push-connections',
    methods: ['POST'],
    requiresAuth: true,
    category: 'workflows',
    tags: ['workflows', 'push', 'write', 'create'],
  },
  'pushConnections.test': {
    path: '/push-connections/{id}/test',
    methods: ['POST'],
    requiresAuth: true,
    category: 'workflows',
    tags: ['workflows', 'push', 'test'],
  },
};

/**
 * Get endpoints by category
 */
export function getEndpointsByCategory(category: string): EndpointConfig[] {
  return Object.values(endpoints).filter((e) => e.category === category);
}

/**
 * Get endpoints by tag
 */
export function getEndpointsByTag(tag: string): EndpointConfig[] {
  return Object.values(endpoints).filter((e) => e.tags.includes(tag));
}

/**
 * Get all categories
 */
export function getAllCategories(): string[] {
  return [...new Set(Object.values(endpoints).map((e) => e.category))];
}

export default endpoints;

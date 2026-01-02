/**
 * Legito workspace regions - affects base URL
 */
export type LegitoRegion = 'emea' | 'us' | 'ca' | 'apac' | 'quarterly';

/**
 * Credentials for a single Legito workspace
 */
export interface LegitoCredentials {
  key: string;
  privateKey: string;
  region: LegitoRegion;
}

/**
 * Named workspace configuration
 */
export interface WorkspaceConfig {
  id: 'source' | 'target';
  name: string;
  credentials: LegitoCredentials;
}

/**
 * Tag as returned from Legito API
 */
export interface LegitoTag {
  id: number;
  name: string;
  system?: boolean;
  color?: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Payload for creating a new tag
 */
export interface CreateTagPayload {
  name: string;
  color?: string;
  description?: string;
}

/**
 * Result of duplicate detection analysis
 */
export interface DuplicateAnalysisResult {
  tagsToCreate: LegitoTag[];
  duplicates: LegitoTag[];
  sourceTags: LegitoTag[];
  targetTags: LegitoTag[];
}

/**
 * Result of a single tag copy operation
 */
export interface TagCopyResult {
  sourceTag: LegitoTag;
  success: boolean;
  createdTag?: LegitoTag;
  error?: string;
}

/**
 * Aggregate result of the sync operation
 */
export interface SyncResult {
  totalSourceTags: number;
  totalTargetTagsBefore: number;
  duplicatesSkipped: number;
  tagsCreated: number;
  tagsFailed: number;
  results: TagCopyResult[];
  startedAt: Date;
  completedAt: Date;
}

/**
 * Sync progress information
 */
export interface SyncProgress {
  phase: 'fetching-source' | 'fetching-target' | 'analyzing' | 'creating' | 'complete';
  current?: number;
  total?: number;
  message: string;
}

/**
 * Connection status for a workspace
 */
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * Sync operation status
 */
export type SyncStatus = 'idle' | 'analyzing' | 'syncing' | 'complete' | 'error';

/**
 * Generic API error response from Legito
 */
export interface LegitoApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Wrapper for API responses with proper error typing
 */
export type ApiResult<T> =
  | { success: true; data: T }
  | { success: false; error: LegitoApiError };

/**
 * Duplicate matching strategies
 */
export type DuplicateMatchStrategy =
  | 'name-exact'
  | 'name-case-insensitive'
  | 'name-normalized';

import type {
  LegitoCredentials,
  LegitoTag,
  CreateTagPayload,
  ApiResult,
  LegitoApiError,
  DuplicateAnalysisResult,
  DuplicateMatchStrategy,
  SyncResult,
  SyncProgress,
  TagCopyResult,
} from '@/types/tagger';

/**
 * Builds the proxy URL for a Legito region
 */
function getBaseUrl(region: string): string {
  return `/api/tagger/${region}`;
}

/**
 * Creates a JWT token for Legito API authentication
 * Format: Header.Payload.Signature (HS256)
 */
function createJwtToken(credentials: LegitoCredentials): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: credentials.key,
    iat: now,
    exp: now + 3600, // 1 hour expiry
  };

  const base64UrlEncode = (obj: object): string => {
    const json = JSON.stringify(obj);
    if (typeof window !== 'undefined') {
      return btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }
    return Buffer.from(json).toString('base64url');
  };

  const headerB64 = base64UrlEncode(header);
  const payloadB64 = base64UrlEncode(payload);
  const signatureInput = `${headerB64}.${payloadB64}`;

  // For client-side, we need to use SubtleCrypto or send to server
  // Since we're proxying through our API route, we'll create the signature there
  // For now, send the unsigned token and let the proxy handle signing
  // Actually, we need HMAC-SHA256 which requires the private key
  // Let's create the signature using a simple approach for browser

  // Use Web Crypto API for HMAC-SHA256
  // Since this is async and we need sync, we'll pass credentials to proxy
  // The proxy will handle JWT creation server-side

  // For now, return a placeholder that the proxy will interpret
  return `${credentials.key}:${credentials.privateKey}`;
}

/**
 * Creates an authenticated Legito API client
 */
export function createLegitoClient(credentials: LegitoCredentials) {
  const baseUrl = getBaseUrl(credentials.region);

  async function request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResult<T>> {
    const url = `${baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          // Send credentials to proxy which will create JWT server-side
          'X-Legito-Key': credentials.key,
          'X-Legito-Private-Key': credentials.privateKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        return {
          success: false,
          error: {
            code: `HTTP_${response.status}`,
            message: errorBody.message || response.statusText,
            details: errorBody,
          },
        };
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'Unknown network error',
        },
      };
    }
  }

  return {
    get: <T>(endpoint: string) => request<T>(endpoint, { method: 'GET' }),
    post: <T>(endpoint: string, body: unknown) =>
      request<T>(endpoint, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  };
}

export type LegitoClient = ReturnType<typeof createLegitoClient>;

/**
 * Service for Legito tag operations
 */
export class TagsService {
  private client: LegitoClient;

  constructor(credentials: LegitoCredentials) {
    this.client = createLegitoClient(credentials);
  }

  /**
   * Fetches all tags from the workspace
   */
  async getAllTags(): Promise<ApiResult<LegitoTag[]>> {
    const result = await this.client.get<LegitoTag[] | { data: LegitoTag[] }>('/template-tag');

    if (!result.success) {
      return result;
    }

    // Handle both array response and wrapped response
    const tags = Array.isArray(result.data) ? result.data : result.data.data || [];
    return { success: true, data: tags };
  }

  /**
   * Creates a single tag in the workspace
   */
  async createTag(payload: CreateTagPayload): Promise<ApiResult<LegitoTag>> {
    return this.client.post<LegitoTag>('/template-tag', payload);
  }

  /**
   * Validates that the credentials are correct by attempting to fetch tags
   */
  async validateCredentials(): Promise<boolean> {
    const result = await this.getAllTags();
    return result.success;
  }
}

/**
 * Normalizes a tag name based on the matching strategy
 */
function normalizeTagName(name: string, strategy: DuplicateMatchStrategy): string {
  switch (strategy) {
    case 'name-exact':
      return name;
    case 'name-case-insensitive':
      return name.toLowerCase();
    case 'name-normalized':
      return name.toLowerCase().trim().replace(/\s+/g, ' ');
    default:
      return name;
  }
}

/**
 * Analyzes source and target tags to identify duplicates and tags to create
 */
export function analyzeDuplicates(
  sourceTags: LegitoTag[],
  targetTags: LegitoTag[],
  strategy: DuplicateMatchStrategy = 'name-case-insensitive'
): DuplicateAnalysisResult {
  const targetTagKeys = new Set(
    targetTags.map((tag) => normalizeTagName(tag.name, strategy))
  );

  const tagsToCreate: LegitoTag[] = [];
  const duplicates: LegitoTag[] = [];

  for (const sourceTag of sourceTags) {
    const key = normalizeTagName(sourceTag.name, strategy);
    if (targetTagKeys.has(key)) {
      duplicates.push(sourceTag);
    } else {
      tagsToCreate.push(sourceTag);
    }
  }

  return {
    tagsToCreate,
    duplicates,
    sourceTags,
    targetTags,
  };
}

export interface SyncOptions {
  duplicateStrategy?: DuplicateMatchStrategy;
  concurrency?: number;
  delayMs?: number;
  onProgress?: (progress: SyncProgress) => void;
  dryRun?: boolean;
}

/**
 * Main service for orchestrating tag synchronization between workspaces
 */
export class TaggerSyncService {
  private sourceService: TagsService;
  private targetService: TagsService;

  constructor(
    sourceCredentials: LegitoCredentials,
    targetCredentials: LegitoCredentials
  ) {
    this.sourceService = new TagsService(sourceCredentials);
    this.targetService = new TagsService(targetCredentials);
  }

  /**
   * Fetches tags from both workspaces and analyzes for duplicates
   */
  async analyze(
    strategy: DuplicateMatchStrategy = 'name-case-insensitive'
  ): Promise<DuplicateAnalysisResult> {
    const [sourceResult, targetResult] = await Promise.all([
      this.sourceService.getAllTags(),
      this.targetService.getAllTags(),
    ]);

    if (!sourceResult.success) {
      throw new Error(`Failed to fetch source tags: ${sourceResult.error.message}`);
    }
    if (!targetResult.success) {
      throw new Error(`Failed to fetch target tags: ${targetResult.error.message}`);
    }

    return analyzeDuplicates(sourceResult.data, targetResult.data, strategy);
  }

  /**
   * Performs the full sync operation
   */
  async sync(options: SyncOptions = {}): Promise<SyncResult> {
    const {
      duplicateStrategy = 'name-case-insensitive',
      concurrency = 3,
      delayMs = 100,
      onProgress,
      dryRun = false,
    } = options;

    const startedAt = new Date();
    const results: TagCopyResult[] = [];

    // Phase 1: Fetch source tags
    onProgress?.({
      phase: 'fetching-source',
      message: 'Fetching tags from source workspace...',
    });
    const sourceResult = await this.sourceService.getAllTags();
    if (!sourceResult.success) {
      throw new Error(`Failed to fetch source tags: ${sourceResult.error.message}`);
    }

    // Phase 2: Fetch target tags
    onProgress?.({
      phase: 'fetching-target',
      message: 'Fetching tags from target workspace...',
    });
    const targetResult = await this.targetService.getAllTags();
    if (!targetResult.success) {
      throw new Error(`Failed to fetch target tags: ${targetResult.error.message}`);
    }

    // Phase 3: Analyze duplicates
    onProgress?.({ phase: 'analyzing', message: 'Analyzing duplicates...' });
    const analysis = analyzeDuplicates(
      sourceResult.data,
      targetResult.data,
      duplicateStrategy
    );

    // Early return for dry run
    if (dryRun) {
      return {
        totalSourceTags: analysis.sourceTags.length,
        totalTargetTagsBefore: analysis.targetTags.length,
        duplicatesSkipped: analysis.duplicates.length,
        tagsCreated: 0,
        tagsFailed: 0,
        results: [],
        startedAt,
        completedAt: new Date(),
      };
    }

    // Phase 4: Create non-duplicate tags
    onProgress?.({
      phase: 'creating',
      current: 0,
      total: analysis.tagsToCreate.length,
      message: `Creating ${analysis.tagsToCreate.length} tags...`,
    });

    let created = 0;
    let failed = 0;

    for (let i = 0; i < analysis.tagsToCreate.length; i += concurrency) {
      const batch = analysis.tagsToCreate.slice(i, i + concurrency);

      const batchResults = await Promise.all(
        batch.map(async (sourceTag) => {
          const payload: CreateTagPayload = {
            name: sourceTag.name,
            color: sourceTag.color,
            description: sourceTag.description,
          };
          const result = await this.targetService.createTag(payload);
          return { sourceTag, result };
        })
      );

      for (const { sourceTag, result } of batchResults) {
        if (result.success) {
          created++;
          results.push({
            sourceTag,
            success: true,
            createdTag: result.data,
          });
        } else {
          failed++;
          results.push({
            sourceTag,
            success: false,
            error: result.error.message,
          });
        }
      }

      onProgress?.({
        phase: 'creating',
        current: Math.min(i + concurrency, analysis.tagsToCreate.length),
        total: analysis.tagsToCreate.length,
        message: `Created ${created} tags, ${failed} failed...`,
      });

      // Rate limiting delay
      if (i + concurrency < analysis.tagsToCreate.length && delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    onProgress?.({ phase: 'complete', message: 'Sync complete!' });

    return {
      totalSourceTags: analysis.sourceTags.length,
      totalTargetTagsBefore: analysis.targetTags.length,
      duplicatesSkipped: analysis.duplicates.length,
      tagsCreated: created,
      tagsFailed: failed,
      results,
      startedAt,
      completedAt: new Date(),
    };
  }

  /**
   * Validates credentials for both workspaces
   */
  async validateCredentials(): Promise<{ source: boolean; target: boolean }> {
    const [source, target] = await Promise.all([
      this.sourceService.validateCredentials(),
      this.targetService.validateCredentials(),
    ]);
    return { source, target };
  }
}

export function createTagsService(credentials: LegitoCredentials): TagsService {
  return new TagsService(credentials);
}

export function createTaggerSyncService(
  sourceCredentials: LegitoCredentials,
  targetCredentials: LegitoCredentials
): TaggerSyncService {
  return new TaggerSyncService(sourceCredentials, targetCredentials);
}

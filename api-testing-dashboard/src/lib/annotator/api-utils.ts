/**
 * API Utilities for Annotator
 *
 * Shared utilities for authentication, file validation, and database access.
 * Centralizes common functionality used across all API routes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// Types
// ============================================================================

export interface AuthenticatedUser {
  id: string;
  email?: string;
  isDefault: boolean;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  fileType?: string;
}

// ============================================================================
// Supabase Client
// ============================================================================

let supabaseInstance: SupabaseClient | null = null;

/**
 * Get a Supabase client with service role key for server-side operations.
 * Uses singleton pattern to reuse connections.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not configured');
  }

  if (!supabaseKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for server-side operations');
  }

  supabaseInstance = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseInstance;
}

// ============================================================================
// Authentication
// ============================================================================

/**
 * Get the authenticated user from the request.
 *
 * Current implementation uses x-user-id header (simple mode).
 * TODO: Implement proper Supabase Auth validation.
 *
 * @param request - The Next.js request object
 * @returns The authenticated user info
 */
export function getAuthenticatedUser(request: NextRequest): AuthenticatedUser {
  // Check for user ID in header (current simple implementation)
  const headerUserId = request.headers.get('x-user-id');

  if (headerUserId && headerUserId !== 'default-user') {
    return {
      id: headerUserId,
      isDefault: false,
    };
  }

  // TODO: Implement proper Supabase Auth validation
  // const supabase = createServerClient(...)
  // const { data: { user } } = await supabase.auth.getUser()

  // Fallback to default user (for development/testing)
  return {
    id: 'default-user',
    isDefault: true,
  };
}

/**
 * Middleware to require authentication.
 * Returns an error response if user is not authenticated.
 *
 * @param request - The Next.js request object
 * @param allowDefault - Whether to allow the default user (for development)
 */
export function requireAuth(
  request: NextRequest,
  allowDefault: boolean = true
): { user: AuthenticatedUser } | { error: NextResponse } {
  const user = getAuthenticatedUser(request);

  if (!allowDefault && user.isDefault) {
    return {
      error: NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        },
        { status: 401 }
      ),
    };
  }

  return { user };
}

// ============================================================================
// File Validation
// ============================================================================

// DOCX files are ZIP archives, starting with "PK" signature
const DOCX_MAGIC_BYTES = [0x50, 0x4b, 0x03, 0x04];

// Additional check for DOCX: look for specific file entries in the ZIP
const DOCX_CONTENT_TYPES_PATH = '[Content_Types].xml';

/**
 * Validate that a file is a valid DOCX document.
 *
 * Checks:
 * 1. File extension
 * 2. MIME type
 * 3. Magic bytes (file signature)
 * 4. File size limits
 *
 * @param file - The file to validate
 * @param maxSizeBytes - Maximum file size (default 10MB)
 */
export async function validateDocxFile(
  file: File,
  maxSizeBytes: number = 10 * 1024 * 1024
): Promise<FileValidationResult> {
  // Check file exists
  if (!file) {
    return { valid: false, error: 'No file provided' };
  }

  // Check file size
  if (file.size > maxSizeBytes) {
    const maxSizeMB = Math.round(maxSizeBytes / (1024 * 1024));
    return {
      valid: false,
      error: `File too large. Maximum size is ${maxSizeMB}MB`,
    };
  }

  // Check file size is not suspiciously small
  if (file.size < 100) {
    return { valid: false, error: 'File is too small to be a valid document' };
  }

  // Check extension
  const extension = file.name.toLowerCase().split('.').pop();
  if (extension !== 'docx') {
    return {
      valid: false,
      error: 'Invalid file extension. Only .docx files are supported',
    };
  }

  // Check MIME type (but don't rely on it alone as it can be spoofed)
  const validMimeTypes = [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/zip', // DOCX is a ZIP file
    'application/octet-stream', // Sometimes browsers send this
  ];

  // MIME type check is informational only (can be spoofed)
  const hasSuspiciousMime =
    file.type && !validMimeTypes.includes(file.type) && !file.type.includes('word');

  // Check magic bytes (file signature)
  try {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer.slice(0, 4));

    const isValidMagic =
      bytes[0] === DOCX_MAGIC_BYTES[0] &&
      bytes[1] === DOCX_MAGIC_BYTES[1] &&
      bytes[2] === DOCX_MAGIC_BYTES[2] &&
      bytes[3] === DOCX_MAGIC_BYTES[3];

    if (!isValidMagic) {
      return {
        valid: false,
        error: 'Invalid file format. File does not appear to be a valid DOCX document',
      };
    }

    // Additional validation: check for [Content_Types].xml in the ZIP structure
    // This is a simple heuristic - look for the string in the first 1KB
    const headerBytes = new Uint8Array(buffer.slice(0, 1024));
    const headerText = new TextDecoder('utf-8', { fatal: false }).decode(headerBytes);
    const hasContentTypes = headerText.includes('Content_Types') || headerText.includes('word/');

    if (!hasContentTypes && hasSuspiciousMime) {
      // Only warn if both checks fail
      console.warn(
        `[validateDocxFile] File ${file.name} has suspicious MIME type and no DOCX markers`
      );
    }

    return { valid: true, fileType: 'docx' };
  } catch (error) {
    console.error('[validateDocxFile] Error reading file:', error);
    return {
      valid: false,
      error: 'Failed to read file. The file may be corrupted',
    };
  }
}

/**
 * Validate multiple files at once
 */
export async function validateDocxFiles(
  files: File[],
  maxSizeBytes?: number
): Promise<Map<string, FileValidationResult>> {
  const results = new Map<string, FileValidationResult>();

  await Promise.all(
    files.map(async (file) => {
      const result = await validateDocxFile(file, maxSizeBytes);
      results.set(file.name, result);
    })
  );

  return results;
}

// ============================================================================
// Response Helpers
// ============================================================================

/**
 * Create a success response
 */
export function successResponse<T>(data: T, status: number = 200): NextResponse {
  return NextResponse.json({ success: true, ...data }, { status });
}

/**
 * Create an error response
 */
export function errorResponse(
  code: string,
  message: string,
  status: number = 400
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: { code, message },
    },
    { status }
  );
}

/**
 * Handle unexpected errors
 */
export function handleError(error: unknown, context: string = 'API'): NextResponse {
  console.error(`[${context}] Error:`, error);

  const message = error instanceof Error ? error.message : 'An unexpected error occurred';

  return errorResponse('INTERNAL_ERROR', message, 500);
}

// ============================================================================
// Rate Limiting (Simple In-Memory Implementation)
// ============================================================================

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

/**
 * Simple rate limiter for API routes.
 *
 * @param key - Unique key for rate limiting (e.g., user ID + endpoint)
 * @param maxRequests - Maximum requests allowed in the window
 * @param windowMs - Time window in milliseconds
 */
export function checkRateLimit(
  key: string,
  maxRequests: number = 60,
  windowMs: number = 60000
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  // Clean up old entries periodically
  if (rateLimitMap.size > 10000) {
    for (const [k, v] of rateLimitMap.entries()) {
      if (v.resetAt < now) {
        rateLimitMap.delete(k);
      }
    }
  }

  if (!entry || entry.resetAt < now) {
    // New window
    const newEntry = { count: 1, resetAt: now + windowMs };
    rateLimitMap.set(key, newEntry);
    return { allowed: true, remaining: maxRequests - 1, resetAt: newEntry.resetAt };
  }

  if (entry.count >= maxRequests) {
    // Rate limited
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  // Increment count
  entry.count++;
  rateLimitMap.set(key, entry);
  return { allowed: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt };
}

/**
 * Rate limit middleware
 */
export function withRateLimit(
  request: NextRequest,
  maxRequests: number = 60,
  windowMs: number = 60000
): { allowed: true } | { error: NextResponse } {
  const user = getAuthenticatedUser(request);
  const endpoint = request.nextUrl.pathname;
  const key = `${user.id}:${endpoint}`;

  const result = checkRateLimit(key, maxRequests, windowMs);

  if (!result.allowed) {
    return {
      error: NextResponse.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many requests. Please try again later.',
          },
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': result.resetAt.toString(),
          },
        }
      ),
    };
  }

  return { allowed: true };
}

// ============================================================================
// Database Transform Utilities
// ============================================================================

import type { Pattern, AnnotationType, RejectedPattern } from '@/types/annotator';

/**
 * Transform database pattern row to Pattern type
 * Centralizes the transformation to avoid duplication across routes
 */
export function transformDbPattern(p: {
  id: string;
  user_id: string;
  original_text: string;
  annotated_text: string;
  annotation_type: string;
  context_before: string | null;
  context_after: string | null;
  confidence: number;
  usage_count: number;
  success_rate: number;
  training_pair_id: string | null;
  created_at: string;
  context_rules?: unknown;
}): Pattern {
  return {
    id: p.id,
    userId: p.user_id,
    originalText: p.original_text,
    annotatedText: p.annotated_text,
    annotationType: p.annotation_type as AnnotationType,
    contextBefore: p.context_before,
    contextAfter: p.context_after,
    confidence: p.confidence,
    usageCount: p.usage_count,
    successRate: p.success_rate,
    trainingPairId: p.training_pair_id,
    createdAt: new Date(p.created_at),
    contextRules: p.context_rules as Pattern['contextRules'],
  };
}

/**
 * Transform array of database pattern rows to Pattern array
 */
export function transformDbPatterns(rows: Array<Parameters<typeof transformDbPattern>[0]>): Pattern[] {
  return rows.map(transformDbPattern);
}

/**
 * Group rejected feedback into RejectedPattern array
 * Used by both annotate route and rejected endpoint
 */
export function groupRejectedFeedback(
  feedbackRows: Array<{
    original_text: string;
    suggested_text: string;
    created_at: string;
  }>,
  minRejections: number = 2
): RejectedPattern[] {
  const rejectedMap = new Map<string, { suggestedText: string; count: number; lastRejected: Date }>();

  for (const r of feedbackRows) {
    const key = r.original_text;
    const existing = rejectedMap.get(key);
    if (existing) {
      existing.count++;
      if (new Date(r.created_at) > existing.lastRejected) {
        existing.lastRejected = new Date(r.created_at);
      }
    } else {
      rejectedMap.set(key, {
        suggestedText: r.suggested_text,
        count: 1,
        lastRejected: new Date(r.created_at),
      });
    }
  }

  return Array.from(rejectedMap.entries())
    .filter(([, v]) => v.count >= minRejections)
    .map(([originalText, v]) => ({
      originalText,
      suggestedText: v.suggestedText,
      rejectionCount: v.count,
      lastRejected: v.lastRejected,
    }))
    .sort((a, b) => b.rejectionCount - a.rejectionCount);
}

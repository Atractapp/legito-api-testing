/**
 * Pattern Loader for Headless Annotator
 *
 * Loads learned patterns from a JSON file mounted at runtime.
 * This allows pattern updates without rebuilding the container.
 *
 * Expected mount path: /app/data/patterns.json
 *
 * JSON Format:
 * {
 *   "version": "1.0",
 *   "exportedAt": "2026-01-21T10:00:00Z",
 *   "patterns": [
 *     {
 *       "originalText": "_____",
 *       "annotatedText": "[Textinput: Creditor's name]",
 *       "annotationType": "TextInput",
 *       "confidence": 0.95,
 *       "semanticContext": "Party name field. Could match: Seller, Buyer..."
 *     }
 *   ]
 * }
 */

import * as fs from 'fs';
import * as path from 'path';
import type { AnnotationType } from '@/types/annotator';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface LoadedPattern {
  originalText: string;
  annotatedText: string;
  annotationType: AnnotationType;
  confidence: number;
  semanticContext?: string;
  /**
   * Context keywords that help disambiguate this pattern.
   * Example: { before: ['dated', 'on'], after: ['year'] }
   */
  contextKeywords?: {
    before?: string[];
    after?: string[];
  };
}

export interface PatternsFile {
  version: string;
  exportedAt: string;
  patterns: LoadedPattern[];
}

export interface PatternLoadResult {
  success: boolean;
  patterns: LoadedPattern[];
  error?: string;
  loadedFrom?: string;
  version?: string;
  exportedAt?: string;
}

// ----------------------------------------------------------------------------
// Configuration
// ----------------------------------------------------------------------------

/**
 * Default paths to look for patterns file.
 * Checked in order - first found is used.
 */
const PATTERN_FILE_PATHS = [
  // Docker mount path (primary)
  '/app/data/patterns.json',
  // Local development paths
  path.join(process.cwd(), 'data', 'patterns.json'),
  path.join(process.cwd(), 'api-testing-dashboard', 'data', 'patterns.json'),
];

// Environment variable override
const PATTERNS_FILE_ENV = process.env.PATTERNS_FILE_PATH;

// ----------------------------------------------------------------------------
// Pattern Cache (singleton)
// ----------------------------------------------------------------------------

let _cachedPatterns: LoadedPattern[] | null = null;
let _loadedFrom: string | null = null;
let _loadError: string | null = null;

// ----------------------------------------------------------------------------
// Core Functions
// ----------------------------------------------------------------------------

/**
 * Find the first existing patterns file from the search paths.
 */
function findPatternsFile(): string | null {
  // Check environment variable first
  if (PATTERNS_FILE_ENV) {
    if (fs.existsSync(PATTERNS_FILE_ENV)) {
      return PATTERNS_FILE_ENV;
    }
    console.warn(`[pattern-loader] PATTERNS_FILE_PATH env var set but file not found: ${PATTERNS_FILE_ENV}`);
  }

  // Check default paths
  for (const filePath of PATTERN_FILE_PATHS) {
    try {
      if (fs.existsSync(filePath)) {
        return filePath;
      }
    } catch {
      // Path doesn't exist or no permission, continue
    }
  }

  return null;
}

/**
 * Validate a single pattern object.
 */
function validatePattern(pattern: unknown, index: number): LoadedPattern | null {
  if (!pattern || typeof pattern !== 'object') {
    console.warn(`[pattern-loader] Pattern at index ${index} is not an object`);
    return null;
  }

  const p = pattern as Record<string, unknown>;

  // Required fields
  if (typeof p.originalText !== 'string' || !p.originalText) {
    console.warn(`[pattern-loader] Pattern at index ${index} missing originalText`);
    return null;
  }

  if (typeof p.annotatedText !== 'string' || !p.annotatedText) {
    console.warn(`[pattern-loader] Pattern at index ${index} missing annotatedText`);
    return null;
  }

  if (typeof p.annotationType !== 'string' || !p.annotationType) {
    console.warn(`[pattern-loader] Pattern at index ${index} missing annotationType`);
    return null;
  }

  // Validate annotation type
  const validTypes: AnnotationType[] = ['Text', 'TextInput', 'Select', 'Date', 'Link', 'Money', 'Calculation'];
  if (!validTypes.includes(p.annotationType as AnnotationType)) {
    console.warn(`[pattern-loader] Pattern at index ${index} has invalid annotationType: ${p.annotationType}`);
    return null;
  }

  // Build validated pattern
  const validated: LoadedPattern = {
    originalText: p.originalText,
    annotatedText: p.annotatedText,
    annotationType: p.annotationType as AnnotationType,
    confidence: typeof p.confidence === 'number' ? p.confidence : 0.8,
  };

  // Optional fields
  if (typeof p.semanticContext === 'string') {
    validated.semanticContext = p.semanticContext;
  }

  if (p.contextKeywords && typeof p.contextKeywords === 'object') {
    const ck = p.contextKeywords as Record<string, unknown>;
    validated.contextKeywords = {};

    if (Array.isArray(ck.before)) {
      validated.contextKeywords.before = ck.before.filter(
        (k): k is string => typeof k === 'string'
      );
    }

    if (Array.isArray(ck.after)) {
      validated.contextKeywords.after = ck.after.filter(
        (k): k is string => typeof k === 'string'
      );
    }
  }

  return validated;
}

/**
 * Parse and validate patterns file content.
 */
function parsePatternsFile(content: string, filePath: string): PatternLoadResult {
  try {
    const data = JSON.parse(content) as unknown;

    if (!data || typeof data !== 'object') {
      return {
        success: false,
        patterns: [],
        error: 'Invalid JSON: root must be an object',
      };
    }

    const file = data as Record<string, unknown>;

    // Check version
    const version = typeof file.version === 'string' ? file.version : 'unknown';

    // Check exportedAt
    const exportedAt = typeof file.exportedAt === 'string' ? file.exportedAt : undefined;

    // Check patterns array
    if (!Array.isArray(file.patterns)) {
      return {
        success: false,
        patterns: [],
        error: 'Invalid JSON: patterns must be an array',
      };
    }

    // Validate each pattern
    const validPatterns: LoadedPattern[] = [];
    let skippedCount = 0;

    for (let i = 0; i < file.patterns.length; i++) {
      const validated = validatePattern(file.patterns[i], i);
      if (validated) {
        validPatterns.push(validated);
      } else {
        skippedCount++;
      }
    }

    if (skippedCount > 0) {
      console.warn(`[pattern-loader] Skipped ${skippedCount} invalid patterns`);
    }

    console.log(`[pattern-loader] Loaded ${validPatterns.length} patterns from ${filePath}`);

    return {
      success: true,
      patterns: validPatterns,
      loadedFrom: filePath,
      version,
      exportedAt,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown parse error';
    return {
      success: false,
      patterns: [],
      error: `Failed to parse patterns file: ${errorMessage}`,
    };
  }
}

/**
 * Load patterns from JSON file.
 * Returns cached patterns if already loaded.
 */
export function loadPatterns(): PatternLoadResult {
  // Return cached if available
  if (_cachedPatterns !== null) {
    return {
      success: true,
      patterns: _cachedPatterns,
      loadedFrom: _loadedFrom || undefined,
    };
  }

  // Return cached error if already attempted
  if (_loadError !== null) {
    return {
      success: false,
      patterns: [],
      error: _loadError,
    };
  }

  // Find patterns file
  const filePath = findPatternsFile();

  if (!filePath) {
    const msg = 'No patterns file found. Searched paths: ' + PATTERN_FILE_PATHS.join(', ');
    console.warn(`[pattern-loader] ${msg}`);
    _cachedPatterns = [];
    _loadError = null; // Not an error, just empty
    return {
      success: true,
      patterns: [],
      error: undefined,
    };
  }

  // Read file
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const result = parsePatternsFile(content, filePath);

    if (result.success) {
      _cachedPatterns = result.patterns;
      _loadedFrom = filePath;
      _loadError = null;
    } else {
      _cachedPatterns = [];
      _loadError = result.error || 'Unknown error';
    }

    return result;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown read error';
    const msg = `Failed to read patterns file ${filePath}: ${errorMessage}`;
    console.error(`[pattern-loader] ${msg}`);
    _cachedPatterns = [];
    _loadError = msg;
    return {
      success: false,
      patterns: [],
      error: msg,
    };
  }
}

/**
 * Get loaded patterns (loads if not already loaded).
 */
export function getLoadedPatterns(): LoadedPattern[] {
  const result = loadPatterns();
  return result.patterns;
}

/**
 * Check if patterns are loaded.
 */
export function arePatternsLoaded(): boolean {
  return _cachedPatterns !== null;
}

/**
 * Get the path patterns were loaded from.
 */
export function getLoadedFromPath(): string | null {
  return _loadedFrom;
}

/**
 * Clear cached patterns (for testing or reload).
 */
export function clearPatternCache(): void {
  _cachedPatterns = null;
  _loadedFrom = null;
  _loadError = null;
}

/**
 * Reload patterns from file.
 */
export function reloadPatterns(): PatternLoadResult {
  clearPatternCache();
  return loadPatterns();
}

// ----------------------------------------------------------------------------
// Pattern Lookup Functions
// ----------------------------------------------------------------------------

/**
 * Find patterns by original text (exact match).
 */
export function findPatternsByOriginal(originalText: string): LoadedPattern[] {
  const patterns = getLoadedPatterns();
  const normalizedSearch = originalText.toLowerCase().trim();

  return patterns.filter(
    p => p.originalText.toLowerCase().trim() === normalizedSearch
  );
}

/**
 * Find patterns by annotation type.
 */
export function findPatternsByType(annotationType: AnnotationType): LoadedPattern[] {
  const patterns = getLoadedPatterns();
  return patterns.filter(p => p.annotationType === annotationType);
}

/**
 * Find best matching pattern for given text.
 * Returns the pattern with highest confidence, or null if no match.
 */
export function findBestPattern(originalText: string): LoadedPattern | null {
  const matches = findPatternsByOriginal(originalText);

  if (matches.length === 0) {
    return null;
  }

  // Sort by confidence (highest first)
  matches.sort((a, b) => b.confidence - a.confidence);

  return matches[0];
}

/**
 * Get pattern count by type.
 */
export function getPatternCountsByType(): Record<AnnotationType, number> {
  const patterns = getLoadedPatterns();
  const counts: Record<AnnotationType, number> = {
    Text: 0,
    TextInput: 0,
    Select: 0,
    Date: 0,
    Link: 0,
    Money: 0,
    Calculation: 0,
  };

  for (const p of patterns) {
    counts[p.annotationType]++;
  }

  return counts;
}

// ----------------------------------------------------------------------------
// Export for Testing
// ----------------------------------------------------------------------------

export const _testExports = {
  PATTERN_FILE_PATHS,
  findPatternsFile,
  validatePattern,
  parsePatternsFile,
};

/**
 * Headless Smart Annotator - Main Entry Point
 *
 * Network-isolated annotator service that runs without external dependencies.
 * - No Supabase database calls
 * - No Claude AI API calls
 * - Patterns loaded from mounted JSON file
 * - Rule-based detection only
 *
 * Usage:
 *   import { annotateHeadless } from '@/lib/annotator/headless';
 *   const result = await annotateHeadless(file);
 */

import type { AnnotationType, AnnotationSuggestion } from '@/types/annotator';
import { parseDocx, generateAnnotatedDocxPreservingFormat, type HighlightedRegion } from '../document-service';
import {
  convertDuplicatesToLinks,
  removeOverlappingSuggestions,
  findPartyNameDuplicates,
} from '../services/link-detection';
import { autoDetectPlaceholdersHeadless, type PlaceholderDetectionResult } from './placeholder-detection-headless';
import { loadPatterns, getLoadedPatterns, type PatternLoadResult } from './pattern-loader';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface AnnotateHeadlessOptions {
  /** Skip link conversion (for testing) */
  skipLinkConversion?: boolean;
  /** Skip deduplication (for testing) */
  skipDeduplication?: boolean;
}

export interface AnnotateHeadlessResult {
  /** Annotated DOCX file as Blob */
  annotatedDocx: Blob;
  /** All suggestions applied */
  suggestions: AnnotationSuggestion[];
  /** Statistics about the annotation process */
  stats: {
    totalSuggestions: number;
    byType: Record<AnnotationType, number>;
    patternsLoaded: number;
    processingTimeMs: number;
  };
}

export interface AnnotateHeadlessError {
  code: 'PARSE_ERROR' | 'DETECTION_ERROR' | 'GENERATION_ERROR' | 'UNKNOWN_ERROR';
  message: string;
  details?: string;
}

// ----------------------------------------------------------------------------
// Main Function
// ----------------------------------------------------------------------------

/**
 * Annotate a DOCX file in headless mode (no external network calls).
 *
 * Flow:
 * 1. Load patterns from JSON file
 * 2. Parse DOCX to extract text and highlighted regions
 * 3. Auto-detect placeholders using rule-based detection
 * 4. Find party name duplicates
 * 5. Remove overlapping suggestions
 * 6. Convert duplicates to Links
 * 7. Generate annotated DOCX
 *
 * @param file DOCX file as File or Buffer
 * @param options Optional configuration
 * @returns Annotated DOCX and statistics
 */
export async function annotateHeadless(
  file: File | Buffer,
  options: AnnotateHeadlessOptions = {}
): Promise<AnnotateHeadlessResult> {
  const startTime = Date.now();

  // Step 1: Load patterns from JSON
  const patternResult = loadPatterns();
  if (!patternResult.success && patternResult.error) {
    console.warn(`[annotateHeadless] Pattern loading warning: ${patternResult.error}`);
  }
  const patternsLoaded = patternResult.patterns.length;
  console.log(`[annotateHeadless] Loaded ${patternsLoaded} patterns`);

  // Step 2: Parse DOCX
  let documentText: string;
  let highlightedRegions: HighlightedRegion[];
  let docxBuffer: Buffer;

  try {
    // Convert File to Buffer if needed
    if (file instanceof File) {
      const arrayBuffer = await file.arrayBuffer();
      docxBuffer = Buffer.from(arrayBuffer);
    } else {
      docxBuffer = file;
    }

    const parseResult = await parseDocx(docxBuffer);
    documentText = parseResult.text;
    highlightedRegions = parseResult.highlightedRegions || [];

    console.log(`[annotateHeadless] Parsed document: ${documentText.length} chars, ${highlightedRegions.length} highlighted regions`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown parse error';
    throw {
      code: 'PARSE_ERROR',
      message: 'Failed to parse DOCX file',
      details: message,
    } as AnnotateHeadlessError;
  }

  // Step 3: Auto-detect placeholders
  let detectionResult: PlaceholderDetectionResult;

  try {
    detectionResult = autoDetectPlaceholdersHeadless({
      documentText,
      existingSuggestions: [],
      highlightedRegions,
    });

    console.log(`[annotateHeadless] Detected ${detectionResult.suggestions.length} placeholders`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown detection error';
    throw {
      code: 'DETECTION_ERROR',
      message: 'Failed to detect placeholders',
      details: message,
    } as AnnotateHeadlessError;
  }

  let suggestions = detectionResult.suggestions;

  // Step 4: Find party name duplicates
  if (!options.skipDeduplication) {
    try {
      const partyDuplicates = findPartyNameDuplicates(suggestions, documentText);
      if (partyDuplicates.length > 0) {
        console.log(`[annotateHeadless] Found ${partyDuplicates.length} party name duplicates`);
        suggestions = [...suggestions, ...partyDuplicates];
      }
    } catch (err) {
      console.warn(`[annotateHeadless] Party name detection warning: ${err}`);
    }
  }

  // Step 5: Remove overlapping suggestions
  if (!options.skipDeduplication) {
    const beforeCount = suggestions.length;
    suggestions = removeOverlappingSuggestions(suggestions);
    const afterCount = suggestions.length;
    if (beforeCount !== afterCount) {
      console.log(`[annotateHeadless] Removed ${beforeCount - afterCount} overlapping suggestions`);
    }
  }

  // Step 6: Sort by position and convert duplicates to Links
  suggestions.sort((a, b) => a.position.start - b.position.start);

  if (!options.skipLinkConversion) {
    suggestions = convertDuplicatesToLinks(suggestions, documentText);
  }

  // Step 7: Generate annotated DOCX
  let annotatedDocx: Blob;

  try {
    // Convert suggestions to replacement pairs
    const replacements = suggestions.map(s => ({
      original: s.originalText,
      replacement: s.annotatedText,
    }));

    annotatedDocx = await generateAnnotatedDocxPreservingFormat(docxBuffer, replacements);
    console.log(`[annotateHeadless] Generated annotated DOCX`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown generation error';
    throw {
      code: 'GENERATION_ERROR',
      message: 'Failed to generate annotated DOCX',
      details: message,
    } as AnnotateHeadlessError;
  }

  // Calculate final statistics
  const byType: Record<AnnotationType, number> = {
    Text: 0,
    TextInput: 0,
    Select: 0,
    Date: 0,
    Link: 0,
    Money: 0,
    Calculation: 0,
  };

  for (const s of suggestions) {
    byType[s.type]++;
  }

  const processingTimeMs = Date.now() - startTime;

  console.log(`[annotateHeadless] Complete: ${suggestions.length} suggestions in ${processingTimeMs}ms`);

  return {
    annotatedDocx,
    suggestions,
    stats: {
      totalSuggestions: suggestions.length,
      byType,
      patternsLoaded,
      processingTimeMs,
    },
  };
}

// ----------------------------------------------------------------------------
// Utility Exports
// ----------------------------------------------------------------------------

export { loadPatterns, getLoadedPatterns, type PatternLoadResult } from './pattern-loader';
export { autoDetectPlaceholdersHeadless, type PlaceholderDetectionResult } from './placeholder-detection-headless';
export { classifySlashPatternsLocal, type SlashPatternDecision } from './slash-pattern-headless';
export { classifyUnderscoresLocal, type UnderscoreDecision } from './underscore-detection-headless';
export { getTypeRules, getRulesByCategory, TOTAL_RULES } from './type-rules-local';
export {
  checkDateContextBeforeLocal,
  checkMoneyContextAfterLocal,
  isGermanGenderPatternLocal,
  shouldSkipSlashPatternLocal,
  isInstructionTextLocal,
  inferAnnotationTypeLocal,
} from './type-rules-sync';

// ----------------------------------------------------------------------------
// Health Check
// ----------------------------------------------------------------------------

/**
 * Check if the headless annotator is ready.
 * Returns true if patterns are loadable (even if empty).
 */
export function isHealthy(): boolean {
  try {
    const result = loadPatterns();
    // Success even if patterns array is empty (file not found is OK)
    return result.success || !result.error;
  } catch {
    return false;
  }
}

/**
 * Get service status information.
 */
export function getServiceStatus(): {
  healthy: boolean;
  patternsLoaded: number;
  patternsFile: string | null;
  version: string;
} {
  const result = loadPatterns();

  return {
    healthy: result.success || !result.error,
    patternsLoaded: result.patterns.length,
    patternsFile: result.loadedFrom || null,
    version: '1.0.0',
  };
}

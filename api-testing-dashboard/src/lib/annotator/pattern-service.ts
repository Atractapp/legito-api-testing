/**
 * Pattern Service - Pattern extraction, matching, and confidence management
 *
 * Handles learning patterns from training pairs and applying them to new documents
 */

import type {
  Pattern,
  AnnotationType,
  PatternMatch,
  PatternStats,
} from '@/types/annotator';
import {
  diffDocuments,
  detectAnnotationType,
  extractLabel,
  extractSelectOptions,
} from './document-service';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface PatternExtractionResult {
  patterns: Omit<Pattern, 'id' | 'userId' | 'createdAt'>[];
  summary: {
    total: number;
    byType: Record<AnnotationType, number>;
  };
}

export interface PatternApplicationResult {
  matches: PatternMatch[];
  unmatched: Pattern[];
  coverage: number;
}

// ----------------------------------------------------------------------------
// Pattern Extraction
// ----------------------------------------------------------------------------

/**
 * Extract patterns from a training pair (original + annotated document)
 */
export function extractPatterns(
  originalText: string,
  annotatedText: string,
  trainingPairId?: string
): PatternExtractionResult {
  const { annotations } = diffDocuments(originalText, annotatedText);
  const patterns: Omit<Pattern, 'id' | 'userId' | 'createdAt'>[] = [];

  for (const annotation of annotations) {
    // Get context around the annotation
    const contextBefore = getContextBefore(annotatedText, annotation.position.start);
    const contextAfter = getContextAfter(
      annotatedText,
      annotation.position.end || annotation.position.start + annotation.annotatedText.length
    );

    patterns.push({
      originalText: annotation.originalText,
      annotatedText: annotation.annotatedText,
      annotationType: annotation.type,
      contextBefore,
      contextAfter,
      confidence: 1.0, // Initial confidence
      usageCount: 1,
      successRate: 1.0,
      trainingPairId: trainingPairId || null,
    });
  }

  // Calculate summary
  const summary = {
    total: patterns.length,
    byType: countByType(patterns),
  };

  return { patterns, summary };
}

/**
 * Get context before a position (up to 100 chars, word-bounded)
 */
function getContextBefore(text: string, position: number, maxLength = 100): string {
  const start = Math.max(0, position - maxLength);
  let context = text.substring(start, position);

  // Trim to word boundary
  const firstSpace = context.indexOf(' ');
  if (firstSpace > 0 && firstSpace < context.length / 2) {
    context = context.substring(firstSpace + 1);
  }

  return context.trim();
}

/**
 * Get context after a position (up to 100 chars, word-bounded)
 */
function getContextAfter(text: string, position: number, maxLength = 100): string {
  const end = Math.min(text.length, position + maxLength);
  let context = text.substring(position, end);

  // Trim to word boundary
  const lastSpace = context.lastIndexOf(' ');
  if (lastSpace > context.length / 2) {
    context = context.substring(0, lastSpace);
  }

  return context.trim();
}

/**
 * Count patterns by type
 */
function countByType(
  patterns: Array<{ annotationType: AnnotationType }>
): Record<AnnotationType, number> {
  const counts: Record<AnnotationType, number> = {
    Text: 0,
    TextInput: 0,
    Select: 0,
    Date: 0,
    Link: 0,
    Money: 0,
    Calculation: 0,
  };

  for (const pattern of patterns) {
    counts[pattern.annotationType]++;
  }

  return counts;
}

// ----------------------------------------------------------------------------
// Pattern Matching
// ----------------------------------------------------------------------------

/**
 * Find where patterns should be applied in a document
 */
export function findPatternMatches(
  documentText: string,
  patterns: Pattern[]
): PatternApplicationResult {
  const matches: PatternMatch[] = [];
  const matchedPatternIds = new Set<string>();

  for (const pattern of patterns) {
    // Try to find the original text in the document
    const matchPositions = findAllOccurrences(documentText, pattern.originalText);

    for (const position of matchPositions) {
      // Verify context matches
      const contextMatches = verifyContext(
        documentText,
        position,
        pattern.originalText.length,
        pattern.contextBefore,
        pattern.contextAfter
      );

      if (contextMatches) {
        const confidence = calculateMatchConfidence(
          pattern,
          contextMatches.beforeScore,
          contextMatches.afterScore
        );

        matches.push({
          pattern,
          matchPosition: {
            start: position,
            end: position + pattern.originalText.length,
          },
          matchedText: pattern.originalText,
          suggestedAnnotation: pattern.annotatedText,
          confidence,
        });

        matchedPatternIds.add(pattern.id);
      }
    }
  }

  // Find unmatched patterns
  const unmatched = patterns.filter((p) => !matchedPatternIds.has(p.id));

  // Calculate coverage
  const coverage = patterns.length > 0
    ? matchedPatternIds.size / patterns.length
    : 0;

  // Sort matches by position
  matches.sort((a, b) => a.matchPosition.start - b.matchPosition.start);

  // Remove overlapping matches (keep higher confidence)
  const dedupedMatches = removeOverlappingMatches(matches);

  return {
    matches: dedupedMatches,
    unmatched,
    coverage,
  };
}

/**
 * Find all occurrences of a substring in text
 */
function findAllOccurrences(text: string, substring: string): number[] {
  const positions: number[] = [];
  let pos = 0;

  // Case-insensitive search for better matching
  const lowerText = text.toLowerCase();
  const lowerSubstring = substring.toLowerCase();

  while ((pos = lowerText.indexOf(lowerSubstring, pos)) !== -1) {
    positions.push(pos);
    pos += 1;
  }

  return positions;
}

/**
 * Verify that the context around a match is similar to the pattern context
 */
function verifyContext(
  text: string,
  position: number,
  matchLength: number,
  expectedBefore: string | null,
  expectedAfter: string | null
): { beforeScore: number; afterScore: number } | null {
  const actualBefore = getContextBefore(text, position);
  const actualAfter = getContextAfter(text, position + matchLength);

  const beforeScore = expectedBefore
    ? calculateSimilarity(actualBefore, expectedBefore)
    : 1.0;
  const afterScore = expectedAfter
    ? calculateSimilarity(actualAfter, expectedAfter)
    : 1.0;

  // Require at least 30% context similarity
  const threshold = 0.3;
  if (beforeScore < threshold && afterScore < threshold) {
    return null;
  }

  return { beforeScore, afterScore };
}

/**
 * Calculate text similarity (simple Jaccard-like similarity)
 */
function calculateSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0;

  const words1 = new Set(text1.toLowerCase().split(/\s+/).filter(Boolean));
  const words2 = new Set(text2.toLowerCase().split(/\s+/).filter(Boolean));

  if (words1.size === 0 && words2.size === 0) return 1;
  if (words1.size === 0 || words2.size === 0) return 0;

  const intersection = new Set([...words1].filter((w) => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

/**
 * Calculate confidence for a match based on pattern and context scores
 */
function calculateMatchConfidence(
  pattern: Pattern,
  contextBeforeScore: number,
  contextAfterScore: number
): number {
  // Base confidence from pattern
  const baseConfidence = pattern.confidence * pattern.successRate;

  // Context similarity weight
  const contextWeight = 0.3;
  const contextScore = (contextBeforeScore + contextAfterScore) / 2;

  // Combined confidence
  return baseConfidence * (1 - contextWeight) + contextScore * contextWeight;
}

/**
 * Remove overlapping matches, keeping higher confidence ones
 */
function removeOverlappingMatches(matches: PatternMatch[]): PatternMatch[] {
  if (matches.length === 0) return matches;

  // Sort by start position, then by confidence (descending)
  const sorted = [...matches].sort((a, b) => {
    if (a.matchPosition.start !== b.matchPosition.start) {
      return a.matchPosition.start - b.matchPosition.start;
    }
    return b.confidence - a.confidence;
  });

  const result: PatternMatch[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = result[result.length - 1];

    // Check for overlap
    if (current.matchPosition.start >= last.matchPosition.end) {
      result.push(current);
    } else if (current.confidence > last.confidence) {
      // Replace with higher confidence match
      result[result.length - 1] = current;
    }
    // Otherwise skip (keep the existing higher confidence match)
  }

  return result;
}

// ----------------------------------------------------------------------------
// Confidence Management
// ----------------------------------------------------------------------------

/**
 * Update pattern confidence based on user feedback
 */
export function updatePatternConfidence(
  pattern: Pattern,
  wasAccepted: boolean
): { confidence: number; successRate: number } {
  const newUsageCount = pattern.usageCount + 1;

  // Update success rate
  const successCount = pattern.successRate * pattern.usageCount;
  const newSuccessCount = wasAccepted ? successCount + 1 : successCount;
  const newSuccessRate = newSuccessCount / newUsageCount;

  // Update confidence with decay for rejections
  let newConfidence = pattern.confidence;
  if (wasAccepted) {
    // Small boost for acceptance (max 1.0)
    newConfidence = Math.min(1.0, pattern.confidence + 0.02);
  } else {
    // Larger penalty for rejection
    newConfidence = Math.max(0.1, pattern.confidence - 0.1);
  }

  return {
    confidence: newConfidence,
    successRate: newSuccessRate,
  };
}

/**
 * Calculate pattern stats from a list of patterns
 */
export function calculatePatternStats(patterns: Pattern[]): PatternStats {
  if (patterns.length === 0) {
    return {
      totalPatterns: 0,
      byType: {
        Text: 0,
        TextInput: 0,
        Select: 0,
        Date: 0,
        Link: 0,
        Money: 0,
        Calculation: 0,
      },
      averageConfidence: 0,
      averageSuccessRate: 0,
    };
  }

  const byType = countByType(patterns);

  const totalConfidence = patterns.reduce((sum, p) => sum + p.confidence, 0);
  const totalSuccessRate = patterns.reduce((sum, p) => sum + p.successRate, 0);

  return {
    totalPatterns: patterns.length,
    byType,
    averageConfidence: totalConfidence / patterns.length,
    averageSuccessRate: totalSuccessRate / patterns.length,
  };
}

// ----------------------------------------------------------------------------
// Pattern Deduplication
// ----------------------------------------------------------------------------

/**
 * Merge similar patterns to avoid duplicates
 */
export function deduplicatePatterns(
  existingPatterns: Pattern[],
  newPatterns: Omit<Pattern, 'id' | 'userId' | 'createdAt'>[]
): {
  toAdd: Omit<Pattern, 'id' | 'userId' | 'createdAt'>[];
  toUpdate: Array<{ id: string; updates: Partial<Pattern> }>;
} {
  const toAdd: Omit<Pattern, 'id' | 'userId' | 'createdAt'>[] = [];
  const toUpdate: Array<{ id: string; updates: Partial<Pattern> }> = [];

  for (const newPattern of newPatterns) {
    // Find similar existing pattern
    const similar = existingPatterns.find((existing) =>
      isSimilarPattern(existing, newPattern)
    );

    if (similar) {
      // Update existing pattern - increase usage count and adjust confidence
      toUpdate.push({
        id: similar.id,
        updates: {
          usageCount: similar.usageCount + 1,
          confidence: Math.min(1.0, similar.confidence + 0.05), // Small boost
        },
      });
    } else {
      toAdd.push(newPattern);
    }
  }

  return { toAdd, toUpdate };
}

/**
 * Check if two patterns are similar enough to merge
 */
function isSimilarPattern(
  pattern1: Pattern | Omit<Pattern, 'id' | 'userId' | 'createdAt'>,
  pattern2: Omit<Pattern, 'id' | 'userId' | 'createdAt'>
): boolean {
  // Same annotation type
  if (pattern1.annotationType !== pattern2.annotationType) {
    return false;
  }

  // Same annotated text
  if (pattern1.annotatedText !== pattern2.annotatedText) {
    return false;
  }

  // Similar original text (at least 80% similarity)
  const textSimilarity = calculateSimilarity(
    pattern1.originalText,
    pattern2.originalText
  );

  return textSimilarity >= 0.8;
}

// ----------------------------------------------------------------------------
// Pattern Filtering
// ----------------------------------------------------------------------------

/**
 * Filter patterns by type
 */
export function filterPatternsByType(
  patterns: Pattern[],
  types: AnnotationType[]
): Pattern[] {
  if (types.length === 0) return patterns;
  return patterns.filter((p) => types.includes(p.annotationType));
}

/**
 * Filter patterns by confidence threshold
 */
export function filterPatternsByConfidence(
  patterns: Pattern[],
  minConfidence: number
): Pattern[] {
  return patterns.filter((p) => p.confidence >= minConfidence);
}

/**
 * Sort patterns by various criteria
 */
export function sortPatterns(
  patterns: Pattern[],
  sortBy: 'confidence' | 'usageCount' | 'successRate' | 'createdAt',
  order: 'asc' | 'desc' = 'desc'
): Pattern[] {
  const sorted = [...patterns].sort((a, b) => {
    const aValue = a[sortBy];
    const bValue = b[sortBy];

    if (aValue instanceof Date && bValue instanceof Date) {
      return aValue.getTime() - bValue.getTime();
    }

    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return aValue - bValue;
    }

    return 0;
  });

  return order === 'desc' ? sorted.reverse() : sorted;
}

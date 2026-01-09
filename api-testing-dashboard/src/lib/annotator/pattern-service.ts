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
 *
 * This extracts EVERY annotation from the annotated file and maps it to
 * what was in the original. The user teaches the system by example.
 *
 * Example:
 *   Original: "Creditor's name, address Creditor's address"
 *   Annotated: "[Textinput: Creditor's name], address [Textinput: Creditor's address]"
 *   Patterns: "Creditor's name" → "[Textinput: Creditor's name]"
 *             "Creditor's address" → "[Textinput: Creditor's address]"
 */
/**
 * Extract patterns from a training pair (original + annotated document)
 *
 * This extracts EVERY annotation from the annotated file and maps it to
 * what was in the original. The user teaches the system by example.
 *
 * IMPORTANT: Patterns NO LONGER store document context chunks.
 * Semantic context is generated separately by AI (see generateSemanticContext).
 */
export function extractPatterns(
  originalText: string,
  annotatedText: string,
  trainingPairId?: string
): PatternExtractionResult {
  const { annotations } = diffDocuments(originalText, annotatedText);
  const patterns: Omit<Pattern, 'id' | 'userId' | 'createdAt'>[] = [];

  console.log(`[extractPatterns] Processing ${annotations.length} annotations from diff`);

  for (const annotation of annotations) {
    // Skip if no original text (shouldn't happen but safety check)
    if (!annotation.originalText || !annotation.originalText.trim()) {
      console.log(`[extractPatterns] SKIP - empty original text for "${annotation.annotatedText}"`);
      continue;
    }

    // Skip if original equals annotated (no change)
    if (annotation.originalText === annotation.annotatedText) {
      console.log(`[extractPatterns] SKIP - no change: "${annotation.originalText}"`);
      continue;
    }

    patterns.push({
      originalText: annotation.originalText,
      annotatedText: annotation.annotatedText,
      annotationType: annotation.type,
      confidence: 1.0,
      usageCount: 1,
      successRate: 1.0,
      trainingPairId: trainingPairId || null,
      // semanticContext will be generated separately by AI
    });

    console.log(`[extractPatterns] Pattern: "${annotation.originalText}" → "${annotation.annotatedText}"`);
  }

  // Calculate summary
  const summary = {
    total: patterns.length,
    byType: countByType(patterns),
  };

  console.log(`[extractPatterns] Extracted ${patterns.length} patterns from ${annotations.length} annotations`);

  return { patterns, summary };
}


// Note: Context rules extraction and keyword matching removed - now using AI-generated semantic context

/**
 * Rule-based type detection from content and surrounding context
 * Returns detected type or null to let AI decide
 *
 * This function analyzes the text and its context to determine
 * the most appropriate annotation type based on patterns and keywords.
 */
export function detectTypeFromContent(
  text: string,
  contextBefore: string,
  contextAfter: string
): AnnotationType | null {
  const fullContext = `${contextBefore} ${text} ${contextAfter}`.toLowerCase();
  const textLower = text.toLowerCase();

  // === DATE DETECTION ===
  // Date patterns: DD.MM.YYYY, XX.XX.XXXX, DD/MM/YYYY, etc.
  if (/\d{1,2}[.\/\-]\d{1,2}[.\/\-]\d{2,4}/.test(text)) return 'Date';
  if (/\b(xx\.xx\.xxxx|dd\.mm\.yyyy|dd\/mm\/yyyy|mm\/dd\/yyyy)\b/i.test(text)) return 'Date';

  // Month names (full or abbreviated)
  if (/\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\b/i.test(text)) return 'Date';

  // Date context keywords with placeholder text
  const dateContextKeywords = /\b(dated?|as of|valid\s+(from|until|to)|effective|expires?|due\s*date|executed on|entered into on|starting|ending|commence|termination\s*date)\b/;
  if (dateContextKeywords.test(fullContext) && (text.includes('X') || text.includes('_') || /\d/.test(text) || text === '')) {
    return 'Date';
  }

  // === MONEY DETECTION ===
  // Currency symbols
  if (/[$€£¥]|Kč|\bCZK\b|\bEUR\b|\bUSD\b|\bGBP\b/.test(text)) return 'Money';

  // Currency codes near the text
  if (/\b(usd|eur|gbp|czk|chf|jpy|cad|aud)\b/i.test(text)) return 'Money';

  // Money context keywords with numeric/placeholder patterns
  const moneyContextKeywords = /\b(amount|price|sum|total|fee|cost|salary|wage|payment|rent|deposit|invoice|budget|balance|premium|rate|charge|compensation|remuneration)\b/;
  if (moneyContextKeywords.test(fullContext)) {
    // Check if text looks like an amount placeholder or number
    if (/\d+[.,]?\d*/.test(text) || /xxx|0[,.]00|\[amount\]|_{2,}/i.test(text)) {
      return 'Money';
    }
  }

  // === SELECT DETECTION ===
  // Explicit alternatives with / (but not URLs or paths)
  if (text.includes('/') && !text.includes('http') && !text.includes('://')) {
    const parts = text.split('/').map(p => p.trim());
    if (parts.length >= 2 && parts.length <= 5 && parts.every(p => p.length < 30 && p.length > 0)) {
      return 'Select';
    }
  }

  // Yes/No patterns
  if (/\b(yes|no|true|false|approve|reject|accept|decline)\b/i.test(textLower) && text.includes('/')) {
    return 'Select';
  }

  // Select context keywords
  if (/\b(choose|select|pick|circle|check)\s*(one|option|appropriate|from)/i.test(fullContext)) {
    return 'Select';
  }

  // === LINK DETECTION (References to earlier-defined entities) ===
  // Reference patterns for parties/entities
  const referencePatterns = /\b(the\s+)(buyer|seller|lessee|lessor|landlord|tenant|employer|employee|contractor|client|party|parties|creditor|debtor|lender|borrower|licensor|licensee|provider|recipient|vendor|customer)\b/i;
  if (referencePatterns.test(text)) {
    // Check it's NOT in a definition context (e.g., "Name, Address (hereinafter the Buyer)")
    const definitionContext = /\b(name|address|signature|represented by|with registered)\b/i;
    if (!definitionContext.test(fullContext)) {
      return 'Link';
    }
  }

  // Referential phrases
  if (/\b(aforementioned|hereinafter|referred\s+to|as\s+defined|see\s+section|above-mentioned|as\s+stated\s+above)\b/i.test(fullContext)) {
    return 'Link';
  }

  // === CALCULATION DETECTION ===
  if (/\b(total|sum|calculated|computed|aggregate)\s+(of|from|as)\b/i.test(fullContext)) {
    return 'Calculation';
  }
  // Mathematical operators with numbers
  if (/[+\-*÷×]/.test(text) && /\d/.test(text)) {
    return 'Calculation';
  }

  // === No confident detection - let AI decide ===
  return null;
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
 * Uses smart matching: for placeholder-like patterns, matches by context keywords
 * rather than exact text, allowing "In City, on" to match "In Paris, on"
 */
export function findPatternMatches(
  documentText: string,
  patterns: Pattern[]
): PatternApplicationResult {
  const matches: PatternMatch[] = [];
  const matchedPatternIds = new Set<string>();

  console.log(`[findPatternMatches] Searching for ${patterns.length} patterns in ${documentText.length} chars`);

  for (const pattern of patterns) {
    console.log(`[findPatternMatches] Checking pattern: "${pattern.originalText}" → "${pattern.annotatedText}"`);
    console.log(`  Semantic context: "${pattern.semanticContext || 'none'}"`);

    // Simple exact text matching - context matching now done via AI semantic context
    const matchPositions = findAllOccurrences(documentText, pattern.originalText);

    for (const position of matchPositions) {
      matches.push({
        pattern,
        matchPosition: {
          start: position,
          end: position + pattern.originalText.length,
        },
        matchedText: pattern.originalText,
        suggestedAnnotation: pattern.annotatedText,
        confidence: pattern.confidence,
      });

      matchedPatternIds.add(pattern.id);
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

// Note: Context-based smart matching removed - now using AI semantic context + preprocessor

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
 * Check if two patterns are similar enough to merge.
 *
 * STRICT DEDUPLICATION: Only consider patterns as duplicates if BOTH:
 * 1. Original text is the same (or very similar)
 * 2. Annotated text is the same
 *
 * This allows the same original text (e.g., "Creditor's name") to have
 * multiple annotations (e.g., [TextInput] for first occurrence, [Link] for signature).
 */
function isSimilarPattern(
  pattern1: Pattern | Omit<Pattern, 'id' | 'userId' | 'createdAt'>,
  pattern2: Omit<Pattern, 'id' | 'userId' | 'createdAt'>
): boolean {
  // BOTH original AND annotated text must match to be considered a duplicate

  // Check annotated text - must be exactly the same
  if (pattern1.annotatedText !== pattern2.annotatedText) {
    return false;
  }

  // Check original text - must be same or very similar (90%+)
  const textSimilarity = calculateSimilarity(
    pattern1.originalText.toLowerCase(),
    pattern2.originalText.toLowerCase()
  );

  return textSimilarity >= 0.9;
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

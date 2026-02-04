/**
 * Semantic Matching Service
 *
 * Provides fuzzy pattern matching using semantic_context alternatives.
 * Phase 2 of the Improvement Opportunities implementation.
 *
 * Key features:
 * - Parse semantic_context to extract alternatives and signals
 * - Match document text against pattern alternatives (not just original_text)
 * - Score matches by semantic similarity
 * - Case-insensitive matching with normalization
 */

import type { AnnotationType, TrainedPattern } from '@/types/annotator';

/**
 * Parsed semantic context structure
 */
export interface ParsedSemanticContext {
  description: string;
  alternatives: string[];
  matchSignals: string[];
}

/**
 * Match result with similarity score
 */
export interface SemanticMatch {
  pattern: TrainedPattern;
  matchedText: string; // The text in the document that matched
  matchType: 'exact' | 'alternative' | 'signal' | 'fuzzy';
  similarity: number; // 0-100 score
  position: { start: number; end: number };
}

/**
 * Parse semantic_context string into structured data
 *
 * Input format: "Description text... Could match: Alt1, Alt2, Alt3"
 * Output: { description: "Description text...", alternatives: ["Alt1", "Alt2", "Alt3"], matchSignals: [] }
 */
export function parseSemanticContext(semanticContext: string | null | undefined): ParsedSemanticContext {
  if (!semanticContext || typeof semanticContext !== 'string') {
    return { description: '', alternatives: [], matchSignals: [] };
  }

  const result: ParsedSemanticContext = {
    description: '',
    alternatives: [],
    matchSignals: [],
  };

  // Split by "Could match:" to get description and alternatives
  const couldMatchIndex = semanticContext.indexOf('Could match:');

  if (couldMatchIndex === -1) {
    // No alternatives section, entire string is description
    result.description = semanticContext.trim();
    return result;
  }

  result.description = semanticContext.substring(0, couldMatchIndex).trim();
  const alternativesStr = semanticContext.substring(couldMatchIndex + 'Could match:'.length).trim();

  // Parse alternatives (comma-separated)
  if (alternativesStr) {
    result.alternatives = alternativesStr
      .split(',')
      .map(alt => alt.trim())
      .filter(alt => alt.length > 0 && alt.length < 100); // Filter out empty and overly long entries
  }

  // Extract match signals from description
  // These are key terms that indicate what kind of field this is
  const signalPatterns = [
    /\b(date|time|when|deadline|period)\b/gi,
    /\b(name|party|person|company|entity)\b/gi,
    /\b(amount|price|sum|cost|fee|money|currency|payment)\b/gi,
    /\b(address|location|city|state|country)\b/gi,
    /\b(number|id|reference|code)\b/gi,
    /\b(select|choose|option|alternative)\b/gi,
  ];

  for (const pattern of signalPatterns) {
    const matches = result.description.match(pattern);
    if (matches) {
      result.matchSignals.push(...matches.map(m => m.toLowerCase()));
    }
  }

  // Deduplicate signals
  result.matchSignals = [...new Set(result.matchSignals)];

  return result;
}

/**
 * Normalize text for comparison
 * - Lowercase
 * - Remove extra whitespace
 * - Normalize punctuation
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[''`]/g, "'") // Normalize apostrophes
    .replace(/[""]/g, '"')  // Normalize quotes
    .trim();
}

/**
 * Calculate similarity score between two strings (0-100)
 * Uses a combination of exact match, prefix match, and Levenshtein distance
 */
export function calculateSimilarity(str1: string, str2: string): number {
  const norm1 = normalizeText(str1);
  const norm2 = normalizeText(str2);

  // Exact match
  if (norm1 === norm2) return 100;

  // Contains match
  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    const longer = norm1.length > norm2.length ? norm1 : norm2;
    const shorter = norm1.length > norm2.length ? norm2 : norm1;
    return Math.round((shorter.length / longer.length) * 90);
  }

  // Word-based matching
  const words1 = norm1.split(/\s+/);
  const words2 = norm2.split(/\s+/);
  const commonWords = words1.filter(w => words2.includes(w));

  if (commonWords.length > 0) {
    const avgLength = (words1.length + words2.length) / 2;
    return Math.round((commonWords.length / avgLength) * 75);
  }

  // Simple character-based similarity for short strings
  const maxLen = Math.max(norm1.length, norm2.length);
  if (maxLen === 0) return 0;

  let matches = 0;
  for (let i = 0; i < Math.min(norm1.length, norm2.length); i++) {
    if (norm1[i] === norm2[i]) matches++;
  }

  return Math.round((matches / maxLen) * 50);
}

/**
 * Find semantic matches for a pattern in document text
 * Searches for original_text and all alternatives from semantic_context
 */
export function findSemanticMatches(
  pattern: TrainedPattern,
  documentText: string,
  minSimilarity: number = 70
): SemanticMatch[] {
  const matches: SemanticMatch[] = [];
  const documentTextLower = documentText.toLowerCase();
  const parsedContext = parseSemanticContext(pattern.semanticContext);

  // 1. Find exact matches for original text (highest priority)
  const originalTextLower = pattern.originalText.toLowerCase();
  let searchPos = 0;

  while (true) {
    const foundIndex = documentTextLower.indexOf(originalTextLower, searchPos);
    if (foundIndex === -1) break;

    const actualText = documentText.slice(foundIndex, foundIndex + pattern.originalText.length);

    matches.push({
      pattern,
      matchedText: actualText,
      matchType: 'exact',
      similarity: 100,
      position: {
        start: foundIndex,
        end: foundIndex + pattern.originalText.length,
      },
    });

    searchPos = foundIndex + pattern.originalText.length;
  }

  // 2. Find matches for alternatives from semantic_context
  for (const alternative of parsedContext.alternatives) {
    const altLower = alternative.toLowerCase();

    // Skip alternatives that are too short or too generic
    if (altLower.length < 3) continue;
    if (['the', 'and', 'for', 'with', 'this', 'that'].includes(altLower)) continue;

    searchPos = 0;
    while (true) {
      const foundIndex = documentTextLower.indexOf(altLower, searchPos);
      if (foundIndex === -1) break;

      // Check if this position overlaps with an existing exact match
      const overlapsExact = matches.some(
        m => m.matchType === 'exact' &&
             !(foundIndex >= m.position.end || foundIndex + alternative.length <= m.position.start)
      );

      if (!overlapsExact) {
        const actualText = documentText.slice(foundIndex, foundIndex + alternative.length);
        const similarity = calculateSimilarity(alternative, pattern.originalText);

        if (similarity >= minSimilarity) {
          matches.push({
            pattern,
            matchedText: actualText,
            matchType: 'alternative',
            similarity,
            position: {
              start: foundIndex,
              end: foundIndex + alternative.length,
            },
          });
        }
      }

      searchPos = foundIndex + alternative.length;
    }
  }

  // Sort matches by position
  matches.sort((a, b) => a.position.start - b.position.start);

  return matches;
}

/**
 * Infer annotation type from semantic signals
 * Boosts type confidence based on match signals in context
 */
export function inferTypeFromSignals(signals: string[]): {
  suggestedType: AnnotationType | null;
  confidence: number;
} {
  const typeSignals: Record<string, { type: AnnotationType; weight: number }[]> = {
    date: [{ type: 'Date', weight: 10 }],
    time: [{ type: 'Date', weight: 5 }],
    when: [{ type: 'Date', weight: 5 }],
    deadline: [{ type: 'Date', weight: 8 }],
    period: [{ type: 'Date', weight: 5 }],

    name: [{ type: 'TextInput', weight: 5 }],
    party: [{ type: 'TextInput', weight: 6 }],
    person: [{ type: 'TextInput', weight: 5 }],
    company: [{ type: 'TextInput', weight: 5 }],
    entity: [{ type: 'TextInput', weight: 5 }],

    amount: [{ type: 'Money', weight: 10 }],
    price: [{ type: 'Money', weight: 10 }],
    sum: [{ type: 'Money', weight: 8 }],
    cost: [{ type: 'Money', weight: 7 }],
    fee: [{ type: 'Money', weight: 8 }],
    money: [{ type: 'Money', weight: 10 }],
    currency: [{ type: 'Money', weight: 8 }],
    payment: [{ type: 'Money', weight: 7 }],

    address: [{ type: 'TextInput', weight: 6 }],
    location: [{ type: 'TextInput', weight: 5 }],
    city: [{ type: 'TextInput', weight: 6 }],
    state: [{ type: 'TextInput', weight: 5 }],
    country: [{ type: 'TextInput', weight: 5 }],

    number: [{ type: 'TextInput', weight: 5 }],
    id: [{ type: 'TextInput', weight: 5 }],
    reference: [{ type: 'TextInput', weight: 5 }],
    code: [{ type: 'TextInput', weight: 5 }],

    select: [{ type: 'Select', weight: 10 }],
    choose: [{ type: 'Select', weight: 8 }],
    option: [{ type: 'Select', weight: 7 }],
    alternative: [{ type: 'Select', weight: 6 }],
  };

  // Calculate weighted scores for each type
  const typeScores: Record<string, number> = {};

  for (const signal of signals) {
    const signalLower = signal.toLowerCase();
    if (typeSignals[signalLower]) {
      for (const { type, weight } of typeSignals[signalLower]) {
        typeScores[type] = (typeScores[type] || 0) + weight;
      }
    }
  }

  // Find the highest scoring type
  let bestType: AnnotationType | null = null;
  let bestScore = 0;

  for (const [type, score] of Object.entries(typeScores)) {
    if (score > bestScore) {
      bestScore = score;
      bestType = type as AnnotationType;
    }
  }

  // Convert score to confidence (0-100)
  const confidence = Math.min(100, bestScore * 5);

  return { suggestedType: bestType, confidence };
}

/**
 * Build a semantic index for faster pattern matching
 * Returns a map of normalized alternatives to their source patterns
 */
export function buildSemanticIndex(
  patterns: TrainedPattern[]
): Map<string, TrainedPattern[]> {
  const index = new Map<string, TrainedPattern[]>();

  for (const pattern of patterns) {
    // Index by original text
    const originalNorm = normalizeText(pattern.originalText);
    if (!index.has(originalNorm)) {
      index.set(originalNorm, []);
    }
    index.get(originalNorm)!.push(pattern);

    // Index by alternatives
    const parsed = parseSemanticContext(pattern.semanticContext);
    for (const alt of parsed.alternatives) {
      const altNorm = normalizeText(alt);
      if (altNorm.length >= 3) {
        if (!index.has(altNorm)) {
          index.set(altNorm, []);
        }
        index.get(altNorm)!.push(pattern);
      }
    }
  }

  return index;
}

/**
 * Fast lookup in semantic index
 */
export function lookupInSemanticIndex(
  text: string,
  index: Map<string, TrainedPattern[]>
): TrainedPattern[] {
  const textNorm = normalizeText(text);

  // Direct match
  if (index.has(textNorm)) {
    return index.get(textNorm)!;
  }

  // Partial match (text contains an indexed term)
  const matches: TrainedPattern[] = [];
  for (const [key, patterns] of index.entries()) {
    if (textNorm.includes(key) || key.includes(textNorm)) {
      matches.push(...patterns);
    }
  }

  // Deduplicate
  return [...new Set(matches)];
}

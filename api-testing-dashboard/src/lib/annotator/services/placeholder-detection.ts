/**
 * Placeholder Detection Service
 *
 * Auto-detects common placeholder formats in documents even without trained patterns.
 *
 * Detects:
 * - {PlaceholderName} - Legito/template style
 * - <<PlaceholderName>> - Legal template style
 * - [placeholder] - Bracketed placeholders
 * - Underscores _____ - Blank fields
 * - Date patterns DD.MM.YYYY
 * - Slash-separated options (Select fields)
 * - Highlighted text regions
 * - Calculation formulas (word*word)
 * - Bullet points as placeholders
 */

import Anthropic from '@anthropic-ai/sdk';
import type { AnnotationType, AnnotationSuggestion, TrainedPattern } from '@/types/annotator';
import type { HighlightedRegion } from '../document-service';
import {
  preloadRules,
  isGermanGenderPatternSync,
  shouldSkipSlashPatternSync,
  isInstructionTextSync,
} from '../type-rules-service';
import {
  parseSemanticContext,
  normalizeText,
  lookupInSemanticIndex,
  inferTypeFromSignals,
} from '../semantic-matching-service';
import { getLearnedSkipPatterns } from '../pattern-learning-service';
import { inferAnnotationFromPlaceholderName, type SlashPatternCandidate, analyzeSlashPatternsWithAI } from './index';

// Initialize Anthropic client for AI-based underscore classification
const anthropic = new Anthropic();

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface PlaceholderDetectionOptions {
  documentText: string;
  existingSuggestions: AnnotationSuggestion[];
  highlightedRegions?: HighlightedRegion[];
  semanticIndex?: Map<string, TrainedPattern[]>;
  userId?: string;
}

export interface PlaceholderDetectionResult {
  suggestions: AnnotationSuggestion[];
  stats: {
    totalDetected: number;
    byType: Record<AnnotationType, number>;
    skippedByLearnedPatterns: number;
  };
}

// ----------------------------------------------------------------------------
// Coverage Tracking Helpers
// ----------------------------------------------------------------------------

interface CoverageTracker {
  coveredPositions: Set<string>;
  existingSuggestions: AnnotationSuggestion[];
  isCovered: (pos: number) => boolean;
  isRangeCovered: (start: number, end: number) => boolean;
  isSubstringOfExisting: (start: number, end: number) => boolean;
  markCovered: (start: number, end: number) => void;
}

function createCoverageTracker(existingSuggestions: AnnotationSuggestion[]): CoverageTracker {
  const coveredPositions = new Set<string>();

  // Initialize with existing suggestion positions
  for (const s of existingSuggestions) {
    for (let i = s.position.start; i < s.position.end; i++) {
      coveredPositions.add(String(i));
    }
  }

  return {
    coveredPositions,
    existingSuggestions,
    isCovered: (pos: number) => coveredPositions.has(String(pos)),
    isRangeCovered: (start: number, end: number): boolean => {
      for (let i = start; i < end; i++) {
        if (coveredPositions.has(String(i))) return true;
      }
      return false;
    },
    isSubstringOfExisting: (start: number, end: number): boolean => {
      return existingSuggestions.some(
        (s) =>
          s.position.start <= start &&
          s.position.end >= end &&
          s.position.end - s.position.start > end - start
      );
    },
    markCovered: (start: number, end: number) => {
      for (let i = start; i < end; i++) {
        coveredPositions.add(String(i));
      }
    },
  };
}

// ----------------------------------------------------------------------------
// Label Extraction Helpers
// ----------------------------------------------------------------------------

/**
 * Get a meaningful label for TextInput, or null if the label is not meaningful.
 */
export function getMeaningfulLabel(text: string, contextBefore?: string): string | null {
  if (!text) return null;

  let trimmed = text.trim();
  if (trimmed.length === 0) return null;

  // Strip brackets (except parentheses)
  trimmed = trimmed.replace(/^[\[\]{}<>]+/, '').replace(/[\[\]{}<>]+$/, '');
  trimmed = trimmed.replace(/[\[\]{}<>]/g, '').trim();

  if (trimmed.length === 0) return null;

  // Non-meaningful patterns
  if (/^_+$/.test(trimmed)) return null;
  if (/^[Xx]+$/.test(trimmed)) return null;
  if (/^[Xx]+([.\/-][Xx]+)+$/.test(trimmed)) return null;
  if (/^[\*\#\?\.\-\s]+$/.test(trimmed)) return null;
  if (/^\d+$/.test(trimmed)) return null;
  if (/^\(\d+\)$/.test(trimmed) || /^\([a-zA-Z]\)$/.test(trimmed)) return null;
  if (/^[:\.,;!\?\-\s]+$/.test(trimmed)) return null;
  if (trimmed.length === 1 && !/^[A-Za-z]$/.test(trimmed)) return null;

  // Instruction text - keep full label
  if (isInstructionTextSync(trimmed)) {
    return trimmed;
  }

  // Long text without instruction keywords - try context
  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount > 5 && contextBefore) {
    const labelMatch = contextBefore.match(/([A-Za-z][A-Za-z\s]{2,20})[:.]?\s*$/);
    if (labelMatch) {
      return labelMatch[1].trim();
    }
    return null;
  }

  return trimmed;
}

/**
 * Check if a pattern's original text is a STRUCTURAL placeholder.
 */
function isStructuralPlaceholder(text: string): boolean {
  const trimmed = text.trim();

  // Brackets (short content only)
  if (/^[\[\{<].+[\]\}>]$/.test(trimmed) && trimmed.length < 100) return true;

  // Underscores (3+)
  if (/_{3,}/.test(trimmed)) return true;

  // X patterns
  if (/^[Xx]{2,}([.\/-][Xx]{2,})*$/.test(trimmed)) return true;

  // Date patterns
  if (/^[Dd]{1,2}[.\/-][Mm]{1,2}[.\/-][Yy]{2,4}$/.test(trimmed)) return true;

  // Placeholder symbols
  if (/^[*\#\?\.\-]+$/.test(trimmed)) return true;

  // Curly brace placeholders
  if (/^\{[^}]+\}$/.test(trimmed)) return true;

  // Template variables
  if (/^\{\{.+\}\}$/.test(trimmed) || /^<%[=\-]?\s*.+\s*%>$/.test(trimmed)) return true;

  return false;
}

// ----------------------------------------------------------------------------
// Semantic Index Helpers
// ----------------------------------------------------------------------------

interface SemanticMatchResult {
  type: AnnotationType | null;
  confidence: number;
  pattern?: TrainedPattern;
}

function inferFromSemanticIndex(
  text: string,
  semanticIndex?: Map<string, TrainedPattern[]>
): SemanticMatchResult {
  if (!semanticIndex || semanticIndex.size === 0) {
    return { type: null, confidence: 0 };
  }

  const normalizedText = normalizeText(text);
  const matchedPatterns = lookupInSemanticIndex(normalizedText, semanticIndex);

  if (matchedPatterns.length > 0) {
    const bestPattern = matchedPatterns[0];
    const parsed = parseSemanticContext(bestPattern.semanticContext);
    const signalInference = inferTypeFromSignals(parsed.matchSignals);
    const confidenceBoost = signalInference.confidence * 0.1;

    return {
      type: bestPattern.annotationType,
      confidence: Math.min(1, (bestPattern.confidence || 0.8) + confidenceBoost),
      pattern: bestPattern,
    };
  }

  return { type: null, confidence: 0 };
}

// ----------------------------------------------------------------------------
// Detection Functions by Pattern Type
// ----------------------------------------------------------------------------

/**
 * Detect calculation formulas (word*word)
 */
function detectCalculations(
  documentText: string,
  tracker: CoverageTracker
): AnnotationSuggestion[] {
  const detected: AnnotationSuggestion[] = [];
  const calcPattern = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\*\s*([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
  let match;

  while ((match = calcPattern.exec(documentText)) !== null) {
    const fullMatch = match[0];
    const position = match.index;

    if (tracker.isCovered(position)) continue;

    // Skip German gender patterns
    if (isGermanGenderPatternSync(fullMatch)) {
      console.log(`[detectCalculations] Skipping German gender pattern: "${fullMatch}"`);
      continue;
    }

    console.log(`[detectCalculations] Found "${fullMatch}" -> [Calculation]`);

    detected.push({
      id: crypto.randomUUID(),
      originalText: fullMatch,
      annotatedText: '[Calculation]',
      type: 'Calculation',
      position: { start: position, end: position + fullMatch.length },
      confidence: 0.9,
      isAccepted: true,
      isEdited: false,
    });

    tracker.markCovered(position, position + fullMatch.length);
  }

  return detected;
}

/**
 * Detect title Select patterns (Mr/Ms, D/Da, etc.)
 */
function detectTitlePatterns(
  documentText: string,
  tracker: CoverageTracker
): AnnotationSuggestion[] {
  const detected: AnnotationSuggestion[] = [];

  const titlePatterns = [
    { pattern: /\bMr\/Ms\.?/g, text: 'Mr/Ms', periodOutside: true },
    { pattern: /\bD\/Dª\.?/g, text: 'D/Dª.', periodOutside: false },
    { pattern: /\bHerr\/Frau/g, text: 'Herr/Frau', periodOutside: false },
    { pattern: /\bSr\.?\/Sra\.?/g, text: 'Sr./Sra.', periodOutside: false },
  ];

  for (const { pattern, text, periodOutside } of titlePatterns) {
    let titleMatch;
    while ((titleMatch = pattern.exec(documentText)) !== null) {
      const position = titleMatch.index;
      if (tracker.isCovered(position)) continue;

      const matchedText = titleMatch[0];
      const hadPeriod = matchedText.endsWith('.');

      let annotatedText: string;
      if (periodOutside && hadPeriod) {
        annotatedText = `[Select: ${text}].`;
      } else {
        annotatedText = `[Select: ${text}]`;
      }

      console.log(`[detectTitlePatterns] Found "${matchedText}" -> ${annotatedText}`);

      detected.push({
        id: crypto.randomUUID(),
        originalText: matchedText,
        annotatedText,
        type: 'Select',
        position: { start: position, end: position + matchedText.length },
        confidence: 0.9,
        isAccepted: true,
        isEdited: false,
      });

      tracker.markCovered(position, position + matchedText.length);
    }
  }

  return detected;
}

/**
 * Detect XXX placeholder patterns
 */
function detectXxxPatterns(
  documentText: string,
  tracker: CoverageTracker,
  highlightedRegions: HighlightedRegion[]
): AnnotationSuggestion[] {
  const detected: AnnotationSuggestion[] = [];
  const xxxPattern = /\bXXX\b/g;
  let match;

  while ((match = xxxPattern.exec(documentText)) !== null) {
    const position = match.index;
    if (tracker.isCovered(position)) continue;

    const contextAfter = documentText.slice(position + 3, position + 20);
    const currencyMatch = contextAfter.match(/^\s*(EUR|USD|CZK|GBP|CHF|€|\$|£|Kc)\b/i);
    const percentMatch = contextAfter.match(/^\s*%/);
    const endOfSentence = contextAfter.match(/^\s*[.,;:!?\n]/);

    const xxxIsHighlighted = highlightedRegions.some(
      (r) => r.position.start <= position && r.position.end >= position + 3
    );

    if (currencyMatch) {
      const fullLength = 3 + currencyMatch[0].length;
      const fullMatch = documentText.slice(position, position + fullLength);

      detected.push({
        id: crypto.randomUUID(),
        originalText: fullMatch,
        annotatedText: '[Money]',
        type: 'Money',
        position: { start: position, end: position + fullLength },
        confidence: 0.95,
        isAccepted: true,
        isEdited: false,
      });

      tracker.markCovered(position, position + fullLength);
    } else if (percentMatch) {
      detected.push({
        id: crypto.randomUUID(),
        originalText: 'XXX',
        annotatedText: '[Textinput]',
        type: 'TextInput',
        position: { start: position, end: position + 3 },
        confidence: 0.9,
        isAccepted: true,
        isEdited: false,
      });

      tracker.markCovered(position, position + 3);
    } else if (endOfSentence) {
      // Skip standalone XXX at end of sentence
      tracker.markCovered(position, position + 3);
    } else if (xxxIsHighlighted) {
      detected.push({
        id: crypto.randomUUID(),
        originalText: 'XXX',
        annotatedText: '[Money]',
        type: 'Money',
        position: { start: position, end: position + 3 },
        confidence: 0.85,
        isAccepted: true,
        isEdited: false,
      });

      tracker.markCovered(position, position + 3);
    }
    // Non-highlighted XXX without context -> skip
  }

  return detected;
}

/**
 * Detect curly brace placeholders {Name}
 */
function detectCurlyBracePlaceholders(
  documentText: string,
  tracker: CoverageTracker,
  semanticIndex?: Map<string, TrainedPattern[]>
): AnnotationSuggestion[] {
  const detected: AnnotationSuggestion[] = [];
  const curlyBracePattern = /\{([A-Za-z][A-Za-z0-9_]*)\}/g;
  let match;

  while ((match = curlyBracePattern.exec(documentText)) !== null) {
    const fullMatch = match[0];
    const placeholderName = match[1];
    const position = match.index;

    if (tracker.isCovered(position)) continue;

    const contextBefore = documentText.slice(Math.max(0, position - 150), position);
    const contextAfter = documentText.slice(
      position + fullMatch.length,
      position + fullMatch.length + 150
    );

    const semanticMatch = inferFromSemanticIndex(placeholderName, semanticIndex);
    let type: AnnotationType;
    let label: string;
    let confidence = 0.85;

    if (semanticMatch.type && semanticMatch.pattern) {
      type = semanticMatch.type;
      label = semanticMatch.pattern.annotatedText
        .replace(/^\[(TextInput|Date|Money|Select|Link|Calculation):\s*|\]$/gi, '')
        .replace(/^\[(TextInput|Date|Money|Select|Link|Calculation)\]$/i, placeholderName);
      confidence = semanticMatch.confidence;
    } else {
      const inferred = inferAnnotationFromPlaceholderName(placeholderName, contextBefore, contextAfter);
      type = inferred.type;
      label = inferred.label;
    }

    let annotatedText: string;
    if (type === 'Date') {
      annotatedText = '[Date]';
    } else if (type === 'Money') {
      annotatedText = '[Money]';
    } else if (type === 'Select') {
      annotatedText = `[Select: ${label}]`;
    } else {
      annotatedText = `[Textinput: ${label}]`;
    }

    detected.push({
      id: crypto.randomUUID(),
      originalText: fullMatch,
      annotatedText,
      type,
      position: { start: position, end: position + fullMatch.length },
      confidence,
      isAccepted: true,
      isEdited: false,
    });

    tracker.markCovered(position, position + fullMatch.length);
  }

  return detected;
}

/**
 * Detect angle bracket placeholders <<Name>>
 */
function detectAngleBracketPlaceholders(
  documentText: string,
  tracker: CoverageTracker,
  semanticIndex?: Map<string, TrainedPattern[]>
): AnnotationSuggestion[] {
  const detected: AnnotationSuggestion[] = [];
  const angleBracketPattern = /(\$)?<<([^<>]+)>>/g;
  const seenPlaceholders = new Map<string, { type: AnnotationType; label: string; annotatedText: string }>();
  let match;

  while ((match = angleBracketPattern.exec(documentText)) !== null) {
    const hasDollarPrefix = match[1] === '$';
    const placeholderName = match[2].trim();
    let fullMatch = match[0];
    let position = match.index;

    if (tracker.isCovered(position)) continue;

    const contextBefore = documentText.slice(Math.max(0, position - 150), position);
    const contextAfter = documentText.slice(
      position + fullMatch.length,
      position + fullMatch.length + 150
    );

    const normalizedName = placeholderName.toLowerCase();
    let annotatedText: string;
    let type: AnnotationType;
    let confidence = 0.9;

    if (seenPlaceholders.has(normalizedName)) {
      // Subsequent occurrence - keep original type, let convertDuplicatesToLinks decide
      // Angle-bracket <<...>> placeholders should remain TextInput, not become Links
      const firstOccurrence = seenPlaceholders.get(normalizedName)!;
      type = firstOccurrence.type;
      annotatedText = firstOccurrence.annotatedText;
    } else {
      // First occurrence
      const semanticMatch = inferFromSemanticIndex(placeholderName, semanticIndex);
      let label: string;

      if (semanticMatch.type && semanticMatch.pattern) {
        type = semanticMatch.type;
        label = semanticMatch.pattern.annotatedText
          .replace(/^\[(TextInput|Date|Money|Select|Link|Calculation):\s*|\]$/gi, '')
          .replace(/^\[(TextInput|Date|Money|Select|Link|Calculation)\]$/i, placeholderName);
        confidence = semanticMatch.confidence;
      } else {
        const inferred = inferAnnotationFromPlaceholderName(placeholderName, contextBefore, contextAfter);
        type = inferred.type;
        label = inferred.label;
      }

      // Handle $ prefix for Money
      if (hasDollarPrefix && type === 'Money') {
        annotatedText = '[Money]';
      } else if (hasDollarPrefix) {
        fullMatch = fullMatch.substring(1);
        position = position + 1;
        annotatedText = type === 'Date' ? '[Date]' : `[Textinput: ${label}]`;
      } else if (type === 'Date') {
        annotatedText = '[Date]';
      } else if (type === 'Money') {
        annotatedText = '[Money]';
      } else if (type === 'Select') {
        annotatedText = `[Select: ${label}]`;
      } else {
        annotatedText = `[Textinput: ${label}]`;
      }

      seenPlaceholders.set(normalizedName, { type, label, annotatedText });
    }

    detected.push({
      id: crypto.randomUUID(),
      originalText: fullMatch,
      annotatedText,
      type,
      position: { start: position, end: position + fullMatch.length },
      confidence,
      isAccepted: true,
      isEdited: false,
    });

    tracker.markCovered(position, position + fullMatch.length);
  }

  return detected;
}

/**
 * Detect bracketed placeholders [name]
 */
function detectBracketedPlaceholders(
  documentText: string,
  tracker: CoverageTracker
): AnnotationSuggestion[] {
  const detected: AnnotationSuggestion[] = [];
  const bracketPattern = /\[([^\[\]]{1,300})\]/g;
  let match;

  while ((match = bracketPattern.exec(documentText)) !== null) {
    const fullMatch = match[0];
    const content = match[1];
    const position = match.index;

    if (tracker.isCovered(position)) continue;
    if (tracker.isCovered(position + 1)) continue;

    // Skip existing annotations
    if (/^(TextInput|Textinput|Date|Money|Link|Select|Calculation|Number|Checkbox)/.test(content)) {
      continue;
    }

    // Skip section headers
    const isAllCapsHeader = /^[A-Z\s\d.,!?;:'"-]+$/.test(content) && content.length > 10;
    const isSignatureHeader = /\b(SIGNATURE|SIGNATURES|EXHIBIT|APPENDIX|FOLLOWING|PAGE|SECTION)\b/i.test(content);
    if (isAllCapsHeader || isSignatureHeader) {
      continue;
    }

    // Skip legal explanatory text in brackets (not real placeholders)
    // e.g., "[the Note, the Mortgage, and all other documents... referred to herein as...]"
    // Be careful NOT to skip instruction placeholders like "[insert description of services...]"
    const isLegalDefinition = content.length > 80 && (
      /\b(herein|hereinafter|collectively|referred to as|hereunder|thereof|hereof|hereby|pursuant)\b/i.test(content) ||
      /\b(as defined|means the|shall mean|is defined)\b/i.test(content)
    );
    if (isLegalDefinition) {
      console.log(`[detectBracketedPlaceholders] Skipping legal definition: "${content.substring(0, 50)}..."`);
      continue;
    }

    // Skip very long bracketed content (>150 chars) that doesn't start with action words
    // Keep instruction placeholders like "[insert...]", "[enter...]", "[add...]"
    const startsWithActionWord = /^(insert|enter|add|fill|type|specify|provide|input|beschreibung|einfügen|leistungs)/i.test(content);
    if (content.length > 150 && content.split(/\s+/).length > 15 && !startsWithActionWord) {
      console.log(`[detectBracketedPlaceholders] Skipping long text: "${content.substring(0, 50)}..."`);
      continue;
    }

    const isBlank = /^[_\*\s\-\.]+$/.test(content);
    const contextBefore = documentText.slice(Math.max(0, position - 100), position);
    const contextAfter = documentText.slice(position + fullMatch.length, position + fullMatch.length + 100);

    let label: string;
    let type: AnnotationType;

    if (isBlank) {
      const labelMatch = contextBefore.match(/([A-Za-z][A-Za-z\s]{2,20})[:.]?\s*$/);
      label = labelMatch ? labelMatch[1].trim() : 'Field';
      const inferred = inferAnnotationFromPlaceholderName(label, contextBefore, contextAfter);
      type = inferred.type;
    } else {
      label = content;
      const inferred = inferAnnotationFromPlaceholderName(content, contextBefore, contextAfter);
      type = inferred.type;
    }

    let annotatedText: string;
    if (type === 'Date') {
      annotatedText = '[Date]';
    } else if (type === 'Money') {
      annotatedText = '[Money]';
    } else {
      const meaningfulLabel = getMeaningfulLabel(label, contextBefore);
      annotatedText = meaningfulLabel ? `[Textinput: ${meaningfulLabel}]` : '[Textinput]';
    }

    detected.push({
      id: crypto.randomUUID(),
      originalText: fullMatch,
      annotatedText,
      type,
      position: { start: position, end: position + fullMatch.length },
      confidence: 0.8,
      isAccepted: true,
      isEdited: false,
    });

    tracker.markCovered(position, position + fullMatch.length);
  }

  return detected;
}

/**
 * Detect date patterns DD.MM.YYYY, XX.XX.XXXX
 */
function detectDatePatterns(
  documentText: string,
  tracker: CoverageTracker
): AnnotationSuggestion[] {
  const detected: AnnotationSuggestion[] = [];
  const datePatterns = [
    /\b[Dd]{1,2}[.\/-][Mm]{1,2}[.\/-][Yy]{2,4}\b/g,
    /\b[Xx]{2,4}[.\/-][Xx]{2,4}[.\/-][Xx]{2,4}\b/g,
  ];

  for (const pattern of datePatterns) {
    let match;
    while ((match = pattern.exec(documentText)) !== null) {
      const fullMatch = match[0];
      const position = match.index;

      if (tracker.isCovered(position)) continue;

      detected.push({
        id: crypto.randomUUID(),
        originalText: fullMatch,
        annotatedText: '[Date]',
        type: 'Date',
        position: { start: position, end: position + fullMatch.length },
        confidence: 0.9,
        isAccepted: true,
        isEdited: false,
      });

      tracker.markCovered(position, position + fullMatch.length);
    }
  }

  return detected;
}

/**
 * Detect bullet point placeholders (● symbol only, NOT asterisks)
 *
 * IMPORTANT: Do NOT detect asterisks (*) here because:
 * 1. Asterisks in German gender-neutral patterns (Autor*in) are NOT placeholders
 * 2. Asterisks in calculations (amount*rate) are handled by detectCalculations
 * 3. Standalone asterisks at line starts are rare and ambiguous
 *
 * Only detect ● (bullet point symbol) which is a clear placeholder indicator
 */
function detectBulletPlaceholders(
  documentText: string,
  tracker: CoverageTracker
): AnnotationSuggestion[] {
  const detected: AnnotationSuggestion[] = [];
  // Only detect actual bullet point symbol, NOT asterisks
  const bulletPattern = /●/g;
  let match;

  while ((match = bulletPattern.exec(documentText)) !== null) {
    const position = match.index;
    if (tracker.isCovered(position)) continue;

    detected.push({
      id: crypto.randomUUID(),
      originalText: match[0],
      annotatedText: '[Textinput]',
      type: 'TextInput',
      position: { start: position, end: position + 1 },
      confidence: 0.85,
      isAccepted: true,
      isEdited: false,
    });

    tracker.markCovered(position, position + 1);
  }

  return detected;
}

/**
 * Detect slash-separated patterns and analyze with AI
 */
async function detectSlashPatterns(
  documentText: string,
  tracker: CoverageTracker
): Promise<AnnotationSuggestion[]> {
  const detected: AnnotationSuggestion[] = [];
  const slashCandidates: SlashPatternCandidate[] = [];

  let slashIdx = 0;
  while ((slashIdx = documentText.indexOf('/', slashIdx)) !== -1) {
    if (tracker.isCovered(slashIdx)) {
      slashIdx++;
      continue;
    }

    // Skip date patterns
    const beforeChar = documentText[slashIdx - 1] || '';
    const afterChar = documentText[slashIdx + 1] || '';
    if (/\d/.test(beforeChar) && /\d/.test(afterChar)) {
      slashIdx++;
      continue;
    }

    // Expand to find full pattern
    let start = slashIdx;
    let wordCount = 0;
    while (start > 0 && /\s/.test(documentText[start - 1])) start--;

    while (start > 0 && wordCount < 5) {
      const prevChar = documentText[start - 1];
      if (/[.,:;!?\n\r\t()[\]{}]/.test(prevChar)) break;

      if (/\s/.test(prevChar)) {
        let wordStart = start - 1;
        while (wordStart > 0 && /\s/.test(documentText[wordStart - 1])) wordStart--;
        while (
          wordStart > 0 &&
          !/\s/.test(documentText[wordStart - 1]) &&
          !/[.,:;!?\n\r\t()[\]{}]/.test(documentText[wordStart - 1])
        )
          wordStart--;

        const prevWord = documentText.slice(wordStart, start).trim();

        if (/^(the|with|from|into|upon)$/i.test(prevWord)) break;
        if (/^(a|an)$/i.test(prevWord)) {
          const evenEarlier = documentText.slice(Math.max(0, wordStart - 10), wordStart).trim();
          if (!/\bby$/i.test(evenEarlier)) break;
        }
        if (
          /^[A-Z][a-z]+$/.test(prevWord) &&
          !/^(By|In|Or|And|Cash|Bank|Transfer|Check|Card|Wire|Account)$/i.test(prevWord)
        ) {
          break;
        }

        wordCount++;
      }
      start--;
    }
    while (start < slashIdx && /\s/.test(documentText[start])) start++;

    const beforeText = documentText.slice(start, slashIdx).trim();
    const beforeWordCount = beforeText.split(/\s+/).length;

    let end = slashIdx + 1;
    let afterWordCount = 0;
    const maxAfterWords = Math.max(beforeWordCount + 1, 4);

    while (end < documentText.length && afterWordCount < maxAfterWords) {
      const nextChar = documentText[end];
      if (/[.,:;!?\n\r\t()[\]{}]/.test(nextChar)) break;

      const wordAtEnd =
        documentText
          .slice(end, end + 15)
          .match(/^\s*(\w+)/)?.[1]
          ?.toLowerCase() || '';
      if (/^(deposited|transferred|paid|sent|into|to|from|by|the|a|an|and|or)$/i.test(wordAtEnd) && afterWordCount > 0) {
        if (wordAtEnd !== 'in' || afterWordCount >= 2) break;
      }

      if (/\s/.test(documentText[end - 1]) && !/\s/.test(nextChar)) afterWordCount++;
      end++;
    }
    while (end > slashIdx + 1 && /\s/.test(documentText[end - 1])) end--;

    const fullMatch = documentText.slice(start, end);
    const options = fullMatch
      .split('/')
      .map((o) => o.trim())
      .filter((o) => o.length > 0);

    if (options.length >= 2) {
      if (shouldSkipSlashPatternSync(fullMatch)) {
        slashIdx++;
        continue;
      }

      const maxLen = Math.max(...options.map((o) => o.length));
      const minLen = Math.min(...options.map((o) => o.length));
      const isBalanced = maxLen <= 40 && minLen >= 2 && maxLen / minLen < 10;

      const noSpaces = fullMatch.replace(/\s/g, '');
      const isDate =
        /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(noSpaces) ||
        /^[XxDdMmYy]{1,4}\/[XxDdMmYy]{1,4}\/[XxDdMmYy]{2,4}$/.test(noSpaces);

      if (isBalanced && !isDate && !tracker.isRangeCovered(start, end)) {
        const contextBefore = documentText.slice(Math.max(0, start - 50), start).trim();
        const contextAfter = documentText.slice(end, Math.min(documentText.length, end + 50)).trim();

        slashCandidates.push({
          pattern: fullMatch,
          contextBefore,
          contextAfter,
          position: { start, end },
        });

        tracker.markCovered(start, end);
        slashIdx = end;
        continue;
      }
    }
    slashIdx++;
  }

  // AI analysis for slash patterns
  if (slashCandidates.length > 0) {
    console.log(`[detectSlashPatterns] Analyzing ${slashCandidates.length} candidates with AI...`);
    const aiDecisions = await analyzeSlashPatternsWithAI(slashCandidates);

    for (const candidate of slashCandidates) {
      const isSelect = aiDecisions.get(candidate.pattern);
      if (isSelect) {
        detected.push({
          id: crypto.randomUUID(),
          originalText: candidate.pattern,
          annotatedText: `[Select: ${candidate.pattern}]`,
          type: 'Select',
          position: candidate.position,
          confidence: 0.85,
          isAccepted: true,
          isEdited: false,
        });
      }
    }
  }

  return detected;
}

/**
 * Detect highlighted text regions
 */
function detectHighlightedText(
  documentText: string,
  tracker: CoverageTracker,
  highlightedRegions: HighlightedRegion[],
  semanticIndex?: Map<string, TrainedPattern[]>
): AnnotationSuggestion[] {
  const detected: AnnotationSuggestion[] = [];
  const commonWordsToSkip = [
    'amount',
    'total',
    'the',
    'and',
    'or',
    'of',
    'in',
    'on',
    'at',
    'by',
    'for',
    'to',
    'from',
    'with',
  ];

  for (const region of highlightedRegions) {
    if (tracker.isRangeCovered(region.position.start, region.position.end)) continue;
    if (tracker.isSubstringOfExisting(region.position.start, region.position.end)) continue;

    let text = region.text.trim();
    let position = { ...region.position };

    // Verify position
    const actualText = documentText.slice(position.start, position.end);
    if (actualText !== region.text && !actualText.includes(region.text.trim())) {
      const correctPos = documentText.indexOf(region.text, Math.max(0, position.start - 50));
      if (correctPos !== -1 && correctPos < position.start + 50) {
        position.start = correctPos;
        position.end = correctPos + region.text.length;
      } else {
        continue;
      }
    }

    if (!text) continue;
    if (commonWordsToSkip.includes(text.toLowerCase())) continue;
    if (/^[()[\]{}<>"''"".,;:!?@#$%^&*+=|\\\/~`]+$/.test(text)) continue;
    if (text.length === 1 && !/[A-Za-z0-9]/.test(text)) continue;
    if (/\[(TextInput|Date|Money|Select|Link|Number|Checkbox|Calculation)/i.test(text)) continue;
    if (/\[[^\]]*$/.test(text) || /^[^\[]*\]/.test(text)) continue;

    // Expand brackets if needed
    const charBefore = documentText.charAt(position.start - 1);
    const charAfter = documentText.charAt(position.end);

    if (
      (charBefore === '[' && charAfter === ']') ||
      (charBefore === '{' && charAfter === '}') ||
      (charBefore === '<' && charAfter === '>') ||
      (charBefore === '(' && charAfter === ')')
    ) {
      position.start -= 1;
      position.end += 1;
      text = documentText.slice(position.start, position.end);
    }

    const wordCount = text.split(/\s+/).filter((w) => w.length > 0).length;
    const hasInstruction = isInstructionTextSync(text);
    const isStructural = isStructuralPlaceholder(text);

    if (!isStructural && !hasInstruction && wordCount >= 4) {
      continue;
    }

    const contextBefore = documentText.slice(Math.max(0, position.start - 100), position.start);
    const contextAfter = documentText.slice(position.end, position.end + 100);

    const semanticMatch = inferFromSemanticIndex(text, semanticIndex);
    let type: AnnotationType;
    let label: string;
    let confidence = 0.95;

    if (semanticMatch.type && semanticMatch.pattern) {
      type = semanticMatch.type;
      label = semanticMatch.pattern.annotatedText
        .replace(/^\[(TextInput|Date|Money|Select|Link|Calculation):\s*|\]$/gi, '')
        .replace(/^\[(TextInput|Date|Money|Select|Link|Calculation)\]$/i, text);
      confidence = semanticMatch.confidence;
    } else {
      const inferred = inferAnnotationFromPlaceholderName(text, contextBefore, contextAfter);
      type = inferred.type;
      label = inferred.label;
    }

    let annotatedText: string;
    if (type === 'Date') {
      annotatedText = '[Date]';
    } else if (type === 'Money') {
      annotatedText = '[Money]';
    } else {
      const meaningfulLabel = getMeaningfulLabel(label || text, contextBefore);
      annotatedText = meaningfulLabel ? `[Textinput: ${meaningfulLabel}]` : '[Textinput]';
    }

    if (/\[(TextInput|Date|Money|Select|Link)/i.test(text)) continue;
    if (/^\[(Textinput|Date|Money|Select|Link|Number|Checkbox|Calculation)[:\]]/.test(text)) continue;

    detected.push({
      id: crypto.randomUUID(),
      originalText: text,
      annotatedText,
      type,
      position,
      confidence,
      isAccepted: true,
      isEdited: false,
    });

    tracker.markCovered(position.start, position.end);
  }

  return detected;
}

/**
 * Detect underscores with AI classification
 */
async function detectUnderscores(
  documentText: string,
  tracker: CoverageTracker,
  highlightedRegions: HighlightedRegion[]
): Promise<AnnotationSuggestion[]> {
  const detected: AnnotationSuggestion[] = [];
  const underscorePattern = /_{5,}/g;

  // Check if document uses template syntax
  const templatePatterns = [/<<[^<>]+>>/, /\{\{[^{}]+\}\}/, /\{[A-Z][a-zA-Z]+\}/];
  const isTemplateDocument = templatePatterns.some((p) => p.test(documentText));

  interface UnderscoreCandidate {
    fullMatch: string;
    position: number;
    contextBefore: string;
    contextAfter: string;
    isHighlighted: boolean;
    textBeforeOnLine: string;
    textAfterOnLine: string;
  }

  const candidates: UnderscoreCandidate[] = [];
  let match;

  while ((match = underscorePattern.exec(documentText)) !== null) {
    const fullMatch = match[0];
    const position = match.index;

    if (tracker.isCovered(position)) continue;

    const isHighlighted = highlightedRegions.some(
      (r) => r.position.start <= position && r.position.end >= position + fullMatch.length
    );

    const contextBefore = documentText.slice(Math.max(0, position - 150), position);
    const contextAfter = documentText.slice(position + fullMatch.length, position + fullMatch.length + 150);

    const lineStart = contextBefore.lastIndexOf('\n');
    const textBeforeOnLine = contextBefore.slice(lineStart + 1).trim();
    const lineEnd = contextAfter.indexOf('\n');
    const textAfterOnLine = (lineEnd === -1 ? contextAfter : contextAfter.slice(0, lineEnd)).trim();

    // Quick filters
    if (isTemplateDocument && !isHighlighted) continue;
    if (fullMatch.length >= 20 && !isHighlighted) continue;

    // Highlighted underscores always included
    if (isHighlighted) {
      const lastNewline = contextBefore.lastIndexOf('\n');
      const textOnSameLine = contextBefore.slice(lastNewline + 1);
      const labelMatch = textOnSameLine.match(/([A-Za-z][A-Za-z ]{1,25})[:.]?[ \t]*$/);
      const label = labelMatch ? labelMatch[1].trim() : null;
      const { type } = inferAnnotationFromPlaceholderName(label || '', contextBefore, contextAfter);

      let annotatedText: string;
      if (type === 'Date') annotatedText = '[Date]';
      else if (type === 'Money') annotatedText = '[Money]';
      else if (label) annotatedText = `[Textinput: ${label}]`;
      else annotatedText = '[Textinput]';

      detected.push({
        id: crypto.randomUUID(),
        originalText: fullMatch,
        annotatedText,
        type,
        position: { start: position, end: position + fullMatch.length },
        confidence: 0.95,
        isAccepted: true,
        isEdited: false,
      });
      tracker.markCovered(position, position + fullMatch.length);
      continue;
    }

    candidates.push({
      fullMatch,
      position,
      contextBefore,
      contextAfter,
      isHighlighted,
      textBeforeOnLine,
      textAfterOnLine,
    });
  }

  // AI classification for remaining candidates
  if (candidates.length > 0) {
    console.log(`[detectUnderscores] Classifying ${candidates.length} candidates with AI`);

    const candidatesForAI = candidates.slice(0, 30).map((c, idx) => ({
      id: idx + 1,
      context: `...${c.contextBefore}[UNDERSCORES: ${c.fullMatch.length} chars]${c.contextAfter}...`,
      textBefore: c.textBeforeOnLine,
      textAfter: c.textAfterOnLine,
    }));

    const classificationPrompt = `You are analyzing underscore patterns in a legal/business document to determine if they are FILLABLE FIELDS or STRUCTURAL SIGNATURE LINES.

## FILLABLE FIELDS (annotate these) - SHORT underscores with INLINE labels:
- "Name: _____" - short underscores (5-15 chars) after a label with colon
- "Date: _____" - inline with text, clearly a form field
- "Amount: _____ EUR" - embedded in running text

## SIGNATURE LINES (DO NOT annotate) - LONG underscores for handwritten signatures:
- _______________________________ (20+ chars, standalone)
- Lines near "By", "Its", "Signature", "Witness", "Authorized"
- Lines at the END of documents (signature blocks)

## CRITICAL RULES:
1. Long underscores (20+ chars) are almost ALWAYS signature lines
2. "Place/Date" followed by underscores = SIGNATURE LINE (handwritten)
3. When in doubt, classify as STRUCTURAL (not fillable)

CANDIDATES TO CLASSIFY:
${JSON.stringify(candidatesForAI, null, 2)}

For each candidate, respond with JSON array:
[{"id": 1, "isFillable": true/false, "reason": "brief explanation", "label": "detected label or null"}]

ONLY return the JSON array.`;

    try {
      const aiResponse = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{ role: 'user', content: classificationPrompt }],
      });

      const responseText = aiResponse.content[0].type === 'text' ? aiResponse.content[0].text : '';
      let classifications: Array<{ id: number; isFillable: boolean; reason: string; label: string | null }> = [];

      try {
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          classifications = JSON.parse(jsonMatch[0]);
        }
      } catch {
        console.log('[detectUnderscores] Failed to parse AI response');
      }

      for (const classification of classifications) {
        const candidate = candidates[classification.id - 1];
        if (!candidate || !classification.isFillable) continue;

        const label = classification.label || null;
        const { type } = inferAnnotationFromPlaceholderName(label || '', candidate.contextBefore, candidate.contextAfter);

        let annotatedText: string;
        if (type === 'Date') annotatedText = '[Date]';
        else if (type === 'Money') annotatedText = '[Money]';
        else if (label) annotatedText = `[Textinput: ${label}]`;
        else annotatedText = '[Textinput]';

        detected.push({
          id: crypto.randomUUID(),
          originalText: candidate.fullMatch,
          annotatedText,
          type,
          position: { start: candidate.position, end: candidate.position + candidate.fullMatch.length },
          confidence: 0.85,
          isAccepted: true,
          isEdited: false,
        });
        tracker.markCovered(candidate.position, candidate.position + candidate.fullMatch.length);
      }
    } catch (err) {
      console.log(`[detectUnderscores] AI classification failed: ${err}`);

      // Fallback: simple heuristics
      for (const candidate of candidates) {
        const lastNewline = candidate.contextBefore.lastIndexOf('\n');
        const textOnSameLine = candidate.contextBefore.slice(lastNewline + 1);
        const labelMatch = textOnSameLine.match(/([A-Za-z][A-Za-z ]{1,25})[:.][ \t]*$/);

        if (labelMatch) {
          const label = labelMatch[1].trim();
          const { type } = inferAnnotationFromPlaceholderName(label, candidate.contextBefore, candidate.contextAfter);

          let annotatedText: string;
          if (type === 'Date') annotatedText = '[Date]';
          else if (type === 'Money') annotatedText = '[Money]';
          else annotatedText = `[Textinput: ${label}]`;

          detected.push({
            id: crypto.randomUUID(),
            originalText: candidate.fullMatch,
            annotatedText,
            type,
            position: { start: candidate.position, end: candidate.position + candidate.fullMatch.length },
            confidence: 0.75,
            isAccepted: true,
            isEdited: false,
          });
          tracker.markCovered(candidate.position, candidate.position + candidate.fullMatch.length);
        }
      }
    }
  }

  return detected;
}

// ----------------------------------------------------------------------------
// Main Detection Function
// ----------------------------------------------------------------------------

/**
 * Auto-detect common placeholder formats in document.
 */
export async function autoDetectPlaceholders(
  options: PlaceholderDetectionOptions
): Promise<PlaceholderDetectionResult> {
  const { documentText, existingSuggestions, highlightedRegions = [], semanticIndex, userId } = options;

  // Ensure type rules are loaded
  await preloadRules();

  // Load learned skip patterns
  const learnedSkipPatterns = userId ? await getLearnedSkipPatterns(userId) : [];
  if (learnedSkipPatterns.length > 0) {
    console.log(`[autoDetect] Loaded ${learnedSkipPatterns.length} learned skip patterns`);
  }

  // Helper to check learned skip patterns
  const shouldSkipByLearned = (text: string): { skip: boolean; reason?: string } => {
    const textLower = text.toLowerCase();
    for (const pattern of learnedSkipPatterns) {
      const patternLower = pattern.originalText.toLowerCase();
      let matched = false;

      switch (pattern.patternType) {
        case 'exact':
          matched = textLower === patternLower;
          break;
        case 'prefix':
          matched = textLower.startsWith(patternLower);
          break;
        case 'suffix':
          matched = textLower.endsWith(patternLower);
          break;
        case 'contains':
          matched = textLower.includes(patternLower);
          break;
        case 'regex':
          try {
            const regex = new RegExp(pattern.originalText, 'i');
            matched = regex.test(text);
          } catch {
            matched = false;
          }
          break;
      }

      if (matched) {
        return {
          skip: true,
          reason: pattern.reason || `Matched learned skip pattern: ${pattern.originalText}`,
        };
      }
    }
    return { skip: false };
  };

  const tracker = createCoverageTracker(existingSuggestions);
  const detected: AnnotationSuggestion[] = [];

  // Run detection in priority order

  // Priority 1: Calculations (must run first)
  detected.push(...detectCalculations(documentText, tracker));

  // Priority 2: Title patterns (Mr/Ms, etc.)
  detected.push(...detectTitlePatterns(documentText, tracker));

  // Priority 3: Slash patterns (async)
  detected.push(...(await detectSlashPatterns(documentText, tracker)));

  // Priority 4: XXX patterns
  detected.push(...detectXxxPatterns(documentText, tracker, highlightedRegions));

  // Priority 5: Highlighted text
  detected.push(...detectHighlightedText(documentText, tracker, highlightedRegions, semanticIndex));

  // Priority 6: Curly brace placeholders
  detected.push(...detectCurlyBracePlaceholders(documentText, tracker, semanticIndex));

  // Priority 7: Angle bracket placeholders
  detected.push(...detectAngleBracketPlaceholders(documentText, tracker, semanticIndex));

  // Priority 8: Underscores (async)
  detected.push(...(await detectUnderscores(documentText, tracker, highlightedRegions)));

  // Priority 9: Bracketed placeholders
  detected.push(...detectBracketedPlaceholders(documentText, tracker));

  // Priority 10: Date patterns
  detected.push(...detectDatePatterns(documentText, tracker));

  // Priority 11: Bullet placeholders
  detected.push(...detectBulletPlaceholders(documentText, tracker));

  // Filter by learned skip patterns
  let skippedCount = 0;
  const filtered = detected.filter((suggestion) => {
    const skipCheck = shouldSkipByLearned(suggestion.originalText);
    if (skipCheck.skip) {
      console.log(`[autoDetect] Skipping "${suggestion.originalText}" - ${skipCheck.reason}`);
      skippedCount++;
      return false;
    }
    return true;
  });

  // Calculate stats
  const byType: Record<AnnotationType, number> = {
    Text: 0,
    TextInput: 0,
    Select: 0,
    Date: 0,
    Link: 0,
    Money: 0,
    Calculation: 0,
  };

  for (const s of filtered) {
    byType[s.type]++;
  }

  return {
    suggestions: filtered,
    stats: {
      totalDetected: filtered.length,
      byType,
      skippedByLearnedPatterns: skippedCount,
    },
  };
}

/**
 * Headless Placeholder Detection Service
 *
 * Auto-detects common placeholder formats in documents without AI calls.
 * This is a network-isolated version of placeholder-detection.ts.
 *
 * Detects:
 * - {PlaceholderName} - Legito/template style
 * - <<PlaceholderName>> - Legal template style
 * - [placeholder] - Bracketed placeholders
 * - Underscores _____ - Blank fields (rule-based classification)
 * - Date patterns DD.MM.YYYY
 * - Slash-separated options (rule-based classification)
 * - Calculation formulas (word*word)
 * - Highlighted text regions
 *
 * NO AI CALLS - uses local rules and pattern matching only.
 */

import type { AnnotationType, AnnotationSuggestion } from '@/types/annotator';
import type { HighlightedRegion } from '../document-service';
import {
  isGermanGenderPatternLocal,
  shouldSkipSlashPatternLocal,
  isInstructionTextLocal,
  inferAnnotationTypeLocal,
} from './type-rules-sync';
import { getLoadedPatterns, findBestPattern } from './pattern-loader';
import {
  classifySlashPatternsLocal,
  getIsSelectMap,
  type SlashPatternCandidate,
} from './slash-pattern-headless';
import {
  classifyUnderscoresLocal,
  type UnderscoreCandidate,
} from './underscore-detection-headless';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface PlaceholderDetectionOptions {
  documentText: string;
  existingSuggestions: AnnotationSuggestion[];
  highlightedRegions?: HighlightedRegion[];
}

export interface PlaceholderDetectionResult {
  suggestions: AnnotationSuggestion[];
  stats: {
    totalDetected: number;
    byType: Record<AnnotationType, number>;
    patternsUsed: number;
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
// Type Inference from Context (local rules)
// ----------------------------------------------------------------------------

interface TypeInference {
  type: AnnotationType;
  label: string;
}

function inferAnnotationFromPlaceholderName(
  name: string,
  contextBefore: string,
  contextAfter: string
): TypeInference {
  // Use local rule-based inference
  const inference = inferAnnotationTypeLocal(name, contextBefore, contextAfter);

  if (inference.type) {
    return {
      type: inference.type,
      label: name,
    };
  }

  // Default to TextInput
  return {
    type: 'TextInput',
    label: name,
  };
}

// ----------------------------------------------------------------------------
// Label Extraction
// ----------------------------------------------------------------------------

function getMeaningfulLabel(text: string, contextBefore?: string): string | null {
  if (!text) return null;

  let trimmed = text.trim();
  if (trimmed.length === 0) return null;

  // Strip brackets
  trimmed = trimmed.replace(/^[\[\]{}<>]+/, '').replace(/[\[\]{}<>]+$/, '');
  trimmed = trimmed.replace(/[\[\]{}<>]/g, '').trim();

  if (trimmed.length === 0) return null;

  // Non-meaningful patterns
  if (/^_+$/.test(trimmed)) return null;
  if (/^[Xx]+$/.test(trimmed)) return null;
  if (/^[Xx]+([.\/-][Xx]+)+$/.test(trimmed)) return null;
  if (/^[*#?.\-\s]+$/.test(trimmed)) return null;
  if (/^\d+$/.test(trimmed)) return null;
  if (/^\(\d+\)$/.test(trimmed) || /^\([a-zA-Z]\)$/.test(trimmed)) return null;
  if (trimmed.length === 1 && !/^[A-Za-z]$/.test(trimmed)) return null;

  // Instruction text - keep full label
  if (isInstructionTextLocal(trimmed)) {
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

// ----------------------------------------------------------------------------
// Detection Functions
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
    if (isGermanGenderPatternLocal(fullMatch)) {
      continue;
    }

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
 * Detect title Select patterns (Mr/Ms, etc.)
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
  }

  return detected;
}

/**
 * Detect curly brace placeholders {Name}
 */
function detectCurlyBracePlaceholders(
  documentText: string,
  tracker: CoverageTracker
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

    const inferred = inferAnnotationFromPlaceholderName(placeholderName, contextBefore, contextAfter);

    let annotatedText: string;
    if (inferred.type === 'Date') {
      annotatedText = '[Date]';
    } else if (inferred.type === 'Money') {
      annotatedText = '[Money]';
    } else if (inferred.type === 'Select') {
      annotatedText = `[Select: ${inferred.label}]`;
    } else {
      annotatedText = `[Textinput: ${inferred.label}]`;
    }

    detected.push({
      id: crypto.randomUUID(),
      originalText: fullMatch,
      annotatedText,
      type: inferred.type,
      position: { start: position, end: position + fullMatch.length },
      confidence: 0.85,
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
  tracker: CoverageTracker
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

    if (seenPlaceholders.has(normalizedName)) {
      const firstOccurrence = seenPlaceholders.get(normalizedName)!;
      type = firstOccurrence.type;
      annotatedText = firstOccurrence.annotatedText;
    } else {
      const inferred = inferAnnotationFromPlaceholderName(placeholderName, contextBefore, contextAfter);
      type = inferred.type;
      const label = inferred.label;

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
      confidence: 0.9,
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

    // Skip legal explanatory text
    const isLegalDefinition = content.length > 80 && (
      /\b(herein|hereinafter|collectively|referred to as|hereunder|thereof|hereof|hereby|pursuant)\b/i.test(content) ||
      /\b(as defined|means the|shall mean|is defined)\b/i.test(content)
    );
    if (isLegalDefinition) {
      continue;
    }

    // Skip very long content without action words
    const startsWithActionWord = /^(insert|enter|add|fill|type|specify|provide|input|beschreibung|einfugen|leistungs)/i.test(content);
    if (content.length > 150 && content.split(/\s+/).length > 15 && !startsWithActionWord) {
      continue;
    }

    const isBlank = /^[_*\s\-.]+$/.test(content);
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
 * Detect slash-separated patterns (rule-based, no AI)
 */
function detectSlashPatterns(
  documentText: string,
  tracker: CoverageTracker
): AnnotationSuggestion[] {
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
      if (shouldSkipSlashPatternLocal(fullMatch)) {
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

  // Classify using local rules (no AI)
  if (slashCandidates.length > 0) {
    console.log(`[detectSlashPatterns-headless] Classifying ${slashCandidates.length} candidates with rules`);
    const decisions = classifySlashPatternsLocal(slashCandidates);
    const isSelectMap = getIsSelectMap(decisions);

    for (const candidate of slashCandidates) {
      const isSelect = isSelectMap.get(candidate.pattern);
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
  highlightedRegions: HighlightedRegion[]
): AnnotationSuggestion[] {
  const detected: AnnotationSuggestion[] = [];
  const commonWordsToSkip = ['amount', 'total', 'the', 'and', 'or', 'of', 'in', 'on', 'at', 'by', 'for', 'to', 'from', 'with'];

  for (const region of highlightedRegions) {
    if (tracker.isRangeCovered(region.position.start, region.position.end)) continue;
    if (tracker.isSubstringOfExisting(region.position.start, region.position.end)) continue;

    let text = region.text.trim();
    const position = { ...region.position };

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
    const hasInstruction = isInstructionTextLocal(text);

    if (!hasInstruction && wordCount >= 4) {
      continue;
    }

    const contextBefore = documentText.slice(Math.max(0, position.start - 100), position.start);
    const contextAfter = documentText.slice(position.end, position.end + 100);

    const inferred = inferAnnotationFromPlaceholderName(text, contextBefore, contextAfter);
    const { type } = inferred;
    const label = inferred.label;

    let annotatedText: string;
    if (type === 'Date') {
      annotatedText = '[Date]';
    } else if (type === 'Money') {
      annotatedText = '[Money]';
    } else {
      const meaningfulLabel = getMeaningfulLabel(label || text, contextBefore);
      annotatedText = meaningfulLabel ? `[Textinput: ${meaningfulLabel}]` : '[Textinput]';
    }

    detected.push({
      id: crypto.randomUUID(),
      originalText: text,
      annotatedText,
      type,
      position,
      confidence: 0.95,
      isAccepted: true,
      isEdited: false,
    });

    tracker.markCovered(position.start, position.end);
  }

  return detected;
}

/**
 * Detect underscores (rule-based, no AI)
 */
function detectUnderscores(
  documentText: string,
  tracker: CoverageTracker,
  highlightedRegions: HighlightedRegion[]
): AnnotationSuggestion[] {
  const detected: AnnotationSuggestion[] = [];
  const underscorePattern = /_{5,}/g;

  // Check if document uses template syntax
  const templatePatterns = [/<<[^<>]+>>/, /\{\{[^{}]+\}\}/, /\{[A-Z][a-zA-Z]+\}/];
  const isTemplateDocument = templatePatterns.some((p) => p.test(documentText));

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

    // Highlighted underscores always included immediately
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

  // Classify using local rules (no AI)
  if (candidates.length > 0) {
    console.log(`[detectUnderscores-headless] Classifying ${candidates.length} candidates with rules`);
    const decisions = classifyUnderscoresLocal(candidates, documentText.length);

    for (const candidate of candidates) {
      const decision = decisions.get(candidate.position);
      if (!decision || !decision.isFillable) continue;

      const label = decision.label;
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
  }

  return detected;
}

/**
 * Detect bullet point placeholders
 */
function detectBulletPlaceholders(
  documentText: string,
  tracker: CoverageTracker
): AnnotationSuggestion[] {
  const detected: AnnotationSuggestion[] = [];
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

// ----------------------------------------------------------------------------
// Main Detection Function
// ----------------------------------------------------------------------------

/**
 * Auto-detect placeholders in document (headless mode - no AI).
 */
export function autoDetectPlaceholdersHeadless(
  options: PlaceholderDetectionOptions
): PlaceholderDetectionResult {
  const { documentText, existingSuggestions, highlightedRegions = [] } = options;

  // Load patterns from JSON (if available)
  const patterns = getLoadedPatterns();
  console.log(`[autoDetect-headless] Loaded ${patterns.length} patterns from JSON`);

  const tracker = createCoverageTracker(existingSuggestions);
  const detected: AnnotationSuggestion[] = [];
  const patternsUsed = 0;

  // Run detection in priority order (all synchronous, no AI)

  // Priority 1: Calculations
  detected.push(...detectCalculations(documentText, tracker));

  // Priority 2: Title patterns
  detected.push(...detectTitlePatterns(documentText, tracker));

  // Priority 3: Slash patterns (rule-based)
  detected.push(...detectSlashPatterns(documentText, tracker));

  // Priority 4: XXX patterns
  detected.push(...detectXxxPatterns(documentText, tracker, highlightedRegions));

  // Priority 5: Highlighted text
  detected.push(...detectHighlightedText(documentText, tracker, highlightedRegions));

  // Priority 6: Curly brace placeholders
  detected.push(...detectCurlyBracePlaceholders(documentText, tracker));

  // Priority 7: Angle bracket placeholders
  detected.push(...detectAngleBracketPlaceholders(documentText, tracker));

  // Priority 8: Underscores (rule-based)
  detected.push(...detectUnderscores(documentText, tracker, highlightedRegions));

  // Priority 9: Bracketed placeholders
  detected.push(...detectBracketedPlaceholders(documentText, tracker));

  // Priority 10: Date patterns
  detected.push(...detectDatePatterns(documentText, tracker));

  // Priority 11: Bullet placeholders
  detected.push(...detectBulletPlaceholders(documentText, tracker));

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

  for (const s of detected) {
    byType[s.type]++;
  }

  return {
    suggestions: detected,
    stats: {
      totalDetected: detected.length,
      byType,
      patternsUsed,
    },
  };
}

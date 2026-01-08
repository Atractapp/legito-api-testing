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
  ContextRules,
  TypeIndicator,
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
    // CRITICAL FIX: Extract context from ORIGINAL text, not annotated text!
    // The annotated text contains [annotations] which won't exist in documents to match.
    // We need context from the original to enable proper matching.

    // Find where the originalText appears in the original document
    const origPos = originalText.indexOf(annotation.originalText);

    let contextBefore: string;
    let contextAfter: string;

    if (origPos !== -1) {
      // Found in original - extract context from there (correct approach)
      contextBefore = getContextBefore(originalText, origPos);
      contextAfter = getContextAfter(originalText, origPos + annotation.originalText.length);
      console.log(`[extractPatterns] Context from ORIGINAL: before="${contextBefore.slice(-30)}", after="${contextAfter.slice(0, 30)}"`);
    } else {
      // Fallback: use annotated text context (may contain [annotations])
      console.warn(`[extractPatterns] Could not find "${annotation.originalText}" in original, using annotated context`);
      contextBefore = getContextBefore(annotatedText, annotation.position.start);
      contextAfter = getContextAfter(
        annotatedText,
        annotation.position.end || annotation.position.start + annotation.annotatedText.length
      );
    }

    // Extract semantic context rules from the context
    const contextRules = extractContextRules(contextBefore, contextAfter, annotation.type);

    patterns.push({
      originalText: annotation.originalText,
      annotatedText: annotation.annotatedText,
      annotationType: annotation.type,
      contextBefore,
      contextAfter,
      contextRules,
      confidence: 1.0, // Initial confidence
      usageCount: 1,
      successRate: 1.0,
      trainingPairId: trainingPairId || null,
    });
  }

  // Filter out invalid patterns
  // NOTE: With diff-based extraction, originalText will always be the real
  // text that was replaced, NOT the annotation itself. The previous filter
  // that removed /^\[.+\]$/ patterns was masking extraction failures.
  const validPatterns = patterns.filter((p) => {
    // Skip if original text is same as annotated (no real replacement)
    if (p.originalText === p.annotatedText) return false;

    // Skip if original text is empty or whitespace only
    if (!p.originalText || !p.originalText.trim()) return false;

    // Log what we're keeping for debugging
    console.log(`[extractPatterns] Keeping pattern: "${p.originalText}" → "${p.annotatedText}" (${p.annotationType})`);

    return true;
  });

  // Calculate summary
  const summary = {
    total: validPatterns.length,
    byType: countByType(validPatterns),
  };

  return { patterns: validPatterns, summary };
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
 * Extract semantic context rules from pattern context.
 * These rules are used for smart pattern matching - e.g., "if context contains
 * 'value of' → Money" regardless of the actual value.
 *
 * This is the KEY function for making the system understand context-based typing.
 */
function extractContextRules(
  contextBefore: string | null,
  contextAfter: string | null,
  annotationType: AnnotationType
): ContextRules {
  const rules: ContextRules = { typeIndicators: [] };
  const beforeLower = (contextBefore || '').toLowerCase();
  const afterLower = (contextAfter || '').toLowerCase();

  // === MONEY INDICATORS ===
  if (annotationType === 'Money') {
    // Keywords that appear BEFORE money values
    const moneyBeforeKeywords = [
      { pattern: /value of|in the value of/i, keyword: 'value of', confidence: 0.95 },
      { pattern: /amount of?/i, keyword: 'amount', confidence: 0.9 },
      { pattern: /sum of?/i, keyword: 'sum', confidence: 0.9 },
      { pattern: /total of?/i, keyword: 'total', confidence: 0.9 },
      { pattern: /price of?/i, keyword: 'price', confidence: 0.9 },
      { pattern: /fee of?|fee:/i, keyword: 'fee', confidence: 0.85 },
      { pattern: /cost of?/i, keyword: 'cost', confidence: 0.85 },
      { pattern: /payment of?/i, keyword: 'payment', confidence: 0.85 },
      { pattern: /salary|wage/i, keyword: 'salary', confidence: 0.85 },
      { pattern: /deposit of?/i, keyword: 'deposit', confidence: 0.85 },
      { pattern: /rent of?/i, keyword: 'rent', confidence: 0.85 },
    ];

    for (const { pattern, keyword, confidence } of moneyBeforeKeywords) {
      if (pattern.test(beforeLower)) {
        rules.typeIndicators.push({
          keyword,
          position: 'before',
          impliesType: 'Money',
          confidence,
        });
      }
    }

    // Keywords that appear AFTER money values (currencies)
    const currencyKeywords = [
      { pattern: /^\s*(eur|euro|euros)/i, keyword: 'EUR', confidence: 0.95 },
      { pattern: /^\s*(usd|dollars?)/i, keyword: 'USD', confidence: 0.95 },
      { pattern: /^\s*(czk|kč|korun)/i, keyword: 'CZK', confidence: 0.95 },
      { pattern: /^\s*(gbp|pounds?)/i, keyword: 'GBP', confidence: 0.95 },
      { pattern: /^\s*(chf|francs?)/i, keyword: 'CHF', confidence: 0.95 },
    ];

    for (const { pattern, keyword, confidence } of currencyKeywords) {
      if (pattern.test(afterLower)) {
        rules.typeIndicators.push({
          keyword,
          position: 'after',
          impliesType: 'Money',
          confidence,
        });
      }
    }
  }

  // === DATE INDICATORS ===
  if (annotationType === 'Date') {
    const dateBeforeKeywords = [
      { pattern: /dated?/i, keyword: 'dated', confidence: 0.9 },
      { pattern: /as of/i, keyword: 'as of', confidence: 0.9 },
      { pattern: /valid from/i, keyword: 'valid from', confidence: 0.9 },
      { pattern: /valid until/i, keyword: 'valid until', confidence: 0.9 },
      { pattern: /effective/i, keyword: 'effective', confidence: 0.85 },
      { pattern: /expires?/i, keyword: 'expires', confidence: 0.85 },
      { pattern: /due date/i, keyword: 'due date', confidence: 0.9 },
      { pattern: /signed on/i, keyword: 'signed on', confidence: 0.9 },
      { pattern: /executed on/i, keyword: 'executed on', confidence: 0.9 },
      { pattern: /starting/i, keyword: 'starting', confidence: 0.8 },
      { pattern: /ending/i, keyword: 'ending', confidence: 0.8 },
      { pattern: /on the/i, keyword: 'on the', confidence: 0.7 },
    ];

    for (const { pattern, keyword, confidence } of dateBeforeKeywords) {
      if (pattern.test(beforeLower)) {
        rules.typeIndicators.push({
          keyword,
          position: 'before',
          impliesType: 'Date',
          confidence,
        });
      }
    }
  }

  // === LINK INDICATORS (References to entities) ===
  if (annotationType === 'Link') {
    const linkKeywords = [
      { pattern: /the buyer|the seller/i, keyword: 'party reference', confidence: 0.9 },
      { pattern: /the (creditor|debtor)/i, keyword: 'creditor/debtor', confidence: 0.9 },
      { pattern: /the (landlord|tenant)/i, keyword: 'landlord/tenant', confidence: 0.9 },
      { pattern: /the (employer|employee)/i, keyword: 'employer/employee', confidence: 0.9 },
      { pattern: /aforementioned/i, keyword: 'aforementioned', confidence: 0.95 },
      { pattern: /hereinafter/i, keyword: 'hereinafter', confidence: 0.9 },
      { pattern: /as defined/i, keyword: 'as defined', confidence: 0.85 },
    ];

    for (const { pattern, keyword, confidence } of linkKeywords) {
      if (pattern.test(beforeLower) || pattern.test(afterLower)) {
        rules.typeIndicators.push({
          keyword,
          position: 'any',
          impliesType: 'Link',
          confidence,
        });
      }
    }
  }

  // === SELECT INDICATORS ===
  if (annotationType === 'Select') {
    const selectKeywords = [
      { pattern: /choose|select|pick/i, keyword: 'choose/select', confidence: 0.85 },
      { pattern: /circle|check/i, keyword: 'circle/check', confidence: 0.8 },
      { pattern: /yes\/no|true\/false/i, keyword: 'yes/no', confidence: 0.95 },
    ];

    for (const { pattern, keyword, confidence } of selectKeywords) {
      if (pattern.test(beforeLower) || pattern.test(afterLower)) {
        rules.typeIndicators.push({
          keyword,
          position: 'any',
          impliesType: 'Select',
          confidence,
        });
      }
    }
  }

  // === CALCULATION INDICATORS ===
  if (annotationType === 'Calculation') {
    const calcKeywords = [
      { pattern: /total|sum|aggregate/i, keyword: 'total/sum', confidence: 0.85 },
      { pattern: /calculated|computed/i, keyword: 'calculated', confidence: 0.9 },
    ];

    for (const { pattern, keyword, confidence } of calcKeywords) {
      if (pattern.test(beforeLower) || pattern.test(afterLower)) {
        rules.typeIndicators.push({
          keyword,
          position: 'any',
          impliesType: 'Calculation',
          confidence,
        });
      }
    }
  }

  // Log extracted rules for debugging
  if (rules.typeIndicators.length > 0) {
    console.log(`[extractContextRules] Type ${annotationType}: found ${rules.typeIndicators.length} indicators:`,
      rules.typeIndicators.map(i => `"${i.keyword}" (${i.position})`).join(', '));
  }

  return rules;
}

/**
 * Extract meaningful keywords from context
 * These are structural words that indicate where annotations should be placed
 */
function extractKeywords(context: string): string[] {
  if (!context) return [];

  // Common structural keywords that indicate annotation positions
  const structuralKeywords = [
    // Prepositions and connectors
    'in', 'on', 'at', 'by', 'to', 'from', 'of', 'for', 'with', 'between',
    // Document-specific terms
    'dated', 'signed', 'amount', 'sum', 'total', 'name', 'address', 'city',
    'date', 'party', 'parties', 'agreement', 'contract', 'loan', 'payment',
    'creditor', 'debtor', 'bank', 'account', 'iban', 'installment',
    // Punctuation context (kept as is)
    'the', '(', ')', '"', ',', ':', ';'
  ];

  const words = context.toLowerCase().split(/\s+/).filter(Boolean);
  const keywords: string[] = [];

  for (const word of words) {
    const cleanWord = word.replace(/[.,;:()"\[\]]/g, '').trim();
    if (cleanWord && structuralKeywords.includes(cleanWord)) {
      keywords.push(cleanWord);
    }
  }

  // Also keep punctuation patterns that indicate structure
  if (context.includes(',')) keywords.push(',');
  if (context.includes('(')) keywords.push('(');
  if (context.includes(')')) keywords.push(')');
  if (context.includes(':')) keywords.push(':');

  return [...new Set(keywords)]; // Remove duplicates
}

/**
 * Detect what type of placeholder the original text represents
 * This helps match similar patterns even with different values
 */
function detectPlaceholderType(text: string, annotationType: AnnotationType): 'DATE' | 'AMOUNT' | 'TEXT' {
  // Date patterns: DD.MM.YYYY, XX.XX.XXXX, DD/MM/YYYY, etc.
  if (annotationType === 'Date' || /^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/.test(text)) {
    return 'DATE';
  }
  if (/^[XD]{1,2}[./-][XM]{1,2}[./-][XY]{2,4}$/i.test(text)) {
    return 'DATE';
  }

  // Money patterns: XXX, numbers, amounts
  if (annotationType === 'Money' || /^[X\d][X\d,.]*$/.test(text)) {
    return 'AMOUNT';
  }

  // Everything else is variable text (names, cities, etc.)
  return 'TEXT';
}

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
    console.log(`  Context: before="${(pattern.contextBefore || '').slice(-30)}", after="${(pattern.contextAfter || '').slice(0, 30)}"`);

    // Determine if originalText is a placeholder-like value
    const isPlaceholder = isPlaceholderText(pattern.originalText, pattern.annotationType);

    // Enable smart matching if:
    // 1. It's a placeholder (like "City", "XXX")
    // 2. OR it has meaningful context (at least 10 chars before OR after)
    const hasGoodContext =
      (pattern.contextBefore?.length || 0) >= 10 ||
      (pattern.contextAfter?.length || 0) >= 10;

    const useSmartMatching =
      (isPlaceholder || hasGoodContext) &&
      (pattern.contextBefore || pattern.contextAfter);

    if (useSmartMatching) {
      // Smart matching: find by context keywords + structural pattern
      const contextMatches = findByContextPattern(documentText, pattern);

      for (const match of contextMatches) {
        matches.push({
          pattern,
          matchPosition: match.position,
          matchedText: match.text,
          suggestedAnnotation: generateAnnotationForMatch(pattern, match.text),
          confidence: match.confidence,
        });
        matchedPatternIds.add(pattern.id);
      }
    } else {
      // Traditional matching: find exact text occurrences
      const matchPositions = findAllOccurrences(documentText, pattern.originalText);

      for (const position of matchPositions) {
        // Verify context matches
        const contextMatches = verifyContext(
          documentText,
          position,
          pattern.originalText.length,
          pattern.contextBefore,
          pattern.contextAfter,
          pattern.originalText
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
 * Check if text looks like a placeholder value (generic, short, or pattern-like)
 * These should be matched by context rather than exact text
 */
function isPlaceholderText(text: string, annotationType: AnnotationType): boolean {
  // Date placeholders: XX.XX.XXXX, DD.MM.YYYY, etc.
  if (/^[XD]{1,2}[./-][XM]{1,2}[./-][XY]{2,4}$/i.test(text)) return true;
  if (/^[X]+$/i.test(text)) return true; // Just XXX

  // Money placeholders: XXX, numbers
  if (annotationType === 'Money' && /^[X\d][X\d,.]*$/.test(text)) return true;

  // Short generic words that are likely placeholders
  const genericWords = [
    'city', 'name', 'address', 'date', 'amount', 'number', 'value',
    'company', 'person', 'party', 'bank', 'account', 'iban', 'bic',
    'street', 'country', 'zip', 'email', 'phone', 'title', 'position'
  ];
  if (genericWords.includes(text.toLowerCase())) return true;

  // Single capitalized word that looks like a placeholder
  if (/^[A-Z][a-z]+$/.test(text) && text.length <= 15) {
    // Could be a placeholder like "City", "Name", "Amount"
    // Check if it's a common English word (less likely to be a placeholder)
    const commonWords = ['the', 'and', 'for', 'with', 'this', 'that', 'from', 'have', 'will'];
    if (!commonWords.includes(text.toLowerCase())) {
      return true;
    }
  }

  return false;
}

/**
 * Find matches in document using context pattern (keywords + structure) instead of exact text
 * This enables matching "In City, on" → "In Paris, on"
 */
function findByContextPattern(
  documentText: string,
  pattern: Pattern
): Array<{ position: { start: number; end: number }; text: string; confidence: number }> {
  const results: Array<{ position: { start: number; end: number }; text: string; confidence: number }> = [];

  // Extract keywords from pattern context
  const beforeKeywords = extractKeywords(pattern.contextBefore || '');
  const afterKeywords = extractKeywords(pattern.contextAfter || '');
  const allKeywords = [...beforeKeywords, ...afterKeywords];

  // Get placeholder type to know what kind of text to look for
  const placeholderType = detectPlaceholderType(pattern.originalText, pattern.annotationType);

  // Get the last few chars of contextBefore and first few chars of contextAfter for structural matching
  const contextBeforeSuffix = (pattern.contextBefore || '').slice(-15).trim().toLowerCase();
  const contextAfterPrefix = (pattern.contextAfter || '').slice(0, 15).trim().toLowerCase();

  // Scan document for potential matches
  const words = documentText.split(/(\s+)/);
  let currentPos = 0;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const wordStart = currentPos;
    currentPos += word.length;

    // Skip whitespace
    if (/^\s+$/.test(word)) continue;

    // Skip already annotated text
    if (word.startsWith('[') || word.endsWith(']')) continue;

    // Get surrounding text for context checking
    const textBefore = documentText.substring(Math.max(0, wordStart - 50), wordStart).toLowerCase();
    const textAfter = documentText.substring(wordStart + word.length, Math.min(documentText.length, wordStart + word.length + 50)).toLowerCase();

    // Check structural match: does the immediate context match?
    let structuralScore = 0;
    if (contextBeforeSuffix && textBefore.includes(contextBeforeSuffix)) {
      structuralScore += 0.5;
    }
    if (contextAfterPrefix && textAfter.includes(contextAfterPrefix)) {
      structuralScore += 0.5;
    }

    // Check keyword match
    const surroundingText = documentText.substring(
      Math.max(0, wordStart - 100),
      Math.min(documentText.length, wordStart + word.length + 100)
    );
    const keywordsFound = allKeywords.filter(kw =>
      surroundingText.toLowerCase().includes(kw.toLowerCase())
    );
    const keywordScore = allKeywords.length > 0 ? keywordsFound.length / allKeywords.length : 0;

    // Combined score: structural match is worth more than keyword match
    const combinedScore = structuralScore * 0.7 + keywordScore * 0.3;

    // Match if good structural match OR good keyword match
    if (combinedScore >= 0.3 || structuralScore >= 0.5 || keywordScore >= 0.6) {
      // Verify the word type matches what we're looking for
      const wordType = detectWordType(word);

      if (wordTypeMatches(wordType, placeholderType, pattern.annotationType)) {
        results.push({
          position: { start: wordStart, end: wordStart + word.length },
          text: word,
          confidence: Math.min(0.9, pattern.confidence * Math.max(combinedScore, structuralScore, keywordScore * 0.8)),
        });
      }
    }
  }

  return results;
}

/**
 * Detect what type of value a word represents
 */
function detectWordType(word: string): 'DATE' | 'AMOUNT' | 'TEXT' {
  // Date pattern
  if (/^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/.test(word)) return 'DATE';
  if (/^[XD]{1,2}[./-][XM]{1,2}[./-][XY]{2,4}$/i.test(word)) return 'DATE';

  // Amount/number pattern
  if (/^[\d,.]+$/.test(word) && word.length >= 2) return 'AMOUNT';
  if (/^[X]+$/i.test(word)) return 'AMOUNT'; // XXX placeholder

  // Text (names, cities, etc.)
  return 'TEXT';
}

/**
 * Check if detected word type matches the pattern's expected type
 */
function wordTypeMatches(
  wordType: 'DATE' | 'AMOUNT' | 'TEXT',
  placeholderType: 'DATE' | 'AMOUNT' | 'TEXT',
  annotationType: AnnotationType
): boolean {
  // Exact type match
  if (wordType === placeholderType) return true;

  // Annotation type specific matching
  if (annotationType === 'Date' && wordType === 'DATE') return true;
  if (annotationType === 'Money' && wordType === 'AMOUNT') return true;
  if (annotationType === 'TextInput' && wordType === 'TEXT') return true;

  // TEXT is flexible - can match various annotation types
  if (wordType === 'TEXT' && ['TextInput', 'Text', 'Select'].includes(annotationType)) return true;

  return false;
}

/**
 * Generate appropriate annotation text for a matched word
 * Adapts the pattern's annotation to the actual matched text
 */
function generateAnnotationForMatch(pattern: Pattern, matchedText: string): string {
  // If the pattern annotation contains the original text as label, replace it
  // e.g., [TextInput: City] → [TextInput: Paris] if matchedText is "Paris"

  const annotatedText = pattern.annotatedText;

  // Check if it's a labeled annotation like [Type: Label]
  const labelMatch = annotatedText.match(/^\[([^:]+):\s*([^\]]+)\]$/);
  if (labelMatch) {
    const [, type, originalLabel] = labelMatch;
    // If original label matches the original text, use the new matched text
    if (originalLabel.toLowerCase() === pattern.originalText.toLowerCase()) {
      return `[${type}: ${matchedText}]`;
    }
  }

  // Otherwise return the pattern's annotation as-is
  return annotatedText;
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
  expectedAfter: string | null,
  patternOriginal?: string
): { beforeScore: number; afterScore: number } | null {
  const actualBefore = getContextBefore(text, position);
  const actualAfter = getContextAfter(text, position + matchLength);

  const beforeScore = expectedBefore
    ? calculateSimilarity(actualBefore, expectedBefore)
    : 1.0;
  const afterScore = expectedAfter
    ? calculateSimilarity(actualAfter, expectedAfter)
    : 1.0;

  // Lowered threshold to 0.2 for better matching now that context is from original text
  const threshold = 0.2;
  if (beforeScore < threshold && afterScore < threshold) {
    console.log(`[verifyContext] REJECT "${patternOriginal || '?'}": beforeScore=${beforeScore.toFixed(2)}, afterScore=${afterScore.toFixed(2)}`);
    return null;
  }

  console.log(`[verifyContext] ACCEPT "${patternOriginal || '?'}": beforeScore=${beforeScore.toFixed(2)}, afterScore=${afterScore.toFixed(2)}`);
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

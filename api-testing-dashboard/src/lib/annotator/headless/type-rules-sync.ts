/**
 * Synchronous Type Rules Functions for Headless Annotator
 *
 * These functions provide rule-based type inference without database calls.
 * Used by the headless service for network-isolated operation.
 *
 * Functions:
 * - checkDateContextBeforeLocal() - Check date indicators before placeholder
 * - checkDateContextAfterLocal() - Check date indicators after placeholder
 * - checkMoneyContextBeforeLocal() - Check money indicators before placeholder
 * - checkMoneyContextAfterLocal() - Check money/currency indicators after placeholder
 * - isGermanGenderPatternLocal() - Detect German gender-neutral patterns to skip
 * - shouldSkipSlashPatternLocal() - Detect slash patterns to skip (and/or, etc.)
 * - isInstructionTextLocal() - Detect fill-in instruction text
 * - inferTypeFromNameLocal() - Infer type from placeholder name keywords
 */

import type { AnnotationType } from '@/types/annotator';
import {
  getTypeRules,
  getRulesByCategory,
  getDateBeforeKeywords,
  getDateAfterKeywords,
  getMoneyBeforeKeywords,
  getMoneyAfterKeywords,
  getInstructionKeywords,
  type TypeRule,
  type RuleStrength,
} from './type-rules-local';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface ContextCheckResult {
  matches: boolean;
  rule?: TypeRule;
  matchedKeyword?: string;
}

export interface TypeInferenceLocalResult {
  type: AnnotationType | null;
  confidence: number;
  source: 'dateContext' | 'moneyContext' | 'nameKeyword' | 'instruction' | null;
  matchedRule?: TypeRule;
}

// ----------------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------------

/**
 * Normalize text for comparison (lowercase, trim).
 */
function normalizeText(text: string): string {
  return text.toLowerCase().trim();
}

/**
 * Convert rule strength to confidence score.
 */
function strengthToConfidence(strength: RuleStrength): number {
  switch (strength) {
    case 'strong': return 0.9;
    case 'normal': return 0.75;
    case 'weak': return 0.6;
    default: return 0.5;
  }
}

/**
 * Check if text contains a keyword at word boundary.
 */
function containsKeyword(text: string, keyword: string): boolean {
  const normalized = normalizeText(text);
  const normalizedKeyword = normalizeText(keyword);

  // Direct contains check
  if (!normalized.includes(normalizedKeyword)) {
    return false;
  }

  // Word boundary check for multi-word keywords
  const pattern = new RegExp(`\\b${escapeRegex(normalizedKeyword)}\\b`, 'i');
  return pattern.test(text);
}

/**
 * Escape special regex characters.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ----------------------------------------------------------------------------
// Date Context Functions
// ----------------------------------------------------------------------------

/**
 * Check if context BEFORE placeholder contains date indicators.
 */
export function checkDateContextBeforeLocal(contextBefore: string): ContextCheckResult {
  const normalizedContext = normalizeText(contextBefore);
  const rules = getRulesByCategory('dateContextBefore');

  // Sort by priority (highest first)
  const sortedRules = [...rules].sort((a, b) => b.priority - a.priority);

  for (const rule of sortedRules) {
    // Skip regex rules in keyword lookup (handled separately)
    if (rule.keyword.startsWith('regex:')) continue;

    const keyword = normalizeText(rule.keyword);

    // Check for keyword in context (prioritize end of context)
    if (normalizedContext.endsWith(keyword) ||
        normalizedContext.includes(` ${keyword} `) ||
        normalizedContext.includes(` ${keyword}`)) {
      return {
        matches: true,
        rule,
        matchedKeyword: rule.keyword,
      };
    }
  }

  return { matches: false };
}

/**
 * Check if context AFTER placeholder contains date indicators.
 */
export function checkDateContextAfterLocal(contextAfter: string): ContextCheckResult {
  const normalizedContext = normalizeText(contextAfter);
  const rules = getRulesByCategory('dateContextAfter');

  // Sort by priority (highest first)
  const sortedRules = [...rules].sort((a, b) => b.priority - a.priority);

  for (const rule of sortedRules) {
    if (rule.keyword.startsWith('regex:')) continue;

    const keyword = normalizeText(rule.keyword);

    // Check for keyword at start of context after
    if (normalizedContext.startsWith(keyword) ||
        normalizedContext.startsWith(` ${keyword}`) ||
        normalizedContext.includes(` ${keyword}`)) {
      return {
        matches: true,
        rule,
        matchedKeyword: rule.keyword,
      };
    }
  }

  return { matches: false };
}

// ----------------------------------------------------------------------------
// Money Context Functions
// ----------------------------------------------------------------------------

/**
 * Check if context BEFORE placeholder contains money indicators.
 */
export function checkMoneyContextBeforeLocal(contextBefore: string): ContextCheckResult {
  const normalizedContext = normalizeText(contextBefore);
  const rules = getRulesByCategory('moneyContextBefore');

  const sortedRules = [...rules].sort((a, b) => b.priority - a.priority);

  for (const rule of sortedRules) {
    if (rule.keyword.startsWith('regex:')) continue;

    const keyword = normalizeText(rule.keyword);

    if (normalizedContext.endsWith(keyword) ||
        normalizedContext.includes(` ${keyword} `) ||
        normalizedContext.includes(` ${keyword}`)) {
      return {
        matches: true,
        rule,
        matchedKeyword: rule.keyword,
      };
    }
  }

  return { matches: false };
}

/**
 * Check if context AFTER placeholder contains money/currency indicators.
 */
export function checkMoneyContextAfterLocal(contextAfter: string): ContextCheckResult {
  const normalizedContext = normalizeText(contextAfter);
  const rules = getRulesByCategory('moneyContextAfter');

  const sortedRules = [...rules].sort((a, b) => b.priority - a.priority);

  for (const rule of sortedRules) {
    if (rule.keyword.startsWith('regex:')) continue;

    const keyword = normalizeText(rule.keyword);

    // Currency symbols and codes often appear immediately after or with space
    if (normalizedContext.startsWith(keyword) ||
        normalizedContext.startsWith(` ${keyword}`) ||
        normalizedContext.includes(` ${keyword}`)) {
      return {
        matches: true,
        rule,
        matchedKeyword: rule.keyword,
      };
    }
  }

  return { matches: false };
}

// ----------------------------------------------------------------------------
// German Gender Pattern Detection
// ----------------------------------------------------------------------------

/**
 * Check if text is a German gender-neutral pattern that should be skipped.
 * Examples: Autor*in, Mitarbeiter*innen, er*sie, ihm*ihr
 */
export function isGermanGenderPatternLocal(text: string): boolean {
  const rules = getRulesByCategory('skipGermanGender');

  for (const rule of rules) {
    if (rule.regex && rule.regex.test(text)) {
      return true;
    }
  }

  // Additional hardcoded patterns for robustness
  const genderPatterns = [
    /\*in\b/i,              // *in ending
    /\*innen\b/i,           // *innen ending
    /\ber\*sie\b/i,         // er*sie
    /\bihm\*ihr\b/i,        // ihm*ihr
    /\bsein\*ihr\b/i,       // sein*ihr
    /\bseiner\*ihrer\b/i,   // seiner*ihrer
    /\bvom\*von\b/i,        // vom*von
  ];

  for (const pattern of genderPatterns) {
    if (pattern.test(text)) {
      return true;
    }
  }

  return false;
}

// ----------------------------------------------------------------------------
// Slash Pattern Skip Detection
// ----------------------------------------------------------------------------

/**
 * Check if a slash pattern should be skipped (not a Select field).
 * Examples: and/or, Marketing/PR, treatments/scripts
 */
export function shouldSkipSlashPatternLocal(pattern: string): boolean {
  const rules = getRulesByCategory('skipSlashPattern');

  for (const rule of rules) {
    if (rule.regex && rule.regex.test(pattern)) {
      console.log(`[shouldSkipSlashPatternLocal] Pattern "${pattern}" matches rule: ${rule.description}`);
      return true;
    }
  }

  // Additional hardcoded patterns for robustness
  const skipPatterns = [
    /\band[\/\\]or\b/i,
    /\bund[\/\\]oder\b/i,
    /\ba[\/\\]nebo\b/i,
    /\bmarketing[\/\\]pr\b/i,
    /\bpromotional[\/\\]publicity\b/i,
    /\btreatments[\/\\]scripts?\b/i,
    /\boutlines[\/\\]treatments\b/i,
    /\brevisions[\/\\]drafts\b/i,
    /\bwriting\s+steps\b/i,
  ];

  for (const p of skipPatterns) {
    if (p.test(pattern)) {
      console.log(`[shouldSkipSlashPatternLocal] Pattern "${pattern}" matches hardcoded skip pattern`);
      return true;
    }
  }

  return false;
}

// ----------------------------------------------------------------------------
// Instruction Text Detection
// ----------------------------------------------------------------------------

/**
 * Check if text is instruction text (e.g., "insert name here", "fill in").
 */
export function isInstructionTextLocal(text: string): boolean {
  const normalizedText = normalizeText(text);
  const keywords = getInstructionKeywords();

  for (const keyword of keywords) {
    if (normalizedText.includes(keyword)) {
      return true;
    }
  }

  // Additional patterns
  const instructionPatterns = [
    /^insert\b/i,
    /^enter\b/i,
    /^fill\s*(in|out)?\b/i,
    /^specify\b/i,
    /^provide\b/i,
    /^add\b/i,
    /^write\b/i,
    /^type\b/i,
    /\bhere\]?$/i,
  ];

  for (const pattern of instructionPatterns) {
    if (pattern.test(text)) {
      return true;
    }
  }

  return false;
}

// ----------------------------------------------------------------------------
// Name-Based Type Inference
// ----------------------------------------------------------------------------

/**
 * Infer annotation type from placeholder name keywords.
 */
export function inferTypeFromNameLocal(placeholderName: string): TypeInferenceLocalResult {
  const normalizedName = normalizeText(placeholderName);

  // Check date name keywords
  const dateNameRules = getRulesByCategory('dateNameKeyword');
  for (const rule of dateNameRules) {
    if (containsKeyword(normalizedName, rule.keyword)) {
      return {
        type: 'Date',
        confidence: strengthToConfidence(rule.strength),
        source: 'nameKeyword',
        matchedRule: rule,
      };
    }
  }

  // Check money name keywords
  const moneyNameRules = getRulesByCategory('moneyNameKeyword');
  for (const rule of moneyNameRules) {
    if (containsKeyword(normalizedName, rule.keyword)) {
      return {
        type: 'Money',
        confidence: strengthToConfidence(rule.strength),
        source: 'nameKeyword',
        matchedRule: rule,
      };
    }
  }

  // Check select name keywords
  const selectNameRules = getRulesByCategory('selectNameKeyword');
  for (const rule of selectNameRules) {
    if (containsKeyword(normalizedName, rule.keyword)) {
      return {
        type: 'Select',
        confidence: strengthToConfidence(rule.strength),
        source: 'nameKeyword',
        matchedRule: rule,
      };
    }
  }

  return {
    type: null,
    confidence: 0,
    source: null,
  };
}

// ----------------------------------------------------------------------------
// Title Select Pattern Detection
// ----------------------------------------------------------------------------

/**
 * Check if text is a title/salutation Select pattern.
 * Examples: Mr/Ms, Herr/Frau, D/Dª., Sr./Sra.
 */
export function isTitleSelectPatternLocal(text: string): boolean {
  const rules = getRulesByCategory('titleSelect');

  for (const rule of rules) {
    if (text.includes(rule.keyword)) {
      return true;
    }
  }

  // Additional patterns
  const titlePatterns = [
    /\bMr[\/\\]Ms\.?\b/i,
    /\bHerr[\/\\]Frau\b/i,
    /\bD[\/\\]D[aª]\.?\b/i,
    /\bSr\.?[\/\\]Sra\.?\b/i,
  ];

  for (const pattern of titlePatterns) {
    if (pattern.test(text)) {
      return true;
    }
  }

  return false;
}

// ----------------------------------------------------------------------------
// Party Name Pattern Detection
// ----------------------------------------------------------------------------

/**
 * Check if placeholder name indicates a party name (for Link detection).
 */
export function isPartyNamePatternLocal(placeholderName: string): boolean {
  const normalizedName = normalizeText(placeholderName);
  const rules = getRulesByCategory('partyNamePattern');

  for (const rule of rules) {
    if (containsKeyword(normalizedName, rule.keyword)) {
      return true;
    }
  }

  return false;
}

// ----------------------------------------------------------------------------
// Combined Type Inference
// ----------------------------------------------------------------------------

/**
 * Infer annotation type from context and placeholder name.
 * Uses all available local rules to determine the most likely type.
 */
export function inferAnnotationTypeLocal(
  placeholderName: string,
  contextBefore: string,
  contextAfter: string
): TypeInferenceLocalResult {
  // Priority 1: Check money context after (currency symbols are very reliable)
  const moneyAfterCheck = checkMoneyContextAfterLocal(contextAfter);
  if (moneyAfterCheck.matches && moneyAfterCheck.rule) {
    return {
      type: 'Money',
      confidence: strengthToConfidence(moneyAfterCheck.rule.strength),
      source: 'moneyContext',
      matchedRule: moneyAfterCheck.rule,
    };
  }

  // Priority 2: Check money context before
  const moneyBeforeCheck = checkMoneyContextBeforeLocal(contextBefore);
  if (moneyBeforeCheck.matches && moneyBeforeCheck.rule) {
    return {
      type: 'Money',
      confidence: strengthToConfidence(moneyBeforeCheck.rule.strength),
      source: 'moneyContext',
      matchedRule: moneyBeforeCheck.rule,
    };
  }

  // Priority 3: Check date context before (strong indicators)
  const dateBeforeCheck = checkDateContextBeforeLocal(contextBefore);
  if (dateBeforeCheck.matches && dateBeforeCheck.rule && dateBeforeCheck.rule.strength === 'strong') {
    return {
      type: 'Date',
      confidence: strengthToConfidence(dateBeforeCheck.rule.strength),
      source: 'dateContext',
      matchedRule: dateBeforeCheck.rule,
    };
  }

  // Priority 4: Check date context after
  const dateAfterCheck = checkDateContextAfterLocal(contextAfter);
  if (dateAfterCheck.matches && dateAfterCheck.rule) {
    return {
      type: 'Date',
      confidence: strengthToConfidence(dateAfterCheck.rule.strength),
      source: 'dateContext',
      matchedRule: dateAfterCheck.rule,
    };
  }

  // Priority 5: Check name-based inference
  const nameInference = inferTypeFromNameLocal(placeholderName);
  if (nameInference.type) {
    return nameInference;
  }

  // Priority 6: Weak date context (needs additional signals)
  if (dateBeforeCheck.matches && dateBeforeCheck.rule) {
    // Check if placeholder looks date-like
    const looksLikeDate = /^[Xx\d]{1,4}[.\/-][Xx\d]{1,4}[.\/-][Xx\d]{2,4}$/.test(placeholderName) ||
                          /date|datum/i.test(placeholderName);
    if (looksLikeDate) {
      return {
        type: 'Date',
        confidence: strengthToConfidence(dateBeforeCheck.rule.strength),
        source: 'dateContext',
        matchedRule: dateBeforeCheck.rule,
      };
    }
  }

  // Priority 7: Check for instruction text (implies TextInput)
  if (isInstructionTextLocal(placeholderName)) {
    return {
      type: 'TextInput',
      confidence: 0.8,
      source: 'instruction',
    };
  }

  // Default: no inference
  return {
    type: null,
    confidence: 0,
    source: null,
  };
}

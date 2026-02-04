/**
 * Headless Slash Pattern Detection
 *
 * Rule-based slash pattern classification without AI.
 * Replaces analyzeSlashPatternsWithAI() for network-isolated operation.
 *
 * Classification Rules:
 * - Known title patterns (Mr/Ms, Herr/Frau, D/Dª.) → SELECT
 * - Known skip patterns (and/or, Marketing/PR) → SKIP
 * - Balanced two-option patterns → SELECT (conservative default)
 * - Default for ambiguous → SKIP (conservative)
 */

import {
  shouldSkipSlashPatternLocal,
  isTitleSelectPatternLocal,
} from './type-rules-sync';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface SlashPatternCandidate {
  pattern: string;
  contextBefore: string;
  contextAfter: string;
  position: { start: number; end: number };
}

export interface SlashPatternDecision {
  pattern: string;
  isSelect: boolean;
  reason: string;
}

// ----------------------------------------------------------------------------
// Known Patterns (hardcoded for reliability)
// ----------------------------------------------------------------------------

/**
 * Title/salutation patterns that are ALWAYS Select fields
 */
const TITLE_SELECT_PATTERNS = [
  'Mr/Ms',
  'Mr/Ms.',
  'Mr./Ms.',
  'D/Dª',
  'D/Dª.',
  'Herr/Frau',
  'Sr./Sra.',
  'Sr/Sra',
  'Señor/Señora',
  'him/her',
  'his/her',
  'He/She',
  'he/she',
  'ihm/ihr',
  'sein/ihr',
];

/**
 * Patterns to ALWAYS skip (never Select)
 */
const SKIP_PATTERNS_REGEX = [
  /\band[\/\\]or\b/i,                    // and/or
  /\bund[\/\\]oder\b/i,                  // German: und/oder
  /\ba[\/\\]nebo\b/i,                    // Czech: a/nebo
  /\bmarketing[\/\\]pr\b/i,              // Marketing/PR
  /\bpromotional[\/\\]publicity\b/i,     // promotional/publicity
  /\btreatments[\/\\]scripts?\b/i,       // treatments/scripts
  /\boutlines[\/\\]treatments\b/i,       // outlines/treatments
  /\brevisions[\/\\]drafts\b/i,          // revisions/drafts
  /\bdate[\/\\]term[\/\\]delivery\b/i,   // date/term/delivery (section header)
  /\bwriting\s+steps\b/i,                // writing steps
  /number\s+of\s+\w+[\/\\]\w+/i,         // number of X/Y
  /\w+[\/\\]\w+\s+steps\b/i,             // xxx/yyy steps
  /\w+[\/\\]instructions\b/i,            // xxx/instructions
  /\bservices?[\/\\]goods?\b/i,          // services/goods (generic)
  /\binput[\/\\]output\b/i,              // input/output
  /\bread[\/\\]write\b/i,                // read/write
  /\bstart[\/\\]end\b/i,                 // start/end
  /\bbegin[\/\\]finish\b/i,              // begin/finish
  /\byes[\/\\]no\b/i,                    // yes/no (checkbox, not select)
  /\btrue[\/\\]false\b/i,                // true/false
];

/**
 * Patterns that indicate section headers (not Select)
 */
const SECTION_HEADER_INDICATORS = [
  /^\s*[A-Z][A-Z\s\/]+$/, // ALL CAPS with slashes
  /^\s*\d+\.\s+/,         // Starts with number
  /^\s*[IVXLCDM]+\.\s+/,  // Starts with Roman numeral
];

// ----------------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------------

/**
 * Check if pattern matches any known title Select pattern
 */
function isTitlePattern(pattern: string): boolean {
  const normalizedPattern = pattern.trim();

  // Check exact matches
  for (const title of TITLE_SELECT_PATTERNS) {
    if (normalizedPattern.includes(title)) {
      return true;
    }
  }

  // Check via rule system
  if (isTitleSelectPatternLocal(normalizedPattern)) {
    return true;
  }

  return false;
}

/**
 * Check if pattern should be skipped
 */
function shouldSkipPattern(pattern: string): { skip: boolean; reason: string } {
  // Check skip patterns
  for (const regex of SKIP_PATTERNS_REGEX) {
    if (regex.test(pattern)) {
      return { skip: true, reason: 'Matches skip pattern (conjunction/compound)' };
    }
  }

  // Check via rule system
  if (shouldSkipSlashPatternLocal(pattern)) {
    return { skip: true, reason: 'Matches skip rule (learned pattern)' };
  }

  return { skip: false, reason: '' };
}

/**
 * Check if pattern looks like a section header
 */
function isSectionHeader(pattern: string, contextBefore: string): boolean {
  // Check if at start of line
  const trimmedBefore = contextBefore.trim();
  const atLineStart = trimmedBefore.endsWith('\n') ||
                      trimmedBefore === '' ||
                      /[\n\r]\s*$/.test(contextBefore);

  if (atLineStart) {
    for (const indicator of SECTION_HEADER_INDICATORS) {
      if (indicator.test(pattern)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Analyze options to determine if they're real choices
 */
function analyzeOptions(options: string[]): { isSelect: boolean; reason: string } {
  if (options.length !== 2) {
    // 3+ options - more likely to be Select
    if (options.length >= 3) {
      return { isSelect: true, reason: '3+ options suggests real choice' };
    }
    return { isSelect: false, reason: 'Invalid option count' };
  }

  const [opt1, opt2] = options.map(o => o.toLowerCase().trim());

  // Check for synonyms/similar terms
  const synonymPairs = [
    ['marketing', 'pr'],
    ['promotional', 'publicity'],
    ['treatments', 'scripts'],
    ['outlines', 'treatments'],
    ['revisions', 'drafts'],
    ['services', 'goods'],
    ['input', 'output'],
    ['read', 'write'],
    ['start', 'end'],
    ['begin', 'finish'],
    ['services', 'products'],
  ];

  for (const [a, b] of synonymPairs) {
    if ((opt1.includes(a) && opt2.includes(b)) ||
        (opt1.includes(b) && opt2.includes(a))) {
      return { isSelect: false, reason: `Synonym pair: ${a}/${b}` };
    }
  }

  // Check for real choices
  const choicePairs = [
    ['bank', 'cash'],
    ['transfer', 'cash'],
    ['wire', 'check'],
    ['mr', 'ms'],
    ['herr', 'frau'],
    ['yes', 'no'],
    ['include', 'exclude'],
    ['approve', 'reject'],
    ['accept', 'decline'],
    ['buyer', 'seller'],
    ['lessor', 'lessee'],
    ['landlord', 'tenant'],
  ];

  for (const [a, b] of choicePairs) {
    if ((opt1.includes(a) && opt2.includes(b)) ||
        (opt1.includes(b) && opt2.includes(a))) {
      return { isSelect: true, reason: `Choice pair: ${a}/${b}` };
    }
  }

  // Length heuristic: very different lengths often indicate non-choices
  const ratio = Math.max(opt1.length, opt2.length) / Math.min(opt1.length, opt2.length);
  if (ratio > 5) {
    return { isSelect: false, reason: 'Very different option lengths' };
  }

  // Default: balanced options -> could be Select
  return { isSelect: true, reason: 'Balanced two-option pattern' };
}

// ----------------------------------------------------------------------------
// Main Classification Function
// ----------------------------------------------------------------------------

/**
 * Classify slash patterns without AI.
 * Uses rule-based heuristics for network-isolated operation.
 *
 * @param candidates Array of slash pattern candidates to classify
 * @returns Map of pattern -> isSelect
 */
export function classifySlashPatternsLocal(
  candidates: SlashPatternCandidate[]
): Map<string, SlashPatternDecision> {
  const results = new Map<string, SlashPatternDecision>();

  for (const candidate of candidates) {
    const { pattern, contextBefore, contextAfter } = candidate;

    // Rule 1: Title patterns are ALWAYS Select
    if (isTitlePattern(pattern)) {
      results.set(pattern, {
        pattern,
        isSelect: true,
        reason: 'Title/salutation pattern',
      });
      console.log(`[slash-headless] "${pattern}" -> SELECT (title pattern)`);
      continue;
    }

    // Rule 2: Known skip patterns -> SKIP
    const skipCheck = shouldSkipPattern(pattern);
    if (skipCheck.skip) {
      results.set(pattern, {
        pattern,
        isSelect: false,
        reason: skipCheck.reason,
      });
      console.log(`[slash-headless] "${pattern}" -> SKIP (${skipCheck.reason})`);
      continue;
    }

    // Rule 3: Section headers -> SKIP
    if (isSectionHeader(pattern, contextBefore)) {
      results.set(pattern, {
        pattern,
        isSelect: false,
        reason: 'Section header pattern',
      });
      console.log(`[slash-headless] "${pattern}" -> SKIP (section header)`);
      continue;
    }

    // Rule 4: Analyze options
    const options = pattern.split('/').map(o => o.trim()).filter(o => o.length > 0);
    const optionAnalysis = analyzeOptions(options);

    results.set(pattern, {
      pattern,
      isSelect: optionAnalysis.isSelect,
      reason: optionAnalysis.reason,
    });

    console.log(`[slash-headless] "${pattern}" -> ${optionAnalysis.isSelect ? 'SELECT' : 'SKIP'} (${optionAnalysis.reason})`);
  }

  return results;
}

/**
 * Get isSelect map from classification results (for compatibility)
 */
export function getIsSelectMap(
  decisions: Map<string, SlashPatternDecision>
): Map<string, boolean> {
  const result = new Map<string, boolean>();
  for (const [pattern, decision] of decisions) {
    result.set(pattern, decision.isSelect);
  }
  return result;
}

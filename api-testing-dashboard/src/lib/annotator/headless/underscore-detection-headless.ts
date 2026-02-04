/**
 * Headless Underscore Detection
 *
 * Rule-based underscore classification without AI.
 * Replaces AI-based underscore classification for network-isolated operation.
 *
 * Classification Rules:
 * - Highlighted underscores → FILLABLE (always)
 * - Long underscores (20+ chars) → SIGNATURE LINE (skip)
 * - Near signature keywords (By, Its, Witness) → SIGNATURE LINE
 * - Short underscores with inline label → FILLABLE
 * - At end of document (last 15%) → likely SIGNATURE LINE
 */

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface UnderscoreCandidate {
  fullMatch: string;
  position: number;
  contextBefore: string;
  contextAfter: string;
  isHighlighted: boolean;
  textBeforeOnLine: string;
  textAfterOnLine: string;
}

export interface UnderscoreDecision {
  isFillable: boolean;
  reason: string;
  label: string | null;
}

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

/**
 * Keywords that indicate signature blocks (skip these)
 */
const SIGNATURE_KEYWORDS = [
  'by:',
  'its:',
  'name:',
  'title:',
  'witness',
  'signature',
  'signed',
  'authorized',
  'representative',
  'print name',
  'printed name',
  'place/date',
  'place, date',
  'ort, datum',      // German
  'místo, datum',    // Czech
  'lugar y fecha',   // Spanish
];

/**
 * Keywords that indicate fillable fields
 */
const FILLABLE_KEYWORDS = [
  'name:',
  'date:',
  'amount:',
  'address:',
  'phone:',
  'email:',
  'account:',
  'number:',
  'sum:',
  'price:',
  'value:',
  'city:',
  'state:',
  'zip:',
  'country:',
  'company:',
  'title:',
  'position:',
  'id:',
  'reference:',
  // German
  'name:',
  'datum:',
  'betrag:',
  'adresse:',
  // Czech
  'jméno:',
  'datum:',
  'částka:',
  'adresa:',
];

/**
 * Label patterns (word followed by colon before underscores)
 */
const LABEL_PATTERN = /([A-Za-zÀ-ž][A-Za-zÀ-ž\s]{1,25})[:.][ \t]*$/;

// ----------------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------------

/**
 * Check if context contains signature keywords
 */
function containsSignatureKeyword(text: string): boolean {
  const lowerText = text.toLowerCase();
  return SIGNATURE_KEYWORDS.some(kw => lowerText.includes(kw));
}

/**
 * Check if context contains fillable keywords
 */
function containsFillableKeyword(text: string): { found: boolean; keyword: string | null } {
  const lowerText = text.toLowerCase();
  for (const kw of FILLABLE_KEYWORDS) {
    if (lowerText.includes(kw)) {
      return { found: true, keyword: kw.replace(':', '') };
    }
  }
  return { found: false, keyword: null };
}

/**
 * Extract label from context before underscores
 */
function extractLabel(contextBefore: string): string | null {
  const lastNewline = contextBefore.lastIndexOf('\n');
  const textOnSameLine = contextBefore.slice(lastNewline + 1);

  const match = textOnSameLine.match(LABEL_PATTERN);
  if (match) {
    return match[1].trim();
  }

  return null;
}

/**
 * Check if position is in signature area (last 15% of document)
 */
function isInSignatureArea(position: number, documentLength: number): boolean {
  return position > documentLength * 0.85;
}

/**
 * Check if underscores are on a standalone line (no other text)
 */
function isStandaloneLine(textBefore: string, textAfter: string): boolean {
  const beforeTrimmed = textBefore.trim();
  const afterTrimmed = textAfter.trim();

  // No text before (or just whitespace/punctuation)
  const noTextBefore = !beforeTrimmed || /^[\s\.,;:]*$/.test(beforeTrimmed);
  // No text after (or just whitespace/newline)
  const noTextAfter = !afterTrimmed || /^[\s\n\r]*$/.test(afterTrimmed);

  return noTextBefore && noTextAfter;
}

// ----------------------------------------------------------------------------
// Main Classification Function
// ----------------------------------------------------------------------------

/**
 * Classify a single underscore pattern.
 *
 * @param candidate Underscore candidate to classify
 * @param documentLength Total document length (for position-based heuristics)
 * @returns Classification decision
 */
export function classifyUnderscore(
  candidate: UnderscoreCandidate,
  documentLength: number
): UnderscoreDecision {
  const {
    fullMatch,
    position,
    contextBefore,
    contextAfter,
    isHighlighted,
    textBeforeOnLine,
    textAfterOnLine,
  } = candidate;

  // Rule 1: Highlighted underscores are ALWAYS fillable
  if (isHighlighted) {
    const label = extractLabel(contextBefore);
    return {
      isFillable: true,
      reason: 'Highlighted underscores are fillable fields',
      label,
    };
  }

  // Rule 2: Long underscores (20+ chars) without highlighting are signature lines
  if (fullMatch.length >= 20) {
    // Exception: if there's a clear label with colon right before
    const label = extractLabel(contextBefore);
    const fillableCheck = containsFillableKeyword(textBeforeOnLine);

    if (label && fillableCheck.found) {
      return {
        isFillable: true,
        reason: 'Long underscores with fillable label',
        label: fillableCheck.keyword || label,
      };
    }

    return {
      isFillable: false,
      reason: 'Long underscores (20+ chars) are signature lines',
      label: null,
    };
  }

  // Rule 3: Near signature keywords → signature line
  if (containsSignatureKeyword(textBeforeOnLine) ||
      containsSignatureKeyword(contextBefore.slice(-100))) {
    // Exception: "Name:" followed by underscores is fillable
    if (/name:\s*$/i.test(textBeforeOnLine)) {
      return {
        isFillable: true,
        reason: 'Name field in signature block',
        label: 'Name',
      };
    }

    return {
      isFillable: false,
      reason: 'Near signature keywords',
      label: null,
    };
  }

  // Rule 4: Standalone line in signature area → signature line
  if (isStandaloneLine(textBeforeOnLine, textAfterOnLine) &&
      isInSignatureArea(position, documentLength)) {
    return {
      isFillable: false,
      reason: 'Standalone line in signature area',
      label: null,
    };
  }

  // Rule 5: Has inline label with colon → fillable
  const label = extractLabel(contextBefore);
  if (label) {
    return {
      isFillable: true,
      reason: 'Has inline label',
      label,
    };
  }

  // Rule 6: Contains fillable keyword → fillable
  const fillableCheck = containsFillableKeyword(textBeforeOnLine + ' ' + contextBefore.slice(-50));
  if (fillableCheck.found) {
    return {
      isFillable: true,
      reason: 'Contains fillable keyword',
      label: fillableCheck.keyword,
    };
  }

  // Rule 7: Short underscores (< 15 chars) with text nearby → likely fillable
  if (fullMatch.length < 15 && (textBeforeOnLine.trim() || textAfterOnLine.trim())) {
    // Try to extract label from immediate context
    const immediateLabel = textBeforeOnLine.match(/(\w+)[\s:]*$/)?.[1] || null;
    return {
      isFillable: true,
      reason: 'Short underscores with nearby text',
      label: immediateLabel,
    };
  }

  // Default: conservative - treat as signature line
  return {
    isFillable: false,
    reason: 'Default: ambiguous underscores treated as signature line',
    label: null,
  };
}

/**
 * Classify multiple underscore candidates.
 *
 * @param candidates Array of underscore candidates
 * @param documentLength Total document length
 * @returns Map of position -> decision
 */
export function classifyUnderscoresLocal(
  candidates: UnderscoreCandidate[],
  documentLength: number
): Map<number, UnderscoreDecision> {
  const results = new Map<number, UnderscoreDecision>();

  for (const candidate of candidates) {
    const decision = classifyUnderscore(candidate, documentLength);
    results.set(candidate.position, decision);

    console.log(
      `[underscore-headless] pos=${candidate.position} len=${candidate.fullMatch.length} -> ${decision.isFillable ? 'FILLABLE' : 'SIGNATURE'} (${decision.reason})`
    );
  }

  return results;
}

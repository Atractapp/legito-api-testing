/**
 * Link Detection Service
 *
 * Handles detection and conversion of duplicate placeholders to Links.
 *
 * In Legito, when the same placeholder appears multiple times:
 * - FIRST occurrence: Keep original type (TextInput, Select, Date, Money, etc.)
 * - SUBSEQUENT occurrences: Convert to [Link]
 *
 * EXCEPTION: Signature blocks - dates/cities for different parties stay as new inputs.
 */

import type { AnnotationType, AnnotationSuggestion } from '@/types/annotator';

// ----------------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------------

/**
 * Check if original text is a "context-less" placeholder that needs surrounding context.
 * These are generic placeholders that could mean different things in different places.
 */
export function isContextlessPlaceholder(text: string): boolean {
  const trimmed = text.trim();

  // Just X's: X, XX, XXX, Xx
  if (/^[Xx]+$/.test(trimmed)) return true;

  // X's with separators: X.X.X, XX/XX/XXXX
  if (/^[Xx]+([.\/-][Xx]+)+$/.test(trimmed)) return true;

  // Just underscores
  if (/^_+$/.test(trimmed)) return true;

  // Bracketed X: [X], {XX}, <XXX>
  if (/^[\[\{<][Xx_\s]+[\]\}>]$/.test(trimmed)) return true;

  // Just symbols: *, **, ***, etc.
  if (/^[*\#\?\.\-\s]+$/.test(trimmed)) return true;

  return false;
}

/**
 * Get the contextual key for a placeholder.
 * For context-less placeholders, include surrounding words.
 * For meaningful placeholders, just use the text itself.
 */
export function getContextualKey(
  suggestion: AnnotationSuggestion,
  documentText?: string
): string {
  const originalLower = suggestion.originalText.toLowerCase();

  // If it's a meaningful placeholder, just use the text
  if (!isContextlessPlaceholder(suggestion.originalText)) {
    return originalLower;
  }

  // For context-less placeholders, include surrounding context
  if (!documentText) {
    return originalLower;
  }

  // Get a few words before and after
  const start = Math.max(0, suggestion.position.start - 50);
  const end = Math.min(documentText.length, suggestion.position.end + 50);
  const before = documentText.slice(start, suggestion.position.start);
  const after = documentText.slice(suggestion.position.end, end);

  // Extract the word immediately before (like "Name" in "Name [X]")
  const wordBefore = before.match(/(\w+)\s*$/)?.[1]?.toLowerCase() || '';
  // Extract the word immediately after (like "field" in "[X] field")
  const wordAfter = after.match(/^\s*(\w+)/)?.[1]?.toLowerCase() || '';

  // Build contextual key: "wordBefore|original|wordAfter"
  return `${wordBefore}|${originalLower}|${wordAfter}`;
}

// ----------------------------------------------------------------------------
// Signature Block Detection
// ----------------------------------------------------------------------------

/**
 * Check if a position in the document is within a signature block.
 *
 * LANGUAGE-AGNOSTIC detection based on structural patterns:
 * - Underscore lines (signature lines)
 * - Position in document (last 30%)
 * - Repetitive placeholder structure
 * - Date-like patterns near placeholders
 */
export function isInSignatureBlock(documentText: string, position: number): boolean {
  // Get context around position
  const contextStart = Math.max(0, position - 500);
  const contextEnd = Math.min(documentText.length, position + 300);
  const contextBefore = documentText.slice(contextStart, position);
  const contextAfter = documentText.slice(position, contextEnd);
  const fullContext = contextBefore + contextAfter;

  // Pattern 1: Underscore signature lines nearby
  if (/_{5,}/.test(fullContext)) {
    return true;
  }

  // Pattern 2: Location + date structure
  const locationDatePattern = /\b\w{1,4}\s+\w+,?\s+\w{1,4}\s+[\dXx]{1,2}[.\/-]/i;
  if (locationDatePattern.test(fullContext)) {
    return true;
  }

  // Pattern 3: Date patterns in the last portion of document
  const datePatterns = [
    /[\dXx]{1,2}[.\/-][\dXx]{1,2}[.\/-][\dXx]{2,4}/,
    /\b[Dd]{2}[.\/-][Mm]{2}[.\/-][Yy]{2,4}\b/,
  ];

  const positionRatio = position / documentText.length;

  // Last 30% of document with date pattern
  if (positionRatio > 0.7) {
    for (const pattern of datePatterns) {
      if (pattern.test(fullContext)) {
        return true;
      }
    }
  }

  // Pattern 4: Multiple similar short blocks
  const newlineCount = (fullContext.match(/\n/g) || []).length;
  const avgLineLength = fullContext.length / Math.max(newlineCount, 1);

  if (positionRatio > 0.7 && newlineCount >= 3 && avgLineLength < 60) {
    return true;
  }

  // Pattern 5: Position-based with placeholder density
  if (positionRatio > 0.75) {
    const placeholderPatterns =
      fullContext.match(/\{[^}]+\}|\[[^\]]+\]|_{3,}|[Xx]{2,}[.\/-][Xx]{2,}/g) || [];
    if (placeholderPatterns.length >= 2) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a suggestion is likely a signature-related field (city, date for signing).
 * These fields should remain as NEW inputs in signature blocks, not become Links.
 */
export function isLikelySignatureField(suggestion: AnnotationSuggestion): boolean {
  const originalText = suggestion.originalText;

  // Date type
  if (suggestion.type === 'Date') {
    return true;
  }

  // Date-like placeholder patterns
  if (/^[\dXxDdMmYy]{1,4}[.\/-][\dXxDdMmYy]{1,4}[.\/-][\dXxDdMmYy]{2,4}$/.test(originalText.trim())) {
    return true;
  }

  // DD.MM.YYYY literal pattern
  if (/^[Dd]{1,2}[.\/-][Mm]{1,2}[.\/-][Yy]{2,4}$/.test(originalText.trim())) {
    return true;
  }

  // X patterns
  if (/^[Xx]{2,}([.\/-][Xx]{2,})*$/.test(originalText.trim())) {
    return true;
  }

  // Short single-word text (likely city/location)
  const trimmed = originalText.trim();
  if (/^[A-Z][a-zA-Z\u00C0-\u024F]{2,14}$/.test(trimmed)) {
    return true;
  }

  // Placeholder with only special characters
  if (/^[\[\{\(]?[_\-\s\*\.]{2,}[\]\}\)]?$/.test(trimmed)) {
    return true;
  }

  return false;
}

// ----------------------------------------------------------------------------
// Party Name Detection
// ----------------------------------------------------------------------------

/**
 * Find additional occurrences of party-name-like placeholders in the document.
 *
 * When we detect a placeholder like "Creditor's name" or "Debtor's name",
 * we should search the document for any other occurrences of that exact text
 * and add them as Link suggestions.
 */
export function findPartyNameDuplicates(
  existingSuggestions: AnnotationSuggestion[],
  documentText: string
): AnnotationSuggestion[] {
  const duplicates: AnnotationSuggestion[] = [];

  // Get positions already covered
  const coveredPositions = new Set<string>();
  for (const s of existingSuggestions) {
    for (let i = s.position.start; i < s.position.end; i++) {
      coveredPositions.add(String(i));
    }
  }

  // Find party-name-like suggestions
  const partyNamePatterns = [
    /\b(creditor|debtor|buyer|seller|lessor|lessee|landlord|tenant|employer|employee|borrower|lender|party|name)\b/i,
    /\bname\b/i,
  ];

  for (const suggestion of existingSuggestions) {
    if (suggestion.type !== 'TextInput') continue;

    const originalText = suggestion.originalText;
    const isPartyName = partyNamePatterns.some((p) => p.test(originalText));

    if (!isPartyName) continue;

    const originalLower = originalText.toLowerCase();
    const documentLower = documentText.toLowerCase();

    let searchPos = 0;
    while (true) {
      const foundIndex = documentLower.indexOf(originalLower, searchPos);
      if (foundIndex === -1) break;

      // Skip if already covered
      if (coveredPositions.has(String(foundIndex))) {
        searchPos = foundIndex + originalText.length;
        continue;
      }

      // Verify word boundary
      const charBefore = foundIndex > 0 ? documentText[foundIndex - 1] : ' ';
      const charAfter =
        foundIndex + originalText.length < documentText.length
          ? documentText[foundIndex + originalText.length]
          : ' ';

      const isWordBoundaryBefore = /[^a-zA-Z0-9]/.test(charBefore);
      const isWordBoundaryAfter = /[^a-zA-Z0-9]/.test(charAfter);

      if (!isWordBoundaryBefore || !isWordBoundaryAfter) {
        searchPos = foundIndex + originalText.length;
        continue;
      }

      const actualText = documentText.slice(foundIndex, foundIndex + originalText.length);

      console.log(`[findPartyNameDuplicates] Found duplicate party name "${actualText}" at ${foundIndex}`);

      duplicates.push({
        id: crypto.randomUUID(),
        originalText: actualText,
        annotatedText: '[Textinput]',
        type: 'TextInput',
        position: {
          start: foundIndex,
          end: foundIndex + originalText.length,
        },
        confidence: 0.9,
        isAccepted: true,
        isEdited: false,
        isFromPattern: false,
      });

      for (let i = foundIndex; i < foundIndex + originalText.length; i++) {
        coveredPositions.add(String(i));
      }

      searchPos = foundIndex + originalText.length;
    }
  }

  return duplicates;
}

// ----------------------------------------------------------------------------
// Main Conversion Function
// ----------------------------------------------------------------------------

// Title/salutation Select patterns that SHOULD become Links on second occurrence
const TITLE_SELECT_PATTERNS = [
  'D/Dª',
  'D/Dª.',
  'Mr/Ms',
  'Mr/Ms.',
  'Herr/Frau',
  'Sr./Sra.',
  'Sr/Sra',
];

/**
 * Convert duplicate occurrences to [Link].
 *
 * In Legito, when the same placeholder appears multiple times:
 * - FIRST occurrence: Keep original type
 * - SUBSEQUENT occurrences: Convert to [Link]
 *
 * @param suggestions - Sorted by position (earliest first)
 * @param documentText - Full document text for context analysis
 */
export function convertDuplicatesToLinks(
  suggestions: AnnotationSuggestion[],
  documentText?: string
): AnnotationSuggestion[] {
  const seenTextInputs = new Map<string, { count: number; firstAnnotation: string }>();
  const seenTitleSelects = new Map<string, { count: number; firstAnnotation: string }>();
  const seenDatePlaceholders = new Map<string, { count: number; firstAnnotation: string }>();
  const seenMoneyPlaceholders = new Map<string, { count: number; firstAnnotation: string }>();

  return suggestions.map((suggestion) => {
    // Debug: Log what's coming in
    if (suggestion.originalText.includes('Guarantor')) {
      console.log(`[convertDuplicatesToLinks] Processing: "${suggestion.originalText}" type=${suggestion.type}`);
    }

    // Rule 1: Dates - distinguish between placeholders and date patterns
    if (suggestion.type === 'Date') {
      const isBracketedDatePlaceholder = /^\[date\]$/i.test(suggestion.originalText);
      const isAngleBracketDatePlaceholder = /^<<.*(date|datum).*>>$/i.test(suggestion.originalText);

      if (isBracketedDatePlaceholder || isAngleBracketDatePlaceholder) {
        const key = suggestion.originalText.toLowerCase();
        if (seenDatePlaceholders.has(key)) {
          console.log(`[convertDuplicatesToLinks] Converting duplicate date placeholder "${suggestion.originalText}" to [Link]`);
          return {
            ...suggestion,
            annotatedText: '[Link]',
            type: 'Link' as AnnotationType,
            confidence: Math.min(suggestion.confidence, 0.95),
          };
        } else {
          seenDatePlaceholders.set(key, { count: 1, firstAnnotation: suggestion.annotatedText });
          return suggestion;
        }
      }

      // Regular date pattern (DD.MM.YYYY etc) - never becomes Link
      return suggestion;
    }

    // Rule 2: Money - angle-bracket money placeholders can become Links on duplicates
    if (suggestion.type === 'Money') {
      const isAngleBracketMoney = /^(\$)?<<.+>>$/.test(suggestion.originalText);
      if (isAngleBracketMoney) {
        const key = suggestion.originalText.toLowerCase();
        if (seenMoneyPlaceholders.has(key)) {
          console.log(`[convertDuplicatesToLinks] Converting duplicate money placeholder "${suggestion.originalText}" to [Link]`);
          return {
            ...suggestion,
            annotatedText: '[Link]',
            type: 'Link' as AnnotationType,
            confidence: Math.min(suggestion.confidence, 0.95),
          };
        } else {
          seenMoneyPlaceholders.set(key, { count: 1, firstAnnotation: suggestion.annotatedText });
          return suggestion;
        }
      }
      // Regular money pattern - never becomes Link
      return suggestion;
    }

    // Rule 2b: Calculation never becomes Link
    if (suggestion.type === 'Calculation') {
      return suggestion;
    }

    // Rule 3: Select - most never become Links, but title salutations should
    if (suggestion.type === 'Select') {
      const isTitleSelect = TITLE_SELECT_PATTERNS.some(
        (p) => suggestion.originalText.includes(p) || suggestion.annotatedText.includes(p)
      );

      if (isTitleSelect) {
        const key = suggestion.originalText.toLowerCase();
        if (seenTitleSelects.has(key)) {
          console.log(
            `[convertDuplicatesToLinks] Converting duplicate title Select "${suggestion.originalText}" to [Link]`
          );
          return {
            ...suggestion,
            annotatedText: '[Link]',
            type: 'Link' as AnnotationType,
            confidence: Math.min(suggestion.confidence, 0.95),
          };
        } else {
          seenTitleSelects.set(key, { count: 1, firstAnnotation: suggestion.annotatedText });
          return suggestion;
        }
      }

      return suggestion;
    }

    // Rule 4: TextInput - check for duplicates
    const originalLower = suggestion.originalText.toLowerCase();

    // Skip generic placeholders
    if (isContextlessPlaceholder(suggestion.originalText)) {
      return suggestion;
    }

    // Skip single digits
    if (/^\d$/.test(suggestion.originalText.trim())) {
      return suggestion;
    }

    if (seenTextInputs.has(originalLower)) {
      const seen = seenTextInputs.get(originalLower)!;
      seen.count++;

      // Check if this is a placeholder pattern that should become Link on duplicates
      const isAngleBracketPlaceholder = /^(\$)?<<.+>>$/.test(suggestion.originalText);
      const isPartyNamePattern =
        /\b(name|creditor|debtor|buyer|seller|lessor|lessee|landlord|tenant|employer|employee)\b/i.test(
          originalLower
        );
      const isBracketPlaceholder = /^\[.+\]$/.test(suggestion.originalText);

      // Convert to Link if duplicate of: angle-bracket, party name, or bracket placeholder
      if (isAngleBracketPlaceholder || isPartyNamePattern || isBracketPlaceholder) {
        console.log(`[convertDuplicatesToLinks] Converting duplicate "${suggestion.originalText}" to [Link]`);
        return {
          ...suggestion,
          annotatedText: '[Link]',
          type: 'Link' as AnnotationType,
          confidence: Math.min(suggestion.confidence, 0.95),
        };
      }

      return suggestion;
    } else {
      seenTextInputs.set(originalLower, { count: 1, firstAnnotation: suggestion.annotatedText });
      return suggestion;
    }
  });
}

// ----------------------------------------------------------------------------
// Overlapping Suggestion Removal
// ----------------------------------------------------------------------------

/**
 * Remove overlapping suggestions, keeping the one with higher confidence.
 */
export function removeOverlappingSuggestions(
  suggestions: AnnotationSuggestion[]
): AnnotationSuggestion[] {
  const result: AnnotationSuggestion[] = [];

  for (const suggestion of suggestions) {
    const overlapping = result.find((s) => {
      return (
        (suggestion.position.start >= s.position.start && suggestion.position.start < s.position.end) ||
        (suggestion.position.end > s.position.start && suggestion.position.end <= s.position.end) ||
        (suggestion.position.start <= s.position.start && suggestion.position.end >= s.position.end)
      );
    });

    if (overlapping) {
      // Keep the one with higher confidence, or the longer match
      if (
        suggestion.confidence > overlapping.confidence ||
        (suggestion.confidence === overlapping.confidence &&
          suggestion.originalText.length > overlapping.originalText.length)
      ) {
        const idx = result.indexOf(overlapping);
        result[idx] = suggestion;
      }
    } else {
      result.push(suggestion);
    }
  }

  return result;
}

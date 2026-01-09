/**
 * Type Inference Service
 *
 * Phase 5: Service extraction from route.ts
 *
 * Infers annotation types from placeholder names and surrounding context.
 * Uses database-driven rules from TypeRulesService for keyword matching.
 */

import type { AnnotationType } from '@/types/annotator';
import {
  checkDateContextBeforeSync,
  checkDateContextAfterSync,
  checkMoneyContextSync,
  checkDateNameKeywordSync,
  checkMoneyNameKeywordSync,
  checkSelectNameKeywordSync,
} from '../type-rules-service';

/**
 * Result of type inference
 */
export interface TypeInferenceResult {
  type: AnnotationType;
  label: string;
}

/**
 * Infer annotation type and label from placeholder name AND surrounding context.
 *
 * PRIORITY ORDER (context overrides name):
 * 1. Strong context indicators (e.g., "do {X}" in Czech = until date)
 * 2. Placeholder name keywords
 * 3. Default to TextInput
 *
 * Examples:
 * - "LoanTo" with context "do {LoanTo}" → Date (context: "do" = until)
 * - "SignatureDate" → Date
 * - "RulesOfSignature_Header" → TextInput (it's a _Header field)
 */
export function inferAnnotationFromPlaceholderName(
  placeholderName: string,
  contextBefore?: string,
  contextAfter?: string
): TypeInferenceResult {
  const nameLower = placeholderName.toLowerCase();
  const label = humanizeLabel(placeholderName);

  // Get nearby context (last 100 chars before, first 100 after)
  const beforeText = (contextBefore || '').slice(-100).toLowerCase();
  const afterText = (contextAfter || '').slice(0, 100).toLowerCase();

  // ============================================================
  // PRIORITY 0: Single digits are NOT dates
  // A single number like "1" in "Season 1" is not a date field
  // ============================================================
  if (/^\d$/.test(placeholderName.trim())) {
    console.log(`[inferType] "${placeholderName}" → TextInput (single digit, not a date)`);
    return { type: 'TextInput', label };
  }

  // ============================================================
  // PRIORITY 1: Check for _Header suffix - always TextInput
  // These are template structure fields, not data fields
  // ============================================================
  if (nameLower.endsWith('_header') || nameLower.includes('_header')) {
    return { type: 'TextInput', label };
  }

  // ============================================================
  // PRIORITY 2: Strong CONTEXT indicators (override name inference)
  // BUT: Context alone is NOT enough - placeholder must also look date-like
  // ============================================================

  // Check if the placeholder LOOKS like it could be a date
  // STRICT: Only match patterns that are clearly date-like
  // NOT underscores - those are generic placeholders
  const looksLikeDate = (text: string): boolean => {
    const t = text.trim();
    // X patterns with date-like structure: XX.XX.XXXX, XX/XX/XX
    if (/^[Xx]{1,2}[.\/-][Xx]{1,2}[.\/-][Xx]{2,4}$/.test(t)) return true;
    // Numbers with date structure: 12.05.2024, 1/1/24
    if (/^\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4}$/.test(t)) return true;
    // DD.MM.YYYY format
    if (/^[Dd]{1,2}[.\/-][Mm]{1,2}[.\/-][YyRr]{2,4}$/.test(t)) return true;
    // DO NOT include just underscores or single numbers - too generic
    return false;
  };

  // ============================================================
  // Check date context using TypeRulesService (database-driven)
  // ============================================================

  // Check STRONG date indicators first (from database)
  const dateContextResult = checkDateContextBeforeSync(beforeText);
  if (dateContextResult.matched && dateContextResult.strength === 'strong') {
    console.log(`[inferType] "${placeholderName}" → Date (STRONG context: "${dateContextResult.keyword}")`);
    return { type: 'Date', label };
  }

  // Check WEAK indicators - ONLY if placeholder looks like a date
  if (looksLikeDate(placeholderName) && dateContextResult.matched && dateContextResult.strength === 'weak') {
    console.log(`[inferType] "${placeholderName}" → Date (weak context "${dateContextResult.keyword}" + date-like placeholder)`);
    return { type: 'Date', label };
  }

  // Date context indicators AFTER placeholder (only if placeholder looks date-like)
  if (looksLikeDate(placeholderName)) {
    const dateAfterResult = checkDateContextAfterSync(afterText);
    if (dateAfterResult.matched) {
      console.log(`[inferType] "${placeholderName}" → Date (context: "${dateAfterResult.keyword}" after)`);
      return { type: 'Date', label };
    }
  }

  // ============================================================
  // Check money context using TypeRulesService (database-driven)
  // ============================================================
  const moneyResult = checkMoneyContextSync(beforeText, afterText);
  if (moneyResult.matched) {
    console.log(`[inferType] "${placeholderName}" → Money (context: "${moneyResult.keyword}" ${moneyResult.position})`);
    return { type: 'Money', label };
  }

  // ============================================================
  // PRIORITY 3: Placeholder NAME keywords (weaker than context)
  // CRITICAL: Only apply to SHORT placeholders (< 5 words)
  // Long sentences like "Any VAT payable..." should NOT trigger keywords
  // ============================================================
  const wordCount = placeholderName.split(/\s+/).filter(w => w.length > 0).length;

  // Skip keyword inference for sentences (5+ words) - they're not placeholders
  if (wordCount >= 5) {
    console.log(`[inferType] "${placeholderName.slice(0, 50)}..." → TextInput (too long for keyword inference, ${wordCount} words)`);
    return { type: 'TextInput', label };
  }

  // Date indicators in name (but NOT if it's a _Header or _Addition field)
  // Uses TypeRulesService (database-driven)
  const dateNameResult = checkDateNameKeywordSync(placeholderName);
  if (dateNameResult.matched && !nameLower.includes('_')) {
    return { type: 'Date', label };
  }

  // Money indicators in name
  // NOTE: "amount" is NOT a money keyword - it's too generic (appears in "in the amount of")
  // "Loan" CAN trigger Money, but NOT if it ends with "To" (e.g., "LoanTo" = end date)
  // Check for date-suffix patterns first
  if (nameLower.endsWith('to') && nameLower.includes('loan')) {
    // "LoanTo" = loan end date, NOT money
    console.log(`[inferType] "${placeholderName}" → Date (ends with "To", likely end date)`);
    return { type: 'Date', label };
  }

  // Money indicators in name - Uses TypeRulesService (database-driven)
  // EXCEPTION: "Loan No.", "Loan Number", "Loan ID" are NOT money - they're identifiers
  const isLoanIdentifier = /loan\s*(no\.?|number|id|#|ref)/i.test(placeholderName);
  if (!isLoanIdentifier) {
    const moneyNameResult = checkMoneyNameKeywordSync(placeholderName);
    if (moneyNameResult.matched) {
      return { type: 'Money', label };
    }
  }

  // Select indicators (options, choices) - Uses TypeRulesService (database-driven)
  const selectNameResult = checkSelectNameKeywordSync(placeholderName);
  if (selectNameResult.matched) {
    return { type: 'Select', label };
  }

  // Default to TextInput with humanized label
  return { type: 'TextInput', label };
}

/**
 * Convert CamelCase or snake_case placeholder name to human-readable label.
 *
 * Examples:
 * - "ContractNumber" → "Contract Number"
 * - "contract_number" → "Contract Number"
 * - "ContractPartnerName" → "Contract Partner Name"
 */
export function humanizeLabel(placeholderName: string): string {
  // Replace underscores with spaces
  let label = placeholderName.replace(/_/g, ' ');

  // Split CamelCase: "ContractNumber" → "Contract Number"
  label = label.replace(/([a-z])([A-Z])/g, '$1 $2');

  // PRESERVE original case - don't force capitalize
  // This keeps "Creditor's name" as-is instead of "Creditor's Name"
  return label.trim();
}

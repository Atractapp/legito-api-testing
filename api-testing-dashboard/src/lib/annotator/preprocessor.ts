/**
 * Document Preprocessor - Fillable Candidate Detection
 *
 * Identifies fillable regions in documents BEFORE calling Claude.
 * This is the first layer of defense against over-annotation.
 */

import type { AnnotationType } from '@/types/annotator';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface CandidateRegion {
  id: number;
  text: string;
  position: {
    start: number;
    end: number;
  };
  type: 'bracket' | 'underscore' | 'x_pattern' | 'instruction' | 'label_blank' | 'placeholder';
  suggestedType: AnnotationType;
  confidence: number;
}

// ----------------------------------------------------------------------------
// Main Detection Function
// ----------------------------------------------------------------------------

/**
 * Identify fillable candidates in a document.
 * These are regions where a user needs to enter information.
 *
 * Detection patterns:
 * 1. Bracketed blanks: [___], {___}, <___>
 * 2. Underscores: _____, ____________
 * 3. X patterns: XXX, XX.XX.XXXX
 * 4. Placeholder instructions: [insert name], <date>
 * 5. Label followed by blank: "Name: _____"
 * 6. Date placeholders: DD.MM.YYYY
 */
export function identifyFillableCandidates(documentText: string): CandidateRegion[] {
  const candidates: CandidateRegion[] = [];
  let idCounter = 0;

  // Pattern 1: Bracketed blanks [___], {___}, (but NOT annotation brackets)
  const bracketPattern = /\[[_\s]{2,}\]|\{[_\s]{2,}\}|<[_\s]{2,}>/g;
  let match;
  while ((match = bracketPattern.exec(documentText)) !== null) {
    candidates.push({
      id: ++idCounter,
      text: match[0],
      position: { start: match.index, end: match.index + match[0].length },
      type: 'bracket',
      suggestedType: 'TextInput',
      confidence: 0.95,
    });
  }

  // Pattern 2: Underscores (3+ consecutive)
  const underscorePattern = /_{3,}/g;
  while ((match = underscorePattern.exec(documentText)) !== null) {
    // Check if already captured in bracket pattern
    const alreadyCaptured = candidates.some(
      (c) => c.position.start <= match!.index && c.position.end >= match!.index + match![0].length
    );
    if (!alreadyCaptured) {
      // Look at context to determine type
      const contextBefore = documentText.slice(Math.max(0, match.index - 50), match.index).toLowerCase();
      let suggestedType: AnnotationType = 'TextInput';
      let confidence = 0.9;

      if (/date|datum|dated|den\s*$/i.test(contextBefore)) {
        suggestedType = 'Date';
        confidence = 0.85;
      } else if (/amount|částka|cena|price|sum|value|fee/i.test(contextBefore)) {
        suggestedType = 'Money';
        confidence = 0.85;
      }

      candidates.push({
        id: ++idCounter,
        text: match[0],
        position: { start: match.index, end: match.index + match[0].length },
        type: 'underscore',
        suggestedType,
        confidence,
      });
    }
  }

  // Pattern 3: X patterns (XXX, XXXX, but also XX.XX.XXXX for dates)
  const xDatePattern = /X{1,2}[.\/-]X{1,2}[.\/-]X{2,4}/gi;
  while ((match = xDatePattern.exec(documentText)) !== null) {
    candidates.push({
      id: ++idCounter,
      text: match[0],
      position: { start: match.index, end: match.index + match[0].length },
      type: 'x_pattern',
      suggestedType: 'Date',
      confidence: 0.95,
    });
  }

  // X patterns for money (XXX EUR, XXX CZK)
  const xMoneyPattern = /X{2,}\s*(EUR|CZK|USD|Kč)/gi;
  while ((match = xMoneyPattern.exec(documentText)) !== null) {
    // Skip if already captured
    const alreadyCaptured = candidates.some(
      (c) => c.position.start <= match!.index && c.position.end >= match!.index + match![0].length
    );
    if (!alreadyCaptured) {
      candidates.push({
        id: ++idCounter,
        text: match[0],
        position: { start: match.index, end: match.index + match[0].length },
        type: 'x_pattern',
        suggestedType: 'Money',
        confidence: 0.95,
      });
    }
  }

  // Standalone XXX (not currency)
  const xStandalonePattern = /\bX{3,}\b/gi;
  while ((match = xStandalonePattern.exec(documentText)) !== null) {
    const alreadyCaptured = candidates.some(
      (c) => c.position.start <= match!.index && c.position.end >= match!.index + match![0].length
    );
    if (!alreadyCaptured) {
      candidates.push({
        id: ++idCounter,
        text: match[0],
        position: { start: match.index, end: match.index + match[0].length },
        type: 'x_pattern',
        suggestedType: 'TextInput',
        confidence: 0.85,
      });
    }
  }

  // Pattern 4: Placeholder instructions
  const instructionPattern = /\[(?:insert|enter|fill in|doplnit|vložit)\s+[^\]]+\]/gi;
  while ((match = instructionPattern.exec(documentText)) !== null) {
    candidates.push({
      id: ++idCounter,
      text: match[0],
      position: { start: match.index, end: match.index + match[0].length },
      type: 'instruction',
      suggestedType: 'TextInput',
      confidence: 0.9,
    });
  }

  // Pattern 5: DD.MM.YYYY, D.M.YYYY type placeholders
  const dateFormatPattern = /\bD{1,2}[.\/-]M{1,2}[.\/-]Y{2,4}\b/gi;
  while ((match = dateFormatPattern.exec(documentText)) !== null) {
    candidates.push({
      id: ++idCounter,
      text: match[0],
      position: { start: match.index, end: match.index + match[0].length },
      type: 'placeholder',
      suggestedType: 'Date',
      confidence: 0.95,
    });
  }

  // Pattern 6: Dots placeholder (.....)
  const dotsPattern = /\.{5,}/g;
  while ((match = dotsPattern.exec(documentText)) !== null) {
    candidates.push({
      id: ++idCounter,
      text: match[0],
      position: { start: match.index, end: match.index + match[0].length },
      type: 'placeholder',
      suggestedType: 'TextInput',
      confidence: 0.85,
    });
  }

  // Pattern 7: Amount placeholders (0,00 or 0.00)
  const amountPattern = /\b0[,.]00\b/g;
  while ((match = amountPattern.exec(documentText)) !== null) {
    candidates.push({
      id: ++idCounter,
      text: match[0],
      position: { start: match.index, end: match.index + match[0].length },
      type: 'placeholder',
      suggestedType: 'Money',
      confidence: 0.9,
    });
  }

  // Pattern 8: Question marks as placeholder (???)
  const questionPattern = /\?{3,}/g;
  while ((match = questionPattern.exec(documentText)) !== null) {
    candidates.push({
      id: ++idCounter,
      text: match[0],
      position: { start: match.index, end: match.index + match[0].length },
      type: 'placeholder',
      suggestedType: 'TextInput',
      confidence: 0.8,
    });
  }

  // Sort by position
  candidates.sort((a, b) => a.position.start - b.position.start);

  // Remove overlapping candidates (keep higher confidence)
  const deduped = removeOverlapping(candidates);

  console.log(`[preprocessor] Found ${deduped.length} fillable candidates`);

  return deduped;
}

/**
 * Remove overlapping candidates, keeping the one with higher confidence
 */
function removeOverlapping(candidates: CandidateRegion[]): CandidateRegion[] {
  const result: CandidateRegion[] = [];

  for (const candidate of candidates) {
    const overlapping = result.find(
      (c) =>
        (candidate.position.start >= c.position.start && candidate.position.start < c.position.end) ||
        (candidate.position.end > c.position.start && candidate.position.end <= c.position.end)
    );

    if (overlapping) {
      // Keep the one with higher confidence
      if (candidate.confidence > overlapping.confidence) {
        const idx = result.indexOf(overlapping);
        result[idx] = candidate;
      }
      // Otherwise keep existing
    } else {
      result.push(candidate);
    }
  }

  return result;
}

/**
 * Extract context around a candidate for pattern matching
 */
export function getCandidateContext(
  documentText: string,
  candidate: CandidateRegion,
  contextLength: number = 50
): { before: string; after: string } {
  const before = documentText.slice(
    Math.max(0, candidate.position.start - contextLength),
    candidate.position.start
  );
  const after = documentText.slice(
    candidate.position.end,
    candidate.position.end + contextLength
  );

  return { before, after };
}

/**
 * Format candidates for Claude prompt
 */
export function formatCandidatesForPrompt(
  candidates: CandidateRegion[],
  documentText: string
): string {
  if (candidates.length === 0) {
    return 'No fillable candidates detected in this document.';
  }

  let output = '';
  for (const candidate of candidates) {
    const context = getCandidateContext(documentText, candidate);
    output += `[Candidate ${candidate.id}]\n`;
    output += `  Text: "${candidate.text}"\n`;
    output += `  Type: ${candidate.type}\n`;
    output += `  Suggested: ${candidate.suggestedType}\n`;
    output += `  Context: "...${context.before.slice(-30)}" [HERE] "${context.after.slice(0, 30)}..."\n`;
    output += `  Position: ${candidate.position.start}-${candidate.position.end}\n\n`;
  }

  return output;
}

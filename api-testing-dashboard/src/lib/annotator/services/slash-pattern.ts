/**
 * Slash Pattern Service
 *
 * Phase 5: Service extraction from route.ts
 *
 * Handles detection and AI-based analysis of slash-separated patterns
 * like "by a bank transfer/in cash" to determine if they're real Select
 * fields or just synonyms/alternative terms.
 */

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

/**
 * A candidate slash pattern for analysis
 */
export interface SlashPatternCandidate {
  pattern: string;
  contextBefore: string;
  contextAfter: string;
  position: { start: number; end: number };
}

/**
 * AI decision for a slash pattern
 */
interface SlashPatternDecision {
  index: number;
  isSelect: boolean;
  reason: string;
}

/**
 * Analyze slash-separated patterns using AI to determine if they represent
 * real choices (Select fields) or synonyms/alternative terms.
 *
 * @param candidates Array of slash pattern candidates to analyze
 * @returns Map of pattern -> isSelect (true = real choice, false = synonym)
 */
export async function analyzeSlashPatternsWithAI(
  candidates: SlashPatternCandidate[]
): Promise<Map<string, boolean>> {
  // Map: pattern -> isSelect (true = real choice, false = synonym/title)
  const results = new Map<string, boolean>();

  if (candidates.length === 0) {
    return results;
  }

  // Build the prompt with all candidates
  const candidatesList = candidates.map((c, i) => {
    return `${i + 1}. Pattern: "${c.pattern}"
   Context before: "...${c.contextBefore}"
   Context after: "${c.contextAfter}..."`;
  }).join('\n\n');

  const prompt = `You are analyzing slash-separated patterns in a legal document to determine if they represent:
A) SELECT: A real choice between different options (user must pick one)
B) SYNONYM: Alternative terms/synonyms that mean the same thing (NOT a choice)

## Rules:
- "by a bank transfer/in cash" → SELECT (user chooses payment method)
- "Mr/Ms." or "D/Dª." → SELECT (user chooses title/salutation)
- "Marketing/PR" → SYNONYM (both mean the same thing - marketing/public relations)
- "promotional/publicity" → SYNONYM (both mean similar promotional activities)
- "treatments/scripts" → SYNONYM (different names for the same deliverable type)
- Section headers with synonyms → SYNONYM (e.g., "Date/Term/Delivery" as a section title)
- If pattern appears at start of a line/section followed by content → likely SYNONYM (title)
- If pattern is embedded in a sentence about requirements → could be either, check semantically

## Candidates to analyze:
${candidatesList}

## Response format:
Return ONLY a JSON array with the decision for each pattern:
[{"index": 1, "isSelect": true, "reason": "payment method choice"}, {"index": 2, "isSelect": false, "reason": "synonyms for same concept"}]

Analyze each pattern carefully based on context. Return ONLY the JSON array.`;

  try {
    console.log(`[AI-Slash] Analyzing ${candidates.length} slash patterns with Claude...`);

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      console.log('[AI-Slash] Unexpected response type, defaulting all to Select');
      candidates.forEach(c => results.set(c.pattern, true));
      return results;
    }

    // Parse the JSON response
    const jsonMatch = content.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.log('[AI-Slash] Could not parse JSON response, defaulting all to Select');
      candidates.forEach(c => results.set(c.pattern, true));
      return results;
    }

    const decisions = JSON.parse(jsonMatch[0]) as SlashPatternDecision[];

    for (const decision of decisions) {
      const candidate = candidates[decision.index - 1];
      if (candidate) {
        results.set(candidate.pattern, decision.isSelect);
        console.log(`[AI-Slash] "${candidate.pattern}" → ${decision.isSelect ? 'SELECT' : 'SKIP'} (${decision.reason})`);
      }
    }

    // Default any missing patterns to Select
    for (const c of candidates) {
      if (!results.has(c.pattern)) {
        results.set(c.pattern, true);
      }
    }

    return results;
  } catch (error) {
    console.error('[AI-Slash] Error analyzing patterns:', error);
    // On error, default all to Select (safer - user can correct)
    candidates.forEach(c => results.set(c.pattern, true));
    return results;
  }
}

/**
 * Detect slash patterns in document text.
 * This finds potential "option1/option2" patterns that might be Select fields.
 *
 * @param documentText Full document text
 * @param startPosition Position to start searching from
 * @param isCovered Function to check if position is already covered
 * @param isRangeCovered Function to check if range overlaps with existing detections
 * @returns Array of slash pattern candidates
 */
export function detectSlashPatterns(
  documentText: string,
  isCovered: (pos: number) => boolean,
  isRangeCovered: (start: number, end: number) => boolean,
  shouldSkipPattern: (pattern: string) => boolean,
  markCovered: (start: number, end: number) => void
): SlashPatternCandidate[] {
  const candidates: SlashPatternCandidate[] = [];

  let slashIdx = 0;
  while ((slashIdx = documentText.indexOf('/', slashIdx)) !== -1) {
    if (isCovered(slashIdx)) {
      slashIdx++;
      continue;
    }

    // Skip if looks like a date: digits/digits
    const beforeChar = documentText[slashIdx - 1] || '';
    const afterChar = documentText[slashIdx + 1] || '';
    if (/\d/.test(beforeChar) && /\d/.test(afterChar)) {
      slashIdx++;
      continue;
    }

    // Expand backwards - find the phrase before slash
    let start = slashIdx;
    let wordCount = 0;
    while (start > 0 && /\s/.test(documentText[start - 1])) start--;

    while (start > 0 && wordCount < 5) {
      const prevChar = documentText[start - 1];
      if (/[.,:;!?\n\r\t()[\]{}]/.test(prevChar)) break;

      if (/\s/.test(prevChar)) {
        let wordStart = start - 1;
        while (wordStart > 0 && /\s/.test(documentText[wordStart - 1])) wordStart--;
        while (wordStart > 0 && !/\s/.test(documentText[wordStart - 1]) && !/[.,:;!?\n\r\t()[\]{}]/.test(documentText[wordStart - 1])) wordStart--;

        const prevWord = documentText.slice(wordStart, start).trim();

        // Stop at articles/prepositions (except when part of "by a" phrase)
        if (/^(the|with|from|into|upon)$/i.test(prevWord)) break;
        if (/^(a|an)$/i.test(prevWord)) {
          const evenEarlier = documentText.slice(Math.max(0, wordStart - 10), wordStart).trim();
          if (!/\bby$/i.test(evenEarlier)) break;
        }

        // Stop at capitalized document terms
        if (/^[A-Z][a-z]+$/.test(prevWord) && !/^(By|In|Or|And|Cash|Bank|Transfer|Check|Card|Wire|Account)$/i.test(prevWord)) {
          break;
        }

        wordCount++;
      }
      start--;
    }
    while (start < slashIdx && /\s/.test(documentText[start])) start++;

    // Expand forwards
    const beforeText = documentText.slice(start, slashIdx).trim();
    const beforeWordCount = beforeText.split(/\s+/).length;

    let end = slashIdx + 1;
    let afterWordCount = 0;
    const maxAfterWords = Math.max(beforeWordCount + 1, 4);

    while (end < documentText.length && afterWordCount < maxAfterWords) {
      const nextChar = documentText[end];
      if (/[.,:;!?\n\r\t()[\]{}]/.test(nextChar)) break;

      const wordAtEnd = documentText.slice(end, end + 15).match(/^\s*(\w+)/)?.[1]?.toLowerCase() || '';
      if (/^(deposited|transferred|paid|sent|into|to|from|by|the|a|an|and|or)$/i.test(wordAtEnd) && afterWordCount > 0) {
        if (wordAtEnd !== 'in' || afterWordCount >= 2) break;
      }

      if (/\s/.test(documentText[end - 1]) && !/\s/.test(nextChar)) afterWordCount++;
      end++;
    }
    while (end > slashIdx + 1 && /\s/.test(documentText[end - 1])) end--;

    const fullMatch = documentText.slice(start, end);
    const options = fullMatch.split('/').map(o => o.trim()).filter(o => o.length > 0);

    // Validate: need 2+ options
    if (options.length >= 2) {
      // Check if this matches any skip pattern (conjunctions, compound words)
      if (shouldSkipPattern(fullMatch)) {
        console.log(`[autoDetect] Skipping non-option slash pattern: "${fullMatch}"`);
        slashIdx++;
        continue;
      }

      const maxLen = Math.max(...options.map(o => o.length));
      const minLen = Math.min(...options.map(o => o.length));
      const isBalanced = maxLen <= 40 && minLen >= 2 && maxLen / minLen < 10;

      // Skip dates
      const noSpaces = fullMatch.replace(/\s/g, '');
      const isDate = /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(noSpaces) ||
                    /^[XxDdMmYy]{1,4}\/[XxDdMmYy]{1,4}\/[XxDdMmYy]{2,4}$/.test(noSpaces);

      if (isBalanced && !isDate && !isRangeCovered(start, end)) {
        // Collect candidate for AI analysis instead of immediately adding
        const contextBefore = documentText.slice(Math.max(0, start - 50), start).trim();
        const contextAfter = documentText.slice(end, Math.min(documentText.length, end + 50)).trim();

        candidates.push({
          pattern: fullMatch,
          contextBefore,
          contextAfter,
          position: { start, end },
        });

        // Mark as covered to prevent overlapping matches
        markCovered(start, end);
        slashIdx = end;
        continue;
      }
    }
    slashIdx++;
  }

  return candidates;
}

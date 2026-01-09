/**
 * Document Service - DOCX parsing and generation
 *
 * Uses mammoth for parsing DOCX to text/HTML
 * Uses docx for generating DOCX files
 */

import mammoth from 'mammoth';
import JSZip from 'jszip';
import {
  Document,
  Paragraph,
  TextRun,
  Packer,
} from 'docx';
import type {
  ParsedParagraph,
  DocumentDiff,
  Annotation,
  AnnotationType,
} from '@/types/annotator';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface ParseResult {
  text: string;
  paragraphs: ParsedParagraph[];
  html?: string;
  /** Text regions with highlighting (yellow background, etc.) */
  highlightedRegions?: HighlightedRegion[];
}

export interface HighlightedRegion {
  text: string;
  /** Position in the extracted plain text */
  position: { start: number; end: number };
  /** Highlight color (yellow, green, etc.) or 'shading' for background color */
  highlightType: string;
}

export interface DiffResult {
  diffs: DocumentDiff[];
  annotations: ExtractedAnnotation[];
}

export interface ExtractedAnnotation {
  originalText: string;
  annotatedText: string;
  type: AnnotationType;
  position: { start: number; end: number };
  /**
   * Context keywords found immediately before/after the placeholder.
   * Used to distinguish same placeholder becoming different types.
   * E.g., "In [**]" → contextKeywords: ["In"] → City/Location
   *       "On [**]" → contextKeywords: ["On"] → Date
   *       "[**] EUR" → contextKeywords: ["EUR"] → Money
   */
  contextKeywords?: {
    before: string[];  // Keywords immediately before (e.g., ["In", "at", "dated"])
    after: string[];   // Keywords immediately after (e.g., ["EUR", "CZK", "%"])
  };
}

// ----------------------------------------------------------------------------
// Context Keyword Extraction
// ----------------------------------------------------------------------------

/**
 * Keywords that indicate specific annotation types when found near placeholders.
 * Used to distinguish same placeholder (e.g., [**]) becoming different types.
 */
const TYPE_INDICATOR_KEYWORDS = {
  // Date indicators (before the placeholder)
  dateBefore: ['on', 'dated', 'date', 'as of', 'effective', 'executed', 'signed', 'from', 'until', 'by', 'before', 'after', 'dne', 'dňa', 'ze dne'],
  // Date indicators (after the placeholder)
  dateAfter: ['day', 'month', 'year', 'roku', 'měsíce'],

  // Money indicators (before)
  moneyBefore: ['amount', 'sum', 'price', 'value', 'cost', 'fee', 'payment', 'částka', 'suma', 'cena', 've výši', 'of'],
  // Money indicators (after)
  moneyAfter: ['eur', 'czk', 'usd', 'gbp', 'kč', '€', '$', '£', 'percent', '%', 'korun'],

  // Location/City indicators (before)
  locationBefore: ['in', 'at', 'v', 've', 'na', 'city', 'place', 'město', 'místo', 'registered in', 'located in', 'with its seat in'],

  // Name/Party indicators (before)
  nameBefore: ['name', 'named', 'called', 'jméno', 'název', 'between', 'and', 'party', 'mr.', 'mrs.', 'ms.', 'dr.', 'ing.'],

  // Link/Reference indicators (typically repeated occurrences)
  linkIndicators: ['hereinafter', 'above', 'aforementioned', 'said', 'the', 'dále jen', 'výše uvedený'],
};

/**
 * Extract context keywords from text immediately surrounding a placeholder.
 * These keywords help distinguish what type an identical placeholder should become.
 */
function extractContextKeywords(
  textBefore: string,
  textAfter: string
): { before: string[]; after: string[] } {
  const beforeKeywords: string[] = [];
  const afterKeywords: string[] = [];

  // Get last 50 chars before and first 50 chars after (lowercased for matching)
  const nearBefore = textBefore.slice(-50).toLowerCase();
  const nearAfter = textAfter.slice(0, 50).toLowerCase();

  // Check all keyword categories
  const allBeforeKeywords = [
    ...TYPE_INDICATOR_KEYWORDS.dateBefore,
    ...TYPE_INDICATOR_KEYWORDS.moneyBefore,
    ...TYPE_INDICATOR_KEYWORDS.locationBefore,
    ...TYPE_INDICATOR_KEYWORDS.nameBefore,
    ...TYPE_INDICATOR_KEYWORDS.linkIndicators,
  ];

  const allAfterKeywords = [
    ...TYPE_INDICATOR_KEYWORDS.dateAfter,
    ...TYPE_INDICATOR_KEYWORDS.moneyAfter,
  ];

  // Find keywords in before context (look for word boundaries)
  for (const keyword of allBeforeKeywords) {
    const pattern = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (pattern.test(nearBefore)) {
      beforeKeywords.push(keyword);
    }
  }

  // Find keywords in after context
  for (const keyword of allAfterKeywords) {
    const pattern = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (pattern.test(nearAfter)) {
      afterKeywords.push(keyword);
    }
  }

  // Also extract the immediate word before (very useful for "In [**]", "On [**]")
  const immediateBeforeMatch = textBefore.match(/(\S+)\s*$/);
  if (immediateBeforeMatch) {
    const immediateBefore = immediateBeforeMatch[1].toLowerCase().replace(/[^a-záčďéěíňóřšťúůýž]/g, '');
    if (immediateBefore && immediateBefore.length >= 2 && !beforeKeywords.includes(immediateBefore)) {
      beforeKeywords.unshift(immediateBefore); // Add at start (most relevant)
    }
  }

  // Extract immediate word after
  const immediateAfterMatch = textAfter.match(/^\s*(\S+)/);
  if (immediateAfterMatch) {
    const immediateAfter = immediateAfterMatch[1].toLowerCase().replace(/[^a-záčďéěíňóřšťúůýž]/g, '');
    if (immediateAfter && immediateAfter.length >= 2 && !afterKeywords.includes(immediateAfter)) {
      afterKeywords.unshift(immediateAfter);
    }
  }

  return {
    before: beforeKeywords.slice(0, 5), // Limit to 5 most relevant
    after: afterKeywords.slice(0, 5),
  };
}

/**
 * Infer annotation type from context keywords.
 * Returns the most likely type based on surrounding keywords.
 */
export function inferTypeFromContextKeywords(
  keywords: { before: string[]; after: string[] }
): AnnotationType | null {
  const allBefore = keywords.before.map(k => k.toLowerCase());
  const allAfter = keywords.after.map(k => k.toLowerCase());

  // Check for Money indicators (highest priority - currency is unambiguous)
  if (allAfter.some(k => TYPE_INDICATOR_KEYWORDS.moneyAfter.includes(k))) {
    return 'Money';
  }
  if (allBefore.some(k => TYPE_INDICATOR_KEYWORDS.moneyBefore.includes(k))) {
    return 'Money';
  }

  // Check for Date indicators
  if (allBefore.some(k => TYPE_INDICATOR_KEYWORDS.dateBefore.includes(k))) {
    return 'Date';
  }
  if (allAfter.some(k => TYPE_INDICATOR_KEYWORDS.dateAfter.includes(k))) {
    return 'Date';
  }

  // Check for Link indicators
  if (allBefore.some(k => TYPE_INDICATOR_KEYWORDS.linkIndicators.includes(k))) {
    return 'Link';
  }

  // Check for Location indicators
  if (allBefore.some(k => TYPE_INDICATOR_KEYWORDS.locationBefore.includes(k))) {
    return 'TextInput'; // Location is a text input
  }

  return null; // No clear indication
}

// ----------------------------------------------------------------------------
// Parsing Functions
// ----------------------------------------------------------------------------

/**
 * Parse DOCX file to extract text and paragraph structure
 * Also extracts highlighted text regions for annotation targeting
 */
export async function parseDocx(file: File | Blob | Buffer): Promise<ParseResult> {
  let buffer: Buffer;
  let uint8Array: Uint8Array;

  if (file instanceof File || file instanceof Blob) {
    const arrayBuffer = await file.arrayBuffer();
    buffer = Buffer.from(arrayBuffer);
    uint8Array = new Uint8Array(arrayBuffer);
  } else {
    buffer = file;
    uint8Array = new Uint8Array(file);
  }

  // Extract text using mammoth (use buffer for Node.js compatibility)
  const textResult = await mammoth.extractRawText({
    buffer,
  });

  // Extract HTML for reference (includes some formatting info)
  const htmlResult = await mammoth.convertToHtml({
    buffer,
  });

  // Parse text into paragraphs
  const paragraphs = parseTextIntoParagraphs(textResult.value);

  // Extract highlighted regions directly from DOCX XML
  const highlightedRegions = await extractHighlightedRegions(uint8Array, textResult.value);

  return {
    text: textResult.value,
    paragraphs,
    html: htmlResult.value,
    highlightedRegions,
  };
}

/**
 * Extract text regions that have highlighting (yellow background, etc.)
 * Parses the DOCX XML directly to find <w:highlight> and <w:shd> elements
 */
async function extractHighlightedRegions(
  docxData: Uint8Array,
  plainText: string
): Promise<HighlightedRegion[]> {
  const regions: HighlightedRegion[] = [];

  try {
    // Load the DOCX as a ZIP
    const zip = await JSZip.loadAsync(docxData);

    // Get the main document XML
    const documentXml = await zip.file('word/document.xml')?.async('string');
    if (!documentXml) {
      return regions;
    }

    // Find all runs with highlighting
    // DOCX structure: <w:r><w:rPr><w:highlight w:val="yellow"/></w:rPr><w:t>text</w:t></w:r>
    // Or with shading: <w:r><w:rPr><w:shd w:fill="FFFF00"/></w:rPr><w:t>text</w:t></w:r>

    // Extract all paragraph content with formatting info
    const paragraphPattern = /<w:p[^>]*>([\s\S]*?)<\/w:p>/g;
    let paragraphMatch;

    // Track position in plain text (mammoth output)
    // We'll match text content to find positions
    let searchStartPos = 0;

    while ((paragraphMatch = paragraphPattern.exec(documentXml)) !== null) {
      const paragraphXml = paragraphMatch[1];

      // Find runs within this paragraph
      const runPattern = /<w:r(?:\s[^>]*)?>[\s\S]*?<\/w:r>/g;
      let runMatch;

      while ((runMatch = runPattern.exec(paragraphXml)) !== null) {
        const runXml = runMatch[0];

        // Check if this run has highlighting
        const hasHighlight = /<w:highlight[^>]*w:val=["']?(\w+)["']?/.test(runXml);
        const hasShading = /<w:shd[^>]*w:fill=["']?([A-Fa-f0-9]{6})["']?/.test(runXml);

        // Extract highlight color
        let highlightType = '';
        if (hasHighlight) {
          const colorMatch = runXml.match(/<w:highlight[^>]*w:val=["']?(\w+)["']?/);
          highlightType = colorMatch ? colorMatch[1] : 'highlight';
        } else if (hasShading) {
          const fillMatch = runXml.match(/<w:shd[^>]*w:fill=["']?([A-Fa-f0-9]{6})["']?/);
          if (fillMatch) {
            const fill = fillMatch[1].toUpperCase();
            // Check for yellow-ish colors (common for highlighting)
            if (fill === 'FFFF00' || fill === 'FFFF99' || fill === 'FFFFCC' ||
                fill === 'FFF000' || fill === 'FFEA00' || fill.startsWith('FFFF')) {
              highlightType = 'yellow';
            } else if (fill !== 'FFFFFF' && fill !== 'AUTO') {
              highlightType = `shading-${fill}`;
            }
          }
        }

        if (highlightType) {
          // Extract text from this run
          const textPattern = /<w:t[^>]*>([^<]*)<\/w:t>/g;
          let textMatch;
          let runText = '';

          while ((textMatch = textPattern.exec(runXml)) !== null) {
            runText += textMatch[1];
          }

          if (runText) {
            // Find this text in the plain text output
            // Use normalized comparison for special characters
            const normalizedRunText = normalizeForComparison(runText);
            const normalizedPlainText = normalizeForComparison(plainText);

            // Find ALL occurrences of this text in the plain text
            // Then pick the one closest to searchStartPos that hasn't been used
            let bestPos = -1;
            let searchFrom = 0;

            while (searchFrom < normalizedPlainText.length) {
              const pos = normalizedPlainText.indexOf(normalizedRunText, searchFrom);
              if (pos === -1) break;

              // CRITICAL: Check if this position OVERLAPS with any existing region
              // Not just start position, but the entire range [pos, pos+length)
              const newEnd = pos + runText.length;
              const overlapsExisting = regions.some((r) => {
                // Check for any overlap between [pos, newEnd) and [r.start, r.end)
                return pos < r.position.end && newEnd > r.position.start;
              });

              if (!overlapsExisting) {
                // Prefer position closest to searchStartPos (forward direction)
                if (pos >= searchStartPos) {
                  bestPos = pos;
                  break;
                } else if (bestPos === -1) {
                  bestPos = pos;
                }
              }
              searchFrom = pos + 1;
            }

            if (bestPos !== -1) {
              // Verify the match - text at position should match
              const actualText = plainText.slice(bestPos, bestPos + runText.length);

              regions.push({
                text: actualText,
                position: { start: bestPos, end: bestPos + runText.length },
                highlightType,
              });

              // Update search position
              searchStartPos = bestPos + runText.length;
              console.log(`[parseDocx] Found highlighted "${runText}" at position ${bestPos}`);
            } else {
              console.log(`[parseDocx] Could not find position for highlighted "${runText}"`);
            }
          }
        }
      }
    }

    // Merge adjacent highlighted regions with same text
    // Pass plainText to extend partial-word highlights to full words
    const mergedRegions = mergeAdjacentRegions(regions, plainText);

    console.log(`[parseDocx] Found ${mergedRegions.length} highlighted regions`);

    return mergedRegions;
  } catch (error) {
    console.error('[parseDocx] Error extracting highlighted regions:', error);
    return regions;
  }
}

/**
 * Merge adjacent highlighted regions that are part of the same text
 */
function mergeAdjacentRegions(regions: HighlightedRegion[], plainText?: string): HighlightedRegion[] {
  if (regions.length === 0) return regions;

  // Sort by position
  const sorted = [...regions].sort((a, b) => a.position.start - b.position.start);
  const merged: HighlightedRegion[] = [];

  let current = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];

    // If regions are adjacent or overlapping (within 2 chars), merge them
    if (next.position.start <= current.position.end + 2 &&
        next.highlightType === current.highlightType) {
      current = {
        text: current.text + next.text,
        position: {
          start: current.position.start,
          end: Math.max(current.position.end, next.position.end),
        },
        highlightType: current.highlightType,
      };
    } else {
      merged.push(current);
      current = next;
    }
  }

  merged.push(current);

  // Extend regions to word boundaries if we have the plain text
  // This fixes issues where DOCX splits "Series" into "Serie" + "s" across runs
  if (plainText) {
    return merged.map(region => {
      let { start, end } = region.position;
      const originalText = region.text;

      // Extend backward to start of word
      while (start > 0 && /\w/.test(plainText.charAt(start - 1)) && /\w/.test(plainText.charAt(start))) {
        start--;
      }

      // Extend forward to end of word
      while (end < plainText.length && /\w/.test(plainText.charAt(end - 1)) && /\w/.test(plainText.charAt(end))) {
        end++;
      }

      if (start !== region.position.start || end !== region.position.end) {
        const extendedText = plainText.slice(start, end);
        console.log(`[mergeRegions] Extended "${originalText}" to "${extendedText}"`);
        return {
          ...region,
          text: extendedText,
          position: { start, end },
        };
      }

      return region;
    });
  }

  return merged;
}

/**
 * Parse text string into paragraph structures
 */
function parseTextIntoParagraphs(text: string): ParsedParagraph[] {
  const lines = text.split('\n');
  const paragraphs: ParsedParagraph[] = [];

  lines.forEach((line, index) => {
    if (line.trim()) {
      paragraphs.push({
        index,
        text: line,
        runs: [{ text: line }],
      });
    }
  });

  return paragraphs;
}

// ----------------------------------------------------------------------------
// Diff Functions - Simple label-based extraction
// ----------------------------------------------------------------------------

/**
 * Compare original and annotated documents to extract patterns.
 *
 * NEW APPROACH (simpler and more reliable):
 * 1. Find ALL annotations in annotated text
 * 2. For LABELED annotations like [Textinput: Creditor's name], the label IS the original text
 * 3. For UNLABELED annotations like [Date], find original by context matching
 *
 * This avoids the complexity of diff algorithms that group deletions incorrectly.
 */
export function diffDocuments(
  originalText: string,
  annotatedText: string
): DiffResult {
  const diffs: DocumentDiff[] = [];
  const annotations: ExtractedAnnotation[] = [];

  // Track seen patterns to prevent duplicates (key: originalText + annotatedText)
  const seenPatterns = new Set<string>();

  // Find ALL annotations in annotated text
  const annotationRegex = /\[([^\]]+)\]/g;
  let match;

  console.log(`[diffDocuments] Scanning annotated text for annotations...`);

  while ((match = annotationRegex.exec(annotatedText)) !== null) {
    const fullAnnotation = match[0]; // e.g., "[Textinput: Creditor's name]"
    const annotationStart = match.index;
    const annotationEnd = annotationStart + fullAnnotation.length;

    // Parse the annotation to get type and label
    const parsed = parseAnnotationContent(fullAnnotation);

    let originalValue: string | null = null;

    if (parsed.label) {
      // LABELED annotation - the label IS the original text
      // [Textinput: Creditor's name] → "Creditor's name"
      originalValue = parsed.label;
      console.log(`[diffDocuments] Labeled: "${originalValue}" → "${fullAnnotation}"`);
    } else {
      // UNLABELED annotation like [Date], [Textinput] - find original by context
      // This handles symbols like ● that were replaced with [Textinput]
      const contextBefore = annotatedText.slice(
        Math.max(0, annotationStart - 100),
        annotationStart
      );
      const contextAfter = annotatedText.slice(
        annotationEnd,
        annotationEnd + 100
      );

      originalValue = findOriginalByContextNew(
        originalText,
        contextBefore,
        contextAfter,
        parsed.type
      );

      if (originalValue) {
        console.log(`[diffDocuments] Context-found: "${originalValue}" → "${fullAnnotation}"`);
      } else {
        console.log(`[diffDocuments] SKIP unlabeled: "${fullAnnotation}" (could not find original)`);
        continue;
      }
    }

    // Create unique key for deduplication
    const patternKey = `${originalValue}|||${fullAnnotation}`;
    if (seenPatterns.has(patternKey)) {
      console.log(`[diffDocuments] SKIP duplicate: "${originalValue}" → "${fullAnnotation}"`);
      continue;
    }
    seenPatterns.add(patternKey);

    // Extract context keywords to help distinguish same placeholder → different types
    const contextBefore = annotatedText.slice(
      Math.max(0, annotationStart - 100),
      annotationStart
    );
    const contextAfter = annotatedText.slice(
      annotationEnd,
      annotationEnd + 100
    );
    const contextKeywords = extractContextKeywords(contextBefore, contextAfter);

    console.log(`[diffDocuments] Pattern: "${originalValue}" → "${fullAnnotation}" (context: before=[${contextKeywords.before.join(', ')}], after=[${contextKeywords.after.join(', ')}])`);

    annotations.push({
      originalText: originalValue,
      annotatedText: fullAnnotation,
      type: parsed.type,
      position: { start: annotationStart, end: annotationEnd },
      contextKeywords,
    });

    diffs.push({
      type: 'added',
      originalText: originalValue,
      newText: fullAnnotation,
      position: { start: annotationStart, end: annotationEnd },
    });
  }

  console.log(`[diffDocuments] Extracted ${annotations.length} unique patterns (after dedup)`);

  return { diffs, annotations };
}

/**
 * Find original text for unlabeled annotations like [Date], [Money], [Link], [Calculation]
 * by looking at context around the annotation position.
 *
 * This is the KEY function for extracting patterns from unlabeled annotations.
 * It works by finding the same context in both documents and extracting what's between.
 */
function findOriginalByContextNew(
  originalText: string,
  contextBefore: string,
  contextAfter: string,
  annotationType: AnnotationType
): string | null {
  // Clean context (remove any annotations that might be in the context)
  const cleanBefore = contextBefore.replace(/\[[^\]]+\]/g, '').trim();
  const cleanAfter = contextAfter.replace(/\[[^\]]+\]/g, '').trim();

  // Try progressively shorter context lengths for more flexible matching
  const contextLengths = [40, 30, 20, 15, 10, 5];

  for (const len of contextLengths) {
    const shortBefore = cleanBefore.slice(-len);
    const shortAfter = cleanAfter.slice(0, len);

    if (shortBefore.length >= 3 && shortAfter.length >= 3) {
      try {
        // Try to find context and extract what's between (up to 200 chars for longer content)
        const pattern = new RegExp(
          escapeRegex(shortBefore) + '([\\s\\S]{1,200}?)' + escapeRegex(shortAfter)
        );
        const match = originalText.match(pattern);
        if (match && match[1]) {
          const extracted = match[1].trim();
          // Skip if empty or if it's a REAL annotation (not a placeholder like [**])
          if (extracted && extracted.length > 0 && !isRealAnnotation(extracted)) {
            console.log(`[findOriginalByContext] Found "${extracted}" using ${len}-char context`);
            return extracted;
          }
        }
      } catch {
        // Regex failed, try next length
      }
    }
  }

  // Fallback: Try with just before context (for end-of-line annotations)
  if (cleanBefore.length >= 5) {
    const shortBefore = cleanBefore.slice(-20);
    // Look for text after the context that ends at newline or punctuation
    try {
      const pattern = new RegExp(
        escapeRegex(shortBefore) + '([^\\n\\[]{1,100}?)(?:\\n|$|\\[)'
      );
      const match = originalText.match(pattern);
      if (match && match[1]) {
        const extracted = match[1].trim();
        if (extracted && extracted.length > 0) {
          console.log(`[findOriginalByContext] Found "${extracted}" using before-only context`);
          return extracted;
        }
      }
    } catch {
      // Regex failed
    }
  }

  // Type-specific pattern matching as last resort
  const nearContext = findNearContextInOriginal(originalText, cleanBefore.slice(-30), cleanAfter.slice(0, 30));

  if (nearContext) {
    // Date patterns: DD.MM.YYYY, XX.XX.XXXX, etc.
    if (annotationType === 'Date') {
      const datePattern = /\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4}|[XxDd]{1,2}[.\/-][XxMm]{1,2}[.\/-][XxYy]{2,4}/;
      const dateMatch = nearContext.match(datePattern);
      if (dateMatch) {
        console.log(`[findOriginalByContext] Found date "${dateMatch[0]}" by pattern`);
        return dateMatch[0];
      }
    }

    // Money patterns: XXX, 0,00, amounts with currency
    if (annotationType === 'Money') {
      const moneyPattern = /\d+[,.\s]?\d*\s*(EUR|CZK|USD|GBP|Kč)?|XXX\s*(EUR|CZK|USD)?/i;
      const moneyMatch = nearContext.match(moneyPattern);
      if (moneyMatch) {
        console.log(`[findOriginalByContext] Found money "${moneyMatch[0]}" by pattern`);
        return moneyMatch[0];
      }
    }

    // Calculation patterns: formulas, expressions with operators
    if (annotationType === 'Calculation') {
      // Match: amount*percentage, X+Y, price-discount, etc.
      const calcPattern = /[a-zA-Z_]\w*\s*[+\-*\/×÷%]\s*[a-zA-Z_]\w*(?:\s*[+\-*\/×÷%]\s*[a-zA-Z_]\w*)*/;
      const calcMatch = nearContext.match(calcPattern);
      if (calcMatch) {
        console.log(`[findOriginalByContext] Found calculation "${calcMatch[0]}" by pattern`);
        return calcMatch[0];
      }
    }

    // Link patterns: typically party names, references (look for capitalized words/phrases)
    if (annotationType === 'Link') {
      // Match capitalized phrases that could be party names or references
      // e.g., "Creditor's name", "Debtor's Name", "the Buyer"
      const linkPattern = /[A-Z][a-zA-Z']+(?:\s+[A-Za-z']+){0,3}/;
      const linkMatch = nearContext.match(linkPattern);
      if (linkMatch && linkMatch[0].length > 2) {
        console.log(`[findOriginalByContext] Found link "${linkMatch[0]}" by pattern`);
        return linkMatch[0];
      }
    }

    // TextInput fallback: any non-empty text that's not too long
    if (annotationType === 'TextInput' || annotationType === 'Text') {
      // Look for placeholder-like text: underscores, dots, symbols
      const placeholderPattern = /[●○•◦▪▫■□]+|_{3,}|\.{3,}|[_\-]{2,}/;
      const placeholderMatch = nearContext.match(placeholderPattern);
      if (placeholderMatch) {
        console.log(`[findOriginalByContext] Found placeholder "${placeholderMatch[0]}" by pattern`);
        return placeholderMatch[0];
      }
    }
  }

  console.log(`[findOriginalByContext] Could not find original for ${annotationType}`);
  return null;
}

/**
 * Find the area in original text that matches context snippets
 */
function findNearContextInOriginal(
  originalText: string,
  contextBefore: string,
  contextAfter: string
): string | null {
  // Find where contextBefore appears in original
  const beforeIdx = originalText.indexOf(contextBefore);
  if (beforeIdx === -1) return null;

  // Look for contextAfter after that point
  const searchStart = beforeIdx + contextBefore.length;
  const afterIdx = originalText.indexOf(contextAfter, searchStart);

  if (afterIdx !== -1 && afterIdx - searchStart < 200) {
    // Return the text between
    return originalText.slice(searchStart, afterIdx);
  }

  // Return some text after contextBefore
  return originalText.slice(searchStart, searchStart + 100);
}

/**
 * Check if a string is a REAL annotation (like [Textinput], [Date], [Link])
 * vs a PLACEHOLDER marker (like [**], [___], [blank], [●], etc.)
 *
 * Placeholders should be extracted as original text, not skipped.
 */
function isRealAnnotation(text: string): boolean {
  // Must match [xxx] format
  if (!/^\[.+\]$/.test(text)) return false;

  const content = text.slice(1, -1).trim().toLowerCase();

  // Known annotation types (case-insensitive)
  const annotationTypes = [
    'textinput', 'text', 'date', 'money', 'link', 'select', 'calculation',
  ];

  // Check if it's a known type (with or without label)
  for (const type of annotationTypes) {
    if (content === type || content.startsWith(type + ':')) {
      return true;
    }
  }

  // If it contains only special characters, symbols, or is very short,
  // it's probably a placeholder, not an annotation
  // Examples: [**], [___], [●], [blank], [X], [#], [?]
  if (/^[\*_\-●○•\#\?\.\s\[\]]+$/.test(content)) {
    return false; // This is a placeholder
  }

  // If it's just a single character or two, it's likely a placeholder
  if (content.length <= 2) {
    return false;
  }

  // Otherwise, assume it could be an annotation with a custom label
  return true;
}

/**
 * Parse annotation content to determine type and label.
 * Accepts ANY [xxx] format, then categorizes appropriately.
 * Case-insensitive type matching for robustness.
 */
function parseAnnotationContent(annotation: string): { type: AnnotationType; label: string | null } {
  const content = annotation.slice(1, -1).trim();
  const contentLower = content.toLowerCase();

  // Known types (case-insensitive match for unlabeled types)
  if (contentLower === 'date') return { type: 'Date', label: null };
  if (contentLower === 'money') return { type: 'Money', label: null };
  if (contentLower === 'link') return { type: 'Link', label: null };
  if (contentLower === 'calculation') return { type: 'Calculation', label: null };
  if (contentLower === 'textinput') return { type: 'TextInput', label: null };
  if (contentLower === 'text') return { type: 'Text', label: null };

  // Labeled types - handle case variations (TextInput:, Textinput:, textinput:)
  if (contentLower.startsWith('textinput:')) {
    const colonIdx = content.indexOf(':');
    return { type: 'TextInput', label: content.slice(colonIdx + 1).trim() };
  }
  if (contentLower.startsWith('select:')) {
    const colonIdx = content.indexOf(':');
    return { type: 'Select', label: content.slice(colonIdx + 1).trim() };
  }
  if (contentLower.startsWith('text:')) {
    const colonIdx = content.indexOf(':');
    return { type: 'Text', label: content.slice(colonIdx + 1).trim() };
  }

  // Default: treat unknown as TextInput with the content as label
  // BUT skip if the content looks like a type name (prevents [Textinput] → label "Textinput")
  const knownTypeNames = ['textinput', 'text', 'date', 'money', 'link', 'select', 'calculation'];
  if (knownTypeNames.includes(contentLower)) {
    // This is a type name without colon, treat as unlabeled
    return { type: 'TextInput', label: null };
  }

  return { type: 'TextInput', label: content };
}

/**
 * Detect the annotation type from the annotation string
 */
export function detectAnnotationType(annotation: string): AnnotationType {
  if (annotation.startsWith('[Textinput')) return 'TextInput';
  if (annotation.startsWith('[Select:')) return 'Select';
  if (annotation === '[Date]') return 'Date';
  if (annotation === '[Link]') return 'Link';
  if (annotation === '[Money]') return 'Money';
  if (annotation === '[Calculation]') return 'Calculation';
  return 'Text';
}

/**
 * Extract label from annotation
 */
export function extractLabel(annotation: string): string | null {
  const textInputMatch = annotation.match(/\[Textinput:\s*([^\]]+)\]/);
  if (textInputMatch) return textInputMatch[1].trim();

  const selectMatch = annotation.match(/\[Select:\s*([^\]]+)\]/);
  if (selectMatch) {
    const options = selectMatch[1].split('/');
    return options[0]?.trim() || null;
  }

  return null;
}

/**
 * Extract Select options from annotation
 */
export function extractSelectOptions(annotation: string): string[] {
  const match = annotation.match(/\[Select:\s*([^\]]+)\]/);
  if (match) {
    return match[1].split('/').map((opt) => opt.trim());
  }
  return [];
}

// ----------------------------------------------------------------------------
// Generation Functions
// ----------------------------------------------------------------------------

/**
 * Generate an annotated DOCX file from original text and annotations
 */
export async function generateAnnotatedDocx(
  originalText: string,
  annotations: Annotation[]
): Promise<Blob> {
  // Sort annotations by position (reverse order for replacement)
  const sortedAnnotations = [...annotations].sort(
    (a, b) => b.position.start - a.position.start
  );

  // Apply annotations to text
  let annotatedText = originalText;
  for (const annotation of sortedAnnotations) {
    const before = annotatedText.substring(0, annotation.position.start);
    const after = annotatedText.substring(annotation.position.end);
    annotatedText = before + annotation.annotatedText + after;
  }

  // Split into paragraphs
  const paragraphTexts = annotatedText.split('\n').filter((p) => p.trim());

  // Create document
  const doc = new Document({
    sections: [
      {
        children: paragraphTexts.map((text) => createParagraphWithAnnotations(text)),
      },
    ],
  });

  // Generate blob
  const buffer = await Packer.toBlob(doc);
  return buffer;
}

/**
 * Generate annotated DOCX by modifying original document in-place
 * This preserves all original formatting, styles, headers, footers, etc.
 *
 * @param originalFile - The original DOCX file
 * @param replacements - Array of {original, replacement} text pairs
 * @returns Modified DOCX as Blob
 */
export async function generateAnnotatedDocxPreservingFormat(
  originalFile: File | Blob | Buffer,
  replacements: Array<{ original: string; replacement: string }>,
  options: { removeHighlighting?: boolean } = { removeHighlighting: true }
): Promise<Blob> {
  // Convert to Uint8Array for JSZip (works with all input types)
  let data: Uint8Array;
  if (Buffer.isBuffer(originalFile)) {
    data = new Uint8Array(originalFile);
  } else {
    // File or Blob
    const blob = originalFile as Blob;
    const arrayBuffer = await blob.arrayBuffer();
    data = new Uint8Array(arrayBuffer);
  }

  // Load the DOCX as a ZIP
  const zip = await JSZip.loadAsync(data);

  // Get the main document XML
  const documentXml = await zip.file('word/document.xml')?.async('string');
  if (!documentXml) {
    throw new Error('Invalid DOCX: word/document.xml not found');
  }

  // Sort replacements by original text length (longest first)
  // This prevents shorter matches from consuming parts of longer matches
  const sortedReplacements = [...replacements].sort(
    (a, b) => b.original.length - a.original.length
  );

  // Group replacements by original text, preserving order
  // This is crucial: first occurrence gets type annotation, subsequent get [Link]
  const replacementsByOriginal = new Map<string, Array<{ original: string; replacement: string }>>();
  for (const r of sortedReplacements) {
    // Skip if original is already a full annotation (CASE-SENSITIVE!)
    // [Date] = annotation, [date] = placeholder that should be replaced
    if (/^\[(Textinput|Date|Money|Select|Link|Number|Checkbox|Calculation)/.test(r.original)) {
      continue;
    }
    if (!replacementsByOriginal.has(r.original)) {
      replacementsByOriginal.set(r.original, []);
    }
    replacementsByOriginal.get(r.original)!.push(r);
  }

  // Build a set of all originals for quick lookup
  const allOriginals = new Set(replacementsByOriginal.keys());

  // Track how many times each original has been replaced
  const replacementCounts = new Map<string, number>();

  // Apply replacements to the XML content
  let modifiedXml = documentXml;

  for (const [original, replacementsForOriginal] of replacementsByOriginal) {
    // NOTE: Standalone X patterns (like "X" after "Season") should NOT be skipped
    // even if bracketed [X] exists - they are DIFFERENT patterns in DIFFERENT locations
    // The sequential replacement will handle each occurrence correctly

    // CRITICAL: For short/ambiguous patterns, ONLY replace in highlighted regions
    const isAmbiguousPattern =
      original.length <= 2 ||
      /^\d+$/.test(original) ||
      /^[A-Za-z]$/.test(original) ||
      /^[A-Za-z]{1,6}$/.test(original.trim());

    // Structural placeholders are always safe to replace
    const isStructuralPlaceholder =
      /^_+/.test(original) ||                  // Underscores
      /^\[.+\]$/.test(original) ||              // Bracketed: [X], [insert name]
      /^\{.+\}$/.test(original) ||              // Curly braces: {Name}
      /^<.+>$/.test(original) ||                // Angle brackets: <date>
      /^X{2,}[.\/-]/.test(original) ||          // Date patterns: XX.XX.XXXX
      /^X$/i.test(original);                    // Single X - almost always a placeholder

    const onlyHighlighted = isAmbiguousPattern && !isStructuralPlaceholder;

    // Apply each replacement for this original one at a time
    // First replacement goes to first occurrence, second to second, etc.
    for (let i = 0; i < replacementsForOriginal.length; i++) {
      const { replacement } = replacementsForOriginal[i];
      const escapedReplacement = escapeXml(replacement);

      if (onlyHighlighted) {
        console.log(`[Generate] Ambiguous "${original}" occurrence ${i + 1} -> "${replacement}" (highlighted only)`);
      } else {
        console.log(`[Generate] Pattern "${original}" occurrence ${i + 1} -> "${replacement}"`);
      }

      // Replace only ONE occurrence at a time
      const result = replaceTextInDocxXmlSafeOnce(modifiedXml, original, escapedReplacement, onlyHighlighted);
      if (result !== modifiedXml) {
        modifiedXml = result;
        replacementCounts.set(original, (replacementCounts.get(original) || 0) + 1);
      } else {
        // No more occurrences to replace
        console.log(`[Generate] No more occurrences of "${original}" to replace`);
        break;
      }
    }
  }

  // Remove all text highlighting (yellow background, etc.) if requested
  if (options.removeHighlighting !== false) {
    // Remove <w:highlight .../> elements (self-closing) - handles all highlight colors
    modifiedXml = modifiedXml.replace(/<w:highlight[^>]*\/>/gi, '');
    // Remove <w:highlight ...>...</w:highlight> elements (if any)
    modifiedXml = modifiedXml.replace(/<w:highlight[^>]*>.*?<\/w:highlight>/gi, '');
    // Also remove shading that might be used for yellow highlighting
    // <w:shd w:val="clear" w:color="auto" w:fill="FFFF00"/> (yellow fill)
    modifiedXml = modifiedXml.replace(/<w:shd[^>]*w:fill=["']?FFFF00["']?[^>]*\/>/gi, '');
    modifiedXml = modifiedXml.replace(/<w:shd[^>]*w:fill=["']?ffff00["']?[^>]*\/>/gi, '');
    console.log('[Generate] Removed text highlighting from document');
  }

  // Put the modified document.xml back
  zip.file('word/document.xml', modifiedXml);

  // Generate the new DOCX
  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  });

  return blob;
}

/**
 * Escape special regex characters in a string
 */
function escapeRegexChars(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Normalize Unicode characters for comparison
 * Converts fancy quotes, dashes, spaces to their ASCII equivalents
 * This is crucial for matching DOCX content which often uses curly quotes
 */
function normalizeForComparison(text: string): string {
  return text
    // Normalize curly quotes to straight quotes
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")  // ' ' ‚ ‛ → '
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')  // " " „ ‟ → "
    // Normalize dashes
    .replace(/[\u2013\u2014\u2015]/g, '-')        // – — ― → -
    // Normalize spaces
    .replace(/[\u00A0\u2007\u202F]/g, ' ')        // non-breaking spaces → space
    // Normalize other common characters
    .replace(/\u2026/g, '...')                     // … → ...
    .replace(/[\u2010\u2011\u2012]/g, '-');       // various hyphens → -
}

/**
 * Check if a run element has highlighting (yellow background or highlight tag)
 */
function runHasHighlighting(runXml: string): boolean {
  // Check for <w:highlight> tag
  if (/<w:highlight[^>]*>/i.test(runXml)) {
    return true;
  }
  // Check for yellow shading (w:fill="FFFF00" or similar yellow shades)
  if (/<w:shd[^>]*w:fill=["']?(?:FFFF00|ffff00|FFFF99|ffff99|FFF200|fff200)["']?/i.test(runXml)) {
    return true;
  }
  return false;
}

/**
 * Check if text is a structural placeholder (should always be replaced regardless of highlighting)
 * ONLY patterns with clear semantic meaning - NOT plain underscores (which could be separators)
 * Underscores require highlighting or context to be considered fillable
 */
function isStructuralPlaceholderText(text: string): boolean {
  const trimmed = text.trim();

  // NOTE: Plain underscores (___) are NOT auto-replaced - they could be separators
  // They need highlighting or context like "Name: ______"

  // Angle bracket patterns: <<Borrower>>, <<Name>>, etc. - common template markers
  if (/^<<[^>]+>>$/.test(trimmed)) return true;

  // Square bracket X patterns: [X], [XX], [XXX] - common placeholders
  if (/^\[X+\]$/i.test(trimmed)) return true;

  // Curly brace fields with content: {Name}, {Date}, etc.
  if (/^\{[A-Za-z][^}]*\}$/.test(trimmed)) return true;

  // Instruction patterns: [insert name], <enter date>, etc.
  if (/^\[(?:insert|enter|fill|type|add)\s+[^\]]+\]$/i.test(trimmed)) return true;
  if (/^<(?:insert|enter|fill|type|add)\s+[^>]+>$/i.test(trimmed)) return true;

  // X patterns for dates: XX.XX.XXXX, XX/XX/XXXX (but NOT just XXX which could be anything)
  if (/^X{2,4}[.\/-]X{2,4}[.\/-]X{2,4}$/i.test(trimmed)) return true;

  return false;
}

/**
 * Replace ONLY ONE occurrence of text in DOCX XML
 * Used for sequential replacement where first occurrence gets one replacement,
 * second occurrence gets another (e.g., first is [Select], second is [Link])
 */
function replaceTextInDocxXmlSafeOnce(
  xml: string,
  searchText: string,
  replacement: string,
  onlyHighlighted: boolean = true
): string {
  const normalizedSearch = normalizeForComparison(searchText);

  // Strategy 1: Find and replace in individual runs
  const runPattern = /<w:r[^>]*>[\s\S]*?<\/w:r>/g;
  let foundAndReplaced = false;

  const modified = xml.replace(runPattern, (runMatch) => {
    if (foundAndReplaced) return runMatch; // Already replaced one, skip rest

    const textMatch = runMatch.match(/<w:t[^>]*>([^<]*)<\/w:t>/);
    if (!textMatch) return runMatch;

    const textContent = textMatch[1];
    const normalizedContent = normalizeForComparison(textContent);
    const matchIndex = normalizedContent.indexOf(normalizedSearch);

    if (matchIndex === -1) return runMatch;

    // CRITICAL: Skip if the ACTUAL text is already a proper annotation (CASE-SENSITIVE!)
    // [Date] = annotation (skip), [date] = placeholder (replace)
    const actualMatchedText = textContent.substring(matchIndex, matchIndex + searchText.length);
    if (/^\[(Textinput|Date|Money|Select|Link|Calculation|Number|Checkbox)/.test(actualMatchedText)) {
      return runMatch; // Already a proper annotation, skip
    }

    // Check highlighting if required
    if (onlyHighlighted && !runHasHighlighting(runMatch) && !isStructuralPlaceholderText(searchText)) {
      return runMatch;
    }

    // Check if inside existing brackets
    const matchEnd = matchIndex + normalizedSearch.length;
    const bracketOpenBefore = normalizedContent.lastIndexOf('[', matchIndex);
    const bracketCloseBefore = normalizedContent.lastIndexOf(']', matchIndex);
    const bracketOpenAfter = normalizedContent.indexOf('[', matchEnd);
    const bracketCloseAfter = normalizedContent.indexOf(']', matchEnd);

    if (bracketOpenBefore !== -1 &&
        (bracketCloseBefore === -1 || bracketCloseBefore < bracketOpenBefore) &&
        bracketCloseAfter !== -1 &&
        (bracketOpenAfter === -1 || bracketCloseAfter < bracketOpenAfter)) {
      return runMatch; // Inside brackets, skip
    }

    foundAndReplaced = true;

    // Map normalized position back to original
    let originalIndex = 0;
    let normalizedIndex = 0;
    while (normalizedIndex < matchIndex && originalIndex < textContent.length) {
      const origChar = textContent[originalIndex];
      const normChar = normalizeForComparison(origChar);
      normalizedIndex += normChar.length;
      originalIndex++;
    }

    let originalEndIndex = originalIndex;
    let normalizedEndIndex = normalizedIndex;
    while (normalizedEndIndex < matchIndex + normalizedSearch.length && originalEndIndex < textContent.length) {
      const origChar = textContent[originalEndIndex];
      const normChar = normalizeForComparison(origChar);
      normalizedEndIndex += normChar.length;
      originalEndIndex++;
    }

    const before = textContent.substring(0, originalIndex);
    const after = textContent.substring(originalEndIndex);
    const newTextContent = before + replacement + after;

    let newRun = runMatch.replace(
      /<w:t([^>]*)>[^<]*<\/w:t>/,
      `<w:t$1>${escapeXml(newTextContent)}</w:t>`
    );
    return stripHighlighting(newRun);
  });

  if (foundAndReplaced) {
    return modified;
  }

  // Strategy 2: Try cross-run replacement for ONE occurrence
  return replaceAcrossRunsOnce(xml, searchText, replacement, onlyHighlighted);
}

/**
 * Replace ONE occurrence across runs
 */
function replaceAcrossRunsOnce(
  xml: string,
  searchText: string,
  replacement: string,
  onlyHighlighted: boolean = true
): string {
  const paragraphPattern = /<w:p[^>]*>[\s\S]*?<\/w:p>/g;
  const normalizedSearch = normalizeForComparison(searchText);
  let foundAndReplaced = false;

  const result = xml.replace(paragraphPattern, (paragraph) => {
    if (foundAndReplaced) return paragraph;

    const runPattern = /<w:r[^>]*>[\s\S]*?<\/w:r>/g;
    const runs: Array<{
      fullMatch: string;
      text: string;
      index: number;
      isHighlighted: boolean;
    }> = [];

    let runMatch;
    while ((runMatch = runPattern.exec(paragraph)) !== null) {
      const runXml = runMatch[0];
      const textMatch = runXml.match(/<w:t[^>]*>([^<]*)<\/w:t>/);
      if (textMatch) {
        runs.push({
          fullMatch: runXml,
          text: textMatch[1],
          index: runMatch.index,
          isHighlighted: runHasHighlighting(runXml)
        });
      }
    }

    if (runs.length === 0) return paragraph;

    const combinedText = runs.map(r => r.text).join('');
    const normalizedCombined = normalizeForComparison(combinedText);
    const searchIndex = normalizedCombined.indexOf(normalizedSearch);

    if (searchIndex === -1) return paragraph;

    // CRITICAL: Skip if the ACTUAL text is already a proper annotation (CASE-SENSITIVE!)
    // [Date] = annotation (skip), [date] = placeholder (replace)
    const actualMatchedText = combinedText.substring(searchIndex, searchIndex + searchText.length);
    if (/^\[(Textinput|Date|Money|Select|Link|Calculation|Number|Checkbox)/.test(actualMatchedText)) {
      return paragraph; // Already a proper annotation, skip
    }

    // Check highlighting
    if (onlyHighlighted) {
      let charPos = 0;
      let anyHighlighted = false;
      for (const run of runs) {
        const runStart = charPos;
        const runEnd = charPos + run.text.length;
        charPos = runEnd;
        if (runEnd > searchIndex && runStart < searchIndex + normalizedSearch.length) {
          if (run.isHighlighted) {
            anyHighlighted = true;
            break;
          }
        }
      }
      if (!anyHighlighted && !isStructuralPlaceholderText(searchText)) {
        return paragraph;
      }
    }

    // Check if inside brackets
    const matchEnd = searchIndex + normalizedSearch.length;
    const bracketOpenBefore = normalizedCombined.lastIndexOf('[', searchIndex);
    const bracketCloseBefore = normalizedCombined.lastIndexOf(']', searchIndex);
    const bracketOpenAfter = normalizedCombined.indexOf('[', matchEnd);
    const bracketCloseAfter = normalizedCombined.indexOf(']', matchEnd);

    if (bracketOpenBefore !== -1 &&
        (bracketCloseBefore === -1 || bracketCloseBefore < bracketOpenBefore) &&
        bracketCloseAfter !== -1 &&
        (bracketOpenAfter === -1 || bracketCloseAfter < bracketOpenAfter)) {
      return paragraph;
    }

    foundAndReplaced = true;

    // Simple approach: put replacement in first run that contains part of the match
    let charOffset = 0;
    let modifiedParagraph = paragraph;

    for (const run of runs) {
      const runStart = charOffset;
      const runEnd = charOffset + run.text.length;
      charOffset = runEnd;

      if (runEnd > searchIndex && runStart < searchIndex + normalizedSearch.length) {
        // This run overlaps with the match
        const overlapStart = Math.max(0, searchIndex - runStart);
        const overlapEnd = Math.min(run.text.length, searchIndex + normalizedSearch.length - runStart);

        let newText: string;
        if (runStart <= searchIndex && runEnd >= searchIndex + normalizedSearch.length) {
          // Entire match is in this run
          newText = run.text.substring(0, overlapStart) + replacement + run.text.substring(overlapEnd);
        } else if (runStart <= searchIndex) {
          // Match starts in this run
          newText = run.text.substring(0, overlapStart) + replacement;
        } else if (runEnd >= searchIndex + normalizedSearch.length) {
          // Match ends in this run
          newText = run.text.substring(overlapEnd);
        } else {
          // Match spans through this run - clear it
          newText = '';
        }

        const newRun = run.fullMatch.replace(
          /<w:t([^>]*)>[^<]*<\/w:t>/,
          `<w:t$1>${escapeXml(newText)}</w:t>`
        );
        modifiedParagraph = modifiedParagraph.replace(run.fullMatch, stripHighlighting(newRun));
      }
    }

    return modifiedParagraph;
  });

  return result;
}

/**
 * Safe text replacement in DOCX XML
 * Handles both simple replacements and text split across runs
 * Uses normalized comparison to handle curly quotes and special characters
 * ONLY replaces text that is highlighted (has highlighting in parent run)
 */
function replaceTextInDocxXmlSafe(
  xml: string,
  searchText: string,
  replacement: string,
  onlyHighlighted: boolean = true
): string {
  // Normalize search text for comparison
  const normalizedSearch = normalizeForComparison(searchText);
  const escapedNormalizedSearch = escapeRegexChars(normalizedSearch);

  // Strategy 1: Replace within runs (<w:r>...</w:r>) to check highlighting context
  // Match entire run elements so we can check if they're highlighted
  const runPattern = /<w:r[^>]*>[\s\S]*?<\/w:r>/g;
  let modified = xml;
  let hasMatch = false;

  // Process each run element
  modified = xml.replace(runPattern, (runMatch) => {
    // Extract text content from this run
    const textMatch = runMatch.match(/<w:t[^>]*>([^<]*)<\/w:t>/);
    if (!textMatch) {
      return runMatch; // No text in this run
    }

    const textContent = textMatch[1];
    const normalizedContent = normalizeForComparison(textContent);
    const matchIndex = normalizedContent.indexOf(normalizedSearch);

    if (matchIndex === -1) {
      return runMatch; // No match, keep original
    }

    // CRITICAL: If onlyHighlighted is true, only replace in highlighted runs
    // EXCEPTION: Structural placeholders (underscores, X patterns) are always replaced
    if (onlyHighlighted && !runHasHighlighting(runMatch) && !isStructuralPlaceholderText(searchText)) {
      console.log(`[replaceTextInDocxXmlSafe] Skipping "${searchText}" - run is not highlighted`);
      return runMatch; // Not highlighted, skip
    }

    // Check if this match is inside existing annotation brackets
    const matchEnd = matchIndex + normalizedSearch.length;
    const bracketOpenBefore = normalizedContent.lastIndexOf('[', matchIndex);
    const bracketCloseBefore = normalizedContent.lastIndexOf(']', matchIndex);
    const bracketOpenAfter = normalizedContent.indexOf('[', matchEnd);
    const bracketCloseAfter = normalizedContent.indexOf(']', matchEnd);

    if (bracketOpenBefore !== -1 &&
        (bracketCloseBefore === -1 || bracketCloseBefore < bracketOpenBefore) &&
        bracketCloseAfter !== -1 &&
        (bracketOpenAfter === -1 || bracketCloseAfter < bracketOpenAfter)) {
      console.log(`[replaceTextInDocxXmlSafe] Skipping "${searchText}" - found inside brackets`);
      return runMatch;
    }

    hasMatch = true;

    // Map normalized position back to original
    let originalIndex = 0;
    let normalizedIndex = 0;
    while (normalizedIndex < matchIndex && originalIndex < textContent.length) {
      const origChar = textContent[originalIndex];
      const normChar = normalizeForComparison(origChar);
      normalizedIndex += normChar.length;
      originalIndex++;
    }

    let originalEndIndex = originalIndex;
    let normalizedEndIndex = normalizedIndex;
    while (normalizedEndIndex < matchIndex + normalizedSearch.length && originalEndIndex < textContent.length) {
      const origChar = textContent[originalEndIndex];
      const normChar = normalizeForComparison(origChar);
      normalizedEndIndex += normChar.length;
      originalEndIndex++;
    }

    // Build new text content
    const before = textContent.substring(0, originalIndex);
    const after = textContent.substring(originalEndIndex);
    const newTextContent = before + replacement + after;

    // Replace text in the run and strip highlighting
    let newRun = runMatch.replace(
      /<w:t([^>]*)>[^<]*<\/w:t>/,
      `<w:t$1>${escapeXml(newTextContent)}</w:t>`
    );
    return stripHighlighting(newRun);
  });

  // Strategy 2: Handle text split across runs (if simple replacement didn't find anything)
  if (!hasMatch) {
    modified = replaceAcrossRuns(xml, searchText, replacement, onlyHighlighted);
  }

  return modified;
}

/**
 * LEGACY: Direct text element replacement (kept for fallback)
 */
function replaceTextInDocxXmlSafeLegacy(
  xml: string,
  searchText: string,
  replacement: string
): string {
  const normalizedSearch = normalizeForComparison(searchText);
  const textPattern = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  let modified = xml;
  let hasMatch = false;

  modified = xml.replace(textPattern, (fullMatch, textContent) => {
    const normalizedContent = normalizeForComparison(textContent);
    const matchIndex = normalizedContent.indexOf(normalizedSearch);

    if (matchIndex === -1) {
      return fullMatch; // No match, keep original
    }

    // CRITICAL: Check if this match is INSIDE an existing annotation bracket
    // e.g., don't replace "Serie" inside "[Textinput: Series]"
    const matchEnd = matchIndex + normalizedSearch.length;

    // Find the nearest [ before the match and ] after the match
    const bracketOpenBefore = normalizedContent.lastIndexOf('[', matchIndex);
    const bracketCloseBefore = normalizedContent.lastIndexOf(']', matchIndex);
    const bracketOpenAfter = normalizedContent.indexOf('[', matchEnd);
    const bracketCloseAfter = normalizedContent.indexOf(']', matchEnd);

    // If there's a [ before us and no ] between [ and match, and there's a ] after us
    // Then we're inside brackets - skip this match
    if (bracketOpenBefore !== -1 &&
        (bracketCloseBefore === -1 || bracketCloseBefore < bracketOpenBefore) &&
        bracketCloseAfter !== -1 &&
        (bracketOpenAfter === -1 || bracketCloseAfter < bracketOpenAfter)) {
      // Match is inside existing brackets, skip it
      console.log(`[replaceTextInDocxXmlSafe] Skipping "${searchText}" - found inside brackets at position ${matchIndex}`);
      return fullMatch;
    }

    hasMatch = true;

    // Find the actual position in the original text
    // We need to map the normalized position back to original
    let originalIndex = 0;
    let normalizedIndex = 0;
    while (normalizedIndex < matchIndex && originalIndex < textContent.length) {
      const origChar = textContent[originalIndex];
      const normChar = normalizeForComparison(origChar);
      normalizedIndex += normChar.length;
      originalIndex++;
    }

    // Calculate the end position
    let originalEndIndex = originalIndex;
    let normalizedEndIndex = normalizedIndex;
    while (normalizedEndIndex < matchIndex + normalizedSearch.length && originalEndIndex < textContent.length) {
      const origChar = textContent[originalEndIndex];
      const normChar = normalizeForComparison(origChar);
      normalizedEndIndex += normChar.length;
      originalEndIndex++;
    }

    // Build the new content
    const before = textContent.substring(0, originalIndex);
    const after = textContent.substring(originalEndIndex);
    const newContent = before + replacement + after;

    // Replace text and strip any highlighting (yellow background)
    const newElem = fullMatch.replace(`>${textContent}<`, `>${escapeXml(newContent)}<`);
    return stripHighlighting(newElem);
  });

  // Strategy 2: Handle text split across runs (if simple replacement didn't find anything)
  if (!hasMatch) {
    modified = replaceAcrossRuns(xml, searchText, replacement);
  }

  return modified;
}

/**
 * Handle text replacement when the search text is split across multiple <w:t> elements
 * Preserves the XML structure better than the previous implementation
 * Uses normalized comparison for Unicode characters (curly quotes, etc.)
 * ONLY replaces text in highlighted runs when onlyHighlighted is true
 */
function replaceAcrossRuns(
  xml: string,
  searchText: string,
  replacement: string,
  onlyHighlighted: boolean = true
): string {
  const paragraphPattern = /<w:p[^>]*>[\s\S]*?<\/w:p>/g;
  const normalizedSearch = normalizeForComparison(searchText);

  return xml.replace(paragraphPattern, (paragraph) => {
    // Extract all runs with their text and highlighting status
    const runPattern = /<w:r[^>]*>[\s\S]*?<\/w:r>/g;
    const runs: Array<{
      fullMatch: string;
      text: string;
      index: number;
      isHighlighted: boolean;
    }> = [];

    let runMatch;
    while ((runMatch = runPattern.exec(paragraph)) !== null) {
      const runXml = runMatch[0];
      const textMatch = runXml.match(/<w:t[^>]*>([^<]*)<\/w:t>/);
      if (textMatch) {
        runs.push({
          fullMatch: runXml,
          text: textMatch[1],
          index: runMatch.index,
          isHighlighted: runHasHighlighting(runXml)
        });
      }
    }

    if (runs.length === 0) {
      return paragraph;
    }

    // Combine all text
    const combinedText = runs.map(r => r.text).join('');

    // Check if this paragraph contains our search text (using normalized comparison)
    const normalizedCombined = normalizeForComparison(combinedText);
    const normalizedSearchIndex = normalizedCombined.indexOf(normalizedSearch);
    if (normalizedSearchIndex === -1) {
      return paragraph;
    }

    // CRITICAL: If onlyHighlighted, check if any runs containing the match are highlighted
    if (onlyHighlighted) {
      // Find which character positions in combinedText are highlighted
      let charPos = 0;
      let anyHighlighted = false;
      for (const run of runs) {
        const runStart = charPos;
        const runEnd = charPos + run.text.length;
        charPos = runEnd;

        // Check if this run overlaps with the search match
        const matchStart = normalizedSearchIndex;
        const matchEndPos = normalizedSearchIndex + normalizedSearch.length;
        if (runEnd > matchStart && runStart < matchEndPos) {
          // This run overlaps with the match
          if (run.isHighlighted) {
            anyHighlighted = true;
            break;
          }
        }
      }

      // EXCEPTION: Structural placeholders (underscores, X patterns) are always replaced
      if (!anyHighlighted && !isStructuralPlaceholderText(searchText)) {
        console.log(`[replaceAcrossRuns] Skipping "${searchText}" - no highlighted runs in match`);
        return paragraph;
      }
    }

    // CRITICAL: Check if this match is INSIDE an existing annotation bracket
    // e.g., don't replace "Serie" inside "[Textinput: Series]"
    const matchEnd = normalizedSearchIndex + normalizedSearch.length;
    const bracketOpenBefore = normalizedCombined.lastIndexOf('[', normalizedSearchIndex);
    const bracketCloseBefore = normalizedCombined.lastIndexOf(']', normalizedSearchIndex);
    const bracketOpenAfter = normalizedCombined.indexOf('[', matchEnd);
    const bracketCloseAfter = normalizedCombined.indexOf(']', matchEnd);

    if (bracketOpenBefore !== -1 &&
        (bracketCloseBefore === -1 || bracketCloseBefore < bracketOpenBefore) &&
        bracketCloseAfter !== -1 &&
        (bracketOpenAfter === -1 || bracketCloseAfter < bracketOpenAfter)) {
      console.log(`[replaceAcrossRuns] Skipping "${searchText}" - found inside brackets`);
      return paragraph;
    }

    // Map normalized position back to original position
    let searchIndex = 0;
    let normalizedIndex = 0;
    while (normalizedIndex < normalizedSearchIndex && searchIndex < combinedText.length) {
      const origChar = combinedText[searchIndex];
      const normChar = normalizeForComparison(origChar);
      normalizedIndex += normChar.length;
      searchIndex++;
    }

    // Find end position in original text
    let searchEndIndex = searchIndex;
    let normalizedEndIndex = normalizedIndex;
    while (normalizedEndIndex < normalizedSearchIndex + normalizedSearch.length && searchEndIndex < combinedText.length) {
      const origChar = combinedText[searchEndIndex];
      const normChar = normalizeForComparison(origChar);
      normalizedEndIndex += normChar.length;
      searchEndIndex++;
    }

    // Calculate the new combined text after replacement
    const newCombinedText =
      combinedText.substring(0, searchIndex) +
      replacement +
      combinedText.substring(searchEndIndex);

    // Calculate actual search text length in original (for offset calculations below)
    const actualSearchLength = searchEndIndex - searchIndex;

    // Redistribute text back into the original elements
    // Key improvement: we preserve the element structure and just update text content
    let result = paragraph;
    let charOffset = 0;
    let newTextOffset = 0;

    for (let i = 0; i < runs.length; i++) {
      const elem = runs[i];
      const elemStart = charOffset;
      const elemEnd = charOffset + elem.text.length;
      charOffset = elemEnd;

      // Determine what portion of the new text should go in this element
      let newElemText = '';

      if (newTextOffset < newCombinedText.length) {
        // Calculate how much text this element should now hold
        // We try to maintain proportional distribution
        if (i === runs.length - 1) {
          // Last element gets all remaining text
          newElemText = newCombinedText.substring(newTextOffset);
        } else {
          // Non-last elements get their proportional share
          // But we need to be careful around the replacement boundary
          const originalShare = elem.text.length;
          const lengthDiff = replacement.length - actualSearchLength;

          // Use the calculated search positions (already mapped from normalized)
          const searchStart = searchIndex;
          const searchEnd = searchEndIndex;

          if (elemEnd <= searchStart || elemStart >= searchEnd) {
            // Element is completely outside the search range - keep same length
            newElemText = newCombinedText.substring(newTextOffset, newTextOffset + originalShare);
            newTextOffset += originalShare;
          } else if (elemStart <= searchStart && elemEnd >= searchEnd) {
            // Element completely contains the search text
            newElemText = newCombinedText.substring(newTextOffset, newTextOffset + originalShare + lengthDiff);
            newTextOffset += originalShare + lengthDiff;
          } else {
            // Element partially overlaps - distribute proportionally
            const overlapStart = Math.max(elemStart, searchStart);
            const overlapEnd = Math.min(elemEnd, searchEnd);
            const overlapLength = overlapEnd - overlapStart;
            const adjustedLength = originalShare + (lengthDiff * overlapLength / actualSearchLength);
            newElemText = newCombinedText.substring(newTextOffset, newTextOffset + Math.round(adjustedLength));
            newTextOffset += Math.round(adjustedLength);
          }
        }
      }

      // Replace in the paragraph
      // Be careful to escape XML entities
      const escapedNewText = escapeXml(newElemText);
      const newElem = elem.fullMatch.replace(`>${elem.text}<`, `>${escapedNewText}<`);
      // Strip any highlighting (yellow background) from the replaced element
      const cleanedElem = stripHighlighting(newElem);
      result = result.replace(elem.fullMatch, cleanedElem);
    }

    return result;
  });
}

/**
 * Escape special XML characters
 */
function escapeXml(text: string): string {
  // Only escape characters that are invalid in XML text content
  // Don't escape quotes/apostrophes - they're only problematic in attributes
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Remove highlighting from XML run elements
 * Original documents often have yellow highlighting on fields to annotate
 * The exported annotated document shouldn't preserve this highlighting
 */
function stripHighlighting(xml: string): string {
  let result = xml;

  // Remove <w:highlight .../> self-closing tags
  result = result.replace(/<w:highlight[^>]*\/>/g, '');
  // Remove <w:highlight ...>...</w:highlight> paired tags ([\s\S]*? for multiline)
  result = result.replace(/<w:highlight[^>]*>[\s\S]*?<\/w:highlight>/g, '');

  // Remove <w:shd .../> self-closing tags (shading/background color)
  result = result.replace(/<w:shd[^>]*\/>/g, '');
  // Remove <w:shd ...>...</w:shd> paired tags ([\s\S]*? for multiline)
  result = result.replace(/<w:shd[^>]*>[\s\S]*?<\/w:shd>/g, '');

  // Remove shading within paragraph properties <w:pPr>...<w:shd.../>...</w:pPr>
  // This handles paragraph-level background colors
  result = result.replace(/(<w:pPr[^>]*>)([\s\S]*?)(<w:shd[^>]*\/?>[\s\S]*?)(<\/w:pPr>)/g,
    (match, start, before, shd, end) => {
      // Remove w:shd elements from within pPr but keep everything else
      const cleanedContent = (before + shd).replace(/<w:shd[^>]*\/?>/g, '');
      return start + cleanedContent + end;
    }
  );

  // Also remove shading within run properties <w:rPr>...<w:shd.../>...</w:rPr>
  result = result.replace(/(<w:rPr[^>]*>)([\s\S]*?)(<w:shd[^>]*\/?>[\s\S]*?)(<\/w:rPr>)/g,
    (match, start, before, shd, end) => {
      const cleanedContent = (before + shd).replace(/<w:shd[^>]*\/?>/g, '');
      return start + cleanedContent + end;
    }
  );

  return result;
}

/**
 * Create a paragraph with properly formatted annotations
 */
function createParagraphWithAnnotations(text: string): Paragraph {
  const runs: TextRun[] = [];
  const annotationRegex = /\[(TextInput(?::\s*[^\]]+)?|Select:\s*[^\]]+|Date|Link|Money|Calculation)\]/g;

  let lastIndex = 0;
  let match;

  while ((match = annotationRegex.exec(text)) !== null) {
    // Add text before annotation
    if (match.index > lastIndex) {
      runs.push(
        new TextRun({
          text: text.substring(lastIndex, match.index),
        })
      );
    }

    // Add annotation with highlighting
    runs.push(
      new TextRun({
        text: match[0],
        highlight: 'yellow', // Highlight annotations for visibility
        bold: true,
      })
    );

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    runs.push(
      new TextRun({
        text: text.substring(lastIndex),
      })
    );
  }

  // If no runs, add the whole text
  if (runs.length === 0) {
    runs.push(new TextRun({ text }));
  }

  return new Paragraph({ children: runs });
}

/**
 * Apply annotations to text and return the annotated string
 */
export function applyAnnotationsToText(
  originalText: string,
  annotations: Annotation[]
): string {
  // Sort annotations by position (reverse order for replacement)
  const sortedAnnotations = [...annotations].sort(
    (a, b) => b.position.start - a.position.start
  );

  let result = originalText;
  for (const annotation of sortedAnnotations) {
    // Validate position is within bounds
    if (annotation.position.start < 0 || annotation.position.end > result.length) {
      console.log(`[applyAnnotations] Skipping invalid position: ${annotation.position.start}-${annotation.position.end} for "${annotation.originalText}"`);
      continue;
    }

    // Get the actual text at this position
    const actualTextAtPosition = result.substring(annotation.position.start, annotation.position.end);

    // CRITICAL: Verify the text at position matches what we expect
    // If it doesn't match, skip this annotation (position might be wrong)
    if (actualTextAtPosition !== annotation.originalText) {
      // Allow partial matches if original is contained
      if (!actualTextAtPosition.includes(annotation.originalText) &&
          !annotation.originalText.includes(actualTextAtPosition)) {
        console.log(`[applyAnnotations] Position mismatch: expected "${annotation.originalText}" but found "${actualTextAtPosition}" at ${annotation.position.start}`);
        continue;
      }
    }

    // CRITICAL: Don't create nested annotations
    // If the annotatedText would create [[Textinput]] (double brackets), fix it
    const before = result.substring(0, annotation.position.start);
    const after = result.substring(annotation.position.end);

    let finalAnnotation = annotation.annotatedText;

    // Check for double brackets
    if (before.endsWith('[') && finalAnnotation.startsWith('[')) {
      console.log(`[applyAnnotations] Preventing double open bracket for "${annotation.originalText}"`);
      // Either remove the bracket from before or adjust the annotation
      // We'll expand the replacement to include the preceding bracket
      const newBefore = before.slice(0, -1);
      result = newBefore + finalAnnotation + after;
      continue;
    }

    if (finalAnnotation.endsWith(']') && after.startsWith(']')) {
      console.log(`[applyAnnotations] Preventing double close bracket for "${annotation.originalText}"`);
      // Expand replacement to include the following bracket
      const newAfter = after.slice(1);
      result = before + finalAnnotation + newAfter;
      continue;
    }

    result = before + finalAnnotation + after;
  }

  return result;
}

// ----------------------------------------------------------------------------
// Validation Functions
// ----------------------------------------------------------------------------

/**
 * Validate that an annotation string is properly formatted
 */
export function validateAnnotation(annotation: string): {
  valid: boolean;
  error?: string;
} {
  // Check bracket balance
  const openCount = (annotation.match(/\[/g) || []).length;
  const closeCount = (annotation.match(/\]/g) || []).length;
  if (openCount !== closeCount) {
    return { valid: false, error: 'Unbalanced brackets' };
  }

  // Check for valid format
  const validFormats = [
    /^\[Textinput\]$/,
    /^\[Textinput:\s*[^\]]+\]$/,
    /^\[Select:\s*[^\]]+\/[^\]]+\]$/, // At least 2 options
    /^\[Date\]$/,
    /^\[Link\]$/,
    /^\[Money\]$/,
    /^\[Calculation\]$/,
    /^\[[^\]]+\]$/, // Generic text annotation
  ];

  const isValid = validFormats.some((regex) => regex.test(annotation));
  if (!isValid) {
    return { valid: false, error: 'Invalid annotation format' };
  }

  // Check Select has at least 2 options
  if (annotation.startsWith('[Select:')) {
    const options = extractSelectOptions(annotation);
    if (options.length < 2) {
      return {
        valid: false,
        error: 'Select must have at least 2 options separated by /',
      };
    }
  }

  return { valid: true };
}

/**
 * Create an annotation string from type and parameters
 */
export function createAnnotation(
  type: AnnotationType,
  label?: string,
  options?: string[]
): string {
  switch (type) {
    case 'TextInput':
      return label ? `[Textinput: ${label}]` : '[Textinput]';
    case 'Select':
      if (!options || options.length < 2) {
        throw new Error('Select requires at least 2 options');
      }
      return `[Select: ${options.join('/')}]`;
    case 'Date':
      return '[Date]';
    case 'Link':
      return '[Link]';
    case 'Money':
      return '[Money]';
    case 'Calculation':
      return '[Calculation]';
    case 'Text':
      return label ? `[${label}]` : '[Text]';
    default:
      throw new Error(`Unknown annotation type: ${type}`);
  }
}

// ----------------------------------------------------------------------------
// Utility Functions
// ----------------------------------------------------------------------------

/**
 * Escape special regex characters in a string
 */
function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Find all annotations in a text
 */
export function findAnnotations(text: string): ExtractedAnnotation[] {
  const annotations: ExtractedAnnotation[] = [];
  const regex = /\[(TextInput(?::\s*[^\]]+)?|Select:\s*[^\]]+|Date|Link|Money|Calculation|[^\]]+)\]/g;

  let match;
  while ((match = regex.exec(text)) !== null) {
    annotations.push({
      originalText: match[0],
      annotatedText: match[0],
      type: detectAnnotationType(match[0]),
      position: {
        start: match.index,
        end: match.index + match[0].length,
      },
    });
  }

  return annotations;
}

/**
 * Count annotations by type
 */
export function countAnnotationsByType(
  annotations: ExtractedAnnotation[]
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

  for (const annotation of annotations) {
    counts[annotation.type]++;
  }

  return counts;
}

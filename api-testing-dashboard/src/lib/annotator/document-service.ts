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
  HeadingLevel,
  AlignmentType,
} from 'docx';
import type {
  DocumentStructure,
  ParsedParagraph,
  ParsedRun,
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
}

// ----------------------------------------------------------------------------
// Parsing Functions
// ----------------------------------------------------------------------------

/**
 * Parse DOCX file to extract text and paragraph structure
 */
export async function parseDocx(file: File | Blob | Buffer): Promise<ParseResult> {
  let buffer: Buffer;

  if (file instanceof File || file instanceof Blob) {
    const arrayBuffer = await file.arrayBuffer();
    buffer = Buffer.from(arrayBuffer);
  } else {
    buffer = file;
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

  return {
    text: textResult.value,
    paragraphs,
    html: htmlResult.value,
  };
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
// Diff Functions
// ----------------------------------------------------------------------------

/**
 * Compare original and annotated documents to extract changes
 */
export function diffDocuments(
  originalText: string,
  annotatedText: string
): DiffResult {
  const diffs: DocumentDiff[] = [];
  const annotations: ExtractedAnnotation[] = [];

  // Find all annotations in the annotated text
  const annotationRegex = /\[(TextInput(?::\s*[^\]]+)?|Select:\s*[^\]]+|Date|Link|Money|Calculation)\]/g;
  let match;

  while ((match = annotationRegex.exec(annotatedText)) !== null) {
    const annotatedMatch = match[0];
    const position = match.index;

    // Find what this annotation replaced in the original
    const extractedAnnotation = extractAnnotationContext(
      originalText,
      annotatedText,
      annotatedMatch,
      position
    );

    if (extractedAnnotation) {
      annotations.push(extractedAnnotation);
      diffs.push({
        type: 'added',
        originalText: extractedAnnotation.originalText,
        newText: annotatedMatch,
        position: {
          start: position,
          end: position + annotatedMatch.length,
        },
      });
    }
  }

  return { diffs, annotations };
}

/**
 * Extract the context around an annotation to understand what was replaced
 */
function extractAnnotationContext(
  originalText: string,
  annotatedText: string,
  annotation: string,
  annotationPosition: number
): ExtractedAnnotation | null {
  // Get surrounding context from annotated text
  const contextBefore = annotatedText.substring(
    Math.max(0, annotationPosition - 50),
    annotationPosition
  );
  const contextAfter = annotatedText.substring(
    annotationPosition + annotation.length,
    annotationPosition + annotation.length + 50
  );

  // Try to find the same context in original text
  const searchPattern = escapeRegex(contextBefore) + '(.+?)' + escapeRegex(contextAfter);

  try {
    const regex = new RegExp(searchPattern, 's');
    const match = originalText.match(regex);

    if (match && match[1]) {
      const originalValue = match[1].trim();
      const type = detectAnnotationType(annotation);

      return {
        originalText: originalValue,
        annotatedText: annotation,
        type,
        position: {
          start: annotationPosition,
          end: annotationPosition + annotation.length,
        },
      };
    }
  } catch {
    // Regex failed, try simpler approach
  }

  // Fallback: use the label or placeholder as original
  const type = detectAnnotationType(annotation);
  const label = extractLabel(annotation);

  return {
    originalText: label || annotation,
    annotatedText: annotation,
    type,
    position: {
      start: annotationPosition,
      end: annotationPosition + annotation.length,
    },
  };
}

/**
 * Detect the annotation type from the annotation string
 */
export function detectAnnotationType(annotation: string): AnnotationType {
  if (annotation.startsWith('[TextInput')) return 'TextInput';
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
  const textInputMatch = annotation.match(/\[TextInput:\s*([^\]]+)\]/);
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
  replacements: Array<{ original: string; replacement: string }>
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

  // Filter out duplicates and already-annotated text
  const uniqueReplacements = sortedReplacements.filter((r, index) => {
    // Skip if original text is already an annotation (prevents nesting)
    if (r.original.startsWith('[') && r.original.includes(']')) {
      return false;
    }
    // Skip duplicates (same original text)
    return sortedReplacements.findIndex(x => x.original === r.original) === index;
  });

  // Track which text segments have been replaced (by storing replaced strings)
  const replacedTexts = new Set<string>();

  // Apply replacements to the XML content
  let modifiedXml = documentXml;

  for (const { original, replacement } of uniqueReplacements) {
    // Skip if we've already replaced this exact text
    if (replacedTexts.has(original)) {
      continue;
    }

    const escapedReplacement = escapeXml(replacement);
    const result = replaceTextInDocxXmlSafe(modifiedXml, original, escapedReplacement);

    if (result !== modifiedXml) {
      modifiedXml = result;
      replacedTexts.add(original);
    }
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
 * Safe text replacement in DOCX XML
 * Handles both simple replacements and text split across runs
 * Uses normalized comparison to handle curly quotes and special characters
 */
function replaceTextInDocxXmlSafe(
  xml: string,
  searchText: string,
  replacement: string
): string {
  // Normalize search text for comparison
  const normalizedSearch = normalizeForComparison(searchText);
  const escapedNormalizedSearch = escapeRegexChars(normalizedSearch);

  // Strategy 1: Direct replacement within single <w:t> elements
  // We need to find matches using normalized comparison but replace in original
  const textPattern = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  let modified = xml;
  let hasMatch = false;

  // First, check if any single <w:t> element contains the search text (normalized)
  modified = xml.replace(textPattern, (fullMatch, textContent) => {
    const normalizedContent = normalizeForComparison(textContent);
    const matchIndex = normalizedContent.indexOf(normalizedSearch);

    if (matchIndex === -1) {
      return fullMatch; // No match, keep original
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
 */
function replaceAcrossRuns(
  xml: string,
  searchText: string,
  replacement: string
): string {
  const paragraphPattern = /<w:p[^>]*>[\s\S]*?<\/w:p>/g;
  const normalizedSearch = normalizeForComparison(searchText);

  return xml.replace(paragraphPattern, (paragraph) => {
    // Extract all text elements with their positions
    const textElements: Array<{
      fullMatch: string;
      text: string;
      index: number;
    }> = [];

    const textPattern = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    let match;

    while ((match = textPattern.exec(paragraph)) !== null) {
      textElements.push({
        fullMatch: match[0],
        text: match[1],
        index: match.index
      });
    }

    if (textElements.length === 0) {
      return paragraph;
    }

    // Combine all text
    const combinedText = textElements.map(e => e.text).join('');

    // Check if this paragraph contains our search text (using normalized comparison)
    const normalizedCombined = normalizeForComparison(combinedText);
    const normalizedSearchIndex = normalizedCombined.indexOf(normalizedSearch);
    if (normalizedSearchIndex === -1) {
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

    for (let i = 0; i < textElements.length; i++) {
      const elem = textElements[i];
      const elemStart = charOffset;
      const elemEnd = charOffset + elem.text.length;
      charOffset = elemEnd;

      // Determine what portion of the new text should go in this element
      let newElemText = '';

      if (newTextOffset < newCombinedText.length) {
        // Calculate how much text this element should now hold
        // We try to maintain proportional distribution
        if (i === textElements.length - 1) {
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
  // Remove <w:highlight .../> self-closing tags
  let result = xml.replace(/<w:highlight[^>]*\/>/g, '');
  // Remove <w:highlight ...>...</w:highlight> paired tags (rare but possible)
  result = result.replace(/<w:highlight[^>]*>.*?<\/w:highlight>/g, '');
  // Also remove shading that might cause background colors
  result = result.replace(/<w:shd[^>]*\/>/g, '');
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
    const before = result.substring(0, annotation.position.start);
    const after = result.substring(annotation.position.end);
    result = before + annotation.annotatedText + after;
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
    /^\[TextInput\]$/,
    /^\[TextInput:\s*[^\]]+\]$/,
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
      return label ? `[TextInput: ${label}]` : '[TextInput]';
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

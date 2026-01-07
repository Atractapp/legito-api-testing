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

  // Apply replacements to the XML content
  let modifiedXml = documentXml;

  for (const { original, replacement } of replacements) {
    // Escape special XML characters in the replacement
    const escapedReplacement = escapeXml(replacement);

    // Find and replace text - this handles text that might be split across runs
    modifiedXml = replaceTextInDocxXml(modifiedXml, original, escapedReplacement);
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
 * Replace text in DOCX XML while handling text split across multiple w:t elements
 *
 * In DOCX, a single word like "Hello" might be split like:
 * <w:r><w:t>Hel</w:t></w:r><w:r><w:t>lo</w:t></w:r>
 *
 * This function handles such cases by working with the full text content.
 */
function replaceTextInDocxXml(xml: string, searchText: string, replacement: string): string {
  // First, try simple replacement (text not split across runs)
  // Escape special regex characters in search text
  const escapedSearch = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Try direct replacement within w:t elements
  const simplePattern = new RegExp(
    `(<w:t[^>]*>)([^<]*?)(${escapedSearch})([^<]*?)(</w:t>)`,
    'g'
  );

  let modified = xml.replace(simplePattern, `$1$2${replacement}$4$5`);

  // If simple replacement worked, return
  if (modified !== xml) {
    return modified;
  }

  // Handle text split across multiple w:t elements
  // This is more complex - we need to find paragraphs containing the text
  // and reconstruct them

  // Extract all text from w:t elements, find matches, and replace
  const paragraphPattern = /<w:p[^>]*>[\s\S]*?<\/w:p>/g;

  modified = xml.replace(paragraphPattern, (paragraph) => {
    // Extract all text content from this paragraph
    const textParts: Array<{ text: string; fullMatch: string }> = [];
    const textPattern = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    let match;

    while ((match = textPattern.exec(paragraph)) !== null) {
      textParts.push({ text: match[1], fullMatch: match[0] });
    }

    // Combine all text
    const fullText = textParts.map(p => p.text).join('');

    // Check if this paragraph contains our search text
    if (!fullText.includes(searchText)) {
      return paragraph;
    }

    // Replace in the combined text
    const newFullText = fullText.split(searchText).join(replacement);

    // Now we need to redistribute the new text back into the original structure
    // For simplicity, we'll put all text into the first w:t element and clear others
    let firstTextReplaced = false;
    let result = paragraph;

    // Replace text content in w:t elements
    result = paragraph.replace(textPattern, (fullMatch, textContent) => {
      if (!firstTextReplaced) {
        firstTextReplaced = true;
        // Put all the new text in the first w:t element
        return fullMatch.replace(textContent, newFullText);
      }
      // Clear subsequent w:t elements
      return fullMatch.replace(textContent, '');
    });

    return result;
  });

  return modified;
}

/**
 * Escape special XML characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
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

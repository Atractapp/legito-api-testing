import { NextRequest, NextResponse } from 'next/server';
import {
  parseDocx,
  storageService,
  getSessionDocPath,
  getSupabaseAdmin,
  getAuthenticatedUser,
  validateDocxFile,
  errorResponse,
  handleError,
  withRateLimit,
  type HighlightedRegion,
} from '@/lib/annotator';
import type { Pattern, AnnotationType, AnnotationSuggestion } from '@/types/annotator';

/**
 * POST /api/annotator/annotate
 * Start a new annotation session - upload document and get AI suggestions
 *
 * CORRECT FLOW:
 * 1. Parse document
 * 2. Load trained patterns
 * 3. For EACH pattern: search for pattern.originalText in document
 * 4. When found: suggest pattern.annotatedText
 * 5. Return all matches as suggestions
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimit = withRateLimit(request, 30, 60000);
    if ('error' in rateLimit) return rateLimit.error;

    const supabase = getSupabaseAdmin();
    const user = getAuthenticatedUser(request);

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return errorResponse('MISSING_FILE', 'File is required', 400);
    }

    // Validate file using magic bytes
    const validation = await validateDocxFile(file);
    if (!validation.valid) {
      return errorResponse('INVALID_FILE', validation.error || 'Invalid file', 400);
    }

    // 1. Parse the document
    const parsed = await parseDocx(file);
    const highlightedRegions = parsed.highlightedRegions || [];
    console.log(`[Annotate] Document parsed, ${parsed.text.length} characters, ${highlightedRegions.length} highlighted regions`);

    // Create session ID and upload file
    const sessionId = crypto.randomUUID();
    const inputPath = getSessionDocPath(user.id, sessionId, 'input');
    await storageService.upload(file, inputPath);

    // 2. Load trained patterns
    const { data: patternsData, error: patternsError } = await supabase
      .from('annotator_patterns')
      .select('id, user_id, original_text, annotated_text, annotation_type, confidence, usage_count, success_rate, training_pair_id, created_at, semantic_context')
      .eq('user_id', user.id)
      .order('confidence', { ascending: false });

    if (patternsError) {
      console.error('[Annotate] Patterns query error:', patternsError);
    }

    const patterns: Pattern[] = (patternsData || []).map((p) => ({
      id: p.id,
      userId: p.user_id,
      originalText: p.original_text,
      annotatedText: p.annotated_text,
      annotationType: p.annotation_type as AnnotationType,
      confidence: p.confidence,
      usageCount: p.usage_count,
      successRate: p.success_rate,
      trainingPairId: p.training_pair_id,
      createdAt: new Date(p.created_at),
      semanticContext: p.semantic_context,
    }));

    console.log(`[Annotate] Loaded ${patterns.length} patterns`);

    // 3. For EACH pattern: search for originalText in document (case-insensitive)
    // IMPORTANT: Only match when text is in a PLACEHOLDER CONTEXT, not regular prose
    const suggestions: AnnotationSuggestion[] = [];
    const documentText = parsed.text;
    const documentTextLower = documentText.toLowerCase();

    for (const pattern of patterns) {
      const originalText = pattern.originalText;
      const originalTextLower = originalText.toLowerCase();

      // Find ALL occurrences of this pattern's original text in the document (case-insensitive)
      let searchPos = 0;
      while (true) {
        const foundIndex = documentTextLower.indexOf(originalTextLower, searchPos);
        if (foundIndex === -1) break;

        // Get the actual text from document (preserving original case)
        const actualText = documentText.slice(foundIndex, foundIndex + originalText.length);

        // CRITICAL: Check if this is actually a placeholder vs regular prose
        //
        // TWO TYPES OF PATTERNS:
        // 1. STRUCTURAL patterns: [City], {Name}, ___, [**] - these DON'T need highlighting
        // 2. PLAIN TEXT patterns: "City", "Name" - these REQUIRE highlighting to match
        //
        const isStructuralPattern = isStructuralPlaceholder(originalText);
        const isHighlighted = isTextHighlighted(foundIndex, originalText.length, highlightedRegions);

        let shouldMatch = false;
        let matchReason = '';

        if (isStructuralPattern) {
          // Structural patterns (brackets, underscores) don't need highlighting
          shouldMatch = true;
          matchReason = 'structural pattern';
        } else if (isHighlighted) {
          // Plain text patterns REQUIRE highlighting
          shouldMatch = true;
          matchReason = 'HIGHLIGHTED';
        } else {
          // Plain text without highlighting - check context as fallback
          // But be very strict - only match if clearly a placeholder context
          const hasPlaceholderContext = isPlaceholderContext(documentText, foundIndex, originalText.length);
          if (hasPlaceholderContext) {
            shouldMatch = true;
            matchReason = 'placeholder context';
          }
        }

        if (shouldMatch) {
          console.log(`[Annotate] Found ${matchReason} text "${actualText}" at position ${foundIndex} → ${pattern.annotatedText}`);

          suggestions.push({
            id: crypto.randomUUID(),
            originalText: actualText, // Use actual text from document
            annotatedText: pattern.annotatedText,
            type: pattern.annotationType,
            position: {
              start: foundIndex,
              end: foundIndex + originalText.length,
            },
            confidence: pattern.confidence,
            isAccepted: true,
            isEdited: false,
          });
        } else {
          console.log(`[Annotate] Skipping plain text "${actualText}" at ${foundIndex} - not highlighted`);
        }

        // Move past this match to find next occurrence
        searchPos = foundIndex + originalText.length;
      }
    }

    // 4. AUTO-DETECT common placeholder formats even without trained patterns
    // This catches {PlaceholderName}, [PlaceholderName], highlighted text, etc.
    const autoDetectedSuggestions = autoDetectPlaceholders(documentText, suggestions, highlightedRegions);
    suggestions.push(...autoDetectedSuggestions);
    console.log(`[Annotate] Auto-detected ${autoDetectedSuggestions.length} additional placeholders`);

    // Sort by position
    suggestions.sort((a, b) => a.position.start - b.position.start);

    // Remove overlapping suggestions (keep higher confidence)
    const dedupedSuggestions = removeOverlappingSuggestions(suggestions);

    // Convert duplicate occurrences to [Link]
    // First occurrence of each original text stays as-is (TextInput, Select, Date, etc.)
    // Second+ occurrences become [Link] (user enters value once, rest auto-fill)
    // EXCEPTION: Signature blocks - dates/cities for different parties stay as new inputs
    const linkedSuggestions = convertDuplicatesToLinks(dedupedSuggestions, documentText);

    console.log(`[Annotate] Found ${suggestions.length} matches, after dedup: ${dedupedSuggestions.length}, after linking: ${linkedSuggestions.length}`);

    // Create session in database
    const { data: session, error: sessionError } = await supabase
      .from('annotator_sessions')
      .insert({
        id: sessionId,
        user_id: user.id,
        input_filename: file.name,
        input_text: parsed.text,
        input_file_path: inputPath,
        status: 'pending',
        claude_response: null,
        patterns_used: patterns.map((p) => p.id),
      })
      .select()
      .single();

    if (sessionError) {
      console.error('Failed to create session:', sessionError);
      return NextResponse.json(
        { error: 'Failed to create annotation session' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      session: {
        id: session.id,
        userId: session.user_id,
        inputFilename: session.input_filename,
        inputText: session.input_text,
        inputFilePath: session.input_file_path,
        status: session.status,
        createdAt: session.created_at,
      },
      suggestions: linkedSuggestions,
      stats: {
        totalSuggestions: linkedSuggestions.length,
        patternsAvailable: patterns.length,
        patternMatched: linkedSuggestions.length,
      },
    });
  } catch (error) {
    return handleError(error, 'Annotate POST');
  }
}

/**
 * Convert duplicate occurrences to [Link].
 *
 * In Legito, when the same placeholder appears multiple times:
 * - FIRST occurrence: Keep original type (TextInput, Select, Date, Money, etc.)
 * - SUBSEQUENT occurrences: Convert to [Link]
 *
 * EXCEPTION: Signature blocks
 * In signature sections (e.g., "V Praze dne", "In City, on"), dates and cities
 * are often NEW inputs for different signing parties, not links.
 * We detect signature block context and keep those as new inputs.
 *
 * @param suggestions - Sorted by position (earliest first)
 * @param documentText - Full document text for context analysis
 */
/**
 * Check if original text is a "context-less" placeholder that needs surrounding context to be linked.
 * These are generic placeholders that could mean different things in different places.
 *
 * Examples that NEED context:
 * - "X", "XX", "XXX" - could be any field
 * - "_____" - underscores
 * - "[X]", "{X}" - bracketed X
 *
 * Examples that DON'T need context (they ARE the context):
 * - "Name", "City", "Amount" - meaningful labels
 * - "DD.MM.YYYY" - specific date format
 */
function isContextlessPlaceholder(text: string): boolean {
  const trimmed = text.trim();

  // Just X's: X, XX, XXX, Xx
  if (/^[Xx]+$/.test(trimmed)) return true;

  // X's with separators: X.X.X, XX/XX/XXXX
  if (/^[Xx]+([.\/-][Xx]+)+$/.test(trimmed)) return true;

  // Just underscores
  if (/^_+$/.test(trimmed)) return true;

  // Bracketed X: [X], {XX}, <XXX>
  if (/^[\[\{<][Xx_\s]+[\]\}>]$/.test(trimmed)) return true;

  // Just symbols: *, **, ***, ●, ○
  if (/^[●○•◦▪▫■□\*\#\?\.\-\s]+$/.test(trimmed)) return true;

  return false;
}

/**
 * Get the contextual key for a placeholder.
 * For context-less placeholders, include surrounding words.
 * For meaningful placeholders, just use the text itself.
 */
function getContextualKey(suggestion: AnnotationSuggestion, documentText?: string): string {
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

function convertDuplicatesToLinks(
  suggestions: AnnotationSuggestion[],
  documentText?: string
): AnnotationSuggestion[] {
  // Track which CONTEXTUAL keys have been seen
  // For meaningful text like "Name", key = "name"
  // For context-less like "[X]" after "Name", key = "name|[x]|"
  const seenContextualKeys = new Map<string, { count: number; firstAnnotation: string }>();

  return suggestions.map((suggestion) => {
    const contextualKey = getContextualKey(suggestion, documentText);

    // Check if this is in a signature block context (different party signatures)
    const isSignatureBlock = documentText ? isInSignatureBlock(documentText, suggestion.position.start) : false;

    if (seenContextualKeys.has(contextualKey)) {
      const seen = seenContextualKeys.get(contextualKey)!;
      seen.count++;

      // EXCEPTION: Keep as new input if in signature block AND it's a date/city
      if (isSignatureBlock && (suggestion.type === 'Date' || isLikelySignatureField(suggestion))) {
        console.log(`[convertDuplicatesToLinks] Keeping "${suggestion.originalText}" as new input (signature block context)`);
        return suggestion;
      }

      // This is a DUPLICATE with same context - convert to [Link]
      console.log(`[convertDuplicatesToLinks] Converting duplicate "${suggestion.originalText}" (key: ${contextualKey}) to [Link]`);

      return {
        ...suggestion,
        annotatedText: '[Link]',
        type: 'Link' as AnnotationType,
        confidence: Math.min(suggestion.confidence, 0.95),
      };
    } else {
      // FIRST occurrence with this context
      seenContextualKeys.set(contextualKey, { count: 1, firstAnnotation: suggestion.annotatedText });
      console.log(`[convertDuplicatesToLinks] First occurrence of "${suggestion.originalText}" (key: ${contextualKey})`);
      return suggestion;
    }
  });
}

/**
 * Check if a position in the document is within a signature block.
 *
 * LANGUAGE-AGNOSTIC detection based on structural patterns:
 * - Underscore lines (signature lines): _______________
 * - Position in document (last 30%)
 * - Repetitive placeholder structure (same pattern appearing multiple times)
 * - Date-like patterns near placeholders
 * - Short lines with [placeholder], on [placeholder] structure
 */
function isInSignatureBlock(documentText: string, position: number): boolean {
  // Get context around position (500 chars before, 300 after)
  const contextStart = Math.max(0, position - 500);
  const contextEnd = Math.min(documentText.length, position + 300);
  const contextBefore = documentText.slice(contextStart, position);
  const contextAfter = documentText.slice(position, contextEnd);
  const fullContext = contextBefore + contextAfter;

  // =================================================================
  // STRUCTURAL PATTERN 1: Underscore signature lines nearby
  // Pattern: 3+ underscores, often followed by a name/title
  // Examples: __________________, _______________Name
  // =================================================================
  const underscoreLinePattern = /_{5,}/;
  if (underscoreLinePattern.test(fullContext)) {
    return true;
  }

  // =================================================================
  // STRUCTURAL PATTERN 2: "[Word], [Word]" or "[Word] [Word]" structure
  // Common in signature blocks: "In City, on Date" / "V Městě, dne Datum"
  // Look for: preposition + placeholder + comma/punctuation + preposition + placeholder
  // =================================================================
  // Pattern: word + comma + word before a date-like or placeholder pattern
  const locationDatePattern = /\b\w{1,4}\s+\w+,?\s+\w{1,4}\s+[\dXx]{1,2}[.\/-]/i;
  if (locationDatePattern.test(fullContext)) {
    return true;
  }

  // =================================================================
  // STRUCTURAL PATTERN 3: Date patterns in the last portion of document
  // Date formats: DD.MM.YYYY, XX.XX.XXXX, dd/mm/yyyy, etc.
  // These are universal regardless of language
  // =================================================================
  const datePatterns = [
    /[\dXx]{1,2}[.\/-][\dXx]{1,2}[.\/-][\dXx]{2,4}/,  // DD.MM.YYYY, XX.XX.XXXX
    /\b[Dd]{2}[.\/-][Mm]{2}[.\/-][Yy]{2,4}\b/,        // DD.MM.YYYY literal
  ];

  const positionRatio = position / documentText.length;

  // If we're in the last 30% of document AND there's a date pattern nearby
  if (positionRatio > 0.7) {
    for (const pattern of datePatterns) {
      if (pattern.test(fullContext)) {
        return true;
      }
    }
  }

  // =================================================================
  // STRUCTURAL PATTERN 4: Multiple similar short blocks
  // Signature sections often have repeated structure for multiple parties
  // Look for newlines + short content + newlines pattern
  // =================================================================
  // Count newlines - signature blocks tend to have more line breaks
  const newlineCount = (fullContext.match(/\n/g) || []).length;
  const avgLineLength = fullContext.length / Math.max(newlineCount, 1);

  // Short average lines (< 60 chars) with multiple breaks suggests signature block
  if (positionRatio > 0.7 && newlineCount >= 3 && avgLineLength < 60) {
    return true;
  }

  // =================================================================
  // STRUCTURAL PATTERN 5: Position-based with placeholder density
  // Last 25% of document with multiple placeholders = likely signature
  // =================================================================
  if (positionRatio > 0.75) {
    // Count placeholder-like patterns in context
    const placeholderPatterns = fullContext.match(/\{[^}]+\}|\[[^\]]+\]|_{3,}|[Xx]{2,}[.\/-][Xx]{2,}/g) || [];
    if (placeholderPatterns.length >= 2) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a suggestion is likely a signature-related field (city, date for signing)
 * These fields should remain as NEW inputs in signature blocks, not become Links.
 *
 * LANGUAGE-AGNOSTIC detection based on:
 * - Date type annotations
 * - Date-like placeholder patterns (DD.MM.YYYY, XX.XX.XXXX)
 * - Short single-word placeholders (likely city/location)
 * - Annotation structure patterns
 */
function isLikelySignatureField(suggestion: AnnotationSuggestion): boolean {
  const originalText = suggestion.originalText;
  const originalLower = originalText.toLowerCase();

  // =================================================================
  // PATTERN 1: Date type - always a signature field candidate
  // =================================================================
  if (suggestion.type === 'Date') {
    return true;
  }

  // =================================================================
  // PATTERN 2: Date-like placeholder patterns (universal)
  // DD.MM.YYYY, XX.XX.XXXX, dd/mm/yyyy, 00.00.0000, etc.
  // =================================================================
  // Check for date format patterns
  if (/^[\dXxDdMmYy]{1,4}[.\/-][\dXxDdMmYy]{1,4}[.\/-][\dXxDdMmYy]{2,4}$/.test(originalText.trim())) {
    return true;
  }

  // Check for DD.MM.YYYY literal pattern
  if (/^[Dd]{1,2}[.\/-][Mm]{1,2}[.\/-][Yy]{2,4}$/.test(originalText.trim())) {
    return true;
  }

  // Check for X patterns: XX.XX.XXXX, XXX, etc.
  if (/^[Xx]{2,}([.\/-][Xx]{2,})*$/.test(originalText.trim())) {
    return true;
  }

  // =================================================================
  // PATTERN 3: Short single-word text (likely city/location placeholder)
  // In signature blocks, short words like "City", "Město", "Place" are locations
  // =================================================================
  const trimmed = originalText.trim();
  // Single word, 3-15 characters, starts with capital letter = likely location
  if (/^[A-Z][a-zA-Z\u00C0-\u024F]{2,14}$/.test(trimmed)) {
    // But not if it's a common document word (check if it's short and capitalized)
    // This catches: City, Prague, Berlin, Москва, 東京, etc.
    return true;
  }

  // =================================================================
  // PATTERN 4: Placeholder with only special characters
  // [___], {___}, (blank), etc. - these are fill-in-the-blank fields
  // =================================================================
  if (/^[\[\{\(]?[_\-\s\*\.]{2,}[\]\}\)]?$/.test(trimmed)) {
    return true;
  }

  return false;
}

/**
 * Get a meaningful label for TextInput, or null if the label is not meaningful.
 *
 * Labels that are NOT meaningful (return null):
 * - Empty or whitespace only
 * - Just underscores: ___, ____________
 * - Just symbols: X, [X], **, ●
 * - Just numbers: 1, 123
 * - Very short meaningless: "", " ", ":"
 *
 * Labels that ARE meaningful:
 * - Actual field names: "Name", "City", "Amount"
 * - Descriptive text: "Company Name", "Date of Birth"
 */
function getMeaningfulLabel(text: string, contextBefore?: string): string | null {
  if (!text) return null;

  let trimmed = text.trim();

  // Empty or too short
  if (trimmed.length === 0) return null;

  // FIRST: Strip ALL brackets from start and end - they break [TextInput: label] format
  // Also strip any brackets mixed with content like "XX]" or "[Name"
  trimmed = trimmed.replace(/^[\[\]{}()<>]+/, '').replace(/[\[\]{}()<>]+$/, '');
  // Also remove any remaining brackets inside
  trimmed = trimmed.replace(/[\[\]{}()<>]/g, '').trim();

  // After stripping, check if empty
  if (trimmed.length === 0) return null;

  // Just underscores
  if (/^_+$/.test(trimmed)) return null;

  // Just X's (X, XX, XXX, Xx, etc.) - these are placeholders, not labels
  if (/^[Xx]+$/.test(trimmed)) return null;

  // Just symbols
  if (/^[●○•◦▪▫■□\*\#\?\.\-\s]+$/.test(trimmed)) return null;

  // Just numbers
  if (/^\d+$/.test(trimmed)) return null;

  // Just punctuation
  if (/^[:\.,;!\?\-\s]+$/.test(trimmed)) return null;

  // Single character (unless it's a meaningful letter)
  if (trimmed.length === 1 && !/^[A-Za-z]$/.test(trimmed)) return null;

  // X's with dots (date patterns): XX.XX.XXXX, X.X.X
  if (/^[Xx]+([.\/-][Xx]+)+$/.test(trimmed)) return null;

  // If it's too long (instruction text), don't use as label
  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount > 5) {
    // Try to extract a label from context instead
    if (contextBefore) {
      const labelMatch = contextBefore.match(/([A-Za-z][A-Za-z\s]{2,20})[:.]?\s*$/);
      if (labelMatch) {
        return labelMatch[1].trim();
      }
    }
    return null;
  }

  // It's meaningful
  return trimmed;
}

/**
 * Check if a pattern's original text is a STRUCTURAL placeholder.
 *
 * Structural placeholders have clear markers that indicate they're fillable:
 * - Brackets: [City], {Name}, <date>
 * - Underscores: ____, Name: _____
 * - Placeholder symbols: [**], [___], [●], XXX
 * - Date patterns: DD.MM.YYYY, XX.XX.XXXX
 *
 * These DON'T need highlighting to match - the structure itself is the indicator.
 *
 * Plain text patterns like "City", "Name", "Company" DO need highlighting.
 */
function isStructuralPlaceholder(text: string): boolean {
  const trimmed = text.trim();

  // Brackets: [xxx], {xxx}, <xxx>
  if (/^[\[\{<].+[\]\}>]$/.test(trimmed)) {
    return true;
  }

  // Underscores: ___ (3 or more)
  if (/_{3,}/.test(trimmed)) {
    return true;
  }

  // X patterns: XXX, XX.XX.XXXX
  if (/^[Xx]{2,}([.\/-][Xx]{2,})*$/.test(trimmed)) {
    return true;
  }

  // Date patterns: DD.MM.YYYY, dd/mm/yyyy
  if (/^[Dd]{1,2}[.\/-][Mm]{1,2}[.\/-][Yy]{2,4}$/.test(trimmed)) {
    return true;
  }

  // Special placeholder symbols: ●, ○, •, *, #
  if (/^[●○•◦▪▫■□\*\#\?\.\-]+$/.test(trimmed)) {
    return true;
  }

  // Curly brace placeholders: {Name}, {City}
  if (/^\{[^}]+\}$/.test(trimmed)) {
    return true;
  }

  // Template variables: {{name}}, <%= name %>
  if (/^\{\{.+\}\}$/.test(trimmed) || /^<%[=\-]?\s*.+\s*%>$/.test(trimmed)) {
    return true;
  }

  // Otherwise, it's plain text
  return false;
}

/**
 * Check if text at a given position is highlighted (has background color)
 */
function isTextHighlighted(
  start: number,
  length: number,
  highlightedRegions: HighlightedRegion[]
): boolean {
  const end = start + length;

  for (const region of highlightedRegions) {
    // Check if the text overlaps with a highlighted region
    if (start < region.position.end && end > region.position.start) {
      // Calculate overlap
      const overlapStart = Math.max(start, region.position.start);
      const overlapEnd = Math.min(end, region.position.end);
      const overlapLength = overlapEnd - overlapStart;

      // If more than 50% of the text is highlighted, consider it highlighted
      if (overlapLength > length * 0.5) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check if a matched text is in a PLACEHOLDER context vs regular prose.
 *
 * Words like "city", "name", "date" appear everywhere in documents.
 * We should ONLY match them when they're clearly placeholders, not regular text.
 *
 * PLACEHOLDER indicators (should match):
 * - Near underscores: "city: ______", "______city______"
 * - In brackets: "[city]", "{city}", "<city>"
 * - After colon at line start: "City:"
 * - Standalone on a line (form field)
 * - ALL CAPS in non-header context: "CITY" as a field
 * - Near other placeholder markers
 *
 * REGULAR TEXT indicators (should NOT match):
 * - Part of sentence: "the city", "their city of residence"
 * - After articles: "a city", "an city", "the city"
 * - Common phrases: "city of", "city and", "city or"
 * - Middle of paragraph with normal punctuation
 */
function isPlaceholderContext(
  documentText: string,
  matchStart: number,
  matchLength: number
): boolean {
  // Get context around the match
  const contextBefore = documentText.slice(Math.max(0, matchStart - 50), matchStart);
  const contextAfter = documentText.slice(matchStart + matchLength, matchStart + matchLength + 50);
  const matchedText = documentText.slice(matchStart, matchStart + matchLength);

  const beforeLower = contextBefore.toLowerCase();
  const afterLower = contextAfter.toLowerCase();

  // =================================================================
  // DEFINITE PLACEHOLDER - Always match these
  // =================================================================

  // Pattern 1: Text is in brackets [city], {city}, <city>
  if (/[\[\{<]\s*$/.test(contextBefore) && /^\s*[\]\}>]/.test(contextAfter)) {
    return true;
  }

  // Pattern 2: Near underscores (within 10 chars)
  if (/_{3,}\s*$/.test(contextBefore) || /^\s*_{3,}/.test(contextAfter)) {
    return true;
  }

  // Pattern 3: After colon with optional space, at-ish line start
  // "City: " or "Name:" pattern (form field label)
  if (/:\s*$/.test(contextBefore) && /^\s*($|\n|,|;)/.test(contextAfter)) {
    return true;
  }

  // Pattern 4: Standalone on line (form field style)
  // Check if preceded by newline/start and followed by newline/end
  if (/(?:^|\n)\s*$/.test(contextBefore) && /^\s*(?:\n|$)/.test(contextAfter)) {
    return true;
  }

  // Pattern 5: Part of a placeholder pattern like "currently ______"
  // The underscores ARE the placeholder, but labeled text nearby should match
  if (/_{5,}/.test(contextBefore + contextAfter)) {
    // But only if text is adjacent to the underscores (within 20 chars)
    const nearUnderscores = documentText.slice(
      Math.max(0, matchStart - 20),
      matchStart + matchLength + 20
    );
    if (/_{5,}/.test(nearUnderscores)) {
      // Check if this is a label FOR the underscores or regular text
      // "currently ______" - "currently" is regular text
      // "City: ______" - "City" is a label
      if (/:\s*_{3,}/.test(nearUnderscores) || /_{3,}\s*:/.test(nearUnderscores)) {
        return true;
      }
    }
  }

  // =================================================================
  // DEFINITE REGULAR TEXT - Never match these
  // =================================================================

  // Pattern: After articles (the, a, an, their, this, that, etc.)
  const articlePattern = /\b(the|a|an|their|this|that|these|those|its|his|her|our|your|my)\s+$/i;
  if (articlePattern.test(contextBefore)) {
    return false;
  }

  // Pattern: Common phrases that indicate regular text
  // "city of", "city and", "city or", "city is", "city was"
  const regularPhraseAfter = /^\s+(of|and|or|is|was|were|are|has|had|will|would|can|could|for|to|in|on|at|by|from)\b/i;
  if (regularPhraseAfter.test(contextAfter)) {
    return false;
  }

  // Pattern: Part of possessive or compound: "city's", "city-wide"
  if (/^['']s\b/.test(contextAfter) || /^-\w/.test(contextAfter)) {
    return false;
  }

  // Pattern: After prepositions in flowing text
  const prepositionBefore = /\b(in|on|at|to|from|of|for|with|by|outside|inside|within|near)\s+$/i;
  if (prepositionBefore.test(contextBefore)) {
    // Could be either - check if there's more sentence after
    // "in city of residence" = regular text
    // "in City" at end = possibly placeholder
    if (/^\s+\w+\s+\w+/.test(contextAfter)) {
      return false; // More words follow - likely regular text
    }
  }

  // =================================================================
  // HEURISTIC CHECKS - More nuanced decisions
  // =================================================================

  // If matched text is ALL CAPS and short, it might be a field marker
  // BUT only if it's in a clearly placeholder position (not mid-sentence)
  if (matchedText === matchedText.toUpperCase() && matchedText.length <= 20) {
    // But not if it's in a header-like context (all caps line)
    const fullLine = getLineContaining(documentText, matchStart);
    if (fullLine && fullLine !== fullLine.toUpperCase()) {
      // Mixed case line with ALL CAPS word - check if it's isolated
      // "in CITY of" = regular text (surrounded by lowercase)
      // "Name: CITY" = possibly a field
      const isMidText = /\w\s*$/.test(contextBefore) && /^\s*\w/.test(contextAfter);
      if (!isMidText) {
        return true;
      }
    }
  }

  // REMOVED: The "nearby placeholders" heuristic was too aggressive
  // Just because there's an underscore or [X] nearby doesn't mean all text is a placeholder
  // Example: "currently titled '______' ('Series')" - "Series" is NOT a placeholder!

  // Default: If the text is a common word (< 10 chars) in flowing prose, skip it
  if (matchLength < 10) {
    // Check if it looks like mid-sentence
    const isMidSentence = /\w\s+$/.test(contextBefore) && /^\s+\w/.test(contextAfter);
    if (isMidSentence) {
      return false;
    }
  }

  // Default: Assume it's NOT a placeholder for common words
  // Only explicit placeholder patterns should match
  return false;
}

/**
 * Get the full line containing a position in the document
 */
function getLineContaining(text: string, position: number): string | null {
  const lineStart = text.lastIndexOf('\n', position - 1) + 1;
  const lineEnd = text.indexOf('\n', position);
  return text.slice(lineStart, lineEnd === -1 ? text.length : lineEnd);
}

/**
 * Remove overlapping suggestions, keeping the one with higher confidence
 */
function removeOverlappingSuggestions(suggestions: AnnotationSuggestion[]): AnnotationSuggestion[] {
  const result: AnnotationSuggestion[] = [];

  for (const suggestion of suggestions) {
    const overlapping = result.find((s) => {
      // Check if positions overlap
      return (
        (suggestion.position.start >= s.position.start && suggestion.position.start < s.position.end) ||
        (suggestion.position.end > s.position.start && suggestion.position.end <= s.position.end) ||
        (suggestion.position.start <= s.position.start && suggestion.position.end >= s.position.end)
      );
    });

    if (overlapping) {
      // Keep the one with higher confidence, or the longer match
      if (suggestion.confidence > overlapping.confidence ||
          (suggestion.confidence === overlapping.confidence &&
           suggestion.originalText.length > overlapping.originalText.length)) {
        const idx = result.indexOf(overlapping);
        result[idx] = suggestion;
      }
    } else {
      result.push(suggestion);
    }
  }

  return result;
}

/**
 * Extract annotation type from annotation string
 */
function extractTypeFromAnnotation(annotation: string): AnnotationType {
  if (annotation.startsWith('[TextInput')) return 'TextInput';
  if (annotation.startsWith('[Select:')) return 'Select';
  if (annotation === '[Date]') return 'Date';
  if (annotation === '[Link]') return 'Link';
  if (annotation === '[Money]') return 'Money';
  if (annotation === '[Calculation]') return 'Calculation';
  return 'TextInput';
}

/**
 * Auto-detect common placeholder formats in document even without trained patterns.
 *
 * Detects:
 * - {PlaceholderName} - Legito/template style (e.g., {ContractNumber}, {SignatureDate})
 * - Common date/money/name patterns based on placeholder name
 *
 * This allows the annotator to work on documents that already have template placeholders
 * without requiring manual training first.
 */
function autoDetectPlaceholders(
  documentText: string,
  existingSuggestions: AnnotationSuggestion[],
  highlightedRegions: HighlightedRegion[] = []
): AnnotationSuggestion[] {
  const detected: AnnotationSuggestion[] = [];

  // Get positions already covered by pattern-matched suggestions
  const coveredPositions = new Set<string>();
  for (const s of existingSuggestions) {
    for (let i = s.position.start; i < s.position.end; i++) {
      coveredPositions.add(String(i));
    }
  }

  // Helper to check if position is covered
  const isCovered = (pos: number) => coveredPositions.has(String(pos));

  // Helper to mark positions as covered
  const markCovered = (start: number, end: number) => {
    for (let i = start; i < end; i++) {
      coveredPositions.add(String(i));
    }
  };

  // =================================================================
  // Pattern 0: HIGHLIGHTED TEXT - Auto-detect text with background color
  // BUT: Not all highlighted text is a fillable field!
  //
  // ANNOTATE if:
  // - Short (1-3 words) - likely a field placeholder
  // - Contains "insert", "enter", "fill in" - instruction to fill
  // - Is a structural pattern ([X], ___, etc.)
  //
  // SKIP if:
  // - Long text (4+ words) without instruction keywords - likely conditional/legal text
  // - Looks like a sentence or legal clause
  // - Already contains annotation markers [TextInput, [Date, etc.
  // =================================================================
  for (const region of highlightedRegions) {
    if (isCovered(region.position.start)) continue;

    let text = region.text.trim();
    let position = { ...region.position };

    // Skip empty text
    if (!text) continue;

    // SKIP punctuation-only text - parentheses, quotes, etc. are NOT placeholders
    // These often get highlighted as part of formatting but aren't fillable
    if (/^[()[\]{}<>"''""«»‹›.,;:!?@#$%^&*+=|\\\/~`]+$/.test(text)) {
      console.log(`[autoDetect] Skipping punctuation-only: "${text}"`);
      continue;
    }

    // SKIP very short text that's not a meaningful placeholder
    // Single letters/digits that aren't part of a pattern should be skipped
    if (text.length === 1 && !/[A-Za-z0-9]/.test(text)) {
      console.log(`[autoDetect] Skipping single non-alphanumeric: "${text}"`);
      continue;
    }

    // SKIP if text already contains annotation markers (prevents nested [TextInput: [TextInput:]])
    // Also skip if it looks like a partial annotation (has unmatched brackets with annotation keywords)
    if (/\[(TextInput|Date|Money|Select|Link|Number|Checkbox|Calculation)/i.test(text)) {
      console.log(`[autoDetect] Skipping already-annotated text: "${text.slice(0, 50)}"`);
      continue;
    }

    // SKIP if text contains square brackets that look like annotations
    // This catches cases where only part of an annotation is highlighted
    if (/\[[^\]]*$/.test(text) || /^[^\[]*\]/.test(text)) {
      console.log(`[autoDetect] Skipping text with unmatched annotation brackets: "${text.slice(0, 50)}"`);
      continue;
    }

    // CHECK: If only inner content is highlighted (e.g., "X" in "[X]"),
    // expand to include surrounding brackets
    const charBefore = documentText.charAt(position.start - 1);
    const charAfter = documentText.charAt(position.end);
    if ((charBefore === '[' && charAfter === ']') ||
        (charBefore === '{' && charAfter === '}') ||
        (charBefore === '<' && charAfter === '>') ||
        (charBefore === '(' && charAfter === ')')) {
      // Expand position to include brackets
      position.start -= 1;
      position.end += 1;
      text = documentText.slice(position.start, position.end);
      console.log(`[autoDetect] Expanded highlighted region to include brackets: "${text}"`);
    }

    // Count words in highlighted text
    const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;

    // Check if it's an instruction to fill (should annotate)
    const instructionKeywords = ['insert', 'enter', 'fill in', 'fill out', 'specify', 'indicate', 'provide', 'add', 'write', 'type'];
    const hasInstruction = instructionKeywords.some(kw => text.toLowerCase().includes(kw));

    // Check if it's a structural placeholder
    const isStructural = isStructuralPlaceholder(text);

    // Decision logic:
    // - Structural patterns → always annotate
    // - Has instruction keyword → always annotate
    // - Short (1-3 words) → annotate
    // - Long (4+ words) without instruction → SKIP (likely conditional/legal text)
    if (!isStructural && !hasInstruction && wordCount >= 4) {
      console.log(`[autoDetect] Skipping long highlighted text (${wordCount} words, no instruction): "${text.slice(0, 50)}..."`);
      continue;
    }

    // Get context for type inference
    const contextBefore = documentText.slice(Math.max(0, position.start - 100), position.start);
    const contextAfter = documentText.slice(position.end, position.end + 100);

    // Infer type from highlighted text and context
    const { type, label } = inferAnnotationFromPlaceholderName(text, contextBefore, contextAfter);

    // Build annotation - only add label if meaningful
    let annotatedText: string;
    if (type === 'Date') {
      annotatedText = '[Date]';
    } else if (type === 'Money') {
      annotatedText = '[Money]';
    } else {
      // Only add label if it's meaningful (not just the placeholder itself)
      const meaningfulLabel = getMeaningfulLabel(label || text, contextBefore);
      annotatedText = meaningfulLabel ? `[TextInput: ${meaningfulLabel}]` : '[TextInput]';
    }

    console.log(`[autoDetect] Found HIGHLIGHTED text "${text.slice(0, 50)}" → ${annotatedText}`);

    detected.push({
      id: crypto.randomUUID(),
      originalText: text,
      annotatedText,
      type,
      position,
      confidence: 0.95, // High confidence for highlighted text
      isAccepted: true,
      isEdited: false,
    });

    markCovered(position.start, position.end);
  }

  // =================================================================
  // Pattern 1: {PlaceholderName} - curly brace placeholders
  // =================================================================
  const curlyBracePattern = /\{([A-Za-z][A-Za-z0-9_]*)\}/g;
  let match;

  while ((match = curlyBracePattern.exec(documentText)) !== null) {
    const fullMatch = match[0];
    const placeholderName = match[1];
    const position = match.index;

    if (isCovered(position)) continue;

    const contextBefore = documentText.slice(Math.max(0, position - 150), position);
    const contextAfter = documentText.slice(position + fullMatch.length, position + fullMatch.length + 150);

    const { type, label } = inferAnnotationFromPlaceholderName(placeholderName, contextBefore, contextAfter);

    let annotatedText: string;
    if (type === 'Date') {
      annotatedText = '[Date]';
    } else if (type === 'Money') {
      annotatedText = '[Money]';
    } else if (type === 'Select') {
      annotatedText = `[Select: ${label}]`;
    } else {
      annotatedText = `[TextInput: ${label}]`;
    }

    console.log(`[autoDetect] Found {placeholder} "${fullMatch}" → ${annotatedText}`);

    detected.push({
      id: crypto.randomUUID(),
      originalText: fullMatch,
      annotatedText,
      type,
      position: { start: position, end: position + fullMatch.length },
      confidence: 0.85,
      isAccepted: true,
      isEdited: false,
    });

    markCovered(position, position + fullMatch.length);
  }

  // =================================================================
  // Pattern 2: Underscores ____________ (5+ underscores = blank field)
  // BUT: Skip standalone signature lines (just underscores on a line)
  // =================================================================
  const underscorePattern = /_{5,}/g;

  while ((match = underscorePattern.exec(documentText)) !== null) {
    const fullMatch = match[0];
    const position = match.index;

    if (isCovered(position)) continue;

    // Get context to infer type
    const contextBefore = documentText.slice(Math.max(0, position - 100), position);
    const contextAfter = documentText.slice(position + fullMatch.length, position + fullMatch.length + 100);

    // Check if this is a STANDALONE signature line (should NOT annotate)
    // Signature lines: just underscores on a line, maybe with whitespace
    const lineStart = contextBefore.lastIndexOf('\n');
    const textBeforeOnLine = contextBefore.slice(lineStart + 1).trim();
    const lineEnd = contextAfter.indexOf('\n');
    const textAfterOnLine = (lineEnd === -1 ? contextAfter : contextAfter.slice(0, lineEnd)).trim();

    // If there's no meaningful text before or after on the same line = signature line
    const isSignatureLine = textBeforeOnLine.length === 0 && textAfterOnLine.length === 0;

    // Also check: if it's VERY long (20+ underscores) and standalone, it's likely a signature line
    const isLongStandalone = fullMatch.length >= 20 && textBeforeOnLine.length < 3;

    if (isSignatureLine || isLongStandalone) {
      console.log(`[autoDetect] Skipping signature line underscores "${fullMatch}" (standalone)`);
      continue;
    }

    // Try to find a label before the underscores
    // Patterns: "Name: _____", "City _____", "Amount: _____"
    const labelMatch = contextBefore.match(/([A-Za-z][A-Za-z\s]{2,20})[:.]?\s*$/);
    const label = labelMatch ? labelMatch[1].trim() : null;

    // If no label found, skip - it's likely a standalone fill-in line without context
    if (!label) {
      console.log(`[autoDetect] Skipping underscores "${fullMatch}" - no label found`);
      continue;
    }

    // Infer type from label and context
    const { type } = inferAnnotationFromPlaceholderName(label, contextBefore, contextAfter);

    let annotatedText: string;
    if (type === 'Date') {
      annotatedText = '[Date]';
    } else if (type === 'Money') {
      annotatedText = '[Money]';
    } else {
      annotatedText = `[TextInput: ${label}]`;
    }

    console.log(`[autoDetect] Found labeled underscores "${fullMatch}" → ${annotatedText} (label: "${label}")`);

    detected.push({
      id: crypto.randomUUID(),
      originalText: fullMatch,
      annotatedText,
      type,
      position: { start: position, end: position + fullMatch.length },
      confidence: 0.8,
      isAccepted: true,
      isEdited: false,
    });

    markCovered(position, position + fullMatch.length);
  }

  // =================================================================
  // Pattern 3: [bracketed placeholders] like [name], [date], [___]
  // =================================================================
  const bracketPattern = /\[([^\[\]]{1,30})\]/g;

  while ((match = bracketPattern.exec(documentText)) !== null) {
    const fullMatch = match[0];
    const content = match[1];
    const position = match.index;

    if (isCovered(position)) continue;

    // Skip if it looks like an existing annotation [TextInput: X], [Date], etc.
    if (/^(TextInput|Date|Money|Link|Select|Calculation|Number|Checkbox)/i.test(content)) {
      continue;
    }

    // Check if it's a blank placeholder [___], [***], [   ]
    const isBlank = /^[_\*\s\-\.]+$/.test(content);

    const contextBefore = documentText.slice(Math.max(0, position - 100), position);
    const contextAfter = documentText.slice(position + fullMatch.length, position + fullMatch.length + 100);

    let label: string;
    let type: AnnotationType;

    if (isBlank) {
      // Try to find label from context
      const labelMatch = contextBefore.match(/([A-Za-z][A-Za-z\s]{2,20})[:.]?\s*$/);
      label = labelMatch ? labelMatch[1].trim() : 'Field';
      const inferred = inferAnnotationFromPlaceholderName(label, contextBefore, contextAfter);
      type = inferred.type;
    } else {
      // Content is the label
      label = content;
      const inferred = inferAnnotationFromPlaceholderName(content, contextBefore, contextAfter);
      type = inferred.type;
    }

    let annotatedText: string;
    if (type === 'Date') {
      annotatedText = '[Date]';
    } else if (type === 'Money') {
      annotatedText = '[Money]';
    } else {
      // Use getMeaningfulLabel to filter out meaningless labels like "X", "__"
      const meaningfulLabel = getMeaningfulLabel(label, contextBefore);
      annotatedText = meaningfulLabel ? `[TextInput: ${meaningfulLabel}]` : '[TextInput]';
    }

    console.log(`[autoDetect] Found [bracket] "${fullMatch}" → ${annotatedText}`);

    detected.push({
      id: crypto.randomUUID(),
      originalText: fullMatch,
      annotatedText,
      type,
      position: { start: position, end: position + fullMatch.length },
      confidence: 0.8,
      isAccepted: true,
      isEdited: false,
    });

    markCovered(position, position + fullMatch.length);
  }

  // =================================================================
  // Pattern 4: Date placeholders DD.MM.YYYY, XX.XX.XXXX, etc.
  // =================================================================
  const datePatterns = [
    /\b[Dd]{1,2}[.\/-][Mm]{1,2}[.\/-][Yy]{2,4}\b/g,  // DD.MM.YYYY
    /\b[Xx]{2,4}[.\/-][Xx]{2,4}[.\/-][Xx]{2,4}\b/g,  // XX.XX.XXXX
  ];

  for (const pattern of datePatterns) {
    while ((match = pattern.exec(documentText)) !== null) {
      const fullMatch = match[0];
      const position = match.index;

      if (isCovered(position)) continue;

      console.log(`[autoDetect] Found date pattern "${fullMatch}" → [Date]`);

      detected.push({
        id: crypto.randomUUID(),
        originalText: fullMatch,
        annotatedText: '[Date]',
        type: 'Date',
        position: { start: position, end: position + fullMatch.length },
        confidence: 0.9,
        isAccepted: true,
        isEdited: false,
      });

      markCovered(position, position + fullMatch.length);
    }
  }

  return detected;
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
function inferAnnotationFromPlaceholderName(
  placeholderName: string,
  contextBefore?: string,
  contextAfter?: string
): { type: AnnotationType; label: string } {
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

  // STRONG date indicators - these override even without date-like placeholder
  // These are very specific and almost always mean a date follows
  const strongDateIndicators = [
    // Czech - very specific
    'ze dne', 'ke dni', 'dne', 'dňa', 'datum', 'v den',
    'uzavřena dne', 'podepsáno dne', 'v praze dne', 'dnem',
    // English - very specific
    'dated', 'as of', 'effective date', 'valid until', 'expires on',
    'due by', 'signed on', 'executed on',
    // Spanish
    'el día', 'fecha',
  ];

  // WEAK date indicators - only apply if placeholder looks like a date
  // Words like "by", "on", "from" are too generic alone
  const weakDateIndicators = [
    'do', 'od', 'on', 'by', 'until', 'from', 'effective',
    'platnosti do', 'účinnosti do', 'termín', 'lhůta', 'platné do',
    'hasta el', 'desde el',
  ];

  // Check STRONG indicators first (don't need date-like placeholder)
  for (const indicator of strongDateIndicators) {
    const escapedIndicator = indicator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(?:^|\\s|[^a-zA-Z])${escapedIndicator}\\s*$`, 'i');
    if (pattern.test(beforeText)) {
      console.log(`[inferType] "${placeholderName}" → Date (STRONG context: "${indicator}")`);
      return { type: 'Date', label };
    }
  }

  // Check WEAK indicators - ONLY if placeholder looks like a date
  if (looksLikeDate(placeholderName)) {
    for (const indicator of weakDateIndicators) {
      const escapedIndicator = indicator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`(?:^|\\s|[^a-zA-Z])${escapedIndicator}\\s*$`, 'i');
      if (pattern.test(beforeText)) {
        console.log(`[inferType] "${placeholderName}" → Date (weak context "${indicator}" + date-like placeholder)`);
        return { type: 'Date', label };
      }
    }
  }

  // Date context indicators AFTER placeholder (only if placeholder looks date-like)
  const dateContextAfter = ['roku', 'měsíce', 'dní', 'year', 'month', 'day'];
  if (looksLikeDate(placeholderName)) {
    for (const indicator of dateContextAfter) {
      const pattern = new RegExp(`^\\s*${indicator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
      if (pattern.test(afterText)) {
        console.log(`[inferType] "${placeholderName}" → Date (context: "${indicator}" after)`);
        return { type: 'Date', label };
      }
    }
  }

  // Money context indicators
  const moneyContextAfter = [
    // Currencies
    'kč', 'czk', 'eur', 'usd', 'gbp', '€', '$', '£',
    'korun', 'euro', 'dolar',
    // Units
    '%', 'procent', 'percent',
    // Czech money phrases
    ',- kč', ',-kč', ',- czk',
  ];

  for (const indicator of moneyContextAfter) {
    const pattern = new RegExp(`^[\\s,.-]*${indicator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
    if (pattern.test(afterText)) {
      console.log(`[inferType] "${placeholderName}" → Money (context: "${indicator}" after)`);
      return { type: 'Money', label };
    }
  }

  const moneyContextBefore = ['částku', 'částka', 've výši', 'amount of', 'sum of', 'price of', 'hodnota', 'cena'];
  for (const indicator of moneyContextBefore) {
    if (beforeText.includes(indicator)) {
      console.log(`[inferType] "${placeholderName}" → Money (context: "${indicator}" before)`);
      return { type: 'Money', label };
    }
  }

  // ============================================================
  // PRIORITY 3: Placeholder NAME keywords (weaker than context)
  // ============================================================

  // Date indicators in name (but NOT if it's a _Header or _Addition field)
  const dateNameKeywords = ['date', 'datum', 'signed', 'signature'];
  if (dateNameKeywords.some(k => nameLower.includes(k)) && !nameLower.includes('_')) {
    return { type: 'Date', label };
  }

  // Money indicators in name
  // "Loan" CAN trigger Money, but context indicators above should have already
  // overridden if it's actually a date (e.g., "do {LoanTo}" = until date)
  const moneyNameKeywords = ['amount', 'value', 'price', 'cost', 'fee', 'payment', 'sum', 'loan', 'money', 'salary', 'wage', 'cena', 'částka', 'půjčka', 'úvěr'];
  if (moneyNameKeywords.some(k => nameLower.includes(k))) {
    return { type: 'Money', label };
  }

  // Select indicators (options, choices)
  const selectKeywords = ['option', 'choice', 'select', 'type'];
  if (selectKeywords.some(k => nameLower.includes(k))) {
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
function humanizeLabel(placeholderName: string): string {
  // Replace underscores with spaces
  let label = placeholderName.replace(/_/g, ' ');

  // Split CamelCase: "ContractNumber" → "Contract Number"
  label = label.replace(/([a-z])([A-Z])/g, '$1 $2');

  // Capitalize first letter of each word
  label = label.split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

  return label;
}


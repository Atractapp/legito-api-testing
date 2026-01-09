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

        // CRITICAL: Check if this match is a SUBSTRING of a larger highlighted region
        // e.g., pattern "Serie" should NOT match inside highlighted "Series"
        const isSubstringOfLargerHighlight = highlightedRegions.some((region) => {
          const patternStart = foundIndex;
          const patternEnd = foundIndex + originalText.length;
          return region.position.start <= patternStart &&
                 region.position.end > patternEnd &&
                 (region.position.end - region.position.start) > originalText.length;
        });

        if (isSubstringOfLargerHighlight) {
          console.log(`[Annotate] Skipping "${actualText}" at ${foundIndex} - it's a substring of a larger highlighted region`);
          searchPos = foundIndex + originalText.length;
          continue;
        }

        // TRAINED PATTERNS ARE ALWAYS MATCHED
        // The user explicitly trained this pattern - trust it!
        console.log(`[Annotate] Found TRAINED pattern "${actualText}" at position ${foundIndex} → ${pattern.annotatedText}`);

        suggestions.push({
          id: crypto.randomUUID(),
          originalText: actualText,
          annotatedText: pattern.annotatedText,
          type: pattern.annotationType,
          position: {
            start: foundIndex,
            end: foundIndex + originalText.length,
          },
          confidence: pattern.confidence,
          isAccepted: true,
          isEdited: false,
          isFromPattern: true, // Mark as from trained pattern
        });

        // Move past this match to find next occurrence
        searchPos = foundIndex + originalText.length;
      }
    }

    // 4. AUTO-DETECT common placeholder formats even without trained patterns
    // This catches {PlaceholderName}, [PlaceholderName], highlighted text, etc.
    const autoDetectedSuggestions = autoDetectPlaceholders(documentText, suggestions, highlightedRegions);
    suggestions.push(...autoDetectedSuggestions);
    console.log(`[Annotate] Auto-detected ${autoDetectedSuggestions.length} additional placeholders`);

    // DEBUG: Log all Serie/Series suggestions BEFORE dedup
    const serieBeforeDedup = suggestions.filter(s => s.originalText.includes('Serie'));
    if (serieBeforeDedup.length > 0) {
      console.log(`[DEBUG] Serie/Series suggestions BEFORE dedup (${serieBeforeDedup.length}):`);
      serieBeforeDedup.forEach((s, i) => {
        console.log(`  ${i + 1}. "${s.originalText}" at ${s.position.start}-${s.position.end} → ${s.annotatedText}`);
      });
    }

    // Sort by position
    suggestions.sort((a, b) => a.position.start - b.position.start);

    // Remove overlapping suggestions (keep higher confidence)
    const dedupedSuggestions = removeOverlappingSuggestions(suggestions);

    // DEBUG: Log Serie/Series suggestions AFTER dedup
    const serieAfterDedup = dedupedSuggestions.filter(s => s.originalText.includes('Serie'));
    if (serieAfterDedup.length > 0) {
      console.log(`[DEBUG] Serie/Series suggestions AFTER dedup (${serieAfterDedup.length}):`);
      serieAfterDedup.forEach((s, i) => {
        console.log(`  ${i + 1}. "${s.originalText}" at ${s.position.start}-${s.position.end} → ${s.annotatedText}`);
      });
    }

    // Note: We removed the overly restrictive final verification filter
    // Trained patterns are ALWAYS trusted - user explicitly taught them
    // Auto-detected suggestions have their own validation in autoDetectPlaceholders
    const verifiedSuggestions = dedupedSuggestions;

    console.log(`[Annotate] After dedup: ${verifiedSuggestions.length} suggestions`);

    // CRITICAL: Find duplicate occurrences of party-name-like placeholders
    // and add them as [Link] suggestions. This catches signature block party names
    // that are NOT highlighted but should still become links.
    const partyNameDuplicates = findPartyNameDuplicates(verifiedSuggestions, documentText);
    verifiedSuggestions.push(...partyNameDuplicates);
    console.log(`[Annotate] Found ${partyNameDuplicates.length} party name duplicates for linking`);

    // Re-sort by position after adding duplicates
    verifiedSuggestions.sort((a, b) => a.position.start - b.position.start);

    // Convert duplicate occurrences to [Link]
    // First occurrence of each original text stays as-is (TextInput, Select, Date, etc.)
    // Second+ occurrences become [Link] (user enters value once, rest auto-fill)
    // EXCEPTION: Signature blocks - dates/cities for different parties stay as new inputs
    const linkedSuggestions = convertDuplicatesToLinks(verifiedSuggestions, documentText);

    console.log(`[Annotate] Found ${suggestions.length} matches, after dedup: ${dedupedSuggestions.length}, verified: ${verifiedSuggestions.length}, after linking: ${linkedSuggestions.length}`);

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

/**
 * Find additional occurrences of party-name-like placeholders in the document.
 *
 * When we detect a placeholder like "Creditor's name" or "Debtor's name",
 * we should search the document for any other occurrences of that exact text
 * and add them as Link suggestions.
 *
 * This is especially important for signature blocks where the party names
 * often appear again but are NOT highlighted.
 */
function findPartyNameDuplicates(
  existingSuggestions: AnnotationSuggestion[],
  documentText: string
): AnnotationSuggestion[] {
  const duplicates: AnnotationSuggestion[] = [];

  // Get positions already covered by existing suggestions
  const coveredPositions = new Set<string>();
  for (const s of existingSuggestions) {
    for (let i = s.position.start; i < s.position.end; i++) {
      coveredPositions.add(String(i));
    }
  }

  // Find party-name-like suggestions
  const partyNamePatterns = [
    /\b(creditor|debtor|buyer|seller|lessor|lessee|landlord|tenant|employer|employee|borrower|lender|party|name)\b/i,
    /\bname\b/i,  // Generic "name" fields
  ];

  for (const suggestion of existingSuggestions) {
    // Only process TextInput suggestions that look like party names
    if (suggestion.type !== 'TextInput') continue;

    const originalText = suggestion.originalText;
    const isPartyName = partyNamePatterns.some(p => p.test(originalText));

    if (!isPartyName) continue;

    // Search for other occurrences of this exact text in the document
    const originalLower = originalText.toLowerCase();
    const documentLower = documentText.toLowerCase();

    let searchPos = 0;
    while (true) {
      const foundIndex = documentLower.indexOf(originalLower, searchPos);
      if (foundIndex === -1) break;

      // Skip if this position is already covered
      if (coveredPositions.has(String(foundIndex))) {
        searchPos = foundIndex + originalText.length;
        continue;
      }

      // Verify it's an exact word match (not part of another word)
      // NOTE: Underscores and other punctuation are valid boundaries (for signature lines like ___Name)
      const charBefore = foundIndex > 0 ? documentText[foundIndex - 1] : ' ';
      const charAfter = foundIndex + originalText.length < documentText.length
        ? documentText[foundIndex + originalText.length]
        : ' ';

      // Allow underscores as valid word boundaries (common in signature lines)
      const isWordBoundaryBefore = /[^a-zA-Z0-9]/.test(charBefore);
      const isWordBoundaryAfter = /[^a-zA-Z0-9]/.test(charAfter);

      if (!isWordBoundaryBefore || !isWordBoundaryAfter) {
        searchPos = foundIndex + originalText.length;
        continue;
      }

      // Get actual text at this position (preserving case)
      const actualText = documentText.slice(foundIndex, foundIndex + originalText.length);

      console.log(`[findPartyNameDuplicates] Found duplicate party name "${actualText}" at ${foundIndex}`);

      duplicates.push({
        id: crypto.randomUUID(),
        originalText: actualText,
        annotatedText: '[Textinput]', // Will be converted to [Link] by convertDuplicatesToLinks
        type: 'TextInput',
        position: {
          start: foundIndex,
          end: foundIndex + originalText.length,
        },
        confidence: 0.90,
        isAccepted: true,
        isEdited: false,
        isFromPattern: false,
      });

      // Mark these positions as covered
      for (let i = foundIndex; i < foundIndex + originalText.length; i++) {
        coveredPositions.add(String(i));
      }

      searchPos = foundIndex + originalText.length;
    }
  }

  return duplicates;
}

function convertDuplicatesToLinks(
  suggestions: AnnotationSuggestion[],
  documentText?: string
): AnnotationSuggestion[] {
  // Track which text values have been seen (for TextInput and title Select fields)
  // Dates, Money, Calculations should NOT become Links - they're independent entries
  const seenTextInputs = new Map<string, { count: number; firstAnnotation: string }>();
  const seenTitleSelects = new Map<string, { count: number; firstAnnotation: string }>();

  // Title/salutation Select patterns that SHOULD become Links on second occurrence
  // These represent a choice for the SAME person's salutation in different places
  // Note: Patterns without trailing period since we don't consume periods in detection
  const titleSelectPatterns = [
    'D/Dª',      // Spanish (without period - period is separate)
    'D/Dª.',     // Spanish (with period - for backward compatibility)
    'Mr/Ms',     // English (without period - period is separate)
    'Mr/Ms.',    // English (with period - for backward compatibility)
    'Herr/Frau', // German
    'Sr./Sra.',  // Spanish alternative
    'Sr/Sra',    // Spanish alternative (without period)
  ];

  // Track [date] placeholder occurrences (these CAN become Links, unlike DD.MM.YYYY)
  const seenDatePlaceholders = new Map<string, { count: number; firstAnnotation: string }>();

  return suggestions.map((suggestion) => {
    // RULE 1: Dates - distinguish between placeholders and date patterns
    // - [date] placeholder: duplicates SHOULD become Links (same field in different locations)
    // - DD.MM.YYYY pattern: never becomes Link (independent date entries)
    if (suggestion.type === 'Date') {
      const isBracketedDatePlaceholder = /^\[date\]$/i.test(suggestion.originalText);

      if (isBracketedDatePlaceholder) {
        // This is a [date] placeholder - treat like other placeholders
        const key = suggestion.originalText.toLowerCase();
        if (seenDatePlaceholders.has(key)) {
          // Second occurrence → Link
          console.log(`[convertDuplicatesToLinks] Converting duplicate [date] placeholder to [Link]`);
          return {
            ...suggestion,
            annotatedText: '[Link]',
            type: 'Link' as AnnotationType,
            confidence: Math.min(suggestion.confidence, 0.95),
          };
        } else {
          // First occurrence - keep as Date (or original)
          seenDatePlaceholders.set(key, { count: 1, firstAnnotation: suggestion.annotatedText });
          console.log(`[convertDuplicatesToLinks] First occurrence of [date] placeholder`);
          return suggestion;
        }
      }

      // Regular date pattern (DD.MM.YYYY, etc.) - never becomes Link
      console.log(`[convertDuplicatesToLinks] Keeping Date "${suggestion.originalText}" (dates never become links)`);
      return suggestion;
    }

    // RULE 2: Money and Calculation should NEVER become Links
    if (suggestion.type === 'Money' || suggestion.type === 'Calculation') {
      console.log(`[convertDuplicatesToLinks] Keeping ${suggestion.type} "${suggestion.originalText}" (never becomes link)`);
      return suggestion;
    }

    // RULE 3: Select - MOST should never become Links, BUT title salutations should
    // D/Dª., Mr/Ms., etc. represent the same person's salutation in multiple places
    if (suggestion.type === 'Select') {
      const isTitleSelect = titleSelectPatterns.some(p =>
        suggestion.originalText.includes(p) || suggestion.annotatedText.includes(p)
      );

      if (isTitleSelect) {
        const key = suggestion.originalText.toLowerCase();
        if (seenTitleSelects.has(key)) {
          // Second occurrence of title select → Link
          console.log(`[convertDuplicatesToLinks] Converting duplicate title Select "${suggestion.originalText}" to [Link]`);
          return {
            ...suggestion,
            annotatedText: '[Link]',
            type: 'Link' as AnnotationType,
            confidence: Math.min(suggestion.confidence, 0.95),
          };
        } else {
          // First occurrence
          seenTitleSelects.set(key, { count: 1, firstAnnotation: suggestion.annotatedText });
          console.log(`[convertDuplicatesToLinks] First occurrence of title Select "${suggestion.originalText}"`);
          return suggestion;
        }
      }

      // Non-title Select - never becomes Link
      return suggestion;
    }

    // RULE 4: For TextInput - check if it's a duplicate that should become Link
    // Only party names and similar references should become Links
    const originalLower = suggestion.originalText.toLowerCase();

    // Skip generic placeholders from becoming links (●, [X], etc.)
    if (isContextlessPlaceholder(suggestion.originalText)) {
      return suggestion;
    }

    // RULE 4b: Skip single digits from becoming links
    // These are usually episode numbers, season numbers, section numbers
    // e.g., "Season 1", "Article 2" - the "1" and "2" are NOT party references
    if (/^\d$/.test(suggestion.originalText.trim())) {
      console.log(`[convertDuplicatesToLinks] Keeping single digit "${suggestion.originalText}" (never becomes link)`);
      return suggestion;
    }

    if (seenTextInputs.has(originalLower)) {
      const seen = seenTextInputs.get(originalLower)!;
      seen.count++;

      // Check if this looks like a party name or reference field
      const isPartyNamePattern = /\b(name|creditor|debtor|buyer|seller|lessor|lessee|landlord|tenant|employer|employee)\b/i.test(originalLower);

      // Check if original was a bracketed placeholder like [company], [city], [name]
      // These should become [Link] on duplicate occurrences
      const isBracketPlaceholder = /^\[.+\]$/.test(suggestion.originalText);

      if (isPartyNamePattern || isBracketPlaceholder) {
        // Party name or bracket placeholder in duplicate occurrence → Link
        console.log(`[convertDuplicatesToLinks] Converting duplicate "${suggestion.originalText}" to [Link]`);
        return {
          ...suggestion,
          annotatedText: '[Link]',
          type: 'Link' as AnnotationType,
          confidence: Math.min(suggestion.confidence, 0.95),
        };
      }

      // Non-party TextInput duplicates stay as TextInput (e.g., "City" appears twice for different parties)
      // In signature blocks especially, duplicates like "City", "Date" are for DIFFERENT parties
      // and should remain as independent inputs, NOT links
      console.log(`[convertDuplicatesToLinks] Keeping duplicate "${suggestion.originalText}" as TextInput (not a party name)`);
      return suggestion;
    } else {
      // First occurrence
      seenTextInputs.set(originalLower, { count: 1, firstAnnotation: suggestion.annotatedText });
      console.log(`[convertDuplicatesToLinks] First occurrence of "${suggestion.originalText}"`);
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

  // Strip square brackets, curly braces, angle brackets from start and end
  // But KEEP parentheses - they're valid in instruction text like "(Outlines, treatments/Skripte)"
  trimmed = trimmed.replace(/^[\[\]{}<>]+/, '').replace(/[\[\]{}<>]+$/, '');
  // Also remove any remaining square/curly/angle brackets inside
  trimmed = trimmed.replace(/[\[\]{}<>]/g, '').trim();

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

  // Parenthesized numbers like (1), (2), (a) - these are section/list markers, not placeholders
  if (/^\(\d+\)$/.test(trimmed) || /^\([a-zA-Z]\)$/.test(trimmed)) return null;

  // Just punctuation
  if (/^[:\.,;!\?\-\s]+$/.test(trimmed)) return null;

  // Single character (unless it's a meaningful letter)
  if (trimmed.length === 1 && !/^[A-Za-z]$/.test(trimmed)) return null;

  // X's with dots (date patterns): XX.XX.XXXX, X.X.X
  if (/^[Xx]+([.\/-][Xx]+)+$/.test(trimmed)) return null;

  // For instruction text (contains "insert", "enter", etc.), keep the FULL label
  // Expected format: [Textinput: insert description of services – eg writing steps...]
  const instructionKeywords = ['insert', 'enter', 'fill in', 'fill out', 'specify', 'provide',
    'einfügen', 'eingeben', 'ausfüllen', 'angeben', // German
    'insertar', 'llenar', 'completar', // Spanish
  ];
  const isInstruction = instructionKeywords.some(kw =>
    trimmed.toLowerCase().includes(kw)
  );

  // If it's instruction text, keep the full label
  if (isInstruction) {
    return trimmed;
  }

  // For non-instruction long text (>5 words), try to extract from context
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
  // BUT: Only short bracketed text (< 100 chars) - long text is likely instructions
  if (/^[\[\{<].+[\]\}>]$/.test(trimmed) && trimmed.length < 100) {
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
  if (annotation.startsWith('[Textinput')) return 'TextInput';
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

  // Helper to check if ANY position in range is covered
  const isCovered = (pos: number) => coveredPositions.has(String(pos));

  // Helper to check if ANY position in a range is covered (for full overlap detection)
  const isRangeCovered = (start: number, end: number): boolean => {
    for (let i = start; i < end; i++) {
      if (coveredPositions.has(String(i))) return true;
    }
    return false;
  };

  // Helper to check if this region is a SUBSTRING of a larger existing suggestion
  const isSubstringOfExisting = (start: number, end: number): boolean => {
    return existingSuggestions.some((s) =>
      s.position.start <= start &&
      s.position.end >= end &&
      (s.position.end - s.position.start) > (end - start)
    );
  };

  // Helper to mark positions as covered
  const markCovered = (start: number, end: number) => {
    for (let i = start; i < end; i++) {
      coveredPositions.add(String(i));
    }
  };

  // =================================================================
  // PRIORITY 1: Calculation formulas (word*word) - MUST run FIRST
  // Before highlighted text processing to avoid "amount" being detected alone
  // IMPORTANT: Skip German gender-neutral asterisks like "Autor*in", "vom*von"
  // =================================================================
  const calcPattern = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\*\s*([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
  let match;

  // German gender-neutral patterns to skip - these are NOT calculations
  // IMPORTANT: Do NOT use word boundaries (\b) - compound words like "Autor*innenvertrag"
  // have more letters after "*in" and won't match with word boundary
  const germanGenderPatterns = [
    /\*in/i,        // Matches *in, *innen, *innenvertrag, *innenhonorar, etc.
    /vom\*von/i,    // vom*von
    /er\*sie/i,     // er*sie
    /ihm\*ihr/i,    // ihm*ihr
    /sein\*ihr/i,   // sein*ihr
  ];

  while ((match = calcPattern.exec(documentText)) !== null) {
    const fullMatch = match[0];
    const position = match.index;
    if (isCovered(position)) continue;

    // Skip German gender-neutral patterns
    const isGermanGender = germanGenderPatterns.some(p => p.test(fullMatch));
    if (isGermanGender) {
      console.log(`[autoDetect] Skipping German gender pattern: "${fullMatch}"`);
      continue;
    }

    console.log(`[autoDetect] PRIORITY: Found calculation "${fullMatch}" → [Calculation]`);

    detected.push({
      id: crypto.randomUUID(),
      originalText: fullMatch,
      annotatedText: '[Calculation]',
      type: 'Calculation',
      position: { start: position, end: position + fullMatch.length },
      confidence: 0.90,
      isAccepted: true,
      isEdited: false,
    });

    markCovered(position, position + fullMatch.length);
  }

  // =================================================================
  // PRIORITY 2: Slash-separated options (Select fields)
  // Must run before highlighted text to capture full phrases
  // IMPORTANT: Only detect REAL choice options, NOT:
  // - Compound words: "treatments/scripts", "and/or"
  // - Section headers: "Date/Term/Delivery"
  // - Common conjunctions: "und/oder", "a/nebo"
  // =================================================================

  // First: Detect known short title patterns like "Mr/Ms", "D/Dª."
  // IMPORTANT: Consume trailing periods to avoid doubling them
  // D/Dª. in origin → [Select: D/Dª.] (period inside annotation, consumed from origin)
  // Mr/Ms. in origin → [Select: Mr/Ms]. (period outside annotation - see special handling below)
  const titlePatterns = [
    { pattern: /\bMr\/Ms\.?/g, text: 'Mr/Ms', periodOutside: true },
    { pattern: /\bD\/Dª\.?/g, text: 'D/Dª.', periodOutside: false },
    { pattern: /\bHerr\/Frau/g, text: 'Herr/Frau', periodOutside: false },
    { pattern: /\bSr\.?\/Sra\.?/g, text: 'Sr./Sra.', periodOutside: false },
  ];

  for (const { pattern, text, periodOutside } of titlePatterns) {
    let titleMatch;
    while ((titleMatch = pattern.exec(documentText)) !== null) {
      const position = titleMatch.index;
      if (isCovered(position)) continue;

      // Check if the match included a trailing period
      const matchedText = titleMatch[0];
      const hadPeriod = matchedText.endsWith('.');

      // Build the annotation text
      let annotatedText: string;
      if (periodOutside && hadPeriod) {
        // Mr/Ms. → [Select: Mr/Ms]. (period outside bracket)
        annotatedText = `[Select: ${text}].`;
      } else {
        // D/Dª. → [Select: D/Dª.] (period inside, or no period)
        annotatedText = `[Select: ${text}]`;
      }

      console.log(`[autoDetect] PRIORITY: Found title options "${matchedText}" → ${annotatedText}`);

      detected.push({
        id: crypto.randomUUID(),
        originalText: matchedText,
        annotatedText,
        type: 'Select',
        position: { start: position, end: position + matchedText.length },
        confidence: 0.90,
        isAccepted: true,
        isEdited: false,
      });

      markCovered(position, position + matchedText.length);
    }
  }

  // Second: Detect phrase-level options like "by a bank transfer/in cash"
  // BUT be very selective - skip common conjunctions and compound words
  const skipSlashPatterns = [
    /\band\/or\b/i,                    // common conjunction
    /\bund\/oder\b/i,                  // German conjunction
    /\ba\/nebo\b/i,                    // Czech conjunction
    /\btreatments\/scripts?\b/i,       // compound alternatives (scripts or Skripte)
    /\btreatments\/skripte\b/i,        // German compound (explicit)
    /\boutlines\/treatments\b/i,       // compound alternatives
    /\brevisions\/drafts\b/i,          // compound alternatives
    /\bnumber\s+of\s+\w+\/\w+/i,       // "number of X/Y" phrases
    /\b\w+\/\w+\s+steps\b/i,          // "xxx/yyy steps"
    /\b\w+\/instructions\b/i,          // "xxx/instructions"
    /\bdate\/term\/delivery\b/i,       // section header
    /\bstartdatum\/laufzeit\b/i,       // German section header
    /\blieferzeit\/timeline\b/i,       // German compound
    /\bänderungen\/entwürfe\b/i,       // German compound
    /\bder\s+änderungen\/entwürfe\b/i, // German compound with article
    /\bepisoden\b/i,                   // part of longer phrase
    /\bneúčinným\b/i,                  // Czech legal text
    /writing\s+steps/i,                // "writing steps" in same context
    // Marketing/PR and synonyms (these are NOT choices, they're equivalent terms)
    /\bmarketing\/pr\b/i,              // Marketing/PR - synonym pair
    /\bmarketing-\/pr-/i,              // German: Marketing-/PR-Anforderungen
    /\bpromotional\/publicity\b/i,     // promotional/publicity - synonym pair
    /\bepk\/marketing\b/i,             // EPK/marketing campaign
    /\bwerbe-\/promotion/i,            // German: Werbe-/Promotionaktivitäten
  ];

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
      // Check if this matches any skip pattern
      const shouldSkip = skipSlashPatterns.some(p => p.test(fullMatch));
      if (shouldSkip) {
        console.log(`[autoDetect] Skipping non-option slash pattern: "${fullMatch}"`);
        slashIdx++;
        continue;
      }

      // NOTE: Context-aware synonym detection would require AI analysis
      // For now, "/" separator = Select as the default behavior
      // User can manually correct synonyms like "Marketing/PR" to not be Select

      const maxLen = Math.max(...options.map(o => o.length));
      const minLen = Math.min(...options.map(o => o.length));
      const isBalanced = maxLen <= 40 && minLen >= 2 && maxLen / minLen < 10;

      // Skip dates
      const noSpaces = fullMatch.replace(/\s/g, '');
      const isDate = /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(noSpaces) ||
                    /^[XxDdMmYy]{1,4}\/[XxDdMmYy]{1,4}\/[XxDdMmYy]{2,4}$/.test(noSpaces);

      if (isBalanced && !isDate && !isRangeCovered(start, end)) {
        console.log(`[autoDetect] PRIORITY: Found slash options "${fullMatch}" → [Select: ${fullMatch}]`);

        detected.push({
          id: crypto.randomUUID(),
          originalText: fullMatch,
          annotatedText: `[Select: ${fullMatch}]`,
          type: 'Select',
          position: { start, end },
          confidence: 0.85,
          isAccepted: true,
          isEdited: false,
        });

        markCovered(start, end);
        slashIdx = end;
        continue;
      }
    }
    slashIdx++;
  }

  // =================================================================
  // PRIORITY 3: XXX placeholder handling (context-aware)
  // MUST run BEFORE highlighted text processing to handle XXX properly
  // XXX can mean different things based on context:
  // - XXX EUR → [Money] (include the currency)
  // - XXX % → [Textinput] (percentage, needs to be filled)
  // - XXX. (end of sentence) → stay as XXX (static placeholder, don't annotate)
  // - Highlighted XXX → process based on context
  // =================================================================
  const xxxPattern = /\bXXX\b/g;
  while ((match = xxxPattern.exec(documentText)) !== null) {
    const position = match.index;
    if (isCovered(position)) continue;

    const contextAfter = documentText.slice(position + 3, position + 20);

    // Check what follows XXX
    const currencyMatch = contextAfter.match(/^\s*(EUR|USD|CZK|GBP|CHF|€|\$|£|Kč)\b/i);
    const percentMatch = contextAfter.match(/^\s*%/);
    const endOfSentence = contextAfter.match(/^\s*[.,;:!?\n]/);

    // Check if this XXX is highlighted
    const xxxIsHighlighted = highlightedRegions.some((r) =>
      r.position.start <= position && r.position.end >= position + 3
    );

    if (currencyMatch) {
      // XXX EUR → [Money] (include the currency in the replacement)
      const fullLength = 3 + currencyMatch[0].length;
      const fullMatch = documentText.slice(position, position + fullLength);
      console.log(`[autoDetect] PRIORITY: Found XXX with currency "${fullMatch}" → [Money]`);

      detected.push({
        id: crypto.randomUUID(),
        originalText: fullMatch,
        annotatedText: '[Money]',
        type: 'Money',
        position: { start: position, end: position + fullLength },
        confidence: 0.95,
        isAccepted: true,
        isEdited: false,
      });

      markCovered(position, position + fullLength);
    } else if (percentMatch) {
      // XXX % → [Textinput] (percentage that needs to be filled)
      // Only include the XXX, leave % visible
      console.log(`[autoDetect] PRIORITY: Found XXX % (percentage) → [Textinput]`);

      detected.push({
        id: crypto.randomUUID(),
        originalText: 'XXX',
        annotatedText: '[Textinput]',
        type: 'TextInput',
        position: { start: position, end: position + 3 },
        confidence: 0.90,
        isAccepted: true,
        isEdited: false,
      });

      markCovered(position, position + 3);
    } else if (endOfSentence) {
      // XXX at end of sentence (followed by period) → static placeholder, don't annotate
      // This applies regardless of highlighting - it's a fixed value, not fillable
      console.log(`[autoDetect] PRIORITY: Skipping standalone XXX at end of sentence`);
      // Mark as covered so highlighted text processing doesn't pick it up
      markCovered(position, position + 3);
    } else if (xxxIsHighlighted) {
      // Highlighted XXX without specific context → default to [Money]
      console.log(`[autoDetect] PRIORITY: Found highlighted XXX (no specific context) → [Money]`);

      detected.push({
        id: crypto.randomUUID(),
        originalText: 'XXX',
        annotatedText: '[Money]',
        type: 'Money',
        position: { start: position, end: position + 3 },
        confidence: 0.85,
        isAccepted: true,
        isEdited: false,
      });

      markCovered(position, position + 3);
    } else {
      // Non-highlighted XXX without specific context → skip, let it stay as XXX
      console.log(`[autoDetect] PRIORITY: Skipping non-highlighted XXX: "${documentText.slice(position, position + 10)}..."`);
    }
  }

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
    console.log(`[autoDetect] Processing highlighted region: "${region.text}" at ${region.position.start}-${region.position.end}`);

    // Check if ANY part of this region is already covered
    if (isRangeCovered(region.position.start, region.position.end)) {
      console.log(`[autoDetect] Skipping - range ${region.position.start}-${region.position.end} overlaps with existing`);
      continue;
    }

    // Check if this region is a substring of an existing larger suggestion
    if (isSubstringOfExisting(region.position.start, region.position.end)) {
      console.log(`[autoDetect] Skipping - region "${region.text}" is substring of a larger existing annotation`);
      continue;
    }

    let text = region.text.trim();
    let position = { ...region.position };

    // CRITICAL: Verify the position is correct by checking actual text at position
    const actualTextAtPosition = documentText.slice(position.start, position.end);
    if (actualTextAtPosition !== region.text && !actualTextAtPosition.includes(region.text.trim())) {
      console.log(`[autoDetect] POSITION MISMATCH: expected "${region.text}" but found "${actualTextAtPosition}" at ${position.start}-${position.end}`);
      // Try to find the correct position
      const correctPos = documentText.indexOf(region.text, Math.max(0, position.start - 50));
      if (correctPos !== -1 && correctPos < position.start + 50) {
        console.log(`[autoDetect] Found correct position at ${correctPos}`);
        position.start = correctPos;
        position.end = correctPos + region.text.length;
      } else {
        console.log(`[autoDetect] Could not find correct position, skipping`);
        continue;
      }
    }

    // Skip empty text
    if (!text) continue;

    // SKIP common English words that are NOT placeholders even if highlighted
    // These are regular document text, not fillable fields
    const commonWordsToSkip = ['amount', 'total', 'the', 'and', 'or', 'of', 'in', 'on', 'at', 'by', 'for', 'to', 'from', 'with'];
    if (commonWordsToSkip.includes(text.toLowerCase())) {
      console.log(`[autoDetect] Skipping common word: "${text}"`);
      continue;
    }

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

    // SKIP if text already contains annotation markers (prevents nested [Textinput: [Textinput:]])
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

    // CHECK: Handle various partial bracket scenarios
    // Case 1: Inner content highlighted (e.g., "X" in "[X]") - expand both sides
    // Case 2: Content + closing bracket highlighted (e.g., "XX]" from "[XX]") - expand opening
    // Case 3: Opening bracket + content highlighted (e.g., "[XX" from "[XX]") - expand closing
    const charBefore = documentText.charAt(position.start - 1);
    const charAfter = documentText.charAt(position.end);

    // Case 1: Only inner content highlighted, both brackets are outside
    if ((charBefore === '[' && charAfter === ']') ||
        (charBefore === '{' && charAfter === '}') ||
        (charBefore === '<' && charAfter === '>') ||
        (charBefore === '(' && charAfter === ')')) {
      position.start -= 1;
      position.end += 1;
      text = documentText.slice(position.start, position.end);
      console.log(`[autoDetect] Expanded highlighted region to include brackets: "${text}"`);
    }
    // Case 2: Text ends with ] but opening [ is before - include opening bracket
    else if (charBefore === '[' && text.endsWith(']')) {
      position.start -= 1;
      text = documentText.slice(position.start, position.end);
      console.log(`[autoDetect] Expanded to include opening bracket: "${text}"`);
    }
    // Case 3: Text starts with [ but closing ] is after - include closing bracket
    else if (text.startsWith('[') && charAfter === ']') {
      position.end += 1;
      text = documentText.slice(position.start, position.end);
      console.log(`[autoDetect] Expanded to include closing bracket: "${text}"`);
    }
    // Same for curly braces
    else if (charBefore === '{' && text.endsWith('}')) {
      position.start -= 1;
      text = documentText.slice(position.start, position.end);
      console.log(`[autoDetect] Expanded to include opening brace: "${text}"`);
    }
    else if (text.startsWith('{') && charAfter === '}') {
      position.end += 1;
      text = documentText.slice(position.start, position.end);
      console.log(`[autoDetect] Expanded to include closing brace: "${text}"`);
    }
    // Case 4: Partial X pattern highlighted (e.g., just "X" from "[XX]")
    // Need to find and include the full bracket pattern
    else if (charBefore === '[' && /^[Xx]+$/.test(text)) {
      // Find the closing ] after any remaining X's
      let expandEnd = position.end;
      while (expandEnd < documentText.length && /[Xx]/.test(documentText.charAt(expandEnd))) {
        expandEnd++;
      }
      if (documentText.charAt(expandEnd) === ']') {
        position.start -= 1; // Include opening [
        position.end = expandEnd + 1; // Include closing ]
        text = documentText.slice(position.start, position.end);
        console.log(`[autoDetect] Expanded X pattern to include full brackets: "${text}"`);
      }
    }
    // Case 5: Text is X pattern followed by ] but opening [ is further back
    else if (/^[Xx]+\]$/.test(text) && charBefore !== '[') {
      // Look back for opening [
      let searchPos = position.start - 1;
      while (searchPos >= 0 && /[Xx]/.test(documentText.charAt(searchPos))) {
        searchPos--;
      }
      if (documentText.charAt(searchPos) === '[') {
        position.start = searchPos;
        text = documentText.slice(position.start, position.end);
        console.log(`[autoDetect] Expanded X pattern to include opening bracket: "${text}"`);
      }
    }

    // Count words in highlighted text
    const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;

    // Note: Long instruction text like "[insert description of services...]" SHOULD be annotated
    // The hasInstruction check below will ensure they get proper labels

    // Check if it's an instruction to fill (should annotate)
    // IMPORTANT: Use word boundary matching to avoid false positives
    // e.g., "add" should NOT match "addition" in legal text
    // Include German instruction keywords
    const instructionKeywords = [
      'insert', 'enter', 'fill in', 'fill out', 'specify', 'indicate', 'provide', 'add', 'write', 'type',
      'einfügen', 'eingeben', 'ausfüllen', 'angeben', 'hinzufügen', // German
      'insertar', 'llenar', 'completar', // Spanish
    ];
    const textLower = text.toLowerCase();
    const hasInstruction = instructionKeywords.some(kw => {
      // Use word boundary regex to match whole words only
      const regex = new RegExp(`\\b${kw}\\b`, 'i');
      return regex.test(textLower);
    });

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
      annotatedText = meaningfulLabel ? `[Textinput: ${meaningfulLabel}]` : '[Textinput]';
    }

    // VALIDATION: Don't create nested annotations
    // If originalText already contains annotation markers, skip
    if (/\[(TextInput|Date|Money|Select|Link)/i.test(text)) {
      console.log(`[autoDetect] Skipping - text already contains annotation: "${text.slice(0, 50)}"`);
      continue;
    }

    // VALIDATION: Don't annotate if text matches annotation pattern itself
    if (/^\[(Textinput|Date|Money|Select|Link|Number|Checkbox|Calculation)[:\]]/.test(text)) {
      console.log(`[autoDetect] Skipping - text IS an annotation: "${text}"`);
      continue;
    }

    // Note: Parenthesized numbers like (2) CAN be placeholders for editable values
    // The getMeaningfulLabel function will return null for them, so they become [Textinput] without label

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
      annotatedText = `[Textinput: ${label}]`;
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
  // Pattern 1.5: <<PlaceholderName>> - angle bracket placeholders
  // Common in legal templates: <<Borrower>>, <<Loan Amount>>, etc.
  // =================================================================
  const angleBracketPattern = /<<([^<>]+)>>/g;

  while ((match = angleBracketPattern.exec(documentText)) !== null) {
    const fullMatch = match[0];
    const placeholderName = match[1].trim();
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
      annotatedText = `[Textinput: ${label}]`;
    }

    console.log(`[autoDetect] Found <<placeholder>> "${fullMatch}" → ${annotatedText}`);

    detected.push({
      id: crypto.randomUUID(),
      originalText: fullMatch,
      annotatedText,
      type,
      position: { start: position, end: position + fullMatch.length },
      confidence: 0.90, // High confidence for explicit template markers
      isAccepted: true,
      isEdited: false,
    });

    markCovered(position, position + fullMatch.length);
  }

  // =================================================================
  // Pattern 2: Underscores ____________ (5+ underscores = blank field)
  // BUT: Skip standalone signature lines (just underscores on a line)
  // REQUIRES: Either highlighting OR a label before (like "Name: _____")
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

    // Check if these underscores are highlighted
    const isHighlighted = highlightedRegions.some((r) =>
      r.position.start <= position && r.position.end >= position + fullMatch.length
    );

    // Try to find a label before the underscores
    // Patterns: "Name: _____", "City _____", "Amount: _____"
    const labelMatch = contextBefore.match(/([A-Za-z][A-Za-z\s]{2,20})[:.]?\s*$/);
    const label = labelMatch ? labelMatch[1].trim() : null;

    // REQUIRE: Either highlighted OR has a label
    // If neither, skip - it's likely a standalone fill-in line without context
    if (!label && !isHighlighted) {
      console.log(`[autoDetect] Skipping underscores "${fullMatch}" - no label and not highlighted`);
      continue;
    }

    // Infer type from label and context
    const { type } = inferAnnotationFromPlaceholderName(label || '', contextBefore, contextAfter);

    let annotatedText: string;
    if (type === 'Date') {
      annotatedText = '[Date]';
    } else if (type === 'Money') {
      annotatedText = '[Money]';
    } else if (label) {
      annotatedText = `[Textinput: ${label}]`;
    } else {
      // Highlighted but no label - generic TextInput
      annotatedText = '[Textinput]';
    }

    console.log(`[autoDetect] Found underscores "${fullMatch}" → ${annotatedText} (label: "${label || 'none'}", highlighted: ${isHighlighted})`);

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
  // Also matches longer instruction text like [insert description of services...]
  // =================================================================
  const bracketPattern = /\[([^\[\]]{1,300})\]/g;

  while ((match = bracketPattern.exec(documentText)) !== null) {
    const fullMatch = match[0];
    const content = match[1];
    const position = match.index;

    if (isCovered(position)) continue;

    // Also check if the INNER content is covered (handles case where [X] has X highlighted)
    // position+1 is the start of content inside brackets
    if (isCovered(position + 1)) {
      console.log(`[autoDetect] Skipping [bracket] "${fullMatch}" - inner content already covered`);
      continue;
    }

    // Skip if it looks like an existing annotation [Textinput: X], [Date], etc.
    // IMPORTANT: Case-SENSITIVE check - [Date] is an annotation, [date] is a placeholder
    // Annotations use PascalCase: TextInput, Date, Money, Link, Select, Calculation
    // Placeholders from origin files often use lowercase: [date], [name], [company]
    if (/^(TextInput|Textinput|Date|Money|Link|Select|Calculation|Number|Checkbox)/.test(content)) {
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
      annotatedText = meaningfulLabel ? `[Textinput: ${meaningfulLabel}]` : '[Textinput]';
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

  // =================================================================
  // Pattern 5: Bullet points as placeholders (●, •, ○)
  // =================================================================
  const bulletPattern = /[●•○◦]/g;
  while ((match = bulletPattern.exec(documentText)) !== null) {
    const position = match.index;
    if (isCovered(position)) continue;

    console.log(`[autoDetect] Found bullet placeholder "${match[0]}" → [Textinput]`);

    detected.push({
      id: crypto.randomUUID(),
      originalText: match[0],
      annotatedText: '[Textinput]',
      type: 'TextInput',
      position: { start: position, end: position + 1 },
      confidence: 0.85,
      isAccepted: true,
      isEdited: false,
    });

    markCovered(position, position + 1);
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
    'due by', 'signed on', 'executed on', 'starting on', 'ending on',
    'commencing on', 'beginning on',
    // "until" alone is a strong date indicator when followed by a blank field
    'until', 'through', 'till',
    // German date indicators
    'bis zum', 'bis', 'vom', 'ab dem', 'zum', 'vor dem',
    // Spanish
    'el día', 'fecha', 'hasta', 'desde',
  ];

  // WEAK date indicators - only apply if placeholder looks like a date
  // Words like "by", "on", "from" are too generic alone
  const weakDateIndicators = [
    'do', 'od', 'on', 'by', 'from', 'effective',
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
  const dateNameKeywords = ['date', 'datum', 'signed', 'signature'];
  if (dateNameKeywords.some(k => nameLower.includes(k)) && !nameLower.includes('_')) {
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

  const moneyNameKeywords = ['value', 'price', 'cost', 'fee', 'payment', 'sum', 'loan', 'money', 'salary', 'wage', 'cena', 'částka', 'půjčka', 'úvěr'];
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

  // PRESERVE original case - don't force capitalize
  // This keeps "Creditor's name" as-is instead of "Creditor's Name"
  return label.trim();
}


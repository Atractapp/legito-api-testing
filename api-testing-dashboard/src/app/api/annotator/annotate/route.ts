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
    console.log(`[Annotate] Document parsed, ${parsed.text.length} characters`);

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

        console.log(`[Annotate] Found "${actualText}" at position ${foundIndex} → ${pattern.annotatedText}`);

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

        // Move past this match to find next occurrence
        searchPos = foundIndex + originalText.length;
      }
    }

    // 4. AUTO-DETECT common placeholder formats even without trained patterns
    // This catches {PlaceholderName}, [PlaceholderName], etc. that haven't been trained
    const autoDetectedSuggestions = autoDetectPlaceholders(documentText, suggestions);
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
function convertDuplicatesToLinks(
  suggestions: AnnotationSuggestion[],
  documentText?: string
): AnnotationSuggestion[] {
  // Track which original texts have been seen (case-insensitive)
  const seenOriginalTexts = new Map<string, { count: number; firstAnnotation: string }>();

  return suggestions.map((suggestion) => {
    const key = suggestion.originalText.toLowerCase();

    // Check if this is in a signature block context (different party signatures)
    const isSignatureBlock = documentText ? isInSignatureBlock(documentText, suggestion.position.start) : false;

    if (seenOriginalTexts.has(key)) {
      const seen = seenOriginalTexts.get(key)!;
      seen.count++;

      // EXCEPTION: Keep as new input if in signature block AND it's a date/city
      // This handles cases like multiple "V Praze dne DD.MM.YYYY" for different parties
      if (isSignatureBlock && (suggestion.type === 'Date' || isLikelySignatureField(suggestion))) {
        console.log(`[convertDuplicatesToLinks] Keeping "${suggestion.originalText}" as new input (signature block context)`);
        return suggestion;
      }

      // This is a DUPLICATE - convert to [Link]
      console.log(`[convertDuplicatesToLinks] Converting duplicate "${suggestion.originalText}" to [Link] (was ${suggestion.annotatedText})`);

      return {
        ...suggestion,
        annotatedText: '[Link]',
        type: 'Link' as AnnotationType,
        // Slightly lower confidence for auto-linked fields
        confidence: Math.min(suggestion.confidence, 0.95),
      };
    } else {
      // FIRST occurrence - keep original type
      seenOriginalTexts.set(key, { count: 1, firstAnnotation: suggestion.annotatedText });
      console.log(`[convertDuplicatesToLinks] First occurrence of "${suggestion.originalText}" → ${suggestion.annotatedText}`);
      return suggestion;
    }
  });
}

/**
 * Check if a position in the document is within a signature block.
 * Signature blocks typically contain patterns like:
 * - "V Praze dne" / "V ... dne" (Czech)
 * - "In City, on" / "In ..., on" (English)
 * - Underscores followed by name (e.g., "____Creditor's name")
 * - Near the end of the document
 * - After phrases like "podpis", "signature", "za společnost"
 */
function isInSignatureBlock(documentText: string, position: number): boolean {
  // Get context around position (500 chars before, 200 after)
  const contextStart = Math.max(0, position - 500);
  const contextEnd = Math.min(documentText.length, position + 200);
  const contextBefore = documentText.slice(contextStart, position).toLowerCase();
  const contextAfter = documentText.slice(position, contextEnd).toLowerCase();
  const fullContext = contextBefore + contextAfter;

  // Signature block indicators
  const signatureIndicators = [
    // Czech
    'v praze dne', 'v brně dne', 'v ostravě dne', 'v městě', 'dne',
    'podpis', 'podepsal', 'za společnost', 'za stranu', 'jménem',
    'výtisk pro', 'originál', 'věřitel', 'dlužník', 'pronajímatel', 'nájemce',
    // English
    'signed', 'signature', 'in witness', 'executed', 'by:', 'for and on behalf',
    'creditor', 'debtor', 'landlord', 'tenant', 'buyer', 'seller', 'lender', 'borrower',
    // Spanish
    'firma', 'firmado', 'en nombre de',
  ];

  // Check if any signature indicator is in recent context
  const recentContextBefore = contextBefore.slice(-300); // Last 300 chars before position
  for (const indicator of signatureIndicators) {
    if (recentContextBefore.includes(indicator) || contextAfter.includes(indicator)) {
      return true;
    }
  }

  // Check for "In City, on" pattern (English signature block format)
  // Pattern: "In [Word], on" where Word could be City, Location name, etc.
  const inCityOnPattern = /in\s+\w+,?\s+on\b/i;
  if (inCityOnPattern.test(fullContext)) {
    return true;
  }

  // Check for underscore signature lines nearby (___Name, ____Title)
  const underscoreNamePattern = /_{3,}\s*[a-zA-Z]/;
  if (underscoreNamePattern.test(fullContext)) {
    return true;
  }

  // Also check if we're in the last 25% of the document (common signature area)
  const positionRatio = position / documentText.length;
  if (positionRatio > 0.75) {
    // Additional check: look for signature-like patterns nearby
    const nearEnd = documentText.slice(Math.max(0, position - 200), Math.min(documentText.length, position + 200)).toLowerCase();
    if (nearEnd.includes('dne') || nearEnd.includes('podpis') || nearEnd.includes('signature') ||
        nearEnd.includes(', on') || nearEnd.includes('name') || nearEnd.includes('jméno')) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a suggestion is likely a signature-related field (city, date for signing)
 * These fields should remain as NEW inputs in signature blocks, not become Links.
 */
function isLikelySignatureField(suggestion: AnnotationSuggestion): boolean {
  const originalLower = suggestion.originalText.toLowerCase();
  const annotatedLower = suggestion.annotatedText.toLowerCase();

  // Check for city/place indicators in annotation
  const cityIndicators = ['city', 'place', 'město', 'místo', 'location', 'town', 'prague', 'brno', 'praha'];
  if (cityIndicators.some(ind => annotatedLower.includes(ind))) {
    return true;
  }

  // Check if original text IS the word "city" or a known city placeholder
  const cityOriginalPatterns = ['city', 'místo', 'město', 'v praze', 'v brně'];
  if (cityOriginalPatterns.some(pat => originalLower === pat || originalLower.includes(pat))) {
    return true;
  }

  // Check for signature date patterns
  if (suggestion.type === 'Date') {
    return true;
  }

  // Check original text patterns for date-like placeholders
  // e.g., DD.MM.YYYY, XX.XX.XXXX, dd/mm/yyyy
  if (/^(dd|mm|yy|yyyy|xx|\.|\-|\/)+$/i.test(originalLower.replace(/[.\/-\s]/g, ''))) {
    return true;
  }

  // Check for explicit date patterns
  if (/dd\.?mm\.?yy/i.test(originalLower) || /xx\.?xx\.?xx/i.test(originalLower)) {
    return true;
  }

  return false;
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
  existingSuggestions: AnnotationSuggestion[]
): AnnotationSuggestion[] {
  const detected: AnnotationSuggestion[] = [];

  // Get positions already covered by pattern-matched suggestions
  const coveredPositions = new Set<string>();
  for (const s of existingSuggestions) {
    for (let i = s.position.start; i < s.position.end; i++) {
      coveredPositions.add(String(i));
    }
  }

  // Pattern 1: {PlaceholderName} - curly brace placeholders (Legito/template style)
  // Match {Word}, {WordWord}, {Word_Word}, {WordNumber}, etc.
  const curlyBracePattern = /\{([A-Za-z][A-Za-z0-9_]*)\}/g;
  let match;

  while ((match = curlyBracePattern.exec(documentText)) !== null) {
    const fullMatch = match[0];      // e.g., "{ContractNumber}"
    const placeholderName = match[1]; // e.g., "ContractNumber"
    const position = match.index;

    // Skip if already covered by a pattern match
    if (coveredPositions.has(String(position))) {
      continue;
    }

    // Get surrounding context for smarter type inference
    const contextBefore = documentText.slice(Math.max(0, position - 150), position);
    const contextAfter = documentText.slice(position + fullMatch.length, position + fullMatch.length + 150);

    // Infer annotation type and label from placeholder name AND context
    const { type, label } = inferAnnotationFromPlaceholderName(placeholderName, contextBefore, contextAfter);

    // Create annotation text
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

    console.log(`[autoDetect] Found placeholder "${fullMatch}" → ${annotatedText} (inferred from name)`);

    detected.push({
      id: crypto.randomUUID(),
      originalText: fullMatch,
      annotatedText,
      type,
      position: {
        start: position,
        end: position + fullMatch.length,
      },
      confidence: 0.85, // Slightly lower confidence for auto-detected
      isAccepted: true,
      isEdited: false,
    });
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
  // PRIORITY 1: Check for _Header suffix - always TextInput
  // These are template structure fields, not data fields
  // ============================================================
  if (nameLower.endsWith('_header') || nameLower.includes('_header')) {
    return { type: 'TextInput', label };
  }

  // ============================================================
  // PRIORITY 2: Strong CONTEXT indicators (override name inference)
  // ============================================================

  // Date context indicators (words that strongly suggest a date follows)
  const dateContextBefore = [
    // Czech
    'do', 'od', 'dne', 'dňa', 'ze dne', 'ke dni', 'v den', 'den', 'datum',
    'platnosti do', 'účinnosti do', 'termín', 'lhůta', 'doba do', 'platné do',
    'uzavřena dne', 'podepsáno dne', 'v praze dne', 'dnem',
    // English
    'on', 'by', 'until', 'from', 'dated', 'as of', 'effective', 'valid until',
    'expires on', 'due by', 'signed on',
    // Spanish
    'el día', 'fecha', 'hasta el', 'desde el',
  ];

  // Check if any date context word appears RIGHT BEFORE the placeholder
  for (const indicator of dateContextBefore) {
    // Check if indicator appears at the end of context (right before placeholder)
    const pattern = new RegExp(`${indicator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i');
    if (pattern.test(beforeText)) {
      console.log(`[inferType] "${placeholderName}" → Date (context: "${indicator}" before)`);
      return { type: 'Date', label };
    }
  }

  // Date context indicators AFTER placeholder
  const dateContextAfter = ['roku', 'měsíce', 'dní', 'year', 'month', 'day'];
  for (const indicator of dateContextAfter) {
    const pattern = new RegExp(`^\\s*${indicator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
    if (pattern.test(afterText)) {
      console.log(`[inferType] "${placeholderName}" → Date (context: "${indicator}" after)`);
      return { type: 'Date', label };
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


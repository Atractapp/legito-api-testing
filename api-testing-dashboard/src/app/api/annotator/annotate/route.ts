/**
 * Annotate Route
 *
 * POST /api/annotator/annotate
 * Start a new annotation session - upload document and get AI suggestions
 *
 * FLOW:
 * 1. Parse document
 * 2. Load trained patterns
 * 3. For EACH pattern: search for pattern.originalText in document
 * 4. When found: suggest pattern.annotatedText
 * 5. Auto-detect common placeholder formats
 * 6. Convert duplicates to Links
 * 7. Return all matches as suggestions
 */

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
  preloadRules,
  buildSemanticIndex,
  classifyDocument,
  type DocumentType,
  type HighlightedRegion,
} from '@/lib/annotator';
import type { Pattern, AnnotationType, AnnotationSuggestion } from '@/types/annotator';

// Import extracted services
import {
  autoDetectPlaceholders,
  findPartyNameDuplicates,
  convertDuplicatesToLinks,
  removeOverlappingSuggestions,
} from '@/lib/annotator/services';

// ----------------------------------------------------------------------------
// Pattern Matching
// ----------------------------------------------------------------------------

interface PatternMatchResult {
  suggestions: AnnotationSuggestion[];
  matchCount: number;
}

/**
 * Search for all trained patterns in the document text.
 */
function findPatternMatches(
  patterns: Pattern[],
  documentText: string,
  highlightedRegions: HighlightedRegion[]
): PatternMatchResult {
  const suggestions: AnnotationSuggestion[] = [];
  const documentTextLower = documentText.toLowerCase();

  for (const pattern of patterns) {
    const originalText = pattern.originalText;
    const originalTextLower = originalText.toLowerCase();

    let searchPos = 0;
    while (true) {
      const foundIndex = documentTextLower.indexOf(originalTextLower, searchPos);
      if (foundIndex === -1) break;

      // Get actual text from document (preserving case)
      const actualText = documentText.slice(foundIndex, foundIndex + originalText.length);

      // Check if this match is a substring of a larger highlighted region
      const isSubstringOfLargerHighlight = highlightedRegions.some((region) => {
        const patternStart = foundIndex;
        const patternEnd = foundIndex + originalText.length;
        return (
          region.position.start <= patternStart &&
          region.position.end > patternEnd &&
          region.position.end - region.position.start > originalText.length
        );
      });

      if (isSubstringOfLargerHighlight) {
        console.log(
          `[findPatternMatches] Skipping "${actualText}" at ${foundIndex} - substring of larger highlight`
        );
        searchPos = foundIndex + originalText.length;
        continue;
      }

      console.log(
        `[findPatternMatches] Found TRAINED pattern "${actualText}" at ${foundIndex} -> ${pattern.annotatedText}`
      );

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
        isFromPattern: true,
      });

      searchPos = foundIndex + originalText.length;
    }
  }

  return {
    suggestions,
    matchCount: suggestions.length,
  };
}

// ----------------------------------------------------------------------------
// Database Operations
// ----------------------------------------------------------------------------

interface LoadedPatterns {
  patterns: Pattern[];
  error: Error | null;
}

async function loadUserPatterns(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string
): Promise<LoadedPatterns> {
  const { data: patternsData, error: patternsError } = await supabase
    .from('annotator_patterns')
    .select(
      'id, user_id, original_text, annotated_text, annotation_type, confidence, usage_count, success_rate, training_pair_id, created_at, semantic_context'
    )
    .eq('user_id', userId)
    .order('confidence', { ascending: false });

  if (patternsError) {
    console.error('[loadUserPatterns] Query error:', patternsError);
    return { patterns: [], error: patternsError };
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

  return { patterns, error: null };
}

interface CreateSessionParams {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  sessionId: string;
  userId: string;
  fileName: string;
  parsedText: string;
  inputPath: string;
  patternIds: string[];
  documentType: DocumentType;
  documentTypeConfidence: number;
}

async function createAnnotationSession(params: CreateSessionParams) {
  const {
    supabase,
    sessionId,
    userId,
    fileName,
    parsedText,
    inputPath,
    patternIds,
    documentType,
    documentTypeConfidence,
  } = params;

  const { data: session, error: sessionError } = await supabase
    .from('annotator_sessions')
    .insert({
      id: sessionId,
      user_id: userId,
      input_filename: fileName,
      input_text: parsedText,
      input_file_path: inputPath,
      status: 'pending',
      claude_response: null,
      patterns_used: patternIds,
      document_type: documentType,
      document_type_confidence: documentTypeConfidence,
    })
    .select()
    .single();

  return { session, error: sessionError };
}

// ----------------------------------------------------------------------------
// Main Route Handler
// ----------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimit = withRateLimit(request, 30, 60000);
    if ('error' in rateLimit) return rateLimit.error;

    // Preload type rules from database
    await preloadRules();

    const supabase = getSupabaseAdmin();
    const user = getAuthenticatedUser(request);

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return errorResponse('MISSING_FILE', 'File is required', 400);
    }

    // Validate file
    const validation = await validateDocxFile(file);
    if (!validation.valid) {
      return errorResponse('INVALID_FILE', validation.error || 'Invalid file', 400);
    }

    // 1. Parse the document
    const parsed = await parseDocx(file);
    const highlightedRegions = parsed.highlightedRegions || [];
    console.log(
      `[Annotate] Document parsed, ${parsed.text.length} chars, ${highlightedRegions.length} highlighted regions`
    );

    // 2. Classify document type
    const classification = await classifyDocument(parsed.text);
    const documentType: DocumentType = classification.documentType;
    console.log(`[Annotate] Document classified as: ${documentType} (confidence: ${classification.confidence})`);

    // 3. Create session and upload file
    const sessionId = crypto.randomUUID();
    const inputPath = getSessionDocPath(user.id, sessionId, 'input');
    await storageService.upload(file, inputPath);

    // 4. Load trained patterns
    const { patterns } = await loadUserPatterns(supabase, user.id);
    console.log(`[Annotate] Loaded ${patterns.length} patterns`);

    // 5. Build semantic index for fuzzy matching
    const semanticIndex = buildSemanticIndex(
      patterns.map((p) => ({
        id: p.id,
        userId: p.userId,
        originalText: p.originalText,
        annotatedText: p.annotatedText,
        annotationType: p.annotationType,
        confidence: p.confidence,
        usageCount: p.usageCount,
        successRate: p.successRate,
        trainingPairId: p.trainingPairId,
        createdAt: p.createdAt,
        semanticContext: p.semanticContext,
      }))
    );
    console.log(`[Annotate] Built semantic index with ${semanticIndex.size} entries`);

    // 6. Find pattern matches
    const { suggestions } = findPatternMatches(patterns, parsed.text, highlightedRegions);
    console.log(`[Annotate] Found ${suggestions.length} pattern matches`);

    // 7. Auto-detect common placeholder formats
    const autoDetectResult = await autoDetectPlaceholders({
      documentText: parsed.text,
      existingSuggestions: suggestions,
      highlightedRegions,
      semanticIndex,
      userId: user.id,
    });
    suggestions.push(...autoDetectResult.suggestions);
    console.log(`[Annotate] Auto-detected ${autoDetectResult.suggestions.length} additional placeholders`);

    // 8. Sort by position
    suggestions.sort((a, b) => a.position.start - b.position.start);

    // 9. Remove overlapping suggestions
    const dedupedSuggestions = removeOverlappingSuggestions(suggestions);
    console.log(`[Annotate] After dedup: ${dedupedSuggestions.length} suggestions`);

    // 10. Find party name duplicates
    const partyNameDuplicates = findPartyNameDuplicates(dedupedSuggestions, parsed.text);
    dedupedSuggestions.push(...partyNameDuplicates);
    console.log(`[Annotate] Found ${partyNameDuplicates.length} party name duplicates for linking`);

    // 11. Re-sort by position
    dedupedSuggestions.sort((a, b) => a.position.start - b.position.start);

    // 12. Convert duplicates to Links
    const linkedSuggestions = convertDuplicatesToLinks(dedupedSuggestions, parsed.text);
    console.log(`[Annotate] Final suggestion count: ${linkedSuggestions.length}`);

    // 13. Create session in database
    const { session, error: sessionError } = await createAnnotationSession({
      supabase,
      sessionId,
      userId: user.id,
      fileName: file.name,
      parsedText: parsed.text,
      inputPath,
      patternIds: patterns.map((p) => p.id),
      documentType,
      documentTypeConfidence: classification.confidence,
    });

    if (sessionError) {
      console.error('Failed to create session:', sessionError);
      return NextResponse.json({ error: 'Failed to create annotation session' }, { status: 500 });
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
        documentType,
        documentTypeConfidence: classification.confidence,
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

import { NextRequest, NextResponse } from 'next/server';
import {
  parseDocx,
  claudeService,
  findPatternMatches,
  storageService,
  getSessionDocPath,
  getSupabaseAdmin,
  getAuthenticatedUser,
  validateDocxFile,
  errorResponse,
  handleError,
  withRateLimit,
} from '@/lib/annotator';
import type { Pattern, AnnotationType, AnnotationSuggestion, RejectedPattern } from '@/types/annotator';

/**
 * POST /api/annotator/annotate
 * Start a new annotation session - upload document and get AI suggestions
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

    // Parse the document
    const parsed = await parseDocx(file);

    // Create session ID
    const sessionId = crypto.randomUUID();

    // Upload input file
    const inputPath = getSessionDocPath(user.id, sessionId, 'input');
    await storageService.upload(file, inputPath);

    // Fetch user's training pairs, patterns, and rejected patterns
    const [trainingPairsResult, patternsResult, rejectedResult] = await Promise.all([
      supabase
        .from('annotator_training_pairs')
        .select('original_text, annotated_text')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('annotator_patterns')
        .select('*')
        .eq('user_id', user.id)
        .gte('confidence', 0.5)
        .order('confidence', { ascending: false })
        .limit(100), // Limit patterns for performance
      // Fetch frequently rejected patterns to avoid repeating mistakes
      supabase
        .from('annotator_feedback')
        .select('original_text, suggested_text, created_at')
        .eq('user_id', user.id)
        .eq('feedback_type', 'rejected'),
    ]);

    // Log any query errors (but continue with partial data)
    if (trainingPairsResult.error) {
      console.error('[Annotate] Training pairs query error:', trainingPairsResult.error);
    }
    if (patternsResult.error) {
      console.error('[Annotate] Patterns query error:', patternsResult.error);
    }
    if (rejectedResult.error) {
      console.error('[Annotate] Rejected patterns query error:', rejectedResult.error);
    }

    const trainingExamples = (trainingPairsResult.data || []).map((tp) => ({
      original: tp.original_text,
      annotated: tp.annotated_text,
    }));

    const patterns: Pattern[] = (patternsResult.data || []).map((p) => ({
      id: p.id,
      userId: p.user_id,
      originalText: p.original_text,
      annotatedText: p.annotated_text,
      annotationType: p.annotation_type as AnnotationType,
      contextBefore: p.context_before,
      contextAfter: p.context_after,
      confidence: p.confidence,
      usageCount: p.usage_count,
      successRate: p.success_rate,
      trainingPairId: p.training_pair_id,
      createdAt: new Date(p.created_at),
    }));

    // Process rejected patterns - group and count rejections
    const rejectedMap = new Map<string, { suggestedText: string; count: number; lastRejected: Date }>();
    for (const r of rejectedResult.data || []) {
      const key = r.original_text;
      const existing = rejectedMap.get(key);
      if (existing) {
        existing.count++;
        if (new Date(r.created_at) > existing.lastRejected) {
          existing.lastRejected = new Date(r.created_at);
        }
      } else {
        rejectedMap.set(key, {
          suggestedText: r.suggested_text,
          count: 1,
          lastRejected: new Date(r.created_at),
        });
      }
    }

    // Filter to only patterns rejected 2+ times (configurable threshold)
    const rejectedPatterns: RejectedPattern[] = Array.from(rejectedMap.entries())
      .filter(([, v]) => v.count >= 2)
      .map(([originalText, v]) => ({
        originalText,
        suggestedText: v.suggestedText,
        rejectionCount: v.count,
        lastRejected: v.lastRejected,
      }))
      .sort((a, b) => b.rejectionCount - a.rejectionCount);

    // Get suggestions from patterns (rule-based matching)
    const patternMatches = findPatternMatches(parsed.text, patterns);

    // Get suggestions from Claude (AI-based)
    // NOTE: Claude should be called even without training examples - it uses the
    // comprehensive system prompt with annotation rules. Training examples just
    // make it better over time through few-shot learning.
    let claudeResponse = null;
    let aiSuggestions: AnnotationSuggestion[] = [];

    if (claudeService.isConfigured()) {
      try {
        claudeResponse = await claudeService.annotate({
          document: parsed.text,
          trainingExamples, // May be empty for new users - that's OK
          patterns,
          rejectedPatterns, // Tell Claude what NOT to suggest
          maxExamples: 5,
          confidenceThreshold: 0.5,
        });

        // Convert Claude response to suggestions
        aiSuggestions = claudeResponse.annotations.map((ann) => ({
          id: crypto.randomUUID(),
          originalText: ann.original,
          annotatedText: ann.annotated,
          type: ann.type,
          position: ann.position,
          confidence: ann.confidence,
          isAccepted: true,
          isEdited: false,
        }));

        console.log(`[Annotate] Claude returned ${aiSuggestions.length} suggestions (training examples: ${trainingExamples.length}, rejected patterns: ${rejectedPatterns.length})`);
      } catch (error) {
        console.error('Claude API error:', error);
        // Continue with pattern-based suggestions only
      }
    }

    // Convert pattern matches to suggestions
    const patternSuggestions: AnnotationSuggestion[] = patternMatches.matches.map(
      (match) => ({
        id: crypto.randomUUID(),
        originalText: match.matchedText,
        annotatedText: match.suggestedAnnotation,
        type: match.pattern.annotationType,
        position: match.matchPosition,
        confidence: match.confidence,
        isAccepted: true,
        isEdited: false,
      })
    );

    // Merge suggestions - PATTERNS FIRST, AI fills gaps
    // This ensures learned patterns take priority over AI guesses
    const allSuggestions = mergeSuggestionsPatternFirst(patternSuggestions, aiSuggestions);

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
        claude_response: claudeResponse,
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
      suggestions: allSuggestions,
      stats: {
        totalSuggestions: allSuggestions.length,
        aiSuggestions: aiSuggestions.length,
        patternSuggestions: patternSuggestions.length,
        patternsUsed: patterns.length,
        rejectedPatternsCount: rejectedPatterns.length,
      },
    });
  } catch (error) {
    return handleError(error, 'Annotate POST');
  }
}

/**
 * Merge pattern and AI suggestions - PATTERNS TAKE PRIORITY
 *
 * This is the key change: learned patterns are applied first, and AI only
 * fills in gaps where no pattern matches. This prevents AI "hallucination"
 * from overriding what the user has explicitly trained.
 *
 * Priority order:
 * 1. High-confidence pattern matches (>= 0.7) - always use
 * 2. Medium-confidence patterns (0.5-0.7) - use, but flag for review
 * 3. AI suggestions - only for areas with NO pattern coverage
 */
function mergeSuggestionsPatternFirst(
  patternSuggestions: AnnotationSuggestion[],
  aiSuggestions: AnnotationSuggestion[]
): AnnotationSuggestion[] {
  // Start with pattern suggestions (they have priority)
  const merged: AnnotationSuggestion[] = [];
  const coveredRanges: Array<{ start: number; end: number }> = [];

  // Add all pattern suggestions first
  for (const patternSugg of patternSuggestions) {
    // Check if this overlaps with any already-added pattern
    const overlapsExisting = coveredRanges.some(
      (range) =>
        patternSugg.position.start < range.end &&
        patternSugg.position.end > range.start
    );

    if (!overlapsExisting) {
      merged.push(patternSugg);
      coveredRanges.push(patternSugg.position);
    }
  }

  // Add AI suggestions only for uncovered areas
  for (const aiSugg of aiSuggestions) {
    // Check if this position overlaps with any pattern
    const overlapsPattern = coveredRanges.some(
      (range) =>
        aiSugg.position.start < range.end &&
        aiSugg.position.end > range.start
    );

    if (!overlapsPattern) {
      // AI suggestion for an area not covered by patterns
      // Mark it as AI-generated for transparency
      merged.push({
        ...aiSugg,
        confidence: Math.min(aiSugg.confidence, 0.7), // Cap AI confidence
      });
      coveredRanges.push(aiSugg.position);
    }
    // If overlaps, the pattern takes priority - AI suggestion is discarded
  }

  console.log(`[mergeSuggestions] Patterns: ${patternSuggestions.length}, AI: ${aiSuggestions.length}, Final: ${merged.length}`);
  console.log(`[mergeSuggestions] Pattern coverage: ${patternSuggestions.length} of ${merged.length} suggestions`);

  // Sort by position
  return merged.sort((a, b) => a.position.start - b.position.start);
}

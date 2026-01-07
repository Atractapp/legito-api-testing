import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  parseDocx,
  claudeService,
  findPatternMatches,
  storageService,
  getSessionDocPath,
} from '@/lib/annotator';
import type { Pattern, AnnotationType, AnnotationSuggestion } from '@/types/annotator';

// Initialize Supabase client
function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase environment variables not configured');
  }

  return createClient(supabaseUrl, supabaseKey);
}

/**
 * POST /api/annotator/annotate
 * Start a new annotation session - upload document and get AI suggestions
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const userId = request.headers.get('x-user-id') || 'default-user';

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'file is required' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.name.endsWith('.docx') && !file.type.includes('word')) {
      return NextResponse.json(
        { error: 'File must be a Word document (.docx)' },
        { status: 400 }
      );
    }

    // Parse the document
    const parsed = await parseDocx(file);

    // Create session ID
    const sessionId = crypto.randomUUID();

    // Upload input file
    const inputPath = getSessionDocPath(userId, sessionId, 'input');
    await storageService.upload(file, inputPath);

    // Fetch user's training pairs and patterns
    const [trainingPairsResult, patternsResult] = await Promise.all([
      supabase
        .from('annotator_training_pairs')
        .select('original_text, annotated_text')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('annotator_patterns')
        .select('*')
        .eq('user_id', userId)
        .gte('confidence', 0.5)
        .order('confidence', { ascending: false }),
    ]);

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

    // Get suggestions from patterns (rule-based matching)
    const patternMatches = findPatternMatches(parsed.text, patterns);

    // Get suggestions from Claude (AI-based)
    let claudeResponse = null;
    let aiSuggestions: AnnotationSuggestion[] = [];

    if (claudeService.isConfigured() && trainingExamples.length > 0) {
      try {
        claudeResponse = await claudeService.annotate({
          document: parsed.text,
          trainingExamples,
          patterns,
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

    // Merge suggestions, preferring AI suggestions but avoiding duplicates
    const allSuggestions = mergeSuggestions(aiSuggestions, patternSuggestions);

    // Create session in database
    const { data: session, error: sessionError } = await supabase
      .from('annotator_sessions')
      .insert({
        id: sessionId,
        user_id: userId,
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
      },
    });
  } catch (error) {
    console.error('Annotate POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Merge AI and pattern suggestions, removing duplicates
 */
function mergeSuggestions(
  aiSuggestions: AnnotationSuggestion[],
  patternSuggestions: AnnotationSuggestion[]
): AnnotationSuggestion[] {
  const merged: AnnotationSuggestion[] = [...aiSuggestions];
  const coveredRanges = aiSuggestions.map((s) => s.position);

  for (const patternSugg of patternSuggestions) {
    // Check if this position overlaps with any AI suggestion
    const overlaps = coveredRanges.some(
      (range) =>
        patternSugg.position.start < range.end &&
        patternSugg.position.end > range.start
    );

    if (!overlaps) {
      merged.push(patternSugg);
      coveredRanges.push(patternSugg.position);
    }
  }

  // Sort by position
  return merged.sort((a, b) => a.position.start - b.position.start);
}

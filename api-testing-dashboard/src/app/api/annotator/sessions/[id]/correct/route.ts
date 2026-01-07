import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  parseDocx,
  extractPatterns,
  deduplicatePatterns,
  storageService,
  getTrainingDocPath,
} from '@/lib/annotator';
import type { Pattern, AnnotationType } from '@/types/annotator';

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
 * POST /api/annotator/sessions/[id]/correct
 * Submit a corrected document to create a new training pair
 * This is the key to the infinite learning loop
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabase();
    const userId = request.headers.get('x-user-id') || 'default-user';
    const { id: sessionId } = await params;

    // Parse form data
    const formData = await request.formData();
    const correctedFile = formData.get('correctedFile') as File;

    if (!correctedFile) {
      return NextResponse.json(
        { error: 'correctedFile is required' },
        { status: 400 }
      );
    }

    // Fetch original session
    const { data: session, error: sessionError } = await supabase
      .from('annotator_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Parse the corrected document
    const correctedParsed = await parseDocx(correctedFile);

    // Create new training pair from correction
    const newPairId = crypto.randomUUID();

    // Extract patterns from the correction
    const { patterns: newPatterns, summary } = extractPatterns(
      session.input_text,
      correctedParsed.text,
      newPairId
    );

    // Upload corrected file
    const originalPath = getTrainingDocPath(userId, newPairId, 'original');
    const annotatedPath = getTrainingDocPath(userId, newPairId, 'annotated');

    // Download original input file if it exists
    let originalBlob: Blob | null = null;
    if (session.input_file_path) {
      try {
        originalBlob = await storageService.download(session.input_file_path);
      } catch {
        // Use text-based file if original not available
      }
    }

    // Upload files
    if (originalBlob) {
      await storageService.upload(originalBlob, originalPath);
    }
    await storageService.upload(correctedFile, annotatedPath);

    // Create training pair
    const { error: insertError } = await supabase
      .from('annotator_training_pairs')
      .insert({
        id: newPairId,
        user_id: userId,
        name: `Correction: ${session.input_filename}`,
        original_text: session.input_text,
        annotated_text: correctedParsed.text,
        original_file_path: originalBlob ? originalPath : null,
        annotated_file_path: annotatedPath,
        patterns_extracted: newPatterns,
        is_user_corrected: true,
        source_session_id: sessionId,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to create training pair:', insertError);
      return NextResponse.json(
        { error: 'Failed to save correction as training pair' },
        { status: 500 }
      );
    }

    // Fetch existing patterns for deduplication
    const { data: existingPatterns } = await supabase
      .from('annotator_patterns')
      .select('*')
      .eq('user_id', userId);

    const existingPatternsTyped: Pattern[] = (existingPatterns || []).map((p) => ({
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

    // Deduplicate patterns
    const { toAdd, toUpdate } = deduplicatePatterns(existingPatternsTyped, newPatterns);

    // Insert new patterns
    if (toAdd.length > 0) {
      const patternsToInsert = toAdd.map((pattern) => ({
        user_id: userId,
        original_text: pattern.originalText,
        annotated_text: pattern.annotatedText,
        annotation_type: pattern.annotationType,
        context_before: pattern.contextBefore,
        context_after: pattern.contextAfter,
        confidence: pattern.confidence,
        usage_count: pattern.usageCount,
        success_rate: pattern.successRate,
        training_pair_id: newPairId,
      }));

      await supabase.from('annotator_patterns').insert(patternsToInsert);
    }

    // Update existing patterns
    for (const update of toUpdate) {
      await supabase
        .from('annotator_patterns')
        .update(update.updates)
        .eq('id', update.id);
    }

    // Update session status
    await supabase
      .from('annotator_sessions')
      .update({ status: 'corrected' })
      .eq('id', sessionId);

    // Update pattern usage counts for patterns that were used
    if (session.patterns_used && session.patterns_used.length > 0) {
      // Increment usage count for all patterns that were used in this session
      for (const patternId of session.patterns_used) {
        try {
          await supabase.rpc('increment_single_pattern_usage', {
            pattern_id: patternId,
          });
        } catch {
          // Fallback: If RPC doesn't exist, we skip the update
        }
      }
    }

    return NextResponse.json({
      success: true,
      newTrainingPairId: newPairId,
      newPatternsCount: toAdd.length,
      updatedPatterns: toUpdate.length,
      summary,
    });
  } catch (error) {
    console.error('Correct POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

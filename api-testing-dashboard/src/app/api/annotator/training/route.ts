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
 * GET /api/annotator/training
 * List all training pairs for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase();

    // Get user from auth header or session (simplified for now)
    const userId = request.headers.get('x-user-id') || 'default-user';

    const { data: trainingPairs, error } = await supabase
      .from('annotator_training_pairs')
      .select('id, name, patterns_extracted, is_user_corrected, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch training pairs:', error);
      return NextResponse.json(
        { error: 'Failed to fetch training pairs' },
        { status: 500 }
      );
    }

    // Transform for frontend
    const summaries = (trainingPairs || []).map((pair) => ({
      id: pair.id,
      name: pair.name,
      patternsCount: Array.isArray(pair.patterns_extracted)
        ? pair.patterns_extracted.length
        : 0,
      isUserCorrected: pair.is_user_corrected,
      createdAt: pair.created_at,
    }));

    return NextResponse.json({
      trainingPairs: summaries,
      total: summaries.length,
    });
  } catch (error) {
    console.error('Training pairs GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/annotator/training
 * Upload a new training pair
 */
export async function POST(request: NextRequest) {
  console.log('[Training POST] Starting upload...');
  try {
    const supabase = getSupabase();
    console.log('[Training POST] Supabase client created');
    const userId = request.headers.get('x-user-id') || 'default-user';
    console.log('[Training POST] User ID:', userId);

    // Parse form data
    console.log('[Training POST] Parsing form data...');
    const formData = await request.formData();
    const name = formData.get('name') as string;
    const originalFile = formData.get('originalFile') as File;
    const annotatedFile = formData.get('annotatedFile') as File;
    console.log('[Training POST] Form data:', { name, originalFile: originalFile?.name, annotatedFile: annotatedFile?.name });

    if (!name || !originalFile || !annotatedFile) {
      console.log('[Training POST] Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields: name, originalFile, annotatedFile' },
        { status: 400 }
      );
    }

    // Validate file types
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ];
    if (
      !validTypes.includes(originalFile.type) &&
      !originalFile.name.endsWith('.docx')
    ) {
      return NextResponse.json(
        { error: 'Original file must be a Word document (.docx)' },
        { status: 400 }
      );
    }
    if (
      !validTypes.includes(annotatedFile.type) &&
      !annotatedFile.name.endsWith('.docx')
    ) {
      return NextResponse.json(
        { error: 'Annotated file must be a Word document (.docx)' },
        { status: 400 }
      );
    }

    // Parse documents
    console.log('[Training POST] Parsing documents...');
    const [originalParsed, annotatedParsed] = await Promise.all([
      parseDocx(originalFile),
      parseDocx(annotatedFile),
    ]);
    console.log('[Training POST] Documents parsed:', { originalLength: originalParsed.text.length, annotatedLength: annotatedParsed.text.length });

    // Extract patterns
    const pairId = crypto.randomUUID();
    console.log('[Training POST] Extracting patterns for pair:', pairId);
    const { patterns, summary } = extractPatterns(
      originalParsed.text,
      annotatedParsed.text,
      pairId
    );
    console.log('[Training POST] Patterns extracted:', patterns.length);

    // Upload files to storage
    const originalPath = getTrainingDocPath(userId, pairId, 'original');
    const annotatedPath = getTrainingDocPath(userId, pairId, 'annotated');
    console.log('[Training POST] Uploading files to storage...', { originalPath, annotatedPath });

    await Promise.all([
      storageService.upload(originalFile, originalPath),
      storageService.upload(annotatedFile, annotatedPath),
    ]);
    console.log('[Training POST] Files uploaded to storage');

    // Save training pair to database
    console.log('[Training POST] Saving to database...');
    const { data: trainingPair, error: insertError } = await supabase
      .from('annotator_training_pairs')
      .insert({
        id: pairId,
        user_id: userId,
        name,
        original_text: originalParsed.text,
        annotated_text: annotatedParsed.text,
        original_file_path: originalPath,
        annotated_file_path: annotatedPath,
        patterns_extracted: patterns,
        is_user_corrected: false,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[Training POST] Failed to save training pair:', insertError);
      return NextResponse.json(
        { error: `Failed to save training pair: ${insertError.message}` },
        { status: 500 }
      );
    }
    console.log('[Training POST] Training pair saved:', trainingPair?.id);

    // Save extracted patterns with deduplication
    if (patterns.length > 0) {
      console.log('[Training POST] Deduplicating patterns...');

      // Fetch existing patterns for this user
      const { data: existingPatternsData } = await supabase
        .from('annotator_patterns')
        .select('*')
        .eq('user_id', userId);

      // Convert to Pattern type for deduplication
      const existingPatterns: Pattern[] = (existingPatternsData || []).map((p) => ({
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

      // Deduplicate - get patterns to add and patterns to update
      const { toAdd, toUpdate } = deduplicatePatterns(existingPatterns, patterns);
      console.log('[Training POST] Deduplication result:', {
        newPatterns: toAdd.length,
        existingToUpdate: toUpdate.length,
        skippedDuplicates: patterns.length - toAdd.length,
      });

      // Insert only new patterns
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
          training_pair_id: pairId,
        }));

        const { error: patternsError } = await supabase
          .from('annotator_patterns')
          .insert(patternsToInsert);

        if (patternsError) {
          console.error('Failed to save patterns:', patternsError);
          // Continue anyway - training pair is saved
        }
      }

      // Update existing similar patterns (increase usage count and confidence)
      for (const update of toUpdate) {
        await supabase
          .from('annotator_patterns')
          .update({
            usage_count: update.updates.usageCount,
            confidence: update.updates.confidence,
          })
          .eq('id', update.id);
      }
    }

    return NextResponse.json({
      success: true,
      trainingPair: {
        id: trainingPair.id,
        userId: trainingPair.user_id,
        name: trainingPair.name,
        originalText: trainingPair.original_text,
        annotatedText: trainingPair.annotated_text,
        originalFilePath: trainingPair.original_file_path,
        annotatedFilePath: trainingPair.annotated_file_path,
        patternsExtracted: trainingPair.patterns_extracted,
        isUserCorrected: trainingPair.is_user_corrected,
        sourceSessionId: trainingPair.source_session_id,
        createdAt: trainingPair.created_at,
      },
      patternsExtracted: patterns.length,
      summary,
    });
  } catch (error) {
    console.error('[Training POST] Error:', error);
    console.error('[Training POST] Stack:', error instanceof Error ? error.stack : 'No stack');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

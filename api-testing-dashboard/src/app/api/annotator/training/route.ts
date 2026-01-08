import { NextRequest, NextResponse } from 'next/server';
import {
  parseDocx,
  extractPatterns,
  storageService,
  getTrainingDocPath,
  getSupabaseAdmin,
  getAuthenticatedUser,
  validateDocxFile,
  errorResponse,
  handleError,
  withRateLimit,
} from '@/lib/annotator';

/**
 * GET /api/annotator/training
 * List all training pairs for the current user
 */
export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimit = withRateLimit(request, 100, 60000);
    if ('error' in rateLimit) return rateLimit.error;

    const supabase = getSupabaseAdmin();
    const user = getAuthenticatedUser(request);

    const { data: trainingPairs, error } = await supabase
      .from('annotator_training_pairs')
      .select('id, name, patterns_extracted, is_user_corrected, created_at')
      .eq('user_id', user.id)
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
    // Rate limiting (stricter for uploads)
    const rateLimit = withRateLimit(request, 20, 60000);
    if ('error' in rateLimit) return rateLimit.error;

    const supabase = getSupabaseAdmin();
    console.log('[Training POST] Supabase client created');
    const user = getAuthenticatedUser(request);
    console.log('[Training POST] User ID:', user.id);

    // Parse form data
    console.log('[Training POST] Parsing form data...');
    const formData = await request.formData();
    const name = formData.get('name') as string;
    const originalFile = formData.get('originalFile') as File;
    const annotatedFile = formData.get('annotatedFile') as File;
    console.log('[Training POST] Form data:', { name, originalFile: originalFile?.name, annotatedFile: annotatedFile?.name });

    if (!name || !originalFile || !annotatedFile) {
      console.log('[Training POST] Missing required fields');
      return errorResponse('MISSING_FIELDS', 'Missing required fields: name, originalFile, annotatedFile', 400);
    }

    // Validate files using magic bytes
    const [originalValidation, annotatedValidation] = await Promise.all([
      validateDocxFile(originalFile),
      validateDocxFile(annotatedFile),
    ]);

    if (!originalValidation.valid) {
      return errorResponse('INVALID_FILE', `Original file: ${originalValidation.error}`, 400);
    }

    if (!annotatedValidation.valid) {
      return errorResponse('INVALID_FILE', `Annotated file: ${annotatedValidation.error}`, 400);
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
    const originalPath = getTrainingDocPath(user.id, pairId, 'original');
    const annotatedPath = getTrainingDocPath(user.id, pairId, 'annotated');
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
        user_id: user.id,
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

    // DON'T auto-save patterns - return them for user review instead
    // User will use /api/annotator/patterns/confirm to save approved patterns
    console.log('[Training POST] Returning patterns for user review (NOT auto-saving)');

    // Convert patterns to PatternSuggestion format for frontend
    const patternSuggestions = patterns.map((p, index) => ({
      id: `pending_${pairId}_${index}`,
      originalText: p.originalText,
      annotatedText: p.annotatedText,
      annotationType: p.annotationType,
      contextBefore: p.contextBefore,
      contextAfter: p.contextAfter,
      confidence: p.confidence,
      isAccepted: true, // Default to accepted
      isEdited: false,
    }));

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
      // New: Return pattern suggestions for user review
      extractedPatterns: patternSuggestions,
      patternsExtracted: patterns.length,
      summary,
    });
  } catch (error) {
    return handleError(error, 'Training POST');
  }
}

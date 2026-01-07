import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  generateAnnotatedDocx,
  applyAnnotationsToText,
  storageService,
  getSessionDocPath,
} from '@/lib/annotator';
import type { Annotation } from '@/types/annotator';

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
 * POST /api/annotator/annotate/generate
 * Generate the annotated document with accepted annotations
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const userId = request.headers.get('x-user-id') || 'default-user';

    const { sessionId, annotations } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      );
    }

    if (!Array.isArray(annotations)) {
      return NextResponse.json(
        { error: 'annotations array is required' },
        { status: 400 }
      );
    }

    // Fetch session
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

    // Apply annotations to text
    const typedAnnotations: Annotation[] = annotations.map((a: Annotation) => ({
      id: a.id,
      originalText: a.originalText,
      annotatedText: a.annotatedText,
      type: a.type,
      position: a.position,
      confidence: a.confidence,
      label: a.label,
      options: a.options,
    }));

    const annotatedText = applyAnnotationsToText(session.input_text, typedAnnotations);

    // Generate DOCX file
    const docxBlob = await generateAnnotatedDocx(session.input_text, typedAnnotations);

    // Upload to storage
    const outputPath = getSessionDocPath(userId, sessionId, 'output');
    await storageService.upload(docxBlob, outputPath);

    // Get download URL
    const downloadUrl = await storageService.getUrl(outputPath);

    // Update session
    const { error: updateError } = await supabase
      .from('annotator_sessions')
      .update({
        output_text: annotatedText,
        output_file_path: outputPath,
        annotations_applied: typedAnnotations,
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (updateError) {
      console.error('Failed to update session:', updateError);
      // Continue anyway - file is generated
    }

    // Update pattern usage counts
    const patternIds = session.patterns_used || [];
    if (patternIds.length > 0) {
      // Increment usage count for used patterns
      try {
        await supabase.rpc('increment_pattern_usage', {
          pattern_ids: patternIds,
        });
      } catch {
        // Ignore if RPC doesn't exist
      }
    }

    return NextResponse.json({
      success: true,
      downloadUrl,
      outputFilePath: outputPath,
      annotatedText,
      annotationsApplied: typedAnnotations.length,
    });
  } catch (error) {
    console.error('Generate POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import {
  generateAnnotatedDocx,
  generateAnnotatedDocxPreservingFormat,
  applyAnnotationsToText,
  deduplicatePatterns,
  storageService,
  getSessionDocPath,
  getSupabaseAdmin,
  getAuthenticatedUser,
  errorResponse,
  handleError,
  withRateLimit,
} from '@/lib/annotator';
import type { Annotation, AnnotationType, Pattern } from '@/types/annotator';

/**
 * POST /api/annotator/annotate/generate
 * Generate the annotated document with accepted annotations
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimit = withRateLimit(request, 20, 60000);
    if ('error' in rateLimit) return rateLimit.error;

    const supabase = getSupabaseAdmin();
    const user = getAuthenticatedUser(request);

    const { sessionId, annotations, saveAsPatterns } = await request.json();

    if (!sessionId) {
      return errorResponse('MISSING_SESSION', 'sessionId is required', 400);
    }

    if (!Array.isArray(annotations)) {
      return errorResponse('INVALID_ANNOTATIONS', 'annotations array is required', 400);
    }

    // Fetch session
    const { data: session, error: sessionError } = await supabase
      .from('annotator_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single();

    if (sessionError || !session) {
      return errorResponse('SESSION_NOT_FOUND', 'Session not found', 404);
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

    // Generate DOCX file - preserve original formatting if input file exists
    let docxBlob: Blob;

    if (session.input_file_path) {
      try {
        // Download original file from storage
        const originalFile = await storageService.download(session.input_file_path);

        // Build replacements array from annotations
        const replacements = typedAnnotations.map((ann) => ({
          original: ann.originalText,
          replacement: ann.annotatedText,
        }));

        // Generate with format preservation
        docxBlob = await generateAnnotatedDocxPreservingFormat(originalFile, replacements);
        console.log('[Generate] Used format-preserving generation');
      } catch (formatError) {
        console.warn('[Generate] Format-preserving failed, falling back to plain generation:', formatError);
        // Fall back to plain generation if format preservation fails
        docxBlob = await generateAnnotatedDocx(session.input_text, typedAnnotations);
      }
    } else {
      // No original file, generate new document
      docxBlob = await generateAnnotatedDocx(session.input_text, typedAnnotations);
    }

    // Upload to storage
    const outputPath = getSessionDocPath(user.id, sessionId, 'output');
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

    // Optionally save accepted annotations as patterns for future use
    let patternsSaved = 0;
    let patternsUpdated = 0;

    if (saveAsPatterns && typedAnnotations.length > 0) {
      console.log('[Generate] Saving accepted annotations as patterns...');

      // Build patterns from accepted annotations
      const newPatterns = typedAnnotations
        .filter((ann) => {
          // Skip if original text is same as annotated (no real replacement)
          if (ann.originalText === ann.annotatedText) return false;
          // Skip if original text is already an annotation format
          if (/^\[.+\]$/.test(ann.originalText)) return false;
          // Skip empty
          if (!ann.originalText || !ann.originalText.trim()) return false;
          return true;
        })
        .map((ann) => {
          // Extract context from input text
          const inputText = session.input_text || '';
          const contextLength = 100;

          const contextBefore = inputText
            .substring(Math.max(0, ann.position.start - contextLength), ann.position.start)
            .trim();
          const contextAfter = inputText
            .substring(ann.position.end, Math.min(inputText.length, ann.position.end + contextLength))
            .trim();

          return {
            originalText: ann.originalText,
            annotatedText: ann.annotatedText,
            annotationType: ann.type,
            contextBefore,
            contextAfter,
            confidence: 1.0,
            usageCount: 1,
            successRate: 1.0,
            trainingPairId: null,
          };
        });

      if (newPatterns.length > 0) {
        // Fetch existing patterns for deduplication
        const { data: existingPatternsData } = await supabase
          .from('annotator_patterns')
          .select('*')
          .eq('user_id', user.id);

        // Convert to Pattern type
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

        // Deduplicate
        const { toAdd, toUpdate } = deduplicatePatterns(existingPatterns, newPatterns);

        // Insert new patterns
        if (toAdd.length > 0) {
          const { error: insertError } = await supabase.from('annotator_patterns').insert(
            toAdd.map((p) => ({
              user_id: user.id,
              original_text: p.originalText,
              annotated_text: p.annotatedText,
              annotation_type: p.annotationType,
              context_before: p.contextBefore,
              context_after: p.contextAfter,
              confidence: p.confidence,
              usage_count: p.usageCount,
              success_rate: p.successRate,
              training_pair_id: p.trainingPairId,
            }))
          );

          if (insertError) {
            console.error('[Generate] Failed to insert patterns:', insertError);
          } else {
            patternsSaved = toAdd.length;
          }
        }

        // Update existing similar patterns
        for (const update of toUpdate) {
          await supabase
            .from('annotator_patterns')
            .update({
              usage_count: update.updates.usageCount,
              confidence: update.updates.confidence,
            })
            .eq('id', update.id);
          patternsUpdated++;
        }

        console.log('[Generate] Patterns saved:', patternsSaved, 'updated:', patternsUpdated);
      }
    }

    return NextResponse.json({
      success: true,
      downloadUrl,
      outputFilePath: outputPath,
      annotatedText,
      annotationsApplied: typedAnnotations.length,
      patternsSaved,
      patternsUpdated,
    });
  } catch (error) {
    return handleError(error, 'Generate POST');
  }
}

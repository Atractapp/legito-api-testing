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
  generateSemanticContextBatch,
} from '@/lib/annotator';
import type { Annotation, AnnotationType, Pattern } from '@/types/annotator';

/**
 * Check if text is a REAL annotation (like [Textinput: Name]) vs a placeholder (like [**], {Name})
 * We should only skip real annotations, NOT placeholders which are valid original text
 */
function isRealAnnotation(text: string): boolean {
  // Must be in [xxx] format - curly braces like {Name} are NOT annotations
  if (!/^\[.+\]$/.test(text)) return false;

  const content = text.slice(1, -1).trim().toLowerCase();

  // Check if it starts with known annotation types
  const annotationTypes = ['textinput', 'text', 'date', 'money', 'link', 'select', 'calculation', 'number', 'checkbox'];
  for (const type of annotationTypes) {
    if (content === type || content.startsWith(type + ':') || content.startsWith(type + ' :')) {
      return true;
    }
  }

  // If content is only special characters like *, _, -, it's a placeholder, not annotation
  if (/^[\*_\-●○•\#\?\.\s\[\]]+$/.test(content)) {
    return false;
  }

  // Very short content (1-2 chars) is likely a placeholder
  if (content.length <= 2) {
    return false;
  }

  return false; // Default: not a real annotation
}

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
          // Skip if original text is already a REAL annotation (like [Textinput: Name])
          // But allow placeholders like [**], {Name}, etc.
          if (isRealAnnotation(ann.originalText)) {
            console.log(`[Generate] Skipping real annotation: "${ann.originalText}"`);
            return false;
          }
          // Skip empty
          if (!ann.originalText || !ann.originalText.trim()) return false;
          console.log(`[Generate] Valid pattern: "${ann.originalText}" → "${ann.annotatedText}"`);
          return true;
        })
        .map((ann) => ({
          originalText: ann.originalText,
          annotatedText: ann.annotatedText,
          annotationType: ann.type,
          confidence: 1.0,
          usageCount: 1,
          successRate: 1.0,
          trainingPairId: null,
        }));

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
          confidence: p.confidence,
          usageCount: p.usage_count,
          successRate: p.success_rate,
          trainingPairId: p.training_pair_id,
          createdAt: new Date(p.created_at),
          semanticContext: p.semantic_context,
        }));

        // Deduplicate
        const { toAdd, toUpdate } = deduplicatePatterns(existingPatterns, newPatterns);

        // Insert new patterns with AI-generated semantic context
        if (toAdd.length > 0) {
          console.log('[Generate] Generating AI semantic context for', toAdd.length, 'patterns...');

          // Generate semantic context for all new patterns
          const semanticContextMap = await generateSemanticContextBatch(
            toAdd.map((p) => ({
              originalText: p.originalText,
              annotatedText: p.annotatedText,
              annotationType: p.annotationType,
            }))
          );

          const { error: insertError } = await supabase.from('annotator_patterns').insert(
            toAdd.map((p) => ({
              user_id: user.id,
              original_text: p.originalText,
              annotated_text: p.annotatedText,
              annotation_type: p.annotationType,
              confidence: p.confidence,
              usage_count: p.usageCount,
              success_rate: p.successRate,
              training_pair_id: p.trainingPairId,
              semantic_context: semanticContextMap.get(p.originalText) || null,
            }))
          );

          if (insertError) {
            console.error('[Generate] Failed to insert patterns:', insertError);
          } else {
            patternsSaved = toAdd.length;
            console.log('[Generate] Patterns saved with AI context:', patternsSaved);
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

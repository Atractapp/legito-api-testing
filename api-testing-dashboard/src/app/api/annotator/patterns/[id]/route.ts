import { NextRequest, NextResponse } from 'next/server';
import {
  getSupabaseAdmin,
  getAuthenticatedUser,
  errorResponse,
  handleError,
  withRateLimit,
  generateSemanticContext,
} from '@/lib/annotator';
import type { AnnotationType } from '@/types/annotator';

/**
 * PUT /api/annotator/patterns/[id]
 * Update a pattern (originalText, annotatedText, annotationType)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimit = withRateLimit(request, 30, 60000);
    if ('error' in rateLimit) return rateLimit.error;

    const supabase = getSupabaseAdmin();
    const user = getAuthenticatedUser(request);
    const { id } = await params;

    if (!id) {
      return errorResponse('MISSING_ID', 'Pattern ID is required', 400);
    }

    const body = await request.json();
    const { originalText, annotatedText, annotationType, userContextHint } = body;

    // Build update object
    const updates: Record<string, unknown> = {};
    if (originalText !== undefined) updates.original_text = originalText;
    if (annotatedText !== undefined) updates.annotated_text = annotatedText;
    if (annotationType !== undefined) updates.annotation_type = annotationType;
    if (userContextHint !== undefined) updates.user_context_hint = userContextHint;

    if (Object.keys(updates).length === 0) {
      return errorResponse('INVALID_REQUEST', 'No fields to update', 400);
    }

    // If originalText, annotatedText, or userContextHint changed, regenerate semantic context
    if (originalText || annotatedText || userContextHint !== undefined) {
      // Get current pattern to have all data for context generation
      const { data: current } = await supabase
        .from('annotator_patterns')
        .select('original_text, annotated_text, annotation_type, user_context_hint')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (current) {
        const finalOriginal = originalText || current.original_text;
        const finalAnnotated = annotatedText || current.annotated_text;
        const finalType = (annotationType || current.annotation_type) as AnnotationType;
        const finalUserHint = userContextHint !== undefined ? userContextHint : current.user_context_hint;

        // Generate new semantic context (include user hint)
        const semanticContext = await generateSemanticContext(finalOriginal, finalAnnotated, finalType, finalUserHint);
        if (semanticContext) {
          updates.semantic_context = semanticContext;
        }
      }
    }

    // Update the pattern
    const { data: pattern, error } = await supabase
      .from('annotator_patterns')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('Failed to update pattern:', error);
      return errorResponse('UPDATE_FAILED', error.message, 500);
    }

    return NextResponse.json({
      success: true,
      pattern: {
        id: pattern.id,
        originalText: pattern.original_text,
        annotatedText: pattern.annotated_text,
        annotationType: pattern.annotation_type,
        semanticContext: pattern.semantic_context,
        userContextHint: pattern.user_context_hint,
        confidence: pattern.confidence,
      },
    });
  } catch (error) {
    return handleError(error, 'Update Pattern');
  }
}

/**
 * DELETE /api/annotator/patterns/[id]
 * Delete a single pattern by ID
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimit = withRateLimit(request, 30, 60000);
    if ('error' in rateLimit) return rateLimit.error;

    const supabase = getSupabaseAdmin();
    const user = getAuthenticatedUser(request);
    const { id } = await params;

    if (!id) {
      return errorResponse('MISSING_ID', 'Pattern ID is required', 400);
    }

    // Delete the pattern (only if it belongs to the user)
    const { error, count } = await supabase
      .from('annotator_patterns')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Failed to delete pattern:', error);
      return errorResponse('DELETE_FAILED', error.message, 500);
    }

    return NextResponse.json({
      success: true,
      deletedId: id,
      deletedCount: count,
    });
  } catch (error) {
    return handleError(error, 'Delete Pattern');
  }
}

/**
 * GET /api/annotator/patterns/[id]
 * Get a single pattern by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimit = withRateLimit(request, 100, 60000);
    if ('error' in rateLimit) return rateLimit.error;

    const supabase = getSupabaseAdmin();
    const user = getAuthenticatedUser(request);
    const { id } = await params;

    if (!id) {
      return errorResponse('MISSING_ID', 'Pattern ID is required', 400);
    }

    const { data: pattern, error } = await supabase
      .from('annotator_patterns')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error) {
      return errorResponse('NOT_FOUND', 'Pattern not found', 404);
    }

    return NextResponse.json({
      pattern: {
        id: pattern.id,
        userId: pattern.user_id,
        originalText: pattern.original_text,
        annotatedText: pattern.annotated_text,
        annotationType: pattern.annotation_type,
        semanticContext: pattern.semantic_context,
        userContextHint: pattern.user_context_hint,
        confidence: pattern.confidence,
        usageCount: pattern.usage_count,
        successRate: pattern.success_rate,
        trainingPairId: pattern.training_pair_id,
        createdAt: pattern.created_at,
      },
    });
  } catch (error) {
    return handleError(error, 'Get Pattern');
  }
}

import { NextRequest, NextResponse } from 'next/server';
import {
  getSupabaseAdmin,
  getAuthenticatedUser,
  errorResponse,
  handleError,
  withRateLimit,
} from '@/lib/annotator';

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
        contextBefore: pattern.context_before,
        contextAfter: pattern.context_after,
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

import { NextRequest, NextResponse } from 'next/server';
import {
  getSupabaseAdmin,
  getAuthenticatedUser,
  errorResponse,
  handleError,
  withRateLimit,
} from '@/lib/annotator';

/**
 * DELETE /api/annotator/training/[id]
 * Delete a specific training pair by ID
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
      return errorResponse('INVALID_REQUEST', 'Training pair ID is required', 400);
    }

    console.log(`[Training DELETE] Deleting training pair ${id} for user ${user.id}`);

    // Delete associated patterns first
    const { error: patternError } = await supabase
      .from('annotator_patterns')
      .delete()
      .eq('user_id', user.id)
      .eq('training_pair_id', id);

    if (patternError) {
      console.error('[Training DELETE] Failed to delete patterns:', patternError);
    }

    // Delete the training pair
    const { error } = await supabase
      .from('annotator_training_pairs')
      .delete()
      .eq('user_id', user.id)
      .eq('id', id);

    if (error) {
      console.error('[Training DELETE] Failed to delete training pair:', error);
      return errorResponse('DELETE_FAILED', 'Failed to delete training pair', 500);
    }

    console.log(`[Training DELETE] Successfully deleted training pair ${id}`);
    return NextResponse.json({
      success: true,
      deleted: 1,
    });
  } catch (error) {
    return handleError(error, 'Training DELETE');
  }
}

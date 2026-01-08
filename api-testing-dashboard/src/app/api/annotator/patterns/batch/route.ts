import { NextRequest, NextResponse } from 'next/server';
import {
  getSupabaseAdmin,
  getAuthenticatedUser,
  errorResponse,
  handleError,
  withRateLimit,
} from '@/lib/annotator';

interface PatternUpdate {
  id: string;
  confidence?: number;
  usageCount?: number;
  successRate?: number;
}

/**
 * PATCH /api/annotator/patterns/batch
 * Batch update multiple patterns at once
 * This is more efficient than individual updates
 */
export async function PATCH(request: NextRequest) {
  try {
    const rateLimit = withRateLimit(request, 20, 60000);
    if ('error' in rateLimit) return rateLimit.error;

    const supabase = getSupabaseAdmin();
    const user = getAuthenticatedUser(request);

    const { updates } = await request.json();

    if (!Array.isArray(updates) || updates.length === 0) {
      return errorResponse('INVALID_REQUEST', 'updates array is required', 400);
    }

    // Limit batch size
    const MAX_BATCH_SIZE = 50;
    if (updates.length > MAX_BATCH_SIZE) {
      return errorResponse('INVALID_REQUEST', `Maximum ${MAX_BATCH_SIZE} updates per batch`, 400);
    }

    // Validate updates
    const validUpdates: PatternUpdate[] = [];
    const errors: string[] = [];

    for (let i = 0; i < updates.length; i++) {
      const update = updates[i] as PatternUpdate;

      if (!update.id) {
        errors.push(`Update ${i}: id is required`);
        continue;
      }

      // Validate field values if present
      if (update.confidence !== undefined) {
        if (typeof update.confidence !== 'number' || update.confidence < 0 || update.confidence > 1) {
          errors.push(`Update ${i}: confidence must be between 0 and 1`);
          continue;
        }
      }

      if (update.usageCount !== undefined) {
        if (typeof update.usageCount !== 'number' || update.usageCount < 0) {
          errors.push(`Update ${i}: usageCount must be non-negative`);
          continue;
        }
      }

      if (update.successRate !== undefined) {
        if (typeof update.successRate !== 'number' || update.successRate < 0 || update.successRate > 1) {
          errors.push(`Update ${i}: successRate must be between 0 and 1`);
          continue;
        }
      }

      validUpdates.push(update);
    }

    if (validUpdates.length === 0) {
      return errorResponse('VALIDATION_FAILED', `All updates failed validation: ${errors.join('; ')}`, 400);
    }

    // Verify all patterns belong to the user
    const patternIds = validUpdates.map((u) => u.id);
    const { data: existingPatterns, error: fetchError } = await supabase
      .from('annotator_patterns')
      .select('id')
      .eq('user_id', user.id)
      .in('id', patternIds);

    if (fetchError) {
      return errorResponse('QUERY_FAILED', 'Failed to verify patterns', 500);
    }

    const existingIds = new Set((existingPatterns || []).map((p) => p.id));
    const unauthorizedIds = patternIds.filter((id) => !existingIds.has(id));

    if (unauthorizedIds.length > 0) {
      return errorResponse('UNAUTHORIZED', `Some patterns not found or not owned: ${unauthorizedIds.join(', ')}`, 403);
    }

    // Perform batch updates using Promise.all for parallelism
    const updateResults = await Promise.all(
      validUpdates.map(async (update) => {
        const updateData: Record<string, number> = {};
        if (update.confidence !== undefined) updateData.confidence = update.confidence;
        if (update.usageCount !== undefined) updateData.usage_count = update.usageCount;
        if (update.successRate !== undefined) updateData.success_rate = update.successRate;

        const { error } = await supabase
          .from('annotator_patterns')
          .update(updateData)
          .eq('id', update.id)
          .eq('user_id', user.id);

        return { id: update.id, success: !error, error: error?.message };
      })
    );

    const successCount = updateResults.filter((r) => r.success).length;
    const failedUpdates = updateResults.filter((r) => !r.success);

    console.log('[Patterns Batch] Updated:', {
      requested: validUpdates.length,
      success: successCount,
      failed: failedUpdates.length,
    });

    return NextResponse.json({
      success: true,
      updatedCount: successCount,
      failedCount: failedUpdates.length,
      validationErrors: errors.length > 0 ? errors : undefined,
      updateErrors: failedUpdates.length > 0 ? failedUpdates : undefined,
    });
  } catch (error) {
    return handleError(error, 'Patterns Batch PATCH');
  }
}

import { NextRequest, NextResponse } from 'next/server';
import {
  calculatePatternStats,
  getSupabaseAdmin,
  getAuthenticatedUser,
  errorResponse,
  handleError,
  withRateLimit,
} from '@/lib/annotator';
import type { Pattern, AnnotationType } from '@/types/annotator';

/**
 * GET /api/annotator/patterns
 * List all patterns for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimit = withRateLimit(request, 100, 60000);
    if ('error' in rateLimit) return rateLimit.error;

    const supabase = getSupabaseAdmin();
    const user = getAuthenticatedUser(request);

    // Parse query params
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as AnnotationType | null;
    const minConfidence = parseFloat(searchParams.get('minConfidence') || '0');
    const sortBy = searchParams.get('sortBy') || 'confidence';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Build query
    let query = supabase
      .from('annotator_patterns')
      .select('*')
      .eq('user_id', user.id);

    // Apply filters
    if (type) {
      query = query.eq('annotation_type', type);
    }
    if (minConfidence > 0) {
      query = query.gte('confidence', minConfidence);
    }

    // Apply sorting
    const validSortFields = ['confidence', 'usage_count', 'success_rate', 'created_at'];
    if (validSortFields.includes(sortBy)) {
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });
    }

    const { data: patterns, error } = await query;

    if (error) {
      console.error('Failed to fetch patterns:', error);
      return NextResponse.json(
        { error: 'Failed to fetch patterns' },
        { status: 500 }
      );
    }

    // Transform to frontend format
    const transformedPatterns: Pattern[] = (patterns || []).map((p) => ({
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

    // Calculate stats
    const stats = calculatePatternStats(transformedPatterns);

    return NextResponse.json({
      patterns: transformedPatterns,
      stats,
    });
  } catch (error) {
    return handleError(error, 'Patterns GET');
  }
}

/**
 * DELETE /api/annotator/patterns
 * Delete multiple patterns (bulk delete) or all patterns
 *
 * Body: { ids: string[] } - delete specific patterns
 * Body: { all: true } - delete ALL patterns for user
 */
export async function DELETE(request: NextRequest) {
  try {
    const rateLimit = withRateLimit(request, 30, 60000);
    if ('error' in rateLimit) return rateLimit.error;

    const supabase = getSupabaseAdmin();
    const user = getAuthenticatedUser(request);

    const body = await request.json();
    const { ids, all } = body;

    // Option 1: Delete all patterns for user
    if (all === true) {
      console.log(`[Patterns DELETE] Deleting ALL patterns for user ${user.id}`);

      // First count how many will be deleted
      const { count } = await supabase
        .from('annotator_patterns')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      const { error } = await supabase
        .from('annotator_patterns')
        .delete()
        .eq('user_id', user.id);

      if (error) {
        console.error('Failed to delete all patterns:', error);
        return errorResponse('DELETE_FAILED', 'Failed to delete patterns', 500);
      }

      console.log(`[Patterns DELETE] Deleted ${count} patterns`);
      return NextResponse.json({
        success: true,
        deleted: count || 0,
        message: 'All patterns deleted',
      });
    }

    // Option 2: Delete specific patterns by ID
    if (!Array.isArray(ids) || ids.length === 0) {
      return errorResponse('INVALID_REQUEST', 'ids array or {all: true} is required', 400);
    }

    const { error } = await supabase
      .from('annotator_patterns')
      .delete()
      .eq('user_id', user.id)
      .in('id', ids);

    if (error) {
      console.error('Failed to delete patterns:', error);
      return errorResponse('DELETE_FAILED', 'Failed to delete patterns', 500);
    }

    return NextResponse.json({
      success: true,
      deleted: ids.length,
    });
  } catch (error) {
    return handleError(error, 'Patterns DELETE');
  }
}

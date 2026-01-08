import { NextRequest, NextResponse } from 'next/server';
import {
  getSupabaseAdmin,
  getAuthenticatedUser,
  errorResponse,
  handleError,
  withRateLimit,
} from '@/lib/annotator';

/**
 * GET /api/annotator/feedback/rejected
 * Get frequently rejected patterns to avoid repeating mistakes
 * These are text patterns that users have consistently rejected
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimit = withRateLimit(request, 100, 60000);
    if ('error' in rateLimit) return rateLimit.error;

    const supabase = getSupabaseAdmin();
    const user = getAuthenticatedUser(request);

    // Parse query params with validation
    const { searchParams } = new URL(request.url);
    const minRejectionsParam = parseInt(searchParams.get('minRejections') || '2');
    const limitParam = parseInt(searchParams.get('limit') || '100');

    // Validate and constrain values
    const minRejections = Math.max(1, isNaN(minRejectionsParam) ? 2 : minRejectionsParam);
    const limit = Math.min(500, Math.max(1, isNaN(limitParam) ? 100 : limitParam));

    // Use the database function we created
    const { data: rejectedPatterns, error } = await supabase
      .rpc('get_rejected_patterns', {
        p_user_id: user.id,
        p_min_rejections: minRejections,
      })
      .limit(limit);

    if (error) {
      // Fallback to manual query if function doesn't exist
      console.warn('[Rejected GET] RPC failed, using fallback query:', error);

      const { data: fallbackData, error: fallbackError } = await supabase
        .from('annotator_feedback')
        .select('original_text, suggested_text, created_at')
        .eq('user_id', user.id)
        .eq('feedback_type', 'rejected');

      if (fallbackError) {
        return errorResponse('QUERY_FAILED', 'Failed to fetch rejected patterns', 500);
      }

      // Group and count manually
      const grouped = new Map<string, { count: number; lastRejected: Date; suggestedText: string }>();
      for (const item of fallbackData || []) {
        const key = item.original_text;
        const existing = grouped.get(key);
        if (existing) {
          existing.count++;
          if (new Date(item.created_at) > existing.lastRejected) {
            existing.lastRejected = new Date(item.created_at);
          }
        } else {
          grouped.set(key, {
            count: 1,
            lastRejected: new Date(item.created_at),
            suggestedText: item.suggested_text,
          });
        }
      }

      // Filter by min rejections and convert to array
      const patterns = Array.from(grouped.entries())
        .filter(([, v]) => v.count >= minRejections)
        .map(([originalText, v]) => ({
          originalText,
          suggestedText: v.suggestedText,
          rejectionCount: v.count,
          lastRejected: v.lastRejected,
        }))
        .sort((a, b) => b.rejectionCount - a.rejectionCount)
        .slice(0, limit);

      return NextResponse.json({
        patterns,
        total: patterns.length,
      });
    }

    // Transform RPC result
    const patterns = (rejectedPatterns || []).map((p: {
      original_text: string;
      suggested_text: string;
      rejection_count: number;
      last_rejected: string;
    }) => ({
      originalText: p.original_text,
      suggestedText: p.suggested_text,
      rejectionCount: p.rejection_count,
      lastRejected: new Date(p.last_rejected),
    }));

    return NextResponse.json({
      patterns,
      total: patterns.length,
    });
  } catch (error) {
    return handleError(error, 'Rejected GET');
  }
}

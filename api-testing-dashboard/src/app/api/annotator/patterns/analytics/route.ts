import { NextRequest, NextResponse } from 'next/server';
import {
  getSupabaseAdmin,
  getAuthenticatedUser,
  errorResponse,
  handleError,
  withRateLimit,
} from '@/lib/annotator';
import type { AnnotationType } from '@/types/annotator';

/**
 * GET /api/annotator/patterns/analytics
 * Get pattern performance analytics using the database view
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimit = withRateLimit(request, 50, 60000);
    if ('error' in rateLimit) return rateLimit.error;

    const supabase = getSupabaseAdmin();
    const user = getAuthenticatedUser(request);

    // Parse query params
    const { searchParams } = new URL(request.url);
    const minUsage = Math.max(0, parseInt(searchParams.get('minUsage') || '0') || 0);
    const sortBy = searchParams.get('sortBy') || 'confidence';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const limit = Math.min(500, Math.max(1, parseInt(searchParams.get('limit') || '100') || 100));

    // Try to use the performance view
    const { data: viewData, error: viewError } = await supabase
      .from('annotator_pattern_performance')
      .select('*')
      .eq('user_id', user.id)
      .gte('usage_count', minUsage)
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .limit(limit);

    if (viewError) {
      // Fallback: manually join patterns with feedback if view doesn't exist
      console.warn('[Analytics] View query failed, using fallback:', viewError);

      const { data: patterns, error: patternError } = await supabase
        .from('annotator_patterns')
        .select('*')
        .eq('user_id', user.id)
        .gte('usage_count', minUsage)
        .order(sortBy, { ascending: sortOrder === 'asc' })
        .limit(limit);

      if (patternError) {
        return errorResponse('QUERY_FAILED', 'Failed to fetch pattern analytics', 500);
      }

      // Get feedback counts for these patterns
      const patternIds = (patterns || []).map((p) => p.id);
      let feedbackCounts: Record<string, { accept: number; reject: number; edit: number }> = {};

      if (patternIds.length > 0) {
        const { data: feedbackData } = await supabase
          .from('annotator_feedback')
          .select('pattern_id, feedback_type')
          .eq('user_id', user.id)
          .in('pattern_id', patternIds);

        // Group feedback by pattern
        for (const f of feedbackData || []) {
          if (!f.pattern_id) continue;
          if (!feedbackCounts[f.pattern_id]) {
            feedbackCounts[f.pattern_id] = { accept: 0, reject: 0, edit: 0 };
          }
          if (f.feedback_type === 'accepted') feedbackCounts[f.pattern_id].accept++;
          else if (f.feedback_type === 'rejected') feedbackCounts[f.pattern_id].reject++;
          else if (f.feedback_type === 'edited') feedbackCounts[f.pattern_id].edit++;
        }
      }

      // Build response
      const analytics = (patterns || []).map((p) => {
        const counts = feedbackCounts[p.id] || { accept: 0, reject: 0, edit: 0 };
        const totalFeedback = counts.accept + counts.reject + counts.edit;
        return {
          patternId: p.id,
          userId: p.user_id,
          originalText: p.original_text,
          annotatedText: p.annotated_text,
          annotationType: p.annotation_type as AnnotationType,
          confidence: p.confidence,
          usageCount: p.usage_count,
          successRate: p.success_rate,
          negativeFeedbackCount: p.negative_feedback_count || 0,
          acceptCount: counts.accept,
          rejectCount: counts.reject,
          editCount: counts.edit,
          acceptanceRatePercent: totalFeedback > 0 ? Math.round((counts.accept / totalFeedback) * 1000) / 10 : null,
          createdAt: p.created_at,
        };
      });

      // Calculate summary stats
      const summary = calculateSummaryStats(analytics);

      return NextResponse.json({
        patterns: analytics,
        summary,
        total: analytics.length,
      });
    }

    // Transform view data
    const analytics = (viewData || []).map((p) => ({
      patternId: p.pattern_id,
      userId: p.user_id,
      originalText: p.original_text,
      annotatedText: p.annotated_text,
      annotationType: p.annotation_type as AnnotationType,
      confidence: p.confidence,
      usageCount: p.usage_count,
      successRate: p.success_rate,
      negativeFeedbackCount: p.negative_feedback_count || 0,
      acceptCount: p.accept_count || 0,
      rejectCount: p.reject_count || 0,
      editCount: p.edit_count || 0,
      acceptanceRatePercent: p.acceptance_rate_percent,
      createdAt: p.created_at,
    }));

    // Calculate summary stats
    const summary = calculateSummaryStats(analytics);

    return NextResponse.json({
      patterns: analytics,
      summary,
      total: analytics.length,
    });
  } catch (error) {
    return handleError(error, 'Analytics GET');
  }
}

interface PatternAnalytics {
  confidence: number;
  successRate: number;
  usageCount: number;
  acceptCount: number;
  rejectCount: number;
  editCount: number;
  annotationType: AnnotationType;
}

function calculateSummaryStats(patterns: PatternAnalytics[]) {
  if (patterns.length === 0) {
    return {
      totalPatterns: 0,
      avgConfidence: 0,
      avgSuccessRate: 0,
      totalUsage: 0,
      totalAccepts: 0,
      totalRejects: 0,
      totalEdits: 0,
      overallAcceptanceRate: null as number | null,
      byType: {} as Record<AnnotationType, number>,
      lowConfidenceCount: 0,
      highPerformanceCount: 0,
    };
  }

  const totalUsage = patterns.reduce((sum, p) => sum + p.usageCount, 0);
  const totalAccepts = patterns.reduce((sum, p) => sum + p.acceptCount, 0);
  const totalRejects = patterns.reduce((sum, p) => sum + p.rejectCount, 0);
  const totalEdits = patterns.reduce((sum, p) => sum + p.editCount, 0);
  const totalFeedback = totalAccepts + totalRejects + totalEdits;

  // Count by type
  const byType: Record<string, number> = {};
  for (const p of patterns) {
    byType[p.annotationType] = (byType[p.annotationType] || 0) + 1;
  }

  return {
    totalPatterns: patterns.length,
    avgConfidence: Math.round((patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length) * 100) / 100,
    avgSuccessRate: Math.round((patterns.reduce((sum, p) => sum + p.successRate, 0) / patterns.length) * 100) / 100,
    totalUsage,
    totalAccepts,
    totalRejects,
    totalEdits,
    overallAcceptanceRate: totalFeedback > 0 ? Math.round((totalAccepts / totalFeedback) * 1000) / 10 : null,
    byType: byType as Record<AnnotationType, number>,
    lowConfidenceCount: patterns.filter((p) => p.confidence < 0.5).length,
    highPerformanceCount: patterns.filter((p) => p.successRate >= 0.8 && p.usageCount >= 3).length,
  };
}

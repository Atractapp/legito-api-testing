import { NextRequest, NextResponse } from 'next/server';
import {
  getSupabaseAdmin,
  getAuthenticatedUser,
  handleError,
  withRateLimit,
} from '@/lib/annotator';
import type { SessionStatus } from '@/types/annotator';

/**
 * GET /api/annotator/sessions
 * List all sessions for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimit = withRateLimit(request, 100, 60000);
    if ('error' in rateLimit) return rateLimit.error;

    const supabase = getSupabaseAdmin();
    const user = getAuthenticatedUser(request);

    // Parse query params
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as SessionStatus | null;
    const limit = parseInt(searchParams.get('limit') || '50');

    // Build query
    let query = supabase
      .from('annotator_sessions')
      .select('id, input_filename, status, annotations_applied, created_at, completed_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: sessions, error } = await query;

    if (error) {
      console.error('Failed to fetch sessions:', error);
      return NextResponse.json(
        { error: 'Failed to fetch sessions' },
        { status: 500 }
      );
    }

    // Transform for frontend
    const summaries = (sessions || []).map((s) => ({
      id: s.id,
      inputFilename: s.input_filename,
      status: s.status as SessionStatus,
      annotationsCount: Array.isArray(s.annotations_applied)
        ? s.annotations_applied.length
        : 0,
      createdAt: s.created_at,
      completedAt: s.completed_at,
    }));

    return NextResponse.json({
      sessions: summaries,
      total: summaries.length,
    });
  } catch (error) {
    return handleError(error, 'Sessions GET');
  }
}

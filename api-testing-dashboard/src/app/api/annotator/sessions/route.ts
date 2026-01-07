import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { SessionStatus } from '@/types/annotator';

// Initialize Supabase client
function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase environment variables not configured');
  }

  return createClient(supabaseUrl, supabaseKey);
}

/**
 * GET /api/annotator/sessions
 * List all sessions for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const userId = request.headers.get('x-user-id') || 'default-user';

    // Parse query params
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as SessionStatus | null;
    const limit = parseInt(searchParams.get('limit') || '50');

    // Build query
    let query = supabase
      .from('annotator_sessions')
      .select('id, input_filename, status, annotations_applied, created_at, completed_at')
      .eq('user_id', userId)
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
    console.error('Sessions GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

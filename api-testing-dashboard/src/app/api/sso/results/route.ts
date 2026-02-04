import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isValidServerId } from '@/lib/sso/config';
import type { SsoTestResult, SsoTestResultRow, SsoServerId } from '@/types/sso';

/**
 * Get Supabase admin client
 */
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    throw new Error('Supabase credentials not configured');
  }

  return createClient(url, key);
}

/**
 * Transform database row to frontend format
 */
function transformResult(row: SsoTestResultRow): SsoTestResult {
  return {
    id: row.id,
    serverId: row.server_id as SsoServerId,
    status: row.status as SsoTestResult['status'],
    startedAt: new Date(row.started_at),
    completedAt: row.completed_at ? new Date(row.completed_at) : null,
    durationMs: row.duration_ms,
    errorMessage: row.error_message,
    errorType: row.error_type,
    screenshotUrl: row.screenshot_url,
    slackNotified: row.slack_notified,
    triggeredBy: row.triggered_by as SsoTestResult['triggeredBy'],
    metadata: row.metadata || {},
  };
}

/**
 * GET /api/sso/results
 * Get test results history
 *
 * Query params:
 * - serverId: Filter by server (optional)
 * - limit: Number of results (default 20, max 100)
 * - offset: Pagination offset (default 0)
 * - status: Filter by status (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const serverId = searchParams.get('serverId');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const status = searchParams.get('status');

    // Validate server ID if provided
    if (serverId && !isValidServerId(serverId)) {
      return NextResponse.json(
        { error: 'Invalid server ID' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Build query
    let query = supabase
      .from('sso_test_results')
      .select('*', { count: 'exact' })
      .order('started_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (serverId) {
      query = query.eq('server_id', serverId);
    }
    if (status) {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('[SSO Results] Query failed:', error);
      return NextResponse.json(
        { error: 'Failed to fetch results' },
        { status: 500 }
      );
    }

    const results = (data || []).map(transformResult);

    return NextResponse.json({
      results,
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error('[SSO Results] Unexpected error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

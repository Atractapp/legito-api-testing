import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isValidServerId } from '@/lib/sso/config';
import type { SsoServerStatus, SsoTestResult, SsoTestResultRow, SsoServerId } from '@/types/sso';

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
 * GET /api/sso/status
 * Get current status for a server
 *
 * Query params:
 * - serverId: Server to get status for (required)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const serverId = searchParams.get('serverId');

    if (!serverId || !isValidServerId(serverId)) {
      return NextResponse.json(
        { error: 'Invalid or missing server ID' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Get the most recent test
    const { data: lastTestData, error: lastTestError } = await supabase
      .from('sso_test_results')
      .select('*')
      .eq('server_id', serverId)
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    if (lastTestError && lastTestError.code !== 'PGRST116') {
      console.error('[SSO Status] Failed to fetch last test:', lastTestError);
    }

    // Check if there's a running test
    const { data: runningTest } = await supabase
      .from('sso_test_results')
      .select('id')
      .eq('server_id', serverId)
      .in('status', ['pending', 'running'])
      .limit(1)
      .single();

    // Get aggregate stats
    const { count: totalTests } = await supabase
      .from('sso_test_results')
      .select('*', { count: 'exact', head: true })
      .eq('server_id', serverId);

    const { count: successCount } = await supabase
      .from('sso_test_results')
      .select('*', { count: 'exact', head: true })
      .eq('server_id', serverId)
      .eq('status', 'success');

    const { count: failureCount } = await supabase
      .from('sso_test_results')
      .select('*', { count: 'exact', head: true })
      .eq('server_id', serverId)
      .in('status', ['failure', 'error']);

    // Get last success timestamp
    const { data: lastSuccess } = await supabase
      .from('sso_test_results')
      .select('completed_at')
      .eq('server_id', serverId)
      .eq('status', 'success')
      .order('completed_at', { ascending: false })
      .limit(1)
      .single();

    // Get last failure timestamp
    const { data: lastFailure } = await supabase
      .from('sso_test_results')
      .select('completed_at')
      .eq('server_id', serverId)
      .in('status', ['failure', 'error'])
      .order('completed_at', { ascending: false })
      .limit(1)
      .single();

    const total = totalTests || 0;
    const successes = successCount || 0;

    const status: SsoServerStatus = {
      serverId: serverId as SsoServerId,
      lastTest: lastTestData ? transformResult(lastTestData) : null,
      isRunning: !!runningTest,
      stats: {
        totalTests: total,
        successCount: successes,
        failureCount: failureCount || 0,
        successRate: total > 0 ? (successes / total) * 100 : 0,
        lastSuccessAt: lastSuccess?.completed_at ? new Date(lastSuccess.completed_at) : null,
        lastFailureAt: lastFailure?.completed_at ? new Date(lastFailure.completed_at) : null,
      },
    };

    return NextResponse.json({ status });
  } catch (error) {
    console.error('[SSO Status] Unexpected error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

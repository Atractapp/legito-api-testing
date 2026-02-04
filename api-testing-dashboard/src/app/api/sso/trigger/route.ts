import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isValidServerId, getServerConfig } from '@/lib/sso/config';
import type { SsoTriggerRequest, SsoTriggerResponse, SsoServerId } from '@/types/sso';

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
 * Validate API key for external requests
 * Internal requests (from dashboard) are allowed without key
 */
function validateRequest(request: NextRequest): { valid: boolean; error?: string } {
  const apiKey = request.headers.get('x-api-key');
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');

  // Allow requests from the dashboard (same origin)
  const allowedOrigins = [
    'https://api-testing-dashboard.vercel.app',
    'https://api-testing-dashboard-atracts-projects.vercel.app',
    'http://localhost:3000',
    'http://localhost:3001',
  ];

  const isInternalRequest = allowedOrigins.some(
    (allowed) => origin?.startsWith(allowed) || referer?.startsWith(allowed)
  );

  if (isInternalRequest) {
    return { valid: true };
  }

  // External requests require API key
  const expectedApiKey = process.env.SSO_API_KEY;

  if (!expectedApiKey) {
    // If no API key is configured, reject external requests
    return { valid: false, error: 'API key not configured on server' };
  }

  if (!apiKey) {
    return { valid: false, error: 'Missing X-API-Key header' };
  }

  if (apiKey !== expectedApiKey) {
    return { valid: false, error: 'Invalid API key' };
  }

  return { valid: true };
}

/**
 * POST /api/sso/trigger
 * Trigger an SSO test for a specific server
 *
 * Authentication:
 * - Dashboard requests (same origin): allowed automatically
 * - External webhook requests: require X-API-Key header
 */
export async function POST(request: NextRequest): Promise<NextResponse<SsoTriggerResponse>> {
  try {
    // Validate request authentication
    const authResult = validateRequest(request);
    if (!authResult.valid) {
      return NextResponse.json(
        {
          success: false,
          message: 'Unauthorized',
          error: authResult.error,
        },
        { status: 401 }
      );
    }

    const body: SsoTriggerRequest = await request.json();
    const { serverId, triggeredBy = 'manual' } = body;

    // Validate server ID
    if (!serverId || !isValidServerId(serverId)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid server ID',
          error: 'serverId must be one of: emea, us, quarterly',
        },
        { status: 400 }
      );
    }

    const serverConfig = getServerConfig(serverId as SsoServerId);
    const supabase = getSupabaseAdmin();

    // Create a pending test record
    const { data: testRecord, error: insertError } = await supabase
      .from('sso_test_results')
      .insert({
        server_id: serverId,
        status: 'pending',
        triggered_by: triggeredBy,
        metadata: {
          serverUrl: serverConfig.url,
          serverName: serverConfig.name,
        },
      })
      .select()
      .single();

    if (insertError) {
      console.error('[SSO Trigger] Failed to create test record:', insertError);
      return NextResponse.json(
        {
          success: false,
          message: 'Failed to create test record',
          error: insertError.message,
        },
        { status: 500 }
      );
    }

    // Get worker URL from environment
    const workerUrl = process.env.SSO_WORKER_URL;

    if (!workerUrl) {
      // No worker configured - update test record with error
      await supabase
        .from('sso_test_results')
        .update({
          status: 'error',
          completed_at: new Date().toISOString(),
          error_message: 'SSO Worker not configured',
          error_type: 'config_error',
        })
        .eq('id', testRecord.id);

      return NextResponse.json(
        {
          success: false,
          testId: testRecord.id,
          message: 'SSO Worker URL not configured',
          error: 'Set SSO_WORKER_URL environment variable',
        },
        { status: 503 }
      );
    }

    // Trigger the worker (fire and forget - worker will update DB directly)
    try {
      const workerApiKey = process.env.SSO_API_KEY;
      const workerResponse = await fetch(`${workerUrl}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(workerApiKey && { 'X-API-Key': workerApiKey }),
        },
        body: JSON.stringify({
          testId: testRecord.id,
          serverId,
          serverUrl: serverConfig.url,
        }),
      });

      if (!workerResponse.ok) {
        const errorData = await workerResponse.json().catch(() => ({}));
        console.error('[SSO Trigger] Worker returned error:', errorData);

        // Update test record with error
        await supabase
          .from('sso_test_results')
          .update({
            status: 'error',
            completed_at: new Date().toISOString(),
            error_message: errorData.error || 'Worker request failed',
            error_type: 'worker_error',
          })
          .eq('id', testRecord.id);

        return NextResponse.json(
          {
            success: false,
            testId: testRecord.id,
            message: 'Worker request failed',
            error: errorData.error || 'Unknown error',
          },
          { status: 502 }
        );
      }

      // Update test status to running
      await supabase
        .from('sso_test_results')
        .update({ status: 'running' })
        .eq('id', testRecord.id);

      console.log(`[SSO Trigger] Test ${testRecord.id} triggered for ${serverConfig.name}`);

      return NextResponse.json({
        success: true,
        testId: testRecord.id,
        message: `Test triggered for ${serverConfig.name}`,
      });
    } catch (workerError) {
      console.error('[SSO Trigger] Failed to contact worker:', workerError);

      // Update test record with error
      await supabase
        .from('sso_test_results')
        .update({
          status: 'error',
          completed_at: new Date().toISOString(),
          error_message: 'Failed to contact SSO worker',
          error_type: 'network_error',
        })
        .eq('id', testRecord.id);

      return NextResponse.json(
        {
          success: false,
          testId: testRecord.id,
          message: 'Failed to contact SSO worker',
          error: workerError instanceof Error ? workerError.message : 'Unknown error',
        },
        { status: 502 }
      );
    }
  } catch (error) {
    console.error('[SSO Trigger] Unexpected error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

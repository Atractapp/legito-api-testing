import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SSO_SERVERS } from '@/lib/sso/config';
import type { SsoServerId } from '@/types/sso';

/**
 * Get Supabase admin client
 */
export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    throw new Error('Supabase credentials not configured');
  }

  return createClient(url, key);
}

/**
 * Wait for a test to complete
 */
export async function waitForTestCompletion(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  testId: string,
  timeoutMs: number = 90000
): Promise<{ success: boolean; status: string; durationMs: number | null; error: string | null }> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const response = await supabase
      .from('sso_test_results')
      .select('status, duration_ms, error_message')
      .eq('id', testId)
      .single();

    if (response.error) {
      return { success: false, status: 'error', durationMs: null, error: response.error.message };
    }

    const data = response.data as { status: string; duration_ms: number | null; error_message: string | null } | null;

    if (!data) {
      return { success: false, status: 'error', durationMs: null, error: 'No data returned' };
    }

    if (data.status === 'success') {
      return { success: true, status: 'success', durationMs: data.duration_ms, error: null };
    }

    if (data.status === 'failure' || data.status === 'error') {
      return { success: false, status: data.status, durationMs: data.duration_ms, error: data.error_message };
    }

    // Still running, wait and poll again
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  return { success: false, status: 'timeout', durationMs: null, error: 'Test timed out after 90s' };
}

/**
 * Run healthcheck for a single server
 */
export async function runServerHealthcheck(serverId: SsoServerId) {
  const startTime = Date.now();

  try {
    const supabase = getSupabaseAdmin();
    const workerUrl = process.env.SSO_WORKER_URL;
    const apiKey = process.env.SSO_API_KEY;
    const serverConfig = SSO_SERVERS[serverId];

    if (!workerUrl) {
      return NextResponse.json(
        {
          healthy: false,
          server: serverConfig.name,
          serverId,
          url: serverConfig.url,
          message: 'SSO Worker not configured',
          totalDurationMs: Date.now() - startTime,
        },
        { status: 503 }
      );
    }

    // Create test record
    const insertResponse = await supabase
      .from('sso_test_results')
      .insert({
        server_id: serverId,
        status: 'pending',
        triggered_by: 'healthcheck',
        metadata: {
          serverUrl: serverConfig.url,
          serverName: serverConfig.name,
        },
      })
      .select()
      .single();

    const testRecord = insertResponse.data as { id: string } | null;
    const insertError = insertResponse.error;

    if (insertError || !testRecord) {
      return NextResponse.json(
        {
          healthy: false,
          server: serverConfig.name,
          serverId,
          url: serverConfig.url,
          message: insertError?.message || 'Failed to create test record',
          testId: null,
          totalDurationMs: Date.now() - startTime,
        },
        { status: 503 }
      );
    }

    // Trigger worker
    try {
      const workerResponse = await fetch(`${workerUrl}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey && { 'X-API-Key': apiKey }),
        },
        body: JSON.stringify({
          testId: testRecord.id,
          serverId,
          serverUrl: serverConfig.url,
        }),
      });

      if (!workerResponse.ok) {
        const errorData = await workerResponse.json().catch(() => ({}));
        return NextResponse.json(
          {
            healthy: false,
            server: serverConfig.name,
            serverId,
            url: serverConfig.url,
            message: errorData.error || 'Worker request failed',
            testId: testRecord.id,
            totalDurationMs: Date.now() - startTime,
          },
          { status: 503 }
        );
      }
    } catch (err) {
      return NextResponse.json(
        {
          healthy: false,
          server: serverConfig.name,
          serverId,
          url: serverConfig.url,
          message: err instanceof Error ? err.message : 'Failed to contact worker',
          testId: testRecord.id,
          totalDurationMs: Date.now() - startTime,
        },
        { status: 503 }
      );
    }

    // Wait for test completion
    const result = await waitForTestCompletion(supabase, testRecord.id);
    const totalDurationMs = Date.now() - startTime;

    const response = {
      healthy: result.success,
      server: serverConfig.name,
      serverId,
      url: serverConfig.url,
      message: result.success ? 'SSO test passed' : result.error || 'SSO test failed',
      status: result.status,
      testId: testRecord.id,
      durationMs: result.durationMs,
      totalDurationMs,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: result.success ? 200 : 503 });
  } catch (error) {
    return NextResponse.json(
      {
        healthy: false,
        server: SSO_SERVERS[serverId].name,
        serverId,
        url: SSO_SERVERS[serverId].url,
        message: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date().toISOString(),
        totalDurationMs: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}

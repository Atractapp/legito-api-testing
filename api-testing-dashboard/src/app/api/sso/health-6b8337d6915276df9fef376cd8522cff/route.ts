import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SSO_SERVERS } from '@/lib/sso/config';
import type { SsoServerId } from '@/types/sso';

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
 * Wait for a test to complete
 */
async function waitForTestCompletion(
  supabase: ReturnType<typeof createClient>,
  testId: string,
  timeoutMs: number = 90000
): Promise<{ success: boolean; status: string; durationMs: number | null; error: string | null }> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const { data, error } = await supabase
      .from('sso_test_results')
      .select('status, duration_ms, error_message')
      .eq('id', testId)
      .single();

    if (error) {
      return { success: false, status: 'error', durationMs: null, error: error.message };
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
 * GET /api/sso/health-6b8337d6915276df9fef376cd8522cff
 *
 * Health check endpoint that triggers SSO tests for all servers and waits for results.
 * Returns 200 if all pass, 503 if any fail.
 */
export async function GET() {
  const startTime = Date.now();
  const results: Record<string, {
    success: boolean;
    status: string;
    durationMs: number | null;
    error: string | null;
    testId: string | null;
  }> = {};

  try {
    const supabase = getSupabaseAdmin();
    const workerUrl = process.env.SSO_WORKER_URL;
    const apiKey = process.env.SSO_API_KEY;

    if (!workerUrl) {
      return NextResponse.json(
        {
          healthy: false,
          message: 'SSO Worker not configured',
          results: {},
          totalDurationMs: Date.now() - startTime,
        },
        { status: 503 }
      );
    }

    const serverIds: SsoServerId[] = ['emea', 'us', 'quarterly'];
    const testIds: Record<string, string> = {};

    // Trigger all tests in parallel
    const triggerPromises = serverIds.map(async (serverId) => {
      const serverConfig = SSO_SERVERS[serverId];

      // Create test record
      const { data: testRecord, error: insertError } = await supabase
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

      if (insertError || !testRecord) {
        results[serverId] = {
          success: false,
          status: 'error',
          durationMs: null,
          error: insertError?.message || 'Failed to create test record',
          testId: null,
        };
        return;
      }

      testIds[serverId] = testRecord.id;

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
          results[serverId] = {
            success: false,
            status: 'error',
            durationMs: null,
            error: errorData.error || 'Worker request failed',
            testId: testRecord.id,
          };
        }
      } catch (err) {
        results[serverId] = {
          success: false,
          status: 'error',
          durationMs: null,
          error: err instanceof Error ? err.message : 'Failed to contact worker',
          testId: testRecord.id,
        };
      }
    });

    await Promise.all(triggerPromises);

    // Wait for all tests to complete
    const completionPromises = serverIds.map(async (serverId) => {
      // Skip if already failed during trigger
      if (results[serverId]) return;

      const testId = testIds[serverId];
      if (!testId) {
        results[serverId] = {
          success: false,
          status: 'error',
          durationMs: null,
          error: 'No test ID',
          testId: null,
        };
        return;
      }

      const result = await waitForTestCompletion(supabase, testId);
      results[serverId] = {
        ...result,
        testId,
      };
    });

    await Promise.all(completionPromises);

    // Check if all passed
    const allPassed = Object.values(results).every(r => r.success);
    const totalDurationMs = Date.now() - startTime;

    const response = {
      healthy: allPassed,
      message: allPassed ? 'All SSO tests passed' : 'One or more SSO tests failed',
      timestamp: new Date().toISOString(),
      totalDurationMs,
      results: Object.fromEntries(
        Object.entries(results).map(([serverId, result]) => [
          serverId,
          {
            server: SSO_SERVERS[serverId as SsoServerId].name,
            url: SSO_SERVERS[serverId as SsoServerId].url,
            ...result,
          },
        ])
      ),
    };

    return NextResponse.json(response, { status: allPassed ? 200 : 503 });
  } catch (error) {
    return NextResponse.json(
      {
        healthy: false,
        message: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date().toISOString(),
        totalDurationMs: Date.now() - startTime,
        results,
      },
      { status: 500 }
    );
  }
}

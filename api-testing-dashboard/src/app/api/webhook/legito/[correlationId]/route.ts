import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Create Supabase client for each request to ensure fresh connection
function getSupabase(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}

interface WebhookPayload {
  eventType?: string;
  [key: string]: unknown;
}

/**
 * POST /api/webhook/legito/[correlationId]
 *
 * Receives webhooks from Legito push connections and stores them in Supabase
 * for later verification by the test runner.
 *
 * The correlationId is used to match webhooks to specific test runs.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ correlationId: string }> }
) {
  try {
    const { correlationId } = await params;

    // Parse the incoming webhook payload
    let payload: WebhookPayload;
    try {
      payload = await request.json();
    } catch {
      payload = { eventType: 'unknown', raw: await request.text() };
    }

    // Extract headers for debugging
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });

    // Store the webhook in Supabase
    console.log(`[Webhook POST] Storing webhook for correlation ID: ${correlationId}`);

    const insertData = {
      correlation_id: correlationId,
      event_type: payload.eventType || 'unknown',
      payload: payload,
      headers: headers,
      received_at: new Date().toISOString(),
      processed: false,
    };

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('webhook_payloads')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('[Webhook POST] Failed to store webhook payload:', error);
      console.error('[Webhook POST] Insert data was:', JSON.stringify(insertData).substring(0, 500));
      // Still return success to Legito so it doesn't retry
      return NextResponse.json(
        { success: true, warning: 'Failed to store payload', error: error.message },
        { status: 200 }
      );
    }

    console.log(`[Webhook POST] Successfully stored webhook:`, {
      id: data?.id,
      correlationId: correlationId,
      eventType: payload.eventType,
    });

    return NextResponse.json({
      success: true,
      id: data?.id,
      correlationId,
    });
  } catch (error) {
    console.error('Webhook handler error:', error);
    // Return success anyway to prevent retries
    return NextResponse.json(
      { success: true, warning: 'Internal error occurred' },
      { status: 200 }
    );
  }
}

/**
 * GET /api/webhook/legito/[correlationId]
 *
 * Retrieves stored webhooks for a given correlation ID.
 * Used by the test runner to verify webhooks were received.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ correlationId: string }> }
) {
  try {
    const { correlationId } = await params;
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const waitMs = parseInt(url.searchParams.get('wait') || '0');

    console.log(`[Webhook GET] Looking for correlation ID: ${correlationId}, wait: ${waitMs}ms`);

    const supabase = getSupabase();

    // If wait is specified, poll for the webhook
    if (waitMs > 0) {
      const startTime = Date.now();
      const pollInterval = 1000; // 1 second
      let pollCount = 0;

      while (Date.now() - startTime < waitMs) {
        pollCount++;
        const { data, error } = await supabase
          .from('webhook_payloads')
          .select('*')
          .eq('correlation_id', correlationId)
          .eq('processed', false)
          .order('received_at', { ascending: false })
          .limit(1);

        if (error) {
          console.log(`[Webhook GET] Poll ${pollCount} - Supabase error:`, error);
        }

        if (data && data.length > 0) {
          console.log(`[Webhook GET] Poll ${pollCount} - Found webhook:`, data[0].id);
          // Mark as processed
          await supabase
            .from('webhook_payloads')
            .update({ processed: true })
            .eq('id', data[0].id);

          return NextResponse.json({
            success: true,
            found: true,
            webhook: data[0],
          });
        }

        // Log first poll and every 5th poll
        if (pollCount === 1 || pollCount % 5 === 0) {
          console.log(`[Webhook GET] Poll ${pollCount} - No webhook yet (${Date.now() - startTime}ms elapsed)`);
        }

        // Wait before polling again
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }

      // Timeout - check one more time without the processed filter to debug
      const { data: allData, error: finalError } = await supabase
        .from('webhook_payloads')
        .select('id, correlation_id, processed, received_at')
        .eq('correlation_id', correlationId)
        .limit(5);

      console.log(`[Webhook GET] Timeout - final check for ${correlationId}:`,
        finalError ? `Error: ${finalError.message}` : `Found ${allData?.length || 0} records`, allData);

      // Timeout - no webhook received
      return NextResponse.json({
        success: true,
        found: false,
        message: `No webhook received within ${waitMs}ms`,
        debug: { pollCount, allRecords: allData?.length || 0 },
      });
    }

    // Simple fetch without waiting
    const { data, error } = await supabase
      .from('webhook_payloads')
      .select('*')
      .eq('correlation_id', correlationId)
      .order('received_at', { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      count: data?.length || 0,
      webhooks: data || [],
    });
  } catch (error) {
    console.error('Webhook fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch webhooks' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/webhook/legito/[correlationId]
 *
 * Cleans up webhooks for a given correlation ID.
 * Used after tests complete to keep the table clean.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ correlationId: string }> }
) {
  try {
    const { correlationId } = await params;

    const supabase = getSupabase();
    const { error, count } = await supabase
      .from('webhook_payloads')
      .delete()
      .eq('correlation_id', correlationId);

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      deleted: count || 0,
    });
  } catch (error) {
    console.error('Webhook cleanup error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to clean up webhooks' },
      { status: 500 }
    );
  }
}

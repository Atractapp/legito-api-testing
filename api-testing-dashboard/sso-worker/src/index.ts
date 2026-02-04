/**
 * SSO Worker - Express server for running SSO tests
 * Connects to Browserless for Playwright browser automation
 */

import express, { Request, Response } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { runSsoTest, SsoTestResult } from './sso-test.js';
import { sendSlackNotification } from './slack-notifier.js';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;

// Server name mapping
const SERVER_NAMES: Record<string, string> = {
  emea: 'EMEA',
  us: 'US',
  quarterly: 'Quarterly',
};

/**
 * Get Supabase client
 */
function getSupabase(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    throw new Error('Supabase credentials not configured');
  }

  return createClient(url, key);
}

/**
 * Health check endpoint
 */
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    env: {
      hasBrowserEndpoint: !!process.env.BROWSER_PLAYWRIGHT_ENDPOINT,
      hasSupabase: !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY),
      hasSlack: !!process.env.SLACK_WEBHOOK_URL,
      hasSsoCredentials: !!(process.env.SSO_TEST_EMAIL && process.env.SSO_TEST_PASSWORD),
    },
  });
});

/**
 * Run SSO test endpoint
 */
app.post('/test', async (req: Request, res: Response) => {
  const { testId, serverId, serverUrl } = req.body;

  if (!testId || !serverId || !serverUrl) {
    res.status(400).json({ error: 'testId, serverId, and serverUrl are required' });
    return;
  }

  // Validate environment
  const browserEndpoint = process.env.BROWSER_PLAYWRIGHT_ENDPOINT;
  const browserToken = process.env.BROWSER_TOKEN;
  const email = process.env.SSO_TEST_EMAIL;
  const password = process.env.SSO_TEST_PASSWORD;

  if (!browserEndpoint) {
    res.status(503).json({ error: 'Browser endpoint not configured' });
    return;
  }

  if (!email || !password) {
    res.status(503).json({ error: 'SSO credentials not configured' });
    return;
  }

  // Acknowledge the request immediately
  res.json({ accepted: true, testId });

  // Run the test in the background
  runTestInBackground(testId, serverId, serverUrl, {
    browserEndpoint,
    browserToken,
    email,
    password,
  });
});

/**
 * Run test in background and update database
 */
async function runTestInBackground(
  testId: string,
  serverId: string,
  serverUrl: string,
  config: {
    browserEndpoint: string;
    browserToken?: string;
    email: string;
    password: string;
  }
): Promise<void> {
  const supabase = getSupabase();
  const serverName = SERVER_NAMES[serverId] || serverId;

  console.log(`[Worker] Starting test ${testId} for ${serverName}`);

  // Update status to running
  await supabase
    .from('sso_test_results')
    .update({ status: 'running' })
    .eq('id', testId);

  let result: SsoTestResult;

  try {
    result = await runSsoTest({
      serverUrl,
      email: config.email,
      password: config.password,
      browserEndpoint: config.browserEndpoint,
      browserToken: config.browserToken,
    });
  } catch (error) {
    result = {
      success: false,
      durationMs: 0,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      errorType: 'worker_error',
    };
  }

  // Update database with result
  const updateData = {
    status: result.success ? 'success' : 'failure',
    completed_at: new Date().toISOString(),
    duration_ms: result.durationMs,
    error_message: result.errorMessage || null,
    error_type: result.errorType || null,
    // Note: screenshot_url would require uploading to storage first
  };

  const { error: updateError } = await supabase
    .from('sso_test_results')
    .update(updateData)
    .eq('id', testId);

  if (updateError) {
    console.error(`[Worker] Failed to update test ${testId}:`, updateError);
  } else {
    console.log(`[Worker] Test ${testId} completed: ${result.success ? 'SUCCESS' : 'FAILURE'}`);
  }

  // Send Slack notification
  try {
    const slackSent = await sendSlackNotification({
      serverId,
      serverName,
      status: result.success ? 'success' : 'failure',
      durationMs: result.durationMs,
      timestamp: new Date(),
      errorMessage: result.errorMessage,
    });

    if (slackSent) {
      await supabase
        .from('sso_test_results')
        .update({ slack_notified: true })
        .eq('id', testId);
    }
  } catch (slackError) {
    console.error('[Worker] Failed to send Slack notification:', slackError);
  }
}

// Start server
app.listen(PORT, () => {
  console.log(`[SSO Worker] Server running on port ${PORT}`);
  console.log('[SSO Worker] Environment check:');
  console.log(`  - Browser endpoint: ${process.env.BROWSER_PLAYWRIGHT_ENDPOINT ? 'configured' : 'MISSING'}`);
  console.log(`  - Supabase: ${process.env.SUPABASE_URL ? 'configured' : 'MISSING'}`);
  console.log(`  - Slack: ${process.env.SLACK_WEBHOOK_URL ? 'configured' : 'not configured'}`);
  console.log(`  - SSO credentials: ${process.env.SSO_TEST_EMAIL ? 'configured' : 'MISSING'}`);
});

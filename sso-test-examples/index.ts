/**
 * SSO Worker - Express HTTP Server
 *
 * Runs SSO tests via Playwright connecting to Browserless via CDP.
 * Updates test results in Supabase and sends Slack notifications.
 */

import express, { Request, Response } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { runSsoTest, SsoTestRequest } from './sso-test.js';
import { sendSlackNotification } from './slack-notifier.js';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Active tests tracking (to prevent duplicate runs)
const activeTests = new Set<string>();

/**
 * Middleware to validate API key for protected endpoints
 */
function validateApiKey(req: Request, res: Response, next: () => void) {
  const apiKey = req.headers['x-api-key'];
  const expectedKey = process.env.SSO_API_KEY;

  if (!expectedKey) {
    console.warn('[Worker] SSO_API_KEY not configured - rejecting request');
    res.status(500).json({ error: 'API key not configured on server' });
    return;
  }

  if (!apiKey) {
    res.status(401).json({ error: 'Missing X-API-Key header' });
    return;
  }

  if (apiKey !== expectedKey) {
    res.status(401).json({ error: 'Invalid API key' });
    return;
  }

  next();
}

/**
 * Get Supabase client
 */
function getSupabase(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    throw new Error('Supabase credentials not configured (SUPABASE_URL, SUPABASE_SERVICE_KEY)');
  }

  return createClient(url, key);
}

/**
 * Health check endpoint
 */
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    version: '1.0.0',
    activeTests: activeTests.size,
    timestamp: new Date().toISOString(),
  });
});

/**
 * Trigger SSO test endpoint
 * POST /test
 * Body: { testId, serverId, serverUrl }
 * Requires X-API-Key header
 */
app.post('/test', (req, res, next) => validateApiKey(req, res, next), async (req: Request, res: Response) => {
  const { testId, serverId, serverUrl } = req.body as SsoTestRequest;

  // Validate request
  if (!testId || !serverId || !serverUrl) {
    res.status(400).json({
      error: 'Missing required fields: testId, serverId, serverUrl',
    });
    return;
  }

  // Check if test is already running
  if (activeTests.has(testId)) {
    res.status(409).json({
      error: 'Test is already running',
      testId,
    });
    return;
  }

  // Mark test as running
  activeTests.add(testId);

  // Respond immediately (test runs in background)
  res.json({
    success: true,
    message: 'Test started',
    testId,
  });

  // Run test in background
  runTestAndUpdate(testId, serverId, serverUrl).catch((error) => {
    console.error(`[Worker] Unhandled error in test ${testId}:`, error);
  }).finally(() => {
    activeTests.delete(testId);
  });
});

/**
 * Run the SSO test and update the database
 */
async function runTestAndUpdate(
  testId: string,
  serverId: string,
  serverUrl: string
): Promise<void> {
  const supabase = getSupabase();
  const startTime = new Date();

  // Update status to running
  await supabase
    .from('sso_test_results')
    .update({ status: 'running' })
    .eq('id', testId);

  console.log(`[Worker] Starting test ${testId} for ${serverId}`);

  // Run the actual test
  const result = await runSsoTest({
    testId,
    serverId,
    serverUrl,
  });

  const completedAt = new Date();
  const status = result.success ? 'success' : 'failure';

  console.log(`[Worker] Test ${testId} completed: ${status} in ${result.durationMs}ms`);

  // Update database with results
  const updateData: Record<string, unknown> = {
    status,
    completed_at: completedAt.toISOString(),
    duration_ms: result.durationMs,
  };

  if (!result.success) {
    updateData.error_message = result.errorMessage;
    updateData.error_type = result.errorType;
  }

  // Store screenshot URL if we have one (would need storage service for actual URL)
  // For now, we'll store a flag indicating screenshot is available
  if (result.screenshotBase64) {
    updateData.metadata = {
      hasScreenshot: true,
      screenshotLength: result.screenshotBase64.length,
    };
  }

  const { error: updateError } = await supabase
    .from('sso_test_results')
    .update(updateData)
    .eq('id', testId);

  if (updateError) {
    console.error(`[Worker] Failed to update test ${testId}:`, updateError);
  }

  // Send Slack notification
  const serverNames: Record<string, string> = {
    emea: 'EMEA',
    us: 'US',
    quarterly: 'Quarterly',
  };

  const slackSent = await sendSlackNotification({
    serverId,
    serverName: serverNames[serverId] || serverId.toUpperCase(),
    status: result.success ? 'success' : 'failure',
    durationMs: result.durationMs,
    timestamp: completedAt,
    errorMessage: result.errorMessage,
  });

  // Update slack_notified flag
  if (slackSent) {
    await supabase
      .from('sso_test_results')
      .update({ slack_notified: true })
      .eq('id', testId);
  }

  console.log(`[Worker] Test ${testId} processing complete (Slack: ${slackSent ? 'sent' : 'skipped'})`);
}

/**
 * Get status of a specific test
 * GET /test/:testId
 */
app.get('/test/:testId', async (req: Request, res: Response) => {
  const { testId } = req.params;

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('sso_test_results')
      .select('*')
      .eq('id', testId)
      .single();

    if (error) {
      res.status(404).json({ error: 'Test not found' });
      return;
    }

    res.json({
      testId,
      isActive: activeTests.has(testId),
      ...data,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * List active tests
 * GET /tests/active
 */
app.get('/tests/active', (_req: Request, res: Response) => {
  res.json({
    count: activeTests.size,
    testIds: Array.from(activeTests),
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`[Worker] SSO Worker listening on port ${PORT}`);
  console.log(`[Worker] Environment check:`);
  console.log(`  - BROWSER_PLAYWRIGHT_ENDPOINT: ${process.env.BROWSER_PLAYWRIGHT_ENDPOINT ? 'configured' : 'NOT SET'}`);
  console.log(`  - BROWSER_TOKEN: ${process.env.BROWSER_TOKEN ? 'configured' : 'NOT SET'}`);
  console.log(`  - SSO_TEST_EMAIL: ${process.env.SSO_TEST_EMAIL ? 'configured' : 'NOT SET'}`);
  console.log(`  - SSO_TEST_PASSWORD: ${process.env.SSO_TEST_PASSWORD ? 'configured' : 'NOT SET'}`);
  console.log(`  - SLACK_WEBHOOK_URL: ${process.env.SLACK_WEBHOOK_URL ? 'configured' : 'NOT SET'}`);
  console.log(`  - SUPABASE_URL: ${process.env.SUPABASE_URL ? 'configured' : 'NOT SET'}`);
  console.log(`  - SUPABASE_SERVICE_KEY: ${process.env.SUPABASE_SERVICE_KEY ? 'configured' : 'NOT SET'}`);
  console.log(`  - SSO_API_KEY: ${process.env.SSO_API_KEY ? 'configured' : 'NOT SET'}`);
});

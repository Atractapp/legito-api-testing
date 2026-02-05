import { runServerHealthcheck } from '../health-shared';

/**
 * GET /api/sso/health-quarterly-5b8e2a1d7f4c6930
 *
 * Health check endpoint for Quarterly SSO server.
 * Returns 200 if test passes, 503 if it fails.
 */
export async function GET() {
  return runServerHealthcheck('quarterly');
}

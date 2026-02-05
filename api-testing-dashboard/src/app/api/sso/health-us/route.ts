import { runServerHealthcheck } from '../health-shared';

/**
 * GET /api/sso/health-us
 *
 * Health check endpoint for US SSO server.
 * Returns 200 if test passes, 503 if it fails.
 */
export async function GET() {
  return runServerHealthcheck('us');
}

import { runServerHealthcheck } from '../health-shared';

/**
 * GET /api/sso/health-us-9e2d4f6a8c1b3570
 *
 * Health check endpoint for US SSO server.
 * Returns 200 if test passes, 503 if it fails.
 */
export async function GET() {
  return runServerHealthcheck('us');
}

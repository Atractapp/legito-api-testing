import { runServerHealthcheck } from '../health-shared';

/**
 * GET /api/sso/health-emea
 *
 * Health check endpoint for EMEA SSO server.
 * Returns 200 if test passes, 503 if it fails.
 */
export async function GET() {
  return runServerHealthcheck('emea');
}

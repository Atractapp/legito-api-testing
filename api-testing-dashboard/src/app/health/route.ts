/**
 * Health Check Endpoint for Headless Annotator
 *
 * GET /health
 *
 * Returns:
 * - 200 OK: Service is healthy
 * - 500 Internal Server Error: Service is unhealthy
 *
 * Response body (JSON):
 * {
 *   "status": "healthy" | "unhealthy",
 *   "patternsLoaded": number,
 *   "patternsFile": string | null,
 *   "version": string,
 *   "timestamp": string
 * }
 */

// Force Node.js runtime (not Edge) for file system access
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { isHealthy, getServiceStatus } from '@/lib/annotator/headless';

export async function GET() {
  try {
    let status;
    try {
      status = getServiceStatus();
    } catch (serviceError) {
      console.error('[health] getServiceStatus error:', serviceError);
      return NextResponse.json(
        {
          status: 'unhealthy',
          error: serviceError instanceof Error ? serviceError.message : 'Service status error',
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      );
    }

    const response = {
      status: status.healthy ? 'healthy' : 'unhealthy',
      patternsLoaded: status.patternsLoaded,
      patternsFile: status.patternsFile,
      version: status.version,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: status.healthy ? 200 : 500 });
  } catch (error) {
    console.error('[health] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        status: 'unhealthy',
        error: errorMessage,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// Also support HEAD requests for simple health checks
export async function HEAD() {
  try {
    const healthy = isHealthy();
    return new NextResponse(null, { status: healthy ? 200 : 500 });
  } catch {
    return new NextResponse(null, { status: 500 });
  }
}

// Edge Function: Health Check Endpoint
// Path: /api/health
// This endpoint is used for deployment verification and monitoring

import { NextRequest, NextResponse } from 'next/server';

export const config = {
  runtime: 'edge',
};

export default async function handler(req: NextRequest): Promise<NextResponse> {
  try {
    // Check database connectivity
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Missing Supabase configuration',
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      );
    }

    // Verify database connectivity
    const dbHealthCheck = await fetch(`${supabaseUrl}/rest/v1/api_test_suites?limit=1&select=id`, {
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!dbHealthCheck.ok) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Database health check failed',
          timestamp: new Date().toISOString(),
          details: {
            statusCode: dbHealthCheck.status,
            statusText: dbHealthCheck.statusText,
          },
        },
        { status: 503 }
      );
    }

    // Check memory usage
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const memUsage = process.memoryUsage();
      const heapUsedPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

      if (heapUsedPercent > 90) {
        console.warn(`High memory usage detected: ${heapUsedPercent.toFixed(2)}%`);
      }
    }

    return NextResponse.json(
      {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.NEXT_PUBLIC_VERSION || 'unknown',
        environment: process.env.NEXT_PUBLIC_ENVIRONMENT || 'production',
        uptime: process.uptime?.() || 'unknown',
        checks: {
          database: 'ok',
          api: 'ok',
          memory: 'ok',
        },
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, must-revalidate',
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Health check failed:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: 'Health check failed',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}

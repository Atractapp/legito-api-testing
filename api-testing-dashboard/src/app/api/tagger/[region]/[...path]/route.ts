import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';

function getBaseUrl(region: string): string {
  return `https://${region}.legito.com/api/v7`;
}

/**
 * Creates a JWT token for Legito API authentication
 * Uses HS256 (HMAC-SHA256) signing
 */
function createJwtToken(apiKey: string, privateKey: string): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: apiKey,
    iat: now,
    exp: now + 3600, // 1 hour expiry
  };

  const base64UrlEncode = (data: string): string => {
    return Buffer.from(data)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  };

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const signatureInput = `${headerB64}.${payloadB64}`;

  // Create HMAC-SHA256 signature using the private key
  const signature = createHmac('sha256', privateKey)
    .update(signatureInput)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return `${headerB64}.${payloadB64}.${signature}`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ region: string; path: string[] }> }
) {
  return handleRequest(request, params, 'GET');
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ region: string; path: string[] }> }
) {
  return handleRequest(request, params, 'POST');
}

async function handleRequest(
  request: NextRequest,
  paramsPromise: Promise<{ region: string; path: string[] }>,
  method: string
) {
  const { region, path } = await paramsPromise;
  const baseUrl = getBaseUrl(region);
  const endpoint = '/' + path.join('/');
  const url = `${baseUrl}${endpoint}${request.nextUrl.search}`;

  // Get credentials from custom headers
  const apiKey = request.headers.get('X-Legito-Key');
  const privateKey = request.headers.get('X-Legito-Private-Key');

  if (!apiKey || !privateKey) {
    return NextResponse.json(
      { error: 'API credentials required (X-Legito-Key and X-Legito-Private-Key headers)' },
      { status: 401 }
    );
  }

  // Create JWT token server-side
  const jwtToken = createJwtToken(apiKey, privateKey);

  const headers: HeadersInit = {
    'Authorization': `Bearer ${jwtToken}`,
    'Content-Type': 'application/json',
  };

  const fetchOptions: RequestInit = {
    method,
    headers,
  };

  if (method === 'POST') {
    try {
      const body = await request.text();
      if (body) {
        fetchOptions.body = body;
      }
    } catch {
      // No body
    }
  }

  try {
    const response = await fetch(url, fetchOptions);
    const contentType = response.headers.get('content-type');

    let data;
    if (contentType?.includes('application/json')) {
      try {
        data = await response.json();
      } catch {
        data = null;
      }
    } else {
      data = await response.text();
    }

    return NextResponse.json(data, {
      status: response.status,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Legito-Key, X-Legito-Private-Key',
    },
  });
}

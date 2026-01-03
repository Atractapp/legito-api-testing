import { NextRequest, NextResponse } from 'next/server';

const DEFAULT_BASE_URL = 'https://emea.legito.com/api/v7';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return handleRequest(request, params, 'GET');
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return handleRequest(request, params, 'POST');
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return handleRequest(request, params, 'PUT');
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return handleRequest(request, params, 'DELETE');
}

async function handleRequest(
  request: NextRequest,
  paramsPromise: Promise<{ path: string[] }>,
  method: string
) {
  const { path } = await paramsPromise;
  const endpoint = '/' + path.join('/');

  // Allow custom base URL via header (for different regions)
  const baseUrl = request.headers.get('X-Legito-BaseUrl') || DEFAULT_BASE_URL;
  const url = `${baseUrl}${endpoint}${request.nextUrl.search}`;

  // Get authorization header from request
  const authHeader = request.headers.get('Authorization');

  if (!authHeader) {
    return NextResponse.json(
      { error: 'Authorization header required' },
      { status: 401 }
    );
  }

  // Prepare headers for Legito API
  const headers: HeadersInit = {
    'Authorization': authHeader,
    'Content-Type': 'application/json',
  };

  // Prepare fetch options
  const fetchOptions: RequestInit = {
    method,
    headers,
  };

  // Add body for POST/PUT requests
  if (method === 'POST' || method === 'PUT') {
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
    const startTime = Date.now();
    const response = await fetch(url, fetchOptions);
    const duration = Date.now() - startTime;

    // Get response body
    let data;
    const contentType = response.headers.get('content-type');

    if (contentType?.includes('application/json')) {
      try {
        data = await response.json();
      } catch {
        data = null;
      }
    } else {
      data = await response.text();
    }

    // Return proxied response with CORS headers
    return NextResponse.json(
      {
        data,
        status: response.status,
        statusText: response.statusText,
        duration,
      },
      {
        status: 200, // Always return 200 from proxy, actual status is in body
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'X-Legito-Status': response.status.toString(),
          'X-Legito-Duration': duration.toString(),
        },
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: errorMessage,
        status: 0,
        statusText: 'Network Error',
      },
      { status: 200 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

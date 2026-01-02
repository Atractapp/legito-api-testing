import { NextRequest, NextResponse } from 'next/server';

function getBaseUrl(region: string): string {
  return `https://${region}.legito.com/api/v7`;
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

  const authHeader = request.headers.get('Authorization');

  if (!authHeader) {
    return NextResponse.json(
      { error: 'Authorization header required' },
      { status: 401 }
    );
  }

  const headers: HeadersInit = {
    'Authorization': authHeader,
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
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

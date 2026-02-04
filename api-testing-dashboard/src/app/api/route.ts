/**
 * Main Annotation Endpoint for Headless Annotator
 *
 * POST /
 *
 * Accepts a DOCX file via multipart/form-data and returns an annotated DOCX.
 *
 * Request:
 * - Content-Type: multipart/form-data
 * - Body: file field with .docx file
 *
 * Response:
 * - 200 OK: Annotated DOCX file (application/vnd.openxmlformats-officedocument.wordprocessingml.document)
 * - 422 Unprocessable Entity: Invalid input (wrong file type, too large, etc.)
 * - 500 Internal Server Error: Processing error
 *
 * Headers in successful response:
 * - Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document
 * - Content-Disposition: attachment; filename="annotated-{original-filename}"
 * - X-Suggestions-Count: number
 * - X-Processing-Time-Ms: number
 */

// Force Node.js runtime (not Edge) for file system access
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { annotateHeadless, type AnnotateHeadlessError } from '@/lib/annotator/headless';

// Maximum file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Valid DOCX MIME types
const VALID_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/octet-stream', // Some clients send this
];

// DOCX magic bytes (PK signature for ZIP)
const DOCX_MAGIC_BYTES = [0x50, 0x4b, 0x03, 0x04];

/**
 * Validate that the buffer is a valid DOCX file (ZIP archive).
 */
function isValidDocx(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;

  // Check PK signature
  for (let i = 0; i < DOCX_MAGIC_BYTES.length; i++) {
    if (buffer[i] !== DOCX_MAGIC_BYTES[i]) {
      return false;
    }
  }

  return true;
}

/**
 * Extract filename without extension.
 */
function getBaseFilename(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  return lastDot > 0 ? filename.substring(0, lastDot) : filename;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Get form data
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        {
          error: 'Invalid request',
          message: 'Expected multipart/form-data with a file field',
          code: 'INVALID_REQUEST',
        },
        { status: 422 }
      );
    }

    // Get file from form data
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        {
          error: 'Missing file',
          message: 'Request must include a "file" field with a DOCX file',
          code: 'MISSING_FILE',
        },
        { status: 422 }
      );
    }

    // Validate file extension
    const filename = file.name || 'document.docx';
    if (!filename.toLowerCase().endsWith('.docx')) {
      return NextResponse.json(
        {
          error: 'Invalid file type',
          message: 'File must be a .docx file',
          code: 'INVALID_FILE_TYPE',
        },
        { status: 422 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: 'File too large',
          message: `File size ${(file.size / 1024 / 1024).toFixed(2)}MB exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
          code: 'FILE_TOO_LARGE',
        },
        { status: 422 }
      );
    }

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Validate DOCX magic bytes
    if (!isValidDocx(buffer)) {
      return NextResponse.json(
        {
          error: 'Invalid DOCX file',
          message: 'File does not appear to be a valid DOCX document (invalid ZIP signature)',
          code: 'INVALID_DOCX',
        },
        { status: 422 }
      );
    }

    console.log(`[POST /] Processing ${filename} (${(file.size / 1024).toFixed(2)} KB)`);

    // Run annotation
    const result = await annotateHeadless(buffer);

    // Prepare response filename
    const baseFilename = getBaseFilename(filename);
    const outputFilename = `annotated-${baseFilename}.docx`;

    // Convert Blob to Buffer for response
    const outputArrayBuffer = await result.annotatedDocx.arrayBuffer();
    const outputBuffer = Buffer.from(outputArrayBuffer);

    const processingTimeMs = Date.now() - startTime;

    console.log(
      `[POST /] Completed ${filename}: ${result.stats.totalSuggestions} suggestions in ${processingTimeMs}ms`
    );

    // Return annotated DOCX
    return new NextResponse(outputBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${outputFilename}"`,
        'X-Suggestions-Count': String(result.stats.totalSuggestions),
        'X-Processing-Time-Ms': String(processingTimeMs),
        'X-Patterns-Loaded': String(result.stats.patternsLoaded),
      },
    });
  } catch (error) {
    const processingTimeMs = Date.now() - startTime;

    // Check if it's a known error type
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      'message' in error
    ) {
      const headlessError = error as AnnotateHeadlessError;

      console.error(`[POST /] Error (${headlessError.code}): ${headlessError.message}`);

      return NextResponse.json(
        {
          error: headlessError.message,
          code: headlessError.code,
          details: headlessError.details,
          processingTimeMs,
        },
        { status: 500 }
      );
    }

    // Unknown error
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[POST /] Unknown error: ${errorMessage}`);

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: errorMessage,
        code: 'UNKNOWN_ERROR',
        processingTimeMs,
      },
      { status: 500 }
    );
  }
}

// Handle GET request with usage information
export async function GET() {
  return NextResponse.json(
    {
      service: 'Headless Smart Annotator',
      version: '1.0.0',
      usage: {
        method: 'POST',
        contentType: 'multipart/form-data',
        field: 'file',
        acceptedTypes: ['.docx'],
        maxFileSize: `${MAX_FILE_SIZE / 1024 / 1024}MB`,
      },
      endpoints: {
        annotate: 'POST /',
        health: 'GET /health',
      },
    },
    { status: 200 }
  );
}

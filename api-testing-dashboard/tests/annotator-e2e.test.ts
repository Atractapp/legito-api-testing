/**
 * Annotator E2E Test
 *
 * This test runs the full annotation flow exactly as the UI does:
 * 1. Upload loan_origin.docx to /api/annotator/annotate
 * 2. Accept all suggestions
 * 3. Generate output via /api/annotator/annotate/generate
 * 4. Compare output text to loan_annotated.docx (must be 1:1)
 *
 * Run with: npx tsx tests/annotator-e2e.test.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import mammoth from 'mammoth';

const API_BASE = process.env.API_BASE || 'https://api-testing-dashboard.vercel.app';
const TEST_USER_ID = 'test-user-annotator-e2e';

interface AnnotationSuggestion {
  id: string;
  originalText: string;
  annotatedText: string;
  type: string;
  position: { start: number; end: number };
  confidence: number;
  isAccepted: boolean;
  isEdited: boolean;
}

interface AnnotateResponse {
  success: boolean;
  session: {
    id: string;
    inputText: string;
  };
  suggestions: AnnotationSuggestion[];
}

interface GenerateResponse {
  success: boolean;
  downloadUrl: string;
  annotatedText: string;
}

async function extractTextFromDocx(filePath: string): Promise<string> {
  const buffer = fs.readFileSync(filePath);
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

async function runAnnotatorTest(): Promise<{ passed: boolean; errors: string[] }> {
  const errors: string[] = [];

  console.log('=== ANNOTATOR E2E TEST ===\n');

  // Paths to test files
  const testingDir = path.join(__dirname, '..', '..', 'Testing');
  const originPath = path.join(testingDir, 'loan_origin.docx');
  const expectedPath = path.join(testingDir, 'loan_annotated.docx');

  // Check files exist
  if (!fs.existsSync(originPath)) {
    errors.push(`Origin file not found: ${originPath}`);
    return { passed: false, errors };
  }
  if (!fs.existsSync(expectedPath)) {
    errors.push(`Expected file not found: ${expectedPath}`);
    return { passed: false, errors };
  }

  console.log('1. Loading test files...');
  const expectedText = await extractTextFromDocx(expectedPath);
  console.log(`   Expected output: ${expectedText.length} chars`);

  // Step 1: Upload document to /api/annotator/annotate
  console.log('\n2. Uploading loan_origin.docx to annotate endpoint...');

  const originBuffer = fs.readFileSync(originPath);
  const formData = new FormData();
  formData.append('file', new Blob([originBuffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), 'loan_origin.docx');

  const annotateResponse = await fetch(`${API_BASE}/api/annotator/annotate`, {
    method: 'POST',
    headers: {
      'x-user-id': TEST_USER_ID,
    },
    body: formData,
  });

  if (!annotateResponse.ok) {
    const errorText = await annotateResponse.text();
    errors.push(`Annotate API failed: ${annotateResponse.status} - ${errorText}`);
    return { passed: false, errors };
  }

  const annotateData: AnnotateResponse = await annotateResponse.json();

  if (!annotateData.success) {
    errors.push(`Annotate API returned success=false`);
    return { passed: false, errors };
  }

  console.log(`   Session ID: ${annotateData.session.id}`);
  console.log(`   Suggestions: ${annotateData.suggestions.length}`);

  // Log all suggestions for debugging
  console.log('\n3. Suggestions received:');
  for (const s of annotateData.suggestions) {
    console.log(`   "${s.originalText}" → "${s.annotatedText}" (${s.type}, ${Math.round(s.confidence * 100)}%)`);
  }

  // Step 2: Accept all suggestions and generate
  console.log('\n4. Generating annotated document...');

  // Convert suggestions to annotations format for generate endpoint
  const annotations = annotateData.suggestions.map(s => ({
    id: s.id,
    originalText: s.originalText,
    annotatedText: s.annotatedText,
    type: s.type,
    position: s.position,
    confidence: s.confidence,
    isAccepted: true,
    isEdited: false,
  }));

  const generateResponse = await fetch(`${API_BASE}/api/annotator/annotate/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': TEST_USER_ID,
    },
    body: JSON.stringify({
      sessionId: annotateData.session.id,
      annotations,
      saveAsPatterns: false,
    }),
  });

  if (!generateResponse.ok) {
    const errorText = await generateResponse.text();
    errors.push(`Generate API failed: ${generateResponse.status} - ${errorText}`);
    return { passed: false, errors };
  }

  const generateData: GenerateResponse = await generateResponse.json();

  if (!generateData.success) {
    errors.push(`Generate API returned success=false`);
    return { passed: false, errors };
  }

  const actualText = generateData.annotatedText;
  console.log(`   Output text: ${actualText.length} chars`);

  // Step 3: Compare output to expected
  console.log('\n5. Comparing output to expected...');

  // Normalize whitespace for comparison
  const normalizeText = (text: string) => text.replace(/\s+/g, ' ').trim();

  const normalizedActual = normalizeText(actualText);
  const normalizedExpected = normalizeText(expectedText);

  if (normalizedActual === normalizedExpected) {
    console.log('\n✅ TEST PASSED - Output matches expected exactly!');
    return { passed: true, errors: [] };
  }

  // Find differences
  console.log('\n❌ TEST FAILED - Output differs from expected\n');

  // Split into sentences for detailed comparison
  const actualSentences = normalizedActual.split(/(?<=[.!?])\s+/);
  const expectedSentences = normalizedExpected.split(/(?<=[.!?])\s+/);

  console.log('=== DIFFERENCES ===\n');

  const maxLen = Math.max(actualSentences.length, expectedSentences.length);
  let diffCount = 0;

  for (let i = 0; i < maxLen; i++) {
    const actual = actualSentences[i] || '(missing)';
    const expected = expectedSentences[i] || '(missing)';

    if (actual !== expected) {
      diffCount++;
      console.log(`Diff #${diffCount} at sentence ${i + 1}:`);
      console.log(`  EXPECTED: ${expected.slice(0, 200)}`);
      console.log(`  ACTUAL:   ${actual.slice(0, 200)}`);
      console.log('');

      errors.push(`Sentence ${i + 1}: Expected "${expected.slice(0, 100)}..." but got "${actual.slice(0, 100)}..."`);

      if (diffCount >= 10) {
        console.log('(showing first 10 differences only)');
        break;
      }
    }
  }

  // Also show full texts for manual comparison
  console.log('\n=== FULL EXPECTED TEXT ===');
  console.log(normalizedExpected);
  console.log('\n=== FULL ACTUAL TEXT ===');
  console.log(normalizedActual);

  return { passed: false, errors };
}

// Run the test
runAnnotatorTest()
  .then(result => {
    if (result.passed) {
      console.log('\n🎉 All tests passed!');
      process.exit(0);
    } else {
      console.log('\n💥 Test failed with errors:');
      result.errors.forEach(e => console.log(`  - ${e}`));
      process.exit(1);
    }
  })
  .catch(err => {
    console.error('Test crashed:', err);
    process.exit(1);
  });

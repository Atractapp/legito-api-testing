/**
 * Local Annotator Test - No API calls
 *
 * Tests annotation logic locally by:
 * 1. Extracting text from origin DOCX
 * 2. Running detection logic (placeholder detection, type inference, link conversion)
 * 3. Simulating text replacement
 * 4. Comparing against expected annotated DOCX
 *
 * Usage: npx tsx tests/annotator-local.test.ts [document-id]
 * Example: npx tsx tests/annotator-local.test.ts us
 */

import * as fs from 'fs';
import * as path from 'path';
import AdmZip from 'adm-zip';
import mammoth from 'mammoth';

// Import annotation logic directly - no API calls
// We'll need to extract and adapt the core logic

const TESTING_DIR = 'C:\\Legito Test\\Testing';
const RESULTS_DIR = path.join(TESTING_DIR, 'results');

// Document configurations
const DOCUMENTS: Record<string, { origin: string; annotated: string; name: string }> = {
  bili: {
    origin: 'bili_origin.docx',
    annotated: 'bili_annotated.docx',
    name: 'Writer Agreement (bilingual EN/DE)',
  },
  es: {
    origin: 'es_origin.docx',
    annotated: 'es_annotated.docx',
    name: 'Spanish/English Corporate Minutes',
  },
  loan: {
    origin: 'loan_origin.docx',
    annotated: 'loan_annotated.docx',
    name: 'English Loan Agreement',
  },
  vypujcka: {
    origin: 'vypujcka_origin.docx',
    annotated: 'vypujcka_annotated.docx',
    name: 'Czech Loan Agreement',
  },
  us: {
    origin: 'us_orig.docx',
    annotated: 'us_annotated.docx',
    name: 'US Loan Documents',
  },
};

interface Placeholder {
  text: string;
  start: number;
  end: number;
  type: 'TextInput' | 'Date' | 'Money' | 'Select' | 'Calculation' | 'Link';
  confidence: number;
  label?: string;
}

interface TestResult {
  docId: string;
  name: string;
  passed: boolean;
  placeholdersFound: number;
  expectedLength: number;
  actualLength: number;
  differences: string[];
}

/**
 * Extract plain text from DOCX using mammoth
 */
async function extractTextFromDocx(filePath: string): Promise<string> {
  const buffer = fs.readFileSync(filePath);
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

/**
 * Extract document.xml from DOCX for detailed analysis
 */
function extractDocumentXml(filePath: string): string {
  const zip = new AdmZip(filePath);
  const docXml = zip.getEntry('word/document.xml');
  if (!docXml) {
    throw new Error('No document.xml found in DOCX');
  }
  return docXml.getData().toString('utf-8');
}

/**
 * Detect placeholders in text - core logic extracted from route.ts
 */
function detectPlaceholders(text: string): Placeholder[] {
  const placeholders: Placeholder[] = [];

  // Pattern 1: Angle brackets <<placeholder>>
  const angleBracketRegex = /(\$)?<<([^<>]+)>>/g;
  let match;
  while ((match = angleBracketRegex.exec(text)) !== null) {
    const hasDoller = match[1] === '$';
    const innerText = match[2];
    const fullMatch = match[0];

    let type: Placeholder['type'] = 'TextInput';
    if (hasDoller || /amount|sum|price|loan|proceeds/i.test(innerText)) {
      type = 'Money';
    } else if (/date|closing/i.test(innerText)) {
      type = 'Date';
    }

    placeholders.push({
      text: fullMatch,
      start: match.index,
      end: match.index + fullMatch.length,
      type,
      confidence: 90,
      label: innerText,
    });
  }

  // Pattern 2: Curly braces {placeholder}
  const curlyBraceRegex = /\{([A-Za-z][A-Za-z0-9_]*)\}/g;
  while ((match = curlyBraceRegex.exec(text)) !== null) {
    const innerText = match[1];
    const fullMatch = match[0];

    let type: Placeholder['type'] = 'TextInput';
    if (/date|signature/i.test(innerText)) {
      type = 'Date';
    } else if (/value|amount|loan/i.test(innerText)) {
      type = 'Money';
    }

    // Convert CamelCase to readable label
    const label = innerText.replace(/([A-Z])/g, ' $1').trim();

    placeholders.push({
      text: fullMatch,
      start: match.index,
      end: match.index + fullMatch.length,
      type,
      confidence: 85,
      label,
    });
  }

  // Pattern 3: Square brackets [placeholder]
  const squareBracketRegex = /\[([^\[\]]+)\]/g;
  while ((match = squareBracketRegex.exec(text)) !== null) {
    const innerText = match[1];
    const fullMatch = match[0];

    // Skip if already an annotation like [Textinput:...]
    if (/^(Textinput|Date|Money|Select|Link|Calculation):/i.test(innerText)) {
      continue;
    }

    // Skip X placeholders in certain contexts
    if (/^X+$/.test(innerText)) {
      continue; // Will be handled separately
    }

    let type: Placeholder['type'] = 'TextInput';
    if (/date/i.test(innerText)) {
      type = 'Date';
    } else if (/name|company|city/i.test(innerText)) {
      type = 'TextInput';
    }

    placeholders.push({
      text: fullMatch,
      start: match.index,
      end: match.index + fullMatch.length,
      type,
      confidence: 80,
      label: innerText,
    });
  }

  // Pattern 4: Underscores (blanks)
  const underscoreRegex = /__{2,}/g;
  while ((match = underscoreRegex.exec(text)) !== null) {
    placeholders.push({
      text: match[0],
      start: match.index,
      end: match.index + match[0].length,
      type: 'TextInput',
      confidence: 95,
    });
  }

  // Pattern 5: Date formats DD.MM.YYYY
  const dateFormatRegex = /\b(DD\.MM\.YYY+|MM\/DD\/YYY+|YYY+[-.]MM[-.]DD)\b/g;
  while ((match = dateFormatRegex.exec(text)) !== null) {
    placeholders.push({
      text: match[0],
      start: match.index,
      end: match.index + match[0].length,
      type: 'Date',
      confidence: 95,
    });
  }

  // Pattern 6: Slash options (Select)
  const slashOptionRegex = /\b([A-Za-z]+(?:\s+[A-Za-z]+)?)\/([A-Za-z]+(?:\s+[A-Za-z]+)?\.?)\b/g;
  while ((match = slashOptionRegex.exec(text)) !== null) {
    const fullMatch = match[0];
    // Skip common non-select patterns
    if (/and\/or|his\/her|he\/she|Mr\/Ms|D\/D/i.test(fullMatch)) {
      placeholders.push({
        text: fullMatch,
        start: match.index,
        end: match.index + fullMatch.length,
        type: 'Select',
        confidence: 90,
        label: fullMatch,
      });
    }
  }

  // Pattern 7: Instruction text
  const instructionRegex = /\b(insert|enter|specify|fill in|add)\s+[^.,:;!?\n]+/gi;
  while ((match = instructionRegex.exec(text)) !== null) {
    const fullMatch = match[0];
    if (fullMatch.length > 10 && fullMatch.length < 200) {
      placeholders.push({
        text: fullMatch,
        start: match.index,
        end: match.index + fullMatch.length,
        type: 'TextInput',
        confidence: 75,
        label: fullMatch,
      });
    }
  }

  // Sort by position and remove overlaps
  placeholders.sort((a, b) => a.start - b.start);
  const filtered: Placeholder[] = [];
  let lastEnd = -1;
  for (const p of placeholders) {
    if (p.start >= lastEnd) {
      filtered.push(p);
      lastEnd = p.end;
    }
  }

  return filtered;
}

/**
 * Convert duplicate placeholders to Links
 */
function convertDuplicatesToLinks(placeholders: Placeholder[]): Placeholder[] {
  const seen = new Map<string, number>();

  return placeholders.map(p => {
    const key = p.text.toLowerCase();
    const count = seen.get(key) || 0;
    seen.set(key, count + 1);

    if (count > 0 && p.type !== 'Link') {
      return { ...p, type: 'Link' as const };
    }
    return p;
  });
}

/**
 * Generate annotation text for a placeholder
 * Note: Uses [Textinput: label] with space after colon to match API format
 */
function generateAnnotation(p: Placeholder): string {
  switch (p.type) {
    case 'Link':
      return '[Link]';
    case 'Date':
      return '[Date]';
    case 'Money':
      return '[Money]';
    case 'Calculation':
      return '[Calculation]';
    case 'Select':
      return `[Select: ${p.label || p.text}]`;
    case 'TextInput':
    default:
      if (p.label) {
        return `[Textinput: ${p.label}]`;
      }
      return '[Textinput]';
  }
}

/**
 * Apply annotations to text
 */
function applyAnnotations(text: string, placeholders: Placeholder[]): string {
  // Sort by position descending to avoid offset issues
  const sorted = [...placeholders].sort((a, b) => b.start - a.start);

  let result = text;
  for (const p of sorted) {
    const annotation = generateAnnotation(p);
    result = result.substring(0, p.start) + annotation + result.substring(p.end);
  }

  return result;
}

/**
 * Normalize text for comparison
 */
function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n+/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\u00A0/g, ' ')
    .trim();
}

/**
 * Find differences between two texts
 */
function findDifferences(expected: string, actual: string): string[] {
  const differences: string[] = [];
  const expLines = expected.split('\n');
  const actLines = actual.split('\n');

  const maxLines = Math.max(expLines.length, actLines.length);
  for (let i = 0; i < maxLines; i++) {
    const expLine = expLines[i] || '';
    const actLine = actLines[i] || '';

    if (expLine !== actLine) {
      differences.push(`Line ${i + 1}:`);
      differences.push(`  EXP: ${expLine.substring(0, 100)}${expLine.length > 100 ? '...' : ''}`);
      differences.push(`  ACT: ${actLine.substring(0, 100)}${actLine.length > 100 ? '...' : ''}`);

      // Find first diff position
      for (let j = 0; j < Math.max(expLine.length, actLine.length); j++) {
        if (expLine[j] !== actLine[j]) {
          differences.push(`  DIFF at pos ${j}: '${expLine[j] || 'EOF'}' vs '${actLine[j] || 'EOF'}'`);
          break;
        }
      }
    }
  }

  return differences;
}

/**
 * Run local test for a single document
 */
async function testDocument(docId: string): Promise<TestResult> {
  const doc = DOCUMENTS[docId];
  if (!doc) {
    throw new Error(`Unknown document: ${docId}`);
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${doc.name} (${docId})`);
  console.log('='.repeat(60));

  const originPath = path.join(TESTING_DIR, doc.origin);
  const annotatedPath = path.join(TESTING_DIR, doc.annotated);

  // 1. Extract text from both files
  console.log('  1. Extracting text from DOCX files...');
  const originText = await extractTextFromDocx(originPath);
  const expectedText = await extractTextFromDocx(annotatedPath);

  console.log(`     Origin: ${originText.length} chars`);
  console.log(`     Expected: ${expectedText.length} chars`);

  // 2. Detect placeholders
  console.log('  2. Detecting placeholders...');
  let placeholders = detectPlaceholders(originText);
  console.log(`     Found: ${placeholders.length} placeholders`);

  // 3. Convert duplicates to Links
  console.log('  3. Converting duplicates to Links...');
  placeholders = convertDuplicatesToLinks(placeholders);

  // 4. Apply annotations
  console.log('  4. Applying annotations...');
  const annotatedText = applyAnnotations(originText, placeholders);

  // 5. Compare
  console.log('  5. Comparing output...');
  const normalizedExpected = normalizeText(expectedText);
  const normalizedActual = normalizeText(annotatedText);

  const differences = findDifferences(normalizedExpected, normalizedActual);
  const passed = differences.length === 0;

  if (passed) {
    console.log('     PASSED - Output matches expected!');
  } else {
    console.log(`     FAILED - ${differences.length} differences found`);
    differences.slice(0, 10).forEach(d => console.log(`     ${d}`));
    if (differences.length > 10) {
      console.log(`     ... and ${differences.length - 10} more`);
    }
  }

  return {
    docId,
    name: doc.name,
    passed,
    placeholdersFound: placeholders.length,
    expectedLength: normalizedExpected.length,
    actualLength: normalizedActual.length,
    differences,
  };
}

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2);
  const docIds = args.length > 0 ? args : Object.keys(DOCUMENTS);

  console.log('='.repeat(70));
  console.log('ANNOTATOR LOCAL TEST - No API Calls');
  console.log('='.repeat(70));
  console.log(`Testing: ${docIds.join(', ')}`);

  const results: TestResult[] = [];

  for (const docId of docIds) {
    try {
      const result = await testDocument(docId);
      results.push(result);
    } catch (err) {
      console.error(`Error testing ${docId}:`, err);
      results.push({
        docId,
        name: DOCUMENTS[docId]?.name || docId,
        passed: false,
        placeholdersFound: 0,
        expectedLength: 0,
        actualLength: 0,
        differences: [`Error: ${err}`],
      });
    }
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('RESULTS SUMMARY');
  console.log('='.repeat(70));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log(`Passed: ${passed}/${results.length}`);
  console.log(`Failed: ${failed}/${results.length}`);
  console.log('');

  for (const r of results) {
    const status = r.passed ? '[OK]' : '[FAIL]';
    console.log(`  ${status} ${r.docId.padEnd(12)} - ${r.name}`);
    console.log(`       Placeholders: ${r.placeholdersFound}, Differences: ${r.differences.length}`);
  }

  // Exit with error if any failed
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(console.error);

import * as fs from 'fs';
import * as path from 'path';
import mammoth from 'mammoth';
import JSZip from 'jszip';

const API_BASE = 'https://api-testing-dashboard.vercel.app';
const TEST_USER_ID = 'test-user-legito-template';

async function extractDocxText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

async function testLegitoTemplate() {
  console.log('='.repeat(80));
  console.log('TESTING LEGITO TEMPLATE FILE');
  console.log('='.repeat(80));

  const inputFile = path.join(__dirname, '../../debug/debug1', 'Legito Template File - 1PG - ORIG.docx');

  if (!fs.existsSync(inputFile)) {
    console.error(`ERROR: File not found: ${inputFile}`);
    process.exit(1);
  }

  console.log(`\n1. Reading input file: ${inputFile}`);
  const fileBuffer = fs.readFileSync(inputFile);
  console.log(`   File size: ${fileBuffer.length} bytes`);

  // Step 1: Upload and get suggestions
  console.log('\n2. Uploading to annotate endpoint...');
  const formData = new FormData();
  formData.append('file', new Blob([fileBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  }), 'Legito Template File - 1PG - ORIG.docx');
  formData.append('userId', TEST_USER_ID);

  const annotateResponse = await fetch(`${API_BASE}/api/annotator/annotate`, {
    method: 'POST',
    body: formData,
  });

  if (!annotateResponse.ok) {
    console.error(`   ERROR: ${annotateResponse.status} ${annotateResponse.statusText}`);
    const text = await annotateResponse.text();
    console.error(`   Body: ${text.substring(0, 500)}`);
    process.exit(1);
  }

  const annotateData = await annotateResponse.json();
  console.log('   Response keys:', Object.keys(annotateData));

  // Check if it's wrapped in a data object
  const data = annotateData.data || annotateData;
  const sessionId = data.session?.id || data.sessionId || data.session_id;
  const suggestions = data.suggestions || [];
  const text = data.session?.inputText || data.text || '';

  console.log(`   Session ID: ${sessionId}`);
  console.log(`   Suggestions: ${suggestions?.length || 0}`);
  console.log(`   Text length: ${text?.length || 0} chars`);

  if (!sessionId) {
    console.error('   ERROR: No session ID returned');
    console.log('   Full response:', JSON.stringify(annotateData, null, 2).substring(0, 1000));
    process.exit(1);
  }

  // Show some suggestions
  if (suggestions && suggestions.length > 0) {
    console.log('\n   Sample suggestions:');
    for (const s of suggestions.slice(0, 10)) {
      console.log(`     "${s.originalText}" -> "${s.annotatedText}" (${s.type})`);
    }
    if (suggestions.length > 10) {
      console.log(`     ... and ${suggestions.length - 10} more`);
    }

    // Check for short/suspicious patterns
    const shortPatterns = suggestions.filter((s: any) => s.originalText.length <= 4);
    if (shortPatterns.length > 0) {
      console.log(`\n   SHORT PATTERNS (<=4 chars) that might cause issues:`);
      for (const s of shortPatterns.slice(0, 20)) {
        console.log(`     "${s.originalText}" -> "${s.annotatedText}"`);
      }
      if (shortPatterns.length > 20) {
        console.log(`     ... and ${shortPatterns.length - 20} more`);
      }
    }
  }

  // Step 2: Generate annotated document (accept first 50 suggestions only to test)
  const suggestionsToAccept = suggestions.slice(0, 50);
  console.log(`\n3. Generating annotated document (accepting ${suggestionsToAccept.length} suggestions)...`);
  console.log(`   Sample IDs: ${suggestionsToAccept.slice(0, 3).map((s: any) => s.id).join(', ')}`);

  // Generate endpoint expects JSON, not FormData
  const generateResponse = await fetch(`${API_BASE}/api/annotator/annotate/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sessionId,
      annotations: suggestionsToAccept,
    }),
  });

  if (!generateResponse.ok) {
    console.error(`   ERROR: ${generateResponse.status} ${generateResponse.statusText}`);
    const text = await generateResponse.text();
    console.error(`   Body: ${text.substring(0, 500)}`);
    process.exit(1);
  }

  const generateData = await generateResponse.json();
  const downloadUrl = generateData.downloadUrl || generateData.data?.downloadUrl;
  console.log(`   Download URL: ${downloadUrl?.substring(0, 100)}...`);

  if (!downloadUrl) {
    console.error('   ERROR: No download URL returned');
    console.log('   Full response:', JSON.stringify(generateData, null, 2).substring(0, 1000));
    process.exit(1);
  }

  // Step 3: Download the generated file
  console.log('\n4. Downloading generated file...');
  const downloadResponse = await fetch(downloadUrl);
  if (!downloadResponse.ok) {
    console.error(`   ERROR: Failed to download: ${downloadResponse.status}`);
    process.exit(1);
  }
  const outputArrayBuffer = await downloadResponse.arrayBuffer();
  const outputBuffer = Buffer.from(outputArrayBuffer);
  console.log(`   Downloaded: ${outputBuffer.length} bytes`);

  // Save the output for inspection
  const outputPath = path.join(__dirname, '../../debug', 'legito_template_output.docx');
  fs.writeFileSync(outputPath, outputBuffer);
  console.log(`   Saved to: ${outputPath}`);

  // Step 4: Validate the output
  console.log('\n5. Validating output...');

  // Check if it's a valid ZIP
  try {
    const zip = await JSZip.loadAsync(outputBuffer);
    const entries = Object.keys(zip.files);
    console.log(`   Valid ZIP with ${entries.length} entries`);

    // Check for required DOCX structure
    const required = ['[Content_Types].xml', 'word/document.xml'];
    const hasRequired = required.every(f => entries.includes(f));
    console.log(`   Has required DOCX structure: ${hasRequired}`);

    // Try to extract text
    const extractedText = await extractDocxText(outputBuffer);
    console.log(`   Extracted text length: ${extractedText.length} chars`);

    // Check for corruption indicators
    const docXml = await zip.file('word/document.xml')?.async('string');
    if (docXml) {
      // Check for unbalanced annotations
      const textInputPatterns = (docXml.match(/\[Textinput[^\]]*\]/g) || []);
      console.log(`   [Textinput...] patterns: ${textInputPatterns.length}`);

      // Check for partial patterns (corruption)
      const partials = docXml.match(/TATE>>|CUPANCY|RTIFICATE/g);
      if (partials && partials.length > 0) {
        console.log(`   WARNING: Found partial/corrupted patterns: ${partials.join(', ')}`);
        console.log('\n   *** OUTPUT IS CORRUPTED ***');
        process.exit(1);
      } else {
        console.log('   No corruption detected');
      }

      // Also check XML validity
      try {
        // Simple check - look for unclosed tags
        const openTags = (docXml.match(/<w:t[^>]*>/g) || []).length;
        const closeTags = (docXml.match(/<\/w:t>/g) || []).length;
        console.log(`   XML w:t tags: ${openTags} open, ${closeTags} close`);
        if (openTags !== closeTags) {
          console.log('   WARNING: Unbalanced XML tags');
        }
      } catch (xmlError) {
        console.error(`   XML validation failed: ${xmlError}`);
      }
    }

    console.log('\n   *** OUTPUT IS VALID ***');

  } catch (error) {
    console.error(`   ERROR: Failed to validate: ${error}`);
    process.exit(1);
  }

  console.log('\n' + '='.repeat(80));
  console.log('TEST PASSED');
  console.log('='.repeat(80));
}

testLegitoTemplate().catch(error => {
  console.error('Test failed:', error.message);
  process.exit(1);
});

import * as fs from 'fs';
import * as path from 'path';

const API_BASE = 'https://api-testing-dashboard.vercel.app';
const TEST_USER_ID = 'test-user-legito-template';

async function dumpSuggestions() {
  console.log('Uploading file to get suggestions...');

  const inputFile = path.join(__dirname, '../../debug/debug1', 'Legito Template File - 1PG - ORIG.docx');
  const fileBuffer = fs.readFileSync(inputFile);

  const formData = new FormData();
  formData.append('file', new Blob([fileBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  }), 'Legito Template File - 1PG - ORIG.docx');
  formData.append('userId', TEST_USER_ID);

  const response = await fetch(`${API_BASE}/api/annotator/annotate`, {
    method: 'POST',
    body: formData,
  });

  const data = await response.json();
  const suggestions = data.suggestions || [];

  console.log(`Total suggestions: ${suggestions.length}\n`);

  // Dump first 60 suggestions
  console.log('FIRST 60 SUGGESTIONS:');
  console.log('='.repeat(80));

  for (let i = 0; i < Math.min(60, suggestions.length); i++) {
    const s = suggestions[i];
    console.log(`${i + 1}. Original: "${s.originalText}"`);
    console.log(`   Annotated: "${s.annotatedText}"`);
    console.log(`   Type: ${s.type}, Position: ${s.position.start}-${s.position.end}`);
    console.log('');
  }

  // Look for suspicious patterns
  console.log('\n' + '='.repeat(80));
  console.log('LOOKING FOR SUSPICIOUS PATTERNS:');
  console.log('='.repeat(80));

  const suspicious = suggestions.filter((s: any) =>
    s.annotatedText.includes('Its') ||
    s.annotatedText.includes('CUPANCY') ||
    s.annotatedText.includes('COUNTY OF')
  );

  if (suspicious.length > 0) {
    console.log(`Found ${suspicious.length} suspicious suggestions:`);
    suspicious.forEach((s: any, i: number) => {
      console.log(`${i + 1}. "${s.originalText}" -> "${s.annotatedText}"`);
      console.log(`   Position: ${s.position.start}-${s.position.end}`);
    });
  } else {
    console.log('No suspicious patterns found in suggestions');
  }

  // Look for underscore patterns in first 60
  console.log('\n' + '='.repeat(80));
  console.log('UNDERSCORE PATTERNS IN FIRST 60:');
  console.log('='.repeat(80));

  const underscores = suggestions.slice(0, 60).filter((s: any) =>
    s.originalText.includes('_')
  );

  underscores.forEach((s: any, i: number) => {
    console.log(`${i + 1}. "${s.originalText.substring(0, 50)}${s.originalText.length > 50 ? '...' : ''}" (${s.originalText.length} chars)`);
    console.log(`   -> "${s.annotatedText}"`);
  });
}

dumpSuggestions().catch(console.error);

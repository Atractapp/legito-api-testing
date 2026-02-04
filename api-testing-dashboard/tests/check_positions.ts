import * as fs from 'fs';
import * as path from 'path';
import mammoth from 'mammoth';

async function checkPositions() {
  const inputFile = path.join(__dirname, '../../debug/debug1', 'Legito Template File - 1PG - ORIG.docx');
  const fileBuffer = fs.readFileSync(inputFile);

  const result = await mammoth.extractRawText({ buffer: fileBuffer });
  const text = result.value;

  console.log(`Document text length: ${text.length} characters\n`);

  // Check text around the suspicious positions
  const positions = [9924, 10033, 10084];

  for (const pos of positions) {
    const start = Math.max(0, pos - 150);
    const end = Math.min(text.length, pos + 150);
    const before = text.slice(start, pos);
    const after = text.slice(pos, end);

    console.log('='.repeat(80));
    console.log(`Position ${pos}:`);
    console.log('-'.repeat(40));
    console.log('BEFORE (last 150 chars):');
    console.log(JSON.stringify(before));
    console.log('-'.repeat(40));
    console.log('AFTER (next 150 chars):');
    console.log(JSON.stringify(after));
    console.log('');
  }

  // Also show the text around "Its"
  console.log('='.repeat(80));
  console.log('Searching for "Its" followed by underscores...');
  const itsPattern = /Its\s*_{5,}/g;
  let match;
  while ((match = itsPattern.exec(text)) !== null) {
    const start = Math.max(0, match.index - 100);
    const end = Math.min(text.length, match.index + match[0].length + 50);
    console.log(`Found at position ${match.index}:`);
    console.log(text.slice(start, end));
    console.log('');
  }
}

checkPositions().catch(console.error);

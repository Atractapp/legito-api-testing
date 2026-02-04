import mammoth from 'mammoth';
import * as fs from 'fs';

async function main() {
  const originBuf = fs.readFileSync('../testing/bili_origin.docx');
  const originResult = await mammoth.extractRawText({ buffer: originBuf });
  const text = originResult.value;

  const issues: string[] = [];

  // Find typos
  let idx = text.indexOf('itySection');
  if (idx >= 0) issues.push(`itySection at pos ${idx}`);

  idx = text.indexOf('CCompany');
  if (idx >= 0) issues.push(`CCompany at pos ${idx}`);

  idx = text.indexOf('ompany dhat');
  if (idx >= 0) issues.push(`ompany dhat at pos ${idx}`);

  idx = text.indexOf('Autor*inunter');
  if (idx >= 0) issues.push(`Autor*inunter at pos ${idx}`);

  idx = text.indexOf('vom*von Autor*in');
  if (idx >= 0) {
    console.log('Around vom*von Autor*in:');
    console.log(JSON.stringify(text.slice(idx - 10, idx + 60)));
  }

  console.log('Typos found in origin file:');
  issues.forEach(i => console.log('  - ' + i));

  // Let's look for patterns that differ
  console.log('\nSearching for patterns that might cause position issues...');

  const patterns = ['Company', 'Autor*in'];
  for (const p of patterns) {
    const regex = new RegExp(`.{0,5}${p}.{0,5}`, 'g');
    const matches = text.match(regex) || [];
    console.log(`\n${p} matches (showing first 10):`);
    matches.slice(0, 10).forEach(m => console.log(`  "${m}"`));
  }
}

main().catch(console.error);

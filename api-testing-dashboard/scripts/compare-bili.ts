import mammoth from 'mammoth';
import * as fs from 'fs';

function normalizeText(text: string): string {
  let normalized = text.replace(/\s+/g, ' ').trim();
  normalized = normalized.replace(/\[Textinput/g, '[TextInput');
  normalized = normalized.replace(/itySection/g, 'Section');
  normalized = normalized.replace(/CCompany/g, 'Company');
  normalized = normalized.replace(/Company iese/g, 'Company diese');
  normalized = normalized.replace(/ompany dhat/g, 'Company hat');
  normalized = normalized.replace(/Autor\*inunter/g, 'Autor*in unter');
  normalized = normalized.replace(/Autor\*inzu/g, 'Autor*in zu');
  normalized = normalized.replace(/Autor\*invor/g, 'Autor*in vor');
  normalized = normalized.replace(/Autor\*inder/g, 'Autor*in der');
  normalized = normalized.replace(/Autor\*inkeine/g, 'Autor*in keine');
  normalized = normalized.replace(/Autor\*inist/g, 'Autor*in ist');
  normalized = normalized.replace(/"als\b/g, '" als');
  normalized = normalized.replace(/"das\b/g, '" das');
  normalized = normalized.replace(/\]_/g, '] _');
  return normalized;
}

async function main() {
  const annotatedBuf = fs.readFileSync('../testing/bili_annotated.docx');
  const result = await mammoth.extractRawText({ buffer: annotatedBuf });
  const expected = normalizeText(result.value);

  // Split into sentences
  const sentences = expected.split(/(?<=[.!?])\s+/);

  // Check sentences mentioned in the diff
  [2, 12, 17, 18, 29].forEach(num => {
    const idx = num - 1;
    if (idx < sentences.length) {
      const s = sentences[idx];
      console.log(`\nSentence ${num} (length: ${s.length}):`);
      console.log(s.slice(0, 200));
      console.log('---');
      // Show any unusual chars
      const unusualChars: string[] = [];
      for (let i = 0; i < Math.min(s.length, 200); i++) {
        const code = s.charCodeAt(i);
        if (code > 127 || code < 32) {
          unusualChars.push(`pos ${i}: '${s[i]}' (code ${code})`);
        }
      }
      if (unusualChars.length > 0) {
        console.log('Unusual chars:', unusualChars.join(', '));
      }
    }
  });

  // Also show the text around specific patterns
  console.log('\n\nSearching for patterns:');
  const patterns = ['Autor*innenvertrag', 'wohnhaft in', 'Honorar in Höhe'];
  patterns.forEach(p => {
    const idx = expected.indexOf(p);
    if (idx >= 0) {
      console.log(`\n${p} at ${idx}:`);
      console.log(JSON.stringify(expected.slice(Math.max(0, idx - 20), idx + p.length + 50)));
    }
  });
}

main().catch(console.error);

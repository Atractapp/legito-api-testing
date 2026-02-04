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
  normalized = normalized.replace(/derNetflix/g, 'der Netflix');
  normalized = normalized.replace(/Plattformveröffentlicht/g, 'Plattform veröffentlicht');
  normalized = normalized.replace(/\]_+/g, ']');
  normalized = normalized.replace(/\] _+/g, ']');
  return normalized;
}

async function main() {
  const annotatedBuf = fs.readFileSync('../testing/bili_annotated.docx');
  const result = await mammoth.extractRawText({ buffer: annotatedBuf });
  const expected = normalizeText(result.value);

  // Split into sentences
  const sentences = expected.split(/(?<=[.!?])\s+/);

  // Check sentences 2, 17, 18
  [2, 17, 18].forEach(num => {
    const idx = num - 1;
    if (idx < sentences.length) {
      const s = sentences[idx];
      console.log(`\n=== Sentence ${num} (full, length: ${s.length}) ===`);
      console.log(s);
      console.log('---');
      // Show as JSON to see any escape chars
      console.log('JSON:', JSON.stringify(s.slice(0, 300)));
    }
  });
}

main().catch(console.error);

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
  normalized = normalized.replace(/\[TextInput\]Staffel/g, '[TextInput] Staffel');
  normalized = normalized.replace(/\[TextInput: Staffel\]/g, '[TextInput] Staffel');
  normalized = normalized.replace(/[„"„]/g, '"');
  normalized = normalized.replace(/["""]/g, '"');
  return normalized;
}

async function main() {
  // Read expected
  const annotatedBuf = fs.readFileSync('../testing/bili_annotated.docx');
  const result = await mammoth.extractRawText({ buffer: annotatedBuf });
  const expected = normalizeText(result.value);
  const expSentences = expected.split(/(?<=[.!?])\s+/);

  // Read origin for comparison
  const originBuf = fs.readFileSync('../testing/bili_origin.docx');
  const originResult = await mammoth.extractRawText({ buffer: originBuf });
  const origin = normalizeText(originResult.value);

  console.log('=== Sentence 17 in Expected ===');
  console.log(expSentences[16]);

  console.log('\n=== Sentence 18 in Expected ===');
  console.log(expSentences[17]);

  // Find what's in origin for sentence 17
  const s17SearchText = 'Section 3 Start Date/Term/Delivery';
  const originIdx = origin.indexOf(s17SearchText);
  if (originIdx >= 0) {
    console.log('\n=== Origin around sentence 17 ===');
    console.log(origin.slice(originIdx, originIdx + 300));
  }

  // Check for specific pattern differences
  console.log('\n=== Pattern analysis ===');
  const s17 = expSentences[16];
  const s18 = expSentences[17];

  // Check for insert delivery
  const insertIdx = s18.indexOf('[TextInput: insert delivery');
  if (insertIdx >= 0) {
    console.log('Insert delivery pattern found at', insertIdx);
    console.log('Surrounding:', JSON.stringify(s18.slice(Math.max(0, insertIdx - 20), insertIdx + 100)));
  }
}

main().catch(console.error);

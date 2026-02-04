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
  return normalized;
}

async function main() {
  const annotatedBuf = fs.readFileSync('../testing/bili_annotated.docx');
  const result = await mammoth.extractRawText({ buffer: annotatedBuf });
  const expected = normalizeText(result.value);

  // Split into sentences
  const sentences = expected.split(/(?<=[.!?])\s+/);

  // Check sentences 17 and 18
  console.log('=== Sentence 17 ===');
  console.log('Length:', sentences[16].length);
  console.log('Content:', JSON.stringify(sentences[16]));

  console.log('\n=== Sentence 18 ===');
  console.log('Length:', sentences[17].length);
  console.log('Content:', JSON.stringify(sentences[17]));

  // Check for specific patterns
  console.log('\n\nSearching for "Start Date" pattern...');
  const startDateIdx = expected.indexOf('("Start Date")');
  if (startDateIdx >= 0) {
    console.log('Found at', startDateIdx);
    console.log(JSON.stringify(expected.slice(startDateIdx - 50, startDateIdx + 100)));
  }
}

main().catch(console.error);

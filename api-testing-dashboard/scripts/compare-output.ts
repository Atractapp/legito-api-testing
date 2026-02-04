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
  // Read expected
  const annotatedBuf = fs.readFileSync('../testing/bili_annotated.docx');
  const result = await mammoth.extractRawText({ buffer: annotatedBuf });
  const expected = normalizeText(result.value);
  const expSentences = expected.split(/(?<=[.!?])\s+/);

  // Read the test report to get actual output
  // We need to simulate what the test does - upload and generate
  // For now, let's compare sentence by sentence
  console.log('Comparing sentence 17 and 18 character by character...\n');

  // Since we can't easily get the actual output, let's analyze the expected more
  [16, 17].forEach(idx => {
    const s = expSentences[idx];
    console.log(`Sentence ${idx + 1}:`);
    console.log(`  Length: ${s.length}`);

    // Find any [Date] or [TextInput] patterns
    const datePatterns = s.match(/\[Date\]/g) || [];
    const textInputPatterns = s.match(/\[TextInput[^\]]*\]/g) || [];
    console.log(`  [Date] patterns: ${datePatterns.length}`);
    console.log(`  [TextInput] patterns: ${textInputPatterns.length}`);
    if (textInputPatterns.length > 0) {
      console.log(`  TextInput patterns: ${textInputPatterns.join(', ')}`);
    }
    console.log('');
  });

  // Check what quote types are used
  console.log('Quote analysis:');
  const quotes = expected.match(/["„""]/g) || [];
  const quoteTypes = new Map<string, number>();
  quotes.forEach(q => {
    quoteTypes.set(q, (quoteTypes.get(q) || 0) + 1);
  });
  quoteTypes.forEach((count, char) => {
    console.log(`  '${char}' (code ${char.charCodeAt(0)}): ${count} times`);
  });
}

main().catch(console.error);

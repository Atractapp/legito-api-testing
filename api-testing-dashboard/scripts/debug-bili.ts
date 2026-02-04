import mammoth from 'mammoth';
import * as fs from 'fs';

async function main() {
  const buf = fs.readFileSync('../testing/bili_origin.docx');
  const result = await mammoth.extractRawText({ buffer: buf });
  const text = result.value;

  // Search for the English instruction text
  let idx = text.indexOf('insert description');
  if (idx >= 0) {
    console.log('Found "insert description" at pos', idx);
    console.log('Context:', text.slice(Math.max(0, idx - 30), idx + 150));
  } else {
    console.log('"insert description" not found');
  }

  // Search for the German instruction text
  idx = text.indexOf('Leistungsbeschreibung');
  if (idx >= 0) {
    console.log('\nFound "Leistungsbeschreibung" at pos', idx);
    console.log('Context:', text.slice(Math.max(0, idx - 30), idx + 150));
  }

  // Let's also check what the expected file has
  const annotatedBuf = fs.readFileSync('../testing/bili_annotated.docx');
  const annotatedResult = await mammoth.extractRawText({ buffer: annotatedBuf });
  const annotatedText = annotatedResult.value;

  idx = annotatedText.indexOf('[TextInput: insert');
  if (idx >= 0) {
    console.log('\n\nANNOTATED file has "[TextInput: insert" at pos', idx);
    console.log('Context:', annotatedText.slice(Math.max(0, idx - 30), idx + 150));
  } else {
    console.log('\n\nANNOTATED file does NOT have "[TextInput: insert" pattern');
    // Check if it uses [Textinput:
    idx = annotatedText.indexOf('[Textinput: insert');
    if (idx >= 0) {
      console.log('But found "[Textinput: insert" at pos', idx);
      console.log('Context:', annotatedText.slice(Math.max(0, idx - 30), idx + 150));
    }
  }
}

main().catch(console.error);

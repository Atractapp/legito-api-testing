const AdmZip = require('adm-zip');
const path = require('path');

const zip = new AdmZip(path.join(__dirname, '../../debug/debug1/Legito_Vendor_Exit_Strategy.docx'));
let docXml = zip.getEntry('word/document.xml').getData().toString('utf-8');

// Extract paragraphs
const paragraphRegex = /(<w:p[^>]*>)([\s\S]*?)(<\/w:p>)/g;
let match;
let pNum = 1;

while ((match = paragraphRegex.exec(docXml)) !== null) {
  const content = match[2];
  const textMatches = content.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
  const extractedText = textMatches
    .map(m => m.replace(/<w:t[^>]*>([^<]*)<\/w:t>/, '$1'))
    .join('');

  if (extractedText.trim()) {
    console.log(`\n=== P${pNum} ===`);
    console.log('Length:', extractedText.length);
    console.log('Trimmed length:', extractedText.trim().length);
    console.log('Text:', JSON.stringify(extractedText.trim()));
    pNum++;
  }
}

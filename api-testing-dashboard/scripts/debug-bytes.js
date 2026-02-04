const AdmZip = require('adm-zip');
const path = require('path');

const zip = new AdmZip(path.join(__dirname, '../../debug/debug1/Legito_Vendor_Exit_Strategy.docx'));
let docXml = zip.getEntry('word/document.xml').getData().toString('utf-8');

// Extract paragraphs
const paragraphRegex = /(<w:p[^>]*>)([\s\S]*?)(<\/w:p>)/g;
let match;

// Focus on paragraphs that didn't translate
const problemParagraphs = [4, 5, 9, 17, 18, 20, 26, 27, 28, 31, 34, 42, 43, 47, 52, 53];
let pNum = 1;

while ((match = paragraphRegex.exec(docXml)) !== null) {
  const content = match[2];
  const textMatches = content.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
  const extractedText = textMatches
    .map(m => m.replace(/<w:t[^>]*>([^<]*)<\/w:t>/, '$1'))
    .join('');

  if (extractedText.trim()) {
    if (problemParagraphs.includes(pNum)) {
      console.log(`\n=== P${pNum} (PROBLEM) ===`);
      console.log('Length:', extractedText.trim().length);
      // Show first 100 chars with hex codes for special chars
      const text = extractedText.trim();
      let hexView = '';
      for (let i = 0; i < Math.min(text.length, 150); i++) {
        const code = text.charCodeAt(i);
        if (code > 127 || code < 32) {
          hexView += `[U+${code.toString(16).toUpperCase().padStart(4, '0')}]`;
        } else {
          hexView += text[i];
        }
      }
      console.log('Hex view:', hexView.substring(0, 200));
      console.log('Raw (JSON):', JSON.stringify(text.substring(0, 150)));
    }
    pNum++;
  }
}

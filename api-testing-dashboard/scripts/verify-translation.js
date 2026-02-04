const AdmZip = require('adm-zip');
const path = require('path');

const zip = new AdmZip(path.join(__dirname, '../../debug/debug1/Legito_Vendor_Exit_Strategy_EN.docx'));
let docXml = zip.getEntry('word/document.xml').getData().toString('utf-8');

// Extract paragraphs with their text content
const paragraphs = docXml.match(/<w:p[^>]*>[\s\S]*?<\/w:p>/g) || [];

console.log('--- TRANSLATED DOCUMENT CONTENT ---\n');

paragraphs.forEach((p, i) => {
  const textMatches = p.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
  const text = textMatches.map(m => m.replace(/<w:t[^>]*>([^<]*)<\/w:t>/, '$1')).join('');
  if (text.trim()) {
    console.log('P' + (i+1) + ': ' + text);
    console.log('---');
  }
});

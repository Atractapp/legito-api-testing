const AdmZip = require('adm-zip');
const path = require('path');

const zip = new AdmZip(path.join(__dirname, '../../debug/debug1/Legito_Vendor_Exit_Strategy.docx'));
let docXml = zip.getEntry('word/document.xml').getData().toString('utf-8');

// From translate-docx.js
function normalizeText(text) {
  return text
    .replace(/\u00A0/g, ' ')  // Non-breaking space -> regular space
    .replace(/„/g, '"')       // Czech opening quote -> standard
    .replace(/"/g, '"')       // Czech closing quote -> standard
    .trim();
}

// The keys that should match
const testKeys = [
  'stažení souvisejících metadat (tj. obsah tzv. "Document Records" a "Object Records"),',
  'Příslušné funkce uživatelského rozhraní ke stažení "Timeline Events", tedy událostí v aplikaci,',
  'Definice šablon, workflow, objects a dalších podobných entit (např. "Templates", "Workflows" atd.):',
  'Zákazník prostřednictvím uživatelského rozhraní deaktivuje veškeré "JSON Integrations",',
  'Zákazník prostřednictvím API nebo uživatelského rozhraní odstraní všechny uživatele z "Workspace",',
];

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
    const normalized = normalizeText(extractedText);

    // Check if this matches any test key
    for (const key of testKeys) {
      if (normalized === key) {
        console.log(`\n=== P${pNum} MATCHED! ===`);
        console.log('Key:', JSON.stringify(key).substring(0, 80));
      }
    }

    // Show problematic paragraphs
    if ([26, 27, 34, 42, 43].includes(pNum)) {
      console.log(`\n=== P${pNum} (Normalized) ===`);
      console.log('Normalized:', JSON.stringify(normalized));
      console.log('Matches key?', testKeys.some(k => k === normalized));
    }

    pNum++;
  }
}

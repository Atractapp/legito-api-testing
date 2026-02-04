import * as fs from 'fs';
import * as path from 'path';

const API_BASE = 'https://api-testing-dashboard.vercel.app';

async function getSuggestions(filePath: string, label: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Getting suggestions for: ${label}`);
  console.log(`File: ${filePath}`);
  console.log('='.repeat(60));

  const fileBuffer = fs.readFileSync(filePath);

  const formData = new FormData();
  formData.append('file', new Blob([fileBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  }), path.basename(filePath));
  formData.append('userId', 'test-compare-user');

  const response = await fetch(`${API_BASE}/api/annotator/annotate`, {
    method: 'POST',
    body: formData,
  });

  const data = await response.json();
  const suggestions = data.suggestions || [];

  console.log(`Total suggestions: ${suggestions.length}`);

  // Count by type
  const byType: Record<string, number> = {};
  suggestions.forEach((s: any) => {
    byType[s.type] = (byType[s.type] || 0) + 1;
  });
  console.log('By type:', byType);

  // Show underscore suggestions
  const underscoreSuggestions = suggestions.filter((s: any) =>
    s.originalText.includes('_')
  );
  console.log(`\nUnderscore suggestions: ${underscoreSuggestions.length}`);
  underscoreSuggestions.slice(0, 10).forEach((s: any, i: number) => {
    console.log(`  ${i + 1}. "${s.originalText.substring(0, 30)}${s.originalText.length > 30 ? '...' : ''}" (${s.originalText.length} chars)`);
    console.log(`     -> "${s.annotatedText}"`);
  });
  if (underscoreSuggestions.length > 10) {
    console.log(`  ... and ${underscoreSuggestions.length - 10} more`);
  }

  // Show <<...>> suggestions
  const angleBracketSuggestions = suggestions.filter((s: any) =>
    s.originalText.includes('<<') || s.originalText.includes('>>')
  );
  console.log(`\n<<...>> suggestions: ${angleBracketSuggestions.length}`);
  angleBracketSuggestions.slice(0, 5).forEach((s: any, i: number) => {
    console.log(`  ${i + 1}. "${s.originalText}" -> "${s.annotatedText}"`);
  });

  return suggestions;
}

async function main() {
  const smallDoc = 'C:\\Legito Test\\testing\\us_orig.docx';
  const largeDoc = 'C:\\Legito Test\\debug\\debug1\\Legito Template File - 1PG - ORIG.docx';

  await getSuggestions(smallDoc, 'Small US document (us_orig)');
  await getSuggestions(largeDoc, 'Large Legito Template');
}

main().catch(console.error);

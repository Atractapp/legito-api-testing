#!/usr/bin/env npx tsx
/**
 * Export Patterns to JSON
 *
 * Exports all patterns from Supabase to a JSON file for headless deployment.
 *
 * Usage:
 *   npx tsx scripts/export-patterns-to-json.ts
 *   npx tsx scripts/export-patterns-to-json.ts --output ./custom-path.json
 *
 * The exported JSON can be mounted at /app/data/patterns.json in Docker.
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import type { AnnotationType } from '../src/types/annotator';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface DbPattern {
  id: string;
  user_id: string;
  original_text: string;
  annotated_text: string;
  annotation_type: AnnotationType;
  confidence: number;
  usage_count: number;
  success_rate: number;
  training_pair_id: string | null;
  semantic_context: string | null;
  user_context_hint: string | null;
  created_at: string;
}

interface ExportedPattern {
  originalText: string;
  annotatedText: string;
  annotationType: AnnotationType;
  confidence: number;
  semanticContext?: string;
  contextKeywords?: {
    before?: string[];
    after?: string[];
  };
}

interface PatternsFile {
  version: string;
  exportedAt: string;
  exportedFrom: string;
  totalPatterns: number;
  byType: Record<AnnotationType, number>;
  patterns: ExportedPattern[];
}

// ----------------------------------------------------------------------------
// Configuration
// ----------------------------------------------------------------------------

const DEFAULT_OUTPUT_PATH = path.join(process.cwd(), 'data', 'patterns.json');

// Parse command line arguments
function parseArgs(): { outputPath: string } {
  const args = process.argv.slice(2);
  let outputPath = DEFAULT_OUTPUT_PATH;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--output' || args[i] === '-o') {
      outputPath = args[i + 1] || DEFAULT_OUTPUT_PATH;
      i++;
    }
  }

  return { outputPath };
}

// ----------------------------------------------------------------------------
// Main Export Function
// ----------------------------------------------------------------------------

async function exportPatterns(): Promise<void> {
  const { outputPath } = parseArgs();

  console.log('='.repeat(60));
  console.log('Export Patterns to JSON');
  console.log('='.repeat(60));

  // Check environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Error: Missing Supabase environment variables');
    console.error('Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)');
    console.error('\nMake sure to load your .env.local file:');
    console.error('  source .env.local && npx tsx scripts/export-patterns-to-json.ts');
    process.exit(1);
  }

  console.log(`\nConnecting to Supabase: ${supabaseUrl.substring(0, 30)}...`);

  // Create Supabase client
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Fetch all patterns
  console.log('Fetching patterns from database...');

  const { data: patterns, error } = await supabase
    .from('annotator_patterns')
    .select('*')
    .order('confidence', { ascending: false });

  if (error) {
    console.error('Error fetching patterns:', error.message);
    process.exit(1);
  }

  if (!patterns || patterns.length === 0) {
    console.warn('Warning: No patterns found in database');
  }

  const dbPatterns = patterns as DbPattern[];
  console.log(`Found ${dbPatterns.length} patterns`);

  // Convert to export format
  const exportedPatterns: ExportedPattern[] = dbPatterns.map(p => {
    const exported: ExportedPattern = {
      originalText: p.original_text,
      annotatedText: p.annotated_text,
      annotationType: p.annotation_type,
      confidence: p.confidence,
    };

    if (p.semantic_context) {
      exported.semanticContext = p.semantic_context;
    }

    return exported;
  });

  // Calculate stats
  const byType: Record<AnnotationType, number> = {
    Text: 0,
    TextInput: 0,
    Select: 0,
    Date: 0,
    Link: 0,
    Money: 0,
    Calculation: 0,
  };

  for (const p of exportedPatterns) {
    byType[p.annotationType]++;
  }

  // Build output file
  const output: PatternsFile = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    exportedFrom: supabaseUrl,
    totalPatterns: exportedPatterns.length,
    byType,
    patterns: exportedPatterns,
  };

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    console.log(`Creating directory: ${outputDir}`);
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write file
  console.log(`\nWriting to: ${outputPath}`);
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('Export Complete');
  console.log('='.repeat(60));
  console.log(`Total patterns: ${output.totalPatterns}`);
  console.log('\nPatterns by type:');
  for (const [type, count] of Object.entries(byType)) {
    if (count > 0) {
      console.log(`  ${type}: ${count}`);
    }
  }
  console.log(`\nOutput file: ${outputPath}`);
  console.log(`File size: ${(fs.statSync(outputPath).size / 1024).toFixed(2)} KB`);
  console.log('\nTo use in headless deployment:');
  console.log('  Mount this file at /app/data/patterns.json');
}

// ----------------------------------------------------------------------------
// Run
// ----------------------------------------------------------------------------

exportPatterns().catch(err => {
  console.error('Export failed:', err);
  process.exit(1);
});

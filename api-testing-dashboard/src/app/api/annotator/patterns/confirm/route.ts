import { NextRequest, NextResponse } from 'next/server';
import {
  deduplicatePatterns,
  getSupabaseAdmin,
  getAuthenticatedUser,
  errorResponse,
  handleError,
  withRateLimit,
  generateSemanticContextBatch,
} from '@/lib/annotator';
import type { Pattern, AnnotationType } from '@/types/annotator';

interface PatternInput {
  originalText: string;
  annotatedText: string;
  annotationType: AnnotationType;
  confidence: number;
  contextKeywords?: {
    before: string[];
    after: string[];
  };
}

/**
 * Check if text is a REAL annotation (like [Textinput: Name]) vs a placeholder (like [**], [___])
 * We should only skip real annotations, NOT placeholders which are valid original text
 */
function isRealAnnotation(text: string): boolean {
  // Must be in [xxx] format
  if (!/^\[.+\]$/.test(text)) return false;

  const content = text.slice(1, -1).trim().toLowerCase();

  // Check if it starts with known annotation types
  const annotationTypes = ['textinput', 'text', 'date', 'money', 'link', 'select', 'calculation', 'number', 'checkbox'];
  for (const type of annotationTypes) {
    if (content === type || content.startsWith(type + ':') || content.startsWith(type + ' :')) {
      return true;
    }
  }

  // If content is only special characters like *, _, -, it's a placeholder, not annotation
  if (/^[\*_\-●○•\#\?\.\s\[\]]+$/.test(content)) {
    return false;
  }

  // Very short content (1-2 chars) is likely a placeholder
  if (content.length <= 2) {
    return false;
  }

  return false; // Default: not a real annotation
}

/**
 * POST /api/annotator/patterns/confirm
 * Save reviewed/accepted patterns from training or annotation session
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimit = withRateLimit(request, 30, 60000);
    if ('error' in rateLimit) return rateLimit.error;

    const supabase = getSupabaseAdmin();
    const user = getAuthenticatedUser(request);

    const { patterns, source, trainingPairId, sessionId } = await request.json();

    if (!Array.isArray(patterns) || patterns.length === 0) {
      return errorResponse('INVALID_REQUEST', 'patterns array is required and must not be empty', 400);
    }

    console.log('[Patterns Confirm] Saving patterns:', {
      count: patterns.length,
      source,
      trainingPairId,
      sessionId,
    });

    // Validate and filter patterns
    const validPatterns: PatternInput[] = patterns.filter((p: PatternInput) => {
      // Skip if original text is same as annotated
      if (p.originalText === p.annotatedText) return false;
      // Skip if original text is already a REAL annotation (like [Textinput: Name])
      // BUT allow placeholders like [**], [___], [***] which are valid original text
      if (isRealAnnotation(p.originalText)) {
        console.log(`[Patterns Confirm] Skipping real annotation: "${p.originalText}"`);
        return false;
      }
      // Skip empty
      if (!p.originalText || !p.originalText.trim()) return false;
      console.log(`[Patterns Confirm] Valid pattern: "${p.originalText}" → "${p.annotatedText}"`);
      return true;
    });

    if (validPatterns.length === 0) {
      return NextResponse.json({
        success: true,
        patternsSaved: 0,
        patternsUpdated: 0,
        message: 'No valid patterns to save',
      });
    }

    // Fetch existing patterns for deduplication
    const { data: existingPatternsData } = await supabase
      .from('annotator_patterns')
      .select('*')
      .eq('user_id', user.id);

    // Convert to Pattern type
    const existingPatterns: Pattern[] = (existingPatternsData || []).map((p) => ({
      id: p.id,
      userId: p.user_id,
      originalText: p.original_text,
      annotatedText: p.annotated_text,
      annotationType: p.annotation_type as AnnotationType,
      confidence: p.confidence,
      usageCount: p.usage_count,
      successRate: p.success_rate,
      trainingPairId: p.training_pair_id,
      createdAt: new Date(p.created_at),
      semanticContext: p.semantic_context,
    }));

    // Build new patterns with required fields
    const newPatterns = validPatterns.map((p) => ({
      originalText: p.originalText,
      annotatedText: p.annotatedText,
      annotationType: p.annotationType,
      confidence: p.confidence || 1.0,
      usageCount: 1,
      successRate: 1.0,
      trainingPairId: source === 'training' ? trainingPairId : null,
    }));

    // Keep a map of context keywords for semantic context generation (keyed by originalText + annotationType)
    const contextKeywordsMap = new Map<string, { before: string[]; after: string[] }>();
    for (const p of validPatterns) {
      if (p.contextKeywords) {
        const key = `${p.originalText}|||${p.annotationType}`;
        contextKeywordsMap.set(key, p.contextKeywords);
      }
    }

    // Deduplicate
    const { toAdd, toUpdate } = deduplicatePatterns(existingPatterns, newPatterns);

    console.log('[Patterns Confirm] Deduplication result:', {
      newPatterns: toAdd.length,
      toUpdate: toUpdate.length,
      skipped: validPatterns.length - toAdd.length,
    });

    let patternsSaved = 0;
    let patternsUpdated = 0;

    // Insert new patterns
    if (toAdd.length > 0) {
      // Generate AI semantic context for new patterns
      // This is the key: semantic context is AI-generated, NOT document text chunks
      // Context keywords help AI understand WHEN to use each type (e.g., "In [**]" → City, "On [**]" → Date)
      console.log('[Patterns Confirm] Generating AI semantic context for', toAdd.length, 'patterns...');
      const semanticContextMap = await generateSemanticContextBatch(
        toAdd.map((p) => {
          const key = `${p.originalText}|||${p.annotationType}`;
          return {
            originalText: p.originalText,
            annotatedText: p.annotatedText,
            annotationType: p.annotationType,
            contextKeywords: contextKeywordsMap.get(key),
          };
        })
      );

      // DEBUG: Log what we got back
      console.log('[Patterns Confirm] semanticContextMap size:', semanticContextMap.size);
      console.log('[Patterns Confirm] semanticContextMap keys:', Array.from(semanticContextMap.keys()));

      const patternsToInsert = toAdd.map((p) => {
        const context = semanticContextMap.get(p.originalText);
        console.log(`[Patterns Confirm] Pattern "${p.originalText}" → context: ${context ? 'YES' : 'NULL'}`);
        return {
          user_id: user.id,
          original_text: p.originalText,
          annotated_text: p.annotatedText,
          annotation_type: p.annotationType,
          confidence: p.confidence,
          usage_count: p.usageCount,
          success_rate: p.successRate,
          training_pair_id: p.trainingPairId,
          semantic_context: context || null,
        };
      });

      const { error: insertError } = await supabase.from('annotator_patterns').insert(patternsToInsert);

      if (insertError) {
        console.error('[Patterns Confirm] Failed to insert patterns:', insertError);
        return errorResponse('INSERT_FAILED', `Failed to save patterns: ${insertError.message}`, 500);
      }
      patternsSaved = toAdd.length;
    }

    // Update existing similar patterns
    for (const update of toUpdate) {
      const { error: updateError } = await supabase
        .from('annotator_patterns')
        .update({
          usage_count: update.updates.usageCount,
          confidence: update.updates.confidence,
        })
        .eq('id', update.id);

      if (!updateError) {
        patternsUpdated++;
      }
    }

    console.log('[Patterns Confirm] Saved:', patternsSaved, 'Updated:', patternsUpdated);

    return NextResponse.json({
      success: true,
      patternsSaved,
      patternsUpdated,
    });
  } catch (error) {
    return handleError(error, 'Patterns Confirm');
  }
}

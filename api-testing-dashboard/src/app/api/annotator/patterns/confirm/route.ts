import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { deduplicatePatterns } from '@/lib/annotator';
import type { Pattern, AnnotationType } from '@/types/annotator';

// Initialize Supabase client
function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase environment variables not configured');
  }

  return createClient(supabaseUrl, supabaseKey);
}

interface PatternInput {
  originalText: string;
  annotatedText: string;
  annotationType: AnnotationType;
  contextBefore: string | null;
  contextAfter: string | null;
  confidence: number;
}

/**
 * POST /api/annotator/patterns/confirm
 * Save reviewed/accepted patterns from training or annotation session
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const userId = request.headers.get('x-user-id') || 'default-user';

    const { patterns, source, trainingPairId, sessionId } = await request.json();

    if (!Array.isArray(patterns) || patterns.length === 0) {
      return NextResponse.json(
        { error: 'patterns array is required and must not be empty' },
        { status: 400 }
      );
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
      // Skip if original text is already an annotation format
      if (/^\[.+\]$/.test(p.originalText)) return false;
      // Skip empty
      if (!p.originalText || !p.originalText.trim()) return false;
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
      .eq('user_id', userId);

    // Convert to Pattern type
    const existingPatterns: Pattern[] = (existingPatternsData || []).map((p) => ({
      id: p.id,
      userId: p.user_id,
      originalText: p.original_text,
      annotatedText: p.annotated_text,
      annotationType: p.annotation_type as AnnotationType,
      contextBefore: p.context_before,
      contextAfter: p.context_after,
      confidence: p.confidence,
      usageCount: p.usage_count,
      successRate: p.success_rate,
      trainingPairId: p.training_pair_id,
      createdAt: new Date(p.created_at),
    }));

    // Build new patterns with required fields
    const newPatterns = validPatterns.map((p) => ({
      originalText: p.originalText,
      annotatedText: p.annotatedText,
      annotationType: p.annotationType,
      contextBefore: p.contextBefore,
      contextAfter: p.contextAfter,
      confidence: p.confidence || 1.0,
      usageCount: 1,
      successRate: 1.0,
      trainingPairId: source === 'training' ? trainingPairId : null,
    }));

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
      const { error: insertError } = await supabase.from('annotator_patterns').insert(
        toAdd.map((p) => ({
          user_id: userId,
          original_text: p.originalText,
          annotated_text: p.annotatedText,
          annotation_type: p.annotationType,
          context_before: p.contextBefore,
          context_after: p.contextAfter,
          confidence: p.confidence,
          usage_count: p.usageCount,
          success_rate: p.successRate,
          training_pair_id: p.trainingPairId,
        }))
      );

      if (insertError) {
        console.error('[Patterns Confirm] Failed to insert patterns:', insertError);
        return NextResponse.json(
          { error: `Failed to save patterns: ${insertError.message}` },
          { status: 500 }
        );
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
    console.error('[Patterns Confirm] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase environment variables not configured');
  }

  return createClient(supabaseUrl, supabaseKey);
}

/**
 * DELETE /api/annotator/patterns/[id]
 * Delete a single pattern by ID
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabase();
    const userId = request.headers.get('x-user-id') || 'default-user';
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Pattern ID is required' },
        { status: 400 }
      );
    }

    // Delete the pattern (only if it belongs to the user)
    const { error, count } = await supabase
      .from('annotator_patterns')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('Failed to delete pattern:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      deletedId: id,
      deletedCount: count,
    });
  } catch (error) {
    console.error('Delete pattern error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/annotator/patterns/[id]
 * Get a single pattern by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabase();
    const userId = request.headers.get('x-user-id') || 'default-user';
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Pattern ID is required' },
        { status: 400 }
      );
    }

    const { data: pattern, error } = await supabase
      .from('annotator_patterns')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Pattern not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      pattern: {
        id: pattern.id,
        userId: pattern.user_id,
        originalText: pattern.original_text,
        annotatedText: pattern.annotated_text,
        annotationType: pattern.annotation_type,
        contextBefore: pattern.context_before,
        contextAfter: pattern.context_after,
        confidence: pattern.confidence,
        usageCount: pattern.usage_count,
        successRate: pattern.success_rate,
        trainingPairId: pattern.training_pair_id,
        createdAt: pattern.created_at,
      },
    });
  } catch (error) {
    console.error('Get pattern error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

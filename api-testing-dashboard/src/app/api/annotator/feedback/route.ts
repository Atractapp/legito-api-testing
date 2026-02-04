import { NextRequest, NextResponse } from 'next/server';
import {
  getSupabaseAdmin,
  getAuthenticatedUser,
  errorResponse,
  handleError,
  withRateLimit,
  autoLearnFromRejections,
} from '@/lib/annotator';
import type { FeedbackInput, FeedbackType, AnnotationType } from '@/types/annotator';

// Valid feedback types and annotation types for validation
const VALID_FEEDBACK_TYPES: FeedbackType[] = ['accepted', 'rejected', 'edited'];
const VALID_ANNOTATION_TYPES: AnnotationType[] = [
  'Text', 'TextInput', 'Select', 'Date', 'Link', 'Money', 'Calculation'
];
const VALID_SOURCES = ['ai', 'pattern'];

/**
 * POST /api/annotator/feedback
 * Submit feedback for one or more annotation suggestions
 * This enables the learning loop - rejected suggestions lower pattern confidence,
 * accepted suggestions increase it, and edits help refine patterns.
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimit = withRateLimit(request, 50, 60000);
    if ('error' in rateLimit) return rateLimit.error;

    const supabase = getSupabaseAdmin();
    const user = getAuthenticatedUser(request);

    const { feedback } = await request.json();

    if (!Array.isArray(feedback) || feedback.length === 0) {
      return errorResponse('INVALID_REQUEST', 'feedback array is required', 400);
    }

    // Limit array size to prevent abuse
    const MAX_FEEDBACK_ITEMS = 100;
    if (feedback.length > MAX_FEEDBACK_ITEMS) {
      return errorResponse('INVALID_REQUEST', `Maximum ${MAX_FEEDBACK_ITEMS} feedback items per request`, 400);
    }

    // Validate and filter feedback items
    const validFeedback: FeedbackInput[] = [];
    const errors: string[] = [];

    for (let i = 0; i < feedback.length; i++) {
      const item = feedback[i] as FeedbackInput;

      // Validate required fields
      if (!item.sessionId) {
        errors.push(`Item ${i}: sessionId is required`);
        continue;
      }
      if (!item.originalText) {
        errors.push(`Item ${i}: originalText is required`);
        continue;
      }
      if (!item.suggestedText) {
        errors.push(`Item ${i}: suggestedText is required`);
        continue;
      }
      if (!item.feedbackType || !VALID_FEEDBACK_TYPES.includes(item.feedbackType)) {
        errors.push(`Item ${i}: feedbackType must be one of: ${VALID_FEEDBACK_TYPES.join(', ')}`);
        continue;
      }
      if (!item.annotationType || !VALID_ANNOTATION_TYPES.includes(item.annotationType)) {
        errors.push(`Item ${i}: annotationType must be valid`);
        continue;
      }
      if (!item.source || !VALID_SOURCES.includes(item.source)) {
        errors.push(`Item ${i}: source must be 'ai' or 'pattern'`);
        continue;
      }

      // For edited feedback, editedText is required
      if (item.feedbackType === 'edited' && !item.editedText) {
        errors.push(`Item ${i}: editedText is required for 'edited' feedback type`);
        continue;
      }

      validFeedback.push(item);
    }

    if (validFeedback.length === 0) {
      return errorResponse('VALIDATION_FAILED', `All feedback items failed validation: ${errors.join('; ')}`, 400);
    }

    console.log('[Feedback POST] Saving feedback:', {
      total: feedback.length,
      valid: validFeedback.length,
      errors: errors.length,
    });

    // Insert feedback records
    // Phase 4: Include used_for_learning flag for pattern learning system
    const feedbackRows = validFeedback.map((item) => ({
      user_id: user.id,
      session_id: item.sessionId,
      original_text: item.originalText,
      suggested_text: item.suggestedText,
      annotation_type: item.annotationType,
      feedback_type: item.feedbackType,
      edited_text: item.editedText || null,
      context_before: item.contextBefore || null,
      context_after: item.contextAfter || null,
      position_start: item.positionStart || null,
      position_end: item.positionEnd || null,
      source: item.source,
      pattern_id: item.patternId || null,
      original_confidence: item.originalConfidence || null,
      used_for_learning: false, // Phase 4: Track if feedback was used for learning
    }));

    const { data: inserted, error: insertError } = await supabase
      .from('annotator_feedback')
      .insert(feedbackRows)
      .select('id');

    if (insertError) {
      console.error('[Feedback POST] Insert error:', insertError);
      return errorResponse('INSERT_FAILED', `Failed to save feedback: ${insertError.message}`, 500);
    }

    // Count pattern updates (the trigger handles the actual updates)
    const patternsAffected = validFeedback.filter((f) => f.patternId).length;

    // Phase 4: Trigger auto-learning if there are rejected items
    // This analyzes rejection patterns and creates skip patterns for repeatedly rejected text
    const rejectedCount = validFeedback.filter((f) => f.feedbackType === 'rejected').length;
    let patternsLearned = 0;
    if (rejectedCount > 0) {
      console.log(`[Feedback POST] Triggering auto-learning for ${rejectedCount} rejections`);
      patternsLearned = await autoLearnFromRejections(user.id);
      if (patternsLearned > 0) {
        console.log(`[Feedback POST] Auto-learned ${patternsLearned} skip patterns from rejections`);
      }
    }

    console.log('[Feedback POST] Saved:', {
      feedbackSaved: inserted?.length || 0,
      patternsAffected,
      patternsLearned,
    });

    return NextResponse.json({
      success: true,
      feedbackSaved: inserted?.length || 0,
      patternsUpdated: patternsAffected,
      patternsLearned, // Phase 4: Return count of newly learned skip patterns
      validationErrors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    return handleError(error, 'Feedback POST');
  }
}

/**
 * GET /api/annotator/feedback
 * Get feedback history, optionally filtered by session or type
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimit = withRateLimit(request, 100, 60000);
    if ('error' in rateLimit) return rateLimit.error;

    const supabase = getSupabaseAdmin();
    const user = getAuthenticatedUser(request);

    // Parse query params
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const feedbackType = searchParams.get('feedbackType') as FeedbackType | null;
    const limit = parseInt(searchParams.get('limit') || '50');

    // Build query
    let query = supabase
      .from('annotator_feedback')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (sessionId) {
      query = query.eq('session_id', sessionId);
    }
    if (feedbackType && VALID_FEEDBACK_TYPES.includes(feedbackType)) {
      query = query.eq('feedback_type', feedbackType);
    }

    const { data: feedback, error } = await query;

    if (error) {
      console.error('[Feedback GET] Query error:', error);
      return errorResponse('QUERY_FAILED', 'Failed to fetch feedback', 500);
    }

    // Transform for frontend
    const transformedFeedback = (feedback || []).map((f) => ({
      id: f.id,
      userId: f.user_id,
      sessionId: f.session_id,
      originalText: f.original_text,
      suggestedText: f.suggested_text,
      annotationType: f.annotation_type,
      feedbackType: f.feedback_type,
      editedText: f.edited_text,
      contextBefore: f.context_before,
      contextAfter: f.context_after,
      positionStart: f.position_start,
      positionEnd: f.position_end,
      source: f.source,
      patternId: f.pattern_id,
      originalConfidence: f.original_confidence,
      createdAt: f.created_at,
    }));

    return NextResponse.json({
      feedback: transformedFeedback,
      total: transformedFeedback.length,
    });
  } catch (error) {
    return handleError(error, 'Feedback GET');
  }
}

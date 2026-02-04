/**
 * Pattern Learning Service
 *
 * Phase 4: Learn from user accept/reject feedback
 *
 * Features:
 * - Track patterns that get repeatedly rejected
 * - Auto-suggest skip patterns from rejection clusters
 * - Promote high-success patterns to global pool
 * - Learn context-aware rejection rules
 */

import { getSupabaseAdmin } from './api-utils';
import type { AnnotationType } from '@/types/annotator';

/**
 * Rejection pattern for learning
 */
export interface RejectionPattern {
  originalText: string;
  annotationType: AnnotationType;
  rejectionCount: number;
  sessionsRejected: number;
  lastRejected: Date;
  contextSamples: string[];
}

/**
 * Learned skip pattern
 */
export interface LearnedSkipPattern {
  id: string;
  userId: string | null;
  originalText: string;
  patternType: 'exact' | 'prefix' | 'suffix' | 'contains' | 'regex';
  contextPattern: string | null;
  rejectionCount: number;
  source: 'user' | 'auto-learned' | 'system';
  reason: string | null;
  isActive: boolean;
  documentTypes: string[] | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Pattern promotion candidate
 */
export interface PromotionCandidate {
  patternId: string;
  userId: string;
  originalText: string;
  annotatedText: string;
  annotationType: AnnotationType;
  usageCount: number;
  successRate: number;
  score: number; // Composite score for ranking
}

// Thresholds for pattern learning
const REJECTION_THRESHOLD = 2; // Minimum rejections to consider learning
const SUCCESS_RATE_THRESHOLD = 0.9; // Minimum success rate for promotion
const USAGE_COUNT_THRESHOLD = 5; // Minimum usage count for promotion

/**
 * Get rejection patterns for a user that could be candidates for skip patterns
 */
export async function getRejectioPatterns(userId: string): Promise<RejectionPattern[]> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('annotator_rejection_analysis')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    console.error('[PatternLearning] Failed to get rejection patterns:', error);
    return [];
  }

  return (data || []).map(row => ({
    originalText: row.original_text,
    annotationType: row.annotation_type as AnnotationType,
    rejectionCount: row.rejection_count,
    sessionsRejected: row.sessions_rejected,
    lastRejected: new Date(row.last_rejected),
    contextSamples: row.context_samples || [],
  }));
}

/**
 * Create a learned skip pattern from rejection analysis
 */
export async function createLearnedSkipPattern(
  userId: string,
  pattern: {
    originalText: string;
    patternType?: 'exact' | 'prefix' | 'suffix' | 'contains' | 'regex';
    contextPattern?: string;
    reason?: string;
    documentTypes?: string[];
  }
): Promise<LearnedSkipPattern | null> {
  const supabase = getSupabaseAdmin();

  // Get rejection count for this pattern
  const { count } = await supabase
    .from('annotator_feedback')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('original_text', pattern.originalText)
    .eq('feedback_type', 'rejected');

  const { data, error } = await supabase
    .from('annotator_learned_skip_patterns')
    .upsert({
      user_id: userId,
      original_text: pattern.originalText,
      pattern_type: pattern.patternType || 'exact',
      context_pattern: pattern.contextPattern || null,
      rejection_count: count || 0,
      source: 'user',
      reason: pattern.reason || null,
      is_active: true,
      document_types: pattern.documentTypes || null,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,original_text,pattern_type',
    })
    .select()
    .single();

  if (error) {
    console.error('[PatternLearning] Failed to create skip pattern:', error);
    return null;
  }

  // Mark the feedback records as used for learning
  await supabase
    .from('annotator_feedback')
    .update({ used_for_learning: true })
    .eq('user_id', userId)
    .eq('original_text', pattern.originalText)
    .eq('feedback_type', 'rejected');

  return transformLearnedPattern(data);
}

/**
 * Get all active learned skip patterns for a user
 */
export async function getLearnedSkipPatterns(userId: string): Promise<LearnedSkipPattern[]> {
  const supabase = getSupabaseAdmin();

  // Get both user-specific and global patterns
  const { data, error } = await supabase
    .from('annotator_learned_skip_patterns')
    .select('*')
    .or(`user_id.eq.${userId},user_id.is.null`)
    .eq('is_active', true);

  if (error) {
    console.error('[PatternLearning] Failed to get skip patterns:', error);
    return [];
  }

  return (data || []).map(transformLearnedPattern);
}

/**
 * Check if text matches any learned skip pattern
 */
export async function shouldSkipByLearnedPattern(
  text: string,
  userId: string,
  documentType?: string
): Promise<{ skip: boolean; reason?: string; pattern?: LearnedSkipPattern }> {
  const patterns = await getLearnedSkipPatterns(userId);
  const textLower = text.toLowerCase();

  for (const pattern of patterns) {
    // Check document type filter
    if (pattern.documentTypes && pattern.documentTypes.length > 0) {
      if (documentType && !pattern.documentTypes.includes(documentType)) {
        continue;
      }
    }

    let matched = false;
    const patternLower = pattern.originalText.toLowerCase();

    switch (pattern.patternType) {
      case 'exact':
        matched = textLower === patternLower;
        break;
      case 'prefix':
        matched = textLower.startsWith(patternLower);
        break;
      case 'suffix':
        matched = textLower.endsWith(patternLower);
        break;
      case 'contains':
        matched = textLower.includes(patternLower);
        break;
      case 'regex':
        try {
          const regex = new RegExp(pattern.originalText, 'i');
          matched = regex.test(text);
        } catch {
          matched = false;
        }
        break;
    }

    if (matched) {
      return {
        skip: true,
        reason: pattern.reason || `Matched learned skip pattern: ${pattern.originalText}`,
        pattern,
      };
    }
  }

  return { skip: false };
}

/**
 * Get patterns that are candidates for promotion to global
 */
export async function getPromotionCandidates(
  minUsageCount: number = USAGE_COUNT_THRESHOLD,
  minSuccessRate: number = SUCCESS_RATE_THRESHOLD
): Promise<PromotionCandidate[]> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('annotator_patterns')
    .select('*')
    .gte('usage_count', minUsageCount)
    .gte('success_rate', minSuccessRate)
    .order('usage_count', { ascending: false });

  if (error) {
    console.error('[PatternLearning] Failed to get promotion candidates:', error);
    return [];
  }

  return (data || []).map(row => ({
    patternId: row.id,
    userId: row.user_id,
    originalText: row.original_text,
    annotatedText: row.annotated_text,
    annotationType: row.annotation_type as AnnotationType,
    usageCount: row.usage_count,
    successRate: row.success_rate,
    score: row.usage_count * row.success_rate, // Simple composite score
  }));
}

/**
 * Promote a pattern to global pool
 */
export async function promotePatternToGlobal(patternId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();

  // Get the pattern details
  const { data: pattern, error: patternError } = await supabase
    .from('annotator_patterns')
    .select('*')
    .eq('id', patternId)
    .single();

  if (patternError || !pattern) {
    console.error('[PatternLearning] Failed to get pattern for promotion:', patternError);
    return false;
  }

  // Insert into promoted patterns
  const { error: insertError } = await supabase
    .from('annotator_promoted_patterns')
    .insert({
      source_pattern_id: patternId,
      user_id: pattern.user_id,
      original_text: pattern.original_text,
      annotated_text: pattern.annotated_text,
      annotation_type: pattern.annotation_type,
      global_usage_count: 0,
      global_success_rate: pattern.success_rate,
      is_active: true,
    });

  if (insertError) {
    console.error('[PatternLearning] Failed to promote pattern:', insertError);
    return false;
  }

  console.log(`[PatternLearning] Promoted pattern "${pattern.original_text}" to global`);
  return true;
}

/**
 * Auto-learn skip patterns from repeated rejections
 * This should be called periodically or after feedback submission
 */
export async function autoLearnFromRejections(userId: string): Promise<number> {
  const supabase = getSupabaseAdmin();

  // Get patterns with multiple rejections that haven't been learned yet
  const { data, error } = await supabase
    .from('annotator_feedback')
    .select('original_text, annotation_type')
    .eq('user_id', userId)
    .eq('feedback_type', 'rejected')
    .eq('used_for_learning', false);

  if (error || !data) {
    console.error('[PatternLearning] Failed to get unprocessed rejections:', error);
    return 0;
  }

  // Count rejections by original text
  const rejectionCounts = new Map<string, { count: number; type: string }>();
  for (const row of data) {
    const existing = rejectionCounts.get(row.original_text);
    if (existing) {
      existing.count++;
    } else {
      rejectionCounts.set(row.original_text, { count: 1, type: row.annotation_type });
    }
  }

  // Create skip patterns for items with enough rejections
  let learnedCount = 0;
  for (const [text, info] of rejectionCounts) {
    if (info.count >= REJECTION_THRESHOLD) {
      const result = await createLearnedSkipPattern(userId, {
        originalText: text,
        patternType: 'exact',
        reason: `Auto-learned: rejected ${info.count} times as ${info.type}`,
      });

      if (result) {
        learnedCount++;
        console.log(`[PatternLearning] Auto-learned skip pattern: "${text}" (${info.count} rejections)`);
      }
    }
  }

  return learnedCount;
}

/**
 * Record feedback with learning support
 */
export async function recordFeedbackForLearning(
  userId: string,
  sessionId: string,
  feedback: {
    originalText: string;
    suggestedText: string;
    annotationType: AnnotationType;
    feedbackType: 'accepted' | 'rejected' | 'edited';
    editedText?: string;
    contextBefore?: string;
    contextAfter?: string;
    positionStart: number;
    positionEnd: number;
    source: 'ai' | 'pattern';
    patternId?: string;
    originalConfidence: number;
    rejectionReason?: string;
  }
): Promise<boolean> {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from('annotator_feedback')
    .insert({
      user_id: userId,
      session_id: sessionId,
      original_text: feedback.originalText,
      suggested_text: feedback.suggestedText,
      annotation_type: feedback.annotationType,
      feedback_type: feedback.feedbackType,
      edited_text: feedback.editedText || null,
      context_before: feedback.contextBefore || null,
      context_after: feedback.contextAfter || null,
      position_start: feedback.positionStart,
      position_end: feedback.positionEnd,
      source: feedback.source,
      pattern_id: feedback.patternId || null,
      original_confidence: feedback.originalConfidence,
      rejection_reason: feedback.rejectionReason || null,
      used_for_learning: false,
    });

  if (error) {
    console.error('[PatternLearning] Failed to record feedback:', error);
    return false;
  }

  // If this was a rejection, check if we should auto-learn
  if (feedback.feedbackType === 'rejected') {
    await autoLearnFromRejections(userId);
  }

  return true;
}

/**
 * Transform database row to LearnedSkipPattern
 */
function transformLearnedPattern(row: Record<string, unknown>): LearnedSkipPattern {
  return {
    id: row.id as string,
    userId: row.user_id as string | null,
    originalText: row.original_text as string,
    patternType: row.pattern_type as 'exact' | 'prefix' | 'suffix' | 'contains' | 'regex',
    contextPattern: row.context_pattern as string | null,
    rejectionCount: row.rejection_count as number,
    source: row.source as 'user' | 'auto-learned' | 'system',
    reason: row.reason as string | null,
    isActive: row.is_active as boolean,
    documentTypes: row.document_types as string[] | null,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

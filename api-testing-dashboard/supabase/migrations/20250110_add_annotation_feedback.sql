-- =============================================================================
-- Smart Annotator: Add Annotation Feedback Tracking
-- Migration: Phase 2 - Enable learning from user feedback (accepts/rejects/edits)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Annotation Feedback Table
-- Stores user feedback on AI suggestions to improve learning
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS annotator_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  session_id UUID REFERENCES annotator_sessions(id) ON DELETE CASCADE,

  -- The original suggestion from AI/patterns
  original_text TEXT NOT NULL,
  suggested_text TEXT NOT NULL,
  annotation_type TEXT NOT NULL CHECK (annotation_type IN (
    'Text', 'TextInput', 'Select', 'Date', 'Link', 'Money', 'Calculation'
  )),

  -- What the user did
  feedback_type TEXT NOT NULL CHECK (feedback_type IN (
    'accepted',     -- User accepted as-is
    'rejected',     -- User rejected the suggestion
    'edited'        -- User modified the suggestion
  )),

  -- If edited, what was the final result
  edited_text TEXT,

  -- Context for learning
  context_before TEXT,
  context_after TEXT,
  position_start INTEGER,
  position_end INTEGER,

  -- Source tracking
  source TEXT NOT NULL CHECK (source IN ('ai', 'pattern')),
  pattern_id UUID REFERENCES annotator_patterns(id) ON DELETE SET NULL,

  -- Confidence at time of suggestion
  original_confidence FLOAT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- Add context_rules column to patterns table
-- Stores semantic rules for smart pattern matching
-- -----------------------------------------------------------------------------
ALTER TABLE annotator_patterns
ADD COLUMN IF NOT EXISTS context_rules JSONB;

COMMENT ON COLUMN annotator_patterns.context_rules IS
'JSON containing TypeIndicators and semantic rules for context-aware matching';

-- -----------------------------------------------------------------------------
-- Add negative_feedback_count to patterns
-- Track how often this pattern was rejected
-- -----------------------------------------------------------------------------
ALTER TABLE annotator_patterns
ADD COLUMN IF NOT EXISTS negative_feedback_count INTEGER DEFAULT 0 CHECK (negative_feedback_count >= 0);

COMMENT ON COLUMN annotator_patterns.negative_feedback_count IS
'Number of times users rejected suggestions based on this pattern';

-- -----------------------------------------------------------------------------
-- Indexes for Feedback Table
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_feedback_user ON annotator_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_session ON annotator_feedback(session_id);
CREATE INDEX IF NOT EXISTS idx_feedback_type ON annotator_feedback(feedback_type);
CREATE INDEX IF NOT EXISTS idx_feedback_pattern ON annotator_feedback(pattern_id);
CREATE INDEX IF NOT EXISTS idx_feedback_created ON annotator_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_source ON annotator_feedback(source);

-- Compound index for finding rejected patterns quickly
CREATE INDEX IF NOT EXISTS idx_feedback_rejected
ON annotator_feedback(user_id, original_text, feedback_type)
WHERE feedback_type = 'rejected';

-- Composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_feedback_user_type
ON annotator_feedback(user_id, feedback_type);

-- -----------------------------------------------------------------------------
-- RLS Policies for Feedback Table
-- Note: For development, we're using service role key which bypasses RLS.
-- In production, implement proper auth with Supabase Auth.
-- -----------------------------------------------------------------------------
ALTER TABLE annotator_feedback ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS, so these policies are for future authenticated access
CREATE POLICY "Users can view own feedback"
ON annotator_feedback FOR SELECT
USING (auth.uid()::text = user_id OR user_id = current_setting('app.current_user_id', true)::text);

CREATE POLICY "Users can insert own feedback"
ON annotator_feedback FOR INSERT
WITH CHECK (auth.uid()::text = user_id OR user_id = current_setting('app.current_user_id', true)::text);

CREATE POLICY "Users can update own feedback"
ON annotator_feedback FOR UPDATE
USING (auth.uid()::text = user_id OR user_id = current_setting('app.current_user_id', true)::text);

CREATE POLICY "Users can delete own feedback"
ON annotator_feedback FOR DELETE
USING (auth.uid()::text = user_id OR user_id = current_setting('app.current_user_id', true)::text);

-- -----------------------------------------------------------------------------
-- Function: Update pattern confidence based on feedback
-- Automatically adjusts confidence when users provide feedback
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_pattern_from_feedback()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if there's a pattern associated
  IF NEW.pattern_id IS NOT NULL THEN
    IF NEW.feedback_type = 'rejected' THEN
      -- Decrease confidence and increase negative count
      UPDATE annotator_patterns
      SET
        negative_feedback_count = negative_feedback_count + 1,
        success_rate = GREATEST(0, success_rate - 0.1),
        confidence = GREATEST(0.1, confidence - 0.05)
      WHERE id = NEW.pattern_id;
    ELSIF NEW.feedback_type = 'accepted' THEN
      -- Increase confidence
      UPDATE annotator_patterns
      SET
        usage_count = usage_count + 1,
        success_rate = LEAST(1.0, success_rate + 0.05),
        confidence = LEAST(1.0, confidence + 0.02)
      WHERE id = NEW.pattern_id;
    ELSIF NEW.feedback_type = 'edited' THEN
      -- Slight decrease - the pattern wasn't quite right
      UPDATE annotator_patterns
      SET
        usage_count = usage_count + 1,
        success_rate = GREATEST(0, success_rate - 0.02)
      WHERE id = NEW.pattern_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic confidence updates
DROP TRIGGER IF EXISTS trigger_update_pattern_from_feedback ON annotator_feedback;
CREATE TRIGGER trigger_update_pattern_from_feedback
AFTER INSERT ON annotator_feedback
FOR EACH ROW
EXECUTE FUNCTION update_pattern_from_feedback();

-- -----------------------------------------------------------------------------
-- Function: Get rejected patterns for a user (to avoid repeating mistakes)
-- Returns patterns that were frequently rejected
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_rejected_patterns(p_user_id TEXT, p_min_rejections INTEGER DEFAULT 2)
RETURNS TABLE (
  original_text TEXT,
  suggested_text TEXT,
  rejection_count BIGINT,
  last_rejected TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    f.original_text,
    f.suggested_text,
    COUNT(*) as rejection_count,
    MAX(f.created_at) as last_rejected
  FROM annotator_feedback f
  WHERE f.user_id = p_user_id
    AND f.feedback_type = 'rejected'
  GROUP BY f.original_text, f.suggested_text
  HAVING COUNT(*) >= p_min_rejections
  ORDER BY rejection_count DESC;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- View: Pattern Performance Summary
-- Aggregates pattern performance for analytics
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW annotator_pattern_performance AS
SELECT
  p.id as pattern_id,
  p.user_id,
  p.original_text,
  p.annotated_text,
  p.annotation_type,
  p.confidence,
  p.usage_count,
  p.success_rate,
  p.negative_feedback_count,
  COALESCE(f.accept_count, 0) as accept_count,
  COALESCE(f.reject_count, 0) as reject_count,
  COALESCE(f.edit_count, 0) as edit_count,
  CASE
    WHEN COALESCE(f.total_feedback, 0) = 0 THEN NULL
    ELSE ROUND((COALESCE(f.accept_count, 0)::numeric / f.total_feedback) * 100, 1)
  END as acceptance_rate_percent,
  p.created_at
FROM annotator_patterns p
LEFT JOIN (
  SELECT
    pattern_id,
    COUNT(*) FILTER (WHERE feedback_type = 'accepted') as accept_count,
    COUNT(*) FILTER (WHERE feedback_type = 'rejected') as reject_count,
    COUNT(*) FILTER (WHERE feedback_type = 'edited') as edit_count,
    COUNT(*) as total_feedback
  FROM annotator_feedback
  GROUP BY pattern_id
) f ON p.id = f.pattern_id;

-- -----------------------------------------------------------------------------
-- Comments
-- -----------------------------------------------------------------------------
COMMENT ON TABLE annotator_feedback IS
'Stores user feedback on AI/pattern suggestions to enable continuous learning';

COMMENT ON FUNCTION update_pattern_from_feedback() IS
'Automatically adjusts pattern confidence when users accept/reject/edit suggestions';

COMMENT ON FUNCTION get_rejected_patterns(TEXT, INTEGER) IS
'Returns frequently rejected text patterns to avoid repeating mistakes';

COMMENT ON VIEW annotator_pattern_performance IS
'Aggregated view of pattern performance metrics for analytics dashboard';

-- =============================================================================
-- Smart Annotator Database Schema
-- Migration: Create annotator tables for document annotation learning
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enable required extensions
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- Training Document Pairs Table
-- Stores pairs of original and annotated documents for training
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS annotator_training_pairs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  original_text TEXT NOT NULL,
  annotated_text TEXT NOT NULL,
  original_file_path TEXT,
  annotated_file_path TEXT,
  patterns_extracted JSONB,
  is_user_corrected BOOLEAN DEFAULT FALSE,
  source_session_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- Learned Annotation Patterns Table
-- Stores patterns extracted from training pairs
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS annotator_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  original_text TEXT NOT NULL,
  annotated_text TEXT NOT NULL,
  annotation_type TEXT NOT NULL CHECK (annotation_type IN (
    'Text', 'TextInput', 'Select', 'Date', 'Link', 'Money', 'Calculation'
  )),
  context_before TEXT,
  context_after TEXT,
  confidence FLOAT DEFAULT 1.0 CHECK (confidence >= 0 AND confidence <= 1),
  usage_count INTEGER DEFAULT 1 CHECK (usage_count >= 0),
  success_rate FLOAT DEFAULT 1.0 CHECK (success_rate >= 0 AND success_rate <= 1),
  training_pair_id UUID REFERENCES annotator_training_pairs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- Annotation Sessions Table
-- Stores annotation sessions when users annotate new documents
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS annotator_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  input_filename TEXT NOT NULL,
  input_text TEXT NOT NULL,
  input_file_path TEXT,
  output_text TEXT,
  output_file_path TEXT,
  annotations_applied JSONB,
  patterns_used UUID[],
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'processing', 'completed', 'corrected', 'failed'
  )),
  claude_response JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- -----------------------------------------------------------------------------
-- Foreign Key: Session to Training Pair (for corrections)
-- -----------------------------------------------------------------------------
ALTER TABLE annotator_training_pairs
ADD CONSTRAINT fk_source_session
FOREIGN KEY (source_session_id)
REFERENCES annotator_sessions(id)
ON DELETE SET NULL;

-- -----------------------------------------------------------------------------
-- Indexes for Performance
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_training_pairs_user ON annotator_training_pairs(user_id);
CREATE INDEX IF NOT EXISTS idx_training_pairs_created ON annotator_training_pairs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_patterns_user ON annotator_patterns(user_id);
CREATE INDEX IF NOT EXISTS idx_patterns_type ON annotator_patterns(annotation_type);
CREATE INDEX IF NOT EXISTS idx_patterns_confidence ON annotator_patterns(confidence DESC);
CREATE INDEX IF NOT EXISTS idx_patterns_training_pair ON annotator_patterns(training_pair_id);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON annotator_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON annotator_sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_created ON annotator_sessions(created_at DESC);

-- -----------------------------------------------------------------------------
-- Row Level Security (RLS) Policies
-- Users can only access their own data
-- -----------------------------------------------------------------------------

-- Enable RLS on all tables
ALTER TABLE annotator_training_pairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE annotator_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE annotator_sessions ENABLE ROW LEVEL SECURITY;

-- Training Pairs Policies
CREATE POLICY "Users can view own training pairs"
ON annotator_training_pairs FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own training pairs"
ON annotator_training_pairs FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own training pairs"
ON annotator_training_pairs FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own training pairs"
ON annotator_training_pairs FOR DELETE
USING (auth.uid() = user_id);

-- Patterns Policies
CREATE POLICY "Users can view own patterns"
ON annotator_patterns FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own patterns"
ON annotator_patterns FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own patterns"
ON annotator_patterns FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own patterns"
ON annotator_patterns FOR DELETE
USING (auth.uid() = user_id);

-- Sessions Policies
CREATE POLICY "Users can view own sessions"
ON annotator_sessions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions"
ON annotator_sessions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
ON annotator_sessions FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions"
ON annotator_sessions FOR DELETE
USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- Storage Bucket Setup (run manually in Supabase Dashboard)
-- -----------------------------------------------------------------------------
-- Note: Create a storage bucket named 'annotator-files' in Supabase Dashboard
-- with the following structure:
--
-- annotator-files/
-- ├── training/{user_id}/{pair_id}_original.docx
-- ├── training/{user_id}/{pair_id}_annotated.docx
-- ├── sessions/{user_id}/{session_id}_input.docx
-- └── sessions/{user_id}/{session_id}_output.docx
--
-- Storage policies should be configured to allow:
-- - Users can upload to their own folders
-- - Users can download from their own folders
-- - Users can delete from their own folders

-- -----------------------------------------------------------------------------
-- Comments for documentation
-- -----------------------------------------------------------------------------
COMMENT ON TABLE annotator_training_pairs IS 'Stores document pairs for training the annotation model';
COMMENT ON TABLE annotator_patterns IS 'Stores learned annotation patterns with confidence scores';
COMMENT ON TABLE annotator_sessions IS 'Stores annotation sessions for tracking and corrections';

COMMENT ON COLUMN annotator_training_pairs.is_user_corrected IS 'True if this pair was created from user correction of AI output';
COMMENT ON COLUMN annotator_training_pairs.source_session_id IS 'If corrected, references the original session';
COMMENT ON COLUMN annotator_patterns.confidence IS 'Pattern reliability score (0-1), updated based on user feedback';
COMMENT ON COLUMN annotator_patterns.success_rate IS 'Historical acceptance rate for this pattern';
COMMENT ON COLUMN annotator_sessions.status IS 'pending=waiting, processing=in progress, completed=done, corrected=user fixed output, failed=error';

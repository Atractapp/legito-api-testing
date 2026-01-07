-- Drop existing policies first
DROP POLICY IF EXISTS "Users can view own training pairs" ON annotator_training_pairs;
DROP POLICY IF EXISTS "Users can insert own training pairs" ON annotator_training_pairs;
DROP POLICY IF EXISTS "Users can update own training pairs" ON annotator_training_pairs;
DROP POLICY IF EXISTS "Users can delete own training pairs" ON annotator_training_pairs;

DROP POLICY IF EXISTS "Users can view own patterns" ON annotator_patterns;
DROP POLICY IF EXISTS "Users can insert own patterns" ON annotator_patterns;
DROP POLICY IF EXISTS "Users can update own patterns" ON annotator_patterns;
DROP POLICY IF EXISTS "Users can delete own patterns" ON annotator_patterns;

DROP POLICY IF EXISTS "Users can view own sessions" ON annotator_sessions;
DROP POLICY IF EXISTS "Users can insert own sessions" ON annotator_sessions;
DROP POLICY IF EXISTS "Users can update own sessions" ON annotator_sessions;
DROP POLICY IF EXISTS "Users can delete own sessions" ON annotator_sessions;

-- Change user_id from UUID to TEXT to support non-auth users
ALTER TABLE annotator_training_pairs ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE annotator_patterns ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE annotator_sessions ALTER COLUMN user_id TYPE TEXT;

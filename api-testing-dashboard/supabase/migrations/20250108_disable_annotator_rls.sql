-- Disable RLS on annotator tables (using service role key bypasses anyway)
-- This is needed because we're not using Supabase Auth

ALTER TABLE annotator_training_pairs DISABLE ROW LEVEL SECURITY;
ALTER TABLE annotator_patterns DISABLE ROW LEVEL SECURITY;
ALTER TABLE annotator_sessions DISABLE ROW LEVEL SECURITY;

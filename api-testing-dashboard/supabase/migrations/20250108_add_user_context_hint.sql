-- Add user_context_hint column for user-provided AI guidance
ALTER TABLE annotator_patterns
ADD COLUMN IF NOT EXISTS user_context_hint TEXT;

-- Comment explaining the column
COMMENT ON COLUMN annotator_patterns.user_context_hint IS 'User-provided hint for AI to understand when to use this pattern. E.g., "Use Link when in signature section"';

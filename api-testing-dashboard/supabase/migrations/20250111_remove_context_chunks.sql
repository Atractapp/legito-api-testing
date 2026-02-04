-- =============================================================================
-- Remove context chunk columns from annotator_patterns
-- Migration: Eliminate document text chunks, use ONLY AI-generated semantic context
-- =============================================================================

-- Remove the document chunk columns (we only use AI semantic context now)
ALTER TABLE annotator_patterns
  DROP COLUMN IF EXISTS context_before,
  DROP COLUMN IF EXISTS context_after,
  DROP COLUMN IF EXISTS context_rules;

-- Note: semantic_context column already exists from 20250108_add_semantic_context.sql
-- We keep it as nullable since older patterns may not have it yet

-- Add documentation
COMMENT ON COLUMN annotator_patterns.semantic_context IS
  'AI-generated semantic description for intelligent pattern matching.
   Example: "Party name field. Could match: Seller, Buyer, Lessor, Lessee"
   This is NOT document text - it is AI-generated context for semantic matching.';

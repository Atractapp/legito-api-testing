-- =============================================================================
-- Add semantic_context column to annotator_patterns
-- Migration: Add AI-generated semantic context for intelligent pattern matching
-- =============================================================================

-- Add semantic_context column to store AI-generated descriptions
-- Example: "Party name. Could match: Seller, Buyer, Lessor, Lessee"
ALTER TABLE annotator_patterns
ADD COLUMN IF NOT EXISTS semantic_context TEXT;

-- Add a comment for documentation
COMMENT ON COLUMN annotator_patterns.semantic_context IS 'AI-generated semantic description for intelligent pattern matching across documents';

/**
 * Annotator Services Index
 *
 * Phase 5: Service extraction from route.ts
 *
 * Re-exports all extracted services for convenient imports.
 */

// Type Inference Service
export {
  inferAnnotationFromPlaceholderName,
  humanizeLabel,
  type TypeInferenceResult,
} from './type-inference';

// Slash Pattern Service
export {
  analyzeSlashPatternsWithAI,
  detectSlashPatterns,
  type SlashPatternCandidate,
} from './slash-pattern';

// Placeholder Detection Service
export {
  autoDetectPlaceholders,
  getMeaningfulLabel,
  type PlaceholderDetectionOptions,
  type PlaceholderDetectionResult,
} from './placeholder-detection';

// Link Detection Service
export {
  isContextlessPlaceholder,
  getContextualKey,
  isInSignatureBlock,
  isLikelySignatureField,
  findPartyNameDuplicates,
  convertDuplicatesToLinks,
  removeOverlappingSuggestions,
} from './link-detection';

/**
 * Smart Annotator Services
 *
 * Re-exports all annotator services for convenient imports
 */

// Storage Service
export {
  storageService,
  getStorageService,
  setStorageService,
  getTrainingDocPath,
  getSessionDocPath,
  type StorageService,
} from './storage-service';

// Document Service
export {
  parseDocx,
  diffDocuments,
  generateAnnotatedDocx,
  generateAnnotatedDocxPreservingFormat,
  applyAnnotationsToText,
  validateAnnotation,
  createAnnotation,
  findAnnotations,
  countAnnotationsByType,
  detectAnnotationType,
  extractLabel,
  extractSelectOptions,
  type ParseResult,
  type DiffResult,
  type ExtractedAnnotation,
  type HighlightedRegion,
} from './document-service';

// Pattern Service
export {
  extractPatterns,
  findPatternMatches,
  updatePatternConfidence,
  calculatePatternStats,
  deduplicatePatterns,
  filterPatternsByType,
  filterPatternsByConfidence,
  sortPatterns,
  type PatternExtractionResult,
  type PatternApplicationResult,
} from './pattern-service';

// Claude Service
export {
  claudeService,
  getClaudeService,
  isClaudeConfigured,
  ClaudeService,
  generateSemanticContext,
  generateSemanticContextBatch,
  annotateWithCandidates,
  type AnnotateDocumentOptions,
  type AnnotateWithCandidatesOptions,
  type CandidateAnnotation,
  type ClaudeServiceConfig,
} from './claude-service';

// Preprocessor - Fillable Candidate Detection
export {
  identifyFillableCandidates,
  getCandidateContext,
  formatCandidatesForPrompt,
  type CandidateRegion,
} from './preprocessor';

// API Utilities
export {
  getSupabaseAdmin,
  getAuthenticatedUser,
  requireAuth,
  validateDocxFile,
  validateDocxFiles,
  successResponse,
  errorResponse,
  handleError,
  checkRateLimit,
  withRateLimit,
  transformDbPattern,
  transformDbPatterns,
  groupRejectedFeedback,
  type AuthenticatedUser,
  type ApiResponse,
  type FileValidationResult,
} from './api-utils';

// Type Rules Service - Database-driven type inference
export {
  loadTypeRules,
  getRulesByCategory,
  getRulesByCategories,
  matchRule,
  matchRuleInCategories,
  matchAllRules,
  checkDateContextBefore,
  checkDateContextAfter,
  checkDateNameKeyword,
  checkMoneyContext,
  checkMoneyNameKeyword,
  checkSelectNameKeyword,
  isGermanGenderPattern,
  shouldSkipSlashPattern,
  getTitleSelectPatterns,
  isInstructionText,
  isPartyNamePattern,
  invalidateCache,
  preloadRules,
  isCacheLoaded,
  // Sync methods (require preloadRules first)
  checkDateContextBeforeSync,
  checkDateContextAfterSync,
  checkDateNameKeywordSync,
  checkMoneyContextSync,
  checkMoneyNameKeywordSync,
  checkSelectNameKeywordSync,
  isGermanGenderPatternSync,
  shouldSkipSlashPatternSync,
  isInstructionTextSync,
  type TypeRule,
} from './type-rules-service';

// Semantic Matching Service - Phase 2: Fuzzy pattern matching
export {
  parseSemanticContext,
  normalizeText,
  calculateSimilarity,
  findSemanticMatches,
  inferTypeFromSignals,
  buildSemanticIndex,
  lookupInSemanticIndex,
  type ParsedSemanticContext,
  type SemanticMatch,
} from './semantic-matching-service';

// Document Classification Service - Phase 3: Document type classification
export {
  classifyDocument,
  classifyByHeuristics,
  filterPatternsByDocumentType,
  filterRulesByDocumentType,
  DOCUMENT_TYPES,
  type DocumentType,
  type ClassificationResult,
} from './document-classification-service';

// Pattern Learning Service - Phase 4: Learn from feedback
export {
  getRejectioPatterns,
  createLearnedSkipPattern,
  getLearnedSkipPatterns,
  shouldSkipByLearnedPattern,
  getPromotionCandidates,
  promotePatternToGlobal,
  autoLearnFromRejections,
  recordFeedbackForLearning,
  type RejectionPattern,
  type LearnedSkipPattern,
  type PromotionCandidate,
} from './pattern-learning-service';

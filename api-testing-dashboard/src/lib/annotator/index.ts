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

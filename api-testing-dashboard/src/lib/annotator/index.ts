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
  type AnnotateDocumentOptions,
  type ClaudeServiceConfig,
} from './claude-service';

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

// ============================================================================
// Smart Annotator - Type Definitions
// ============================================================================

// ----------------------------------------------------------------------------
// Annotation Types
// ----------------------------------------------------------------------------

export type AnnotationType =
  | 'Text'
  | 'TextInput'
  | 'Select'
  | 'Date'
  | 'Link'
  | 'Money'
  | 'Calculation';

export interface Annotation {
  id: string;
  originalText: string;
  annotatedText: string;
  type: AnnotationType;
  position: {
    start: number;
    end: number;
    paragraphIndex?: number;
  };
  confidence: number;
  label?: string; // For TextInput
  options?: string[]; // For Select
}

export interface AnnotationSuggestion extends Annotation {
  isAccepted: boolean;
  isEdited: boolean;
  editedText?: string;
}

// ----------------------------------------------------------------------------
// Training Data Types
// ----------------------------------------------------------------------------

export interface TrainingPair {
  id: string;
  userId: string;
  name: string;
  originalText: string;
  annotatedText: string;
  originalFilePath: string | null;
  annotatedFilePath: string | null;
  patternsExtracted: Pattern[] | null;
  isUserCorrected: boolean;
  sourceSessionId: string | null;
  createdAt: Date;
}

export interface TrainingPairInput {
  name: string;
  originalFile: File;
  annotatedFile: File;
}

export interface TrainingPairSummary {
  id: string;
  name: string;
  patternsCount: number;
  isUserCorrected: boolean;
  createdAt: Date;
}

// ----------------------------------------------------------------------------
// Pattern Types
// ----------------------------------------------------------------------------

/**
 * Type indicator extracted from pattern context.
 * These are semantic rules like "if 'value of' appears before → Money"
 */
export interface TypeIndicator {
  keyword: string;
  position: 'before' | 'after' | 'any';
  impliesType: AnnotationType;
  confidence: number;
}

/**
 * Context rules derived from pattern context.
 * Used for smart pattern matching based on semantic meaning.
 */
export interface ContextRules {
  typeIndicators: TypeIndicator[];
}

export interface Pattern {
  id: string;
  userId: string;
  originalText: string;
  annotatedText: string;
  annotationType: AnnotationType;
  contextBefore: string | null;
  contextAfter: string | null;
  confidence: number;
  usageCount: number;
  successRate: number;
  trainingPairId: string | null;
  createdAt: Date;
  // Semantic context rules for smart matching
  contextRules?: ContextRules | null;
}

export interface PatternMatch {
  pattern: Pattern;
  matchPosition: {
    start: number;
    end: number;
  };
  matchedText: string;
  suggestedAnnotation: string;
  confidence: number;
}

export interface PatternStats {
  totalPatterns: number;
  byType: Record<AnnotationType, number>;
  averageConfidence: number;
  averageSuccessRate: number;
}

// ----------------------------------------------------------------------------
// Session Types
// ----------------------------------------------------------------------------

export type SessionStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'corrected'
  | 'failed';

export interface AnnotationSession {
  id: string;
  userId: string;
  inputFilename: string;
  inputText: string;
  inputFilePath: string | null;
  outputText: string | null;
  outputFilePath: string | null;
  annotationsApplied: Annotation[] | null;
  patternsUsed: string[] | null;
  status: SessionStatus;
  claudeResponse: ClaudeAnnotationResponse | null;
  createdAt: Date;
  completedAt: Date | null;
}

export interface SessionSummary {
  id: string;
  inputFilename: string;
  status: SessionStatus;
  annotationsCount: number;
  createdAt: Date;
}

// ----------------------------------------------------------------------------
// Document Types
// ----------------------------------------------------------------------------

export interface ParsedParagraph {
  index: number;
  text: string;
  style?: string;
  runs: ParsedRun[];
}

export interface ParsedRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  highlight?: string;
}

export interface DocumentStructure {
  paragraphs: ParsedParagraph[];
  styles: DocumentStyle[];
  metadata: DocumentMetadata;
}

export interface DocumentStyle {
  id: string;
  name: string;
  basedOn?: string;
  paragraphProperties?: Record<string, unknown>;
  runProperties?: Record<string, unknown>;
}

export interface DocumentMetadata {
  title?: string;
  author?: string;
  created?: Date;
  modified?: Date;
  wordCount?: number;
  paragraphCount?: number;
}

export interface DocumentDiff {
  type: 'added' | 'removed' | 'unchanged';
  originalText: string;
  newText: string;
  position: {
    start: number;
    end: number;
  };
}

// ----------------------------------------------------------------------------
// Claude API Types
// ----------------------------------------------------------------------------

export interface ClaudeAnnotationRequest {
  document: string;
  examples: Array<{
    original: string;
    annotated: string;
  }>;
  patterns: Pattern[];
}

export interface ClaudeAnnotationResponse {
  annotatedText: string;
  annotations: Array<{
    original: string;
    annotated: string;
    type: AnnotationType;
    position: {
      start: number;
      end: number;
    };
    confidence: number;
  }>;
  metadata?: {
    documentTypeDetected?: string;
    totalAnnotations: number;
    lowConfidenceCount: number;
    processingTime?: number;
  };
}

// ----------------------------------------------------------------------------
// API Request/Response Types
// ----------------------------------------------------------------------------

// Training API
export interface UploadTrainingPairRequest {
  name: string;
  originalFile: File;
  annotatedFile: File;
}

export interface UploadTrainingPairResponse {
  success: boolean;
  trainingPair: TrainingPair;
  patternsExtracted: number;
}

export interface ListTrainingPairsResponse {
  trainingPairs: TrainingPairSummary[];
  total: number;
}

// Annotation API
export interface AnnotateDocumentRequest {
  file: File;
}

export interface AnnotateDocumentResponse {
  success: boolean;
  session: AnnotationSession;
  suggestions: AnnotationSuggestion[];
}

export interface GenerateDocumentRequest {
  sessionId: string;
  annotations: Annotation[];
}

export interface GenerateDocumentResponse {
  success: boolean;
  downloadUrl: string;
  outputFilePath: string;
}

// Correction API
export interface SubmitCorrectionRequest {
  sessionId: string;
  correctedFile: File;
}

export interface SubmitCorrectionResponse {
  success: boolean;
  newTrainingPairId: string;
  newPatternsCount: number;
  updatedPatterns: number;
}

// Pattern API
export interface ListPatternsResponse {
  patterns: Pattern[];
  stats: PatternStats;
}

// ----------------------------------------------------------------------------
// Pattern Review Types
// ----------------------------------------------------------------------------

export interface PatternSuggestion {
  id: string;
  originalText: string;
  annotatedText: string;
  annotationType: AnnotationType;
  contextBefore: string | null;
  contextAfter: string | null;
  confidence: number;
  isAccepted: boolean;
  isEdited: boolean;
  editedAnnotatedText?: string;
}

// ----------------------------------------------------------------------------
// Store Types
// ----------------------------------------------------------------------------

export interface AnnotatorState {
  // Training data
  trainingPairs: TrainingPairSummary[];
  trainingPairsLoading: boolean;
  trainingPairsError: string | null;

  // Patterns
  patterns: Pattern[];
  patternsLoading: boolean;
  patternsError: string | null;
  patternStats: PatternStats | null;

  // Pending patterns (for review before saving)
  pendingPatterns: PatternSuggestion[] | null;
  pendingPatternsSource: 'training' | 'annotate' | null;
  pendingTrainingPairId: string | null;
  pendingSessionId: string | null;

  // Current session
  currentSession: AnnotationSession | null;
  currentSuggestions: AnnotationSuggestion[];
  sessionLoading: boolean;
  sessionError: string | null;

  // Sessions history
  sessions: SessionSummary[];
  sessionsLoading: boolean;

  // UI state
  selectedTrainingPairId: string | null;
  selectedPatternId: string | null;
  previewDocument: File | null;
}

export interface AnnotatorActions {
  // Training pair actions
  loadTrainingPairs: () => Promise<void>;
  uploadTrainingPair: (input: TrainingPairInput) => Promise<TrainingPair>;
  deleteTrainingPair: (id: string) => Promise<void>;
  selectTrainingPair: (id: string | null) => void;

  // Pattern actions
  loadPatterns: () => Promise<void>;
  deletePattern: (id: string) => Promise<void>;
  deleteAllPatterns: () => Promise<number>;
  selectPattern: (id: string | null) => void;

  // Pending pattern actions (for review before saving)
  setPendingPatterns: (
    patterns: PatternSuggestion[],
    source: 'training' | 'annotate',
    sourceId: string
  ) => void;
  acceptPendingPattern: (id: string) => void;
  rejectPendingPattern: (id: string) => void;
  updatePendingPattern: (id: string, updates: Partial<PatternSuggestion>) => void;
  confirmPendingPatterns: () => Promise<{ saved: number; updated: number }>;
  clearPendingPatterns: () => void;

  // Session actions
  startAnnotationSession: (file: File) => Promise<AnnotationSession>;
  updateSuggestion: (id: string, updates: Partial<AnnotationSuggestion>) => void;
  acceptSuggestion: (id: string) => void;
  rejectSuggestion: (id: string) => void;
  generateAnnotatedDocument: (saveAsPatterns?: boolean) => Promise<string>;
  submitCorrection: (correctedFile: File) => Promise<void>;
  loadSessions: () => Promise<void>;
  clearCurrentSession: () => void;

  // UI actions
  setPreviewDocument: (file: File | null) => void;

  // Reset
  reset: () => void;
}

export type AnnotatorStore = AnnotatorState & AnnotatorActions;

// ----------------------------------------------------------------------------
// Utility Types
// ----------------------------------------------------------------------------

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

export const ANNOTATION_TYPES: AnnotationType[] = [
  'Text',
  'TextInput',
  'Select',
  'Date',
  'Link',
  'Money',
  'Calculation',
];

export const ANNOTATION_TYPE_LABELS: Record<AnnotationType, string> = {
  Text: 'Text Element',
  TextInput: 'Text Input',
  Select: 'Dropdown Select',
  Date: 'Date Picker',
  Link: 'Hyperlink',
  Money: 'Money Field',
  Calculation: 'Calculation',
};

export const CONFIDENCE_THRESHOLDS = {
  high: 0.8,
  medium: 0.5,
  low: 0.3,
} as const;

export const SESSION_STATUS_LABELS: Record<SessionStatus, string> = {
  pending: 'Pending',
  processing: 'Processing',
  completed: 'Completed',
  corrected: 'Corrected',
  failed: 'Failed',
};

// ----------------------------------------------------------------------------
// Feedback Types (Phase 2)
// ----------------------------------------------------------------------------

export type FeedbackType = 'accepted' | 'rejected' | 'edited';
export type FeedbackSource = 'ai' | 'pattern';

export interface AnnotationFeedback {
  id: string;
  userId: string;
  sessionId: string;
  originalText: string;
  suggestedText: string;
  annotationType: AnnotationType;
  feedbackType: FeedbackType;
  editedText?: string;
  contextBefore?: string;
  contextAfter?: string;
  positionStart?: number;
  positionEnd?: number;
  source: FeedbackSource;
  patternId?: string;
  originalConfidence?: number;
  createdAt: Date;
}

export interface FeedbackInput {
  sessionId: string;
  originalText: string;
  suggestedText: string;
  annotationType: AnnotationType;
  feedbackType: FeedbackType;
  editedText?: string;
  contextBefore?: string;
  contextAfter?: string;
  positionStart?: number;
  positionEnd?: number;
  source: FeedbackSource;
  patternId?: string;
  originalConfidence?: number;
}

export interface RejectedPattern {
  originalText: string;
  suggestedText: string;
  rejectionCount: number;
  lastRejected: Date;
}

export interface PatternPerformance {
  patternId: string;
  userId: string;
  originalText: string;
  annotatedText: string;
  annotationType: AnnotationType;
  confidence: number;
  usageCount: number;
  successRate: number;
  negativeFeedbackCount: number;
  acceptCount: number;
  rejectCount: number;
  editCount: number;
  acceptanceRatePercent: number | null;
  createdAt: Date;
}

// Feedback API types
export interface SubmitFeedbackRequest {
  feedback: FeedbackInput[];
}

export interface SubmitFeedbackResponse {
  success: boolean;
  feedbackSaved: number;
  patternsUpdated: number;
}

export interface GetRejectedPatternsResponse {
  patterns: RejectedPattern[];
  total: number;
}

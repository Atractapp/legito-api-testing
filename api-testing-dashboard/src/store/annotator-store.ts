import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useShallow } from 'zustand/shallow';
import type {
  AnnotatorStore,
  AnnotatorState,
  TrainingPair,
  TrainingPairSummary,
  TrainingPairInput,
  Pattern,
  PatternStats,
  AnnotationSession,
  SessionSummary,
  AnnotationSuggestion,
} from '@/types/annotator';

// ----------------------------------------------------------------------------
// Initial State
// ----------------------------------------------------------------------------

const initialState: AnnotatorState = {
  // Training data
  trainingPairs: [],
  trainingPairsLoading: false,
  trainingPairsError: null,

  // Patterns
  patterns: [],
  patternsLoading: false,
  patternsError: null,
  patternStats: null,

  // Current session
  currentSession: null,
  currentSuggestions: [],
  sessionLoading: false,
  sessionError: null,

  // Sessions history
  sessions: [],
  sessionsLoading: false,

  // UI state
  selectedTrainingPairId: null,
  selectedPatternId: null,
  previewDocument: null,
};

// ----------------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------------

function generateId(): string {
  return `ann_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// ----------------------------------------------------------------------------
// Store
// ----------------------------------------------------------------------------

export const useAnnotatorStore = create<AnnotatorStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      // ========================================================================
      // Training Pair Actions
      // ========================================================================

      loadTrainingPairs: async () => {
        set({ trainingPairsLoading: true, trainingPairsError: null });
        try {
          const response = await fetch('/api/annotator/training');
          if (!response.ok) {
            throw new Error(`Failed to load training pairs: ${response.status}`);
          }
          const data = await response.json();
          set({
            trainingPairs: data.trainingPairs || [],
            trainingPairsLoading: false,
          });
        } catch (error) {
          set({
            trainingPairsError:
              error instanceof Error ? error.message : 'Failed to load training pairs',
            trainingPairsLoading: false,
          });
        }
      },

      uploadTrainingPair: async (input: TrainingPairInput): Promise<TrainingPair> => {
        set({ trainingPairsLoading: true, trainingPairsError: null });
        try {
          const formData = new FormData();
          formData.append('name', input.name);
          formData.append('originalFile', input.originalFile);
          formData.append('annotatedFile', input.annotatedFile);

          const response = await fetch('/api/annotator/training', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Upload failed: ${response.status}`);
          }

          const data = await response.json();
          const trainingPair = data.trainingPair as TrainingPair;

          // Add to local state
          set((state) => ({
            trainingPairs: [
              {
                id: trainingPair.id,
                name: trainingPair.name,
                patternsCount: data.patternsExtracted || 0,
                isUserCorrected: trainingPair.isUserCorrected,
                createdAt: new Date(trainingPair.createdAt),
              },
              ...state.trainingPairs,
            ],
            trainingPairsLoading: false,
          }));

          // Reload patterns after new training pair
          get().loadPatterns();

          return trainingPair;
        } catch (error) {
          set({
            trainingPairsError:
              error instanceof Error ? error.message : 'Failed to upload training pair',
            trainingPairsLoading: false,
          });
          throw error;
        }
      },

      deleteTrainingPair: async (id: string) => {
        try {
          const response = await fetch(`/api/annotator/training/${id}`, {
            method: 'DELETE',
          });

          if (!response.ok) {
            throw new Error(`Failed to delete training pair: ${response.status}`);
          }

          set((state) => ({
            trainingPairs: state.trainingPairs.filter((tp) => tp.id !== id),
            selectedTrainingPairId:
              state.selectedTrainingPairId === id ? null : state.selectedTrainingPairId,
          }));

          // Reload patterns after deletion
          get().loadPatterns();
        } catch (error) {
          set({
            trainingPairsError:
              error instanceof Error ? error.message : 'Failed to delete training pair',
          });
          throw error;
        }
      },

      selectTrainingPair: (id: string | null) => {
        set({ selectedTrainingPairId: id });
      },

      // ========================================================================
      // Pattern Actions
      // ========================================================================

      loadPatterns: async () => {
        set({ patternsLoading: true, patternsError: null });
        try {
          const response = await fetch('/api/annotator/patterns');
          if (!response.ok) {
            throw new Error(`Failed to load patterns: ${response.status}`);
          }
          const data = await response.json();
          set({
            patterns: data.patterns || [],
            patternStats: data.stats || null,
            patternsLoading: false,
          });
        } catch (error) {
          set({
            patternsError:
              error instanceof Error ? error.message : 'Failed to load patterns',
            patternsLoading: false,
          });
        }
      },

      deletePattern: async (id: string) => {
        try {
          const response = await fetch(`/api/annotator/patterns/${id}`, {
            method: 'DELETE',
          });

          if (!response.ok) {
            throw new Error(`Failed to delete pattern: ${response.status}`);
          }

          set((state) => ({
            patterns: state.patterns.filter((p) => p.id !== id),
            selectedPatternId: state.selectedPatternId === id ? null : state.selectedPatternId,
          }));
        } catch (error) {
          set({
            patternsError:
              error instanceof Error ? error.message : 'Failed to delete pattern',
          });
          throw error;
        }
      },

      selectPattern: (id: string | null) => {
        set({ selectedPatternId: id });
      },

      // ========================================================================
      // Session Actions
      // ========================================================================

      startAnnotationSession: async (file: File): Promise<AnnotationSession> => {
        set({
          sessionLoading: true,
          sessionError: null,
          currentSession: null,
          currentSuggestions: [],
        });

        try {
          const formData = new FormData();
          formData.append('file', file);

          const response = await fetch('/api/annotator/annotate', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Annotation failed: ${response.status}`);
          }

          const data = await response.json();
          const session = data.session as AnnotationSession;
          const suggestions = (data.suggestions || []) as AnnotationSuggestion[];

          set({
            currentSession: session,
            currentSuggestions: suggestions.map((s) => ({
              ...s,
              isAccepted: true, // Default to accepted
              isEdited: false,
            })),
            sessionLoading: false,
          });

          return session;
        } catch (error) {
          set({
            sessionError:
              error instanceof Error ? error.message : 'Failed to start annotation session',
            sessionLoading: false,
          });
          throw error;
        }
      },

      updateSuggestion: (id: string, updates: Partial<AnnotationSuggestion>) => {
        set((state) => ({
          currentSuggestions: state.currentSuggestions.map((s) =>
            s.id === id ? { ...s, ...updates, isEdited: true } : s
          ),
        }));
      },

      acceptSuggestion: (id: string) => {
        set((state) => ({
          currentSuggestions: state.currentSuggestions.map((s) =>
            s.id === id ? { ...s, isAccepted: true } : s
          ),
        }));
      },

      rejectSuggestion: (id: string) => {
        set((state) => ({
          currentSuggestions: state.currentSuggestions.map((s) =>
            s.id === id ? { ...s, isAccepted: false } : s
          ),
        }));
      },

      generateAnnotatedDocument: async (saveAsPatterns = false): Promise<string> => {
        const { currentSession, currentSuggestions } = get();

        if (!currentSession) {
          throw new Error('No active session');
        }

        set({ sessionLoading: true, sessionError: null });

        try {
          // Filter to only accepted annotations
          const acceptedAnnotations = currentSuggestions
            .filter((s) => s.isAccepted)
            .map((s) => ({
              id: s.id,
              originalText: s.originalText,
              annotatedText: s.isEdited && s.editedText ? s.editedText : s.annotatedText,
              type: s.type,
              position: s.position,
              confidence: s.confidence,
              label: s.label,
              options: s.options,
            }));

          const response = await fetch('/api/annotator/annotate/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId: currentSession.id,
              annotations: acceptedAnnotations,
              saveAsPatterns,
            }),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Generation failed: ${response.status}`);
          }

          const data = await response.json();

          set((state) => ({
            currentSession: state.currentSession
              ? {
                  ...state.currentSession,
                  status: 'completed',
                  outputFilePath: data.outputFilePath,
                }
              : null,
            sessionLoading: false,
          }));

          return data.downloadUrl;
        } catch (error) {
          set({
            sessionError:
              error instanceof Error ? error.message : 'Failed to generate document',
            sessionLoading: false,
          });
          throw error;
        }
      },

      submitCorrection: async (correctedFile: File) => {
        const { currentSession } = get();

        if (!currentSession) {
          throw new Error('No active session');
        }

        set({ sessionLoading: true, sessionError: null });

        try {
          const formData = new FormData();
          formData.append('correctedFile', correctedFile);

          const response = await fetch(
            `/api/annotator/sessions/${currentSession.id}/correct`,
            {
              method: 'POST',
              body: formData,
            }
          );

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Correction failed: ${response.status}`);
          }

          const data = await response.json();

          set((state) => ({
            currentSession: state.currentSession
              ? { ...state.currentSession, status: 'corrected' }
              : null,
            sessionLoading: false,
          }));

          // Reload training pairs and patterns
          get().loadTrainingPairs();
          get().loadPatterns();

          return data;
        } catch (error) {
          set({
            sessionError:
              error instanceof Error ? error.message : 'Failed to submit correction',
            sessionLoading: false,
          });
          throw error;
        }
      },

      loadSessions: async () => {
        set({ sessionsLoading: true });
        try {
          const response = await fetch('/api/annotator/sessions');
          if (!response.ok) {
            throw new Error(`Failed to load sessions: ${response.status}`);
          }
          const data = await response.json();
          set({
            sessions: data.sessions || [],
            sessionsLoading: false,
          });
        } catch (error) {
          set({ sessionsLoading: false });
        }
      },

      clearCurrentSession: () => {
        set({
          currentSession: null,
          currentSuggestions: [],
          sessionError: null,
          previewDocument: null,
        });
      },

      // ========================================================================
      // UI Actions
      // ========================================================================

      setPreviewDocument: (file: File | null) => {
        set({ previewDocument: file });
      },

      // ========================================================================
      // Reset
      // ========================================================================

      reset: () => {
        set(initialState);
      },
    }),
    {
      name: 'annotator-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist UI preferences, not data (data comes from server)
        selectedTrainingPairId: state.selectedTrainingPairId,
        selectedPatternId: state.selectedPatternId,
      }),
    }
  )
);

// ----------------------------------------------------------------------------
// Selector Hooks
// ----------------------------------------------------------------------------

export const useTrainingPairs = () =>
  useAnnotatorStore(
    useShallow((state) => ({
      trainingPairs: state.trainingPairs,
      loading: state.trainingPairsLoading,
      error: state.trainingPairsError,
    }))
  );

export const usePatterns = () =>
  useAnnotatorStore(
    useShallow((state) => ({
      patterns: state.patterns,
      stats: state.patternStats,
      loading: state.patternsLoading,
      error: state.patternsError,
    }))
  );

export const useCurrentSession = () =>
  useAnnotatorStore(
    useShallow((state) => ({
      session: state.currentSession,
      suggestions: state.currentSuggestions,
      loading: state.sessionLoading,
      error: state.sessionError,
    }))
  );

export const useSessions = () =>
  useAnnotatorStore(
    useShallow((state) => ({
      sessions: state.sessions,
      loading: state.sessionsLoading,
    }))
  );

export const useAnnotatorStats = () =>
  useAnnotatorStore(
    useShallow((state) => ({
      trainingPairsCount: state.trainingPairs.length,
      patternsCount: state.patterns.length,
      sessionsCount: state.sessions.length,
      patternStats: state.patternStats,
    }))
  );

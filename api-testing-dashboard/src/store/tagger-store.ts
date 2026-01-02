import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  LegitoCredentials,
  LegitoTag,
  DuplicateAnalysisResult,
  SyncResult,
  SyncProgress,
  ConnectionStatus,
  SyncStatus,
  DuplicateMatchStrategy,
} from '@/types/tagger';
import {
  createTagsService,
  createTaggerSyncService,
  analyzeDuplicates,
} from '@/lib/tagger-service';

interface WorkspaceState {
  credentials: LegitoCredentials | null;
  connectionStatus: ConnectionStatus;
  connectionError: string | null;
  tags: LegitoTag[];
  lastFetched: Date | null;
}

interface TaggerState {
  // Workspace states
  source: WorkspaceState;
  target: WorkspaceState;

  // Analysis state
  analysis: DuplicateAnalysisResult | null;

  // Sync state
  syncStatus: SyncStatus;
  syncProgress: SyncProgress | null;
  syncResult: SyncResult | null;
  syncError: string | null;

  // Settings
  settings: {
    duplicateStrategy: DuplicateMatchStrategy;
    concurrency: number;
    delayMs: number;
  };
}

interface TaggerActions {
  // Credential management
  setSourceCredentials: (credentials: LegitoCredentials) => void;
  setTargetCredentials: (credentials: LegitoCredentials) => void;
  clearCredentials: (workspace: 'source' | 'target') => void;

  // Connection testing
  testConnection: (workspace: 'source' | 'target') => Promise<boolean>;

  // Tag fetching
  fetchTags: (workspace: 'source' | 'target') => Promise<void>;
  fetchAllTags: () => Promise<void>;

  // Analysis
  analyzeSync: () => Promise<DuplicateAnalysisResult>;
  clearAnalysis: () => void;

  // Sync operations
  executeSync: (dryRun?: boolean) => Promise<SyncResult>;

  // Settings
  updateSettings: (settings: Partial<TaggerState['settings']>) => void;

  // Reset
  reset: () => void;
}

type TaggerStore = TaggerState & TaggerActions;

const initialWorkspaceState: WorkspaceState = {
  credentials: null,
  connectionStatus: 'disconnected',
  connectionError: null,
  tags: [],
  lastFetched: null,
};

const initialState: TaggerState = {
  source: { ...initialWorkspaceState },
  target: { ...initialWorkspaceState },
  analysis: null,
  syncStatus: 'idle',
  syncProgress: null,
  syncResult: null,
  syncError: null,
  settings: {
    duplicateStrategy: 'name-case-insensitive',
    concurrency: 3,
    delayMs: 100,
  },
};

export const useTaggerStore = create<TaggerStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      setSourceCredentials: (credentials) => {
        set((state) => ({
          source: {
            ...state.source,
            credentials,
            connectionStatus: 'disconnected',
            connectionError: null,
          },
        }));
      },

      setTargetCredentials: (credentials) => {
        set((state) => ({
          target: {
            ...state.target,
            credentials,
            connectionStatus: 'disconnected',
            connectionError: null,
          },
        }));
      },

      clearCredentials: (workspace) => {
        set((state) => ({
          [workspace]: { ...initialWorkspaceState },
        }));
      },

      testConnection: async (workspace) => {
        const state = get();
        const credentials = state[workspace].credentials;

        if (!credentials) {
          set((state) => ({
            [workspace]: {
              ...state[workspace],
              connectionStatus: 'error' as ConnectionStatus,
              connectionError: 'No credentials configured',
            },
          }));
          return false;
        }

        set((state) => ({
          [workspace]: {
            ...state[workspace],
            connectionStatus: 'connecting' as ConnectionStatus,
            connectionError: null,
          },
        }));

        try {
          const service = createTagsService(credentials);
          const isValid = await service.validateCredentials();

          set((state) => ({
            [workspace]: {
              ...state[workspace],
              connectionStatus: isValid ? ('connected' as ConnectionStatus) : ('error' as ConnectionStatus),
              connectionError: isValid ? null : 'Invalid credentials',
            },
          }));

          return isValid;
        } catch (error) {
          set((state) => ({
            [workspace]: {
              ...state[workspace],
              connectionStatus: 'error' as ConnectionStatus,
              connectionError:
                error instanceof Error ? error.message : 'Connection failed',
            },
          }));
          return false;
        }
      },

      fetchTags: async (workspace) => {
        const state = get();
        const credentials = state[workspace].credentials;

        if (!credentials) {
          throw new Error(`No credentials configured for ${workspace} workspace`);
        }

        const service = createTagsService(credentials);
        const result = await service.getAllTags();

        if (!result.success) {
          throw new Error(result.error.message);
        }

        set((state) => ({
          [workspace]: {
            ...state[workspace],
            tags: result.data,
            lastFetched: new Date(),
          },
        }));
      },

      fetchAllTags: async () => {
        await Promise.all([get().fetchTags('source'), get().fetchTags('target')]);
      },

      analyzeSync: async () => {
        set({ syncStatus: 'analyzing', syncError: null });

        try {
          await get().fetchAllTags();

          const state = get();
          const analysis = analyzeDuplicates(
            state.source.tags,
            state.target.tags,
            state.settings.duplicateStrategy
          );

          set({ analysis, syncStatus: 'idle' });
          return analysis;
        } catch (error) {
          set({
            syncStatus: 'error',
            syncError: error instanceof Error ? error.message : 'Analysis failed',
          });
          throw error;
        }
      },

      clearAnalysis: () => {
        set({ analysis: null, syncResult: null });
      },

      executeSync: async (dryRun = false) => {
        const state = get();

        if (!state.source.credentials || !state.target.credentials) {
          throw new Error('Both source and target credentials are required');
        }

        set({ syncStatus: 'syncing', syncError: null, syncResult: null });

        try {
          const syncService = createTaggerSyncService(
            state.source.credentials,
            state.target.credentials
          );

          const result = await syncService.sync({
            duplicateStrategy: state.settings.duplicateStrategy,
            concurrency: state.settings.concurrency,
            delayMs: state.settings.delayMs,
            dryRun,
            onProgress: (progress) => {
              set({ syncProgress: progress });
            },
          });

          set({
            syncResult: result,
            syncStatus: 'complete',
            syncProgress: null,
          });

          // Refresh target tags after sync
          if (!dryRun) {
            await get().fetchTags('target');
          }

          return result;
        } catch (error) {
          set({
            syncStatus: 'error',
            syncError: error instanceof Error ? error.message : 'Sync failed',
            syncProgress: null,
          });
          throw error;
        }
      },

      updateSettings: (newSettings) => {
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        }));
      },

      reset: () => {
        set(initialState);
      },
    }),
    {
      name: 'tagger-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        source: { credentials: state.source.credentials },
        target: { credentials: state.target.credentials },
        settings: state.settings,
      }),
    }
  )
);

// Selector hooks
export const useSourceWorkspace = () => useTaggerStore((state) => state.source);
export const useTargetWorkspace = () => useTaggerStore((state) => state.target);
export const useSyncStatus = () =>
  useTaggerStore((state) => ({
    status: state.syncStatus,
    progress: state.syncProgress,
    result: state.syncResult,
    error: state.syncError,
  }));
export const useAnalysis = () => useTaggerStore((state) => state.analysis);
export const useTaggerSettings = () => useTaggerStore((state) => state.settings);

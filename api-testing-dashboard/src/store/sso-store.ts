import { create } from 'zustand';
import { useShallow } from 'zustand/shallow';
import type {
  SsoServerId,
  SsoTestResult,
  SsoServerStatus,
  SsoOverallStats,
  SsoTriggerResponse,
} from '@/types/sso';
import { SSO_SERVER_LIST } from '@/lib/sso/config';

interface SsoState {
  // Test results history
  results: SsoTestResult[];
  resultsLoading: boolean;
  resultsError: string | null;

  // Server statuses
  serverStatuses: Record<SsoServerId, SsoServerStatus | null>;
  statusLoading: boolean;

  // Running tests
  runningTests: Set<SsoServerId>;

  // Overall stats
  overallStats: SsoOverallStats | null;
}

interface SsoActions {
  // Fetch operations
  fetchResults: (serverId?: SsoServerId, limit?: number) => Promise<void>;
  fetchServerStatus: (serverId: SsoServerId) => Promise<void>;
  fetchAllStatuses: () => Promise<void>;

  // Test operations
  triggerTest: (serverId: SsoServerId) => Promise<SsoTriggerResponse>;

  // Local state updates
  setTestRunning: (serverId: SsoServerId, isRunning: boolean) => void;
  updateTestResult: (result: SsoTestResult) => void;

  // Reset
  reset: () => void;
}

type SsoStore = SsoState & SsoActions;

const initialServerStatuses: Record<SsoServerId, SsoServerStatus | null> = {
  emea: null,
  us: null,
  quarterly: null,
};

const initialState: SsoState = {
  results: [],
  resultsLoading: false,
  resultsError: null,
  serverStatuses: { ...initialServerStatuses },
  statusLoading: false,
  runningTests: new Set(),
  overallStats: null,
};

export const useSsoStore = create<SsoStore>()((set, get) => ({
  ...initialState,

  fetchResults: async (serverId?: SsoServerId, limit = 20) => {
    set({ resultsLoading: true, resultsError: null });

    try {
      const params = new URLSearchParams();
      if (serverId) params.set('serverId', serverId);
      params.set('limit', limit.toString());

      const response = await fetch(`/api/sso/results?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch results');
      }

      set({ results: data.results, resultsLoading: false });
    } catch (error) {
      set({
        resultsError: error instanceof Error ? error.message : 'Failed to fetch results',
        resultsLoading: false,
      });
    }
  },

  fetchServerStatus: async (serverId: SsoServerId) => {
    set({ statusLoading: true });

    try {
      const response = await fetch(`/api/sso/status?serverId=${serverId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch status');
      }

      set((state) => ({
        serverStatuses: {
          ...state.serverStatuses,
          [serverId]: data.status,
        },
        statusLoading: false,
      }));
    } catch (error) {
      console.error(`Failed to fetch status for ${serverId}:`, error);
      set({ statusLoading: false });
    }
  },

  fetchAllStatuses: async () => {
    set({ statusLoading: true });

    try {
      const promises = SSO_SERVER_LIST.map((server) =>
        fetch(`/api/sso/status?serverId=${server.id}`)
          .then((res) => res.json())
          .then((data) => ({ serverId: server.id, status: data.status }))
          .catch(() => ({ serverId: server.id, status: null }))
      );

      const results = await Promise.all(promises);

      const statuses: Record<SsoServerId, SsoServerStatus | null> = {
        emea: null,
        us: null,
        quarterly: null,
      };

      let totalTests = 0;
      let totalSuccess = 0;
      let failuresLast24h = 0;

      for (const { serverId, status } of results) {
        statuses[serverId as SsoServerId] = status;
        if (status?.stats) {
          totalTests += status.stats.totalTests;
          totalSuccess += status.stats.successCount;
        }
      }

      const overallStats: SsoOverallStats = {
        totalTests,
        successRate: totalTests > 0 ? (totalSuccess / totalTests) * 100 : 0,
        failuresLast24h,
        servers: statuses as Record<SsoServerId, SsoServerStatus>,
      };

      set({
        serverStatuses: statuses,
        overallStats,
        statusLoading: false,
      });
    } catch (error) {
      console.error('Failed to fetch all statuses:', error);
      set({ statusLoading: false });
    }
  },

  triggerTest: async (serverId: SsoServerId): Promise<SsoTriggerResponse> => {
    set((state) => ({
      runningTests: new Set([...state.runningTests, serverId]),
    }));

    try {
      const response = await fetch('/api/sso/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverId, triggeredBy: 'manual' }),
      });

      const data = await response.json();

      if (!response.ok) {
        set((state) => {
          const newRunning = new Set(state.runningTests);
          newRunning.delete(serverId);
          return { runningTests: newRunning };
        });
        return { success: false, message: data.error || 'Failed to trigger test' };
      }

      return data;
    } catch (error) {
      set((state) => {
        const newRunning = new Set(state.runningTests);
        newRunning.delete(serverId);
        return { runningTests: newRunning };
      });
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to trigger test',
      };
    }
  },

  setTestRunning: (serverId: SsoServerId, isRunning: boolean) => {
    set((state) => {
      const newRunning = new Set(state.runningTests);
      if (isRunning) {
        newRunning.add(serverId);
      } else {
        newRunning.delete(serverId);
      }
      return { runningTests: newRunning };
    });
  },

  updateTestResult: (result: SsoTestResult) => {
    set((state) => ({
      results: [result, ...state.results.filter((r) => r.id !== result.id)],
    }));
  },

  reset: () => {
    set(initialState);
  },
}));

// Selector hooks
export const useSsoResults = () =>
  useSsoStore(
    useShallow((state) => ({
      results: state.results,
      loading: state.resultsLoading,
      error: state.resultsError,
    }))
  );

export const useSsoServerStatus = (serverId: SsoServerId) =>
  useSsoStore((state) => state.serverStatuses[serverId]);

export const useSsoAllStatuses = () =>
  useSsoStore(useShallow((state) => state.serverStatuses));

export const useSsoOverallStats = () => useSsoStore((state) => state.overallStats);

export const useSsoRunningTests = () => useSsoStore((state) => state.runningTests);

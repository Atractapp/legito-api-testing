import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useShallow } from 'zustand/shallow';
import type {
  McpWorkspace,
  McpConnectionStatus,
  McpServerStatus,
  LegitoCredentials,
} from '@/types/mcp';

interface WorkspaceStateEntry {
  workspace: McpWorkspace;
  connectionStatus: McpConnectionStatus;
  connectionError: string | null;
  lastConnected: Date | null;
}

interface McpState {
  // All configured workspaces
  workspaces: Record<string, WorkspaceStateEntry>;

  // Active workspace ID for operations
  activeWorkspaceId: string | null;

  // MCP server status
  serverStatus: McpServerStatus;
  serverError: string | null;

  // Recent tool invocations (for status page)
  recentInvocations: ToolInvocation[];
}

interface ToolInvocation {
  id: string;
  toolName: string;
  workspaceId: string;
  timestamp: Date;
  success: boolean;
  duration?: number;
  error?: string;
}

interface McpActions {
  // Workspace management
  addWorkspace: (workspace: McpWorkspace) => void;
  updateWorkspace: (id: string, updates: Partial<McpWorkspace>) => void;
  removeWorkspace: (id: string) => void;
  setActiveWorkspace: (id: string | null) => void;
  setDefaultWorkspace: (id: string) => void;

  // Connection testing
  testConnection: (workspaceId: string) => Promise<boolean>;
  setConnectionStatus: (workspaceId: string, status: McpConnectionStatus, error?: string) => void;

  // Server status
  setServerStatus: (status: McpServerStatus, error?: string) => void;

  // Invocation tracking
  recordInvocation: (invocation: Omit<ToolInvocation, 'id' | 'timestamp'>) => void;
  clearInvocations: () => void;

  // Getters
  getWorkspace: (id: string) => WorkspaceStateEntry | undefined;
  getCredentials: (id: string) => LegitoCredentials | undefined;
  getAllWorkspaces: () => WorkspaceStateEntry[];

  // Reset
  reset: () => void;
}

type McpStore = McpState & McpActions;

const initialState: McpState = {
  workspaces: {},
  activeWorkspaceId: null,
  serverStatus: 'stopped',
  serverError: null,
  recentInvocations: [],
};

// Generate unique ID for workspaces
function generateId(): string {
  return `ws_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export const useMcpStore = create<McpStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      addWorkspace: (workspace) => {
        const id = workspace.id || generateId();
        const workspaceWithId = { ...workspace, id };

        set((state) => ({
          workspaces: {
            ...state.workspaces,
            [id]: {
              workspace: workspaceWithId,
              connectionStatus: 'disconnected',
              connectionError: null,
              lastConnected: null,
            },
          },
          // Set as active if first workspace
          activeWorkspaceId: state.activeWorkspaceId || id,
        }));
      },

      updateWorkspace: (id, updates) => {
        set((state) => {
          const existing = state.workspaces[id];
          if (!existing) return state;

          return {
            workspaces: {
              ...state.workspaces,
              [id]: {
                ...existing,
                workspace: { ...existing.workspace, ...updates },
                connectionStatus: 'disconnected',
                connectionError: null,
              },
            },
          };
        });
      },

      removeWorkspace: (id) => {
        set((state) => {
          const { [id]: removed, ...rest } = state.workspaces;
          const remainingIds = Object.keys(rest);

          return {
            workspaces: rest,
            activeWorkspaceId: state.activeWorkspaceId === id
              ? remainingIds[0] || null
              : state.activeWorkspaceId,
          };
        });
      },

      setActiveWorkspace: (id) => {
        set({ activeWorkspaceId: id });
      },

      setDefaultWorkspace: (id) => {
        set((state) => {
          const newWorkspaces = { ...state.workspaces };

          // Clear default from all workspaces
          Object.keys(newWorkspaces).forEach((wsId) => {
            if (newWorkspaces[wsId]) {
              newWorkspaces[wsId] = {
                ...newWorkspaces[wsId],
                workspace: {
                  ...newWorkspaces[wsId].workspace,
                  isDefault: wsId === id,
                },
              };
            }
          });

          return { workspaces: newWorkspaces };
        });
      },

      testConnection: async (workspaceId) => {
        const state = get();
        const entry = state.workspaces[workspaceId];

        if (!entry) {
          return false;
        }

        set((state) => ({
          workspaces: {
            ...state.workspaces,
            [workspaceId]: {
              ...state.workspaces[workspaceId],
              connectionStatus: 'connecting',
              connectionError: null,
            },
          },
        }));

        try {
          const { credentials } = entry.workspace;
          const baseUrl = `/api/tagger/${credentials.region}/info`;

          const response = await fetch(baseUrl, {
            headers: {
              'X-Legito-Key': credentials.key,
              'X-Legito-Private-Key': credentials.privateKey,
            },
          });

          const success = response.ok;

          set((state) => ({
            workspaces: {
              ...state.workspaces,
              [workspaceId]: {
                ...state.workspaces[workspaceId],
                connectionStatus: success ? 'connected' : 'error',
                connectionError: success ? null : `HTTP ${response.status}`,
                lastConnected: success ? new Date() : state.workspaces[workspaceId]?.lastConnected || null,
              },
            },
          }));

          return success;
        } catch (error) {
          set((state) => ({
            workspaces: {
              ...state.workspaces,
              [workspaceId]: {
                ...state.workspaces[workspaceId],
                connectionStatus: 'error',
                connectionError: error instanceof Error ? error.message : 'Connection failed',
              },
            },
          }));
          return false;
        }
      },

      setConnectionStatus: (workspaceId, status, error) => {
        set((state) => {
          const existing = state.workspaces[workspaceId];
          if (!existing) return state;

          return {
            workspaces: {
              ...state.workspaces,
              [workspaceId]: {
                ...existing,
                connectionStatus: status,
                connectionError: error || null,
                lastConnected: status === 'connected' ? new Date() : existing.lastConnected,
              },
            },
          };
        });
      },

      setServerStatus: (status, error) => {
        set({
          serverStatus: status,
          serverError: error || null,
        });
      },

      recordInvocation: (invocation) => {
        set((state) => ({
          recentInvocations: [
            {
              id: generateId(),
              timestamp: new Date(),
              ...invocation,
            },
            ...state.recentInvocations.slice(0, 99), // Keep last 100
          ],
        }));
      },

      clearInvocations: () => {
        set({ recentInvocations: [] });
      },

      getWorkspace: (id) => {
        return get().workspaces[id];
      },

      getCredentials: (id) => {
        const entry = get().workspaces[id];
        return entry?.workspace.credentials;
      },

      getAllWorkspaces: () => {
        return Object.values(get().workspaces);
      },

      reset: () => {
        set(initialState);
      },
    }),
    {
      name: 'mcp-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        workspaces: Object.fromEntries(
          Object.entries(state.workspaces).map(([id, entry]) => [
            id,
            {
              workspace: entry.workspace,
              connectionStatus: 'disconnected' as McpConnectionStatus,
              connectionError: null,
              lastConnected: null,
            },
          ])
        ),
        activeWorkspaceId: state.activeWorkspaceId,
      }),
    }
  )
);

// Selector hooks
export const useActiveWorkspace = () =>
  useMcpStore(useShallow((state) => {
    const id = state.activeWorkspaceId;
    return id ? state.workspaces[id] : undefined;
  }));

export const useMcpWorkspaces = () =>
  useMcpStore(useShallow((state) => Object.values(state.workspaces)));

export const useMcpServerStatus = () =>
  useMcpStore(useShallow((state) => ({
    status: state.serverStatus,
    error: state.serverError,
  })));

export const useRecentInvocations = () =>
  useMcpStore((state) => state.recentInvocations);

// Server-side getter for MCP tools (can't use hooks in server context)
export function getMcpWorkspaceCredentials(workspaceId: string): LegitoCredentials | undefined {
  // This will be called from the MCP server context
  // We need to access the store state directly
  const state = useMcpStore.getState();
  const entry = state.workspaces[workspaceId];
  return entry?.workspace.credentials;
}

export function getDefaultWorkspaceId(): string | undefined {
  const state = useMcpStore.getState();
  const defaultEntry = Object.entries(state.workspaces).find(
    ([, entry]) => entry.workspace.isDefault
  );
  return defaultEntry?.[0] || state.activeWorkspaceId || Object.keys(state.workspaces)[0];
}

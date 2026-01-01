import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  TestCase,
  TestResult,
  TestRun,
  TestCategory,
  TestConfiguration,
  LogEntry,
  TestFilter,
  DashboardStats,
  HistoricalData,
} from '@/types';

interface TestStore {
  // Test Data
  categories: TestCategory[];
  currentRun: TestRun | null;
  testResults: TestResult[];
  logs: LogEntry[];
  historicalData: HistoricalData[];

  // Configuration
  configuration: TestConfiguration;
  savedConfigurations: TestConfiguration[];

  // UI State
  selectedTests: string[];
  filter: TestFilter;
  isRunning: boolean;
  activeTab: string;

  // Dashboard Stats
  stats: DashboardStats;

  // Actions
  setCategories: (categories: TestCategory[]) => void;
  setCurrentRun: (run: TestRun | null) => void;
  addTestResult: (result: TestResult) => void;
  clearTestResults: () => void;
  addLog: (log: LogEntry) => void;
  clearLogs: () => void;
  setConfiguration: (config: Partial<TestConfiguration>) => void;
  saveConfiguration: (config: TestConfiguration) => void;
  loadConfiguration: (id: string) => void;
  deleteConfiguration: (id: string) => void;
  setSelectedTests: (testIds: string[]) => void;
  toggleTestSelection: (testId: string) => void;
  selectCategory: (categoryId: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
  setFilter: (filter: Partial<TestFilter>) => void;
  clearFilter: () => void;
  setIsRunning: (running: boolean) => void;
  setActiveTab: (tab: string) => void;
  updateTestStatus: (testId: string, status: TestCase['status']) => void;
  setStats: (stats: DashboardStats) => void;
  setHistoricalData: (data: HistoricalData[]) => void;
}

const defaultConfiguration: TestConfiguration = {
  id: 'default',
  name: 'Default Configuration',
  baseUrl: 'https://api.example.com',
  authType: 'jwt',
  authToken: '',
  apiKey: '',
  templateIds: [],
  documentIds: [],
  timeout: 30000,
  retryCount: 0,
  parallelExecution: false,
  environment: 'development',
  headers: {
    'Content-Type': 'application/json',
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const defaultStats: DashboardStats = {
  totalTestRuns: 0,
  totalTests: 0,
  avgPassRate: 0,
  avgDuration: 0,
  lastRunTime: undefined,
  recentTrend: 'stable',
  todayRuns: 0,
  weeklyRuns: 0,
};

// Sample test categories for demonstration
const sampleCategories: TestCategory[] = [
  {
    id: 'auth',
    name: 'Authentication',
    description: 'Authentication and authorization tests',
    tests: [
      {
        id: 'auth-1',
        name: 'Login with valid credentials',
        description: 'Verify successful login with valid username and password',
        category: 'auth',
        endpoint: '/api/auth/login',
        method: 'POST',
        status: 'pending',
        assertions: 5,
      },
      {
        id: 'auth-2',
        name: 'Login with invalid credentials',
        description: 'Verify error response for invalid credentials',
        category: 'auth',
        endpoint: '/api/auth/login',
        method: 'POST',
        status: 'pending',
        assertions: 3,
      },
      {
        id: 'auth-3',
        name: 'Token refresh',
        description: 'Verify JWT token refresh functionality',
        category: 'auth',
        endpoint: '/api/auth/refresh',
        method: 'POST',
        status: 'pending',
        assertions: 4,
      },
      {
        id: 'auth-4',
        name: 'Logout',
        description: 'Verify logout invalidates session',
        category: 'auth',
        endpoint: '/api/auth/logout',
        method: 'POST',
        status: 'pending',
        assertions: 2,
      },
    ],
  },
  {
    id: 'templates',
    name: 'Templates',
    description: 'Template CRUD operations',
    tests: [
      {
        id: 'tmpl-1',
        name: 'List all templates',
        description: 'Retrieve paginated list of templates',
        category: 'templates',
        endpoint: '/api/templates',
        method: 'GET',
        status: 'pending',
        assertions: 6,
      },
      {
        id: 'tmpl-2',
        name: 'Get template by ID',
        description: 'Retrieve single template details',
        category: 'templates',
        endpoint: '/api/templates/:id',
        method: 'GET',
        status: 'pending',
        assertions: 4,
      },
      {
        id: 'tmpl-3',
        name: 'Create new template',
        description: 'Create template with valid data',
        category: 'templates',
        endpoint: '/api/templates',
        method: 'POST',
        status: 'pending',
        assertions: 5,
      },
      {
        id: 'tmpl-4',
        name: 'Update template',
        description: 'Update existing template',
        category: 'templates',
        endpoint: '/api/templates/:id',
        method: 'PUT',
        status: 'pending',
        assertions: 4,
      },
      {
        id: 'tmpl-5',
        name: 'Delete template',
        description: 'Delete template and verify removal',
        category: 'templates',
        endpoint: '/api/templates/:id',
        method: 'DELETE',
        status: 'pending',
        assertions: 3,
      },
    ],
  },
  {
    id: 'documents',
    name: 'Documents',
    description: 'Document management tests',
    tests: [
      {
        id: 'doc-1',
        name: 'Generate document from template',
        description: 'Create document using template and data',
        category: 'documents',
        endpoint: '/api/documents/generate',
        method: 'POST',
        status: 'pending',
        assertions: 7,
      },
      {
        id: 'doc-2',
        name: 'List documents',
        description: 'Retrieve list of generated documents',
        category: 'documents',
        endpoint: '/api/documents',
        method: 'GET',
        status: 'pending',
        assertions: 5,
      },
      {
        id: 'doc-3',
        name: 'Download document',
        description: 'Download document in specified format',
        category: 'documents',
        endpoint: '/api/documents/:id/download',
        method: 'GET',
        status: 'pending',
        assertions: 4,
      },
      {
        id: 'doc-4',
        name: 'Delete document',
        description: 'Delete document permanently',
        category: 'documents',
        endpoint: '/api/documents/:id',
        method: 'DELETE',
        status: 'pending',
        assertions: 3,
      },
    ],
  },
  {
    id: 'users',
    name: 'Users',
    description: 'User management operations',
    tests: [
      {
        id: 'user-1',
        name: 'Get current user',
        description: 'Retrieve authenticated user profile',
        category: 'users',
        endpoint: '/api/users/me',
        method: 'GET',
        status: 'pending',
        assertions: 5,
      },
      {
        id: 'user-2',
        name: 'Update user profile',
        description: 'Update user profile information',
        category: 'users',
        endpoint: '/api/users/me',
        method: 'PUT',
        status: 'pending',
        assertions: 4,
      },
      {
        id: 'user-3',
        name: 'List organization users',
        description: 'List all users in organization',
        category: 'users',
        endpoint: '/api/users',
        method: 'GET',
        status: 'pending',
        assertions: 6,
      },
    ],
  },
  {
    id: 'webhooks',
    name: 'Webhooks',
    description: 'Webhook configuration and delivery',
    tests: [
      {
        id: 'wh-1',
        name: 'Create webhook',
        description: 'Register new webhook endpoint',
        category: 'webhooks',
        endpoint: '/api/webhooks',
        method: 'POST',
        status: 'pending',
        assertions: 4,
      },
      {
        id: 'wh-2',
        name: 'List webhooks',
        description: 'List all configured webhooks',
        category: 'webhooks',
        endpoint: '/api/webhooks',
        method: 'GET',
        status: 'pending',
        assertions: 3,
      },
      {
        id: 'wh-3',
        name: 'Test webhook delivery',
        description: 'Send test payload to webhook',
        category: 'webhooks',
        endpoint: '/api/webhooks/:id/test',
        method: 'POST',
        status: 'pending',
        assertions: 5,
      },
    ],
  },
];

export const useTestStore = create<TestStore>()(
  persist(
    (set, get) => ({
      // Initial State
      categories: sampleCategories,
      currentRun: null,
      testResults: [],
      logs: [],
      historicalData: [],
      configuration: defaultConfiguration,
      savedConfigurations: [defaultConfiguration],
      selectedTests: [],
      filter: {},
      isRunning: false,
      activeTab: 'runner',
      stats: defaultStats,

      // Actions
      setCategories: (categories) => set({ categories }),

      setCurrentRun: (run) => set({ currentRun: run }),

      addTestResult: (result) =>
        set((state) => ({
          testResults: [...state.testResults, result],
        })),

      clearTestResults: () => set({ testResults: [] }),

      addLog: (log) =>
        set((state) => ({
          logs: [...state.logs, log],
        })),

      clearLogs: () => set({ logs: [] }),

      setConfiguration: (config) =>
        set((state) => ({
          configuration: {
            ...state.configuration,
            ...config,
            updatedAt: new Date().toISOString(),
          },
        })),

      saveConfiguration: (config) =>
        set((state) => {
          const exists = state.savedConfigurations.find((c) => c.id === config.id);
          if (exists) {
            return {
              savedConfigurations: state.savedConfigurations.map((c) =>
                c.id === config.id ? config : c
              ),
            };
          }
          return {
            savedConfigurations: [...state.savedConfigurations, config],
          };
        }),

      loadConfiguration: (id) => {
        const config = get().savedConfigurations.find((c) => c.id === id);
        if (config) {
          set({ configuration: config });
        }
      },

      deleteConfiguration: (id) =>
        set((state) => ({
          savedConfigurations: state.savedConfigurations.filter((c) => c.id !== id),
        })),

      setSelectedTests: (testIds) => set({ selectedTests: testIds }),

      toggleTestSelection: (testId) =>
        set((state) => {
          const isSelected = state.selectedTests.includes(testId);
          return {
            selectedTests: isSelected
              ? state.selectedTests.filter((id) => id !== testId)
              : [...state.selectedTests, testId],
          };
        }),

      selectCategory: (categoryId) =>
        set((state) => {
          const category = state.categories.find((c) => c.id === categoryId);
          if (!category) return state;
          const categoryTestIds = category.tests.map((t) => t.id);
          const allSelected = categoryTestIds.every((id) =>
            state.selectedTests.includes(id)
          );
          if (allSelected) {
            return {
              selectedTests: state.selectedTests.filter(
                (id) => !categoryTestIds.includes(id)
              ),
            };
          }
          return {
            selectedTests: [...new Set([...state.selectedTests, ...categoryTestIds])],
          };
        }),

      selectAll: () =>
        set((state) => ({
          selectedTests: state.categories.flatMap((c) => c.tests.map((t) => t.id)),
        })),

      deselectAll: () => set({ selectedTests: [] }),

      setFilter: (filter) =>
        set((state) => ({
          filter: { ...state.filter, ...filter },
        })),

      clearFilter: () => set({ filter: {} }),

      setIsRunning: (running) => set({ isRunning: running }),

      setActiveTab: (tab) => set({ activeTab: tab }),

      updateTestStatus: (testId, status) =>
        set((state) => ({
          categories: state.categories.map((category) => ({
            ...category,
            tests: category.tests.map((test) =>
              test.id === testId ? { ...test, status } : test
            ),
          })),
        })),

      setStats: (stats) => set({ stats }),

      setHistoricalData: (data) => set({ historicalData: data }),
    }),
    {
      name: 'api-test-dashboard',
      partialize: (state) => ({
        configuration: state.configuration,
        savedConfigurations: state.savedConfigurations,
        historicalData: state.historicalData,
      }),
    }
  )
);

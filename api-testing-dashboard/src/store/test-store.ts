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
  TestPreset,
} from '@/types';
import { LEGITO_TESTS } from '@/lib/legito-api';

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

  // Preset Management
  activePreset: TestPreset | null;

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
  setActivePreset: (preset: TestPreset | null) => void;
}

const defaultConfiguration: TestConfiguration = {
  id: 'legito-production',
  name: 'Legito Production',
  baseUrl: 'https://emea.legito.com/api/v7',
  authType: 'jwt',
  authToken: '',
  apiKey: process.env.NEXT_PUBLIC_LEGITO_API_KEY || '',
  privateKey: process.env.NEXT_PUBLIC_LEGITO_PRIVATE_KEY || '',
  templateIds: ['64004'],
  documentIds: [],
  timeout: 30000,
  retryCount: 0,
  parallelExecution: false,
  environment: 'production',
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

// Convert LEGITO_TESTS to TestCategory format, grouped by category
function buildCategories(): TestCategory[] {
  const categoryMap = new Map<string, TestCase[]>();

  LEGITO_TESTS.forEach((test) => {
    const existing = categoryMap.get(test.category) || [];
    existing.push({
      id: test.id,
      name: test.name,
      description: test.description,
      category: test.category,
      endpoint: test.endpoint,
      method: test.method,
      status: 'pending',
      assertions: test.assertions.length,
    });
    categoryMap.set(test.category, existing);
  });

  const categoryDescriptions: Record<string, string> = {
    'Smoke Tests': 'Basic health checks and connectivity tests',
    'Reference Data': 'Read-only reference data endpoints',
    'Templates': 'Template suite operations',
    'Users & Groups': 'User and group management',
    'Workflows': 'Workflow definitions and stages',
    'Documents': 'Document record operations',
    'Webhooks': 'Push connection/webhook operations',
  };

  return Array.from(categoryMap.entries()).map(([name, tests]) => ({
    id: name.toLowerCase().replace(/\s+/g, '-').replace(/&/g, 'and'),
    name,
    description: categoryDescriptions[name] || `${name} tests`,
    tests,
  }));
}

const legitoCategories = buildCategories();

export const useTestStore = create<TestStore>()(
  persist(
    (set, get) => ({
      // Initial State
      categories: legitoCategories,
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
      activePreset: null,
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

      setActivePreset: (preset) => set({ activePreset: preset }),
    }),
    {
      name: 'legito-api-test-dashboard',
      partialize: (state) => ({
        // Persist only activePreset (replaces old configuration)
        activePreset: state.activePreset,
        historicalData: state.historicalData,
      }),
    }
  )
);

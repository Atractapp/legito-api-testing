import { createClient } from '@supabase/supabase-js';
import type { TestRun, TestResult, TestConfiguration, HistoricalData, DashboardStats, TestPreset } from '@/types';

// These will be set via environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Create Supabase client
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// ============================================================================
// UTILITY FUNCTIONS: snake_case <-> camelCase transformations
// ============================================================================

function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function transformKeysToSnake<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    const snakeKey = toSnakeCase(key);
    const value = obj[key];
    if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      result[snakeKey] = transformKeysToSnake(value as Record<string, unknown>);
    } else {
      result[snakeKey] = value;
    }
  }
  return result;
}

function transformKeysToCamel<T>(obj: Record<string, unknown>): T {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    const camelKey = toCamelCase(key);
    const value = obj[key];
    if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      result[camelKey] = transformKeysToCamel(value as Record<string, unknown>);
    } else {
      result[camelKey] = value;
    }
  }
  return result as T;
}

// Database types for Supabase tables
export interface Database {
  public: {
    Tables: {
      test_runs: {
        Row: TestRun;
        Insert: Omit<TestRun, 'id'> & { id?: string };
        Update: Partial<TestRun>;
      };
      test_results: {
        Row: TestResult;
        Insert: Omit<TestResult, 'id'> & { id?: string };
        Update: Partial<TestResult>;
      };
      configurations: {
        Row: TestConfiguration;
        Insert: Omit<TestConfiguration, 'id'> & { id?: string };
        Update: Partial<TestConfiguration>;
      };
      historical_data: {
        Row: HistoricalData & { id: string };
        Insert: HistoricalData & { id?: string };
        Update: Partial<HistoricalData>;
      };
    };
  };
}

// Test Runs
export async function saveTestRun(run: TestRun): Promise<TestRun | null> {
  if (!supabase) {
    console.log('[Supabase] Client not initialized, skipping save');
    return null;
  }

  // Transform to snake_case for DB, exclude results array (stored separately)
  const { results, ...runWithoutResults } = run;
  const dbRun = transformKeysToSnake(runWithoutResults as unknown as Record<string, unknown>);

  const { data, error } = await supabase
    .from('test_runs')
    .upsert(dbRun)
    .select()
    .single();

  if (error) {
    console.error('Error saving test run:', error);
    return null;
  }

  console.log('[Supabase] Test run saved:', data?.id);
  return data ? transformKeysToCamel<TestRun>(data) : null;
}

export async function getTestRuns(limit = 50): Promise<TestRun[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('test_runs')
    .select('*')
    .order('start_time', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching test runs:', error);
    return [];
  }

  return (data || []).map(row => transformKeysToCamel<TestRun>(row));
}

export async function getTestRunById(id: string): Promise<TestRun | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('test_runs')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching test run:', error);
    return null;
  }

  return data ? transformKeysToCamel<TestRun>(data) : null;
}

// Test Results
export async function saveTestResult(result: TestResult, testRunId: string): Promise<TestResult | null> {
  if (!supabase) return null;

  const dbResult = {
    ...transformKeysToSnake(result as unknown as Record<string, unknown>),
    test_run_id: testRunId,
  };

  const { data, error } = await supabase
    .from('test_results')
    .insert(dbResult)
    .select()
    .single();

  if (error) {
    console.error('Error saving test result:', error);
    return null;
  }

  return data ? transformKeysToCamel<TestResult>(data) : null;
}

export async function saveTestResults(results: TestResult[], testRunId: string): Promise<boolean> {
  if (!supabase || results.length === 0) return false;

  const dbResults = results.map(result => ({
    ...transformKeysToSnake(result as unknown as Record<string, unknown>),
    test_run_id: testRunId,
  }));

  const { error } = await supabase
    .from('test_results')
    .insert(dbResults);

  if (error) {
    console.error('Error saving test results:', error);
    return false;
  }

  console.log(`[Supabase] Saved ${results.length} test results for run ${testRunId}`);
  return true;
}

export async function getTestResults(runId: string): Promise<TestResult[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('test_results')
    .select('*')
    .eq('test_run_id', runId)
    .order('timestamp', { ascending: true });

  if (error) {
    console.error('Error fetching test results:', error);
    return [];
  }

  return (data || []).map(row => transformKeysToCamel<TestResult>(row));
}

// Configurations
export async function saveConfiguration(config: TestConfiguration): Promise<TestConfiguration | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('configurations')
    .upsert(config)
    .select()
    .single();

  if (error) {
    console.error('Error saving configuration:', error);
    return null;
  }

  return data;
}

export async function getConfigurations(): Promise<TestConfiguration[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('configurations')
    .select('*')
    .order('updatedAt', { ascending: false });

  if (error) {
    console.error('Error fetching configurations:', error);
    return [];
  }

  return data || [];
}

export async function deleteConfiguration(id: string): Promise<boolean> {
  if (!supabase) return false;

  const { error } = await supabase
    .from('configurations')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting configuration:', error);
    return false;
  }

  return true;
}

// Historical Data
export async function saveHistoricalData(data: HistoricalData): Promise<boolean> {
  if (!supabase) return false;

  const { error } = await supabase
    .from('historical_data')
    .upsert({ ...data, id: data.date });

  if (error) {
    console.error('Error saving historical data:', error);
    return false;
  }

  return true;
}

export async function getHistoricalData(days = 30): Promise<HistoricalData[]> {
  if (!supabase) return [];

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data, error } = await supabase
    .from('historical_data')
    .select('*')
    .gte('date', startDate.toISOString().split('T')[0])
    .order('date', { ascending: true });

  if (error) {
    console.error('Error fetching historical data:', error);
    return [];
  }

  return data || [];
}

// Real-time subscriptions
export function subscribeToTestRun(
  runId: string,
  callback: (payload: TestResult) => void
) {
  if (!supabase) return null;

  const subscription = supabase
    .channel(`test_run_${runId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'test_results',
        filter: `test_run_id=eq.${runId}`,
      },
      (payload) => {
        callback(transformKeysToCamel<TestResult>(payload.new as Record<string, unknown>));
      }
    )
    .subscribe();

  return subscription;
}

export function unsubscribeFromTestRun(runId: string) {
  if (!supabase) return;
  supabase.removeChannel(supabase.channel(`test_run_${runId}`));
}

// ============================================================================
// STATISTICS CALCULATION
// ============================================================================

export async function calculateDashboardStats(): Promise<DashboardStats> {
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

  if (!supabase) return defaultStats;

  try {
    // Get today's date boundaries
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).toISOString();

    // Get all test runs for stats
    const { data: runs, error } = await supabase
      .from('test_runs')
      .select('*')
      .order('start_time', { ascending: false });

    if (error || !runs || runs.length === 0) {
      return defaultStats;
    }

    const totalTestRuns = runs.length;
    const totalTests = runs.reduce((sum, run) => sum + (run.total_tests || 0), 0);

    // Calculate average pass rate
    const passRates = runs.map(run => {
      const total = run.total_tests || 0;
      const passed = run.passed_tests || 0;
      return total > 0 ? (passed / total) * 100 : 0;
    });
    const avgPassRate = passRates.length > 0
      ? passRates.reduce((a, b) => a + b, 0) / passRates.length
      : 0;

    // Calculate average duration
    const durations = runs.filter(r => r.duration).map(r => r.duration);
    const avgDuration = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;

    // Last run time
    const lastRunTime = runs[0]?.start_time;

    // Today's runs
    const todayRuns = runs.filter(r => r.start_time >= todayStart).length;

    // Weekly runs
    const weeklyRuns = runs.filter(r => r.start_time >= weekStart).length;

    // Calculate trend (compare recent 7 days vs previous 7 days)
    const twoWeeksAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 14).toISOString();
    const recentRuns = runs.filter(r => r.start_time >= weekStart);
    const olderRuns = runs.filter(r => r.start_time >= twoWeeksAgo && r.start_time < weekStart);

    const recentAvg = recentRuns.length > 0
      ? recentRuns.reduce((sum, r) => sum + ((r.passed_tests || 0) / Math.max(r.total_tests || 1, 1)) * 100, 0) / recentRuns.length
      : 0;
    const olderAvg = olderRuns.length > 0
      ? olderRuns.reduce((sum, r) => sum + ((r.passed_tests || 0) / Math.max(r.total_tests || 1, 1)) * 100, 0) / olderRuns.length
      : 0;

    let recentTrend: 'up' | 'down' | 'stable' = 'stable';
    if (recentAvg > olderAvg + 5) recentTrend = 'up';
    else if (recentAvg < olderAvg - 5) recentTrend = 'down';

    return {
      totalTestRuns,
      totalTests,
      avgPassRate: Math.round(avgPassRate * 10) / 10,
      avgDuration: Math.round(avgDuration),
      lastRunTime,
      recentTrend,
      todayRuns,
      weeklyRuns,
    };
  } catch (error) {
    console.error('Error calculating dashboard stats:', error);
    return defaultStats;
  }
}

// Update historical data after a test run
export async function updateHistoricalDataFromRun(run: TestRun): Promise<boolean> {
  if (!supabase) return false;

  const date = new Date(run.startTime).toISOString().split('T')[0];
  const passRate = run.totalTests > 0
    ? Math.round((run.passedTests / run.totalTests) * 10000) / 100
    : 0;

  // Get existing data for this date
  const { data: existing } = await supabase
    .from('historical_data')
    .select('*')
    .eq('date', date)
    .single();

  if (existing) {
    // Update existing record - aggregate with new run
    const newTotal = existing.total_tests + run.totalTests;
    const newPassed = existing.passed + run.passedTests;
    const newFailed = existing.failed + run.failedTests;
    const newPassRate = newTotal > 0 ? Math.round((newPassed / newTotal) * 10000) / 100 : 0;
    const newAvgDuration = Math.round((existing.avg_duration + run.duration) / 2);

    const { error } = await supabase
      .from('historical_data')
      .update({
        total_tests: newTotal,
        passed: newPassed,
        failed: newFailed,
        pass_rate: newPassRate,
        avg_duration: newAvgDuration,
      })
      .eq('date', date);

    if (error) {
      console.error('Error updating historical data:', error);
      return false;
    }
  } else {
    // Insert new record
    const { error } = await supabase
      .from('historical_data')
      .insert({
        id: date,
        date,
        total_tests: run.totalTests,
        passed: run.passedTests,
        failed: run.failedTests,
        pass_rate: passRate,
        avg_duration: run.duration,
      });

    if (error) {
      console.error('Error inserting historical data:', error);
      return false;
    }
  }

  console.log(`[Supabase] Historical data updated for ${date}`);
  return true;
}

// Database initialization SQL (for reference)
export const initializationSQL = `
-- Test Runs table
CREATE TABLE IF NOT EXISTS test_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_time TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL CHECK (status IN ('running', 'completed', 'cancelled')),
  total_tests INTEGER NOT NULL DEFAULT 0,
  passed_tests INTEGER NOT NULL DEFAULT 0,
  failed_tests INTEGER NOT NULL DEFAULT 0,
  skipped_tests INTEGER NOT NULL DEFAULT 0,
  duration INTEGER,
  configuration JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Test Results table
CREATE TABLE IF NOT EXISTS test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_run_id UUID REFERENCES test_runs(id) ON DELETE CASCADE,
  test_id VARCHAR(100) NOT NULL,
  test_name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'running', 'passed', 'failed', 'skipped')),
  duration INTEGER NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  request JSONB NOT NULL,
  response JSONB NOT NULL,
  assertions JSONB NOT NULL,
  error JSONB,
  logs JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Configurations table
CREATE TABLE IF NOT EXISTS configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  base_url VARCHAR(500) NOT NULL,
  auth_type VARCHAR(20) NOT NULL CHECK (auth_type IN ('jwt', 'apiKey', 'none')),
  auth_token TEXT,
  api_key TEXT,
  template_ids TEXT[] DEFAULT '{}',
  document_ids TEXT[] DEFAULT '{}',
  timeout INTEGER NOT NULL DEFAULT 30000,
  retry_count INTEGER NOT NULL DEFAULT 0,
  parallel_execution BOOLEAN NOT NULL DEFAULT FALSE,
  environment VARCHAR(20) NOT NULL CHECK (environment IN ('development', 'staging', 'production')),
  headers JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Historical Data table
CREATE TABLE IF NOT EXISTS historical_data (
  id VARCHAR(20) PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  total_tests INTEGER NOT NULL,
  passed INTEGER NOT NULL,
  failed INTEGER NOT NULL,
  pass_rate DECIMAL(5,2) NOT NULL,
  avg_duration INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_test_results_run_id ON test_results(test_run_id);
CREATE INDEX IF NOT EXISTS idx_test_results_status ON test_results(status);
CREATE INDEX IF NOT EXISTS idx_test_runs_status ON test_runs(status);
CREATE INDEX IF NOT EXISTS idx_historical_data_date ON historical_data(date);

-- Enable Row Level Security
ALTER TABLE test_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE historical_data ENABLE ROW LEVEL SECURITY;

-- Policies (adjust based on your auth requirements)
CREATE POLICY "Allow all for authenticated users" ON test_runs FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated users" ON test_results FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated users" ON configurations FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated users" ON historical_data FOR ALL USING (true);
`;

// ============================================================================
// TEST PRESETS (Workspace-Specific Test Configurations)
// ============================================================================

export async function saveTestPreset(preset: Omit<TestPreset, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<TestPreset | null> {
  if (!supabase) {
    console.log('[Supabase] Client not initialized, skipping preset save');
    return null;
  }

  const now = new Date().toISOString();
  const dbPreset = {
    ...transformKeysToSnake(preset as unknown as Record<string, unknown>),
    updated_at: now,
    ...(preset.id ? {} : { created_at: now }),
  };

  const { data, error } = await supabase
    .from('test_presets')
    .upsert(dbPreset)
    .select()
    .single();

  if (error) {
    console.error('Error saving test preset:', error);
    return null;
  }

  console.log('[Supabase] Test preset saved:', data?.id);
  return data ? transformKeysToCamel<TestPreset>(data) : null;
}

export async function getTestPresets(): Promise<TestPreset[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('test_presets')
    .select('*')
    .order('is_default', { ascending: false })
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching test presets:', error);
    return [];
  }

  return (data || []).map(row => transformKeysToCamel<TestPreset>(row));
}

export async function getTestPresetById(id: string): Promise<TestPreset | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('test_presets')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching test preset:', error);
    return null;
  }

  return data ? transformKeysToCamel<TestPreset>(data) : null;
}

export async function getDefaultTestPreset(): Promise<TestPreset | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('test_presets')
    .select('*')
    .eq('is_default', true)
    .single();

  if (error) {
    // No default preset yet
    return null;
  }

  return data ? transformKeysToCamel<TestPreset>(data) : null;
}

export async function deleteTestPreset(id: string): Promise<boolean> {
  if (!supabase) return false;

  const { error } = await supabase
    .from('test_presets')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting test preset:', error);
    return false;
  }

  console.log('[Supabase] Test preset deleted:', id);
  return true;
}

export async function setDefaultPreset(id: string): Promise<boolean> {
  if (!supabase) return false;

  // First, unset all defaults
  const { error: unsetError } = await supabase
    .from('test_presets')
    .update({ is_default: false })
    .eq('is_default', true);

  if (unsetError) {
    console.error('Error unsetting default preset:', unsetError);
    return false;
  }

  // Then set the new default
  const { error: setError } = await supabase
    .from('test_presets')
    .update({ is_default: true })
    .eq('id', id);

  if (setError) {
    console.error('Error setting default preset:', setError);
    return false;
  }

  console.log('[Supabase] Default preset set:', id);
  return true;
}

// Ensure the default "Legito Default Test" preset exists with correct credentials
export async function ensureDefaultPreset(): Promise<TestPreset | null> {
  if (!supabase) return null;

  const DEFAULT_PRESET = {
    name: 'Legito Default Test',
    description: 'Default test preset for EMEA region with Testing API template',
    region: 'emea' as const,
    apiKey: 'c9494758-0f05-43b1-a24f-76be185b3fc3',
    privateKey: '349668dd-7a88-4a2a-befd-f6ffe7e98b64',
    baseUrl: 'https://api.legito.com/api/v7',
    timeout: 30000,
    retryCount: 0,
    parallelExecution: false,
    selectedTemplateIds: ['64004'],
    selectedObjectIds: ['935'],
    customTests: [],
    isDefault: true,
  };

  // Check if default preset exists
  const { data: existing } = await supabase
    .from('test_presets')
    .select('*')
    .eq('is_default', true)
    .single();

  if (existing) {
    // Update existing default preset with correct credentials
    const { data, error } = await supabase
      .from('test_presets')
      .update({
        api_key: DEFAULT_PRESET.apiKey,
        private_key: DEFAULT_PRESET.privateKey,
        base_url: DEFAULT_PRESET.baseUrl,
        selected_template_ids: DEFAULT_PRESET.selectedTemplateIds,
        selected_object_ids: DEFAULT_PRESET.selectedObjectIds,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating default preset:', error);
      return null;
    }

    console.log('[Supabase] Default preset updated with correct credentials');
    return transformKeysToCamel<TestPreset>(data);
  }

  // Create new default preset
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('test_presets')
    .insert({
      name: DEFAULT_PRESET.name,
      description: DEFAULT_PRESET.description,
      region: DEFAULT_PRESET.region,
      api_key: DEFAULT_PRESET.apiKey,
      private_key: DEFAULT_PRESET.privateKey,
      base_url: DEFAULT_PRESET.baseUrl,
      timeout: DEFAULT_PRESET.timeout,
      retry_count: DEFAULT_PRESET.retryCount,
      parallel_execution: DEFAULT_PRESET.parallelExecution,
      selected_template_ids: DEFAULT_PRESET.selectedTemplateIds,
      selected_object_ids: DEFAULT_PRESET.selectedObjectIds,
      custom_tests: DEFAULT_PRESET.customTests,
      is_default: DEFAULT_PRESET.isDefault,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating default preset:', error);
    return null;
  }

  console.log('[Supabase] Default preset created');
  return transformKeysToCamel<TestPreset>(data);
}

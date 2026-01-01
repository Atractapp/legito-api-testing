import { createClient } from '@supabase/supabase-js';
import type { TestRun, TestResult, TestConfiguration, HistoricalData } from '@/types';

// These will be set via environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Create Supabase client
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

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
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('test_runs')
    .upsert(run)
    .select()
    .single();

  if (error) {
    console.error('Error saving test run:', error);
    return null;
  }

  return data;
}

export async function getTestRuns(limit = 50): Promise<TestRun[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('test_runs')
    .select('*')
    .order('startTime', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching test runs:', error);
    return [];
  }

  return data || [];
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

  return data;
}

// Test Results
export async function saveTestResult(result: TestResult): Promise<TestResult | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('test_results')
    .insert(result)
    .select()
    .single();

  if (error) {
    console.error('Error saving test result:', error);
    return null;
  }

  return data;
}

export async function getTestResults(runId: string): Promise<TestResult[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('test_results')
    .select('*')
    .eq('testRunId', runId)
    .order('timestamp', { ascending: true });

  if (error) {
    console.error('Error fetching test results:', error);
    return [];
  }

  return data || [];
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
        filter: `testRunId=eq.${runId}`,
      },
      (payload) => {
        callback(payload.new as TestResult);
      }
    )
    .subscribe();

  return subscription;
}

export function unsubscribeFromTestRun(runId: string) {
  if (!supabase) return;
  supabase.removeChannel(supabase.channel(`test_run_${runId}`));
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

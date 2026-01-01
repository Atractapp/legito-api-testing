-- ============================================================================
-- API Testing Platform - Supabase Database Schema
-- ============================================================================

-- ============================================================================
-- 1. AUTHENTICATION & USER CONTEXT
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT auth.uid(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$')
);

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT slug_format CHECK (slug ~ '^[a-z0-9-]+$')
);

CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

-- ============================================================================
-- 2. TEST PROJECT STRUCTURE
-- ============================================================================

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  base_url TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'inactive')),
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS test_suites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  order_index INTEGER DEFAULT 0,
  enabled BOOLEAN DEFAULT TRUE,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(project_id, name)
);

-- ============================================================================
-- 3. TEST CONFIGURATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS api_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS')),
  description TEXT,
  tags TEXT[] DEFAULT '{}',
  documentation_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(project_id, path, method)
);

CREATE TABLE IF NOT EXISTS test_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suite_id UUID NOT NULL REFERENCES test_suites(id) ON DELETE CASCADE,
  endpoint_id UUID NOT NULL REFERENCES api_endpoints(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  order_index INTEGER DEFAULT 0,
  enabled BOOLEAN DEFAULT TRUE,
  timeout_ms INTEGER DEFAULT 30000 CHECK (timeout_ms > 0),
  retry_count INTEGER DEFAULT 0 CHECK (retry_count >= 0),
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(suite_id, name)
);

CREATE TABLE IF NOT EXISTS test_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dependent_test_id UUID NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
  required_test_id UUID NOT NULL REFERENCES test_cases(id) ON DELETE RESTRICT,
  dependency_type TEXT DEFAULT 'order' CHECK (dependency_type IN ('order', 'data', 'token')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(dependent_test_id, required_test_id),
  CONSTRAINT prevent_circular_dependency CHECK (dependent_test_id != required_test_id)
);

-- ============================================================================
-- 4. TEST REQUEST/RESPONSE DEFINITIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS test_request_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_case_id UUID NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE UNIQUE,
  headers JSONB DEFAULT '{}',
  query_params JSONB DEFAULT '{}',
  body JSONB,
  body_type TEXT CHECK (body_type IN ('json', 'form-data', 'x-www-form-urlencoded', 'text', 'xml')),
  auth_type TEXT CHECK (auth_type IN ('none', 'bearer', 'basic', 'api-key', 'oauth2')),
  auth_token_ref TEXT,
  variables_used TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS test_response_specs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_case_id UUID NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE UNIQUE,
  expected_status_code INTEGER NOT NULL CHECK (expected_status_code >= 100 AND expected_status_code < 600),
  expected_headers JSONB DEFAULT '{}',
  expected_body JSONB,
  body_match_type TEXT DEFAULT 'exact' CHECK (body_match_type IN ('exact', 'schema', 'partial', 'contains')),
  response_time_max_ms INTEGER,
  capture_vars JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 5. TEST DATA FIXTURES
-- ============================================================================

CREATE TABLE IF NOT EXISTS test_data_fixtures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  fixture_type TEXT NOT NULL CHECK (fixture_type IN ('user', 'document', 'organization', 'custom')),
  data JSONB NOT NULL,
  tags TEXT[] DEFAULT '{}',
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(project_id, name)
);

CREATE TABLE IF NOT EXISTS fixture_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id UUID NOT NULL REFERENCES test_data_fixtures(id) ON DELETE CASCADE,
  test_case_id UUID NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(fixture_id, test_case_id)
);

-- ============================================================================
-- 6. ENVIRONMENT CONFIGURATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS environments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  base_url TEXT NOT NULL,
  order_index INTEGER DEFAULT 0,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(project_id, name)
);

CREATE TABLE IF NOT EXISTS environment_variables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment_id UUID NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  is_secret BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(environment_id, key)
);

-- ============================================================================
-- 7. USER CREDENTIALS MANAGEMENT
-- ============================================================================

CREATE TABLE IF NOT EXISTS api_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  credential_name TEXT NOT NULL,
  credential_type TEXT NOT NULL CHECK (credential_type IN ('api-key', 'bearer-token', 'basic-auth', 'oauth2')),
  key_id TEXT,
  key_secret TEXT, -- Encrypted in production
  token TEXT, -- Encrypted in production
  token_expires_at TIMESTAMP WITH TIME ZONE,
  oauth_refresh_token TEXT, -- Encrypted in production
  oauth_scope TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organization_id, credential_name)
);

-- ============================================================================
-- 8. TEST EXECUTION CONTEXT
-- ============================================================================

CREATE TABLE IF NOT EXISTS test_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  suite_id UUID REFERENCES test_suites(id) ON DELETE SET NULL,
  environment_id UUID NOT NULL REFERENCES environments(id) ON DELETE RESTRICT,
  started_by UUID NOT NULL REFERENCES users(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  total_tests INTEGER DEFAULT 0,
  passed_tests INTEGER DEFAULT 0,
  failed_tests INTEGER DEFAULT 0,
  skipped_tests INTEGER DEFAULT 0,
  total_duration_ms INTEGER DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS test_execution_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE UNIQUE,
  shared_auth_tokens JSONB DEFAULT '{}',
  shared_variables JSONB DEFAULT '{}',
  captured_data JSONB DEFAULT '{}',
  test_order TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 9. TEST EXECUTION RESULTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
  test_case_id UUID NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('passed', 'failed', 'skipped', 'error')),
  exit_code INTEGER,
  error_message TEXT,
  error_stack TEXT,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_ms INTEGER,
  attempt_number INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_attempt CHECK (attempt_number > 0)
);

CREATE TABLE IF NOT EXISTS test_result_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  result_id UUID NOT NULL REFERENCES test_results(id) ON DELETE CASCADE UNIQUE,
  request_headers JSONB,
  request_body JSONB,
  request_query_params JSONB,
  response_status_code INTEGER,
  response_headers JSONB,
  response_body JSONB,
  response_time_ms INTEGER,
  assertions_passed INTEGER DEFAULT 0,
  assertions_failed INTEGER DEFAULT 0,
  captured_variables JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS assertion_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  result_id UUID NOT NULL REFERENCES test_results(id) ON DELETE CASCADE,
  assertion_name TEXT NOT NULL,
  assertion_type TEXT NOT NULL CHECK (assertion_type IN ('status-code', 'header', 'body', 'schema', 'response-time', 'custom')),
  expected_value JSONB,
  actual_value JSONB,
  passed BOOLEAN NOT NULL,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 10. PERFORMANCE METRICS & HISTORY
-- ============================================================================

CREATE TABLE IF NOT EXISTS performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  test_case_id UUID NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
  environment_id UUID NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_runs INTEGER DEFAULT 0,
  successful_runs INTEGER DEFAULT 0,
  failed_runs INTEGER DEFAULT 0,
  average_response_time_ms NUMERIC(10, 2),
  p95_response_time_ms NUMERIC(10, 2),
  p99_response_time_ms NUMERIC(10, 2),
  min_response_time_ms INTEGER,
  max_response_time_ms INTEGER,
  success_rate NUMERIC(5, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(test_case_id, environment_id, date)
);

CREATE TABLE IF NOT EXISTS test_run_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_case_id UUID NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
  environment_id UUID NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('passed', 'failed', 'skipped', 'error')),
  duration_ms INTEGER,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 11. FAILURE ANALYSIS
-- ============================================================================

CREATE TABLE IF NOT EXISTS failure_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  result_id UUID NOT NULL REFERENCES test_results(id) ON DELETE CASCADE UNIQUE,
  failure_category TEXT CHECK (failure_category IN ('assertion', 'timeout', 'connection', 'authentication', 'data-validation', 'environment', 'other')),
  root_cause_analysis TEXT,
  suggested_fix TEXT,
  is_flaky BOOLEAN DEFAULT FALSE,
  flakiness_score NUMERIC(3, 2),
  first_failure_at TIMESTAMP WITH TIME ZONE,
  last_failure_at TIMESTAMP WITH TIME ZONE,
  failure_count INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 12. REPORTS & PREFERENCES
-- ============================================================================

CREATE TABLE IF NOT EXISTS report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  includes_performance BOOLEAN DEFAULT TRUE,
  includes_failures BOOLEAN DEFAULT TRUE,
  includes_flaky_tests BOOLEAN DEFAULT TRUE,
  includes_trends BOOLEAN DEFAULT TRUE,
  date_range_days INTEGER DEFAULT 7,
  environments TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organization_id, name)
);

CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email_on_failure BOOLEAN DEFAULT TRUE,
  email_on_suite_completion BOOLEAN DEFAULT FALSE,
  email_frequency TEXT DEFAULT 'immediate' CHECK (email_frequency IN ('immediate', 'daily', 'weekly')),
  theme TEXT DEFAULT 'light' CHECK (theme IN ('light', 'dark')),
  default_environment TEXT,
  timezone TEXT DEFAULT 'UTC',
  notification_channels TEXT[] DEFAULT '{email}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  filters JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE OPTIMIZATION
-- ============================================================================

-- User & Organization Indexes
CREATE INDEX idx_organizations_user_id ON organizations(user_id);
CREATE INDEX idx_organization_members_user_id ON organization_members(user_id);
CREATE INDEX idx_organization_members_organization_id ON organization_members(organization_id);

-- Project Indexes
CREATE INDEX idx_projects_organization_id ON projects(organization_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_created_by ON projects(created_by);

-- Test Suite & Case Indexes
CREATE INDEX idx_test_suites_project_id ON test_suites(project_id);
CREATE INDEX idx_test_suites_enabled ON test_suites(enabled);
CREATE INDEX idx_test_cases_suite_id ON test_cases(suite_id);
CREATE INDEX idx_test_cases_endpoint_id ON test_cases(endpoint_id);
CREATE INDEX idx_test_cases_enabled ON test_cases(enabled);
CREATE INDEX idx_test_dependencies_required_test_id ON test_dependencies(required_test_id);

-- API Endpoint Indexes
CREATE INDEX idx_api_endpoints_project_id ON api_endpoints(project_id);
CREATE INDEX idx_api_endpoints_method ON api_endpoints(method);
CREATE INDEX idx_api_endpoints_tags ON api_endpoints USING GIN(tags);

-- Fixture Indexes
CREATE INDEX idx_test_data_fixtures_project_id ON test_data_fixtures(project_id);
CREATE INDEX idx_test_data_fixtures_tags ON test_data_fixtures USING GIN(tags);
CREATE INDEX idx_fixture_usage_fixture_id ON fixture_usage(fixture_id);
CREATE INDEX idx_fixture_usage_test_case_id ON fixture_usage(test_case_id);

-- Environment Indexes
CREATE INDEX idx_environments_project_id ON environments(project_id);
CREATE INDEX idx_environment_variables_environment_id ON environment_variables(environment_id);

-- Credentials Indexes
CREATE INDEX idx_api_credentials_user_id ON api_credentials(user_id);
CREATE INDEX idx_api_credentials_organization_id ON api_credentials(organization_id);
CREATE INDEX idx_api_credentials_credential_type ON api_credentials(credential_type);

-- Test Execution Indexes
CREATE INDEX idx_test_runs_project_id ON test_runs(project_id);
CREATE INDEX idx_test_runs_suite_id ON test_runs(suite_id);
CREATE INDEX idx_test_runs_environment_id ON test_runs(environment_id);
CREATE INDEX idx_test_runs_status ON test_runs(status);
CREATE INDEX idx_test_runs_started_by ON test_runs(started_by);
CREATE INDEX idx_test_runs_created_at ON test_runs(created_at DESC);
CREATE INDEX idx_test_execution_context_run_id ON test_execution_context(run_id);

-- Test Results Indexes
CREATE INDEX idx_test_results_run_id ON test_results(run_id);
CREATE INDEX idx_test_results_test_case_id ON test_results(test_case_id);
CREATE INDEX idx_test_results_status ON test_results(status);
CREATE INDEX idx_test_results_created_at ON test_results(created_at DESC);
CREATE INDEX idx_test_result_details_result_id ON test_result_details(result_id);
CREATE INDEX idx_assertion_results_result_id ON assertion_results(result_id);

-- Performance Metrics Indexes
CREATE INDEX idx_performance_metrics_test_case_id ON performance_metrics(test_case_id);
CREATE INDEX idx_performance_metrics_environment_id ON performance_metrics(environment_id);
CREATE INDEX idx_performance_metrics_date ON performance_metrics(date DESC);
CREATE INDEX idx_test_run_history_test_case_id ON test_run_history(test_case_id);
CREATE INDEX idx_test_run_history_environment_id ON test_run_history(environment_id);
CREATE INDEX idx_test_run_history_recorded_at ON test_run_history(recorded_at DESC);

-- Failure Analysis Indexes
CREATE INDEX idx_failure_analysis_result_id ON failure_analysis(result_id);
CREATE INDEX idx_failure_analysis_category ON failure_analysis(failure_category);
CREATE INDEX idx_failure_analysis_is_flaky ON failure_analysis(is_flaky);

-- User Preferences Indexes
CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id);
CREATE INDEX idx_report_templates_user_id ON report_templates(user_id);
CREATE INDEX idx_report_templates_organization_id ON report_templates(organization_id);
CREATE INDEX idx_saved_searches_user_id ON saved_searches(user_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_suites ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_request_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_response_specs ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_data_fixtures ENABLE ROW LEVEL SECURITY;
ALTER TABLE fixture_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE environments ENABLE ROW LEVEL SECURITY;
ALTER TABLE environment_variables ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_execution_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_result_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE assertion_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_run_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE failure_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICY: Users can only see their own user record
-- ============================================================================

CREATE POLICY users_own_record ON users
  FOR ALL USING (auth.uid() = id);

-- ============================================================================
-- RLS POLICIES: Organization Access
-- ============================================================================

CREATE POLICY organizations_member_access ON organizations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organizations.id
      AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY organization_members_access ON organization_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organization_members.organization_id
      AND om.user_id = auth.uid()
    )
  );

-- ============================================================================
-- RLS POLICIES: Project Access (inherited from organization)
-- ============================================================================

CREATE POLICY projects_org_access ON projects
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = projects.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY projects_creator_write ON projects
  FOR ALL USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- ============================================================================
-- RLS POLICIES: Test Suites & Cases Access
-- ============================================================================

CREATE POLICY test_suites_org_access ON test_suites
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM projects p
      JOIN organization_members om ON om.organization_id = p.organization_id
      WHERE p.id = test_suites.project_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY test_cases_org_access ON test_cases
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM test_suites ts
      JOIN projects p ON p.id = ts.project_id
      JOIN organization_members om ON om.organization_id = p.organization_id
      WHERE ts.id = test_cases.suite_id
      AND om.user_id = auth.uid()
    )
  );

-- ============================================================================
-- RLS POLICIES: API Credentials (user-specific)
-- ============================================================================

CREATE POLICY api_credentials_user_access ON api_credentials
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY api_credentials_user_write ON api_credentials
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- RLS POLICIES: Test Runs & Results
-- ============================================================================

CREATE POLICY test_runs_org_access ON test_runs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM projects p
      JOIN organization_members om ON om.organization_id = p.organization_id
      WHERE p.id = test_runs.project_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY test_results_org_access ON test_results
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM test_runs tr
      JOIN projects p ON p.id = tr.project_id
      JOIN organization_members om ON om.organization_id = p.organization_id
      WHERE tr.id = test_results.run_id
      AND om.user_id = auth.uid()
    )
  );

-- ============================================================================
-- RLS POLICIES: User Preferences
-- ============================================================================

CREATE POLICY user_preferences_own ON user_preferences
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY saved_searches_own ON saved_searches
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- FUNCTIONS FOR CONTEXT MANAGEMENT
-- ============================================================================

-- Function to get current test run context
CREATE OR REPLACE FUNCTION get_test_run_context(run_id UUID)
RETURNS TABLE (
  run_id UUID,
  shared_auth_tokens JSONB,
  shared_variables JSONB,
  captured_data JSONB,
  test_order TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    test_execution_context.run_id,
    test_execution_context.shared_auth_tokens,
    test_execution_context.shared_variables,
    test_execution_context.captured_data,
    test_execution_context.test_order
  FROM test_execution_context
  WHERE test_execution_context.run_id = get_test_run_context.run_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update test run context
CREATE OR REPLACE FUNCTION update_test_run_context(
  run_id UUID,
  new_tokens JSONB,
  new_variables JSONB,
  new_captured_data JSONB
)
RETURNS test_execution_context AS $$
BEGIN
  RETURN (
    UPDATE test_execution_context
    SET
      shared_auth_tokens = COALESCE(new_tokens, shared_auth_tokens),
      shared_variables = COALESCE(new_variables, shared_variables),
      captured_data = COALESCE(new_captured_data, captured_data),
      updated_at = NOW()
    WHERE test_execution_context.run_id = update_test_run_context.run_id
    RETURNING *
  );
END;
$$ LANGUAGE plpgsql;

-- Function to aggregate test metrics for a given period
CREATE OR REPLACE FUNCTION aggregate_test_metrics(
  test_case_id UUID,
  env_id UUID,
  start_date DATE,
  end_date DATE
)
RETURNS TABLE (
  date DATE,
  total_runs INTEGER,
  successful_runs INTEGER,
  failed_runs INTEGER,
  success_rate NUMERIC,
  avg_response_time NUMERIC,
  p95_response_time NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    trh.recorded_at::DATE,
    COUNT(*)::INTEGER,
    COUNT(*) FILTER (WHERE trh.status = 'passed')::INTEGER,
    COUNT(*) FILTER (WHERE trh.status = 'failed')::INTEGER,
    ROUND(COUNT(*) FILTER (WHERE trh.status = 'passed')::NUMERIC / COUNT(*)::NUMERIC * 100, 2),
    ROUND(AVG(trh.duration_ms)::NUMERIC, 2),
    ROUND((PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY trh.duration_ms))::NUMERIC, 2)
  FROM test_run_history trh
  WHERE trh.test_case_id = aggregate_test_metrics.test_case_id
    AND trh.environment_id = aggregate_test_metrics.env_id
    AND trh.recorded_at::DATE BETWEEN aggregate_test_metrics.start_date AND aggregate_test_metrics.end_date
  GROUP BY trh.recorded_at::DATE
  ORDER BY trh.recorded_at::DATE DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to detect flaky tests
CREATE OR REPLACE FUNCTION detect_flaky_tests(
  org_id UUID,
  min_failure_count INTEGER DEFAULT 3
)
RETURNS TABLE (
  test_case_id UUID,
  test_name TEXT,
  failure_count INTEGER,
  total_runs INTEGER,
  flakiness_score NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH test_stats AS (
    SELECT
      tc.id,
      tc.name,
      COUNT(CASE WHEN tr.status = 'failed' THEN 1 END) as failures,
      COUNT(*) as total
    FROM test_cases tc
    JOIN test_results tr ON tr.test_case_id = tc.id
    JOIN test_runs t_run ON t_run.id = tr.run_id
    JOIN test_suites ts ON ts.id = tc.suite_id
    JOIN projects p ON p.id = ts.project_id
    WHERE p.organization_id = org_id
    GROUP BY tc.id, tc.name
    HAVING COUNT(CASE WHEN tr.status = 'failed' THEN 1 END) >= detect_flaky_tests.min_failure_count
  )
  SELECT
    test_stats.id,
    test_stats.name,
    test_stats.failures,
    test_stats.total,
    ROUND((test_stats.failures::NUMERIC / test_stats.total::NUMERIC), 2)
  FROM test_stats
  ORDER BY (test_stats.failures::NUMERIC / test_stats.total::NUMERIC) DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get test execution chain for dependent tests
CREATE OR REPLACE FUNCTION get_test_execution_chain(test_id UUID)
RETURNS TABLE (
  test_order INTEGER,
  test_id UUID,
  test_name TEXT,
  dependency_type TEXT,
  status TEXT
) AS $$
WITH RECURSIVE test_chain AS (
  SELECT
    1 as test_order,
    td.required_test_id,
    tc.name,
    td.dependency_type,
    'pending'::TEXT as status
  FROM test_dependencies td
  JOIN test_cases tc ON tc.id = td.required_test_id
  WHERE td.dependent_test_id = get_test_execution_chain.test_id

  UNION ALL

  SELECT
    tc.test_order + 1,
    td.required_test_id,
    tc2.name,
    td.dependency_type,
    'pending'::TEXT
  FROM test_chain tc
  JOIN test_dependencies td ON td.dependent_test_id = tc.test_id
  JOIN test_cases tc2 ON tc2.id = td.required_test_id
  WHERE tc.test_order < 10 -- Prevent infinite recursion
)
SELECT * FROM test_chain
ORDER BY test_order;
$$ LANGUAGE SQL;

-- ============================================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- ============================================================================

-- Trigger to update performance metrics when test results are added
CREATE OR REPLACE FUNCTION update_performance_metrics()
RETURNS TRIGGER AS $$
BEGIN
  WITH metric_data AS (
    SELECT
      tr.test_case_id,
      env.id as env_id,
      NOW()::DATE as metric_date,
      COUNT(*) as total_runs,
      COUNT(CASE WHEN tr.status = 'passed' THEN 1 END) as successful,
      COUNT(CASE WHEN tr.status = 'failed' THEN 1 END) as failed,
      AVG(trd.response_time_ms) as avg_time,
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY trd.response_time_ms) as p95_time,
      PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY trd.response_time_ms) as p99_time,
      MIN(trd.response_time_ms) as min_time,
      MAX(trd.response_time_ms) as max_time
    FROM test_results tr
    JOIN test_runs t_run ON t_run.id = tr.run_id
    JOIN environments env ON env.id = t_run.environment_id
    LEFT JOIN test_result_details trd ON trd.result_id = tr.id
    WHERE tr.id = NEW.id
    GROUP BY tr.test_case_id, env.id
  )
  INSERT INTO performance_metrics (
    project_id, test_case_id, environment_id, date,
    total_runs, successful_runs, failed_runs,
    average_response_time_ms, p95_response_time_ms, p99_response_time_ms,
    min_response_time_ms, max_response_time_ms, success_rate
  )
  SELECT
    tc.project_id,
    md.test_case_id,
    md.env_id,
    md.metric_date,
    md.total_runs,
    md.successful,
    md.failed,
    md.avg_time,
    md.p95_time,
    md.p99_time,
    md.min_time,
    md.max_time,
    ROUND((md.successful::NUMERIC / md.total_runs::NUMERIC) * 100, 2)
  FROM metric_data md
  JOIN test_cases tc ON tc.id = md.test_case_id
  ON CONFLICT (test_case_id, environment_id, date)
  DO UPDATE SET
    total_runs = performance_metrics.total_runs + EXCLUDED.total_runs,
    successful_runs = performance_metrics.successful_runs + EXCLUDED.successful_runs,
    failed_runs = performance_metrics.failed_runs + EXCLUDED.failed_runs,
    average_response_time_ms = EXCLUDED.average_response_time_ms,
    p95_response_time_ms = EXCLUDED.p95_response_time_ms,
    p99_response_time_ms = EXCLUDED.p99_response_time_ms,
    success_rate = EXCLUDED.success_rate,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_performance_metrics
AFTER INSERT ON test_results
FOR EACH ROW
EXECUTE FUNCTION update_performance_metrics();

-- Trigger to update test_run stats
CREATE OR REPLACE FUNCTION update_test_run_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE test_runs
  SET
    passed_tests = (SELECT COUNT(*) FROM test_results WHERE run_id = NEW.run_id AND status = 'passed'),
    failed_tests = (SELECT COUNT(*) FROM test_results WHERE run_id = NEW.run_id AND status = 'failed'),
    skipped_tests = (SELECT COUNT(*) FROM test_results WHERE run_id = NEW.run_id AND status = 'skipped'),
    total_duration_ms = (SELECT COALESCE(SUM(duration_ms), 0) FROM test_results WHERE run_id = NEW.run_id)
  WHERE id = NEW.run_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_test_run_stats
AFTER INSERT OR UPDATE ON test_results
FOR EACH ROW
EXECUTE FUNCTION update_test_run_stats();

-- Trigger to track test run history
CREATE OR REPLACE FUNCTION track_test_run_history()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO test_run_history (test_case_id, environment_id, status, duration_ms)
  SELECT
    NEW.test_case_id,
    t_run.environment_id,
    NEW.status,
    NEW.duration_ms
  FROM test_runs t_run
  WHERE t_run.id = NEW.run_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_track_test_run_history
AFTER INSERT ON test_results
FOR EACH ROW
EXECUTE FUNCTION track_test_run_history();

-- ============================================================================
-- DATA RETENTION & CLEANUP POLICIES
-- ============================================================================

-- Function to archive old test results (older than 90 days)
CREATE OR REPLACE FUNCTION archive_old_test_results()
RETURNS INTEGER AS $$
DECLARE
  archived_count INTEGER;
BEGIN
  WITH to_delete AS (
    DELETE FROM test_results
    WHERE created_at < NOW() - INTERVAL '90 days'
    AND status IN ('passed', 'skipped')
    RETURNING id
  )
  SELECT COUNT(*) INTO archived_count FROM to_delete;

  RETURN archived_count;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup failed runs older than 180 days
CREATE OR REPLACE FUNCTION cleanup_old_failed_runs()
RETURNS INTEGER AS $$
DECLARE
  cleanup_count INTEGER;
BEGIN
  WITH to_delete AS (
    DELETE FROM test_runs
    WHERE created_at < NOW() - INTERVAL '180 days'
    AND (status = 'failed' OR status = 'cancelled')
    RETURNING id
  )
  SELECT COUNT(*) INTO cleanup_count FROM to_delete;

  RETURN cleanup_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE test_execution_context IS 'Manages shared state during test execution including auth tokens, variables, and captured data from previous tests';

COMMENT ON TABLE test_dependencies IS 'Tracks dependencies between tests for proper execution ordering and data flow';

COMMENT ON FUNCTION get_test_run_context(UUID) IS 'Retrieves the complete execution context for a test run including shared tokens and variables';

COMMENT ON FUNCTION aggregate_test_metrics(UUID, UUID, DATE, DATE) IS 'Aggregates test execution metrics over a date range for performance analysis';

COMMENT ON FUNCTION detect_flaky_tests(UUID, INTEGER) IS 'Identifies tests with high failure variability for investigation';

COMMENT ON FUNCTION get_test_execution_chain(UUID) IS 'Returns the complete dependency chain for a test to ensure proper execution order';

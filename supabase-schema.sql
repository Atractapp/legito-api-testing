-- API Testing Platform - Supabase Database Schema
-- This schema defines the complete data model for the API testing platform

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "http";

-- =====================================================
-- Users and Teams
-- =====================================================

CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  workspace_slug TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(team_id, user_id)
);

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  notification_email TEXT,
  preferences JSONB DEFAULT '{"theme": "light", "notifications": true}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =====================================================
-- API Test Configurations
-- =====================================================

CREATE TABLE IF NOT EXISTS api_test_suites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  base_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  tags TEXT[] DEFAULT ARRAY[]::text[],
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(team_id, name)
);

CREATE TABLE IF NOT EXISTS api_tests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  suite_id UUID NOT NULL REFERENCES api_test_suites(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  method TEXT NOT NULL CHECK (method IN ('GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS')),
  endpoint TEXT NOT NULL,
  headers JSONB DEFAULT '{}'::jsonb,
  query_params JSONB DEFAULT '{}'::jsonb,
  request_body JSONB,
  expected_status_code INT,
  expected_response_schema JSONB,
  timeout_ms INT DEFAULT 30000,
  retry_count INT DEFAULT 0,
  retry_delay_ms INT DEFAULT 1000,
  enabled BOOLEAN DEFAULT true,
  tags TEXT[] DEFAULT ARRAY[]::text[],
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(suite_id, name)
);

CREATE TABLE IF NOT EXISTS test_variables (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  suite_id UUID NOT NULL REFERENCES api_test_suites(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  value TEXT NOT NULL,
  is_secret BOOLEAN DEFAULT false,
  scope TEXT NOT NULL DEFAULT 'suite' CHECK (scope IN ('suite', 'global')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(suite_id, name)
);

-- =====================================================
-- Test Execution and Results
-- =====================================================

CREATE TABLE IF NOT EXISTS test_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  suite_id UUID NOT NULL REFERENCES api_test_suites(id) ON DELETE CASCADE,
  triggered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  trigger_source TEXT NOT NULL CHECK (trigger_source IN ('manual', 'scheduled', 'webhook', 'deployment', 'api')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  total_tests INT DEFAULT 0,
  passed_tests INT DEFAULT 0,
  failed_tests INT DEFAULT 0,
  skipped_tests INT DEFAULT 0,
  duration_ms INT,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  environment TEXT NOT NULL DEFAULT 'production' CHECK (environment IN ('development', 'staging', 'production')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS test_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  test_run_id UUID NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
  test_id UUID NOT NULL REFERENCES api_tests(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('passed', 'failed', 'skipped', 'error')),
  duration_ms INT,
  request_headers JSONB,
  request_body JSONB,
  response_status INT,
  response_headers JSONB,
  response_body JSONB,
  response_time_ms INT,
  assertions_results JSONB,
  error_message TEXT,
  error_stack_trace TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  attempt_number INT DEFAULT 1,
  retry_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =====================================================
-- Scheduled Test Runs
-- =====================================================

CREATE TABLE IF NOT EXISTS scheduled_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  suite_id UUID NOT NULL REFERENCES api_test_suites(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  cron_expression TEXT NOT NULL,
  timezone TEXT DEFAULT 'UTC',
  enabled BOOLEAN DEFAULT true,
  notify_on_failure BOOLEAN DEFAULT true,
  notify_on_success BOOLEAN DEFAULT false,
  environment TEXT NOT NULL DEFAULT 'production',
  last_run_id UUID REFERENCES test_runs(id) ON DELETE SET NULL,
  last_run_at TIMESTAMP WITH TIME ZONE,
  last_run_status TEXT,
  next_run_at TIMESTAMP WITH TIME ZONE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =====================================================
-- Webhooks
-- =====================================================

CREATE TABLE IF NOT EXISTS webhooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  suite_id UUID NOT NULL REFERENCES api_test_suites(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  events TEXT[] DEFAULT ARRAY['test_run_completed']::text[],
  active BOOLEAN DEFAULT true,
  headers JSONB DEFAULT '{}'::jsonb,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  payload JSONB NOT NULL,
  status_code INT,
  response JSONB,
  error_message TEXT,
  attempt_count INT DEFAULT 1,
  next_retry_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =====================================================
-- Notifications and Alerts
-- =====================================================

CREATE TABLE IF NOT EXISTS notification_channels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('slack', 'email', 'webhook', 'pagerduty')),
  name TEXT NOT NULL,
  configuration JSONB NOT NULL,
  enabled BOOLEAN DEFAULT true,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS alert_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  suite_id UUID REFERENCES api_test_suites(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  condition TEXT NOT NULL,
  threshold FLOAT,
  notification_channel_id UUID REFERENCES notification_channels(id) ON DELETE SET NULL,
  enabled BOOLEAN DEFAULT true,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =====================================================
-- Audit and Logging
-- =====================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  changes JSONB,
  ip_address INET,
  user_agent TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =====================================================
-- Indexes
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_api_test_suites_team_id ON api_test_suites(team_id);
CREATE INDEX IF NOT EXISTS idx_api_test_suites_created_at ON api_test_suites(created_at);
CREATE INDEX IF NOT EXISTS idx_api_tests_suite_id ON api_tests(suite_id);
CREATE INDEX IF NOT EXISTS idx_api_tests_enabled ON api_tests(enabled);
CREATE INDEX IF NOT EXISTS idx_test_runs_suite_id ON test_runs(suite_id);
CREATE INDEX IF NOT EXISTS idx_test_runs_created_at ON test_runs(created_at);
CREATE INDEX IF NOT EXISTS idx_test_runs_status ON test_runs(status);
CREATE INDEX IF NOT EXISTS idx_test_results_test_run_id ON test_results(test_run_id);
CREATE INDEX IF NOT EXISTS idx_test_results_status ON test_results(status);
CREATE INDEX IF NOT EXISTS idx_test_results_created_at ON test_results(created_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_runs_suite_id ON scheduled_runs(suite_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_runs_enabled ON scheduled_runs(enabled);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_id ON webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_notification_channels_team_id ON notification_channels(team_id);
CREATE INDEX IF NOT EXISTS idx_alert_rules_suite_id ON alert_rules(suite_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);

-- =====================================================
-- Row Level Security (RLS) Policies
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_test_suites ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_variables ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Teams RLS
CREATE POLICY "Users can view teams they belong to"
  ON teams FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = teams.id
      AND team_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Team owners can update their team"
  ON teams FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = teams.id
      AND team_members.user_id = auth.uid()
      AND team_members.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Team owners can delete their team"
  ON teams FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = teams.id
      AND team_members.user_id = auth.uid()
      AND team_members.role = 'owner'
    )
  );

-- Team members RLS
CREATE POLICY "Users can view team members of their teams"
  ON team_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = team_members.team_id
      AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Team admins can manage members"
  ON team_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = team_members.team_id
      AND tm.user_id = auth.uid()
      AND tm.role IN ('owner', 'admin')
    )
  );

-- API Test Suites RLS
CREATE POLICY "Users can view suites in their teams"
  ON api_test_suites FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = api_test_suites.team_id
      AND team_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Team members can create test suites"
  ON api_test_suites FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = api_test_suites.team_id
      AND team_members.user_id = auth.uid()
      AND team_members.role IN ('owner', 'admin', 'member')
    )
  );

CREATE POLICY "Users can update suites they have access to"
  ON api_test_suites FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = api_test_suites.team_id
      AND team_members.user_id = auth.uid()
      AND team_members.role IN ('owner', 'admin', 'member')
    )
  );

-- API Tests RLS
CREATE POLICY "Users can view tests in their accessible suites"
  ON api_tests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM api_test_suites, team_members
      WHERE api_test_suites.id = api_tests.suite_id
      AND team_members.team_id = api_test_suites.team_id
      AND team_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Team members can create tests in accessible suites"
  ON api_tests FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM api_test_suites, team_members
      WHERE api_test_suites.id = api_tests.suite_id
      AND team_members.team_id = api_test_suites.team_id
      AND team_members.user_id = auth.uid()
      AND team_members.role IN ('owner', 'admin', 'member')
    )
  );

-- Test Runs RLS
CREATE POLICY "Users can view test runs in accessible suites"
  ON test_runs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM api_test_suites, team_members
      WHERE api_test_suites.id = test_runs.suite_id
      AND team_members.team_id = api_test_suites.team_id
      AND team_members.user_id = auth.uid()
    )
  );

-- Test Results RLS
CREATE POLICY "Users can view test results in accessible runs"
  ON test_results FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM test_runs, api_test_suites, team_members
      WHERE test_runs.id = test_results.test_run_id
      AND api_test_suites.id = test_runs.suite_id
      AND team_members.team_id = api_test_suites.team_id
      AND team_members.user_id = auth.uid()
    )
  );

-- User Profiles RLS
CREATE POLICY "Users can view their own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id);

-- Audit Logs RLS
CREATE POLICY "Team admins can view audit logs for their team"
  ON audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.user_id = auth.uid()
      AND team_members.role IN ('owner', 'admin')
    )
  );

-- =====================================================
-- Functions and Triggers
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to all relevant tables
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_team_members_updated_at BEFORE UPDATE ON team_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_api_test_suites_updated_at BEFORE UPDATE ON api_test_suites
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_api_tests_updated_at BEFORE UPDATE ON api_tests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_test_variables_updated_at BEFORE UPDATE ON test_variables
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_test_runs_updated_at BEFORE UPDATE ON test_runs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scheduled_runs_updated_at BEFORE UPDATE ON scheduled_runs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_webhooks_updated_at BEFORE UPDATE ON webhooks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_channels_updated_at BEFORE UPDATE ON notification_channels
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_alert_rules_updated_at BEFORE UPDATE ON alert_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to log audit events
CREATE OR REPLACE FUNCTION log_audit_event()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes)
  VALUES (
    auth.uid(),
    TG_ARGV[0],
    TG_TABLE_NAME,
    NEW.id,
    row_to_json(NEW)
  );
  RETURN NEW;
END;
$$ language 'plpgsql';

-- =====================================================
-- Views for Analytics
-- =====================================================

CREATE OR REPLACE VIEW test_run_summary AS
SELECT
  tr.id,
  tr.suite_id,
  tr.status,
  tr.total_tests,
  tr.passed_tests,
  tr.failed_tests,
  tr.duration_ms,
  tr.created_at,
  CASE
    WHEN tr.total_tests > 0 THEN ROUND((tr.passed_tests::FLOAT / tr.total_tests) * 100, 2)
    ELSE 0
  END AS pass_rate,
  ats.name AS suite_name
FROM test_runs tr
JOIN api_test_suites ats ON ats.id = tr.suite_id;

CREATE OR REPLACE VIEW test_performance_metrics AS
SELECT
  tr.suite_id,
  DATE_TRUNC('day', tr.created_at) AS test_date,
  COUNT(*) AS total_runs,
  AVG(tr.duration_ms) AS avg_duration_ms,
  MAX(tr.duration_ms) AS max_duration_ms,
  MIN(tr.duration_ms) AS min_duration_ms,
  ROUND(AVG(tr.passed_tests::FLOAT / NULLIF(tr.total_tests, 0)) * 100, 2) AS avg_pass_rate
FROM test_runs tr
WHERE tr.status = 'completed'
GROUP BY tr.suite_id, DATE_TRUNC('day', tr.created_at)
ORDER BY test_date DESC;

-- =====================================================
-- Comments for Documentation
-- =====================================================

COMMENT ON TABLE teams IS 'Represents organizations or workspaces using the platform';
COMMENT ON TABLE api_test_suites IS 'Groups of related API tests for a specific service/endpoint';
COMMENT ON TABLE api_tests IS 'Individual API test configurations';
COMMENT ON TABLE test_runs IS 'Execution of a test suite at a point in time';
COMMENT ON TABLE test_results IS 'Results of individual test executions within a test run';
COMMENT ON TABLE scheduled_runs IS 'Cron-based scheduling for automated test execution';
COMMENT ON TABLE webhooks IS 'Webhook integrations for test result notifications';
COMMENT ON TABLE notification_channels IS 'Integration points for alerts (Slack, email, PagerDuty)';
COMMENT ON TABLE alert_rules IS 'Rules that trigger notifications based on test results';
COMMENT ON TABLE audit_logs IS 'Historical record of all changes for compliance';

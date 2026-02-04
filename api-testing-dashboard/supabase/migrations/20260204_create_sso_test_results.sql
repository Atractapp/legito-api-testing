-- SSO Test Results Table
-- Stores results from automated SSO login tests

CREATE TABLE sso_test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id TEXT NOT NULL CHECK (server_id IN ('emea', 'us', 'quarterly')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'success', 'failure', 'error')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  error_message TEXT,
  error_type TEXT,
  screenshot_url TEXT,
  slack_notified BOOLEAN DEFAULT FALSE,
  triggered_by TEXT NOT NULL DEFAULT 'manual',
  metadata JSONB DEFAULT '{}'
);

-- Index for efficient queries by server and time
CREATE INDEX idx_sso_results_server ON sso_test_results(server_id, started_at DESC);

-- Index for status filtering
CREATE INDEX idx_sso_results_status ON sso_test_results(status);

-- Comment on table
COMMENT ON TABLE sso_test_results IS 'Stores results from automated Azure SSO login tests across Legito environments';

-- Comments on columns
COMMENT ON COLUMN sso_test_results.server_id IS 'Target server: emea, us, or quarterly';
COMMENT ON COLUMN sso_test_results.status IS 'Test status: pending, running, success, failure, error';
COMMENT ON COLUMN sso_test_results.duration_ms IS 'Test duration in milliseconds';
COMMENT ON COLUMN sso_test_results.error_type IS 'Classification of error: timeout, auth_failed, network, etc';
COMMENT ON COLUMN sso_test_results.screenshot_url IS 'URL to screenshot captured on failure';
COMMENT ON COLUMN sso_test_results.slack_notified IS 'Whether Slack notification was sent';
COMMENT ON COLUMN sso_test_results.triggered_by IS 'Source: manual, webhook, or scheduled';
COMMENT ON COLUMN sso_test_results.metadata IS 'Additional test metadata (browser info, etc)';

/**
 * SSO Testing Types
 */

/**
 * SSO Server identifiers
 */
export type SsoServerId = 'emea' | 'us' | 'quarterly';

/**
 * SSO Test status values
 */
export type SsoTestStatus = 'pending' | 'running' | 'success' | 'failure' | 'error';

/**
 * Trigger source for SSO tests
 */
export type SsoTriggerSource = 'manual' | 'webhook' | 'scheduled';

/**
 * SSO Server configuration
 */
export interface SsoServerConfig {
  id: SsoServerId;
  name: string;
  url: string;
  description: string;
}

/**
 * SSO Test result from database
 */
export interface SsoTestResult {
  id: string;
  serverId: SsoServerId;
  status: SsoTestStatus;
  startedAt: Date;
  completedAt: Date | null;
  durationMs: number | null;
  errorMessage: string | null;
  errorType: string | null;
  screenshotUrl: string | null;
  slackNotified: boolean;
  triggeredBy: SsoTriggerSource;
  metadata: Record<string, unknown>;
}

/**
 * Database row format for SSO test results
 */
export interface SsoTestResultRow {
  id: string;
  server_id: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  error_message: string | null;
  error_type: string | null;
  screenshot_url: string | null;
  slack_notified: boolean;
  triggered_by: string;
  metadata: Record<string, unknown>;
}

/**
 * Request payload for triggering an SSO test
 */
export interface SsoTriggerRequest {
  serverId: SsoServerId;
  triggeredBy?: SsoTriggerSource;
}

/**
 * Response from SSO trigger endpoint
 */
export interface SsoTriggerResponse {
  success: boolean;
  testId?: string;
  message: string;
  error?: string;
}

/**
 * Server status information
 */
export interface SsoServerStatus {
  serverId: SsoServerId;
  lastTest: SsoTestResult | null;
  isRunning: boolean;
  stats: {
    totalTests: number;
    successCount: number;
    failureCount: number;
    successRate: number;
    lastSuccessAt: Date | null;
    lastFailureAt: Date | null;
  };
}

/**
 * Aggregate stats across all servers
 */
export interface SsoOverallStats {
  totalTests: number;
  successRate: number;
  failuresLast24h: number;
  servers: Record<SsoServerId, SsoServerStatus>;
}

/**
 * Slack notification payload
 */
export interface SsoSlackNotification {
  serverId: SsoServerId;
  serverName: string;
  status: 'success' | 'failure';
  durationMs: number;
  timestamp: Date;
  errorMessage?: string;
}

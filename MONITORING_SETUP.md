# Monitoring, Alerting, and Observability Setup

## Overview

This document provides a comprehensive strategy for monitoring the API Testing Platform, including application health, CI/CD pipeline metrics, and real-time alerting.

## Architecture

```
┌─────────────────────────────────────────────────┐
│        Application Instances                    │
│        (Vercel Edge Functions)                  │
├─────────────────────────────────────────────────┤
│  Instrumentation Layer                          │
│  ├─ Application Logs (stdout/stderr)            │
│  ├─ Performance Metrics (Custom)                │
│  └─ Error Tracking (Sentry)                     │
├─────────────────────────────────────────────────┤
│  Data Collection                                │
│  ├─ Datadog Agent (APM)                         │
│  ├─ Vercel Analytics                            │
│  └─ Supabase Logs                               │
├─────────────────────────────────────────────────┤
│  Data Storage & Processing                      │
│  ├─ Datadog (Metrics, Logs, APM)                │
│  ├─ Sentry (Error Tracking)                     │
│  └─ PostgreSQL (Custom Metrics)                 │
├─────────────────────────────────────────────────┤
│  Alerting & Notification                        │
│  ├─ Slack Integration                           │
│  ├─ PagerDuty (On-call Management)              │
│  ├─ Email Notifications                         │
│  └─ GitHub Issue Creation                       │
├─────────────────────────────────────────────────┤
│  Dashboards                                     │
│  ├─ Datadog Dashboards                          │
│  ├─ Grafana (Optional)                          │
│  └─ Custom Analytics (Next.js)                  │
└─────────────────────────────────────────────────┘
```

## 1. Application Instrumentation

### Next.js Application Instrumentation

```typescript
// lib/monitoring.ts
import * as Sentry from "@sentry/nextjs";

export function initializeMonitoring() {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NEXT_PUBLIC_ENVIRONMENT,
    tracesSampleRate: process.env.NEXT_PUBLIC_ENVIRONMENT === 'production' ? 0.1 : 1.0,

    integrations: [
      new Sentry.Replay({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],

    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
}

// Custom error tracking
export function captureException(error: Error, context?: Record<string, any>) {
  Sentry.captureException(error, {
    contexts: {
      custom: context,
    },
  });
}

// Performance monitoring
export function measurePerformance(name: string, fn: () => void) {
  const startTime = performance.now();
  try {
    fn();
  } finally {
    const duration = performance.now() - startTime;
    console.log(`${name} took ${duration}ms`);

    Sentry.captureMessage(`Performance: ${name}`, 'info', {
      contexts: {
        performance: {
          duration_ms: duration,
        },
      },
    });
  }
}
```

### Database Query Logging

```typescript
// lib/supabase-monitoring.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Wrap queries with monitoring
export async function monitoredQuery<T>(
  name: string,
  query: () => Promise<T>,
  alertThreshold = 5000
): Promise<T> {
  const startTime = Date.now();

  try {
    const result = await query();
    const duration = Date.now() - startTime;

    // Log slow queries
    if (duration > alertThreshold) {
      console.warn(`Slow query: ${name} took ${duration}ms`);
      captureException(new Error(`Slow query: ${name}`), {
        query_name: name,
        duration_ms: duration,
      });
    }

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`Query failed: ${name} after ${duration}ms`, error);
    throw error;
  }
}
```

## 2. CI/CD Pipeline Monitoring

### Pipeline Metrics Tracking

```yaml
# .github/workflows/monitoring.yml
name: Pipeline Metrics

on:
  workflow_run:
    workflows:
      - "CI-PR-Validation"
      - "Test-Execution"
      - "Production-Deployment"
    types:
      - completed

jobs:
  track-metrics:
    runs-on: ubuntu-latest
    steps:
      - name: Calculate pipeline metrics
        uses: actions/github-script@v7
        with:
          script: |
            const run = await github.rest.actions.getWorkflowRun({
              owner: context.repo.owner,
              repo: context.repo.repo,
              run_id: context.payload.workflow_run.id
            });

            const metrics = {
              workflow_name: run.data.name,
              status: run.data.conclusion,
              duration_minutes: (run.data.run_number) / 60,
              branch: run.data.head_branch,
              commit_sha: run.data.head_commit.id,
              timestamp: new Date().toISOString(),
              trigger: run.data.event
            };

            console.log('Pipeline Metrics:', metrics);

      - name: Send metrics to Datadog
        env:
          DD_API_KEY: ${{ secrets.DATADOG_API_KEY }}
        run: |
          curl -X POST \
            "https://api.datadoghq.com/api/v1/series" \
            -H "DD-API-KEY: ${DD_API_KEY}" \
            -d @- << EOF
          {
            "series": [
              {
                "metric": "ci.workflow.duration",
                "points": [[$(date +%s), ${{ job.duration }}]],
                "type": "gauge",
                "tags": [
                  "workflow:${{ github.workflow }}",
                  "status:${{ job.status }}"
                ]
              }
            ]
          }
          EOF
```

## 3. Key Metrics to Monitor

### Application Metrics

```typescript
// metrics/application.ts
interface ApplicationMetrics {
  // API Performance
  api_response_time_p50: number;      // ms
  api_response_time_p95: number;      // ms
  api_response_time_p99: number;      // ms
  api_error_rate: number;              // percentage

  // Test Execution
  test_run_duration: number;           // ms
  tests_passed: number;
  tests_failed: number;
  pass_rate: number;                   // percentage

  // Database
  db_query_time_p95: number;           // ms
  db_connection_pool_usage: number;    // percentage

  // Frontend
  page_load_time: number;              // ms
  first_contentful_paint: number;      // ms
  largest_contentful_paint: number;    // ms

  // Infrastructure
  memory_usage: number;                // percentage
  cpu_usage: number;                   // percentage
  disk_space_usage: number;            // percentage
}
```

### CI/CD Metrics

```typescript
interface CIPipelineMetrics {
  // Frequency
  deployment_frequency: number;         // deploys per day

  // Speed
  pipeline_duration: number;            // minutes
  test_execution_time: number;          // minutes
  time_to_production: number;           // minutes

  // Reliability
  test_success_rate: number;            // percentage
  build_success_rate: number;           // percentage
  deployment_success_rate: number;      // percentage

  // Recovery
  mean_time_to_recovery: number;        // minutes
  change_failure_rate: number;          // percentage
}
```

## 4. Alerting Rules

### Critical Alerts

```yaml
# Critical - Immediate Action Required (5 min response)

- Alert: API Error Rate > 5%
  Threshold: error_rate > 5
  Duration: 5 minutes
  Action: Create PagerDuty incident, Slack critical
  Severity: Critical

- Alert: Test Pass Rate < 90%
  Threshold: pass_rate < 90
  Duration: 10 minutes
  Action: Block deployments, Slack alert
  Severity: Critical

- Alert: Database Connection Pool Exhausted
  Threshold: pool_usage > 95
  Duration: 2 minutes
  Action: PagerDuty incident, Kill idle connections
  Severity: Critical

- Alert: Production Deployment Failed
  Threshold: deployment_status = failed
  Duration: Immediate
  Action: Trigger rollback, Create incident
  Severity: Critical

- Alert: Memory Usage > 85%
  Threshold: memory > 85
  Duration: 5 minutes
  Action: Scale up, Slack alert
  Severity: Critical
```

### High Priority Alerts

```yaml
# High - 15 min response

- Alert: API Response Time P95 > 2s
  Threshold: p95_latency > 2000ms
  Duration: 5 minutes
  Action: Slack, investigate caching
  Severity: High

- Alert: Database Query Time P95 > 1s
  Threshold: db_p95 > 1000ms
  Duration: 5 minutes
  Action: Slack, check query performance
  Severity: High

- Alert: Test Execution Time > Expected
  Threshold: execution_time > baseline * 1.5
  Duration: 10 minutes
  Action: Slack notification
  Severity: High

- Alert: Certificate Expiring Soon
  Threshold: days_until_expiry < 30
  Duration: Once daily
  Action: Email, Slack reminder
  Severity: High
```

### Medium Priority Alerts

```yaml
# Medium - 1 hour response

- Alert: Build Time Increasing
  Threshold: duration > baseline * 1.2
  Duration: Trend over 5 runs
  Action: Slack notification
  Severity: Medium

- Alert: Disk Space Usage > 70%
  Threshold: disk > 70%
  Duration: 10 minutes
  Action: Email notification
  Severity: Medium

- Alert: Unused test suites
  Threshold: last_run > 30 days ago
  Duration: Once weekly
  Action: Slack notification
  Severity: Medium
```

## 5. Slack Integration

### Configuration

```typescript
// lib/slack-integration.ts
import axios from 'axios';

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

interface SlackAlert {
  severity: 'critical' | 'high' | 'medium' | 'info';
  title: string;
  message: string;
  context?: Record<string, any>;
  actionUrl?: string;
}

export async function sendSlackAlert(alert: SlackAlert) {
  const severityColors = {
    critical: '#FF0000',
    high: '#FF9900',
    medium: '#FFFF00',
    info: '#00FF00',
  };

  const payload = {
    attachments: [
      {
        color: severityColors[alert.severity],
        title: alert.title,
        text: alert.message,
        fields: Object.entries(alert.context || {}).map(([key, value]) => ({
          title: key,
          value: String(value),
          short: true,
        })),
        actions: alert.actionUrl
          ? [
              {
                type: 'button',
                text: 'View Details',
                url: alert.actionUrl,
              },
            ]
          : [],
        footer: 'API Testing Platform',
        ts: Math.floor(Date.now() / 1000),
      },
    ],
  };

  try {
    await axios.post(SLACK_WEBHOOK_URL!, payload);
  } catch (error) {
    console.error('Failed to send Slack alert:', error);
  }
}
```

## 6. Datadog Dashboard Configuration

### Dashboard JSON

```json
{
  "title": "API Testing Platform - Production",
  "widgets": [
    {
      "id": 1,
      "title": "API Error Rate",
      "query": "avg:api.error_rate{env:production}",
      "type": "timeseries"
    },
    {
      "id": 2,
      "title": "Test Pass Rate",
      "query": "avg:test.pass_rate{env:production}",
      "type": "gauge"
    },
    {
      "id": 3,
      "title": "API Response Time (P95)",
      "query": "p95:api.response_time{env:production}",
      "type": "timeseries"
    },
    {
      "id": 4,
      "title": "Database Connection Pool",
      "query": "avg:db.pool.usage{env:production}",
      "type": "gauge"
    },
    {
      "id": 5,
      "title": "Deployment Status",
      "query": "count:ci.deployment.count{status:success}",
      "type": "number"
    },
    {
      "id": 6,
      "title": "Test Execution Duration",
      "query": "avg:test.execution_time{env:production}",
      "type": "timeseries"
    }
  ]
}
```

## 7. Custom Analytics Views

### Analytics API Endpoint

```typescript
// pages/api/analytics/summary.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: any, res: any) {
  const { period = '7d' } = req.query;

  // Calculate period start date
  const periodDays = parseInt(period) || 7;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - periodDays);

  // Query test run summary
  const { data: runs } = await supabase
    .from('test_run_summary')
    .select('*')
    .gte('created_at', startDate.toISOString());

  // Calculate metrics
  const totalRuns = runs?.length || 0;
  const successfulRuns = runs?.filter(r => r.status === 'completed').length || 0;
  const avgPassRate = runs?.reduce((sum, r) => sum + (r.pass_rate || 0), 0) / totalRuns || 0;
  const avgDuration = runs?.reduce((sum, r) => sum + (r.duration_ms || 0), 0) / totalRuns || 0;

  res.status(200).json({
    period,
    total_runs: totalRuns,
    successful_runs: successfulRuns,
    success_rate: (successfulRuns / totalRuns) * 100,
    avg_pass_rate: avgPassRate,
    avg_duration_ms: avgDuration,
    generated_at: new Date().toISOString(),
  });
}
```

## 8. Uptime Monitoring

### Synthetic Monitoring

```yaml
# Vercel Cron for uptime checks
functions:
  api/monitoring/synthetic-check.ts:
    schedule: "0 * * * *"  # Every hour
```

```typescript
// api/monitoring/synthetic-check.ts
export default async function handler(req: any, res: any) {
  const healthChecks = [
    { name: 'API Health', url: '/api/health' },
    { name: 'Database Connection', url: '/api/db/health' },
    { name: 'Auth Service', url: '/api/auth/health' },
  ];

  const results = await Promise.all(
    healthChecks.map(async (check) => {
      const startTime = Date.now();
      try {
        const response = await fetch(`${process.env.DEPLOYMENT_URL}${check.url}`);
        const duration = Date.now() - startTime;
        return {
          name: check.name,
          status: response.ok ? 'up' : 'down',
          response_time_ms: duration,
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        return {
          name: check.name,
          status: 'down',
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        };
      }
    })
  );

  res.status(200).json(results);
}
```

## 9. Logging Strategy

### Structured Logging

```typescript
// lib/logger.ts
interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  context: Record<string, any>;
  traceId: string;
  userId?: string;
  requestId?: string;
}

export function log(level: string, message: string, context?: Record<string, any>) {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level: level as any,
    message,
    context: context || {},
    traceId: generateTraceId(),
  };

  console.log(JSON.stringify(entry));
}

function generateTraceId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
```

## 10. Implementation Checklist

- [ ] Set up Sentry account and configure DSN
- [ ] Configure Datadog APM instrumentation
- [ ] Set up Slack webhook for notifications
- [ ] Create alerting rules in Datadog
- [ ] Configure PagerDuty for on-call escalation
- [ ] Set up custom dashboards
- [ ] Implement synthetic monitoring
- [ ] Configure log aggregation
- [ ] Set up performance baselines
- [ ] Create runbooks for common alerts
- [ ] Test alert notification channels
- [ ] Document escalation procedures
- [ ] Schedule weekly metrics review
- [ ] Train team on dashboard usage

## References

- Datadog Documentation: https://docs.datadoghq.com
- Sentry Documentation: https://docs.sentry.io
- Vercel Analytics: https://vercel.com/docs/analytics
- Google DevOps Research Report: https://cloud.google.com/blog/products/devops-sre

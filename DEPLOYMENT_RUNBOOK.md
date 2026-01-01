# Deployment and Operations Runbook

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Standard Deployment Process](#standard-deployment-process)
3. [Rollback Procedures](#rollback-procedures)
4. [Emergency Procedures](#emergency-procedures)
5. [Troubleshooting Guide](#troubleshooting-guide)
6. [Post-Deployment Validation](#post-deployment-validation)

## Pre-Deployment Checklist

### Code Quality

- [ ] All tests passing (unit, integration, e2e)
- [ ] Code review completed (minimum 2 approvals)
- [ ] No security vulnerabilities detected
- [ ] Lint and format checks passing
- [ ] Type checking passing (TypeScript)
- [ ] Bundle size within acceptable limits

### Database

- [ ] Migrations tested on staging
- [ ] Schema changes backward compatible
- [ ] Rollback procedure documented
- [ ] Data backup confirmed
- [ ] No data loss in migration
- [ ] RLS policies reviewed and applied

### Infrastructure

- [ ] Vercel deployment token valid
- [ ] Environment variables verified
- [ ] SSL certificate valid
- [ ] CDN configuration correct
- [ ] Edge Functions deployable
- [ ] Monitoring dashboards ready

### Documentation

- [ ] Release notes prepared
- [ ] Change log updated
- [ ] API documentation current
- [ ] Runbooks reviewed
- [ ] Team notified of deployment

## Standard Deployment Process

### Step 1: Prepare for Deployment

```bash
# 1. Review changes since last deployment
git log --oneline main..HEAD | head -20

# 2. Verify all checks passing
# Check GitHub: All status checks must be green

# 3. Create deployment issue
# Title: "Deploy v1.X.X to production"
# Include: Release notes, changes, rollback plan
```

### Step 2: Merge to Main

```bash
# All required checks must pass on PR
# 1. Code review completed
# 2. Status checks green
# 3. No conflicts

# Merge with "Squash and merge" or "Create a merge commit"
# depending on your strategy
```

### Step 3: Monitor Deployment

The deployment workflow will automatically trigger:

```
Workflow: Production Deployment
├─ Pre-deployment validation
│  └─ TypeScript check, Tests, Build
├─ Database migration
│  └─ Apply schema changes
├─ Deploy frontend
│  └─ Vercel production deployment
├─ Deploy Edge Functions
│  └─ Update API endpoints
└─ Smoke tests
   └─ Verify deployment health
```

### Step 4: Watch Deployment Progress

```bash
# Monitor in GitHub Actions
# View logs for any errors
# Check Vercel deployment status
# Monitor Slack notifications
```

### Step 5: Post-Deployment Validation

```bash
# Run immediate validation checks
curl https://api.example.com/api/health

# Check key metrics
# - Error rate < 5%
# - Response time normal
# - Database queries normal
# - No failed tests

# Monitor for 30 minutes
# Watch Datadog dashboard
# Monitor error tracking (Sentry)
```

## Rollback Procedures

### Automatic Rollback Trigger

Rollback is **automatically triggered** if:
- Smoke tests fail
- Error rate exceeds 10%
- Database migration fails
- Health check endpoints return 5xx

### Manual Rollback

If automatic rollback doesn't trigger or needs manual intervention:

#### Option 1: Via GitHub Actions

```bash
# 1. Go to GitHub Actions
# 2. Select "Rollback Deployment" workflow
# 3. Click "Run workflow"
# 4. Select target version to rollback to
# 5. Confirm rollback
```

#### Option 2: Via Vercel

```bash
# 1. Go to Vercel Dashboard
# 2. Select Project
# 3. Go to "Deployments" tab
# 4. Find the previous successful deployment
# 5. Click the three dots menu
# 6. Select "Promote to Production"
```

#### Option 3: Database Rollback

If the issue is database-related:

```bash
# 1. Connect to production database
# 2. Run rollback migration

# Via Supabase CLI:
supabase db reset \
  --db-url "postgresql://..." \
  --version <previous-version>

# Verify rollback success:
supabase db lint --db-url "postgresql://..."
```

### Rollback Checklist

- [ ] Production error rate confirmed
- [ ] Root cause identified
- [ ] Decision made to rollback
- [ ] Slack notification sent
- [ ] Rollback started
- [ ] Deployment monitoring re-enabled
- [ ] Database integrity verified
- [ ] Tests passing on rolled-back version
- [ ] All services responding
- [ ] Post-rollback notification sent
- [ ] Incident documentation started

## Emergency Procedures

### Critical Production Issue

**Response Time: < 5 minutes**

#### Phase 1: Immediate Response (< 2 minutes)

```bash
# 1. Acknowledge incident
# Send message to #incidents Slack channel

# 2. Assess severity
# - User impact?
# - Data affected?
# - Security issue?

# 3. Initiate incident management
# Create PagerDuty incident
# Get on war room call (optional for critical)

# 4. Gather information
# Check error rates: Check Datadog/Sentry
# Check deployment status: Check GitHub Actions
# Check database: Check Supabase logs
```

#### Phase 2: Mitigation (2-5 minutes)

```bash
# Option A: Rollback (if deployment issue)
github.com/your-org/your-repo/actions/workflows/rollback.yml

# Option B: Enable maintenance mode
# Temporarily disable test execution
# Prevent new deployments

# Option C: Database failover (if critical DB issue)
# Switch to backup instance
# Contact Supabase support

# Option D: Scale resources (if performance issue)
# Increase Vercel function memory
# Increase database connection pool
```

#### Phase 3: Communication

```bash
# 1. Update status page
# - Mark incident
# - Provide initial assessment

# 2. Notify stakeholders
# - Team leads
# - Customers (if major outage)
# - Management

# 3. Provide updates
# Every 15 minutes until resolved
# Include current status and ETA

# 4. Document timeline
# Start incident report
# Track all actions taken
```

### Database Corruption

**Response Time: < 10 minutes**

```bash
# 1. Stop all write operations
# Disable test creation/editing
# Set read-only mode

# 2. Assess data integrity
supabase db lint --db-url "postgresql://..."

# 3. Identify affected data
# Query audit logs
# Determine scope of corruption

# 4. Recover from backup
# Download latest backup
# Restore to point before corruption
# Verify data integrity

# 5. Resume operations
# Re-enable write operations
# Run validation queries
# Monitor for issues
```

### Security Incident

**Response Time: < 15 minutes**

```bash
# 1. Contain the breach
# Revoke compromised credentials
# Rotate API keys
# Kill active sessions

# 2. Investigate
# Review access logs
# Identify affected data
# Determine attack vector

# 3. Remediate
# Patch vulnerability
# Deploy fix
# Run security scan

# 4. Communicate
# Notify security team
# Prepare customer notification
# Document incident
```

## Troubleshooting Guide

### Issue: Smoke Tests Failing

**Symptoms:**
- Deployment shows red X on GitHub
- Health check endpoint returning 5xx
- Can't connect to deployment URL

**Diagnosis:**

```bash
# 1. Check deployment status
curl -I https://your-deployment.vercel.app

# 2. Check logs
# GitHub Actions: View workflow logs
# Vercel: View function logs
# Sentry: Check error tracking

# 3. Check environment variables
# Verify all secrets present in Vercel
# Check Supabase connectivity

# 4. Test locally
npm run test:smoke
```

**Resolution:**

```bash
# If environment variables missing:
# Update Vercel environment variables
# Redeploy

# If database connectivity issue:
# Check Supabase service status
# Verify credentials
# Check network connectivity

# If code issue:
# Check deployment logs
# Rollback to previous version
# Fix code and redeploy
```

### Issue: Database Migration Stalled

**Symptoms:**
- Migration job hanging
- Database unresponsive
- Timeout errors

**Diagnosis:**

```bash
# 1. Check migration status
supabase db list-migrations \
  --db-url "postgresql://..."

# 2. Check long-running queries
SELECT pid, query, query_start
FROM pg_stat_activity
WHERE query NOT LIKE '%pg_stat_activity%'
ORDER BY query_start;

# 3. Check locks
SELECT relation::regclass, mode, granted
FROM pg_locks
WHERE NOT granted;
```

**Resolution:**

```bash
# Option 1: Cancel blocking queries
SELECT pg_cancel_backend(pid)
FROM pg_stat_activity
WHERE duration > interval '5 minutes';

# Option 2: Kill connections
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'your_database'
AND pid <> pg_backend_pid();

# Option 3: Retry migration
supabase db push --db-url "postgresql://..."
```

### Issue: High Error Rate in Production

**Symptoms:**
- Datadog showing > 5% error rate
- Sentry filling with exceptions
- User reports of failures

**Diagnosis:**

```bash
# 1. Check error type
# Sentry: Review top errors
# Datadog: Check error distribution

# 2. Check affected resources
# Query specific endpoint errors
# Check database performance
# Check external API calls

# 3. Review recent changes
git log --oneline -n 20 | head

# 4. Check infrastructure
# Vercel function memory usage
# Database connection pool
# Network latency
```

**Resolution:**

```bash
# If recent code change:
# Rollback deployment
# Investigate issue
# Fix and redeploy

# If database performance:
# Kill idle connections
# Optimize slow queries
# Scale database

# If external service:
# Check service status
# Implement circuit breaker
# Use fallback response
```

### Issue: Database Connection Pool Exhausted

**Symptoms:**
- "Connection pool exhausted" errors
- 503 Service Unavailable
- Requests timing out

**Diagnosis:**

```bash
# 1. Check pool status
SELECT
  datname,
  usename,
  count(*) as connections
FROM pg_stat_activity
GROUP BY datname, usename;

# 2. Identify idle connections
SELECT pid, usename, state, state_change
FROM pg_stat_activity
WHERE state = 'idle'
AND state_change < NOW() - INTERVAL '10 minutes';

# 3. Check connection limits
SHOW max_connections;
```

**Resolution:**

```bash
# 1. Increase pool size
# In Supabase: Database > Connection Pooling
# Increase max connections

# 2. Kill idle connections
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle'
AND state_change < NOW() - INTERVAL '10 minutes';

# 3. Update application
# Implement connection reuse
# Add connection timeout
# Implement retry logic
```

## Post-Deployment Validation

### Immediate (0-5 minutes)

```bash
# 1. Health check
curl https://api.example.com/api/health

# 2. Quick feature test
# Test main functionality manually
# Check UI rendering
# Verify basic workflows

# 3. Monitor metrics
# Error rate: Should be < 1%
# Response time: Should be normal
# Traffic: Should be normal
```

### Short-term (5-30 minutes)

```bash
# 1. Monitor key metrics
# Check Datadog dashboard
# Verify no performance degradation
# Check database performance

# 2. Run automated tests
npm run test:smoke
npm run test:e2e

# 3. Check critical features
# Login/logout working
# Test creation/execution working
# Results publishing working
```

### Standard (30 minutes - 2 hours)

```bash
# 1. Analyze performance
# Compare metrics to baseline
# Check for performance regression
# Verify scaling behavior

# 2. Verify data integrity
# Check test result accuracy
# Verify database consistency
# Ensure no data loss

# 3. Monitor error tracking
# Check Sentry for new errors
# Verify error rate stable
# No new error patterns

# 4. Get team feedback
# Ask team to test features
# Collect user feedback
# Verify no regressions
```

### Extended (2-24 hours)

```bash
# 1. Daily health check
# Review 24-hour metrics
# Check for anomalies
# Verify stability

# 2. Verify database
# Check replication lag
# Verify backups running
# Confirm recovery procedures work

# 3. Documentation review
# Update deployment documentation
# Document any issues encountered
# Prepare for next deployment
```

### Failure Scenarios

```bash
# If critical issue discovered:
✗ Error rate > 10%: ROLLBACK IMMEDIATELY
✗ Database corruption: ROLLBACK + RESTORE BACKUP
✗ Security vulnerability: ROLLBACK + PATCH + REDEPLOY
✗ Data loss: RESTORE BACKUP + INVESTIGATE
```

## Deployment Sign-Off

Deployment is considered complete and safe when:

- [ ] All smoke tests passing
- [ ] Error rate < 1% for 30 minutes
- [ ] Performance metrics normal
- [ ] Database health confirmed
- [ ] No new errors in Sentry
- [ ] Team validation completed
- [ ] User feedback positive
- [ ] 24-hour stability confirmed

## Incident Postmortem

After any significant incident:

```markdown
## Incident Postmortem

**Date:** YYYY-MM-DD
**Duration:** HH:MM
**Severity:** Critical/High/Medium

### Timeline
- HH:MM - Issue detected
- HH:MM - Root cause identified
- HH:MM - Mitigation started
- HH:MM - Issue resolved

### Root Cause
[Description of what caused the issue]

### Impact
- Users affected: [number]
- Data loss: [Yes/No]
- Duration: [time]
- Revenue impact: [if applicable]

### Resolution
[What did we do to fix it]

### Action Items
- [ ] Item 1
- [ ] Item 2
- [ ] Item 3

### Prevention
[How will we prevent this in the future]
```

## Contacts and Escalation

| Role | Name | Phone | On-Call |
|------|------|-------|---------|
| DevOps Lead | [Name] | [Phone] | [Schedule] |
| Backend Lead | [Name] | [Phone] | [Schedule] |
| DBA | [Name] | [Phone] | [Schedule] |
| Security | [Name] | [Phone] | [Schedule] |
| CEO | [Name] | [Phone] | [Schedule] |

## Additional Resources

- GitHub Repository: https://github.com/your-org/your-repo
- Vercel Dashboard: https://vercel.com/dashboard
- Supabase Console: https://app.supabase.com
- Datadog: https://app.datadoghq.com
- Sentry: https://sentry.io
- Status Page: https://status.example.com
- Documentation: https://docs.example.com

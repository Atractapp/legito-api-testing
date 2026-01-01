# CI/CD Quick Reference Guide

## File Structure

```
api-testing-platform/
├── .github/workflows/
│   ├── ci-pr-validation.yml          # PR validation workflow
│   ├── test-execution.yml             # Scheduled/manual test execution
│   └── deployment.yml                 # Production deployment
├── api/
│   └── health.ts                      # Health check endpoint
├── packages/
│   ├── api-test-runner/              # Test execution engine
│   └── shared/                        # Shared types and utilities
├── apps/
│   └── frontend/                      # Next.js application
├── docs/
│   ├── deployment/
│   ├── monitoring/
│   └── runbooks/
├── scripts/
│   ├── setup-db.sh
│   ├── migrate.sh
│   └── backup.sh
├── .env.example                       # Environment variables template
├── vercel.json                        # Vercel configuration
├── supabase-schema.sql                # Database schema
├── DEPLOYMENT_ARCHITECTURE.md         # High-level architecture
├── IMPLEMENTATION_GUIDE.md            # Step-by-step setup
├── DEPLOYMENT_RUNBOOK.md              # Operational procedures
├── MONITORING_SETUP.md                # Monitoring configuration
├── SECRET_MANAGEMENT.md               # Secret strategy
├── CI_CD_SUMMARY.md                   # Executive summary
└── QUICK_REFERENCE.md                 # This file
```

## GitHub Actions Workflows Summary

### PR Validation Workflow
```
TRIGGER: Pull request created/updated on main or develop
RUNTIME: ~10-15 minutes

Jobs (Parallel):
├─ Lint & Format
├─ TypeScript Check
├─ Unit Tests (with coverage)
├─ Build Verification
├─ Security Scanning (SonarQube, Snyk)
├─ Database Schema Validation
├─ Migration Dry-run
└─ Vercel Preview Deployment

OUTPUTS:
✓ Status checks on PR
✓ Preview URL comment
✓ Coverage report
✓ Security scan results
```

### Test Execution Workflow
```
TRIGGER:
- Scheduled: Daily 2 AM UTC, Weekly Monday 8 AM UTC
- Manual dispatch via GitHub UI
- Repository dispatch webhook

RUNTIME: 5-30 minutes (depends on test count)

Jobs:
├─ Initialize (load test suites from database)
├─ Run Tests (parallel execution by suite)
├─ Store Results (save to Supabase)
└─ Finalize (aggregate, notify)

OUTPUTS:
✓ Test results in Supabase database
✓ Slack notifications
✓ Email alerts on failure
✓ Test artifacts (30-day retention)
✓ GitHub status check
```

### Production Deployment Workflow
```
TRIGGER: Push to main branch

RUNTIME: ~15-20 minutes

Jobs (Sequential):
├─ Pre-deployment Validation
│  └─ Type check, tests, build verification
├─ Database Migration
│  └─ Apply schema changes
├─ Deploy Frontend
│  └─ Vercel production deployment
├─ Deploy Edge Functions
│  └─ Update API endpoints
├─ Smoke Tests
│  └─ Verify health endpoints
└─ Post-deployment
   └─ Update status, create release, notify

OUTPUTS:
✓ Production deployment on Vercel
✓ GitHub release
✓ Slack notification
✓ GitHub deployment tracking
✓ Automated rollback on failure
```

## GitHub Secrets Configuration

### Must Configure Before First Run

```bash
# Production Environment Secrets
SUPABASE_URL                   # https://[id].supabase.co
SUPABASE_ANON_KEY             # eyJ...
SUPABASE_SERVICE_ROLE_KEY     # eyJ...
SUPABASE_DB_URL               # postgresql://...
VERCEL_TOKEN                  # Vercel deployment token
VERCEL_ORG_ID                 # Vercel organization ID
VERCEL_PROJECT_ID             # Vercel project ID
SLACK_WEBHOOK_URL             # https://hooks.slack.com/...
ALERT_EMAIL                   # alerts@yourcompany.com
SENTRY_DSN                    # https://[key]@[domain]...

# Optional but Recommended
DATADOG_API_KEY               # For APM monitoring
SONAR_TOKEN                   # For code quality
SNYK_TOKEN                    # For dependency scanning
```

### Set via GitHub UI
```
Settings > Secrets and variables > Actions > Repository secrets
- Add each secret
- Click "New repository secret"
- Name: [as shown above]
- Value: [your actual value]
```

### Set via GitHub CLI
```bash
# Login to GitHub
gh auth login

# Add secrets
gh secret set SUPABASE_URL --body "https://[id].supabase.co"
gh secret set VERCEL_TOKEN --body "your-token"
gh secret set SLACK_WEBHOOK_URL --body "https://hooks.slack.com/..."
# ... etc for all secrets
```

## Deployment Process

### Standard Deployment (Main Branch)
```
1. Create feature branch
   git checkout -b feature/my-feature

2. Make changes & commit
   git add .
   git commit -m "feat: add new feature"

3. Push branch
   git push origin feature/my-feature

4. Create Pull Request
   - GitHub.com > New Pull Request
   - Select: feature/my-feature → main

5. Wait for PR Checks (10-15 min)
   - Lint: PASS
   - Type Check: PASS
   - Tests: PASS
   - Build: PASS
   - Security: PASS
   - Preview URL: Available

6. Code Review & Approval
   - Request reviews
   - Address feedback
   - Get minimum 2 approvals

7. Merge PR
   - Click "Merge pull request"
   - Delete branch (optional)

8. Watch Deployment (15-20 min)
   - GitHub Actions > Workflows
   - Production Deployment starts automatically
   - Monitor smoke tests

9. Verify in Production
   - https://your-production-url
   - Check metrics in Datadog
   - Monitor Sentry for errors
```

### Manual Test Run
```
GITHUB > Actions > API Test Execution > Run workflow

Inputs:
- suite_id: [leave blank for all suites]
- environment: production/staging/development
- notify_on_success: [true/false]

Monitor:
- Workflow logs in real-time
- Test results in Supabase
- Slack notifications
```

### Manual Deployment
```
1. GitHub > Actions > Production Deployment > Run workflow
   - Useful for urgent hotfixes

2. Vercel Dashboard > Deployments
   - Click previous successful deployment
   - Select "Promote to Production"
   - Confirms new production deployment
```

### Rollback
```
Option 1: Via GitHub Actions
- Actions > Rollback Deployment > Run workflow
- Select version to rollback to

Option 2: Via Vercel
- Vercel Dashboard > Deployments
- Click previous deployment
- Menu > Promote to Production

Option 3: Via Supabase (Database only)
- supabase db reset --version [target-version]
- Requires CLI

Option 4: Emergency Procedure
- Immediate: Kill deployments
- Manual: Restore from backup
- Recovery: Redeploy known good version
```

## Common Commands

### Local Development
```bash
# Install dependencies
npm install

# Start dev server
npm run dev
# Browser: http://localhost:3000

# Type checking
npm run type-check

# Lint check
npm run lint

# Run tests
npm run test:unit
npm run test:integration

# Build
npm run build

# Connect to local database
npm run db:setup
npm run db:migrate
```

### Database Operations
```bash
# Create migration
supabase migration new add_users_table

# Push migrations to remote
supabase db push

# Pull schema from remote
supabase db pull

# Run migrations locally
npm run db:migrate

# Reset database
supabase db reset

# Create backup
supabase db backup
```

### Vercel Operations
```bash
# List deployments
vercel list

# View logs
vercel logs --prod

# Promote deployment
vercel promote <deployment-url>

# Scale function
vercel scale [function-name] memory
```

### GitHub Operations
```bash
# Create release
gh release create v1.0.0 --title "v1.0.0" --notes "Release notes"

# View deployments
gh deployment list

# View workflow runs
gh run list --workflow deployment.yml
```

## Monitoring Dashboards

### Key Metrics URLs
| Metric | URL |
|--------|-----|
| Datadog | https://app.datadoghq.com |
| Sentry | https://sentry.io/projects/[project-id]/ |
| Vercel | https://vercel.com/dashboard |
| Supabase | https://app.supabase.com/projects |
| GitHub Actions | https://github.com/[owner]/[repo]/actions |

### What to Check After Deployment
```
✓ Error rate < 1%
✓ Response time p95 < 2s
✓ No new errors in Sentry
✓ Database queries normal
✓ No memory leaks
✓ All endpoints responding
✓ Test results captured
```

## Alert Escalation

### Critical Alert (Error rate > 5%)
```
1. Check Sentry for error type
2. Check Datadog for affected service
3. Review recent deployment changes
4. Decide: Fix or Rollback?
5. If rollback: Execute immediately
6. If fix: Deploy hotfix
7. Notify team via Slack
```

### High Alert (Response time > 2s)
```
1. Check database performance
2. Check external service dependencies
3. Review function memory usage
4. Optimize slow queries
5. Consider scaling
6. Monitor metrics
```

### Medium Alert (Build time increased)
```
1. Review recent code changes
2. Check bundle size
3. Optimize imports
4. Consider caching strategies
5. Plan optimization
```

## Troubleshooting Checklist

### Workflow Fails
- [ ] Check GitHub Actions logs
- [ ] Verify all secrets are set
- [ ] Verify secrets are not expired
- [ ] Check branch protection rules
- [ ] Verify code formatting
- [ ] Run tests locally
- [ ] Check for breaking changes

### Deployment Fails
- [ ] Check Vercel logs
- [ ] Verify environment variables
- [ ] Check database migrations
- [ ] Verify RLS policies
- [ ] Check API endpoint health
- [ ] Review recent schema changes

### Tests Failing
- [ ] Run locally with same environment
- [ ] Check for flaky tests
- [ ] Verify test database state
- [ ] Check for timing issues
- [ ] Review recent changes

### Database Issues
- [ ] Check connection pool status
- [ ] Review slow query logs
- [ ] Check for locks
- [ ] Verify backups
- [ ] Check available space

## Contact & Escalation

| Issue | Contact | Method |
|-------|---------|--------|
| Critical Production Down | DevOps Lead | Slack + Phone |
| Deployment Failed | DevOps Team | Slack |
| Database Issue | DBA | Slack + Email |
| Security Issue | Security Lead | Slack + Email |
| General Questions | Team Lead | Slack |

## Quick Links

- Repository: https://github.com/your-org/api-testing-platform
- Vercel: https://vercel.com/dashboard/[project]
- Supabase: https://app.supabase.com/projects/[project]
- Datadog: https://app.datadoghq.com
- Sentry: https://sentry.io
- Status: https://status.yourcompany.com

## Deployment Checklist

Before deploying:
- [ ] All tests passing
- [ ] Code reviewed (2 approvals)
- [ ] No security vulnerabilities
- [ ] Documentation updated
- [ ] Monitoring ready
- [ ] Team notified
- [ ] Rollback plan documented

After deploying:
- [ ] Health check passes
- [ ] Error rate < 1%
- [ ] Performance normal
- [ ] Database queries normal
- [ ] Smoke tests pass
- [ ] No new errors
- [ ] 24-hour monitoring

## Key Metrics

### Pipeline Health
- PR validation time: < 15 min ✓
- Deployment time: 15-20 min ✓
- Test execution time: 5-30 min ✓

### Application Health
- Error rate: < 1% ✓
- Response time (p95): < 2s ✓
- Uptime: 99.9% ✓

### Team Velocity
- Deployment frequency: Daily ✓
- Lead time: < 1 hour ✓
- Mean time to recovery: < 30 min ✓

## Emergency Contacts

| Role | Name | Phone | Email |
|------|------|-------|-------|
| On-Call | TBD | TBD | TBD |
| Escalation | TBD | TBD | TBD |

## Resources

- Full Architecture: DEPLOYMENT_ARCHITECTURE.md
- Setup Instructions: IMPLEMENTATION_GUIDE.md
- Operational Guide: DEPLOYMENT_RUNBOOK.md
- Monitoring Guide: MONITORING_SETUP.md
- Secret Management: SECRET_MANAGEMENT.md

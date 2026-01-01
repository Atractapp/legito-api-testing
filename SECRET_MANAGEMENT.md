# Secret Management Strategy

## Overview

This document outlines the comprehensive strategy for managing secrets, API keys, and sensitive credentials across the API Testing Platform CI/CD pipeline and deployments.

## Hierarchy

```
GitHub Secrets (CI/CD)
├── Environment: production
├── Environment: staging
└── Environment: development

Supabase Project
├── Environment: production
├── Environment: staging
└── Environment: development

Vercel Deployment
├── Production Environment
├── Preview Environment
└── Development Environment
```

## GitHub Secrets Configuration

### Production Environment Secrets

Store these secrets in GitHub under "Settings > Secrets and variables > Actions > Repository secrets" with environment protection:

```
# Supabase Configuration (Production)
SUPABASE_URL=https://[project-id].supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_DB_URL=postgresql://postgres:[password]@db.[project-id].supabase.co:5432/postgres
SUPABASE_ACCESS_TOKEN=[personal-access-token-from-supabase]

# Vercel Configuration
VERCEL_TOKEN=your-vercel-token
VERCEL_ORG_ID=your-vercel-org-id
VERCEL_PROJECT_ID=your-vercel-project-id

# API Keys
API_TESTING_SERVICE_KEY=your-api-testing-service-key
GITHUB_TOKEN=auto-provided-by-actions

# Monitoring and Alerting
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
ALERT_EMAIL=alerts@yourcompany.com
EMAIL_SERVER=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USERNAME=your-email@gmail.com
EMAIL_PASSWORD=your-app-specific-password

# Security and Compliance
SENTRY_DSN=https://[key]@[domain].ingest.sentry.io/[projectId]
SONAR_HOST_URL=https://sonarqube.example.com
SONAR_TOKEN=squ_abc123...
SNYK_TOKEN=your-snyk-api-token
```

### Staging Environment Secrets

Create an environment called "staging" in GitHub with these secrets:

```
SUPABASE_URL=https://[staging-project-id].supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_DB_URL=postgresql://postgres:[password]@db.[staging-project-id].supabase.co:5432/postgres
VERCEL_TOKEN=[same-token-as-production]
VERCEL_ORG_ID=[same-org-id]
VERCEL_PROJECT_ID=[staging-vercel-project-id]
```

### Development Environment Secrets

For local development, create a `.env.local` file (NEVER commit this):

```
# .env.local - Development Secrets
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_DB_URL=postgresql://postgres:postgres@localhost:5432/postgres
```

## Environment Protection Rules

### Production Environment

1. **Required Reviewers**: Minimum 2 approvals
2. **Dismiss stale reviews**: Enable
3. **Require status checks**: All checks must pass
4. **Restrict who can push**: Administrators only
5. **Auto-deployment**: Manual approval required
6. **Branch restrictions**: Only main branch allowed

### Staging Environment

1. **Required Reviewers**: 1 approval
2. **Require status checks**: All checks must pass
3. **Auto-deployment**: Automatic after approval

### Development Environment

1. **No protection rules**: Developers can deploy freely

## Vercel Environment Variables

### Production Deployment

In Vercel Dashboard, configure these environment variables:

```
# Public Variables (visible in frontend)
NEXT_PUBLIC_SUPABASE_URL=https://[prod-project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_ENVIRONMENT=production
NEXT_PUBLIC_VERSION=1.0.0

# Secret Variables (server-side only)
SUPABASE_SERVICE_ROLE_KEY=eyJ...
API_SIGNING_SECRET=...
```

Link these to GitHub so they auto-sync when updated in Vercel dashboard.

## Secret Rotation Policy

### Quarterly Rotation

Every 3 months, rotate:
- Supabase service role key
- Vercel token
- API signing secrets
- Database passwords

### Immediate Rotation

Rotate immediately if:
- Key is exposed or leaked
- Employee with access leaves
- Security incident occurs
- Audit flags potential compromise

### Rotation Process

1. Generate new secret
2. Store in GitHub Secrets (staging first for testing)
3. Update all services to use new secret
4. Verify all services are working
5. Revoke old secret
6. Document rotation in audit log

## Safe Practices

### Do's
- Store all secrets in GitHub Secrets, never in code
- Use environment-specific secrets
- Rotate secrets regularly
- Use least-privilege access
- Enable audit logging
- Review secret access logs monthly
- Use service accounts for automation
- Encrypt secrets in transit and at rest

### Don'ts
- Never commit secrets to git
- Don't share secrets via email or chat
- Don't use the same secret across environments
- Don't log secrets in CI/CD output
- Don't expose secrets in error messages
- Don't give secrets unnecessarily broad permissions
- Don't ignore access audit alerts

## Supabase RLS Configuration

### Service Role Key

The service role key is used in CI/CD and should:
- Only be stored as GitHub Secret
- Only be used in private workflows
- Never be exposed to frontend
- Have audit logging enabled
- Be rotated quarterly

### Anon Key

The anon key is public and should:
- Be visible in frontend code (marked as NEXT_PUBLIC_)
- Have RLS policies enforced on all tables
- Have limited permissions via RLS
- Have rate limiting applied
- Never be used for sensitive operations

## Access Control

### GitHub Secrets Access

- Only repository collaborators can view secret names
- Secret values are masked in logs
- Only repository owners can manage secret access
- Audit logs track who accessed secrets

### Vercel Access

- Use Vercel team permissions
- Restrict deployment tokens to specific projects
- Enable Vercel audit logs
- Review team members quarterly

### Supabase Access

- Use separate projects for dev/staging/production
- Implement organization-level RBAC
- Enable API key restrictions
- Use service role keys with appropriate permissions

## Monitoring and Alerting

### Secret Exposure Detection

Monitor for:
- GitHub secret exposure alerts
- Vercel security dashboard warnings
- Supabase API key misuse alerts
- Error logs containing secret fragments

### Audit Logging

Log all:
- Secret creation
- Secret rotation
- Secret access
- Secret deletion
- Failed authentication attempts

## Disaster Recovery

### Secret Compromise Procedure

1. **Detect**: GitHub alerts, Snyk findings, security audit
2. **Isolate**: Immediately revoke compromised secret
3. **Communicate**: Notify security team and stakeholders
4. **Replace**: Generate new secret and update all services
5. **Audit**: Review secret usage logs for unauthorized access
6. **Document**: Record incident and remediation steps
7. **Prevent**: Implement controls to prevent recurrence

### Recovery Time

- Complete secret rotation: < 1 hour
- Service restart with new secret: < 30 minutes
- Full system validation: < 2 hours

## Compliance

### GDPR
- Store secrets securely (no plaintext)
- Limit access to authorized personnel
- Audit all access to sensitive data
- Implement data retention policies

### SOC 2
- Encrypt secrets at rest and in transit
- Maintain audit logs of access
- Implement least privilege access
- Conduct quarterly security reviews

### PCI-DSS
- Protect API keys with encryption
- Limit API key exposure
- Rotate keys periodically
- Monitor for unauthorized access

## Tools and Services

| Tool | Purpose | Integration |
|------|---------|-----------|
| GitHub Secrets | Store CI/CD secrets | Native GitHub Actions |
| Vercel Environment | Frontend/Edge Function vars | GitHub sync, Vercel UI |
| Supabase Vault | Sensitive data encryption | Database-level |
| HashiCorp Vault | Optional secret management | API integration |
| 1Password | Team secret sharing | Desktop/CLI access |
| Datadog | Security monitoring | Log aggregation |

## Implementation Checklist

- [ ] Create GitHub environments (dev, staging, production)
- [ ] Configure branch protection rules with environment requirements
- [ ] Store all secrets in GitHub Secrets
- [ ] Update Vercel environment variables
- [ ] Configure Supabase RLS policies
- [ ] Set up secret rotation schedule
- [ ] Enable audit logging for all services
- [ ] Document secret access procedures
- [ ] Train team on security practices
- [ ] Conduct security audit
- [ ] Implement monitoring and alerting
- [ ] Test secret rotation procedure
- [ ] Establish incident response plan

## References

- GitHub Secrets Documentation: https://docs.github.com/en/actions/security-guides/encrypted-secrets
- Vercel Environment Variables: https://vercel.com/docs/projects/environment-variables
- Supabase Security: https://supabase.com/docs/guides/platform/security
- OWASP Secrets Management: https://owasp.org/www-community/Sensitive_Data_Exposure

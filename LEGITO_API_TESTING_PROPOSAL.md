# Legito API Testing Platform - Comprehensive Proposal

## Executive Summary

This document outlines a complete end-to-end API testing solution for the Legito REST API v7. The platform provides a modern web-based dashboard deployed on Vercel, comprehensive test automation with Playwright, persistent storage with Supabase, and CI/CD integration with GitHub Actions.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Legito API Coverage](#2-legito-api-coverage)
3. [Technology Stack](#3-technology-stack)
4. [Testing Dashboard UI](#4-testing-dashboard-ui)
5. [Test Automation Framework](#5-test-automation-framework)
6. [Database Schema (Supabase)](#6-database-schema-supabase)
7. [CI/CD Pipeline](#7-cicd-pipeline)
8. [Deployment Strategy](#8-deployment-strategy)
9. [Implementation Phases](#9-implementation-phases)
10. [Cost Analysis](#10-cost-analysis)

---

## 1. Architecture Overview

```
                                    LEGITO API TESTING PLATFORM

    +------------------+     +------------------+     +------------------+
    |   Vercel Edge    |     |   GitHub Actions |     |    Supabase      |
    |   (Frontend)     |     |   (CI/CD + Tests)|     |   (Database)     |
    +--------+---------+     +--------+---------+     +--------+---------+
             |                        |                        |
             |                        |                        |
             +------------------------+------------------------+
                                      |
                         +------------+------------+
                         |                         |
                         v                         v
              +----------+----------+   +----------+----------+
              |   Test Dashboard    |   |   Test Execution    |
              |   (Next.js 14+)     |   |   (Playwright)      |
              +----------+----------+   +----------+----------+
                         |                         |
                         |                         |
                         +------------+------------+
                                      |
                                      v
                         +------------+------------+
                         |     LEGITO REST API     |
                         |     (v7 Endpoints)      |
                         +-------------------------+
```

### Key Components

| Component | Technology | Purpose |
|-----------|------------|---------|
| Frontend Dashboard | Next.js 14+, Tailwind, shadcn/ui | Test management UI |
| Test Runner | Playwright Test, TypeScript | API test execution |
| Database | Supabase (PostgreSQL) | Results, configs, history |
| CI/CD | GitHub Actions | Automation, scheduling |
| Hosting | Vercel | Frontend deployment |
| Monitoring | Built-in + Slack/Email | Alerts and notifications |

---

## 2. Legito API Coverage

### Endpoints to Test

Based on Legito REST API v7 documentation:

#### Document Management
| Endpoint | Method | Description | Priority |
|----------|--------|-------------|----------|
| `/document-record` | GET | List document records | High |
| `/document-record` | POST | Create document record | High |
| `/document-record/{code}` | PUT | Update document record | High |
| `/document-record/{code}` | DELETE | Remove document record | Medium |
| `/document-version/data/{code}` | GET | Get elements data | High |
| `/document-version/download/{code}/{format}` | GET | Download (docx, pdf, etc.) | High |

#### Template Management
| Endpoint | Method | Description | Priority |
|----------|--------|-------------|----------|
| `/template-suite` | GET | List template suites | High |
| `/template-tag` | GET/POST | Manage template tags | Medium |

#### User Management
| Endpoint | Method | Description | Priority |
|----------|--------|-------------|----------|
| `/user` | GET/POST | List/Create users | High |
| `/user/{id}` | PUT/DELETE | Update/Remove user | Medium |
| `/user-group` | GET/POST | Manage user groups | Medium |

#### File Operations
| Endpoint | Method | Description | Priority |
|----------|--------|-------------|----------|
| `/file/{code}` | GET | List files | Medium |
| `/file/{code}` | POST | Upload file | Medium |
| `/file/download/{id}` | GET | Download file | Medium |

#### Sharing & Collaboration
| Endpoint | Method | Description | Priority |
|----------|--------|-------------|----------|
| `/share/{code}` | GET | Get share lists | Medium |
| `/share/user/{code}` | POST/DELETE | Share with user | Medium |
| `/share/external-link/{code}` | POST | Create external link | Low |

#### System Data
| Endpoint | Method | Description | Priority |
|----------|--------|-------------|----------|
| `/info` | GET | System information | High |
| `/country`, `/currency`, `/language` | GET | Reference data | Low |
| `/workflow` | GET | List workflows | Medium |

### Authentication
- **Type**: JWT Bearer Token (HS256)
- **Header**: `Authorization: Bearer <token>`
- **Claims**: `iss` (API key), `iat`, `exp`

---

## 3. Technology Stack

### Frontend (Dashboard)
```
Next.js 14+          - React framework with App Router
TypeScript           - Type safety
Tailwind CSS         - Utility-first styling
shadcn/ui            - Component library
Recharts             - Data visualization
Supabase Client      - Real-time updates
```

### Testing Framework
```
Playwright Test      - API testing framework
TypeScript           - Type-safe tests
Faker.js             - Test data generation
Artillery            - Performance testing
Joi                  - Schema validation
```

### Backend/Infrastructure
```
Supabase             - PostgreSQL + Auth + Real-time
Vercel               - Edge hosting
GitHub Actions       - CI/CD pipelines
```

---

## 4. Testing Dashboard UI

### Features

#### 4.1 Test Suite Runner
- One-click test execution
- Run all tests, specific suites, or individual tests
- Real-time progress indicators
- Cancel/pause functionality

#### 4.2 Results Dashboard
- Pass/fail statistics with percentages
- Execution time metrics
- Historical trend charts (7/30/90 days)
- Failure details with request/response data

#### 4.3 Configuration Panel
- API base URL configuration
- JWT token/API key input (secure storage)
- Template/Document record IDs for testing
- Environment selection (dev/staging/prod)

#### 4.4 Reports Section
- Exportable reports (PDF, JSON, CSV)
- Test coverage visualization
- Performance metrics over time
- Flaky test detection

### UI Mockup Structure

```
+---------------------------------------------------------------+
|  [Logo] Legito API Testing        [Theme Toggle] [User Menu]  |
+---------------------------------------------------------------+
|         |                                                      |
| SIDEBAR |  MAIN CONTENT AREA                                   |
|         |                                                      |
| Dashboard|  +------------------------------------------+       |
| Test Run |  | Test Execution Status                    |       |
| Results  |  | [============================] 85%       |       |
| Config   |  | Running: GET /document-record            |       |
| Reports  |  +------------------------------------------+       |
| Settings |                                                     |
|         |  +------------+ +------------+ +------------+        |
|         |  | Passed: 42 | | Failed: 3  | | Skipped: 2 |       |
|         |  +------------+ +------------+ +------------+        |
|         |                                                      |
|         |  +------------------------------------------+        |
|         |  | Recent Test Runs                         |        |
|         |  | Run #124 - 2min ago - 95% passed         |        |
|         |  | Run #123 - 1hr ago - 100% passed         |        |
|         |  +------------------------------------------+        |
+---------------------------------------------------------------+
```

---

## 5. Test Automation Framework

### Project Structure

```
legito-api-tests/
├── src/
│   ├── api/
│   │   ├── clients/           # API client wrappers
│   │   ├── endpoints/         # Endpoint definitions
│   │   └── models/            # Request/Response types
│   ├── config/
│   │   ├── environments.ts    # Environment configs
│   │   └── test-config.ts     # Test settings
│   ├── fixtures/              # Playwright fixtures
│   ├── helpers/
│   │   ├── auth-manager.ts    # JWT handling
│   │   ├── retry-handler.ts   # Retry logic
│   │   └── rate-limiter.ts    # Rate limit handling
│   └── utils/
│       ├── logger.ts          # Custom logging
│       └── reporters.ts       # Custom reporters
├── tests/
│   ├── smoke/                 # Critical path tests
│   ├── integration/           # Endpoint integration
│   ├── e2e/                   # Full workflows
│   └── performance/           # Load testing
├── .github/workflows/         # CI/CD pipelines
├── playwright.config.ts
└── package.json
```

### Test Categories

#### Smoke Tests (@smoke)
```typescript
test('@smoke should authenticate successfully', async ({ request }) => {
  const response = await request.get('/info');
  expect(response.ok()).toBeTruthy();
});

test('@smoke should list document records', async ({ request }) => {
  const response = await request.get('/document-record');
  expect(response.status()).toBe(200);
  const data = await response.json();
  expect(Array.isArray(data)).toBe(true);
});
```

#### Integration Tests (@integration)
```typescript
test('@integration document lifecycle', async ({ request }) => {
  // Create
  const createRes = await request.post('/document-record', {
    data: testDocumentData
  });
  expect(createRes.status()).toBe(201);
  const doc = await createRes.json();

  // Update
  const updateRes = await request.put(`/document-record/${doc.code}`, {
    data: { ...testDocumentData, name: 'Updated' }
  });
  expect(updateRes.status()).toBe(200);

  // Delete
  const deleteRes = await request.delete(`/document-record/${doc.code}`);
  expect(deleteRes.status()).toBe(204);
});
```

#### E2E Tests (@e2e)
```typescript
test('@e2e complete document workflow', async ({ request }) => {
  // 1. Create document from template
  const doc = await createDocumentFromTemplate(request, templateId);

  // 2. Add version with data
  await addDocumentVersion(request, doc.code, versionData);

  // 3. Share with user
  await shareWithUser(request, doc.code, userEmail);

  // 4. Download as PDF
  const pdf = await downloadDocument(request, doc.code, 'pdf');
  expect(pdf.headers()['content-type']).toContain('application/pdf');

  // 5. Cleanup
  await deleteDocument(request, doc.code);
});
```

### Key Features

1. **Smart Authentication**
   - Automatic token refresh
   - Token caching across tests
   - Multi-user support

2. **Retry Logic**
   - Exponential backoff
   - Rate limit detection
   - Idempotency awareness

3. **Comprehensive Reporting**
   - HTML reports with details
   - JUnit XML for CI
   - Custom JSON for dashboard

---

## 6. Database Schema (Supabase)

### Core Tables

```sql
-- Test Configurations
CREATE TABLE api_test_suites (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  base_url TEXT NOT NULL,
  status TEXT CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE api_tests (
  id UUID PRIMARY KEY,
  suite_id UUID REFERENCES api_test_suites(id),
  name TEXT NOT NULL,
  method TEXT CHECK (method IN ('GET', 'POST', 'PUT', 'DELETE')),
  endpoint TEXT NOT NULL,
  expected_status_code INT,
  timeout_ms INT DEFAULT 30000,
  enabled BOOLEAN DEFAULT true
);

-- Test Execution
CREATE TABLE test_runs (
  id UUID PRIMARY KEY,
  suite_id UUID REFERENCES api_test_suites(id),
  status TEXT CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  total_tests INT DEFAULT 0,
  passed_tests INT DEFAULT 0,
  failed_tests INT DEFAULT 0,
  duration_ms INT,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE test_results (
  id UUID PRIMARY KEY,
  run_id UUID REFERENCES test_runs(id),
  test_id UUID REFERENCES api_tests(id),
  status TEXT CHECK (status IN ('passed', 'failed', 'skipped')),
  response_status INT,
  response_time_ms INT,
  error_message TEXT,
  request_body JSONB,
  response_body JSONB
);
```

### Real-time Subscriptions

```typescript
// Subscribe to test run updates
supabase
  .channel('test-runs')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'test_runs'
  }, (payload) => {
    updateTestProgress(payload.new);
  })
  .subscribe();
```

---

## 7. CI/CD Pipeline

### GitHub Actions Workflows

#### 1. PR Validation (`ci-pr-validation.yml`)
```yaml
on: [pull_request]
jobs:
  lint-and-test:
    steps:
      - Checkout code
      - Install dependencies
      - Run ESLint
      - Run TypeScript check
      - Run unit tests
      - Deploy preview to Vercel
```

#### 2. Test Execution (`test-execution.yml`)
```yaml
on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM
  workflow_dispatch:      # Manual trigger

jobs:
  run-tests:
    steps:
      - Load test configuration from Supabase
      - Execute Playwright tests
      - Store results in Supabase
      - Send notifications (Slack/email)
```

#### 3. Production Deployment (`deployment.yml`)
```yaml
on:
  push:
    branches: [main]

jobs:
  deploy:
    steps:
      - Deploy to Vercel
      - Run database migrations
      - Execute smoke tests
      - Notify team
```

---

## 8. Deployment Strategy

### Vercel Configuration

```json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "env": {
    "NEXT_PUBLIC_SUPABASE_URL": "@supabase_url",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY": "@supabase_anon_key"
  }
}
```

### Environment Variables

| Variable | Description | Location |
|----------|-------------|----------|
| `SUPABASE_URL` | Supabase project URL | Vercel + GitHub |
| `SUPABASE_ANON_KEY` | Public API key | Vercel |
| `SUPABASE_SERVICE_ROLE` | Admin key (CI only) | GitHub Secrets |
| `LEGITO_API_KEY` | Legito API key | GitHub Secrets |
| `SLACK_WEBHOOK_URL` | Notifications | GitHub Secrets |

---

## 9. Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Set up Supabase project
- [ ] Create database schema
- [ ] Initialize Next.js project
- [ ] Configure Vercel deployment
- [ ] Set up GitHub repository

### Phase 2: Test Framework (Week 2-3)
- [ ] Implement Playwright test structure
- [ ] Create API client wrappers
- [ ] Add authentication handling
- [ ] Write smoke tests for critical endpoints
- [ ] Configure CI/CD for test execution

### Phase 3: Dashboard UI (Week 3-4)
- [ ] Build layout and navigation
- [ ] Implement test runner component
- [ ] Create results dashboard
- [ ] Add configuration panel
- [ ] Integrate real-time updates

### Phase 4: Reporting & Polish (Week 4-5)
- [ ] Build reports section
- [ ] Add export functionality
- [ ] Implement historical trends
- [ ] Add notifications (Slack/email)
- [ ] Performance optimization

### Phase 5: Launch & Iterate
- [ ] Production deployment
- [ ] Team onboarding
- [ ] Feedback collection
- [ ] Continuous improvement

---

## 10. Cost Analysis

### Free Tier Coverage

| Service | Free Tier | Our Usage | Status |
|---------|-----------|-----------|--------|
| **Vercel** | 100GB bandwidth, 1000 builds | Low traffic | Covered |
| **Supabase** | 500MB DB, 2GB storage | ~100MB initially | Covered |
| **GitHub Actions** | 2000 min/month | ~500 min | Covered |

### Estimated Monthly Costs (Scale)

| Tier | Users | Tests/Month | Est. Cost |
|------|-------|-------------|-----------|
| Free | 1-3 | 1,000 | $0 |
| Growth | 5-10 | 10,000 | $25-50 |
| Pro | 10+ | 50,000+ | $100+ |

---

## Quick Start Guide

### 1. Create Supabase Project
```bash
# Install Supabase CLI
npm install -g supabase

# Apply schema
supabase db push --db-url $DATABASE_URL
```

### 2. Deploy Frontend
```bash
# Clone and install
git clone <repo>
cd api-testing-dashboard
npm install

# Configure environment
cp .env.example .env.local
# Add your Supabase credentials

# Deploy to Vercel
vercel --prod
```

### 3. Run Tests
```bash
# Install test dependencies
npm install

# Run smoke tests
npm run test:smoke

# Run all tests
npm test
```

### 4. Configure API Credentials
1. Log in to the dashboard
2. Go to Settings > API Configuration
3. Enter your Legito API key and base URL
4. Save and run your first test

---

## Files Created

This proposal comes with the following ready-to-use files:

| File | Description |
|------|-------------|
| `package.json` | Test framework dependencies |
| `playwright.config.ts` | Playwright configuration |
| `tsconfig.json` | TypeScript configuration |
| `src/helpers/auth-manager.ts` | JWT authentication handler |
| `src/helpers/retry-handler.ts` | Retry logic with backoff |
| `supabase-schema.sql` | Database schema |
| `01_database_schema.sql` | Extended schema with RLS |
| `02_context_management_types.ts` | TypeScript types |
| `.github/workflows/*.yml` | CI/CD pipelines |
| `DEPLOYMENT_ARCHITECTURE.md` | Deployment guide |
| `api-testing-dashboard/` | Next.js frontend project |

---

## Next Steps

1. **Review this proposal** and provide feedback
2. **Create Supabase project** in your preferred region
3. **Provide Legito API credentials** for testing
4. **Identify test data** (template IDs, document records)
5. **Define test priorities** based on critical workflows

---

## Contact & Support

For questions about this proposal or implementation assistance:
- Create an issue in the repository
- Contact the development team

---

*This proposal was generated using multiple specialized AI agents covering backend architecture, frontend development, test automation, CI/CD, and data management.*

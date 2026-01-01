# Legito API Test Framework - Project Structure

## Complete Directory Structure

```
legito-api-tests/
│
├── .github/
│   └── workflows/
│       └── api-tests.yml              # CI/CD pipeline configuration
│
├── src/
│   ├── api/
│   │   ├── clients/
│   │   │   └── base-client.ts         # Base API client with middleware
│   │   └── endpoints/
│   │       ├── document-records.client.ts    # Document Records API
│   │       └── document-versions.client.ts   # Document Versions API
│   │
│   ├── config/
│   │   ├── global-setup.ts            # Pre-test global setup
│   │   └── global-teardown.ts         # Post-test cleanup
│   │
│   ├── fixtures/
│   │   └── (Playwright fixtures if needed)
│   │
│   ├── helpers/
│   │   ├── auth-manager.ts            # Authentication & token refresh
│   │   ├── retry-handler.ts           # Retry logic with backoff
│   │   └── rate-limiter.ts            # Rate limiting handler
│   │
│   ├── test-data/
│   │   ├── factories/
│   │   │   └── document-factory.ts    # Test data generators
│   │   ├── generators/
│   │   │   └── (Additional data generators)
│   │   └── fixtures/
│   │       └── (Static test data)
│   │
│   └── utils/
│       ├── logger.ts                  # Winston logging
│       └── reporters/
│           └── custom-reporter.ts     # Custom test reporter
│
├── tests/
│   ├── smoke/
│   │   ├── api-health.smoke.spec.ts          # Health check tests
│   │   └── document-records.smoke.spec.ts    # Critical path tests
│   │
│   ├── integration/
│   │   └── document-lifecycle.integration.spec.ts  # Workflow tests
│   │
│   ├── e2e/
│   │   └── complete-workflow.e2e.spec.ts     # End-to-end scenarios
│   │
│   └── performance/
│       ├── load-test.yml               # Artillery configuration
│       └── load-test-processor.js      # Artillery processor
│
├── reports/                            # Generated test reports
│   ├── html/                          # HTML reports
│   ├── junit/                         # JUnit XML
│   ├── json/                          # JSON reports
│   ├── custom/                        # Custom reporter output
│   └── dashboard/                     # Dashboard data
│
├── logs/                              # Log files
│   ├── combined.log                   # All logs
│   └── error.log                      # Error logs only
│
├── .env.test                          # Test environment config
├── .env.example                       # Environment template
├── .gitignore                         # Git ignore rules
├── package.json                       # Dependencies & scripts
├── playwright.config.ts               # Playwright configuration
├── tsconfig.json                      # TypeScript configuration
├── README.md                          # Project overview
├── IMPLEMENTATION_GUIDE.md            # Setup & usage guide
├── FRAMEWORK_SUMMARY.md               # Architecture summary
└── PROJECT_STRUCTURE.md               # This file
```

## File Descriptions

### Configuration Files

| File | Purpose |
|------|---------|
| `playwright.config.ts` | Playwright Test configuration, workers, retries, reporters |
| `tsconfig.json` | TypeScript compiler options and path aliases |
| `package.json` | Dependencies, scripts, and project metadata |
| `.env.test` | Test environment variables |
| `.gitignore` | Files to exclude from version control |

### Core Framework Files

#### API Clients (`src/api/`)

| File | Exports | Purpose |
|------|---------|---------|
| `clients/base-client.ts` | `BaseApiClient` | Base HTTP client with auth, retry, rate limiting |
| `endpoints/document-records.client.ts` | `DocumentRecordsClient` | Document Records CRUD operations |
| `endpoints/document-versions.client.ts` | `DocumentVersionsClient` | Version management & file downloads |

#### Helpers (`src/helpers/`)

| File | Exports | Purpose |
|------|---------|---------|
| `auth-manager.ts` | `AuthManager`, `createAuthManager()` | Token management with auto-refresh |
| `retry-handler.ts` | `RetryHandler`, `createRetryHandler()` | Exponential backoff retry logic |
| `rate-limiter.ts` | `RateLimiter`, `rateLimiterManager` | API rate limiting protection |

#### Test Data (`src/test-data/`)

| File | Exports | Purpose |
|------|---------|---------|
| `factories/document-factory.ts` | `DocumentFactory`, `DocumentVersionFactory` | Generate realistic test data |

#### Utilities (`src/utils/`)

| File | Exports | Purpose |
|------|---------|---------|
| `logger.ts` | `logger`, logging functions | Winston-based structured logging |
| `reporters/custom-reporter.ts` | `CustomReporter` | Enhanced test reporting with metrics |

### Test Files

#### Smoke Tests (`tests/smoke/`)

| File | Tests | Duration |
|------|-------|----------|
| `api-health.smoke.spec.ts` | API health, auth, basic connectivity | ~30s |
| `document-records.smoke.spec.ts` | Critical CRUD operations | ~1-2 min |

#### Integration Tests (`tests/integration/`)

| File | Tests | Duration |
|------|-------|----------|
| `document-lifecycle.integration.spec.ts` | Complete document workflows | ~5-10 min |

#### E2E Tests (`tests/e2e/`)

| File | Tests | Duration |
|------|-------|----------|
| `complete-workflow.e2e.spec.ts` | Full business scenarios | ~10-20 min |

#### Performance Tests (`tests/performance/`)

| File | Purpose |
|------|---------|
| `load-test.yml` | Artillery load test configuration |
| `load-test-processor.js` | Custom Artillery functions |

### Documentation Files

| File | Content |
|------|---------|
| `README.md` | Project overview, quick start, features |
| `IMPLEMENTATION_GUIDE.md` | Detailed setup, usage, troubleshooting |
| `FRAMEWORK_SUMMARY.md` | Architecture, design decisions, metrics |
| `PROJECT_STRUCTURE.md` | This file - directory structure |

### Generated Directories

| Directory | Contents | Retention |
|-----------|----------|-----------|
| `reports/html/` | Interactive HTML test reports | 30 days |
| `reports/junit/` | JUnit XML for CI/CD | 30 days |
| `reports/json/` | Raw JSON test results | 30 days |
| `reports/custom/` | Custom reporter output | 30 days |
| `reports/dashboard/` | Dashboard data (latest.json, history.jsonl) | 90 days |
| `logs/` | Application and test logs | 7 days |
| `test-results/` | Playwright test artifacts | Until next run |

## Import Paths

TypeScript path aliases are configured in `tsconfig.json`:

```typescript
import { BaseApiClient } from '@api/clients/base-client';
import { createAuthManager } from '@helpers/auth-manager';
import { DocumentFactory } from '@test-data/factories/document-factory';
import { logger } from '@utils/logger';
```

## Key Files to Modify

### Adding New Endpoints

1. Create client: `src/api/endpoints/your-endpoint.client.ts`
2. Extend: `BaseApiClient`
3. Add tests: `tests/smoke/your-endpoint.smoke.spec.ts`

### Adding New Test Data

1. Create factory: `src/test-data/factories/your-factory.ts`
2. Use Faker.js for realistic data
3. Export factory functions

### Customizing Configuration

1. Environment: `.env.test`, `.env.staging`
2. Playwright: `playwright.config.ts`
3. TypeScript: `tsconfig.json`
4. CI/CD: `.github/workflows/api-tests.yml`

### Modifying Reporting

1. Custom reporter: `src/utils/reporters/custom-reporter.ts`
2. Implement `Reporter` interface
3. Add to `playwright.config.ts`

## File Size Overview

| Category | Approx Lines | Files |
|----------|--------------|-------|
| Core Framework | ~2,000 | 8 |
| Test Files | ~1,500 | 4 |
| Configuration | ~500 | 5 |
| Documentation | ~2,000 | 4 |
| **Total** | **~6,000** | **21** |

## Dependencies

### Production Dependencies

- `axios` - HTTP client for Artillery
- `date-fns` - Date manipulation
- `form-data` - Multipart form handling
- `joi` - Schema validation
- `lodash` - Utility functions
- `winston` - Logging

### Development Dependencies

- `@playwright/test` - Test framework
- `@faker-js/faker` - Test data generation
- `typescript` - Type safety
- `artillery` - Performance testing
- `eslint` - Code linting
- `prettier` - Code formatting

## Next Steps

1. **Initial Setup**: Install dependencies, configure environment
2. **Run Tests**: Execute smoke tests to verify setup
3. **Extend**: Add new endpoints and test scenarios
4. **Customize**: Adjust configuration for your needs
5. **Deploy**: Integrate with CI/CD pipeline

## Maintenance

### Regular Tasks

- **Weekly**: Review flaky tests
- **Monthly**: Update dependencies
- **Quarterly**: Review test coverage
- **As Needed**: Clean up old reports/logs

### Adding New Features

1. Plan endpoint coverage
2. Create client classes
3. Write tests (smoke → integration → e2e)
4. Update documentation
5. Submit PR with tests

## Support Files

All documentation files include:
- Usage examples
- Troubleshooting guides
- Best practices
- Code snippets

Refer to specific documentation for detailed information.

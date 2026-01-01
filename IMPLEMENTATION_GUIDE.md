# Legito API Test Framework - Implementation Guide

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.test .env.local
# Edit .env.local with your credentials

# 3. Run smoke tests
npm run test:smoke

# 4. View reports
npm run report
```

## Framework Overview

This comprehensive API test automation framework provides:

- **Modern Stack**: Playwright Test + TypeScript + Faker.js
- **Smart Features**: Auto token refresh, retry logic, rate limiting
- **Test Categories**: Smoke, Integration, E2E, Performance
- **CI/CD Ready**: GitHub Actions with parallel execution
- **Rich Reporting**: HTML, JUnit XML, Custom JSON dashboards

## Architecture

### Key Components

1. **BaseApiClient** - HTTP client with middleware
2. **AuthManager** - Token management with auto-refresh
3. **RetryHandler** - Exponential backoff with idempotency
4. **RateLimiter** - Prevent API throttling
5. **Test Factories** - Generate realistic test data

### Test Categories

| Category | Purpose | Duration | When to Run |
|----------|---------|----------|-------------|
| Smoke | Critical path validation | ~2 min | Every commit |
| Integration | Component interactions | ~10 min | PR, merge |
| E2E | Complete workflows | ~20 min | Pre-deploy |
| Performance | Load & stress testing | ~10 min | Scheduled |

## Configuration

### Environment Variables

Required variables in `.env.local`:

```env
API_BASE_URL=https://api-test.legito.com
AUTH_USERNAME=your_username
AUTH_PASSWORD=your_password
```

### Playwright Configuration

Key settings in `playwright.config.ts`:

- **Workers**: 4 (parallel execution)
- **Retries**: 2 (flaky test handling)
- **Timeout**: 30s (per test)
- **Reporters**: HTML, JUnit, JSON, Custom

## Writing Tests

### Basic Test Structure

```typescript
import { test, expect } from '@playwright/test';
import { DocumentRecordsClient } from '@api/endpoints/document-records.client';
import { createAuthManager } from '@helpers/auth-manager';
import { DocumentFactory } from '@test-data/factories/document-factory';

test.describe('Document Records', () => {
  let client: DocumentRecordsClient;

  test.beforeAll(async ({ request }) => {
    const authManager = createAuthManager(request);
    await authManager.authenticate();
    client = new DocumentRecordsClient(
      request,
      authManager,
      process.env.API_BASE_URL!
    );
  });

  test('should create document @smoke @critical', async () => {
    // Generate test data
    const document = DocumentFactory.createDocumentRecord();

    // Execute request
    const response = await client.create(document);

    // Assertions
    expect(response.ok()).toBe(true);
    expect(response.status()).toBe(201);

    const data = await response.json();
    expect(data.code).toBe(document.code);

    // Cleanup
    await client.deleteById(data.id);
  });
});
```

### Using Test Data Factories

```typescript
// Simple document
const doc = DocumentFactory.createDocumentRecord();

// Specific document type
const contract = DocumentFactory.createLegalContract();
const nda = DocumentFactory.createNDA();
const policy = DocumentFactory.createPolicy();

// Multiple documents
const docs = DocumentFactory.createMultipleDocuments(10);

// Document with tags
const tagged = DocumentFactory.createWithTags(['urgent', 'review']);
```

### Creating New Endpoint Client

```typescript
// src/api/endpoints/new-endpoint.client.ts
import { APIRequestContext, APIResponse } from '@playwright/test';
import { BaseApiClient } from '../clients/base-client';
import { AuthManager } from '@helpers/auth-manager';

export class NewEndpointClient extends BaseApiClient {
  private readonly basePath = '/api/v1/new-endpoint';

  async create(data: any): Promise<APIResponse> {
    return this.post(this.basePath, {
      data,
      rateLimitCategory: 'new-endpoint',
    });
  }

  async getById(id: string): Promise<APIResponse> {
    return this.get(`${this.basePath}/${id}`, {
      rateLimitCategory: 'new-endpoint',
    });
  }
}
```

## Running Tests

### Local Execution

```bash
# All tests
npm test

# Specific categories
npm run test:smoke
npm run test:integration
npm run test:e2e
npm run test:performance

# With UI
npm run test:headed

# Debug mode
npm run test:debug

# Specific file
npx playwright test tests/smoke/api-health.smoke.spec.ts

# By tag
npx playwright test --grep @critical
npx playwright test --grep "@smoke|@critical"
```

### CI/CD Execution

GitHub Actions workflow runs automatically on:
- Push to main/develop
- Pull requests
- Nightly schedule (2 AM UTC)
- Manual trigger

Manual trigger:
```bash
gh workflow run api-tests.yml \
  -f test_type=smoke \
  -f environment=test
```

## Reporting

### HTML Report

Interactive report with:
- Test execution timeline
- Screenshots on failure
- Request/Response details
- Retry attempts

View: `npm run report`

### JUnit XML

Standard format for CI/CD integration.

Location: `reports/junit/results.xml`

### Custom JSON Report

Dashboard-ready with metrics:
- Test summary
- Performance data
- Endpoint coverage
- Flaky test detection

Location: `reports/custom/test-report.json`

## Best Practices

### 1. Test Independence

```typescript
// Each test creates and cleans up its own data
test('independent test', async () => {
  const doc = await client.create(data);
  // ... assertions ...
  await client.deleteById(doc.id);
});
```

### 2. Unique Identifiers

```typescript
// Prevent conflicts
const code = `TEST-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
```

### 3. Proper Cleanup

```typescript
const createdIds: string[] = [];

test('test with cleanup', async () => {
  const response = await client.create(data);
  const doc = await response.json();
  createdIds.push(doc.id);
  // ... test logic ...
});

test.afterEach(async () => {
  if (createdIds.length > 0) {
    await client.bulkDelete(createdIds);
    createdIds.length = 0;
  }
});
```

### 4. Specific Assertions

```typescript
// Good - specific checks
expect(response.status()).toBe(201);
expect(data).toHaveProperty('id');
expect(data.code).toBe(expectedCode);
expect(data.tags).toContain('draft');

// Avoid - too generic
expect(response.ok()).toBe(true);
```

### 5. Error Context

```typescript
// Provide context in failures
expect(response.status(), `Failed to create document: ${await response.text()}`).toBe(201);
```

## Troubleshooting

### Authentication Issues

```
Error: Authentication failed: 401
```

**Solutions:**
- Verify `.env.local` credentials
- Check API accessibility
- Confirm user account status

### Rate Limiting

```
Warning: Rate limit approaching
```

**Solutions:**
- Increase `RATE_LIMIT_WINDOW` in config
- Reduce parallel workers
- Add test delays

### Flaky Tests

```
Test passed after retry
```

**Solutions:**
- Increase timeouts
- Check race conditions
- Verify test isolation
- Review async operations

### Network Errors

```
Error: ECONNREFUSED
```

**Solutions:**
- Verify `API_BASE_URL`
- Check network connectivity
- Confirm API is running
- Review firewall settings

## Advanced Features

### Custom Retry Strategy

```typescript
const retryHandler = new RetryHandler({
  maxRetries: 5,
  baseDelay: 2000,
  maxDelay: 30000,
  exponentialBackoff: true,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
});
```

### Rate Limiting by Category

```typescript
// Different limits for different endpoints
await rateLimiterManager.throttle('document-records');
await rateLimiterManager.throttle('file-downloads');
await rateLimiterManager.throttle('user-management');
```

### File Upload/Download

```typescript
// Upload
await client.uploadFile('/endpoint', './file.pdf', 'document');

// Download
const buffer = await client.downloadFile('/endpoint/123/download/pdf');
const fileSize = buffer.length;
```

## Performance Testing

### Artillery Configuration

Located in `tests/performance/load-test.yml`:

```yaml
phases:
  - duration: 60
    arrivalRate: 5
    name: "Warm up"
  - duration: 120
    arrivalRate: 10
    name: "Ramp up"
  - duration: 300
    arrivalRate: 20
    name: "Sustained load"
```

Run performance tests:
```bash
npm run test:performance
```

## Maintenance

### Updating Dependencies

```bash
# Check for updates
npm outdated

# Update all
npm update

# Update Playwright
npm install -D @playwright/test@latest
npx playwright install
```

### Log Management

Logs are automatically rotated:
- Location: `logs/`
- Retention: 7 days
- Levels: error, warn, info, debug

View logs:
```bash
tail -f logs/combined.log
tail -f logs/error.log
```

## GitHub Secrets Setup

Required secrets in repository:

```
API_BASE_URL_TEST
API_BASE_URL_STAGING
TEST_USERNAME
TEST_PASSWORD
SLACK_WEBHOOK (optional)
```

Configure: Settings → Secrets and variables → Actions

## Next Steps

1. Review example tests in `tests/smoke/`
2. Create `.env.local` with your credentials
3. Run smoke tests to verify setup
4. Write your first test
5. Submit PR with tests

## Support

- Documentation: This guide
- Logs: `logs/combined.log`
- Reports: `reports/`
- Issues: GitHub Issues

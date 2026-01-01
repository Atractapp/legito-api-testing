# Legito API Test Automation Framework

A comprehensive, scalable API testing framework for the Legito REST API built with Playwright Test, TypeScript, and modern testing practices.

## Overview

This framework provides complete test coverage for the Legito REST API including:
- Document Records & Versions CRUD operations
- Template Suites & Tags management
- File Management (upload/download)
- Sharing capabilities (users, groups, external links)
- User Management
- Object Records
- System Data endpoints
- Workflows and Push connections

## Framework Architecture

```
legito-api-tests/
├── src/
│   ├── api/
│   │   ├── clients/           # API client wrappers
│   │   ├── endpoints/         # Endpoint definitions
│   │   └── models/            # Request/Response models
│   ├── config/
│   │   ├── environments.ts    # Environment configurations
│   │   └── test-config.ts     # Test configuration
│   ├── fixtures/              # Playwright fixtures
│   ├── helpers/
│   │   ├── auth-manager.ts    # Authentication & token refresh
│   │   ├── retry-handler.ts   # Retry logic
│   │   └── rate-limiter.ts    # Rate limiting handler
│   ├── test-data/
│   │   ├── generators/        # Test data generators
│   │   ├── factories/         # Data factories
│   │   └── fixtures/          # Static test data
│   └── utils/
│       ├── logger.ts          # Custom logging
│       └── reporters.ts       # Custom reporters
├── tests/
│   ├── smoke/                 # Smoke tests
│   ├── integration/           # Integration tests
│   ├── e2e/                   # End-to-end tests
│   └── performance/           # Performance tests
├── .github/
│   └── workflows/             # CI/CD pipelines
├── reports/                   # Test reports
├── playwright.config.ts       # Playwright configuration
├── package.json
└── tsconfig.json
```

## Technology Stack

- **Test Framework**: Playwright Test
- **Language**: TypeScript
- **Test Data**: Faker.js + Custom factories
- **Performance Testing**: Artillery (integrated)
- **Reporting**: Playwright HTML, JUnit XML, Custom JSON
- **CI/CD**: GitHub Actions
- **Code Quality**: ESLint, Prettier
- **Type Safety**: Full TypeScript support

## Key Features

### 1. Intelligent Authentication Management
- Automatic token refresh before expiration
- Session management across test runs
- Multi-user authentication support

### 2. Smart Retry Logic
- Configurable retry strategies
- Exponential backoff for transient failures
- Idempotency-aware retries

### 3. Rate Limiting Protection
- Automatic rate limit detection
- Backoff and retry mechanisms
- Distributed test execution awareness

### 4. Comprehensive Reporting
- HTML reports with screenshots
- JUnit XML for CI/CD integration
- Custom JSON reports for dashboards
- Performance metrics tracking

### 5. Test Data Management
- Dynamic test data generation
- Data cleanup after tests
- Isolated test environments
- Factory pattern for complex objects

### 6. CI/CD Integration
- GitHub Actions workflows
- Parallel test execution
- Environment-specific configurations
- Artifact collection

## Quick Start

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run smoke tests only
npm run test:smoke

# Run integration tests
npm run test:integration

# Run E2E tests
npm run test:e2e

# Run performance tests
npm run test:performance

# Generate reports
npm run report

# Run in CI mode
npm run test:ci
```

## Test Categories

### Smoke Tests
Critical path validation ensuring core functionality works:
- Authentication
- Basic CRUD operations
- Health checks
- Critical endpoints

### Integration Tests
Endpoint interaction validation:
- Document creation and version management
- Template suite operations
- Sharing workflows
- File upload/download chains

### E2E Tests
Complete workflow validation:
- Document lifecycle (create → edit → share → download)
- User collaboration workflows
- Template-based document creation
- Workflow automation

### Performance Tests
Load and performance validation:
- Response time benchmarks
- Concurrent user simulation
- Rate limit testing
- Stress testing critical endpoints

## Configuration

Environment variables are managed through `.env` files:

```env
# .env.test
API_BASE_URL=https://api-test.legito.com
API_VERSION=v1
AUTH_USERNAME=test@example.com
AUTH_PASSWORD=secure_password
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=60000
```

## Best Practices

1. **Test Isolation**: Each test is independent and can run in any order
2. **Data Cleanup**: Automatic cleanup of test data after execution
3. **Idempotency**: Tests can be safely retried without side effects
4. **Parallel Execution**: Tests are designed for concurrent execution
5. **Clear Naming**: Descriptive test names following BDD conventions
6. **Documentation**: All endpoints and models are fully documented

## Reporting

### HTML Report
Interactive HTML report with:
- Test execution timeline
- Screenshots on failure
- Request/Response details
- Retry attempts visualization

### JUnit XML
Standard JUnit format for CI/CD integration

### Custom JSON Report
Dashboard-ready JSON with:
- Test metrics
- Performance data
- Failure analysis
- Coverage statistics

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

## License

MIT

# Legito API Tests

## Project Overview
- API testing framework for Legito REST API v7
- Stack: TypeScript, Node.js 20+, Vitest, Playwright, Supabase

## Tech Stack
- Test Framework: Vitest (unit/integration), Playwright (E2E), Artillery (performance)
- Database: Supabase (PostgreSQL)
- HTTP Client: Axios
- Validation: Joi
- Deployment: Vercel (frontend), Supabase Edge Functions

## Commands
- Run all tests: `npm test`
- Smoke tests: `npm run test:smoke`
- Integration: `npm run test:integration`
- E2E tests: `npm run test:e2e`
- Performance: `npm run test:performance`
- Type check: `npm run typecheck`
- Lint: `npm run lint:fix`
- Format: `npm run format`

## Code Standards
- Use TypeScript strict mode
- Follow existing path aliases (@src/, @tests/, etc.)
- All API tests should use the helper functions in `src/helpers/`
- Test data should be generated using `@faker-js/faker`
- Use Joi schemas for response validation

## Directory Structure
- `src/api/` - API client code
- `src/services/` - Service layer
- `src/helpers/` - Test helpers
- `tests/smoke/` - Smoke tests (quick validation)
- `tests/integration/` - Integration tests
- `tests/e2e/` - End-to-end tests
- `tests/performance/` - Load/performance tests

## Environment
- Copy `.env.example` to `.env` for local development
- Use `.env.test` for test environment variables

## Important Notes
- Never commit `.env` files with real credentials
- Run `npm run lint:fix && npm run format` before committing
- Tests are sharded in CI (4-way parallel for integration tests)

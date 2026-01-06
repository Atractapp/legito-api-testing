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

## Legito API Reference

**CRITICAL**: Always use the project's API documentation as the source of truth:
- `api-testing-dashboard/docs/LEGITO-API-REFERENCE.md` - Quick reference for endpoints and schemas
- `api-testing-dashboard/docs/legito-swagger.json` - Full OpenAPI 3.0 spec

**Do NOT guess API formats or endpoints.** Always verify against these docs first before implementing any API calls.

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

## Multi-Claude Workflow Rules

This project uses multiple Claude Code terminals in parallel. Follow these rules strictly:

### CRITICAL: File Ownership Rules
1. **NEVER modify files you didn't create** - If a build fails due to errors in files you didn't create, DO NOT fix them. Report the error to the user and wait.
2. **Only touch YOUR files** - Each terminal owns specific files. If you see errors in other files, leave them alone.
3. **If build fails due to other files** - Tell the user which file has the error and wait for the other terminal to fix it.

### Commit/Push Rules
1. **Only commit YOUR own work** - Only stage and commit files YOU created or modified in THIS terminal session
2. **Never commit others' files** - If you see modified files you didn't touch, leave them unstaged
3. **Code review required** - Review all changes with `/review` before committing
4. **Check for conflicts** - Always run `git fetch && git status` before committing to check for remote changes

### Merge Conflict Resolution
1. Always `git pull --rebase` before pushing
2. If conflicts exist, resolve them carefully - NEVER delete code from other terminals
3. When in doubt, ask the user before resolving conflicts
4. After resolving, verify the merged code still works

### Deployment Rules
1. Run `/review` before any deployment
2. Ensure all tests pass: `npm run test:smoke`
3. Check for pending changes from other terminals
4. Coordinate with user if multiple deployments are pending

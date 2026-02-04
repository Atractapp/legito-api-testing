# Legito API Tests

## CRITICAL: User Instructions Come First

**READ THIS BEFORE DOING ANYTHING:**

1. **LISTEN TO EXACTLY WHAT THE USER SAYS** - Don't interpret, don't assume, don't "improve" on their request
2. **If user says X, do X** - Not Y because you think Y is better. ASK if unsure.
3. **Don't ignore parts of requests** - Read the ENTIRE message, address ALL points
4. **Don't make substitutions** - If user says "sonnet 4.5", don't use "opus 4.5" without asking
5. **When in doubt, ASK** - Don't guess what the user wants
6. **Repeat back complex requests** - Confirm understanding before implementing

**Examples of WRONG behavior:**
- User says "use library X" → You use library Y because you think it's better
- User says "fix A, B, and C" → You only fix A and B
- User gives specific version → You use a different version
- User asks for feature X → You add features X, Y, Z without asking

**The user is the boss. Follow their instructions exactly.**

---

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
1. **ALWAYS PULL FIRST** - Before ANY changes, run `git fetch && git pull --rebase` to get latest changes. NEVER skip this step.
2. **Only commit YOUR own work** - Only stage and commit files YOU created or modified in THIS terminal session
3. **Never commit others' files** - If you see modified files you didn't touch, leave them unstaged
4. **Code review required** - Review all changes with `/review` before committing
5. **Check for conflicts** - Always run `git fetch && git status` before committing to check for remote changes

### Merge Conflict Resolution
1. Always `git pull --rebase` before pushing
2. If conflicts exist, resolve them carefully - NEVER delete code from other terminals
3. When in doubt, ask the user before resolving conflicts
4. After resolving, verify the merged code still works

### Deployment Rules
1. **NEVER deploy directly** - Do NOT run `vercel --prod` or similar direct deploy commands
2. **Only push code** - Deployments happen automatically via git push to trigger CI/CD
3. Run `/review` before any deployment
4. Ensure all tests pass: `npm run test:smoke`
5. Check for pending changes from other terminals
6. Coordinate with user if multiple deployments are pending

## C# Annotator (legito-annotator-csharp)

### GitLab Workflow
- **Repository**: https://gitlab.legito.com/legito/AI
- **Default branch**: `main` (protected)
- **Working branch**: `master`
- **ALWAYS pull before changes**: `git fetch gitlab && git pull --rebase gitlab/main`
- **Push to master, then merge to main**

### Key Facts
- .NET 10.0 API
- SQLite database with seed data (no persistent VOLUME - fresh data each deploy)
- Training happens externally, this API uses pre-trained rules

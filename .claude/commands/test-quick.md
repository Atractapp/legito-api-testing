---
description: Run tests related to recent changes
allowed-tools: Bash(npm:*), Bash(git:*)
---

## Recent Changes
!`git diff --name-only HEAD~1 2>/dev/null || git diff --name-only`

## Staged Changes
!`git diff --cached --name-only`

Analyze the changed files and run the most appropriate test command:

**Decision Tree:**
- If `tests/smoke/**` changed → `npm run test:smoke`
- If `tests/e2e/**` changed → `npm run test:e2e`
- If `tests/integration/**` changed → `npm run test:integration`
- If `tests/performance/**` changed → `npm run test:performance`
- If `src/api/**` changed → `npm run test:integration`
- If `src/helpers/**` changed → `npm run test:smoke`
- Otherwise → `npm run test:smoke` (quick validation)

Run the chosen test command and:
1. Show the results clearly
2. If tests fail, analyze the error
3. Suggest specific fixes for any failures

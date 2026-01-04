---
description: Debug a failing test
allowed-tools: Bash(npm:*), Read, Grep, Glob
argument-hint: [test-file-or-pattern]
---

## Target Test
$ARGUMENTS

## Steps

1. **Run the specific test with verbose output:**
   ```bash
   npm test -- --reporter=verbose $ARGUMENTS
   ```

2. **Analyze the failure:**
   - Read the full error message and stack trace
   - Identify the exact assertion that failed
   - Understand expected vs actual values

3. **Investigate the code:**
   - Locate the test file
   - Find the relevant source code being tested
   - Check test helpers in `src/helpers/`
   - Review related types in `src/types/`

4. **Common issues to check:**
   - API endpoint changes (check `src/api/`)
   - Response schema changes (check Joi validations)
   - Environment variables (check `.env.test`)
   - Test data issues (check faker usage)
   - Async timing issues

5. **Provide:**
   - Root cause explanation
   - Specific code fix with file:line reference
   - How to verify the fix

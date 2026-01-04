---
description: Review staged changes for issues before committing
allowed-tools: Bash(git:*), Bash(npm:*)
---

## Staged Changes
!`git diff --cached`

## Changed Files
!`git diff --cached --name-only`

Review the staged changes for:

### 1. Code Quality
- [ ] Clear variable/function names
- [ ] No unnecessary complexity
- [ ] Follows project patterns in `src/`

### 2. TypeScript
- [ ] Proper typing (no `any` unless justified)
- [ ] Interfaces for complex objects
- [ ] Consistent with existing types in `src/types/`

### 3. Testing
- [ ] Test coverage for new functionality
- [ ] Tests follow patterns in `tests/`
- [ ] Uses Joi for validation, faker for test data

### 4. Security
- [ ] No hardcoded credentials
- [ ] No sensitive data in logs
- [ ] Input validation present

### 5. Performance
- [ ] No obvious N+1 queries
- [ ] Appropriate use of async/await

**Output:**
- List any issues found with file:line references
- Suggest specific improvements
- Indicate if changes are ready to commit

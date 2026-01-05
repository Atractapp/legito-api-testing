---
description: Create a git commit with conventional format (includes review + conflict check)
allowed-tools: Bash(git:*), Bash(npm:*)
---

## Pre-Commit Checklist

### 1. Verify Own Files Only
Check which files are modified:
!`git status --short`

**CRITICAL:** Only stage files YOU created/modified in THIS session. If you see files you didn't touch, DO NOT stage them - they belong to another Claude terminal.

### 2. Check for Remote Changes
!`git fetch origin && git status -uno`

If remote has new commits, run `git pull --rebase` first to avoid conflicts.

### 3. Code Review
Review the changes you're about to commit:
!`git diff --cached --stat`

Verify:
- [ ] Code follows project standards
- [ ] No debug code or console.logs left
- [ ] No sensitive data exposed
- [ ] Tests pass for changed code

### 4. Create Commit

**Format:** `type(scope): description`

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `test` - Adding or updating tests
- `refactor` - Code refactoring
- `docs` - Documentation changes
- `chore` - Maintenance tasks

**Rules:**
1. Keep the subject line under 72 characters
2. Use imperative mood ("Add feature" not "Added feature")
3. Don't end with a period
4. Add body if changes need explanation

### 5. Post-Commit
After committing, check if push is safe:
```bash
git fetch origin && git status
```

If ahead of origin with no conflicts, push is safe.
If conflicts detected, resolve them carefully - NEVER delete code from other terminals.

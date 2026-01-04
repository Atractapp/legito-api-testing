---
description: Create a git commit with conventional format
allowed-tools: Bash(git:*)
---

## Context
- Current status: !`git status --short`
- Staged changes: !`git diff --cached --stat`
- Recent commits: !`git log --oneline -5`

Create a conventional commit message for the staged changes.

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

Stage any unstaged changes if appropriate, then commit and show the result.

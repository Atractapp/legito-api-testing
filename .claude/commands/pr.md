---
description: Create a pull request (with conflict check)
allowed-tools: Bash(git:*), Bash(gh:*)
---

## Pre-PR Checklist

### 1. Verify Your Changes Only
!`git status --short`

**CRITICAL:** Ensure you're only including YOUR changes, not files from other Claude terminals.

### 2. Check for Conflicts with Base Branch
```bash
git fetch origin
git diff origin/master --stat
```

If conflicts exist, resolve them first with `git pull --rebase origin master`.

### 3. Code Review
Run `/review` or manually verify:
- [ ] Code follows project standards
- [ ] Tests pass
- [ ] No sensitive data exposed

## Context
- Current branch: !`git branch --show-current`
- Base branch: !`git remote show origin | grep "HEAD branch" | cut -d: -f2 | tr -d ' '`
- Commits on this branch: !`git log --oneline origin/master..HEAD 2>/dev/null || git log --oneline -10`
- Changed files: !`git diff origin/master --stat 2>/dev/null || git diff --stat`

## Steps

1. **Ensure branch is pushed:**
   - If not pushed, run `git push -u origin <branch>`

2. **Create PR with gh CLI:**
   ```
   gh pr create --title "..." --body "..."
   ```

3. **PR Body Format:**
   ```markdown
   ## Summary
   - Bullet points of main changes

   ## Changes
   - Detailed list of modifications

   ## Test Plan
   - [ ] How to test these changes
   - [ ] Expected outcomes

   ## Notes
   - Any additional context
   ```

4. **Return the PR URL** so user can review

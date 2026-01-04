---
description: Create a pull request
allowed-tools: Bash(git:*), Bash(gh:*)
---

## Context
- Current branch: !`git branch --show-current`
- Base branch: !`git remote show origin | grep "HEAD branch" | cut -d: -f2 | tr -d ' '`
- Commits on this branch: !`git log --oneline origin/master..HEAD 2>/dev/null || git log --oneline -10`
- Changed files: !`git diff origin/master --stat 2>/dev/null || git diff --stat`

## Steps

1. **Check if branch is pushed:**
   - If not, push with `git push -u origin <branch>`

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

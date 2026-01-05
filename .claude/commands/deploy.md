---
description: Guide through deployment process (with review + conflict check)
allowed-tools: Bash(npm:*), Bash(git:*), Bash(vercel:*), Bash(gh:*)
---

## Pre-Deployment Checklist

### 1. Check for Other Claude Terminal Changes
!`git fetch origin && git status`

**CRITICAL:** If other terminals have pushed changes:
1. Pull their changes first: `git pull --rebase`
2. Resolve any conflicts - NEVER delete their code
3. Verify merged code works

### 2. Verify Own Changes Only
!`git status --short`

Only deploy YOUR changes. If you see uncommitted files you didn't touch, leave them.

### 3. Mandatory Code Review
Run `/review` command or verify manually:
- [ ] Code follows project standards
- [ ] No debug code left
- [ ] No sensitive data exposed
- [ ] All your changes are committed

## Pre-deployment Checks
- Current branch: !`git branch --show-current`
- Uncommitted changes: !`git status --short`
- Last commit: !`git log --oneline -1`

## Deployment Steps

### 1. Code Quality
```bash
npm run lint:fix
npm run format
npm run typecheck
```

### 2. Tests
```bash
npm run test:smoke
```

### 3. Build Verification
```bash
npm run build
```

### 4. Final Git Check
- Ensure all YOUR changes are committed
- Ensure branch is pushed to remote
- Check if PR is approved (if applicable)

### 5. Deploy

**Vercel (Frontend/Dashboard):**
```bash
vercel --prod
```

**Or via Git (CI/CD):**
```bash
git push origin master
```

### 6. Post-deployment
- Run smoke tests against production
- Check deployment logs: `vercel logs`
- Monitor for errors

## Rollback (if needed)
```bash
vercel rollback
```

## Notes
- Deployment workflow is defined in `.github/workflows/deployment.yml`
- Vercel deployments are configured in `vercel.json`
- Database migrations run automatically via Supabase
- Coordinate with user if multiple Claude terminals need to deploy

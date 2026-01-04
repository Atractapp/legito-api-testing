---
description: Guide through deployment process
allowed-tools: Bash(npm:*), Bash(git:*), Bash(vercel:*), Bash(gh:*)
---

## Pre-deployment Checks
- Current branch: !`git branch --show-current`
- Uncommitted changes: !`git status --short`
- Last commit: !`git log --oneline -1`

## Deployment Checklist

### 1. Code Quality
```bash
npm run lint:fix
npm run format
npm run typecheck
```

### 2. Tests
```bash
npm run test:smoke
npm run test:integration
```

### 3. Build Verification
```bash
npm run build
```

### 4. Git Status
- Ensure all changes are committed
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

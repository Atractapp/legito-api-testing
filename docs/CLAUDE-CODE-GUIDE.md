# Claude Code Efficiency Guide

A comprehensive guide for working with Claude Code in this project, based on best practices from Boris Cherny (Claude Code creator) and our multi-terminal workflow.

---

## RULE ZERO: FOLLOW USER INSTRUCTIONS EXACTLY

**This overrides everything else in this guide.**

1. **DO EXACTLY WHAT THE USER SAYS** - Not what you think they meant
2. **DON'T SUBSTITUTE** - If they say "use X", don't use Y because you think it's better
3. **DON'T SKIP PARTS** - Address ALL points in the user's request
4. **ASK IF UNCLEAR** - Don't guess or assume
5. **DON'T ADD EXTRAS** - Only do what was asked, not "helpful" additions

**If you catch yourself thinking "but this would be better..."** - STOP. Ask the user first.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Available Slash Commands](#available-slash-commands)
3. [Multi-Claude Workflow](#multi-claude-workflow)
4. [Keyboard Shortcuts](#keyboard-shortcuts)
5. [Permission Modes](#permission-modes)
6. [Best Practices](#best-practices)
7. [Advanced Features](#advanced-features)
8. [Troubleshooting](#troubleshooting)

---

## Quick Start

### Starting a Session

```bash
# Start Claude Code in your project
claude

# Start in plan mode (read-only, for complex tasks)
claude --permission-mode plan

# Resume a previous session
claude --resume
```

### First Things to Know

1. **CLAUDE.md** - Claude reads this file automatically at the start of every session. It contains project context, commands, and rules.

2. **Slash Commands** - Type `/` to see available commands. Our custom commands:
   - `/commit` - Create a git commit with review
   - `/test-quick` - Run relevant tests
   - `/pr` - Create pull request
   - `/review` - Code review checklist
   - And more...

3. **Plan Mode** - Press `Shift+Tab` twice for read-only mode (great for exploring/planning)

---

## Available Slash Commands

### `/commit` - Git Commit Workflow
**When to use:** After making changes, before pushing

```
/commit
```

What it does:
1. Shows git status (only YOUR files)
2. Checks for remote changes
3. Reviews staged changes
4. Creates conventional commit
5. Checks for conflicts before push

### `/test-quick` - Smart Test Runner
**When to use:** Before committing, to validate changes

```
/test-quick
```

Automatically runs the right tests based on changed files:
- `tests/smoke/**` changed → runs smoke tests
- `tests/e2e/**` changed → runs E2E tests
- `src/api/**` changed → runs integration tests

### `/pr` - Create Pull Request
**When to use:** Ready to submit changes for review

```
/pr
```

What it does:
1. Checks for conflicts with base branch
2. Ensures branch is pushed
3. Creates PR with proper format using `gh` CLI

### `/review` - Code Review Checklist
**When to use:** Self-review before committing

```
/review
```

Checks:
- Code quality and naming
- TypeScript typing
- Test coverage
- Security issues
- Performance concerns

### `/debug-test` - Debug Failing Test
**When to use:** When tests are failing

```
/debug-test tests/integration/auth.test.ts
```

Analyzes the failure and provides root cause + fix.

### `/api-test` - Generate API Test
**When to use:** Need to add test coverage

```
/api-test /users GET
```

Generates a test following project patterns.

### `/supabase-query` - Database Query Helper
**When to use:** Need to inspect or query data

```
/supabase-query show all users created today
```

Uses MCP plugin to run Supabase queries safely.

### `/deploy` - Deployment Workflow
**When to use:** Ready to deploy changes

```
/deploy
```

Guides through pre-deployment checks, deployment, and verification.

---

## Multi-Claude Workflow

This project runs multiple Claude Code terminals in parallel. **Follow these rules strictly:**

### Rule 1: Only Commit Your Own Files

```bash
# Check what's modified
git status

# Only stage files YOU created in THIS session
git add <your-files-only>

# Leave other modified files alone - they belong to another terminal
```

### Rule 2: Always Check for Conflicts

```bash
# Before committing
git fetch origin
git status

# If remote has changes
git pull --rebase
```

### Rule 3: Never Delete Others' Code

When resolving merge conflicts:
- Keep both your changes AND the other terminal's changes
- If unsure, ask the user
- Never just accept "yours" and delete "theirs"

### Rule 4: Code Review Required

Before every commit/push/deploy:
- Run `/review` command
- Or manually verify the checklist
- Never skip this step

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Shift+Tab` | Cycle permission modes |
| `Shift+Tab` x2 | Enter Plan Mode (read-only) |
| `Ctrl+C` | Cancel current operation |
| `Ctrl+B` | Background current command |
| `Ctrl+J` | Newline in input |
| `↑` / `↓` | Navigate command history |

### Permission Mode Cycle

1. **Default** → asks for permission
2. **Accept Edits** → auto-approves file edits
3. **Plan Mode** → read-only (explore/plan)

---

## Permission Modes

### Default Mode
- Asks for permission on file edits
- Asks for permission on bash commands
- Good for general work

### Accept Edits Mode (`Shift+Tab` once)
- Auto-approves file edits
- Still asks for bash commands
- Good for active coding sessions

### Plan Mode (`Shift+Tab` twice)
- Read-only - no edits allowed
- Can only read files, grep, glob
- Good for:
  - Exploring unfamiliar code
  - Planning complex refactors
  - Code review
  - Understanding architecture

### Starting in Specific Mode

```bash
# Plan mode from start
claude --permission-mode plan

# Accept edits from start
claude --permission-mode acceptEdits
```

---

## Best Practices

### 0. Follow User Instructions Exactly (MOST IMPORTANT)

Claude has a tendency to:
- Substitute what the user asked for with something "better"
- Ignore parts of multi-part requests
- Add features/changes that weren't requested
- Guess instead of asking for clarification

**FIX:** Always re-read the user's message before responding. Check:
- Did I do EXACTLY what they asked?
- Did I address ALL points?
- Did I add anything they didn't ask for?
- Did I substitute anything?

If you made any of these mistakes, FIX IT before responding.

### 1. Start Complex Tasks in Plan Mode

```
# Press Shift+Tab twice, then:
"I need to refactor the authentication system.
Analyze the current implementation and create a detailed plan."
```

Benefits:
- Claude explores without making changes
- You get a plan before implementation
- Fewer mistakes and rework

### 2. Use Specific, Detailed Prompts

❌ Bad: "Fix the bug"

✅ Good: "The login test in tests/integration/auth.test.ts is failing with 'timeout exceeded'. Investigate the root cause and fix it."

### 3. Provide Context

```
"I'm working on the tag sync feature. The current implementation
in src/services/tag-sync.ts doesn't handle pagination.
Add pagination support following the pattern in user-sync.ts."
```

### 4. Let Claude Verify Its Work

```
"Implement the feature, then:
1. Run the relevant tests
2. Fix any failures
3. Show me the final test results"
```

### 5. Update CLAUDE.md When Claude Makes Mistakes

If Claude repeatedly does something wrong:
1. Add a rule to CLAUDE.md
2. Example: "Never use console.log for debugging - use the logger utility"

### 6. Use Subagents for Specialized Tasks

The `test-debugger` subagent is automatically used when tests fail. It has specialized knowledge for debugging.

---

## Advanced Features

### 1. Background Commands

Long-running commands can run in background:
- Press `Ctrl+B` while a command is running
- Or ask Claude to run something in background

Check background tasks:
```
/tasks
```

### 2. Subagents

Custom AI personalities for specialized tasks. Current subagents:

| Subagent | Purpose | Trigger |
|----------|---------|---------|
| `test-debugger` | Debug failing tests | Automatically when tests fail |

### 3. Hooks

Auto-run commands on certain events:

- **PostToolUse** - After file edits, runs Prettier automatically
- Configured in `.claude/settings.json`

### 4. MCP Servers

External tool integrations. Available:

- **Supabase** - Database queries, schema inspection
  - List tables: Ask Claude to show tables
  - Run queries: Use `/supabase-query`

### 5. GitHub Action (@claude on PRs)

Mention `@claude` in PR comments:

```
@claude review this PR for security issues
@claude fix the failing tests
@claude explain what this code does
```

Setup required: Add `ANTHROPIC_API_KEY` to GitHub Secrets.

---

## Troubleshooting

### Claude keeps asking for permission

Use `/permissions` to pre-allow common commands:

```
/permissions
```

Or add to `.claude/settings.json`:
```json
{
  "permissions": {
    "allow": ["Bash(npm test:*)"]
  }
}
```

### Claude is editing files I didn't ask it to

Be specific in your prompts:
```
"Only modify src/auth.ts - do not touch any other files"
```

### Tests are failing after changes

1. Run `/debug-test <test-file>`
2. Let Claude analyze and fix
3. Re-run tests to verify

### Merge conflicts

1. Run `git fetch origin && git status`
2. If conflicts: `git pull --rebase`
3. Resolve conflicts carefully - don't delete other code
4. Ask Claude for help if needed

### Claude is slow or stuck

1. Press `Ctrl+C` to cancel
2. Be more specific in your prompt
3. Break the task into smaller steps

### Need to see what Claude has done

```bash
# See all changes
git diff

# See staged changes
git diff --cached

# See recent Claude commits
git log --oneline -10
```

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────┐
│                 CLAUDE CODE QUICK REFERENCE             │
├─────────────────────────────────────────────────────────┤
│ RULE ZERO                                               │
│   DO EXACTLY WHAT THE USER SAYS                         │
│   Don't substitute, don't skip, don't add extras        │
│   When in doubt: ASK                                    │
├─────────────────────────────────────────────────────────┤
│ COMMANDS                                                │
│   /commit      Create git commit with review            │
│   /test-quick  Run relevant tests                       │
│   /pr          Create pull request                      │
│   /review      Code review checklist                    │
│   /deploy      Deployment workflow                      │
│   /debug-test  Debug failing test                       │
├─────────────────────────────────────────────────────────┤
│ SHORTCUTS                                               │
│   Shift+Tab    Cycle permission modes                   │
│   Shift+Tab x2 Plan mode (read-only)                    │
│   Ctrl+C       Cancel operation                         │
│   Ctrl+B       Background command                       │
├─────────────────────────────────────────────────────────┤
│ MULTI-CLAUDE RULES                                      │
│   ✓ Only commit YOUR files                              │
│   ✓ Always check for conflicts before push             │
│   ✓ Run /review before commit                          │
│   ✗ Never delete other terminals' code                  │
├─────────────────────────────────────────────────────────┤
│ TIPS                                                    │
│   • Use plan mode for complex tasks                     │
│   • Be specific in prompts                              │
│   • Let Claude verify its work                          │
│   • Update CLAUDE.md when Claude makes mistakes         │
└─────────────────────────────────────────────────────────┘
```

---

## Files Reference

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Project context, loaded every session |
| `.claude/settings.json` | Team permissions & hooks |
| `.claude/settings.local.json` | Personal overrides (gitignored) |
| `.claude/commands/*.md` | Slash commands |
| `.claude/agents/*.md` | Subagents |
| `.github/workflows/claude.yml` | @claude on PRs |

---

## Getting Help

- In Claude Code: `/help`
- Claude Code docs: https://docs.anthropic.com/claude-code
- Report issues: https://github.com/anthropics/claude-code/issues

---

*Last updated: January 2025*
*Based on Boris Cherny's recommendations and team workflow*

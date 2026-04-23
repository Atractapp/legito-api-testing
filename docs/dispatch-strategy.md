# Dispatch Strategy — Gemma Annotator Master Plan Rollout

> **For operator (Ed):** This is the coordination doc. For each Block, it gives the terminal it should land in, what to type to kick it off, and when to call `/grand-review` for me to audit the commit before you push.
> **For Claude in the implementer terminal:** you will receive a dispatch subplan (produced via `/dispatch-plan {Block}`). Use `/execute-plan {subplan-path}`. Follow that.

**Roles in this rollout:**
- **Dispatcher (Ed, this terminal):** runs `/dispatch-plan {Block}` to write subplans, opens new terminals with the kickoff prompts below, calls `/grand-review` after each commit.
- **Reviewer (me, this terminal):** runs `/grand-review` after each implementer commit — Mode B. Flags drift, re-runs eval-set deltas, ship decision (GREEN / AMBER / RED).
- **Implementer (fresh terminals):** runs `/execute-plan {subplan-path}` per the dispatch. Does one Block, commits, stops.

**Master plan source of truth:** `C:\Legito Test\docs\gemma-annotator-master-plan.md` (r3 — 3-pass architecture + tool use + generalised rules library). Supporting design doc: `docs/gemma-annotator-3pass-design.md`.

---

## Terminal strategy

Three parallelism tiers — pick per phase based on how much context-switching you can handle:

| Tier | Terminals | Throughput | Context cost |
|---|---|---|---|
| **Serial (1 terminal)** | One at a time | Slowest, safest | Lowest; zero parallel state |
| **Paired (2 terminals)** | Two Blocks in flight when they're truly disjoint | Medium | Medium; review one while other runs |
| **Triple (3 terminals)** | All three Blocks of a Phase running at once | Fastest | Highest; 3 subplans + 3 eval runs + 3 reviews interleaved |

Default recommendation: **Paired** for Phase 0 and Phase 1 (two terminals at a time), **Serial** for Phase 2 and 3 (single terminal) because Phase 2/3 Blocks modify shared surfaces (PromptBuilder.cs, system-prompt.md).

**File-conflict risk per phase:**
- Phase 0: zero overlap (each Block writes new files). → Safe for Triple.
- Phase 1: 1.1 → appsettings.json, 1.2 → system-prompt.md, 1.3 → PromptBuilder.cs. Zero overlap. → Safe for Triple.
- Phase 2 (r3): 2.1 writes `data/skills/*.md` only; 2.3 writes new tool-schema + retrieval service files; 2.2 writes ThreePassOrchestrator.cs + edits LlmAnnotationService.cs. 2.1 ∥ 2.3 safe; 2.2 serial after both.
- Phase 3 (r3): 3.3 migrates validation into tool schemas (edits ThreePassOrchestrator.cs + tool schema files); 3.4 adds ToolCallRetryPolicy.cs. Files disjoint enough → Paired safe.

---

## Phase 0 — Foundation (measurement floor)

**Gate:** all three Blocks land before any Phase 1 work begins. Without eval harness + gold + sampler decision, Phase 1 has no ship gates to measure against.

### Dispatch order

```
Terminal A: Block 0.1 (Eval Set Creation)        — kicks off first, no deps
Terminal B: Block 0.2 (Baseline + Harness + Claude H2H) — starts once 0.1 has ≥10 gold pairs
Terminal C: Block 0.3 (Sampler A/B Grid)          — starts once 0.2 harness is mergeable
```

### Terminal A — Block 0.1

**In the dispatcher (this) terminal:**
```
/dispatch-plan 0.1
```
Produces `C:\Users\edous\.claude-work\plans\subplans\0.1-eval-set-creation.md`. Review the subplan briefly (or ask me via `/grand-review`).

**In a new terminal (working dir `C:\Legito Test\`):**
```
/execute-plan C:\Users\edous\.claude-work\plans\subplans\0.1-eval-set-creation.md
```

The Terminal A implementer will:
- Enumerate existing gold at `legito-markup-pipeline/reannotated/` and adopt ≥15.
- Build `legito-markup-pipeline/eval/manifest.json` with language/domain/size-band tags.
- Stop and surface the need for 5 additional hand-curated gold docs if the existing set doesn't meet the 20-doc target.

**When Terminal A commits**, come back to this terminal:
```
/grand-review
```
I run Mode B against `HEAD`, verify the manifest, the gold-doc counts, the language-band targets. Ship decision.

### Terminal B — Block 0.2

Do NOT dispatch Terminal B until Terminal A's commit is GREEN and `legito-markup-pipeline/eval/` has ≥10 gold pairs on disk.

```
/dispatch-plan 0.2
```
Produces `0.2-baseline-and-harness.md`. Subplan covers:
- `scripts/evaluate.py` harness
- `scripts/requirements.txt` (pin `python-docx==1.2.0`)
- Baseline metric capture on `master` + `feature/annotator-v2-rewrite`
- **Claude head-to-head benchmark** (you run this manually in a separate Claude Code session — annotate 5 eval docs, save outputs, diff against gold)
- `docs/decision-log.md` initialisation

```
# New terminal:
/execute-plan C:\Users\edous\.claude-work\plans\subplans\0.2-baseline-and-harness.md
```

After commit → `/grand-review` in this terminal.

**Note on Claude H2H:** the Terminal B implementer will set up the harness and placeholder file for the benchmark. YOU then open a fresh Claude Code session yourself (any workspace), annotate the 5 eval docs one at a time with a Claude Code session that does NOT see the Gemma annotator code — just the raw docs + Legito Markup Language spec. Save outputs to `eval/baseline/claude-h2h/{doc}.docx`. Terminal B's harness diffs those against gold. This is the only manual step in Phase 0.

### Terminal C — Block 0.3

Dispatch once Terminal B's harness is mergeable (even if H2H isn't finalised yet). Block 0.3 reuses the harness; doesn't need H2H numbers to run the grid.

```
/dispatch-plan 0.3
/execute-plan C:\Users\edous\.claude-work\plans\subplans\0.3-sampler-ab-grid.md
```

12-config × 5-doc grid. Produces `eval/sampler-grid/summary.md` and a decision-log entry with the winning config.

After commit → `/grand-review` → Phase 0 gate closes.

---

## Phase 1 — Foundation Fixes (3 Blocks parallel-safe)

**Gate:** each of 1.1, 1.2, 1.3 ships with its own eval-delta table. Blocks touch disjoint files, so Triple parallelism is safe if you can handle three reviews.

### Terminal allocation

```
Terminal D: Block 1.1 (Sampler Retune)        — appsettings.json, LlmAnnotationOptions.cs
Terminal E: Block 1.2 (System Prompt Rewrite) — data/system-prompt.md
Terminal F: Block 1.3 (Training-Match Policy) — PromptBuilder.cs, data/training-microexamples/
```

If you prefer paired: Terminal D and E first (both land), then Terminal F (it's the largest of the three). If you prefer serial: 1.2 first (unlocks skill-library conventions Block 2.1 will follow), then 1.1 (cheapest win), then 1.3.

### Per-terminal kickoff

```
# Dispatcher terminal:
/dispatch-plan 1.1   # produces 1.1-sampler-retune.md
/dispatch-plan 1.2   # produces 1.2-system-prompt-rewrite.md
/dispatch-plan 1.3   # produces 1.3-training-match-policy.md

# In three fresh terminals (or sequentially in one):
/execute-plan C:\Users\edous\.claude-work\plans\subplans\1.1-sampler-retune.md
/execute-plan C:\Users\edous\.claude-work\plans\subplans\1.2-system-prompt-rewrite.md
/execute-plan C:\Users\edous\.claude-work\plans\subplans\1.3-training-match-policy.md
```

After each commit → `/grand-review` in this terminal. Mode B verifies the per-Block ship gate held.

**Coordination if parallel**: if two terminals both try `git pull --rebase` at the same time, one will win; the other rebases on top. No merge conflicts expected (disjoint files). Watch for concurrent edits to `CHANGELOG` or `docs/decision-log.md` — minor textual conflicts may need rebase resolution.

---

## Phase 2 — 3-Pass Pipeline (2.1 ∥ 2.3 → 2.2 serial)

**Gate:** 2.1 + 2.3 + 2.2 all land in that order. 2.2 orchestrator consumes both 2.1 rules library and 2.3 tool schemas.

### Dispatch order

```
Terminal G: Block 2.1 (Generalised Multilingual Rules Library) — 30–50 skill files + index.md
Terminal H: Block 2.3 (Tool-Call Schemas + Retrieval Step)     — 13 tool schemas + RulesLibraryRetrievalService.cs
   (Terminal G and H run in parallel — disjoint files)

Terminal I: Block 2.2 (Pipeline Orchestrator + Prompts Wired)  — ThreePassOrchestrator.cs + LlmAnnotationService.cs routing
   (Terminal I after both G and H land)
```

### Per-terminal kickoff

```
/dispatch-plan 2.1
/execute-plan C:\Users\edous\.claude-work\plans\subplans\2.1-rules-library.md

/dispatch-plan 2.3
/execute-plan C:\Users\edous\.claude-work\plans\subplans\2.3-tool-schemas-retrieval.md

# After both 2.1 and 2.3 land:
/dispatch-plan 2.2
/execute-plan C:\Users\edous\.claude-work\plans\subplans\2.2-orchestrator.md
```

`/grand-review` between each. Block 2.2 ship gate: **IC_dispečink recall ≥ 36/52** (70% of gold) on the 3-pass pipeline; Pass 2 rule-selection F1 ≥0.7; banking smoke-test passes. This is the canonical proof that the 3-pass architecture handles the doc that started this workstream.

---

## Phase 3 — Validation Migration + Tool Hardening (3.3 ∥ 3.4 parallel)

**Gate:** both 3.3 AND 3.4 land.

### Dispatch order

```
Terminal J: Block 3.3 (Validation Pass Migration into Tool Schemas) — 4 PRs, one per rule migrated
Terminal K: Block 3.4 (Tool-Call Reliability Hardening + Fallback)  — ToolCallRetryPolicy.cs + feature flags
   (Terminal J and K run in parallel)
```

### Per-terminal kickoff

```
# Parallel launch:
/dispatch-plan 3.3
/execute-plan C:\Users\edous\.claude-work\plans\subplans\3.3-validation-migration.md

/dispatch-plan 3.4
/execute-plan C:\Users\edous\.claude-work\plans\subplans\3.4-tool-call-hardening.md
```

`/grand-review` between each. Terminal J is special: it produces 4 PRs, one per rule migrated. Each PR gets its own grand-review; each needs `caught_in_newpath ≥ caught_in_code` on 3 consecutive eval runs before the code path can be deleted.

---

## Phase 4 — Continuous

Dispatch Phase 4 Blocks reactively:
- **Block 4.1 (per-skill refinement)**: dispatched when a skill's eval-delta shows regression or stalled improvement. One dispatch per skill iteration.
- **Block 4.2 (red-flag expansion)**: dispatched when a new failure mode surfaces in user feedback or eval outliers.
- **Block 4.3 (eval set expansion)**: dispatched when adding new language/domain docs to the gold set.

No fixed terminal allocation. Single terminal per dispatch. Always `/grand-review` before push.

---

## Review discipline

### Every commit gets `/grand-review` before push

Never push an implementer's commit to `gitlab/master` without Mode B review. Even if ship gate looks green — the review re-runs the eval delta to catch fabricated numbers, verifies the reviewer ledger, and checks scope drift.

### What Mode B actually does (abbreviated)

I will:
1. Read the subplan + master plan §Block + execution report.
2. `git show --stat HEAD` — confirm files match §Scope.
3. Re-run `scripts/evaluate.py` myself — compare to report's delta table (≤ 2pp tolerance).
4. Verify each claim in the execution report against actual file state.
5. Re-verify the 4 reviewers' findings (open cited file:line, classify).
6. Check prompt-simplify honoured D1–D15 Gemma discipline (where applicable).
7. Check no scope drift, no fabricated metrics.
8. Ship decision: GREEN / AMBER / RED.

### After GREEN review

You push when ready: `git push gitlab feature/annotator-v2-rewrite`. No push from subagent or reviewer terminal — push is always operator-driven.

### After AMBER review

Small fix needed. Either:
- Apply the fix in this dispatcher terminal yourself (I propose the edit).
- Or dispatch a micro-follow-up with `/dispatch-plan 1.2-followup` scope-locked to just the fix.

### After RED review

Block needs rework. Options:
- Revert the commit: `git revert HEAD` — Block returns to unshipped state.
- Dispatch new subplan for the Block with §Plan corrections encoding what went wrong.

---

## Coordination — things you control from this terminal

- **Branch management.** Stay on `feature/annotator-v2-rewrite` throughout. Every Block commits here. Never to `master`.
- **Pulling before dispatch.** Before kicking off a new terminal, `git fetch gitlab && git pull --rebase` so the implementer has a clean base.
- **Push timing.** Push after each GREEN review OR batch 3–5 GREENs and push together. GitLab MR #7 already exists — new commits append.
- **Master plan revisions.** If a review surfaces a master-plan bug, edit `C:\Legito Test\docs\gemma-annotator-master-plan.md` directly (it's the canonical copy). Log the revision in `docs/decision-log.md`.
- **Skill evolution.** If the `legito:dispatch-plan` / `legito:execute-plan` / `legito:grand-review` skills need adjustments, edit at `C:\Legito Test\.claude\skills\*`. These are durable and re-read each session.

---

## Quick reference — kickoff commands

**First session:**

```
# This terminal:
/dispatch-plan 0.1
# Wait for subplan file.
# New terminal (cwd: C:\Legito Test\):
/execute-plan C:\Users\edous\.claude-work\plans\subplans\0.1-eval-set-creation.md
# After commit, back to this terminal:
/grand-review
# After GREEN:
git push gitlab feature/annotator-v2-rewrite
```

**Second Block:**

```
/dispatch-plan 0.2
/execute-plan …0.2-baseline-and-harness.md
/grand-review
# GREEN → push; AMBER → fix locally; RED → revert
```

**Dependency-gated dispatch (0.3):** only after 0.2 harness lands.
**Phase 1 parallel:** 1.1 + 1.2 + 1.3 dispatched sequentially from this terminal, each in its own fresh terminal; reviews can interleave.
**Phase 2 (r3):** 2.1 + 2.3 parallel; then 2.2 serial.
**Phase 3 (r3):** 3.3 + 3.4 parallel.

---

## Stop conditions for the dispatcher (you)

Stop dispatching and come back to the master plan for revision if:

- A Block's subplan surfaces >3 Plan corrections in §Plan corrections. The master plan has drifted materially.
- An implementer terminal reports a STOP condition not resolvable within the Block's scope. Revise the Block spec in the master plan before re-dispatching.
- `/grand-review` returns RED twice in a row on the same Block. The Block is wrong-shaped; redesign via master-plan revision.
- Three consecutive Blocks in a Phase show parse-failure rate rising. The Phase's design premise may be flawed; invoke master-plan review (not `/grand-review` — that's commit-level; a master-plan review is a human judgment call on design).

---

## File paths summary

**Master plan (you edit):** `C:\Legito Test\docs\gemma-annotator-master-plan.md`
**This dispatch strategy (you edit):** `C:\Legito Test\docs\dispatch-strategy.md`
**Subplans (dispatch-plan skill writes):** `C:\Users\edous\.claude-work\plans\subplans\{phase-block}-{slug}.md`
**Decision log (every Block appends):** `C:\Legito Test\docs\decision-log.md` (initialised by Block 0.2)
**Eval harness outputs:** `C:\Legito Test\legito-annotator-csharp\eval\blocks\{block-id}\before.md` and `after.md`
**Grand-review re-run outputs:** `C:\Legito Test\legito-annotator-csharp\eval\grand-review\{block-id}-rerun.md`

**Implementer never edits:**
- Master plan (you or a master-plan revision dispatch).
- Sibling Blocks' files (scope lock).
- Legito spec (`Legito_Markup_Language_2026.docx`).
- Training corpus (`legito-markup-pipeline/training/*.json`).

---

## What to dispatch RIGHT NOW

**Next action:** `/dispatch-plan 0.1` in this terminal.

When the subplan lands (`~/.claude-work/plans/subplans/0.1-eval-set-creation.md`), you'll have:
- A scoped implementation spec.
- An environment-facts section pre-verified against your current repo state.
- A ship gate stated as a numeric condition (20 manifest entries, language-band counts correct).

Then open a new terminal, navigate to `C:\Legito Test\`, and:
```
/execute-plan C:\Users\edous\.claude-work\plans\subplans\0.1-eval-set-creation.md
```

Then come back here and `/grand-review` when the implementer commits.

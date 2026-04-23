# Master Plan — Teaching Gemma4 to Understand .docx Like Claude Code

**Type:** Master plan / reference architecture. Not an implementation spec.
**Purpose:** Source of truth from which parallel subplans derive. Each Block below is a bounded dispatch target for a separate Claude Code session.
**Deliverable of this plan:** not code — this plan. Subplans (via the local `legito:dispatch-plan` skill) consume this and produce single-track implementation specs.
**Revision:** r3 — 3-pass architecture + tool use + generalised rules library, post Gemma 4 verification (2026-04-23). Supersedes r2. Supporting design doc: `docs/gemma-annotator-3pass-design.md`.

---

## Context

The C# annotator at `C:\Legito Test\legito-annotator-csharp\` calls Gemma4:26b via Ollama to annotate `.docx` uploads with Legito Markup Language. User feedback:

> "The LLM isn't properly scanning the document content and doing the annotations. It doesn't have the proper skill/prompts to do it. You are treating it programmatically instead of learning the LLM to do what we need."

> "Training match is bullshit. We must do better to properly annotate ANY future document uploaded."

Documents like `IC_dispečink_final.docx` carry 19 author comments that describe EXACT annotation logic (`"Výběr ANO/NE"`, `"Tento odstavec se zobrazuje, pokud je v atributu X vybráno Y"`) and inline `atribut „X"` highlighted markers showing WHERE elements go — the LLM emits rule-pattern-matched TextInputs instead of the obvious Switchers and Clauses the author asked for. The fix is a rewrite of how we prompt the LLM and a shift in where intelligence lives in the pipeline.

This master plan synthesizes three parallel research briefs produced in the planning session:

- **Brief A** — Codebase inventory (annotator pipeline, prompts, passes, Python tools, training corpus, recent failure modes)
- **Brief B** — Ollama/Gemma effective-prompting research (CoT→JSON evidence, Gemma quirks, sampler tuning, chunking vs candidate extraction, position bias)
- **Brief C** — Claude Code patterns translatable to Gemma (skill architecture, teaching-over-rules, red-flag-first, single-shot compression of the agentic loop)

Every claim below cites its brief via `[A]` / `[B]` / `[C]` markers.

---

## 1. Executive TL;DR

Three-phase architectural shift, largest-ROI-first. Each Phase contains multiple Blocks; Blocks within a Phase are parallelizable after the Phase's gates clear.

| Phase | Scope | Parallelizable? | Expected impact |
|---|---|---|---|
| **Phase 0 — Foundation (measurement floor)** | Build a reproducible eval harness + dual-mode baseline (single-shot + 3-pass stub) + expanded 4D sampler/tools/thinking A/B grid | 3 Blocks fully parallel after P0 kickoff | Enables "did we improve?" on every subsequent change; anchors every architectural claim in measured numbers |
| **Phase 1 — Foundation Fixes** | Config retune including `NumCtx` bump to native 262144 + system-prompt split into three per-pass prompts + training-match policy tightening | 3 Blocks parallel after Phase 0 gate clears | Reduces known regressions: label-word sysnames, hallucinated `[Text:…]`, cross-language mismatches; unlocks large-doc headroom; drops JSON-repair retry rate |
| **Phase 2 — 3-Pass Pipeline** | Generalised multilingual rules library (`data/skills/` with 30–50 granular files spanning 12 first-class languages + language-agnostic core) + pipeline orchestrator with three per-pass prompts + native tool-call schemas and deterministic retrieval step | 3 Blocks with 1 dependency chain | Pass 1 intake → Pass 2 retrieve+map → Pass 3 annotate, each narrowly focused; LLM-driven rule retrieval replaces regex-feature composition; native Gemma 4 thinking + tools replace prompted CoT + freeform JSON |
| **Phase 3 — Validation Migration + Tool Hardening** | Pre-filter rules migrated into tool-call parameter validation where cheaper + tool-call reliability hardening (retries, repair, format:free fallback) | 2 Blocks parallel | Removes duplicate validation in code; preserves freeform JSON fallback for document classes where tool-call parsing falters |
| **Phase 4 — Iteration & Hardening** | Per-skill refinement, red-flag catalogue expansion, eval set expansion | Fully parallel, long-running | Compounds phases 0–3 gains; maintains metric floor as Legito spec evolves |

**Headline claim**: Gemma 4:26b carries native `tools`, native `thinking`, and a 262144-token context window — verified via `/api/show` on 2026-04-23. The 3-pass architecture makes each pass's job narrow enough that those native capabilities can hit production quality without the agentic-loop limits that motivated the "approaches 70% of Claude" framing in r2. How close we actually get on the fixed eval set is an empirical question answered by Block 0.2's dual-mode baseline + Block 0.3's 4D A/B grid, not a literature-derived estimate. Single-shot is the Phase 1 baseline, not the ultimate target.

---

## 2. Scope Boundaries

**In scope**:
- Single-model single-call pipeline via Ollama `/api/chat` with `gemma4:26b` (the only model installed on the production host). [A §4]
- `.docx` inputs; Czech / English / German / Polish / French / Spanish primary. [A §7, NormalizeLanguage in PromptBuilder.cs]
- Output: `{"replacements":[…]}` JSON that the existing Python `docx_annotator.py apply` phase consumes.
- Existing validation passes (Propagate*, ResolveDeadLinks, DropOrphanDeclarations) stay where they are; only rule-based pre-filters are candidates for migration into the prompt (Phase 3).

**Out of scope**:
- Multi-turn agentic loops. Ollama `/api/chat` has no persistent session state; no cost-feasible way to emulate Claude Code's Gather→Act→Verify loop in one request. [C §6 gap 5]
- Model swap (Qwen / DeepSeek / unquantised Gemma). Production host has `gemma4:26b` only. Revisit when infra changes.
- Fine-tuning on the 119 training records. Post-prompt-ceiling consideration.
- Tool-use / function-calling via Ollama. Gemma Q4 tool-calling is documented unreliable [B §6]; freeform JSON with repair is cheaper.

**Model identity (resolved)**: upstream `/api/tags` confirms `gemma4:26b` is the installed tag (verified via direct curl to `https://eu-infra-ai1.legito.com/api/tags` in the planning session). Brief B's "probably Gemma 3" caveat is closed — all recommendations apply to `gemma4:26b` as installed.

---

## 3. Current Pipeline Anatomy (Shared Reference)

Authoritative map, to be cited from every subplan. [A §1]

```
POST /  (AnnotateEndpoint.cs:18)
  → LlmAnnotationService.AnnotateAsync  (LlmAnnotationService.cs:39)
      1. Save upload to temp .docx
      2. python docx_annotator.py extract → JSON                     [A §5]
      3. DetectLanguage(extractJson)                                  [A §2]
      4. CompressExtract(extractJson) → compressedExtract
         • inlines 💬 COMMENT and ⚑ ATRIBUT-MARKERS per paragraph
           (committed fc26413, planning session)                      [A §2]
      5. ClassifyComments(extractJson) → classifiedComments           [A §2]
      6. PromptBuilder.FindBestTrainingMatch(compressed, language)    [A §2]
         • language gate (-50pt cross-lang), threshold 50 same-lang
         • returns null for unseen docs → digest-only fallback
      7. Build user message = digest + training-match + extract
      8. OllamaClient.ChatCompletionAsync
         gemma4:26b, temp=0, seed=42, num_ctx=65536,
         top_p=0.9, repeat_penalty=1.15, num_predict=32768,
         think=false, format=free                                     [A §4]
      9. ExtractReplacementsJson() + JSON-repair retry
     10. ValidateReplacements (pre-filter drop rules)                 [A §3]
     11. PropagateClauseConditions / PropagateSwitcherConditions /
         PropagateCellSwitcherConditions                              [A §3]
     12. DeduplicateOverlappingSwitchers / ...Questions               [A §3]
     13. ResolveDeadLinks, DropOrphanDeclarations                     [A §3]
     14. python docx_annotator.py apply → annotated .docx             [A §5]
     15. Return bytes
```

§3 describes the pre-r3 pipeline and stays canonical for Phase 0 + Phase 1 baseline measurements. Every "before" side of every eval-set delta table references §3. Phase 2 Blocks (2.1, 2.2, 2.3) replace steps 7–9 with the §3b 3-pass flow described below.

---

## 3b. Pipeline Anatomy (r3 — 3-Pass) (Shared Reference)

Post-Block 2.2, steps 7–9 of §3 are replaced by the 3-pass flow. Steps 1–6 (extract, classify comments, compress, language detect) and steps 10–15 (validate, propagate, apply) are unchanged.

```
Steps 1–6 from §3 run unchanged.
  ↓
Pass 1 — Intake
  POST /api/chat  (gemma4:26b, think:true, tools:[classify_document])
    input: compressedExtract + classification-prompt
    output: tool_call classify_document(language, domain, size_band,
              template_family, markup_convention_hints[])
  ↓
Deterministic orchestrator:
  writes Pass 1 classification to decision log; passes it to Pass 2
  ↓
Pass 2 — Retrieve + Map
  POST /api/chat  (gemma4:26b, think:true, tools:[emit_analysis])
    input: full extract + Pass 1 classification + rules-library index
    output: tool_call emit_analysis(selected_rules[], logic_map[],
              retrieval_reasoning, new_convention_notes?)
  ↓
Deterministic retrieval step (code):
  reads each data/skills/<name>.md referenced by selected_rules[]
  concatenates into the Pass 3 prompt prefix
  ↓
Pass 3 — Annotate
  POST /api/chat  (gemma4:26b, think:true, tools:[emit_textinput,
    emit_switcher, emit_select, emit_question, emit_date, emit_money,
    emit_calculation, emit_link, emit_clause, emit_button, emit_text])
    input: full extract + retrieved rules + logic_map + emit-discipline prompt
    output: tool_calls[] — one call per annotation
  ↓
Orchestrator aggregates tool_calls[] → {"replacements":[…]} shape
  ↓
Steps 10–15 from §3 run unchanged (validate/propagate/apply).
```

Properties carried from §3b into every downstream Block:

- The `<analysis>…</analysis>` wrapper from §6.7 is subsumed by native `think:true`; §6.7 remains valid for the pre-Block-2.2 era only.
- `format:free` + JSON-repair is superseded by native tool-call parsing at Ollama layer. Block 3.4 owns the format:free fallback when tool-call parsing fails on specific document classes.
- `NumCtx: 262144` is the Phase 1 target (Block 1.1). All three passes run at native context.
- All three passes share a language identification: Pass 1's `language` field is authoritative for downstream retrieval and for per-language metric slicing in eval reports.

See `docs/gemma-annotator-3pass-design.md` for the WHY behind each pass, tool schemas, and retrieval rationale.

---

## 4. Catalogued Failure Modes (Shared Reference)

Taxonomy — each item has an originating block that addresses it. [A §8 observations from commits 05d0f72, 932bedc, fc26413 + planning-session runs on IC_dispečink]

### 4.1 Retrieval errors
- **F-R1**: Cross-language training match (English will-trustee scored 90.8 for Czech film contractor). Mitigated: language gate. **Owned by**: Block 1.3
- **F-R2**: Same-language wrong-domain match (Czech real-estate purchase scored 74 for Czech film contractor → polluted style/sysnames). **Owned by**: Block 1.3

### 4.2 Structural misreads
- **F-S1**: Heading-as-TextInput. **Owned by**: Block 2.1 (`structural-heading-redflag` skill) + Block 2.2's Pass 2 logic_map (paragraph classified `heading` gets no annotation candidate)
- **F-S2**: Signature-line false positive (LLM annotates handwritten-sig slot). **Owned by**: Block 2.1 (`signature-line-redflag` skill)
- **F-S3**: Over-propagation (Clause `is turned on` continues past article headings). Observed on IC_dispečink. **Owned by**: Block 2.1 (`switcher-optional-section` skill with explicit stop rule)

### 4.3 Grammar errors
- **F-G1**: Double-bracket `[[TextInput...]]`. **Owned by**: Block 1.2 (system-prompt red-flag)
- **F-G2**: Label-word sysnames (`whereas`, `between`, `now-this-agreement-witnesses-as-follows`). **Owned by**: Block 1.2 + Block 2.1 (`atribut-marker` skill)
- **F-G3**: `atribut „X"` marker text kept in paragraph when emitting Switcher. **Owned by**: Block 2.1 (`switcher-optional-section` skill teaches `delete_text:true`)

### 4.4 Propagation errors
- **F-P1**: Clause propagation without stop rule. **Owned by**: Block 2.1 skill + Block 3.3 (validation-pass migration where cheaper in the tool-schema layer)
- **F-P2**: Sysname typos breaking Legito auto-binding (`autorska-dlovzka` vs gold `autorska-dolozka`). **Owned by**: Block 2.1 (`atribut-marker` skill with kebab-case-strict rule)

**Gap Q-BASELINE**: occurrence rate per 100 annotations of each failure mode. **Owned by**: Block 0.2.

---

## 5. The Gemma Capability Ceiling (Shared Reference)

Honest statement, so no Block oversells. Revised r3 per `/api/show gemma4:26b` output on 2026-04-23 — several r2 "cannot" items were downgraded. Full verified-facts excerpt in `docs/gemma-annotator-3pass-design.md §1`.

**Cannot do in a single /api/chat call:**
1. No RLHF-learned discipline for Legito-specific conventions. Every prompt must re-state its domain discipline.
2. No multi-step tool use WITH FEEDBACK. A single request emits a batch of tool calls but cannot observe-and-adapt mid-batch (no second API round trip inside one request). Multi-turn orchestration is always operator-driven between requests.
3. No context awareness. Cannot self-report remaining token budget.
4. No persistent session state. Each request is independent.

**Native capabilities (verified via `/api/show`, require empirical validation on Q4_K_M + our domain):**
- **Native tool use**: `capabilities: ['tools']`. Ollama ships native `gemma4` tool-call parser. Empirical question Q-TOOLS (Block 0.3): schema-adherence reliability on Q4 quantization for our 11 emit tools.
- **Native thinking**: `capabilities: ['thinking']`. Gemma 4 emits a dedicated reasoning channel when `think:true`. Replaces r2's `<analysis>…</analysis>` wrapper hack. Empirical question Q-THINK (Block 0.3): does native thinking beat prompted CoT on our structural-analysis tasks?
- **256K native context**: `model_info.gemma4.context_length: 262144`. Four times the r2-era `NumCtx: 65536`. Empirical question Q-CTX (Block 0.3 + Block 1.1): attention quality across the full window on our document shapes; VRAM headroom operator-verified live.

**Can match given strong prompting** [C §7]:
- Structured thinking before output (native `think:true` or prompted CoT, depending on Block 0.3 outcome)
- Red-flag avoidance when flags are concrete with examples
- Spec adherence when spec is in context and referenced explicitly
- Uncertainty reporting (a `confidence` field per replacement, or tool-schema `confidence` param)
- Document-structure analysis (paragraph indexing, table discovery, placeholder detection)

**Design stance**: every prompt module encodes discipline explicitly because Gemma cannot be expected to re-derive it across requests. Where Gemma 4 carries a native capability (tools, thinking, 256K context) we use it rather than re-prompting for it, pending Block 0.3 empirical verification.

---

## 6. Design Principles (Cross-Block Invariants)

Every Block below must respect these. Subplans derived from this master inherit them verbatim.

### 6.1 Teaching-over-rules hybrid doctrine

Every non-trivial instruction appears as the triple:

> **WHY** (narrative one-liner — the reason)
> **MUST / MUST-NOT** (explicit imperative)
> **ONE MICRO-EXAMPLE** (concrete snippet, correct + wrong)

Pure narrative Gemma skips. Pure rules encode today's bugs. The hybrid is what Claude Code skills use. [C §9]

### 6.2 Thinking triggers before output triggers

Red flags come BEFORE positive instructions in every prompt section. Claude Code's `PRIORITY 0` pattern, directly translated. [C §3]

### 6.3 Lost-in-the-middle placement

Critical rules and output format go at START and END of the prompt. The document extract goes in the MIDDLE. Training-digest excerpts never go in the middle. [B §5, Liu et al. 2023]

### 6.4 Principle-based beats example-rich

Zero-shot with the spec + 3–4 micro-examples beats few-shot with full training records. Cross-domain examples pollute Gemma's output style. [B §4, A §8]

### 6.5 Gemma has no system role

Ollama folds `"role":"system"` into the first user turn. There is no separation. Put everything into one user-turn prompt with XML section tags (`<rules>`, `<red_flags>`, `<input>`, `<examples>`, `<output_format>`). Skip "You are…" persona. [B §3]

### 6.6 No time estimates in derived subplans

User CLAUDE.md rule (`C:\Legito Test\CLAUDE.md`): "NEVER give time estimates". Subplans describe WHAT needs doing, not HOW LONG. Sequencing uses dependency order, not calendar order.

### 6.7 CoT → JSON single-call output pattern (post-Block 2.2)

Once Block 2.2 ships, every subsequent LLM response is `<analysis>…</analysis>\n{"replacements":[…]}` in a single `/api/chat` call. Every Block from 2.2 forward — whether it touches the parser, logs LLM responses, tests JSON extraction, adds a new red flag, or runs the eval harness — MUST respect this envelope:

- `ExtractReplacementsJson` strips the `<analysis>…</analysis>` region before attempting JSON parse.
- JSON-repair retries still apply to the post-analysis region only.
- Eval harness logs the analysis region alongside the JSON so parse-failure diagnostics remain actionable.
- Skill files and training micro-examples may reference the `<analysis>` expectation but must not duplicate the wrapper instruction — the system prompt owns the single statement of the rule. [B §1]

Before Block 2.2 ships, responses are raw JSON and this principle does not apply. Subplans for Blocks 2.3 through 4.x carry this as an environment fact to confirm at gap-verification time (has Block 2.2 shipped? If no, the subplan's parser expectations reflect the pre-CoT state).

### 6.8 Native capabilities over prompt hacks

Gemma 4's `/api/show` output declares `tools` and `thinking` in `capabilities` and 262144 as `context_length`. Where a native capability exists AND empirical A/B (Block 0.3) confirms it works on our domain at Q4_K_M, prefer the native path:

- **Native `think:true` over prompted `<analysis>…</analysis>`** — the native reasoning channel is separate from the response body; no parsing of the response to strip analysis blocks. §6.7 remains the contract for the pre-Block-2.2 era.
- **Native `tools:` with schema-validated parameters over freeform JSON with repair** — the Ollama server validates tool-call schema before the response returns, removing the JSON-repair retry path.
- **`NumCtx: 262144` over sliding-window or document chunking** — the document fits in one request. Chunking was never implemented (Brief B §7 argued against it); this principle removes any temptation to add it.

Empirical caveat: "native capability exists" is not "native capability works". Block 0.3 owns the A/B verification (Q-TOOLS, Q-THINK, Q-CTX). If a capability fails its gate, the fallback is the prompt-hack path; that's what Block 3.4's `format:free` fallback exists to cover.

### 6.9 Banking smoke-test mandatory for every Gemma-calling Block

Every Block from 0.3 onward that calls Gemma MUST pass the 5-point smoke test on `1. Banking & Finance - facility agreement (redacted).docx` before ship. Aggregate eval-set metrics do not substitute. The doc's combination of 55 pages, heavy legal boilerplate, bilingual clauses, and long conditional chains exercises all five critical failure surfaces:

1. Request completes within HTTP timeout (no silent slowdown).
2. Output `.docx` is a valid Office Open XML package (python-docx can open it).
3. Zero `FORMTEXT` legacy form-field wrappers leak into the output.
4. Zero `w:ins`/`w:del` tracked-change wrappers leak into the output.
5. Per-element recall on this specific document is within ±2pp of the pre-change baseline for the same doc.

Full checklist verbatim at §17.F. Source: `MEMORY.md feedback_banking_smoke_test.md`.

---

## 7. Phase 0 — Foundation (Measurement Floor)

Phase 0 gate: Blocks 0.1 + 0.2 + 0.3 all land. Downstream Phases cannot ship without these.

### Block 0.1 — Eval Set Creation

**Purpose**: Build a reproducible 20-document gold eval set so every downstream Block can measure delta.

**Inputs**:
- Existing reannotated gold at `C:\Legito Test\legito-markup-pipeline\reannotated\*_annotated.docx` (~15 candidates)
- Input docs at `C:\Legito Test\legito-annotator-csharp\llmannotator\input\*.docx` and `C:\Legito Test\legito-markup-pipeline\input\*.docx`
- Training corpus for language/domain coverage at `C:\Legito Test\legito-markup-pipeline\training\*.json`

**Deliverables**:
- Directory `C:\Legito Test\legito-markup-pipeline\eval\` containing 20 gold pairs
- `eval/manifest.json` — per-doc metadata (language, domain, size band, source of gold)
- `eval/README.md` — how to add / regenerate gold

**Spec** (§10 of the planning roadmap, expanded):
- 20 contracts: Czech (5), English (5), German (3), Polish (3), Spanish (2), French (2)
- Domains: contractor agreement, NDA, mortgage, facility letter, appeal, retail banking, trust/will, IT services
- Size bands: 6 short (<15 pages), 10 medium (15–30 pages), 4 long (>30 pages)
- Each doc has: original `.docx`, gold `_annotated.docx`, and a JSON extract of gold annotations for diffing

**Ship gate**: manifest validates (20 entries, all `.docx` files exist, gold extract loads without errors), languages meet target counts.

**Parallelizable with**: Block 0.3 (sampler grid can start once this block has 10+ gold pairs ready).

**Depends on**: nothing (Phase 0 entry point).

**Open Q-EVALSET**: adopt existing reannotated as gold for 15 docs + curate 5 new? Default YES unless user raises quality concerns.

---

### Block 0.2 — Dual-Mode Baseline Metrics Capture

**Purpose**: Establish the numbers every Block measures delta against, for BOTH the current single-shot pipeline AND a future 3-pass pipeline stub. Without the dual baseline there is no defensible comparison when Phase 2 ships; "3-pass is better" without a measured single-shot-vs-3-pass delta on the same gold is a literature-derived estimate, not a result.

**Inputs**:
- Eval set from Block 0.1 (blocker — needs ≥10 docs to be useful)
- Current `master` + `feature/annotator-v2-rewrite` branches
- `docs/gemma-annotator-3pass-design.md` §3 — to stub the 3-pass pipeline at r3-dispatch time even though Phase 2 has not yet shipped

**Deliverables**:
- `scripts/evaluate.py` — harness that runs the annotator across the eval set and diffs against gold; supports `--mode single-shot|3-pass-stub` flag
- `scripts/requirements.txt` — Python tooling dependency pin. Minimum pins: `python-docx==1.2.0` (the version `MEMORY.md` confirms is installed and that `docx_annotator.py` was authored against). Every Python-touching Block cites this file as its environment fact.
- `eval/baseline/master-single-shot.json` — metrics dump on current master pipeline (§3 flow)
- `eval/baseline/master-3-pass-stub.json` — metrics dump using a 3-pass STUB orchestrator (all three Ollama calls, minimal prompts, basic tool schemas — enough to measure a lower-bound 3-pass baseline before Phase 2's full skill library + orchestrator land)
- `eval/baseline/dual-mode-delta.md` — per-metric comparison of the two modes; Phase 2 blocks reference this as the "we started here with the stub" anchor
- `eval/baseline/feature-annotator-v2-rewrite.json` — metrics on current feature branch (single-shot only; r3 supersedes the v2-rewrite direction)
- `eval/baseline/README.md` — how to re-run, how to add a new mode when Phase 2 ships
- `eval/baseline/claude-head-to-head.md` — head-to-head benchmark (Q-GEMMAVSCLAUDE, must-have): 5 eval-set docs annotated by Claude Code (manual single-shot session) vs. current Gemma annotator on BOTH modes. Anchors any "Gemma approaches X% of Claude quality" claim with actual data.
- `docs/decision-log.md` — initialised here; schema per §17.D; appended by every Block that makes a configuration choice. Phase 0 populates first entries: evaluation-harness version, baseline-snapshot commit hashes, Claude head-to-head setup parameters, 3-pass-stub configuration.

**Metrics captured** (per mode):
- Recall per element type (`count_ours / count_gold`)
- Precision per element type (`correct_ours / count_ours`)
- Sysname fidelity rate (emitted sysnames matching gold kebab-case convention)
- Propagation accuracy rate (Clause conditions whose propagation range matches gold)
- Red-flag violation rate per flag in the catalogue (§4)
- JSON / tool-call parse-failure rate (`ExtractReplacementsJson` repair retries for single-shot; Ollama tool-parse rejections for 3-pass-stub)
- Apply-failure rate (how often python-docx apply couldn't find `original_text`)
- **Per-pass metrics (3-pass mode only)**: Pass 1 classification accuracy (vs Block 0.1 manifest), Pass 2 logic-map recall (logic_map entries with correct element type / gold elements), Pass 2 rule-selection F1 (selected_rules vs hand-labelled expected rules on 5 docs), Pass 3 annotation recall

**Ship gate**: `scripts/evaluate.py` runs to completion in both modes, emits Markdown metrics reports executable repeatedly without manual steps; `scripts/requirements.txt` pins exist and `pip install -r` succeeds on a clean checkout; `claude-head-to-head.md` reports per-metric Claude-vs-Gemma deltas on 5 eval docs in both modes; `dual-mode-delta.md` shows the per-metric single-shot-vs-3-pass-stub delta as the Phase 2 anchor.

**Parallelizable with**: Block 0.3 (once harness exists, sampler A/B can reuse it in either mode).

**Depends on**: Block 0.1.

**Banking smoke-test gate**: passes the §17.F 5-point check on `1. Banking & Finance - facility agreement (redacted).docx` in both modes before ship. Per §6.9.

---

### Block 0.3 — Expanded 4D A/B Grid (Sampler × Tools × Thinking × Context)

**Purpose**: Validate — on OUR domain at Q4_K_M — the four empirical questions r3 depends on. Each dimension has a defensible prior but no measurement; Block 0.3 produces the measurement before Phase 2 ships the architectural commitment.

**Inputs**:
- Eval set + harness from Block 0.1, 0.2 (dual-mode supported)
- Brief B §8, §9 sampler recommendations (baseline for the T × rp sub-grid)
- `docs/gemma-annotator-3pass-design.md` §9 (the empirical questions enumerated)
- Server-shipped defaults per `/api/show`: `temperature: 1`, `top_k: 64`, `top_p: 0.95`

**Deliverables**:
- `eval/sampler-grid/` directory with one subdirectory per config tried; each config's runs, per-doc metrics, and tool-call logs
- `eval/sampler-grid/summary.md` — aggregate metrics per config, sliced by config dimension
- `eval/sampler-grid/parallel-tool-calls.md` — smoke-test on a doc with 50+ annotations: whether Gemma 4 emits all calls in one `tool_calls[]` array or needs multi-turn. Answers Q-PARALLEL-TOOLS.
- `eval/sampler-grid/num-ctx-ab.md` — A/B on `NumCtx: 65536` vs `NumCtx: 262144` on the eval set, with the banking doc as the stress case. Answers Q-CTX attention-quality half (VRAM headroom is Block 1.1's operator check).
- Decision-log entries: one per dimension, citing measured evidence for the winner.

**Grid** (4D, sub-gridded for feasibility):
- **Dim A — sampler**: temperature ∈ {0.0, 0.1, 1.0} × repeat_penalty ∈ {1.0, 1.05, 1.15}. 9 configs. Top_p fixed at 0.95 (server default); seed fixed at 42.
- **Dim B — tools**: `tools:[…]` with 3-pass schemas vs `format:free` with prompted JSON. 2 configs.
- **Dim C — thinking**: `think:true` vs `think:false` (latter with prompted CoT `<analysis>…</analysis>`). 2 configs.
- **Dim D — num_ctx**: `65536` vs `262144`. 2 configs.

Full cross = 9 × 2 × 2 × 2 = 72 configs. Cross-product is infeasible; run the two sub-grids separately:
1. **Sampler sub-grid**: 9 configs × `tools:true + think:true + num_ctx:262144` × eval subset (5 docs) = 45 runs. Picks winning (T, rp) pair.
2. **Architectural sub-grid**: 8 configs (2 × 2 × 2) for tools/thinking/num_ctx × winning (T, rp) from sub-grid 1 × eval subset (5 docs) = 40 runs.
3. **Parallel-tool-call smoke test**: separate, 1 doc (50+ annotations expected), 1 run.
4. **Winner validation**: full eval set (20 docs) × single winning config = 20 runs.

Eval subset (5 docs): 2 Czech, 2 English, 1 German (same as r2 Block 0.3). Banking doc included in the 20-doc winner-validation pass.

**Ship gate**: 
1. Sampler sub-grid selects a (T, rp) pair that meets or beats current `master` on parse-failure rate AND per-element recall in both modes (single-shot, 3-pass-stub).
2. Architectural sub-grid reports defensible winners per Q-TOOLS, Q-THINK, Q-CTX with measured deltas (not literature-derived). If tools reduce parse-failure rate by ≥ X pp AND do not hurt recall by > Y pp, tools wins. If thinking beats prompted CoT on sysname-fidelity AND structural-misread rate, thinking wins. If `num_ctx:262144` does not regress recall on docs that fit in 65536 AND unlocks recall on the banking doc's mid-window paragraphs, the bump wins.
3. Parallel-tool-call smoke test answers: single-batch or multi-turn. Block 2.2 scoping depends on this.
4. Banking smoke-test (§17.F) passes with the selected winning config across all four dimensions.

**Parallelizable with**: Block 0.1 (once 10 gold pairs exist) and Block 0.2 (can reuse harness in either mode).

**Depends on**: Block 0.1 (≥10 gold pairs), Block 0.2 (harness with dual mode + tool-call support).

**Open Q-0.3-LOCK**: lock the winning 4D config as-is, or re-run the architectural sub-grid on the full 20-doc set? Default: lock if architectural-sub-grid deltas are directionally consistent across all 5 subset docs; re-run on full 20 otherwise.

---

## 8. Phase 1 — Foundation Fixes (Parallel After Phase 0 Gate)

Phase 1 gate: all three Blocks land with metric-delta evidence.

### Block 1.1 — Config Retune (Sampler + NumCtx + Tools + Thinking)

**Purpose**: Apply the Block 0.3 4D winning config as the production default. This includes the sampler winner (T, rp), the tools on/off decision, the thinking on/off decision, and the `NumCtx` bump to 262144 (full Gemma 4 native). All four dimensions ship together because they were A/B-validated together.

**Inputs**:
- Block 0.3 decision log (4 dimension winners + supporting metrics)
- `src/LegitoAnnotator.Api/appsettings.json`
- `src/LegitoAnnotator.Api/Models/LlmAnnotationOptions.cs`

**Deliverables**:
- `appsettings.json` `LlmAnnotation` section updated with winning config across all 4 dimensions: `Temperature`, `RepeatPenalty`, `Tools` (on/off feature flag), `Think` (on/off feature flag), `NumCtx: 262144`.
- `LlmAnnotationOptions.cs` defaults updated to match; config properties added for `Tools` and `Think` if not already present.
- Decision-log entry citing the 4 A/B winners.
- VRAM headroom live check: `ollama ps` and `nvidia-smi` output captured in commit body. The check confirms actual KV-cache footprint at 262144 context fits within the 2×40GB VRAM budget with the 18GB model weights. If live check shows insufficient headroom, Block 1.1 halts and reports to the operator for infrastructure decisions (add VRAM, tune Ollama tensor-parallelism, or accept a temporary smaller window under a fresh operator order). No silent degrade in code.

**Ship gate**:
- `scripts/evaluate.py` on full eval set (both modes, whichever the Phase 1 winner is) shows parse-failure rate strictly drops vs Block 0.2 baseline; no per-element recall regression >5% on any language.
- Banking smoke-test (§17.F) passes.
- VRAM headroom check passes (committed evidence).

**Parallelizable with**: Block 1.2, Block 1.3 (independent files).

**Depends on**: Block 0.3.

**Open Q-CTX**: VRAM headroom at 262144 on production host — if live check fails, this Block halts and escalates.

---

### Block 1.2 — System Prompts Rewrite (Three Per-Pass Prompts)

**Purpose**: Replace the single monolithic `data/system-prompt.md` with three narrowly-focused per-pass prompts — one for Pass 1 intake, one for Pass 2 retrieve+map, one for Pass 3 annotate. Each prompt carries only the discipline relevant to its pass, restructured per §6 into XML-delimited sections with red flags first, principle-based + micro-examples beating rule enumeration, critical rules bracketing the variable sections (lost-in-the-middle countermeasure).

**Inputs**:
- Current `data/system-prompt.md` (source of rule content to be distributed across the three new prompts)
- `docs/gemma-annotator-3pass-design.md` §3 (per-pass input/output contracts + tool schemas per pass)
- §6.1 (teaching-over-rules triple), §6.2 (red flags first), §6.3 (lost-in-middle), §6.4 (principle-based), §6.5 (XML sections, no persona), §6.8 (native capabilities over prompt hacks)
- §4 Failure Mode Catalogue (source of red-flag content; each flag goes in the pass whose tool can enforce it — signature-line goes in Pass 3 `emit_textinput` red flags, heading-as-TextInput goes in Pass 2 logic_map guidance, etc.)
- Legito Markup Language spec: `C:\Legito Test\Legito_Markup_Language_2026.docx`

**Deliverables** — three new files, replacing the single `data/system-prompt.md`:
1. `data/system-prompt-pass1-intake.md` — classification discipline. Sections: `<priority_0>` (don't emit annotations, only classify), `<task>`, `<language_hints>` (per-language idiom clues from rules-library), `<classification_schema>` (`classify_document` tool parameter spec), `<examples>` (2–3 classified micro-docs), `<input>`, `<output_format>` (tool call), `<final_reminders>`. Target ~600 tokens.
2. `data/system-prompt-pass2-retrieve-map.md` — retrieval + logic-map discipline. Sections: `<priority_0_red_flags>` (headings are not annotations; signatures are not annotations; label-word sysnames forbidden), `<task>`, `<rules_library_index>` (variable — the skill-name + one-liner index from Block 2.1), `<logic_map_schema>` (`emit_analysis` tool parameter spec), `<retrieval_examples>` (3 micro-examples: CS document triggers {atribut-marker, switcher-optional-section, author-comment-priority}; AR document triggers {atribut-marker, rtl-handling}; EN banking document triggers {clause-condition, money-field, cross-reference-link}), `<input>`, `<output_format>`, `<final_reminders>`. Target ~1500 tokens.
3. `data/system-prompt-pass3-annotate.md` — per-element emit discipline. Sections: `<priority_0_red_flags>` (no `[[…]]`; no label-word sysnames; no hallucinated `[Text:…]`; no signature-line TextInput; atribut-marker text gets `delete_text:true`), `<task>`, `<annotation_types>` (11 elements as one-line syntax + one micro-example each), `<rules>` (core invariants — sysname kebab, condition operators, placement modes, option-string fidelity), `<retrieved_rules>` (variable — the skill files selected by Pass 2), `<logic_map>` (variable — Pass 2's output), `<examples>` (3–4 micro-examples — Switcher+Clauses, Question+Clauses, Select options, Link reuse; NOT full training docs), `<input>`, `<output_format>` (tool-calls or JSON per Block 1.1 mode), `<final_reminders>` (repeats 3 most-violated rules). Target ~2500 tokens.

The PRIORITY 0 comment/atribut-marker section (landed fc26413) is preserved and distributed: atribut markers are a Pass 2 rules-library retrieval signal AND a Pass 3 emit discipline; author comments guide Pass 2 classification. Every failure mode in §4 appears as a red flag in the pass whose tool can enforce it.

**Token budgets (final, after Block 0.3 Q-CTX resolution)**: all three prompts operate at `NumCtx: 262144`. Per-pass fixed + variable budget:
- Pass 1 fixed ~600 + variable (compressed extract, up to ~8K).
- Pass 2 fixed ~1500 + variable (full extract up to ~80K + rules-library index ~800).
- Pass 3 fixed ~2500 + variable (full extract up to ~80K + retrieved rules up to ~5K + logic_map up to ~3K).

**Ship gate**: eval-set metrics show red-flag violation rate drops on `signature-line`, `label-word-sysname`, `[[…]]`, `hallucinated-text`; no per-element recall regression vs Block 0.2 3-pass-stub baseline; banking smoke-test passes.

**Parallelizable with**: Block 1.1, Block 1.3 (independent files).

**Depends on**: Block 0.2 (dual-mode baseline metrics); Block 1.1 (mode + NumCtx locked so prompt-length budget is known).

**Open Q-NUMCTX resolved**: Block 0.3 Q-CTX A/B confirmed Ollama's `num_ctx` covers prompt+response at 262144 with measurable recall impact; no further verification needed in this Block.

---

### Block 1.3 — Training-Match Policy Tightening

**Purpose**: Current state already has language gate (−50pt cross-lang) and threshold 50 (landed `932bedc`). Harden further: inline ONE micro-example (5–15 lines) from the matched record selected by pattern-family, not wholesale replacement-list inlining.

**Inputs**:
- Current `PromptBuilder.cs::FindBestTrainingMatch`
- Training corpus at `legito-markup-pipeline/training/*.json`
- Feature detection results from Block 2.3's composer (forward dependency — this Block should defer the "by pattern-family" piece until Block 2.3 ships, OR implement a stub family-detector here)

**Deliverables**:
- `PromptBuilder.cs` changes that replace the full-replacement-list inlining with micro-example selection by pattern family (Switcher+Clauses, Question+Clauses, TextInput-with-label, Link-reuse)
- A curated set of ~15 micro-examples committed at `data/training-microexamples/{pattern-family}.md`
- Documentation of the selection algorithm in the commit body

**Ship gate**: eval-set metrics show cross-language mismatch rate drops to 0% on a synthetic stress-test (submit a Czech doc, verify no English micro-example appears in the prompt); sysname-fidelity rate improves on Czech/Polish docs.

**Parallelizable with**: Block 1.1, Block 1.2.

**Depends on**: Block 0.2.

---

## 9. Phase 2 — 3-Pass Pipeline

Phase 2 gate: Blocks 2.1 + 2.2 + 2.3 land, with Block 2.2 integrating 2.1's output and 2.3's tool schemas.

Blocks in this phase land in order 2.1 → 2.3 → 2.2 (rules library + tool schemas must exist before the orchestrator consumes them).

### Block 2.1 — Generalised Multilingual Rules Library

**Purpose**: Build `data/skills/` as the LLM-readable rules library Pass 2 retrieves from. Replace the r2 9-file English-biased inventory with a 30–50-file library structured as language-agnostic core + 12 first-class language-specific idiom files. The library is consumed by Pass 2 via its index (skill names + one-line descriptions ≤800 tokens total) and by the Pass 3 prompt via concatenation of selected skill files.

**Inputs**:
- §6 design principles (skills must respect them)
- §4 failure mode catalogue (sources for MUST-NOT sections)
- Legito Markup Language spec
- Training corpus (source for EXAMPLE sections per language)
- `docs/gemma-annotator-3pass-design.md` §8 (rules-library generalisation rationale)

**Deliverables** — structured library at `C:\Legito Test\legito-annotator-csharp\data\skills\`:

**Language-agnostic core** (~20 files; examples, not exhaustive):
| File | Covers |
|---|---|
| `atribut-marker.md` | F-G2, F-P2 (explicit `atribut „X"` markers → sysname + delete_text) |
| `switcher-optional-section.md` | F-S3, F-G3 (Switcher + Clauses with stop-propagation) |
| `question-variant-block.md` | Variant-block pattern (Czech `výběr „A"` / English `option A` / equivalent in any language) |
| `select-with-options.md` | Select with options listed in author comment |
| `textinput-label-colon.md` | `Label:` paragraph → TextInput |
| `signature-line-redflag.md` | F-S2 (signature-line false positive) |
| `structural-heading-redflag.md` | F-S1 (heading-as-TextInput) |
| `link-reuse.md` | Second+ occurrence of defined field → `[Link:sysname]` |
| `author-comment-priority.md` | Author comments override inference |
| `highlighted-run.md` | Yellow/colored highlighted run → placeholder |
| `underscore-run.md` | `_{3,}` run → placeholder (non-signature) |
| `bracket-placeholder.md` | `[placeholder]` / `{placeholder}` → TextInput |
| `empty-table-cell.md` | Empty cell adjacent to label cell → TextInput |
| `money-field.md` | Amount-with-currency pattern → Money |
| `date-field.md` | Date pattern → Date |
| `calculation-field.md` | Formula pattern → Calculation |
| `clause-condition.md` | Paragraph-level conditions → Clause |
| `cross-reference-link.md` | Cross-reference to defined element → Link |
| `legito-marker-hash.md` | `#N=…#` / `#Choice X(Y)#` / `#Option N – In or Out#` Legito markers |
| `button-action.md` | Button-labelled paragraph → Button |

**Language-specific idioms** (12 files, one per first-class language: CS, EN, DE, PL, ES, FR, IT, NL, PT, RO, BG, AR):
| File | Covers |
|---|---|
| `lang-cs.md` | Czech ODER/NEBO, atribut-marker Czech idioms, Czech kebab transliteration rules, comment-phrase triggers |
| `lang-en.md` | English OR variants, signature-line conventions, typical heading patterns |
| `lang-de.md` | German ODER variants, compound-noun sysname handling, comment-phrase triggers |
| `lang-pl.md` | Polish LUB variants, special-character transliteration (ł, ś, ź, ż) |
| `lang-es.md` | Spanish O variants, comment-phrase triggers |
| `lang-fr.md` | French OU variants, gendered-noun sysname handling |
| `lang-it.md` | Italian O/OPPURE variants |
| `lang-nl.md` | Dutch OF variants |
| `lang-pt.md` | Portuguese OU variants, PT-BR vs PT-PT kebab conventions |
| `lang-ro.md` | Romanian SAU variants |
| `lang-bg.md` | Bulgarian ИЛИ variants, Cyrillic transliteration to kebab |
| `lang-ar.md` | Arabic أو variants, RTL direction handling, Arabic-to-latin kebab conventions |

**Index file**: `data/skills/index.md` — name + one-line description per skill, total ≤800 tokens. Pass 2 receives this in its prompt; no skill-file bodies are loaded at Pass 2. Pass 2 selects skills by name; the retrieval step (owned by Block 2.2) loads the bodies into the Pass 3 prompt.

**Per-skill SKILL.md structure** (see §17.A for schema):
- frontmatter: `name`, `description` (trigger — Pass 2's selection signal), `spec_version: Legito_Markup_Language_2026`, `token_budget: ≤400` (up from r2's ≤300 because language-specific examples require more room), `applies_to_languages: [agnostic|cs|en|…]`
- body: `## WHY` → `## MUST` → `## MUST-NOT` → `## EXAMPLE` (language-agnostic core carries one example per applicable major language pattern; language-specific files carry one example in that language)

**Ship gate**: 
- Library contains ≥30 skill files (core + 12 language-specific at minimum; expansion into the 30–50 target band is Block 4.1 territory).
- Each skill file ≤400 tokens; each cites at least one failure mode from §4 or a documented language idiom.
- `index.md` ≤800 tokens, machine-parseable (name + one-line description per entry).
- Skill-lint script (created in this Block) passes on the full set: all files have valid frontmatter, bodies follow the 4-section structure, no skill references a non-existent failure mode, language tags are from the valid set.
- Per-language smoke test: one hand-crafted synthetic doc per language in `eval/synthetic-lang-test/` is annotated end-to-end; per-language annotation recall reports a baseline number in the decision log. No pass/fail gate on this number — it establishes where the library starts and where Block 4.1 must lift it.

**Parallelizable with**: Block 2.3 (schemas and retrieval code are separate from rules library content).

**Depends on**: Phase 1 (Block 1.2 authored the three per-pass prompts that reference the rules library structure).

---

### Block 2.3 — Tool-Call Schemas + Retrieval Step

**Purpose**: Author the native Gemma 4 tool schemas for all three passes (1 schema for Pass 1, 1 schema for Pass 2, 11 schemas for Pass 3), and implement the deterministic retrieval step that consumes Pass 2's `selected_rules[]` output and loads the matching `data/skills/*.md` files into the Pass 3 prompt. Shipping 2.3 before 2.2 ensures the orchestrator has schemas + retrieval to wire against.

**Inputs**:
- `docs/gemma-annotator-3pass-design.md` §3 (per-pass tool-call semantics) + §5 (schema-enforced rationale)
- Legito Markup Language spec (for the 11 element-emit tool param schemas)
- Block 2.1 rules library + `index.md`
- Ollama tool-calling docs

**Deliverables**:
- `src/LegitoAnnotator.Api/Models/ToolSchemas/*.cs` — one file per tool, each exposing a static `OllamaToolDefinition` record that matches the Ollama `tools[]` schema format:
  - `ClassifyDocumentTool.cs` (Pass 1)
  - `EmitAnalysisTool.cs` (Pass 2)
  - `EmitTextInputTool.cs`, `EmitSwitcherTool.cs`, `EmitSelectTool.cs`, `EmitQuestionTool.cs`, `EmitDateTool.cs`, `EmitMoneyTool.cs`, `EmitCalculationTool.cs`, `EmitLinkTool.cs`, `EmitClauseTool.cs`, `EmitButtonTool.cs`, `EmitTextTool.cs` (Pass 3)
- `src/LegitoAnnotator.Api/Services/RulesLibraryRetrievalService.cs` — the deterministic retrieval step. Reads `data/skills/index.md` at startup; for a given `selected_rules[]` list, loads each matching skill file, concatenates into the Pass 3 prompt prefix with section markers.
- Registration of all tools + retrieval service in `Program.cs`.
- Unit tests for the retrieval step: selecting 0 skills returns empty prefix; selecting 5 skills loads 5 concatenated bodies in the order specified; selecting a non-existent skill name is logged and skipped (not fatal).
- `data/skills/README.md` — how to add a new skill file + frontmatter rules + how the retrieval step consumes it.

**Ship gate**:
- All 13 tool schemas validate against Ollama's `/api/chat` tool-parameter format (one smoke call per tool confirming the server accepts it; output logged).
- Retrieval step unit tests pass.
- Integration: a manual end-to-end run on one eval-set doc with all three passes (using minimal stub prompts pre-Block-2.2) emits valid tool calls at every pass and produces annotation output that parses into the `{"replacements":[…]}` shape.
- Banking smoke-test passes on the integration path.

**Parallelizable with**: Block 2.1.

**Depends on**: Phase 1 (Block 1.1's config decision about tools on/off determines whether this Block ships as-is or stays dark behind a feature flag).

---

### Block 2.2 — Pipeline Orchestrator + Three System Prompts Wired

**Purpose**: Implement the C# code that chains the three `/api/chat` calls, passes outputs forward (Pass 1 classification → Pass 2 input; Pass 2 selected_rules → retrieval step → Pass 3 prompt prefix; Pass 2 logic_map → Pass 3 prompt), and aggregates Pass 3 `tool_calls[]` into the `{"replacements":[…]}` shape the existing apply step consumes. Wire the three per-pass system prompts (Block 1.2) and the tool schemas (Block 2.3) into this orchestrator.

**Inputs**:
- Block 2.1 rules library
- Block 2.3 tool schemas + retrieval service
- Block 1.2 three per-pass prompts
- Current `LlmAnnotationService.cs::AnnotateAsync` (pre-Phase 2 single-shot flow — becomes the fallback mode)
- Block 0.3 Q-PARALLEL-TOOLS decision: single-batch vs multi-turn tool-call orchestration

**Deliverables**:
- `src/LegitoAnnotator.Api/Services/ThreePassOrchestrator.cs` — owns the three-call chain:
  1. `RunPass1Async(extract)` → returns `Pass1Classification` (language, domain, size_band, markup_convention_hints).
  2. `RunPass2Async(extract, pass1, rulesIndex)` → returns `Pass2Analysis` (selected_rules, logic_map, new_convention_notes).
  3. `RunPass3Async(extract, retrievedRules, logicMap)` → returns `List<Replacement>` aggregated from `tool_calls[]`.
- `LlmAnnotationService.cs::AnnotateAsync` updated to route to `ThreePassOrchestrator` when the Block 1.1 feature flag `Use3PassPipeline` is on. Falls back to the single-shot path when off (Block 3.4 owns the fallback logic).
- Per-pass logging: each pass logs its input-token count, tool-call count, and elapsed time. Eval harness reports these as per-pass metrics (§17.C appendix additions).
- If Q-PARALLEL-TOOLS resolved to single-batch: Pass 3 expects all emit calls in one response `tool_calls[]` array.
- If Q-PARALLEL-TOOLS resolved to multi-turn: Pass 3 emits calls in rounds until it emits no tool calls and a signal-complete call; orchestrator loops.

**Ship gate**:
- Eval-set metrics (full 20 docs, both modes for comparison) show per-element recall ≥ the Phase 1 single-shot baseline + eval-delta-per-block target from Block 0.2 `dual-mode-delta.md` (the target is defined by the measured 3-pass-stub baseline; the shipped 3-pass orchestrator must beat its own stub).
- No prompt exceeds `NumCtx: 262144` even on the banking doc.
- Banking smoke-test passes.
- Per-pass metrics show: Pass 1 classification accuracy ≥85% (vs Block 0.1 manifest), Pass 2 logic-map recall ≥80% (vs gold on the eval-set subset with hand-labelled logic-map), Pass 2 rule-selection F1 ≥0.7 on the same subset, Pass 3 annotation recall ≥ the Phase 1 baseline.

**Parallelizable with**: nothing (this Block integrates 2.1 + 2.3 and consumes 1.2's prompts).

**Depends on**: Block 2.1, Block 2.3, Block 1.2.

**Open Q-RULES-INDEX-SIZE**: what Pass 2 index token budget does Gemma 4 at Q4_K_M retrieve well from? Target ≤800 tokens; if measured selection F1 <0.7 at that size, revisit and either compress descriptions or split the index into doc-language-aware shards.

---

## 10. Phase 3 — Validation Migration + Tool-Call Hardening

Phase 3 gate: Blocks 3.3 + 3.4 both land with per-Block ship-gate evidence. The two Blocks are parallel; Phase 3 is gated when BOTH have cleared their own ship gates on the full eval set.

Number preservation: this Phase retains identifiers 3.3 and 3.4 (not renumbered to 3.1 and 3.2). The numeric gaps are intentional — they encode that earlier numbered work was considered and decided against during the r2 → r3 planning pass. Cross-repo references to the r2 3.3 commit history remain stable under this Block.

### Block 3.3 — Validation Pass Migration into Tool Schemas

**Purpose**: Move pre-filter validation rules that can be stated in <30 words + an example into Pass 3's tool-schema parameter validation where native `tools:true` enforces them at Ollama parse time, OR into the per-element skill-file red flags consumed by Pass 3's prompt. Keep graph-traversal passes in code.

**Inputs**:
- Current pre-filter rules in `LlmAnnotationService.cs::ValidateReplacements`
- Block 2.1 rules library (targets for prompt-level red-flag migration)
- Block 2.3 tool schemas (targets for parameter-level validation migration)

**Migration targets**:

| Rule | Migration target | Rationale |
|---|---|---|
| Hallucinated `[Text:…]` drop | `emit_text` tool schema: require `system_name` and `label` params; Pass 3 prompt red flag in `author-comment-priority` | Schema rejects emit calls without required params |
| Switcher-suffix TextInput drop | `switcher-optional-section` skill red flag + `emit_textinput` tool schema: param validation rejects TextInput whose `original_text` overlaps with a prior `emit_switcher` call's range | Ollama enforces at parse time |
| Signature-line TextInput drop | `signature-line-redflag` skill red flag | Prompt-level; no schema param can encode "looks like a signature line" |
| Duplicate sysname Select/TextInput drop | `emit_textinput`/`emit_select` tool schema: orchestrator-level uniqueness check on `system_name` across all Pass 3 tool calls | Deterministic post-Pass-3 check in ThreePassOrchestrator |

**Keep in code** (unchanged — no migration candidate):
- `PropagateClauseConditions` / `PropagateSwitcherConditions` / `PropagateCellSwitcherConditions`
- `ResolveDeadLinks`
- `DropOrphanDeclarations`
- `DeduplicateOverlappingSwitchers` / `…Questions`

**Deliverables**:
- One PR per rule migrated (4 PRs)
- Each PR: prompt change OR tool-schema change + code change (pre-filter rule gated behind feature flag, not yet deleted)
- Eval metrics per-rule: `count_prompt_or_schema_caught / count_code_caught`
- When `caught_in_newpath ≥ caught_in_code` on the full eval set for 3 consecutive runs, a follow-up PR deletes the code pre-filter

**Ship gate per rule**: new-path catch rate ≥ code catch rate on 3 consecutive eval runs (temp/seed/prompt unchanged). Banking smoke-test passes with each rule migrated.

**Parallelizable with**: Block 3.4.

**Depends on**: Block 2.1 (skills must exist), Block 2.3 (tool schemas must exist), Block 2.2 (orchestrator is the code location for the schema-level rules).

---

### Block 3.4 — Tool-Call Reliability Hardening (+ format:free Fallback)

**Purpose**: The tool-calling path (Block 2.2 + 2.3) ships as the default on the assumption that Block 0.3 Q-TOOLS confirmed it works. On specific documents — expected to be rare but non-zero — Gemma 4 at Q4_K_M may emit malformed tool calls that the Ollama parser rejects. Block 3.4 adds retry, repair, and a per-pass `format:free` fallback so a single hard document cannot break annotation.

**Inputs**:
- Block 2.2 orchestrator
- Block 0.3 parse-failure-rate measurements per config
- `docs/gemma-annotator-3pass-design.md` §5 (tool-use rationale + fallback design)

**Deliverables**:
- `src/LegitoAnnotator.Api/Services/ToolCallRetryPolicy.cs` — retry logic: on Ollama-reported tool-parse failure, retry once with a jittered seed at `tools:true`; if second attempt also fails, fall back to `format:free` with a prompted JSON emit schema embedded in the user message.
- `LlmAnnotationOptions.cs` — feature flag `ToolCallRetryEnabled` (default on), `ToolCallFormatFreeFallbackEnabled` (default on), `ToolCallRetryAttemptCount` (default 1), `ToolCallFormatFreePromptTemplate` (the JSON-schema prompt used in fallback mode).
- `ThreePassOrchestrator` instrumented to emit structured logs per retry/fallback event: doc id, pass number, reason (`schema-mismatch`, `unknown-tool-name`, `truncated-response`, `empty-tool-calls`), recovery action taken (`retry-seed`, `format-free-fallback`, `gave-up`).
- Eval harness counts retries + fallbacks per doc + per pass + per config; new metric `tool_call_parse_failure_rate` (per pass) and `format_free_fallback_rate` (per pass).

**Ship gate**:
- Eval-set metrics show `tool_call_parse_failure_rate` ≤ the Block 0.3 measured rate on the same config (no regression from hardening).
- On the banking doc + any eval doc known to have triggered parse failures in Block 0.3 measurements, the pipeline produces annotation output using the fallback path without manual intervention.
- `format_free_fallback_rate` across the 20-doc eval set is ≤5% (if higher, the tools:true path is not actually production-ready and the decision log is updated to flag Block 2.2 for rework).
- Banking smoke-test (§17.F) passes.

**Parallelizable with**: Block 3.3.

**Depends on**: Block 2.2 (orchestrator is the integration surface), Block 2.3 (tool schemas define what a parse failure looks like).

---

## 11. Phase 4 — Iteration & Hardening (Continuous)

Phase 4 Blocks are long-running and parallel. They don't gate downstream phases; they sustain metric floor as the Legito spec evolves.

### Block 4.1 — Per-Skill Refinement Loop

**Purpose**: For any skill that underperforms on the eval set, iterate: add micro-examples, clarify red flags, adjust token budget.

**Inputs**: eval-set per-skill metrics from Block 0.2 harness.

**Deliverables**: skill file edits, commit per skill, metrics delta in commit body.

**Ship gate per skill update**: ≥5 percentage-point improvement on the affected failure mode's violation rate; no regression on unaffected docs.

---

### Block 4.2 — Red-Flag Catalogue Expansion

**Purpose**: New failure modes surface over time. Each becomes a red flag in the appropriate skill.

**Inputs**: user-reported issues, eval-set delta outliers.

**Deliverables**: per-issue: new red flag added to the right skill; eval harness extended with the new metric.

---

### Block 4.3 — Eval Set Expansion

**Purpose**: Grow the eval set from 20 to 50 docs over time, cover underrepresented languages/domains/sizes.

**Ship gate per expansion**: new docs pass baseline metrics before being added (no regression detectors bad gold).

---

## 12. Cross-Cutting Concerns

### 12.1 Risks

| Risk | Mitigation | Owned by |
|---|---|---|
| Prompt bloat past `NumCtx: 262144` | 3-pass decomposition narrows per-pass prompt; Pass 3 only loads retrieved rules (not full library); per-skill token cap ≤400 | Block 2.1 + Block 2.2 |
| Gemma 4 tool-calling unreliable on Q4_K_M for this domain | Block 0.3 A/B verifies before commit; Block 3.4 preserves `format:free` fallback behind feature flag; per-pass parse-failure rate logged and alerted on | Block 0.3 + Block 3.4 |
| VRAM headroom insufficient for 262144 context at live deployment | Block 1.1 live `ollama ps` + `nvidia-smi` headroom check halts and reports to operator if actual headroom is short; fix is an operator infra decision (add GPU, tune Ollama tensor-parallelism, or accept a temporary smaller window under a fresh operator order); no silent degrade in code | Block 1.1 |
| Pass 2 rule retrieval selects wrong skills | Block 2.2 ship gate on Pass 2 rule-selection F1 ≥0.7; log all retrieval_reasoning and sample for Block 4.1 refinement; `new_convention_notes` captures out-of-library conventions for Pass 3 to adapt | Block 2.2 + Block 4.1 |
| Native `think:true` produces low-quality reasoning on Q4_K_M | Block 0.3 Q-THINK A/B: if think:true loses to prompted CoT, Block 1.1 keeps think:false and Block 2.2 reintroduces the `<analysis>` wrapper per §6.7 | Block 0.3 |
| Retiring validation passes too aggressively | Feature-flag migration; delete code only when new-path catch rate ≥ code catch rate on 3 consecutive runs | Block 3.3 |
| Sampler retune over-indexed on general literature | Block 0.3 A/B on our domain before locking; sub-grid with architectural dimensions cross-checked | Block 0.3 |
| Skill files drift from the spec | Frontmatter `spec_version:` pinned; skill-lint script greps for conflicts; `applies_to_languages:` tags enforced | Block 2.1 |
| Eval set under-represents a pattern family or language | Add pattern-family + language tags to `eval/manifest.json` (Block 0.1); per-language smoke-test docs at `eval/synthetic-lang-test/` (Block 2.1); Block 4.3 coverage-checked expansion prioritises under-represented families/languages | Block 0.1 + Block 2.1 + Block 4.3 |
| Dependency drift in Python tooling | Pin `python-docx` and harness deps in `scripts/requirements.txt`; Block 0.2 bootstraps the file; every Python-touching Block's environment-facts section re-asserts the pinned version | Block 0.2 |

### 12.2 What We Are Deliberately NOT Copying from Claude Code

- Tool-use feedback loops — a single request emits a batch of tool calls, but we do not observe-and-adapt mid-batch. Multi-turn orchestration happens between requests, driven by the 3-pass orchestrator (Block 2.2), not inside a single `/api/chat` call.
- Adaptive thinking budget — `think:true` is binary (on/off) per request; we do not steer budget dynamically.
- Multi-turn self-correction — no conversation memory across requests. Each pass is stateless input → stateless output.
- Reading arbitrary files mid-task — Gemma sees only the pre-assembled prompt. The retrieval step (Block 2.3) runs deterministically in C#, not in the LLM.

Removed from r2's list: "no tool use" (Gemma 4 has native `tools`; used per §6.8 pending Block 0.3 verification) and "no extended-thinking mode" (Gemma 4 has native `thinking`; used per §6.8 pending Block 0.3 verification).

### 12.3 Rollback protocol

Every Block lands as one commit on `feature/annotator-v2-rewrite` (per `C:\Legito Test\CLAUDE.md`). If a later Block's Grand Review (Mode B) finds that an earlier Block introduced a regression on a metric not covered by its own ship gate:

1. **Isolate**: identify the offending Block's commit hash via `git log --oneline` and the Grand Review's eval-delta rerun.
2. **Revert**: `git revert {hash}` — creates a new commit that undoes the change. Do NOT `git reset --hard`; downstream Blocks may depend on commits after the offender.
3. **Re-baseline**: re-run `scripts/evaluate.py --branch HEAD --out eval/revert-baseline/{block-id}.md` to confirm metrics recover to pre-Block state.
4. **Re-dispatch**: file a new subplan via `/dispatch-plan {Block-id}` with §Plan corrections explicitly citing the regression that caused the revert, and a sharpened ship gate that would have caught the missed metric.
5. **Audit**: the Block's commit body's eval-delta table (captured by execute-plan) is the before-state reference for the revert; if the table was fabricated, the revert cannot proceed confidently and the Block's PR must be reviewed manually before any new dispatch.

Reverts are cheap and reversible; the cost of not reverting is metric drift across subsequent Blocks. Prefer revert + redo over patching forward.

### 12.4 Future Work (Post-Phase 3, not in this master plan)

- **Model upgrade paths**: Qwen 3, Llama 4, DeepSeek-R1 (or whatever current reasoning-native open-weight family leads at the time) all have stronger JSON discipline and native reasoning modes than gemma4:26b-Q4. Revisit at each Phase boundary, and when infra allows multi-model hosting. [B §6]
- **Fine-tune on the 119 training records**: single-epoch LoRA on `{user → assistant_json}` pairs could reduce the prompt's need to teach Legito syntax.
- **Reinforcement from author feedback**: `reviews/` folder has human corrections usable as preference-learning signal.
- **First-pass speculation / parallel passes**: can Pass 1 classification run in parallel with retrieval of universally-needed language-agnostic skills, overlapping latency? Out of scope for r3; optimization candidate for Phase 4.
- **Unquantised Gemma 4 or higher-parameter Gemma 4 variant** on upgraded infra: would let the Phase 2 pipeline skip the Block 0.3 Q-TOOLS / Q-THINK Q4_K_M reliability concerns.

### 12.5 Banking smoke-test mandatory for every Gemma-calling Block

Per §6.9 and `MEMORY.md feedback_banking_smoke_test.md`: every Block from 0.3 onward that calls Gemma passes the 5-point smoke test on `1. Banking & Finance - facility agreement (redacted).docx` before ship. The 5 checks are:

1. Request completes within `OllamaClient` HTTP timeout.
2. Output `.docx` is a valid Office Open XML package (`python-docx` opens it).
3. Zero `FORMTEXT` legacy form-field wrappers in the output.
4. Zero `w:ins`/`w:del` tracked-change wrappers in the output.
5. Per-element recall on this specific document is within ±2pp of the pre-change baseline for the same document.

Aggregate eval metrics are not a substitute. A Block whose aggregate recall improved while banking recall dropped more than 2pp does NOT ship. Full checklist verbatim at §17.F.

---

## 13. Block Dependency Graph

```
Phase 0 (Foundation)
  Block 0.1 (Eval Set) ──┬─→ Block 0.2 (Dual-Mode Baseline) ──┬→ Phase 1 gate
                         └─→ Block 0.3 (4D A/B Grid: sampler ×)┘
                              tools × thinking × num_ctx
                                      ↓
Phase 1 (Foundation Fixes — all three parallel)
  ┌─ Block 1.1 (Config Retune: sampler + tools + thinking + NumCtx 262144) ─┐
  ├─ Block 1.2 (Three per-pass system prompts authored) ────────────────────┤
  └─ Block 1.3 (Training-Match policy tightening) ──────────────────────────┘
                  ↓ (Phase 1 gate)
Phase 2 (3-Pass Pipeline)
  Block 2.1 (Generalised Rules Library: 30–50 skills, 12 languages + core)
       │
       └──────┐
              ↓
  Block 2.3 (Tool-Call Schemas + Retrieval Step)
              ↓
  Block 2.2 (Pipeline Orchestrator + Prompts Wired) ──→ Phase 2 gate
                  ↓
Phase 3 (Validation + Tool Hardening)
  ┌─ Block 3.3 (Validation Pass Migration into Tool Schemas) ────┐
  └─ Block 3.4 (Tool-Call Reliability Hardening + Fallback) ─────┘
                                                            Phase 3 gate
                  ↓
Phase 4 (Iteration — continuous)
  Block 4.1 / 4.2 / 4.3 (all parallel, ongoing)
```

Subplans derive from a single Block each. A subplan's title is `{Phase}.{Block}` (e.g., `1.2` = System Prompts Rewrite). Block identifiers 3.1 and 3.2 are not used in r3 — the candidate-extractor design and implementation that r2 planned under those numbers is fully subsumed by Pass 2's `logic_map` in the Phase 2 pipeline, so no Block fills those slots. The numeric gaps are intentional.

---

## 14. Open Questions Inventory

| ID | Question | Blocking Block | Proposed default |
|---|---|---|---|
| **Q-EVALSET** | Adopt existing `reannotated/` gold for 15 eval docs + curate 5 new? | Block 0.1 | Adopt + curate; user-confirmed |
| **Q-BASELINE** | Per-failure-mode occurrence rate on current master (both modes) | Block 0.2 | Run once per mode; log in `eval/baseline/` |
| **Q-TOOLS** | Tool-call reliability on `gemma4:26b` at Q4_K_M for this domain — does it emit all annotations in one `tool_calls[]` array, or need multi-turn? Does schema adherence hold under long-context pressure? | Block 0.3 | Default to tools:true if Q4_K_M measurements are within 10% of format:free recall; keep format:free as fallback behind feature flag |
| **Q-THINK** | Does `think:true` beat prompted CoT (`<analysis>` wrapper) for Pass 3 annotation quality on our Legito documents? | Block 0.3 | Default to think:true if measurements beat prompted CoT on sysname-fidelity AND structural-misread rate; else keep think:false and reintroduce §6.7 wrapper |
| **Q-CTX** | VRAM headroom at `NumCtx: 262144` on the production host — does operator-confirmed 2×40GB VRAM budget hold under live KV-cache footprint? Does attention quality hold across the full 256K window on our document shapes? | Block 1.1 (VRAM live-check) + Block 0.3 (attention A/B) | Live check halts if insufficient; attention A/B locks in winning NumCtx |
| **Q-PARALLEL-TOOLS** | Does Gemma 4 emit all Pass 3 annotations in one `tool_calls[]` array, or does the orchestrator need to loop multiple turns until emit count stabilises? | Block 0.3 smoke-test | Measure on a doc with 50+ annotations; Block 2.2 scoping follows the answer |
| **Q-LANG** | Which languages does Gemma 4 handle competently without training examples in our rules library? | Block 2.1 per-language smoke tests | Smoke-test 12 first-class + 4 representative non-first-class languages on synthetic docs; per-language recall reported in decision log without a gate |
| **Q-RULES-INDEX-SIZE** | What Pass 2 index token budget does Gemma 4 at Q4_K_M retrieve from reliably? | Block 2.2 ship gate | Target ≤800 tokens; if Pass 2 rule-selection F1 <0.7 at that size, revisit |
| **Q-PARALLEL-PASSES** | Can Pass 1 run in parallel with retrieval of universally-needed language-agnostic skills? | Out of r3 scope | Optimization candidate for Phase 4 (§12.4) |
| **Q-GEMMAVSCLAUDE** | Head-to-head benchmark on 5 eval-set docs — Claude Code (manual single-shot) vs. current Gemma annotator on both modes; anchors any "Gemma approaches X% of Claude quality" claim with real data | Block 0.2 (must-have) | Run during Block 0.2 and commit `eval/baseline/claude-head-to-head.md` |
| **Q-MODELTAG** | ~~Is installed model `gemma4:26b` or `gemma3:27b`?~~ | Closed | `gemma4:26b` per `/api/tags` and `/api/show` 2026-04-23 |

---

## 15. Critical File Paths Master Index

### Created in Phase 0
- `C:\Legito Test\legito-annotator-csharp\scripts\evaluate.py` (Block 0.2)
- `C:\Legito Test\legito-annotator-csharp\scripts\requirements.txt` (Block 0.2; pins `python-docx==1.2.0` and any other harness deps)
- `C:\Legito Test\legito-markup-pipeline\eval\` (Block 0.1, gold set + manifest + README)
- `C:\Legito Test\legito-annotator-csharp\eval\baseline\` (Block 0.2 outputs, including `claude-head-to-head.md`)
- `C:\Legito Test\legito-annotator-csharp\eval\sampler-grid\` (Block 0.3 outputs)
- `C:\Legito Test\docs\decision-log.md` (Block 0.2 initialises; schema §17.D; appended by every Block making a config choice)

### Edited in Phase 1
- `C:\Legito Test\legito-annotator-csharp\src\LegitoAnnotator.Api\appsettings.json` (Block 1.1)
- `C:\Legito Test\legito-annotator-csharp\src\LegitoAnnotator.Api\Models\LlmAnnotationOptions.cs` (Block 1.1)
- `C:\Legito Test\legito-annotator-csharp\data\system-prompt.md` (Block 1.2)
- `C:\Legito Test\legito-annotator-csharp\src\LegitoAnnotator.Api\Services\PromptBuilder.cs` (Block 1.3)

### Created in Phase 1
- `C:\Legito Test\legito-annotator-csharp\data\training-microexamples\{pattern-family}.md` (Block 1.3 authors the base set of ~15 micro-examples; Block 2.1 may extend during Phase 2)

### Edited in Phase 1 (added in r3)
- `C:\Legito Test\legito-annotator-csharp\src\LegitoAnnotator.Api\appsettings.json` (Block 1.1 — Tools, Think feature flags; NumCtx bump to 262144)
- `C:\Legito Test\legito-annotator-csharp\src\LegitoAnnotator.Api\Models\LlmAnnotationOptions.cs` (Block 1.1 — matching defaults for Tools + Think)

### Created in Phase 1 (replacing `data/system-prompt.md`)
- `C:\Legito Test\legito-annotator-csharp\data\system-prompt-pass1-intake.md` (Block 1.2)
- `C:\Legito Test\legito-annotator-csharp\data\system-prompt-pass2-retrieve-map.md` (Block 1.2)
- `C:\Legito Test\legito-annotator-csharp\data\system-prompt-pass3-annotate.md` (Block 1.2)

### Edited in Phase 2
- `C:\Legito Test\legito-annotator-csharp\src\LegitoAnnotator.Api\Services\LlmAnnotationService.cs` (Block 2.2 — route to orchestrator when feature flag on)
- `C:\Legito Test\legito-annotator-csharp\src\LegitoAnnotator.Api\Program.cs` (Block 2.3 — register tool schemas + retrieval service; Block 2.2 — register orchestrator)

### Created in Phase 2
- `C:\Legito Test\legito-annotator-csharp\data\skills\*.md` (Block 2.1; 30+ skill files across language-agnostic core + 12 first-class language-specific idiom files + README + linter)
- `C:\Legito Test\legito-annotator-csharp\data\skills\index.md` (Block 2.1 — Pass 2 retrieval index, ≤800 tokens)
- `C:\Legito Test\legito-annotator-csharp\src\LegitoAnnotator.Api\Models\ToolSchemas\*.cs` (Block 2.3; 13 tool schemas — Pass 1, Pass 2, Pass 3 × 11 elements)
- `C:\Legito Test\legito-annotator-csharp\src\LegitoAnnotator.Api\Services\RulesLibraryRetrievalService.cs` (Block 2.3)
- `C:\Legito Test\legito-annotator-csharp\src\LegitoAnnotator.Api\Services\ThreePassOrchestrator.cs` (Block 2.2)
- `C:\Legito Test\legito-markup-pipeline\eval\synthetic-lang-test\*.docx` (Block 2.1 — per-language smoke-test synthetic docs)

### Created in Phase 3
- `C:\Legito Test\legito-annotator-csharp\src\LegitoAnnotator.Api\Services\ToolCallRetryPolicy.cs` (Block 3.4 — retry + format:free fallback)

### Design / Reference (added in r3)
- `C:\Legito Test\docs\gemma-annotator-3pass-design.md` — supporting design doc for r3 (WHY behind 3-pass, tool-use, thinking, 256K context, rules library generalisation)

### Reference (read-only across all Blocks)
- `C:\Legito Test\Legito_Markup_Language_2026.docx` — spec source of truth
- `C:\Legito Test\legito-annotator-csharp\src\LegitoAnnotator.Api\Services\Detectors\*.cs` — reuse for candidate extraction
- `C:\Legito Test\legito-annotator-csharp\data\training-digest.md` — corpus digest
- `C:\Legito Test\legito-markup-pipeline\training\*.json` — source for micro-examples
- `C:\Legito Test\legito-markup-pipeline\reannotated\*_annotated.docx` — gold candidates for eval set

---

## 16. External Citations (Full)

**Internal (this planning session)**:
- Brief A — Codebase inventory (Explore agent)
- Brief B — Ollama/Gemma research (general-purpose agent)
- Brief C — Claude Code patterns (claude-code-guide agent)
- Synthesis outline (Plan agent)

**External**:
- Wei et al. 2022, "Chain-of-Thought Prompting Elicits Reasoning in Large Language Models", arXiv:2201.11903
- Kojima et al. 2022, "Large Language Models are Zero-Shot Reasoners", arXiv:2205.11916
- Liu et al. 2023, "Lost in the Middle: How Language Models Use Long Contexts", arXiv:2307.03172
- Brown et al. 2020, "Language Models are Few-Shot Learners", arXiv:2005.14165
- Min et al. 2022, "Rethinking the Role of Demonstrations", arXiv:2202.12837
- Wang et al. 2023, "Self-Consistency Improves Chain of Thought Reasoning", arXiv:2203.11171
- Yao et al. 2023, "Tree of Thoughts", arXiv:2305.10601
- Google DeepMind 2025, Gemma 3 Technical Report, `ai.google.dev/gemma/docs`
- Ollama docs: `github.com/ollama/ollama/blob/main/docs/api.md`
- OpenAI Structured Outputs announcement (Aug 2024)
- Anthropic Prompt Engineering docs: `docs.anthropic.com/en/docs/build-with-claude/prompt-engineering`
- Claude Code skills architecture: `code.claude.com/docs/en/skills.md`

**Commits that fed this master plan (in `feature/annotator-v2-rewrite`)**:
- `05d0f72` — anti-hallucination pre-filter (signature-line threshold + Switcher-suffix drop)
- `932bedc` — cross-language gate + Switcher/Clause pattern catalog in digest
- `fc26413` — inline `💬 COMMENT:` + `⚑ ATRIBUT-MARKERS:` rendering in CompressExtract
- Branch pushed to `gitlab/AI` MR #7

---

## 17. Appendices

### 17.A Skill file frontmatter spec

```yaml
---
name: <kebab-slug-of-skill>
description: |
  One-paragraph trigger statement. When this skill should be included in the
  prompt. Used by PromptBuilder's feature-based selector in Block 2.3.
spec_version: Legito_Markup_Language_2026
token_budget: ≤300
---
```

Body (all present, in order):
1. `## WHY` — narrative rationale, 1–3 sentences
2. `## MUST` — explicit imperative bullets
3. `## MUST-NOT` — red flags with reasons
4. `## EXAMPLE` — ONE micro-example, input + correct output, 5–20 lines

### 17.B Subplan Template (for dispatch-plan skill to fill)

```markdown
# Subplan {Phase}.{Block} — {Block Name}

## Context (link back to master)
Derives from master plan §{Phase.Block}. Read master § for shared references.

## Scope lock
### In scope (files to create/modify)
### Out of scope (sibling blocks' files)
### Reads-only allowlist

## Environment facts (PRE-VERIFIED by planner)
Each fact: `file:line` + quoted code + what the subagent expects.

## Implementation steps
Numbered, sequential, each with evidence line.

## Verification
Eval-set metrics expected, command to run, delta threshold.

## Commit
Explicit file list, `git pull --rebase`, DO NOT PUSH.

## STOP conditions

## Report-back format
```

### 17.C Metrics Catalogue (master)

| Metric | Definition | Reported by | Target direction |
|---|---|---|---|
| Recall per element type | `count_ours / count_gold` | `scripts/evaluate.py` | ↑ |
| Precision per element type | `correct_ours / count_ours` | same | ↑ |
| Sysname fidelity | fraction matching gold kebab | same | ↑ |
| Propagation accuracy | Clause propagation range matches gold | same | ↑ |
| Red-flag violation rate | per flag in §4 | same | ↓ |
| JSON parse-failure rate (single-shot mode) | repair retries / total requests | same | ↓ |
| Tool-call parse-failure rate (3-pass mode) | Ollama tool-schema rejections / total tool calls, per pass | same | ↓ |
| Format:free fallback rate (Block 3.4) | tool-call fallback events / total 3-pass runs | same | ≤5% |
| Apply-failure rate | failed find-and-replace / total | same | ↓ |
| Banking smoke-test (§17.F) — per-element recall | on banking doc vs pre-change baseline | same | within ±2pp |
| Pass 1 classification accuracy | `language_correct AND domain_correct / total` | same (3-pass) | ≥85% (Block 2.2 gate) |
| Pass 2 logic-map recall | logic_map entries with correct element type / gold elements | same (3-pass) | ≥80% (Block 2.2 gate) |
| Pass 2 rule-selection F1 | F1(selected_rules, hand-labelled expected) on 5-doc subset | same (3-pass) | ≥0.7 (Block 2.2 gate) |
| Pass 3 annotation recall | Pass 3 tool-call emit count vs gold | same (3-pass) | ≥ Phase 1 baseline (Block 2.2 gate) |
| Per-language annotation recall | recall sliced by Pass 1 `language` | same | baseline established in Block 2.1 synthetic smoke-test |
| IC_dispečink recall | elements ours / 52 gold | same | ≥70% (Block 2.2 gate) |
| Latency p50 / p95 end-to-end | full request including 3 passes | same | documented per Block; no fixed ceiling (3-pass is expected slower than single-shot) |
| Latency per pass | Pass 1 / Pass 2 / Pass 3 measured individually | same (3-pass) | logged for Block 4.1 refinement targeting |

### 17.D Decision Log Schema

For each Block that makes a configuration choice, log:

```
Block: {id}
Date: {ISO}
Decision: {one line}
Alternatives considered: {list}
Evidence: {metric numbers / file:line citations}
Reviewer: {user / grand-review skill}
```

Kept at `docs/decision-log.md`.

### 17.E Tool-call schemas (reference)

Full schema specifications are in `docs/gemma-annotator-3pass-design.md §3` (per-pass flow + signature) and `src/LegitoAnnotator.Api/Models/ToolSchemas/*.cs` (implementation). The summary:

**Pass 1 — 1 tool**:
- `classify_document(language, domain, size_band, template_family, markup_convention_hints[])`

**Pass 2 — 1 tool**:
- `emit_analysis(selected_rules[], logic_map[], retrieval_reasoning, new_convention_notes?)`

**Pass 3 — 11 tools** (one per Legito Markup Language element):
- `emit_textinput(original_text, system_name, label?, condition?)`
- `emit_switcher(original_text, system_name, label?, condition?)`
- `emit_select(original_text, system_name, options[], label?, condition?)`
- `emit_question(original_text, system_name, options[], label?, condition?)`
- `emit_date(original_text, system_name, label?, condition?)`
- `emit_money(original_text, system_name, label?, condition?)`
- `emit_calculation(original_text, formula, condition?)`
- `emit_link(system_name, condition?)`
- `emit_clause(original_text, condition, repeat?, delete_text?)`
- `emit_button(system_name, label?, condition?)`
- `emit_text(system_name, label?, condition?)`

All tool schemas are authored in Block 2.3 as Ollama `tools[]` entries. All parameter types follow JSON Schema draft-07. Required-vs-optional per element follows the Legito Markup Language 2026 spec.

### 17.F Banking smoke-test checklist (verbatim from `MEMORY.md feedback_banking_smoke_test.md`)

Every Block from 0.3 onward that calls Gemma MUST pass the following 5 checks on `1. Banking & Finance - facility agreement (redacted).docx` before ship. Aggregate eval metrics are NOT a substitute.

1. **No timeout**: the request completes within the `OllamaClient` default HTTP timeout.
2. **python-docx opens**: the output `.docx` can be loaded by `python-docx==1.2.0` without raising (valid Office Open XML package).
3. **0 FORMTEXT**: no `FORMTEXT` legacy form-field wrappers leak into the output. Verified via `docx_annotator.py extract` followed by grep for `FORMTEXT`.
4. **0 tracked-change wrappers**: no `w:ins` or `w:del` tracked-change wrappers leak into the output. Verified via `unzip -p {output}.docx word/document.xml | grep -c "w:ins\|w:del"` returning 0.
5. **Per-element recall ≥ baseline ±2pp**: per-element recall on the banking doc is within 2 percentage points of the pre-change baseline for the same document. Aggregate eval-set recall can be up while banking recall drops — the smoke test catches that and blocks the ship.

The banking doc is canonical because: 55 pages exercises mid-window attention at both `NumCtx: 65536` and `NumCtx: 262144`; bilingual English/German clauses exercise Pass 1 language classification and Pass 2 multi-language retrieval; long conditional chains exercise Pass 3 clause-condition propagation; heavy legal boilerplate exercises false-positive rate; real FORMTEXT and tracked-change content exists in source so checks 3 and 4 are non-trivial.

---

## Verification (this master plan)

- [x] No time estimates anywhere in the doc (CLAUDE.md rule)
- [x] Each Block has: inputs, deliverables, ship gate, parallelizable-with, depends-on
- [x] Dependency graph drawn (§13)
- [x] Open questions consolidated (§14)
- [x] File paths master-indexed (§15)
- [x] Citations to Briefs A/B/C inline throughout
- [x] Phase gates specified
- [x] Failure modes catalogued with owning Block (§4)
- [x] Cross-cutting risks tabulated (§12.1)
- [x] Design principles separated from Block-specific tactics (§6)
- [x] Subplan template present (§17.B)
- [x] Scope boundaries + out-of-scope explicit (§2)
- [x] Future work separated from in-scope work (§12.3)

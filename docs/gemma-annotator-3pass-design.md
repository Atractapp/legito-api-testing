# Gemma 4 3-Pass Architecture — Design Doc

> Supporting document for master plan r3. The master plan describes WHAT and WHEN; this doc describes WHY. Revision frozen at first author: 2026-04-23.

---

## 1. Verified Gemma 4 Facts

Source: `/api/show` against `https://eu-infra-ai1.legito.com` on 2026-04-23.

- **Tag**: `gemma4:26b`
- **Parameter size**: 25.8B
- **Quantization level**: Q4_K_M
- **Modified at**: 2026-04-08
- **Native context length**: `model_info.gemma4.context_length: 262144` (256K tokens)
- **Capabilities**: `['completion', 'vision', 'tools', 'thinking']`
- **Server-shipped defaults**: `temperature: 1`, `top_k: 64`, `top_p: 0.95`
- **Template renderer**: `gemma4` (Ollama ships native Gemma 4 chat template)
- **Parser**: `gemma4` (Ollama ships native Gemma 4 tool-call parser)

What those mean concretely:

- **`tools` in capabilities** — Ollama can surface a `tools:` array to Gemma 4, and Gemma 4 responds with `tool_calls` the server parses before returning. We do not implement a freeform-JSON-to-tool-call translator; the pipeline is native.
- **`thinking` in capabilities** — Gemma 4 emits a dedicated reasoning channel when `think:true`. This is separate from any prompted `<analysis>…</analysis>` wrapper, which becomes redundant when thinking mode is on.
- **262144 context length** — 256K tokens native. Documents that compressed to ~40–80K tokens for Gemma 3 fit inside a single request without truncation or sliding-window tricks.
- **Q4_K_M quantization** — none of the above capabilities have been empirically stress-tested on this specific domain at this specific quantization. Block 0.3's expanded A/B grid is the vehicle for empirical verification.

---

## 2. Current-config underutilization

From `C:\Legito Test\legito-annotator-csharp\src\LegitoAnnotator.Api\appsettings.json`:

- `NumCtx: 65536` — **25% of the 262144 native ceiling.**
- `Think: false` — thinking capability disabled.
- `Format: free` — freeform JSON, tools capability disabled.

Three configuration decisions inherited from the Gemma 3 era that leave 75% of the context budget, 100% of the thinking channel, and 100% of the native tool-call discipline unused. Master plan r3's Block 1.1 bumps `NumCtx` to 262144; Block 0.3 A/B-verifies `think:true` and `tools:true` before Block 2.2 ships them.

---

## 3. The 3-pass architecture

The r2 pipeline is single-call: one request gets the full document, all markup rules, all failure-mode red flags, and is expected to emit the complete annotation set in one response. That request carries hundreds of conflicting pressures — identify the document, pick retrieval rules, do structural analysis, emit per-element JSON, avoid sysname typos, respect lost-in-the-middle placement — and Gemma must juggle them in one pass of attention.

r3 decomposes this into three narrow-focus passes, each with its own system prompt, tool schema, and output contract.

### Pass 1 — Intake (LLM, compressed doc)

**Input**: compressed extract (paragraphs + classified comments + atribut markers) + a minimal system prompt about document classification.

**Tool**: single native tool `classify_document(language, domain, size_band, template_family, markup_convention_hints[])`.

**Output**: structured classification. `language` is the authoritative language tag for downstream retrieval; `markup_convention_hints` captures what the document's author signals about how annotations should be applied ("Výběr ANO/NE" style, "atribut „X"" markers, highlighted runs, etc.).

**Thinking**: `think:true`. Pass 1 is a classification task, and native reasoning helps Gemma triangulate across scattered signals.

### Pass 2 — Retrieve + Map (LLM, full doc + rules-library index)

**Input**: full uncompressed extract + Pass 1's classification + the rules-library index (`data/skills/index.md`, ≤800 tokens listing skill names + one-line descriptions).

**Tool**: single native tool `emit_analysis(selected_rules[], logic_map[], retrieval_reasoning, new_convention_notes?)`.

- `selected_rules[]` — list of skill-file names Pass 3 should load.
- `logic_map[]` — per-paragraph analysis: element type candidate, target sysname, propagation range, condition logic. This subsumes what r2's "candidate extractor" was meant to produce; Pass 2 does the job in the LLM's natural structural-analysis mode.
- `retrieval_reasoning` — why these rules and not others. Visible in logs for debugging.
- `new_convention_notes` — optional. When Gemma encounters a markup dialect not in the library (e.g., a Portuguese document using `colchete vazio` that no language-specific file covers), it describes the convention inline so Pass 3 can generalize.

**Thinking**: `think:true`.

**Retrieval step (code, deterministic aggregator)**: Pass 2's response contains `selected_rules[]`. A C# step reads each matching `data/skills/*.md` file, concatenates them, and prepares the Pass 3 prompt. This is the only non-LLM step in the pipeline; it is deterministic and auditable.

### Pass 3 — Annotate (LLM, full doc + retrieved rules + logic map)

**Input**: full extract + retrieved rule files + Pass 2's `logic_map` + a minimal system prompt about emit discipline.

**Tools**: 11 per-element-type native tools, one per Legito Markup Language element:

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
- `emit_text(system_name, label?, condition?)` (explicit `[Text:label]` syntax)

**Thinking**: `think:true`. Pass 3 is the most discipline-sensitive; reasoning helps Gemma check each emit against red flags before committing.

**Output**: Gemma emits one or more tool calls per element. The orchestrator aggregates `tool_calls[]` and converts to the existing `{"replacements":[…]}` shape for the downstream apply step.

---

## 4. Why LLM-driven retrieval, not regex

The r2 plan's Block 2.3 used feature-based selection: regex-detect `⚑ ATRIBUT-MARKERS`, detect `Výběr ANO/NE` comment strings, detect `^\w+:\s*$` paragraphs, and mechanically include the matching skill files.

Three reasons this does not scale:

1. **Only a few languages have first-class coverage.** Legito operates in ~12 customer-facing languages and the rules library can realistically cover those well. Documents arrive in any language Gemma 4 knows — not just the first-class 12. A regex trigger keyed to `Výběr ANO/NE` misses the Turkish, Japanese, or Russian equivalents unless someone manually adds the translations. An LLM that has seen those languages in pretraining recognizes the concept ("this comment describes a yes/no toggle") across translations without per-language regex.

2. **Every new doc will be different.** Authors invent conventions. A document might use `/___/` as a blank marker, `<<option_A>>` as a variant tag, or `{{label}}` as a placeholder — none of which appear in the training corpus. Deterministic feature detection cannot recognize unconventional markers; the LLM can map them to the nearest library convention by analogy, OR describe the new convention in Pass 2's `new_convention_notes` so Pass 3 can apply it without a pre-existing skill file.

3. **Cost of a wrong skill set is absorbed by Pass 3.** Regex-driven selection has false positives (skills included that don't apply) and false negatives (skills missed that did apply). False positives bloat Pass 3's prompt. False negatives cause under-annotation. LLM-driven selection has its own failure modes, but Gemma reading the rules-library index and picking is approximately the same computational cost as Gemma reading a feature-detected subset; the upside is flexibility, the downside is measurable in the per-pass metrics.

---

## 5. Why tool-use

Three reasons native tool-calling beats freeform JSON with repair:

1. **Schema-enforced output.** The tool parameter schema is validated by the Ollama server before the response returns. A tool call with a malformed `condition` string (unknown operator) is rejected at parse time, not at validation-pass time. This removes the JSON-repair retry loop in r2.
2. **Per-element validation at emit time.** Gemma commits to element type, sysname, and condition in the tool-call signature. We no longer need post-hoc code to re-validate which element type was meant.
3. **Native Gemma 4 capability.** The server ships `capabilities: ['tools']`. No translation layer. No tool-emulation prompt hacks. The canonical path is native.

**Empirical risks** (owned by Block 0.3):

- Q4_K_M tool-call reliability is unverified on this domain. The quantization may degrade schema adherence under long-context pressure. Block 0.3 measures tool-call parse-failure rate against format:free JSON-repair rate on the eval set.
- Parallel tool-call support — whether Gemma 4 emits all 50 annotations in a single `tool_calls[]` array or needs multi-turn orchestration — is also unverified. Block 0.3 runs a smoke test on a doc with 50+ annotations; if Gemma batches them all in one response, the orchestrator is trivial; if it emits one at a time, Block 2.2 implements the multi-turn loop.

**Mitigation**: Block 3.4 preserves the format:free fallback behind a feature flag. If a specific document class causes tool-call parse failure repeatedly, the orchestrator falls back to freeform JSON + repair on that document.

---

## 6. Why `thinking:true`

Gemma 4's native thinking channel replaces the r2-era `<analysis>…</analysis>` wrapper.

- **Cleaner output channel**: the thinking region is served on a separate Ollama response field, not a parsed substring of the response body. No "strip the `<analysis>` block" code path.
- **Training alignment**: Gemma 4 was trained with thinking-mode examples. Prompted CoT (`<analysis>…`) is a post-hoc instruction; native thinking is the model's trained behavior. Expected to perform better out of the box.

**Empirical question** (owned by Block 0.3): on our Legito documents, does `think:true` beat `think:false` + prompted CoT? If not — if Gemma 4 on Q4_K_M generates thin or low-quality reasoning in thinking mode for our domain — r3 falls back to prompted CoT. The answer goes into the decision log either way.

---

## 7. Why 256K context

Documents in the eval set range from ~3K (short NDA) to ~80K (banking facility agreement, 55 pages) tokens. At `num_ctx=65536` with an 18-section system prompt + retrieved rules + training micro-examples + document extract, the banking doc already pushes the window hard; we observed mid-document recall drops on documents approaching the 80% threshold.

Bumping `num_ctx` to 262144 gives comfortable headroom for the largest expected document class (up to ~200K tokens) plus full prompt infrastructure.

**VRAM cost**: KV cache grows linearly with context. The production host has 2× 40GB VRAM (~80GB total). Gemma 4 26B at Q4_K_M weighs ~18GB. The remaining ~62GB covers KV cache + activations. At 262144 context the KV cache footprint is substantial but fits; operator confirmation of the live VRAM numbers is Block 1.1's `ollama ps` / `nvidia-smi` check. If actual headroom is insufficient, Block 1.1 halts and reports — no silent degrade.

**Attention quality at 256K**: unverified. Gemma 4 with 262144 declared context may or may not maintain attention quality across the full window on documents of this shape. Block 0.3 A/B-compares `num_ctx=65536` vs `num_ctx=262144` on the eval set; the ship criterion is "no recall regression at 262144 on documents that fit in 65536".

---

## 8. Rules library generalisation

The r2 rules library (nominally Block 2.1) assumes a handful of skill files (9 total) for the dominant markup conventions. The r2 plan's skill inventory is English-biased: the file names, examples, and regex triggers all assume Czech/English/German patterns.

r3 generalises the library in three directions:

1. **Language-agnostic core** — most Legito markup patterns apply across all languages. `[brackets]`, underscore runs, colon-blank (`Label:\s*$`), highlighted runs, `atribut „X"` explicit markers. These patterns work whether the document is in Czech, Japanese, or Arabic. The core is where Gemma spends most of its retrieval budget.

2. **Language-specific idioms** — twelve first-class languages get dedicated skill files: **CS, EN, DE, PL, ES, FR, IT, NL, PT, RO, BG, AR**. These cover the current Legito customer footprint. Each language file documents the specific idioms (CS ODER/NEBO variants, DE ODER variants, AR RTL handling, etc.) that Gemma would otherwise have to guess.

3. **Any-language fallback** — Pass 1 identifies the document's language. Pass 2 loads the language-agnostic core + whichever language-specific file matches (if any). For languages Gemma 4 supports but we have no specific skill file for, Pass 2 uses Gemma 4's multilingual training to adapt the core patterns. For languages Gemma 4 does NOT support competently, Pass 1 flags low confidence; Pass 3 still emits annotations but at lower expected recall, visible in per-language eval metrics.

**Library size target**: 30–50 skill files at `data/skills/`. This is ~4× the r2 inventory but still fits in Pass 2's retrieval index (each entry is name + one-line description ≤20 tokens → index ≤800 tokens for 40 skills).

---

## 9. Empirical questions requiring A/B verification (Block 0.3 expansion scope)

Block 0.3 in r2 ran a 2D sampler grid (temperature × repeat_penalty). r3 expands to a 4D grid because the architectural pivot adds two new dimensions:

1. **tools:true vs format:free** — schema discipline (native tool-calling, validated at Ollama layer) vs JSON-repair tolerance (freeform JSON, post-hoc repair). Measured on parse-failure rate and per-element recall.

2. **thinking:true vs think:false** — native reasoning channel vs prompted CoT. Measured on sysname-fidelity rate and structural-misread rate (the metrics where reasoning helps most).

3. **temperature ∈ {0.0, 0.1, 1.0}** — greedy vs low-stochastic vs Gemma author default. The server ships `temperature: 1` by default; we have been running at 0 since r1.

4. **repeat_penalty ∈ {1.0, 1.05, 1.15}** — crossed with tools + freeform because the penalty's effect on structured output may differ from its effect on prose analysis.

5. **Parallel tool-call batching** — smoke test on a doc with 50+ annotations: does Gemma 4 emit all annotations in one `tool_calls[]` array, or need multi-turn? Answers whether Block 2.2's orchestrator is trivial or complex.

6. **num_ctx attention-quality at 262144** — A/B 65536 vs 262144 on the eval set. Two docs matter most: the banking facility agreement (80K tokens, exercises mid-window attention) and any doc that fits comfortably at 65536 (controls for "does extending the window hurt docs that didn't need it"). VRAM headroom is an operator fact; this A/B is about attention quality only.

Sub-gridding strategy: full 2^2 × 3 × 3 = 36 configs is 36 × N docs. Use the eval-set subset (5 docs) for the full grid, then validate the winner on the full 20-doc set before locking into the decision log.

---

## 10. Banking 55-page doc — the canonical smoke-test

Every Block from 0.3 onward that calls Gemma MUST pass a 5-point smoke test on `1. Banking & Finance - facility agreement (redacted).docx` before ship. Aggregate eval metrics are NOT a substitute for this specific doc — it is the canonical hard case.

**The 5 checks** (from `MEMORY.md feedback_banking_smoke_test.md`):

1. **No timeout**: request completes within `OllamaClient` default HTTP timeout.
2. **python-docx opens**: the output `.docx` is a valid Office Open XML package (`python-docx` can load it without raising).
3. **0 FORMTEXT**: no `FORMTEXT` legacy form-field wrappers leak into the output.
4. **0 tracked-change wrappers**: no `w:ins` or `w:del` tracked-change wrappers leak into the output.
5. **Per-element recall ≥ baseline ±2pp**: per-element recall on the banking doc is within 2 percentage points of the pre-change baseline. Aggregate eval-set recall can be up while banking recall drops — the smoke test catches that and blocks the ship.

---

## 11. Mapping to master plan Blocks

| Design element | Master plan Block |
|---|---|
| Verified Gemma 4 facts (§1) | §4 env facts citation + §5 Capability Ceiling |
| num_ctx bump to 262144 (§2, §7) | Block 1.1 |
| 3-pass architecture end-to-end (§3) | §3b Pipeline Anatomy + §9 Phase 2 (Blocks 2.1, 2.2, 2.3) |
| LLM-driven retrieval rationale (§4) | Block 2.2 orchestrator design |
| Tool-use rationale (§5) | Block 2.3 tool schemas; Block 3.4 fallback |
| Thinking rationale (§6) | Block 0.3 empirical verification; Block 2.2 enables |
| 256K context rationale (§7) | Block 1.1 |
| Rules library generalisation (§8) | Block 2.1 (30–50 skill files, 12 first-class languages) |
| Empirical A/B questions (§9) | Block 0.3 (expanded 4D grid) |
| Banking smoke-test (§10) | §6.9 design principle + §12.5 cross-cutting + §17.F appendix |
| Candidate extractor subsumption | Blocks 3.1 + 3.2 DELETED from r3; Pass 2's `logic_map` is the replacement |

---

## 12. Citations

**Server-verified facts** (this doc):
- `/api/show gemma4:26b` at `https://eu-infra-ai1.legito.com` on 2026-04-23 — capabilities, context_length, template, parser, defaults.
- `/api/tags` at same host — installed model inventory confirms gemma4:26b is the only relevant tag.
- `C:\Legito Test\legito-annotator-csharp\src\LegitoAnnotator.Api\appsettings.json:33` — current `NumCtx: 65536`.

**External**:
- Google DeepMind Gemma 4 release announcement (2026) — capabilities declaration (URL recorded when operator cites a specific release-notes page).
- Ollama tool-calling documentation: `github.com/ollama/ollama/blob/main/docs/api.md` (see `tools` and `think` fields of `/api/chat`).
- Liu et al. 2023, "Lost in the Middle" (arXiv:2307.03172) — lost-in-the-middle attention degradation; motivates the 3-pass decomposition rather than single-pass with hundreds of rules.

**Internal memory**:
- `feedback_verify_model_facts.md` — the discipline enforced here: every capability claim backed by `/api/show` output, not training-data guesses.
- `feedback_banking_smoke_test.md` — the 5-point check verbatim.
- `feedback_no_deferred_findings.md` — why every empirical question has an owning Block and is not left as TBD.

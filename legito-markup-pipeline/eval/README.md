# Eval Set — Legito Gemma Annotator

Owned by **Block 0.1** of the Gemma annotator master plan (`docs/gemma-annotator-master-plan.md` §7 Block 0.1). Consumed by Block 0.2's `scripts/evaluate.py` harness and Block 0.3's sampler A/B grid.

## Purpose

A reproducible 20-document gold set so every downstream Block has a measurable ship gate. The gold was adopted from the existing `reannotated/` corpus; originals are paired from `legito-markup-pipeline/input/` (primary) and `llmannotator/input/` (fallback).

## Directory layout

```
eval/
├── README.md                 (this file)
├── build-manifest.py         (idempotent manifest builder — stdlib only)
├── manifest.json             (generated; per-doc metadata + aggregate counts)
├── gold/                     (20 annotated .docx, authoritative labels)
├── originals/                (≤20 unannotated .docx, paired by slug)
└── gold-extracts/            (20 .json, output of scripts/docx_annotator.py extract)
```

- `gold/` — annotated .docx files adopted from `reannotated/*_annotated*.docx`. For docs with both `_annotated.docx` and `_annotated_cleaned.docx`, the cleaned variant (user-reviewed) is authoritative and the non-cleaned is dropped.
- `originals/` — unannotated `.docx` counterparts. A gold may be missing its original when the filename does not match an entry in either input pool; those docs have `original_missing: true` in `manifest.json`.
- `gold-extracts/` — pre-computed JSON snapshots produced by `legito-annotator-csharp/scripts/docx_annotator.py extract`. Lets the harness diff gold structure without re-parsing the .docx.

## Manifest schema

`manifest.json` is regenerated idempotently by `build-manifest.py`. Schema version 1.0:

- `schema_version` — string, bumps on breaking schema change.
- `total_docs` — integer, length of `docs`.
- `language_distribution` — object, language-code → count across `docs`. Redacted docs bucket under `redacted` rather than a language code.
- `under_represented_vs_master_target` — object, negative-only deltas (`actual - target`, listed only where actual < target) vs. the master plan §7 Block 0.1 language target `{cs:5, en:5, de:3, pl:3, es:2, fr:2}`.
- `size_bands` — object, `short`/`medium`/`long` counts. Bands: `short < 80 paragraphs`, `medium 80-200`, `long > 200`.
- `docs` — array, sorted by `slug`. Each entry has:
  - `slug` — kebab-case identifier, `re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')`.
  - `gold_path`, `original_path`, `gold_extract_path` — repo-relative to `eval/`.
  - `source_of_gold` — `reannotated/_annotated.docx` or `reannotated/_annotated_cleaned.docx`.
  - `language` — one of `cs`, `de`, `en`, `es`, `fr`, `pl`, `redacted`. Detected by substring matching against paragraph text (mirrors `LlmAnnotationService.cs::DetectLanguage`).
  - `domain` — document-type tag (e.g. `mutual-nda`, `facility-agreement`). Pulled from training-corpus metadata when available; otherwise inferred from filename keywords; empty string if neither yields a hit.
  - `size_band` — `short`, `medium`, or `long` per paragraph count.
  - `paragraph_count`, `table_count` — integers from the extract.
  - `original_missing` — boolean.

Source of truth for the schema is `build-manifest.py`.

## How to add a document

1. Copy the annotated `.docx` to `eval/gold/<name>.docx` (no `_annotated` suffix).
2. Copy the unannotated counterpart to `eval/originals/<name>.docx` (same filename).
3. Produce the extract: `python3 ../legito-annotator-csharp/scripts/docx_annotator.py extract eval/gold/<name>.docx > eval/gold-extracts/<name>.json`.
4. Regenerate the manifest: `python3 eval/build-manifest.py`.
5. Verify: `git diff manifest.json` shows only the new doc entry plus updated counts.

To replace a non-cleaned gold with its cleaned variant, drop the new `.docx` into `eval/gold/` (same target filename) and re-extract. `build-manifest.py` will pick up the new `source_of_gold` automatically.

## Language distribution

The 20 adopted docs are English-skewed relative to the master plan's target (`cs:5, en:5, de:3, pl:3, es:2, fr:2`). Actual distribution at Block 0.1 ship time: `en:14, cs:2, de:1, es:1, pl:1, redacted:1` (French is absent). The gap is tracked in `manifest.json::under_represented_vs_master_target` and is **not** a Phase 0 blocker — Phase 1 Blocks run against this actual distribution. Eval-set expansion to meet the language target is owned by **Block 4.3** per master plan §11 and §12.1 ("Eval set under-represents a pattern family") risk row.

### Under-represented languages (at Block 0.1 ship time)

| Language | Target | Actual | Delta |
|----------|-------:|-------:|------:|
| cs       | 5      | 2      | -3    |
| de       | 3      | 1      | -2    |
| es       | 2      | 1      | -1    |
| fr       | 2      | 0      | -2    |
| pl       | 3      | 1      | -2    |

## Reproducibility

`build-manifest.py` is idempotent: the `docs` array is sorted by `slug`, the `language_distribution` and `under_represented_vs_master_target` keys are sorted alphabetically, no timestamps are written into the body, and the output is a fixed-indent JSON line-terminated with `\n`. Running it twice against the same gold/originals/gold-extracts tree produces byte-identical output.

Failure modes:

- Missing `gold-extracts/<name>.json` for a `gold/<name>.docx` → exit 1 with the offending path.
- Malformed JSON in any gold-extract → exit 1 with the parser error.
- Empty `gold/` → exit 1.

These are intentional fail-fast behaviours; see §8 of the dispatch subplan (`.../subplans/0.1-eval-set-creation.md`) for the decision.

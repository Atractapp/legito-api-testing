#!/usr/bin/env python3
"""Build legito-markup-pipeline/eval/manifest.json from gold/ + originals/ + gold-extracts/.

Idempotent: sorted by slug, no timestamps in body, deterministic output. Second run
produces byte-identical manifest.json.

Fail-fast: exits 1 on missing extract, missing gold, or invalid JSON.

Stdlib only (json, pathlib, re, sys).

Owned by Block 0.1 of the Gemma annotator master plan.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

EVAL_DIR = Path(__file__).resolve().parent
PIPELINE_DIR = EVAL_DIR.parent
REPO_ROOT = PIPELINE_DIR.parent

GOLD_DIR = EVAL_DIR / "gold"
ORIGINALS_DIR = EVAL_DIR / "originals"
EXTRACTS_DIR = EVAL_DIR / "gold-extracts"
REANNOTATED_DIR = PIPELINE_DIR / "reannotated"
TRAINING_DIR = PIPELINE_DIR / "training"
MANIFEST_PATH = EVAL_DIR / "manifest.json"

SCHEMA_VERSION = "1.0"

# Master plan §7 Block 0.1 Spec target (for under-represented delta).
MASTER_LANGUAGE_TARGET = {"cs": 5, "en": 5, "de": 3, "pl": 3, "es": 2, "fr": 2}

# Mirrors LlmAnnotationService.cs::DetectLanguage substring matching (case-insensitive).
# Order matters: first match wins.
LANGUAGE_PATTERNS: list[tuple[str, tuple[str, ...]]] = [
    ("cs", ("smlouv", "kupní")),
    ("de", ("vertrag", "gemäß")),
    ("es", ("contrato", "según")),
    ("pl", ("umowa", "zgodnie")),
    ("fr", ("contrat", "conformément")),
]


def slugify(name: str) -> str:
    """Kebab-case slug, matching training-record filename convention."""
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def detect_language(extract: dict, filename: str) -> str:
    """Detect language from extract paragraphs. Redacted docs bucket as 'redacted'."""
    if "(redacted)" in filename.lower():
        return "redacted"
    text = " ".join(p.get("text", "") for p in extract.get("paragraphs", []))
    text_lower = text.lower()
    for code, patterns in LANGUAGE_PATTERNS:
        if any(pat in text_lower for pat in patterns):
            return code
    return "en"


def size_band(paragraph_count: int) -> str:
    """Master plan §7 Block 0.1 Spec size bands."""
    if paragraph_count < 80:
        return "short"
    if paragraph_count <= 200:
        return "medium"
    return "long"


def source_of_gold(stem: str) -> str:
    """Identify whether gold came from _annotated.docx or _annotated_cleaned.docx."""
    if (REANNOTATED_DIR / f"{stem}_annotated_cleaned.docx").exists():
        return "reannotated/_annotated_cleaned.docx"
    if (REANNOTATED_DIR / f"{stem}_annotated.docx").exists():
        return "reannotated/_annotated.docx"
    return "unknown"


def load_training_index() -> dict[str, dict]:
    """Index training records by slug → metadata, for domain/document_type cross-ref."""
    index: dict[str, dict] = {}
    if not TRAINING_DIR.is_dir():
        return index
    for path in sorted(TRAINING_DIR.glob("*.json")):
        try:
            with open(path, encoding="utf-8") as f:
                record = json.load(f)
        except (OSError, json.JSONDecodeError):
            continue
        meta = record.get("metadata", {}) if isinstance(record, dict) else {}
        index[path.stem] = meta
    return index


# Filename-slug keyword → domain fallback when training-corpus has no entry.
# Order matters (first substring match wins, so more-specific keywords come first).
DOMAIN_KEYWORDS: tuple[tuple[str, str], ...] = (
    ("nda", "nda"), ("guaranty", "guaranty"), ("guarantor", "guaranty"),
    ("mortgage", "mortgage"), ("credit", "credit-agreement"),
    ("facility", "facility-agreement"), ("loan", "loan"),
    ("certificate", "certificate"), ("will", "will"),
    ("apelacja", "appeal"), ("smlouva", "contract"),
    ("kupni", "purchase-contract"), ("contrato", "contract"),
    ("stab", "contract"), ("tax", "tax-letter"),
    ("waterfall", "waterfall"), ("construction", "construction"),
    ("historic", "court-records"), ("notice-of-assignment", "assignment"),
    ("officer", "officer-certificate"),
)


def domain_for(slug: str, training_index: dict[str, dict]) -> str:
    """Domain from training-corpus document_type/domain, else filename-keyword heuristic."""
    meta = training_index.get(slug, {})
    for key in ("document_type", "domain"):
        value = meta.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return next((tag for kw, tag in DOMAIN_KEYWORDS if kw in slug), "")


def build_doc_entry(gold_path: Path, training_index: dict[str, dict]) -> dict:
    stem = gold_path.stem
    slug = slugify(stem)
    extract_path = EXTRACTS_DIR / f"{stem}.json"
    if not extract_path.exists():
        sys.exit(f"ERROR: missing extract for {gold_path.name}: {extract_path}")
    try:
        with open(extract_path, encoding="utf-8") as f:
            extract = json.load(f)
    except json.JSONDecodeError as e:
        sys.exit(f"ERROR: invalid JSON in {extract_path}: {e}")

    paragraph_count = int(extract.get("paragraph_count", 0))
    table_count = int(extract.get("table_count", 0))
    original_file = ORIGINALS_DIR / gold_path.name

    return {
        "slug": slug,
        "gold_path": f"gold/{gold_path.name}",
        "original_path": f"originals/{gold_path.name}",
        "gold_extract_path": f"gold-extracts/{extract_path.name}",
        "source_of_gold": source_of_gold(stem),
        "language": detect_language(extract, gold_path.name),
        "domain": domain_for(slug, training_index),
        "size_band": size_band(paragraph_count),
        "paragraph_count": paragraph_count,
        "table_count": table_count,
        "original_missing": not original_file.exists(),
    }


def under_represented_delta(language_distribution: dict[str, int]) -> dict[str, int]:
    """Negative-only deltas (actual - target) where actual < target."""
    gaps = {code: language_distribution.get(code, 0) - target
            for code, target in MASTER_LANGUAGE_TARGET.items()}
    return {code: gap for code, gap in sorted(gaps.items()) if gap < 0}


def main() -> int:
    if not GOLD_DIR.is_dir():
        sys.exit(f"ERROR: {GOLD_DIR} does not exist")

    gold_files = sorted(GOLD_DIR.glob("*.docx"))
    if not gold_files:
        sys.exit(f"ERROR: no *.docx under {GOLD_DIR}")

    training_index = load_training_index()
    docs = [build_doc_entry(g, training_index) for g in gold_files]
    docs.sort(key=lambda d: d["slug"])

    language_distribution: dict[str, int] = {}
    size_bands: dict[str, int] = {"short": 0, "medium": 0, "long": 0}
    for d in docs:
        language_distribution[d["language"]] = language_distribution.get(d["language"], 0) + 1
        size_bands[d["size_band"]] += 1
    language_distribution = dict(sorted(language_distribution.items()))

    manifest = {
        "schema_version": SCHEMA_VERSION,
        "total_docs": len(docs),
        "language_distribution": language_distribution,
        "under_represented_vs_master_target": under_represented_delta(language_distribution),
        "size_bands": size_bands,
        "docs": docs,
    }

    payload = json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=False) + "\n"
    MANIFEST_PATH.write_text(payload, encoding="utf-8", newline="\n")
    print(f"wrote manifest.json with {len(docs)} entries")
    return 0


if __name__ == "__main__":
    sys.exit(main())

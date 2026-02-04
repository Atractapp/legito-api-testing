# Smart Annotator - Developer Documentation

**Version:** 1.0
**Last Updated:** 2026-01-19
**Authors:** Development Team

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Tech Stack](#tech-stack)
3. [Architecture Overview](#architecture-overview)
4. [Core Services](#core-services)
5. [API Reference](#api-reference)
6. [Database Schema](#database-schema)
7. [Setup Instructions](#setup-instructions)
8. [Configuration](#configuration)
9. [Development Workflow](#development-workflow)
10. [Troubleshooting](#troubleshooting)

---

## 1. Executive Summary

### What is Smart Annotator?

Smart Annotator is an **AI-powered document annotation system** that learns from user examples to automatically annotate legal templates and documents. It transforms static DOCX documents into interactive Legito templates by identifying and annotating fillable fields.

### Key Features

- **Training-Based Learning**: Upload document pairs (original + annotated) to teach the system
- **Pattern Extraction**: Automatically extracts annotation patterns from training documents
- **AI-Powered Suggestions**: Uses Claude AI to intelligently annotate new documents
- **Infinite Learning Loop**: User corrections become new training data
- **Semantic Matching**: Fuzzy pattern matching using AI-generated semantic context
- **Document Classification**: Automatically detects document types for better accuracy
- **Confidence Scoring**: Tracks pattern reliability and adjusts over time

### Annotation Types

The system supports 7 annotation types used in Legito templates:

| Type | Format | Purpose |
|------|--------|---------|
| **TextInput** | `[Textinput: Label]` | Fillable text fields |
| **Select** | `[Select: Option1/Option2/Option3]` | Dropdown menus |
| **Date** | `[Date]` | Date pickers |
| **Money** | `[Money]` | Currency/amount fields |
| **Link** | `[Link]` | References to earlier fields (auto-fill) |
| **Calculation** | `[Calculation]` | Formula-based fields |
| **Text** | `[Text: Content]` | Static text elements |

### How It Works (30-Second Overview)

```
1. TRAIN: User uploads document pairs (before/after annotation)
   └─> System extracts patterns: "___" → "[Textinput: Name]"

2. LEARN: AI generates semantic context for each pattern
   └─> "Party name field. Could match: Seller, Buyer, Lessor, Lessee"

3. ANNOTATE: User uploads new document
   ├─> Pattern matching finds exact/similar matches
   ├─> AI suggests annotations for unfamiliar patterns
   └─> Returns suggestions with confidence scores

4. IMPROVE: User accepts/rejects/edits suggestions
   └─> Corrections become new training data (infinite loop)
```

---

## 2. Tech Stack

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| **Next.js** | 16.1.1 | React framework with App Router |
| **React** | 19.2.3 | UI library |
| **TypeScript** | 5.x | Type safety |
| **Zustand** | 5.0.9 | State management |
| **Tailwind CSS** | 4.x | Styling |
| **Radix UI** | Latest | Accessible components |

### Backend

| Technology | Version | Purpose |
|------------|---------|---------|
| **Next.js API Routes** | 16.1.1 | REST API endpoints |
| **Supabase PostgreSQL** | Latest | Database |
| **Supabase Storage** | Latest | File storage |

### AI & Document Processing

| Technology | Version | Purpose |
|------------|---------|---------|
| **Claude API** | Opus 4.5 | AI-powered annotation |
| **Anthropic SDK** | 0.71.2 | Claude integration |
| **Mammoth.js** | 1.11.0 | DOCX parsing (read) |
| **docx** | 9.5.1 | DOCX generation (write) |
| **JSZip** | Latest | DOCX XML manipulation |

### Development Tools

```json
{
  "package.json": {
    "scripts": {
      "dev": "next dev",
      "build": "next build",
      "start": "next start",
      "lint": "eslint"
    }
  }
}
```

---

## 3. Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Training   │  │  Annotation  │  │   Pattern    │         │
│  │     Page     │  │     Page     │  │  Management  │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
│         │                  │                  │                  │
│         └──────────────────┼──────────────────┘                  │
│                            │                                     │
└────────────────────────────┼─────────────────────────────────────┘
                             │
┌────────────────────────────┼─────────────────────────────────────┐
│                   ZUSTAND STATE STORE                            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ • Training Pairs  • Patterns  • Sessions  • Suggestions │   │
│  └─────────────────────────────────────────────────────────┘   │
└────────────────────────────┼─────────────────────────────────────┘
                             │
┌────────────────────────────┼─────────────────────────────────────┐
│                       API ROUTES (Next.js)                       │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐      │
│  │   /training   │  │   /annotate   │  │   /patterns   │      │
│  │   • Upload    │  │   • Process   │  │   • CRUD      │      │
│  │   • Extract   │  │   • Generate  │  │   • Confirm   │      │
│  └───────┬───────┘  └───────┬───────┘  └───────┬───────┘      │
│          │                   │                   │               │
│          └───────────────────┼───────────────────┘               │
│                              │                                   │
└──────────────────────────────┼───────────────────────────────────┘
                               │
┌──────────────────────────────┼───────────────────────────────────┐
│                     CORE SERVICES                                │
│  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────┐ │
│  │ Document Service│  │ Pattern Service │  │ Claude Service │ │
│  │ • Parse DOCX    │  │ • Extract       │  │ • Annotate     │ │
│  │ • Generate DOCX │  │ • Match         │  │ • Semantic     │ │
│  │ • Diff          │  │ • Dedup         │  │   Context      │ │
│  └────────┬────────┘  └────────┬────────┘  └────────┬───────┘ │
│           │                     │                     │          │
│  ┌────────┴─────────────────────┴─────────────────────┴──────┐ │
│  │              HELPER SERVICES (Phase 5)                     │ │
│  │  • Type Rules  • Semantic Matching  • Document Class.    │ │
│  │  • Pattern Learning  • Link Detection  • Storage         │ │
│  └───────────────────────────────────────────────────────────┘ │
└──────────────────────────────┬───────────────────────────────────┘
                               │
┌──────────────────────────────┼───────────────────────────────────┐
│                  EXTERNAL DEPENDENCIES                           │
│  ┌──────────────────┐   ┌──────────────────┐                   │
│  │  Supabase DB     │   │   Claude AI      │                   │
│  │  ┌────────────┐  │   │  (Opus 4.5)      │                   │
│  │  │ Training   │  │   │                  │                   │
│  │  │ Patterns   │  │   │ Annotation API   │                   │
│  │  │ Sessions   │  │   │ Semantic API     │                   │
│  │  │ Feedback   │  │   │                  │                   │
│  │  └────────────┘  │   └──────────────────┘                   │
│  │                  │                                           │
│  │  Supabase Storage│                                           │
│  │  ┌────────────┐  │                                           │
│  │  │ .docx files│  │                                           │
│  │  └────────────┘  │                                           │
│  └──────────────────┘                                           │
└──────────────────────────────────────────────────────────────────┘
```

### Data Flow: Training Pair Upload

```
User uploads documents
         │
         ▼
┌────────────────────┐
│ Parse both DOCX    │  (mammoth.js)
│ • Original text    │
│ • Annotated text   │
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│ Diff Documents     │  (document-service.ts)
│ Find all [...]     │
│ Extract patterns   │
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│ Extract Context    │  (NEW: context keywords)
│ • Keywords before  │  "In [**]" → ["In", "at", "v"]
│ • Keywords after   │  "[**] EUR" → ["EUR", "CZK"]
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│ Generate Semantic  │  (Claude API)
│ AI describes each  │  "Party name field. Could
│ pattern's meaning  │   match: Seller, Buyer..."
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│ Store in Database  │  (Supabase)
│ • Training pair    │
│ • Patterns         │
│ • Semantic context │
└────────────────────┘
```

### Data Flow: Document Annotation

```
User uploads new document
         │
         ▼
┌────────────────────┐
│ Parse DOCX         │  (mammoth.js)
│ Extract plain text │
│ Extract highlights │  ← CRITICAL for ambiguous matches
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│ Classify Document  │  (document-classification-service.ts)
│ Detect type:       │  Loan Agreement, Employment, Lease, etc.
│ • Confidence score │
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│ Load Patterns      │  (Supabase)
│ Get user's trained │
│ patterns from DB   │
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│ Pattern Matching   │  (pattern-service.ts)
│ For each pattern:  │
│ • Find occurrences │
│ • Context matching │
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│ Auto-Detect        │  (services/auto-detect.ts)
│ Find placeholders: │
│ • _____  • XXX     │
│ • DD.MM.YYYY       │
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│ Semantic Matching  │  (semantic-matching-service.ts)
│ For ambiguous:     │  "Creditor's name" matches pattern
│ • Fuzzy search     │  "Seller's name" via semantic context
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│ Deduplicate        │  (services/deduplication.ts)
│ Remove overlaps    │
│ First occurrence = │  [Textinput: Name]
│ Later = [Link]     │
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│ Return Suggestions │
│ • Annotations      │
│ • Confidence       │
│ • Position         │
└────────────────────┘
```

### The Infinite Learning Loop

```
┌─────────────────────────────────────────────────────┐
│                 THE LEARNING CYCLE                  │
└─────────────────────────────────────────────────────┘

Step 1: INITIAL TRAINING
┌───────────────┐
│ User uploads  │
│ training pair │
│ (original +   │
│  annotated)   │
└───────┬───────┘
        │
        ▼
┌───────────────────┐
│ Extract patterns  │  "___" → "[Textinput: Creditor's name]"
│ Store in database │
└───────┬───────────┘
        │
        │
Step 2: ANNOTATION    │
        │             │
        ▼             │
┌───────────────┐     │
│ User uploads  │     │
│ new document  │     │
└───────┬───────┘     │
        │             │
        ▼             │
┌───────────────────┐ │
│ System suggests   │ │  Uses trained patterns
│ annotations       │◄┘
└───────┬───────────┘
        │
        ▼
┌───────────────────┐
│ User reviews:     │
│ ✓ Accept          │
│ ✗ Reject          │
│ ✎ Edit            │
└───────┬───────────┘
        │
        │
Step 3: FEEDBACK      │
        │             │
        ▼             │
┌───────────────────┐ │
│ Update pattern    │ │
│ confidence:       │ │
│ • Accept: +0.02   │ │
│ • Reject: -0.10   │ │
└───────┬───────────┘ │
        │             │
        │             │
Step 4: CORRECTION    │
        │             │
        ▼             │
┌───────────────────┐ │
│ User uploads      │ │
│ corrected version │ │
└───────┬───────────┘ │
        │             │
        ▼             │
┌───────────────────┐ │
│ Create NEW        │ │
│ training pair     │─┘  ← LOOP BACK TO STEP 1
│ Extract patterns  │
│ (now smarter!)    │
└───────────────────┘

Result: System continuously improves with every correction.
```

---

## 4. Core Services

### 4.1 Document Service (`document-service.ts`)

**Purpose:** DOCX file parsing, generation, and diffing.

**Key Functions:**

#### `parseDocx(file: File): Promise<ParseResult>`

Parses a DOCX file into plain text and extracts highlighted regions.

```typescript
interface ParseResult {
  text: string;                          // Plain text extracted from DOCX
  paragraphs: ParsedParagraph[];         // Structured paragraphs
  html?: string;                         // HTML representation
  highlightedRegions?: HighlightedRegion[];  // Yellow-highlighted text
}

interface HighlightedRegion {
  text: string;                          // The highlighted text
  position: { start: number; end: number };  // Position in plain text
  highlightType: string;                 // "yellow", "shading-FFFF00", etc.
}
```

**Usage:**

```typescript
const parsed = await parseDocx(file);
console.log(`Document has ${parsed.text.length} chars`);
console.log(`Found ${parsed.highlightedRegions.length} highlighted regions`);
```

**How It Works:**

1. Uses **mammoth.js** to extract text from DOCX
2. Uses **JSZip** to read DOCX XML directly
3. Parses `word/document.xml`, `word/header*.xml`, `word/footer*.xml`
4. Finds `<w:highlight>` and `<w:shd w:fill="FFFF00">` elements
5. Maps highlighted text positions back to plain text

**Why Highlighting Matters:**

- Templates often have fields highlighted in yellow
- Highlighting disambiguates: "1" as page number vs "1" as placeholder
- Only highlighted text is considered fillable (with exceptions for structural patterns)

---

#### `diffDocuments(original: string, annotated: string): DiffResult`

Compares original and annotated documents to extract patterns.

```typescript
interface DiffResult {
  diffs: DocumentDiff[];
  annotations: ExtractedAnnotation[];
}

interface ExtractedAnnotation {
  originalText: string;              // What was in original: "_____"
  annotatedText: string;             // What it became: "[Textinput: Name]"
  type: AnnotationType;              // TextInput, Date, Money, etc.
  position: { start: number; end: number };
  contextKeywords?: {
    before: string[];                // ["In", "at", "city"]
    after: string[];                 // ["EUR", "CZK", "%"]
  };
}
```

**How It Works:**

1. **Find all annotations** in annotated text: `\[([^\]]+)\]`
2. **Labeled annotations:** Extract label as original text
   - `[Textinput: Creditor's name]` → original = "Creditor's name"
3. **Unlabeled annotations:** Find original by context matching
   - `[Date]` near "on ___" → find context in original → extract "___"
4. **Extract context keywords:** Words immediately before/after
   - "In [**]" → before=["In", "at", "v"] (location indicators)
   - "On [**]" → before=["On", "dated", "dne"] (date indicators)
   - "[**] EUR" → after=["EUR", "CZK"] (money indicators)

**Context Keywords Are Critical:**

- Same placeholder `[**]` becomes different types depending on context
- "In [**]" → `[Textinput: City]` (location)
- "On [**]" → `[Date]` (temporal)
- "Of [**] EUR" → `[Money]` (amount)

---

#### `generateAnnotatedDocxPreservingFormat(originalFile, replacements): Promise<Blob>`

Generates an annotated DOCX by modifying the original in-place (preserves all formatting).

```typescript
interface Replacement {
  original: string;      // "_____"
  replacement: string;   // "[Textinput: Creditor's name]"
}

const replacements = [
  { original: "_____", replacement: "[Textinput: Name]" },
  { original: "DD.MM.YYYY", replacement: "[Date]" },
];

const blob = await generateAnnotatedDocxPreservingFormat(
  originalFile,
  replacements,
  { removeHighlighting: true }  // Remove yellow highlights from output
);
```

**How It Works:**

1. Loads DOCX as ZIP using JSZip
2. Parses `word/document.xml` (and headers/footers)
3. For each replacement:
   - Finds text in XML `<w:t>text</w:t>` elements
   - Handles text split across multiple runs
   - Replaces text while preserving XML structure
4. Removes highlighting: `<w:highlight/>` and `<w:shd w:fill="FFFF00"/>`
5. Generates new DOCX with original formatting intact

**Critical Feature: Ambiguous Pattern Protection**

- Short patterns (1-2 chars) like "X" or "1" only replace in highlighted regions
- Prevents accidental replacement of page numbers, list markers, etc.

---

### 4.2 Pattern Service (`pattern-service.ts`)

**Purpose:** Pattern extraction, matching, and confidence management.

**Key Functions:**

#### `extractPatterns(originalText, annotatedText): PatternExtractionResult`

Extracts annotation patterns from a training pair.

```typescript
interface PatternExtractionResult {
  patterns: Omit<Pattern, 'id' | 'userId' | 'createdAt'>[];
  summary: {
    total: number;
    byType: Record<AnnotationType, number>;
  };
}

const { patterns, summary } = extractPatterns(originalText, annotatedText);
// patterns = [
//   { originalText: "_____", annotatedText: "[Textinput: Name]", type: "TextInput", ... },
//   { originalText: "DD.MM.YYYY", annotatedText: "[Date]", type: "Date", ... }
// ]
```

**Calls:** `diffDocuments` from document-service internally

---

#### `detectTypeFromContent(text, contextBefore, contextAfter): AnnotationType | null`

Rule-based type detection using content and context.

```typescript
const type = detectTypeFromContent(
  "DD.MM.YYYY",
  "signed on ",
  " by"
);
// Returns: 'Date'

const type2 = detectTypeFromContent(
  "XXX",
  "amount of ",
  " EUR"
);
// Returns: 'Money'
```

**Detection Rules:**

```typescript
// DATE DETECTION
if (/\d{1,2}[.\/\-]\d{1,2}[.\/\-]\d{2,4}/.test(text)) return 'Date';
if (/dated?|as of|effective/.test(contextBefore)) return 'Date';

// MONEY DETECTION
if (/[$€£¥]|EUR|CZK/.test(text)) return 'Money';
if (/amount|price|sum/.test(contextBefore)) return 'Money';

// LINK DETECTION (references)
if (/the (buyer|seller|lessor|lessee)/.test(text)) return 'Link';
if (/aforementioned|hereinafter/.test(contextBefore)) return 'Link';

// SELECT DETECTION
if (text.includes('/') && !text.includes('http')) {
  const parts = text.split('/').map(p => p.trim());
  if (parts.length >= 2 && parts.length <= 5) return 'Select';
}

// CALCULATION DETECTION
if (/total|sum|calculated/.test(contextBefore)) return 'Calculation';
if (/[+\-*÷×]/.test(text) && /\d/.test(text)) return 'Calculation';
```

---

#### `deduplicatePatterns(existing, newPatterns): { toAdd, toUpdate }`

Merges similar patterns to avoid duplicates.

```typescript
const { toAdd, toUpdate } = deduplicatePatterns(existingPatterns, newPatterns);

// Only adds truly new patterns
// Updates existing patterns with:
// • usageCount++
// • confidence += 0.05 (boost)
```

**Similarity Check:**

Two patterns are considered duplicates if:
1. `annotatedText` is exactly the same
2. `originalText` is 90%+ similar

**Why This Matters:**

- Same original text can have multiple annotations (context-dependent)
- "Creditor's name" first occurrence → `[Textinput: Creditor's name]`
- "Creditor's name" second occurrence → `[Link]`
- These are NOT duplicates (different annotated text)

---

### 4.3 Claude Service (`claude-service.ts`)

**Purpose:** AI-powered annotation and semantic context generation.

**Configuration:**

```typescript
const service = getClaudeService({
  model: 'claude-opus-4-5-20251101',  // Latest model
  maxTokens: 8192,
  apiKey: process.env.ANTHROPIC_API_KEY,
});
```

**Key Functions:**

#### `annotateDocument(options): Promise<ClaudeAnnotationResponse>`

Uses Claude AI to annotate a document based on training examples and patterns.

```typescript
const response = await service.annotateDocument({
  document: documentText,
  trainingExamples: [
    { original: "...", annotated: "..." }
  ],
  patterns: learnedPatterns,
  rejectedPatterns: rejectedList,  // Learn from mistakes!
  maxExamples: 5,
  confidenceThreshold: 0.5,
});

interface ClaudeAnnotationResponse {
  annotatedText: string;
  annotations: Array<{
    original: string;
    annotated: string;
    type: AnnotationType;
    position: { start: number; end: number };
    confidence: number;
  }>;
  metadata?: {
    documentTypeDetected?: string;
    totalAnnotations: number;
    lowConfidenceCount: number;
  };
}
```

**System Prompt (Simplified):**

```
You annotate FILL-IN-THE-BLANK placeholders in legal documents.

ONLY ANNOTATE THESE EXACT PATTERNS:
- _____ (underscores) → [Textinput: label based on context]
- XXXX or XXX (X letters) → [Textinput] or [Date] or [Money]
- ........ (dots) → [Textinput]
- DD.MM.YYYY or XX.XX.XXXX → [Date]
- 0,00 EUR or XXX CZK → [Money]

NEVER ANNOTATE:
- Words: Loan, Agreement, Contract, Party, Buyer, Seller
- ANY readable text
- Sentences or phrases

HARD LIMIT: Maximum 20 annotations per document.
```

**User Prompt Structure:**

```
## TRAINING EXAMPLES FROM YOUR DOCUMENTS
Example 1:
Original: [snippet with context]
Annotated: [snippet with annotations]

## LEARNED PATTERNS TO APPLY
TextInput:
- "Creditor's name" → [Textinput: Creditor's name]
  (Party name field. Could match: Seller, Buyer, Lessor...)
Date:
- "DD.MM.YYYY" → [Date]

## REJECTED ANNOTATIONS (DO NOT REPEAT THESE MISTAKES)
- "Loan" should NOT become "[Textinput: Loan]" (rejected 3x)
- "Agreement" should NOT become "[Link]" (rejected 2x)

## DOCUMENT TO ANNOTATE
<document>
[your document here]
</document>
```

**Learning from Rejections:** The rejected patterns list teaches Claude what NOT to do, preventing repeated mistakes.

---

#### `generateSemanticContext(originalText, annotatedText, type): Promise<string | null>`

Generates AI-powered semantic description for a pattern.

```typescript
const context = await generateSemanticContext(
  "Creditor's name",
  "[Textinput: Creditor's name]",
  "TextInput"
);

// Result: "Party name field. Could match: Seller, Buyer, Lessor, Lessee, Landlord, Tenant"
```

**What is Semantic Context?**

- **NOT** document text chunks
- **IS** a description of what the field represents
- Used for fuzzy matching: "Seller's name" matches "Buyer's name" pattern

**How It's Generated:**

1. Claude analyzes the pattern
2. Determines semantic category: `party_name`, `date`, `money`, `address`, etc.
3. Lists alternative phrasings that should match
4. Returns in format: `"Description. Could match: Alt1, Alt2, Alt3"`

**Example Categories:**

- `party_name`: Buyer, Seller, Lessor, Lessee, Landlord, Tenant, Employer, Employee
- `date`: Effective date, Signing date, Start date, End date, Due date
- `money`: Loan amount, Purchase price, Deposit, Rent, Fee, Salary
- `address`: Registered address, Mailing address, Business address
- `identification`: ID number, Tax ID, Registration number, VAT number

---

### 4.4 Type Rules Service (`type-rules-service.ts`)

**Purpose:** Database-driven type inference rules with caching.

**Database Table:**

```sql
CREATE TABLE annotator_type_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword TEXT NOT NULL,              -- "EUR", "CZK", "amount"
  position TEXT NOT NULL,             -- 'before' | 'after' | 'contains'
  implied_type TEXT NOT NULL,         -- 'Money', 'Date', 'Link'
  priority INTEGER DEFAULT 0,         -- Higher = checked first
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Example rules:
INSERT INTO annotator_type_rules (keyword, position, implied_type, priority) VALUES
  ('EUR', 'after', 'Money', 10),
  ('CZK', 'after', 'Money', 10),
  ('amount', 'before', 'Money', 8),
  ('dated', 'before', 'Date', 9),
  ('hereinafter', 'before', 'Link', 7);
```

**Key Functions:**

#### `preloadRules(): Promise<void>`

Loads all type rules from database into memory cache.

```typescript
await preloadRules();  // Call at server startup or before annotation
```

#### `inferTypeFromContext(textBefore, textAfter): AnnotationType | null`

Applies cached rules to infer type from context.

```typescript
const type = inferTypeFromContext(
  "the total amount of ",  // textBefore
  " EUR including VAT"     // textAfter
);
// Returns: 'Money' (matched rules: "amount" before + "EUR" after)
```

**Performance:**

- Rules loaded once at startup
- In-memory cache = O(n) lookup
- ~50 rules = negligible overhead

---

### 4.5 Semantic Matching Service (`semantic-matching-service.ts`)

**Purpose:** Fuzzy pattern matching using AI-generated semantic context.

**Data Structure:**

```typescript
interface SemanticIndex {
  byCategory: Map<string, TrainedPattern[]>;
  byKeyword: Map<string, TrainedPattern[]>;
  byType: Map<AnnotationType, TrainedPattern[]>;
}
```

**Key Functions:**

#### `buildSemanticIndex(patterns): SemanticIndex`

Builds searchable index from patterns with semantic context.

```typescript
const index = buildSemanticIndex(patterns);

// index.byCategory.get('party_name') = [
//   { originalText: "Creditor's name", semanticContext: "Party name field. Could match: Seller, Buyer..." },
//   { originalText: "Debtor's name", semanticContext: "Party name field. Could match: Borrower, Lender..." }
// ]
```

#### `findSemanticMatches(text, index): TrainedPattern[]`

Finds patterns that semantically match the given text.

```typescript
const matches = findSemanticMatches(
  "Seller's full name",  // Document text
  semanticIndex
);

// Returns patterns for "Creditor's name", "Buyer's name", etc.
// Even though exact text differs, semantic meaning matches!
```

**How It Works:**

1. Extract keywords from input text: ["Seller", "name"]
2. Search `index.byKeyword` for patterns containing those keywords in semantic context
3. Rank by keyword overlap
4. Return top matches with confidence scores

**Use Case:**

Training document has: "Creditor's name"
New document has: "Seller's name"

Exact match fails, but semantic match succeeds:
- Pattern semantic context: "Party name field. Could match: Seller, Buyer, Lessor..."
- "Seller" appears in context → MATCH!

---

### 4.6 Document Classification Service (`document-classification-service.ts`)

**Purpose:** Detect document type for context-aware annotation.

**Document Types:**

```typescript
type DocumentType =
  | 'loan_agreement'
  | 'employment_contract'
  | 'lease_agreement'
  | 'purchase_agreement'
  | 'service_agreement'
  | 'nda'
  | 'power_of_attorney'
  | 'invoice'
  | 'other';
```

**Key Function:**

#### `classifyDocument(text): Promise<{ documentType, confidence }>`

```typescript
const classification = await classifyDocument(documentText);

// Result:
{
  documentType: 'loan_agreement',
  confidence: 0.92,
  indicators: ['loan', 'principal', 'interest', 'repayment']
}
```

**Classification Method:**

1. **Keyword-based scoring:**
   - Loan agreement: "loan", "principal", "interest", "borrower", "lender"
   - Employment: "employee", "employer", "salary", "termination", "duties"
   - Lease: "lessor", "lessee", "rent", "premises", "lease term"

2. **Score calculation:**
   - Each keyword match += weight
   - Higher frequency = higher confidence

3. **Threshold check:**
   - confidence >= 0.7 → use detected type
   - confidence < 0.7 → return 'other'

**Why It Matters:**

- Different document types have different annotation patterns
- Loan agreements have "principal amount" (Money)
- Employment contracts have "salary" (Money)
- Knowing the type improves AI suggestions

---

### 4.7 Pattern Learning Service (`pattern-learning-service.ts`)

**Purpose:** Learn from user feedback to improve pattern quality.

**Key Functions:**

#### `learnFromRejection(rejectedAnnotation): Promise<void>`

Records rejected annotations to prevent repeating mistakes.

```typescript
await learnFromRejection({
  originalText: "Loan",
  suggestedText: "[Textinput: Loan]",
  rejectionCount: 1,
});

// Next time Claude sees "Loan", it will avoid annotating it
```

#### `updatePatternFromFeedback(patternId, feedback): Promise<Pattern>`

Updates pattern confidence based on user feedback.

```typescript
await updatePatternFromFeedback(patternId, {
  accepted: true,
  edited: false,
});

// Pattern confidence increases from 0.85 to 0.87
```

**Confidence Update Algorithm:**

```typescript
if (accepted) {
  newConfidence = Math.min(1.0, oldConfidence + 0.02);  // Small boost
} else {
  newConfidence = Math.max(0.1, oldConfidence - 0.10);  // Larger penalty
}

successRate = (acceptCount) / (acceptCount + rejectCount);
```

---

## 5. API Reference

### Base URL

```
Production: https://your-app.vercel.app/api/annotator
Development: http://localhost:3000/api/annotator
```

### Authentication

All endpoints require authentication via Next.js session:

```typescript
// Using fetch
const response = await fetch('/api/annotator/training', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
  },
  credentials: 'include',  // Include session cookies
});
```

---

### 5.1 Training Endpoints

#### `POST /api/annotator/training`

Upload a training pair (original + annotated documents).

**Request:**

```typescript
// Form data
const formData = new FormData();
formData.append('name', 'Loan Agreement Example');
formData.append('originalFile', originalDocxFile);  // File object
formData.append('annotatedFile', annotatedDocxFile);  // File object

const response = await fetch('/api/annotator/training', {
  method: 'POST',
  body: formData,
});
```

**Response:**

```json
{
  "success": true,
  "trainingPair": {
    "id": "uuid-here",
    "userId": "user-uuid",
    "name": "Loan Agreement Example",
    "originalText": "...",
    "annotatedText": "...",
    "originalFilePath": "training/user-id/pair-id_original.docx",
    "annotatedFilePath": "training/user-id/pair-id_annotated.docx",
    "patternsExtracted": [...],
    "isUserCorrected": false,
    "createdAt": "2026-01-19T10:00:00Z"
  },
  "patternsExtracted": 15
}
```

**Process:**

1. Parse both DOCX files
2. Diff documents to extract patterns
3. Generate semantic context for each pattern (AI)
4. Store training pair in database
5. Store patterns in database
6. Upload files to Supabase Storage

---

#### `GET /api/annotator/training`

List all training pairs for the current user.

**Response:**

```json
{
  "trainingPairs": [
    {
      "id": "uuid-1",
      "name": "Loan Agreement Example",
      "patternsCount": 15,
      "isUserCorrected": false,
      "createdAt": "2026-01-19T10:00:00Z"
    },
    {
      "id": "uuid-2",
      "name": "Employment Contract",
      "patternsCount": 22,
      "isUserCorrected": true,
      "createdAt": "2026-01-18T14:30:00Z"
    }
  ],
  "total": 2
}
```

---

#### `DELETE /api/annotator/training`

Delete all training pairs or specific pair.

**Delete All:**

```typescript
await fetch('/api/annotator/training', {
  method: 'DELETE',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ all: true }),
});
```

**Response:**

```json
{
  "success": true,
  "deleted": 5,
  "message": "Deleted 5 training pairs"
}
```

**Delete Specific:**

```typescript
await fetch('/api/annotator/training/uuid-here', {
  method: 'DELETE',
});
```

---

### 5.2 Pattern Endpoints

#### `GET /api/annotator/patterns`

List all learned patterns.

**Response:**

```json
{
  "patterns": [
    {
      "id": "pattern-uuid-1",
      "userId": "user-uuid",
      "originalText": "_____",
      "annotatedText": "[Textinput: Creditor's name]",
      "annotationType": "TextInput",
      "confidence": 0.95,
      "usageCount": 12,
      "successRate": 0.92,
      "trainingPairId": "pair-uuid",
      "semanticContext": "Party name field. Could match: Seller, Buyer, Lessor, Lessee",
      "userContextHint": null,
      "createdAt": "2026-01-15T10:00:00Z"
    },
    {
      "id": "pattern-uuid-2",
      "originalText": "DD.MM.YYYY",
      "annotatedText": "[Date]",
      "annotationType": "Date",
      "confidence": 1.0,
      "usageCount": 8,
      "successRate": 1.0,
      "semanticContext": "Date field. Could match: effective date, signing date, start date",
      "createdAt": "2026-01-15T10:00:00Z"
    }
  ],
  "stats": {
    "totalPatterns": 45,
    "byType": {
      "TextInput": 25,
      "Date": 8,
      "Money": 6,
      "Link": 4,
      "Select": 2,
      "Calculation": 0,
      "Text": 0
    },
    "averageConfidence": 0.87,
    "averageSuccessRate": 0.89
  }
}
```

---

#### `POST /api/annotator/patterns`

Manually create a pattern.

**Request:**

```json
{
  "originalText": "Borrower's address",
  "annotatedText": "[Textinput: Borrower's address]",
  "annotationType": "TextInput",
  "userContextHint": "Use when first occurrence in document"
}
```

**Response:**

```json
{
  "success": true,
  "pattern": {
    "id": "new-pattern-uuid",
    "originalText": "Borrower's address",
    "annotatedText": "[Textinput: Borrower's address]",
    "annotationType": "TextInput",
    "confidence": 1.0,
    "usageCount": 1,
    "successRate": 1.0,
    "semanticContext": "Address field. Could match: Creditor's address, Debtor's address",
    "userContextHint": "Use when first occurrence in document",
    "createdAt": "2026-01-19T12:00:00Z"
  }
}
```

---

#### `PUT /api/annotator/patterns/:id`

Update a pattern.

**Request:**

```json
{
  "userContextHint": "Use Link when in signature section, TextInput when first occurrence"
}
```

**Response:**

```json
{
  "success": true,
  "pattern": {
    "id": "pattern-uuid",
    "userContextHint": "Use Link when in signature section, TextInput when first occurrence",
    "semanticContext": "Updated context based on hint...",
    ...
  }
}
```

**Note:** When you update `userContextHint`, the system automatically regenerates `semanticContext` using AI.

---

#### `DELETE /api/annotator/patterns/:id`

Delete a specific pattern.

---

#### `DELETE /api/annotator/patterns`

Delete all patterns.

---

#### `POST /api/annotator/patterns/confirm`

Confirm pending patterns (after reviewing suggestions).

**Request:**

```json
{
  "patterns": [
    {
      "originalText": "_____",
      "annotatedText": "[Textinput: Debtor's name]",
      "annotationType": "TextInput",
      "confidence": 0.85
    }
  ],
  "source": "training",  // or "annotate"
  "trainingPairId": "uuid-here",  // if source=training
  "sessionId": null
}
```

**Response:**

```json
{
  "success": true,
  "patternsSaved": 1,
  "patternsUpdated": 0
}
```

---

#### `GET /api/annotator/patterns/analytics`

Get pattern performance analytics.

**Response:**

```json
{
  "patterns": [
    {
      "patternId": "uuid-1",
      "originalText": "_____",
      "annotatedText": "[Textinput: Name]",
      "annotationType": "TextInput",
      "confidence": 0.92,
      "usageCount": 25,
      "successRate": 0.88,
      "acceptCount": 22,
      "rejectCount": 2,
      "editCount": 1,
      "acceptanceRatePercent": 88.0
    }
  ],
  "total": 45
}
```

---

### 5.3 Annotation Endpoints

#### `POST /api/annotator/annotate`

Start a new annotation session (upload document and get suggestions).

**Request:**

```typescript
const formData = new FormData();
formData.append('file', docxFile);

const response = await fetch('/api/annotator/annotate', {
  method: 'POST',
  body: formData,
});
```

**Response:**

```json
{
  "success": true,
  "session": {
    "id": "session-uuid",
    "userId": "user-uuid",
    "inputFilename": "loan_agreement.docx",
    "inputText": "...",
    "inputFilePath": "sessions/user-id/session-id_input.docx",
    "status": "pending",
    "createdAt": "2026-01-19T12:00:00Z",
    "documentType": "loan_agreement",
    "documentTypeConfidence": 0.92
  },
  "suggestions": [
    {
      "id": "suggestion-uuid-1",
      "originalText": "_____",
      "annotatedText": "[Textinput: Creditor's name]",
      "type": "TextInput",
      "position": { "start": 245, "end": 250 },
      "confidence": 0.95,
      "isAccepted": true,
      "isEdited": false,
      "isFromPattern": true
    },
    {
      "id": "suggestion-uuid-2",
      "originalText": "DD.MM.YYYY",
      "annotatedText": "[Date]",
      "type": "Date",
      "position": { "start": 512, "end": 522 },
      "confidence": 1.0,
      "isAccepted": true,
      "isEdited": false,
      "isFromPattern": true
    }
  ],
  "stats": {
    "totalSuggestions": 18,
    "patternsAvailable": 45,
    "patternMatched": 18
  }
}
```

**Process:**

1. Parse DOCX
2. Classify document type
3. Load user's patterns
4. Build semantic index
5. Find pattern matches (exact + fuzzy)
6. Auto-detect common placeholders
7. Remove overlaps
8. Convert duplicates to Links
9. Return suggestions sorted by position

---

#### `POST /api/annotator/annotate/generate`

Generate annotated DOCX from accepted suggestions.

**Request:**

```json
{
  "sessionId": "session-uuid",
  "annotations": [
    {
      "id": "suggestion-uuid-1",
      "originalText": "_____",
      "annotatedText": "[Textinput: Creditor's name]",
      "type": "TextInput",
      "position": { "start": 245, "end": 250 },
      "confidence": 0.95
    }
  ],
  "saveAsPatterns": false  // Set true to save accepted annotations as new patterns
}
```

**Response:**

```json
{
  "success": true,
  "downloadUrl": "/api/annotator/download/session-uuid",
  "outputFilePath": "sessions/user-id/session-uuid_output.docx"
}
```

**Process:**

1. Load original document from storage
2. Build replacement list from accepted annotations
3. Generate annotated DOCX (preserves formatting)
4. Upload to storage
5. Update session status to "completed"
6. Optionally save as patterns if `saveAsPatterns=true`

---

### 5.4 Session Endpoints

#### `GET /api/annotator/sessions`

List all annotation sessions.

**Response:**

```json
{
  "sessions": [
    {
      "id": "session-uuid-1",
      "inputFilename": "loan_agreement.docx",
      "status": "completed",
      "annotationsCount": 18,
      "createdAt": "2026-01-19T12:00:00Z"
    }
  ],
  "total": 5
}
```

---

#### `POST /api/annotator/sessions/:id/correct`

Submit corrected document (starts learning loop).

**Request:**

```typescript
const formData = new FormData();
formData.append('correctedFile', correctedDocxFile);

await fetch('/api/annotator/sessions/session-uuid/correct', {
  method: 'POST',
  body: formData,
});
```

**Response:**

```json
{
  "success": true,
  "newTrainingPairId": "training-pair-uuid",
  "newPatternsCount": 5,
  "updatedPatterns": 3
}
```

**Process:**

1. Parse corrected DOCX
2. Load original text from session
3. Diff documents to find corrections
4. Create new training pair (marked as `isUserCorrected=true`)
5. Extract new patterns
6. Update existing patterns (deduplicate)
7. Generate semantic context for new patterns

**This is the learning loop!**

---

### 5.5 Feedback Endpoints

#### `POST /api/annotator/feedback`

Submit user feedback on annotations.

**Request:**

```json
{
  "feedback": [
    {
      "sessionId": "session-uuid",
      "originalText": "_____",
      "suggestedText": "[Textinput: Name]",
      "annotationType": "TextInput",
      "feedbackType": "accepted",  // or "rejected" or "edited"
      "editedText": "[Textinput: Full Name]",  // if edited
      "source": "pattern",  // or "ai"
      "patternId": "pattern-uuid",
      "originalConfidence": 0.85,
      "contextBefore": "Creditor's full ",
      "contextAfter": ", residing at",
      "positionStart": 245,
      "positionEnd": 250
    }
  ]
}
```

**Response:**

```json
{
  "success": true,
  "feedbackSaved": 1,
  "patternsUpdated": 1
}
```

**Process:**

1. Store feedback in database
2. Update pattern confidence:
   - accepted: +0.02
   - rejected: -0.10
   - edited: neutral (0)
3. Update success rate: `acceptCount / (acceptCount + rejectCount + editCount)`
4. Add to rejected patterns list if rejected

---

#### `GET /api/annotator/feedback?rejected=true`

Get list of frequently rejected patterns.

**Response:**

```json
{
  "patterns": [
    {
      "originalText": "Loan",
      "suggestedText": "[Textinput: Loan]",
      "rejectionCount": 5,
      "lastRejected": "2026-01-19T10:00:00Z"
    },
    {
      "originalText": "Agreement",
      "suggestedText": "[Link]",
      "rejectionCount": 3,
      "lastRejected": "2026-01-18T15:30:00Z"
    }
  ],
  "total": 8
}
```

---

## 6. Database Schema

### Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                  annotator_training_pairs                       │
├─────────────────────────────────────────────────────────────────┤
│ id                  UUID PRIMARY KEY                            │
│ user_id             UUID NOT NULL                               │
│ name                TEXT NOT NULL                               │
│ original_text       TEXT NOT NULL                               │
│ annotated_text      TEXT NOT NULL                               │
│ original_file_path  TEXT                                        │
│ annotated_file_path TEXT                                        │
│ patterns_extracted  JSONB                                       │
│ is_user_corrected   BOOLEAN DEFAULT FALSE                       │
│ source_session_id   UUID → annotator_sessions.id               │
│ created_at          TIMESTAMPTZ DEFAULT NOW()                   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ FOREIGN KEY (training_pair_id)
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                     annotator_patterns                          │
├─────────────────────────────────────────────────────────────────┤
│ id                  UUID PRIMARY KEY                            │
│ user_id             UUID NOT NULL                               │
│ original_text       TEXT NOT NULL                               │
│ annotated_text      TEXT NOT NULL                               │
│ annotation_type     TEXT NOT NULL (CHECK constraint)            │
│ confidence          FLOAT DEFAULT 1.0 (0-1)                     │
│ usage_count         INTEGER DEFAULT 1                           │
│ success_rate        FLOAT DEFAULT 1.0 (0-1)                     │
│ training_pair_id    UUID → annotator_training_pairs.id          │
│ semantic_context    TEXT (AI-generated description)             │
│ user_context_hint   TEXT (user guidance)                        │
│ created_at          TIMESTAMPTZ DEFAULT NOW()                   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ FOREIGN KEY (patterns_used[])
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                    annotator_sessions                           │
├─────────────────────────────────────────────────────────────────┤
│ id                   UUID PRIMARY KEY                           │
│ user_id              UUID NOT NULL                              │
│ input_filename       TEXT NOT NULL                              │
│ input_text           TEXT NOT NULL                              │
│ input_file_path      TEXT                                       │
│ output_text          TEXT                                       │
│ output_file_path     TEXT                                       │
│ annotations_applied  JSONB                                      │
│ patterns_used        UUID[] (array of pattern IDs)              │
│ status               TEXT (pending/processing/completed/...)    │
│ claude_response      JSONB                                      │
│ document_type        TEXT (loan_agreement, employment, ...)     │
│ document_type_confidence FLOAT                                  │
│ created_at           TIMESTAMPTZ DEFAULT NOW()                  │
│ completed_at         TIMESTAMPTZ                                │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ FOREIGN KEY (session_id)
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                  annotator_feedback                             │
├─────────────────────────────────────────────────────────────────┤
│ id                  UUID PRIMARY KEY                            │
│ user_id             UUID NOT NULL                               │
│ session_id          UUID → annotator_sessions.id               │
│ original_text       TEXT NOT NULL                               │
│ suggested_text      TEXT NOT NULL                               │
│ annotation_type     TEXT NOT NULL                               │
│ feedback_type       TEXT (accepted/rejected/edited)             │
│ edited_text         TEXT                                        │
│ context_before      TEXT                                        │
│ context_after       TEXT                                        │
│ position_start      INTEGER                                     │
│ position_end        INTEGER                                     │
│ source              TEXT (ai/pattern)                           │
│ pattern_id          UUID → annotator_patterns.id               │
│ original_confidence FLOAT                                       │
│ created_at          TIMESTAMPTZ DEFAULT NOW()                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                   annotator_type_rules                          │
├─────────────────────────────────────────────────────────────────┤
│ id                  UUID PRIMARY KEY                            │
│ keyword             TEXT NOT NULL                               │
│ position            TEXT (before/after/contains)                │
│ implied_type        TEXT NOT NULL                               │
│ priority            INTEGER DEFAULT 0                           │
│ created_at          TIMESTAMPTZ DEFAULT NOW()                   │
└─────────────────────────────────────────────────────────────────┘
```

### Table Descriptions

#### `annotator_training_pairs`

Stores document pairs uploaded by users for training.

**Key Columns:**

- `is_user_corrected`: `true` if created from correction (learning loop)
- `source_session_id`: Links corrections back to original session
- `patterns_extracted`: JSONB array of patterns extracted from this pair

**Indexes:**

```sql
CREATE INDEX idx_training_pairs_user ON annotator_training_pairs(user_id);
CREATE INDEX idx_training_pairs_created ON annotator_training_pairs(created_at DESC);
```

---

#### `annotator_patterns`

Stores learned annotation patterns with confidence scores.

**Key Columns:**

- `confidence`: Pattern reliability (0-1), updated based on feedback
- `usage_count`: How many times this pattern has been applied
- `success_rate`: Historical acceptance rate
- `semantic_context`: AI-generated description for fuzzy matching
- `user_context_hint`: User-provided guidance on when to use this pattern

**Example Data:**

```sql
INSERT INTO annotator_patterns (
  user_id,
  original_text,
  annotated_text,
  annotation_type,
  confidence,
  usage_count,
  success_rate,
  semantic_context
) VALUES (
  'user-uuid',
  '_____',
  '[Textinput: Creditor''s name]',
  'TextInput',
  0.95,
  12,
  0.92,
  'Party name field. Could match: Seller, Buyer, Lessor, Lessee, Landlord, Tenant'
);
```

**Indexes:**

```sql
CREATE INDEX idx_patterns_user ON annotator_patterns(user_id);
CREATE INDEX idx_patterns_type ON annotator_patterns(annotation_type);
CREATE INDEX idx_patterns_confidence ON annotator_patterns(confidence DESC);
CREATE INDEX idx_patterns_training_pair ON annotator_patterns(training_pair_id);
```

**Database Triggers:**

```sql
-- Automatically update pattern confidence when feedback is added
CREATE TRIGGER update_pattern_confidence_on_feedback
AFTER INSERT ON annotator_feedback
FOR EACH ROW
EXECUTE FUNCTION update_pattern_confidence();

-- Function
CREATE OR REPLACE FUNCTION update_pattern_confidence()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.pattern_id IS NOT NULL THEN
    UPDATE annotator_patterns
    SET
      usage_count = usage_count + 1,
      confidence = CASE
        WHEN NEW.feedback_type = 'accepted' THEN LEAST(1.0, confidence + 0.02)
        WHEN NEW.feedback_type = 'rejected' THEN GREATEST(0.1, confidence - 0.10)
        ELSE confidence
      END,
      success_rate = (
        SELECT COUNT(*) FILTER (WHERE feedback_type = 'accepted')::FLOAT /
               NULLIF(COUNT(*), 0)
        FROM annotator_feedback
        WHERE pattern_id = NEW.pattern_id
      )
    WHERE id = NEW.pattern_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

#### `annotator_sessions`

Tracks annotation sessions (document upload → suggestions → generation).

**Key Columns:**

- `status`: `pending`, `processing`, `completed`, `corrected`, `failed`
- `patterns_used`: Array of pattern IDs used in this session
- `claude_response`: Full AI response (for debugging)
- `document_type`: Detected document type
- `annotations_applied`: JSONB array of final annotations

**Status Flow:**

```
pending → processing → completed
                    ↘ corrected (if user submits correction)
```

---

#### `annotator_feedback`

User feedback on annotation suggestions (for learning).

**Key Columns:**

- `feedback_type`: `accepted`, `rejected`, `edited`
- `source`: `ai` (Claude suggested) or `pattern` (pattern match)
- `pattern_id`: Links to specific pattern (if source=pattern)
- `context_before/after`: Surrounding text for analysis

**Queries:**

```sql
-- Get rejected patterns (avoid these in future)
SELECT
  original_text,
  suggested_text,
  COUNT(*) as rejection_count,
  MAX(created_at) as last_rejected
FROM annotator_feedback
WHERE feedback_type = 'rejected'
GROUP BY original_text, suggested_text
ORDER BY rejection_count DESC
LIMIT 20;

-- Get pattern performance
SELECT
  p.id,
  p.original_text,
  p.annotated_text,
  p.confidence,
  COUNT(*) FILTER (WHERE f.feedback_type = 'accepted') as accept_count,
  COUNT(*) FILTER (WHERE f.feedback_type = 'rejected') as reject_count,
  COUNT(*) FILTER (WHERE f.feedback_type = 'edited') as edit_count,
  (COUNT(*) FILTER (WHERE f.feedback_type = 'accepted')::FLOAT / NULLIF(COUNT(*), 0)) as acceptance_rate
FROM annotator_patterns p
LEFT JOIN annotator_feedback f ON f.pattern_id = p.id
WHERE p.user_id = $1
GROUP BY p.id
ORDER BY p.confidence DESC;
```

---

#### `annotator_type_rules`

Database-driven type inference rules (cached in memory).

**Example Data:**

```sql
INSERT INTO annotator_type_rules (keyword, position, implied_type, priority) VALUES
  ('EUR', 'after', 'Money', 10),
  ('CZK', 'after', 'Money', 10),
  ('USD', 'after', 'Money', 10),
  ('GBP', 'after', 'Money', 10),
  ('amount', 'before', 'Money', 8),
  ('price', 'before', 'Money', 8),
  ('sum', 'before', 'Money', 8),
  ('dated', 'before', 'Date', 9),
  ('on', 'before', 'Date', 7),
  ('as of', 'before', 'Date', 9),
  ('hereinafter', 'before', 'Link', 7),
  ('aforementioned', 'before', 'Link', 8);
```

---

### Row Level Security (RLS)

All tables have RLS enabled. Users can only access their own data.

**Example Policy:**

```sql
CREATE POLICY "Users can view own patterns"
ON annotator_patterns FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own patterns"
ON annotator_patterns FOR INSERT
WITH CHECK (auth.uid() = user_id);
```

---

### Storage Structure

Supabase Storage bucket: `annotator-files`

```
annotator-files/
├── training/
│   └── {user_id}/
│       ├── {pair_id}_original.docx
│       └── {pair_id}_annotated.docx
└── sessions/
    └── {user_id}/
        ├── {session_id}_input.docx
        └── {session_id}_output.docx
```

**Storage Policies:**

```sql
-- Users can upload to their own folders
CREATE POLICY "Users can upload own files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'annotator-files' AND auth.uid()::text = (storage.foldername(name))[2]);

-- Users can download from their own folders
CREATE POLICY "Users can download own files"
ON storage.objects FOR SELECT
USING (bucket_id = 'annotator-files' AND auth.uid()::text = (storage.foldername(name))[2]);
```

---

## 7. Setup Instructions

### Prerequisites

- **Node.js:** 20.x or higher
- **npm:** 10.x or higher
- **Supabase Account:** Free tier works for development
- **Claude API Key:** From Anthropic Console

### 7.1 Environment Setup

1. **Clone Repository:**

```bash
cd api-testing-dashboard
```

2. **Install Dependencies:**

```bash
npm install
```

3. **Environment Variables:**

Create `.env.local`:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Claude AI
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here

# App URL (for callbacks)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Security Note:**

- `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS - NEVER expose to client
- `ANTHROPIC_API_KEY` is server-only
- Only `NEXT_PUBLIC_*` variables are exposed to browser

---

### 7.2 Database Setup

1. **Create Supabase Project:**

- Go to https://supabase.com
- Create new project
- Copy URL and keys to `.env.local`

2. **Run Migrations:**

```bash
cd api-testing-dashboard/supabase

# Install Supabase CLI
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push
```

**Or manually run in Supabase SQL Editor:**

```sql
-- Run migrations in order:
-- 1. 20250107_create_annotator_tables.sql
-- 2. 20250108_add_semantic_context.sql
-- 3. 20250108_add_user_context_hint.sql
-- 4. 20250108_disable_annotator_rls.sql  (development only!)
-- 5. 20250109_fix_user_id_type.sql
-- 6. 20250110_add_annotation_feedback.sql
-- 7. 20250111_remove_context_chunks.sql
-- 8. 20260109_create_type_rules_table.sql
```

3. **Create Storage Bucket:**

- Go to Supabase Dashboard → Storage
- Create bucket: `annotator-files`
- Set to **Private** (RLS policies control access)

4. **Seed Type Rules (Optional):**

```sql
INSERT INTO annotator_type_rules (keyword, position, implied_type, priority) VALUES
  -- Money indicators
  ('EUR', 'after', 'Money', 10),
  ('CZK', 'after', 'Money', 10),
  ('USD', 'after', 'Money', 10),
  ('GBP', 'after', 'Money', 10),
  ('amount', 'before', 'Money', 8),
  ('price', 'before', 'Money', 8),
  ('sum', 'before', 'Money', 8),
  ('value', 'before', 'Money', 8),

  -- Date indicators
  ('dated', 'before', 'Date', 9),
  ('on', 'before', 'Date', 7),
  ('as of', 'before', 'Date', 9),
  ('effective', 'before', 'Date', 8),
  ('signed', 'before', 'Date', 8),

  -- Link indicators
  ('hereinafter', 'before', 'Link', 7),
  ('aforementioned', 'before', 'Link', 8),
  ('the', 'before', 'Link', 5);
```

---

### 7.3 Development Server

```bash
npm run dev
```

Open http://localhost:3000

**Available Routes:**

- `/annotator` - Dashboard
- `/annotator/train` - Upload training pairs
- `/annotator/annotate` - Annotate new document
- `/annotator/patterns` - Manage patterns

---

### 7.4 Production Deployment

**Deploy to Vercel:**

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Follow prompts, then:
vercel --prod
```

**Environment Variables in Vercel:**

1. Go to Vercel Dashboard → Project → Settings → Environment Variables
2. Add all variables from `.env.local`
3. Redeploy

**Supabase Production Setup:**

1. Use separate Supabase project for production
2. Run all migrations on production database
3. Update environment variables in Vercel

---

## 8. Configuration

### 8.1 Claude AI Configuration

**Model Selection:**

```typescript
// src/lib/annotator/claude-service.ts

const DEFAULT_MODEL = 'claude-opus-4-5-20251101';  // Latest Opus model
const DEFAULT_MAX_TOKENS = 8192;  // Maximum response length
```

**Cost Optimization:**

- Opus 4.5: $15/MTok input, $75/MTok output (high quality, expensive)
- Sonnet 4.5: $3/MTok input, $15/MTok output (good balance)
- Haiku 3.5: $0.25/MTok input, $1.25/MTok output (fast, cheap)

To switch models, change `DEFAULT_MODEL`:

```typescript
const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929';  // For cost savings
```

---

### 8.2 Rate Limiting

**API Routes:**

```typescript
// src/lib/annotator/api-utils.ts

export function withRateLimit(
  request: NextRequest,
  maxRequests: number = 30,  // Max requests per window
  windowMs: number = 60000   // Time window (1 minute)
): { error?: NextResponse } {
  // Simple in-memory rate limiting
  // For production, use Redis or Upstash
}
```

**Production Rate Limiting:**

Use Upstash Redis for distributed rate limiting:

```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(30, '1 m'),
});

const { success } = await ratelimit.limit(userId);
if (!success) {
  return errorResponse('RATE_LIMIT', 'Too many requests', 429);
}
```

---

### 8.3 File Size Limits

**Document Parsing:**

```typescript
// src/lib/annotator/api-utils.ts

export async function validateDocxFile(file: File): Promise<ValidationResult> {
  const MAX_FILE_SIZE = 10 * 1024 * 1024;  // 10MB

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`,
    };
  }

  if (!file.name.endsWith('.docx')) {
    return {
      valid: false,
      error: 'Only .docx files are supported',
    };
  }

  return { valid: true };
}
```

**Increase Limits (if needed):**

```typescript
const MAX_FILE_SIZE = 50 * 1024 * 1024;  // 50MB

// Also update Vercel settings:
// vercel.json:
{
  "functions": {
    "api/**/*.ts": {
      "maxDuration": 60,  // 60 seconds
      "memory": 3008      // 3GB RAM
    }
  }
}
```

---

### 8.4 Confidence Thresholds

**Pattern Matching:**

```typescript
// src/lib/annotator/pattern-service.ts

const CONFIDENCE_THRESHOLDS = {
  high: 0.8,      // Green (use confidently)
  medium: 0.5,    // Yellow (use with caution)
  low: 0.3,       // Red (likely incorrect)
};

// Only use patterns with confidence >= medium
const patterns = allPatterns.filter(p => p.confidence >= 0.5);
```

**Adjust Thresholds:**

```typescript
// More conservative (higher quality, fewer suggestions):
const CONFIDENCE_THRESHOLDS = {
  high: 0.9,
  medium: 0.7,
  low: 0.5,
};

// More aggressive (more suggestions, lower quality):
const CONFIDENCE_THRESHOLDS = {
  high: 0.7,
  medium: 0.4,
  low: 0.2,
};
```

---

### 8.5 Semantic Context Generation

**Batch Size:**

```typescript
// src/lib/annotator/claude-service.ts

const batchSize = 5;  // Process 5 patterns at a time
for (let i = 0; i < patterns.length; i += batchSize) {
  const batch = patterns.slice(i, i + batchSize);
  await Promise.all(batch.map(p => generateSemanticContext(...)));
}
```

**Disable for Development:**

```typescript
// Skip semantic context generation (saves API calls)
const SKIP_SEMANTIC_CONTEXT = process.env.NODE_ENV === 'development';

if (!SKIP_SEMANTIC_CONTEXT) {
  await generateSemanticContext(...);
}
```

---

## 9. Development Workflow

### 9.1 Adding a New Annotation Type

**Step 1: Update Type Definition**

```typescript
// src/types/annotator.ts

export type AnnotationType =
  | 'Text'
  | 'TextInput'
  | 'Select'
  | 'Date'
  | 'Link'
  | 'Money'
  | 'Calculation'
  | 'Checkbox';  // NEW TYPE

export const ANNOTATION_TYPE_LABELS: Record<AnnotationType, string> = {
  // ...existing
  Checkbox: 'Checkbox Field',  // NEW
};
```

**Step 2: Update Database**

```sql
-- Migration: add_checkbox_type.sql
ALTER TABLE annotator_patterns
DROP CONSTRAINT annotator_patterns_annotation_type_check;

ALTER TABLE annotator_patterns
ADD CONSTRAINT annotator_patterns_annotation_type_check
CHECK (annotation_type IN (
  'Text', 'TextInput', 'Select', 'Date', 'Link', 'Money', 'Calculation', 'Checkbox'
));
```

**Step 3: Update Claude Prompt**

```typescript
// src/lib/annotator/claude-service.ts

const SYSTEM_PROMPT = `...
ANNOTATION TYPES:
- [Checkbox] - For yes/no or true/false fields
...`;
```

**Step 4: Add Detection Rule**

```typescript
// src/lib/annotator/pattern-service.ts

export function detectTypeFromContent(text, contextBefore, contextAfter): AnnotationType | null {
  // ...existing rules

  // Checkbox detection
  if (/\[ \]|\[\s*\]/.test(text)) return 'Checkbox';
  if (/yes\/no|true\/false/i.test(text)) return 'Checkbox';

  return null;
}
```

**Step 5: Update UI**

```typescript
// src/components/annotator/annotation-badge.tsx

function getTypeColor(type: AnnotationType) {
  switch (type) {
    // ...existing
    case 'Checkbox': return 'bg-pink-100 text-pink-800';
  }
}
```

---

### 9.2 Testing Workflow

**Unit Tests (Vitest):**

```bash
npm run test
```

**E2E Tests (Playwright):**

```bash
# Assuming you add E2E tests
npm run test:e2e
```

**Manual Testing Checklist:**

1. **Training:**
   - [ ] Upload training pair
   - [ ] Verify patterns extracted
   - [ ] Check semantic context generated

2. **Annotation:**
   - [ ] Upload new document
   - [ ] Verify suggestions appear
   - [ ] Accept/reject/edit suggestions
   - [ ] Generate annotated DOCX
   - [ ] Download and open in Word

3. **Learning Loop:**
   - [ ] Upload corrected document
   - [ ] Verify new training pair created
   - [ ] Check patterns updated
   - [ ] Annotate similar document
   - [ ] Verify improved suggestions

---

### 9.3 Debugging Tips

**Enable Verbose Logging:**

```typescript
// src/lib/annotator/claude-service.ts

const DEBUG = true;  // Set to true for detailed logs

if (DEBUG) {
  console.log('[annotateDocument] Prompt:', userPrompt);
  console.log('[annotateDocument] Response:', response);
}
```

**Database Queries:**

```sql
-- Check pattern quality
SELECT
  annotation_type,
  AVG(confidence) as avg_confidence,
  AVG(success_rate) as avg_success_rate,
  COUNT(*) as count
FROM annotator_patterns
WHERE user_id = 'your-user-id'
GROUP BY annotation_type;

-- Find low-confidence patterns
SELECT original_text, annotated_text, confidence, success_rate
FROM annotator_patterns
WHERE user_id = 'your-user-id' AND confidence < 0.5
ORDER BY confidence ASC;

-- Check feedback distribution
SELECT
  feedback_type,
  COUNT(*) as count,
  (COUNT(*)::FLOAT / SUM(COUNT(*)) OVER ()) * 100 as percentage
FROM annotator_feedback
WHERE user_id = 'your-user-id'
GROUP BY feedback_type;
```

**Common Issues:**

1. **Patterns not matching:**
   - Check semantic context: `SELECT semantic_context FROM annotator_patterns WHERE id = ?`
   - Verify pattern confidence: `SELECT confidence FROM annotator_patterns WHERE id = ?`
   - Test fuzzy matching: Use semantic-matching-service

2. **Wrong annotation types:**
   - Check type rules: `SELECT * FROM annotator_type_rules WHERE keyword = ?`
   - Review context extraction: Check `contextKeywords` in pattern

3. **AI suggestions incorrect:**
   - Review system prompt in `claude-service.ts`
   - Check rejected patterns list: `GET /api/annotator/feedback?rejected=true`
   - Verify training examples are diverse

---

## 10. Troubleshooting

### 10.1 Common Errors

#### Error: "Claude API key not configured"

**Cause:** Missing `ANTHROPIC_API_KEY` environment variable

**Solution:**

```bash
# Development
echo "ANTHROPIC_API_KEY=sk-ant-api03-your-key" >> .env.local

# Production (Vercel)
vercel env add ANTHROPIC_API_KEY
```

---

#### Error: "Invalid DOCX file"

**Cause:** Corrupted or unsupported file format

**Solution:**

1. Verify file is actually .docx (not .doc)
2. Open in Microsoft Word and re-save as .docx
3. Check file size < 10MB
4. Try parsing manually:

```typescript
import { parseDocx } from '@/lib/annotator';

try {
  const parsed = await parseDocx(file);
  console.log('Parsed successfully:', parsed);
} catch (error) {
  console.error('Parse error:', error);
}
```

---

#### Error: "Pattern matching failed"

**Cause:** No patterns in database or patterns have low confidence

**Solution:**

```sql
-- Check if user has patterns
SELECT COUNT(*) FROM annotator_patterns WHERE user_id = 'your-id';

-- Check pattern confidence
SELECT original_text, confidence FROM annotator_patterns
WHERE user_id = 'your-id' AND confidence < 0.5;

-- Reset low-confidence patterns
UPDATE annotator_patterns
SET confidence = 0.8
WHERE user_id = 'your-id' AND confidence < 0.5;
```

---

#### Error: "Supabase storage upload failed"

**Cause:** Storage bucket not created or incorrect permissions

**Solution:**

1. Create bucket in Supabase Dashboard:
   - Go to Storage
   - Create bucket: `annotator-files`
   - Set to Private

2. Verify storage policies:

```sql
-- Check existing policies
SELECT * FROM storage.policies WHERE bucket_id = 'annotator-files';

-- Create upload policy if missing
CREATE POLICY "Users can upload own files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'annotator-files' AND
  auth.uid()::text = (storage.foldername(name))[2]
);
```

---

### 10.2 Performance Issues

#### Slow Pattern Matching

**Symptoms:** Annotation takes > 10 seconds

**Diagnosis:**

```typescript
console.time('Pattern Matching');
const matches = findPatternMatches(patterns, documentText);
console.timeEnd('Pattern Matching');
```

**Solutions:**

1. **Reduce pattern count:**

```sql
-- Delete unused patterns
DELETE FROM annotator_patterns
WHERE usage_count = 0 AND created_at < NOW() - INTERVAL '30 days';
```

2. **Index optimization:**

```sql
-- Add full-text search index
CREATE INDEX idx_patterns_original_text_trgm ON annotator_patterns
USING gin (original_text gin_trgm_ops);
```

3. **Cache patterns in memory:**

```typescript
let patternCache: Pattern[] | null = null;
let cacheTime: number = 0;
const CACHE_TTL = 5 * 60 * 1000;  // 5 minutes

async function getCachedPatterns(userId: string): Promise<Pattern[]> {
  if (patternCache && Date.now() - cacheTime < CACHE_TTL) {
    return patternCache;
  }

  patternCache = await loadPatternsFromDB(userId);
  cacheTime = Date.now();
  return patternCache;
}
```

---

#### High Claude API Costs

**Symptoms:** Monthly bill > expected

**Solutions:**

1. **Use cheaper model:**

```typescript
const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929';  // Instead of opus
```

2. **Reduce prompt size:**

```typescript
const maxExamples = 3;  // Instead of 5
const maxPatterns = 20;  // Instead of 30
```

3. **Cache semantic context:**

```typescript
// Only generate if missing
if (!pattern.semanticContext) {
  pattern.semanticContext = await generateSemanticContext(...);
}
```

4. **Monitor usage:**

```typescript
console.log(`[Claude] Prompt tokens: ${promptTokens}`);
console.log(`[Claude] Response tokens: ${responseTokens}`);
console.log(`[Claude] Estimated cost: $${(promptTokens * 0.000015 + responseTokens * 0.000075).toFixed(4)}`);
```

---

### 10.3 Data Issues

#### Duplicate Patterns

**Symptoms:** Same pattern appears multiple times with different IDs

**Diagnosis:**

```sql
SELECT original_text, annotated_text, COUNT(*)
FROM annotator_patterns
WHERE user_id = 'your-id'
GROUP BY original_text, annotated_text
HAVING COUNT(*) > 1;
```

**Solution:**

```sql
-- Keep highest confidence, delete duplicates
WITH ranked_patterns AS (
  SELECT *,
    ROW_NUMBER() OVER (
      PARTITION BY original_text, annotated_text
      ORDER BY confidence DESC, usage_count DESC
    ) as rn
  FROM annotator_patterns
  WHERE user_id = 'your-id'
)
DELETE FROM annotator_patterns
WHERE id IN (
  SELECT id FROM ranked_patterns WHERE rn > 1
);
```

---

#### Missing Semantic Context

**Symptoms:** Fuzzy matching not working

**Diagnosis:**

```sql
SELECT COUNT(*) as missing_context
FROM annotator_patterns
WHERE user_id = 'your-id' AND (semantic_context IS NULL OR semantic_context = '');
```

**Solution:**

```typescript
// Backfill semantic context
import { generateSemanticContextBatch } from '@/lib/annotator/claude-service';

const patterns = await loadPatterns(userId);
const missingContext = patterns.filter(p => !p.semanticContext);

const contexts = await generateSemanticContextBatch(
  missingContext.map(p => ({
    originalText: p.originalText,
    annotatedText: p.annotatedText,
    annotationType: p.annotationType,
  }))
);

// Update database
for (const [originalText, context] of contexts) {
  await supabase
    .from('annotator_patterns')
    .update({ semantic_context: context })
    .eq('original_text', originalText)
    .eq('user_id', userId);
}
```

---

## Appendix A: Code Style Guide

### TypeScript Conventions

```typescript
// ✅ Good
export interface AnnotationSuggestion {
  id: string;
  originalText: string;
  annotatedText: string;
  type: AnnotationType;
  position: { start: number; end: number };
  confidence: number;
}

// ❌ Bad (missing interface, unclear naming)
export type Suggestion = {
  id: string;
  orig: string;
  annot: string;
  t: string;
  pos: any;
  conf: number;
};
```

### Function Documentation

```typescript
/**
 * Extracts annotation patterns from a training pair.
 *
 * @param originalText - Plain text from original document
 * @param annotatedText - Plain text from annotated document
 * @param trainingPairId - Optional training pair ID to link patterns
 * @returns Object containing extracted patterns and summary
 *
 * @example
 * ```typescript
 * const { patterns, summary } = extractPatterns(
 *   "Creditor's name: _____",
 *   "Creditor's name: [Textinput: Creditor's name]"
 * );
 * console.log(`Extracted ${summary.total} patterns`);
 * ```
 */
export function extractPatterns(
  originalText: string,
  annotatedText: string,
  trainingPairId?: string
): PatternExtractionResult {
  // Implementation
}
```

---

## Appendix B: Database Maintenance

### Regular Maintenance Tasks

**Weekly:**

```sql
-- Vacuum tables
VACUUM ANALYZE annotator_patterns;
VACUUM ANALYZE annotator_training_pairs;
VACUUM ANALYZE annotator_sessions;
VACUUM ANALYZE annotator_feedback;

-- Update statistics
ANALYZE annotator_patterns;
```

**Monthly:**

```sql
-- Archive old sessions (> 90 days)
INSERT INTO annotator_sessions_archive
SELECT * FROM annotator_sessions
WHERE created_at < NOW() - INTERVAL '90 days';

DELETE FROM annotator_sessions
WHERE created_at < NOW() - INTERVAL '90 days';

-- Clean up unused patterns
DELETE FROM annotator_patterns
WHERE usage_count = 0
  AND created_at < NOW() - INTERVAL '90 days';
```

---

## Appendix C: API Response Examples

### Full Annotation Flow

**1. Upload Training Pair:**

```bash
curl -X POST http://localhost:3000/api/annotator/training \
  -H "Cookie: session=..." \
  -F "name=Loan Agreement Template" \
  -F "originalFile=@original.docx" \
  -F "annotatedFile=@annotated.docx"
```

Response:

```json
{
  "success": true,
  "trainingPair": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Loan Agreement Template",
    "patternsExtracted": [
      {
        "originalText": "_____",
        "annotatedText": "[Textinput: Creditor's name]",
        "type": "TextInput"
      }
    ]
  },
  "patternsExtracted": 15
}
```

**2. Annotate New Document:**

```bash
curl -X POST http://localhost:3000/api/annotator/annotate \
  -H "Cookie: session=..." \
  -F "file=@new_loan.docx"
```

Response:

```json
{
  "success": true,
  "session": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "inputFilename": "new_loan.docx",
    "status": "pending",
    "documentType": "loan_agreement",
    "documentTypeConfidence": 0.92
  },
  "suggestions": [
    {
      "id": "770e8400-e29b-41d4-a716-446655440002",
      "originalText": "_____",
      "annotatedText": "[Textinput: Creditor's name]",
      "type": "TextInput",
      "position": { "start": 245, "end": 250 },
      "confidence": 0.95,
      "isAccepted": true,
      "isFromPattern": true
    }
  ],
  "stats": {
    "totalSuggestions": 18,
    "patternsAvailable": 45,
    "patternMatched": 18
  }
}
```

**3. Generate Annotated Document:**

```bash
curl -X POST http://localhost:3000/api/annotator/annotate/generate \
  -H "Cookie: session=..." \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "660e8400-e29b-41d4-a716-446655440001",
    "annotations": [...],  # From suggestions
    "saveAsPatterns": false
  }'
```

Response:

```json
{
  "success": true,
  "downloadUrl": "/api/annotator/download/660e8400-e29b-41d4-a716-446655440001",
  "outputFilePath": "sessions/user-id/660e8400_output.docx"
}
```

---

## Glossary

| Term | Definition |
|------|------------|
| **Annotation** | A fillable field marker in Legito format, e.g., `[Textinput: Name]` |
| **Pattern** | A learned transformation: "___" → "[Textinput: Name]" |
| **Training Pair** | Two documents (original + annotated) used to teach the system |
| **Semantic Context** | AI-generated description of what a pattern represents |
| **Confidence Score** | 0-1 value indicating pattern reliability |
| **Success Rate** | Historical acceptance rate of a pattern |
| **Link** | Annotation type that auto-fills from an earlier field |
| **Fuzzy Matching** | Finding similar patterns using semantic meaning |
| **Learning Loop** | Process where corrections become new training data |
| **Context Keywords** | Words near a placeholder that indicate its type |

---

## Support & Resources

- **GitHub Issues:** [Project Repository Issues](https://github.com/your-org/smart-annotator/issues)
- **Documentation:** This file
- **API Reference:** Section 5
- **Database Schema:** Section 6

---

**Document Version:** 1.0
**Last Updated:** 2026-01-19
**Next Review:** 2026-02-19

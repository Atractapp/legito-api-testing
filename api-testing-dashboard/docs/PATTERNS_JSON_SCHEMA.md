# Patterns JSON Schema

This document describes the JSON format for pattern files used by the Headless Smart Annotator.

## Overview

The patterns file contains learned annotation patterns that help the annotator recognize document placeholders. These patterns are exported from the Supabase database and mounted at runtime.

## File Location

Default: `/app/data/patterns.json`

Override: Set `PATTERNS_FILE_PATH` environment variable.

## JSON Schema

```json
{
  "version": "1.0",
  "exportedAt": "2026-01-21T10:00:00Z",
  "exportedFrom": "https://xxx.supabase.co",
  "totalPatterns": 100,
  "byType": {
    "Text": 0,
    "TextInput": 45,
    "Select": 20,
    "Date": 15,
    "Link": 10,
    "Money": 8,
    "Calculation": 2
  },
  "patterns": [
    {
      "originalText": "...",
      "annotatedText": "...",
      "annotationType": "...",
      "confidence": 0.95,
      "semanticContext": "...",
      "contextKeywords": {
        "before": ["..."],
        "after": ["..."]
      }
    }
  ]
}
```

## Field Descriptions

### Root Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `version` | string | Yes | Schema version (currently "1.0") |
| `exportedAt` | string | No | ISO 8601 timestamp of export |
| `exportedFrom` | string | No | Source database URL |
| `totalPatterns` | number | No | Total count of patterns |
| `byType` | object | No | Count of patterns by annotation type |
| `patterns` | array | Yes | Array of pattern objects |

### Pattern Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `originalText` | string | Yes | The original text to match |
| `annotatedText` | string | Yes | The annotation replacement |
| `annotationType` | string | Yes | Type of annotation |
| `confidence` | number | No | Confidence score (0-1), default 0.8 |
| `semanticContext` | string | No | AI-generated description of the field |
| `contextKeywords` | object | No | Context words that help matching |

### Annotation Types

Valid values for `annotationType`:

| Type | Description | Example |
|------|-------------|---------|
| `Text` | Static text element | Rarely used |
| `TextInput` | User input field | `[Textinput: Name]` |
| `Select` | Dropdown selection | `[Select: Mr/Ms]` |
| `Date` | Date picker field | `[Date]` |
| `Link` | Reference to another field | `[Link]` |
| `Money` | Currency/money field | `[Money]` |
| `Calculation` | Calculated formula | `[Calculation]` |

### Context Keywords

The `contextKeywords` object helps disambiguate patterns that appear in different contexts:

```json
{
  "contextKeywords": {
    "before": ["dated", "as of", "on"],
    "after": ["year", "month"]
  }
}
```

- `before`: Words that typically appear before this pattern
- `after`: Words that typically appear after this pattern

## Example Patterns

### TextInput Pattern

```json
{
  "originalText": "Creditor's name",
  "annotatedText": "[Textinput: Creditor's name]",
  "annotationType": "TextInput",
  "confidence": 0.95,
  "semanticContext": "Party name field. Could match: Seller, Buyer, Lessor, Lessee, Borrower, Lender"
}
```

### Select Pattern (Title)

```json
{
  "originalText": "Mr/Ms",
  "annotatedText": "[Select: Mr/Ms]",
  "annotationType": "Select",
  "confidence": 0.95,
  "semanticContext": "Title/salutation selection. English honorific pattern."
}
```

### Date Pattern

```json
{
  "originalText": "DD.MM.YYYY",
  "annotatedText": "[Date]",
  "annotationType": "Date",
  "confidence": 0.95,
  "semanticContext": "Date format placeholder with D/M/Y markers",
  "contextKeywords": {
    "before": ["dated", "as of", "effective"],
    "after": ["roku", "year"]
  }
}
```

### Money Pattern

```json
{
  "originalText": "XXX,- EUR",
  "annotatedText": "[Money]",
  "annotationType": "Money",
  "confidence": 0.95,
  "semanticContext": "Money amount placeholder with currency indicator",
  "contextKeywords": {
    "before": ["amount", "sum", "price", "value"],
    "after": ["EUR", "USD", "CZK", "%"]
  }
}
```

### Link Pattern (Duplicate Reference)

```json
{
  "originalText": "Creditor's name",
  "annotatedText": "[Link]",
  "annotationType": "Link",
  "confidence": 0.85,
  "semanticContext": "Party name reference for duplicate occurrences",
  "contextKeywords": {
    "before": ["hereinafter", "the", "said"]
  }
}
```

## Exporting Patterns

Use the export script to create a patterns file from Supabase:

```bash
# Set environment variables
export NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=xxx

# Run export script
npx tsx scripts/export-patterns-to-json.ts

# Or with custom output path
npx tsx scripts/export-patterns-to-json.ts --output ./custom/path.json
```

## Validation

### JSON Validation

The patterns file must be valid JSON. Test with:

```bash
cat /app/data/patterns.json | jq .
```

### Schema Validation

Required fields are validated at load time:
- Each pattern must have `originalText`, `annotatedText`, and `annotationType`
- `annotationType` must be a valid type (see table above)
- Invalid patterns are skipped with a warning

### Testing Patterns

Test pattern loading locally:

```bash
# Start the service
npm start

# Check health endpoint for patterns loaded count
curl http://localhost:3000/health | jq '.patternsLoaded'
```

## Updating Patterns

1. **Export** new patterns from Supabase using the export script
2. **Validate** the JSON file format
3. **Replace** the mounted patterns file
4. **Restart** the service (patterns are cached at startup)
5. **Verify** via health endpoint that patterns loaded correctly

## Best Practices

1. **Regular exports**: Export patterns weekly or after significant training
2. **Version control**: Keep patterns files in git for change tracking
3. **Validation**: Always validate JSON before deployment
4. **Backup**: Keep previous versions in case of issues
5. **Documentation**: Document pattern changes in changelog

## Troubleshooting

### Patterns not loading

1. Check file exists: `ls -la /app/data/patterns.json`
2. Check JSON validity: `cat /app/data/patterns.json | jq .`
3. Check file permissions: Service must have read access
4. Check logs for validation errors

### Low pattern count

1. Verify export was successful
2. Check for validation errors in logs
3. Ensure Supabase connection was valid during export

### Pattern matching issues

1. Check `originalText` matches exactly (case-sensitive)
2. Review `semanticContext` for matching hints
3. Add `contextKeywords` to improve disambiguation

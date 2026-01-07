# Legito Word Import Annotations Reference

This document provides a comprehensive reference for Legito annotations used when importing Word documents.

**Source**: https://www.legito.com/knowledge-base/import-from-word/

---

## Overview

Legito supports converting Word document text into structured elements using bracket-based annotations. The conversion accuracy exceeds 90% for most documents. Documents can be imported without modification for initial text conversion, and annotations can be added pre-import or post-import in the Template Editor.

---

## Annotation Syntax Rules

### Rule 1: Bracket Enclosure
All annotations must be enclosed in square brackets `[ ]`.

### Rule 2: Uniform Formatting
**Critical**: Each annotation (including its brackets) must have the same formatting throughout:
- Same font style
- Same font size
- Same text color
- Same bold/italic/underline settings
- Same background color

### Rule 3: Independent Formatting
Different annotations can have different formatting from each other - the uniform formatting requirement only applies within each individual annotation.

---

## Supported Annotation Types

### 1. Text Element
Creates unique text elements from bracketed content.

| Format | Description |
|--------|-------------|
| `[content here]` | Wraps text as a distinct Text Element |

**Example:**
```
Original:  This Agreement is entered into by Company Name on this date.
Annotated: This Agreement is entered into by [Company Name] on this [date].
```

**Note:** Text without brackets becomes a single combined element.

---

### 2. TextInput (Editable Text Field)
Creates an editable text input field.

| Format | Description |
|--------|-------------|
| `[TextInput: label]` | Text input with visible label |
| `[TextInput]` | Text input without label |

**Examples:**
```
[TextInput: Company Name]     → Creates labeled text input
[TextInput: Address]          → Creates labeled text input
[TextInput]                   → Creates unlabeled text input
```

**Use cases:**
- Party names
- Addresses
- Custom values
- Any free-form text entry

---

### 3. Select (Dropdown/Multiple Choice)
Creates a dropdown selection field with predefined options.

| Format | Description |
|--------|-------------|
| `[Select: option1/option2/option3]` | Dropdown with unlimited options separated by `/` |

**Examples:**
```
[Select: Yes/No]                      → Two options
[Select: Net 30/Net 60/Net 90]        → Three options
[Select: Option A/Option B/Option C/Option D]  → Four options
```

**Rules:**
- Options are separated by forward slash `/`
- Unlimited number of options supported
- First option is typically the default

**Use cases:**
- Yes/No choices
- Payment terms
- Contract types
- Any predefined selection

---

### 4. Date
Creates a date picker field.

| Format | Description |
|--------|-------------|
| `[Date]` | Date picker (no additional parameters) |

**Example:**
```
This Agreement shall be effective as of [Date].
```

**Use cases:**
- Effective dates
- Expiration dates
- Signing dates
- Any date field

---

### 5. Link
Creates a hyperlink field.

| Format | Description |
|--------|-------------|
| `[Link]` | Hyperlink field (no additional parameters) |

**Example:**
```
For more information, visit [Link].
```

**Use cases:**
- Website references
- Document links
- External resources

---

### 6. Money
Creates a monetary value field.

| Format | Description |
|--------|-------------|
| `[Money]` | Monetary value field (no additional parameters) |

**Example:**
```
The total amount due is [Money].
```

**Use cases:**
- Contract values
- Payment amounts
- Fees and charges
- Any currency value

---

### 7. Calculation
Creates a calculated field (formula-based).

| Format | Description |
|--------|-------------|
| `[Calculation]` | Calculated value field (no additional parameters) |

**Example:**
```
The total with tax is [Calculation].
```

**Use cases:**
- Derived values
- Totals
- Tax calculations
- Any formula-based field

---

## Quick Reference Table

| Element | Format | Example | Has Parameters |
|---------|--------|---------|----------------|
| Text | `[text]` | `[Party A]` | No |
| TextInput | `[TextInput: label]` | `[TextInput: Name]` | Optional label |
| Select | `[Select: opt/opt/opt]` | `[Select: Yes/No]` | Required options |
| Date | `[Date]` | `[Date]` | No |
| Link | `[Link]` | `[Link]` | No |
| Money | `[Money]` | `[Money]` | No |
| Calculation | `[Calculation]` | `[Calculation]` | No |

---

## Formatting Preservation

When importing Word documents, Legito captures and preserves:

- Font type
- Font size
- Text spacing
- Text color
- Highlight/background color
- Bold, italic, underline
- Paragraph alignment
- List formatting

### Styles

Legito styles can be created from Word document styles and assigned to relevant clauses. This includes:
- Heading styles (Heading 1, Heading 2, etc.)
- Paragraph styles
- Custom styles defined in the document

### Numbering

Clause numbering restart settings may be imported if selected during the import process.

---

## Best Practices

### 1. Consistent Formatting
Ensure each annotation has uniform formatting throughout. If you select `[TextInput: Name]`, make sure the entire string including brackets has the same font, size, and style.

### 2. Clear Labels
Use descriptive labels for TextInput fields:
- Good: `[TextInput: Client Full Name]`
- Poor: `[TextInput: n1]`

### 3. Logical Select Options
Order Select options logically:
- Most common option first
- Alphabetical order for long lists
- Logical progression (e.g., Net 30/Net 60/Net 90)

### 4. Annotation Placement
Place annotations exactly where the dynamic content should appear. Don't add extra spaces inside brackets.

### 5. Testing
After import, test each annotation in the Template Editor to ensure it behaves as expected.

---

## Common Patterns

### Contract Party Definition
```
This Agreement ("Agreement") is entered into by and between
[TextInput: Party A Name], a [Select: corporation/LLC/partnership]
organized under the laws of [TextInput: State], ("Party A"), and
[TextInput: Party B Name], a [Select: corporation/LLC/partnership]
organized under the laws of [TextInput: State], ("Party B").
```

### Payment Terms
```
Payment shall be due within [Select: Net 15/Net 30/Net 45/Net 60] days
of invoice date. The total amount payable is [Money].
```

### Effective Date Clause
```
This Agreement shall be effective as of [Date] (the "Effective Date")
and shall continue until [Date] (the "Termination Date"), unless
terminated earlier in accordance with the terms hereof.
```

### Contact Information
```
Notices shall be sent to:
[TextInput: Company Name]
[TextInput: Street Address]
[TextInput: City], [TextInput: State] [TextInput: ZIP Code]
Attention: [TextInput: Contact Name]
Email: [TextInput: Email Address]
```

---

## Regex Patterns for Detection

For programmatic detection of Legito annotations:

```typescript
// Match any annotation
const anyAnnotation = /\[([^\]]+)\]/g;

// Match TextInput with label
const textInputWithLabel = /\[TextInput:\s*([^\]]+)\]/g;

// Match TextInput without label
const textInputNoLabel = /\[TextInput\]/g;

// Match Select with options
const selectAnnotation = /\[Select:\s*([^\]]+)\]/g;

// Match simple annotations (Date, Link, Money, Calculation)
const simpleAnnotation = /\[(Date|Link|Money|Calculation)\]/g;

// Extract Select options
function extractSelectOptions(annotation: string): string[] {
  const match = annotation.match(/\[Select:\s*([^\]]+)\]/);
  if (match) {
    return match[1].split('/').map(opt => opt.trim());
  }
  return [];
}
```

---

## Error Handling

### Common Issues

1. **Mixed Formatting**: Annotation has different fonts/styles within brackets
   - Solution: Select entire annotation and apply uniform formatting

2. **Unclosed Brackets**: Missing closing `]`
   - Solution: Check for matching bracket pairs

3. **Invalid Select Format**: Options not separated by `/`
   - Solution: Use `/` between each option

4. **Nested Brackets**: Brackets inside brackets
   - Solution: Flatten to single bracket level

### Validation Rules

```typescript
function validateAnnotation(text: string): { valid: boolean; error?: string } {
  // Check for balanced brackets
  const openCount = (text.match(/\[/g) || []).length;
  const closeCount = (text.match(/\]/g) || []).length;
  if (openCount !== closeCount) {
    return { valid: false, error: 'Unbalanced brackets' };
  }

  // Check for valid annotation types
  const validTypes = ['TextInput', 'Select', 'Date', 'Link', 'Money', 'Calculation'];
  const typeMatch = text.match(/\[(TextInput|Select|Date|Link|Money|Calculation)/);
  if (typeMatch && !validTypes.includes(typeMatch[1])) {
    return { valid: false, error: `Invalid annotation type: ${typeMatch[1]}` };
  }

  // Check Select has options
  if (text.includes('[Select:')) {
    const options = text.match(/\[Select:\s*([^\]]*)\]/);
    if (!options || !options[1].includes('/')) {
      return { valid: false, error: 'Select must have at least 2 options separated by /' };
    }
  }

  return { valid: true };
}
```

---

## Version History

- **v1.0** (2025-01-07): Initial reference document created for Smart Annotator app

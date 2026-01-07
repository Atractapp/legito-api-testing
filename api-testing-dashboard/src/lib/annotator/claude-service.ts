/**
 * Claude Service - LLM integration for document annotation
 *
 * Uses Claude API for intelligent document annotation based on
 * training examples and learned patterns.
 */

import Anthropic from '@anthropic-ai/sdk';
import type {
  Pattern,
  TrainingPair,
  ClaudeAnnotationResponse,
  AnnotationType,
  Annotation,
} from '@/types/annotator';
import { detectTypeFromContent } from './pattern-service';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface AnnotateDocumentOptions {
  document: string;
  trainingExamples: Array<{
    original: string;
    annotated: string;
  }>;
  patterns: Pattern[];
  maxExamples?: number;
  confidenceThreshold?: number;
}

export interface ClaudeServiceConfig {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
}

// ----------------------------------------------------------------------------
// Default Configuration
// ----------------------------------------------------------------------------

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';
const DEFAULT_MAX_TOKENS = 8192;

// ----------------------------------------------------------------------------
// System Prompt
// ----------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a legal document annotation expert specializing in Legito document format. Your task is to identify and annotate ONLY the fillable/variable fields in documents - places where users need to enter specific information.

## CRITICAL: What to Annotate vs What to Leave Alone

### ONLY ANNOTATE these (fillable fields):
- Explicit placeholders: _____, XXXX, ........, [fill in], <blank>
- Date placeholders: XX.XX.XXXX, DD.MM.YYYY, __.__.____
- Amount placeholders: XXX, 0,00, _____ EUR
- Example data meant to be replaced: "John Doe", "123 Main St" (when clearly a template example)
- Blank lines or underscored areas for signatures, names, addresses

### NEVER ANNOTATE these (static text):
- Legal boilerplate text ("This Agreement is entered into...")
- Section headings ("Article 1", "Terms and Conditions")
- Standard contract language ("The parties agree that...")
- Definitions and explanations
- Normal sentences and paragraphs
- References like "the Buyer", "the Seller" (unless they are placeholders)
- Specific company names, addresses that are part of the template itself
- ANY text that doesn't have visual indicators of being fillable

## Legito Annotation Formats

1. **TextInput** - [TextInput: label] or [TextInput]
2. **Select** - [Select: option1/option2/option3]
3. **Date** - [Date]
4. **Money** - [Money]
5. **Link** - [Link]
6. **Calculation** - [Calculation]

## How to Identify Fillable Fields

Look for these VISUAL INDICATORS:
1. Underscores: _____, ____________
2. Dots: .........., ................
3. X patterns: XXX, XX.XX.XXXX
4. Brackets with hints: [name], [address], [date]
5. Blank lines preceded by labels: "Name: _______"
6. Obvious placeholder text in all caps or with markers

## Type Selection Rules

- **Date**: Only for date placeholders (XX.XX.XXXX, __.__.____) or text explicitly near "date:", "dated", "valid until"
- **Money**: Only for amount placeholders with currency context (XXX EUR, _____ CZK, 0,00)
- **Select**: Only for explicit choices (yes/no, option A/option B)
- **TextInput**: For all other fillable placeholders (names, addresses, company names)

## IMPORTANT: Be Conservative!

- When in doubt, DO NOT annotate
- If text looks like normal document content, leave it alone
- Only annotate what is CLEARLY meant to be filled in by the user
- A typical contract might have only 10-30 fillable fields, not hundreds
- Static text (the majority of any document) should remain unchanged

## Output Format

Return your response as valid JSON with this structure:
{
  "annotated_text": "The complete document text with annotations inserted",
  "annotations": [
    {
      "original": "the text that was replaced",
      "annotated": "[TextInput: label]",
      "type": "TextInput",
      "position": { "start": 0, "end": 10 },
      "confidence": 0.95
    }
  ],
  "metadata": {
    "document_type_detected": "contract",
    "total_annotations": 5,
    "low_confidence_count": 1
  }
}`;

// ----------------------------------------------------------------------------
// Claude Service Class
// ----------------------------------------------------------------------------

class ClaudeService {
  private client: Anthropic | null = null;
  private model: string;
  private maxTokens: number;

  constructor(config: ClaudeServiceConfig = {}) {
    this.model = config.model || DEFAULT_MODEL;
    this.maxTokens = config.maxTokens || DEFAULT_MAX_TOKENS;

    const apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      this.client = new Anthropic({ apiKey });
    }
  }

  /**
   * Check if the service is configured
   */
  isConfigured(): boolean {
    return this.client !== null;
  }

  /**
   * Annotate a document using Claude
   */
  async annotateDocument(
    options: AnnotateDocumentOptions
  ): Promise<ClaudeAnnotationResponse> {
    if (!this.client) {
      throw new Error('Claude API key not configured');
    }

    const {
      document,
      trainingExamples,
      patterns,
      maxExamples = 5,
      confidenceThreshold = 0.5,
    } = options;

    // Build the prompt
    const userPrompt = this.buildUserPrompt(
      document,
      trainingExamples.slice(0, maxExamples),
      patterns.filter((p) => p.confidence >= confidenceThreshold)
    );

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      });

      // Extract text response
      const textContent = response.content.find((c) => c.type === 'text');
      if (!textContent || textContent.type !== 'text') {
        throw new Error('No text response from Claude');
      }

      // Parse JSON response
      const parsed = this.parseResponse(textContent.text);

      // Apply rule-based refinement to validate/improve annotation types
      const refined = refineAnnotations(parsed, document);

      return refined;
    } catch (error) {
      console.error('Claude API error:', error);
      throw error;
    }
  }

  /**
   * Build the user prompt with examples and document
   */
  private buildUserPrompt(
    document: string,
    examples: Array<{ original: string; annotated: string }>,
    patterns: Pattern[]
  ): string {
    let prompt = '';

    // Add training examples
    if (examples.length > 0) {
      prompt += '## Training Examples\n\n';
      prompt += 'Here are examples of how documents should be annotated:\n\n';

      examples.forEach((example, index) => {
        prompt += `### Example ${index + 1}\n\n`;
        prompt += '**Original:**\n```\n';
        prompt += truncateText(example.original, 2000);
        prompt += '\n```\n\n';
        prompt += '**Annotated:**\n```\n';
        prompt += truncateText(example.annotated, 2000);
        prompt += '\n```\n\n';
      });
    }

    // Add learned patterns
    if (patterns.length > 0) {
      prompt += '## Learned Annotation Patterns\n\n';
      prompt += 'Apply these patterns where you find similar content:\n\n';

      // Group patterns by type
      const patternsByType = groupPatternsByType(patterns);

      for (const [type, typePatterns] of Object.entries(patternsByType)) {
        if (typePatterns.length === 0) continue;

        prompt += `### ${type} Patterns\n`;
        typePatterns.slice(0, 5).forEach((pattern) => {
          prompt += `- "${pattern.originalText}" → ${pattern.annotatedText}`;
          if (pattern.confidence < 0.8) {
            prompt += ` (confidence: ${(pattern.confidence * 100).toFixed(0)}%)`;
          }
          prompt += '\n';
        });
        prompt += '\n';
      }
    }

    // Add the document to annotate
    prompt += '## Document to Annotate\n\n';
    prompt += 'Please annotate the following document:\n\n```\n';
    prompt += document;
    prompt += '\n```\n\n';

    // Add instructions
    prompt += '## Instructions\n\n';
    prompt += '1. Analyze the document and identify text that should be annotated\n';
    prompt += '2. Apply annotations based on the training examples and patterns\n';
    prompt += '3. Use appropriate annotation types for each piece of content\n';
    prompt += '4. Return the annotated document as JSON\n';
    prompt += '5. Include confidence scores for each annotation\n';

    return prompt;
  }

  /**
   * Parse Claude's response into structured format
   */
  private parseResponse(responseText: string): ClaudeAnnotationResponse {
    // Try to extract JSON from the response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      // If no JSON found, create a basic response
      return this.createFallbackResponse(responseText);
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]);

      // Validate and normalize the response
      return {
        annotatedText: parsed.annotated_text || parsed.annotatedText || responseText,
        annotations: (parsed.annotations || []).map(normalizeAnnotation),
        metadata: {
          documentTypeDetected: parsed.metadata?.document_type_detected,
          totalAnnotations: parsed.annotations?.length || 0,
          lowConfidenceCount:
            parsed.metadata?.low_confidence_count ||
            (parsed.annotations || []).filter(
              (a: { confidence?: number }) => (a.confidence || 0) < 0.7
            ).length,
        },
      };
    } catch (error) {
      console.error('Failed to parse Claude response:', error);
      return this.createFallbackResponse(responseText);
    }
  }

  /**
   * Create a fallback response when JSON parsing fails
   */
  private createFallbackResponse(text: string): ClaudeAnnotationResponse {
    // Try to extract annotations from the text
    const annotationRegex =
      /\[(TextInput(?::\s*[^\]]+)?|Select:\s*[^\]]+|Date|Link|Money|Calculation)\]/g;
    const annotations: ClaudeAnnotationResponse['annotations'] = [];

    let match;
    while ((match = annotationRegex.exec(text)) !== null) {
      annotations.push({
        original: match[0],
        annotated: match[0],
        type: detectType(match[0]),
        position: {
          start: match.index,
          end: match.index + match[0].length,
        },
        confidence: 0.5, // Lower confidence for fallback
      });
    }

    return {
      annotatedText: text,
      annotations,
      metadata: {
        totalAnnotations: annotations.length,
        lowConfidenceCount: annotations.length, // All are low confidence
      },
    };
  }
}

// ----------------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------------

/**
 * Truncate text to a maximum length
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '\n[... truncated ...]';
}

/**
 * Group patterns by annotation type
 */
function groupPatternsByType(
  patterns: Pattern[]
): Record<AnnotationType, Pattern[]> {
  const grouped: Record<AnnotationType, Pattern[]> = {
    Text: [],
    TextInput: [],
    Select: [],
    Date: [],
    Link: [],
    Money: [],
    Calculation: [],
  };

  for (const pattern of patterns) {
    grouped[pattern.annotationType].push(pattern);
  }

  return grouped;
}

/**
 * Detect annotation type from annotation string
 */
function detectType(annotation: string): AnnotationType {
  if (annotation.startsWith('[TextInput')) return 'TextInput';
  if (annotation.startsWith('[Select:')) return 'Select';
  if (annotation === '[Date]') return 'Date';
  if (annotation === '[Link]') return 'Link';
  if (annotation === '[Money]') return 'Money';
  if (annotation === '[Calculation]') return 'Calculation';
  return 'Text';
}

/**
 * Normalize an annotation object
 */
function normalizeAnnotation(raw: Record<string, unknown>): ClaudeAnnotationResponse['annotations'][0] {
  const position = raw.position as { start?: number; end?: number } | undefined;
  return {
    original: String(raw.original || ''),
    annotated: String(raw.annotated || ''),
    type: (raw.type as AnnotationType) || detectType(String(raw.annotated || '')),
    position: {
      start: Number(position?.start) || 0,
      end: Number(position?.end) || 0,
    },
    confidence: Number(raw.confidence) || 0.5,
  };
}

/**
 * Post-process AI annotations to validate/refine types using rule-based detection
 * This catches cases where the AI might have used a generic type when a more specific one applies
 */
function refineAnnotationType(
  annotation: ClaudeAnnotationResponse['annotations'][0],
  documentText: string
): ClaudeAnnotationResponse['annotations'][0] {
  // Extract context around the annotation position
  const contextStart = Math.max(0, annotation.position.start - 100);
  const contextEnd = Math.min(documentText.length, annotation.position.end + 100);
  const contextBefore = documentText.substring(contextStart, annotation.position.start);
  const contextAfter = documentText.substring(annotation.position.end, contextEnd);

  // Use rule-based detection to validate/refine type
  const detectedType = detectTypeFromContent(
    annotation.original,
    contextBefore,
    contextAfter
  );

  // Override if rule-based detection found a more specific type
  // TextInput is generic - prefer more specific types when detected
  if (detectedType && annotation.type === 'TextInput') {
    return {
      ...annotation,
      type: detectedType,
      annotated: updateAnnotationText(annotation.annotated, detectedType),
    };
  }

  // Also upgrade from Text to more specific types
  if (detectedType && annotation.type === 'Text') {
    return {
      ...annotation,
      type: detectedType,
      annotated: updateAnnotationText(annotation.annotated, detectedType),
    };
  }

  // Validate Money annotations contain numeric/currency patterns
  if (annotation.type === 'Money') {
    const hasMoneyIndicators = /[$€£¥]|Kč|\d|xxx|amount/i.test(
      annotation.original + contextBefore + contextAfter
    );
    if (!hasMoneyIndicators) {
      // Downgrade to TextInput if no money indicators
      return {
        ...annotation,
        type: 'TextInput',
        annotated: `[TextInput: ${extractLabelFromAnnotation(annotation.annotated) || annotation.original}]`,
      };
    }
  }

  // Validate Date annotations have temporal indicators
  if (annotation.type === 'Date') {
    const hasDateIndicators = /\d|xx|date|month|year|day/i.test(
      annotation.original + contextBefore + contextAfter
    );
    if (!hasDateIndicators) {
      // Downgrade to TextInput if no date indicators
      return {
        ...annotation,
        type: 'TextInput',
        annotated: `[TextInput: ${extractLabelFromAnnotation(annotation.annotated) || annotation.original}]`,
      };
    }
  }

  return annotation;
}

/**
 * Update annotation text to match a new type
 */
function updateAnnotationText(currentAnnotation: string, newType: AnnotationType): string {
  // Extract label from current annotation if it has one
  const labelMatch = currentAnnotation.match(/^\[(?:TextInput|Text):\s*([^\]]+)\]$/);
  if (labelMatch) {
    const label = labelMatch[1];
    // For types that use labels
    if (newType === 'TextInput') {
      return `[TextInput: ${label}]`;
    }
    // Simple types don't have labels
    return `[${newType}]`;
  }

  // If current annotation is just [Type], convert to new type
  if (/^\[(?:TextInput|Text|Date|Money|Link|Calculation)\]$/.test(currentAnnotation)) {
    return `[${newType}]`;
  }

  // Default: return new type annotation
  return `[${newType}]`;
}

/**
 * Extract label from an annotation like [TextInput: Some Label]
 */
function extractLabelFromAnnotation(annotation: string): string | null {
  const match = annotation.match(/^\[[^:]+:\s*([^\]]+)\]$/);
  return match ? match[1].trim() : null;
}

/**
 * Apply refinement to all annotations in a response
 */
function refineAnnotations(
  response: ClaudeAnnotationResponse,
  documentText: string
): ClaudeAnnotationResponse {
  return {
    ...response,
    annotations: response.annotations.map((ann) =>
      refineAnnotationType(ann, documentText)
    ),
  };
}

// ----------------------------------------------------------------------------
// Singleton Instance
// ----------------------------------------------------------------------------

let claudeServiceInstance: ClaudeService | null = null;

/**
 * Get the Claude service instance
 */
export function getClaudeService(config?: ClaudeServiceConfig): ClaudeService {
  if (!claudeServiceInstance || config) {
    claudeServiceInstance = new ClaudeService(config);
  }
  return claudeServiceInstance;
}

/**
 * Check if Claude service is configured
 */
export function isClaudeConfigured(): boolean {
  const service = getClaudeService();
  return service.isConfigured();
}

// ----------------------------------------------------------------------------
// Convenience Exports
// ----------------------------------------------------------------------------

export const claudeService = {
  annotate: (options: AnnotateDocumentOptions) =>
    getClaudeService().annotateDocument(options),
  isConfigured: () => isClaudeConfigured(),
};

export { ClaudeService };

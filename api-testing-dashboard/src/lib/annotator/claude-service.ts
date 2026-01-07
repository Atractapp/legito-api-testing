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

const SYSTEM_PROMPT = `You are a legal document annotation expert specializing in Legito document format. Your task is to add Legito annotations to documents based on the patterns you've learned from training examples.

## Legito Annotation Format Rules

You MUST use these exact annotation formats:

1. **TextInput** - For editable text fields:
   - With label: [TextInput: label text]
   - Without label: [TextInput]

2. **Select** - For dropdown/multiple choice (options separated by /):
   - [Select: option1/option2/option3]
   - Must have at least 2 options

3. **Date** - For date fields:
   - [Date]

4. **Link** - For hyperlinks:
   - [Link]

5. **Money** - For monetary values:
   - [Money]

6. **Calculation** - For calculated fields:
   - [Calculation]

## Important Rules

1. Each annotation (including brackets) must have uniform formatting
2. Only annotate text that genuinely needs to be variable/editable
3. Don't over-annotate - if text should remain static, leave it as-is
4. Use appropriate annotation types based on the content
5. For names, addresses, etc. → TextInput
6. For yes/no choices, options → Select
7. For dates → Date
8. For prices, amounts → Money
9. Be consistent with similar content across the document

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
      return parsed;
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

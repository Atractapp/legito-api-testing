/**
 * Document Classification Service
 *
 * Phase 3: AI-based document type classification
 * Uses Claude to classify documents into types for loading type-specific patterns
 *
 * Document types:
 * - loan: Loan agreements, promissory notes, credit agreements
 * - employment: Employment contracts, offer letters
 * - nda: Non-disclosure agreements, confidentiality agreements
 * - lease: Lease agreements, rental contracts
 * - service: Service agreements, consulting contracts
 * - sale: Sales contracts, purchase agreements
 * - partnership: Partnership agreements, JV agreements
 * - corporate: Corporate minutes, resolutions, bylaws
 * - general: Other document types
 */

import Anthropic from '@anthropic-ai/sdk';

/**
 * Known document types with their characteristics
 */
export const DOCUMENT_TYPES = {
  loan: {
    name: 'Loan Agreement',
    keywords: ['loan', 'lender', 'borrower', 'principal', 'interest', 'repayment', 'promissory note', 'credit'],
    description: 'Loan agreements, promissory notes, credit agreements',
  },
  employment: {
    name: 'Employment Contract',
    keywords: ['employee', 'employer', 'salary', 'compensation', 'termination', 'position', 'duties'],
    description: 'Employment contracts, offer letters, work agreements',
  },
  nda: {
    name: 'Non-Disclosure Agreement',
    keywords: ['confidential', 'proprietary', 'disclosure', 'trade secret', 'recipient', 'disclosing party'],
    description: 'Non-disclosure agreements, confidentiality agreements',
  },
  lease: {
    name: 'Lease Agreement',
    keywords: ['landlord', 'tenant', 'rent', 'lease', 'premises', 'property', 'lessor', 'lessee'],
    description: 'Lease agreements, rental contracts, property agreements',
  },
  service: {
    name: 'Service Agreement',
    keywords: ['service', 'consultant', 'contractor', 'deliverables', 'scope of work', 'statement of work'],
    description: 'Service agreements, consulting contracts',
  },
  sale: {
    name: 'Sales Contract',
    keywords: ['seller', 'buyer', 'purchase', 'goods', 'delivery', 'warranty', 'sale'],
    description: 'Sales contracts, purchase agreements',
  },
  partnership: {
    name: 'Partnership Agreement',
    keywords: ['partner', 'partnership', 'joint venture', 'profit sharing', 'capital contribution'],
    description: 'Partnership agreements, joint venture agreements',
  },
  corporate: {
    name: 'Corporate Document',
    keywords: ['resolution', 'minutes', 'board', 'directors', 'shareholders', 'bylaws', 'secretary'],
    description: 'Corporate minutes, resolutions, bylaws',
  },
  writer: {
    name: 'Writer Agreement',
    keywords: ['writer', 'author', 'artist', 'screenplay', 'script', 'rights', 'royalty', 'producer', 'series'],
    description: 'Writer agreements, author contracts, entertainment agreements',
  },
  general: {
    name: 'General Contract',
    keywords: [],
    description: 'Other document types',
  },
} as const;

export type DocumentType = keyof typeof DOCUMENT_TYPES;

/**
 * Classification result
 */
export interface ClassificationResult {
  documentType: DocumentType;
  confidence: number;
  reasoning: string;
  alternativeTypes?: Array<{ type: DocumentType; confidence: number }>;
}

// Initialize Anthropic client
const anthropic = new Anthropic();

/**
 * Classify document using Claude
 */
export async function classifyDocument(documentText: string): Promise<ClassificationResult> {
  // Take first 2000 chars for classification (to save tokens)
  const textSample = documentText.slice(0, 2000);

  // First try quick heuristic classification
  const heuristicResult = classifyByHeuristics(textSample);
  if (heuristicResult.confidence >= 0.85) {
    console.log(`[ClassifyDoc] Heuristic classification: ${heuristicResult.documentType} (${heuristicResult.confidence})`);
    return heuristicResult;
  }

  // Use Claude for uncertain cases
  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 256,
      messages: [
        {
          role: 'user',
          content: `Classify this legal document into one of these types:
- loan: Loan agreements, promissory notes, credit agreements
- employment: Employment contracts, offer letters
- nda: Non-disclosure agreements, confidentiality agreements
- lease: Lease agreements, rental contracts
- service: Service agreements, consulting contracts
- sale: Sales contracts, purchase agreements
- partnership: Partnership agreements, joint venture agreements
- corporate: Corporate minutes, resolutions, bylaws
- writer: Writer agreements, author contracts, entertainment agreements
- general: Other document types

Document excerpt:
${textSample}

Respond ONLY with JSON in this format:
{"type": "loan", "confidence": 0.95, "reasoning": "Contains loan, borrower, lender terminology"}`,
        },
      ],
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';

    // Parse JSON response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const docType = parsed.type as DocumentType;

      // Validate type
      if (docType in DOCUMENT_TYPES) {
        console.log(`[ClassifyDoc] Claude classification: ${docType} (${parsed.confidence})`);
        return {
          documentType: docType,
          confidence: parsed.confidence,
          reasoning: parsed.reasoning || 'Classified by Claude',
        };
      }
    }
  } catch (error) {
    console.error('[ClassifyDoc] Claude classification failed:', error);
  }

  // Fall back to heuristic result or general
  if (heuristicResult.confidence > 0.5) {
    return heuristicResult;
  }

  return {
    documentType: 'general',
    confidence: 0.5,
    reasoning: 'Could not determine document type',
  };
}

/**
 * Quick heuristic-based classification using keywords
 */
export function classifyByHeuristics(documentText: string): ClassificationResult {
  const textLower = documentText.toLowerCase();
  const scores: Record<DocumentType, number> = {
    loan: 0,
    employment: 0,
    nda: 0,
    lease: 0,
    service: 0,
    sale: 0,
    partnership: 0,
    corporate: 0,
    writer: 0,
    general: 0,
  };

  // Count keyword matches for each type
  for (const [type, config] of Object.entries(DOCUMENT_TYPES)) {
    for (const keyword of config.keywords) {
      // Count occurrences (with word boundary matching)
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = textLower.match(regex);
      if (matches) {
        scores[type as DocumentType] += matches.length;
      }
    }
  }

  // Find type with highest score
  let bestType: DocumentType = 'general';
  let bestScore = 0;
  let totalScore = 0;

  for (const [type, score] of Object.entries(scores)) {
    totalScore += score;
    if (score > bestScore) {
      bestScore = score;
      bestType = type as DocumentType;
    }
  }

  // Calculate confidence based on relative score
  const confidence = totalScore > 0 ? Math.min(0.95, (bestScore / totalScore) * 1.5) : 0.5;

  return {
    documentType: bestType,
    confidence: bestScore > 0 ? confidence : 0.5,
    reasoning: bestScore > 0
      ? `Matched ${bestScore} keywords for ${DOCUMENT_TYPES[bestType].name}`
      : 'No strong keyword matches',
  };
}

/**
 * Get patterns filtered by document type
 */
export function filterPatternsByDocumentType<T extends { document_types?: string[] | null }>(
  patterns: T[],
  documentType: DocumentType
): T[] {
  return patterns.filter(pattern => {
    // If no document_types specified, pattern applies to all types
    if (!pattern.document_types || pattern.document_types.length === 0) {
      return true;
    }
    // Otherwise, check if current type is in the list
    return pattern.document_types.includes(documentType);
  });
}

/**
 * Get rules filtered by document type
 */
export function filterRulesByDocumentType<T extends { document_types?: string[] | null }>(
  rules: T[],
  documentType: DocumentType
): T[] {
  return rules.filter(rule => {
    // If no document_types specified, rule applies to all types
    if (!rule.document_types || rule.document_types.length === 0) {
      return true;
    }
    // Otherwise, check if current type is in the list
    return rule.document_types.includes(documentType);
  });
}

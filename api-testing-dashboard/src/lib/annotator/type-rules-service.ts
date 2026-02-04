/**
 * Type Rules Service
 *
 * Loads annotation type inference rules from the database instead of hardcoded arrays.
 * Provides caching and matching utilities for type detection.
 *
 * Categories:
 * - dateContextBefore: Keywords before a placeholder that suggest Date type
 * - dateContextAfter: Keywords after a placeholder that suggest Date type
 * - dateNameKeyword: Keywords in placeholder name that suggest Date type
 * - moneyContextBefore/After: Money type indicators
 * - moneyNameKeyword: Money keywords in placeholder name
 * - selectNameKeyword: Select keywords in placeholder name
 * - instructionKeyword: Fill-in instruction keywords
 * - skipGermanGender: German gender-neutral patterns to skip
 * - skipSlashPattern: Slash patterns to skip (and/or, compound words)
 * - titleSelect: Title select patterns (Mr/Ms, D/Dª., etc.)
 * - partyNamePattern: Party name patterns for Link detection
 */

import { getSupabaseAdmin } from './api-utils';
import type { AnnotationType } from '@/types/annotator';

// Rule as stored in database
export interface TypeRule {
  id: string;
  userId: string | null;
  category: string;
  keyword: string;
  position: 'before' | 'after' | 'name' | 'any';
  language: string | null;
  impliesType: AnnotationType | 'Skip';
  strength: 'strong' | 'weak' | 'normal';
  source: 'system' | 'user' | 'ai-learned';
  priority: number;
  isActive: boolean;
  description: string | null;
}

// Compiled rule with regex if applicable
interface CompiledRule extends TypeRule {
  regex?: RegExp;
  isRegex: boolean;
}

// Cache structure
interface RulesCache {
  rules: CompiledRule[];
  byCategory: Map<string, CompiledRule[]>;
  lastFetched: number;
  ttlMs: number;
}

// Global cache
let rulesCache: RulesCache | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Transform database row to TypeRule
 */
function transformDbRule(row: Record<string, unknown>): TypeRule {
  return {
    id: row.id as string,
    userId: row.user_id as string | null,
    category: row.category as string,
    keyword: row.keyword as string,
    position: row.position as 'before' | 'after' | 'name' | 'any',
    language: row.language as string | null,
    impliesType: row.implies_type as AnnotationType | 'Skip',
    strength: row.strength as 'strong' | 'weak' | 'normal',
    source: row.source as 'system' | 'user' | 'ai-learned',
    priority: row.priority as number,
    isActive: row.is_active as boolean,
    description: row.description as string | null,
  };
}

/**
 * Compile a rule - convert regex: prefixed patterns to RegExp objects
 */
function compileRule(rule: TypeRule): CompiledRule {
  const isRegex = rule.keyword.startsWith('regex:');
  let regex: RegExp | undefined;

  if (isRegex) {
    try {
      const pattern = rule.keyword.substring(6); // Remove 'regex:' prefix
      regex = new RegExp(pattern, 'i');
    } catch (e) {
      console.warn(`[TypeRulesService] Invalid regex pattern: ${rule.keyword}`, e);
    }
  }

  return {
    ...rule,
    isRegex,
    regex,
  };
}

/**
 * Load all active rules from database
 */
export async function loadTypeRules(forceRefresh = false): Promise<CompiledRule[]> {
  // Check cache
  if (
    rulesCache &&
    !forceRefresh &&
    Date.now() - rulesCache.lastFetched < rulesCache.ttlMs
  ) {
    return rulesCache.rules;
  }

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('annotator_type_rules')
    .select('*')
    .eq('is_active', true)
    .order('priority', { ascending: false });

  if (error) {
    console.error('[TypeRulesService] Failed to load rules:', error);
    // Return cached rules if available, otherwise empty
    return rulesCache?.rules || [];
  }

  const rules = (data || []).map(transformDbRule).map(compileRule);

  // Build category index
  const byCategory = new Map<string, CompiledRule[]>();
  for (const rule of rules) {
    const existing = byCategory.get(rule.category) || [];
    existing.push(rule);
    byCategory.set(rule.category, existing);
  }

  // Update cache
  rulesCache = {
    rules,
    byCategory,
    lastFetched: Date.now(),
    ttlMs: CACHE_TTL_MS,
  };

  console.log(`[TypeRulesService] Loaded ${rules.length} rules across ${byCategory.size} categories`);
  return rules;
}

/**
 * Get rules by category
 */
export async function getRulesByCategory(category: string): Promise<CompiledRule[]> {
  await loadTypeRules();
  return rulesCache?.byCategory.get(category) || [];
}

/**
 * Get all rules for multiple categories
 */
export async function getRulesByCategories(categories: string[]): Promise<CompiledRule[]> {
  await loadTypeRules();
  const result: CompiledRule[] = [];
  for (const category of categories) {
    const rules = rulesCache?.byCategory.get(category) || [];
    result.push(...rules);
  }
  return result;
}

/**
 * Check if text matches any rule in a category
 * Returns the matched rule or null
 */
export async function matchRule(
  text: string,
  category: string,
  options?: { language?: string }
): Promise<CompiledRule | null> {
  const rules = await getRulesByCategory(category);
  const textLower = text.toLowerCase();

  for (const rule of rules) {
    // Filter by language if specified
    if (options?.language && rule.language && rule.language !== options.language) {
      continue;
    }

    if (rule.isRegex && rule.regex) {
      if (rule.regex.test(text)) {
        return rule;
      }
    } else {
      // Simple string match (case-insensitive)
      if (textLower.includes(rule.keyword.toLowerCase())) {
        return rule;
      }
    }
  }

  return null;
}

/**
 * Check if text matches any rule in multiple categories
 * Returns the first matched rule or null
 */
export async function matchRuleInCategories(
  text: string,
  categories: string[],
  options?: { language?: string }
): Promise<CompiledRule | null> {
  for (const category of categories) {
    const match = await matchRule(text, category, options);
    if (match) return match;
  }
  return null;
}

/**
 * Get all matching rules for text in a category
 */
export async function matchAllRules(
  text: string,
  category: string,
  options?: { language?: string }
): Promise<CompiledRule[]> {
  const rules = await getRulesByCategory(category);
  const textLower = text.toLowerCase();
  const matches: CompiledRule[] = [];

  for (const rule of rules) {
    if (options?.language && rule.language && rule.language !== options.language) {
      continue;
    }

    if (rule.isRegex && rule.regex) {
      if (rule.regex.test(text)) {
        matches.push(rule);
      }
    } else {
      if (textLower.includes(rule.keyword.toLowerCase())) {
        matches.push(rule);
      }
    }
  }

  return matches;
}

// ============================================================
// Convenience methods matching the old hardcoded array behavior
// ============================================================

/**
 * Check if context before placeholder suggests Date type
 * Returns: { matched: boolean, strength: 'strong' | 'weak' | 'normal', keyword?: string }
 */
export async function checkDateContextBefore(
  contextBefore: string
): Promise<{ matched: boolean; strength: 'strong' | 'weak' | 'normal'; keyword?: string }> {
  const rules = await getRulesByCategory('dateContextBefore');
  const contextLower = contextBefore.toLowerCase();

  // Sort by priority (already sorted from DB, but ensure)
  rules.sort((a, b) => b.priority - a.priority);

  for (const rule of rules) {
    let matched = false;

    if (rule.isRegex && rule.regex) {
      matched = rule.regex.test(contextBefore);
    } else {
      // For context matching, check if keyword appears at end of context
      // Replicate the old behavior: (?:^|\s|[^a-zA-Z])keyword\s*$
      const escapedKeyword = rule.keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`(?:^|\\s|[^a-zA-Z])${escapedKeyword}\\s*$`, 'i');
      matched = pattern.test(contextLower);
    }

    if (matched) {
      return { matched: true, strength: rule.strength, keyword: rule.keyword };
    }
  }

  return { matched: false, strength: 'normal' };
}

/**
 * Check if context after placeholder suggests Date type
 */
export async function checkDateContextAfter(
  contextAfter: string
): Promise<{ matched: boolean; keyword?: string }> {
  const rules = await getRulesByCategory('dateContextAfter');

  for (const rule of rules) {
    const escapedKeyword = rule.keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`^\\s*${escapedKeyword}`, 'i');
    if (pattern.test(contextAfter)) {
      return { matched: true, keyword: rule.keyword };
    }
  }

  return { matched: false };
}

/**
 * Check if placeholder name contains date keywords
 */
export async function checkDateNameKeyword(
  placeholderName: string
): Promise<{ matched: boolean; keyword?: string }> {
  const rules = await getRulesByCategory('dateNameKeyword');
  const nameLower = placeholderName.toLowerCase();

  for (const rule of rules) {
    if (nameLower.includes(rule.keyword.toLowerCase())) {
      return { matched: true, keyword: rule.keyword };
    }
  }

  return { matched: false };
}

/**
 * Check if context suggests Money type (before or after)
 */
export async function checkMoneyContext(
  contextBefore: string,
  contextAfter: string
): Promise<{ matched: boolean; position: 'before' | 'after'; keyword?: string }> {
  // Check after context first (currencies, percentages)
  const afterRules = await getRulesByCategory('moneyContextAfter');
  for (const rule of afterRules) {
    const escapedKeyword = rule.keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`^[\\s,.-]*${escapedKeyword}`, 'i');
    if (pattern.test(contextAfter)) {
      return { matched: true, position: 'after', keyword: rule.keyword };
    }
  }

  // Check before context
  const beforeRules = await getRulesByCategory('moneyContextBefore');
  const beforeLower = contextBefore.toLowerCase();
  for (const rule of beforeRules) {
    if (beforeLower.includes(rule.keyword.toLowerCase())) {
      return { matched: true, position: 'before', keyword: rule.keyword };
    }
  }

  return { matched: false, position: 'before' };
}

/**
 * Check if placeholder name contains money keywords
 */
export async function checkMoneyNameKeyword(
  placeholderName: string
): Promise<{ matched: boolean; keyword?: string }> {
  const rules = await getRulesByCategory('moneyNameKeyword');
  const nameLower = placeholderName.toLowerCase();

  for (const rule of rules) {
    if (nameLower.includes(rule.keyword.toLowerCase())) {
      return { matched: true, keyword: rule.keyword };
    }
  }

  return { matched: false };
}

/**
 * Check if placeholder name contains select keywords
 */
export async function checkSelectNameKeyword(
  placeholderName: string
): Promise<{ matched: boolean; keyword?: string }> {
  const rules = await getRulesByCategory('selectNameKeyword');
  const nameLower = placeholderName.toLowerCase();

  for (const rule of rules) {
    if (nameLower.includes(rule.keyword.toLowerCase())) {
      return { matched: true, keyword: rule.keyword };
    }
  }

  return { matched: false };
}

/**
 * Check if text is a German gender-neutral pattern (should skip)
 */
export async function isGermanGenderPattern(text: string): Promise<boolean> {
  const rules = await getRulesByCategory('skipGermanGender');

  for (const rule of rules) {
    if (rule.isRegex && rule.regex) {
      if (rule.regex.test(text)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check if slash pattern should be skipped (and/or, compound words)
 */
export async function shouldSkipSlashPattern(text: string): Promise<boolean> {
  const rules = await getRulesByCategory('skipSlashPattern');

  for (const rule of rules) {
    if (rule.isRegex && rule.regex) {
      if (rule.regex.test(text)) {
        return true;
      }
    } else {
      if (text.toLowerCase().includes(rule.keyword.toLowerCase())) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Get title select patterns (Mr/Ms, D/Dª., etc.)
 * Returns patterns with their configuration
 */
export async function getTitleSelectPatterns(): Promise<
  Array<{ keyword: string; language: string | null }>
> {
  const rules = await getRulesByCategory('titleSelect');
  return rules.map((r) => ({ keyword: r.keyword, language: r.language }));
}

/**
 * Check if text contains instruction keywords (insert, enter, fill, etc.)
 * Uses word boundaries to avoid partial matches like "add" in "addition"
 */
export async function isInstructionText(text: string): Promise<boolean> {
  const rules = await getRulesByCategory('instructionKeyword');

  for (const rule of rules) {
    // Use word-boundary matching to avoid partial matches
    const escapedKeyword = rule.keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`\\b${escapedKeyword}\\b`, 'i');
    if (pattern.test(text)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if placeholder name matches party name patterns
 */
export async function isPartyNamePattern(
  placeholderName: string
): Promise<{ matched: boolean; strength: 'strong' | 'weak' | 'normal' }> {
  const rules = await getRulesByCategory('partyNamePattern');
  const nameLower = placeholderName.toLowerCase();

  for (const rule of rules) {
    if (nameLower.includes(rule.keyword.toLowerCase())) {
      return { matched: true, strength: rule.strength };
    }
  }

  return { matched: false, strength: 'normal' };
}

/**
 * Invalidate the cache (force reload on next access)
 */
export function invalidateCache(): void {
  rulesCache = null;
}

/**
 * Preload rules into cache (call on server startup)
 */
export async function preloadRules(): Promise<void> {
  await loadTypeRules(true);
}

// ============================================================
// SYNCHRONOUS METHODS - Use cached data directly
// These require preloadRules() to be called first
// ============================================================

/**
 * Get cached rules by category (SYNC - requires preloadRules first)
 */
function getCachedRulesByCategory(category: string): CompiledRule[] {
  return rulesCache?.byCategory.get(category) || [];
}

/**
 * Check if cache is loaded
 */
export function isCacheLoaded(): boolean {
  return rulesCache !== null;
}

/**
 * SYNC: Check if context before placeholder suggests Date type
 */
export function checkDateContextBeforeSync(
  contextBefore: string
): { matched: boolean; strength: 'strong' | 'weak' | 'normal'; keyword?: string } {
  const rules = getCachedRulesByCategory('dateContextBefore');
  const contextLower = contextBefore.toLowerCase();

  for (const rule of rules) {
    let matched = false;

    if (rule.isRegex && rule.regex) {
      matched = rule.regex.test(contextBefore);
    } else {
      const escapedKeyword = rule.keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`(?:^|\\s|[^a-zA-Z])${escapedKeyword}\\s*$`, 'i');
      matched = pattern.test(contextLower);
    }

    if (matched) {
      return { matched: true, strength: rule.strength, keyword: rule.keyword };
    }
  }

  return { matched: false, strength: 'normal' };
}

/**
 * SYNC: Check if context after placeholder suggests Date type
 */
export function checkDateContextAfterSync(
  contextAfter: string
): { matched: boolean; keyword?: string } {
  const rules = getCachedRulesByCategory('dateContextAfter');

  for (const rule of rules) {
    const escapedKeyword = rule.keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`^\\s*${escapedKeyword}`, 'i');
    if (pattern.test(contextAfter)) {
      return { matched: true, keyword: rule.keyword };
    }
  }

  return { matched: false };
}

/**
 * SYNC: Check if placeholder name contains date keywords
 */
export function checkDateNameKeywordSync(
  placeholderName: string
): { matched: boolean; keyword?: string } {
  const rules = getCachedRulesByCategory('dateNameKeyword');
  const nameLower = placeholderName.toLowerCase();

  for (const rule of rules) {
    if (nameLower.includes(rule.keyword.toLowerCase())) {
      return { matched: true, keyword: rule.keyword };
    }
  }

  return { matched: false };
}

/**
 * SYNC: Check if context suggests Money type
 */
export function checkMoneyContextSync(
  contextBefore: string,
  contextAfter: string
): { matched: boolean; position: 'before' | 'after'; keyword?: string } {
  // Check after context first
  const afterRules = getCachedRulesByCategory('moneyContextAfter');
  for (const rule of afterRules) {
    const escapedKeyword = rule.keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`^[\\s,.-]*${escapedKeyword}`, 'i');
    if (pattern.test(contextAfter)) {
      return { matched: true, position: 'after', keyword: rule.keyword };
    }
  }

  // Check before context
  const beforeRules = getCachedRulesByCategory('moneyContextBefore');
  const beforeLower = contextBefore.toLowerCase();
  for (const rule of beforeRules) {
    if (beforeLower.includes(rule.keyword.toLowerCase())) {
      return { matched: true, position: 'before', keyword: rule.keyword };
    }
  }

  return { matched: false, position: 'before' };
}

/**
 * SYNC: Check if placeholder name contains money keywords
 */
export function checkMoneyNameKeywordSync(
  placeholderName: string
): { matched: boolean; keyword?: string } {
  const rules = getCachedRulesByCategory('moneyNameKeyword');
  const nameLower = placeholderName.toLowerCase();

  for (const rule of rules) {
    if (nameLower.includes(rule.keyword.toLowerCase())) {
      return { matched: true, keyword: rule.keyword };
    }
  }

  return { matched: false };
}

/**
 * SYNC: Check if placeholder name contains select keywords
 */
export function checkSelectNameKeywordSync(
  placeholderName: string
): { matched: boolean; keyword?: string } {
  const rules = getCachedRulesByCategory('selectNameKeyword');
  const nameLower = placeholderName.toLowerCase();

  for (const rule of rules) {
    if (nameLower.includes(rule.keyword.toLowerCase())) {
      return { matched: true, keyword: rule.keyword };
    }
  }

  return { matched: false };
}

/**
 * SYNC: Check if text is a German gender-neutral pattern
 */
export function isGermanGenderPatternSync(text: string): boolean {
  const rules = getCachedRulesByCategory('skipGermanGender');

  for (const rule of rules) {
    if (rule.isRegex && rule.regex) {
      if (rule.regex.test(text)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * SYNC: Check if slash pattern should be skipped
 */
export function shouldSkipSlashPatternSync(text: string): boolean {
  const rules = getCachedRulesByCategory('skipSlashPattern');

  for (const rule of rules) {
    if (rule.isRegex && rule.regex) {
      if (rule.regex.test(text)) {
        return true;
      }
    } else {
      if (text.toLowerCase().includes(rule.keyword.toLowerCase())) {
        return true;
      }
    }
  }

  return false;
}

/**
 * SYNC: Check if text contains instruction keywords (using word boundaries)
 */
export function isInstructionTextSync(text: string): boolean {
  const rules = getCachedRulesByCategory('instructionKeyword');

  // Use database rules if available
  for (const rule of rules) {
    // Use word-boundary matching to avoid partial matches like "add" in "addition"
    const escapedKeyword = rule.keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`\\b${escapedKeyword}\\b`, 'i');
    if (pattern.test(text)) {
      return true;
    }
  }

  // Fallback: Check common instruction keywords when database rules are empty
  if (rules.length === 0) {
    const fallbackKeywords = [
      'insert', 'enter', 'add', 'fill', 'type', 'specify', 'provide', 'input',
      'einfügen', 'eingeben', 'hinzufügen', 'ausfüllen', 'angeben',
      'insertar', 'ingresar', 'agregar', 'rellenar', 'especificar',
      'vložit', 'zadat', 'vyplnit', 'doplnit',
      'description', 'beschreibung', 'descripción', 'popis',
    ];
    const textLower = text.toLowerCase();
    for (const keyword of fallbackKeywords) {
      const pattern = new RegExp(`\\b${keyword}\\b`, 'i');
      if (pattern.test(textLower)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Local Type Rules for Headless Annotator
 *
 * Bundled ~100 type inference rules extracted from:
 * supabase/migrations/20260109_create_type_rules_table.sql
 *
 * These rules enable headless operation without database connectivity.
 * Categories:
 * - dateContextBefore: Strong/weak date indicators before placeholder
 * - dateContextAfter: Date indicators after placeholder
 * - dateNameKeyword: Date indicators in placeholder name
 * - moneyContextAfter: Currency/money indicators after placeholder
 * - moneyContextBefore: Money indicators before placeholder
 * - moneyNameKeyword: Money indicators in placeholder name
 * - selectNameKeyword: Select field indicators in placeholder name
 * - instructionKeyword: Instruction text indicators (insert, enter, etc.)
 * - skipGermanGender: German gender-neutral patterns to skip
 * - skipSlashPattern: Slash patterns to skip (and/or, etc.)
 * - titleSelect: Title/salutation Select patterns
 * - partyNamePattern: Party name patterns for Link detection
 */

import type { AnnotationType } from '@/types/annotator';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export type RuleCategory =
  | 'dateContextBefore'
  | 'dateContextAfter'
  | 'dateNameKeyword'
  | 'moneyContextAfter'
  | 'moneyContextBefore'
  | 'moneyNameKeyword'
  | 'selectNameKeyword'
  | 'instructionKeyword'
  | 'skipGermanGender'
  | 'skipSlashPattern'
  | 'titleSelect'
  | 'partyNamePattern';

export type RulePosition = 'before' | 'after' | 'name' | 'any';
export type RuleStrength = 'strong' | 'normal' | 'weak';

export interface TypeRule {
  category: RuleCategory;
  keyword: string;
  position: RulePosition;
  language: string | null;
  impliesType: AnnotationType | 'Skip';
  strength: RuleStrength;
  priority: number;
  description: string;
  /** Pre-compiled regex for regex: prefixed keywords */
  regex?: RegExp;
}

// ----------------------------------------------------------------------------
// Bundled Rules (extracted from SQL migration)
// ----------------------------------------------------------------------------

const RAW_RULES: Array<Omit<TypeRule, 'regex'>> = [
  // =============================================
  // STRONG DATE INDICATORS (context before)
  // =============================================

  // Czech strong date indicators
  { category: 'dateContextBefore', keyword: 'ze dne', position: 'before', language: 'cs', impliesType: 'Date', strength: 'strong', priority: 90, description: 'Czech: dated' },
  { category: 'dateContextBefore', keyword: 'ke dni', position: 'before', language: 'cs', impliesType: 'Date', strength: 'strong', priority: 90, description: 'Czech: as of' },
  { category: 'dateContextBefore', keyword: 'dne', position: 'before', language: 'cs', impliesType: 'Date', strength: 'strong', priority: 90, description: 'Czech: on day' },
  { category: 'dateContextBefore', keyword: 'dňa', position: 'before', language: 'cs', impliesType: 'Date', strength: 'strong', priority: 90, description: 'Slovak: on day' },
  { category: 'dateContextBefore', keyword: 'datum', position: 'before', language: 'cs', impliesType: 'Date', strength: 'strong', priority: 90, description: 'Czech: date' },
  { category: 'dateContextBefore', keyword: 'v den', position: 'before', language: 'cs', impliesType: 'Date', strength: 'strong', priority: 90, description: 'Czech: on the day' },
  { category: 'dateContextBefore', keyword: 'uzavřena dne', position: 'before', language: 'cs', impliesType: 'Date', strength: 'strong', priority: 90, description: 'Czech: concluded on' },
  { category: 'dateContextBefore', keyword: 'podepsáno dne', position: 'before', language: 'cs', impliesType: 'Date', strength: 'strong', priority: 90, description: 'Czech: signed on' },
  { category: 'dateContextBefore', keyword: 'v praze dne', position: 'before', language: 'cs', impliesType: 'Date', strength: 'strong', priority: 90, description: 'Czech: in Prague on' },
  { category: 'dateContextBefore', keyword: 'dnem', position: 'before', language: 'cs', impliesType: 'Date', strength: 'strong', priority: 90, description: 'Czech: with day' },

  // English strong date indicators
  { category: 'dateContextBefore', keyword: 'dated', position: 'before', language: 'en', impliesType: 'Date', strength: 'strong', priority: 90, description: 'English: dated' },
  { category: 'dateContextBefore', keyword: 'as of', position: 'before', language: 'en', impliesType: 'Date', strength: 'strong', priority: 90, description: 'English: as of' },
  { category: 'dateContextBefore', keyword: 'effective date', position: 'before', language: 'en', impliesType: 'Date', strength: 'strong', priority: 90, description: 'English: effective date' },
  { category: 'dateContextBefore', keyword: 'valid until', position: 'before', language: 'en', impliesType: 'Date', strength: 'strong', priority: 90, description: 'English: valid until' },
  { category: 'dateContextBefore', keyword: 'expires on', position: 'before', language: 'en', impliesType: 'Date', strength: 'strong', priority: 90, description: 'English: expires on' },
  { category: 'dateContextBefore', keyword: 'due by', position: 'before', language: 'en', impliesType: 'Date', strength: 'strong', priority: 90, description: 'English: due by' },
  { category: 'dateContextBefore', keyword: 'signed on', position: 'before', language: 'en', impliesType: 'Date', strength: 'strong', priority: 90, description: 'English: signed on' },
  { category: 'dateContextBefore', keyword: 'executed on', position: 'before', language: 'en', impliesType: 'Date', strength: 'strong', priority: 90, description: 'English: executed on' },
  { category: 'dateContextBefore', keyword: 'starting on', position: 'before', language: 'en', impliesType: 'Date', strength: 'strong', priority: 90, description: 'English: starting on' },
  { category: 'dateContextBefore', keyword: 'ending on', position: 'before', language: 'en', impliesType: 'Date', strength: 'strong', priority: 90, description: 'English: ending on' },
  { category: 'dateContextBefore', keyword: 'commencing on', position: 'before', language: 'en', impliesType: 'Date', strength: 'strong', priority: 90, description: 'English: commencing on' },
  { category: 'dateContextBefore', keyword: 'beginning on', position: 'before', language: 'en', impliesType: 'Date', strength: 'strong', priority: 90, description: 'English: beginning on' },
  { category: 'dateContextBefore', keyword: 'until', position: 'before', language: 'en', impliesType: 'Date', strength: 'strong', priority: 85, description: 'English: until' },
  { category: 'dateContextBefore', keyword: 'through', position: 'before', language: 'en', impliesType: 'Date', strength: 'strong', priority: 85, description: 'English: through' },
  { category: 'dateContextBefore', keyword: 'till', position: 'before', language: 'en', impliesType: 'Date', strength: 'strong', priority: 85, description: 'English: till' },

  // German strong date indicators
  { category: 'dateContextBefore', keyword: 'bis zum', position: 'before', language: 'de', impliesType: 'Date', strength: 'strong', priority: 90, description: 'German: until' },
  { category: 'dateContextBefore', keyword: 'bis', position: 'before', language: 'de', impliesType: 'Date', strength: 'strong', priority: 85, description: 'German: until' },
  { category: 'dateContextBefore', keyword: 'vom', position: 'before', language: 'de', impliesType: 'Date', strength: 'strong', priority: 90, description: 'German: from' },
  { category: 'dateContextBefore', keyword: 'ab dem', position: 'before', language: 'de', impliesType: 'Date', strength: 'strong', priority: 90, description: 'German: from the' },
  { category: 'dateContextBefore', keyword: 'zum', position: 'before', language: 'de', impliesType: 'Date', strength: 'strong', priority: 85, description: 'German: to the' },
  { category: 'dateContextBefore', keyword: 'vor dem', position: 'before', language: 'de', impliesType: 'Date', strength: 'strong', priority: 90, description: 'German: before the' },

  // Spanish strong date indicators
  { category: 'dateContextBefore', keyword: 'el día', position: 'before', language: 'es', impliesType: 'Date', strength: 'strong', priority: 90, description: 'Spanish: the day' },
  { category: 'dateContextBefore', keyword: 'fecha', position: 'before', language: 'es', impliesType: 'Date', strength: 'strong', priority: 90, description: 'Spanish: date' },
  { category: 'dateContextBefore', keyword: 'hasta', position: 'before', language: 'es', impliesType: 'Date', strength: 'strong', priority: 85, description: 'Spanish: until' },
  { category: 'dateContextBefore', keyword: 'desde', position: 'before', language: 'es', impliesType: 'Date', strength: 'strong', priority: 85, description: 'Spanish: from' },

  // =============================================
  // WEAK DATE INDICATORS (context before)
  // =============================================
  { category: 'dateContextBefore', keyword: 'do', position: 'before', language: 'cs', impliesType: 'Date', strength: 'weak', priority: 60, description: 'Czech: to/until' },
  { category: 'dateContextBefore', keyword: 'od', position: 'before', language: 'cs', impliesType: 'Date', strength: 'weak', priority: 60, description: 'Czech: from' },
  { category: 'dateContextBefore', keyword: 'on', position: 'before', language: 'en', impliesType: 'Date', strength: 'weak', priority: 60, description: 'English: on' },
  { category: 'dateContextBefore', keyword: 'by', position: 'before', language: 'en', impliesType: 'Date', strength: 'weak', priority: 60, description: 'English: by' },
  { category: 'dateContextBefore', keyword: 'from', position: 'before', language: 'en', impliesType: 'Date', strength: 'weak', priority: 60, description: 'English: from' },
  { category: 'dateContextBefore', keyword: 'effective', position: 'before', language: 'en', impliesType: 'Date', strength: 'weak', priority: 60, description: 'English: effective' },
  { category: 'dateContextBefore', keyword: 'platnosti do', position: 'before', language: 'cs', impliesType: 'Date', strength: 'weak', priority: 70, description: 'Czech: valid until' },
  { category: 'dateContextBefore', keyword: 'účinnosti do', position: 'before', language: 'cs', impliesType: 'Date', strength: 'weak', priority: 70, description: 'Czech: effective until' },
  { category: 'dateContextBefore', keyword: 'termín', position: 'before', language: 'cs', impliesType: 'Date', strength: 'weak', priority: 70, description: 'Czech: term' },
  { category: 'dateContextBefore', keyword: 'lhůta', position: 'before', language: 'cs', impliesType: 'Date', strength: 'weak', priority: 70, description: 'Czech: deadline' },
  { category: 'dateContextBefore', keyword: 'platné do', position: 'before', language: 'cs', impliesType: 'Date', strength: 'weak', priority: 70, description: 'Czech: valid until' },
  { category: 'dateContextBefore', keyword: 'hasta el', position: 'before', language: 'es', impliesType: 'Date', strength: 'weak', priority: 70, description: 'Spanish: until the' },
  { category: 'dateContextBefore', keyword: 'desde el', position: 'before', language: 'es', impliesType: 'Date', strength: 'weak', priority: 70, description: 'Spanish: from the' },

  // =============================================
  // DATE INDICATORS (context after)
  // =============================================
  { category: 'dateContextAfter', keyword: 'roku', position: 'after', language: 'cs', impliesType: 'Date', strength: 'normal', priority: 75, description: 'Czech: year' },
  { category: 'dateContextAfter', keyword: 'měsíce', position: 'after', language: 'cs', impliesType: 'Date', strength: 'normal', priority: 75, description: 'Czech: month' },
  { category: 'dateContextAfter', keyword: 'dní', position: 'after', language: 'cs', impliesType: 'Date', strength: 'normal', priority: 75, description: 'Czech: days' },
  { category: 'dateContextAfter', keyword: 'year', position: 'after', language: 'en', impliesType: 'Date', strength: 'normal', priority: 75, description: 'English: year' },
  { category: 'dateContextAfter', keyword: 'month', position: 'after', language: 'en', impliesType: 'Date', strength: 'normal', priority: 75, description: 'English: month' },
  { category: 'dateContextAfter', keyword: 'day', position: 'after', language: 'en', impliesType: 'Date', strength: 'normal', priority: 75, description: 'English: day' },

  // =============================================
  // DATE INDICATORS (in placeholder name)
  // =============================================
  { category: 'dateNameKeyword', keyword: 'date', position: 'name', language: null, impliesType: 'Date', strength: 'normal', priority: 70, description: 'Name contains date' },
  { category: 'dateNameKeyword', keyword: 'datum', position: 'name', language: null, impliesType: 'Date', strength: 'normal', priority: 70, description: 'Name contains datum' },
  { category: 'dateNameKeyword', keyword: 'signed', position: 'name', language: null, impliesType: 'Date', strength: 'normal', priority: 70, description: 'Name contains signed' },
  { category: 'dateNameKeyword', keyword: 'signature', position: 'name', language: null, impliesType: 'Date', strength: 'normal', priority: 70, description: 'Name contains signature' },

  // =============================================
  // MONEY INDICATORS (context after)
  // =============================================
  { category: 'moneyContextAfter', keyword: 'kč', position: 'after', language: 'cs', impliesType: 'Money', strength: 'strong', priority: 90, description: 'Czech: CZK' },
  { category: 'moneyContextAfter', keyword: 'czk', position: 'after', language: 'cs', impliesType: 'Money', strength: 'strong', priority: 90, description: 'Czech koruna' },
  { category: 'moneyContextAfter', keyword: 'eur', position: 'after', language: null, impliesType: 'Money', strength: 'strong', priority: 90, description: 'Euro' },
  { category: 'moneyContextAfter', keyword: 'usd', position: 'after', language: null, impliesType: 'Money', strength: 'strong', priority: 90, description: 'US Dollar' },
  { category: 'moneyContextAfter', keyword: 'gbp', position: 'after', language: null, impliesType: 'Money', strength: 'strong', priority: 90, description: 'British Pound' },
  { category: 'moneyContextAfter', keyword: '€', position: 'after', language: null, impliesType: 'Money', strength: 'strong', priority: 90, description: 'Euro symbol' },
  { category: 'moneyContextAfter', keyword: '$', position: 'after', language: null, impliesType: 'Money', strength: 'strong', priority: 90, description: 'Dollar symbol' },
  { category: 'moneyContextAfter', keyword: '£', position: 'after', language: null, impliesType: 'Money', strength: 'strong', priority: 90, description: 'Pound symbol' },
  { category: 'moneyContextAfter', keyword: 'korun', position: 'after', language: 'cs', impliesType: 'Money', strength: 'strong', priority: 85, description: 'Czech: korun' },
  { category: 'moneyContextAfter', keyword: 'euro', position: 'after', language: null, impliesType: 'Money', strength: 'strong', priority: 85, description: 'Euro (word)' },
  { category: 'moneyContextAfter', keyword: 'dolar', position: 'after', language: 'cs', impliesType: 'Money', strength: 'strong', priority: 85, description: 'Czech: dollar' },
  { category: 'moneyContextAfter', keyword: '%', position: 'after', language: null, impliesType: 'Money', strength: 'normal', priority: 80, description: 'Percent symbol' },
  { category: 'moneyContextAfter', keyword: 'procent', position: 'after', language: 'cs', impliesType: 'Money', strength: 'normal', priority: 80, description: 'Czech: percent' },
  { category: 'moneyContextAfter', keyword: 'percent', position: 'after', language: 'en', impliesType: 'Money', strength: 'normal', priority: 80, description: 'English: percent' },
  { category: 'moneyContextAfter', keyword: ',- kč', position: 'after', language: 'cs', impliesType: 'Money', strength: 'strong', priority: 95, description: 'Czech: amount format' },
  { category: 'moneyContextAfter', keyword: ',-kč', position: 'after', language: 'cs', impliesType: 'Money', strength: 'strong', priority: 95, description: 'Czech: amount format' },
  { category: 'moneyContextAfter', keyword: ',- czk', position: 'after', language: 'cs', impliesType: 'Money', strength: 'strong', priority: 95, description: 'Czech: amount format' },

  // =============================================
  // MONEY INDICATORS (context before)
  // =============================================
  { category: 'moneyContextBefore', keyword: 'částku', position: 'before', language: 'cs', impliesType: 'Money', strength: 'strong', priority: 85, description: 'Czech: amount' },
  { category: 'moneyContextBefore', keyword: 'částka', position: 'before', language: 'cs', impliesType: 'Money', strength: 'strong', priority: 85, description: 'Czech: amount' },
  { category: 'moneyContextBefore', keyword: 've výši', position: 'before', language: 'cs', impliesType: 'Money', strength: 'strong', priority: 90, description: 'Czech: in the amount of' },
  { category: 'moneyContextBefore', keyword: 'amount of', position: 'before', language: 'en', impliesType: 'Money', strength: 'strong', priority: 85, description: 'English: amount of' },
  { category: 'moneyContextBefore', keyword: 'sum of', position: 'before', language: 'en', impliesType: 'Money', strength: 'strong', priority: 85, description: 'English: sum of' },
  { category: 'moneyContextBefore', keyword: 'price of', position: 'before', language: 'en', impliesType: 'Money', strength: 'strong', priority: 85, description: 'English: price of' },
  { category: 'moneyContextBefore', keyword: 'hodnota', position: 'before', language: 'cs', impliesType: 'Money', strength: 'normal', priority: 75, description: 'Czech: value' },
  { category: 'moneyContextBefore', keyword: 'cena', position: 'before', language: 'cs', impliesType: 'Money', strength: 'normal', priority: 75, description: 'Czech: price' },

  // =============================================
  // MONEY INDICATORS (in placeholder name)
  // =============================================
  { category: 'moneyNameKeyword', keyword: 'value', position: 'name', language: 'en', impliesType: 'Money', strength: 'normal', priority: 70, description: 'Name contains value' },
  { category: 'moneyNameKeyword', keyword: 'price', position: 'name', language: null, impliesType: 'Money', strength: 'normal', priority: 70, description: 'Name contains price' },
  { category: 'moneyNameKeyword', keyword: 'cost', position: 'name', language: null, impliesType: 'Money', strength: 'normal', priority: 70, description: 'Name contains cost' },
  { category: 'moneyNameKeyword', keyword: 'fee', position: 'name', language: null, impliesType: 'Money', strength: 'normal', priority: 70, description: 'Name contains fee' },
  { category: 'moneyNameKeyword', keyword: 'payment', position: 'name', language: null, impliesType: 'Money', strength: 'normal', priority: 70, description: 'Name contains payment' },
  { category: 'moneyNameKeyword', keyword: 'sum', position: 'name', language: null, impliesType: 'Money', strength: 'normal', priority: 70, description: 'Name contains sum' },
  { category: 'moneyNameKeyword', keyword: 'loan', position: 'name', language: null, impliesType: 'Money', strength: 'normal', priority: 70, description: 'Name contains loan' },
  { category: 'moneyNameKeyword', keyword: 'money', position: 'name', language: null, impliesType: 'Money', strength: 'normal', priority: 70, description: 'Name contains money' },
  { category: 'moneyNameKeyword', keyword: 'salary', position: 'name', language: null, impliesType: 'Money', strength: 'normal', priority: 70, description: 'Name contains salary' },
  { category: 'moneyNameKeyword', keyword: 'wage', position: 'name', language: null, impliesType: 'Money', strength: 'normal', priority: 70, description: 'Name contains wage' },
  { category: 'moneyNameKeyword', keyword: 'cena', position: 'name', language: 'cs', impliesType: 'Money', strength: 'normal', priority: 70, description: 'Czech: price' },
  { category: 'moneyNameKeyword', keyword: 'částka', position: 'name', language: 'cs', impliesType: 'Money', strength: 'normal', priority: 70, description: 'Czech: amount' },
  { category: 'moneyNameKeyword', keyword: 'půjčka', position: 'name', language: 'cs', impliesType: 'Money', strength: 'normal', priority: 70, description: 'Czech: loan' },
  { category: 'moneyNameKeyword', keyword: 'úvěr', position: 'name', language: 'cs', impliesType: 'Money', strength: 'normal', priority: 70, description: 'Czech: credit' },

  // =============================================
  // SELECT INDICATORS (in placeholder name)
  // =============================================
  { category: 'selectNameKeyword', keyword: 'option', position: 'name', language: null, impliesType: 'Select', strength: 'normal', priority: 70, description: 'Name contains option' },
  { category: 'selectNameKeyword', keyword: 'choice', position: 'name', language: null, impliesType: 'Select', strength: 'normal', priority: 70, description: 'Name contains choice' },
  { category: 'selectNameKeyword', keyword: 'select', position: 'name', language: null, impliesType: 'Select', strength: 'normal', priority: 70, description: 'Name contains select' },
  { category: 'selectNameKeyword', keyword: 'type', position: 'name', language: null, impliesType: 'Select', strength: 'normal', priority: 65, description: 'Name contains type' },

  // =============================================
  // INSTRUCTION KEYWORDS (for TextInput detection)
  // =============================================
  { category: 'instructionKeyword', keyword: 'insert', position: 'any', language: 'en', impliesType: 'TextInput', strength: 'normal', priority: 80, description: 'Instruction: insert' },
  { category: 'instructionKeyword', keyword: 'enter', position: 'any', language: 'en', impliesType: 'TextInput', strength: 'normal', priority: 80, description: 'Instruction: enter' },
  { category: 'instructionKeyword', keyword: 'fill in', position: 'any', language: 'en', impliesType: 'TextInput', strength: 'normal', priority: 80, description: 'Instruction: fill in' },
  { category: 'instructionKeyword', keyword: 'fill out', position: 'any', language: 'en', impliesType: 'TextInput', strength: 'normal', priority: 80, description: 'Instruction: fill out' },
  { category: 'instructionKeyword', keyword: 'specify', position: 'any', language: 'en', impliesType: 'TextInput', strength: 'normal', priority: 80, description: 'Instruction: specify' },
  { category: 'instructionKeyword', keyword: 'provide', position: 'any', language: 'en', impliesType: 'TextInput', strength: 'normal', priority: 80, description: 'Instruction: provide' },
  { category: 'instructionKeyword', keyword: 'add', position: 'any', language: 'en', impliesType: 'TextInput', strength: 'normal', priority: 75, description: 'Instruction: add' },
  { category: 'instructionKeyword', keyword: 'write', position: 'any', language: 'en', impliesType: 'TextInput', strength: 'normal', priority: 75, description: 'Instruction: write' },
  { category: 'instructionKeyword', keyword: 'type', position: 'any', language: 'en', impliesType: 'TextInput', strength: 'normal', priority: 75, description: 'Instruction: type' },
  { category: 'instructionKeyword', keyword: 'indicate', position: 'any', language: 'en', impliesType: 'TextInput', strength: 'normal', priority: 75, description: 'Instruction: indicate' },
  // German
  { category: 'instructionKeyword', keyword: 'einfügen', position: 'any', language: 'de', impliesType: 'TextInput', strength: 'normal', priority: 80, description: 'German: insert' },
  { category: 'instructionKeyword', keyword: 'eingeben', position: 'any', language: 'de', impliesType: 'TextInput', strength: 'normal', priority: 80, description: 'German: enter' },
  { category: 'instructionKeyword', keyword: 'ausfüllen', position: 'any', language: 'de', impliesType: 'TextInput', strength: 'normal', priority: 80, description: 'German: fill out' },
  { category: 'instructionKeyword', keyword: 'angeben', position: 'any', language: 'de', impliesType: 'TextInput', strength: 'normal', priority: 80, description: 'German: specify' },
  { category: 'instructionKeyword', keyword: 'hinzufügen', position: 'any', language: 'de', impliesType: 'TextInput', strength: 'normal', priority: 75, description: 'German: add' },
  // Spanish
  { category: 'instructionKeyword', keyword: 'insertar', position: 'any', language: 'es', impliesType: 'TextInput', strength: 'normal', priority: 80, description: 'Spanish: insert' },
  { category: 'instructionKeyword', keyword: 'llenar', position: 'any', language: 'es', impliesType: 'TextInput', strength: 'normal', priority: 80, description: 'Spanish: fill' },
  { category: 'instructionKeyword', keyword: 'completar', position: 'any', language: 'es', impliesType: 'TextInput', strength: 'normal', priority: 80, description: 'Spanish: complete' },

  // =============================================
  // SKIP PATTERNS (German gender-neutral)
  // =============================================
  { category: 'skipGermanGender', keyword: 'regex:\\*in', position: 'any', language: 'de', impliesType: 'Skip', strength: 'strong', priority: 95, description: 'German: *in, *innen' },
  { category: 'skipGermanGender', keyword: 'regex:vom\\*von', position: 'any', language: 'de', impliesType: 'Skip', strength: 'strong', priority: 95, description: 'German: vom*von' },
  { category: 'skipGermanGender', keyword: 'regex:er\\*sie', position: 'any', language: 'de', impliesType: 'Skip', strength: 'strong', priority: 95, description: 'German: er*sie' },
  { category: 'skipGermanGender', keyword: 'regex:ihm\\*ihr', position: 'any', language: 'de', impliesType: 'Skip', strength: 'strong', priority: 95, description: 'German: ihm*ihr' },
  { category: 'skipGermanGender', keyword: 'regex:sein\\*ihr', position: 'any', language: 'de', impliesType: 'Skip', strength: 'strong', priority: 95, description: 'German: sein*ihr' },
  { category: 'skipGermanGender', keyword: 'regex:seiner\\*ihrer', position: 'any', language: 'de', impliesType: 'Skip', strength: 'strong', priority: 95, description: 'German: seiner*ihrer' },

  // =============================================
  // SKIP PATTERNS (slash conjunctions)
  // =============================================
  { category: 'skipSlashPattern', keyword: 'regex:\\band/or\\b', position: 'any', language: 'en', impliesType: 'Skip', strength: 'strong', priority: 90, description: 'English: and/or' },
  { category: 'skipSlashPattern', keyword: 'regex:\\bund/oder\\b', position: 'any', language: 'de', impliesType: 'Skip', strength: 'strong', priority: 90, description: 'German: und/oder' },
  { category: 'skipSlashPattern', keyword: 'regex:\\ba/nebo\\b', position: 'any', language: 'cs', impliesType: 'Skip', strength: 'strong', priority: 90, description: 'Czech: a/nebo' },
  { category: 'skipSlashPattern', keyword: 'regex:treatments/scripts?\\b', position: 'any', language: null, impliesType: 'Skip', strength: 'strong', priority: 85, description: 'Compound: treatments/scripts' },
  { category: 'skipSlashPattern', keyword: 'regex:treatments/skripte\\b', position: 'any', language: 'de', impliesType: 'Skip', strength: 'strong', priority: 85, description: 'German: treatments/Skripte' },
  { category: 'skipSlashPattern', keyword: 'regex:outlines/treatments\\b', position: 'any', language: null, impliesType: 'Skip', strength: 'strong', priority: 85, description: 'Compound: outlines/treatments' },
  { category: 'skipSlashPattern', keyword: 'regex:revisions/drafts\\b', position: 'any', language: null, impliesType: 'Skip', strength: 'strong', priority: 85, description: 'Compound: revisions/drafts' },
  { category: 'skipSlashPattern', keyword: 'regex:number\\s+of\\s+\\w+/\\w+', position: 'any', language: null, impliesType: 'Skip', strength: 'strong', priority: 85, description: 'Compound: number of X/Y' },
  { category: 'skipSlashPattern', keyword: 'regex:\\w+/\\w+\\s+steps\\b', position: 'any', language: null, impliesType: 'Skip', strength: 'strong', priority: 85, description: 'Compound: xxx/yyy steps' },
  { category: 'skipSlashPattern', keyword: 'regex:\\w+/instructions\\b', position: 'any', language: null, impliesType: 'Skip', strength: 'strong', priority: 85, description: 'Compound: xxx/instructions' },
  { category: 'skipSlashPattern', keyword: 'regex:date/term/delivery\\b', position: 'any', language: null, impliesType: 'Skip', strength: 'strong', priority: 85, description: 'Section header' },
  { category: 'skipSlashPattern', keyword: 'regex:startdatum/laufzeit\\b', position: 'any', language: 'de', impliesType: 'Skip', strength: 'strong', priority: 85, description: 'German section header' },
  { category: 'skipSlashPattern', keyword: 'regex:lieferzeit/timeline\\b', position: 'any', language: 'de', impliesType: 'Skip', strength: 'strong', priority: 85, description: 'German compound' },
  { category: 'skipSlashPattern', keyword: 'regex:änderungen/entwürfe\\b', position: 'any', language: 'de', impliesType: 'Skip', strength: 'strong', priority: 85, description: 'German compound' },
  { category: 'skipSlashPattern', keyword: 'regex:writing\\s+steps', position: 'any', language: null, impliesType: 'Skip', strength: 'strong', priority: 85, description: 'Writing steps context' },
  // Marketing/PR patterns
  { category: 'skipSlashPattern', keyword: 'regex:marketing/pr\\b', position: 'any', language: null, impliesType: 'Skip', strength: 'strong', priority: 85, description: 'Marketing/PR compound' },
  { category: 'skipSlashPattern', keyword: 'regex:promotional/publicity\\b', position: 'any', language: null, impliesType: 'Skip', strength: 'strong', priority: 85, description: 'Promotional/publicity compound' },

  // =============================================
  // TITLE SELECT PATTERNS
  // =============================================
  { category: 'titleSelect', keyword: 'Mr/Ms', position: 'any', language: 'en', impliesType: 'Select', strength: 'strong', priority: 95, description: 'English title' },
  { category: 'titleSelect', keyword: 'D/Dª.', position: 'any', language: 'es', impliesType: 'Select', strength: 'strong', priority: 95, description: 'Spanish title' },
  { category: 'titleSelect', keyword: 'Herr/Frau', position: 'any', language: 'de', impliesType: 'Select', strength: 'strong', priority: 95, description: 'German title' },
  { category: 'titleSelect', keyword: 'Sr./Sra.', position: 'any', language: 'es', impliesType: 'Select', strength: 'strong', priority: 95, description: 'Spanish title alt' },

  // =============================================
  // PARTY NAME PATTERNS (for Link detection)
  // =============================================
  { category: 'partyNamePattern', keyword: 'name', position: 'name', language: null, impliesType: 'Link', strength: 'weak', priority: 60, description: 'Party: contains name' },
  { category: 'partyNamePattern', keyword: 'borrower', position: 'name', language: 'en', impliesType: 'Link', strength: 'normal', priority: 70, description: 'Party: borrower' },
  { category: 'partyNamePattern', keyword: 'lender', position: 'name', language: 'en', impliesType: 'Link', strength: 'normal', priority: 70, description: 'Party: lender' },
  { category: 'partyNamePattern', keyword: 'creditor', position: 'name', language: 'en', impliesType: 'Link', strength: 'normal', priority: 70, description: 'Party: creditor' },
  { category: 'partyNamePattern', keyword: 'debtor', position: 'name', language: 'en', impliesType: 'Link', strength: 'normal', priority: 70, description: 'Party: debtor' },
  { category: 'partyNamePattern', keyword: 'seller', position: 'name', language: 'en', impliesType: 'Link', strength: 'normal', priority: 70, description: 'Party: seller' },
  { category: 'partyNamePattern', keyword: 'buyer', position: 'name', language: 'en', impliesType: 'Link', strength: 'normal', priority: 70, description: 'Party: buyer' },
  { category: 'partyNamePattern', keyword: 'lessor', position: 'name', language: 'en', impliesType: 'Link', strength: 'normal', priority: 70, description: 'Party: lessor' },
  { category: 'partyNamePattern', keyword: 'lessee', position: 'name', language: 'en', impliesType: 'Link', strength: 'normal', priority: 70, description: 'Party: lessee' },
  { category: 'partyNamePattern', keyword: 'guarantor', position: 'name', language: 'en', impliesType: 'Link', strength: 'normal', priority: 70, description: 'Party: guarantor' },
  { category: 'partyNamePattern', keyword: 'tenant', position: 'name', language: 'en', impliesType: 'Link', strength: 'normal', priority: 70, description: 'Party: tenant' },
  { category: 'partyNamePattern', keyword: 'landlord', position: 'name', language: 'en', impliesType: 'Link', strength: 'normal', priority: 70, description: 'Party: landlord' },
];

// ----------------------------------------------------------------------------
// Process Rules (compile regex patterns)
// ----------------------------------------------------------------------------

function compileRules(): TypeRule[] {
  return RAW_RULES.map(rule => {
    const compiled: TypeRule = { ...rule };

    // Compile regex patterns (prefix: "regex:")
    if (rule.keyword.startsWith('regex:')) {
      const pattern = rule.keyword.substring(6);
      try {
        compiled.regex = new RegExp(pattern, 'i');
      } catch {
        console.warn(`[type-rules-local] Failed to compile regex: ${pattern}`);
      }
    }

    return compiled;
  });
}

// ----------------------------------------------------------------------------
// Compiled Rules (singleton)
// ----------------------------------------------------------------------------

let _compiledRules: TypeRule[] | null = null;

/**
 * Get all compiled type rules.
 * Rules are compiled once on first access.
 */
export function getTypeRules(): TypeRule[] {
  if (!_compiledRules) {
    _compiledRules = compileRules();
  }
  return _compiledRules;
}

/**
 * Get rules by category.
 */
export function getRulesByCategory(category: RuleCategory): TypeRule[] {
  return getTypeRules().filter(r => r.category === category);
}

/**
 * Get rules by implied type.
 */
export function getRulesByType(impliesType: AnnotationType | 'Skip'): TypeRule[] {
  return getTypeRules().filter(r => r.impliesType === impliesType);
}

/**
 * Get rules sorted by priority (highest first).
 */
export function getRulesByPriority(): TypeRule[] {
  return [...getTypeRules()].sort((a, b) => b.priority - a.priority);
}

// ----------------------------------------------------------------------------
// Quick Lookup Maps (for performance)
// ----------------------------------------------------------------------------

let _dateBeforeKeywords: Set<string> | null = null;
let _dateAfterKeywords: Set<string> | null = null;
let _moneyBeforeKeywords: Set<string> | null = null;
let _moneyAfterKeywords: Set<string> | null = null;
let _instructionKeywords: Set<string> | null = null;

/**
 * Get date context-before keywords as a Set for fast lookup.
 */
export function getDateBeforeKeywords(): Set<string> {
  if (!_dateBeforeKeywords) {
    _dateBeforeKeywords = new Set(
      getRulesByCategory('dateContextBefore')
        .filter(r => !r.keyword.startsWith('regex:'))
        .map(r => r.keyword.toLowerCase())
    );
  }
  return _dateBeforeKeywords;
}

/**
 * Get date context-after keywords as a Set for fast lookup.
 */
export function getDateAfterKeywords(): Set<string> {
  if (!_dateAfterKeywords) {
    _dateAfterKeywords = new Set(
      getRulesByCategory('dateContextAfter')
        .filter(r => !r.keyword.startsWith('regex:'))
        .map(r => r.keyword.toLowerCase())
    );
  }
  return _dateAfterKeywords;
}

/**
 * Get money context-before keywords as a Set for fast lookup.
 */
export function getMoneyBeforeKeywords(): Set<string> {
  if (!_moneyBeforeKeywords) {
    _moneyBeforeKeywords = new Set(
      getRulesByCategory('moneyContextBefore')
        .filter(r => !r.keyword.startsWith('regex:'))
        .map(r => r.keyword.toLowerCase())
    );
  }
  return _moneyBeforeKeywords;
}

/**
 * Get money context-after keywords as a Set for fast lookup.
 */
export function getMoneyAfterKeywords(): Set<string> {
  if (!_moneyAfterKeywords) {
    _moneyAfterKeywords = new Set(
      getRulesByCategory('moneyContextAfter')
        .filter(r => !r.keyword.startsWith('regex:'))
        .map(r => r.keyword.toLowerCase())
    );
  }
  return _moneyAfterKeywords;
}

/**
 * Get instruction keywords as a Set for fast lookup.
 */
export function getInstructionKeywords(): Set<string> {
  if (!_instructionKeywords) {
    _instructionKeywords = new Set(
      getRulesByCategory('instructionKeyword')
        .filter(r => !r.keyword.startsWith('regex:'))
        .map(r => r.keyword.toLowerCase())
    );
  }
  return _instructionKeywords;
}

// ----------------------------------------------------------------------------
// Export Constants
// ----------------------------------------------------------------------------

export const TOTAL_RULES = RAW_RULES.length;

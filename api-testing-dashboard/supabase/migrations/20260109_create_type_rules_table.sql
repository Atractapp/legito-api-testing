-- =============================================================================
-- Type Rules Database Schema
-- Migration: Create annotator_type_rules table for configurable type inference
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Type Rules Table
-- Stores configurable keyword rules for annotation type inference
-- Replaces hardcoded keyword arrays in route.ts
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS annotator_type_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Owner: NULL = system/global rule, UUID = user-specific rule
  user_id UUID,

  -- Category of rule (groups related keywords)
  -- Examples: 'dateContextBefore', 'moneyContextAfter', 'skipPattern', 'titleSelect'
  category TEXT NOT NULL,

  -- The keyword or pattern to match
  -- For regex patterns, prefix with "regex:" e.g., "regex:\\*in"
  keyword TEXT NOT NULL,

  -- Where to look for this keyword relative to placeholder
  -- 'before' = context before, 'after' = context after, 'name' = in placeholder name, 'any' = anywhere
  position TEXT NOT NULL DEFAULT 'any' CHECK (position IN ('before', 'after', 'name', 'any')),

  -- Language this rule applies to (NULL = all languages)
  language TEXT CHECK (language IN ('en', 'de', 'es', 'cs', 'fr', 'it', 'pt', NULL)),

  -- What annotation type this keyword implies
  implies_type TEXT CHECK (implies_type IN (
    'TextInput', 'Select', 'Date', 'Link', 'Money', 'Calculation', 'Number', 'Checkbox', 'Skip'
  )),

  -- Rule strength: 'strong' = always applies, 'weak' = needs other signals
  strength TEXT NOT NULL DEFAULT 'normal' CHECK (strength IN ('strong', 'weak', 'normal')),

  -- Source of this rule
  source TEXT NOT NULL DEFAULT 'system' CHECK (source IN ('system', 'user', 'ai-learned')),

  -- Priority for ordering (higher = checked first)
  priority INTEGER DEFAULT 50 CHECK (priority >= 0 AND priority <= 100),

  -- Is this rule currently active?
  is_active BOOLEAN DEFAULT TRUE,

  -- Description for admin UI
  description TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- Indexes for Performance
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_type_rules_category ON annotator_type_rules(category);
CREATE INDEX IF NOT EXISTS idx_type_rules_user ON annotator_type_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_type_rules_active ON annotator_type_rules(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_type_rules_language ON annotator_type_rules(language);
CREATE INDEX IF NOT EXISTS idx_type_rules_implies_type ON annotator_type_rules(implies_type);
CREATE INDEX IF NOT EXISTS idx_type_rules_priority ON annotator_type_rules(priority DESC);

-- Unique constraint to prevent duplicate rules
CREATE UNIQUE INDEX IF NOT EXISTS idx_type_rules_unique
ON annotator_type_rules(COALESCE(user_id, '00000000-0000-0000-0000-000000000000'), category, keyword, position);

-- -----------------------------------------------------------------------------
-- Seed System Rules from Hardcoded Keywords
-- These rules are extracted from route.ts and provide the baseline behavior
-- -----------------------------------------------------------------------------

-- =============================================
-- STRONG DATE INDICATORS (context before)
-- =============================================
INSERT INTO annotator_type_rules (user_id, category, keyword, position, language, implies_type, strength, source, priority, description)
VALUES
  -- Czech strong date indicators
  (NULL, 'dateContextBefore', 'ze dne', 'before', 'cs', 'Date', 'strong', 'system', 90, 'Czech: dated'),
  (NULL, 'dateContextBefore', 'ke dni', 'before', 'cs', 'Date', 'strong', 'system', 90, 'Czech: as of'),
  (NULL, 'dateContextBefore', 'dne', 'before', 'cs', 'Date', 'strong', 'system', 90, 'Czech: on day'),
  (NULL, 'dateContextBefore', 'dňa', 'before', 'cs', 'Date', 'strong', 'system', 90, 'Slovak: on day'),
  (NULL, 'dateContextBefore', 'datum', 'before', 'cs', 'Date', 'strong', 'system', 90, 'Czech: date'),
  (NULL, 'dateContextBefore', 'v den', 'before', 'cs', 'Date', 'strong', 'system', 90, 'Czech: on the day'),
  (NULL, 'dateContextBefore', 'uzavřena dne', 'before', 'cs', 'Date', 'strong', 'system', 90, 'Czech: concluded on'),
  (NULL, 'dateContextBefore', 'podepsáno dne', 'before', 'cs', 'Date', 'strong', 'system', 90, 'Czech: signed on'),
  (NULL, 'dateContextBefore', 'v praze dne', 'before', 'cs', 'Date', 'strong', 'system', 90, 'Czech: in Prague on'),
  (NULL, 'dateContextBefore', 'dnem', 'before', 'cs', 'Date', 'strong', 'system', 90, 'Czech: with day'),

  -- English strong date indicators
  (NULL, 'dateContextBefore', 'dated', 'before', 'en', 'Date', 'strong', 'system', 90, 'English: dated'),
  (NULL, 'dateContextBefore', 'as of', 'before', 'en', 'Date', 'strong', 'system', 90, 'English: as of'),
  (NULL, 'dateContextBefore', 'effective date', 'before', 'en', 'Date', 'strong', 'system', 90, 'English: effective date'),
  (NULL, 'dateContextBefore', 'valid until', 'before', 'en', 'Date', 'strong', 'system', 90, 'English: valid until'),
  (NULL, 'dateContextBefore', 'expires on', 'before', 'en', 'Date', 'strong', 'system', 90, 'English: expires on'),
  (NULL, 'dateContextBefore', 'due by', 'before', 'en', 'Date', 'strong', 'system', 90, 'English: due by'),
  (NULL, 'dateContextBefore', 'signed on', 'before', 'en', 'Date', 'strong', 'system', 90, 'English: signed on'),
  (NULL, 'dateContextBefore', 'executed on', 'before', 'en', 'Date', 'strong', 'system', 90, 'English: executed on'),
  (NULL, 'dateContextBefore', 'starting on', 'before', 'en', 'Date', 'strong', 'system', 90, 'English: starting on'),
  (NULL, 'dateContextBefore', 'ending on', 'before', 'en', 'Date', 'strong', 'system', 90, 'English: ending on'),
  (NULL, 'dateContextBefore', 'commencing on', 'before', 'en', 'Date', 'strong', 'system', 90, 'English: commencing on'),
  (NULL, 'dateContextBefore', 'beginning on', 'before', 'en', 'Date', 'strong', 'system', 90, 'English: beginning on'),
  (NULL, 'dateContextBefore', 'until', 'before', 'en', 'Date', 'strong', 'system', 85, 'English: until'),
  (NULL, 'dateContextBefore', 'through', 'before', 'en', 'Date', 'strong', 'system', 85, 'English: through'),
  (NULL, 'dateContextBefore', 'till', 'before', 'en', 'Date', 'strong', 'system', 85, 'English: till'),

  -- German strong date indicators
  (NULL, 'dateContextBefore', 'bis zum', 'before', 'de', 'Date', 'strong', 'system', 90, 'German: until'),
  (NULL, 'dateContextBefore', 'bis', 'before', 'de', 'Date', 'strong', 'system', 85, 'German: until'),
  (NULL, 'dateContextBefore', 'vom', 'before', 'de', 'Date', 'strong', 'system', 90, 'German: from'),
  (NULL, 'dateContextBefore', 'ab dem', 'before', 'de', 'Date', 'strong', 'system', 90, 'German: from the'),
  (NULL, 'dateContextBefore', 'zum', 'before', 'de', 'Date', 'strong', 'system', 85, 'German: to the'),
  (NULL, 'dateContextBefore', 'vor dem', 'before', 'de', 'Date', 'strong', 'system', 90, 'German: before the'),

  -- Spanish strong date indicators
  (NULL, 'dateContextBefore', 'el día', 'before', 'es', 'Date', 'strong', 'system', 90, 'Spanish: the day'),
  (NULL, 'dateContextBefore', 'fecha', 'before', 'es', 'Date', 'strong', 'system', 90, 'Spanish: date'),
  (NULL, 'dateContextBefore', 'hasta', 'before', 'es', 'Date', 'strong', 'system', 85, 'Spanish: until'),
  (NULL, 'dateContextBefore', 'desde', 'before', 'es', 'Date', 'strong', 'system', 85, 'Spanish: from')
ON CONFLICT DO NOTHING;

-- =============================================
-- WEAK DATE INDICATORS (context before, needs date-like placeholder)
-- =============================================
INSERT INTO annotator_type_rules (user_id, category, keyword, position, language, implies_type, strength, source, priority, description)
VALUES
  (NULL, 'dateContextBefore', 'do', 'before', 'cs', 'Date', 'weak', 'system', 60, 'Czech: to/until'),
  (NULL, 'dateContextBefore', 'od', 'before', 'cs', 'Date', 'weak', 'system', 60, 'Czech: from'),
  (NULL, 'dateContextBefore', 'on', 'before', 'en', 'Date', 'weak', 'system', 60, 'English: on'),
  (NULL, 'dateContextBefore', 'by', 'before', 'en', 'Date', 'weak', 'system', 60, 'English: by'),
  (NULL, 'dateContextBefore', 'from', 'before', 'en', 'Date', 'weak', 'system', 60, 'English: from'),
  (NULL, 'dateContextBefore', 'effective', 'before', 'en', 'Date', 'weak', 'system', 60, 'English: effective'),
  (NULL, 'dateContextBefore', 'platnosti do', 'before', 'cs', 'Date', 'weak', 'system', 70, 'Czech: valid until'),
  (NULL, 'dateContextBefore', 'účinnosti do', 'before', 'cs', 'Date', 'weak', 'system', 70, 'Czech: effective until'),
  (NULL, 'dateContextBefore', 'termín', 'before', 'cs', 'Date', 'weak', 'system', 70, 'Czech: term'),
  (NULL, 'dateContextBefore', 'lhůta', 'before', 'cs', 'Date', 'weak', 'system', 70, 'Czech: deadline'),
  (NULL, 'dateContextBefore', 'platné do', 'before', 'cs', 'Date', 'weak', 'system', 70, 'Czech: valid until'),
  (NULL, 'dateContextBefore', 'hasta el', 'before', 'es', 'Date', 'weak', 'system', 70, 'Spanish: until the'),
  (NULL, 'dateContextBefore', 'desde el', 'before', 'es', 'Date', 'weak', 'system', 70, 'Spanish: from the')
ON CONFLICT DO NOTHING;

-- =============================================
-- DATE INDICATORS (context after)
-- =============================================
INSERT INTO annotator_type_rules (user_id, category, keyword, position, language, implies_type, strength, source, priority, description)
VALUES
  (NULL, 'dateContextAfter', 'roku', 'after', 'cs', 'Date', 'normal', 'system', 75, 'Czech: year'),
  (NULL, 'dateContextAfter', 'měsíce', 'after', 'cs', 'Date', 'normal', 'system', 75, 'Czech: month'),
  (NULL, 'dateContextAfter', 'dní', 'after', 'cs', 'Date', 'normal', 'system', 75, 'Czech: days'),
  (NULL, 'dateContextAfter', 'year', 'after', 'en', 'Date', 'normal', 'system', 75, 'English: year'),
  (NULL, 'dateContextAfter', 'month', 'after', 'en', 'Date', 'normal', 'system', 75, 'English: month'),
  (NULL, 'dateContextAfter', 'day', 'after', 'en', 'Date', 'normal', 'system', 75, 'English: day')
ON CONFLICT DO NOTHING;

-- =============================================
-- DATE INDICATORS (in placeholder name)
-- =============================================
INSERT INTO annotator_type_rules (user_id, category, keyword, position, language, implies_type, strength, source, priority, description)
VALUES
  (NULL, 'dateNameKeyword', 'date', 'name', NULL, 'Date', 'normal', 'system', 70, 'Name contains date'),
  (NULL, 'dateNameKeyword', 'datum', 'name', NULL, 'Date', 'normal', 'system', 70, 'Name contains datum'),
  (NULL, 'dateNameKeyword', 'signed', 'name', NULL, 'Date', 'normal', 'system', 70, 'Name contains signed'),
  (NULL, 'dateNameKeyword', 'signature', 'name', NULL, 'Date', 'normal', 'system', 70, 'Name contains signature')
ON CONFLICT DO NOTHING;

-- =============================================
-- MONEY INDICATORS (context after)
-- =============================================
INSERT INTO annotator_type_rules (user_id, category, keyword, position, language, implies_type, strength, source, priority, description)
VALUES
  -- Currencies
  (NULL, 'moneyContextAfter', 'kč', 'after', 'cs', 'Money', 'strong', 'system', 90, 'Czech: CZK'),
  (NULL, 'moneyContextAfter', 'czk', 'after', 'cs', 'Money', 'strong', 'system', 90, 'Czech koruna'),
  (NULL, 'moneyContextAfter', 'eur', 'after', NULL, 'Money', 'strong', 'system', 90, 'Euro'),
  (NULL, 'moneyContextAfter', 'usd', 'after', NULL, 'Money', 'strong', 'system', 90, 'US Dollar'),
  (NULL, 'moneyContextAfter', 'gbp', 'after', NULL, 'Money', 'strong', 'system', 90, 'British Pound'),
  (NULL, 'moneyContextAfter', '€', 'after', NULL, 'Money', 'strong', 'system', 90, 'Euro symbol'),
  (NULL, 'moneyContextAfter', '$', 'after', NULL, 'Money', 'strong', 'system', 90, 'Dollar symbol'),
  (NULL, 'moneyContextAfter', '£', 'after', NULL, 'Money', 'strong', 'system', 90, 'Pound symbol'),
  (NULL, 'moneyContextAfter', 'korun', 'after', 'cs', 'Money', 'strong', 'system', 85, 'Czech: korun'),
  (NULL, 'moneyContextAfter', 'euro', 'after', NULL, 'Money', 'strong', 'system', 85, 'Euro (word)'),
  (NULL, 'moneyContextAfter', 'dolar', 'after', 'cs', 'Money', 'strong', 'system', 85, 'Czech: dollar'),
  -- Percentage
  (NULL, 'moneyContextAfter', '%', 'after', NULL, 'Money', 'normal', 'system', 80, 'Percent symbol'),
  (NULL, 'moneyContextAfter', 'procent', 'after', 'cs', 'Money', 'normal', 'system', 80, 'Czech: percent'),
  (NULL, 'moneyContextAfter', 'percent', 'after', 'en', 'Money', 'normal', 'system', 80, 'English: percent'),
  -- Czech money patterns
  (NULL, 'moneyContextAfter', ',- kč', 'after', 'cs', 'Money', 'strong', 'system', 95, 'Czech: amount format'),
  (NULL, 'moneyContextAfter', ',-kč', 'after', 'cs', 'Money', 'strong', 'system', 95, 'Czech: amount format'),
  (NULL, 'moneyContextAfter', ',- czk', 'after', 'cs', 'Money', 'strong', 'system', 95, 'Czech: amount format')
ON CONFLICT DO NOTHING;

-- =============================================
-- MONEY INDICATORS (context before)
-- =============================================
INSERT INTO annotator_type_rules (user_id, category, keyword, position, language, implies_type, strength, source, priority, description)
VALUES
  (NULL, 'moneyContextBefore', 'částku', 'before', 'cs', 'Money', 'strong', 'system', 85, 'Czech: amount'),
  (NULL, 'moneyContextBefore', 'částka', 'before', 'cs', 'Money', 'strong', 'system', 85, 'Czech: amount'),
  (NULL, 'moneyContextBefore', 've výši', 'before', 'cs', 'Money', 'strong', 'system', 90, 'Czech: in the amount of'),
  (NULL, 'moneyContextBefore', 'amount of', 'before', 'en', 'Money', 'strong', 'system', 85, 'English: amount of'),
  (NULL, 'moneyContextBefore', 'sum of', 'before', 'en', 'Money', 'strong', 'system', 85, 'English: sum of'),
  (NULL, 'moneyContextBefore', 'price of', 'before', 'en', 'Money', 'strong', 'system', 85, 'English: price of'),
  (NULL, 'moneyContextBefore', 'hodnota', 'before', 'cs', 'Money', 'normal', 'system', 75, 'Czech: value'),
  (NULL, 'moneyContextBefore', 'cena', 'before', 'cs', 'Money', 'normal', 'system', 75, 'Czech: price')
ON CONFLICT DO NOTHING;

-- =============================================
-- MONEY INDICATORS (in placeholder name)
-- =============================================
INSERT INTO annotator_type_rules (user_id, category, keyword, position, language, implies_type, strength, source, priority, description)
VALUES
  (NULL, 'moneyNameKeyword', 'value', 'name', 'en', 'Money', 'normal', 'system', 70, 'Name contains value'),
  (NULL, 'moneyNameKeyword', 'price', 'name', NULL, 'Money', 'normal', 'system', 70, 'Name contains price'),
  (NULL, 'moneyNameKeyword', 'cost', 'name', NULL, 'Money', 'normal', 'system', 70, 'Name contains cost'),
  (NULL, 'moneyNameKeyword', 'fee', 'name', NULL, 'Money', 'normal', 'system', 70, 'Name contains fee'),
  (NULL, 'moneyNameKeyword', 'payment', 'name', NULL, 'Money', 'normal', 'system', 70, 'Name contains payment'),
  (NULL, 'moneyNameKeyword', 'sum', 'name', NULL, 'Money', 'normal', 'system', 70, 'Name contains sum'),
  (NULL, 'moneyNameKeyword', 'loan', 'name', NULL, 'Money', 'normal', 'system', 70, 'Name contains loan'),
  (NULL, 'moneyNameKeyword', 'money', 'name', NULL, 'Money', 'normal', 'system', 70, 'Name contains money'),
  (NULL, 'moneyNameKeyword', 'salary', 'name', NULL, 'Money', 'normal', 'system', 70, 'Name contains salary'),
  (NULL, 'moneyNameKeyword', 'wage', 'name', NULL, 'Money', 'normal', 'system', 70, 'Name contains wage'),
  (NULL, 'moneyNameKeyword', 'cena', 'name', 'cs', 'Money', 'normal', 'system', 70, 'Czech: price'),
  (NULL, 'moneyNameKeyword', 'částka', 'name', 'cs', 'Money', 'normal', 'system', 70, 'Czech: amount'),
  (NULL, 'moneyNameKeyword', 'půjčka', 'name', 'cs', 'Money', 'normal', 'system', 70, 'Czech: loan'),
  (NULL, 'moneyNameKeyword', 'úvěr', 'name', 'cs', 'Money', 'normal', 'system', 70, 'Czech: credit')
ON CONFLICT DO NOTHING;

-- =============================================
-- SELECT INDICATORS (in placeholder name)
-- =============================================
INSERT INTO annotator_type_rules (user_id, category, keyword, position, language, implies_type, strength, source, priority, description)
VALUES
  (NULL, 'selectNameKeyword', 'option', 'name', NULL, 'Select', 'normal', 'system', 70, 'Name contains option'),
  (NULL, 'selectNameKeyword', 'choice', 'name', NULL, 'Select', 'normal', 'system', 70, 'Name contains choice'),
  (NULL, 'selectNameKeyword', 'select', 'name', NULL, 'Select', 'normal', 'system', 70, 'Name contains select'),
  (NULL, 'selectNameKeyword', 'type', 'name', NULL, 'Select', 'normal', 'system', 65, 'Name contains type')
ON CONFLICT DO NOTHING;

-- =============================================
-- INSTRUCTION KEYWORDS (for TextInput detection)
-- =============================================
INSERT INTO annotator_type_rules (user_id, category, keyword, position, language, implies_type, strength, source, priority, description)
VALUES
  (NULL, 'instructionKeyword', 'insert', 'any', 'en', 'TextInput', 'normal', 'system', 80, 'Instruction: insert'),
  (NULL, 'instructionKeyword', 'enter', 'any', 'en', 'TextInput', 'normal', 'system', 80, 'Instruction: enter'),
  (NULL, 'instructionKeyword', 'fill in', 'any', 'en', 'TextInput', 'normal', 'system', 80, 'Instruction: fill in'),
  (NULL, 'instructionKeyword', 'fill out', 'any', 'en', 'TextInput', 'normal', 'system', 80, 'Instruction: fill out'),
  (NULL, 'instructionKeyword', 'specify', 'any', 'en', 'TextInput', 'normal', 'system', 80, 'Instruction: specify'),
  (NULL, 'instructionKeyword', 'provide', 'any', 'en', 'TextInput', 'normal', 'system', 80, 'Instruction: provide'),
  (NULL, 'instructionKeyword', 'add', 'any', 'en', 'TextInput', 'normal', 'system', 75, 'Instruction: add'),
  (NULL, 'instructionKeyword', 'write', 'any', 'en', 'TextInput', 'normal', 'system', 75, 'Instruction: write'),
  (NULL, 'instructionKeyword', 'type', 'any', 'en', 'TextInput', 'normal', 'system', 75, 'Instruction: type'),
  (NULL, 'instructionKeyword', 'indicate', 'any', 'en', 'TextInput', 'normal', 'system', 75, 'Instruction: indicate'),
  -- German
  (NULL, 'instructionKeyword', 'einfügen', 'any', 'de', 'TextInput', 'normal', 'system', 80, 'German: insert'),
  (NULL, 'instructionKeyword', 'eingeben', 'any', 'de', 'TextInput', 'normal', 'system', 80, 'German: enter'),
  (NULL, 'instructionKeyword', 'ausfüllen', 'any', 'de', 'TextInput', 'normal', 'system', 80, 'German: fill out'),
  (NULL, 'instructionKeyword', 'angeben', 'any', 'de', 'TextInput', 'normal', 'system', 80, 'German: specify'),
  (NULL, 'instructionKeyword', 'hinzufügen', 'any', 'de', 'TextInput', 'normal', 'system', 75, 'German: add'),
  -- Spanish
  (NULL, 'instructionKeyword', 'insertar', 'any', 'es', 'TextInput', 'normal', 'system', 80, 'Spanish: insert'),
  (NULL, 'instructionKeyword', 'llenar', 'any', 'es', 'TextInput', 'normal', 'system', 80, 'Spanish: fill'),
  (NULL, 'instructionKeyword', 'completar', 'any', 'es', 'TextInput', 'normal', 'system', 80, 'Spanish: complete')
ON CONFLICT DO NOTHING;

-- =============================================
-- SKIP PATTERNS (German gender-neutral)
-- =============================================
INSERT INTO annotator_type_rules (user_id, category, keyword, position, language, implies_type, strength, source, priority, description)
VALUES
  (NULL, 'skipGermanGender', 'regex:\\*in', 'any', 'de', 'Skip', 'strong', 'system', 95, 'German: *in, *innen'),
  (NULL, 'skipGermanGender', 'regex:vom\\*von', 'any', 'de', 'Skip', 'strong', 'system', 95, 'German: vom*von'),
  (NULL, 'skipGermanGender', 'regex:er\\*sie', 'any', 'de', 'Skip', 'strong', 'system', 95, 'German: er*sie'),
  (NULL, 'skipGermanGender', 'regex:ihm\\*ihr', 'any', 'de', 'Skip', 'strong', 'system', 95, 'German: ihm*ihr'),
  (NULL, 'skipGermanGender', 'regex:sein\\*ihr', 'any', 'de', 'Skip', 'strong', 'system', 95, 'German: sein*ihr'),
  (NULL, 'skipGermanGender', 'regex:seiner\\*ihrer', 'any', 'de', 'Skip', 'strong', 'system', 95, 'German: seiner*ihrer')
ON CONFLICT DO NOTHING;

-- =============================================
-- SKIP PATTERNS (slash conjunctions)
-- =============================================
INSERT INTO annotator_type_rules (user_id, category, keyword, position, language, implies_type, strength, source, priority, description)
VALUES
  (NULL, 'skipSlashPattern', 'regex:\\band/or\\b', 'any', 'en', 'Skip', 'strong', 'system', 90, 'English: and/or'),
  (NULL, 'skipSlashPattern', 'regex:\\bund/oder\\b', 'any', 'de', 'Skip', 'strong', 'system', 90, 'German: und/oder'),
  (NULL, 'skipSlashPattern', 'regex:\\ba/nebo\\b', 'any', 'cs', 'Skip', 'strong', 'system', 90, 'Czech: a/nebo'),
  (NULL, 'skipSlashPattern', 'regex:treatments/scripts?\\b', 'any', NULL, 'Skip', 'strong', 'system', 85, 'Compound: treatments/scripts'),
  (NULL, 'skipSlashPattern', 'regex:treatments/skripte\\b', 'any', 'de', 'Skip', 'strong', 'system', 85, 'German: treatments/Skripte'),
  (NULL, 'skipSlashPattern', 'regex:outlines/treatments\\b', 'any', NULL, 'Skip', 'strong', 'system', 85, 'Compound: outlines/treatments'),
  (NULL, 'skipSlashPattern', 'regex:revisions/drafts\\b', 'any', NULL, 'Skip', 'strong', 'system', 85, 'Compound: revisions/drafts'),
  (NULL, 'skipSlashPattern', 'regex:number\\s+of\\s+\\w+/\\w+', 'any', NULL, 'Skip', 'strong', 'system', 85, 'Compound: number of X/Y'),
  (NULL, 'skipSlashPattern', 'regex:\\w+/\\w+\\s+steps\\b', 'any', NULL, 'Skip', 'strong', 'system', 85, 'Compound: xxx/yyy steps'),
  (NULL, 'skipSlashPattern', 'regex:\\w+/instructions\\b', 'any', NULL, 'Skip', 'strong', 'system', 85, 'Compound: xxx/instructions'),
  (NULL, 'skipSlashPattern', 'regex:date/term/delivery\\b', 'any', NULL, 'Skip', 'strong', 'system', 85, 'Section header'),
  (NULL, 'skipSlashPattern', 'regex:startdatum/laufzeit\\b', 'any', 'de', 'Skip', 'strong', 'system', 85, 'German section header'),
  (NULL, 'skipSlashPattern', 'regex:lieferzeit/timeline\\b', 'any', 'de', 'Skip', 'strong', 'system', 85, 'German compound'),
  (NULL, 'skipSlashPattern', 'regex:änderungen/entwürfe\\b', 'any', 'de', 'Skip', 'strong', 'system', 85, 'German compound'),
  (NULL, 'skipSlashPattern', 'regex:writing\\s+steps', 'any', NULL, 'Skip', 'strong', 'system', 85, 'Writing steps context')
ON CONFLICT DO NOTHING;

-- =============================================
-- TITLE SELECT PATTERNS
-- =============================================
INSERT INTO annotator_type_rules (user_id, category, keyword, position, language, implies_type, strength, source, priority, description)
VALUES
  (NULL, 'titleSelect', 'Mr/Ms', 'any', 'en', 'Select', 'strong', 'system', 95, 'English title'),
  (NULL, 'titleSelect', 'D/Dª.', 'any', 'es', 'Select', 'strong', 'system', 95, 'Spanish title'),
  (NULL, 'titleSelect', 'Herr/Frau', 'any', 'de', 'Select', 'strong', 'system', 95, 'German title'),
  (NULL, 'titleSelect', 'Sr./Sra.', 'any', 'es', 'Select', 'strong', 'system', 95, 'Spanish title alt')
ON CONFLICT DO NOTHING;

-- =============================================
-- PARTY NAME PATTERNS (for Link detection)
-- =============================================
INSERT INTO annotator_type_rules (user_id, category, keyword, position, language, implies_type, strength, source, priority, description)
VALUES
  (NULL, 'partyNamePattern', 'name', 'name', NULL, 'Link', 'weak', 'system', 60, 'Party: contains name'),
  (NULL, 'partyNamePattern', 'borrower', 'name', 'en', 'Link', 'normal', 'system', 70, 'Party: borrower'),
  (NULL, 'partyNamePattern', 'lender', 'name', 'en', 'Link', 'normal', 'system', 70, 'Party: lender'),
  (NULL, 'partyNamePattern', 'creditor', 'name', 'en', 'Link', 'normal', 'system', 70, 'Party: creditor'),
  (NULL, 'partyNamePattern', 'debtor', 'name', 'en', 'Link', 'normal', 'system', 70, 'Party: debtor'),
  (NULL, 'partyNamePattern', 'seller', 'name', 'en', 'Link', 'normal', 'system', 70, 'Party: seller'),
  (NULL, 'partyNamePattern', 'buyer', 'name', 'en', 'Link', 'normal', 'system', 70, 'Party: buyer'),
  (NULL, 'partyNamePattern', 'lessor', 'name', 'en', 'Link', 'normal', 'system', 70, 'Party: lessor'),
  (NULL, 'partyNamePattern', 'lessee', 'name', 'en', 'Link', 'normal', 'system', 70, 'Party: lessee'),
  (NULL, 'partyNamePattern', 'guarantor', 'name', 'en', 'Link', 'normal', 'system', 70, 'Party: guarantor'),
  (NULL, 'partyNamePattern', 'tenant', 'name', 'en', 'Link', 'normal', 'system', 70, 'Party: tenant'),
  (NULL, 'partyNamePattern', 'landlord', 'name', 'en', 'Link', 'normal', 'system', 70, 'Party: landlord')
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- Update Trigger for updated_at
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_type_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_type_rules_updated_at ON annotator_type_rules;
CREATE TRIGGER trigger_type_rules_updated_at
  BEFORE UPDATE ON annotator_type_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_type_rules_updated_at();

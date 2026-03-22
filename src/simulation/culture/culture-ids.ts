/**
 * Canonical definitions for culture, religion, language, and ethnic-group identifiers.
 *
 * Kept in a dedicated file so that both `simulation/population/person.ts` (which
 * re-exports these for backward compatibility) and `simulation/culture/` modules
 * can import from a single authoritative source without creating a circular
 * dependency.
 *
 * No imports from the rest of the simulation — this file is a pure type +
 * constant leaf node in the import graph.
 */

// ─── Ethnic Group ─────────────────────────────────────────────────────────────

/**
 * All ethnic groups that can appear as bloodline fractions in a person's heritage.
 * The two macro-groups are Imanian (colonists) and Sauromatian (indigenous — all
 * Kiswani and Hanjoda sub-groups).
 */
export type EthnicGroup =
  | 'imanian'
  | 'kiswani_riverfolk'
  | 'kiswani_bayuk'
  | 'kiswani_haisla'
  | 'hanjoda_stormcaller'
  | 'hanjoda_bloodmoon'
  | 'hanjoda_talon'
  | 'hanjoda_emrasi';
// Future expansion: 'weri' | 'avari' | 'confederate'

// ─── Cultural Identity ────────────────────────────────────────────────────────

/**
 * Cultural identity identifiers.
 * Represents how a person self-identifies, independent of biological bloodline.
 * Determined by upbringing, education, and lived experience.
 *
 * Broad Sauromatian IDs ('kiswani_traditional', 'hanjoda_traditional') are kept
 * as pan-tribal identities for acculturated or blended individuals.
 * Sub-group IDs map more precisely to specific ethnic communities.
 */
export type CultureId =
  // Imanian (colonist origin)
  | 'imanian_homeland'
  | 'ansberite'
  | 'townborn'
  // Settlement-born emergent identity
  | 'settlement_native'
  // Sauromatian — broad (pan-tribal / blended)
  | 'kiswani_traditional'
  | 'hanjoda_traditional'
  // Sauromatian — Kiswani sub-groups
  | 'kiswani_riverfolk'
  | 'kiswani_bayuk'
  | 'kiswani_haisla'
  // Sauromatian — Hanjoda sub-groups
  | 'hanjoda_stormcaller'
  | 'hanjoda_bloodmoon'
  | 'hanjoda_talon'
  | 'hanjoda_emrasi'
  // Borderland / mixed-origin identities
  | 'sauro_borderfolk'
  | 'sauro_wildborn';

// ─── Religion ─────────────────────────────────────────────────────────────────

/**
 * Religion identifiers.
 *
 * 'irreligious' was removed — the three active traditions are sufficient and
 * its presence complicated the tension formula.
 */
export type ReligionId =
  | 'imanian_orthodox'
  | 'sacred_wheel'
  | 'syncretic_hidden_wheel';

// ─── Language ─────────────────────────────────────────────────────────────────

/**
 * Language identifiers.
 *
 * - imanian          — spoken by Imanian settlers and colonists
 * - kiswani          — spoken by all Kiswani Sauromatian sub-groups
 * - hanjoda          — spoken by all Hanjoda Sauromatian sub-groups
 * - tradetalk        — simplified pidgin; never exceeds 0.50 fluency
 * - settlement_creole — emergent creole; appears after a generation of bilingual cohabitation
 */
export type LanguageId = 'imanian' | 'kiswani' | 'hanjoda' | 'tradetalk' | 'settlement_creole';

// ─── Lookup Tables ────────────────────────────────────────────────────────────

/**
 * Maps each ethnic group to the primary language spoken by that group.
 * Used when initialising founding settlers, immigrants, and tribal contacts.
 */
export const ETHNIC_GROUP_PRIMARY_LANGUAGE: Record<EthnicGroup, LanguageId> = {
  imanian:              'imanian',
  kiswani_riverfolk:    'kiswani',
  kiswani_bayuk:        'kiswani',
  kiswani_haisla:       'kiswani',
  hanjoda_stormcaller:  'hanjoda',
  hanjoda_bloodmoon:    'hanjoda',
  hanjoda_talon:        'hanjoda',
  hanjoda_emrasi:       'hanjoda',
};

/**
 * Maps each ethnic group to the most specific CultureId that represents
 * a person raised fully within that ethnic community.
 *
 * Used when initialising founding women and immigrants, so they get the
 * correct sub-group culture rather than the broad pan-tribal label.
 */
export const ETHNIC_GROUP_CULTURE: Record<EthnicGroup, CultureId> = {
  imanian:              'ansberite',
  kiswani_riverfolk:    'kiswani_riverfolk',
  kiswani_bayuk:        'kiswani_bayuk',
  kiswani_haisla:       'kiswani_haisla',
  hanjoda_stormcaller:  'hanjoda_stormcaller',
  hanjoda_bloodmoon:    'hanjoda_bloodmoon',
  hanjoda_talon:        'hanjoda_talon',
  hanjoda_emrasi:       'hanjoda_emrasi',
};

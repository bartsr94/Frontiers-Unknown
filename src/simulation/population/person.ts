/**
 * Person data model — the core unit of the Palusteria simulation.
 *
 * Every living individual in the settlement is represented by a Person.
 * This module also defines supporting types (heritage, health, fertility,
 * cultural identity) and the createPerson() factory.
 *
 * Note: ReligionId and LanguageId are defined here (not in culture/) to keep
 * the import graph acyclic — game-state.ts imports both Person and these types.
 */

import { generateId } from '../../utils/id';
import type { GeneticProfile, VisibleTraits } from '../genetics/traits';
import type { TraitId } from '../personality/traits';
import type { SeededRNG } from '../../utils/rng';

// ─── Ethnic & Cultural Identity ───────────────────────────────────────────────

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

/**
 * Religion identifiers.
 * Defined here (not in culture/) to keep game-state.ts's import graph acyclic.
 */
export type ReligionId =
  | 'imanian_orthodox'
  | 'sacred_wheel'
  | 'syncretic_hidden_wheel'
  | 'irreligious';

/**
 * Language identifiers.
 * Defined here (not in culture/) for the same acyclic-import reason as ReligionId.
 *
 * - imanian          — spoken by Imanian settlers and colonists
 * - kiswani          — spoken by all Kiswani Sauromatian sub-groups
 * - hanjoda          — spoken by all Hanjoda Sauromatian sub-groups
 * - tradetalk        — simplified pidgin; never exceeds 0.50 fluency
 * - settlement_creole — emergent creole; appears after a generation of bilingual cohabitation
 */
export type LanguageId = 'imanian' | 'kiswani' | 'hanjoda' | 'tradetalk' | 'settlement_creole';

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

// ─── Bloodline & Heritage ─────────────────────────────────────────────────────

/**
 * A single ethnic group entry in a person's biological bloodline.
 * All BloodlineEntry fractions for a person must sum to exactly 1.0.
 */
export interface BloodlineEntry {
  /** The ethnic group this entry represents. */
  group: EthnicGroup;
  /** The fraction of this group in the person's ancestry (0.0–1.0). */
  fraction: number;
}

/**
 * A person's fluency in a specific language.
 * Fluency grows through use, education, and community immersion.
 */
export interface LanguageFluency {
  /** The language in question. */
  language: LanguageId;
  /** Fluency level: 0.0 = no knowledge, 1.0 = native speaker. */
  fluency: number;
}

/**
 * A person's full heritage — biological ancestry (bloodline) and cultural
 * identity (how they were raised). These two axes are tracked independently
 * and can diverge significantly across generations.
 */
export interface Heritage {
  /**
   * Biological ancestry expressed as fractional ethnic group entries.
   * All fractions must sum to 1.0.
   */
  bloodline: BloodlineEntry[];
  /**
   * The culture the person primarily identifies with.
   * Determined by upbringing and environment, not bloodline.
   */
  primaryCulture: CultureId;
  /**
   * Depth of familiarity with each culture (0.0 = unknown, 1.0 = native).
   * Grows through education, marriage, and prolonged exposure.
   */
  culturalFluency: Map<CultureId, number>;
}

// ─── Health & Conditions ──────────────────────────────────────────────────────

/** Ongoing health conditions that affect a person's stats and mortality risk. */
export type HealthCondition =
  | 'wounded'
  | 'ill'
  | 'malnourished'
  | 'recovering'
  | 'chronic_illness'
  /** Age-related frailty — significantly increases mortality risk each turn. */
  | 'frail';

/**
 * State of an active pregnancy.
 * Stored on the mother; resolved automatically by processPregnancies() each turn.
 */
export interface PregnancyState {
  /** ID of the biological father. */
  fatherId: string;
  /** Turn number when conception occurred. */
  conceptionTurn: number;
  /** Turn number when the birth is expected (~3 turns after conception). */
  dueDate: number;
}

/** A person's current health state. */
export interface HealthState {
  /** Health score 0–100. 0 = critically ill / dying; 100 = perfect health. */
  currentHealth: number;
  /** All active health conditions affecting this person. */
  conditions: HealthCondition[];
  /** Active pregnancy state, if any. Meaningful only for females. */
  pregnancy?: PregnancyState;
}

// ─── Fertility ────────────────────────────────────────────────────────────────

/**
 * A person's fertility profile — age windows during which reproduction is possible.
 * The pregnancy system consults this each turn when evaluating conception chances.
 */
export interface FertilityProfile {
  /**
   * Whether Kethara's Bargain applies — extending female fertility into the
   * early fifties. Always inherited through the maternal line, regardless of
   * the father's heritage.
   */
  isExtended: boolean;
  /** Age at which fertility begins (~14–16). */
  fertilityStart: number;
  /** Age of peak fertility (~20–30). */
  fertilityPeak: number;
  /**
   * Age at which fertility begins declining.
   * ~35 for standard profiles; ~45 for extended (Kethara's Bargain).
   */
  fertilityDeclineStart: number;
  /**
   * Age at which fertility effectively ends.
   * ~42–45 for standard Imanian women; ~52–55 for extended.
   */
  fertilityEnd: number;
}

// ─── Roles & Status ───────────────────────────────────────────────────────────

/**
 * The work role a person is currently assigned to.
 * Determines resource production each turn. Assigned during the Management Phase.
 */
export type WorkRole =
  | 'farmer'
  | 'trader'
  | 'guard'
  | 'craftsman'
  | 'healer'
  | 'unassigned';

/** A person's social standing within the settlement community. */
export type SocialStatus =
  | 'founding_member'
  | 'settler'
  | 'newcomer'
  | 'elder'
  | 'outcast';

// ─── Skills ──────────────────────────────────────────────────────────────────

/** The six base skills every person has. */
export type SkillId = 'animals' | 'bargaining' | 'combat' | 'custom' | 'leadership' | 'plants';

/** Derived skills computed on demand from base skill averages. Never stored on the person. */
export type DerivedSkillId =
  | 'deception'
  | 'diplomacy'
  | 'exploring'
  | 'farming'
  | 'hunting'
  | 'poetry'
  | 'strategy';

/** Named rating tier for a skill score. */
export type SkillRating = 'fair' | 'good' | 'very_good' | 'excellent' | 'renowned' | 'heroic';

/** A person's six base skill scores — integers in the range 1–100. */
export type PersonSkills = Record<SkillId, number>;

/**
 * Maps minimum thresholds to SkillRating labels, checked from highest to lowest.
 * Fair: 1–25 · Good: 26–45 · Very Good: 46–62 · Excellent: 63–77 · Renowned: 78–90 · Heroic: 91–100
 */
export const SKILL_RATING_THRESHOLDS: Array<{ min: number; rating: SkillRating }> = [
  { min: 91, rating: 'heroic' },
  { min: 78, rating: 'renowned' },
  { min: 63, rating: 'excellent' },
  { min: 46, rating: 'very_good' },
  { min: 26, rating: 'good' },
  { min: 1,  rating: 'fair' },
];

/** Returns the named SkillRating tier for a 1–100 skill value. */
export function getSkillRating(value: number): SkillRating {
  for (const { min, rating } of SKILL_RATING_THRESHOLDS) {
    if (value >= min) return rating;
  }
  return 'fair';
}

/**
 * Computes a derived skill value from a person's base skills.
 * Returns a rounded integer.
 */
export function getDerivedSkill(skills: PersonSkills, id: DerivedSkillId): number {
  switch (id) {
    case 'deception':  return Math.round((skills.bargaining + skills.leadership) / 2);
    case 'diplomacy':  return Math.round((skills.bargaining + skills.custom) / 2);
    case 'exploring':  return Math.round((skills.bargaining + skills.combat) / 2);
    case 'farming':    return Math.round((skills.animals + skills.plants) / 2);
    case 'hunting':    return Math.round((skills.animals + skills.combat + skills.plants) / 3);
    case 'poetry':     return Math.round((skills.custom + skills.leadership) / 2);
    case 'strategy':   return Math.round((skills.combat + skills.leadership) / 2);
  }
}

/** Additive bonuses applied to specific base skills based on a person's traits. */
const SKILL_TRAIT_BONUSES: Partial<Record<TraitId, Partial<PersonSkills>>> = {
  brave:           { combat: 15, leadership: 5 },
  cruel:           { combat: 10 },
  strong:          { combat: 15, animals: 10 },
  clever:          { custom: 15, leadership: 12 },
  ambitious:       { leadership: 12 },
  gregarious:      { bargaining: 12 },
  patient:         { plants: 10, animals: 8 },
  deceitful:       { bargaining: 12 },
  greedy:          { bargaining: 10 },
  proud:           { leadership: 8 },
  robust:          { animals: 10, plants: 8 },
  veteran:         { combat: 20 },
  hero:            { combat: 15, leadership: 10 },
  respected_elder: { leadership: 15, custom: 10 },
  traditional:     { custom: 10 },
  cosmopolitan:    { bargaining: 8 },
};

const ALL_SKILL_IDS: SkillId[] = ['animals', 'bargaining', 'combat', 'custom', 'leadership', 'plants'];

/**
 * Generates a seeded, trait-influenced set of base skills for a new person.
 *
 * Each skill starts from a Gaussian roll centred at 28 (low end of Good), std dev 15,
 * clamped to [1, 100]. Trait bonuses are added before the final clamp.
 */
export function generatePersonSkills(traits: TraitId[], rng: SeededRNG): PersonSkills {
  const raw: Record<string, number> = {};
  for (const id of ALL_SKILL_IDS) {
    raw[id] = rng.gaussian(28, 15);
  }

  for (const trait of traits) {
    const bonuses = SKILL_TRAIT_BONUSES[trait];
    if (!bonuses) continue;
    for (const [skillId, bonus] of Object.entries(bonuses) as [SkillId, number][]) {
      raw[skillId] = (raw[skillId] ?? 0) + bonus;
    }
  }

  const result = {} as PersonSkills;
  for (const id of ALL_SKILL_IDS) {
    result[id] = Math.max(1, Math.min(100, Math.round(raw[id])));
  }
  return result;
}

const DEFAULT_SKILLS: PersonSkills = {
  animals: 25, bargaining: 25, combat: 25, custom: 25, leadership: 25, plants: 25,
};

// ─── Person Interface ─────────────────────────────────────────────────────────

/**
 * A living person in the settlement.
 * Every individual is represented by one of these and stored in
 * `GameState.people` keyed by their ID.
 */
export interface Person {
  /** Globally unique identifier. */
  id: string;
  /** Given name (culturally appropriate for the person's primary culture). */
  firstName: string;
  /** Family or clan name. */
  familyName: string;
  /** Optional nickname used in informal contexts and event narrative. */
  nickname?: string;

  /** Biological sex. Determines fertility roles and some event eligibility. */
  sex: 'male' | 'female';
  /**
   * Age in fractional years. Increases by 0.25 each turn (one season = 0.25 years).
   */
  age: number;
  /** Genetic profile — visible traits and heritable biological modifiers. */
  genetics: GeneticProfile;
  /** Fertility profile — age windows for reproduction. */
  fertility: FertilityProfile;
  /** Current health and any active conditions or pregnancy. */
  health: HealthState;

  /**
   * Heritage — biological bloodline and cultural identity.
   * These two axes are tracked independently and can diverge significantly.
   */
  heritage: Heritage;
  /** All languages this person speaks, with fluency levels. */
  languages: LanguageFluency[];
  /** The religious tradition this person practices. */
  religion: ReligionId;
  // NOTE: Cultural identity is accessed via heritage.primaryCulture — there is
  // no standalone culturalIdentity field. heritage.culturalFluency tracks familiarity
  // with multiple cultures; heritage.primaryCulture is the dominant one.

  /**
   * Personality, aptitude, cultural, and earned trait IDs.
   * A person has 2–4 traits. Full definitions live in `src/data/trait-definitions.ts`.
   */
  traits: TraitId[];

  /** IDs of current spouses. Supports polygamy. */
  spouseIds: string[];
  /**
   * IDs of parents as `[motherId, fatherId]`.
   * Null if a parent is unknown or predates the settlement's records.
   */
  parentIds: [string | null, string | null];
  /** IDs of all children this person has had. */
  childrenIds: string[];
  /**
   * Opinion scores (-100 to +100) this person holds toward others they know.
   * Keyed by the other person's ID. Decays toward neutral over time unless reinforced.
   */
  relationships: Map<string, number>;

  /** Current work role in the settlement's economy. */
  role: WorkRole;
  /** Social standing within the community. */
  socialStatus: SocialStatus;
  /** Whether the player currently has this person under direct focus/control. */
  isPlayerControlled: boolean;

  /** Base skill scores (1–100 integers). Use getDerivedSkill() for composite scores. */
  skills: PersonSkills;

  /**
   * Stable portrait variant index (1-indexed). Assigned once at creation and never
   * changed — ensures the same face is shown across all age stages throughout a
   * person's lifetime. Clamped to the available count in PORTRAIT_REGISTRY when
   * the registry grows after a save was made.
   */
  portraitVariant: number;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Options for createPerson(). All fields are optional — unspecified fields
 * receive sensible Imanian defaults. The `id` field is generated automatically
 * if omitted.
 */
export type CreatePersonOptions = Partial<Person>;

// Internal default constants — not exported; use createPerson() to instantiate.

const DEFAULT_IMANIAN_VISIBLE: VisibleTraits = {
  skinTone: 0.2,
  skinUndertone: 'cool_pink',
  hairColor: 'light_brown',
  hairTexture: 'straight',
  eyeColor: 'blue',
  buildType: 'athletic',
  height: 'average',
  facialStructure: 'oval',
};

const DEFAULT_IMANIAN_GENETICS: GeneticProfile = {
  visibleTraits: DEFAULT_IMANIAN_VISIBLE,
  genderRatioModifier: 0.5,
  extendedFertility: false,
};

const DEFAULT_MALE_FERTILITY: FertilityProfile = {
  isExtended: false,
  fertilityStart: 14,
  fertilityPeak: 25,
  fertilityDeclineStart: 50,
  fertilityEnd: 70,
};

const DEFAULT_FEMALE_FERTILITY: FertilityProfile = {
  isExtended: false,
  fertilityStart: 14,
  fertilityPeak: 22,
  fertilityDeclineStart: 35,
  fertilityEnd: 43,
};

/**
 * Creates a new Person with sensible Imanian defaults for any unspecified fields.
 *
 * @param options - Any subset of Person fields to override. Omitted fields
 *   receive defaults appropriate for an adult Imanian male settler.
 * @returns A fully populated Person ready to be added to `GameState.people`.
 *
 * @example
 * ```ts
 * const man = createPerson({ firstName: 'Edmund', familyName: 'Farrow', age: 30 });
 * const woman = createPerson({ firstName: 'Mira', familyName: 'Ashton', sex: 'female', age: 20 });
 * ```
 */
/** Default number of portrait variants per slot at initial art scope. */
const DEFAULT_VARIANT_COUNT = 3;

export function createPerson(options: CreatePersonOptions = {}, rng?: SeededRNG): Person {
  const sex = options.sex ?? 'male';
  const defaultFertility = sex === 'female' ? DEFAULT_FEMALE_FERTILITY : DEFAULT_MALE_FERTILITY;
  const resolvedTraits = options.traits ?? [];
  const resolvedSkills = options.skills ?? (rng ? generatePersonSkills(resolvedTraits, rng) : DEFAULT_SKILLS);
  const resolvedPortraitVariant = options.portraitVariant ?? (rng ? rng.nextInt(1, DEFAULT_VARIANT_COUNT) : 1);

  return {
    id: options.id ?? generateId(),
    firstName: options.firstName ?? '',
    familyName: options.familyName ?? '',
    nickname: options.nickname,

    sex,
    age: options.age ?? 25,
    genetics: options.genetics ?? DEFAULT_IMANIAN_GENETICS,
    fertility: options.fertility ?? defaultFertility,
    health: options.health ?? { currentHealth: 100, conditions: [] },

    heritage: options.heritage ?? {
      bloodline: [{ group: 'imanian', fraction: 1.0 }],
      primaryCulture: 'ansberite',
      culturalFluency: new Map<CultureId, number>([['ansberite', 1.0]]),
    },
    languages: options.languages ?? [{ language: 'imanian', fluency: 1.0 }],
    religion: options.religion ?? 'imanian_orthodox',

    traits: resolvedTraits,

    spouseIds: options.spouseIds ?? [],
    parentIds: options.parentIds ?? [null, null],
    childrenIds: options.childrenIds ?? [],
    relationships: options.relationships ?? new Map<string, number>(),

    role: options.role ?? 'unassigned',
    socialStatus: options.socialStatus ?? 'settler',
    isPlayerControlled: options.isPlayerControlled ?? false,

    skills: resolvedSkills,
    portraitVariant: resolvedPortraitVariant,
  };
}

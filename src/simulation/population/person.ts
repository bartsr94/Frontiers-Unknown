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
 */
export type CultureId =
  | 'imanian_homeland'
  | 'ansberite'
  | 'townborn'
  | 'kiswani_traditional'
  | 'hanjoda_traditional'
  | 'sauro_borderfolk'
  | 'sauro_wildborn'
  | 'settlement_native';

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
  /** The culture this person self-identifies with (may differ from bloodline). */
  culturalIdentity: CultureId;

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
export function createPerson(options: CreatePersonOptions = {}): Person {
  const sex = options.sex ?? 'male';
  const defaultFertility = sex === 'female' ? DEFAULT_FEMALE_FERTILITY : DEFAULT_MALE_FERTILITY;

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
    culturalIdentity: options.culturalIdentity ?? 'ansberite',

    traits: options.traits ?? [],

    spouseIds: options.spouseIds ?? [],
    parentIds: options.parentIds ?? [null, null],
    childrenIds: options.childrenIds ?? [],
    relationships: options.relationships ?? new Map<string, number>(),

    role: options.role ?? 'unassigned',
    socialStatus: options.socialStatus ?? 'settler',
    isPlayerControlled: options.isPlayerControlled ?? false,
  };
}

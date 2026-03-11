/**
 * Genetic trait types and distributions for the Palusteria simulation.
 *
 * Defines visible physical trait types, the data structures for ethnic trait
 * distributions, and the Imanian baseline constant. No dependencies on other
 * simulation modules.
 */

// ─── Visible Trait Type Unions ────────────────────────────────────────────────

/** Skin undertone categories. */
export type Undertone = 'cool_pink' | 'warm_olive' | 'copper' | 'bronze' | 'neutral';

/** Hair color categories. */
export type HairColor =
  | 'blonde'
  | 'light_brown'
  | 'dark_brown'
  | 'black'
  | 'red'
  | 'auburn'
  | 'grey';

/** Hair texture categories. */
export type HairTexture = 'straight' | 'wavy' | 'curly' | 'coily';

/** Eye color categories. */
export type EyeColor = 'brown' | 'grey' | 'blue' | 'amber' | 'green' | 'hazel';

/** Body build categories. */
export type BuildType = 'lean' | 'athletic' | 'stocky' | 'wiry' | 'heavyset';

/** Height classification. */
export type HeightClass = 'short' | 'below_average' | 'average' | 'tall' | 'very_tall';

/** Facial bone structure categories. */
export type FacialStructure = 'narrow' | 'oval' | 'broad' | 'angular' | 'round';

// ─── Distribution Primitives ──────────────────────────────────────────────────

/**
 * Parameters for a Gaussian (normal) distribution.
 * Used for continuous traits such as skin tone.
 */
export interface GaussianDist {
  /** The center of the distribution (0.0–1.0 for skin tone). */
  mean: number;
  /** The spread of the distribution. Larger = more variation across the population. */
  variance: number;
}

/**
 * A discrete probability distribution over a finite set of string values.
 * Weights should sum to 1.0 but are normalised during sampling if they don't.
 */
export interface WeightedDist<T extends string> {
  /** Partial weight map — missing keys are treated as weight 0. */
  weights: Partial<Record<T, number>>;
}

// ─── Visible Traits ─────────────────────────────────────────────────────────

/**
 * The complete set of visible physical traits for a person.
 * These are the traits rendered in portraits and observable during event narration.
 */
export interface VisibleTraits {
  /**
   * Continuous skin tone value.
   * 0.0 = palest Imanian; 1.0 = darkest Kiswani Bayuk.
   */
  skinTone: number;
  /** Skin undertone category. */
  skinUndertone: Undertone;
  /** Hair color. */
  hairColor: HairColor;
  /** Hair texture. */
  hairTexture: HairTexture;
  /** Eye color. */
  eyeColor: EyeColor;
  /** Body build. */
  buildType: BuildType;
  /** Height class. */
  height: HeightClass;
  /** Facial bone structure. */
  facialStructure: FacialStructure;
}

// ─── Genetic Profile ──────────────────────────────────────────────────────────

/**
 * Reserved expansion slot for hidden traits.
 * Not implemented in MVP — will hold disease resistance, magical aptitude,
 * and lifespan modifiers in future phases.
 */
export interface HiddenTraits {
  // Future: diseaseResistance?: number;
  // Future: magicalAptitude?: number;
}

/**
 * The complete genetic profile of a person.
 * Contains visible traits plus heritable mechanical modifiers.
 */
export interface GeneticProfile {
  /** Physically visible heritable traits. */
  visibleTraits: VisibleTraits;
  /**
   * Probability of a male birth for children of this person.
   * Range: 0.0–1.0. Pure Sauromatian mothers: ~0.14. Pure Imanian: ~0.50.
   */
  genderRatioModifier: number;
  /**
   * Whether this person has inherited Kethara's Bargain — extended female
   * fertility into the early fifties. Inherited strictly through the maternal
   * line regardless of the father's heritage.
   */
  extendedFertility: boolean;
  /** Reserved for future expansion. Not read in MVP. */
  hiddenTraits?: HiddenTraits;
}

// ─── Trait Distribution ───────────────────────────────────────────────────────

/**
 * The full trait distribution for an ethnic group.
 * Defines probability distributions for every visible trait — used during
 * genetic inheritance to blend and sample child traits.
 */
export interface TraitDistribution {
  /** Continuous Gaussian distribution for skin tone (0.0–1.0 scale). */
  skinTone: GaussianDist;
  /** Discrete distribution for skin undertone. */
  skinUndertone: WeightedDist<Undertone>;
  /** Discrete distribution for hair color. */
  hairColor: WeightedDist<HairColor>;
  /** Discrete distribution for hair texture. */
  hairTexture: WeightedDist<HairTexture>;
  /** Discrete distribution for eye color. */
  eyeColor: WeightedDist<EyeColor>;
  /** Discrete distribution for body build. */
  buildType: WeightedDist<BuildType>;
  /** Discrete distribution for height class. */
  height: WeightedDist<HeightClass>;
  /** Discrete distribution for facial structure. */
  facialStructure: WeightedDist<FacialStructure>;
}

// ─── Ethnic Distributions ────────────────────────────────────────────────────

/**
 * Trait distribution for ethnic Imanians.
 *
 * Lore: Fair skin, cool-pink or neutral undertone, blonde to dark-brown hair
 * (straight to wavy), blue/grey/green eyes dominant, variable build, average height.
 * Source: PALUSTERIA_GAME_DESIGN.md §5.3
 */
export const IMANIAN_TRAITS: TraitDistribution = {
  skinTone: { mean: 0.2, variance: 0.10 },
  skinUndertone: { weights: { cool_pink: 0.50, neutral: 0.30, warm_olive: 0.20 } },
  hairColor: {
    weights: { blonde: 0.30, light_brown: 0.30, dark_brown: 0.30, red: 0.10 },
  },
  hairTexture: { weights: { straight: 0.50, wavy: 0.40, curly: 0.10 } },
  eyeColor: {
    weights: { blue: 0.30, grey: 0.20, green: 0.20, hazel: 0.15, brown: 0.15 },
  },
  buildType: {
    weights: { lean: 0.30, athletic: 0.30, stocky: 0.20, wiry: 0.20 },
  },
  height: {
    weights: { average: 0.40, below_average: 0.20, tall: 0.20, short: 0.10, very_tall: 0.10 },
  },
  facialStructure: {
    weights: { narrow: 0.30, oval: 0.40, angular: 0.20, round: 0.10 },
  },
};

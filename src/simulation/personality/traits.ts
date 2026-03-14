/**
 * Personality trait type definitions for the Palusteria simulation.
 *
 * Follows the Crusader Kings model: named labels with mechanical effects on
 * behavior, events, and relationships. Traits are assigned at birth (2–4 per
 * person) or earned through life events, and never silently removed — only
 * replaced by specific conflicting trait events.
 *
 * Trait data (names, descriptions, effects, conflicts) lives in
 * `src/data/trait-definitions.ts`. This module defines the shapes only.
 */

// ─── Trait ID Union ──────────────────────────────────────────────────────────

/**
 * All valid personality trait identifiers, grouped by category.
 * The union is flat for use in arrays, Sets, and type guards.
 */
export type TraitId =
  // ── Personality (core character) ─────────────────────────────────────────
  | 'ambitious'
  | 'content'
  | 'gregarious'
  | 'shy'
  | 'brave'
  | 'craven'
  | 'cruel'
  | 'kind'
  | 'greedy'
  | 'generous'
  | 'lustful'
  | 'chaste'
  | 'wrathful'
  | 'patient'
  | 'deceitful'
  | 'honest'
  | 'proud'
  | 'humble'
  // ── Personality (new) ─────────────────────────────────────────────────────
  | 'vengeful'
  | 'forgiving'
  | 'melancholic'
  | 'sanguine'
  | 'zealous'
  | 'cynical'
  | 'curious'
  | 'stubborn'
  | 'charming'
  | 'suspicious'
  | 'trusting'
  | 'reckless'
  | 'envious'
  | 'protective'
  // ── Social / relationship ─────────────────────────────────────────────────
  | 'devoted'
  | 'jealous'
  | 'fickle'
  | 'clingy'
  | 'mentor_hearted'
  | 'contrarian'
  // ── Aptitude (physical and mental capacities) ─────────────────────────────
  | 'strong'
  | 'weak'
  | 'clever'
  | 'slow'
  | 'beautiful'
  | 'plain'
  | 'robust'
  | 'sickly'
  | 'fertile'
  | 'barren'
  // ── Aptitude (new) ───────────────────────────────────────────────────────
  | 'gifted_speaker'
  | 'green_thumb'
  | 'keen_hunter'
  | 'iron_constitution'
  | 'fleet_footed'
  // ── Cultural (relationship to culture and community) ──────────────────────
  | 'traditional'
  | 'cosmopolitan'
  | 'devout'
  | 'skeptical'
  | 'xenophobic'
  | 'welcoming'
  // ── Cultural (new) ───────────────────────────────────────────────────────
  | 'syncretist'
  | 'folklorist'
  | 'linguist'
  | 'honor_bound'
  | 'company_man'
  // ── Earned (gained through life events) ──────────────────────────────────
  | 'veteran'
  | 'scarred'
  | 'respected_elder'
  | 'scandal'
  | 'oath_breaker'
  | 'hero'
  | 'coward'
  | 'wealthy'
  | 'indebted'
  // ── Earned (new) ─────────────────────────────────────────────────────────
  | 'healer'
  | 'midwife'
  | 'storyteller'
  | 'negotiator'
  | 'outcast'
  | 'kinslayer'
  | 'exile'
  | 'ghost_touched'
  | 'blessed_birth'
  | 'bereaved'
  | 'wheel_blessed'
  // ── Mental state (temporary) ─────────────────────────────────────────────
  | 'grieving'
  | 'inspired'
  | 'restless'
  | 'traumatized'
  | 'homesick';

/** The five categories a trait can belong to. */
export type TraitCategory = 'personality' | 'aptitude' | 'cultural' | 'earned' | 'mental_state';

// ─── Trait Effects ────────────────────────────────────────────────────────────

/**
 * The simulation stat a trait effect modifies.
 * Numeric modifiers are additive adjustments (e.g., +0.2 = +20% effectiveness).
 */
export type TraitEffectTarget =
  | 'combat_strength'
  | 'diplomacy'
  | 'trade_skill'
  | 'farming'
  | 'fertility_modifier'
  | 'health_modifier'
  /** Opinion bonus/penalty applied to people who share this exact trait. */
  | 'opinion_same_trait'
  /** Opinion bonus/penalty applied to people who have a conflicting trait. */
  | 'opinion_conflicting_trait'
  /** Resistance to cultural assimilation (positive = harder to assimilate). */
  | 'cultural_resistance'
  /** Speed of adopting new cultural practices (positive = faster adoption). */
  | 'cultural_openness'
  // ── Extended targets ─────────────────────────────────────────────────────
  /** Multiplier on language learning rate (e.g. 1.5 = 50% faster). */
  | 'language_learning_rate'
  /** Bonus added to every skill growth tick from buildings (+N per season). */
  | 'skill_growth_all'
  | 'skill_growth_combat'
  | 'skill_growth_plants'
  | 'skill_growth_bargaining'
  | 'skill_growth_leadership'
  /** Multiplier on personal resource production (e.g. 1.10 = +10%). */
  | 'production_modifier'
  /** Multiplier on per-season disease chance (e.g. 0.3 = −70%). */
  | 'disease_chance_modifier'
  /** Multiplier on natural-death probability (e.g. 0.5 = −50%). */
  | 'mortality_modifier'
  /** Additive boost to domestic event weight pool. */
  | 'event_weight_domestic'
  | 'event_weight_cultural'
  | 'event_weight_religious'
  | 'event_weight_economic'
  /** Flat shift to initial baseline opinions others form of this person. */
  | 'opinion_baseline_from_others'
  /** Multiplier on how fast this person's own opinion entries decay (< 1 = slower). */
  | 'opinion_decay_rate'
  /** Per-turn opinion delta this person gives toward their spouses. */
  | 'opinion_drift_spouse'
  /** Multiplier on ambition intensity growth rate (e.g. 1.6 = faster). */
  | 'ambition_intensity_growth';

/**
 * A single mechanical effect applied by a trait.
 * All modifiers are additive to the base stat value.
 */
export interface TraitEffect {
  /** Which simulation stat this effect modifies. */
  target: TraitEffectTarget;
  /** Magnitude of the modification. Positive = bonus, negative = penalty. */
  modifier: number;
}

// ─── Trait Definition ─────────────────────────────────────────────────────────

/**
 * The full definition of a personality trait.
 * Instances of this interface are the rows in `src/data/trait-definitions.ts`.
 */
export interface TraitDefinition {
  /** Unique string identifier — must match a value in the TraitId union. */
  id: TraitId;
  /** Human-readable display name shown in the UI (e.g., "Brave", "Craven"). */
  name: string;
  /** Which category this trait belongs to. */
  category: TraitCategory;
  /** Short lore-flavoured description shown in the trait tooltip. */
  description: string;
  /**
   * Traits that cannot coexist with this one on the same person.
   * If a person acquires a conflicting trait, the older trait is removed.
   * Example: 'brave' conflicts with 'craven'.
   */
  conflicts: TraitId[];
  /** Mechanical stat effects this trait applies. May be an empty array. */
  effects: TraitEffect[];
  /**
   * For aptitude traits: the probability (0.0–1.0) that a parent passes this
   * trait to a child. Absent for personality, cultural, and earned traits,
   * which are not directly inherited.
   */
  inheritWeight?: number;
  /**
   * If true, this is a temporary mental-state trait. It is paired with a
   * `traitExpiry` entry on Person and removed automatically on that turn.
   * Default: false.
   */
  isTemporary?: boolean;
}

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
  // ── Cultural (relationship to culture and community) ──────────────────────
  | 'traditional'
  | 'cosmopolitan'
  | 'devout'
  | 'skeptical'
  | 'xenophobic'
  | 'welcoming'
  // ── Earned (gained through life events) ──────────────────────────────────
  | 'veteran'
  | 'scarred'
  | 'respected_elder'
  | 'scandal'
  | 'oath_breaker'
  | 'hero'
  | 'coward'
  | 'wealthy'
  | 'indebted';

/** The four categories a trait can belong to. */
export type TraitCategory = 'personality' | 'aptitude' | 'cultural' | 'earned';

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
  | 'cultural_openness';

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
}

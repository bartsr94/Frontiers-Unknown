/**
 * Gender ratio calculation for births in the Palusteria simulation.
 *
 * The Sauromatian gender ratio is the central demographic mechanic of the game.
 * Pure Sauromatian mothers produce ~6 daughters per son (~14% male births).
 * As Imanian blood enters the maternal line the ratio shifts toward equal (50%).
 * The father's Imanian fraction adds a modest upward shift.
 *
 * Source: CLAUDE.md Gender Ratio Mechanics, PALUSTERIA_GAME_DESIGN.md §5.5
 */

import type { Person, BloodlineEntry } from '../population/person';
import { lerp, clamp } from '../../utils/math';
import type { SeededRNG } from '../../utils/rng';

// ─── Bloodline Fraction Helpers ───────────────────────────────────────────────

/**
 * Returns the total Sauromatian fraction of a bloodline.
 *
 * All ethnic groups except 'imanian' are considered Sauromatian (Kiswani and
 * Hanjoda sub-groups). Returns a value in [0, 1].
 *
 * @param bloodline - The bloodline entries to inspect.
 */
export function getSauromatianFraction(bloodline: BloodlineEntry[]): number {
  return bloodline
    .filter(entry => entry.group !== 'imanian')
    .reduce((sum, entry) => sum + entry.fraction, 0);
}

/**
 * Returns the total Imanian fraction of a bloodline.
 *
 * Returns a value in [0, 1]. Complement of getSauromatianFraction for pure
 * two-group lineages; may be less than `1 - sauromatianFraction` in theory
 * (future expansion groups), so computed independently.
 *
 * @param bloodline - The bloodline entries to inspect.
 */
export function getImanianFraction(bloodline: BloodlineEntry[]): number {
  return bloodline
    .filter(entry => entry.group === 'imanian')
    .reduce((sum, entry) => sum + entry.fraction, 0);
}

// ─── Gender Ratio Resolution ──────────────────────────────────────────────────

/**
 * Calculates the probability of a male birth for a given couple.
 *
 * Formula:
 *   maternalBase = lerp(0.50, 0.14, sauromatianFraction of mother)
 *   paternalShift = imanianFraction of father × 0.20
 *   result = clamp(maternalBase + paternalShift, 0.10, 0.50)
 *
 * Examples:
 *   Pure Sauromatian mother × any father → base ~0.14
 *   Pure Imanian × Pure Imanian → 0.50 + 0.20 = clamped → 0.50
 *   50/50 mother × Imanian father → ~0.32 + 0.10 = ~0.42
 *
 * @param mother - The mother person.
 * @param father - The father person.
 * @returns Probability of male birth in [0.10, 0.50].
 */
export function resolveGenderRatio(mother: Person, father: Person): number {
  const maternalBase = lerp(0.50, 0.14, getSauromatianFraction(mother.heritage.bloodline));
  const paternalShift = getImanianFraction(father.heritage.bloodline) * 0.20;
  return clamp(maternalBase + paternalShift, 0.10, 0.50);
}

// ─── Sex Determination ────────────────────────────────────────────────────────

/**
 * Determines the biological sex of a newborn by rolling against the gender ratio.
 *
 * @param genderRatioModifier - Probability of a male birth (0.0–1.0).
 *   Typically derived from resolveGenderRatio() stored on the GeneticProfile.
 * @param rng - The seeded PRNG for this birth event.
 * @returns 'male' if roll < modifier, otherwise 'female'.
 */
export function determineSex(
  genderRatioModifier: number,
  rng: SeededRNG,
): 'male' | 'female' {
  return rng.next() < genderRatioModifier ? 'male' : 'female';
}

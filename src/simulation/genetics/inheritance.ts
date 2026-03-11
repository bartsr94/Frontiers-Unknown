/**
 * Genetic inheritance engine for the Palusteria simulation.
 *
 * Implements the full pipeline for resolving a child's genetic profile from two
 * parents: bloodline averaging → distribution blending → visible trait sampling.
 *
 * Algorithm:
 *   1. Average both parents' bloodlines → child's bloodline fractions
 *   2. Blend ethnic trait distributions weighted by those fractions
 *   3. Sample each visible trait from the blended distribution, biased 30%
 *      toward the actual parent values
 *   4. Determine gender ratio modifier from the couple
 *   5. Inherit extended fertility strictly through maternal line
 *
 * Source: PALUSTERIA_ARCHITECTURE.md §5.1, CLAUDE.md Inheritance Algorithm
 * No React / DOM / store imports — pure simulation logic.
 */

import type {
  GeneticProfile,
  VisibleTraits,
  TraitDistribution,
  GaussianDist,
  WeightedDist,
  Undertone,
  HairColor,
  HairTexture,
  EyeColor,
  BuildType,
  HeightClass,
  FacialStructure,
} from './traits';
import type { Person, BloodlineEntry, EthnicGroup } from '../population/person';
import type { SeededRNG } from '../../utils/rng';
import { clamp } from '../../utils/math';
import { ETHNIC_DISTRIBUTIONS } from '../../data/ethnic-distributions';
import { resolveGenderRatio } from './gender-ratio';

// ─── Bloodline Averaging ──────────────────────────────────────────────────────

/**
 * Merges two parent bloodlines into a child bloodline.
 *
 * For each ethnic group present in either parent, the child's fraction is the
 * average of both parents' fractions (parent with no entry contributes 0).
 * The result is re-normalised so all fractions sum exactly to 1.0.
 *
 * @param motherBloodline - Mother's bloodline entries.
 * @param fatherBloodline - Father's bloodline entries.
 * @returns A new bloodline array with summed fractions normalised to 1.0.
 *
 * @example
 * ```ts
 * // Pure Imanian + Pure Kiswani Riverfolk → 50/50 child
 * averageBloodlines(
 *   [{ group: 'imanian', fraction: 1.0 }],
 *   [{ group: 'kiswani_riverfolk', fraction: 1.0 }]
 * );
 * // → [{ group: 'imanian', fraction: 0.5 }, { group: 'kiswani_riverfolk', fraction: 0.5 }]
 * ```
 */
export function averageBloodlines(
  motherBloodline: BloodlineEntry[],
  fatherBloodline: BloodlineEntry[],
): BloodlineEntry[] {
  const fractions = new Map<EthnicGroup, number>();

  for (const entry of motherBloodline) {
    fractions.set(entry.group, (fractions.get(entry.group) ?? 0) + entry.fraction * 0.5);
  }
  for (const entry of fatherBloodline) {
    fractions.set(entry.group, (fractions.get(entry.group) ?? 0) + entry.fraction * 0.5);
  }

  // Build result array and normalise (guard against floating-point drift)
  const entries: BloodlineEntry[] = [];
  let total = 0;
  for (const [group, fraction] of fractions) {
    if (fraction > 0) {
      entries.push({ group, fraction });
      total += fraction;
    }
  }

  if (total <= 0) return entries;
  if (Math.abs(total - 1.0) > 1e-9) {
    for (const entry of entries) {
      entry.fraction /= total;
    }
  }

  return entries;
}

// ─── Distribution Blending ────────────────────────────────────────────────────

/** Blends two GaussianDist values by a weight in [0, 1] applied to `a`. */
function blendGaussian(a: GaussianDist, b: GaussianDist, weightA: number): GaussianDist {
  const weightB = 1 - weightA;
  return {
    mean: a.mean * weightA + b.mean * weightB,
    variance: a.variance * weightA + b.variance * weightB,
  };
}

/** Blends two WeightedDist<T> by a weight in [0, 1] applied to `a`. */
function blendWeighted<T extends string>(
  a: WeightedDist<T>,
  b: WeightedDist<T>,
  weightA: number,
): WeightedDist<T> {
  const weightB = 1 - weightA;
  const allKeys = new Set<T>([
    ...(Object.keys(a.weights) as T[]),
    ...(Object.keys(b.weights) as T[]),
  ]);
  const merged: Partial<Record<T, number>> = {};
  for (const key of allKeys) {
    const wa = (a.weights[key] ?? 0) * weightA;
    const wb = (b.weights[key] ?? 0) * weightB;
    merged[key] = wa + wb;
  }
  return { weights: merged };
}

/**
 * Builds a blended TraitDistribution from a child's bloodline.
 *
 * Each ethnic group in the bloodline contributes its distribution weighted by
 * the group's bloodline fraction. Groups with no entry in ETHNIC_DISTRIBUTIONS
 * are silently skipped (should never occur with current EthnicGroup types).
 *
 * For GaussianDist (skin tone): blended mean and variance are weighted averages.
 * For WeightedDist (all discrete traits): blended weights are weighted averages,
 * producing a valid (approximately normalised) probability table.
 *
 * @param bloodline - The child's computed bloodline array.
 * @returns A TraitDistribution representing the child's blended ethnic baseline.
 */
export function blendTraitDistributions(bloodline: BloodlineEntry[]): TraitDistribution {
  // Seed with an empty distribution; fold each bloodline entry in
  let blended: TraitDistribution | null = null;
  let accumulatedWeight = 0;

  for (const entry of bloodline) {
    const dist = ETHNIC_DISTRIBUTIONS[entry.group];
    if (!dist) continue;

    if (blended === null) {
      // First entry: start with this distribution at full weight
      blended = structuralCopy(dist);
      accumulatedWeight = entry.fraction;
    } else {
      // Blend the new distribution into the accumulated one
      const totalWeight = accumulatedWeight + entry.fraction;
      const existingWeight = accumulatedWeight / totalWeight;
      blended = {
        skinTone: blendGaussian(blended.skinTone, dist.skinTone, existingWeight),
        skinUndertone: blendWeighted(blended.skinUndertone, dist.skinUndertone, existingWeight),
        hairColor: blendWeighted(blended.hairColor, dist.hairColor, existingWeight),
        hairTexture: blendWeighted(blended.hairTexture, dist.hairTexture, existingWeight),
        eyeColor: blendWeighted(blended.eyeColor, dist.eyeColor, existingWeight),
        buildType: blendWeighted(blended.buildType, dist.buildType, existingWeight),
        height: blendWeighted(blended.height, dist.height, existingWeight),
        facialStructure: blendWeighted(blended.facialStructure, dist.facialStructure, existingWeight),
      };
      accumulatedWeight = totalWeight;
    }
  }

  // If bloodline was empty, fall back to a flat 50% distribution for each trait
  return blended ?? ETHNIC_DISTRIBUTIONS['imanian'];
}

/** Creates a shallow structural copy of a TraitDistribution (avoids mutating originals). */
function structuralCopy(dist: TraitDistribution): TraitDistribution {
  return {
    skinTone: { ...dist.skinTone },
    skinUndertone: { weights: { ...dist.skinUndertone.weights } },
    hairColor: { weights: { ...dist.hairColor.weights } },
    hairTexture: { weights: { ...dist.hairTexture.weights } },
    eyeColor: { weights: { ...dist.eyeColor.weights } },
    buildType: { weights: { ...dist.buildType.weights } },
    height: { weights: { ...dist.height.weights } },
    facialStructure: { weights: { ...dist.facialStructure.weights } },
  };
}

// ─── Trait Sampling ───────────────────────────────────────────────────────────

/**
 * Samples a continuous trait (skin tone) with 70/30 blend of ethnic mean and
 * parent average.
 *
 * finalMean     = blendedMean × 0.7 + parentAvg × 0.3
 * finalVariance = blendedVariance × 0.5  (children are tighter than the population)
 * result        = clamp(gaussian(finalMean, sqrt(finalVariance)), 0, 1)
 *
 * @param blendedMean - Mean from the blended ethnic distribution.
 * @param blendedVariance - Variance from the blended ethnic distribution.
 * @param motherValue - Mother's actual trait value.
 * @param fatherValue - Father's actual trait value.
 * @param rng - Seeded PRNG.
 */
export function sampleContinuous(
  blendedMean: number,
  blendedVariance: number,
  motherValue: number,
  fatherValue: number,
  rng: SeededRNG,
): number {
  const parentAvg = (motherValue + fatherValue) / 2;
  const finalMean = blendedMean * 0.7 + parentAvg * 0.3;
  const finalVariance = blendedVariance * 0.5;
  return clamp(rng.gaussian(finalMean, Math.sqrt(finalVariance)), 0, 1);
}

/**
 * Samples a discrete trait (eye color, hair color, etc.) from a blended weight
 * table boosted toward both parents' actual values.
 *
 * Each parent's actual value gets +0.15 added to its weight in the table, then
 * the table is renormalised before sampling.
 *
 * @param blendedWeights - Base weighted distribution from ethnic blending.
 * @param motherValue - Mother's actual discrete trait value.
 * @param fatherValue - Father's actual discrete trait value.
 * @param rng - Seeded PRNG.
 */
export function sampleDiscrete<T extends string>(
  blendedWeights: WeightedDist<T>,
  motherValue: T,
  fatherValue: T,
  rng: SeededRNG,
): T {
  const adjusted: Partial<Record<T, number>> = { ...blendedWeights.weights };

  const parentBoost = 0.15;
  adjusted[motherValue] = (adjusted[motherValue] ?? 0) + parentBoost;
  adjusted[fatherValue] = (adjusted[fatherValue] ?? 0) + parentBoost;

  // Renormalise
  let total = 0;
  for (const v of Object.values(adjusted)) {
    total += (v as number);
  }
  if (total > 0) {
    for (const key of Object.keys(adjusted) as T[]) {
      const w = adjusted[key];
      if (w !== undefined) {
        adjusted[key] = w / total;
      }
    }
  }

  return rng.weightedPick(adjusted);
}

// ─── Visible Trait Assembly ───────────────────────────────────────────────────

/**
 * Assembles a complete VisibleTraits by sampling each trait from the blended
 * distribution, biased toward the parents' actual values.
 *
 * @param blended - The blended TraitDistribution for this child's bloodline.
 * @param motherTraits - Mother's actual visible traits.
 * @param fatherTraits - Father's actual visible traits.
 * @param rng - Seeded PRNG.
 */
export function sampleVisibleTraits(
  blended: TraitDistribution,
  motherTraits: VisibleTraits,
  fatherTraits: VisibleTraits,
  rng: SeededRNG,
): VisibleTraits {
  return {
    skinTone: sampleContinuous(
      blended.skinTone.mean,
      blended.skinTone.variance,
      motherTraits.skinTone,
      fatherTraits.skinTone,
      rng,
    ),
    skinUndertone: sampleDiscrete<Undertone>(
      blended.skinUndertone,
      motherTraits.skinUndertone,
      fatherTraits.skinUndertone,
      rng,
    ),
    hairColor: sampleDiscrete<HairColor>(
      blended.hairColor,
      motherTraits.hairColor,
      fatherTraits.hairColor,
      rng,
    ),
    hairTexture: sampleDiscrete<HairTexture>(
      blended.hairTexture,
      motherTraits.hairTexture,
      fatherTraits.hairTexture,
      rng,
    ),
    eyeColor: sampleDiscrete<EyeColor>(
      blended.eyeColor,
      motherTraits.eyeColor,
      fatherTraits.eyeColor,
      rng,
    ),
    buildType: sampleDiscrete<BuildType>(
      blended.buildType,
      motherTraits.buildType,
      fatherTraits.buildType,
      rng,
    ),
    height: sampleDiscrete<HeightClass>(
      blended.height,
      motherTraits.height,
      fatherTraits.height,
      rng,
    ),
    facialStructure: sampleDiscrete<FacialStructure>(
      blended.facialStructure,
      motherTraits.facialStructure,
      fatherTraits.facialStructure,
      rng,
    ),
  };
}

// ─── Top-Level Resolver ───────────────────────────────────────────────────────

/**
 * Resolves the complete GeneticProfile for a child born to the given parents.
 *
 * Pipeline:
 *   1. Average bloodlines → child's bloodline fractions
 *   2. Blend ethnic trait distributions by bloodline fractions
 *   3. Sample all visible traits (70% ethnic distribution, 30% parent bias)
 *   4. Gender ratio modifier from resolveGenderRatio(mother, father)
 *   5. extendedFertility inherited strictly from mother (Kethara's Bargain)
 *
 * The returned GeneticProfile should be stored on the child Person. The child's
 * bloodline (from step 1) must be stored separately on Heritage.
 *
 * @param mother - The mother person.
 * @param father - The father person.
 * @param rng - Seeded PRNG for this birth event.
 * @returns A fully resolved GeneticProfile for the child.
 */
export function resolveInheritance(
  mother: Person,
  father: Person,
  rng: SeededRNG,
): GeneticProfile {
  const childBloodline = averageBloodlines(
    mother.heritage.bloodline,
    father.heritage.bloodline,
  );

  const blendedDist = blendTraitDistributions(childBloodline);

  const visibleTraits = sampleVisibleTraits(
    blendedDist,
    mother.genetics.visibleTraits,
    father.genetics.visibleTraits,
    rng,
  );

  const genderRatioModifier = resolveGenderRatio(mother, father);

  // Extended fertility (Kethara's Bargain) is always maternal — the father's
  // heritage is irrelevant.
  const extendedFertility = mother.genetics.extendedFertility;

  return { visibleTraits, genderRatioModifier, extendedFertility };
}

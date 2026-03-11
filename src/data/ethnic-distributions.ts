/**
 * Ethnic trait distribution constants for all eight ethnic groups.
 *
 * Each constant is of type TraitDistribution and defines probability
 * distributions for every visible physical trait. These are the authoritative
 * data values used by the genetics inheritance engine to blend and sample child
 * traits.
 *
 * Source: PALUSTERIA_GAME_DESIGN.md §5.3 + CLAUDE.md ethnic group reference
 * No logic — pure data constants.
 */

import type { TraitDistribution } from '../simulation/genetics/traits';
import { IMANIAN_TRAITS } from '../simulation/genetics/traits';
import type { EthnicGroup } from '../simulation/population/person';

// ─── Kiswani Groups ───────────────────────────────────────────────────────────

/**
 * Kiswani Riverfolk trait distribution.
 *
 * Lore: Dark copper skin (0.65), copper undertone dominant, black hair (wavy–curly),
 * the most genetically diverse Kiswani group with the widest eye colour variety,
 * athletic build, tall stature.
 */
export const KISWANI_RIVERFOLK_TRAITS: TraitDistribution = {
  skinTone: { mean: 0.65, variance: 0.08 },
  skinUndertone: { weights: { copper: 0.70, bronze: 0.20, warm_olive: 0.10 } },
  hairColor: { weights: { black: 0.80, dark_brown: 0.20 } },
  hairTexture: { weights: { wavy: 0.40, curly: 0.50, coily: 0.10 } },
  eyeColor: {
    weights: { brown: 0.30, grey: 0.20, green: 0.15, hazel: 0.15, blue: 0.10, amber: 0.10 },
  },
  buildType: { weights: { athletic: 0.50, lean: 0.20, stocky: 0.20, heavyset: 0.10 } },
  height: { weights: { tall: 0.40, average: 0.30, very_tall: 0.20, below_average: 0.10 } },
  facialStructure: { weights: { broad: 0.40, oval: 0.30, round: 0.20, narrow: 0.10 } },
};

/**
 * Kiswani Bayuk trait distribution.
 *
 * Lore: Dark skin (0.80), bronze undertone, black hair often dyed red (base colour black),
 * curly–coily texture. Distinguished by rare grey eyes — a contrast with other Kiswani groups.
 * Compact/short build — shorter than other Kiswani.
 */
export const KISWANI_BAYUK_TRAITS: TraitDistribution = {
  skinTone: { mean: 0.80, variance: 0.06 },
  skinUndertone: { weights: { bronze: 0.50, copper: 0.30, neutral: 0.20 } },
  hairColor: { weights: { black: 0.90, dark_brown: 0.10 } },
  hairTexture: { weights: { curly: 0.40, coily: 0.40, wavy: 0.20 } },
  eyeColor: { weights: { grey: 0.60, brown: 0.20, green: 0.10, hazel: 0.10 } },
  buildType: { weights: { athletic: 0.30, stocky: 0.30, lean: 0.20, wiry: 0.20 } },
  height: { weights: { short: 0.40, below_average: 0.30, average: 0.20, tall: 0.10 } },
  facialStructure: { weights: { broad: 0.40, round: 0.30, oval: 0.20, angular: 0.10 } },
};

/**
 * Kiswani Haisla trait distribution.
 *
 * Lore: Darkly tanned maritime people (0.70), warm undertone, black hair worn in
 * dreadlocks, grey–blue eyes, lean-muscular build from seafaring life, average height.
 */
export const KISWANI_HAISLA_TRAITS: TraitDistribution = {
  skinTone: { mean: 0.70, variance: 0.07 },
  skinUndertone: { weights: { warm_olive: 0.40, bronze: 0.30, copper: 0.30 } },
  hairColor: { weights: { black: 0.85, dark_brown: 0.15 } },
  hairTexture: { weights: { curly: 0.40, coily: 0.30, wavy: 0.30 } },
  eyeColor: { weights: { grey: 0.40, blue: 0.30, brown: 0.20, green: 0.10 } },
  buildType: { weights: { lean: 0.40, athletic: 0.40, wiry: 0.20 } },
  height: { weights: { average: 0.40, tall: 0.30, below_average: 0.20, very_tall: 0.10 } },
  facialStructure: { weights: { angular: 0.30, narrow: 0.30, oval: 0.30, broad: 0.10 } },
};

// ─── Hanjoda Groups ───────────────────────────────────────────────────────────

/**
 * Hanjoda Stormcaller trait distribution.
 *
 * Lore: Notably light skin for Sauromatians (0.35) — lore suggests non-Sauromatian
 * ancestry. Blonde hair common (unusual among Sauromatians), straight–wavy texture,
 * grey/blue eyes. Wiry/gaunt bodies, remarkably tall stature.
 * They paint themselves with blue body dye.
 */
export const HANJODA_STORMCALLER_TRAITS: TraitDistribution = {
  skinTone: { mean: 0.35, variance: 0.10 },
  skinUndertone: { weights: { cool_pink: 0.40, neutral: 0.40, copper: 0.20 } },
  hairColor: { weights: { blonde: 0.50, light_brown: 0.30, dark_brown: 0.20 } },
  hairTexture: { weights: { straight: 0.40, wavy: 0.50, curly: 0.10 } },
  eyeColor: { weights: { grey: 0.40, blue: 0.30, green: 0.20, hazel: 0.10 } },
  buildType: { weights: { wiry: 0.50, lean: 0.30, athletic: 0.20 } },
  height: { weights: { very_tall: 0.30, tall: 0.40, average: 0.20, below_average: 0.10 } },
  facialStructure: { weights: { narrow: 0.40, angular: 0.30, oval: 0.20, broad: 0.10 } },
};

/**
 * Hanjoda Bloodmoon trait distribution.
 *
 * Lore: Medium-dark skin (0.60) often masked by red ochre dye, warm undertone,
 * dark hair. Athletic/lean build, average to tall height. Brown/dark eyes dominant.
 */
export const HANJODA_BLOODMOON_TRAITS: TraitDistribution = {
  skinTone: { mean: 0.60, variance: 0.08 },
  skinUndertone: { weights: { warm_olive: 0.40, copper: 0.30, bronze: 0.30 } },
  hairColor: { weights: { black: 0.60, dark_brown: 0.30, auburn: 0.10 } },
  hairTexture: { weights: { wavy: 0.40, curly: 0.30, straight: 0.30 } },
  eyeColor: { weights: { brown: 0.50, amber: 0.20, grey: 0.15, green: 0.15 } },
  buildType: { weights: { athletic: 0.50, lean: 0.30, wiry: 0.20 } },
  height: { weights: { tall: 0.30, average: 0.30, very_tall: 0.20, below_average: 0.20 } },
  facialStructure: { weights: { angular: 0.40, broad: 0.30, oval: 0.20, narrow: 0.10 } },
};

/**
 * Hanjoda Talon trait distribution.
 *
 * Lore: Distinctive charcoal-grey skin (0.75), neutral undertone, black hair.
 * MOST DISTINCTIVE MARKER: amber/yellow eyes — lore suggests non-Sauromatian ancestry.
 * Never dilute this in distributions. Athletic build with characteristically wide hips
 * in women, average height.
 */
export const HANJODA_TALON_TRAITS: TraitDistribution = {
  skinTone: { mean: 0.75, variance: 0.06 },
  skinUndertone: { weights: { neutral: 0.50, bronze: 0.30, copper: 0.20 } },
  hairColor: { weights: { black: 0.90, dark_brown: 0.10 } },
  hairTexture: { weights: { curly: 0.40, coily: 0.30, wavy: 0.30 } },
  eyeColor: { weights: { amber: 0.60, brown: 0.20, green: 0.10, grey: 0.10 } },
  buildType: { weights: { athletic: 0.60, stocky: 0.20, lean: 0.20 } },
  height: { weights: { average: 0.30, tall: 0.30, below_average: 0.20, short: 0.20 } },
  facialStructure: { weights: { broad: 0.40, round: 0.30, oval: 0.20, angular: 0.10 } },
};

/**
 * Hanjoda Emrasi trait distribution.
 *
 * Lore: High variance skin tone (0.50, high variance) — light tan to deep bronze.
 * Warm undertone. Variable hair and eyes. Medium athletic build from maritime work,
 * average height. The most phenotypically diverse Hanjoda group.
 */
export const HANJODA_EMRASI_TRAITS: TraitDistribution = {
  skinTone: { mean: 0.50, variance: 0.12 },
  skinUndertone: { weights: { warm_olive: 0.40, copper: 0.30, bronze: 0.20, neutral: 0.10 } },
  hairColor: {
    weights: { black: 0.50, dark_brown: 0.30, light_brown: 0.10, auburn: 0.10 },
  },
  hairTexture: { weights: { wavy: 0.40, straight: 0.30, curly: 0.30 } },
  eyeColor: {
    weights: { brown: 0.30, grey: 0.25, blue: 0.20, green: 0.15, hazel: 0.10 },
  },
  buildType: { weights: { athletic: 0.40, lean: 0.30, stocky: 0.20, wiry: 0.10 } },
  height: { weights: { average: 0.40, tall: 0.30, below_average: 0.20, very_tall: 0.10 } },
  facialStructure: { weights: { oval: 0.40, broad: 0.30, round: 0.20, narrow: 0.10 } },
};

// ─── Lookup Map ───────────────────────────────────────────────────────────────

/**
 * Single lookup map from ethnic group to its trait distribution.
 * Used by the inheritance engine to blend distributions by bloodline fraction.
 *
 * @example
 * ```ts
 * const dist = ETHNIC_DISTRIBUTIONS['kiswani_riverfolk'];
 * ```
 */
export const ETHNIC_DISTRIBUTIONS: Record<EthnicGroup, TraitDistribution> = {
  imanian: IMANIAN_TRAITS,
  kiswani_riverfolk: KISWANI_RIVERFOLK_TRAITS,
  kiswani_bayuk: KISWANI_BAYUK_TRAITS,
  kiswani_haisla: KISWANI_HAISLA_TRAITS,
  hanjoda_stormcaller: HANJODA_STORMCALLER_TRAITS,
  hanjoda_bloodmoon: HANJODA_BLOODMOON_TRAITS,
  hanjoda_talon: HANJODA_TALON_TRAITS,
  hanjoda_emrasi: HANJODA_EMRASI_TRAITS,
};

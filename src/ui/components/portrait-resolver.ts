/**
 * Portrait asset resolver — maps a Person to a portrait image path based on
 * portrait category, sex, age stage, and stable variant index.
 *
 * File layout:
 *   public/portraits/{sex}/{category}/{category}_{sex_abbr}_{stage}_{nnn}.png
 *
 * Examples:
 *   public/portraits/male/imanian/imanian_m_adult_001.png
 *   public/portraits/female/kiswani/kiswani_f_young_adult_002.png
 *   public/portraits/male/mixed_imanian_kiswani/mixed_imanian_kiswani_m_child_003.png
 *
 * To add more portraits:
 *   1. Drop the PNG into the correct folder under public/portraits/.
 *   2. Increment the relevant count in PORTRAIT_REGISTRY.
 *   No other code changes required.
 */

import type { Person, EthnicGroup } from '../../simulation/population/person';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Broad visual category used to select a portrait pool. */
export type PortraitCategory =
  | 'imanian'
  | 'kiswani'
  | 'hanjoda'
  | 'mixed_imanian_kiswani'
  | 'mixed_imanian_hanjoda'
  | 'mixed_kiswani_hanjoda';

/** Life stage used to select the correct age iteration of a character portrait. */
export type AgeStage = 'child' | 'young_adult' | 'adult' | 'senior';

// ─── Age Stage ────────────────────────────────────────────────────────────────

/**
 * Returns the AgeStage for a given age in (fractional) years.
 *
 *   child        0 – 13
 *   young_adult  14 – 29
 *   adult        30 – 54
 *   senior       55+
 */
export function getAgeStage(age: number): AgeStage {
  if (age < 14) return 'child';
  if (age < 30) return 'young_adult';
  if (age < 55) return 'adult';
  return 'senior';
}

// ─── Portrait Registry ────────────────────────────────────────────────────────

type StageCounts = Record<AgeStage, number>;
type SexCounts   = Record<'male' | 'female', StageCounts>;

/**
 * PORTRAIT_REGISTRY — single source of truth for which portrait assets exist.
 *
 * Each value is the number of variant files available for that slot.
 *   0 → no art yet; resolver falls back to another stage or returns null.
 *   N → variants _001 through _00N are available.
 *
 * To expand a pool: drop the new PNG in the folder and increment the count.
 * Stage fallback order (when the exact stage has 0 portraits):
 *   adult → young_adult → senior → child
 * So a single `adult` portrait covers all ages until stage-specific ones exist.
 */
const PORTRAIT_REGISTRY: Record<PortraitCategory, SexCounts> = {
  imanian: {
    male:   { child: 0, young_adult: 3, adult: 3, senior: 3 },
    female: { child: 0, young_adult: 0, adult: 1, senior: 0 },
  },
  kiswani: {
    male:   { child: 0, young_adult: 0, adult: 0, senior: 0 },
    female: { child: 0, young_adult: 1, adult: 1, senior: 1 },
  },
  hanjoda: {
    male:   { child: 0, young_adult: 0, adult: 0, senior: 0 },
    female: { child: 0, young_adult: 0, adult: 1, senior: 0 },
  },
  mixed_imanian_kiswani: {
    male:   { child: 0, young_adult: 0, adult: 0, senior: 0 },
    female: { child: 0, young_adult: 0, adult: 0, senior: 0 },
  },
  mixed_imanian_hanjoda: {
    male:   { child: 0, young_adult: 0, adult: 0, senior: 0 },
    female: { child: 0, young_adult: 0, adult: 0, senior: 0 },
  },
  mixed_kiswani_hanjoda: {
    male:   { child: 0, young_adult: 0, adult: 0, senior: 0 },
    female: { child: 0, young_adult: 0, adult: 0, senior: 0 },
  },
};

// ─── Category Resolution ──────────────────────────────────────────────────────

const KISWANI_GROUPS = new Set<EthnicGroup>([
  'kiswani_riverfolk', 'kiswani_bayuk', 'kiswani_haisla',
]);

const HANJODA_GROUPS = new Set<EthnicGroup>([
  'hanjoda_stormcaller', 'hanjoda_bloodmoon', 'hanjoda_talon', 'hanjoda_emrasi',
]);

/**
 * Resolves the PortraitCategory for a Person from their bloodline fractions.
 *
 * Logic:
 *   1. Sum fractions into three macro-groups: imanian / kiswani / hanjoda.
 *   2. If any single macro-group ≥ 75% → that group's pure category.
 *   3. If imanian + kiswani ≥ 80% with neither dominant → mixed_imanian_kiswani.
 *   4. If imanian + hanjoda ≥ 80% with neither dominant → mixed_imanian_hanjoda.
 *   5. If kiswani + hanjoda ≥ 80% with neither dominant → mixed_kiswani_hanjoda.
 *   6. Otherwise → null (SVG fallback).
 */
export function getPortraitCategory(person: Person): PortraitCategory | null {
  let imanian = 0;
  let kiswani = 0;
  let hanjoda = 0;

  for (const entry of person.heritage.bloodline) {
    if (entry.group === 'imanian')              imanian += entry.fraction;
    else if (KISWANI_GROUPS.has(entry.group))   kiswani += entry.fraction;
    else if (HANJODA_GROUPS.has(entry.group))   hanjoda += entry.fraction;
  }

  if (imanian >= 0.75) return 'imanian';
  if (kiswani >= 0.75) return 'kiswani';
  if (hanjoda >= 0.75) return 'hanjoda';
  if (imanian + kiswani >= 0.80) return 'mixed_imanian_kiswani';
  if (imanian + hanjoda >= 0.80) return 'mixed_imanian_hanjoda';
  if (kiswani + hanjoda >= 0.80) return 'mixed_kiswani_hanjoda';

  return null;
}

// ─── Main Resolver ────────────────────────────────────────────────────────────

/**
 * Fallback order when the person's exact age stage has no portraits yet.
 * `adult` is tried first because it is the most broadly useful and will be
 * the first stage generated for each new category.
 */
const STAGE_FALLBACK_ORDER: AgeStage[] = ['adult', 'young_adult', 'senior', 'child'];

/**
 * Resolves a portrait image path for the given person.
 *
 * Tries the person's exact age stage first. If that slot has no portraits yet,
 * falls back through STAGE_FALLBACK_ORDER until one is found. This means a
 * single `adult` portrait covers all life stages until stage-specific art exists.
 *
 * Uses person.portraitVariant (stable, assigned at birth) to select a consistent
 * face. Clamps to the available count so old saves degrade gracefully when new
 * variants are added.
 *
 * @returns A `/portraits/…` URL string for use in an `<img src>`, or `null`
 *          when no art exists for this category/sex at all (SVG fallback).
 */
export function resolvePortraitSrc(person: Person): string | null {
  const category = getPortraitCategory(person);
  if (!category) return null;

  const sex        = person.sex;
  const exactStage = getAgeStage(person.age);
  const stageCounts = PORTRAIT_REGISTRY[category][sex];

  // Try the exact stage, then fall back to the priority order.
  const stageToUse: AgeStage | undefined =
    stageCounts[exactStage] > 0
      ? exactStage
      : STAGE_FALLBACK_ORDER.find(s => stageCounts[s] > 0);

  if (!stageToUse) return null; // no portraits at all for this category/sex yet

  const count      = stageCounts[stageToUse];
  // Clamp handles saves created before more variants were added to the registry
  const variant    = Math.min(person.portraitVariant, count);
  const variantStr = String(variant).padStart(3, '0');
  const sexAbbr    = sex === 'male' ? 'm' : 'f';

  return `/portraits/${sex}/${category}/${category}_${sexAbbr}_${stageToUse}_${variantStr}.png`;
}

/**
 * Cultural identity system — derivation, drift, and settlement-level aggregates.
 *
 * This module is the single source of truth for:
 *   • All CultureId display labels
 *   • Which CultureIds are "Sauromatian" for the purposes of culturalBlend
 *   • Deriving a child's Heritage from their parents (blended fluency)
 *   • Passive per-turn cultural drift as people absorb community culture
 *   • Settlement-level cultural statistics (blend, religion distribution)
 *
 * Architecture rules:
 *   • No React / DOM imports — pure TypeScript simulation logic.
 *   • No Math.random() — all randomness via the SeededRNG parameter.
 *   • Pure functions only — inputs are not mutated; callers own state updates.
 */

import type { Person, CultureId, BloodlineEntry, Heritage } from './person';
import type { ReligionId } from './person';
import type { SeededRNG } from '../../utils/rng';
import type { CulturePullModifier } from '../buildings/building-effects';

// ─── Culture Labels ───────────────────────────────────────────────────────────

/**
 * Human-readable display labels for every CultureId.
 * Imported by UI components so there is one canonical source of culture names.
 */
export const CULTURE_LABELS: Record<CultureId, string> = {
  // Imanian origin
  imanian_homeland:    'Imanian Homeland',
  ansberite:           'Ansberite',
  townborn:            'Townborn',
  // Settlement-born emergent identity
  settlement_native:   'Settlement Native',
  // Sauromatian — broad (pan-tribal / blended)
  kiswani_traditional: 'Kiswani Traditional',
  hanjoda_traditional: 'Hanjoda Traditional',
  // Kiswani sub-groups
  kiswani_riverfolk:   'Kiswani (Riverfolk)',
  kiswani_bayuk:       'Kiswani (Bayuk)',
  kiswani_haisla:      'Kiswani (Haisla)',
  // Hanjoda sub-groups
  hanjoda_stormcaller: 'Hanjoda (Stormcaller)',
  hanjoda_bloodmoon:   'Hanjoda (Bloodmoon)',
  hanjoda_talon:       'Hanjoda (Talon)',
  hanjoda_emrasi:      'Hanjoda (Emrasi)',
  // Borderland / mixed-origin identities
  sauro_borderfolk:    'Sauro Borderfolk',
  sauro_wildborn:      'Sauro Wildborn',
};

// ─── Sauromatian Culture Set ──────────────────────────────────────────────────

/**
 * All CultureIds that are considered "Sauromatian" for the purposes of
 * calculating `SettlementCulture.culturalBlend`.
 *
 * Used by marriage.ts to determine which marriage tradition applies,
 * and by the settlement culture sync to compute the blend ratio.
 */
export const SAUROMATIAN_CULTURE_IDS: ReadonlySet<CultureId> = new Set([
  'kiswani_traditional',
  'hanjoda_traditional',
  'kiswani_riverfolk',
  'kiswani_bayuk',
  'kiswani_haisla',
  'hanjoda_stormcaller',
  'hanjoda_bloodmoon',
  'hanjoda_talon',
  'hanjoda_emrasi',
  'sauro_borderfolk',
  'sauro_wildborn',
]);

// ─── Drift Constants ──────────────────────────────────────────────────────────

/**
 * Per-season passive drift rate toward community culture fractions.
 * At ~0.025/season (0.1/year), meaningful cultural shift takes roughly
 * a generation — matching the game's intended pace.
 */
const DRIFT_RATE = 0.025;

/**
 * Per-season spouse bonus toward a spouse's primary culture.
 * Household intimacy accelerates cultural exchange compared with
 * the general community pull.
 */
const SPOUSE_RATE = 0.01;

/**
 * Minimum fluency floor for any culture already present in a person's Map.
 * Prevents complete erasure of native roots — memory and habit persist.
 */
const FLUENCY_FLOOR = 0.01;

/**
 * Community fraction threshold above which a culture is introduced into
 * a person's fluency map for the first time. Avoids polluting fluency maps
 * with traces of cultures that barely exist in the settlement.
 */
const EXPOSURE_THRESHOLD = 0.05;

// ─── Child Culture Derivation ─────────────────────────────────────────────────

/**
 * Derives the Heritage for a newly born child from both biological parents.
 *
 * Algorithm:
 *   1. Blend both parents' `culturalFluency` Maps at 50/50 weight.
 *   2. Add a `settlement_native` seed of 0.05 to reflect that birth itself
 *      creates a connection to the settlement.
 *   3. `primaryCulture` = the highest-scoring culture in the blended Map.
 *      If no culture reaches 0.5 fluency, default to `settlement_native` —
 *      meaning the child has no strong inherited cultural anchor.
 *
 * @param mother - The biological mother.
 * @param father - The biological father (may equal mother for edge-case tests).
 * @param childBloodline - Pre-computed bloodline entries for the child
 *   (calculated upstream by the inheritance/fertility systems).
 * @returns A fully formed Heritage for the child.
 */
export function deriveCulture(
  mother: Person,
  father: Person,
  childBloodline: BloodlineEntry[],
): Heritage {
  const blended = new Map<CultureId, number>();

  // Collect all culture keys present in either parent's fluency map.
  const allCultures = new Set<CultureId>([
    ...mother.heritage.culturalFluency.keys(),
    ...father.heritage.culturalFluency.keys(),
  ]);

  for (const cid of allCultures) {
    const mVal = mother.heritage.culturalFluency.get(cid) ?? 0;
    const fVal = father.heritage.culturalFluency.get(cid) ?? 0;
    const blendedVal = (mVal + fVal) / 2;
    if (blendedVal > 0) {
      blended.set(cid, blendedVal);
    }
  }

  // Seed the settlement_native fluency — birth in the settlement always
  // grants a small initial connection to the local emerging identity.
  const existingNative = blended.get('settlement_native') ?? 0;
  blended.set('settlement_native', Math.min(1.0, existingNative + 0.05));

  // Find the highest-scoring culture.
  let primaryCulture: CultureId = 'settlement_native';
  let highest = -1;
  for (const [cid, val] of blended) {
    if (val > highest) {
      highest = val;
      primaryCulture = cid;
    }
  }

  // If no culture scored ≥ 0.5, the child has no strong inherited anchor.
  // settlement_native becomes the primary — they are creatures of this place.
  if (highest < 0.5) {
    primaryCulture = 'settlement_native';
  }

  return {
    bloodline: childBloodline,
    primaryCulture,
    culturalFluency: blended,
  };
}

// ─── Settlement Distribution ──────────────────────────────────────────────────

/**
 * Computes the fraction of the living population whose `primaryCulture`
 * is each culture. Values sum to 1.0 across the returned Map.
 *
 * @param people - All living people in the settlement.
 * @returns A Map from CultureId to fraction (0.0–1.0).
 */
export function buildSettlementCultureDistribution(
  people: Map<string, Person>,
): Map<CultureId, number> {
  const total = people.size;
  if (total === 0) return new Map();

  const counts = new Map<CultureId, number>();
  for (const person of people.values()) {
    const c = person.heritage.primaryCulture;
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }

  const fractions = new Map<CultureId, number>();
  for (const [c, count] of counts) {
    fractions.set(c, count / total);
  }
  return fractions;
}

/**
 * Computes the `culturalBlend` stat: the fraction of the population whose
 * `primaryCulture` is in `SAUROMATIAN_CULTURE_IDS`.
 *
 * 0.0 = fully Imanian / settlement-born; 1.0 = fully Sauromatian.
 *
 * @param people - All living people in the settlement.
 * @returns Blend value in [0.0, 1.0].
 */
export function computeCulturalBlend(people: Map<string, Person>): number {
  if (people.size === 0) return 0;
  let sauromatianCount = 0;
  for (const person of people.values()) {
    if (SAUROMATIAN_CULTURE_IDS.has(person.heritage.primaryCulture)) {
      sauromatianCount++;
    }
  }
  return sauromatianCount / people.size;
}

/**
 * Computes the fraction of the living population practising each religion.
 * Values sum to 1.0 across the returned Map.
 *
 * @param people - All living people in the settlement.
 * @returns A Map from ReligionId to fraction (0.0–1.0).
 */
export function computeReligionDistribution(
  people: Map<string, Person>,
): Map<ReligionId, number> {
  const total = people.size;
  if (total === 0) return new Map();

  const counts = new Map<ReligionId, number>();
  for (const person of people.values()) {
    counts.set(person.religion, (counts.get(person.religion) ?? 0) + 1);
  }

  const fractions = new Map<ReligionId, number>();
  for (const [r, count] of counts) {
    fractions.set(r, count / total);
  }
  return fractions;
}

// ─── Per-Turn Cultural Drift ──────────────────────────────────────────────────

/**
 * Processes passive cultural drift for all living people in the settlement.
 *
 * Each person's cultural fluency shifts slowly toward the community's
 * cultural distribution, plus a small bonus from their spouse(s).
 *
 * Mechanics:
 *   Community pull:  Δ = DRIFT_RATE × (communityFraction − currentFluency)
 *   Spouse bonus:    +SPOUSE_RATE toward each living spouse's primaryCulture
 *   Floor:           All existing entries are clamped to ≥ FLUENCY_FLOOR
 *   Exposure seed:   Communities with fraction > EXPOSURE_THRESHOLD introduce
 *                    a new minimum entry in fluency maps lacking that culture
 *
 * After all adjustments, `primaryCulture` is recomputed as the highest entry.
 * Cultures are never removed from the fluency map once seeded — the floor
 * ensures old roots always leave a trace.
 *
 * @param people - All living people (not mutated).
 * @param _rng - Reserved for future stochastic noise; currently deterministic.
 * @returns A new Map with updated Person records.
 */
export function processCulturalDrift(
  people: Map<string, Person>,
  _rng: SeededRNG,
  buildingCulturePull: CulturePullModifier[] = [],
): Map<string, Person> {
  const communityDist = buildSettlementCultureDistribution(people);
  const result = new Map<string, Person>();

  for (const [id, person] of people) {
    // Work on a copy of the fluency map.
    const fluency = new Map(person.heritage.culturalFluency);

    // ── Community pull ────────────────────────────────────────────────────
    // Shift each existing fluency entry toward the community fraction.
    for (const [cid, currentVal] of fluency) {
      const target = communityDist.get(cid) ?? 0;
      const newVal = currentVal + DRIFT_RATE * (target - currentVal);
      fluency.set(cid, Math.max(FLUENCY_FLOOR, newVal));
    }

    // ── Exposure seed ─────────────────────────────────────────────────────
    // Introduce a minimum-floor entry for prominent community cultures the
    // person hasn't encountered before.
    for (const [cid, fraction] of communityDist) {
      if (!fluency.has(cid) && fraction > EXPOSURE_THRESHOLD) {
        fluency.set(cid, FLUENCY_FLOOR);
      }
    }

    // ── Spouse bonus ──────────────────────────────────────────────────────
    for (const spouseId of person.spouseIds) {
      const spouse = people.get(spouseId);
      if (!spouse) continue;
      const spouseCulture = spouse.heritage.primaryCulture;
      const current = fluency.get(spouseCulture) ?? FLUENCY_FLOOR;
      fluency.set(spouseCulture, Math.min(1.0, current + SPOUSE_RATE));
    }

    // ── Building culture pull ─────────────────────────────────────────────
    // Each building with a cultural style nudges everyone slightly toward
    // that culture's baseline CultureId each season.
    for (const pull of buildingCulturePull) {
      const targetCulture: CultureId =
        pull.direction === 'imanian' ? 'ansberite' : 'settlement_native';
      const current = fluency.get(targetCulture) ?? FLUENCY_FLOOR;
      fluency.set(targetCulture, Math.min(1.0, current + pull.strength));
    }

    // ── Recompute primaryCulture ──────────────────────────────────────────
    let bestCulture: CultureId = person.heritage.primaryCulture;
    let bestFluency = -1;
    for (const [cid, val] of fluency) {
      if (val > bestFluency) {
        bestFluency = val;
        bestCulture = cid;
      }
    }

    result.set(id, {
      ...person,
      heritage: {
        ...person.heritage,
        culturalFluency: fluency,
        primaryCulture: bestCulture,
      },
    });
  }

  return result;
}

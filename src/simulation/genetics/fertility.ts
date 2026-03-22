/**
 * Fertility and pregnancy system for the Palusteria simulation.
 *
 * Handles:
 *   - Fertility profile creation (standard Imanian vs. Kethara's Bargain)
 *   - Per-season fertility chance calculation
 *   - Conception attempts
 *   - Pregnancy resolution (birth events, childbirth risk, child creation)
 *
 * processPregnancies() is a pure function — it returns BirthResult records
 * describing what happened, but never mutates the people Map directly. The
 * caller (turn processor / game store) is responsible for applying births, clearing
 * pregnancy states, and recording deaths.
 *
 * Source: PALUSTERIA_ARCHITECTURE.md §4.5, CLAUDE.md Phase 2 deliverables
 * No React / DOM / store imports — pure simulation logic.
 */

import type { Person, FertilityProfile, PregnancyState } from '../population/person';
import { createPerson } from '../population/person';
import type { Season } from '../turn/game-state';
import type { SeededRNG } from '../../utils/rng';
import { clamp } from '../../utils/math';
import { resolveInheritance, averageBloodlines, inheritAptitudeTraits } from './inheritance';
import { determineSex } from './gender-ratio';
import { deriveCulture } from '../population/culture';
import { resolveChildLanguages } from '../culture/language-acquisition';

// ─── Result Types ─────────────────────────────────────────────────────────────

/**
 * The outcome of resolving a single birth event.
 *
 * The caller should:
 *   1. Add `child` to `GameState.people` and link it to parents.
 *   2. If `motherDied`, move the mother to `GameState.graveyard` and remove from `people`.
 *   3. Apply `motherHealthDelta` to the mother's `health.currentHealth` (if she survived).
 *   4. Clear `mother.health.pregnancy` after processing.
 */
export interface BirthResult {
  /** The ID of the mother that just gave birth. */
  motherId: string;
  /** The newly born Person (not yet in GameState.people — caller must add). */
  child: Person;
  /** Whether the mother died during childbirth. */
  motherDied: boolean;
  /**
   * Health delta to apply to the mother (always negative).
   * Ignored if motherDied is true.
   */
  motherHealthDelta: number;
}

// ─── Fertility Profile Factory ────────────────────────────────────────────────

/**
 * Creates a FertilityProfile for a newborn based on whether Kethara's Bargain
 * was inherited.
 *
 * Extended (Kethara's Bargain — inherited from maternal line):
 *   fertilityStart: 15, peak: 22, declineStart: 45, end: 54
 *
 * Standard (pure Imanian maternal line):
 *   fertilityStart: 15, peak: 22, declineStart: 35, end: 44
 *
 * For male children, the isExtended flag is still stored (for downstream
 * genealogy queries), but fertility windows are wider and decline later.
 * The conception system only queries female fertility.
 *
 * @param isExtended - Whether Kethara's Bargain applies (from mother.genetics.extendedFertility).
 */
export function createFertilityProfile(isExtended: boolean): FertilityProfile {
  if (isExtended) {
    return {
      isExtended: true,
      fertilityStart: 15,
      fertilityPeak: 22,
      fertilityDeclineStart: 45,
      fertilityEnd: 54,
    };
  }
  return {
    isExtended: false,
    fertilityStart: 15,
    fertilityPeak: 22,
    fertilityDeclineStart: 35,
    fertilityEnd: 44,
  };
}

// ─── Fertility Chance ─────────────────────────────────────────────────────────

/**
 * Calculates the probability of conception per season for a given woman.
 *
 * Returns 0 immediately if:
 *   - The person is not female
 *   - The person is already pregnant
 *   - The person is outside their fertility window
 *
 * Fertility curve (piecewise linear):
 *   [0, fertilityStart)         → 0%
 *   [fertilityStart, peak)      → linear ramp 0% → 25%
 *   [peak, declineStart]        → flat 25%
 *   (declineStart, fertilityEnd] → linear ramp 25% → 0%
 *   > fertilityEnd              → 0%
 *
 * Modifiers (applied after curve):
 *   - Summer: +0.05 (peak courtship season per lore)
 *   - 'ill', 'malnourished', or 'frail' condition: each halves the chance
 *   - 'fertile' trait: ×1.3
 *   - 'barren' trait: chance = 0 (overrides everything)
 *
 * Max base chance is 0.25/season (≈ realistic seasonal probability).
 * Max achievable with summer + fertile: 0.30 × 1.3 ≈ 0.39.
 *
 * @param woman - The woman to evaluate.
 * @param season - The current game season.
 * @param householdMemberCount - Optional total member count of the woman's household.
 *   Larger households reduce fertility (natural spacing effect).
 * @returns Probability of conception this season (0.0–~0.40).
 */
export function getFertilityChance(woman: Person, season: Season, householdMemberCount?: number): number {
  if (woman.sex !== 'female') return 0;
  if (woman.health.pregnancy) return 0;

  const { fertilityStart, fertilityPeak, fertilityDeclineStart, fertilityEnd } = woman.fertility;
  const age = woman.age;

  if (age < fertilityStart || age >= fertilityEnd) return 0;

  let base: number;
  if (age < fertilityPeak) {
    // Ramp up from 0 to 0.25
    base = ((age - fertilityStart) / (fertilityPeak - fertilityStart)) * 0.25;
  } else if (age <= fertilityDeclineStart) {
    // Peak plateau
    base = 0.25;
  } else {
    // Ramp down from 0.25 to 0
    base = ((fertilityEnd - age) / (fertilityEnd - fertilityDeclineStart)) * 0.25;
  }

  // Season modifier
  if (season === 'summer') {
    base += 0.05;
  }

  // Trait modifiers — check before health conditions so 'barren' short-circuits cleanly
  if (woman.traits.includes('barren')) {
    return 0;
  }
  if (woman.traits.includes('fertile')) {
    base *= 1.3;
  }

  // Health condition penalties — each penalty halves the remaining chance
  const penaltyConditions = ['ill', 'malnourished', 'frail'] as const;
  for (const condition of penaltyConditions) {
    if (woman.health.conditions.includes(condition)) {
      base *= 0.5;
    }
  }

  // Household crowding penalty — large households naturally space births
  if (householdMemberCount !== undefined) {
    let crowdingMult = 1.0;
    if      (householdMemberCount >= 25) crowdingMult = 0.35;
    else if (householdMemberCount >= 17) crowdingMult = 0.50;
    else if (householdMemberCount >= 11) crowdingMult = 0.65;
    else if (householdMemberCount >=  6) crowdingMult = 0.80;
    base *= crowdingMult;
  }

  return clamp(base, 0, 0.40);
}

// ─── Conception Attempt ───────────────────────────────────────────────────────

/**
 * Attempts conception between a woman and a man for the current turn/season.
 *
 * Returns a PregnancyState if conception occurs (dueDate = currentTurn + 3,
 * approximately one pregnancy = three seasons), otherwise returns null.
 *
 * Preconditions (caller must verify):
 *   - woman.sex === 'female'
 *   - man.sex === 'male'
 *   - They are married (spouseIds contain each other)
 *
 * @param woman - The potential mother.
 * @param man - The potential father.
 * @param currentTurn - The current turn number.
 * @param season - The current season.
 * @param rng - Seeded PRNG for this turn.
 * @returns A PregnancyState if conception occurred, or null.
 */
export function attemptConception(
  woman: Person,
  man: Person,
  currentTurn: number,
  season: Season,
  rng: SeededRNG,
  buildingFertilityBonus = 0,
  householdMemberCount?: number,
): PregnancyState | null {
  const baseChance = getFertilityChance(woman, season, householdMemberCount);
  if (baseChance <= 0) return null;

  const chance = Math.min(baseChance + buildingFertilityBonus, 0.65);

  if (rng.next() < chance) {
    return {
      fatherId: man.id,
      conceptionTurn: currentTurn,
      dueDate: currentTurn + 3,
    };
  }

  return null;
}

// ─── Pregnancy Resolution ─────────────────────────────────────────────────────

/**
 * Resolves all due pregnancies in the settlement for the current turn.
 *
 * For each pregnant woman whose due date has been reached:
 *   1. Looks up the father in the people map (falls back to mother as stand-in
 *      only in the edge case where the father has died since conception).
 *   2. Calls resolveInheritance() to generate the child's GeneticProfile.
 *   3. Calls determineSex() using the child's genderRatioModifier.
 *   4. Calculates childbirth risk for the mother.
 *   5. Creates the child Person.
 *   6. Returns a BirthResult for each birth.
 *
 * Childbirth risk formula:
 *   base = 5% + max(0, floor((motherAge - 30) / 10)) × 2%
 *   doubled if mother has 'sickly' trait
 *   (Medicine as a settlement resource is applied by the caller if desired)
 *
 * Pure function — does NOT mutate the people Map. See BirthResult JSDoc for
 * how the caller should apply results.
 *
 * @param people - All living people (read-only traversal; father lookup only).
 * @param currentTurn - The current turn number.
 * @param rng - Seeded PRNG for this turn.
 * @param languageDiversityTurns - Current count of bilingual turns from GameState.
 *   When this reaches 20+, newborns also hear settlement_creole from birth.
 * @returns An array of BirthResult records, one per resolved pregnancy.
 */
export function processPregnancies(
  people: Map<string, Person>,
  currentTurn: number,
  rng: SeededRNG,
  languageDiversityTurns = 0,
): BirthResult[] {
  const results: BirthResult[] = [];

  for (const mother of people.values()) {
    if (mother.sex !== 'female') continue;
    if (!mother.health.pregnancy) continue;
    if (mother.health.pregnancy.dueDate > currentTurn) continue;

    const { fatherId } = mother.health.pregnancy;
    const father = people.get(fatherId) ?? mother; // fallback if father died

    // --- Resolve child genetics ---
    const childGenetics = resolveInheritance(mother, father, rng);
    const sex = determineSex(childGenetics.genderRatioModifier, rng);

    // --- Child heritage ---
    const childBloodline = averageBloodlines(
      mother.heritage.bloodline,
      father.heritage.bloodline,
      rng,
    );

    // --- Childbirth risk ---
    const decadesOver30 = Math.max(0, Math.floor((mother.age - 30) / 10));
    let birthRisk = 0.05 + decadesOver30 * 0.02;
    if (mother.traits.includes('sickly' as string & typeof mother.traits[number])) {
      birthRisk *= 2;
    }
    birthRisk = clamp(birthRisk, 0, 0.5);

    const motherDied = rng.next() < birthRisk;
    const motherHealthDelta = -10;

    // --- Create child ---
    // Once the settlement has been bilingual for 20+ turns (~5 years), children
    // born into it are exposed to the emerging creole from their first breath.
    const childLanguages = resolveChildLanguages(mother, father);
    if (languageDiversityTurns >= 20) {
      const alreadyHasCreole = childLanguages.some(l => l.language === 'settlement_creole');
      if (!alreadyHasCreole) {
        childLanguages.push({ language: 'settlement_creole', fluency: 0.10 });
      }
    }

    // Assign a stable portrait variant (1–3) randomly at birth. We consume one
    // RNG call here rather than passing rng into createPerson, so newborns keep
    // default skills (they can't work yet) and the RNG stream stays predictable.
    const portraitVariant = rng.nextInt(1, 3);
    const aptitudeTraits = inheritAptitudeTraits(mother, father, rng);

    const child = createPerson({
      sex,
      age: 0,
      genetics: childGenetics,
      fertility: createFertilityProfile(sex === 'female' ? childGenetics.extendedFertility : false),
      heritage: deriveCulture(mother, father, childBloodline),
      languages: childLanguages,
      religion: mother.religion,
      parentIds: [mother.id, father === mother ? null : father.id],
      socialStatus: 'settler',
      isPlayerControlled: false,
      portraitVariant,
      traits: aptitudeTraits.length > 0 ? aptitudeTraits : undefined,
      role: 'child',
    });

    results.push({ motherId: mother.id, child, motherDied, motherHealthDelta });
  }

  return results;
}

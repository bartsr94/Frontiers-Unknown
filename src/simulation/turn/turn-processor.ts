/**
 * Turn processor — the master turn loop for the Palusteria simulation.
 *
 * All functions here are **pure**: they receive state and return new values
 * without mutating their inputs. The Zustand store owns all state mutations.
 *
 * Phase 2 scope: age people, processPregnancies (births + naming), natural death,
 *   child mortality, calculate production/consumption.
 *
 * Turn phases (as defined in architecture §5.3):
 *   DAWN   → age people, resolve pregnancies, health/mortality, production
 *   EVENT  → UI presents events for player resolution (not handled here)
 *   MGMT   → player makes choices (role assignment, marriage, trade, diplomacy)
 *   DUSK   → seasonal effects, quota check (autumn), tribe updates
 */

import type { GameState, Season, ResourceStock, GraveyardEntry } from './game-state';
import type { Person } from '../population/person';
import type { SeededRNG } from '../../utils/rng';
import { clamp } from '../../utils/math';
import {
  calculateProduction,
  calculateConsumption,
} from '../economy/resources';
import { processPregnancies, attemptConception } from '../genetics/fertility';
import { generateName } from '../population/naming';

// ─── Result Types ─────────────────────────────────────────────────────────────

/**
 * A lightweight record of a birth that occurred this dawn, returned for UI
 * notification and event-history logging.
 */
export interface BirthNotification {
  /** ID of the newly born person (already present in DawnResult.updatedPeople). */
  childId: string;
  childFirstName: string;
  childFamilyName: string;
  /** ID of the mother. */
  motherId: string;
  /** Whether the mother survived childbirth. */
  motherSurvived: boolean;
}

/** Data returned by processDawn(). The store merges these into GameState. */
export interface DawnResult {
  /**
   * Cloned people Map with all Dawn operations applied:
   *   - Ages incremented by 0.25
   *   - Newborns added (with names)
   *   - Deceased people removed
   */
  updatedPeople: Map<string, Person>;
  /** Resource production delta for the season (positive values). */
  production: ResourceStock;
  /** Resource consumption delta for the season (negative food). */
  consumption: ResourceStock;
  /** Updated living population count (matches updatedPeople.size). */
  populationCount: number;
  /** Birth notifications for UI display and event-history logging. */
  births: BirthNotification[];
  /**
   * Graveyard entries for people who died this dawn.
   * The store appends these to GameState.graveyard.
   */
  newGraveyardEntries: GraveyardEntry[];
}

/** Data returned by processDusk(). The store applies these to GameState. */
export interface DuskResult {
  /** The season that follows the current one. */
  nextSeason: Season;
  /**
   * The in-game year after season advancement.
   * Increments by 1 when winter transitions to spring.
   */
  nextYear: number;
}

// ─── Mortality Helpers ─────────────────────────────────────────────────────────

/**
 * Calculates the probability of a person dying from natural causes this season.
 *
 * Age brackets (per-season probability):
 *   < 60   → 0%
 *   60–69  → (age − 60) × 0.002 per season    (0%–2%)
 *   70–79  → 0.02 + (age − 70) × 0.004        (2%–6%)
 *   80+    → 0.06 + (age − 80) × 0.008        (6%+, uncapped via clamp)
 *
 * Trait modifiers:
 *   'robust'  → × 0.5 (hardier constitution)
 *   'sickly'  → × 2.0 (reduced resilience)
 *
 * @param person - The person to evaluate.
 * @returns Probability of natural death this season (clamped to [0, 0.95]).
 */
function calculateNaturalDeathChance(person: Person): number {
  const age = person.age;
  let chance: number;

  if (age < 60) {
    chance = 0;
  } else if (age < 70) {
    chance = (age - 60) * 0.002;
  } else if (age < 80) {
    chance = 0.02 + (age - 70) * 0.004;
  } else {
    chance = 0.06 + (age - 80) * 0.008;
  }

  if (person.traits.includes('robust')) chance *= 0.5;
  if (person.traits.includes('sickly')) chance *= 2.0;

  return clamp(chance, 0, 0.95);
}

/**
 * Calculates the probability of a child under 5 dying from illness this season.
 *
 * Pre-industrial child mortality is harsh and historically accurate — it creates
 * the demographic pressure the lore describes. This is intentional design.
 *
 * Base probability: 3% per season for children under 5.
 * Medicine stock reduces this (each unit reduces by 0.003, capped at 50% reduction).
 *
 * Trait modifiers:
 *   'sickly' → × 1.5
 *   'robust' → × 0.5
 *
 * @param person - The child to evaluate.
 * @param medicineStock - Current medicine resource in the settlement.
 * @returns Probability of child mortality this season (clamped to [0, 0.30]).
 */
function calculateChildMortalityChance(person: Person, medicineStock: number): number {
  if (person.age >= 5) return 0;

  let chance = 0.03;

  // Medicine reduces risk, capped at 50% reduction
  const medicineReduction = clamp(medicineStock * 0.003, 0, 0.015);
  chance -= medicineReduction;

  if (person.traits.includes('sickly')) chance *= 1.5;
  if (person.traits.includes('robust')) chance *= 0.5;

  return clamp(chance, 0, 0.30);
}

/**
 * Builds a lightweight GraveyardEntry from a Person who has just died.
 *
 * @param person - The deceased person.
 * @param deathYear - The current in-game year.
 * @param cause - Human-readable cause of death.
 * @returns A GraveyardEntry suitable for appending to GameState.graveyard.
 */
function toGraveyardEntry(person: Person, deathYear: number, cause: string): GraveyardEntry {
  // Approximate birth year from age (fractional years → round to nearest year)
  const birthYear = Math.round(deathYear - person.age);
  return {
    id: person.id,
    firstName: person.firstName,
    familyName: person.familyName,
    sex: person.sex,
    birthYear,
    deathYear,
    deathCause: cause,
    parentIds: person.parentIds,
    childrenIds: [...person.childrenIds],
    heritage: person.heritage,
  };
}

// ─── Dawn Phase ───────────────────────────────────────────────────────────────

/**
 * Processes the Dawn Phase of a turn.
 *
 * Operations (in order):
 *   1. Age all people by 0.25 years (one season).
 *   2. Resolve due pregnancies → births + potential maternal deaths.
 *      Newborns receive a culturally appropriate name from generateName().
 *   3. Process natural death (age-based probability, modified by traits).
 *   4. Process child mortality (under-5, reduced by medicine stock).
 *   5. Calculate resource production for surviving people.
 *   6. Calculate resource consumption for surviving people.
 *
 * @param state - Current game state (not mutated).
 * @param rng - Seeded RNG instance for this turn.
 * @returns A DawnResult with updated people, resource deltas, birth notifications,
 *   and graveyard entries to apply.
 */
export function processDawn(state: GameState, rng: SeededRNG): DawnResult {
  const newGraveyardEntries: GraveyardEntry[] = [];
  const births: BirthNotification[] = [];

  // 1. Clone people Map and age each person by one season (0.25 years).
  const updatedPeople = new Map<string, Person>();
  for (const [id, person] of state.people) {
    updatedPeople.set(id, { ...person, age: person.age + 0.25 });
  }

  // 2. Resolve due pregnancies.
  const birthResults = processPregnancies(updatedPeople, state.turnNumber, rng);

  for (const result of birthResults) {
    const mother = updatedPeople.get(result.motherId);
    if (!mother) continue; // Defensive — should never happen in practice.

    const father = mother.health.pregnancy?.fatherId
      ? updatedPeople.get(mother.health.pregnancy.fatherId)
      : undefined;

    // Generate a culturally appropriate name for the child.
    const { firstName, familyName } = generateName(
      result.child.sex,
      result.child.heritage.primaryCulture,
      mother.familyName,
      father?.familyName ?? '',
      rng,
    );

    const namedChild: Person = { ...result.child, firstName, familyName };

    // Add newborn to map.
    updatedPeople.set(namedChild.id, namedChild);

    // Update mother: clear pregnancy, apply health delta, add child.
    if (result.motherDied) {
      newGraveyardEntries.push(toGraveyardEntry(mother, state.currentYear, 'childbirth'));
      updatedPeople.delete(mother.id);
    } else {
      const updatedMother: Person = {
        ...mother,
        health: {
          ...mother.health,
          pregnancy: undefined,
          currentHealth: Math.max(0, mother.health.currentHealth + result.motherHealthDelta),
        },
        childrenIds: [...mother.childrenIds, namedChild.id],
      };
      updatedPeople.set(mother.id, updatedMother);
    }

    // Update father's childrenIds if he is still alive.
    if (father) {
      const updatedFather: Person = {
        ...father,
        childrenIds: [...father.childrenIds, namedChild.id],
      };
      updatedPeople.set(father.id, updatedFather);
    }

    births.push({
      childId: namedChild.id,
      childFirstName: namedChild.firstName,
      childFamilyName: namedChild.familyName,
      motherId: result.motherId,
      motherSurvived: !result.motherDied,
    });
  }

  // 2b. Attempt conception for all married women who are not already pregnant.
  for (const woman of Array.from(updatedPeople.values())) {
    if (woman.sex !== 'female' || woman.health.pregnancy) continue;

    for (const spouseId of woman.spouseIds) {
      const man = updatedPeople.get(spouseId);
      if (!man || man.sex !== 'male') continue;

      const pregnancy = attemptConception(woman, man, state.turnNumber, state.currentSeason, rng);
      if (pregnancy) {
        updatedPeople.set(woman.id, {
          ...woman,
          health: { ...woman.health, pregnancy },
        });
        break; // one conception attempt per woman per season
      }
    }
  }

  // 3. Process natural deaths (age-based).
  for (const person of Array.from(updatedPeople.values())) {
    const deathChance = calculateNaturalDeathChance(person);
    if (deathChance > 0 && rng.next() < deathChance) {
      newGraveyardEntries.push(toGraveyardEntry(person, state.currentYear, 'old_age'));
      updatedPeople.delete(person.id);
    }
  }

  // 4. Process child mortality (under-5).
  const medicineStock = state.settlement.resources.medicine;
  for (const person of Array.from(updatedPeople.values())) {
    if (person.age >= 5) continue;
    const deathChance = calculateChildMortalityChance(person, medicineStock);
    if (deathChance > 0 && rng.next() < deathChance) {
      newGraveyardEntries.push(toGraveyardEntry(person, state.currentYear, 'childhood_illness'));
      updatedPeople.delete(person.id);
    }
  }

  // 5 & 6. Calculate production and consumption using the surviving population.
  const production = calculateProduction(updatedPeople, state.settlement, state.currentSeason);
  const consumption = calculateConsumption(updatedPeople);

  return {
    updatedPeople,
    production,
    consumption,
    populationCount: updatedPeople.size,
    births,
    newGraveyardEntries,
  };
}

// ─── Dusk Phase ───────────────────────────────────────────────────────────────

/** The ordered sequence of seasons for cycling. */
const SEASON_CYCLE: Season[] = ['spring', 'summer', 'autumn', 'winter'];

/**
 * Processes the Dusk Phase of a turn.
 *
 * Computes the next season and increments the year when winter transitions
 * to spring. In Phase 1 this is purely calendar advancement; Phase 3 will
 * add seasonal effects, Company quota checks, and tribe updates.
 *
 * @param state - Current game state (not mutated).
 * @param _season - Explicit season parameter (mirrors state.currentSeason — kept
 *   for the function signature the store calls, matching architecture §5.3).
 * @returns A DuskResult with the next season and year.
 */
export function processDusk(state: GameState, _season: Season): DuskResult {
  const currentIndex = SEASON_CYCLE.indexOf(state.currentSeason);
  const nextIndex = (currentIndex + 1) % SEASON_CYCLE.length;
  const nextSeason: Season = SEASON_CYCLE[nextIndex] ?? 'spring';

  // Year advances when rolling over from winter to spring.
  const nextYear = nextSeason === 'spring' ? state.currentYear + 1 : state.currentYear;

  return { nextSeason, nextYear };
}

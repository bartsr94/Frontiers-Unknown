/**
 * Turn processor — the master turn loop for the Palusteria simulation.
 *
 * All functions here are **pure**: they receive state and return new values
 * without mutating their inputs. The Zustand store owns all state mutations.
 *
 * Phase 1 scope: age people, calculate production/consumption.
 * Stubs exist for births, deaths, and seasonal effects (Phase 2+).
 *
 * Turn phases (as defined in architecture §5.3):
 *   DAWN   → age people, resolve pregnancies, health/mortality, production
 *   EVENT  → UI presents events for player resolution (not handled here)
 *   MGMT   → player makes choices (role assignment, marriage, trade, diplomacy)
 *   DUSK   → seasonal effects, quota check (autumn), tribe updates
 */

import type { GameState, Season, ResourceStock } from './game-state';
import type { Person } from '../population/person';
import type { SeededRNG } from '../../utils/rng';
import {
  calculateProduction,
  calculateConsumption,
} from '../economy/resources';

// ─── Result Types ─────────────────────────────────────────────────────────────

/** Data returned by processDawn(). The store merges these into GameState. */
export interface DawnResult {
  /** Cloned people Map with ages incremented by 0.25 for each person. */
  updatedPeople: Map<string, Person>;
  /** Resource production delta for the season (positive values). */
  production: ResourceStock;
  /** Resource consumption delta for the season (negative food). */
  consumption: ResourceStock;
  /** Updated living population count (matches updatedPeople.size). */
  populationCount: number;
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

// ─── Dawn Phase ───────────────────────────────────────────────────────────────

/**
 * Processes the Dawn Phase of a turn.
 *
 * Phase 1 operations:
 *   1. Age all people by 0.25 years (one season).
 *   2. Calculate resource production for this season.
 *   3. Calculate resource consumption for this season.
 *
 * Stubs (Phase 2+):
 *   - processPregnancies()
 *   - processHealthAndMortality()
 *   - updateRelationships()
 *
 * @param state - Current game state (not mutated).
 * @param rng - Seeded RNG instance for this turn (unused in Phase 1, reserved for Phase 2).
 * @returns A DawnResult with updated people and resource deltas to apply.
 */
export function processDawn(state: GameState, rng: SeededRNG): DawnResult {
  // Suppress unused-parameter warning until Phase 2 uses rng for births/deaths.
  void rng;

  // 1. Clone people Map and age each person by one season (0.25 years).
  const updatedPeople = new Map<string, Person>();
  for (const [id, person] of state.people) {
    updatedPeople.set(id, { ...person, age: person.age + 0.25 });
  }

  // 2 & 3. Calculate production and consumption using the updated population.
  const production = calculateProduction(updatedPeople, state.settlement, state.currentSeason);
  const consumption = calculateConsumption(updatedPeople);

  return {
    updatedPeople,
    production,
    consumption,
    populationCount: updatedPeople.size,
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

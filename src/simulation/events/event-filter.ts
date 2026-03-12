/**
 * Event filter and draw logic.
 *
 * Kept separate from engine.ts to avoid a circular dependency:
 *   game-state.ts → engine.ts (for GameEvent in pendingEvents)
 *   event-filter.ts → game-state.ts + engine.ts  (no cycle)
 *
 * Callers (the Zustand store) import from this file, not engine.ts,
 * when they need filtering and drawing functionality.
 */

import type { GameEvent, EventPrerequisite, DeferredEventEntry } from './engine';
import type { GameState, ResourceType } from '../turn/game-state';
import type { SeededRNG } from '../../utils/rng';

import { ENVIRONMENTAL_EVENTS } from './definitions/environmental';
import { ECONOMIC_EVENTS }      from './definitions/economic';
import { DOMESTIC_EVENTS }      from './definitions/domestic';
import { COMPANY_EVENTS }       from './definitions/company';
import { DIPLOMACY_EVENTS }     from './definitions/diplomacy';
import { CULTURAL_EVENTS }      from './definitions/cultural';

// ─── Master event deck ────────────────────────────────────────────────────────

/** All defined events, merged from every category definition file. */
export const ALL_EVENTS: GameEvent[] = [
  ...ENVIRONMENTAL_EVENTS,
  ...ECONOMIC_EVENTS,
  ...DOMESTIC_EVENTS,
  ...COMPANY_EVENTS,
  ...DIPLOMACY_EVENTS,
  ...CULTURAL_EVENTS,
];

// ─── Prerequisite checking ────────────────────────────────────────────────────

function checkPrerequisite(prereq: EventPrerequisite, state: GameState): boolean {
  switch (prereq.type) {
    case 'min_population':
      return state.settlement.populationCount >= (prereq.params['value'] as number);
    case 'max_population':
      return state.settlement.populationCount <= (prereq.params['value'] as number);
    case 'min_year':
      return state.currentYear >= (prereq.params['value'] as number);
    case 'season_is':
      return state.currentSeason === (prereq.params['season'] as string);
    case 'has_resource': {
      const res = prereq.params['resource'] as ResourceType;
      const amount = prereq.params['amount'] as number;
      return state.settlement.resources[res] >= amount;
    }
    case 'has_person_matching': {
      // Checks that at least one living person satisfies all supplied criteria.
      // Supported criteria keys: sex, religion, culturalIdentity, minAge, maxAge.
      const criteria = prereq.params as Record<string, unknown>;
      return Array.from(state.people.values()).some(person => {
        if (criteria['sex']             !== undefined && person.sex                          !== criteria['sex'])             return false;
        if (criteria['religion']        !== undefined && person.religion                     !== criteria['religion'])        return false;
        if (criteria['culturalIdentity']!== undefined && person.heritage.primaryCulture     !== criteria['culturalIdentity']) return false;
        if (criteria['minAge']          !== undefined && person.age                          <  (criteria['minAge'] as number))  return false;
        if (criteria['maxAge']          !== undefined && person.age                          >  (criteria['maxAge'] as number))  return false;
        return true;
      });
    }
    case 'cultural_blend_above':
      return state.culture.culturalBlend >= (prereq.params['value'] as number);
    case 'cultural_blend_below':
      return state.culture.culturalBlend <= (prereq.params['value'] as number);
    case 'language_tension_above':
      return state.culture.languageTension >= (prereq.params['threshold'] as number);
    // Unimplemented Phase 3+ prerequisites — treated as satisfied so they
    // don't silently block events in early development.
    default:
      return true;
  }
}

// ─── Eligibility check ────────────────────────────────────────────────────────

/**
 * Returns true if the given event is eligible to be drawn this turn.
 *
 * Checks:
 *  1. isUnique events that have already fired are excluded.
 *  2. Events still within their cooldown window are excluded.
 *  3. All prerequisites must be satisfied.
 */
export function isEventEligible(event: GameEvent, state: GameState): boolean {
  // 0. Deferred-outcome events are only surfaced by drainDeferredEvents,
  //    never drawn from the normal pool.
  if (event.isDeferredOutcome) return false;

  // 1. Unique events fire at most once per game.
  if (event.isUnique && state.eventHistory.some(r => r.eventId === event.id)) {
    return false;
  }

  // 2. Cooldown: the event last fired within the cooldown window.
  const lastFired = state.eventCooldowns.get(event.id);
  if (lastFired !== undefined && state.turnNumber - lastFired < event.cooldown) {
    return false;
  }

  // 3. All prerequisites must pass.
  return event.prerequisites.every(prereq => checkPrerequisite(prereq, state));
}

// ─── Filtering ────────────────────────────────────────────────────────────────

/**
 * Filters the full event list down to only those eligible this turn.
 *
 * @param events - The master event deck (usually ALL_EVENTS).
 * @param state  - Current game state.
 * @returns A subset of events that can be drawn this turn.
 */
export function filterEligibleEvents(events: GameEvent[], state: GameState): GameEvent[] {
  return events.filter(event => isEventEligible(event, state));
}

// ─── Drawing ─────────────────────────────────────────────────────────────────

/**
 * Draws up to `count` events from the eligible pool using weighted random
 * selection without replacement.
 *
 * Each event's `weight` property determines its relative draw probability.
 * High-weight events are more likely but not guaranteed to be chosen first.
 *
 * @param eligible - Pre-filtered list of eligible events.
 * @param count    - Maximum number of events to draw (1–3 in a normal turn).
 * @param rng      - Seeded RNG for deterministic results.
 * @returns The drawn events in draw order. May be fewer than `count` if the
 *          eligible pool is smaller.
 */
export function drawEvents(eligible: GameEvent[], count: number, rng: SeededRNG): GameEvent[] {
  if (eligible.length === 0) return [];

  const drawn: GameEvent[] = [];
  const pool = [...eligible];
  const drawCount = Math.min(count, pool.length);

  for (let i = 0; i < drawCount; i++) {
    // Build a weight map: { eventId → weight }
    const weights: Record<string, number> = {};
    for (const e of pool) {
      weights[e.id] = e.weight;
    }

    const pickedId = rng.weightedPick(weights);
    const pickedIndex = pool.findIndex(e => e.id === pickedId);
    if (pickedIndex === -1) break; // Defensive: should never happen

    const pickedEvent = pool[pickedIndex]!; // always defined — pickedIndex !== -1
    drawn.push(pickedEvent);
    pool.splice(pickedIndex, 1); // Remove to avoid drawing the same event twice
  }

  return drawn;
}

// ─── Deferred event helpers ─────────────────────────────────────────────────────────

/**
 * Partitions the deferred event list into entries that are due this turn
 * and those that should remain pending.
 *
 * @param state - Current game state.
 * @returns `due` contains events whose scheduledTurn ≤ state.turnNumber;
 *          `remaining` will be written back to state.deferredEvents.
 */
export function drainDeferredEvents(
  state: GameState,
): { due: DeferredEventEntry[]; remaining: DeferredEventEntry[] } {
  const due: DeferredEventEntry[] = [];
  const remaining: DeferredEventEntry[] = [];
  for (const entry of state.deferredEvents ?? []) {
    if (entry.scheduledTurn <= state.turnNumber) {
      due.push(entry);
    } else {
      remaining.push(entry);
    }
  }
  return { due, remaining };
}

/**
 * Looks up a single event by ID from the master deck.
 * Used to surface deferred events that are now due.
 *
 * @param id - The event ID to find.
 * @returns The matching `GameEvent`, or `undefined` if not found.
 */
export function getEventById(id: string): GameEvent | undefined {
  return ALL_EVENTS.find(e => e.id === id);
}

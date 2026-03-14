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

import type { GameEvent, EventPrerequisite, DeferredEventEntry, ActorCriteria } from './engine';
import type { GameState, ResourceType, BuildingId, ReligiousPolicy } from '../turn/game-state';
import type { ReligionId } from '../population/person';
import { computeReligiousTension } from '../population/culture';
import type { SeededRNG } from '../../utils/rng';
import { hasBuilding, lacksBuilding, getOvercrowdingRatio } from '../buildings/building-effects';
import { AMBITION_FIRING_THRESHOLD } from '../population/ambitions';
import { getEffectiveOpinion } from '../population/opinions';
import { canResolveActors, matchesCriteria } from './actor-resolver';

import { ENVIRONMENTAL_EVENTS } from './definitions/environmental';
import { ECONOMIC_EVENTS }      from './definitions/economic';
import { DOMESTIC_EVENTS }      from './definitions/domestic';
import { COMPANY_EVENTS }       from './definitions/company';
import { DIPLOMACY_EVENTS }     from './definitions/diplomacy';
import { CULTURAL_EVENTS }      from './definitions/cultural';
import { BUILDING_EVENTS }      from './definitions/building';
import { HOUSEHOLD_EVENTS }     from './definitions/household';
import { RELATIONSHIP_EVENTS }  from './definitions/relationships';
import { RELIGIOUS_EVENTS }     from './definitions/religious';
import { IDENTITY_EVENTS }      from './definitions/identity';

// ─── Master event deck ────────────────────────────────────────────────────────

/** All defined events, merged from every category definition file. */
export const ALL_EVENTS: GameEvent[] = [
  ...ENVIRONMENTAL_EVENTS,
  ...ECONOMIC_EVENTS,
  ...DOMESTIC_EVENTS,
  ...COMPANY_EVENTS,
  ...DIPLOMACY_EVENTS,
  ...CULTURAL_EVENTS,
  ...BUILDING_EVENTS,
  ...HOUSEHOLD_EVENTS,
  ...RELATIONSHIP_EVENTS,
  ...RELIGIOUS_EVENTS,
  ...IDENTITY_EVENTS,
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
    case 'has_person_matching':
      // Delegates to matchesCriteria so all ActorCriteria fields (hasTrait, minSkill, etc.)
      // are supported automatically and the two checks can never drift apart.
      return Array.from(state.people.values()).some(
        p => matchesCriteria(p, prereq.params as ActorCriteria),
      );
    case 'cultural_blend_above':
      return state.culture.culturalBlend >= (prereq.params['value'] as number);
    case 'cultural_blend_below':
      return state.culture.culturalBlend <= (prereq.params['value'] as number);
    case 'language_tension_above':
      return state.culture.languageTension >= (prereq.params['threshold'] as number);
    // Unimplemented Phase 3+ prerequisites — treated as satisfied so they
    // don't silently block events in early development.
    case 'has_building': {
      const buildingId = prereq.params['buildingId'] as BuildingId;
      return hasBuilding(state.settlement.buildings, buildingId);
    }
    case 'lacks_building': {
      const buildingId = prereq.params['buildingId'] as BuildingId;
      return lacksBuilding(state.settlement.buildings, buildingId);
    }
    case 'construction_active':
      return state.settlement.constructionQueue.length > 0;
    case 'overcrowded': {
      const ratio = getOvercrowdingRatio(state.settlement.populationCount, state.settlement.buildings);
      return ratio > 1.0;
    }
    case 'has_multi_wife_household': {
      const households = state.households ?? new Map();
      return Array.from(households.values()).some(h => {
        const wives = h.memberIds.filter(id => {
          const p = state.people.get(id);
          return p && (p.householdRole === 'senior_wife' || p.householdRole === 'wife');
        });
        return wives.length >= 2;
      });
    }
    case 'has_ashka_melathi_bond': {
      const households = state.households ?? new Map();
      return Array.from(households.values()).some(h => h.ashkaMelathiBonds.length > 0);
    }
    case 'min_opinion_pair': {
      // True when at least one living person holds an effective opinion of another AT OR ABOVE threshold.
      // Effective opinion = base (relationships) + active timed modifiers.
      const threshold = prereq.params.threshold as number;
      return Array.from(state.people.values()).some(person => {
        // Gather all targets: base relationships + modifier targets
        const targetIds = new Set<string>([
          ...person.relationships.keys(),
          ...(person.opinionModifiers ?? []).map(m => m.targetId),
        ]);
        return Array.from(targetIds).some(targetId => getEffectiveOpinion(person, targetId) >= threshold);
      });
    }
    case 'max_opinion_pair': {
      // True when at least one living person holds an effective opinion of another AT OR BELOW threshold.
      const threshold = prereq.params.threshold as number;
      return Array.from(state.people.values()).some(person => {
        const targetIds = new Set<string>([
          ...person.relationships.keys(),
          ...(person.opinionModifiers ?? []).map(m => m.targetId),
        ]);
        return Array.from(targetIds).some(targetId => getEffectiveOpinion(person, targetId) <= threshold);
      });
    }
    case 'has_person_with_ambition': {
      const ambitionId = prereq.params.ambitionId as string | undefined;
      return Array.from(state.people.values()).some(person => {
        // Dead persons are deleted from state.people — no alive check needed here.
        if (!person.ambition) return false;
        if (person.ambition.intensity < AMBITION_FIRING_THRESHOLD) return false;
        if (ambitionId && person.ambition.type !== ambitionId) return false;
        return true;
      });
    }
    case 'religion_fraction_above': {
      const religion = prereq.params['religion'] as ReligionId;
      const threshold = prereq.params['threshold'] as number;
      return (state.culture.religions.get(religion) ?? 0) >= threshold;
    }
    case 'religion_fraction_below': {
      const religion = prereq.params['religion'] as ReligionId;
      const threshold = prereq.params['threshold'] as number;
      return (state.culture.religions.get(religion) ?? 0) <= threshold;
    }
    case 'religious_tension_above': {
      const threshold = prereq.params['threshold'] as number;
      return computeReligiousTension(state.culture.religions) >= threshold;
    }
    case 'religious_policy_is': {
      const policy = prereq.params['policy'] as ReligiousPolicy;
      return state.settlement.religiousPolicy === policy;
    }
    case 'hidden_wheel_emerged':
      return state.culture.hiddenWheelEmerged === true;
    case 'min_company_pressure_turns': {
      const turns = prereq.params['turns'] as number;
      return (state.identityPressure?.companyPressureTurns ?? 0) >= turns;
    }
    case 'min_tribal_pressure_turns': {
      const turns = prereq.params['turns'] as number;
      return (state.identityPressure?.tribalPressureTurns ?? 0) >= turns;
    }
    case 'tribe_exists': {
      const tribeId = prereq.params['tribeId'] as string;
      return (state.tribes ?? new Map()).has(tribeId);
    }
    case 'tribe_disposition_above': {
      const tribeId = prereq.params['tribeId'] as string;
      const value   = prereq.params['value'] as number;
      const tribe   = (state.tribes ?? new Map()).get(tribeId);
      return tribe !== undefined && tribe.disposition > value;
    }
    case 'tribe_disposition_below': {
      const tribeId = prereq.params['tribeId'] as string;
      const value   = prereq.params['value'] as number;
      const tribe   = (state.tribes ?? new Map()).get(tribeId);
      return tribe !== undefined && tribe.disposition < value;
    }
    case 'company_standing_above': {
      const value = prereq.params['value'] as number;
      return (state.company?.standing ?? 0) > value;
    }
    case 'company_standing_below': {
      const value = prereq.params['value'] as number;
      return (state.company?.standing ?? 0) < value;
    }
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
  if (!event.prerequisites.every(prereq => checkPrerequisite(prereq, state))) return false;

  // 4. All required actor slots must be fillable.
  if (event.actorRequirements && event.actorRequirements.length > 0) {
    if (!canResolveActors(event.actorRequirements, state)) return false;
  }

  return true;
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
 * @param eligible      - Pre-filtered list of eligible events.
 * @param count         - Maximum number of events to draw (1–3 in a normal turn).
 * @param rng           - Seeded RNG for deterministic results.
 * @param weightBoosts  - Optional map of eventId → multiplier; applied on top of base weight.
 * @returns The drawn events in draw order. May be fewer than `count` if the
 *          eligible pool is smaller.
 */
export function drawEvents(
  eligible: GameEvent[],
  count: number,
  rng: SeededRNG,
  weightBoosts: Record<string, number> = {},
): GameEvent[] {
  if (eligible.length === 0) return [];

  const drawn: GameEvent[] = [];
  const pool = [...eligible];
  const drawCount = Math.min(count, pool.length);

  for (let i = 0; i < drawCount; i++) {
    // Build a weight map: { eventId → weight }
    const weights: Record<string, number> = {};
    for (const e of pool) {
      weights[e.id] = e.weight * (weightBoosts[e.id] ?? 1);
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

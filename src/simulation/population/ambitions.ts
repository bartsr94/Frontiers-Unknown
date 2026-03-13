/**
 * Ambitions engine — personal goals that drive autonomous character behaviour.
 *
 * Each person may hold at most one active ambition at a time (PersonAmbition | null).
 * Ambitions grow in intensity (+0.05/turn) until fulfilled or abandoned, and
 * trigger events once intensity reaches the firing threshold (0.5).
 *
 * Integration points:
 *   - `processDawn()` calls `tickAmbitionIntensity()` once per living person
 *   - `processDawn()` calls `evaluateAmbition()` / `generateAmbition()` every
 *     8 turns to update and potentially assign ambitions
 *   - Event prereqs use `has_person_with_ambition` to gate relationship events
 */

import type { Person, PersonAmbition, AmbitionId } from '../population/person';
import type { GameState } from '../turn/game-state';
import type { SeededRNG } from '../../utils/rng';
import { getDerivedSkill } from '../population/person';
import { getEffectiveOpinion } from './opinions';
import { SAUROMATIAN_CULTURE_IDS } from '../population/culture';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Intensity grows this much per turn until it reaches 1.0. */
const INTENSITY_GROWTH = 0.05;

/** Ambition must reach this intensity before it can trigger autonomous events. */
export const AMBITION_FIRING_THRESHOLD = 0.7;

/**
 * Removes the AMBITION_GENERATION_CHANCE constant — generation is now based
 * on specific conditions per ambition type, not random rolls.
 */

// ─── Tick ─────────────────────────────────────────────────────────────────────

/**
 * Advances an active ambition's intensity by one turn.
 * No-ops if the person has no ambition or has the 'content' trait.
 *
 * @returns Updated person (or same reference if unchanged).
 */
export function tickAmbitionIntensity(person: Person): Person {
  if (!person.ambition) return person;
  // Content characters don't fixate
  if (person.traits.includes('content')) return person;

  const newIntensity = Math.min(1.0, person.ambition.intensity + INTENSITY_GROWTH);
  if (newIntensity === person.ambition.intensity) return person;

  return {
    ...person,
    ambition: { ...person.ambition, intensity: newIntensity },
  };
}

// ─── Evaluation ───────────────────────────────────────────────────────────────

/**
 * Evaluates whether an active ambition has been fulfilled or should be abandoned.
 *
 * - `'fulfilled'` — the goal has been achieved (e.g. relationship ambition target
 *   is now a spouse)
 * - `'failed'`    — impossible to fulfil (target is dead, ambition is stale > 40
 *   turns)
 * - `'ongoing'`   — still in progress
 */
export function evaluateAmbition(
  person: Person,
  state: GameState,
): 'fulfilled' | 'failed' | 'ongoing' {
  if (!person.ambition) return 'ongoing';

  const { type, targetPersonId, formedTurn } = person.ambition;

  // Stale after 40 turns regardless of type
  if (state.turnNumber - formedTurn > 40) return 'failed';

  switch (type) {
    case 'seek_spouse': {
      if (!targetPersonId) return 'failed';
      const target = state.people.get(targetPersonId);
      if (!target) return 'failed';
      if (person.spouseIds.includes(targetPersonId)) return 'fulfilled';
      // Failed if target married someone else
      if (target.spouseIds.length > 0) return 'failed';
      return 'ongoing';
    }

    case 'seek_council':
      return state.councilMemberIds.includes(person.id) ? 'fulfilled' : 'ongoing';

    case 'seek_seniority':
      if (person.householdRole === 'senior_wife') return 'fulfilled';
      if (!person.householdId) return 'failed';
      if (person.householdRole !== 'wife') return 'failed';
      return 'ongoing';

    case 'seek_cultural_duty':
      if (person.role === 'keth_thara') return 'fulfilled';
      if (person.age > 24) return 'failed';
      return 'ongoing';

    case 'seek_informal_union': {
      if (!targetPersonId) return 'failed';
      const target = state.people.get(targetPersonId);
      if (!target) return 'failed';
      // Fulfilled if target is now in person's household as concubine
      if (
        target.householdId !== null &&
        target.householdId === person.householdId &&
        target.householdRole === 'concubine'
      ) return 'fulfilled';
      // Failed if target married someone else
      if (target.spouseIds.length > 0) return 'failed';
      return 'ongoing';
    }
  }
}

// ─── Generation ───────────────────────────────────────────────────────────────

/**
 * Determines what ambition type (if any) a person would naturally develop.
 * Checked in priority order — first match wins.
 *
 * 1. `seek_spouse`         — unmarried adult ≥ 18, opinion ≥ 40 of eligible partner
 * 2. `seek_council`        — not on council, leadership OR diplomacy ≥ 46 (Very Good)
 * 3. `seek_seniority`      — wife in household with ≥ 3 wives, hostile opinion of senior wife
 * 4. `seek_cultural_duty`  — Sauromatian male age 16–24, not already on keth-thara
 * 5. `seek_informal_union` — non-Sauromatian male ≥ 18, opinion ≥ 50 of eligible woman
 */
export function determineAmbitionType(
  person: Person,
  state: GameState,
  rng: SeededRNG,
): { type: AmbitionId; targetPersonId: string | null } | null {
  // No ambitions for content, away, or thrall persons
  if (person.traits.includes('content')) return null;
  if (person.role === 'away') return null;
  if (person.socialStatus === 'thrall') return null;

  // 1. seek_spouse — unmarried adult with strong opinion of an eligible partner
  if (person.spouseIds.length === 0 && person.age >= 18) {
    const candidates = Array.from(state.people.values()).filter(
      other =>
        other.id !== person.id &&
        other.sex !== person.sex &&
        other.spouseIds.length === 0 &&
        other.age >= 16 &&
        getEffectiveOpinion(person, other.id) >= 40,
    );
    if (candidates.length > 0) {
      const target = candidates[rng.nextInt(0, candidates.length - 1)]!;
      return { type: 'seek_spouse', targetPersonId: target.id };
    }
  }

  // 2. seek_council — skilled person not currently on council
  if (
    !state.councilMemberIds.includes(person.id) &&
    (person.skills.leadership >= 46 || getDerivedSkill(person.skills, 'diplomacy') >= 46)
  ) {
    return { type: 'seek_council', targetPersonId: null };
  }

  // 3. seek_seniority — wife in a household with ≥ 3 wives who envies the senior wife
  if (person.householdRole === 'wife' && person.householdId) {
    const household = state.households.get(person.householdId);
    if (household) {
      const wiveCount = Array.from(state.people.values()).filter(
        p =>
          p.householdId === person.householdId &&
          (p.householdRole === 'wife' || p.householdRole === 'senior_wife'),
      ).length;
      const seniorWifeId = household.seniorWifeId;
      const opinionOfSenior = seniorWifeId ? getEffectiveOpinion(person, seniorWifeId) : 0;
      if (wiveCount >= 3 && opinionOfSenior < 0) {
        return { type: 'seek_seniority', targetPersonId: seniorWifeId };
      }
    }
  }

  // 4. seek_cultural_duty — young Sauromatian male, age 16–24
  if (
    person.sex === 'male' &&
    person.age >= 16 &&
    person.age <= 24 &&
    SAUROMATIAN_CULTURE_IDS.has(person.heritage.primaryCulture) &&
    person.role !== 'keth_thara'
  ) {
    return { type: 'seek_cultural_duty', targetPersonId: null };
  }

  // 5. seek_informal_union — non-Sauromatian man with strong interest in an eligible woman
  if (
    person.sex === 'male' &&
    !SAUROMATIAN_CULTURE_IDS.has(person.heritage.primaryCulture) &&
    person.age >= 18
  ) {
    const targets = Array.from(state.people.values()).filter(
      other =>
        other.id !== person.id &&
        other.sex === 'female' &&
        other.spouseIds.length === 0 &&
        other.age >= 16 &&
        getEffectiveOpinion(person, other.id) >= 50,
    );
    if (targets.length > 0) {
      const target = targets[rng.nextInt(0, targets.length - 1)]!;
      return { type: 'seek_informal_union', targetPersonId: target.id };
    }
  }

  return null;
}

/**
 * Generates a new PersonAmbition for the given person if conditions are met.
 * Returns null if no ambition should form (already has one, content, etc.).
 */
export function generateAmbition(
  person: Person,
  state: GameState,
  rng: SeededRNG,
): PersonAmbition | null {
  // Already has an active ambition
  if (person.ambition) return null;

  const result = determineAmbitionType(person, state, rng);
  if (!result) return null;

  return {
    type: result.type,
    intensity: 0.1,
    targetPersonId: result.targetPersonId,
    formedTurn: state.turnNumber,
  };
}

/**
 * Clears a fulfilled or failed ambition from the person.
 * No-op if the person has no ambition.
 */
export function clearAmbition(person: Person): Person {
  if (!person.ambition) return person;
  return { ...person, ambition: null };
}

// ─── Display helpers ──────────────────────────────────────────────────────────

/**
 * Returns a short human-readable label for an ambition.
 */
export function getAmbitionLabel(ambition: PersonAmbition): string {
  switch (ambition.type) {
    case 'seek_spouse':         return 'Seeking a companion';
    case 'seek_council':        return 'Seeking a council seat';
    case 'seek_seniority':      return 'Seeking senior-wife standing';
    case 'seek_cultural_duty':  return 'Called to keth-thara';
    case 'seek_informal_union': return 'Seeking an informal bond';
  }
}

/**
 * Returns a CSS colour class for an ambition badge based on intensity.
 */
export function getAmbitionIntensityClass(intensity: number): string {
  if (intensity >= 0.8) return 'bg-rose-900 text-rose-200';
  if (intensity >= 0.5) return 'bg-amber-900 text-amber-200';
  return 'bg-stone-700 text-stone-400';
}

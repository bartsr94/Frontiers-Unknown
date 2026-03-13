/**
 * Household utility functions.
 *
 * Pure TypeScript — zero React, no Math.random().
 * All mutations return new objects; callers are responsible for updating GameState.
 *
 * A Household (_ashkaran_) is the fundamental social and reproductive unit:
 *   - Sauromatian households: wife-council leads; husband is spiritual centre
 *   - Imanian households: patriarch nominally leads; women manage internally
 *   - Ansberite households: contested hybrid; hearth-companions permitted
 */

import type { GameState, Household, HouseholdRole, HouseholdTradition } from '../turn/game-state';
import type { Person } from './person';
import { generateId } from '../../utils/id';

// ─── Creation ─────────────────────────────────────────────────────────────────

export interface CreateHouseholdOptions {
  name: string;
  tradition: HouseholdTradition;
  headId: string | null;
  seniorWifeId: string | null;
  foundedTurn: number;
}

/**
 * Creates a new Household object.
 * Does NOT mutate GameState — caller must add to state.households.
 */
export function createHousehold(options: CreateHouseholdOptions): Household {
  return {
    id: generateId(),
    name: options.name,
    tradition: options.tradition,
    headId: options.headId,
    seniorWifeId: options.seniorWifeId,
    memberIds: [],
    ashkaMelathiBonds: [],
    foundedTurn: options.foundedTurn,
  };
}

// ─── Membership ───────────────────────────────────────────────────────────────

/**
 * Returns an updated Household with personId appended to memberIds.
 * Does NOT mutate the Person — caller must set person.householdId and person.householdRole.
 */
export function addToHousehold(household: Household, personId: string): Household {
  if (household.memberIds.includes(personId)) return household;
  return { ...household, memberIds: [...household.memberIds, personId] };
}

/**
 * Returns an updated Household with personId removed from memberIds.
 * Also removes any ashkaMelathiBonds entries that reference this person.
 * Does NOT update Person fields — caller clears householdId / householdRole.
 */
export function removeFromHousehold(household: Household, personId: string): Household {
  return {
    ...household,
    memberIds: household.memberIds.filter(id => id !== personId),
    ashkaMelathiBonds: household.ashkaMelathiBonds.filter(
      ([a, b]) => a !== personId && b !== personId,
    ),
    headId: household.headId === personId ? null : household.headId,
    seniorWifeId: household.seniorWifeId === personId ? null : household.seniorWifeId,
  };
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Returns the live Person objects for all current household members.
 * Silently skips IDs that no longer exist in state.people (e.g. deceased).
 */
export function getHouseholdMembers(householdId: string, state: GameState): Person[] {
  const household = state.households.get(householdId);
  if (!household) return [];
  return household.memberIds
    .map(id => state.people.get(id))
    .filter((p): p is Person => p !== undefined);
}

/**
 * Returns the Household whose memberIds includes personId, or null if unattached.
 * O(n) scan — fine at expected settlement sizes.
 */
export function getHouseholdByPerson(personId: string, state: GameState): Household | null {
  for (const household of state.households.values()) {
    if (household.memberIds.includes(personId)) return household;
  }
  return null;
}

/**
 * Returns the senior wife of a household.
 * Priority:
 *   1. household.seniorWifeId (if set and still alive)
 *   2. Oldest member with householdRole 'senior_wife'
 *   3. Oldest member with householdRole 'wife'
 *   4. null — no wives exist
 */
export function getSeniorWife(household: Household, state: GameState): Person | null {
  if (household.seniorWifeId) {
    const designated = state.people.get(household.seniorWifeId);
    if (designated) return designated;
  }

  const members = getHouseholdMembers(household.id, state);

  const seniorWives = members
    .filter(p => p.householdRole === 'senior_wife')
    .sort((a, b) => b.age - a.age);
  if (seniorWives.length > 0) return seniorWives[0] ?? null;

  const wives = members
    .filter(p => p.householdRole === 'wife')
    .sort((a, b) => b.age - a.age);
  if (wives.length > 0) return wives[0] ?? null;

  return null;
}

/**
 * Counts formal wives (roles 'wife' and 'senior_wife') in a household.
 * Used for capacity checks in canMarry().
 */
export function countWives(household: Household, state: GameState): number {
  const members = getHouseholdMembers(household.id, state);
  return members.filter(p => p.householdRole === 'wife' || p.householdRole === 'senior_wife').length;
}

/**
 * Counts informal household members (roles 'concubine' and 'hearth_companion').
 */
export function countConcubines(household: Household, state: GameState): number {
  const members = getHouseholdMembers(household.id, state);
  return members.filter(p => p.householdRole === 'concubine' || p.householdRole === 'hearth_companion').length;
}

// ─── Dissolution ──────────────────────────────────────────────────────────────

/**
 * Dissolves a household: clears householdId, householdRole, and ashkaMelathiPartnerIds
 * on every current member, then removes the household from state.households.
 * Returns the updated full GameState.
 */
export function dissolveHousehold(householdId: string, state: GameState): GameState {
  const household = state.households.get(householdId);
  if (!household) return state;

  const updatedPeople = new Map(state.people);
  for (const memberId of household.memberIds) {
    const person = updatedPeople.get(memberId);
    if (person) {
      updatedPeople.set(memberId, {
        ...person,
        householdId: null,
        householdRole: null,
        ashkaMelathiPartnerIds: [],
      });
    }
  }

  const updatedHouseholds = new Map(state.households);
  updatedHouseholds.delete(householdId);

  return { ...state, people: updatedPeople, households: updatedHouseholds };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Determines whether a person holds a given household role.
 * Convenience wrapper for boolean checks in event criteria.
 */
export function hasHouseholdRole(person: Person, role: HouseholdRole): boolean {
  return person.householdRole === role;
}

/** The display sort order for household roles in the UI (head first, thrall last). */
export const HOUSEHOLD_ROLE_ORDER: HouseholdRole[] = [
  'head',
  'senior_wife',
  'wife',
  'concubine',
  'hearth_companion',
  'child',
  'thrall',
];

/** Human-readable labels for household roles. */
export const HOUSEHOLD_ROLE_LABELS: Record<HouseholdRole, string> = {
  head: 'Head',
  senior_wife: 'Senior Wife',
  wife: 'Wife',
  concubine: 'Concubine',
  hearth_companion: 'Hearth-Companion',
  child: 'Child',
  thrall: 'Thrall',
};

/** Tailwind colour classes for household role badges. */
export const HOUSEHOLD_ROLE_COLORS: Record<HouseholdRole, string> = {
  head: 'bg-amber-900 text-amber-100',
  senior_wife: 'bg-purple-800 text-purple-100',
  wife: 'bg-purple-600 text-purple-100',
  concubine: 'bg-rose-700 text-rose-100',
  hearth_companion: 'bg-rose-600 text-rose-100',
  child: 'bg-slate-600 text-slate-100',
  thrall: 'bg-zinc-700 text-zinc-200',
};

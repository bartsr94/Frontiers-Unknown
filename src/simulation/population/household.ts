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

import type { GameState, Household, HouseholdRole, HouseholdTradition, ActivityLogEntry } from '../turn/game-state';
import type { Person } from './person';
import { SAUROMATIAN_CULTURE_IDS } from './culture';
import { generateId } from '../../utils/id';

// ─── Creation ─────────────────────────────────────────────────────────────────

export interface CreateHouseholdOptions {
  name: string;
  tradition: HouseholdTradition;
  headId: string | null;
  seniorWifeId: string | null;
  foundedTurn: number;
  /** Defaults to true — system will update the name when leadership changes. */
  isAutoNamed?: boolean;
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
    dwellingBuildingId: null,
    productionBuildingIds: [],
    isAutoNamed: options.isAutoNamed ?? true,
    buildingSlots: Array(9).fill(null) as (string | null)[],
    householdWealth: 0,
    wealthAccumulator: 0,
    wealthMaintenanceDebt: 0,
    specialty: null,
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

// ─── Naming ────────────────────────────────────────────────────────────────────

/**
 * Derives a display name for a household from its current head / senior wife.
 * Only applies when isAutoNamed === true; returns the existing name otherwise.
 */
export function deriveHouseholdName(
  household: Household,
  people: Map<string, Person>,
): string {
  if (!household.isAutoNamed) return household.name;

  const head = household.headId ? people.get(household.headId) : null;
  const seniorWife = household.seniorWifeId ? people.get(household.seniorWifeId) : null;

  // Single-member households (no spouse)
  if (!head && !seniorWife) {
    const firstMember = household.memberIds
      .map(id => people.get(id))
      .find((p): p is Person => p !== undefined);
    if (firstMember) return `Household of ${firstMember.firstName}`;
    return household.name; // fallback — empty household about to dissolve
  }

  // Sauromatian: senior wife names the household
  if (household.tradition === 'sauromatian' && seniorWife) {
    const base = seniorWife.familyName ?? seniorWife.firstName;
    return `${base} Ashkaran`;
  }

  // Imanian / Ansberite: head names the household
  if (head) {
    const base = head.familyName ?? head.firstName;
    return `House of ${base}`;
  }

  // Widow-led / no head after death
  if (seniorWife) return `Household of ${seniorWife.firstName}`;

  const firstMember = household.memberIds
    .map(id => people.get(id))
    .find((p): p is Person => p !== undefined);
  return firstMember ? `Household of ${firstMember.firstName}` : household.name;
}

// ─── Auto-formation helpers ────────────────────────────────────────────────────

/** Builds a single-person household for a given person. */
function buildSoloHousehold(person: Person, turnNumber: number): { household: Household; updatedPerson: Person } {
  const isSauro =
    SAUROMATIAN_CULTURE_IDS.has(person.heritage.primaryCulture) ||
    person.heritage.primaryCulture === 'settlement_native';

  const tradition: HouseholdTradition = isSauro ? 'sauromatian' : 'imanian';
  const isFemale = person.sex === 'female';

  const raw = createHousehold({
    name: '',          // will be derived below
    tradition,
    headId: isFemale ? null : person.id,
    seniorWifeId: isFemale ? person.id : null,
    foundedTurn: turnNumber,
    isAutoNamed: true,
  });
  const withMember = addToHousehold(raw, person.id);
  const household: Household = {
    ...withMember,
    name: deriveHouseholdName(withMember, new Map([[person.id, person]])),
  };
  const updatedPerson: Person = {
    ...person,
    householdId: household.id,
    householdRole: isFemale ? 'senior_wife' : 'head',
  };
  return { household, updatedPerson };
}

/**
 * Ensures a person has a household. Creates a new single-person household if
 * householdId is null. No-op when the person already belongs to a household.
 */
export function ensurePersonHousehold(
  person: Person,
  households: Map<string, Household>,
  turnNumber: number,
): { updatedPerson: Person; newHousehold: Household | null } {
  if (person.householdId && households.has(person.householdId)) {
    return { updatedPerson: person, newHousehold: null };
  }
  const { household, updatedPerson } = buildSoloHousehold(person, turnNumber);
  return { updatedPerson, newHousehold: household };
}

/**
 * Bulk-initialises households for all persons with householdId === null.
 * Used at game start and as a migration helper for old saves.
 * Returns brand-new maps (immutable style) — does not mutate inputs.
 */
export function initializeHouseholds(
  people: Map<string, Person>,
  turnNumber: number,
): { updatedPeople: Map<string, Person>; newHouseholds: Map<string, Household> } {
  const updatedPeople = new Map(people);
  const newHouseholds = new Map<string, Household>();

  for (const person of people.values()) {
    if (person.householdId) continue; // already has one
    const { household, updatedPerson } = buildSoloHousehold(person, turnNumber);
    updatedPeople.set(updatedPerson.id, updatedPerson);
    newHouseholds.set(household.id, household);
  }

  return { updatedPeople, newHouseholds };
}

// ─── Birth assignment ──────────────────────────────────────────────────────────

/**
 * Assigns a newborn to the appropriate household.
 * Priority: father's household (if married) > mother's household > new solo household.
 * Mutates updatedPeople and updatedHouseholds in-place.
 */
export function assignChildToHousehold(
  child: Person,
  mother: Person,
  father: Person | undefined,
  updatedPeople: Map<string, Person>,
  updatedHouseholds: Map<string, Household>,
  turnNumber: number,
): void {
  // Determine target household: father's (if he has one) else mother's
  const targetHouseholdId = father?.householdId ?? mother.householdId;

  if (targetHouseholdId) {
    const hh = updatedHouseholds.get(targetHouseholdId)
      ?? (mother.householdId === targetHouseholdId
          ? updatedHouseholds.get(targetHouseholdId)
          : undefined);
    // Look in both maps
    const existing = updatedHouseholds.get(targetHouseholdId);
    if (existing) {
      updatedHouseholds.set(targetHouseholdId, addToHousehold(existing, child.id));
      updatedPeople.set(child.id, { ...child, householdId: targetHouseholdId, householdRole: 'child' });
      return;
    }
    void hh; // silence unused var
  }

  // Fallback: create a new solo household for the child
  const { household, updatedPerson } = buildSoloHousehold(
    { ...child, householdId: null },
    turnNumber,
  );
  updatedPeople.set(updatedPerson.id, updatedPerson);
  updatedHouseholds.set(household.id, household);
}

// ─── Merging ───────────────────────────────────────────────────────────────────

/**
 * Merges the *source* household entirely into the *destination* household.
 * Every member of source has their householdId updated to destId and their role
 * preserved (unless overrideRoles is provided).
 * The source household is dissolved.
 *
 * Returns updated people and households maps.  Does not mutate inputs.
 */
export function mergeHouseholds(
  destId: string,
  sourceId: string,
  households: Map<string, Household>,
  people: Map<string, Person>,
  overrideRoles?: Map<string, HouseholdRole>,
): {
  updatedPeople: Map<string, Person>;
  updatedHouseholds: Map<string, Household>;
  dissolvedHouseholdId: string;
} {
  const dest = households.get(destId);
  const source = households.get(sourceId);
  if (!dest || !source) {
    return {
      updatedPeople: new Map(people),
      updatedHouseholds: new Map(households),
      dissolvedHouseholdId: sourceId,
    };
  }

  // Copy both maps so we can mutate freely
  const updatedPeople = new Map(people);
  const updatedHouseholds = new Map(households);

  // Move every source member into dest
  let updatedDest = { ...dest, memberIds: [...dest.memberIds] };
  for (const memberId of source.memberIds) {
    if (!updatedDest.memberIds.includes(memberId)) {
      updatedDest = { ...updatedDest, memberIds: [...updatedDest.memberIds, memberId] };
    }
    const person = updatedPeople.get(memberId);
    if (person) {
      const role = overrideRoles?.get(memberId) ?? person.householdRole;
      updatedPeople.set(memberId, {
        ...person,
        householdId: destId,
        householdRole: role,
      });
    }
  }

  // Carry over Ashka-Melathi bonds from source
  for (const bond of source.ashkaMelathiBonds) {
    const alreadyPresent = updatedDest.ashkaMelathiBonds.some(
      ([a, b]) => (a === bond[0] && b === bond[1]) || (a === bond[1] && b === bond[0]),
    );
    if (!alreadyPresent) {
      updatedDest = {
        ...updatedDest,
        ashkaMelathiBonds: [...updatedDest.ashkaMelathiBonds, bond],
      };
    }
  }

  // Pool the dissolved household's savings into the surviving one.
  updatedDest = { ...updatedDest, householdWealth: updatedDest.householdWealth + source.householdWealth };
  updatedHouseholds.set(destId, updatedDest);
  updatedHouseholds.delete(sourceId);

  return { updatedPeople, updatedHouseholds, dissolvedHouseholdId: sourceId };
}

// ─── Orphan cleanup ────────────────────────────────────────────────────────────

/**
 * Safety-net pass: dissolves any household whose memberIds are entirely dead
 * (not present in the living people map).
 * Run once per dawn after demographic processing.
 */
export function pruneOrphanedHouseholds(
  households: Map<string, Household>,
  people: Map<string, Person>,
): {
  updatedHouseholds: Map<string, Household>;
  updatedPeople: Map<string, Person>;
  dissolvedIds: string[];
} {
  const updatedHouseholds = new Map(households);
  const updatedPeople = new Map(people);
  const dissolvedIds: string[] = [];

  for (const [id, hh] of households) {
    const livingMembers = hh.memberIds.filter(mid => people.has(mid));
    if (livingMembers.length === 0) {
      updatedHouseholds.delete(id);
      dissolvedIds.push(id);
    } else if (livingMembers.length !== hh.memberIds.length) {
      // Some members died — prune their IDs from memberIds
      updatedHouseholds.set(id, { ...hh, memberIds: livingMembers });
    }
  }

  // Clear householdId on any person still pointing at a dissolved household
  for (const [pid, person] of people) {
    if (person.householdId && dissolvedIds.includes(person.householdId)) {
      updatedPeople.set(pid, { ...person, householdId: null, householdRole: null });
    }
  }

  return { updatedHouseholds, updatedPeople, dissolvedIds };
}

// ─── Succession ────────────────────────────────────────────────────────────────

export interface HouseholdSuccessionResult {
  /** Updated versions of the continuing household and any new split-off households. */
  updatedHouseholds: Map<string, Household>;
  /** Brand-new households created for sons who split off. */
  newHouseholds: Map<string, Household>;
  /** IDs of households dissolved during this succession (always empty for now — handled by prune). */
  dissolvedHouseholdIds: string[];
  /** Updated persons whose householdId / householdRole changed. */
  updatedPeople: Map<string, Person>;
  /** Activity log entries. */
  logEntries: ActivityLogEntry[];
  /**
   * When true, the caller should inject a 'hh_succession_council' event into
   * pendingEvents (Sauromatian edge case — player decides whether sons split).
   */
  pendingSauromatianCouncilEvent: boolean;
}

/**
 * Runs household succession when a head has died.
 *
 * Imanian / Ansberite:
 *   - Eldest adult son becomes head and stays
 *   - All other adult sons split off into their own households
 *   - If no adult sons: senior wife becomes acting head
 *
 * Sauromatian:
 *   - Wife-council governs; no forced son-split
 *   - Returns pendingSauromatianCouncilEvent = true so the player can decide
 *
 * Property division: eldest keeps ⌈2/3⌉ of productionBuildingIds; remainder
 * distributed round-robin to splitting sons.
 */
export function processHouseholdSuccession(
  householdId: string,
  deceasedHeadId: string,
  households: Map<string, Household>,
  people: Map<string, Person>,
  turnNumber: number,
): HouseholdSuccessionResult {
  const emptyResult: HouseholdSuccessionResult = {
    updatedHouseholds: new Map(),
    newHouseholds: new Map(),
    dissolvedHouseholdIds: [],
    updatedPeople: new Map(),
    logEntries: [],
    pendingSauromatianCouncilEvent: false,
  };

  const household = households.get(householdId);
  if (!household) return emptyResult;

  const updatedHouseholds = new Map(households);
  const newHouseholds = new Map<string, Household>();
  const updatedPeople = new Map<string, Person>();
  const logEntries: ActivityLogEntry[] = [];

  // Remove deceased head from memberIds
  let continuingHousehold = removeFromHousehold(household, deceasedHeadId);

  // Find adult sons (age ≥ 16, male, parentIds includes deceasedHeadId, still living)
  const allMembers = continuingHousehold.memberIds
    .map(id => people.get(id))
    .filter((p): p is Person => p !== undefined);

  const adultSons = allMembers
    .filter(
      p =>
        p.sex === 'male' &&
        p.age >= 16 &&
        p.parentIds.includes(deceasedHeadId),
    )
    .sort((a, b) => b.age - a.age); // eldest first

  // ── Sauromatian: wife-council governs; no forced split ──────────────────────
  if (household.tradition === 'sauromatian') {
    // Designate eldest adult son as successor (if any) but don't force splits
    if (adultSons.length > 0) {
      const eldest = adultSons[0]!;
      continuingHousehold = { ...continuingHousehold, headId: eldest.id };
      updatedPeople.set(eldest.id, { ...eldest, householdRole: 'head' });
    } else {
      // Promote senior wife
      const seniorWife = getSeniorWife(continuingHousehold, { households: updatedHouseholds.set(householdId, continuingHousehold), people } as unknown as GameState);
      if (seniorWife) {
        continuingHousehold = {
          ...continuingHousehold,
          headId: seniorWife.id,
          seniorWifeId: seniorWife.id,
        };
        updatedPeople.set(seniorWife.id, { ...seniorWife, householdRole: 'head' });
      }
    }
    continuingHousehold = {
      ...continuingHousehold,
      name: deriveHouseholdName(continuingHousehold, new Map([...people, ...updatedPeople])),
    };
    updatedHouseholds.set(householdId, continuingHousehold);
    logEntries.push({
      turn: turnNumber,
      type: 'household_succession',
      description: `The wife-council holds authority in ${continuingHousehold.name} after the head's passing.`,
    });
    return {
      updatedHouseholds,
      newHouseholds,
      dissolvedHouseholdIds: [],
      updatedPeople,
      logEntries,
      pendingSauromatianCouncilEvent: adultSons.length > 0,
    };
  }

  // ── Imanian / Ansberite ─────────────────────────────────────────────────────
  if (adultSons.length === 0) {
    // No male heir — senior wife or eldest remaining member becomes acting head
    const seniorWife = getSeniorWife(continuingHousehold, { households: new Map([[householdId, continuingHousehold]]), people } as unknown as GameState);
    const newHead = seniorWife ?? allMembers[0];
    if (newHead) {
      continuingHousehold = { ...continuingHousehold, headId: newHead.id };
      updatedPeople.set(newHead.id, { ...newHead, householdRole: 'head' });
    }
    continuingHousehold = {
      ...continuingHousehold,
      name: deriveHouseholdName(continuingHousehold, new Map([...people, ...updatedPeople])),
    };
    updatedHouseholds.set(householdId, continuingHousehold);
    logEntries.push({
      turn: turnNumber,
      type: 'household_succession',
      description: `${newHead?.firstName ?? 'A new leader'} takes charge of ${continuingHousehold.name}.`,
    });
    return {
      updatedHouseholds,
      newHouseholds,
      dissolvedHouseholdIds: [],
      updatedPeople,
      logEntries,
      pendingSauromatianCouncilEvent: false,
    };
  }

  // At least one adult son: eldest stays, others split
  const eldest = adultSons[0]!;
  const splittingSons = adultSons.slice(1);

  // Eldest becomes the new head
  continuingHousehold = { ...continuingHousehold, headId: eldest.id };
  updatedPeople.set(eldest.id, { ...eldest, householdRole: 'head' });

  // Property division: eldest gets ⌈2/3⌉ of production buildings
  const allBuildings = [...continuingHousehold.productionBuildingIds];
  const eldestShare = Math.ceil(allBuildings.length * 2 / 3);
  const eldestBuildings = allBuildings.slice(0, eldestShare);
  const remainingBuildings = allBuildings.slice(eldestShare);

  continuingHousehold = { ...continuingHousehold, productionBuildingIds: eldestBuildings };

  // Split each non-eldest son into their own household
  for (let i = 0; i < splittingSons.length; i++) {
    const son = splittingSons[i]!;

    // Collect all people who belong "to this son": his wives, their children
    const sonFamilyIds: string[] = [son.id];
    for (const p of allMembers) {
      if (p.spouseIds.includes(son.id)) sonFamilyIds.push(p.id);
      if (p.parentIds.includes(son.id)) sonFamilyIds.push(p.id);
    }

    // Remove them from the continuing household
    for (const fid of sonFamilyIds) {
      continuingHousehold = removeFromHousehold(continuingHousehold, fid);
    }

    // Assign one production building round-robin (if available)
    const assignedBuilding = remainingBuildings[i] ?? null;
    const newHhProductionBuildings = assignedBuilding ? [assignedBuilding] : [];

    // Create the new household for the son
    const sonPerson = people.get(son.id) ?? son;
    const isSauro =
      SAUROMATIAN_CULTURE_IDS.has(sonPerson.heritage.primaryCulture) ||
      sonPerson.heritage.primaryCulture === 'settlement_native';
    const newHhTradition: HouseholdTradition = isSauro ? 'sauromatian' : 'imanian';

    const freshHh = createHousehold({
      name: '',
      tradition: newHhTradition,
      headId: son.id,
      seniorWifeId: null,
      foundedTurn: turnNumber,
      isAutoNamed: true,
    });
    let newHh: Household = { ...freshHh, productionBuildingIds: newHhProductionBuildings };
    for (const fid of sonFamilyIds) {
      newHh = addToHousehold(newHh, fid);
    }

    // Determine roles in the new household
    const roleOverride = new Map<string, HouseholdRole>();
    roleOverride.set(son.id, 'head');
    for (const fid of sonFamilyIds) {
      if (fid === son.id) continue;
      const fp = people.get(fid);
      if (!fp) continue;
      if (fp.spouseIds.includes(son.id)) {
        roleOverride.set(fid, fp.householdRole === 'senior_wife' ? 'senior_wife' : 'wife');
      } else {
        roleOverride.set(fid, 'child');
      }
    }

    // Set seniorWifeId to first wife
    const firstWife = sonFamilyIds
      .map(fid => people.get(fid))
      .find((p): p is Person => p !== undefined && p.spouseIds.includes(son.id));
    if (firstWife) {
      newHh = { ...newHh, seniorWifeId: firstWife.id };
      roleOverride.set(firstWife.id, 'senior_wife');
    }

    // Apply name
    const mergedPeopleForName = new Map([...people, ...updatedPeople]);
    for (const fid of sonFamilyIds) {
      const fp = people.get(fid);
      if (fp) mergedPeopleForName.set(fid, { ...fp, householdId: newHh.id });
    }
    newHh = {
      ...newHh,
      name: deriveHouseholdName({ ...newHh, headId: son.id }, mergedPeopleForName),
    };

    newHouseholds.set(newHh.id, newHh);

    // Update person records
    for (const fid of sonFamilyIds) {
      const fp = updatedPeople.get(fid) ?? people.get(fid);
      if (fp) {
        updatedPeople.set(fid, {
          ...fp,
          householdId: newHh.id,
          householdRole: roleOverride.get(fid) ?? fp.householdRole,
        });
      }
    }

    logEntries.push({
      turn: turnNumber,
      type: 'household_formed',
      personId: son.id,
      description: `**${son.firstName}** split off to found ${newHh.name}.`,
    });
  }

  // Refresh continuing household name
  continuingHousehold = {
    ...continuingHousehold,
    name: deriveHouseholdName(
      continuingHousehold,
      new Map([...people, ...updatedPeople]),
    ),
  };
  updatedHouseholds.set(householdId, continuingHousehold);

  logEntries.push({
    turn: turnNumber,
    type: 'household_succession',
    personId: eldest.id,
    description: `**${eldest.firstName}** inherits ${continuingHousehold.name}.`,
  });

  return {
    updatedHouseholds,
    newHouseholds,
    dissolvedHouseholdIds: [],
    updatedPeople,
    logEntries,
    pendingSauromatianCouncilEvent: false,
  };
}

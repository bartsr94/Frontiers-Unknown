/**
 * Tests for applyDwellingClaims and findAvailableWorkerSlotIndex.
 *
 * Regression coverage for:
 *   Bug A — Player-built dwellings (ownerHouseholdId === null) were never
 *            claimed by homeless households. Only scheme-built buildings
 *            (ownerHouseholdId pre-set) went through the claim logic.
 *   Bug B — `person.claimedBuildingId` was never set; household.dwellingBuildingId
 *            was updated but the per-person field that happiness / PersonDetail
 *            actually read was always null.
 */

import { describe, it, expect } from 'vitest';
import { createRNG } from '../../src/utils/rng';
import { createPerson } from '../../src/simulation/population/person';
import {
  applyDwellingClaims,
  findAvailableWorkerSlotIndex,
} from '../../src/simulation/buildings/construction';
import type { BuiltBuilding } from '../../src/simulation/turn/game-state';
import type { Household } from '../../src/simulation/turn/game-state';
import type { Person } from '../../src/simulation/population/person';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeBuilding(
  defId: string,
  instanceId: string,
  ownerHouseholdId: string | null = null,
  assignedWorkerIds: string[] = [],
): BuiltBuilding {
  return {
    defId: defId as BuiltBuilding['defId'],
    instanceId,
    builtTurn: 1,
    style: null,
    claimedByPersonIds: [],
    ownerHouseholdId,
    assignedWorkerIds,
  };
}

function makeHousehold(
  id: string,
  memberIds: string[],
  dwellingBuildingId: string | null = null,
): Household {
  return {
    id,
    name: `House ${id}`,
    isAutoNamed: true,
    tradition: 'imanian',
    headId: memberIds[0] ?? null,
    seniorWifeId: null,
    memberIds,
    ashkaMelathiBonds: [],
    foundedTurn: 0,
    dwellingBuildingId,
    productionBuildingIds: [],
  };
}

const rng = createRNG(42);

function makePerson(id: string): Person {
  const p = createPerson({ sex: 'male', age: 25 }, rng);
  return { ...p, id, claimedBuildingId: null };
}

// ─── applyDwellingClaims — Pass 2 (Bug A regression) ─────────────────────────

describe('applyDwellingClaims — player-built dwelling (Pass 2)', () => {
  it('claims an unowned wattle_hut for the first homeless household', () => {
    // Bug A: player builds a wattle_hut; ownerHouseholdId is null; old code
    // never assigned it. Now Pass 2 should find it and assign it.
    const hut = makeBuilding('wattle_hut', 'wattle_hut_1', null);
    const person = makePerson('p1');
    const hh = makeHousehold('hh1', ['p1']);

    const { buildings, households } = applyDwellingClaims(
      [],                             // no newly-completed buildings
      [hut],
      new Map([['hh1', hh]]),
      new Map([['p1', person]]),
    );

    // Household should now have the dwelling
    expect(households.get('hh1')!.dwellingBuildingId).toBe('wattle_hut_1');
    // Building should be stamped with the household's ID
    const updatedHut = buildings.find(b => b.instanceId === 'wattle_hut_1')!;
    expect(updatedHut.ownerHouseholdId).toBe('hh1');
  });

  it('does not assign a dwelling that already has an ownerHouseholdId', () => {
    const hut = makeBuilding('wattle_hut', 'wattle_hut_1', 'existing_hh');
    const hh = makeHousehold('hh2', ['p2']);

    const { households } = applyDwellingClaims(
      [],
      [hut],
      new Map([['hh2', hh]]),
      new Map(),
    );

    // hh2 still has no dwelling — the hut already belonged to existing_hh
    expect(households.get('hh2')!.dwellingBuildingId).toBeNull();
  });

  it('assigns two dwellings to two different homeless households', () => {
    const hut1 = makeBuilding('wattle_hut', 'hut_1', null);
    const hut2 = makeBuilding('wattle_hut', 'hut_2', null);
    const hh1 = makeHousehold('hh1', ['p1']);
    const hh2 = makeHousehold('hh2', ['p2']);

    const { households } = applyDwellingClaims(
      [],
      [hut1, hut2],
      new Map([['hh1', hh1], ['hh2', hh2]]),
      new Map(),
    );

    const d1 = households.get('hh1')!.dwellingBuildingId;
    const d2 = households.get('hh2')!.dwellingBuildingId;
    // Both should have received a unique dwelling
    expect(d1).not.toBeNull();
    expect(d2).not.toBeNull();
    expect(d1).not.toBe(d2);
  });

  it('skips households that already have a dwelling', () => {
    // hh1 already has a dwelling (existing_building_id is standing);
    // hh2 is homeless and should receive the new hut.
    const existingHut = makeBuilding('wattle_hut', 'existing_building_id', 'hh1');
    const newHut      = makeBuilding('wattle_hut', 'hut_1', null);
    const hh1 = makeHousehold('hh1', ['p1'], 'existing_building_id');
    const hh2 = makeHousehold('hh2', ['p2'], null);

    const { households } = applyDwellingClaims(
      [],
      [existingHut, newHut],  // both buildings present in the settlement
      new Map([['hh1', hh1], ['hh2', hh2]]),
      new Map(),
    );

    // hh1 keeps its existing dwelling unchanged
    expect(households.get('hh1')!.dwellingBuildingId).toBe('existing_building_id');
    // hh2 receives the new hut
    expect(households.get('hh2')!.dwellingBuildingId).toBe('hut_1');
  });
});

// ─── applyDwellingClaims — Pass 3 (Bug B regression) ─────────────────────────

describe('applyDwellingClaims — person.claimedBuildingId (Pass 3)', () => {
  it('stamps claimedBuildingId on household members after Pass 2 claim', () => {
    // Bug B: household.dwellingBuildingId was set but person.claimedBuildingId
    // was never propagated. Happiness and PersonDetail read the per-person field.
    const hut = makeBuilding('wattle_hut', 'hut_1', null);
    const person = makePerson('p1');
    const hh = makeHousehold('hh1', ['p1']);

    const { people } = applyDwellingClaims(
      [],
      [hut],
      new Map([['hh1', hh]]),
      new Map([['p1', person]]),
    );

    expect(people.get('p1')!.claimedBuildingId).toBe('hut_1');
  });

  it('stamps claimedBuildingId when household already had a dwelling (Pass 1 path)', () => {
    // Household was scheme-built so already knows the dwelling; Pass 3 must
    // still propagate that to the person.
    const hut = makeBuilding('wattle_hut', 'hut_1', 'hh1');
    const person = makePerson('p1');
    const hh: Household = {
      ...makeHousehold('hh1', ['p1']),
      dwellingBuildingId: 'hut_1',  // already set by Pass 1 or pre-existing
    };

    const { people } = applyDwellingClaims(
      [],
      [hut],
      new Map([['hh1', hh]]),
      new Map([['p1', person]]),
    );

    expect(people.get('p1')!.claimedBuildingId).toBe('hut_1');
  });

  it('does not overwrite an existing claimedBuildingId', () => {
    // Person already claimed a building; Pass 3 must not clobber it.
    const hut = makeBuilding('wattle_hut', 'hut_new', 'hh1');
    const person: Person = { ...makePerson('p1'), claimedBuildingId: 'hut_old' };
    const hh: Household = {
      ...makeHousehold('hh1', ['p1']),
      dwellingBuildingId: 'hut_new',
    };

    const { people } = applyDwellingClaims(
      [],
      [hut],
      new Map([['hh1', hh]]),
      new Map([['p1', person]]),
    );

    // Existing claim preserved
    expect(people.get('p1')!.claimedBuildingId).toBe('hut_old');
  });

  it('stamps all members of a multi-person household', () => {
    const hut = makeBuilding('wattle_hut', 'hut_1', null);
    const p1 = makePerson('p1');
    const p2 = makePerson('p2');
    const hh = makeHousehold('hh1', ['p1', 'p2']);

    const { people } = applyDwellingClaims(
      [],
      [hut],
      new Map([['hh1', hh]]),
      new Map([['p1', p1], ['p2', p2]]),
    );

    expect(people.get('p1')!.claimedBuildingId).toBe('hut_1');
    expect(people.get('p2')!.claimedBuildingId).toBe('hut_1');
  });
});

// ─── applyDwellingClaims — Pass 1 (scheme-owned building) ────────────────────

describe('applyDwellingClaims — scheme-owned completed building (Pass 1)', () => {
  it('assigns a scheme-completed dwelling to its ownerHousehold via completedBuildings', () => {
    const justCompleted: BuiltBuilding = makeBuilding('wattle_hut', 'hut_scheme', 'hh1');
    const hh = makeHousehold('hh1', ['p1']);
    const person = makePerson('p1');

    const { households, people } = applyDwellingClaims(
      [justCompleted],               // Pass 1 input
      [justCompleted],               // also present in allBuildings
      new Map([['hh1', hh]]),
      new Map([['p1', person]]),
    );

    expect(households.get('hh1')!.dwellingBuildingId).toBe('hut_scheme');
    expect(people.get('p1')!.claimedBuildingId).toBe('hut_scheme');
  });
});

// ─── applyDwellingClaims — defensive guard (demolished dwelling) ──────────────

describe('applyDwellingClaims — demolished dwelling defensive guard', () => {
  it('clears household.dwellingBuildingId when the building is no longer in allBuildings', () => {
    // The household points to a demolished building (not in allBuildings).
    const person: Person = { ...makePerson('p1'), claimedBuildingId: 'demolished_hut' };
    const hh: Household = {
      ...makeHousehold('hh1', ['p1']),
      dwellingBuildingId: 'demolished_hut',
    };

    const { households, people } = applyDwellingClaims(
      [],
      [],   // demolished_hut is absent
      new Map([['hh1', hh]]),
      new Map([['p1', person]]),
    );

    expect(households.get('hh1')!.dwellingBuildingId).toBeNull();
    expect(people.get('p1')!.claimedBuildingId).toBeNull();
  });
});

// ─── findAvailableWorkerSlotIndex ─────────────────────────────────────────────

describe('findAvailableWorkerSlotIndex', () => {
  it('returns the index of a building with an available farmer slot', () => {
    const fields = makeBuilding('fields', 'fields_1');  // workerSlots:4, workerRole:'farmer'
    const buildings = [fields];

    const idx = findAvailableWorkerSlotIndex(buildings, 'farmer');
    expect(idx).toBe(0);
  });

  it('returns -1 when all farmer slots are taken (slot cap regression)', () => {
    // fields has workerSlots:4. Filling all 4 means a 5th assignment should
    // return -1 (the player cannot overflow the cap).
    const fields = makeBuilding('fields', 'fields_1', null, ['p1', 'p2', 'p3', 'p4']);
    const idx = findAvailableWorkerSlotIndex([fields], 'farmer');
    expect(idx).toBe(-1);
  });

  it('returns -1 when no building with that workerRole exists', () => {
    const camp = makeBuilding('camp', 'camp_0');
    const idx = findAvailableWorkerSlotIndex([camp], 'farmer');
    expect(idx).toBe(-1);
  });

  it('picks the first building with an open slot when multiple buildings present', () => {
    const fullFields   = makeBuilding('fields', 'fields_1', null, ['p1', 'p2', 'p3', 'p4']);
    const openFields   = makeBuilding('fields', 'fields_2', null, ['p1']);
    const buildings = [fullFields, openFields];

    const idx = findAvailableWorkerSlotIndex(buildings, 'farmer');
    expect(idx).toBe(1);  // first building at index 1 has an open slot
  });

  it('handles assignedWorkerIds: undefined on old-save buildings without crashing', () => {
    // Regression: old saves may not have assignedWorkerIds initialised.
    // The ?? [] guard in findAvailableWorkerSlotIndex must handle this.
    const oldFields = {
      ...makeBuilding('fields', 'fields_old'),
      assignedWorkerIds: undefined as unknown as string[],
    };

    expect(() => findAvailableWorkerSlotIndex([oldFields], 'farmer')).not.toThrow();
    expect(findAvailableWorkerSlotIndex([oldFields], 'farmer')).toBe(0);
  });
});

/**
 * Tests for household utility functions.
 *
 * Covers: createHousehold, addToHousehold, removeFromHousehold,
 * getHouseholdMembers, getHouseholdByPerson, getSeniorWife,
 * countWives, countConcubines, dissolveHousehold, hasHouseholdRole.
 */

import { describe, it, expect } from 'vitest';
import {
  createHousehold,
  addToHousehold,
  removeFromHousehold,
  getHouseholdMembers,
  getHouseholdByPerson,
  getSeniorWife,
  countWives,
  countConcubines,
  dissolveHousehold,
  hasHouseholdRole,
} from '../../src/simulation/population/household';
import type { GameState, Household } from '../../src/simulation/turn/game-state';
import type { Person, HouseholdRole } from '../../src/simulation/population/person';

// ─── Stubs ────────────────────────────────────────────────────────────────────

function makePerson(id: string, overrides: Partial<Person> = {}): Person {
  return {
    id,
    firstName: 'Test',
    familyName: 'Person',
    givenName: 'Test',
    sex: 'male',
    age: 30,
    isAlive: true,
    role: 'unassigned',
    socialStatus: 'free',
    spouseIds: [],
    childrenIds: [],
    motherId: null,
    fatherId: null,
    householdId: null,
    householdRole: null,
    ashkaMelathiPartnerIds: [],
    languages: [],
    heritage: {
      bloodline: [],
      primaryCulture: 'settlement_native',
      cultureWeights: {},
    },
    genetics: {
      visibleTraits: {
        skinTone: 0.4,
        hairColor: 'brown',
        hairTexture: 'straight',
        eyeColor: 'brown',
        build: 'medium',
        heightModifier: 0,
      },
      extendedFertility: false,
      genderRatioModifier: 0,
    },
    traits: [],
    skills: { animals: 25, bargaining: 25, combat: 25, custom: 25, leadership: 25, plants: 25 },
    relationships: new Map(),
    portraitVariant: 1,
    ...overrides,
  } as unknown as Person;
}

function makeHousehold(overrides: Partial<Household> = {}): Household {
  return createHousehold({
    name: 'Test Household',
    tradition: 'sauromatian',
    headId: null,
    seniorWifeId: null,
    foundedTurn: 1,
    ...overrides,
  });
}

function makeState(
  people: Person[],
  households: Household[],
): GameState {
  return {
    people: new Map(people.map(p => [p.id, p])),
    households: new Map(households.map(h => [h.id, h])),
  } as unknown as GameState;
}

// ─── createHousehold ──────────────────────────────────────────────────────────

describe('createHousehold', () => {
  it('produces an object with the provided fields and empty memberIds', () => {
    const h = createHousehold({
      name: 'Iron Ashkaran',
      tradition: 'sauromatian',
      headId: 'person-1',
      seniorWifeId: null,
      foundedTurn: 5,
    });
    expect(h.name).toBe('Iron Ashkaran');
    expect(h.tradition).toBe('sauromatian');
    expect(h.headId).toBe('person-1');
    expect(h.seniorWifeId).toBeNull();
    expect(h.foundedTurn).toBe(5);
    expect(h.memberIds).toEqual([]);
    expect(h.ashkaMelathiBonds).toEqual([]);
    expect(h.id).toBeTruthy();
  });

  it('assigns a unique id to each household', () => {
    const a = makeHousehold();
    const b = makeHousehold();
    expect(a.id).not.toBe(b.id);
  });
});

// ─── addToHousehold ───────────────────────────────────────────────────────────

describe('addToHousehold', () => {
  it('returns a new household with the person added to memberIds', () => {
    const h = makeHousehold();
    const result = addToHousehold(h, 'person-1');
    expect(result.memberIds).toContain('person-1');
    expect(h.memberIds).toHaveLength(0); // original unchanged
  });

  it('is idempotent — adding the same id twice does not duplicate', () => {
    const h = addToHousehold(makeHousehold(), 'person-1');
    const result = addToHousehold(h, 'person-1');
    expect(result.memberIds).toHaveLength(1);
  });

  it('preserves all other household fields', () => {
    const h = makeHousehold({ headId: 'head-1' } as Partial<Household>);
    const result = addToHousehold(h, 'member-1');
    expect(result.headId).toBe(h.headId);
    expect(result.name).toBe(h.name);
  });
});

// ─── removeFromHousehold ──────────────────────────────────────────────────────

describe('removeFromHousehold', () => {
  it('removes the specified person from memberIds', () => {
    let h = makeHousehold();
    h = addToHousehold(addToHousehold(h, 'person-1'), 'person-2');
    const result = removeFromHousehold(h, 'person-1');
    expect(result.memberIds).not.toContain('person-1');
    expect(result.memberIds).toContain('person-2');
  });

  it('clears headId when the head is removed', () => {
    let h: Household = { ...makeHousehold(), headId: 'person-1' };
    h = addToHousehold(h, 'person-1');
    const result = removeFromHousehold(h, 'person-1');
    expect(result.headId).toBeNull();
  });

  it('clears seniorWifeId when the senior wife is removed', () => {
    let h: Household = { ...makeHousehold(), seniorWifeId: 'person-2' };
    h = addToHousehold(h, 'person-2');
    const result = removeFromHousehold(h, 'person-2');
    expect(result.seniorWifeId).toBeNull();
  });

  it('removes Ashka-Melathi bonds involving the removed person', () => {
    let h = makeHousehold();
    h = { ...h, ashkaMelathiBonds: [['person-1', 'person-2'], ['person-3', 'person-4']] };
    const result = removeFromHousehold(h, 'person-1');
    expect(result.ashkaMelathiBonds).toEqual([['person-3', 'person-4']]);
  });

  it('is a no-op for unknown ids', () => {
    const h = addToHousehold(makeHousehold(), 'person-1');
    const result = removeFromHousehold(h, 'nonexistent');
    expect(result.memberIds).toHaveLength(1);
  });
});

// ─── getHouseholdMembers ──────────────────────────────────────────────────────

describe('getHouseholdMembers', () => {
  it('returns all live persons whose ids are in memberIds', () => {
    const p1 = makePerson('p1');
    const p2 = makePerson('p2');
    let h = makeHousehold();
    h = addToHousehold(addToHousehold(h, 'p1'), 'p2');
    const state = makeState([p1, p2], [h]);
    const members = getHouseholdMembers(h.id, state);
    expect(members.map(p => p.id).sort()).toEqual(['p1', 'p2']);
  });

  it('silently skips ids not present in state.people', () => {
    const p1 = makePerson('p1');
    let h = makeHousehold();
    h = addToHousehold(addToHousehold(h, 'p1'), 'ghost');
    const state = makeState([p1], [h]);
    const members = getHouseholdMembers(h.id, state);
    expect(members).toHaveLength(1);
  });

  it('returns empty array for unknown household id', () => {
    const state = makeState([], []);
    expect(getHouseholdMembers('no-such-id', state)).toEqual([]);
  });
});

// ─── getHouseholdByPerson ─────────────────────────────────────────────────────

describe('getHouseholdByPerson', () => {
  it('returns the household containing the given person', () => {
    let h = makeHousehold();
    h = addToHousehold(h, 'p1');
    const state = makeState([makePerson('p1')], [h]);
    expect(getHouseholdByPerson('p1', state)?.id).toBe(h.id);
  });

  it('returns null for someone not in any household', () => {
    const state = makeState([makePerson('lone')], []);
    expect(getHouseholdByPerson('lone', state)).toBeNull();
  });
});

// ─── getSeniorWife ────────────────────────────────────────────────────────────

describe('getSeniorWife', () => {
  it('returns the designated seniorWifeId person if present', () => {
    const designated = makePerson('sw', { householdRole: 'senior_wife' as HouseholdRole, age: 25 });
    let h: Household = { ...makeHousehold(), seniorWifeId: 'sw' };
    h = addToHousehold(h, 'sw');
    const state = makeState([designated], [h]);
    expect(getSeniorWife(h, state)?.id).toBe('sw');
  });

  it('falls back to oldest member with role senior_wife when designation missing', () => {
    const older = makePerson('sw-old', { householdRole: 'senior_wife' as HouseholdRole, age: 40 });
    const younger = makePerson('sw-young', { householdRole: 'senior_wife' as HouseholdRole, age: 20 });
    let h = makeHousehold();
    h = addToHousehold(addToHousehold(h, 'sw-old'), 'sw-young');
    const state = makeState([older, younger], [h]);
    expect(getSeniorWife(h, state)?.id).toBe('sw-old');
  });

  it('falls back to a wife when no senior_wife role found', () => {
    const wife = makePerson('wife-1', { householdRole: 'wife' as HouseholdRole, age: 30 });
    let h = makeHousehold();
    h = addToHousehold(h, 'wife-1');
    const state = makeState([wife], [h]);
    expect(getSeniorWife(h, state)?.id).toBe('wife-1');
  });

  it('returns null when no wives exist', () => {
    const head = makePerson('head', { householdRole: 'head' as HouseholdRole });
    let h = makeHousehold();
    h = addToHousehold(h, 'head');
    const state = makeState([head], [h]);
    expect(getSeniorWife(h, state)).toBeNull();
  });
});

// ─── countWives ───────────────────────────────────────────────────────────────

describe('countWives', () => {
  it('counts senior_wife and wife roles', () => {
    const sw = makePerson('sw', { householdRole: 'senior_wife' as HouseholdRole });
    const w  = makePerson('w',  { householdRole: 'wife' as HouseholdRole });
    const c  = makePerson('c',  { householdRole: 'concubine' as HouseholdRole });
    let h = makeHousehold();
    h = addToHousehold(addToHousehold(addToHousehold(h, 'sw'), 'w'), 'c');
    const state = makeState([sw, w, c], [h]);
    expect(countWives(h, state)).toBe(2);
  });

  it('returns 0 for a household with only a head', () => {
    const head = makePerson('head', { householdRole: 'head' as HouseholdRole });
    let h = makeHousehold();
    h = addToHousehold(h, 'head');
    const state = makeState([head], [h]);
    expect(countWives(h, state)).toBe(0);
  });
});

// ─── countConcubines ──────────────────────────────────────────────────────────

describe('countConcubines', () => {
  it('counts concubine and hearth_companion roles', () => {
    const c1 = makePerson('c1', { householdRole: 'concubine' as HouseholdRole });
    const c2 = makePerson('c2', { householdRole: 'hearth_companion' as HouseholdRole });
    const w  = makePerson('w',  { householdRole: 'wife' as HouseholdRole });
    let h = makeHousehold();
    h = addToHousehold(addToHousehold(addToHousehold(h, 'c1'), 'c2'), 'w');
    const state = makeState([c1, c2, w], [h]);
    expect(countConcubines(h, state)).toBe(2);
  });
});

// ─── dissolveHousehold ────────────────────────────────────────────────────────

describe('dissolveHousehold', () => {
  it('removes the household from state.households', () => {
    const p = makePerson('p1', { householdId: 'hh-id', householdRole: 'head' as HouseholdRole });
    let h = makeHousehold();
    h = { ...h, id: 'hh-id' };
    h = addToHousehold(h, 'p1');
    const state = makeState([p], [h]);
    const newState = dissolveHousehold('hh-id', state);
    expect(newState.households.has('hh-id')).toBe(false);
  });

  it('clears householdId and householdRole on all members', () => {
    const p1 = makePerson('p1', { householdId: 'hh-id', householdRole: 'head' as HouseholdRole });
    const p2 = makePerson('p2', { householdId: 'hh-id', householdRole: 'wife' as HouseholdRole });
    let h = makeHousehold();
    h = { ...h, id: 'hh-id' };
    h = addToHousehold(addToHousehold(h, 'p1'), 'p2');
    const state = makeState([p1, p2], [h]);
    const newState = dissolveHousehold('hh-id', state);
    expect(newState.people.get('p1')?.householdId).toBeNull();
    expect(newState.people.get('p1')?.householdRole).toBeNull();
    expect(newState.people.get('p2')?.householdId).toBeNull();
  });

  it('clears ashkaMelathiPartnerIds on members', () => {
    const p1 = makePerson('p1', { householdId: 'hh-id', ashkaMelathiPartnerIds: ['p2'] });
    const p2 = makePerson('p2', { householdId: 'hh-id', ashkaMelathiPartnerIds: ['p1'] });
    let h = makeHousehold();
    h = { ...h, id: 'hh-id' };
    h = addToHousehold(addToHousehold(h, 'p1'), 'p2');
    const state = makeState([p1, p2], [h]);
    const newState = dissolveHousehold('hh-id', state);
    expect(newState.people.get('p1')?.ashkaMelathiPartnerIds).toEqual([]);
  });

  it('is a no-op for unknown household ids', () => {
    const state = makeState([], []);
    const newState = dissolveHousehold('no-such-id', state);
    expect(newState).toBe(state); // same reference
  });
});

// ─── hasHouseholdRole ─────────────────────────────────────────────────────────

describe('hasHouseholdRole', () => {
  it('returns true when person holds the given role', () => {
    const p = makePerson('p', { householdRole: 'senior_wife' as HouseholdRole });
    expect(hasHouseholdRole(p as Person, 'senior_wife')).toBe(true);
  });

  it('returns false when person holds a different role', () => {
    const p = makePerson('p', { householdRole: 'wife' as HouseholdRole });
    expect(hasHouseholdRole(p as Person, 'head')).toBe(false);
  });

  it('returns false when person has no household role', () => {
    const p = makePerson('p', { householdRole: null });
    expect(hasHouseholdRole(p as Person, 'wife')).toBe(false);
  });
});

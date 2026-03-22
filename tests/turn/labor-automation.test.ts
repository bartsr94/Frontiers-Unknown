import { describe, it, expect } from 'vitest';
import {
  promoteForagersToFarmers,
  diversifyLaborFromFoodSurplus,
} from '../../src/simulation/turn/turn-processor';
import type { Person, WorkRole } from '../../src/simulation/population/person';
import type { BuiltBuilding } from '../../src/simulation/turn/game-state';

function makePerson(
  id: string,
  role: WorkRole,
  overrides: Partial<Pick<Person, 'age' | 'socialStatus' | 'skills'>> = {},
): Person {
  return {
    id,
    role,
    age: overrides.age ?? 25,
    socialStatus: overrides.socialStatus ?? 'settler',
    skills: overrides.skills ?? {
      animals: 25,
      bargaining: 25,
      combat: 25,
      custom: 25,
      leadership: 25,
      plants: 25,
    },
  } as unknown as Person;
}

function makeFields(instanceId: string): BuiltBuilding {
  return {
    defId: 'fields',
    instanceId,
    builtTurn: 1,
    style: null,
    claimedByPersonIds: [],
    ownerHouseholdId: null,
    assignedWorkerIds: [],
  };
}

describe('promoteForagersToFarmers', () => {
  it('returns no promotions when no Fields building exists', () => {
    const people = new Map([['p1', makePerson('p1', 'gather_food')]]);
    expect(promoteForagersToFarmers(people, [])).toEqual([]);
  });

  it('returns no promotions when current farmers already fill all field slots', () => {
    const people = new Map([
      ['f1', makePerson('f1', 'farmer')],
      ['f2', makePerson('f2', 'farmer')],
      ['f3', makePerson('f3', 'farmer')],
      ['f4', makePerson('f4', 'farmer')],
      ['g1', makePerson('g1', 'gather_food')],
    ]);
    expect(promoteForagersToFarmers(people, [makeFields('fields_0')])).toEqual([]);
  });

  it('respects the 45% adult farmer workforce cap even when field capacity remains', () => {
    const people = new Map<string, Person>([
      ['f1', makePerson('f1', 'farmer')],
      ['f2', makePerson('f2', 'farmer')],
      ['f3', makePerson('f3', 'farmer')],
      ['f4', makePerson('f4', 'farmer')],
      ['g1', makePerson('g1', 'gather_food')],
      ['g2', makePerson('g2', 'gather_food')],
      ['g3', makePerson('g3', 'gather_food')],
      ['g4', makePerson('g4', 'gather_food')],
      ['g5', makePerson('g5', 'gather_food')],
      ['g6', makePerson('g6', 'gather_food')],
      ['g7', makePerson('g7', 'gather_food')],
    ]);

    expect(promoteForagersToFarmers(people, [makeFields('fields_0'), makeFields('fields_1')])).toEqual([]);
  });

  it('promotes the eligible gather_food worker with the highest plants skill', () => {
    const people = new Map<string, Person>([
      ['p1', makePerson('p1', 'gather_food', { skills: { animals: 25, bargaining: 25, combat: 25, custom: 25, leadership: 25, plants: 18 } })],
      ['p2', makePerson('p2', 'gather_food', { skills: { animals: 25, bargaining: 25, combat: 25, custom: 25, leadership: 25, plants: 41 } })],
      ['p3', makePerson('p3', 'gather_food', { skills: { animals: 25, bargaining: 25, combat: 25, custom: 25, leadership: 25, plants: 27 } })],
    ]);

    expect(promoteForagersToFarmers(people, [makeFields('fields_0')])).toEqual([
      { personId: 'p2', role: 'farmer' },
    ]);
  });

  it('ignores ineligible candidates such as thralls and children', () => {
    const people = new Map<string, Person>([
      ['thrall', makePerson('thrall', 'gather_food', { socialStatus: 'thrall', skills: { animals: 25, bargaining: 25, combat: 25, custom: 25, leadership: 25, plants: 60 } })],
      ['child', makePerson('child', 'gather_food', { age: 12, skills: { animals: 25, bargaining: 25, combat: 25, custom: 25, leadership: 25, plants: 55 } })],
      ['adult', makePerson('adult', 'gather_food', { skills: { animals: 25, bargaining: 25, combat: 25, custom: 25, leadership: 25, plants: 30 } })],
      ['adult2', makePerson('adult2', 'gather_food', { skills: { animals: 25, bargaining: 25, combat: 25, custom: 25, leadership: 25, plants: 20 } })],
      ['adult3', makePerson('adult3', 'gather_food', { skills: { animals: 25, bargaining: 25, combat: 25, custom: 25, leadership: 25, plants: 15 } })],
    ]);

    expect(promoteForagersToFarmers(people, [makeFields('fields_0')])).toEqual([
      { personId: 'adult', role: 'farmer' },
    ]);
  });
});

describe('diversifyLaborFromFoodSurplus', () => {
  it('returns no changes when the settlement has no people', () => {
    expect(diversifyLaborFromFoodSurplus(new Map(), 0)).toEqual([]);
  });

  it('returns no changes when food is below the four-season surplus threshold', () => {
    const people = new Map([
      ['p1', makePerson('p1', 'farmer')],
      ['p2', makePerson('p2', 'gather_food')],
    ]);
    expect(diversifyLaborFromFoodSurplus(people, 7)).toEqual([]);
  });

  it('reassigns up to one worker each to lumber and stone under surplus conditions', () => {
    const people = new Map<string, Person>([
      ['a', makePerson('a', 'farmer', { skills: { animals: 25, bargaining: 25, combat: 25, custom: 60, leadership: 25, plants: 25 } })],
      ['b', makePerson('b', 'farmer', { skills: { animals: 25, bargaining: 25, combat: 25, custom: 50, leadership: 25, plants: 25 } })],
      ['c', makePerson('c', 'gather_food', { skills: { animals: 25, bargaining: 25, combat: 25, custom: 45, leadership: 25, plants: 25 } })],
      ['d', makePerson('d', 'gather_food', { skills: { animals: 25, bargaining: 25, combat: 25, custom: 35, leadership: 25, plants: 25 } })],
    ]);

    expect(diversifyLaborFromFoodSurplus(people, 16)).toEqual([
      { personId: 'a', role: 'gather_lumber' },
      { personId: 'b', role: 'gather_stone' },
    ]);
  });

  it('does not add a lumberjack when lumber workers are already at the per-role cap', () => {
    const people = new Map<string, Person>([
      ['l1', makePerson('l1', 'gather_lumber')],
      ['l2', makePerson('l2', 'gather_lumber')],
      ['f1', makePerson('f1', 'farmer', { skills: { animals: 25, bargaining: 25, combat: 25, custom: 55, leadership: 25, plants: 25 } })],
      ['f2', makePerson('f2', 'farmer', { skills: { animals: 25, bargaining: 25, combat: 25, custom: 45, leadership: 25, plants: 25 } })],
      ['f3', makePerson('f3', 'gather_food', { skills: { animals: 25, bargaining: 25, combat: 25, custom: 35, leadership: 25, plants: 25 } })],
      ['f4', makePerson('f4', 'gather_food', { skills: { animals: 25, bargaining: 25, combat: 25, custom: 30, leadership: 25, plants: 25 } })],
      ['f5', makePerson('f5', 'gather_food')],
      ['f6', makePerson('f6', 'gather_food')],
      ['f7', makePerson('f7', 'gather_food')],
      ['f8', makePerson('f8', 'gather_food')],
    ]);

    expect(diversifyLaborFromFoodSurplus(people, 40)).toEqual([
      { personId: 'f1', role: 'gather_stone' },
    ]);
  });

  it('ignores thralls and children when choosing reassignment candidates', () => {
    const people = new Map<string, Person>([
      ['thrall', makePerson('thrall', 'farmer', { socialStatus: 'thrall', skills: { animals: 25, bargaining: 25, combat: 25, custom: 80, leadership: 25, plants: 25 } })],
      ['child', makePerson('child', 'gather_food', { age: 12, skills: { animals: 25, bargaining: 25, combat: 25, custom: 70, leadership: 25, plants: 25 } })],
      ['adultA', makePerson('adultA', 'farmer', { skills: { animals: 25, bargaining: 25, combat: 25, custom: 50, leadership: 25, plants: 25 } })],
      ['adultB', makePerson('adultB', 'gather_food', { skills: { animals: 25, bargaining: 25, combat: 25, custom: 45, leadership: 25, plants: 25 } })],
    ]);

    expect(diversifyLaborFromFoodSurplus(people, 16)).toEqual([
      { personId: 'adultA', role: 'gather_lumber' },
      { personId: 'adultB', role: 'gather_stone' },
    ]);
  });
});
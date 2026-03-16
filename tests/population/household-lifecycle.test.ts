/**
 * Tests for the household lifecycle system.
 *
 * Covers: initializeHouseholds, ensurePersonHousehold, assignChildToHousehold,
 * mergeHouseholds, processHouseholdSuccession, pruneOrphanedHouseholds, deriveHouseholdName.
 *
 * Design doc: plans/HOUSEHOLD_LIFECYCLE.md
 */

import { describe, it, expect } from 'vitest';
import {
  createHousehold,
  addToHousehold,
  initializeHouseholds,
  ensurePersonHousehold,
  assignChildToHousehold,
  mergeHouseholds,
  processHouseholdSuccession,
  pruneOrphanedHouseholds,
  deriveHouseholdName,
} from '../../src/simulation/population/household';
import type { Household } from '../../src/simulation/turn/game-state';
import type { Person } from '../../src/simulation/population/person';

// ─── Test helpers ─────────────────────────────────────────────────────────────

let _idCounter = 0;
function uid(): string { return `p${++_idCounter}`; }

function makePerson(id: string, overrides: Partial<Person> = {}): Person {
  return {
    id,
    firstName: `First_${id}`,
    familyName: `Family_${id}`,
    givenName: `First_${id}`,
    sex: 'male',
    age: 30,
    isAlive: true,
    role: 'unassigned',
    socialStatus: 'free',
    spouseIds: [],
    childrenIds: [],
    parentIds: [null, null],
    householdId: null,
    householdRole: null,
    ashkaMelathiPartnerIds: [],
    languages: [],
    heritage: {
      bloodline: [],
      primaryCulture: 'settlement_native',
      culturalFluency: new Map(),
    },
    genetics: {
      visibleTraits: {
        skinTone: 0.4,
        hairColor: 'brown',
        hairTexture: 'straight',
        eyeColor: 'brown',
        buildType: 'medium',
        height: 'average',
        facialStructure: 'oval',
        skinUndertone: 'neutral',
      },
      extendedFertility: false,
      genderRatioModifier: 0,
    },
    traits: [],
    traitExpiry: {},
    skills: { animals: 25, bargaining: 25, combat: 25, custom: 25, leadership: 25, plants: 25 },
    relationships: new Map(),
    opinionModifiers: [],
    opinionSustainedSince: {},
    portraitVariant: 1,
    ambition: null,
    activeScheme: null,
    namedRelationships: [],
    health: { currentHealth: 100 },
    lowHappinessTurns: 0,
    ...overrides,
  } as unknown as Person;
}

function makeHousehold(overrides: Partial<Household> = {}): Household {
  return {
    ...createHousehold({
      name: 'Test',
      tradition: 'imanian',
      headId: null,
      seniorWifeId: null,
      foundedTurn: 0,
    }),
    ...overrides,
  };
}

// ─── deriveHouseholdName ──────────────────────────────────────────────────────

describe('deriveHouseholdName', () => {
  it('returns existing name when isAutoNamed is false', () => {
    const p = makePerson('p1', { sex: 'male', familyName: 'Orsthal' });
    const hh = makeHousehold({ name: 'Custom Name', headId: 'p1', isAutoNamed: false });
    expect(deriveHouseholdName(hh, new Map([['p1', p]]))).toBe('Custom Name');
  });

  it('single male head → "House of {familyName}"', () => {
    const p = makePerson('p1', { sex: 'male', familyName: 'Orsthal' });
    const hh = makeHousehold({ headId: 'p1', seniorWifeId: null, isAutoNamed: true, tradition: 'imanian' });
    expect(deriveHouseholdName(hh, new Map([['p1', p]]))).toBe('House of Orsthal');
  });

  it('single male head falls back to firstName when no familyName', () => {
    const p = makePerson('p1', { sex: 'male', firstName: 'Brendan', familyName: undefined });
    const hh = makeHousehold({ headId: 'p1', seniorWifeId: null, isAutoNamed: true, tradition: 'imanian' });
    expect(deriveHouseholdName(hh, new Map([['p1', p]]))).toBe('House of Brendan');
  });

  it('sauromatian with senior wife → "{familyName} Ashkaran"', () => {
    const w = makePerson('w1', { sex: 'female', familyName: 'Kethara' });
    const hh = makeHousehold({
      headId: null,
      seniorWifeId: 'w1',
      isAutoNamed: true,
      tradition: 'sauromatian',
    });
    expect(deriveHouseholdName(hh, new Map([['w1', w]]))).toBe('Kethara Ashkaran');
  });

  it('widow-led (no head, no senior wife) → "Household of {firstName}"', () => {
    const w = makePerson('w1', { sex: 'female', firstName: 'Mira' });
    let hh = makeHousehold({ headId: null, seniorWifeId: null, isAutoNamed: true, tradition: 'imanian' });
    hh = addToHousehold(hh, 'w1');
    expect(deriveHouseholdName(hh, new Map([['w1', w]]))).toBe('Household of Mira');
  });
});

// ─── initializeHouseholds ─────────────────────────────────────────────────────

describe('initializeHouseholds', () => {
  it('creates one household per unattached person', () => {
    const a = makePerson(uid());
    const b = makePerson(uid(), { sex: 'female' });
    const people = new Map([[a.id, a], [b.id, b]]);

    const { updatedPeople, newHouseholds } = initializeHouseholds(people, 0);

    expect(newHouseholds.size).toBe(2);
    const pA = updatedPeople.get(a.id)!;
    const pB = updatedPeople.get(b.id)!;
    expect(pA.householdId).toBeTruthy();
    expect(pB.householdId).toBeTruthy();
    expect(pA.householdId).not.toBe(pB.householdId);
  });

  it('skips persons who already have a householdId', () => {
    const hh = makeHousehold();
    const a = makePerson(uid(), { householdId: hh.id, householdRole: 'head' });
    const b = makePerson(uid());
    const people = new Map([[a.id, a], [b.id, b]]);

    const { newHouseholds } = initializeHouseholds(people, 0);

    // Only b gets a new household
    expect(newHouseholds.size).toBe(1);
  });

  it('is idempotent: running twice creates no duplicates', () => {
    const a = makePerson(uid());
    const people = new Map([[a.id, a]]);

    const first = initializeHouseholds(people, 0);
    const second = initializeHouseholds(first.updatedPeople, 0);

    // No new households on the second pass
    expect(second.newHouseholds.size).toBe(0);
  });

  it('assigns the male person as head (imanian tradition)', () => {
    const m = makePerson(uid(), { sex: 'male', heritage: { bloodline: [], primaryCulture: 'ansberite', culturalFluency: new Map() } as Person['heritage'] });
    const { updatedPeople, newHouseholds } = initializeHouseholds(new Map([[m.id, m]]), 0);
    const p = updatedPeople.get(m.id)!;
    const hh = newHouseholds.get(p.householdId!)!;
    expect(p.householdRole).toBe('head');
    expect(hh.headId).toBe(m.id);
  });

  it('assigns the female person as senior_wife', () => {
    const f = makePerson(uid(), { sex: 'female' });
    const { updatedPeople, newHouseholds } = initializeHouseholds(new Map([[f.id, f]]), 0);
    const p = updatedPeople.get(f.id)!;
    const hh = newHouseholds.get(p.householdId!)!;
    expect(p.householdRole).toBe('senior_wife');
    expect(hh.seniorWifeId).toBe(f.id);
  });
});

// ─── ensurePersonHousehold ────────────────────────────────────────────────────

describe('ensurePersonHousehold', () => {
  it('creates a household when the person has none', () => {
    const p = makePerson(uid());
    const { updatedPerson, newHousehold } = ensurePersonHousehold(p, new Map(), 0);
    expect(newHousehold).not.toBeNull();
    expect(updatedPerson.householdId).toBe(newHousehold!.id);
  });

  it('is a no-op when the person is already in a household', () => {
    const hh = makeHousehold();
    const p = makePerson(uid(), { householdId: hh.id, householdRole: 'head' });
    const { newHousehold } = ensurePersonHousehold(p, new Map([[hh.id, hh]]), 0);
    expect(newHousehold).toBeNull();
  });
});

// ─── assignChildToHousehold ───────────────────────────────────────────────────

describe('assignChildToHousehold', () => {
  it('assigns child to father\'s household when father has one', () => {
    const hh = makeHousehold({ headId: 'dad' });
    const hhWithDad = addToHousehold(hh, 'dad');
    const father = makePerson('dad', { householdId: hhWithDad.id });
    const mother = makePerson('mom', { sex: 'female', householdId: hhWithDad.id });
    const child = makePerson(uid(), { age: 0 });

    const people = new Map([['dad', father], ['mom', mother], [child.id, child]]);
    const households = new Map([[hhWithDad.id, hhWithDad]]);

    assignChildToHousehold(child, mother, father, people, households, 0);

    const updatedChild = people.get(child.id)!;
    expect(updatedChild.householdId).toBe(hhWithDad.id);
    expect(updatedChild.householdRole).toBe('child');
    expect(households.get(hhWithDad.id)!.memberIds).toContain(child.id);
  });

  it('assigns child to mother\'s household when father is absent', () => {
    const hh = makeHousehold({ seniorWifeId: 'mom' });
    const hhWithMom = addToHousehold(hh, 'mom');
    const mother = makePerson('mom', { sex: 'female', householdId: hhWithMom.id });
    const child = makePerson(uid(), { age: 0 });

    const people = new Map([['mom', mother], [child.id, child]]);
    const households = new Map([[hhWithMom.id, hhWithMom]]);

    assignChildToHousehold(child, mother, undefined, people, households, 0);

    const updatedChild = people.get(child.id)!;
    expect(updatedChild.householdId).toBe(hhWithMom.id);
    expect(updatedChild.householdRole).toBe('child');
  });
});

// ─── mergeHouseholds ─────────────────────────────────────────────────────────

describe('mergeHouseholds', () => {
  it('moves all source members into the destination', () => {
    const man = makePerson('man', { householdId: 'dest', householdRole: 'head' });
    const woman = makePerson('woman', { sex: 'female', householdId: 'src', householdRole: 'senior_wife' });

    let dest = makeHousehold({ id: 'dest', headId: 'man' } as Partial<Household>);
    dest = addToHousehold(dest, 'man');
    let src = makeHousehold({ id: 'src', seniorWifeId: 'woman' } as Partial<Household>);
    src = addToHousehold(src, 'woman');

    const people = new Map([['man', man], ['woman', woman]]);
    const households = new Map([['dest', dest], ['src', src]]);

    const { updatedPeople, updatedHouseholds, dissolvedHouseholdId } =
      mergeHouseholds('dest', 'src', households, people);

    // Woman now belongs to dest
    expect(updatedPeople.get('woman')!.householdId).toBe('dest');
    // Dest now contains both members
    expect(updatedHouseholds.get('dest')!.memberIds).toContain('man');
    expect(updatedHouseholds.get('dest')!.memberIds).toContain('woman');
    // Source is gone
    expect(updatedHouseholds.has('src')).toBe(false);
    expect(dissolvedHouseholdId).toBe('src');
  });

  it('carries over Ashka-Melathi bonds from source', () => {
    const a = makePerson('a', { sex: 'female', householdId: 'src' });
    const b = makePerson('b', { sex: 'female', householdId: 'src' });
    let src = makeHousehold({ id: 'src' } as Partial<Household>);
    src = { ...addToHousehold(addToHousehold(src, 'a'), 'b'), ashkaMelathiBonds: [['a', 'b']] };
    let dest = makeHousehold({ id: 'dest' } as Partial<Household>);

    const { updatedHouseholds } = mergeHouseholds(
      'dest', 'src',
      new Map([['dest', dest], ['src', src]]),
      new Map([['a', a], ['b', b]]),
    );
    expect(updatedHouseholds.get('dest')!.ashkaMelathiBonds).toContainEqual(['a', 'b']);
  });

  it('handles missing dest or source gracefully', () => {
    const man = makePerson('man', { householdId: 'dest' });
    const { updatedHouseholds } = mergeHouseholds(
      'dest', 'nonexistent',
      new Map([['dest', makeHousehold({ id: 'dest' } as Partial<Household>)]]),
      new Map([['man', man]]),
    );
    // Should not crash; dest unchanged
    expect(updatedHouseholds.has('dest')).toBe(true);
  });
});

// ─── pruneOrphanedHouseholds ──────────────────────────────────────────────────

describe('pruneOrphanedHouseholds', () => {
  it('dissolves a household whose only member has died', () => {
    let hh = makeHousehold({ id: 'hh1' } as Partial<Household>);
    hh = addToHousehold(hh, 'dead_person');

    // dead_person is NOT in the living people map
    const { dissolvedIds, updatedHouseholds } = pruneOrphanedHouseholds(
      new Map([['hh1', hh]]),
      new Map(), // no living people
    );

    expect(dissolvedIds).toContain('hh1');
    expect(updatedHouseholds.has('hh1')).toBe(false);
  });

  it('keeps a household with at least one living member', () => {
    const alive = makePerson('alive');
    let hh = makeHousehold({ id: 'hh1' } as Partial<Household>);
    hh = addToHousehold(hh, 'alive');

    const { dissolvedIds } = pruneOrphanedHouseholds(
      new Map([['hh1', hh]]),
      new Map([['alive', alive]]),
    );

    expect(dissolvedIds).not.toContain('hh1');
  });

  it('prunes dead member IDs from member lists but keeps living members', () => {
    const alive = makePerson('alive');
    let hh = makeHousehold({ id: 'hh1' } as Partial<Household>);
    hh = addToHousehold(addToHousehold(hh, 'alive'), 'dead');

    const { updatedHouseholds, dissolvedIds } = pruneOrphanedHouseholds(
      new Map([['hh1', hh]]),
      new Map([['alive', alive]]),
    );

    expect(dissolvedIds).not.toContain('hh1'); // not fully dissolved
    expect(updatedHouseholds.get('hh1')!.memberIds).toContain('alive');
    expect(updatedHouseholds.get('hh1')!.memberIds).not.toContain('dead');
  });

  it('clears householdId on persons still pointing at dissolved households', () => {
    // Create a person pointing to a household that has no living members
    const ghost = makePerson('ghost', { householdId: 'hh1', householdRole: 'head' });
    let hh = makeHousehold({ id: 'hh1' } as Partial<Household>);
    hh = addToHousehold(hh, 'truly_dead'); // 'ghost' itself is not in memberIds

    // Neither 'truly_dead' nor 'ghost' is alive → household dissolves
    const { updatedPeople, dissolvedIds } = pruneOrphanedHouseholds(
      new Map([['hh1', hh]]),
      new Map([['ghost', ghost]]), // ghost is "alive" but points to a dissolved hh
    );

    expect(dissolvedIds).toContain('hh1');
    const updatedGhost = updatedPeople.get('ghost');
    if (updatedGhost) {
      // If ghost's householdId pointed to the dissolved hh, it should be cleared
      expect(updatedGhost.householdId).toBeNull();
    }
  });
});

// ─── processHouseholdSuccession ───────────────────────────────────────────────

function buildImanianHousehold(
  headId: string,
  memberIds: string[],
  production: string[] = [],
): Household {
  let hh = createHousehold({
    name: 'Test House',
    tradition: 'imanian',
    headId,
    seniorWifeId: null,
    foundedTurn: 0,
  });
  for (const mid of memberIds) hh = addToHousehold(hh, mid);
  return { ...hh, productionBuildingIds: production };
}

describe('processHouseholdSuccession — Imanian', () => {
  it('eldest adult son becomes head when head dies', () => {
    const deadHead = makePerson('dad', { sex: 'male', age: 65 });
    const son1 = makePerson('son1', { sex: 'male', age: 35, parentIds: ['dad', null] });

    const hh = buildImanianHousehold('dad', ['dad', 'son1']);
    const people = new Map([['dad', deadHead], ['son1', son1]]);
    const households = new Map([[hh.id, hh]]);

    const result = processHouseholdSuccession(hh.id, 'dad', households, people, 10);

    const continuingHh = result.updatedHouseholds.get(hh.id);
    expect(continuingHh?.headId).toBe('son1');
    expect(result.updatedPeople.get('son1')?.householdRole).toBe('head');
    expect(result.newHouseholds.size).toBe(0); // only one son → no split
  });

  it('second adult son splits off into a new household', () => {
    const deadHead = makePerson('dad', { sex: 'male', age: 65 });
    const son1 = makePerson('son1', { sex: 'male', age: 35, parentIds: ['dad', null] });
    const son2 = makePerson('son2', { sex: 'male', age: 28, parentIds: ['dad', null] });

    const hh = buildImanianHousehold('dad', ['dad', 'son1', 'son2']);
    const people = new Map([['dad', deadHead], ['son1', son1], ['son2', son2]]);
    const households = new Map([[hh.id, hh]]);

    const result = processHouseholdSuccession(hh.id, 'dad', households, people, 10);

    // son1 (eldest) stays and becomes head
    expect(result.updatedHouseholds.get(hh.id)?.headId).toBe('son1');
    // son2 splits into own household
    expect(result.newHouseholds.size).toBe(1);
    const splitHh = [...result.newHouseholds.values()][0]!;
    expect(splitHh.headId).toBe('son2');
    expect(result.updatedPeople.get('son2')?.householdId).toBe(splitHh.id);
  });

  it('senior wife becomes head when no adult sons exist', () => {
    const deadHead = makePerson('dad', { sex: 'male', age: 65 });
    const wife = makePerson('wife', { sex: 'female', age: 55, householdRole: 'senior_wife' });
    const youngSon = makePerson('youngson', { sex: 'male', age: 12, parentIds: ['dad', null] });

    // Build household: add wife as senior_wife
    let hh = buildImanianHousehold('dad', ['dad', 'wife', 'youngson']);
    hh = { ...hh, seniorWifeId: 'wife' };

    const people = new Map([['dad', deadHead], ['wife', wife], ['youngson', youngSon]]);
    const households = new Map([[hh.id, hh]]);

    const result = processHouseholdSuccession(hh.id, 'dad', households, people, 10);

    expect(result.updatedHouseholds.get(hh.id)?.headId).toBe('wife');
    expect(result.newHouseholds.size).toBe(0);
  });

  it('property division: eldest keeps ⌈2/3⌉ of buildings', () => {
    const deadHead = makePerson('dad', { sex: 'male', age: 65 });
    const son1 = makePerson('son1', { sex: 'male', age: 35, parentIds: ['dad', null] });
    const son2 = makePerson('son2', { sex: 'male', age: 28, parentIds: ['dad', null] });
    const son3 = makePerson('son3', { sex: 'male', age: 22, parentIds: ['dad', null] });

    const hh = buildImanianHousehold(
      'dad',
      ['dad', 'son1', 'son2', 'son3'],
      ['b1', 'b2', 'b3'], // 3 production buildings
    );
    const people = new Map([['dad', deadHead], ['son1', son1], ['son2', son2], ['son3', son3]]);
    const households = new Map([[hh.id, hh]]);

    const result = processHouseholdSuccession(hh.id, 'dad', households, people, 10);

    // eldest gets ⌈3 * 2/3⌉ = 2 buildings
    const eldestShare = result.updatedHouseholds.get(hh.id)!.productionBuildingIds.length;
    expect(eldestShare).toBe(2);

    // son2 gets 1 building (round-robin, first slot)
    const son2Hh = [...result.newHouseholds.values()].find(h => h.headId === 'son2');
    expect(son2Hh?.productionBuildingIds.length).toBe(1);

    // son3 gets 0 (no buildings left)
    const son3Hh = [...result.newHouseholds.values()].find(h => h.headId === 'son3');
    expect(son3Hh?.productionBuildingIds.length).toBe(0);
  });

  it('underage sons do not split (age < 16)', () => {
    const deadHead = makePerson('dad', { sex: 'male', age: 65 });
    const adultSon = makePerson('adult', { sex: 'male', age: 22, parentIds: ['dad', null] });
    const youngSon = makePerson('young', { sex: 'male', age: 13, parentIds: ['dad', null] });

    const hh = buildImanianHousehold('dad', ['dad', 'adult', 'young']);
    const people = new Map([['dad', deadHead], ['adult', adultSon], ['young', youngSon]]);
    const households = new Map([[hh.id, hh]]);

    const result = processHouseholdSuccession(hh.id, 'dad', households, people, 10);

    // Only 1 adult son → becomes head, no split
    expect(result.newHouseholds.size).toBe(0);
    // Young son should still be in the continuing household
    expect(result.updatedHouseholds.get(hh.id)!.memberIds).toContain('young');
  });

  it('produces a succession activity log entry', () => {
    const deadHead = makePerson('dad', { sex: 'male', age: 65 });
    const son1 = makePerson('son1', { sex: 'male', age: 30, parentIds: ['dad', null] });
    const hh = buildImanianHousehold('dad', ['dad', 'son1']);
    const people = new Map([['dad', deadHead], ['son1', son1]]);
    const result = processHouseholdSuccession(hh.id, 'dad', new Map([[hh.id, hh]]), people, 5);
    expect(result.logEntries.length).toBeGreaterThan(0);
    expect(result.logEntries[0]!.type).toBe('household_succession');
  });
});

describe('processHouseholdSuccession — Sauromatian', () => {
  it('does not force a split; returns pendingSauromatianCouncilEvent = true', () => {
    const deadHead = makePerson('dad', { sex: 'male', age: 65 });
    const son1 = makePerson('son1', { sex: 'male', age: 35, parentIds: ['dad', null] });
    const son2 = makePerson('son2', { sex: 'male', age: 28, parentIds: ['dad', null] });

    let hh = createHousehold({
      name: 'Kethara Ashkaran',
      tradition: 'sauromatian',
      headId: 'dad',
      seniorWifeId: null,
      foundedTurn: 0,
    });
    hh = addToHousehold(addToHousehold(addToHousehold(hh, 'dad'), 'son1'), 'son2');

    const people = new Map([['dad', deadHead], ['son1', son1], ['son2', son2]]);
    const households = new Map([[hh.id, hh]]);

    const result = processHouseholdSuccession(hh.id, 'dad', households, people, 10);

    // No forced split
    expect(result.newHouseholds.size).toBe(0);
    // Council event flag raised
    expect(result.pendingSauromatianCouncilEvent).toBe(true);
    // Eldest son takes nominal head role
    expect(result.updatedHouseholds.get(hh.id)?.headId).toBe('son1');
  });

  it('does not set pendingSauromatianCouncilEvent when no adult sons', () => {
    const deadHead = makePerson('dad', { sex: 'male', age: 65 });
    const wife = makePerson('wife', { sex: 'female', age: 50, householdRole: 'senior_wife' });

    let hh = createHousehold({
      name: 'Kethara Ashkaran',
      tradition: 'sauromatian',
      headId: 'dad',
      seniorWifeId: 'wife',
      foundedTurn: 0,
    });
    hh = addToHousehold(addToHousehold(hh, 'dad'), 'wife');

    const people = new Map([['dad', deadHead], ['wife', wife]]);
    const result = processHouseholdSuccession(hh.id, 'dad', new Map([[hh.id, hh]]), people, 10);

    expect(result.pendingSauromatianCouncilEvent).toBe(false);
  });
});

// ─── deriveHouseholdName after succession ────────────────────────────────────

describe('deriveHouseholdName — auto-renamed after succession', () => {
  it('updates name to reflect new head after split', () => {
    const son = makePerson('son', { sex: 'male', familyName: 'Ironwood', householdId: 'new' });
    const hh: Household = {
      ...createHousehold({ name: '', tradition: 'imanian', headId: 'son', seniorWifeId: null, foundedTurn: 1 }),
      id: 'new',
      isAutoNamed: true,
    };
    const name = deriveHouseholdName(hh, new Map([['son', son]]));
    expect(name).toBe('House of Ironwood');
  });
});

// ─── Serialisation backward compat ───────────────────────────────────────────

describe('serialisation backward compat', () => {
  it('createHousehold defaults isAutoNamed to true', () => {
    const hh = createHousehold({
      name: 'Test',
      tradition: 'imanian',
      headId: null,
      seniorWifeId: null,
      foundedTurn: 0,
    });
    expect(hh.isAutoNamed).toBe(true);
  });

  it('createHousehold respects explicit isAutoNamed: false', () => {
    const hh = createHousehold({
      name: 'Custom',
      tradition: 'imanian',
      headId: null,
      seniorWifeId: null,
      foundedTurn: 0,
      isAutoNamed: false,
    });
    expect(hh.isAutoNamed).toBe(false);
  });
});

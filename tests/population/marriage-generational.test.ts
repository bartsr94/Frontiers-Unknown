/**
 * Tests for long-term marriage viability across generations.
 *
 * Previously, second-generation children born in-settlement would never marry
 * because:
 *   1. Their baseline opinion of peers was ~18 (same-culture +10, same-religion +8),
 *      but the seek_spouse threshold was 25 — unreachable since +1 culture drift
 *      and −1 decay cancelled exactly, creating a permanent plateau.
 *   2. initializeFamilyOpinions was not called at birth, so newborns started
 *      with empty relationship maps and had no path to building opinions.
 *
 * Fix applied:
 *   - spouseOpinionThreshold lowered 25 → 10 (reachable from the ~18 baseline)
 *   - initializeFamilyOpinions wired into the birth pipeline
 *
 * These tests verify both the fix and guard against regression.
 */

import { describe, it, expect } from 'vitest';
import { createPerson } from '../../src/simulation/population/person';
import type { Person } from '../../src/simulation/population/person';
import type { GameState, Household } from '../../src/simulation/turn/game-state';
import {
  determineAmbitionType,
  generateAmbition,
  tickAmbitionIntensity,
} from '../../src/simulation/population/ambitions';
import {
  initializeFamilyOpinions,
  initializeBaselineOpinions,
  adjustOpinion,
  getEffectiveOpinion,
} from '../../src/simulation/population/opinions';
import { canMarry, performMarriage } from '../../src/simulation/population/marriage';
import { createRNG } from '../../src/utils/rng';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function settlementNativePerson(id: string, sex: 'male' | 'female', age: number): Person {
  return createPerson({
    id,
    firstName: `Person_${id}`,
    familyName: 'Ashmark',
    sex,
    age,
    religion: 'imanian_orthodox',
    heritage: {
      bloodline: [{ group: 'imanian', fraction: 1.0 }],
      primaryCulture: 'settlement_native',
      culturalFluency: new Map([['settlement_native', 1.0]]),
    },
    languages: [{ language: 'imanian', fluency: 1.0 }],
    spouseIds: [],
    parentIds: [null, null],
    childrenIds: [],
    relationships: new Map(),
    opinionModifiers: [],
    traits: [],
  });
}

function makeMinimalState(people: Map<string, Person>): GameState {
  return {
    turnNumber: 40,
    people,
    councilMemberIds: [],
    households: new Map<string, Household>(),
    settlement: {
      name: 'Test',
      buildings: [],
      resources: { food: 100, cattle: 0, goods: 0, steel: 0, lumber: 0, stone: 0, medicine: 0, gold: 0, horses: 0 },
      populationCount: people.size,
      religiousPolicy: 'tolerant',
    },
    culture: {
      languages: new Map(),
      primaryLanguage: 'imanian',
      languageDiversityTurns: 0,
      languageTension: 0,
      religions: new Map([['imanian_orthodox', 1.0]]),
      religiousTension: 0,
      culturalBlend: 0.5,
      hiddenWheelEmerged: false,
      hiddenWheelDivergenceTurns: 0,
      hiddenWheelSuppressedTurns: 0,
      practices: [],
      governance: 'patriarchal_imanian',
    },
    tribes: new Map(),
    company: {
      standing: 60,
      annualQuotaGold: 0,
      annualQuotaGoods: 0,
      consecutiveFailures: 0,
      supportLevel: 'standard',
      yearsActive: 0,
      quotaContributedGold: 0,
      quotaContributedGoods: 0,
    },
    eventHistory: [],
    eventCooldowns: new Map(),
    pendingEvents: [],
    deferredEvents: [],
    councilMemberIds: [],
    graveyard: [],
    factions: [],
    activityLog: [],
    identityPressure: { companyPressureTurns: 0, tribalPressureTurns: 0 },
    config: {
      seed: 42,
      difficulty: 'normal',
      settlementName: 'Test',
      startingTribes: [],
    },
  } as unknown as GameState;
}

// ─── initializeFamilyOpinions at birth ───────────────────────────────────────

describe('initializeFamilyOpinions — opinion seeding at birth', () => {
  it('child holds a strongly positive opinion of their mother', () => {
    const mother = settlementNativePerson('m', 'female', 28);
    const child = settlementNativePerson('c', 'male', 0);

    const deltas = initializeFamilyOpinions(child, mother, null, []);

    const childToMother = deltas.find(d => d.observerId === 'c' && d.targetId === 'm');
    expect(childToMother).toBeDefined();
    expect(childToMother!.delta).toBeGreaterThanOrEqual(30);
  });

  it('mother holds a strongly positive opinion of their child', () => {
    const mother = settlementNativePerson('m', 'female', 28);
    const child = settlementNativePerson('c', 'male', 0);

    const deltas = initializeFamilyOpinions(child, mother, null, []);

    const motherToChild = deltas.find(d => d.observerId === 'm' && d.targetId === 'c');
    expect(motherToChild).toBeDefined();
    expect(motherToChild!.delta).toBeGreaterThanOrEqual(30);
  });

  it('child holds a positive opinion of their father', () => {
    const mother = settlementNativePerson('m', 'female', 28);
    const father = settlementNativePerson('f', 'male', 32);
    const child = settlementNativePerson('c', 'male', 0);

    const deltas = initializeFamilyOpinions(child, mother, father, []);

    const childToFather = deltas.find(d => d.observerId === 'c' && d.targetId === 'f');
    expect(childToFather).toBeDefined();
    expect(childToFather!.delta).toBeGreaterThanOrEqual(25);
  });

  it('sibling gains opinion of the new child', () => {
    const mother = settlementNativePerson('m', 'female', 28);
    const sibling = settlementNativePerson('s', 'male', 5);
    const child = settlementNativePerson('c', 'female', 0);

    const deltas = initializeFamilyOpinions(child, mother, null, [sibling]);

    const siblingToChild = deltas.find(d => d.observerId === 's' && d.targetId === 'c');
    expect(siblingToChild).toBeDefined();
    expect(siblingToChild!.delta).toBeGreaterThan(0);
  });
});

// ─── seek_spouse threshold — second generation ────────────────────────────────

describe('seek_spouse ambition — second-generation candidates', () => {
  it('forms seek_spouse when opinion is exactly the new threshold (10)', () => {
    const man = settlementNativePerson('m', 'male', 20);
    const woman = settlementNativePerson('w', 'female', 18);

    // Give the man exactly +10 opinion of the woman — the new floor
    const manWithOpinion: Person = {
      ...man,
      relationships: new Map([['w', 10]]),
    };

    const people = new Map<string, Person>([
      ['m', manWithOpinion],
      ['w', woman],
    ]);
    const state = makeMinimalState(people);
    const rng = createRNG(1);

    const result = determineAmbitionType(manWithOpinion, state, rng);
    expect(result?.type).toBe('seek_spouse');
    expect(result?.targetPersonId).toBe('w');
  });

  it('does NOT form seek_spouse when opinion is 9 (just below threshold)', () => {
    const man = settlementNativePerson('m', 'male', 20);
    const woman = settlementNativePerson('w', 'female', 18);

    const manWithOpinion: Person = {
      ...man,
      relationships: new Map([['w', 9]]),
    };

    const people = new Map<string, Person>([
      ['m', manWithOpinion],
      ['w', woman],
    ]);
    const state = makeMinimalState(people);
    const rng = createRNG(1);

    // No eligible partner at opinion 9 — should fall through to next ambition type
    const result = determineAmbitionType(manWithOpinion, state, rng);
    expect(result?.type).not.toBe('seek_spouse');
  });

  it('forms seek_spouse from baseline opinion after initializeBaselineOpinions', () => {
    // Two settlement_native peers of the same culture and religion get ~+18 baseline.
    // This must exceed the new threshold (10) so ambitions can form without boosting.
    const man = settlementNativePerson('m', 'male', 20);
    const woman = settlementNativePerson('w', 'female', 18);

    const people = new Map<string, Person>([['m', man], ['w', woman]]);
    const seeded = initializeBaselineOpinions(people);

    const seededMan = seeded.get('m')!;
    const opinionOfWoman = seededMan.relationships.get('w') ?? 0;

    // Confirm baseline is above the new threshold
    expect(opinionOfWoman).toBeGreaterThanOrEqual(10);

    const state = makeMinimalState(seeded);
    const rng = createRNG(42);
    const result = determineAmbitionType(seededMan, state, rng);
    expect(result?.type).toBe('seek_spouse');
  });
});

// ─── Sauromatian female — seek_companion threshold unchanged ─────────────────

describe('seek_companion / seek_spouse — Sauromatian women', () => {
  it('Sauromatian woman still forms seek_companion at opinion ≥ 0', () => {
    const woman = createPerson({
      id: 'w',
      sex: 'female',
      age: 18,
      religion: 'sacred_wheel',
      heritage: {
        bloodline: [{ group: 'kiswani_riverfolk', fraction: 1.0 }],
        primaryCulture: 'kiswani_riverfolk',
        culturalFluency: new Map([['kiswani_riverfolk', 1.0]]),
      },
      languages: [{ language: 'kiswani', fluency: 1.0 }],
      spouseIds: [],
      relationships: new Map([['m', 0]]),
      opinionModifiers: [],
    });
    const man = settlementNativePerson('m', 'male', 22);

    const people = new Map<string, Person>([['w', woman], ['m', man]]);
    const state = makeMinimalState(people);
    // courtshipNorms must allow seek_companion — 'mixed' is default
    const stateWithNorms = {
      ...state,
      settlement: { ...state.settlement, courtshipNorms: 'mixed' },
    } as unknown as GameState;

    const rng = createRNG(1);
    const result = determineAmbitionType(woman, stateWithNorms, rng);
    // Should form seek_companion (priority 0) before seek_spouse
    expect(result?.type).toBe('seek_companion');
  });
});

// ─── Autonomous marriage execution ───────────────────────────────────────────

describe('autonomous marriage — maxed ambition triggers marriage', () => {
  it('canMarry passes for two adults with opinion above refusal threshold', () => {
    const man = settlementNativePerson('m', 'male', 22);
    const woman = settlementNativePerson('w', 'female', 19);

    // Give them mutual above-threshold opinions
    const manWithOpinion: Person = { ...man, relationships: new Map([['w', 15]]) };
    const womanWithOpinion: Person = { ...woman, relationships: new Map([['m', 15]]) };

    const people = new Map([['m', manWithOpinion], ['w', womanWithOpinion]]);
    const state = makeMinimalState(people);

    const result = canMarry(manWithOpinion, womanWithOpinion, state);
    expect(result.allowed).toBe(true);
  });

  it('performMarriage links spouseIds bidirectionally', () => {
    const man = settlementNativePerson('m', 'male', 22);
    const woman = settlementNativePerson('w', 'female', 19);

    const state = makeMinimalState(new Map([['m', man], ['w', woman]]));
    const result = performMarriage(man, woman, state);

    expect(result.updatedPersonA.spouseIds).toContain(result.updatedPersonB.id);
    expect(result.updatedPersonB.spouseIds).toContain(result.updatedPersonA.id);
  });

  it('seek_spouse ambition reaches intensity 1.0 after 18 ticks', () => {
    // Intensity starts at 0.1 and grows +0.05/tick; reaches 1.0 after 18 ticks.
    let p = settlementNativePerson('a', 'male', 20);
    p = {
      ...p,
      ambition: { type: 'seek_spouse', intensity: 0.1, targetPersonId: 'b', formedTurn: 0 },
    };
    for (let i = 0; i < 18; i++) {
      p = tickAmbitionIntensity(p);
    }
    expect(p.ambition!.intensity).toBe(1.0);
  });
});

// ─── Full second-gen marriage pipeline ───────────────────────────────────────

describe('second-generation marriage pipeline', () => {
  it('child born to two settlers gets family opinions seeded at birth', () => {
    const mother = settlementNativePerson('m', 'female', 25);
    const father = settlementNativePerson('f', 'male', 27);
    const child = settlementNativePerson('c', 'male', 0);

    // Apply deltas as the turn-processor now does
    let people = new Map<string, Person>([
      ['m', mother], ['f', father], ['c', child],
    ]);
    for (const { observerId, targetId, delta } of initializeFamilyOpinions(child, mother, father, [])) {
      const observer = people.get(observerId);
      if (observer) people.set(observerId, adjustOpinion(observer, targetId, delta));
    }

    // Child should have meaningful positive opinion of each parent
    const grownChild = people.get('c')!;
    expect(getEffectiveOpinion(grownChild, 'm')).toBeGreaterThanOrEqual(30);
    expect(getEffectiveOpinion(grownChild, 'f')).toBeGreaterThanOrEqual(25);
  });

  it('two second-gen settlement_native adults can form seek_spouse ambitions', () => {
    // Simulate two children of settlers who grew up together.
    // After baseline opinion seeding they should be able to form marriage ambitions.
    const son = settlementNativePerson('son', 'male', 20);
    const daughter = settlementNativePerson('dau', 'female', 18);

    let people = new Map<string, Person>([['son', son], ['dau', daughter]]);
    // Seed baseline opinions (runs once every 8 turns in processDawn)
    people = initializeBaselineOpinions(people);

    const state = makeMinimalState(people);
    const rng = createRNG(7);

    const sonResult = generateAmbition(people.get('son')!, state, rng);
    const dauResult = generateAmbition(people.get('dau')!, state, rng);

    // At least one of them should want to get married — both should, but
    // the female may hit seek_companion first depending on culture checks.
    const sonAmb = sonResult?.type;
    const dauAmb = dauResult?.type;

    expect(
      sonAmb === 'seek_spouse' || sonAmb === 'seek_informal_union',
    ).toBe(true);
    expect(
      dauAmb === 'seek_spouse' || dauAmb === 'seek_companion',
    ).toBe(true);
  });

  it('two second-gen adults who form seek_spouse can successfully marry', () => {
    const son = settlementNativePerson('son', 'male', 20);
    const daughter = settlementNativePerson('dau', 'female', 18);

    // Seed the opinions they'd naturally accumulate
    let people = new Map<string, Person>([['son', son], ['dau', daughter]]);
    people = initializeBaselineOpinions(people);

    const state = makeMinimalState(people);

    // Explicitly check marriage eligibility
    const manUpdated = people.get('son')!;
    const womanUpdated = people.get('dau')!;
    const check = canMarry(manUpdated, womanUpdated, state);
    expect(check.allowed).toBe(true);

    // Perform the marriage
    const result = performMarriage(manUpdated, womanUpdated, state);
    expect(result.updatedPersonA.spouseIds.length).toBe(1);
    expect(result.updatedPersonB.spouseIds.length).toBe(1);
  });
});

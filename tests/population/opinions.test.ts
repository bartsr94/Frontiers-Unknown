import { describe, it, expect } from 'vitest';
import type { Person, OpinionModifier } from '../../src/simulation/population/person';
import {
  MARRIAGE_REFUSAL_THRESHOLD,
  getOpinion,
  setOpinion,
  adjustOpinion,
  computeTraitOpinion,
  computeBaselineOpinion,
  initializeFamilyOpinions,
  applyOpinionDrift,
  decayOpinions,
  applyMarriageOpinionFloor,
  findMarriageRefuser,
  getStrongestOpinions,
  addOpinionModifier,
  getEffectiveOpinion,
  getModifierSummary,
  decayOpinionModifiers,
  computeOpinionBreakdown,
} from '../../src/simulation/population/opinions';

// ─── Test helpers ─────────────────────────────────────────────────────────────

function makePerson(id: string, overrides: Partial<Person> = {}): Person {
  return {
    id,
    firstName: `Person_${id}`,
    familyName: 'Test',
    sex: 'male',
    age: 25,
    alive: true,
    role: 'unassigned',
    socialStatus: 'settler',
    traits: [],
    religion: 'animist',
    heritage: {
      bloodline: { imanian: 1, kiswani_riverfolk: 0, kiswani_bayuk: 0, kiswani_haisla: 0, hanjoda_stormcaller: 0, hanjoda_bloodmoon: 0, hanjoda_talon: 0, hanjoda_emrasi: 0 },
      primaryCulture: 'imanian',
      culturalFluency: new Map(),
      ethnicGroup: 'imanian',
    },
    genetics: {
      skinTone: 0.3,
      hairColor: 'brown',
      hairTexture: 'straight',
      eyeColor: 'blue',
      heightModifier: 0,
      buildModifier: 0,
      genderRatioModifier: 0,
      extendedFertility: false,
    },
    languages: [],
    pregnancies: [],
    spouseIds: [],
    childIds: [],
    motherIds: [],
    fatherIds: [],
    relationships: new Map(),
    householdId: null,
    householdRole: null,
    ashkaMelathiPartnerIds: [],
    ambition: null,
    skills: { animals: 25, bargaining: 25, combat: 25, custom: 25, leadership: 25, plants: 25 },
    portraitVariant: 1,
    ...overrides,
  } as Person;
}

// ─── getOpinion ───────────────────────────────────────────────────────────────

describe('getOpinion', () => {
  it('returns 0 when no entry exists (neutral stranger)', () => {
    const a = makePerson('a');
    expect(getOpinion(a, 'b')).toBe(0);
  });

  it('returns the stored value', () => {
    const a = makePerson('a', { relationships: new Map([['b', 35]]) });
    expect(getOpinion(a, 'b')).toBe(35);
  });

  it('returns negative stored value', () => {
    const a = makePerson('a', { relationships: new Map([['b', -45]]) });
    expect(getOpinion(a, 'b')).toBe(-45);
  });
});

// ─── setOpinion ───────────────────────────────────────────────────────────────

describe('setOpinion', () => {
  it('sets a new opinion value', () => {
    const a = makePerson('a');
    const result = setOpinion(a, 'b', 50);
    expect(getOpinion(result, 'b')).toBe(50);
  });

  it('clamps to +100', () => {
    const a = makePerson('a');
    const result = setOpinion(a, 'b', 150);
    expect(getOpinion(result, 'b')).toBe(100);
  });

  it('clamps to -100', () => {
    const a = makePerson('a');
    const result = setOpinion(a, 'b', -200);
    expect(getOpinion(result, 'b')).toBe(-100);
  });

  it('removes entry when value is 0', () => {
    const a = makePerson('a', { relationships: new Map([['b', 30]]) });
    const result = setOpinion(a, 'b', 0);
    expect(result.relationships.has('b')).toBe(false);
  });

  it('does not mutate original person', () => {
    const a = makePerson('a');
    setOpinion(a, 'b', 50);
    expect(a.relationships.has('b')).toBe(false);
  });
});

// ─── adjustOpinion ────────────────────────────────────────────────────────────

describe('adjustOpinion', () => {
  it('adds delta to an existing opinion', () => {
    const a = makePerson('a', { relationships: new Map([['b', 20]]) });
    const result = adjustOpinion(a, 'b', 15);
    expect(getOpinion(result, 'b')).toBe(35);
  });

  it('starts from 0 for a stranger', () => {
    const a = makePerson('a');
    const result = adjustOpinion(a, 'b', -25);
    expect(getOpinion(result, 'b')).toBe(-25);
  });

  it('clamps the result', () => {
    const a = makePerson('a', { relationships: new Map([['b', 90]]) });
    const result = adjustOpinion(a, 'b', 50);
    expect(getOpinion(result, 'b')).toBe(100);
  });
});

// ─── computeTraitOpinion ──────────────────────────────────────────────────────

describe('computeTraitOpinion', () => {
  it('returns 0 for two people with no relevant traits', () => {
    const a = makePerson('a', { traits: [] });
    const b = makePerson('b', { traits: [] });
    expect(computeTraitOpinion(a, b)).toBe(0);
  });

  it('applies conflict penalty (cruel vs kind)', () => {
    const a = makePerson('a', { traits: ['cruel'] });
    const b = makePerson('b', { traits: ['kind'] });
    expect(computeTraitOpinion(a, b)).toBeLessThan(0);
  });

  it('conflict is symmetric', () => {
    const a = makePerson('a', { traits: ['kind'] });
    const b = makePerson('b', { traits: ['cruel'] });
    expect(computeTraitOpinion(a, b)).toBeLessThan(0);
  });

  it('applies shared-trait bonus (gregarious)', () => {
    const a = makePerson('a', { traits: ['gregarious'] });
    const b = makePerson('b', { traits: ['gregarious'] });
    expect(computeTraitOpinion(a, b)).toBeGreaterThan(0);
  });

  it('no bonus when only one person has the trait', () => {
    const a = makePerson('a', { traits: ['brave'] });
    const b = makePerson('b', { traits: [] });
    expect(computeTraitOpinion(a, b)).toBe(0);
  });
});

// ─── computeBaselineOpinion ───────────────────────────────────────────────────

describe('computeBaselineOpinion', () => {
  it('returns higher score for same culture', () => {
    const a = makePerson('a', { heritage: { ...makePerson('a').heritage, primaryCulture: 'ansberite' } });
    const b = makePerson('b', { heritage: { ...makePerson('b').heritage, primaryCulture: 'ansberite' } });
    const c = makePerson('c', { heritage: { ...makePerson('c').heritage, primaryCulture: 'kiswani_riverfolk' } });
    expect(computeBaselineOpinion(a, b)).toBeGreaterThan(computeBaselineOpinion(a, c));
  });

  it('returns higher score when sharing same religion', () => {
    const a = makePerson('a', { religion: 'imanian_orthodox' });
    const b = makePerson('b', { religion: 'imanian_orthodox' });
    const c = makePerson('c', { religion: 'sacred_wheel' });
    expect(computeBaselineOpinion(a, b)).toBeGreaterThan(computeBaselineOpinion(a, c));
  });

  it('penalizes no shared language', () => {
    const base = makePerson('a');
    const noLang = computeBaselineOpinion(base, makePerson('b'));
    // With a shared language
    const sharedLang: Person['languages'] = [{ language: 'imanian', fluency: 0.8 }];
    const aLang = makePerson('a', { languages: sharedLang });
    const bLang = makePerson('b', { languages: sharedLang });
    expect(computeBaselineOpinion(aLang, bLang)).toBeGreaterThan(noLang);
  });

  it('clamps result to [-80, +80]', () => {
    // Max bonuses person
    const a = makePerson('a', {
      traits: ['gregarious', 'devout', 'honest', 'kind', 'generous', 'brave', 'traditional'],
      religion: 'imanian_orthodox',
      languages: [{ language: 'imanian', fluency: 0.9 }],
    });
    const b = makePerson('b', {
      traits: ['gregarious', 'devout', 'honest', 'kind', 'generous', 'brave', 'traditional'],
      religion: 'imanian_orthodox',
      languages: [{ language: 'imanian', fluency: 0.9 }],
    });
    const score = computeBaselineOpinion(a, b);
    expect(score).toBeLessThanOrEqual(80);
    expect(score).toBeGreaterThanOrEqual(-80);
  });
});

// ─── initializeFamilyOpinions ────────────────────────────────────────────────

describe('initializeFamilyOpinions', () => {
  it('generates child → mother positive delta', () => {
    const mother = makePerson('mom', { sex: 'female' });
    const child = makePerson('kid');
    const deltas = initializeFamilyOpinions(child, mother, null, []);
    const delta = deltas.find(d => d.observerId === child.id && d.targetId === mother.id);
    expect(delta).toBeDefined();
    expect(delta!.delta).toBeGreaterThan(0);
  });

  it('generates mother → child positive delta', () => {
    const mother = makePerson('mom', { sex: 'female' });
    const child = makePerson('kid');
    const deltas = initializeFamilyOpinions(child, mother, null, []);
    const delta = deltas.find(d => d.observerId === mother.id && d.targetId === child.id);
    expect(delta).toBeDefined();
    expect(delta!.delta).toBeGreaterThan(0);
  });

  it('generates sibling → child and child → sibling deltas', () => {
    const mother = makePerson('mom', { sex: 'female' });
    const child = makePerson('kid');
    const sib = makePerson('sib');
    const deltas = initializeFamilyOpinions(child, mother, null, [sib]);
    const sibToKid = deltas.find(d => d.observerId === sib.id && d.targetId === child.id);
    const kidToSib = deltas.find(d => d.observerId === child.id && d.targetId === sib.id);
    expect(sibToKid).toBeDefined();
    expect(kidToSib).toBeDefined();
  });
});

// ─── decayOpinions ────────────────────────────────────────────────────────────

describe('decayOpinions', () => {
  it('decays a positive opinion toward 0', () => {
    const a = makePerson('a', { relationships: new Map([['b', 20]]) });
    const people = new Map([['a', a], ['b', makePerson('b')]]);
    const result = decayOpinions(people);
    const score = result.get('a')!.relationships.get('b');
    expect(score).toBeDefined();
    expect(score!).toBeLessThan(20);
  });

  it('decays a negative opinion toward 0', () => {
    const a = makePerson('a', { relationships: new Map([['b', -20]]) });
    const people = new Map([['a', a], ['b', makePerson('b')]]);
    const result = decayOpinions(people);
    const score = result.get('a')!.relationships.get('b');
    expect(score).toBeDefined();
    expect(score!).toBeGreaterThan(-20);
  });

  it('removes entry when it reaches 0', () => {
    const a = makePerson('a', { relationships: new Map([['b', 1]]) });
    const people = new Map([['a', a], ['b', makePerson('b')]]);
    const result = decayOpinions(people);
    expect(result.get('a')!.relationships.has('b')).toBe(false);
  });
});

// ─── findMarriageRefuser ──────────────────────────────────────────────────────

describe('findMarriageRefuser', () => {
  it('returns null when both opinions are above threshold', () => {
    const man = makePerson('man', { sex: 'male', relationships: new Map([['woman', 10]]) });
    const woman = makePerson('woman', { sex: 'female', relationships: new Map([['man', 5]]) });
    expect(findMarriageRefuser(man, woman)).toBeNull();
  });

  it('returns man id when man dislikes woman below threshold', () => {
    const man = makePerson('man', { sex: 'male', relationships: new Map([['woman', MARRIAGE_REFUSAL_THRESHOLD - 1]]) });
    const woman = makePerson('woman', { sex: 'female', relationships: new Map([['man', 5]]) });
    expect(findMarriageRefuser(man, woman)).toBe('man');
  });

  it('returns woman id when woman dislikes man below threshold', () => {
    const man = makePerson('man', { sex: 'male', relationships: new Map([['woman', 5]]) });
    const woman = makePerson('woman', { sex: 'female', relationships: new Map([['man', MARRIAGE_REFUSAL_THRESHOLD - 1]]) });
    expect(findMarriageRefuser(man, woman)).toBe('woman');
  });
});

// ─── applyMarriageOpinionFloor ───────────────────────────────────────────────

describe('applyMarriageOpinionFloor', () => {
  it('raises mutual opinion to floor when below it', () => {
    const man = makePerson('man', { sex: 'male', relationships: new Map([['woman', -50]]) });
    const woman = makePerson('woman', { sex: 'female', relationships: new Map([['man', -50]]) });
    const [updMan, updWoman] = applyMarriageOpinionFloor(man, woman);
    expect(getOpinion(updMan, 'woman')).toBeGreaterThanOrEqual(40);
    expect(getOpinion(updWoman, 'man')).toBeGreaterThanOrEqual(40);
  });

  it('does not lower an already high opinion', () => {
    const man = makePerson('man', { sex: 'male', relationships: new Map([['woman', 80]]) });
    const woman = makePerson('woman', { sex: 'female', relationships: new Map([['man', 80]]) });
    const [updMan, updWoman] = applyMarriageOpinionFloor(man, woman);
    expect(getOpinion(updMan, 'woman')).toBe(80);
    expect(getOpinion(updWoman, 'man')).toBe(80);
  });
});

// ─── getStrongestOpinions ─────────────────────────────────────────────────────

describe('getStrongestOpinions', () => {
  it('returns opinions sorted by absolute value descending', () => {
    const a = makePerson('a', {
      relationships: new Map([['b', 20], ['c', -50], ['d', 10]]),
    });
    const result = getStrongestOpinions(a, 2);
    expect(result[0].targetId).toBe('c');
    expect(result[1].targetId).toBe('b');
  });

  it('respects n limit', () => {
    const a = makePerson('a', {
      relationships: new Map([['b', 20], ['c', -50], ['d', 10]]),
    });
    expect(getStrongestOpinions(a, 1).length).toBe(1);
  });

  it('returns empty array for person with no opinions', () => {
    const a = makePerson('a');
    expect(getStrongestOpinions(a, 5)).toEqual([]);
  });
});

// ─── applyOpinionDrift ──────────────────────────────────────────────────────────────────────────────

describe('applyOpinionDrift', () => {
  it('increases opinion by 1 for same-culture established pairs', () => {
    // Both share 'ansberite' culture + a common language (no language-barrier penalty)
    const a = makePerson('a', {
      heritage: { ...makePerson('a').heritage, primaryCulture: 'ansberite' },
      languages: [{ language: 'imanian', fluency: 0.9 }],
      relationships: new Map([['b', 20]]),
    });
    const b = makePerson('b', {
      heritage: { ...makePerson('b').heritage, primaryCulture: 'ansberite' },
      languages: [{ language: 'imanian', fluency: 0.9 }],
      relationships: new Map([['a', 20]]),
    });
    const people = new Map([['a', a], ['b', b]]);
    const result = applyOpinionDrift(people);
    expect(result.get('a')!.relationships.get('b')).toBe(21);
    expect(result.get('b')!.relationships.get('a')).toBe(21);
  });

  it('decreases opinion by 1 when no shared conversational language', () => {
    // Different cultures, no languages in common — must already know each other
    const a = makePerson('a', {
      heritage: { ...makePerson('a').heritage, primaryCulture: 'ansberite' },
      languages: [{ language: 'imanian', fluency: 0.9 }],
      relationships: new Map([['b', 20]]),
    });
    const b = makePerson('b', {
      heritage: { ...makePerson('b').heritage, primaryCulture: 'kiswani_riverfolk' },
      languages: [{ language: 'kiswani', fluency: 0.9 }],
      relationships: new Map([['a', 20]]),
    });
    const people = new Map([['a', a], ['b', b]]);
    const result = applyOpinionDrift(people);
    expect(result.get('a')!.relationships.get('b')).toBeLessThan(20);
  });

  it('does not create a new relationship entry for strangers', () => {
    const a = makePerson('a', {
      heritage: { ...makePerson('a').heritage, primaryCulture: 'ansberite' },
      relationships: new Map(), // no relationship with b
    });
    const b = makePerson('b', {
      heritage: { ...makePerson('b').heritage, primaryCulture: 'ansberite' },
      relationships: new Map(), // no relationship with a
    });
    const people = new Map([['a', a], ['b', b]]);
    const result = applyOpinionDrift(people);
    expect(result.get('a')!.relationships.has('b')).toBe(false);
  });
});

// ─── addOpinionModifier ───────────────────────────────────────────────────────

describe('addOpinionModifier', () => {
  it('appends a new modifier', () => {
    const a = makePerson('a');
    const mod: OpinionModifier = { id: 'ev1:pair:a:b', targetId: 'b', label: 'Joint project', value: 8, eventId: 'ev1' };
    const result = addOpinionModifier(a, mod);
    expect(result.opinionModifiers).toHaveLength(1);
    expect(result.opinionModifiers[0]).toEqual(mod);
  });

  it('replaces existing modifier with same id', () => {
    const mod: OpinionModifier = { id: 'ev1:pair:a:b', targetId: 'b', label: 'Old', value: 5, eventId: 'ev1' };
    const a = makePerson('a', { opinionModifiers: [mod] } as Partial<Person>);
    const updated: OpinionModifier = { ...mod, label: 'Updated', value: 10 };
    const result = addOpinionModifier(a, updated);
    expect(result.opinionModifiers).toHaveLength(1);
    expect(result.opinionModifiers[0]!.value).toBe(10);
    expect(result.opinionModifiers[0]!.label).toBe('Updated');
  });

  it('does not mutate the original person', () => {
    const a = makePerson('a');
    const mod: OpinionModifier = { id: 'ev1:pair:a:b', targetId: 'b', label: 'Test', value: 3, eventId: 'ev1' };
    addOpinionModifier(a, mod);
    expect((a as Person & { opinionModifiers?: unknown[] }).opinionModifiers ?? []).toHaveLength(0);
  });
});

// ─── getEffectiveOpinion ─────────────────────────────────────────────────────

describe('getEffectiveOpinion', () => {
  it('returns base opinion when no modifiers', () => {
    const a = makePerson('a');
    const withRel = setOpinion(a, 'b', 20);
    expect(getEffectiveOpinion(withRel, 'b')).toBe(20);
  });

  it('adds timed modifier to base opinion', () => {
    const a = setOpinion(makePerson('a'), 'b', 10);
    const mod: OpinionModifier = { id: 'ev1:pair:a:b', targetId: 'b', label: 'Bonus', value: 5, eventId: 'ev1' };
    const withMod = addOpinionModifier(a, mod);
    expect(getEffectiveOpinion(withMod, 'b')).toBe(15);
  });

  it('sums multiple modifiers for the same target', () => {
    const a = setOpinion(makePerson('a'), 'b', 0);
    const mod1: OpinionModifier = { id: 'm1', targetId: 'b', label: 'A', value: 4, eventId: 'ev1' };
    const mod2: OpinionModifier = { id: 'm2', targetId: 'b', label: 'B', value: -6, eventId: 'ev2' };
    const withMods = addOpinionModifier(addOpinionModifier(a, mod1), mod2);
    expect(getEffectiveOpinion(withMods, 'b')).toBe(-2);
  });

  it('clamps to [-100, +100]', () => {
    const a = setOpinion(makePerson('a'), 'b', 95);
    const mod: OpinionModifier = { id: 'm1', targetId: 'b', label: 'Big', value: 20, eventId: 'ev1' };
    const withMod = addOpinionModifier(a, mod);
    expect(getEffectiveOpinion(withMod, 'b')).toBe(100);
  });

  it('returns 0 for unknown target with no modifiers', () => {
    const a = makePerson('a');
    expect(getEffectiveOpinion(a, 'nobody')).toBe(0);
  });

  it('handles missing opinionModifiers field gracefully', () => {
    const a = makePerson('a');
    const withRel = setOpinion({ ...a, opinionModifiers: undefined as unknown as OpinionModifier[] }, 'b', 15);
    expect(getEffectiveOpinion(withRel, 'b')).toBe(15);
  });
});

// ─── getModifierSummary ───────────────────────────────────────────────────────

describe('getModifierSummary', () => {
  it('returns only modifiers for the given target', () => {
    const a = makePerson('a');
    const modB: OpinionModifier = { id: 'm1', targetId: 'b', label: 'For B', value: 5, eventId: 'ev1' };
    const modC: OpinionModifier = { id: 'm2', targetId: 'c', label: 'For C', value: 3, eventId: 'ev2' };
    const withMods = addOpinionModifier(addOpinionModifier(a, modB), modC);
    const summary = getModifierSummary(withMods, 'b');
    expect(summary).toHaveLength(1);
    expect(summary[0]!.targetId).toBe('b');
  });

  it('returns empty array when no modifiers for target', () => {
    const a = makePerson('a');
    expect(getModifierSummary(a, 'b')).toEqual([]);
  });
});

// ─── decayOpinionModifiers ───────────────────────────────────────────────────

describe('decayOpinionModifiers', () => {
  it('decrements positive modifier by 1 each call', () => {
    const mod: OpinionModifier = { id: 'm1', targetId: 'b', label: 'Test', value: 5, eventId: 'ev1' };
    const a = addOpinionModifier(makePerson('a'), mod);
    const people = new Map([['a', a]]);
    const result = decayOpinionModifiers(people);
    expect(result.get('a')!.opinionModifiers[0]!.value).toBe(4);
  });

  it('decrements negative modifier toward 0 by 1 each call', () => {
    const mod: OpinionModifier = { id: 'm1', targetId: 'b', label: 'Test', value: -5, eventId: 'ev1' };
    const a = addOpinionModifier(makePerson('a'), mod);
    const people = new Map([['a', a]]);
    const result = decayOpinionModifiers(people);
    expect(result.get('a')!.opinionModifiers[0]!.value).toBe(-4);
  });

  it('removes modifier when it reaches 0', () => {
    const mod: OpinionModifier = { id: 'm1', targetId: 'b', label: 'Test', value: 1, eventId: 'ev1' };
    const a = addOpinionModifier(makePerson('a'), mod);
    const people = new Map([['a', a]]);
    const result = decayOpinionModifiers(people);
    expect(result.get('a')!.opinionModifiers).toHaveLength(0);
  });

  it('removes negative modifier at -1 (next step would be 0)', () => {
    const mod: OpinionModifier = { id: 'm1', targetId: 'b', label: 'Test', value: -1, eventId: 'ev1' };
    const a = addOpinionModifier(makePerson('a'), mod);
    const people = new Map([['a', a]]);
    const result = decayOpinionModifiers(people);
    expect(result.get('a')!.opinionModifiers).toHaveLength(0);
  });

  it('persons without active modifiers have no modifiers after decay', () => {
    const a = makePerson('a');
    const b = makePerson('b');
    const people = new Map([['a', a], ['b', b]]);
    const result = decayOpinionModifiers(people);
    const resultA = result.get('a') ?? a;
    const resultB = result.get('b') ?? b;
    expect(resultA.opinionModifiers ?? []).toHaveLength(0);
    expect(resultB.opinionModifiers ?? []).toHaveLength(0);
  });
});

// ─── computeOpinionBreakdown with timed modifiers ────────────────────────────

describe('computeOpinionBreakdown with timed modifiers', () => {
  it('includes active modifier entries with turnsRemaining', () => {
    const a = makePerson('a');
    const b = makePerson('b', { id: 'b' });
    const mod: OpinionModifier = { id: 'ev1:pair:a:b', targetId: 'b', label: 'Joint project', value: 8, eventId: 'ev1' };
    const aWithMod = addOpinionModifier(a, mod);
    const breakdown = computeOpinionBreakdown(aWithMod, b);
    const modEntry = breakdown.find(e => e.label === 'Joint project');
    expect(modEntry).toBeDefined();
    expect(modEntry!.delta).toBe(8);
    expect(modEntry!.turnsRemaining).toBe(8);
  });

  it('turnsRemaining is absolute value of negative modifier', () => {
    const a = makePerson('a');
    const b = makePerson('b', { id: 'b' });
    const mod: OpinionModifier = { id: 'ev1:pair:a:b', targetId: 'b', label: 'Bitter quarrel', value: -6, eventId: 'ev1' };
    const aWithMod = addOpinionModifier(a, mod);
    const breakdown = computeOpinionBreakdown(aWithMod, b);
    const modEntry = breakdown.find(e => e.label === 'Bitter quarrel');
    expect(modEntry!.turnsRemaining).toBe(6);
  });

  it('baseline entries do not have turnsRemaining', () => {
    const a = makePerson('a');
    const b = makePerson('b', { id: 'b' });
    const breakdown = computeOpinionBreakdown(a, b);
    breakdown.forEach(entry => {
      expect(entry.turnsRemaining).toBeUndefined();
    });
  });
});

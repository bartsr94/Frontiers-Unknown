/**
 * Tests for council-advice.ts
 *
 * Covers:
 *   - getVoiceArchetype: correct archetype for each dominant trait
 *   - getVoiceArchetype: first-match priority ordering
 *   - getVoiceArchetype: default 'cautious' when no traits match
 *   - scoreChoiceForPerson: trait biases applied correctly
 *   - scoreChoiceForPerson: cultural biases applied correctly
 *   - hashPersonEvent: determinism, non-negative output
 *   - generateAdvice: non-empty, deterministic, stable on multiple calls
 *   - generateAdvice: all 48 archetype × category template cells non-empty
 */

import { describe, it, expect } from 'vitest';
import {
  getVoiceArchetype,
  scoreChoiceForPerson,
  hashPersonEvent,
  generateAdvice,
} from '../../src/simulation/events/council-advice';
import type { VoiceArchetype } from '../../src/simulation/events/council-advice';
import type { Person, PersonSkills, CultureId } from '../../src/simulation/population/person';
import type { GameEvent, EventChoice, EventCategory } from '../../src/simulation/events/engine';
import type { TraitId } from '../../src/simulation/personality/traits';

// ─── Minimal Person Builder ───────────────────────────────────────────────────

function allSkills(value: number): PersonSkills {
  return { animals: value, bargaining: value, combat: value, custom: value, leadership: value, plants: value };
}

let _idCounter = 0;
function makePerson(traits: TraitId[], culture: CultureId = 'ansberite'): Person {
  const id = `test-${_idCounter++}`;
  return {
    id,
    firstName: 'Test',
    familyName: 'Person',
    sex: 'male',
    age: 30,
    role: 'trader',
    traits,
    skills: allSkills(30),
    isPlayerControlled: false,
    isDeceased: false,
    birthYear: 1,
    genetics: {
      visibleTraits: {
        skinTone:       0.2,
        skinUndertone:  'cool_pink',
        hairColor:      'blonde',
        hairTexture:    'straight',
        eyeColor:       'blue',
        buildType:      'lean',
        heightClass:    'average',
        facialStructure:'oval',
      },
      genderRatioModifier: 0.5,
      extendedFertility:   false,
    },
    heritage: {
      bloodline:       [{ group: 'imanian', fraction: 1.0 }],
      primaryCulture:  culture,
      motherEthnicGroup: 'imanian',
      fatherEthnicGroup: 'imanian',
      culturalFluency: new Map(),
    },
    health: {
      currentHealth:  100,
      maxHealth:      100,
      conditions:     [],
    },
    relationships: new Map(),
    motherFamilyName: 'Person',
    fatherFamilyName: 'Person',
    languages: [],
  } as unknown as Person;
}

// ─── Minimal Event / Choice Builder ──────────────────────────────────────────

function makeChoice(overrides: Partial<EventChoice> = {}): EventChoice {
  return {
    id:          'choice_a',
    label:       'Do it',
    description: 'A choice.',
    consequences: [],
    ...overrides,
  };
}

function makeEvent(category: EventCategory = 'domestic', choices?: EventChoice[]): GameEvent {
  return {
    id:            'test_event',
    title:         'Test',
    category,
    prerequisites: [],
    weight:        1,
    cooldown:      0,
    isUnique:      false,
    description:   'Something happens.',
    choices:       choices ?? [makeChoice()],
  };
}

// ─── getVoiceArchetype ────────────────────────────────────────────────────────

describe('getVoiceArchetype', () => {
  const archetypeCases: Array<[TraitId, VoiceArchetype]> = [
    ['brave',           'bold'],
    ['wrathful',        'bold'],
    ['veteran',         'bold'],
    ['hero',            'bold'],
    ['greedy',          'pragmatist'],
    ['ambitious',       'pragmatist'],
    ['clever',          'pragmatist'],
    ['wealthy',         'pragmatist'],
    ['generous',        'diplomat'],
    ['gregarious',      'diplomat'],
    ['welcoming',       'diplomat'],
    ['cosmopolitan',    'diplomat'],
    ['traditional',     'traditionalist'],
    ['devout',          'traditionalist'],
    ['proud',           'traditionalist'],
    ['honest',          'traditionalist'],
    ['patient',         'cautious'],
    ['craven',          'cautious'],
    ['sickly',          'cautious'],
    ['humble',          'cautious'],
    ['deceitful',       'schemer'],
    ['lustful',         'schemer'],
    ['scandal',         'schemer'],
    ['oath_breaker',    'schemer'],
  ];

  it.each(archetypeCases)('trait %s → archetype %s', (trait, expected) => {
    expect(getVoiceArchetype([trait])).toBe(expected);
  });

  it('returns cautious when no traits match', () => {
    expect(getVoiceArchetype([])).toBe('cautious');
    expect(getVoiceArchetype(['strong', 'beautiful'])).toBe('cautious');
  });

  it('first matching trait wins (bold beats pragmatist)', () => {
    // brave appears before greedy in order; brave → bold
    expect(getVoiceArchetype(['brave', 'greedy'])).toBe('bold');
    // greedy appears before brave; greedy → pragmatist
    expect(getVoiceArchetype(['greedy', 'brave'])).toBe('pragmatist');
  });
});

// ─── scoreChoiceForPerson ─────────────────────────────────────────────────────

describe('scoreChoiceForPerson', () => {
  it('greedy: +25 for gold gain, -20 for gold loss', () => {
    const person = makePerson(['greedy']);
    const gainChoice = makeChoice({
      consequences: [{ type: 'modify_resource', target: 'gold', value: 10 }],
    });
    const lossChoice = makeChoice({
      consequences: [{ type: 'modify_resource', target: 'gold', value: -10 }],
    });
    expect(scoreChoiceForPerson(person, gainChoice)).toBe(25);
    expect(scoreChoiceForPerson(person, lossChoice)).toBe(-20);
  });

  it('greedy: +25 for goods gain', () => {
    const person = makePerson(['greedy']);
    const choice = makeChoice({
      consequences: [{ type: 'modify_resource', target: 'goods', value: 5 }],
    });
    expect(scoreChoiceForPerson(person, choice)).toBe(25);
  });

  it('brave: +15 when choice has a skill check', () => {
    const person = makePerson(['brave']);
    const withCheck = makeChoice({
      consequences: [],
      skillCheck: { skill: 'combat', difficulty: 40, actorSelection: 'best_council' },
    });
    const noCheck = makeChoice({ consequences: [] });
    expect(scoreChoiceForPerson(person, withCheck)).toBe(15);
    expect(scoreChoiceForPerson(person, noCheck)).toBe(0);
  });

  it('craven: +20 no skill check, -15 with skill check', () => {
    const person = makePerson(['craven']);
    const withCheck = makeChoice({
      consequences: [],
      skillCheck: { skill: 'combat', difficulty: 40, actorSelection: 'best_council' },
    });
    const noCheck = makeChoice({ consequences: [] });
    expect(scoreChoiceForPerson(person, withCheck)).toBe(-15);
    expect(scoreChoiceForPerson(person, noCheck)).toBe(20);
  });

  it('ambitious: +25 for company standing gain, -15 for loss', () => {
    // Use settlement_native culture to neutralise the imanian cultural +10 bias
    const person = makePerson(['ambitious'], 'settlement_native');
    const gain = makeChoice({
      consequences: [{ type: 'modify_standing', target: 'company', value: 10 }],
    });
    const loss = makeChoice({
      consequences: [{ type: 'modify_standing', target: 'company', value: -5 }],
    });
    expect(scoreChoiceForPerson(person, gain)).toBe(25);
    expect(scoreChoiceForPerson(person, loss)).toBe(-15);
  });

  it('deceitful: +30 for deception skill check', () => {
    const person = makePerson(['deceitful']);
    const deceptionChoice = makeChoice({
      consequences: [],
      skillCheck: { skill: 'deception', difficulty: 40, actorSelection: 'best_council' },
    });
    expect(scoreChoiceForPerson(person, deceptionChoice)).toBe(30);
  });

  it('honest: -30 for deception skill check', () => {
    const person = makePerson(['honest']);
    const deceptionChoice = makeChoice({
      consequences: [],
      skillCheck: { skill: 'deception', difficulty: 40, actorSelection: 'best_council' },
    });
    expect(scoreChoiceForPerson(person, deceptionChoice)).toBe(-30);
  });

  it('generous: +20 for positive opinion consequence', () => {
    const person = makePerson(['generous']);
    const choice = makeChoice({
      consequences: [{ type: 'modify_opinion', target: 'person_1', value: 15 }],
    });
    expect(scoreChoiceForPerson(person, choice)).toBe(20);
  });

  it('wrathful: +20 for high-magnitude consequence regardless of direction', () => {
    const person = makePerson(['wrathful']);
    const gainChoice = makeChoice({
      consequences: [{ type: 'modify_resource', target: 'food', value: 50 }],
    });
    const lossChoice = makeChoice({
      consequences: [{ type: 'modify_resource', target: 'food', value: -50 }],
    });
    expect(scoreChoiceForPerson(person, gainChoice)).toBe(20);
    expect(scoreChoiceForPerson(person, lossChoice)).toBe(20);
  });

  it('imanian culture: +10 for company standing gain', () => {
    const person = makePerson([], 'imanian_homeland');
    const choice = makeChoice({
      consequences: [{ type: 'modify_standing', target: 'company', value: 10 }],
    });
    expect(scoreChoiceForPerson(person, choice)).toBe(10);
  });

  it('kiswani culture: +15 for disposition gain', () => {
    const person = makePerson([], 'kiswani_riverfolk');
    const choice = makeChoice({
      consequences: [{ type: 'modify_disposition', target: 'tribe_1', value: 10 }],
    });
    expect(scoreChoiceForPerson(person, choice)).toBe(15);
  });

  it('settlement_native culture: no bias', () => {
    const person = makePerson([], 'settlement_native');
    const choice = makeChoice({
      consequences: [
        { type: 'modify_standing', target: 'company', value: 10 },
        { type: 'modify_disposition', target: 'tribe_1', value: 10 },
      ],
    });
    expect(scoreChoiceForPerson(person, choice)).toBe(0);
  });
});

// ─── hashPersonEvent ──────────────────────────────────────────────────────────

describe('hashPersonEvent', () => {
  it('returns a non-negative integer', () => {
    const h = hashPersonEvent('person-abc', 'event-xyz');
    expect(h).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(h)).toBe(true);
  });

  it('is deterministic — same inputs always produce same output', () => {
    const a = hashPersonEvent('person-123', 'event-456');
    const b = hashPersonEvent('person-123', 'event-456');
    expect(a).toBe(b);
  });

  it('different inputs produce different hashes (basic collision check)', () => {
    const h1 = hashPersonEvent('person-a', 'event-x');
    const h2 = hashPersonEvent('person-b', 'event-x');
    const h3 = hashPersonEvent('person-a', 'event-y');
    expect(h1).not.toBe(h2);
    expect(h1).not.toBe(h3);
  });
});

// ─── generateAdvice ───────────────────────────────────────────────────────────

describe('generateAdvice', () => {
  it('returns a non-empty string', () => {
    const person = makePerson(['brave']);
    const event = makeEvent('domestic');
    const seed = hashPersonEvent(person.id, event.id);
    const advice = generateAdvice(person, event, seed);
    expect(advice.length).toBeGreaterThan(0);
    expect(typeof advice).toBe('string');
  });

  it('is deterministic — same inputs produce same advice', () => {
    const person = makePerson(['greedy', 'ambitious']);
    const event = makeEvent('economic', [
      makeChoice({ consequences: [{ type: 'modify_resource', target: 'gold', value: 20 }] }),
    ]);
    const seed = hashPersonEvent(person.id, event.id);
    expect(generateAdvice(person, event, seed)).toBe(generateAdvice(person, event, seed));
  });

  it('different people produce different advice (character differentiation)', () => {
    const brave = makePerson(['brave']);
    const craven = makePerson(['craven']);
    const event = makeEvent('domestic');
    const seedA = hashPersonEvent(brave.id, event.id);
    const seedB = hashPersonEvent(craven.id, event.id);
    const adviceA = generateAdvice(brave, event, seedA);
    const adviceB = generateAdvice(craven, event, seedB);
    expect(adviceA).not.toBe(adviceB);
  });

  it('advice for skilled actor contains confident suffix', () => {
    // Person has combat 80; choice has skill check difficulty 40 → score ≥ difficulty + 20
    const personSkills: PersonSkills = { animals: 30, bargaining: 30, combat: 80, custom: 30, leadership: 30, plants: 30 };
    const person = { ...makePerson(['brave']), skills: personSkills };
    const choice = makeChoice({
      consequences: [],
      skillCheck: { skill: 'combat', difficulty: 40, actorSelection: 'best_council' },
    });
    const event = makeEvent('domestic', [choice]);
    const seed = 0;
    const advice = generateAdvice(person, event, seed);
    // Confident suffix contains "I am not concerned" or similar
    expect(advice).toContain('I am not concerned');
  });

  it('advice for under-skilled bold actor contains overconfident suffix', () => {
    // Person has combat 20; choice has skill check difficulty 50 → under by 30
    const personSkills: PersonSkills = { animals: 20, bargaining: 20, combat: 20, custom: 20, leadership: 20, plants: 20 };
    const person = { ...makePerson(['brave']), skills: personSkills };
    const choice = makeChoice({
      consequences: [],
      skillCheck: { skill: 'combat', difficulty: 50, actorSelection: 'best_council' },
    });
    const event = makeEvent('military', [choice]);
    const seed = 0;
    const advice = generateAdvice(person, event, seed);
    expect(advice).toContain('We will find a way through it');
  });

  it('advice for under-skilled cautious actor contains hedge suffix', () => {
    const personSkills: PersonSkills = { animals: 10, bargaining: 10, combat: 10, custom: 10, leadership: 10, plants: 10 };
    const person = { ...makePerson(['craven']), skills: personSkills };
    const choice = makeChoice({
      consequences: [],
      skillCheck: { skill: 'bargaining', difficulty: 60, actorSelection: 'best_council' },
    });
    const event = makeEvent('economic', [choice]);
    const seed = 0;
    const advice = generateAdvice(person, event, seed);
    expect(advice).toContain('less certain of my read');
  });
});

// ─── Template coverage — all 48 archetype × category cells ───────────────────

describe('generateAdvice — template coverage', () => {
  const archetypes: VoiceArchetype[] = [
    'bold', 'pragmatist', 'diplomat', 'traditionalist', 'cautious', 'schemer',
  ];
  const categories: EventCategory[] = [
    'diplomacy', 'domestic', 'economic', 'military', 'cultural', 'personal', 'environmental', 'company',
  ];

  // Map archetype to a representative triggering trait
  const archetypeTrait: Record<VoiceArchetype, TraitId> = {
    bold:           'brave',
    pragmatist:     'greedy',
    diplomat:       'generous',
    traditionalist: 'traditional',
    cautious:       'patient',
    schemer:        'deceitful',
  };

  it.each(
    archetypes.flatMap(arch =>
      categories.map(cat => ({ arch, cat })),
    ),
  )('$arch × $cat returns non-empty string', ({ arch, cat }) => {
    const person = makePerson([archetypeTrait[arch]]);
    const event = makeEvent(cat);
    // Test all seed variants (covers all template fragments per cell)
    for (let seed = 0; seed < 4; seed++) {
      const advice = generateAdvice(person, event, seed);
      expect(advice.length).toBeGreaterThan(0);
    }
  });
});

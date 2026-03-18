/**
 * Initial game state factory — creates a fresh GameState from a GameConfig.
 *
 * Extracted from the Zustand store so this pure simulation logic can live
 * alongside the other turn-processing modules and be tested without touching
 * localStorage or React.
 */

import { createPerson, ETHNIC_GROUP_PRIMARY_LANGUAGE, ETHNIC_GROUP_CULTURE } from '../population/person';
import type { Person, WorkRole, CultureId } from '../population/person';
import { generateName } from '../population/naming';
import { emptyResourceStock } from '../economy/resources';
import { initializeBaselineOpinions, getOpinion, setOpinion } from '../population/opinions';
import { SAUROMATIAN_CULTURE_IDS } from '../population/culture';
import { generateAmbition } from '../population/ambitions';
import { seedFoundingRelationships } from '../population/named-relationships';
import { initializeHouseholds } from '../population/household';
import { createFertilityProfile } from '../genetics/fertility';
import { ETHNIC_DISTRIBUTIONS } from '../../data/ethnic-distributions';
import type { GameState, ResourceStock, Settlement, SettlementCulture, CompanyRelation, GameConfig } from './game-state';
import { defaultDebugSettings } from './game-state';
import { createRNG } from '../../utils/rng';
import type { SeededRNG } from '../../utils/rng';
import { createTribe, TRIBE_PRESETS } from '../world/tribes';
import { generateHexMap } from '../world/hex-map';
import { IMANIAN_TRAITS } from '../genetics/traits';
import { TRAIT_CONFLICTS } from '../../data/trait-affinities';
import type { TraitId } from '../personality/traits';
import { clamp } from '../../utils/math';

// ─── Founding settler configuration ──────────────────────────────────────────

/** Standard Imanian sex-ratio modifier: equal probability of male/female offspring. */
const IMANIAN_GENDER_RATIO = 0.5;

/** Role and age-range configuration for each male founding settler.
 * Settlers who will eventually farm start as foragers — the settlement begins
 * without Tilled Fields, so farming slots don't exist yet. Once a Fields
 * building is constructed the player can re-assign them to 'farmer'.
 */
const FOUNDER_ROLES: ReadonlyArray<{ role: WorkRole; ageMin: number; ageMax: number }> = [
  { role: 'gather_food', ageMin: 17, ageMax: 23 },
  { role: 'gather_food', ageMin: 22, ageMax: 32 },
  { role: 'gather_food', ageMin: 22, ageMax: 35 },
  { role: 'gather_food', ageMin: 25, ageMax: 40 },
  { role: 'gather_food', ageMin: 25, ageMax: 40 },
  { role: 'gather_food', ageMin: 30, ageMax: 45 },
  { role: 'gather_food', ageMin: 45, ageMax: 65 },
  { role: 'trader',      ageMin: 22, ageMax: 32 },
  { role: 'trader',      ageMin: 22, ageMax: 32 },
  { role: 'guard',       ageMin: 25, ageMax: 42 },
];

/**
 * Curated pool of traits that can appear on a founding colonist.
 * Covers virtues, flaws, and aptitudes — no earned, relationship, or
 * mental-state traits.
 */
const FOUNDER_TRAIT_POOL: readonly TraitId[] = [
  'brave', 'craven', 'patient', 'clever', 'strong', 'proud', 'gregarious',
  'honest', 'traditional', 'humble', 'content', 'ambitious', 'devoted', 'kind',
  'generous', 'curious', 'sanguine', 'trusting', 'protective', 'welcoming',
  'shy', 'stubborn', 'melancholic', 'deceitful', 'greedy', 'suspicious',
  'jealous', 'wrathful', 'fickle', 'reckless', 'devout', 'cynical',
  'green_thumb', 'keen_hunter', 'gifted_speaker', 'mentor_hearted', 'folklorist',
  // Scheme-enabling traits (allow court/befriend schemes to start from founders)
  'romantic', 'lonely',
];

/** Returns true if two traits directly conflict with each other. */
function traitsConflict(a: TraitId, b: TraitId): boolean {
  return TRAIT_CONFLICTS.some(([ca, cb]) => (ca === a && cb === b) || (ca === b && cb === a));
}

/**
 * Picks 2 non-conflicting traits from the founder pool using the seeded RNG.
 * Falls back to a single trait if no valid pair is found within 20 attempts.
 */
function pickFounderTraits(rng: SeededRNG): TraitId[] {
  const pool = FOUNDER_TRAIT_POOL;
  const firstIdx = rng.nextInt(0, pool.length - 1);
  const first = pool[firstIdx]!;
  let second = first;
  for (let i = 0; i < 20; i++) {
    const candidate = pool[rng.nextInt(0, pool.length - 1)]!;
    if (candidate !== first && !traitsConflict(first, candidate)) {
      second = candidate;
      break;
    }
  }
  return second === first ? [first] : [first, second];
}

/**
 * Samples a GeneticProfile from the Imanian ethnic distribution.
 * Gives each founding settler a physically distinct but ethnically appropriate appearance.
 */
function sampleImanianGenetics(rng: SeededRNG): Person['genetics'] {
  const d = IMANIAN_TRAITS;
  return {
    visibleTraits: {
      skinTone:        clamp(rng.gaussian(d.skinTone.mean, Math.sqrt(d.skinTone.variance)), 0, 1),
      skinUndertone:   rng.weightedPick(d.skinUndertone.weights),
      hairColor:       rng.weightedPick(d.hairColor.weights),
      hairTexture:     rng.weightedPick(d.hairTexture.weights),
      eyeColor:        rng.weightedPick(d.eyeColor.weights),
      buildType:       rng.weightedPick(d.buildType.weights),
      height:          rng.weightedPick(d.height.weights),
      facialStructure: rng.weightedPick(d.facialStructure.weights),
    },
    genderRatioModifier: IMANIAN_GENDER_RATIO,
    extendedFertility: false,
  };
}

// ─── Council seeding ──────────────────────────────────────────────────────────

/**
 * Auto-selects 5 founding council members: the guard, both traders,
 * and the 2 oldest foragers.
 */
function seedCouncil(people: Map<string, Person>): string[] {
  const all = Array.from(people.values());
  const guard    = all.filter(p => p.role === 'guard');
  const traders  = all.filter(p => p.role === 'trader');
  const foragers = all
    .filter(p => p.role === 'gather_food')
    .sort((a, b) => b.age - a.age)
    .slice(0, 2);
  return [...guard, ...traders, ...foragers].map(p => p.id);
}

// ─── Initial game state factory ───────────────────────────────────────────────

/**
 * Creates a fresh GameState from the provided config and settlement name.
 *
 * Accepts an optional `seed` for deterministic replay/testing.
 * In production a cryptographically random seed is generated via the Web
 * Crypto API so that Math.random() is never used (Hard Rule #1).
 */
export function createInitialState(config: GameConfig, settlementName: string, seed?: number): GameState {
  const resolvedSeed = seed ?? (crypto.getRandomValues(new Uint32Array(1))[0]! >>> 0);
  const rng = createRNG(resolvedSeed);
  const people = new Map<string, Person>();

  // Generate founding male settlers — names, appearance, and traits are all seeded
  // from the game's RNG so every play-through starts with a different group.
  for (const { role, ageMin, ageMax } of FOUNDER_ROLES) {
    const { firstName, familyName } = generateName('male', 'ansberite', '', '', rng);
    // Traders arrive with a working knowledge of Tradetalk — it would be
    // absurd to seek trade contacts without any common tongue.
    const languages: Person['languages'] = role === 'trader'
      ? [{ language: 'imanian', fluency: 1.0 }, { language: 'tradetalk', fluency: 0.4 }]
      : [{ language: 'imanian', fluency: 1.0 }];

    const person = createPerson({
      firstName,
      familyName,
      sex: 'male',
      age: rng.nextInt(ageMin, ageMax),
      role,
      socialStatus: 'founding_member',
      languages,
      genetics: sampleImanianGenetics(rng),
      traits: pickFounderTraits(rng),
    }, rng);
    people.set(person.id, person);
  }

  // Optional founding Sauromatian women (enable via GameConfig.includeSauromatianWomen).
  if (config.includeSauromatianWomen) {
    // Determine ethnic group from the first selected tribe, or fall back.
    const firstPresetId = config.startingTribes[0];
    const firstPreset = firstPresetId ? TRIBE_PRESETS[firstPresetId] : undefined;
    const sauroGroup = firstPreset?.ethnicGroup ?? 'kiswani_riverfolk';
    const sauroTraitDist = ETHNIC_DISTRIBUTIONS[sauroGroup];

    // Three women join per starting configuration; names, appearance, and traits
    // are seeded from the game RNG for variety across play-throughs.
    const SAURO_AGE_RANGES = [[18, 22], [22, 27], [27, 33]] as const;

    for (const [ageMin, ageMax] of SAURO_AGE_RANGES) {
      const { firstName, familyName } = generateName(
        'female',
        ETHNIC_GROUP_CULTURE[sauroGroup],
        '',
        '',
        rng,
      );
      const d = sauroTraitDist;
      const newWoman = createPerson({
        firstName,
        familyName,
        sex: 'female',
        age: rng.nextInt(ageMin, ageMax),
        role: 'unassigned',
        socialStatus: 'newcomer',
        genetics: {
          visibleTraits: {
            skinTone:        clamp(rng.gaussian(d.skinTone.mean, Math.sqrt(d.skinTone.variance)), 0, 1),
            skinUndertone:   rng.weightedPick(d.skinUndertone.weights),
            hairColor:       rng.weightedPick(d.hairColor.weights),
            hairTexture:     rng.weightedPick(d.hairTexture.weights),
            eyeColor:        rng.weightedPick(d.eyeColor.weights),
            buildType:       rng.weightedPick(d.buildType.weights),
            height:          rng.weightedPick(d.height.weights),
            facialStructure: rng.weightedPick(d.facialStructure.weights),
          },
          genderRatioModifier: 0.14, // Pure Sauromatian
          extendedFertility: true,
        },
        fertility: createFertilityProfile(true),
        heritage: {
          bloodline: [{ group: sauroGroup, fraction: 1.0 }],
          primaryCulture: ETHNIC_GROUP_CULTURE[sauroGroup],
          culturalFluency: new Map<CultureId, number>([[ETHNIC_GROUP_CULTURE[sauroGroup], 1.0]]),
        },
        // Sauromatian women joining a trading company will have picked up some
        // Tradetalk — it's the lingua franca of cross-tribal commerce.
        languages: [
          { language: ETHNIC_GROUP_PRIMARY_LANGUAGE[sauroGroup], fluency: 1.0 },
          { language: 'tradetalk', fluency: 0.3 },
        ],
        religion: 'sacred_wheel',
        traits: pickFounderTraits(rng),
      }, rng);
      people.set(newWoman.id, newWoman);
    }
  }

  const initialResources: ResourceStock = {
    ...emptyResourceStock(),
    food: 20,
    gold: 50,
    goods: 5,
    cattle: 5,
    lumber: 20,
    stone: 10,
  };

  const settlement: Settlement = {
    name: settlementName,
    location: config.startingLocation,
    buildings: [{ defId: 'camp', instanceId: 'camp_0', builtTurn: 0, style: null, claimedByPersonIds: [], ownerHouseholdId: null, assignedWorkerIds: [] }],
    constructionQueue: [],
    resources: initialResources,
    populationCount: people.size,
    religiousPolicy: 'tolerant',
    courtshipNorms: 'traditional',
    economyReserves: {},
  };

  const culture: SettlementCulture = {
    languages: new Map([['imanian', 1.0]]),
    primaryLanguage: 'imanian',
    religions: new Map([['imanian_orthodox', 1.0]]),
    religiousTension: 0,
    culturalBlend: 0,
    practices: ['imanian_liturgy', 'company_law'],
    governance: 'patriarchal_imanian',
    languageDiversityTurns: 0,
    languageTension: 0,
    hiddenWheelDivergenceTurns: 0,
    hiddenWheelSuppressedTurns: 0,
    hiddenWheelEmerged: false,
  };

  const company: CompanyRelation = {
    standing: 60,
    annualQuotaGold: 20,
    annualQuotaGoods: 5,
    consecutiveFailures: 0,
    supportLevel: 'standard',
    yearsActive: 0,
    quotaContributedGold: 0,
    quotaContributedGoods: 0,
    exportedGoodsThisYear: 0,
  };

  // Instantiate tribes from selected presets.
  const tribes = new Map<string, ReturnType<typeof createTribe>>();
  for (const presetId of config.startingTribes) {
    const preset = TRIBE_PRESETS[presetId];
    if (preset) {
      const tribe = createTribe(preset);
      // Starting tribes are known contacts — trade is available immediately.
      // Hex territory positions are assigned after map generation below.
      tribes.set(tribe.id, {
        ...tribe,
        contactEstablished: true,
        diplomacyOpened: false,
        territoryQ: null,
        territoryR: null,
      });
    }
  }

  // Seed households for all founding persons before building initial state.
  const { updatedPeople: peopleWithHouseholds, newHouseholds: foundingHouseholds } =
    initializeHouseholds(people, 0);
  for (const [id, p] of peopleWithHouseholds) people.set(id, p);

  const initialGameState: GameState = {
    version: '1.0.0',
    seed: resolvedSeed,
    turnNumber: 0,
    currentSeason: 'spring',
    currentYear: 1,
    people,
    graveyard: [],
    settlement,
    culture,
    tribes,
    company,
    eventHistory: [],
    eventCooldowns: new Map(),
    pendingEvents: [],
    councilMemberIds: seedCouncil(people),
    deferredEvents: [],
    households: foundingHouseholds,
    config,
    flags: { creoleEmergedNotified: false },
    identityPressure: { companyPressureTurns: 0, tribalPressureTurns: 0 },
    factions: [],
    activityLog: [],
    debugSettings: defaultDebugSettings(),
    communalResourceMinimum: { lumber: 15, stone: 5 },
    buildingWorkersInitialized: true,
    lowMoraleTurns: 0,
    massDesertionWarningFired: false,
    lastSettlementMorale: 0,
    lastPayrollShortfall: false,
    hexMap: generateHexMap(config, rng),
    expeditions: [],
    boatsInPort: 1,
  };

  // ── Seed opinions and ambitions at game start ──────────────────────────────
  // Both systems normally run inside processDawn, but we initialize them
  // here so that Key Opinions and ambition badges are visible immediately
  // before the player takes their first turn.
  const opinionsSeeded = initializeBaselineOpinions(initialGameState.people);
  const seededPeople = new Map(opinionsSeeded);

  // Cross-cultural companion boost: Sauromatian women and Imanian men have
  // shared the Company's outward journey together. Starting baseline opinion
  // between non-trader pairs is −15 (no shared language), traders −5 (Tradetalk).
  // We force a guaranteed positive entry so that initializeBaselineOpinions
  // (which runs again each processDawn) cannot re-seed −15 on the first dawn:
  // setOpinion with value 0 would DELETE the entry, so we clamp to a minimum.
  //   Women → men: min +15 (above the seek_companion/seek_spouse threshold of 5)
  //   Men → women: min +30 (above the seek_spouse/seek_informal_union threshold of 25)
  if (config.includeSauromatianWomen) {
    const sauroWomen = Array.from(seededPeople.values()).filter(
      p => p.sex === 'female' && SAUROMATIAN_CULTURE_IDS.has(p.heritage.primaryCulture),
    );
    const imanianMen = Array.from(seededPeople.values()).filter(
      p => p.sex === 'male' && !SAUROMATIAN_CULTURE_IDS.has(p.heritage.primaryCulture),
    );
    for (const woman of sauroWomen) {
      for (const man of imanianMen) {
        // Woman's opinion of the man: clamp to at least +15 so the entry is
        // always a positive value — a 0 result would be deleted by setOpinion,
        // causing initializeBaselineOpinions to re-seed −15 on the first dawn.
        const womanRaw = getOpinion(seededPeople.get(woman.id)!, man.id);
        const updatedWoman = setOpinion(seededPeople.get(woman.id)!, man.id, Math.max(womanRaw + 20, 15));
        seededPeople.set(woman.id, updatedWoman);
        // Man's opinion of the woman: clamp to at least +30 — above the +25
        // seek_spouse / seek_informal_union threshold for Imanian men.
        const manRaw = getOpinion(seededPeople.get(man.id)!, woman.id);
        const updatedMan = setOpinion(seededPeople.get(man.id)!, woman.id, Math.max(manRaw + 35, 30));
        seededPeople.set(man.id, updatedMan);
      }
    }
  }
  for (const [id, person] of seededPeople) {
    const ambition = generateAmbition(person, { ...initialGameState, people: seededPeople }, rng);
    if (ambition) {
      seededPeople.set(id, { ...person, ambition });
    }
  }

  // Seed pre-formed named relationships (friends, rivals, confidants, mentors)
  // reflecting the group's shared Company journey before arriving at the settlement.
  const peopleWithRelationships = seedFoundingRelationships(seededPeople, rng);

  return { ...initialGameState, people: peopleWithRelationships };
}

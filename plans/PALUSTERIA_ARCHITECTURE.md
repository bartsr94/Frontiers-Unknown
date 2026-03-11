# Palusteria: Children of the Ashmark — Architecture & Implementation Guide

**Version:** 1.1 (updated after Phase 1 completion)  
**Document Type:** Technical Architecture (How)  
**Companion Document:** `PALUSTERIA_GAME_DESIGN.md` (What & Why)  
**Stack:** React 19 + TypeScript (strict) + Vite + Zustand + Tailwind CSS + HTML5 Canvas

---

## 1. Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| UI Framework | React | 19 |
| Language | TypeScript | 5.x, strict mode |
| Build | Vite | 7 |
| State Management | Zustand | 5 |
| Styling | Tailwind CSS | 3.x |
| Map / Visuals | HTML5 Canvas 2D | Native |
| Data Persistence | localStorage (JSON) | Native |
| Testing | Vitest | 4 |
| Package Manager | npm | Latest |

No backend. No database. No server. The entire game runs client-side in the browser. Save files are JSON in localStorage.

---

## 2. Project Structure

```
palusteria-game/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
│
├── src/
│   ├── main.tsx                        # Entry point
│   ├── App.tsx                         # Root component, turn loop orchestration
│   │
│   ├── simulation/                     # ⚠️ PURE LOGIC — no React, no DOM, no imports from ui/
│   │   ├── genetics/
│   │   │   ├── traits.ts               # Ethnic trait distributions (data)
│   │   │   ├── inheritance.ts          # resolveInheritance(), trait sampling
│   │   │   ├── gender-ratio.ts         # Gender ratio calculation
│   │   │   └── fertility.ts            # Fertility windows, pregnancy tracking
│   │   │
│   │   ├── population/
│   │   │   ├── person.ts               # Person interface, createPerson() factory
│   │   │   ├── household.ts            # Family grouping, household dynamics
│   │   │   ├── marriage.ts             # Marriage matching, polygamy rules
│   │   │   ├── naming.ts               # Culturally appropriate name generation
│   │   │   └── relationships.ts        # Opinion system, social bond calculations
│   │   │
│   │   ├── personality/
│   │   │   ├── traits.ts               # Trait definitions and mechanical effects
│   │   │   ├── assignment.ts           # Birth trait assignment, earned trait logic
│   │   │   └── state.ts                # PersonState stub (future mood/needs slot)
│   │   │
│   │   ├── economy/
│   │   │   ├── resources.ts            # Resource types, production, consumption math
│   │   │   ├── trade.ts                # Trade pricing and exchange calculations
│   │   │   └── company.ts              # Company relations, quota math, support tiers
│   │   │
│   │   ├── culture/
│   │   │   ├── settlement-culture.ts   # Settlement culture tracker calculations
│   │   │   ├── language.ts             # Language fluency, drift, creolization math
│   │   │   └── religion.ts             # Religious composition, tension calculations
│   │   │
│   │   ├── world/
│   │   │   ├── tribes.ts               # External tribe state and AI behavior
│   │   │   ├── diplomacy.ts            # Disposition calculation, trade/war logic
│   │   │   └── region.ts               # Map data, location definitions, distances
│   │   │
│   │   ├── events/
│   │   │   ├── engine.ts               # Type definitions only (GameEvent, EventChoice, etc.) ✅
│   │   │   ├── event-filter.ts         # ALL_EVENTS, filterEligibleEvents(), drawEvents() ✅
│   │   │   ├── resolver.ts             # applyEventChoice() — applies consequences to state ✅
│   │   │   ├── combat.ts               # Abstract combat resolution math (Phase 2/3)
│   │   │   └── definitions/            # Event data files (10 Phase 1 events across 5 files) ✅
│   │   │       ├── company.ts          # Company Supply Delivery, Letter from the Company ✅
│   │   │       ├── diplomacy.ts        # Watchers at the River (Riverfolk first contact) ✅
│   │   │       ├── domestic.ts         # Game Tracks, Weight of Distance, Men at Work ✅
│   │   │       ├── economic.ts         # Traveling Merchant, Good Timber Nearby ✅
│   │   │       ├── environmental.ts    # Bountiful Season, Sudden Storm, Cold Bites Deep ✅
│   │   │       ├── cultural.ts         # (Phase 2)
│   │   │       ├── military.ts         # (Phase 2/3)
│   │   │       └── personal.ts         # (Phase 2)
│   │   │
│   │   └── turn/
│   │       ├── turn-processor.ts       # Master turn loop (dawn → event → mgmt → dusk)
│   │       ├── season.ts               # Seasonal modifier definitions
│   │       └── game-state.ts           # Central GameState interface
│   │
│   ├── ui/                             # React components — rendering only
│   │   ├── layout/
│   │   │   ├── GameScreen.tsx          # Main layout shell (KoDP-style) ✅
│   │   │   ├── LeftNav.tsx             # Left nav + phase-aware End Turn button ✅
│   │   │   ├── TopBar.tsx              # Season, year, resources header bar ✅
│   │   │   ├── BottomBar.tsx           # Full-width resource strip ✅
│   │   │   └── CouncilFooter.tsx       # 7-seat Expedition Council row ✅
│   │   │
│   │   ├── views/
│   │   │   ├── EventView.tsx           # KoDP-style event card with choices ✅
│   │   │   ├── PeopleView.tsx          # Population roster with council toggle ✅
│   │   │   ├── PersonDetail.tsx        # Individual deep-dive panel (Phase 2)
│   │   │   ├── FamilyTree.tsx          # Genealogy browser (Phase 2)
│   │   │   ├── SettlementView.tsx      # Buildings, resources, cultural overview (Phase 3)
│   │   │   ├── TradeView.tsx           # Trade interface (Phase 3)
│   │   │   ├── DiplomacyView.tsx       # Relations with tribes and Company (Phase 3)
│   │   │   └── MapView.tsx             # Canvas-rendered regional map (Phase 3)
│   │   │
│   │   ├── components/
│   │   │   ├── Portrait.tsx            # Procedural portrait renderer
│   │   │   ├── TraitBadge.tsx          # Personality trait pill/badge
│   │   │   ├── ResourceBar.tsx         # Resource display widget
│   │   │   ├── OpinionMeter.tsx        # Relationship visualization
│   │   │   └── PopulationChart.tsx     # Demographics visualization
│   │   │
│   │   └── overlays/
│   │       ├── MarriageDialog.tsx      # Arrange marriage interface
│   │       ├── RoleAssignment.tsx      # Work role assignment
│   │       └── GameSetup.tsx           # New game configuration screen
│   │
│   ├── data/
│   │   ├── ethnic-distributions.ts     # All ethnic trait distributions (constants)
│   │   ├── trait-definitions.ts        # All personality trait definitions
│   │   ├── name-lists.ts              # Names organized by culture and gender
│   │   ├── cultural-practices.ts       # Practice definitions and effects
│   │   └── starting-scenarios.ts       # Pre-built game configurations
│   │
│   ├── utils/
│   │   ├── rng.ts                      # Seeded PRNG (mulberry32)
│   │   ├── math.ts                     # lerp, clamp, inverseLerp, weightedPick
│   │   └── id.ts                       # Unique ID generation
│   │
│   └── stores/
│       └── game-store.ts              # Zustand store — bridges simulation ↔ UI
│
└── tests/
    ├── genetics/
    │   ├── inheritance.test.ts         # Trait blending produces expected ranges
    │   ├── gender-ratio.test.ts        # Ratio math matches lore values
    │   └── fertility.test.ts           # Fertility window edge cases
    ├── population/
    │   └── demographics.test.ts        # 100-year headless sim, verify pop curves
    ├── events/
    │   └── prerequisites.test.ts       # Event filtering correctness
    └── utils/
        └── rng.test.ts                 # Deterministic output from known seeds
```

---

## 3. Hard Architectural Rules

### 3.1 Simulation/UI Separation

The `simulation/` directory must contain **zero** React imports, **zero** DOM references, and **zero** UI concerns. It is pure TypeScript logic.

The `ui/` directory reads from the Zustand store and dispatches actions. It never calls simulation functions directly.

```
[UI Components] → dispatch action → [Zustand Store] → call simulation fn → [simulation/]
                                           ↓
                                     update state
                                           ↓
                                  [UI Components] re-render
```

This enables: headless testing of the full simulation, potential Web Worker offloading for turn processing, and independent iteration on UI without touching game logic.

### 3.2 Seeded Randomness

All random decisions flow through the seeded PRNG. No `Math.random()` anywhere in the codebase. This ensures deterministic replay and testability. The master seed lives in `GameState`. Subsystems derive child seeds from it.

### 3.3 Data-Driven Content

Events, trait definitions, ethnic distributions, and name lists are data files in `src/data/`. They are plain TypeScript constants (not runtime-loaded JSON). Adding a new event or trait should never require touching engine code — only adding an entry to a data file.

### 3.4 No Premature Abstraction

Build each system to solve the current phase's requirements. Do not build infrastructure for Phase 4 during Phase 1. Extension points are defined as interface slots (e.g., `hiddenTraits?: HiddenTraits`) but not implemented until needed.

---

## 4. Core Data Models

### 4.1 Person

```typescript
interface Person {
  id: string;
  firstName: string;
  familyName: string;
  nickname?: string;

  sex: 'male' | 'female';
  age: number;                       // Fractional years, +0.25 per turn
  genetics: GeneticProfile;
  fertility: FertilityProfile;
  health: HealthState;

  heritage: Heritage;
  languages: LanguageFluency[];
  religion: ReligionId;
  culturalIdentity: CultureId;

  traits: TraitId[];                 // 2–4 from trait-definitions.ts
  
  spouseIds: string[];               // Supports polygamy
  parentIds: [string | null, string | null]; // [motherId, fatherId]
  childrenIds: string[];
  relationships: Map<string, number>; // personId → opinion (-100 to +100)

  role: WorkRole;
  socialStatus: SocialStatus;
  isPlayerControlled: boolean;
}
```

### 4.2 Genetic Profile

```typescript
interface GeneticProfile {
  visibleTraits: VisibleTraits;
  genderRatioModifier: number;       // 0.0–1.0, probability of male birth
  extendedFertility: boolean;        // Kethara's bargain (maternal inheritance)
  hiddenTraits?: HiddenTraits;       // Future expansion slot — not implemented in MVP
}

interface VisibleTraits {
  skinTone: number;                  // 0.0 (palest Imanian) → 1.0 (darkest Bayuk)
  skinUndertone: Undertone;
  hairColor: HairColor;
  hairTexture: HairTexture;
  eyeColor: EyeColor;
  buildType: BuildType;
  height: HeightClass;
  facialStructure: FacialStructure;
}

type Undertone = 'cool_pink' | 'warm_olive' | 'copper' | 'bronze' | 'neutral';
type HairColor = 'blonde' | 'light_brown' | 'dark_brown' | 'black' | 'red' | 'auburn' | 'grey';
type HairTexture = 'straight' | 'wavy' | 'curly' | 'coily';
type EyeColor = 'brown' | 'grey' | 'blue' | 'amber' | 'green' | 'hazel';
type BuildType = 'lean' | 'athletic' | 'stocky' | 'wiry' | 'heavyset';
type HeightClass = 'short' | 'below_average' | 'average' | 'tall' | 'very_tall';
type FacialStructure = 'narrow' | 'oval' | 'broad' | 'angular' | 'round';
```

### 4.3 Heritage

```typescript
interface Heritage {
  bloodline: BloodlineEntry[];       // Biological ancestry fractions
  primaryCulture: CultureId;
  culturalFluency: Map<CultureId, number>; // 0.0–1.0 familiarity
}

interface BloodlineEntry {
  group: EthnicGroup;
  fraction: number;                  // 0.0–1.0, all entries sum to 1.0
}

type EthnicGroup =
  | 'imanian'
  | 'kiswani_riverfolk'
  | 'kiswani_bayuk'
  | 'kiswani_haisla'
  | 'hanjoda_stormcaller'
  | 'hanjoda_bloodmoon'
  | 'hanjoda_talon'
  | 'hanjoda_emrasi';
  // Future: 'weri' | 'avari' | 'confederate'

type CultureId =
  | 'imanian_homeland'
  | 'ansberite'
  | 'townborn'
  | 'kiswani_traditional'
  | 'hanjoda_traditional'
  | 'sauro_borderfolk'
  | 'sauro_wildborn'
  | 'settlement_native';
```

### 4.4 Trait Distribution (for genetics sampling)

```typescript
interface TraitDistribution {
  skinTone: GaussianDist;
  skinUndertone: WeightedDist<Undertone>;
  hairColor: WeightedDist<HairColor>;
  hairTexture: WeightedDist<HairTexture>;
  eyeColor: WeightedDist<EyeColor>;
  buildType: WeightedDist<BuildType>;
  height: WeightedDist<HeightClass>;
  facialStructure: WeightedDist<FacialStructure>;
}

interface GaussianDist {
  mean: number;
  variance: number;
}

interface WeightedDist<T extends string> {
  weights: Partial<Record<T, number>>; // Values sum to 1.0
}
```

### 4.5 Fertility

```typescript
interface FertilityProfile {
  isExtended: boolean;               // Kethara's bargain
  fertilityStart: number;            // Age fertility begins (~14–16)
  fertilityPeak: number;             // Peak fertility age (~20–30)
  fertilityDeclineStart: number;     // When decline begins (35 normal, 45 extended)
  fertilityEnd: number;              // Effective end (42–45 normal, 52–55 extended)
}

interface HealthState {
  currentHealth: number;             // 0–100
  conditions: HealthCondition[];
  pregnancy?: PregnancyState;
}

interface PregnancyState {
  fatherId: string;
  conceptionTurn: number;
  dueDate: number;                   // Turn number when birth occurs (~3 turns after conception)
}

type HealthCondition =
  | 'wounded'
  | 'ill'
  | 'malnourished'
  | 'recovering'
  | 'chronic_illness'
  | 'frail';                         // Old age
```

### 4.6 Personality Traits

```typescript
interface TraitDefinition {
  id: TraitId;
  name: string;
  category: 'personality' | 'aptitude' | 'cultural' | 'earned';
  description: string;
  conflicts: TraitId[];              // Cannot coexist with these
  effects: TraitEffect[];
  inheritWeight?: number;            // Chance of passing to children (aptitude traits)
}

interface TraitEffect {
  target: TraitEffectTarget;
  modifier: number;
}

type TraitEffectTarget =
  | 'combat_strength'
  | 'diplomacy'
  | 'trade_skill'
  | 'farming'
  | 'fertility_modifier'
  | 'health_modifier'
  | 'opinion_same_trait'             // Opinion of people with the same trait
  | 'opinion_conflicting_trait'      // Opinion of people with conflicting traits
  | 'cultural_resistance'            // Resistance to cultural assimilation
  | 'cultural_openness';             // Speed of cultural adoption
```

### 4.7 Economy

```typescript
// cattle  — herd animals; produce a food bonus each season (1 food per 2 cattle)
// goods   — manufactured and acquired trade goods (NOTE: formerly 'trade_goods')
type ResourceType =
  | 'food'
  | 'cattle'
  | 'goods'
  | 'steel'
  | 'lumber'
  | 'stone'
  | 'medicine'
  | 'gold'
  | 'horses';

type ResourceStock = Record<ResourceType, number>;

interface CompanyRelation {
  standing: number;                  // 0–100, starts at 60
  annualQuotaGold: number;
  annualQuotaTradeGoods: number;
  consecutiveFailures: number;
  supportLevel: 'full_support' | 'standard' | 'reduced' | 'minimal' | 'abandoned';
  yearsActive: number;
}
```

### 4.8 Events

```typescript
interface GameEvent {
  id: string;
  title: string;
  category: EventCategory;
  prerequisites: EventPrerequisite[];
  weight: number;                    // Relative draw probability
  cooldown: number;                  // Minimum turns between firings
  isUnique: boolean;
  description: string;               // Supports template vars: {person}, {tribe}, {resource}
  choices: EventChoice[];
  actorRequirements?: ActorRequirement[];
}

interface EventChoice {
  id: string;
  label: string;
  description: string;
  requirements?: ChoiceRequirement[];
  consequences: EventConsequence[];
  followUpEventId?: string;          // Chain to another event
}

interface EventConsequence {
  type: ConsequenceType;
  target: string;                    // personId, tribeId, 'settlement', etc.
  value: number | string | boolean;
}

type ConsequenceType =
  | 'add_person'
  | 'remove_person'
  | 'modify_resource'
  | 'modify_opinion'
  | 'modify_disposition'             // Tribe disposition
  | 'modify_standing'                // Company standing
  | 'add_trait'
  | 'remove_trait'
  | 'wound_person'
  | 'kill_person'
  | 'start_pregnancy'
  | 'trigger_event';

type EventCategory = 'diplomacy' | 'domestic' | 'economic' | 'military' | 'cultural' | 'personal' | 'environmental' | 'company';

interface EventPrerequisite {
  type: PrerequisiteType;
  params: Record<string, any>;
}

type PrerequisiteType =
  | 'min_population'
  | 'max_population'
  | 'min_year'
  | 'has_resource'
  | 'tribe_exists'
  | 'tribe_disposition_above'
  | 'tribe_disposition_below'
  | 'company_standing_above'
  | 'company_standing_below'
  | 'has_person_matching'            // e.g., unmarried Sauromatian woman
  | 'season_is'
  | 'cultural_blend_above'
  | 'cultural_blend_below';
```

### 4.9 External Tribes

```typescript
interface ExternalTribe {
  id: string;
  name: string;
  ethnicGroup: EthnicGroup;
  population: number;
  disposition: number;               // -100 to +100 toward player
  traits: TribeTrait[];
  desires: TribeDesire[];
  offerings: TribeOffering[];
  stability: number;                 // 0.0–1.0
}

type TribeTrait = 'warlike' | 'peaceful' | 'isolationist' | 'trader' | 'expansionist' | 'desperate';
type TribeDesire = 'steel' | 'medicine' | 'alliance' | 'men' | 'territory' | 'trade';
type TribeOffering = 'food' | 'horses' | 'furs' | 'herbs' | 'warriors' | 'wives' | 'knowledge' | 'pearls';
```

### 4.10 Settlement Culture

```typescript
interface SettlementCulture {
  languages: Map<LanguageId, number>;     // Language → fraction of pop speaking it
  primaryLanguage: LanguageId;
  religions: Map<ReligionId, number>;
  religiousTension: number;               // 0.0–1.0
  culturalBlend: number;                  // 0.0 (fully Imanian) → 1.0 (fully Sauromatian)
  practices: CulturalPracticeId[];
  governance: GovernanceStyle;
}

type LanguageId = 'imanian' | 'kiswani' | 'tradetalk' | 'settlement_creole';
type ReligionId = 'imanian_orthodox' | 'sacred_wheel' | 'syncretic_hidden_wheel' | 'irreligious';
type GovernanceStyle = 'patriarchal_imanian' | 'council_hybrid' | 'matriarchal_sauromatian';

type CulturalPracticeId =
  | 'imanian_liturgy'
  | 'sauromatian_wheel'
  | 'syncretic_worship'
  | 'essence_sharing'
  | 'bathhouse_culture'
  | 'company_law'
  | 'tribal_justice'
  | 'warrior_training'
  | 'chivalric_code'
  | 'matriarchal_households'
  | 'patriarchal_households';
```

### 4.11 Game State (Master Interface)

```typescript
interface GameState {
  version: string;                   // Schema version for save migration
  seed: number;                      // Master RNG seed
  turnNumber: number;
  currentSeason: Season;
  currentYear: number;

  people: Map<string, Person>;       // All living people
  graveyard: GraveyardEntry[];       // Dead people (lighter struct for genealogy)

  settlement: Settlement;
  culture: SettlementCulture;

  tribes: Map<string, ExternalTribe>;
  company: CompanyRelation;

  eventHistory: EventRecord[];
  eventCooldowns: Map<string, number>;

  // Added in Phase 1 implementation
  pendingEvents: GameEvent[];        // Events queued for the current Event Phase
  councilMemberIds: string[];        // IDs of up to 7 Expedition Council members (seat order)

  config: GameConfig;
}

type Season = 'spring' | 'summer' | 'autumn' | 'winter';

interface GraveyardEntry {
  id: string;
  firstName: string;
  familyName: string;
  birthYear: number;
  deathYear: number;
  deathCause: string;
  parentIds: [string | null, string | null];
  childrenIds: string[];
  heritage: Heritage;
}

interface Settlement {
  name: string;
  location: LocationId;
  buildings: BuildingId[];
  resources: ResourceStock;
  populationCount: number;           // Cached count for quick access
}

interface GameConfig {
  difficulty: 'easy' | 'normal' | 'hard';
  startingTribes: string[];          // Tribe definition IDs
  startingLocation: LocationId;
}

interface EventRecord {
  eventId: string;
  turnNumber: number;
  choiceId: string;
  involvedPersonIds: string[];
}
```

---

## 5. Key Algorithms

### 5.1 Genetic Inheritance

```typescript
function resolveInheritance(mother: Person, father: Person, rng: SeededRNG): GeneticProfile {
  // 1. Child bloodline = average of parents
  const childBloodline = averageBloodlines(mother.heritage.bloodline, father.heritage.bloodline);

  // 2. Build blended trait distribution from bloodline fractions
  //    For each ethnic group in child's bloodline, multiply that group's
  //    trait distribution by its fraction, then sum.
  const blendedDist = blendTraitDistributions(childBloodline);

  // 3. Sample each visible trait
  //    70% weight: blended ethnic distribution
  //    30% weight: actual parent trait values
  const visibleTraits = sampleVisibleTraits(blendedDist, mother.genetics.visibleTraits, father.genetics.visibleTraits, rng);

  // 4. Gender ratio modifier
  const genderRatioModifier = resolveGenderRatio(mother, father);

  // 5. Extended fertility — strict maternal inheritance
  const extendedFertility = mother.genetics.extendedFertility;

  return { visibleTraits, genderRatioModifier, extendedFertility };
}
```

**Continuous trait sampling (skin tone):**
```typescript
function sampleContinuous(
  blendedMean: number,
  blendedVariance: number,
  motherValue: number,
  fatherValue: number,
  rng: SeededRNG
): number {
  const parentMean = (motherValue + fatherValue) / 2;
  const finalMean = blendedMean * 0.7 + parentMean * 0.3;
  const finalVariance = blendedVariance * 0.5; // Tighter than population
  return clamp(rng.gaussian(finalMean, Math.sqrt(finalVariance)), 0, 1);
}
```

**Discrete trait sampling (eye color):**
```typescript
function sampleDiscrete<T extends string>(
  blendedWeights: Partial<Record<T, number>>,
  motherValue: T,
  fatherValue: T,
  rng: SeededRNG
): T {
  // Boost parent values in the weight table
  const adjusted = { ...blendedWeights };
  const parentBoost = 0.15; // Each parent adds 15% to their value
  adjusted[motherValue] = (adjusted[motherValue] ?? 0) + parentBoost;
  adjusted[fatherValue] = (adjusted[fatherValue] ?? 0) + parentBoost;
  // Renormalize
  const total = Object.values(adjusted).reduce((a, b) => a + (b as number), 0) as number;
  for (const key of Object.keys(adjusted)) {
    adjusted[key as T] = (adjusted[key as T] as number) / total;
  }
  return rng.weightedPick(adjusted);
}
```

### 5.2 Gender Ratio Calculation

```typescript
function resolveGenderRatio(mother: Person, father: Person): number {
  const sauroFraction = getSauromatianFraction(mother.heritage.bloodline);
  // Pure Sauromatian: ~0.14 (1 in 7). Pure Imanian: ~0.50.
  const maternalBase = lerp(0.50, 0.14, sauroFraction);

  const paternalImanianFraction = getImanianFraction(father.heritage.bloodline);
  // Imanian father can shift ratio up by ~0.20
  const paternalShift = paternalImanianFraction * 0.20;

  return clamp(maternalBase + paternalShift, 0.10, 0.50);
}

function getSauromatianFraction(bloodline: BloodlineEntry[]): number {
  return bloodline
    .filter(e => e.group !== 'imanian') // All non-Imanian groups are Sauromatian
    .reduce((sum, e) => sum + e.fraction, 0);
}
```

### 5.3 Turn Processing

```typescript
function processTurn(state: GameState, rng: SeededRNG): TurnResult {
  // DAWN
  const ageResults = ageAllPeople(state.people, rng);
  const birthResults = processPregnancies(state.people, state.turnNumber, rng);
  const healthResults = processHealthAndMortality(state.people, state.settlement.resources, rng);
  const relationResults = updateRelationships(state.people, rng);
  const productionResults = calculateProduction(state.people, state.settlement, state.currentSeason);

  // EVENT — returns events for UI to present, does not resolve choices
  const eligibleEvents = filterEligibleEvents(allEvents, state);
  const drawnEvents = drawEvents(eligibleEvents, 1 + rng.nextInt(0, 2), rng); // 1–3 events

  // DUSK (called after player makes management + event choices)
  // Applied by a separate resolveDusk() call

  return { ageResults, birthResults, healthResults, drawnEvents, productionResults };
}

function resolveDusk(state: GameState, season: Season): DuskResult {
  const seasonalEffects = applySeasonalEffects(state, season);
  const quotaCheck = season === 'autumn' ? checkAnnualQuota(state) : null;
  const tribeUpdates = updateTribes(state.tribes, state, rng);
  return { seasonalEffects, quotaCheck, tribeUpdates };
}
```

### 5.4 Event Prerequisite Checking

```typescript
function isEventEligible(event: GameEvent, state: GameState): boolean {
  return event.prerequisites.every(prereq => checkPrerequisite(prereq, state));
}

function checkPrerequisite(prereq: EventPrerequisite, state: GameState): boolean {
  switch (prereq.type) {
    case 'min_population':
      return state.settlement.populationCount >= prereq.params.value;
    case 'season_is':
      return state.currentSeason === prereq.params.season;
    case 'tribe_exists':
      return state.tribes.has(prereq.params.tribeId);
    case 'has_person_matching':
      return findMatchingPerson(state.people, prereq.params.criteria) !== null;
    case 'company_standing_above':
      return state.company.standing > prereq.params.value;
    // ... etc
  }
}
```

---

## 6. Zustand Store Design

```typescript
interface GameStore {
  // State
  gameState: GameState | null;
  currentPhase: TurnPhase;           // 'dawn' | 'event' | 'management' | 'dusk' | 'idle'
  pendingEvents: GameEvent[];
  currentEventIndex: number;

  // Actions — game lifecycle
  newGame: (config: GameConfig) => void;
  loadGame: (saveData: string) => void;
  saveGame: () => string;

  // Actions — turn flow
  startTurn: () => void;             // Runs dawn phase, populates pendingEvents
  resolveEventChoice: (eventId: string, choiceId: string) => void;
  nextEvent: () => void;
  enterManagementPhase: () => void;
  endTurn: () => void;               // Runs dusk phase, advances season

  // Actions — management phase
  assignRole: (personId: string, role: WorkRole) => void;
  arrangeMarriage: (personIds: string[]) => void;
  executeTrade: (partnerId: string, offer: TradeOffer) => void;
  sendDiplomaticAction: (tribeId: string, action: DiplomaticAction) => void;

  // Derived state (computed, not stored)
  getPersonById: (id: string) => Person | undefined;
  getLivingPeople: () => Person[];
  getSettlementCulture: () => SettlementCulture;
  getFamilyOf: (personId: string) => Person[];
}
```

---

## 7. Implementation Phases

### Phase 1: Foundation ("Ten Men in the Wilderness")

**Goal:** Playable turn loop with basic population and a handful of events.

| Step | Deliverable | Files Created |
|------|-------------|--------------|
| 1 | ✅ Project scaffolding | package.json, vite.config, tsconfig, tailwind.config |
| 2 | ✅ Seeded RNG utility | utils/rng.ts + rng.test.ts |
| 3 | ✅ Math utilities | utils/math.ts, utils/id.ts |
| 4 | ✅ Person interface + factory | simulation/population/person.ts |
| 5 | ✅ GeneticProfile (Imanian only) | simulation/genetics/traits.ts |
| 6 | ✅ GameState interface | simulation/turn/game-state.ts |
| 7 | ✅ Zustand store (full lifecycle + council + events) | stores/game-store.ts |
| 8 | ✅ Turn processor with seasonal modifiers | simulation/turn/turn-processor.ts, season.ts |
| 9 | ✅ Resource system (food, cattle, goods + 6 more) | simulation/economy/resources.ts |
| 10 | ✅ Event engine + 10 events across 5 categories | simulation/events/ (engine.ts, event-filter.ts, resolver.ts, definitions/) |
| 11 | ✅ KoDP-style UI shell | ui/layout/ (LeftNav, TopBar, BottomBar, CouncilFooter, GameScreen), ui/views/ |
| 12 | ✅ Game setup screen | ui/overlays/GameSetup.tsx |
| 13 | ✅ Save/load | localStorage integration |

**Exit criteria:** Start a game, see 10 Imanian men, advance turns, respond to events, watch resources change.

### Phase 2: Genetics Engine ("Children of Two Worlds")

| Step | Deliverable | Files Created/Modified |
|------|-------------|----------------------|
| 1 | All ethnic trait distributions | data/ethnic-distributions.ts |
| 2 | resolveInheritance() with blending | simulation/genetics/inheritance.ts |
| 3 | Gender ratio mechanics | simulation/genetics/gender-ratio.ts |
| 4 | Fertility + pregnancy system | simulation/genetics/fertility.ts |
| 5 | Heritage + bloodline tracking | Heritage interface implemented |
| 6 | Name generation by culture | simulation/population/naming.ts |
| 7 | Text-based portrait generation | ui/components/Portrait.tsx |
| 8 | Marriage system | simulation/population/marriage.ts |
| 9 | External tribes (data + basic AI) | simulation/world/tribes.ts |
| 10 | 15+ cultural/domestic events | events/definitions/ expanded |
| 11 | PersonDetail view | ui/views/PersonDetail.tsx |
| 12 | Family tree viewer | ui/views/FamilyTree.tsx |

**Exit criteria:** Marry Sauromatian women, have children with blended traits, see demographics shift over a generation.

### Phase 3: Living Settlement ("A Place Called Home")

| Step | Deliverable |
|------|-------------|
| 1 | Full economy (all 8 resource types) |
| 2 | Company quota with sliding consequences |
| 3 | Trade system (Company, tribal, passing merchants) |
| 4 | Diplomacy with tribes |
| 5 | Cultural simulation (language, religion, settlement culture) |
| 6 | Combat resolution system |
| 7 | 30+ events across all categories |
| 8 | Population scaling UI (household view, demographic charts) |
| 9 | Regional map (Canvas 2D) |
| 10 | Seasonal effects and environmental events |
| 11 | Opinion/relationship system active |

**Exit criteria:** Guide a settlement through 50+ years with trade, diplomacy, and cultural transformation.

### Phase 4: Polish ("The Ashmark Remembers")

| Step | Deliverable |
|------|-------------|
| 1 | 100+ events with branching chains |
| 2 | Layered sprite portrait system |
| 3 | Trait effects on autonomous behavior |
| 4 | Tribe AI (migration, splitting, Cult probes) |
| 5 | Building/construction system |
| 6 | Education system (schools, apprenticeships) |
| 7 | Council/advisory system at higher pop |
| 8 | Achievements and milestones |
| 9 | Multiple starting scenarios |
| 10 | Balance and playtesting pass |

### Future Expansion Slots

- Weri / Avari peoples (new ethnic groups, distributions, events)
- Mood and needs module (DF-style dynamic inner life)
- Magic and the Veil (Ansidhe, supernatural events, Cult corruption)
- Confederate contact (Three Cities trade)
- Spatial settlement map (buildings, walls, districts)
- Sound and music

---

## 8. Testing Strategy

### Unit Tests (Vitest)

**Genetics:** Run inheritance resolution 10,000 times for each ethnic pairing. Verify skin tone means fall within expected ranges. Verify gender ratios match lore values (±5%). Verify extended fertility is always maternally inherited.

**Demographics:** Run a headless 100-year simulation starting with 10 Imanian men + 10 Kiswani Riverfolk women. Verify population curve is reasonable. Verify gender ratio stabilizes at expected blend. Verify no orphaned references (dead parent IDs still valid in graveyard).

**Events:** Verify prerequisite filtering correctly includes/excludes events. Verify consequence application mutates state correctly. Verify cooldowns prevent re-firing.

**RNG:** Verify deterministic output from known seeds. Verify Gaussian distribution has correct mean/stddev over 100,000 samples.

### Integration Tests

Run a full game from new-game to turn 40 (10 years) headlessly. Verify no crashes, no NaN values, no broken references. Verify save/load roundtrip preserves state exactly.

### Manual Playtesting

After each phase, play through 20+ years manually. Document events that feel wrong, demographics that seem off, UI friction points.

---

## 9. Copilot Prompts

### Phase 1, Milestone 1: Project Bootstrap

```
Build Phase 1, Milestone 1 of the Palusteria game — a React + TypeScript project.

1. Bootstrap with: npm create vite@latest palusteria-game -- --template react-ts
2. Install: zustand, tailwindcss, postcss, autoprefixer
3. Configure Tailwind for src/ directory
4. Install dev dependency: vitest

Create these files:

src/utils/rng.ts
  - Seeded PRNG using mulberry32 algorithm
  - Factory: createRNG(seed: number)
  - Methods: next() → 0–1, nextInt(min, max), pick(array), 
    weightedPick(options: Record<string, number>), gaussian(mean, stddev)
  - All methods must consume from the same seed state (deterministic sequence)

src/utils/math.ts
  - lerp(a, b, t), clamp(val, min, max), inverseLerp(a, b, val)

src/utils/id.ts
  - generateId() using incrementing counter with random prefix

tests/utils/rng.test.ts
  - Test deterministic output: same seed → same sequence
  - Test nextInt bounds
  - Test gaussian distribution mean over 10,000 samples

Use strict TypeScript. No 'any' types. JSDoc comments on all exported functions.
```

### Phase 1, Milestone 2: Data Models

```
Create the core data model interfaces for the Palusteria game.

Reference: PALUSTERIA_ARCHITECTURE.md sections 4.1 through 4.11

Create these files:

src/simulation/genetics/traits.ts
  - VisibleTraits, GeneticProfile, TraitDistribution, GaussianDist, WeightedDist interfaces
  - Undertone, HairColor, HairTexture, EyeColor, BuildType, HeightClass, FacialStructure types
  - IMANIAN_TRAITS constant (the Imanian trait distribution)
  - Export everything with JSDoc comments

src/simulation/population/person.ts
  - Person interface (all fields from architecture doc §4.1)
  - Heritage, BloodlineEntry, EthnicGroup, CultureId types
  - FertilityProfile, HealthState, PregnancyState, HealthCondition
  - createPerson(options: CreatePersonOptions) factory that builds a complete Person
  - CreatePersonOptions should accept overrides for any field

src/simulation/turn/game-state.ts
  - GameState interface (all fields from §4.11)
  - Season enum, GameConfig, Settlement, GraveyardEntry, EventRecord interfaces
  - ResourceType, ResourceStock types
  - CompanyRelation interface with support levels

src/simulation/personality/traits.ts
  - TraitDefinition, TraitEffect, TraitEffectTarget interfaces
  - TraitId type (union of all trait string IDs)
  - TraitCategory type

src/simulation/events/engine.ts
  - GameEvent, EventChoice, EventConsequence interfaces
  - EventCategory, ConsequenceType, PrerequisiteType types
  - EventPrerequisite, ActorRequirement interfaces

No implementation logic yet — just interfaces, types, and the Imanian trait constant.
Strict TypeScript. No 'any'. Comprehensive JSDoc.
```

### Phase 1, Milestone 3: Store + Turn Loop + UI Shell

```
Wire up the Zustand store, turn processor skeleton, and basic UI.

src/stores/game-store.ts
  - Implement GameStore interface from architecture doc §6
  - newGame() creates initial state with 10 Imanian men (using createPerson)
  - startTurn() runs a stub dawn phase (age people by 0.25)
  - endTurn() advances season
  - Save/load to localStorage as JSON

src/simulation/turn/turn-processor.ts
  - processDawn(state, rng): ages people, stub for births/deaths
  - processDusk(state, season): stub for seasonal effects

src/simulation/economy/resources.ts
  - calculateProduction(people, settlement, season) → ResourceStock delta
  - calculateConsumption(people) → ResourceStock delta
  - Simple: each person eats 1 food/season. Farmers produce 3 food. Traders produce 1 trade good.

src/ui/layout/GameScreen.tsx — main layout with TopBar and content area
src/ui/layout/TopBar.tsx — displays: season, year, food, gold, trade goods, population count
src/ui/views/PeopleView.tsx — list of all people with name, age, role
src/ui/views/EventView.tsx — displays event title, description, choice buttons (stub data)
src/App.tsx — routes between GameSetup and GameScreen

Use Tailwind for all styling. Warm earth-tone color palette.
"End Turn" button advances the turn and shows results.
```

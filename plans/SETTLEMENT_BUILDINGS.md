# Settlement Buildings & Upgrades — Design Document

**Phase:** 3 (immediate next step)  
**Status:** Design approved, ready to implement  
**Companion Documents:** `PALUSTERIA_ARCHITECTURE.md`, `PALUSTERIA_GAME_DESIGN.md`

---

## 1. Overview

The settlement starts with a single **Camp** — basic shelter and storage. From there, the player expands by constructing buildings that improve production, open new roles, grow skills, shape cultural identity, and make the settlement habitable for a growing population.

Construction is time-based and **workforce-limited**: there is no arbitrary queue cap. The constraint is people — builders pulled from their normal roles don't farm, trade, or guard. The player decides how aggressively to build versus sustaining production.

---

## 2. Core Mechanics

### 2.1 Construction Queue

- `settlement.constructionQueue: ConstructionProject[]` — any number of simultaneous projects
- Each project only advances if it has at least one assigned worker
- Projects with zero workers sit frozen in the queue indefinitely
- Players may have a Granary started in summer (two workers) while a Palisade waits in the queue for winter when farm labor is cheap

### 2.2 Progress Formula

```
progressPoints += assignedWorkers.length × (1 + avgCustomSkill / 100) × 100
```

- `totalPoints = seasons × 100` (1 season = 100 points)
- A 2-season build needs 200 points
- 1 worker at `custom` skill 50 → +150/season → finishes in 2 seasons (as intended)
- 2 workers at `custom` skill 50 → +300/season → finishes in 1 season (acceleration)
- 0 workers → no progress, project freezes

### 2.3 Worker Assignment

- Assigning a person to a project sets `person.role = 'builder'`
- `'builder'` role produces zero food/goods — this is the direct cost of construction
- When a project **completes** or is **cancelled**, all assigned workers' roles reset to `'unassigned'` (player manually reassigns them)
- A person can only be assigned to one project at a time (validated in store action)

### 2.4 Resource Deduction

- Resources are deducted **immediately** when construction starts (not on completion)
- If cancelled, **50% of spent resources** are refunded (rounded down)

### 2.5 Civic Upgrade Chain

The main shelter building (Camp → tier 2 → tier 3) uses a **replace** mechanic:
- `BuildingDef.replacesId?: BuildingId` — when a building completes, the referenced building is removed from `settlement.buildings`
- Only one civic tier can exist at a time; the new one inherits the slot
- A tier 2 building cannot be started unless the tier 1 building is present

---

## 3. Building Catalog

### 3.1 Civic Upgrade Chain (one active at a time)

| Building | Tier | Style | Cost | Build Time | Shelter | Key Effects |
|---|---|---|---|---|---|---|
| **Camp** | 1 | neutral | free | — (given) | 15 | Basic shelter; all resources accessible |
| **Longhouse** | 2 | imanian | 15 lumber + 5 stone | 2 seasons | 30 | Culture pull +imanian; `leadership` skill growth for council members |
| **Roundhouse** | 2 | sauromatian | 20 lumber | 2 seasons | 30 | Culture pull +sauromatian; `plants` skill growth bonus |
| **Great Hall** | 3 | imanian | 25 lumber + 20 stone | 3 seasons | 60 | Culture pull +imanian (strong); `leadership` uncap; social space capacity 50 |
| **Clan Lodge** | 3 | sauromatian | 30 lumber + 5 gold | 3 seasons | 60 | Culture pull +sauromatian (strong); `leadership` uncap; social space capacity 50 |

> Longhouse and Roundhouse both set `replacesId: 'camp'`.
> Great Hall sets `replacesId: 'longhouse'`; Clan Lodge sets `replacesId: 'roundhouse'`.
> Only one tier-2 style can exist, so a settlement that built a Roundhouse cannot build a Longhouse without first having a Great Hall path — but a player who built a Roundhouse can still upgrade to a Great Hall (Imanian), paying the cultural inconsistency in drift effects.

### 3.2 Additive Specialist Buildings (never replaced; stack additively)

| Building | Cost | Build Time | Key Effects |
|---|---|---|---|
| **Granary** | 10 lumber + 5 stone | 1 season | +2 food/season flat; winter food decay halved |
| **Workshop / Forge** | 10 lumber + 8 steel | 2 seasons | +1 goods per craftsman per season; `custom` skill growth +1/season per craftsman |
| **Trading Post** | 12 lumber + 5 gold | 2 seasons | +1 goods per trader per season; Tradetalk drift rate ×2; unlocks Company deal events |
| **Healer's Hut** | 8 lumber + 5 medicine | 1 season | Healer role efficiency ×2; `plants` skill growth +1/season per healer |
| **Gathering Hall** | 10 lumber | 1 season | Language drift ×1.5 settlement-wide; social space (characters interact); style variants below |
| **Palisade** | 20 lumber + 5 stone | 2 seasons | +20% defense strength; guard effectiveness ×1.5; raid event frequency reduced |
| **Stable** | 10 lumber + 3 horses (herd) | 1 season | +1 horse/season (breeding); `animals` skill growth +1/season per animal handler; unlocks future scout role |

#### Gathering Hall Style Variants

The Gathering Hall has two style options that affect drift:

| Style | Effect |
|---|---|
| **Meeting House** (imanian) | Language drift bonus applies with slight Imanian cultural pull |
| **Longfire** (sauromatian) | Language drift bonus applies with slight Sauromatian cultural pull |

---

## 4. Data Model

### 4.1 New & Modified Types in `game-state.ts`

```typescript
// Replace the placeholder:
export type BuildingId =
  | 'camp'
  | 'longhouse'
  | 'roundhouse'
  | 'great_hall'
  | 'clan_lodge'
  | 'granary'
  | 'workshop'
  | 'trading_post'
  | 'healers_hut'
  | 'gathering_hall'
  | 'palisade'
  | 'stable';

export type BuildingStyle = 'imanian' | 'sauromatian';

/** A building that has been completed and exists in the settlement. */
export interface BuiltBuilding {
  defId: BuildingId;
  /** Unique instance identifier (e.g. 'granary_0'). Allows multiple of same type in future. */
  instanceId: string;
  /** The turn on which construction completed (0 for the starting Camp). */
  builtTurn: number;
  /** Cultural style, if applicable. null for style-neutral buildings. */
  style: BuildingStyle | null;
}

/** An in-progress construction project. */
export interface ConstructionProject {
  /** Unique project identifier. */
  id: string;
  defId: BuildingId;
  style: BuildingStyle | null;
  /** Accumulated progress points this season. Advances when workers are assigned. */
  progressPoints: number;
  /** Total points needed to complete. Equals seasons × 100. */
  totalPoints: number;
  /** IDs of people currently assigned as builders for this project. */
  assignedWorkerIds: string[];
  /** Turn number on which construction started (for display). */
  startedTurn: number;
  /** Resources already deducted (for partial refund on cancel). */
  resourcesSpent: Partial<ResourceStock>;
}

// Modify Settlement:
export interface Settlement {
  name: string;
  location: LocationId;
  buildings: BuiltBuilding[];          // was BuildingId[]
  constructionQueue: ConstructionProject[];  // NEW
  resources: ResourceStock;
  populationCount: number;
}
```

### 4.2 New PersonRole in `person.ts`

```typescript
export type WorkRole =
  | 'farmer'
  | 'trader'
  | 'guard'
  | 'craftsman'
  | 'healer'
  | 'builder'       // NEW — assigned to a construction project
  | 'unassigned';
```

### 4.3 BuildingDef Interface (new file)

```typescript
// src/simulation/buildings/building-definitions.ts

export interface BuildingDef {
  id: BuildingId;
  /** Display name. */
  name: string;
  /** Flavour description shown in the build menu. */
  description: string;
  /** Whether this building has cultural style variants. */
  hasStyleVariants: boolean;
  /** Resource cost to start construction. */
  cost: Partial<ResourceStock>;
  /** Construction time in seasons. Each season = 100 progress points. */
  buildSeasons: number;
  /** If set, the building with this ID is removed on completion (upgrade chain). */
  replacesId?: BuildingId;
  /** BuildingId that must be present before this can be started. null = no prerequisite. */
  requires?: BuildingId;
  /** Shelter capacity this building provides. Replaces the prior if in the civic chain. */
  shelterCapacity: number;
  /** Flat resource production bonus applied each season this building is present. */
  productionBonus?: Partial<ResourceStock>;
}
```

---

## 5. Building Effects

### 5.1 New File: `src/simulation/buildings/building-effects.ts`

All functions are **pure** — they take the array of built buildings and return modifiers.

```typescript
/** Flat production bonus from all buildings combined. Applied after role-based production. */
function getBuildingProductionBonus(buildings: BuiltBuilding[]): Partial<ResourceStock>

/** Per-person production bonus by role (e.g. Workshop gives craftsmen +1 goods/season). */
function getRoleProductionBonus(buildings: BuiltBuilding[], role: WorkRole): Partial<ResourceStock>

/** Multiplier on child mortality chance. Healer's Hut: ×0.5 (30% → 15% base). */
function getChildMortalityModifier(buildings: BuiltBuilding[]): number

/** Multiplier on language drift rate settlement-wide. Gathering Hall: ×1.5. */
function getLanguageDriftMultiplier(buildings: BuiltBuilding[]): number

/** Culture pull modifiers from building styles. Returns a list of {culture, strength} pairs. */
function getBuildingCulturePull(buildings: BuiltBuilding[]): CulturePullModifier[]

/** Defense strength multiplier applied during raid events. Palisade: +0.20. */
function getDefenseBonus(buildings: BuiltBuilding[]): number

/** Total shelter capacity across all civic buildings. */
function getShelterCapacity(buildings: BuiltBuilding[]): number

/** Per-season skill growth bonuses for a person by role. */
function getSkillGrowthBonuses(
  buildings: BuiltBuilding[],
  person: Person,
): Partial<Record<SkillId, number>>

/** True when winter food decay should be halved (Granary present). */
function hasWinterFoodProtection(buildings: BuiltBuilding[]): boolean
```

### 5.2 Culture Pull Mechanic

Each season in `processCulturalDrift()`, building culture pull is applied as an additional drift nudge on top of community pull:

| Source | Pull strength per season | Direction |
|---|---|---|
| Longhouse | +0.005 | toward imanian |
| Roundhouse | +0.005 | toward sauromatian |
| Great Hall | +0.015 | toward imanian |
| Clan Lodge | +0.015 | toward sauromatian |
| Meeting House (Gathering Hall) | +0.003 | toward imanian |
| Longfire (Gathering Hall) | +0.003 | toward sauromatian |

Applied to **every living person** as a tiny per-season push on their `culturalFluency` map — feeding naturally into `primaryCulture` calculation already in `processCulturalDrift()`.

### 5.3 Skill Growth Bonuses

Applied **once per season** per person in a matching role when the relevant building is present:

| Building | Role | Skill | Bonus/season |
|---|---|---|---|
| Workshop | craftsman | `custom` | +1 |
| Trading Post | trader | `bargaining` | +1 |
| Healer's Hut | healer | `plants` | +1 |
| Stable | (any, animals role) | `animals` | +1 |
| Longhouse / Great Hall | council member | `leadership` | +1 |
| Longhouse / Great Hall | council member | `custom` | +1 (construction artisanship lore) |

These stack with existing generation but are capped at 100.

---

## 6. Overcrowding System

### 6.1 Definitions

```
overcrowdingRatio = settlement.populationCount / getShelterCapacity(buildings)
```

Overcrowding begins when `overcrowdingRatio > 1.0`. The Camp provides shelter for 15 people. The founding party of ~10 is safe, but as children are born the pressure begins.

### 6.2 Mechanical Penalties

| Threshold | Penalty |
|---|---|
| ratio > 1.0 | Child mortality +25% (cramped, poor sanitation) |
| ratio > 1.25 | +25% child mortality stacks; all production −10% (morale/fatigue) |
| ratio > 1.5 | All above; natural death chance +20% for elderly (weakened by hardship) |

These are multipliers/additions applied **inside the existing mortality and production calculations** — no new infrastructure needed.

### 6.3 Bad Events (Overcrowding-Gated)

Three new events, all behind prerequisite `'overcrowded': true` (new `PrerequisiteType`):

#### `bld_fever_spreads`
> *"The camp reeks of illness. In quarters this cramped, sickness passes from hammock to hammock overnight."*

- **Prerequisite:** overcrowded + `season_is: winter` (worst in winter)
- **Choice A — Isolate the sick:** skill check (`plants`, difficulty 45). Success: one person gets `'sickly'` trait (temporary); failure: one person dies, one more gets `'sickly'`
- **Choice B — Carry on:** one random person under 10 dies. No skill check.
- **Consequence:** fires a `build_something_please` deferred event 2 turns later, urging the player to expand shelter

#### `bld_bitter_quarrel`
> *"{actor1} and {actor2} came to blows last night — tempers run high when twelve people share four walls."*

- **Prerequisite:** overcrowded; 2 adults with different `primaryCulture` (cross-cultural tension)
- **Choice A — Separate them (assign to different tasks):** one of them gains a one-season work penalty; tension diffuses
- **Choice B — Make an example (punish the instigator):** instigator gains `'bitter'` mood flag (future opinion system hook); short-term order restored
- **Choice C — Let them work it out:** opinion hit between the two; small chance one gains `'scarred'` (earned trait introduction)
- **Actors:** two `has_person_matching` slots with criteria `{ minAge: 16, maxAge: 60 }`

#### `bld_someone_leaves`
> *"{actor} has had enough. They pack their belongings quietly and are gone before dawn."*

- **Prerequisite:** overcrowded + `min_year: 3` (people give it a chance first) + population ≥ 12
- **No choices** — unavoidable loss, reflects the stakes of neglecting shelter
- **Consequence:** actor is removed permanently from the settlement (not graveyard — they simply leave). If the actor had a spouse, spouse gains an opinion penalty. If actor was a council member, they vacate their seat.
- This event fires at most once per 8 turns (`cooldown: 8`)

---

## 7. Settlement View UI

### 7.1 Layout: `src/ui/views/SettlementView.tsx`

Three-panel vertical layout:

```
┌─────────────────────────────────────────────────────┐
│  SETTLEMENT — The Ashmark Outpost                   │
│  Population 12 / Shelter 15  [██████████░░░░░] 80%  │
│  ─────────────────────────────────────────────────  │
│  BUILT BUILDINGS                                    │
│  [Camp]  [Granary] ← card grid                     │
│                                                     │
│  UNDER CONSTRUCTION                                 │
│  [Longhouse ████░░ 1.5/2 seasons]                  │
│    Builders: Aldric (custom VG), Mira (custom FR)   │
│    [+ Assign Builder] [Cancel]                      │
│                                                     │
│  BUILD NEW                                          │
│  [Granary] [Workshop] [Trading Post] ...            │
└─────────────────────────────────────────────────────┘
```

### 7.2 Shelter Bar

A linear progress bar at the top showing `populationCount / shelterCapacity`:
- Green when ratio ≤ 0.8
- Amber when 0.8 < ratio ≤ 1.0
- Red + pulse animation when ratio > 1.0 (overcrowded)
- Shows a tooltip: *"12 settlers, shelter for 15. Build a Longhouse to expand."*

### 7.3 Built Building Cards

Each card shows:
- Building name + style badge (amber `IMANIAN` / teal `SAUROMATIAN`)
- Icon placeholder (letter silhouette for now)
- Active effects as a bullet list: *"+2 food/season", "Guards are 50% more effective"*
- Small footer: *"Built turn 4" / "Starting structure"*

The current civic building gets a subtle left-border highlight and "Tier 2 of 3" indicator.

### 7.4 Active Construction Panel

One card per in-progress project showing:
- Name + estimated completion (*"~1 season with current workers"*)
- A segmented progress bar (`progressPoints / totalPoints`)
- Assigned builders with their `custom` skill rating badge
- **[+ Assign Builder]** — opens a small person selector filtered to available (non-pregnant, adult, not in another project) settlers, sorted by `custom` skill descending
- **[Cancel Construction]** — confirmation prompt showing exact refund amount

### 7.5 Build Menu Cards

Grouped: **Shelter Upgrades** | **Food & Storage** | **Industry** | **Defence** | **Other**

Each card:
- Name, description (1 line), construction time, cost breakdown with resource icons
- If `hasStyleVariants`: two buttons **"Build — Imanian"** / **"Build — Sauromatian"** with a one-line cultural effect note on each
- If can't afford: grayed-out with exact shortfall (*"Need 3 more lumber"*)
- If prereq missing: grayed-out with *"Requires: Camp"*
- If already built: *"Already built"* badge
- Cultural variant tooltip: *"Imanian style pulls settlers toward Ansberite identity. Sauromatian style reinforces traditional ways."*

---

## 8. Turn Processor Integration

### 8.1 Additions to `processDawn()` in `turn-processor.ts`

Insert a **new step 4.5** — Process Construction — after child mortality and before production:

```typescript
// 4.5 Advance all construction projects with assigned workers.
const constructionResult = processConstruction(
  state.settlement,
  updatedPeople,
  state.turnNumber,
  rng,
);
// constructionResult.completedBuildings: BuiltBuilding[] — newly finished this turn
// constructionResult.updatedQueue: ConstructionProject[] — remaining projects
// constructionResult.completedWorkerIds: string[] — auto-reset to 'unassigned'
for (const workerId of constructionResult.completedWorkerIds) {
  const w = updatedPeople.get(workerId);
  if (w) updatedPeople.set(workerId, { ...w, role: 'unassigned' });
}
```

**Step 5 (production):** Pass `constructionResult.updatedBuildings` to `calculateProduction()`, which applies `getRoleProductionBonus()` per person.

**Step 4 (child mortality):** Multiply base chance by `getChildMortalityModifier(buildings)`.

**Step 7 (language drift):** Multiply the per-person drift delta by `getLanguageDriftMultiplier(buildings)`.

**Step 8 (cultural drift):** After existing drift logic, apply `getBuildingCulturePull(buildings)` to each person — a tiny per-person nudge toward the dominant building style.

**New step 8.5 — Skill growth from buildings:**
```typescript
for (const [id, person] of updatedPeople) {
  const bonuses = getSkillGrowthBonuses(buildings, person);
  if (Object.keys(bonuses).length > 0) {
    const newSkills = { ...person.skills };
    for (const [skill, bonus] of Object.entries(bonuses)) {
      newSkills[skill as SkillId] = Math.min(100, (newSkills[skill as SkillId] ?? 0) + bonus);
    }
    updatedPeople.set(id, { ...person, skills: newSkills });
  }
}
```

**New DawnResult fields:**
```typescript
completedBuildings: BuiltBuilding[];     // for store to merge into settlement.buildings
updatedConstructionQueue: ConstructionProject[];
```

### 8.2 Overcrowding in `processDawn()`

The overcrowding ratio is computed at the **end** of step 1 (after aging):

```typescript
const shelterCapacity = getShelterCapacity(state.settlement.buildings);
const overcrowdingRatio = updatedPeople.size / shelterCapacity;
```

Passed to child mortality (step 4) and natural death (step 3) as a modifier:
- `overcrowdingRatio > 1.0`: child mortality base ×1.25
- `overcrowdingRatio > 1.25`: child mortality base ×1.50; production shrunken by 10%
- `overcrowdingRatio > 1.50`: elderly death chance ×1.20

The ratio is also stored in `DawnResult` so the store can expose it to the event system for overcrowding-gated events.

---

## 9. Store Actions

New actions in `game-store.ts`:

```typescript
// Start a new construction project. Validates canBuild(), deducts resources, pushes to queue.
startConstruction(defId: BuildingId, style: BuildingStyle | null): void

// Assign a settler as a builder on a specific project. Sets person.role = 'builder'.
// Validated: person must be adult, alive, not already a builder on another project.
assignBuilder(projectId: string, personId: string): void

// Remove a settler from a project. Resets person.role = 'unassigned'.
removeBuilder(projectId: string, personId: string): void

// Cancel a project: refund 50% resources, free workers, remove from queue.
cancelConstruction(projectId: string): void
```

`startTurn()` in the store processes `DawnResult.completedBuildings`:
- For each completed building: push to `settlement.buildings`, remove `replacesId` if set
- Update `settlement.constructionQueue` to `DawnResult.updatedConstructionQueue`

**Initial state Camp:**
```typescript
settlement: {
  ...
  buildings: [{
    defId: 'camp',
    instanceId: 'camp_0',
    builtTurn: 0,
    style: null,
  }],
  constructionQueue: [],
}
```

---

## 10. Event Engine Additions

### 10.1 New `PrerequisiteType` values in `engine.ts`

```typescript
| 'has_building'          // params: { buildingId: BuildingId }
| 'lacks_building'        // params: { buildingId: BuildingId }
| 'construction_active'   // params: {} — true when constructionQueue.length > 0
| 'overcrowded'           // params: {} — true when populationCount > shelterCapacity
```

### 10.2 New Events (new file `src/simulation/events/definitions/building.ts`)

Three events listed in section 6.3:
- `bld_fever_spreads`
- `bld_bitter_quarrel`
- `bld_someone_leaves`

Plus two positive events:
- `bld_completion_toast` — fires the turn a civic building (tier 2 or 3) completes; morale speech, council member gains `leadership` +2
  - Prereq: `construction_active: false` + deferred trigger from dawn completion
- `bld_traders_notice` — fires 2–4 turns after Trading Post is finished; a passing trade contact arrives, offering a small barter
  - Prereq: `has_building: 'trading_post'`; fires once (cooldown prevents repeat)

---

## 11. New Files Summary

| File | Purpose |
|---|---|
| `src/simulation/buildings/building-definitions.ts` | `BuildingDef` interface + `BUILDING_CATALOG` constant (10 entries) |
| `src/simulation/buildings/construction.ts` | `canBuild`, `startConstruction`, `processConstruction`, `assignBuilder`, `removeBuilder`, `cancelConstruction` |
| `src/simulation/buildings/building-effects.ts` | All pure effect-getter functions |
| `src/ui/views/SettlementView.tsx` | Full settlement view: shelter bar, built cards, construction panel, build menu |
| `src/simulation/events/definitions/building.ts` | 5 building events |
| `tests/buildings/construction.test.ts` | Construction logic tests |
| `tests/buildings/building-effects.test.ts` | Effect getter tests |

---

## 12. Modified Files Summary

| File | Changes |
|---|---|
| `src/simulation/turn/game-state.ts` | `BuildingId` union type; `BuiltBuilding`; `ConstructionProject`; `BuildingStyle`; update `Settlement` |
| `src/simulation/population/person.ts` | Add `'builder'` to `WorkRole` |
| `src/simulation/events/engine.ts` | Add 4 new `PrerequisiteType` members |
| `src/simulation/events/event-filter.ts` | Add handlers for the 4 new prerequisite types |
| `src/simulation/economy/resources.ts` | Add `buildings` param to `calculateProduction()`; apply role-based building bonuses |
| `src/simulation/turn/turn-processor.ts` | Step 4.5 (construction), overcrowding modifiers, skill growth step 8.5; new DawnResult fields |
| `src/simulation/population/culture.ts` | Accept `buildingCulturePull` modifier in `processCulturalDrift()` |
| `src/stores/game-store.ts` | 4 new actions; handle DawnResult building fields; Camp in initial state |
| `src/ui/layout/LeftNav.tsx` | Remove `stub: true` from settlement nav item |
| `src/ui/layout/GameScreen.tsx` | Add `case 'settlement': return <SettlementView />` |

---

## 13. Tests Plan

### `tests/buildings/construction.test.ts`

- `canBuild` returns false when resources insufficient
- `canBuild` returns false when prerequisite building absent
- `canBuild` returns false when `replacesId` source not present (e.g. no Camp to replace)
- `startConstruction` deducts correct resources from `ResourceStock`
- `processConstruction` advances `progressPoints` by `workers × skill formula`
- `processConstruction` with zero workers makes no progress
- `processConstruction` completes building when `progressPoints >= totalPoints`
- Completed building appears in `completedBuildings` result
- Completed building's `replacesId` target is removed from `settlement.buildings`
- Workers reset to `'unassigned'` on project completion
- `cancelConstruction` refunds exactly 50% of `resourcesSpent` (floor)
- Multiple simultaneous projects advance independently

### `tests/buildings/building-effects.test.ts`

- `getShelterCapacity`: Camp alone = 15; Camp + Granary = 15 (Granary adds no shelter); Longhouse = 30
- `getBuildingProductionBonus`: Granary adds +2 food flat
- `getRoleProductionBonus`: Workshop gives craftsman +1 goods; non-craftsman gets 0
- `getChildMortalityModifier`: Healer's Hut present → 0.5; absent → 1.0
- `getLanguageDriftMultiplier`: Gathering Hall present → 1.5; absent → 1.0
- `getDefenseBonus`: Palisade → 0.20; no Palisade → 0.0
- `getBuildingCulturePull`: Longhouse → `[{ direction: 'imanian', strength: 0.005 }]`; Great Hall → strength 0.015
- `getSkillGrowthBonuses`: craftsman with Workshop → `{ custom: 1 }`; farmer with Workshop → `{}`

---

## 14. Implementation Sequence

### Step A — Data Foundation (independent)
1. **`game-state.ts`** — Add `BuildingId` union, `BuildingStyle`, `BuiltBuilding`, `ConstructionProject`; update `Settlement`
2. **`person.ts`** — Add `'builder'` to `WorkRole`
3. **`engine.ts`** — Add 4 prerequisite types to `PrerequisiteType`
4. **`building-definitions.ts`** — `BuildingDef` interface + full `BUILDING_CATALOG`

### Step B — Logic (depends on A)
5. **`building-effects.ts`** — All pure effect getters
6. **`construction.ts`** — `canBuild`, `startConstruction`, `processConstruction`, helpers

### Step C — Integration (depends on B)
7. **`resources.ts`** — Extended `calculateProduction()` with building bonuses
8. **`culture.ts`** — Accept building culture pull in `processCulturalDrift()`
9. **`turn-processor.ts`** — All new hooks wired in; updated `DawnResult`
10. **`event-filter.ts`** — New prerequisite type handlers
11. **`game-store.ts`** — New actions; updated initial state; process DawnResult buildings

### Step D — Events (depends on A, can parallel C)
12. **`building.ts`** (events) — 5 new events

### Step E — UI (depends on C)
13. **`SettlementView.tsx`** — Full implementation
14. **`LeftNav.tsx` + `GameScreen.tsx`** — Activate tab

### Step F — Tests (depends on B)
15. **`construction.test.ts`** + **`building-effects.test.ts`**

---

## 15. Exit Criteria

- [ ] `npm test` — all existing 385 tests pass; new building tests pass
- [ ] `npx tsc --noEmit` — zero errors
- [ ] Start new game → Settlement tab active → Camp card visible
- [ ] Pay lumber → start Longhouse → assign 2 workers → advance turns → Longhouse replaces Camp → shelter bar grows
- [ ] Build Gathering Hall → advance turns → see language drift rate increase in PersonDetail
- [ ] Build Workshop → assign craftsman → confirm `custom` skill ticking up in PersonDetail  
- [ ] Reach 16+ settlers with only Camp (shelter 15) → amber overcrowding warning → `bld_fever_spreads` fires in winter
- [ ] Cancel a construction project → verify 50% resource refund

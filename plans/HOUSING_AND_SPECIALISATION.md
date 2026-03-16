# Housing, Ownership & Specialisation — Design Document

**Status:** ✅ Complete · March 2026  
**Depends on:** Phase 4.1 (Happiness System) — complete  
**Touches:** `buildings/`, `economy/`, `population/person.ts`, `population/happiness.ts`, `personality/scheme-engine.ts`, `turn/game-state.ts`, `stores/`

---

## Overview

This revamp addresses three interlocking gaps in the current settlement model:

1. **Personal Housing** — Characters want their own homes. The existing communal civic
   chain stays (Camp → Longhouse → Great Hall) but is supplemented by a private dwelling
   tier that households build and own. Expectations grow over time; being stuck in
   communal quarters after the early years makes people increasingly unhappy.

2. **Worker Slot System** — Production buildings get hard worker caps. No more assigning
   ten farmers to a single Tilled Fields. Each building physically accommodates a finite
   number of workers; extra assignments are blocked in the UI.

3. **Specialisation Roles** — New `WorkRole` values (`blacksmith`, `tailor`, `brewer`,
   `miller`) tied to new production buildings. Characters differentiate from each other
   over time by mastering a trade.

The whole system is knitted together by household ownership (households claim both their
dwelling and their production buildings) and by the autonomy system: characters will
scheme to acquire private housing when conditions allow.

---

## Part 1 — Personal Housing Chain

### 1.1 Design Intent

The communal civic buildings (Camp, Longhouse, Roundhouse, Great Hall, Clan Lodge) remain
the backbone of early-game housing. They serve as:
- The mandatory starting shelter
- Overflow housing for new immigrants, unattached characters, thralls, young people who
  haven't yet formed a household

Private dwellings exist on a **separate track**, not an upgrade chain. Multiple instances
of each tier can be built. Each is claimed by one household on completion.

### 1.2 Dwelling Tiers

| `BuildingId`   | Name        | Cost              | Seasons | Beds | Notes |
|----------------|-------------|-------------------|---------|------|-------|
| `wattle_hut`   | Wattle Hut  | 3 lumber          | 1       | 4    | First private shelter — modest but their own |
| `cottage`      | Cottage     | 8 lumber, 4 stone | 2       | 6    | A proper family home |
| `homestead`    | Homestead   | 15 lumber, 8 stone| 3       | 8    | Room to grow; children thrive here |
| `compound`     | Compound    | 25 lumber, 15 stone, 5 gold | 4 | 12 | A private estate; enables household production |

**Rules:**
- Category: `'dwelling'` (new category alongside existing `civic`, `food`, etc.)
- `allowMultiple: true` on these definitions — the "already constructed" guard in `canBuild()`
  is bypassed for this category
- No `replacesId` — they do not demolish communal buildings
- Each completed dwelling is immediately claimable by a Household; unclaimed dwellings
  provide shelter capacity but no personal happiness bonus
- Shelter capacity from dwellings stacks with communal shelter capacity in `getShelterCapacity()`

### 1.3 Happiness Effects

#### Dwelling tier bonus (material category)
Applied when `person.claimedBuildingId` points to a dwelling building that is owned by
their household (`household.dwellingBuildingId`):

| Tier           | Happiness delta |
|----------------|----------------|
| `wattle_hut`   | +8 material — "A roof to call their own" |
| `cottage`      | +15 material — "A proper home" |
| `homestead`    | +22 material — "Built to last" |
| `compound`     | +30 material — "An estate of their own" |

#### Time-based expectation pressure
Computed in `computeHappinessFactors()`:

```
If currentYear >= 5 AND person has no claimed dwelling:
  yearsWaiting = currentYear - 5
  delta = -clamp(yearsWaiting × 3, 0, 20)
  label: "Still waiting for a home of their own"
```

Applies to any adult (age ≥ 18) who has been in the settlement for at least 2 years
(tracked via `person.joinedYear` — see §6.1).

#### Relative jealousy
```
If any dwelling building exists in settlement AND person has no claimed dwelling:
  delta = -8 social — "Others have homes; they do not"
```

The two factors stack, so by year 10 a houseless adult in a settled community suffers up
to −28 points. The maximum combined penalty is −28 (−20 time-based + −8 relative), which
pushes a neutral person toward Restless/Discontent but doesn't alone cause desperation.

#### Communal overflow penalty
Characters still in communal housing after year 3 take a very light penalty as a nudge:
```
If currentYear >= 3 AND person has no claimed dwelling AND a dwelling exists:
  // already covered by relative jealousy above — no separate penalty
```

---

## Part 2 — Household Ownership Model

### 2.1 Data Model Changes

**`Household` (game-state.ts)** — two new fields:

```typescript
/** The BuiltBuilding instanceId of the household's private dwelling. null = communal. */
dwellingBuildingId: string | null;

/**
 * InstanceIds of production buildings claimed by this household.
 * Workers in the household have designated access; they still count
 * against the building's worker slot cap.
 */
productionBuildingIds: string[];
```

**`BuiltBuilding` (game-state.ts)** — one new field:

```typescript
/**
 * The household that owns this building. null = communal (no household claim).
 * Communal buildings (Camp, Longhouse, etc.) are always null.
 * Dwellings are claimed by the household that built them.
 * Production buildings can optionally be claimed by a household.
 */
ownerHouseholdId: string | null;
```

`claimedByPersonIds` already exists on `BuiltBuilding` and is retained for the
per-person dwelling link. It will continue to track which Person IDs live in a dwelling.

**`Person` (person.ts)** — `claimedBuildingId` already exists; semantics extended:

```
person.claimedBuildingId = instanceId of the dwelling they live in (null = communal).
```

For production buildings, ownership is tracked at Household level, not Person level.
The Person just has their `role` (e.g. `blacksmith`) and the building's `assignedWorkerIds`
tracks who is working there.

### 2.2 Assignment Logic

**Dwelling claim flow:**
1. A construction project completes
2. If `def.category === 'dwelling'`, the building is added with `ownerHouseholdId` set to
   the household that initiated construction (stored on the project — see §5.1)
3. All current `memberIds` of that household who have no `claimedBuildingId` are
   auto-assigned (`person.claimedBuildingId = building.instanceId`)
4. The household's `dwellingBuildingId` is updated

**Production building claim:**
- Optional — the player may mark a production building as owned by a household
- The household gains `productionBuildingIds.push(instanceId)`
- The building gains `ownerHouseholdId = household.id`
- Household members may be assigned to it up to slot capacity like anyone else
- Ownership has no mechanical effect on current production math — it's a social signal
  that drives scheme goals and the autonomy system

---

## Part 3 — Worker Slot System

### 3.1 New `BuildingDef` Field

```typescript
/**
 * Maximum number of workers that can be simultaneously assigned to this building.
 * Only relevant to production buildings — civic/defence buildings are passive.
 *
 * undefined = no cap (building has no worker association).
 * 0 = building is passive (Granary, Palisade, Stable — they contribute flat bonuses
 *     with no assigned workers).
 */
workerSlots?: number;
```

### 3.2 New `BuiltBuilding` Field

```typescript
/**
 * IDs of people currently assigned as workers in this production building.
 * Updated by role assignment in the store. Checked against workerSlots
 * before allowing new assignments.
 */
assignedWorkerIds: string[];
```

(Note: this field already exists on `ConstructionProject`; it is now also needed on
`BuiltBuilding` to track active production workers.)

### 3.3 Worker Slot Caps — Full Building Table

Existing buildings that need slots added:

| `BuildingId`    | Role(s) accepted   | `workerSlots` | Notes |
|-----------------|--------------------|:-------------:|-------|
| `fields`        | `farmer`           | 4 | Each farmer gets +2 food/season via `roleProductionBonus` |
| `workshop`      | `craftsman`        | 2 | Each craftsman gets +1 goods/season |
| `trading_post`  | `trader`           | 3 | Each trader gets +1 goods/season + bargaining skill growth |
| `healers_hut`   | `healer`           | 2 | Child mortality modifier; skill growth |
| `stable`        | `herder`           | 2 | New `herder` role (split from `farmer`) — see §4.2 |
| `gathering_hall`| *(passive)*        | 0 | Language drift multiplier; no worker |
| `granary`       | *(passive)*        | 0 | Flat food bonus; no worker |
| `palisade`      | *(passive)*        | 0 | Defense bonus; guards are not "in" the palisade |
| `camp`          | *(communal)*       | 0 | Shelter only |
| `longhouse`     | *(communal)*       | 0 | Shelter + culture pull |
| `roundhouse`    | *(communal)*       | 0 | Shelter + culture pull |
| `great_hall`    | *(communal)*       | 0 | Shelter + culture pull + council skill growth |
| `clan_lodge`    | *(communal)*       | 0 | Shelter + culture pull + council skill growth |

New buildings (§4.1) define their own slots.

### 3.4 Role Assignment Enforcement

In the store's role-assignment action:

```
canAssignRole(person, newRole, settlement):
  1. Find all buildings in settlement.buildings where def.roleProductionBonus.role === newRole
     AND building.assignedWorkerIds.length < def.workerSlots
  2. If none available → return { ok: false, reason: "No available [role] slots" }
  3. Assign person to the building with the fewest current workers (greedy)
  4. building.assignedWorkerIds.push(person.id)
  5. person.role = newRole
```

When a person is unassigned or changes role, `building.assignedWorkerIds.filter(id => id !== person.id)`.

For roles with **no building requirement** (gather_food, gather_stone, gather_lumber, guard,
builder, away, priest_solar, wheel_singer, voice_of_wheel, keth_thara) — no slot check.

### 3.5 Production Calculation Change

The current `getRoleProductionBonus(buildings, person.role)` sums bonuses across ALL
buildings of a matching type. With multiple instances (e.g. 3 Tilled Fields), this would
currently give each farmer +6 food — clearly wrong.

**New rule:** bonus applies only from the building the person is **assigned to**:

```typescript
// New helper in building-effects.ts
export function getRoleProductionBonusForWorker(
  building: BuiltBuilding,
): Partial<ResourceStock> {
  const def = BUILDING_CATALOG[building.defId];
  return def.roleProductionBonus?.bonus ?? {};
}
```

In `calculateProduction()`, the loop changes from role-based lookup to worker-assignment
lookup:

```
For each person:
  Find the BuiltBuilding where building.assignedWorkerIds.includes(person.id)
  Apply that building's roleProductionBonus
```

**Backward compatibility:** Old saves where `assignedWorkerIds` is empty on all buildings
will fall back to the existing `getRoleProductionBonus` behaviour (sum across all matching
buildings). A migration flag `buildingWorkersInitialized: boolean` on `GameState` handles
this one-time migration.

---

## Part 4 — Specialisation Roles & New Buildings

### 4.1 New Production Buildings

#### Smithy
```
BuildingId:    'smithy'
Name:          Smithy
Category:      industry
Cost:          lumber: 15, steel: 10
BuildSeasons:  2
Requires:      'workshop'
workerSlots:   2
roleProductionBonus: { role: 'blacksmith', bonus: { steel: 2, goods: 1 } }
skillGrowth:   [{ role: 'blacksmith', skill: 'custom', bonus: 2 }]
allowMultiple: true
```

A settlement with two smithies and four blacksmiths becomes genuinely self-sufficient in
steel — a strategic unlock.

#### Tannery
```
BuildingId:    'tannery'
Name:          Tannery
Category:      industry
Cost:          lumber: 10, goods: 5
BuildSeasons:  2
Requires:      'workshop'
workerSlots:   2
roleProductionBonus: { role: 'tailor', bonus: { goods: 3 } }
skillGrowth:   [{ role: 'tailor', skill: 'custom', bonus: 2 }]
allowMultiple: true
```

Tailors outproduce craftsmen in goods but require a dedicated space.

#### Brewery
```
BuildingId:    'brewery'
Name:          Brewery
Category:      social   (goods + morale output — social classification)
Cost:          lumber: 12, stone: 6
BuildSeasons:  2
Requires:      'granary'
workerSlots:   2
roleProductionBonus: { role: 'brewer', bonus: { goods: 2 } }
flatProductionBonus: none (goods only come from workers, not passively)
skillGrowth:   [{ role: 'brewer', skill: 'bargaining', bonus: 1 }]
allowMultiple: true
```

The Brewery's happiness angle is handled via a flat settlement morale bonus in
`computeHappinessFactors`: if a Brewery exists with ≥ 1 brewer, all persons get +5
"Quality ale and mead" (social category).

#### Mill
```
BuildingId:    'mill'
Name:          Mill
Category:      food
Cost:          lumber: 12, stone: 10
BuildSeasons:  2
Requires:      'fields'
workerSlots:   2
roleProductionBonus: { role: 'miller', bonus: { food: 3 } }
skillGrowth:   [{ role: 'miller', skill: 'plants', bonus: 1 }]
allowMultiple: true
```

Millers multiply the output of fields — a mid-game food security investment.

### 4.2 New WorkRole Values

Added to the `WorkRole` union in `person.ts`:

```typescript
| 'blacksmith'   // Works at Smithy; produces steel and goods
| 'tailor'       // Works at Tannery; produces goods
| 'brewer'       // Works at Brewery; produces goods and morale
| 'miller'       // Works at Mill; produces food
| 'herder'       // Works at Stable; manages cattle and horses (split from 'farmer')
```

**`herder` note:** Currently `farmer` is used for stable workers (skill growth: animals).
`herder` splits this off cleanly. Existing saves: persons with `role: 'farmer'` and
`assignedBuildingId` pointing to a Stable are migrated to `role: 'herder'`. This is a
one-time migration in the store's `loadGame()`.

### 4.3 ROLE_LABELS / ROLE_COLORS Additions

| Role          | Label        | Tailwind colour |
|---------------|--------------|-----------------|
| `blacksmith`  | Blacksmith   | `text-stone-400` |
| `tailor`      | Tailor       | `text-violet-400` |
| `brewer`      | Brewer       | `text-amber-600` |
| `miller`      | Miller       | `text-yellow-600` |
| `herder`      | Herder       | `text-green-600` |

### 4.4 Skill Mapping for Purpose/Happiness

```typescript
const ROLE_SKILL_MAP additions:
  blacksmith:  'custom'
  tailor:      'custom'
  brewer:      'bargaining'
  miller:      'plants'
  herder:      'animals'
```

### 4.5 `allowMultiple` on BuildingDef

Rather than adding entirely separate logic, `canBuild()` gets a simple gate:

```typescript
/** If true, multiple instances of this building type may be constructed. */
allowMultiple?: boolean;
```

When `allowMultiple: true`, the "Already constructed" check in `canBuild()` is skipped.
The "Already under construction" check still applies unless `allowQueueMultiple: true` is
also set (default false — prevent queueing infinite duplicates at once).

---

## Part 5 — Compound Autonomy (Scheme System)

### 5.1 New Scheme Type: `scheme_build_dwelling`

Added to the `SchemeType` union in `scheme-engine.ts`.

**Generation conditions** (checked every `SCHEME_GENERATE_INTERVAL` turns):
```
person.age >= 18
AND person.claimedBuildingId === null
AND person.householdId !== null
AND household.dwellingBuildingId === null  (household doesn't already have a home)
AND settlement.resources.lumber > communalResourceMinimum.lumber
AND currentYear >= 2  (give the settlement time to establish first)
```

Trait weights for type selection:
- `proud` +0.4 — strongly pushes toward seeking independent housing
- `ambitious` +0.3
- `independent` +0.3 (new aptitude trait, §5.4)
- `content` −0.5 — content people don't scheme for more

**Progress:** Standard 100-point tick scheme. Advances 1/turn.

**On climax:** Rather than a dramatic player-visible event, this scheme fires a lightweight
notification/consent event: `sch_dwelling_request`.

### 5.2 New Scheme Climax Event: `sch_dwelling_request`

```typescript
{
  id: 'sch_dwelling_request',
  isDeferredOutcome: true,
  actorRequirements: [{ slot: 'builder', ... }],
  title: '{builder.first} wants to build a home',
  description:
    '{builder.He} has spent the past months gathering materials and planning. ' +
    'The resources needed are within reach, and {builder.he} is asking leave to ' +
    'begin construction of a small dwelling for {builder.his} household.',
  choices: [
    {
      id: 'approve',
      label: 'Approve the project',
      description: 'Let them build. The settlement will deduct the materials.',
      consequences: [{ type: 'start_household_construction', slot: 'builder' }],
    },
    {
      id: 'deny',
      label: 'Not now — we need the materials',
      description: 'Their scheme fades, but so does their goodwill.',
      consequences: [
        { type: 'modify_opinion', target: '{builder}', value: -15 },
        { type: 'add_trait', target: '{builder}', traitId: 'restless' },
      ],
    },
    {
      id: 'defer',
      label: 'Soon — once resources allow',
      description: 'They wait patiently. Scheme resets at half progress.',
      consequences: [{ type: 'reset_scheme_partial', slot: 'builder' }],
    },
  ],
}
```

### 5.3 New Consequence Type: `start_household_construction`

```typescript
{
  type: 'start_household_construction';
  slot: string;          // The actor slot whose household will own the building
  defId?: BuildingId;    // Defaults to 'wattle_hut' if omitted
}
```

Handler in `resolver.ts`:
1. Resolve the actor from `slot`
2. Check `settlement.resources.lumber > communalMinimum.lumber + def.cost.lumber`
   (double-check at resolution time — resources may have changed)
3. Call `startConstruction(settlement, defId, null, turnNumber)`
4. Set `project.ownerHouseholdId = person.householdId` (new field on `ConstructionProject`)
5. Deduct resources
6. When construction completes in `processConstruction()`, the completed `BuiltBuilding`
   inherits `ownerHouseholdId` from the project
7. Write `ActivityLogEntry` of a new type: `'dwelling_claimed'`

### 5.4 Communal Resource Minimum

New field on `GameState`:

```typescript
/**
 * Minimum resource floors the scheme system respects before allowing
 * autonomous household construction to proceed.
 * Player-configurable in the Settlement management panel.
 * Defaults represent a bare operating minimum.
 */
communalResourceMinimum: Partial<ResourceStock>;
```

Default: `{ lumber: 15, stone: 5 }`.

UI: A collapsible "Autonomy Limits" section in `SettlementView` lets the player slide
each resource threshold. Slider range 0–50 per resource.

### 5.5 Auto-approve Mode (Optional)

A `GameConfig` flag: `allowAutonomousBuilding: boolean` (default `false`).

When `true`, the `sch_dwelling_request` event fires and auto-selects the `'approve'`
choice if resources are above minimum — no player action required. The approval is logged
in the activity feed. This trades player control for less micromanagement in large
settlements.

---

## Part 6 — Supporting State Changes

### 6.1 `Person.joinedYear`

New field to support the "5 years without a home" calculation:

```typescript
/**
 * In-game year the person joined the settlement.
 * Founders = year 1. Children born in-settlement = their birth year.
 * Immigrants = year they arrived.
 * Used to calculate housing-expectation pressure.
 */
joinedYear: number;
```

Serialisation: plain number; old saves fall back to `1` (`?? 1`).

### 6.2 `ConstructionProject.ownerHouseholdId`

```typescript
/**
 * If set, the completed building will be claimed by this household automatically.
 * Set when a household-initiated construction scheme fires.
 * null for all communal/player-initiated buildings.
 */
ownerHouseholdId: string | null;
```

### 6.3 `BuildingId` Union Additions

```typescript
| 'wattle_hut'
| 'cottage'
| 'homestead'
| 'compound'
| 'smithy'
| 'tannery'
| 'brewery'
| 'mill'
```

### 6.4 `ActivityLogType` Addition

```typescript
| 'dwelling_claimed'   // A household completed a private dwelling
```

---

## Part 7 — UI Changes

### 7.1 Settlement View — Build Menu

- New **Dwellings** section appears in the build menu (alongside Food, Industry, etc.)
- Dwellings show a count badge: "Wattle Hut (2 built, 0 unclaimed)"
- New **Autonomy Limits** collapsible panel with per-resource minimum sliders

### 7.2 Building Detail Panel

Each standing building shows:
- Worker slots: "Workers: 2 / 4" with a list of assigned person name chips
- Owner household (if any): "Owned by House Orsthal"
- Unassign button per worker

### 7.3 Role Assignment in PeopleView

The existing role dropdown:
- Groups new roles under "Specialist Trades"
- Shows slot availability: "Blacksmith (1/2 slots open at Smithy)"
- Greyed out with tooltip if no building has open slots

### 7.4 PersonDetail — Housing Section

Below the family section, a new **Housing** card:
- "Living in: Communal Longhouse" (grey) or "Home: Orsthal Cottage" (warm amber)
- If no private home and year ≥ 5: shows the growing expectation penalty with turn count

### 7.5 Household Panel (MarriageDialog / PersonDetail)

Shows:
- `Dwelling: [building name] (instanceId)` or "None — communal housing"
- `Production buildings: [list]`

---

## Part 8 — Migration & Serialisation

### 8.1 New fields with safe defaults

| Field | Default | Notes |
|-------|---------|-------|
| `Household.dwellingBuildingId` | `null` | |
| `Household.productionBuildingIds` | `[]` | |
| `BuiltBuilding.ownerHouseholdId` | `null` | |
| `BuiltBuilding.assignedWorkerIds` | `[]` | Not to be confused with `ConstructionProject.assignedWorkerIds` |
| `ConstructionProject.ownerHouseholdId` | `null` | |
| `Person.joinedYear` | `1` | All founders count as year 1 |
| `GameState.communalResourceMinimum` | `{ lumber: 15, stone: 5 }` | |
| `GameState.buildingWorkersInitialized` | `false` | Migration flag |
| `GameState.config.allowAutonomousBuilding` | `false` | |

### 8.2 One-time Migration: `buildingWorkersInitialized`

On first load of an old save (flag is `false`):
1. For every person with a production role (`farmer`, `trader`, `craftsman`, `healer`):
   - Find the first matching building with `assignedWorkerIds.length < workerSlots`
   - Push person to `building.assignedWorkerIds`
2. Set flag to `true`

### 8.3 Maps that need `[K,V][]` serialisation

No new Maps introduced. All new fields are plain objects/arrays.

---

## Part 9 — Implementation Steps (Suggested Order)

| Step | Description | Files |
|------|-------------|-------|
| 1 | Data model: add all new fields to `game-state.ts` / `person.ts` / `household.ts`; update `BuildingId` union | `game-state.ts`, `person.ts` |
| 2 | Add `workerSlots` and `allowMultiple` to `BuildingDef`; update all existing building definitions; add 4 new production buildings; add 4 personal dwelling buildings | `building-definitions.ts` |
| 3 | Update `canBuild()` to respect `allowMultiple` | `construction.ts` |
| 4 | Add `BuildingWorkersInitialized` migration + `assignedWorkerIds` on `BuiltBuilding`; update serialisation round-trip | `serialization.ts`, `game-store.ts` |
| 5 | New `getRoleProductionBonusForWorker()` helper; update `calculateProduction()` to use building assignment | `building-effects.ts`, `resources.ts` |
| 6 | Add new `WorkRole` values; update `ROLE_LABELS`/`ROLE_COLORS`; update `ROLE_SKILL_MAP` in happiness; update role-assignment in store to enforce slot caps | `person.ts`, `role-display.ts`, `happiness.ts`, `game-store.ts` |
| 7 | Household ownership: `Household.dwellingBuildingId/productionBuildingIds`; `BuiltBuilding.ownerHouseholdId`; auto-claim on construction completion | `household.ts`, `game-store.ts` |
| 8 | Happiness: add time-based expectation, relative jealousy, dwelling tier bonus to `computeHappinessFactors()` | `happiness.ts` |
| 9 | Scheme: add `scheme_build_dwelling` type; generation logic; `sch_dwelling_request` event; `start_household_construction` consequence; `communalResourceMinimum` gate | `scheme-engine.ts`, `resolver.ts`, `definitions/schemes.ts` |
| 10 | UI: build menu Dwellings section; building detail panel with worker slots; role dropdown slot availability; PersonDetail housing card; Autonomy Limits panel | `SettlementView.tsx`, `PeopleView.tsx`, `PersonDetail.tsx` |
| 11 | Tests: worker slot enforcement, production calculation with multiple buildings, happiness expectation curve, scheme generation conditions, household auto-claim, migration | `tests/buildings/`, `tests/economy/`, `tests/population/`, `tests/personality/` |

---

## Part 10 — Design Principles & Constraints

- **No `Math.random()`** — all probabilistic checks in scheme generation use the seeded RNG
- **No React in simulation** — all new sim logic in `src/simulation/`; zero DOM imports
- **Backward compatibility first** — every new field has a serialisation default; no old save should throw
- **Autonomy by default** — the household building scheme fires without player initiation but
  always presents a consent event. Players can enable full auto-mode per §5.5.
- **Worker slots are UI-enforced, not production-enforced** — the production calculation
  trusts `building.assignedWorkerIds` as the source of truth. The UI (and the scheme
  system) are responsible for not exceeding slot limits; no runtime clamping needed inside
  `calculateProduction`.
- **Dwellings do not compete with civic shelter** — their shelter capacity is additive.
  Overcrowding ratio uses total capacity (communal + all dwellings).
- **The communal buildings stay relevant** — new immigrants always start in communal housing.
  Communal buildings are never an embarrassment to have; they're just not a *home*.

# Palusteria: Children of the Ashmark — Developer Context

This file is the first thing a new Copilot session should read.
It captures the current implementation state, hard rules, and Phase 2 priorities.

---

## Current Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1 — Foundation | ✅ Complete | 13/13 steps done, 13/13 tests pass, zero compile errors |
| Phase 2 — Genetics Engine | ✅ Complete | All 12 steps done, 139/139 tests pass, zero compile errors |
| Phase 3 — Living Settlement | ✅ Complete | Language acquisition ✅ · Cultural identity & drift ✅ · Founder variety ✅ · Skills system ✅ · Skilled event resolution ✅ · Council voice system ✅ · Portrait system ✅ · Settlement buildings ✅ · Event character binding ✅ · Economy system ✅ · Generic task roles ✅ · Tilled Fields building ✅ |
| Phase 3.5 — Household Depth | ✅ Complete | Household data model ✅ · Utility module ✅ · Marriage auto-forms households ✅ · Thrall status ✅ · Keth-Thara role ✅ · Ashka-Melathi bonds ✅ · Wife-council events ✅ · PersonDetail UI ✅ · Informal Union dialog ✅ · Full test suite ✅ |
| Phase 4 — Polish | 🔲 Not started | — |
---

## Portrait System

### File Naming Convention

```
public/portraits/{sex}/{category}/{category}_{sex_abbr}_{stage}_{nnn}.png
```

Examples:
```
public/portraits/male/imanian/imanian_m_adult_001.png
public/portraits/female/kiswani/kiswani_f_young_adult_002.png
public/portraits/male/mixed_imanian_kiswani/mixed_imanian_kiswani_m_child_003.png
```

### Portrait Categories

| `PortraitCategory` | Bloodline rule |
|--------------------|---------------|
| `imanian` | imanian fraction ≥ 75% |
| `kiswani` | kiswani sub-groups combined ≥ 75% |
| `hanjoda` | hanjoda sub-groups combined ≥ 75% |
| `mixed_imanian_kiswani` | imanian + kiswani ≥ 80%, neither dominant |
| `mixed_imanian_hanjoda` | imanian + hanjoda ≥ 80%, neither dominant |
| `mixed_kiswani_hanjoda` | kiswani + hanjoda ≥ 80%, neither dominant |

### Age Stages

| Stage | Age range |
|-------|-----------|
| `child` | 0 – 13 |
| `young_adult` | 14 – 29 |
| `adult` | 30 – 54 |
| `senior` | 55+ |

### Stage Fallback Order

If the exact age stage has no portraits yet, the resolver tries: `adult` → `young_adult` → `senior` → `child`. A single `adult` portrait therefore covers all ages until stage-specific art exists.

### Expanding the Portrait Pool

1. Drop the `.png` into `public/portraits/{sex}/{category}/`
2. Increment the count for that slot in `PORTRAIT_REGISTRY` in `portrait-resolver.ts`
3. No other code changes needed.

### `portraitVariant` on Person

- `portraitVariant: number` — 1-indexed, assigned once at `createPerson()` time, never changed
- Assigned via `rng.nextInt(1, 3)` when RNG is available; defaults to `1` otherwise
- Persists in the save file as a plain number — no special serialisation
- Old saves default to `1` via the `?? 1` fallback in `deserializePerson()`
- Clamped to the available count if the registry grows after a save was made
---

## Running the Project

```bash
npm run dev          # Vite dev server → http://localhost:5173
npm test             # Run Vitest (713 passing across 23 test files)
npx tsc --noEmit     # Type-check without building
```

If the dev server won't start, run `npx tsc --noEmit` first to check for compile errors.

---

## Tech Stack (exact versions)

| Layer | Technology | Version |
|-------|-----------|---------|
| UI Framework | React | 19 |
| Language | TypeScript | 5.x, strict mode |
| Build | Vite | 7 |
| State Management | Zustand | 5 |
| Styling | Tailwind CSS | 3.x |
| Testing | Vitest | 4 |

---

## Hard Rules — Never Violate

1. **No `Math.random()`** — all randomness flows through the seeded PRNG (`createRNG(seed)` in `src/utils/rng.ts`)
2. **No React imports in `src/simulation/`** — simulation is pure TypeScript logic with zero DOM/React dependency
3. **No `any` types** — TypeScript strict mode throughout
4. **Map serialisation** — `Map<K,V>` fields in `GameState` must be serialised as `[K,V][]` arrays for localStorage JSON (see `game-store.ts` save/load logic)

---

## Key Files — Quick Reference

| File | Purpose |
|------|---------|
| `src/simulation/turn/game-state.ts` | Master `GameState` interface and all supporting types — the single source of truth |
| `src/simulation/turn/turn-processor.ts` | `processDawn(state, rng)` + `processDusk(state, season)` |
| `src/simulation/turn/season.ts` | `SEASON_MODIFIERS` — food/goods production multipliers per season |
| `src/simulation/events/engine.ts` | Event/choice/consequence **type definitions only** (no logic) |
| `src/simulation/events/event-filter.ts` | `ALL_EVENTS`, `filterEligibleEvents()`, `drawEvents()`; `canResolveActors` gate makes `actorRequirements` act as implicit event prerequisites |
| `src/simulation/events/resolver.ts` | `applyEventChoice(event, choiceId, state, rng?, boundActors?)` returning `ApplyChoiceResult`; `resolveSkillCheck()` helper; `resolveConsequenceTarget()` (maps `{slot}` targets to person IDs); `add_person` consequence handler |
| `src/simulation/events/actor-resolver.ts` | Actor binding engine: `matchesCriteria`, `canFillSlot`, `canResolveActors`, `selectActor`, `resolveActors`, `interpolateText` — pure TS, zero React, seeded RNG only |
| `src/simulation/events/definitions/` | 39 events across 8 files; all events with named actors have `actorRequirements` |
| `src/simulation/events/definitions/household.ts` | 6 household/domestic events: `hh_tribal_thrall_offer`, `hh_thrall_elevation`, `hh_wife_council_demands`, `hh_tradition_clash`, `hh_ashka_melathi_deepens`, `hh_keth_thara_service_ends` |
| `src/simulation/buildings/building-definitions.ts` | `BuildingId` (13-member union), `BuildingDef`, `BUILDING_CATALOG`, `getBuildingDisplayName(defId, style)` — static catalog of all building types |
| `src/simulation/buildings/building-effects.ts` | Pure effect getters: `getShelterCapacity`, `getOvercrowdingRatio`, `getBuildingFlatProductionBonus`, `getLanguageDriftMultiplier`, `getBuildingCulturePull`, `getSkillGrowthBonuses`, `hasBuilding`, `lacksBuilding`, etc. |
| `src/simulation/buildings/construction.ts` | `canBuild` → `CanBuildResult` (`{ ok: true }` / `{ ok: false; reason }`); `startConstruction`, `assignBuilder`, `removeBuilder`, `processConstruction`, `cancelConstruction` |
| `src/simulation/economy/resources.ts` | Production/consumption math with seasonal modifiers |
| `src/simulation/genetics/traits.ts` | Trait type definitions + `IMANIAN_TRAITS` constant |
| `src/data/ethnic-distributions.ts` | All 8 ethnic group `TraitDistribution` constants + `ETHNIC_DISTRIBUTIONS` lookup map |
| `src/simulation/culture/language-acquisition.ts` | `resolveChildLanguages`, `applyLanguageDrift`, `updateSettlementLanguages`, `updateLanguageTension`, `updateLanguageDiversityTurns` |
| `src/simulation/population/culture.ts` | `CULTURE_LABELS`, `SAUROMATIAN_CULTURE_IDS`, `deriveCulture`, `processCulturalDrift`, `buildSettlementCultureDistribution`, `computeCulturalBlend` |
| `src/simulation/genetics/gender-ratio.ts` | `getSauromatianFraction`, `getImanianFraction`, `resolveGenderRatio`, `determineSex` |
| `src/simulation/genetics/inheritance.ts` | `resolveInheritance()` pipeline: `averageBloodlines`, `blendTraitDistributions`, `sampleContinuous`, `sampleDiscrete` |
| `src/simulation/genetics/fertility.ts` | `BirthResult`, `createFertilityProfile`, `getFertilityChance`, `attemptConception`, `processPregnancies` |
| `src/simulation/population/person.ts` | `Person` interface + `createPerson(options, rng?)` factory; heritage/bloodline types; `SkillId`, `PersonSkills`, `getSkillRating()`, `getDerivedSkill()`, `generatePersonSkills()` |
| `src/simulation/population/naming.ts` | `generateName(sex, culture, motherFamilyName, fatherFamilyName, rng)` — 3 culture pools |
| `src/simulation/population/marriage.ts` | `canMarry`, `performMarriage`, `getMarriageability`, `formConcubineRelationship`, `InformalUnionStyle` — Sauromatian/Imanian rules; household auto-formation on marriage |
| `src/simulation/population/household.ts` | `createHousehold`, `addToHousehold`, `removeFromHousehold`, `getHouseholdMembers`, `getHouseholdByPerson`, `getSeniorWife`, `countWives`, `countConcubines`, `dissolveHousehold`, `HOUSEHOLD_ROLE_LABELS`, `HOUSEHOLD_ROLE_COLORS` |
| `src/simulation/world/tribes.ts` | `createTribe`, `TRIBE_PRESETS` (16 presets), `updateTribeDisposition` |
| `src/stores/game-store.ts` | Zustand store — full turn lifecycle, council, `arrangeMarriage`, `arrangeInformalUnion`, `assignKethThara`, tribe init; `households` Map serialised as `[string, Household][]` |
| `src/ui/layout/LeftNav.tsx` | Left nav with phase-aware End Turn / Confirm Turn button |
| `src/ui/layout/BottomBar.tsx` | Full-width resource strip (food, cattle, goods, gold, lumber, stone, pop) |
| `src/simulation/events/council-advice.ts` | Council voice engine: `VoiceArchetype`, `getVoiceArchetype`, `scoreChoiceForPerson`, `hashPersonEvent`, `generateAdvice` — pure logic, deterministic via djb2 hash |
| `src/ui/components/portrait-resolver.ts` | `PortraitCategory`, `AgeStage`, `PORTRAIT_REGISTRY`, `getAgeStage()`, `getPortraitCategory()`, `resolvePortraitSrc(person)` — category × sex × age stage × variant → `/portraits/…` path; stage fallback: adult → young_adult → senior → child |
| `src/ui/components/CouncilPortrait.tsx` | 40×50px portrait `<img>` with skin-tone swatch fallback |
| `src/ui/components/AdviceBubble.tsx` | Italic speech bubble rendered above the selected adviser seat in CouncilFooter |
| `src/ui/layout/CouncilFooter.tsx` | 7-seat Expedition Council row; portraits, click-to-select adviser, trait-driven `AdviceBubble` with per-(person × event) advice caching |
| `src/ui/views/EventView.tsx` | Event card with choices; actor badge strip (portrait + name) above description when slots are bound; `interpolateText` applied to all displayed text; calls `resolveEventChoice` + `nextEvent` |
| `src/ui/views/PeopleView.tsx` | Settler roster; sort/filter (sex, status, heritage group, **base skill**); click row → PersonDetail panel |
| `src/ui/views/PersonDetail.tsx` | Full person detail: genetics, heritage, traits, skills (base + derived), languages, family |
| `src/ui/views/FamilyTree.tsx` | 3-generation ancestor/descendant tree; spouses shown to the side of root node |
| `src/ui/views/SettlementView.tsx` | 4-panel settlement view: standing buildings + shelter bar (left), construction queue with worker assignment (centre), build menu (right), crafting panel (far right) |
| `src/ui/views/TradeView.tsx` | Trade & Commerce view: Company quota panel, tribe list with dispositions, barter interface with fairness meter; locked without Trading Post |
| `src/ui/shared/role-display.ts` | `ROLE_LABELS` and `ROLE_COLORS` — exhaustive `Record<WorkRole, string>` for all 11 roles |
| `src/simulation/economy/company.ts` | `computeYearlyQuota`, `checkQuotaStatus`, `applyQuotaConsequences`, `getCompanySupplyDelivery` — Company quota math and failure escalation |
| `src/simulation/economy/trade.ts` | `getTradeValue`, `validateTrade`, `executeTribeTradeLogic`, `TradeOffer`, `TradeResult` — barter pricing and tribe disposition effects |
| `src/simulation/economy/spoilage.ts` | `calculateSpoilage` — per-resource decay rates with seasonal modifiers and building mitigation |
| `src/simulation/economy/crafting.ts` | `CraftRecipe`, `CRAFT_RECIPES`, `getAvailableCrafts`, `validateCraft`, `applyCraft` — short conversion chains |
| `src/ui/components/Portrait.tsx` | Portrait renderer; skin-tone HSL colouring; `sm`/`lg` variants; `lg` shows photo portrait via `resolvePortraitSrc` when asset exists, falls back to SVG silhouette |
| `src/ui/components/heritage-helpers.ts` | `heritageAbbr(bloodline)` → `'IMA'\|'KIS-R'\|…\|'MIX'`; `GROUP_ABBR` lookup |
| `src/ui/overlays/GameSetup.tsx` | New game config: name, difficulty, Sauromatian women toggle, tribe selection |
| `src/ui/overlays/MarriageDialog.tsx` | Marriage overlay: two-column selector, compatibility panel, child predictions, opinion impacts |

---

## ResourceType (9 resources — as of Phase 1)

```typescript
type ResourceType =
  | 'food'
  | 'cattle'    // Herd animals; produce a food bonus each season (1 food per 2 cattle)
  | 'goods'     // Manufactured and acquired trade goods (note: NOT 'trade_goods')
  | 'steel'
  | 'lumber'
  | 'stone'
  | 'medicine'
  | 'gold'
  | 'horses';
```

> ⚠️ The resource is `goods`, not `trade_goods`. This catches people out.

---

## GameState Fields Added in Phase 1

These fields exist in the actual `game-state.ts` but were not in the original architecture doc:

| Field | Type | Purpose |
|-------|------|---------|
| `pendingEvents` | `GameEvent[]` | Events queued for the current Event Phase |
| `councilMemberIds` | `string[]` | IDs of up to 7 Expedition Council members (seat order) |

Use `currentSeason` and `currentYear`, NOT `season` or `year`.

---

## Turn Phase Flow

```
idle
 └─ startTurn() → processDawn() → draw events
      ├─ if events drawn → phase: 'event'
      │    └─ resolveEventChoice() + nextEvent() (×N)
      │         └─ after last event → phase: 'management'
      └─ if no events → phase: 'management'
           └─ endTurn() → processDusk() → phase: 'idle'
```

**LeftNav button logic:**
- `idle` → "End Turn" (amber) → calls `startTurn()`
- `management` → "Confirm Turn" (green) → calls `endTurn()`
- `event` → "Resolve Events" (disabled — player resolves in EventView)
- `dawn` / `dusk` → "Processing…" (disabled)

---

## Seasonal Modifiers

| Season | Food Production | Goods Production |
|--------|----------------|-----------------|
| Spring | 1.0× | 1.0× |
| Summer | 1.2× | 1.3× |
| Autumn | 1.6× | 1.0× |
| Winter | 0.4× | 0.7× |

---

## Phase 2 Deliverables — "Children of Two Worlds" ✅ Complete

| Step | Deliverable | Files |
|------|-------------|-------|
| ✅ 1 | All ethnic trait distributions | `src/data/ethnic-distributions.ts` |
| ✅ 2 | `resolveInheritance()` with 70/30 blend | `src/simulation/genetics/inheritance.ts` |
| ✅ 3 | Gender ratio mechanics | `src/simulation/genetics/gender-ratio.ts` |
| ✅ 4 | Fertility + pregnancy tracking | `src/simulation/genetics/fertility.ts` |
| ✅ 5 | Heritage + bloodline in person factory | `src/simulation/population/person.ts` |
| ✅ 6 | Name generation by culture | `src/simulation/population/naming.ts` |
| ✅ 7 | Text-based portrait from traits | `src/ui/components/Portrait.tsx` |
| ✅ 8 | Marriage matching system | `src/simulation/population/marriage.ts` |
| ✅ 9 | External tribes data + basic AI | `src/simulation/world/tribes.ts` |
| ✅ 10 | 18 cultural/domestic events | `src/simulation/events/definitions/cultural.ts` |
| ✅ 11 | PersonDetail view | `src/ui/views/PersonDetail.tsx` |
| ✅ 12 | Family tree viewer | `src/ui/views/FamilyTree.tsx` |

**Exit criteria:** Marry Sauromatian women, have children with blended traits, see demographics shift over a generation.

---

## Phase 3 Deliverables — "A Place Called Home" 🔄 In Progress

| Step | Deliverable | Files | Status |
|------|-------------|-------|--------|
| ✅ 1 | Language acquisition engine | `src/simulation/culture/language-acquisition.ts` | Complete |
| ✅ 2 | Cultural identity & drift system | `src/simulation/population/culture.ts` | Complete |
| ✅ 3 | `CultureId` expanded to 15 sub-group IDs | `src/simulation/population/person.ts` | Complete |
| ✅ 4 | Per-turn cultural drift wired into `processDawn()` | `src/simulation/turn/turn-processor.ts` | Complete |
| ✅ 5 | Child heritage blending via `deriveCulture()` | `src/simulation/genetics/fertility.ts` | Complete |
| ✅ 6 | Cultural Fluency section in PersonDetail UI | `src/ui/views/PersonDetail.tsx` | Complete |
| ✅ 7 | Founder character variety (unique physical profiles + traits) | `src/stores/game-store.ts` | Complete |
| ✅ 8 | Founding traders start with Tradetalk (fluency 0.4) | `src/stores/game-store.ts` | Complete |
| ✅ 9 | Sauromatian founding women start with Tradetalk (fluency 0.3) | `src/stores/game-store.ts` | Complete |
| ✅ 10 | Skills & experience tracking | `src/simulation/population/person.ts`, `src/ui/views/PersonDetail.tsx`, `src/ui/views/PeopleView.tsx` | Complete |
| ✅ — | Council voice system & portraits | `src/simulation/events/council-advice.ts`, `src/ui/components/portrait-resolver.ts`, `src/ui/components/CouncilPortrait.tsx`, `src/ui/components/AdviceBubble.tsx`, `src/ui/layout/CouncilFooter.tsx` | Complete (bonus step) |
| ✅ — | Portrait system (age stages, categories, registry) | `src/ui/components/portrait-resolver.ts`, `src/simulation/population/person.ts` | Complete (bonus step) |
| ✅ 11 | Settlement buildings & upgrades | `src/simulation/buildings/`, `src/stores/game-store.ts`, `src/ui/views/SettlementView.tsx` | Complete |
| ✅ 12 | Event character binding | `src/simulation/events/actor-resolver.ts`, `src/simulation/events/engine.ts`, `src/simulation/events/event-filter.ts`, `src/simulation/events/resolver.ts`, `src/ui/views/EventView.tsx`, all definition files | Complete |
| ✅ — | Economy system (Company quota, tribe trade, spoilage, crafting) | `src/simulation/economy/company.ts`, `trade.ts`, `spoilage.ts`, `crafting.ts`, `src/ui/views/TradeView.tsx`, `src/ui/views/SettlementView.tsx` | Complete (bonus) |
| ✅ — | Generic task roles + Tilled Fields building | `src/simulation/population/person.ts`, `src/simulation/economy/resources.ts`, `src/simulation/buildings/building-definitions.ts`, `src/ui/shared/role-display.ts`, `src/ui/views/PeopleView.tsx` | Complete (bonus) |
| 🔲 13 | Tribe relationship depth | — | Planned |

### Cultural Identity System Notes

- **`ETHNIC_GROUP_CULTURE`** in `person.ts`: maps every `EthnicGroup` to its sub-group `CultureId`
- **`processCulturalDrift()`**: community pull 0.025/season, spouse bonus 0.01/season, floor 0.01
- **`deriveCulture()`**: blends both parents 50/50, seeds `settlement_native` at 0.05; `primaryCulture` = highest key or `settlement_native` if none ≥ 0.5
- Founding Sauromatian women use `ETHNIC_GROUP_CULTURE[sauroGroup]` for correct sub-group culture (not hardcoded `kiswani_traditional`)

### Skills System Notes

- **6 base skills** on every `Person`: `animals`, `bargaining`, `combat`, `custom`, `leadership`, `plants` (integers 1–100)
- **7 derived skills** computed on demand via `getDerivedSkill(skills, id)` — never stored: Deception, Diplomacy, Exploring, Farming, Hunting, Poetry, Strategy
- **Rating tiers**: Fair 1–25 (FR) · Good 26–45 (GD) · Very Good 46–62 (VG) · Excellent 63–77 (EX) · Renowned 78–90 (RN) · Heroic 91–100 (HR)
- **Generation**: `generatePersonSkills(traits, rng)` — Gaussian(28, 15) + trait bonuses, clamped to [1, 100], rounded
- **Default fallback**: all 25 when no RNG provided — keeps existing tests that call `createPerson` without RNG stable
- **`createPerson` signature**: `createPerson(options, rng?)` — if `options.skills` provided, used directly; else if `rng`, generates; else defaults to 25
- **Founding colonists** each have 2 hardcoded traits in `FOUNDING_TRAITS` (game-store.ts) that drive differentiated skill profiles
- **Serialisation**: `PersonSkills` is a plain `Record<SkillId, number>` — no Map handling needed, JSON round-trips automatically

### Council Voice System Notes

- **`VoiceArchetype`** (6 types): `bold`, `pragmatist`, `diplomat`, `traditionalist`, `cautious`, `schemer` — determined by highest-weighted personality traits
- **Priority order**: bold → pragmatist → diplomat → traditionalist → cautious → schemer (default cautious)
- **`scoreChoiceForPerson(person, choice)`**: sums trait biases + skill confidence + cultural bias; highest-scored choice = implied recommendation
- **`hashPersonEvent(personId, eventId)`**: djb2 hash → non-negative seed, fully deterministic; never consumes the main RNG stream
- **`generateAdvice(person, event, seed)`**: picks from `ADVICE_TEMPLATES[archetype][category]` + `SKILL_SUFFIXES[archetype][tier]` based on skill rating
- **`ADVICE_TEMPLATES`**: 48-cell matrix (`Record<VoiceArchetype, Record<EventCategory, string[]>>`) — 3–4 authored fragments per cell
- **Portraits in footer**: `CouncilPortrait` shows photo asset from `public/portraits/` if available; skin-tone swatch otherwise
- **Photo portrait in PersonDetail**: `Portrait.tsx` `lg` variant calls `resolvePortraitSrc`; renders `<img>` at 5.5×7 rem with SVG fallback
- **Advice caching**: `CouncilFooter` memo-ises advice in local `Record<string, string>` keyed by `${personId}:${eventId}` — no store changes
- **Assets location**: `public/portraits/{sex}/{group}/...png` — Vite serves these as static files

### Settlement Buildings System Notes

- **13 building types** (`BuildingId`): `camp` · `longhouse` · `roundhouse` · `great_hall` · `clan_lodge` · `granary` · `fields` · `workshop` · `trading_post` · `healers_hut` · `gathering_hall` · `palisade` · `stable`
- **Tilled Fields** (`fields`): Food category · 5 lumber cost · 1 season · `roleProductionBonus: { role: 'farmer', bonus: { food: 2 } }` — without it, farmers produce only 1 food/season (same as a low-skill forager)
- **`BuiltBuilding`**: `{ defId, instanceId, builtTurn, style: BuildingStyle | null }` — `style` is `null` for single-variant buildings
- **`ConstructionProject`**: `{ id, defId, style, progressPoints, totalPoints, assignedWorkerIds, startedTurn, resourcesSpent }`
- **`canBuild` returns `CanBuildResult`**: `{ ok: true }` or `{ ok: false; reason: string }` — discriminated by `ok`, **not** `allowed`
- **Starting settlement**: Camp (`camp_0`) built at turn 0; no construction queue; starting resources include 20 lumber + 10 stone
- **Construction progress**: 100 points per assigned worker per season; `processConstruction` in `turn-processor.ts` advances projects each dawn
- **Overcrowding**: `getOvercrowdingRatio(pop, [])` → `2.0` (pathological — treat empty buildings array as severe); ratio >1.0 adds mortality/production penalties
- **Style variants**: Some buildings (`roundhouse`, `longhouse`, `great_hall`, etc.) have Imanian/Sauromatian style variants affecting culture pull
- **Building effects wired into `processDawn()`**: overcrowding mortality, construction progress, language drift multiplier, culture pull, skill growth bonuses
- **5 building events** in `definitions/building.ts`: `bld_fever_spreads`, `bld_bitter_quarrel`, `bld_someone_leaves`, `bld_completion_toast` (deferred), `bld_traders_notice` (unique, requires trading_post)
- **`DawnResult` additions**: `completedBuildings`, `removedBuildingIds`, `updatedConstructionQueue`, `overcrowdingRatio`
- **`applyLanguageDrift` signature**: now accepts optional `driftMultiplier = 1.0` parameter (multiplied by Gathering Hall bonus)

### Event Character Binding System Notes

- **`BoundEvent`**: `GameEvent & { boundActors: Record<string, string> }` — runtime wrapper; all entries in `pendingEvents` are `BoundEvent`; static definitions stay unmodified
- **`actorRequirements?: ActorRequirement[]`** on `GameEvent`: typed criteria for slot selection (`sex`, `religion`, `minAge`, `maxAge`, `maritalStatus`, `minSkill`, `hasTrait`, etc.)
- **`canResolveActors`** act as an implicit event prerequisite — event is ineligible if any required slot cannot be filled (enforces mutual exclusion)
- **Actor selection**: greedy in declaration order; each claimed person is excluded from subsequent slots so no two slots share the same person
- **Slot-targeted consequences**: `target: '{leaver}'` → `resolveConsequenceTarget()` strips braces and resolves to the bound person's ID
- **Text interpolation tokens**: `{slot}` → full name; `{slot.first}` → given name; `{slot.he/his/him}` → pronouns matching sex; `{slot.He/His/Him}` → capitalised variants; unknown tokens passed through unchanged
- **Deferred actors**: `DeferredEventEntry.boundActors` persists the binding across the deferred gap
- **`queue_deferred_event` consequence**: implemented in `applyConsequence()` — schedules a deferred entry from a consequence (alternative to `choice.deferredEventId`)
- **EventView actor strip**: when `boundActors` is non-empty, renders `CouncilPortrait` + first name for each bound actor above the event description
- **All 28+ events retrofitted**: `domestic.ts` (12 events), `cultural.ts` (13 events), `building.ts` (2 events), `diplomacy.ts` (1 event), `economic.ts` (2 events); `environmental.ts`/`company.ts` have no slots (elemental/external events)
- **`away`** — dispatched on an external mission; unavailable until the deferred event resolves
- **`builder`** — temporarily assigned to a construction project
- **`missionActorSlot`** on `EventChoice`: names the actor slot of the person sent on a deferred mission; their `WorkRole` is set to `'away'` immediately and restored by `game-store.startTurn` when the deferred event fires
- **Away blocking**: `matchesCriteria` returns `false` for `away` persons → they are excluded from all actor slot selection, event eligibility, and `best_council`/`best_settlement` skill check picks
- **Role restoration**: `game-store.startTurn` iterates due `DeferredEventEntry` objects, reads `context.missionActorId` + `context.prevRole`, and restores the person's role before building `stateAfterDrain`
- **Construction guard**: `assignBuilder` in `game-store.ts` skips persons with `role === 'away'`
- **UI**: `ROLE_LABELS`/`ROLE_COLORS` now cover all 11 roles including `builder`, `away`, `gather_food`, `gather_stone`, and `gather_lumber`; `PersonDetail` shows a styled badge; `CouncilFooter` dims away members (opacity-50) and suppresses advice generation for them
- **Live deferred chains**: `dip_upriver_camp_spotted` (`missionActorSlot: 'envoy'`, 4 turns) and `dom_settler_falls_ill` (`missionActorSlot: 'patient'`, 2 turns)

---

### Economy System Notes

- **Three subsystems**: Company quota (annual obligation), Tribe trade (barter via Trading Post), Internal crafting (surplus conversion chains)
- **`CompanyRelation`** fields: `standing` (0–100, starts 60), `annualQuotaGold`, `annualQuotaGoods`, `quotaContributedGold`, `quotaContributedGoods`, `consecutiveFailures`, `supportLevel`, `yearsActive`
- **Quota formula**: `quotaGold = 5 + (year − 3) × 2` / `quotaGoods = 8 + (year − 3) × 3`; years 1–3 have no quota; 1 gold = 2 goods exchange
- **`checkQuotaStatus()`** returns `'exceeded' | 'met' | 'partial' | 'failed'`; called by `processDusk()` in Autumn
- **Annual ship** event fires each Spring; base delivery scales with `supportLevel`; optional settler/goods requests cost standing
- **Trade prerequisites**: `tribe.contactEstablished: true` + a built `trading_post`; without Trading Post, TradeView shows a locked panel
- **`validateTrade(offer, request, resources, tribe, currentTurn)`**: 5-arg signature; `currentTurn` enforces once-per-turn tribe cooldown via `tribe.lastTradeTurn`
- **Fairness meter**: fair band ±30% value ratio; strongly favoring player (>+30%) reduces disposition; favoring tribe (>+15%) increases it
- **Spoilage** fires at dawn: food 5% (summer ×1.5; Granary halves), cattle 3% (winter ×2; Stable halves), medicine/goods 1–2%; ignored if < 1 unit loss
- **`lastSpoilage`** in `GameStore`: set when total spoilage ≥ 1 unit; drives `SpoilageNotification` banner in `GameScreen.tsx`; cleared by `dismissSpoilage()`
- **Craft recipes** (`CRAFT_RECIPES`): `craft_lumber_to_goods` (Workshop + 3 lumber → 4 goods), `craft_cattle_slaughter` (2 cattle → 3 food + 1 goods), `craft_medicine_prep` (Healer's Hut + 3 food + 2 goods → 4 medicine), `craft_goods_to_gold` (5 goods → 2 gold)
- **Trading Post event boost**: `eco_passing_merchant` weight doubled in `drawEvents()` via `weightBoosts` parameter when Trading Post is present

### Generic Task Roles Notes

- **3 new `WorkRole` values**: `gather_food` · `gather_stone` · `gather_lumber` (total WorkRole union: **12 values**, including `keth_thara` added in Phase 3.5)
- **`gatherYield(skill)`** helper in `resources.ts`: base 1; +1 if skill ≥ 26 (Good); +1 if skill ≥ 63 (Excellent) → 1–3 range
- **Skill mappings**: `gather_food` uses `plants`; `gather_stone` and `gather_lumber` use `custom`
- **Seasonal scaling**: `gather_food` accumulates into `personFood` → gets the food seasonal multiplier like farmers; stone and lumber are written directly to `delta.stone` / `delta.lumber` — **no seasonal scaling**
- **Farmer rebalance**: base farmer yield `3 → 1`; Tilled Fields (`fields` building) restores it to 3 via `roleProductionBonus: { role: 'farmer', bonus: { food: 2 } }`
- **Tilled Fields** building: food category · 5 lumber · 1 season · also grants `plants` skill growth (+1/season) to assigned farmers
- **Role assignment UI**: clicking a non-locked role badge in PeopleView opens a grouped dropdown (Farming & Gathering / Specialist / Unassigned); `away` and `builder` show a locked tooltip instead
- **`ROLE_LABELS`/`ROLE_COLORS`** in `src/ui/shared/role-display.ts`: `gather_food` = Forager (lime), `gather_stone` = Quarrier (slate), `gather_lumber` = Lumberjack (yellow)

---

## Ethnic Group Reference (Phase 2 genetics input)

| Group | Skin (0–1) | Undertone | Hair | Eyes | Build / Height |
|-------|-----------|-----------|------|------|----------------|
| Imanian | 0.2 | cool_pink / neutral | blonde–dark_brown, straight–wavy | blue, grey, green | variable / average |
| Kiswani Riverfolk | 0.65 | copper | black, wavy–curly | most diverse (mixed ancestry) | athletic / tall |
| Kiswani Bayuk | 0.8 | bronze | black (often dyed red), curly–coily | grey (distinctive) | compact / short |
| Kiswani Haisla | 0.7 | warm | black dreadlocks | grey–blue | lean-muscular / average |
| Hanjoda Stormcaller | 0.35 | cool–neutral | blonde, straight–wavy | grey, blue | wiry-gaunt / very tall |
| Hanjoda Bloodmoon | 0.6 | warm | dark, variable | brown, dark | athletic-lean / average–tall |
| Hanjoda Talon | 0.75 | neutral | black | **amber/yellow** (unique marker) | athletic, wide hips / average |
| Hanjoda Emrasi | 0.5 (high var) | warm | variable | variable | medium-athletic / average |

**Key lore rules:**
- Talon amber/yellow eyes are their most distinctive marker — never dilute this in distributions
- Bayuk grey eyes are rare for a Kiswani group — emphasise this contrast
- Stormcaller blonde hair is unusual among Sauromatians — lore hints at non-Sauromatian ancestry

---

## Gender Ratio Mechanics (Phase 2)

Pure Sauromatian woman × any father → ~6 daughters per 1 son (0.14 male probability)
Sauromatian × Imanian → ~2–3:1 female skew
Pure Imanian × Pure Imanian → ~1:1 (0.50 male probability)

Formula: `maternalBase = lerp(0.50, 0.14, sauromatianFraction)` + up to +0.20 from Imanian father fraction

**Kethara's Bargain (extended fertility):** Inherits strictly through maternal line. Mother has `extendedFertility = true` → daughter always inherits it regardless of father. Fertility end age: 52–55 (vs 42–45 for pure Imanian women).

---

## Inheritance Algorithm (Phase 2)

```
1. Child bloodline = average of mother + father bloodlines
2. Build blended trait distribution weighted by bloodline fractions
3. Sample each visible trait:
   - Continuous (skin tone): Gaussian around (0.7 × ethnic mean + 0.3 × parent mean)
   - Discrete (eye color): weighted pick with +0.15 boost to each parent's actual value, renormalised
4. genderRatioModifier from resolveGenderRatio(mother, father)
5. extendedFertility = mother.genetics.extendedFertility (always maternal)
```

---

## localStorage Notes

- Save key: `palusteria_save`
- JSON serialisation: `Map<K,V>` → `[K,V][]` on save, reconstructed on load
- Schema changes between sessions will silently wipe the old save (try/catch in store)
- To manually clear: `localStorage.removeItem('palusteria_save')` in the browser console

---

## Tests

- `tests/utils/rng.test.ts` — 13/13 passing
- `tests/genetics/inheritance.test.ts` — 10/10 passing
- `tests/genetics/gender-ratio.test.ts` — 26/26 passing
- `tests/genetics/fertility.test.ts` — 31/31 passing
- `tests/events/event-filter.test.ts` — 56/56 passing (includes 3 new: `weightBoosts` multiplier, no-boost no-op, unknown boost key)
- `tests/events/resolver.test.ts` — 42/42 passing
- `tests/events/event-queue.test.ts` — 9/9 passing (nextEvent transitions, follow-up insertion, resolveEventChoice/pendingEvents isolation, **3 new: away role restoration via startTurn**)
- `tests/events/council-advice.test.ts` — 95/95 passing (archetype mapping, choice scoring, hash determinism, advice generation, template coverage)
- `tests/events/actor-resolver.test.ts` — 38/38 passing (matchesCriteria per-field, canFillSlot, canResolveActors mutual exclusion, selectActor RNG determinism, resolveActors multi-slot exclusion + optional slots, **away role exclusion**)
- `tests/events/interpolation.test.ts` — 25/25 passing (all `{slot.*}` token variants, both sexes, capitalised pronouns, unknown slot/suffix passthrough, multi-slot strings)
- `tests/economy/resources.test.ts` — 42/42 passing (farmers without/with Fields, traders, cattle, seasonal mods, gather_food/stone/lumber skill tiers, guard=0)
- `tests/economy/company.test.ts` — 35/35 passing (quota formula, escalation, request availability, support delivery)
- `tests/economy/trade.test.ts` — 28/28 passing (price calculation, fairness, disposition deltas, Trading Post bonuses)
- `tests/economy/spoilage.test.ts` — 18/18 passing (per-resource rates, season modifiers, building mitigation)
- `tests/economy/crafting.test.ts` — 36/36 passing (recipe availability gating, apply/validate logic)
- `tests/population/demographics.test.ts` — 16/16 passing (includes 4 child-culture blending tests)
- `tests/population/marriage.test.ts` — 12/12 passing
- `tests/population/household.test.ts` — 29/29 passing (createHousehold, addTo/removeFrom, getSeniorWife, countWives/Concubines, dissolveHousehold, getHouseholdMembers, getHouseholdByPerson)
- `tests/population/culture.test.ts` — 21/21 passing (deriveCulture, processCulturalDrift, buildSettlementCultureDistribution, computeCulturalBlend)
- `tests/culture/language-acquisition.test.ts` — 34/34 passing
- `tests/population/skills.test.ts` — 36/36 passing (getSkillRating, getDerivedSkill, generatePersonSkills, createPerson integration)
- `tests/buildings/construction.test.ts` — 19/19 passing (canBuild, startConstruction, assignBuilder/removeBuilder, processConstruction, cancelConstruction)
- `tests/buildings/building-effects.test.ts` — 23/23 passing (shelterCapacity, productionBonus, childMortalityModifier, overcrowding, hasBuilding, etc.)
- **Total: 713/713 passing**

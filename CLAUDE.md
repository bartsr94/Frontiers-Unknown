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
| Phase 3.6 — Opinions & Autonomy | ✅ Complete | Opinion scores ✅ · Trait affinities/clashes ✅ · Per-turn drift & decay ✅ · Marriage opinion gate ✅ · `modify_opinion` consequence ✅ · `computeOpinionBreakdown()` tooltip ✅ · `PersonAmbition` (5 types) ✅ · Autonomous events ✅ · Ambition badge UI ✅ · Key Opinions UI ✅ · Decaying `OpinionModifier` ✅ · `modify_opinion_pair` / `modify_opinion_labeled` ✅ · Auto co-actor bond ✅ |
| Phase 3.7 — Religion System | ✅ Complete | Three faiths (`imanian_orthodox`, `sacred_wheel`, `syncretic_hidden_wheel`) ✅ · Hidden Wheel divergence counter ✅ · Religious tension formula ✅ · Company religious pressure drain ✅ · `ReligiousPolicy` (4 values) ✅ · 7 religion events ✅ · Priesthood roles (`priest_solar`, `wheel_singer`, `voice_of_wheel`) ✅ · Religion UI panel ✅ · 19 new tests ✅ |
| Phase 3.8 — Cultural Identity Pressure | ✅ Complete | `IdentityPressure` counters ✅ · Five-zone blend scale ✅ · Passive Company standing + tribe disposition deltas ✅ · 6 identity events ✅ · `modify_cultural_blend` / `modify_all_tribe_dispositions` consequences ✅ · `sauromatianHeritage` actor criterion ✅ · `IdentityScale` UI widget ✅ · 35 new tests ✅ |
| Phase 3.9 — Trait Expansion | ✅ Complete | `TraitDefinition` catalog (~80 traits) ✅ · 6 trait categories incl. `mental_state` ✅ · Temporary traits with `traitExpiry` map ✅ · Expanded `TRAIT_CONFLICTS` (21 pairs) + `TRAIT_SHARED_BONUS` (15 entries) ✅ · `computeTraitCategoryBoosts` event-deck shaping ✅ · `applyTraitOpinionEffects` per-turn autonomous drift ✅ · `getTraitSkillGrowthBonuses` ✅ · `applyTemporaryTraitExpiry` + earned trait acquisition ✅ · `inheritAptitudeTraits()` at birth ✅ · 128 new tests ✅ |
| Phase 4.0 — Character Autonomy | ✅ Complete | Named relationships (friend/rival/nemesis/confidant/mentor/student) ✅ · Scheme engine (5 types, progress-based event firing) ✅ · Faction system (6 types, membership/strength/demands) ✅ · Activity log (30-entry rolling feed, 11 entry types) ✅ · Community tab (bonds, factions, feed) ✅ · Shared-role opinion drift ✅ · 135 new tests ✅ |
| Phase 4.1 — Happiness System | ✅ Complete | Per-person happiness score (4 categories: material/social/purpose/trait) ✅ · Settlement morale ✅ · `lowHappinessTurns` streak → desertion gate ✅ · `happinessMultipliers` wired into production ✅ · `getDepartingFamily` ✅ · 99 new tests ✅ |
| Misc — Genetics Variation | ✅ Complete | `averageBloodlines` now samples ±1–3% biologic split via `Gaussian(0.5, σ=0.015)` clamped to [0.44, 0.56] ✅ · 6 new `TraitId` values (`optimistic`, `hot_tempered`, `cowardly`, `romantic`, `lonely`, `solitary`) + catalog entries ✅ |
| Phase 4.2 — Housing & Specialisation | ✅ Complete | 4 private dwelling tiers (`wattle_hut`/`cottage`/`homestead`/`compound`) ✅ · Worker slot caps on all production buildings ✅ · 5 specialisation roles (`blacksmith`/`tailor`/`brewer`/`miller`/`herder`) ✅ · `applyDwellingClaims` 3-pass auto-claim algorithm ✅ · `findAvailableWorkerSlotIndex` slot enforcement ✅ · `person.claimedBuildingId` propagation ✅ · Founding settlers start as foragers (`gather_food`) ✅ · SettlementView dwelling category UI ✅ · PeopleView Trades group + slot hints ✅ · PersonDetail Housing section ✅ · 15 new tests ✅ |
| Misc — Systems Interconnection | ✅ Complete | Named-rel → scheme generation (nemesis → undermine; confidant suppresses; mentor → tutor without trait) ✅ · Opinion-scaled scheme progress via `schemeOpinionFactor` ✅ · Happiness score → cultural drift rate (`happinessDriftCoefficient` in `culture.ts`) ✅ · `happinessScores` added to `HappinessTrackingResult` ✅ · Design doc in `plans/SYSTEMS_INTERCONNECTION.md` ✅ |
| Misc — Apprenticeship System | ✅ Complete | `TRAINABLE_TRADES` (12 roles) ✅ · Masters auto-form pairs with children/students every 8 turns ✅ · Progress rate 0.04–0.07/turn (skill tier + `mentor_hearted`) ✅ · Graduation bonus 5–27% per-role capped at 30% ✅ · `tradeTraining` multiplier wired into `calculateProduction()` ✅ · 2 player-facing events (`appr_trade_training_begins`, `appr_trade_mastered`) ✅ · Trade Training section in PersonDetail ✅ · Activity feed icons ✅ · 30 new tests ✅ |
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
npm test             # Run Vitest (981 passing across 32 test files)
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
| `src/simulation/events/event-filter.ts` | `ALL_EVENTS`, `filterEligibleEvents()`, `drawEvents()`; `canResolveActors` gate makes `actorRequirements` act as implicit event prerequisites; `AMBIENT_MIN_COOLDOWN = 16` floor applied to all `isAmbient: true` events |
| `src/simulation/events/resolver.ts` | `applyEventChoice(event, choiceId, state, rng?, boundActors?)` returning `ApplyChoiceResult`; `resolveSkillCheck()` helper; `resolveConsequenceTarget()` (maps `{slot}` targets to person IDs); `add_person` consequence handler |
| `src/simulation/events/actor-resolver.ts` | Actor binding engine: `matchesCriteria`, `canFillSlot`, `canResolveActors`, `selectActor`, `resolveActors`, `interpolateText` — pure TS, zero React, seeded RNG only |
| `src/simulation/events/definitions/` | 57 events across 9 files; all events with named actors have `actorRequirements` |
| `src/simulation/events/definitions/household.ts` | 6 household/domestic events: `hh_tribal_thrall_offer`, `hh_thrall_elevation`, `hh_wife_council_demands`, `hh_tradition_clash`, `hh_ashka_melathi_deepens`, `hh_keth_thara_service_ends` |
| `src/simulation/events/definitions/relationships.ts` | 5 autonomous ambition-driven events: `rel_mutual_attraction`, `rel_council_petition`, `rel_seniority_bid`, `rel_keth_thara_selfvow`, `rel_informal_union_proposed` |
| `src/simulation/events/definitions/identity.ts` | 6 cultural identity pressure events: `ident_company_cultural_concern`, `ident_company_inspector_dispatched`, `ident_company_pleased`, `ident_tribal_leader_invitation`, `ident_tribal_champion_recognised`, `ident_settlers_feel_foreign` |
| `src/simulation/events/definitions/schemes.ts` | 5 scheme resolution events: `sch_courtship_discovered`, `sch_faith_advocacy_noticed`, `sch_rumours_spreading`, `sch_undermining_climax`, `sch_tutor_breakthrough`; all have `isDeferredOutcome: true` |
| `src/simulation/buildings/building-definitions.ts` | `BuildingId` (21-member union), `BuildingDef`, `BUILDING_CATALOG`, `getBuildingDisplayName(defId, style)` — static catalog of all building types; `workerSlots?: number` and `workerRole?: WorkRole` on `BuildingDef` for slot-cap enforcement |
| `src/simulation/buildings/building-effects.ts` | Pure effect getters: `getShelterCapacity`, `getOvercrowdingRatio`, `getBuildingFlatProductionBonus`, `getLanguageDriftMultiplier`, `getBuildingCulturePull`, `getSkillGrowthBonuses`, `hasBuilding`, `lacksBuilding`, etc. |
| `src/simulation/buildings/construction.ts` | `canBuild` → `CanBuildResult` (`{ ok: true }` / `{ ok: false; reason }`); `startConstruction`, `assignBuilder`, `removeBuilder`, `processConstruction`, `cancelConstruction`; `applyDwellingClaims(completedBuildings, allBuildings, households, people)` — 3-pass fairness algorithm (Pass 1 scheme-owned → direct link, Pass 2 unowned → first homeless household, Pass 3 propagate `person.claimedBuildingId` / clear demolished refs); `findAvailableWorkerSlotIndex(buildings, role)` → index of first building with an open `workerRole` slot, `−1` if none; `DWELLING_IDS` set (`wattle_hut`, `cottage`, `homestead`, `compound`) |
| `src/simulation/economy/resources.ts` | Production/consumption math with seasonal modifiers |
| `src/simulation/genetics/traits.ts` | Trait type definitions + `IMANIAN_TRAITS` constant |
| `src/data/ethnic-distributions.ts` | All 8 ethnic group `TraitDistribution` constants + `ETHNIC_DISTRIBUTIONS` lookup map |
| `src/simulation/culture/language-acquisition.ts` | `resolveChildLanguages`, `applyLanguageDrift`, `updateSettlementLanguages`, `updateLanguageTension`, `updateLanguageDiversityTurns` |
| `src/simulation/culture/identity-pressure.ts` | `IDENTITY_THRESHOLDS`, `IdentityPressureResult`, `processIdentityPressure(blend, currentPressure, tribes)` — pure logic; no RNG; no React |
| `src/simulation/population/culture.ts` | `CULTURE_LABELS`, `SAUROMATIAN_CULTURE_IDS`, `deriveCulture`, `processCulturalDrift` (optional 4th param `happinessScores?: Map<string, number>`), `buildSettlementCultureDistribution`, `computeCulturalBlend`; `happinessDriftCoefficient(score)` helper — maps happiness score to 0.65–1.10× drift multiplier |
| `src/simulation/genetics/gender-ratio.ts` | `getSauromatianFraction`, `getImanianFraction`, `resolveGenderRatio`, `determineSex` |
| `src/simulation/genetics/inheritance.ts` | `resolveInheritance()` pipeline: `averageBloodlines(mother, father, rng?)`, `blendTraitDistributions`, `sampleContinuous`, `sampleDiscrete`; `inheritAptitudeTraits(mother, father, rng)` — samples aptitude traits based on `inheritWeight` in `TRAIT_DEFINITIONS`; bloodline split is `Gaussian(0.5, 0.015)` clamped [0.44, 0.56] when RNG provided |
| `src/simulation/genetics/fertility.ts` | `BirthResult`, `createFertilityProfile`, `getFertilityChance`, `attemptConception`, `processPregnancies`; calls `inheritAptitudeTraits()` at birth and passes result as child's initial `traits` |
| `src/simulation/population/person.ts` | `Person` interface + `createPerson(options, rng?)` factory; heritage/bloodline types; `SkillId`, `PersonSkills`, `getSkillRating()`, `getDerivedSkill()`, `generatePersonSkills()` |
| `src/simulation/population/naming.ts` | `generateName(sex, culture, motherFamilyName, fatherFamilyName, rng)` — 3 culture pools |
| `src/simulation/population/marriage.ts` | `canMarry`, `performMarriage`, `getMarriageability`, `formConcubineRelationship`, `InformalUnionStyle` — Sauromatian/Imanian rules; household auto-formation on marriage |
| `src/simulation/population/household.ts` | `createHousehold`, `addToHousehold`, `removeFromHousehold`, `getHouseholdMembers`, `getHouseholdByPerson`, `getSeniorWife`, `countWives`, `countConcubines`, `dissolveHousehold`, `HOUSEHOLD_ROLE_LABELS`, `HOUSEHOLD_ROLE_COLORS` |
| `src/simulation/population/opinions.ts` | `computeBaselineOpinion`, `computeTraitOpinion`, `computeOpinionBreakdown`, `initializeBaselineOpinions`, `applyOpinionDrift`, `decayOpinions`, `decayOpinionModifiers`, `getOpinion`, `getEffectiveOpinion`, `setOpinion`, `adjustOpinion`, `addOpinionModifier`, `getModifierSummary`, `applyMarriageOpinionFloor`, `OPINION_TRACK_CAP` |
| `src/simulation/population/ambitions.ts` | `tickAmbitionIntensity`, `evaluateAmbition`, `determineAmbitionType`, `generateAmbition`, `clearAmbition`, `getAmbitionLabel`, `getAmbitionIntensityClass`, `AMBITION_FIRING_THRESHOLD` |
| `src/simulation/population/named-relationships.ts` | Named relationship formation/dissolution; `processNamedRelationships()`, `seedFoundingRelationships()`; `NamedRelationshipType` (friend/rival/nemesis/confidant/mentor/student); `FRIEND_OPINION_THRESHOLD = 50`, `FRIEND_SUSTAIN_TURNS = 4` |
| `src/simulation/personality/scheme-engine.ts` | `processSchemes()`, `generateScheme()`; 5 scheme types (`scheme_court_person`, `scheme_convert_faith`, `scheme_befriend_person`, `scheme_undermine_person`, `scheme_tutor_person`); `SCHEME_GENERATE_INTERVAL = 12`; fires climax events at scheme completion |
| `src/simulation/world/factions.ts` | `processFactions()`, `computeFactionStrength()`, `isEligibleMember()`; 6 faction types (`cultural_preservationists`, `company_loyalists`, `orthodox_faithful`, `wheel_devotees`, `community_elders`, `merchant_bloc`); `FACTION_MIN_MEMBERS = 3`, `DEMAND_STRENGTH_THRESHOLD = 0.45` |
| `src/simulation/population/happiness.ts` | `computeHappinessFactors(person, state)` → `HappinessFactor[]`; `computeHappiness` (−100–+100); `computeSettlementMorale`; `applyHappinessTracking` (delta map + multipliers + desertion candidates); `getDepartingFamily`; `getHappinessProductionMultiplier`; `isDesertionEligible` — pure TS, no RNG, no React |
| `src/data/trait-definitions.ts` | `TRAIT_DEFINITIONS` — authoritative catalog of all ~86 `TraitDefinition` entries (includes `optimistic`, `hot_tempered`, `cowardly`, `romantic`, `lonely`, `solitary`); `TEMPORARY_TRAITS: ReadonlySet<string>`; `APTITUDE_TRAITS: ReadonlySet<string>` |
| `src/data/trait-affinities.ts` | `TRAIT_CONFLICTS` (21 conflicting pairs with penalties) · `TRAIT_SHARED_BONUS` (15 shared-trait bonuses) |
| `src/simulation/personality/trait-behavior.ts` | `computeTraitCategoryBoosts(people)` — geometric-mean event-deck multipliers; `applyTraitOpinionEffects(people)` — per-turn jealous/envious/suspicious/trusting/charming deltas; `getTraitSkillGrowthBonuses(person)` — green_thumb/keen_hunter/gifted_speaker/mentor_hearted/inspired/bereaved skill deltas |
| `src/simulation/personality/assignment.ts` | `applyTemporaryTraitExpiry(people, currentTurn)` — removes expired temporary traits (delta-map contract); `checkEarnedTraitAcquisition(person, settlementHasBuildingId, rng)` — probabilistic acquisition pipeline (respected_elder/veteran/healer/negotiator/storyteller); `grantTrait(person, traitId, expiryTurn?, currentTurn?)` — immutable trait addition helper |
| `src/simulation/world/tribes.ts` | `createTribe`, `TRIBE_PRESETS` (16 presets), `updateTribeDisposition` |
| `src/stores/game-store.ts` | Zustand store — full turn lifecycle, council, `arrangeMarriage`, `arrangeInformalUnion`, `assignKethThara`, tribe init; `households` Map serialised as `[string, Household][]` |
| `src/ui/layout/LeftNav.tsx` | Left nav with phase-aware End Turn / Confirm Turn button |
| `src/ui/layout/BottomBar.tsx` | Full-width resource strip (food, cattle, goods, gold, lumber, stone, pop) |
| `src/simulation/events/council-advice.ts` | Council voice engine: `VoiceArchetype`, `getVoiceArchetype`, `scoreChoiceForPerson`, `hashPersonEvent`, `generateAdvice` — pure logic, deterministic via djb2 hash |
| `src/ui/components/portrait-resolver.ts` | `PortraitCategory`, `AgeStage`, `PORTRAIT_REGISTRY`, `getAgeStage()`, `getPortraitCategory()`, `resolvePortraitSrc(person)` — category × sex × age stage × variant → `/portraits/…` path; stage fallback: adult → young_adult → senior → child |
| `src/ui/components/IdentityScale.tsx` | Five-zone cultural blend bar with pressure badges; props `{ culturalBlend, identityPressure }`; mounted inside SettlementView Religion sidebar |
| `src/ui/components/CouncilPortrait.tsx` | 40×50px portrait `<img>` with skin-tone swatch fallback |
| `src/ui/components/AdviceBubble.tsx` | Italic speech bubble rendered above the selected adviser seat in CouncilFooter |
| `src/ui/layout/CouncilFooter.tsx` | 7-seat Expedition Council row; portraits, click-to-select adviser, trait-driven `AdviceBubble` with per-(person × event) advice caching |
| `src/ui/views/PeopleView.tsx` | Settler roster; sort/filter (sex, status, heritage group, **base skill**); click row → PersonDetail panel |
| `src/ui/views/PersonDetail.tsx` | Full person detail: genetics, heritage, traits, skills (base + derived), languages, family |
| `src/ui/overlays/FamilyTreeOverlay.tsx` | Full-screen overlay opened from PersonDetail: **Family Tree** tab (tier-based rendering, child spouses inline, grandchildren grouped by parent, re-rootable with history stack) + **Household** tab (member roster by household role, work-role assignment dropdown, claimed dwelling + production buildings) |
| `src/ui/views/EventView.tsx` | Event card with choices; actor badge strip (portrait + name) above description when slots are bound; `interpolateText` applied to all displayed text; calls `resolveEventChoice` + `nextEvent` |
| `src/ui/views/TradeView.tsx` | Trade & Commerce view: Company quota panel, tribe list with dispositions, barter interface with fairness meter; locked without Trading Post |
| `src/ui/views/CommunityView.tsx` | 3-panel community tab — left: population/bonds summary; centre: factions list with strength/demands; right: expanded activity feed |
| `src/ui/components/ActivityFeed.tsx` | Rolling 30-entry activity feed; per-type icon (relationship/scheme/faction/trait/ambition/role); clickable person name chips navigate to PersonDetail |
| `src/ui/shared/role-display.ts` | `ROLE_LABELS` and `ROLE_COLORS` — exhaustive `Record<WorkRole, string>` for all 20 roles |
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

- **21 building types** (`BuildingId`): `camp` · `longhouse` · `roundhouse` · `great_hall` · `clan_lodge` · `granary` · `fields` · `workshop` · `trading_post` · `healers_hut` · `gathering_hall` · `palisade` · `stable` · `mill` · `smithy` · `tannery` · `brewery` · `wattle_hut` · `cottage` · `homestead` · `compound`
- **4 dwelling tiers** (`DWELLING_IDS`): `wattle_hut` (cheapest) · `cottage` · `homestead` · `compound` (highest capacity); auto-claimed by households on construction completion via `applyDwellingClaims`
- **Worker slot caps** on production buildings: `workerSlots?: number` on `BuildingDef` limits how many settlers can staff a building; `workerRole?: WorkRole` ties the slot to a specific role; enforced in `assignRole` via `findAvailableWorkerSlotIndex`
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
- **`isAmbient?: boolean`** on `GameEvent`: marks background-texture events (weather, random encounters, filler) that carry no specific narrative arc; subject to `AMBIENT_MIN_COOLDOWN = 16` turns in `isEventEligible`, regardless of their per-event `cooldown` value — effectively caps ambient events to at most once per in-game year; currently marked: `dom_hunting_party`, `env_bountiful_harvest`, `env_violent_storm`, `env_winter_hardship`, `eco_passing_merchant`
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
- **UI**: `ROLE_LABELS`/`ROLE_COLORS` now cover all 20 roles including `builder`, `away`, `gather_food`, `gather_stone`, `gather_lumber`, and the 5 specialisation roles; `PersonDetail` shows a styled badge; `CouncilFooter` dims away members (opacity-50) and suppresses advice generation for them
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

- **`WorkRole` union** is now **20 values**: `farmer` · `trader` · `guard` · `craftsman` · `healer` · `builder` · `away` · `keth_thara` · `gather_food` · `gather_stone` · `gather_lumber` · `priest_solar` · `wheel_singer` · `voice_of_wheel` · `blacksmith` · `tailor` · `brewer` · `miller` · `herder` · `unassigned`
- **`gatherYield(skill)`** helper in `resources.ts`: base 1; +1 if skill ≥ 26 (Good); +1 if skill ≥ 63 (Excellent) → 1–3 range
- **Skill mappings**: `gather_food` uses `plants`; `gather_stone` and `gather_lumber` use `custom`
- **Seasonal scaling**: `gather_food` accumulates into `personFood` → gets the food seasonal multiplier like farmers; stone and lumber are written directly to `delta.stone` / `delta.lumber` — **no seasonal scaling**
- **Farmer rebalance**: base farmer yield `3 → 1`; Tilled Fields (`fields` building) restores it to 3 via `roleProductionBonus: { role: 'farmer', bonus: { food: 2 } }`
- **Tilled Fields** building: food category · 5 lumber · 1 season · also grants `plants` skill growth (+1/season) to assigned farmers
- **Role assignment UI**: clicking a non-locked role badge in PeopleView opens a grouped dropdown (Farming & Gathering / Specialist / Unassigned); `away` and `builder` show a locked tooltip instead
- **`ROLE_LABELS`/`ROLE_COLORS`** in `src/ui/shared/role-display.ts`: `gather_food` = Forager (lime), `gather_stone` = Quarrier (slate), `gather_lumber` = Lumberjack (yellow)

---

## Phase 3.6 — Opinions & Autonomy Notes

### Opinion System

- **`OPINION_TRACK_CAP = 150`** — below this population, all pairs are tracked; above it, only established entries are updated
- **Baseline sources** (computed once when two people first meet):
  - Same `primaryCulture`: **+10** · Same `religion`: **+8**
  - No shared conversational language (fluency ≥ 0.30): **−15** · Tradetalk-only bridge: **−5**
  - Trait conflicts (8 pairs): −10 to −20 · Shared-trait bonuses (7 traits): +8 to +12
  - Clamped to **[−80, +80]** to leave room for events and family bonds
- **Per-turn drift** (in `applyOpinionDrift`): same-culture pairs **+1**, no-shared-language pairs **−1**
- **Decay** (`decayOpinions`): all entries move **1 toward 0** per turn; entry deleted when it reaches 0
- **Marriage floor**: `applyMarriageOpinionFloor` raises each spouse's opinion of the other to at least **+40** immediately on marriage
- **Marriage gate**: `canMarry` / `formConcubineRelationship` both hard-block if either party's opinion < **−30**
- **`modify_opinion` consequence**: broadcasts a delta to *every* living person's opinion of the named target — models public acts
- **`computeOpinionBreakdown(a, b)`**: returns `Array<{ label: string; delta: number }>` for UI tooltips — culture, religion, language, each trait conflict/bonus, residual event delta
- **Seeded at game start**: `initializeBaselineOpinions` runs in `createInitialState` so Key Opinions are visible immediately on a new game

### Ambition System

- **`PersonAmbition`** on every `Person`: `{ type, intensity, targetPersonId, formedTurn }` or `null`
- **5 ambition types**: `seek_spouse` · `seek_council` · `seek_seniority` · `seek_cultural_duty` · `seek_informal_union`
- **Intensity**: starts at 0.10 on formation; grows **+0.05/turn** (via `tickAmbitionIntensity`); capped at 1.0; `content` trait blocks growth
- **`AMBITION_FIRING_THRESHOLD = 0.7`**: event eligibility gate — ambitions only drive events at ≥ 70% intensity
- **Generation** (`generateAmbition`): evaluated every 8 turns in `processDawn`; priority order: spouse → council → seniority → cultural duty → informal union
  - `seek_council` threshold: leadership OR diplomacy **≥ 46** (Very Good tier)
- **Evaluation** (`evaluateAmbition`): checked each dawn — `'fulfilled'` / `'failed'` / `'ongoing'`; stale after **40 turns** regardless
- **Seeded at game start**: `generateAmbition` runs for each founder in `createInitialState`; applicable founders show the badge immediately
- **UI**: ambition badge in PersonDetail beneath traits — colour-coded by intensity (dim grey → amber → rose); intensity progress bar; `title` shows exact percentage
- **5 autonomous events** in `definitions/relationships.ts` (all gate on `has_person_with_ambition`):
  - `rel_mutual_attraction` · `rel_council_petition` · `rel_seniority_bid` · `rel_keth_thara_selfvow` · `rel_informal_union_proposed`

### Key Opinions UI

- **PersonDetail** "Key Opinions" section: top-3 positive (green chips) + top-3 negative (red chips)
- Each chip is clickable (navigates to that person's detail panel)
- Hover tooltip shows `computeOpinionBreakdown` results: e.g. `"Same culture: +10\nTradetalk only: −5\nShared trait (brave): +8"`
- Deceased persons whose opinions are still stored show `†` suffix (looked up via graveyard)
- `remove_person` event consequence now adds a `GraveyardEntry` with `deathCause: 'departed'` before deletion so `nameOf()` resolves correctly
- Timed modifier entries show a `(Nt)` countdown suffix, e.g. `"Joint project: +8 (8t)"`

### Opinion Modifier System (Event-Driven Decaying Modifiers)

Two-tier opinion architecture:
- **Permanent `relationships` Map** (existing): big public acts via `modify_opinion` — never decay
- **Timed `opinionModifiers: OpinionModifier[]`** (new): event experiences that fade over time

**`OpinionModifier` interface** (on `Person`):
```typescript
interface OpinionModifier {
  id: string;        // deduplication key; same event refiring replaces stale modifier
  targetId: string;
  label: string;     // "Joint project", "Bitter quarrel"
  value: number;     // abs(value) = turns remaining; positive/negative = favour/disfavour
  eventId: string;
}
```

**Decay semantics**: `abs(value)` decrements by 1 per turn; modifier deleted when value reaches 0. A `+8` modifier lasts 8 turns; a `−6` lasts 6 turns.

**`getEffectiveOpinion(person, targetId)`**: base `relationships` value + sum of active modifier values, clamped [−100, +100]. Used everywhere a decision is made (marriage gate, ambitions, event filters, UI).

**Key functions in `opinions.ts`**:
- `addOpinionModifier(person, mod)` — deduplicates by `id`, returns new Person (immutable)
- `getModifierSummary(person, targetId)` — returns all active modifiers for a given target
- `decayOpinionModifiers(people)` — returns Map of changed persons only; called each dawn after `decayOpinions`

**Co-actor auto-bond**: When an event resolves with multiple bound actors, a `+2 "Shared: {event.title}"` modifier is automatically applied between every pair of actors unless `choice.skipActorBond === true`.

**New consequence types in `engine.ts`**:
- `modify_opinion_pair` — bidirectional timed modifier between two named actor slots
- `modify_opinion_labeled` — broadcast timed modifier from a named actor to all observers

**Modifier ID formats**:
- Auto-bond: `{eventId}:auto:{idA}:{idB}`
- Pair: `{eventId}:pair:{personAId}:{personBId}`
- Labeled broadcast: `{eventId}:labeled:{targetId}`

**Events retrofitted** (5 events, 4 files): `dom_settler_initiative`, `dom_lonely_settler`, `bld_bitter_quarrel`, `cul_religious_tension_peaks`, `dip_upriver_emissary_return`

---

## Phase 3.7 — Religion System Notes

- **Three faiths**: `imanian_orthodox` (Founding / Company), `sacred_wheel` (Sauromatian women), `syncretic_hidden_wheel` (emergent; never imported, only spread through events)
- **`irreligious` removed** from `ReligionId` — was never assigned to any person
- **`ReligiousPolicy`**: `'tolerant' | 'orthodox_enforced' | 'wheel_permitted' | 'hidden_wheel_recognized'`
- **`religiousPolicy`** lives on `Settlement`; initialised as `'tolerant'`
- **Three new `SettlementCulture` fields**: `hiddenWheelDivergenceTurns`, `hiddenWheelSuppressedTurns`, `hiddenWheelEmerged`
- **Tension formula** (`computeReligiousTension`): `rawTension = 4 × orthodoxFrac × wheelFrac`; damped by `clamp(1 − hiddenFrac×2, 0, 1)` — pure splits → 0, 50/50 Orthodox/Wheel → 1.0
- **Hidden Wheel divergence** (`computeHiddenWheelDivergence`): counter advances 1/turn when both Orthodox ≥ 15% AND Wheel ≥ 15% AND policy ≠ `orthodox_enforced`; fires `rel_hidden_wheel_emerges` when it hits 20 (= 5 in-game years); suppression freezes the clock
- **Company pressure** (`computeCompanyReligiousPressure`): annual standing drain when Wheel > 25%; formula `−Math.round((wheel − 0.25) × 10)`, capped at −5/yr; ×2 under `hidden_wheel_recognized`; 0 under `orthodox_enforced`
- **`rel_hidden_wheel_emerges`** and **`rel_company_concern_letter`** have `isDeferredOutcome: true` — injected programmatically by the store, never drawn normally
- **Hidden Wheel emergence injection**: `startTurn()` checks `dawnResult.shouldFireHiddenWheelEvent` and unshifts `rel_hidden_wheel_emerges` into the pending event queue
- **Company concern letter injection**: `endTurn()` checks `duskResult.shouldFireCompanyReligionEvent` and enqueues `rel_company_concern_letter` for next turn
- **`setReligiousPolicy(policy)`** action on the store: sets `settlement.religiousPolicy`; also sets `culture.hiddenWheelEmerged = true` if policy is `hidden_wheel_recognized`
- **Priesthood roles** (`priest_solar`, `wheel_singer`, `voice_of_wheel`) added to `WorkRole`; labels/colours in `role-display.ts`
- **`ReligionPanel`** in `SettlementView.tsx`: faith distribution bars, tension indicator, Hidden Wheel progress counter, policy dropdown (policy dropdown disabled outside management phase)
- **Serialisation**: all new fields are scalars (no Map handling needed); `deserializeGameState` provides `?? 0` / `?? false` / `?? 'tolerant'` fallbacks for old saves
- **`decayOpinionModifiers`** now returns only *changed* entries (delta map, same contract as `decayOpinions`) — prior behaviour (full-copy return) was a pre-existing bug caught and fixed during this phase

### Religion Key Files

| File | Purpose |
|------|---------|
| `src/simulation/events/definitions/religious.ts` | 7 religion events: 2 programmatic-injection, 3 conversion, 1 tension-eruption, 1 chaplain |
| `src/simulation/population/culture.ts` | `computeReligiousTension`, `computeHiddenWheelDivergence`, `computeCompanyReligiousPressure` |
| `tests/culture/religion.test.ts` | 19 religion tests across all 3 new functions |

---

## Phase 3.8 — Cultural Identity Pressure Notes

- **`IdentityPressure` interface**: `{ companyPressureTurns: number; tribalPressureTurns: number }` — tracks how many consecutive seasons the blend has been outside the safe zone in each direction
- **Five blend zones**:
  | Zone | Blend range | Company Δ/season | Tribe multiplier table |
  |------|------------|------------------|------------------------|
  | Extreme Imanian | < 0.10 | +0.5 | `TRAIT_MULTIPLIERS_IMANIAN` |
  | Soft Imanian | 0.10–0.25 | +0.25 | `TRAIT_MULTIPLIERS_IMANIAN` |
  | Safe | 0.25–0.65 | 0 | none |
  | Soft Native | 0.65–0.80 | −0.5 | `TRAIT_MULTIPLIERS_NATIVE` |
  | Extreme Native | > 0.80 | −1.5 | `TRAIT_MULTIPLIERS_NATIVE` |
- **Counter semantics**: `companyPressureTurns` increments when blend is in a native zone; resets to 0 when blend returns to safe zone. `tribalPressureTurns` mirrors this for the Imanian zone.
- **Tribe disposition deltas**: base delta × average of all the tribe's trait multipliers; isolationist tribes receive reduced pressure (×0.3); warlike tribes receive amplified pressure (×1.8 Imanian / ×1.3 native)
- **`processIdentityPressure(blend, currentPressure, tribes)`**: deterministic, no RNG; applied in `processDawn()` after cultural blend computation; result carried in `DawnResult.identityPressureResult`
- **`modify_cultural_blend` consequence**: `value` = fractional delta (e.g. `−0.03`); applied as `clamp(blend + delta, 0, 1)`
- **`modify_all_tribe_dispositions` consequence**: `value` = integer delta broadcast to every tribe in `state.tribes`
- **`sauromatianHeritage` actor criterion**: `matchesCriteria` checks `SAUROMATIAN_CULTURE_IDS.has(person.heritage.primaryCulture)`
- **`min_company_pressure_turns` / `min_tribal_pressure_turns` prerequisites**: read from `state.identityPressure?.companyPressureTurns` with `?? 0` fallback for old saves
- **`IdentityScale` widget**: named export in `IdentityScale.tsx`; props `{ culturalBlend, identityPressure }`; five-zone colour bar (red–orange–green–orange–red) with white tick at blend position; "Ansberite" / "Native" end labels; amber badge for company concern when in native zone; stone badge for tribal restlessness when in Imanian zone; italic "No cultural pressure" note in safe zone
- **Mounted in `SettlementView.tsx`**: placed above `<ReligionPanel>` inside the Religion sidebar (sidebar widened to `w-56`)
- **Serialisation**: both counter fields are plain numbers — no Map handling needed; `deserializeGameState` provides `?? { companyPressureTurns: 0, tribalPressureTurns: 0 }` fallback

### Identity Pressure Key Files

| File | Purpose |
|------|---------|
| `src/simulation/culture/identity-pressure.ts` | `IDENTITY_THRESHOLDS`, `IdentityPressureResult`, `processIdentityPressure()`, `TRAIT_MULTIPLIERS_IMANIAN/NATIVE` |
| `src/simulation/events/definitions/identity.ts` | 6 identity events with integer weights |
| `src/ui/components/IdentityScale.tsx` | Five-zone blend bar UI widget |
| `tests/culture/identity-pressure.test.ts` | 35 tests covering all zones, boundaries, trait multipliers, multi-tribe |

---

## Phase 3.9 — Trait Expansion Notes

### Trait Catalog

- **`TRAIT_DEFINITIONS`** in `src/data/trait-definitions.ts` — authoritative record for all ~80 `TraitId` values
- **6 trait categories**: `personality` · `aptitude` · `cultural` · `earned` · `relationship` · `mental_state`
- **`isTemporary: boolean`** — `mental_state` traits are temporary; expiry stored in `Person.traitExpiry`
- **`inheritWeight?: number`** — consumed by `inheritAptitudeTraits()` at birth; aptitude traits only

### `TraitDefinition` Fields

```typescript
interface TraitDefinition {
  id: TraitId;
  name: string;
  category: 'personality' | 'aptitude' | 'cultural' | 'earned' | 'relationship' | 'mental_state';
  description: string;
  conflicts: TraitId[];
  effects: TraitEffect[];
  isTemporary?: boolean;    // true = mental_state traits; stored in traitExpiry, auto-removed
  inheritWeight?: number;   // 0.0–1.0 probability at birth (aptitude traits only)
}
```

### Temporary Traits & `traitExpiry`

- **`traitExpiry?: Partial<Record<TraitId, number>>`** on `Person` — maps trait ID → turn number on which to remove it
- Default durations: `grieving` 8t · `inspired` 6t · `restless` 12t · `traumatized` 12t · `homesick` 16t · `bereaved` 8t
- `applyTemporaryTraitExpiry(people, currentTurn)` — runs each dawn; returns delta map of changed persons only
- `grantTrait(person, traitId, expiryTurn?, currentTurn?)` — immutable helper; auto-computes expiry from durations when `currentTurn` provided

### Earned Trait Acquisition

`checkEarnedTraitAcquisition(person, settlementHasBuildingId, rng)` — called every 4 turns per living person during `processDawn()`. Priority order:

| Trait | Qualifications | Probability/turn |
|-------|---------------|-----------------|
| `respected_elder` | age ≥ 55, no negative earned traits | 12% |
| `veteran` | combat ≥ 63 + `brave` or `strong` | 8% |
| `healer` | plants ≥ 46 + `healers_hut` built | 10% |
| `negotiator` | bargaining ≥ 63 | 8% |
| `storyteller` | custom ≥ 46 + `folklorist`/`sanguine`/`gregarious` | 6% |

### Aptitude Trait Inheritance

`inheritAptitudeTraits(mother, father, rng)` — called from `processPregnancies()` at birth:
- Iterates `TRAIT_DEFINITIONS` for entries with `inheritWeight > 0`
- One parent holds the trait → roll against `inheritWeight`
- Both parents hold it → roll against `min(inheritWeight × 1.5, 0.95)`
- Returns `TraitId[]` passed as initial `traits` to `createPerson()`

### Event Deck Shaping

`computeTraitCategoryBoosts(people)` — called at end of each dawn; result flows into `drawEvents()` via `weightBoosts` in the store:
- Geometric mean across all persons; normalised by pop size; floor 0.2
- Only categories deviating > 1% from baseline are returned
- Trait-to-category mapping: `event_weight_domestic → domestic`, `event_weight_cultural → cultural`, `event_weight_economic → economic`

### Autonomous Trait Opinion Effects

`applyTraitOpinionEffects(people)` — runs each dawn after skill growth:
- `jealous`: −1/turn toward non-spouse opposite-sex partners in existing relationships
- `envious`: −1/turn toward the wealthiest/most-heroic person
- `suspicious`: −1/turn toward all others
- `trusting`: +1/turn toward all others
- `charming`: +1/turn *from* all others toward this person

### Trait Skill Growth Bonuses

`getTraitSkillGrowthBonuses(person)` — merges into per-person skill delta in step 8.5 of `processDawn()`:

| Trait | Bonus |
|-------|-------|
| `green_thumb` | +2 plants/season |
| `keen_hunter` | +1 combat/season |
| `gifted_speaker` | +1 bargaining, +1 leadership/season |
| `mentor_hearted` | +1 leadership/season |
| `inspired` | +1 all six skills/season |
| `bereaved` / `grieving` | −1 all six skills/season |

### Trait Expansion Key Files

| File | Purpose |
|------|---------|
| `src/data/trait-definitions.ts` | Full ~80-entry catalog; `TEMPORARY_TRAITS`; `APTITUDE_TRAITS` |
| `src/data/trait-affinities.ts` | `TRAIT_CONFLICTS` (21 pairs) · `TRAIT_SHARED_BONUS` (15 entries) |
| `src/simulation/personality/trait-behavior.ts` | `computeTraitCategoryBoosts`, `applyTraitOpinionEffects`, `getTraitSkillGrowthBonuses` |
| `src/simulation/personality/assignment.ts` | `applyTemporaryTraitExpiry`, `checkEarnedTraitAcquisition`, `grantTrait` |
| `src/simulation/genetics/inheritance.ts` | `inheritAptitudeTraits()` |
| `tests/personality/trait-behavior.test.ts` | 15 tests |
| `tests/personality/assignment.test.ts` | 18 tests |
| `tests/genetics/aptitude-inheritance.test.ts` | 6 tests |
| `tests/population/named-relationships.test.ts` | 13 tests |
| `tests/personality/scheme-engine.test.ts` | 63 tests |
| `tests/world/factions.test.ts` | 35 tests |

---

## Phase 4.0 — Character Autonomy Notes

### Named Relationships

- **`NamedRelationshipType`**: `friend | rival | nemesis | confidant | mentor | student`
- **Formation**: `processNamedRelationships()` runs each dawn; checks opinion pairs; a sustained opinion above `FRIEND_OPINION_THRESHOLD = 50` for `FRIEND_SUSTAIN_TURNS = 4` consecutive turns forms a `friend` bond; analogous thresholds apply for rival/nemesis
- **`opinionSustainedSince`**: `Partial<Record<string, number>>` on `Person` — maps `"{personId}"` → turn number when sustained observation began; used for the sustain-turn gate
- **Dissolution**: bonds dissolve if opinion drops below the sustain threshold and stays there
- **Seeding**: `seedFoundingRelationships()` called in `createInitialState` — pre-seeds pairs with high/low opinion as friends/rivals so the game starts with social texture
- **Activity log entries**: `relationship_formed` and `relationship_dissolved` written each dawn as bonds change

### Scheme Engine

- **`PersonScheme`** on `Person`: `{ type: SchemeType; targetId: string; progress: number; startedTurn: number }` or stored as `activeScheme: PersonScheme | null`
- **5 scheme types**: `scheme_court_person` · `scheme_convert_faith` · `scheme_befriend_person` · `scheme_undermine_person` · `scheme_tutor_person`
- **Generation**: `generateScheme(person, people, rng)` runs every `SCHEME_GENERATE_INTERVAL = 12` turns per person (jittered by person index); trait-weighted type selection
  - **Nemesis → undermine** (step 3.5): person with a `nemesis` named relationship generates `scheme_undermine_person` against that nemesis without needing `jealous`/`ambitious` traits
  - **Confidant suppression**: undermine is not generated (or fails the trait-path step 4 guard) against a person marked as `confidant`
  - **Mentor → tutor**: a `mentor` named relationship alone is sufficient to generate `scheme_tutor_person`; `mentor_hearted` trait is no longer required
- **Progress**: `processSchemes()` advances each active scheme by 1 progress/turn; progress rate is scaled by `schemeOpinionFactor(type, person, target)` — positive opinion accelerates social schemes (court/befriend/tutor), hatred accelerates undermine, convert/build are unmodulated
  - `schemeOpinionFactor` formula: `clamp(1.0 + opinion / 200, 0.5, 1.5)` for positive-direction schemes; inverted for `scheme_undermine_person`; flat `1.0` for convert and build
- **Climax events** (all `isDeferredOutcome: true`, fired from turn-processor not the deck):
  - `sch_courtship_discovered` · `sch_faith_advocacy_noticed` · `sch_rumours_spreading` · `sch_undermining_climax` · `sch_tutor_breakthrough`
- **Activity log entries**: `scheme_started`, `scheme_succeeded`, `scheme_failed`

### Faction System

- **`Faction`** on `GameState.factions: Faction[]`
- **6 faction types**: `cultural_preservationists` · `company_loyalists` · `orthodox_faithful` · `wheel_devotees` · `community_elders` · `merchant_bloc`
- **Membership**: `isEligibleMember(person, factionType)` — checks traits, religion, skills, age; `FACTION_MIN_MEMBERS = 3` to form
- **Strength**: `computeFactionStrength(faction, people)` — fraction of pop that are members × alignment coefficient (0–1)
- **Demands**: factions at strength ≥ `DEMAND_STRENGTH_THRESHOLD = 0.45` generate a player-facing event demand each season
- **`processFactions()`**: called each dawn after identity pressure (step 9.6b); returns `FactionResult` with log entries and optional pending events
- **Activity log entries**: `faction_formed`, `faction_dissolved`

### Activity Log

- **`ActivityLogType`** union (11 values): `role_self_assigned | relationship_formed | relationship_dissolved | scheme_started | scheme_succeeded | scheme_failed | faction_formed | faction_dissolved | trait_acquired | ambition_formed | ambition_cleared`
- **`ActivityLogEntry`**: `{ turn: number; type: ActivityLogType; personId?: string; targetId?: string; description: string }`
- **`activityLog: ActivityLogEntry[]`** on `GameState` — capped at 30 entries (oldest dropped first)
- **`addActivityEntry(log, entry)`**: immutable helper; ensures the 30-entry cap is respected
- **Written by**: turn-processor (relationships, schemes, factions), ambition tick (ambition_formed/cleared), store trait logic (trait_acquired), role handling (role_self_assigned)

### Shared-Role Opinion Drift

- **`applySharedRoleOpinionDrift(people)`** in `opinions.ts`: called each dawn after skill growth; persons sharing the same `WorkRole` (excluding `'idle'`) gain +1 opinion of each other per turn — co-workers develop passive positive regard over time

### Community Tab

- **`CommunityView`**: 3-panel layout — left panel: total pop / living bonds summary by type; centre panel: faction list with strength bars and demands; right panel: full `ActivityFeed`
- **`ActivityFeed`**: collapsible 30-entry feed, icon per `ActivityLogType`, person name chips navigate to PersonDetail via the store's `setSelectedPersonId`
- **Navigation**: `{ id: 'community', emoji: '🏛', label: 'Community' }` in `LeftNav`; `case 'community': return <CommunityView />` in `GameScreen`

### Bug Fixes Applied (end of Phase 4.0)

- **Founder trait pool**: `passionate`, `romantic`, `lonely` added to `FOUNDER_TRAIT_POOL` in `game-store.ts` — these traits drive `scheme_court_person` and `scheme_befriend_person` generation; absence meant schemes of these types never started
- **Ambition thresholds**: `seek_spouse` opinion gate 40 → 20; `seek_informal_union` opinion gate 50 → 25 (in `ambitions.ts`) — lowered to be reachable in early game before opinion systems have run many turns
- **Friend threshold**: `FRIEND_OPINION_THRESHOLD` 60 → 50; `FRIEND_SUSTAIN_TURNS` 6 → 4 (in `named-relationships.ts`) — makes the first friendships form in the early turns of a new game
- **Activity log completeness**: `role_self_assigned` and `trait_acquired` entries fully wired into the store's turn handling — were declared but not written before the fix

### Phase 4.0 Key Files

| File | Purpose |
|------|---------|
| `src/simulation/population/named-relationships.ts` | Named relationship formation/dissolution; `processNamedRelationships()`, `seedFoundingRelationships()` |
| `src/simulation/personality/scheme-engine.ts` | `processSchemes()`, `generateScheme()`; 5 scheme types; progress-to-event pipeline; `schemeOpinionFactor()` helper; nemesis/confidant/mentor-rel generation rules |
| `src/simulation/world/factions.ts` | `processFactions()`, `computeFactionStrength()`, `isEligibleMember()`; 6 faction types |
| `src/simulation/events/definitions/schemes.ts` | 5 scheme climax events — all `isDeferredOutcome: true` |
| `src/ui/views/CommunityView.tsx` | 3-panel community view (bonds, factions, activity feed) |
| `src/ui/components/ActivityFeed.tsx` | Rolling 30-entry log with type icons and person-chip navigation |
| `tests/population/named-relationships.test.ts` | 13 tests — formation gates, dissolution, seed logic |
| `tests/personality/scheme-engine.test.ts` | 74 tests — scheme generation, progress, climax event firing, nemesis/confidant/mentor paths, opinion-scaled rates |
| `tests/world/factions.test.ts` | 35 tests — eligibility, strength formula, demand threshold |

---

## Phase 4.1 — Happiness System Notes

- **4 factor categories**: `material` (food, overcrowding, shelter) · `social` (named relationships, religion, opinion climate) · `purpose` (work role fit) · `trait` (personality modifiers)
- **Score range**: −100 to +100; labelled Thriving (≥60) → Content → Settled → Restless → Discontent → Miserable → Desperate (<−60)
- **`lowHappinessTurns`** on `Person` — streak counter incremented when score < −50; reset to 0 otherwise; persists in save file
- **`isDesertionEligible(person)`**: returns true when `lowHappinessTurns ≥ 3`; used by desertion events
- **`getDepartingFamily(primaryId, people)`**: spouses depart if their own `lowHappinessTurns ≥ 1` OR `effectiveOpinion(primaryId) ≥ 25`; children under 16 always follow
- **`applyHappinessTracking(people, state)`**: full tracking pass each dawn — returns `{ updatedPeople, settlementMorale, desertionCandidateIds, happinessMultipliers, newLowMoraleTurns, happinessScores }`
  - **`happinessScores: Map<string, number>`** in `HappinessTrackingResult` — per-person score snapshot passed to `processCulturalDrift` each dawn to modulate drift rate
- **`happinessMultipliers`**: production-role multipliers (Thriving ×1.15, Content ×1.07, Settled ×1.00, Restless ×0.95, Discontent ×0.88, Miserable ×0.78, Desperate ×0.65); guards/away/keth_thara always ×1.0
- **`lowMoraleTurns`** and **`lastSettlementMorale`** on `GameState` — track morale trend; `lowMoraleTurns` increments when settlement morale < −20, resets otherwise
- **Devout amplification**: when `devout` trait + religion suppression factor present, adds `Math.floor(suppressionDelta × 0.5)` further penalty
- **Pure TS**: no RNG, no React — all functions are deterministic given the same inputs
- **PersonDetail happiness UI**: score + label shown as compact chip; factor breakdown (sorted by |delta|, `+N`/`−N` prefixed) visible on hover via native `title` tooltip with `cursor-help`; crisis warning (`⚠ Nt at crisis`) shown inline when `lowHappinessTurns > 0`

### Happiness Key Files

| File | Purpose |
|------|--------|
| `src/simulation/population/happiness.ts` | All happiness functions; `HappinessFactor`, `HappinessTrackingResult` types |
| `src/simulation/events/definitions/happiness.ts` | 4 crisis events: `hap_settler_considers_leaving`, `hap_low_morale_warning`, `hap_desertion_imminent`, `hap_company_happiness_inquiry`; all injected programmatically |
| `src/simulation/population/apprenticeship.ts` | `TRAINABLE_TRADES`, `MAX_TRADE_TRAINING`, `getTradeSkill()`, `getMasterProgressRate()`, `computeCompletionBonus()`, `processApprenticeships()` — pure TS, no React, seeded RNG only |
| `src/simulation/events/definitions/apprenticeship.ts` | 2 events: `appr_trade_training_begins` + `appr_trade_mastered`; both `isDeferredOutcome: true`, injected programmatically by the store |
| `tests/population/happiness.test.ts` | 99 tests — all factor categories, edge cases, desertion gate, family departure |

---

## Phase 4.2 — Housing & Specialisation Notes

### Dwelling Tiers

- **4 private dwelling tiers** (`DWELLING_IDS`): `wattle_hut` · `cottage` · `homestead` · `compound`
- Each tier provides shelter capacity for a household; higher tiers hold more members
- **`applyDwellingClaims(completedBuildings, allBuildings, households, people)`** — 3-pass fairness algorithm called each dawn by the store after construction completes:
  - **Pass 1 (scheme-owned)**: if a completed building already has `ownerHouseholdId` set (purchased via scheme), link it directly to that household
  - **Pass 2 (player-built / unowned)**: assign the first homeless household; priority given to largest households
  - **Pass 3 (propagation)**: set `person.claimedBuildingId` for every household member; clear stale refs to demolished buildings
- Exported from `construction.ts` alongside `DWELLING_IDS` set and `findAvailableWorkerSlotIndex`

### Worker Slot Caps

- **`workerSlots?: number`** on `BuildingDef` — limits how many settlers may staff that building in the given role
- **`workerRole?: WorkRole`** — ties the slot cap to a specific `WorkRole`; buildings without this field have no slot enforcement
- **`findAvailableWorkerSlotIndex(buildings, role)`** — returns the index of the first building that still has an open slot for `role`; returns `−1` if all slots are full; used by `assignRole` in the store to gate new role assignments
- Slot caps per production building: `stable` 2 herders · `mill` 2 millers · `smithy` 2 blacksmiths · `tannery` 2 tailors · `brewery` 2 brewers

### Specialisation Roles (Phase 4.2)

5 new `WorkRole` values linking settlers to their matching buildings:

| Role | Building | Resource/effect |
|------|----------|-----------------|
| `blacksmith` | `smithy` | goods production (steel conversion) |
| `tailor` | `tannery` | goods production (leather/cloth) |
| `brewer` | `brewery` | goods production (brewed goods) |
| `miller` | `mill` | goods production (milled grain) |
| `herder` | `stable` | cattle yield bonus |

### `person.claimedBuildingId`

- **`claimedBuildingId?: string`** on `Person` — the `instanceId` of the dwelling this person's household claims
- Set by `applyDwellingClaims` Pass 3; cleared when the building is demolished
- Serialised as a plain string — no Map handling needed
- Old saves default to `undefined` gracefully

### Founding Settlers

- **Founding settlers** now start with `gather_food` (Forager) role, not `farmer`
- No Tilled Fields exist at game start, so assigning farmers would produce nothing useful; foragers get the same gather logic from day 1
- `FOUNDER_ROLES` constant in `game-store.ts` uses `gather_food`; `seedCouncil()` selects oldest foragers

### Key Files (Phase 4.2)

| File | Purpose |
|------|---------|
| `src/simulation/buildings/construction.ts` | `applyDwellingClaims`, `findAvailableWorkerSlotIndex`, `DWELLING_IDS` |
| `src/simulation/buildings/building-definitions.ts` | `workerSlots` / `workerRole` on the 5 new specialisation buildings + 4 dwelling tiers |
| `tests/buildings/dwelling-claims.test.ts` | 15 tests — Pass 1/2/3, `findAvailableWorkerSlotIndex` slot cap, old-save `undefined` guard |

---

## Misc — Apprenticeship System Notes

- **`TRAINABLE_TRADES`** (12 roles): `farmer` · `gather_food` · `gather_stone` · `gather_lumber` · `blacksmith` · `tailor` · `brewer` · `miller` · `herder` · `healer` · `trader` · `craftsman`
- **`MAX_TRADE_TRAINING = 30`** — per-role production bonus cap (%)
- **Master eligibility**: age ≥ 16 · `WorkRole` ∈ `TRAINABLE_TRADES` · trade skill ≥ 26 (Good) · one active apprentice at a time
- **Apprentice pool**: own children (age 10–20) take priority; named `student` relationships are the fallback
- **Formation interval**: `APPRENTICESHIP_CHECK_INTERVAL = 8` turns; scan runs at dawn step 8.94
- **Progress rate**: `getMasterProgressRate(master)` → base 0.04/turn × skill-tier multiplier (1.0/1.25/1.50/1.75 for Good/Excellent/Renowned/Heroic) × 1.25 if `mentor_hearted`
- **Completion bonus**: `computeCompletionBonus(master)` → 5/8/12/17/22/27% (Fair → Heroic); capped at `MAX_TRADE_TRAINING` per role on graduation
- **`person.apprenticeship`**: `{ masterId, trade: WorkRole, progress: number, startedTurn: number } | null` — active training state
- **`person.tradeTraining`**: `Partial<Record<WorkRole, number>>` — completed bonuses, persisted for life; applied in `calculateProduction()` as `tradeMult = 1 + bonus / 100`
- **Phase A cleanup** (each dawn): ends stale apprenticeships — master gone, master changed role, apprentice age > 22
- **Phase B progress** (each dawn): advances progress; graduates at 1.0 with `appr_trade_mastered` event + `apprenticeship_completed` log entry
- **Phase C formation** (every 8 turns): scans for eligible pairs; fires `appr_trade_training_begins` event + `apprenticeship_started` log entry
- **Serialisation**: both fields are plain JSON — no Map handling; `deserializePerson` provides `?? null` / `?? {}` fallbacks for old saves
- **`ActivityLogType`** extended with `'apprenticeship_started'` · `'apprenticeship_completed'` · `'apprenticeship_ended'`

### Apprenticeship Key Files

| File | Purpose |
|------|---------|
| `src/simulation/population/apprenticeship.ts` | `TRAINABLE_TRADES`, `MAX_TRADE_TRAINING`, `getTradeSkill()`, `getMasterProgressRate()`, `computeCompletionBonus()`, `processApprenticeships()` |
| `src/simulation/events/definitions/apprenticeship.ts` | 2 events: `appr_trade_training_begins` + `appr_trade_mastered`; `isDeferredOutcome: true`, injected programmatically |
| `tests/population/apprenticeship.test.ts` | 45 tests — `getTradeSkill` all roles, rate/bonus tiers, Phase A/B/C coverage |

---

## Misc — Genetics Variation & Trait Expansion Notes

### Bloodline Variation (added March 2026)

`averageBloodlines(motherBloodline, fatherBloodline, rng?)` — when `rng` is provided (every real birth via `resolveInheritance`), samples `maternalWeight = Gaussian(0.5, σ=0.015)` clamped to `[0.44, 0.56]`:
- ~68% of children: 48.5–51.5% from each parent
- ~95% of children: 47–53% (the ±3% biological variation)
- Without `rng`: exactly 50/50 (unit tests, legacy call-sites)

### 6 New TraitId Values

Added to `TraitId` union (`src/simulation/personality/traits.ts`) in the personality section:

| TraitId | Name | Key effect |
|---------|------|------------|
| `optimistic` | Optimistic | Resilient; happiness +10 |
| `hot_tempered` | Hot-Tempered | `event_weight_domestic` +1.3; happiness −5 |
| `cowardly` | Cowardly | `combat_strength` −0.10; happiness −5 |
| `romantic` | Romantic | `opinion_drift_spouse` +2; happiness ±15 depending on spouse |
| `lonely` | Lonely | Happiness ±20 depending on named relationships |
| `solitary` | Solitary | Conflicts `gregarious`; happiness ±10 depending on overcrowding |

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
- `tests/events/event-filter.test.ts` — 78/78 passing (includes `weightBoosts` multiplier, no-boost no-op, unknown boost key, ambient cooldown floor)
- `tests/events/resolver.test.ts` — 46/46 passing
- `tests/events/event-queue.test.ts` — 9/9 passing (nextEvent transitions, follow-up insertion, resolveEventChoice/pendingEvents isolation, **3 new: away role restoration via startTurn**)
- `tests/events/council-advice.test.ts` — 95/95 passing (archetype mapping, choice scoring, hash determinism, advice generation, template coverage)
- `tests/events/actor-resolver.test.ts` — 45/45 passing (matchesCriteria per-field, canFillSlot, canResolveActors mutual exclusion, selectActor RNG determinism, resolveActors multi-slot exclusion + optional slots, **away role exclusion**, `sauromatianHeritage` criterion)
- `tests/events/interpolation.test.ts` — 25/25 passing (all `{slot.*}` token variants, both sexes, capitalised pronouns, unknown slot/suffix passthrough, multi-slot strings)
- `tests/economy/resources.test.ts` — 46/46 passing (farmers without/with Fields, traders, cattle, seasonal mods, gather_food/stone/lumber skill tiers, guard=0)
- `tests/economy/company.test.ts` — 35/35 passing (quota formula, escalation, request availability, support delivery)
- `tests/economy/trade.test.ts` — 28/28 passing (price calculation, fairness, disposition deltas, Trading Post bonuses)
- `tests/economy/spoilage.test.ts` — 18/18 passing (per-resource rates, season modifiers, building mitigation)
- `tests/economy/crafting.test.ts` — 32/32 passing (recipe availability gating, apply/validate logic)
- `tests/population/demographics.test.ts` — 16/16 passing (includes 4 child-culture blending tests)
- `tests/population/marriage.test.ts` — 20/20 passing
- `tests/population/household.test.ts` — 29/29 passing (createHousehold, addTo/removeFrom, getSeniorWife, countWives/Concubines, dissolveHousehold, getHouseholdMembers, getHouseholdByPerson)
- `tests/population/culture.test.ts` — 21/21 passing (deriveCulture, processCulturalDrift, buildSettlementCultureDistribution, computeCulturalBlend)
- `tests/culture/language-acquisition.test.ts` — 34/34 passing
- `tests/population/skills.test.ts` — 36/36 passing (getSkillRating, getDerivedSkill, generatePersonSkills, createPerson integration)
- `tests/buildings/construction.test.ts` — 19/19 passing (canBuild, startConstruction, assignBuilder/removeBuilder, processConstruction, cancelConstruction)
- `tests/buildings/building-effects.test.ts` — 23/23 passing (shelterCapacity, productionBonus, childMortalityModifier, overcrowding, hasBuilding, etc.)
- `tests/population/opinions.test.ts` — 64/64 passing (getOpinion, setOpinion, adjustOpinion, computeTraitOpinion, computeBaselineOpinion, initializeBaselineOpinions, applyOpinionDrift, decayOpinions, marriage floor, **addOpinionModifier, getEffectiveOpinion, getModifierSummary, decayOpinionModifiers, computeOpinionBreakdown with modifiers**, **applySharedRoleOpinionDrift**)
- `tests/population/ambitions.test.ts` — 30/30 passing (tickAmbitionIntensity, evaluateAmbition, determineAmbitionType, generateAmbition, clearAmbition, label/intensity helpers, AMBITION_FIRING_THRESHOLD)
- `tests/culture/religion.test.ts` — 19/19 passing (`computeReligiousTension` variants, `computeCompanyReligiousPressure` variants + policy modifiers, `computeHiddenWheelDivergence` variants including 20-turn emergence and suppression)
- `tests/culture/identity-pressure.test.ts` — 35/35 passing (counter increment/reset per zone, company standing delta all 5 zones, boundary values, safe-zone produces no tribe deltas, single-trait and multi-trait tribe deltas, multiple tribes independent deltas)
- `tests/personality/trait-behavior.test.ts` — 15/15 passing (`computeTraitCategoryBoosts` normalisation, `applyTraitOpinionEffects` per-trait deltas, `getTraitSkillGrowthBonuses` all modifiers)
- `tests/personality/assignment.test.ts` — 18/18 passing (`applyTemporaryTraitExpiry` expiry/retention logic, `checkEarnedTraitAcquisition` all 5 pathways, `grantTrait` with/without expiry)
- `tests/genetics/aptitude-inheritance.test.ts` — 6/6 passing (`inheritAptitudeTraits` no-parents baseline, single-parent probability, both-parents boosted probability, determinism, personality-traits excluded)
- `tests/turn/dusk.test.ts` — 19/19 passing
- `tests/world/tribes.test.ts` — (existing suite)
- `tests/store/serialization.test.ts` — serialization round-trip tests (namedRelationships, activeScheme, opinionSustainedSince, factions, activityLog)
- `tests/population/named-relationships.test.ts` — 13/13 passing (formation gates, dissolution, seed logic, sustain-turn gating)
- `tests/personality/scheme-engine.test.ts` — 63/63 passing (scheme generation, trait weighting, progress ticking, climax event firing, SCHEME_GENERATE_INTERVAL)
- `tests/world/factions.test.ts` — 35/35 passing (eligibility by type, strength formula, DEMAND_STRENGTH_THRESHOLD, formation/dissolution)
- `tests/population/happiness.test.ts` — 99/99 passing (all factor categories, material/social/purpose/trait, devout amplification, desertion gate, family departure, settlement morale)
- `tests/buildings/dwelling-claims.test.ts` — 15/15 passing (`applyDwellingClaims` Pass 1 scheme-owned, Pass 2 player-built/homeless priority, Pass 3 `person.claimedBuildingId` propagation, demolition cleanup, old dwelling freed on scheme upgrade)
- `tests/population/apprenticeship.test.ts` — 45/45 passing (`getTradeSkill` all roles, `getMasterProgressRate` tier multipliers + `mentor_hearted`, `computeCompletionBonus` all tiers, `TRAINABLE_TRADES` membership, Phase A/B/C of `processApprenticeships`)
- **Total: 1395/1395 passing across 40 test files**

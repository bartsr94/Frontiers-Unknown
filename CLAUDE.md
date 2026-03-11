# Palusteria: Children of the Ashmark — Developer Context

This file is the first thing a new Copilot session should read.
It captures the current implementation state, hard rules, and Phase 2 priorities.

---

## Current Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1 — Foundation | ✅ Complete | 13/13 steps done, 13/13 tests pass, zero compile errors |
| Phase 2 — Genetics Engine | ✅ Complete | All 12 steps done, 139/139 tests pass, zero compile errors |
| Phase 3 — Living Settlement | � In Progress | Language acquisition engine complete (173/173 tests) |
| Phase 4 — Polish | 🔲 Not started | — |

---

## Running the Project

```bash
npm run dev          # Vite dev server → http://localhost:5173
npm test             # Run Vitest (173 passing across rng, inheritance, gender-ratio, fertility, event-filter, demographics, language-acquisition)
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
| `src/simulation/events/event-filter.ts` | `ALL_EVENTS`, `filterEligibleEvents()`, `drawEvents()` |
| `src/simulation/events/resolver.ts` | `applyEventChoice()` — applies consequences to `GameState` |
| `src/simulation/events/definitions/` | 28 events: company, diplomacy, domestic, economic, environmental + 18 cultural |
| `src/simulation/economy/resources.ts` | Production/consumption math with seasonal modifiers |
| `src/simulation/genetics/traits.ts` | Trait type definitions + `IMANIAN_TRAITS` constant |
| `src/data/ethnic-distributions.ts` | All 8 ethnic group `TraitDistribution` constants + `ETHNIC_DISTRIBUTIONS` lookup map |
| `src/simulation/culture/language-acquisition.ts` | `resolveChildLanguages`, `applyLanguageDrift`, `updateSettlementLanguages`, `updateLanguageTension`, `updateLanguageDiversityTurns` |
| `src/simulation/genetics/gender-ratio.ts` | `getSauromatianFraction`, `getImanianFraction`, `resolveGenderRatio`, `determineSex` |
| `src/simulation/genetics/inheritance.ts` | `resolveInheritance()` pipeline: `averageBloodlines`, `blendTraitDistributions`, `sampleContinuous`, `sampleDiscrete` |
| `src/simulation/genetics/fertility.ts` | `BirthResult`, `createFertilityProfile`, `getFertilityChance`, `attemptConception`, `processPregnancies` |
| `src/simulation/population/person.ts` | `Person` interface + `createPerson()` factory; heritage/bloodline types |
| `src/simulation/population/naming.ts` | `generateName(sex, culture, motherFamilyName, fatherFamilyName, rng)` — 3 culture pools |
| `src/simulation/population/marriage.ts` | `canMarry`, `performMarriage`, `getMarriageability` — Sauromatian/Imanian rules |
| `src/simulation/world/tribes.ts` | `createTribe`, `TRIBE_PRESETS` (16 presets), `updateTribeDisposition` |
| `src/stores/game-store.ts` | Zustand store — full turn lifecycle, council, `arrangeMarriage`, tribe init |
| `src/ui/layout/LeftNav.tsx` | Left nav with phase-aware End Turn / Confirm Turn button |
| `src/ui/layout/BottomBar.tsx` | Full-width resource strip (food, cattle, goods, gold, lumber, stone, pop) |
| `src/ui/layout/CouncilFooter.tsx` | 7-seat Expedition Council row |
| `src/ui/views/EventView.tsx` | Event card with choices; calls `resolveEventChoice` + `nextEvent` |
| `src/ui/views/PeopleView.tsx` | Settler roster; sort/filter (sex, status, heritage group); click row → PersonDetail panel |
| `src/ui/views/PersonDetail.tsx` | Full person detail: genetics, heritage, family links, fertility |
| `src/ui/views/FamilyTree.tsx` | 3-generation ancestor/descendant tree; spouses shown to the side of root node |
| `src/ui/components/Portrait.tsx` | Text-based portrait; skin tone HSL colouring; `sm`/`lg` variants |
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

- `tests/utils/rng.test.ts` — 13/13 passing (deterministic output, Gaussian distribution, nextInt bounds)
- `tests/genetics/inheritance.test.ts` — 10/10 passing (bloodline averaging, trait blending, 70/30 blend ratio, extendedFertility maternal chain)
- `tests/genetics/gender-ratio.test.ts` — 26/26 passing (fraction helpers, resolveGenderRatio formula, determineSex probability, lore rules)
- `tests/genetics/fertility.test.ts` — 31/31 passing (profile shapes, fertility window, seasonal/condition modifiers, pure function contract, childbirth risk)
- `tests/events/event-filter.test.ts` — 47/47 passing (all prerequisite types, isUnique, cooldown, filterEligibleEvents, drawEvents, ALL_EVENTS deck integrity)
- `tests/events/resolver.test.ts` — 14/14 passing (modify_resource, modify_standing, clamping, cooldown recording, event history, multi-consequence)
- `tests/economy/resources.test.ts` — 24/24 passing (emptyResourceStock, addResourceStocks, clampResourceStock, calculateProduction with seasons, calculateConsumption)
- `tests/population/demographics.test.ts` — 12/12 passing (marriage → conception → birth pipeline; child parentIds/childrenIds; pregnancy cleared after birth)
- `tests/population/marriage.test.ts` — 12/12 passing (getLanguageCompatibility: shared/partial/none, Tradetalk, creole, asymmetric cases)
- `tests/culture/language-acquisition.test.ts` — 34/34 passing (learning rates, child language resolution, language drift, settlement language fractions, tension formula, diversity turn counter)
- **Total: 223/223 passing**

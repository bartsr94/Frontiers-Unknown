# Private Economy — Design Document

**Version:** 1.0  
**Status:** Ready for Implementation  
**Prerequisite:** Phase 4.2 (Housing & Specialisation) must be complete ✅

---

## 1. Overview

Every character in Palusteria belongs to a household (even singles — `initializeHouseholds` seeds a solo household for each founding settler). Households now have a **private treasury** (`householdGold`) that accumulates over time through annual payroll disbursements.

The player controls how much of each communal resource is held in reserve — surplus above those floors is available for households to purchase building materials. When a household has saved enough gold AND the required materials are available as surplus, it autonomously commissions a build. No player approval needed; the "consent" is in the reserve floors you set.

Characters develop `seek_better_housing` and `seek_production_building` ambitions that make their desires visible before the gold is saved — the player can watch a household work toward a goal and see it fulfilled.

---

## 2. Design Goals

| Goal | Mechanism |
|------|-----------|
| Create economic incentive to produce goods (not just food) | Goods export to Company at 4:1 ratio |
| Give settlers economic agency without micro-management | Silent autonomous purchasing |
| Make reserve floors genuinely meaningful | Surplus = stock − floor; purchases blocked if surplus < 0 |
| Surface household desires visibly | `seek_better_housing` + `seek_production_building` ambitions |
| Reward skilled specialists with faster household growth | Wages proportional to employed members; skilled workers are productive workers |
| Make marriage socially and economically significant | Household golds combine on merge |

---

## 3. Data Model Changes

### 3.1 `Household` — `game-state.ts`

```ts
export interface Household {
  // ... existing fields ...

  /**
   * Private household treasury. Accumulated from annual wage disbursements.
   * Spent autonomously on private construction when an ambition is active.
   * Combines into the surviving household on marriage merge.
   * Old saves: defaults to 0.
   */
  householdGold: number;
}
```

**Serialisation:** plain `number` — no Map handling. `deserializeHousehold`: `householdGold: data.householdGold ?? 0`.

**Merge:** `mergeHouseholds(survivingId, dissolvedId, ...)` must add `dissolvedHousehold.householdGold` to `survivingHousehold.householdGold`.

### 3.2 `Settlement` — `game-state.ts`

```ts
export interface Settlement {
  // ... existing fields ...

  /**
   * Per-resource reserve floors. Surplus = max(0, resources[r] − economyReserves[r]).
   * Household purchases are blocked if the required material is not available as surplus.
   * Defaults to all-zero (no reserves, all surplus) if omitted.
   * Old saves: defaults to {}.
   */
  economyReserves: Partial<ResourceStock>;
}
```

**Serialisation:** plain object — no Map handling. `deserializeGameState`: `economyReserves: data.settlement?.economyReserves ?? {}`.

### 3.3 `BuildingDef` — `building-definitions.ts`

```ts
export interface BuildingDef {
  // ... existing fields ...

  /**
   * Gold cost a household pays to privately commission this building.
   * Materials (def.cost) are drawn from communal surplus.
   * Undefined = not privately buildable (communal-only buildings).
   */
  privateGoldCost?: number;
}
```

**New values for all `ownership === 'household'` buildings:**

| BuildingId | Existing material cost | `privateGoldCost` |
|------------|----------------------|-------------------|
| `wattle_hut` | 3 lumber | 1 |
| `cottage` | 8 lumber, 4 stone | 3 |
| `homestead` | 15 lumber, 8 stone | 6 |
| `compound` | 25 lumber, 15 stone, 5 gold | 12 |
| `fields` | 5 lumber | 2 |
| `mill` | 12 lumber, 10 stone | 5 |
| `stable` | 10 lumber, 3 horses | 4 |
| `smithy` | lumber, stone | 5 |
| `tannery` | lumber, stone | 4 |
| `brewery` | lumber, stone | 4 |

> **Pacing note:** With 8 employed adults in year 1 the company sends 8 gold in wages. A wattle_hut costs 1 gold → the first household upgrade can happen in year 1 if reserves allow. A compound at 12 gold is a multi-year project, appropriate for a late-game aspiration.

---

## 4. Company Income Rework

### 4.1 Spring Delivery Update (Years 1–10)

`getCompanySupplyDelivery` in `economy/company.ts` is extended. Each Spring **while `currentYear <= 10`**:

| Income stream | Formula | Destination |
|---------------|---------|-------------|
| **Settlement base allowance** | Fixed **10 gold** | `settlement.resources.gold` |
| **Worker payroll** | **1 gold per employed adult** | Distributed to `household.householdGold` (see §5) |
| *(existing goods/food/settlers)* | Unchanged | Unchanged |

**After year 10 the Company stops all gold transfers.** The base allowance and payroll line do not appear in the delivery. The existing goods/food/settler support continues unchanged (it is non-monetary aid, not a financial subsidy).

"Employed adult" = any `Person` where:
- `age >= 16`
- `role !== 'unassigned'`
- `role !== 'away'`
- `role !== 'keth_thara'`
- `socialStatus !== 'thrall'`

In years 1–10 the payroll gold never touches `settlement.resources.gold` — it goes directly to household treasuries in the same turn step. In year 11+ no payroll gold appears at all from the company; it must come from `settlement.resources.gold` via `distributeHouseholdWages` (see §5.3).

### 4.2 Transition Warning Event

In Spring of **year 10** (the last year of company support), the store injects a deferred event `eco_company_funding_ends` into the pending queue:

> *"The Ansberite Company's field accounts have been reviewed. Beginning next year, the settlement is expected to be self-sustaining. Quarterly stipends will no longer be issued. The Company wishes you continued success."*

This event has no choices — it is a pure notification (`choices: []` or a single dismiss). It fires once only, gated by `currentYear === 10 && currentSeason === 'spring'`.

### 4.3 Goods Export (new store action)

```ts
exportGoodsToCompany(amount: number): void
```

- Rate: **4 goods → 1 gold** (integer division, remainder goods returned)
- Debits `settlement.resources.goods` by `amount`
- Credits `settlement.resources.gold` by `Math.floor(amount / 4)`
- Company standing: +1 per **10 goods** exported in total per year (tracked in `CompanyRelation.exportedGoodsThisYear`, reset each Spring)
- Blocked in non-management phase, blocked if goods < 4

This action sits in the Economy tab (see §9). It is the primary lever for household wealth in all years, and the **only** lever after year 10 — a brewer, blacksmith, or tailor generating goods is directly funding household wages and upgrades.

---

## 5. Wage Distribution

### 5.1 `distributeHouseholdWages(state): WageResult`

New pure function in `src/simulation/economy/private-economy.ts`.

```ts
export interface WageResult {
  /** Delta per household id → gold to add */
  householdDeltas: Map<string, number>;
  /** Total gold disbursed (for activity log / debug) */
  totalDisbursed: number;
  /** Gold actually deducted from settlement resources (0 in years 1–10) */
  settlementGoldSpent: number;
  /** True if the settlement could not cover the full payroll */
  payrollShortfall: boolean;
}

export function distributeHouseholdWages(state: GameState): WageResult
```

**Algorithm:**

1. Collect all employed adults (criteria from §4.1)
2. Compute `totalWage = count of employed adults × 1 gold`
3. **Years 1–10:** Company-funded path — gold does not come from `settlement.resources`; `settlementGoldSpent = 0`
4. **Year 11+:** Self-funded path:
   a. `available = settlement.resources.gold`
   b. If `available >= totalWage` → pay in full; deduct `totalWage` from settlement gold
   c. If `available < totalWage` → **pro-rata shortfall**: each household receives `floor(theirWage × available / totalWage)` gold; deduct the actual amount spent; `payrollShortfall = true`
5. Group by `person.householdId` and allocate accordingly
6. Households with no employed adults receive 0

This is intentionally simple. In the company years households accumulate freely. After year 10 the player must maintain enough gold (via goods export or tribe trade) to sustain the payroll.

### 5.2 Payroll Shortfall Effects

When `payrollShortfall = true`, the turn processor applies a happiness penalty to all employed adults: **`−5` to the `purpose` happiness factor** that turn (abstracted as "unpaid wages demoralise workers"). This stacks with any existing food/shelter stress, making payroll failure genuinely painful without being instantly catastrophic.

The Economy tab shows a **red "Payroll shortfall!" warning** when `lastPayrollShortfall` (a new `GameState` bool) is true, with a line showing how many gold was short.

### 5.3 Timing

Runs in `processDawn()` each **Spring**, immediately after the Company supply delivery step.
- In years 1–10: company delivery already added payroll gold to household treasuries; `distributeHouseholdWages` in self-funded mode returns zero deltas (skipped or called conditionally).
- In year 11+: `distributeHouseholdWages` draws from `settlement.resources.gold` each Spring.

### 5.4 Merge Handling

`mergeHouseholds(survivingId, dissolvedId, households, people)` in `household.ts`:
```ts
survivingHousehold.householdGold += dissolvedHousehold.householdGold;
```
Dissolved household gold is never lost.

---

## 6. Reserve Floors & Surplus

### 6.1 `getSurplus(resources, reserves): Partial<ResourceStock>`

New helper in `private-economy.ts`:

```ts
export function getSurplus(
  resources: ResourceStock,
  reserves: Partial<ResourceStock>,
): Partial<ResourceStock>
```

Returns `max(0, resources[r] - (reserves[r] ?? 0))` for every resource type.

### 6.2 Surplus semantics

A household purchase requires, for each material `r` in `def.cost`:

```
getSurplus(settlement.resources, settlement.economyReserves)[r] >= def.cost[r]
```

If any required material is below its reserve floor, the purchase is blocked that turn and retried next turn. The household's gold is **not** deducted until the full purchase succeeds.

---

## 7. Autonomous Private Building

### 7.1 `processPrivateBuilding(state, rng): PrivateBuildResult`

New function in `private-economy.ts`. Runs in `processDawn()` at step 9.7 (after factions, before end of dawn).

```ts
export interface PrivateBuildResult {
  /** Updated households (gold deducted) */
  updatedHouseholds: Map<string, Household>;
  /** Updated settlement resources (materials deducted) */
  updatedResources: ResourceStock;
  /** New construction projects to append */
  newProjects: ConstructionProject[];
  /** Activity log entries */
  logEntries: ActivityLogEntry[];
}
```

**Per-household algorithm:**

1. Skip if household has no ambition of type `seek_better_housing` or `seek_production_building` on its head or senior wife
2. Determine **desired build** from ambition type:
   - `seek_better_housing` → next dwelling tier above current (see §7.2)
   - `seek_production_building` → building matching the specialist role (see §7.3)
3. Look up `def = BUILDING_CATALOG[desiredBuildId]`
4. Check gold: `household.householdGold < def.privateGoldCost` → skip
5. Check all materials in `def.cost` against surplus → skip if any short
6. **Purchase:**
   - Deduct `def.privateGoldCost` from `household.householdGold`
   - Deduct each material in `def.cost` from `settlement.resources`
   - Create a `ConstructionProject` with `ownerHouseholdId = household.id`
   - Log `'private_build_started'` activity entry
7. A household performs **at most one purchase per dawn pass**

### 7.2 Resolving the Target Dwelling Tier

```
currentTier = tier of the dwelling-category building in household.buildingSlots
           (slot 0 preferred, else first dwelling found, else 0 if none)
targetChain = 'dwelling'
desiredBuildId = first building in BUILDING_CATALOG where
                  upgradeChainId === 'dwelling' AND tierInChain === currentTier + 1
```

If `currentTier + 1` doesn't exist (already at compound = tier 4) → no `seek_better_housing` ambition should have been generated (evaluation returns `'fulfilled'`).

### 7.3 Resolving the Target Production Building

```
ROLE_TO_BUILDING: Record<WorkRole, BuildingId> = {
  farmer:     'fields',
  blacksmith: 'smithy',
  brewer:     'brewery',
  tailor:     'tannery',
  miller:     'mill',
  herder:     'stable',
}

desiredBuildId = ROLE_TO_BUILDING[specialistRoleInHousehold]
```

"Specialist role in household" = the first member whose `role` is a key in `ROLE_TO_BUILDING` AND whose matching building does not already appear in `household.buildingSlots`.

---

## 8. New Ambitions

Add to `AmbitionId` union in `person.ts`:

```ts
| 'seek_better_housing'      // Household wants a higher-tier dwelling
| 'seek_production_building' // Household has a specialist but no matching building
```

Both are generated on the **household head** (falls back to senior wife if `headId === null`).

### 8.1 `seek_better_housing`

**Generation conditions** (any one):
- Household has no dwelling in `buildingSlots` (no building with `category === 'dwelling'`)
- Current dwelling tier < 2 AND `memberIds.length >= 3`
- Current dwelling tier < 3 AND `memberIds.length >= 6`
- Any dwelling in slots is full (members > `shelterCapacity`)

**Desired state:** next tier in dwelling chain is built and in `buildingSlots`.

**Evaluation:**
- `'fulfilled'` — current dwelling tier > previous tier (improved)
- `'failed'` — household dissolved; person no longer has this role
- `'ongoing'` — otherwise

**Label:** `"Wants a better home"` / `"Needs more space for the family"` (based on trigger)

### 8.2 `seek_production_building`

**Generation conditions:**
- Any household member has a specialist role in `ROLE_TO_BUILDING`
- The matching building is not present in any slot of `buildingSlots`

**Desired state:** matching building exists in `buildingSlots`.

**Evaluation:**
- `'fulfilled'` — matching building found in slots
- `'failed'` — specialist member changes role OR leaves household
- `'ongoing'` — otherwise

**Label:** `"Wants to build a [building name]"`

### 8.3 Ambition behaviour notes

- Both ambitions follow standard intensity ticking (+0.05/turn, cap 1.0)
- **No intensity gate on purchasing** — the ambition just signals intent. The simulation purchases as soon as funds + materials allow, regardless of intensity. Intensity still builds, making the desire visible in PersonDetail over time.
- Both appear in the PersonDetail ambition badge with the same colour-coded intensity system
- Both are suppressed if `role === 'away'` or `socialStatus === 'thrall'`
- Only one ambition at a time (standard rule) — `seek_better_housing` takes priority over `seek_production_building` in generation order

---

## 9. Economy Tab

`ProductionView.tsx` is replaced by `EconomyView.tsx`. The nav item label changes from `"Production"` to `"Economy"` (nav id remains `'production'` to minimise file changes).

### Layout

```
ECONOMY
───────────────────────────────────────────────────────────────────
RESOURCE RESERVES                    COMPANY EXPORT
Keep at least:                       Sell surplus goods to the Company
  Food       [____] 30               [  20  ▲▼] goods  →  5 gold
  Lumber     [____] 20               [Export]
  Stone      [____] 10               Rate: 4 goods : 1 gold
  Goods      [____] 15               Standing bonus: +1 per 10 goods
  Gold       [____]  5               Exported this year: 40 goods
  Cattle     [____]  0               
  Medicine   [____]  0               
  Steel      [____]  0               
  Horses     [____]  0

Surplus available to settlers:
  Lumber: 8 · Stone: 5 · Goods: 22 · Gold: 3
───────────────────────────────────────────────────────────────────
CRAFTING
[existing CraftingPanel, unchanged]
```

**Surplus line** updates live as reserve inputs change (derived state, no store write until confirmed or on-blur).

**Export panel:**
- Quantity input with ▲▼ steppers (min 4, steps of 4)
- "Export" button disabled if `goods < 4` or phase is not management
- Preview shows gold yield and standing change

### Household gold display

`HouseholdCard` (Settlement tab) shows `householdGold` as a small amber pill: `⚜ 3g` in the card footer alongside member/building counts.

---

## 10. Activity Log Extension

New `ActivityLogType` values:

```ts
| 'private_build_started'   // Household autonomously commissioned a building
| 'private_build_funded'    // Household gold crossed the threshold for an ambition target (optional, if noisy skip)
```

`'private_build_started'` entry format:
- `personId`: household head / senior wife id  
- `description`: `"House [name] commissioned a [building name] from surplus materials."`

---

## 11. Implementation Phases

### Phase A — Data model

| Step | File | Change |
|------|------|--------|
| 1 | `game-state.ts` | Add `householdGold: number` to `Household` |
| 2 | `game-state.ts` | Add `economyReserves: Partial<ResourceStock>` to `Settlement` |
| 3 | `building-definitions.ts` | Add `privateGoldCost?: number` to `BuildingDef`; populate for all `ownership === 'household'` buildings |
| 4 | `household.ts` | `createHousehold` initialises `householdGold: 0` |
| 5 | `household.ts` | `mergeHouseholds` adds dissolved household's `householdGold` to survivor |
| 6 | `serialization.ts` | `deserializeHousehold`: `householdGold: ?? 0` |
| 7 | `serialization.ts` | `deserializeGameState`: `economyReserves: settlement.economyReserves ?? {}` |
| 8 | `stores/game-store.ts` | `createInitialState` sets `settlement.economyReserves = {}` |
| — | tests | `tests/store/serialization.test.ts`: round-trip `householdGold`, `economyReserves` |
| — | tests | `tests/population/household.test.ts`: `mergeHouseholds` gold combination |

### Phase B — Income engine

| Step | File | Change |
|------|------|--------|
| 1 | `economy/private-economy.ts` | **New module**: `distributeHouseholdWages`, `getSurplus`, `ROLE_TO_BUILDING` |
| 2 | `economy/company.ts` | Extend `getCompanySupplyDelivery` to gate gold on `currentYear <= 10`; return `wageGold: number` |
| 3 | `turn/turn-processor.ts` | Wire `distributeHouseholdWages` into Spring `processDawn`; apply shortfall happiness penalty |
| 4 | `turn/turn-processor.ts` | Inject `eco_company_funding_ends` event when `currentYear === 10 && season === 'spring'` |
| 5 | `stores/game-store.ts` | Add `exportGoodsToCompany(amount: number)` store action |
| 6 | `game-state.ts` | Add `exportedGoodsThisYear: number` to `CompanyRelation`; reset each Spring |
| 7 | `game-state.ts` | Add `lastPayrollShortfall: boolean` to `GameState`; `false` default |
| 8 | `events/definitions/economic.ts` | Add `eco_company_funding_ends` notification event |
| — | tests | `tests/economy/private-economy.test.ts`: `distributeHouseholdWages` (company years no-deduct, self-funded full pay, self-funded pro-rata shortfall, 0-employed household), `getSurplus` (floor=0, floor>stock) |
| — | tests | `tests/economy/company.test.ts`: year-10 gate (gold appears), year-11 gate (no company gold), `exportGoodsToCompany` (rate, standing tick) |

### Phase C — Ambitions

| Step | File | Change |
|------|------|--------|
| 1 | `population/person.ts` | Add `'seek_better_housing'` and `'seek_production_building'` to `AmbitionId` |
| 2 | `population/ambitions.ts` | Generation + evaluation logic for both new types; `getAmbitionLabel` cases |
| 3 | `turn/turn-processor.ts` | No new wiring needed — existing ambition loop calls `generateAmbition` which now handles these types |
| — | tests | `tests/population/ambitions.test.ts`: generation conditions, evaluation fulfilled/failed/ongoing for both types |

### Phase D — Private build engine

| Step | File | Change |
|------|------|--------|
| 1 | `economy/private-economy.ts` | Add `processPrivateBuilding(state, rng): PrivateBuildResult` |
| 2 | `turn/turn-processor.ts` | Call `processPrivateBuilding` at dawn step 9.7 (after factions) |
| 3 | `game-state.ts` | Add `'private_build_started'` to `ActivityLogType` |
| — | tests | `tests/economy/private-economy.test.ts`: affordability gate (gold short), material surplus gate, successful purchase deducts correctly, one-per-household-per-turn cap, no ambition = no purchase, activity log entry written |

### Phase E — Economy UI

| Step | File | Change |
|------|------|--------|
| 1 | `ui/views/EconomyView.tsx` | **New file** — replaces `ProductionView.tsx`; layout per §9 |
| 2 | `ui/layout/LeftNav.tsx` | Change label `'Production'` → `'Economy'` (id unchanged: `'production'`) |
| 3 | `ui/layout/GameScreen.tsx` | `case 'production': return <EconomyView />` |
| 4 | `ui/views/SettlementView.tsx` (HouseholdCard) | Add `⚜ Ng` gold display in card footer |
| 5 | `ui/views/PersonDetail.tsx` | Ambition badge: add label strings for the 2 new ambition types |

---

## 12. Key Files Summary

| File | Role |
|------|------|
| `src/simulation/economy/private-economy.ts` | **New** — `distributeHouseholdWages`, `getSurplus`, `processPrivateBuilding`, `ROLE_TO_BUILDING` |
| `src/simulation/turn/game-state.ts` | `Household.householdGold`, `Settlement.economyReserves`, `CompanyRelation.exportedGoodsThisYear` |
| `src/simulation/buildings/building-definitions.ts` | `BuildingDef.privateGoldCost` |
| `src/simulation/population/household.ts` | `mergeHouseholds` gold combine; `createHousehold` default |
| `src/simulation/population/ambitions.ts` | Two new ambition types |
| `src/simulation/economy/company.ts` | `wageGold` return, `exportedGoodsThisYear` reset |
| `src/stores/serialization.ts` | `deserializeHousehold` + `deserializeGameState` fallbacks |
| `src/ui/views/EconomyView.tsx` | **New** — Economy tab UI |
| `tests/economy/private-economy.test.ts` | **New** — all new pure-logic tests |

---

## 13. Invariants & Edge Cases

| Case | Behaviour |
|------|-----------|
| Household gold < `privateGoldCost` | Purchase blocked; gold not deducted; retry next turn |
| Material floor set higher than current stock | `getSurplus` returns 0; purchase blocked |
| Household has no ambition | `processPrivateBuilding` skips the household entirely |
| Two households want the same scarce material | First household in `households.values()` order wins the turn; other retries next turn |
| Household at compound (tier 4) | `seek_better_housing` evaluates `'fulfilled'`; no new purchase |
| All household slots full (9/9) | `seek_production_building` evaluates `'fulfilled'` (treated as no room); ambition doesn't generate |
| `mergeHouseholds` during marriage | Dissolved household's gold transfers to survivor; dissolved ambition on its head is lost |
| Compound `def.cost` includes `gold: 5` | This is **material gold** checked against surplus, separate from `privateGoldCost: 12`; both apply || **Year 11+ with insufficient gold** | `payrollShortfall = true`; wages pro-rated; all employed adults receive `−5` purpose happiness |
| Year 10 Spring | `eco_company_funding_ends` event injected once; player warned before the cutoff hits |
| Player exports goods before year 11 | Gold stockpile grows; eases the transition; this is the intended preparation path |
---

## 14. Open Questions (Deferred)

- **Household savings drain on crisis** — should a very unhappy household (low morale, food shortage) *spend* its gold on bribing/leaving rather than building? Flagged for Phase 4 Polish.
- **Player-initiated private build** — the design doc (SETTLEMENT_UI_OVERHAUL) specifies a player-facing build flow per household. This system runs *in parallel* — autonomous builds happen regardless; the UI route allows the player to spend their own surplus gold faster.
- **Inheritance / death** — if the household head dies, `householdGold` remains on the household (it belongs to the household, not the person). Already handled by design.
- **Tier-2 production buildings** — smithy, tannery, brewery, stable currently have only tier 1. When tier-2 variants are added, `seek_production_building` naturally extends to them via `ROLE_TO_BUILDING`.

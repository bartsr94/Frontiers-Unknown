# Wealth System — Design Specification

> **Status:** Design — not yet implemented
> **Replaces:** `gold` + `goods` resource types; `computeYearlyQuota` gold/goods split; `distributeHouseholdWages` gold-only model; `craft_goods_to_gold` recipe
> **Scope:** `game-state.ts`, `resources.ts`, `company.ts`, `private-economy.ts`, `building-definitions.ts`, `crafting.ts`, `trade.ts`, `serialization.ts`, UI strips

---

## 1. Design Intent

Replace the two abstract currency resources (`gold` and `goods`) with a single resource: `wealth`. Wealth represents the accumulated material value of living and working on the frontier — clay pots, woven cloth, iron tools, preserved food stores, and trade credit. It is not coinage.

The key architectural shift is **inversion of the wealth flow**:

| Old model | New model |
|-----------|-----------|
| Settlement produces resources → distributes wages to households | Each job generates wealth for the household → settlement levies a tax share |
| Gold and goods tracked separately | Single `wealth` value tracked at both settlement and household level |
| Company quota in gold + goods | Company quota in wealth only |

This change achieves three things simultaneously:
1. Removes the frontier gold implausibility.
2. Gives households a meaningful economic differentiation (rich vs. poor settlers).
3. Creates a natural population-scaling incentive: more workers → more taxable production → faster settlement wealth growth.

---

## 2. Resource Type Changes

### Removed
- `gold` — absorbed into `wealth`
- `goods` — absorbed into `wealth`

### Added
- `wealth` — abstract accumulated value (see §3)

### Unchanged
- `food`, `cattle`, `lumber`, `stone`, `medicine`, `steel`, `horses`

### New `ResourceType` union

```typescript
type ResourceType =
  | 'food'
  | 'cattle'
  | 'wealth'    // NEW — replaces gold and goods
  | 'steel'
  | 'lumber'
  | 'stone'
  | 'medicine'
  | 'horses';
```

### `emptyResourceStock()` update
Remove `gold` and `goods` keys; add `wealth: 0`.

---

## 3. Dual-Register Wealth Architecture

Wealth exists in two separate registers that don't share a pool.

### 3.1 Settlement Wealth (`settlement.resources.wealth`)

Owned by the settlement as a whole. Sources and sinks:

| Source | Amount |
|--------|--------|
| Tax share of each worker's production (see §4) | varies by role |
| Company supply deliveries (investment years 1–10) | per `SUPPLY_DELIVERIES` |
| Tribute/gift received from tribes | event-driven |

| Sink | Amount |
|------|--------|
| Building maintenance (see §6) | per building per season |
| Company export at year-end (see §7) | player-chosen |
| Gifts / bribes to tribes (`modify_all_tribe_dispositions` events) | event consequence |
| Construction material costs that include wealth | per `BuildingDef.cost` |

Settlement wealth is the player-facing "budget." Running maintenance costs of a large settlement against a small taxable population is the primary economic squeeze.

### 3.2 Household Wealth (`Household.wealthSavings`)

Owned by the individual household. The existing `goldSavings: number` field on `Household` is **renamed** to `wealthSavings: number`. No other changes to the field — it remains a plain number, serialises normally.

Sources and sinks:

| Source | Amount |
|--------|--------|
| Personal share of worker's production (see §4) | varies by role |

| Sink | Amount |
|------|--------|
| Private dwelling upgrade commissions (Path B, `private-economy.ts`) | `BuildingDef.privateGoldCost` → renamed `privateWealthCost` |
| Private dwelling maintenance (see §6.2) | per tier per season |

Household wealth drives the private building system unchanged in logic — only the currency changes.

---

## 4. Per-Job Wealth Generation

Each worker role generates a total `wealthYield` per season. This yield is split between the household (personal share) and the settlement (tax share) at source, before it is recorded anywhere.

### 4.1 Settlement Tax Rate

```
SETTLEMENT_TAX_RATE = 0.30
```

Of each job's `wealthYield`:
- `personalWealth = Math.floor(wealthYield * (1 - SETTLEMENT_TAX_RATE))` → `household.wealthSavings`
- `taxWealth = wealthYield - personalWealth` → `settlement.resources.wealth`

This constant lives in `private-economy.ts` alongside the other tuning constants.

### 4.2 Wealth Yield Table

| Role | wealthYield / season | Notes |
|------|---------------------|-------|
| `unassigned` | 0 | No contribution |
| `child` | 0 | Too young |
| `gather_food` | 1 | Subsistence; minimal surplus |
| `farmer` | 1 | Baseline agricultural surplus |
| `gather_stone` | 1 | Raw extraction; modest value |
| `gather_lumber` | 1 | Raw extraction; modest value |
| `guard` | 1 | Wage; security service |
| `healer` | 2 | Valued skill |
| `craftsman` | 2 | Workshop output |
| `herder` | 2 | Livestock management surplus |
| `miller` | 2 | Processed grain commands premium |
| `hunter` | 2 | Hide + meat surplus |
| `trader` | 3 | Highest direct wealth generator |
| `blacksmith` | 3 | Iron goods are premium trade items |
| `tailor` | 3 | Cloth is high-value on the frontier |
| `brewer` | 2 | Ale is valuable but perishable |
| `priest_solar` | 1 | Social value, not economic |
| `wheel_singer` | 1 | Social value, not economic |
| `voice_of_wheel` | 1 | Social value, not economic |
| `keth_thara` | 1 | In cultural service |
| `builder` | 1 | Wages during construction |
| `away` | 0 | Off-site; no local production |
| `bathhouse_attendant` | 2 | Service role with premium charge |

### 4.3 Implementation Location

Wealth generation is computed **in `calculateProduction()`** in `resources.ts`, immediately after the role switch. It accumulates into two separate delta accumulators:

```typescript
let householdWealthDelta = new Map<string, number>(); // personId → personal wealth
let settlementWealthDelta = 0;
```

The function signature gains an additional return value, or an alternative: a new `calculateWealthGeneration()` function is called in `processDawn()` alongside `calculateProduction()`. The latter is cleaner to avoid making `calculateProduction` stateful across persons.

> **Implementation note:** `calculateProduction()` currently produces a single aggregate `ResourceStock`. Since wealth splits per-person (household vs. settlement), wealth generation should be a **separate pass** (`calculateWealthGeneration`) that returns `{ householdDeltas: Map<string, number>; settlementDelta: number }`. The existing production function handles all other resources unchanged.

### 4.4 Skill and Happiness Modifiers

Wealth generation follows the same multiplier chain as other production:
- `effectiveMult = happMult * getChildWorkModifier(person.age)` — same logic, same place
- `tradeTraining` bonus applies: `tradeMult = 1 + (person.tradeTraining[role] ?? 0) / 100`
- Final yield: `Math.floor(WEALTH_YIELD[role] * effectiveMult * tradeMult)`

---

## 5. Removal of Old Production Paths

### 5.1 `goods` production removed from `calculateProduction()`

The `trader` case currently sets `personGoods = 1`. This is replaced entirely by the wealth generation system (trader generates `wealthYield = 3`). The `delta.goods` accumulator is removed.

### 5.2 Crafting recipe changes (`crafting.ts`)

| Old recipe | Action | Replacement |
|------------|--------|-------------|
| `craft_lumber_to_goods` | **Remove** | Workshop role bonuses now generate wealth directly via the per-job system |
| `craft_cattle_slaughter` | **Modify** | Output becomes `{ food: 3 }` only — drop the `goods: 1` output |
| `craft_medicine_prep` | **Modify** | Input `goods: 2` → `wealth: 2` |
| `craft_goods_to_gold` | **Remove** | No longer meaningful |

The Workshop building's value is now expressed through the `craftsman` role's `wealthYield = 2` (up from the old `trader → 1 goods` path) plus any future Workshop-specific role production bonuses on specialised outputs.

### 5.3 Building cost changes

Any `BuildingDef.cost` entries with `gold` are updated to `wealth`. Any `flatProductionBonus` or `roleProductionBonus` entries producing `gold` or `goods` are rerouted: role wealth generation replaces per-building goods bonuses where they overlap.

---

## 6. Building Maintenance Costs

### 6.1 New `BuildingDef` field

```typescript
interface BuildingDef {
  // ... existing fields ...

  /**
   * Resource cost paid from settlement.resources each season to keep this
   * building operational. Unpaid maintenance causes the building to become
   * 'neglected' (see §6.3). Omitted = no maintenance cost.
   */
  maintenanceCost?: Partial<ResourceStock>;
}
```

`ResourceStock` now includes `wealth`, so maintenance can be expressed in wealth, lumber, stone, or any combination.

### 6.2 Private Dwelling Maintenance

Private dwellings drain from **household** `wealthSavings` directly, not settlement wealth. This is processed in `processPrivateBuilding()`.

| Dwelling tier | Household wealth / season |
|---------------|--------------------------|
| `wattle_hut` | 0 — basic survival, free |
| `cottage` | 1 |
| `homestead` | 2 |
| `compound` | 4 |

If a household cannot pay dwelling maintenance for 2 consecutive seasons:
- **Downgrade event** queued: the 'at risk' building is flagged in `DawnResult`
- Player-facing event fires from `definitions/household.ts`: "The [family name] household can no longer maintain their [homestead]. The structure falls into disrepair."
- Building type reverts one tier (compound → homestead; not removed entirely)

This is implemented in a new `applyDwellingMaintenance()` function in `private-economy.ts`.

### 6.3 Settlement Building Maintenance — Neglected State

If `settlement.resources.wealth` cannot cover a building's maintenance in a given season, the building enters a `neglected: true` state on its `BuiltBuilding` record.

```typescript
interface BuiltBuilding {
  // ... existing fields ...
  neglected?: boolean; // true = maintenance unpaid this season
}
```

Effects of neglect:
- `roleProductionBonus` and `skillGrowth` from that building do not apply
- `fertilityBonus` does not apply
- Cultural pull continues (the building still exists physically)
- Accumulated neglect of 3+ consecutive seasons → building fires a `bld_neglect_warning` event
- Neglect clears automatically the following season if wealth is sufficient

### 6.4 Maintenance Processing

A new `applyBuildingMaintenance(state)` function runs in `processDawn()` at step 9.7 (after apprenticeships, before private building pass):

```typescript
function applyBuildingMaintenance(
  buildings: BuiltBuilding[],
  resources: ResourceStock,
): { updatedBuildings: BuiltBuilding[]; updatedResources: ResourceStock; neglectedIds: string[] }
```

Buildings are processed in construction order. The settlement pays what it can, marking the rest neglected. No priority system in phase 1 — all or nothing per-building based on available wealth.

### 6.5 Reference Maintenance Cost Table (starting values — tune in playtest)

| Building | wealth/season | lumber/season | stone/season | Notes |
|----------|--------------|--------------|--------------|-------|
| `camp` | 0 | 0 | 0 | Starting structure; free |
| `longhouse` / `roundhouse` | 1 | 0 | 0 | Basic communal shelter |
| `great_hall` | 2 | 0 | 0 | |
| `granary` | 1 | 0 | 0 | |
| `fields` | 0 | 0 | 0 | No maintenance; just land |
| `workshop` | 1 | 0 | 0 | |
| `smithy` | 1 | 0 | 0 | Iron tools wear down |
| `tannery` | 1 | 0 | 0 | |
| `brewery` | 1 | 0 | 0 | |
| `mill` | 1 | 0 | 0 | Millstones wear |
| `trading_post` | 2 | 0 | 0 | Highest upkeep; signals trade weight |
| `healers_hut` | 1 | 0 | 0 | |
| `gathering_hall` | 1 | 0 | 0 | |
| `stable` | 0 | 1 | 0 | Straw and wood |
| `palisade` | 0 | 1 | 0 | Wood repairs |
| `bathhouse` | 2 | 0 | 1 | Heated water infrastructure |
| `clan_lodge` | 1 | 0 | 0 | |
| `wattle_hut` | 0 | 0 | 0 | Household-only; no settlement cost |
| `cottage` | 0 | 0 | 0 | Household-only |
| `homestead` | 0 | 0 | 0 | Household-only |
| `compound` | 0 | 0 | 0 | Household-only |

> **Design goal:** At settlement founding (Camp only), maintenance costs are 0. After a longhouse + granary + fields + workshop are built, total maintenance is ~4 wealth/season. Taxable production from 10 workers averages 3–4 wealth/season at tax rate 0.30. This means the early game runs close to break-even — which is correct; the pressure increases as you expand.

---

## 7. Company Arc Redesign

### 7.1 Investment Phase (Years 1–10)

The Company sends supply deliveries in Spring. Deliveries are now expressed in `wealth` directly, replacing the `gold + goods` breakdown.

Updated `SUPPLY_DELIVERIES`:

```typescript
export const SUPPLY_DELIVERIES: Record<CompanySupportLevel, SupplyDelivery> = {
  full_support: { food: 15, wealth: 12, medicine: 5 },
  standard:     { food: 10, wealth: 7  },
  reduced:      { food: 5,  wealth: 3  },
  minimal:      { food: 2               },
  abandoned:    {},
};
```

During years 1–10, no quota is expected. `computeYearlyQuota(year)` returns `{ wealth: 0 }` for years ≤ 10.

### 7.2 Return Phase — Quota Formula

From year 11 onward:

```typescript
function computeYearlyQuota(year: number): { wealth: number } {
  if (year <= 10) return { wealth: 0 };
  const delta = year - 10;
  return { wealth: 10 + delta * 5 };
}
```

| Year | Wealth quota |
|------|-------------|
| 11 | 15 |
| 12 | 20 |
| 13 | 25 |
| 15 | 35 |
| 20 | 60 |

The quota scales deliberately slowly in the first few post-grace years, then ramps. The player must grow their population and building base to keep pace.

### 7.3 Annual Export Event

At the end of each in-game year (after the Autumn dusk pass), an event fires: **`co_annual_export`**.

This replaces the previous automatic autumn quota check. The player now actively decides the export amount.

**Event structure:**

```
Title: "The Company demands its share"
Description: "The {current_year} trading ledger closes. The Company's factor
              aboard the supply vessel expects {quota.wealth} wealth in goods
              and trade value to be loaded before the ship departs."

[Settlement wealth available: N]
[Quota required: M]
```

**Choices:**

| Choice | Condition | Effect |
|--------|-----------|--------|
| "Send the full quota" | `settlement.resources.wealth >= quota.wealth` | Deduct quota wealth; `quotaStatus = 'met'`; `standing +3` |
| "Send everything we have" | `settlement.resources.wealth > 0 && < quota` | Deduct all wealth; `quotaStatus = 'partial'`; `standing −10` |
| "Exceed the quota — send [quota × 1.25]" | `settlement.resources.wealth >= quota × 1.25` | Deduct excess wealth; `quotaStatus = 'exceeded'`; `standing +8` + minor Company reward (supply bonus next Spring) |
| "Send nothing this year" | Always available | Deduct 0; `quotaStatus = 'failed'`; `standing −15` |

> **Design note:** The "send nothing" choice is intentionally always available. Sometimes the player genuinely needs to prioritise survival over Company relations. The consequence (standing loss, eventual support reduction) is the cost — not a hard block.

### 7.4 `CompanyRelation` Field Changes

```typescript
interface CompanyRelation {
  standing: number;
  annualQuotaWealth: number;     // replaces annualQuotaGold + annualQuotaGoods
  quotaContributedWealth: number; // replaces quotaContributedGold + quotaContributedGoods
  consecutiveFailures: number;
  supportLevel: CompanySupportLevel;
  yearsActive: number;
}
```

`QuotaContribution`:
```typescript
interface QuotaContribution { wealth: number; }
```

`YearlyQuota`:
```typescript
interface YearlyQuota { wealth: number; }
```

`GOLD_TO_GOODS_RATE` constant: **removed**.

### 7.5 `checkQuotaStatus` Simplification

```typescript
function checkQuotaStatus(contribution: QuotaContribution, quota: YearlyQuota): QuotaStatus {
  if (quota.wealth === 0) return 'exceeded';
  const fraction = contribution.wealth / quota.wealth;
  if (fraction >= 1.1)  return 'exceeded';
  if (fraction >= 0.9)  return 'met';
  if (fraction >= 0.5)  return 'partial';
  return 'failed';
}
```

---

## 8. Building Prerequisite System

### 8.1 Principle

Advanced buildings that conceptually require intermediate materials (clay, fired brick, dressed stone) from specialised structures are gated behind a **building prerequisite**, not an intermediate resource type. The prerequisite is checked in `canBuild()` — the same mechanism as the existing `requires?: BuildingId` field.

For now, prerequisites are single required buildings. Multi-building prerequisites are deferred to a later phase when the resource expansion plan is formalised.

### 8.2 Pottery as a Prerequisite

A `pottery` building is added to the catalogue. It is a low-cost, early-tier industry building.

```typescript
pottery: {
  id: 'pottery',
  category: 'industry',
  cost: { lumber: 3 },
  buildSeasons: 1,
  shelterCapacity: 0,
  workerSlots: 1,
  workerRole: 'craftsman',
  maintenanceCost: { wealth: 1 },
  description: 'Fires clay into tiles, pipes, and vessels.',
}
```

Buildings that require pottery:
- `compound` (clay roof tiles) — add `requires: 'pottery'`
- `bathhouse` (clay pipes) — add `requires: 'pottery'`
- `bathhouse_improved` — inherited through chain
- Any future tier-3+ civic buildings

### 8.3 `BuildingId` Addition

```typescript
type BuildingId = 
  | 'camp' | 'longhouse' | 'roundhouse' | 'great_hall' | 'clan_lodge'
  | 'granary' | 'fields' | 'workshop' | 'trading_post' | 'healers_hut'
  | 'gathering_hall' | 'palisade' | 'stable' | 'mill' | 'smithy'
  | 'tannery' | 'brewery'
  | 'wattle_hut' | 'cottage' | 'homestead' | 'compound'
  | 'pottery'; // NEW
```

---

## 9. Tribe Trade Changes

The tribe trade interface in `trade.ts` receives wealth as a tradeable resource. No structural changes are required — `TradeOffer` and `TradeRequest` are `Partial<ResourceStock>`, and `ResourceStock` will simply no longer contain `gold`/`goods`.

Tribe gift events (e.g. `modify_all_tribe_dispositions` consequences paired with resource deltas) use wealth as the currency of relationship-building. This is narratively coherent — the settlement is sending useful goods and materials, not physical coins.

`validateTrade()` and `getTradeValue()` will need the `goods` and `gold` price entries replaced with a single `wealth` price. The value table in `trade.ts` gains a `wealth` entry at a neutral rate.

---

## 10. `Household` Interface Changes

```typescript
interface Household {
  // ... existing fields ...
  wealthSavings: number;   // renamed from goldSavings
  wealthMaintenanceDebt: number; // NEW — consecutive seasons unpaid dwelling maintenance
}
```

All references to `household.goldSavings` in `private-economy.ts`, `game-store.ts`, and `construction.ts` are renamed to `household.wealthSavings`.

`BuildingDef.privateGoldCost` is renamed to `privateWealthCost`.

---

## 11. `GameState` / `Settlement` Changes

```typescript
interface Settlement {
  resources: ResourceStock; // wealth replaces gold + goods automatically via ResourceType change
  // ... all other fields unchanged ...
}
```

No new fields on `Settlement` itself — the `wealthMaintenanceDebt` tracking is on `Household`, and the building `neglected` flag is on `BuiltBuilding`.

### 11.1 Fields to Remove from `CompanyRelation`

- `annualQuotaGold` → replaced by `annualQuotaWealth`
- `annualQuotaGoods` → replaced
- `quotaContributedGold` → replaced by `quotaContributedWealth`
- `quotaContributedGoods` → replaced

---

## 12. Dawn Processing Order Changes

The new step additions slot into the existing `processDawn()` sequence:

```
... (existing steps 1–9 unchanged — aging, pregnancies, language, culture, mortality, construction, traits, temp traits, skills) ...

Step 9.5  — applyBuildingMaintenance()          [NEW — deducts wealth from settlement; marks neglected]
Step 9.6  — Apply wealth generation pass         [NEW — calculateWealthGeneration() distributes to households + settlement]
Step 9.65 — applyDwellingMaintenance()           [NEW — deducts household wealthSavings; checks debt counter]
Step 9.7  — processPrivateBuilding()             [EXISTING — uses household.wealthSavings]
Step 9.75 — distributeHouseholdWages() renamed   [EXISTING renamed — no-op if wealth already distributed in step 9.6]

... (existing steps 9.8+ — relationships, schemes, factions, identity pressure, happiness, apprenticeships) ...
```

> **Note:** `distributeHouseholdWages` in its current form (moves settlement gold to households) is superseded by the new wealth generation pass which handles the household credit directly. The function can be removed or repurposed for a future payroll mechanic.

---

## 13. UI Changes

### 13.1 Bottom Resource Strip (`BottomBar.tsx`)

Remove the `gold` and `goods` slots. Add `wealth`. The strip goes from 9 items to 8.

Suggested icon/label for wealth: a small amphora or bundle — represents tangible trade goods. Colour: deep amber (`#C8871A`).

### 13.2 Household Wealth Display

`PersonDetail.tsx` Housing section currently shows `goldSavings`. Rename display to "Household Wealth" and update the field source.

### 13.3 Quota Panel (`SettlementView.tsx` / Trade/Company panels)

The quota panel currently shows two bars (gold / goods). Replace with a single wealth bar:
- "Required this year: N wealth"
- "Settlement wealth: M"
- Progress fill as `M / N`, capped at `exceeded` threshold

### 13.4 Annual Export Event (`EventView.tsx`)

The `co_annual_export` event uses the standard `EventView` layout with the choice list. An additional info block above the choices shows the wealth balance: `[Settlement has: N | Quota: M]`. This can be a custom event description that uses `{settlementWealth}` and `{quotaWealth}` interpolation tokens, or hardcoded into the event's bound description via the resolver.

---

## 14. Serialisation

### 14.1 `ResourceStock` Changes

Old saves that contain `gold` and `goods` keys will deserialise with those keys ignored (TypeScript strict mode will not include unknown keys when spreading into the new typed object). A `deserializeResourceStock()` helper should be added if upgrading existing saves is a requirement:

```typescript
function deserializeResourceStock(raw: Record<string, number>): ResourceStock {
  return {
    food:     raw.food     ?? 0,
    cattle:   raw.cattle   ?? 0,
    wealth:   (raw.wealth ?? 0) + (raw.gold ?? 0) + (raw.goods ?? 0), // migrate old saves
    steel:    raw.steel    ?? 0,
    lumber:   raw.lumber   ?? 0,
    stone:    raw.stone    ?? 0,
    medicine: raw.medicine ?? 0,
    horses:   raw.horses   ?? 0,
  };
}
```

This converts old `gold + goods` into `wealth` at a 1:1 rate on first load. Players who had 5 gold + 8 goods will start with 13 wealth — a one-time rough conversion, acceptable for a dev-phase schema change.

### 14.2 `Household` Changes

`goldSavings` → `wealthSavings`. Deserialise with:
```typescript
wealthSavings: household.wealthSavings ?? household.goldSavings ?? 0,
wealthMaintenanceDebt: household.wealthMaintenanceDebt ?? 0,
```

### 14.3 `CompanyRelation` Changes

```typescript
annualQuotaWealth:      company.annualQuotaWealth ?? company.annualQuotaGold ?? 0,
quotaContributedWealth: company.quotaContributedWealth ?? (
  (company.quotaContributedGold ?? 0) + Math.floor((company.quotaContributedGoods ?? 0) / 2)
),
```

---

## 15. What Is Not Changing

The following systems are unaffected by this redesign and require no changes:

- `food`, `cattle`, `lumber`, `stone`, `medicine`, `steel`, `horses` production and consumption logic
- Spoilage system (`spoilage.ts`) — wealth does not spoil
- Named relationships, schemes, factions, happiness
- Cultural drift, religion, language acquisition
- Opinion and ambition systems
- Genetics, inheritance, fertility
- Event engine, actor resolver, interpolation
- Portrait system
- All test infrastructure outside economy/company/private-economy tests

---

## 16. Implementation Order

The recommended sequence — each step leaves the codebase in a compilable, testable state:

1. **`game-state.ts`** — Update `ResourceType`, `ResourceStock`, `CompanyRelation`, `BuiltBuilding` (add `neglected`), `Household` (rename field, add debt field). Add `BuildingId` `'pottery'`.
2. **`serialization.ts`** — Write `deserializeResourceStock()` migration; update `deserializeHousehold()`, `deserializeCompanyRelation()`.
3. **`resources.ts`** — Remove `goods` production; add `calculateWealthGeneration()`; update `emptyResourceStock()`.
4. **`company.ts`** — Update `computeYearlyQuota`, `checkQuotaStatus`, `SUPPLY_DELIVERIES`, remove `GOLD_TO_GOODS_RATE`.
5. **`crafting.ts`** — Remove `craft_goods_to_gold` and `craft_lumber_to_goods`; update `craft_medicine_prep`, `craft_cattle_slaughter`.
6. **`building-definitions.ts`** — Add `maintenanceCost` to all relevant buildings; add `pottery` entry; add `requires: 'pottery'` to `compound` and `bathhouse`; rename `privateGoldCost` → `privateWealthCost`.
7. **`private-economy.ts`** — Rename `goldSavings` refs; add `applyDwellingMaintenance()`; remove old wage distribution code.
8. **`construction.ts`** — Rename `privateGoldCost` refs.
9. **New `building-effects.ts` entry** — `getBuildingMaintenanceCost(buildings)` aggregate — returns total maintenance due from a set of built buildings.
10. **`turn-processor.ts`** — Wire in `applyBuildingMaintenance()` and `calculateWealthGeneration()` at steps 9.5 and 9.6; add `applyDwellingMaintenance()` at 9.65.
11. **`trade.ts`** — Replace `gold`/`goods` price entries with `wealth`.
12. **`event-filter.ts` / `resolver.ts`** — Update any consequence handlers that reference `gold` or `goods` resource types.
13. **Event definitions** — Update any `modify_resources` consequences with `gold`/`goods` keys to use `wealth`.
14. **UI** — `BottomBar.tsx`, `PersonDetail.tsx`, `SettlementView.tsx`; add `co_annual_export` event to `definitions/company.ts`.
15. **Tests** — Update all economy test files; add `building-maintenance.test.ts`, `wealth-generation.test.ts`.

---

## 17. Open Questions (Deferred)

These are design questions that do not need resolving for the initial implementation but should be addressed before Phase 4 Polish:

1. **Pottery clay as an actual intermediate resource.** The plan notes that clay goods may become a real `ResourceType` in a future expansion. When that happens, the `requires: 'pottery'` prerequisite transforms into `requires: { pottery: true, clayGoods: N }`. The prerequisite field should be designed to accommodate this.

2. **Faction pressure around taxation.** The `merchant_bloc` and `company_loyalists` factions have obvious opinions about the tax rate. A `SETTLEMENT_TAX_RATE` that can shift up/down via faction demands or player decisions is a natural Phase 4 mechanic.

3. **Wealth decay / storage cap.** Should wealth spoil or have a storage maximum? Current design: no. But once the building chain expansion adds higher-tier warehousing, a soft cap (above which wealth decays slowly) would incentivise exporting rather than hoarding.

4. **Household wealth visibility in the UI.** The current PersonDetail shows household savings as a number. A wealth distribution histogram across all households (in `CommunityView`) would make the stratification visible and meaningful to the player.

5. **The `co_annual_export` event timing.** Currently specified as "end of year, after Autumn dusk." Consider whether Spring (before the Company ship arrives) feels more natural narratively — the player loads goods before the ship sails, not after Autumn harvest.

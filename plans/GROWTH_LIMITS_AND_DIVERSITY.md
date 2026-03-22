# Natural Limits to Growth & Household Diversity
## Design Document — March 2026

---

## 1. Problem Statement

At Year 54 with population 221 the game produces **+12,638 food/season** (a 57× surplus relative to consumption of 221) and **+13,812 wealth/season**. Every household owns an identical full agriculture chain. The root causes are distinct:

**Root Cause A — The roleProductionBonus stacking bug (urgent)**

`getRoleProductionBonus(buildings, role)` sums the `roleProductionBonus` from *every* building in `settlement.buildings`. Private household buildings (Farmstead, Grain Silo, etc.) are stored in `settlement.buildings` alongside communal buildings. With 20 households each owning a Farmstead (`+1 food per farmer`) and a Grain Silo (`+2 food per farmer`), every farmer in the settlement receives **+60 food/season** from third parties' buildings, regardless of which household they belong to. At 80+ farmers, before seasonal multipliers, this generates thousands of food per season from bonuses alone.

**Impact calculation at Year 54, pop 221 (estimated):**
- ~17 agriculture-chain households × [Farmstead (+1) + Grain Silo (+2) + Barns & Storehouses (+1)] = +68 roleProductionBonus per farmer
- ~80 farmers × +68 = +5,440 food bonus/season pre-seasonal × 1.6 autumn = ~8,700 food from stacking alone
- Plus base farmer yield (~80 × 3 × 1.6 = 384) + flat bonuses + cattle: total ~12,600

This is a **design flaw**, not a balance issue. The fix is immediate and binary.

**Root Cause B — No resource storage ceilings**

Resources accumulate without any hard ceiling, so a self-reinforcing loop has no natural exit:
more food → more children → more workers → more food.

**Root Cause C — Household monoculture**

`processPrivateBuilding` Path C (role-driven build, no ambition required) fires for any member with a production role. Since `resolveIdleRoleSeeking` assigns most adults to `farmer` or `gather_food`, every household triggers agriculture chain construction. The result: all households converge on the same building portfolio by mid-game.

---

## 2. Design Principles

1. **Soft ceilings, not hard walls.** Growth should plateau under pressure, not crash into an invisible limit.
2. **Buildings as the solution, not just the problem.** Players should *build their way to a larger ceiling*, not just avoid building.
3. **Household identity emerges early and persists.** A household's first production building is its founding character. Later buildings in other chains cost more and feel like a compromise.
4. **No punishment for playing well.** A thriving settlement *should* feel prosperous. The goal is diversity and organic limits, not constant scarcity.
5. **Explainability.** Every limit should be traceable to something legible in the UI ("your granaries are full", "the Crale household are farmers — a smithy would cost them extra").

---

## 3. System Changes

### 3.1 Fix: Private Building Production Scoping (Priority: Urgent)

**The bug:** `getRoleProductionBonus(buildings, role)` applies every matching building's bonus to every worker of that role, regardless of household ownership.

**The fix:** Private household buildings should only grant their `roleProductionBonus` to members of the *owning household*. Communal buildings (no `ownerHouseholdId`) continue to benefit everyone.

**Implementation:**
- In `calculateProduction`, split `buildings` into `communalBuildings` (where `ownerHouseholdId === null`) and `privateBuildings` (map from household ID to buildings).
- For each person, compute `roleBonus` from communalBuildings + any private buildings owned by `person.householdId`.
- `getBuildingFlatProductionBonus` stays settlement-wide; only `getRoleProductionBonus` is scoped.

**Expected post-fix production at same settlement:**
- 80 farmers × (3 base + 2 communal Fields bonus) × 1.6 = ~640 food/season.
- Household Farmstead/Silo now only help that household's own farmers.
- A household with 4 farmers + Farmstead + Grain Silo: 4 × (3 + 1 + 2) × 1.6 = ~38 food/season. 
- 17 such households: ~650 food total. With all sources: estimated 1,200–1,800 food/season. Reasonable.

---

### 3.2 Resource Storage Caps

**Concept:** Every resource has a `storageCapacity`. Surplus production above the cap is lost ("spills over"). This creates a soft production plateau without changing the production math.

**Base capacity (no storage buildings):**

| Resource | Base cap | Formula |
|----------|----------|---------|
| Food | `pop × 8` | 8 seasons at base consumption |
| Lumber | `pop × 4` | 4-season build reserve |
| Stone | `pop × 4` | same |
| Wealth | `pop × 12` | larger buffer; wealth is less perishable |
| Cattle | `pop × 2` | pasture limits |
| Medicine | `pop × 3` | — |
| Steel / Horses | `400` flat | — (uncommon resources) |

**Storage buildings expand caps:**

| Building | Cap expansion |
|----------|--------------|
| Granary | +500 food |
| Grain Silo (private) | +150 food (only for owning household's contribution — post-fix) |
| Barns & Storehouses | +200 food, +50 cattle |
| Lumber Yard (future) | +250 lumber |
| Stone Yard (future) | +250 stone |
| Trading Post | +300 wealth |

**Overflow rule:** When `resources[type] + production[type] > cap[type]`, the resource is clamped to the cap. No delta taken from workers — they still "work" and gain skills. Excess just doesn't accumulate. The UI BottomBar should show `175,171 / 2,400 food` and highlight when near the cap.

**Enhanced spoilage at high stockpile:**

The existing spoilage system applies flat rates. Add a **capacity-proportional multiplier**:

| Stockpile % of cap | Spoilage multiplier (food only) |
|--------------------|---------------------------------|
| < 70% | ×1.0 (current behaviour) |
| 70–84% | ×2.0 |
| 85–94% | ×4.0 |
| ≥ 95% | ×8.0 |

This represents food rotting in inadequate storage — the settlement needs more granaries or fewer farmers, not both. Other resources use ×2.0 at ≥ 85%.

---

### 3.3 Household Specialization (Strong Bias, Soft Limits)

**Goal:** Each household develops a persistent identity tied to its first production chain.  The second chain is possible but costly; the third and fourth are luxuries only wealthy Compounds attempt.

#### 3.3.1 `HouseholdSpecialty` Type

```typescript
type HouseholdSpecialty =
  | 'agriculture'   // fields, farmstead, grain_silo, orchard chain
  | 'pastoralism'   // cattle_pen, meadow, stable, ranch chain
  | 'hunting'       // woodcutter_hut, smokehouse, hunting chain
  | 'craft'         // smithy, tannery, brewery, mill, pottery chain
  | 'trade'         // trading_post, commerce chain
  | 'healing'       // healers_hut, apothecary chain
  | 'forestry'      // woodcutter_hut, logging chain
  | 'quarrying';    // stone_pit, quarrying chain
```

Added to `Household` as `specialty: HouseholdSpecialty | null`. Starts `null`.

#### 3.3.2 Specialty Assignment

When a household's **first production building** completes (slot 1 is filled for the first time), the building's chain determines `specialty`. Specialty never changes autonomously after that. The player can reset it through a new event (`hh_household_repurpose`) available once every 12 turns.

**Chain-to-specialty mapping** defined in a lookup table alongside `ROLE_TO_PRODUCTION_CHAINS`.

#### 3.3.3 Out-of-Specialty Build Cost Modifier

In `processPrivateBuilding`, before commissioning a project, check:

```
targetSpecialty = getChainSpecialty(targetBuilding)
if (household.specialty !== null && targetSpecialty !== household.specialty):
  effectiveWealthCost = baseCost × 1.5
  effectiveMaterialCost = baseCost × 1.25
```

**Exceptions (always in-specialty cost):**
- T1 sustenance buildings: `fields`, `woodcutter_hut`, `stone_pit` (every household can afford basic infrastructure)
- Dwelling upgrades (never specialty-gated)
- Ambition-driven civic donations

**Effect in practice:** A farming household can still build a Smithy, but it costs 50% more wealth and labour. After mid-game wealth accumulation this is achievable — it's a choice, not a wall.

#### 3.3.4 Production Building Slot Limits (Dwelling-Gated)

Households are limited in how many production buildings they can own by their dwelling tier:

| Dwelling | Max production slots | Notes |
|----------|---------------------|-------|
| Wattle Hut | 1 | One necessity only |
| Cottage | 2 | First specialty building + one basic |
| Homestead | 3 | Full specialty chain (T1–T3) |
| Compound | 5 | Complete chain + 1 luxury / cross-specialty building |

This means a Compound household CAN have 5 production buildings (e.g., 4 agriculture chain + 1 smithy), but a Cottage can only have 2. This makes the `seek_better_housing` ambition directly meaningful for productive households and caps the "own everything" endgame accumulation.

**Existing households with more than their current slot limit:** A migration event fires at game load offering the player a chance to "reorganize" households that overflow their tier. Alternatively, a grace period of 4 seasons before slots are enforced.

---

### 3.4 Fertility Soft Limits

**Current state:** A woman at peak fertility (ages 22–35) has a 25% conception chance per season — effectively 1 child/year at peak. No family size penalty. A polygynous household with 10 wives all at peak = ~10 children/year.

**Change: Household crowding penalty on conception chance**

Applied as a multiplier inside `getFertilityChance` after all existing modifiers:

| Household member count | Fertility multiplier |
|------------------------|---------------------|
| ≤ 5 | ×1.0 (no change) |
| 6–10 | ×0.80 |
| 11–16 | ×0.65 |
| 17–24 | ×0.50 |
| ≥ 25 | ×0.35 |

This is passed to `getFertilityChance` via a `householdMemberCount` parameter. Lore framing: crowded households struggle to feed and care for infants; infant mortality and miscarriage increase.

**Note:** The `frail`, `malnourished`, and `ill` multipliers already stack — this adds one more clean layer that scales with household size, not just individual health.

---

### 3.5 Labor Diversification Improvements

The existing `promoteForagersToFarmers` and `diversifyLaborFromFoodSurplus` work well directionally but have two structural issues to address:

**Issue 1: No maximum farmer fraction**

With unlimited Fields, the system eventually puts nearly everyone on food production until the 4× surplus is reached, then laboriously pulls them off. A simpler prior gate avoids the oscillation.

**Change:** Add `FARMER_WORKFORCE_FRACTION_CAP = 0.45` — `promoteForagersToFarmers` only fires when the current farmer count is below `floor(livingAdults × 0.45)`. Combined with the Fields slot cap, this creates a natural ceiling without requiring surplus detection.

**Issue 2: diversifyLaborFromFoodSurplus floor grows without bound**

`floor = max(1, floor(foodWorkers / 5))` — with 100 food workers this demands 20 lumberjacks and 20 quarriers. Then fewer food workers triggers less diversification, oscillating. Better to use a fixed minimum (2 each) and a scaling maximum (10% of workers each).

**Change:**
```
MIN_RESOURCE_WORKERS = 2 per type (lumber, stone)
MAX_RESOURCE_WORKERS = max(2, floor(livingAdults × 0.10)) per type
floor = MIN_RESOURCE_WORKERS  (always diversify if below 2)
cap   = MAX_RESOURCE_WORKERS  (stop pulling food workers above 10%)
```

This guarantees at minimum 2 of each while preventing over-correction.

---

## 4. What This Achieves Together

| Scenario | Before | After |
|----------|--------|-------|
| Year 20, pop 50 | ~800 food/season surplus | ~200 food/season surplus; storage cap at ~400 |
| Year 54, pop 221 | +12,638 food/season; identical households | ~1,800 food/season; households diverge by specialty |
| Household identity | Every household: farming chain | 30–40% farming, 20% herding, 15% craft, 10% trade, rest mixed |
| Wealth accumulation | £165k by year 54 | Plateau around £8,000–15,000 with storage cap |
| Late-game feel | Static abundance | Managed prosperity; expanding storage is meaningful; hiring specialists has trade-offs |

---

## 5. Implementation Roadmap

Ordered by impact-vs-complexity. Each step is independently shippable.

| # | Change | Complexity | Impact |
|---|--------|-----------|--------|
| 1 | **Fix roleProductionBonus scoping** — household buildings only benefit own household members | Medium | ⭐⭐⭐⭐⭐ Immediately fixes food numbers |
| 2 | **Resource storage caps** — add `computeStorageCap()`, clamp in `calculateProduction` and `processPrivateBuilding` | Medium | ⭐⭐⭐⭐ Ends infinite accumulation |
| 3 | **Enhanced spoilage at high stockpile** — multiply spoilage by capacity ratio in `spoilage.ts` | Low | ⭐⭐⭐ Soft pressure to build storage |
| 4 | **Production slot limits on households** — `DWELLING_PRODUCTION_SLOTS` enforced in `processPrivateBuilding` | Low | ⭐⭐⭐ Curbs building hoarding |
| 5 | **Household specialty** — `HouseholdSpecialty` field + assignment on first building + out-of-specialty cost mod | High | ⭐⭐⭐⭐ Core diversity mechanism |
| 6 | **Farmer workforce fraction cap** — add `FARMER_WORKFORCE_FRACTION_CAP = 0.45` gate to `promoteForagersToFarmers` | Trivial | ⭐⭐ Stabilises labor oscillation |
| 7 | **Diversification worker floor/cap** — replace unbounded floor with `MIN=2 / MAX=10% of workforce` | Trivial | ⭐⭐ Same |
| 8 | **Fertility household crowding penalty** — add `householdMemberCount` multiplier in `getFertilityChance` | Low | ⭐⭐⭐ Soft population plateau in large households |
| 9 | **UI: storage bar** — show `stock / cap` in BottomBar; highlight at ≥ 80% | Medium | ⭐⭐ Explainability |
| 10 | **Household specialty UI** — show specialty badge on household card; tooltip explains cost modifier | Low | ⭐⭐ Explainability |

---

## 6. Open Questions / Decisions Deferred

- **Specialty inheritance at household founding**: should a new household spawned from an existing one inherit the parent's specialty? (Proposed: yes, with 50% probability — siblings might diverge.)
- **Specialty reset event**: frequency and conditions for `hh_household_repurpose`. Requires event writing.
- **Flat production bonuses from private buildings** (`flatProductionBonus` on Farmstead, Grain Silo, etc.) — these are settlement-wide regardless of ownership. Should they also be scoped, or left communal as a "neighbourhood effect"? (Proposed: scope to owning household's members only, same fix as roleProductionBonus.)
- **Storage building UI**: Should the cap be shown as a progress bar in the Economy view, or on the BottomBar with a fraction display?
- **Retroactive slot enforcement**: How to handle existing saves with 10-building households? Grace period of 4 seasons before enforcement is recommended.

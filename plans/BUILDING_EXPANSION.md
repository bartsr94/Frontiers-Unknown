# Building Expansion — Design Doc

**Status:** Design / Pre-implementation  
**Author:** Claude (Copilot)  
**Date:** 2026-03-18

---

## Overview

Two parallel workstreams:

1. **UI: 12-slot communal building grid** — replaces the text-list in the left panel with an icon grid matching the household grid style.
2. **Data: 7 new 4-tier building chains** — inspired by CK3 economic buildings; 24 new `BuildingId` values + 1 new `WorkRole`.

---

## Part 1 — UI: 12-Slot Communal Building Grid

### What Changes

Replace the current left-panel communal building list (`BuildingCard` text cards + inline "Build Menu") with a **3×4 icon grid** matching the household card style.

### Layout

```
┌────────────────────────────┐
│  Settlement header (stats) │
│  Communal Buildings:       │
│  ┌──┐ ┌──┐ ┌──┐           │
│  │🏕│ │  │ │  │  (row 1)  │
│  └──┘ └──┘ └──┘           │
│  ┌──┐ ┌──┐ ┌──┐           │
│  │  │ │  │ │  │  (row 2)  │
│  └──┘ └──┘ └──┘           │
│  ┌──┐ ┌──┐ ┌──┐           │
│  │  │ │  │ │  │  (row 3)  │
│  └──┘ └──┘ └──┘           │
│  ┌──┐ ┌──┐ ┌──┐           │
│  │  │ │  │ │  │  (row 4)  │
│  └──┘ └──┘ └──┘           │
│  Dwelling section          │
├────────────────────────────┤
│  Construction queue        │
└────────────────────────────┘
```

- **Slot 0** is always occupied by `camp` at game start (auto-populated like the household's dwelling slot).
- Communal buildings built thereafter fill the next available slot.
- **Click occupied slot** → `SlotDetailPopover` (reuse existing, add communal path).
- **Click empty slot** → `BuildingPickerModal` in `mode: 'communal'`.
- Camp slot shows its icon but the "cancel/detail" interactions should be suppressed (camp is permanent).

### New Component: `CommunalBuildingGrid`

Extract a `CommunalBuildingGrid` component (similar in structure to `HouseholdCard`'s grid section) that:
- Takes `buildings: BuiltBuilding[]` and `canManage: boolean`
- Renders a 3×4 grid using `BuildingIcon` 
- Shows "+" in empty slots
- Calls `onSlotClick(slotIndex, building | null)` like the household grid does

### GameState Change

`Settlement` needs a `communalSlots: (string | null)[]` array (12 entries, each is a `BuildingId` instanceId or null) to track communal slot order, similar to `Household.buildingSlots`. This is required so the grid renders in deterministic order across sessions.

Alternative simpler approach: derive slot order from `settlement.buildings` filtered to communal buildings, using `builtTurn` as sort key (order built = slot order). Camp is always first. This avoids schema migration.

**Decision: Use derived order** (no new field needed). Logic:
```typescript
function getCommunalSlots(buildings: BuiltBuilding[]): (BuiltBuilding | null)[] {
  const communal = buildings
    .filter(b => BUILDING_CATALOG[b.defId]?.ownership !== 'household')
    .sort((a, b) => a.builtTurn - b.builtTurn);  // camp is turn 0, always first
  const slots: (BuiltBuilding | null)[] = [...communal, ...Array(12 - communal.length).fill(null)];
  return slots.slice(0, 12);  // max 12 communal buildings visible
}
```

---

## Part 2 — 7 New Building Chains

### Design Decisions (from player)

| Question | Answer |
|---|---|
| Tiers per chain | **4** |
| Household chains (Agriculture, Cattle, Orchards) | **Additive/coexisting** — each tier occupies its own household slot; higher tiers require lower but don't replace. Slot scarcity forces specialization. |
| Communal chains (Forestry, Hunting, Quarry, Hospice) | **Upgrade/replace** — you upgrade a single communal facility progressively. |
| Hunter role | **New `WorkRole: 'hunter'`** — uses `combat` skill, produces food (and goods at higher tiers), separate from `gather_food`. |
| Building bonus model | **Option B** — the building amplifies per-worker output via `roleProductionBonus`. Without the building the role still produces (baseline), with it the output is higher. |

### Ownership Matrix

| Chain | Ownership | Additive? |
|---|---|---|
| Farms & Fields | Household | Yes |
| Cattle Pastures | Household | Yes |
| Orchards | Household | Yes |
| Forestries | Communal | No (upgrades) |
| Hunting Grounds | Communal | No (upgrades) |
| Quarries | Communal | No (upgrades) |
| Hospices | Communal | No (upgrades, extends `healers_hut`) |

---

## New BuildingId Values (24 new)

```typescript
// Agriculture chain (household, additive)
| 'barns_storehouses'   // T2
| 'farmstead'           // T3
| 'grain_silo'          // T4

// Cattle / Pastoralism chain (household, additive)
| 'cattle_pen'          // T1
| 'meadow'              // T2
| 'cattle_ranch'        // T3
| 'stock_farm'          // T4

// Orchard chain (household, additive)
| 'orchard'             // T1
| 'berry_grove'         // T2
| 'beekeeper'           // T3
| 'grand_orchard'       // T4

// Forestry chain (communal, upgrade)
| 'logging_camp'        // T1
| 'charcoal_burners'    // T2
| 'wood_pasture'        // T3
| 'sawmill'             // T4

// Hunting chain (communal, upgrade)
| 'hunters_lodge'       // T1
| 'hound_pens'          // T2
| 'hunting_towers'      // T3
| 'hunting_reserve'     // T4

// Quarry chain (communal, upgrade)
| 'stone_quarry'        // T1
| 'ore_mine'            // T2
| 'large_quarry'        // T3
| 'shaft_mine'          // T4

// Hospice chain (communal, upgrade — extends healers_hut)
| 'infirmary'           // T2
| 'hospital'            // T3
| 'grand_hospital'      // T4
```

---

## New WorkRole

```typescript
| 'hunter'   // uses combat skill; produces food (+ goods at higher building tiers)
```

Add to:
- `WorkRole` union in `person.ts`
- `ROLE_LABELS` / `ROLE_COLORS` in `role-display.ts`  
  - Label: `"Hunter"`, Color: `"bg-amber-800 text-amber-200"` (earthy, wild)
- `TRAINABLE_TRADES` in `apprenticeship.ts`
- Resources calculation in `resources.ts` — same `gatherYield(combat)` pattern as `gather_food` uses `plants`

### Hunter Base Production (no building)
```
gatherYield(combat_skill) → 1-3 food/season
skill 1-25 (Fair):      1 food
skill 26-62 (Good/VG):  2 food
skill 63+ (Excellent+): 3 food
```

> Note: Designed to be slightly weaker than `gather_food` (foraging) without buildings, but with a *Hunting Grounds* chain it eventually surpasses it and also produces goods (pelts/hides).

---

## Building Chain Specifications

### ─── FARMS & FIELDS (Household, Additive) ───

**Chain ID:** `agriculture`  
**Worker role:** `farmer`  
**Slot strategy:** Stack multiple instances of T1 (`fields`), add T2–T4 as single specialist buildings. A fully committed farming household uses 4+ slots.

| Tier | BuildingId | Name | Cost | Seasons | Key Effects |
|---|---|---|---|---|---|
| T1 | `fields` *(existing)* | Tilled Fields | 5 lumber | 1 | `+2 food/farmer`, 4 worker slots, `allowMultiple: true` |
| T2 | `barns_storehouses` | Barns & Storehouses | 8 lumber, 4 stone | 2 | `+1 food/farmer`, +2 farmer slots, `+1 food flat/season` |
| T3 | `farmstead` | Farmstead | 12 lumber, 8 stone | 3 | `+1 food/farmer`, +2 farmer slots, `+2 food flat/season` |
| T4 | `grain_silo` | Grain Silo | 20 lumber, 12 stone | 4 | `+2 food/farmer`, +3 farmer slots, `+3 food flat/season`, `fertilityBonus: 0.05` |

**Cumulative farmer bonus** (with all 4 tiers): +6 food/farmer/season on top of base 1  
**Total farmer slots** (all 4 tiers): 4 + 2 + 2 + 3 = 11  
**Passive flat food** (T2+T3+T4): +6/season  
**Requires:** T2 requires `fields`; T3 requires `barns_storehouses`; T4 requires `farmstead`

> **Migration note:** `mill` currently has `upgradeChainId: 'agriculture', tierInChain: 2`. Change it to `upgradeChainId: 'milling', tierInChain: 1` to avoid collision.

---

### ─── CATTLE PASTURES (Household, Additive) ───

**Chain ID:** `pastoralism`  
**Worker role:** `herder`  
**Note:** `stable` (existing, `upgradeChainId: 'livestock'`) remains separate — it produces horses, not cattle. These are distinct pastoral chains.

| Tier | BuildingId | Name | Cost | Seasons | Key Effects |
|---|---|---|---|---|---|
| T1 | `cattle_pen` | Cattle Pen | 8 lumber, 3 stone | 1 | `+1 cattle/herder`, `+1 food/herder`, 2 herder slots, `allowMultiple: false` |
| T2 | `meadow` | Meadow | 8 lumber | 2 | `+1 cattle/herder`, `+1 food/herder`, +2 herder slots, `+1 cattle flat/season` |
| T3 | `cattle_ranch` | Cattle Ranch | 15 lumber, 6 stone, 3 gold | 3 | `+2 cattle/herder`, `+2 food/herder`, +3 herder slots, `+2 cattle flat/season`, `+2 food flat/season` |
| T4 | `stock_farm` | Stock Farm | 22 lumber, 10 stone, 8 gold | 4 | `+2 cattle/herder`, `+2 food/herder`, +3 herder slots, `+3 cattle flat/season`, `+3 food flat/season`, `fertilityBonus: 0.03` |

**Requires:** T2 requires `cattle_pen`; T3 requires `meadow`; T4 requires `cattle_ranch`

---

### ─── ORCHARDS (Household, Additive) ───

**Chain ID:** `orchard`  
**Worker role:** `farmer` (orchard workers are skilled farmers applying their plants knowledge)  
**Flavour:** Produces food AND goods (fruit → traded goods, honey). Complements rather than competes directly with the Tilled Fields chain — a mixed-economy household might take T1 orchard + T1 fields rather than doubling down on either.

| Tier | BuildingId | Name | Cost | Seasons | Key Effects |
|---|---|---|---|---|---|
| T1 | `orchard` | Orchard | 8 lumber | 2 | `+1 food/farmer`, `+1 goods/farmer`, 3 farmer slots, `allowMultiple: false` |
| T2 | `berry_grove` | Berry Grove | 6 lumber | 2 | `+1 food/farmer`, `+1 goods/farmer`, +2 farmer slots |
| T3 | `beekeeper` | Beekeeper | 6 lumber, 4 goods | 2 | `+2 goods/farmer`, `+1 medicine flat/season` (herbal garden), +1 farmer slot |
| T4 | `grand_orchard` | Grand Orchard | 15 lumber, 8 stone, 10 gold | 3 | `+2 food/farmer`, `+2 goods/farmer`, +2 farmer slots, `+2 food flat`, `+2 goods flat`, `fertilityBonus: 0.03` |

**Requires:** T2 requires `orchard`; T3 requires `berry_grove`; T4 requires `beekeeper`

---

### ─── FORESTRIES (Communal, Upgrade/Replace) ───

**Chain ID:** `forestry`  
**Worker role:** `gather_lumber` (Lumberjack)  
**Bonus model:** Each tier replaces the previous; the building amplifies per-lumberjack output and expands worker slot cap.  
**Baseline `gather_lumber`** (no building): `gatherYield(custom)` = 1–3 lumber/season

| Tier | BuildingId | Name | Cost | Seasons | Key Effects |
|---|---|---|---|---|---|
| T1 | `logging_camp` | Logging Camp | 10 lumber, 2 stone | 2 | `+1 lumber/lumberjack`, 3 lumberjack slots |
| T2 | `charcoal_burners` | Charcoal Burners | 12 lumber, 4 stone | 2 | `+1 lumber/lumberjack`, `+1 goods/lumberjack`, 4 slots *(replaces T1)* |
| T3 | `wood_pasture` | Wood Pasture | 15 lumber, 6 stone | 3 | `+2 lumber/lumberjack`, `+1 goods/lumberjack`, `+2 lumber flat/season`, 5 slots *(replaces T2)* |
| T4 | `sawmill` | Sawmill | 20 lumber, 15 stone, 5 gold | 4 | `+3 lumber/lumberjack`, `+2 goods/lumberjack`, `+3 lumber flat/season`, 6 slots *(replaces T3)* |

**Requires:** T2 requires `logging_camp`; T3 requires `charcoal_burners`; T4 requires `wood_pasture`

---

### ─── HUNTING GROUNDS (Communal, Upgrade/Replace) ───

**Chain ID:** `hunting`  
**Worker role:** `hunter` *(new)*  
**Flavour:** Hunting produces food AND goods (pelts, hides) at higher tiers. Also scales up settlement defense slightly (skilled hunters = perimeter rangers).

| Tier | BuildingId | Name | Cost | Seasons | Key Effects |
|---|---|---|---|---|---|
| T1 | `hunters_lodge` | Hunter's Lodge | 8 lumber | 2 | `+1 food/hunter`, 3 hunter slots, `defenseBonus: 0.05` |
| T2 | `hound_pens` | Hound Pens | 12 lumber, 4 stone | 2 | `+2 food/hunter`, `+1 goods/hunter`, 4 slots, `defenseBonus: 0.05` *(replaces T1)* |
| T3 | `hunting_towers` | Hunting Towers | 15 lumber, 8 stone | 3 | `+2 food/hunter`, `+1 goods/hunter`, `+1 food flat/season`, 5 slots, `defenseBonus: 0.10` *(replaces T2)* |
| T4 | `hunting_reserve` | Hunting Reserve | 20 lumber, 12 stone, 8 gold | 4 | `+3 food/hunter`, `+2 goods/hunter`, `+2 food flat/season`, 6 slots, `defenseBonus: 0.15` *(replaces T3)* |

**skillGrowth:**  
- T1: `hunter → combat +1`  
- T2: `hunter → combat +1`, `hunter → animals +1`  
- T3: `hunter → combat +2`  
- T4: `hunter → combat +2`, `hunter → animals +1`

---

### ─── QUARRIES (Communal, Upgrade/Replace) ───

**Chain ID:** `quarry`  
**Worker role:** `gather_stone` (Quarrier)  
**Bonus model:** Each tier replaces the previous. Higher tiers also add steel output (mining ore veins).  
**Baseline `gather_stone`** (no building): `gatherYield(custom)` = 1–3 stone/season

| Tier | BuildingId | Name | Cost | Seasons | Key Effects |
|---|---|---|---|---|---|
| T1 | `stone_quarry` | Stone Quarry | 10 lumber, 5 stone | 2 | `+1 stone/quarrier`, 3 quarrier slots |
| T2 | `ore_mine` | Ore Mine | 15 lumber, 8 stone | 2 | `+2 stone/quarrier`, `+1 steel/quarrier`, 4 slots *(replaces T1)* |
| T3 | `large_quarry` | Large Quarry | 18 lumber, 10 stone | 3 | `+3 stone/quarrier`, `+1 steel/quarrier`, `+2 stone flat/season`, 5 slots *(replaces T2)* |
| T4 | `shaft_mine` | Shaft Mine | 25 lumber, 15 stone, 10 gold | 4 | `+4 stone/quarrier`, `+2 steel/quarrier`, `+3 stone flat/season`, `+1 steel flat/season`, 6 slots, `defenseBonus: 0.05` *(replaces T3)* |

**skillGrowth:** All tiers: `gather_stone → custom +1` (T3+T4: `+2`)

---

### ─── HOSPICES (Communal, Upgrade/Replace — extends `healers_hut`) ───

**Chain ID:** `hospice`  
**Worker role:** `healer`  
**Note:** `healers_hut` (T1, existing) gets `upgradeChainId: 'hospice', tierInChain: 1` added. T2–T4 replace it progressively.

| Tier | BuildingId | Name | Cost | Seasons | Key Effects |
|---|---|---|---|---|---|
| T1 | `healers_hut` *(existing)* | Healer's Hut | 8 lumber, 5 medicine | 1 | `childMortalityModifier: 0.5`, 2 healer slots |
| T2 | `infirmary` | Infirmary | 12 lumber, 6 stone, 4 medicine | 2 | `childMortalityModifier: 0.35`, `fertilityBonus: 0.05`, 3 healer slots *(replaces T1)* |
| T3 | `hospital` | Hospital | 18 lumber, 12 stone, 8 medicine | 3 | `childMortalityModifier: 0.25`, `fertilityBonus: 0.08`, `+2 medicine flat/season`, 4 healer slots *(replaces T2)* |
| T4 | `grand_hospital` | Grand Hospital | 25 lumber, 20 stone, 15 medicine, 5 gold | 4 | `childMortalityModifier: 0.15`, `fertilityBonus: 0.12`, `+4 medicine flat/season`, 5 healer slots *(replaces T3)* |

**skillGrowth:**  
- All tiers: `healer → plants +1`  
- T3+T4: `healer → plants +2`  
- T4 only: `healer → leadership +1` (running a hospital requires management)

---

## Implementation Steps

### Step 1 — `BuildingId` union expansion (`game-state.ts`)
Add 24 new BuildingId values. Keep all existing values. Mark clearly with comments by chain.

### Step 2 — `WorkRole` expansion (`person.ts`)
Add `'hunter'` to the `WorkRole` union.

### Step 3 — Role display (`role-display.ts`)
Add `hunter` entry:
- Label: `"Hunter"`  
- Color: `"bg-amber-800 text-amber-200"`

### Step 4 — Apprenticeship (`apprenticeship.ts`)
Add `'hunter'` to `TRAINABLE_TRADES` with `getTradeSkill` using `combat` for the hunter role.

### Step 5 — Resources production (`resources.ts`)
Add `hunter` production case in `calculateProduction`:
```typescript
case 'hunter': {
  const base = gatherYield(person.skills.combat ?? 25);
  personFood += base;  // base food from hunting
  break;
}
```
The `roleProductionBonus` from hunting buildings layers on top automatically.

### Step 6 — `Building catalog` (`building-definitions.ts`)
- Update `healers_hut`: add `upgradeChainId: 'hospice', tierInChain: 1`
- Update `mill`: change `upgradeChainId` from `'agriculture'` to `'milling'` (avoids T2 collision)
- Add all 24 new `BuildingDef` entries

### Step 7 — Building icons (`building-icons.tsx`)
Add SVG icon entries in the `ICONS` record for all 24 new BuildingIds. Use the existing fallback `<>…</>` pattern. Simple pictograms:
- `barns_storehouses`: pitched roof + horizontal ribs (barn)
- `farmstead`: house + fence + small windmill silhouette
- `grain_silo`: tall cylinder + hatch
- `cattle_pen`: fence uprights + cow-head profile
- `meadow`: undulating grass lines + sun arc
- `cattle_ranch`: wide fence + gateposts
- `stock_farm`: multiple pens + branded mark
- `orchard`: row of tree circles
- `berry_grove`: low shrub clusters
- `beekeeper`: hexagonal honeycomb cell pattern
- `grand_orchard`: larger tree rows + ornamental gate
- `logging_camp`: axe + stump
- `charcoal_burners`: cone kiln silhouette
- `wood_pasture`: trees + fence
- `sawmill`: circular saw blade
- `hunters_lodge`: antler silhouette + simple hut
- `hound_pens`: dog silhouette + fence
- `hunting_towers`: narrow tower + arrow
- `hunting_reserve`: trees + gate/barrier
- `stone_quarry`: angular shards of rock
- `ore_mine`: mine cart
- `large_quarry`: deeper angular cut with ladder
- `shaft_mine`: mine entrance arch
- `infirmary`: cross + cot outline
- `hospital`: large cross + multiple windows
- `grand_hospital`: grand cross + pillars

### Step 8 — Settlement view communal grid (`SettlementView.tsx`)
- Extract `CommunalBuildingGrid` component (3×4, mirrors the household grid section)
- Replace the existing `BuildingCard` list + build button in the left panel
- Wire click-on-empty → `BuildingPickerModal mode="communal"`
- Wire click-on-occupied → `SlotDetailPopover` (communal path — no household assignment needed for communal buildings)
- Keep the dwelling section below the new grid

### Step 9 — Tests
- `tests/buildings/building-catalog.test.ts`: Add smoke tests that all 24 new BuildingIds are in the catalog; check chain prerequisites are self-consistent
- `tests/economy/resources.test.ts`: Add `hunter` role tests (no building, with `hunters_lodge`, with `hunting_reserve`)
- `tests/buildings/building-effects.test.ts`: Add tests for new `workerSlots` values on new buildings

---

## Open Questions / Future Work

| Item | Note |
|---|---|
| Household-scoped production bonuses | Currently all `roleProductionBonus` values apply globally. A future pass should scope them to only benefit workers in the owning household. This would sharpen the specialization incentive. |
| Food variety / happiness | `hunter` currently produces generic `food`. When food types are split (meat / grain / fruit), hunters produce meat, farmers produce grain, orchardists produce fruit. This will be a meaningful happiness modifier. |
| `orchardist` role | Currently orchard workers are `farmer`. A future split could give them a dedicated role for cleaner skill separation. |
| Worker slot UI hints | `PeopleView` should show which production buildings each household owns to inform role assignment decisions. |
| Communal slot count | 12 slots handles all current and planned communal buildings (max currently ~10: camp + up to 9 communal production). If we ever exceed 12, expand to 15 (5×3). |
| `sawmill` construction cost reduction | CK3 sawmills reduce building time. Could add a `constructionSpeedBonus?: number` field to `BuildingDef` in the future. |

---

## Summary Table — All New BuildingIds

| BuildingId | Chain | Tier | Ownership | Replaces? |
|---|---|---|---|---|
| `barns_storehouses` | agriculture | 2 | household | — |
| `farmstead` | agriculture | 3 | household | — |
| `grain_silo` | agriculture | 4 | household | — |
| `cattle_pen` | pastoralism | 1 | household | — |
| `meadow` | pastoralism | 2 | household | — |
| `cattle_ranch` | pastoralism | 3 | household | — |
| `stock_farm` | pastoralism | 4 | household | — |
| `orchard` | orchard | 1 | household | — |
| `berry_grove` | orchard | 2 | household | — |
| `beekeeper` | orchard | 3 | household | — |
| `grand_orchard` | orchard | 4 | household | — |
| `logging_camp` | forestry | 1 | communal | — |
| `charcoal_burners` | forestry | 2 | communal | `logging_camp` |
| `wood_pasture` | forestry | 3 | communal | `charcoal_burners` |
| `sawmill` | forestry | 4 | communal | `wood_pasture` |
| `hunters_lodge` | hunting | 1 | communal | — |
| `hound_pens` | hunting | 2 | communal | `hunters_lodge` |
| `hunting_towers` | hunting | 3 | communal | `hound_pens` |
| `hunting_reserve` | hunting | 4 | communal | `hunting_towers` |
| `stone_quarry` | quarry | 1 | communal | — |
| `ore_mine` | quarry | 2 | communal | `stone_quarry` |
| `large_quarry` | quarry | 3 | communal | `ore_mine` |
| `shaft_mine` | quarry | 4 | communal | `large_quarry` |
| `infirmary` | hospice | 2 | communal | `healers_hut` |
| `hospital` | hospice | 3 | communal | `infirmary` |
| `grand_hospital` | hospice | 4 | communal | `hospital` |

# Design Doc — Food Scarcity, Household Buildings & Maintenance

**Status:** Approved for implementation
**Phase tag:** Misc (post-4.2 patch)

---

## Overview

This document covers six interconnected changes:

1. **Starvation System** — food hitting zero has progressive, punishing consequences
2. **Building Reclassifications** — `pottery`, `healers_hut`, and the entire **hunting chain** move from `communal` to `household`; the communal **hospice chain** is severed so it starts at `infirmary`
3. **New Household Buildings** — herb garden + apothecary (healing T2/T3), market stall + counting house (trader chain), smokehouse (hunter companion), dye works (tailor upgrade)
4. **`hunter` WorkRole** — currently used by building definitions but absent from the `WorkRole` union; must be added
5. **Food Building Ambitions** — extend `seek_production_building` to cover `hunter` and `healer` roles
6. **Maintenance Cost Revisions** — structural buildings pay lumber and/or stone; medical chain pays medicine; wealth-only costs reduced or removed where physical upkeep makes more sense

---

## System 1 — Starvation & Food Scarcity

### The Gap
`calculateConsumption` deducts `people.size` food per season. When food hits zero the engine clamps to 0 and nothing further happens. The `malnourished` `HealthCondition` exists on `Person` but is never applied.

### New GameState Field

```typescript
// in GameState (game-state.ts)
famineStreak: number;   // consecutive seasons in which end-of-turn food < 0 before clamping
```

Serialised as a plain number; `deserializeGameState` default: `?? 0`.

### Famine Check — where it runs

After the settlement resource stock is updated in the store's `endTurn` handler (or in a new helper called from `endTurn`), compare:

```typescript
const hungryThisSeason = (preDeltaFood + productionDelta.food - consumptionDelta.food) < 0;
const newFamineStreak = hungryThisSeason ? state.famineStreak + 1 : 0;
```

`preDeltaFood` = the food value *before* the turn's production/consumption deltas are applied. If the raw arithmetic would have gone negative (even though storage is clamped to 0), we have a hunger season.

### Consequences by Streak

| `famineStreak` | Consequence |
|---|---|
| **≥ 1** (just entered famine) | Apply `malnourished` health condition to every living person. Full happiness penalty (-25) already wired in `happiness.ts`. Inject programmatic event `fam_hunger_grips_settlement` (new, once per streak entry). |
| **= 2** (second consecutive season) | Inject `fam_families_consider_leaving` (new desertion event, uses existing desertion infrastructure — `getDepartingFamily`). |
| **≥ 3** (sustained famine) | Inject `fam_famine_deepens` (new — causes forced departures + child mortality modifier). Fire every season until resolved. |
| **returns to 0** (food surplus restored) | Remove `malnourished` from all persons. Set a `famineRecoveryTurn = currentTurn + 2` flag so the condition lingers 2 seasons before full clearance. |

### `famineRecoveryTurn`

```typescript
// in GameState
famineRecoveryTurn: number;  // turn on which malnourished is auto-cleared. 0 = no recovery pending.
```

Each dawn, if `currentTurn >= famineRecoveryTurn && famineRecoveryTurn > 0`, clear `malnourished` from all persons and reset `famineRecoveryTurn = 0`. A newly-entering famine (streak jumps from 0 to 1) overwrites any pending recovery turn.

### New Famine Events (in `src/simulation/events/definitions/famine.ts`)

All three are `isDeferredOutcome: false`, `isAmbient: false`, injected programmatically by the store — never drawn normally.

| EventId | Trigger | Effect |
|---|---|---|
| `fam_hunger_grips_settlement` | `famineStreak` becomes 1 | Player-facing warning. Choices: ration strictly (penalty to production multiplier for 2 seasons) or do nothing. |
| `fam_families_consider_leaving` | `famineStreak` becomes 2 | Uses `getDepartingFamily`. One household is flagged for departure unless player intervenes (uses existing desertion‐candidate infrastructure). |
| `fam_famine_deepens` | `famineStreak` >= 3, fires each season | Forced household departure + child mortality modifier applied via consequence. |

### Happiness Factor Addition

Add a tier to `computeHappinessFactors` in `happiness.ts`:
```
person.health.conditions.includes('malnourished') → already handled (-25)
```
No change needed — this factor already exists and fires correctly once the condition is applied.

### Production Debuff

When `famineStreak >= 1`, inject a settlement-wide production multiplier of `0.80` (20% penalty). Add to `calculateProduction` by accepting an optional `famineMultiplier: number = 1.0` parameter and applying it to `food` yield only (starvation impairs farming, not crafting).

---

## System 2 — Building Reclassifications

### 2a. Pottery Kiln (`pottery`) — communal → household

**Changes to `building-definitions.ts`:**
```typescript
pottery: {
  // ...existing fields unchanged...
  ownership: 'household',            // was 'communal'
  allowMultiple: true,               // new — multiple kilns may exist across households
  upgradeChainId: 'kiln',            // new — leaves room for a T2 in future
  tierInChain: 1,                    // new
  privateWealthCost: 3,              // new
  // add a small craftsman production bonus to incentivize staffing:
  roleProductionBonus: { role: 'craftsman', bonus: { wealth: 1 } },  // new
  // maintenance stays:
  maintenanceCost: { wealth: 1 },
}
```

**No changes required** to the `compound` or `bathhouse` prerequisites. Both use `requires: 'pottery'` which simply checks that *any* built building with `defId === 'pottery'` exists in `allBuildings`. Ownership is irrelevant to that check.

**Private economy:** Add `pottery` to `ROLE_TO_BUILDING` in `private-economy.ts`:
```typescript
craftsman: 'pottery',  // new entry (craftsmen without a kiln will seek one)
```

### 2b. Healers Hut (`healers_hut`) — household healing chain (new `'healing'` chain)

The `'hospice'` chain is **severed**. `healers_hut` becomes T1 of the new household `'healing'` chain.

**Changes to `healers_hut`:**
```typescript
healers_hut: {
  // ...costs and worker slots unchanged...
  ownership: 'household',            // was 'communal'
  allowMultiple: true,               // new
  upgradeChainId: 'healing',         // was 'hospice'
  tierInChain: 1,                    // unchanged
  privateWealthCost: 4,              // new
  // childMortalityModifier: 0.5 — unchanged
  // maintenanceCost: { wealth: 1 } — unchanged (updated later in section 6)
}
```

**Changes to `infirmary`:**
```typescript
infirmary: {
  // ...all stats unchanged...
  requires: undefined,               // was  'healers_hut' — severed
  replacesId: undefined,             // was 'healers_hut' — severed
  ownership: 'communal',             // unchanged
  upgradeChainId: 'hospice',         // unchanged
  tierInChain: 1,                    // was 2 — renumbered to T1
}
```

**Changes to `hospital`:**
```typescript
hospital: {
  // ...all stats unchanged...
  tierInChain: 2,   // was 3
}
```

**Changes to `grand_hospital`:**
```typescript
grand_hospital: {
  // ...all stats unchanged...
  tierInChain: 3,   // was 4
}
```

**Private economy:**
- Add `healer` to `ROLE_TO_PRODUCTION_CHAINS` in `private-economy.ts`:
  ```typescript
  healer: ['healers_hut', 'herb_garden', 'apothecary'],
  ```
- (The `herb_garden` and `apothecary` buildings are defined in System 3 below.)

### 2c. Hunting Chain — communal → household (upgrade-replace model)

All four buildings in the `'hunting'` chain change to `ownership: 'household'` and gain `allowMultiple: true` and `privateWealthCost`. The upgrade-replace semantics (`replacesId`/`requires`) are **preserved** — each hunter household has exactly one lodge at any time, upgrading by replacing.

| Building | `privateWealthCost` | Notes |
|---|---|---|
| `hunters_lodge` | 3 | Becomes household T1 |
| `hound_pens` | 5 | Requires + replaces `hunters_lodge` |
| `hunting_towers` | 8 | Requires + replaces `hound_pens` |
| `hunting_reserve` | 12 | Requires + replaces `hunting_towers` |

**All four need `allowMultiple: true`** (currently absent) so multiple hunter households can each own their own chain instance.

**The `defenseBonus` values stay** — watchtowers and reserves benefit the whole settlement even when privately owned.

**Private economy:**
- Add `hunter` to `ROLE_TO_PRODUCTION_CHAINS`:
  ```typescript
  hunter: ['hunters_lodge', 'hound_pens', 'hunting_towers', 'hunting_reserve'],
  ```
- Add `hunter` to `ROLE_TO_BUILDING` (base target, before chain logic):
  ```typescript
  hunter: 'hunters_lodge',
  ```

**`seek_production_building` trigger:** hunters without a lodge on their household already qualify once the chain mappings are added — no additional ambition logic changes needed beyond the mapping additions.

---

## System 3 — New Household Buildings

Six new `BuildingId` values. All are `ownership: 'household'`. Add each to the `BuildingId` union.

### 3a. Herb Garden (`herb_garden`) — healing chain T2

Extends the household healing chain following `healers_hut`.

```typescript
herb_garden: {
  id: 'herb_garden',
  name: 'Herb Garden',
  description: 'Cultivated medicinal plants grown behind the healer\'s hut. Regular harvests supply the household and supplement the settlement stockpile.',
  category: 'social',
  hasStyleVariants: false,
  cost: { lumber: 10, medicine: 3 },
  buildSeasons: 2,
  requires: 'healers_hut',
  replacesId: 'healers_hut',
  shelterCapacity: 0,
  childMortalityModifier: 0.4,
  roleProductionBonus: { role: 'healer', bonus: { medicine: 1, wealth: 1 } },
  flatProductionBonus: { medicine: 1 },
  skillGrowth: [{ role: 'healer', skill: 'plants', bonus: 1 }],
  workerSlots: 2,
  workerRole: 'healer',
  allowMultiple: true,
  ownership: 'household',
  upgradeChainId: 'healing',
  tierInChain: 2,
  privateWealthCost: 5,
  maintenanceCost: { medicine: 1 },
}
```

### 3b. Apothecary (`apothecary`) — healing chain T3

```typescript
apothecary: {
  id: 'apothecary',
  name: 'Apothecary',
  description: 'A dedicated dispensary with drying racks, mortar stations, and a reference library of remedies. The household healer here rivals a trained infirmarian.',
  category: 'social',
  hasStyleVariants: false,
  cost: { lumber: 15, stone: 6, medicine: 8 },
  buildSeasons: 3,
  requires: 'herb_garden',
  replacesId: 'herb_garden',
  shelterCapacity: 0,
  childMortalityModifier: 0.3,
  roleProductionBonus: { role: 'healer', bonus: { medicine: 2, wealth: 1 } },
  flatProductionBonus: { medicine: 2 },
  skillGrowth: [{ role: 'healer', skill: 'plants', bonus: 2 }],
  workerSlots: 3,
  workerRole: 'healer',
  allowMultiple: true,
  ownership: 'household',
  upgradeChainId: 'healing',
  tierInChain: 3,
  privateWealthCost: 8,
  maintenanceCost: { medicine: 2 },
}
```

> **Malnourished recovery:** Any settlement with at least one built `apothecary` halves the famine recovery delay from 2 seasons to 1 (applied in the recovery logic from System 1). This is a flag check, not a production bonus — add `malnourishedRecoveryBonus?: boolean` to `BuildingDef` and set it `true` on `apothecary`.

### 3c. Market Stall (`market_stall`) — trader chain T1

Traders currently have no household building. Market stall gives the trader role a meaningful private investment target.

```typescript
market_stall: {
  id: 'market_stall',
  name: 'Market Stall',
  description: 'A permanent trading pitch with display shelving and a lockable cash box. A trader working from their own stall earns a reliable premium.',
  category: 'industry',
  hasStyleVariants: false,
  cost: { lumber: 8, wealth: 3 },
  buildSeasons: 1,
  requires: 'trading_post',   // communal prerequisite — market must precede private stall
  shelterCapacity: 0,
  roleProductionBonus: { role: 'trader', bonus: { wealth: 2 } },
  skillGrowth: [{ role: 'trader', skill: 'bargaining', bonus: 1 }],
  workerSlots: 2,
  workerRole: 'trader',
  allowMultiple: true,
  ownership: 'household',
  upgradeChainId: 'commerce',
  tierInChain: 1,
  privateWealthCost: 4,
  maintenanceCost: { wealth: 1 },
}
```

### 3d. Counting House (`counting_house`) — trader chain T2

```typescript
counting_house: {
  id: 'counting_house',
  name: 'Counting House',
  description: 'A proper merchant\'s office with ledgers, strongboxes, and a reception room. Wealth flows through this household like water.',
  category: 'industry',
  hasStyleVariants: false,
  cost: { lumber: 15, stone: 8, wealth: 8 },
  buildSeasons: 2,
  requires: 'market_stall',
  replacesId: 'market_stall',
  shelterCapacity: 0,
  roleProductionBonus: { role: 'trader', bonus: { wealth: 4 } },
  flatProductionBonus: { wealth: 1 },
  skillGrowth: [
    { role: 'trader', skill: 'bargaining', bonus: 1 },
    { role: 'trader', skill: 'leadership', bonus: 1 },
  ],
  workerSlots: 3,
  workerRole: 'trader',
  allowMultiple: true,
  ownership: 'household',
  upgradeChainId: 'commerce',
  tierInChain: 2,
  privateWealthCost: 8,
  maintenanceCost: { wealth: 1 },
}
```

**Private economy:** Add `trader` to `ROLE_TO_PRODUCTION_CHAINS`:
```typescript
trader: ['market_stall', 'counting_house'],
```
Add `trader` to `ROLE_TO_BUILDING`:
```typescript
trader: 'market_stall',
```

### 3e. Smokehouse (`smokehouse`) — hunter companion (additive, not in chain)

Standalone additive building for hunter households. Does **not** replace the lodge; it stacks alongside the chain.

```typescript
smokehouse: {
  id: 'smokehouse',
  name: 'Smokehouse',
  description: 'Curing racks and a slow-fire chamber. Raw game is smoked into preserved meat — valuable food stock that keeps through winter, and smoked hides that fetch good prices.',
  category: 'food',
  hasStyleVariants: false,
  cost: { lumber: 8, stone: 4 },
  buildSeasons: 1,
  requires: 'hunters_lodge',
  shelterCapacity: 0,
  roleProductionBonus: { role: 'hunter', bonus: { food: 1, wealth: 1 } },
  flatProductionBonus: { food: 1 },
  skillGrowth: [{ role: 'hunter', skill: 'animals', bonus: 1 }],
  workerSlots: 2,
  workerRole: 'hunter',
  allowMultiple: true,
  ownership: 'household',
  upgradeChainId: null,
  tierInChain: null,
  privateWealthCost: 3,
  maintenanceCost: { lumber: 1 },
}
```

**Private economy:** Add `'smokehouse'` as a secondary target for hunter households in `getNextHouseholdProductionTarget` — pursued *after* the current lodge tier is built but before upgrading to the next tier. The safest implementation is a secondary chain lookup: after resolving the main hunting chain target, if the household has any lodge tier but no smokehouse, return `'smokehouse'`.

### 3f. Dye Works (`dye_works`) — tailor chain T2

Replaces the tannery in the `'leatherwork'` chain.

```typescript
dye_works: {
  id: 'dye_works',
  name: 'Dye Works',
  description: 'Dyeing vats, copper mordant pots, and a drying yard. The tailor who owns a proper dye works commands premium prices — vivid cloth sells itself.',
  category: 'industry',
  hasStyleVariants: false,
  cost: { lumber: 12, stone: 6, wealth: 6 },
  buildSeasons: 2,
  requires: 'tannery',
  replacesId: 'tannery',
  shelterCapacity: 0,
  roleProductionBonus: { role: 'tailor', bonus: { wealth: 5 } },
  skillGrowth: [{ role: 'tailor', skill: 'custom', bonus: 2 }],
  workerSlots: 2,
  workerRole: 'tailor',
  allowMultiple: true,
  ownership: 'household',
  upgradeChainId: 'leatherwork',
  tierInChain: 2,
  privateWealthCost: 7,
  maintenanceCost: { stone: 1, wealth: 1 },
}
```

Update `ROLE_TO_PRODUCTION_CHAINS` for tailor:
```typescript
tailor: ['tannery', 'dye_works'],
```

---

## System 4 — `hunter` WorkRole

The `hunter` role is already used by six building definitions (`workerRole: 'hunter'`) but **does not exist in the `WorkRole` union**. This must be corrected.

### Files to update

| File | Change |
|---|---|
| `src/simulation/population/person.ts` | Add `'hunter'` to the `WorkRole` union |
| `src/ui/shared/role-display.ts` | Add `hunter: 'Hunter'` to `ROLE_LABELS`; add `hunter: 'text-amber-600 bg-amber-50'` (suggested colour) to `ROLE_COLORS` |
| `src/simulation/population/apprenticeship.ts` | Add `'hunter'` to `TRAINABLE_TRADES` |
| `src/simulation/population/happiness.ts` | The purpose-factor role check should already handle `hunter` generically; verify no hard-coded exclusions |

No changes required to `findAvailableWorkerSlotIndex` — it accepts any string.

---

## System 5 — Food Building Ambitions

The `seek_production_building` ambition (type 12) fires when a specialist worker's household has no matching production building. It is driven by `getNextHouseholdProductionTarget` + `ROLE_TO_PRODUCTION_CHAINS` / `ROLE_TO_BUILDING` maps in `private-economy.ts`.

The chain-mapping additions in Systems 2b, 2c, 3c–3d already cover this fully. No changes to `ambitions.ts` or the ambition firing logic itself are required — the lookup maps drive everything.

**Verify these entries are present in `private-economy.ts` after implementation:**

```typescript
// ROLE_TO_BUILDING (base entry for chain start)
pottery:         'pottery',
healer:          'healers_hut',
hunter:          'hunters_lodge',
trader:          'market_stall',
craftsman:       'pottery',     // already: 'workshop' — decide which takes priority

// ROLE_TO_PRODUCTION_CHAINS (full upgrade paths)
healer:  ['healers_hut', 'herb_garden', 'apothecary'],
hunter:  ['hunters_lodge', 'hound_pens', 'hunting_towers', 'hunting_reserve'],
trader:  ['market_stall', 'counting_house'],
tailor:  ['tannery', 'dye_works'],
```

> **Craftsman note:** craftsmen can target either the communal `workshop` (already exists) or the new household `pottery`. The safest integration: `pottery` is added as a secondary target — pursued after `workshop` is built. `ROLE_TO_BUILDING` remains `'workshop'`; `pottery` is handled by a separate secondary-target lookup.

---

## System 6 — Maintenance Cost Revisions

All costs represent **physical upkeep** only (structural repairs, tool replacement). Input-to-output resource conversion stays in craft recipes.

The following table shows the changes. Only modified buildings are listed; all others are unchanged.

### Civic / Social (communal)

| Building | Current `maintenanceCost` | New `maintenanceCost` | Rationale |
|---|---|---|---|
| `longhouse` | `{ wealth: 1 }` | `{ lumber: 1, wealth: 1 }` | Timber hall rots; needs annual repair |
| `roundhouse` | `{ wealth: 1 }` | `{ lumber: 1 }` | Wattle-and-daub needs re-daubing |
| `great_hall` | `{ wealth: 2 }` | `{ lumber: 1, stone: 1 }` | Timber joists + mortared wall repairs |
| `clan_lodge` | `{ wealth: 1 }` | `{ lumber: 1 }` | Same as roundhouse |
| `gathering_hall` | `{ wealth: 1 }` | `{ lumber: 1 }` | Social hall, timber-framed |
| `palisade` | `{ lumber: 1 }` | `{ lumber: 2 }` | Stakes rot quickly; frequent replacement |

### Food & Storage (communal/household)

| Building | Current | New | Rationale |
|---|---|---|---|
| `granary` | `{ wealth: 1 }` | `{ lumber: 1 }` | Elevated timber floor needs replacement |
| `barns_storehouses` | *(none)* | `{ lumber: 1 }` | New; barn roof/wall upkeep |
| `farmstead` | *(none)* | `{ lumber: 1 }` | New; multiple outbuildings |
| `stable` | `{ lumber: 1 }` | `{ lumber: 1 }` | Unchanged |

### Industry (communal/household)

| Building | Current | New | Rationale |
|---|---|---|---|
| `mill` | `{ wealth: 1 }` | `{ stone: 1 }` | Millstones wear and must be re-dressed |
| `smithy` | `{ wealth: 1 }` | `{ stone: 1, wealth: 1 }` | Forge lining + tong/bellows replacement |
| `logging_camp` | *(none)* | `{ lumber: 1 }` | Tool shed and equipment upkeep |
| `charcoal_burners` | *(none)* | `{ lumber: 1 }` | Kiln clay resealing |
| `wood_pasture` | *(none)* | `{ lumber: 1 }` | Coppice management infrastructure |
| `sawmill` | *(none)* | `{ lumber: 1, stone: 1 }` | Waterwheel paddles + foundation |
| `stone_quarry` | *(none)* | `{ stone: 1 }` | Scaffolding and tool steel |
| `ore_mine` | *(none)* | `{ stone: 1, lumber: 1 }` | Timbering, pumps |
| `large_quarry` | *(none)* | `{ stone: 1, lumber: 1 }` | Crane rope + frame |
| `shaft_mine` | *(none)* | `{ stone: 2, lumber: 1 }` | Deepest mine; highest upkeep |

### Hunting Chain (now household)

| Building | New `maintenanceCost` |
|---|---|
| `hunters_lodge` | `{ lumber: 1 }` |
| `hound_pens` | `{ lumber: 1 }` |
| `hunting_towers` | `{ lumber: 1, stone: 1 }` |
| `hunting_reserve` | `{ lumber: 1, stone: 1 }` |

### Hospice Chain (communal, now starts at infirmary)

| Building | Current | New | Rationale |
|---|---|---|---|
| `infirmary` | *(none)* | `{ medicine: 1, wealth: 1 }` | Medical supply restocking |
| `hospital` | *(none)* | `{ medicine: 2, wealth: 1 }` | Larger stock, more staff |
| `grand_hospital` | *(none)* | `{ medicine: 3, wealth: 2 }` | Full institution |

---

## Summary: Files to Touch

| File | Change category |
|---|---|
| `src/simulation/turn/game-state.ts` | Add `famineStreak`, `famineRecoveryTurn` fields; add new `BuildingId` values; add `'hunter'` to `WorkRole`; add `malnourishedRecoveryBonus?: boolean` to `BuildingDef` |
| `src/simulation/buildings/building-definitions.ts` | Reclassify 4 buildings; update infirmary/hospital/grand_hospital chain numbers; add 6 new buildings; revise ~20 maintenance cost entries |
| `src/simulation/economy/private-economy.ts` | Extend `ROLE_TO_BUILDING`, `ROLE_TO_PRODUCTION_CHAINS`; add smokehouse secondary-target logic |
| `src/simulation/economy/resources.ts` | Add `famineMultiplier` parameter to `calculateProduction` |
| `src/simulation/turn/turn-processor.ts` | Wire starvation check into dawn (apply/remove `malnourished`); pass `famineMultiplier` to `calculateProduction`; call famine event injection |
| `src/stores/game-store.ts` | Track `famineStreak`/`famineRecoveryTurn` on resource application; inject famine events; `deserializeGameState` defaults |
| `src/simulation/population/person.ts` | Add `'hunter'` to `WorkRole` union |
| `src/ui/shared/role-display.ts` | Add `hunter` label + colour |
| `src/simulation/population/apprenticeship.ts` | Add `hunter` to `TRAINABLE_TRADES` |
| `src/simulation/events/definitions/famine.ts` | New file — 3 famine events |

---

## New `BuildingId` Values (add to union)

```typescript
| 'herb_garden'
| 'apothecary'
| 'market_stall'
| 'counting_house'
| 'smokehouse'
| 'dye_works'
```

## Tests to Write

- **Starvation:** famine streak increment/reset, malnourished apply/clear, recovery delay, famine event injection gates
- **Reclassified buildings:** `canBuild` accepts household pottery/healers_hut/hunters_lodge; `applyDwellingClaims` Pass 3 unaffected; compound/bathhouse prerequisite still passes when household pottery exists
- **New buildings:** chain resolution for healer (`healers_hut → herb_garden → apothecary`), trader (`market_stall → counting_house`), hunting + smokehouse additive target; all 6 new IDs in the catalog
- **`hunter` WorkRole:** label/colour present; apprenticeship trade skill lookup; slot caps enforced
- **Maintenance:** revised costs appear in `applyBuildingMaintenance` output; neglected flag fires correctly when stone/lumber is scarce

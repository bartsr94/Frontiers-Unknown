# Settlement UI Overhaul — Design Document

**Version:** 1.0  
**Status:** Ready for Implementation  
**Scope:** Settlement tab redesign, new Production tab, Religion migration to Community tab

---

## 1. Summary of Changes

| Change | Details |
|--------|---------|
| **Religion** panel | Moved from Settlement → Community tab |
| **Factions + Activity Feed** | Already in Community — remove duplicates from Settlement |
| **Crafting** panel | Becomes a new top-level tab: **Production** |
| **Settlement tab** | Fully redesigned: info panel left + communal buildings + household grid right |

---

## 2. Navigation Changes

### New `View` added to `LeftNav.tsx`

```
'settlers' | 'events' | 'settlement' | 'production' | 'trade' | 'community' | 'diplomacy' | 'map' | 'chronicle'
```

New entry in `NAV_ITEMS`:
```ts
{ id: 'production', emoji: '⚒', label: 'Production' }
```

Position: after `settlement`, before `trade`.

### `GameScreen.tsx` addition
```ts
case 'production': return <ProductionView />;
```

---

## 3. Community Tab — Additions

### Religion moved here

The `ReligionPanel`, `CourtshipPanel`, `CourtshipNudgeBanner`, and `IdentityScale` components are relocated from `SettlementView` into `CommunityView`. They sit in a new fourth panel to the right of the activity feed, or as a collapsible sidebar.

The Religion section heading, policy selector, courtship selector, Hidden Wheel progress, and IdentityScale widget all transfer as-is.

---

## 4. Production Tab — `ProductionView.tsx`

A new standalone view. At Phase 1 of this overhaul it is a straight move of `CraftingPanel` from `SettlementView`, renamed to Production. No logic changes. The design doc for expanding production (specialisation orders, batch crafting, etc.) will be a separate document.

**Layout:** Single-column, full-width card list. Header reads "Production". The existing `CraftingPanel` sub-component becomes the body.

---

## 5. Settlement Tab — Redesigned Layout

### Overall structure

```
┌─────────────────┬──────────────────────────────────────────────────┐
│  LEFT PANEL     │  RIGHT PANEL (scrollable grid of households)     │
│  (fixed w-72)   │                                                  │
│  Settlement     │  ┌───────────────┐ ┌───────────────┐ ┌───────┐  │
│  info header    │  │ House Orsthal │ │ House Tivari  │ │  ...  │  │
│                 │  │ ┌─┬─┬─┐      │ │ ┌─┬─┬─┐      │ │       │  │
│  Communal       │  │ │▪│▪│+│      │ │ │▪│+│+│      │ │       │  │
│  buildings      │  │ ├─┼─┼─┤      │ │ ├─┼─┼─┤      │ │       │  │
│  (list)         │  │ │+│+│+│      │ │ │+│+│+│      │ │       │  │
│                 │  │ ├─┼─┼─┤      │ │ ├─┼─┼─┤      │ │       │  │
│  Construction   │  │ │+│+│+│      │ │ │+│+│+│      │ │       │  │
│  queue          │  │ └─┴─┴─┘      │ │ └─┴─┴─┘      │ │       │  │
│                 │  └───────────────┘ └───────────────┘ └───────┘  │
└─────────────────┴──────────────────────────────────────────────────┘
```

The right panel wraps household cards in a responsive `flex-wrap` row, scrollable vertically if there are many households.

---

## 6. Left Panel — Settlement Info

### 6.1 Info Header (CK3-inspired)

Displays at the top of the left panel with the settlement name as a bold heading and key stats below in a compact grid.

```
ASHMARK SETTLEMENT          [✎ rename]
────────────────────────────────────
Population    14 / 30 shelter
Morale        ▓▓▓▓░░░ Content
Company       ★★★★░ Standing: 72
Season        ❄ Winter · Year III
```

**Stats shown:**
- Population count vs shelter cap (with overcrowding colour coding — green/amber/red)
- Settlement morale label and mini bar (from `computeSettlementMorale` / `lastSettlementMorale`)
- Company standing score (0–100) with a simple star row or numeric display
- Current season + year (already computed, just lifted from the existing left area)

### 6.2 Communal Buildings Section

Below the info header, a labelled list of standing buildings whose `ownership === 'communal'`.  
Each entry shows: building icon (SVG) · display name · any active worker count.

A row of `+` icon buttons at the bottom lets the player queue new communal buildings (opens the **Communal Building Picker** — see §9).

If no communal buildings yet (only the Camp): show a single greyed "Camp" entry.

### 6.3 Construction Queue

Below the communal buildings, the existing `ConstructionCard` list appears for all in-progress projects (both communal and household). This consolidates construction visibility to a single place.

Worker assignment controls remain the same.

---

## 7. Right Panel — Household Grids

### 7.1 Household Card

Each household is represented by a card. Cards are laid out in a horizontal wrapping row, each card ~180–200px wide.

```
┌──────────────────────────┐
│  HOUSE ORSTHAL        ⚙  │  ← household name + settings icon
│  ━━━━━━━━━━━━━━━━━━━━━   │
│  ┌────┬────┬────┐        │
│  │[🏠]│[⚒] │[  ]│        │
│  │ T2 │ T1 │ +  │        │
│  ├────┼────┼────┤        │
│  │[  ]│[  ]│[  ]│        │
│  │ +  │ +  │ +  │        │
│  ├────┼────┼────┤        │
│  │[  ]│[  ]│[  ]│        │
│  │ +  │ +  │ +  │        │
│  └────┴────┴────┘        │
│  2 members · 2 buildings │
└──────────────────────────┘
```

- **Occupied slot:** SVG building icon centred in a stone-coloured square. Tier number in the bottom-right corner (amber text). Clicking opens the **Slot Detail popover** (upgrade / demolish).
- **Empty slot:** `+` glyph centred in a slightly darker square. Clicking opens the **Household Building Picker**.

### 7.2 Slot Detail Popover

When an occupied slot is clicked, a small popover/tooltip card appears above it:

```
Cottage                    ×
──────────────────────────
Tier 2 of 4 · Dwelling
Capacity: 6 people
Claimed by this household.
──────────────────────────
[Upgrade → Homestead]  [Demolish]
```

- **Upgrade** button appears only if a next tier exists for that building and the settlement has the resources. Clicking queues the upgrade as a `ConstructionProject`.
- **Demolish** removes the building (50% resource refund, same as current cancel mechanic) with a confirmation step.

### 7.3 Settler Count Badge

Below the grid, show the number of household members and total buildings for context.

---

## 8. Building Ownership Classification

A new field `ownership: 'communal' | 'household'` is added to `BuildingDef`. This controls:
- Whether the building appears in the Communal Picker (left panel) or Household Picker (right panel)
- Whether it can be placed in a household grid slot

### Communal Buildings (settlement-owned)

| BuildingId | Category |
|-----------|----------|
| `camp` | Civic (starting, not user-buildable) |
| `longhouse` | Civic |
| `roundhouse` | Civic |
| `great_hall` | Civic |
| `clan_lodge` | Civic |
| `granary` | Food |
| `gathering_hall` | Social |
| `palisade` | Defence |
| `trading_post` | Industry |
| `healers_hut` | Social |
| `workshop` | Industry |
| `bathhouse` | Social |
| `bathhouse_improved` | Social |
| `bathhouse_grand` | Social |

### Household Buildings (private ownership, placeable in 3×3 grid)

| BuildingId | Chain | Tier |
|-----------|-------|------|
| `wattle_hut` | Dwelling | 1 |
| `cottage` | Dwelling | 2 |
| `homestead` | Dwelling | 3 |
| `compound` | Dwelling | 4 |
| `fields` | Agriculture | 1 |
| `mill` | Agriculture | 2 |
| `stable` | Livestock | 1 |
| `smithy` | Metalwork | 1 |
| `tannery` | Leatherwork | 1 |
| `brewery` | Brewing | 1 |

> **Design note:** The `stable`, `smithy`, `tannery`, and `brewery` currently have only one tier. Adding tier 2 and tier 3 variants is deferred to a follow-up pass; for now they display "T1" and the Upgrade button is greyed out ("Fully upgraded").

---

## 9. Tier System

### 9.1 Definition

A new pair of fields on `BuildingDef`:

```ts
upgradeChainId?: string;   // groups buildings into the same chain family
tierInChain?: number;      // 1-indexed position within that chain
```

A building with no `upgradeChainId` is standalone (tier 1, no upgrades available).

### 9.2 Upgrade Chain Definitions

| Chain ID | Buildings in order |
|----------|-------------------|
| `dwelling` | wattle_hut(1) → cottage(2) → homestead(3) → compound(4) |
| `agriculture` | fields(1) → mill(2) |
| `livestock` | stable(1) |
| `metalwork` | smithy(1) |
| `leatherwork` | tannery(1) |
| `brewing` | brewery(1) |
| `civic` | camp(1) → longhouse/roundhouse(2) → great_hall/clan_lodge(3) |
| `bathhouse` | bathhouse(1) → bathhouse_improved(2) → bathhouse_grand(3) |

> The civic and bathhouse chains already use `replacesId`/`requires` fields — the tier metadata is additive and doesn't change the existing construction logic.

### 9.3 Tier Display

The tier is shown as a small bold number in the bottom-right corner of each occupied slot:
- Tier 1: amber text on stone background
- Tier 2: bright amber
- Tier 3–4: gold / white

### 9.4 Upgrade Flow

1. Player clicks occupied slot → Slot Detail popover with **Upgrade** button
2. Upgrade button calls the existing `startConstruction(nextTierId, ...)` — no new game logic needed
3. While the upgrade is in construction, the slot shows the *current* building plus a "⬆ upgrading" badge
4. On construction completion, `applyDwellingClaims` propagates the new claim — same as today

---

## 10. Building Picker Modal

Two variants share the same `BuildingPickerModal` component, configured by a `mode` prop:

```ts
type PickerMode = 'communal' | 'household';
```

### Layout

```
┌─────────────────────────────────────────────────┐
│  Build for [House Orsthal]                    × │
│  ──────────────────────────────────────────────  │
│  [Civic] [Food] [Industry] [Social] [Defence]   │  ← category filter tabs
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │ 🏠 Cottage                       Tier 2  │   │
│  │ A proper timber-framed cottage…           │   │
│  │ Cost: 8 lumber, 4 stone  ·  2 seasons    │   │
│  │                                           │   │
│  │ Quantity: [−] 2 [+]    (slots left: 7)   │   │
│  │                         [Queue Building] │   │
│  └──────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────┐   │
│  │ 🌾 Tilled Fields                 Tier 1  │   │
│  │ …                                         │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

- **Quantity selector** only appears for buildings with `allowMultiple: true`
- Quantity is capped at `remainingSlots` (empty slots in the 3×3 grid for household mode)
- Buildings where `canBuild` returns `ok: false` are shown greyed out with the reason
- Buildings already at max tier in a chain show "Fully upgraded" and are disabled
- **For communal mode:** no quantity selector; no household grid slot needed; standard 1-per-build

### Queue action

Clicking "Queue Building" queues N separate `ConstructionProject` entries (one per building), assigns them to the household (communal buildings pass `ownerHouseholdId: null`), and closes the modal. Feedback toast shown.

---

## 11. SVG Building Icons

A new file `src/ui/components/building-icons.tsx` exports a `BuildingIcon` component:

```ts
function BuildingIcon({ id, size? }: { id: BuildingId; size?: number })
```

Each icon is a simple inline SVG, ~24×24px by default, using a limited color palette (stone-300 strokes on transparent fill, amber accents for rooftops etc.). 

**Initial icon set** (12 icons for household-eligible buildings):

| BuildingId | Visual concept |
|-----------|---------------|
| `wattle_hut` | Simple A-frame roof + dot for door |
| `cottage` | Two-window box with pitched roof |
| `homestead` | Wider box, two windows, chimney line |
| `compound` | Square outer wall outline + inner box |
| `fields` | Three horizontal lines (furrows) |
| `mill` | Circle + four spokes (millwheel) |
| `stable` | Wide shallow roof over rectangle |
| `smithy` | Anvil silhouette |
| `tannery` | Barrel silhouette |
| `brewery` | Two barrels |

**Communal building icons** (secondary priority, displayed in left panel list):

| BuildingId | Visual concept |
|-----------|---------------|
| `longhouse` / `roundhouse` | Long rectangle or circle with roof line |
| `granary` | Cylinder with dome top |
| `workshop` | Gear/hammer cross |
| `trading_post` | Flag on a post |
| `palisade` | Three vertical spikes |
| `healers_hut` | Cross symbol |
| `gathering_hall` | Wide roof with people dots |
| `bathhouse` | Wavy water line in a rectangle |

---

## 12. Data Model Changes

### 12.1 `BuildingDef` additions (`building-definitions.ts`)

```ts
/**
 * Whether this building is communal (settlement-owned) or can be placed
 * in a household's private building grid.
 * Defaults to 'communal' if omitted (safe fallback for future buildings).
 */
ownership?: 'communal' | 'household';

/**
 * Upgrade chain identifier. Groups buildings into a progression.
 * E.g. 'dwelling' groups wattle_hut → cottage → homestead → compound.
 */
upgradeChainId?: string;

/**
 * 1-indexed position within the upgrade chain.
 * 1 = base tier, 2 = first upgrade, etc.
 */
tierInChain?: number;
```

### 12.2 `Household` additions (`game-state.ts`)

```ts
/**
 * 9-slot grid of BuiltBuilding instanceIds (or null for empty slots).
 * Index 0–8 maps top-left to bottom-right across the 3×3 grid.
 * Replaces the previous dwellingBuildingId + productionBuildingIds model.
 */
buildingSlots: (string | null)[];
```

**Migration:** On save load, if `buildingSlots` is missing (`undefined`), `deserializeHousehold` reconstructs it:
- Slot 0 ← `dwellingBuildingId` (if set)
- Slots 1–8 ← `productionBuildingIds[0..7]` (if set)
- Remaining slots ← `null`

The old fields `dwellingBuildingId` and `productionBuildingIds` remain on the interface as `@deprecated` for one release cycle, then can be removed.

### 12.3 New store actions (`game-store.ts`)

```ts
/**
 * Queue a construction project for a household slot.
 * @param householdId Target household (null = communal)
 * @param slotIndex   0–8 for household, ignored for communal
 * @param defId       Building to build
 * @param style       Style variant or null
 * @param quantity    Number of identical projects to queue (allowMultiple only)
 */
buildForHousehold(householdId: string | null, slotIndex: number, defId: BuildingId, style: BuildingStyle | null, quantity: number): void;

/**
 * Demolish a household building by slot index.
 * Applies 50% resource refund. Removes from household.buildingSlots.
 */
demolishHouseholdBuilding(householdId: string, slotIndex: number): void;

/**
 * Upgrade a household building to the next tier in its chain.
 * Queues a ConstructionProject. The slot still shows the old building
 * until the project completes; upgrades use the existing replacesId mechanic.
 */
upgradeHouseholdBuilding(householdId: string, slotIndex: number): void;
```

### 12.4 `applyDwellingClaims` update

The existing `applyDwellingClaims` pass-3 logic currently propagates `person.claimedBuildingId` from `household.dwellingBuildingId`. It will be updated to scan `household.buildingSlots` for any dwelling-category building instead.

---

## 13. New UI Component Tree

```
SettlementView.tsx
├── SettlementInfoPanel (left column)
│   ├── SettlementHeader (name, rename button)
│   ├── SettlementStatGrid (pop, shelter, morale, company, season)
│   ├── CommunalBuildingsList
│   │   ├── CommunalBuildingRow (icon, name, worker count)
│   │   └── AddCommunalBuildingButton → BuildingPickerModal(mode='communal')
│   └── ConstructionQueue (existing ConstructionCard list)
└── HouseholdGridPanel (right column, flex-wrap)
    └── HouseholdCard (×N households)
        ├── HouseholdHeader (name, settings)
        ├── HouseholdBuildingGrid (3×3)
        │   ├── OccupiedSlot (icon, tier badge) → SlotDetailPopover
        │   └── EmptySlot (+) → BuildingPickerModal(mode='household')
        └── HouseholdFooter (member count, building count)

BuildingPickerModal.tsx (shared, mode-switched)
BuildingIcon.tsx (SVG icon per BuildingId)
SlotDetailPopover.tsx (upgrade/demolish actions)

ProductionView.tsx (new top-level view, wraps existing CraftingPanel renamed)
```

---

## 14. Communal Building Construction UX

The left panel's "add communal building" button renders as a simple `+` row button at the bottom of the communal buildings list:

```
Camp              [civic]
Granary           [food]
────────────────────────────
[+ Build communal building]
```

Clicking opens `BuildingPickerModal(mode='communal')`, which shows only `ownership === 'communal'` buildings, filters through the existing `canBuild` logic, and queues via the standard `startConstruction` action.

---

## 15. Implementation Phases

Given the scope, implementation is split across phases to keep the codebase always-compilable and always-testable.

### Phase A — Tab Reorganisation (no UI redesign)
1. Add `production` to `View` union in `LeftNav.tsx` + `GameScreen.tsx` ✅
2. Create `ProductionView.tsx` (copy of current CraftingPanel, renamed heading) ✅
3. Add Religion/Courtship/IdentityScale to `CommunityView.tsx` as a new right-side panel ✅
4. Remove Religion, Factions, and Activity Feed from `SettlementView.tsx` 🔶
5. Confirm zero compile errors, all tests pass

### Phase B — Data Model
1. Add `ownership`, `upgradeChainId`, `tierInChain` to all `BuildingDef` entries
2. Add `buildingSlots: (string | null)[]` to `Household` interface
3. Update `createHousehold` to initialize `buildingSlots: Array(9).fill(null)`
4. Add migration in `deserializeHousehold` for old saves
5. Add `buildForHousehold`, `demolishHouseholdBuilding`, `upgradeHouseholdBuilding` to the store
6. Update `applyDwellingClaims` to scan `buildingSlots` for dwellings
7. Update tests — `dwelling-claims.test.ts` for `buildingSlots` migration path

### Phase C — SVG Icons
1. Create `src/ui/components/building-icons.tsx` with all 18 icons
2. No game logic changes

### Phase D — New Settlement UI
1. Rewrite `SettlementView.tsx` with two-column layout
2. `SettlementInfoPanel` with header, stats, communal list, construction queue
3. `HouseholdGridPanel` with wrapping household cards
4. `HouseholdCard` with 3×3 grid, empty/occupied slots
5. `SlotDetailPopover` with upgrade/demolish actions
6. `BuildingPickerModal` (communal + household modes)

---

## 16. Out of Scope for This Doc

The following will be addressed in separate planning documents:
- **New tier-2/tier-3 variants** for smithy, tannery, brewery, stable (currently tier-1 only)
- **Household renaming UI** (⚙ settings popover on HouseholdCard)
- **Batch crafting / specialisation orders** for the Production tab
- **Household founding UI** (currently auto-formed on marriage only)

# Diplomacy View — Design Document

**Version:** 1.0 (Phase 1 — Known Clans & Ashmark Map)**
**Inspiration:** King of Dragon Pass — clan list + regional map side by side
**Status:** Planning

---

## 1. Vision

The Diplomacy tab is the player's window onto the wider Ashmark. On the left is a living ledger of the clans and tribes they have encountered. On the right, the Ashmark map fills the space — a visual anchor that makes the world feel geographic and real. Clicking a tribe focuses attention on where they live; over time the map fills with discovered names and eventually becomes interactive.

Phase 1 is intentionally lean: get the layout right, make the map visible, and surface tribe information through a clean tooltip on click. Actions come in Phase 2 once the Emissary system is built.

---

## 2. Layout

```
┌────────────────┬──────────────────────────────────────────────┐
│                │                                              │
│  Known Clans   │                                              │
│  ──────────    │             Ashmark Map                      │
│  [tribe row]   │           (ashmark.jpg)                      │
│  [tribe row]   │                                              │
│  [tribe row]   │                                              │
│  [tribe row]   │                                              │
│                │                                              │
│  (scrollable)  │                                              │
│                │                                              │
└────────────────┴──────────────────────────────────────────────┘
```

**Left column:** fixed width (~200px), labeled "Known Clans", scrollable list of contacted tribes in alphabetical order.

**Right column:** fills remaining width, displays `public/ui/ashmark.jpg` as a full-height image (object-fit: cover, anchored center). Future iterations will add panning, tribe labels, and fog-of-war overlays.

The two panels are always visible simultaneously — no full-page replacements.

---

## 3. Tribe List (Left Column)

### 3.1 Visibility Rules

- **Only tribes with `contactEstablished: true`** appear in the list.
- The list grows naturally as the player meets new groups through events or emissaries.
- An empty list state shows a flavour message: *"No clans yet known to you. Send word into the Ashmark."*

### 3.2 Sort Order

Alphabetical by `tribe.name` (A–Z). Fixed for Phase 1. Future options: sort by disposition, group by ethnic group.

### 3.3 Row Anatomy

```
┌────────────────────────────────┐
│ ◆ Njaro-Matu Riverfolk         │  ← name; ◆ coloured by ethnic group
│   [Kiswani] ████░░ Neutral     │  ← ethnic badge + disposition bar
└────────────────────────────────┘
```

Each row contains:
| Element | Details |
|---------|---------|
| **Name** | `tribe.name`, truncated if needed |
| **Ethnic group badge** | Short abbreviation (see §3.4), coloured pill |
| **Disposition bar** | Reused `DispositionBar` component from TradeView; shows label + numeric value |

### 3.4 Ethnic Group Abbreviations & Colours

| `ethnicGroup` | Badge | Colour |
|---------------|-------|--------|
| `kiswani_riverfolk` | `KIS-R` | teal-600 |
| `kiswani_bayuk` | `KIS-B` | teal-800 |
| `kiswani_haisla` | `KIS-H` | teal-700 |
| `hanjoda_stormcaller` | `HAN-S` | indigo-600 |
| `hanjoda_bloodmoon` | `HAN-B` | rose-700 |
| `hanjoda_talon` | `HAN-T` | amber-700 |
| `hanjoda_emrasi` | `HAN-E` | purple-700 |

### 3.5 Selection State

Clicking a row:
1. Highlights it (stone-700 background, amber left border).
2. Opens the Tribe Info Tooltip (§4) — positioned to the right of the list column.
3. (Future) Pans/scrolls the map to the tribe's approximate territory (coordinates TBD — see §6.2).

Clicking the same row again, or clicking outside the tooltip, closes it.

---

## 4. Tribe Info Tooltip / Info Card

A floating panel that appears to the right of the tribe list (left edge of the map area), overlapping the map slightly. Not a modal — the map is still visible behind it.

### 4.1 Dimensions & Position

- Width: ~240px
- Position: anchored to the clicked row's vertical midpoint, offset right (left edge of map + 8px gap)
- Max-height capped, scrollable if needed
- Dismisses when clicking elsewhere or clicking the same tribe again

### 4.2 Card Contents

```
┌─────────────────────────────────────┐
│  Njaro-Matu Riverfolk               │  ← name (amber-200)
│  Kiswani Riverfolk · Pop ~800       │  ← ethnic group · population
├─────────────────────────────────────┤
│  Disposition                        │
│  [████████░░░░░] Neutral  +25       │  ← DispositionBar component
├─────────────────────────────────────┤
│  Stability  [██████████░░] 80%      │  ← stability bar
├─────────────────────────────────────┤
│  Traits                             │
│  [peaceful] [trader]                │  ← TribeTrait pill badges
├─────────────────────────────────────┤
│  Wants       Offers                 │
│  steel       food                   │
│  medicine    pearls                 │
│              knowledge              │
├─────────────────────────────────────┤
│  Trade history: 0 exchanges         │
│  Last trade: Never                  │
├─────────────────────────────────────┤
│  [Send Emissary ▶]  (disabled)      │  ← Phase 2 action button
│  [Offer Gift]       (disabled)      │
│  [Seek Alliance]    (disabled)      │
└─────────────────────────────────────┘
```

Action buttons are rendered in Phase 1 but **disabled** with a tooltip: *"Requires the Emissary system — coming soon."* This establishes the UI affordance without requiring the backend to exist yet.

### 4.3 Trait & Desire Labels

| `TribeTrait` | Display label |
|---|---|
| `warlike` | Warlike |
| `peaceful` | Peaceful |
| `isolationist` | Isolationist |
| `trader` | Traders |
| `expansionist` | Expansionist |
| `desperate` | Desperate |

Trait pill colours: `warlike`/`expansionist`/`desperate` → rose; `peaceful`/`trader` → emerald; `isolationist` → stone.

| `TribeDesire` | Display |
|---|---|
| `steel` | Steel |
| `medicine` | Medicine |
| `alliance` | Alliance |
| `men` | Fighters |
| `territory` | Territory |
| `trade` | Trade access |
| `food` | Food |
| `gold` | Gold |
| `lumber` | Lumber |

| `TribeOffering` | Display |
|---|---|
| `food` | Food |
| `horses` | Horses |
| `furs` | Furs |
| `herbs` | Herbs |
| `warriors` | Warriors |
| `wives` | Wives |
| `knowledge` | Knowledge |
| `pearls` | Pearls |
| `trade_goods` | Trade goods |
| `stone` | Stone |
| `steel` | Steel |

---

## 5. Map Panel (Right Column)

### 5.1 Phase 1

- `<img src="/ui/ashmark.jpg" />` inside a `div` that fills the right panel.
- `object-fit: cover`, anchored center. The map bleeds to fill the space without distortion.
- No interaction, no overlays, no pins.
- When a tribe is selected, the map does not visually change yet (map panning is Phase 2 / later).

### 5.2 Phase 2+ Roadmap (not in scope now)

| Feature | Notes |
|---------|-------|
| Tribe location pins | Add `mapX: number, mapY: number` to `TribeConfig` (percentage coordinates on the image). Render `<div>` positioned absolutely over the map. |
| Tribe name labels | Small text label at pin location; colour-coded by disposition |
| Selected tribe highlight | Ring/glow around the selected tribe's pin |
| Map pan/zoom | Replace `<img>` with a pan/zoom canvas or CSS transform container; coordinates drive viewport centering |
| Discovery fog | Semi-opaque overlay that lifts around known tribes and the settlement |

---

## 6. Data Requirements

### 6.1 Phase 1 — No Changes to GameState Required

All data needed is already on `ExternalTribe`:
- `name`, `ethnicGroup`, `population`, `disposition`, `stability`
- `traits`, `desires`, `offerings`
- `contactEstablished`, `lastTradeTurn`, `tradeHistoryCount`

### 6.2 Phase 2 — Map Coordinate Extension

Add to `TribeConfig` (and copy to `ExternalTribe`):

```typescript
/** Tribe's approximate territory centre as percentage of map image dimensions. */
mapPosition?: { x: number; y: number };
```

Optional — tribes without a position get no pin. Populated incrementally as the map art is finalised.

---

## 7. Emissary System (Phase 2 concept — not implemented in Phase 1)

When the Emissary button is clicked from the info card:

1. Player picks a person from settlement (not `away`, not `builder`).
2. Confirm dialog shows: person name, destination tribe, estimated travel time (N turns, based on tribe's `mapPosition` distance from settlement — or a fixed default of 3 turns until map coordinates exist).
3. On confirm:
   - Person's `role` is set to `'away'`.
   - A `DeferredEventEntry` is created: `{ eventId: 'dip_emissary_arrives', scheduledTurn: current + N, context: { tribeId, missionActorId: person.id, prevRole } }`.
4. When the deferred event fires, the **Emissary Arrival screen** opens (a new overlay or view switch):
   - Shows tribe portrait / flavour art.
   - Allows: Gift Offering, Propose Alliance, Marriage Proposal, Establish Trade.
   - Each action has resource costs and disposition outcomes.
   - Emissary returns home (role restored) after the scene resolves.

This reuses the established away/mission/deferred-event infrastructure (see CLAUDE.md §Event Character Binding).

---

## 8. Files Affected (Phase 1)

| File | Change |
|------|--------|
| `src/ui/views/DiplomacyView.tsx` | **Create** — main view component |
| `src/ui/layout/GameScreen.tsx` | Replace `StubView` with `<DiplomacyView />` |
| `src/ui/layout/LeftNav.tsx` | Remove `stub: true` from `diplomacy` nav item |

No simulation files change in Phase 1. No new GameState fields. No new tests required (view-only component).

---

## 9. Component Breakdown

```
DiplomacyView
 ├── TribeList (left column)
 │    ├── TribeListRow × N  (name + badge + DispositionBar)
 │    └── EmptyState        (if no contacts yet)
 ├── TribeInfoCard          (tooltip/popover, conditionally rendered)
 │    ├── DispositionBar     (reused from TradeView)
 │    ├── StabilityBar       (new, simple)
 │    ├── TraitPills         (inline, coloured)
 │    ├── DesiresOfferings   (two-column label list)
 │    └── ActionButtons      (disabled in Phase 1)
 └── MapPanel (right column)
      └── <img> ashmark.jpg
```

`DispositionBar` should be extracted from `TradeView.tsx` into `src/ui/components/DispositionBar.tsx` so both views can import it.

---

## 10. Open Questions (for future iteration)

1. **Undiscovered tribes** — when and how do they become discoverable? Through events? An Emissary scouting? A random "traveller arrives with news" event? The list only shows contacted tribes for now but the discovery pipeline needs designing.
2. **Hostile tribes** — should you be able to send an emissary to a tribe at negative disposition? Probably yes, with a risk of the emissary being detained.
3. **Tribe events in the list** — should active situations (ongoing raid, pending treaty, emissary in transit) show a visual indicator on the tribe row? Likely yes in a later pass.
4. **Company as a "tribe"** — the Ansberry Company could appear as a special entry in this list with its own relationship card. Currently lives in TradeView.

# Family Tree & Household Overlay — Design Document

## Status: ✅ Complete
## Affects: PersonDetail · FamilyTree · PeopleView · GraveyardEntry · portrait-resolver

---

## Overview

The current inline family tree in PersonDetail is a narrow, text-only widget squeezed into a 22rem side panel. It gives limited context and hides a rich household structure that the player rarely gets to fully appreciate. This document specifies a full replacement:

- A **"Family Tree" button** in PersonDetail replaces the inline toggle
- Clicking it opens a **full-screen overlay** with two tabs:
  - **Family Tree** — a fully expandable portrait tree, all generations, re-rootable per character
  - **Household** — structured display of every domestic role plus management actions
- The overlay returns the player to the screen they came from when dismissed

---

## 1. Trigger — PersonDetail Changes

### Before
A small text toggle button ("▶ Show Family Tree") that expands an inline `<FamilyTree>` component at the bottom of the PersonDetail panel.

### After
Replace the toggle with a single styled call-to-action button:

```
[ 🌳 Family Tree & Household ]
```

Positioning: at the bottom of the **Family** section in PersonDetail, visually distinct from the text links for spouse/parents/children. Use an amber-outlined button (`border border-amber-700 text-amber-300 hover:bg-amber-950`).

### State lift
`PeopleView` gains a new local state: `familyTreePersonId: string | null`. The PersonDetail's button calls `onOpenFamilyTree(personId)` via a new optional prop. PeopleView renders `<FamilyTreeOverlay>` when this is non-null, portalled or rendered above the main layout.

The existing `FamilyTree` import in PersonDetail is removed. The inline `showTree` local state is removed.

---

## 2. Overlay Shell — `FamilyTreeOverlay.tsx`

**Location:** `src/ui/overlays/FamilyTreeOverlay.tsx`

### Layout
```
┌─────────────────────────────────────────────────────────────┐
│  [← Back]   Family of Leofric Stonehill   [Tree] [Household] │  ← header bar
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                  <<  active tab content  >>                 │  ← scrollable body
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Specifications

| Property | Value |
|----------|-------|
| Position | `fixed inset-0` — covers full viewport |
| Background | `bg-stone-950` (solid, not transparent) |
| Z-index | Above all game UI; below active event modals |
| Header height | ~48px |
| Body | `flex-1 overflow-auto` |

### Header bar contents

- **Back button** (left): `← Back` — navigates the tree history stack (see §3.4); hidden when history is empty
- **Title** (left-centre): "Family of {firstName} {familyName}" — updates when tree is re-rooted
- **Tab switcher** (centre): `[ Family Tree ] [ Household ]` — amber underline on active tab, text buttons
- **Close button** (right): `×` — calls `onClose()`, returns to previous screen, resets overlay state

### Props

```typescript
interface FamilyTreeOverlayProps {
  rootPersonId: string;   // person the overlay was opened for
  onClose: () => void;
}
```

### Internal state

```typescript
const [activeTab,       setActiveTab]       = useState<'tree' | 'household'>('tree');
const [treeRootId,      setTreeRootId]      = useState(rootPersonId);
const [treeHistory,     setTreeHistory]     = useState<string[]>([]);
const [expandedAbove,   setExpandedAbove]   = useState<Set<string>>(new Set());
const [expandedBelow,   setExpandedBelow]   = useState<Set<string>>(new Set());
```

Re-rooting a tree node pushes the current `treeRootId` onto `treeHistory`, sets the new root, and resets all expand/collapse sets.

---

## 3. Tab 1 — Family Tree

**Location:** logic lives inside `FamilyTreeOverlay.tsx` or an extracted `FamilyTreeTab.tsx`

### 3.1 Layout — generation rows

The tree is rendered as a vertical stack of horizontally-centred rows.
Each generation is one row. Ancestors appear above the root row; descendants below.

```
[ Paternal GP ] [ Maternal GP ]   ← grandparents row (expand further via ▲+ on any parent)
        |
   [ Father ] [ Mother ]          ← parents row
        |
  [ Root Person ] ⚭ [ Spouse ]    ← root row (always visible, amber highlight)
        |
  [ Child 1 ] [ Child 2 ] ...     ← children row (up to N, horizontal scroll)
        |
[ GC from C1 ] [ GC from C2 ] ... ← grandchildren row
```

Rows are connected by a simple vertical line stub (`div w-px h-6 bg-stone-600 mx-auto`).

Each generation row is a `div` with `flex flex-wrap justify-center gap-4 px-4`.

### 3.2 Node card — `FamilyTreeNodeCard`

Approximately `lg`-variant Portrait size (~5.5rem × 7rem portrait area).

```
┌──────────────┐
│              │    ← portrait photo (resolvePortraitSrc) or SVG silhouette
│    PHOTO     │
│              │
├──────────────┤
│ ♀ Leofric   │    ← sex symbol (rose/sky) + first name
│  Stonehill  │    ← family name, smaller
│  age 34      │    ← age OR "? – 1012" for deceased
│  [Brave][…]  │    ← top 1–2 trait abbreviation badges
└──────────────┘
```

**Deceased node treatment:**
- Portrait image: CSS `filter: grayscale(1); opacity: 0.5`
- Card border: `border-stone-700` (dim) vs `border-stone-500` for living
- Background: `bg-stone-900` vs `bg-stone-800` for living
- Text: `text-stone-500` instead of `text-stone-200`
- Small `†` glyph after the name
- Shows birth–death years using GraveyardEntry data

**Root node treatment:**
- `border-amber-500 bg-amber-950/40`
- Cannot be clicked to re-root (is already root)
- No expand buttons

**Clickable (non-root) nodes:**
- `hover:border-stone-400 cursor-pointer`
- Clicking calls `reRootTo(node.id)`

### 3.3 Expand / collapse buttons

Each node that has unexpanded ancestors shows a **▲+** expand button centred above it.
Each node that has unexpanded descendants shows a **▼+** expand button centred below it.

Button appearance: `text-[10px] text-stone-500 hover:text-amber-400 leading-none` with a thin `+` character.

Expand button logic:
- **▲+** visible when: node has at least one `parentId`, AND that parent is not yet in the rendered ancestor rows
- **▼+** visible when: node has `childrenIds.length > 0` AND those children are not yet in the rendered descendant rows
- Clicking ▲+ adds the node's ID to `expandedAbove` — this causes all ancestor rows to re-derive including that branch's parents
- Clicking ▼+ adds the node's ID to `expandedBelow` — causes descendant rows to deepen for that branch

Because the entire tree re-derives from the root + expand sets on each render, no complex memoisation is needed for correctness (though `useMemo` on row derivation is advisable).

### 3.4 Navigation history

```typescript
function reRootTo(id: string) {
  setTreeHistory(h => [...h, treeRootId]);
  setTreeRootId(id);
  setExpandedAbove(new Set());
  setExpandedBelow(new Set());
}

function goBack() {
  const prev = treeHistory[treeHistory.length - 1];
  if (!prev) return;
  setTreeHistory(h => h.slice(0, -1));
  setTreeRootId(prev);
  setExpandedAbove(new Set());
  setExpandedBelow(new Set());
}
```

The header "← Back" button calls `goBack()`. It only renders when `treeHistory.length > 0`.

### 3.5 Spouses

Displayed connected horizontally to the root node using a ⚭ symbol connector (same as the current FamilyTree.tsx approach). If the root has multiple spouses they stack vertically beside the root card inside a small flex column. Each spouse card can be clicked to re-root.

### 3.6 Scroll & pan

The overlay body is `overflow-auto`. Trees that grow very wide (many siblings) produce a horizontal scroll within the generation row `div`. Trees with many generations scroll vertically. No zoom / pan interaction needed for v1.

### 3.7 Node lookup

Reuses the same two-source lookup pattern from FamilyTree.tsx: `state.people.get(id)` first, then `state.graveyard.find(g => g.id === id)`. Node cards check `isLiving` to apply deceased styling.

---

## 4. Deceased Portrait Data — GraveyardEntry Changes

### Problem
`resolvePortraitSrc` requires a full `Person` object. Once a person dies, their `Person` record is removed from `state.people` and a slimmer `GraveyardEntry` is written. We need three additional fields on `GraveyardEntry` to render their portrait in the family tree.

### New fields on `GraveyardEntry` (in `game-state.ts`)

```typescript
interface GraveyardEntry {
  // ... existing fields (id, firstName, familyName, sex, birthYear, deathYear,
  //     deathCause, parentIds, childrenIds) ...

  /** The 1-indexed portrait variant assigned at birth. Copied from Person on death. */
  portraitVariant: number;
  /**
   * The portrait category resolved at time of death.
   * Stored as a string to avoid re-running bloodline math post-mortem.
   * e.g. 'imanian', 'kiswani_riverfolk', 'mixed_imanian_kiswani'
   */
  portraitCategoryKey: string;
  /** Age at time of death. Used to derive the portrait age stage. */
  ageAtDeath: number;
}
```

### Where to populate
Anywhere a `GraveyardEntry` is written today:

1. **`turn-processor.ts`** — natural mortality processing
2. **`resolver.ts`** — event-driven death (`remove_person` consequence with `deathCause`)
3. **`game-store.ts`** — any store-level population removals (departure events)

At each site, compute the three values from the dying `Person` object before it is removed:

```typescript
import { getPortraitCategory } from '../ui/components/portrait-resolver';

const newEntry: GraveyardEntry = {
  // existing fields...
  portraitVariant:     person.portraitVariant ?? 1,
  portraitCategoryKey: getPortraitCategory(person),  // already exported from portrait-resolver.ts
  ageAtDeath:          Math.floor(person.age),
};
```

### New helper — `resolveDeceasedPortraitSrc`

Add to `portrait-resolver.ts`:

```typescript
/**
 * Resolves a portrait path for a deceased person using the data stored at
 * time of death. Returns null if no portrait asset exists for this combination.
 */
export function resolveDeceasedPortraitSrc(entry: GraveyardEntry): string | null {
  const stage = getAgeStage(entry.ageAtDeath);
  const registry = PORTRAIT_REGISTRY[entry.portraitCategoryKey as PortraitCategory]?.[entry.sex];
  if (!registry) return null;

  // Stage fallback order: requested → adult → young_adult → senior → child
  const fallbackOrder: AgeStage[] = [stage, 'adult', 'young_adult', 'senior', 'child'];
  for (const s of fallbackOrder) {
    const count = registry[s] ?? 0;
    if (count > 0) {
      const variant = Math.min(entry.portraitVariant, count);
      return `/portraits/${entry.sex}/${entry.portraitCategoryKey}/${entry.portraitCategoryKey}_${entry.sex === 'male' ? 'm' : 'f'}_${s}_${String(variant).padStart(3, '0')}.png`;
    }
  }
  return null;
}
```

### Serialisation
All three fields are plain scalars (number / number / string) — no Map handling needed.

Add `?? 1` / `?? 'imanian'` / `?? 0` fallbacks in `deserializeGameState` for old saves:

```typescript
portraitVariant:     (g as any).portraitVariant     ?? 1,
portraitCategoryKey: (g as any).portraitCategoryKey ?? 'imanian',
ageAtDeath:          (g as any).ageAtDeath          ?? 0,
```

---

## 5. Tab 2 — Household

**Location:** `src/ui/overlays/HouseholdTab.tsx` (or inlined in `FamilyTreeOverlay.tsx`)

### 5.1 Household-level info bar

A compact header row at the top of the tab:

```
House of Stonehill    Imanian tradition    7 members    [ 2 wives · 3 children · 1 thrall ]
```

Fields:
- **Name** — `household.name` in amber display font
- **Tradition** — `household.tradition` capitalised, with a colour-coded pill
  - `imanian` → stone/warm pill
  - `sauromatian` → blue-violet pill
- **Member count** — living members only
- **Composition summary** — comma list of role counts where count > 0

### 5.2 Section layout

Each role category is a labelled horizontal row of member cards, separated by a thin divider. Empty sections are hidden.

Render order:

| Order | Section label | Role | Border accent |
|-------|---------------|------|---------------|
| 1 | Head | `head` | amber-500 |
| 2 | Senior Wife | `senior_wife` | rose-400 |
| 3 | Wives | `wife` | pink-400 |
| 4 | Concubines | `concubine` | purple-400 |
| 5 | Hearth Companions | `hearth_companion` | violet-400 |
| 6 | Children | `child` | sky-400 |
| 7 | Thralls | `thrall` | stone-500 |
| 8 | Ashka-Melathi Bonds | — | rose-300 (italic bond line) |

### 5.3 Household member card — `HouseholdMemberCard`

A medium-size portrait card, smaller than a tree node — roughly portrait area `4rem × 5rem`:

```
┌───────────────┐
│    PORTRAIT   │
├───────────────┤
│ ♀ Hesta       │   ← sex + first name
│   Stonworth   │   ← family name
│   age 28      │
│ [Wife]        │   ← household role badge
│ +42 Content   │   ← happiness chip
└───────────────┘
─────────────────
[View] [Role ▾] [∗]   ← action row
```

The action row shows inline below the card, always visible (not hover-only).

### 5.4 Per-card actions

| Button | Label | Condition | Behaviour |
|--------|-------|-----------|-----------|
| View | 👤 View | Always | Closes overlay, calls `onClose()`, navigates to that person's detail (via callback) |
| Role | Role label + ▾ | Living, management phase | Opens a small dropdown role picker (reuse existing role assignment logic from PeopleView) |
| Keth-Thara | ✦ Keth-Thara | Male, age 16–24, unmarried, not already on service, management phase | `assignKethThara(id)` |
| Marry | ⚭ Marry | Unmarried adult, management phase | Opens `MarriageDialog` pre-filtered to this settlement |
| Remove | ✕ | Thrall or concubine, management phase | `removeFromHousehold(householdId, personId)` (currently exists in household.ts but not yet wired to a UI action) |

When `currentPhase !== 'management'`, all mutating actions are hidden or disabled with a tooltip explaining why.

### 5.5 Ashka-Melathi section

Rather than person cards, the Ashka-Melathi section renders bond pair rows:

```
♀ Hesta Stonworth  ─── Ashka-Melathi ───  ♀ Nessa Crale
```

Both names are clickable (calls `reRootTo` on the tree tab, or navigates to PersonDetail). The bond line uses rose text.

### 5.6 No-household state

If the person whose overlay was opened has `householdId === null`, the Household tab shows:

```
[Name] is not part of a household.

[Arrange Marriage]    ← if eligible + management phase, opens MarriageDialog
```

---

## 6. Component & File Map

### Files to create

| File | Purpose |
|------|---------|
| `src/ui/overlays/FamilyTreeOverlay.tsx` | Full-screen modal shell — tab router, header, history stack, overlay state |
| `src/ui/overlays/HouseholdTab.tsx` | Household tab — info bar, role sections, member cards, actions |

The family tree rendering lives inline in `FamilyTreeOverlay.tsx` (it shares the overlay's `treeRootId`, `expandedAbove`, `expandedBelow` state). If it grows large, extract to `FamilyTreeTab.tsx`.

### Files to modify

| File | Change |
|------|--------|
| `src/simulation/turn/game-state.ts` | Add `portraitVariant`, `portraitCategoryKey`, `ageAtDeath` to `GraveyardEntry` |
| `src/simulation/turn/turn-processor.ts` | Populate new fields when writing GraveyardEntry (natural death) |
| `src/simulation/events/resolver.ts` | Populate new fields in `remove_person` consequence handler |
| `src/stores/game-store.ts` | Populate new fields wherever `GraveyardEntry` objects are pushed (departure) |
| `src/stores/serialization.ts` | Add `?? fallback` defaults for three new GraveyardEntry fields on load |
| `src/ui/components/portrait-resolver.ts` | Export `resolveDeceasedPortraitSrc(entry: GraveyardEntry)` helper |
| `src/ui/views/PersonDetail.tsx` | Remove `showTree` state + `FamilyTree` import; add "Family Tree & Household" button; add `onOpenFamilyTree?: (id: string) => void` prop |
| `src/ui/views/PeopleView.tsx` | Add `familyTreePersonId` state; pass `onOpenFamilyTree` to PersonDetail; render `<FamilyTreeOverlay>` when set |
| `src/ui/views/FamilyTree.tsx` | Retire (delete or keep as a fallback stub) — all logic superseded by the overlay |

### FamilyTree.tsx retirement

The current `FamilyTree.tsx` is only used from PersonDetail. Once PersonDetail's toggle is replaced, it becomes dead code. It should be **deleted** after the overlay is working and tests confirm nothing else imports it.

---

## 7. Implementation Order

1. **Data model** — extend `GraveyardEntry`, update all write-sites, update serialisation
2. **`resolveDeceasedPortraitSrc`** — add to portrait-resolver.ts, verify with a quick manual test
3. **`FamilyTreeOverlay` shell** — modal, header, tab switcher, close/back buttons, wire to PeopleView
4. **Family Tree tab** — node cards (living + deceased), generation row layout, expand/collapse, re-root
5. **Household tab** — info bar, role sections, member cards, actions (view/role/keth-thara/marry/remove)
6. **PersonDetail changes** — remove old toggle, add button with `onOpenFamilyTree` callback
7. **PeopleView integration** — overlay rendering, open/close state
8. **FamilyTree.tsx retirement** — delete file

---

## 8. Test surface

No new pure-logic simulation functions are introduced. Tests to write or update:

| Test file | What to cover |
|-----------|---------------|
| `tests/store/serialization.test.ts` | Round-trip test for new GraveyardEntry fields (`portraitVariant`, `portraitCategoryKey`, `ageAtDeath`); old-save fallback values |
| `tests/events/resolver.test.ts` | `remove_person` consequence now populates the three new fields on the graveyard entry |
| Existing tests | Confirm no regression — `graveyard` entries in test fixtures need the three new fields (or rely on the `?? fallback`) |

UI component rendering tests are left to manual verification for now.

---

## 9. Open questions / future phases

| Question | Decision |
|----------|----------|
| Show siblings in the parents row? | Not in v1 — adds layout complexity. Add a dedicated "Siblings" expandable row later. |
| "Form Household" from the overlay | Not in v1 — requires a new dialog. The Household tab shows the no-household message and a link to open MarriageDialog. |
| `medium` portrait variant | The current `Portrait.tsx` has `sm` and `lg`. A new `md` size might be cleaner than hardcoding dimensions in the household card. Consider adding it in `Portrait.tsx`. |
| Multi-spouse tree layout | For roots with 3+ spouses, the horizontal spouse layout may need to become a scrollable column. |
| Keth-Thara service badge | Members currently on Keth-Thara (`role === 'away'`) should show a `[Away]` overlay on their portrait card in the Household tab. |

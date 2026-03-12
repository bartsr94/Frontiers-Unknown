# UI Improvements Plan — Palusteria: Children of the Ashmark

Derived from the UI/UX review of the Settlers view (March 2026).  
Scope: quality-of-life polish across PeopleView, PersonDetail, LeftNav, BottomBar, and CouncilFooter.  
No gameplay logic changes — pure presentation and ergonomics.

---

## Priority 1 — Quick wins (Small effort, clear impact)

### 1.1 Fix cryptic table column headers

**File:** `src/ui/views/PeopleView.tsx`

- Rename the "Wed" column header to "Married" (or use `◎` as the header with `title="Marital status"`).
- Add a "Council" text header (or a `👑` with `title="Expedition Council (max 7)"`) for the `⭐` column.
- Highlight the entire row with a subtle gold left-border or ring when `onCouncil` is true.

```
Before:  <th>Wed</th>   <th>⭐</th>
After:   <th title="Marital status">Married</th>   <th title="Expedition Council (max 7)">Council</th>
```

---

### 1.2 Elevate the "Arrange Marriage" button

**File:** `src/ui/views/PeopleView.tsx`

- Change colour from `bg-amber-800 text-amber-100` (same as active sort buttons) to a distinct primary-action style:
  `bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold shadow`
- This makes it visually distinct from the filter/sort toggle group.

---

### 1.3 Add tooltips to stub nav items

**File:** `src/ui/layout/LeftNav.tsx`

- Add `title="Coming soon"` to every `<button>` where `item.stub === true`.
- Optionally append a `⏳` or `🔒` micro-icon at `text-[10px] text-stone-700` after the label.

---

### 1.4 Subdue PersonDetail section headings

**File:** `src/ui/views/PersonDetail.tsx` — `SectionHeading` component

- Change from `text-amber-500` to `text-stone-400`.
- Amber should be reserved for interactive elements and CTAs; section labels are structural not actionable.

```tsx
// Before
<h3 className="text-amber-500 font-semibold text-xs uppercase tracking-wider mb-2">

// After
<h3 className="text-stone-400 font-semibold text-[11px] uppercase tracking-wide mb-2">
```

---

### 1.5 Fix skill column layout shift

**File:** `src/ui/views/PeopleView.tsx`

- Always render the skill column in `<thead>` and `<tbody>`, even when `activeSkill` is null.
- When no skill is active, render an empty `<td>` with a fixed narrow width (`w-10`).
- This prevents the table header/body from re-flowing when a skill sort is selected.
- The header cell should show the active skill name (e.g. "Combat") or empty when none active.

---

### 1.6 "No traits." — improve empty state

**File:** `src/ui/views/PersonDetail.tsx`

- Replace `No traits.` with `Character not yet known` styled as `text-stone-500 italic text-xs`.
- Alternatively, ensure Sauromatian founding women each receive at least one trait during game init in `src/stores/game-store.ts`.

---

### 1.7 Enlarge skin-tone dot and remove border

**File:** `src/ui/views/PeopleView.tsx`

- Change `w-2.5 h-2.5` → `w-3 h-3`.
- Remove `border border-stone-600` — the border reads as a radio-button affordance on a dark background.

---

## Priority 2 — Medium effort, significant quality improvement

### 2.1 Restructure the filter/sort toolbar

**File:** `src/ui/views/PeopleView.tsx`

**Problem:** All 26 controls (sort keys + 3 filter groups) live in one `flex-wrap` row with `|` pipe separators. The control groups are indistinguishable.

**Design:**

Separate into two logical rows inside the toolbar container:

```
Row 1 (Sort):     [Name] [Age] [Heritage] [Role]  ·  [Animals] [Bargaining] [Combat] [Custom] [Leadership] [Plants]
Row 2 (Filter):   Sex: [All] [♀] [♂]  ·  Status: [All] [Single] [Married]  ·  Heritage: [All] [IMA] [KIS] [HAN] [MIX]
```

Implementation notes:
- Wrap row 1 and row 2 in separate `<div className="flex items-center gap-2 flex-wrap">` elements.
- Label each group with a sticky `<span className="text-stone-500 text-xs font-medium">` prefix inside the row.
- Replace `|` separators with `<span className="w-px h-3 bg-stone-600 self-center mx-1" />` visual dividers.
- Consider adding a `bg-stone-750` (or `bg-stone-800/50`) row alternation to visually separate the two rows.

---

### 2.2 BottomBar — add net-per-turn delta indicators

**File:** `src/ui/layout/BottomBar.tsx`  
**Supporting files:** `src/simulation/economy/resources.ts`, `src/simulation/turn/season.ts`

**Problem:** Resources show only a static snapshot with no trend information.

**Design:**
- Compute `netDelta` per resource per turn using `computeProduction` / `computeConsumption` from `resources.ts`.
- Display alongside each resource value:
  - `+12` in `text-green-400` when net positive
  - `-3` in `text-red-400` when net negative
  - omit (or show `±0` in `text-stone-600`) when zero
- Tooltip on hover: `"Net production this season: +12/turn"`

```tsx
// Example pill layout
<span>🌾 59 <span className="text-green-400 text-xs">+12</span> <span className="text-stone-500 text-xs">Food</span></span>
```

**Note:** Deltas only need to be computed once per render cycle. The `currentSeason` from `gameState` is already available in the store.

---

### 2.3 PersonDetail as slide-over drawer on narrow viewports

**File:** `src/ui/views/PeopleView.tsx`, `src/ui/views/PersonDetail.tsx`

**Problem:** PersonDetail renders inline beside the roster. On viewports below ~1200px the table Name column gets clipped.

**Design:**
- Detect viewport width via a `useEffect` or a CSS breakpoint approach.
- Below `1200px` (Tailwind `xl`): render PersonDetail as an absolutely-positioned right-side drawer with `z-10 shadow-2xl`, overlaying the table.
- Above `1200px`: keep the current side-by-side flex layout.
- Add a dim overlay (`bg-stone-950/50`) behind the drawer on narrow viewports to indicate focus.
- The existing `onClose` handler already handles dismissal.

Implementation:
```tsx
// In PeopleView.tsx, wrap PersonDetail with:
<div className={`
  xl:relative xl:flex-none xl:w-80
  max-xl:fixed max-xl:inset-y-0 max-xl:right-0 max-xl:w-80 max-xl:z-20
  overflow-y-auto bg-stone-900 border-l border-stone-700
`}>
  <PersonDetail … />
</div>
```

---

### 2.4 CouncilFooter — stronger visual separation + collapsible outside event phase

**File:** `src/ui/layout/CouncilFooter.tsx`, `src/ui/layout/GameScreen.tsx`

**Problem:** The council strip visually blends into main content. ~80px permanently committed even when council is inactive context.

**Design:**

Part A — stronger visual border:  
- Change footer background from `bg-amber-950` to `bg-stone-950` (darker, distinct from main panel's `bg-stone-900`).
- Change top border from `border-amber-900` to `border-t-2 border-amber-700` for a thicker, clearer separator.

Part B — collapsible outside event phase:
- Add local `collapsed` state, defaulting to `true` when `currentPhase !== 'event'`.
- Auto-expand when `currentPhase === 'event'`.
- The "EXPEDITION COUNCIL" heading row becomes a clickable toggle:
  ```
  ▶ EXPEDITION COUNCIL  (collapsed)
  ▼ EXPEDITION COUNCIL  (expanded) + seat cards below
  ```
- When collapsed, show a single-line summary: `5/7 seats filled` in `text-stone-500 text-xs`.

---

## Priority 3 — Low priority polish

### 3.1 Rating abbreviation legend

**File:** `src/ui/views/PeopleView.tsx`

- Add a small `?` icon or `i` tooltip next to the active skill column header that shows:
  `FR=Fair · GD=Good · VG=Very Good · EX=Excellent · RN=Renowned · HR=Heroic`
- Could be a simple `title` attribute on the header cell.

---

### 3.2 Council row highlight for on-council settlers

**File:** `src/ui/views/PeopleView.tsx`

- When a settler `onCouncil`, show a subtle left-border highlight on their table row:
  `border-l-2 border-amber-500` in addition to the star icon.
- This makes council membership scannable from the roster without checking the footer.

---

## Implementation Order (recommended)

1. **1.1** Column headers (2 min)
2. **1.2** Arrange Marriage button style (2 min)
3. **1.3** Stub nav tooltips (2 min)
4. **1.4** Section heading colour (2 min)
5. **1.5** Skill column layout shift (10 min)
6. **1.7** Skin-tone dot size (2 min)
7. **3.2** Council row highlight (5 min)
8. **2.1** Toolbar restructure (30 min)
9. **2.4A** CouncilFooter border (5 min)
10. **2.4B** CouncilFooter collapsible (20 min)
11. **2.3** PersonDetail slide-over drawer (30 min)
12. **2.2** BottomBar deltas (45 min)
13. **1.6** "No traits" founder seeding (20 min)
14. **3.1** Rating abbreviation legend (5 min)

Items 1–7 can all be shipped as a single commit ("UI polish pass 1").  
Items 8–10 are a second commit ("Toolbar & council layout cleanup").  
Items 11–14 are longer-running features for a third commit.

# UI Improvements Plan — Palusteria: Children of the Ashmark

Second-pass review, March 2026.  
The original plan (Pass 1) is **entirely implemented** — all 14 items are live. This document captures what to do next, with a focused theme: make the game *feel* medieval/renaissance, not just function well.

The core problem is that the game currently reads like a capable Tailwind data app.  The stone/amber palette is a good foundation, but the copy, iconography, and typography all undermine the atmosphere. A player sees `"End Turn"`, `"Arrange Marriage"`, `🌾 59 +12 Food"`, and `"Coming soon"` — all of which could belong to any modern web product. The fixes below are mostly copy and low-cost Tailwind tweaks; the biggest bang is the font import.

---

## Priority 1 — Atmosphere (highest impact per hour)

### 1.1 Import a period-appropriate display typeface

**Files:** `index.html`, `src/index.css`, `tailwind.config.js`

**This is the single change with the largest visual impact.**

The game currently uses the browser system sans-serif stack throughout. Adding a display font for headings immediately signals "this is a historical game" before the player reads a single word.

**Recommended font:** [Cinzel](https://fonts.google.com/specimen/Cinzel) — a Roman inscription-inspired uppercase serif. Free on Google Fonts. Pairs well with the existing stone/amber palette without requiring any colour changes.

Runner-up: [IM Fell English](https://fonts.google.com/specimen/IM+Fell+English) — more rough, hand-set feel; better if the game leans into manuscripts over monuments.

```html
<!-- index.html <head> -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&display=swap" rel="stylesheet">
```

```js
// tailwind.config.js
theme: {
  extend: {
    fontFamily: {
      display: ['Cinzel', 'Georgia', 'serif'],
    },
  },
},
```

Apply `font-display` class to:
- `GameSetup` title ("Palusteria")
- `LeftNav` settlement name
- All view `<h2>` titles ("Settlers", "Settlement", "Trade")
- `CouncilFooter` "Expedition Council" heading
- `PersonDetail` person name at top of panel
- `EventView` event title

**Do not apply** to body text, labels, skill names, or filter buttons — the contrast between display and sans-serif is intentional.

---

### 1.2 Replace modern copy with in-world language

**Files:** multiple

The game has excellent in-world lore (Imanian, Sauromatian, Hidden Wheel, The Company) but the UI ignores all of it. Strings like `"End Turn"` and `"Coming soon"` read as game scaffolding, not a living world.

| Current string | Replacement | File |
|---|---|---|
| `"End Turn"` | `"Begin the Season"` | `LeftNav.tsx` |
| `"Confirm Turn"` | `"Close the Season"` | `LeftNav.tsx` |
| `"Resolve Events"` | `"Events Pending"` | `LeftNav.tsx` — disabled state label |
| `"Processing…"` | `"The season turns…"` | `LeftNav.tsx` — busy state |
| `"Arrange Marriage"` | `"Arrange a Match"` | `PeopleView.tsx` |
| `"Coming soon"` (tooltip) | `"Not yet charted"` | `LeftNav.tsx` — stub items |
| `"No settlers match the current filter."` | `"No records match."` | `PeopleView.tsx` |
| `"Settlers ({n})"` view heading | `"Company Rolls — {n} souls"` | `PeopleView.tsx` |
| `"Settlement"` view heading | keep as-is (it works) | — |
| `"Key Opinions"` section in PersonDetail | `"Standing Among Kin"` | `PersonDetail.tsx` |
| `"Character not yet known"` (no-traits empty state) | `"No account kept"` | `PersonDetail.tsx` |
| `"Settle"` / `"Build"` CTA in SettlementView | `"Commission"` | `SettlementView.tsx` |
| `"{name} — coming soon"` StubView | `"{name} — records forthcoming"` | `GameScreen.tsx` |

Implementation: all pure string changes, no logic touched.

---

### 1.3 Replace emoji resource icons with Unicode period symbols

**File:** `src/ui/shared/resource-display.ts`

Emoji render inconsistently across OSes and look digitally modern. Unicode has a rich set of symbols from the BMP that render as plain text and feel more typeset/carved.

| Resource | Current | Proposed Unicode glyph |
|---|---|---|
| Food | 🌾 | `✦` (or `⊕` — a "grain" asterisk feel) |
| Cattle | 🐄 | `⁂` (or just bold **C**) |
| Goods | 📦 | `◈` |
| Gold | 💰 | `◆` |
| Lumber | 🪵 | `⌘` (cross/beam feel) or `╪` |
| Stone | 🪨 | `◼` |
| Medicine | 💊 | `✚` |
| Steel | ⚙️ | `⚔` |
| Horses | 🐎 | `⋈` (or just `H` italic) |
| Population | 👥 | `⊛` |

**Alternative approach** (lower risk): keep the emoji but wrap them in a `<span aria-hidden>` with `text-[0.85em] not-italic` — they'll look slightly smaller and less obtrusive. The Unicode route is preferred for atmosphere.

**Note:** If Unicode glyphs feel too abstract for readability, a good middle ground is to drop the emoji entirely and rely only on the text label (`Food`, `Gold`, etc.) with a coloured accent `●` dot — see the bloodline bar style already used in PersonDetail.

---

### 1.4 Year display as Roman numerals

**File:** `src/ui/layout/LeftNav.tsx`

`Year 3` is functional; `Year III` is immersive. This is a 10-line utility addition.

```ts
// src/utils/math.ts  (add to existing file)
export function toRoman(n: number): string {
  const vals = [1000,900,500,400,100,90,50,40,10,9,5,4,1];
  const syms = ['M','CM','D','CD','C','XC','L','XL','X','IX','V','IV','I'];
  let result = '';
  for (let i = 0; i < vals.length; i++) {
    while (n >= vals[i]) { result += syms[i]; n -= vals[i]; }
  }
  return result;
}
```

```tsx
// LeftNav.tsx
import { toRoman } from '../../utils/math';
// ...
<span>Year {toRoman(year)}</span>
```

Cap at 3999 to avoid error state. For Year 1–50 (the realistic game range) this looks exactly right.

---

### 1.5 Season display — icon glyph instead of bare word

**File:** `src/ui/layout/LeftNav.tsx`

Add a small Unicode seasonal glyph alongside the season name in the settlement header:

```tsx
const SEASON_GLYPHS: Record<string, string> = {
  spring: '✿',   // flower
  summer: '☀',   // sun
  autumn: '❧',   // leaf/flourish (hedera)
  winter: '❄',   // snowflake
};

// In the settlement header:
<p className="text-stone-400 text-xs mt-0.5">
  <span className={`font-medium capitalize ${SEASON_COLORS[season]}`}>
    {SEASON_GLYPHS[season]} {season}
  </span>
  {' · Year '}
  <span>{toRoman(year)}</span>
</p>
```

---

## Priority 2 — Structural polish

### 2.1 EventView — ornamental choice presentation

**File:** `src/ui/views/EventView.tsx`

**Problem:** Event choices render as standard rounded pill buttons. They look like a React form, not a manuscript decision. KoDP's charm comes from presenting choices as *options in a scroll*, not a poll widget.

**Design:** Replace the button border style with something closer to a numbered leaf entry:

```tsx
// Before (approximate):
<button className="w-full text-left px-4 py-3 rounded-lg border border-stone-600 …">
  {choice.text}
</button>

// After:
<button className="w-full text-left px-4 py-3 border-l-2 border-amber-700 bg-stone-800/50
                   hover:bg-stone-700/60 hover:border-amber-500 transition-colors group">
  <span className="text-amber-600 font-bold mr-2 group-hover:text-amber-400">
    {romanIndex}.
  </span>
  <span className="text-stone-200">{choice.text}</span>
</button>
```

Where `romanIndex` is the choice index rendered as `I.`, `II.`, `III.`. No rounded corners — left-border-only styling suggests a list entry in a ledger or codex.

Add a thin `border-b border-stone-700/50` between choices and a top-level `<div className="space-y-1">` container.

---

### 2.2 PersonDetail — section heading treatment

**File:** `src/ui/views/PersonDetail.tsx`

Section headings currently use `text-stone-400 font-semibold text-[11px] uppercase tracking-wide`. Elevate to match a period register/ledger style: add a hairline rule beneath each heading.

```tsx
function SectionHeading({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 mb-2 mt-4 first:mt-0">
      <h3 className="text-stone-500 font-semibold text-[10px] uppercase tracking-widest shrink-0">
        {title}
      </h3>
      <div className="flex-1 h-px bg-stone-700" />
    </div>
  );
}
```

The extending `h-px` line gives each section a clean ledger-rule feel. This is used already for horizontal rules in many documents apps — very low risk, very effective.

---

### 2.3 LeftNav — parchment sidebar feel

**File:** `src/ui/layout/LeftNav.tsx`

The nav currently reads `bg-amber-950 border-r border-amber-900`. Two small changes deepen the parchment feel:

1. **Darken the border:** `border-r-2 border-amber-900/80` — slightly wider rule, slightly more visible.
2. **Settlement name treatment:** Wrap the settlement name in `font-display` (from item 1.1) and separate the season line with a ruled `<hr className="border-stone-600/50 my-1.5" />` between the name and the season.
3. **Nav item active state:** Change the active item from `bg-amber-800 text-amber-100` to `bg-amber-900 text-amber-200 border-l-2 border-amber-500` — a left-sidebar "active tab" marker feels more like a bookmark than a filled chip.

---

### 2.4 PeopleView — thematic filter labels

**File:** `src/ui/views/PeopleView.tsx`

Minor copy refinements to the toolbar that match the game's register:

| Current label | Proposed | Rationale |
|---|---|---|
| `"Sort"` | `"Order by"` | Period ledger language |
| `"Status"` | `"Bond"` | Marital status phrasing from the era |
| `○ Single` | `○ Unbound` | Consistent with the "Bond" group label |
| `◎ Married` | `◎ Bound` | Ditto |
| `"Sex"` | `"Sex"` | keep — clear enough |
| `"Heritage"` | `"Heritage"` | keep — already in-world |
| `"Skills"` (row 1 group) | `"Faculty"` | More archaic; optional |

---

### 2.5 BottomBar — glyph resource labels

**File:** `src/ui/layout/BottomBar.tsx`

Tie into resource-display.ts changes from item 1.3. Additionally:

- Remove the `hidden sm:inline` text label when there's a glyph to carry meaning — the glyph + number is enough in the bottom strip.
- Add `title="Food: 59 (+12/season)"` tooltips to each pill so the full context is one hover away.
- Add a subtle `border-t-2 border-stone-700` (could use `border-amber-900` for warmth) to the bar — the current single pixel border is easy to miss.

---

### 2.6 CouncilFooter — council seat typography

**File:** `src/ui/layout/CouncilFooter.tsx`

The council footer heading currently reads `EXPEDITION COUNCIL` in `text-amber-600 text-xs font-semibold uppercase tracking-wide`. Apply `font-display` (1.1) to this heading when the font is available. At `text-xs` Cinzel is very readable and gives the council heading an appropriate gravitas.

Additionally, swap the collapsed summary from `"5/7 seats"` → `"5 of 7 councillors"` for slightly more register consistency.

---

## Priority 3 — Surface refinements

### 3.1 GameSetup — title treatment

**File:** `src/ui/overlays/GameSetup.tsx`

The title card `"Palusteria / Children of the Ashmark"` is the first thing a new player sees. Two changes:

1. Apply `font-display` to "Palusteria" (will look exceptional with Cinzel — the font was designed for this exact use case).
2. Add `letter-spacing: 0.15em` (Tailwind: `tracking-[0.15em]`) to the subtitle "Children of the Ashmark".
3. Replace the single-colour `bg-amber-900` header bar with a subtle gradient: `bg-gradient-to-b from-amber-900 to-amber-950` — adds depth to the header strip without any other change.

---

### 3.2 Trait badges — heraldic palette

**File:** `src/ui/views/PersonDetail.tsx`

The existing trait colour map mixes arbitrary Tailwind colours. Consolidate to a heraldic palette — only five tinctures:

| Category | Heraldic | Tailwind mapping |
|---|---|---|
| Positive personality | Or (gold) | `bg-amber-900/70 text-amber-200` |
| Negative personality | Gules (red) | `bg-red-950/70 text-red-300` |
| Aptitude | Azure (blue) | `bg-blue-950/70 text-blue-300` |
| Cultural/background | Sable (black/stone) | `bg-stone-700/80 text-stone-300` |
| Earned/circumstantial | Vert (green) | `bg-emerald-950/70 text-emerald-300` |
| Purpure (ambition-driven) | Purpure | `bg-purple-950/70 text-purple-300` |

This reduces the current ~20-colour scatter to 5–6 predictable groupings. Players quickly learn "red = bad trait, gold = good trait" — a natural medieval heraldry read.

---

### 3.3 EventView — image panel atmospheric overlay

**File:** `src/ui/views/EventView.tsx`

The event image panel (`w-[60%]`) currently uses `object-cover object-top` with no treatment. Add a subtle vignette overlay so text on the right panel doesn't compete visually with bright photo areas at the edge:

```tsx
<div className="w-[60%] flex-shrink-0 overflow-hidden relative">
  <img … className="w-full h-full object-cover object-top" />
  {/* Right-edge gradient vignette to blend into event text panel */}
  <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-r from-transparent to-stone-900/90 pointer-events-none" />
</div>
```

When no image is found, the existing `amber-950 → stone-950` CSS gradient already looks intentional — no change needed for the fallback case.

---

### 3.4 Spoilage / notification banners — period copy

**File:** `src/ui/layout/GameScreen.tsx`

| Current | Replacement |
|---|---|
| `"🌙 Spoilage: {parts} lost overnight."` | `"⁂ Spoilage: {parts} were lost in the night."` |
| After applying 1.3 resource symbols, the emoji prefix becomes consistent | — |

The banner background `bg-amber-950/80 border-amber-800/60` is already nicely atmospheric — no colour change needed.

---

## Implementation Order (recommended)

### Commit A — "Atmosphere pass: fonts, copy & glyphs" (~2 hours)
1. **1.1** Import Cinzel + `font-display` utility class + apply to headings
2. **1.2** All copy replacements (string-only, zero logic risk)
3. **1.3** Unicode resource glyphs in `resource-display.ts`
4. **1.4** Roman numeral year in `LeftNav`
5. **1.5** Season glyphs in `LeftNav`

### Commit B — "Layout refinements" (~1.5 hours)
6. **2.1** EventView choice presentation (left-border + roman numerals)
7. **2.2** PersonDetail section heading + hairline rule
8. **2.3** LeftNav parchment treatment
9. **2.4** PeopleView filter label copy
10. **3.4** Spoilage banner copy

### Commit C — "Surface polish" (~1 hour)
11. **2.5** BottomBar glyph labels + tooltip text
12. **2.6** CouncilFooter font + copy
13. **3.1** GameSetup title treatment + gradient
14. **3.2** Trait badge heraldic palette consolidation
15. **3.3** EventView vignette overlay

Commits A and B can be reviewed independently. Commit C is pure cosmetic — safe to ship together with B or defer entirely.

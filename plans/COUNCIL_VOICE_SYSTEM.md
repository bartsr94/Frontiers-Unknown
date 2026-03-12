# Council Voice System — Design Document

**Status:** ✅ Complete  
**Depends on:** Phase 3 Skills complete (385 tests passing, skilled event resolution in place)

---

## Overview

Council members currently sit silently in the footer strip while the player reads event text and makes decisions. This plan replaces the dry mechanical descriptions on choice buttons with a living adviser system: clicking any councillor shows their in-character opinion on the current event, shaped by their personality traits, skills, and cultural background.

The system has two deliverables:
1. **Council portraits** — small face badges added to each councillor card in the footer.
2. **Council voice** — a speech bubble showing one adviser's opinion at a time; clicking a different adviser switches the bubble.

---

## Design Principles

- **Self-serving, not optimal.** Each adviser gives advice from their own perspective. A greedy man will find the gold angle. A coward will always recommend the safest path. A deceitful one may steer you wrong deliberately. The player must weigh who is telling them what and why.
- **Implicit, not explicit.** Advisers never say "choose option B." They give a viewpoint that implies a preference — the way real advisers talk. The player draws the conclusion.
- **Skill shapes confidence, not correctness.** A councillor with low bargaining skill may still confidently recommend you negotiate — they just overestimate their ability. High skill produces measured, well-grounded confidence. Low skill produces either overconfidence or hedging depending on their dominant trait.
- **No mechanical spoilers.** Choice buttons will lose their current description lines explaining consequences. The council voices replace this information layer — imperfectly and in character.
- **Purely deterministic.** Advice is generated from a hash of `(personId + eventId)` so it is consistent on reload without consuming the main RNG stream.

---

## System Architecture

```
src/simulation/events/
  council-advice.ts          ← NEW: pure logic, no React

src/ui/components/
  AdviceBubble.tsx           ← NEW: speech bubble component

src/ui/layout/
  CouncilFooter.tsx          ← MODIFIED: portraits + click selection + bubble
```

### Data flow (event phase)

```
EventView renders
  └─ CouncilFooter receives: event, selectedAdviserId, onSelectAdviser
       ├─ each seat card: Portrait swatch + name + role
       ├─ clicking a seat → setSelectedAdviser(personId)
       └─ AdviceBubble floats above selected card
             └─ text = generateAdvice(person, event, seed)  ← pure function
```

Advice is generated lazily on first click per (personId × eventId) pair and
memoised in local state in CouncilFooter. No store changes needed.

---

## Advice Generation Algorithm

`generateAdvice(person: Person, event: GameEvent, seed: number): string`

### Step 1 — Score each choice from this person's perspective

For each choice in `event.choices`, compute a **personal desirability score**:

```
score = BASE_SCORE
      + traitBiasScore(person.personalityTraits, choice)
      + skillConfidenceScore(person.skills, choice.skillCheck)
      + culturalBiasScore(person.primaryCulture, event.category)
```

The highest-scored choice becomes their **implied recommendation**. This is
never shown to the player directly — it shapes the text.

### Step 2 — Determine voice archetype

Each person has a **dominant voice** derived from their highest-weighted
personality traits. Six archetypes:

| Archetype | Dominant traits |
|-----------|-----------------|
| **Bold** | `brave`, `wrathful`, `veteran`, `hero` |
| **Pragmatist** | `greedy`, `ambitious`, `clever`, `wealthy` |
| **Diplomat** | `generous`, `gregarious`, `welcoming`, `cosmopolitan` |
| **Traditionalist** | `traditional`, `devout`, `proud`, `honest` |
| **Cautious** | `patient`, `craven`, `sickly`, `humble` |
| **Schemer** | `deceitful`, `lustful`, `scandal`, `oath_breaker` |

Rule: iterate the person's traits in order; first match wins. If no trait
maps to an archetype, default to **Cautious**.

### Step 3 — Pick opening template

Template key: `voiceArchetype × eventCategory`

This gives a 6 × 8 = 48-combination matrix. Each cell holds 3–4 short text
fragments. One is chosen based on `seed % fragments.length`. The fragment
is the *opening line* of the advice — it establishes the character's angle
on the situation before they get to their point.

Examples (not exhaustive — full corpus lives in `council-advice.ts`):

| Archetype | Category | Example fragment |
|-----------|----------|-----------------|
| Bold | domestic | *"These situations only get worse if you hesitate."* |
| Bold | diplomatic | *"Show strength first. Hospitality comes after respect is established."* |
| Pragmatist | economic | *"The question is simple: which path leaves us richer?"* |
| Pragmatist | company | *"The Company's goodwill is a resource like any other. Spend it carefully."* |
| Diplomat | cultural | *"A moment like this is earned slowly and lost in an instant."* |
| Diplomat | domestic | *"What the men need is not direction — it is to feel heard."* |
| Traditionalist | cultural | *"Our customs are not ornament. They are what separates a settlement from a camp."* |
| Traditionalist | company | *"The Company's confidence in us rests on predictability. Let us not surprise them."* |
| Cautious | environmental | *"The safest path through hardship is to spend the least and hold the most."* |
| Cautious | domestic | *"I would be slow to commit resources until we understand what we are dealing with."* |
| Schemer | diplomatic | *"Every delegation wants something they have not said aloud. Find that, and you hold the hand."* |
| Schemer | company | *"A well-written letter is worth more than three seasons of good numbers."* |

### Step 4 — Append a skill-confidence suffix

Based on how the person's relevant skill compares to the implied choice's difficulty:

| Skill vs difficulty | Suffix style |
|---------------------|--------------|
| score ≥ difficulty + 20 | Confident assertion: *"I have handled arrangements like this before."* |
| score ≥ difficulty | Measured: *"It is not without risk, but it is manageable."* |
| score < difficulty | Overconfident (if Bold/Pragmatist/Schemer) or hedge (if Cautious/Traditionalist): *"We will find a way through it, I have no doubt."* / *"I confess I am less certain of my read on this than I would like."* |
| no skill check | Neutral observation on the event stakes |

### Step 5 — Assemble

```
final text = opening_fragment + " " + skill_suffix
```

Total length target: 2–3 sentences (40–90 words). Long enough to feel
considered; short enough to read in a glance.

---

## Trait → Choice Bias Table

These weights shift the personal desirability score for choices matching
each pattern. Weights are additive.

| Trait | Bias direction | Weight |
|-------|---------------|--------|
| `greedy` | +gold / +goods consequence | +25 |
| `greedy` | −gold consequence | −20 |
| `generous` | +disposition / +opinion | +20 |
| `brave` | choice has a skill check | +15 |
| `craven` | choice has NO skill check | +20 |
| `craven` | choice has a skill check | −15 |
| `deceitful` | skillCheck.skill === 'deception' | +30 |
| `honest` | skillCheck.skill === 'deception' | −30 |
| `traditional` | +company standing | +20 |
| `traditional` | −company standing | −20 |
| `cosmopolitan` | +disposition / +opinion sauromatian_women | +25 |
| `xenophobic` | +disposition / +opinion sauromatian_women | −30 |
| `xenophobic` | −disposition sauromatian | +20 |
| `ambitious` | +company standing | +25 |
| `ambitious` | −company standing | −15 |
| `patient` | most cautious choice (no skill check, fewer consequences) | +15 |
| `wrathful` | highest magnitude consequence (any direction) | +20 |
| `welcoming` | +disposition / +opinion | +20 |
| `proud` | avoids negative company standing choices | +15 |
| `clever` | skillCheck present (relishes complexity) | +10 |

### Cultural bias additions

| Primary culture | Bias |
|----------------|------|
| `kiswani_*` / `hanjoda_*` | +opinion sauromatian_women choices +15 |
| `imanian_*` | +company standing choices +10 |
| `settlement_native` | balanced (no bias) |

---

## Skill Confidence Detail

When scoring the implied recommendation choice:

```typescript
function skillConfidenceScore(skills: PersonSkills, check?: SkillCheck): number {
  if (!check) return 0;
  const score = getEffectiveSkill(skills, check.skill);   // base or derived
  const margin = score - check.difficulty;
  if (margin >= 20) return +20;   // clearly capable
  if (margin >= 0)  return +10;   // capable
  if (margin >= -15) return 0;    // slightly under — overconfident archetypes ignore this
  return -20;                     // clearly under — only Cautious/Traditionalist will admit it
}
```

Note that Bold and Schemer archetypes *ignore* negative confidence scores —
they recommend bold choices even when they cannot personally execute them.
This is the source of wrong advice.

---

## UI Changes

### CouncilFooter — each occupied seat card

**Current:**
```
┌──────────────────────────┐
│ Firstname Familyname     │
│ [Role badge]             │
└──────────────────────────┘
```

**New:**
```
┌─────────────────────────────────┐
│ [portrait] Firstname Familyname │  ← portrait = 32×40 px image or fallback swatch
│            [Role badge]         │
└─────────────────────────────────┘
selected state: amber ring on card border
```

Portrait image selection uses `resolvePortraitSrc(person)` (see **Portrait Asset System** below). Card `cursor-pointer` always. Selected card gets `border-amber-400` ring.

### AdviceBubble — positioned above CouncilFooter

When an adviser is selected, a bubble renders at the top of the CouncilFooter
wrapper, above the seat strip. It is not floating/absolutely-positioned — it
is part of normal document flow so the layout doesn't jump.

```
┌──────────────────────────────────────────────────────────────────┐
│  "A tangible gift shows greater respect than do pretty words.    │
│   I have handled this kind of man before."                       │
│                                               — Kulbrast, Guard  │
└──────────────────────────────────────────────────────────────────┘
[ card ][ card* ][ card ][ card ][ card ][ card ][ card ]
                  ↑ selected (amber ring)
```

**Non-event screens:** No advice bubble appears. The cards still show
portraits and are clickable (could navigate to PersonDetail — future feature).
For now, clicking outside the event phase simply selects the card visually
with no bubble.

### EventView — choice buttons

The `description` text is not removed — it becomes a tooltip on hover over
the choice button. The description line is no longer visible by default;
hovering the button surfaces it as a `title` attribute tooltip (native browser
behavior, zero extra code) or a small Tailwind-styled popover if the native
tooltip is too plain.

**Default (no hover):**
```
[ Welcome them — but make clear the eldest daughter will marry one of your men in time. ]
```

**On hover:**
```
[ Welcome them — but make clear the eldest daughter will marry one of your men in time. ]
  ↳ tooltip: "A pragmatic arrangement. How it is offered will determine how it is received."
```

The `EventChoice.description` field is preserved in the type and in event
definitions. It moves from always-visible prose to on-demand context.

---

## Portrait Asset System

### File locations — current placeholders

```
assets/portraits/
  male/
    imanian/
      Imanian_M_001.png     ← placeholder for all Imanian male settlers
  female/
    Kiswani/
      Kiswani_F_001.png     ← placeholder for all Kiswani (Sauromatian) female settlers
```

> **Note on capitalisation:** the folder names are inconsistent (`male/imanian/` vs `female/Kiswani/`). Preserve exactly as-is; do not rename folders.

### Vite serving requirement

Vite only serves files placed in `public/` as static assets. The `assets/`
folder at project root is **not** served automatically. Two options:

- **Option A (recommended):** Move portrait files into `public/portraits/…`
  and reference them as `/portraits/male/imanian/Imanian_M_001.png`.
  No Vite config changes needed.
- **Option B:** Configure `vite.config.ts` to add a second static dir via
  `vite-plugin-static-copy` or by symlinking. More complex, not needed yet.

The implementation will use **Option A**. Portrait images will be moved to:

```
public/portraits/male/imanian/Imanian_M_001.png
public/portraits/female/Kiswani/Kiswani_F_001.png
```

### `resolvePortraitSrc(person: Person): string | null`

New pure function in `src/ui/components/portrait-resolver.ts`:

```typescript
export function resolvePortraitSrc(person: Person): string | null {
  const primaryGroup = person.heritage.bloodline
    .sort((a, b) => b.fraction - a.fraction)[0]?.group ?? '';

  if (person.sex === 'male' && primaryGroup === 'imanian') {
    return '/portraits/male/imanian/Imanian_M_001.png';
  }
  if (person.sex === 'female' &&
      (primaryGroup === 'kiswani_riverfolk' ||
       primaryGroup === 'kiswani_bayuk'     ||
       primaryGroup === 'kiswani_haisla')) {
    return '/portraits/female/Kiswani/Kiswani_F_001.png';
  }
  return null;  // all other combinations fall back to text portrait
}
```

When more portrait variants are added (`Imanian_M_002.png` etc.), a second
argument `variantSeed: number` will be added and the resolver will pick by
`seed % variantCount`. For now the function always returns `_001`.

### Usage — `Portrait.tsx` (lg variant)

The existing `lg` size variant shows the prose description block. Update it
to render the portrait image full-width at the top of the card when
`resolvePortraitSrc` returns a non-null path, falling back to the existing
skin-tone swatch when it returns `null`.

```
┌──────────────────────────────┐
│  [portrait image, 100% wide, │
│   ~160px tall, object-cover] │  ← shown when src !== null
├──────────────────────────────┤  ← OR: existing colored swatch
│  prose description…          │
│  traits / skills strip       │
└──────────────────────────────┘
```

### Usage — `Portrait.tsx` (sm variant) and CouncilFooter

Both use the same resolved src. Render as a `32×40` `<img>` with
`object-cover` when available; render the skin-tone `div` swatch when not.

### Expansion path

The folder convention is `{sex}/{EthnicGroup}/{EthnicGroup}_{sex_initial}_{NNN}.png`.
Future portraits added to `public/portraits/` in this structure will be picked
up automatically once the resolver is updated with the correct group key and
variant count. No architectural changes needed.

---

## State Management

All advice state is **local to CouncilFooter** during the event phase.

```typescript
// CouncilFooter local state
const [selectedId, setSelectedId] = useState<string | null>(null);
const adviceCache = useRef<Map<string, string>>(new Map());  // key: personId+eventId

function getAdvice(person: Person, event: GameEvent): string {
  const key = `${person.id}:${event.id}`;
  if (!adviceCache.current.has(key)) {
    const seed = hashCode(key);
    adviceCache.current.set(key, generateAdvice(person, event, seed));
  }
  return adviceCache.current.get(key)!;
}
```

The cache resets naturally when the component remounts between events.
`hashCode` is a simple deterministic string hash (djb2 or similar).

CouncilFooter needs access to the current event. Two options:
- **Option A**: Pass `currentEvent?: GameEvent` as a prop from `GameScreen`
- **Option B**: CouncilFooter reads `pendingEvents[currentEventIndex]` from
  the store directly

Option B is simpler. CouncilFooter already reads the store.

---

## Implementation Steps

| Step | Task | Files |
|------|------|-------|
| 1 | Move portrait files into `public/portraits/` preserving folder structure | file move only |
| 2 | Write `resolvePortraitSrc()` | `src/ui/components/portrait-resolver.ts` (new) |
| 3 | Update `Portrait.tsx` lg variant to render image when src resolves; update sm variant | `src/ui/components/Portrait.tsx` |
| 4 | Write `generateAdvice()` + `scoreChoices()` in `council-advice.ts` with full template corpus | `src/simulation/events/council-advice.ts` (new) |
| 5 | Add portrait image + click handler to CouncilFooter cards; add `selectedId` state | `src/ui/layout/CouncilFooter.tsx` |
| 6 | Build `AdviceBubble` component | `src/ui/components/AdviceBubble.tsx` (new) |
| 7 | Wire bubble into CouncilFooter above the seat strip | `src/ui/layout/CouncilFooter.tsx` |
| 8 | Convert `description` on choice buttons to hover tooltip in EventView | `src/ui/views/EventView.tsx` |
| 9 | Write tests for `scoreChoices()` covering trait bias and skill confidence paths | `tests/events/council-advice.test.ts` (new) |

---

## Files Created / Modified

| File | Change |
|------|--------|
| `public/portraits/male/imanian/Imanian_M_001.png` | Moved from `assets/` |
| `public/portraits/female/Kiswani/Kiswani_F_001.png` | Moved from `assets/` |
| `src/ui/components/portrait-resolver.ts` | New — `resolvePortraitSrc()` |
| `src/ui/components/Portrait.tsx` | Modified — image rendering when portrait resolves |
| `src/simulation/events/council-advice.ts` | New — all advice logic |
| `src/ui/components/AdviceBubble.tsx` | New — bubble UI component |
| `src/ui/layout/CouncilFooter.tsx` | Modified — portrait image + selection + bubble |
| `src/ui/views/EventView.tsx` | Modified — description → hover tooltip |
| `tests/events/council-advice.test.ts` | New — unit tests for scoring logic |

---

## Notes & Decisions Deferred

- **Portrait variants**: The resolver currently always returns `_001`. When
  a second portrait per group is added, introduce a `variantSeed` argument
  derived from the person's ID so assignment is stable across sessions.
- **Other ethnic groups**: Hanjoda and mixed-heritage people fall back to the
  text portrait until their images are added. The resolver's fallback path
  handles this transparently.
- **Portrait capitalisation**: folder names are preserved exactly as created
  (`male/imanian/` lowercase, `female/Kiswani/` capital K). Do not rename.
- **Adviser disagreement display**: A future option is to show a visual
  indicator (coloured dot or icon on the card) hinting that this adviser
  leans toward risky vs safe, before the player clicks. Deferred to Phase 4.
- **Out-of-event advice**: On non-event screens the bubble could show
  personality/background flavour text for the selected adviser. Deferred.
- **EventChoice.description field**: Preserved in the type and in all event
  definitions. Rendered as a tooltip on hover from this phase forward. The
  field continues to be the authoritative authoring note for each choice.

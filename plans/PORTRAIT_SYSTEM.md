# Portrait System — Design & Implementation Plan

## Overview

Each person in the settlement is represented by a portrait image that evolves across 4 life stages (child → young adult → adult → senior). Portraits are grouped by ethnic category and sex. A stable variant number is assigned to every person at birth and persists in the save file, so the same face is always shown — just at a different age.

---

## Status

🔲 Not started

---

## Portrait Categories

Portraits are **not** 1-to-1 with the 8 genetic `EthnicGroup` sub-groups. Instead they use broader visual categories that map multiple sub-groups to a shared portrait pool.

| `PortraitCategory` | Covers | Status |
|--------------------|--------|--------|
| `imanian` | Full / dominant Imanian bloodline (≥ 75% imanian) | Male: 🔲 · Female: 🔲 |
| `kiswani` | All three Kiswani sub-groups (riverfolk, bayuk, haisla) ≥ 75% combined | Male: 🔲 · Female: 🔲 |
| `hanjoda` | All four Hanjoda sub-groups ≥ 75% combined | Male: 🔲 · Female: 🔲 |
| `mixed_imanian_kiswani` | Neither group dominant; imanian + kiswani combined ≥ 80% | Male: 🔲 · Female: 🔲 |
| `mixed_imanian_hanjoda` | Neither group dominant; imanian + hanjoda combined ≥ 80% | Male: 🔲 · Female: 🔲 |
| `mixed_kiswani_hanjoda` | Neither group dominant; kiswani + hanjoda combined ≥ 80% | Male: 🔲 · Female: 🔲 |

**Category assignment logic** (in `portrait-resolver.ts`):
1. Sum bloodline fractions by macro-group (imanian / kiswani-total / hanjoda-total)
2. If any single macro-group ≥ 75% → use that group's category
3. If imanian + kiswani ≥ 80% with neither dominant → `mixed_imanian_kiswani`
4. (Future) Equivalent checks for other mixed pairings
5. No match → `null` (SVG fallback renders)

---

## Age Stages

| Stage | Age range |
|-------|-----------|
| `child` | 0 – 13 |
| `young_adult` | 14 – 29 |
| `adult` | 30 – 54 |
| `senior` | 55+ |

These boundaries align with the game's existing age mechanics (marriage eligibility ~14, Kethara's Bargain fertility ceiling 52–55).

---

## File Naming Convention

```
public/portraits/{sex}/{category}/{category}_{sex_abbr}_{stage}_{nnn}.png
```

- `{sex}` — `male` or `female`
- `{category}` — matches `PortraitCategory` values above (snakecase)
- `{sex_abbr}` — `m` or `f`
- `{stage}` — `child`, `young_adult`, `adult`, `senior`
- `{nnn}` — zero-padded 3-digit variant number: `001`, `002`, `003`, …

**Examples:**
```
public/portraits/male/imanian/imanian_m_child_001.png
public/portraits/male/imanian/imanian_m_young_adult_002.png
public/portraits/male/imanian/imanian_m_adult_003.png
public/portraits/male/imanian/imanian_m_senior_001.png
public/portraits/female/kiswani/kiswani_f_young_adult_002.png
public/portraits/male/mixed_imanian_kiswani/mixed_imanian_kiswani_m_adult_001.png
```

**Expanding the pool:** Adding a new variant is as simple as dropping in the new `.png` and bumping the count for that slot in `PORTRAIT_REGISTRY`. No other code changes required.

---

## Registry Design

`PORTRAIT_REGISTRY` in `portrait-resolver.ts` maps `category → sex → stage → variant count`. Any slot with count `0` means no art exists yet — the resolver returns `null` and the SVG fallback is used. No missing-file errors, no broken images.

```typescript
// Rough structure — counts updated as art is added
const PORTRAIT_REGISTRY: Record<PortraitCategory, Record<'male'|'female', Record<AgeStage, number>>> = {
  imanian: {
    male:   { child: 3, young_adult: 3, adult: 3, senior: 3 },
    female: { child: 0, young_adult: 0, adult: 0, senior: 0 },
  },
  kiswani: {
    male:   { child: 3, young_adult: 3, adult: 3, senior: 3 },
    female: { child: 3, young_adult: 3, adult: 3, senior: 3 },
  },
  mixed_imanian_kiswani: {
    male:   { child: 3, young_adult: 3, adult: 3, senior: 3 },
    female: { child: 3, young_adult: 3, adult: 3, senior: 3 },
  },
  hanjoda:                { male: { child: 0, ... }, female: { ... } },
  mixed_imanian_hanjoda:  { male: { child: 0, ... }, female: { ... } },
  mixed_kiswani_hanjoda:  { male: { child: 0, ... }, female: { ... } },
}
```

**Graceful degradation for old saves:** If a person's saved `portraitVariant` is higher than the current registry count (e.g., an old save from before more variants were added), the resolver clamps to the highest available variant.

---

## Model Change — `portraitVariant` on Person

Add `portraitVariant: number` to the `Person` interface. It is:
- A **1-indexed integer** (1, 2, 3, …)
- **Assigned once at `createPerson()` time** and never changed
- **A plain number** — no Map serialisation needed, JSON round-trips automatically

**Assignment logic in `createPerson()`:**
- If `rng` is provided → `rng.nextInt(1, DEFAULT_VARIANT_COUNT)` where `DEFAULT_VARIANT_COUNT = 3`
- If no `rng` (test/legacy path) → default `1`

The resolver uses `portraitVariant` directly; if the registry count for that slot is `0`, it returns `null` regardless.

---

## Codebase Changes

| File | Change |
|------|--------|
| `src/simulation/population/person.ts` | Add `portraitVariant: number` to `Person` interface; assign in `createPerson()` |
| `src/ui/components/portrait-resolver.ts` | Full rewrite: add `PortraitCategory`, `AgeStage` types, `PORTRAIT_REGISTRY`, `getAgeStage()`, `getPortraitCategory()`, update `resolvePortraitSrc(person)` |
| `src/simulation/genetics/fertility.ts` | Assign `portraitVariant` when creating newborns |
| `src/stores/game-store.ts` | Assign `portraitVariant` on founding settlers |

---

## Initial Art Scope (60 images)

**5 category/sex combos × 4 stages × 3 variants = 60 images**

Generated with Stable Diffusion. The key constraint for the "same person aging" effect: **variant `_001` across all 4 stages depicts one consistent individual** — same face, different age. Use a consistent seed or character LoRA per variant number.

| Set | Count | Folder |
|-----|-------|--------|
| Imanian male | 12 | `public/portraits/male/imanian/` |
| Kiswani male | 12 | `public/portraits/male/kiswani/` |
| Kiswani female | 12 | `public/portraits/female/kiswani/` |
| Mixed Imanian-Kiswani male | 12 | `public/portraits/male/mixed_imanian_kiswani/` |
| Mixed Imanian-Kiswani female | 12 | `public/portraits/female/mixed_imanian_kiswani/` |

**Deferred to later batches:**
- Imanian female
- Hanjoda (all sub-groups)
- Mixed Imanian-Hanjoda, Mixed Kiswani-Hanjoda

---

## Folder Structure (at launch scope)

```
public/portraits/
  male/
    imanian/
      imanian_m_child_001.png … imanian_m_senior_003.png
    kiswani/
      kiswani_m_child_001.png … kiswani_m_senior_003.png
    mixed_imanian_kiswani/
      mixed_imanian_kiswani_m_child_001.png … mixed_imanian_kiswani_m_senior_003.png
    hanjoda/                          ← empty until art is ready
  female/
    imanian/                          ← empty until art is ready
    kiswani/
      kiswani_f_child_001.png … kiswani_f_senior_003.png
    mixed_imanian_kiswani/
      mixed_imanian_kiswani_f_child_001.png … mixed_imanian_kiswani_f_senior_003.png
    hanjoda/                          ← empty until art is ready
```

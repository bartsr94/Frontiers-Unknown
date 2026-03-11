# Language Acquisition System — Implementation Plan

**Status:** In Progress  
**Scope:** Phase 3 sub-feature — "Living Languages"  
**Depends on:** Phase 2 complete (genetics, fertility, marriage all working)

---

## Problem Statement

As of Phase 2 completion:

1. **Newborns** inherit the mother's `languages` array verbatim at 100% fluency — a child
   hears both parents' tongues from birth but speaks neither perfectly from day one.
2. **Adult settlers** never learn new languages — Imanian men never pick up Kiswani even
   after years of living alongside Sauromatian wives, and vice versa.
3. **Hanjoda groups** are incorrectly assigned `'kiswani'` as their primary language (shared
   with Kiswani sub-groups) — there is no linguistic distinction between the two Sauromatian
   macro-groups.
4. **Language distribution** in `SettlementCulture` is static after game start — real
   demographics never shift.

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Sauromatian language count | Two: `'kiswani'` + `'hanjoda'` | Realistic friction between macro-groups |
| Child starting fluency | Both parents' primary languages at **0.10** | Heard from birth, not yet speaking |
| Adult learning mechanism | Passive drift each turn | Small increment per language × community fraction |
| Tradetalk role | Pidgin bridge, hard-capped at **0.50** | Functional but never native-level |
| Creole emergence | Emergent after **20 turns** (≈5 years) of bilingual majority | Triggers a one-time game notification |
| Language barriers | **Gameplay effects** — marriage warning + cultural tension contribution | Meaningful but not blocking |
| Language forgetting | Not modelled in this phase | Defer to Phase 4 |

---

## Implementation Phases

### Phase A — Type Foundations
*Pure data additions. No simulation logic. All steps safe to do in parallel.*

1. **`LanguageId`** — add `'hanjoda'` to the union in `src/simulation/population/person.ts`
2. **`ETHNIC_GROUP_PRIMARY_LANGUAGE`** — add a `Record<EthnicGroup, LanguageId>` lookup
   constant (same file or in the new acquisition module). Maps:
   - `kiswani_*` → `'kiswani'`
   - `hanjoda_*` → `'hanjoda'`
   - `'imanian'`  → `'imanian'`
3. **`SettlementCulture`** — add two new fields in `src/simulation/turn/game-state.ts`:
   ```ts
   languageDiversityTurns: number; // turns where ≥2 languages each exceed 10% share
   languageTension: number;        // 0.0–1.0; peaks at perfect 50/50 bilingual split
   ```
   Add `languageDiversityTurns: 0, languageTension: 0` to the initial state factory in
   `src/stores/game-store.ts`.

---

### Phase B — Language Acquisition Engine
*New file. Depends on Phase A.*

**File:** `src/simulation/culture/language-acquisition.ts`

```
Constants
  CONVERSATIONAL_THRESHOLD = 0.3    ← minimum fluency to count as a "speaker"
  
Functions
  getLanguageLearningRate(age: number): number
    → per-turn base learning increment
    → age bands:
        0–5:    0.040  (babies absorb language rapidly)
        5–12:   0.025  (children — still fast)
        12–20:  0.012  (teens — good but slowing)
        20–40:  0.006  (working adults)
        40–60:  0.003  (slower acquisition)
        60+:    0.001  (very slow in old age)

  applyLanguageDrift(
    person: Person,
    settlementLangFractions: Map<LanguageId, number>
  ): LanguageFluency[]
    → for each language in settlementLangFractions:
        delta = getLanguageLearningRate(person.age)
                × communityFraction
                × (1 − currentFluency)   ← diminishing returns
        → clamp fluency to [0, 1]
    → tradetalk special rule:
        if person has NO language with fluency ≥ CONVERSATIONAL_THRESHOLD
        among the settlement's top-2 languages:
            tradetalk grows at 2× normal rate, hard-capped at 0.50

  resolveChildLanguages(
    mother: Person,
    father: Person
  ): LanguageFluency[]
    → collect each parent's languages where fluency ≥ CONVERSATIONAL_THRESHOLD
    → deduplicate (shared language counts once)
    → each language starts at 0.10 fluency in the newborn

  updateSettlementLanguages(
    people: Map<string, Person>
  ): Map<LanguageId, number>
    → for each language: fraction of living people with fluency ≥ CONVERSATIONAL_THRESHOLD
    → includes tradetalk and settlement_creole

  updateLanguageTension(
    langFractions: Map<LanguageId, number>
  ): number
    → tension peaks at 1.0 on a perfect 50/50 split between two languages
    → near-zero when one language > 75% share
    → formula: 1 − |dominantFraction − 0.5| × 2   (for normalised two-language case)
    → returns value in [0, 1]
```

---

### Phase C — Wire into Turn Processor
*Depends on Phase B. Modify `src/simulation/turn/turn-processor.ts`.*

In `processDawn()`, after the existing aging/mortality loop and before production:

1. Call `applyLanguageDrift(person, state.culture.languages)` for every surviving person in
   `updatedPeople`, replacing their `languages` array.
2. After the full person loop:
   - Call `updateSettlementLanguages(updatedPeople)` → store as `updatedLanguageFractions`.
   - Call `updateLanguageTension(updatedLanguageFractions)` → `newLanguageTension`.
   - Increment `languageDiversityTurns` if ≥ 2 languages each exceed 10% share; else keep.
3. Return these three values in `DawnResult` (add new fields):
   ```ts
   updatedLanguageFractions: Map<LanguageId, number>;
   newLanguageTension: number;
   languageDiversityTurns: number;
   ```
4. The Zustand store merges these into `state.culture` after `processDawn`.

---

### Phase D — Fix Child Birth Language
*Depends on Phase B. Modify `src/simulation/genetics/fertility.ts`.*

In `processPregnancies()`, replace:
```ts
languages: [...mother.languages],
```
with:
```ts
languages: resolveChildLanguages(mother, father),
```

Import `resolveChildLanguages` from the acquisition module. Note: `father` is already
available in scope at that point.

---

### Phase E — Fix Founding Women Language Assignment
*Depends on Phase A only. Modify `src/stores/game-store.ts`.*

Replace the hardcoded `{ language: 'kiswani', fluency: 1.0 }` with:
```ts
{ language: ETHNIC_GROUP_PRIMARY_LANGUAGE[sauroGroup], fluency: 1.0 }
```

A Hanjoda founding woman should speak `'hanjoda'`, not `'kiswani'`.

---

### Phase F — Gameplay Effects
*Depends on Phase B.*

#### F1 — Marriage Language Compatibility (marriage.ts + MarriageDialog.tsx)

Add `languageCompatibility: 'shared' | 'partial' | 'none'` to `MarriageInfo`:
- `'shared'` — at least one language where both have fluency ≥ 0.3
- `'partial'` — one person has ≥ 0.3 in a language the other has < 0.3 but > 0
- `'none'` — no overlap whatsoever

`canMarry()` does NOT block on language — it is purely informational.
`MarriageDialog.tsx` surfaces:
- `'none'` → amber warning: *"No shared language — the couple will struggle to communicate"*
- `'partial'` → grey note: *"Partial understanding — communication will take effort"*

#### F2 — Cultural Tension Contribution (turn-processor.ts)

`languageTension` is a standalone field (already added in Phase A). The existing
`religiousTension` is NOT affected. Both feed into the event system separately.

#### F3 — Event Prerequisite Type (engine.ts)

Add `'language_tension_above'` to `PrerequisiteType` union. Params: `{ threshold: number }`.
Add at least one triggerable event (in a later definitions file or piggybacked on cultural.ts)
that uses this prerequisite when `languageTension > 0.4`.

---

### Phase G — Tradetalk & Creole Emergence
*Depends on Phase C.*

**Tradetalk** is handled within `applyLanguageDrift` (Phase B) — no additional changes.

**Creole emergence** in `processPregnancies` (fertility.ts):
- If `state.culture.languageDiversityTurns >= 20`, newly born children receive
  `settlement_creole` at `0.10` appended to their `resolveChildLanguages()` result.
- `processPregnancies` needs `languageDiversityTurns` passed in — add it as a parameter.

**Notification** — add a `creoleEmerged: boolean` field to `DawnResult`. The Zustand store
triggers a one-time notification if `creoleEmerged && !state.flags.creoleEmergedNotified`.
(A simple boolean flag can live in a `GameFlags` object added to `GameState` if needed,
or the store can check the first time any person has `settlement_creole` in their languages.)

---

### Phase H — Tests
*New file: `tests/culture/language-acquisition.test.ts`*

Tests to write:

| Function | Test case |
|----------|-----------|
| `resolveChildLanguages` | child gets both parents' languages at 0.10 |
| `resolveChildLanguages` | deduplication when both parents speak same language |
| `resolveChildLanguages` | single-language case (only one parent qualifies) |
| `resolveChildLanguages` | neither parent qualifies → empty array |
| `getLanguageLearningRate` | ordering: age 3 > age 10 > age 25 > age 50 > age 70 |
| `getLanguageLearningRate` | boundary values at each age band |
| `applyLanguageDrift` | 100% community fraction → fluency converges toward 1.0 |
| `applyLanguageDrift` | 0% community fraction → no change |
| `applyLanguageDrift` | diminishing returns: higher current fluency → smaller delta |
| `applyLanguageDrift` | tradetalk boost fires when person has no conversational language |
| `applyLanguageDrift` | tradetalk hard cap at 0.50 |
| `updateSettlementLanguages` | threshold counting — only fluency ≥ 0.3 counts |
| `updateSettlementLanguages` | empty population → empty map |
| `updateLanguageTension` | peaks near 1.0 at 50/50 split |
| `updateLanguageTension` | near 0 when one language > 75% |

---

## Affected Files

| File | Change type |
|------|------------|
| `src/simulation/population/person.ts` | Add `'hanjoda'` to `LanguageId`; add `ETHNIC_GROUP_PRIMARY_LANGUAGE` |
| `src/simulation/turn/game-state.ts` | Add `languageDiversityTurns` + `languageTension` to `SettlementCulture` |
| `src/stores/game-store.ts` | Init new fields; fix founding women language |
| `src/simulation/genetics/fertility.ts` | Use `resolveChildLanguages`; pass `languageDiversityTurns` |
| `src/simulation/turn/turn-processor.ts` | Wire drift + settlement language update; expand `DawnResult` |
| `src/simulation/population/marriage.ts` | Add `languageCompatibility` to `MarriageInfo` + `getMarriageability` |
| `src/ui/overlays/MarriageDialog.tsx` | Display language compatibility warning |
| `src/simulation/events/engine.ts` | Add `'language_tension_above'` prerequisite type |
| **NEW** `src/simulation/culture/language-acquisition.ts` | Core acquisition engine |
| **NEW** `tests/culture/language-acquisition.test.ts` | Unit tests for acquisition engine |

---

## Verification Checklist

- [ ] `npx tsc --noEmit` → zero errors after each phase
- [ ] `npm test` → all 139 existing tests still pass
- [ ] 15+ new tests pass in `language-acquisition.test.ts`
- [ ] Manual: new game with Hanjoda tribe → founding women have `language: 'hanjoda'`
- [ ] Manual: advance 20 turns with mixed couple → Imanian men show non-zero Kiswani fluency
- [ ] Manual: child of mixed couple → PersonDetail shows both languages at low/growing values, not 1.0
- [ ] Manual: MarriageDialog between no-shared-language couple → warning displayed
- [ ] Manual: 20+ turns bilingual settlement → creole notification fires; `settlement_creole` visible in PersonDetail

---

## Rate Formula Reference

```
delta(t) = getLearningRate(age) × communityFraction × (1 − currentFluency)
```

- `getLearningRate(age)` → see age band table above
- `communityFraction` → from `SettlementCulture.languages` map (0.0–1.0)
- `(1 − currentFluency)` → diminishing returns; near-native speakers plateau naturally

Example: A 25-year-old Imanian man (rate = 0.006) in a settlement where 60% speak Kiswani,
currently at 0.0 fluency:
- Turn 1: delta = 0.006 × 0.60 × 1.0 = 0.0036 → fluency 0.0036
- Turn 40 (~10 years): fluency ≈ 0.13 (conversational threshold not yet reached)
- Turn 80 (~20 years): fluency ≈ 0.24 (comprehensible but not fluent)

Children (rate = 0.025–0.040) in the same settlement would reach conversational (0.30)
within 3–5 years, matching real second-language acquisition patterns.

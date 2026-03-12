# Cultural Identity & Drift System — Design Plan

**Status: ✅ COMPLETE** — implemented in Phase 3, merged to main.

## Summary

Expand the existing (but inert) `culturalFluency` / `primaryCulture` mechanism into a live system.
Children of mixed-heritage parents receive blended culture fluency from both parents.
Adults drift slowly toward the dominant community culture each season.
New sub-group-specific `CultureId`s are added to reflect ethnic diversity more precisely.
The duplicate `culturalIdentity` top-level field on `Person` is removed in favour of `heritage.primaryCulture`.
The UI gains a Cultural Fluency section in the PersonDetail panel, mirroring the existing Languages bars.

---

## Background

The `Heritage` interface already tracks two parallel axes:

```
Heritage {
  bloodline: BloodlineEntry[]       // biological ancestry — fractions summing to 1.0
  primaryCulture: CultureId         // self-identification — dominant culture label
  culturalFluency: Map<CultureId, number>  // familiarity with each culture (0 = unknown, 1 = native)
}
```

In Phase 2 this was wired up at birth (children copy mother's heritage verbatim) but never updated after that. There is also a **redundant** `person.culturalIdentity: CultureId` field that always mirrors `heritage.primaryCulture`. This system makes it live.

---

## Design Decisions

| Question | Decision |
|---|---|
| Children of mixed parents | Blend both parents' `culturalFluency` 50/50 + add 0.05 `settlement_native` seed. `primaryCulture` = highest scoring; if none ≥ 0.5 → `settlement_native` |
| `settlement_native` emergence | Emergent only — compounds naturally as parents gain it and children inherit it |
| Drift trigger | Both passive (per-season) **and** event-driven. Events can make large jumps; passive is slow background change |
| Passive drift rate | **~0.025/season** (~10% shift per year). Major change takes most of a generation |
| Spouse influence | **+0.01/season** toward each spouse's `primaryCulture` |
| Cultural floor | Fluency is clamped to a minimum of 0.01 — you never completely lose your native roots |
| New CultureIds | 7 sub-group-specific ids added. Broad `kiswani_traditional` and `hanjoda_traditional` kept as pan-tribal blended identities |
| Imanian origin IDs | Semi-fixed — `imanian_homeland`/`ansberite`/`townborn` describe where you came from, but Ansberite settlers can drift toward `settlement_native` over time |
| Duplicate field | Remove `person.culturalIdentity` — only `person.heritage.primaryCulture` is used from now on |
| UI display | Primary culture label in identity grid + fluency bars for all secondary cultures scoring > 0.05 |

---

## CultureId Reference (complete list after this change)

### Imanian (colonist origin)
| ID | Meaning |
|---|---|
| `imanian_homeland` | From the Imanian heartland — full cultural Orthodox Imanian identity |
| `ansberite` | Ansberry Company settler — practical mercantile Imanian |
| `townborn` | Urban Imanian background |

### Settlement
| ID | Meaning |
|---|---|
| `settlement_native` | Born and raised in the settlement itself — the emergent creole identity |

### Sauromatian — broad
| ID | Meaning |
|---|---|
| `kiswani_traditional` | Pan-Kiswani identity; used for blended or acculturated people |
| `hanjoda_traditional` | Pan-Hanjoda identity; used for blended or acculturated people |

### Sauromatian — sub-group specific
| ID | Meaning |
|---|---|
| `kiswani_riverfolk` | Njaro-Matu / river trade networks |
| `kiswani_bayuk` | Deep Canopy — isolationist, herbal, matriarchal households |
| `kiswani_haisla` | Storm Coast — sea-going, mercantile |
| `hanjoda_stormcaller` | Stormcaller band — wandering, sky-reverent |
| `hanjoda_bloodmoon` | Bloodmoon — warrior culture, ochre-stained |
| `hanjoda_talon` | Talon smiths — amber-eyed, forge-tradition |
| `hanjoda_emrasi` | Emrasi — the most populous, syncretic, open to trade |

### Other (existing)
| ID | Meaning |
|---|---|
| `sauro_borderfolk` | Grew up on the Sauromatian / Imanian border — liminal identity |
| `sauro_wildborn` | Raised fully outside Imanian contact — deep wilderness tradition |

---

## Architecture

### New file: `src/simulation/population/culture.ts`

```typescript
// Exports:
CULTURE_LABELS: Record<CultureId, string>
SAUROMATIAN_CULTURE_IDS: ReadonlySet<CultureId>
ETHNIC_GROUP_CULTURE: Record<EthnicGroup, CultureId>    // maps founding women correctly

deriveCulture(mother: Person, father: Person, childBloodline: BloodlineEntry[]): Heritage
  → blends both parents' culturalFluency 50/50
  → adds 0.05 settlement_native seed
  → primaryCulture = highest key, or settlement_native if none ≥ 0.5

buildSettlementCultureDistribution(people: Map<string, Person>): Map<CultureId, number>
  → fraction of living people per primaryCulture

processCulturalDrift(people: Map<string, Person>, rng: SeededRNG): Map<string, Person>
  → pure function; no mutation
  → community pull at 0.025/season per culture slot  
  → spouse pull at 0.01/season toward spouse primaryCulture
  → floor 0.01; recompute primaryCulture after update
```

### Changed: `src/simulation/genetics/fertility.ts`

Child `Heritage` block replaced with `deriveCulture(mother, father, childBloodline)`.

### Changed: `src/simulation/turn/turn-processor.ts`

```
processDawn():
  1. age people
  2. processPregnancies() → births
  3. processCulturalDrift() ← NEW: slow background drift
  4. mortality
  5. production / consumption
  6. sync SettlementCulture from population  ← NEW: culturalBlend, religions, languages
```

`DawnResult` gains `updatedCulture: SettlementCulture`.

### Changed: Person model

- `CultureId` union extended with 7 new sub-group ids
- `Person.culturalIdentity` field **removed** → replaced everywhere by `person.heritage.primaryCulture`
- `createPerson()` default: `heritage.primaryCulture = 'ansberite'`, culturalFluency `{ ansberite: 1.0 }`

---

## Implementation Phases

### Phase 1 — Data model + field unification (no logic changes)
1. Expand `CultureId` in `person.ts`
2. Remove `Person.culturalIdentity` field
3. Update all 12 usage sites: `event-filter.ts`, `marriage.ts` ×6, `Portrait.tsx`, `PersonDetail.tsx`, `fertility.ts`
4. Expand `SAUROMATIAN_CULTURES` set in `marriage.ts`
5. Fix founding Sauromatian women bug in `game-store.ts` — use `ETHNIC_GROUP_CULTURE` map
6. Fix tests in `event-filter.test.ts` that use `culturalIdentity: ...` on `makePerson`

### Phase 2 — New `culture.ts` + child derivation + per-turn drift
7. Create `culture.ts` with all exports above
8. Update `fertility.ts` child Heritage block
9. Update `turn-processor.ts`: call drift + sync settlement culture
10. Update `game-store.ts`: apply `DawnResult.updatedCulture`

### Phase 3 — UI
11. Update `PersonDetail.tsx`: import `CULTURE_LABELS`, add Cultural Fluency section
12. Update `Portrait.tsx`: field access + optional new paint entries

### Phase 4 — Tests
13. Create `tests/population/culture.test.ts`
14. Update `tests/population/demographics.test.ts` — assert blended child culture

---

## Verification Checklist

- [ ] `npx tsc --noEmit` — zero errors
- [ ] `npm test` — all prior tests pass
- [ ] New `culture.test.ts` passes
- [ ] Manual: Hanjoda Talon founding women get `hanjoda_talon` culture (not `kiswani_traditional`)
- [ ] Manual: after 4+ turns, Sauromatian women gain small Imanian fluency; men gain small Sauromatian fluency
- [ ] Manual: child of mixed parents has both cultures in fluency Map
- [ ] Manual: PersonDetail shows Cultural Fluency bars for mixed individuals

# Phase 3 — Skills System Design

**Status:** Planning  
**Depends on:** Phase 2 complete (all 139 tests passing, zero compile errors)

---

## Overview

Add six base skills and seven derived skills to every `Person`. Skills are numeric (1–100), set at character creation, influenced by existing personality and aptitude traits, and static until changed by future events.

Skills serve two purposes:
1. **Visible character depth** — players can evaluate who is best suited for a given task.
2. **Event hooks** — future event consequences and choices will reference skill values to determine outcomes (raids, negotiations, harvests, etc.).

---

## Base Skills

| Skill | Description |
|-------|-------------|
| **Animals** | Handling, husbandry, and knowledge of livestock and wild animals. The highest-ranked council member's Animals skill contributes to herd health and cattle production per turn. |
| **Bargaining** | Trade, negotiation, and persuasion. Primary skill for traders and a secondary benefit for emissaries and explorers. Allows talking out of dangerous encounters (bandits, hostile tribes). |
| **Combat** | Raiding, defence, hunting, and general martial ability. Vital for guards on exploration parties. |
| **Custom** | Knowledge of law, tradition, and cultural protocol. Primary skill for emissaries and lawspeakers. Required to navigate inter-tribal obligations and legal disputes. |
| **Leadership** | Commanding, inspiring, and persuading groups. Important for chiefs, council heads, and anyone managing other people. Boosts negotiation outcomes. |
| **Plants** | Agriculture, foraging, herbalism. Contributes to food and medicine production. The relevant council member's Plants skill partially governs harvest yields. |

---

## Derived Skills

Derived skills are computed on demand from base skill averages. They are never stored on the person — they are always calculated from the current base values.

| Derived Skill | Formula | Description |
|---------------|---------|-------------|
| **Deception** | avg(Bargaining, Leadership) | Misdirection, lies, manipulation. Useful in espionage events and hostile negotiations. |
| **Diplomacy** | avg(Bargaining, Custom) | Formal inter-clan negotiation. Combines the ability to make deals with the cultural knowledge to do so correctly. |
| **Exploring** | avg(Bargaining, Combat) | Moving safely through unknown or dangerous territory — part bravado, part blade. |
| **Farming** | avg(Animals, Plants) | Overall agricultural competence. Combines livestock and crop skills into a single farming score. |
| **Hunting** | avg(Animals, Combat, Plants) | Tracking, killing, and using hunted animals effectively. Requires field knowledge of animals, plants, and the ability to fight. |
| **Poetry** | avg(Custom, Leadership) | Composing and reciting verse, participating in cultural ceremonies. Important for prestige events and Sauromatian diplomacy. |
| **Strategy** | avg(Combat, Leadership) | Military planning and tactical decision-making. Not just fighting — directing others to fight well. |

---

## Skill Ratings

The 1–100 numeric value maps to a named rating displayed in the UI. Ratings go from worst to best:

| Rating | Range | Short Code |
|--------|-------|------------|
| Fair | 1–25 | FR |
| Good | 26–45 | GD |
| Very Good | 46–62 | VG |
| Excellent | 63–77 | EX |
| Renowned | 78–90 | RN |
| Heroic | 91–100 | HR |

---

## Generation

Skills are generated at person creation using the seeded PRNG. The baseline distribution is a Gaussian centred at ~28 (low end of Good) with a standard deviation of ~15, clamped to [1, 100] and rounded to an integer. This produces a realistic population where most people are mediocre, a few are genuinely talented, and Heroic is rare.

### Trait Bonuses

After the raw roll, trait bonuses are added before the final clamp. No negative modifiers are applied in this phase — low natural rolls already produce below-average results for people without relevant skills.

| Trait | Bonus |
|-------|-------|
| `brave` | +15 Combat, +5 Leadership |
| `cruel` | +10 Combat |
| `strong` | +15 Combat, +10 Animals |
| `weak` | no bonus (naturally low rolls from Gaussian are sufficient) |
| `clever` | +15 Custom, +12 Leadership |
| `slow` | no bonus |
| `ambitious` | +12 Leadership |
| `gregarious` | +12 Bargaining |
| `patient` | +10 Plants, +8 Animals |
| `deceitful` | +12 Bargaining |
| `greedy` | +10 Bargaining |
| `proud` | +8 Leadership |
| `humble` | no bonus |
| `robust` | +10 Animals, +8 Plants |
| `veteran` | +20 Combat |
| `hero` | +15 Combat, +10 Leadership |
| `respected_elder` | +15 Leadership, +10 Custom |
| `traditional` | +10 Custom |
| `cosmopolitan` | +8 Bargaining |

---

## Implementation Plan

### Step 1 — Data model (`src/simulation/population/person.ts`)

Add the following **type definitions**:
- `SkillId` — `'animals' | 'bargaining' | 'combat' | 'custom' | 'leadership' | 'plants'`
- `DerivedSkillId` — `'deception' | 'diplomacy' | 'exploring' | 'farming' | 'hunting' | 'poetry' | 'strategy'`
- `SkillRating` — `'fair' | 'good' | 'very_good' | 'excellent' | 'renowned' | 'heroic'`
- `PersonSkills` — `Record<SkillId, number>` (integers 1–100)

Add the following **constants and utilities**:
- `SKILL_RATING_THRESHOLDS` — maps numeric breakpoints to `SkillRating` labels
- `getSkillRating(value: number): SkillRating` — pure function
- `getDerivedSkill(skills: PersonSkills, id: DerivedSkillId): number` — computes formula, rounds to integer
- `generatePersonSkills(traits: TraitId[], rng: RNG): PersonSkills` — produces seeded, trait-influenced skill set

Add `skills: PersonSkills` field to the `Person` interface.

Update `createPerson`:
- Signature becomes `createPerson(options: CreatePersonOptions, rng?: RNG)`
- If `options.skills` provided → use it directly
- Else if `rng` provided → call `generatePersonSkills(options.traits ?? [], rng)`
- Else → default all skills to 25 (maintains backward compatibility with existing tests)

### Step 2 — Store wiring (`src/stores/game-store.ts`)

- Wherever founding members or Sauromatian women are created with `createPerson(options)`, update to `createPerson(options, rng)` using the store's seeded RNG instance
- No serialisation changes required — `PersonSkills` is a plain object; the existing JSON round-trip handles it correctly

### Step 3 — PersonDetail UI (`src/ui/views/PersonDetail.tsx`)

Add a **Skills section** between the trait badges and the languages section.

Layout:
- Section header: "Skills"
- **Base skills**: 2-column grid. Each cell shows: skill name (title-cased) + rating label + narrow progress bar (width proportional to value/100)
- **Derived skills**: same 2-column grid below, with a subtle visual separator or lighter label style

Rating colour mapping (Tailwind):
| Rating | Bar / label colour |
|--------|-------------------|
| Fair | slate-400 |
| Good | green-500 |
| Very Good | teal-500 |
| Excellent | blue-500 |
| Renowned | purple-500 |
| Heroic | amber-400 |

### Step 4 — PeopleView sort tabs (`src/ui/views/PeopleView.tsx`)

Extend the existing sort controls:
- Existing sort keys (name, age, heritage, role) remain unchanged
- Add 6 new sort buttons, one per base skill: Animals · Bargaining · Combat · Custom · Leadership · Plants
- Active skill sort: roster orders **descending** (highest skill first, as requested)
- When a skill sort is active, add a skill rating badge column to each roster row showing the short code (FR / GD / VG / EX / RN / HR) in the matching rating colour

Derived skills are shown only in PersonDetail, not sortable in the roster.

---

## Verification Checklist

After implementation:

1. `npx tsc --noEmit` → zero errors
2. `npm test -- --run` → all 139 existing tests pass (the default-25 fallback in `createPerson` keeps demographic tests stable without modification)
3. Dev server — New game → open PersonDetail for a founding member → Skills section visible with 6 base + 7 derived skills, each with a labelled progress bar
4. Dev server — PeopleView → click "Combat" sort tab → roster reorders by combat descending, rating badge column appears
5. Browser console → `JSON.parse(localStorage.getItem('palusteria_save')).people[0]` → confirm `skills` object is present and serialised correctly

---

## Future Hooks (out of scope for this phase)

These are not implemented now but are the primary reason skills exist:

- **Event prerequisites** — events check `person.skills.combat >= 50` or derived `getDerivedSkill(person.skills, 'diplomacy') >= 60`
- **Event outcome modifiers** — higher skill → better narrative outcome and lower risk of negative consequences
- **Herd health modifier** — top Animals skill in council contributes a multiplier to cattle production in `processDawn`
- **Harvest modifier** — top Plants skill in council contributes to food production
- **Skill growth** — events may call `person.skills.animals += 5` when gained through experience; the architecture supports this already since skills are mutable integers

---

## Hard Rules (unchanged)

All existing rules continue to apply:
- No `Math.random()` — randomness through `createRNG` / seeded PRNG only
- No React imports in `src/simulation/`
- No `any` types
- `Map<K,V>` fields serialised as `[K,V][]` in localStorage (skills are a plain object — no issue here)

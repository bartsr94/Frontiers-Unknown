# Opinions System — Design & Implementation Plan

**Feature:** §6.2 — Inter-person opinion scores  
**Phase:** 3 (Living Settlement)  
**Status:** Planned

---

## Overview

Every person holds an opinion score (−100 to +100) toward every other person they know. Opinions are driven by shared culture, shared religion, common language, personality trait affinities and clashes, family bonds, and event history. Over time they decay toward neutral unless reinforced. When opinions drop far enough, emergent events fire — the player must choose how to respond, KoDP style. Autonomous behaviour means the *events fire inevitably*, not that the simulation acts without the player.

---

## Data Model

The `Person` interface already has a `relationships: Map<string, number>` field, serialised as `[string, number][]` in the save file. No schema changes are needed. The map is sparse: an absent key means neutral (0). Entries are only created when an opinion deviates meaningfully from zero.

**Population cap** — `OPINION_TRACK_CAP = 150`. Below the cap, new pairs are discovered each turn and baseline opinions are computed. Above the cap, only existing entries are updated. This keeps the number of tracked pairs manageable as the settlement grows.

---

## Opinion Sources

### One-time initialisation

When two people first appear in the same settlement — either at game start, on arrival of a new settler, or at the birth of a child — a baseline opinion is computed from static factors:

| Source | Value |
|--------|-------|
| Trait affinity (both share a "warmth" trait) | +8 to +12 |
| Trait clash (opposing trait pair) | −10 to −20 |
| Same primary culture | +10 |
| Same religion | +8 |
| No shared language at all | −15 |
| Tradetalk as the only bridge | −5 |

The sum is clamped to **[−80, +80]** to leave room for event history and family bonds to push opinions to the extremes.

### Family bond initialisation

When a child is born, a one-time boost is applied to the new `relationships` entries:

| Pair | Delta applied |
|------|--------------|
| Child ↔ mother | +30 each way |
| Child ↔ father | +30 each way |
| Mother → child | +25 |
| Father → child | +25 |
| Child ↔ each sibling | +15 each way |

These are initialisation boosts, not permanent floors. Without reinforcing factors (shared culture, religion, regular contact) they decay toward neutral over time like any other opinion.

### Per-turn drift (both directions)

Applied every `processDawn()`. The numbers are small — they matter over years, not turns.

| Condition (per pair, per turn) | Delta |
|-------------------------------|-------|
| Same `primaryCulture` | +0.8 |
| Different `primaryCulture` | −0.3 |
| Same `religion` | +0.3 |
| No shared language (both < 0.30 fluency in any common tongue) | −1.0 |
| Tradetalk as only bridge (both < 0.50, no other shared language) | −0.3 |

### Per-turn decay

After drift, all existing entries drift toward zero at **0.5 per turn**. If the absolute value would drop to or below zero, the entry is deleted — the pair returns to neutral and is no longer tracked. This naturally clears stale relationships and keeps the map sparse.

### Event consequences (`modify_opinion`)

Any event choice can carry a `modify_opinion` consequence. The `target` field is the **personId of the person being opinionated about**; the `value` field is a numeric delta. This shifts all other living persons' opinion of `target` by `value` — modelling a public act (a scandal, a heroic deed, a humiliation) that changes everyone's view simultaneously.

The existing `EventConsequence` shape requires no structural changes.

### Marriage

When a marriage is arranged, each spouse's opinion of the other is raised to at least **+40** (a floor, not an override — a pre-existing higher opinion is kept). The existing bystander opinion logic (trait-driven reaction from observers) is unchanged.

---

## Trait Affinities & Clashes

Stored in `src/data/trait-affinities.ts`.

### Conflicting pairs (one-time penalty on both sides)

| Pair | Penalty each way |
|------|-----------------|
| `cruel` ↔ `kind` | −20 |
| `honest` ↔ `deceitful` | −20 |
| `xenophobic` ↔ `welcoming` | −20 |
| `brave` ↔ `craven` | −15 |
| `greedy` ↔ `generous` | −15 |
| `traditional` ↔ `cosmopolitan` | −15 |
| `proud` ↔ `humble` | −10 |
| `wrathful` ↔ `patient` | −10 |

### Shared trait bonus (one-time bonus on both sides)

| Trait | Bonus |
|-------|-------|
| `gregarious` | +12 |
| `devout` | +10 |
| `honest` | +10 |
| `kind` | +8 |
| `generous` | +8 |
| `brave` | +8 |
| `traditional` | +8 |

---

## Autonomous Behaviour — Emergent Events

The three relationship events below live in `src/simulation/events/definitions/relationships.ts`. They use a new pair of `EventPrerequisite` types (`min_opinion_pair` / `max_opinion_pair`) defined in `engine.ts` and evaluated in `event-filter.ts`. To prevent spam, each event uses the existing `eventCooldowns` map with a pair-keyed ID (e.g., `evt_council_feud_${idA}_${idB}`).

---

### `evt_council_feud` — "Tension in the Council"

**Fires when:** Two council members have a mutual opinion below −50.

> *Two of your closest advisers are barely speaking. Every council session becomes a contest of wills.*

| Choice | Consequence |
|--------|-------------|
| **Mediate personally** *(diplomacy skill check)* | Pass → +20 opinion both ways. Fail → −5 opinion both ways (the attempt backfired). |
| **Reassign duties** | −5 goods (administrative disruption). Opinion stabilises: decay rate halved for 8 turns. |
| **Ignore it for now** | No immediate cost. Opinion continues to drift. If it reaches −80, `evt_settler_departure` becomes eligible. |

---

### `evt_marriage_strains` — "A Marriage Under Strain"

**Fires when:** A married pair has a mutual opinion below −40, and they have been married for at least 4 turns.

> *Your settlers notice the tension between them — arguments in the common house, cold silences at meals.*

| Choice | Consequence |
|--------|-------------|
| **Intervene and counsel them** *(leadership skill check)* | Pass → +20 opinion both ways. Fail → no change; one of them gains `scandal`. |
| **Arrange a gift or gesture** | −10 gold. +15 opinion both ways. No skill risk. |
| **Allow a formal separation** | They divorce (remove spousal link). Each takes −10 opinion of the player. |
| **Do nothing** | No cost. Tension persists; event can re-fire after cooldown. |

---

### `evt_settler_departure` — "Thinking of Leaving"

**Fires when:** One person has an opinion below −65 toward more than 50% of the people they have a relationship with.

> *Word reaches you that [Name] has been asking traders about the road south. They don't feel at home here any more.*

| Choice | Consequence |
|--------|-------------|
| **Talk to them personally** *(leadership skill check)* | Pass → +25 to their opinion of all settlement members. Fail → no change; their decision is made. |
| **Offer a material incentive** | −20 gold. They stay. +10 to their opinion of the player's council. |
| **Wish them well** | `remove_person`. They depart without ill will. The settlement loses them but gains nothing. |
| **Try to stop them** *(not yet recommended — placeholder for future enforcement events)* | Not implemented this phase. |

---

## Implementation Files

| Step | File | Action |
|------|------|--------|
| 1 | `src/data/trait-affinities.ts` | **New file** — `TRAIT_CONFLICTS` and `TRAIT_SHARED_BONUS` data |
| 2 | `src/simulation/population/opinions.ts` | **New module** — all pure opinion functions |
| 3 | `src/simulation/events/resolver.ts` | Implement `modify_opinion` case (currently falls through to `default`) |
| 4 | `src/simulation/turn/turn-processor.ts` | Wire `applyOpinionDrift` + `decayOpinions` into `processDawn()`; family bond init on births |
| 5 | `src/stores/game-store.ts` | Apply marriage opinion floor (+40) in `arrangeMarriage` action |
| 6 | `src/simulation/events/engine.ts` | Add `min_opinion_pair` / `max_opinion_pair` prerequisite types |
| 7 | `src/simulation/events/event-filter.ts` | Add 3 new events to `ALL_EVENTS`; evaluate opinion prerequisites |
| 8 | `src/simulation/events/definitions/relationships.ts` | **New file** — 3 autonomous events |
| 9 | `src/ui/views/PersonDetail.tsx` | Add "Relationships" section (top 5 positive, top 5 negative) |
| 10 | `src/ui/overlays/MarriageDialog.tsx` | Add mutual opinion display below language compatibility row |

---

## New Module: `src/simulation/population/opinions.ts`

```typescript
// Exports (all pure — no React, no Math.random, no DOM)

export const OPINION_TRACK_CAP = 150;

export type OpinionDelta = { personId: string; targetId: string; delta: number };

export function getOpinion(person: Person, targetId: string): number
export function setOpinion(person: Person, targetId: string, value: number): Person
export function adjustOpinion(person: Person, targetId: string, delta: number): Person

export function computeTraitOpinion(a: Person, b: Person): number
export function computeBaselineOpinion(a: Person, b: Person): number

export function initializeFamilyOpinions(
  child: Person,
  mother: Person,
  father: Person | undefined,
  siblings: Person[],
): OpinionDelta[]

export function applyOpinionDrift(people: Map<string, Person>): Map<string, Person>
export function decayOpinions(people: Map<string, Person>): Map<string, Person>
```

The module has zero side effects. `applyOpinionDrift` and `decayOpinions` return new `Map` instances with new `Person` objects where opinions changed — consistent with the rest of the simulation's immutable pattern.

---

## UI Specifications

### PersonDetail — Relationships section

Rendered after the Skills and Cultural Fluency sections. Hidden if `person.relationships.size === 0`.

- Lists up to **5 highest positive** and **5 lowest negative** opinions
- Each row: portrait stub (skin-tone swatch) + name + opinion badge
- Badge colours: `≥ +30` green · `−29 to +29` amber · `≤ −30` red

### MarriageDialog — Mutual opinion row

Inserted below the language compatibility row, above the trait display.

- Label: **"Current opinion"**
- Content: `[Person A → B: +12]` `[Person B → A: −5]` (two badges)
- If both are zero (no prior relationship): `"No prior relationship"` in muted text

---

## Tests

New file: `tests/population/opinions.test.ts`

| Test | Assertion |
|------|-----------|
| `getOpinion` with no entry | Returns 0 |
| `computeTraitOpinion` — cruel + kind | Returns −20 |
| `computeTraitOpinion` — two gregarious | Returns +12 |
| `computeTraitOpinion` — no shared/conflicting traits | Returns 0 |
| `computeBaselineOpinion` — same culture, same religion, shared language | Positive |
| `computeBaselineOpinion` — no shared language | Negative |
| `initializeFamilyOpinions` — child + mother | Returns delta of +30 each way |
| `initializeFamilyOpinions` — child + sibling | Returns delta of +15 each way |
| `decayOpinions` — opinion of +10 | Moves toward 0 |
| `decayOpinions` — opinion of +0.3 | Entry removed |
| `applyOpinionDrift` — same culture pair | Opinion increases each call |
| `applyOpinionDrift` — no shared language | Opinion decreases each call |
| `applyOpinionDrift` — above OPINION_TRACK_CAP | No new entries created |
| `applyOpinionDrift` — above cap, existing entry | Existing entry still updated |

All 385 existing tests continue to pass — no existing interfaces are modified.

---

## Open Questions / Future Work

1. **Retroactive init on old saves** — When a save is loaded and all `relationships` maps are empty, run a one-time `computeBaselineOpinion` for all pairs so existing games get a meaningful starting state. Simple to detect: `people.size > 0 && every person has empty relationships`.

2. **Asymmetric `modify_opinion`** — The broadcast model (everyone's opinion of X shifts) works for public events. Future events may need to target a specific observer→target pair; consider adding `modify_opinion_of: { observer, target, delta }` as a separate consequence type when that need arises.

3. **`reject_role` autonomous signal** — Phase 4 design: if a person's average opinion of the settlement (mean across all their relationship entries) drops below −50, they show as `"Reluctant"` in the role assignment UI. This is a display flag only and does not prevent assignment — the departure event handles the harder consequence.

4. **Friendship / enmity events** — Mirror of the feud event: if two people have mutual opinion above +75 for several turns, an `evt_close_friendship` event fires, offering the player a chance to deepen it into a formal bond that gives stat bonuses.

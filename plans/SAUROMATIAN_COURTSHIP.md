# Sauromatian Courtship & Companion System

## Design Document — Phase 4.3

---

## Context & Motivation

Sauromatian society is built around a 6:1 female-to-male ratio, a demographic
reality that produced a fundamentally different relationship with intimacy and
courtship. Unmarried Sauromatian women are not passive recipients of male
attention — they are active evaluators and pursuers. Pre-marital intimacy
carries no stigma; in fact it is culturally expected and spiritually endorsed
as Kethara's provision for a world with too few men.

Imanian culture runs in the opposite direction: a man has one wife, a home,
and children raised in orthodox faith. The Company men who form the settlement's
founding core carry this world-view with them.

The current systems model relationship-seeking entirely from the male
perspective. `seek_informal_union` only generates for non-Sauromatian men.
`seek_spouse` fires for both sexes but at the same opinion threshold and with
no cultural flavour. The settlement's Sauromatian women behave romantically
like quieter Imanians. This document corrects that.

---

## Design Goals

1. Sauromatian women actively pursue available men — opinions, schemes, and
   autonomous events should reflect this without player prompting.
2. Imanian men face genuine social pressure from this pursuit; they respond
   according to their own faith and temperament.
3. The player manages these social dynamics as a recurring settlement concern,
   not a one-off event.
4. Every mechanic integrates cleanly into the existing opinion, ambition,
   scheme, happiness, and marriage systems.
5. Content stays tasteful/implied — the mechanics model the social reality;
   individual intimate encounters are never depicted explicitly.

---

## A. New Ambition: `seek_companion`

### Purpose

Represents the Sauromatian pre-marriage testing phase: a woman has fixed her
attention on a specific man and is actively working to establish an ongoing
informal bond with him. This sits between casual coexistence and the
marriage-aimed `seek_spouse`.

### Formation Gate (`determineAmbitionType`, priority 0 — checked first for eligible women)

```
sex: 'female'
SAUROMATIAN_CULTURE_IDS.has(heritage.primaryCulture)    ← any sauro sub-group
spouseIds.length === 0                                   ← unmarried
age >= 16
socialStatus !== 'thrall'
role !== 'away'
NOT already holding any active ambition
```

**What makes a valid target?**
- Different sex
- Unmarried (spouseIds.length === 0 — she tolerates a concubine relationship)
- Age ≥ 18
- `getEffectiveOpinion(woman, man) >= 0` — even neutral is enough; she hasn't
  been *actually* repelled. The lack of positive opinion is the gap she intends
  to close.

An eligible candidate is required for the ambition to form. If no men in the
settlement qualify, no ambition forms (reflecting real scarcity).

### Fulfillment Logic (`evaluateAmbition`, new case)

| Condition | Status |
|---|---|
| Target is now a spouse of the woman | `'fulfilled'` |
| Target is now concubine in her household | `'fulfilled'` (partial win) |
| Target married someone else entirely | `'failed'` |
| Target died or left | `'failed'` |
| Stale after 30 turns | `'failed'` (shorter than default 40 — these shift faster) |
| Otherwise | `'ongoing'` |

### Label

`"Seeking a companion"` — same label as this will reuse a display string, but
displayed with the target's name appended: `"Seeking a companion — Edric"`.

---

## B. Differentiated `seek_spouse` Formation

Under the current system both sexes form `seek_spouse` at opinion ≥ 20. The
following cultural split replaces that single threshold:

| Character | Threshold | Notes |
|---|---|---|
| Imanian/orthodox (any sex) | opinion ≥ 25 | Unchanged in spirit — formal courtship requires meaningful positive regard |
| Sauromatian women | opinion ≥ 5 | She is already interested at near-neutral; she will build from there |
| Sauromatian women who already *held* a `seek_companion` ambition toward this target | opinion ≥ 0 | Companion phase naturally escalates |

**Implication**: Sauromatian women will form `seek_spouse` toward men much
sooner in the social calendar. Imanian men will still form it on the same
schedule as now.

**Additional condition for Sauromatian women's `seek_spouse`**:
She must be ≥ 16 (unchanged) AND the target must have ≥ 1 vacant wife slot
under Sauromatian rules (i.e., his household has fewer than 6 wives already).
Otherwise she stays at `seek_companion` indefinitely.

---

## C. Autonomous Opinion Drift — Sauromatian Women

New rule added to the per-turn opinion drift (alongside existing shared-role and
trait drifts):

### `applyCourtshipOpinionDrift(people, state)`

Called each dawn after existing drifts, before `decayOpinions`.

**Rule 1 — Active interest**: Any Sauromatian woman with a `seek_companion` or
`seek_spouse` ambition targeting a specific man gains **+1 opinion of her
target** per turn AND her target gains **+1 opinion of her** per turn.

This models the increased social attention both parties pay to each other —
she is pursuing him and he notices.

**Rule 2 — Proximity without pursuit**: Any unmarried Sauromatian woman
co-habiting with an unmarried man in the same household (or same very small
settlement pop < 10) and holding opinion ≥ 0 of him gains **+0.5/turn** (soft
floor, rounds down — effectively +1 every other turn). This models the ambient
social pressure of proximity in the absence of an explicit target.

**Rule 3 — Imanian discomfort**: Any Imanian-primary male (not in
`SAUROMATIAN_CULTURE_IDS`, religion `imanian_orthodox`) whose effective opinion
of an actively-pursuing Sauromatian woman is < 30 loses **−1 opinion of her**
per turn she holds `seek_companion` aimed at him. His cultural norms create
friction with her forward approach. This is the push-back mechanic that creates
event pressure.

*Note: Rule 3 only applies until he either marries her (clearing the dynamic),
or his opinion of her goes below −20 (a hard refusal state).*

---

## D. `scheme_court_person` — Cultural Weighting

The existing scheme engine already models courtship via `scheme_court_person`.
No new scheme type is required. Instead, the **generation probability** for
this scheme type is boosted for Sauromatian women:

In `generateScheme()`, when the candidate is a Sauromatian woman and the
potential target is an unmarried man:

- Base weight already includes `romantic` (+2) and `passionate` (+2)
- Add an **additional +3 flat weight** for Sauromatian women regardless of
  traits (cultural baseline)
- This means a trait-less Sauromatian woman generates `scheme_court_person`
  roughly 3× more often than a baseline Imanian man

The climax event `sch_courtship_discovered` will need a **culture-aware
description branch**: if the schemer is Sauromatian, the flavour should reflect
that her courtship is open/confident rather than secretive.

---

## E. New Events (7 events)

All events belong to the `'personal'` category and fit into
`src/simulation/events/definitions/relationships.ts`.

---

### E.1 `rel_sauro_woman_pursues`

**Title**: *She's Made Her Interest Known*

**Trigger**: `has_person_with_ambition: seek_companion`

**Actors**:
- `pursuer` — Sauromatian female, unmarried, age ≥ 16, has `seek_companion`
  ambition
- `subject` — male, unmarried, age ≥ 18

**Weight**: 3 | **Cooldown**: 6

**Description**: `{pursuer}` has made her interest in `{subject}` plain — not
coyly but in the Sauromatian way, directly and without apparent shame. She is
spending time near him, bringing him small attentions, asking other women how
he sleeps. `{subject}` has noticed. Whether he is flattered or alarmed
depends on the man.

**Choices**:

1. **Let it run its course** *(default)* — Sauromatian custom working as it
   should. No player interference.
   - Consequences: `modify_opinion_labeled {pursuer} → {subject} +8 "Shared attention"`,
     `modify_opinion_labeled {subject} → {pursuer} +5 "She noticed him"`

2. **Encourage her — arrange work in the same area** — More proximity, more
   opportunity.
   - Consequences: `modify_opinion {pursuer} +10`, `modify_opinion_pair
     {pursuer}/{subject} +6 "Shared work"`

3. **Caution her — the settlement needs discipline, not distraction** — Gently
   impose Imanian norms.
   - Consequences: `modify_opinion {pursuer} −12`, cultural tension +1 toward
     company direction (via `modify_cultural_blend −0.01`)

4. **Speak to {subject} — ask how he feels about this** — Player learns
   whether the man is receptive or resistant (drives future events).
   - Skill check: `diplomacy ≥ 30`, `best_council`
   - Success: `modify_opinion {subject} +8` (he appreciates being consulted),
     fires deferred `rel_sauro_courtship_clarified` in 2 turns
   - Failure: `modify_opinion {subject} −5` (he found the conversation
     awkward)

---

### E.2 `rel_sauro_courtship_clarified` *(deferred outcome of E.1 choice 4)*

**Title**: *Where He Stands*

**isDeferredOutcome**: true

**Actors**: `subject` (same man), `pursuer` (same woman, if still alive/present)

**Description**: `{subject}` has had time to think. Whether he is drawn to
`{pursuer}` or unsettled by her attention, he comes to you now with a clear
answer. He will not be evasive about it.

**Choices** (two branches — simulated by the actor presence and opinion at
resolution time):

A. *If `getEffectiveOpinion(subject, pursuer) ≥ 15`*:

1. **He is open to it — acknowledge the bond informally** → `modify_opinion_pair
   {subject}/{pursuer} +15 "Mutual understanding"`, helps `seek_companion`
   fulfillment path
2. **Formalise this as a betrothal now** → large opinion boosts both,
   `clear_ambition {pursuer}`

B. *If opinion < 15*:

1. **Reassure {subject} — he owes nothing** → `modify_opinion {subject} +10`,
   `modify_opinion {pursuer} −8`
2. **Encourage him to give it more time** → small opinion drift benefit,
   `modify_opinion {pursuer} −5` (modest disappointment but not a hard close)

---

### E.3 `rel_imanian_courtship_conflict`

**Title**: *It Is Not Our Way*

**Trigger**: `has_person_with_ambition: seek_companion`,
`min_imanian_population: 1` *(new prereq — at least one Imanian-primary
person; can check via `getImanianFraction > 0.25`)*

**Actors**:
- `dissenter` — Imanian-primary male, age ≥ 18, religion `imanian_orthodox`,
  unmarried, opinion of pursuer < 15
- `pursuer` — Sauromatian female with `seek_companion` targeting `dissenter`
  or any other man

**Weight**: 2 | **Cooldown**: 10

**Description**: `{dissenter}` comes to you with the blunt discomfort of a man
who does not know how to ask for what he needs tactfully. The women here —
`{pursuer}` specifically — pursue in ways that violate everything his upbringing
told him about how such things should work. He is not angry. But he is asking
you to do something.

**Choices**:

1. **Explain Sauromatian custom — ask him to keep an open mind** →
   `modify_opinion {dissenter} +5 "Leader heard me"`, no cultural consequence.
   Deferred event `rel_imanian_gradual_acceptance` in 4 turns.

2. **Validate his feelings — create more social separation** →
   `modify_opinion {dissenter} +15`, `modify_opinion {pursuer} −8`,
   `modify_cultural_blend +0.02` (slight move toward Imanian norms)

3. **Match him now — arrange a formal introduction to a willing Sauromatian
   woman** *(only available if a Sauromatian woman's `seek_spouse` or
   `seek_companion` targets him)* → Skips the courtship uncertainty,
   immediately fires `rel_mutual_attraction` with both actors bound.

4. **Tell him this is her home too — he adjusts, or he is unhappy** →
   `modify_opinion {dissenter} −15`, `modify_opinion {pursuer} +8`,
   `modify_cultural_blend −0.02`

---

### E.4 `rel_imanian_gradual_acceptance` *(deferred outcome of E.3 choice 1)*

**Title**: *He Has Watched, and Decided*

**isDeferredOutcome**: true

**Actors**: `dissenter` (same man)

**Description**: `{dissenter}` has had time to observe. Perhaps the
Sauromatian women's directness is not what he feared. Perhaps it is
worse in person than in principle. You will know from his face before he speaks.

Skill check: `custom ≥ 35` (best council) to assess the outcome honestly.

- **Success**: `modify_opinion {dissenter} +12 "Found his footing"`,
  clears the -1/turn Imanian discomfort drift for this person
- **Failure**: `modify_opinion {dissenter} −5`, low-happiness streak concern

---

### E.5 `rel_keth_aval_request`

**Title**: *A Proper Test*

**Trigger**: `has_person_with_ambition: seek_spouse` (Sauromatian woman
version), `min_population: 5`

**Actors**:
- `tester` — Sauromatian female, age ≥ 25, married or widowed OR has
  at least one child (proven fertility), age ≤ 50
- `subject` — unmarried male, age ≥ 18
- `petitioner` — unmarried Sauromatian female, age ≥ 16 (the one who wants
  to marry `{subject}`)

**Weight**: 1 | **Cooldown**: 12 | **isUnique**: false

**Description**: `{tester}` comes to you with a request that she frames as
cultural duty: before `{petitioner}` can commit to `{subject}`, her family
needs to know he is capable. This is the *Keth-Aval* — the testing visit of
Sauromatian tradition. `{tester}` will spend a fortnight in close company with
`{subject}`. She is not asking for your blessing, exactly. But she is asking
that you not object.

**Choices**:

1. **Allow it — this is Sauromatian custom and it is not your business** →
   `modify_opinion {tester} +10`, `modify_opinion {petitioner} +8`,
   `modify_opinion {subject} +5 "Shown trust"`. Deferred `rel_keth_aval_outcome`
   in 3 turns. **missionActorSlot**: none (no one leaves the settlement).

2. **Allow it but make your discomfort clear** → `modify_opinion {tester} +5`,
   `modify_opinion {petitioner} +4`, `modify_cultural_blend +0.01`

3. **Decline — this settlement follows a single standard** →
   `modify_opinion {tester} −15`, `modify_opinion {petitioner} −12`,
   `modify_cultural_blend +0.03` (sharpens Imanian identity direction)

---

### E.6 `rel_keth_aval_outcome` *(deferred outcome of E.5 choice 1 or 2)*

**Title**: *The Verdict*

**isDeferredOutcome**: true

**Actors**: `tester`, `subject`, `petitioner`

**Description**: `{tester}` has drawn her conclusions. Whether she reports
privately or lets the outcome show in how she carries herself, the settlement
notices. `{petitioner}` hears it first.

Skill check: `bargaining ≥ 30` (best council, diplomacy in navigating the
social politics of the result).

**Success** (the test went well):
- `modify_opinion_pair {petitioner}/{subject} +15 "Keth-Aval approved"`,
  `modify_opinion {tester} +5`, strong push toward `seek_spouse` fulfillment for
  petitioner. A marriage event may now be player-initiated.

**Failure** (the test revealed concerns — physical or interpersonal):
- `modify_opinion {petitioner} −10 "Doubts raised"`,
  `modify_opinion {subject} −8`, no mechanical block on marriage but narrative
  doubt is seeded. Player may still arrange it.

---

### E.7 `rel_sauro_rival_claimants`

**Title**: *Two Women, One Man*

**Trigger**: `has_rival_seekers` — two or more Sauromatian women hold
`seek_companion` or `seek_spouse` ambitions targeting the **same** man.

**Actors**:
- `claimant_a` — Sauromatian female with `seek_companion` or `seek_spouse`
  ambition, age ≥ 16
- `claimant_b` — different Sauromatian female, age ≥ 16, with criterion
  `sameAmbitionTargetAs: 'claimant_a'` (see Section F) — ensures both women
  are targeting the identical man, bound as `subject` by the resolver
- `subject` — the man in question (resolved from `claimant_a.ambition.targetPersonId`
  via criterion `resolveFromAmbitionTarget: 'claimant_a'`)

**Weight**: 2 | **Cooldown**: 8

**Description**: `{claimant_a}` and `{claimant_b}` have both set their
attention on `{subject}`. Among Sauromatians this would be resolved by custom
— they would either agree to share him or one would yield. But they have not
agreed yet, and the daily friction is visible. `{subject}` is finding the whole
situation either flattering or exhausting, depending on the man.

**Choices**:

1. **Let the women work it out — this is their custom** →
   Skill check: `custom ≥ 40` (culture knowledge)
   - Success: `modify_opinion_pair {claimant_a}/{claimant_b} +10 "Reached agreement"`,
     one ambition randomly fulfills, the other remains as co-wife prospect
   - Failure: `modify_opinion_pair {claimant_a}/{claimant_b} −15 "Simmering rivalry"`

2. **Arrange a formal multi-wife household — bring both in** →
   `modify_opinion {claimant_a} +20`, `modify_opinion {claimant_b} +20`,
   `modify_opinion {subject} −5` (the man had no say). Fires the existing
   `arrangeMarriage` path on player confirmation in next management phase.

3. **Speak to {subject} — his preference matters** →
   `modify_opinion {subject} +15 "Leader respects him"`, adds a deferred
   `rel_mutual_attraction` in 2 turns (giving the more-favoured woman the
   event slot).

4. **Discourage both — the settlement cannot afford this distraction** →
   `modify_opinion {claimant_a} −10`, `modify_opinion {claimant_b} −10`,
   `modify_opinion {subject} +5`

---

### E.8 `rel_child_outside_marriage`

**Title**: *A Child Before Vows*

**Trigger**: Fired programmatically when `processPregnancies()` produces a
birth where `mother.spouseIds.length === 0` AND mother is Sauromatian-heritage.
Injected by the store's dawn processing (same pattern as the Hidden Wheel event).
`isDeferredOutcome: false` — fires immediately in the current turn's event queue.

**Actors**:
- `mother` — the newly-delivered woman, age ≥ 16
- `father` — the biological father if he remains in `state.people` (optional
  slot; if the father is unknown or has left, the slot is unfilled and the
  description collapses gracefully)

**Weight**: 1 (injected — deck weight irrelevant) | **Cooldown**: 0

**Description**: A child was born last night. The camp knows — children have
their own networks for these things. `{mother}` is well, the child is healthy.
There is no household around them yet and no ceremony, just a new life and the
question of where it fits.

*(If `{father}` is bound)*: `{father}` has been told. The two are not
married. Whether that changes is a matter for you, the pair of them, and
whatever customs you have let take root here.

**Choices**:

1. **Say nothing — this needs no comment from you** →
   `modify_opinion {mother} +4 "No interference"`. Sauromatian norm: no
   stigma, no comment needed. Company standing unchanged.

2. **Welcome the child publicly — a good thing for the settlement** →
   `modify_opinion {mother} +12 "Publicly honoured"`,
   `modify_cultural_blend −0.01` (Native custom strengthened),
   Company standing −1 (they note the loosening of Imanian standards).

3. **Encourage a formal arrangement** *(only if `{father}` is bound and both
   are eligible to marry)* → `modify_opinion {mother} +8`,
   `modify_opinion {father} +6`. Fires `rel_mutual_attraction` as a follow-up
   in the same turn with the pair pre-bound.

4. **Express that the settlement expects formal bonds for new children** →
   `modify_opinion {mother} −8 "Felt judged"`,
   `modify_cultural_blend +0.02` (Imanian norm pulled forward),
   Company standing +1.

**Injection logic** (in store dawn post-processing):
```typescript
for (const birth of dawnResult.newBirths ?? []) {
  const mother = updatedPeople.get(birth.motherId);
  if (!mother) continue;
  if (mother.spouseIds.length === 0
      && SAUROMATIAN_CULTURE_IDS.has(mother.heritage.primaryCulture)) {
    pendingEvents.unshift(bindActors(
      ALL_EVENTS.find(e => e.id === 'rel_child_outside_marriage')!,
      { mother: mother.id, ...(birth.fatherId ? { father: birth.fatherId } : {}) },
    ));
  }
}
```

**Note**: `DawnResult` does not currently expose a `newBirths` array. The field
`newBirths: Array<{ childId: string; motherId: string; fatherId: string | null }>`
must be added to `DawnResult` and populated by `processPregnancies()` in
`turn-processor.ts`.

---

## F. System Additions: `has_rival_seekers` + `sameAmbitionTargetAs`

### F.1 Prerequisite: `has_rival_seekers`

New entry in `engine.ts` `EventPrerequisite` union. No params — gates the event
deck on the global condition that at least two women are chasing the same man.

```typescript
{ type: 'has_rival_seekers' }
```

**Implementation in `event-filter.ts`**:
```typescript
case 'has_rival_seekers': {
  const targetCounts = new Map<string, number>();
  for (const person of state.people.values()) {
    if (!person.ambition) continue;
    if (person.ambition.type !== 'seek_companion' && person.ambition.type !== 'seek_spouse') continue;
    const tid = person.ambition.targetPersonId;
    if (!tid) continue;
    targetCounts.set(tid, (targetCounts.get(tid) ?? 0) + 1);
  }
  return Array.from(targetCounts.values()).some(c => c >= 2);
}
```

### F.2 Actor Criteria: `sameAmbitionTargetAs` and `resolveFromAmbitionTarget`

Two new optional fields on `ActorCriteria` in `engine.ts`:

```typescript
/** Requires this actor's ambition.targetPersonId to match the named slot's
 *  ambition.targetPersonId. Both must have non-null ambition targets. */
sameAmbitionTargetAs?: string;

/** Requires this actor to BE the person pointed to by the named slot's
 *  ambition.targetPersonId. Used to bind the shared target as a third actor. */
resolveFromAmbitionTarget?: string;
```

**Implementation in `actor-resolver.ts` `matchesCriteria`**:
```typescript
if (criteria.sameAmbitionTargetAs) {
  const refId = boundActors[criteria.sameAmbitionTargetAs];
  const ref = refId ? people.get(refId) : undefined;
  if (!ref?.ambition?.targetPersonId) return false;
  if (person.ambition?.targetPersonId !== ref.ambition.targetPersonId) return false;
}

if (criteria.resolveFromAmbitionTarget) {
  const refId = boundActors[criteria.resolveFromAmbitionTarget];
  const ref = refId ? people.get(refId) : undefined;
  const expectedId = ref?.ambition?.targetPersonId;
  if (!expectedId || person.id !== expectedId) return false;
}
```

The binding sequence for E.7 is:
1. `claimant_a` binds first — any Sauromatian woman with a companion/spouse ambition
2. `claimant_b` binds second — `sameAmbitionTargetAs: 'claimant_a'` ensures she targets the same man
3. `subject` binds third — `resolveFromAmbitionTarget: 'claimant_a'` pins to the exact target

---

## G. Settlement Policy: `courtshipNorms`

A new field on `Settlement`:

```typescript
courtshipNorms: 'traditional' | 'open' | 'mixed'
```

Defaults to `'mixed'` (the starting reality of the settlement).

| Policy | Effect |
|---|---|
| `'traditional'` | `seek_companion` ambitions cannot form. Sauromatian women's `seek_spouse` threshold raised to 20 (same as Imanian). Sauromatian happiness −10 modifier per person while this is active. Company standing +1/year (they approve). |
| `'open'` | `seek_companion` forms freely. Courtship opinion drift rates doubled. Imanian men's discomfort drift doubled. Sauromatian happiness +5 modifier. Company standing −1/year (they disapprove mildly). |
| `'mixed'` | Default. Everything as described in sections A–F above. |

The player sets this via a new dropdown in **SettlementView → Culture/Society
sidebar** (near the `ReligiousPolicy` dropdown). Available in `management` phase
only.

Serialisation: plain string, `?? 'mixed'` fallback on load.

### G.1 `hidden_wheel_recognized` → Courtship Norms Nudge

When the player sets `religiousPolicy = 'hidden_wheel_recognized'` via
`setReligiousPolicy()` in the store, if `courtshipNorms` is currently
`'traditional'`, set a transient flag `pendingCourtshipNudge = true` on the
store's local UI state (not in `GameState` — does not need to be serialised).

On the next management-phase render, `SettlementView` checks this flag and
shows a dismissible info banner:

> *"The Hidden Wheel's teachings are more permissive than Imanian orthodoxy
> about courtship and companionship. Your current Traditional courtship policy
> may create tension with settlers who follow the Hidden Wheel. Consider
> shifting to Mixed customs."*

Two buttons:
- **Shift to Mixed** → sets `courtshipNorms = 'mixed'`, clears flag
- **Keep Traditional** → clears flag only, no policy change

This is purely a UI nudge — the combination is mechanically allowed, but the
player is shown the contradiction explicitly.

---

## H. Happiness Integration

Additions to `computeHappinessFactors()` in `happiness.ts`:

### `purpose` category additions:

**Factor: `sauro_woman_companion_denied`** (−6)
- Applies when: person is Sauromatian female, unmarried, age 16–45, settlement
  `courtshipNorms === 'traditional'`
- Label: `"Courtship suppressed"`

**Factor: `sauro_woman_companion_active`** (+4)
- Applies when: person is Sauromatian female, has active `seek_companion` or
  `seek_spouse` ambition, intensity ≥ 0.5
- Label: `"Actively courting"`

### `social` category additions:

**Factor: `imanian_discomfort_sauro_pursuit`** (−5)
- Applies when: person is Imanian-primary male, `imanian_orthodox`, *at least
  one* Sauromatian woman has a `seek_companion` ambition targeting him, and
  his opinion of her is < 15
- Label: `"Unsettled by pursuit"`

**Factor: `sauro_woman_has_companion`** (+6)
- Applies when: person is Sauromatian female, has a spouse or their household
  contains a male who is their concubine / companion
- Label: `"Has found a companion"`

---

## I. `AmbitionId` Type Change

Add `'seek_companion'` to the union in `person.ts`:

```typescript
export type AmbitionId =
  | 'seek_spouse'
  | 'seek_council'
  | 'seek_seniority'
  | 'seek_cultural_duty'
  | 'seek_informal_union'
  | 'seek_prestige'
  | 'seek_faith_influence'
  | 'seek_skill_mastery'
  | 'seek_legacy'
  | 'seek_autonomy'
  | 'seek_companion';   // ← new
```

---

## J. Separate Sauromatian Scheme Climax: `sch_sauro_courtship_open`

Rather than branching inside `sch_courtship_discovered`, a **separate climax
event** is added that fires when the schemer is a Sauromatian woman.

In `scheme-engine.ts` `processSchemes()`, the existing climax selection for
`scheme_court_person` gains a culture check:

```typescript
// Existing (condensed):
climaxEventId = 'sch_courtship_discovered';

// Becomes:
if (scheme.type === 'scheme_court_person') {
  const schemer = people.get(scheme.personId);
  const isSauro = schemer
    && SAUROMATIAN_CULTURE_IDS.has(schemer.heritage.primaryCulture);
  climaxEventId = isSauro
    ? 'sch_sauro_courtship_open'
    : 'sch_courtship_discovered';
}
```

### `sch_sauro_courtship_open`

Added to `src/simulation/events/definitions/schemes.ts`.

**Title**: *She Was Never Hiding It*

**isDeferredOutcome**: true

**Actors**:
- `schemer` — Sauromatian female, age ≥ 16
- `target` — male, age ≥ 18

**Description**: `{schemer}` does not look remotely ashamed when her attention
toward `{target}` is discussed openly. She looks, if anything, impatient. In
her view she has been courteous enough — she gave `{target}` time to notice
her, she arranged proximity, she let him think it was his idea. That any of
this required bringing to you is, to her, the puzzle.

`{target}` is wearing a different expression entirely.

**Choices**:

1. **Acknowledge her interest formally — this deserves a real answer** →
   `modify_opinion {schemer} +10 "Taken seriously"`,
   `modify_opinion {target} +8 "Leader spoke to him"`. Fires deferred
   `rel_sauro_courtship_clarified` in 2 turns.

2. **Affirm it publicly — announce before the settlement that you support the match** →
   `modify_opinion {schemer} +25`, `modify_opinion {target} +12`,
   `modify_opinion_labeled all −5 "Public pressure"` (some find this heavy-handed),
   `clear_ambition {schemer}`

3. **Step back — this is between them, not you** →
   `modify_opinion {schemer} +5`. Ambition continues unresolved.

4. **Caution her — direct pursuit unsettles the Imanian settlers** →
   `modify_opinion {schemer} −10`,
   `modify_cultural_blend +0.01` (slight Imanian pull)

---

## K. UI Changes

### K.1 PersonDetail — Ambition badge

Existing badge already shows ambition type + target name. No changes needed;
`seek_companion` falls through to the updated `getAmbitionLabel()`:

```typescript
case 'seek_companion': return `Seeking a companion${
  ambition.targetPersonId ? ` — ${nameOf(ambition.targetPersonId)}` : ''
}`;
```

### K.2 SettlementView — Courtship Norms dropdown

New policy dropdown in the Culture/Society section, matching the style of the
`ReligiousPolicy` dropdown already present. Label: **Courtship Custom**.
Options: `Traditional (Imanian)` / `Mixed (Settled)` / `Open (Sauromatian)`.
Disabled outside `'management'` phase.

### K.3 MarriageDialog

Add a note in the compatibility panel when the woman is Sauromatian and the
man is Imanian-primary: *"Sauromatian courtship may precede a formal
arrangement — this is expected, not a complication."*

---

## L. Files Changed

| File | Change |
|---|---|
| `src/simulation/population/person.ts` | Add `'seek_companion'` to `AmbitionId` union |
| `src/simulation/population/ambitions.ts` | Add `seek_companion` case to `evaluateAmbition`, `getAmbitionLabel`; add `seek_companion` priority block to `determineAmbitionType`; differentiate `seek_spouse` threshold by culture |
| `src/simulation/population/opinions.ts` | Add `applyCourtshipOpinionDrift()` function |
| `src/simulation/population/happiness.ts` | Add 4 new happiness factors |
| `src/simulation/events/definitions/relationships.ts` | Add 8 new events (E.1–E.8) |
| `src/simulation/events/definitions/schemes.ts` | Add `sch_sauro_courtship_open` climax event |
| `src/simulation/events/engine.ts` | Add `has_rival_seekers` to `EventPrerequisite` union; add `sameAmbitionTargetAs` and `resolveFromAmbitionTarget` to `ActorCriteria` |
| `src/simulation/events/event-filter.ts` | Implement `has_rival_seekers` case |
| `src/simulation/events/actor-resolver.ts` | Implement `sameAmbitionTargetAs` and `resolveFromAmbitionTarget` in `matchesCriteria` |
| `src/simulation/personality/scheme-engine.ts` | Boost Sauro-woman weight for `scheme_court_person`; route Sauro schemers to `sch_sauro_courtship_open` at climax |
| `src/simulation/turn/game-state.ts` | Add `courtshipNorms` to `Settlement` interface; add `newBirths` to `DawnResult` |
| `src/simulation/turn/turn-processor.ts` | Call `applyCourtshipOpinionDrift()` each dawn; populate `dawnResult.newBirths` from `processPregnancies()` |
| `src/stores/game-store.ts` | Expose `setCourtshipNorms()` action; inject `rel_child_outside_marriage` on unwed Sauromatian births; add Wheel nudge to `setReligiousPolicy()`; serialise new fields |
| `src/ui/views/SettlementView.tsx` | Courtship Norms dropdown; Hidden Wheel nudge banner |
| `src/ui/overlays/MarriageDialog.tsx` | Compatibility note for cross-cultural pairings |

---

## M. New Tests

```
tests/population/ambitions.test.ts       — seek_companion formation, evaluation, fulfillment, 30-turn stale
tests/population/opinions.test.ts        — applyCourtshipOpinionDrift: active pursuit ±1, proximity +0.5, Imanian −1
tests/population/happiness.test.ts       — 4 new happiness factors
tests/events/event-filter.test.ts        — has_rival_seekers: 0 seekers / 1 seeker / 2+ targeting same person
tests/events/actor-resolver.test.ts      — sameAmbitionTargetAs matching; resolveFromAmbitionTarget binding; mismatch rejection
tests/personality/scheme-engine.test.ts  — scheme_court_person Sauro weight boost; Sauro climax routes to sch_sauro_courtship_open; Imanian climax stays sch_courtship_discovered
```

Estimated: ~30 new test cases.

---

## N. Design Decisions (Resolved)

1. **Rival claimants actor binding** → Resolved. Added `sameAmbitionTargetAs`
   and `resolveFromAmbitionTarget` criteria (Section F.2). `claimant_b` matches
   on shared ambition target; `subject` is pinned directly to the man both
   women are pursuing. The greedy sequential binding in `resolveActors` handles
   this correctly with no post-bind validation needed.

2. **Deferred events with stale ambitions** → Resolved by existing pattern.
   Bound actors are stored in `DeferredEventEntry.boundActors` at fire time.
   `rel_keth_aval_outcome` choices that reference the petitioner's ambition
   state check the current live person at resolution time; choices should
   acknowledge if the ambition has since been fulfilled or failed.

3. **Sauromatian scheme climax** → Resolved. Separate event
   `sch_sauro_courtship_open` lives in `definitions/schemes.ts`. The scheme
   engine selects it at climax-time via a SAUROMATIAN_CULTURE_IDS check on the
   schemer (Section J). Cleaner than branching inside a single event template.

4. **`hidden_wheel_recognized` → `courtshipNorms` nudge** → Resolved.
   Transient `pendingCourtshipNudge` store flag triggers a dismissible UI
   banner with explicit shift-or-keep choices (Section G.1). Hard block
   deliberately avoided.

5. **Pregnancy outside marriage event** → Resolved. Event E.8
   `rel_child_outside_marriage` added, injected programmatically on unwed
   Sauromatian births. Requires `DawnResult.newBirths` surface to be added.

---

## P. Design Principles to Carry Into Implementation

- **Content tone**: All event descriptions use implication and social
  observation, never explicit detail. The camera stays at the campfire, not the
  sleeping-fur.
- **Agency for all parties**: No event forces an outcome on either character.
  The player manages social space; the characters carry their own opinions.
- **Symmetry of consequence**: Discouraging Sauromatian customs and discouraging
  Imanian customs both have real costs. Neither culture is more "correct"; each
  has friction with the other and the player navigates between them.
- **No new data structures beyond `courtshipNorms`**: Everything else runs on
  existing opinion, ambition, scheme, and event mechanisms. The lift is weighted
  event generation and new event definitions — not new systems.

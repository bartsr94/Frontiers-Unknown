# Palusteria — Systems Interconnection Design

**Document Type:** Design (cross-cutting)  
**Status:** Proposal — not yet implemented  
**Source:** Phase 4.2 post-completion systems audit  
**Companion docs:** `SAUROMATIAN_COURTSHIP.md`, `HAPPINESS_SYSTEM.md`, `AUTONOMY_SYSTEM.md`, `RELIGION_SYSTEM.md`

---

## Purpose

This document captures the five highest-value cross-system connections identified
during the Phase 4.2 post-completion audit. Each is a targeted integration between
two already-implemented systems. None requires a new system; all close genuine
gaps between systems that were designed to compose but currently run in parallel.

The connections are ordered by implementation dependency, not priority number.
Proposals 1 and 2 should land together (they compose). 3, 4, and 5 are independent.

---

## 1. Named Relationship Type → Scheme Generation

**Status:** Proposed  
**Files:** `src/simulation/personality/scheme-engine.ts`  
**Depends on:** Named Relationships (Phase 4.0) ✅ · Scheme Engine (Phase 4.0) ✅

### Problem

The scheme engine selects scheme types by trait weights only. A `rival` bond and
a `friend` bond both have zero influence on what schemes a person generates.
The named relationship web exists alongside the scheme engine without feeding
into it — two parallel systems that never actually compose.

The `mentor_hearted` trait exists. `sch_tutor_breakthrough` exists. Nothing
autonomously connects them.

### Design

In `generateScheme()`, after the trait-weight pass, apply relationship modifiers
to the weight table before selecting a type:

```typescript
// Relationship weight adjustments in generateScheme()
for (const [otherId, relType] of Object.entries(person.namedRelationships ?? {})) {
  switch (relType) {
    case 'rival':
    case 'nemesis':
      // Bitter towards this person → push toward undermining them
      if (otherId === potentialTarget(person, people)) {
        weights['scheme_undermine_person'] += 3;
      }
      break;
    case 'mentor':
      // Already guiding someone → lean toward tutoring
      weights['scheme_tutor_person'] += 3;
      break;
    case 'confidant':
      // Deep trust in household → suppress undermining within the same household
      if (sameHousehold(person, otherId, state)) {
        weights['scheme_undermine_person'] = Math.max(0, weights['scheme_undermine_person'] - 2);
      }
      break;
  }
}
```

The `potentialTarget()` helper returns the most recently targeted person by
existing schemes, or the person with the lowest effective opinion as fallback.

### Player Impact

- Rivalries autonomously escalate into schemes without player direction
- Mentor bonds spontaneously generate tutoring chains — skills pass across generations
- Confidant bonds create a zone of loyalty that suppresses backstabbing within
  close households
- The player has a mechanical reason to *manage* named relationships proactively

### Emergent Potential

A cluster of rivals will serially undermine each other, producing cascading
morale events the player didn't author. A founding-generation mentor relationship
can bootstrap a second-generation character with inherited skills — exactly the
generational legacy the game is built around.

### Design Risk

Low. Additive weights only. The existing scheme type normalization absorbs any
imbalance. No new state fields.

### Implementation Cost

Small (~15 lines in `scheme-engine.ts`). Helper for "potential target of
undermining" may need 10 additional lines.

---

## 2. Scheme Progress Scales with Target Opinion

**Status:** Proposed  
**Files:** `src/simulation/personality/scheme-engine.ts`  
**Depends on:** Scheme Engine (Phase 4.0) ✅ · Opinion System (Phase 3.6) ✅

### Problem

`processSchemes()` advances every active scheme by a flat **+1 progress/turn**
regardless of the relationship between schemer and target. A person courting
their nemesis advances at the same rate as one courting someone who already
likes them. The opinion web has no forward-looking mechanical weight.

This also means the Sauromatian Courtship system (Phase 4.3's mutual +1 opinion
drift during pursuit) doesn't compound with scheme completion speed — the two
autonomous systems run in parallel rather than reinforcing each other.

### Design

In `processSchemes()`, replace the flat `+1` increment with an opinion-scaled
increment:

```typescript
function schemeProgressIncrement(
  person: Person,
  scheme: PersonScheme,
  state: GameState
): number {
  const opinion = getEffectiveOpinion(person, scheme.targetId, state);
  // Remap [-100, +100] opinion to [0.5, 1.5] multiplier
  const multiplier = 1.0 + (opinion / 200); // -100→0.5, 0→1.0, +100→1.5
  return Math.max(0.5, multiplier); // floor at 0.5 — even hostile schemes inch forward
}
```

The multiplier is applied to whichever base progress the scheme normally earns.
Progress remains a float internally; events fire when it crosses 100.

**Scheme-type opinion source:**

| Scheme type | Opinion direction used |
|---|---|
| `scheme_court_person` | Schemer → target |
| `scheme_befriend_person` | Schemer → target |
| `scheme_tutor_person` | Schemer → target |
| `scheme_undermine_person` | Inverted: −opinion → faster progress (more motivated by hatred) |
| `scheme_convert_faith` | No opinion gate — religious conviction drives it; use flat 1.0× |

The `scheme_undermine_person` inversion is deliberate: a nemesis is *more*
motivated to undermine, not less. Their progress formula becomes
`1.0 + (-opinion / 200)` — hatred accelerates the work.

### Player Impact

Every opinion delta is now also a future-facing prediction. Raising someone's
opinion of their target doesn't just improve social harmony — it makes the
courtship or befriending scheme resolve faster. Driving a wedge between rivals
(via events that lower their mutual opinion) makes their undermining schemes
progress more slowly.

This is the mechanical expression of "social investment pays dividends."

### Design Risk

Low-medium. The 0.5–1.5× range is conservative. Extreme negative-opinion
schemes progress only half-speed, not zero — they never stall. Watch for edge
case: a very high-opinion pair might resolve courtship in ~67 turns instead of
100; this is fine and arguably desirable for the game's pacing.

### Implementation Cost

Small (~10 lines changed in `processSchemes()`). No new state fields.

---

## 3. Faction Strength → Policy Decision Costs

**Status:** Proposed  
**Files:** `src/stores/game-store.ts`, `src/ui/views/SettlementView.tsx`  
**Depends on:** Faction System (Phase 4.0) ✅ · Religion System (Phase 3.7) ✅

### Problem

`setReligiousPolicy(policy)` applies instantly with no reaction from the
settlement's social body. A dominant `orthodox_faithful` faction that has
earned 60% strength is ignored when the player clicks `wheel_permitted`.
Factions observe but never constrain — they are social weather, not political terrain.

The "No Right Answer" design pillar only fully activates when choices carry
*visible, systemic costs*, not just eventual event consequences.

### Design

In `setReligiousPolicy()` in the store, before applying the new value, compute
faction reactions and optionally warn the player:

```typescript
function computePolicyReactions(
  newPolicy: ReligiousPolicy,
  factions: Faction[],
  people: Map<string, Person>
): PolicyReaction[] {
  const reactions: PolicyReaction[] = [];

  const orthodoxStrength = computeFactionStrength(
    factions.find(f => f.type === 'orthodox_faithful'), people
  );
  const wheelStrength = computeFactionStrength(
    factions.find(f => f.type === 'wheel_devotees'), people
  );

  if (newPolicy === 'wheel_permitted' && orthodoxStrength >= 0.35) {
    reactions.push({
      factionType: 'orthodox_faithful',
      consequence: 'opinion_broadcast',
      // −10 from every orthodox_faithful member toward council lead
      value: -10,
      label: 'Orthodox settlers are offended'
    });
  }

  if (newPolicy === 'orthodox_enforced' && wheelStrength >= 0.35) {
    reactions.push({
      factionType: 'wheel_devotees',
      consequence: 'tribal_pressure',
      // −2 to tribalPressureTurns (Sauromatian tribes hear of suppression)
      value: -2,
      label: 'Sauromatian women feel suppressed'
    });
  }

  if (newPolicy === 'hidden_wheel_recognized' && orthodoxStrength >= 0.45) {
    reactions.push({
      factionType: 'orthodox_faithful',
      consequence: 'company_standing',
      // Immediate −5 standing (the Company hears about it from orthodox men)
      value: -5,
      label: 'Orthodox members report this to the Company'
    });
  }

  return reactions;
}
```

**UI requirement:** The policy dropdown in `ReligionPanel` shows a warning
indicator (amber ⚠) on options that would trigger a reaction, with a tooltip
describing the cost *before* the player commits. The player can still choose it
— the cost is visible, not a hidden punishment.

**Threshold for reactions:** 0.35 strength (lower than the demand threshold of
0.45) — factions react at mere influence, not just crisis levels. This makes the
faction panel's strength bars feel predictive, not retrospective.

### Player Impact

Policy decisions become timed strategic acts. The player must weaken the
orthodox faction (via cultural drift, events, or careful marriage) before
accommodating the Wheel — or accept the standing/opinion costs. The sequence of
decisions now matters, not just the final state.

### Design Risk

Medium. The UI warning is critical: reactions without legible warnings feel
like punishment. Implement the tooltip in the same sprint as the logic. Also
ensure reactions are applied in one batch (not queued as events) so the player
knows exactly what happened.

### Implementation Cost

Medium. New `computePolicyReactions()` function (~40 lines), wire into
`setReligiousPolicy()` (~10 lines), and ReligionPanel dropdown tooltip update
(~20 lines of JSX).

---

## 4. Happiness → Cultural Drift Rate

**Status:** Proposed  
**Files:** `src/simulation/population/culture.ts`  
**Depends on:** Happiness System (Phase 4.1) ✅ · Culture System (Phase 3) ✅

### Problem

`processCulturalDrift()` applies a fixed community pull per turn regardless of
how a person feels about their community. A Sauromatian woman who is desperate
and isolated drifts toward the settlement's dominant culture at the same rate
as one who is thriving and socially embedded. This is historically inauthentic
and mechanically flat — happiness has no pathway to influence one of the game's
slowest and most consequential processes.

### Design

In `processCulturalDrift()`, multiply the community pull magnitude by a
happiness-derived coefficient before applying it to the person's culture map:

```typescript
function happinessDriftCoefficient(score: number): number {
  if (score >= 30) return 1.10;  // Content/Thriving — comfortable, open to community norms
  if (score >= 5)  return 1.00;  // Settled — baseline
  if (score >= -35) return 0.85; // Restless/Discontent — withdrawn
  return 0.65;                   // Miserable/Desperate — retreating to heritage identity
}
```

Applied only to the **community pull component** of drift (the settlement's
dominant culture attracting the person toward it). The personal heritage
component (slow decay of birth culture) is unchanged — bloodline-grounded
identity doesn't accelerate or decelerate.

The coefficient does not allow negative drift (culture regression). It
modulates *pace*, not *direction*. A miserable settler assimilates more slowly;
they don't become more Sauromatian than their bloodline allows.

### Computing the happiness score

`computeHappiness(person, state)` is already a pure function. Call it at the
start of `processCulturalDrift()` for each person, reuse the result locally.
The cost is one extra `computeHappiness()` call per person per dawn — same
complexity class as the existing drift loop.

### Semantic Note

"Regression" in this model means *resistance to assimilation*, not reversal.
A desperate Sauromatian woman who is 70% community-culture and 30% heritage
won't revert to 70% heritage — her culture map just stops moving as fast toward
the dominant pull. Her children's heritage is already sealed at birth regardless.

### Player Impact

Happiness management becomes upstream of cultural outcomes. A player who keeps
Sauromatian women happy and integrated will see faster cultural blend than one
who treats them as labor. Two identical demographic starting points with
different economic and social management can produce meaningfully different
cultural compositions after 25 years — the core generational fantasy.

### Long-run Example

Settlement with 6 Sauromatian women, all Discontented:
- Community pull at 0.85× → integration takes ~18% longer per turn
- After 20 in-game years, cultural blend is ~8 percentage points lower than if
  the same women were Content
- That 8-point shift is the difference between the soft-native and safe zones on
  the IdentityScale — a meaningful, player-legible outcome

### Design Risk

Low. The multiplier is gentle. The floor (0.65×) still allows drift — it never
stalls completely. Not exploitable: making settlers miserable doesn't preserve
culture fast enough to be a viable strategy (0.65× is a 35% slowdown, not a
stop).

### Implementation Cost

Small (~8 lines in `processCulturalDrift()`). No new state fields. One
additional `computeHappiness()` call per person per dawn (already O(n)).

---

## 5. Desertion → Tribe World State

**Status:** Proposed  
**Files:** `src/stores/game-store.ts`, `src/simulation/world/tribes.ts`,
          `src/simulation/events/definitions/diplomacy.ts` (new event)  
**Depends on:** Happiness System (Phase 4.1) ✅ · Tribe System (Phase 3) ✅

### Problem

When `getDepartingFamily()` produces a departing set, the store removes those
people and nothing else happens. The world doesn't register that these people
went somewhere. Tribes don't know. Disposition doesn't shift. The game's
external world — tribes, companies, the wider Ashmark — currently feels
hermetically sealed from internal settlement events.

Desertion is also a pure loss with no possible silver lining, which removes
the design space for player decisions about whether to *let* someone leave.

### Design

#### 5a. Tribal Absorption

When the store processes desertions, select an absorbing tribe:

```typescript
function selectAbsorbingTribe(
  departingPeople: Person[],
  tribes: Tribe[]
): Tribe | null {
  // Cultural compatibility: Sauromatian people join Sauromatian tribes preferentially
  const hasSauroCulture = departingPeople.some(p =>
    SAUROMATIAN_CULTURE_IDS.has(p.heritage.primaryCulture)
  );
  const candidates = hasSauroCulture
    ? tribes.filter(t => t.isSauromatian && t.contactEstablished)
    : tribes.filter(t => t.contactEstablished);

  if (candidates.length === 0) return null;

  // Weight by disposition: more friendly tribes are more likely to accept refugees
  const weights = candidates.map(t => Math.max(1, t.disposition + 50));
  return weightedPick(candidates, weights, rng);
}
```

Apply a disposition bump to the absorbing tribe:

| Departing group size | Disposition delta |
|---|---|
| 1 person | +2 |
| 2–3 people | +4 |
| 4+ people | +6 |

The bump is noted in the activity log: `"Ysha's household joined the Bloodmoon camp — they remember."` No event fires immediately; this is a silent state change.

This bump is capped: a tribe that is already disposition +70 or above gets only
+1 (saturation). The tribe doesn't need more reminders that you're generating
refugees.

#### 5b. The Ambassador Event (deferred)

If any departing person had `combat ≥ 63` OR `bargaining ≥ 63` (Excellent tier
in a field the tribe values), schedule a deferred event `dip_familiar_face`
to fire 8–12 turns later (variable, based on RNG). The event features:

```
Event: "A Familiar Face"
Weight: N/A (injected directly, not drawn)
isDeferredOutcome: true

Description: The {tribe name} trading party includes a face you recognise —
{person.firstName}, who left your settlement {N} turns ago. They seem settled
and carry themselves differently now. Through them, the tribe offers to speak
further.

Choice A: "Greet them warmly"
  → +8 tribe disposition, unlock diplomacy event tier (tradeCompletedCount credit)
  → {person} becomes a named NPC: remembered in trade events

Choice B: "Keep it professional"
  → +3 tribe disposition, no further change

Choice C: "They are a deserter. Make that plain."
  → −5 tribe disposition, −10 opinion among all remaining Sauro settlers
    (word gets back that you humiliated someone who left)
```

The departed person is NOT re-added to the roster. They are referenced by
name only, looked up from a new `departedPersonMemory: Map<string, DepartedPerson>`
field on `GameState`.

#### `DepartedPerson` interface

```typescript
interface DepartedPerson {
  name: string;          // full name, captured at departure
  departedTurn: number;
  skills: PersonSkills;  // captured at departure — used to check ambassador eligibility
  heritage: PersonHeritage;
  absorbingTribeId?: string;
}
```

Serialised as `[string, DepartedPerson][]` (same Map pattern as households).
Kept to a rolling 20-entry cap (oldest dropped) — purely for event flavor.

### Player Impact

- Desertion is no longer a pure subtraction. There is a thin, genuine silver
  lining (tribe goodwill) and a potential long-arc story payoff
- The player now has a real decision about *whether* to intervene before a
  desertion completes. A miserable but skilled person leaving might improve your
  tribal diplomacy — or you can fix their happiness and keep them
- The game begins to feel like part of a living world rather than a closed
  simulation

### Emergent Potential

A player who repeatedly fails at happiness management could inadvertently build
one of their strongest tribal relationships through involuntary cultural export.
A narrative emerges: your failures are your diplomacy. This kind of emergent
storytelling — where mechanical failure produces unexpected diplomatic texture —
is exactly what the design philosophy is reaching for.

The ambassador event is the kind of moment players screenshot and remember. It
asks "what do you do when the person you failed comes back as someone else's
representative?"

### Design Risk

Low on the disposition bump (small, capped, unidirectional). Medium on the
ambassador event — needs careful writing so it doesn't feel like a reward for
bad management. The "Make that plain" option giving a negative outcome ensures
there's no clean win from this path.

### Implementation Cost

Medium. Tribe selection and disposition bump (~30 lines). `DepartedPerson`
interface and serialization (~20 lines). `dip_familiar_face` event definition
(~40 lines). Store integration for scheduling the deferred event (~15 lines).

---

## 6. Supplementary: UI Legibility Improvements

These are not new system connections — they surface connections that already
exist mechanically but are invisible to the player. Lower implementation cost
than any of the above; high return per line of code.

### 6a. Happiness → Production Multiplier — Surface It

**File:** `src/ui/views/PersonDetail.tsx`

The happiness chip in PersonDetail shows a score and label. The production
multiplier it creates is never shown. A "Discontent" settler working at 0.88×
efficiency reads as flavor text.

**Fix:** Append to the happiness hover tooltip:
`"Working at 88% efficiency — discontent reduces output."`

`getHappinessProductionMultiplier(label)` already returns this value.
One additional line in the tooltip composition.

---

### 6b. Faction Membership Legibility

**File:** `src/ui/views/CommunityView.tsx`

The faction panel shows strength bars and member count. Not who the members
are, not what criteria gatekeep membership, not where the demand threshold sits
relative to current strength.

**Fix:** Expand each faction row (chevron expand or hover panel):
- Top 3 members listed by first name
- Membership criteria in plain text: `"Members: devout, orthodox faith, age 30+"`
- Demand threshold marker on the strength bar with label `"Demands activate"`

---

### 6c. Company Standing — Religion Attribution

**File:** `src/ui/views/SettlementView.tsx` (Company panel) or annual ship event text

Company standing drops silently due to religion composition. Players who don't
drill into the religion panel tooltip chain miss the root cause.

**Fix:** In the Spring annual ship event text (or the Company panel standing
tooltip), add an explicit line item when `computeCompanyReligiousPressure()`
returns non-zero:
`"Religious diversity concern: −3 standing this year"`

---

### 6d. Away Role Return Date

**File:** `src/ui/views/PersonDetail.tsx`

When a settler has `role === 'away'`, their status is visible but there's no
counter showing when they return. The player must remember which event they
came from.

**Fix:** PersonDetail for `role === 'away'` shows:
`"On mission — returns in ~N turns"`

Computed from the relevant `DeferredEventEntry.scheduledTurn - state.currentTurn`.
The deferred entry can be found by matching `context.missionActorId`.

---

### 6e. Active Schemes Dashboard

**File:** `src/ui/views/CommunityView.tsx`

Active schemes are visible only by drilling into individual PersonDetail panels.
With 15+ settlers running simultaneous schemes, climax events arrive with no
context.

**Fix:** CommunityView left panel adds: `"Live schemes: N active"` with an
expand-to-list:
```
Theron is courting Ysha           (Turn 14 → ~Turn 26)
Daria is trying to convert Ander  (Turn 10 → ~Turn 22)
```
Data comes from iterating `state.people`, reading `person.activeScheme`.
Completion turn estimated as `scheme.startedTurn + (100 - scheme.progress)`.

---

### 6f. Identity Pressure Threshold Warning

**File:** `src/ui/components/IdentityScale.tsx`

The pressure counters tick up silently. Events fire without warning. Players
don't know the event threshold until they've been hit by it.

**Fix:** When either pressure counter is within 3 turns of a known event
threshold (the `min_company_pressure_turns` / `min_tribal_pressure_turns`
values declared in identity event definitions), add a subtle amber pulse or
text note:
`"Company concerns intensifying — an event may follow."`

The threshold values are constants in `identity.ts` event definitions and can
be imported; no new state needed.

---

### 6g. Opinion Modifier Decay → Relationship Dissolution Attribution

**File:** `src/simulation/population/opinions.ts`, `src/simulation/turn/turn-processor.ts`

When a timed `OpinionModifier` decays to zero and the resulting shift crosses a
named-relationship sustain threshold (dissolving a friendship), the Activity
Feed logs the dissolution with no cause.

**Fix:** In the turn-processor, after `decayOpinionModifiers()` runs, check the
delta between pre- and post-decay effective opinions for pairs that had an
active named relationship. If the decay crossing caused a dissolution, pair the
activity log entries:
`"The dispute between Theron and Ysha faded — with it, their friendship."`

This requires the dissolution check to run *after* decay and receive both the
pre- and post-decay opinion scores — a minor sequencing change in `processDawn()`.

---

## Implementation Order

| Proposal | Cost | Priority | Dependency |
|---|---|---|---|
| 1 — Named Rel → Scheme Generation | Small | 🔴 First | None |
| 2 — Scheme Progress × Opinion | Small | 🔴 First | None |
| 6a–6g — UI Legibility Pass | Small × 7 | 🟠 Soon | Any |
| 4 — Happiness → Cultural Drift | Small | 🟠 Soon | None |
| 3 — Faction → Policy Costs | Medium | 🟠 Soon | None |
| 5 — Desertion → Tribe State | Medium | 🟡 Later | None |

Proposals 1 and 2 are the highest design-value-per-line-of-code changes in this
document. Together they make the Character Autonomy system tell stories it was
already trying to tell — the named relationship web finally *drives* behaviour
rather than just reflecting it.

---

## What This Document Does Not Cover

- **Seasonal event deck weighting** (Summer courtship bonus, Winter domestic
  bonus): small design value addition to an already rich event deck; can be
  done opportunistically when writing new events
- **Scheme completion → trait acquisition** (earn `devout` from
  `scheme_convert_faith`): valid, low-cost addition; belongs in the Trait
  Expansion Phase 3.9 follow-up rather than here since it touches the trait
  catalog
- **Trade depth tiers** (`tradeCompletedCount`): sound design but lower
  priority while the tribe diplomacy system remains a stub; better addressed
  in the planned Diplomacy View phase
- **Population-culture feedback scaling** (cultural drift multiplied by dominant
  blend fraction): too large a change to the core culture model to bundle here;
  warrants its own design pass if demographic momentum becomes a felt problem


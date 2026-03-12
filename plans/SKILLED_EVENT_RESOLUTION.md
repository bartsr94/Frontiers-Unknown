# Skilled Event Resolution & Chain Events
## Design Document — Phase 3 Feature

**Depends on:** Phase 3 Steps 1–10 (skills now on all persons, culture/language complete)  
**Touches:** `engine.ts`, `resolver.ts`, `event-filter.ts`, `game-state.ts`, `game-store.ts`, `EventView.tsx`, all event definition files

---

## 1. Goals

| Goal | Description |
|------|-------------|
| **Skill relevance** | Character stats must matter. The player's council composition should create genuine asymmetry — a settlement with a great hunter resolves hunts differently than one with a great diplomat. |
| **Meaningful choice** | Each approach to an event is a gamble on the right person. You might have a better chance sending your trader than your warrior, but the warrior's failure has different consequences. |
| **Temporal depth** | Not everything resolves immediately. Sending a scouting party, dispatching a messenger, or planting a rumour all take time. Deferred chain events create a sense of things happening in the world while you manage the settlement. |
| **Narrative continuity** | The outcome screen should name the actor, describe what happened, and echo back the flavour of the choice — not just show "+5 food". |

---

## 2. Player Experience Flow

### 2A. Immediate Skill-Check Event

```
[Event Card] — "A bear has been seen near the cattle pens."
  → Player picks: "Send your best hunter to track and drive it off."
      [SkillCheck: hunting, difficulty 45, best_council]
  → [Skill Check Screen] — "Rannick Albrecht steps forward.
                             Hunting: Very Good (54). Difficulty: 45. SUCCESS."
  → [Outcome Screen] — "Rannick returns before dusk, the bear's trail cold behind him.
                         The cattle are safe. He earned himself a seat at the fire." (+5 food)
```

### 2B. Deferred Chain Event (Distant Outcome)

```
[Event Card] — "A Kiswani river camp lies two days upstream. They haven't approached."
  → Player picks: "Send your best diplomat to open contact."
      [No immediate skill check — decision recorded, outcome pending]
  → [Pending Screen] — "Your man sets out at dawn. You'll hear from him in time."
      [4 turns pass normally]
  → [Resolution Event fires] — "Your emissary returns. The riverfolk tested him."
      [SkillCheck: diplomacy, difficulty 55, actor from original context]
      [Outcome Screen — pass] — "They received him well. A trade channel is open."
      [Outcome Screen — fail] — "He came back rattled. They sent him away with nothing."
```

### 2C. Deferred Chain Event (Success/Failure on Return)

```
[Event Card] — "One of the women has gone into labour early."
  → Player picks: "Have your best herbalist attend to her."
      [Skill Check deferred — rolls when outcome fires after 1 turn]
  → [Pending Screen] — "You wait."
  → [Resolution Event fires 1 turn later]
      [SkillCheck: plants, difficulty 40]
      [Outcome — pass] — "Mother and child both survive."
      [Outcome — fail] — "The birth was difficult. The mother lives, the child does not."
```

---

## 3. Data Model Changes

These changes are specified in `PALUSTERIA_ARCHITECTURE.md` §4.8 and §4.12. Summary:

### 3.1 `EventChoice` additions

| Field | Type | Purpose |
|-------|------|---------|
| `skillCheck` | `SkillCheck \| undefined` | Defines the skill test attached to this choice |
| `onSuccess` | `EventConsequence[]` | Applied when skill check passes |
| `onFailure` | `EventConsequence[]` | Applied when skill check fails |
| `deferredEventId` | `string \| undefined` | Event ID to fire after N turns (mutually exclusive with `followUpEventId`) |
| `deferredTurns` | `number` | Default: 4 |

### 3.2 `SkillCheck` interface

```typescript
interface SkillCheck {
  skill: SkillId | DerivedSkillId;
  difficulty: number;                // 1–100; see tier table below
  actorSelection: 'best_council' | 'best_settlement' | 'actor_slot';
  actorSlot?: string;
  attemptLabel?: string;             // Narrative intro to the check screen
}
```

**Difficulty calibration guide:**

| Difficulty | Tier | Notes |
|-----------|------|-------|
| 15–25 | Fair | Trivially easy for anyone in settlement |
| 26–40 | Good | Most seasoned settlers will pass |
| 41–55 | Very Good | Requires a skilled specialist |
| 56–72 | Excellent | Only your best will manage this |
| 73–85 | Renowned | Even experts will sometimes fail |
| 86–100 | Heroic | Will almost certainly fail |

### 3.3 `DeferredEventEntry` in `GameState`

```typescript
interface DeferredEventEntry {
  eventId: string;
  scheduledTurn: number;
  context: Record<string, unknown>;
  // Typical context keys:
  //   actorId: string          — person who made the original attempt
  //   originEventId: string    — event that spawned this deferred entry
  //   originChoiceId: string   — choice that was made
}
```

`GameState.deferredEvents` is serialised as a plain array (no Map needed — JSON safe).

### 3.4 `SkillCheckResult` in `EventRecord`

```typescript
interface SkillCheckResult {
  actorId: string;
  actorName: string;
  skill: SkillId | DerivedSkillId;
  actorScore: number;
  difficulty: number;
  passed: boolean;
}
```

---

## 4. Engine Changes

### 4.1 `src/simulation/events/resolver.ts`

#### New function: `resolveSkillCheck`

```typescript
function resolveSkillCheck(
  check: SkillCheck,
  state: GameState,
  context: Record<string, unknown>
): SkillCheckResult
```

Logic:
1. **Find the actor** based on `actorSelection`:
   - `'best_council'` → filter `state.councilMemberIds` to living people, take highest scorer in `check.skill`
   - `'best_settlement'` → all living people, highest scorer
   - `'actor_slot'` → look up `context[check.actorSlot]` as a personId
2. **Compute score** by calling `getDerivedSkill(person.skills, check.skill)` for derived skills, or `person.skills[check.skill]` for base
3. **Check pass**: `score >= check.difficulty`
4. Return `SkillCheckResult`

> If no suitable actor is found (e.g., empty council), the check auto-fails with `actorScore: 0`.

#### Updated function: `applyEventChoice`

New signature — now needs RNG for skill checks and returns additional data:

```typescript
export function applyEventChoice(
  event: GameEvent,
  choiceId: string,
  state: GameState,
  rng: SeededRNG,
): ApplyChoiceResult

interface ApplyChoiceResult {
  state: GameState;
  skillCheckResult?: SkillCheckResult;
  isDeferredOutcome: boolean;        // true → show pending screen, not outcome screen
  followUpEventId?: string;          // present → immediately queue this event
}
```

Resolution order:
1. Find the choice
2. Apply `choice.consequences` (always fires)
3. If `choice.skillCheck` is present:
   a. Call `resolveSkillCheck()`
   b. Apply `choice.onSuccess` or `choice.onFailure`
   c. Store result in `EventRecord`
4. If `choice.deferredEventId` is set:
   - Create a `DeferredEventEntry` and push to `state.deferredEvents`
   - Set `isDeferredOutcome: true`
5. If `choice.followUpEventId` is set:
   - Set `followUpEventId` on result (store handles queuing)
6. Record event in `eventHistory` and `eventCooldowns`
7. Return result

### 4.2 `src/simulation/events/event-filter.ts`

#### New function: `drainDeferredEvents`

```typescript
export function drainDeferredEvents(
  state: GameState
): { due: DeferredEventEntry[]; remaining: DeferredEventEntry[] }
```

Called during `processDawn()` before normal event drawing. Returns entries where `scheduledTurn <= state.turnNumber`. These are prepended to `pendingEvents` ahead of any newly drawn events, so the player sees them first.

The `context` from each deferred entry is attached to the event when it's queued, so resolution events can display the original actor's name and whether they succeeded.

### 4.3 `src/simulation/turn/turn-processor.ts`

In `processDawn()`, after updating people and before drawing events:

```typescript
// 1. Drain deferred events that are now due
const { due, remaining } = drainDeferredEvents(state);
state = { ...state, deferredEvents: remaining };

// 2. Draw new events from the deck (existing logic)
const drawnEvents = drawEvents(filterEligibleEvents(ALL_EVENTS, state), rng);

// 3. Pending = deferred-due first, then fresh draws
state = { ...state, pendingEvents: [...due.map(d => getEventById(d.eventId)), ...drawnEvents] };
```

Deferred outcome events must have `isDeferredOutcome: true` on their definition so they are never accidentally drawn from the normal deck.

---

## 5. Store Changes (`game-store.ts`)

### 5.1 `resolveEventChoice` action

Currently: `(eventId, choiceId) => void`  
Updated: `(eventId, choiceId) => void` (same external signature)

Internally:
1. Call `applyEventChoice(event, choiceId, state, rng)` → `ApplyChoiceResult`
2. Store new GameState
3. If `isDeferredOutcome`:
   - Set `currentPhase` to advance as normal (no special screen — just show the brief pending notice in EventView then proceed)
   - Store `lastChoiceResult` for the pending-screen display
4. If `skillCheckResult` is present:
   - Store in `lastSkillCheckResult` for the outcome-screen display
5. If `followUpEventId`:
   - Insert the follow-up event at the front of `pendingEvents`

### 5.2 New store fields

```typescript
lastSkillCheckResult: SkillCheckResult | null;   // cleared when next event starts
lastChoiceResult: ApplyChoiceResult | null;       // for outcome screen rendering
```

---

## 6. UI Changes

### 6.1 Event resolution flow in `EventView.tsx`

The event card currently has one phase: show event + choices. It needs three UI states:

```
'choosing'   → Show event description + choice buttons (existing)
'outcome'    → Show skill check result + consequence text (new)
'pending'    → Show "your man has been sent" flavour + continue button (new)
```

State is local to `EventView` and driven by `lastChoiceResult` from the store.

**Transition logic:**

```
Player clicks choice
  → if no skillCheck AND no deferredEventId:
       consequences are instant → show 'outcome' (no check panel, just result text)
  → if skillCheck AND no deferredEventId:
       show 'outcome' with skill check panel (actor, score, pass/fail badge, consequence text)
  → if deferredEventId (with or without skillCheck):
       show 'pending' (brief flavour, no consequences revealed yet)
       [skill check for deferred events fires when the resolution event is processed]
```

### 6.2 Outcome Screen layout

```
┌──────────────────────────────────────────────────────────────┐
│  [Event title]                                               │
├──────────────────────────────────────────────────────────────┤
│  [Choice attempt label, e.g. "Your hunter steps forward..."] │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  RANNICK ALBRECHT — Hunting: Very Good (54)            │  │
│  │  Difficulty: 45  ·  ██████████░░░░  SUCCESS ✓          │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  [Outcome narrative text — 2-3 sentences describing result]  │
│                                                              │
│  [Resource delta badges: +5 food, -2 goods, etc.]           │
│                                                              │
│  [Continue →]                                               │
└──────────────────────────────────────────────────────────────┘
```

### 6.3 Pending Screen layout

```
┌──────────────────────────────────────────────────────────────┐
│  [Event title]                                               │
├──────────────────────────────────────────────────────────────┤
│  [Choice label echoed back]                                  │
│                                                              │
│  [Flavour text: "Your man sets out at dawn…"]                │
│                                                              │
│  Outcome expected in ~4 turns.                               │
│                                                              │
│  [Understood →]                                              │
└──────────────────────────────────────────────────────────────┘
```

### 6.4 Skill check for deferred resolution events

When the resolution event fires X turns later, it is a normal `GameEvent` with a `skillCheck` on its choices. But since the player already made their approach decision, the resolution event has **one pre-determined choice** (effectively automatic) that carries the skill check. The "outcome" screen fires immediately when this event is displayed.

Alternatively, the resolution event can have no choices and the skill check fires automatically when the event enters `pendingEvents` during `drainDeferredEvents`. The design doc allows both patterns — event authors choose.

**Pattern A — Auto-resolve on drain (simpler):**  
Resolution event has `choices: []` and a `skillCheck` at the event level (not on a choice). The drain function performs the check, picks `onSuccess`/`onFailure` consequences, and adds the event to pending with its outcome pre-baked into the context. The EventView shows the outcome immediately with no player input needed.

**Pattern B — Single forced choice (more narrative control):**  
Resolution event has one choice with `id: 'resolve'` and `label: 'See what happened'`. Player clicks it and the skill check fires. Outcome screen appears. This is the recommended pattern as it keeps the engine simpler.

---

## 7. Authoring Guide: Writing Events with Skill Checks

### 7.1 Simple immediate skill-check event

```typescript
{
  id: 'env_bear_sighting',
  title: 'Bear at the Pens',
  category: 'environmental',
  prerequisites: [{ type: 'has_resource', params: { resource: 'cattle', amount: 1 } }],
  weight: 2,
  cooldown: 8,
  isUnique: false,
  description:
    'Last night a bear circled the cattle pens. No animal was taken, but the men ' +
    'are uneasy. Left alone, it will return.',
  choices: [
    {
      id: 'hunt_it_down',
      label: 'Send your best hunter to track and drive it off.',
      description: 'Costs nothing but a day\'s work. Success depends on the man you send.',
      consequences: [],
      skillCheck: {
        skill: 'hunting',
        difficulty: 40,
        actorSelection: 'best_council',
        attemptLabel: 'steps out before dawn, bow in hand',
      },
      onSuccess: [
        { type: 'modify_resource', target: 'food',   value:  3 },
      ],
      onFailure: [
        { type: 'modify_resource', target: 'cattle', value: -1 },
      ],
      // successDescription and failureDescription live on a companion
      // resolution object (see §7.3 below)
    },
    {
      id: 'reinforce_pens',
      label: 'Have the men reinforce the pens tonight.',
      description: 'Safer but costly in lumber and time.',
      consequences: [
        { type: 'modify_resource', target: 'lumber', value: -2 },
      ],
      // No skill check — deterministic outcome
    },
  ],
}
```

### 7.2 Deferred chain event pair

**Part 1 — the choice:**

```typescript
{
  id: 'dip_upriver_camp_spotted',
  title: 'Smoke Upstream',
  category: 'diplomacy',
  prerequisites: [{ type: 'tribe_exists', params: { tribeId: 'riverfolk_main' } }],
  weight: 1,
  cooldown: 20,
  isUnique: true,
  description:
    'Your scouts report a Kiswani camp two days upstream — perhaps forty souls. ' +
    'They haven\'t approached. They may be watching you.',
  choices: [
    {
      id: 'send_emissary',
      label: 'Send your best diplomat upstream to make contact.',
      description: 'It will take time. You won\'t know the outcome for several days.',
      consequences: [],
      deferredEventId: 'dip_upriver_emissary_return',
      deferredTurns: 4,
    },
    {
      id: 'wait_and_watch',
      label: 'Post observers. See if they approach on their own terms.',
      description: 'Patient. Costs nothing. May cost opportunity.',
      consequences: [],
    },
  ],
}
```

**Part 2 — the resolution (fires 4 turns later):**

```typescript
{
  id: 'dip_upriver_emissary_return',
  title: 'The Emissary Returns',
  category: 'diplomacy',
  prerequisites: [],           // Only ever fires from deferred queue
  isDeferredOutcome: true,
  weight: 0,                   // Never drawn from deck
  cooldown: 0,
  isUnique: true,
  description:
    'Your man has returned from the Kiswani camp upstream. ' +
    'He looks tired but unharmed.',
  choices: [
    {
      id: 'resolve',
      label: 'Hear his report.',
      description: '',
      consequences: [],
      skillCheck: {
        skill: 'diplomacy',
        difficulty: 50,
        actorSelection: 'best_council',
        attemptLabel: 'recounts what passed between them',
      },
      onSuccess: [
        { type: 'modify_disposition', target: 'riverfolk_main', value: 15 },
      ],
      onFailure: [
        { type: 'modify_disposition', target: 'riverfolk_main', value: -5 },
      ],
    },
  ],
}
```

### 7.3 Outcome narrative text

The event engine needs a way to display different narrative text for pass vs. fail outcomes. Add optional fields to `EventChoice`:

```typescript
interface EventChoice {
  // ... existing fields ...

  /** Narrative text shown on the outcome screen after a successful skill check. */
  successText?: string;
  /** Narrative text shown on the outcome screen after a failed skill check. */
  failureText?: string;
  /** Narrative shown on the pending screen when outcome is deferred. */
  pendingText?: string;
}
```

These are display-only strings — not part of the engine logic.

---

## 8. Implementation Steps

| # | Step | Files | Notes |
|---|------|-------|-------|
| 1 | Add new fields to `engine.ts` | `engine.ts` | `SkillCheck`, `SkillCheckResult`, `DeferredEventEntry` interfaces; update `EventChoice`, `GameEvent`, `EventRecord`; add `ConsequenceType` entries |
| 2 | Add `deferredEvents` to `GameState` | `game-state.ts` | Plain array — no Map serialisation needed |
| 3 | Implement `resolveSkillCheck()` | `resolver.ts` | Actor selection logic + `getDerivedSkill` integration |
| 4 | Update `applyEventChoice()` | `resolver.ts` | Route through skill check, build `ApplyChoiceResult` |
| 5 | Implement `drainDeferredEvents()` | `event-filter.ts` | Split due vs remaining entries |
| 6 | Wire drain into `processDawn()` | `turn-processor.ts` | Prepend due events to `pendingEvents` |
| 7 | Update store `resolveEventChoice` | `game-store.ts` | Handle `ApplyChoiceResult`, store check result, add serialisation for `deferredEvents` |
| 8 | Update `EventView.tsx` | `EventView.tsx` | Add `'outcome'` and `'pending'` UI states; skill check panel component |
| 9 | Rewrite 5 existing events to use skill checks | definitions/ | One per category as proof-of-concept; see §9 |
| 10 | Write 2 deferred chain event pairs | definitions/ | One diplomacy, one domestic |
| 11 | Update save/load serialisation | `game-store.ts` | `deferredEvents` is already JSON-safe; verify round-trip |
| 12 | Tests | `tests/events/` | See §9 |

---

## 9. Test Coverage

| Test | What it verifies |
|------|-----------------|
| `resolveSkillCheck — best_council selects highest scorer` | Given 3 council members with different hunting scores, picks the highest |
| `resolveSkillCheck — auto-fails with empty council` | Returns `passed: false`, `actorScore: 0` |
| `resolveSkillCheck — uses actor_slot from context` | Picks person by ID from context map |
| `applyEventChoice — success consequences applied on pass` | Pass check → `onSuccess` fires, `onFailure` does not |
| `applyEventChoice — failure consequences applied on fail` | Fail check → `onFailure` fires, `onSuccess` does not |
| `applyEventChoice — always-consequences fire regardless` | Base `consequences` fire even when check fails |
| `applyEventChoice — deferred event scheduled correctly` | `deferredEvents` grows by 1; `scheduledTurn` = current + `deferredTurns` |
| `drainDeferredEvents — separates due from pending` | Only entries with `scheduledTurn <= current` are returned as due |
| `drainDeferredEvents — empty queue returns empty` | No crash on first turn |
| `EventRecord — skill check result stored` | After resolution, `eventHistory.last.skillCheckResult` is populated |

---

## 10. Events to Retrofit with Skill Checks (Proof of Concept)

| Event | Skill | Choice to add check to | Difficulty |
|-------|-------|------------------------|-----------|
| `dom_hunting_party` (Game Tracks) | `hunting` | "Organize a proper hunting party" | 35 |
| `dip_watchers_at_the_river` | `diplomacy` | "Approach them openly" | 50 |
| `eco_traveling_merchant` | `bargaining` | "Negotiate a better price" | 45 |
| `env_sudden_storm` | `combat` | "Send men to secure the camp" | 30 |
| `dom_homesick_man` | `leadership` | "Speak plainly: this is the life we chose" | 40 |

These retrofits:
- Keep the existing choices intact
- Add `skillCheck`, `onSuccess`, `onFailure` to one choice per event
- Add `successText` and `failureText` strings

The other choices in each event (e.g., "Give him something from reserves") remain deterministic — not all choices need a skill check, only those where personal competence is the differentiating factor.

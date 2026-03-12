# Event Character Binding System

## Overview

Events currently reference characters with generic language: "one of the men", "a Sauromatian woman", "your foreman". This document describes a system that replaces those placeholders with actual named settlers drawn from the living population, so that events feel like they are happening to the people you know rather than to anonymous archetypes.

When the event "A Quarrel Over Space" fires, it will read:

> *Davan Orsthal and Mira Deep-Stone have been sharing a corner of the longhouse for three seasons and their patience has finally exhausted itself...*

Consequences that wound or affect the involved character will target that specific person. Small portrait badges appear in the event card so you can see at a glance who is involved.

---

## Goals

- Every event that references a specific person populates that reference with a real settler
- Consequences affecting named characters (wound, kill, add_trait, etc.) target the bound actor by slot, not a hardcoded ID
- Deferred outcomes (choices that resolve in ~5 turns) remember who was involved
- All 28+ existing events are retrofitted
- No new `Math.random()` calls — all actor selection uses the seeded RNG
- Zero impact on existing tests; new tests cover the new logic

---

## Core Concepts

### Slots

Each event can declare one or more **named slots** in its `actorRequirements` array. A slot is a named role (e.g. `"settler"`, `"rival"`, `"tutor"`) plus a set of criteria that describe who can fill it.

```typescript
actorRequirements: [
  { slot: 'settler', criteria: { sex: 'male', religion: 'imanian_orthodox' } },
  { slot: 'rival',   criteria: { sex: 'female', religion: 'sacred_wheel' } }
]
```

### BoundEvent

A `BoundEvent` is the runtime form of a `GameEvent`. It augments the static definition with a `boundActors` record mapping slot names to the person IDs that were selected at draw time.

```typescript
type BoundEvent = GameEvent & {
  boundActors: Record<string, string>; // slot → person.id
};
```

Static event definitions stay clean. The binding is added at draw time and lives only in the pending event queue.

### Template Variables in Text

Event descriptions, choice labels, and choice descriptions may contain template tokens:

| Token | Resolves to |
|-------|-------------|
| `{slot}` | Full name — e.g. `Davan Orsthal` |
| `{slot.first}` | Given name — e.g. `Davan` |
| `{slot.he}` / `{slot.she}` | Subject pronoun matching sex |
| `{slot.his}` / `{slot.her}` | Possessive pronoun |
| `{slot.him}` / `{slot.her}` | Object pronoun |
| `{slot.He}` / `{slot.His}` / `{slot.Him}` | Capitalised variants |

Unknown tokens (no matching bound actor) are left as-is — a graceful fallback during development.

### Slot-Targeted Consequences

Consequence `target` fields that begin with `{` are treated as slot references:

```typescript
{ type: 'wound_person', target: '{settler}', value: 15 }
```

The resolver maps `'{settler}'` → actual person ID via `boundActors` before applying the consequence. This replaces the previous `'random_adult'` style targets.

---

## Data Model Changes

### `engine.ts`

```typescript
// New typed criteria (replaces Record<string, unknown>)
interface ActorCriteria {
  sex?: 'male' | 'female';
  religion?: ReligionId;
  culturalIdentity?: CultureId;      // matches person.heritage.primaryCulture
  minAge?: number;
  maxAge?: number;
  maritalStatus?: 'married' | 'unmarried';
  role?: WorkRole;
  socialStatus?: SocialStatus;
  hasTrait?: TraitId;
  minSkill?: { skill: SkillId | DerivedSkillId; value: number };
}

// Updated ActorRequirement
interface ActorRequirement {
  slot: string;
  criteria: ActorCriteria;
  required?: boolean;  // default true — event is ineligible if slot cannot be filled
}

// Runtime binding wrapper
type BoundEvent = GameEvent & {
  boundActors: Record<string, string>;
};
```

### `game-state.ts`

```typescript
// pendingEvents holds BoundEvent (not plain GameEvent) at runtime
pendingEvents: BoundEvent[];

// DeferredEventEntry gains optional actor persistence
interface DeferredEventEntry {
  eventId: string;
  scheduledTurn: number;
  boundActors?: Record<string, string>;  // NEW — persists actors across deferred gap
}
```

---

## New Module: `src/simulation/events/actor-resolver.ts`

All matching, selection, and interpolation logic lives here. Pure TypeScript, zero React, seeded RNG only.

### Functions

**`matchesCriteria(person, criteria, state): boolean`**
Pure predicate. Checks all populated criteria fields against the person. `maritalStatus` is derived from `person.spouseIds.length`. `minSkill` calls `getDerivedSkill` for derived skills and direct lookup for base skills.

**`canFillSlot(criteria, state, excludeIds?): boolean`**
Returns true if at least one person in `state.people` passes `matchesCriteria` and is not in `excludeIds`. No RNG — used for feasibility checks.

**`canResolveActors(requirements, state): boolean`**
Iterates slots in declaration order, checking each required slot can be filled while excluding people already claimed by earlier slots. Returns false if any required slot is unfillable. No RNG — used as an eligibility gate in `isEventEligible`.

**`selectActor(criteria, state, rng, excludeIds?): Person | null`**
Collects all qualifying people into a pool, uses `rng.nextInt(0, pool.length - 1)` to pick one. Returns null if the pool is empty.

**`resolveActors(requirements, state, rng): Record<string, string> | null`**
Iterates slots in order, calling `selectActor` and accumulating `excludeIds` so no two slots can bind the same person. If any required slot returns null, returns null.

**`interpolateText(text, slots): string`**
Substitutes all `{slot.*}` tokens using the provided map of slot → Person. Handles all pronoun variants. Unrecognised tokens are passed through unchanged.

---

## Changes to Existing Modules

### `event-filter.ts` — `isEventEligible`

After the existing prerequisite checks, add:

```
if event.actorRequirements exists → canResolveActors(event.actorRequirements, state) must be true
```

This makes `actorRequirements` act as implicit prerequisites, replacing many existing `has_person_matching` checks long-term (both can coexist in the interim).

### `resolver.ts` — `applyConsequence` + `resolveSkillCheck`

**`applyConsequence(consequence, state, rng?, boundActors?)`**
When `consequence.target` starts with `{`, resolve to a person ID via `boundActors` before switching on type.

**`resolveSkillCheck(check, state, context, boundActors?)`**
`actorSelection: 'actor_slot'` now reads the actor ID from `boundActors[check.actorSlot]` directly (replaces the previously planned but unimplemented `context` lookup).

**`applyEventChoice(event, choiceId, state, rng?, boundActors?)`**
Receives `boundActors` and passes it down to both functions above. Also populates `EventRecord.involvedPersonIds` from `Object.values(boundActors)`.

### `game-store.ts` — `startTurn` + `resolveEventChoice`

**`startTurn()`**
After `drawEvents()`, for each drawn event, call `resolveActors(event.actorRequirements, state, rng)` to produce slot bindings. Construct a `BoundEvent` with `boundActors: result ?? {}`. Events without `actorRequirements` get `boundActors: {}`.

When draining the deferred queue, reconstruct `BoundEvent` using the `boundActors` stored in `DeferredEventEntry`.

**`resolveEventChoice(eventId, choiceId)`**
Extract `boundActors` from the `BoundEvent` in `pendingEvents` and pass it into `applyEventChoice`.

---

## UI Changes: `EventView.tsx`

**Actor strip**
When `boundActors` is non-empty, render a horizontal strip above the event description. Each slot that maps to a live person shows a `CouncilPortrait` (40×50px, reusing the existing component) with `person.firstName` below it. Slots without a resolved person are silently omitted.

**Text interpolation**
Before rendering event title, description, and each choice's label and description, call `interpolateText(text, resolvedPeople)` where `resolvedPeople` maps slot names to full `Person` objects (looked up from `state.people` via `boundActors`).

---

## Event Retrofitting Plan

All 28+ events across the 7 definition files are updated. Below are the slot assignments by file. Events marked **no slots** involve external parties (Company couriers, arriving strangers, new arrivals added via `add_person` consequences) where no binding is possible because the person does not yet exist in the settlement.

### building.ts

| Event | Slots | Criteria |
|-------|-------|----------|
| `bld_fever_spreads` | `healer` | best plants skill from settlement (via skill check `actorSelection`) |
| `bld_bitter_quarrel` | `settler` · `rival` | `{sex:'male', culturalIdentity:'imanian_*'}` · `{sex:'female', religion:'sacred_wheel'}` |
| `bld_someone_leaves` | `leaver` | `{minAge:20}` |
| `bld_completion_toast` | `foreman` | best leadership from settlement |
| `bld_traders_notice` | no slots | external Kiswani merchants |

### company.ts

| Event | Slots | Criteria |
|-------|-------|----------|
| `co_supply_delivery` | no slots | external Company wagon |
| `co_quota_reminder` | no slots | external courier; skill check continues to use `best_settlement` |

### cultural.ts

| Event | Slots | Criteria |
|-------|-------|----------|
| `cul_sauromatian_envoy` | `negotiator` | best diplomacy from settlement |
| `cul_wheel_ceremony_request` | `speaker` | `{sex:'female', religion:'sacred_wheel', minAge:35}` |
| `cul_sacred_wheel_icon_found` | `finder` | `{sex:'male'}` |
| `cul_imanian_feast_tension` | `objector` | `{sex:'male', religion:'imanian_orthodox'}` |
| `cul_religious_tension_peaks` | `woman` · `objector` | `{sex:'female', religion:'sacred_wheel'}` · `{sex:'male', religion:'imanian_orthodox'}` |
| `cul_craft_knowledge_shared` | `craftswoman` | `{sex:'female', religion:'sacred_wheel', maxAge:35}` |
| `cul_language_lesson` | `tutor` | `{sex:'female', religion:'sacred_wheel'}` |
| `cul_joint_harvest` | no slots | group/community activity |
| `cul_traditional_man_objects` | `objector` | `{sex:'male', religion:'imanian_orthodox'}` |
| `cul_women_organise` | `foreman` · `leader` | `{sex:'male'}` · `{sex:'female', religion:'sacred_wheel'}` |
| `cul_governance_debate` | `advocate` | `{sex:'male', minAge:30}` |
| `cul_first_born_in_settlement` | `newborn` · `father` | `{maxAge:2}` · `{sex:'male'}` |
| `cul_daughters_majority` | no slots | demographic event |
| `cul_naming_dispute` | `husband` · `wife` | `{sex:'male', maritalStatus:'married', religion:'imanian_orthodox'}` · `{sex:'female', maritalStatus:'married', religion:'sacred_wheel'}` |
| `cul_company_informant_letter` | no slots | external Company inquiry |
| `cul_cosmopolitan_advocate` | `broker` | `{hasTrait:'cosmopolitan'}` with fallback `{sex:'male', minSkill:{skill:'bargaining', value:40}}` |
| `cul_elder_settles_dispute` | `elder` | `{sex:'female', religion:'sacred_wheel', minAge:40}` |
| `cul_cultural_festival` | no slots | group/community activity |

### diplomacy.ts

| Event | Slots | Criteria |
|-------|-------|----------|
| `dip_riverfolk_observers` | `envoy` | best diplomacy from settlement |

### domestic.ts

| Event | Slots | Criteria |
|-------|-------|----------|
| `dom_hunting_party` | `scout` | `{sex:'male'}` — skill check will auto-select best hunting |
| `dom_homesick_man` | `settler` | `{sex:'male', religion:'imanian_orthodox'}` |
| `dom_settler_initiative` | `lead` · `partner` | two males (partner excludes lead) |
| `dom_riverfolk_widow` | no slots | person created by `add_person` consequence |
| `dom_company_send_women` | no slots | external Company directive |
| `dom_sauromatian_proposal` | `bride` | `{sex:'female', religion:'sacred_wheel', maritalStatus:'unmarried', minAge:16}` |
| `dom_lonely_settler` | `suitor` · `beloved` | `{sex:'male', minAge:25}` · `{sex:'female', religion:'sacred_wheel', maritalStatus:'unmarried'}` |
| `dom_first_harvest` | `ceremony_leader` | `{sex:'female', religion:'sacred_wheel'}` |
| `dom_mixed_child_born` | `child` · `mother` · `father` | `{maxAge:2}` · `{sex:'female', minAge:16}` · `{sex:'male', minAge:16}` |
| `dom_elder_complaint` | `elder` | `{sex:'male', socialStatus:'founding_member', minAge:40}` |
| `dom_essence_sharing` | no slots | group Sauromatian observance |
| `dom_company_inspector` | no slots | external Company official |
| `dom_stranger_at_gate` | no slots | external arrival |
| `dom_midwife_offer` | `midwife` | `{sex:'female', religion:'sacred_wheel', minAge:35}` |
| `dom_sacred_wheel_witness` | `witness` | `{sex:'male', religion:'imanian_orthodox'}` |

### economic.ts

| Event | Slots | Criteria |
|-------|-------|----------|
| `eco_passing_merchant` | `negotiator` | best bargaining from settlement |
| `eco_useful_timbers` | `scout` | `{sex:'male'}` |

### environmental.ts

| Event | Slots | Criteria |
|-------|-------|----------|
| `env_bountiful_harvest` | no slots | elemental/seasonal |
| `env_violent_storm` | no slots | elemental/seasonal |
| `env_winter_hardship` | no slots | elemental/seasonal |

---

## Test Plan

### New: `tests/events/actor-resolver.test.ts`
- `matchesCriteria` — each criterion field independently, combinations, edge cases (no skills, empty traits)
- `canFillSlot` — empty settlement, partial match, full match, exclusion list
- `selectActor` — seeded determinism (same seed → same person), exclusion prevents repeats, null when pool empty
- `resolveActors` — multi-slot exclusion, all-required-fails → null, optional slot allowed to be missing
- `canResolveActors` — feasibility gate mirrors `resolveActors` but uses no RNG

### New: `tests/events/interpolation.test.ts`
- All `{slot.*}` variants against male and female persons
- Capitalised pronoun variants
- Multiple slots in one string
- Unknown slot token passthrough
- No-op on strings with no tokens

### Extended: `tests/events/resolver.test.ts`
- `applyConsequence` with `target: '{subject}'` and `boundActors` — resolves to correct person ID
- `resolveSkillCheck` with `actorSelection: 'actor_slot'` — uses `boundActors` correctly
- Missing `boundActors` entry for a slot-targeted consequence — no crash, consequence skipped

**All 435 existing tests must continue to pass.**

---

## Scope Boundaries

**In scope:**
- Actor badge strip in EventView (portrait + name label)
- Text interpolation in title, description, choice label, choice description
- Consequence slot targeting (`target: '{slot}'`) for individual-person consequence types
- Deferred event actor persistence via `DeferredEventEntry.boundActors`
- `EventRecord.involvedPersonIds` auto-populated from bound actors

**Out of scope (future work):**
- Clickable actor name links that open PersonDetail
- Actor opinion changes persisted as `relationships` entries between bound characters
- Marriage proposals wired directly to `arrangeMarriage()`
- Skill checks always forced to use the bound actor (some checks legitimately use `best_settlement`)
- Trait-based `ActorCriteria` fallback chains (the `cul_cosmopolitan_advocate` fallback is the only planned case)

---

## Implementation Order

1. `engine.ts` + `game-state.ts` type changes
2. New `actor-resolver.ts` module
3. `resolver.ts` changes (boundActors plumbing)
4. `event-filter.ts` + `game-store.ts` wiring
5. `EventView.tsx` actor strip + interpolation
6. Retrofit all event definition files (can be done in parallel across files)
7. New tests

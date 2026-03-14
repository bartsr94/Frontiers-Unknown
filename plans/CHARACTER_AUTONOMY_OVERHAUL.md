# Character Autonomy Overhaul — Design & Architecture

**Feature:** Phase 4.0 — Deep Character Agency  
**Phase:** Phase 4 (Polish)  
**Status:** 🔲 Not started  
**Companion docs:** `AUTONOMY_SYSTEM.md` (Phase 3.6 foundation), `OPINIONS_SYSTEM.md`, `TRAIT_EXPANSION.md`

---

## 1. Vision

Characters in the Ashmark should feel like *people with lives*, not pawns awaiting orders. In the current system every character aspiration surfaces as a player-facing event requiring a decision before anything changes. That's good for high-stakes moments, but it means the world is static the moment the player looks away. Nothing grows on its own. Nobody forms a friendship, nobody quietly begins teaching an apprentice, nobody organises their neighbours around a shared grievance.

The goal is a shift inspired by Crusader Kings 3: **significant things can happen without the player's direct involvement**. The player is the settlement's overseer, not its puppet-master. They set conditions, observe what emerges, and intervene when it matters.

**The new behaviours characters perform without player permission:**

- Form close friendships and bitter rivalries (Named Relationships)
- Pursue hidden personal projects — courtship, mentoring, converting a neighbour's faith, undermining a competitor (Schemes)
- Seek meaningful personal goals beyond marriage and council seats (Expanded Ambitions)
- Find useful work after sitting idle for more than a handful of seasons (Idle Role-Seeking)
- Cluster into blocs around shared values and make collective demands (Factions)

All of this produces a continuous stream of legible activity — visible in PersonDetail, in a settlement-level Activity Feed, and optionally in a developer debug log that renders every autonomous action as it happens.

**The measure of success:** After twenty turns, the player should be able to watch two characters they never personally managed and describe what kind of relationship they've built and what each one is quietly after.

---

## 2. Design Principles

### 2.1 Semi-visible, not hidden
Characters act on their own, but the player can always see *that* something is happening, even if not exactly what. Every character pursuing a scheme gets a badge in PersonDetail. Every named relationship is visible as a coloured chip. The player is an informed observer, not a blind one.

### 2.2 Silent outcomes are for minor things
Befriending someone, self-assigning a job, beginning a mentoring relationship — these happen silently. They are discovered by the player through observation. High-stakes outcomes — courtship reaching its conclusion, a character undermining a rival, a faction making demands — still surface as player-facing events.

### 2.3 Player authority is never broken
The player can always manually assign a role, override a self-assignment, decline a faction demand, break up a rivalry via events. Autonomy adds agency to characters; it doesn't remove authority from the player.

### 2.4 Pure simulation, seeded RNG
All new simulation functions follow the established pattern: pure TypeScript functions with no React imports, all randomness through the seeded `RNG` instance, no `Math.random()`. Deterministic given the same seed.

### 2.5 Immutable delta maps
All per-turn processing functions return delta maps (only changed entries) rather than full copies. This is the existing contract in `decayOpinions`, `decayOpinionModifiers`, and must be respected in all new systems.

---

## 3. System Overview

| System | New file | Modifies | Silent outcomes | Player events |
|--------|----------|----------|----------------|---------------|
| A — Named Relationships | `named-relationships.ts` | PersonDetail, turn-processor | Yes (bond formation/dissolution) | Optional notification events |
| B — Scheme Engine | `scheme-engine.ts` | PersonDetail, turn-processor | Yes (befriend, tutor breakthrough) | 4 scheme-resolution events |
| C — Expanded Ambitions | (extends `ambitions.ts`) | relationships.ts, event-filter | No | 5 new events |
| D — Idle Role-Seeking | (inline in turn-processor) | game-store role assignment | Yes (role change) | None |
| E — Faction System | `factions.ts` (world/) | SettlementView, game-state | Yes (faction forms/dissolves) | 5 faction events |
| F — Activity Log | (inline in game-state) | SettlementView | — | — |
| G — Debug / Settings | `debug-logger.ts` + Settings overlay | GameScreen, App | — | — |

---

## 4. Data Model Changes

All additions follow the rule: plain objects or primitive arrays where possible; no new top-level Maps in GameState; `?? fallback` in `deserializePerson` / `deserializeGameState` for every new field.

### 4.1 New `Person` fields

```typescript
// src/simulation/population/person.ts

// Named relationships (plain object array — trivially serialisable)
namedRelationships: NamedRelationship[];

// Active scheme (single scheme per person)
activeScheme: PersonScheme | null;

// When the current WorkRole was last set (by player or by idle role-seeking)
roleAssignedTurn: number;
```

Defaults in `createPerson()`:
```typescript
namedRelationships: [],
activeScheme: null,
roleAssignedTurn: 0,
```

Fallbacks in `deserializePerson()`:
```typescript
namedRelationships: p.namedRelationships ?? [],
activeScheme: p.activeScheme ?? null,
roleAssignedTurn: p.roleAssignedTurn ?? 0,
```

### 4.2 New `GameState` fields

```typescript
// src/simulation/turn/game-state.ts

// Faction list (plain object array — trivially serialisable)
factions: Faction[];

// Rolling activity log (capped at 30 entries; oldest trimmed)
activityLog: ActivityLogEntry[];

// Debug & settings
debugSettings: DebugSettings;
```

Fallbacks in `deserializeGameState()`:
```typescript
factions: s.factions ?? [],
activityLog: s.activityLog ?? [],
debugSettings: s.debugSettings ?? defaultDebugSettings(),
```

### 4.3 Extended `AmbitionId` union

```typescript
// src/simulation/population/person.ts  (extends existing type)

export type AmbitionId =
  // ---- existing ----
  | 'seek_spouse'
  | 'seek_council'
  | 'seek_seniority'
  | 'seek_cultural_duty'
  | 'seek_informal_union'
  // ---- new in Phase 4.0 ----
  | 'seek_prestige'
  | 'seek_faith_influence'
  | 'seek_skill_mastery'
  | 'seek_legacy'
  | 'seek_autonomy';
```

---

## 5. System A — Named Relationship Types

### 5.1 Philosophy
Opinion is a number. Named relationships are *relationships* — they carry emotional weight beyond the score and produce ongoing mechanical effects that the player can observe.

### 5.2 New file: `src/simulation/population/named-relationships.ts`

```typescript
export type NamedRelationshipType =
  | 'friend'       // Warm, sustained mutual regard
  | 'rival'        // Sustained mutual antagonism or direct goal conflict
  | 'mentor'       // One teaches, one learns — skill transfer
  | 'student'      // Inverse of mentor (same bond, dual entries)
  | 'confidant'    // Deep trust, repeated co-involvement in events
  | 'nemesis';     // Profound enmity; neither can share events comfortably

export interface NamedRelationship {
  type: NamedRelationshipType;
  targetId: string;
  formedTurn: number;
  depth: number;           // 0.0–1.0; grows +0.02/turn; full depth = strongest version of bond
  revealedToPlayer: boolean; // set true on first PersonDetail view that would show it
}
```

### 5.3 Formation rules

`processNamedRelationships(people, currentTurn, rng)` — called in `processDawn()` step 8.92.

| Type | Conditions | Requires existing opinion? |
|------|-----------|--------------------------|
| `friend` | `effectiveOpinion > 60` sustained ≥ 6 turns | Yes |
| `rival` | `effectiveOpinion < -25` sustained ≥ 4 turns **OR** both persons have `seek_council`/`seek_seniority` ambition simultaneously | Yes / Ambition conflict |
| `mentor` | Age diff ≥ 15; mentor has any skill ≥ 63 **and** has `mentor_hearted` or `wise` trait; target age < 35 with that skill < 45; they share a language (fluency ≥ 0.3) | Not required |
| `student` | Auto-created as the inverse of `mentor` on the target person | — |
| `confidant` | `effectiveOpinion > 45` **and** (same primaryCulture **or** same religion) **and** have been co-actors in ≥ 3 events (count matching `eventId` in opinionModifiers) | Yes |
| `nemesis` | `effectiveOpinion < -55` sustained ≥ 4 turns | Yes |

**Opinion "sustained" tracking:** The function receives the current turn. "Sustained N turns" is approximated by checking whether the person already has an entry with `formedTurn` close enough to `currentTurn - N`, or (simpler, no new state) by checking whether the relevant `relationships` score has been below the threshold for a statistically likely period given decay rate. Practical approach: add `opinionSustainedSince: Partial<Record<string, number>>` — a lightweight map on `Person` tracking the first turn each opinion dropped below a threshold. Set when opinion crosses the threshold downward; cleared when it rises above.

> **Implementation note:** `opinionSustainedSince` is a `Partial<Record<string, number>>` (plain object). Add to `Person` interface and `createPerson` defaults. Fallback: `p.opinionSustainedSince ?? {}`.

### 5.4 Dissolution rules

- `friend` → dissolves if `effectiveOpinion` drops below 20 for 3+ consecutive turns
- `rival` → dissolves if opinion rises above +10 (rivalry overcome) or ambition conflict resolves
- `mentor`/`student` → dissolves if student reaches 80% of mentor's relevant skill OR mentor leaves/dies
- `confidant` → dissolves if opinion drops below 0
- `nemesis` → dissolves only through a specific event choice (rare; deliberate reconciliation needed)

### 5.5 Passive mechanical effects

| Relationship (depth > 0.5) | Effect |
|---------------------------|--------|
| `mentor` → `student` | +2/season to student's relevant skill (merges into step 8.5 skill delta) |
| `friend` pair | Both persons immune to `homesick` and `restless` trait application |
| `rival` pair | Each person's ambition intensity grows +0.02/turn faster; rivalry produces extra event weight in `domestic` category |
| `nemesis` pair | Both are auto-excluded from being co-actors in the same event slot (treated like `away` exclusion in actor-resolver) |

### 5.6 Activity Log emissions
- `relationship_formed` when a named relationship first forms (any type)
- `relationship_dissolved` when dissolved (if `friend`, `confidant`, or `mentor`)

### 5.7 New prerequisite

```typescript
// event-filter.ts
case 'has_named_relationship':
  // params: { type?: NamedRelationshipType }
  // true if any person has an active named relationship of that type
```

### 5.8 UI
`PersonDetail.tsx` — new "Bonds" section, rendered below Traits:
- Each entry: small portrait chip + type label + depth progress bar (slim, 40px wide)
- Green chips: `friend`, `confidant`, `mentor`/`student`
- Red chips: `rival`, `nemesis`
- Clicking a chip navigates to that person's detail panel (same pattern as Key Opinions)

---

## 6. System B — Scheme Engine

### 6.1 Philosophy
Every character with a strong enough personality trait quietly pursues a private project. Some projects resolve without anyone noticing. Others surface as events when they reach their conclusion. The player sees a badge indicating *something is happening* without knowing exactly what until it either fires an event or is discovered through inspecting PersonDetail.

### 6.2 New file: `src/simulation/personality/scheme-engine.ts`

```typescript
export type SchemeType =
  | 'scheme_court_person'    // Romantic pursuit; culminates in courtship event
  | 'scheme_convert_faith'   // Religious advocacy; culminates in conversion event
  | 'scheme_befriend_person' // Social bonding; SILENT outcome — friend bond forms
  | 'scheme_undermine_person'// Social sabotage; undermining event at climax
  | 'scheme_tutor_person';   // Mentoring focus; SILENT skill boost + breakthrough notification

export interface PersonScheme {
  type: SchemeType;
  targetId: string;
  progress: number;           // 0.0–1.0
  startedTurn: number;
  revealedToPlayer: boolean;  // set true when any event fires or player inspects
}
```

Added to `Person` interface: `activeScheme: PersonScheme | null`.

### 6.3 Scheme generation

`generateScheme(person, people, currentTurn, rng)` — called per person in `processDawn()` step 8.93, every 12 turns, only if `activeScheme === null`.

| Scheme | Generating trait | Additional conditions |
|--------|-----------------|----------------------|
| `scheme_court_person` | `passionate` or `romantic` | Unmarried; opinion ≥ 50 for an eligible target |
| `scheme_convert_faith` | `zealous` or `pious` | Sees someone of a different faith with opinion ≥ 30 |
| `scheme_befriend_person` | `gregarious` or `lonely` | No existing `friend` named relationship; opinion ≥ 40 for some target |
| `scheme_undermine_person` | `jealous` or `ambitious` | Has an active `rival` named relationship, OR a competing ambition exists |
| `scheme_tutor_person` | `mentor_hearted` | Has an existing `mentor` named relationship with a target |

Target selection: if multiple targets qualify, pick the one with highest `effectiveOpinion` (for positive schemes) or lowest (for undermining). Seeded RNG used only as tiebreaker.

### 6.4 Scheme progress

`processSchemes(people, currentTurn, rng)` — runs each dawn, step 8.93. Returns delta map of changed persons only.

| Scheme | Progress/turn | Outcome at 1.0 | Fails if |
|--------|--------------|----------------|---------|
| `scheme_befriend_person` | +0.05 | SILENT: `friend` named relationship immediately formed; scheme cleared | Target opinion drops < 0 |
| `scheme_tutor_person` | +0.03 | SILENT skill delta applied (+4 one-time boost); fires `sch_tutor_breakthrough` notification event | Target leaves, mentor leaves, or `student` bond dissolves |
| `scheme_court_person` | +0.04 × opinion_factor | Fires `sch_courtship_discovered` — player resolves | Target opinion drops < -10; target marries someone else |
| `scheme_convert_faith` | +0.025 | Fires `sch_conversion_complete` — player resolves | Religious policy becomes `orthodox_enforced`; target left settlement |
| `scheme_undermine_person` | +0.04 | Fires `sch_undermining_climax` — player resolves | Instigator gains `respected_elder` trait (mellows); target's opinion of instigator rises > +20 |

`opinion_factor` = `clamp(effectiveOpinion(schemer, target) / 100, 0.5, 1.5)` — higher mutual regard speeds up courtship.

**Intermediate events:**
- `scheme_convert_faith` fires `sch_faith_advocacy_noticed` at progress = 0.45 (early warning; player can forbid)
- `scheme_undermine_person` fires `sch_rumours_spreading` at progress = 0.5 (player can investigate)

### 6.5 New events file: `src/simulation/events/definitions/schemes.ts`

Six events. All have `actorRequirements` binding the schemer (and optionally the target).

| Event ID | Trigger | Player choices |
|----------|---------|----------------|
| `sch_courtship_discovered` | `scheme_court_person` progress = 1.0 | Encourage → formal proposal; Arrange formally → skip to marriage dialog; Discourage → scheme ends, opinion delta |
| `sch_faith_advocacy_noticed` | `scheme_convert_faith` progress = 0.45 | Allow openly; Warn to be discreet; Forbid entirely (scheme abandoned) |
| `sch_conversion_complete` | `scheme_convert_faith` progress = 1.0 | Accept the conversion; Express concern; Formally oppose |
| `sch_rumours_spreading` | `scheme_undermine_person` progress = 0.5 | Investigate source; Contain the rumours; Ignore it |
| `sch_undermining_climax` | `scheme_undermine_person` progress = 1.0 | Confront schemer; Mediate; Let it play out |
| `sch_tutor_breakthrough` | `scheme_tutor_person` progress = 1.0 | Acknowledge the pair (opinion boost both); Give the student a new responsibility (role suggestion) |

All six events are added to `ALL_EVENTS` in `event-filter.ts` and weighted under `relationships` category.

### 6.6 UI
`PersonDetail.tsx` — new "Pursuing" subsection within Ambitions area:
- If `activeScheme !== null && !revealedToPlayer`: amber badge, text *"This person is quietly pursuing something..."*
- If `activeScheme !== null && revealedToPlayer`: scheme type label (humanised) + target name + narrow progress bar (0–100%)
- If `activeScheme === null`: nothing shown

---

## 7. System C — Expanded Ambitions

### 7.1 Five new ambition types

| ID | Trigger conditions | Evaluation (fulfilled) | Event at ≥ 0.7 intensity |
|----|--------------------|------------------------|-------------------------|
| `seek_prestige` | Age ≥ 25; leadership **or** combat ≥ 46 (VG); does **not** already have `veteran`, `renowned_leader`, or similar earned glory trait; no active `away` mission | Gains an earned glory trait **or** is sent on a deferred mission via `rel_prestige_opportunity` | `rel_prestige_opportunity` |
| `seek_faith_influence` | Has `zealous` **or** `pious` trait; leadership **or** bargaining ≥ 46; current role is not `priest_solar`, `wheel_singer`, or `voice_of_wheel` | Role changes to a priest role | `rel_faith_calling` |
| `seek_skill_mastery` | Any skill in VG tier (46–62); currently working the role that trains that skill (e.g. `plants` ≥ 46 and role is `farmer`/`gather_food`/`healer`) | That skill reaches EX tier (63+) | `rel_mastery_dedication` |
| `seek_legacy` | Age ≥ 45; at least one adult child (age ≥ 14) who is unmarried | All adult children are married **or** in informal unions | `rel_legacy_concern` |
| `seek_autonomy` | `identityPressure.companyPressureTurns ≥ 4` **AND** person has sauromatian heritage (`SAUROMATIAN_CULTURE_IDS`) **OR** average opinion of all current council members < −15 | Religious/cultural policy becomes more permissive, **or** company standing drops below 40 (company stops mattering), **or** a `company_loyalists` faction forms (someone else picked up the slack) | `rel_independence_voice` |

### 7.2 New events in `relationships.ts`

**`rel_prestige_opportunity`** — a chance for greatness presents itself.
- Actor: `petitioner` (the ambitious person)
- Choices: Send on a prestigious mission (deferred `away` event, 3–5 turns, outcome grants `brave`/`renowned_fighter` earned trait) · Offer a leadership position instead · Decline for now

**`rel_faith_calling`** — they feel called to spiritual service.
- Actor: `devout` (the pious person)
- Choices: Assign to matching priest role · Offer to build a faith building · Decline (intense disappointment, −15 opinion toward council)

**`rel_mastery_dedication`** — they wish to devote themselves to a craft.
- Actor: `artisan`
- Choices: Endorse (temporary +3 skill growth/season for 4 turns) · Acknowledge but change nothing · Redirect to a different role

**`rel_legacy_concern`** — a parent worries about their children's futures.
- Actor: `parent`
- Choices: Open the MarriageDialog for one of their children · Offer a keth-thara alternative for a son · Reassure (minor opinion boost, ambition intensity resets to 0.3)

**`rel_independence_voice`** — someone speaks out against external authority.
- Actor: `dissenter`
- Choices: Acknowledge their concerns (modify_cultural_blend −0.05) · Defend Company authority (opinion penalty all sauromatian-heritage persons) · Convene a council discussion (fires a follow-up deliberation event)

### 7.3 Implementation
- Extend `AmbitionId` union in `person.ts`
- Add 5 generation branches in `generateAmbition()` in `ambitions.ts` — priority order appended after existing 5 (lowest priority)
- Add 5 evaluation branches in `evaluateAmbition()`
- Add 5 events to `relationships.ts` (follow existing event definition pattern)
- `has_person_with_ambition` prerequisite in event-filter automatically supports new IDs (no change needed)

---

## 8. System D — Idle Role-Seeking

### 8.1 Philosophy
The settlement isn't a factory floor where workers stand motionless until assigned. After a moderate idle period characters find useful work based on what they're best at.

### 8.2 New `Person` field

```typescript
roleAssignedTurn: number;   // turn on which current role was last set by player or auto-assignment
```

Set to `0` in `createPerson()`. Set to `currentTurn` in:
- `game-store.ts` whenever a player manually assigns a role (all existing role assignment actions)
- `resolveIdleRoleSeeking()` when the function auto-assigns

### 8.3 `resolveIdleRoleSeeking(people, builtBuildings, currentTurn)` — inline in `turn-processor.ts`

Called at step 8.95 in `processDawn()`. Returns delta map of changed persons. Never modifies `builder`, `away`, or `keth_thara` — those roles are protected.

```
For each person where:
  role === 'unassigned'
  AND currentTurn - roleAssignedTurn >= 4
  AND socialStatus !== 'thrall'

  → rank available roles by skill:
      plants highest   → 'farmer' (if 'fields' built) else 'gather_food'
      combat highest   → 'guard'
      bargaining highest → 'trader' (if 'trading_post' built)
      custom highest   → 'craftsman' (if 'workshop' built) else 'gather_lumber'
      default fallback → 'gather_food'

  → assign the role (immutable update in delta map)
  → set roleAssignedTurn = currentTurn
  → emit ActivityLogEntry { type: 'role_self_assigned', personId, description }
```

### 8.4 Player override
When the player assigns a role via any store action, `roleAssignedTurn` is updated to `currentTurn`. This resets the idle clock, so the system won't immediately re-auto-assign.

---

## 9. System E — Faction System

### 9.1 Philosophy
Politics emerges from demographics. When enough people share a cultural, religious, or economic interest, they begin acting as a bloc — and eventually make collective demands the player must navigate.

### 9.2 New file: `src/simulation/world/factions.ts`

```typescript
export type FactionType =
  | 'cultural_preservationists'  // Sauromatian heritage; resist company cultural drift
  | 'company_loyalists'          // Imanian heritage; defend the Company's authority
  | 'orthodox_faithful'          // Orthodox believers; oppose Wheel presence
  | 'wheel_devotees'             // Wheel/Hidden Wheel believers; seek tolerance
  | 'community_elders'           // Respected elders; collective moral authority
  | 'merchant_bloc';             // Traders and craftsmen; want economic freedom

export type FactionDemandType =
  | 'policy_change'
  | 'resource_grant'
  | 'building_request'
  | 'cultural_accommodation';

export interface FactionDemand {
  type: FactionDemandType;
  description: string;           // Human-readable: "We demand the Wheel faith be recognised"
  params: Record<string, unknown>; // Machine-readable: { policy: 'wheel_permitted' }
}

export interface Faction {
  id: string;                    // e.g. 'faction_orthodox_1'
  type: FactionType;
  memberIds: string[];           // Person IDs
  strength: number;              // 0.0–1.0; clamp(memberCount / totalPop, 0, 1) × coherence
  formedTurn: number;
  activeDemand?: FactionDemand;
  demandFiredTurn?: number;      // Turn on which the demand event was queued
}
```

Added to `GameState`: `factions: Faction[]`.

### 9.3 Formation conditions

`processFactions(state, currentTurn)` — called at step 9.6b in `processDawn()`, after identity pressure processing.

| Faction type | Minimum members | Additional condition |
|-------------|----------------|---------------------|
| `cultural_preservationists` | 3 | `SAUROMATIAN_CULTURE_IDS` heritage; `culturalBlend > 0.60` |
| `company_loyalists` | 3 | Imanian heritage (imanian bloodline fraction ≥ 0.50); company standing > 70 |
| `orthodox_faithful` | 3 | `religion === 'imanian_orthodox'`; `computeReligiousTension() > 0.25` |
| `wheel_devotees` | 3 | `religion === 'sacred_wheel'` or `'syncretic_hidden_wheel'`; `computeReligiousTension() > 0.25` |
| `community_elders` | 3 | `traits.includes('respected_elder')` |
| `merchant_bloc` | 3 | `role === 'trader'` or `'craftsman'`; `hasBuilding(buildings, 'trading_post')` |

At most one faction of each type can exist simultaneously. If a faction's membership drops below 2, it dissolves silently with an Activity Log entry.

**Strength formula:**
```
coherence = avg(effectiveOpinion between all member pairs) / 100   // normalised to [0, 1]
strength = clamp(memberCount / totalPop, 0, 1) × (0.5 + coherence × 0.5)
```

### 9.4 Demand generation

When `strength > 0.45` and `activeDemand === undefined` and `demandFiredTurn` has not been set within the last 20 turns, the faction generates a demand. Demand content is deterministic based on faction type and current game state:

| Faction | Typical demand |
|---------|---------------|
| `cultural_preservationists` | `policy_change`: set `religiousPolicy` to `wheel_permitted` **or** `cultural_accommodation`: increase Sauromatian cultural pull events |
| `company_loyalists` | `resource_grant`: contribute extra goods to quota **or** demand expulsion of a specific non-Imanian person |
| `orthodox_faithful` | `policy_change`: set `religiousPolicy` to `orthodox_enforced` |
| `wheel_devotees` | `policy_change`: set `religiousPolicy` to `wheel_permitted` or `hidden_wheel_recognized` |
| `community_elders` | `building_request`: build `gathering_hall` or `great_hall` if not present |
| `merchant_bloc` | `resource_grant`: 10 gold from reserves **or** `building_request`: upgrade to Trading Post |

### 9.5 New events file: `src/simulation/events/definitions/factions.ts`

Five events. All have `actorRequirements` naming a faction spokesperson (highest-leadership member of the faction).

| Event ID | Trigger | Choices |
|----------|---------|---------|
| `fac_faction_demands` | Any faction demand generated | Concede · Negotiate (partial) · Refuse outright |
| `fac_faction_appeased` | Deferred outcome, fires 1 turn after demand met | Narration: faction pleased, standing boost |
| `fac_faction_splits` | Two members of same faction have `rival` or `nemesis` relationship | Mediate · Let it split (faction weakens) · Back one side |
| `fac_newcomer_pressured` | Faction strength > 0.55 + newcomer in settlement ≤ 3 turns | Let them approach · Warn newcomer · Forbid recruitment |
| `fac_faction_standoff` | Two opposing factions both exist (e.g. `orthodox_faithful` + `wheel_devotees`) + both strength > 0.4 | Side with one faction · Call a community meeting · Enforce neutrality |

### 9.6 New prerequisite

```typescript
case 'has_active_faction':
  // params: { type?: FactionType }
  // true if any faction exists (optionally: of a specific type)
```

### 9.7 UI
New "Factions" panel in `SettlementView.tsx`, mounted between Households and Religion side-panels:
- Each faction: colour banner (type-specific) + member count + strength bar (5 ticks)
- If active demand: amber demand badge with short description
- Empty state: muted italic "No organised factions yet"

---

## 10. System F — Activity Log

### 10.1 Purpose
The Activity Log is the player's window into all the silent autonomous activity. It doesn't require hunting through PersonDetail for every character. It surfaces the narrative of what the settlement's *people* are doing — not just the settlement's *resources*.

### 10.2 Data model

```typescript
// src/simulation/turn/game-state.ts

export type ActivityLogType =
  | 'role_self_assigned'
  | 'relationship_formed'
  | 'relationship_dissolved'
  | 'scheme_started'
  | 'scheme_succeeded'
  | 'scheme_failed'
  | 'faction_formed'
  | 'faction_dissolved'
  | 'trait_acquired'         // earned trait gained via checkEarnedTraitAcquisition
  | 'ambition_formed'        // new ambition generated
  | 'ambition_cleared';      // ambition fulfilled or stale

export interface ActivityLogEntry {
  turn: number;
  type: ActivityLogType;
  personId?: string;         // primary person involved
  targetId?: string;         // secondary person (if applicable)
  description: string;       // Human-readable, uses first names only
}
```

`activityLog: ActivityLogEntry[]` added to `GameState`. Trimmed at 30 entries (FIFO).

### 10.3 Emission points

| System | Log types emitted |
|--------|------------------|
| Named Relationships | `relationship_formed`, `relationship_dissolved` |
| Schemes | `scheme_started`, `scheme_succeeded`, `scheme_failed` |
| Idle Role-Seeking | `role_self_assigned` |
| Factions | `faction_formed`, `faction_dissolved` |
| Earned Trait Acquisition | `trait_acquired` |
| Ambition System | `ambition_formed`, `ambition_cleared` (currently unlogged — add emission in `processDawn` step 8.9) |

### 10.4 New component: `src/ui/components/ActivityFeed.tsx`

```typescript
interface ActivityFeedProps {
  entries: ActivityLogEntry[];
  people: Map<string, Person>;
  graveyard: GraveyardEntry[];
}
```

- Scrollable list, max-height 180px, overflow-y scroll
- Each entry: left-aligned turn badge (`T{n}`) + icon (emoji or unicode glyph per type) + humanised description
- Entries are read-only; clicking a name navigates to that PersonDetail
- Mounted in `SettlementView.tsx` in the main content area, collapsed by default (toggle button)

---

## 11. System G — Debug & Settings

### 11.1 Purpose
The game needs an in-game settings layer regardless of debug needs. The debug log is a developer tool that renders every autonomous action in real-time — invaluable for tuning scheme probabilities, faction formation thresholds, and ambition trigger rates without reading save files.

### 11.2 Settings state

```typescript
// src/simulation/turn/game-state.ts

export interface DebugSettings {
  showAutonomyLog: boolean;       // Renders full autonomy trace to browser console each turn
  logSchemes: boolean;            // Extra detail: scheme progress each turn
  logOpinionDeltas: boolean;      // Extra detail: every opinion change and its source
  logFactionStrength: boolean;    // Extra detail: faction strength + demand status each turn
  logAmbitions: boolean;          // Extra detail: ambition tick, generation, clearing
  pauseOnSchemeEvent: boolean;    // Auto-pauses (emits a warning) when a scheme would fire
}

export function defaultDebugSettings(): DebugSettings {
  return {
    showAutonomyLog: false,
    logSchemes: false,
    logOpinionDeltas: false,
    logFactionStrength: false,
    logAmbitions: false,
    pauseOnSchemeEvent: false,
  };
}
```

Serialised as a plain object. Fallback: `s.debugSettings ?? defaultDebugSettings()`.

### 11.3 Debug logger: `src/utils/debug-logger.ts`

```typescript
// Pure utility — no React imports, no side effects beyond console output

export type DebugChannel =
  | 'autonomy'
  | 'schemes'
  | 'opinions'
  | 'factions'
  | 'ambitions';

export interface AutonomyLogEntry {
  turn: number;
  channel: DebugChannel;
  personId?: string;
  targetId?: string;
  message: string;
  data?: Record<string, unknown>;  // Extra structured context
}

// Called by simulation functions when debug is enabled.
// In production (debugSettings all false), this is a no-op — zero overhead.
export function debugLog(
  settings: DebugSettings,
  entry: AutonomyLogEntry
): void {
  if (!settings.showAutonomyLog) return;
  const channelEnabled =
    (entry.channel === 'schemes' && settings.logSchemes) ||
    (entry.channel === 'opinions' && settings.logOpinionDeltas) ||
    (entry.channel === 'factions' && settings.logFactionStrength) ||
    (entry.channel === 'ambitions' && settings.logAmbitions) ||
    entry.channel === 'autonomy';  // 'autonomy' always shown when master switch is on
  if (!channelEnabled) return;
  console.groupCollapsed(
    `%c[T${entry.turn}] ${entry.channel.toUpperCase()} — ${entry.message}`,
    'color: #a78bfa; font-weight: normal;'
  );
  if (entry.personId) console.log('Person:', entry.personId);
  if (entry.targetId) console.log('Target:', entry.targetId);
  if (entry.data) console.log('Data:', entry.data);
  console.groupEnd();
}
```

`debugLog` is passed the `DebugSettings` from `GameState` and called by all new simulation functions at significant decision points:
- Every named relationship formation/dissolution
- Every scheme generation, progress tick milestone (0.25, 0.5, 0.75, 1.0), completion
- Every idle role-seeking assignment
- Every faction formation, dissolution, demand generation
- Every ambition generation and clearing
- Every opinion delta above ±5 (when `logOpinionDeltas` is on)

### 11.4 Settings overlay: `src/ui/overlays/SettingsOverlay.tsx` (NEW FILE)

A modal overlay triggered from the top navigation. Contains two sections:

**General Settings** (future-use slots)
- Nothing critical here for Phase 4.0; reserve space for audio, display options, etc.

**Developer / Debug Settings** (clearly labelled as developer tools)
- Master toggle: "Show Autonomy Log in Console" → `showAutonomyLog`
- Sub-toggles (enabled only when master is on):
  - "Log scheme progress" → `logSchemes`
  - "Log opinion deltas" → `logOpinionDeltas`
  - "Log faction strength" → `logFactionStrength`
  - "Log ambition lifecycle" → `logAmbitions`
  - "Pause on scheme event" → `pauseOnSchemeEvent`
- Each toggle calls a new `updateDebugSettings(partial: Partial<DebugSettings>)` store action that merges and saves

**Visual note:** Debug section has a subtle amber/dev-mode border so it's visually distinct from real settings. Label: *"Developer Tools — these are not saved between sessions."*

> **Exception to serialisation rule:** `debugSettings` should explicitly **NOT** be saved to localStorage (a developer reloading the page wants to start fresh). Implement by excluding it from the serialised payload and always loading from `defaultDebugSettings()`.

### 11.5 Store action

```typescript
// game-store.ts
updateDebugSettings: (partial: Partial<DebugSettings>) => void;
```

Merges `partial` into `state.debugSettings`. This is the only GameState mutation that does not go through `processDawn`/`processDusk` — it's a direct UI-driven state change.

### 11.6 Settings button in UI

A small gear icon (⚙) added to `LeftNav.tsx` or the top bar. Clicking it opens the `SettingsOverlay`. This is the first placeholder for a settings system the game will need as it grows.

---

## 12. Turn Processor Integration

All new systems slot into `processDawn()`. The full updated sequence around the new steps:

```
... (existing steps 1–8.85 unchanged) ...

Step 8.9    Ambition tick / eval / generation (existing)
             └─ EMIT: 'ambition_formed', 'ambition_cleared' to activityLog  ← NEW emission

Step 8.92   processNamedRelationships(people, currentTurn, rng)             ← NEW
             └─ Form/dissolve named relationships based on opinion thresholds
             └─ Apply mentor skill transfer delta (merged into step 8.5 delta for next turn)
             └─ EMIT: 'relationship_formed', 'relationship_dissolved'
             └─ debugLog: autonomy channel for each new relationship

Step 8.93   generateScheme + processSchemes(people, currentTurn, rng)       ← NEW
             └─ Auto-generate new schemes for eligible persons
             └─ Tick progress on all active schemes
             └─ Resolve silent outcomes (befriend → friend bond; tutor → skill delta)
             └─ Queue scheme-resolution events for player-facing outcomes
             └─ EMIT: 'scheme_started', 'scheme_succeeded', 'scheme_failed'
             └─ debugLog: schemes channel at 0.25/0.5/0.75/1.0 milestones

Step 8.94   checkEarnedTraitAcquisition — existing step, ADD emission        ← MODIFY
             └─ EMIT: 'trait_acquired' to activityLog for new trait grants

Step 8.95   resolveIdleRoleSeeking(people, buildings, currentTurn)          ← NEW
             └─ Auto-assign roles for persons idle ≥ 4 turns
             └─ EMIT: 'role_self_assigned'
             └─ debugLog: autonomy channel for each assignment

... (step 9: cultural blend / religion / hidden wheel unchanged) ...

Step 9.6    processIdentityPressure (existing)
Step 9.6b   processFactions(state, currentTurn)                             ← NEW
             └─ Form/dissolve factions based on population composition
             └─ Compute faction strength
             └─ Generate demands when thresholds crossed
             └─ Queue faction-demand events into pendingEvents
             └─ EMIT: 'faction_formed', 'faction_dissolved'
             └─ debugLog: factions channel

Step 9.7    Event deck shaping via computeTraitCategoryBoosts (existing)

```

**`DawnResult` additions:**
```typescript
namedRelationshipChanges: Array<{ personId: string; change: 'formed' | 'dissolved'; type: NamedRelationshipType; targetId: string }>;
schemeChanges: Array<{ personId: string; change: 'started' | 'completed' | 'failed'; schemeType: SchemeType }>;
idleRoleAssignments: Array<{ personId: string; role: WorkRole }>;
factionChanges: Array<{ factionId: string; change: 'formed' | 'dissolved'; type: FactionType }>;
activityLogAdditions: ActivityLogEntry[];
```

---

## 13. File Map — Complete

### New files

| File | Purpose |
|------|---------|
| `src/simulation/population/named-relationships.ts` | `NamedRelationship` types + `processNamedRelationships()` |
| `src/simulation/personality/scheme-engine.ts` | `SchemeType`, `PersonScheme`, `processSchemes()`, `generateScheme()` |
| `src/simulation/world/factions.ts` | `Faction`, `FactionType`, `FactionDemand`, `processFactions()` |
| `src/simulation/events/definitions/schemes.ts` | 6 scheme-resolution events |
| `src/simulation/events/definitions/factions.ts` | 5 faction events |
| `src/ui/components/ActivityFeed.tsx` | Scrollable autonomous-action history panel |
| `src/ui/overlays/SettingsOverlay.tsx` | Settings + debug toggles modal |
| `src/utils/debug-logger.ts` | `debugLog()` utility — zero overhead when disabled |
| `tests/population/named-relationships.test.ts` | Named relationship formation, dissolution, effects |
| `tests/personality/scheme-engine.test.ts` | Scheme generation, progress, silent/player outcomes |
| `tests/world/factions.test.ts` | Faction formation, strength math, demand generation |

### Modified files

| File | Changes |
|------|---------|
| `src/simulation/population/person.ts` | `AmbitionId` extended (5 new); `Person` gets `namedRelationships`, `activeScheme`, `roleAssignedTurn`, `opinionSustainedSince` |
| `src/simulation/population/ambitions.ts` | 5 new generation + evaluation branches |
| `src/simulation/turn/game-state.ts` | `GameState` gets `factions`, `activityLog`, `debugSettings`; `ActivityLogEntry`, `ActivityLogType`, `DebugSettings`, `defaultDebugSettings()` defined here |
| `src/simulation/turn/turn-processor.ts` | New steps 8.92–9.6b wired in; `DawnResult` extended |
| `src/simulation/events/event-filter.ts` | `has_named_relationship`, `has_active_faction` prerequisite types; all new events added to `ALL_EVENTS` |
| `src/simulation/events/definitions/relationships.ts` | 5 new ambition-driven events (prestige, faith, mastery, legacy, autonomy) |
| `src/stores/game-store.ts` | `updateDebugSettings` action; `roleAssignedTurn` updated on all role-assign actions; `factions`, `activityLog` serialisation fallbacks; `debugSettings` excluded from save payload |
| `src/ui/views/PersonDetail.tsx` | "Bonds" named-relationship section; "Pursuing" scheme badge/progress |
| `src/ui/views/SettlementView.tsx` | Factions panel; ActivityFeed mount |
| `src/ui/layout/LeftNav.tsx` | Settings gear icon → `SettingsOverlay` |
| `src/ui/shared/role-display.ts` | No changes needed (existing 12 WorkRole values cover all idle role targets) |

---

## 14. Test Plan

Existing 981 tests must remain green after every phase. New suites:

### `tests/population/named-relationships.test.ts` — target 25 tests
- `friend` forms when opinion > 60 for 6+ turns
- `friend` does NOT form at opinion = 59
- `rival` forms from sustained low opinion
- `rival` forms from competing `seek_council` ambitions
- `mentor`/`student` pair — both entries created; dissolution when skill gap closes
- `confidant` requires 3 shared event modifiers
- `nemesis` forms; DOES NOT dissolve from opinion recovery alone
- Depth grows +0.02/turn
- Named relationship NOT formed when conditions are met for only 1 turn (sustained check)
- `opinionSustainedSince` correctly set/cleared on threshold crossings

### `tests/personality/scheme-engine.test.ts` — target 25 tests
- `scheme_befriend_person` generated for `gregarious` + eligible target
- No scheme generated if `activeScheme` already exists
- Progress advances correctly per turn
- `scheme_befriend_person` at 1.0 → `friend` relationship formed, scheme cleared (SILENT)
- `scheme_befriend_person` fails if target opinion drops < 0
- `scheme_court_person` at 1.0 → scheme-resolution event queued
- `scheme_convert_faith` queues intermediate event at 0.45
- `scheme_undermine_person` queues intermediate at 0.5; resolution at 1.0
- `opinion_factor` correctly scales courtship progress
- `scheme_tutor_person` applies +4 skill delta on completion
- No scheme generated for `away` person
- No scheme generated for `thrall` person
- Seeded RNG determinism: same seed + same conditions → same scheme type selected

### `tests/world/factions.test.ts` — target 25 tests
- `orthodox_faithful` forms with 3 orthodox persons + tension > 0.25
- `orthodox_faithful` does NOT form with only 2 orthodox persons
- Faction dissolves when membership drops to 1
- `strength` formula: correct with 3/10 pop and coherence
- Demand generated when strength > 0.45
- Demand NOT generated within 20 turns of previous demand
- `merchant_bloc` requires `trading_post` building
- Two opposing faction types can coexist
- Faction membership updates correctly when person's religion changes (event-driven conversion)
- `has_active_faction` prerequisite: true/false correctly

### Ambitions extension — `tests/population/ambitions.test.ts` additions (~15 new tests)
- `seek_prestige` generation conditions
- `seek_prestige` evaluation: fulfilled when mission completed
- `seek_faith_influence` generation: blocked if already a priest role
- `seek_skill_mastery` generation: only when skill is in VG range (46–62)
- `seek_legacy` evaluation: fulfilled when all adult children married
- `seek_autonomy` generation: requires companyPressureTurns ≥ 4

---

## 15. Open Questions

1. **Scheme conflicts**: Should two schemes targeting the same person collide? E.g. one character courting while another undermines the same target. This could produce a rich `sch_rival_schemes_clash` event. Deferred to Phase 4.1 unless straightforward to add.

2. **Faction UI placement**: The new Factions panel + ActivityFeed may crowd `SettlementView`. Consider a dedicated **"Community" tab** alongside Settlement/People/Events tabs. Worth a layout review before implementation starts.

3. **Named relationship dissolution events**: Currently dissolution is silent (activity log only). Should a `friend`→`rival` transition surface as a player-facing event? Probably yes for nemesis formation — a "They have become enemies" narrative moment.

4. **Debug settings persistence**: Confirmed as NOT persisted to localStorage — developers reload with clean state. If the team ever wants sticky debug settings, the off switch is trivially flipped in the serialisation layer.

5. **`opinionSustainedSince` data weight**: This is a new `Partial<Record<string, number>>` on every Person. In a 60-person settlement, worst-case ~3,600 entries across all persons. Each entry is a single number. Negligible memory and serialisation footprint.

---

## 16. Implementation Sequence

Recommended delivery order — each phase is independently testable and releasable:

| Phase | Delivers | Prerequisites |
|-------|---------|--------------|
| G first | Debug infrastructure + Settings overlay | None — no simulation |
| D first | Idle Role-Seeking | `roleAssignedTurn` on Person; store update |
| F first | Activity Log types + emission stubs | GameState field; no UI yet |
| A | Named Relationships | `opinionSustainedSince` on Person; `processNamedRelationships` |
| B | Scheme Engine | Named relationships (befriend scheme needs relationship system) |
| C | Expanded Ambitions | Event definitions (extends relationships.ts) |
| E last | Factions | Named relationships (faction splits use rival detection); all events registered |
| F UI | ActivityFeed component | Activity Log entries flowing from all 4 systems above |

> **Start with G + D + F (data model only).** These touch the fewest files, add the observability scaffold, and make all subsequent work verifiable immediately.

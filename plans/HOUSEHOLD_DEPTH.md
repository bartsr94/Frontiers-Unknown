# Household Depth System — Design Document

**Phase:** 3.5 — "Household Depth" (between Phase 3 and Phase 4)
**Status:** Design approved, ready to implement
**Companion Documents:** `PALUSTERIA_ARCHITECTURE.md`, `PALUSTERIA_GAME_DESIGN.md`, `CLAUDE.md`
**Lore Sources:** *Sauromatian Household Composition*, *Ansberite Household Formation and Structure*

---

## 1. Overview

The founding party is a fusion of two cultures navigating irreconcilable ideas about family. Sauromatian women were raised inside the _ashkaran_ — a multi-wife compound where female bonds sustain the household and a single husband is outnumbered and carefully managed by the wife-council. Imanian traders come from a world where a man's home is his house and secondary wives are a quiet acknowledgment of colonial demographics rather than a cultural institution.

Neither group can fully impose its model. The tension between them is the point. This system gives households a data identity, surfaces that tension through events, and lets player choices gradually shape what kind of settlement this becomes.

**What this adds:**

- Households (_ashkarans_) as tracked objects: named, tradition-typed, with a head, a senior wife, membership roles, and Ashka-Melathi bond tracking
- Concubine and hearth-companion relationships alongside formal marriage
- Thralls as a social status with a lore-authentic freedom pathway
- Keth-Thara duty as a work role for young unmarried men
- Ashka-Melathi bonds forming automatically between co-wives who grow close
- Six new household events including wife-council vs expedition council challenges
- UI additions in PersonDetail, PeopleView, and MarriageDialog

---

## 2. Data Model

### 2.1 New Types (add to `game-state.ts`)

```typescript
/**
 * A person's functional role within their household.
 * Distinct from WorkRole (which governs settlement-level production assignments).
 */
export type HouseholdRole =
  | 'head'              // Nominal patriarch — typically the husband
  | 'senior_wife'       // Eldest or highest-standing wife; leads the wife-council
  | 'wife'              // Full formal wife (blood-wife or formally elevated foreign wife)
  | 'concubine'         // Informal but acknowledged — widow-concubines from Keth-Thara; no spouseIds entry
  | 'hearth_companion'  // Ansberite formalisation between wife and concubine; contractual rights
  | 'child'             // Dependent minor member (under 16)
  | 'thrall';           // Captive; free from birth for their own children; freed if they bear a son

export type HouseholdTradition =
  | 'sauromatian'  // Wife-council authority; husband is spiritual centre but not decision-maker
  | 'imanian'      // Patriarch nominally leads; women manage internally but perform deference
  | 'ansberite';   // Colonial hybrid; hearth-companions permitted; tradition contested

export interface Household {
  id: string;
  name: string;                        // e.g. "House Orsthal" — player-renameable
  tradition: HouseholdTradition;
  headId: string | null;               // The husband / male head (null for widow-led households)
  seniorWifeId: string | null;         // Explicitly designated senior wife (null = derive from age)
  memberIds: string[];                 // All members in declaration order (head first)
  ashkaMelathiBonds: [string, string][]; // Pairs of person IDs with an active bond
  foundedTurn: number;
}
```

### 2.2 Extend `GameState` (in `game-state.ts`)

```typescript
export interface GameState {
  // ... existing fields ...
  households: Map<string, Household>;  // NEW — keyed by household.id
}
```

### 2.3 Extend `Person` (in `person.ts`)

Add three fields to the `Person` interface:

```typescript
export interface Person {
  // ... existing fields ...
  householdId: string | null;                  // null = unattached
  householdRole: HouseholdRole | null;         // null = unattached
  ashkaMelathiPartnerIds: string[];            // IDs of bonded co-wives
}
```

### 2.4 Extend `SocialStatus` (in `person.ts`)

```typescript
export type SocialStatus =
  | 'founding_member'
  | 'settler'
  | 'newcomer'
  | 'elder'
  | 'outcast'
  | 'thrall';          // NEW — acquired, not inherited; freed by bearing a son or by player choice
```

### 2.5 Extend `WorkRole` (in `person.ts`)

```typescript
export type WorkRole =
  | 'farmer'
  | 'trader'
  | 'guard'
  | 'craftsman'
  | 'healer'
  | 'builder'
  | 'away'
  | 'keth_thara'  // NEW — young man fulfilling cultural duty; unavailable for all other events
  | 'unassigned';
```

---

## 3. Serialisation

`households: Map<string, Household>` serialises as `[string, Household][]` — identical pattern to `people` and `tribes`.

In `game-store.ts` save:
```typescript
households: Array.from(state.households.entries()),
```

In `game-store.ts` load:
```typescript
households: new Map(raw.households ?? []),
```

`deserializePerson()` fallbacks for new fields (old saves load cleanly):
```typescript
householdId: raw.householdId ?? null,
householdRole: raw.householdRole ?? null,
ashkaMelathiPartnerIds: raw.ashkaMelathiPartnerIds ?? [],
```

Initial `GameState` in `createInitialState()`:
```typescript
households: new Map(),
```

Founding colonists all start with `householdId: null`. No household is pre-created — they form dynamically when marriages are arranged.

---

## 4. New Module: `src/simulation/population/household.ts`

Pure TypeScript. Zero React. Seeded RNG accepted where needed but never `Math.random()`.

### 4.1 `createHousehold(options, state): Household`

```typescript
interface CreateHouseholdOptions {
  name: string;
  tradition: HouseholdTradition;
  headId: string | null;
  seniorWifeId: string | null;
  foundedTurn: number;
}
```

- Generates `id` using `generateId('household')` from `src/utils/id.ts`
- Returns a new `Household` with empty `memberIds` and `ashkaMelathiBonds`
- Does NOT mutate state — caller adds it to `state.households`

### 4.2 `addToHousehold(household, personId, role): Household`

- Returns updated `Household` with `personId` appended to `memberIds`
- Does NOT mutate `Person` — caller updates `person.householdId` and `person.householdRole`

### 4.3 `removeFromHousehold(household, personId): Household`

- Returns updated `Household` with `personId` removed from `memberIds`
- Also removes any `ashkaMelathiBonds` entries containing that person
- Does NOT update `Person` fields — caller clears `householdId` / `householdRole`

### 4.4 `getSeniorWife(household, state): Person | null`

- If `household.seniorWifeId` is set and the person still lives → return that person
- Otherwise: filter `memberIds` to `householdRole === 'senior_wife' || 'wife'`, sorted descending by `person.age`, return the oldest
- Returns null if no wives exist

### 4.5 `dissolveHousehold(householdId, state): GameState`

- Clears `householdId`, `householdRole`, and `ashkaMelathiPartnerIds` on every current member
- Removes the `Household` from `state.households`
- Returns the updated full `GameState`

### 4.6 `getHouseholdMembers(householdId, state): Person[]`

- Returns live `Person` objects for all `memberIds` in the household
- Silently filters out IDs that no longer exist in `state.people` (defensive)

### 4.7 `getHouseholdByPerson(personId, state): Household | null`

- Returns the `Household` whose `memberIds` includes `personId`, or null if unattached
- O(n) scan across `state.households` — fine at expected settlement sizes (<100 people)

### 4.8 `countWives(household, state): number`

- Returns the number of members with `householdRole === 'wife' || 'senior_wife'`
- Used for capacity checks in `canMarry`

### 4.9 `countConcubines(household, state): number`

- Returns the number of members with `householdRole === 'concubine' || 'hearth_companion'`

---

## 5. Marriage System Changes (`marriage.ts`)

### 5.1 `getMarriageRules()` — updated

```typescript
export interface MarriageRules {
  tradition: 'sauromatian' | 'imanian';
  maxWives: number;
  maxConcubines: number;
  allowsHearthCompanion: boolean;   // NEW
}

// Sauromatian
{ tradition: 'sauromatian', maxWives: 6, maxConcubines: 4, allowsHearthCompanion: false }

// Imanian / default
{ tradition: 'imanian', maxWives: 1, maxConcubines: 2, allowsHearthCompanion: false }

// Ansberite (mixed-heritage men who have reached >30% imanian AND >30% kiswani/hanjoda)
{ tradition: 'ansberite', maxWives: 2, maxConcubines: 2, allowsHearthCompanion: true }
```

> Ansberite tradition is rare in the founding generation. The `getMarriageRules` function detects it when the man's `primaryCulture` starts with a Sauromatian sub-group ID but his `bloodline.imanian >= 0.3`. This models the colonial hybrid documented in the lore.

### 5.2 `canMarry()` — additional checks

After the existing checks, add:

1. **Wife capacity**: if the man already has a household, `countWives(household, state) >= rules.maxWives` → blocked; reason `'household_at_wife_capacity'`
2. **Tradition mismatch warning** (not a block): return a `culturalWarning?: string` field if the two people have incompatible household traditions — surfaced in the UI but not blocking

### 5.3 `performMarriage()` — household auto-formation

After updating `spouseIds` on both persons:

**Determine tradition:**
- If bride's `primaryCulture` is a Sauromatian sub-group → tradition `'sauromatian'`; she leads as `senior_wife`
- If groom's `primaryCulture` is Imanian → tradition `'imanian'`; he leads as `head`
- If both qualify → Sauromatian tradition wins (the lore consistently shows Sauromatian women importing their household model)
- Tie broken later by `hh_tradition_clash` event

**Create or join:**
- If groom already has a `householdId` → add bride to that household with `'wife'` role; update `seniorWifeId` if bride is now the oldest wife
- If bride already has a `householdId` → add groom to that household with `'head'` role
- If neither has a household → create a new `Household` via `createHousehold()`, add both

**Return:** extend `MarriageResult` to include `updatedHousehold: Household | null` and `createdHousehold: boolean`.

### 5.4 New `formConcubineRelationship(manId, womanId, style, state)`

```typescript
export type InformalUnionStyle = 'concubine' | 'hearth_companion';

export interface InformalUnionResult {
  updatedState: GameState;
  householdRole: HouseholdRole;
  createdHousehold: boolean;
}

export function formConcubineRelationship(
  manId: string,
  womanId: string,
  style: InformalUnionStyle,
  state: GameState
): InformalUnionResult
```

- Does NOT touch `spouseIds` on either person
- If man has no household → creates one first with tradition determined by his primary culture, then adds both
- Adds woman to household with `householdRole` = `style === 'hearth_companion' && rules.allowsHearthCompanion ? 'hearth_companion' : 'concubine'`
- Returns updated state

---

## 6. Thrall System

### 6.1 Thrall Acquisition Event — `hh_tribal_thrall_offer`

File: `src/simulation/events/definitions/household.ts` (new file)

```typescript
{
  id: 'hh_tribal_thrall_offer',
  category: 'domestic',
  title: 'A Woman Offered',
  description:
    'The {tribe_contact} gesture toward a young woman standing apart from the group. ' +
    'She carries herself with dignity despite her bonds. They are not asking much for her — ' +
    'a gesture of goodwill between neighbours. What you make of this arrangement is your own affair.',
  prerequisites: [{ type: 'tribe_disposition_min', value: 20 }],
  choices: [
    {
      id: 'accept',
      label: 'Accept her into the settlement',
      description: 'She joins the settlement as a thrall. She is free to find her own way, in time.',
      consequences: [
        {
          type: 'add_person',
          sex: 'female',
          ageRange: [16, 30],
          socialStatus: 'thrall',
          householdRole: null,
          cultureHint: 'sauromatian_mixed',
        },
      ],
    },
    {
      id: 'refuse',
      label: 'Decline respectfully',
      description: 'Not the kind of arrangement you want to encourage.',
      consequences: [{ type: 'modify_tribe_disposition', value: -5 }],
    },
  ],
}
```

> The `add_person` consequence type already exists. It needs a `socialStatus` override parameter added — currently it always creates a `'settler'`. That parameter should be optional and default to `'settler'` to remain backward-compatible.

### 6.2 Thrall-Born-Son Signal in `fertility.ts`

In `processPregnancies`, after the child is created, add:

```typescript
if (mother.socialStatus === 'thrall' && sex === 'male') {
  thrallBornSonIds.push({ thrallId: mother.id, childId: child.id });
}
```

The child's `socialStatus` remains `'settler'` (free from birth — no code change needed; already hardcoded).

Extend `DawnResult`:
```typescript
thrallBornSons: Array<{ thrallId: string; childId: string }>;  // NEW
```

In `turn-processor.ts`, collect these signals and append `hh_thrall_bears_son` event entries into `pendingEvents` using the existing bound event pattern.

### 6.3 Thrall Elevation Event — `hh_thrall_bears_son`

```typescript
{
  id: 'hh_thrall_bears_son',
  category: 'domestic',
  title: '{thrall.first} Has Born a Son',
  description:
    '{thrall} has given birth to a healthy boy — the household\'s most precious gift. ' +
    'By tradition, a thrall who bears a son is no longer a thrall. The question is what she becomes.',
  actorRequirements: [
    { slot: 'thrall', criteria: { sex: 'female', socialStatus: 'thrall' } }
  ],
  choices: [
    {
      id: 'elevate_wife',
      label: 'Welcome {thrall.first} as a wife',
      description: 'She joins the household with full standing. The blood-wives may bristle.',
      consequences: [
        { type: 'set_social_status', target: '{thrall}', value: 'settler' },
        { type: 'set_household_role', target: '{thrall}', value: 'wife' },
        { type: 'add_to_spouses', target: '{thrall}' },  // adds to household head's spouseIds
        { type: 'modify_opinion', observerCriteria: { householdRole: 'wife' }, target: '{thrall}', value: -10 },
      ],
    },
    {
      id: 'elevate_concubine',
      label: 'Free her as a concubine of the household',
      description: 'She is freed but holds no formal wife standing.',
      consequences: [
        { type: 'set_social_status', target: '{thrall}', value: 'settler' },
        { type: 'set_household_role', target: '{thrall}', value: 'concubine' },
      ],
    },
    {
      id: 'free_independently',
      label: 'Free her to make her own way',
      description: 'She leaves the household with her son. Grateful, but unattached.',
      consequences: [
        { type: 'set_social_status', target: '{thrall}', value: 'newcomer' },
        { type: 'set_household_role', target: '{thrall}', value: null },
        { type: 'clear_household', target: '{thrall}' },
      ],
    },
  ],
}
```

> Three new consequence types needed: `set_social_status`, `set_household_role`, `clear_household`. Each is a single-field mutation on one person and is straightforward to implement in `resolver.ts`'s `applyConsequence`.

---

## 7. Keth-Thara System

### 7.1 `'keth_thara'` Role Blocking in `actor-resolver.ts`

`matchesCriteria` already blocks `away` persons. Add `keth_thara` to the same check:

```typescript
// In matchesCriteria, early return false for unavailable roles:
if (person.role === 'away' || person.role === 'keth_thara') return false;
```

This excludes men on Keth-Thara duty from all event actor slots, construction, and council advice.

### 7.2 `assignKethThara(personId)` Store Action in `game-store.ts`

Eligibility:
- `person.sex === 'male'`
- `person.age >= 16 && person.age < 30`
- `person.spouseIds.length === 0`
- `person.role !== 'away' && person.role !== 'keth_thara' && person.role !== 'builder'`

On assign:
1. Set `person.role = 'keth_thara'`
2. Record prior role for restoration: stored in `DeferredEventEntry.context.prevRole`
3. Queue deferred event `hh_keth_thara_service_ends` at `turnNumber + rng.nextInt(4, 6)` with `missionActorSlot: 'servant'`
4. Queue mid-service event `hh_keth_thara_widow_bond` at `turnNumber + 2` with same bound actor

### 7.3 Mid-Service Event — `hh_keth_thara_widow_bond`

```typescript
{
  id: 'hh_keth_thara_widow_bond',
  category: 'domestic',
  title: 'A Widow\'s Comfort',
  description:
    '{servant.first} has been making the rounds among the settlement\'s widows as tradition demands. ' +
    'One in particular — a woman of some years and considerable warmth — seems to have taken a special interest in his company.',
  actorRequirements: [
    { slot: 'servant', criteria: { sex: 'male', role: 'keth_thara' } }
  ],
  choices: [
    {
      id: 'encourage',
      label: 'Encourage the connection',
      description: 'Let the bond deepen. This is exactly what Keth-Thara is for.',
      consequences: [
        { type: 'modify_opinion', observer: '{servant}', target: 'oldest_widow', value: 25 },
        { type: 'modify_opinion', observer: 'oldest_widow', target: '{servant}', value: 25 },
      ],
    },
    {
      id: 'let_be',
      label: 'Let it develop naturally',
      description: 'No need to intervene.',
      consequences: [
        { type: 'modify_opinion', observer: '{servant}', target: 'oldest_widow', value: 10 },
        { type: 'modify_opinion', observer: 'oldest_widow', target: '{servant}', value: 10 },
      ],
    },
  ],
}
```

> `'oldest_widow'` is a special target resolver token meaning "the oldest unmarried woman in the settlement who is not already in the same household as the actor". Implement in `resolveConsequenceTarget()` in `resolver.ts`.

### 7.4 Deferred Event — `hh_keth_thara_service_ends`

```typescript
{
  id: 'hh_keth_thara_service_ends',
  category: 'domestic',
  title: '{servant.First}\'s Keth-Thara Ends',
  description:
    '{servant.First} has honoured the old custom. He has comforted those who needed comfort ' +
    'and learned what can only be taught by a woman who has already lived. One woman in particular ' +
    'has grown fond of him — fond enough to consider following him home.',
  actorRequirements: [
    { slot: 'servant', criteria: { sex: 'male', role: 'keth_thara' } }
  ],
  choices: [
    {
      id: 'widow_follows',
      label: 'Invite her to join the household as a concubine',
      description: 'She comes willingly. {servant.First}\'s household gains a widow-concubine, as is proper.',
      consequences: [
        { type: 'restore_role', target: '{servant}' },
        {
          type: 'form_concubine_relationship',   // new consequence type
          manSlot: 'servant',
          style: 'concubine',
          womanTarget: 'oldest_widow',
        },
      ],
    },
    {
      id: 'farewell',
      label: 'A warm farewell',
      description: 'The duty is complete. He returns to his regular work.',
      consequences: [
        { type: 'restore_role', target: '{servant}' },
      ],
    },
  ],
}
```

The `restore_role` consequence type already exists (used by `dip_upriver_camp_spotted`). The `form_concubine_relationship` consequence type is new — it wraps `formConcubineRelationship()` from `marriage.ts`.

---

## 8. Ashka-Melathi Bond System

### 8.1 Auto-Bond Detection in `processDawn` — Step 8.75

After the existing Step 8 (cultural drift), before Step 9 (religion distribution), add:

```
For each household in state.households:
  Get all female members with householdRole 'wife' or 'senior_wife'
  For each pair (A, B) in that group:
    If both A and B have mutual opinion ≥ 70 (A.relationships.get(B.id) and B.relationships.get(A.id))
    AND neither already has the other in ashkaMelathiPartnerIds:
      Add bond to household.ashkaMelathiBonds
      Add B.id to A.ashkaMelathiPartnerIds, A.id to B.ashkaMelathiPartnerIds
      Push signal to DawnResult: { type: 'bond_formed', personAId, personBId }

  For each existing bond in household.ashkaMelathiBonds:
    Enforce opinion floor: if A.relationships.get(B.id) < 70, set it to 70 (bond prevents the relationship dropping below threshold)
```

Extend `DawnResult`:
```typescript
newAshkaMelathiBonds: Array<{ personAId: string; personBId: string }>;
```

### 8.2 Bond-Deepening Event — `hh_ashka_melathi_deepens`

```typescript
{
  id: 'hh_ashka_melathi_deepens',
  category: 'domestic',
  title: 'An Ashka-Melathi Bond Deepens',
  description:
    'The bond between {wife_a.first} and {wife_b.first} has grown into something that the entire household ' +
    'feels, if not names. They argue less. They plan together. They protect each other with the kind of ' +
    'instinct that takes years to build.',
  actorRequirements: [
    { slot: 'wife_a', criteria: { sex: 'female', householdRole: 'wife' } },
    {
      slot: 'wife_b',
      criteria: { sex: 'female', householdRole: 'wife', sameHouseholdAs: 'wife_a', inAshkaMelathiWith: 'wife_a' }
    }
  ],
  choices: [
    {
      id: 'acknowledge',
      label: 'Acknowledge the bond publicly',
      consequences: [
        { type: 'modify_opinion', observer: '{wife_a}', target: '{wife_b}', value: 10 },
        { type: 'modify_opinion', observer: '{wife_b}', target: '{wife_a}', value: 10 },
        { type: 'modify_opinion', observer: 'all_sauromatian_women', target: '{wife_a}', value: 5 },
      ],
    },
    {
      id: 'quiet',
      label: 'Let it remain a private matter',
      consequences: [],
    },
  ],
}
```

### 8.3 Rivalry Event — `hh_ashka_melathi_rivalry`

Fires when a new wife or concubine is added to a household that already has an established Ashka-Melathi bond. Triggered by `performMarriage` / `formConcubineRelationship` — push the event ID to `pendingEvents` when a household already has `ashkaMelathiBonds.length > 0` before the new addition.

```typescript
{
  id: 'hh_ashka_melathi_rivalry',
  category: 'domestic',
  title: 'A Bond Threatened',
  description:
    '{senior_wife.first} and {co_wife.first} have held this household together through hard seasons. ' +
    'Now {new_wife.first} has arrived, and the balance has shifted. Neither {senior_wife.first} nor ' +
    '{co_wife.first} are saying much — but the silences in the evening are doing the talking.',
  actorRequirements: [
    { slot: 'senior_wife', criteria: { sex: 'female', householdRole: 'senior_wife' } },
    { slot: 'co_wife', criteria: { sex: 'female', householdRole: 'wife', sameHouseholdAs: 'senior_wife', inAshkaMelathiWith: 'senior_wife' } },
    { slot: 'new_wife', criteria: { sex: 'female', householdRole: 'wife', sameHouseholdAs: 'senior_wife', notInAshkaMelathiWith: 'senior_wife' } },
  ],
  choices: [
    {
      id: 'mediate',
      label: 'Arrange a formal welcome ceremony',
      description: 'Acknowledge {new_wife.first}\'s standing openly. The old bond survives; a new triangle may form.',
      consequences: [
        { type: 'modify_opinion', observer: '{senior_wife}', target: '{new_wife}', value: 15 },
        { type: 'modify_opinion', observer: '{co_wife}', target: '{new_wife}', value: 15 },
        { type: 'modify_opinion', observer: '{new_wife}', target: '{senior_wife}', value: 15 },
      ],
    },
    {
      id: 'let_fester',
      label: 'Leave them to sort it out',
      consequences: [
        { type: 'modify_opinion', observer: '{senior_wife}', target: '{new_wife}', value: -15 },
        { type: 'modify_opinion', observer: '{co_wife}', target: '{new_wife}', value: -10 },
      ],
    },
  ],
}
```

> Two new actor criteria needed: `sameHouseholdAs: string` (person must share a householdId with the named slot) and `inAshkaMelathiWith: string` / `notInAshkaMelathiWith: string` (person must or must not have the named slot's actor in their `ashkaMelathiPartnerIds`). Implement in `matchesCriteria()` in `actor-resolver.ts`.

---

## 9. Wife-Council Tension Events

### 9.1 `getSeniorWife()` Helper

```typescript
// In household.ts
export function getSeniorWife(household: Household, state: GameState): Person | null
```

- If `household.seniorWifeId` is set → return that person if still alive
- Else: filter members to `householdRole === 'senior_wife'`; if found, return first
- Else: filter to `householdRole === 'wife'`, sort descending by `age`, return oldest
- Returns null if household has no wives

### 9.2 Wife-Council Challenge Event — `hh_wife_council_demands`

Eligibility prerequisite: any household in the settlement has ≥ 3 wives (`countWives >= 3`). Implement as a `custom` prerequisite type in `event-filter.ts`.

```typescript
{
  id: 'hh_wife_council_demands',
  category: 'domestic',
  title: 'The Wife-Council Speaks',
  description:
    '{senior_wife.first} has called a meeting of the household\'s wives. The matter is simple: ' +
    'the expedition council made a decision that affects them. They were not consulted. ' +
    'They are consulting now.',
  actorRequirements: [
    { slot: 'senior_wife', criteria: { sex: 'female', householdRole: 'senior_wife' } }
  ],
  prerequisites: [{ type: 'household_has_min_wives', value: 3 }],
  choices: [
    {
      id: 'yield',
      label: 'Bring the matter back to the wife-council for input',
      description: 'Acknowledge their authority in household affairs. Sauromatian women will remember this.',
      consequences: [
        { type: 'modify_opinion', observerCriteria: { sex: 'female', primaryCulture: 'sauromatian_*' }, target: 'settlement', value: 15 },
      ],
    },
    {
      id: 'resist',
      label: 'Affirm the expedition council\'s authority',
      description: 'The expedition council speaks for the settlement. Imanian traditionalists will approve.',
      consequences: [
        { type: 'modify_opinion', observerCriteria: { sex: 'female', primaryCulture: 'sauromatian_*' }, target: 'settlement', value: -10 },
        { type: 'modify_opinion', observerCriteria: { hasTrait: 'traditional', primaryCulture: 'imanian_*' }, target: 'settlement', value: 10 },
      ],
    },
  ],
}
```

### 9.3 Foreign Wife Integration Event — `hh_foreign_wife_integration`

Fires automatically when `performMarriage` adds a non-Sauromatian woman to a Sauromatian household (or vice versa), and `ashkaMelathiBonds.length > 0`.

```typescript
{
  id: 'hh_foreign_wife_integration',
  category: 'domestic',
  title: 'An Outsider Among Sisters',
  description:
    '{new_wife.first} has married into the household but the blood-wives have elected to make this difficult. ' +
    '{senior_wife.first} is not hostile — she is simply not welcoming either. ' +
    'The threshold between those two positions is where the work needs to happen.',
  actorRequirements: [
    { slot: 'new_wife', criteria: { sex: 'female', householdRole: 'wife', minAge: 14, maxAge: 35 } },
    { slot: 'senior_wife', criteria: { sex: 'female', householdRole: 'senior_wife', sameHouseholdAs: 'new_wife' } },
  ],
  choices: [
    {
      id: 'ceremony',
      label: 'Arrange a formal welcoming rite',
      description: 'Both traditions have one. Use elements of each.',
      consequences: [
        { type: 'modify_opinion', observer: '{senior_wife}', target: '{new_wife}', value: 20 },
        { type: 'modify_opinion', observer: '{new_wife}', target: '{senior_wife}', value: 20 },
        { type: 'modify_culture_blend', direction: 'both', value: 0.02 },
      ],
    },
    {
      id: 'equal_standing',
      label: 'Insist {new_wife.first} is treated as any other wife',
      consequences: [
        { type: 'modify_opinion', observer: '{senior_wife}', target: '{new_wife}', value: 5 },
        { type: 'modify_opinion', observer: '{new_wife}', target: '{senior_wife}', value: 10 },
      ],
    },
    {
      id: 'downgrade',
      label: 'Let {new_wife.first} earn her standing',
      description: 'She enters as a concubine until the wives accept her.',
      consequences: [
        { type: 'set_household_role', target: '{new_wife}', value: 'concubine' },
        { type: 'modify_opinion', observer: '{new_wife}', target: '{senior_wife}', value: -15 },
      ],
    },
  ],
}
```

### 9.4 Tradition Clash Event — `hh_tradition_clash`

Fires when a new `'sauromatian'` or `'imanian'` household has been established for ≥ 4 turns and the head and senior wife have different cultural dominant identities. Can fire once per household.

```typescript
{
  id: 'hh_tradition_clash',
  category: 'domestic',
  title: 'Whose House is This?',
  description:
    '{husband} and {senior_wife.first} have been polite about it for four seasons. ' +
    'The question has finally had to be asked out loud: who leads this household? ' +
    'By Imanian custom, {husband.first} does. By Sauromatian right, {senior_wife.first} and her sisters do.',
  actorRequirements: [
    { slot: 'husband', criteria: { sex: 'male', householdRole: 'head' } },
    { slot: 'senior_wife', criteria: { sex: 'female', householdRole: 'senior_wife', sameHouseholdAs: 'husband' } },
  ],
  choices: [
    {
      id: 'husband_yields',
      label: '{husband.first} steps back from daily authority',
      description: 'He remains the spiritual head. The wife-council runs the household. This is closer to the Sauromatian model.',
      consequences: [
        { type: 'set_household_tradition', target: '{husband}', value: 'sauromatian' },
        { type: 'modify_opinion', observerCriteria: { sex: 'female', primaryCulture: 'sauromatian_*' }, target: '{husband}', value: 10 },
      ],
    },
    {
      id: 'seniorfwife_defers',
      label: '{senior_wife.first} accepts {husband.first}\'s formal authority',
      description: 'She runs the household in practice; he speaks for it publicly. The Ansberite compromise.',
      consequences: [
        { type: 'set_household_tradition', target: '{husband}', value: 'ansberite' },
        { type: 'modify_opinion', observer: '{senior_wife}', target: '{husband}', value: -5 },
        { type: 'modify_opinion', observer: '{husband}', target: '{senior_wife}', value: 10 },
      ],
    },
    {
      id: 'no_resolution',
      label: 'Defer the question',
      description: 'The tension stays unresolved. This will come up again.',
      consequences: [
        { type: 'modify_opinion', observer: '{senior_wife}', target: '{husband}', value: -10 },
        { type: 'modify_opinion', observer: '{husband}', target: '{senior_wife}', value: -5 },
      ],
    },
  ],
}
```

New consequence type: `set_household_tradition` — sets `household.tradition` for the household that contains `target`.

---

## 10. New Criteria Fields for `ActorCriteria`

Add to `ActorCriteria` in `engine.ts`:

```typescript
export interface ActorCriteria {
  // ... existing fields ...
  householdRole?: HouseholdRole;             // person must hold this role in their household
  sameHouseholdAs?: string;                  // person must share a householdId with the named slot (resolved at match time)
  inAshkaMelathiWith?: string;               // person must have the named slot's actor in ashkaMelathiPartnerIds
  notInAshkaMelathiWith?: string;            // inverse of the above
  socialStatus?: SocialStatus;               // NEW — was not previously in ActorCriteria
}
```

`sameHouseholdAs`, `inAshkaMelathiWith`, and `notInAshkaMelathiWith` are relational checks — they reference another slot's resolved actor. `matchesCriteria` in `actor-resolver.ts` therefore needs the `boundActors` map passed in as a parameter. Update `matchesCriteria`, `canFillSlot`, `selectActor`, and `resolveActors` signatures accordingly:

```typescript
function matchesCriteria(
  person: Person,
  criteria: ActorCriteria,
  state: GameState,
  boundActors?: Record<string, string>   // NEW — needed for relational criteria
): boolean
```

---

## 11. New Consequence Types (add to `resolver.ts`)

| Type | Fields | Effect |
|---|---|---|
| `set_social_status` | `target`, `value: SocialStatus` | Mutates `person.socialStatus` |
| `set_household_role` | `target`, `value: HouseholdRole \| null` | Mutates `person.householdRole`; if null also clears `householdId` |
| `clear_household` | `target` | Calls `removeFromHousehold` and clears all household fields on person |
| `set_household_tradition` | `target`, `value: HouseholdTradition` | Sets `household.tradition` for the person's household |
| `form_concubine_relationship` | `manSlot`, `style: InformalUnionStyle`, `womanTarget` | Calls `formConcubineRelationship` from `marriage.ts` |
| `restore_role` | `target` | Restores `person.role` from `context.prevRole` (existing pattern from away missions) |

---

## 12. New Prerequisite Types (add to `event-filter.ts`)

| Type | Logic |
|---|---|
| `household_has_min_wives` | Any household in `state.households` has `countWives >= value` |
| `has_any_household` | `state.households.size > 0` |
| `has_any_thrall` | Any person in `state.people` has `socialStatus === 'thrall'` |

---

## 13. `ROLE_LABELS` and `ROLE_COLORS` Updates

In whichever file these are defined (currently used in `PersonDetail.tsx` and `CouncilFooter.tsx`):

```typescript
keth_thara: { label: 'Keth-Thara', color: 'violet' }
```

`'keth_thara'` is displayed in the same role badge used for `'away'` and `'builder'`.

---

## 14. UI Changes

### 14.1 `PersonDetail.tsx` — Household Section

Add a **Household** section between Skills and Languages. Render only when `person.householdId` is non-null.

Contents:
- Household name (`household.name`) — styled heading
- `HouseholdRole` badge (colour-coded, analogous to `WorkRole` badges)
- Tradition badge (`sauromatian` / `imanian` / `ansberite`) — small secondary label
- Compact member list: for each member in `household.memberIds` (excluding self), show `CouncilPortrait` (40×50, existing component) + first name + `HouseholdRole` badge
- Ashka-Melathi partners: if `person.ashkaMelathiPartnerIds.length > 0`, show a sub-row "Ashka-Melathi bond with: {names}"

Eligible unmarried men (age 16–29, no spouse, role not `away`/`builder`/`keth_thara`) show a **"Send on Keth-Thara Duty"** button at the bottom of the Role section, calling `assignKethThara(person.id)` from the store.

### 14.2 `PeopleView.tsx` — Household Grouping

Add `'household'` to the sort options dropdown alongside the existing `sex`, `status`, `heritage group`, `base skill` options.

When `'household'` is selected:
- Rows group under household name headers (styled like section dividers)
- Persons with `householdId: null` appear under an "Unattached" header at the bottom
- Within each group, rows are sorted by `householdRole` (head → senior_wife → wife → concubine → hearth_companion → child → thrall) then by age descending

### 14.3 `MarriageDialog.tsx` — Informal Union Tab

Add a second tab alongside the existing "Formal Marriage" tab: **"Informal Union"**.

Informal Union tab:
- Left column: select the man (eligible: male, has or can form a household)
- Right column: select the woman (eligible: female, `spouseIds.length === 0`)
- Style selector: "Concubine" (always available if cultural rules permit) or "Hearth-Companion" (only if man's rules have `allowsHearthCompanion: true`)
- Show a cultural note explaining the distinction in lore terms
- Compatibility panel: same language-compatibility indicator as formal marriage
- Confirm button calls `formConcubineRelationship(manId, womanId, style)` via a new store action `arrangeInformalUnion`

---

## 15. Store Actions Summary

New actions needed in `game-store.ts`:

| Action | Parameters | Description |
|---|---|---|
| `assignKethThara` | `personId: string` | Sets role; queues deferred events |
| `arrangeInformalUnion` | `manId, womanId, style: InformalUnionStyle` | Calls `formConcubineRelationship`; updates state |
| `renameHousehold` | `householdId, name: string` | Simple name mutation |
| `designateSeniorWife` | `householdId, personId: string` | Sets `household.seniorWifeId` |

---

## 16. Implementation Order

Implement in this order because each phase depends on the prior:

| Phase | Steps | What unlocks |
|---|---|---|
| **3.5a** — Core Data | §2, §3 | All other phases |
| **3.5b** — `household.ts` Module | §4 | Marriage auto-formation, Ashka-Melathi |
| **3.5c** — Marriage Updates | §5 | Auto-household formation; all household events |
| **3.5d** — Thrall System | §6 | Thrall events |
| **3.5e** — Keth-Thara | §7 | Keth-Thara events |
| **3.5f** — Ashka-Melathi | §8 | Bond events |
| **3.5g** — Wife-Council Events | §9, §10, §11, §12 | Event tension gameplay |
| **3.5h** — UI | §13, §14, §15 | Player visibility |
| **3.5i** — Tests | §17 | Validation |

After each phase: `npx tsc --noEmit` must pass with zero errors before proceeding.

---

## 17. Tests

### 17.1 New: `tests/population/household.test.ts`

- `createHousehold` returns correct id, tradition, empty members
- `addToHousehold` appends member; immutable (returns new object)
- `removeFromHousehold` removes member and clears their `ashkaMelathiBonds` entries
- `getSeniorWife` — scenario: `seniorWifeId` set → returns that person
- `getSeniorWife` — scenario: `seniorWifeId` null, two wives → returns oldest
- `getSeniorWife` — scenario: no wives → returns null
- `dissolveHousehold` clears `householdId` / `householdRole` on all members
- `dissolveHousehold` removes household from `state.households`
- `getHouseholdByPerson` — member found
- `getHouseholdByPerson` — non-member returns null
- `countWives` — counts only `'wife'` and `'senior_wife'`
- `countConcubines` — counts only `'concubine'` and `'hearth_companion'`

### 17.2 Update: `tests/population/marriage.test.ts`

- `performMarriage` with Sauromatian bride → `'sauromatian'` household created; bride is `senior_wife`, groom is `head`
- `performMarriage` with Imanian groom → `'imanian'` household created; groom is `head`, bride is `wife`
- `performMarriage` when groom already has a household → bride joins existing household
- `canMarry` with household at 6 wives → blocked; reason `'household_at_wife_capacity'`
- `formConcubineRelationship` — woman added as `'concubine'`; `spouseIds` unchanged
- `formConcubineRelationship` with `allowsHearthCompanion: true` and `style: 'hearth_companion'` → woman is `'hearth_companion'`

### 17.3 Update: `tests/events/actor-resolver.test.ts`

- `matchesCriteria` returns false for `role: 'keth_thara'` (same pattern as `away`)
- `matchesCriteria` `householdRole` criterion — matches correctly
- `matchesCriteria` `sameHouseholdAs` criterion — matches when in same household; does not match when in different household; requires `boundActors` to be passed
- `matchesCriteria` `socialStatus: 'thrall'` — matches thrall; does not match settler

### 17.4 Update: `tests/events/resolver.test.ts`

- `hh_thrall_bears_son` choice `elevate_wife` → person `socialStatus` becomes `'settler'`, `householdRole` becomes `'wife'`, added to `spouseIds`
- `hh_thrall_bears_son` choice `elevate_concubine` → `socialStatus: 'settler'`, `householdRole: 'concubine'`
- `hh_thrall_bears_son` choice `free_independently` → `socialStatus: 'newcomer'`, `householdId: null`
- `hh_keth_thara_service_ends` choice `widow_follows` → `formConcubineRelationship` called; servant's role restored
- `hh_keth_thara_service_ends` choice `farewell` → servant's role restored; no concubine formed
- `set_household_tradition` consequence → `household.tradition` updated in state

### 17.5 Regression

All 527 existing tests must remain green after Phase 3.5a (data additions only).

---

## 18. Deferred / Out of Scope

The following are acknowledged but explicitly deferred to Phase 4:

- **Dedicated Households panel** (full compound view UI) — PersonDetail + PeopleView grouping is sufficient for Phase 3.5
- **Household tradition drift over time** — tradition is fixed at formation; only `hh_tradition_clash` can change it (player-driven, not automatic); automatic drift would require a scoring function akin to `processCulturalDrift` and is Phase 4 work
- **Household economics** — shared resource pools, compound-level production bonuses — interesting but architecturally significant; deferred
- **Multiple households merging** — when a man with a household takes a second wife from another household; the simpler rule is that the second wife joins his household
- **Household dissolution events** — death of the head, mass departure, irreconcilable rifts; the `dissolveHousehold` utility is ready for these but no event chains are defined yet

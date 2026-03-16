# Household Lifecycle — Design Document

**Status:** Draft · March 2026  
**Depends on:** Phase 3.5 (Household Depth — complete)  
**Affects:** `household.ts`, `marriage.ts`, `turn-processor.ts`, `game-store.ts`, `game-state.ts`, `serialization.ts`, `fertility.ts`

---

## 1. Motivation

Currently households are *marriage artefacts* — they only exist when two people have been formally paired. This leaves every founding settler, every unmarried man or woman, every child, and every new arrival floating as a social atom with `householdId: null`. That breaks the lore premise ("the _ashkaran_ is the fundamental social unit") and creates gaps:

- Children are born with no household membership, so kinship-gated events can't reference them
- Death cleanup is incomplete — dead heads leave stale `memberIds` in their household
- Buildings with `ownerHouseholdId` can only ever be owned by married households
- Single-person household names are computed ad-hoc in the UI instead of being authoritative

The fix: **every living person belongs to a household at all times**.

---

## 2. Core Principle

> A person is born into a household, stays there until marriage or the household dissolves, and always ends up in one — whether a single-person unit or a multigenerational family.

| Life event | Household outcome |
|---|---|
| Game start (founding settlers) | Each person gets their own household |
| New settler joins settlement | Gets their own new household |
| Child born to married parents | Added to father's household (`child` role) |
| Child born to unmarried mother | Added to mother's household (`child` role) |
| Thrall acquired | Added to owner's household (`thrall` role) |
| Child grows up (turns 16) | Stays in household — no automatic split |
| Person marries | Two households merge (direction is tradition-dependent) |
| Household head dies | Succession logic runs; adult sons may split |
| Person is last member | Household auto-dissolves |

---

## 3. Household Formation

### 3.1 Game start

`createInitialState()` calls a new `initializeHouseholds(people, turnNumber)` function after building the `people` Map. Every person with `householdId === null` gets a fresh single-person household with `isAutoNamed: true`.

### 3.2 New settlers arriving mid-game

The event consequence `add_person` and the store's `arrangeInformalUnion` already create persons. After creating a person, the caller must call `ensurePersonHousehold(person, state)` to guarantee membership. `ensurePersonHousehold` is a no-op if `householdId` is already set.

### 3.3 Birth

`processDemographicPhase` in `turn-processor.ts` currently creates named children but does not assign them to a household. After naming the child, the processor calls `assignChildToHousehold(child, mother, father | undefined, households)` which:

1. If `father` is alive and has a `householdId` → child joins father's household (`child` role)
2. Else if `mother` has a `householdId` → child joins mother's household (`child` role)
3. Else → child gets their own household (edge case; only if mother is also unattached, which should be impossible once stable)

The child's `householdId` and `householdRole` are set on the `Person` object before it is inserted into `updatedPeople`.

---

## 4. Household Merging (Marriage)

`performMarriage()` currently creates a household from scratch if the man has none. Under the new system **both parties already have a household**. The function merges them:

### 4.1 Imanian / Ansberite tradition
- The man is the receiving head. Woman's entire household merges into his.
- All members of the woman's household have their `householdId` updated to the man's household.
- The woman's former household is added to a `toDissolve` list — dissolved at the end of the operation.
- The woman's role is set to `senior_wife` (if she is the first wife) or `wife`.

### 4.2 Sauromatian tradition
- The wife-council leads; the man joins the woman's household.
- All members of the man's household merge into the woman's.
- The man's former household is dissolved.
- The man's role is set to `head`.
- The woman's role becomes `senior_wife` if not already designated.

### 4.3 Subsequent wives
When a man who already has a household takes a second or later wife under Sauromatian/Ansberite rules, the bride's household members merge in exactly as above — her household dissolves afterward.

### 4.4 Auto-name refresh
If the surviving household has `isAutoNamed: true`, the name is recalculated after the merge (see §7).

---

## 5. Succession (Head Death)

When a person who is `householdRole === 'head'` appears in `newGraveyardEntries`, the turn processor runs `processHouseholdSuccession(householdId, deceasedId, state, rng)`.

### 5.1 Succession order

**Step 1 — Identify adult sons**  
Adult sons = living members of the household whose `parentIds` includes the deceased head AND `sex === 'male'` AND `age >= 16`.

**Step 2 — Eldest son takes over**  
Sort adult sons by age descending. The oldest becomes the new `head`. He stays in the household with all current non-splitting members:
- His mother(s) (wives, senior wife)
- His younger siblings still under 16 (all `child` role)
- Thralls
- Adult daughters who are not yet married (stay unless they choose to leave — left for event system)

**Step 3 — Other adult sons split off**  
Each additional adult son leaves to form their own new household, taking his wife and children with him (if he is already married — his family is already in a sub-unit that separates logically).

**Step 4 — No adult sons**  
- `sauromatian`: Senior wife becomes the new `head`. No split. Passes to her eldest surviving son when he comes of age or chooses to take the role (track via a `pendingSuccessorId` field — see §8).
- `imanian`/`ansberite`: Eldest adult member (any sex) becomes head. If only wives/daughters remain, the senior wife becomes head.

### 5.2 Tradition table

| Tradition | Primary heir | Other adult sons | No adult sons |
|---|---|---|---|
| `sauromatian` | — (wife-council governs) | May stay or split; no forced split | Senior wife heads; sons who come of age later may split |
| `imanian` | Eldest son becomes head | Split off immediately | Senior wife heads temporarily |
| `ansberite` | Eldest son becomes head | Split off immediately | Senior wife heads temporarily |

For `sauromatian` tradition, "other adult sons may stay" means we do NOT force a split — but we still add a succession event to the pending queue so the player can decide. This keeps determinism while giving player agency on the edge case.

### 5.3 Property division on split

Property belongs to `Household`, not `Person`. When a son splits:

1. `dwellingBuildingId` — stays with the eldest son's (continuing) household.
2. `productionBuildingIds` — divided:
   - Sort the splitting group: eldest son's household first.
   - Eldest keeps `⌈total × 2/3⌉` production buildings (the "lion's share").
   - Remaining buildings are distributed one-per-splitting-son round-robin.
   - If fewer buildings than splitting sons exist, only the eldest gets any — others start empty.
3. `ashkaMelathiBonds` — bonds between members who stay together are preserved; bonds to departed members are removed.

### 5.4 Naming after split

New split-off households inherit `isAutoNamed: true` and receive names based on the new head (see §7). The continuing household keeps its existing name.

---

## 6. Dissolution Triggers

A household is **auto-dissolved** when:

1. `memberIds` becomes empty after a membership change (all members dead or departed).
2. During marriage merge: the source household loses all its members to the destination.
3. No living person in `state.people` matches any `memberIds` entry (cleanup pass, run once per dawn as a guard).

`dissolveHousehold()` already exists and handles member cleanup. The new code calls it in all three cases.

---

## 7. Naming Conventions

### 7.1 Auto-named households (`isAutoNamed: true`)

| Situation | Name |
|---|---|
| Single person | `"Household of {firstName}"` |
| Married Imanian/Ansberite man as head | `"House of {man.familyName ?? man.firstName}"` |
| Married Sauromatian woman as senior wife | `"{woman.familyName ?? woman.firstName} Ashkaran"` |
| Widow-headed (any tradition) | `"Household of {women.firstName}"` |

The name is **recomputed** every time:
- The head is replaced
- A marriage merge changes the effective head
- `isAutoNamed` transitions from `false` to `true` (reset by player choice — out of scope for this phase)

### 7.2 Player-renamed households (`isAutoNamed: false`)

Name is never touched by the system. Player can set this via the FamilyTree/Household UI tab (already has a rename affordance).

---

## 8. Data Model Changes

### 8.1 `Household` (in `game-state.ts`)

Add one field:

```typescript
/** If true, the name is derived from the head/seniorWife and updated automatically. */
isAutoNamed: boolean;
```

All existing households loaded from saves default to `isAutoNamed: false` (old saves keep their names intact). New households created by the system use `isAutoNamed: true`.

### 8.2 `CreateHouseholdOptions` (in `household.ts`)

Add `isAutoNamed: boolean` — defaults to `true` for all system-created households.

### 8.3 `ActivityLogType` (in `game-state.ts`)

Extend the union with three new values:

```typescript
| 'household_formed'      // New household created (split-off or solo)
| 'household_succession'  // Head changed after death
| 'household_dissolved'   // Empty household removed
```

### 8.4 No changes to `Person`

`householdId` and `householdRole` already exist. `child` and `thrall` roles already exist in `HouseholdRole`. No new fields needed on `Person`.

---

## 9. New Functions in `household.ts`

```typescript
/**
 * Ensures a person has a household. Creates a new single-person household
 * if they don't have one. No-op if householdId is already set.
 * Returns { updatedPerson, newHousehold | null }.
 */
function ensurePersonHousehold(
  person: Person,
  state: GameState,
  turnNumber: number,
): { updatedPerson: Person; newHousehold: Household | null }

/**
 * Bulk-initializes households for all persons with householdId === null.
 * Used at game start and for old-save migration.
 * Returns { updatedPeople, newHouseholds }.
 */
function initializeHouseholds(
  people: Map<string, Person>,
  turnNumber: number,
): { updatedPeople: Map<string, Person>; newHouseholds: Map<string, Household> }

/**
 * Assigns a newborn child to the appropriate household.
 * Mutates updatedPeople and updatedHouseholds in-place.
 */
function assignChildToHousehold(
  child: Person,
  mother: Person,
  father: Person | undefined,
  updatedPeople: Map<string, Person>,
  updatedHouseholds: Map<string, Household>,
): void

/**
 * Merges the source household into the destination. All members of the source
 * have their householdId updated to destId. Source household is dissolved.
 * Returns updated { people, households } maps (immutable style).
 */
function mergeHouseholds(
  destId: string,
  sourceId: string,
  state: GameState,
): { updatedPeople: Map<string, Person>; updatedHouseholds: Map<string, Household> }

/**
 * Runs succession logic when a household head dies.
 * Returns deltas: new households created (split-offs), updated existing households,
 * updated person roles, and activity log entries.
 */
function processHouseholdSuccession(
  householdId: string,
  deceasedHeadId: string,
  state: GameState,
  rng: SeededRNG,
): HouseholdSuccessionResult

interface HouseholdSuccessionResult {
  updatedHouseholds: Map<string, Household>;
  newHouseholds: Map<string, Household>;
  dissolvedHouseholdIds: string[];
  updatedPeople: Map<string, Person>;
  logEntries: ActivityLogEntry[];
}

/**
 * Re-derives the display name for a household based on its current head/seniorWife.
 * Only applies when isAutoNamed === true.
 */
function deriveHouseholdName(
  household: Household,
  people: Map<string, Person>,
): string

/**
 * Cleanup pass: dissolves any household whose memberIds are all dead (not in people).
 * Run once per dawn as a safety net. Returns dissolved IDs and updated people map.
 */
function pruneOrphanedHouseholds(
  households: Map<string, Household>,
  people: Map<string, Person>,
): { dissolvedIds: string[]; updatedPeople: Map<string, Person> }
```

---

## 10. Changes to Existing Functions

### 10.1 `performMarriage()` in `marriage.ts`

Replace the current household-creation block with a call to `mergeHouseholds()`:
- Determine which household is "receiving" based on tradition
- Call `mergeHouseholds(receivingId, sourceId, state)` 
- Assign roles to the joining spouse
- Refresh the surviving household's name if `isAutoNamed`

`MarriageResult` gains `dissolvedHouseholdId: string | null` so the store knows which household to delete.

### 10.2 `processDemographicPhase()` in `turn-processor.ts`

After creating a named child and adding to `updatedPeople`, call `assignChildToHousehold(child, mother, father, updatedPeople, updatedHouseholds)`. The `updatedHouseholds` map (currently only used for Ashka-Melathi bonds) now also carries birth-driven membership changes back to the caller.

### 10.3 `processDawn()` in `turn-processor.ts`

After the demographic phase, a new step runs **household succession**:

```
for each entry in newGraveyardEntries:
  if entry.id was a household head:
    result = processHouseholdSuccession(householdId, entry.id, stateSnapshot, rng)
    merge result into updatedPeople, updatedHouseholds, newHouseholds, activityLog
```

After all succession is resolved:
- Run `pruneOrphanedHouseholds()` as a cleanup guard.
- Append all new and dissolved household IDs to `DawnResult`.

### 10.4 `DawnResult` additions

```typescript
/** Households created this dawn (splits, orphan promotions). */
newHouseholds: Map<string, Household>;
/** IDs of households dissolved this dawn. */
dissolvedHouseholdIds: string[];
```

### 10.5 `game-store.ts` — `startTurn()`

Applies `newHouseholds` and `dissolvedHouseholdIds` from `DawnResult` to `state.households`:

```typescript
const updatedHouseholds = new Map(gameState.households);
for (const [id, hh] of dawnResult.newHouseholds) updatedHouseholds.set(id, hh);
for (const id of dawnResult.dissolvedHouseholdIds) updatedHouseholds.delete(id);
// Merge dawnResult.updatedHouseholds on top
for (const [id, hh] of dawnResult.updatedHouseholds) updatedHouseholds.set(id, hh);
```

### 10.6 `createInitialState()` in `game-store.ts`

After building the `people` Map (founders + Sauromatian women), call:

```typescript
const { updatedPeople, newHouseholds } = initializeHouseholds(people, 0);
```

Use `updatedPeople` and populate `initialGameState.households` with `newHouseholds`.

### 10.7 `deserializeGameState()` in `serialization.ts`

Backward-compat fallback for `isAutoNamed`:

```typescript
isAutoNamed: (h as Partial<Household>).isAutoNamed ?? false,
```

Old saves keep all existing household names as-is (`false` = never auto-update).

---

## 11. Event Integration

### 11.1 Existing events that reference `householdRole`

The actor-resolver criterion `householdRole` already works correctly. All existing household events continue to function — they reference roles like `senior_wife`, `head`, `thrall` which are now more widely populated.

### 11.2 New succession event (Sauromatian edge case)

When a Sauromatian head dies and there are adult sons who *could* split but tradition doesn't force them, inject a `hh_succession_council` event into `pendingEvents`. This event presents the player with:

- **Option A:** "The wife-council holds — sons remain together" → no split, eldest son becomes acknowledged heir but wives retain authority
- **Option B:** "The sons divide the inheritance" → force-split as per Imanian rules

This event is *not* drawn from the deck — it is programmatically injected by succession logic, similar to `rel_hidden_wheel_emerges`.

---

## 12. UI Implications

### 12.1 PersonDetail — Household section

Currently shows "Not in a household" for unattached people. After this change that state is theoretically impossible for living people. The `null` branch can be kept as a defensive fallback display but should never be visible in normal gameplay.

### 12.2 FamilyTree/Household overlay — HouseholdTab

Currently only accessible for people who have a `householdId`. All people will now have one, so the "Family Tree & Household" button should be visible for everyone.

Single-person households display as a single card in the `head` section — clean and minimal.

### 12.3 Settlement view — building ownership

`ownerHouseholdId` on buildings will now resolve to an actual household name for more cases. No UI change needed — the existing lookup already handles this.

---

## 13. Implementation Steps

| # | Step | Files | Notes |
|---|---|---|---|
| 1 | Add `isAutoNamed` to `Household` interface and `CreateHouseholdOptions`; add 3 new `ActivityLogType` values | `game-state.ts`, `household.ts` | Data-model only; trivial |
| 2 | Add `deriveHouseholdName()` and `ensurePersonHousehold()` to `household.ts` | `household.ts` | Pure functions; testable |
| 3 | Add `initializeHouseholds()` to `household.ts`; wire into `createInitialState()` | `household.ts`, `game-store.ts` | Founding state fix |
| 4 | Add `assignChildToHousehold()` to `household.ts`; wire into `processDemographicPhase()` | `household.ts`, `turn-processor.ts` | Birth integration |
| 5 | Add `mergeHouseholds()` to `household.ts`; refactor `performMarriage()` to use it | `household.ts`, `marriage.ts` | Marriage system refactor |
| 6 | Add `pruneOrphanedHouseholds()` to `household.ts`; wire into `processDawn()` | `household.ts`, `turn-processor.ts` | Safety net |
| 7 | Add `processHouseholdSuccession()` to `household.ts`; wire into `processDawn()` after demographic phase | `household.ts`, `turn-processor.ts` | Core succession logic |
| 8 | Add `hh_succession_council` event definition (Sauromatian edge case) | `definitions/household.ts` | Optional player decision |
| 9 | Update `DawnResult` with `newHouseholds`/`dissolvedHouseholdIds`; update store's `startTurn()` | `turn-processor.ts`, `game-store.ts` | Result propagation |
| 10 | Update `deserializeGameState()` for `isAutoNamed` backward compat | `serialization.ts` | Old save safety |
| 11 | Write test suite | `tests/population/household-lifecycle.test.ts` | See §14 |

---

## 14. Test Plan

`tests/population/household-lifecycle.test.ts`

| Test | What it verifies |
|---|---|
| `initializeHouseholds` creates one household per person | All founders get `householdId !== null` |
| `initializeHouseholds` is idempotent | Running twice doesn't create duplicate households |
| `assignChildToHousehold` — married parents → father's household | Child gets father's `householdId`, role `child` |
| `assignChildToHousehold` — unmarried mother → mother's household | Child gets mother's `householdId` |
| `mergeHouseholds` — woman's members join man's household | All woman's household members have updated `householdId` |
| `mergeHouseholds` — source household removed | Source ID absent from returned `updatedHouseholds` |
| `processHouseholdSuccession` — Imanian, 2 adult sons | Eldest becomes head; second splits to new household |
| `processHouseholdSuccession` — Imanian, eldest only | Eldest becomes head; no split; wives/daughters stay |
| `processHouseholdSuccession` — Imanian, no adult sons | Senior wife becomes head |
| `processHouseholdSuccession` — Sauromatian, 1 adult son | Returns pending succession event; no forced split |
| `processHouseholdSuccession` — property division 3 buildings, 2 splitting sons | Eldest keeps 2; 1 splitting son gets 1; last son gets 0 |
| `pruneOrphanedHouseholds` — all members dead | Household dissolved; their `householdId` cleared |
| `pruneOrphanedHouseholds` — living members present | Household untouched |
| `deriveHouseholdName` — single person | `"Household of [firstName]"` |
| `deriveHouseholdName` — Imanian married head | `"House of [familyName]"` |
| `deriveHouseholdName` — Sauromatian senior wife | `"[familyName] Ashkaran"` |
| `deriveHouseholdName` — `isAutoNamed: false` | Name not changed |
| Marriage merge dissolves source household | `dissolvedHouseholdId` returned and honored by store |
| Old save backward compat: `isAutoNamed` missing | Defaults to `false`; no crash |

---

## 15. Out of Scope for This Phase

- **Player-initiated splits**: A player manually splitting a household mid-game (e.g., sending an adult son to found a branch). Reserved for a future "Household Management" UI action.
- **Inheritance events for daughters**: Daughters currently stay in the household. A future phase could add ambition-driven events for adult daughters to claim leadership or form their own branch.
- **Cross-settlement households**: Households that span both the settlement and an external posting. The existing `away` role handles the person; household membership is unaffected.
- **Household wealth scores**: Aggregating resource ownership per household for comparative display. Left for a later Economy depth pass.

# Palusteria: Happiness & Settlement Morale System

**Phase:** Phase 4.1 — Complete  
**Status:** ✅ Implemented  
**Companion systems:** Building Claim (future), Economy Revamp (future), Trait System (Phase 3.9), Ambitions (Phase 3.6)

---

## 1. Design Philosophy

Happiness is an **emergent aggregate**, not a hand-authored stat. Every turn, a person's happiness score is computed fresh from their current conditions — food adequacy, shelter, family bonds, religious freedom, sense of purpose, and personal traits. The number is never stored; only the **streak counter** (how many turns they've been below the crisis threshold) needs to persist.

This means happiness is always honest. If you fix the food shortage, everyone immediately improves. If you break up a household, the wife immediately suffers. The system never lies by lag.

A single score per person feeds up to a single **settlement morale** figure, which governs crisis event eligibility and Company attention. A per-person tooltip (modelled on the existing `computeOpinionBreakdown()` pattern) shows exactly what is making each settler happy or unhappy.

### Design Goals

- **Readable at a glance:** A colour-coded morale chip in the bottom bar summarises the settlement's mood in one number. Hover for a breakdown.
- **Mechanically consequential:** Happy settlers produce more; miserable settlers eventually leave — and may take their families.
- **Narratively rich:** Low morale triggers events that give the player one more chance to address root causes before things spiral.
- **Trait-aware:** Personality shapes the floor and ceiling of happiness, so two settlers in identical conditions can feel very differently.
- **Future-ready:** Hooks for the building claim system are defined here even though the revamp that activates them is a later phase.

---

## 2. Individual Happiness Score

### 2.1 Computation

```
happiness = sum(all active factors) clamped to [-100, +100]
```

Happiness is **computed on demand** by `computeHappiness(person, state)`. It is never written back to `Person`. The only persisted field is `person.lowHappinessTurns: number`, incremented each turn the score is below the crisis threshold (< −50) and reset to 0 when it rises above it.

### 2.2 Score Range & Labels

| Score | Label | Tailwind colour |
|-------|-------|-----------------|
| 60 to 100 | Thriving | `text-emerald-400` |
| 30 to 59 | Content | `text-lime-400` |
| 5 to 29 | Settled | `text-yellow-300` |
| −15 to 4 | Restless | `text-amber-400` |
| −35 to −16 | Discontent | `text-orange-400` |
| −60 to −36 | Miserable | `text-red-400` |
| −100 to −61 | Desperate | `text-red-600` |

### 2.3 Factor Catalogue

Factors are grouped into three categories: **Material**, **Social**, and **Purpose**. Each factor contributes a signed integer delta. The tooltip shows each factor that contributed a non-zero delta, labelled in plain language.

---

#### Category A — Material Wellbeing

**Food adequacy** (evaluated against the settlement's stored food relative to population):

| Condition | Delta | Label |
|-----------|-------|-------|
| Food stock ≥ 2× population (2 seasons stored) | +10 | Full bellies |
| Food stock ≥ 1× population (1 season stored) | +5 | Ample provisions |
| Food stock < 0.5× population | −10 | Provisions running low |
| Person has `malnourished` health condition | −25 | Suffering from hunger |

*These stack: a malnourished person in a food-poor settlement takes both penalties.*

**Shelter & crowding** (using the existing `getOvercrowdingRatio()`):

| Overcrowding ratio | Delta | Label |
|--------------------|-------|-------|
| ≤ 1.0 | 0 | Adequate shelter |
| 1.01 – 1.25 | −5 | A little cramped |
| 1.26 – 1.50 | −15 | Badly overcrowded |
| > 1.50 | −30 | Dangerously crowded |

**Private shelter** *(future building-claim hook — returns 0 until the building revamp activates it)*:

| Condition | Delta | Label |
|-----------|-------|-------|
| Has a claimed private dwelling | +15 | Has their own home |
| Adult (age ≥ 18) with no private shelter for > 12 turns | −10 | Still living communally |

See §8 for the data model hook.

**Health conditions** (each active condition individually):

| Condition | Delta | Label |
|-----------|-------|-------|
| `ill` | −15 | Struggling with illness |
| `wounded` | −10 | Nursing an injury |
| `malnourished` | already counted above | — |
| `recovering` | −5 | Still recovering |
| `chronic_illness` | −20 | Living with a chronic condition |
| `frail` | −10 | Physical frailty weighs on them |

---

#### Category B — Social & Family

**Marital status:**

| Condition | Delta | Label |
|-----------|-------|-------|
| Has at least one living spouse | +15 | Settled down with a partner |
| Is unmarried AND age ≥ 20 | −5 | Has not found a partner |

**Children:**

| Condition | Delta | Label |
|-----------|-------|-------|
| Has at least one living child | +8 | The joy of family |

**Named relationships:**

| Condition | Delta | Label |
|-----------|-------|-------|
| Has a named `friend` or `confidant` | +10 | Close friendships |
| Has a named `mentor` or `student` | +8 | A meaningful bond of guidance |
| Has a named `rival` | −5 | An ongoing rivalry |
| Has a named `nemesis` | −15 | A bitter enmity |
| Completely isolated: no named relationships AND no opinion score > 20 with anyone | −10 | Lonely among strangers |

**Ashka-Melathi bonds** (Sauromatian co-wife closeness):

| Condition | Delta | Label |
|-----------|-------|-------|
| Has at least one Ashka-Melathi partner | +8 | Bound in Ashka-Melathi fellowship |

**Religious freedom:**

| Condition | Delta | Label |
|-----------|-------|-------|
| Policy is `orthodox_enforced` AND person's religion is `sacred_wheel` | −15 | Faith suppressed by authority |
| Policy is `orthodox_enforced` AND person's religion is `syncretic_hidden_wheel` | −20 | Faith practised in secret and fear |
| Person's religion is the majority faith of the settlement | +5 | Surrounded by like faith |
| A dedicated priest/singer/voice of their faith is present in the settlement | +5 | Spiritual leadership present |

---

#### Category C — Purpose & Autonomy

**Work role:**

| Condition | Delta | Label |
|-----------|-------|-------|
| Has a meaningful role (not `unassigned`) | +5 | Purposeful work |
| Has been `unassigned` for ≥ 4 turns | −10 | Without purpose or direction |
| Role uses a skill where person is rated Excellent (63+) or above | +5 | Working in their element |
| Role uses a skill where person is rated Fair (1–25) | −5 | Ill-suited to their role |

*"Role uses a skill" mapping: farmer → plants; trader → bargaining; guard → combat; craftsman → custom; healer → plants; gather_food → plants; gather_stone/lumber → custom; priest_* → leadership; trader/voice roles → bargaining. If no clear skill mapping, this factor is 0.*

**Ambitions:**

Ambitions are not directly scored here — they interact with happiness via the **trait system**: a fulfilled ambition grants the `inspired` temporary trait (+25 below); a long-stale ambition triggers the `restless` temporary trait (−15 below). Because those traits are already granted by the ambition system, no direct ambition delta is added here to avoid double-counting.

---

### 2.4 Trait Modifiers

Personality traits apply a flat modifier on top of the factored score. These are applied **after** all category factors are summed, and before clamping.

| Trait | Delta | Notes |
|-------|-------|-------|
| `content` | +15 | Satisfied with their lot in life |
| `optimistic` | +10 | Generally upbeat; resilient against penalties |
| `melancholic` | −10 | Prone to sadness regardless of conditions |
| `sanguine` | +8 | Naturally cheerful |
| `patient` | +5 | More tolerant of hardship |
| `hot_tempered` | −5 | Chafes at any frustration |
| `brave` | +5 | Psychological resilience |
| `cowardly` | −5 | Anxiety weighs on them |
| `romantic` | +20 if has spouse; **−15 if unmarried** | Conditional; the sign flips |
| `lonely` | +15 if has a named friend/confidant; **−20 if isolated** | Conditional; the sign flips |
| `gregarious` | +10 if has ≥ 1 named relationship; −5 if isolated | Craves company |
| `solitary` | +10 if overcrowding ratio ≤ 1.0; **−15 if ratio > 1.25** | Conditional; craves personal space |
| `proud` | +10 if `socialStatus` is `founding_member` or `elder`; **−15 if `outcast` or `thrall`** | Conditional |
| `ambitious` | +10 if has an active ambition; −10 if age ≥ 22 and no ambition and any skill ≥ 46 | Needs a goal |
| `cynical` | −10 | Nothing is ever quite right |
| `devout` | Religion satisfaction deltas above are multiplied by 1.5 | Deeper spiritual stakes |
| **Temporary traits** | | |
| `inspired` | +25 | From fulfilled ambitions, pivotal events |
| `restless` | −15 | From stale ambitions, prolonged communal living |
| `grieving` | −20 | From bereavement |
| `traumatized` | −20 | From severe events |
| `homesick` | −20 | From the distance of home |
| `bereaved` (earned) | −20 | Long-term grief |
| **Earned traits** | | |
| `respected_elder` | +10 | Social standing satisfaction |
| `veteran` | +5 | Hard-won psychological resilience |
| `healer` | +5 | Fulfilment in their craft |

---

### 2.5 Production Efficiency

Happiness modifies per-person **production output** as a multiplier applied to that individual's contribution in `calculateProduction()`. This applies to all production-generating roles (farmer, trader, craftsman, healer, gather_*, priest roles).

| Personal Happiness | Production Multiplier |
|--------------------|-----------------------|
| 60 to 100 | ×1.15 |
| 30 to 59 | ×1.07 |
| 5 to 29 | ×1.00 (baseline) |
| −15 to 4 | ×0.95 |
| −35 to −16 | ×0.88 |
| −60 to −36 | ×0.78 |
| −100 to −61 | ×0.65 |

Guards and `away`/`keth_thara` persons are intentionally excluded — combat effectiveness is not modelled by this multiplier.

---

## 3. Settlement Morale

### 3.1 Computation

```
settlementMorale = arithmetic mean of computeHappiness(p, state)
                   for all living persons with age ≥ 14
```

This is computed once per dawn after all individual scores are evaluated. The result is stored in `DawnResult` and optionally cached as `GameState.lastSettlementMorale` for UI rendering between turns.

### 3.2 Settlement Morale Labels

Same thresholds as individual happiness (§2.2) applied to the mean:

| Range | Label |
|-------|-------|
| 60+ | Thriving Settlement |
| 30–59 | Content Community |
| 5–29 | Settled |
| −15 to 4 | Restless Community |
| −35 to −16 | Discontent |
| −60 to −36 | In Crisis |
| below −61 | Collapsing |

### 3.3 Crisis Counters

Two streak counters on `GameState` gate crisis events:

```typescript
lowMoraleTurns: number        // incremented each turn morale < -20; reset when morale ≥ -20
massDesertionWarningFired: boolean  // gate to prevent the mass departure event firing twice per episode
```

---

## 4. Crisis Events & Desertion

### 4.1 Individual Desertion

**Tracking:** `person.lowHappinessTurns: number` — incremented each dawn when the person's computed score is < −50; set to 0 when score ≥ −50.

**Eligibility gates:**
- `lowHappinessTurns` ≥ 3: person becomes eligible for the *considering leaving* event
- `lowHappinessTurns` ≥ 5, or score < −75: event fires with urgency; the player has one last chance

**Event: `hap_settler_considers_leaving`**

The settler approaches the council and says plainly they are thinking of leaving.

*Choices:*
1. **Address their core complaint** — requires a specific resource (food, medicine, lumber for shelter) or a specific condition (e.g., settle their marriage ambition). If the condition cannot be met, this option is greyed out. On success: person gains `inspired`, `lowHappinessTurns` resets.
2. **Personal appeal** — requires a council member with effective opinion ≥ 30 of the settler. The councillor speaks privately to them. On success: `lowHappinessTurns` resets to 1; partial relief. Failure possible if the relationship is merely tactical.
3. **Let them go in peace** — they depart gracefully. No further penalty beyond population loss. Company standing −2.
4. **Dismiss their complaint** — they depart bitterly. Any family members with opinion ≥ 20 of the departing person will leave with them. Company standing −5. Remaining settlers' opinion of the player (via a broadcast `modify_opinion` effect) shifts −5.

**Family departure logic:**
- The departing person's spouse(s): depart if their own `lowHappinessTurns` ≥ 1 OR they have effective opinion ≥ 25 of the primary departee
- Children under 16: always follow the parent they live with (or the mother if ambiguous)
- The event card shows a preview of exactly who will leave before the player confirms any choice

### 4.2 Settlement-Level Crisis Events

Four events triggered by `lowMoraleTurns` thresholds. All are injected programmatically by `processDawn()` (not drawn from the normal deck) to ensure they fire at the right moment.

**Event: `hap_low_morale_warning`**  
Trigger: `lowMoraleTurns` reaches 4  
*The community elders, or the most vocal faction, voice collective concern. Morale is visibly suffering.*  
Choices:
1. Call a town meeting — costs 2 goods (food and entertainment), resets `lowMoraleTurns` to 0, applies +5 happiness bonus to all for 3 turns (via `modify_opinion_labeled` or a new `boost_settlement_morale` consequence)
2. Investigate root cause — reveals the top 3 happiness drag factors across the population; gives player actionable information
3. Dismiss the concern — faction that raised it gains −10 opinion of player; `lowMoraleTurns` not reset

---

**Event: `hap_desertion_imminent`**  
Trigger: 3 or more living persons have `lowHappinessTurns` ≥ 3 simultaneously  
*A spokesperson (the unhappiest person with the highest leadership skill) delivers a collective ultimatum: conditions must improve or multiple settlers will leave.*  
Choices:
1. Pledge to improve conditions — requires specifying one concrete change; triggers a deferred event 2 turns later evaluating whether morale has improved
2. Material incentive — spend 5 gold, resets `lowHappinessTurns` for all crisis-eligible settlers to 1
3. Appeal to the mission — requires council member with leadership ≥ 63; partial reduction in `lowHappinessTurns` for some settlers, not all
4. Do nothing — after 2 turns without improvement, the `hap_mass_departure` event fires

---

**Event: `hap_mass_departure`**  
Trigger: After `hap_desertion_imminent` unresolved for 2 turns, OR `lowMoraleTurns` ≥ 10  
*Multiple settlers simultaneously announce they are leaving. Without dramatic intervention, the settlement loses a significant portion of its population.*  
This is a catastrophic event. The choices available scale with remaining resources. Company standing −10 after the fact. A letter from the Company arrives next turn.

---

**Event: `hap_company_happiness_inquiry`**  
Trigger: `lowMoraleTurns` ≥ 8 OR immediately after any `hap_mass_departure` resolves  
*The Company has heard reports from departing settlers that conditions are poor. They want answers.*  
Choices:
1. Honest report — Company standing −5, but they respond with a supply drop (medicine + food) if standing ≥ 40
2. Reassure them — skill check on the player's best-rated trader/bargaining person; success: no standing loss; failure: −10 standing (the Company sees through it)
3. Blame external factors (raids, bad harvest) — only available if relevant events occurred recently; Company standing neutral; buys 4 turns before another inquiry

---

## 5. UI Integration

### 5.1 Bottom Bar — Morale Chip

Add a `Morale` entry to `BottomBar.tsx` between the population count and the resource strip. Display:
- Numeric score (the settlement mean, rounded to nearest integer)
- Colour-coded label from §3.2
- A small icon (e.g., 🧡 restless, 💚 content)
- **Hover tooltip:** shows the top 3 happiness drag factors and top 3 happiness boosts across the whole population (aggregated from all `computeHappinessFactors()` results)

### 5.2 PersonDetail — Happiness Section

Add a Happiness section below the Ambition badge and above Key Opinions. Display:
- Score with label and colour chip
- Breakdown list: each factor with non-zero delta, sorted by |delta| descending
  - Green chips for positive deltas, red chips for negative deltas
  - Delta shown as `+10` / `−15` prefix
  - Timed/conditional factors show their current condition in the label: `"Badly overcrowded: −15"`
- If `lowHappinessTurns` > 0, show a warning: `"Considering departure — N turns at this level"`

### 5.3 PeopleView — Sort & Filter

Add `happiness` to the sort options (computed on render; not persisted). Add a filter chip: **"Show discontent"** (happiness < −15). This lets the player quickly identify at-risk settlers.

---

## 6. Interaction with Existing Systems

### 6.1 Ambition System

No direct score overlap. The handshake is:
- **Ambition fulfilled** → the existing grant of `inspired` trait is the happiness payoff (§2.4)
- **Ambition stale** (> 40 turns unfulfilled) → the existing grant of `restless` trait is the happiness penalty (§2.4)
- The `AMBITION_FIRING_THRESHOLD = 0.7` gate remains unchanged; ambitions and happiness are parallel, not coupled

### 6.2 Trait Expansion (Phase 3.9)

The temporary `mental_state` traits (`inspired`, `grieving`, `restless`, `traumatized`, `homesick`) already exist with expiry mechanics. Happiness scoring **reads** from the person's active traits — it does not grant traits. Trait granting remains the responsibility of events and the ambition/scheme systems.

### 6.3 Factions (Phase 4.0)

Faction demand strength is currently computed from membership and alignment. In a later pass, faction strength could receive a bonus multiplier when settlement morale is low (discontent = fertile ground for faction growth). This is noted here but not required for initial implementation.

### 6.4 Opinion System

Happiness does not write to the opinion map. Low happiness does not make everyone dislike the player. Happiness and opinions are independent pressure axes — they converge at events, where the presenter of a grievance needs a high enough opinion to be listened to.

### 6.5 Overcrowding

The overcrowding ratio computed by `getOvercrowdingRatio()` is already used in mortality and production. Happiness simply reads the same ratio and adds a social penalty on top of the existing mechanical penalties — shelter misery is felt emotionally as well as economically.

---

## 7. Building Claim System Hook (Future)

The building revamp will introduce the concept of **personal dwelling claims** — individual settlers or households asserting ownership of a specific built structure (a Roundhouse, a Longhouse room, etc.). This is not implemented in the current building system, which treats all civic buildings as shared communal pool capacity.

**The happiness system will support this via two fields that are defined now but inert until the building revamp:**

On `Person`:
```typescript
claimedBuildingId: string | null   // null until building revamp; happiness reads this as "has private shelter"
```

On `BuiltBuilding` (in game-state.ts):
```typescript
claimedByPersonIds: string[]       // empty array until building revamp; households can claim a building
```

**Happiness logic today:** `claimedBuildingId === null` for everyone → the "Has a claimed private dwelling" factor contributes 0 for everyone. No penalty is applied either — the " > 12 turns communal" penalty only activates if `claimedBuildingId === null` AND the building revamp is active (gated by a flag or building catalog change that the revamp introduces).

By defining the interface now, the building revamp can simply start populating `claimedBuildingId` and the happiness system will automatically respond without code changes to `happiness.ts`.

---

## 8. New Data Model Fields

### On `Person` (in `game-state.ts`)

```typescript
// Existing
...

// Happiness-related (new)
lowHappinessTurns: number            // Consecutive turns with score < -50; resets when score >= -50
claimedBuildingId: string | null     // Future building-claim hook; null = living communally
```

### On `GameState` (in `game-state.ts`)

```typescript
// Happiness-related (new)
lowMoraleTurns: number               // Consecutive turns with settlement morale < -20; resets when >= -20
massDesertionWarningFired: boolean   // Prevents hap_desertion_imminent firing twice in same crisis episode
lastSettlementMorale: number         // Cached last computed mean; used by UI between turns (default 0)
```

### Serialisation

All four new fields are plain numbers or booleans — no `Map` serialisation required. `deserializeGameState` and `deserializePerson` should provide fallbacks:
- `lowHappinessTurns`: `?? 0`
- `claimedBuildingId`: `?? null`
- `lowMoraleTurns`: `?? 0`
- `massDesertionWarningFired`: `?? false`
- `lastSettlementMorale`: `?? 0`

---

## 9. New Files & Functions

### `src/simulation/population/happiness.ts`

```typescript
// Types
interface HappinessFactor {
  label: string;
  delta: number;
  category: 'material' | 'social' | 'purpose' | 'trait';
}

// Core computation
function computeHappinessFactors(person: Person, state: GameState): HappinessFactor[]
function computeHappiness(person: Person, state: GameState): number
  // = sum(computeHappinessFactors()) clamped to [-100, +100]

// Settlement-level
function computeSettlementMorale(people: Map<string, Person>, state: GameState): number
  // = arithmetic mean for all persons age >= 14

// Helpers
function getHappinessLabel(score: number): string
function getHappinessColor(score: number): string  // Tailwind class name
function getHappinessProductionMultiplier(score: number): number
function isDesertionEligible(person: Person): boolean
  // = person.lowHappinessTurns >= 3

// processDawn helper
function applyHappinessTracking(
  people: Map<string, Person>,
  state: GameState
): { updatedPeople: Map<string, Person>; settlementMorale: number; desertionCandidateIds: string[] }
  // Computes all individual scores, updates lowHappinessTurns counters,
  // returns morale mean and IDs of anyone newly eligible for desertion event
```

### `src/simulation/events/definitions/happiness.ts`

Four events:
- `hap_settler_considers_leaving` — individual departure event; `actorRequirements: [{ slot: 'settler', minAge: 16 }]`; `isDeferredOutcome: false` (fires immediately at crisis threshold)
- `hap_low_morale_warning` — injected when `lowMoraleTurns` = 4
- `hap_desertion_imminent` — injected when 3+ settlers have `lowHappinessTurns` ≥ 3
- `hap_company_happiness_inquiry` — injected when `lowMoraleTurns` ≥ 8 or after mass departure

All four events should have `isDeferredOutcome: false` (they are the result of a brewing problem, not the start of a deferred chain). The player must resolve them in the normal event phase.

### New consequence type: `boost_happiness`

```typescript
{
  type: 'boost_happiness';
  target: 'all' | 'settlement' | '{slot}';
  value: number;   // Temporary bonus turns; grants the 'inspired' trait for N turns to all targets
}
```

This is a cleaner way to implement the "town meeting" consequence than manually applying per-person modifiers.

---

## 10. `processDawn` Integration

New step added after **step 17 (Named Relationships)** in the existing sequence, tentatively numbered **Step 17.5**:

```
Step 17.5 — Happiness Evaluation
  a. For each living person age >= 14:
       - Compute happiness score via computeHappiness(person, state)
       - If score < -50: increment person.lowHappinessTurns
       - If score >= -50: reset person.lowHappinessTurns to 0
       - If person is newly eligible for desertion (lowHappinessTurns hits 3):
           add to desertionCandidateIds list
  b. Compute settlementMorale = mean of all adult scores
  c. Update GameState.lastSettlementMorale
  d. If morale < -20: increment state.lowMoraleTurns
     Else: reset state.lowMoraleTurns to 0; reset massDesertionWarningFired to false
  e. Crisis event injection:
       - If desertionCandidateIds.length == 1 AND their lowHappinessTurns is 3:
           inject hap_settler_considers_leaving for that person
       - If desertionCandidateIds.length >= 3 AND !massDesertionWarningFired:
           inject hap_desertion_imminent; set massDesertionWarningFired = true
       - If state.lowMoraleTurns == 4:
           inject hap_low_morale_warning
       - If state.lowMoraleTurns == 8:
           inject hap_company_happiness_inquiry
  f. Tag DawnResult with: { settlementMorale, desertionCandidateIds }
```

`DawnResult` additions:
```typescript
settlementMorale: number
desertionCandidateIds: string[]
```

---

## 11. Integration with `calculateProduction()`

In `resources.ts`, `calculateProduction()` currently returns a flat resource delta based on roles and buildings. The happiness multiplier is applied per contributing person:

```
personContribution × getHappinessProductionMultiplier(computeHappiness(person, state))
```

This requires `state` to be threaded into `calculateProduction()` — or alternatively, the multipliers are computed in the dawn step and passed in as a `Map<personId, number>`. The latter (a pre-computed multiplier map) avoids the risk of recalculating happiness twice and keeps `resources.ts` free of deep `GameState` dependency. **Preferred approach:** pre-compute multiplier map in dawn step 17.5, pass it into production calculation.

---

## 12. Test Coverage Plan

**`tests/population/happiness.test.ts`** (new file, ~40 tests):

| Group | Tests |
|-------|-------|
| Material factors | Food adequacy all 4 tiers; malnourished stacking; overcrowding all 4 tiers; health conditions (ill, wounded, chronic_illness, frail) each independently |
| Social factors | Has spouse; has child; named friend; named nemesis; isolated penalty; Ashka-Melathi bond; religion suppression (orthodox_enforced × wheel faith; orthodox_enforced × hidden_wheel) |
| Purpose factors | Meaningful role bonus; unassigned penalty; excellent skill in role; fair skill in role |
| Trait modifiers | `content` +15; `romantic` conditional (spouse vs. no spouse); `lonely` conditional; `solitary` conditional (crowded vs. not); `proud` conditional (elder vs. thrall); `inspired` +25; `grieving` −20; `homesick` −20 |
| Clamping | Score never exceeds +100; score never goes below −100 |
| Production multiplier | All 7 tiers return correct multiplier |
| Settlement morale | Mean of two persons; excludes children under 14; single person |
| Crisis tracking | `lowHappinessTurns` increments when < −50; resets when ≥ −50; `lowMoraleTurns` increments and resets correctly |
| `isDesertionEligible` | True at 3 turns; false at 2; false if recently reset |

**`tests/events/happiness-events.test.ts`** (new file, ~12 tests):
- Each happiness event exists in `ALL_EVENTS`
- `hap_settler_considers_leaving` has a valid `actorRequirements` entry
- Consequence types are valid (including `boost_happiness` if implemented)

---

## 13. Out of Scope for Initial Implementation

The following are intentionally deferred:

- **Building claim assignment UI** — Part of the building revamp. The data hook (`claimedBuildingId`) is added now; the UI to assign/claim buildings comes later.
- **Per-person happiness history** — No sparkline chart of happiness over time. The streak counter (`lowHappinessTurns`) is sufficient for gameplay purposes.
- **Happiness-driven faction strength bonus** — Noted in §6.3; deferred.
- **Morale effects on military/raid outcomes** — Since combat is not deeply modelled yet, unhappiness does not penalise raid defence. Guards simply produce nothing if miserable, which is already handled by the production multiplier.
- **Company happiness-level reporting as a visible stat** — The Company reacts to morale only via the inquiry event. No standing-drain formula like the religious pressure system.
- **Seasonal happiness modifiers** — Winters are miserable, but this is implicitly modelled through Winter food shortages, overcrowding, and lack of production. No direct seasonal delta is added.

---

## 14. Implementation Sequencing

When the time comes to implement, the recommended order is:

1. Add `lowHappinessTurns`, `claimedBuildingId` to `Person`; add `lowMoraleTurns`, `massDesertionWarningFired`, `lastSettlementMorale` to `GameState`; add serialisation fallbacks
2. Create `happiness.ts` with `computeHappinessFactors`, `computeHappiness`, `computeSettlementMorale`, helpers
3. Write tests (`happiness.test.ts`) — this is pure logic with no side effects, easy to TDD
4. Add dawn step 17.5 to `turn-processor.ts`; add `settlementMorale` and `desertionCandidateIds` to `DawnResult`
5. Pre-compute multiplier map in dawn step; thread it into `calculateProduction()`
6. Add `boost_happiness` consequence type to `engine.ts`
7. Write the four happiness events in `definitions/happiness.ts`; add to `ALL_EVENTS`
8. Wire crisis event injection into `game-store.startTurn()` (same pattern as `shouldFireHiddenWheelEvent`)
9. UI: BottomBar morale chip, PersonDetail happiness section, PeopleView sort/filter
10. Write event tests

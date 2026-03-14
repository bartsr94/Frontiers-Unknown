# Trait Expansion — Design & Implementation Plan

**Feature:** Personality depth, autonomous character behaviour, trait-driven events  
**Phase:** Phase 4 (Polish) — Character Agency pass  
**Status:** ✅ Complete  
**Companion docs:** `AUTONOMY_SYSTEM.md`, `OPINIONS_SYSTEM.md`, `PALUSTERIA_ARCHITECTURE.md §4.6`

---

## 1. Vision

Characters in the Ashmark should feel like *people*, not statistics. A greedy merchant should be seen scheming at the trading post, not merely assigned a higher bargaining skill. A jealous wife should create real friction when her husband takes a second. A melancholic elder should occasionally drag the council into paralysis. A storyteller should hold the community's memory together.

This document expands the trait system from a **skill-generation tool** into a full **character personality engine** that:

1. Gives every trait a *continuous*, turn-by-turn effect on something the player can observe
2. Creates trait-based chemistry between specific characters (not just generic opinion modifiers)
3. Makes trait combinations produce emergent behaviour the player must navigate
4. Expands the trait catalogue from 45 to ~85 uniquely meaningful traits across 6 categories
5. Establishes earned trait acquisition pathways — so a person's history is written on their character sheet

The measure of success: after fifty turns, the player should be able to close their eyes and predict roughly how each character will react to a crisis — because they have been watching that personality express itself all along.

---

## 2. Current State Audit

### What exists

| System | Trait coverage | Notes |
|--------|---------------|-------|
| Skill generation (`generatePersonSkills`) | 15 traits | One-time bonus at birth/creation only |
| Mortality (`processDawn`) | `robust` ×0.5, `sickly` ×2.0 | Working |
| Disease chance (`processDawn`) | `robust` ×0.5, `sickly` ×1.5 | Working |
| Fertility (`getFertilityChance`) | `fertile` ×1.3, `barren` = 0 | Working |
| Ambition blocking | `content` only | Very narrow |
| Council voice archetype | 26 traits → 6 archetypes | Working but first-match-wins is shallow |
| Choice scoring | 17 traits scored | Working |
| Opinion baseline | 8 conflict pairs, 7 shared bonuses | Working |
| Marriage cross-culture effects | `traditional` −10, `cosmopolitan` +5 | Working |
| Actor slot criteria (`hasTrait`) | Field exists | **Never used in any event definition** |

### What is missing

- `data/trait-definitions.ts` — file does not exist; types exist but no data catalog
- Trait inheritance — `inheritWeight` field defined but never consumed
- Trait-driven **event weight modifiers** — wrathful people don't make quarrel events more likely
- Trait-driven **per-turn autonomy** — no continuous social, productivity, or health behaviour
- Earned trait acquisition — `add_trait` consequence exists but no events use it
- Mental / emotional state traits (temporary conditions)
- Relationship-style traits (jealous, devoted, fickle)
- Faith-depth traits (zealous, syncretist)
- Sauromatian-specific spiritual traits
- No `hasTrait` used in any `actorRequirements` today

---

## 3. New Trait Taxonomy

### 3.1 Design principles

- Every trait must affect **at least two** observable systems (e.g. skill generation + opinion drift, or event weight + autonomous behaviour)
- Opposing trait pairs always conflict; a person cannot hold both sides
- Aptitude traits may be inherited; personality and cultural traits are not directly inherited
- Earned traits are acquired through specific life events and can be lost
- Mental state traits are **temporary** — they expire after a fixed number of turns or on a fulfilling event
- The total per-person trait count remains **2–4 at birth**, but can grow to **up to 6** through earned/mental acquisitions

### 3.2 Existing traits (retained, unchanged IDs)

```
Personality: ambitious, content, gregarious, shy, brave, craven, cruel, kind,
             greedy, generous, lustful, chaste, wrathful, patient, deceitful,
             honest, proud, humble

Aptitude:    strong, weak, clever, slow, beautiful, plain, robust, sickly,
             fertile, barren

Cultural:    traditional, cosmopolitan, devout, skeptical, xenophobic, welcoming

Earned:      veteran, scarred, respected_elder, scandal, oath_breaker, hero,
             coward, wealthy, indebted
```

### 3.3 New personality traits

| ID | Name | Conflicts | Core mechanical expression |
|----|------|-----------|---------------------------|
| `vengeful` | Vengeful | `forgiving` | Holds grudges: opinion modifiers from negative events decay at ×0.25 speed; `wrathful` conflict events have +25% more severe outcomes for this person |
| `forgiving` | Forgiving | `vengeful` | Negative opinion modifiers decay at ×2 speed; −opinion consequences from events are halved for this person |
| `melancholic` | Melancholic | `sanguine` | After any death or failed ambition, gains temporary `grieving` mental state; productivity −10% when `grieving` is active |
| `sanguine` | Sanguine | `melancholic` | On fulfilled ambition or marriage, opinion of everyone in settlement +3 that turn; `grieving` mental states last half as long |
| `zealous` | Zealous | `skeptical`, `cynical` | Religious tension never decreases while this person is alive (adds a floor); if Sacred Wheel, conversion attempts at +30% rate |
| `cynical` | Cynical | `devout`, `zealous` | Immune to religious conversion; religious event weight ×0.5 for this person; opinion −8 toward `devout` and `zealous` |
| `curious` | Curious | `stubborn` | Language learning rate ×1.5; new cultural events weight +2 for this person as actor; skill growth +1/season in any skill where they already have exposure |
| `stubborn` | Stubborn | `curious` | Cultural drift ×0.5 for this person; opinion modifiers from events decay at ×0.5 speed; costs +5 more opinion to change a decision |
| `charming` | Charming | — | All initial baseline opinions of this person from others begin +8 higher; `gregarious` amplifies to +12 when both are held |
| `suspicious` | Suspicious | `trusting` | All initial baseline opinions this person holds toward others begin −10; refuses opinion improvements from strangers faster |
| `trusting` | Trusting | `suspicious` | All initial baseline opinions this person holds toward others begin +8; negative consequences from `deceitful` characters hit harder (they were trusting) |
| `reckless` | Reckless | `patient` | Combat skill bonus +5; health damage events hit +20% harder; chance of spontaneous minor injury 5%/season |
| `envious` | Envious | `generous` | Opinion −10 toward the single wealthiest person in the settlement; if two people are wealthy, opinion −6 toward both |
| `protective` | Protective | — | Opinion +15 toward household members (in addition to baseline); in conflict resolution events, always biased toward defending kin |

### 3.4 New social / relationship traits

These describe *how* a character bonds with others, not *who* they are morally.

| ID | Name | Conflicts | Core mechanical expression |
|----|------|-----------|---------------------------|
| `devoted` | Devoted | `fickle` | Opinion decay rate ×0.3 for spouses and household members; once opinion > +40, it is capped from decaying below +30 naturally |
| `jealous` | Jealous | — | If spouse takes a second partner (concubine or second wife): −30 opinion toward said partner; also −10 toward husband per additional marriage |
| `fickle` | Fickle | `devoted` | All opinion entries decay at ×2 speed; ambition intensity grows +0.08/turn (restless energy) instead of +0.05 |
| `clingy` | Clingy | — | If spouse opinion drops below +20, person gains `grieving` mental state for 2 turns; spontaneous `seek_spouse` ambition re-forms after fulfillment more quickly |
| `mentor_hearted` | Mentor-Hearted | — | All household members gain +1 skill growth/season in their primary skill while this person is alive and in `custom` or `leadership` role |
| `contrarian` | Contrarian | `humble` | In choice scoring, scores deliberate opposite of consensus (if the majority score choice A, this person scores B); opinion −5 toward the council-seat holder |

### 3.5 New cultural / faith traits

| ID | Name | Conflicts | Core mechanical expression |
|----|------|-----------|---------------------------|
| `syncretist` | Syncretist | `zealous` | Religious tension contribution from this person is zero; if Sacred Wheel fraction > 50%, they gain `wheel_blessed` earned trait |
| `folklorist` | Folklorist | — | `languageDiversityTurns` increments +1/turn faster while alive; when assigned `custom` role, boosts cultural event weight +1.5 for the settlement |
| `linguist` | Linguist | — | Language learning rate ×2.0 (stacks with `curious`); `tradetalk` hard cap raised to 0.75 for this person |
| `honor_bound` | Honor-Bound | `oath_breaker` | If any event result involves betraying an explicit deal or agreement (modify_standing < −10), this person gains −20 opinion of the betrayer permanently; public oath-keeping events +20 weight while this person is alive |
| `company_man` | Company Man | `honor_bound` when tribal | Company standing losses are halved for events this person triggers; personal opinion −15 toward anyone with Sauromatian heritage >50% |

### 3.6 New aptitude traits

| ID | Name | Conflicts | Core mechanical expression |
|----|------|-----------|---------------------------|
| `gifted_speaker` | Gifted Speaker | `shy` | `bargaining` and `leadership` skill generation +10; council advice archetype scoring: +10 toward whichever choice scores highest already (amplifies the consensus) |
| `green_thumb` | Green Thumb | — | `plants` skill generation +15; farmer role food production +1; Tilled Fields skill growth bonus doubled for this person |
| `keen_hunter` | Keen Hunter | — | `animals` and `combat` generation +10; `gather_food` role yield +1 outside normal proficiency math |
| `iron_constitution` | Iron Constitution | `sickly` | Disease chance ×0.3; malnutrition condition never progresses to `frail` for this person; `robust` stacks multiplicatively |
| `fleet_footed` | Fleet-Footed | — | Away-mission deferred events return 1 turn faster; `exploring` derived skill +5 |

### 3.7 New earned traits (acquired through play)

These are added via `add_trait` consequences in events or via the new **autonomous acquisition** system (§5.3).

| ID | Name | Acquisition trigger | Core mechanical expression |
|----|------|---------------------|---------------------------|
| `healer` | Healer | Treat 3+ persons for `ill`/`wounded` conditions via events | `medicine` production equivalent on `custom` role; health consequence severity −15% for this person when they are the actor |
| `midwife` | Midwife | Present at 5+ births (requires `keth_thara` role) | Maternal mortality chance halved in settlement; birth notification text gains flavour |
| `storyteller` | Storyteller | Assigned `custom` role for 6+ seasons | `languageDiversityTurns` does not regress while this person lives; cultural drift of settlement −5% from baseline |
| `negotiator` | Negotiator | 3+ successful trade events where this person was the actor | Trade fairness window widened by 5% in favour of player; tribe cooldown −1 turn for trades involving this person |
| `outcast` | Outcast | Average opinion held by others falls below −40 | Others' initial baseline opinion of this person is −20; this person's productivity −10%; cannot sit in the Council |
| `kinslayer` | Kinslayer | Directly causes death of a family member via event choice | Universal opinion penalty −25 from all persons aware; `honor_bound` persons refuse any interaction |
| `exile` | Exile | Born outside the settlement and arrived as adult | Resistance to cultural drift ×0.7; `homesick` mental state possible if no shared language exists |
| `ghost_touched` | Ghost-Touched | Sauromatian person participates in Sacred Wheel ceremony event | Sacred Wheel religious tension contribution from this person −0.1; spiritual event options +15 in choice scoring |
| `blessed_birth` | Blessed Birth | Born under auspicious lore signs (Sauromatian midwife present at birth) | Opinion baseline from all Sauromatian persons +10; `divine_favour` event chain eligible |
| `bereaved` | Bereaved | Spouse or child dies | **Temporary** — lasts 8 turns; productivity −15%, opinion given ×0.5; on expiry: if `melancholic`, check for permanent scar |

### 3.8 New mental state traits (temporary)

Mental state traits are flagged with `isTemporary: boolean` in the data record. They expire after a set duration (stored as `traitExpiry: Record<TraitId, number>` on Person — a turn-number at which to remove the trait).

| ID | Name | Duration | Applied by | Effect while active |
|----|------|----------|------------|---------------------|
| `grieving` | Grieving | 8 turns | `melancholic`↔loss link; `bereaved`; chosen event consequences | All skills −5; council voice scoring muted (−50% magnitude) |
| `inspired` | Inspired | 6 turns | Fulfilled ambition; positive event chain completion | All skill growth +2/turn; productivity +15% |
| `restless` | Restless | Until ambition fires | Low ambition intensity + no change in role for 12 turns | Opinion of settlement −5/turn (capped at −30 total decay during episode); seeks `seek_spouse` or `seek_council` ambition preferentially |
| `traumatized` | Traumatized | 12 turns | Surviving a violence/combat event with injury | `brave`→`craven` opinion scoring; combat skill checks at −10; cannot hold `combat` role |
| `homesick` | Homesick | Until a shared-language person is present or 16 turns | `exile` + no-shared-language condition | Language learning rate ×0.7; opinion of all Imanian characters +5 (longing for the familiar) |

---

## 4. Trait Interaction Matrix (Expanded)

### 4.1 Conflict pairs (additions to the 8 existing pairs)

The existing 8 pairs in `trait-affinities.ts` are retained. New additions:

| Trait A | Trait B | Opinion penalty |
|---------|---------|----------------|
| `vengeful` | `forgiving` | −15 (one will resent; the other will forgive that, creating asymmetry) |
| `zealous` | `cynical` | −20 |
| `jealous` | `generous` (toward partner specifically) | −10 |
| `suspicious` | `trusting` | −12 |
| `stubborn` | `curious` | −10 |
| `contrarian` | `proud` | −12 |
| `company_man` | `honor_bound` (across cultural lines) | −15 |
| `outcast` | `gregarious` | −15 (attempted community; rejection) |
| `fickle` | `devoted` | −18 |
| `reckless` | `patient` | −10 |
| `melancholic` | `sanguine` | −8 (moods grate on each other) |
| `envious` | `wealthy` | applies per §3.3: −10 unidirectional, not symmetric |

### 4.2 Shared-trait bonuses (additions to the 7 existing entries)

| Trait | Shared bonus |
|-------|-------------|
| `devoted` | +12 (two devoted people deeply understand each other) |
| `curious` | +8 (intellectual kinship) |
| `honor_bound` | +10 (mutual respect for the code) |
| `vengeful` | −5 (actually clash — shared grudge mentality creates competition) |
| `zealous` | +10 (religious solidarity) |
| `protective` | +8 (mutual recognition of the instinct) |
| `melancholic` | +6 (shared understanding of grief) |
| `suspicious` | −8 (mutual suspicion of each other) |

---

## 5. Autonomous Behaviour System

This is the engine that makes traits *felt* between events. It operates in five pillars, each running in `processDawn()`.

### 5.1 Pillar 1 — Event weight modifiers

The `drawEvents()` function already accepts a `weightBoosts` parameter. This pillar populates that map each dawn based on who is in the settlement.

```typescript
function computeTraitWeightBoosts(
  people: Map<string, Person>,
  buildings: BuiltBuilding[],
): Record<string, number>
```

| Settlement condition | Event weight delta |
|---------------------|--------------------|
| Any `wrathful` person alive | `bld_bitter_quarrel` +2, domestic quarrel events +1.5 |
| Any `zealous` person alive | Religion tension events +2 |
| Any `curious` person alive | Cultural exchange events +2, language events +1.5 |
| Any `devout` + any `skeptical` alive | `cul_religious_tension_peaks` +2 |
| Any `jealous` person + multi-wife household | `hh_wife_council_demands` +2 |
| Any `greedy` person in `bargaining` or `trader` role | `eco_passing_merchant` +1.5 |
| Any `melancholic` person in `grieving` mental state | `dom_weight_of_distance` +2 |
| Any `suspicious` person on council | Company events +1 (distrusts the institution) |
| Any `vengeful` person with opinion < −50 of another | Inter-personal conflict events +3 |
| Any `mentor_hearted` person in settlement | Education/training events +2 |
| Any `storyteller` earned trait present | `cul_*` cultural events +1 |
| Any `outcast` person present | Social tension events +2 |

Weight deltas are **additive**. Multiple matching people stack (e.g. two `wrathful` persons → `bld_bitter_quarrel` +4).

### 5.2 Pillar 2 — Per-turn opinion autonomy

Beyond the existing `applyOpinionDrift` (culture/language drivers), these trait-based adjustments fire each dawn in a new `applyTraitOpinionEffects()` pass.

```typescript
function applyTraitOpinionEffects(
  people: Map<string, Person>,
): Map<string, Person>
```

Rules:

| Actor trait | Target condition | Per-turn delta | Notes |
|-------------|-----------------|---------------|-------|
| `jealous` | Any person competing for spouse's attention | −2/turn | "Competing" = same-sex, married to husband, or has `lustful` + high opinion of husband |
| `envious` | Wealthiest person in settlement | −3/turn | Applies only if actor has neither `wealthy` nor `indebted` |
| `suspicious` | Any person known < 4 turns | −1/turn | Dissipates after the person has been present 4+ turns |
| `charming` | All persons in settlement | +0.5/turn to *others'* opinion of this person | Passive charisma radiation |
| `devoted` | Spouses / household members | Opinion decay rate ×0.3 (applied in `decayOpinions`) | Not a delta; a rate modifier |
| `protective` | Household members | +1/turn | Small but consistent warmth |
| `contrarian` | Council-seat holder | −1/turn | Mild institutional resentment |
| `mentor_hearted` | Person being mentored (youngest or lowest skill in household) | +1/turn | Affection for their student |
| `vengeful` | Anyone who gave opinion < −20 modifier in last 20 turns | Opinion modifier decay halved | Grudges linger |
| `trusting` | Any person whose opinion-given-to-them is > +30 | +1/turn | Warmth toward those who like them |
| `company_man` | Anyone with Sauromatian heritage > 50% | −0.5/turn | Institutional prejudice, slow but cumulative |

**Implementation note**: These are applied *after* the main opinion drift pass and *before* decay. They operate on the primary `relationships` Map, not `opinionModifiers`, since they represent persistent character attitudes rather than event experiences.

### 5.3 Pillar 3 — Earned trait acquisition

Each dawn, persons are checked against acquisition conditions for a shortlist of earned traits. Acquisition uses the seeded RNG. Once acquired, a trait is permanent unless a specific `remove_trait` consequence fires.

```typescript
function checkEarnedTraitAcquisition(
  person: Person,
  state: GameState,
  rng: SeededRNG,
): TraitId | null
```

| Earned trait | Acquisition condition | RNG chance |
|-------------|----------------------|-----------|
| `respected_elder` | Age ≥ 60, leadership > 50, no `outcast` | 15%/turn (fires once) |
| `outcast` | Average opinion held by living people < −40, population ≥ 8 | 10%/turn |
| `bereaved` | Spouse ID is now in graveyard (checked each dawn) | 100% (deterministic) |
| `exile` | Person's birth culture differs from settlement primary culture and they arrived as an adult | 100% (deterministic, checked once) |
| `restless` (mental) | No role change in 12 turns, ambition intensity > 0.6 | 20%/season |
| `traumatized` (mental) | Survived `wound_person` consequence last 2 turns | 50% per wound |
| `inspired` (mental) | Ambition fulfilled this turn | 100% (deterministic) |
| `grieving` (mental) | Spouse or child just died; or `melancholic` + failed ambition | 100% / 60% |

Event-driven acquisition (via `add_trait` consequence) is the primary route for: `healer`, `midwife`, `storyteller`, `negotiator`, `kinslayer`, `ghost_touched`, `blessed_birth`, `veteran`, `hero`, `coward`, `scarred`.

### 5.4 Pillar 4 — Trait-driven skill growth

The existing `getSkillGrowthBonuses()` in `building-effects.ts` handles building-driven growth. A new parallel pass handles trait-driven growth each dawn.

```typescript
function getTraitSkillGrowthBonuses(
  person: Person,
  state: GameState,
): Partial<PersonSkills>
```

| Trait | Skill growth bonus (/season) | Condition |
|-------|------------------------------|-----------|
| `curious` | +1 to lowest skill bracket (mirrors learning impulse) | Always |
| `green_thumb` | +2 `plants` | While in `farmer` or `gather_food` role |
| `keen_hunter` | +2 `animals`, +1 `combat` | While in `gather_food` role (hunting-focused) |
| `gifted_speaker` | +1 `bargaining`, +1 `leadership` | While in `trader` or council role |
| `veteran` | +1 `combat` | Always, up to a cap of 85 |
| `mentor_hearted` | +1 to mentor's `custom` skill | While in `custom` role |
| `inspired` (mental) | +2 to all skills | While active |
| `grieving` (mental) | −1 to all skills | While active |
| `respected_elder` | +1 `custom`, +1 `leadership` | Always, age ≥ 60 |

### 5.5 Pillar 5 — Trait-driven health and productivity

These are additions to the per-person health calculations in `processDawn()`.

| Trait | Door into existing code | Effect |
|-------|------------------------|--------|
| `reckless` | Mortality/wound check | 5%/season chance of minor self-inflicted wound (roll `wound_person` equivalent) |
| `iron_constitution` | Disease chance | ×0.3 (stacks with `robust` multiplicatively: net ×0.15) |
| `hardworking` *(new aptitude, see §3.6)* | Production | +10% personal food/goods output but +5% disease chance |
| `grieving` (mental) | Production | −15% to personal production |
| `inspired` (mental) | Production | +15% to personal production |
| `melancholic` + `isolated` condition | Mortality (old age only) | +20% age-mortality when alone (no household, low opinion) |

---

## 6. Trait Inheritance Engine

The `inheritWeight` field on `TraitDefinition` has never been consumed. This system activates it.

### Rules

1. **Aptitude only** — personality, cultural, and earned traits are *not* inherited. Mental traits are never inherited.
2. **Both parents checked** — if either parent has the trait, it rolls. If both parents have it, the weight is doubled (capped at 0.9).
3. **Applied in `resolveInheritance()`** — after genetics are computed, iterate aptitude traits on both parents.
4. Conflicting traits are resolved: if the child would inherit both `robust` and `sickly`, pick the one with the higher combined parent weight.

```typescript
function inheritAptitudeTraits(
  mother: Person,
  father: Person,
  rng: SeededRNG,
): TraitId[]
```

### Proposed inheritance weights

| Trait | `inheritWeight` |
|-------|----------------|
| `strong` / `weak` | 0.25 |
| `robust` | 0.35 |
| `sickly` | 0.30 |
| `clever` / `slow` | 0.30 |
| `fertile` / `barren` | 0.20 |
| `beautiful` / `plain` | 0.20 |
| `iron_constitution` | 0.35 |
| `green_thumb` | 0.20 |
| `keen_hunter` | 0.20 |
| `gifted_speaker` | 0.20 |
| `fleet_footed` | 0.15 |

Personality traits are *shaped* by genetics (e.g. a child of two `brave` parents gets a +10 to `combat` in `generatePersonSkills`) but does not directly inherit the label.

---

## 7. `data/trait-definitions.ts` — The Data Catalog

This file needs to be created. It is the single authoritative registry of all traits, consumed by: UI tooltips, council advice scoring, event authoring tools, and the new autonomous behaviour engine.

### Structure

```typescript
import type { TraitDefinition } from '../simulation/personality/traits';

export const TRAIT_DEFINITIONS: Readonly<Record<TraitId, TraitDefinition>> = {
  ambitious: {
    id: 'ambitious',
    name: 'Ambitious',
    category: 'personality',
    description: 'Sets their sights high and chafes at limitation. Will not rest content.',
    conflicts: ['content'],
    effects: [
      { target: 'leadership_modifier', modifier: 0.12 },
    ],
    inheritWeight: undefined,
  },
  // ... (one entry per TraitId)
};
```

The `effects` array should be expanded to include all the targets from `TraitEffectTarget` — which itself needs to be significantly expanded to match the new system (see §8.1).

---

## 8. Interface Extensions Required

### 8.1 `TraitEffectTarget` extension (personality/traits.ts)

The current 10 targets are too narrow. Proposed additions:

```typescript
export type TraitEffectTarget =
  // existing:
  | 'combat_strength'
  | 'diplomacy'
  | 'trade_skill'
  | 'farming'
  | 'fertility_modifier'
  | 'health_modifier'
  | 'opinion_same_trait'
  | 'opinion_conflicting_trait'
  | 'cultural_resistance'
  | 'cultural_openness'
  // new:
  | 'language_learning_rate'    // multiplier applied to applyLanguageDrift rate
  | 'skill_growth_all'          // bonus applied to ALL skill growth ticks
  | 'skill_growth_combat'       // bonus to combat skill growth specifically
  | 'skill_growth_plants'
  | 'skill_growth_bargaining'
  | 'skill_growth_leadership'
  | 'production_modifier'       // multiplier on personal resource production
  | 'disease_chance_modifier'   // multiplier on sickness roll
  | 'mortality_modifier'        // multiplier for existing mortality calculation
  | 'event_weight_domestic'     // additive boost to domestic event weights
  | 'event_weight_cultural'
  | 'event_weight_religious'
  | 'event_weight_economic'
  | 'opinion_baseline_from_others'  // shift in how others initially perceive this person
  | 'opinion_decay_rate'            // multiplier on how fast this person's opinions decay
  | 'opinion_drift_spouse'          // per-turn opinion delta toward spouses
  | 'ambition_intensity_growth';    // multiplier on the 0.05/turn intensity growth
```

### 8.2 `Person` interface extension (population/person.ts)

```typescript
interface Person {
  // ... existing fields ...
  
  /**
   * Temporary mental-state trait expiry map.
   * Key: TraitId of a mental/temporary trait.
   * Value: Turn number on which the trait should be automatically removed.
   * Only populated when the person holds one or more temporary traits.
   */
  traitExpiry?: Partial<Record<TraitId, number>>;
}
```

### 8.3 `TraitId` union extension (personality/traits.ts)

Add all new trait IDs listed in §3.3–3.8 to the union.

### 8.4 `DawnResult` extension (turn-processor.ts)

```typescript
interface DawnResult {
  // ... existing fields ...
  
  /** Person IDs that gained or lost a trait this dawn (from autonomous acquisition). */
  traitChanges: Array<{ personId: string; gained?: TraitId; lost?: TraitId }>;
}
```

---

## 9. Event Authoring Opportunities

The expanded trait system unlocks a class of events that have been impossible to write so far: **character-specific events** where the actor's *personality* drives what happens, not just their role or skill.

### 9.1 New `hasTrait` usage in `actorRequirements`

```typescript
// Example: a wrathful man snaps at a household member
actorRequirements: [
  { slot: 'aggressor', required: true, criteria: { hasTrait: 'wrathful', sex: 'male' } },
  { slot: 'target', required: true, criteria: { sex: 'female' } },
]
```

### 9.2 New `has_person_matching` prerequisite with trait criteria

Already supported by the engine (the `has_person_matching` prerequisite delegates to `matchesCriteria`). Examples of new prerequisite patterns this enables:

```typescript
// Requires a jealous wife in a household
{ type: 'has_person_matching', params: { criteria: { hasTrait: 'jealous', maritalStatus: 'married', sex: 'female' } } }

// Requires a vengeful person with very low opinion of someone
{ type: 'has_person_matching', params: { criteria: { hasTrait: 'vengeful' } } }
```

### 9.3 Proposed new event seeds (trait-driven)

| Event ID | Trigger traits | Scenario |
|----------|---------------|----------|
| `per_jealous_confrontation` | `jealous` wife + husband with 2+ spouses | The jealous wife confronts the newest addition to the household. Player chooses how to handle it. |
| `per_vengeful_night_deed` | `vengeful` + target opinion < −60 | A settler acts on a long-held grudge. |
| `per_melancholic_withdrawal` | `melancholic` + `grieving` present | A character withdraws from the community. Do you intervene or give them space? |
| `per_curious_visitor` | `curious` + tribe contact | A settler slips away to spend time with a tribe contact. Enriching but scandalous. |
| `per_contrarian_council` | `contrarian` + council seat | The contrarian blocks a council consensus. |
| `per_reckless_accident` | `reckless` | A colonist nearly gets themselves killed doing something reckless. |
| `per_mentor_takes_student` | `mentor_hearted` + teenager in household | A mentor-hearted adult formally takes a young person under their wing. |
| `per_storyteller_remembers` | `storyteller` + significant population loss | The storyteller preserves the memory of the dead, lifting community spirits. |
| `per_outcast_leaves` | `outcast` + opinion < −50 of everyone | The outcast considers leaving. Player option to ask them to stay. |
| `per_ghost_touched_vision` | `ghost_touched` + Sacred Wheel > 30% | A vision in the fire. Offers a ritual choice with religious tension effects. |

All of the above follow the existing event-definition pattern in `definitions/`. They use `actorRequirements` with `hasTrait` criteria.

---

## 10. UI Considerations

### 10.1 Trait display in PersonDetail

The current PersonDetail shows traits as plain text chips. With an expanded catalog, the UI should:

- Show a **category badge** (colour-coded: personality = amber, aptitude = blue, cultural = green, earned = purple, mental state = grey italic)
- Show a **tooltip** with the full `description` from `TRAIT_DEFINITIONS` + a concise effects summary
- Mental state traits show a **expiry countdown** badge: "Grieving (6t)"
- Earned traits show a small **acquisition note** in the tooltip: "Earned through..."

### 10.2 Trait badge in PeopleView

The PeopleView roster currently only shows the role badge. A second row of up to 3 trait chips (most distinctive traits) would help players recognise character personalities at a glance without opening PersonDetail.

### 10.3 Opinion tooltip enhancement

`computeOpinionBreakdown()` already returns per-source breakdowns. When any entry is trait-driven and not from the static `TRAIT_CONFLICTS`/`TRAIT_SHARED_BONUS` affinities, label it clearly: `"[Jealous]: rival in household −12"`.

---

## 11. Implementation Roadmap

This is deliberately scoped into phases so each step is independently shippable.

### Phase T1 — Data foundation (estimated scope: medium)

1. Extend `TraitId` union with all 40 new trait IDs (§3.3–3.8)
2. Extend `TraitEffectTarget` (§8.1)
3. Add `traitExpiry` to `Person` interface (§8.2); deserialiser provides `?? undefined` fallback
4. Create `data/trait-definitions.ts` with full catalog (one entry per TraitId)
5. Add all new conflict pairs to `TRAIT_CONFLICTS` in `trait-affinities.ts` (§4.1)
6. Add all new shared bonuses to `TRAIT_SHARED_BONUS` in `trait-affinities.ts` (§4.2)
7. Add test coverage for: new conflict pairs produce correct opinion penalties; new shared bonuses produce correct bonuses

### Phase T2 — Autonomy engine (estimated scope: large)

1. Implement `computeTraitWeightBoosts()` (§5.1) — called by `drawEvents()` each dawn
2. Implement `applyTraitOpinionEffects()` (§5.2) — called after `applyOpinionDrift()` each dawn
3. Implement `getTraitSkillGrowthBonuses()` (§5.4) — called in existing skill growth pass
4. Extend `processDawn()` health/productivity pass for new trait effects (§5.5)
5. Add `traitChanges` to `DawnResult` (§8.4)
6. Unit tests for each new pillar function

### Phase T3 — Trait acquisition (estimated scope: medium)

1. Implement `checkEarnedTraitAcquisition()` (§5.3)
2. Wire into `processDawn()` — runs after health checks
3. Implement mental state expiry: each dawn, check `traitExpiry`, remove expired traits
4. Implement `inheritAptitudeTraits()` (§6) — wire into `resolveInheritance()`
5. Update `generatePersonSkills()` to incorporate new aptitude trait bonuses
6. Tests for: inheritance probability, mental state expiry, acquisition conditions

### Phase T4 — Event expansion (estimated scope: large)

1. Add `hasTrait` to at least 3 existing events in their `actorRequirements` (retrofit existing events to reward the richer trait pool)
2. Author 5 new personal trait-driven events from the list in §9.3
3. Author 5 more, targeting the settlement's earned trait holders
4. Add `add_trait` consequences to events that should create earned traits (`veteran` from combat events, `healer` from medicine events, etc.)
5. Wire `computeTraitWeightBoosts()` output into `drawEvents()` call in `turn-processor.ts`

### Phase T5 — UI polish (estimated scope: medium)

1. Category-coloured trait chips in PersonDetail (§10.1)
2. Expiry countdown on mental state traits (§10.1)
3. Trait chip row in PeopleView roster (§10.2)
4. Enhanced opinion breakdown tooltips for trait-driven entries (§10.3)
5. `data/trait-definitions.ts` descriptions proofread for lore consistency

---

## 12. Open Questions

These require a design decision before Phase T4 implementation begins:

1. **Trait cap at earned stage** — persons start with 2–4 traits. Should the hard cap be removed for earned traits, or set to a higher maximum (e.g. 8 total)? CK3 has no formal cap, but Palusteria's small population means individual character sheets are examined closely.

2. **Negative trait removal via events** — `oath_breaker`, `outcast`, `kinslayer`, `scandal` are permanent in the current design. Should there be any redemption arc mechanic? (e.g. 5+ years of positive opinion-building removes `outcast`?)

3. **Mental state trait stacking** — can a person be simultaneously `grieving` + `traumatized` + `restless`? The current design allows it. Is that too punishing?

4. **Personality trait assignment at birth** — currently fully random from the full pool. Should weight be given based on parents' traits (not direct inheritance but influence)? For example, two `brave` parents should produce a child more likely to be `reckless` or `brave` than `craven`.

5. **Trait visibility** — some traits (like `cynical`, `suspicious`, `deceitful`) would realistically be hidden until revealed through behaviour. Is a "hidden trait" system worth building, or is the added complexity unnecessary given the small settlement scale?

---

## 13. Lore Notes for Authors

When writing trait descriptions and event text for the new traits, keep in mind:

- **`ghost_touched`** and **`blessed_birth`** are Sauromatian spiritual concepts from the Sacred Wheel tradition. The Ansberite Company would view these with suspicion or outright hostility. Characters with `company_man` + `ghost_touched` would be genuinely conflicted.
- **`honor_bound`** should feel Sauromatian-tribal rather than Imanian-chivalric. The code being honoured is one of *reciprocal obligation and debt* among the tribes — not abstract knightly virtue.
- **`folklorist`** characters are the living memory of a culture that has no writing. In a mixed settlement, a Kiswani folklorist and an Imanian one are preserving fundamentally incompatible histories. This is a source of pride, not conflict — until the settlement needs to pick a single story.
- **`exile`** applies to settlers who were *sent*, not who chose to come. A man who was quietly encouraged to leave his Imanian city carries a different weight than an adventurer seeking fortune.
- **`company_man`** is not just loyalty — it's institutional identity. The Company is *home* to this person. When the settlement struggles to meet quota, a `company_man` will feel personally ashamed, not merely inconvenienced.

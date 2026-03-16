# Immigration System — Design Document

## Overview

Immigration is the primary mechanism by which the settlement's population grows beyond its founding core. Rather than passive background growth, immigration is modelled as a player-facing decision: word of the settlement's prosperity spreads to nearby tribes and to Kiswani trade networks, and specific people arrive with specific motivations. The player chooses whether to welcome them and under what terms.

A key design principle: **prosperity is necessary but not sufficient**. Each immigrant type is drawn by a different lure — the bathhouse, the trading post, the smithy, medicine stockpiles, the palisade — and will not come unless that specific pull exists alongside general prosperity. This means the player shapes who arrives by choosing what to build.

---

## 1. Prosperity Score

A derived value computed on demand, not stored on `GameState`.

```
prosperityScore =
    completedBuildings.length × 3
  + floor(resources.food / 15)
  + floor(resources.goods / 8)
  + resources.gold × 2
  + floor(populationCount / 5)
```

### Representative values

| Settlement state | Approx score |
|-----------------|-------------|
| Starting camp, 8 settlers | ~10 |
| 4 buildings, basic resources, 12 settlers | ~20–25 |
| 8 buildings, moderate resources, 20 settlers | ~40–55 |
| 14 buildings, comfortable resources, 35 settlers | ~80+ |

### New prerequisite type: `min_prosperity`

Added to `EventPrerequisite` in `engine.ts` and handled in `checkPrerequisite` in `event-filter.ts`:

```typescript
{ type: 'min_prosperity', params: { value: 15 } }
```

Implementation: `computeProsperityScore(state: GameState): number` as a new export from `src/simulation/buildings/building-effects.ts`.

---

## 2. Bathhouse Building Chain

The bathhouse is a new `social` category building introduced in three tiers. It is the settlement's most powerful immigration lure for Sauromatian women, providing superior essence-access in a cultural framework they already accept. It also confers happiness bonuses and a modest fertility boost.

Note: `'bathhouse_culture'` is already declared as a `CulturalPracticeId` in `game-state.ts`, anticipating this feature.

### Tier 1 — `bathhouse`

| Field | Value |
|-------|-------|
| Category | `social` |
| Requires | `gathering_hall` |
| Cost | 15 lumber · 5 stone · 5 goods |
| Build time | 2 seasons |
| Shelter | 0 |
| Worker role | `bathhouse_attendant` *(new WorkRole)* |
| Worker slots | 2 |

**Effects:**
- Happiness `+8` for all Sauromatian-heritage women in the settlement (new `social` happiness factor: `bathhouse_access`)
- `fertilityBonus: 0.05` — applies a +5% flat bonus to all conception rolls within the settlement
- Activates the `bathhouse_culture` cultural practice marker (already in `CulturalPracticeId`)
- Enables the `imm_wildborn_bathhouse_woman` immigration event
- Culture pull: `sauromatian` at strength `0.003` per person per season (subtle pull toward native blend)

### Tier 2 — `bathhouse_improved`

| Field | Value |
|-------|-------|
| Category | `social` |
| Requires | `bathhouse` |
| Replaces | `bathhouse` |
| Cost | 20 lumber · 10 stone · 8 goods |
| Build time | 2 seasons |
| Worker slots | 3 |

**Effects (replaces Tier 1):**
- Happiness `+12` for Sauromatian-heritage women
- `fertilityBonus: 0.10` (+10% conception)
- Doubles weight of the `imm_wildborn_bathhouse_woman` immigration event
- Culture pull: `sauromatian` at strength `0.005`

### Tier 3 — `bathhouse_grand`

| Field | Value |
|-------|-------|
| Category | `social` |
| Requires | `bathhouse_improved` |
| Replaces | `bathhouse_improved` |
| Cost | 30 lumber · 15 stone · 10 goods · 5 gold |
| Build time | 3 seasons |
| Worker slots | 4 |

**Effects (replaces Tier 2):**
- Happiness `+16` for Sauromatian-heritage women; `+5` for all women (comfort and civic pride)
- `fertilityBonus: 0.15` (+15% conception)
- Triples the weight of the wildborn woman immigration event
- Enables `imm_wildborn_bathhouse_woman` to spawn **two** immigrants instead of one
- Culture pull: `sauromatian` at strength `0.008`

### `BuildingId` additions

```typescript
| 'bathhouse'
| 'bathhouse_improved'
| 'bathhouse_grand'
```

### `fertilityBonus` on `BuildingDef`

New optional field:

```typescript
/**
 * Additive bonus to the conception chance roll, applied settlement-wide.
 * E.g. 0.05 = +5% on top of the base fertility rate.
 * Stacks with other building bonuses up to a cap of +0.25.
 */
fertilityBonus?: number;
```

Consumed in `attemptConception()` in `fertility.ts` — sum all `fertilityBonus` values from completed buildings, cap at `0.25`, and add to the base `fertilityChance` before the roll.

### `bathhouse_attendant` — new `WorkRole`

Added to the `WorkRole` union. Workers assigned to this role provide no direct resource production; instead they act as the `workerRole` counted against the bathhouse's `workerSlots`. They receive a small `bargaining` and `leadership` skill growth (+1/season each) from the interpersonal nature of the work.

---

## 3. Immigration Events

All five events live in a new file: `src/simulation/events/definitions/immigration.ts`.

They share these design rules:
- Category: `'immigration'` *(new `EventCategory` value in `engine.ts`)*
- All are **non-ambient** (`isAmbient: false`) — they carry narrative weight and should never be silently rate-limited
- All use `add_person` consequences with baked-in cultural profiles
- All have a **reject** choice with zero consequences (the player is never forced to accept settlers)
- Where appropriate, accepting triggers a tribe disposition effect

The `add_person` consequence already supports `sex`, `ethnicGroup`, `minAge`, `maxAge`, `socialStatus`, and `religion` params; it will need one additional param: `initialSkillBoosts` — an optional `Partial<PersonSkills>` that overrides the Gaussian default for specific skills, allowing us to represent an experienced herbalist or a seasoned warrior without explicit person archetypes.

---

### Event 1 — `imm_kiswani_traders_settle`

**Title:** *River Traders Ask to Put Down Roots*

**Lure:** Trading Post (commercial infrastructure signals safe transit and contract enforcement)

**Cultural profile:** 2 settlers — 1 `kiswani_riverfolk` male (age 22–38), 1 `kiswani_riverfolk` female (age 20–35); both Wheel-adjacent (`sacred_wheel`); strong `bargaining` skills (+15 above Gaussian baseline).

**Prerequisites:**
```typescript
[
  { type: 'has_building', params: { buildingId: 'trading_post' } },
  { type: 'min_prosperity', params: { value: 15 } },
  { type: 'season_is', params: { season: 'summer' } },
]
```

**Weight:** 2 · **Cooldown:** 12 · **isUnique:** false

**Choices:**

| Id | Label | Consequences |
|----|-------|-------------|
| `offer_residency` | Welcome them. Offer permanent residency and a stall in the trading post. | `add_person ×2 (kiswani_riverfolk)` · `modify_resource goods +6` · `modify_tribe_disposition +5` for any kiswani tribe |
| `company_register` | Accept them, but require they register with the Company as free settlers. | `add_person ×2 (kiswani_riverfolk)` · `modify_company_standing +3` (they become a taxable asset) |
| `decline` | Thank them for the visits. The settlement isn't ready for more mouths. | — |

---

### Event 2 — `imm_wildborn_bathhouse_woman`

**Title:** *A Wildborn Woman Asks to Stay*

**Lure:** Bathhouse — she has attended market days, used the bathhouse, and experienced what tribal territory cannot offer.

**Narrative hook:** Building on the lore's observation that wildborn women are converted to settlement life not by abstract promises but by the concrete provision of something they could not access at home. The event fires *after* she has already been visiting; the player's choice is whether to formalise her stay.

**Cultural profile:** 1 Sauromatian woman — `ethnicGroup` derived from the tribal contact with highest disposition among Sauromatian tribes; age 18–32; `sacred_wheel`; `plants` skill +10 above baseline (herbalism knowledge from tribal life).

**Prerequisites:**
```typescript
[
  { type: 'has_building', params: { buildingId: 'bathhouse' } },
  { type: 'min_prosperity', params: { value: 10 } },
  // At least one Sauromatian tribe with established contact
  { type: 'has_person_matching', params: { hasTrait: 'sauromatian_born' } }, // OR min tribal contact check
]
```

Actual prerequisite for tribal contact: a new `has_tribe_contact` prerequisite type (see §5 below), or alternatively gate this on `cultural_blend_above: 0.20` since contact is implied.

**Weight:** 3 (× tier multiplier from bathhouse tier: ×1/×2/×3) · **Cooldown:** 8 · **isUnique:** false

**Choices:**

| Id | Label | Consequences |
|----|-------|-------------|
| `welcome_her` | Invite her to stay permanently. She can work here and is under the settlement's protection. | `add_person ×1 (sauromatian)` · tribe disposition `+3` for her home tribe (they see it as an alliance gesture) |
| `offer_bathhouse_role` | Invite her to stay specifically as a bathhouse attendant. | `add_person ×1 (sauromatian, role: bathhouse_attendant)` · happiness boost for settlement's existing Sauromatian women `+2` (word spreads that she was welcomed) · tribe dispo `+3` |
| `decline_gently` | Wish her well. She is welcome to continue visiting. | tribe dispo `-2` (she reports back that the door was closed) |

---

### Event 3 — `imm_tribal_family_refuge`

**Title:** *A Family Seeks Shelter Within Your Walls*

**Lure:** Palisade — word has spread that the settlement has walls. In a region of raids, necromancers, and inter-tribal violence, walls mean survival.

**Cultural profile:** 2 settlers — 1 `hanjoda_emrasi` male (25–40), 1 `hanjoda_emrasi` female (20–35); `sacred_wheel`; `combat` skill +8 for the male (warrior background). May be presented as a household unit.

**Narrative hook:** Their tribe suffered a raid or famine; they departed rather than compete for scarce resources. The settlement's visible defences are the deciding factor.

**Prerequisites:**
```typescript
[
  { type: 'has_building', params: { buildingId: 'palisade' } },
  { type: 'min_prosperity', params: { value: 12 } },
]
```

**Weight:** 2 · **Cooldown:** 10 · **isUnique:** false

**Choices:**

| Id | Label | Consequences |
|----|-------|-------------|
| `grant_refuge` | Take them in. They are under the settlement's protection. | `add_person ×2 (hanjoda_emrasi)` · `modify_opinion` toward all Hanjoda-heritage settlers `+5` (shared kin feeling) |
| `grant_refuge_probation` | Accept them on a season's probation. They earn full standing after demonstrating loyalty. | `add_person ×2 (hanjoda_emrasi, socialStatus: 'newcomer')` |
| `turn_them_away` | The settlement cannot take every desperate family. | `modify_all_tribe_dispositions -3` (word travels) |

---

### Event 4 — `imm_steel_seeking_warrior`

**Title:** *A Warrior Comes for the Steel*

**Lure:** Smithy — the settlement's metalworking reputation has travelled through Hanjoda trade routes. Access to steel weapons as personal property is one of the most powerful individual draws in the lore.

**Cultural profile:** 1 `hanjoda_bloodmoon` female warrior (22–38); `sacred_wheel`; `combat` skill +20 above Gaussian baseline (she is genuinely experienced); `brave` trait pre-assigned.

**Narrative hook:** She has arrived alone, which marks her as either exiled, ambitious, or both. She wants access to steel and offers her martial skills to the settlement's defence.

**Prerequisites:**
```typescript
[
  { type: 'has_building', params: { buildingId: 'smithy' } },
  { type: 'min_prosperity', params: { value: 20 } },
]
```

**Weight:** 2 · **Cooldown:** 16 · **isUnique:** false

**Actor requirements:** `{ slot: 'negotiator', criteria: { sex: 'male', minSkill: { skill: 'bargaining', value: 26 } } }` — someone needs to negotiate the terms.

**Choices:**

| Id | Label | Consequences |
|----|-------|-------------|
| `offer_steel_for_service` | Accept her, and agree that she earns steel through service — not as a gift. | `add_person ×1 (hanjoda_bloodmoon, combat +20, brave)` · `modify_all_tribe_dispositions -5` on Hanjoda tribes (she is now outside their chain of gifting) |
| `offer_membership` | Welcome her as a full settler with equal standing and no strings. She may use the smithy. | `add_person ×1 (hanjoda_bloodmoon)` · `modify_resource steel -2` (a demonstration gift) · tribe dispo `-3` |
| `decline` | The settlement's steel is not for trading away. Send her elsewhere. | No consequence |

---

### Event 5 — `imm_sauromatian_midwife`

**Title:** *A Healer Comes to See Your Medicine*

**Lure:** Healer's Hut + medicine stockpile — Imanian surgical knowledge and maternal medicine are draws that tribal herbalism cannot replicate. An older Sauromatian woman, whose knowledge of plants is deep, has been watching your settlement's medicine practices from a distance.

**Cultural profile:** 1 Sauromatian woman (`kiswani_haisla`; age 35–52); `sacred_wheel`; `plants` skill +25 above Gaussian baseline; moderate `custom` (traditional knowledge); `healer` trait pre-assigned (she already has the quality, she merely lacks the equipment).

**Narrative hook:** She is not seeking essence or protection — she is curious about the medicine. The question is whether she will share her knowledge or merely observe.

**Prerequisites:**
```typescript
[
  { type: 'has_building', params: { buildingId: 'healers_hut' } },
  { type: 'has_resource', params: { resource: 'medicine', amount: 5 } },
  { type: 'min_prosperity', params: { value: 15 } },
]
```

**Weight:** 2 · **Cooldown:** 16 · **isUnique:** false

**Actor requirements:** `{ slot: 'healer', criteria: { minSkill: { skill: 'plants', value: 26 } } }` — a settler with some plant knowledge is needed for the conversation to be meaningful.

**Choices:**

| Id | Label | Consequences |
|----|-------|-------------|
| `welcome_and_share` | Invite her to stay. Share your medical knowledge freely; she will share hers. | `add_person ×1 (kiswani_haisla, plants +25, healer trait)` · `modify_resource medicine +4` (her initial contribution) · `childMortality` further reduced (her presence in the Healer's Hut stacks a secondary 0.8× modifier — new `BuildingEffect` on the person rather than on the building def) |
| `welcome_observe_only` | She may stay but the settlement's medical methods are Company proprietary. | `add_person ×1 (kiswani_haisla, plants +25, healer trait)` · no medicine bonus |
| `decline_respectfully` | You appreciate the interest, but the settlement is not ready to integrate a new practitioner. | No consequence |

---

## 4. New `EventCategory` value

```typescript
// In engine.ts:
export type EventCategory =
  | 'domestic'
  | 'cultural'
  | 'economic'
  | 'environmental'
  | 'diplomacy'
  | 'building'
  | 'religious'
  | 'identity'
  | 'happiness'
  | 'wedding'
  | 'immigration';  // ← new
```

---

## 5. New `EventPrerequisite` types

### `min_prosperity`

```typescript
{ type: 'min_prosperity', params: { value: number } }
```

Checked against `computeProsperityScore(state)` in `building-effects.ts`.

### `has_tribe_contact` *(optional — may be deferred)*

```typescript
{ type: 'has_tribe_contact', params: { ethnicGroup?: EthnicGroup } }
```

Returns true if at least one tribe with matching `ethnicGroup` has `contactEstablished === true`. If `ethnicGroup` is omitted, any contacted tribe suffices.

---

## 6. `add_person` consequence — new params

Two new optional params on the existing `add_person` consequence handler in `resolver.ts`:

| Param | Type | Purpose |
|-------|------|---------|
| `initialSkillBoosts` | `Partial<PersonSkills>` | Added on top of generated skills; represents experience |
| `initialTraits` | `TraitId[]` | Pre-assigned traits (e.g. `'brave'`, `'healer'`) |

These let event definitions bake in a cultural archetype without needing a separate person-template system.

---

## 7. Wildborn Visitor State — deferred for Phase 5

The "wildborn visitor attendance" loop described in the lore — where repeated market-day visits gradually convert wildborn women into settlers — requires a persistent `wildbornVisitors` array on `GameState` and a market-day drip event feeding it. This is architecturally sound but adds new state, serialisation logic, and a new UI indicator.

**Deferred to Phase 5** to keep this implementation focused. For now the `imm_wildborn_bathhouse_woman` event represents the *result* of that process rather than modeling the process itself in real-time.

A future `WildbornVisitor` entry would contain:
```typescript
interface WildbornVisitor {
  id: string;
  name: string;
  profile: { ethnicGroup: EthnicGroup; age: number; religion: ReligionId; skills: PersonSkills };
  tribeId: string;
  firstVisitTurn: number;
  visitsCount: number;  // increments each time the market-day event fires for them
  settleMindedTurn: number | null; // set when visits ≥ 3; triggers the settle decision event
}
```

---

## 8. Implementation Checklist

| Step | File(s) | Notes |
|------|---------|-------|
| Add `bathhouse`, `bathhouse_improved`, `bathhouse_grand` to `BuildingId` | `game-state.ts` | 3 new union members |
| Add `fertilityBonus?: number` to `BuildingDef` | `building-definitions.ts` | New optional field |
| Add `bathhouse_attendant` to `WorkRole` | `person.ts` | With label/colour in `role-display.ts` |
| Add all three bathhouse definitions to `BUILDING_CATALOG` | `building-definitions.ts` | Per §2 above |
| Consume `fertilityBonus` in `attemptConception()` | `fertility.ts` | Sum across buildings, cap 0.25 |
| Add happiness factor `bathhouse_access` for Sauromatian women | `happiness.ts` | Keyed on `has_building: bathhouse*` + heritage check |
| Export `computeProsperityScore(state)` | `building-effects.ts` | Formula in §1 |
| Add `min_prosperity` to `EventPrerequisite` | `engine.ts` | New union member |
| Handle `min_prosperity` in `checkPrerequisite` | `event-filter.ts` | Calls `computeProsperityScore` |
| Optionally add `has_tribe_contact` prerequisite | `engine.ts` + `event-filter.ts` | Can fall back to `cultural_blend_above` check for now |
| Add `immigration` to `EventCategory` | `engine.ts` | New union member |
| Add `initialSkillBoosts` + `initialTraits` params to `add_person` handler | `resolver.ts` | Extend existing handler |
| Create `src/simulation/events/definitions/immigration.ts` | — | 5 events per §3 |
| Import and spread `IMMIGRATION_EVENTS` into `ALL_EVENTS` | `event-filter.ts` | Alongside existing spreads |
| Add `IMMIGRATION_EVENTS` to `council-advice.ts` category scoring | `council-advice.ts` | Use same weights as `economic` |
| Update `CLAUDE.md` with Phase 4.3 entry | `CLAUDE.md` | Post-implementation |

---

## 9. Out of scope for this pass

- Tribe-initiated group migration events (e.g. an entire sub-clan relocating)
- Company-sponsored settler shipments (handled by the existing company events)
- Player-initiated recruitment from specific tribes via the Trade screen
- The full `WildbornVisitor` state machine (deferred to Phase 5 — see §7)
- Any changes to the existing `eco_passing_merchant` event

# Religion System — Design & Implementation Plan

**Feature:** §9.2 — Three Traditions  
**Phase:** 3 (Living Settlement) → extends into Phase 4  
**Status:** Planned

---

## Overview

Three religious traditions coexist in the settlement. Each shapes individual wellbeing, community harmony, Company relations, and the long arc of settlement identity. Religion is not a menu choice — it emerges from who is present, who marries whom, and how the player responds to tension when it arises.

| Faith | `ReligionId` | Source |
|-------|-------------|--------|
| Imanian Solar Church | `imanian_orthodox` | Founding male settlers, Company imports |
| Sauromatian Sacred Wheel | `sacred_wheel` | Indigenous women, new arrivals from tribes |
| Hidden Wheel (Syncretic) | `syncretic_hidden_wheel` | Emerges in place — never imported, always grown |

`irreligious` is removed from `ReligionId` this phase. It was reserved but is too niche and complicates the tension formula. Three faiths are sufficient.

---

## Lore Summary

### The Solar Church (Imanian Orthodox)

The dominant faith of the Kingdom of Imani, centred on **the Radiant One** — a single God manifesting through Seven Faces (Dawn, Zenith, Dusk, Midnight, Summer, Winter, Eternal). The priesthood is male-only, hierarchical, and firmly backed by the Ansberry Company. Colonial clergy developed a "Temporary Necessity" doctrine to accommodate female warriors in Palusteria — a "temporary" exception that quietly became permanent, breeding generational tension back home.

The Church regards Sauromatian practices as sincere but misdirected — animism worshipping manifestations of the Radiant One without knowing His true name. The syncretic synthesis (Hidden Wheel) is more troubling: it treats both faiths as equals.

### The Sacred Wheel (Sauromatian Animism)

A matriarchal, fertility-focused faith centred on **Kethara the War-Mother** and a web of fertility gods and minor spirits. The 6:1 gender ratio is not a curse but sacred design — Kethara's Bargain gave women strength and imposed the commandment to keep birthing. Every pregnancy is a victory over extinction; every ceremony honours the ongoing pact.

The Wheel has no central hierarchy — it is endlessly adaptive and resistant to suppression by design.

### The Hidden Wheel (Syncretic)

The faith neither tradition officially approves but both partly created. It emerges when Orthodox and Wheel communities live alongside each other long enough. Imanian saints are mapped onto Sauromatian spirits (Saint Kethara the Shield-Mother; Saint Vorthaan the Stormvoice). Solar ceremonies acquire seasonal undertones; Wheel ceremonies gain the language of divine light.

It cannot be imported. It has no governing body. Followers don't declare conversion — they simply start doing things slightly differently, until one day their children are practising something that neither grandmother would fully recognise.

---

## Data Model Changes

### 1. Remove `irreligious`

`ReligionId` becomes a three-value union in `src/simulation/population/person.ts`:

```typescript
export type ReligionId =
  | 'imanian_orthodox'
  | 'sacred_wheel'
  | 'syncretic_hidden_wheel';
```

### 2. `SettlementCulture` additions (game-state.ts)

```typescript
/**
 * Consecutive turns where both imanian_orthodox ≥ 15% AND sacred_wheel ≥ 15%.
 * Reaches 20 (5 in-game years) → fires the Hidden Wheel emergence event and resets.
 * Frozen at current value while hiddenWheelSuppressedTurns > 0.
 * Resets to 0 if either faith drops below threshold.
 */
hiddenWheelDivergenceTurns: number;

/**
 * Remaining cooldown turns after the player suppresses emergence.
 * While > 0, hiddenWheelDivergenceTurns does not advance.
 */
hiddenWheelSuppressedTurns: number;

/**
 * True once the player has acknowledged or recognised the Hidden Wheel.
 * Enables conversion events and (if policy = hidden_wheel_recognized) active spread.
 */
hiddenWheelEmerged: boolean;
```

### 3. `Settlement` addition + new type (game-state.ts)

```typescript
/** The player's current religious mandate for the settlement. */
religiousPolicy: ReligiousPolicy;

export type ReligiousPolicy =
  | 'tolerant'                  // Default. No enforcement.
  | 'orthodox_enforced'         // Wheel ceremonies restricted. Company approves.
  | 'wheel_permitted'           // Wheel ceremonies officially recognised.
  | 'hidden_wheel_recognized';  // Syncretic faith given formal standing.
```

---

## Religious Tension Formula

New `computeReligiousTension(religions: Map<ReligionId, number>): number` in `culture.ts`,
called each `processDawn()`.

```
orthodoxFraction = religions.get('imanian_orthodox') ?? 0
wheelFraction    = religions.get('sacred_wheel') ?? 0
hiddenFraction   = religions.get('syncretic_hidden_wheel') ?? 0

rawTension    = 4 × orthodoxFraction × wheelFraction
              (peaks at 1.0 when 50/50 — identical structure to languageTension)

hiddenDamping = clamp(1 − hiddenFraction × 2, 0, 1)
              (Hidden Wheel at 50% completely damps tension)

religiousTension = rawTension × hiddenDamping
```

Key properties:
- Pure Orthodox or pure Wheel → tension = 0
- 50/50 Orthodox/Wheel split → tension = 1.0  
- 30/40/30 Orthodox/Wheel/Hidden split → tension ≈ 0.67  
- Equal three-way split → tension approaches 0 (Hidden Wheel absorbs friction)

---

## Company Religious Pressure

Applied **once per year in Winter `processDusk()`** — not per-turn. This makes it feel like an institutional letter of concern, not invisible drift.

```
wheelFraction = religions.get('sacred_wheel') ?? 0
THRESHOLD = 0.25

if wheelFraction > THRESHOLD AND policy !== 'orthodox_enforced':
  delta = −Math.floor((wheelFraction − THRESHOLD) × 10)
  delta = Math.max(delta, −5)   // hard cap
  apply to company.standing

if policy === 'hidden_wheel_recognized':
  delta × 2  (the Company finds syncretic compromise more offensive than open Wheel)
if policy === 'orthodox_enforced':
  delta = 0  (the mandate satisfies the Company)
```

Effective drain rates:

| Sacred Wheel fraction | Standing drain / year |
|----------------------|-----------------------|
| 35% | −1 |
| 50% | −2 |
| 65% | −4 |
| 80%+ | −5 (cap) |

A companion event `rel_company_concern_letter` fires when standing drops due to religion — gives the player explicit narrative of why.

---

## Hidden Wheel Emergence

### Threshold tracking

New `computeHiddenWheelDivergence(culture, religions)` in `culture.ts`, called each `processDawn()`:

1. If `hiddenWheelSuppressedTurns > 0` → decrement by 1; do **not** advance `hiddenWheelDivergenceTurns`
2. Else if Orthodox ≥ 15% **and** Wheel ≥ 15% **and** policy is not `orthodox_enforced`:
   - Increment `hiddenWheelDivergenceTurns`
   - If it reaches **20** → return `{ shouldFireEvent: true }`, reset counter to 0
3. Else → reset `hiddenWheelDivergenceTurns` to 0 (a gap resets the clock)

### Event: `rel_hidden_wheel_emerges` — "A Third Way"

> *People have lived side by side here long enough that something new has grown between the prayers. You hear it in the way Wheel-women speak of "the Sun-Wheel" and in the way Orthodox settlers invoke "Keth-Solim" without knowing what it means. Something is asking to exist.*

| Choice | Effect |
|--------|--------|
| **Let it grow — this is our own faith** | `hiddenWheelEmerged: true`, policy → `hidden_wheel_recognized`. Hidden Wheel can spread via conversion events. |
| **Acknowledge, but don't formalise** | `hiddenWheelEmerged: true`, policy stays `tolerant`. Spreads slowly via events. |
| **Suppress it** | `hiddenWheelSuppressedTurns = 30`. Clock frozen for 7.5 years. Company standing +1. Tension unchanged. |

---

## Religious Policy Effects

| Policy | Wheel ceremonies | Hidden Wheel spread | Company drain | Opinion effects |
|--------|-----------------|---------------------|--------------|-----------------|
| `tolerant` | Occur freely | Normal | Full rate | None |
| `orthodox_enforced` | Blocked (events gated by policy check) | Cannot emerge | Zero | Wheel followers −3 opinion of settlement per 10 turns |
| `wheel_permitted` | Freely | Normal | Full + −1/year flat | Sauromatian women +5 opinion of settlement (one-time) |
| `hidden_wheel_recognized` | Freely + Syncretic ceremonies | 2× speed | Full × 2 | Hidden Wheel +10 opinion; devout Orthodox −8 opinion |

Policy is set through event choices, the Religion panel in the Management UI, and certain diplomatic events with the Company or tribes. `hidden_wheel_recognized` requires `hiddenWheelEmerged: true`.

---

## Per-Faith Community Effects

Population fraction thresholds that apply simulation-level modifiers. These are computed multipliers, not per-person stored stats. They stack where noted.

### Sacred Wheel — "Kethara's Blessing"

| Threshold | Effect | Applied in |
|-----------|--------|-----------|
| ≥ 25% | Birth rate +4% | `getFertilityChance()` multiplier |
| ≥ 50% | Birth rate +10% total; female combat checks +5 | Fertility multiplier; skill check bonus |
| ≥ 75% | Birth rate +15% total; `traditional` women gain +5 opinion of each other | Fertility; opinion init |

**Mechanical identity: demography.** Settlements that embrace the Wheel genuinely grow faster — Kethara's Bargain made tangible.

### Imanian Orthodox — "Company Connections"

| Threshold | Effect | Applied in |
|-----------|--------|-----------|
| ≥ 25% | Company standing drain floored at −3/year (not −5) | Drain formula cap |
| ≥ 50% | Trade skill checks +5 settlement-wide; Company quota grace +10% | Skill check bonus; quota check |
| ≥ 75% | Company events become more favourable; chaplain events fire free standing bonuses | Event eligibility flag |

**Mechanical identity: institutional connections.** The Company trusts you; quotas hurt less.

### Hidden Wheel — "The Synthesis"

| Threshold | Effect | Applied in |
|-----------|--------|-----------|
| Any presence | `religiousTension` decays 25% faster each turn | Tension decay pass |
| ≥ 15% | Cross-cultural marriage `traditional` bystander penalties reduced 50% | Marriage opinion modifier |
| ≥ 35% | Religion-flavoured events offer a "Hidden Wheel synthesis" extra choice | Event filter addition |

**Mechanical identity: social cohesion.** The Hidden Wheel sands down the sharpest cultural edges.

---

## Per-Faith Individual Effects

### `devout` and `skeptical` trait interactions

| Trait + Religion | Effect |
|-----------------|--------|
| `devout` + `sacred_wheel` | +10% personal fertility modifier; +3 custom skill |
| `devout` + `imanian_orthodox` | +5 leadership skill; eligible for `priest_solar` role |
| `devout` + `syncretic_hidden_wheel` | +5 diplomacy (derived); bridges cultural opinion gaps more easily |
| `skeptical` + any | −5 on skill checks requiring faith-based community support |

### Opinion interactions (ties into the Opinions System)

- `devout` Sacred Wheel woman under `orthodox_enforced`: −10 opinion of settlement enforcers
- `devout` Orthodox man under `orthodox_enforced`: −15 opinion of public Sacred Wheel practitioners
- `devout` Hidden Wheel: −8 from `traditional` observers; +5 from `cosmopolitan` observers

---

## Priesthood Roles

Three values added to `WorkRole` in `person.ts`:

```typescript
| 'priest_solar'    // Male; produces Company / institutional bonuses
| 'wheel_singer'    // Female preferred; produces fertility bonuses
| 'voice_of_wheel'  // Any; produces tension reduction
```

### Eligibility

| Role | Requirements |
|------|-------------|
| `priest_solar` | Male; `imanian_orthodox`; age ≥ 25; leadership ≥ 30 |
| `wheel_singer` | Female (preferred, not locked); `sacred_wheel`; age ≥ 20; custom ≥ 30 |
| `voice_of_wheel` | `syncretic_hidden_wheel`; custom ≥ 40; `hiddenWheelEmerged: true` |

### Role effects (applied each `processDawn()`)

**Solar Priest**
- Once per year (Winter dawn): +1 company standing
- Unlocks Company-linked events (chaplain networks, trade introductions)
- Leadership score scales a small settlement leadership bonus

**Wheel-Singer**
- Each turn: all women gain a small fertility bonus ≈ `custom / 6000`
  (≈ +0.5% at skill 30 → ≈ +1.5% at skill 90)
- Required for high-end Sacred Wheel ceremony events to fire

**Voice of the Wheel**
- Once per season: absorbs one religious tension event before it surfaces to the player (mediates behind the scenes)
- `custom` score scales the Hidden Wheel damping bonus in the tension formula

---

## Event-Driven Adult Conversion

Children always inherit religion from their mother — this is unchanged and non-negotiable. Adults change religion only through specific story events. There is no gradual drift. Conversion is a moment, not erosion.

New `modify_religion` consequence type:

```typescript
// Added to ConsequenceType in engine.ts
| 'modify_religion'
// target = personId, value = ReligionId (string)
// Resolver: sets person.religion = value as ReligionId
```

Six new events in `src/simulation/events/definitions/religious.ts`:

---

### `rel_wheel_conversion_moment` — "An Orthodox Settler Is Moved"

**Prerequisites:** Orthodox follower present; Sacred Wheel fraction ≥ 30%; a Wheel ceremony event fired in the last 8 turns.

> *[Name] has been watching the Wheel ceremonies at the river for two seasons. You've noticed him bringing small offerings before dawn. He comes to you, uncertain.*

| Choice | Consequence |
|--------|-------------|
| **Encourage the change** | `modify_religion` → `sacred_wheel`. If `devout`: a rare devout Wheel man — remarkable within the settlement. |
| **Advise patience, don't forbid** | 50% chance they convert next season (deferred event). |
| **Discourage — the Company expects Orthodoxy** | Stays Orthodox. +5 their opinion of player. −5 their opinion of Wheel followers. |

---

### `rel_orthodoxy_crisis_of_faith` — "Doubt at the Edge of the World"

**Prerequisites:** Sacred Wheel woman present; Orthodox fraction ≥ 40%; current year ≥ 3.

> *[Name] was raised to the Wheel, but she has been living beside the Solar settlers for years. She tells you the Imanian prayers have begun to feel like hers, too. The Sun's warmth is the same warmth Kethara promised.*

| Choice | Consequence |
|--------|-------------|
| **Let her find her own path** | Converts to `imanian_orthodox` or (if `hiddenWheelEmerged`) `syncretic_hidden_wheel`. |
| **Introduce her to the Solar Church formally** | `modify_religion` → `imanian_orthodox`. Company standing +1. |
| **Remind her of what the Wheel means** | Stays Sacred Wheel. If `devout`, gains firm Wheel conviction marker. |

---

### `rel_hidden_wheel_adoption` — "Walking Both Paths"

**Prerequisites:** `hiddenWheelEmerged: true`; a person exists not yet on Hidden Wheel and not their community's majority faith.

> *[Name] has quietly stopped attending morning prayers — but hasn't gone to the river either. She is making something new.*

| Choice | Consequence |
|--------|-------------|
| **Welcome this** | `modify_religion` → `syncretic_hidden_wheel`. Under `hidden_wheel_recognized`, they may influence others. |
| **Don't interfere** | Converts quietly. No spread effect. |
| **Pull them back** | Person stays. +5 opinion of player from `devout` community members. |

---

### `rel_chaplain_arrives` — "A Chaplain on the Company Ship"

**Prerequisites:** Summer (Company ship season); Orthodox fraction < 50%.

> *The Company has sent a man of the cloth aboard this year's ship. Brother [Name] is here to minister to his straying flock — and he is examining your settlement's headcount with professional concern.*

| Choice | Consequence |
|--------|-------------|
| **Welcome him and let him work** | 1–2 Wheel settlers convert to Orthodox over next 4 turns. Company standing +3. |
| **Give him quarters, shield him from ceremonies** | No conversions. Standing +1. He leaves dissatisfied. |
| **Send him back on the ship** | Standing −3. He will report what he saw. |

---

### `rel_tension_eruption` — "It Comes to a Head"

**Prerequisites:** `religiousTension ≥ 0.75`; cooldown 12 turns.

> *A Solar prayer service and a Wheel ceremony were scheduled for the same morning. No one intended it. The confrontation was physical. Two people were hurt. The settlement is waiting to see what you do.*

| Choice | Consequence |
|--------|-------------|
| **Declare formal separation of worship days** | Tension −0.2. Structural solution. |
| **Back the Solar Church publicly** | Tension −0.1 (suppression). Wheel followers −10 opinion of settlement. Company standing +2. |
| **Back the Wheel practitioners publicly** | Tension −0.1 (suppression). Orthodox settlers −10 opinion of settlement. Company standing −2. |
| **Call it an accident and do nothing** | No cost. Event may re-fire in 6 turns. |

Cooldown: 12 turns after any resolution.

---

### `rel_company_concern_letter` — "The Company Notes Your Spiritual Condition"

**Prerequisites:** Company standing dropped due to religion formula this Winter (automatic companion event to the drain).

> *The annual dispatch includes a note from a Company secretary. Your expedition's spiritual condition has been noted among the directors.*

| Choice | Consequence |
|--------|-------------|
| **Send an Orthodox census report** | Drain formula uses the claimed Orthodox fraction next year instead of the real one. Works once per playthrough. |
| **Acknowledge and promise gradual normalisation** | Drain paused 4 turns. Player can break the promise. |
| **Respond defiantly — this is a frontier matter** | Standing −2 immediately. Drain suspended 8 turns. Sets a "defiant" flag the Company remembers. |

---

## Faith-Specific Buildings

Designed here; built in Phase 3 Step 11 (Settlement Buildings System). Uses the existing `Settlement.buildings: BuildingId[]` array.

| Building | `BuildingId` | Faith | Effect | Build Requirements |
|----------|-------------|-------|--------|-------------------|
| Solar Chapel | `solar_chapel` | Orthodox | +1 standing/year; enables `priest_solar` role; Orthodox community thresholds +50% | Stone 20, Lumber 10; Orthodox ≥ 40% |
| Sacred Wheel Shrine | `wheel_shrine` | Sacred Wheel | Wheel-Singer fertility bonus +50%; unlocks high-end Wheel ceremony events | Lumber 15; Sacred Wheel ≥ 35% |
| Syncretic Meeting House | `syncretic_meeting_house` | Hidden Wheel | Tension damping doubled; Voice of Wheel acts 2×/season | Lumber 20, Goods 10; `hiddenWheelEmerged: true`; Hidden Wheel ≥ 20% |

---

## Implementation Roadmap

### Phase A — Core Engine *(deliverable: religiousTension fires, Company pressure active)*

| Step | File | Work |
|------|------|------|
| 1 | `src/simulation/population/person.ts` | Remove `irreligious` from `ReligionId`; add priesthood roles to `WorkRole` |
| 2 | `src/simulation/turn/game-state.ts` | 3 new `SettlementCulture` fields; `ReligiousPolicy` type; `religiousPolicy` on `Settlement` |
| 3 | `src/simulation/population/culture.ts` | `computeReligiousTension()` and `computeHiddenWheelDivergence()` |
| 4 | `src/simulation/turn/turn-processor.ts` | Wire both into `processDawn()`; Company drain in Winter `processDusk()` |
| 5 | `src/stores/game-store.ts` | Initialise new fields; `setReligiousPolicy()` action; serialisation; `DawnResult` additions |

### Phase B — Conversion & Hidden Wheel Emergence *(depends on Phase A)*

| Step | File | Work |
|------|------|------|
| 6 | `src/simulation/events/engine.ts` | `'modify_religion'` consequence type; `'religious_policy'` and `'hidden_wheel_emerged'` prerequisite types |
| 7 | `src/simulation/events/resolver.ts` | Implement `modify_religion` case |
| 8 | `src/simulation/events/definitions/religious.ts` | **New file** — 6 events above |
| 9 | `src/simulation/events/event-filter.ts` | Add 6 events to `ALL_EVENTS`; evaluate new prerequisite types |

### Phase C — Priesthood Role Effects *(parallel with Phase B)*

| Step | File | Work |
|------|------|------|
| 10 | `src/simulation/turn/turn-processor.ts` | Per-dawn priesthood role effects pass (Solar Priest standing, Wheel-Singer fertility, Voice tension damping) |

### Phase D — Per-Faith Community Thresholds *(depends on Phase A)*

| Step | File | Work |
|------|------|------|
| 11 | `src/simulation/genetics/fertility.ts` | `getFertilityChance()` accepts `faithBonusMultiplier`; computed from settlement culture |
| 12 | `src/simulation/events/resolver.ts` | Apply trade/combat skill bonuses from faith thresholds on relevant skill checks |

### Phase E — UI *(parallel with Phase D)*

| Step | File | Work |
|------|------|------|
| 13 | New Religion sub-panel | Distribution bars (3 faiths), tension indicator, policy dropdown, priesthood slots, Hidden Wheel progress counter |
| 14 | `src/ui/views/PersonDetail.tsx` | Faith-coloured religion label; priesthood role display |
| 15 | `src/ui/overlays/MarriageDialog.tsx` | Religious compatibility row (same faith / different faiths / policy warning) |

### Phase F — Buildings *(designed above; built in SETTLEMENT_BUILDINGS phase)*

---

## Tests

New file: `tests/culture/religion.test.ts`

| Test | Assertion |
|------|-----------|
| `computeReligiousTension` — pure Orthodox | Returns 0 |
| `computeReligiousTension` — 50/50 split | Returns 1.0 |
| `computeReligiousTension` — 30/40/30 split | Returns ≈ 0.67 |
| `computeReligiousTension` — only Hidden Wheel | Returns 0 |
| `computeReligiousTension` — 25% Hidden Wheel present | rawTension damped by 50% |
| Company drain — Wheel 35% | Returns −1 |
| Company drain — Wheel 80% | Returns −5 (cap) |
| Company drain — `orthodox_enforced` policy | Returns 0 regardless of fraction |
| Company drain — `hidden_wheel_recognized` | Returns double the base calculation |
| Divergence counter — both faiths below 15% | Does not advance |
| Divergence counter — suppressed turns > 0 | Does not advance |
| Divergence counter — 21st qualifying turn | Returns `shouldFireEvent: true` and resets to 0 |
| All 393 existing tests | Continue to pass |

---

## Open Questions / Future Work

1. **Tribe reaction to religious policy** — Wheel-following tribes should respond negatively to `orthodox_enforced`; Company-aligned contacts should reward it. Design here; build in Phase 3 Step 12 (Tribe Relationship Depth).

2. **Bloodmoon / Mother Yashta** — The lore introduces a corrupting fourth faith via the Bloodmoon Tribe. This is a Phase 4 threat event arc. `ReligionId` stays three-value; Yashta worship would be an event-state flag, not a fourth `ReligionId`.

3. **Solar Church internal politics** — The "Temporary Necessity" doctrine fault line could surface as Company director events ("a new hardline director has replaced the old one") — a natural Phase 4 Company politics arc.

4. **Religion on the Family Tree** — Faith icons on `FamilyTree.tsx` nodes would make Sacred Wheel maternal transmission visually legible over generations. Low-effort, high-clarity addition for Phase 4 polish.

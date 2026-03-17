# Palusteria: Children of the Ashmark — Game Guide

> **Audience:** Players learning the game AND internal collaborators / AI agents working on the codebase.
> **Ground truth:** All numbers and mechanics in this document come from the live source code as of March 2026, not from plan documents. Where a plan doc's numbers differ from the source, the source wins.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Quick Reference](#2-quick-reference)
3. [Turn Structure & Seasons](#3-turn-structure--seasons)
4. [Population, Genetics & Inheritance](#4-population-genetics--inheritance)
5. [Heritage, Bloodlines & Culture](#5-heritage-bloodlines--culture)
6. [Language Acquisition](#6-language-acquisition)
7. [Religion](#7-religion)
8. [Cultural Identity Pressure](#8-cultural-identity-pressure)
9. [Households](#9-households)
10. [Opinions & Opinion Modifiers](#10-opinions--opinion-modifiers)
11. [Ambitions & Autonomous Events](#11-ambitions--autonomous-events)
12. [Named Relationships, Schemes & Factions](#12-named-relationships-schemes--factions)
13. [Skills & Apprenticeships](#13-skills--apprenticeships)
14. [Events](#14-events)
15. [Economy](#15-economy)
16. [Settlement Buildings & Construction](#16-settlement-buildings--construction)
17. [Private Dwellings & Worker Slots](#17-private-dwellings--worker-slots)
18. [Immigration & Prosperity](#18-immigration--prosperity)
19. [Happiness, Morale & Desertion](#19-happiness-morale--desertion)
20. [Sauromatian Courtship](#20-sauromatian-courtship)
21. [Diplomacy & External Tribes](#21-diplomacy--external-tribes)
22. [Portraits & Character Display](#22-portraits--character-display)
23. [Systems Interconnection](#23-systems-interconnection)
24. [Glossary](#24-glossary)

---

## 1. Overview

Palusteria is a slow-burn colony simulation set in a fictional ancient world. You lead an Ansberry Company expedition that has established a small mixed-heritage settlement on the contested borderland between Imanian civilisation and the Sauromatian tribal peoples.

**The arc:** A single game runs roughly 50–100 in-game years (200–400 turns). The settlers you start with will age, marry, have children, and die. Their grandchildren will be biologically and culturally different from the founders. The game asks: what kind of community does that second generation inherit?

**The player's role:** You manage the settlement from above — assigning workers, constructing buildings, resolving event choices, managing the annual Company quota, and trading with neighbouring tribes. You do not control individuals directly once a role or marriage is assigned. Characters think, form relationships, and pursue ambitions without your input.

**Design pillars:**
- **Emergent identity** — no playthrough produces the same demographic mix. Heritage, religion, language, and culture shift organically from the choices you make and the ones you don't.
- **Informed interference** — you can shape things but not dictate them. Characters with conflicting traits will clash regardless of your preferences.
- **Generational consequence** — decisions made in year 3 affect the people who are born in year 20. Long feedback loops are intentional.
- **The Company is watching** — you are not independent. The Ansberry Company funds your expedition, expects a quota each year, and will withdraw support if you drift too far culturally or economically.

---

## 2. Quick Reference

### Resources (9 types)

| Resource | Notes |
|----------|-------|
| `food` | Primary survival resource. Consumed each season. |
| `cattle` | Herd animals. Every 2 cattle → +1 food per season passively. Stable halves winter spoilage. |
| `goods` | Manufactured and traded items. **Not** `trade_goods`. Used for Company quota and barter. |
| `steel` | Produced by blacksmiths at the Smithy. High value trade good. |
| `lumber` | Gathered by Lumberjacks or extracted from surrounding terrain. Required for most construction. |
| `stone` | Quarried. Required for advanced construction. |
| `medicine` | Made at Healer's Hut via crafting. Reduces mortality. |
| `gold` | Primary quota currency. Acquired via trade and crafting. |
| `horses` | Acquired via trade only. Distinct from cattle. Influence combat and diplomacy options. |

### Seasons & Production Modifiers

| Season | Food production | Goods production | Notes |
|--------|----------------|-----------------|-------|
| Spring | ×1.0 | ×1.0 | Annual Company ship arrives. |
| Summer | ×1.2 | ×1.3 | Peak production. |
| Autumn | ×1.6 | ×1.0 | Quota checked at end of Autumn. |
| Winter | ×0.4 | ×0.7 | Hardship season. Spoilage worst. |

### Turn Phase Flow

```
idle ──► startTurn() ──► processDawn() ──► draw events
              │                                    │
              │                          events? ──┤
              │                                    ▼
              │                              phase: 'event'
              │                            resolve N events
              │                                    │
              └──────► no events ─────────► phase: 'management'
                                                   │
                                            endTurn() ──► processDusk() ──► idle
```

- **End Turn** (amber) is shown when `phase = 'idle'`. Click to start the next turn.
- **Confirm Turn** (green) is shown when `phase = 'management'`. Click after you've assigned roles and made decisions.
- **Resolve Events** phase is locked until all pending events are resolved in the Event view.

### Building Catalogue (24 types)

| Category | Building | Notes |
|----------|----------|-------|
| Communal civic | `camp` | Starting structure. No construction needed. |
| | `longhouse` | Imanian/Sauromatian style variants. |
| | `roundhouse` | Style variants. |
| | `great_hall` | Replaced by style upgrades. |
| | `clan_lodge` | Sauromatian cultural pull. |
| Food & storage | `granary` | Halves food spoilage. |
| | `fields` | Tilled Fields; +2 food/turn bonus for farmers. Without it, farmers work like foragers. |
| | `stable` | 2 herder slots. Halves cattle winter spoilage. |
| | `mill` | 2 miller slots. Multiplies grain output. |
| Industry | `workshop` | Enables `craft_lumber_to_goods` recipe. |
| | `smithy` | 2 blacksmith slots. Steel + goods production. |
| | `tannery` | 2 tailor slots. Goods production. |
| | `trading_post` | Required for tribe barter and Trading Post events. |
| Social & health | `healers_hut` | Enables medicine crafting. Required for `healer` earned trait. |
| | `gathering_hall` | Reduces language drift multiplier. |
| | `brewery` | 2 brewer slots. +5 happiness morale bonus when staffed. |
| Defence | `palisade` | Required for some immigration events. |
| Private dwellings | `wattle_hut` | Tier 1 dwelling. Capacity for small household. |
| | `cottage` | Tier 2 dwelling. |
| | `homestead` | Tier 3 dwelling. |
| | `compound` | Tier 4 dwelling. Largest household capacity. |
| Social amenities | `bathhouse` | 1 attendant slot. Happiness + fertility bonuses. Enables immigration event. |
| | `bathhouse_improved` | Upgraded bathhouse chain tier 2. Requires `bathhouse`. |
| | `bathhouse_grand` | Upgraded bathhouse chain tier 3. Requires `bathhouse_improved`. |

### Work Roles (22 values)

| Role | Notes |
|------|-------|
| `farmer` | Requires Tilled Fields to reach full output (+2 food bonus per season). |
| `gather_food` | Forager. Base 1 food/turn, scales with `plants` skill. No building required. Founding role. |
| `gather_stone` | Quarrier. Scales with `custom` skill. No seasonal modifier. |
| `gather_lumber` | Lumberjack. Scales with `custom` skill. No seasonal modifier. |
| `trader` | Generates gold and goods from trade activity. |
| `guard` | Produces nothing; provides settlement defence. |
| `craftsman` | General production for the workshop. |
| `healer` | Works at Healer's Hut. |
| `blacksmith` | Works at Smithy (2 slots). |
| `tailor` | Works at Tannery (2 slots). |
| `brewer` | Works at Brewery (2 slots). |
| `miller` | Works at Mill (2 slots). |
| `herder` | Works at Stable (2 slots). |
| `bathhouse_attendant` | Works at Bathhouse. Enables happiness + fertility bonuses. |
| `priest_solar` | Orthodox minister. Annual Company standing bonus. |
| `wheel_singer` | Sacred Wheel practitioner. Per-turn fertility bonus. |
| `voice_of_wheel` | Syncretic mediator. Reduces religious tension. Requires `hiddenWheelEmerged = true`. |
| `keth_thara` | Young Sauromatian man fulfilling cultural duty. Unavailable for other events. |
| `builder` | Temporarily assigned to a construction project. Role locked until project completes. |
| `away` | Dispatched on an external mission via a deferred event. Returns automatically. |
| `child` | Set automatically for ages 0–7. Cleared at age 8. Cannot be manually assigned. |
| `unassigned` | Default idle state. No production. |

---

## 3. Turn Structure & Seasons

Each "turn" represents one season (spring, summer, autumn, or winter). Four turns complete one in-game year.

**Dawn phase** runs at the start of each turn. In order:
1. Age all people by one season (age increments at age-birthday dawn)
2. Process pregnancies and births
3. Apply language drift
4. Compute cultural drift (modulated by happiness scores)
5. Process overcrowding mortality check
6. Advance construction projects
7. Fire earned trait acquisition (every 4 turns per person)
8. Apply temporary trait expiry
9. Apply trait-driven skill growth bonuses
10. Process named relationships (form/dissolve friend/rival/nemesis/confidant/mentor/student bonds)
11. Process schemes (advance progress; fire climax events at completion)
12. Process factions (form/dissolve; generate demands)
13. Process identity pressure (cultural blend zone → Company/tribe pressure counters)
14. Apply happiness tracking (compute scores, update multipliers, flag desertion candidates)
15. Process apprenticeships (Phase A cleanup, Phase B progress, Phase C formation every 8 turns)
16. Draw events (eligible events weighted by trait boosts, cooldowns, and prerequisites)

**Dusk phase** runs when you click Confirm Turn:
1. Calculate production for all workers (role × skill × building bonuses × happiness multiplier × apprenticeship bonus)
2. Apply spoilage
3. Check autumn quota (if Autumn)
4. Process Company relations
5. Apply any pending role changes

**Key numbers:**
- 1 in-game year = 4 turns
- Construction: 100 progress points per assigned worker per season
- Ambient event cooldown floor: 16 turns (once per in-game year maximum)

---

## 4. Population, Genetics & Inheritance

### People

Every person has:
- **Bloodline** — a fractional map of ethnic group ancestry (e.g. `{ imanian: 0.70, kiswani_riverfolk: 0.30 }`)
- **Physical traits** — skin tone (0–1 continuous), hair, eyes derived from bloodline at birth
- **Heritage** — `primaryCulture`, `ethnicGroup`, `extendedFertility`
- **6 base skills** — `animals`, `bargaining`, `combat`, `custom`, `leadership`, `plants` (1–100)
- **Traits** — a list of `TraitId` values from the ~86-entry catalog
- **Religion** — one of `imanian_orthodox`, `sacred_wheel`, `syncretic_hidden_wheel`
- **Languages** — a map of `LanguageId → fluency (0–1)`
- **Opinions** — a map of person ID → opinion score (−100 to +100)

### Inheritance at Birth

When a child is born:
1. **Bloodline** is averaged from both parents. The maternal weight is sampled from a Gaussian(0.5, σ=0.015) clamped to [0.44, 0.56] — approximately ±3% biological variation rather than a strict 50/50 split.
2. **Physical traits** are sampled: continuous values (skin tone) use a Gaussian around the blended ethnic mean; discrete values (eye colour, hair type) weight each parent's actual value with a +0.15 boost.
3. **Aptitude traits** (`inheritWeight > 0` in the trait catalog) are inherited probabilistically. One parent holds the trait → roll against `inheritWeight`. Both parents hold it → roll against `min(inheritWeight × 1.5, 0.95)`.
4. **Gender** is determined by `resolveGenderRatio`: pure Sauromatian woman × any father → ~6 daughters per 1 son; mixed heritage produces a gradient.

### Extended Fertility (Kethara's Bargain)

Sauromatian women may carry `extendedFertility = true`. This extends their fertile years from 42–45 to 52–55. Inheritance is strictly matrilineal — if the mother has it, daughters always inherit it regardless of the father's heritage.

### Ethnic Groups Reference

| Group | Skin (0–1) | Distinctive features |
|-------|-----------|---------------------|
| Imanian | ~0.2 | Cool-pink undertone; blonde–dark brown straight/wavy hair; blue/grey/green eyes |
| Kiswani Riverfolk | ~0.65 | Copper undertone; black wavy/curly hair; diverse eyes |
| Kiswani Bayuk | ~0.8 | Bronze undertone; black curly/coily hair (often dyed red); **grey eyes** (rare, distinctive) |
| Kiswani Haisla | ~0.7 | Warm undertone; black dreadlocks; grey-blue eyes |
| Hanjoda Stormcaller | ~0.35 | Cool/neutral; **blonde straight/wavy** (unusual for Sauromatian); grey/blue eyes; very tall |
| Hanjoda Bloodmoon | ~0.6 | Warm; dark variable hair; brown/dark eyes |
| Hanjoda Talon | ~0.75 | Neutral; black hair; **amber/yellow eyes** (unique tribal marker) |
| Hanjoda Emrasi | ~0.5 (high variation) | Warm; variable traits; mixed ancestry signature |

---

## 5. Heritage, Bloodlines & Culture

### The Blend Scale

The settlement's **`culturalBlend`** is a single number from 0.0 (fully Imanian Ansberite) to 1.0 (fully Sauromatian). It is recomputed each turn from the bloodline composition of all living people. It drives:
- Identity pressure events
- Company standing deltas
- Tribe disposition deltas
- Event deck shaping

### Individual Culture (`primaryCulture`)

Every person has a `primaryCulture` from 15 sub-group IDs (e.g. `kiswani_riverfolk`, `hanjoda_talon`, `settlement_native`). This is derived from their cultural drift map — the highest-weighted key, or `settlement_native` if no single culture exceeds 50%.

**Per-turn drift rates:**
- Community pull: +0.025 per season toward the settlement's most-spoken culture
- Spouse bonus: +0.01 per season toward spouse's culture
- Floor: 0.01 — cultures never fully disappear from a person's map

### Settlement-Native Culture

`settlement_native` seeds at 0.05 for every child born in the settlement. Over generations, the born-here population grows a distinct identity that is neither Imanian nor Sauromatian.

### Happiness Modulation

Cultural drift rate is multiplied by `happinessDriftCoefficient(score)` — ranging from 0.65× (miserable) to 1.10× (thriving). Unhappy people assimilate more slowly.

---

## 6. Language Acquisition

### Languages in Play

| Language | Speakers |
|----------|---------|
| Imanian | Founding colonists |
| Sauromatian | Founding Sauromatian women |
| Tradetalk | Founding traders (fluency 0.4) + Sauromatian women (fluency 0.3) |
| Settlement Creole | Emergent; forms after ~5 years of bilingual contact |

### Children's Language

Children inherit languages from both parents at birth via `resolveChildLanguages`. A child raised in a bilingual household acquires both languages from birth.

### Drift

`applyLanguageDrift` runs each dawn. The settlement's dominant language exerts pressure on minority speakers, nudging their fluency up or down by small deltas each season. The Gathering Hall building reduces the drift multiplier (it acts as a cultural stabiliser).

### Opinion Gate

If two people share no language with fluency ≥ 0.30, their baseline opinion starts −15. If Tradetalk is their only bridge, it starts −5 instead. This is permanent in the baseline relationship score.

### Tension

`languageTension` peaks near 1.0 when two languages split the population ~50/50. High tension contributes to cultural friction events and slows creole formation.

---

## 7. Religion

### The Three Faiths

| Faith | `ReligionId` | Origin | Notes |
|-------|-------------|--------|-------|
| Imanian Orthodox | `imanian_orthodox` | Founding colonists, Company | Company-approved. `priest_solar` role provides annual standing bonus. |
| Sacred Wheel | `sacred_wheel` | Sauromatian women | Tribal faith. `wheel_singer` role provides per-turn fertility bonus. |
| Hidden Wheel | `syncretic_hidden_wheel` | Emergent only | Never imported. Spreads only through events. Requires `hiddenWheelEmerged` flag. |

### Religious Tension Formula

`rawTension = 4 × orthodoxFraction × wheelFraction`  
Damped by `clamp(1 − hiddenFraction × 2, 0, 1)` — a pure Orthodox/Wheel split reaches full 1.0 tension; the Hidden Wheel's presence reduces it.

### The Hidden Wheel

The Hidden Wheel is a syncretic faith that emerges if the settlement exists at the intersection of both Orthodox (≥ 15%) and Wheel (≥ 15%) practice for long enough. The counter `hiddenWheelDivergenceTurns` advances 1 per turn when both thresholds are met, unless:
- Policy is `orthodox_enforced` (freezes the counter)
- The counter has been manually suppressed (sets `hiddenWheelSuppressedTurns`)

When the counter reaches **20 turns (= 5 in-game years)**, the event `rel_hidden_wheel_emerges` fires and sets `hiddenWheelEmerged = true`.

### Religious Policy

Set by the player in the Religion panel during the management phase:

| Policy | Effect |
|--------|--------|
| `tolerant` (default) | No enforcement. All faiths practise freely. |
| `orthodox_enforced` | Wheel ceremonies restricted. Freezes Hidden Wheel counter. Company approves. |
| `wheel_permitted` | Wheel ceremonies officially recognised. |
| `hidden_wheel_recognized` | Hidden Wheel given formal standing. Sets `hiddenWheelEmerged`. Doubles Company pressure drain. |

### Company Pressure from Religion

When Sacred Wheel exceeds 25% of the population, the Company drains standing annually:  
`drain = −Math.round((wheelFraction − 0.25) × 10)`, capped at −5/yr.  
Under `hidden_wheel_recognized`, this drain doubles.  
Under `orthodox_enforced`, it is 0.

### Priesthood Roles

- `priest_solar` — requires male Orthodox member. Generates annual Company standing bonus.
- `wheel_singer` — Sacred Wheel practitioner. Per-turn fertility bonus to the community.
- `voice_of_wheel` — Syncretic mediator. Reduces religious tension each turn. Only assignable after `hiddenWheelEmerged`.

---

## 8. Cultural Identity Pressure

### The Five Blend Zones

| Zone | Blend range | Company Δ/season | Tribe effect |
|------|------------|------------------|-------------|
| Extreme Imanian | < 0.10 | +0.5 standing | Tribal restlessness (pressure on tribes) |
| Soft Imanian | 0.10–0.25 | +0.25 standing | Mild tribal pressure |
| Safe | 0.25–0.65 | 0 | No pressure in either direction |
| Soft Native | 0.65–0.80 | −0.5 standing | Company concern begins |
| Extreme Native | > 0.80 | −1.5 standing | Strong Company drain |

### Pressure Counters

`identityPressure` on `GameState` has two counters:
- `companyPressureTurns` — increments each turn the blend is in a native zone; resets to 0 when returning to the safe zone
- `tribalPressureTurns` — mirrors this for the Imanian zone

These counters gate events and ambitions. For example, `seek_autonomy` requires `companyPressureTurns ≥ 4`.

### Tribe Disposition Deltas

Each turn in a pressure zone, *all* neighbouring tribes receive a disposition delta proportional to the pressure zone's tribe multiplier and the average of the tribe's personality trait multipliers. Modifiers:
- Isolationist tribes: ×0.3 (reduced sensitivity)
- Warlike tribes: ×1.8 if Imanian pressure, ×1.3 if native pressure

### The Identity Scale UI

The Settlement view shows an `IdentityScale` widget — a five-zone colour bar (red–orange–green–orange–red) with a white tick at the current blend position. "Ansberite" on the left, "Native" on the right. Amber badge appears when Company concern is active (native zone). Stone badge for tribal restlessness (Imanian zone).

---

## 9. Households

### Structure

Households are formed automatically when a marriage occurs. A household has:
- A **head** (the husband in Imanian arrangements, or the primary member in Sauromatian ones)
- A **senior wife** (in polygamous households, the first or eldest wife)
- Additional **wives** and **concubines**
- **Children** and **dependants**

### Ashka-Melathi

The *Ashka-Melathi* is a deep friendship bond between two Sauromatian women in the same household. It forms through events when both women have high mutual opinion. It provides happiness bonuses and can generate household events.

### Keth-Thara

The *Keth-Thara* is a Sauromatian cultural duty fulfilled by young men (age 16–24). A man assigned to `keth_thara` role serves a household in a formal but non-conjugal capacity. He fulfils `seek_cultural_duty` and contributes skill bonuses to the household. The role ends after the duty period and generates a resolution event.

### Thrall Status

`thrall` is a `SocialStatus`. Thralls cannot form ambitions, cannot be selected as event actors for most events, and are excluded from all actor slot selection that checks `matchesCriteria`. A thrall can be freed by bearing a son (for women) or by player choice via events.

### Household Role Labels

`HOUSEHOLD_ROLE_LABELS` in `household.ts` covers: `head`, `wife`, `senior_wife`, `concubine`, `child`, `dependent`, `keth_thara_guest`, `thrall`.

---

## 10. Opinions & Opinion Modifiers

### The Score

Every person tracks an opinion of every other person (within the tracking cap). Opinion runs from −100 (deep enmity) to +100 (devoted ally).

The **effective opinion** (`getEffectiveOpinion`) = base `relationships` map value + sum of all active `opinionModifiers` targeting that person, clamped [−100, +100].

### Baseline Sources (computed once on first contact)

| Condition | Delta |
|-----------|-------|
| Same `primaryCulture` | +10 |
| Same religion | +8 |
| No shared language (fluency ≥ 0.30) | −15 |
| Tradetalk-only bridge | −5 |
| Each trait conflict (8 pairs) | −10 to −20 |
| Shared trait bonus (7 traits) | +8 to +12 |

Baseline is clamped to [−80, +80] to leave room for events and bonds.

### Per-Turn Drift

| Condition | Delta per turn |
|-----------|---------------|
| Same `primaryCulture` | +1 |
| No shared language | −1 |
| Shared `WorkRole` (co-workers) | +1 |
| Spouse pair | Floor raised to +40 on marriage |

Decay: all opinion entries move 1 point toward 0 per turn. An entry at 0 is deleted.

### Marriage Gate

`canMarry` and `formConcubineRelationship` both hard-block if either party's **effective opinion** < −30.

### Timed Opinion Modifiers (`opinionModifiers`)

Events can apply decaying modifiers with a label, a value, and a duration. `abs(value)` = turns remaining; sign = favour (positive) or disfavour (negative). A `+8` modifier lasts 8 turns. On expiry, the modifier is deleted from the person's array.

**Modifier ID formats:**
- Auto-bond between co-actors: `{eventId}:auto:{idA}:{idB}`  
- Explicit pair: `{eventId}:pair:{personAId}:{personBId}`  
- Broadcast labeled: `{eventId}:labeled:{targetId}`

### Key Opinions UI

PersonDetail shows the top-3 positive (green chips) and top-3 negative (red chips) opinions for each person. Hover a chip for the breakdown (culture, religion, language, each conflict/shared trait, event modifiers with countdown). Deceased persons show a `†` suffix.

### Co-Actor Auto-Bond

When an event resolves with multiple bound actors, a `+2 "Shared: {event title}"` modifier is automatically applied between every pair of actors unless `choice.skipActorBond === true`.

---

## 11. Ambitions & Autonomous Events

Every person can hold one ambition at a time. An ambition has a type, an intensity (0–1.0), and optionally a target person.

### Intensity Mechanics

- **Formation** starts at intensity 0.10
- **Growth**: +0.05 per turn
- **Cap**: 1.0
- **Block**: the `content` trait suppresses all ambition growth
- **Firing threshold**: events gate on intensity ≥ **0.70**
- **Stale limit**: 40 turns (30 for `seek_companion`)

### The 11 Ambition Types

| # | Type | Formation Condition |
|---|------|---------------------|
| 0 | `seek_companion` | Sauromatian woman, unmarried, age ≥ 16; `courtshipNorms ≠ 'traditional'`; a neutral-opinion male available |
| 1 | `seek_spouse` | Unmarried, age ≥ 18; opinion ≥ 5 (Sauro women) or ≥ 25 (others) of an eligible partner |
| 2 | `seek_council` | Not on council; `leadership` OR `diplomacy` ≥ 46 (Very Good tier) |
| 3 | `seek_seniority` | Wife in household with ≥ 3 wives; hostile opinion of the senior wife |
| 4 | `seek_cultural_duty` | Sauromatian male, age 16–24, not already `keth_thara` |
| 5 | `seek_informal_union` | Non-Sauromatian male, age ≥ 18; effective opinion ≥ 25 of an eligible woman |
| 6 | `seek_prestige` | Age ≥ 25; `leadership` or `combat` ≥ 46; lacks `veteran` or `respected_elder` earned traits |
| 7 | `seek_faith_influence` | Has `zealous` or `pious` trait; `leadership` or `bargaining` ≥ 46; not already a priest role |
| 8 | `seek_skill_mastery` | Any base skill in the Very Good range (46–62) |
| 9 | `seek_legacy` | Age ≥ 45; has at least one unmarried adult child (age ≥ 14) |
| 10 | `seek_autonomy` | Sauromatian heritage; `companyPressureTurns ≥ 4` |

**Blocking conditions (all ambitions):** `content` trait; `role = 'away'`; `socialStatus = 'thrall'`.

### Ambition Badge UI

PersonDetail shows a colour-coded badge beneath the traits section:
- Dim grey: intensity below 0.3
- Amber: intensity 0.3–0.69
- Rose: intensity ≥ 0.70 (at firing threshold)

A progress bar shows the exact intensity, with a `title` tooltip showing the percentage.

---

## 12. Named Relationships, Schemes & Factions

### Named Relationships

Six bond types can form between individuals:

| Type | How it forms | Effect |
|------|-------------|--------|
| `friend` | Effective opinion ≥ 50 sustained for 4 consecutive turns | Opinion drift bonuses; scheme targets less likely to be undermined |
| `rival` | Effective opinion ≤ −20 sustained | Scheme generation toward rivals; increased event conflict weight |
| `nemesis` | Effective opinion ≤ −50 sustained | Generates `scheme_undermine_person` automatically without trait requirement |
| `confidant` | High mutual opinion + trust-trait match | Suppresses undermine schemes against the confidant |
| `mentor` | Significant skill gap + positive opinion | Alone sufficient to generate `scheme_tutor_person` |
| `student` | Paired with mentor | Receives apprenticeship-style skill bonuses |

### Scheme Engine

Each person with an active ambition or relevant traits may run a **scheme** — a multi-turn project with a completion event.

| Scheme type | Driver traits | Scales with |
|------------|--------------|-------------|
| `scheme_court_person` | `romantic`, `passionate`, `lonely` | Opinion toward target (higher = faster) |
| `scheme_convert_faith` | `zealous`, `pious`, `missionary` | Flat 1.0 rate |
| `scheme_befriend_person` | `gregarious`, `romantic`, `lonely` | Opinion toward target |
| `scheme_undermine_person` | `jealous`, `ambitious` (OR nemesis bond) | Inverted opinion (hatred = faster) |
| `scheme_tutor_person` | `mentor_hearted` (OR mentor bond) | Flat 1.0 rate |

Progress rate formula: `clamp(1.0 + opinion / 200, 0.5, 1.5)` for positive-direction schemes. Inverted for `undermine`. Generation interval: **12 turns per person** (jittered by person index).

Schemes complete by firing a matching climax event (all `isDeferredOutcome: true`): `sch_courtship_discovered`, `sch_faith_advocacy_noticed`, `sch_rumours_spreading`, `sch_undermining_climax`, `sch_tutor_breakthrough`.

### Factions

Six factions can form when their eligibility conditions are met by at least **3 members** (`FACTION_MIN_MEMBERS`):

| Faction | Membership eligibility |
|---------|----------------------|
| `cultural_preservationists` | Sauromatian heritage, `traditionalist`/`proud` traits |
| `company_loyalists` | Imanian heritage, `disciplined`/`ambitious` traits, high standing |
| `orthodox_faithful` | `imanian_orthodox` religion, `pious`/`devout` traits |
| `wheel_devotees` | `sacred_wheel` or `syncretic_hidden_wheel` religion, `pious` trait |
| `community_elders` | Age ≥ 50, `respected_elder` trait |
| `merchant_bloc` | `trader` role, `bargaining` ≥ 46 |

When faction strength reaches ≥ **0.45** (`DEMAND_STRENGTH_THRESHOLD`), it generates a player-facing event demand each season.

### Community Tab

The **Community** view (🏛) shows:
- Left panel: population summary, bond counts by type
- Centre panel: faction list with strength bars and active demands
- Right panel: rolling 30-entry activity feed

---

## 13. Skills & Apprenticeships

### Base Skills (6)

Stored on every person. Range: 1–100. Generated at birth from `Gaussian(28, 15)` + trait bonuses.

| Skill | Used by |
|-------|---------|
| `animals` | Herding, veterinary events |
| `bargaining` | Trading, diplomacy checks, speech events |
| `combat` | Guard, warrior, veteran qualification |
| `custom` | Quarrying, lumberjacking, crafting; catch-all practical skill |
| `leadership` | Council qualification, command events |
| `plants` | Foraging, farming, healing events |

### Derived Skills (7)

Computed on demand from base skills. Never stored.

| Derived | Formula base |
|---------|-------------|
| Deception | `bargaining` + custom modifier |
| Diplomacy | `bargaining` + `leadership` blend |
| Exploring | `combat` + `plants` blend |
| Farming | `plants` + flat bonus if Tilled Fields |
| Hunting | `combat` + `plants` blend |
| Poetry | `custom` + `bargaining` blend |
| Strategy | `combat` + `leadership` blend |

### Skill Tiers

| Tier | Range | Abbreviation |
|------|-------|-------------|
| Fair | 1–25 | FR |
| Good | 26–45 | GD |
| Very Good | 46–62 | VG |
| Excellent | 63–77 | EX |
| Renowned | 78–90 | RN |
| Heroic | 91–100 | HR |

### Per-Turn Growth

Certain traits add skill deltas every dawn:

| Trait | Bonus |
|-------|-------|
| `green_thumb` | +2 `plants`/season |
| `keen_hunter` | +1 `combat`/season |
| `gifted_speaker` | +1 `bargaining`, +1 `leadership`/season |
| `mentor_hearted` | +1 `leadership`/season |
| `inspired` (temporary) | +1 all six skills/season |
| `bereaved` / `grieving` (temporary) | −1 all six skills/season |

Building skill growth bonuses (e.g. Tilled Fields: +1 `plants`/season to assigned farmers) also stack.

### Apprenticeship System

Masters automatically pair with apprentices every **8 turns** (dawn step 8.94). Eligible master: age ≥ 16, `WorkRole` in the 12 trainable trades, trade skill ≥ 26 (Good), one active apprentice maximum.

**Apprentice priority:** own children (age 10–20) first, then named `student` relationships.

**Progress rate** per turn: base 0.04 × skill-tier multiplier (1.0/1.25/1.50/1.75 for Good/Excellent/Renowned/Heroic) × 1.25 if `mentor_hearted`.

On graduation (progress = 1.0), the apprentice receives a permanent `tradeTraining` bonus for that role (5–27% by master tier, capped at 30% per role). This bonus applies multiplicatively in production calculations.

**12 trainable trades:** `farmer`, `gather_food`, `gather_stone`, `gather_lumber`, `blacksmith`, `tailor`, `brewer`, `miller`, `herder`, `healer`, `trader`, `craftsman`.

---

## 14. Events

### Event Anatomy

Every event has:
- `id` — unique string
- `title`, `description` — display text
- `category` — one of: `domestic`, `cultural`, `economic`, `environmental`, `diplomatic`, `religious`, `identity`, `relationships`, `buildings`, `schemes`, `happiness`, `immigration`, `apprenticeship`
- `prerequisites` — conditions checked against `GameState` before the event is drawn
- `actorRequirements` — named slots (e.g. `{envoy}`, `{patient}`, `{wife}`) filled from the eligible population
- `choices` — 2–4 choices, each with consequences
- `cooldown` — minimum turns before repeat
- `isAmbient?: true` — ambient events have a forced minimum cooldown of **16 turns**

### Actor Binding

Named actor slots are matched at draw time by `resolveActors`. Criteria include: `sex`, `religion`, `minAge`, `maxAge`, `maritalStatus`, `minSkill`, `hasTrait`, `sauromatianHeritage`. If a required slot cannot be filled, the event is skipped.

**Mutual exclusion**: each claimed person is excluded from subsequent slots — no two slots in the same event can share the same person.

**Persons with `role = 'away'` are never eligible** for any slot.

### Text Interpolation

Event text can reference actors with tokens:

| Token | Resolves to |
|-------|------------|
| `{slot}` | Full name |
| `{slot.first}` | Given name |
| `{slot.he}` / `{slot.she}` | Pronoun matching sex |
| `{slot.his}` / `{slot.her}` | Possessive |
| `{slot.him}` / `{slot.her}` | Objective |
| `{slot.He}` etc. | Capitalised variants |

### Skill Checks

`resolveSkillCheck(event, choice, actor)` — computes success/near-success/failure from the actor's relevant skill vs a difficulty threshold. Choices can specify different consequence lists for each outcome tier.

### Deferred Events (`isDeferredOutcome: true`)

Some choice outcomes schedule a follow-up event for a later turn (e.g. someone sent on a mission returns after 4 turns). The bound actors and context are preserved in `DeferredEventEntry`. When the mission role is `away`:
- The person's role is set to `'away'` immediately
- On `startTurn`, due deferred entries restore the person's previous role before the follow-up event fires

### Council Voice

The Expedition Council (up to 7 members) provides advice during events. Each adviser has a `VoiceArchetype` (bold/pragmatist/diplomat/traditionalist/cautious/schemer) derived from their traits. Their advice is deterministic — seeded by `djb2(personId + eventId)` — so it never consumes the main RNG stream and never changes between views.

---

## 15. Economy

### Company Quota

The Company expects annual gold and goods deliveries, starting in year 4.

**Quota formula:**
- `quotaGold = 5 + (year − 3) × 2`
- `quotaGoods = 8 + (year − 3) × 3`
- Years 1–3: no quota. 1 gold = 2 goods exchange rate applies.

Quota is checked at the end of **Autumn** each year. Results:

| Status | Standing effect |
|--------|----------------|
| `exceeded` | +Standing bonus |
| `met` | No change |
| `partial` | −Standing |
| `failed` | −Standing; consecutive failure counter increments |

Consecutive failures trigger escalating consequences via `CompanySupportLevel`: `full_support` → `standard` → `reduced` → `minimal` → `abandoned`.

**Annual ship** arrives each Spring. Base supply delivery scales with `supportLevel`. Optional settler and goods requests cost standing.

### Tribe Trade

Requires both: a `trading_post` is built AND `tribe.contactEstablished = true`.

**Barter fairness meter:** ±30% value ratio is the fair band. Favoring yourself (>+30% your way) reduces the tribe's disposition. Favoring the tribe (>+15% their way) increases it.

The trade interface is locked without a Trading Post. TradeView shows the locked panel in that state.

### Internal Crafting

| Recipe | Requirements | Input | Output |
|--------|-------------|-------|--------|
| `craft_lumber_to_goods` | Workshop | 3 lumber | 4 goods |
| `craft_cattle_slaughter` | None | 2 cattle | 3 food + 1 goods |
| `craft_medicine_prep` | Healer's Hut | 3 food + 2 goods | 4 medicine |
| `craft_goods_to_gold` | None | 5 goods | 2 gold |

### Spoilage

Runs at dawn each turn. Rates:
- `food`: 5%/season (Summer ×1.5; Granary halves this)
- `cattle`: 3%/season (Winter ×2; Stable halves this)
- `medicine` / `goods`: 1–2%/season

Spoilage < 1 unit is ignored (no fractional loss).

---

## 16. Settlement Buildings & Construction

### Construction Mechanics

1. **`canBuild(defId, state)`** returns `{ ok: true }` or `{ ok: false, reason: string }`. Checks resources, prerequisite buildings, and uniqueness constraints.
2. A project enters the `constructionQueue`. Assign settlers with `builder` role.
3. Each dawn: `progressPoints += assignedWorkers.length × (1 + avgCustomSkill / 100) × 100`.
4. When `progressPoints ≥ totalPoints (= buildSeasons × 100)`, the building is completed and added to `settlement.buildings`.

**Construction speed:** A single builder completes a 1-season building in exactly one season. Two builders halve it. Higher `custom` skill speeds progress slightly (bonus = avgSkill / 100 extra points per worker per season).

### Style Variants

Some buildings (`roundhouse`, `longhouse`, `great_hall`, `clan_lodge`) have `imanian` and `sauromatian` style options. Style affects the building's culture pull direction each turn.

### Building Effects (key examples)

| Building | Key effect |
|----------|-----------|
| `granary` | Halves food spoilage |
| `fields` | Farmers get +2 food bonus per season (without it, farmers produce same as foragers) |
| `gathering_hall` | Reduces language drift multiplier |
| `stable` | Halves cattle winter spoilage; 2 herder slots |
| `healers_hut` | Required for `healer` earned trait acquisition |
| `trading_post` | Unlocks tribe barter and `eco_passing_merchant` event weight boost |
| `palisade` | Required for defensive events and `imm_tribal_family_refuge` |
| `brewery` | +5 happiness morale when staffed by a brewer |

### Building Events

Five building-related events exist in `definitions/building.ts`:
- `bld_fever_spreads` — illness triggered by poor shelter conditions
- `bld_bitter_quarrel` — workers fight during construction
- `bld_someone_leaves` — a settler departs if conditions are poor
- `bld_completion_toast` — deferred celebration when construction finishes
- `bld_traders_notice` — unique; requires Trading Post

---

## 17. Private Dwellings & Worker Slots

### Dwelling Tiers

Private dwellings are built and claimed by households. Multiple dwellings of the same type can coexist.

| Tier | `BuildingId` | Happiness bonus |
|------|-------------|----------------|
| 1 | `wattle_hut` | +8 |
| 2 | `cottage` | +15 |
| 3 | `homestead` | +22 |
| 4 | `compound` | +30 |

### Claiming Algorithm (`applyDwellingClaims`)

Runs each dawn after construction completes. Three passes:
1. **Pass 1 (scheme-owned):** If a building's `ownerHouseholdId` is already set (bought via a scheme), link it directly.
2. **Pass 2 (unowned):** Assign the first homeless household; priority goes to largest households.
3. **Pass 3 (propagation):** Set `person.claimedBuildingId` for every member of the claiming household; clear stale refs to demolished buildings.

### Time-Based Expectation

Settlers who have lived in the settlement for many years expect better housing. The penalty ramps up starting in year 5:  
`penalty = min(3 + floor((yearsPresent − 5) × 1.5), 20)`, capped at −20.

Relative jealousy: −8 happiness if any dwelling exists but this person claims none.

### Worker Slot Caps

Five production buildings enforce `workerSlots` limits per `workerRole`. The `findAvailableWorkerSlotIndex` function returns −1 when all slots in a given role are full. The `assignRole` action checks this before accepting new assignments.

| Building | Role | Slots |
|----------|------|-------|
| `stable` | `herder` | 2 |
| `mill` | `miller` | 2 |
| `smithy` | `blacksmith` | 2 |
| `tannery` | `tailor` | 2 |
| `brewery` | `brewer` | 2 |
| `bathhouse` | `bathhouse_attendant` | 1 |

---

## 18. Immigration & Prosperity

### Prosperity Score

`computeProsperityScore(state)` produces a number used as a prerequisite gate for immigration events:

```
prosperityScore =
  buildings.length × 3
  + floor(food / 15)
  + floor(goods / 8)
  + gold × 2
  + floor(populationCount / 5)
```

A starting settlement scores around 3–10; a developed mid-game settlement might reach 30–50+.

### Immigration Events (5)

| Event ID | Building required | Min prosperity | Source |
|----------|------------------|----------------|--------|
| `imm_kiswani_traders_settle` | `trading_post` + tribe contact | 15 | Kiswani merchants seeking permanent residence |
| `imm_wildborn_bathhouse_woman` | `bathhouse` | 10 | A woman drawn by the bathhouse; can take `bathhouse_attendant` role |
| `imm_tribal_family_refuge` | `palisade` | 12 | Fleeing tribe family requesting asylum |
| `imm_steel_seeking_warrior` | `smithy` | 20 | Skilled warrior wanting to work with steel |
| `imm_sauromatian_midwife` | *(none)* | 15 | An experienced midwife; provides fertility and medicine bonuses |

Immigration events use `add_person` consequences with `initialSkillBoosts` targeting the new arrival's relevant skills.

### Bathhouse Fertility Bonus

The bathhouse chain provides a fertility bonus tracked by `getBuildingFertilityBonus()`:
- `bathhouse`: baseline fertility increase for women using the facility
- `bathhouse_improved`: higher bonus
- `bathhouse_grand`: highest bonus; provides +5 happiness to all women in the settlement

Sauromatian women receive enhanced happiness from the bathhouse (+8/+12/+16 by tier) — the bathhouse is partly a cultural amenity for them.

---

## 19. Happiness, Morale & Desertion

### Happiness Score

`computeHappiness(person, state)` returns a value −100 to +100. It is **never stored** on the person — computed on demand. Four factor categories:

**Material:**
- Food shortage: penalty scales with food deficit vs. consumption
- Overcrowding: penalty when `overcrowdingRatio > 1.0`
- Dwelling tier bonus: +8 / +15 / +22 / +30 depending on claimed dwelling tier
- No dwelling when others have one: −8 (relative jealousy)
- Time-based expectation penalty (year 5+, up to −20)

**Social:**
- Named bonds: each `friend` / `confidant` +10; each `rival` −8; each `nemesis` −15
- Religious tension: −(tension × 15)
- Opinion climate: small bonus/penalty from average effective opinions of nearby people
- Brewery morale: +5 when `brewery` is built and a `brewer` is assigned

**Purpose:**
- Work-role fit: matching role to a person's skill profile and traits provides +5 to +15
- Being `unassigned`: −5

**Trait:**
- `optimistic`: +10
- `content`: +8
- `grieving` / `bereaved`: −15
- `homesick`: −10
- `hot_tempered`: −5
- `lonely` (trait): ±20 depending on named relationships
- `devout` under religious suppression: additional penalty

### Labels

| Score | Label |
|-------|-------|
| ≥ 60 | Thriving |
| 30–59 | Content |
| 10–29 | Settled |
| −10–9 | Restless |
| −30 to −11 | Discontent |
| −60 to −31 | Miserable |
| < −60 | Desperate |

### Production Multipliers

| Label | Multiplier |
|-------|-----------|
| Thriving | ×1.15 |
| Content | ×1.07 |
| Settled | ×1.00 |
| Restless | ×0.95 |
| Discontent | ×0.88 |
| Miserable | ×0.78 |
| Desperate | ×0.65 |

Guards, `away`, and `keth_thara` roles always produce at ×1.0 regardless of happiness.

### Desertion

`lowHappinessTurns` on `Person` counts consecutive turns at score < −50. At `lowHappinessTurns ≥ 3`, the person is **desertion eligible**. The `getDepartingFamily` function walks the household:
- Spouses depart if their own `lowHappinessTurns ≥ 1` OR they hold opinion ≥ 25 of the primary deserter
- Children under 16 always follow

### Settlement Morale

`computeSettlementMorale` averages happiness scores across all living settlers. Below −20 for sustained turns, `hap_low_morale_warning` and other crisis events are injected programmatically.

---

## 20. Sauromatian Courtship

### Overview

Sauromatian women practise an active courtship tradition. Rather than waiting for a formal marriage arrangement, they identify a companion and begin building a relationship before marriage. This is modelled by the `seek_companion` ambition and the `applyCourtshipOpinionDrift` function.

### Courtship Norms Policy

Set on `Settlement.courtshipNorms`. The policy controls ambition formation and drift rate:

| Norms | `seek_companion` forms? | Drift multiplier |
|-------|------------------------|-----------------|
| `traditional` | No — blocked entirely | 1× (but rarely triggers) |
| `mixed` (default) | Yes | 1× |
| `open` | Yes, more aggressively | 2× (doubled drift rate) |

### Opinion Drift Rules

Each turn, `applyCourtshipOpinionDrift` applies to Sauromatian women:

**Rule 1 — Active pursuit:** A Sauromatian woman with an active `seek_companion` or `seek_spouse` ambition gains +1 opinion toward her ambition target, and the target gains +1 toward her. This doubles to +2/+2 under `open` norms.

**Rule 2 — Household proximity:** A single Sauromatian woman without an active ambition, living in the same household as an unmarried man, gains +0.5/turn average toward household males with non-negative opinion (applied as +1 every other turn).

### Ambition-Marriage Pipeline

The typical Sauromatian courtship arc:
1. `seek_companion` forms at ~intensity 0.10 with a target
2. Opinion drifts via Rule 1 over successive turns
3. Intensity reaches 0.70 → `rel_mutual_attraction` event can fire
4. Marriage arrangement becomes possible once opinion ≥ 5 threshold for `seek_spouse`
5. `seek_spouse` forms (or replaces `seek_companion`) once she is ready to formalise

---

## 21. Diplomacy & External Tribes

### Tribe Data Model

Each neighbouring tribe has:
- `disposition` — their attitude toward the settlement (−100 to +100)
- `contactEstablished: boolean` — whether the expedition has made contact
- `trait` — one of: `warlike`, `peaceful`, `isolationist`, `trader`, `expansionist`, `desperate`
- `lastTradeTurn` — enforces one trade per turn cooldown

**16 tribe presets** defined in `TRIBE_PRESETS`. Initial tribes are selected at game setup.

### Trade

Full barter UI available in the **Trade** view once a Trading Post is built and contact is established. Trades affect tribe disposition based on fairness (see §15 Economy).

### Diplomacy View

> **Note for players:** The TradeView tab (accessible from the left nav) is fully functional. A separate "Diplomacy" map view showing tribe territories and missions is planned but not yet implemented.

### Identity Pressure & Tribes

Each turn in a cultural pressure zone, tribe dispositions shift in response to the settlement's blend position (see §8). Tribes respond to how Imanian or Sauromatian your settlement appears.

---

## 22. Portraits & Character Display

### Portrait System

Portraits are resolved by `resolvePortraitSrc(person)` based on:
1. **Sex** (`male` / `female`)
2. **Portrait category** (derived from bloodline fractions — e.g. `imanian` if imanian ≥ 75%; `mixed_imanian_kiswani` if combined ≥ 80% but neither dominant)
3. **Age stage** (`child` 0–13 / `young_adult` 14–29 / `adult` 30–54 / `senior` 55+)
4. **`portraitVariant`** — a 1-indexed number assigned once at birth, never changed; defaults to 1

**Stage fallback order:** exact stage → `adult` → `young_adult` → `senior` → `child`. A single `adult` portrait covers all ages until stage-specific art is added.

### Portrait Categories

| Category | Bloodline condition |
|----------|-------------------|
| `imanian` | imanian fraction ≥ 75% |
| `kiswani` | kiswani sub-groups combined ≥ 75% |
| `hanjoda` | hanjoda sub-groups combined ≥ 75% |
| `mixed_imanian_kiswani` | imanian + kiswani ≥ 80%, neither dominant alone |
| `mixed_imanian_hanjoda` | imanian + hanjoda ≥ 80%, neither dominant alone |
| `mixed_kiswani_hanjoda` | kiswani + hanjoda ≥ 80%, neither dominant alone |

### SVG Fallback

If no photo portrait asset exists for a category/stage/variant combination, `Portrait.tsx` renders an SVG silhouette coloured with the person's skin-tone HSL value.

### Expanding the Portrait Pool

1. Drop the PNG into `public/portraits/{sex}/{category}/`
2. Increment the count for that slot in `PORTRAIT_REGISTRY` in `portrait-resolver.ts`
3. No other code changes needed

---

## 23. Systems Interconnection

Everything in Palusteria feeds into everything else. The key dependency chains:

| Source | Feeds into |
|--------|-----------|
| Bloodline + heritage | Cultural drift rate, portrait category, gender ratio, aptitude trait inheritance |
| Cultural blend | Identity pressure counters, Company standing delta, tribe dispositions |
| Language fluency | Baseline opinions, event eligibility, linguistic tension |
| Religion fractions | Religious tension, Company pressure drain, Hidden Wheel counter |
| Opinion scores | Marriage eligibility, ambition formation, scheme speed, event eligibility |
| Ambitions | Autonomous event eligibility (gate: intensity ≥ 0.7) |
| Named relationships | Scheme generation (nemesis → undermine; confidant suppresses; mentor → tutor) |
| Scheme progress | Climax event injection |
| Factions | Demand event injection |
| Happiness scores | Cultural drift rate (`happinessDriftCoefficient`), production multipliers, desertion gate |
| Apprenticeship | `tradeTraining` bonus → production multiplier |
| Prosperity score | Immigration event eligibility |
| Courtship norms | `seek_companion` ambition eligibility, courtship opinion drift rate |
| Buildings | Spoilage mitigation, skill growth bonuses, immigration events, worker slot enforcement, dwelling happiness |
| Company standing | Support level → annual supply delivery, event injection (`rel_company_concern_letter`) |

**Critical feedback loops:**
1. **Happiness → culture → identity pressure → Company standing** — unhappy settlers assimilate slower, which may help or hurt depending on the blend direction.
2. **Opinion → relationships → schemes → events** — high/low opinion builds bonds which shape what schemes form, which shape what events fire.
3. **Immigration → prosperity → building → prosperity** — more buildings raise the prosperity score, which unlocks better immigration events, which add more people, which enables more building.
4. **Religion → tension → events → religion** — religious composition generates events that can convert people, changing the composition.

---

## 24. Glossary

| Term | Definition |
|------|-----------|
| **Ambient event** | An event marked `isAmbient: true`. Subject to a minimum 16-turn cooldown — at most once per in-game year. |
| **Ansberry Company** | Your external patron. Funds the expedition, demands annual quotas, can withdraw support or abandon the settlement. |
| **Ansberite** | Cultural identity associated with the Company and Imanian heritage. Opposite end of the blend scale from "Native." |
| **Ashka-Melathi** | A deep female friendship bond between Sauromatian women in the same household. |
| **Away** | A `WorkRole` state. A person sent on an external mission. Unavailable for all other purposes until they return. |
| **Blend scale** | `settlement.culture.culturalBlend`: 0.0 = pure Imanian / 1.0 = pure Sauromatian. |
| **Bound actors** | Named character slots filled when an event is drawn. Text is interpolated with their names and pronouns. |
| **Builder** | A `WorkRole`. Temporarily assigned to a construction project. |
| **Co-actor auto-bond** | A +2 timed `opinionModifier` that forms automatically between every pair of actors in a resolved event. |
| **Compound** | Highest-tier private dwelling (`wattle_hut` → `cottage` → `homestead` → `compound`). |
| **Confidant** | A named relationship that suppresses `scheme_undermine_person` generation against the confidant. |
| **Content** (trait) | Blocks all ambition formation and intensity growth. |
| **Dawn** | The beginning of each turn. All simulation processing happens here before the player's management phase. |
| **Derived skill** | A skill computed on demand from base skills (Deception, Diplomacy, Exploring, Farming, Hunting, Poetry, Strategy). |
| **Deferred event** | An event scheduled for a future turn via `isDeferredOutcome: true`. Actors and context are preserved. |
| **Desertion** | When `lowHappinessTurns ≥ 3`, a settler becomes eligible to leave. Their family may follow. |
| **Disposition** | A tribe's attitude toward the settlement (−100 to +100). |
| **Dusk** | The end-of-turn processing after the player clicks Confirm Turn. Production, spoilage, quota check. |
| **Effective opinion** | `relationships` base value + sum of all active timed `opinionModifiers`, clamped [−100, +100]. |
| **Extended fertility** | `extendedFertility = true` on a person. Females remain fertile to age 52–55. Matrilineal inheritance. |
| **Founding member** | A `SocialStatus`. The 6–8 people who begin the game. |
| **Hidden Wheel** | `syncretic_hidden_wheel` — an emergent syncretic faith. Forms after 20 turns of mixed Orthodox/Wheel presence. |
| **Identity pressure** | `companyPressureTurns` / `tribalPressureTurns` counters that track how long the blend has been outside the safe zone. |
| **Keth-Thara** | A Sauromatian cultural duty role for young men (age 16–24). Fulfils `seek_cultural_duty`. |
| **Low morale turns** | `lowMoraleTurns` on `GameState`. Increments when settlement morale < −20. Gates crisis events. |
| **Mentor** | A named relationship that alone can generate `scheme_tutor_person` without any trait. |
| **Nemesis** | A named relationship formed at sustained low opinion (≤ −50). Alone generates `scheme_undermine_person`. |
| **Opinion modifier** | A timed, decaying delta on a person's opinion of another. Separate from the permanent `relationships` map. |
| **Primary culture** | The highest-weighted culture in a person's drift map, or `settlement_native` if none exceeds 50%. |
| **Prosperity score** | A computed number gating immigration events: `buildings×3 + floor(food/15) + floor(goods/8) + gold×2 + floor(pop/5)`. |
| **RNG** | Seeded pseudo-random number generator (`createRNG(seed)` in `src/utils/rng.ts`). All randomness flows through this. Never use `Math.random()`. |
| **Safe zone** | Cultural blend range 0.25–0.65 where neither Company standing nor tribe dispositions are affected by identity pressure. |
| **Sauromatian** | The tribal peoples native to the region. Their women have a female-skewed gender ratio, extended fertility, and the Sacred Wheel faith. |
| **Settlement native** | `settlement_native` culture. Seeds at 0.05 for children born in the settlement; grows over generations. |
| **Scheme** | A multi-turn personal project run autonomously by a character. Completes by firing a climax event. |
| **Skill tier** | Fair (1–25) / Good (26–45) / Very Good (46–62) / Excellent (63–77) / Renowned (78–90) / Heroic (91–100). |
| **Social status** | `founding_member`, `settler`, `newcomer`, `elder`, `outcast`, or `thrall`. |
| **Thrall** | A `SocialStatus`. Cannot form ambitions. Freed by event choice or by bearing a son. |
| **Trade training** | `person.tradeTraining` — graduated apprenticeship bonuses. Applied as `1 + bonus/100` multiplier in production. |
| **Voice archetype** | A council adviser's personality type: bold / pragmatist / diplomat / traditionalist / cautious / schemer. |

---

*Guide last updated: March 2026. All values from source as of Phase 4.2 + Apprenticeship System completion.*

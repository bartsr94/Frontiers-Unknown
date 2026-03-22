# Palusteria: Children of the Ashmark — Game Guide

> **Audience:** Players learning the game AND internal collaborators / AI agents working on the codebase.
> **Ground truth:** All numbers and mechanics in this document come from the live source code as of March 2026, not from plan documents. Where a plan doc's numbers differ from the source, the source wins.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Starting Your Expedition](#2-starting-your-expedition)
3. [Quick Reference](#3-quick-reference)
4. [Turn Structure & Seasons](#4-turn-structure--seasons)
5. [Population, Genetics & Inheritance](#5-population-genetics--inheritance)
6. [Heritage, Bloodlines & Culture](#6-heritage-bloodlines--culture)
7. [Language Acquisition](#7-language-acquisition)
8. [Religion](#8-religion)
9. [Cultural Identity Pressure](#9-cultural-identity-pressure)
10. [Households](#10-households)
11. [Opinions & Opinion Modifiers](#11-opinions--opinion-modifiers)
12. [Ambitions & Autonomous Events](#12-ambitions--autonomous-events)
13. [Named Relationships, Schemes & Factions](#13-named-relationships-schemes--factions)
14. [Skills & Apprenticeships](#14-skills--apprenticeships)
15. [Events](#15-events)
16. [Economy](#16-economy)
17. [Settlement Buildings & Construction](#17-settlement-buildings--construction)
18. [Private Dwellings & Worker Slots](#18-private-dwellings--worker-slots)
19. [Immigration & Prosperity](#19-immigration--prosperity)
20. [Happiness, Morale & Desertion](#20-happiness-morale--desertion)
21. [Sauromatian Courtship](#21-sauromatian-courtship)
22. [Diplomacy & External Tribes](#22-diplomacy--external-tribes)
23. [Portraits & Character Display](#23-portraits--character-display)
24. [Systems Interconnection](#24-systems-interconnection)
25. [Glossary](#25-glossary)
26. [Expeditions](#26-expeditions)

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

## 2. Starting Your Expedition

The **Intro Sequence** is a five-step wizard that appears when you begin a new game. It replaces the old single-page setup form and covers settlement name, difficulty, founding companion composition, and starting location.

### Step 0 — Preamble

Full-screen prologue with three narrative paragraphs setting the scene. Two buttons:

- **Begin the Expedition** — continues to Step 1.
- **Skip Intro** (small, muted) — calls `newGame()` immediately with the skip defaults listed below.

### Step 1 — The Charter

Set the settlement name (default: `"Kethani Post"`) and difficulty.

| Difficulty | Label | Effect |
|---|---|---|
| `easy` | The Company Is Patient | Slower quota ramp; generous annual ship deliveries |
| `normal` | By the Book | Standard quota schedule; Company watches but does not hover |
| `hard` | The Inspector Watches | Quota begins in year 5; every failure costs standing |

### Step 2 — Your Companions

Three independent stackable toggles. Any combination (including all three together) is valid. A live headcount at the bottom of the screen updates as toggles change.

#### Card A — Imanian Wives (default: off)

Adds 2–3 Imanian women, each pre-married to a specific founding man. Households form automatically on day 1. Each wife has a 30% chance of arriving with a young child (age 2–6).

- **Profile:** female · age matched to husband ±3 years (range 20–38) · pure Imanian genetics · `imanian_orthodox` · `founding_member` status · Imanian language 1.0 (no Tradetalk)
- **Starting opinion toward husband:** +50
- **GameConfig:** `companionChoices.imanianWives`

Effects: raises starting Imanian cultural blend; married men are unavailable for new courtship; if a child arrives the settlement has a non-working dependent from turn 1.

#### Card B — Townborn Auxiliaries (default: off)

Adds 3 mixed-heritage people raised around Company settlements. They know both Imanian customs and the local Sauromatian world.

- **Profile:** mixed sex (2F + 1M, or 1F + 2M) · age 16–30 · Imanian bloodline 20–50% + Kiswani Riverfolk remainder · `newcomer` status
- **Languages:** Imanian 0.5–0.7 · Tradetalk 0.7–0.9 (strong) · Kiswani 0.8–1.0 (near-native)
- **Religion:** 60% `imanian_orthodox` / 40% `sacred_wheel` per person
- **GameConfig:** `companionChoices.townbornAuxiliaries`

Effects: immediate Tradetalk bridge; lowers starting Imanian blend; their children drift nativeward faster. **Supply bonus:** +0.10 to the Company supply modifier at `kethani_uplands` and `kethani_headwaters`.

#### Card C — Wildborn Sauromatian Women (default: off)

Adds 3 pure Sauromatian women arranged through a tribal intermediary. Their ethnic group and Tradetalk fluency depend on the chosen location.

- **Profile:** female · age 18–30 · pure Sauromatian bloodline · `sacred_wheel` · `newcomer` status · `extendedFertility: true` · `genderRatioModifier: 0.14`
- **Languages:** native tongue 1.0 · Tradetalk at location-scaled fluency (see table)
- **GameConfig:** `companionChoices.wildbornWomen`

Effects: Sacred Wheel religion active from turn 1 → religious tension with orthodox men; strong female birth skew; high long-term fertility from extended fertility.

**Wildborn ethnic group and Tradetalk fluency by location:**

| Location | Ethnic group | Tradetalk fluency |
|---|---|---|
| `kethani_mouth` | `kiswani_riverfolk` | 0.35 |
| `kethani_lowlands` | `kiswani_riverfolk` or `hanjoda_bloodmoon` (60/40 RNG) | 0.25 |
| `kethani_midreach` | `hanjoda_stormcaller` or `hanjoda_bloodmoon` (50/50 RNG) | 0.15 |
| `kethani_uplands` | `hanjoda_stormcaller` | 0.05 |
| `kethani_headwaters` | `hanjoda_stormcaller` | 0.0 — no shared language |

### Step 3 — Your Destination

Choose one of five points along the Kethani River. The choice sets starting resources and the Company supply modifier. For Wildborn companions, it also determines their ethnic group (see table above).

| Location | `LocationId` | Supply modifier | Starting resource adjustment |
|---|---|---|---|
| The Kethani Mouth | `kethani_mouth` | ×1.0 | Standard |
| The Kethani Lowlands | `kethani_lowlands` | ×0.85 | +5 food |
| The Kethani Midreach | `kethani_midreach` | ×0.60 | Standard |
| The Kethani Uplands | `kethani_uplands` | ×0.35 | +10 lumber, −5 food |
| The Kethani Headwaters | `kethani_headwaters` | ×0.15 | +5 stone, −10 food, −5 lumber |

The supply modifier scales the annual Company ship delivery (see §16 Economy). Townborn Auxiliaries add +0.10 to the modifier at the two westernmost locations. At `kethani_headwaters` the Company can barely reach you; self-sufficiency is essential from the start.

### Step 4 — Ready to Depart

Summary screen showing the full roster (name, sex, age, role, language note), settlement configuration, a cultural blend forecast bar, and the effective Company supply note. Click **Begin the Expedition** to call `newGame()`. A **Back** button returns to Step 3.

### Skip Intro Defaults

When **Skip Intro** is clicked on Step 0, `newGame()` is called immediately with:

| Field | Default | Reason |
|---|---|---|
| Settlement name | `"Kethani Post"` | Lore-accurate |
| Difficulty | `normal` | Standard conditions |
| Starting location | `kethani_mouth` | Closest to Company; all systems active |
| Imanian Wives | `false` | Clean roster; no pre-formed households |
| Townborn Auxiliaries | `false` | No extra language complexity |
| Wildborn Women | `true` | Sacred Wheel + cultural drift active from turn 1 |

### Camp Capacity

The starting `camp` building holds **20 people** — enough to house all 10 founding settlers plus all three companion groups simultaneously (combined maximum of approximately 22 people).

---

## 3. Quick Reference

### Resources (8 types)

| Resource | Notes |
|----------|-------|
| `food` | Primary survival resource. Consumed each season. |
| `cattle` | Herd animals. Every 2 cattle → +1 food per season passively. Stable halves winter spoilage. |
| `wealth` | Accumulated material value — tools, cloth, pots, trade credit. Generated every season by all working roles; split at source: 70% flows to the worker's household (`householdWealth`), 30% is settlement tax. Primary quota currency. Spoils at 1%/season. |
| `steel` | Produced by blacksmiths at the Smithy. High-value trade good. |
| `lumber` | Gathered by Lumberjacks or extracted from surrounding terrain. Required for most construction. |
| `stone` | Quarried. Required for advanced construction. |
| `medicine` | Made at Healer's Hut via crafting. Reduces mortality. |
| `horses` | Acquired via trade only. Distinct from cattle. Influence combat and diplomacy options. |

### Seasons & Production Modifiers

Wealth generation has **no seasonal modifier** — every role produces the same wealth yield year-round.
Food production is seasonally scaled. Stone and lumber (gather roles) are also unmodified.

| Season | Food production | Notes |
|--------|----------------|-------|
| Spring | ×1.0 | Annual Company ship arrives. |
| Summer | ×1.2 | Peak food production. |
| Autumn | ×1.6 | `co_annual_export` event fires (year ≥ 11). |
| Winter | ×0.4 | Hardship season. Spoilage worst. |

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

### Building Catalogue (50 types)

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
| Industry | `workshop` | General crafting. `craftsman` role generates 2 wealth/season. |
| | `pottery` | Pottery Kiln. Required by `compound` and `bathhouse`. 1 craftsman slot. |
| | `smithy` | 2 blacksmith slots. Steel production + 3 wealth/season per blacksmith. |
| | `tannery` | 2 tailor slots. 3 wealth/season per tailor. |
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
| Building chains *(household, additive — see §17)* | `barns_storehouses` · `farmstead` · `grain_silo` | Agriculture chain T2–T4 (extends `fields`). Cumulative +6 food/farmer. |
| | `cattle_pen` · `meadow` · `cattle_ranch` · `stock_farm` | Cattle Pastures chain T1–T4. Herder role; cattle + food yield. |
| | `orchard` · `berry_grove` · `beekeeper` · `grand_orchard` | Orchard chain T1–T4. Farmer role; food + wealth yield. |
| Building chains *(communal, upgrade/replace — see §17)* | `logging_camp` · `charcoal_burners` · `wood_pasture` · `sawmill` | Forestry chain T1–T4. Lumberjack role; lumber (+ wealth at T2+). |
| | `hunters_lodge` · `hound_pens` · `hunting_towers` · `hunting_reserve` | Hunting chain T1–T4. Hunter role; food (+ wealth at T2+) + defence bonus. |
| | `stone_quarry` · `ore_mine` · `large_quarry` · `shaft_mine` | Quarry chain T1–T4. Quarrier role; stone (+ steel at T2+). |
| | `infirmary` · `hospital` · `grand_hospital` | Hospice chain T2–T4 (extends `healers_hut`). Healer role; improved mortality + fertility. |

### Work Roles (23 values)

| Role | Notes |
|------|-------|
| `farmer` | Requires Tilled Fields to reach full output (+2 food bonus per season). |
| `gather_food` | Forager. Base 1 food/turn, scales with `plants` skill. No building required. Founding role. |
| `gather_stone` | Quarrier. Scales with `custom` skill. No seasonal modifier. |
| `gather_lumber` | Lumberjack. Scales with `custom` skill. No seasonal modifier. |
| `trader` | Generates wealth via trade activity (yield: 3/season — highest base rate). |
| `guard` | Produces nothing; provides settlement defence. |
| `craftsman` | General production for the workshop. |
| `healer` | Works at Healer's Hut. |
| `blacksmith` | Works at Smithy (2 slots). |
| `tailor` | Works at Tannery (2 slots). |
| `brewer` | Works at Brewery (2 slots). |
| `miller` | Works at Mill (2 slots). |
| `herder` | Works at Stable (2 slots). |
| `hunter` | Hunts for food using `combat` skill. Base 1–3 food/season (like `gather_food`). Generates 2 wealth/season. Hunting chain buildings add wealth at T2+; defence bonus at higher tiers. Trainable trade. |
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

## 4. Turn Structure & Seasons

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
16. Apply building maintenance — settlement pays `maintenanceCost` from `settlement.resources.wealth` for each built building; unpaid buildings gain `neglected: true` (bonuses suspended)
17. **Wealth generation** — `calculateWealthGeneration()`: each person's `WEALTH_YIELD[role]` × happiness multiplier × trade-training bonus; 70% flows to their household's `householdWealth`, 30% settles as settlement tax
18. Apply dwelling maintenance — each household's `householdWealth` pays `DWELLING_MAINTENANCE[tier]` per season; `wealthMaintenanceDebt` increments if unpaid (at 2+ a downgrade event is queued)
19. Autonomous private building pass — households spend household wealth on private construction (`processPrivateBuilding`, step 9.7.5)
20. Company supply delivery (Spring only) — food, wealth, and medicine from the Company ship, scaled by `locationSupplyModifier` and `supportLevel`
21. Draw events (eligible events weighted by trait boosts, cooldowns, and prerequisites)

*Expedition processing (advance travel, hex entry checks, inject expedition events) runs in the store after `processDawn` returns, before the management phase.*

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

## 5. Population, Genetics & Inheritance

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

## 6. Heritage, Bloodlines & Culture

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

## 7. Language Acquisition

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

## 8. Religion

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

## 9. Cultural Identity Pressure

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

## 10. Households

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

## 11. Opinions & Opinion Modifiers

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

## 12. Ambitions & Autonomous Events

Every person can hold one ambition at a time. An ambition has a type, an intensity (0–1.0), and optionally a target person.

### Intensity Mechanics

- **Formation** starts at intensity 0.10
- **Growth**: +0.05 per turn
- **Cap**: 1.0
- **Block**: the `content` trait suppresses all ambition growth
- **Firing threshold**: events gate on intensity ≥ **0.70**
- **Stale limit**: 40 turns (30 for `seek_companion`)

### The 13 Ambition Types

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
| 11 | `seek_better_housing` | Household head; current dwelling tier < 4 (or no dwelling). Drives autonomous household upgrade purchases. |
| 12 | `seek_production_building` | Household specialist member (blacksmith/brewer/etc.) has no matching production building in household slots. |

**Blocking conditions (all ambitions):** `content` trait; `role = 'away'`; `socialStatus = 'thrall'`.

### Ambition Badge UI

PersonDetail shows a colour-coded badge beneath the traits section:
- Dim grey: intensity below 0.3
- Amber: intensity 0.3–0.69
- Rose: intensity ≥ 0.70 (at firing threshold)

A progress bar shows the exact intensity, with a `title` tooltip showing the percentage.

---

## 13. Named Relationships, Schemes & Factions

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

## 14. Skills & Apprenticeships

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

## 15. Events

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

## 16. Economy

### Wealth Generation

Every working settler generates wealth each season. Wealth is split at source:
- **70%** flows into the household's `householdWealth` treasury
- **30%** is settlement tax, added to `settlement.resources.wealth`

**`WEALTH_YIELD` per role (units/season):**

| Role | Yield | Role | Yield |
|------|-------|------|-------|
| `gather_food` | 0.1 *(fractional — accumulates ~10 seasons to 1 unit)* | | |
| `farmer` | 1 | `guard` | 1 |
| `gather_stone` | 1 | `gather_lumber` | 1 |
| `healer` | 2 | `craftsman` | 2 |
| `herder` | 2 | `miller` | 2 |
| `hunter` | 2 | `brewer` | 2 |
| `bathhouse_attendant` | 2 | | |
| `trader` | 3 | `blacksmith` | 3 |
| `tailor` | 3 | | |
| `priest_solar` | 1 | `wheel_singer` | 1 |
| `voice_of_wheel` | 1 | `keth_thara` | 1 |
| `builder` | 1 | | |
| `away`, `unassigned`, `child` | 0 | | |

Yield is multiplied by the happiness multiplier and `1 + tradeTraining[role] / 100`. Roles not in this table generate 0.

### Company Quota

Years 1–10 are a **grace/investment phase** — no quota is expected. From year 11 onward, the Ansberry Company demands annual wealth deliveries.

**Quota formula:**

```
year ≤ 10 → quota = 0
year N ≥ 11 → quota = 10 + (N − 10) × 5
```

| Year | Wealth quota |
|------|-------------|
| 11 | 15 |
| 12 | 20 |
| 13 | 25 |
| 15 | 35 |
| 20 | 60 |

Each Autumn of year ≥ 11, the **`co_annual_export`** event ("The Year-End Reckoning") fires. The player decides how much to send:

| Choice | Condition | `quotaStatus` | Standing |
|--------|-----------|---------------|---------|
| Send the full quota | `wealth ≥ quota` | `met` | +3 |
| Exceed the quota (125%) | `wealth ≥ quota × 1.25` | `exceeded` | +8 |
| Send everything we have | `0 < wealth < quota` | `partial` | −10 |
| Send nothing | Always available | `failed` | −15 |

Consecutive failures escalate `CompanySupportLevel`: `full_support` → `standard` → `reduced` → `minimal` → `abandoned`.

**Annual ship** arrives each Spring. Delivers resources scaled by `locationSupplyModifier` and `supportLevel`:

| Support level | Delivery |
|--------------|---------|
| `full_support` | 15 food, 12 wealth, 5 medicine |
| `standard` | 10 food, 7 wealth |
| `reduced` | 5 food, 3 wealth |
| `minimal` | 2 food |
| `abandoned` | Nothing |

### Tribe Trade

Requires both: a `trading_post` is built AND `tribe.diplomacyOpened = true`.

**Barter fairness meter:** ±30% value ratio is the fair band. Favoring yourself (>+30% your way) reduces the tribe's disposition. Favoring the tribe (>+15% their way) increases it.

The trade interface is locked without a Trading Post. TradeView shows the locked panel in that state.

### Internal Crafting

| Recipe | Requirements | Input | Output |
|--------|-------------|-------|--------|
| `craft_cattle_slaughter` | None | 2 cattle | 3 food |
| `craft_horse_breeding` | Stable | 2 horses + 4 food | 1 horse |
| `craft_medicine_prep` | Healer's Hut | 3 food + 2 wealth | 4 medicine |
| `craft_boat` | Dock | 15 lumber | 1 boat (+1 `boatsInPort`) |

### Spoilage

Runs at dawn each turn. Rates:
- `food`: 5%/season (Summer ×1.5; Granary halves this)
- `cattle`: 3%/season (Winter ×2; Stable halves this)
- `medicine`: 2%/season
- `wealth`: 1%/season (no seasonal modifier; no building mitigation)

Spoilage < 1 unit is ignored (no fractional loss).

### Building Maintenance

Each season, every built building deducts its `maintenanceCost` from `settlement.resources`. Key costs:

| Building | wealth/season | Other |
|----------|--------------|-------|
| `camp`, `fields`, `palisade`, dwellings | 0 | — |
| `longhouse` / `roundhouse` | 1 | — |
| `great_hall`, `trading_post` | 2 | — |
| `granary`, `workshop`, `smithy`, `tannery`, `brewery`, `mill`, `healers_hut`, `gathering_hall`, `clan_lodge`, `pottery` | 1 | — |
| `stable` | 0 | 1 lumber/season |
| `bathhouse` | 2 | 1 stone/season |

If the settlement cannot pay a building's maintenance that season, the building is marked `neglected: true`. Neglected buildings do not apply `roleProductionBonus`, `skillGrowth`, or `fertilityBonus` effects. The neglected flag clears automatically when wealth is available the following season.

### Private Economy

#### Household Wealth

Each household accumulates `householdWealth` from the per-session wealth generation pass (70% of each member's yield). Transfers to the surviving household on marriage merge.

#### Dwelling Maintenance

Private dwellings drain from household wealth each season:

| Dwelling tier | Household wealth / season |
|--------------|--------------------------|
| `wattle_hut` | 0 — basic survival, free |
| `cottage` | 1 |
| `homestead` | 2 |
| `compound` | 4 |

If a household cannot pay for 2 consecutive seasons (`wealthMaintenanceDebt ≥ 2`), a downgrade event fires.

#### Autonomous Private Building (`processPrivateBuilding`)

Runs each dawn at step 9.7.5. Households with sufficient wealth commission private construction without player approval. Two paths:

- **Path A — no dwelling:** When a household has no dwelling, a `wattle_hut` is commissioned automatically once wealth is sufficient — **no ambition required**. Basic shelter is treated as a necessity.
- **Path B — upgrade or specialist building:** Driven by a `seek_better_housing` or `seek_production_building` ambition on the household head or senior wife. Dwelling upgrades target exactly the next tier up; specialist builds target the role-matching building from `ROLE_TO_BUILDING`.

A `hasActiveProject` guard prevents duplicate commissions. All required materials are checked against `settlement.economyReserves` floors before purchase.

**Private wealth costs (key examples):**

| Building | Wealth cost |
|----------|------------|
| `wattle_hut` | 1 |
| `cottage` | 3 |
| `homestead` | 6 |
| `compound` | 12 |
| `fields` | 2 |
| `stable` | 4 |
| `smithy` | 5 |

**`ROLE_TO_BUILDING` specialist mapping:** `farmer` → `fields`, `blacksmith` → `smithy`, `brewer` → `brewery`, `tailor` → `tannery`, `miller` → `mill`, `herder` → `stable`.

#### Reserve Floors

`settlement.economyReserves: Partial<ResourceStock>` — per-resource minimum floors set in the **Economy tab**. Household purchases are blocked if any required material is below its floor. **Surplus** = `max(0, current − floor)`. Low floors give households more purchasing latitude; high floors protect communal production.

#### Company Funding Ends Event

`eco_company_funding_ends` fires in Spring of year 10 as a warning — no choices, pure notification. Starting year 11, the settlement must self-fund all operations from settlement wealth.

## 17. Settlement Buildings & Construction

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

### Building Chains

Seven expandable production chains add 26 buildings to the catalogue. Each chain extends a T1 root building through T2, T3, and T4.

**Household chains (additive — each tier occupies its own household building slot; all tiers can coexist simultaneously):**

| Chain | Worker role | T1 | T2 | T3 | T4 |
|-------|-------------|----|----|----|----|   
| Agriculture | `farmer` | `fields` *(existing)* | `barns_storehouses` | `farmstead` | `grain_silo` |
| Cattle Pastures | `herder` | `cattle_pen` | `meadow` | `cattle_ranch` | `stock_farm` |
| Orchards | `farmer` | `orchard` | `berry_grove` | `beekeeper` | `grand_orchard` |

**Communal chains (upgrade/replace — higher tier replaces the previous; only one tier active at a time):**

| Chain | Worker role | T1 | T2 | T3 | T4 |
|-------|-------------|----|----|----|----|   
| Forestry | `gather_lumber` | `logging_camp` | `charcoal_burners` | `wood_pasture` | `sawmill` |
| Hunting | `hunter` | `hunters_lodge` | `hound_pens` | `hunting_towers` | `hunting_reserve` |
| Quarry | `gather_stone` | `stone_quarry` | `ore_mine` | `large_quarry` | `shaft_mine` |
| Hospice | `healer` | `healers_hut` *(existing)* | `infirmary` | `hospital` | `grand_hospital` |

**Rules:**
- Household chains stack — all four tiers can coexist; slot scarcity forces specialisation choices.
- Communal tiers use `replacesId`; the prior tier is removed on completion of the next.
- Higher tiers always `requires` the previous tier first.
- Quarry T2+ (`ore_mine`) produce steel in addition to stone.
- Hunting buildings add a defence bonus and combat skill growth for hunters.
- Orchard workers use the `farmer` role; buildings produce food and generate wealth like all farmer roles.

---

## 18. Private Dwellings & Worker Slots

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

### Autonomous Private Building

See **§16 Economy — Private Economy** for full details. Households spend `householdWealth` to commission private construction without player approval. `compound` and `bathhouse` both require a `pottery` building as a prerequisite.

---

## 19. Immigration & Prosperity

### Prosperity Score

`computeProsperityScore(state)` produces a number used as a prerequisite gate for immigration events:

```
prosperityScore =
  buildings.length × 3
  + floor(food / 15)
  + floor(wealth / 3)
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

## 20. Happiness, Morale & Desertion

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

## 21. Sauromatian Courtship

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

## 22. Diplomacy & External Tribes

### Tribe Data Model

Each neighbouring tribe has:
- `disposition` — their attitude toward the settlement (−100 to +100)
- `contactEstablished: boolean` — whether the expedition has made contact
- `trait` — one of: `warlike`, `peaceful`, `isolationist`, `trader`, `expansionist`, `desperate`
- `lastTradeTurn` — enforces one trade per turn cooldown

**16 tribe presets** defined in `TRIBE_PRESETS`. Initial tribes are selected at game setup.

### Tribe Naming Conventions

Sauromatian tribe names follow a **[Color] + [Noun] closed compound** pattern. Each ethnic group owns three colours and a noun pool drawn from their environment and character. The colour prefix alone identifies the ethnic group — `Ash-` / `Pale-` / `White-` = Stormcaller; `Red-` / `Ochre-` / `Crimson-` = Bloodmoon; `Amber-` / `Gold-` = Talon; and so on.

### Tribe Roster

| ID | Name | Ethnic Group | Starting Disposition | Traits |
|---|---|---|---|---|
| `bluetide` | Bluetide | Kiswani Riverfolk | +25 | peaceful, trader |
| `darkwake` | Darkwake | Kiswani Riverfolk | −10 | warlike, expansionist |
| `jadehollow` | Jadehollow | Kiswani Bayuk | 0 | isolationist |
| `greenthorn` | Greenthorn | Kiswani Bayuk | −15 | warlike, desperate |
| `silvercrest` | Silvercrest | Kiswani Haisla | +20 | peaceful, trader |
| `greysquall` | Greysquall | Kiswani Haisla | −20 | warlike |
| `ashmantle` | Ashmantle | Hanjoda Stormcaller | +15 | peaceful |
| `paleveil` | Paleveil | Hanjoda Stormcaller | −5 | isolationist |
| `redmoon` | Redmoon | Hanjoda Bloodmoon | −25 | warlike, expansionist |
| `ochrescar` | Ochrescar | Hanjoda Bloodmoon | −10 | warlike |
| `ochredrift` | Ochredrift | Hanjoda Bloodmoon | +5 | peaceful, trader |
| `crimsonfang` | Crimsonfang | Hanjoda Bloodmoon | −30 | warlike, desperate |
| `goldhand` | Goldhand | Hanjoda Talon | +10 | peaceful, trader |
| `ambercairn` | Ambercairn | Hanjoda Talon | −5 | isolationist |
| `bronzemouth` | Bronzemouth | Hanjoda Emrasi | +20 | peaceful, trader |
| `copperhook` | Copperhook | Hanjoda Emrasi | +5 | peaceful |

### Trade

Full barter UI available in the **Trade** view once a Trading Post is built and contact is established. Trades affect tribe disposition based on fairness (see §16 Economy).

### Diplomacy View & Hex Map

The **Diplomacy** view shows the Known Clans panel (left) and an interactive hex map (right). The hex map is an SVG overlay on the Ashmark background image; unrevealed hexes render as opaque fog tiles. Entered hexes show the terrain art beneath.

### Tribe Visibility & Contact Tiers

Tribes progress through three tiers as the player engages with them:

| Tier | Flag | How achieved | What it unlocks |
|------|------|-------------|-----------------|
| **Sighted** | `sighted: true` | Expedition enters the tribe's territory or an adjacent hex | Tribe appears in Known Clans as `??? — Sighted`. Name hidden. Emissary available. |
| **Contact** | `contactEstablished: true` | Expedition physically enters a tribe territory/outpost/settlement hex | Full tribe details visible. All emissary missions available. |
| **Relations** | `diplomacyOpened: true` | Set by expedition outcome or a successful `open_relations` emissary mission | Trade unlocked. Alliance events available. |

**Additional `ExternalTribe` fields:**
- `territoryQ / territoryR: number | null` — hex coordinates of the tribe's territory centre
- `giftedTurns: number | null` — last turn gifts were sent; gift bonus halves if repeated in the same year

### Emissary System

From the TribeInfoCard or the "Send Emissary" button at the bottom of the Known Clans panel, the player dispatches a single person as a diplomat via `EmissaryDispatchOverlay`. No hex-by-hex events fire during emissary travel — only full expeditions trigger mid-journey encounters.

**Mission types (4):**
| Mission | Minimum tier | Effect |
|---------|--------------|--------|
| `open_relations` | `contactEstablished` | Sets `diplomacyOpened = true` on session success; requires disposition ≥ 20 (or ≥ 5 for `trader` tribes) |
| `gift_giving` | `sighted` | Pack wealth/food as gifts; improves disposition |
| `request_food` | `contactEstablished` | Ask for a food grant; locked if tribe disposition < 0 or tribe desires food itself |
| `request_goods` | `contactEstablished` | Ask for a goods grant; locked for same reasons |

**Travel time:** `ceil(axialDistance / 2)` seasons one-way; −1 turn for bargaining skill ≥ 63 (Excellent). Round-trip = `travelOneWay × 2 + 1`. Unknown territory falls back to 4 turns.

The emissary is set to `role = 'away'` while travelling. When `arrivalTurn` is reached at dawn, the emissary's `EmissaryDispatch` status advances to `at_tribe` and the emissary ID is added to `pendingDiplomacySessions` — a pulsing amber badge on the Known Clans header invites the player to open the session.

**`EmissaryDiplomacyOverlay` — session actions:**

| Action | Availability | Effect |
|--------|-------------|--------|
| Offer Gifts | Always (uses `giftsRemaining`) | Applies `giftDispositionGain`; can be repeated |
| Ask for Food | Once per session; disposition ≥ 0; tribe not desiring food | Credits food to settlement immediately on session close |
| Ask for Goods | Once per session; disposition ≥ 0; tribe not desiring goods | Credits goods to settlement immediately |
| Propose Trade | Once; `!diplomacyOpened`; disposition ≥ 20 (≥ 5 for traders) | Sets `diplomacyOpened = true`; trade route activates on emissary return |
| Take Your Leave | Always | Closes session; emissary begins return journey |

All session outcomes (disposition delta, `diplomacyOpened`, resources received) are applied to `GameState` immediately when the player takes their leave. Unused packed gifts are returned to the settlement stockpile when the emissary physically returns at `returnTurn`.

**Gift formula (`giftDispositionGain`):**
- Base: wealth × 4 + food × 1 per unit
- Tribe desires the resource type: +50% for that resource
- Tribe trait: warlike ×0.70 · isolationist ×0.60 · desperate ×1.50
- Gifted within last 4 turns (`giftedTurns` flag): ×0.50 (diminishing returns same year)
- Cap: +40 per session

**Resource request yield (`computeResourceRequestYield`):**
`floor(population / 40 × clamp(disposition / 50, 0.2, 1.5))` — returns 0 if tribe disposition < 0 or tribe desires that resource.

**Key files:**
| File | Purpose |
|------|---------|
| `src/simulation/world/emissaries.ts` | `emissaryTravelTime`, `giftDispositionGain`, `computeResourceRequestYield`, `createEmissaryDispatch`, `resolveEmissarySession` |
| `src/ui/overlays/EmissaryDispatchOverlay.tsx` | Dispatch modal — tribe dropdown, 4 mission types, person picker, gift sliders |
| `src/ui/overlays/EmissaryDiplomacyOverlay.tsx` | Session negotiation modal — gift offers, resource requests, propose trade, take your leave |

The **"Send Expedition"** button at the bottom of the Known Clans panel opens `ExpeditionDispatchOverlay`. See §26 for the full expedition system.

### Identity Pressure & Tribes

Each turn in a cultural pressure zone, tribe dispositions shift in response to the settlement's blend position (see §9). Tribes respond to how Imanian or Sauromatian your settlement appears.

---

## 23. Portraits & Character Display

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

## 24. Systems Interconnection

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
| Expedition travel | Tribe contact (`contactEstablished`); hex visibility (fog → scouted → visited); expedition events injected into settlement queue |
| Household wealth (`householdWealth`) | Autonomous private building; `seek_better_housing` / `seek_production_building` ambition fulfillment |
| Settlement `economyReserves` | Surplus available for household purchases; player control over household autonomy |
| Annual export event (`co_annual_export`) | Company standing; `CompanySupportLevel`; annual supply delivery |

**Critical feedback loops:**
1. **Happiness → culture → identity pressure → Company standing** — unhappy settlers assimilate slower, which may help or hurt depending on the blend direction.
2. **Opinion → relationships → schemes → events** — high/low opinion builds bonds which shape what schemes form, which shape what events fire.
3. **Immigration → prosperity → building → prosperity** — more buildings raise the prosperity score, which unlocks better immigration events, which add more people, which enables more building.
4. **Religion → tension → events → religion** — religious composition generates events that can convert people, changing the composition.

---

## 25. Glossary

| Term | Definition |
|------|-----------|
| **Ambient event** | An event marked `isAmbient: true`. Subject to a minimum 16-turn cooldown — at most once per in-game year. |
| **Ansberry Company** | Your external patron. Funds the expedition, demands annual quotas, can withdraw support or abandon the settlement. |
| **Ansberite** | Cultural identity associated with the Company and Imanian heritage. Opposite end of the blend scale from "Native." |
| **Ashka-Melathi** | A deep female friendship bond between Sauromatian women in the same household. |
| **Away** | A `WorkRole` state. A person sent on an external mission. Unavailable for all other purposes until they return. |
| **Blend scale** | `settlement.culture.culturalBlend`: 0.0 = pure Imanian / 1.0 = pure Sauromatian. |
| **`boatsInPort`** | Settlement field tracking available boats. Starts at 1. Decrements on expedition dispatch; restores on return. |
| **Bound actors** | Named character slots filled when an event is drawn. Text is interpolated with their names and pronouns. |
| **Builder** | A `WorkRole`. Temporarily assigned to a construction project. |
| **Building chain** | An expandable 4-tier production line (Agriculture, Cattle Pastures, Orchards, Forestry, Hunting, Quarry, Hospice). Household chains are additive; communal chains replace the previous tier. |
| **Co-actor auto-bond** | A +2 timed `opinionModifier` that forms automatically between every pair of actors in a resolved event. |
| **Compound** | Highest-tier private dwelling (`wattle_hut` → `cottage` → `homestead` → `compound`). |
| **Confidant** | A named relationship that suppresses `scheme_undermine_person` generation against the confidant. |
| **Content** (trait) | Blocks all ambition formation and intensity growth. |
| **Dawn** | The beginning of each turn. All simulation processing happens here before the player's management phase. |
| **Derived skill** | A skill computed on demand from base skills (Deception, Diplomacy, Exploring, Farming, Hunting, Poetry, Strategy). |
| **Deferred event** | An event scheduled for a future turn via `isDeferredOutcome: true`. Actors and context are preserved. |
| **Desertion** | When `lowHappinessTurns ≥ 3`, a settler becomes eligible to leave. Their family may follow. |
| **`diplomacyOpened`** | Flag on `ExternalTribe`. Set when formal relations are established; gates trade and alliance events. |
| **Disposition** | A tribe's attitude toward the settlement (−100 to +100). |
| **Dusk** | The end-of-turn processing after the player clicks Confirm Turn. Production, spoilage, quota check. |
| **Effective opinion** | `relationships` base value + sum of all active timed `opinionModifiers`, clamped [−100, +100]. |
| **Expedition** | A group of settlers dispatched to travel the hex map, reveal terrain, and make tribe contact. |
| **Extended fertility** | `extendedFertility = true` on a person. Females remain fertile to age 52–55. Matrilineal inheritance. |
| **Founding member** | A `SocialStatus`. The 6–8 people who begin the game. |
| **Hex Map** | The 21×21 axial hex grid of the Ashmark region. Settlement at `(10, 10)`. Explored through expeditions. |
| **Hidden Wheel** | `syncretic_hidden_wheel` — an emergent syncretic faith. Forms after 20 turns of mixed Orthodox/Wheel presence. |
| **Household wealth** | `householdWealth: number` on `Household`. Accumulated from per-job wealth generation (70% share). Spent autonomously on private buildings. Transfers to the surviving household on marriage merge. |
| **Identity pressure** | `companyPressureTurns` / `tribalPressureTurns` counters that track how long the blend has been outside the safe zone. |
| **Keth-Thara** | A Sauromatian cultural duty role for young men (age 16–24). Fulfils `seek_cultural_duty`. |
| **Low morale turns** | `lowMoraleTurns` on `GameState`. Increments when settlement morale < −20. Gates crisis events. |
| **Mentor** | A named relationship that alone can generate `scheme_tutor_person` without any trait. |
| **Nemesis** | A named relationship formed at sustained low opinion (≤ −50). Alone generates `scheme_undermine_person`. |
| **Opinion modifier** | A timed, decaying delta on a person's opinion of another. Separate from the permanent `relationships` map. |
| **`wealthMaintenanceDebt`** | Counter on `Household`. Increments each season a household cannot pay dwelling maintenance. At 2+ a forced downgrade event is queued. |
| **Primary culture** | The highest-weighted culture in a person's drift map, or `settlement_native` if none exceeds 50%. |
| **Prosperity score** | A computed number gating immigration events: `buildings×3 + floor(food/15) + floor(wealth/3) + floor(pop/5)`. |
| **Reserve floors** | `settlement.economyReserves: Partial<ResourceStock>`. Per-resource minimum thresholds set in the Economy tab. Surplus = current − floor; household purchases are blocked if any required material is below its floor. |
| **RNG** | Seeded pseudo-random number generator (`createRNG(seed)` in `src/utils/rng.ts`). All randomness flows through this. Never use `Math.random()`. |
| **Safe zone** | Cultural blend range 0.25–0.65 where neither Company standing nor tribe dispositions are affected by identity pressure. |
| **Sauromatian** | The tribal peoples native to the region. Their women have a female-skewed gender ratio, extended fertility, and the Sacred Wheel faith. |
| **`seek_better_housing`** | Ambition type. Generated by a household head when the household's dwelling tier is below `compound`. Drives autonomous dwelling upgrades. |
| **Settlement native** | `settlement_native` culture. Seeds at 0.05 for children born in the settlement; grows over generations. |
| **Scheme** | A multi-turn personal project run autonomously by a character. Completes by firing a climax event. |
| **Skill tier** | Fair (1–25) / Good (26–45) / Very Good (46–62) / Excellent (63–77) / Renowned (78–90) / Heroic (91–100). |
| **Social status** | `founding_member`, `settler`, `newcomer`, `elder`, `outcast`, or `thrall`. |
| **Thrall** | A `SocialStatus`. Cannot form ambitions. Freed by event choice or by bearing a son. |
| **Trade training** | `person.tradeTraining` — graduated apprenticeship bonuses. Applied as `1 + bonus/100` multiplier in production. |
| **Voice archetype** | A council adviser's personality type: bold / pragmatist / diplomat / traditionalist / cautious / schemer. |

---

## 26. Expeditions

### Overview

The Known Clans (Diplomacy) view renders a **21×21 hex grid** as an SVG overlay on the Ashmark background image. At game start, the settlement hex and three adjacent hexes are visible — everything else is fog. Expeditions physically move through the grid, revealing terrain as they go and triggering narrative events at points of interest.

### The Hex Map

- **21×21 axial grid** (pointed-top orientation). Settlement always at `(10, 10)`.
- **10 terrain types:** `plains`, `forest`, `jungle`, `hills`, `mountains`, `river`, `wetlands`, `coast`, `ruins`, `desert`.
- **Visibility states:** `fog` (dark tile, unknown) → `scouted` (terrain visible, no content detail) → `visited` (expedition entered; full content icons) → `cleared` (all one-time content found).
- **Hex content types:** one-time discoveries (`ruins`, `landmark`, `resource_cache`, `hidden_shrine`, `abandoned_camp`, `burial_ground`, `fresh_water_spring`, `old_road`); tribe markers (`tribe_territory`, `tribe_outpost`, `tribe_settlement`); recurring hazards (`travellers`, `animal_den`, `bandit_camp`, `disease_vector`, `weather_hazard`).

### Travel Speed by Terrain

| Terrain | Hexes/season (foot) | Hexes/season (boat) |
|---------|---------------------|---------------------|
| `plains` | 4 | — |
| `forest` | 2 | — |
| `coast` | 2 | — |
| `hills` / `wetlands` / `ruins` / `desert` / `jungle` | 1 | — |
| `mountains` | 0.5 (2 seasons/hex) | — |
| `river` | 1 | 6 |

### Expedition Data Model (key fields)

```typescript
interface Expedition {
  id: string;
  name: string;             // player-facing (default: "{Leader}'s Expedition")
  leaderId: string;
  memberIds: string[];      // up to 10 members
  hasBoat: boolean;
  provisions: { food: number; goods: number; gold: number; medicine: number };
  currentQ: number; currentR: number;
  waypoints: ExpeditionWaypoint[];
  status: 'preparing' | 'travelling' | 'at_hex' | 'returning' | 'completed' | 'lost';
  foodRemaining: number;
  travelProgress: number;   // counts down to 0 at the current terrain speed
}
```

### Dispatching an Expedition

1. Click **"Send Expedition"** at the bottom of the Known Clans panel in DiplomacyView.
2. The `ExpeditionDispatchOverlay` opens: choose a leader, up to 10 party members, and whether to use a boat.
3. Set provisions (food slider; indicator shows minimum needed: `members × 0.25 × estimated seasons`).
4. Click hexes on the mini-map to define an ordered waypoint route.
5. Click **Dispatch** — members are set to `role = 'away'`; `boatsInPort` decrements by 1 if a boat is used.

**Boat pool (`boatsInPort`):**  Starts at 1 (the Company arrival vessel). Additional boats require a Dock building + `craft_boat` recipe. Any boat committed to an expedition is unavailable until it returns.

### Turn Processing

Expedition processing runs in `game-store.startTurn()` after `processDawn` returns (before the management phase). Each expedition per turn:

1. **Deduct food:** `foodRemaining -= memberCount × 0.25`. Starvation flag set if food reaches 0.
2. **Advance travel:** `travelProgress` decrements by terrain speed. When it hits 0 the expedition enters the next waypoint hex.
3. **On hex entry:** hex visibility updated to `visited`; 6 adjacent hexes updated to `scouted`. One-time content triggers fire. Tribe territory detected (see below).
4. **Expedition events** are injected into `pendingEvents` and resolve before the management phase like normal events. Events show a `⛺ Expedition: {name}` banner in the EventView to contextualise them.
5. When the waypoint list is exhausted the expedition returns to the settlement. On arrival, members regain their pre-dispatch role; `boatsInPort` is restored.

### Tribe Contact

Entering a hex with `tribe_territory`, `tribe_outpost`, or `tribe_settlement` content automatically sets `tribe.contactEstablished = true`. Adjacent-only entry (the party never enters the hex directly) sets `tribe.sighted = true` — the tribe appears in the Known Clans list as `??? — Sighted` with details hidden. Full contact requires physical entry. Trade requires `diplomacyOpened = true` (set via expedition outcome or emissary mission).

### Expedition Events (18 authored)

All expedition events have `isDeferredOutcome: true` and category `'expedition'`. They are injected programmatically by `processExpeditions` / `collectHexEntryEvents` — never drawn from the normal event deck.

**Group A — One-time hex discoveries (fire once per hex on first entry):**

| Event ID | Trigger |
|----------|---------|
| `exp_ruins_discovered` | `ruins` hex content |
| `exp_abandoned_camp_found` | `abandoned_camp` content |
| `exp_burial_ground_entered` | `burial_ground` content |
| `exp_hidden_shrine_discovered` | `hidden_shrine` content |
| `exp_fresh_water_spring` | `fresh_water_spring` content — no choices; passive buff to future travel |
| `exp_old_road_found` | `old_road` content |
| `exp_resource_cache_found` | `resource_cache` content |

**Group B — Tribe contact (fire on first entry into a tribe hex):**

| Event ID | Trigger |
|----------|---------|
| `exp_tribe_territory_entered` | `tribe_territory` content (first contact) |
| `exp_tribe_settlement_approached` | `tribe_settlement` content; can set `diplomacyOpened` on success |
| `exp_tribe_patrol_encountered` | `tribe_outpost` content or recurring patrol roll |

**Group C — Recurring encounters (roll each visit to eligible hex):**

| Event ID | Trigger |
|----------|---------|
| `exp_animal_attack` | `animal_den` content |
| `exp_travellers_met` | `travellers` content |
| `exp_disease_outbreak` | `disease_vector` content (wetlands) |
| `exp_bandit_ambush` | `bandit_camp` content |
| `exp_severe_weather` | `weather_hazard` content |

**Group D — Supply & morale (injected by expedition state):**

| Event ID | Trigger |
|----------|---------|
| `exp_food_running_low` | `foodRemaining < 1 season's worth`; fires once per expedition |
| `exp_member_wants_to_turn_back` | Injected periodically when expedition has multiple members |

**Return:**

| Event ID | Trigger |
|----------|---------|
| `exp_return_report` | Fires when expedition reaches `status = 'completed'`; narrative journal summary |

### Expedition Status Panel

Hovering an expedition token on the hex map shows a tooltip (leader name, party size, food remaining, seasons to next hex). Clicking the token opens the `ExpeditionStatusPanel` (inline in `DiplomacyView.tsx`) — a slide-in panel with full party list, route, journal, and a **Recall Expedition** button.

### Key Files

| File | Purpose |
|------|---------|
| `src/simulation/world/hex-map.ts` | `HexCell`, `HexMap`, `generateHexMap()`, coordinate math, visibility helpers |
| `src/simulation/world/expeditions.ts` | `createExpedition()`, `processExpeditionTurn()`, `processExpeditions()`, `collectHexEntryEvents()`, food math |
| `src/simulation/events/definitions/expedition.ts` | All 18 expedition event definitions |
| `src/ui/overlays/ExpeditionDispatchOverlay.tsx` | Party picker, provisions sliders, route setter, boat toggle |
| `src/ui/components/HexGrid.tsx` | SVG hex grid renderer; fog/scouted/visited/cleared states; expedition tokens; waypoint lines |
| `src/ui/overlays/EmissaryDispatchOverlay.tsx` | Single-person emissary mission (`open_relations` / `gift_giving`) |
| `src/ui/overlays/EmissaryDiplomacyOverlay.tsx` | Emissary outcome and resolution |
| `tests/world/hex-map.test.ts` | Hex generation rules, coordinate math, visibility propagation |
| `tests/world/expedition-events.test.ts` | Travel progress, food deduction, hex entry, return mechanics, event firing |

**Outstanding (Phase F):** Waypoint amendment during active expeditions; winter mountain terrain modifiers (`winterPassClosed` impassability flag). See `plans/EXPEDITION_SYSTEM.md §12`.

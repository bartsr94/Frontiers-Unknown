# Intro Sequence & Expedition Setup — Design Specification

> **Status:** Design — not yet implemented
> **Replaces:** `GameSetup.tsx` (single-form screen) + `GameConfig.includeSauromatianWomen` (single toggle)
> **Scope:** `src/ui/overlays/GameSetup.tsx` (replace), `src/simulation/turn/game-state.ts` (extend `GameConfig`), `src/simulation/turn/initial-state.ts` (extend factory)

---

## 1. Design Intent

The intro sequence serves two purposes simultaneously:

1. **Narrative grounding** — the player learns why their expedition exists, who sent them, and what they owe before a single turn is taken. The world feels real before the mechanics begin.
2. **Meaningful customisation** — a handful of choices made during setup have genuine long-term mechanical consequences for demographics, language, cultural blend, and Company access. These are not cosmetic toggles; they determine the shape of the whole campaign.

The sequence replaces the current single-form `GameSetup` screen with a multi-step wizard. Each step is one page; navigation is linear. A **Skip** button on the first screen applies defaults and jumps directly to turn 1, bypassing all narrative and custom choices. This is explicitly a developer/testing convenience and should be visually distinguished as such.

---

## 2. Narrative Frame

### Setting the Scene

The player commands a small group of Ansberry Company men — chartered settlers, not soldiers — sent upriver to establish a permanent presence on the **Kethani River**, the Sauromatian name for the main westward tributary of the Black River that drains the central Ashmark. The Company has not yet renamed it.

The expedition has already completed the bulk of its journey. The game begins at the moment of founding: the boats are grounded, the camp is going up, and the decisions about who is present and where you are have already been made. The intro sequence is a structured recollection of those pre-game choices, delivered as in-world briefing text with the mechanical selections embedded naturally within it.

### Tone

The text should be matter-of-fact with an undercurrent of risk. The Company is far away. The land is not empty. The people the player will encounter have their own histories, languages, and loyalties — some of which are known to the expedition and many of which are not. There is no triumphalism about this. You were given a charter and a handful of men. Prove it was worth the ink.

---

## 3. Screen Flow

```
App.tsx
  └─ no gameState →  IntroSequence (new component, replaces GameSetup)
       │
       ├─ Step 0: TITLE / PREAMBLE        [narrative text only; no choices]
       │    └─ "Begin" → Step 1
       │    └─ "Skip Intro" → default config → newGame()
       │
       ├─ Step 1: THE CHARTER             [settlement name; difficulty]
       │    └─ "Next" → Step 2
       │
       ├─ Step 2: YOUR COMPANIONS         [three stackable composition toggles]
       │    └─ "Next" → Step 3
       │
       ├─ Step 3: YOUR DESTINATION        [five Kethani locations; visual selector]
       │    └─ "Next" → Step 4
       │
       └─ Step 4: READY TO DEPART        [summary; "Begin the Expedition" → newGame()]
```

Progress is tracked as `step: 0 | 1 | 2 | 3 | 4`. The player can navigate **back** freely from steps 1–4. Back from step 0 is a no-op. There is no explicit step number displayed; the immersion would suffer.

---

## 4. Screen Content — Step by Step

### Step 0 — TITLE / PREAMBLE

**Purpose:** Establish the world. No choices.

**Visual style:** Full-screen dark background with faded map texture. Centred text block, approximately 200 words, presented in two or three short paragraphs. The game title and subtitle appear at the top. A faint decorative separator below the text.

**Buttons:**
- *Begin the Expedition* — advances to Step 1
- *Skip Intro* (small, muted, lower-left) — immediately calls `newGame()` with the default config (see §8)

**Narrative text (draft):**
> *Year Three of the Ashmark Initiative. The Ansberry Company has pushed its Black River operations as far upriver as Shackle Station — and Shackle Station is not enough.*
>
> *Your charter authorises you to proceed west along the tributary the Sauromatians call the Kethani, establish a settlement before the onset of winter, and begin returning value to the Company within ten years. The document is very precise about the return of value. It is considerably less precise about how you achieve it.*
>
> *You have ten men, a season's supplies, and a collection of decisions already made. Who came with you. Where along the river you chose to stop. These choices are yours. What follows from them is yours as well.*

---

### Step 1 — THE CHARTER

**Purpose:** Name the settlement; set difficulty. Largely identical to the current `GameSetup` form.

**Fields:**
- Settlement name (text input, default `"Kethani Post"`)
- Difficulty (select dropdown)

**Difficulty descriptions** — update existing flavour text slightly:
| Value | Label | Description |
|---|---|---|
| `easy` | The Company Is Patient | Quota ramp is slower; Company supply deliveries are generous |
| `normal` | By the Book | Standard quota schedule; Company watches but does not hover |
| `hard` | The Inspector Watches | Quota begins in year 5; every failure costs standing |

---

### Step 2 — YOUR COMPANIONS

**Purpose:** Three independent stackable composition choices. Each adds a distinct group of people to the founding settler roster, with clearly shown mechanical consequences.

Each choice is presented as a card with:
- A heading (who they are)
- 2–3 lines of in-world flavour text
- A checkbox / toggle
- A short mechanical impact strip (4–5 bullet points, shown in muted text)

The three cards are laid out vertically. All three can be enabled simultaneously; none are mutually exclusive.

A running "Your founding party" count is shown at the bottom of the screen, updating as toggles change: *"Starting with 10 settlers"*, *"... 12 settlers"*, *"... 15 settlers"* etc.

---

#### CARD A — Imanian Wives

> *Three of your men chose not to leave their families behind. Their wives are with them.*

**Toggle default:** Off

**What this adds:** 2–3 Imanian women (exact count RNG-determined at `newGame()` time, 2 or 3 with equal probability), each pre-married to a specific founding man. Households are formed automatically on day 1. Depending on RNG, one wife may already have a young child (age 2–6) with the husband.

**Person profile:**
- Sex: female
- Age: matched to husband ±3 years (range 20–38)
- Genetics: pure Imanian, sampled from `sampleImanianGenetics()`
- Languages: `imanian` 1.0 only — no Tradetalk. Sheltered women from Company towns do not acquire Tradetalk.
- Religion: `imanian_orthodox`
- Social status: `founding_member`
- Traits: sampled from `FOUNDER_TRAIT_POOL`, skewed toward personality/aptitude — no warrior or Sauromatian-cultural traits
- Starting opinion toward husband: +50 (long-term relationship floor)

**Mechanical impact display:**
- `+2–3 founding women` (Imanian, orthodox)
- `Households form immediately — some men are no longer available for casual courtship`
- `Higher starting Imanian cultural blend`
- `No shared language with Sauromatian companions — potential tension early`
- `If any wives carry a child: settlement has a non-working dependent from turn 1`

**GameConfig field:** `companionChoices.imanianWives: boolean`

---

#### CARD B — Townborn Auxiliaries

> *Shackle Station has no shortage of mixed-blood locals looking for the kind of opportunity a new settlement represents. Three of them agreed to come.*

**Toggle default:** Off

**What this adds:** 3 people, mixed sex (2 women + 1 man, fixed or RNG between that and 1 woman + 2 men). These are people raised in or around Company settlements — they have Ansberite surnames, know Company customs, but are visibly and culturally mixed-heritage.

**Person profile:**
- Sex: mixed (see above)
- Age: 16–30
- Genetics: Imanian fraction 20–50% (RNG per person), remainder Kiswani Riverfolk (the dominant Shackle Station group). Uses `blendedGenetics(imanianDist, kiswaniRiverfollkDist, fraction)`.
- Languages:
  - `imanian` 0.5–0.7 (varies per person — some are more fluent than others)
  - `tradetalk` 0.7–0.9 (strong — this is how they grew up)
  - `kiswani` 0.8–1.0 (native or near-native)
- Religion: mixed — some `imanian_orthodox`, some `sacred_wheel` (hidden or open depending on how they were raised). RNG per person, weighted 60% orthodox / 40% wheel.
- Social status: `newcomer`
- Traits: from `FOUNDER_TRAIT_POOL` with bonus weight on `trader`, `gregarious`, `welcoming`, `curious`, `clever`
- Heritage `primaryCulture`: resolved via `deriveCulture()` from their blended bloodline — will typically come out as `settlement_native` or one of the Kiswani sub-cultures depending on fraction

**Mechanical impact display:**
- `+3 mixed-heritage settlers` (Imanian/Kiswani — culture blend between both extremes)
- `Strong Tradetalk speakers — linguistic bridging available immediately`
- `Familiar with both Imanian and Sauromatian customs — reduced integration friction`
- `Your Imanian cultural share will be lower from the start`
- `Their children will drift toward native culture faster than pure Imanian births`

**GameConfig field:** `companionChoices.townbornAuxiliaries: boolean`

---

#### CARD C — Wildborn Sauromatian Women

> *Through an intermediary at Shackle Station, you have arranged for two or three women of a local tribe to join the expedition. They know little of Imanian ways. You know little of theirs.*

**Toggle default:** Off

**What this adds:** 2–3 Sauromatian women (pure or near-pure), ethnic group determined by the **location choice** on the next screen. If the player is on Step 2 before picking a location, a note reads: *"Their exact tribe will depend on where along the Kethani you settle."* The ethnic group is locked in when `newGame()` is called.

**Tradetalk fluency varies by location** (see §6 — this is one of the cross-cutting interactions between Step 2 and Step 3):

| Location | Wildborn Tradetalk Fluency |
|---|---|
| `kethani_mouth` | 0.35 — regular contact with Company traders |
| `kethani_lowlands` | 0.25 — occasional contact |
| `kethani_midreach` | 0.15 — rare; primarily learned from travelling merchants |
| `kethani_uplands` | 0.05 — a few words; not functional communication |
| `kethani_headwaters` | 0.0 — no Tradetalk; no shared language at all |

**Person profile:**
- Sex: female
- Age: 18–30
- Genetics: sampled from `ETHNIC_DISTRIBUTIONS[ethnicGroup]`, pure Sauromatian
- Languages: native tongue 1.0, Tradetalk at location-scaled fluency (above), no Imanian
- Religion: `sacred_wheel`
- Social status: `newcomer`
- `genderRatioModifier`: 0.14 (pure Sauromatian — daughters overwhelmingly likely)
- `extendedFertility`: true
- Traits: from `FOUNDER_TRAIT_POOL`, with no earned or civilised cultural traits; higher weight on `traditional`, `proud`, `brave`, `protective`

**Mechanical impact display:**
- `+2–3 pure Sauromatian women` (tribe depends on location)
- `Sacred Wheel religion — will create religious tension with orthodox men`
- `Little or no shared language — significant early integration difficulty`
- `Strong female-skewed birth pressure — your settlement will grow female-heavy`
- `Extended fertility — high birth rate, births will lean heavily female`
- `At headwaters: no common language exists at all`

**GameConfig field:** `companionChoices.wildbornWomen: boolean`

---

### Step 3 — YOUR DESTINATION

**Purpose:** Pick one of five locations along the Kethani River. The choice sets tribe composition, language environment, Company accessibility, and which early events can fire.

**Visual style:** A simple illustrated map strip showing the Kethani from east to west. Five named anchor points are shown as clickable markers. The selected marker is highlighted amber; others are dim. A detail panel on the right (or below on narrow screens) updates as the player hovers or selects a location.

The east–west gradient should be communicated visually — the eastern end shows a river mouth with distant settlement silhouettes and a boat icon; as you move west the imagery becomes denser forest, then open steppe, then mountain foothills. No elaborate illustrations are needed: a stylised SVG map with terrain colour bands is sufficient.

**Location detail panel fields:**
- Name + one-line flavour description
- Distance from Company (as flavour text: *"Four days downriver to Shackle Station"*)
- Language environment (text summary + coloured pips for the three local languages)
- Nearby tribes (names and rough disposition — listed when known to the expedition)
- Company supply note (how reliably the annual ship reaches you)
- A "Hazards" note (brief mention of regional risks)

---

## 5. The Five Kethani Locations

### Location 1 — The Kethani Mouth

**LocationId:** `kethani_mouth`
**Flavour:** *Where the Kethani joins the Black River. Company patrols come through every few weeks. The tribes here have been dealing with Imanians since before your grandfather was born.*

**Geography:** The Kethani mouth delta, where the river broadens before joining the Black River. Relatively flat. Light jungle cover. The closest point to Shackle Station.

| Attribute | Value |
|---|---|
| Distance from Shackle Station | 3–4 days downriver |
| Company supply reliability | Full (×1.0 modifier on annual ship delivery) |
| Cultural blend starting point | Imanian — easy to hold at Imanian end of scale |
| Company pressure sensitivity | High — inspector events fire more readily |

**Language environment:**
- Nearby tribes: 2 have functional Tradetalk (0.6+). 1 has basic Imanian (0.2).
- Wildborn companion Tradetalk: 0.35
- Note: *"Most traders and headwomen you will meet here have dealt with Imanians before."*

**Nearby tribes (2 known at start, `contactEstablished: true`):**
- A Kiswani Riverfolk tribe, disposition +20, trader-trait, knows Tradetalk
- A Kiswani Haisla tribe, disposition +10, peaceful, some Tradetalk

**Distant tribes:** Typically 4 further upriver + 1 in the hills to the west.

**Unique features / risks:**
- Company inspector events fire at normal frequency
- Higher likelihood of `ident_company_inspector_dispatched` events
- Easiest location to maintain Company standing
- Risk: the ease of contact means the Company notices *everything*

**Starting resources:** Standard (no modifier)

---

### Location 2 — The Kethani Lowlands

**LocationId:** `kethani_lowlands`
**Flavour:** *A broad stretch of flat river plain two days upriver. Plenty of arable land. The tribes here know the Imanians by reputation more than by encounter.*

**Geography:** Wide river floodplain, seasonal marshland on the edges. Good soil. The last location where the river is large enough for Company supply vessels to reliably reach.

| Attribute | Value |
|---|---|
| Distance from Shackle Station | 6–7 days downriver |
| Company supply reliability | Good (×0.85 modifier) |
| Cultural blend starting point | Marginally Imanian — slight native pull |
| Company pressure sensitivity | Normal |

**Language environment:**
- Nearby tribes: 1 has functional Tradetalk (0.5). 1 has minimal Tradetalk (0.2). 1 has none.
- Wildborn companion Tradetalk: 0.25
- Note: *"Some headwomen have met traders from downriver. Others have not."*

**Nearby tribes (2 known at start):**
- A Kiswani Riverfolk tribe, disposition +10, mixed traits
- A Hanjoda Bloodmoon tribe, disposition −10, warlike — known but hostile

**Distant tribes:** 3 further west + 2 in hills.

**Unique features / risks:**
- Good farmland — `fields` building is immediately valuable
- Occasionally flooded in Spring — potential `env_flood_season` events
- Bloodmoon presence means early military pressure is plausible

**Starting resources:** +5 food (rich floodplain)

---

### Location 3 — The Kethani Midreach

**LocationId:** `kethani_midreach`
**Flavour:** *Halfway along the Kethani, where the plains begin. The river narrows here. Company boats can make it in a good year, not every year. The tribes are watching.*

**Geography:** The river narrows and shallows. Mixed terrain — open grassland begins to compete with forest. Tribal traffic is heavy here; a number of tribes claim overlapping use-rights to this stretch.

| Attribute | Value |
|---|---|
| Distance from Shackle Station | 10–12 days downriver |
| Company supply reliability | Unreliable (×0.60 modifier; may be delayed a season) |
| Cultural blend starting point | Balanced — neither pull dominates |
| Company pressure sensitivity | Low — inspectors rarely come this far |

**Language environment:**
- Nearby tribes: 1 has basic Tradetalk (0.25). 2 have none.
- Wildborn companion Tradetalk: 0.15
- Note: *"Tradetalk is a novelty here. Some women have a few words. Most do not."*

**Nearby tribes (1 known at start, 2 distant):**
- A Hanjoda Stormcaller tribe, disposition +5, isolationist — one known contact
- All others: `contactEstablished: false` at start

**Unique features / risks:**
- Moderate language difficulty — first few years without Townborn companions are communicatively isolated
- Lower Company scrutiny — you have more freedom but less support
- Balanced starting cultural blend — both identity pressures can activate
- Strategic position: equidistant from Company and deep Sauromatian territory

**Starting resources:** Standard

---

### Location 4 — The Kethani Uplands

**LocationId:** `kethani_uplands`
**Flavour:** *Where the grasslands begin in earnest and the river grows cold. No Company boat has come this far in living memory. The Hanjoda have ruled this land since before the Company existed.*

**Geography:** The river's upper middle stretch, where the water runs faster and clearer from highland drainage. Open savannah. Stormcaller territory begins properly here. The Bone Flats are visible on the southern horizon.

| Attribute | Value |
|---|---|
| Distance from Shackle Station | 16+ days (overland sections required) |
| Company supply reliability | Difficult (×0.35 modifier; sea-accessible only in Spring, may skip years) |
| Cultural blend starting point | Native lean — tribal culture is dominant in the environment |
| Company pressure sensitivity | Minimal — largely out of sight |

**Language environment:**
- Nearby tribes: 0 tribes have functional Tradetalk. 1 may have a single interpreter (individual NPC, not tribe-wide).
- Wildborn companion Tradetalk: 0.05 — almost nothing
- Note: *"An interpreter might exist. Finding them is another matter."*

**Nearby tribes (0 known at start — all contacts must be made by expedition):**
- Hanjoda Stormcaller presence: large population, isolationist, disposition 0
- Hanjoda Bloodmoon presence: smaller raiding bands, hostile by default
- All tribes: `contactEstablished: false`

**Unique features / risks:**
- Hard language start — without Townborn companions, early communication is essentially impossible
- No Company supply for the first 1–2 years; settlement is fully self-reliant
- Large native population means cultural drift toward native is almost inevitable and fast
- The Bone Flats proximity means Cult events may appear in later game
- High risk, high long-term reward: if you survive, you are genuinely free of Company oversight

**Starting resources:** +10 lumber (dense highland forest nearby), −5 food (harsher foraging)

---

### Location 5 — The Kethani Headwaters

**LocationId:** `kethani_headwaters`
**Flavour:** *The river's source country, where it descends from the mountain passes. Stormcaller territory. Men from the Company have never settled here. Possibly no Imanian has ever wintered here at all.*

**Geography:** The uppermost navigable (barely) stretch of the Kethani, below the Stormwall Mountain passes. Cold winters. Exposed highland terrain. Stormcaller shamans consider several sites along this stretch sacred.

| Attribute | Value |
|---|---|
| Distance from Shackle Station | 20+ days; sometimes impassable in winter |
| Company supply reliability | Almost none (×0.15 modifier; one ship every 2–3 years at best) |
| Cultural blend starting point | Heavy native lean — the Imanians are the foreigners here |
| Company pressure sensitivity | None — Company is unaware of day-to-day events |

**Language environment:**
- Nearby tribes: 0 Tradetalk. 0 Imanian. No shared language with any neighbouring group.
- Wildborn companion Tradetalk: 0.0 — women from this region have no Tradetalk at all
- Note: *"There is no common tongue. You will need to build one from nothing, or not at all."*

**Nearby tribes (0 known at start):**
- Hanjoda Stormcaller: dominant, large, isolationist/proud, sacred sites nearby
- Possible Hanjoda Emrasi presence further along mountain valleys

**Unique features / risks:**
- **Maximum language isolation** — without Townborn companions, communication with every nearby group starts at zero
- Company quota still applies, but the Company physically cannot enforce it easily
- `ident_company_cultural_concern` events never fire; `ident_tribal_champion_recognised` becomes likely within the first decade
- Winter hardship events are more severe and more frequent
- Sacred Stormcaller sites: certain construction choices may provoke strong tribal responses
- Choosing Wildborn women here means they have zero Tradetalk and no shared language with the men — the intro can show this explicitly as a warning

**Starting resources:** +5 stone (mountain rock everywhere), −10 food (harsh terrain), −5 lumber (above treeline in parts)

---

## 6. Cross-Cutting Interactions (Step 2 × Step 3)

Several choices in Step 2 have consequences that depend on the Step 3 location choice. These are resolved in `createInitialState()` and should be clearly explained in the UI.

### Wildborn Women × Location

The ethnic group and Tradetalk fluency of the wildborn women are derived from the location:

| LocationId | Ethnic Group | Tradetalk Fluency |
|---|---|---|
| `kethani_mouth` | `kiswani_riverfolk` | 0.35 |
| `kethani_lowlands` | `kiswani_riverfolk` or `hanjoda_bloodmoon` (RNG 60/40) | 0.25 |
| `kethani_midreach` | `hanjoda_stormcaller` or `hanjoda_bloodmoon` (RNG 50/50) | 0.15 |
| `kethani_uplands` | `hanjoda_stormcaller` | 0.05 |
| `kethani_headwaters` | `hanjoda_stormcaller` | 0.0 |

When Card C is toggled on and the player is still on Step 2 (no location selected yet), the companion detail reads: *"Their tribe and shared languages will depend on where you settle."* After a location is chosen on Step 3, a note in the Step 3 detail panel reads: *"If you are bringing wildborn women, they will be [ethnic group] with [X Tradetalk note]."*

### Company Supply × Companions

Townborn Auxiliaries slightly offset the Company supply penalty at difficult locations: their skills as intermediaries and their knowledge of river routes result in a small bonus to supply delivery:

| Condition | Effect |
|---|---|
| Townborn enabled + `kethani_uplands` or `kethani_headwaters` | Supply modifier +0.10 (their logistical knowledge partially offsets the distance) |
| No Townborn, no Tradetalk, headwaters | First Company contact is delayed by 1 additional year |

This is a subtle mechanical reward for the Townborn choice at difficult locations, not a drastic swing.

---

## 7. Step 4 — Ready to Depart

**Purpose:** Summary screen. Shows the final roster and situation; confirms before calling `newGame()`.

**Layout:**
- Left column: roster list (name, sex, age, role, language note)
- Right column:
  - Settlement name
  - Difficulty
  - Location name + one-line description
  - Cultural blend forecast: a simple bar showing projected starting cultural blend (purely Imanian on the left, native on the right), with markers for where cultural pressure zones begin
  - Language summary: *"At game start, N of your settlers share a common language with the nearest tribe."*
  - Company note: *"Annual supply ships have a [X%] chance of reaching you on schedule."*

**Button:** *Begin the Expedition* (amber, full width)
**Back button:** Returns to Step 3.

---

## 8. Default / Skip Configuration

When the player clicks **Skip Intro** on Step 0, the following defaults are applied and `newGame()` is called immediately. These defaults are designed to give the cleanest, most code-path-rich start for testing without requiring any choices:

| Field | Default Value | Reason |
|---|---|---|
| `settlementName` | `"Kethani Post"` | Simple, lore-accurate |
| `difficulty` | `'normal'` | Standard test conditions |
| `startingLocation` | `'kethani_mouth'` | Closest to Company; all systems active |
| `companionChoices.imanianWives` | `false` | Clean roster; no pre-formed households to manage |
| `companionChoices.townbornAuxiliaries` | `false` | No added language complexity |
| `companionChoices.wildbornWomen` | `true` | Wildborn women included — religion tension and cultural drift are active from turn 1; tests the full integration pipeline |
| `startingTribes` | `[]` (handled by `initial-state.ts` as before) | Unchanged from current behaviour |

> **Note on `includeSauromatianWomen`:** This flag is superseded by `companionChoices.wildbornWomen` and should be removed from `GameConfig` when the intro is implemented. No backwards-compatibility shim is required — old saves will simply be incompatible and the player will see the new setup screen. The interim `GameSetup.tsx` form defaults `includeSauromatianWomen` to `true` so that the default experience already includes women before the full intro is built.

---

## 9. GameConfig Changes

### New fields on `GameConfig`

```typescript
interface GameConfig {
  difficulty: 'easy' | 'normal' | 'hard';
  startingTribes: string[];       // unchanged; still populated by initial-state.ts internally
  startingLocation: LocationId;  // now one of the five LocationId constants below

  /** Three stackable composition choices replacing the old includeSauromatianWomen toggle. */
  companionChoices: {
    /** 2–3 Imanian wives of existing settlers. Forms households on day 1. */
    imanianWives: boolean;
    /** 3 mixed-heritage Shackle Station locals (Kiswani/Imanian bloodline). */
    townbornAuxiliaries: boolean;
    /** 2–3 pure Sauromatian women arranged through a tribal intermediary. */
    wildbornWomen: boolean;
  };
}
```

### Canonical LocationId constants

A `KETHANI_LOCATIONS` constant should be added to `game-state.ts` or a new `src/simulation/world/locations.ts`:

```typescript
export const KETHANI_LOCATIONS = [
  'kethani_mouth',
  'kethani_lowlands',
  'kethani_midreach',
  'kethani_uplands',
  'kethani_headwaters',
] as const;

export type KethaniLocationId = typeof KETHANI_LOCATIONS[number];
```

---

## 10. `createInitialState()` Changes

The factory function needs to be extended to handle the three new companion types. Suggested structure:

### A) Imanian Wives

```
// After generating founding male settlers:
if (config.companionChoices.imanianWives) {
  const wifeCount = rng.nextInt(2, 3);
  // Pick wifeCount founding males who are old enough to plausibly be married (age ≥ 22)
  // For each: generateName(female, ansberite), sampleImanianGenetics(), no Tradetalk
  // Assign religion: imanian_orthodox
  // Form household: husband + wife immediately (pass to initializeHouseholds or call performMarriage)
  // Set opinion: husband→wife +50, wife→husband +50
  // RNG-chance (30%): add one child per couple, age 2–6
}
```

### B) Townborn Auxiliaries

```
if (config.companionChoices.townbornAuxiliaries) {
  // 3 people, sex composition: rng.nextInt(0, 1) → 0 = 2w+1m, 1 = 1w+2m
  // For each:
  //   imanianFraction = rng.gaussian(0.35, 0.08) clamped [0.20, 0.50]
  //   genetics = averageBloodlines(imanianBloodline, kiswaniRiverfollkBloodline, rng)
  //   imanian fluency = rng.gaussian(0.6, 0.07) clamped [0.50, 0.75]
  //   tradetalk fluency = rng.gaussian(0.8, 0.06) clamped [0.65, 0.95]
  //   kiswani fluency = rng.gaussian(0.9, 0.05) clamped [0.80, 1.0]
  //   religion = rng.nextFloat() < 0.6 ? 'imanian_orthodox' : 'sacred_wheel'
  //   Ansberite family name (they grew up in Company towns)
  //   socialStatus: 'newcomer'
}
```

### C) Wildborn Women

```
if (config.companionChoices.wildbornWomen) {
  // Determine ethnic group from location (see §6 cross-cutting table)
  // tradetalkFluency = WILDBORN_TRADETALK_BY_LOCATION[config.startingLocation]
  // largely same as existing includeSauromatianWomen path, but:
  //   - fluency is location-dependent not fixed at 0.3
  //   - ethnic group is location-dependent not tribe-preset-dependent
  //   - no baseline opinion seeding until cross-cultural journey cost applies
}
```

### D) Company supply modifier per location

In the `company` object initialisation:

```typescript
const LOCATION_SUPPLY_MODIFIER: Record<LocationId, number> = {
  kethani_mouth:       1.00,
  kethani_lowlands:    0.85,
  kethani_midreach:    0.60,
  kethani_uplands:     0.35,
  kethani_headwaters:  0.15,
};

// Store on GameState or derive on demand in getCompanySupplyDelivery()
// Suggest: add startingLocationModifier field to CompanyRelation, or read from config at delivery time
```

### E) Starting resource adjustments

Apply the location-specific resource delta table (§5) to `initialResources` before assigning to `settlement.resources`.

---

## 11. UI / Visual Notes

### Component structure

```
src/ui/overlays/
  IntroSequence.tsx          ← new master component (replaces GameSetup.tsx)
  intro/
    PreambleStep.tsx          ← Step 0
    CharterStep.tsx           ← Step 1 (absorbs current GameSetup form fields)
    CompanionsStep.tsx        ← Step 2
    DestinationStep.tsx       ← Step 3
    SummaryStep.tsx           ← Step 4
```

`GameSetup.tsx` becomes a thin re-export of `IntroSequence` for now, or is replaced in `App.tsx` directly.

### Styling guidelines

- **Background:** `bg-stone-900` with a faint map-texture SVG overlay (semi-transparent, 10–15% opacity). Can be the existing Kethani map or a stylised version.
- **Card background:** `bg-amber-950/80` with `border border-amber-800`
- **Active/selected state** (location picker, toggles): amber highlight — `border-amber-500 bg-amber-900/40`
- **Inactive/unselected:** `border-stone-700 bg-stone-800/40 text-stone-400`
- **Skip button:** `text-stone-500 hover:text-stone-300` — small, right-aligned in the header or absolute bottom-left. Deliberately understated.
- **Progress indicator:** Simple `●●○○○` dot row beneath the card. Clickable dots allow backward navigation.
- **Back button:** `← Back` in `text-stone-400` below the main card. Not a modal/drawer.

### Location selector (Step 3)

The minimal viable version is a horizontal list of five cards (same card styling) arranged in a single row or wrapping grid. Each card shows:
- Location name (bold, amber)
- Distance flavour line
- Language pip row: `IMA ●●●○○  TRD ●●○○○  KIS ●○○○○` (filled/empty dots for approximate fluency of the nearest tribe)
- Company supply indicator: `◆◆◆◆◇` (filled diamonds)

A more polished version would use a SVG river diagram with clickable nodes. This can be added later without breaking the data model.

---

## 12. Interaction with Existing Systems

| System | Interaction | Notes |
|---|---|---|
| `initializeBaselineOpinions` | No change needed — runs on all people regardless of origin | Language-gap penalties will fire naturally for wildborn/townborn couples |
| `processCulturalDrift` | Starting `culturalBlend` should be calculated from the mix of people present, not hard-coded to 0 | A starting blend function should compute Imanian % from founding bloodlines |
| `computeReligiousTension` | Works automatically — if wildborn women bring Sacred Wheel, tension begins from turn 1 | No change needed |
| `generateAmbition` | No change — fires for all people on game start already | |
| `seedFoundingRelationships` | May need extension: Imanian wives start as `confidant` of their husband; Townborn men/women start as `friend` of anyone with Tradetalk | Low priority — opinions handle this naturally |
| `getCompanySupplyDelivery` | Needs to read a supply reliability modifier from config or state | Add `locationSupplyModifier` field, or pass it directly from config |
| Company quota events | Location modifier should also damp the Company nagging events at difficult locations | `ident_company_inspector_dispatched` could gate on location distance |
| Hex map generation | `generateHexMap` currently receives a fixed config — it should use `startingLocation` to shift tribe density and placement | Future phase; works without it for now |

---

## 13. Deferred / Future Scope

The following are deliberately outside the initial implementation scope but should be kept in mind when writing the code:

- **Named expedition leader identity** — currently you are "the player". A future intro step might let you name and sketch your own character (the charter-holder). This would add a 6th person to the roster with special `leadership` skill and unique traits.
- **Backstory choices** — *Why did the Company send you? A debt to repay? An opportunity seized? A punishment dressed as an honour?* These could be a 5th step with flavour consequences (starting Company standing, one starting trait on a key NPC, etc.).
- **Procedural location map** — the five locations are currently logical IDs; eventually `generateHexMap()` should shift the full hex grid origin based on location, placing the player's camp at different positions on the map and spawning different tribes nearby.
- **More companion types** — freed thralls, Company deserters, a disgraced Ansberite priest — each as additional optional cards in Step 2.
- **Introduction of a named antagonist** — an event in the intro's preamble that foreshadows a specific rival (a hostile queen, a Company inspector, a Cult agent). No mechanical effect, pure atmosphere.

---

## 14. Summary — What `initial-state.ts` Needs to Know

| GameConfig field | Used in `createInitialState()` |
|---|---|
| `difficulty` | Quota ramp formula (unchanged) |
| `startingLocation` | Resource delta; supply modifier; wildborn ethnic group; wildborn Tradetalk fluency |
| `companionChoices.imanianWives` | Generate 2–3 Imanian women; form households; possible children |
| `companionChoices.townbornAuxiliaries` | Generate 3 mixed-heritage people |
| `companionChoices.wildbornWomen` | Generate 2–3 Sauromatian women (replaces `includeSauromatianWomen`) |

The current `includeSauromatianWomen` path should be migrated to `companionChoices.wildbornWomen` during implementation, with a one-line backwards-compat shim for old saves.

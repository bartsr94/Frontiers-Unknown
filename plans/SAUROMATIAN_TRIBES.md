# Sauromatian Tribes — Naming & Identity System

> **Status:** Design doc — approved for implementation
> **Scope:** `src/simulation/world/tribes.ts` tribe name and ID fields;
>             future random-generation pool for procedural tribes

---

## 1. Design Intent

Each Sauromatian tribe follows a two-word compound naming pattern: **[Color] + [Noun]**.

```
Blacktongue   Silvercrest   Ashmantle   Goldhand   Redmoon   Jadehollow
```

This serves three functions simultaneously:

1. **Instant ethnic identification** — each ethnic group owns a color family; a player
   who learns the system can read `Ash-` or `Pale-` and know they are dealing with
   Stormcallers before they have established formal contact.

2. **Natural in-world description** — event text and expedition logs can reference
   "the Greythorn band" or "a Palecrown raiding party" without breaking immersion;
   the color acts as a visual anchor even before a portrait or flag exists.

3. **Future procedural generation** — random tribes spawned by the expedition or
   world-event systems can be named by drawing one color and one noun from the
   appropriate ethnic pool, guaranteed to produce recognisable, thematic results.

---

## 2. Color Families per Ethnic Group

Each ethnic group owns **three colors** as its primary palette. These colors derive
directly from each group's physical and environmental signature in the lore.

| Ethnic Group | Colors | Lore Source |
|---|---|---|
| `kiswani_riverfolk` | Black · Blue · Dark | Dark river water; deep currents; mixed ancestry |
| `kiswani_bayuk` | Green · Jade · Moss | Deep jungle; plant-dyed cloth; forest canopy |
| `kiswani_haisla` | Grey · Silver · Salt | Coastal mist; grey-blue eyes; sea foam |
| `hanjoda_stormcaller` | Ash · White · Pale | Rare blonde hair; lightning ash; vast pale sky |
| `hanjoda_bloodmoon` | Red · Ochre · Crimson | Blood-rite culture; ochre body paint; moon worship |
| `hanjoda_talon` | Amber · Gold · Gilt | **Distinctive amber/yellow eyes** — their unmistakable marker |
| `hanjoda_emrasi` | Bronze · Brown · Copper | Variable warm coloring; river earth; adaptive heritage |

### Usage Rule

A tribe's name uses exactly **one color from its ethnic group's palette** and
**one noun from its ethnic group's noun pool**. No cross-group borrowing.

This means that `Redmoon` is always Bloodmoon. `Ashmantle` is always Stormcaller.
`Goldeye` is always Talon. The system is self-consistent at the naming level alone.

---

## 3. Noun Pools per Ethnic Group

Each noun was chosen to evoke that group's environment, livelihood, and cultural
character. The pools are intentionally kept distinct — no noun appears in two groups.

### Kiswani Riverfolk
*River-traders and canoe-peoples of the inland waterways. Diverse ancestry, athletic and
tall. Their trade networks are their lifeblood.*

`Tide` · `Tongue` · `Reed` · `Wake` · `Current` · `Mouth` · `Veil` · `Shoal` · `Bend`

> **Tongue** — traders and negotiators; people who talk for a living.
> **Mouth** — a river mouth; gateway, entrance, threshold.
> **Shoal** — shallow water; they know every sand-bar.

### Kiswani Bayuk
*Compact and short, deep-jungle dwellers. Grey eyes, black hair sometimes dyed red.
Mysterious, herb-savvy, rarely seen until they choose to be.*

`Thorn` · `Root` · `Spine` · `Hollow` · `Shade` · `Canopy` · `Marrow` · `Burl`

> **Spine** — the backbone of the jungle; rigid and hidden.
> **Marrow** — what is at the core of a thing; their inner nature.
> **Burl** — the dense, twisted growth in wood; resilient and hidden.

### Kiswani Haisla
*Lean-muscular coastal sailors. Dreadlocks, grey-blue eyes. They know the sea's moods
better than any other people in Palusteria.*

`Gale` · `Crest` · `Shore` · `Mast` · `Squall` · `Fog` · `Keel` · `Swell`

> **Keel** — the spine of a ship; structural, directional.
> **Squall** — a fast violent coastal storm; aggressive Haisla groups.
> **Swell** — open-water power; a large, calm Haisla group.

### Hanjoda Stormcaller
*Tallest of all Sauromatians, wiry-gaunt, with rare blonde hair that hints at ancient
non-Sauromatian ancestry. Their shamans call weather. Men among them are rarest of all
and considered sacred conduits to the storm-gods.*

`Veil` · `Mantle` · `Voice` · `Shroud` · `Crown` · `Gust` · `Sky` · `Scar`

> **Mantle** — the sky itself, draped over the world; authority and breadth.
> **Voice** — their shamans speak for the storm.
> **Scar** — the mark lightning leaves; what remains after the storm passes.

### Hanjoda Bloodmoon
*Ritual battle-culture practitioners. Athletic-lean, warm brown tones. Blood rites and
moon worship are central to their identity. The most frequently raiding ethnic group.*

`Moon` · `Fang` · `Scar` · `Brand` · `Tooth` · `Pyre` · `Claw` · `Howl`

> **Brand** — ceremonial burning; a mark of belonging or conquest.
> **Pyre** — fire of the dead; the boundary between worlds.
> **Howl** — the battle-call before the raid begins.

### Hanjoda Talon
*Amber and yellow eyes — their single unmistakable physical marker. Athletic with wide
builds. Craftspeople and smiths of renown. Their amber eyes appear in descriptions,
campfire stories, and event flavor text.*

`Eye` · `Hand` · `Hammer` · `Cairn` · `Forge` · `Strike` · `Brand` · `Claw`

> **Eye** — the amber eye; used specifically for Talon because it references their
>           signature trait. No other ethnic group should use this noun.
> **Cairn** — a marker of stone; their stone-working heritage.
> **Hand** — skilled craft; a hand that shapes things.

### Hanjoda Emrasi
*Highly variable coloring; the most adaptive of the Hanjoda peoples. Inland fishers and
river-farmers. Medium-athletic, average height. Warm bronze and copper tones.*

`Hook` · `Fork` · `Shell` · `Shoal` · `Net` · `Basin` · `Drift` · `Path`

> Note: `Shoal` appears in Riverfolk too — this is intentional; both are water peoples,
>       but the *color prefix* keeps them distinct (Blue/Dark = Riverfolk; Bronze/Brown = Emrasi).
> **Fork** — a river fork; the junction point where peoples meet.
> **Drift** — the slow movement of a wandering people.

---

## 4. Name Compound Rules

1. **Color always leads.** `Redmoon`, not `Moonred`.
2. **One word each, closed compound.** `Ashmantle`, not `Ash Mantle` or `Ash-Mantle`.
   This matches existing lore names (`Bloodmoon`, `Stormcaller`).
3. **No articles or descriptors.** The `the` is implied by context. In event text:
   *"the Greythorn band arrived"* — not *"the Greythorn Tribe Band"*.
4. **Faction/group suffixes are optional in event text only** — *"the Redmoon raiders"*,
   *"a Bluetide merchant convoy"* — these suffixes are prose-level flavor and never
   part of the canonical name.
5. **No color or noun should appear twice in the same playthrough's active tribe set.**
   When the random generation pool is implemented, deduplication should be enforced
   at generation time.

---

## 5. The 16 Base Tribes — Renamed Roster

These are the canonical preset tribes used in the current implementation.
Both the display `name` and the `id` key in `TRIBE_PRESETS` should be updated.

| Old ID | New ID | New Name | Ethnic Group | Disposition | Traits |
|---|---|---|---|---|---|
| `njaro_matu_riverfolk` | `bluetide` | Bluetide | Kiswani Riverfolk | +25 | peaceful, trader |
| `black_water_clan` | `darkwake` | Darkwake | Kiswani Riverfolk | −10 | warlike, expansionist |
| `deep_canopy_sisters` | `jadehollow` | Jadehollow | Kiswani Bayuk | 0 | isolationist |
| `jade_viper_band` | `greenthorn` | Greenthorn | Kiswani Bayuk | −15 | warlike, desperate |
| `storm_coast_sailors` | `silvercrest` | Silvercrest | Kiswani Haisla | +20 | peaceful, trader |
| `black_tide_crew` | `greysquall` | Greysquall | Kiswani Haisla | −20 | warlike |
| `candibula_host` | `ashmantle` | Ashmantle | Hanjoda Stormcaller | +15 | peaceful |
| `thunder_veil_band` | `paleveil` | Paleveil | Hanjoda Stormcaller | −5 | isolationist |
| `red_moon_raiders` | `redmoon` | Redmoon | Hanjoda Bloodmoon | −25 | warlike, expansionist |
| `crescent_hunters` | `ochrescar` | Ochrescar | Hanjoda Bloodmoon | −10 | warlike |
| `ochre_path_wanderers` | `ochredrift` | Ochredrift | Hanjoda Bloodmoon | +5 | peaceful, trader |
| `ironblood_warband` | `crimsonfang` | Crimsonfang | Hanjoda Bloodmoon | −30 | warlike, desperate |
| `cairn_valley_smiths` | `goldhand` | Goldhand | Hanjoda Talon | +10 | peaceful, trader |
| `grey_stone_watchers` | `ambercairn` | Ambercairn | Hanjoda Talon | −5 | isolationist |
| `emras_daughters` | `bronzemouth` | Bronzemouth | Hanjoda Emrasi | +20 | peaceful, trader |
| `inland_fisher_clans` | `copperhook` | Copperhook | Hanjoda Emrasi | +5 | peaceful |

### Name Notes

- **Bluetide** — a large, established river trading network. The blue of deep water.
- **Darkwake** — aggressive river raiders who leave a wake of disruption.
- **Jadehollow** — hidden in a jungle hollow; rarely found, rarely wanting to be.
- **Greenthorn** — the defensive thorns of the deep jungle. Prickly and dangerous.
- **Silvercrest** — the silver crest of a coastal wave; also the silver-grey eyes of the Haisla at their most noble.
- **Greysquall** — a sudden, violent coastal storm. Fast and unpredictable.
- **Ashmantle** — the mantle of ash-pale sky over the steppe; the largest, most established Stormcaller band.
- **Paleveil** — the pale veil of morning mist through which you never quite see them clearly.
- **Redmoon** — the blood-red moon of the raid season; their most iconic name.
- **Ochrescar** — ritual scarification with ochre; marks their hunters and warriors.
- **Ochredrift** — wandering traders who follow the ochre-dust roads between territories.
- **Crimsonfang** — desperate and violent; a warband at the edge of disintegration.
- **Goldhand** — the skilled amber-eyed crafters; a hand that shapes metal.
- **Ambercairn** — they build cairns of stone marked with amber-yellow ochre; watchers on the hills.
- **Bronzemouth** — the mouth of the river delta where trade enters; a large open people.
- **Copperhook** — the copper-toned fishing folk of the inland lakes. A hook in still water.

---

## 6. Full Generation Pools (for Procedural Tribes — Future Phase)

When the expedition system spawns unknown tribes, draw from these pools.

### Color Pool by Ethnic Group

```typescript
const TRIBE_COLOR_POOL: Record<EthnicGroup, string[]> = {
  kiswani_riverfolk:    ['Black', 'Blue', 'Dark'],
  kiswani_bayuk:        ['Green', 'Jade', 'Moss'],
  kiswani_haisla:       ['Grey', 'Silver', 'Salt'],
  hanjoda_stormcaller:  ['Ash', 'White', 'Pale'],
  hanjoda_bloodmoon:    ['Red', 'Ochre', 'Crimson'],
  hanjoda_talon:        ['Amber', 'Gold', 'Gilt'],
  hanjoda_emrasi:       ['Bronze', 'Brown', 'Copper'],
};
```

### Noun Pool by Ethnic Group

```typescript
const TRIBE_NOUN_POOL: Record<EthnicGroup, string[]> = {
  kiswani_riverfolk:    ['Tide', 'Tongue', 'Reed', 'Wake', 'Current', 'Mouth', 'Veil', 'Shoal', 'Bend'],
  kiswani_bayuk:        ['Thorn', 'Root', 'Spine', 'Hollow', 'Shade', 'Canopy', 'Marrow', 'Burl'],
  kiswani_haisla:       ['Gale', 'Crest', 'Shore', 'Mast', 'Squall', 'Fog', 'Keel', 'Swell'],
  hanjoda_stormcaller:  ['Veil', 'Mantle', 'Voice', 'Shroud', 'Crown', 'Gust', 'Sky', 'Scar'],
  hanjoda_bloodmoon:    ['Moon', 'Fang', 'Scar', 'Brand', 'Tooth', 'Pyre', 'Claw', 'Howl'],
  hanjoda_talon:        ['Eye', 'Hand', 'Hammer', 'Cairn', 'Forge', 'Strike', 'Brand', 'Claw'],
  hanjoda_emrasi:       ['Hook', 'Fork', 'Shell', 'Shoal', 'Net', 'Basin', 'Drift', 'Path'],
};
```

### Generation Function (Stub)

```typescript
function generateTribeName(
  ethnicGroup: EthnicGroup,
  usedNames: Set<string>,
  rng: SeededRNG,
): string {
  const colors = TRIBE_COLOR_POOL[ethnicGroup];
  const nouns  = TRIBE_NOUN_POOL[ethnicGroup];

  // Fisher-Yates over combined pairs, skip already-used names
  const candidates: string[] = [];
  for (const c of colors) {
    for (const n of nouns) {
      const name = c + n;
      if (!usedNames.has(name)) candidates.push(name);
    }
  }

  if (candidates.length === 0) {
    // Fallback: reuse is preferable to crashing; this should never happen with 16+ candidates per group
    return colors[rng.nextInt(0, colors.length - 1)] + nouns[rng.nextInt(0, nouns.length - 1)];
  }

  return candidates[rng.nextInt(0, candidates.length - 1)];
}
```

---

## 7. Named Unique Tribes (Future Phase)

The preset and procedural tribes represent **generic** groups — bands that could appear
in any playthrough. A separate future phase will define **named unique tribes** which:

- Have specific histories, key NPCs, and multi-stage diplomatic arcs
- May have longer or irregular names (e.g. *"The Ochre Path Wanderers"*, *"The Candibula Host"*)
- Are referenced by name in specific quests, events, and lore text
- Are not randomised — they always appear at fixed world coordinates if selected

These will be designed in a separate `NAMED_TRIBES.md` document once the
expedition/hex-map system is further developed.

---

## 8. Implementation Notes

### Changes Required in `src/simulation/world/tribes.ts`

For each of the 16 presets, update:
1. The **object key** in `TRIBE_PRESETS` (e.g. `njaro_matu_riverfolk` → `bluetide`)
2. The **`id` field** inside the config (must match the key)
3. The **`name` field** (display name, e.g. `'Bluetide'`)

No other fields change. All behavioral config (traits, desires, offerings, stability,
disposition, populations) remains identical.

### Changes Required in `src/stores/game-store.ts`

The GameSetup screen hardcodes some tribe IDs as default selections. Search for
`startingTribes` or the old ID strings and update to match the new IDs.

### Test Files

`tests/world/tribes.test.ts` — check for any hardcoded tribe ID strings and update them.

### Serialisation

Old saves will fail to load any tribe whose ID has changed. The existing save-wipe
behavior (try/catch in store) handles this gracefully — no migration logic needed.

---

## 9. Event Text Style Guide

When tribes appear in event flavor text, use the name as a gentilicial adjective or
a bare noun group:

| Good | Avoid |
|---|---|
| *"A Bluetide canoe emerged from the reeds..."* | *"A Bluetide Tribe canoe..."* |
| *"the Redmoon have crossed the river"* | *"the Red Moon Clan raiders"* |
| *"an Ashmantle shaman approached the camp-fire"* | *"the Ashmantle Tribe Shaman"* |
| *"Greythorn women do not trade in daylight"* | *"the Greythorn people's women"* |

The tribe name carries all the weight. No taxonomic suffixes needed.

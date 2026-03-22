# Expedition & Hex Map System — Design Document

> **Status:** Phases A–E complete (hex grid 21×21, data model, travel processing, all 18 expedition events, dispatch/status UI, tribe contact integration). Phase F polish items outstanding — see §12.
> **Scope:** Replaces the static Ashmark map image in `DiplomacyView` with an interactive hex grid. Adds expedition dispatch, travel, and event resolution. Integrates with the existing event, tribe, and deferred-event systems.
>
> **Divergences from original design:** Grid is 21×21 (not 15×15); settlement at axial `(10,10)` (not `(7,7)`). `TribeFlag` as a `Set` was not implemented — its key flags (`sighted`, `diplomacyOpened`, `giftedTurns`) became direct fields on `ExternalTribe` instead. `ExpeditionStatusPanel` is an inline component in `DiplomacyView.tsx` rather than a separate file.

---

## 1. Overview

The Ashmark is the vast, largely unknown territory surrounding the player's settlement. Right now it is a decorative image. This system turns it into an interactive space: a fog-of-war hex grid that expeditions physically move through, triggering events, establishing tribe contacts, and uncovering the landscape.

The existing map image (`/ui/ashmark.jpg`) is rendered **underneath** the hex grid. As hexes are revealed, the imagery shows through. Unexplored hexes are opaque fog tiles. The effect is one of the world gradually becoming legible.

---

## 2. Core Design Decisions (from planning session)

| Question | Decision |
|----------|----------|
| Starting visibility | Settlement hex + 3 random adjacent hexes visible; everything else fog |
| Grid size | 15×15 axial hex grid to start; expandable | q
| Hex orientation | Pointed-top (fits horizontal viewport) |
| Map underlayer | Ashmark image shows beneath revealed hexes |
| Party size | 1 leader (required) + 1–10 members |
| Resource provisioning | Player sets food/goods/gold sliders before departure |
| Party risk | Full: injury, illness, death; tied explicitly to event system |
| Food consumption | ~0.25 food per person per season while on expedition |
| Travel speed | Terrain-dependent (see §6.2) |
| Simultaneous expeditions | Multiple allowed |
| Tribe contact on entry | Established automatically; formal relations require follow-up |
| Hex content | Extensible registry; some things are one-time, others recur |
| Cleared hexes | Status indicating "little left to discover"; passive encounters still possible |
| Event delivery | Events fire throughout the expedition — not only on return |
| Launch button | Bottom of the Known Clans column in `DiplomacyView` |

---

## 3. Data Model

### 3.1 Terrain Types

```typescript
type TerrainType =
  | 'plains'        // Open grassland. Fast travel. 4 hexes/season.
  | 'forest'        // Dense woodland. Moderate. 2 hexes/season.
  | 'jungle'        // Thick, humid growth. Slow. 1 hex/season.
  | 'hills'         // Rough terrain. Slow. 1 hex/season.
  | 'mountains'     // Near-impassable. 0.5 hexes/season (2 seasons to cross 1 hex).
  | 'river'         // Following a waterway. Very fast with boat: 6 hexes/season. On foot: 1 hex/season.
  | 'wetlands'      // Marshes, reed-beds. Slow, disease risk. 1 hex/season.
  | 'coast'         // Open shore. Moderate. 2 hexes/season.
  | 'ruins'         // Special overlay. Travel speed of underlying terrain.
  | 'desert'        // Arid wastes. Slow + high food cost. 1 hex/season, ×2 food consumption.
```

Travel speed is measured in **hexes per season**. Fractional values mean multiple seasons to cross one hex (e.g. `mountains` = 0.5 means a party spends 2 seasons in that hex before exiting).

**Boat modifier:** If the expedition has `hasBoat: true` and enters a `river` hex, speed is 6 hexes/season instead of 1.

### 3.2 Hex Content

A hex may hold any number of `HexContent` entries:

```typescript
type HexContentType =
  // ── One-time discoveries ─────────────────────────────────────
  | 'ruins'              // Ancient structure. Unique narrative event.
  | 'landmark'           // Named geographic feature. Flavour + minor buff.
  | 'resource_cache'     // One-time gather: food / stone / lumber / gold / medicine.
  | 'hidden_shrine'      // Religious lore discovery.
  | 'abandoned_camp'     // Previous settlers. May yield supply caches.
  | 'burial_ground'      // Sauromatian sacred site. Disposition effects.
  | 'fresh_water_spring' // Reduces food cost for future expeditions passing through.
  | 'old_road'           // Increases travel speed for future expeditions.

  // ── Tribe territory markers ───────────────────────────────────
  | 'tribe_territory'    // Hex belongs to or is patrolled by a named tribe.
  | 'tribe_outpost'      // Semi-permanent tribal camp; higher encounter chance.
  | 'tribe_settlement'   // Major tribal settlement; guaranteed contact on entry.

  // ── Recurring / conditional encounters ───────────────────────
  | 'travellers'         // Passing strangers. Random each entry.
  | 'animal_den'         // Wildlife. Can be hunted, avoided, or attract danger.
  | 'bandit_camp'        // Hostile non-tribal presence. May be cleared.
  | 'disease_vector'     // Wetland disease risk. Rolls each season spent here.
  | 'weather_hazard'     // Exposed terrain; season-dependent risk.
```

```typescript
interface HexContent {
  type: HexContentType;
  /** For tribe_territory / tribe_outpost / tribe_settlement — the tribe ID. */
  tribeId?: string;
  /** For resource_cache — what's there and how much. */
  resourceType?: ResourceType;
  resourceAmount?: number;
  /** True once the one-time part has been collected or the event has fired. */
  discovered: boolean;
  /** Custom label for landmarks, ruins, etc. */
  label?: string;
}
```

### 3.3 HexCell

```typescript
interface HexCell {
  /** Axial coordinates. q = column, r = row. */
  q: number;
  r: number;
  terrain: TerrainType;
  /**
   * Visibility state.
   * 'fog'      — never visited; terrain unknown.
   * 'scouted'  — briefly seen (adjacent reveal); terrain known, contents not.
   * 'visited'  — expedition has physically entered this hex.
   * 'cleared'  — visited and all one-time content exhausted; only recurring events remain.
   */
  visibility: 'fog' | 'scouted' | 'visited' | 'cleared';
  /** Contents of this hex (one-time discoveries, tribe markers, recurring hazards). */
  contents: HexContent[];
  /**
   * The turn on which this hex was first entered (not just scouted).
   * null if never physically visited.
   */
  firstVisitedTurn: number | null;
  /** Display name, if any (landmarks, tribe territory, etc). Set on generation. */
  label?: string;
}
```

**Coordinate system:** Axial (q, r) with offset-to-pixel conversion using standard pointed-top hex math. Settlement is always at `(7, 7)` — the centre of the 15×15 grid (indices 0–14).

### 3.4 HexMap

```typescript
interface HexMap {
  /** Width in hex columns. */
  width: number;   // 15
  /** Height in hex rows. */
  height: number;  // 15
  /**
   * All cells, keyed by `"${q},${r}"`.
   * Serialised as `[string, HexCell][]`.
   */
  cells: Map<string, HexCell>;
  /**
   * The axial coordinates of the player's settlement hex.
   * Always (7, 7) on a 15×15 grid.
   */
  settlementQ: number;
  settlementR: number;
}
```

### 3.5 Expedition

```typescript
type ExpeditionStatus =
  | 'preparing'   // Overlay is open; not yet dispatched.
  | 'travelling'  // En route; processing turn by turn.
  | 'at_hex'      // Paused in a hex resolving an encounter.
  | 'returning'   // Heading back to settlement.
  | 'completed'   // Returned; outcome delivered.
  | 'lost'        // All members dead or party collapsed.

interface ExpeditionWaypoint {
  q: number;
  r: number;
  /** Season + year when the expedition is expected to arrive at this hex (estimated). */
  estimatedArrivalTurn: number;
}

interface Expedition {
  id: string;
  /**
   * Display name — auto-generated as "{LeaderName}'s Expedition" (first) or
   * "{LeaderName}'s Second Expedition", "Third Expedition", etc. for repeat leaders.
   * The player can override this in the dispatch overlay before confirming.
   */
  name: string;
  /** ID of the person designated as expedition leader. Required. */
  leaderId: string;
  /** IDs of all other party members (up to 10). */
  memberIds: string[];
  /**
   * Whether the party has taken a boat from the settlement's boat pool.
   * One boat is available from game start (the expedition's arrival vessel).
   * Additional boats require a built `dock` and crafting.
   * A boat committed to an expedition is unavailable to others until the expedition returns.
   */
  hasBoat: boolean;
  /** Resources taken from settlement stores at dispatch time. */
  provisions: {
    food: number;
    goods: number;
    gold: number;
    medicine: number;
  };
  /** Current position on the hex map. */
  currentQ: number;
  currentR: number;
  /** Ordered list of remaining destinations. Player sets route at dispatch. Can be amended. */
  waypoints: ExpeditionWaypoint[];
  /** All hexes this expedition has physically entered, in order. */
  visitedHexes: Array<{ q: number; r: number; turn: number }>;
  status: ExpeditionStatus;
  /** Turn on which the expedition was dispatched. */
  dispatchedTurn: number;
  /** Turn on which the expedition returned (or was lost). null while active. */
  resolvedTurn: number | null;
  /**
   * Seasons of travel remaining before the party crosses into the next hex.
   * Decrements each dawn. When it reaches 0, the party enters the next waypoint hex.
   * Expressed in seasons (= turns), including fractional accumulation.
   */
  travelProgress: number;
  /** Seasons to cross the current hex (1 / travelSpeed). */
  seasonsPerCurrentHex: number;
  /**
   * Remaining food supply. Decrements each dawn by (memberCount × 0.25).
   * When it hits 0 the party begins starving — events fire and members may die.
   */
  foodRemaining: number;
  /**
   * Goods and gold remaining (may be spent in encounter resolutions).
   */
  goodsRemaining: number;
  goldRemaining: number;
  medicineRemaining: number;
  /**
   * Deferred events scheduled to fire at specific turns during this expedition.
   * These are separate from the main settlement DeferredEventEntry queue.
   */
  pendingExpeditionEvents: ExpeditionDeferredEvent[];
  /** Log of things that happened on this expedition — for the return report. */
  journal: ExpeditionJournalEntry[];
}
```

### 3.6 Expedition Events

Expedition events are a specialised variant of the main event system. They use the same `GameEvent` / `Choice` / `Consequence` structure but are flagged and routed differently.

```typescript
interface ExpeditionDeferredEvent {
  /** Resolved turn (the dawn on which this fires). */
  firesOnTurn: number;
  /** The `GameEvent.id` to fire. */
  eventId: string;
  /** Which expedition this event belongs to. */
  expeditionId: string;
  /** Actor bindings already resolved at scheduling time. */
  boundActors: Record<string, string>;
  /**
   * Context passed to the event resolver so consequences can reference
   * expedition resources (food, goods, etc.) and party members.
   */
  expeditionContext: {
    expeditionId: string;
    hex: { q: number; r: number };
  };
}
```

**Event categories relevant to expeditions** (new `'expedition'` category added alongside existing categories):
- Events in the `expedition` category are eligible for dispatch only when an expedition is active.
- Events can access `boundActors` entries including `'leader'`, `'member_1'` … `'member_N'`, and can slot-target any member.

### 3.7 GameState Additions

```typescript
// Added to GameState interface:
hexMap: HexMap;
expeditions: Expedition[];

/**
 * Number of boats currently in port (not committed to an expedition).
 * Starts at 1 (the vessel the expedition arrived on).
 * Increases when a craft_boat recipe completes at the dock.
 * Decreases by 1 when an expedition with hasBoat = true is dispatched;
 * increases by 1 when that expedition returns (or is marked lost).
 */
boatsInPort: number;

// Phase-gate: expeditions process each dawn in turn-processor.ts after faction processing.
// Expedition events land in the settlement's pendingEvents queue and are resolved
// before the player can Confirm Turn, just like settlement events.
```

---

## 4. Hex Grid Generation

### 4.1 Generation Algorithm

The grid is generated at game start (`createInitialState`) using the seeded RNG. Key rules:

1. **Settlement hex** `(7, 7)` is always `river` terrain — the expedition arrived by boat and the settlement is founded on the water.
2. **Settlement ring** (the 6 immediately adjacent hexes) are always walkable (`plains`, `forest`, `river`, or `coast`). No `mountains` or `jungle` within ring-1.
3. **Terrain blobs:** Use a simple region-flood approach — pick N seed cells, assign a terrain type, flood-fill to adjacent cells with falloff probability. This produces coherent terrain clusters rather than noise.
4. **River corridors:** 1–3 river corridors snake across the map from a random edge to another, connecting hexes in chains.
5. **Content seeding:** After terrain is set, seed content:
   - Each `ruins` or `abandoned_camp` is one-time placed in a non-settlement, non-ring hex.
   - Landmark labels are drawn from a small authored pool.
   - Tribe territories are placed adjacent to or around the pre-selected starting tribes' positions (informed by `GameConfig.startingTribes`).
6. **Starting visibility:** Settlement hex = `'visited'`. 3 randomly chosen adjacent hexes = `'scouted'` (terrain revealed, contents not). Everything else = `'fog'`.

### 4.2 Coordinate Math (Pointed-Top, Axial)

```
// Axial → pixel (pointy-top):
pixelX = hexSize * (√3 * q  +  √3/2 * r)
pixelY = hexSize * (             3/2  * r)

// Pixel → axial (for click detection):
q = (√3/3 * x  -  1/3 * y) / hexSize
r = (                2/3 * y) / hexSize
// then cube-round to snap to nearest hex
```

`hexSize` = the radius (center to vertex) of each hex. At default zoom, this should give roughly 40px per hex on a 1280-wide viewport over 15 columns.

---

## 5. Expedition Dispatch Overlay

### 5.1 Trigger

A button labelled **"Send Expedition"** (amber, small) sits at the bottom of the Known Clans column in `DiplomacyView`. Clicking it opens the `ExpeditionDispatchOverlay`.

### 5.2 Overlay Layout

```
┌────────────────────────────────────────────────────────────┐
│  SEND EXPEDITION                                [✕ Cancel] │
├──────────────────┬─────────────────────────────────────────┤
│  PARTY           │  ROUTE                                  │
│  ──────────────  │  ──────────────────────────────────────  │
│  Leader: [dropdown — all eligible settlers]               │
│  Members: [multi-select list, up to 10]                   │
│                  │  Mini hex map (pan/zoom enabled)        │
│  Boat: [ ] Yes   │  Click hexes to set waypoints           │
│  (1 in port)     │                                         │
│                  │  Estimated travel time shown per leg    │
│  PROVISIONS      │                                         │
│  ──────────────  │  Route summary:                         │
│  Food:   [====] 12 / 40 available                         │
│  Goods:  [====]  4 / 18 available                         │
│  Gold:   [====]  2 / 9  available                         │
│  Medicine:[===]  1 / 5  available                         │
│                  │                                         │
│  Est. duration: 8 seasons (2 years)                       │
│  Food req. (min): 10 (4 people × 0.25 × 10 seasons)       │
│                  │                                         │
│                  │  [Dispatch Expedition]  ← amber button  │
└──────────────────┴─────────────────────────────────────────┘
```

**Validation before dispatch:**
- Leader must be assigned.
- Food ≥ minimum required (people × 0.25 × estimated seasons). Warn if under; block if 0.
- All party members must be alive, not `away`, not `builder`, not `thrall`.
- If "Use boat" is toggled: `boatsInPort ≥ 1`. Button disabled with tooltip "No boats in port" if not met.
- Party members are set to `role = 'away'` on dispatch (same mechanic as existing away roles).

### 5.3 Route Setting

- The player clicks hexes on the mini-map to create an ordered waypoint list.
- Only reachable hexes (visible or adjacent to visible) can be set as waypoints. Unknown hexes past the fog edge can be targeted at the player's hazard — the expedition will discover what's there when it arrives.
- The overlay shows estimated travel time for each leg based on terrain type (if the hex is revealed; unknown hexes show `? seasons`).
- Waypoints can be re-ordered or removed before dispatch.
- After dispatch, the route is locked. Adding or changing waypoints requires a future "amendment" UI (Phase 2 of this system).

---

## 6. Travel Mechanics

### 6.1 Turn-by-Turn Processing

Each dawn, after factions are processed (step 9.6b), active expeditions are processed in order:

1. **Deduct food:** `foodRemaining -= memberCount × 0.25`. If food drops to 0, set a starvation flag and fire a starvation event.
2. **Advance travel progress:** `travelProgress -= 1`. When `travelProgress <= 0`:
   a. Remove the first waypoint from the queue.
   b. Move expedition to that hex: `currentQ = waypoint.q`, `currentR = waypoint.r`.
   c. Update hex visibility to `'visited'`.
   d. Also update the 6 adjacent hexes to at least `'scouted'` (if currently `'fog'`).
   e. Trigger hex entry checks (see §7.2).
   f. If the waypoint list is now empty, set `status = 'returning'` and add the settlement hex as the final waypoint.
   g. Set `seasonsPerCurrentHex` and `travelProgress` based on the next waypoint's terrain.
3. **Process pending expedition events:** Any `ExpeditionDeferredEvent` whose `firesOnTurn <= currentTurn` is pulled out and injected into the settlement's `pendingEvents` queue (at the front, before settlement events, so the player resolves them first). The event card shows a banner: `⛺ Expedition: {expeditionName}` to contextualise it.
4. **Return arrival:** When the expedition reaches the settlement hex on `status = 'returning'`, set `status = 'completed'`, restore all party member roles to their previous roles, log the journal entries to the activity feed, and fire the return summary event.

### 6.2 Travel Speed Table

| Terrain | Hexes/season | Seasons/hex | Notes |
|---------|-------------|-------------|-------|
| `plains` | 4 | 0.25 | Fast; open country |
| `forest` | 2 | 0.5 | Moderate; navigable |
| `coast` | 2 | 0.5 | Easy coastal travel |
| `hills` | 1 | 1 | Slow; rough ground |
| `wetlands` | 1 | 1 | Slow; disease risk |
| `ruins` | 1 | 1 | Caution slows movement |
| `desert` | 1 | 1 | Slow + 2× food cost |
| `jungle` | 1 | 1 | Dense growth |
| `mountains` | 0.5 | 2 | Very slow; blocked in winter if `mountainPassBlocked` flag |
| `river` (foot) | 1 | 1 | On foot, following river bank |
| `river` (boat) | 6 | 0.17 | With `hasBoat = true`; 1 season crosses ~6 hexes |

**Fractional accumulation:** `travelProgress` is a float. Moving into a `plains` hex adds 0.25 to progress debt. Moving into `mountains` adds 2.0. Each dawn, we decrement by 1 (one season passes). When progress crosses 0, the party enters the next hex.

**Winter modifier:** Some terrain types are harder in winter. `mountains` with a `winterPassClosed` content flag become impassable (expedition halts until spring).

### 6.3 Food Consumption

Base: `0.25 food per person per season`.

Modifiers:
- `desert` terrain: ×2 consumption.
- `healer` role in party: reduces illness-related losses (not base food).
- Starvation threshold: when `foodRemaining <= 0` at start of a season, a starvation event fires. If unresolved for 2 seasons, party members begin dying youngest-to-oldest.

---

## 7. Hex Entry Checks

When an expedition physically enters a hex (not just scouts it from an adjacent hex), the following runs:

### 7.1 Visibility Updates
- Current hex → `'visited'`.
- All 6 adjacent hexes → `'scouted'` if currently `'fog'`.

### 7.2 Content Processing

For each `HexContent` entry in the hex:

| Content type | `discovered` flag | Action |
|---|---|---|
| `ruins`, `landmark`, `resource_cache`, `hidden_shrine`, `abandoned_camp`, `burial_ground`, `fresh_water_spring`, `old_road` | Check: if `!discovered` → schedule unique expedition event for `firesOnTurn = currentTurn` (immediate), set `discovered = true`. | One-time. |
| `tribe_territory` | — | Auto-call `establishTribeContact(tribeId)` on `ExternalTribe`. Sets `contactEstablished = true`. Does NOT set `diplomacyOpened`. Fires a contact notification event. |
| `tribe_outpost`, `tribe_settlement` | — | As above, but with higher base-disposition effect for peaceful approach. Settlement entry always fires a contact event. |
| `travellers`, `animal_den`, `bandit_camp`, `disease_vector`, `weather_hazard` | Never set; always roll each entry. | Roll against probability (terrain + season + leader skill). May schedule an event. |

### 7.3 Cleared Status

A hex transitions to `'cleared'` when:
- All `HexContent` entries with one-time-discovery types have `discovered = true`.
- No `tribe_territory` / `tribe_outpost` / `tribe_settlement` content (those never "clear").

Cleared hexes still produce recurring encounter rolls.

---

## 8. Event Integration

### 8.1 New Event Category

A new `'expedition'` category is added to `EventCategory`. Events in this category have access to actor slots drawn from the expedition party in addition to the usual settlement population.

### 8.2 Actor Slots for Expedition Events

Standard slots (`{leader}`, `{member_1}`, `{member_2}`, etc.) map to expedition party members. The `actorRequirements` system works as normal; `matchesCriteria` checks against the party subset.

### 8.3 Consequence Types (New)

The following consequence types are added to handle expedition-specific effects:

```typescript
// Modifies expedition food/goods/gold/medicine supply (negative = consumed)
{ type: 'modify_expedition_resource', target: 'food' | 'goods' | 'gold' | 'medicine', value: number }

// Removes a party member from the expedition (injury, capture, death)
// Uses the same GraveyardEntry mechanic as remove_person for death.
{ type: 'expedition_member_lost', target: '{slot}', params: { cause: 'injury' | 'death' | 'captured' | 'deserted' } }

// Party member is returned to settlement immediately (not at expedition end)
{ type: 'expedition_member_returns_early', target: '{slot}' }

// Sets the expedition's status to 'lost' (all members presumed gone)
{ type: 'expedition_ends', params: { outcome: 'lost' | 'abandoned' } }

// Establishes formal/informal contact with a tribe (beyond auto-contact on hex entry)
{ type: 'establish_tribe_relations', target: 'tribeId', params: { level: 'contact' | 'diplomacy' | 'trade' } }

// Reveals a hex immediately (scouting/intelligence)
{ type: 'reveal_hex', params: { q: number; r: number } }

// Adds a resource directly to expedition supplies
{ type: 'add_to_expedition', target: 'food' | 'goods' | 'gold', value: number }
```

### 8.4 Authored Expedition Event Groups

These are event families to author (in a new `definitions/expedition.ts` file). They use the expedition event category and fire when their trigger conditions are met.

**Discovery events (one-time):**
- `exp_ruins_discovered` — Ancient structure. Options: explore carefully (skill check: custom), loot quickly (risk injury), leave undisturbed.
- `exp_abandoned_camp_found` — Previous settlers. Options: search for supplies, follow their path (reveals adjacent hex), or read their journal (company standing effect).
- `exp_burial_ground_entered` — Sacred Sauromatian site. Options: pay respects (disposition +), remove artefacts (dispute later), mark on map (landmark).
- `exp_hidden_shrine_discovered` — Religious relic. Options: claim for Orthodox (standing +), leave for Wheel practitioners, bring home for study.
- `exp_fresh_water_spring` — Marks hex as reduced-cost. Simple narrative event; no player choice needed.
- `exp_old_road_found` — Ancient path. Options: follow it (waypoint redirect option), map it (reduces future travel time through adjacent hexes), report to Company (standing +).

**Tribe contact events (fire at first entry into tribe hex):**
- `exp_tribe_territory_entered` — "You have crossed into {tribeName} lands." Options: press on openly, make camp and send a message ahead, retreat and establish formal embassy first.
- `exp_tribe_settlement_approached` — Full settlement encounter. Disposition-gated outcomes. Sets `contactEstablished` and may open `diplomacyOpened`.
- `exp_tribe_patrol_encountered` — A patrol intercepts the party. Disposition-gated. Leader skill check. Options: parley, show strength, give gifts, run.

**Recurring encounters:**
- `exp_travellers_met` — Passing strangers. May be traders (trade for supplies), refugees (opinion/morale effects), Company agents (standing check), or scouts from a rival tribe.
- `exp_animal_attack` — Wildlife turns hostile. Combat check. Outcomes: repel (safe), injury (member loses health/trait), bonanza (meat bonus to food supply).
- `exp_disease_outbreak` — Wetland illness. Medicine check. Outcomes: contained (medicine consumed), spreads (member gets `grieving`/`traumatized` mental_state trait temporarily), member evacuated.
- `exp_bandit_ambush` — Hostile non-tribal forces. Options: fight (combat check), bribe (gold consumed), slip away (custom skill check).
- `exp_severe_weather` — Seasonal hazard. Options: shelter in place (costs 1 season travel), press on (injury risk), find locals for shelter (if tribe contact known nearby).

**Starvation / supply events:**
- `exp_food_running_low` — Warning event. Options: hunt (plants/combat check for food), turn back, send fastest member ahead for resupply (?).
- `exp_starvation_begins` — Party is out of food. Timed event (2 seasons to resolve or someone dies).

**Morality / morale events:**
- `exp_member_wants_to_turn_back` — Member low morale (tied to happiness system). Options: persuade, let them go, have leader overrule.
- `exp_leader_injured` — Leader takes an injury mid-expedition. Options: promote a member as acting leader, make camp and recover (costs settled turns), return home.

### 8.5 Return Summary Event

When an expedition reaches `status = 'completed'`, a special `exp_return_report` event fires. It is purely narrative — a structured journal summary showing:
- Hexes visited
- Tribes contacted
- Resources recovered
- Members lost
- Notable discoveries

No choices; one `Acknowledge` button. The event writes the journal entries to the activity log.

---

## 9. Tribe Contact Mechanics

### 9.1 What "Contact Established" Means

When an expedition enters a tribe's territory hex:
- `tribe.contactEstablished` is set to `true`.
- The tribe's name, rough population, and traits are now visible in the Known Clans list.
- The tribe **knows about the settlement**. Their AI will now actively consider the settlement in its decisions (trade desire, raiding, sending emissaries, triggering settlement events).
- At next dawn after contact, the tribe has a chance to appear in settlement event draws (new prerequisite type: `tribe_contact_established`).

### 9.2 What Contact Does NOT Yet Unlock

Contact alone does not:
- Open trade (requires Trading Post + `diplomacyOpened` flag).
- Allow formal alliance negotiations.
- Prevent raiding (a warlike tribe may raid at any disposition threshold).

A **follow-up diplomatic expedition** or a **player-dispatched emissary event** is needed to set `diplomacyOpened = true`, which is the gate for trade and alliance events.

### 9.3 ExternalTribe Field Additions

```typescript
// Added to ExternalTribe:

/** True if the player has made first contact (expedition entering territory). */
contactEstablished: boolean;  // already exists

/**
 * True if formal diplomatic relations have been opened (via follow-up
 * expedition or emissary event). Required for trade and alliance events.
 */
diplomacyOpened: boolean;

/**
 * The hex coordinates of this tribe's primary settlement/territory centre.
 * Derived from tribe_settlement / tribe_territory HexContent during map generation.
 */
territoryQ: number | null;
territoryR: number | null;

/**
 * Behaviour flags set by events or player actions.
 * Extensible — add new flags here rather than adding new boolean fields.
 */
flags: Set<TribeFlag>;
```

```typescript
type TribeFlag =
  | 'raiding_active'         // Currently raiding the settlement.
  | 'emissary_en_route'      // Player has sent an emissary to this tribe.
  | 'gifted_this_year'       // Player gifted them during the current year.
  | 'insulted'               // Player action caused lasting insult (disposition floor).
  | 'tribute_agreement'      // Player agreed to pay tribute.
  | 'alliance_offered'       // Player has offered an alliance.
  | 'watching_settlement'    // Aware of settlement, monitoring it.
  | 'migration_pressure'     // Tribe is being pushed by external forces, may migrate.
  ;
```

---

## 10. UI Details

### 10.1 Hex Map Rendering

The hex map replaces the `<img>` element in `DiplomacyView`'s right panel. The underlying Ashmark image is rendered as a `<div>` background behind the hex SVG layer.

**Layer order (bottom to top):**
1. Ashmark JPG background (same pan/zoom transform as before)
2. Revealed hex windows (SVG `<clipPath>` or `<polygon>` elements with transparent fill, revealing the image beneath)
3. Fog tiles (dark stone-coloured hexes with opacity for unvisited cells)
4. Scouted-but-not-visited tiles (semi-transparent with dashed border, terrain type visible)
5. Content icons (small SVG icons for tribe territory, ruins, resource caches, etc.)
6. Expedition tokens (small portrait-chip per active expedition showing current position)
7. Waypoint route lines (dashed amber lines showing planned route)
8. Settlement hex indicator (subtle amber ring around `(7,7)`)

**Hex states:**
- `'fog'` — Fully opaque dark tile. No information.
- `'scouted'` — Semi-transparent tile with terrain colour tint. No content icons shown.
- `'visited'` — Transparent (image shows through). Full content icons visible.
- `'cleared'` — As visited, but with a faint "checked" overlay.

### 10.2 Expedition Token

Each active expedition is shown on the map as a small chip: the leader's portrait thumbnail (20×20px) with a coloured ring indicating status (`amber` = travelling, `rose` = event resolving, `emerald` = returning).

Hovering the token shows a tooltip:
```
⛺ First Expedition
Leader: Karas
Party: 4 members
Food: 11 remaining
Status: 3 seasons to next hex
```

Clicking the token opens an `ExpeditionStatusPanel` slide-in (similar to the TribeInfoCard) showing full party list, route, journal so far, and a "Recall Expedition" button.

### 10.3 Known Clans Panel Updates

- Contacted tribes (whether or not `diplomacyOpened`) appear in the list.
- Each row now shows a secondary line: `Contact only` (grey) vs `Relations open` (amber) vs `Trading` (green) based on flags.
- **"Send Expedition" button** at the bottom of the panel (amber, full width).
- **"Active Expeditions: N"** counter shown below the button when expeditions are active.

### 10.4 Diplomacy Actions (Phase 2 re-enable)

The previously-disabled "Send Emissary", "Offer Gift", "Seek Alliance" buttons in TribeInfoCard become active when:
- "Send Emissary" — always active once `contactEstablished = true`. Opens a simplified dispatch overlay (single person, no waypoints — direct emissary flow using the existing deferred event chain).
- "Offer Gift" — active when `contactEstablished = true` and player has goods/gold available.
- "Seek Alliance" — active when `diplomacyOpened = true` and disposition ≥ 30.

---

## 11. GameState Serialisation

All new Map fields follow the existing convention:

```typescript
// hexMap.cells: Map<string, HexCell> → serialised as [string, HexCell][]
// expeditions: Expedition[] → plain array (no Map wrapping needed)
// ExternalTribe.flags: Set<TribeFlag> → serialised as TribeFlag[]
```

The `deserializeGameState` function (`serialization.ts`) needs new fallbacks:
- `hexMap` : if absent (old save), generate a fresh one at load time using the saved `gameConfig.startingLocation` seed.
- `expeditions` : `?? []`
- `boatsInPort` : `?? 1` (old saves assume the original boat is in port)
- `tribe.flags` : new `Set(tribe.flagsArray ?? [])` reconstruction.
- `tribe.diplomacyOpened` : `?? false`
- `tribe.territoryQ / territoryR` : `?? null`

---

## 12. Implementation Phases

This system is large. Recommended implementation order:

### Phase A — Hex Grid Foundation
- `HexCell`, `HexMap` interfaces in `game-state.ts`
- `generateHexMap(config, rng)` function in new `src/simulation/world/hex-map.ts`
- Serialisation round-trip in `serialization.ts`
- Tests: generation rules, coordinate math, visibility updates
- **UI**: render the hex grid over the Ashmark image (fog tiles + settlement hint). No interaction yet.

### Phase B — Expedition Data & Dispatch
- `Expedition`, `ExpeditionWaypoint`, `ExpeditionDeferredEvent` interfaces
- `createExpedition()` factory in new `src/simulation/world/expeditions.ts`; auto-name logic (`"{Leader}'s Expedition"`, `"{Leader}'s Second Expedition"`, etc.)
- `boatsInPort: number` added to `GameState`; initialised to `1`
- `dock` building added to `building-definitions.ts` (enables `craft_boat` recipe in `crafting.ts`)
- `craft_boat` recipe added to `crafting.ts` (consumes lumber + goods, increments `boatsInPort`)
- `ExpeditionDispatchOverlay` component (party picker, provisions sliders, boat toggle gated on `boatsInPort ≥ 1`, route setter on mini-map)
- Store actions: `dispatchExpedition` (decrements `boatsInPort` if `hasBoat`), `recallExpedition`
- Party members set to `role = 'away'` on dispatch; restored on return; `boatsInPort` restored on return/loss

### Phase C — Travel Processing
- `processExpeditions(state, rng)` in `expeditions.ts` called from `processDawn()`
- Per-turn food deduction
- Hex entry logic: visibility updates, adjacent scouting
- Travel progress math per terrain type
- Expedition token rendering on map

### Phase D — Events & Content
- `expedition.ts` event definitions file
- New consequence types in `resolver.ts`
- Hex content trigger checks in `processExpeditions`
- Expedition event routing to `pendingEvents`, banner rendering in `EventView`
- Return summary event

### Phase E — Tribe Contact Integration
- `ExternalTribe` field additions (`diplomacyOpened`, `territoryQ/R`, `flags`)
- Tribe territory HexContent wired to `establishTribeContact()`
- Known Clans panel contact-status display
- Re-enable Diplomacy action buttons in TribeInfoCard (Phase 2 gate now reachable)

### Phase F — Polish & Balance *(outstanding)*

- Waypoint amendment during active expeditions (UI to add/remove waypoints after dispatch)
- Winter/season terrain modifiers — `mountains` impassable when a `winterPassClosed` content flag is present
- Expedition status panel polish (full journal view; recall confirmation)
- Balance pass on food consumption and travel speeds

---

## 13. Open Questions (Defer to Implementation)

- **Boat acquisition:** The settlement is founded on a river; the expedition arrived by boat, so **one boat is available from game start**. Additional boats are unlocked by building a `dock` (new building) and crafting them there. Boats are tracked as a settlement resource/asset. The dispatch overlay shows a "Use boat" toggle (only available if at least one boat is in port and not already committed to another expedition).
- **Multiple simultaneous expeditions UI:** With more than 2 active, the map tokens could overlap. Consider a stacked-chip display with a disambiguation popover.
- **Map size growth:** When/if the grid expands beyond 15×15, new cells are appended to `hexMap.cells`. Edge cells of the old grid get a `'fog'` state by default. Existing expedition waypoints remain valid.
- **Expedition name generation:** Auto-generate from leader name + ordinal suffix, e.g. "Karas's Expedition", "Karas's Second Expedition". The ordinal increments per leader (not globally), so two leaders each running their first trip both produce "X's Expedition" without collision. The player can rename in the dispatch overlay before confirming dispatch.
- **Company awareness:** Should the Company receive faction reaction from what expeditions discover? (e.g. finding a populous tribal settlement near Company supply routes could affect standing). Mark as Phase F consideration.

---

## 14. File Manifest (New Files)

| File | Purpose |
|------|---------|
| `src/simulation/world/hex-map.ts` | `HexCell`, `HexMap`, `generateHexMap()`, coordinate math, visibility helpers |
| `src/simulation/world/expeditions.ts` | `Expedition` type, `createExpedition()`, `processExpeditions()`, `dispatchExpedition()`, `recallExpedition()`, hex-entry trigger logic |
| `src/simulation/events/definitions/expedition.ts` | All expedition event definitions (discovery, tribe contact, encounters, starvation, return summary) |
| `src/ui/overlays/ExpeditionDispatchOverlay.tsx` | Full dispatch overlay (party picker, provisions, route) |
| `src/ui/components/HexGrid.tsx` | SVG hex grid renderer; fog/scouted/visited states; expedition tokens; waypoint lines |
| `src/ui/components/ExpeditionStatusPanel.tsx` | Slide-in panel for inspecting an active expedition |
| `tests/world/hex-map.test.ts` | Generation rules, coordinate math, visibility propagation |
| `tests/world/expeditions.test.ts` | Travel progress, food deduction, hex entry, return mechanics |

### Modified Files

| File | Change |
|------|--------|
| `src/simulation/turn/game-state.ts` | Add `HexCell`, `HexMap`, `Expedition`, `ExpeditionDeferredEvent` interfaces; add `hexMap`, `expeditions`, `boatsInPort` to `GameState`; add `diplomacyOpened`, `territoryQ/R`, `flags` to `ExternalTribe` |
| `src/simulation/turn/turn-processor.ts` | Call `processExpeditions()` in `processDawn()` after faction processing |
| `src/simulation/events/resolver.ts` | Handle 6 new expedition consequence types |
| `src/simulation/events/engine.ts` | Add `'expedition'` to `EventCategory` |
| `src/stores/game-store.ts` | Add `dispatchExpedition`, `recallExpedition` actions; restore party roles on return |
| `src/stores/serialization.ts` | Serialise/deserialise `hexMap.cells` (Map), `ExternalTribe.flags` (Set), add fallbacks |
| `src/ui/views/DiplomacyView.tsx` | Replace static `<img>` with `<HexGrid>`; add "Send Expedition" button |
| `src/ui/views/EventView.tsx` | Render expedition banner when `expeditionId` present on event |

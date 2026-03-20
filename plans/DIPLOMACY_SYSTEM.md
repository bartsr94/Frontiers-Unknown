# Diplomacy & Emissary System — Design Document

> **Status:** Design phase — ready to implement.
> **Depends on:** Expedition System (Phase A–D complete), `ExternalTribe` type, `HexMap`, deferred event engine, `processDawn` pipeline.
> **Scope:** Tribe discovery (Sighted → Known), emissary dispatch, diplomacy session overlay, gift mechanics, trade relationship gating.

---

## 1. Overview

This system bridges exploration and the existing trade screen. Expeditions scout the Ashmark and *sight* tribes. A separate **emissary** dispatch converts sightings into diplomatic relationships — opening trade routes, acquiring resources, and building standing.

The flow is:

```
Expedition enters tribe territory hex
  → Tribe becomes "Sighted" (appears in Known Clans with minimal info)
      → exp_tribe_territory_entered event resolves
          → Tribe becomes "Known" (full info, can send emissary)
              → Player dispatches Emissary (abstracted travel)
                  → N turns later: Diplomacy Session overlay fires
                      → Player performs actions (gifts, requests, propose trade)
                          → Emissary travels home
                              → Return notification
```

There are no encounter events during emissary travel — the diplomatic mission is clean, narrative travel. Only exploration expeditions trigger mid-journey events.

---

## 2. Tribe Discovery: Sighted → Known

### 2.1 Two-tier visibility model

| State | `sighted` | `contactEstablished` | What the player sees |
|-------|-----------|----------------------|----------------------|
| Hidden | `false` | `false` | Not in Known Clans at all |
| Sighted | `true` | `false` | Greyed row, "???" name, "Sighted" badge, no disposition bar, no actions |
| Known | `true` | `true` | Full row: name, ethnic badge, disposition bar — all info visible |

### 2.2 When Sighting fires

`discoverTribesFromExpedition(expedition, hexMap)` already exists and returns the set of tribe IDs whose `tribe_territory` hexes were visited this turn. This is called in `processExpeditions`. The store should apply the result: **set `tribe.sighted = true`** for each discovered tribe regardless of whether `contactEstablished` is already true.

This happens before events draw — so the tribe appears in the Known Clans list on the same turn the expedition's foot crosses into their territory.

### 2.3 When Known fires

`exp_tribe_territory_entered` (all three choices) call `establish_tribe_relations` with `level: 'contact'`, which sets `contactEstablished: true`. The event resolver already handles this correctly.

After this, the Known Clans row expands to show full info, disposition bar, and the "Send Emissary" button becomes active.

### 2.4 Sighted tribe card (read-only)

Clicking a Sighted tribe in the Known Clans list shows a minimal info card:

```
┌─────────────────────────────┐
│  ???                     ✕  │
│  Sighted in the Ashmark     │
│  ─────────────────────────  │
│  Your scouts have crossed   │
│  into lands belonging to    │
│  this clan. An expedition   │
│  must establish contact     │
│  before diplomacy is        │
│  possible.                  │
│                             │
│  [Send Expedition ▶]        │  ← opens ExpeditionDispatchOverlay
└─────────────────────────────┘
```

No emissary button, no action buttons. The `???` stays until `contactEstablished = true`.

---

## 3. Data Model Additions

### 3.1 `ExternalTribe` additions

```typescript
// Added to ExternalTribe (game-state.ts):

/**
 * Whether an expedition has entered this tribe's territory hex. The tribe
 * becomes visible in the Known Clans list (as "Sighted") but details are
 * hidden until contactEstablished is set.
 */
sighted: boolean;   // new — default false

// Already exists, listed for clarity:
contactEstablished: boolean;
diplomacyOpened: boolean;
territoryQ: number | null;
territoryR: number | null;
```

**`territoryQ/R` must be populated during `generateHexMap`**: when a `tribe_territory` hex cell is written for a tribe, the tribe's `territoryQ` and `territoryR` should be set at that point. The store needs to update the `tribes` Map entry alongside the `hexMap` cells entry. See §8.1 for implementation note.

### 3.2 `EmissaryDispatch` (new interface)

```typescript
export type EmissaryMissionType =
  | 'open_relations'    // Primary goal: establish diplomacy (sets diplomacyOpened)
  | 'gift_giving'       // Purely improve disposition; no strings attached
  | 'request_food'      // Ask for a food grant from the tribe
  | 'request_goods';    // Ask for a goods grant from the tribe

export interface EmissaryGiftBundle {
  gold: number;
  goods: number;
  food: number;
}

export interface EmissarySessionAction {
  type:
    | 'offer_gifts'       // Expends from giftsRemaining; +disposition
    | 'ask_food'          // Request food from tribe
    | 'ask_goods'         // Request goods from tribe
    | 'propose_trade'     // Sets diplomacyOpened; requires disposition ≥ threshold
    | 'take_leave';       // Concludes the session
  /** For offer_gifts: actual amount offered (may be less than packed). */
  giftsOffered?: Partial<EmissaryGiftBundle>;
  /** For ask_food / ask_goods: amount received (computed server-side). */
  resourcesReceived?: Partial<Record<ResourceType, number>>;
  /** Disposition delta applied by this action. */
  dispositionDelta: number;
  /** Narrative line written to the session log. */
  logEntry: string;
}

export interface EmissaryDispatch {
  id: string;
  tribeId: string;
  /** Person ID of the emissary. Their role is set to 'away' on dispatch. */
  emissaryId: string;
  missionType: EmissaryMissionType;
  dispatchedTurn: number;
  /** Turn on which the emissary arrives at the tribe. */
  arrivalTurn: number;
  /** Turn on which the emissary returns to the settlement. Set when session ends. */
  returnTurn: number | null;
  status: 'travelling' | 'at_tribe' | 'returning' | 'completed';
  /** Resources packed at dispatch. Never changes after dispatch. */
  packedGifts: EmissaryGiftBundle;
  /** Resources still available to spend during the session. Decremented by offer_gifts actions. */
  giftsRemaining: EmissaryGiftBundle;
  /** Actions performed during the diplomacy session, in order. */
  sessionActions: EmissarySessionAction[];
  /** Narrative log for the return report event. */
  sessionLog: string[];
}
```

### 3.3 `GameState` additions

```typescript
// Added to GameState (game-state.ts):

/**
 * All active and recently-completed emissary dispatches.
 * Completed entries are retained for one year then pruned.
 */
emissaries: EmissaryDispatch[];   // default []

/**
 * Emissary IDs whose diplomatic session is pending player resolution
 * (status === 'at_tribe', session not yet started). Checked by DiplomacyView
 * to open the EmissaryDiplomacyOverlay during management phase.
 */
pendingDiplomacySessions: string[];   // default []
```

---

## 4. Travel Time Formula

```typescript
function emissaryTravelTime(
  tribeId: string,
  tribes: Map<string, ExternalTribe>,
): number {
  const tribe = tribes.get(tribeId);
  if (!tribe || tribe.territoryQ === null || tribe.territoryR === null) {
    return 4; // fallback: 4-season one-way for unmapped tribes
  }
  const dist = axialDistance(
    tribe.territoryQ, tribe.territoryR,
    SETTLEMENT_Q, SETTLEMENT_R,
  );
  // Emissaries travel ~2 hexes/season (light load, known route on return).
  return Math.max(1, Math.ceil(dist / 2));
}
```

Round trip = `travelOneWay × 2 + 1` (the +1 is the session itself taking a season). If the emissary has a `bargaining` skill ≥ 63 (Excellent), reduce one-way time by 1 (minimum 1).

---

## 5. Dispatch Flow

### 5.1 `dispatchEmissary(params)` store action

```typescript
interface DispatchEmissaryParams {
  tribeId: string;
  emissaryId: string;
  missionType: EmissaryMissionType;
  packedGifts: EmissaryGiftBundle;
}
```

On dispatch:
1. Deduct `packedGifts` from `settlement.resources`.
2. Set `people.get(emissaryId).role = 'away'`.
3. Calculate `arrivalTurn = currentTurn + emissaryTravelTime(tribeId, tribes)`.
4. Create `EmissaryDispatch` with `status: 'travelling'`, `giftsRemaining = {...packedGifts}`.
5. Push to `state.emissaries`.

### 5.2 Dawn processing hook

In `startTurn()` processing, after `postDawnState` is built, scan `emissaries` for those with `status === 'travelling' && arrivalTurn <= currentTurn`. For each:
- Set `status: 'at_tribe'`.
- Add emissary ID to `pendingDiplomacySessions`.

In `startTurn()`, also scan for `status === 'returning' && returnTurn !== null && returnTurn <= currentTurn`. For each:
- Set `status: 'completed'`.
- Restore `people.get(emissaryId).role` to their pre-departure role (default `'gather_food'`).
- Fire a small notification via activity log: `'emissary_returned'` log entry.
- Prune old completed emissaries (older than 4 years).

---

## 6. `EmissaryDispatchOverlay.tsx`

Similar in structure to `ExpeditionDispatchOverlay`. Single-screen modal with:

```
┌──────────────────────────────────────────────┐
│  Send Emissary                          [✕]  │
├──────────────────────────────────────────────┤
│  Destination                                 │
│  [■ Kiswani Riverfolk — The Redfork Clan ▼]  │  ← dropdown, only known tribes shown
│  Est. travel: 3 seasons each way (6 total)   │
│                                              │
│  Mission                                     │
│  [ Open Relations ]  [ Gift Giving ]         │
│  [ Request Food   ]  [ Request Goods ]       │
│     ↑ one selected at a time (radio)         │
│                                              │
│  Emissary                                    │
│  [Person chip grid — single select]          │
│  Leader skill: Bargaining VG (55) ← bonus    │
│                                              │
│  Pack Gifts (optional)                       │
│  Gold  [ ─────────●─── ]  3 / 12            │
│  Goods [ ──────●─────── ]  5 / 40            │
│  Food  [ ──●─────────── ]  2 / 100           │
│                                              │
│  [Cancel]                [Send Emissary ▶]   │
└──────────────────────────────────────────────┘
```

**Validation rules:**
- Destination required (must be a `contactEstablished` tribe).
- Emissary required (must be `role !== 'away' && role !== 'builder'`).
- Mission `open_relations` and `propose_trade` require `!tribe.diplomacyOpened`.
- Mission `request_food` / `request_goods` are locked if tribe disposition < 0 (shown with tooltip).
- Gifts are optional but encouraged if tribe disposition is below 20.
- If no boat is used, no boat mechanic needed here (emissaries go on foot / by established routes).

---

## 7. `EmissaryDiplomacyOverlay.tsx`

This is the primary new UI piece. It opens during the management phase when `pendingDiplomacySessions` contains at least one emissary ID. A badge on the DiplomacyView nav tab shows the count.

### 7.1 Layout

```
┌────────────────────────────────────────────────────────────────────────┐
│  Diplomatic Audience — The Redfork Clan                           [✕]  │
├──────────────────────────────────────────────────────────────────────  │
│  [Portrait] Kirra (Emissary)                 [Tribe info area]         │
│  Bargaining: VG                              The Redfork Clan          │
│                                              Kiswani Riverfolk         │
│  Gifts on hand:                              Disposition: ████████░░  │
│  ◈ 3 gold  ◈ 5 goods  ◈ 2 food              Stability: Uncertain 55%  │
│                                              Traits: Traders, Peaceful │
│  ─────────────────────────────              Wants: Steel, Food        │
│  Session Log                                Offers: Horses, Herbs     │
│  ─────────────────────────                  ─────────────────────      │
│  · Kirra arrived at the Redfork             Disposition live          │
│    Clan's settlement. She was               ░░░░░░░░░░░░░░░░ 12 →     │
│    met by sentinels who                     (shown updating on action)  │
│    escorted her to the elders.              ─────────────────────      │
│                                             ACTIONS                    │
│                                                                        │
│                                  [ ◈ Offer Gifts        ]  ← always   │
│                                  [ ◈ Ask for Food       ]  ← gated    │
│                                  [ ◈ Ask for Goods      ]  ← gated    │
│                                  [ ◈ Propose Trade      ]  ← gated    │
│                                  ───────────────────────              │
│                                  [ ↩ Take Your Leave    ]  ← always   │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Action: Offer Gifts

Opens a sub-panel with sliders for gold, goods, and food (capped at `giftsRemaining`).

```
┌─────────────────────────────────────┐
│  Offer Gifts                        │
│                                     │
│  Gold  [──●──────]  1 / 3           │
│  Goods [────●────]  3 / 5           │
│  Food  [─●───────]  1 / 2           │
│                                     │
│  Estimated effect: +14 disposition  │
│  (Tribe desires food — bonus ×1.5)  │
│                                     │
│  [Cancel]  [Present gifts ▶]        │
└─────────────────────────────────────┘
```

After confirming: a log line is written, `giftsRemaining` decrements, the disposition bar animates to the new value.

Can be used multiple times per session (diminishing returns apply after the first gift action this year — see §8.2).

### 7.3 Action: Ask for Food / Goods

No sub-panel. A simple confirmation modal:

```
Request a supply of food from the Redfork Clan?
  
  Your current disposition with them is 24 (Cordial).
  Expected yield: ~8 food.

  [Cancel]  [Ask politely ▶]
```

The tribe provides `Math.floor(tribe.population / 40 × dispositionFactor)` food/goods:
- `dispositionFactor = clamp(disposition / 50, 0.2, 1.5)`
- Only available once per session.
- Locked if `tribe.disposition < 0`.
- If tribe `desires` the same resource you're asking for: locked entirely (they won't give away what they want).

### 7.4 Action: Propose Trade Relationship

Requires:
- `tribe.diplomacyOpened === false` (not already open)
- `tribe.disposition ≥ 20`
- OR tribe has `trader` trait (threshold drops to 5)

Outcome on confirm:
- Sets `tribe.diplomacyOpened = true` in the session actions.
- Log: *"The elders agreed to formalise trade with your settlement. Goods may now pass."*
- The trading route is activated when the emissary returns (applied by store on `status: 'completed'`).

### 7.5 Action: Take Your Leave

Always available. Concludes the session.

- Emissary's `status: 'returning'`.
- `returnTurn = currentTurn + travelOneWay`.
- Removes emissary ID from `pendingDiplomacySessions`.
- All `sessionActions` outcomes (resources gained, `diplomacyOpened`) are applied to `GameState` immediately via `resolveEmissarySession`.
- Remaining `giftsRemaining` resources are **returned to the settlement's stockpile** when the emissary physically returns (on `returnTurn`).

---

## 8. Gift Mechanics

### 8.1 Disposition gain formula

```typescript
function giftDispositionGain(
  gold: number,
  goods: number,
  food: number,
  tribe: ExternalTribe,
  giftedThisYear: boolean,
): number {
  // Base values
  let delta = gold * 5 + goods * 3 + food * 1;

  // Desire bonuses (tribe wants this resource → ×1.5)
  const desires = new Set(tribe.tradeDesires);
  if (desires.has('gold') && gold > 0)  delta += Math.floor(gold  * 5  * 0.5);
  if (desires.has('goods') && goods > 0) delta += Math.floor(goods * 3  * 0.5);
  if (desires.has('food') && food > 0)  delta += Math.floor(food  * 1  * 0.5);

  // Diminishing returns if already gifted this year
  if (giftedThisYear) delta = Math.floor(delta * 0.5);

  // Warlike tribes don't value gifts much
  if (tribe.traits.includes('warlike'))      delta = Math.floor(delta * 0.7);
  // Isolationist tribes are hard to impress with material gifts
  if (tribe.traits.includes('isolationist')) delta = Math.floor(delta * 0.6);
  // Desperate tribes are very receptive
  if (tribe.traits.includes('desperate'))    delta = Math.floor(delta * 1.5);

  return Math.min(delta, 40); // cap single-session gift gain at +40
}
```

### 8.2 "Gifted this year" flag

The `tribe.flags` system (from `EXPEDITION_SYSTEM.md`) is already designed but not yet implemented. For this phase, we add a simpler approach: a `giftedTurns: number | null` field on `ExternalTribe` tracks the last turn gifts were offered. "This year" = within 4 turns (one in-game year).

---

## 9. Known Clans Panel changes

### 9.1 `TribeListRow` — sighted display

```tsx
// Sighted (contactEstablished = false, sighted = true):
<button className="opacity-60 ...">
  <p className="text-stone-400 italic text-xs">??? — Sighted</p>
  <span className="text-[9px] px-1 py-0.5 rounded bg-stone-700 text-stone-400">
    SIGHTED
  </span>
</button>
```

The filter in `DiplomacyView` changes from:
```typescript
const contacts = [...gameState.tribes.values()].filter(t => t.contactEstablished)
```
to:
```typescript
const contacts = [...gameState.tribes.values()]
  .filter(t => t.contactEstablished || t.sighted)
  .sort((a, b) => {
    // Known before Sighted
    if (a.contactEstablished !== b.contactEstablished)
      return a.contactEstablished ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
```

### 9.2 `TribeInfoCard` — action buttons re-enabled

The three disabled stub buttons are replaced:

```tsx
// Send Emissary — active when contactEstablished and no emissary currently at_tribe/travelling for this tribe
<button
  onClick={() => openEmissaryDispatch(tribe.id)}
  disabled={!canSendEmissary}
  title={canSendEmissaryTitle}
>
  Send Emissary
</button>

// Offer Gift — inline quick-gift (opens EmissaryDispatchOverlay pre-set to 'gift_giving' mission)
<button
  onClick={() => openEmissaryDispatch(tribe.id, 'gift_giving')}
  disabled={!tribe.contactEstablished || currentPhase !== 'management'}
>
  Offer Gift
</button>

// Seek Alliance (propose trade) — active when diplomacyOpened = false, disposition ≥ 20
<button
  onClick={() => openEmissaryDispatch(tribe.id, 'open_relations')}
  disabled={tribe.diplomacyOpened || tribe.disposition < 20}
>
  {tribe.diplomacyOpened ? 'Trade Open ✓' : 'Seek Alliance'}
</button>
```

### 9.3 Pending session indicator

In the Known Clans header:

```tsx
{pendingDiplomacySessions.length > 0 && (
  <p className="text-amber-400 text-[11px] mt-0.5 font-semibold animate-pulse">
    {pendingDiplomacySessions.length} session{pendingDiplomacySessions.length > 1 ? 's' : ''} awaiting you
  </p>
)}
```

Clicking opens the first pending `EmissaryDiplomacyOverlay`. After resolving one, the next opens automatically if any remain.

### 9.4 Send Emissary button (bottom of Known Clans panel)

Add above the existing "Send Expedition" button:

```tsx
<button
  onClick={() => setShowEmissaryDispatch(true)}
  disabled={!canDispatch || contacts.filter(t => t.contactEstablished).length === 0}
  className="..."
  title="Send a diplomat to a known clan"
>
  ✦ Send Emissary
</button>
```

---

## 10. Hex Map: Emissary Tokens

Emissaries with `status: 'travelling'` or `status: 'returning'` are rendered on the hex map as a small token at an interpolated position between settlement and territory hex.

```typescript
// Approximate hex position for display (not used for real travel logic):
function emissaryDisplayHex(
  emissary: EmissaryDispatch,
  tribe: ExternalTribe,
  currentTurn: number,
): { q: number; r: number } | null {
  if (!tribe.territoryQ || !tribe.territoryR) return null;
  const travelTurns = emissary.arrivalTurn - emissary.dispatchedTurn;
  if (emissary.status === 'travelling') {
    const progress = (currentTurn - emissary.dispatchedTurn) / travelTurns;
    return interpolateHex(SETTLEMENT_Q, SETTLEMENT_R, tribe.territoryQ, tribe.territoryR, progress);
  }
  if (emissary.status === 'returning' && emissary.returnTurn) {
    const returnTravelTurns = emissary.returnTurn - (emissary.arrivalTurn + 1);
    const progress = (currentTurn - (emissary.arrivalTurn + 1)) / returnTravelTurns;
    return interpolateHex(tribe.territoryQ, tribe.territoryR, SETTLEMENT_Q, SETTLEMENT_R, progress);
  }
  return null;
}
```

Token visual: small `✦` in amber (travelling) or sky-blue (returning), rendered by `HexGrid.tsx` alongside expedition tokens. Clicking opens **the pending session panel** if `at_tribe`, or a minimal status tooltip otherwise:

```
✦ Kirra — Emissary
→ The Redfork Clan
Arrives in 2 seasons
```

---

## 11. Store Actions Summary

```typescript
// New actions on GameStore:
dispatchEmissary(params: DispatchEmissaryParams): void;
resolveEmissarySession(
  emissaryId: string,
  actions: EmissarySessionAction[],
): void;
dismissPendingDiplomacySession(emissaryId: string): void;  // called by Take Your Leave
```

`resolveEmissarySession`:
1. Applies `diplomacyOpened = true` to the relevant tribe if `propose_trade` action is present.
2. Credits any `resourcesReceived` from `ask_food` / `ask_goods` to `settlement.resources`.
3. Applies net `dispositionDelta` total across all actions to `tribe.disposition`.
4. Applies `gifted_this_year` logic to tribe.
5. Sets `emissary.status = 'returning'`, calculates `returnTurn`.
6. Removes emissary ID from `pendingDiplomacySessions`.
7. Gifts returned to settlement happen at `returnTurn` processing (not immediately).

---

## 12. Serialisation

### New fields requiring `deserializeGameState` fallbacks

| Field | Fallback |
|-------|---------|
| `ExternalTribe.sighted` | `?? false` |
| `ExternalTribe.giftedTurns` | `?? null` |
| `GameState.emissaries` | `?? []` |
| `GameState.pendingDiplomacySessions` | `?? []` |

`EmissaryDispatch` is a plain object — no Map fields.  `EmissaryGiftBundle` is a plain record. No special serialisation needed.

---

## 13. `generateHexMap` Patch: Populate `territoryQ/R`

When a `tribe_territory` hex cell is written in Step 7 of `generateHexMap`, the tribe entry in `config.tribes` (or returned as a separate map delta) should have `territoryQ` and `territoryR` set.

Since `generateHexMap` doesn't currently have access to the full `tribes` Map, the store's `createInitialState` does the placement. Two options:

**Option A (preferred)**: `generateHexMap` returns `{ hexMap, tribeTerritoryHexes: Map<string, { q: number; r: number }> }`. The store applies the coordinates to the tribes map after generation.

**Option B**: After `generateHexMap`, the store scans `hexMap.cells` for `tribe_territory` content and backfills `tribe.territoryQ/R`. A one-time scan is cheap.

Option B requires no signature change to `generateHexMap` and is backward-compatible with existing tests.

---

## 14. Implementation Phases

### Phase D1 — Tribe Sighting (no new UI)

**Files touched**: `expeditions.ts`, `game-store.ts`, `game-state.ts`, `serialization.ts`, `tribes.ts`, `DiplomacyView.tsx`

1. Add `sighted: boolean` to `ExternalTribe`; default `false`.
2. Add `giftedTurns: number | null` to `ExternalTribe`; default `null`.
3. Wire `discoverTribesFromExpedition` result into `startTurn()` — apply `sighted = true` for each discovered tribe.
4. Backfill `tribe.territoryQ/R` from hex map scan in `createInitialState` / after `generateHexMap`. (Option B — scan `hexMap.cells`)
5. `DiplomacyView` — expand Known Clans filter to include sighted tribes; show "Sighted" badge row; minimal TribeInfoCard for sighted.
6. `DiplomacyView` — TribeInfoCard "Send Expedition" button active for sighted tribes.
7. Serialisation fallbacks.
8. Tests: `discoverTribesFromExpedition` already tested; add test that `sighted` flag is set on the tribe.

**Exit criteria**: Expedition enters territory hex → tribe appears in Known Clans as "Sighted ???" that same turn. Resolving the territory event flips it to fully known.

---

### Phase D2 — Emissary Dispatch

**Files touched**: `game-state.ts`, `game-store.ts`, `serialization.ts`, new `EmissaryDispatchOverlay.tsx`, `DiplomacyView.tsx`

1. Add `EmissaryDispatch`, `EmissaryMissionType`, `EmissaryGiftBundle`, `EmissarySessionAction` interfaces to `game-state.ts`.
2. Add `emissaries: EmissaryDispatch[]` and `pendingDiplomacySessions: string[]` to `GameState`.
3. Implement `emissaryTravelTime()` in new `src/simulation/world/emissaries.ts`.
4. Implement `dispatchEmissary` store action.
5. Wire dawn processing in `startTurn()`: advance `travelling → at_tribe`, advance `returning → completed` (restore role, apply returned gifts).
6. Build `EmissaryDispatchOverlay.tsx` — single emissary picker, tribe dropdown (known only), mission type radio, gift sliders.
7. Wire "Send Emissary" button in DiplomacyView + TribeInfoCard into the overlay.
8. Serialisation.
9. Tests: dispatch creates correct `arrivalTurn`; dawn processing advances status; returned gifts applied on completion.

---

### Phase D3 — Diplomacy Session Overlay

**Files touched**: new `EmissaryDiplomacyOverlay.tsx`, `game-store.ts`, `DiplomacyView.tsx`, `HexGrid.tsx`

1. Implement `resolveEmissarySession` store action (see §11).
2. Implement gift disposition formula (`giftDispositionGain`) in `emissaries.ts`.
3. Implement resource request logic (`computeResourceRequestYield`).
4. Build `EmissaryDiplomacyOverlay.tsx` — full negotiation session UI (§7).
5. Wire `pendingDiplomacySessions` badge and auto-open logic in `DiplomacyView.tsx`.
6. Re-enable TribeInfoCard action buttons (§9.2).
7. Add emissary tokens to `HexGrid.tsx` (interpolated position, click tooltip).
8. Tests: gift formula variants; request yield formula; `resolveEmissarySession` applies diplomacyOpened + resources correctly; disposition updates.

---

## 15. Hard Rules Compliance

| Rule | Compliance |
|------|-----------|
| No `Math.random()` | Travel time uses no randomness; gift outcomes are deterministic formulas |
| No React in `src/simulation/` | `emissaries.ts` is pure TS (travel time, gift formula, yield formula) |
| No `any` types | All interfaces explicitly typed |
| Map serialisation | `emissaries` is a plain array — no Map wrapping needed; `tribes` Map serialisation unchanged |

---

## 16. Open Questions / Deferred

- **Permanent liaisons**: An emissary who stays at a tribe permanently as a resident envoy. Would grant a passive disposition bonus per turn and unlock special events. Deferred to a later phase.
- **Hostile reception**: If tribe disposition < −30 when emissary arrives, the session fires a special "Turned away" single-choice event and the emissary returns immediately with no session. The disposition might worsen or hold steady depending on tribe traits.
- **Trade caravans**: A follow-on system where `diplomacyOpened = true` enables scheduled caravan dispatches (bigger, slower, but carry more goods than normal trade). Deferred.
- **Multiple emissaries to the same tribe**: Currently blocked (one active emissary per tribe). Could be opened later (e.g. to simultaneously gift + negotiate).
- **Tribal emissaries to you**: Tribes with high disposition and `diplomacyOpened = false` could dispatch their own emissary to the settlement, triggering a mirror "Receive Audience" event. Deferred.

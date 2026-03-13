# Cultural Identity Pressure System
## Design & Implementation Document

**Status:** Planned  
**Phase:** 3 (extension)  
**Depends on:** `SettlementCulture.culturalBlend` (already computed every dawn), `CompanyRelation.standing`, `ExternalTribe.disposition`

---

## 1. Design Intent

Your settlers are a small group of Imanian outsiders living inside a larger Sauromatian world. The Ansberry Company expects them to remain culturally Imanian — the settlement is an extension of Company territory and a beachhead of Imanian civilisation. But the reality of survival, intermarriage, and daily coexistence with native neighbours slowly erodes that identity. Over generations, a new fusion culture emerges.

This system makes **cultural identity a resource to be managed** alongside food and gold. Let your Imanian character decay too far and the Company will intervene. Stay too rigidly Imanian and the surrounding tribes will grow hostile, disrupting trade, raiding, and eventually treating your settlement as an occupying force. The sweet spot is a precarious balancing act that shifts as your population changes.

The player has no direct dial to turn. Identity is **emergent** — it flows from who you marry, which buildings you construct, which events you accept, and how your children are raised. The pressure system watches that emergent blend and applies consequences when it drifts too far in either direction.

---

## 2. The Scale

Cultural blend is already tracked in `SettlementCulture.culturalBlend` as a value from `0.0` to `1.0`:

```
0.0  =  Pure Imanian Ansberite  (everyone is a Company man)
1.0  =  Fully Sauromatian Native  (you've gone completely native)
```

### 2.1 Zones

```
0.0 ─── 0.10 ─── 0.25 ──────────────────── 0.65 ─── 0.80 ─── 1.0
  ████████ ░░░░░░░░                          ░░░░░░░░ ████████
  Extreme  Soft         SAFE ZONE            Soft    Extreme
  Imanian  Imanian    (no pressure)          Native   Native
  ─────────────────                          ─────────────────
  Company  Company                           Tribal   Tribal
   bonus   warns                             discord   fury
```

| Zone | Range | Effect |
|------|-------|--------|
| Extreme Imanian | 0.0 – 0.10 | Company gives a small standing bonus; tribes grow quietly hostile to the foreign enclave |
| Soft Imanian | 0.10 – 0.25 | Company comfortable; tribes notice you remain foreign — disposition begins a slow drain |
| **Safe Zone** | **0.25 – 0.65** | **No pressure from either side; natural equilibrium** |
| Soft Native | 0.65 – 0.80 | Tribes warm; Company starts writing pointed letters — standing begins a slow drain |
| Extreme Native | 0.80 – 1.0 | Tribes may treat you as kin; Company considers intervention — standing drains fast |

The safe zone is skewed slightly native (0.25–0.65 rather than a symmetric 50/50) to reflect the ground truth: you are living in their world. Some degree of cultural accommodation is not betrayal — it is survival.

---

## 3. Mechanics

### 3.1 Pressure Counters

Two counters are added to `GameState`:

```typescript
interface IdentityPressure {
  companyPressureTurns: number;   // seasons spent in Soft/Extreme Native zones
  tribalPressureTurns: number;    // seasons spent in Soft/Extreme Imanian zones
}
```

Each counter increments by 1 each dawn while outside the safe zone on its side, and resets to 0 the moment the blend re-enters the safe zone. These counters gate event triggers and scale warning severity.

### 3.2 Passive Effects Per Season

Each dawn, `processIdentityPressure()` computes standing/disposition deltas that are applied silently — no player notification unless an event fires.

#### Company Standing Delta

| Zone | Delta per season |
|------|-----------------|
| Extreme Imanian (< 0.10) | **+0.5** (bonus for cultural discipline) |
| Soft Imanian (0.10 – 0.25) | **+0.25** (modest approval) |
| Safe Zone | **0** |
| Soft Native (0.65 – 0.80) | **−0.5** |
| Extreme Native (> 0.80) | **−1.5** |

#### Base Tribe Disposition Delta (per tribe, per season)

| Zone | Base delta |
|------|-----------|
| Extreme Imanian | **−1.5** (you are a foreign occupation) |
| Soft Imanian | **−0.5** |
| Safe Zone | **0** |
| Soft Native | **+0.5** |
| Extreme Native | **+1.0** |

#### Tribe Trait Multipliers

Individual tribes react differently based on their traits. The base delta is multiplied by the average of all applicable trait multipliers.

| Trait | Imanian-zone multiplier | Native-zone multiplier |
|-------|------------------------|------------------------|
| `warlike` | ×1.8 (resents foreign presence strongly) | ×1.3 (respects aligned settlements) |
| `peaceful` | ×1.0 | ×0.7 (mild warmth but not tribal) |
| `isolationist` | ×0.3 (indifferent — they want no contact either way) | ×0.3 |
| `trader` | ×0.7 (business first, culture second) | ×0.6 |
| `expansionist` | ×1.5 (sees Imanian settlement as territorial threat) | ×0.3 (native settlers are potential subjects, not allies) |
| `desperate` | ×1.2 | ×1.2 (strongly motivated by any edge) |

> **Example:** A warlike tribe with the desperate trait has multipliers averaged from those two rows. For the Imanian zone: (1.8 + 1.2) / 2 = **×1.5**. For the native zone: (1.3 + 1.2) / 2 = **×1.25**.

---

## 4. Events

Six new events are added in `src/simulation/events/definitions/identity.ts`. They use the existing event system unchanged — they are standard `GameEvent` objects with new `PrerequisiteType` values.

### 4.1 Event Table

| Event ID | Prerequisite | Summary |
|----------|-------------|---------|
| `ident_company_cultural_concern` | `tribalPressureTurns ≥ 3` | A Company factor writes a pointed letter expressing concern about "reports of the settlement going native". Choices: send a reassurance gift (gold cost, no standing loss) or dismiss the letter (standing −8). |
| `ident_company_inspector_dispatched` | `tribalPressureTurns ≥ 8` | An inspector arrives to assess the settlement's Imanian character. Choices: comply and hold an Imanian ceremony (standing +5, cultural drift toward Imanian) or defy the inspector (standing −15, morale boost among Sauromatian-heritage settlers). |
| `ident_company_pleased` | `blend ≤ 0.20`, `companyPressureTurns ≥ 5` | Rare. A commendation arrives from the Company recognising the settlement's cultural dedication. Standing +10. |
| `ident_tribal_leader_invitation` | `companyPressureTurns ≥ 3` | A named elder from the most-disposed tribe invites your leader to a ceremonial gathering. Actor slots: `{leader}`, `{elder}`. Accept (disposition +15 for inviting tribe) or politely decline (no cost). |
| `ident_tribal_champion_recognised` | `blend ≥ 0.80`, `companyPressureTurns ≥ 8` | The regional tribes formally recognise your settlement as kin rather than intruders. All tribe dispositions +10. Company standing −10. A permanent cultural milestone. |
| `ident_settlers_feel_foreign` | `companyPressureTurns ≥ 5` | Sauromatian-heritage settlers quietly express that they feel like outsiders in their own settlement. Actor slot: `{settler}` (Sauromatian-heritage person). Choices: hold a native celebration (−company standing, +native drift) or hold an Imanian outreach ceremony (+Imanian drift, settler satisfaction). |

### 4.2 New Prerequisite Types

Four prerequisite types are added to the existing `PrerequisiteType` union:

```typescript
type PrerequisiteType =
  // ... existing types ...
  | 'min_company_pressure_turns'   // params: { turns: number }
  | 'min_tribal_pressure_turns'    // params: { turns: number }
  | 'min_cultural_blend'           // params: { blend: number }
  | 'max_cultural_blend'           // params: { blend: number }
```

---

## 5. Player Levers

The player cannot directly control the blend number, but they shape it through:

| Lever | Effect |
|-------|--------|
| **Marriages** | Marrying settlers to Sauromatian women accelerates native drift over generations via bloodline inheritance and cultural drift. Importing Imanian wives keeps the settlement Imanian-leaning. |
| **Building styles** | Buildings with style variants (roundhouse, longhouse, great_hall, etc.) exert a cultural pull each season. Constructing Sauromatian-style buildings nudges the blend native. Imanian-style buildings nudge it back. |
| **Event choices** | Specific event choices (including the new identity events) apply one-off cultural drift or standing modifiers. |
| **(Future) Policy screen** | A future policies screen will let the player adopt formal cultural practices (e.g. `company_law`, `essence_sharing`, `syncretic_worship` from the existing `CulturalPracticeId` list), which will have ongoing identity effects. The `SettlementCulture.practices` array is the planned hook. |

---

## 6. Implementation Plan

### Phase A — State Foundations
**File: `src/simulation/turn/game-state.ts`**
- Add `IdentityPressure` interface
- Add `identityPressure: IdentityPressure` field to `GameState`
- Extend `PrerequisiteType` union with the 4 new types

### Phase B — Pure Logic Module
**New file: `src/simulation/culture/identity-pressure.ts`**
- Export `IDENTITY_THRESHOLDS` constants
- Export `IdentityPressureResult` interface: `{ updatedPressure, companyStandingDelta, tribeDispositionDeltas: { tribeId: string, delta: number }[] }`
- Export `processIdentityPressure(blend, currentPressure, tribes)` — pure function, deterministic, no RNG

### Phase C — New Events
**New file: `src/simulation/events/definitions/identity.ts`**
- 6 events as described in §4 above

**File: `src/simulation/events/event-filter.ts`**
- Add identity events to `ALL_EVENTS`
- Add evaluation cases for the 4 new `PrerequisiteType` values

### Phase D — Turn Loop Wiring
**File: `src/simulation/turn/turn-processor.ts`**
- Add `identityPressureUpdate: IdentityPressureResult` to `DawnResult`
- Call `processIdentityPressure()` near the end of `processDawn()`, after `updatedCultureBlend` is available

**File: `src/stores/game-store.ts`**
- In `startTurn`: apply `identityPressureUpdate` — update `state.identityPressure`, clamp-apply `companyStandingDelta`, apply per-tribe `tribeDispositionDeltas`
- Add `identityPressure: { companyPressureTurns: 0, tribalPressureTurns: 0 }` to the initial state factory

### Phase E — UI Widget
**New file: `src/ui/components/IdentityScale.tsx`**
- Horizontal 5-zone bar (red → orange → green → orange → red)
- Current blend position shown as a tick mark
- "Ansberite" label on the left, "Native" label on the right
- Company icon above the left danger zones; tribe icon above the right
- Small pressure counter badge visible while in a pressure zone (e.g. "3 seasons")
- Props: `{ culturalBlend: number, identityPressure: IdentityPressure }`

**File: `src/ui/views/SettlementView.tsx`**
- Mount `<IdentityScale>` as a header panel above the existing building content

### Phase F — Tests
**New file: `tests/culture/identity-pressure.test.ts`**

| Test | Assertion |
|------|-----------|
| Safe zone | No standing delta, no disposition delta, pressure counters stay at 0 |
| Soft native zone | Correct negative company delta, pressure counter increments |
| Extreme native zone | Stronger deltas, pressure counter increments |
| Safe zone re-entry | Both pressure counters reset to 0 |
| Tribe trait: warlike | Produces larger hostile penalty in Imanian zone than `peaceful` tribe |
| Tribe trait: isolationist | Near-zero deltas in both zones |
| Tribe multi-trait averaging | Correctly averages across multiple traits |
| Company bonus zone | Positive standing delta when blend < 0.10 |
| Determinism | Calling twice with same inputs produces identical outputs |

---

## 7. Affected Files Summary

| File | Change |
|------|--------|
| `src/simulation/turn/game-state.ts` | New `IdentityPressure` type + field + 4 `PrerequisiteType` additions |
| `src/simulation/turn/turn-processor.ts` | `DawnResult` extension + `processIdentityPressure` call |
| `src/simulation/events/event-filter.ts` | New events registered + 4 new prerequisite evaluation cases |
| `src/stores/game-store.ts` | Apply pressure deltas in `startTurn`; add to initial state |
| `src/ui/views/SettlementView.tsx` | Mount `IdentityScale` widget |
| `src/simulation/culture/identity-pressure.ts` | **New** — pure logic module |
| `src/simulation/events/definitions/identity.ts` | **New** — 6 identity events |
| `src/ui/components/IdentityScale.tsx` | **New** — UI widget |
| `tests/culture/identity-pressure.test.ts` | **New** — test suite (9+ tests) |

---

## 8. Constraints & Out of Scope

- **No `Math.random()`** — `processIdentityPressure` is fully deterministic. Events that need RNG use the existing seeded RNG pipe.
- **No `any` types** — all new types are strictly typed.
- **No React in `simulation/`** — `identity-pressure.ts` is pure TypeScript.
- **Backward compatibility** — `identityPressure` will be added to the initial state factory. Old saves are already wiped by the store's try/catch; no migration needed.
- **Existing tests unaffected** — no signatures changed, only additions.
- **Explicit policy toggles** are out of scope — the future policies screen will be built around the existing `SettlementCulture.practices` array.
- **Per-tribe identity tracking** is out of scope — one settlement-level blend drives all tribes, modified by their individual traits.
- **Tribe relationship depth** (Phase 3 Step 13) is tracked separately and not replaced by this system; the two systems complement each other.

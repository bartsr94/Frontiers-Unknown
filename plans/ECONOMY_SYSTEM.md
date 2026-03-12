# Economy System — Design Document

**Phase:** 3 (current)
**Status:** Design approved, ready to implement
**Companion Documents:** `PALUSTERIA_ARCHITECTURE.md`, `PALUSTERIA_GAME_DESIGN.md`

---

## 1. Overview

The economy system gives the settlement's resource production meaning beyond mere survival. Three forces create ongoing pressure and opportunity:

1. **The Ansberry Company** — your patron and creditor. It expects yearly returns. Fail it repeatedly and you're abandoned.
2. **Local tribes** — barter partners offering goods that the Company can't or won't supply, at prices that depend entirely on your relationship with them.
3. **Internal conversion** — crafting chains and seasonal spoilage that reward active management of what you've accumulated.

The player's core economic loop is: *Produce → Store → Trade → Pay Quota → Request → Grow*.

---

## 2. Design Pillars

### 2.1 Quota Is Pressure, Not Punishment
Missing a quota once isn't fatal — but the escalation is real and irreversible short of sustained recovery. The player should always feel the Company watching.

### 2.2 Trade Is Relationship-Dependent
A tribe that distrusts you offers bad terms or refuses entirely. A tribe you've treated fairly for a decade offers things money can't otherwise buy. The Trading Post doesn't just add +1 goods/season — it connects you to the Ashmark's barter economy.

### 2.3 Crafting Converts Surplus Into Value
The most valuable resource is often the one you have too much of. Workshop crafting lets you turn excess lumber into goods, or cattle you can't feed in winter into preserved food. Chains are short — no deep production trees.

### 2.4 Spoilage Creates Pressure Without Micromanagement
Stocks rot at predictable rates. The numbers are gentle enough that a small overage doesn't matter, but a six-month winter surplus will melt. The Granary and Stable exist partly to slow this.

### 2.5 Nine Resources Is the Ceiling
No new resource types. All crafting and trade operates on the existing nine: `food`, `cattle`, `goods`, `steel`, `lumber`, `stone`, `medicine`, `gold`, `horses`.

---

## 3. The Ansberry Company

### 3.1 Annual Quota

The Company expects its cut once a year, collected by ship every Autumn.

**Grace Period:** Years 1–3 have no quota. The Company is investing, not extracting.

**Quota Formula** (from Year 4 onward):

```
yearlyQuotaGold   = 5 + (currentYear - 3) × 2     // Year 4: 7, Year 6: 11, Year 10: 19…
yearlyQuotaGoods  = 8 + (currentYear - 3) × 3     // Year 4: 11, Year 6: 17, Year 10: 29…
```

Quotas are *either/or* — the Company accepts proportional contributions of gold and goods at an exchange rate of `1 gold = 2 goods`. Total value required = `quotaGold × 1 + quotaGoods × 0.5` (in gold-equivalent). Players may overpay in goods to cover a gold shortfall and vice versa.

**Contributing to the Quota:**  
During the Management phase of any turn, the player may call `contributeToQuota(gold, goods)`.  
Resources deducted immediately. `companyRelation.quotaContributedGold` and `quotaContributedGoods` track the running total for the year.

**Quota Check:**  
`processDusk()` on Autumn season end calls `checkQuotaStatus()`. Result is one of:
- `'exceeded'` — contributed more than required
- `'met'` — within ±10% of requirement  
- `'partial'` — 50–89% delivered
- `'failed'` — less than 50% delivered

The year's quota window resets after the check. `quotaContributed*` fields set to `0` each Winter-end.

### 3.2 Failure Escalation

`companyRelation.consecutiveFailures` tracks seasons of missed quotas.

| `consecutiveFailures` | Support Level | Consequence |
|---|---|---|
| 0 | `full_support` | Normal standing bonuses |
| 1 | `standard` | `co_quota_warning` event fires — standing −10 |
| 2 | `reduced` | `co_inspector_arrives` — a Company Man settler joins as inspector; standing −15 |
| 3 | `minimal` | `co_final_warning` — no supply delivery this year; standing −20 |
| 4+ | `abandoned` | `co_abandoned` fires; all Company events locked permanently; standing to 0 |

Partial delivery (`50–89%`) increments `consecutiveFailures` by 1 as normal. Full miss is also +1. Meeting quota resets `consecutiveFailures` to 0.

Exceeding quota resets `consecutiveFailures` to 0 **and** grants standing + optional reward (see §3.3).

### 3.3 Standing Rewards

High standing unlocks better resupply options. Standing decays by 1/year if no trade activity (not toward 0 — toward 50, the neutral point).

| Standing | Unlock |
|---|---|
| 40+ | Standard supply delivery |
| 55+ | Can request skilled settler |
| 65+ | Two request options per annual ship |
| 75+ | Premium supply upgrade (doubled delivery) |
| 85+ | Can request a Company escort (3 soldiers) |

### 3.4 Annual Resupply Ship

Every Spring (Year 2+), if `supportLevel` is not `abandoned`, the event `co_annual_ship` fires.

The base delivery is determined by `supportLevel`:

| Support Level | Base Delivery |
|---|---|
| `full_support` | 15 food, 10 gold, 5 goods, 5 medicine |
| `standard` | 10 food, 5 gold, 3 goods |
| `reduced` | 5 food, 2 gold |
| `minimal` | 2 food |
| `abandoned` | — (event locked) |

**Request System:**  
The resupply event offers choices based on standing. Costs are standing deducted at resolution.

| Request | Standing Cost | Outcome |
|---|---|---|
| Accept standard delivery | 0 | Base delivery only |
| Request women | −10 | Base delivery + 2 female settlers via `add_person` consequence |
| Request blacksmith | −15 | Base delivery + 1 high-`custom`-skill settler (`custom` 60–75) |
| Request soldiers | −20 | Base delivery + 2 high-`combat`-skill settlers (`combat` 65–80) |
| Request medicine cache | −12 | Base delivery + 12 medicine |

Requests are implemented as deferred consequences (`deferredTurns: 1`) — the requested settlers and goods arrive at the start of the next Spring, which is narratively: the ship unloads.

---

## 4. Tribe Trade

### 4.1 Prerequisites

Direct tribe trade requires:
1. `tribe.contactEstablished: true` — first contact has been made (see §4.2)
2. `settlement.buildings` includes at least one `trading_post` — physically enables trade

Without a Trading Post, the player may still trade via events (`eco_passing_merchant`, etc.), but cannot initiate trade in the TradeView.

### 4.2 Contact

Tribes chosen at game setup (via `GameConfig.startingTribes`) start with `contactEstablished: true`.

Other tribes start with `contactEstablished: false`. Contact is established via first-contact events (e.g., `dip_watchers_at_river` already fires for Riverfolk). When a diplomacy event fires and the player chooses a peaceful resolution, `tribe.contactEstablished` is set to `true` as an event consequence.

### 4.3 Trade Mechanics

**Desires and Offerings:**  
Each tribe preset defines `desires: ResourceType[]` and `offerings: ResourceType[]`. These are the resources they will pay premium for (when buying from you) and supply (when selling to you).

**Pricing:**  
Base exchange rate: `1 goods = 2 food = 1 steel = 0.5 gold = 4 lumber = 4 stone = 2 medicine = 0.5 horses`

Price modifiers by tribe relationship:
- Disposition ≥ 70: `+20%` value on what they offer you (you get more)
- Disposition 40–69: `1.0×` (neutral)
- Disposition 20–39: `−20%` (they drive harder bargain)
- Disposition < 20: trade refused

Additional modifier: `+10%` on desired resources (they're willing to pay more). `−10%` on non-desired resources (they don't want that as much).

**Fairness Meter:**  
`tradeValue = Σ(offered resources × price) - Σ(requested resources × price)`

The UI shows a live fairness bar:
- **Strongly favors you** (>+30%): tribe disposition will decrease after trade
- **Fair trade** (within ±30%): disposition unchanged or slight positive
- **Favorable to tribe** (>+15% in tribe's favour): disposition increases

**Cooldown:**  
`tribe.lastTradeTurn` prevents trading with the same tribe more than once per turn (Management phase only). No hard cap on frequency across turns.

**Trade Limits:**  
You can't offer what you don't have. `validateTrade()` enforces this. No credit.

### 4.4 Disposition Effects of Trade

After `executeTrade()` is called:

```
dispositionDelta = fairnessRatio × 5    // fair trade: +2–3 disposition
                 + tradeHistoryBonus    // +1 per 5 completed trades with this tribe (max +5)
                 - exploitationPenalty  // if tradeValue strongly favors player: −5 to −10
```

`tribe.tradeHistoryCount` increments by 1 after each completed trade.

### 4.5 Trading Post Bonuses

A built Trading Post provides two additional effects beyond the existing +1 goods/season per trader:

1. **Event weight boost:** `eco_passing_merchant` event weight doubled in `drawEvents()`. The merchants come to you.
2. **Merchant outcome bonus:** When `eco_passing_merchant` fires, `goods` outcome is +2 higher than base.

These bonuses do not stack if multiple Trading Posts are built (which isn't possible given `unique: true` on the building definition).

---

## 5. Resource Spoilage

### 5.1 Design Intent

Spoilage is gentle enough to ignore at small stocks, significant enough to matter when you're sitting on a large surplus. It fires during `processDawn()` so the player sees the loss at the start of their turn, not hidden in a dusk calculation.

### 5.2 Spoilage Rates

| Resource | Base Rate | Season Modifier | Building Mitigation |
|---|---|---|---|
| `food` | 5% of stock | Summer ×1.5 (7.5%) | Granary: rates halved |
| `cattle` | 3% of herd | Winter ×2 (6%) | Stable: rate halved |
| `horses` | 2% of stock | Winter ×2 (4%) | Stable: rate halved |
| `medicine` | 2% of stock | None | None |
| `goods` | 1% of stock | None | None |

All other resources (`steel`, `lumber`, `stone`, `gold`) do not spoil.

**Minimum Loss:** Spoilage is ignored if it would remove fewer than 1 unit (no fractional deductions). Small stocks are safe.

**Minimum Retained:** Spoilage cannot take a resource below 0.

### 5.3 DawnResult Extension

```typescript
spoilageThisTurn: Partial<ResourceStock>;   // added to DawnResult
```

The UI can display what was lost at dawn if non-zero (e.g., "2 food spoiled overnight").

---

## 6. Crafting Chains

### 6.1 Design Intent

Crafting converts surplus into necessity. The recipes are short and deliberate — no automated production chains, no conveyor belts. The player selects a conversion manually during the Management phase.

### 6.2 Recipe Definitions

```typescript
interface CraftRecipe {
  id: string;
  label: string;
  description: string;
  requires: {
    buildings?: BuildingId[];       // all must be present
    resources: Partial<ResourceStock>;
  };
  produces: Partial<ResourceStock>;
  turnsToComplete: 1;              // all recipes are instant (resolved next dawn)
}
```

All recipes are currently instant (`turnsToComplete: 1` — resolved at next dawn). Multi-turn crafting is a Phase 4 consideration.

### 6.3 Current Recipes

| ID | Label | Requires | Produces | Notes |
|---|---|---|---|---|
| `craft_lumber_to_goods` | Process Timber | Workshop + 3 lumber | 4 goods | Core conversion — makes post-construction lumber useful |
| `craft_cattle_slaughter` | Slaughter Cattle | 2 cattle | 3 food + 1 goods | Emergency food; no building needed |
| `craft_horse_breeding` | Horse Breeding Program | Stable + 2 horses + 4 food | steady horse income | Adds 1 horse/turn while active |
| `craft_medicine_prep` | Prepare Medicines | Healer's Hut + 3 food + 2 goods | 4 medicine | Turns trade goods into medicine |
| `craft_goods_to_gold` | Trade Goods for Company Scrip` | 5 goods | 2 gold | Poor exchange rate — emergency quota filler |

### 6.4 Unlocking Recipes

`getAvailableCrafts(buildings, resources)` returns only recipes where:
- All `requires.buildings` are in the settlement's built buildings list
- Player currently has at least 1 of every required resource (partial stock is OK — deficit caught at resolution time)

### 6.5 Resolution

`performCraft(recipeId)` in the store:
1. Calls `validateCraft()` — confirms buildings present and resources sufficient
2. Deducts `requires.resources` from `state.resources`
3. Adds `produces` to `state.resources` (instant) — or queues for next dawn if a multi-turn recipe

---

## 7. TradeView UI

### 7.1 Layout

Full-panel view accessed from the left nav (registered under `'trade'`). Two columns:

**Left column — Tribe list (25% width):**
- One row per tribe with `contactEstablished: true`
- Shows: tribe name, ethnic group chip, disposition bar (color-coded), last trade age ("3 turns ago" / "never")
- Tribes with disposition < 20 shown grayed out with "Distrustful — trade refused"
- Tribes without `contactEstablished` not shown (unknown)

**Right column — Trade panel (75% width):**

If no Trading Post built: locked panel with message "Build a Trading Post to establish direct trade relationships."

If Trading Post built and tribe selected: active trade interface.

### 7.2 Trade Panel

```
[Tribe Name + Disposition Bar]
[Desires: steel, medicine]     [Offerings: food, horses, goods]

YOU OFFER                              YOU REQUEST
[− food +] 0                           [− goods +] 0
[− gold +] 0                           [− horses +] 0

[==========FAIRNESS METER==========]
          29 value  ←→  31 value
              Roughly Fair

[Propose Deal]   (locked until both sides non-zero)
```

The fairness meter uses `getTradeValue()` to show live values. The "Propose Deal" button calls `executeTrade()`. On success, a brief confirmation line shows the disposition change: "+3 disposition with Riverfolk Clan of the Ashveil".

### 7.3 Disposition Preview

The panel shows:
- Current disposition
- Projected disposition after this trade
- Small note if a trade would lower disposition (e.g., "They feel this deal favors you — expect a slight cooling")

---

## 8. New and Modified Files

### New Files

| File | Purpose |
|---|---|
| `src/simulation/economy/company.ts` | `computeYearlyQuota`, `checkQuotaStatus`, `applyQuotaConsequences`, `getAvailableRequests`, `getCompanySupplyDelivery` |
| `src/simulation/economy/trade.ts` | `getTradeValue`, `validateTrade`, `executeTribeTradeLogic`, `TradeOffer`, `TradeResult`, `TradeValidation` |
| `src/simulation/economy/spoilage.ts` | `calculateSpoilage`, spoilage rate constants |
| `src/simulation/economy/crafting.ts` | `CraftRecipe`, `CRAFT_RECIPES`, `getAvailableCrafts`, `applyCraft`, `validateCraft` |
| `src/ui/views/TradeView.tsx` | Trade panel UI (tribe list + barter interface) |
| `tests/economy/company.test.ts` | Quota formula, escalation, request availability, support delivery |
| `tests/economy/trade.test.ts` | Price calculation, fairness, disposition deltas, Trading Post bonuses |
| `tests/economy/spoilage.test.ts` | Per-resource rates, season modifiers, building mitigation |
| `tests/economy/crafting.test.ts` | Recipe availability gating, apply/validate logic |

### Modified Files

| File | Changes |
|---|---|
| `src/simulation/turn/game-state.ts` | Extend `CompanyRelation` (quota tracking fields); extend `Tribe` (contact, trade history); add `TradeOffer` type; add `CompanyRequest` type; add `'trade'` to view enum; add `spoilageThisTurn` to `DawnResult` |
| `src/simulation/turn/turn-processor.ts` | Call `checkQuotaStatus()` + `applyQuotaConsequences()` in Autumn `processDusk()`; call `calculateSpoilage()` in `processDawn()`; reset quota contribution fields in Winter-end |
| `src/simulation/events/event-filter.ts` | Double `eco_passing_merchant` event weight when Trading Post present |
| `src/simulation/events/definitions/company.ts` | Add `co_annual_ship`, `co_quota_met`, `co_quota_warning`, `co_inspector_arrives`, `co_final_warning`, `co_abandoned` |
| `src/simulation/events/definitions/economic.ts` | +2 goods bonus when Trading Post present in `eco_passing_merchant` outcome |
| `src/simulation/buildings/building-effects.ts` | Add spoilage modifier getters (or move to `spoilage.ts`) |
| `src/stores/game-store.ts` | Implement `contributeToQuota()`, `executeTrade()`, `sendDiplomaticAction()`, `performCraft()` actions; fill `TradeOffer` / `CompanyRequest` types |
| `src/ui/views/SettlementView.tsx` | Add crafting sub-panel (4th tab or section within existing panel) |
| `src/ui/layout/LeftNav.tsx` | Register `'trade'` view in nav |

---

## 9. Implementation Sequence

Phase A and E are independent of each other and can be built in parallel. Phase B and C both depend on Phase A. Phase D depends on Phase C.

```
Phase A: Data model extensions + new simulation modules
  → Phase B: Company quota enforcement + events
  → Phase C: Tribe trade engine + Trading Post effects
      → Phase D: TradeView UI

Phase E: Spoilage + Crafting (parallel with B–D; independent of B/C)
```

### Suggested order for a single developer

1. **Phase A** — `game-state.ts` extensions, `company.ts`, `trade.ts`, `spoilage.ts`, `crafting.ts`; write tests
2. **Phase B** — quota enforcement in `turn-processor.ts`, `contributeToQuota()` action, new Company events
3. **Phase E** — wire spoilage into `processDawn()`, crafting panel in `SettlementView`
4. **Phase C** — `executeTrade()` implementation, Trading Post bonuses in event filter
5. **Phase D** — `TradeView.tsx`, nav registration

---

## 10. Open Questions

These items were noted during design but deferred for discussion:

1. **Partial quota credit:** Current design is all-or-nothing (you met it or didn't). An alternative: delivering 80–99% only increments `consecutiveFailures` by 0.5 (rounds up after two partial misses). Intended to reduce cliff-edge frustration.

2. **Company inspector as settler:** The `co_inspector_arrives` event adds a Company Man as a real `Person` with the `inspector` role. He can marry, have children, and die. His death triggers a follow-up event. This adds personality at the cost of implementation complexity. Worth it?

3. **Tribe gifting as diplomacy:** Should the player be able to send a pure gift (offering resources with zero in return) to boost disposition outside of the TradeView? Could be a `sendDiplomaticAction({ type: 'gift', resources: {...} })` call. Cheap to add once trade is wired.

4. **Storage capacity:** No warehouse cap is currently planned. If future overcrowding becomes a problem (e.g., player sits on 500 food), a soft capacity mechanic (spoilage accelerates above 3× seasonal consumption) would be the gentlest solution.

5. **Dead-end abandonment gameplay:** When `supportLevel = 'abandoned'`, the game enters a different mode — no Company events, no annual ship, but the settlement keeps running. Worth adding a distinct UI treatment (e.g., a persistent "[Abandoned by the Company]" banner) and new non-Company trade events to fill the event deck?

/**
 * Tribe barter trade mechanics — pricing, validation, and disposition effects.
 *
 * The trade system converts offers and counter-offers into a fairness value,
 * then applies disposition consequences based on how the deal balanced out.
 *
 * Pure logic — no React, no DOM, no store imports.
 * Source: ECONOMY_SYSTEM.md §4.
 */

import type { ResourceType, ResourceStock, ExternalTribe } from '../turn/game-state';

// ─── Types ────────────────────────────────────────────────────────────────────

/** A resource offer in a trade: maps each resource to the quantity offered. */
export type TradeOffer = Partial<Record<ResourceType, number>>;

/** Result of calling executeTribeTradeLogic(). */
export interface TradeResult {
  /** Updated resource stock after deducting offer and adding requested amounts. */
  newResources: ResourceStock;
  /** Disposition change to apply to the tribe (may be negative). */
  dispositionDelta: number;
  /** Updated tradeHistoryCount after this trade. */
  newTradeHistoryCount: number;
  /** Turn number to record as lastTradeTurn. */
  tradeTurn: number;
  /**
   * Disposition delta contributed by the assigned trader's bargaining skill alone.
   * Range: −2 (Fair skill) to +5 (Heroic skill). Zero when no trader is assigned.
   * Exposed separately so the TradeView UI can label the skill contribution.
   */
  traderSkillBonus: number;
}

/** Result of validateTrade(). Discriminated by `ok`. */
export type TradeValidation =
  | { ok: true }
  | { ok: false; reason: string };

// ─── Base Exchange Rates ──────────────────────────────────────────────────────

/**
 * Gold-equivalent value of 1 unit of each resource.
 * Base exchange rate: 1 goods = 2 food = 1 steel = 0.5 gold = 4 lumber
 *                    = 4 stone = 2 medicine = 0.5 horses.
 * (In gold units — goods = 1, gold = 2, horses = 2.)
 *
 * Source: ECONOMY_SYSTEM.md §4.3
 */
export const RESOURCE_BASE_VALUES: Record<ResourceType, number> = {
  goods:    1.0,
  food:     0.5,
  cattle:   0.5,
  steel:    1.0,
  lumber:   0.25,
  stone:    0.25,
  medicine: 0.5,
  gold:     2.0,
  horses:   2.0,
};

// ─── Pricing Helpers ──────────────────────────────────────────────────────────

/**
 * Returns the disposition-adjusted price multiplier for a tribe.
 * This affects how much value the tribe's offerings are worth to the player.
 *
 * Disposition ≥ 70: +20% (1.2)
 * Disposition 40–69: neutral (1.0)
 * Disposition 20–39: −20% (0.8)
 * Disposition < 20: trade refused (caller should not reach this path)
 */
export function getTribeDispositionMultiplier(disposition: number): number {
  if (disposition >= 70) return 1.2;
  if (disposition >= 40) return 1.0;
  return 0.8;
}

/**
 * Computes the total gold-equivalent value of a set of resources,
 * with optional tribe context to apply desire/offering price modifiers.
 *
 * When `side` is 'player', resources are what the PLAYER is offering to the tribe
 * (so tribe's desires apply a +10% modifier — they're willing to pay more).
 * When `side` is 'tribe', resources are what the TRIBE is offering
 * (disposition multiplier applies; non-desired resources get −10%).
 *
 * @param resources - The resources being valued.
 * @param tribe - The tribe involved in the trade.
 * @param side - Which side of the deal these resources represent.
 */
export function getTradeValue(
  resources: TradeOffer,
  tribe: ExternalTribe,
  side: 'player' | 'tribe',
): number {
  let total = 0;
  for (const [res, qty] of Object.entries(resources) as [ResourceType, number][]) {
    if (!qty || qty <= 0) continue;
    let unitValue = RESOURCE_BASE_VALUES[res];
    if (side === 'player') {
      // Tribe's perspective: does this tribe want this resource?
      if (tribe.tradeDesires.includes(res)) {
        unitValue *= 1.1;
      }
    } else {
      // Player's perspective: tribe's offerings discounted by disposition.
      const dispMult = getTribeDispositionMultiplier(tribe.disposition);
      unitValue *= dispMult;
      // Tribe-desired resources (things the tribe wants to buy) are not relevant
      // to what the tribe offers — no modifier here.
    }
    total += unitValue * qty;
  }
  return total;
}

// ─── Fairness Calculation ─────────────────────────────────────────────────────

/**
 * Calculates the disposition delta resulting from a completed trade.
 *
 * Based on the ratio playerValue / tribeValue:
 *   > 1.3 (strongly favors player): −5 to −10 exploitation penalty
 *   0.7–1.3 (roughly fair):         +2–3 from fairness ratio
 *   < 0.7 (favors tribe):           +3–5 from generosity
 *
 * Trade history bonus: +1 per 5 completed trades (capped at +5).
 *
 * @param playerValue - Gold-equivalent value of what the player receives.
 * @param tribeValue - Gold-equivalent value of what the tribe receives.
 * @param tradeHistoryCount - Number of trades completed before this one.
 */
export function calculateDispositionDelta(
  playerValue: number,
  tribeValue: number,
  tradeHistoryCount: number,
): number {
  // Avoid division by zero.
  if (tribeValue <= 0) return -5;

  const ratio = playerValue / tribeValue;
  let delta: number;

  if (ratio > 1.3) {
    // Player is exploiting the tribe.
    const severity = Math.min((ratio - 1.3) / 0.5, 1.0);
    delta = -(5 + Math.round(severity * 5)); // −5 to −10
  } else if (ratio < 0.7) {
    // Trade heavily favours the tribe — they appreciate the generosity.
    delta = 4;
  } else {
    // Roughly fair trade.
    delta = 2;
  }

  // Long-term relationship bonus: +1 per 5 completed trades, max +5.
  const historyBonus = Math.min(Math.floor(tradeHistoryCount / 5), 5);
  return delta + historyBonus;
}

// ─── Trade Validation ─────────────────────────────────────────────────────────

/**
 * Validates a proposed trade before execution.
 *
 * Checks (in order):
 * 1. Tribe's disposition is ≥ 20 (below this, trade is refused).
 * 2. The tribe has contactEstablished.
 * 3. Both sides of the offer are non-empty (something must be offered and requested).
 * 4. The player has sufficient resources to cover their offer.
 * 5. The resources the player is requesting are in the tribe's tradeOfferings list.
 * 6. The trade hasn't already happened this turn (lastTradeTurn guard).
 *
 * @param playerOffer - Resources the player is giving to the tribe.
 * @param playerRequests - Resources the player wants from the tribe.
 * @param currentResources - The player's current stockpile.
 * @param tribe - The tribe being traded with.
 * @param currentTurn - Current turn number for cooldown check.
 */
export function validateTrade(
  playerOffer: TradeOffer,
  playerRequests: TradeOffer,
  currentResources: ResourceStock,
  tribe: ExternalTribe,
  currentTurn: number,
): TradeValidation {
  if (!tribe.contactEstablished) {
    return { ok: false, reason: 'No contact established with this tribe.' };
  }
  if (tribe.disposition < 20) {
    return { ok: false, reason: `${tribe.name} distrusts you. Trade refused.` };
  }
  if (tribe.lastTradeTurn === currentTurn) {
    return { ok: false, reason: 'Already traded with this tribe this turn.' };
  }

  const offerTotal = Object.values(playerOffer).reduce((sum, v) => sum + (v ?? 0), 0);
  const requestTotal = Object.values(playerRequests).reduce((sum, v) => sum + (v ?? 0), 0);
  if (offerTotal <= 0 || requestTotal <= 0) {
    return { ok: false, reason: 'Both sides of the deal must be non-empty.' };
  }

  // Check player can afford their offer.
  for (const [res, qty] of Object.entries(playerOffer) as [ResourceType, number][]) {
    if (!qty || qty <= 0) continue;
    if (currentResources[res] < qty) {
      return { ok: false, reason: `Insufficient ${res} (have ${currentResources[res]}, need ${qty}).` };
    }
  }

  // Check tribe can supply what is requested.
  for (const [res, qty] of Object.entries(playerRequests) as [ResourceType, number][]) {
    if (!qty || qty <= 0) continue;
    if (!tribe.tradeOfferings.includes(res)) {
      return { ok: false, reason: `${tribe.name} does not trade ${res}.` };
    }
  }

  return { ok: true };
}

// ─── Trader Skill Helpers ─────────────────────────────────────────────────────

/**
 * Returns the disposition bonus/penalty contributed by the settlement's
 * assigned trader's bargaining skill, on top of the base fairness calculation.
 *
 * A skilled negotiator earns better outcomes without needing to offer more;
 * a poor one mars even a fair trade with clumsy dealings.
 *
 * @param bargaining - The trader's bargaining skill value (1–100), or undefined.
 * @returns Integer delta in the range [−2, +5].
 */
export function computeTraderSkillBonus(bargaining: number | undefined): number {
  if (bargaining === undefined) return 0;
  if (bargaining >= 91) return 5;  // Heroic
  if (bargaining >= 78) return 4;  // Renowned
  if (bargaining >= 63) return 3;  // Excellent
  if (bargaining >= 46) return 2;  // Very Good
  if (bargaining >= 26) return 0;  // Good — baseline
  return -2;                        // Fair — lacks finesse
}

// ─── Trade Execution ──────────────────────────────────────────────────────────

/**
 * Executes a validated trade, returning the delta state without mutating inputs.
 *
 * Prerequisites: validateTrade() must have returned `{ ok: true }` before calling this.
 *
 * @param currentResources - Player's resources before the trade.
 * @param playerOffer - What the player is giving.
 * @param playerRequests - What the player is receiving.
 * @param tribe - The tribe being traded with.
 * @param currentTurn - Current turn number; recorded as lastTradeTurn.
 * @param traderBargaining - Bargaining skill of the assigned trader (optional).
 *   When provided, the trader's skill modifies the final disposition delta.
 */
export function executeTribeTradeLogic(
  currentResources: ResourceStock,
  playerOffer: TradeOffer,
  playerRequests: TradeOffer,
  tribe: ExternalTribe,
  currentTurn: number,
  traderBargaining?: number,
): TradeResult {
  // Apply resource delta to the player's stock.
  const newResources = { ...currentResources };
  for (const [res, qty] of Object.entries(playerOffer) as [ResourceType, number][]) {
    if (qty > 0) newResources[res] = Math.max(0, newResources[res] - qty);
  }
  for (const [res, qty] of Object.entries(playerRequests) as [ResourceType, number][]) {
    if (qty > 0) newResources[res] = newResources[res] + qty;
  }

  // Compute value for fairness calculation.
  // "playerValue" = what the player receives (tribe's side).
  // "tribeValue" = what the tribe receives (player's offer).
  const playerValue = getTradeValue(playerRequests, tribe, 'tribe');
  const tribeValue  = getTradeValue(playerOffer,    tribe, 'player');

  const traderSkillBonus = computeTraderSkillBonus(traderBargaining);
  const dispositionDelta = calculateDispositionDelta(playerValue, tribeValue, tribe.tradeHistoryCount) + traderSkillBonus;

  return {
    newResources,
    dispositionDelta,
    newTradeHistoryCount: tribe.tradeHistoryCount + 1,
    tradeTurn: currentTurn,
    traderSkillBonus,
  };
}

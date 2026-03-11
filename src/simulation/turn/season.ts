/**
 * Seasonal production modifiers.
 *
 * Each season multiplies base worker output and cattle bonuses. Autumn
 * is the richest food season (harvest); winter is the harshest, requiring
 * careful rationing. Summer peaks trade activity.
 *
 * Applied by calculateProduction() in simulation/economy/resources.ts.
 */

import type { Season } from './game-state';

export interface SeasonModifiers {
  /**
   * Multiplier on food produced by farmers and cattle.
   * Spring = 1.0 (planting), Summer = 1.2 (growth), Autumn = 1.6 (harvest), Winter = 0.4 (dormant).
   */
  foodProduction: number;
  /**
   * Multiplier on goods produced by traders.
   * Summer = 1.3 (trade caravans peak), Winter = 0.7 (internal craft only).
   */
  goodsProduction: number;
}

export const SEASON_MODIFIERS: Record<Season, SeasonModifiers> = {
  spring: {
    foodProduction: 1.0,   // Planting — not yet harvesting, average yield
    goodsProduction: 1.0,  // Markets reopening after winter
  },
  summer: {
    foodProduction: 1.2,   // Crops growing well; cattle on lush pasture
    goodsProduction: 1.3,  // Peak trade season — caravans arrive, market busy
  },
  autumn: {
    foodProduction: 1.6,   // Harvest! Stock up for winter
    goodsProduction: 1.0,  // Trade winding down as parties head home
  },
  winter: {
    foodProduction: 0.4,   // Almost nothing grows; rationing becomes critical
    goodsProduction: 0.7,  // Internal craftsmanship and short-range exchange only
  },
};

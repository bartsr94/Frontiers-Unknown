/**
 * External tribe definitions and factory for the Palusteria simulation.
 *
 * Tribes are autonomous neighbouring Sauromatian groups that the player
 * encounters at game start. Each has a preset configuration covering
 * population, behavioural traits, desires, and offerings. The factory
 * `createTribe()` instantiates a live ExternalTribe from a preset config.
 *
 * Source: PALUSTERIA_GAME_DESIGN.md §10.1, CLAUDE.md Phase 2 step 9.
 * No React / DOM / store imports — pure simulation logic.
 */

import type { ExternalTribe, TribeDesire, TribeOffering, TribeTrait, ResourceType } from '../turn/game-state';
import type { EthnicGroup } from '../population/person';
import type { SeededRNG } from '../../utils/rng';

// ─── Config Type ──────────────────────────────────────────────────────────────

/**
 * Immutable configuration for a tribe preset.
 * Passed to `createTribe()` to produce a live ExternalTribe.
 */
export interface TribeConfig {
  /** Unique stable ID — used as the tribe's ID in GameState.tribes. */
  id: string;
  /** Display name shown in UI and event text. */
  name: string;
  /** The ethnic subgroup this tribe belongs to. */
  ethnicGroup: EthnicGroup;
  /** Approximate population at game start. */
  population: number;
  /**
   * Disposition toward the player at game start (-100 to +100).
   * Peaceful traders start high; warlike/territorial groups start near 0 or negative.
   */
  startingDisposition: number;
  /** Behavioural traits driving the tribe's AI. */
  traits: TribeTrait[];
  /** What this tribe wants from the settlement. */
  desires: TribeDesire[];
  /** What this tribe can offer in exchange. */
  offerings: TribeOffering[];
  /**
   * Internal stability (0.0–1.0) at game start.
   * Low stability makes the tribe more prone to raiding or desperate bargains.
   */
  stability: number;
  /**
   * Resources this tribe actively wants to buy in trades.
   * Drives +10% pricing bonus for these resources in the TradeView.
   */
  tradeDesires: ResourceType[];
  /**
   * Resources this tribe has available to sell in trades.
   * Only these can be placed as "requested" items in the TradeView.
   */
  tradeOfferings: ResourceType[];
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Creates a live ExternalTribe from a TribeConfig preset.
 *
 * The tribe's runtime `disposition` is initialised from `config.startingDisposition`.
 * All other fields are copied verbatim from the config.
 *
 * @param config - The preset configuration to instantiate.
 * @returns A ready-to-use ExternalTribe for `GameState.tribes`.
 */
export function createTribe(config: TribeConfig): ExternalTribe {
  return {
    id: config.id,
    name: config.name,
    ethnicGroup: config.ethnicGroup,
    population: config.population,
    disposition: config.startingDisposition,
    traits: [...config.traits],
    desires: [...config.desires],
    offerings: [...config.offerings],
    stability: config.stability,
    contactEstablished: false,
    sighted: false,
    giftedTurns: null,
    lastTradeTurn: null,
    tradeHistoryCount: 0,
    tradeDesires: [...config.tradeDesires],
    tradeOfferings: [...config.tradeOfferings],
    diplomacyOpened: false,
    territoryQ: null,
    territoryR: null,
  };
}

// ─── Disposition Update ──────────────────────────────────────────────────────

/**
 * Updates a tribe's disposition for the current turn.
 *
 * Stub implementation: disposition decays toward 0 by 1 per turn.
 * Future: will respond to trade, raids, marriages, and world events.
 *
 * @param tribe - The tribe whose disposition to update.
 * @param _playerActions - Reserved for future player-action modifiers.
 * @param _rng - Reserved for future random event modifiers.
 * @returns The new disposition value (does not mutate the tribe object).
 */
export function updateTribeDisposition(
  tribe: ExternalTribe,
  _playerActions: unknown,
  _rng: SeededRNG,
): number {
  if (tribe.disposition > 0) return tribe.disposition - 1;
  if (tribe.disposition < 0) return tribe.disposition + 1;
  return 0;
}

// ─── Tribe Presets ────────────────────────────────────────────────────────────

/**
 * All pre-defined tribe configurations available for selection at game start.
 * At least 2 presets per Sauromatian subgroup (16 total).
 *
 * Player selects 2–4 of these at game start (GameConfig.startingTribes).
 */
export const TRIBE_PRESETS: Record<string, TribeConfig> = {

  // ── Kiswani Riverfolk ────────────────────────────────────────────────────

  njaro_matu_riverfolk: {
    id: 'njaro_matu_riverfolk',
    name: 'Njaro-Matu Riverfolk',
    ethnicGroup: 'kiswani_riverfolk',
    population: 800,
    startingDisposition: 25,
    traits: ['peaceful', 'trader'],
    desires: ['steel', 'medicine'],
    offerings: ['food', 'pearls', 'knowledge'],
    stability: 0.8,
    tradeDesires: ['steel', 'medicine'],
    tradeOfferings: ['food', 'gold'],
  },

  black_water_clan: {
    id: 'black_water_clan',
    name: 'Black Water Clan',
    ethnicGroup: 'kiswani_riverfolk',
    population: 300,
    startingDisposition: -10,
    traits: ['warlike', 'expansionist'],
    desires: ['steel', 'alliance'],
    offerings: ['furs', 'warriors'],
    stability: 0.6,
    tradeDesires: ['steel'],
    tradeOfferings: ['goods'],
  },

  // ── Kiswani Bayuk ────────────────────────────────────────────────────────

  deep_canopy_sisters: {
    id: 'deep_canopy_sisters',
    name: 'Deep Canopy Sisters',
    ethnicGroup: 'kiswani_bayuk',
    population: 150,
    startingDisposition: 0,
    traits: ['isolationist'],
    desires: ['medicine'],
    offerings: ['herbs', 'knowledge'],
    stability: 0.9,
    tradeDesires: ['medicine'],
    tradeOfferings: ['medicine'],
  },

  jade_viper_band: {
    id: 'jade_viper_band',
    name: 'Jade Viper Band',
    ethnicGroup: 'kiswani_bayuk',
    population: 200,
    startingDisposition: -15,
    traits: ['warlike', 'desperate'],
    desires: ['steel', 'men'],
    offerings: ['warriors', 'furs'],
    stability: 0.4,
    tradeDesires: ['steel'],
    tradeOfferings: ['goods'],
  },

  // ── Kiswani Haisla ───────────────────────────────────────────────────────

  storm_coast_sailors: {
    id: 'storm_coast_sailors',
    name: 'Storm Coast Sailors',
    ethnicGroup: 'kiswani_haisla',
    population: 400,
    startingDisposition: 20,
    traits: ['peaceful', 'trader'],
    desires: ['steel', 'lumber'],
    offerings: ['food', 'trade_goods', 'knowledge'],
    stability: 0.75,
    tradeDesires: ['steel', 'lumber'],
    tradeOfferings: ['food', 'goods'],
  },

  black_tide_crew: {
    id: 'black_tide_crew',
    name: 'Black Tide Crew',
    ethnicGroup: 'kiswani_haisla',
    population: 250,
    startingDisposition: -20,
    traits: ['warlike'],
    desires: ['steel', 'gold'],
    offerings: ['trade_goods', 'horses'],
    stability: 0.5,
    tradeDesires: ['steel', 'gold'],
    tradeOfferings: ['goods', 'horses'],
  },

  // ── Hanjoda Stormcaller ──────────────────────────────────────────────────

  candibula_host: {
    id: 'candibula_host',
    name: 'Candibula Host',
    ethnicGroup: 'hanjoda_stormcaller',
    population: 600,
    startingDisposition: 15,
    traits: ['peaceful'],
    desires: ['steel', 'medicine', 'men'],
    offerings: ['horses', 'knowledge', 'wives'],
    stability: 0.85,
    tradeDesires: ['steel', 'medicine'],
    tradeOfferings: ['horses'],
  },

  thunder_veil_band: {
    id: 'thunder_veil_band',
    name: 'Thunder Veil Band',
    ethnicGroup: 'hanjoda_stormcaller',
    population: 200,
    startingDisposition: -5,
    traits: ['isolationist'],
    desires: ['medicine'],
    offerings: ['herbs'],
    stability: 0.7,
    tradeDesires: ['medicine'],
    tradeOfferings: ['medicine'],
  },

  // ── Hanjoda Bloodmoon ────────────────────────────────────────────────────

  red_moon_raiders: {
    id: 'red_moon_raiders',
    name: 'Red Moon Raiders',
    ethnicGroup: 'hanjoda_bloodmoon',
    population: 350,
    startingDisposition: -25,
    traits: ['warlike', 'expansionist'],
    desires: ['steel', 'territory'],
    offerings: ['warriors', 'horses'],
    stability: 0.55,
    tradeDesires: ['steel'],
    tradeOfferings: ['horses'],
  },

  crescent_hunters: {
    id: 'crescent_hunters',
    name: 'Crescent Hunters',
    ethnicGroup: 'hanjoda_bloodmoon',
    population: 200,
    startingDisposition: -10,
    traits: ['warlike'],
    desires: ['steel', 'alliance'],
    offerings: ['furs', 'food'],
    stability: 0.65,
    tradeDesires: ['steel'],
    tradeOfferings: ['goods', 'food'],
  },

  // ── Hanjoda Talon ────────────────────────────────────────────────────────

  cairn_valley_smiths: {
    id: 'cairn_valley_smiths',
    name: 'Cairn Valley Smiths',
    ethnicGroup: 'hanjoda_talon',
    population: 300,
    startingDisposition: 10,
    traits: ['peaceful', 'trader'],
    desires: ['food', 'medicine'],
    offerings: ['steel', 'stone', 'trade_goods'],
    stability: 0.8,
    tradeDesires: ['food', 'medicine'],
    tradeOfferings: ['steel', 'stone', 'goods'],
  },

  grey_stone_watchers: {
    id: 'grey_stone_watchers',
    name: 'Grey Stone Watchers',
    ethnicGroup: 'hanjoda_talon',
    population: 150,
    startingDisposition: -5,
    traits: ['isolationist'],
    desires: ['food'],
    offerings: ['stone', 'knowledge'],
    stability: 0.8,
    tradeDesires: ['food'],
    tradeOfferings: ['stone'],
  },

  // ── Hanjoda Emrasi ───────────────────────────────────────────────────────

  emras_daughters: {
    id: 'emras_daughters',
    name: "Emra's Daughters",
    ethnicGroup: 'hanjoda_emrasi',
    population: 700,
    startingDisposition: 20,
    traits: ['peaceful', 'trader'],
    desires: ['steel', 'medicine', 'lumber'],
    offerings: ['food', 'pearls', 'wives'],
    stability: 0.85,
    tradeDesires: ['steel', 'medicine', 'lumber'],
    tradeOfferings: ['food', 'gold'],
  },

  inland_fisher_clans: {
    id: 'inland_fisher_clans',
    name: 'Inland Fisher Clans',
    ethnicGroup: 'hanjoda_emrasi',
    population: 400,
    startingDisposition: 5,
    traits: ['peaceful'],
    desires: ['steel'],
    offerings: ['food', 'horses'],
    stability: 0.75,
    tradeDesires: ['steel'],
    tradeOfferings: ['food', 'horses'],
  },

  // ── Hanjoda Bloodmoon (additional) ──────────────────────────────────────

  ochre_path_wanderers: {
    id: 'ochre_path_wanderers',
    name: 'Ochre Path Wanderers',
    ethnicGroup: 'hanjoda_bloodmoon',
    population: 280,
    startingDisposition: 5,
    traits: ['peaceful', 'trader'],
    desires: ['medicine', 'trade'],
    offerings: ['horses', 'furs', 'knowledge'],
    stability: 0.7,
    tradeDesires: ['medicine'],
    tradeOfferings: ['horses', 'goods'],
  },

  ironblood_warband: {
    id: 'ironblood_warband',
    name: 'Ironblood Warband',
    ethnicGroup: 'hanjoda_bloodmoon',
    population: 180,
    startingDisposition: -30,
    traits: ['warlike', 'desperate'],
    desires: ['steel', 'food'],
    offerings: ['warriors'],
    stability: 0.35,
    tradeDesires: ['steel', 'food'],
    tradeOfferings: ['goods'],
  },

} as const satisfies Record<string, TribeConfig>;

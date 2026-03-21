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

  // ── Kiswani Riverfolk — colors: Black · Blue · Dark ──────────────────────

  bluetide: {
    id: 'bluetide',
    name: 'Bluetide',
    ethnicGroup: 'kiswani_riverfolk',
    population: 800,
    startingDisposition: 25,
    traits: ['peaceful', 'trader'],
    desires: ['steel', 'medicine'],
    offerings: ['food', 'pearls', 'knowledge'],
    stability: 0.8,
    tradeDesires: ['steel', 'medicine'],
    tradeOfferings: ['food', 'wealth'],
  },

  darkwake: {
    id: 'darkwake',
    name: 'Darkwake',
    ethnicGroup: 'kiswani_riverfolk',
    population: 300,
    startingDisposition: -10,
    traits: ['warlike', 'expansionist'],
    desires: ['steel', 'alliance'],
    offerings: ['furs', 'warriors'],
    stability: 0.6,
    tradeDesires: ['steel'],
    tradeOfferings: ['wealth'],
  },

  // ── Kiswani Bayuk — colors: Green · Jade · Moss ──────────────────────────

  jadehollow: {
    id: 'jadehollow',
    name: 'Jadehollow',
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

  greenthorn: {
    id: 'greenthorn',
    name: 'Greenthorn',
    ethnicGroup: 'kiswani_bayuk',
    population: 200,
    startingDisposition: -15,
    traits: ['warlike', 'desperate'],
    desires: ['steel', 'men'],
    offerings: ['warriors', 'furs'],
    stability: 0.4,
    tradeDesires: ['steel'],
    tradeOfferings: ['wealth'],
  },

  // ── Kiswani Haisla — colors: Grey · Silver · Salt ────────────────────────

  silvercrest: {
    id: 'silvercrest',
    name: 'Silvercrest',
    ethnicGroup: 'kiswani_haisla',
    population: 400,
    startingDisposition: 20,
    traits: ['peaceful', 'trader'],
    desires: ['steel', 'lumber'],
    offerings: ['food', 'trade_goods', 'knowledge'],
    stability: 0.75,
    tradeDesires: ['steel', 'lumber'],
    tradeOfferings: ['food', 'wealth'],
  },

  greysquall: {
    id: 'greysquall',
    name: 'Greysquall',
    ethnicGroup: 'kiswani_haisla',
    population: 250,
    startingDisposition: -20,
    traits: ['warlike'],
    desires: ['steel', 'wealth'],
    offerings: ['trade_goods', 'horses'],
    stability: 0.5,
    tradeDesires: ['steel'],
    tradeOfferings: ['wealth', 'horses'],
  },

  // ── Hanjoda Stormcaller — colors: Ash · White · Pale ─────────────────────

  ashmantle: {
    id: 'ashmantle',
    name: 'Ashmantle',
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

  paleveil: {
    id: 'paleveil',
    name: 'Paleveil',
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

  // ── Hanjoda Bloodmoon — colors: Red · Ochre · Crimson ────────────────────

  redmoon: {
    id: 'redmoon',
    name: 'Redmoon',
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

  ochrescar: {
    id: 'ochrescar',
    name: 'Ochrescar',
    ethnicGroup: 'hanjoda_bloodmoon',
    population: 200,
    startingDisposition: -10,
    traits: ['warlike'],
    desires: ['steel', 'alliance'],
    offerings: ['furs', 'food'],
    stability: 0.65,
    tradeDesires: ['steel'],
    tradeOfferings: ['wealth', 'food'],
  },

  ochredrift: {
    id: 'ochredrift',
    name: 'Ochredrift',
    ethnicGroup: 'hanjoda_bloodmoon',
    population: 280,
    startingDisposition: 5,
    traits: ['peaceful', 'trader'],
    desires: ['medicine', 'trade'],
    offerings: ['horses', 'furs', 'knowledge'],
    stability: 0.7,
    tradeDesires: ['medicine'],
    tradeOfferings: ['horses', 'wealth'],
  },

  crimsonfang: {
    id: 'crimsonfang',
    name: 'Crimsonfang',
    ethnicGroup: 'hanjoda_bloodmoon',
    population: 180,
    startingDisposition: -30,
    traits: ['warlike', 'desperate'],
    desires: ['steel', 'food'],
    offerings: ['warriors'],
    stability: 0.35,
    tradeDesires: ['steel', 'food'],
    tradeOfferings: ['wealth'],
  },

  // ── Hanjoda Talon — colors: Amber · Gold · Gilt ──────────────────────────

  goldhand: {
    id: 'goldhand',
    name: 'Goldhand',
    ethnicGroup: 'hanjoda_talon',
    population: 300,
    startingDisposition: 10,
    traits: ['peaceful', 'trader'],
    desires: ['food', 'medicine'],
    offerings: ['steel', 'stone', 'trade_goods'],
    stability: 0.8,
    tradeDesires: ['food', 'medicine'],
    tradeOfferings: ['steel', 'stone', 'wealth'],
  },

  ambercairn: {
    id: 'ambercairn',
    name: 'Ambercairn',
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

  // ── Hanjoda Emrasi — colors: Bronze · Brown · Copper ─────────────────────

  bronzemouth: {
    id: 'bronzemouth',
    name: 'Bronzemouth',
    ethnicGroup: 'hanjoda_emrasi',
    population: 700,
    startingDisposition: 20,
    traits: ['peaceful', 'trader'],
    desires: ['steel', 'medicine', 'lumber'],
    offerings: ['food', 'pearls', 'wives'],
    stability: 0.85,
    tradeDesires: ['steel', 'medicine', 'lumber'],
    tradeOfferings: ['food', 'wealth'],
  },

  copperhook: {
    id: 'copperhook',
    name: 'Copperhook',
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

} as const satisfies Record<string, TribeConfig>;

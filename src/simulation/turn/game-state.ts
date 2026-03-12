/**
 * Central game state interface and all supporting types.
 *
 * GameState is the single source of truth for everything that persists across
 * turns. It is serialised to localStorage on save and deserialised on load.
 *
 * Import order (acyclic):
 *   genetics/traits → personality/traits → events/engine
 *   genetics/traits → population/person → turn/game-state  ← you are here
 */

import type { Person, Heritage, EthnicGroup, ReligionId, LanguageId } from '../population/person';
import type { GameEvent, SkillCheckResult, DeferredEventEntry } from '../events/engine';

// Re-export shared identity types so consumers only need one import path.
export type { EthnicGroup, ReligionId, LanguageId, CultureId } from '../population/person';
export type { SkillCheckResult, DeferredEventEntry } from '../events/engine';

// ─── Economy ───────────────────────────────────────────────────────────────────

/**
 * The resource types tracked by the settlement economy.
 * Food, cattle, and goods are the primary early-game resources; the rest unlock
 * as the settlement grows and trade relationships develop.
 *
 * cattle  — herd animals; produce a food bonus each season (1 food per 2 cattle)
 * goods   — an abstraction of manufactured and acquired trade goods
 * horses  — mounts and draft animals; distinct from cattle (acquired, not farmed)
 */
export type ResourceType =
  | 'food'
  | 'cattle'
  | 'goods'
  | 'steel'
  | 'lumber'
  | 'stone'
  | 'medicine'
  | 'gold'
  | 'horses';

/** A complete snapshot of the settlement's current resource stockpile. */
export type ResourceStock = Record<ResourceType, number>;

// ─── Company Relation ────────────────────────────────────────────────────────

/** The Ansberry Company's current level of support for the settlement. */
export type CompanySupportLevel =
  | 'full_support'  // Consistent quota surplus — bonuses and priority supply
  | 'standard'      // Default operating relationship
  | 'reduced'       // One missed quota — reduced supply shipments
  | 'minimal'       // Repeated failures — almost no support
  | 'abandoned';    // Settlement written off — no further Company resources

/**
 * All state related to the settlement's relationship with the Ansberry Company.
 * The Company is the player's primary external patron and demand source.
 */
export interface CompanyRelation {
  /**
   * Overall standing score (0–100). Starts at 60.
   * Above 80: bonuses and preferred supply. Below 40: inspector dispatched.
   * At 0: Company formally abandons the settlement.
   */
  standing: number;
  /** Gold required to meet the current annual quota. Increases over time. */
  annualQuotaGold: number;
  /** Trade goods required to meet the current annual quota. Increases over time. */
  annualQuotaTradeGoods: number;
  /**
   * Number of consecutive annual quotas missed. Resets to 0 on a successful year.
   * Drive the Company's escalating consequences.
   */
  consecutiveFailures: number;
  /** Current support tier, determined by standing and failure history. */
  supportLevel: CompanySupportLevel;
  /** How many in-game years the Company expedition has been active in the region. */
  yearsActive: number;
}

// ─── External Tribes ──────────────────────────────────────────────────────────

/** Behavioural trait of a neighbouring tribe, influencing its AI decision-making. */
export type TribeTrait =
  | 'warlike'
  | 'peaceful'
  | 'isolationist'
  | 'trader'
  | 'expansionist'
  | 'desperate';

/** Resources or concessions a tribe wants from the player settlement. */
export type TribeDesire = 'steel' | 'medicine' | 'alliance' | 'men' | 'territory' | 'trade' | 'food' | 'gold' | 'lumber';

/** Resources or concessions a tribe can offer in trade or alliance. */
export type TribeOffering =
  | 'food'
  | 'horses'
  | 'furs'
  | 'herbs'
  | 'warriors'
  | 'wives'
  | 'knowledge'
  | 'pearls'
  | 'trade_goods'
  | 'stone'
  | 'steel';

/**
 * A neighbouring Sauromatian tribe that exists in the region.
 * Tribes act autonomously — they raid, trade, migrate, and respond to world events.
 */
export interface ExternalTribe {
  /** Unique identifier. */
  id: string;
  /** Display name. */
  name: string;
  /** The ethnic subgroup this tribe belongs to. */
  ethnicGroup: EthnicGroup;
  /** Approximate population size. */
  population: number;
  /**
   * Current disposition toward the player settlement: -100 (hostile) to +100 (allied).
   * Starts near 0 and shifts based on player actions and random world events.
   */
  disposition: number;
  /** Behavioural traits that influence the tribe's AI logic. */
  traits: TribeTrait[];
  /** What this tribe wants from the settlement (drives trade and diplomacy events). */
  desires: TribeDesire[];
  /** What this tribe can offer in exchange. */
  offerings: TribeOffering[];
  /**
   * Internal stability (0.0–1.0). Low stability makes the tribe more prone to
   * raiding, fragmentation, or accepting desperate bargains.
   */
  stability: number;
}

// ─── Settlement Culture ────────────────────────────────────────────────────────

/** The governance style currently shaping the settlement's social structure. */
export type GovernanceStyle =
  | 'patriarchal_imanian'
  | 'council_hybrid'
  | 'matriarchal_sauromatian';

/**
 * Active cultural practices in the settlement.
 * Each practice has social and mechanical effects; some are mutually exclusive.
 */
export type CulturalPracticeId =
  | 'imanian_liturgy'
  | 'sauromatian_wheel'
  | 'syncretic_worship'
  | 'essence_sharing'
  | 'bathhouse_culture'
  | 'company_law'
  | 'tribal_justice'
  | 'warrior_training'
  | 'chivalric_code'
  | 'matriarchal_households'
  | 'patriarchal_households';

/**
 * The settlement's overall cultural character.
 * An emergent property recalculated each turn from population composition,
 * language use, religious practice, and governance style.
 */
export interface SettlementCulture {
  /**
   * Fraction of the population that speaks each language.
   * Values sum to approximately 1.0.
   */
  languages: Map<LanguageId, number>;
  /** The language spoken by the largest fraction of the population. */
  primaryLanguage: LanguageId;
  /**
   * Fraction of the population practising each religion.
   * Values sum to approximately 1.0.
   */
  religions: Map<ReligionId, number>;
  /**
   * Religious tension (0.0–1.0).
   * High tension generates conflict events and can trigger crises.
   */
  religiousTension: number;
  /**
   * Cultural blend: 0.0 = fully Imanian Ansberite, 1.0 = fully Sauromatian.
   * Shifts over time as the population's bloodline and practices change.
   */
  culturalBlend: number;
  /** Cultural practices currently active in the settlement. */
  practices: CulturalPracticeId[];
  /** The governance model currently in effect. */
  governance: GovernanceStyle;
  /**
   * Number of consecutive turns where ≥ 2 languages each exceed 10% of the
   * speaking population. Used to trigger creole emergence after ~5 years.
   */
  languageDiversityTurns: number;
  /**
   * Linguistic tension (0.0–1.0).
   * Peaks near 1.0 when two languages split the settlement ~50/50.
   * Contributes to cultural friction and gates language-conflict events.
   */
  languageTension: number;
}

// ─── Settlement ───────────────────────────────────────────────────────────────

/**
 * A location identifier for the settlement on the regional map.
 * Will expand to a richer structured type when the map system is built in Phase 3.
 */
export type LocationId = string;

/**
 * Identifier for a building type that can be constructed in the settlement.
 * Will expand with the full building system in Phase 4.
 */
export type BuildingId = string;

/** The physical settlement: its location, constructions, and resource stockpile. */
export interface Settlement {
  /** Player-chosen display name of the settlement. */
  name: string;
  /** Where the settlement is established on the regional map. */
  location: LocationId;
  /** List of building IDs currently constructed. */
  buildings: BuildingId[];
  /** Current resource stockpile. Updated each turn by the economy system. */
  resources: ResourceStock;
  /**
   * Cached count of living people. Updated each Dawn Phase.
   * Use this for display performance rather than `state.people.size`.
   */
  populationCount: number;
}

// ─── Turn & Season ────────────────────────────────────────────────────────────

/** The four seasons that make up one in-game year. */
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

/**
 * The current phase within a single turn.
 * Used by the Zustand store to gate which player actions are available.
 */
export type TurnPhase = 'dawn' | 'event' | 'management' | 'dusk' | 'idle';

// ─── Historical Records ────────────────────────────────────────────────────────

/**
 * A lightweight record of a deceased person kept for genealogy queries.
 * Omits runtime state (health, relationships, active pregnancy) but preserves
 * ancestry and family links.
 */
export interface GraveyardEntry {
  id: string;
  firstName: string;
  familyName: string;
  /** Biological sex — preserved for genealogy display. */
  sex: 'male' | 'female';
  birthYear: number;
  deathYear: number;
  /** Human-readable cause of death (e.g., 'old_age', 'raid', 'illness'). */
  deathCause: string;
  /** [motherId, fatherId] — null if unknown. */
  parentIds: [string | null, string | null];
  childrenIds: string[];
  /** Preserved heritage for bloodline and genealogy queries. */
  heritage: Heritage;
}

/**
 * A record of an event that has fired, stored for history, analytics, and
 * event-chain logic (e.g., detecting if an event already fired this game).
 */
export interface EventRecord {
  /** The ID of the event that fired. */
  eventId: string;
  /** The turn number on which the event fired. */
  turnNumber: number;
  /** The ID of the choice the player selected. */
  choiceId: string;
  /** IDs of all people involved as actors or affected targets. */
  involvedPersonIds: string[];
  /** Populated when the choice included a skill check. Used by the outcome screen. */
  skillCheckResult?: SkillCheckResult;
}

// ─── Game Configuration ───────────────────────────────────────────────────────

/**
 * Immutable configuration set at game start.
 * Persisted in GameState so saves can be inspected without re-running setup.
 */
export interface GameConfig {
  /** Affects Company quota ramp-up speed and inspector aggressiveness. */
  difficulty: 'easy' | 'normal' | 'hard';
  /**
   * IDs of tribe definitions selected at game start.
   * These tribes are placed in the region and provided with starting state.
   */
  startingTribes: string[];
  /** Which location on the regional map the settlement is founded on. */
  startingLocation: LocationId;
  /**
   * When true, three founding Sauromatian women (ages 18, 22, 26) are added to
   * the initial settlers. This enables mixed-marriage and genetics testing from
   * turn one. The women's ethnic group is derived from the first selected tribe;
   * falls back to kiswani_riverfolk if no tribes are selected.
   */
  includeSauromatianWomen?: boolean;
}

// ─── Master Game State ────────────────────────────────────────────────────────

/**
 * The complete, serialisable state of a running game session.
 * Everything needed to reconstruct the game from a save file lives here.
 *
 * Map fields are serialised as `[key, value][]` arrays when saving to JSON
 * (localStorage), then reconstructed from those arrays on load.
 */
export interface GameState {
  /**
   * Schema version string (e.g., '1.0.0').
   * Compared on load to detect save files that need migration.
   */
  version: string;
  /** Master RNG seed. All seeded random decisions derive from this. */
  seed: number;
  /** Current turn number. Increments each time endTurn() completes. */
  turnNumber: number;
  /** The season for the current turn. */
  currentSeason: Season;
  /** The in-game year (starts at 1). */
  currentYear: number;

  /** All living people in the settlement, keyed by their ID. */
  people: Map<string, Person>;
  /** Deceased people, stored lightly for genealogy. */
  graveyard: GraveyardEntry[];

  /** The physical settlement state. */
  settlement: Settlement;
  /** Current cultural character of the settlement. */
  culture: SettlementCulture;

  /** All external tribes in the region, keyed by their ID. */
  tribes: Map<string, ExternalTribe>;
  /** Current Company relationship state. */
  company: CompanyRelation;

  /** Ordered history of all events that have fired. */
  eventHistory: EventRecord[];
  /**
   * Turn number of the last time each event fired, keyed by event ID.
   * Used to enforce event cooldown periods.
   */
  eventCooldowns: Map<string, number>;

  /**
   * Events queued for player resolution in the current Event Phase.
   * Populated by the turn processor; cleared when all choices are resolved.
   */
  pendingEvents: GameEvent[];

  /**
   * IDs of people currently seated on the Expedition Council, in seat order.
   * Capped at 7. Players assign and remove members via the Settlers view.
   */
  councilMemberIds: string[];

  /**
   * Events scheduled to fire at a future turn as the resolution of an earlier
   * player choice. Checked every dawn and prepended to pendingEvents when due.
   * Plain array — JSON-safe, no Map serialisation needed.
   */
  deferredEvents: DeferredEventEntry[];

  /** Immutable configuration from game start. */
  config: GameConfig;
}

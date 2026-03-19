/**
 * Turn processor — the master turn loop for the Palusteria simulation.
 *
 * All functions here are **pure**: they receive state and return new values
 * without mutating their inputs. The Zustand store owns all state mutations.
 *
 * Phase 2 scope: age people, processPregnancies (births + naming), natural death,
 *   child mortality, calculate production/consumption.
 *
 * Turn phases (as defined in architecture §5.3):
 *   DAWN   → age people, resolve pregnancies, health/mortality, production
 *   EVENT  → UI presents events for player resolution (not handled here)
 *   MGMT   → player makes choices (role assignment, marriage, trade, diplomacy)
 *   DUSK   → seasonal effects, quota check (autumn), tribe updates
 */

import type { GameState, Season, ResourceStock, GraveyardEntry, BuiltBuilding, ConstructionProject, QuotaStatus, Household, BuildingId, ActivityLogEntry, Faction } from './game-state';
import type { Person, WorkRole, NamedRelationshipType } from '../population/person';
import type { SeededRNG } from '../../utils/rng';
import { clamp } from '../../utils/math';
import {
  calculateProduction,
  calculateConsumption,
  addResourceStocks,
} from '../economy/resources';
import { processPregnancies, attemptConception } from '../genetics/fertility';
import { generateName } from '../population/naming';
import type { LanguageId, ReligionId, SkillId } from '../population/person';
import {
  applyLanguageDrift,
  updateSettlementLanguages,
  updateLanguageTension,
  updateLanguageDiversityTurns,
} from '../culture/language-acquisition';
import {
  processCulturalDrift,
  computeCulturalBlend,
  computeReligionDistribution,
  computeReligiousTension,
  computeHiddenWheelDivergence,
  computeCompanyReligiousPressure,
} from '../population/culture';
import { processConstruction } from '../buildings/construction';
import {
  getOvercrowdingRatio,
  getOvercrowdingMortalityModifiers,
  getChildMortalityModifier,
  getLanguageDriftMultiplier,
  getBuildingCulturePull,
  getSkillGrowthBonuses,
  hasBuilding,
  getBuildingFertilityBonus,
} from '../buildings/building-effects';
import { calculateSpoilage } from '../economy/spoilage';
import {
  computeYearlyQuota,
  checkQuotaStatus,
  getQuotaEventId,
  applyQuotaResult,
  computeAnnualDelivery,
} from '../economy/company';
import { distributeHouseholdWages, processPrivateBuilding, replaceDeadHouseholdBuilders } from '../economy/private-economy';
import type { WageResult } from '../economy/private-economy';
import { applyOpinionDrift, applyCourtshipOpinionDrift, applySharedRoleOpinionDrift, decayOpinions, decayOpinionModifiers, initializeBaselineOpinions, initializeFamilyOpinions, adjustOpinion } from '../population/opinions';
import { processNamedRelationships } from '../population/named-relationships';
import { canMarry, performMarriage } from '../population/marriage';
import { processSchemes } from '../personality/scheme-engine';
import {
  tickAmbitionIntensity,
  evaluateAmbition,
  generateAmbition,
  clearAmbition,
  getAmbitionLabel,
  determineAmbitionType,
  AMBITION_FIRING_THRESHOLD,
} from '../population/ambitions';
import { processIdentityPressure } from '../culture/identity-pressure';
import type { IdentityPressureResult } from '../culture/identity-pressure';
import { processFactions, applyFactionOpinionDrift } from '../world/factions';
import type { FactionProcessResult } from '../world/factions';
import { computeTraitCategoryBoosts, applyTraitOpinionEffects, getTraitSkillGrowthBonuses } from '../personality/trait-behavior';
import { computeCouncilEventBoosts } from '../events/council-advice';
import { applyTemporaryTraitExpiry, checkEarnedTraitAcquisition } from '../personality/assignment';
import { applyHappinessTracking } from '../population/happiness';
import { processApprenticeships } from '../population/apprenticeship';
import type { ApprenticeshipLogEntry } from '../population/apprenticeship';
import type { EventCategory } from '../events/engine';
import {
  assignChildToHousehold,
  pruneOrphanedHouseholds,
  processHouseholdSuccession,
} from '../population/household';
import type { HouseholdSuccessionResult } from '../population/household';

// ─── Result Types ─────────────────────────────────────────────────────────────

/**
 * A lightweight record of a birth that occurred this dawn, returned for UI
 * notification and event-history logging.
 */
export interface BirthNotification {
  /** ID of the newly born person (already present in DawnResult.updatedPeople). */
  childId: string;
  childFirstName: string;
  childFamilyName: string;
  /** ID of the mother. */
  motherId: string;
  /** Whether the mother survived childbirth. */
  motherSurvived: boolean;
}

/** Data returned by processDawn(). The store merges these into GameState. */
export interface DawnResult {
  /**
   * Cloned people Map with all Dawn operations applied:
   *   - Ages incremented by 0.25
   *   - Newborns added (with names)
   *   - Deceased people removed
   *   - Language drift applied to all survivors
   */
  updatedPeople: Map<string, Person>;
  /** Resource production delta for the season (positive values). */
  production: ResourceStock;
  /** Resource consumption delta for the season (negative food). */
  consumption: ResourceStock;
  /** Updated living population count (matches updatedPeople.size). */
  populationCount: number;
  /** Birth notifications for UI display and event-history logging. */
  births: BirthNotification[];
  /**
   * Graveyard entries for people who died this dawn.
   * The store appends these to GameState.graveyard.
   */
  newGraveyardEntries: GraveyardEntry[];
  /** Updated language fraction map for the settlement (recalculated this turn). */
  updatedLanguageFractions: Map<LanguageId, number>;
  /** Updated linguistic tension value (0.0–1.0) for this turn. */
  newLanguageTension: number;
  /** Updated count of consecutive bilingual turns (used for creole emergence). */
  newLanguageDiversityTurns: number;
  /** True if settlement_creole emerged for the first time this turn. */
  creoleEmerged: boolean;
  /**
   * Updated cultural blend value (0.0 = fully Imanian, 1.0 = fully Sauromatian).
   * Computed from the fraction of people whose primaryCulture is Sauromatian.
   */
  updatedCultureBlend: number;
  /**
   * Updated religion distribution for the settlement (fraction per religion).
   * Recalculated each dawn from the surviving population.
   */
  updatedReligions: Map<ReligionId, number>;
  /** Buildings completed this dawn (added to Settlement.buildings by the store). */
  completedBuildings: BuiltBuilding[];
  /** Building IDs removed because a completed building replaced them (upgrade chain). */
  removedBuildingIds: BuildingId[];
  /** Updated construction queue after this season's progress. */
  updatedConstructionQueue: ConstructionProject[];
  /** Overcrowding ratio this dawn (populationCount / shelterCapacity). */
  overcrowdingRatio: number;
  /**
   * Resources lost to spoilage this dawn.
   * Each value is the amount lost (positive number). Zero-valued resources are omitted.
   */
  spoilageThisTurn: Partial<ResourceStock>;
  /** Households updated this dawn (Ashka-Melathi bonds added + lifecycle changes). Empty map if no changes. */
  updatedHouseholds: Map<string, Household>;
  /** New households created this dawn (child births, succession splits). */
  newHouseholds: Map<string, Household>;
  /** IDs of households dissolved this dawn (pruned empty households, succession merges). */
  dissolvedHouseholdIds: string[];
  /** Activity log entries for household succession events (head died, new head named, split-offs). */
  successionLogEntries: ActivityLogEntry[];
  /** Household IDs of Sauromatian successions awaiting a council decision event. */
  pendingSauromatianCouncilEventHouseholdIds: string[];
  /** New Ashka-Melathi bonds formed this dawn: [householdId, personAId, personBId]. */
  newAshkaMelathiBonds: Array<[string, string, string]>;
  /** Updated religious tension (0.0–1.0) recomputed from the new religion distribution. */
  updatedReligiousTension: number;
  /** Updated hidden wheel divergence counter after this dawn's check. */
  updatedHiddenWheelDivergenceTurns: number;
  /** Updated hidden wheel suppressed turns counter after this dawn's check. */
  updatedHiddenWheelSuppressedTurns: number;
  /** When true, the store should inject the rel_hidden_wheel_emerges event into pendingEvents. */
  shouldFireHiddenWheelEvent: boolean;
  /** Result of cultural identity pressure computation for this dawn. */
  identityPressureResult: IdentityPressureResult;
  /** Trait gains and expirations that occurred this dawn. */
  traitChanges: Array<{ personId: string; gained?: string; lost?: string }>;
  /**
   * Per-EventCategory multipliers driven by the settlement's social/personality
   * composition. Passed to drawEvents() as weightBoosts in the store.
   */
  traitCategoryBoosts: Partial<Record<EventCategory, number>>;
  /**
   * Persons whose WorkRole was auto-assigned by idle role-seeking this turn.
   * The store updates roleAssignedTurn for each entry.
   */
  idleRoleAssignments: Array<{ personId: string; role: WorkRole }>;
  /**
   * Activity log entries generated by named-relationship formation/dissolution this turn.
   * Appended to GameState.activityLog by the store.
   */
  newRelationshipEntries: Array<{
    type: 'relationship_formed' | 'relationship_dissolved';
    personId: string;
    targetId: string;
    relationshipType: NamedRelationshipType;
    description: string;
  }>;
  /**
   * Scheme events that should be injected into the pending event queue this turn.
   * Each entry names an event ID plus the schemer and target person IDs so the
   * store can pre-bind actor slots before pushing to pendingEvents.
   */
  pendingSchemeEvents: Array<{ eventId: string; personId: string; targetId: string }>;
  /**
   * Activity log entries generated by scheme generation/resolution this turn.
   */
  newSchemeEntries: Array<{
    type: 'scheme_started' | 'scheme_succeeded' | 'scheme_failed';
    personId: string;
    targetId: string;
    description: string;
  }>;
  /**
   * Updated factions list after membership/strength/demand processing.
   * Replaces GameState.factions in the store.
   */
  updatedFactions: Faction[];
  /**
   * Faction events to inject into the pending queue (e.g. fac_faction_demands).
   */
  pendingFactionEvents: FactionProcessResult['pendingFactionEvents'];
  /**
   * Activity log entries for faction formation/dissolution.
   */
  newFactionEntries: FactionProcessResult['logEntries'];
  /**
   * Activity log entries for ambition formation and resolution.
   */
  newAmbitionEntries: Array<{ type: 'ambition_formed' | 'ambition_cleared'; personId: string; description: string }>;
  /**
   * IDs of persons who were auto-added to the council this dawn because their
   * `seek_council` ambition was at firing threshold and a seat was available.
   * The store appends these to GameState.councilMemberIds.
   */
  autoJoinedCouncilIds: string[];
  /** Activity log entries for autonomous marriages that fired this dawn. */
  newAutonomousMarriageEntries: Array<{ type: 'relationship_formed'; personId: string; description: string }>;
  /** Settlement morale mean (persons aged ≥ 14) computed this dawn. */
  settlementMorale: number;
  /** IDs of persons whose lowHappinessTurns reached ≥ 3 this dawn. */
  desertionCandidateIds: string[];
  /** Per-person happiness production multipliers, keyed by person ID. */
  happinessMultipliers: Map<string, number>;
  /** Updated lowMoraleTurns value to apply to GameState. */
  newLowMoraleTurns: number;
  /**
   * Births that occurred this dawn, exposed for programmatic event injection.
   * Each entry records the child's ID, mother's ID, and optional father's ID.
   * Used by the store to inject rel_child_outside_marriage for unwed Sauromatian mothers.
   */
  newBirths: Array<{ childId: string; motherId: string; fatherId: string | null }>;
  /**
   * Apprenticeship events to inject into the pending queue this turn
   * (formation notifications + graduation celebrations).
   */
  pendingApprenticeshipEvents: Array<{ eventId: string; masterId: string; apprenticeId: string }>;
  /** Activity log entries generated by apprenticeship formation/graduation/end this turn. */
  newApprenticeshipEntries: ApprenticeshipLogEntry[];
  /** New construction projects started autonomously by households this dawn. */
  privateProjects: ConstructionProject[];
  /** Activity log entries from the private build pass. */
  privateBuildLogEntries: ActivityLogEntry[];
  /** Settlement resources after private-build material deductions. */
  updatedResourcesAfterPrivateBuild: ResourceStock;
  /** Wage distribution result for this Spring (null in non-Spring turns). */
  wageResult: WageResult | null;
  /** True when year === 10 and season === 'spring'; triggers the funding-ends notification event. */
  shouldFireFundingEndsEvent: boolean;
}

/** Data returned by processDusk(). The store applies these to GameState. */
export interface DuskResult {
  /** The season that follows the current one. */
  nextSeason: Season;
  /**
   * The in-game year after season advancement.
   * Increments by 1 when winter transitions to spring.
   */
  nextYear: number;
  /**
   * Quota check result for the current year (only set when season is 'autumn').
   * null for all other seasons.
   */
  quotaStatus: QuotaStatus | null;
  /**
   * ID of the Company event that should fire as a result of the quota check.
   * null when no quota event is triggered (grace period, non-autumn, or already abandoned).
   */
  quotaEventId: string | null;
  /**
   * Whether quota contribution fields should be reset (true when transitioning
   * out of Winter — i.e., the window was already closed).
   */
  resetQuotaContributions: boolean;
  /**
   * Company standing delta from religious composition (negative or 0).
   * Non-zero only in Winter when Sacred Wheel fraction exceeds 25%.
   */
  winterReligiousStandingDelta: number;
  /** When true, the store should inject rel_company_concern_letter into pendingEvents. */
  shouldFireCompanyReligionEvent: boolean;
}

// ─── Mortality Helpers ─────────────────────────────────────────────────────────

/**
 * Calculates the probability of a person dying from natural causes this season.
 *
 * Age brackets (per-season probability):
 *   < 60   → 0%
 *   60–69  → (age − 60) × 0.002 per season    (0%–2%)
 *   70–79  → 0.02 + (age − 70) × 0.004        (2%–6%)
 *   80+    → 0.06 + (age − 80) × 0.008        (6%+, uncapped via clamp)
 *
 * Trait modifiers:
 *   'robust'  → × 0.5 (hardier constitution)
 *   'sickly'  → × 2.0 (reduced resilience)
 *
 * @param person - The person to evaluate.
 * @returns Probability of natural death this season (clamped to [0, 0.95]).
 */
function calculateNaturalDeathChance(person: Person): number {
  const age = person.age;
  let chance: number;

  if (age < 60) {
    chance = 0;
  } else if (age < 70) {
    chance = (age - 60) * 0.002;
  } else if (age < 80) {
    chance = 0.02 + (age - 70) * 0.004;
  } else {
    chance = 0.06 + (age - 80) * 0.008;
  }

  if (person.traits.includes('robust')) chance *= 0.5;
  if (person.traits.includes('sickly')) chance *= 2.0;

  return clamp(chance, 0, 0.95);
}

/**
 * Calculates the probability of a child under 5 dying from illness this season.
 *
 * Pre-industrial child mortality is harsh and historically accurate — it creates
 * the demographic pressure the lore describes. This is intentional design.
 *
 * Base probability: 3% per season for children under 5.
 * Medicine stock reduces this (each unit reduces by 0.003, capped at 50% reduction).
 *
 * Trait modifiers:
 *   'sickly' → × 1.5
 *   'robust' → × 0.5
 *
 * @param person - The child to evaluate.
 * @param medicineStock - Current medicine resource in the settlement.
 * @returns Probability of child mortality this season (clamped to [0, 0.30]).
 */
function calculateChildMortalityChance(person: Person, medicineStock: number): number {
  if (person.age >= 5) return 0;

  let chance = 0.03;

  // Medicine reduces risk, capped at 50% reduction
  const medicineReduction = clamp(medicineStock * 0.003, 0, 0.015);
  chance -= medicineReduction;

  if (person.traits.includes('sickly')) chance *= 1.5;
  if (person.traits.includes('robust')) chance *= 0.5;

  return clamp(chance, 0, 0.30);
}

/**
 * Builds a lightweight GraveyardEntry from a Person who has just died.
 *
 * @param person - The deceased person.
 * @param deathYear - The current in-game year.
 * @param cause - Human-readable cause of death.
 * @returns A GraveyardEntry suitable for appending to GameState.graveyard.
 */
function toGraveyardEntry(person: Person, deathYear: number, cause: string): GraveyardEntry {
  // Approximate birth year from age (fractional years → round to nearest year)
  const birthYear = Math.round(deathYear - person.age);
  return {
    id: person.id,
    firstName: person.firstName,
    familyName: person.familyName,
    sex: person.sex,
    birthYear,
    deathYear,
    deathCause: cause,
    parentIds: person.parentIds,
    childrenIds: [...person.childrenIds],
    heritage: person.heritage,
    portraitVariant: person.portraitVariant ?? 1,
    ageAtDeath: Math.floor(person.age),
  };
}

// ─── Dawn Phase ───────────────────────────────────────────────────────────────

/** How often (in turns) baseline opinions and new ambitions are (re-)seeded. */
const OPINION_INIT_INTERVAL = 8;

// ─── Dawn helper: people-update merging ──────────────────────────────────────

/**
 * Merges changed-person entries from `updates` into the working `target` map.
 *
 * Most social sub-systems (opinions, cultural drift, ambitions) return only the
 * entries they modified rather than a full copy of the people map. This helper
 * applies those partial results back to the working map in a single loop.
 */
function mergePeopleUpdates(
  target: Map<string, Person>,
  updates: Map<string, Person>,
): void {
  for (const [id, person] of updates) {
    target.set(id, person);
  }
}

// ─── Dawn helper: demographic phase (births, conception, death) ───────────────

interface DemographicsResult {
  births: BirthNotification[];
  newBirths: Array<{ childId: string; motherId: string; fatherId: string | null }>;
  newGraveyardEntries: GraveyardEntry[];
  updatedHouseholds: Map<string, Household>;
  newHouseholds: Map<string, Household>;
  successionLogEntries: ActivityLogEntry[];
  pendingSauromatianCouncilEvents: string[];
}

/**
 * Resolves births, conception attempts, natural death, and child mortality.
 * Mutates `updatedPeople` in-place (adds newborns, removes the deceased).
 *
 * @returns Births and graveyard entries for notification and history logging.
 */
function processDemographicPhase(
  updatedPeople: Map<string, Person>,
  overcrowdingMortality: ReturnType<typeof getOvercrowdingMortalityModifiers>,
  buildingChildMortalityModifier: number,
  state: GameState,
  rng: SeededRNG,
): DemographicsResult {
  const newGraveyardEntries: GraveyardEntry[] = [];
  const births: BirthNotification[] = [];
  const newBirths: Array<{ childId: string; motherId: string; fatherId: string | null }> = [];
  // Working household map — we accumulate household changes here
  const updatedHouseholds = new Map(state.households);
  const newHouseholds = new Map<string, Household>();
  const successionLogEntries: ActivityLogEntry[] = [];
  const pendingSauromatianCouncilEvents: string[] = [];

  // Resolve due pregnancies.
  const birthResults = processPregnancies(
    updatedPeople,
    state.turnNumber,
    rng,
    state.culture.languageDiversityTurns,
  );

  const stateHouseholds = state.households ?? new Map<string, Household>();

  for (const result of birthResults) {
    const mother = updatedPeople.get(result.motherId);
    if (!mother) continue; // Defensive — should never happen in practice.

    const father = mother.health.pregnancy?.fatherId
      ? updatedPeople.get(mother.health.pregnancy.fatherId)
      : undefined;

    const { firstName, familyName } = generateName(
      result.child.sex,
      result.child.heritage.primaryCulture,
      mother.familyName,
      father?.familyName ?? '',
      rng,
    );

    const namedChild: Person = { ...result.child, firstName, familyName };
    updatedPeople.set(namedChild.id, namedChild);

    // Seed family opinions immediately so the child and their parents/siblings
    // start with meaningful positive regard for each other. Without this, new
    // people enter the world with empty relationship maps and may never reach
    // the opinion threshold needed to form seek_spouse ambitions later.
    const siblings = Array.from(updatedPeople.values()).filter(
      p =>
        p.id !== namedChild.id &&
        (p.motherId === mother.id || (father !== undefined && p.fatherId === father.id)),
    );
    for (const { observerId, targetId: opTarget, delta } of initializeFamilyOpinions(
      namedChild,
      mother,
      father ?? null,
      siblings,
    )) {
      const observer = updatedPeople.get(observerId);
      if (observer) updatedPeople.set(observerId, adjustOpinion(observer, opTarget, delta));
    }

    // Assign child to the appropriate household
    const liveMother = result.motherDied ? mother : (updatedPeople.get(mother.id) ?? mother);
    assignChildToHousehold(
      namedChild,
      liveMother,
      father,
      updatedPeople,
      updatedHouseholds,
      state.turnNumber,
    );
    // Sync newHouseholds: any household added to updatedHouseholds that wasn't
    // in state.households is a newly-created one
    for (const [hhId, hh] of updatedHouseholds) {
      if (!stateHouseholds.has(hhId) && !newHouseholds.has(hhId)) {
        newHouseholds.set(hhId, hh);
      }
    }

    if (result.motherDied) {
      newGraveyardEntries.push(toGraveyardEntry(mother, state.currentYear, 'childbirth'));
      updatedPeople.delete(mother.id);
    } else {
      updatedPeople.set(mother.id, {
        ...mother,
        health: {
          ...mother.health,
          pregnancy: undefined,
          currentHealth: Math.max(0, mother.health.currentHealth + result.motherHealthDelta),
        },
        childrenIds: [...mother.childrenIds, namedChild.id],
      });
    }

    if (father) {
      updatedPeople.set(father.id, {
        ...father,
        childrenIds: [...father.childrenIds, namedChild.id],
      });
    }

    births.push({
      childId: namedChild.id,
      childFirstName: namedChild.firstName,
      childFamilyName: namedChild.familyName,
      motherId: result.motherId,
      motherSurvived: !result.motherDied,
    });
    newBirths.push({
      childId: namedChild.id,
      motherId: result.motherId,
      fatherId: father?.id ?? null,
    });
  }

  // Attempt conception for all married women not already pregnant.
  for (const woman of Array.from(updatedPeople.values())) {
    if (woman.sex !== 'female' || woman.health.pregnancy) continue;
    for (const spouseId of woman.spouseIds) {
      const man = updatedPeople.get(spouseId);
      if (!man || man.sex !== 'male') continue;
      const fertilityBonus = getBuildingFertilityBonus(state.settlement.buildings);
      const pregnancy = attemptConception(woman, man, state.turnNumber, state.currentSeason, rng, fertilityBonus);
      if (pregnancy) {
        updatedPeople.set(woman.id, { ...woman, health: { ...woman.health, pregnancy } });
        break;
      }
    }
  }

  // Natural deaths (age-based, overcrowding multiplier for elderly).
  for (const person of Array.from(updatedPeople.values())) {
    let deathChance = calculateNaturalDeathChance(person);
    if (person.age >= 60) deathChance *= overcrowdingMortality.elderlyDeathMultiplier;
    deathChance = clamp(deathChance, 0, 0.95);
    if (deathChance > 0 && rng.next() < deathChance) {
      newGraveyardEntries.push(toGraveyardEntry(person, state.currentYear, 'old_age'));
      updatedPeople.delete(person.id);
    }
  }

  // Child mortality (under-5, building modifier + overcrowding modifier).
  const medicineStock = state.settlement.resources.medicine;
  for (const person of Array.from(updatedPeople.values())) {
    if (person.age >= 5) continue;
    let deathChance = calculateChildMortalityChance(person, medicineStock);
    deathChance *= buildingChildMortalityModifier;
    deathChance *= overcrowdingMortality.childMortalityMultiplier;
    deathChance = clamp(deathChance, 0, 0.50);
    if (deathChance > 0 && rng.next() < deathChance) {
      newGraveyardEntries.push(toGraveyardEntry(person, state.currentYear, 'childhood_illness'));
      updatedPeople.delete(person.id);
    }
  }

  // Household succession: for every head who died this dawn, run succession logic.
  for (const entry of newGraveyardEntries) {
    // Find which household (if any) this person was head of
    const household = Array.from(updatedHouseholds.values()).find(
      hh => hh.headId === entry.id,
    );
    if (!household) continue;

    const result: HouseholdSuccessionResult = processHouseholdSuccession(
      household.id,
      entry.id,
      updatedHouseholds,
      updatedPeople,
      state.turnNumber,
    );

    // Merge succession results back into working maps
    for (const [id, hh] of result.updatedHouseholds) updatedHouseholds.set(id, hh);
    for (const [id, hh] of result.newHouseholds) {
      updatedHouseholds.set(id, hh);
      newHouseholds.set(id, hh);
    }
    for (const [id, p] of result.updatedPeople) updatedPeople.set(id, p);
    successionLogEntries.push(...result.logEntries);
    if (result.pendingSauromatianCouncilEvent) {
      pendingSauromatianCouncilEvents.push(household.id);
    }
  }

  // Prune orphaned households (safety net for any remaining stale entries)
  const pruneResult = pruneOrphanedHouseholds(updatedHouseholds, updatedPeople);
  for (const [id, hh] of pruneResult.updatedHouseholds) updatedHouseholds.set(id, hh);
  for (const id of pruneResult.dissolvedIds) updatedHouseholds.delete(id);
  for (const [id, p] of pruneResult.updatedPeople) updatedPeople.set(id, p);

  return {
    births,
    newBirths,
    newGraveyardEntries,
    updatedHouseholds,
    newHouseholds,
    successionLogEntries,
    pendingSauromatianCouncilEvents,
  };
}

// ─── Dawn helper: Ashka-Melathi household bond formation ─────────────────────

interface HouseholdBondResult {
  updatedHouseholds: Map<string, Household>;
  newAshkaMelathiBonds: Array<[string, string, string]>;
}

/**
 * Checks all multi-wife households for new Ashka-Melathi bond formation (~15%/season).
 * Mutates `updatedPeople` in-place when bonds are formed (updates ashkaMelathiPartnerIds).
 */
function processHouseholdBonds(
  updatedPeople: Map<string, Person>,
  households: Map<string, Household>,
  rng: SeededRNG,
): HouseholdBondResult {
  const updatedHouseholds = new Map<string, Household>();
  const newAshkaMelathiBonds: Array<[string, string, string]> = [];

  for (const household of households.values()) {
    const wives = household.memberIds
      .map(id => updatedPeople.get(id))
      .filter(
        (p): p is Person =>
          p !== undefined &&
          (p.householdRole === 'senior_wife' || p.householdRole === 'wife'),
      );

    if (wives.length < 2) continue;

    let updatedHousehold = { ...household, ashkaMelathiBonds: [...household.ashkaMelathiBonds] };
    let changed = false;

    for (let i = 0; i < wives.length; i++) {
      for (let j = i + 1; j < wives.length; j++) {
        const wA = wives[i]!;
        const wB = wives[j]!;
        const alreadyBonded = updatedHousehold.ashkaMelathiBonds.some(
          ([a, b]) => (a === wA.id && b === wB.id) || (a === wB.id && b === wA.id),
        );
        if (alreadyBonded) continue;
        // ~15% per season chance for co-wives to form an Ashka-Melathi bond.
        if (rng.next() < 0.15) {
          updatedHousehold.ashkaMelathiBonds.push([wA.id, wB.id]);
          newAshkaMelathiBonds.push([household.id, wA.id, wB.id]);
          changed = true;
          const pA = updatedPeople.get(wA.id);
          const pB = updatedPeople.get(wB.id);
          if (pA && !pA.ashkaMelathiPartnerIds.includes(wB.id)) {
            updatedPeople.set(wA.id, {
              ...pA,
              ashkaMelathiPartnerIds: [...pA.ashkaMelathiPartnerIds, wB.id],
            });
          }
          if (pB && !pB.ashkaMelathiPartnerIds.includes(wA.id)) {
            updatedPeople.set(wB.id, {
              ...pB,
              ashkaMelathiPartnerIds: [...pB.ashkaMelathiPartnerIds, wA.id],
            });
          }
        }
      }
    }

    if (changed) updatedHouseholds.set(household.id, updatedHousehold);
  }

  return { updatedHouseholds, newAshkaMelathiBonds };
}

// ─── Dawn helper: opinion social systems ─────────────────────────────────────

/**
 * Applies per-turn opinion drift, decay, modifier decay, and (every 8 turns)
 * baseline re-seeding for any new settler pairs.
 * Also applies faction solidarity/repulsion drift based on the current faction list.
 * Mutates `updatedPeople` in-place.
 */
function processOpinionSystems(
  updatedPeople: Map<string, Person>,
  turnNumber: number,
  courtshipNorms: 'traditional' | 'mixed' | 'open' = 'mixed',
  factions: import('../turn/game-state').Faction[] = [],
): void {
  mergePeopleUpdates(updatedPeople, applyOpinionDrift(updatedPeople));
  mergePeopleUpdates(updatedPeople, applyCourtshipOpinionDrift(updatedPeople, courtshipNorms, turnNumber));
  mergePeopleUpdates(updatedPeople, applySharedRoleOpinionDrift(updatedPeople));
  mergePeopleUpdates(updatedPeople, applyFactionOpinionDrift(factions, updatedPeople));
  mergePeopleUpdates(updatedPeople, decayOpinions(updatedPeople));
  mergePeopleUpdates(updatedPeople, decayOpinionModifiers(updatedPeople));
  if (turnNumber % OPINION_INIT_INTERVAL === 0) {
    mergePeopleUpdates(updatedPeople, initializeBaselineOpinions(updatedPeople));
  }
}

// ─── Dawn helper: ambition systems ───────────────────────────────────────────

/**
 * Ticks ambition intensity, evaluates fulfillment, and (every 8 turns) generates
 * new ambitions for eligible settlers without one.
 * Mutates `updatedPeople` in-place. Returns activity log entries.
 */
function processAmbitionSystems(
  updatedPeople: Map<string, Person>,
  state: GameState,
  rng: SeededRNG,
  turnNumber: number,
): { entries: Array<{ type: 'ambition_formed' | 'ambition_cleared'; personId: string; description: string }>; autoJoinedCouncilIds: string[] } {
  const entries: Array<{ type: 'ambition_formed' | 'ambition_cleared'; personId: string; description: string }> = [];
  const autoJoinedCouncilIds: string[] = [];
  // Tracks effective council size as people are auto-joined this same dawn pass.
  let currentCouncilSize = state.councilMemberIds.length;

  for (const [id, person] of updatedPeople) {
    let p = tickAmbitionIntensity(person);

    if (p.ambition) {
      // Auto-fulfill seek_council when a seat is available and ambition is mature.
      if (
        p.ambition.type === 'seek_council' &&
        !state.councilMemberIds.includes(id) &&
        !autoJoinedCouncilIds.includes(id) &&
        currentCouncilSize < 7 &&
        p.ambition.intensity >= AMBITION_FIRING_THRESHOLD
      ) {
        autoJoinedCouncilIds.push(id);
        currentCouncilSize++;
        entries.push({
          type: 'ambition_cleared',
          personId: id,
          description: `**${p.firstName}** joined the council — their ambition to earn a seat has been fulfilled.`,
        });
        p = clearAmbition(p);
        if (p !== person) updatedPeople.set(id, p);
        continue;
      }

      const outcome = evaluateAmbition(p, { ...state, people: updatedPeople });
      if (outcome !== 'ongoing') {
        // For target-based relationship ambitions that failed because the target
        // is no longer available, try to retarget immediately rather than
        // abandoning — this preserves accumulated intensity and avoids the
        // up-to-8-turn gap before a new ambition would be generated.
        let retargeted = false;
        if (
          outcome === 'failed' &&
          (p.ambition.type === 'seek_spouse' || p.ambition.type === 'seek_companion')
        ) {
          // Temporarily clear so determineAmbitionType bypasses the ambition guard
          const pNoAmbition = clearAmbition(p);
          const result = determineAmbitionType(pNoAmbition, { ...state, people: updatedPeople }, rng);
          if (result && result.type === p.ambition.type) {
            // New target of same type found — keep intensity + formedTurn, just swap target
            p = { ...p, ambition: { ...p.ambition, targetPersonId: result.targetPersonId } };
            retargeted = true;
          }
        }

        if (!retargeted) {
          entries.push({
            type: 'ambition_cleared',
            personId: id,
            description: `**${p.firstName}**'s ambition (${getAmbitionLabel(p.ambition)}) was ${outcome === 'fulfilled' ? 'fulfilled' : 'abandoned'}.`,
          });
          p = clearAmbition(p);
        }
      }
    }

    if (!p.ambition && turnNumber % OPINION_INIT_INTERVAL === 0) {
      const newAmbition = generateAmbition(p, { ...state, people: updatedPeople }, rng);
      if (newAmbition) {
        p = { ...p, ambition: newAmbition };
        entries.push({
          type: 'ambition_formed',
          personId: id,
          description: `**${p.firstName}** has a new ambition: ${getAmbitionLabel(newAmbition)}.`,
        });
      }
    }

    if (p !== person) updatedPeople.set(id, p);
  }

  return { entries, autoJoinedCouncilIds };
}

// ─── Idle Role-Seeking ────────────────────────────────────────────────────────

// ─── Dawn helper: autonomous marriage execution ───────────────────────────────

/**
 * Executes marriages autonomously for persons whose `seek_spouse` ambition has
 * reached max intensity (≥ 1.0) and whose target is still available.
 *
 * This ensures people actually get married even if the player never resolves a
 * `rel_mutual_attraction` event — the event path remains the early/preferred
 * path, but this function is the guaranteed fallback after ~18 turns of trying.
 *
 * Mutates `updatedPeople` and `updatedHouseholds` in-place.
 * Returns activity log entries for each marriage that fires.
 */
function resolveAutonomousMarriages(
  updatedPeople: Map<string, Person>,
  updatedHouseholds: Map<string, Household>,
  state: GameState,
): Array<{ type: 'relationship_formed'; personId: string; description: string }> {
  const entries: Array<{ type: 'relationship_formed'; personId: string; description: string }> = [];

  // Collect candidates: persons with seek_spouse ambition at max intensity
  const candidates = Array.from(updatedPeople.values()).filter(
    p =>
      p.ambition?.type === 'seek_spouse' &&
      p.ambition.intensity >= 1.0 &&
      p.ambition.targetPersonId !== null &&
      p.spouseIds.length === 0,
  );

  // Track who has already been married this tick to avoid double-processing
  const marriedThisTick = new Set<string>();

  for (const person of candidates) {
    if (marriedThisTick.has(person.id)) continue;

    const targetId = person.ambition!.targetPersonId!;
    const target = updatedPeople.get(targetId);
    if (!target) continue;
    if (marriedThisTick.has(targetId)) continue;

    // Build a minimal GameState view with up-to-date people + households
    const liveState: GameState = { ...state, people: updatedPeople, households: updatedHouseholds };
    const check = canMarry(person, target, liveState);
    if (!check.allowed) continue;

    const result = performMarriage(person, target, liveState);

    // Apply person updates
    updatedPeople.set(result.updatedPersonA.id, result.updatedPersonA);
    updatedPeople.set(result.updatedPersonB.id, result.updatedPersonB);

    // Apply opinion ripple effects
    for (const { observerId, targetId: opTarget, delta } of result.opinionChanges) {
      const observer = updatedPeople.get(observerId);
      if (!observer) continue;
      const current = observer.relationships.get(opTarget) ?? 0;
      updatedPeople.set(observerId, {
        ...observer,
        relationships: new Map(observer.relationships).set(opTarget, current + delta),
      });
    }

    // Apply household changes
    updatedHouseholds.set(result.household.id, result.household);
    if (result.dissolvedHouseholdId) {
      updatedHouseholds.delete(result.dissolvedHouseholdId);
    }

    marriedThisTick.add(person.id);
    marriedThisTick.add(target.id);

    const man   = result.updatedPersonA.sex === 'male' ? result.updatedPersonA : result.updatedPersonB;
    const woman = result.updatedPersonA.sex === 'female' ? result.updatedPersonA : result.updatedPersonB;
    entries.push({
      type: 'relationship_formed',
      personId: man.id,
      description: `**${man.firstName}** and **${woman.firstName}** married (autonomous).`,
    });
  }

  return entries;
}

// ─── Household Specialization Helpers ────────────────────────────────────────

/**
 * Maps household-owned production-building defIds to the WorkRole they imply.
 * Used by inferHouseholdSpecialty to read a family's "trade" from its buildings.
 */
const HOUSEHOLD_BUILDING_TO_ROLE: Partial<Record<BuildingId, WorkRole>> = {
  // Agriculture chain
  fields:            'farmer',
  barns_storehouses: 'farmer',
  farmstead:         'farmer',
  grain_silo:        'farmer',
  // Orchard chain (also served by farmers)
  orchard:           'farmer',
  berry_grove:       'farmer',
  beekeeper:         'farmer',
  grand_orchard:     'farmer',
  // Pastoralism chain
  cattle_pen:        'herder',
  meadow:            'herder',
  cattle_ranch:      'herder',
  stock_farm:        'herder',
  stable:            'herder',
  // One-building specialists
  smithy:            'blacksmith',
  tannery:           'tailor',
  brewery:           'brewer',
  mill:              'miller',
};

/**
 * Which skill should be used when assessing a person's aptitude for a given
 * specialization role, so the family-preference gate ("don't force someone who
 * is dramatically better at something else") works correctly.
 */
const ROLE_TO_KEY_SKILL: Partial<Record<WorkRole, SkillId>> = {
  farmer:        'plants',
  gather_food:   'plants',
  herder:        'animals',
  hunter:        'combat',
  guard:         'combat',
  blacksmith:    'custom',
  tailor:        'custom',
  brewer:        'custom',
  miller:        'custom',
  gather_lumber: 'custom',
  gather_stone:  'custom',
  trader:        'bargaining',
  craftsman:     'custom',
};

/**
 * Returns the dominant production role for a household, inferred from:
 *   1. Production buildings the household owns (building slots 1+) — strongest signal.
 *      Used for farmer/herder/specialist families who have already invested in infrastructure.
 *   2. Majority role among adult members — fallback for communal-role families
 *      (hunters, lumberjacks, quarriers) who don't own private buildings for that trade.
 *
 * Returns null when no clear specialty can be determined.
 */
function inferHouseholdSpecialty(
  household: Household,
  people: Map<string, Person>,
  buildings: BuiltBuilding[],
): WorkRole | null {
  // ── Signal 1: owned household production buildings ────────────────────────
  const roleCounts = new Map<WorkRole, number>();
  for (const slotId of household.buildingSlots.slice(1)) { // slot 0 = dwelling
    if (!slotId) continue;
    const b = buildings.find(bl => bl.instanceId === slotId);
    if (!b) continue;
    const role = HOUSEHOLD_BUILDING_TO_ROLE[b.defId as BuildingId];
    if (role) roleCounts.set(role, (roleCounts.get(role) ?? 0) + 1);
  }
  if (roleCounts.size > 0) {
    let best: WorkRole | null = null;
    let bestCount = 0;
    for (const [role, count] of roleCounts) {
      if (count > bestCount) { bestCount = count; best = role; }
    }
    return best;
  }

  // ── Signal 2: majority role among adult members ───────────────────────────
  // Only counted for roles where communal buildings exist (hunters, lumberjacks, quarriers).
  const COUNTABLE: ReadonlySet<WorkRole> = new Set([
    'farmer', 'herder', 'hunter',
    'blacksmith', 'tailor', 'brewer', 'miller',
    'gather_food', 'gather_lumber', 'gather_stone',
    'guard', 'trader', 'craftsman',
  ]);
  const memberRoleCounts = new Map<WorkRole, number>();
  for (const memberId of household.memberIds) {
    const m = people.get(memberId);
    if (!m || m.age < 16) continue;
    if (COUNTABLE.has(m.role)) {
      memberRoleCounts.set(m.role, (memberRoleCounts.get(m.role) ?? 0) + 1);
    }
  }
  let best: WorkRole | null = null;
  let bestCount = 0;
  for (const [role, count] of memberRoleCounts) {
    if (count > bestCount) { bestCount = count; best = role; }
  }
  // Require at least two members sharing the role to avoid noise in small households.
  return bestCount >= 2 ? best : null;
}

/**
 * Auto-assigns roles to persons who have been 'unassigned' for ≥ 4 turns.
 *
 * Family specialization (new): if the person's household has an established trade
 * (inferred from owned production buildings or majority member roles), and the
 * person has at least minimal aptitude for it (skill ≥ 15) and isn't dramatically
 * better suited to another trade (best skill vs family skill ≤ 20 gap), they adopt
 * the family trade regardless of which skill is technically highest.
 *
 * Skill-based fallback (existing, runs when no specialty applies):
 *   plants     → 'farmer' (if 'fields' built) else 'gather_food'
 *   animals    → 'herder'
 *   combat     → 'guard'
 *   bargaining → 'trader' (if 'trading_post' built), else continue
 *   custom     → 'craftsman' (if 'workshop' built) else 'gather_lumber'
 *   fallback   → 'gather_food'
 *
 * Protected roles (never auto-reassigned): builder, away, keth_thara.
 * Thralls are also excluded (no autonomous agency).
 *
 * Returns an array of { personId, role } deltas — only changed persons.
 */
function resolveIdleRoleSeeking(
  people: Map<string, Person>,
  buildings: BuiltBuilding[],
  households: Map<string, Household>,
  currentTurn: number,
): Array<{ personId: string; role: WorkRole }> {
  const hasFields       = hasBuilding(buildings, 'fields');
  const hasTradingPost  = hasBuilding(buildings, 'trading_post');
  const hasWorkshop     = hasBuilding(buildings, 'workshop');

  const results: Array<{ personId: string; role: WorkRole }> = [];

  for (const [id, person] of people) {
    if (person.role !== 'unassigned') continue;
    if (person.age < 8) continue;   // children managed by age-sync step
    if (person.socialStatus === 'thrall') continue;
    if (currentTurn - (person.roleAssignedTurn ?? 0) < 4) continue;

    const s = person.skills;
    const bestSkill = Math.max(s.plants, s.combat, s.bargaining, s.custom, s.animals, s.leadership);

    // ── Family specialization preference (adults only) ────────────────────
    if (person.age >= 16 && person.householdId) {
      const household = households.get(person.householdId);
      if (household) {
        const specialty = inferHouseholdSpecialty(household, people, buildings);
        if (specialty) {
          const keySkill = ROLE_TO_KEY_SKILL[specialty];
          if (keySkill) {
            const specialtySkillVal = s[keySkill];
            // Accept the family trade when:
            //   – person has at least minimal aptitude (not totally unskilled)
            //   – their best skill doesn't exceed the family skill by >20 pts
            //     (if they're a natural scholar/trader in a farmer family, let them diverge)
            if (specialtySkillVal >= 15 && bestSkill - specialtySkillVal <= 20) {
              // Apply building guards — same as skill-based fallback below.
              let familyRole: WorkRole = specialty;
              if (specialty === 'farmer'    && !hasFields)      familyRole = 'gather_food';
              if (specialty === 'trader'    && !hasTradingPost) familyRole = 'gather_food';
              if (specialty === 'craftsman' && !hasWorkshop)    familyRole = 'gather_lumber';
              results.push({ personId: id, role: familyRole });
              continue;
            }
          }
        }
      }
    }

    // ── Skill-based fallback ──────────────────────────────────────────────
    const skills: Array<[SkillId, number]> = [
      ['plants',     s.plants],
      ['combat',     s.combat],
      ['bargaining', s.bargaining],
      ['custom',     s.custom],
      ['animals',    s.animals],
      ['leadership', s.leadership],
    ];
    skills.sort((a, b) => b[1] - a[1]);

    let assignedRole: WorkRole = 'gather_food'; // fallback

    for (const [skillId] of skills) {
      if (skillId === 'plants') {
        assignedRole = hasFields ? 'farmer' : 'gather_food';
        break;
      }
      if (skillId === 'animals') {
        assignedRole = 'herder';
        break;
      }
      if (skillId === 'combat') {
        assignedRole = 'guard';
        break;
      }
      if (skillId === 'bargaining') {
        if (hasTradingPost) { assignedRole = 'trader'; break; }
        continue; // no Trading Post — fall through to next skill
      }
      if (skillId === 'custom') {
        assignedRole = hasWorkshop ? 'craftsman' : 'gather_lumber';
        break;
      }
      // leadership: no direct role mapping — fall through
    }

    results.push({ personId: id, role: assignedRole });
  }

  return results;
}

// ─── processDawn ──────────────────────────────────────────────────────────────

/**
 * Processes the Dawn Phase of a turn.
 *
 * Delegates each major concern to a focused helper; this function is an
 * orchestrator that sequences them and collects their outputs into DawnResult.
 *
 * Sub-system call order:
 *   1.  Age all people by 0.25 years (one season).
 *   2–4. Demographics: births, conception, natural death, child mortality.
 *   4.5  Construction progress; buildings completed; workers freed.
 *   5–6. Production and consumption deltas.
 *   7.   Language drift.
 *   8.   Cultural drift + building culture pull.
 *   8b.  Settlement language metrics recalculated.
 *   8.5  Skill growth bonuses from buildings.
 *   8.75 Ashka-Melathi household bond formation.
 *   8.8  Opinion drift, decay, and baseline re-seeding.
 *   8.9  Ambition tick, evaluation, and generation.
 *   9.   Cultural blend, religion distribution, religious tension, hidden wheel.
 *   9.6  Cultural identity pressure.
 */
/**
 * Core dawn-phase processor. Returns a `DawnResult` describing all population,
 * cultural, economic, and social changes that occurred this turn.
 *
 * Internally, `updatedPeople` is a **mutable working map** built from a shallow
 * clone of `state.people`. Helper functions receive this map and mutate it
 * in-place for performance (births add entries; deaths remove them). The map
 * is finalised into the immutable `DawnResult.updatedPeople` return value.
 * No other part of `state` is mutated.
 */
export function processDawn(state: GameState, rng: SeededRNG): DawnResult {
  // 1. Clone people Map and age each person by one season (0.25 years).
  const updatedPeople = new Map<string, Person>();
  for (const [id, person] of state.people) {
    const aged = { ...person, age: person.age + 0.25 };
    // 1a. Synchronise the child/adult work status with the new age:
    //     - Under 8: force role to 'child' (too young for any assignment).
    //     - Exactly graduated (was 'child', now >= 8): release to 'unassigned'.
    if (aged.age < 8 && aged.role !== 'child') {
      updatedPeople.set(id, { ...aged, role: 'child', roleAssignedTurn: state.turnNumber });
    } else if (aged.role === 'child' && aged.age >= 8) {
      updatedPeople.set(id, { ...aged, role: 'unassigned', roleAssignedTurn: state.turnNumber });
    } else {
      updatedPeople.set(id, aged);
    }
  }

  // Compute overcrowding ratio early — used by mortality steps below.
  const overcrowdingRatio = getOvercrowdingRatio(
    updatedPeople.size,
    state.settlement.buildings ?? [],
  );
  const overcrowdingMortality = getOvercrowdingMortalityModifiers(overcrowdingRatio);

  const buildingChildModifier = getChildMortalityModifier(state.settlement.buildings ?? []);

  // 2–4. Demographics: births, conception, natural death, child mortality.
  const {
    births,
    newBirths,
    newGraveyardEntries,
    updatedHouseholds: demoHouseholds,
    newHouseholds: demoNewHouseholds,
    successionLogEntries,
    pendingSauromatianCouncilEvents: pendingSauromatianCouncilEventHouseholdIds,
  } = processDemographicPhase(
    updatedPeople,
    overcrowdingMortality,
    buildingChildModifier,
    state,
    rng,
  );

  // 4.5. Advance construction projects; complete buildings; free workers.
  const constructionResult = processConstruction(
    state.settlement.constructionQueue ?? [],
    updatedPeople,
    state.turnNumber,
    rng,
  );
  for (const workerId of constructionResult.completedWorkerIds) {
    const w = updatedPeople.get(workerId);
    if (w) {
      // Restore the role the person held before being auto-assigned as builder,
      // or fall back to 'unassigned' for manually-started projects.
      const restoredRole =
        (constructionResult.completedWorkerPrevRoles[workerId] as WorkRole | undefined)
        ?? 'unassigned';
      updatedPeople.set(workerId, { ...w, role: restoredRole });
    }
  }

  // 4.6. For household-owned projects whose builder(s) died this dawn, assign
  //      a replacement from the household so progress can continue.
  const replacementResult = replaceDeadHouseholdBuilders(
    constructionResult.updatedQueue,
    state.settlement.constructionQueue ?? [],
    updatedPeople,
    demoHouseholds,
    state.turnNumber,
  );
  for (const [id, person] of replacementResult.updatedPeople) {
    updatedPeople.set(id, person);
  }
  const finalConstructionQueue = replacementResult.updatedQueue;

  let currentBuildings = [...(state.settlement.buildings ?? [])];
  for (const removedId of constructionResult.removedBuildingIds) {
    currentBuildings = currentBuildings.filter(b => b.defId !== removedId);
  }
  currentBuildings = [...currentBuildings, ...constructionResult.completedBuildings];

  // 5–5.5. Happiness tracking — run before production so multipliers are available.
  const happinessResult = applyHappinessTracking(updatedPeople, {
    ...state,
    people: updatedPeople,
    settlement: { ...state.settlement, buildings: currentBuildings, populationCount: updatedPeople.size },
  });
  // Merge lowHappinessTurns updates into updatedPeople.
  for (const [id, hp] of happinessResult.updatedPeople) {
    updatedPeople.set(id, hp);
  }
  const { settlementMorale, desertionCandidateIds, happinessMultipliers, newLowMoraleTurns } = happinessResult;

  // 5–6. Production and consumption.
  const production = calculateProduction(
    updatedPeople,
    { ...state.settlement, buildings: currentBuildings, constructionQueue: finalConstructionQueue },
    state.currentSeason,
    overcrowdingRatio,
    happinessMultipliers,
  );
  const consumption = calculateConsumption(updatedPeople);

  // 7. Language drift (multiplied by Gathering Hall if present).
  const langDriftMultiplier = getLanguageDriftMultiplier(currentBuildings);
  for (const [id, person] of updatedPeople) {
    updatedPeople.set(id, {
      ...person,
      languages: applyLanguageDrift(person, state.culture.languages, langDriftMultiplier),
    });
  }

  // 8. Cultural drift (community + spouse bonds + building culture pull).
  // Pass pre-computed happiness scores so drift rate is modulated by wellbeing.
  mergePeopleUpdates(
    updatedPeople,
    processCulturalDrift(updatedPeople, rng, getBuildingCulturePull(currentBuildings), happinessResult.happinessScores),
  );

  // 8b. Settlement language metrics.
  const updatedLanguageFractions = updateSettlementLanguages(updatedPeople);
  const newLanguageTension = updateLanguageTension(updatedLanguageFractions);
  const newLanguageDiversityTurns = updateLanguageDiversityTurns(
    updatedLanguageFractions,
    state.culture.languageDiversityTurns,
  );

  // 8.5. Skill growth from buildings.
  for (const [id, person] of updatedPeople) {
    const bonuses = getSkillGrowthBonuses(currentBuildings, person, state.councilMemberIds);
    const traitBonuses = getTraitSkillGrowthBonuses(person);
    const allSkillKeys = new Set<SkillId>([
      ...(Object.keys(bonuses) as SkillId[]),
      ...(Object.keys(traitBonuses) as SkillId[]),
    ]);
    if (allSkillKeys.size > 0) {
      const newSkills = { ...person.skills };
      for (const skill of allSkillKeys) {
        const buildingBonus = bonuses[skill] ?? 0;
        const traitBonus = traitBonuses[skill] ?? 0;
        newSkills[skill] = Math.min(100, Math.max(1, (newSkills[skill] ?? 0) + buildingBonus + traitBonus));
      }
      updatedPeople.set(id, { ...person, skills: newSkills });
    }
  }

  // 8.75. Ashka-Melathi household bond formation.
  // Pass demoHouseholds so bond logic sees post-succession household state.
  const { updatedHouseholds: bondHouseholds, newAshkaMelathiBonds } = processHouseholdBonds(
    updatedPeople,
    demoHouseholds,
    rng,
  );
  // Merge demographic + bond changes into final household map.
  const updatedHouseholds = new Map(demoHouseholds);
  for (const [id, h] of bondHouseholds) updatedHouseholds.set(id, h);
  // Compute dissolved IDs: households present in original state but absent from updated map.
  const dissolvedHouseholdIds = Array.from((state.households ?? new Map<string, Household>()).keys()).filter(
    id => !updatedHouseholds.has(id),
  );

  // 8.8–8.9. Social systems: opinions and ambitions.
  // Pass the previous turn's faction list — factions are recomputed at step 9.6b.
  processOpinionSystems(updatedPeople, state.turnNumber, state.settlement.courtshipNorms ?? 'mixed', state.factions ?? []);
  const ambitionResult = processAmbitionSystems(updatedPeople, state, rng, state.turnNumber);
  const ambitionEntries = ambitionResult.entries;
  const autoJoinedCouncilIds = ambitionResult.autoJoinedCouncilIds;

  // 8.91. Autonomous marriages — persons whose seek_spouse ambition is fully maxed out
  //        marry their target directly, without requiring an event card to fire.
  const autonomousMarriageEntries = resolveAutonomousMarriages(updatedPeople, updatedHouseholds, state);

  // 8.85. Trait-driven opinion drift (jealousy, envy, charm etc.)
  mergePeopleUpdates(updatedPeople, applyTraitOpinionEffects(updatedPeople));

  // 8.92. Named Relationships — formation, depth growth, dissolution, passive effects.
  const namedRelResult = processNamedRelationships(
    updatedPeople,
    state.turnNumber,
    rng,
    state.debugSettings,
  );
  mergePeopleUpdates(updatedPeople, namedRelResult.updatedPeople);

  // 8.93. Scheme Engine — generate new schemes, advance progress, resolve completions.
  const schemeResult = processSchemes(
    updatedPeople,
    state.turnNumber,
    rng,
    state.debugSettings,
    {
      households: state.households as Map<string, { dwellingBuildingId: string | null; productionBuildingIds: string[] }>,
      currentYear: state.currentYear,
      settlementLumber: state.settlement.resources.lumber,
    },
  );
  mergePeopleUpdates(updatedPeople, schemeResult.updatedPeople);

  // 8.94. Apprenticeship — form new pairs, advance progress, graduate completions.
  const apprenticeshipResult = processApprenticeships(updatedPeople, state.turnNumber, rng);
  mergePeopleUpdates(updatedPeople, apprenticeshipResult.updatedPeople);

  // 8.95. Idle role-seeking — unassigned persons auto-select a role after 4 idle turns.
  const idleRoleAssignments = resolveIdleRoleSeeking(
    updatedPeople,
    currentBuildings,
    updatedHouseholds,
    state.turnNumber,
  );
  for (const { personId, role } of idleRoleAssignments) {
    const p = updatedPeople.get(personId);
    if (p) updatedPeople.set(personId, { ...p, role, roleAssignedTurn: state.turnNumber });
  }

  // 8.9. Trait expiry and earned trait acquisition.
  const traitChanges: Array<{ personId: string; gained?: string; lost?: string }> = [];
  const currentBuiltBuildingIds = new Set(currentBuildings.map(b => b.defId));
  const settlementHasBuilding = (id: string) => currentBuiltBuildingIds.has(id as BuildingId);

  // Expiry pass
  mergePeopleUpdates(updatedPeople, applyTemporaryTraitExpiry(updatedPeople, state.turnNumber));

  // Earned-trait acquisition pass (once per 4 turns per person to keep it gradual)
  if (state.turnNumber % 4 === 0) {
    for (const [id, person] of updatedPeople) {
      const result = checkEarnedTraitAcquisition(person, settlementHasBuilding, rng);
      if (result) {
        const expiryTurn = result.expiryTurn;
        const newTraits = [...person.traits, result.traitId];
        const newExpiry = expiryTurn !== undefined
          ? { ...person.traitExpiry, [result.traitId]: expiryTurn }
          : person.traitExpiry;
        updatedPeople.set(id, { ...person, traits: newTraits, traitExpiry: newExpiry });
        traitChanges.push({ personId: id, gained: result.traitId });
      }
    }
  }

  // 9. Cultural blend, religion distribution, tension, and hidden wheel divergence.
  const updatedCultureBlend = computeCulturalBlend(updatedPeople);
  const updatedReligions = computeReligionDistribution(updatedPeople);
  const updatedReligiousTension = computeReligiousTension(updatedReligions);
  const divergenceResult = computeHiddenWheelDivergence(
    state.culture.hiddenWheelDivergenceTurns,
    state.culture.hiddenWheelSuppressedTurns,
    updatedReligions,
    state.settlement.religiousPolicy,
  );

  // 9.6. Cultural identity pressure counters and passive standing/disposition deltas.
  const identityPressureResult = processIdentityPressure(
    updatedCultureBlend,
    state.identityPressure ?? { companyPressureTurns: 0, tribalPressureTurns: 0 },
    state.tribes,
  );

  // 9.6b. Faction processing — formation, membership refresh, strength, demands.
  const factionResult = processFactions(
    { ...state, culture: { ...state.culture, culturalBlend: updatedCultureBlend, religions: updatedReligions } },
    state.turnNumber,
    state.debugSettings,
  );

  const creoleEmerged = newLanguageDiversityTurns >= 20 && state.culture.languageDiversityTurns < 20;

  // 9.7. Trait-driven event deck shaping.
  const traitCategoryBoosts = computeTraitCategoryBoosts(updatedPeople);

  // 9.7b. Council-composition event deck shaping — merged with trait boosts.
  const councilBoosts = computeCouncilEventBoosts(
    state.councilMemberIds,
    updatedPeople,
    factionResult.updatedFactions,
  );
  // Merge council boosts into trait boosts (additive; overall effect is a single map)
  const mergedCategoryBoosts: Partial<Record<EventCategory, number>> = { ...traitCategoryBoosts };
  for (const [cat, boost] of Object.entries(councilBoosts) as [EventCategory, number][]) {
    mergedCategoryBoosts[cat] = (mergedCategoryBoosts[cat] ?? 0) + boost;
  }

  // 9.7.5. Autonomous private building pass — households spend savings on private projects.
  const privateBuildResult = processPrivateBuilding({
    ...state,
    households: updatedHouseholds,
    people: updatedPeople,
    settlement: {
      ...state.settlement,
      buildings: [
        ...state.settlement.buildings,
        ...constructionResult.completedBuildings,
      ],
    },
  });
  // Merge household gold updates from the private build pass.
  for (const [hhId, updatedHh] of privateBuildResult.updatedHouseholds) {
    if (updatedHh !== updatedHouseholds.get(hhId)) {
      updatedHouseholds.set(hhId, updatedHh);
    }
  }
  // Set auto-assigned builders to role 'builder'. Their previous role is stored
  // on the project's autoBuilderPrevRoles and will be restored on completion.
  for (const { personId } of privateBuildResult.autoBuilderAssignments) {
    const p = updatedPeople.get(personId);
    if (p) updatedPeople.set(personId, { ...p, role: 'builder', roleAssignedTurn: state.turnNumber });
  }

  // 9.8. Company spring delivery and household wage distribution.
  let springProduction = production;
  let wageResult: WageResult | null = null;

  if (state.currentSeason === 'spring') {
    // Add company supply delivery to production for this turn.
    const delivery = computeAnnualDelivery(state.company.supportLevel, state.currentYear);
    if (Object.keys(delivery).length > 0) {
      const deliveryAsStock = {
        food: delivery.food ?? 0,
        goods: delivery.goods ?? 0,
        gold: delivery.gold ?? 0,
        medicine: delivery.medicine ?? 0,
        cattle: delivery.cattle ?? 0,
        steel: delivery.steel ?? 0,
        lumber: delivery.lumber ?? 0,
        stone: delivery.stone ?? 0,
        horses: delivery.horses ?? 0,
      };
      springProduction = addResourceStocks(production, deliveryAsStock);
    }

    // Distribute wages to households.
    const wages = distributeHouseholdWages(
      updatedPeople,
      state.currentYear,
      state.settlement.resources.gold,
    );
    if (wages.householdDeltas.size > 0) {
      for (const [hhId, delta] of wages.householdDeltas) {
        const hh = updatedHouseholds.get(hhId);
        if (hh) {
          updatedHouseholds.set(hhId, { ...hh, householdGold: hh.householdGold + delta });
        }
      }
    }
    wageResult = wages;
  }

  // Determine whether to inject the year-10 funding-ends event (fires once, spring of year 10).
  const fundingEndsAlreadyFired = state.eventHistory.some(e => e.eventId === 'eco_company_funding_ends');
  const shouldFireFundingEndsEvent =
    state.currentSeason === 'spring' &&
    state.currentYear === 10 &&
    !fundingEndsAlreadyFired;

  return {
    updatedPeople,
    production: springProduction,
    consumption,
    populationCount: updatedPeople.size,
    births,
    newGraveyardEntries,
    updatedLanguageFractions,
    newLanguageTension,
    newLanguageDiversityTurns,
    creoleEmerged,
    updatedCultureBlend,
    updatedReligions,
    completedBuildings: constructionResult.completedBuildings,
    removedBuildingIds: constructionResult.removedBuildingIds,
    updatedConstructionQueue: finalConstructionQueue,
    overcrowdingRatio,
    spoilageThisTurn: calculateSpoilage(
      state.settlement.resources,
      state.currentSeason,
      currentBuildings,
    ),
    updatedHouseholds,
    newHouseholds: demoNewHouseholds,
    dissolvedHouseholdIds,
    successionLogEntries,
    pendingSauromatianCouncilEventHouseholdIds,
    newAshkaMelathiBonds,
    updatedReligiousTension,
    updatedHiddenWheelDivergenceTurns: divergenceResult.updatedDivergenceTurns,
    updatedHiddenWheelSuppressedTurns: divergenceResult.updatedSuppressedTurns,
    shouldFireHiddenWheelEvent: divergenceResult.shouldFireEvent,
    identityPressureResult,
    traitChanges,
    traitCategoryBoosts: mergedCategoryBoosts,
    idleRoleAssignments,
    newRelationshipEntries: namedRelResult.logEntries,
    pendingSchemeEvents: schemeResult.pendingSchemeEvents,
    newSchemeEntries: schemeResult.logEntries,
    updatedFactions: factionResult.updatedFactions,
    pendingFactionEvents: factionResult.pendingFactionEvents,
    newFactionEntries: factionResult.logEntries,
    newAmbitionEntries: ambitionEntries,
    autoJoinedCouncilIds,
    newAutonomousMarriageEntries: autonomousMarriageEntries,
    settlementMorale,
    desertionCandidateIds,
    happinessMultipliers,
    newLowMoraleTurns,
    newBirths,
    pendingApprenticeshipEvents: apprenticeshipResult.pendingApprenticeshipEvents,
    newApprenticeshipEntries: apprenticeshipResult.logEntries,
    wageResult,
    shouldFireFundingEndsEvent,
    privateProjects: privateBuildResult.newProjects,
    privateBuildLogEntries: privateBuildResult.logEntries,
    updatedResourcesAfterPrivateBuild: privateBuildResult.updatedResources,
  };
}

// ─── Dusk Phase ───────────────────────────────────────────────────────────────

/** The ordered sequence of seasons for cycling. */
const SEASON_CYCLE: Season[] = ['spring', 'summer', 'autumn', 'winter'];

/**
 * Processes the Dusk Phase of a turn.
 *
 * Computes the next season and increments the year when winter transitions
 * to spring. In Phase 1 this is purely calendar advancement; Phase 3 will
 * add seasonal effects, Company quota checks, and tribe updates.
 *
 * @param state - Current game state (not mutated).
 * @param _season - Explicit season parameter (mirrors state.currentSeason — kept
 *   for the function signature the store calls, matching architecture §5.3).
 * @returns A DuskResult with the next season and year.
 */
export function processDusk(state: GameState, _season: Season): DuskResult {
  const currentIndex = SEASON_CYCLE.indexOf(state.currentSeason);
  const nextIndex = (currentIndex + 1) % SEASON_CYCLE.length;
  const nextSeason: Season = SEASON_CYCLE[nextIndex] ?? 'spring';

  // Year advances when rolling over from winter to spring.
  const nextYear = nextSeason === 'spring' ? state.currentYear + 1 : state.currentYear;

  // Autumn: run the annual Company quota check.
  if (state.currentSeason === 'autumn') {
    const quota = computeYearlyQuota(state.currentYear);
    const contribution = {
      gold: state.company.quotaContributedGold,
      goods: state.company.quotaContributedGoods,
    };
    const qStatus = checkQuotaStatus(contribution, quota);
    const updatedCompany = applyQuotaResult(state.company, qStatus);
    const alreadyAbandoned = state.company.supportLevel === 'abandoned';
    const qEventId = getQuotaEventId(updatedCompany.consecutiveFailures, alreadyAbandoned);
    return {
      nextSeason,
      nextYear,
      quotaStatus: qStatus,
      quotaEventId: qEventId,
      resetQuotaContributions: false,
      winterReligiousStandingDelta: 0,
      shouldFireCompanyReligionEvent: false,
    };
  }

  // Winter→Spring transition: reset annual quota contribution window.
  // Also apply once-per-year Company religious pressure from Sacred Wheel fraction.
  if (nextSeason === 'spring') {
    const religiousDelta = computeCompanyReligiousPressure(
      state.culture.religions,
      state.settlement.religiousPolicy,
    );
    return {
      nextSeason,
      nextYear,
      quotaStatus: null,
      quotaEventId: null,
      resetQuotaContributions: true,
      winterReligiousStandingDelta: religiousDelta,
      shouldFireCompanyReligionEvent: religiousDelta < 0,
    };
  }

  return {
    nextSeason,
    nextYear,
    quotaStatus: null,
    quotaEventId: null,
    resetQuotaContributions: false,
    winterReligiousStandingDelta: 0,
    shouldFireCompanyReligionEvent: false,
  };
}

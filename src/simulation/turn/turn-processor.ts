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

import type { GameState, Season, ResourceStock, GraveyardEntry, BuiltBuilding, ConstructionProject, QuotaStatus } from './game-state';
import type { Person } from '../population/person';
import type { SeededRNG } from '../../utils/rng';
import { clamp } from '../../utils/math';
import {
  calculateProduction,
  calculateConsumption,
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
} from '../population/culture';
import { processConstruction } from '../buildings/construction';
import {
  getOvercrowdingRatio,
  getOvercrowdingMortalityModifiers,
  getChildMortalityModifier,
  getLanguageDriftMultiplier,
  getBuildingCulturePull,
  getSkillGrowthBonuses,
} from '../buildings/building-effects';
import { calculateSpoilage } from '../economy/spoilage';
import {
  computeYearlyQuota,
  checkQuotaStatus,
  getQuotaEventId,
  applyQuotaResult,
} from '../economy/company';

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
  removedBuildingIds: import('./game-state').BuildingId[];
  /** Updated construction queue after this season's progress. */
  updatedConstructionQueue: ConstructionProject[];
  /** Overcrowding ratio this dawn (populationCount / shelterCapacity). */
  overcrowdingRatio: number;
  /**
   * Resources lost to spoilage this dawn.
   * Each value is the amount lost (positive number). Zero-valued resources are omitted.
   */
  spoilageThisTurn: Partial<ResourceStock>;
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
  };
}

// ─── Dawn Phase ───────────────────────────────────────────────────────────────

/**
 * Processes the Dawn Phase of a turn.
 *
 * Operations (in order):
 *   1.  Age all people by 0.25 years (one season).
 *   2.  Resolve due pregnancies → births + potential maternal deaths.
 *   2b. Attempt conception for married couples.
 *   3.  Process natural death (age-based probability, modified by traits + overcrowding).
 *   4.  Process child mortality (under-5, reduced by medicine stock, buildings, overcrowding).
 *   4.5 Advance construction projects; complete buildings; free workers.
 *   5.  Calculate resource production (role-based + building bonuses − overcrowding penalty).
 *   6.  Calculate resource consumption.
 *   7.  Apply language drift (multiplied by Gathering Hall if present).
 *   8.  Apply cultural drift (community + spouse + building culture pull).
 *   8b. Recalculate settlement language metrics.
 *   8.5 Apply skill growth bonuses from buildings.
 *   9.  Recalculate cultural blend and religion distribution.
 */
export function processDawn(state: GameState, rng: SeededRNG): DawnResult {
  const newGraveyardEntries: GraveyardEntry[] = [];
  const births: BirthNotification[] = [];

  // 1. Clone people Map and age each person by one season (0.25 years).
  const updatedPeople = new Map<string, Person>();
  for (const [id, person] of state.people) {
    updatedPeople.set(id, { ...person, age: person.age + 0.25 });
  }

  // Compute overcrowding ratio early — used by mortality steps below.
  const overcrowdingRatio = getOvercrowdingRatio(
    updatedPeople.size,
    state.settlement.buildings ?? [],
  );
  const overcrowdingMortality = getOvercrowdingMortalityModifiers(overcrowdingRatio);

  // 2. Resolve due pregnancies.
  const birthResults = processPregnancies(
    updatedPeople,
    state.turnNumber,
    rng,
    state.culture.languageDiversityTurns,
  );

  for (const result of birthResults) {
    const mother = updatedPeople.get(result.motherId);
    if (!mother) continue; // Defensive — should never happen in practice.

    const father = mother.health.pregnancy?.fatherId
      ? updatedPeople.get(mother.health.pregnancy.fatherId)
      : undefined;

    // Generate a culturally appropriate name for the child.
    const { firstName, familyName } = generateName(
      result.child.sex,
      result.child.heritage.primaryCulture,
      mother.familyName,
      father?.familyName ?? '',
      rng,
    );

    const namedChild: Person = { ...result.child, firstName, familyName };

    // Add newborn to map.
    updatedPeople.set(namedChild.id, namedChild);

    // Update mother: clear pregnancy, apply health delta, add child.
    if (result.motherDied) {
      newGraveyardEntries.push(toGraveyardEntry(mother, state.currentYear, 'childbirth'));
      updatedPeople.delete(mother.id);
    } else {
      const updatedMother: Person = {
        ...mother,
        health: {
          ...mother.health,
          pregnancy: undefined,
          currentHealth: Math.max(0, mother.health.currentHealth + result.motherHealthDelta),
        },
        childrenIds: [...mother.childrenIds, namedChild.id],
      };
      updatedPeople.set(mother.id, updatedMother);
    }

    // Update father's childrenIds if he is still alive.
    if (father) {
      const updatedFather: Person = {
        ...father,
        childrenIds: [...father.childrenIds, namedChild.id],
      };
      updatedPeople.set(father.id, updatedFather);
    }

    births.push({
      childId: namedChild.id,
      childFirstName: namedChild.firstName,
      childFamilyName: namedChild.familyName,
      motherId: result.motherId,
      motherSurvived: !result.motherDied,
    });
  }

  // 2b. Attempt conception for all married women who are not already pregnant.
  for (const woman of Array.from(updatedPeople.values())) {
    if (woman.sex !== 'female' || woman.health.pregnancy) continue;

    for (const spouseId of woman.spouseIds) {
      const man = updatedPeople.get(spouseId);
      if (!man || man.sex !== 'male') continue;

      const pregnancy = attemptConception(woman, man, state.turnNumber, state.currentSeason, rng);
      if (pregnancy) {
        updatedPeople.set(woman.id, {
          ...woman,
          health: { ...woman.health, pregnancy },
        });
        break; // one conception attempt per woman per season
      }
    }
  }

  // 3. Process natural deaths (age-based, elderly overcrowding modifier).
  for (const person of Array.from(updatedPeople.values())) {
    let deathChance = calculateNaturalDeathChance(person);
    // Overcrowding worsens chances for the elderly (60+).
    if (person.age >= 60) {
      deathChance *= overcrowdingMortality.elderlyDeathMultiplier;
    }
    deathChance = clamp(deathChance, 0, 0.95);
    if (deathChance > 0 && rng.next() < deathChance) {
      newGraveyardEntries.push(toGraveyardEntry(person, state.currentYear, 'old_age'));
      updatedPeople.delete(person.id);
    }
  }

  // 4. Process child mortality (under-5).
  // Building modifier (Healer's Hut) and overcrowding modifier both apply.
  const medicineStock = state.settlement.resources.medicine;
  const buildingChildModifier = getChildMortalityModifier(state.settlement.buildings ?? []);
  for (const person of Array.from(updatedPeople.values())) {
    if (person.age >= 5) continue;
    let deathChance = calculateChildMortalityChance(person, medicineStock);
    deathChance *= buildingChildModifier;
    deathChance *= overcrowdingMortality.childMortalityMultiplier;
    deathChance = clamp(deathChance, 0, 0.50);
    if (deathChance > 0 && rng.next() < deathChance) {
      newGraveyardEntries.push(toGraveyardEntry(person, state.currentYear, 'childhood_illness'));
      updatedPeople.delete(person.id);
    }
  }

  // 4.5. Advance construction projects.
  const constructionResult = processConstruction(
    state.settlement.constructionQueue ?? [],
    updatedPeople,
    state.turnNumber,
    rng,
  );
  // Reset completed workers to 'unassigned'.
  for (const workerId of constructionResult.completedWorkerIds) {
    const w = updatedPeople.get(workerId);
    if (w) updatedPeople.set(workerId, { ...w, role: 'unassigned' });
  }

  // Updated buildings list (completed buildings added, replaced ones removed).
  let currentBuildings = [...(state.settlement.buildings ?? [])];
  for (const removedId of constructionResult.removedBuildingIds) {
    currentBuildings = currentBuildings.filter(b => b.defId !== removedId);
  }
  currentBuildings = [...currentBuildings, ...constructionResult.completedBuildings];

  // 5 & 6. Calculate production and consumption using updated buildings + overcrowding.
  const updatedSettlementForProduction = {
    ...state.settlement,
    buildings: currentBuildings,
    constructionQueue: constructionResult.updatedQueue,
  };
  const production = calculateProduction(
    updatedPeople,
    updatedSettlementForProduction,
    state.currentSeason,
    overcrowdingRatio,
  );
  const consumption = calculateConsumption(updatedPeople);

  // 7. Apply language drift — each survivor gains incremental fluency in
  //    community languages based on age and the settlement's current distribution.
  //    Gathering Hall multiplies the drift rate.
  const langDriftMultiplier = getLanguageDriftMultiplier(currentBuildings);
  const currentLangFractions = state.culture.languages;
  for (const [id, person] of updatedPeople) {
    const updatedLanguages = applyLanguageDrift(
      person,
      currentLangFractions,
      langDriftMultiplier,
    );
    updatedPeople.set(id, { ...person, languages: updatedLanguages });
  }

  // 8. Apply cultural drift — community pull + spouse bonds + building culture pull.
  const buildingCulturePull = getBuildingCulturePull(currentBuildings);
  const culturallyDrifted = processCulturalDrift(updatedPeople, rng, buildingCulturePull);
  for (const [id, person] of culturallyDrifted) {
    updatedPeople.set(id, person);
  }

  // 8b. Recalculate settlement language distribution from the updated population.
  const updatedLanguageFractions = updateSettlementLanguages(updatedPeople);
  const newLanguageTension = updateLanguageTension(updatedLanguageFractions);
  const newLanguageDiversityTurns = updateLanguageDiversityTurns(
    updatedLanguageFractions,
    state.culture.languageDiversityTurns,
  );

  // 8.5. Apply skill growth bonuses from buildings.
  for (const [id, person] of updatedPeople) {
    const bonuses = getSkillGrowthBonuses(currentBuildings, person, state.councilMemberIds);
    const skillKeys = Object.keys(bonuses) as SkillId[];
    if (skillKeys.length > 0) {
      const newSkills = { ...person.skills };
      for (const skill of skillKeys) {
        newSkills[skill] = Math.min(100, (newSkills[skill] ?? 0) + (bonuses[skill] ?? 0));
      }
      updatedPeople.set(id, { ...person, skills: newSkills });
    }
  }

  // 9. Recalculate cultural blend and religion distribution from the updated population.
  const updatedCultureBlend = computeCulturalBlend(updatedPeople);
  const updatedReligions = computeReligionDistribution(updatedPeople);

  // Check if creole just emerged (first turn where diversity threshold was reached
  // and the counter crosses 20). The store uses this flag to fire a one-time notice.
  const creoleEmerged =
    newLanguageDiversityTurns >= 20 &&
    state.culture.languageDiversityTurns < 20;

  return {
    updatedPeople,
    production,
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
    updatedConstructionQueue: constructionResult.updatedQueue,
    overcrowdingRatio,
    spoilageThisTurn: calculateSpoilage(
      state.settlement.resources,
      state.currentSeason,
      currentBuildings,
    ),
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
    };
  }

  // Winter→Spring transition: reset annual quota contribution window.
  if (nextSeason === 'spring') {
    return {
      nextSeason,
      nextYear,
      quotaStatus: null,
      quotaEventId: null,
      resetQuotaContributions: true,
    };
  }

  return {
    nextSeason,
    nextYear,
    quotaStatus: null,
    quotaEventId: null,
    resetQuotaContributions: false,
  };
}

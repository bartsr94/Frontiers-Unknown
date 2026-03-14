/**
 * Faction System — System E of Phase 4.0.
 *
 * Politics emerges from demographics. When enough people share a cultural,
 * religious, or economic interest they begin acting as a bloc and — once
 * strong enough — make collective demands the player must navigate.
 *
 * Six faction types:
 *   cultural_preservationists — Sauromatian heritage; resist company drift
 *   company_loyalists          — Imanian heritage; defend Company authority
 *   orthodox_faithful          — Orthodox believers; oppose Wheel presence
 *   wheel_devotees             — Wheel/Hidden Wheel believers; seek tolerance
 *   community_elders           — Respected elders; collective moral authority
 *   merchant_bloc              — Traders and craftsmen; want economic freedom
 *
 * Pure TypeScript — no React imports, no Math.random().
 */

import type { Person } from '../population/person';
import type { TraitId } from '../personality/traits';
import type { Faction, FactionType, FactionDemand, GameState } from '../turn/game-state';
import { getEffectiveOpinion } from '../population/opinions';
import { SAUROMATIAN_CULTURE_IDS } from '../population/culture';
import { computeReligiousTension } from '../population/culture';
import { hasBuilding } from '../buildings/building-effects';
import { clamp } from '../../utils/math';
import { debugLog } from '../../utils/debug-logger';
import type { DebugSettings } from '../turn/game-state';

// ─── Constants ────────────────────────────────────────────────────────────────

const FACTION_MIN_MEMBERS = 3;
const DEMAND_STRENGTH_THRESHOLD = 0.45;
const DEMAND_COOLDOWN_TURNS = 20;
const FACTION_DISSOLVE_MIN_MEMBERS = 2;

// ─── Formation eligibility ────────────────────────────────────────────────────

/** Returns true if a person qualifies for membership in the given faction type. */
export function isEligibleMember(person: Person, type: FactionType, _state: GameState): boolean {
  switch (type) {
    case 'cultural_preservationists':
      return SAUROMATIAN_CULTURE_IDS.has(person.heritage.primaryCulture);

    case 'company_loyalists': {
      const imanianFraction = person.heritage.bloodline.find(b => b.group === 'imanian')?.fraction ?? 0;
      return imanianFraction >= 0.50;
    }

    case 'orthodox_faithful':
      return person.religion === 'imanian_orthodox';

    case 'wheel_devotees':
      return person.religion === 'sacred_wheel' || person.religion === 'syncretic_hidden_wheel';

    case 'community_elders':
      return person.traits.includes('respected_elder' as TraitId);

    case 'merchant_bloc':
      return person.role === 'trader' || person.role === 'craftsman';
  }
}

// ─── Formation conditions ──────────────────────────────────────────────────────

/** Returns true if the conditions are met to form a faction of this type. */
function meetsFormationCondition(
  type: FactionType,
  eligiblePeople: Person[],
  state: GameState,
): boolean {
  if (eligiblePeople.length < FACTION_MIN_MEMBERS) return false;

  switch (type) {
    case 'cultural_preservationists':
      return state.culture.culturalBlend > 0.60;

    case 'company_loyalists':
      return state.company.standing > 70;

    case 'orthodox_faithful':
    case 'wheel_devotees':
      return computeReligiousTension(state.culture.religions) > 0.25;

    case 'community_elders':
      return true; // 3+ respected elders is sufficient

    case 'merchant_bloc':
      return hasBuilding(state.settlement.buildings, 'trading_post');
  }
}

// ─── Strength computation ─────────────────────────────────────────────────────

/**
 * Computes faction strength:
 *   coherence = avg pairwise effectiveOpinion / 100, clamped [0, 1]
 *   strength  = clamp(memberCount / totalPop, 0, 1) × (0.5 + coherence × 0.5)
 */
export function computeFactionStrength(
  faction: Faction,
  people: Map<string, Person>,
  totalPop: number,
): number {
  const members = faction.memberIds
    .map(id => people.get(id))
    .filter((p): p is Person => p !== undefined);

  if (members.length < 2) return 0;

  let opinionSum = 0;
  let pairs = 0;
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      const mi = members[i]!;
      const mj = members[j]!;
      opinionSum += getEffectiveOpinion(mi, mj.id);
      pairs++;
    }
  }
  const coherence = pairs > 0 ? clamp((opinionSum / pairs) / 100, 0, 1) : 0.5;
  const sizeFraction = clamp(members.length / Math.max(totalPop, 1), 0, 1);
  return sizeFraction * (0.5 + coherence * 0.5);
}

// ─── Demand generation ────────────────────────────────────────────────────────

function generateDemand(type: FactionType, state: GameState): FactionDemand | null {
  switch (type) {
    case 'cultural_preservationists':
      return {
        type: 'policy_change',
        description: 'We demand our traditions be respected — allow the Wheel faith to be practised openly.',
        params: { policy: 'wheel_permitted' },
      };

    case 'company_loyalists':
      return {
        type: 'resource_grant',
        description: 'The Company expects its dues. We urge you to contribute extra goods this season.',
        params: { resource: 'goods', amount: 5 },
      };

    case 'orthodox_faithful':
      return {
        type: 'policy_change',
        description: 'The True Faith must prevail. We demand the Wheel be suppressed and orthodoxy enforced.',
        params: { policy: 'orthodox_enforced' },
      };

    case 'wheel_devotees': {
      const policy = state.culture.hiddenWheelEmerged
        ? 'hidden_wheel_recognized'
        : 'wheel_permitted';
      return {
        type: 'policy_change',
        description: state.culture.hiddenWheelEmerged
          ? 'The Hidden Wheel speaks for us all now. Recognise it — or lose us.'
          : 'We ask only to worship as we were born. Grant us the right to practise the Wheel.',
        params: { policy },
      };
    }

    case 'community_elders': {
      const hasGathering = hasBuilding(state.settlement.buildings, 'gathering_hall');
      const hasGreat = hasBuilding(state.settlement.buildings, 'great_hall');
      if (!hasGathering) {
        return {
          type: 'building_request',
          description: 'A settlement of this age needs a proper gathering hall. We urge you to build one.',
          params: { buildingId: 'gathering_hall' },
        };
      }
      if (!hasGreat) {
        return {
          type: 'building_request',
          description: 'The time has come for a great hall — a place for feasts, councils, and memory.',
          params: { buildingId: 'great_hall' },
        };
      }
      return {
        type: 'cultural_accommodation',
        description: 'We ask to be consulted before any major decision is made in this settlement.',
        params: {},
      };
    }

    case 'merchant_bloc':
      return {
        type: 'resource_grant',
        description: 'We need capital to grow. Ten gold pieces from the settlement coffers — an investment, not a gift.',
        params: { resource: 'gold', amount: 10 },
      };
  }
}

// ─── Main processor ───────────────────────────────────────────────────────────

export interface FactionProcessResult {
  updatedFactions: Faction[];
  /** Events that should be injected into the pending queue this turn. */
  pendingFactionEvents: Array<{ eventId: string; factionId: string }>;
  /** Activity log entries from this pass. */
  logEntries: Array<{
    type: 'faction_formed' | 'faction_dissolved';
    description: string;
  }>;
}

/**
 * Processes faction formation, membership, strength, and demands.
 * Called each dawn at step 9.6b, after identity pressure processing.
 *
 * Returns updated faction list + any events to inject.
 */
export function processFactions(
  state: GameState,
  currentTurn: number,
  debugSettings?: DebugSettings,
): FactionProcessResult {
  const people = state.people;
  const totalPop = people.size;
  const updatedFactions: Faction[] = [];
  const pendingFactionEvents: FactionProcessResult['pendingFactionEvents'] = [];
  const logEntries: FactionProcessResult['logEntries'] = [];

  const ALL_TYPES: FactionType[] = [
    'cultural_preservationists',
    'company_loyalists',
    'orthodox_faithful',
    'wheel_devotees',
    'community_elders',
    'merchant_bloc',
  ];

  for (const factionType of ALL_TYPES) {
    const existing = (state.factions ?? []).find(f => f.type === factionType);

    // Build current eligible membership
    const eligiblePeople = Array.from(people.values()).filter(p =>
      isEligibleMember(p, factionType, state),
    );
    const eligibleIds = new Set(eligiblePeople.map(p => p.id));

    if (existing) {
      // Update membership to only include still-eligible living persons
      const activeMembers = existing.memberIds.filter(id => eligibleIds.has(id));

      if (activeMembers.length < FACTION_DISSOLVE_MIN_MEMBERS) {
        // Dissolve
        logEntries.push({
          type: 'faction_dissolved',
          description: `The ${factionLabel(factionType)} faction dissolved — too few members.`,
        });
        debugLog(debugSettings ?? { showAutonomyLog: false, logSchemes: false, logOpinionDeltas: false, logFactionStrength: false, logAmbitions: false, pauseOnSchemeEvent: false, skipEvents: false }, {
          turn: currentTurn,
          channel: 'factions',
          message: `[Faction] ${factionType} dissolved (members: ${activeMembers.length})`,
        });
        // Don't push to updatedFactions — faction is gone
        continue;
      }

      // Recompute strength
      const updatedFaction: Faction = {
        ...existing,
        memberIds: activeMembers,
        strength: computeFactionStrength(
          { ...existing, memberIds: activeMembers },
          people,
          totalPop,
        ),
      };

      // Check if demand should fire
      const canDemand =
        updatedFaction.strength > DEMAND_STRENGTH_THRESHOLD &&
        updatedFaction.activeDemand === undefined &&
        (updatedFaction.demandFiredTurn === undefined ||
          currentTurn - updatedFaction.demandFiredTurn >= DEMAND_COOLDOWN_TURNS);

      if (canDemand) {
        const demand = generateDemand(factionType, state);
        if (demand) {
          const withDemand: Faction = {
            ...updatedFaction,
            activeDemand: demand,
            demandFiredTurn: currentTurn,
          };
          updatedFactions.push(withDemand);
          pendingFactionEvents.push({ eventId: 'fac_faction_demands', factionId: withDemand.id });
          debugLog(debugSettings ?? { showAutonomyLog: false, logSchemes: false, logOpinionDeltas: false, logFactionStrength: false, logAmbitions: false, pauseOnSchemeEvent: false, skipEvents: false }, {
            turn: currentTurn,
            channel: 'factions',
            message: `[Faction] ${factionType} demand fired: ${demand.description}`,
          });
          continue;
        }
      }

      // Check for standoff event (opposing factions both strong)
      const opposingType = getOpposingType(factionType);
      if (opposingType) {
        const opponent = updatedFactions.find(f => f.type === opposingType) ??
          (state.factions ?? []).find(f => f.type === opposingType);
        if (
          opponent &&
          opponent.strength > 0.4 &&
          updatedFaction.strength > 0.4 &&
          // Only fire once per pair per session (use existing cooldown logic)
          !pendingFactionEvents.some(e => e.eventId === 'fac_faction_standoff')
        ) {
          pendingFactionEvents.push({ eventId: 'fac_faction_standoff', factionId: updatedFaction.id });
        }
      }

      updatedFactions.push(updatedFaction);
    } else {
      // Potentially form a new faction
      if (!meetsFormationCondition(factionType, eligiblePeople, state)) continue;

      const newId = `faction_${factionType}_${currentTurn}`;
      const newFaction: Faction = {
        id: newId,
        type: factionType,
        memberIds: eligiblePeople.map(p => p.id),
        strength: 0, // computed below
        formedTurn: currentTurn,
      };
      newFaction.strength = computeFactionStrength(newFaction, people, totalPop);

      updatedFactions.push(newFaction);
      logEntries.push({
        type: 'faction_formed',
        description: `The ${factionLabel(factionType)} faction formed with ${eligiblePeople.length} members.`,
      });
      debugLog(debugSettings ?? { showAutonomyLog: false, logSchemes: false, logOpinionDeltas: false, logFactionStrength: false, logAmbitions: false, pauseOnSchemeEvent: false, skipEvents: false }, {
        turn: currentTurn,
        channel: 'factions',
        message: `[Faction] ${factionType} formed (members: ${eligiblePeople.length}, strength: ${newFaction.strength.toFixed(2)})`,
      });
    }
  }

  return { updatedFactions, pendingFactionEvents, logEntries };
}

// ─── Faction demand resolution ────────────────────────────────────────────────

/**
 * Clears the activeDemand on a specific faction (called by the store after
 * the player resolves the demand event).
 */
export function clearFactionDemand(
  factions: Faction[],
  factionId: string,
): Faction[] {
  return factions.map(f =>
    f.id === factionId ? { ...f, activeDemand: undefined } : f,
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns a human-readable name for a faction type. */
export function factionLabel(type: FactionType): string {
  switch (type) {
    case 'cultural_preservationists': return 'Cultural Preservationists';
    case 'company_loyalists':         return 'Company Loyalists';
    case 'orthodox_faithful':         return 'Orthodox Faithful';
    case 'wheel_devotees':            return 'Wheel Devotees';
    case 'community_elders':          return 'Community Elders';
    case 'merchant_bloc':             return 'Merchant Bloc';
  }
}

/** Returns the opposing faction type for standoff detection, or null if none. */
function getOpposingType(type: FactionType): FactionType | null {
  switch (type) {
    case 'orthodox_faithful':         return 'wheel_devotees';
    case 'wheel_devotees':            return 'orthodox_faithful';
    case 'cultural_preservationists': return 'company_loyalists';
    case 'company_loyalists':         return 'cultural_preservationists';
    default: return null;
  }
}

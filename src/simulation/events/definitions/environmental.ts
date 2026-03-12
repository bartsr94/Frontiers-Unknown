/**
 * Environmental events — weather, climate, and natural phenomena.
 *
 * These events fire regardless of political or cultural conditions; they
 * represent the wilderness itself responding to the settlement's presence
 * (or indifference to it).
 */

import type { GameEvent } from '../engine';

export const ENVIRONMENTAL_EVENTS: GameEvent[] = [
  {
    id: 'env_bountiful_harvest',
    title: 'A Bountiful Season',
    category: 'environmental',
    prerequisites: [],
    weight: 2,
    cooldown: 6,
    isUnique: false,
    description:
      'The season has been generous — the fields yielding more than expected, stores ' +
      'filling faster than planned. The men work with a lighter step. Even the weather ' +
      'has cooperated. Moments like this are rare this far from home.',
    choices: [
      {
        id: 'work_extended',
        label: 'Press the men to bring in every last bushel.',
        description: 'This surplus will matter come winter. Whether the push yields the maximum depends on who leads it.',
        consequences: [],
        skillCheck: {
          skill: 'plants',
          difficulty: 28,
          actorSelection: 'best_council',
          attemptLabel: 'Drive the harvest',
        },
        successText: 'The push is well-organized and the men respond. Every last yield is counted in — a genuinely abundant season.',
        failureText: 'The push runs longer than it should and returns diminish as fatigue sets in. Still a good season — just not the great one it could have been.',
        onSuccess: [{ type: 'modify_resource', target: 'food', value: 18 }],
        onFailure:  [{ type: 'modify_resource', target: 'food', value: 11 }],
      },
      {
        id: 'accept_bounty',
        label: "A good harvest. Let the men rest — they've earned it.",
        description: 'Morale matters too. A rested settlement is a resilient one.',
        consequences: [{ type: 'modify_resource', target: 'food', value: 8 }],
      },
    ],
  },

  {
    id: 'env_violent_storm',
    title: 'A Sudden Storm',
    category: 'environmental',
    prerequisites: [],
    weight: 2,
    cooldown: 8,
    isUnique: false,
    description:
      'Without warning, a violent storm tears through the settlement — rain driving ' +
      'sideways through every gap in the shelters, wind scattering anything left ' +
      'unsecured. By the time it passes, the stores have taken a hit. This country ' +
      "doesn't warn you. It just arrives.",
    choices: [
      {
        id: 'salvage',
        label: 'Set all hands to salvaging what can be saved.',
        description: 'The damage is done. Quick action and clear orders determine how much you lose.',
        consequences: [],
        skillCheck: {
          skill: 'leadership',
          difficulty: 30,
          actorSelection: 'best_council',
          attemptLabel: 'Rally the men',
        },
        successText: 'Clear orders cut through the chaos. Men form lines, barrels are upended, the worst of the damage is contained.',
        failureText: 'The storm defeats the response. By the time order is restored, the stores have taken a serious blow.',
        onSuccess: [{ type: 'modify_resource', target: 'food', value: -5  }],
        onFailure:  [{ type: 'modify_resource', target: 'food', value: -12 }],
      },
    ],
  },

  {
    id: 'env_winter_hardship',
    title: 'The Cold Bites Deep',
    category: 'environmental',
    prerequisites: [{ type: 'season_is', params: { season: 'winter' } }],
    weight: 3,
    cooldown: 4,
    isUnique: false,
    description:
      'The winter has proved harder than anticipated. The cold is deep and persistent, ' +
      "fuel is running lower than planned, and the men are eyeing the food stores with " +
      "growing concern. You can hear it in the silences around the fire.",
    choices: [
      {
        id: 'strict_ration',
        label: 'Implement strict rationing. Survival comes first.',
        description: 'Half portions until the weather breaks. Whether the ration holds depends on who enforces it.',
        consequences: [],
        skillCheck: {
          skill: 'leadership',
          difficulty: 32,
          actorSelection: 'best_council',
          attemptLabel: 'Hold the ration',
        },
        successText: 'The rationing holds under clear leadership. The men are hungry but ordered, and order keeps them from despair. Spring feels reachable.',
        failureText: 'The rationing frays at the edges. More is consumed than the plan allowed. Spring still comes, but the margin is thinner than it needed to be.',
        onSuccess: [{ type: 'modify_resource', target: 'food', value: -4 }],
        onFailure:  [{ type: 'modify_resource', target: 'food', value: -9 }],
      },
      {
        id: 'full_rations',
        label: 'Serve full rations. Keep the men fed and their spirits up.',
        description: "It costs more food — but a demoralized camp is its own kind of danger.",
        consequences: [{ type: 'modify_resource', target: 'food', value: -12 }],
      },
    ],
  },
];

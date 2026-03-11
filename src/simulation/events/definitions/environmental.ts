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
        description: 'This surplus will matter come winter. No hand idles.',
        consequences: [{ type: 'modify_resource', target: 'food', value: 15 }],
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
        description: 'The damage is done. Quick action limits the losses.',
        consequences: [{ type: 'modify_resource', target: 'food', value: -8 }],
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
        description: 'Half portions until the weather breaks. Nobody likes it, but everyone survives.',
        consequences: [{ type: 'modify_resource', target: 'food', value: -5 }],
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

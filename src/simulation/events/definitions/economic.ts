/**
 * Economic events — trade opportunities, resource finds, and market activity.
 */

import type { GameEvent } from '../engine';

export const ECONOMIC_EVENTS: GameEvent[] = [
  {
    id: 'eco_passing_merchant',
    title: 'A Traveling Merchant',
    category: 'economic',
    prerequisites: [],
    weight: 3,
    cooldown: 6,
    isUnique: false,
    isAmbient: true,
    actorRequirements: [
      { slot: 'negotiator', criteria: { sex: 'male' } },
    ],
    description:
      'A traveling merchant has set up a temporary stall at the edge of camp — a ' +
      'lean man with a mule, a carefully maintained ledger, and the nervous eyes of ' +
      'someone who has crossed Sauromatian territory alone. He has goods that could ' +
      'prove useful, and {negotiator} is already curious about his prices.',
    choices: [
      {
        id: 'trade_food',
        label: 'Trade 8 food for a haul of goods.',
        description: 'A fair deal. Manufactured goods are hard to come by this far from the city.',
        consequences: [
          { type: 'modify_resource', target: 'food', value: -8 },
          { type: 'modify_resource', target: 'goods', value: 4 },
        ],
      },
      {
        id: 'trade_gold',
        label: 'Pay him 5 gold. Keep the food stores intact.',
        description: 'Gold is easier to replenish than a winter food reserve. You send {negotiator} to see what terms he will accept.',
        consequences: [
          { type: 'modify_resource', target: 'gold', value: -5 },
        ],
        skillCheck: {
          skill: 'bargaining',
          difficulty: 45,
          actorSelection: 'best_council',
          attemptLabel: 'Negotiate',
        },
        successText: '{negotiator}\'s sharp eye and harder manner get you the better end of the deal. He throws in an extra crate.',
        failureText: 'The merchant is pleasant but unmovable. You take what is on offer.',
        onSuccess: [{ type: 'modify_resource', target: 'goods', value: 5 }],
        onFailure:  [{ type: 'modify_resource', target: 'goods', value: 3 }],
      },
      {
        id: 'decline',
        label: 'Nothing here we need. Send him on his way.',
        description: 'Save the resources for something more pressing.',
        consequences: [],
      },
    ],
  },

  {
    id: 'eco_useful_timbers',
    title: 'Good Timber Nearby',
    category: 'economic',
    prerequisites: [],
    weight: 2,
    cooldown: 0,
    isUnique: true,
    actorRequirements: [
      { slot: 'scout', criteria: { sex: 'male' } },
    ],
    description:
      '{scout} returns from a scouting run with good news: a stand of excellent timber lies ' +
      'within easy reach of the settlement — close enough to harvest without a major ' +
      'expedition. Tall, straight, dry-standing — seasoned by the wind. It will not ' +
      'last. Other parties will find it before long.',
    choices: [
      {
        id: 'harvest_now',
        label: 'Send a crew out immediately.',
        description: 'Strike while the opportunity is there. Good judgment on the timber maximises the yield.',
        consequences: [],
        skillCheck: {
          skill: 'plants',
          difficulty: 28,
          actorSelection: 'best_council',
          attemptLabel: 'Select and fell the timber',
        },
        successText: 'Good judgment on which trees to take and how to fell them efficiently. The haul is better than expected.',
        failureText: 'The crew works hard but the selection could have been sharper. Decent timber in decent quantity.',
        onSuccess: [{ type: 'modify_resource', target: 'lumber', value: 12 }],
        onFailure:  [{ type: 'modify_resource', target: 'lumber', value: 7  }],
      },
      {
        id: 'note_and_wait',
        label: 'Note the location. More pressing matters at hand.',
        description: 'The timber will still be there — probably.',
        consequences: [],
      },
    ],
  },
];

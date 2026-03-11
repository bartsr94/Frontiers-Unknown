/**
 * Domestic events — internal settlement life, settler behaviour, and morale.
 *
 * These events humanise the men under your command and force choices between
 * efficiency, fairness, and the emotional realities of frontier life.
 */

import type { GameEvent } from '../engine';

export const DOMESTIC_EVENTS: GameEvent[] = [
  {
    id: 'dom_hunting_party',
    title: 'Game Tracks Spotted',
    category: 'domestic',
    prerequisites: [],
    weight: 3,
    cooldown: 5,
    isUnique: false,
    description:
      'One of the men returns to camp excited: he has found fresh game tracks nearby ' +
      '— deer, by the depth and pattern of them, and in good number. An organized ' +
      'hunt could put real meat in the stores and lift spirits among the men. The ' +
      'question is how much to commit.',
    choices: [
      {
        id: 'full_hunt',
        label: 'Organize a proper hunting party — four men, full kit.',
        description: 'Commit properly and the return will be worth it. Costs a little in supplies.',
        consequences: [
          { type: 'modify_resource', target: 'food', value: 10 },
          { type: 'modify_resource', target: 'goods', value: -1 },
        ],
      },
      {
        id: 'light_foray',
        label: 'Send two men for a quick foray.',
        description: 'Minimal disruption to regular work. Modest return.',
        consequences: [{ type: 'modify_resource', target: 'food', value: 5 }],
      },
      {
        id: 'stay_the_course',
        label: 'Keep everyone at their assigned work.',
        description: 'Routine and discipline over windfalls.',
        consequences: [],
      },
    ],
  },

  {
    id: 'dom_homesick_man',
    title: 'The Weight of Distance',
    category: 'domestic',
    prerequisites: [],
    weight: 2,
    cooldown: 0,
    isUnique: true,
    description:
      'One of the men comes to you after the evening meal. He misses his family. ' +
      'He misses the city — the noise of it, the familiar smells. The wilderness is ' +
      'getting to him, and you can see it in the way he stares at the tree line at ' +
      'night, at the dark where the firelight ends. He has not asked to leave. ' +
      'Not yet.',
    choices: [
      {
        id: 'speak_plainly',
        label: 'Speak plainly: this is the life we chose.',
        description: 'He signed his contract. Acknowledge his honesty without softening the truth.',
        consequences: [],
      },
      {
        id: 'give_bonus',
        label: 'Give him something extra from the reserves.',
        description:
          'A few coins — a gesture that his service is seen and valued. It costs you, but it costs less than losing him.',
        consequences: [{ type: 'modify_resource', target: 'gold', value: -5 }],
      },
      {
        id: 'invoke_contract',
        label: 'Remind him of his contract with the Ansberry Company.',
        description: 'He has an obligation and he knows it. The Company does not release men lightly.',
        consequences: [],
      },
    ],
  },

  {
    id: 'dom_settler_initiative',
    title: 'Men at Work',
    category: 'domestic',
    prerequisites: [],
    weight: 2,
    cooldown: 0,
    isUnique: true,
    description:
      'Two of the men have been spending their evenings improving the settlement ' +
      'entirely on their own initiative — better drainage channels, a covered ' +
      'chimney on the cook-fire, the dry stores reorganized out of reach of ' +
      'the damp. They ask your permission to make it a formal project, and for ' +
      'some lumber to do it properly.',
    choices: [
      {
        id: 'back_the_project',
        label: 'Approve it. Give them the materials they need.',
        description:
          'Investment in infrastructure pays off. Better storage means less food spoilage.',
        consequences: [
          { type: 'modify_resource', target: 'lumber', value: -3 },
          { type: 'modify_resource', target: 'food', value: 5 },
        ],
      },
      {
        id: 'encourage_informally',
        label: "Commend the initiative. Let them continue on their own terms.",
        description: 'They work with what they have. A modest improvement.',
        consequences: [{ type: 'modify_resource', target: 'food', value: 3 }],
      },
      {
        id: 'redirect_them',
        label: 'Redirect their energy toward assigned tasks.',
        description: 'Initiative is admirable, but routine keeps a settlement alive.',
        consequences: [],
      },
    ],
  },
];

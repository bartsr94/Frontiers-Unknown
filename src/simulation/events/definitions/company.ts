/**
 * Company events — communications and interactions with the Ansberry Company.
 *
 * The Company is the settlement's patron and demanding creditor. Its early
 * gestures are generous; its later demands are not.
 */

import type { GameEvent } from '../engine';

export const COMPANY_EVENTS: GameEvent[] = [
  {
    id: 'co_supply_delivery',
    title: 'Company Supply Delivery',
    category: 'company',
    prerequisites: [],
    weight: 1,
    cooldown: 0,
    isUnique: true,
    description:
      'A Company supply wagon arrives — ahead of any schedule you expected. ' +
      'The quartermaster explains with a thin smile that the Company invests in ' +
      'its expeditions early, before the returns begin. There are provisions, ' +
      'trade goods, and a purse of coin. "Consider it a show of faith," he says, ' +
      'closing his ledger. "The Company expects returns."',
    choices: [
      {
        id: 'accept',
        label: 'Accept the supplies with gratitude.',
        description: 'No reason to refuse a gift from your patron — for now.',
        consequences: [
          { type: 'modify_resource', target: 'food', value: 15 },
          { type: 'modify_resource', target: 'gold', value: 10 },
          { type: 'modify_resource', target: 'goods', value: 5 },
        ],
      },
    ],
  },

  {
    id: 'co_quota_reminder',
    title: 'Letter from the Company',
    category: 'company',
    prerequisites: [
      { type: 'min_year', params: { value: 2 } },
      { type: 'season_is', params: { season: 'spring' } },
    ],
    weight: 2,
    cooldown: 8,
    isUnique: false,
    description:
      "A courier arrives bearing the Ansberry Company's seal. The message is brief " +
      'and businesslike: the settlement\'s first quota assessment will occur at ' +
      "year's end. Current expectations are modest. They will grow. " +
      'The courier waits for a reply.',
    choices: [
      {
        id: 'confident_reply',
        label: "Send back a confident response: the Company won't be disappointed.",
        description: 'Bold words. Now make good on them.',
        consequences: [{ type: 'modify_standing', target: 'company', value: 5 }],
      },
      {
        id: 'cautious_reply',
        label: 'Acknowledge receipt and request patience during the establishment phase.',
        description: 'Honest, at least.',
        consequences: [],
      },
    ],
  },
];

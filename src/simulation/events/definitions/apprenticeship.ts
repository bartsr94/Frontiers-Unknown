/**
 * Apprenticeship events — player-facing notifications for trade training.
 *
 * Both events are fired programmatically by processApprenticeships() via
 * the turn-processor; they are NOT drawn from the normal event deck (weight: 0,
 * isDeferredOutcome: true).
 *
 * Event IDs:
 *   appr_trade_training_begins  — an apprenticeship has just formed
 *   appr_trade_mastered         — an apprentice has graduated
 */

import type { GameEvent } from '../engine';

export const APPRENTICESHIP_EVENTS: GameEvent[] = [

  // ── Apprenticeship begins ──────────────────────────────────────────────────

  {
    id: 'appr_trade_training_begins',
    title: 'A Willing Hand',
    category: 'personal',
    prerequisites: [],
    actorRequirements: [
      { slot: 'master',     criteria: { minAge: 16 } },
      { slot: 'apprentice', criteria: { minAge: 10 } },
    ],
    weight: 1,
    cooldown: 0,
    isUnique: false,
    isDeferredOutcome: true,
    description:
      '{master.first} has taken {apprentice.first} on as an apprentice, beginning to pass on ' +
      "their knowledge of the trade. It's a quiet arrangement — a hand guided, a skill slowly earned.",
    choices: [
      {
        id: 'bless_the_arrangement',
        label: 'A fine pairing — give it your blessing.',
        description: 'Voice your approval. Both will feel the settlement\'s support.',
        consequences: [
          { type: 'modify_opinion', target: '{master}',     value: 5 },
          { type: 'modify_opinion', target: '{apprentice}', value: 5 },
          {
            type: 'modify_opinion_pair',
            target: '{master}',
            value: 10,
            params: { slotB: '{apprentice}', label: 'Apprentice bond' },
          },
        ],
      },
      {
        id: 'no_interference',
        label: 'Leave them to it.',
        description: 'A quiet nod. They know what they are doing.',
        consequences: [],
      },
    ],
  },

  // ── Trade mastered ─────────────────────────────────────────────────────────

  {
    id: 'appr_trade_mastered',
    title: 'A Trade Learned',
    category: 'personal',
    prerequisites: [],
    actorRequirements: [
      { slot: 'master',   criteria: { minAge: 16 } },
      { slot: 'graduate', criteria: { minAge: 10 } },
    ],
    weight: 1,
    cooldown: 0,
    isUnique: false,
    isDeferredOutcome: true,
    description:
      '{graduate.first} has completed {graduate.his} apprenticeship under {master.first}. ' +
      'Years of patient instruction have paid off — {graduate.he} now carries the knowledge ' +
      'of the trade and will put it to productive use in the seasons ahead.',
    choices: [
      {
        id: 'formal_ceremony',
        label: 'Mark the graduation with ceremony.',
        description: 'A small gathering honours the achievement. Settlement morale lifts slightly.',
        consequences: [
          { type: 'modify_opinion', target: '{master}',   value: 8 },
          { type: 'modify_opinion', target: '{graduate}', value: 8 },
          {
            type: 'modify_opinion_pair',
            target: '{master}',
            value: 12,
            params: { slotB: '{graduate}', label: 'Teaching bond' },
          },
        ],
      },
      {
        id: 'quiet_acknowledgement',
        label: 'Acknowledge the achievement quietly.',
        description: 'A word of congratulation is enough.',
        consequences: [
          { type: 'modify_opinion', target: '{graduate}', value: 4 },
        ],
      },
    ],
  },

];

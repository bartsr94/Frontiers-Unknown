/**
 * Famine crisis events — all three are injected programmatically by the store
 * (never drawn from the normal deck). They fire on the turn the famineStreak
 * crosses its threshold.
 *
 * Injection triggers (handled in game-store.ts):
 *   fam_hunger_grips_settlement     — famineStreak becomes 1
 *   fam_families_consider_leaving   — famineStreak becomes 2
 *   fam_famine_deepens              — famineStreak becomes ≥ 3 (fires each season)
 */

import type { GameEvent } from '../engine';

export const FAMINE_EVENTS: GameEvent[] = [
  // ─────────────────────────────────────────────────────────────────────────────
  // Streak 1 — first season of shortage
  // ─────────────────────────────────────────────────────────────────────────────

  {
    id: 'fam_hunger_grips_settlement',
    title: 'Hunger Grips the Settlement',
    category: 'domestic',
    isDeferredOutcome: true,
    weight: 1,
    cooldown: 0,
    isUnique: false,
    prerequisites: [],
    description:
      'The stores are empty. Meals have grown thin and unpredictable — ' +
      'some settlers go to sleep hungry, and the children are restless. ' +
      'The settlement has run short of food this season. If nothing changes, ' +
      'the situation will worsen.',
    choices: [
      {
        id: 'emergency_rations',
        label: 'Declare emergency rationing and dispatch hunters.',
        description:
          'Strict rationing buys time and a focused hunting effort may recover ' +
          'some food — but morale and production will suffer for the next season.',
        consequences: [
          { type: 'modify_resource', target: 'food', value: 4 },
          { type: 'modify_resource', target: 'wealth', value: -2 },
        ],
      },
      {
        id: 'appeal_to_tribe',
        label: 'Offer goods to a neighbouring tribe in exchange for food.',
        description:
          'A frank admission of need may cost standing, but a tribe that sees ' +
          'you deal honestly in hardship may prove a better ally in the long run.',
        consequences: [
          { type: 'modify_resource', target: 'food', value: 6 },
          { type: 'modify_resource', target: 'goods', value: -4 },
        ],
      },
      {
        id: 'endure_and_adapt',
        label: 'Tighten belts. The settlement will adapt.',
        description:
          'People are resilient. Do nothing exceptional — trust the community ' +
          'to find its own way through a single lean season.',
        consequences: [],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // Streak 2 — second consecutive season of shortage
  // ─────────────────────────────────────────────────────────────────────────────

  {
    id: 'fam_families_consider_leaving',
    title: 'Families Consider Leaving',
    category: 'domestic',
    isDeferredOutcome: true,
    weight: 1,
    cooldown: 0,
    isUnique: false,
    prerequisites: [],
    description:
      'A second season without enough food has broken an unspoken patience. ' +
      'Around the cookfires, the talk has turned to leaving — to returning to ' +
      'the lowlands, or seeking a tribe willing to take them in. Faces that ' +
      'once looked at the settlement with pride now look at the horizon.',
    choices: [
      {
        id: 'distribute_last_reserves',
        label: 'Break open the last reserves. Feed everyone fully, once.',
        description:
          'A single day of plenty will not fix the underlying shortage, but it ' +
          'reminds people what they are working toward. It may be enough to ' +
          'keep the most restless among them here.',
        consequences: [
          { type: 'modify_resource', target: 'food', value: -6 },
          { type: 'modify_resource', target: 'wealth', value: 3 },
          { type: 'modify_standing', target: 'company', value: -2 },
        ],
      },
      {
        id: 'commit_to_solution',
        label: 'Announce a concrete plan: what food sources will be expanded.',
        description:
          'Leadership means making promises you can keep. You name the buildings ' +
          'that will be built, the fields that will be tilled. Whether you can ' +
          'deliver is another matter — but people need a direction to face.',
        consequences: [
          { type: 'modify_resource', target: 'goods', value: -2 },
        ],
      },
      {
        id: 'release_dissatisfied',
        label: 'Grant safe passage to those who wish to leave.',
        description:
          'Every mouth that goes is one less mouth to feed. The settlement may ' +
          'be weaker — but the people who remain chose to stay.',
        consequences: [
          { type: 'modify_standing', target: 'company', value: -4 },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // Streak ≥ 3 — prolonged famine, settlement near collapse
  // ─────────────────────────────────────────────────────────────────────────────

  {
    id: 'fam_famine_deepens',
    title: 'The Famine Deepens',
    category: 'domestic',
    isDeferredOutcome: true,
    weight: 1,
    cooldown: 0,
    isUnique: false,
    prerequisites: [],
    description:
      'Children are sick. The elderly sit in doorways, not working. ' +
      'The settlement has now gone without enough food for three or more ' +
      'seasons in a row. Without a dramatic change, the expedition is ' +
      'at risk of complete collapse. The Company will hear of this.',
    choices: [
      {
        id: 'desperate_trade',
        label: 'Sacrifice the settlement\'s wealth for emergency imported food.',
        description:
          'Send a rider to the nearest trading post with everything that can ' +
          'be spared — gold, tools, goods. Whatever can be bought, buy it.',
        consequences: [
          { type: 'modify_resource', target: 'food', value: 10 },
          { type: 'modify_resource', target: 'wealth', value: -8 },
          { type: 'modify_resource', target: 'goods', value: -5 },
          { type: 'modify_standing', target: 'company', value: -5 },
        ],
      },
      {
        id: 'pray_and_endure',
        label: 'Hold on. Pray the next harvest comes early.',
        description:
          'There is nothing left to give. You can only hope the season ' +
          'turns before the settlement breaks entirely.',
        consequences: [
          { type: 'modify_standing', target: 'company', value: -8 },
        ],
      },
      {
        id: 'authorise_exodus',
        label: 'Authorize a structured exodus. Prioritise the children.',
        description:
          'You cannot feed everyone. Better to send families to safety now ' +
          'than to watch them starve. The settlement will be a skeleton of ' +
          'what it was — if it survives at all.',
        consequences: [
          { type: 'modify_standing', target: 'company', value: -10 },
        ],
      },
    ],
  },
];

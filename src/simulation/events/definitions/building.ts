/**
 * Settlement / building events — overcrowding pressure, construction milestones,
 * and opportunities unlocked by specific buildings.
 *
 * Three negative overcrowding events escalate in severity:
 *   1. Fever outbreak (skill check to contain it)
 *   2. Bitter quarrel (culture-clash dispute, optional trait assignment)
 *   3. Someone leaves (permanent pop loss, no choice)
 *
 * Two positive events reward investment:
 *   4. Completion toast (deferred, fires when civic tier 2/3 completes)
 *   5. Traders notice (unique, fires once trading post is built)
 */

import type { GameEvent } from '../engine';

export const BUILDING_EVENTS: GameEvent[] = [
  // ─── Overcrowding events ──────────────────────────────────────────────────

  {
    id: 'bld_fever_spreads',
    title: 'Fever in the Camp',
    category: 'domestic',
    prerequisites: [
      { type: 'overcrowded', params: {} },
      { type: 'season_is', params: { season: 'winter' } },
    ],
    weight: 4,
    cooldown: 8,
    isUnique: false,
    description:
      'The camp is packed tight through another bitter winter. Heat from too many ' +
      'bodies in too little space turns stale — and now three settlers lie sweating ' +
      'on their bedrolls with a quick, wet cough that spreads before anyone names it. ' +
      'Your healer studies the sick, chewing their thumbnail, and says nothing good.',
    choices: [
      {
        id: 'treat_aggressively',
        label: 'Isolate the sick and burn what they touched.',
        description: 'Harsh, but fever respects ruthlessness. Your healer knows what must be done.',
        consequences: [
          { type: 'modify_resource', target: 'medicine', value: -4 },
        ],
        skillCheck: {
          skill: 'plants',
          difficulty: 45,
          actorSelection: 'best_council',
          attemptLabel: 'Contain the outbreak',
        },
        onSuccess: [
          { type: 'modify_resource', target: 'food', value: -2 },
        ],
        onFailure: [
          { type: 'modify_resource', target: 'food', value: -5 },
          { type: 'wound_person', target: 'random_adult', value: 20 },
        ],
      },
      {
        id: 'pray_and_wait',
        label: 'Trust in the Radiant One. Give them warmth and water and pray.',
        description: 'Faith costs nothing. The sick may recover on their own.',

        consequences: [
          { type: 'modify_resource', target: 'food', value: -3 },
          { type: 'wound_person', target: 'random_adult', value: 15 },
        ],
      },
    ],
  },

  {
    id: 'bld_bitter_quarrel',
    title: 'A Quarrel Over Space',
    category: 'domestic',
    prerequisites: [
      { type: 'overcrowded', params: {} },
      { type: 'min_population', params: { value: 8 } },
    ],
    actorRequirements: [
      { slot: 'settler', criteria: { sex: 'male',   religion: 'imanian_orthodox' } },
      { slot: 'rival',   criteria: { sex: 'female', religion: 'sacred_wheel' } },
    ],
    weight: 3,
    cooldown: 6,
    isUnique: false,
    description:
      'The settlement is too small for the people in it. {settler} and {rival} ' +
      'have been sharing a corner of the longhouse for three ' +
      'seasons and their patience has finally exhausted itself. What began as a dispute ' +
      'over who owns the sleeping roll on the left has become something uglier: old ' +
      'words, old gestures, old contempt. Others have started to take sides.',
    choices: [
      {
        id: 'intervene_firmly',
        label: 'Intervene and separate them. No more sharing quarters.',
        description: 'Distance is not harmony, but it is a start.',
        skipActorBond: true,
        consequences: [
          { type: 'modify_resource', target: 'wealth', value: -1 },
        ],
        skillCheck: {
          skill: 'leadership',
          difficulty: 40,
          actorSelection: 'best_council',
          attemptLabel: 'Assert authority',
        },
        onSuccess: [
          { type: 'modify_opinion_pair', target: '{settler}', value: -6, params: { slotB: '{rival}', label: 'Forced distance' } },
        ],
        onFailure: [
          { type: 'modify_standing', target: 'company', value: -2 },
          { type: 'modify_opinion_pair', target: '{settler}', value: -10, params: { slotB: '{rival}', label: 'Bitter quarrel' } },
        ],
      },
      {
        id: 'let_them_settle_it',
        label: 'Stay out of it. This is beneath your authority.',
        description: 'People have always resolved such things without their leaders stepping in.',
        skipActorBond: true,
        consequences: [
          { type: 'wound_person', target: 'random_adult', value: 10 },
          { type: 'modify_opinion_pair', target: '{settler}', value: -10, params: { slotB: '{rival}', label: 'Physical fight' } },
        ],
      },
      {
        id: 'build_something',
        label: 'Acknowledge the problem publicly and announce a solution: build more.',
        description: 'Channel the anger into labour. The people know what overcrowding means — show them you do too.',
        skipActorBond: true,
        consequences: [
          { type: 'modify_resource', target: 'wealth', value: 2 },
          { type: 'modify_standing', target: 'company', value: 1 },
          { type: 'modify_opinion_pair', target: '{settler}', value: -6, params: { slotB: '{rival}', label: 'Underlying tension' } },
        ],
      },
    ],
  },

  {
    id: 'bld_someone_leaves',
    title: 'Gone Before Dawn',
    category: 'domestic',
    prerequisites: [
      { type: 'overcrowded', params: {} },
      { type: 'min_population', params: { value: 12 } },
      { type: 'min_year', params: { value: 3 } },
    ],
    actorRequirements: [
      { slot: 'leaver', criteria: { minAge: 18 } },
    ],
    weight: 2,
    cooldown: 10,
    isUnique: false,
    description:
      '{leaver.His} sleeping spot is empty at morning muster. {leaver} has gone — ' +
      'pack rolled tight, tools taken, no word left and no farewell given. ' +
      'The others knew {leaver.his} name but say little. The camp is too crowded ' +
      'and not everyone wanted to stay.',
    choices: [
      {
        id: 'accept_it',
        label: 'Let {leaver.him} go. You cannot cage a person.',
        description: 'Some losses you must carry without comfort.',
        consequences: [
          { type: 'remove_person', target: '{leaver}', value: 1 },
        ],
      },
    ],
  },

  // ─── Construction milestones ──────────────────────────────────────────────

  {
    id: 'bld_completion_toast',
    title: 'The Rafters Are Up',
    category: 'domestic',
    prerequisites: [],
    weight: 1,
    cooldown: 0,
    isUnique: false,
    isDeferredOutcome: true,
    description:
      'The last beam is heaved into place before the light fails. Someone produces ' +
      'a small clay flask — nobody asks where it came from — and it goes around the ' +
      'circle twice. Dirty hands, tired shoulders, and something that feels, for once, ' +
      'unmistakably like pride. What you have built will outlast the people who built it.',
    choices: [
      {
        id: 'toast_together',
        label: 'Lift the flask with everyone who helped.',
        description: 'Tonight the work is finished. Tomorrow it becomes home.',
        consequences: [
          { type: 'modify_resource', target: 'wealth', value: 3 },
          { type: 'modify_standing', target: 'company', value: 2 },
        ],
      },
    ],
  },

  // ─── Trading post opportunity ─────────────────────────────────────────────

  {
    id: 'bld_traders_notice',
    title: 'Word Reaches the River',
    category: 'economic',
    prerequisites: [
      { type: 'has_building', params: { buildingId: 'trading_post' } },
    ],
    weight: 5,
    cooldown: 0,
    isUnique: true,
    description:
      'Word travels faster than wagons along the river trade routes. Within a season ' +
      'of your trading post going up, a pair of Kiswani barge merchants have appeared ' +
      'at the landing — lean, direct, with eyes that catalogue everything twice. They ' +
      'are not here to sell. They are here to decide whether you are worth coming back to.',
    choices: [
      {
        id: 'offer_samples',
        label: 'Give them samples of what you produce and invite them back next season.',
        description: 'First impressions in trade are everything.',
        consequences: [
          { type: 'modify_resource', target: 'wealth',  value: -3 },
          { type: 'modify_resource', target: 'wealth',   value: 8 },
        ],
        skillCheck: {
          skill: 'bargaining',
          difficulty: 42,
          actorSelection: 'best_council',
          attemptLabel: 'Negotiate terms',
        },
        onSuccess: [
          { type: 'modify_resource', target: 'wealth', value: 6 },
        ],
        onFailure: [],
      },
      {
        id: 'name_your_price',
        label: 'Name your terms plainly. No samples — they buy or they leave.',
        description: 'Boldness is sometimes respected; sometimes it just ends the conversation.',
        consequences: [],
        skillCheck: {
          skill: 'bargaining',
          difficulty: 58,
          actorSelection: 'best_council',
          attemptLabel: 'Hold your ground',
        },
        onSuccess: [
          { type: 'modify_resource', target: 'wealth',  value: 18 },
          { type: 'modify_resource', target: 'wealth', value: -2 },
        ],
        onFailure: [
          { type: 'modify_standing', target: 'company', value: -3 },
        ],
      },
    ],
  },
];

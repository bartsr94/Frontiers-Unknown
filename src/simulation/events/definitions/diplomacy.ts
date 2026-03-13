/**
 * Diplomacy events — encounters with neighbouring peoples and external powers.
 *
 * Phase 1 scope: first contact with the Kiswani Riverfolk. Full tribal
 * diplomacy (disposition tracking, trade agreements, envoys) is Phase 3.
 * These events set the narrative foundation and establish the player's
 * early relationship with the region's indigenous peoples.
 */

import type { GameEvent } from '../engine';

export const DIPLOMACY_EVENTS: GameEvent[] = [
  {
    id: 'dip_riverfolk_observers',
    title: 'Watchers at the River',
    category: 'diplomacy',
    prerequisites: [],
    weight: 1,
    cooldown: 0,
    isUnique: true,
    actorRequirements: [
      { slot: 'envoy', criteria: { sex: 'male' } },
    ],
    description:
      'A small group of women has been spotted watching the camp from across the ' +
      'water. Kiswani Riverfolk, by the look of them — pearl ornaments catching ' +
      'the light, cloth dyed in the deep river-blues their people favour. They ' +
      'stand in the open, unhidden, making no move to approach or to flee. ' +
      'They are watching you with the same patient attention you give the river: ' +
      'carefully, without apparent hostility, reading what you are.',
    choices: [
      {
        id: 'send_greeting',
        label: 'Send {envoy} to the bank with open hands and a greeting.',
        description:
          'Reaching across the water is a gesture. Whether it is answered depends on how well it is read.',
        consequences: [],
        skillCheck: {
          skill: 'diplomacy',
          difficulty: 45,
          actorSelection: 'best_council',
          attemptLabel: 'Make contact',
        },
        successText:
          'The man returns with a small bundle of smoked fish left at the water\'s edge — a quiet first answer. The observers exchange words among themselves before withdrawing.',
        failureText:
          'The man approaches with good intentions, but something in the manner or the greeting does not land. The observers watch without response, then withdraw across the water.',
        onSuccess: [{ type: 'modify_resource', target: 'food', value: 5 }],
        onFailure:  [],
      },
      {
        id: 'observe_mutually',
        label: 'Observe them as they observe you. Make no move.',
        description:
          'Patient stillness. You are here to stay, and they will come to understand that ' +
          'in their own time.',
        consequences: [],
      },
      {
        id: 'show_armed',
        label: 'Have the guard walk the perimeter in plain view. Let them see you are armed.',
        description:
          'You are not prey, and that should be established from the beginning. ' +
          'They withdraw across the water without incident.',
        consequences: [],
      },
    ],
  },

  // ─── Deferred chain: upstream Kiswani camp ────────────────────────────────

  {
    id: 'dip_upriver_camp_spotted',
    title: 'Smoke Upstream',
    category: 'diplomacy',
    prerequisites: [
      { type: 'tribe_exists',            params: { tribeId: 'njaro_matu_riverfolk' } },
      { type: 'tribe_disposition_above', params: { tribeId: 'njaro_matu_riverfolk', value: -10 } },
    ],
    actorRequirements: [
      { slot: 'envoy', criteria: { sex: 'male' } },
    ],
    weight: 1,
    cooldown: 30,
    isUnique: true,
    description:
      'Your scouts report a Kiswani camp two days upstream — perhaps forty souls. ' +
      'Cooking fires visible in the morning, but no approach has been made. ' +
      'They are aware of you. The question is whether you make the first move.',
    choices: [
      {
        id: 'send_emissary',
        label: 'Send {envoy} upstream to make contact.',
        description:
          'A gesture of good faith. It will take time — you will not know the outcome for several days.',
        consequences: [],
        deferredEventId: 'dip_upriver_emissary_return',
        deferredTurns: 4,
        missionActorSlot: 'envoy',
        pendingText:
          '{envoy.first} sets out at dawn with trade gifts and a careful manner. ' +
          'You will hear from him in time.',
      },
      {
        id: 'wait_and_watch',
        label: 'Post observers and wait. Let them approach on their own terms.',
        description: 'Patient. Costs nothing. May cost opportunity.',
        consequences: [],
      },
      {
        id: 'show_strength',
        label: 'Patrol the river bank in force. Let them see your numbers.',
        description:
          'You are not prey, and they should know it from the beginning. ' +
          'First impressions, once made, are hard to revise.',
        consequences: [
          { type: 'modify_disposition', target: 'njaro_matu_riverfolk', value: -5 },
          { type: 'modify_standing',    target: 'company',              value:  2 },
        ],
      },
    ],
  },

  {
    id: 'dip_upriver_emissary_return',
    title: 'The Emissary Returns',
    category: 'diplomacy',
    prerequisites: [],
    isDeferredOutcome: true,
    weight: 1,
    cooldown: 0,
    isUnique: true,
    description:
      '{envoy} has returned from the Kiswani camp upstream. ' +
      '{envoy.He} looks tired but is unharmed. The camp received {envoy.him} — ' +
      'whether they received {envoy.him} well is another matter.',
    choices: [
      {
        id: 'resolve',
        label: 'Hear {envoy.his} report.',
        description: '',
        consequences: [],
        skillCheck: {
          skill: 'diplomacy',
          difficulty: 50,
          actorSelection: 'best_council',
          attemptLabel: 'recounts what passed between them',
        },
        successText:
          '{envoy.first} chose his words with care and read the room well. ' +
          'He leaves the camp with an open invitation to trade — a quiet, ' +
          'provisional trust that neither side need announce aloud.',
        failureText:
          '{envoy.first} came back rattled. The Kiswani received him, ' +
          'tested him, and found him wanting in some way he cannot fully articulate. ' +
          'He was sent away with courtesy but no warmth.',
        onSuccess: [{ type: 'modify_disposition', target: 'njaro_matu_riverfolk', value: 15 }],
        onFailure: [{ type: 'modify_disposition', target: 'njaro_matu_riverfolk', value: -5 }],
      },
    ],
  },
];

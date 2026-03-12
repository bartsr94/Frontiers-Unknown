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
];

/**
 * Cultural identity pressure events.
 *
 * Six events that fire as the settlement's cultural blend drifts far enough
 * from the safe zone (0.25–0.65) to trigger Company or tribal reactions.
 *
 * Prerequisite mapping (corrected from design doc §4.1):
 *   companyPressureTurns — seasons spent in the NATIVE zone (blend > 0.65)
 *   tribalPressureTurns  — seasons spent in the IMANIAN zone (blend < 0.25)
 *
 * Consequence format: { type, target, value } — matches EventConsequence interface.
 *   modify_standing:               target = 'company', value = numeric delta
 *   modify_all_tribe_dispositions: target = 'all',      value = numeric delta
 *   modify_cultural_blend:         target = 'settlement', value = numeric delta
 *   modify_opinion:                target = slot token or person ID, value = delta
 *   modify_resource:               target = ResourceType, value = numeric delta
 */

import type { GameEvent } from '../engine';

export const IDENTITY_EVENTS: GameEvent[] = [

  // ── Company Cultural Concern ─────────────────────────────────────────────────
  {
    id: 'ident_company_cultural_concern',
    title: 'Concern from the Factor',
    category: 'company',
    description:
      '{leader.He} receives a pointed letter from Factor Aldous Thrent. ' +
      '"Reports have reached Port Iron that your settlement is becoming, shall we say, ' +
      'indistinguishable from the natives. The Company expects its outposts to ' +
      'represent Imanian civilisation. We trust this is a temporary lapse."',
    prerequisites: [
      { type: 'min_company_pressure_turns', params: { turns: 3 } },
    ],
    actorRequirements: [
      { slot: 'leader', criteria: { socialStatus: 'founding_member' } },
    ],
    choices: [
      {
        id: 'send_gift',
        label: 'Send a reassurance gift of gold.',
        description: 'Five gold pieces and a respectful letter should reassure the Factor for now.',
        requirements: [{ type: 'has_resource', params: { resource: 'gold', amount: 5 } }],
        consequences: [
          { type: 'modify_resource', target: 'gold', value: -5 },
        ],
      },
      {
        id: 'dismiss_letter',
        label: 'Dismiss the letter.',
        description: 'You know what is best for this settlement. The Factor\'s concerns can wait.',
        consequences: [
          { type: 'modify_standing', target: 'company', value: -8 },
        ],
      },
    ],
    cooldown: 8,
    isUnique: false,
    weight: 2,
  },

  // ── Company Inspector Dispatched ─────────────────────────────────────────────
  {
    id: 'ident_company_inspector_dispatched',
    title: 'An Inspector Arrives',
    category: 'company',
    description:
      'A woman in Company grey arrives on the supply boat. Inspector Maren Culver ' +
      'presents her credentials to {leader}: she has been dispatched by the Board ' +
      'to assess whether this outpost still represents Imanian interests in the Ashmark. ' +
      'She makes notes in a ledger and watches everything.',
    prerequisites: [
      { type: 'min_company_pressure_turns', params: { turns: 8 } },
    ],
    actorRequirements: [
      { slot: 'leader', criteria: { socialStatus: 'founding_member' } },
    ],
    choices: [
      {
        id: 'comply',
        label: 'Comply. Hold a formal Imanian ceremony.',
        description: 'Present the settlement in its best Imanian light and earn the inspector\'s approval.',
        consequences: [
          { type: 'modify_standing', target: 'company', value: 5 },
          { type: 'modify_cultural_blend', target: 'settlement', value: -0.03 },
        ],
      },
      {
        id: 'defy',
        label: 'Defy the inspector.',
        description: 'This settlement answers to its people, not to Port Iron.',
        consequences: [
          { type: 'modify_standing', target: 'company', value: -15 },
          { type: 'modify_opinion', target: '{leader}', value: 5 },
        ],
      },
    ],
    isUnique: false,
    cooldown: 16,
    weight: 1.0,
  },

  // ── Company Pleased ──────────────────────────────────────────────────────────
  {
    id: 'ident_company_pleased',
    title: 'Commendation from Port Iron',
    category: 'company',
    description:
      'A formal letter arrives bearing the Ansberry Company seal. Director Aldous '+
      'Thrent commends {leader} for maintaining the settlement\'s Imanian character ' +
      'in challenging circumstances. "You are proof that civilised men can hold to ' +
      'their roots even in the frontier."',
    prerequisites: [
      { type: 'cultural_blend_below', params: { value: 0.20 } },
      { type: 'min_tribal_pressure_turns', params: { turns: 5 } },
    ],
    actorRequirements: [
      { slot: 'leader', criteria: { socialStatus: 'founding_member' } },
    ],
    choices: [
      {
        id: 'accept',
        label: 'Accept the commendation with pride.',
        description: 'A formal acknowledgement strengthens the Company\'s confidence in your stewardship.',
        consequences: [
          { type: 'modify_standing', target: 'company', value: 10 },
        ],
      },
    ],
    isUnique: false,
    cooldown: 20,
    weight: 1,
  },

  // ── Tribal Leader Invitation ─────────────────────────────────────────────────
  {
    id: 'ident_tribal_leader_invitation',
    title: 'An Invitation from the Elders',
    category: 'diplomacy',
    description:
      'A rider arrives bearing gifts and an invitation from a nearby elder. ' +
      'The message, translated haltingly, conveys genuine curiosity: ' +
      'they have watched {leader.his} settlement draw closer to native ways and ' +
      'would welcome a meeting at their ceremonial ground. Such an invitation is ' +
      'not lightly given.',
    prerequisites: [
      { type: 'min_company_pressure_turns', params: { turns: 3 } },
    ],
    actorRequirements: [
      { slot: 'leader', criteria: { socialStatus: 'founding_member' } },
    ],
    choices: [
      {
        id: 'accept',
        label: 'Accept the invitation.',
        description: 'Send {leader} to attend the gathering and strengthen bonds with the elders.',
        consequences: [
          { type: 'modify_all_tribe_dispositions', target: 'all', value: 15 },
        ],
      },
      {
        id: 'decline',
        label: 'Politely decline for now.',
        description: 'The time is not right. Perhaps the next invitation will come at a better moment.',
        consequences: [],
      },
    ],
    cooldown: 12,
    isUnique: false,
    weight: 1,
  },

  // ── Tribal Champion Recognised ───────────────────────────────────────────────
  {
    id: 'ident_tribal_champion_recognised',
    title: 'The Ashmark Calls You Kin',
    category: 'diplomacy',
    description:
      'Word spreads through the region. Elders from several tribes gather at the ' +
      'river bend that marks the edge of your territory. Their eldest speaker addresses ' +
      '{leader}: "You have lived as we live. Your children speak our tongue. ' +
      'You are not foreigners any longer. You are of the Ashmark." ' +
      'The Company will not be pleased.',
    prerequisites: [
      { type: 'cultural_blend_above', params: { value: 0.80 } },
      { type: 'min_company_pressure_turns', params: { turns: 8 } },
    ],
    actorRequirements: [
      { slot: 'leader', criteria: { socialStatus: 'founding_member' } },
    ],
    choices: [
      {
        id: 'accept',
        label: 'Accept this recognition.',
        description: 'This is who we are now. The Company will not like it, but the Ashmark has spoken.',
        consequences: [
          { type: 'modify_all_tribe_dispositions', target: 'all', value: 10 },
          { type: 'modify_standing', target: 'company', value: -10 },
        ],
      },
    ],
    isUnique: true,
    cooldown: 20,
    weight: 1.0,
  },

  // ── Settlers Feel Foreign ────────────────────────────────────────────────────
  {
    id: 'ident_settlers_feel_foreign',
    title: 'A Stranger in Their Own Home',
    category: 'domestic',
    description:
      '{settler} comes to {leader.him} in private. The words are careful but the ' +
      'feeling is plain: the settlement has grown more Imanian in character, ' +
      'and for those who have always called this land home, something feels out of place. ' +
      '"I do not know the prayers they sing in the longhouse," {settler.he} says quietly. ' +
      '"I do not know if there is room here for what I am."',
    prerequisites: [
      { type: 'min_tribal_pressure_turns', params: { turns: 5 } },
      {
        type: 'has_person_matching',
        params: { sauromatianHeritage: true, minAge: 16 },
      },
    ],
    actorRequirements: [
      { slot: 'leader', criteria: { socialStatus: 'founding_member' } },
      {
        slot: 'settler',
        criteria: { sauromatianHeritage: true, minAge: 16 },
      },
    ],
    choices: [
      {
        id: 'hold_native_celebration',
        label: 'Hold a native celebration.',
        description: 'Honour the old ways and show {settler} that there is room for everyone here.',
        consequences: [
          { type: 'modify_standing', target: 'company', value: -4 },
          { type: 'modify_cultural_blend', target: 'settlement', value: 0.02 },
          { type: 'modify_opinion', target: '{settler}', value: 8 },
          { type: 'modify_opinion_pair', target: '{leader}', value: 5, params: { slotB: '{settler}', label: 'Heard and welcomed' } },
        ],
      },
      {
        id: 'hold_imanian_outreach',
        label: 'Hold an Imanian outreach ceremony.',
        description: 'Teach the common tongue and customs so that all can find their footing together.',
        consequences: [
          { type: 'modify_cultural_blend', target: 'settlement', value: -0.02 },
          { type: 'modify_opinion', target: '{settler}', value: 3 },
          { type: 'modify_opinion_pair', target: '{leader}', value: 3, params: { slotB: '{settler}', label: 'Cultural bridge' } },
        ],
      },
    ],
    cooldown: 8,
    isUnique: false,
    weight: 1,
  },

];

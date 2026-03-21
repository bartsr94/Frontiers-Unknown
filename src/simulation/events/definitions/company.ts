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
          { type: 'modify_resource', target: 'wealth', value: 15 },
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
        description: 'Bold words. How well they land depends on the pen behind them.',
        consequences: [],
        skillCheck: {
          skill: 'leadership',
          difficulty: 35,
          actorSelection: 'best_council',
          attemptLabel: 'Write the reply',
        },
        successText: 'The letter strikes the right tone — specific, direct, and confident without grandstanding. The Company will read this as the reply of a capable expedition leader.',
        failureText: 'The confidence sounds better in your head than on parchment. The Company notes it without particular warmth.',
        onSuccess: [{ type: 'modify_standing', target: 'company', value: 8 }],
        onFailure:  [{ type: 'modify_standing', target: 'company', value: 3 }],
      },
      {
        id: 'cautious_reply',
        label: 'Acknowledge receipt and request patience during the establishment phase.',
        description: 'Honest, at least.',
        consequences: [],
      },
    ],
  },

  // ─── Annual Supply Ship ─────────────────────────────────────────────────

  {
    id: 'co_annual_ship',
    title: 'The Company Ship Arrives',
    category: 'company',
    prerequisites: [
      { type: 'min_year', params: { value: 2 } },
      { type: 'season_is', params: { season: 'spring' } },
    ],
    weight: 2,
    cooldown: 4,
    isUnique: false,
    description:
      'A Company vessel puts in at the riverbank, riding low with cargo. The purser ' +
      'delivers provisions and a purse of silver — standard issue for settlements in ' +
      'their second year. A passenger disembarks: a Company factor, there to "assist ' +
      'with organisation." Assist, or report. It is not entirely clear.',
    choices: [
      {
        id: 'welcome_factor',
        label: 'Welcome the factor and have him join your party.',
        description: 'Cooperation looks better in quarterly reports.',
        consequences: [
          { type: 'modify_resource', target: 'food',  value: 10 },
          { type: 'modify_resource', target: 'wealth',  value: 8  },
          {
            type: 'add_person',
            target: 'company_factor',
            value: 1,
            params: { sex: 'male', ethnicGroup: 'imanian', minAge: 30, maxAge: 45, religion: 'company_mandate' },
          },
        ],
      },
      {
        id: 'accept_supplies_only',
        label: 'Accept the supplies but find reasons to keep the factor at arm\'s length.',
        description: 'Less scrutiny. Possibly fewer endorsements.',
        consequences: [
          { type: 'modify_resource', target: 'food',  value: 10 },
          { type: 'modify_resource', target: 'wealth',  value: 5  },
          { type: 'modify_standing', target: 'company', value: -3 },
        ],
      },
    ],
  },

  // ─── Triggered quota events (queued by game-store from DuskResult) ────────
  // isDeferredOutcome: true prevents these from appearing in normal draws.

  {
    id: 'co_quota_warning',
    title: 'A Disapproving Letter',
    category: 'company',
    isDeferredOutcome: true,
    prerequisites: [],
    weight: 1,
    cooldown: 0,
    isUnique: false,
    description:
      'The quarterly dispatch from the Ansberry Company is unusually brief. ' +
      'The quota was not met. The Company notes this with disappointment but ' +
      'not yet with alarm. "A single shortfall may be forgiven," the letter reads; ' +
      '"a pattern will not be." The ledger lines remain red.',
    choices: [
      {
        id: 'acknowledge',
        label: 'Send a formal acknowledgement and a promise to do better.',
        description: 'Words are cheap. Results are not.',
        consequences: [],
      },
      {
        id: 'deflect',
        label: 'Cite difficult conditions and request a temporary adjustment to expectations.',
        description: 'It might buy goodwill. Or it might look like excuses.',
        consequences: [],
        skillCheck: {
          skill: 'bargaining',
          difficulty: 40,
          actorSelection: 'best_council',
          attemptLabel: 'Draft the appeal',
        },
        successText: 'The appeal is well-reasoned and well-worded. The Company notes the hardships and grants a modest concession for the coming year.',
        failureText: 'The Company is unmoved. The letter is filed under "Excuses."',
        onSuccess: [{ type: 'modify_standing', target: 'company', value: 5 }],
        onFailure:  [{ type: 'modify_standing', target: 'company', value: -5 }],
      },
    ],
  },

  {
    id: 'co_inspector_arrives',
    title: 'The Company Sends an Inspector',
    category: 'company',
    isDeferredOutcome: true,
    prerequisites: [],
    weight: 1,
    cooldown: 0,
    isUnique: false,
    description:
      'A senior Company inspector arrives unannounced, accompanied by two clerks ' +
      'with heavy satchels and an air of studied suspicion. He announces a formal ' +
      'review of accounts, operations, and "the general character of the enterprise". ' +
      'His manner implies conclusions already reached.',
    choices: [
      {
        id: 'cooperate',
        label: 'Open the ledgers. Full cooperation.',
        description: 'Honesty costs something. So does obstruction.',
        consequences: [
          { type: 'modify_standing', target: 'company', value: -8 },
          {
            type: 'add_person',
            target: 'company_inspector',
            value: 1,
            params: { sex: 'male', ethnicGroup: 'imanian', minAge: 40, maxAge: 55, religion: 'company_mandate' },
          },
        ],
      },
      {
        id: 'contest',
        label: 'Challenge the inspector\'s authority and demand a formal written mandate.',
        description: 'Risky. But delays can be useful.',
        consequences: [{ type: 'modify_standing', target: 'company', value: -15 }],
        skillCheck: {
          skill: 'leadership',
          difficulty: 55,
          actorSelection: 'best_council',
          attemptLabel: 'Challenge the mandate',
        },
        successText: 'The inspector has no written mandate for a full audit. Technically, he cannot compel access to private records. He leaves, furious but empty-handed — for now.',
        failureText: 'The challenge backfires. Word reaches the Company before the inspector does. The account books are reviewed anyway.',
        onSuccess: [],
        onFailure:  [{ type: 'modify_standing', target: 'company', value: -5 }],
      },
    ],
  },

  {
    id: 'co_final_warning',
    title: 'Final Warning',
    category: 'company',
    isDeferredOutcome: true,
    prerequisites: [],
    weight: 1,
    cooldown: 0,
    isUnique: false,
    description:
      'The letter arrives sealed in black wax — the Company\'s mark for official ' +
      'sanctions. The language is unambiguous: three consecutive shortfalls constitute ' +
      'a material breach. "One further failure to meet contractual obligations will ' +
      'result in formal withdrawal of Company support and reclamation of all assets ' +
      'disbursed under the charter." This is the last warning they will give.',
    choices: [
      {
        id: 'pledge_compliance',
        label: 'Pledge full quota compliance for the coming year.',
        description: 'A pledge must be backed by results.',
        consequences: [{ type: 'modify_standing', target: 'company', value: -12 }],
      },
    ],
  },

  {
    id: 'co_abandoned',
    title: 'Company Withdrawal',
    category: 'company',
    isDeferredOutcome: true,
    prerequisites: [],
    weight: 1,
    cooldown: 0,
    isUnique: true,
    description:
      'A formally worded document arrives by the last ship of the season. The ' +
      'Ansberry Company Chartered Expedition is hereby dissolved. All rights, ' +
      'properties, and obligations revert. No further supply ships will come. ' +
      'No further correspondence is expected. The settlement is on its own.',
    choices: [
      {
        id: 'accept_independence',
        label: 'Accept the situation. Build something that needs no patron.',
        description: 'The Company was never truly an ally. Perhaps this is better.',
        consequences: [{ type: 'modify_standing', target: 'company', value: -100 }],
      },
    ],
  },
  {
    id: 'co_annual_export',
    title: 'The Year-End Reckoning',
    category: 'company',
    isDeferredOutcome: true,
    prerequisites: [],
    weight: 1,
    cooldown: 0,
    isUnique: false,
    description:
      "The Ansberry Company's factor arrives as the harvest season closes, ledger in hand. " +
      "The year's trading accounts fall due. Your settlement's production has been assessed. " +
      "How much wealth do you commit to the Company's export shipment?",
    choices: [
      {
        id: 'send_full',
        label: 'Send the full quota.',
        description: 'Meet your contractual obligation. The Company expects no less.',
        consequences: [{ type: 'contribute_quota_wealth', target: 'company', value: 'full' }],
      },
      {
        id: 'send_exceed',
        label: "Exceed the quota — send 125% and earn the Company's favour.",
        description: 'A costly gesture, but one that builds lasting credit.',
        consequences: [{ type: 'contribute_quota_wealth', target: 'company', value: 'exceed' }],
      },
      {
        id: 'send_all',
        label: 'Send everything we have.',
        description: 'Strip the treasury. The settlement suffers, but the Company is paid.',
        consequences: [{ type: 'contribute_quota_wealth', target: 'company', value: 'all_available' }],
      },
      {
        id: 'send_nothing',
        label: 'Send nothing this year.',
        description: 'Withhold the shipment entirely. The consequences will follow.',
        consequences: [{ type: 'contribute_quota_wealth', target: 'company', value: 'none' }],
      },
    ],
  },
];

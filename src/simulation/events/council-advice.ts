/**
 * Council adviser voice system — pure logic, no React.
 *
 * Generates in-character advice for each council member based on their
 * personality traits, skills, and cultural background reacting to the
 * current event.
 *
 * Advice is deterministic: the same (personId + eventId) pair always produces
 * the same text, without consuming the main RNG stream.
 *
 * Hard rules:
 *  - No Math.random()
 *  - No React imports
 *  - No `any` types
 */

import type { TraitId } from '../personality/traits';
import type { GameEvent, EventChoice, EventCategory, EventConsequence } from './engine';
import type { Person } from '../population/person';
import { DERIVED_SKILL_IDS, getPersonSkillScore } from '../population/person';
import type { DerivedSkillId, SkillId } from '../population/person';
import type { Faction, FactionType } from '../turn/game-state';

// ─── Voice Archetype ──────────────────────────────────────────────────────────

export type VoiceArchetype =
  | 'bold'
  | 'pragmatist'
  | 'diplomat'
  | 'traditionalist'
  | 'cautious'
  | 'schemer';

/**
 * Priority-ordered mapping from archetype to the traits that trigger it.
 * Iteration order matters: first matching trait wins.
 */
const ARCHETYPE_TRAIT_MAP: Array<[VoiceArchetype, ReadonlyArray<TraitId>]> = [
  ['bold',          ['brave', 'wrathful', 'veteran', 'hero']],
  ['pragmatist',    ['greedy', 'ambitious', 'clever', 'wealthy']],
  ['diplomat',      ['generous', 'gregarious', 'welcoming', 'cosmopolitan']],
  ['traditionalist',['traditional', 'devout', 'proud', 'honest']],
  ['cautious',      ['patient', 'craven', 'sickly', 'humble']],
  ['schemer',       ['deceitful', 'lustful', 'scandal', 'oath_breaker']],
];

/**
 * Returns the dominant voice archetype for a person.
 * Iterates their traits in order; returns the archetype matched by the first
 * trait that appears in the priority map. Defaults to 'cautious'.
 */
export function getVoiceArchetype(traits: TraitId[]): VoiceArchetype {
  for (const trait of traits) {
    for (const [archetype, archetypeTraits] of ARCHETYPE_TRAIT_MAP) {
      if ((archetypeTraits as readonly string[]).includes(trait)) return archetype;
    }
  }
  return 'cautious';
}

// ─── Choice Scoring ───────────────────────────────────────────────────────────

/**
 * Computes a personal desirability score for a choice from this person's
 * perspective. Higher = this person would prefer this option. Weights are
 * additive from the trait bias table in the design document.
 */
export function scoreChoiceForPerson(person: Person, choice: EventChoice): number {
  let score = 0;
  const traits = person.traits;
  const culture = person.heritage.primaryCulture;

  // Aggregate all consequences (base + conditional branches)
  const allCons: EventConsequence[] = [
    ...choice.consequences,
    ...(choice.onSuccess ?? []),
    ...(choice.onFailure ?? []),
  ];

  // Aggregate deltas for categories we care about
  const wealthDelta = allCons
    .filter(c => c.type === 'modify_resource' && (c.target === 'gold' || c.target === 'goods'))
    .reduce((sum, c) => sum + (typeof c.value === 'number' ? c.value : 0), 0);

  const standingDelta = allCons
    .filter(c => c.type === 'modify_standing')
    .reduce((sum, c) => sum + (typeof c.value === 'number' ? c.value : 0), 0);

  const dispositionDelta = allCons
    .filter(c => c.type === 'modify_disposition' || c.type === 'modify_opinion')
    .reduce((sum, c) => sum + (typeof c.value === 'number' ? c.value : 0), 0);

  const maxMagnitude = allCons
    .filter(c => typeof c.value === 'number')
    .reduce((m, c) => Math.max(m, Math.abs(c.value as number)), 0);

  const hasSkillCheck = !!choice.skillCheck;
  const isDeceptionCheck = choice.skillCheck?.skill === 'deception';
  const isSimpleChoice = !hasSkillCheck && allCons.length <= 2;

  // ── Trait biases ───────────────────────────────────────────────────────────
  for (const trait of traits) {
    switch (trait) {
      case 'greedy':
        if (wealthDelta > 0) score += 25;
        if (wealthDelta < 0) score -= 20;
        break;
      case 'generous':
        if (dispositionDelta > 0) score += 20;
        break;
      case 'brave':
        if (hasSkillCheck) score += 15;
        break;
      case 'craven':
        if (!hasSkillCheck) score += 20;
        if (hasSkillCheck) score -= 15;
        break;
      case 'deceitful':
        if (isDeceptionCheck) score += 30;
        break;
      case 'honest':
        if (isDeceptionCheck) score -= 30;
        break;
      case 'traditional':
        if (standingDelta > 0) score += 20;
        if (standingDelta < 0) score -= 20;
        break;
      case 'cosmopolitan':
        if (dispositionDelta > 0) score += 25;
        break;
      case 'xenophobic':
        if (dispositionDelta > 0) score -= 30;
        if (dispositionDelta < 0) score += 20;
        break;
      case 'ambitious':
        if (standingDelta > 0) score += 25;
        if (standingDelta < 0) score -= 15;
        break;
      case 'patient':
        if (isSimpleChoice) score += 15;
        break;
      case 'wrathful':
        if (maxMagnitude > 0) score += 20;
        break;
      case 'welcoming':
        if (dispositionDelta > 0) score += 20;
        break;
      case 'proud':
        if (standingDelta >= 0) score += 15;
        break;
      case 'clever':
        if (hasSkillCheck) score += 10;
        break;
    }
  }

  // ── Cultural bias ──────────────────────────────────────────────────────────
  if (culture.startsWith('kiswani_') || culture.startsWith('hanjoda_') || culture.startsWith('sauro_')) {
    if (dispositionDelta > 0) score += 15;
  }
  if (culture === 'imanian_homeland' || culture === 'ansberite' || culture === 'townborn') {
    if (standingDelta > 0) score += 10;
  }

  return score;
}

// ─── Deterministic Hash ───────────────────────────────────────────────────────

/**
 * djb2-style string hash. Deterministic, consumes no RNG.
 * Returns a non-negative integer.
 */
export function hashPersonEvent(personId: string, eventId: string): number {
  const str = `${personId}:${eventId}`;
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    // djb2: hash * 33 + charCode, kept as 32-bit int
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

// ─── Advice Templates ─────────────────────────────────────────────────────────

/**
 * 48-cell matrix of opening fragments: VoiceArchetype × EventCategory.
 * Each cell holds 3–4 short text fragments. One is selected by
 * `seed % fragments.length`.
 */
const ADVICE_TEMPLATES: Record<VoiceArchetype, Record<EventCategory, string[]>> = {
  bold: {
    diplomacy: [
      'Show strength first. Hospitality comes after respect is established.',
      'Do not mistake their approaching us for weakness — match it with confidence.',
      'A delegation that finds us passive will not long remain peaceful. Meet them firmly.',
      'We did not come this far to blink when strangers arrive at our threshold.',
    ],
    domestic: [
      'These situations only get worse if you hesitate.',
      'Men who grumble need a task, not a speech. Give them work and the complaint dies.',
      'Order is not found — it is imposed. Someone must impose it.',
      'I have never seen a problem improve by being left alone.',
    ],
    economic: [
      'Wealth comes to those who reach for it. The cautious man buries his coins and buries with them.',
      'Every trade is a small contest. Win the first one and the terms improve.',
      'The risk is real. So is the reward. I know which one I think about.',
      'Bold action here will tell others what kind of settlement this is.',
    ],
    military: [
      'Strike while they are still forming their resolve. Hesitation costs more than a bad attack.',
      'I have seen what happens to those who wait for the right moment. The right moment is now.',
      'We did not come to these lands to be careful.',
      'A threat left unanswered invites a bigger one.',
    ],
    cultural: [
      'Our customs are a foundation, not a cage. We carry them with us — we do not hide behind them.',
      'A man who fears what he does not understand will always find enemies.',
      'Let them see who we are. If they differ from us — good. It makes for more interesting company.',
      'Identity is not fragile. Stop treating it as though it were.',
    ],
    personal: [
      'This is not a situation that waits. Act before the choice is made for you.',
      'I have known this kind of trouble before. It respects only direct action.',
      'We do not deliberate with a fire. We stamp it out or we feed it. Choose.',
      'Boldness now prevents a larger reckoning later.',
    ],
    environmental: [
      'The land tests the weak and rewards those who press through. Let us not be found wanting.',
      'Weather and hardship are conditions, not excuses. We adapt and we continue.',
      'I have endured worse. We endure this and come out harder for it.',
      'Every difficult season survived is experience the next generation inherits.',
    ],
    company: [
      'The Company respects results. Show them results and they will forgive the method.',
      'Their ledgers do not frighten me. What frightens me is a leader who makes decisions by committee.',
      'We answer to the Company with deeds, not explanations.',
      'The boldest settlements are the ones the Company remembers.',
    ],
    immigration: [
      'New blood means new strength. I see only upside in welcoming those strong enough to make the journey.',
      'Every settler who chooses us over staying where they were is a small vote of confidence. Accept it.',
      'A settlement that turns away willing workers will not stay large long. Let them in and set them to work.',
      'Do not overthink a closed fist asking to become an open hand. Grip it and pull them through the gate.',
    ],
  },

  pragmatist: {
    diplomacy: [
      'Every delegation wants something they have not said aloud. Find that, and you hold the advantage.',
      'Goodwill is a currency. Spend it only where the return is clear.',
      'The question is not whether to engage — it is what we stand to gain.',
      'Identify their interest first. Ours will align or it will not — but knowing is always cheaper than guessing.',
    ],
    domestic: [
      'Discontent is a resource problem. Find what they lack and supply it.',
      'Men who feel valued work harder. Investment in morale pays dividends.',
      'I would want to know what this costs before I commit to any course.',
      'A stable workforce is the foundation of everything else. This problem is worth solving properly.',
    ],
    economic: [
      'The question is simple: which path leaves us richer?',
      'Any arrangement that increases our productive capacity is worth considering.',
      'There is always a way to make this profitable. Sometimes you have to be willing to think differently.',
      'Opportunity cost matters here. What are we not doing while we deliberate?',
    ],
    military: [
      'War is expensive. Let us be certain the prize justifies the cost before we commit.',
      'The most efficient victory is one the enemy concedes without a fight.',
      'I would rather reach a favorable arrangement than win a costly battle.',
      'If we must fight, let us fight in a way that leaves us better placed afterward.',
    ],
    cultural: [
      'Cultures are tools. The settlement that can move between them trades and survives better.',
      'Our identity is not at risk from exposure to different ways. Our purse is what needs protecting.',
      'The question is always the same: does this serve us?',
      'Cultural flexibility is a competitive advantage. I would not be too sentimental about it.',
    ],
    personal: [
      'People are assets. How we treat this particular one sets a precedent for all the others.',
      'Sentiment is fine in its place. But this is a decision with real consequences.',
      'I want to understand what this person wants, what they can do for us, and what it costs to keep them well. Then I can advise properly.',
      'There is always an arrangement that works for both parties. Finding it is what I do.',
    ],
    environmental: [
      'A crisis well-managed is cheaper than a crisis ignored. Early action is almost always worth it.',
      'The prudent calculation here is straightforward: what is the cost of doing nothing?',
      'Hardship is an opportunity to consolidate. We should come out of this stronger, not merely intact.',
      'Resources spent on prevention are always cheaper than resources spent on recovery.',
    ],
    company: [
      'The Company\'s goodwill is a resource like any other. Spend it carefully.',
      'Good numbers open doors. I do not know a better way to be heard in Port Iron.',
      'Our standing with the Company translates directly to our latitude here. Protect it.',
      'The Company wants a return. Give them one, and give it to them in terms they understand.',
    ],
    immigration: [
      'The question with any new settler is simple: what do they bring and what will they consume?',
      'Immigration is leverage we have because we built something worth coming to. Use it.',
      'A skilled arrival is worth evaluating on their merits. Skills, age, connections — those are the variables that matter.',
      'The terms we offer now will be the terms others hear about. Price accordingly.',
    ],
  },

  diplomat: {
    diplomacy: [
      'A tangible gift shows greater respect than do pretty words. The way we handle this first exchange will define how they see us for a generation.',
      'The way we greet these people will be the story they tell about us around their fires.',
      'Building trust is patient work. We must not squander these early moments.',
      'I have seen what a gesture of genuine respect can accomplish where a dozen negotiations failed.',
    ],
    domestic: [
      'What the men need is not direction — it is to feel heard.',
      'A moment like this, handled with grace, earns more loyalty than a month of good rations.',
      'I have seen what happens when leadership treats people as problems to be managed. Let us not repeat that error.',
      'The men came with us out of faith in this expedition. That faith should not be repaid with contempt.',
    ],
    economic: [
      'The better arrangement is one both sides feel is fair. Those are the arrangements that last.',
      'I would rather we walk away with a willing partner than a victorious deal that breeds resentment.',
      'Shared prosperity is more durable than extracted profit. I speak from experience.',
      'A good trade is one your partner is glad to repeat. Let us make that kind.',
    ],
    military: [
      'Before we consider force, I want to know: what does the other side actually want?',
      'A negotiated peace preserves relationships that violence can never restore.',
      'I would exhaust every other option first. Not from softness — from practicality. The damage is always mutual.',
      'There is almost always a way through that does not require anyone to bleed.',
    ],
    cultural: [
      'A moment like this is earned slowly and lost in an instant. Let us not waste it.',
      'Our different ways are not a problem to be solved. They are the texture of this place.',
      'I have always found that when people are given room to be themselves, they become more generous.',
      'This is the kind of exchange that, done well, neither side forgets for the better part of a generation.',
    ],
    personal: [
      'How we treat this person in their difficulty will be remembered long after the difficulty passes.',
      'A settlement that is known for its fairness attracts better people. This is not abstract.',
      'I have found that the direct, human approach solves more than it creates.',
      'There is a person here, not merely a problem. Let us engage with the person first.',
    ],
    environmental: [
      'In shared hardship, there is also shared opportunity. How we respond here will shape how people see us.',
      'The community\'s strength is in its bonds. A crisis is when those bonds are tested and either hold or break.',
      'I would look to how we can help those most affected first, and worry about the larger picture after.',
      'Hard times reveal character. Let what is revealed here be something worth knowing.',
    ],
    company: [
      'A well-written letter can accomplish more than three seasons of good numbers.',
      'The Company is made of people too. The right relationship with the right factor is worth more than perfect accounting.',
      'Our standing rests on what people say about us. Let those things be worth saying.',
      'Goodwill, once established, insulates us against the inevitable difficult seasons ahead.',
    ],
    immigration: [
      'A person who chooses to come to us has already decided to trust us. Let us not disappoint that first instinct.',
      'Every new arrival represents a relationship with whoever they left behind. We are building an extended community.',
      'The way we greet newcomers is the story they send home. Let it be a story that brings more.',
      'I have always found that people who feel genuinely welcomed become the most committed members of any community.',
    ],
  },

  traditionalist: {
    diplomacy: [
      'Our customs are not ornament. They are what separates a settlement from a camp.',
      'How we greet strangers reflects who we are. Let us not greet them as something we are not.',
      'There is a right way to do this, and it has been established through long practice. I would not depart from it.',
      'The correct forms exist because they have worked. I see no reason to improvise.',
    ],
    domestic: [
      'Order and custom keep a community together when nothing else does. Neither should be abandoned lightly.',
      'The old patterns exist because they work. Men who understand their place are more useful than men who question it.',
      'I am not against change. I am against change for its own sake.',
      'The answer to most domestic trouble is a return to what worked before trouble arose.',
    ],
    economic: [
      'Fair dealing is not just a virtue — it is the foundation of all lasting commerce.',
      'The arrangement that asks us to behave dishonestly toward either party is no arrangement at all.',
      'I would want any agreement we make to be one we are willing to describe plainly to anyone who asks.',
      'Honest trade builds a reputation. A good reputation is worth more than any single deal.',
    ],
    military: [
      'Our people did not build what we have here by being reckless. We should not start now.',
      'There is a right way to meet force, and it begins with being certain you are in the right.',
      'I have no objection to firmness. I have objections to rashness dressed up as firmness.',
      'Duty and honor require that we be prepared. They do not require that we be eager.',
    ],
    cultural: [
      'I am not opposed to learning from others. I am opposed to forgetting ourselves in the process.',
      'A community without roots does not stand. Ours are Imanian. I am not ashamed of that.',
      'Our customs are not ornament. They are what separates a settlement from a mere camp of strangers.',
      'There is value in what has been carried from home. I would not discard it casually.',
    ],
    personal: [
      'What this person needs most is to understand what is expected of them. Plain speaking costs nothing.',
      'I have always found that holding to one\'s word — and expecting others to hold to theirs — resolves more than it complicates.',
      'I do not shy from difficult conversations. But I would have them honestly.',
      'Character is the sum of how a person behaves when no one is looking. We should reward good character here.',
    ],
    environmental: [
      'The safest path through hardship is to preserve what we have and endure.',
      'These trials are not unusual. They are the nature of this land. We were told as much.',
      'I would not commit more than we can afford to spare. Caution here is wisdom, not weakness.',
      'We planned for difficulty. Let us execute that plan rather than improvise.',
    ],
    company: [
      'The Company\'s confidence in us rests on predictability. Let us not surprise them.',
      'Our obligations to the Company are real. Meeting them is not merely good practice — it is what we agreed to.',
      'I believe in honoring our commitments, even when it costs us. Especially when it costs us.',
      'A good report to the Company is one that can be verified. Let us make sure ours can be.',
    ],
    immigration: [
      'I do not oppose new settlers. I oppose those who are not prepared to work within the customs of this place.',
      'The settlement has a character. Those who come here should understand it before they sit down at our table.',
      'Each arrival reshapes what this settlement is, slightly. That is not bad, but it should not be unconsidered.',
      'My question about any newcomer is always the same: what do they bring, and are they willing to become part of what we have built?',
    ],
  },

  cautious: {
    diplomacy: [
      'I would want to know considerably more about them before committing to any course.',
      'Our first impressions of strangers have been wrong before. I urge patience.',
      'The advantage of waiting is that the situation clarifies itself. We lose nothing by being unhurried.',
      'What they say they want and what they actually want may not be the same thing. I would listen longer before deciding.',
    ],
    domestic: [
      'I would be slow to commit resources until we understand what we are dealing with.',
      'Unrest has a habit of growing once you acknowledge it. I am not certain acting quickly is wise.',
      'I confess I do not fully understand how this has come about. Perhaps understanding it should come before resolving it.',
      'The most conservative option here preserves the most room to adjust if we have read the situation wrong.',
    ],
    economic: [
      'The safest path is to spend the least and hold the most until conditions improve.',
      'I have seen promising-sounding arrangements go badly. My instinct is to secure our current position first.',
      'Before we venture anything, I would want to understand what we stand to lose.',
      'The cautious entry into any new arrangement is one with conditions we can exit cleanly.',
    ],
    military: [
      'I would want to be certain of our strength before we show it.',
      'A fight begun without full information is a fight begun blind. Let us know more before we commit.',
      'I do not doubt our people. I doubt the wisdom of the moment. The same action at a better time may succeed where this one fails.',
      'The risks here are not fully visible to me yet. That is reason enough for restraint.',
    ],
    cultural: [
      'Changes of this kind are difficult to reverse. I would move carefully.',
      'I understand the arguments for openness. I do not dismiss them. But I would want to see the outcome before we fully embrace it.',
      'I confess I am less certain of my read on this than I would like to be.',
      'There is no harm in watching longer before committing. The settlement will not suffer from patience.',
    ],
    personal: [
      'I would not want to make a permanent decision on incomplete information.',
      'Perhaps the wisest course is the one that preserves the most options.',
      'I do not think speed serves us here. The situation will be clearer in a season.',
      'Acting hastily now may foreclose a better resolution that is not yet visible.',
    ],
    environmental: [
      'The safest path through hardship is to spend the least and hold the most.',
      'I would conserve what we have before attempting anything ambitious. We do not know how long this will last.',
      'We have survived difficulty before by being patient. That is my recommendation: patience.',
      'Hardship that is endured is better than hardship that is compounded by poor decisions.',
    ],
    company: [
      'The Company is watching. Now is not the time to draw their attention to anything that could be criticized.',
      'I would want any report to the Company to be something we are confident of, not something we hope is true.',
      'Our position here is still establishing itself. I am reluctant to do anything that tests confidence before we have fully earned it.',
      'The Company\'s patience is not unlimited. Neither is our margin for error.',
    ],
    immigration: [
      'I would know why they are leaving before I commit to taking them in. People flee for reasons.',
      'A stranger at the gate is a question mark. I am in no hurry to answer it hastily.',
      'The settlement\'s stability is worth more than a faster population count. Let us be careful who we add to it.',
      'I am not opposed to immigration. I am opposed to accepting people before we understand what we are accepting.',
    ],
  },

  schemer: {
    diplomacy: [
      'Every delegation wants something they have not said aloud. Find that, and you hold the hand.',
      'They came to us with an offer. The question is: what is the counteroffer they are hoping we will not make?',
      'I never take a first position at face value. Neither should you.',
      'Note what they emphasize. Note what they omit. The omissions are more interesting.',
    ],
    domestic: [
      'Unrest does not appear from nowhere. Someone is feeding it. Find them.',
      'The surface issue is almost never the real one. I would want to know who benefits from this situation continuing.',
      'There are a great many things that can be resolved quietly if you know the right pressure to apply.',
      'Discontent this visible has already been organized. The question is: by whom, and to what end.',
    ],
    economic: [
      'There is always a way to make an arrangement more favorable than it appears. You simply have to look for it.',
      'The stated terms are a starting position. Everything is negotiable.',
      'Our counterpart has wants they have not disclosed. Discovering them costs nothing and may be worth a great deal.',
      'I have never encountered a deal that could not be improved with a little careful inquiry.',
    ],
    military: [
      'A direct confrontation is the least interesting solution available to us.',
      'I have found that the right word in the right ear does more damage to an enemy than three engagements.',
      'Before we commit to anything, I would want to know what leverage we have that we are not currently using.',
      'Force is expensive. Managed information is cheap. Let us try the cheap option first.',
    ],
    cultural: [
      'Every cultural exchange is also an intelligence exchange. We learn their ways; they learn ours. Consider which of us comes out ahead.',
      'The question of who influences whom is decided quietly, over years. I would rather we be doing the influencing.',
      'Their customs are the key to their priorities. I am always glad to understand them better.',
      'Culture is negotiated, not fixed. That is more useful to us than most people admit.',
    ],
    personal: [
      'Everyone has something they want and something they fear. This situation will reveal both.',
      'The solution to most personal difficulties is to give the involved party a reason to want what you want.',
      'I would find out what this person values before deciding how to proceed. It always unlocks something.',
      'Handle this correctly and you will have an obligation owed to you. These are worth more than gold.',
    ],
    environmental: [
      'A crisis that affects everyone affects everyone differently. There are opportunities here for those who look for them.',
      'I would want to know what our neighbours\' situation is before committing to any course. Their weakness may be relevant.',
      'Even hardship can be managed in your favor, if you approach it correctly.',
      'Everyone else is reacting. We should be the ones acting.',
    ],
    company: [
      'A well-written letter is worth more than three seasons of good numbers.',
      'The Company\'s representative here is an individual with individual ambitions. I would want to understand them.',
      'Letters to Port Iron should be carefully composed. What is emphasized is as important as what is true.',
      'Company factors are people. People have preferences. We should know what theirs are.',
    ],
    immigration: [
      'Every new arrival is also a window into wherever they came from. I find that useful.',
      'The interesting question is not whether to take them in, but what they know and who they know.',
      'A person with connections in two worlds is worth more than their skills alone suggest.',
      'Someone chose to come to us rather than staying where they were. It is always worth finding out exactly why.',
    ],
  },
};

// ─── Skill Confidence Suffixes ────────────────────────────────────────────────

interface SkillSuffixSet {
  confident: string;
  measured: string;
  overconfident: string;
  hedge: string;
  neutral: string;
}

const SKILL_SUFFIXES: Record<VoiceArchetype, SkillSuffixSet> = {
  bold: {
    confident:     'I have handled arrangements like this before. I am not concerned.',
    measured:      'It is not without risk. But I would not want us to shrink from it.',
    overconfident: 'We will find a way through it. I have no doubt of that.',
    hedge:         'I will admit the difficulty, but I would rather face it than avoid it.',
    neutral:       'The stakes are clear. The choice should not take long.',
  },
  pragmatist: {
    confident:     'The numbers are in our favor. I am comfortable with this.',
    measured:      'It carries risk, but a manageable one. The return justifies the exposure.',
    overconfident: 'We will make it work. We always do.',
    hedge:         'The margins are tighter than I would like, but the opportunity is real.',
    neutral:       'What matters is that we understand the cost before we commit.',
  },
  diplomat: {
    confident:     'I have navigated situations like this before. I believe we can reach a good outcome.',
    measured:      'It requires care, but the goodwill we build here is worth the effort.',
    overconfident: 'I am confident we can make this work if we approach it with the right spirit.',
    hedge:         'I confess I am less certain of my read on this than I would like.',
    neutral:       'Whatever we decide, we should be certain it is something we can stand behind.',
  },
  traditionalist: {
    confident:     'This is familiar ground. I have seen it resolved well by holding to established practice.',
    measured:      'It requires care, but the path is clear if we do not deviate from what we know works.',
    overconfident: 'We have faced this before and come through. We will again.',
    hedge:         'I would move carefully. The situation is less certain than I would wish.',
    neutral:       'The right path is the one we can describe plainly to anyone who asks.',
  },
  cautious: {
    confident:     'In this particular matter, I believe we are on solid ground. That is not always my position.',
    measured:      'It is not without risk, but it is manageable if we proceed with appropriate care.',
    overconfident: 'I confess I am less certain of my read on this than I would like.',
    hedge:         'I confess I am less certain of my read on this than I would like. I would take the more conservative route.',
    neutral:       'I would want to preserve our options for as long as possible.',
  },
  schemer: {
    confident:     'I have handled arrangements of this kind before. Leave the details to me.',
    measured:      'The position is workable. I can see the lines if you give me room to work them.',
    overconfident: 'I have been in tighter situations than this and come out well placed.',
    hedge:         'The pieces are not fully aligned yet, but I believe they can be.',
    neutral:       'The useful question here is not what is right. It is what works.',
  },
};


// ─── Main Entry Point ─────────────────────────────────────────────────────────

/**
 * Generates in-character advice text for one council member reacting to an event.
 *
 * @param person  The council member generating the opinion.
 * @param event   The current event being decided.
 * @param seed    Deterministic seed (use hashPersonEvent). Controls template selection.
 * @returns       A 2–3 sentence string in the adviser's voice.
 */
export function generateAdvice(person: Person, event: GameEvent, seed: number): string {
  const archetype = getVoiceArchetype(person.traits);

  // Find the choice this person would most prefer (implicit recommendation)
  const bestChoice = event.choices.reduce<EventChoice | null>((best, choice) => {
    if (!best) return choice;
    return scoreChoiceForPerson(person, choice) >= scoreChoiceForPerson(person, best)
      ? choice
      : best;
  }, null);

  // Pick opening fragment via seed
  const templates = ADVICE_TEMPLATES[archetype][event.category];
  const opening = templates[seed % templates.length];

  // Determine skill-confidence suffix
  const suffixes = SKILL_SUFFIXES[archetype];
  let suffix: string;

  if (!bestChoice?.skillCheck) {
    suffix = suffixes.neutral;
  } else {
    const personScore = getPersonSkillScore(person, bestChoice.skillCheck.skill);
    const difficulty = bestChoice.skillCheck.difficulty;

    if (personScore >= difficulty + 20) {
      suffix = suffixes.confident;
    } else if (personScore >= difficulty) {
      suffix = suffixes.measured;
    } else {
      // Under difficulty — Bold/Pragmatist/Schemer overconfide; Cautious/Traditionalist/Diplomat hedge
      if (archetype === 'bold' || archetype === 'pragmatist' || archetype === 'schemer') {
        suffix = suffixes.overconfident;
      } else {
        suffix = suffixes.hedge;
      }
    }
  }

  return `${opening} ${suffix}`;
}

// ─── Council Event Deck Boosts ────────────────────────────────────────────────

/**
 * Computes per-category event-deck weight boosts driven by the composition
 * of the Expedition Council.
 *
 * A council stacked with a particular faction or cultural background steers
 * the narrative toward that faction's concerns — wheel-devotee councillors
 * surface more religious events; a merchant-heavy council draws more trade
 * and economic crises.
 *
 * The result is merged with `computeTraitCategoryBoosts` in processDawn and
 * passed as `weightBoosts` to `drawEvents()`. Individual boosts are capped at
 * +0.30 so no single composition floods the deck with one category.
 *
 * @param councilMemberIds  IDs of the 7 (or fewer) seated council members.
 * @param people            Current living population map.
 * @param factions          Current active factions.
 * @returns Partial map of EventCategory → additive weight multiplier.
 */
export function computeCouncilEventBoosts(
  councilMemberIds: string[],
  people: Map<string, Person>,
  factions: Faction[],
): Partial<Record<EventCategory, number>> {
  const boosts: Partial<Record<EventCategory, number>> = {};

  const addBoost = (cat: EventCategory, amount: number): void => {
    boosts[cat] = Math.min(0.30, (boosts[cat] ?? 0) + amount);
  };

  const councilPeople = councilMemberIds
    .map(id => people.get(id))
    .filter((p): p is Person => p !== undefined);

  if (councilPeople.length === 0) return boosts;

  // Count how many council members belong to each faction type
  const factionCounts = new Map<FactionType, number>();
  for (const faction of factions) {
    const count = councilPeople.filter(p => faction.memberIds.includes(p.id)).length;
    if (count > 0) factionCounts.set(faction.type, count);
  }

  // Religious/cultural events dominated by Wheel-devoted councillors
  if ((factionCounts.get('wheel_devotees') ?? 0) >= 3) {
    addBoost('cultural', 0.20);
  }

  // Cultural & domestic events dominated by cultural-preservationist councillors
  if ((factionCounts.get('cultural_preservationists') ?? 0) >= 3) {
    addBoost('cultural', 0.20);
    addBoost('domestic', 0.10);
  }

  // Economic events dominated by merchant-bloc councillors
  if ((factionCounts.get('merchant_bloc') ?? 0) >= 3) {
    addBoost('economic', 0.25);
  }

  // Domestic/community events with a strong elder presence
  if ((factionCounts.get('community_elders') ?? 0) >= 2) {
    addBoost('domestic', 0.15);
  }

  // Company/diplomatic events with a predominantly Imanian council
  const imanianCount = councilPeople.filter(p => {
    const frac = p.heritage.bloodline.find(b => b.group === 'imanian')?.fraction ?? 0;
    return frac >= 0.5;
  }).length;
  if (imanianCount >= 4) {
    addBoost('company', 0.15);
  }

  return boosts;
}

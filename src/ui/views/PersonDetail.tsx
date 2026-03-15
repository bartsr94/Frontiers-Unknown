/**
 * PersonDetail — full detail panel for an individual person.
 *
 * Sections (top to bottom):
 *   • Portrait + basic identity (name, nickname, sex, age, role)
 *   • Bloodline bar — coloured horizontal segments by ethnic group fraction
 *   • Trait badges  — personality / aptitude / cultural / earned
 *   • Health        — conditions and pregnancy
 *   • Languages     — spoken languages with fluency bar
 *   • Family        — spouses, parents, children as clickable names
 *   • Family tree   — embedded FamilyTree component
 *
 * Props:
 *   personId  — ID of the Person to display
 *   onClose   — called when the panel should be dismissed
 *   onNavigate — optional: called when the user clicks a family member
 *                (defaults to nothing if not provided)
 */

import { useState } from 'react';
import { useGameStore } from '../../stores/game-store';
import Portrait from '../components/Portrait';
import FamilyTree from './FamilyTree';
import { CULTURE_LABELS } from '../../simulation/population/culture';
import type { EthnicGroup, HouseholdRole, SchemeType } from '../../simulation/population/person';
import { getSkillRating, getDerivedSkill } from '../../simulation/population/person';
import type { SkillId, DerivedSkillId, SkillRating } from '../../simulation/population/person';
import type { TraitId } from '../../simulation/personality/traits';
import { TRAIT_DEFINITIONS } from '../../data/trait-definitions';
import { ROLE_LABELS, ROLE_COLORS } from '../shared/role-display';
import { getAmbitionLabel, getAmbitionIntensityClass } from '../../simulation/population/ambitions';
import { computeOpinionBreakdown, getEffectiveOpinion } from '../../simulation/population/opinions';
import { computeHappiness, computeHappinessFactors, getHappinessLabel, getHappinessColor } from '../../simulation/population/happiness';

// ─── Bloodline colours ────────────────────────────────────────────────────────

const GROUP_COLORS: Record<EthnicGroup, string> = {
  imanian:              '#c8a87e',
  kiswani_riverfolk:    '#7eb0a0',
  kiswani_bayuk:        '#4a8c7c',
  kiswani_haisla:       '#6aa88c',
  hanjoda_stormcaller:  '#9ab0c4',
  hanjoda_bloodmoon:    '#c47070',
  hanjoda_talon:        '#808090',
  hanjoda_emrasi:       '#a8906c',
};

const GROUP_LABELS: Record<EthnicGroup, string> = {
  imanian:              'Imanian',
  kiswani_riverfolk:    'Kiswani (Riverfolk)',
  kiswani_bayuk:        'Kiswani (Bayuk)',
  kiswani_haisla:       'Kiswani (Haisla)',
  hanjoda_stormcaller:  'Hanjoda (Stormcaller)',
  hanjoda_bloodmoon:    'Hanjoda (Bloodmoon)',
  hanjoda_talon:        'Hanjoda (Talon)',
  hanjoda_emrasi:       'Hanjoda (Emrasi)',
};

// ─── Trait badge display ─────────────────────────────────────────────────────

/** CSS classes per trait category. */
const CATEGORY_COLORS: Record<string, string> = {
  personality:   'bg-amber-900/70 text-amber-200',
  aptitude:      'bg-blue-950/70 text-blue-300',
  cultural:      'bg-stone-700/80 text-stone-300',
  earned:        'bg-emerald-950/70 text-emerald-300',
  relationship:  'bg-violet-950/70 text-violet-300',
  mental_state:  'bg-yellow-900/70 text-yellow-200',
};

/** Returns the display label for a trait, falling back to a title-cased ID. */
function traitLabel(id: TraitId): string {
  const def = TRAIT_DEFINITIONS[id];
  if (def) return def.name;
  // Fallback: replace underscores with spaces and title-case each word.
  return id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/** Returns the CSS colour classes for a trait badge. */
function traitColor(id: TraitId): string {
  const category = TRAIT_DEFINITIONS[id]?.category;
  return CATEGORY_COLORS[category ?? ''] ?? 'bg-stone-700 text-stone-300';
}

/** Returns a human-readable verb phrase for a scheme type. */
function schemeTypeLabel(type: SchemeType): string {
  switch (type) {
    case 'scheme_court_person':     return 'Courting';
    case 'scheme_convert_faith':    return 'Converting';
    case 'scheme_befriend_person':  return 'Befriending';
    case 'scheme_undermine_person': return 'Undermining';
    case 'scheme_tutor_person':     return 'Tutoring';
  }
}
// ─── Skill display helpers ───────────────────────────────────────────────────────

const BASE_SKILLS: Array<{ id: SkillId; label: string }> = [
  { id: 'animals',     label: 'Animals' },
  { id: 'bargaining',  label: 'Bargaining' },
  { id: 'combat',      label: 'Combat' },
  { id: 'custom',      label: 'Custom' },
  { id: 'leadership',  label: 'Leadership' },
  { id: 'plants',      label: 'Plants' },
];

const DERIVED_SKILLS: Array<{ id: DerivedSkillId; label: string }> = [
  { id: 'deception',   label: 'Deception' },
  { id: 'diplomacy',   label: 'Diplomacy' },
  { id: 'exploring',   label: 'Exploring' },
  { id: 'farming',     label: 'Farming' },
  { id: 'hunting',     label: 'Hunting' },
  { id: 'poetry',      label: 'Poetry' },
  { id: 'strategy',    label: 'Strategy' },
];

const RATING_LABELS: Record<SkillRating, string> = {
  fair:      'Fair',
  good:      'Good',
  very_good: 'Very Good',
  excellent: 'Excellent',
  renowned:  'Renowned',
  heroic:    'Heroic',
};

const RATING_BAR_CLASS: Record<SkillRating, string> = {
  fair:      'bg-slate-400',
  good:      'bg-green-500',
  very_good: 'bg-teal-500',
  excellent: 'bg-blue-500',
  renowned:  'bg-purple-500',
  heroic:    'bg-amber-400',
};

const RATING_TEXT_CLASS: Record<SkillRating, string> = {
  fair:      'text-slate-400',
  good:      'text-green-400',
  very_good: 'text-teal-400',
  excellent: 'text-blue-400',
  renowned:  'text-purple-400',
  heroic:    'text-amber-400',
};

const RATING_ABBR: Record<SkillRating, string> = {
  fair:      'FR',
  good:      'GD',
  very_good: 'VG',
  excellent: 'EX',
  renowned:  'RN',
  heroic:    'HR',
};

const RATING_BORDER_CLASS: Record<SkillRating, string> = {
  fair:      'border-l-slate-500',
  good:      'border-l-green-600',
  very_good: 'border-l-teal-500',
  excellent: 'border-l-blue-500',
  renowned:  'border-l-purple-500',
  heroic:    'border-l-amber-400',
};
// ─── Section components ───────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-2 mt-4 first:mt-0">
      <h3 className="text-stone-500 font-semibold text-[10px] uppercase tracking-widest shrink-0">
        {children}
      </h3>
      <div className="flex-1 h-px bg-stone-700" />
    </div>
  );
}

function Divider() {
  return <div className="border-t border-stone-700 my-3" />;
}

// ─── Main component ───────────────────────────────────────────────────────────

interface PersonDetailProps {
  personId: string;
  onClose: () => void;
  /** Called when the user navigates to a linked person. If omitted, navigation does nothing. */
  onNavigate?: (id: string) => void;
}

export default function PersonDetail({ personId, onClose, onNavigate }: PersonDetailProps) {
  const [showTree, setShowTree] = useState(false);

  const person = useGameStore(s => s.gameState?.people.get(personId));
  const graveyard = useGameStore(s => s.gameState?.graveyard ?? []);
  const people    = useGameStore(s => s.gameState?.people);
  const households = useGameStore(s => s.gameState?.households);
  const gameState = useGameStore(s => s.gameState);
  const currentPhase = useGameStore(s => s.currentPhase);
  const assignKethThara = useGameStore(s => s.assignKethThara);

  if (!person) {
    return (
      <aside className="w-72 flex-shrink-0 bg-stone-900 border-l border-stone-700 p-4 flex flex-col">
        <button onClick={onClose} className="text-stone-400 hover:text-stone-200 text-xs mb-4 self-start">
          ← Close
        </button>
        <p className="text-stone-500 italic text-sm">Person not found.</p>
      </aside>
    );
  }

  /** Resolve a person ID to a display name, checking living and graveyard. */
  function nameOf(id: string): string {
    const living = people?.get(id);
    if (living) return `${living.firstName} ${living.familyName}`;
    const dead = graveyard.find(g => g.id === id);
    if (dead)  return `${dead.firstName} ${dead.familyName} †`;
    return 'Unknown';
  }

  function navigateTo(id: string) {
    onNavigate?.(id);
  }

  const [motherId, fatherId] = person.parentIds;

  // ── Health label helpers ──────────────────────────────────────────────────

  const conditionLabels: Record<string, string> = {
    wounded:         'Wounded',
    ill:             'Ill',
    malnourished:    'Malnourished',
    recovering:      'Recovering',
    chronic_illness: 'Chronic Illness',
    frail:           'Frail',
  };

  const conditionColors: Record<string, string> = {
    wounded:         'bg-red-900 text-red-200',
    ill:             'bg-orange-900 text-orange-200',
    malnourished:    'bg-yellow-900 text-yellow-300',
    recovering:      'bg-teal-900 text-teal-200',
    chronic_illness: 'bg-orange-950 text-orange-400',
    frail:           'bg-stone-700 text-stone-400',
  };

  // ── Religion label ────────────────────────────────────────────────────────
  const religionLabels: Record<string, string> = {
    imanian_orthodox:       'Imanian Orthodox',
    sacred_wheel:           'Sacred Wheel',
    syncretic_hidden_wheel: 'Hidden Wheel (syncretic)',
  };

  // ── Culture label ─────────────────────────────────────────────────────────
  const cultureLabels = CULTURE_LABELS;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
<aside className="w-full flex-shrink-0 bg-stone-900 border-l border-stone-700 flex flex-col overflow-hidden">

      {/* ── Header bar ── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-stone-700 bg-stone-950">
        <span className="font-display text-amber-300 font-semibold text-sm truncate">
          {person.firstName} {person.familyName}
          {person.nickname && (
            <span className="text-stone-400 font-normal ml-1">"{person.nickname}"</span>
          )}
        </span>
        <button
          onClick={onClose}
          className="text-stone-500 hover:text-stone-200 text-lg leading-none ml-2 flex-shrink-0"
          aria-label="Close detail panel"
        >
          ×
        </button>
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-0">

        {/* Portrait with identity fields inlined to the right when a photo is available */}
        <Portrait person={person} variant="lg">
          <div className="grid grid-cols-2 gap-y-1 text-xs">
            <span className="text-stone-500">Age</span>
            <span className="text-stone-200">{person.age.toFixed(1)} years</span>

            <span className="text-stone-500">Sex</span>
            <span className={person.sex === 'female' ? 'text-rose-300' : 'text-sky-300'}>
              {person.sex === 'female' ? '♀ Female' : '♂ Male'}
            </span>

            <span className="text-stone-500">Role</span>
            <span>
              <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${ROLE_COLORS[person.role]}`}>
                {ROLE_LABELS[person.role]}
              </span>
            </span>

            <span className="text-stone-500">Status</span>
            <span className="text-stone-300 capitalize">{person.socialStatus.replace(/_/g, ' ')}</span>

            <span className="text-stone-500">Culture</span>
            <span className="text-stone-300">{cultureLabels[person.heritage.primaryCulture] ?? person.heritage.primaryCulture}</span>

            <span className="text-stone-500">Religion</span>
            <span className="text-stone-300">{religionLabels[person.religion] ?? person.religion}</span>

            <span className="text-stone-500">Health</span>
            <span className={person.health.currentHealth > 70 ? 'text-green-300' : person.health.currentHealth > 40 ? 'text-yellow-300' : 'text-red-400'}>
              {person.health.currentHealth}/100
            </span>
          </div>
          {person.genetics.extendedFertility && person.sex === 'female' && (
            <span
              className="text-amber-500 text-xs font-medium mt-1"
              title="Kethara's Bargain — extended fertility through the maternal line"
            >
              ✦ Kethara's Bargain
            </span>
          )}
        </Portrait>

        <Divider />

        {/* Bloodline bar */}
        <SectionHeading>Heritage</SectionHeading>
        <div className="flex h-4 rounded overflow-hidden border border-stone-700 mb-2">
          {person.heritage.bloodline
            .filter(e => e.fraction > 0.005)
            .sort((a, b) => b.fraction - a.fraction)
            .map(entry => (
              <div
                key={entry.group}
                style={{
                  width: `${(entry.fraction * 100).toFixed(1)}%`,
                  backgroundColor: GROUP_COLORS[entry.group],
                }}
                title={`${GROUP_LABELS[entry.group]}: ${(entry.fraction * 100).toFixed(0)}%`}
              />
            ))}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-stone-400">
          {person.heritage.bloodline
            .filter(e => e.fraction > 0.005)
            .sort((a, b) => b.fraction - a.fraction)
            .map(entry => (
              <span key={entry.group} className="flex items-center gap-1">
                <span
                  className="inline-block w-2 h-2 rounded-sm"
                  style={{ backgroundColor: GROUP_COLORS[entry.group] }}
                />
                {GROUP_LABELS[entry.group]} {(entry.fraction * 100).toFixed(0)}%
              </span>
            ))}
        </div>

        <Divider />

        {/* Cultural Fluency */}
        {(() => {
          const secondaryCultures = Array.from(person.heritage.culturalFluency.entries())
            .filter(([cid, val]) => val > 0.05 && cid !== person.heritage.primaryCulture)
            .sort((a, b) => b[1] - a[1]);
          return (
            <>
              <SectionHeading>Cultural Fluency</SectionHeading>
              {/* Primary culture — always shown first at full bar */}
              <div className="flex flex-col gap-1 mb-1">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-teal-200 w-36 truncate">
                    {cultureLabels[person.heritage.primaryCulture] ?? person.heritage.primaryCulture}
                  </span>
                  <div className="flex-1 h-1.5 bg-stone-700 rounded overflow-hidden">
                    <div
                      className="h-full bg-teal-600 rounded"
                      style={{ width: `${((person.heritage.culturalFluency.get(person.heritage.primaryCulture) ?? 1.0) * 100).toFixed(0)}%` }}
                    />
                  </div>
                  <span className="text-stone-500 w-8 text-right">
                    {((person.heritage.culturalFluency.get(person.heritage.primaryCulture) ?? 1.0) * 100).toFixed(0)}%
                  </span>
                </div>
                {/* Secondary cultures */}
                {secondaryCultures.map(([cid, val]) => (
                  <div key={cid} className="flex items-center gap-2 text-xs">
                    <span className="text-stone-400 w-36 truncate">
                      {cultureLabels[cid] ?? cid}
                    </span>
                    <div className="flex-1 h-1.5 bg-stone-700 rounded overflow-hidden">
                      <div
                        className="h-full bg-teal-800 rounded"
                        style={{ width: `${(val * 100).toFixed(0)}%` }}
                      />
                    </div>
                    <span className="text-stone-500 w-8 text-right">{(val * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
              <Divider />
            </>
          );
        })()}

        {/* Traits */}
        <SectionHeading>Traits</SectionHeading>
        {person.traits.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 mb-1">
            {person.traits.map(traitId => (
              <span
                key={traitId}
                className={`inline-block px-2 py-0.5 rounded text-xs font-medium cursor-help ${traitColor(traitId)}`}
                title={TRAIT_DEFINITIONS[traitId]?.description}
              >
                {traitLabel(traitId)}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-stone-500 italic text-xs mb-1">No account kept.</p>
        )}

        {/* Ambition badge */}
        {person.ambition && (
          <div className="mt-2 mb-1 flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${getAmbitionIntensityClass(person.ambition.intensity)}`}
              title={`Intensity: ${(person.ambition.intensity * 100).toFixed(0)}%`}
            >
              ✦ {getAmbitionLabel(person.ambition)}
            </span>
            <div
              className="flex-1 h-1 bg-stone-800 rounded overflow-hidden"
              title="Ambition intensity"
            >
              <div
                className="h-full rounded bg-amber-700"
                style={{ width: `${(person.ambition.intensity * 100).toFixed(0)}%` }}
              />
            </div>
          </div>
        )}

        {/* Pursuing — active scheme indicator */}
        {person.activeScheme && (
          <div className="mt-1 mb-1">
            {!person.activeScheme.revealedToPlayer ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-900 text-amber-200 border border-amber-700">
                ● This person is quietly pursuing something…
              </span>
            ) : (
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-stone-800 text-stone-300 border border-stone-600">
                  {schemeTypeLabel(person.activeScheme.type)}{' '}
                  {people?.get(person.activeScheme.targetId)?.firstName ?? '(unknown)'}
                </span>
                <div
                  className="flex-1 h-1 bg-stone-800 rounded overflow-hidden"
                  title={`Scheme progress: ${(person.activeScheme.progress * 100).toFixed(0)}%`}
                >
                  <div
                    className="h-full rounded bg-purple-600"
                    style={{ width: `${(person.activeScheme.progress * 100).toFixed(0)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        <Divider />

        {/* Skills — compact 3-column chip grid */}
        <SectionHeading>Skills</SectionHeading>
        <div className="grid grid-cols-3 gap-1 mb-1">
          {BASE_SKILLS.map(({ id, label }) => {
            const value = person.skills[id];
            const rating = getSkillRating(value);
            return (
              <div
                key={id}
                className={`flex items-center justify-between px-2 py-1 rounded bg-stone-800 border-l-4 ${RATING_BORDER_CLASS[rating]}`}
                title={`${label}: ${RATING_LABELS[rating]} (${value})`}
              >
                <span className="text-stone-300 text-[11px] truncate">{label}</span>
                <span className={`text-[11px] font-bold ml-1 flex-shrink-0 ${RATING_TEXT_CLASS[rating]}`}>
                  {RATING_ABBR[rating]}
                </span>
              </div>
            );
          })}
        </div>
        <p className="text-stone-600 text-[9px] uppercase tracking-wider mt-1.5 mb-1">Derived</p>
        <div className="grid grid-cols-3 gap-1 mb-1">
          {DERIVED_SKILLS.map(({ id, label }) => {
            const value = getDerivedSkill(person.skills, id);
            const rating = getSkillRating(value);
            return (
              <div
                key={id}
                className={`flex items-center justify-between px-2 py-1 rounded bg-stone-800/60 border-l-4 ${RATING_BORDER_CLASS[rating]}`}
                title={`${label}: ${RATING_LABELS[rating]} (${value})`}
              >
                <span className="text-stone-400 text-[11px] truncate">{label}</span>
                <span className={`text-[11px] font-bold ml-1 flex-shrink-0 ${RATING_TEXT_CLASS[rating]}`}>
                  {RATING_ABBR[rating]}
                </span>
              </div>
            );
          })}
        </div>
        <Divider />

        {/* Health conditions */}
        {person.health.conditions.length > 0 && (
          <>
            <SectionHeading>Conditions</SectionHeading>
            <div className="flex flex-wrap gap-1.5 mb-1">
              {person.health.conditions.map(cond => (
                <span
                  key={cond}
                  className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${conditionColors[cond] ?? 'bg-stone-700 text-stone-300'}`}
                >
                  {conditionLabels[cond] ?? cond}
                </span>
              ))}
            </div>
            <Divider />
          </>
        )}

        {/* Pregnancy */}
        {person.health.pregnancy && (
          <>
            <SectionHeading>Pregnancy</SectionHeading>
            <p className="text-stone-300 text-xs mb-1">
              Expecting — due turn {person.health.pregnancy.dueDate}
            </p>
            <Divider />
          </>
        )}

        {/* Languages */}
        {person.languages.length > 0 && (
          <>
            <SectionHeading>Languages</SectionHeading>
            <div className="flex flex-col gap-1 mb-1">
              {person.languages.map(lang => (
                <div key={lang.language} className="flex items-center gap-2 text-xs">
                  <span className="text-stone-300 w-36 capitalize">{lang.language.replace(/_/g, ' ')}</span>
                  <div className="flex-1 h-1.5 bg-stone-700 rounded overflow-hidden">
                    <div
                      className="h-full bg-amber-600 rounded"
                      style={{ width: `${(lang.fluency * 100).toFixed(0)}%` }}
                    />
                  </div>
                  <span className="text-stone-500 w-8 text-right">{(lang.fluency * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
            <Divider />
          </>
        )}

        {/* Happiness */}
        {gameState && (() => {
          const score   = computeHappiness(person, gameState);
          const factors = computeHappinessFactors(person, gameState).filter(f => f.delta !== 0);
          factors.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
          const tooltip = factors.length > 0
            ? factors.map(f => `${f.label}: ${f.delta > 0 ? '+' : ''}${f.delta}`).join('\n')
            : 'No factors';
          return (
            <>
              <SectionHeading>Happiness</SectionHeading>
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={`font-bold text-sm cursor-help ${getHappinessColor(score)}`}
                  title={tooltip}
                >
                  {score > 0 ? '+' : ''}{score}
                </span>
                <span
                  className={`text-xs cursor-help ${getHappinessColor(score)}`}
                  title={tooltip}
                >
                  {getHappinessLabel(score)}
                </span>
                {person.lowHappinessTurns > 0 && (
                  <span className="text-xs text-red-400 ml-auto" title="Consecutive turns at crisis level">
                    ⚠ {person.lowHappinessTurns}t at crisis
                  </span>
                )}
              </div>
              <Divider />
            </>
          );
        })()}

        {/* Key Opinions */}
        {(() => {
          // Gather all targets from base relationships AND active timed modifiers.
          const allTargetIds = new Set<string>([
            ...person.relationships.keys(),
            ...(person.opinionModifiers ?? []).map(m => m.targetId),
          ]);
          const opinionEntries = Array.from(allTargetIds)
            .map(id => ({ id, score: getEffectiveOpinion(person, id) }))
            .filter(e => e.score !== 0)
            .filter(e => nameOf(e.id) !== 'Unknown');

          const positives = opinionEntries
            .filter(e => e.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 3);
          const negatives = opinionEntries
            .filter(e => e.score < 0)
            .sort((a, b) => a.score - b.score)
            .slice(0, 3);

          if (positives.length === 0 && negatives.length === 0) {
            return null;
          }

          return (
            <>
              <SectionHeading>Standing Among Kin</SectionHeading>
              <div className="flex flex-col gap-1.5 mb-1 text-xs">
                {positives.length > 0 && (
                  <div>
                    <span className="text-stone-500 text-xs">Favours:</span>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {positives.map(({ id, score }) => {
                        const target = people?.get(id);
                        const tooltip = target
                          ? computeOpinionBreakdown(person, target)
                              .map(({ label, delta, turnsRemaining }) => {
                                const suffix = turnsRemaining !== undefined ? ` (${turnsRemaining}t)` : '';
                                return `${label}: ${delta > 0 ? '+' : ''}${delta}${suffix}`;
                              })
                              .join('\n')
                          : 'Person no longer in settlement';
                        return (
                          <button
                            key={id}
                            onClick={() => navigateTo(id)}
                            title={tooltip}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-green-950 text-green-300 hover:bg-green-900 underline decoration-dotted"
                          >
                            {nameOf(id)}
                            <span className="text-green-500 font-semibold">+{score}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {negatives.length > 0 && (
                  <div>
                    <span className="text-stone-500 text-xs">Dislikes:</span>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {negatives.map(({ id, score }) => {
                        const target = people?.get(id);
                        const tooltip = target
                          ? computeOpinionBreakdown(person, target)
                              .map(({ label, delta, turnsRemaining }) => {
                                const suffix = turnsRemaining !== undefined ? ` (${turnsRemaining}t)` : '';
                                return `${label}: ${delta > 0 ? '+' : ''}${delta}${suffix}`;
                              })
                              .join('\n')
                          : 'Person no longer in settlement';
                        return (
                          <button
                            key={id}
                            onClick={() => navigateTo(id)}
                            title={tooltip}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-950 text-red-300 hover:bg-red-900 underline decoration-dotted"
                          >
                            {nameOf(id)}
                            <span className="text-red-500 font-semibold">{score}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              <Divider />
            </>
          );
        })()}

        {/* Bonds — Named Relationships */}
        {person.namedRelationships.length > 0 && (() => {
          const BOND_COLORS: Record<string, string> = {
            friend:    'bg-green-950 text-green-300 hover:bg-green-900',
            confidant: 'bg-emerald-950 text-emerald-300 hover:bg-emerald-900',
            mentor:    'bg-sky-950 text-sky-300 hover:bg-sky-900',
            student:   'bg-sky-950 text-sky-300 hover:bg-sky-900',
            rival:     'bg-orange-950 text-orange-300 hover:bg-orange-900',
            nemesis:   'bg-red-950 text-red-300 hover:bg-red-900',
          };
          const BOND_ICONS: Record<string, string> = {
            friend: '🤝', confidant: '🫂', mentor: '📖', student: '🧑‍🎓',
            rival: '⚔', nemesis: '💀',
          };

          return (
            <>
              <SectionHeading>Bonds</SectionHeading>
              <div className="flex flex-wrap gap-1 mb-1 text-xs">
                {person.namedRelationships.map(rel => {
                  const colorClass = BOND_COLORS[rel.type] ?? 'bg-stone-800 text-stone-300';
                  const icon = BOND_ICONS[rel.type] ?? '•';
                  const depthPct = Math.round(rel.depth * 100);
                  return (
                    <button
                      key={`${rel.type}-${rel.targetId}`}
                      onClick={() => navigateTo(rel.targetId)}
                      title={`${rel.type} — depth ${depthPct}%\nFormed turn ${rel.formedTurn}`}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded ${colorClass}`}
                    >
                      <span>{icon}</span>
                      <span className="capitalize">{rel.type}</span>
                      <span className="opacity-60">·</span>
                      <span>{nameOf(rel.targetId)}</span>
                      <span
                        className="ml-1 w-8 h-1 bg-stone-700 rounded-full overflow-hidden inline-block align-middle"
                        title={`Depth: ${depthPct}%`}
                      >
                        <span
                          className="block h-full bg-current rounded-full"
                          style={{ width: `${depthPct}%` }}
                        />
                      </span>
                    </button>
                  );
                })}
              </div>
              <Divider />
            </>
          );
        })()}

        {/* Family */}
        <SectionHeading>Family</SectionHeading>
        <div className="flex flex-col gap-1 text-xs mb-1">

          {/* Spouses */}
          {person.spouseIds.length > 0 && (
            <div>
              <span className="text-stone-500">{person.spouseIds.length === 1 ? 'Spouse' : 'Spouses'}:</span>
              {person.spouseIds.map(id => (
                <button
                  key={id}
                  onClick={() => navigateTo(id)}
                  className="ml-2 text-amber-300 hover:text-amber-100 underline decoration-dotted"
                >
                  {nameOf(id)}
                </button>
              ))}
            </div>
          )}

          {/* Parents */}
          {(motherId || fatherId) && (
            <div>
              <span className="text-stone-500">Parents:</span>
              {motherId && (
                <button
                  onClick={() => navigateTo(motherId)}
                  className="ml-2 text-rose-300 hover:text-rose-100 underline decoration-dotted"
                >
                  {nameOf(motherId)} (mother)
                </button>
              )}
              {fatherId && (
                <button
                  onClick={() => navigateTo(fatherId)}
                  className="ml-2 text-sky-300 hover:text-sky-100 underline decoration-dotted"
                >
                  {nameOf(fatherId)} (father)
                </button>
              )}
            </div>
          )}

          {/* Children */}
          {person.childrenIds.length > 0 && (
            <div>
              <span className="text-stone-500">Children ({person.childrenIds.length}):</span>
              <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5 ml-2">
                {person.childrenIds.map(id => (
                  <button
                    key={id}
                    onClick={() => navigateTo(id)}
                    className="text-teal-300 hover:text-teal-100 underline decoration-dotted"
                  >
                    {nameOf(id)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {person.spouseIds.length === 0 && !motherId && !fatherId && person.childrenIds.length === 0 && (
            <p className="text-stone-600 italic">No recorded family.</p>
          )}
        </div>

        <Divider />

        <Divider />

        {/* Household & Keth-Thara */}
        {(() => {
          const HOUSEHOLD_ROLE_LABELS: Record<HouseholdRole, string> = {
            head:              'Household Head',
            senior_wife:       'Senior Wife',
            wife:              'Wife',
            concubine:         'Concubine',
            hearth_companion:  'Hearth Companion',
            child:             'Child',
            thrall:            'Thrall',
          };
          const HOUSEHOLD_ROLE_COLORS: Record<HouseholdRole, string> = {
            head:              'text-amber-300',
            senior_wife:       'text-rose-300',
            wife:              'text-pink-300',
            concubine:         'text-purple-300',
            hearth_companion:  'text-violet-300',
            child:             'text-sky-300',
            thrall:            'text-stone-400',
          };

          const household = person.householdId ? households?.get(person.householdId) : null;

          const eligibleForKethThara =
            person.sex === 'male' &&
            person.age >= 16 &&
            person.age <= 24 &&
            person.spouseIds.length === 0 &&
            person.role !== 'away' &&
            person.role !== 'keth_thara';

          return (
            <>
              {household ? (
                <>
                  <SectionHeading>Household</SectionHeading>
                  <div className="flex flex-col gap-1 text-xs mb-2">
                    <div className="flex gap-2">
                      <span className="text-stone-500">Name</span>
                      <span className="text-amber-300 font-medium">{household.name}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-stone-500">Tradition</span>
                      <span className="text-stone-300 capitalize">{household.tradition}</span>
                    </div>
                    {person.householdRole && (
                      <div className="flex gap-2">
                        <span className="text-stone-500">Role</span>
                        <span className={`font-medium ${HOUSEHOLD_ROLE_COLORS[person.householdRole]}`}>
                          {HOUSEHOLD_ROLE_LABELS[person.householdRole]}
                        </span>
                      </div>
                    )}
                    {/* Co-members (not self) */}
                    {household.memberIds.filter(id => id !== personId).length > 0 && (
                      <div>
                        <span className="text-stone-500">Members: </span>
                        {household.memberIds
                          .filter(id => id !== personId)
                          .map(id => {
                            const m = people?.get(id);
                            if (!m) return null;
                            return (
                              <button
                                key={id}
                                onClick={() => navigateTo(id)}
                                className="mr-2 text-stone-300 hover:text-stone-100 underline decoration-dotted"
                              >
                                {m.firstName}
                                {m.householdRole && (
                                  <span className={`ml-0.5 text-[10px] ${HOUSEHOLD_ROLE_COLORS[m.householdRole]}`}>
                                    ({HOUSEHOLD_ROLE_LABELS[m.householdRole]})
                                  </span>
                                )}
                              </button>
                            );
                          })}
                      </div>
                    )}
                    {/* Ashka-Melathi bonds */}
                    {person.ashkaMelathiPartnerIds.length > 0 && (
                      <div>
                        <span className="text-rose-400">Ashka-Melathi with: </span>
                        {person.ashkaMelathiPartnerIds.map(id => (
                          <button
                            key={id}
                            onClick={() => navigateTo(id)}
                            className="mr-2 text-rose-300 hover:text-rose-100 underline decoration-dotted"
                          >
                            {nameOf(id)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : eligibleForKethThara && currentPhase === 'management' ? (
                <>
                  <SectionHeading>Keth-Thara</SectionHeading>
                  <p className="text-stone-400 text-xs mb-2">
                    {person.firstName} is eligible for the traditional season of service — wandering labour
                    that shapes Sauromatian young men before they may claim a hearth.
                  </p>
                  <button
                    onClick={() => assignKethThara(personId)}
                    className="w-full py-1 rounded text-xs bg-violet-900 text-violet-200 hover:bg-violet-800 font-medium"
                  >
                    Send on Keth-Thara Service
                  </button>
                </>
              ) : null}
            </>
          );
        })()}

        {/* Family tree toggle */}
        <button
          onClick={() => setShowTree(v => !v)}
          className="w-full text-left text-xs text-stone-400 hover:text-stone-200 flex items-center gap-1 mb-2"
        >
          <span className="text-stone-600">{showTree ? '▼' : '▶'}</span>
          {showTree ? 'Hide' : 'Show'} Family Tree
        </button>

        {showTree && (
          <FamilyTree
            rootPersonId={personId}
            onSelectPerson={id => {
              onNavigate?.(id);
            }}
          />
        )}

      </div>
    </aside>
  );
}

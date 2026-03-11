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
import type { EthnicGroup } from '../../simulation/population/person';
import type { TraitId } from '../../simulation/personality/traits';

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

// ─── Trait badge colours ──────────────────────────────────────────────────────

const TRAIT_COLORS: Record<string, string> = {
  // Positive personality
  ambitious: 'bg-amber-900 text-amber-200',
  brave: 'bg-amber-800 text-amber-100',
  kind: 'bg-teal-900 text-teal-200',
  generous: 'bg-teal-800 text-teal-200',
  patient: 'bg-sky-900 text-sky-200',
  honest: 'bg-sky-800 text-sky-200',
  humble: 'bg-stone-700 text-stone-200',
  gregarious: 'bg-lime-900 text-lime-200',
  // Negative personality
  cruel: 'bg-rose-950 text-rose-300',
  craven: 'bg-slate-800 text-slate-400',
  greedy: 'bg-yellow-950 text-yellow-400',
  deceitful: 'bg-red-950 text-red-400',
  wrathful: 'bg-red-900 text-red-200',
  proud: 'bg-purple-900 text-purple-200',
  shy: 'bg-stone-700 text-stone-400',
  content: 'bg-stone-700 text-stone-300',
  lustful: 'bg-pink-950 text-pink-300',
  chaste: 'bg-stone-600 text-stone-300',
  // Aptitude
  strong: 'bg-orange-900 text-orange-200',
  weak: 'bg-stone-700 text-stone-500',
  clever: 'bg-indigo-900 text-indigo-200',
  slow: 'bg-stone-700 text-stone-500',
  beautiful: 'bg-rose-900 text-rose-200',
  plain: 'bg-stone-700 text-stone-400',
  robust: 'bg-green-900 text-green-200',
  sickly: 'bg-stone-700 text-stone-500',
  fertile: 'bg-emerald-900 text-emerald-200',
  barren: 'bg-stone-700 text-stone-500',
  // Cultural
  traditional: 'bg-amber-950 text-amber-400',
  cosmopolitan: 'bg-cyan-900 text-cyan-200',
  devout: 'bg-violet-950 text-violet-300',
  skeptical: 'bg-slate-800 text-slate-300',
  xenophobic: 'bg-red-950 text-red-400',
  welcoming: 'bg-green-900 text-green-300',
  // Earned
  veteran: 'bg-stone-700 text-amber-300',
  scarred: 'bg-stone-800 text-stone-400',
  respected_elder: 'bg-yellow-900 text-yellow-200',
  scandal: 'bg-rose-950 text-rose-400',
  oath_breaker: 'bg-red-950 text-red-500',
  hero: 'bg-amber-800 text-amber-100',
  coward: 'bg-slate-900 text-slate-500',
  wealthy: 'bg-yellow-900 text-yellow-200',
  indebted: 'bg-orange-950 text-orange-400',
};

const TRAIT_LABELS: Record<TraitId, string> = {
  ambitious: 'Ambitious', content: 'Content', gregarious: 'Gregarious', shy: 'Shy',
  brave: 'Brave', craven: 'Craven', cruel: 'Cruel', kind: 'Kind',
  greedy: 'Greedy', generous: 'Generous', lustful: 'Lustful', chaste: 'Chaste',
  wrathful: 'Wrathful', patient: 'Patient', deceitful: 'Deceitful', honest: 'Honest',
  proud: 'Proud', humble: 'Humble',
  strong: 'Strong', weak: 'Weak', clever: 'Clever', slow: 'Slow',
  beautiful: 'Beautiful', plain: 'Plain', robust: 'Robust', sickly: 'Sickly',
  fertile: 'Fertile', barren: 'Barren',
  traditional: 'Traditional', cosmopolitan: 'Cosmopolitan', devout: 'Devout',
  skeptical: 'Skeptical', xenophobic: 'Xenophobic', welcoming: 'Welcoming',
  veteran: 'Veteran', scarred: 'Scarred', respected_elder: 'Respected Elder',
  scandal: 'Scandal', oath_breaker: 'Oath-Breaker', hero: 'Hero',
  coward: 'Coward', wealthy: 'Wealthy', indebted: 'Indebted',
};

// ─── Section components ───────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-amber-500 font-semibold text-xs uppercase tracking-wider mb-2">
      {children}
    </h3>
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
    irreligious:            'Irreligious',
  };

  // ── Culture label ─────────────────────────────────────────────────────────
  const cultureLabels = CULTURE_LABELS;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <aside className="w-80 flex-shrink-0 bg-stone-900 border-l border-stone-700 flex flex-col overflow-hidden">

      {/* ── Header bar ── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-stone-700 bg-stone-950">
        <span className="text-amber-300 font-semibold text-sm truncate">
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

        {/* Portrait + identity */}
        <Portrait person={person} variant="lg" />

        <Divider />

        {/* Identity block */}
        <div className="grid grid-cols-2 gap-y-1 text-xs text-stone-400">
          <span className="text-stone-500">Age</span>
          <span className="text-stone-200">{person.age.toFixed(1)} years</span>

          <span className="text-stone-500">Sex</span>
          <span className={person.sex === 'female' ? 'text-rose-300' : 'text-sky-300'}>
            {person.sex === 'female' ? '♀ Female' : '♂ Male'}
          </span>

          <span className="text-stone-500">Role</span>
          <span className="text-stone-200 capitalize">{person.role}</span>

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
                  <span className="text-teal-200 w-40 truncate">
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
                    <span className="text-stone-400 w-40 truncate">
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
        {person.traits.length > 0 && (
          <>
            <SectionHeading>Traits</SectionHeading>
            <div className="flex flex-wrap gap-1.5 mb-1">
              {person.traits.map(traitId => (
                <span
                  key={traitId}
                  className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${TRAIT_COLORS[traitId] ?? 'bg-stone-700 text-stone-300'}`}
                >
                  {TRAIT_LABELS[traitId] ?? traitId}
                </span>
              ))}
            </div>
            <Divider />
          </>
        )}

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
                  <span className="text-stone-300 w-28 capitalize">{lang.language.replace(/_/g, ' ')}</span>
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

        {/* Key Opinions */}
        {(() => {
          const entries = Array.from(person.relationships.entries());
          const positives = entries
            .filter(([, v]) => v > 0)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);
          const negatives = entries
            .filter(([, v]) => v < 0)
            .sort((a, b) => a[1] - b[1])
            .slice(0, 3);

          if (positives.length === 0 && negatives.length === 0) {
            return null;
          }

          return (
            <>
              <SectionHeading>Key Opinions</SectionHeading>
              <div className="flex flex-col gap-1.5 mb-1 text-xs">
                {positives.length > 0 && (
                  <div>
                    <span className="text-stone-500 text-xs">Favours:</span>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {positives.map(([id, score]) => (
                        <button
                          key={id}
                          onClick={() => navigateTo(id)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-green-950 text-green-300 hover:bg-green-900 underline decoration-dotted"
                        >
                          {nameOf(id)}
                          <span className="text-green-500 font-semibold">+{score}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {negatives.length > 0 && (
                  <div>
                    <span className="text-stone-500 text-xs">Dislikes:</span>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {negatives.map(([id, score]) => (
                        <button
                          key={id}
                          onClick={() => navigateTo(id)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-950 text-red-300 hover:bg-red-900 underline decoration-dotted"
                        >
                          {nameOf(id)}
                          <span className="text-red-500 font-semibold">{score}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
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

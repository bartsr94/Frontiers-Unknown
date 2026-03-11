/**
 * MarriageDialog — overlay for arranging marriages between eligible settlers.
 *
 * Shows two columns (eligible males / eligible females). Player selects one
 * from each side, then sees:
 *   • Compatibility notes (shared language, cultural distance)
 *   • Predicted child trait summary (skin range, eye colours, gender ratio)
 *   • Opinion impact preview (who approves/disapproves)
 *
 * Calls store.arrangeMarriage(maleId, femaleId) on confirmation.
 */

import { useState } from 'react';
import { useGameStore } from '../../stores/game-store';
import { skinToneColor } from '../components/Portrait';
import { heritageAbbr } from '../components/heritage-helpers';
import { canMarry, getMarriageability, getLanguageCompatibility } from '../../simulation/population/marriage';
import { averageBloodlines, blendTraitDistributions } from '../../simulation/genetics/inheritance';
import { resolveGenderRatio } from '../../simulation/genetics/gender-ratio';
import type { Person } from '../../simulation/population/person';

// ─── Mini helpers ─────────────────────────────────────────────────────────────

function SkinDot({ tone }: { tone: number }) {
  return (
    <span
      className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 border border-stone-600"
      style={{ backgroundColor: skinToneColor(tone) }}
      aria-hidden="true"
    />
  );
}

function HeritageBadge({ bloodline }: { bloodline: Person['heritage']['bloodline'] }) {
  return (
    <span className="inline-block px-1.5 py-0 rounded text-[9px] font-semibold bg-stone-700 text-stone-300 leading-tight">
      {heritageAbbr(bloodline)}
    </span>
  );
}

// ─── Person card in column ────────────────────────────────────────────────────

interface PersonColumnCardProps {
  person: Person;
  selected: boolean;
  onSelect: () => void;
}

function PersonColumnCard({ person, selected, onSelect }: PersonColumnCardProps) {
  const topTraits = person.traits.slice(0, 2);

  return (
    <button
      onClick={onSelect}
      className={[
        'flex items-center gap-2 w-full px-2 py-1.5 rounded border text-left text-xs transition-colors',
        selected
          ? 'border-amber-500 bg-amber-950 text-amber-100'
          : 'border-stone-600 bg-stone-800 text-stone-200 hover:bg-stone-700 hover:border-stone-500',
      ].join(' ')}
    >
      <SkinDot tone={person.genetics.visibleTraits.skinTone} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-semibold truncate">{person.firstName} {person.familyName}</span>
          <HeritageBadge bloodline={person.heritage.bloodline} />
        </div>
        <div className="flex items-center gap-1 text-stone-400 mt-0.5 flex-wrap">
          <span>age {Math.floor(person.age)}</span>
          {topTraits.map(t => (
            <span key={t} className="px-1 py-0 rounded bg-stone-700 text-stone-400 text-[9px] leading-tight">
              {t}
            </span>
          ))}
        </div>
      </div>
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface MarriageDialogProps {
  onClose: () => void;
}

export default function MarriageDialog({ onClose }: MarriageDialogProps) {
  const [selectedMaleId,   setSelectedMaleId]   = useState<string | null>(null);
  const [selectedFemaleId, setSelectedFemaleId] = useState<string | null>(null);

  const gameState      = useGameStore(s => s.gameState);
  const arrangeMarriage = useGameStore(s => s.arrangeMarriage);

  if (!gameState) return null;

  const allPeople = Array.from(gameState.people.values());

  // Build eligible lists
  const eligibleMales = allPeople.filter(p =>
    p.sex === 'male' && getMarriageability(p, gameState).isEligible,
  );
  const eligibleFemales = allPeople.filter(p =>
    p.sex === 'female' && getMarriageability(p, gameState).isEligible,
  );

  const selectedMale   = selectedMaleId   ? gameState.people.get(selectedMaleId)   : undefined;
  const selectedFemale = selectedFemaleId ? gameState.people.get(selectedFemaleId) : undefined;

  // Compatibility check
  const compatibility = selectedMale && selectedFemale
    ? canMarry(selectedMale, selectedFemale, gameState)
    : null;

  // Language compatibility
  const langCompat = selectedMale && selectedFemale
    ? getLanguageCompatibility(selectedMale, selectedFemale)
    : null;

  // Shared languages display (fluency labels)
  function sharedLanguages(a: Person, b: Person): string[] {
    const aLangs = new Set(a.languages.filter(l => l.fluency >= 0.3).map(l => l.language));
    return b.languages.filter(l => aLangs.has(l.language) && l.fluency >= 0.3).map(l => l.language);
  }

  // Cultural distance label
  function culturalDistanceLabel(a: Person, b: Person): string {
    // Approximate a "cultural blend" value from bloodline Sauromatian fraction
    const aBlend = a.heritage.bloodline.filter(e => e.group !== 'imanian').reduce((s, e) => s + e.fraction, 0);
    const bBlend = b.heritage.bloodline.filter(e => e.group !== 'imanian').reduce((s, e) => s + e.fraction, 0);
    const dist = Math.abs(aBlend - bBlend);
    if (dist < 0.2) return 'Close';
    if (dist < 0.5) return 'Some difference';
    return 'Very different';
  }

  // Child predictions
  const childPrediction = selectedMale && selectedFemale ? (() => {
    const childBloodline = averageBloodlines(
      selectedFemale.heritage.bloodline,
      selectedMale.heritage.bloodline,
    );
    const blended  = blendTraitDistributions(childBloodline);
    const maleRatio = resolveGenderRatio(selectedFemale, selectedMale);

    // Skin tone range: mean ± sqrt(variance)
    const st      = blended.skinTone;
    const stStd   = Math.sqrt(st.variance);
    const stLow   = Math.max(0, st.mean - stStd);
    const stHigh  = Math.min(1, st.mean + stStd);

    // Top 2 eye colours by weight
    const eyeEntries = Object.entries(blended.eyeColor.weights ?? {})
      .filter(([, w]) => (w ?? 0) > 0)
      .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
      .slice(0, 2);

    // Female:male ratio
    const femaleRatio = maleRatio > 0 ? ((1 - maleRatio) / maleRatio).toFixed(1) : '∞';

    return { stLow, stHigh, eyeEntries, femaleRatio, extendedFertility: selectedFemale.genetics.extendedFertility };
  })() : null;

  // Opinion impacts
  const opinionImpacts: Array<{ name: string; reaction: 'approve' | 'disapprove' }> = [];
  if (selectedMale && selectedFemale) {
    for (const person of allPeople) {
      if (person.id === selectedMale.id || person.id === selectedFemale.id) continue;
      if (person.traits.includes('traditional')) {
        opinionImpacts.push({ name: `${person.firstName} ${person.familyName}`, reaction: 'disapprove' });
      } else if (person.traits.includes('cosmopolitan')) {
        opinionImpacts.push({ name: `${person.firstName} ${person.familyName}`, reaction: 'approve' });
      }
      if (opinionImpacts.length >= 4) break;
    }
  }

  const canConfirm = !!compatibility?.allowed && !!selectedMale && !!selectedFemale;

  function handleConfirm() {
    if (!canConfirm || !selectedMaleId || !selectedFemaleId) return;
    arrangeMarriage(selectedMaleId, selectedFemaleId);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-stone-900 border border-amber-800 rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-stone-700 bg-stone-950">
          <h2 className="text-amber-300 font-bold text-base">Arrange Marriage</h2>
          <button
            onClick={onClose}
            className="text-stone-500 hover:text-stone-200 text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="p-5 space-y-5">

          {/* Two columns */}
          <div className="grid grid-cols-2 gap-4">

            {/* Males */}
            <div>
              <h3 className="text-sky-400 font-semibold text-xs uppercase tracking-wider mb-2">
                ♂ Eligible Men ({eligibleMales.length})
              </h3>
              <div className="flex flex-col gap-1 max-h-52 overflow-y-auto pr-1">
                {eligibleMales.length === 0 && (
                  <p className="text-stone-500 italic text-xs">No eligible men.</p>
                )}
                {eligibleMales.map(p => (
                  <PersonColumnCard
                    key={p.id}
                    person={p}
                    selected={selectedMaleId === p.id}
                    onSelect={() => setSelectedMaleId(id => id === p.id ? null : p.id)}
                  />
                ))}
              </div>
            </div>

            {/* Females */}
            <div>
              <h3 className="text-rose-400 font-semibold text-xs uppercase tracking-wider mb-2">
                ♀ Eligible Women ({eligibleFemales.length})
              </h3>
              <div className="flex flex-col gap-1 max-h-52 overflow-y-auto pr-1">
                {eligibleFemales.length === 0 && (
                  <p className="text-stone-500 italic text-xs">No eligible women.</p>
                )}
                {eligibleFemales.map(p => (
                  <PersonColumnCard
                    key={p.id}
                    person={p}
                    selected={selectedFemaleId === p.id}
                    onSelect={() => setSelectedFemaleId(id => id === p.id ? null : p.id)}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Compatibility + predictions panel */}
          {selectedMale && selectedFemale && (
            <div className="border border-stone-700 rounded-lg p-4 bg-stone-800 space-y-4">

              {/* Compatibility */}
              <div>
                <h3 className="text-amber-400 font-semibold text-xs uppercase tracking-wider mb-2">
                  Compatibility
                </h3>
                {compatibility?.allowed ? (
                  <p className="text-green-300 text-xs">✓ This union is permitted.</p>
                ) : (
                  <p className="text-red-400 text-xs">
                    ✗ Cannot marry: {compatibility?.reason?.replace(/_/g, ' ') ?? 'unknown reason'}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mt-2 text-stone-300">
                  <span className="text-stone-500">Shared languages:</span>
                  <span>
                    {sharedLanguages(selectedMale, selectedFemale).join(', ') || 'None'}
                  </span>
                  <span className="text-stone-500">Cultural distance:</span>
                  <span>{culturalDistanceLabel(selectedMale, selectedFemale)}</span>
                </div>
                {langCompat === 'none' && (
                  <p className="mt-2 text-amber-400 text-xs border border-amber-700 rounded px-2 py-1 bg-amber-950/40">
                    ⚠ No shared language — this couple will struggle to communicate.
                  </p>
                )}
                {langCompat === 'partial' && (
                  <p className="mt-2 text-stone-400 text-xs border border-stone-600 rounded px-2 py-1 bg-stone-900/40">
                    ◌ Partial understanding — communication will take effort.
                  </p>
                )}
              </div>

              {/* Child predictions */}
              {childPrediction && (
                <div>
                  <h3 className="text-amber-400 font-semibold text-xs uppercase tracking-wider mb-2">
                    Predicted Children
                  </h3>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-stone-300">
                    <span className="text-stone-500">Skin tone range:</span>
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block w-12 h-2 rounded"
                        style={{
                          background: `linear-gradient(to right, ${skinToneColor(childPrediction.stLow)}, ${skinToneColor(childPrediction.stHigh)})`,
                        }}
                      />
                      <span className="text-stone-400 text-[10px]">
                        {childPrediction.stLow.toFixed(2)}–{childPrediction.stHigh.toFixed(2)}
                      </span>
                    </span>
                    <span className="text-stone-500">Likely eye colours:</span>
                    <span>
                      {childPrediction.eyeEntries
                        .map(([col, w]) => `${col} (${((w ?? 0) * 100).toFixed(0)}%)`)
                        .join(', ')}
                    </span>
                    <span className="text-stone-500">Gender ratio:</span>
                    <span>~{childPrediction.femaleRatio}:1 female : male</span>
                    <span className="text-stone-500">Extended fertility:</span>
                    <span className={childPrediction.extendedFertility ? 'text-amber-400' : 'text-stone-400'}>
                      {childPrediction.extendedFertility ? '✦ Yes (Kethara\'s Bargain inherited)' : 'No'}
                    </span>
                  </div>
                </div>
              )}

              {/* Opinion impacts */}
              {opinionImpacts.length > 0 && (
                <div>
                  <h3 className="text-amber-400 font-semibold text-xs uppercase tracking-wider mb-2">
                    Opinion Impacts
                  </h3>
                  <div className="flex flex-col gap-0.5 text-xs">
                    {opinionImpacts.map(({ name, reaction }) => (
                      <span key={name} className={reaction === 'approve' ? 'text-green-300' : 'text-red-300'}>
                        {reaction === 'approve' ? '✓' : '⚠'} {name} will {reaction === 'approve' ? 'approve (cosmopolitan)' : 'disapprove (traditional)'}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-1">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded text-sm text-stone-300 hover:text-stone-100 border border-stone-600 hover:border-stone-400 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!canConfirm}
              className={[
                'px-5 py-1.5 rounded text-sm font-semibold border transition-colors',
                canConfirm
                  ? 'bg-amber-700 hover:bg-amber-600 text-amber-100 border-amber-500'
                  : 'bg-stone-800 text-stone-600 border-stone-700 cursor-not-allowed',
              ].join(' ')}
            >
              Confirm Marriage
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

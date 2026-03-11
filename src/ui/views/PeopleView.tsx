/**
 * PeopleView — population roster.
 *
 * Shows all living settlers with skin-tone dot, heritage abbreviation,
 * age, sex icon, role badge, and marital status. Supports sort and filter.
 */

import { useState } from 'react';
import { useGameStore } from '../../stores/game-store';
import type { WorkRole } from '../../simulation/population/person';
import { skinToneColor } from '../components/Portrait';
import { heritageAbbr } from '../components/heritage-helpers';
import PersonDetail from './PersonDetail';
import MarriageDialog from '../overlays/MarriageDialog';

const MAX_COUNCIL = 7;

const ROLE_LABELS: Record<WorkRole, string> = {
  farmer:     'Farmer',
  trader:     'Trader',
  guard:      'Guard',
  craftsman:  'Craftsman',
  healer:     'Healer',
  unassigned: 'Unassigned',
};

const ROLE_COLORS: Record<WorkRole, string> = {
  farmer:     'bg-green-900 text-green-200',
  trader:     'bg-amber-900 text-amber-200',
  guard:      'bg-red-900 text-red-200',
  craftsman:  'bg-stone-700 text-stone-200',
  healer:     'bg-cyan-900 text-cyan-200',
  unassigned: 'bg-stone-800 text-stone-400',
};

type SortKey = 'name' | 'age' | 'heritage' | 'role';

interface FilterState {
  sex:      'all' | 'male' | 'female';
  married:  'all' | 'married' | 'unmarried';
  heritage: 'all' | 'IMA' | 'KIS' | 'HAN' | 'MIX';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PeopleView() {
  const [selectedId,        setSelectedId]        = useState<string | null>(null);
  const [sortKey,           setSortKey]            = useState<SortKey>('name');
  const [filter,            setFilter]             = useState<FilterState>({ sex: 'all', married: 'all', heritage: 'all' });
  const [showMarriageDialog, setShowMarriageDialog] = useState(false);

  const peopleMap           = useGameStore(s => s.gameState?.people);
  const councilIds          = useGameStore(s => s.gameState?.councilMemberIds ?? []);
  const assignCouncilMember = useGameStore(s => s.assignCouncilMember);
  const removeCouncilMember = useGameStore(s => s.removeCouncilMember);
  const people = peopleMap ? Array.from(peopleMap.values()) : [];

  // ── Filter ────────────────────────────────────────────────────────────────
  const filtered = people.filter(p => {
    if (filter.sex !== 'all' && p.sex !== filter.sex) return false;
    if (filter.married === 'married'   && p.spouseIds.length === 0) return false;
    if (filter.married === 'unmarried' && p.spouseIds.length  >  0) return false;
    if (filter.heritage !== 'all') {
      const abbr = heritageAbbr(p.heritage.bloodline);
      const group = abbr === 'MIX' ? 'MIX' : abbr === 'IMA' ? 'IMA' : abbr.startsWith('KIS') ? 'KIS' : 'HAN';
      if (group !== filter.heritage) return false;
    }
    return true;
  });

  // ── Sort ──────────────────────────────────────────────────────────────────
  const sorted = [...filtered].sort((a, b) => {
    switch (sortKey) {
      case 'age':      return b.age - a.age;
      case 'role':     return a.role.localeCompare(b.role);
      case 'heritage': return heritageAbbr(a.heritage.bloodline).localeCompare(heritageAbbr(b.heritage.bloodline));
      default:         return `${a.firstName} ${a.familyName}`.localeCompare(`${b.firstName} ${b.familyName}`);
    }
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  const selectBtn = (active: boolean) =>
    `px-2 py-0.5 rounded text-xs border transition-colors ${active ? 'bg-amber-800 text-amber-100 border-amber-600' : 'bg-stone-800 text-stone-400 border-stone-600 hover:text-stone-200'}`;

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Marriage dialog overlay ── */}
      {showMarriageDialog && (
        <MarriageDialog onClose={() => setShowMarriageDialog(false)} />
      )}

      {/* ── Left: roster table ── */}
      <div className="flex-1 min-w-0 overflow-y-auto p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-amber-200 font-bold text-lg">
            Settlers ({sorted.length}{filtered.length !== people.length ? `/${people.length}` : ''})
          </h2>
          <button
            onClick={() => setShowMarriageDialog(true)}
            className="px-3 py-1 rounded text-xs font-semibold bg-amber-800 hover:bg-amber-700 text-amber-100 border border-amber-600 transition-colors"
          >
            Arrange Marriage
          </button>
        </div>

        {/* Filter / Sort bar */}
        <div className="flex flex-wrap items-center gap-3 mb-3 p-2 rounded bg-stone-800 border border-stone-700">
          {/* Sort */}
          <span className="text-stone-500 text-xs">Sort:</span>
          {(['name', 'age', 'heritage', 'role'] as SortKey[]).map(k => (
            <button key={k} onClick={() => setSortKey(k)} className={selectBtn(sortKey === k)}>
              {k.charAt(0).toUpperCase() + k.slice(1)}
            </button>
          ))}

          <span className="text-stone-700">|</span>

          {/* Sex filter */}
          <span className="text-stone-500 text-xs">Sex:</span>
          {(['all', 'female', 'male'] as const).map(v => (
            <button key={v} onClick={() => setFilter(f => ({ ...f, sex: v }))} className={selectBtn(filter.sex === v)}>
              {v === 'female' ? '♀' : v === 'male' ? '♂' : 'All'}
            </button>
          ))}

          <span className="text-stone-700">|</span>

          {/* Married filter */}
          <span className="text-stone-500 text-xs">Status:</span>
          {(['all', 'unmarried', 'married'] as const).map(v => (
            <button key={v} onClick={() => setFilter(f => ({ ...f, married: v }))} className={selectBtn(filter.married === v)}>
              {v === 'all' ? 'All' : v === 'married' ? '◎ Married' : '○ Single'}
            </button>
          ))}

          <span className="text-stone-700">|</span>

          {/* Heritage group filter */}
          <span className="text-stone-500 text-xs">Heritage:</span>
          {(['all', 'IMA', 'KIS', 'HAN', 'MIX'] as const).map(v => (
            <button key={v} onClick={() => setFilter(f => ({ ...f, heritage: v }))} className={selectBtn(filter.heritage === v)}>
              {v === 'all' ? 'All' : v}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-lg border border-stone-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-stone-800 text-amber-400 text-left">
                <th className="px-3 py-2 font-semibold">Name</th>
                <th className="px-2 py-2 font-semibold">Heritage</th>
                <th className="px-2 py-2 font-semibold">Age</th>
                <th className="px-2 py-2 font-semibold text-center">Sex</th>
                <th className="px-2 py-2 font-semibold">Role</th>
                <th className="px-2 py-2 font-semibold text-center">Wed</th>
                <th className="px-2 py-2 font-semibold text-center" title="Expedition Council seat">⭐</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((person, i) => {
                const onCouncil   = councilIds.includes(person.id);
                const councilFull = councilIds.length >= MAX_COUNCIL;
                const canAdd      = !onCouncil && !councilFull;
                const abbr        = heritageAbbr(person.heritage.bloodline);
                const dot         = skinToneColor(person.genetics.visibleTraits.skinTone);
                const isMarried   = person.spouseIds.length > 0;

                return (
                  <tr
                    key={person.id}
                    onClick={() => setSelectedId(id => id === person.id ? null : person.id)}
                    className={`border-t border-stone-700 transition-colors cursor-pointer
                                hover:bg-stone-700 active:bg-stone-600
                                ${selectedId === person.id ? 'bg-stone-700 ring-1 ring-inset ring-amber-600' : i % 2 === 0 ? 'bg-stone-800' : 'bg-stone-850'}`}
                  >
                    {/* Name + skin dot */}
                    <td className="px-3 py-2 text-amber-100 font-medium">
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 border border-stone-600"
                          style={{ backgroundColor: dot }}
                          aria-hidden="true"
                        />
                        {person.firstName} {person.familyName}
                      </span>
                    </td>

                    {/* Heritage abbreviation */}
                    <td className="px-2 py-2">
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-stone-700 text-stone-300">
                        {abbr}
                      </span>
                    </td>

                    {/* Age */}
                    <td className="px-2 py-2 text-stone-400 tabular-nums">
                      {person.age.toFixed(0)}
                    </td>

                    {/* Sex icon */}
                    <td className="px-2 py-2 text-center">
                      <span className={person.sex === 'female' ? 'text-rose-400' : 'text-sky-400'}>
                        {person.sex === 'female' ? '♀' : '♂'}
                      </span>
                    </td>

                    {/* Role */}
                    <td className="px-2 py-2">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${ROLE_COLORS[person.role]}`}>
                        {ROLE_LABELS[person.role]}
                      </span>
                    </td>

                    {/* Married indicator */}
                    <td className="px-2 py-2 text-center text-stone-400" title={isMarried ? 'Married' : 'Unmarried'}>
                      {isMarried ? '◎' : '○'}
                    </td>

                    {/* Council seat */}
                    <td className="px-2 py-2 text-center">
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          onCouncil ? removeCouncilMember(person.id) : assignCouncilMember(person.id);
                        }}
                        disabled={!onCouncil && councilFull}
                        title={onCouncil ? 'Remove from council' : councilFull ? 'Council is full (7 max)' : 'Add to council'}
                        className={`text-lg leading-none transition-opacity
                                    ${onCouncil ? 'opacity-100' : canAdd ? 'opacity-30 hover:opacity-70' : 'opacity-10 cursor-not-allowed'}`}
                      >
                        {onCouncil ? '⭐' : '☆'}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-stone-500 italic">
                    No settlers match the current filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Right: person detail panel ── */}
      {selectedId && (
        <PersonDetail
          personId={selectedId}
          onClose={() => setSelectedId(null)}
          onNavigate={id => setSelectedId(id)}
        />
      )}
    </div>
  );
}

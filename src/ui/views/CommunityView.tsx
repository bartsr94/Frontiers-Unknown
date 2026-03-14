/**
 * CommunityView — the Community tab.
 *
 * Four panels:
 *   Left:    Population summary + named relationships overview
 *   Centre:  Factions (full list with strength bars and demands)
 *   Right:   Activity Feed (expanded by default)
 */

import { useState } from 'react';
import { useGameStore } from '../../stores/game-store';
import type { Faction, FactionType } from '../../simulation/turn/game-state';
import { factionLabel } from '../../simulation/world/factions';
import type { NamedRelationshipType } from '../../simulation/population/person';
import PersonDetail from './PersonDetail';

// ─── Faction colour map ───────────────────────────────────────────────────────

const FACTION_COLOR: Record<FactionType, string> = {
  cultural_preservationists: 'text-emerald-300 bg-emerald-950/50 border-emerald-700',
  company_loyalists:         'text-amber-300  bg-amber-950/50  border-amber-700',
  orthodox_faithful:         'text-yellow-300 bg-yellow-950/50 border-yellow-700',
  wheel_devotees:            'text-violet-300 bg-violet-950/50 border-violet-700',
  community_elders:          'text-stone-300  bg-stone-800/50  border-stone-600',
  merchant_bloc:             'text-blue-300   bg-blue-950/50   border-blue-700',
};

// ─── Relationship labels and colours ─────────────────────────────────────────

const REL_LABEL: Record<NamedRelationshipType, string> = {
  friend:    'Friends',
  rival:     'Rivals',
  mentor:    'Mentors',
  student:   'Students',
  confidant: 'Confidants',
  nemesis:   'Nemeses',
};

const REL_COLOR: Record<NamedRelationshipType, string> = {
  friend:    'text-sky-300    bg-sky-950/40    border-sky-700',
  rival:     'text-orange-300 bg-orange-950/40 border-orange-700',
  mentor:    'text-violet-300 bg-violet-950/40 border-violet-700',
  student:   'text-violet-300 bg-violet-950/40 border-violet-700',
  confidant: 'text-teal-300   bg-teal-950/40   border-teal-700',
  nemesis:   'text-rose-300   bg-rose-950/40   border-rose-700',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeading({ label }: { label: string }) {
  return (
    <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">
      {label}
    </h3>
  );
}

function FactionsPanel({ factions, people }: {
  factions: Faction[];
  people: Map<string, import('../../simulation/population/person').Person>;
}) {
  if (factions.length === 0) {
    return (
      <p className="text-xs text-stone-500 italic">No factions have formed yet.</p>
    );
  }

  return (
    <div className="space-y-3">
      {factions.map(faction => {
        const colorCls = FACTION_COLOR[faction.type];
        const strengthPct = Math.round(faction.strength * 100);
        const spokespersonId = faction.memberIds[0];
        const spokesperson = spokespersonId ? people.get(spokespersonId) : undefined;
        return (
          <div key={faction.id} className={`rounded border p-2.5 text-xs ${colorCls}`}>
            <div className="font-semibold text-sm mb-1">{factionLabel(faction.type)}</div>
            <div className="text-stone-400 mb-2">
              {faction.memberIds.length} member{faction.memberIds.length !== 1 ? 's' : ''}
              {spokesperson ? ` · led by ${spokesperson.firstName}` : ''}
              {' · '}formed T{faction.formedTurn}
            </div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-stone-400 shrink-0">Strength</span>
              <div className="flex-1 bg-stone-700 rounded-full h-1.5">
                <div
                  className="h-1.5 rounded-full bg-current opacity-80 transition-all"
                  style={{ width: `${strengthPct}%` }}
                />
              </div>
              <span className="tabular-nums">{strengthPct}%</span>
            </div>
            {faction.activeDemand && (
              <div className="mt-2 px-2 py-1.5 bg-black/30 rounded text-stone-300 italic leading-snug">
                ⚑ {faction.activeDemand.description}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

export default function CommunityView() {
  const gameState   = useGameStore(s => s.gameState);
  const [personDetailId, setPersonDetailId] = useState<string | null>(null);

  if (!gameState) {
    return (
      <div className="flex-1 flex items-center justify-center text-stone-500 text-sm italic">
        No game in progress.
      </div>
    );
  }

  const people   = gameState.people;
  const factions = gameState.factions ?? [];
  const living   = Array.from(people.values());

  // ── Population summary stats ──────────────────────────────────────────────
  const totalPop   = living.length;
  const maleCount  = living.filter(p => p.sex === 'male').length;
  const femaleCount = living.filter(p => p.sex === 'female').length;
  const childCount  = living.filter(p => p.age < 14).length;
  const elderCount  = living.filter(p => p.age >= 55).length;

  // ── Named relationship summary ────────────────────────────────────────────
  const relCounts: Partial<Record<NamedRelationshipType, number>> = {};
  for (const person of living) {
    for (const rel of person.namedRelationships) {
      relCounts[rel.type] = (relCounts[rel.type] ?? 0) + 1;
    }
  }
  // Each bond appears once per person, so pairs = count / 2
  const REL_TYPES: NamedRelationshipType[] = ['friend', 'rival', 'confidant', 'nemesis', 'mentor', 'student'];

  // ── Active schemes summary ────────────────────────────────────────────────
  const schemers = living.filter(p => p.activeScheme !== null);
  const schemesByType: Partial<Record<string, number>> = {};
  for (const p of schemers) {
    if (p.activeScheme) {
      const label = schemeDisplayLabel(p.activeScheme.type);
      schemesByType[label] = (schemesByType[label] ?? 0) + 1;
    }
  }

  // ── Ambitions summary ─────────────────────────────────────────────────────
  const ambitionCount = living.filter(p => p.ambition !== null).length;

  return (
    <div className="flex-1 flex min-h-0 overflow-hidden">

      {/* ── LEFT: Population summary + Relations ──────────────────────── */}
      <div className="w-52 shrink-0 bg-stone-900 border-r border-stone-700 overflow-y-auto p-3 space-y-5">

        {/* Population */}
        <div>
          <SectionHeading label="Population" />
          <div className="space-y-1 text-xs">
            <StatRow label="Total settlers" value={totalPop} />
            <StatRow label="Men" value={maleCount} />
            <StatRow label="Women" value={femaleCount} />
            <StatRow label="Children (< 14)" value={childCount} />
            <StatRow label="Elders (55+)" value={elderCount} />
          </div>
        </div>

        {/* Community bonds */}
        <div>
          <SectionHeading label="Bonds" />
          {REL_TYPES.every(t => !relCounts[t]) ? (
            <p className="text-xs text-stone-500 italic">No named bonds yet.</p>
          ) : (
            <div className="space-y-1">
              {REL_TYPES.map(t => {
                const raw = relCounts[t] ?? 0;
                if (raw === 0) return null;
                const pairs = Math.floor(raw / 2);
                return (
                  <div
                    key={t}
                    className={`flex items-center justify-between rounded border px-2 py-1 text-xs ${REL_COLOR[t]}`}
                  >
                    <span>{REL_LABEL[t]}</span>
                    <span className="font-semibold tabular-nums">{pairs}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Schemes & Ambitions */}
        <div>
          <SectionHeading label="Schemes & Ambitions" />
          <div className="space-y-1 text-xs">
            <StatRow label="Active ambitions" value={ambitionCount} />
            <StatRow label="Active schemes" value={schemers.length} />
          </div>
          {Object.entries(schemesByType).length > 0 && (
            <div className="mt-2 space-y-1">
              {Object.entries(schemesByType).map(([label, count]) => (
                <div key={label} className="flex justify-between text-xs text-stone-400">
                  <span className="italic">{label}</span>
                  <span>{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* ── CENTRE: Factions ──────────────────────────────────────────── */}
      <div className="w-72 shrink-0 bg-stone-900 border-r border-stone-700 overflow-y-auto p-3">
        <SectionHeading label="Factions" />
        <FactionsPanel factions={factions} people={people} />
      </div>

      {/* ── RIGHT: Activity Feed (expanded) ───────────────────────────── */}
      <div className="flex-1 bg-stone-900 overflow-y-auto p-3">
        <SectionHeading label="Community Activity" />
        <ExpandedActivityFeed
          entries={gameState.activityLog}
          people={people}
          graveyard={gameState.graveyard}
          onNavigate={id => setPersonDetailId(id)}
        />
      </div>

      {/* ── PersonDetail overlay ──────────────────────────────────────── */}
      {personDetailId && (
        <div className="fixed inset-0 z-50 flex items-start justify-end pointer-events-none">
          <div className="pointer-events-auto w-96 h-full overflow-y-auto bg-stone-900 border-l border-stone-700 shadow-2xl">
            <PersonDetail
              personId={personDetailId}
              onClose={() => setPersonDetailId(null)}
              onNavigate={id => setPersonDetailId(id)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-stone-400">{label}</span>
      <span className="font-semibold text-stone-200 tabular-nums">{value}</span>
    </div>
  );
}

function schemeDisplayLabel(type: import('../../simulation/population/person').SchemeType): string {
  switch (type) {
    case 'scheme_court_person':     return 'Courting';
    case 'scheme_convert_faith':    return 'Converting';
    case 'scheme_befriend_person':  return 'Befriending';
    case 'scheme_undermine_person': return 'Undermining';
    case 'scheme_tutor_person':     return 'Tutoring';
  }
}

// ─── Expanded Activity Feed (always open, larger max-height) ─────────────────

const TYPE_ICON: Record<import('../../simulation/turn/game-state').ActivityLogType, string> = {
  role_self_assigned:       '🔧',
  relationship_formed:      '🤝',
  relationship_dissolved:   '💔',
  scheme_started:           '🕵️',
  scheme_succeeded:         '✅',
  scheme_failed:            '❌',
  faction_formed:           '⚑',
  faction_dissolved:        '🏳',
  trait_acquired:           '⭐',
  ambition_formed:          '🔥',
  ambition_cleared:         '🎯',
};

interface ExpandedActivityFeedProps {
  entries: import('../../simulation/turn/game-state').ActivityLogEntry[];
  people: Map<string, import('../../simulation/population/person').Person>;
  graveyard: import('../../simulation/turn/game-state').GraveyardEntry[];
  onNavigate?: (personId: string) => void;
}

function ExpandedActivityFeed({ entries, people, graveyard, onNavigate }: ExpandedActivityFeedProps) {
  function nameOf(id: string): string {
    const p = people.get(id);
    if (p) return p.firstName;
    const g = graveyard.find(e => e.id === id);
    return g ? `${g.firstName}†` : '(unknown)';
  }

  function renderDescription(entry: import('../../simulation/turn/game-state').ActivityLogEntry) {
    const parts = entry.description.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      const match = /^\*\*([^*]+)\*\*$/.exec(part);
      if (!match) return <span key={i}>{part}</span>;
      const raw = match[1]!;
      const linkedId =
        entry.personId && nameOf(entry.personId) === raw ? entry.personId :
        entry.targetId && nameOf(entry.targetId) === raw ? entry.targetId :
        undefined;
      if (linkedId && onNavigate) {
        return (
          <button
            key={i}
            className="font-semibold text-amber-300 hover:underline focus:outline-none"
            onClick={() => onNavigate(linkedId)}
          >
            {raw}
          </button>
        );
      }
      return <span key={i} className="font-semibold text-amber-300">{raw}</span>;
    });
  }

  const reversed = [...entries].reverse();

  if (reversed.length === 0) {
    return <p className="text-xs text-stone-500 italic">No community activity recorded yet.</p>;
  }

  return (
    <div className="space-y-1.5">
      {reversed.map((entry, i) => (
        <div key={i} className="flex items-start gap-2 text-xs text-stone-300 border-b border-stone-800/60 pb-1.5">
          <span className="shrink-0 bg-stone-800 text-stone-500 rounded px-1 font-mono text-[10px] mt-0.5">
            T{entry.turn}
          </span>
          <span className="shrink-0 text-base leading-none mt-[-1px]">
            {TYPE_ICON[entry.type] ?? '•'}
          </span>
          <span className="leading-snug flex-1">{renderDescription(entry)}</span>
        </div>
      ))}
    </div>
  );
}

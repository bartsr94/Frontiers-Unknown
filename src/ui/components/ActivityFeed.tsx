import { useState } from 'react';
import type { ActivityLogEntry, ActivityLogType, GraveyardEntry } from '../../simulation/turn/game-state';
import type { Person } from '../../simulation/population/person';

// ─── Icon & label helpers ─────────────────────────────────────────────────────

const TYPE_ICON: Record<ActivityLogType, string> = {
  role_self_assigned:   '🔧',
  relationship_formed:  '🤝',
  relationship_dissolved: '💔',
  scheme_started:       '🕵️',
  scheme_succeeded:     '✅',
  scheme_failed:        '❌',
  faction_formed:       '⚑',
  faction_dissolved:    '🏳',
  trait_acquired:       '⭐',
  ambition_formed:      '🔥',
  ambition_cleared:     '🎯',
};

// ─── Component ───────────────────────────────────────────────────────────────

interface ActivityFeedProps {
  entries: ActivityLogEntry[];
  people: Map<string, Person>;
  graveyard: GraveyardEntry[];
  /** Called when the user clicks a person's name chip. */
  onNavigate?: (personId: string) => void;
}

export default function ActivityFeed({ entries, people, graveyard, onNavigate }: ActivityFeedProps) {
  const [open, setOpen] = useState(false);

  // Resolve a person ID to a display name (handles deceased)
  function nameOf(id: string): string {
    const p = people.get(id);
    if (p) return p.firstName;
    const g = graveyard.find(e => e.id === id);
    return g ? `${g.firstName}†` : '(unknown)';
  }

  // Replace bold-marked tokens **name** with a clickable or plain chip
  function renderDescription(entry: ActivityLogEntry) {
    const parts = entry.description.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      const match = /^\*\*([^*]+)\*\*$/.exec(part);
      if (!match) return <span key={i}>{part}</span>;
      const raw = match[1];
      // Try to find a person whose first name matches this token
      const linkedId = entry.personId && nameOf(entry.personId) === raw
        ? entry.personId
        : entry.targetId && nameOf(entry.targetId) === raw
          ? entry.targetId
          : undefined;
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

  return (
    <div className="mt-3 border-t border-stone-700 pt-2">
      <button
        className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-200 w-full text-left"
        onClick={() => setOpen(v => !v)}
      >
        <span className="font-semibold text-stone-300">Activity Feed</span>
        <span className="ml-1 text-stone-500">({entries.length})</span>
        <span className="ml-auto">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-1 max-h-[180px] overflow-y-auto pr-1 space-y-1">
          {reversed.length === 0 ? (
            <p className="text-xs text-stone-500 italic">No activity recorded yet.</p>
          ) : (
            reversed.map((entry, i) => (
              <div key={i} className="flex items-start gap-1.5 text-xs text-stone-300">
                <span className="shrink-0 bg-stone-800 text-stone-500 rounded px-1 font-mono">
                  T{entry.turn}
                </span>
                <span className="shrink-0 text-base leading-none mt-[-1px]">
                  {TYPE_ICON[entry.type] ?? '•'}
                </span>
                <span className="leading-snug">{renderDescription(entry)}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

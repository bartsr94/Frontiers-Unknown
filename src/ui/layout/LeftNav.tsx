/**
 * LeftNav — vertical navigation sidebar inspired by King of Dragon Pass.
 *
 * Top section: settlement identity (name + season + year).
 * Middle section: page navigation links.
 * Bottom section: End Turn control.
 */

import type { Dispatch, SetStateAction } from 'react';
import { useEffect } from 'react';
import { useGameStore } from '../../stores/game-store';
import { toRoman } from '../../utils/math';

export type View =
  | 'settlers'
  | 'events'
  | 'settlement'
  | 'trade'
  | 'diplomacy'
  | 'map'
  | 'chronicle';

interface NavItem {
  id: View;
  emoji: string;
  label: string;
  stub?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'settlers',    emoji: '👥', label: 'Settlers'   },
  { id: 'events',      emoji: '📜', label: 'Events'     },
  { id: 'settlement',  emoji: '🏘', label: 'Settlement' },
  { id: 'trade',       emoji: '🔀', label: 'Trade'      },
  { id: 'diplomacy',   emoji: '🤝', label: 'Diplomacy'            },
  { id: 'map',         emoji: '🗺', label: 'Map',        stub: true },
  { id: 'chronicle',   emoji: '📖', label: 'Chronicle',  stub: true },
];

const SEASON_COLORS: Record<string, string> = {
  spring: 'text-green-400',
  summer: 'text-yellow-400',
  autumn: 'text-orange-400',
  winter: 'text-blue-300',
};

const SEASON_GLYPHS: Record<string, string> = {
  spring: '✿',
  summer: '☀',
  autumn: '❧',
  winter: '❄',
};

interface Props {
  activeView: View;
  setActiveView: Dispatch<SetStateAction<View>>;
}

export default function LeftNav({ activeView, setActiveView }: Props) {
  const gameState    = useGameStore(s => s.gameState);
  const currentPhase = useGameStore(s => s.currentPhase);
  const pendingCount = useGameStore(s => s.pendingEvents.length);
  const startTurn    = useGameStore(s => s.startTurn);
  const endTurn      = useGameStore(s => s.endTurn);

  // 'dawn' and 'dusk' are automatic processing phases — button disabled.
  // 'event' phase is handled by EventView — button also disabled.
  // 'idle' → clicking starts the turn (dawn + draw events).
  // 'management' → clicking ends the turn (dusk + season advance).
  const isBusy      = currentPhase === 'dawn' || currentPhase === 'dusk';
  const isEventPhase = currentPhase === 'event';
  const isDisabled  = isBusy || isEventPhase;
  const buttonLabel =
    isBusy        ? 'The season turns…' :
    isEventPhase  ? 'Events Pending' :
    currentPhase === 'management' ? 'Close the Season' :
    'Begin the Season';

  const season = gameState?.currentSeason ?? 'spring';
  const year   = gameState?.currentYear   ?? 1;
  const name   = gameState?.settlement.name ?? '';

  // Auto-navigate to the Events tab when new events arrive.
  useEffect(() => {
    if (currentPhase === 'event' && pendingCount > 0) {
      setActiveView('events');
    }
  }, [currentPhase, pendingCount, setActiveView]);

  function handleEndTurn() {
    if (currentPhase === 'idle') {
      startTurn();
    } else if (currentPhase === 'management') {
      endTurn();
    }
  }

  return (
    <aside className="w-44 bg-amber-950 border-r-2 border-amber-900 flex flex-col shrink-0">

      {/* Settlement identity */}
      <div className="px-3 pt-3 pb-2 border-b border-amber-900">
        <p className="font-display text-amber-100 font-bold text-sm truncate" title={name}>
          {name}
        </p>
        <hr className="border-stone-600/50 my-1.5" />
        <p className="text-stone-400 text-xs">
          <span className={`font-medium capitalize ${SEASON_COLORS[season] ?? 'text-amber-300'}`}>
            {SEASON_GLYPHS[season] ?? ''} {season}
          </span>
          {' · Year '}
          <span>{toRoman(year)}</span>
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-0.5">
        {NAV_ITEMS.map(item => {
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              disabled={item.stub}
              title={item.stub ? 'Not yet charted' : undefined}
              className={`w-full text-left px-2 py-1.5 rounded text-sm font-medium flex items-center gap-2 transition-colors
                          ${isActive
                            ? 'bg-amber-900 text-amber-200 border-l-2 border-amber-500'
                            : item.stub
                              ? 'text-stone-600 cursor-not-allowed'
                              : 'text-amber-300 hover:bg-amber-900 hover:text-amber-100'
                          }`}
            >
              <span className="text-base leading-none">{item.emoji}</span>
              <span>{item.label}</span>
              {item.stub && (
                <span className="ml-auto text-[10px] text-stone-700">⏳</span>
              )}
              {item.id === 'events' && pendingCount > 0 && (
                <span className="ml-auto bg-red-700 text-red-100 text-xs font-bold rounded-full px-1.5 py-0.5 leading-none">
                  {pendingCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* End Turn */}
      <div className="p-3 border-t border-amber-900">
        <button
          onClick={handleEndTurn}
          disabled={isDisabled}
          className={`w-full py-2.5 rounded font-bold text-sm transition-colors shadow-md
                      ${isDisabled
                        ? 'bg-stone-700 text-stone-500 cursor-not-allowed'
                        : currentPhase === 'management'
                          ? 'bg-green-800 hover:bg-green-700 active:bg-green-900 text-green-50'
                          : 'bg-amber-700 hover:bg-amber-600 active:bg-amber-800 text-amber-50'
                      }`}
        >
          {buttonLabel}
        </button>
      </div>
    </aside>
  );
}

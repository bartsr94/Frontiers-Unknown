/**
 * GameScreen — main game layout shell (KoDP-inspired).
 *
 * Layout:
 *   ┌─────────┬──────────────────────────────────┐
 *   │         │  main content view               │
 *   │ LeftNav │──────────────────────────────────│
 *   │         │  CouncilFooter                   │
 *   ├─────────┴──────────────────────────────────┤
 *   │  BottomBar (full width)                    │
 *   └────────────────────────────────────────────┘
 */

import { useState } from 'react';
import LeftNav, { type View } from './LeftNav';
import BottomBar from './BottomBar';
import CouncilFooter from './CouncilFooter';
import PeopleView from '../views/PeopleView';
import EventView from '../views/EventView';
import SettlementView from '../views/SettlementView';
import TradeView from '../views/TradeView';
import { useGameStore } from '../../stores/game-store';
import type { ResourceType } from '../../simulation/turn/game-state';
import { RESOURCE_EMOJI } from '../shared/resource-display';

function SpoilageNotification() {
  const lastSpoilage    = useGameStore(s => s.lastSpoilage);
  const dismissSpoilage = useGameStore(s => s.dismissSpoilage);

  if (!lastSpoilage) return null;

  const parts = Object.entries(lastSpoilage)
    .filter(([, v]) => (v as number) >= 1)
    .map(([k, v]) => `${RESOURCE_EMOJI[k as ResourceType] ?? ''}${Math.floor(v as number)} ${k}`);

  if (parts.length === 0) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-950/80 border-b border-amber-800/60 text-xs text-amber-300 shrink-0">
      <span>⁂ Spoilage: {parts.join(', ')} were lost in the night.</span>
      <button
        onClick={dismissSpoilage}
        className="ml-auto text-amber-500 hover:text-amber-300 leading-none"
        aria-label="Dismiss spoilage notification"
      >✕</button>
    </div>
  );
}

function NotificationBanner() {
  const pendingNotification = useGameStore(s => s.pendingNotification);
  const dismissNotification = useGameStore(s => s.dismissNotification);

  if (!pendingNotification) return null;

  return (
    <div className="flex items-start gap-2 px-3 py-2 bg-stone-800/90 border-b border-stone-600 text-xs text-stone-200 shrink-0">
      <span className="flex-1">{pendingNotification}</span>
      <button
        onClick={dismissNotification}
        className="shrink-0 text-stone-400 hover:text-stone-200 leading-none mt-0.5"
        aria-label="Dismiss notification"
      >✕</button>
    </div>
  );
}

function StubView({ name }: { name: string }) {
  return (
    <div className="flex-1 flex items-center justify-center text-stone-500 text-sm italic">
      {name} — records forthcoming
    </div>
  );
}

export default function GameScreen() {
  const [activeView, setActiveView] = useState<View>('settlers');

  function renderView() {
    switch (activeView) {
      case 'settlers':   return <PeopleView />;
      case 'events':     return <EventView />;
      case 'settlement': return <SettlementView />;
      case 'trade':      return <TradeView />;
      case 'diplomacy':  return <StubView name="Diplomacy" />;
      case 'map':        return <StubView name="Map" />;
      case 'chronicle':  return <StubView name="Chronicle" />;
    }
  }

  return (
    <div className="h-screen bg-stone-900 flex flex-col overflow-hidden">

      {/* Body row: LeftNav + main column */}
      <div className="flex flex-1 min-h-0">

        {/* Left navigation sidebar */}
        <LeftNav activeView={activeView} setActiveView={setActiveView} />

        {/* Main column: content view + council footer */}
        <div className="flex flex-col flex-1 min-w-0">

          {/* Persistent notification banners (creole emergence, spoilage, etc.) */}
          <NotificationBanner />
          <SpoilageNotification />

          {/* Content area — overflow-hidden so views that use h-full (EventView,
              SettlementView, PeopleView) get a bounded height. Each view manages
              its own internal scrolling where needed. */}
          <div className="flex-1 overflow-hidden min-h-0">
            {renderView()}
          </div>

          {/* Council seats pinned to bottom of content column */}
          <CouncilFooter />
        </div>
      </div>

      {/* Resource strip spanning full width */}
      <BottomBar />
    </div>
  );
}



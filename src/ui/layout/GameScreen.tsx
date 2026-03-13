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

function StubView({ name }: { name: string }) {
  return (
    <div className="flex-1 flex items-center justify-center text-stone-500 text-sm italic">
      {name} — coming soon
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
      case 'trade':      return <StubView name="Trade" />;
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



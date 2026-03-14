import React from 'react';
import { useGameStore } from '../../stores/game-store';

interface SettingsOverlayProps {
  onClose: () => void;
}

interface ToggleRowProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}

function ToggleRow({ label, description, checked, onChange, disabled }: ToggleRowProps) {
  return (
    <label className={`flex items-start gap-3 py-2 cursor-pointer ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}>
      <div className="mt-0.5 flex-shrink-0">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={e => onChange(e.target.checked)}
          className="w-4 h-4 rounded border-stone-500 bg-stone-700 text-amber-500 focus:ring-amber-500 focus:ring-1"
        />
      </div>
      <div>
        <span className="text-sm text-stone-200">{label}</span>
        {description && (
          <p className="text-xs text-stone-400 mt-0.5">{description}</p>
        )}
      </div>
    </label>
  );
}

export default function SettingsOverlay({ onClose }: SettingsOverlayProps) {
  const gameState = useGameStore(s => s.gameState);
  const updateDebugSettings = useGameStore(s => s.updateDebugSettings);

  const debug = gameState?.debugSettings;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-stone-800 border border-stone-600 rounded-lg shadow-2xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-600">
          <h2 className="text-base font-semibold text-stone-100 tracking-wide">Settings</h2>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-100 transition-colors text-xl leading-none"
            aria-label="Close settings"
          >
            ×
          </button>
        </div>

        <div className="px-5 py-4 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Debug / Developer section */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-1">
              Developer / Debug
            </h3>
            <p className="text-xs text-stone-500 mb-3 italic">
              These settings are persisted in your save file. Toggle the master switch to enable
              sub-options.
            </p>

            {debug ? (
              <div className="space-y-0 divide-y divide-stone-700/50">
                <ToggleRow
                  label="Autonomy log (master switch)"
                  description="Emits autonomy system events to the browser console each turn."
                  checked={debug.showAutonomyLog}
                  onChange={v => updateDebugSettings({ showAutonomyLog: v })}
                />
                <ToggleRow
                  label="Log scheme progress"
                  description="Prints scheme evaluation milestones and state changes."
                  checked={debug.logSchemes}
                  onChange={v => updateDebugSettings({ logSchemes: v })}
                  disabled={!debug.showAutonomyLog}
                />
                <ToggleRow
                  label="Log opinion deltas"
                  description="Prints every opinion change above ±5 per turn."
                  checked={debug.logOpinionDeltas}
                  onChange={v => updateDebugSettings({ logOpinionDeltas: v })}
                  disabled={!debug.showAutonomyLog}
                />
                <ToggleRow
                  label="Log faction strength"
                  description="Prints faction power scores and demand status each turn."
                  checked={debug.logFactionStrength}
                  onChange={v => updateDebugSettings({ logFactionStrength: v })}
                  disabled={!debug.showAutonomyLog}
                />
                <ToggleRow
                  label="Log ambition lifecycle"
                  description="Prints ambition formation, progression and resolution events."
                  checked={debug.logAmbitions}
                  onChange={v => updateDebugSettings({ logAmbitions: v })}
                  disabled={!debug.showAutonomyLog}
                />
                <ToggleRow
                  label="Skip events"
                  description="Discards all pending events each turn — jumps straight to management phase for rapid season progression."
                  checked={debug.skipEvents ?? false}
                  onChange={v => updateDebugSettings({ skipEvents: v })}
                />
                <ToggleRow
                  label="Pause on scheme event"
                  description="Emits a console warning before a scheme fires an event (useful for breakpoints)."
                  checked={debug.pauseOnSchemeEvent}
                  onChange={v => updateDebugSettings({ pauseOnSchemeEvent: v })}
                />
              </div>
            ) : (
              <p className="text-xs text-stone-500 italic">No active game — start a new game to configure debug settings.</p>
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-stone-600 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-stone-700 hover:bg-stone-600 text-stone-200 text-sm rounded transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

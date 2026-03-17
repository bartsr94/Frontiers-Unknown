/**
 * BuildingPickerModal — shown when a player clicks an empty building slot.
 * Lists available buildings filtered by ownership type and build prerequisites.
 */
import { useMemo } from 'react';
import { useGameStore } from '../../stores/game-store';
import { BUILDING_CATALOG, getBuildingDisplayName } from '../../simulation/buildings/building-definitions';
import { canBuild } from '../../simulation/buildings/construction';
import { BuildingIcon } from './building-icons';
import type { BuildingId, BuildingStyle } from '../../simulation/turn/game-state';

interface Props {
  /** For household slots—link the finished building to this household. null = communal build. */
  householdId: string | null;
  /** 'communal' shows civic/food/industry/social/defence; 'household' shows dwelling/production. */
  mode: 'communal' | 'household';
  onClose: () => void;
}

const OWNERSHIP_TO_MODE: Record<string, 'communal' | 'household'> = {
  communal:  'communal',
  household: 'household',
};

const CATEGORY_LABEL: Record<string, string> = {
  civic:    'Civic',
  food:     'Food',
  industry: 'Industry',
  defence:  'Defence',
  social:   'Social',
  dwelling: 'Dwelling',
};

export function BuildingPickerModal({ householdId, mode, onClose }: Props) {
  const buildForHousehold = useGameStore(s => s.buildForHousehold);
  const startConstruction = useGameStore(s => s.startConstruction);
  const gameState = useGameStore(s => s.gameState);

  const candidates = useMemo(() => {
    if (!gameState) return [];
    return Object.values(BUILDING_CATALOG).filter(def => {
      const defMode = OWNERSHIP_TO_MODE[def.ownership ?? 'communal'];
      if (defMode !== mode) return false;
      const result = canBuild(gameState.settlement, def.id, null);
      return result.ok;
    });
  }, [gameState, mode]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof candidates>();
    for (const def of candidates) {
      const cat = def.category ?? 'other';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(def);
    }
    return map;
  }, [candidates]);

  function handlePick(defId: BuildingId, style: BuildingStyle | null) {
    if (mode === 'household' && householdId) {
      buildForHousehold(householdId, defId, style);
    } else {
      startConstruction(defId, style);
    }
    onClose();
  }

  if (!gameState) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-stone-900 border border-stone-600 rounded-xl shadow-2xl w-[480px] max-h-[70vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-stone-700">
          <h2 className="text-sm font-semibold text-amber-300">
            {mode === 'household' ? 'Build for Household' : 'Build Communal Building'}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 text-lg leading-none"
          >×</button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-4 space-y-4">
          {candidates.length === 0 && (
            <p className="text-sm text-slate-500 italic text-center py-8">
              No buildings available to construct right now.
            </p>
          )}
          {Array.from(grouped.entries()).map(([cat, defs]) => (
            <div key={cat}>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                {CATEGORY_LABEL[cat] ?? cat}
              </p>
              <div className="space-y-1">
                {defs.map(def => {
                  const costEntries = Object.entries(def.cost ?? {}).filter(([, v]) => (v as number) > 0);
                  const hasVariants = def.hasStyleVariants;
                  return (
                    <div
                      key={def.id}
                      className="bg-stone-800 rounded-lg px-3 py-2"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <BuildingIcon id={def.id} size={20} className="text-amber-400 shrink-0" />
                        <span className="text-sm font-medium text-slate-200">
                          {getBuildingDisplayName(def.id, null)}
                        </span>
                        <span className="ml-auto text-[10px] text-slate-500">
                          {def.buildSeasons} season{def.buildSeasons !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mb-2 leading-snug">{def.description}</p>
                      {costEntries.length > 0 && (
                        <p className="text-[10px] text-stone-400 mb-2">
                          Cost: {costEntries.map(([k, v]) => `${v} ${k}`).join(' · ')}
                        </p>
                      )}
                      {/* Build buttons: style variants get two buttons, others get one */}
                      <div className="flex gap-2">
                        {hasVariants ? (
                          <>
                            <button
                              onClick={() => handlePick(def.id as BuildingId, 'imanian')}
                              className="text-[11px] bg-amber-800/60 hover:bg-amber-700/70 text-amber-200 px-2 py-1 rounded"
                            >
                              Build (Imanian)
                            </button>
                            <button
                              onClick={() => handlePick(def.id as BuildingId, 'sauromatian')}
                              className="text-[11px] bg-rose-800/60 hover:bg-rose-700/70 text-rose-200 px-2 py-1 rounded"
                            >
                              Build (Sauromatian)
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handlePick(def.id as BuildingId, null)}
                            className="text-[11px] bg-stone-700 hover:bg-stone-600 text-slate-200 px-2 py-1 rounded"
                          >
                            Build
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

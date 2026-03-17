/**
 * SlotDetailPopover — shown when a player clicks an occupied building slot.
 * Displays building details with Upgrade and Demolish actions.
 */
import { useGameStore } from '../../stores/game-store';
import { BUILDING_CATALOG, getBuildingDisplayName } from '../../simulation/buildings/building-definitions';
import { BuildingIcon } from './building-icons';
import type { BuiltBuilding } from '../../simulation/turn/game-state';

interface Props {
  building: BuiltBuilding;
  householdId: string;
  slotIndex: number;
  canManage: boolean;
  onClose: () => void;
}

export function SlotDetailPopover({ building, householdId, slotIndex, canManage, onClose }: Props) {
  const demolish = useGameStore(s => s.demolishHouseholdBuilding);
  const upgrade  = useGameStore(s => s.upgradeHouseholdBuilding);
  const gameState = useGameStore(s => s.gameState);

  const def = BUILDING_CATALOG[building.defId];
  if (!def) return null;

  const displayName = getBuildingDisplayName(building.defId, building.style);

  // Check if there's a next tier available.
  const nextDef = def.upgradeChainId && def.tierInChain !== undefined
    ? Object.values(BUILDING_CATALOG).find(
        d => d.upgradeChainId === def.upgradeChainId && d.tierInChain === def.tierInChain! + 1,
      )
    : null;

  const canUpgrade = !!nextDef && canManage;

  // Check resources for upgrade cost.
  const resources = gameState?.settlement.resources;
  const canAffordUpgrade = nextDef && resources
    ? Object.entries(nextDef.cost ?? {}).every(
        ([res, amt]) => (resources[res as keyof typeof resources] ?? 0) >= (amt as number),
      )
    : false;

  function handleDemolish() {
    if (!canManage) return;
    demolish(householdId, slotIndex);
    onClose();
  }

  function handleUpgrade() {
    if (!canUpgrade || !canAffordUpgrade) return;
    upgrade(householdId, slotIndex);
    onClose();
  }

  const costEntries = nextDef
    ? Object.entries(nextDef.cost ?? {}).filter(([, v]) => (v as number) > 0)
    : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-stone-900 border border-stone-600 rounded-xl shadow-2xl w-80">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-stone-700">
          <BuildingIcon id={building.defId} size={22} className="text-amber-400" />
          <h2 className="text-sm font-semibold text-slate-200">{displayName}</h2>
          <button
            onClick={onClose}
            className="ml-auto text-slate-500 hover:text-slate-300 text-lg leading-none"
          >×</button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-2">
          <p className="text-xs text-slate-400 leading-snug">{def.description}</p>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
            {(def.shelterCapacity ?? 0) > 0 && (
              <>
                <span className="text-stone-500">Shelter</span>
                <span className="text-slate-300">{def.shelterCapacity} people</span>
              </>
            )}
            {def.workerSlots && (
              <>
                <span className="text-stone-500">Workers</span>
                <span className="text-slate-300">
                  {(building.assignedWorkerIds ?? []).length} / {def.workerSlots}
                </span>
              </>
            )}
            {def.upgradeChainId && (
              <>
                <span className="text-stone-500">Tier</span>
                <span className="text-slate-300">
                  {def.tierInChain} / {
                    Object.values(BUILDING_CATALOG).filter(d => d.upgradeChainId === def.upgradeChainId).length
                  }
                </span>
              </>
            )}
          </div>

          {/* Upgrade preview */}
          {nextDef && (
            <div className="mt-2 bg-stone-800 rounded-lg p-2 text-[11px]">
              <p className="text-amber-300 font-semibold mb-1">
                Upgrade → {getBuildingDisplayName(nextDef.id, building.style)}
              </p>
              {costEntries.length > 0 && (
                <p className="text-stone-400">
                  Cost: {costEntries.map(([k, v]) => `${v} ${k}`).join(' · ')}
                </p>
              )}
              {!canAffordUpgrade && (
                <p className="text-red-400 mt-1">Insufficient resources</p>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        {canManage && (
          <div className="flex gap-2 px-4 pb-4">
            {canUpgrade && (
              <button
                onClick={handleUpgrade}
                disabled={!canAffordUpgrade}
                className="flex-1 text-xs bg-amber-700 hover:bg-amber-600 disabled:bg-stone-700 disabled:text-stone-500 text-amber-100 py-1.5 rounded-lg"
              >
                Upgrade
              </button>
            )}
            <button
              onClick={handleDemolish}
              className="flex-1 text-xs bg-red-900/60 hover:bg-red-800/70 text-red-300 py-1.5 rounded-lg"
            >
              Demolish
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * SettlementView — the Settlement tab.
 *
 * Two-column layout:
 *   Left  (w-72): Settlement info + communal buildings + construction queue
 *   Right (flex): Household building grid
 */

import { useState } from 'react';
import { useGameStore } from '../../stores/game-store';
import { BUILDING_CATALOG, getBuildingDisplayName } from '../../simulation/buildings/building-definitions';
import { canBuild } from '../../simulation/buildings/construction';
import {
  getShelterCapacity,
  getOvercrowdingRatio,
} from '../../simulation/buildings/building-effects';
import { BuildingIcon } from '../../ui/components/building-icons';
import { BuildingPickerModal } from '../../ui/components/BuildingPickerModal';
import { SlotDetailPopover } from '../../ui/components/SlotDetailPopover';
import type { BuildingId, BuildingStyle, BuiltBuilding, ConstructionProject, Household } from '../../simulation/turn/game-state';

// ─── Helper constants ─────────────────────────────────────────────────────────

const CATEGORY_LABEL: Record<string, string> = {
  civic:    'Civic',
  food:     'Food',
  industry: 'Industry',
  defence:  'Defence',
  social:   'Social',
  dwelling: 'Dwelling',
};

const CATEGORY_COLOR: Record<string, string> = {
  civic:    'bg-amber-900/60 text-amber-300',
  food:     'bg-green-900/60 text-green-300',
  industry: 'bg-blue-900/60 text-blue-300',
  defence:  'bg-red-900/60 text-red-300',
  social:   'bg-purple-900/60 text-purple-300',
  dwelling: 'bg-rose-900/60 text-rose-300',
};

const STYLE_LABEL: Record<BuildingStyle, string> = {
  imanian:     'Imanian',
  sauromatian: 'Sauromatian',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function ShelterBar({ pop, capacity }: { pop: number; capacity: number }) {
  const ratio      = capacity > 0 ? pop / capacity : 1;
  const pct        = Math.min(100, Math.round(ratio * 100));
  const barColor   = ratio > 1.5  ? 'bg-red-500'
                   : ratio > 1.25 ? 'bg-orange-500'
                   : ratio > 1.0  ? 'bg-yellow-500'
                   : 'bg-emerald-500';
  const label      = ratio > 1.5  ? 'Severe overcrowding'
                   : ratio > 1.25 ? 'Overcrowded'
                   : ratio > 1.0  ? 'At capacity'
                   : `${pop} / ${capacity}`;

  return (
    <div className="mb-4">
      <div className="flex justify-between text-xs text-slate-400 mb-1">
        <span>Shelter</span>
        <span className={ratio > 1.0 ? 'text-yellow-400 font-semibold' : 'text-slate-400'}>
          {label}
        </span>
      </div>
      <div className="h-2 bg-stone-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function BuildingCard({ building }: { building: BuiltBuilding }) {
  const def = BUILDING_CATALOG[building.defId];
  if (!def) return null;
  const displayName = getBuildingDisplayName(building.defId, building.style);
  const workerCount = (building.assignedWorkerIds ?? []).length;
  const workerCap   = def.workerSlots ?? 0;
  const isAtCap     = workerCap > 0 && workerCount >= workerCap;
  const households  = useGameStore(s => s.gameState?.households);
  const ownerName   = building.ownerHouseholdId
    ? (households?.get(building.ownerHouseholdId)?.name ?? 'Household')
    : null;

  return (
    <div className="bg-stone-800 border border-stone-700 rounded p-3 mb-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="text-sm font-medium text-slate-200">{displayName}</span>
          {building.style && (
            <span className="ml-2 text-xs text-slate-500">
              {STYLE_LABEL[building.style]}
            </span>
          )}
        </div>
        <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${CATEGORY_COLOR[def.category] ?? 'bg-stone-700 text-slate-400'}`}>
          {CATEGORY_LABEL[def.category] ?? def.category}
        </span>
      </div>
      <p className="text-xs text-slate-500 mt-1">{def.description}</p>
      {workerCap > 0 && (
        <div className="flex items-center gap-2 mt-1.5 text-xs">
          <span className="text-slate-500">Workers:</span>
          <span className={isAtCap ? 'text-amber-400 font-semibold' : 'text-slate-400'}>
            {workerCount} / {workerCap}
          </span>
          {ownerName && (
            <span className="ml-auto text-amber-700 italic text-[10px]">⌂ {ownerName}</span>
          )}
        </div>
      )}
      {workerCap === 0 && ownerName && (
        <div className="mt-1.5 text-[10px] text-amber-700 italic">⌂ {ownerName}</div>
      )}
    </div>
  );
}

function ConstructionCard({
  project,
  onAssign,
  onRemove,
  onCancel,
  availableBuilderIds,
  allPeopleNames,
}: {
  project: ConstructionProject;
  onAssign: (pid: string) => void;
  onRemove: (pid: string) => void;
  onCancel: () => void;
  availableBuilderIds: string[];
  allPeopleNames: Map<string, string>;
}) {
  const def         = BUILDING_CATALOG[project.defId];
  const progressPct = project.totalPoints > 0
    ? Math.round((project.progressPoints / project.totalPoints) * 100)
    : 0;
  const seasonsLeft = project.totalPoints > 0 && project.assignedWorkerIds.length > 0
    ? Math.ceil((project.totalPoints - project.progressPoints) / (project.assignedWorkerIds.length * 100))
    : '—';

  return (
    <div className="bg-stone-800 border border-stone-600 rounded p-3 mb-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-slate-200">
          {def ? getBuildingDisplayName(project.defId, project.style) : project.defId}
        </span>
        <button
          onClick={onCancel}
          className="text-xs text-red-400 hover:text-red-300 transition-colors"
          title="Cancel construction (50% refund)"
        >
          Cancel
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-stone-700 rounded-full overflow-hidden mb-2">
        <div
          className="h-full bg-amber-500 rounded-full transition-all"
          style={{ width: `${progressPct}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-slate-500 mb-2">
        <span>{progressPct}% complete</span>
        <span>
          {project.assignedWorkerIds.length === 0
            ? 'No builders — paused'
            : `~${seasonsLeft} season${seasonsLeft === 1 ? '' : 's'} left`}
        </span>
      </div>

      {/* Assigned builders */}
      {project.assignedWorkerIds.length > 0 && (
        <div className="mb-2">
          <span className="text-xs text-slate-500 mb-1 block">Builders:</span>
          <div className="flex flex-wrap gap-1">
            {project.assignedWorkerIds.map(pid => (
              <button
                key={pid}
                onClick={() => onRemove(pid)}
                title="Click to remove from project"
                className="text-xs bg-stone-700 hover:bg-stone-600 text-slate-300 px-2 py-0.5 rounded transition-colors"
              >
                {allPeopleNames.get(pid) ?? pid} ✕
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Assign builder selector */}
      {availableBuilderIds.length > 0 && (
        <div className="flex items-center gap-2">
          <select
            className="flex-1 text-xs bg-stone-700 border border-stone-600 text-slate-300 rounded px-2 py-1"
            defaultValue=""
            onChange={e => { if (e.target.value) { onAssign(e.target.value); e.target.value = ''; } }}
          >
            <option value="" disabled>Assign a builder…</option>
            {availableBuilderIds.map(pid => (
              <option key={pid} value={pid}>{allPeopleNames.get(pid) ?? pid}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

function BuildMenuItem({
  defId,
  style,
  allowed,
  reason,
  onBuild,
}: {
  defId: BuildingId;
  style: BuildingStyle | null;
  allowed: boolean;
  reason?: string;
  onBuild: () => void;
}) {
  const def = BUILDING_CATALOG[defId];
  if (!def) return null;
  const displayName = getBuildingDisplayName(defId, style);
  const costParts = Object.entries(def.cost)
    .filter(([, v]) => (v as number) > 0)
    .map(([k, v]) => `${v} ${k}`)
    .join(', ');

  return (
    <div className={`border rounded p-3 mb-2 ${allowed ? 'border-stone-600 bg-stone-800' : 'border-stone-700 bg-stone-900 opacity-60'}`}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <div>
          <span className={`text-sm font-medium ${allowed ? 'text-slate-200' : 'text-slate-500'}`}>
            {displayName}
          </span>
          {def.buildSeasons > 0 && (
            <span className="ml-2 text-xs text-slate-500">
              {def.buildSeasons} season{def.buildSeasons > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <button
          disabled={!allowed}
          onClick={onBuild}
          className={`text-xs px-3 py-1 rounded shrink-0 transition-colors ${
            allowed
              ? 'bg-amber-700 hover:bg-amber-600 text-amber-100 cursor-pointer'
              : 'bg-stone-700 text-stone-500 cursor-not-allowed'
          }`}
        >
          Build
        </button>
      </div>
      <p className="text-xs text-slate-500 mb-1">{def.description}</p>
      {costParts && (
        <span className="text-xs text-stone-400">Cost: {costParts}</span>
      )}
      {!allowed && reason && (
        <p className="text-xs text-red-400 mt-1">{reason}</p>
      )}
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export default function SettlementView() {
  const gameState         = useGameStore(s => s.gameState);
  const currentPhase      = useGameStore(s => s.currentPhase);
  const startConstruction = useGameStore(s => s.startConstruction);
  const assignBuilder     = useGameStore(s => s.assignBuilder);
  const removeBuilder     = useGameStore(s => s.removeBuilder);
  const cancelConstr      = useGameStore(s => s.cancelConstruction);

  const [pendingStyle, setPendingStyle] = useState<Record<string, BuildingStyle>>({});
  const [showBuildMenu, setShowBuildMenu] = useState(false);

  // Modal state for household building grid
  const [pickerState, setPickerState] = useState<{
    householdId: string;
    slotIndex: number;
  } | null>(null);
  const [slotDetailState, setSlotDetailState] = useState<{
    building: BuiltBuilding;
    householdId: string;
    slotIndex: number;
  } | null>(null);

  if (!gameState) return null;

  const { settlement, people } = gameState;
  const canManage = currentPhase === 'management' || currentPhase === 'idle';

  const shelterCap   = getShelterCapacity(settlement.buildings);
  const overcrowding = getOvercrowdingRatio(settlement.populationCount, settlement.buildings);

  const allPeople       = Array.from(people.values());
  const freeNonBuilders = allPeople.filter(p => p.role !== 'builder');
  const allPeopleNames  = new Map(allPeople.map(p => [p.id, `${p.firstName} ${p.familyName}`]));

  const allIds      = Object.keys(BUILDING_CATALOG) as BuildingId[];
  const buildableIds = allIds.filter(id => id !== 'camp');

  function handleBuild(defId: BuildingId) {
    const def = BUILDING_CATALOG[defId];
    const style = def.hasStyleVariants ? (pendingStyle[defId] ?? 'imanian') : null;
    startConstruction(defId, style);
    setShowBuildMenu(false);
  }

  // Communal buildings are those not flagged as household-only
  const communalBuildings = settlement.buildings.filter(b => {
    const def = BUILDING_CATALOG[b.defId];
    return !def || def.category !== 'dwelling';
  });

  return (
    <div className="flex gap-0 h-full overflow-hidden">

      {/* ── Left panel: settlement info + communal buildings + construction ── */}
      <div className="w-72 flex-shrink-0 flex flex-col overflow-hidden border-r border-stone-700 bg-stone-950">

        {/* Settlement header */}
        <div className="px-4 pt-4 pb-3 border-b border-stone-800">
          <h2 className="text-base font-bold text-amber-400 mb-2">{settlement.name}</h2>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            <span className="text-slate-500">Population</span>
            <span className={overcrowding > 1.0 ? 'text-red-400 font-semibold' : 'text-slate-300'}>
              {settlement.populationCount} / {shelterCap} shelter
            </span>
            <span className="text-slate-500">Company</span>
            <span className="text-slate-300">{gameState.company.standing} standing</span>
            <span className="text-slate-500">Season</span>
            <span className="text-slate-300">{settlement.currentSeason} · Year {settlement.currentYear}</span>
          </div>
          {overcrowding > 1.0 && (
            <div className="mt-2 px-2 py-1.5 bg-red-950/50 border border-red-800 rounded text-xs text-red-300">
              ⚠ Overcrowded — build more shelter.
            </div>
          )}
        </div>

        {/* Communal buildings list */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Communal Buildings
            </h3>
          </div>

          {communalBuildings.length === 0 ? (
            <p className="text-xs text-slate-600 italic mb-3">Camp only.</p>
          ) : (
            communalBuildings.map(b => (
              <BuildingCard key={b.instanceId} building={b} />
            ))
          )}

          {/* Build button */}
          <button
            disabled={!canManage}
            onClick={() => setShowBuildMenu(v => !v)}
            className="w-full mt-2 text-xs py-1.5 rounded border border-dashed border-stone-600 text-stone-400 hover:border-amber-700 hover:text-amber-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            + Build communal building
          </button>

          {/* Inline build menu */}
          {showBuildMenu && canManage && (
            <div className="mt-3 border border-stone-700 rounded bg-stone-900">
              <div className="flex items-center justify-between px-3 py-2 border-b border-stone-700">
                <span className="text-xs font-semibold text-slate-300">Build Menu</span>
                <button onClick={() => setShowBuildMenu(false)} className="text-slate-500 hover:text-slate-300 text-xs">✕</button>
              </div>
              <div className="p-2 max-h-96 overflow-y-auto">
                {(['civic', 'food', 'industry', 'social', 'defence'] as const).map(category => {
                  const ids = buildableIds.filter(id => BUILDING_CATALOG[id]?.category === category);
                  if (ids.length === 0) return null;
                  return (
                    <div key={category} className="mb-3">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-semibold mb-1.5 inline-block ${CATEGORY_COLOR[category]}`}>
                        {CATEGORY_LABEL[category]}
                      </span>
                      {ids.map(defId => {
                        const def   = BUILDING_CATALOG[defId];
                        const style = def?.hasStyleVariants ? (pendingStyle[defId] ?? 'imanian') : null;
                        const check = canBuild(settlement, defId, style);
                        return (
                          <div key={defId}>
                            {def?.hasStyleVariants && (
                              <div className="flex gap-1 mb-1">
                                {(['imanian', 'sauromatian'] as BuildingStyle[]).map(s => (
                                  <button
                                    key={s}
                                    onClick={() => setPendingStyle(prev => ({ ...prev, [defId]: s }))}
                                    className={`text-xs px-2 py-0.5 rounded transition-colors ${
                                      (pendingStyle[defId] ?? 'imanian') === s
                                        ? 'bg-amber-800 text-amber-200'
                                        : 'bg-stone-700 text-slate-400 hover:bg-stone-600'
                                    }`}
                                  >
                                    {STYLE_LABEL[s]}
                                  </button>
                                ))}
                              </div>
                            )}
                            <BuildMenuItem
                              defId={defId}
                              style={style}
                              allowed={check.ok}
                              reason={check.ok ? undefined : check.reason}
                              onBuild={() => handleBuild(defId)}
                            />
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Dwelling section */}
          {(() => {
            const dwellingIds = buildableIds.filter(id => BUILDING_CATALOG[id]?.category === 'dwelling');
            const builtCount  = settlement.buildings.filter(b => BUILDING_CATALOG[b.defId]?.category === 'dwelling').length;
            if (dwellingIds.length === 0) return null;
            return (
              <div className="mt-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${CATEGORY_COLOR.dwelling}`}>
                    {CATEGORY_LABEL.dwelling}
                  </span>
                  {builtCount > 0 && <span className="text-xs text-stone-500">{builtCount} standing</span>}
                </div>
                {dwellingIds.map(defId => {
                  const check = canBuild(settlement, defId, null);
                  return (
                    <BuildMenuItem
                      key={defId}
                      defId={defId}
                      style={null}
                      allowed={canManage && check.ok}
                      reason={!canManage ? undefined : check.ok ? undefined : check.reason}
                      onBuild={() => { startConstruction(defId, null); }}
                    />
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* Construction queue */}
        {settlement.constructionQueue.length > 0 && (
          <div className="border-t border-stone-800 px-4 py-3 max-h-72 overflow-y-auto">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Construction ({settlement.constructionQueue.length})
            </h3>
            {settlement.constructionQueue.map(proj => {
              const assigned  = new Set(proj.assignedWorkerIds);
              const available = freeNonBuilders.filter(p => !assigned.has(p.id)).map(p => p.id);
              return (
                <ConstructionCard
                  key={proj.id}
                  project={proj}
                  onAssign={pid => canManage && assignBuilder(proj.id, pid)}
                  onRemove={pid => canManage && removeBuilder(proj.id, pid)}
                  onCancel={() => canManage && cancelConstr(proj.id)}
                  availableBuilderIds={canManage ? available : []}
                  allPeopleNames={allPeopleNames}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* ── Right panel: household 3×3 building grids ───────────────────── */}
      <div className="flex-1 overflow-y-auto p-4">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Households
        </h3>

        {gameState.households.size === 0 ? (
          <div className="flex items-center justify-center h-48">
            <p className="text-sm text-slate-600 italic text-center">
              No households yet.
              <br />
              Arrange marriages to form households.
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-4">
            {Array.from(gameState.households.values()).map(hh => (
              <HouseholdCard
                key={hh.id}
                hh={hh}
                allPeople={allPeople}
                buildings={settlement.buildings}
                canManage={canManage}
                onSlotClick={(slotIndex, building) => {
                  if (building) {
                    setSlotDetailState({ building, householdId: hh.id, slotIndex });
                  } else {
                    setPickerState({ householdId: hh.id, slotIndex });
                  }
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────── */}
      {pickerState && (
        <BuildingPickerModal
          householdId={pickerState.householdId}
          mode="household"
          onClose={() => setPickerState(null)}
        />
      )}
      {slotDetailState && (
        <SlotDetailPopover
          building={slotDetailState.building}
          householdId={slotDetailState.householdId}
          slotIndex={slotDetailState.slotIndex}
          canManage={canManage}
          onClose={() => setSlotDetailState(null)}
        />
      )}

    </div>
  );
}

// ─── HouseholdCard with 3×3 building slot grid ────────────────────────────────

const SLOT_LABELS = ['Dwelling', 'Production', 'Production', 'Production', 'Production', 'Production', 'Production', 'Production', 'Production'];

function HouseholdCard({
  hh,
  allPeople,
  buildings,
  canManage,
  onSlotClick,
}: {
  hh: Household;
  allPeople: ReturnType<typeof Array.prototype.filter>;
  buildings: BuiltBuilding[];
  canManage: boolean;
  onSlotClick: (slotIndex: number, building: BuiltBuilding | null) => void;
}) {
  const slots: (string | null)[] = hh.buildingSlots ?? Array(9).fill(null);
  const members = hh.memberIds
    .map(id => (allPeople as { id: string; firstName: string }[]).find(p => p.id === id))
    .filter((p): p is { id: string; firstName: string } => !!p);

  return (
    <div className="w-52 bg-stone-900 border border-stone-700 rounded-xl overflow-hidden shrink-0">
      {/* Card header */}
      <div className="px-3 py-2 bg-stone-800 border-b border-stone-700 flex items-center gap-2">
        <span className="text-xs font-semibold text-amber-300">{hh.name}</span>
        {(hh.householdGold ?? 0) > 0 && (
          <span className="text-[10px] bg-amber-900/60 text-amber-300 border border-amber-700/50 rounded px-1 py-0.5 leading-none">
            ⚜ {hh.householdGold}g
          </span>
        )}
        <span className="ml-auto text-[10px] text-stone-500">{members.length} members</span>
      </div>

      {/* 3×3 building slot grid */}
      <div className="p-1 grid grid-cols-3 gap-0.5">
        {slots.map((instanceId, idx) => {
          const building = instanceId
            ? buildings.find(b => b.instanceId === instanceId) ?? null
            : null;
          const def = building ? BUILDING_CATALOG[building.defId] : null;
          const isOccupied = !!building;

          return (
            <button
              key={idx}
              title={isOccupied
                ? getBuildingDisplayName(building.defId, building.style)
                : `${SLOT_LABELS[idx] ?? 'Slot'} (empty — click to build)`}
              onClick={() => canManage && onSlotClick(idx, building)}
              className={`
                relative aspect-square rounded-lg border flex flex-col items-center justify-center gap-0.5 p-0.5 transition-colors
                ${isOccupied
                  ? 'bg-stone-800 border-stone-600 hover:border-amber-600'
                  : 'bg-stone-950 border-stone-700 border-dashed hover:border-stone-500'}
                ${!canManage ? 'cursor-default' : 'cursor-pointer'}
              `}
            >
              {isOccupied && def ? (
                <>
                  <BuildingIcon id={building.defId} size={34} className="text-amber-400" />
                  <span className="text-[8px] text-slate-400 text-center leading-tight line-clamp-2">
                    {getBuildingDisplayName(building.defId, building.style)}
                  </span>
                  {def.upgradeChainId && def.tierInChain !== undefined && (
                    <span className="absolute top-0.5 right-0.5 text-[7px] bg-stone-950/80 text-slate-400 rounded px-0.5 leading-tight pointer-events-none">
                      T{def.tierInChain}
                    </span>
                  )}
                </>
              ) : (
                <span className="text-stone-700 text-xs select-none">+</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Member pills */}
      <div className="px-3 pb-2">
        <div className="flex flex-wrap gap-1">
          {members.slice(0, 6).map(p => (
            <span key={p.id} className="text-[10px] bg-stone-800 text-slate-400 px-1.5 py-0.5 rounded">
              {p.firstName}
            </span>
          ))}
          {members.length > 6 && (
            <span className="text-[10px] text-stone-600">+{members.length - 6}</span>
          )}
        </div>
      </div>
    </div>
  );
}

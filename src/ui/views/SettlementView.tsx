/**
 * SettlementView — the Settlement tab.
 *
 * Three panels:
 *   Left:   Standing buildings + shelter capacity bar
 *   Centre: Active construction queue with worker assignment
 *   Right:  Build menu (available + locked buildings)
 */

import { useState } from 'react';
import { useGameStore } from '../../stores/game-store';
import { BUILDING_CATALOG, getBuildingDisplayName } from '../../simulation/buildings/building-definitions';
import { canBuild } from '../../simulation/buildings/construction';
import {
  getShelterCapacity,
  getOvercrowdingRatio,
} from '../../simulation/buildings/building-effects';
import type { BuildingId, BuildingStyle, BuiltBuilding, ConstructionProject } from '../../simulation/turn/game-state';

// ─── Helper constants ─────────────────────────────────────────────────────────

const CATEGORY_LABEL: Record<string, string> = {
  civic:    'Civic',
  food:     'Food',
  industry: 'Industry',
  defence:  'Defence',
  social:   'Social',
};

const CATEGORY_COLOR: Record<string, string> = {
  civic:    'bg-amber-900/60 text-amber-300',
  food:     'bg-green-900/60 text-green-300',
  industry: 'bg-blue-900/60 text-blue-300',
  defence:  'bg-red-900/60 text-red-300',
  social:   'bg-purple-900/60 text-purple-300',
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
  const gameState        = useGameStore(s => s.gameState);
  const currentPhase     = useGameStore(s => s.currentPhase);
  const startConstruction = useGameStore(s => s.startConstruction);
  const assignBuilder    = useGameStore(s => s.assignBuilder);
  const removeBuilder    = useGameStore(s => s.removeBuilder);
  const cancelConstr     = useGameStore(s => s.cancelConstruction);

  // Track which style is selected for style-variant buildings
  const [pendingStyle, setPendingStyle] = useState<Record<string, BuildingStyle>>({});

  if (!gameState) return null;

  const { settlement, people } = gameState;
  const canManage = currentPhase === 'management' || currentPhase === 'idle';

  // Shelter / overcrowding
  const shelterCap  = getShelterCapacity(settlement.buildings);
  const overcrowding = getOvercrowdingRatio(settlement.populationCount, settlement.buildings);

  // People available to assign as builders (not already a builder, alive)
  const allPeople = Array.from(people.values());
  const freeNonBuilders = allPeople.filter(p => p.role !== 'builder');
  const allPeopleNames  = new Map(allPeople.map(p => [p.id, `${p.firstName} ${p.familyName}`]));

  // Build menu: all building IDs that aren't in the queue already (or already built — canBuild handles that)
  const allIds = Object.keys(BUILDING_CATALOG) as BuildingId[];
  // Exclude the camp from the menu (it's the starting building, can't be built again)
  const buildableIds = allIds.filter(id => id !== 'camp');

  function handleBuild(defId: BuildingId) {
    const def = BUILDING_CATALOG[defId];
    const style = def.hasStyleVariants
      ? (pendingStyle[defId] ?? 'imanian')
      : null;
    startConstruction(defId, style);
  }

  return (
    <div className="flex gap-4 p-4 h-full overflow-hidden">

      {/* ── Left: Standing buildings ───────────────────────────────────── */}
      <div className="w-64 flex-shrink-0 flex flex-col overflow-hidden">
        <h2 className="text-base font-semibold text-amber-400 mb-3">
          {settlement.name}
        </h2>

        <ShelterBar pop={settlement.populationCount} capacity={shelterCap} />

        {overcrowding > 1.0 && (
          <div className="mb-3 px-3 py-2 bg-red-950/50 border border-red-800 rounded text-xs text-red-300">
            ⚠ Overcrowded — build more shelter to avoid penalties.
          </div>
        )}

        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Standing Buildings
        </h3>
        <div className="flex-1 overflow-y-auto">
          {settlement.buildings.length === 0 ? (
            <p className="text-xs text-slate-600 italic">None.</p>
          ) : (
            settlement.buildings.map(b => (
              <BuildingCard key={b.instanceId} building={b} />
            ))
          )}
        </div>
      </div>

      {/* ── Centre: Construction queue ─────────────────────────────────── */}
      <div className="w-72 flex-shrink-0 flex flex-col overflow-hidden">
        <h3 className="text-base font-semibold text-slate-300 mb-3">
          Construction
        </h3>

        {settlement.constructionQueue.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-slate-600 italic text-center">
              No projects in progress.
              <br />
              Start building from the menu.
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {settlement.constructionQueue.map(proj => {
              const assigned    = new Set(proj.assignedWorkerIds);
              const available   = freeNonBuilders
                .filter(p => !assigned.has(p.id))
                .map(p => p.id);
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

      {/* ── Right: Build menu ──────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <h3 className="text-base font-semibold text-slate-300 mb-3">
          Build Menu
        </h3>

        {!canManage && (
          <div className="mb-3 px-3 py-2 bg-stone-800 border border-stone-600 rounded text-xs text-slate-400">
            Construction can only be queued during the Management phase.
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {buildableIds.map(defId => {
            const def    = BUILDING_CATALOG[defId];
            const style  = def.hasStyleVariants
              ? (pendingStyle[defId] ?? 'imanian')
              : null;
            const check  = canBuild(settlement, defId, style);

            return (
              <div key={defId}>
                {def.hasStyleVariants && (
                  <div className="flex gap-1 mb-1 mt-1">
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
                  allowed={canManage && check.ok}
                  reason={!canManage ? undefined : check.ok ? undefined : check.reason}
                  onBuild={() => handleBuild(defId)}
                />
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}

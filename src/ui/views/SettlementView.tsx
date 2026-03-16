/**
 * SettlementView — the Settlement tab.
 *
 * Four panels:
 *   Left:    Standing buildings + shelter capacity bar
 *   Centre:  Active construction queue with worker assignment
 *   Right:   Build menu (available + locked buildings)
 *   Far-right: Crafting panel (workshop recipes)
 */

import { useState } from 'react';
import { useGameStore } from '../../stores/game-store';
import { BUILDING_CATALOG, getBuildingDisplayName } from '../../simulation/buildings/building-definitions';
import { canBuild } from '../../simulation/buildings/construction';
import {
  getShelterCapacity,
  getOvercrowdingRatio,
} from '../../simulation/buildings/building-effects';
import { getAvailableCrafts, CRAFT_RECIPES, validateCraft } from '../../simulation/economy/crafting';
import type { CraftRecipeId } from '../../simulation/economy/crafting';
import type { BuildingId, BuildingStyle, BuiltBuilding, ConstructionProject, ResourceType, ReligiousPolicy, CourtshipNorms } from '../../simulation/turn/game-state';
import { RESOURCE_EMOJI } from '../shared/resource-display';
import { computeReligiousTension } from '../../simulation/population/culture';
import { IdentityScale } from '../components/IdentityScale';
import { factionLabel } from '../../simulation/world/factions';
import ActivityFeed from '../components/ActivityFeed';
import PersonDetail from './PersonDetail';

// ─── Factions Panel ──────────────────────────────────────────────────────────

const FACTION_COLOR: Record<string, string> = {
  cultural_preservationists: 'text-emerald-300 bg-emerald-950/50 border-emerald-700',
  company_loyalists:         'text-amber-300  bg-amber-950/50  border-amber-700',
  orthodox_faithful:         'text-yellow-300 bg-yellow-950/50 border-yellow-700',
  wheel_devotees:            'text-violet-300 bg-violet-950/50 border-violet-700',
  community_elders:          'text-stone-300  bg-stone-800/50  border-stone-600',
  merchant_bloc:             'text-blue-300   bg-blue-950/50   border-blue-700',
};

function FactionsPanel({ factions, people }: { factions: import('../../simulation/turn/game-state').Faction[]; people: Map<string, import('../../simulation/population/person').Person>; }) {
  if (factions.length === 0) {
    return (
      <p className="text-xs text-stone-500 italic">
        No factions have formed yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {factions.map(faction => {
        const colorCls = FACTION_COLOR[faction.type] ?? 'text-stone-300 bg-stone-800/50 border-stone-600';
        const strengthPct = Math.round(faction.strength * 100);
        const spokespersonId = faction.memberIds[0];
        const spokesperson = spokespersonId ? people.get(spokespersonId) : undefined;
        return (
          <div key={faction.id} className={`rounded border p-2 text-xs ${colorCls}`}>
            <div className="font-semibold mb-1">{factionLabel(faction.type)}</div>
            {spokesperson && (
              <div className="text-stone-400 mb-1">
                {faction.memberIds.length} member{faction.memberIds.length !== 1 ? 's' : ''}
                {' · '}led by {spokesperson.firstName}
              </div>
            )}
            <div className="flex items-center gap-1 mb-1">
              <span className="text-stone-400">Strength</span>
              <div className="flex-1 bg-stone-700 rounded-full h-1.5 mx-1">
                <div
                  className="h-1.5 rounded-full bg-current opacity-80"
                  style={{ width: `${strengthPct}%` }}
                />
              </div>
              <span>{strengthPct}%</span>
            </div>
            {faction.activeDemand && (
              <div className="mt-1 px-2 py-1 bg-black/30 rounded text-stone-300 italic">
                ⚑ {faction.activeDemand.description}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

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

// ─── Religion Panel ───────────────────────────────────────────────────────────

const POLICY_LABELS: Record<ReligiousPolicy, string> = {
  tolerant:                'Tolerant',
  orthodox_enforced:       'Orthodox Enforced',
  wheel_permitted:         'Wheel Permitted',
  hidden_wheel_recognized: 'Hidden Wheel Recognized',
};

const COURTSHIP_LABELS: Record<CourtshipNorms, string> = {
  traditional: 'Traditional (Imanian)',
  mixed:       'Mixed (Settled)',
  open:        'Open (Sauromatian)',
};

const COURTSHIP_DESCRIPTIONS: Record<CourtshipNorms, string> = {
  traditional: 'Marriages arranged by family elders. Courtship by women is frowned upon.',
  mixed:       'Family approval expected, but individuals may show interest openly.',
  open:        'Women may pursue directly. Matches follow Sauromatian custom.',
};

function CourtshipPanel({ disabled }: { disabled: boolean }) {
  const gameState         = useGameStore(s => s.gameState);
  const setCourtshipNorms = useGameStore(s => s.setCourtshipNorms);

  if (!gameState) return null;

  const norms = gameState.settlement.courtshipNorms ?? 'mixed';

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Courtship Custom</p>
      <select
        disabled={disabled}
        value={norms}
        onChange={e => setCourtshipNorms(e.target.value as CourtshipNorms)}
        className="w-full text-xs bg-stone-800 border border-stone-600 text-slate-300 rounded px-2 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {(['traditional', 'mixed', 'open'] as CourtshipNorms[]).map(n => (
          <option key={n} value={n}>{COURTSHIP_LABELS[n]}</option>
        ))}
      </select>
      <p className="text-xs text-slate-500">{COURTSHIP_DESCRIPTIONS[norms]}</p>
    </div>
  );
}

function CourtshipNudgeBanner() {
  const pending             = useGameStore(s => s.pendingCourtshipNudge);
  const setCourtshipNorms   = useGameStore(s => s.setCourtshipNorms);
  const dismissNudge        = useGameStore(s => s.dismissCourtshipNudge);

  if (!pending) return null;

  return (
    <div className="mt-2 p-2 bg-indigo-950/70 border border-indigo-700 rounded text-xs text-indigo-200 space-y-2">
      <p>
        <span className="font-semibold">Sauromatian custom:</span> Recognising the Hidden Wheel
        sits uneasily with strict Imanian courtship norms. Consider shifting to Mixed custom.
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => { setCourtshipNorms('mixed'); dismissNudge(); }}
          className="flex-1 px-2 py-1 bg-indigo-700 hover:bg-indigo-600 rounded text-white"
        >
          Shift to Mixed
        </button>
        <button
          onClick={dismissNudge}
          className="flex-1 px-2 py-1 bg-stone-700 hover:bg-stone-600 rounded text-slate-300"
        >
          Keep Traditional
        </button>
      </div>
    </div>
  );
}

const FAITH_LABELS: Record<string, string> = {
  imanian_orthodox:       'Solar Church',
  sacred_wheel:           'Sacred Wheel',
  syncretic_hidden_wheel: 'Hidden Wheel',
};

const FAITH_COLORS: Record<string, string> = {
  imanian_orthodox:       'bg-yellow-500',
  sacred_wheel:           'bg-teal-500',
  syncretic_hidden_wheel: 'bg-indigo-500',
};

function ReligionPanel({ disabled }: { disabled: boolean }) {
  const gameState          = useGameStore(s => s.gameState);
  const setReligiousPolicy = useGameStore(s => s.setReligiousPolicy);

  if (!gameState) return null;

  const { culture, settlement } = gameState;
  const tension = computeReligiousTension(culture.religions);
  const tensionPct = Math.round(tension * 100);
  const tensionColor = tension >= 0.75 ? 'bg-red-500'
                     : tension >= 0.50 ? 'bg-orange-500'
                     : tension >= 0.25 ? 'bg-yellow-500'
                     : 'bg-emerald-600';

  const policyOptions: ReligiousPolicy[] = [
    'tolerant',
    'orthodox_enforced',
    'wheel_permitted',
    ...(culture.hiddenWheelEmerged ? ['hidden_wheel_recognized' as ReligiousPolicy] : []),
  ];

  return (
    <div className="space-y-3">

      {/* Faith distribution */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Faiths</p>
        {Array.from(culture.religions.entries())
          .sort(([, a], [, b]) => b - a)
          .map(([id, fraction]) => {
            const pct = Math.round(fraction * 100);
            if (pct === 0) return null;
            return (
              <div key={id} className="mb-1.5">
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="text-slate-300">{FAITH_LABELS[id] ?? id}</span>
                  <span className="text-slate-500">{pct}%</span>
                </div>
                <div className="h-1.5 bg-stone-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${FAITH_COLORS[id] ?? 'bg-stone-500'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
      </div>

      {/* Tension */}
      <div>
        <div className="flex justify-between text-xs mb-0.5">
          <span className="text-slate-400">Religious Tension</span>
          <span className={tension >= 0.50 ? 'text-orange-400 font-semibold' : 'text-slate-500'}>
            {tensionPct}%
          </span>
        </div>
        <div className="h-1.5 bg-stone-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${tensionColor}`}
            style={{ width: `${tensionPct}%` }}
          />
        </div>
      </div>

      {/* Hidden Wheel divergence progress */}
      {!culture.hiddenWheelEmerged && culture.hiddenWheelDivergenceTurns > 0 && (
        <div>
          <div className="flex justify-between text-xs mb-0.5">
            <span className="text-indigo-400">Hidden Wheel stirring…</span>
            <span className="text-slate-500">{culture.hiddenWheelDivergenceTurns} / 20</span>
          </div>
          <div className="h-1 bg-stone-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-indigo-600"
              style={{ width: `${(culture.hiddenWheelDivergenceTurns / 20) * 100}%` }}
            />
          </div>
          {culture.hiddenWheelSuppressedTurns > 0 && (
            <p className="text-xs text-slate-500 mt-0.5">
              Suppressed ({culture.hiddenWheelSuppressedTurns} turns remaining)
            </p>
          )}
        </div>
      )}

      {/* Emerged badge */}
      {culture.hiddenWheelEmerged && (
        <div className="text-xs px-2 py-1 bg-indigo-950/60 border border-indigo-800 rounded text-indigo-300">
          ✦ The Hidden Wheel has emerged
        </div>
      )}

      {/* Policy selector */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Policy</p>
        <select
          disabled={disabled}
          value={settlement.religiousPolicy}
          onChange={e => setReligiousPolicy(e.target.value as ReligiousPolicy)}
          className="w-full text-xs bg-stone-800 border border-stone-600 text-slate-300 rounded px-2 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {policyOptions.map(p => (
            <option key={p} value={p}>{POLICY_LABELS[p]}</option>
          ))}
        </select>
        {settlement.religiousPolicy === 'orthodox_enforced' && (
          <p className="text-xs text-slate-500 mt-1">Company drain: none. Wheel ceremonies blocked.</p>
        )}
        {settlement.religiousPolicy === 'hidden_wheel_recognized' && (
          <p className="text-xs text-indigo-400 mt-1">Company drain: doubled. Syncretic spread enabled.</p>
        )}
      </div>

    </div>
  );
}

// ─── Crafting Panel ───────────────────────────────────────────────────────────

function CraftingPanel({ disabled }: { disabled: boolean }) {
  const gameState   = useGameStore(s => s.gameState);
  const performCraft = useGameStore(s => s.performCraft);
  const [feedback, setFeedback] = useState<string | null>(null);

  if (!gameState) return null;

  const { settlement } = gameState;
  const resources  = settlement.resources;
  const available  = getAvailableCrafts(settlement.buildings, resources);
  const availableIds = new Set(available.map(r => r.id));

  function handleCraft(id: CraftRecipeId) {
    const check = validateCraft(id, settlement.buildings, resources);
    if (!check.ok) { setFeedback(`Cannot craft: ${check.reason}`); return; }
    performCraft(id);
    const recipe = Object.values(CRAFT_RECIPES).find(r => r.id === id);
    setFeedback(`Crafted: ${recipe?.label ?? id}`);
  }

  function fmtResources(res: Partial<Record<ResourceType, number>>) {
    return Object.entries(res)
      .filter(([, v]) => (v as number) > 0)
      .map(([k, v]) => `${RESOURCE_EMOJI[k as ResourceType] ?? ''}${v} ${k}`)
      .join(', ');
  }

  return (
    <div className="space-y-2">
      {feedback && (
        <p className="text-xs text-emerald-400 px-1">{feedback}</p>
      )}
      {Object.values(CRAFT_RECIPES).length === 0 && (
        <p className="text-xs text-slate-600 italic">No recipes available.</p>
      )}
      {Object.values(CRAFT_RECIPES).map(recipe => {
        const unlocked    = availableIds.has(recipe.id);
        const validation  = disabled ? { ok: false as const, reason: 'Management phase only' }
                          : validateCraft(recipe.id, settlement.buildings, resources);
        const canCraft    = validation.ok;

        return (
          <div
            key={recipe.id}
            className={`rounded border p-2.5 ${unlocked ? 'border-stone-600 bg-stone-800' : 'border-stone-700 bg-stone-800/40 opacity-60'}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <span className="text-xs font-medium text-slate-200">{recipe.label}</span>
                <p className="text-xs text-slate-500 mt-0.5">{recipe.description}</p>
                <p className="text-xs text-stone-400 mt-1">
                  <span className="text-stone-500">Needs: </span>{fmtResources(recipe.requires.resources)}
                  {recipe.requires.buildings && recipe.requires.buildings.length > 0 && (
                    <span className="text-stone-500"> + {recipe.requires.buildings.join(', ')}</span>
                  )}
                </p>
                <p className="text-xs text-emerald-400 mt-0.5">
                  <span className="text-stone-500">Makes: </span>{fmtResources(recipe.produces)}
                </p>
              </div>
              <button
                onClick={() => handleCraft(recipe.id)}
                disabled={!canCraft}
                className="shrink-0 px-2 py-1 text-xs rounded bg-amber-700 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-amber-100 font-medium"
              >
                Craft
              </button>
            </div>
            {!canCraft && !disabled && !validation.ok && (
              <p className="text-xs text-red-400 mt-1">{validation.reason}</p>
            )}
          </div>
        );
      })}
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
  const [personDetailId, setPersonDetailId] = useState<string | null>(null);

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
          {(['civic', 'food', 'industry', 'social', 'defence', 'dwelling'] as const).map(category => {
            const ids = buildableIds.filter(id => BUILDING_CATALOG[id]?.category === category);
            if (ids.length === 0) return null;
            const dwellingBuiltCount = category === 'dwelling'
              ? settlement.buildings.filter(b => BUILDING_CATALOG[b.defId]?.category === 'dwelling').length
              : 0;
            return (
              <div key={category} className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${CATEGORY_COLOR[category]}`}>
                    {CATEGORY_LABEL[category]}
                  </span>
                  {category === 'dwelling' && dwellingBuiltCount > 0 && (
                    <span className="text-xs text-stone-500">{dwellingBuiltCount} standing</span>
                  )}
                </div>
                {ids.map(defId => {
                  const def   = BUILDING_CATALOG[defId];
                  const style = def?.hasStyleVariants
                    ? (pendingStyle[defId] ?? 'imanian')
                    : null;
                  const check = canBuild(settlement, defId, style);
                  return (
                    <div key={defId}>
                      {def?.hasStyleVariants && (
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
            );
          })}
        </div>
      </div>

      {/* ── Far-right: Crafting ────────────────────────────────────────── */}
      <div className="w-56 flex-shrink-0 flex flex-col overflow-hidden border-l border-stone-700 pl-4">
        <h3 className="text-base font-semibold text-slate-300 mb-3">
          Crafting
        </h3>
        <div className="flex-1 overflow-y-auto">
          <CraftingPanel disabled={!canManage} />
        </div>
      </div>

      {/* ── Religion panel ─────────────────────────────────────────────── */}
      <div className="w-56 flex-shrink-0 flex flex-col overflow-hidden border-l border-stone-700 pl-4">
        <h3 className="text-base font-semibold text-slate-300 mb-3">
          Religion
        </h3>
        <div className="flex-1 overflow-y-auto">
          <IdentityScale
            culturalBlend={gameState.culture.culturalBlend}
            identityPressure={gameState.identityPressure}
          />
          <div className="border-b border-stone-700 my-4" />
          <ReligionPanel disabled={!canManage} />
          <div className="border-b border-stone-700 my-4" />
          <CourtshipPanel disabled={!canManage} />
          <CourtshipNudgeBanner />
        </div>
      </div>

      {/* ── Factions panel ─────────────────────────────────────────────── */}
      <div className="w-56 flex-shrink-0 flex flex-col overflow-hidden border-l border-stone-700 pl-4">
        <h3 className="text-base font-semibold text-slate-300 mb-3">
          Factions
        </h3>
        <div className="flex-1 overflow-y-auto">
          <FactionsPanel factions={gameState.factions ?? []} people={people} />
          <ActivityFeed
            entries={gameState.activityLog}
            people={people}
            graveyard={gameState.graveyard}
            onNavigate={id => setPersonDetailId(id)}
          />
        </div>
      </div>

      {/* ── PersonDetail overlay (triggered from ActivityFeed) ─────────── */}
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

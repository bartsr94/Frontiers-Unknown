/**
 * FamilyTreeOverlay — full-screen modal with two tabs:
 *   • Family Tree  — re-rootable portrait tree, all generations, expand buttons
 *   • Household    — role-grouped member cards with management actions
 *
 * Opened via the "Family Tree & Household" button in PersonDetail.
 * Navigation history lets the user re-root on any family member and
 * press ← Back to return to the previous root without closing the overlay.
 */

import { useState, useMemo } from 'react';
import { useGameStore } from '../../stores/game-store';
import type { Person, HouseholdRole, WorkRole } from '../../simulation/population/person';
import type { GraveyardEntry, BuiltBuilding } from '../../simulation/turn/game-state';
import { skinToneColor } from '../components/Portrait';
import { resolvePortraitSrc, resolveDeceasedPortraitSrc } from '../components/portrait-resolver';
import { TRAIT_DEFINITIONS } from '../../data/trait-definitions';
import { ROLE_LABELS, ROLE_COLORS } from '../shared/role-display';
import { computeHappiness, getHappinessLabel, getHappinessColor } from '../../simulation/population/happiness';
import { BUILDING_CATALOG, getBuildingDisplayName } from '../../simulation/buildings/building-definitions';
import MarriageDialog from './MarriageDialog';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface TreeNode {
  id: string;
  firstName: string;
  familyName: string;
  isLiving: boolean;
  sex: 'male' | 'female';
  /** Fractional age for living; undefined for deceased. */
  age?: number;
  birthYear: number;
  deathYear?: number;
  parentIds: [string | null, string | null];
  childrenIds: string[];
  spouseIds: string[];
  skinTone?: number;
  traits: string[];
  /** Pre-resolved portrait path (null = SVG fallback). */
  portraitSrc: string | null;
}

interface FamilyTreeOverlayProps {
  rootPersonId: string;
  onClose: () => void;
  /** Called when the user requests navigation to a specific person's detail panel. */
  onNavigateToPerson?: (id: string) => void;
}

// ─── Lookup hook ───────────────────────────────────────────────────────────────

function useNodeLookup(): (id: string) => TreeNode | null {
  const people    = useGameStore(s => s.gameState?.people);
  const graveyard = useGameStore(s => s.gameState?.graveyard ?? []);

  return useMemo(() => {
    return (id: string): TreeNode | null => {
      if (!id) return null;
      const living = people?.get(id);
      if (living) {
        return {
          id: living.id,
          firstName: living.firstName,
          familyName: living.familyName,
          isLiving: true,
          sex: living.sex,
          age: living.age,
          birthYear: 0,
          parentIds: living.parentIds,
          childrenIds: living.childrenIds,
          spouseIds: living.spouseIds,
          skinTone: living.genetics.visibleTraits.skinTone,
          traits: living.traits.slice(0, 2),
          portraitSrc: resolvePortraitSrc(living),
        };
      }
      const dead = graveyard.find(g => g.id === id);
      if (dead) {
        return {
          id: dead.id,
          firstName: dead.firstName,
          familyName: dead.familyName,
          isLiving: false,
          sex: dead.sex,
          birthYear: dead.birthYear,
          deathYear: dead.deathYear,
          parentIds: dead.parentIds,
          childrenIds: dead.childrenIds,
          spouseIds: [],
          traits: [],
          portraitSrc: resolveDeceasedPortraitSrc(dead),
        };
      }
      return null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [people, graveyard]);
}

// ─── Tree tier builder ─────────────────────────────────────────────────────────

/**
 * Builds ordered generation tiers from oldest ancestors (row 0) to youngest
 * descendants. Root sits at index `rootTierIndex`.
 *
 * Auto-expands 2 levels of ancestors (parents + grandparents) and 2 levels of
 * descendants (children + grandchildren). Beyond that, a node must be in
 * `expandedAbove` / `expandedBelow` for its next generation to appear.
 */
function buildTiers(
  rootId: string,
  lookup: (id: string) => TreeNode | null,
  expandedAbove: Set<string>,
  expandedBelow: Set<string>,
): { tiers: TreeNode[][]; rootTierIndex: number; spouses: TreeNode[] } {
  const ancestorTiers: TreeNode[][] = [];
  const descendantTiers: TreeNode[][] = [];
  const seen = new Set<string>();
  seen.add(rootId);

  function addAncestors(ids: string[], autoLevelsLeft: number) {
    const nodes = ids
      .filter(id => !seen.has(id))
      .map(id => lookup(id))
      .filter(Boolean) as TreeNode[];
    if (nodes.length === 0) return;
    nodes.forEach(n => seen.add(n.id));
    ancestorTiers.unshift(nodes);

    const nextIds: string[] = [];
    for (const node of nodes) {
      if (autoLevelsLeft > 0 || expandedAbove.has(node.id)) {
        for (const pid of node.parentIds) {
          if (pid && !nextIds.includes(pid) && !seen.has(pid)) nextIds.push(pid);
        }
      }
    }
    if (nextIds.length > 0) addAncestors(nextIds, autoLevelsLeft - 1);
  }

  function addDescendants(ids: string[], autoLevelsLeft: number) {
    const nodes = ids
      .filter(id => !seen.has(id))
      .map(id => lookup(id))
      .filter(Boolean) as TreeNode[];
    if (nodes.length === 0) return;
    nodes.forEach(n => seen.add(n.id));
    descendantTiers.push(nodes);

    const nextIds: string[] = [];
    for (const node of nodes) {
      if (autoLevelsLeft > 0 || expandedBelow.has(node.id)) {
        for (const cid of node.childrenIds) {
          if (!nextIds.includes(cid) && !seen.has(cid)) nextIds.push(cid);
        }
      }
    }
    if (nextIds.length > 0) addDescendants(nextIds, autoLevelsLeft - 1);
  }

  const root = lookup(rootId);
  if (!root) return { tiers: [], rootTierIndex: 0, spouses: [] };

  const rootParentIds = root.parentIds.filter(Boolean) as string[];
  if (rootParentIds.length > 0) addAncestors(rootParentIds, 1);
  if (root.childrenIds.length > 0) addDescendants(root.childrenIds, 1);

  const spouses = root.spouseIds
    .filter(id => !seen.has(id))
    .map(id => lookup(id))
    .filter(Boolean) as TreeNode[];

  return {
    tiers: [...ancestorTiers, [root], ...descendantTiers],
    rootTierIndex: ancestorTiers.length,
    spouses,
  };
}

// ─── Trait abbreviation map ────────────────────────────────────────────────────

function traitAbbr(id: string): string {
  const def = TRAIT_DEFINITIONS[id as keyof typeof TRAIT_DEFINITIONS];
  if (def?.name) return def.name.slice(0, 4).toUpperCase();
  return id.slice(0, 3).toUpperCase();
}

// ─── NodeCard ──────────────────────────────────────────────────────────────────

interface NodeCardProps {
  node: TreeNode;
  isRoot: boolean;
  /** Set of ALL rendered node IDs — used to compute expand button visibility. */
  renderedIds: Set<string>;
  onSelect: () => void;
  onExpandUp: () => void;
  onExpandDown: () => void;
}

function NodeCard({ node, isRoot, renderedIds, onSelect, onExpandUp, onExpandDown }: NodeCardProps) {
  const [imgFailed, setImgFailed] = useState(false);

  const hasHiddenParents = node.parentIds.some(pid => pid && !renderedIds.has(pid));
  const hasHiddenChildren = node.childrenIds.some(cid => !renderedIds.has(cid));

  const skinBg = node.skinTone !== undefined ? skinToneColor(node.skinTone) : '#4a3728';
  const showImage = !!node.portraitSrc && !imgFailed;

  const yearLine = node.isLiving
    ? `age ${Math.floor(node.age ?? 0)}`
    : `${node.birthYear > 0 ? node.birthYear : '?'} – ${node.deathYear ?? '?'}`;

  return (
    <div className="flex flex-col items-center gap-0.5">
      {/* ▲+ expand upward button */}
      {hasHiddenParents && !isRoot && (
        <button
          onClick={onExpandUp}
          className="text-stone-500 hover:text-amber-400 text-[11px] leading-none font-bold px-1.5 py-0.5 rounded hover:bg-stone-800 transition-colors"
          title="Show ancestors"
        >
          ▲+
        </button>
      )}

      {/* Main card */}
      <button
        onClick={!isRoot ? onSelect : undefined}
        disabled={isRoot}
        className={[
          'flex flex-col items-center rounded border overflow-hidden transition-colors text-left',
          'w-[5.5rem]',
          isRoot
            ? 'border-amber-500 bg-amber-950/40 cursor-default'
            : node.isLiving
              ? 'border-stone-600 bg-stone-800 hover:border-stone-400 hover:bg-stone-700 cursor-pointer'
              : 'border-stone-700 bg-stone-900 hover:border-stone-600 cursor-pointer',
        ].join(' ')}
        title={isRoot ? undefined : `Click to view ${node.firstName}'s family tree`}
      >
        {/* Portrait area */}
        <div
          className="relative w-full overflow-hidden flex-shrink-0"
          style={{ height: '4.5rem', backgroundColor: skinBg }}
        >
          {showImage ? (
            <img
              src={node.portraitSrc!}
              alt={`${node.firstName} ${node.familyName}`}
              className={[
                'absolute inset-0 w-full h-full object-cover object-top',
                !node.isLiving ? 'grayscale opacity-50' : '',
              ].join(' ')}
              onError={() => setImgFailed(true)}
            />
          ) : (
            <svg
              viewBox="0 0 56 72"
              className={['absolute inset-0 w-full h-full', !node.isLiving ? 'opacity-40' : ''].join(' ')}
              aria-hidden="true"
            >
              <circle cx="28" cy="22" r="12" fill="rgba(0,0,0,0.25)" />
              <ellipse cx="28" cy="60" rx="19" ry="14" fill="rgba(0,0,0,0.25)" />
            </svg>
          )}
          {/* Deceased overlay */}
          {!node.isLiving && (
            <div className="absolute bottom-0 left-0 right-0 bg-stone-950/60 text-center">
              <span className="text-stone-500 text-[10px]">†</span>
            </div>
          )}
        </div>

        {/* Info area */}
        <div className="px-1 py-1 w-full text-center">
          <div className="flex items-center justify-center gap-0.5 leading-tight">
            <span className={`text-[10px] ${node.sex === 'female' ? 'text-rose-400' : 'text-sky-400'}`}>
              {node.sex === 'female' ? '♀' : '♂'}
            </span>
            <span className={`font-semibold text-[11px] truncate ${node.isLiving ? (isRoot ? 'text-amber-200' : 'text-stone-100') : 'text-stone-500'}`}>
              {node.firstName}
            </span>
          </div>
          <div className={`text-[10px] truncate ${node.isLiving ? 'text-stone-400' : 'text-stone-600'}`}>
            {node.familyName}
          </div>
          <div className={`text-[10px] ${node.isLiving ? 'text-stone-500' : 'text-stone-700'}`}>
            {yearLine}
          </div>
          {node.traits.length > 0 && (
            <div className="flex justify-center gap-0.5 mt-0.5 flex-wrap">
              {node.traits.map(t => (
                <span key={t} className="text-[9px] px-0.5 py-0 rounded bg-stone-700 text-stone-400 leading-tight">
                  {traitAbbr(t)}
                </span>
              ))}
            </div>
          )}
        </div>
      </button>

      {/* ▼+ expand downward button */}
      {hasHiddenChildren && !isRoot && (
        <button
          onClick={onExpandDown}
          className="text-stone-500 hover:text-amber-400 text-[11px] leading-none font-bold px-1.5 py-0.5 rounded hover:bg-stone-800 transition-colors"
          title="Show descendants"
        >
          ▼+
        </button>
      )}
    </div>
  );
}

// ─── FamilyTreeTab ─────────────────────────────────────────────────────────────

interface FamilyTreeTabProps {
  treeRootId: string;
  expandedAbove: Set<string>;
  expandedBelow: Set<string>;
  onReRoot: (id: string) => void;
  onExpandAbove: (nodeId: string) => void;
  onExpandBelow: (nodeId: string) => void;
}

function FamilyTreeTab({
  treeRootId,
  expandedAbove,
  expandedBelow,
  onReRoot,
  onExpandAbove,
  onExpandBelow,
}: FamilyTreeTabProps) {
  const lookup = useNodeLookup();

  const { tiers, rootTierIndex, spouses } = useMemo(
    () => buildTiers(treeRootId, lookup, expandedAbove, expandedBelow),
    [treeRootId, lookup, expandedAbove, expandedBelow],
  );

  // Each direct child of root paired with their spouse(s) (spouses not already in the tree)
  const childUnits = useMemo(() => {
    const childTier = tiers[rootTierIndex + 1];
    if (!childTier) return [];
    const allTierIds = new Set<string>();
    tiers.forEach(tier => tier.forEach(n => allTierIds.add(n.id)));
    spouses.forEach(s => allTierIds.add(s.id));
    return childTier.map(child => ({
      child,
      childSpouses: child.spouseIds
        .map(id => lookup(id))
        .filter((n): n is TreeNode => n !== null && !allTierIds.has(n.id)),
    }));
  }, [tiers, rootTierIndex, spouses, lookup]);

  // Grandchildren grouped by which child of root is their parent (each GC attributed once)
  const gcBlocks = useMemo(() => {
    const gcTier   = tiers[rootTierIndex + 2];
    const childTier = tiers[rootTierIndex + 1];
    if (!gcTier || !childTier) return null;
    const attributedIds = new Set<string>();
    return childTier
      .map(child => {
        const nodes = gcTier.filter(
          gc => child.childrenIds.includes(gc.id) && !attributedIds.has(gc.id),
        );
        nodes.forEach(n => attributedIds.add(n.id));
        return { parentId: child.id, parentFirstName: child.firstName, nodes };
      })
      .filter(b => b.nodes.length > 0);
  }, [tiers, rootTierIndex]);

  const renderedIds = useMemo(() => {
    const ids = new Set<string>();
    tiers.forEach(tier => tier.forEach(n => ids.add(n.id)));
    spouses.forEach(s => ids.add(s.id));
    childUnits.forEach(u => u.childSpouses.forEach(s => ids.add(s.id)));
    return ids;
  }, [tiers, spouses, childUnits]);

  if (tiers.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-stone-500 italic text-sm">
        No family records found.
      </div>
    );
  }

  const genLabel = (tierIdx: number): string => {
    const d = tierIdx - rootTierIndex;
    if (d === -1) return 'Parents';
    if (d === -2) return 'Grandparents';
    if (d === -3) return 'Great-Grandparents';
    if (d <  -3)  return `Ancestors (${-d}g)`;
    if (d ===  1) return 'Children';
    if (d ===  2) return 'Grandchildren';
    if (d ===  3) return 'Great-Grandchildren';
    return `Descendants (${d}g)`;
  };

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="flex flex-col items-center gap-4 min-w-max mx-auto">
        {tiers.map((tier, tierIdx) => {
          const isRootTier         = tierIdx === rootTierIndex;
          const isChildrenTier     = tierIdx === rootTierIndex + 1;
          const isGrandchildrenTier = tierIdx === rootTierIndex + 2;

          return (
            <div key={tierIdx} className="flex flex-col items-center gap-2 w-full">
              {/* Generation label */}
              {!isRootTier && (
                <span className="text-stone-600 text-[10px] uppercase tracking-widest">
                  {genLabel(tierIdx)}
                </span>
              )}

              {/* Connector line from tier above */}
              {tierIdx > 0 && <div className="w-px h-4 bg-stone-700" />}

              {/* Node rows — specialised for root / children / grandchildren */}
              {isRootTier ? (
                <div className="flex flex-wrap justify-center gap-3 items-start">
                  <NodeCard
                    node={tier[0]!}
                    isRoot
                    renderedIds={renderedIds}
                    onSelect={() => {}}
                    onExpandUp={() => onExpandAbove(tier[0]!.id)}
                    onExpandDown={() => onExpandBelow(tier[0]!.id)}
                  />
                  {spouses.length > 0 && (
                    <>
                      <div className="flex items-center self-center">
                        <div className="w-3 h-px bg-stone-600" />
                        <span className="text-stone-500 text-sm mx-0.5" title="Spouse(s)">⚭</span>
                        <div className="w-3 h-px bg-stone-600" />
                      </div>
                      <div className="flex flex-col gap-2">
                        {spouses.map(spouse => (
                          <NodeCard
                            key={spouse.id}
                            node={spouse}
                            isRoot={false}
                            renderedIds={renderedIds}
                            onSelect={() => onReRoot(spouse.id)}
                            onExpandUp={() => onExpandAbove(spouse.id)}
                            onExpandDown={() => onExpandBelow(spouse.id)}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ) : isChildrenTier ? (
                /* Each child shown beside their own spouse(s) */
                <div className="flex flex-wrap justify-center gap-5 items-start">
                  {childUnits.map(({ child, childSpouses }) => (
                    <div key={child.id} className="flex items-center gap-1">
                      <NodeCard
                        node={child}
                        isRoot={false}
                        renderedIds={renderedIds}
                        onSelect={() => onReRoot(child.id)}
                        onExpandUp={() => onExpandAbove(child.id)}
                        onExpandDown={() => onExpandBelow(child.id)}
                      />
                      {childSpouses.length > 0 && (
                        <>
                          <div className="flex items-center">
                            <div className="w-2 h-px bg-stone-700" />
                            <span className="text-stone-600 text-[10px] leading-none mx-0.5">⚭</span>
                            <div className="w-2 h-px bg-stone-700" />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            {childSpouses.map(s => (
                              <NodeCard
                                key={s.id}
                                node={s}
                                isRoot={false}
                                renderedIds={renderedIds}
                                onSelect={() => onReRoot(s.id)}
                                onExpandUp={() => onExpandAbove(s.id)}
                                onExpandDown={() => onExpandBelow(s.id)}
                              />
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              ) : isGrandchildrenTier && gcBlocks && gcBlocks.length > 0 ? (
                /* Grandchildren grouped under their parent */
                <div className="flex flex-wrap justify-center gap-5 items-start">
                  {gcBlocks.map(block => (
                    <div key={block.parentId} className="flex flex-col items-center gap-1 px-3 pb-2 pt-1.5 rounded border border-stone-800 bg-stone-900/50">
                      <span className="text-stone-500 text-[9px] italic">via {block.parentFirstName}</span>
                      <div className="w-px h-1.5 bg-stone-800" />
                      <div className="flex flex-wrap gap-2 justify-center">
                        {block.nodes.map(gc => (
                          <NodeCard
                            key={gc.id}
                            node={gc}
                            isRoot={false}
                            renderedIds={renderedIds}
                            onSelect={() => onReRoot(gc.id)}
                            onExpandUp={() => onExpandAbove(gc.id)}
                            onExpandDown={() => onExpandBelow(gc.id)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* All other tiers — flat row */
                <div className="flex flex-wrap justify-center gap-3 items-start">
                  {tier.map(node => (
                    <NodeCard
                      key={node.id}
                      node={node}
                      isRoot={false}
                      renderedIds={renderedIds}
                      onSelect={() => onReRoot(node.id)}
                      onExpandUp={() => onExpandAbove(node.id)}
                      onExpandDown={() => onExpandBelow(node.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── HouseholdTab ──────────────────────────────────────────────────────────────

const HOUSEHOLD_ROLE_LABELS: Record<HouseholdRole, string> = {
  head:             'Household Head',
  senior_wife:      'Senior Wife',
  wife:             'Wife',
  concubine:        'Concubine',
  hearth_companion: 'Hearth Companion',
  child:            'Child',
  thrall:           'Thrall',
};

const HOUSEHOLD_ROLE_COLORS: Record<HouseholdRole, string> = {
  head:             'border-l-amber-500 text-amber-300',
  senior_wife:      'border-l-rose-400 text-rose-300',
  wife:             'border-l-pink-400 text-pink-300',
  concubine:        'border-l-purple-400 text-purple-300',
  hearth_companion: 'border-l-violet-400 text-violet-300',
  child:            'border-l-sky-400 text-sky-300',
  thrall:           'border-l-stone-500 text-stone-400',
};

const SECTION_ORDER: HouseholdRole[] = [
  'head', 'senior_wife', 'wife', 'concubine', 'hearth_companion', 'child', 'thrall',
];

const WORK_ROLES: WorkRole[] = [
  'unassigned', 'farmer', 'trader', 'guard', 'craftsman', 'healer', 'blacksmith',
  'tailor', 'brewer', 'miller', 'herder', 'gather_food', 'gather_stone', 'gather_lumber',
  'priest_solar', 'wheel_singer', 'voice_of_wheel',
];

interface HouseholdMemberCardProps {
  person: Person;
  role: HouseholdRole | null;
  onViewPerson: () => void;
}

function HouseholdMemberCard({ person, role, onViewPerson }: HouseholdMemberCardProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const [showRolePicker, setShowRolePicker] = useState(false);
  const assignRole       = useGameStore(s => s.assignRole);
  const assignKethThara  = useGameStore(s => s.assignKethThara);
  const currentPhase     = useGameStore(s => s.currentPhase);
  const gameState        = useGameStore(s => s.gameState);
  const canAct           = currentPhase === 'management';

  const portraitSrc = resolvePortraitSrc(person);
  const showImage   = !!portraitSrc && !imgFailed;
  const skinBg      = skinToneColor(person.genetics.visibleTraits.skinTone);
  const happiness   = gameState ? computeHappiness(person, gameState) : null;

  const isAway      = person.role === 'away' || person.role === 'builder';
  const kethEligible =
    canAct &&
    person.sex === 'male' &&
    person.age >= 16 &&
    person.age <= 24 &&
    person.spouseIds.length === 0 &&
    person.role !== 'keth_thara' &&
    !isAway;

  const roleAccentClass = role ? HOUSEHOLD_ROLE_COLORS[role] : 'border-l-stone-600 text-stone-400';

  return (
    <div className={`flex flex-col rounded bg-stone-800 border border-stone-700 border-l-4 ${roleAccentClass} overflow-hidden`}>
      {/* Portrait */}
      <div
        className="relative w-full overflow-hidden flex-shrink-0"
        style={{ height: '4rem', backgroundColor: skinBg }}
      >
        {showImage ? (
          <img
            src={portraitSrc!}
            alt={`${person.firstName}`}
            className="absolute inset-0 w-full h-full object-cover object-top"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <svg viewBox="0 0 56 72" className="absolute inset-0 w-full h-full opacity-60" aria-hidden="true">
            <circle cx="28" cy="22" r="12" fill="rgba(0,0,0,0.3)" />
            <ellipse cx="28" cy="60" rx="19" ry="14" fill="rgba(0,0,0,0.3)" />
          </svg>
        )}
        {isAway && (
          <div className="absolute inset-0 bg-stone-950/60 flex items-center justify-center">
            <span className="text-stone-400 text-[10px] font-semibold">AWAY</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="px-2 py-1.5 text-xs flex flex-col gap-0.5">
        <div className="flex items-center gap-0.5">
          <span className={`text-[10px] ${person.sex === 'female' ? 'text-rose-400' : 'text-sky-400'}`}>
            {person.sex === 'female' ? '♀' : '♂'}
          </span>
          <span className="font-semibold text-stone-100 truncate">{person.firstName}</span>
        </div>
        <span className="text-stone-500 text-[10px] truncate">{person.familyName}</span>
        <span className="text-stone-500 text-[10px]">age {Math.floor(person.age)}</span>
        {role && (
          <span className={`text-[10px] font-medium ${roleAccentClass.split(' ')[1] ?? 'text-stone-400'}`}>
            {HOUSEHOLD_ROLE_LABELS[role]}
          </span>
        )}
        {happiness !== null && (
          <span className={`text-[10px] font-medium ${getHappinessColor(happiness)}`}>
            {happiness > 0 ? '+' : ''}{happiness} {getHappinessLabel(happiness)}
          </span>
        )}
        <span className="text-stone-500 text-[10px]">
          <span className={`inline-block px-1 py-0 rounded text-[9px] font-semibold ${ROLE_COLORS[person.role]}`}>
            {ROLE_LABELS[person.role]}
          </span>
        </span>
      </div>

      {/* Actions */}
      <div className="px-2 pb-2 flex flex-col gap-1">
        <button
          onClick={onViewPerson}
          className="w-full text-[10px] py-0.5 rounded bg-stone-700 text-stone-300 hover:bg-stone-600 hover:text-stone-100 transition-colors"
        >
          👤 View
        </button>
        {canAct && !isAway && (
          <div className="relative">
            <button
              onClick={() => setShowRolePicker(v => !v)}
              className="w-full text-[10px] py-0.5 rounded bg-stone-700 text-stone-300 hover:bg-stone-600 hover:text-stone-100 transition-colors"
            >
              ⚒ Role ▾
            </button>
            {showRolePicker && (
              <div className="absolute bottom-full left-0 mb-1 z-20 bg-stone-900 border border-stone-600 rounded shadow-xl min-w-[9rem] py-0.5">
                {WORK_ROLES.map(r => (
                  <button
                    key={r}
                    onClick={() => { assignRole(person.id, r); setShowRolePicker(false); }}
                    className={`w-full text-left text-[10px] px-2 py-0.5 hover:bg-stone-700 ${person.role === r ? 'text-amber-300 font-semibold' : 'text-stone-300'}`}
                  >
                    {ROLE_LABELS[r]}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {kethEligible && (
          <button
            onClick={() => assignKethThara(person.id)}
            className="w-full text-[10px] py-0.5 rounded bg-violet-900 text-violet-300 hover:bg-violet-800 transition-colors font-medium"
          >
            ✦ Keth-Thara
          </button>
        )}
      </div>
    </div>
  );
}

interface HouseholdTabProps {
  householdPersonId: string;
  onNavigateToPerson?: (id: string) => void;
  onClose: () => void;
}

function HouseholdTab({ householdPersonId, onNavigateToPerson, onClose }: HouseholdTabProps) {
  const [showMarriage, setShowMarriage] = useState(false);

  const people     = useGameStore(s => s.gameState?.people);
  const households = useGameStore(s => s.gameState?.households);
  const buildings  = useGameStore(s => s.gameState?.settlement.buildings ?? []);
  const currentPhase = useGameStore(s => s.currentPhase);
  const canAct     = currentPhase === 'management';

  const person    = people?.get(householdPersonId);
  const household = person?.householdId ? households?.get(person.householdId) : null;

  // Resolve building instance IDs to BuiltBuilding records
  const buildingById = useMemo(() => {
    const m = new Map<string, BuiltBuilding>();
    buildings.forEach(b => m.set(b.instanceId, b));
    return m;
  }, [buildings]);

  const dwellingBuilding   = household?.dwellingBuildingId   ? buildingById.get(household.dwellingBuildingId) : null;
  const productionBuildings: BuiltBuilding[] = (household?.productionBuildingIds ?? [])
    .map(id => buildingById.get(id))
    .filter((b): b is BuiltBuilding => b !== undefined);

  function navigateTo(id: string) {
    onClose();
    onNavigateToPerson?.(id);
  }

  if (!person) {
    return <div className="flex-1 flex items-center justify-center text-stone-500 italic text-sm">Person not found.</div>;
  }

  if (!household) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-sm">
        <p className="text-stone-400 italic">{person.firstName} is not part of a household.</p>
        {canAct && (
          <button
            onClick={() => setShowMarriage(true)}
            className="px-4 py-1.5 rounded bg-amber-800 text-amber-200 hover:bg-amber-700 text-sm font-medium"
          >
            ⚭ Arrange Marriage
          </button>
        )}
        {showMarriage && <MarriageDialog onClose={() => setShowMarriage(false)} />}
      </div>
    );
  }

  // Group members by role
  const grouped: Partial<Record<HouseholdRole, Person[]>> = {};
  for (const mid of household.memberIds) {
    const m = people?.get(mid);
    if (!m) continue;
    const role = m.householdRole ?? 'child';
    if (!grouped[role]) grouped[role] = [];
    grouped[role]!.push(m);
  }

  // Count composition for the info bar
  const compositionParts = SECTION_ORDER
    .map(role => ({ role, count: grouped[role]?.length ?? 0 }))
    .filter(x => x.count > 0 && x.role !== 'head')
    .map(x => `${x.count} ${HOUSEHOLD_ROLE_LABELS[x.role].toLowerCase()}${x.count !== 1 ? 's' : ''}`);

  const traditionColors: Record<string, string> = {
    imanian:    'bg-amber-950 text-amber-300',
    sauromatian: 'bg-violet-950 text-violet-300',
  };
  const traditionClass = traditionColors[household.tradition] ?? 'bg-stone-700 text-stone-300';

  return (
    <div className="flex-1 overflow-auto p-6 flex flex-col gap-6">
      {showMarriage && <MarriageDialog onClose={() => setShowMarriage(false)} />}

      {/* Info bar */}
      <div className="flex items-center gap-4 flex-wrap pb-4 border-b border-stone-700">
        <span className="font-display text-xl text-amber-300 font-semibold">{household.name}</span>
        <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${traditionClass}`}>
          {household.tradition}
        </span>
        <span className="text-stone-400 text-sm">{household.memberIds.length} members</span>
        {compositionParts.length > 0 && (
          <span className="text-stone-500 text-xs">{compositionParts.join(' · ')}</span>
        )}
        {canAct && (
          <button
            onClick={() => setShowMarriage(true)}
            className="ml-auto px-3 py-1 rounded bg-amber-900 text-amber-200 hover:bg-amber-800 text-xs font-medium"
          >
            ⚭ Arrange Marriage
          </button>
        )}
      </div>

      {/* Role sections */}
      {SECTION_ORDER.map(role => {
        const members = grouped[role];
        if (!members || members.length === 0) return null;
        const colorClass = HOUSEHOLD_ROLE_COLORS[role];
        return (
          <div key={role}>
            <h4 className={`text-xs font-semibold uppercase tracking-widest mb-3 ${colorClass.split(' ')[1] ?? 'text-stone-400'}`}>
              {HOUSEHOLD_ROLE_LABELS[role]}{members.length > 1 ? 's' : ''}
            </h4>
            <div className="flex flex-wrap gap-4">
              {members.map(m => (
                <HouseholdMemberCard
                  key={m.id}
                  person={m}
                  role={m.householdRole}
                  onViewPerson={() => navigateTo(m.id)}
                />
              ))}
            </div>
          </div>
        );
      })}

      {/* Ashka-Melathi bonds */}
      {household.ashkaMelathiBonds.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-widest mb-3 text-rose-300">
            Ashka-Melathi Bonds
          </h4>
          <div className="flex flex-col gap-2">
            {household.ashkaMelathiBonds.map(([aId, bId], i) => {
              const a = people?.get(aId);
              const b = people?.get(bId);
              const nameA = a ? `${a.firstName} ${a.familyName}` : aId;
              const nameB = b ? `${b.firstName} ${b.familyName}` : bId;
              return (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <button
                    onClick={() => navigateTo(aId)}
                    className="text-rose-300 hover:text-rose-100 underline decoration-dotted"
                  >
                    {nameA}
                  </button>
                  <span className="text-rose-600 italic text-xs">─── Ashka-Melathi ───</span>
                  <button
                    onClick={() => navigateTo(bId)}
                    className="text-rose-300 hover:text-rose-100 underline decoration-dotted"
                  >
                    {nameB}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Claimed buildings */}
      {(dwellingBuilding || productionBuildings.length > 0) && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-widest mb-3 text-slate-400">
            Claimed Buildings
          </h4>
          <div className="flex flex-wrap gap-2">
            {dwellingBuilding && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-stone-800 border border-amber-900/60 text-xs">
                <span className="text-amber-600 text-[10px]">🏠</span>
                <span className="text-amber-300 font-medium">
                  {getBuildingDisplayName(dwellingBuilding.defId, dwellingBuilding.style)}
                </span>
                <span className="text-stone-500 text-[10px]">dwelling</span>
              </div>
            )}
            {productionBuildings.map(b => (
              <div key={b.instanceId} className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-stone-800 border border-stone-700 text-xs">
                <span className="text-stone-400 text-[10px]">⚒</span>
                <span className="text-slate-300 font-medium">
                  {getBuildingDisplayName(b.defId, b.style)}
                </span>
                <span className="text-stone-500 text-[10px]">production</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main overlay ──────────────────────────────────────────────────────────────

export default function FamilyTreeOverlay({ rootPersonId, onClose, onNavigateToPerson }: FamilyTreeOverlayProps) {
  const [activeTab,     setActiveTab]     = useState<'tree' | 'household'>('tree');
  const [treeRootId,    setTreeRootId]    = useState(rootPersonId);
  const [treeHistory,   setTreeHistory]   = useState<string[]>([]);
  const [expandedAbove, setExpandedAbove] = useState<Set<string>>(new Set());
  const [expandedBelow, setExpandedBelow] = useState<Set<string>>(new Set());

  const people   = useGameStore(s => s.gameState?.people);
  const graveyard = useGameStore(s => s.gameState?.graveyard ?? []);

  function rootName(): string {
    const p = people?.get(treeRootId);
    if (p) return `${p.firstName} ${p.familyName}`;
    const g = graveyard.find(x => x.id === treeRootId);
    if (g) return `${g.firstName} ${g.familyName}`;
    return 'Unknown';
  }

  function reRootTo(id: string) {
    setTreeHistory(h => [...h, treeRootId]);
    setTreeRootId(id);
    setExpandedAbove(new Set());
    setExpandedBelow(new Set());
  }

  function goBack() {
    const prev = treeHistory[treeHistory.length - 1];
    if (!prev) return;
    setTreeHistory(h => h.slice(0, -1));
    setTreeRootId(prev);
    setExpandedAbove(new Set());
    setExpandedBelow(new Set());
  }

  function handleExpandAbove(nodeId: string) {
    setExpandedAbove(prev => new Set([...prev, nodeId]));
  }

  function handleExpandBelow(nodeId: string) {
    setExpandedBelow(prev => new Set([...prev, nodeId]));
  }

  return (
    <div className="fixed inset-0 z-50 bg-stone-950 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-stone-700 bg-stone-900 flex-shrink-0">
        {/* Back button */}
        {treeHistory.length > 0 ? (
          <button
            onClick={goBack}
            className="flex items-center gap-1 text-stone-400 hover:text-stone-200 text-sm transition-colors flex-shrink-0"
          >
            ← Back
          </button>
        ) : (
          <div className="w-14" />
        )}

        {/* Title */}
        <h2 className="font-display text-amber-300 font-semibold text-base truncate flex-1 text-center">
          {activeTab === 'tree' ? `Family of ${rootName()}` : `Household · ${rootName()}`}
        </h2>

        {/* Tab switcher */}
        <div className="flex items-center gap-0 rounded border border-stone-700 overflow-hidden flex-shrink-0">
          <button
            onClick={() => setActiveTab('tree')}
            className={`px-3 py-1 text-xs font-medium transition-colors ${
              activeTab === 'tree'
                ? 'bg-amber-900 text-amber-200'
                : 'bg-stone-800 text-stone-400 hover:text-stone-200 hover:bg-stone-700'
            }`}
          >
            🌳 Family Tree
          </button>
          <button
            onClick={() => setActiveTab('household')}
            className={`px-3 py-1 text-xs font-medium transition-colors ${
              activeTab === 'household'
                ? 'bg-amber-900 text-amber-200'
                : 'bg-stone-800 text-stone-400 hover:text-stone-200 hover:bg-stone-700'
            }`}
          >
            🏠 Household
          </button>
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="text-stone-500 hover:text-stone-200 text-xl leading-none flex-shrink-0 ml-1"
          aria-label="Close family tree"
        >
          ×
        </button>
      </div>

      {/* Body */}
      {activeTab === 'tree' ? (
        <FamilyTreeTab
          treeRootId={treeRootId}
          expandedAbove={expandedAbove}
          expandedBelow={expandedBelow}
          onReRoot={reRootTo}
          onExpandAbove={handleExpandAbove}
          onExpandBelow={handleExpandBelow}
        />
      ) : (
        <HouseholdTab
          householdPersonId={treeRootId}
          onNavigateToPerson={onNavigateToPerson}
          onClose={onClose}
        />
      )}
    </div>
  );
}

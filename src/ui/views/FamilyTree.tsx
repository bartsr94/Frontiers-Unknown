/**
 * FamilyTree — a compact 3-generation ancestor/descendant tree
 * centred on one root person.
 *
 * Layout (top to bottom):
 *   Row 1 — Paternal grandparents (up to 2) | Maternal grandparents (up to 2)
 *   Row 2 — Father | Mother
 *   Row 3 — Root person  (highlighted)
 *   Row 4 — Children
 *   Row 5 — Grandchildren (from first child only, max 4, to keep width manageable)
 *
 * Each node is a small card: name, birth–death year (living shows age), ♀/♂ symbol.
 * Dead individuals are greyed out and marked "(deceased)".
 * Clicking any non-root node calls onSelectPerson(id), enabling navigation.
 *
 * Lookup precedence: state.people (living) → state.graveyard (deceased).
 */

import { useGameStore } from '../../stores/game-store';
import { skinToneColor } from '../components/Portrait';
import type { Person } from '../../simulation/population/person';
import type { GraveyardEntry } from '../../simulation/turn/game-state';

// ─── Minimal tree-node type ─────────────────────────────────────────────────

interface TreeNode {
  id: string;
  name: string;
  isLiving: boolean;
  sex: 'male' | 'female';
  birthYear: number;
  deathYear?: number;
  /** Age for living people (undefined for deceased). */
  age?: number;
  parentIds: [string | null, string | null];
  childrenIds: string[];
  /** Skin tone 0–1 for the colour dot (undefined for graveyard entries). */
  skinTone?: number;
  /** First 2 trait IDs for abbreviated pills (undefined for graveyard entries). */
  traits?: string[];
  /** Spouse IDs (only populated for living people; empty for graveyard entries). */
  spouseIds: string[];
}

// ─── Lookup helpers ─────────────────────────────────────────────────────────

function fromPerson(p: Person): TreeNode {
  return {
    id: p.id,
    name: `${p.firstName} ${p.familyName}`,
    isLiving: true,
    sex: p.sex,
    birthYear: 0, // birth year not stored on Person — use 0 as sentinel
    age: Math.floor(p.age),
    parentIds: p.parentIds,
    childrenIds: p.childrenIds,
    skinTone: p.genetics.visibleTraits.skinTone,
    traits: p.traits.slice(0, 2),
    spouseIds: p.spouseIds,
  };
}

function fromGraveyardEntry(g: GraveyardEntry): TreeNode {
  return {
    id: g.id,
    name: `${g.firstName} ${g.familyName}`,
    isLiving: false,
    sex: g.sex,
    birthYear: g.birthYear,
    deathYear: g.deathYear,
    parentIds: g.parentIds,
    childrenIds: g.childrenIds,
    spouseIds: [],
  };
}

function useNodeLookup(): (id: string) => TreeNode | null {
  const people   = useGameStore(s => s.gameState?.people);
  const graveyard = useGameStore(s => s.gameState?.graveyard ?? []);

  return (id: string): TreeNode | null => {
    if (!id) return null;
    const living = people?.get(id);
    if (living) return fromPerson(living);
    const dead = graveyard.find(g => g.id === id);
    if (dead) return fromGraveyardEntry(dead);
    return null;
  };
}

// ─── Sub-components ─────────────────────────────────────────────────────────

// Short abbreviations for trait IDs shown in tree nodes
const TRAIT_ABBR: Record<string, string> = {
  ambitious: 'AMB', content: 'CNT', gregarious: 'GRG', shy: 'SHY',
  brave: 'BRV', craven: 'CRV', cruel: 'CRL', kind: 'KND',
  greedy: 'GRD', generous: 'GEN', lustful: 'LST', chaste: 'CHT',
  wrathful: 'WRT', patient: 'PAT', deceitful: 'DCT', honest: 'HNS',
  proud: 'PRD', humble: 'HMB',
  strong: 'STR', weak: 'WEK', clever: 'CLV', slow: 'SLW',
  beautiful: 'BTY', plain: 'PLN', robust: 'RBT', sickly: 'SCK',
  fertile: 'FRT', barren: 'BRN',
  traditional: 'TRD', cosmopolitan: 'COS', devout: 'DEV',
  skeptical: 'SKP', xenophobic: 'XNO', welcoming: 'WLC',
  veteran: 'VET', scarred: 'SCR', respected_elder: 'ELD',
  scandal: 'SCN', oath_breaker: 'OTH', hero: 'HRO',
  coward: 'CWD', wealthy: 'WLT', indebted: 'DBT',
};

const SEX_SYMBOL: Record<'male' | 'female', string> = { male: '♂', female: '♀' };

interface NodeCardProps {
  node: TreeNode;
  isRoot?: boolean;
  onSelect?: () => void;
}

function NodeCard({ node, isRoot = false, onSelect }: NodeCardProps) {
  const yearText = node.isLiving
    ? `age ${node.age ?? '?'}`
    : `${node.birthYear > 0 ? node.birthYear : '?'} – ${node.deathYear ?? '?'}`;

  return (
    <button
      onClick={onSelect}
      disabled={isRoot || !onSelect}
      className={[
        'flex flex-col items-center px-2 py-1.5 rounded border text-xs leading-snug min-w-[80px] max-w-[100px]',
        'transition-colors',
        isRoot
          ? 'border-amber-500 bg-amber-950 text-amber-200 cursor-default'
          : node.isLiving
            ? 'border-stone-600 bg-stone-800 text-stone-200 hover:bg-stone-700 hover:border-stone-500 cursor-pointer'
            : 'border-stone-700 bg-stone-900 text-stone-500 cursor-pointer hover:border-stone-600',
      ].join(' ')}
      title={node.isLiving ? undefined : 'Deceased'}
    >
      {/* Name row with sex symbol and skin dot */}
      <span className="flex items-center gap-1 w-full justify-center">
        {node.skinTone !== undefined && (
          <span
            className="inline-block w-2 h-2 rounded-full flex-shrink-0 border border-stone-600"
            style={{ backgroundColor: skinToneColor(node.skinTone) }}
            aria-hidden="true"
          />
        )}
        <span className={node.sex === 'female' ? 'text-rose-400' : 'text-sky-400'}>
          {SEX_SYMBOL[node.sex]}
        </span>
        <span className="font-semibold truncate">{node.name.split(' ')[0]}</span>
      </span>
      <span className="truncate w-full text-center text-stone-500 text-[10px]">
        {node.name.split(' ').slice(1).join(' ')}
      </span>
      <span className={node.isLiving ? 'text-stone-400' : 'text-stone-600'}>
        {yearText}
      </span>
      {!node.isLiving && (
        <span className="text-stone-600 italic">deceased</span>
      )}
      {/* Trait abbreviation pills */}
      {node.traits && node.traits.length > 0 && (
        <span className="flex gap-0.5 mt-0.5 flex-wrap justify-center">
          {node.traits.map(t => (
            <span
              key={t}
              className="text-[9px] px-1 py-0 rounded bg-stone-700 text-stone-400 leading-tight"
            >
              {TRAIT_ABBR[t] ?? t.slice(0, 3).toUpperCase()}
            </span>
          ))}
        </span>
      )}
    </button>
  );
}

/** Renders a horizontal row of tree nodes, centred. */
function NodeRow({
  label,
  nodes,
  rootId,
  onSelect,
}: {
  label: string;
  nodes: (TreeNode | null)[];
  rootId: string;
  onSelect: (id: string) => void;
}) {
  const visible = nodes.filter(Boolean) as TreeNode[];
  if (visible.length === 0) return null;

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-stone-600 text-xs uppercase tracking-wide">{label}</span>
      <div className="flex flex-wrap justify-center gap-2">
        {visible.map(node => (
          <NodeCard
            key={node.id}
            node={node}
            isRoot={node.id === rootId}
            onSelect={node.id !== rootId ? () => onSelect(node.id) : undefined}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

interface FamilyTreeProps {
  rootPersonId: string;
  onSelectPerson: (id: string) => void;
}

export default function FamilyTree({ rootPersonId, onSelectPerson }: FamilyTreeProps) {
  const lookup = useNodeLookup();
  const root = lookup(rootPersonId);

  if (!root) {
    return (
      <p className="text-stone-500 text-sm italic">
        Person not found in records.
      </p>
    );
  }

  // ── Ancestors ────────────────────────────────────────────────────────────

  const [motherId, fatherId] = root.parentIds;
  const mother = motherId ? lookup(motherId) : null;
  const father = fatherId ? lookup(fatherId) : null;

  // Grandparents: [maternalGM, maternalGF, paternalGM, paternalGF]
  const [maternalGMId, maternalGFId] = mother?.parentIds ?? [null, null];
  const [paternalGMId, paternalGFId] = father?.parentIds ?? [null, null];

  const maternalGM = maternalGMId ? lookup(maternalGMId) : null;
  const maternalGF = maternalGFId ? lookup(maternalGFId) : null;
  const paternalGM = paternalGMId ? lookup(paternalGMId) : null;
  const paternalGF = paternalGFId ? lookup(paternalGFId) : null;

  // ── Spouses ──────────────────────────────────────────────────────────────

  const spouses = root.spouseIds
    .map(id => lookup(id))
    .filter(Boolean) as TreeNode[];

  // ── Descendants ──────────────────────────────────────────────────────────

  const children = root.childrenIds
    .map(id => lookup(id))
    .filter(Boolean)
    .slice(0, 6) as TreeNode[];

  // Grandchildren from all children (cap at 8 total to stay readable)
  const grandchildren = children
    .flatMap(child => child.childrenIds.map(id => lookup(id)).filter(Boolean) as TreeNode[])
    .slice(0, 8);

  // ── Helpers ──────────────────────────────────────────────────────────────

  const hasAncestors =
    mother || father || maternalGM || maternalGF || paternalGM || paternalGF;

  return (
    <div className="flex flex-col gap-4 items-center py-2 select-none">

      {/* ── Grandparents ── */}
      {(maternalGM || maternalGF || paternalGM || paternalGF) && (
        <NodeRow
          label="Grandparents"
          nodes={[maternalGM, maternalGF, paternalGM, paternalGF]}
          rootId={rootPersonId}
          onSelect={onSelectPerson}
        />
      )}

      {/* ── Connector line: grandparents → parents ── */}
      {(maternalGM || maternalGF || paternalGM || paternalGF) && hasAncestors && (
        <div className="w-px h-3 bg-stone-700" />
      )}

      {/* ── Parents ── */}
      {(mother || father) && (
        <NodeRow
          label="Parents"
          nodes={[mother, father]}
          rootId={rootPersonId}
          onSelect={onSelectPerson}
        />
      )}

      {/* ── Connector: parents → root ── */}
      {(mother || father) && <div className="w-px h-3 bg-stone-600" />}

      {/* ── Root + Spouses ── */}
      <div className="flex items-start gap-0">
        <NodeCard node={root} isRoot />
        {spouses.length > 0 && (
          <>
            <div className="flex items-center self-[40%] mx-1">
              <div className="w-4 h-px bg-stone-600" />
              <span className="text-stone-500 text-xs mx-0.5" title="Spouse(s)">⚭</span>
              <div className="w-4 h-px bg-stone-600" />
            </div>
            <div className="flex flex-col gap-1.5">
              {spouses.map(s => (
                <NodeCard
                  key={s.id}
                  node={s}
                  onSelect={() => onSelectPerson(s.id)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Connector: root → children ── */}
      {children.length > 0 && <div className="w-px h-3 bg-stone-600" />}

      {/* ── Children ── */}
      {children.length > 0 && (
        <NodeRow
          label="Children"
          nodes={children}
          rootId={rootPersonId}
          onSelect={onSelectPerson}
        />
      )}

      {/* ── Connector: children → grandchildren ── */}
      {grandchildren.length > 0 && <div className="w-px h-3 bg-stone-700" />}

      {/* ── Grandchildren ── */}
      {grandchildren.length > 0 && (
        <NodeRow
          label="Grandchildren"
          nodes={grandchildren}
          rootId={rootPersonId}
          onSelect={onSelectPerson}
        />
      )}

      {!hasAncestors && children.length === 0 && (
        <p className="text-stone-600 text-xs italic mt-1">No family records.</p>
      )}
    </div>
  );
}

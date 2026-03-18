/**
 * HexGrid — SVG hex-map overlay for the DiplomacyView.
 *
 * Renders a pointed-top axial hex grid over the Ashmark background image.
 * The visual grid extends beyond the 15×15 game grid so that fog-of-war
 * hexes cover the entire map image.  Hexes outside the game grid are
 * permanent fog and non-interactive.
 *
 * Fog-of-war states (game hexes only):
 *   'fog'     → opaque stone-900 fill (clickable for expedition dispatch)
 *   'scouted' → semi-transparent fill showing terrain colour
 *   'visited' → transparent hex (image shows through), terrain colour border
 *   'cleared' → same as visited (all one-time content exhausted)
 *
 * The SVG uses CSS-pixel coordinates (no viewBox) and shares the same
 * CSS transform as the background image so hexes stay aligned at every
 * zoom level.  Settlement hex (7, 7) is always centred in the container.
 */

import React, { useMemo, useState } from 'react';
import type { HexMap, HexCell, TerrainType, Expedition } from '../../simulation/turn/game-state';
import {
  hexToPixel,
  hexKey,
  HEX_MAP_WIDTH,
  HEX_MAP_HEIGHT,
  SETTLEMENT_Q,
  SETTLEMENT_R,
} from '../../simulation/world/hex-map';

// ─── Constants ─────────────────────────────────────────────────────────────────

/** Circumradius (centre-to-corner) of each hexagon, in CSS pixels. */
const HEX_SIZE = 30;

/**
 * Extra hex rows / columns beyond the game grid in every direction.
 * Creates the illusion that the unexplored Ashmark continues to the
 * edges of the map image.
 */
const VISUAL_PADDING = 10;

/** Terrain fill colours for visible hexes. */
const TERRAIN_COLOR: Record<TerrainType, string> = {
  plains:    '#6b8c5a',
  forest:    '#2d5a2d',
  jungle:    '#1a4a1a',
  hills:     '#8b6b3d',
  mountains: '#6e6e6e',
  river:     '#3a7ab8',
  wetlands:  '#4a6b5a',
  coast:     '#4a7fb5',
  desert:    '#c4a864',
};

const TERRAIN_LABEL: Record<TerrainType, string> = {
  plains:    'Plains',
  forest:    'Forest',
  jungle:    'Jungle',
  hills:     'Hills',
  mountains: 'Mountains',
  river:     'River',
  wetlands:  'Wetlands',
  coast:     'Coast',
  desert:    'Desert',
};

// ─── Hex corner points ─────────────────────────────────────────────────────────

/** Returns the 6 corner points of a pointed-top hexagon centred at (cx, cy). */
function hexCorners(cx: number, cy: number, size: number): string {
  const points: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angleDeg = 60 * i - 30; // pointed-top: offset by -30°
    const rad = (Math.PI / 180) * angleDeg;
    points.push(`${(cx + size * Math.cos(rad)).toFixed(2)},${(cy + size * Math.sin(rad)).toFixed(2)}`);
  }
  return points.join(' ');
}

// ─── Fog padding hexes (non-interactive decoration) ────────────────────────────

function FogPadHex({ cx, cy, size }: { cx: number; cy: number; size: number }) {
  return (
    <polygon
      points={hexCorners(cx, cy, size)}
      fill="#1c1917"
      fillOpacity={0.92}
      stroke="#292524"
      strokeWidth={0.5}
      style={{ pointerEvents: 'none' }}
    />
  );
}

// ─── Single game hex ───────────────────────────────────────────────────────────

interface HexTileProps {
  cell: HexCell;
  cx: number;
  cy: number;
  size: number;
  isHovered: boolean;
  isSelected: boolean;
  isExpeditionHere: boolean;
  onHover: (cell: HexCell | null, e?: React.MouseEvent<SVGGElement>) => void;
  onClick: () => void;
}

function HexTile({
  cell, cx, cy, size, isHovered, isSelected, isExpeditionHere,
  onHover, onClick,
}: HexTileProps) {
  const points = hexCorners(cx, cy, size);
  const vis    = cell.visibility;

  // Fill based on visibility state.
  let fill: string;
  let fillOpacity: number;
  let strokeColor: string;
  let strokeWidth: number;

  if (vis === 'fog') {
    fill        = '#1c1917'; // stone-900
    fillOpacity = isHovered ? 0.75 : 0.92;
    strokeColor = isHovered ? '#78716c' : '#292524'; // stone-500 : stone-800
    strokeWidth = isHovered ? 1.5 : 0.8;
  } else if (vis === 'scouted') {
    fill        = TERRAIN_COLOR[cell.terrain];
    fillOpacity = 0.55;
    strokeColor = isSelected ? '#fbbf24' : '#78716c';
    strokeWidth = isSelected ? 2 : 1;
  } else {
    // visited / cleared — transparent hex, image shows through
    fill        = TERRAIN_COLOR[cell.terrain];
    fillOpacity = isSelected ? 0.35 : isHovered ? 0.22 : 0.08;
    strokeColor = isSelected ? '#fbbf24' : isHovered ? '#a8a29e' : '#57534e';
    strokeWidth = isSelected ? 2 : 1;
  }

  return (
    <g
      data-q={cell.q}
      data-r={cell.r}
      style={{ cursor: 'pointer' }}
      onMouseEnter={(e) => onHover(cell, e)}
      onMouseMove={(e) => onHover(cell, e)}
      onMouseLeave={() => onHover(null)}
      onClick={onClick}
    >
      <polygon
        points={points}
        fill={fill}
        fillOpacity={fillOpacity}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
      />
      {/* Expedition presence indicator */}
      {isExpeditionHere && (
        <circle
          cx={cx}
          cy={cy}
          r={6}
          fill="#fbbf24"
          stroke="#78350f"
          strokeWidth={1.5}
        />
      )}
      {/* Settlement marker */}
      {cell.q === SETTLEMENT_Q && cell.r === SETTLEMENT_R && (
        <text
          x={cx}
          y={cy + 5}
          textAnchor="middle"
          fontSize={13}
          fill="#fcd34d"
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          ⌂
        </text>
      )}
    </g>
  );
}

// ─── Tooltip ───────────────────────────────────────────────────────────────────

interface TooltipProps {
  cell: HexCell;
  svgX: number;
  svgY: number;
  expeditionHere: string | null;
}

function HexTooltip({ cell, svgX, svgY, expeditionHere }: TooltipProps) {
  const vis = cell.visibility;
  if (vis === 'fog') return null;

  const lines: string[] = [];
  lines.push(`(${cell.q}, ${cell.r})`);
  lines.push(TERRAIN_LABEL[cell.terrain]);

  if (vis === 'visited' || vis === 'cleared') {
    const discoveredContents = cell.contents.filter(c => c.discovered);
    for (const c of discoveredContents) {
      lines.push(c.label ?? c.type.replace(/_/g, ' '));
    }
  }

  if (expeditionHere) {
    lines.push(`★ ${expeditionHere}`);
  }

  const lineHeight = 14;
  const padX = 8;
  const padY = 6;
  const boxW = 110;
  const boxH = lines.length * lineHeight + padY * 2;

  return (
    <g style={{ pointerEvents: 'none' }} transform={`translate(${svgX + 16}, ${svgY - 8})`}>
      <rect
        x={0} y={0}
        width={boxW} height={boxH}
        rx={4}
        fill="#1c1917"
        fillOpacity={0.95}
        stroke="#57534e"
        strokeWidth={1}
      />
      {lines.map((l, i) => (
        <text
          key={i}
          x={padX}
          y={padY + (i + 1) * lineHeight - 3}
          fill={i === 0 ? '#a8a29e' : '#e7e5e4'}
          fontSize={11}
        >
          {l}
        </text>
      ))}
    </g>
  );
}

// ─── Main HexGrid ──────────────────────────────────────────────────────────────

interface HexGridProps {
  hexMap: HexMap;
  expeditions: Expedition[];
  /** Width + height of the container in CSS pixels. */
  containerWidth: number;
  containerHeight: number;
  /** Pan/zoom transform synced with the parent viewport. */
  tx: number;
  ty: number;
  scale: number;
  /** Called when the player clicks any game hex (including fog). */
  onHexClick?: (q: number, r: number) => void;
}

export default function HexGrid({
  hexMap,
  expeditions,
  containerWidth,
  containerHeight,
  tx,
  ty,
  scale,
  onHexClick,
}: HexGridProps) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Build a lookup of which hex each active expedition is currently in.
  const expeditionPositions = useMemo<Map<string, string>>(
    () => {
      const map = new Map<string, string>();
      for (const exp of expeditions) {
        if (exp.status === 'travelling' || exp.status === 'returning') {
          map.set(hexKey(exp.currentQ, exp.currentR), exp.name);
        }
      }
      return map;
    },
    [expeditions],
  );

  // Centre the settlement hex in the container.
  // All hex positions are in CSS-pixel coordinates (no SVG viewBox).
  const settlementPx = hexToPixel(SETTLEMENT_Q, SETTLEMENT_R, HEX_SIZE);
  const offsetX = containerWidth / 2 - settlementPx.x;
  const offsetY = containerHeight / 2 - settlementPx.y;

  // Generate the full visual grid: game hexes + fog padding.
  const visualCells = useMemo(() => {
    const minQ = -VISUAL_PADDING;
    const maxQ = HEX_MAP_WIDTH - 1 + VISUAL_PADDING;
    const minR = -VISUAL_PADDING;
    const maxR = HEX_MAP_HEIGHT - 1 + VISUAL_PADDING;

    const cells: Array<{
      q: number;
      r: number;
      gameCell: HexCell | undefined;
      x: number;
      y: number;
    }> = [];

    for (let q = minQ; q <= maxQ; q++) {
      for (let r = minR; r <= maxR; r++) {
        const pos = hexToPixel(q, r, HEX_SIZE);
        cells.push({
          q,
          r,
          gameCell: hexMap.cells.get(hexKey(q, r)),
          x: pos.x + offsetX,
          y: pos.y + offsetY,
        });
      }
    }
    return cells;
  }, [hexMap, containerWidth, containerHeight, offsetX, offsetY]);

  function handleHover(cell: HexCell | null, e?: React.MouseEvent<SVGGElement>) {
    if (!cell) {
      setHoveredKey(null);
      return;
    }
    const k = hexKey(cell.q, cell.r);
    setHoveredKey(k);
    if (e) {
      const svg = e.currentTarget.ownerSVGElement as SVGSVGElement | null;
      if (svg) {
        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const svgPt = pt.matrixTransform(svg.getScreenCTM()!.inverse());
        setTooltipPos({ x: svgPt.x, y: svgPt.y });
      }
    }
  }

  function handleClick(q: number, r: number) {
    const k = hexKey(q, r);
    setSelectedKey(prev => (prev === k ? null : k));
    onHexClick?.(q, r);
  }

  const hoveredCell = hoveredKey ? hexMap.cells.get(hoveredKey) : null;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={containerWidth}
      height={containerHeight}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        transformOrigin: '0 0',
        transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
        userSelect: 'none',
        pointerEvents: 'all',
      }}
    >
      {visualCells.map(vc => {
        const k = `${vc.q},${vc.r}`;

        // Hexes outside the game grid: permanent fog, non-interactive
        if (!vc.gameCell) {
          return <FogPadHex key={k} cx={vc.x} cy={vc.y} size={HEX_SIZE} />;
        }

        // Game hexes: interactive
        return (
          <HexTile
            key={k}
            cell={vc.gameCell}
            cx={vc.x}
            cy={vc.y}
            size={HEX_SIZE}
            isHovered={hoveredKey === k}
            isSelected={selectedKey === k}
            isExpeditionHere={expeditionPositions.has(k)}
            onHover={handleHover}
            onClick={() => handleClick(vc.q, vc.r)}
          />
        );
      })}

      {/* Tooltip for hovered hex */}
      {hoveredCell && (
        <HexTooltip
          cell={hoveredCell}
          svgX={tooltipPos.x}
          svgY={tooltipPos.y}
          expeditionHere={expeditionPositions.get(hoveredKey!) ?? null}
        />
      )}
    </svg>
  );
}

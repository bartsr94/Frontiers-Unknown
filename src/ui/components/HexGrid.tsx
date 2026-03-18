/**
 * HexGrid — SVG hex-map overlay for the DiplomacyView.
 *
 * Performance approach:
 * - All static hex geometry is batched into ~12 <path> elements (one per
 *   visual bucket: fog + up to 9 terrain types x 2 visibility states).
 *   This replaces thousands of individual <polygon> elements.
 * - Hover/selected highlights are a single <polygon> overlay each.
 * - All mouse interaction uses one SVG-level handler + pixelToHex hit
 *   testing - no per-element event handlers.
 * - RAF throttling prevents redundant re-renders on every mouse pixel.
 */

import React, { useMemo, useRef, useState } from 'react';
import type { HexMap, HexCell, TerrainType, Expedition } from '../../simulation/turn/game-state';
import {
  hexKey,
  HEX_MAP_WIDTH,
  HEX_MAP_HEIGHT,
  SETTLEMENT_Q,
  SETTLEMENT_R,
  OFFSET_COL_START,
  offsetToAxial,
  axialToOffset,
  offsetToPixel,
  pixelToHex,
} from '../../simulation/world/hex-map';

// --- Constants ---

/** Circumradius (centre-to-corner) of each hexagon, in CSS pixels. */
const HEX_SIZE = 33;

/** Minimum padding (in hex columns/rows) beyond the game grid. */
const MIN_VISUAL_PADDING = 4;

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

// --- Geometry helpers ---

function hexCorners(cx: number, cy: number, size: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const rad = (Math.PI / 180) * (60 * i - 30);
    pts.push(`${(cx + size * Math.cos(rad)).toFixed(1)},${(cy + size * Math.sin(rad)).toFixed(1)}`);
  }
  return pts.join(' ');
}

function hexPathSegment(cx: number, cy: number, size: number): string {
  let d = '';
  for (let i = 0; i < 6; i++) {
    const rad = (Math.PI / 180) * (60 * i - 30);
    const x = (cx + size * Math.cos(rad)).toFixed(1);
    const y = (cy + size * Math.sin(rad)).toFixed(1);
    d += i === 0 ? `M${x},${y}` : `L${x},${y}`;
  }
  return d + 'Z';
}

// --- Tooltip ---

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
    const discoveredContents = cell.contents.filter(c => c !== null && c.discovered);
    for (const c of discoveredContents) {
      lines.push(c.type.replace(/_/g, ' '));
    }
  }

  if (expeditionHere) {
    lines.push(`* ${expeditionHere}`);
  }

  const lineHeight = 14;
  const padX = 8;
  const padY = 6;
  const boxW = 110;
  const boxH = lines.length * lineHeight + padY * 2;

  return (
    <g style={{ pointerEvents: 'none' }} transform={`translate(${svgX + 16}, ${svgY - 8})`}>
      <rect x={0} y={0} width={boxW} height={boxH} rx={4}
        fill="#1c1917" fillOpacity={0.95} stroke="#57534e" strokeWidth={1} />
      {lines.map((l, i) => (
        <text key={i} x={padX} y={padY + (i + 1) * lineHeight - 3}
          fill={i === 0 ? '#a8a29e' : '#e7e5e4'} fontSize={11}>{l}</text>
      ))}
    </g>
  );
}

// --- HexGridProps ---

interface HexGridProps {
  hexMap: HexMap;
  expeditions: Expedition[];
  containerWidth: number;
  containerHeight: number;
  imageWidth: number;
  imageHeight: number;
  tx: number;
  ty: number;
  scale: number;
  onHexClick?: (q: number, r: number) => void;
}

export default function HexGrid({
  hexMap,
  expeditions,
  imageWidth,
  imageHeight,
  tx,
  ty,
  scale,
  onHexClick,
}: HexGridProps) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const svgRef = useRef<SVGSVGElement>(null);
  const rafRef = useRef<number | null>(null);

  const expeditionPositions = useMemo<Map<string, string>>(() => {
    const map = new Map<string, string>();
    for (const exp of expeditions) {
      if (exp.status === 'travelling' || exp.status === 'returning') {
        map.set(hexKey(exp.currentQ, exp.currentR), exp.name);
      }
    }
    return map;
  }, [expeditions]);

  const settlementOffset = axialToOffset(SETTLEMENT_Q, SETTLEMENT_R);
  const settlementPx     = offsetToPixel(settlementOffset.col, settlementOffset.row, HEX_SIZE);
  const offsetX = imageWidth  / 2 - settlementPx.x;
  const offsetY = imageHeight / 2 - settlementPx.y;

  const gameColMin = OFFSET_COL_START;
  const gameColMax = OFFSET_COL_START + HEX_MAP_WIDTH - 1;
  const gameRowMin = 0;
  const gameRowMax = HEX_MAP_HEIGHT - 1;

  const hexW         = HEX_SIZE * Math.sqrt(3);
  const hexH         = HEX_SIZE * 1.5;
  const halfImgCols  = Math.ceil(imageWidth  / (2 * hexW));
  const halfImgRows  = Math.ceil(imageHeight / (2 * hexH));
  const halfGridCols = Math.floor(HEX_MAP_WIDTH  / 2);
  const halfGridRows = Math.floor(HEX_MAP_HEIGHT / 2);
  const padCols = Math.max(MIN_VISUAL_PADDING, halfImgCols - halfGridCols + 3);
  const padRows = Math.max(MIN_VISUAL_PADDING, halfImgRows - halfGridRows + 3);

  const visualCells = useMemo(() => {
    const minCol = gameColMin - padCols;
    const maxCol = gameColMax + padCols;
    const minRow = gameRowMin - padRows;
    const maxRow = gameRowMax + padRows;
    const cells: Array<{ q: number; r: number; gameCell: HexCell | undefined; x: number; y: number }> = [];
    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const { q, r } = offsetToAxial(col, row);
        const pos = offsetToPixel(col, row, HEX_SIZE);
        cells.push({ q, r, gameCell: hexMap.cells.get(hexKey(q, r)), x: pos.x + offsetX, y: pos.y + offsetY });
      }
    }
    return cells;
  }, [hexMap, imageWidth, imageHeight, offsetX, offsetY, padCols, padRows]);

  const cellByKey = useMemo(() => {
    const map = new Map<string, { x: number; y: number; gameCell: HexCell | undefined }>();
    for (const vc of visualCells) map.set(hexKey(vc.q, vc.r), { x: vc.x, y: vc.y, gameCell: vc.gameCell });
    return map;
  }, [visualCells]);

  const { fogD, scoutedEntries, visitedEntries } = useMemo(() => {
    const fogSegs:    string[]                         = [];
    const scoutedMap = new Map<TerrainType, string[]>();
    const visitedMap = new Map<TerrainType, string[]>();
    for (const vc of visualCells) {
      const seg = hexPathSegment(vc.x, vc.y, HEX_SIZE);
      const vis = vc.gameCell?.visibility;
      if (!vis || vis === 'fog') {
        fogSegs.push(seg);
      } else if (vis === 'scouted') {
        const arr = scoutedMap.get(vc.gameCell!.terrain) ?? [];
        arr.push(seg);
        scoutedMap.set(vc.gameCell!.terrain, arr);
      } else {
        const arr = visitedMap.get(vc.gameCell!.terrain) ?? [];
        arr.push(seg);
        visitedMap.set(vc.gameCell!.terrain, arr);
      }
    }
    return { fogD: fogSegs.join(''), scoutedEntries: [...scoutedMap.entries()], visitedEntries: [...visitedMap.entries()] };
  }, [visualCells]);

  function getSvgPoint(clientX: number, clientY: number): { x: number; y: number } | null {
    const svg = svgRef.current;
    if (!svg) return null;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const svgPt = pt.matrixTransform(ctm.inverse());
    return { x: svgPt.x, y: svgPt.y };
  }

  function handleSvgMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (rafRef.current !== null) return;
    const clientX = e.clientX;
    const clientY = e.clientY;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const svgPt = getSvgPoint(clientX, clientY);
      if (!svgPt) return;
      const { q, r } = pixelToHex(svgPt.x - offsetX, svgPt.y - offsetY, HEX_SIZE);
      const k = hexKey(q, r);
      setHoveredKey(prev => (prev === k ? prev : k));
      setTooltipPos(svgPt);
    });
  }

  function handleSvgMouseLeave() {
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    setHoveredKey(null);
  }

  function handleSvgClick(e: React.MouseEvent<SVGSVGElement>) {
    const svgPt = getSvgPoint(e.clientX, e.clientY);
    if (!svgPt) return;
    const { q, r } = pixelToHex(svgPt.x - offsetX, svgPt.y - offsetY, HEX_SIZE);
    const k = hexKey(q, r);
    setSelectedKey(prev => (prev === k ? null : k));
    onHexClick?.(q, r);
  }

  const hoveredVc   = hoveredKey  ? cellByKey.get(hoveredKey)  : null;
  const selectedVc  = selectedKey ? cellByKey.get(selectedKey) : null;
  const hoveredCell = hoveredKey  ? hexMap.cells.get(hoveredKey)  : null;
  const hoveredVis  = hoveredVc?.gameCell?.visibility;
  const hoveredFillColor   = hoveredVc?.gameCell ? TERRAIN_COLOR[hoveredVc.gameCell.terrain] : '#57534e';
  const hoveredFillOpacity = (!hoveredVis || hoveredVis === 'fog') ? 0.18 : 0.25;

  const expeditionMarkers = useMemo(() => {
    const markers: Array<{ x: number; y: number; name: string }> = [];
    for (const [k, name] of expeditionPositions) {
      const vc = cellByKey.get(k);
      if (vc) markers.push({ x: vc.x, y: vc.y, name });
    }
    return markers;
  }, [expeditionPositions, cellByKey]);

  const settlVc = cellByKey.get(hexKey(SETTLEMENT_Q, SETTLEMENT_R));

  return (
    <svg
      ref={svgRef}
      xmlns="http://www.w3.org/2000/svg"
      width={imageWidth}
      height={imageHeight}
      style={{
        position: 'absolute', top: 0, left: 0,
        transformOrigin: '0 0',
        transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
        userSelect: 'none',
        pointerEvents: 'all',
        cursor: 'pointer',
      }}
      onMouseMove={handleSvgMouseMove}
      onMouseLeave={handleSvgMouseLeave}
      onClick={handleSvgClick}
    >
      {fogD && <path d={fogD} fill="#1c1917" fillOpacity={0.92} stroke="#292524" strokeWidth={0.5} />}

      {scoutedEntries.map(([terrain, segs]) => (
        <path key={`s-${terrain}`} d={segs.join('')}
          fill={TERRAIN_COLOR[terrain]} fillOpacity={0.55} stroke="#78716c" strokeWidth={1} />
      ))}

      {visitedEntries.map(([terrain, segs]) => (
        <path key={`v-${terrain}`} d={segs.join('')}
          fill={TERRAIN_COLOR[terrain]} fillOpacity={0.08} stroke="#57534e" strokeWidth={1} />
      ))}

      {hoveredVc && (
        <polygon points={hexCorners(hoveredVc.x, hoveredVc.y, HEX_SIZE)}
          fill={hoveredFillColor} fillOpacity={hoveredFillOpacity}
          stroke="#a8a29e" strokeWidth={1.5}
          style={{ pointerEvents: 'none' }} />
      )}

      {selectedVc && (
        <polygon points={hexCorners(selectedVc.x, selectedVc.y, HEX_SIZE)}
          fill="none" stroke="#fbbf24" strokeWidth={2}
          style={{ pointerEvents: 'none' }} />
      )}

      {settlVc && (
        <text x={settlVc.x} y={settlVc.y + 5} textAnchor="middle" fontSize={13} fill="#fcd34d"
          style={{ pointerEvents: 'none', userSelect: 'none' }}>
          {'\u2302'}
        </text>
      )}

      {expeditionMarkers.map(m => (
        <circle key={m.name} cx={m.x} cy={m.y} r={6}
          fill="#fbbf24" stroke="#78350f" strokeWidth={1.5}
          style={{ pointerEvents: 'none' }} />
      ))}

      {hoveredCell && (
        <HexTooltip cell={hoveredCell} svgX={tooltipPos.x} svgY={tooltipPos.y}
          expeditionHere={expeditionPositions.get(hoveredKey!) ?? null} />
      )}
    </svg>
  );
}

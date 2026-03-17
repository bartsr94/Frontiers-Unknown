/**
 * Inline SVG icons for settlement buildings.
 * Each icon is a simple 24×24 pictogram suitable for building slots.
 */
import React from 'react';
import type { BuildingId } from '../../simulation/turn/game-state';

interface Props {
  id: BuildingId;
  size?: number;
  className?: string;
}

// ─── Icon paths keyed by BuildingId ──────────────────────────────────────────

const ICONS: Partial<Record<BuildingId, React.ReactNode>> = {
  camp: (
    // Triangle tent + fire dot
    <>
      <polygon points="12,3 2,21 22,21" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <line x1="12" y1="21" x2="12" y2="13" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="22.5" r="1.2" fill="currentColor" />
    </>
  ),
  longhouse: (
    // Rectangular hall with peaked roof
    <>
      <rect x="3" y="11" width="18" height="10" fill="none" stroke="currentColor" strokeWidth="2" />
      <polyline points="3,11 12,4 21,11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <rect x="10" y="16" width="4" height="5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </>
  ),
  roundhouse: (
    // Circle base + conical roof
    <>
      <ellipse cx="12" cy="17" rx="8" ry="5" fill="none" stroke="currentColor" strokeWidth="2" />
      <polyline points="4,17 12,5 20,17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </>
  ),
  great_hall: (
    // Wide hall with towers at each end
    <>
      <rect x="4" y="12" width="16" height="9" fill="none" stroke="currentColor" strokeWidth="2" />
      <polyline points="4,12 12,5 20,12" fill="none" stroke="currentColor" strokeWidth="2" />
      <rect x="2" y="9" width="3" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <rect x="19" y="9" width="3" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </>
  ),
  clan_lodge: (
    // Wide rounded lodge with decorative crossbeam
    <>
      <rect x="3" y="12" width="18" height="9" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
      <polyline points="3,12 12,4 21,12" fill="none" stroke="currentColor" strokeWidth="2" />
      <line x1="3" y1="16" x2="21" y2="16" stroke="currentColor" strokeWidth="1.2" />
    </>
  ),
  granary: (
    // Raised platform + barrel silhouette
    <>
      <rect x="7" y="7" width="10" height="13" rx="1" fill="none" stroke="currentColor" strokeWidth="2" />
      <line x1="7" y1="11" x2="17" y2="11" stroke="currentColor" strokeWidth="1.2" />
      <line x1="7" y1="15" x2="17" y2="15" stroke="currentColor" strokeWidth="1.2" />
      <line x1="4" y1="20" x2="20" y2="20" stroke="currentColor" strokeWidth="2" />
    </>
  ),
  fields: (
    // Ploughed rows
    <>
      <line x1="3" y1="8" x2="21" y2="8" stroke="currentColor" strokeWidth="1.5" />
      <line x1="3" y1="12" x2="21" y2="12" stroke="currentColor" strokeWidth="1.5" />
      <line x1="3" y1="16" x2="21" y2="16" stroke="currentColor" strokeWidth="1.5" />
      <line x1="6" y1="5" x2="4" y2="19" stroke="currentColor" strokeWidth="1.2" />
      <line x1="12" y1="5" x2="10" y2="19" stroke="currentColor" strokeWidth="1.2" />
      <line x1="18" y1="5" x2="16" y2="19" stroke="currentColor" strokeWidth="1.2" />
    </>
  ),
  workshop: (
    // Anvil silhouette
    <>
      <rect x="6" y="13" width="12" height="7" rx="1" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M8,13 L8,9 Q8,6 12,6 Q16,6 16,9 L16,13" fill="none" stroke="currentColor" strokeWidth="2" />
      <line x1="9" y1="10" x2="15" y2="10" stroke="currentColor" strokeWidth="1.2" />
    </>
  ),
  trading_post: (
    // Scale / balance
    <>
      <line x1="12" y1="3" x2="12" y2="21" stroke="currentColor" strokeWidth="2" />
      <line x1="4" y1="8" x2="20" y2="8" stroke="currentColor" strokeWidth="2" />
      <circle cx="4" cy="13" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="20" cy="11" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </>
  ),
  healers_hut: (
    // Cross / caduceus simplified
    <>
      <rect x="10" y="4" width="4" height="16" rx="1" fill="none" stroke="currentColor" strokeWidth="2" />
      <rect x="4" y="10" width="16" height="4" rx="1" fill="none" stroke="currentColor" strokeWidth="2" />
    </>
  ),
  gathering_hall: (
    // People/arch silhouette
    <>
      <path d="M4,20 Q4,10 12,8 Q20,10 20,20" fill="none" stroke="currentColor" strokeWidth="2" />
      <line x1="4" y1="20" x2="20" y2="20" stroke="currentColor" strokeWidth="2" />
      <circle cx="9" cy="16" r="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="15" cy="16" r="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </>
  ),
  palisade: (
    // Row of stakes
    <>
      {[4, 8, 12, 16, 20].map(x => (
        <polyline key={x} points={`${x},20 ${x},7 ${x},5`} stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      ))}
      <line x1="3" y1="13" x2="21" y2="13" stroke="currentColor" strokeWidth="1.5" />
    </>
  ),
  stable: (
    // Horse head silhouette
    <>
      <path d="M8,20 L8,13 Q8,8 13,7 Q18,6 18,11 L18,13 Q16,15 14,14 L14,20"
        fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <line x1="8" y1="20" x2="14" y2="20" stroke="currentColor" strokeWidth="2" />
      <circle cx="16.5" cy="9" r="1" fill="currentColor" />
    </>
  ),
  mill: (
    // Windmill cross sails
    <>
      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="2" />
      <line x1="12" y1="9" x2="12" y2="3" stroke="currentColor" strokeWidth="2" />
      <line x1="12" y1="15" x2="12" y2="21" stroke="currentColor" strokeWidth="2" />
      <line x1="9" y1="12" x2="3" y2="12" stroke="currentColor" strokeWidth="2" />
      <line x1="15" y1="12" x2="21" y2="12" stroke="currentColor" strokeWidth="2" />
      <rect x="10" y="17" width="4" height="5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </>
  ),
  smithy: (
    // Hammer + flame
    <>
      <path d="M5,19 L14,10 L17,7 Q19,5 20,7 Q21,9 19,10 L16,13 L7,22 Z"
        fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M15,9 L17,7" stroke="currentColor" strokeWidth="2" />
      <path d="M8,6 Q9,3 11,4 Q10,6 12,7 Q11,9 9,8 Q7,8 8,6Z"
        fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </>
  ),
  tannery: (
    // Hide/spool shape
    <>
      <ellipse cx="12" cy="12" rx="8" ry="6" fill="none" stroke="currentColor" strokeWidth="2" />
      <ellipse cx="12" cy="12" rx="3" ry="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <line x1="4" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="1.5" />
      <line x1="15" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="1.5" />
    </>
  ),
  brewery: (
    // Barrel
    <>
      <ellipse cx="12" cy="6" rx="7" ry="3" fill="none" stroke="currentColor" strokeWidth="2" />
      <ellipse cx="12" cy="20" rx="7" ry="3" fill="none" stroke="currentColor" strokeWidth="2" />
      <line x1="5" y1="6" x2="5" y2="20" stroke="currentColor" strokeWidth="2" />
      <line x1="19" y1="6" x2="19" y2="20" stroke="currentColor" strokeWidth="2" />
      <line x1="4" y1="13" x2="20" y2="13" stroke="currentColor" strokeWidth="1.2" />
    </>
  ),
  wattle_hut: (
    // Simple hut
    <>
      <rect x="5" y="13" width="14" height="8" fill="none" stroke="currentColor" strokeWidth="2" />
      <polyline points="5,13 12,6 19,13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <rect x="10" y="17" width="4" height="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </>
  ),
  cottage: (
    // Hut with chimney
    <>
      <rect x="4" y="13" width="16" height="8" fill="none" stroke="currentColor" strokeWidth="2" />
      <polyline points="4,13 12,6 20,13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <rect x="10" y="17" width="4" height="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <rect x="15" y="9" width="2.5" height="5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </>
  ),
  homestead: (
    // Two-storey house
    <>
      <rect x="3" y="12" width="18" height="9" fill="none" stroke="currentColor" strokeWidth="2" />
      <polyline points="3,12 12,4 21,12" fill="none" stroke="currentColor" strokeWidth="2" />
      <rect x="10" y="16" width="4" height="5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <rect x="5" y="14" width="3" height="3" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <rect x="16" y="14" width="3" height="3" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </>
  ),
  compound: (
    // Walled estate
    <>
      <rect x="2" y="6" width="20" height="16" fill="none" stroke="currentColor" strokeWidth="2" />
      <rect x="7" y="10" width="10" height="8" fill="none" stroke="currentColor" strokeWidth="2" />
      <polyline points="7,10 12,6 17,10" fill="none" stroke="currentColor" strokeWidth="2" />
      <line x1="11" y1="14" x2="13" y2="14" stroke="currentColor" strokeWidth="1.5" />
    </>
  ),
  bathhouse: (
    // Bath tub / pool shape
    <>
      <path d="M4,14 Q4,20 12,20 Q20,20 20,14" fill="none" stroke="currentColor" strokeWidth="2" />
      <line x1="4" y1="14" x2="20" y2="14" stroke="currentColor" strokeWidth="2" />
      <line x1="4" y1="14" x2="4" y2="10" stroke="currentColor" strokeWidth="2" />
      <line x1="4" y1="10" x2="7" y2="10" stroke="currentColor" strokeWidth="2" />
      <circle cx="9" cy="10" r="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="13" cy="10" r="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </>
  ),
  bathhouse_improved: (
    // Larger bath with steam lines
    <>
      <path d="M4,14 Q4,20 12,20 Q20,20 20,14" fill="none" stroke="currentColor" strokeWidth="2" />
      <line x1="4" y1="14" x2="20" y2="14" stroke="currentColor" strokeWidth="2" />
      <path d="M8,12 Q9,9 8,7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12,11 Q13,8 12,6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M16,12 Q17,9 16,7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </>
  ),
  bathhouse_grand: (
    // Grand arch + steam
    <>
      <path d="M4,20 L4,10 Q4,5 12,5 Q20,5 20,10 L20,20" fill="none" stroke="currentColor" strokeWidth="2" />
      <line x1="4" y1="20" x2="20" y2="20" stroke="currentColor" strokeWidth="2" />
      <path d="M8,13 Q9,10 8,8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12,12 Q13,9 12,7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M16,13 Q17,10 16,8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </>
  ),
};

// Fallback: building outline with a question mark
const FallbackIcon = () => (
  <>
    <rect x="4" y="4" width="16" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
    <text x="12" y="16" textAnchor="middle" fontSize="10" fill="currentColor" fontFamily="sans-serif">?</text>
  </>
);

export function BuildingIcon({ id, size = 24, className }: Props) {
  const content = ICONS[id] ?? <FallbackIcon />;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label={id}
    >
      {content}
    </svg>
  );
}

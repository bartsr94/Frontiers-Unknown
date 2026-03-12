/**
 * AdviceBubble — in-character adviser speech for the event phase.
 *
 * Renders above the council seat strip as part of normal document flow
 * (not absolutely positioned) so the layout height adjusts naturally.
 */

import type { WorkRole } from '../../simulation/population/person';
import { ROLE_LABELS as BASE_ROLE_LABELS } from '../shared/role-display';

// AdviceBubble labels unassigned council seats as 'Adviser' rather than 'Unassigned'.
const ROLE_LABELS: Record<WorkRole, string> = { ...BASE_ROLE_LABELS, unassigned: 'Adviser' };

interface AdviceBubbleProps {
  text:         string;
  advisorName:  string;
  advisorRole:  WorkRole;
}

export default function AdviceBubble({ text, advisorName, advisorRole }: AdviceBubbleProps) {
  return (
    <div className="mb-2 bg-stone-900 border border-amber-800 rounded px-4 py-3">
      <p className="text-stone-200 text-sm leading-relaxed italic">
        &ldquo;{text}&rdquo;
      </p>
      <p className="text-amber-500 text-xs mt-2 text-right font-medium">
        — {advisorName}, {ROLE_LABELS[advisorRole]}
      </p>
    </div>
  );
}

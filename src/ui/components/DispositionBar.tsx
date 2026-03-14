/**
 * DispositionBar — reusable tribe disposition indicator.
 * Shared between TradeView and DiplomacyView.
 */

interface Props {
  value: number; // -100 to +100
}

export default function DispositionBar({ value }: Props) {
  const pct      = Math.round(((value + 100) / 200) * 100);
  const barColor = value >= 50 ? 'bg-emerald-500'
                 : value >= 20 ? 'bg-amber-500'
                 : value >= 0  ? 'bg-orange-600'
                 : 'bg-red-600';
  const label    = value >= 70 ? 'Friendly'
                 : value >= 40 ? 'Neutral'
                 : value >= 20 ? 'Wary'
                 : value >= 0  ? 'Hostile'
                 : 'Enemies';
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-xs text-stone-400">
        <span>{label}</span>
        <span>{value > 0 ? `+${value}` : value}</span>
      </div>
      <div className="w-full h-1.5 bg-stone-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

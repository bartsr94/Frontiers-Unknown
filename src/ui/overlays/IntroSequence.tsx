/**
 * IntroSequence — multi-step game setup wizard.
 *
 * Step 0: Preamble / title
 * Step 1: Charter (settlement name + difficulty)
 * Step 2: Companions (3 stackable toggle cards)
 * Step 3: Destination (5 Kethani locations)
 * Step 4: Summary + Begin
 */

import { useState } from 'react';
import { useGameStore } from '../../stores/game-store';
import type { GameConfig } from '../../simulation/turn/game-state';

// ── Location metadata ─────────────────────────────────────────────────────────

interface LocationMeta {
  id: string;
  name: string;
  flavour: string;
  distance: string;
  supplyNote: string;
  supplyModifier: number;
  languageNote: string;
  wildbornNote: string;
  hazardNote: string;
  startingBonus: string;
  blend: string;
}

const LOCATIONS: LocationMeta[] = [
  {
    id: 'kethani_mouth',
    name: 'The Kethani Mouth',
    flavour: 'Where the Kethani joins the Black River. Company patrols come through every few weeks. The tribes here have been dealing with Imanians since before your grandfather was born.',
    distance: '3–4 days downriver to Shackle Station',
    supplyNote: 'Full supply delivery (×1.0) — the ships always reach you.',
    supplyModifier: 1.0,
    languageNote: 'Most headwomen you will meet have dealt with Imanians before. 2 nearby tribes have functional Tradetalk.',
    wildbornNote: 'Wildborn women: Kiswani Riverfolk, Tradetalk fluency 0.35.',
    hazardNote: 'Company inspector events fire at normal frequency. Proximity means the Company notices everything.',
    startingBonus: 'Standard starting resources.',
    blend: 'Strongly Imanian — easy to hold at the Company end of the scale.',
  },
  {
    id: 'kethani_lowlands',
    name: 'The Kethani Lowlands',
    flavour: 'A broad stretch of flat river plain two days upriver. Plenty of arable land. The tribes here know the Imanians by reputation more than by encounter.',
    distance: '6–7 days downriver to Shackle Station',
    supplyNote: 'Good supply delivery (×0.85) — ships reach most years.',
    supplyModifier: 0.85,
    languageNote: 'Some headwomen have met traders from downriver. Others have not. 1 tribe has functional Tradetalk.',
    wildbornNote: 'Wildborn women: Kiswani Riverfolk or Hanjoda Bloodmoon, Tradetalk fluency 0.25.',
    hazardNote: 'Good farmland. Seasonal flooding in Spring. Bloodmoon presence means early military pressure is plausible.',
    startingBonus: '+5 food — rich floodplain.',
    blend: 'Marginally Imanian — slight native pull over time.',
  },
  {
    id: 'kethani_midreach',
    name: 'The Kethani Midreach',
    flavour: 'Halfway along the Kethani, where the plains begin. The river narrows here. Company boats can make it in a good year, not every year. The tribes are watching.',
    distance: '10–12 days downriver to Shackle Station',
    supplyNote: 'Unreliable supply (×0.60) — may be delayed a season. Plan ahead.',
    supplyModifier: 0.6,
    languageNote: 'Tradetalk is a novelty here. Some women have a few words. Most do not.',
    wildbornNote: 'Wildborn women: Hanjoda Stormcaller or Bloodmoon, Tradetalk fluency 0.15.',
    hazardNote: 'Lower Company scrutiny — more freedom, less support. Balanced identity pressures can both activate.',
    startingBonus: 'Standard starting resources.',
    blend: 'Balanced — neither Imanian nor native culture dominates at the start.',
  },
  {
    id: 'kethani_uplands',
    name: 'The Kethani Uplands',
    flavour: 'Where the grasslands begin in earnest and the river grows cold. No Company boat has come this far in living memory. The Hanjoda have ruled this land since before the Company existed.',
    distance: '16+ days; overland sections required',
    supplyNote: 'Difficult supply (×0.35) — one ship per year in Spring only, may skip years.',
    supplyModifier: 0.35,
    languageNote: 'An interpreter might exist somewhere. Finding them is another matter entirely.',
    wildbornNote: 'Wildborn women: Hanjoda Stormcaller, Tradetalk fluency 0.05 — almost nothing shared.',
    hazardNote: 'No Company supply for first 1–2 years. Large Stormcaller population means cultural drift is fast. High risk, high reward.',
    startingBonus: '+10 lumber, −5 food — dense highland forest, harsher foraging.',
    blend: 'Native lean — tribal culture is dominant in the environment.',
  },
  {
    id: 'kethani_headwaters',
    name: 'The Kethani Headwaters',
    flavour: 'The river\'s source country, where it descends from the mountain passes. Stormcaller territory. Men from the Company have never settled here. Possibly no Imanian has ever wintered here at all.',
    distance: '20+ days; sometimes impassable in winter',
    supplyNote: 'Almost no supply (×0.15) — one ship every 2–3 years at best.',
    supplyModifier: 0.15,
    languageNote: 'There is no common tongue. You will need to build one from nothing, or not at all.',
    wildbornNote: 'Wildborn women: Hanjoda Stormcaller, zero Tradetalk — no shared language whatsoever.',
    hazardNote: 'Maximum language isolation. Severe winters. Sacred Stormcaller sites nearby. Company oversight essentially absent.',
    startingBonus: '+5 stone, −10 food, −5 lumber — mountain rock is everywhere; the land is harsh.',
    blend: 'Heavy native lean — the Imanian settlers are the foreigners here.',
  },
];

// ── Companion count helpers ───────────────────────────────────────────────────

function estimateCompanionCount(choices: { imanianWives: boolean; townbornAuxiliaries: boolean; wildbornWomen: boolean }): number {
  let extra = 0;
  if (choices.imanianWives) extra += 3; // avg 2.5 wives + avg 0.3 child ≈ 3
  if (choices.townbornAuxiliaries) extra += 3;
  if (choices.wildbornWomen) extra += 3;
  return 10 + extra;
}

// ── Step components ───────────────────────────────────────────────────────────

interface PreambleStepProps {
  onBegin: () => void;
  onSkip: () => void;
}

function PreambleStep({ onBegin, onSkip }: PreambleStepProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-stone-950 px-4 py-12">
      <div className="max-w-2xl w-full text-center space-y-6">
        <div className="space-y-1">
          <h1 className="text-4xl font-bold text-amber-200 tracking-wide">Frontiers Unknown</h1>
          <p className="text-amber-600 text-sm uppercase tracking-widest">Palusteria — Children of the Ashmark</p>
        </div>

        <div className="border-t border-amber-900 my-2" />

        <div className="space-y-4 text-amber-300 text-base leading-relaxed text-left max-w-xl mx-auto">
          <p className="italic">
            Year Three of the Ashmark Initiative. The Ansberry Company has pushed its Black River
            operations as far upriver as Shackle Station — and Shackle Station is not enough.
          </p>
          <p className="italic">
            Your charter authorises you to proceed west along the tributary the Sauromatians call
            the Kethani, establish a settlement before the onset of winter, and begin returning
            value to the Company within ten years. The document is very precise about the return
            of value. It is considerably less precise about how you achieve it.
          </p>
          <p className="italic">
            You have ten men, a season's supplies, and a collection of decisions already made.
            Who came with you. Where along the river you chose to stop. These choices are yours.
            What follows from them is yours as well.
          </p>
        </div>

        <div className="border-t border-amber-900 my-2" />

        <div className="flex flex-col items-center gap-3 pt-2">
          <button
            onClick={onBegin}
            className="bg-amber-800 hover:bg-amber-700 text-amber-100 font-semibold px-8 py-3 rounded border border-amber-700 transition-colors text-base"
          >
            Begin the Expedition
          </button>
          <button
            onClick={onSkip}
            className="text-stone-500 hover:text-stone-400 text-sm transition-colors"
          >
            Skip Intro
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Step 1: Charter ───────────────────────────────────────────────────────────

interface CharterStepProps {
  name: string;
  setName: (v: string) => void;
  difficulty: 'easy' | 'normal' | 'hard';
  setDifficulty: (v: 'easy' | 'normal' | 'hard') => void;
  onBack: () => void;
  onNext: () => void;
}

const DIFFICULTY_OPTIONS: Array<{ value: 'easy' | 'normal' | 'hard'; label: string; description: string }> = [
  { value: 'easy',   label: 'The Company Is Patient',   description: 'Slower quota ramp. Generous supply deliveries. For those who want to focus on the settlement, not the deadline.' },
  { value: 'normal', label: 'By the Book',              description: 'Standard quota schedule. Company watches but does not hover. The intended experience.' },
  { value: 'hard',   label: 'The Inspector Watches',    description: 'Quota begins in year 5. Every failure costs standing. For those who relish pressure.' },
];

function CharterStep({ name, setName, difficulty, setDifficulty, onBack, onNext }: CharterStepProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-stone-950 px-4 py-12">
      <div className="max-w-xl w-full space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-amber-200 mb-1">The Charter</h2>
          <p className="text-amber-700 text-sm">Name your settlement and set the difficulty.</p>
        </div>

        <div className="space-y-2">
          <label className="text-amber-400 text-sm font-semibold uppercase tracking-wider block">
            Settlement Name
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Kethani Post"
            maxLength={40}
            className="w-full bg-stone-800 border border-stone-600 text-amber-100 rounded px-3 py-2 focus:outline-none focus:border-amber-600 placeholder-stone-500"
          />
        </div>

        <div className="space-y-2">
          <label className="text-amber-400 text-sm font-semibold uppercase tracking-wider block">
            Difficulty
          </label>
          <div className="space-y-2">
            {DIFFICULTY_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setDifficulty(opt.value)}
                className={`w-full text-left px-4 py-3 rounded border transition-colors ${
                  difficulty === opt.value
                    ? 'bg-amber-900 border-amber-600 text-amber-100'
                    : 'bg-stone-800 border-stone-700 text-stone-300 hover:border-stone-500'
                }`}
              >
                <div className="font-semibold text-sm">{opt.label}</div>
                <div className="text-xs mt-0.5 opacity-75">{opt.description}</div>
              </button>
            ))}
          </div>
        </div>

        <StepNav onBack={onBack} onNext={onNext} nextLabel="Choose Companions →" />
      </div>
    </div>
  );
}

// ── Step 2: Companions ────────────────────────────────────────────────────────

interface CompanionsStepProps {
  imanianWives: boolean;
  setImanianWives: (v: boolean) => void;
  townbornAuxiliaries: boolean;
  setTownbornAuxiliaries: (v: boolean) => void;
  wildbornWomen: boolean;
  setWildbornWomen: (v: boolean) => void;
  location: string;
  onBack: () => void;
  onNext: () => void;
}

function CompanionCard({
  toggled,
  onToggle,
  title,
  flavour,
  impacts,
  warning,
}: {
  toggled: boolean;
  onToggle: () => void;
  title: string;
  flavour: string;
  impacts: string[];
  warning?: string;
}) {
  return (
    <div
      className={`border rounded p-4 cursor-pointer transition-colors ${
        toggled ? 'bg-amber-950 border-amber-600' : 'bg-stone-900 border-stone-700 hover:border-stone-500'
      }`}
      onClick={onToggle}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className={`font-semibold text-base ${toggled ? 'text-amber-200' : 'text-stone-300'}`}>{title}</h3>
        <div className={`w-5 h-5 rounded flex-shrink-0 border flex items-center justify-center mt-0.5 ${
          toggled ? 'bg-amber-600 border-amber-500' : 'bg-stone-700 border-stone-600'
        }`}>
          {toggled && <span className="text-white text-xs leading-none">✓</span>}
        </div>
      </div>
      <p className="text-stone-400 text-xs italic mb-3 leading-relaxed">{flavour}</p>
      <ul className="space-y-1">
        {impacts.map((impact, i) => (
          <li key={i} className="text-stone-500 text-xs flex items-start gap-1.5">
            <span className="text-stone-600 mt-0.5">·</span>
            <span>{impact}</span>
          </li>
        ))}
      </ul>
      {warning && (
        <p className="text-amber-700 text-xs mt-3 italic">{warning}</p>
      )}
    </div>
  );
}

function CompanionsStep({
  imanianWives, setImanianWives,
  townbornAuxiliaries, setTownbornAuxiliaries,
  wildbornWomen, setWildbornWomen,
  location,
  onBack, onNext,
}: CompanionsStepProps) {
  const count = estimateCompanionCount({ imanianWives, townbornAuxiliaries, wildbornWomen });
  const locMeta = LOCATIONS.find(l => l.id === location);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-stone-950 px-4 py-12">
      <div className="max-w-xl w-full space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-amber-200 mb-1">Your Companions</h2>
          <p className="text-amber-700 text-sm">Three independent choices. Any combination is valid.</p>
        </div>

        <CompanionCard
          toggled={imanianWives}
          onToggle={() => setImanianWives(!imanianWives)}
          title="Imanian Wives"
          flavour="Three of your men chose not to leave their families behind. Their wives are with them."
          impacts={[
            '+2–3 founding women (Imanian, orthodox)',
            'Households form immediately — some men are not available for casual courtship',
            'Higher starting Imanian cultural blend',
            'No shared language with Sauromatian companions — potential tension early',
            'Possible child: one wife may bring a young child, age 2–6',
          ]}
        />

        <CompanionCard
          toggled={townbornAuxiliaries}
          onToggle={() => setTownbornAuxiliaries(!townbornAuxiliaries)}
          title="Townborn Auxiliaries"
          flavour="Shackle Station has no shortage of mixed-blood locals looking for the kind of opportunity a new settlement represents. Three of them agreed to come."
          impacts={[
            '+3 mixed-heritage settlers (Imanian/Kiswani — culturally between both worlds)',
            'Strong Tradetalk speakers — linguistic bridging available from day 1',
            'Familiar with both Imanian and Sauromatian customs — reduced integration friction',
            'Your Imanian cultural share will be lower from the start',
            'Their children will drift toward native culture faster than pure Imanian births',
          ]}
          warning={
            locMeta && (locMeta.id === 'kethani_uplands' || locMeta.id === 'kethani_headwaters')
              ? '★ At this location their logistical knowledge provides a small supply delivery bonus (+0.10).'
              : undefined
          }
        />

        <CompanionCard
          toggled={wildbornWomen}
          onToggle={() => setWildbornWomen(!wildbornWomen)}
          title="Wildborn Sauromatian Women"
          flavour="Through an intermediary at Shackle Station, you have arranged for two or three women of a local tribe to join the expedition. They know little of Imanian ways. You know little of theirs."
          impacts={[
            locMeta ? locMeta.wildbornNote : '+2–3 pure Sauromatian women (tribe depends on location)',
            'Sacred Wheel religion — will create religious tension with orthodox men',
            'Little to no shared language — significant early integration difficulty',
            'Strong female-skewed birth pressure — your settlement will grow female-heavy',
            'Extended fertility — high birth rate, births lean heavily female',
          ]}
          warning={
            location === 'kethani_headwaters'
              ? '⚠ At the headwaters: no common language exists at all — communication starts at zero.'
              : undefined
          }
        />

        <div className="text-center text-stone-400 text-sm py-1">
          Starting with approximately <span className="text-amber-400 font-semibold">{count} settlers</span>
        </div>

        <StepNav onBack={onBack} onNext={onNext} nextLabel="Choose Destination →" />
      </div>
    </div>
  );
}

// ── Step 3: Destination ───────────────────────────────────────────────────────

interface DestinationStepProps {
  location: string;
  setLocation: (v: string) => void;
  onBack: () => void;
  onNext: () => void;
}

function SupplyBar({ modifier }: { modifier: number }) {
  const pct = Math.round(modifier * 100);
  const color = modifier >= 0.75 ? 'bg-green-700' : modifier >= 0.45 ? 'bg-amber-700' : modifier >= 0.25 ? 'bg-orange-700' : 'bg-red-800';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-stone-700 rounded h-2">
        <div className={`${color} h-2 rounded transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-stone-400 text-xs w-10 text-right">{pct}%</span>
    </div>
  );
}

function DestinationStep({ location, setLocation, onBack, onNext }: DestinationStepProps) {
  const selected = LOCATIONS.find(l => l.id === location) ?? LOCATIONS[0]!;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-stone-950 px-4 py-12">
      <div className="max-w-2xl w-full space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-amber-200 mb-1">Your Destination</h2>
          <p className="text-amber-700 text-sm">Five locations along the Kethani River. Further west means more freedom — and more hardship.</p>
        </div>

        {/* River strip — east to west, left to right */}
        <div className="relative">
          {/* River line */}
          <div className="absolute top-1/2 left-0 right-0 h-1 bg-blue-900 -translate-y-1/2 rounded" />
          <div className="relative flex justify-between items-center py-4 px-2">
            {LOCATIONS.map((loc) => (
              <button
                key={loc.id}
                onClick={() => setLocation(loc.id)}
                className={`relative flex flex-col items-center gap-1 z-10 group transition-all`}
              >
                {/* Node */}
                <div className={`w-4 h-4 rounded-full border-2 transition-all ${
                  loc.id === location
                    ? 'bg-amber-500 border-amber-400 scale-125'
                    : 'bg-stone-700 border-stone-500 hover:border-stone-400 hover:scale-110'
                }`} />
                {/* Label */}
                <span className={`text-xs text-center max-w-16 leading-tight ${
                  loc.id === location ? 'text-amber-300' : 'text-stone-500 group-hover:text-stone-400'
                }`}>
                  {loc.name.replace('The Kethani ', '')}
                </span>
              </button>
            ))}
          </div>
          {/* Direction labels */}
          <div className="flex justify-between text-stone-600 text-xs px-2 -mt-1">
            <span>← Company (east)</span>
            <span>Wilderness (west) →</span>
          </div>
        </div>

        {/* Detail panel */}
        <div className="bg-stone-900 border border-stone-700 rounded p-4 space-y-3">
          <div>
            <h3 className="text-amber-300 font-semibold text-base">{selected.name}</h3>
            <p className="text-stone-400 text-sm italic mt-1 leading-relaxed">{selected.flavour}</p>
          </div>

          <div className="grid grid-cols-1 gap-2 text-sm">
            <DetailRow label="Distance" value={selected.distance} />
            <div>
              <span className="text-stone-500 text-xs uppercase tracking-wide">Company Supply</span>
              <SupplyBar modifier={selected.supplyModifier} />
              <p className="text-stone-500 text-xs mt-0.5">{selected.supplyNote}</p>
            </div>
            <DetailRow label="Cultural blend" value={selected.blend} />
            <DetailRow label="Language" value={selected.languageNote} />
            <DetailRow label="Starting resources" value={selected.startingBonus} />
            <DetailRow label="Hazards" value={selected.hazardNote} icon="⚠" />
          </div>
        </div>

        <StepNav onBack={onBack} onNext={onNext} nextLabel="Review & Depart →" />
      </div>
    </div>
  );
}

function DetailRow({ label, value, icon }: { label: string; value: string; icon?: string }) {
  return (
    <div>
      <span className="text-stone-500 text-xs uppercase tracking-wide">{icon ? `${icon} ${label}` : label}</span>
      <p className="text-stone-300 text-xs mt-0.5 leading-relaxed">{value}</p>
    </div>
  );
}

// ── Step 4: Summary ───────────────────────────────────────────────────────────

interface SummaryStepProps {
  name: string;
  difficulty: 'easy' | 'normal' | 'hard';
  location: string;
  imanianWives: boolean;
  townbornAuxiliaries: boolean;
  wildbornWomen: boolean;
  onBack: () => void;
  onBegin: () => void;
}

function SummaryStep({
  name, difficulty, location,
  imanianWives, townbornAuxiliaries, wildbornWomen,
  onBack, onBegin,
}: SummaryStepProps) {
  const locMeta = LOCATIONS.find(l => l.id === location) ?? LOCATIONS[0]!;
  const count = estimateCompanionCount({ imanianWives, townbornAuxiliaries, wildbornWomen });
  const diffLabel = DIFFICULTY_OPTIONS.find(d => d.value === difficulty)?.label ?? difficulty;

  const companions: string[] = [];
  if (imanianWives) companions.push('Imanian wives');
  if (townbornAuxiliaries) companions.push('Townborn auxiliaries');
  if (wildbornWomen) companions.push('Wildborn Sauromatian women');

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-stone-950 px-4 py-12">
      <div className="max-w-lg w-full space-y-5">
        <div>
          <h2 className="text-2xl font-bold text-amber-200 mb-1">Ready to Depart</h2>
          <p className="text-amber-700 text-sm">Review your setup, then begin.</p>
        </div>

        <div className="bg-stone-900 border border-stone-700 rounded p-4 space-y-3 text-sm">
          <SummaryRow label="Settlement" value={name || 'Kethani Post'} highlight />
          <SummaryRow label="Difficulty" value={diffLabel} />
          <SummaryRow label="Location" value={locMeta.name} />
          <SummaryRow label="Distance" value={locMeta.distance} />
          <SummaryRow
            label="Supply delivery"
            value={`${Math.round(locMeta.supplyModifier * 100)}% of standard`}
          />
          <div className="border-t border-stone-800 pt-3">
            <SummaryRow
              label="Founding party"
              value={`~${count} settlers`}
            />
            {companions.length > 0 ? (
              <ul className="mt-1 space-y-0.5">
                {companions.map(c => (
                  <li key={c} className="text-stone-500 text-xs flex items-center gap-1.5">
                    <span className="text-amber-700">+</span> {c}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-stone-500 text-xs mt-1">Men only — no companions selected.</p>
            )}
          </div>
        </div>

        <p className="text-stone-500 text-xs italic text-center">
          {locMeta.flavour}
        </p>

        <div className="flex gap-3">
          <button
            onClick={onBack}
            className="bg-stone-800 hover:bg-stone-700 text-stone-300 text-sm px-4 py-2 rounded border border-stone-600 transition-colors"
          >
            ← Back
          </button>
          <button
            onClick={onBegin}
            className="flex-1 bg-amber-800 hover:bg-amber-700 text-amber-100 font-semibold py-3 rounded border border-amber-700 transition-colors"
          >
            Begin the Expedition
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-baseline gap-2">
      <span className="text-stone-500 text-xs uppercase tracking-wide flex-shrink-0">{label}</span>
      <span className={`text-right ${highlight ? 'text-amber-300 font-semibold' : 'text-stone-300'} text-sm`}>{value}</span>
    </div>
  );
}

// ── Shared nav component ──────────────────────────────────────────────────────

function StepNav({ onBack, onNext, nextLabel }: { onBack: () => void; onNext: () => void; nextLabel: string }) {
  return (
    <div className="flex gap-3 pt-2">
      <button
        onClick={onBack}
        className="bg-stone-800 hover:bg-stone-700 text-stone-300 text-sm px-4 py-2 rounded border border-stone-600 transition-colors"
      >
        ← Back
      </button>
      <button
        onClick={onNext}
        className="flex-1 bg-amber-800 hover:bg-amber-700 text-amber-100 text-sm font-semibold py-2 rounded border border-amber-700 transition-colors"
      >
        {nextLabel}
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function IntroSequence() {
  const newGame = useGameStore(s => s.newGame);

  const [step, setStep]       = useState<0 | 1 | 2 | 3 | 4>(0);
  const [name, setName]       = useState('Kethani Post');
  const [difficulty, setDifficulty] = useState<'easy' | 'normal' | 'hard'>('normal');
  const [imanianWives, setImanianWives]             = useState(false);
  const [townbornAuxiliaries, setTownbornAuxiliaries] = useState(false);
  const [wildbornWomen, setWildbornWomen]           = useState(false);
  const [location, setLocation] = useState('kethani_mouth');

  function buildConfig(): GameConfig {
    return {
      difficulty,
      startingTribes: [],
      startingLocation: location,
      companionChoices: { imanianWives, townbornAuxiliaries, wildbornWomen },
    };
  }

  function handleSkip() {
    newGame(
      {
        difficulty: 'normal',
        startingTribes: [],
        startingLocation: 'kethani_mouth',
        companionChoices: { imanianWives: false, townbornAuxiliaries: false, wildbornWomen: true },
      },
      'Kethani Post',
    );
  }

  function handleBegin() {
    newGame(buildConfig(), name.trim() || 'Kethani Post');
  }

  if (step === 0) {
    return <PreambleStep onBegin={() => setStep(1)} onSkip={handleSkip} />;
  }
  if (step === 1) {
    return (
      <CharterStep
        name={name} setName={setName}
        difficulty={difficulty} setDifficulty={setDifficulty}
        onBack={() => setStep(0)} onNext={() => setStep(2)}
      />
    );
  }
  if (step === 2) {
    return (
      <CompanionsStep
        imanianWives={imanianWives} setImanianWives={setImanianWives}
        townbornAuxiliaries={townbornAuxiliaries} setTownbornAuxiliaries={setTownbornAuxiliaries}
        wildbornWomen={wildbornWomen} setWildbornWomen={setWildbornWomen}
        location={location}
        onBack={() => setStep(1)} onNext={() => setStep(3)}
      />
    );
  }
  if (step === 3) {
    return (
      <DestinationStep
        location={location} setLocation={setLocation}
        onBack={() => setStep(2)} onNext={() => setStep(4)}
      />
    );
  }
  return (
    <SummaryStep
      name={name} difficulty={difficulty} location={location}
      imanianWives={imanianWives} townbornAuxiliaries={townbornAuxiliaries} wildbornWomen={wildbornWomen}
      onBack={() => setStep(3)} onBegin={handleBegin}
    />
  );
}

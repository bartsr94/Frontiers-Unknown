# Palusteria: Children of the Ashmark

A colony management simulation game set in the Palusteria frontier. Lead an Ansberry Company expedition as it grows from ten men in the wilderness into a settlement with its own mixed-heritage culture and identity.

Inspired by King of Dragon Pass and Crusader Kings II. Every person is named, tracked genetically, and consequential.

---

## Stack

| Layer | Technology |
|-------|-----------|
| UI | React 19 + TypeScript (strict) |
| Build | Vite 7 |
| State | Zustand 5 |
| Styling | Tailwind CSS 3 |
| Testing | Vitest 4 |

No backend. No database. Runs entirely client-side; saves to localStorage.

---

## Getting Started

```bash
npm install
npm run dev        # → http://localhost:5173
npm test           # Run test suite
npx tsc --noEmit   # Type-check
```

---

## Development Status

| Phase | Name | Status |
|-------|------|--------|
| 1 | Foundation — Ten Men in the Wilderness | ✅ Complete |
| 2 | Genetics Engine — Children of Two Worlds | ✅ Complete |
| 3 | Living Settlement — A Place Called Home | ✅ Complete |
| 3.5 | Household Depth — The Ashkaran | ✅ Complete |
| 4 | Polish — The Ashmark Remembers | 🔲 Planned |

**Phase 3 progress:** Language acquisition engine ✅ · Cultural identity & drift system ✅ · Founder character variety ✅ · Skills & experience tracking ✅ · Council voice system ✅ · Character portrait system ✅ · Event `add_person` consequence ✅ · Settlement buildings & construction system ✅ · Event character binding (named actors, `{slot}` interpolation, portrait strip) ✅ · Economy system (Company quota, tribe trade, spoilage, crafting) ✅ · Generic task roles (Forager, Quarrier, Lumberjack) ✅ · Tilled Fields building ✅ · Clickable role assignment ✅

**Phase 3.5 progress:** Household data model & serialisation ✅ · `household.ts` utility module ✅ · Marriage auto-forms households ✅ · Thrall social status with freedom pathway ✅ · Keth-Thara work role ✅ · Ashka-Melathi bond formation (per-turn dawn step) ✅ · Wife-council events ✅ · PersonDetail household section ✅ · Informal Union tab in MarriageDialog ✅ · Full household test suite (29 tests) ✅

---

## Documentation

- [CLAUDE.md](CLAUDE.md) — Developer context, current state, hard rules, quick-reference file table
- [plans/PORTRAIT_SYSTEM.md](plans/PORTRAIT_SYSTEM.md) — Portrait system design (categories, age stages, file naming, registry)
- [plans/COUNCIL_VOICE_SYSTEM.md](plans/COUNCIL_VOICE_SYSTEM.md) — Council voice & adviser portrait design
- [plans/PHASE3_SKILLS.md](plans/PHASE3_SKILLS.md) — Skills system design (base skills, derived skills, generation algorithm)
- [plans/PALUSTERIA_ARCHITECTURE.md](plans/PALUSTERIA_ARCHITECTURE.md) — Technical architecture and data models
- [plans/PALUSTERIA_GAME_DESIGN.md](plans/PALUSTERIA_GAME_DESIGN.md) — Game design document (what and why)
- [plans/EVENT_CHARACTER_BINDING.md](plans/EVENT_CHARACTER_BINDING.md) — Event character binding system (actor slots, text interpolation, portrait strip)
- [plans/ECONOMY_SYSTEM.md](plans/ECONOMY_SYSTEM.md) — Economy system design (Company quota, tribe trade, spoilage, crafting)
- [plans/HOUSEHOLD_DEPTH.md](plans/HOUSEHOLD_DEPTH.md) — Household system design (ashkarans, Keth-Thara, thralls, Ashka-Melathi bonds, wife-council)

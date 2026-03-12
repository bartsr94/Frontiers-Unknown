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
| 3 | Living Settlement — A Place Called Home | 🔄 In Progress |
| 4 | Polish — The Ashmark Remembers | 🔲 Planned |

**Phase 3 progress:** Language acquisition engine ✅ · Cultural identity & drift system ✅ · Founder character variety ✅ · Skills & experience tracking ✅ · Council voice system ✅ · Character portrait system ✅ · Event `add_person` consequence (people-joining events now populate the settlement) ✅ · Settlement buildings & construction system ✅

---

## Documentation

- [CLAUDE.md](CLAUDE.md) — Developer context, current state, hard rules, quick-reference file table
- [plans/PORTRAIT_SYSTEM.md](plans/PORTRAIT_SYSTEM.md) — Portrait system design (categories, age stages, file naming, registry)
- [plans/COUNCIL_VOICE_SYSTEM.md](plans/COUNCIL_VOICE_SYSTEM.md) — Council voice & adviser portrait design
- [plans/PHASE3_SKILLS.md](plans/PHASE3_SKILLS.md) — Skills system design (base skills, derived skills, generation algorithm)
- [plans/PALUSTERIA_ARCHITECTURE.md](plans/PALUSTERIA_ARCHITECTURE.md) — Technical architecture and data models
- [plans/PALUSTERIA_GAME_DESIGN.md](plans/PALUSTERIA_GAME_DESIGN.md) — Game design document (what and why)

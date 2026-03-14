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
| 3.6 | Opinions & Autonomy — Characters of Will | ✅ Complete |
| 3.7 | Religion System — Faiths of the Ashmark | ✅ Complete |
| 3.8 | Cultural Identity Pressure | ✅ Complete |
| 3.9 | Trait Expansion — Character Agency | ✅ Complete |
| 4.0 | Character Autonomy — Deep Agency | ✅ Complete |
| 4 | Polish — The Ashmark Remembers | 🔲 Planned |

**Phase 3 progress:** Language acquisition engine ✅ · Cultural identity & drift system ✅ · Founder character variety ✅ · Skills & experience tracking ✅ · Council voice system ✅ · Character portrait system ✅ · Event `add_person` consequence ✅ · Settlement buildings & construction system ✅ · Event character binding (named actors, `{slot}` interpolation, portrait strip) ✅ · Economy system (Company quota, tribe trade, spoilage, crafting) ✅ · Generic task roles (Forager, Quarrier, Lumberjack) ✅ · Tilled Fields building ✅ · Clickable role assignment ✅

**Phase 3.5 progress:** Household data model & serialisation ✅ · `household.ts` utility module ✅ · Marriage auto-forms households ✅ · Thrall social status with freedom pathway ✅ · Keth-Thara work role ✅ · Ashka-Melathi bond formation (per-turn dawn step) ✅ · Wife-council events ✅ · PersonDetail household section ✅ · Informal Union tab in MarriageDialog ✅ · Full household test suite (29 tests) ✅

**Phase 3.6 progress:** Opinion scores (baseline: culture, religion, language, trait affinities/clashes) ✅ · Per-turn opinion drift & decay ✅ · Marriage opinion gate (< −30 = hard block) ✅ · `modify_opinion` event consequence (broadcast to all observers) ✅ · `computeOpinionBreakdown()` for UI tooltips ✅ · `PersonAmbition` model (5 ambition types) ✅ · Ambition generation, intensity ticking, fulfillment/failure evaluation ✅ · 5 autonomous ambition-driven events in `relationships.ts` ✅ · Ambition badge + Key Opinions section in PersonDetail ✅ · Opinion + ambition seeded at game start ✅ · 67 new tests (37 opinions + 30 ambitions) ✅ · Event-driven decaying opinion modifiers (`OpinionModifier`, `modify_opinion_pair`, `modify_opinion_labeled`) ✅ · Auto-bond between co-actors (`skipActorBond` opt-out) ✅ · 5 event definitions retrofitted with pair/labeled modifiers ✅ · `getEffectiveOpinion()` used across all decision gates ✅ · Modifier tooltip in PersonDetail shows `(Nt)` countdown ✅ · 38 new modifier tests across `addOpinionModifier`, `getEffectiveOpinion`, `getModifierSummary`, `decayOpinionModifiers` ✅

**Phase 3.7 progress:** Three faiths (`imanian_orthodox`, `sacred_wheel`, `syncretic_hidden_wheel`) ✅ · `ReligiousPolicy` (4 values: tolerant, orthodox_enforced, wheel_permitted, hidden_wheel_recognized) ✅ · Hidden Wheel divergence counter (20-turn / 5-year emergence mechanic) ✅ · Religious tension formula (damped by Hidden Wheel spread) ✅ · Company religious pressure drain (annual standing penalty scaled by Wheel fraction) ✅ · 7 religion events (2 programmatic-injection, 5 player-facing) ✅ · Priesthood roles (`priest_solar`, `wheel_singer`, `voice_of_wheel`) ✅ · `ReligionPanel` in SettlementView (faith bars, tension indicator, Hidden Wheel progress, policy dropdown) ✅ · 19 new tests ✅

**Phase 3.8 progress:** Five-zone cultural blend identity scale (Extreme/Soft Imanian → Safe → Soft/Extreme Native) ✅ · `IdentityPressure` counters (`companyPressureTurns` / `tribalPressureTurns`) ✅ · `processIdentityPressure()` pure logic — company standing delta per zone, tribe trait-weighted disposition deltas ✅ · 6 identity events ✅ · `modify_cultural_blend` and `modify_all_tribe_dispositions` consequences ✅ · `sauromatianHeritage` actor criterion ✅ · `IdentityScale` widget (five-zone bar, tick mark, pressure badges) mounted in SettlementView Religion sidebar ✅ · 35 new tests ✅

**Phase 3.9 progress:** `TraitDefinition` catalog (~80 traits across 6 categories) ✅ · `mental_state` temporary traits with `traitExpiry` map ✅ · Expanded `TRAIT_CONFLICTS` (21 pairs) + `TRAIT_SHARED_BONUS` (15 entries) ✅ · `computeTraitCategoryBoosts` event-deck shaping ✅ · `applyTraitOpinionEffects` per-turn autonomous opinion drift ✅ · `getTraitSkillGrowthBonuses` per-turn skill deltas ✅ · `applyTemporaryTraitExpiry` + 5-pathway earned trait acquisition ✅ · `inheritAptitudeTraits()` called at birth ✅ · Event deck shaped by trait composition each dawn ✅ · 128 new tests ✅

**Phase 4.0 progress:** Named relationships (`friend` / `rival` / `nemesis` / `confidant` / `mentor` / `student`) with opinion-gated formation and dissolution ✅ · `processNamedRelationships()` + `seedFoundingRelationships()` wired into `processDawn()` ✅ · Scheme engine — 5 scheme types (`court_person`, `convert_faith`, `befriend_person`, `undermine_person`, `tutor_person`) with progress-based event firing ✅ · 5 scheme events in `definitions/schemes.ts` ✅ · Faction system — 6 faction types (`cultural_preservationists`, `company_loyalists`, `orthodox_faithful`, `wheel_devotees`, `community_elders`, `merchant_bloc`) with membership, strength, and collective demands ✅ · `activityLog` rolling 30-entry feed with 11 log entry types ✅ · `CommunityView` tab — population/bonds summary, factions panel, activity feed ✅ · `ActivityFeed` component with per-type icons and clickable person chips ✅ · `applySharedRoleOpinionDrift()` — co-workers develop opinions passively ✅ · Bug fixes: founder trait pool expanded, ambition opinion thresholds tuned, friend threshold & sustain turns tuned ✅ · 135 new tests across 4 new test files ✅

**1116/1116 tests across 36 test files — zero compile errors.**

---

- [CLAUDE.md](CLAUDE.md) — Developer context, current state, hard rules, quick-reference file table
- [plans/PORTRAIT_SYSTEM.md](plans/PORTRAIT_SYSTEM.md) — Portrait system design (categories, age stages, file naming, registry)
- [plans/COUNCIL_VOICE_SYSTEM.md](plans/COUNCIL_VOICE_SYSTEM.md) — Council voice & adviser portrait design
- [plans/PHASE3_SKILLS.md](plans/PHASE3_SKILLS.md) — Skills system design (base skills, derived skills, generation algorithm)
- [plans/PALUSTERIA_ARCHITECTURE.md](plans/PALUSTERIA_ARCHITECTURE.md) — Technical architecture and data models
- [plans/PALUSTERIA_GAME_DESIGN.md](plans/PALUSTERIA_GAME_DESIGN.md) — Game design document (what and why)
- [plans/EVENT_CHARACTER_BINDING.md](plans/EVENT_CHARACTER_BINDING.md) — Event character binding system (actor slots, text interpolation, portrait strip)
- [plans/ECONOMY_SYSTEM.md](plans/ECONOMY_SYSTEM.md) — Economy system design (Company quota, tribe trade, spoilage, crafting)
- [plans/HOUSEHOLD_DEPTH.md](plans/HOUSEHOLD_DEPTH.md) — Household system design (ashkarans, Keth-Thara, thralls, Ashka-Melathi bonds, wife-council)
- [plans/OPINIONS_SYSTEM.md](plans/OPINIONS_SYSTEM.md) — Opinion score system (baseline, drift, decay, marriage gate, trait affinities)
- [plans/AUTONOMY_SYSTEM.md](plans/AUTONOMY_SYSTEM.md) — Character autonomy system (ambitions, intensity, 5 ambition-driven events)
- [plans/RELIGION_SYSTEM.md](plans/RELIGION_SYSTEM.md) — Religion system design (three faiths, Hidden Wheel emergence, religious policy, Company pressure)
- [plans/CULTURAL_IDENTITY_PRESSURE.md](plans/CULTURAL_IDENTITY_PRESSURE.md) — Cultural identity pressure design (five-zone blend scale, passive Company/tribe deltas, 6 identity events)
- [plans/TRAIT_EXPANSION.md](plans/TRAIT_EXPANSION.md) — Trait expansion design (~80 traits, 6 categories, temporary traits, aptitude inheritance, earned trait acquisition)
- [plans/CHARACTER_AUTONOMY_OVERHAUL.md](plans/CHARACTER_AUTONOMY_OVERHAUL.md) — Character autonomy design (named relationships, scheme engine, factions, activity log, community view)

# Palusteria: Children of the Ashmark — Game Design Document

**Version:** 1.0  
**Document Type:** Game Design (What & Why)  
**Companion Document:** `PALUSTERIA_ARCHITECTURE.md` (How)  
**Setting:** The Ashmark region of Palusteria

---

## 1. Vision Statement

You are the leader of a small Imanian expedition sent by the Ansberry Company to establish a trading outpost in the contested Ashmark region of Palusteria. Your initial party of roughly ten men must survive, trade, grow, and eventually turn a profit — or be abandoned by the Company that sent you.

Every person under your command is a named individual with a face, a family, a personality, and a genetic heritage. The decisions you make about who marries whom, which strangers you welcome, which children you educate, and which cultures you embrace will reshape your settlement's identity over generations. Marry your men to local Sauromatian women and within two generations your outpost becomes a matriarchal, copper-skinned community where Imanian is a second language. Import brides from Port Iron and you stay culturally pure but grow slowly and lack the local knowledge to thrive. The game does not judge these choices — it simulates their consequences.

Over 50 to 100 years of seasonal turns, you will watch your outpost grow from a handful of tents into a settlement with its own culture, its own mixed-heritage population, and its own place in the complex politics of the Ashmark. The children born in your settlement will look different from their parents. Their children will look different again. This is the game.

---

## 2. Core Design Pillars

### 2.1 Every Person Matters
At small population sizes, every individual is visible, named, and consequential. You know who they are, who they love, what they want. As the population grows, management abstractions unlock — but the individuals never stop existing underneath.

### 2.2 Genetics Are Visible
Mixed-heritage children inherit visible traits from both parents. Skin tone, hair color, eye color, build, and facial features blend in ways that reflect real genetic inheritance. A settlement that has intermarried with Kiswani Riverfolk for three generations should *look* different from one that married Stormcaller Hanjoda, and both should look different from one that imported Imanian wives.

### 2.3 Culture Is Emergent
The settlement's culture is not chosen from a menu — it emerges from the sum of who lives there, who holds authority, what religions are practiced, and what languages are spoken. A majority-Sauromatian settlement with an Imanian ruling family feels different from a fully integrated Townborn-style hybrid.

### 2.4 Consequences Cascade
A single decision (accepting a group of Sauromatian refugees) ripples through demographics, genetics, culture, economy, and politics for decades. The game rewards players who think in generations, not seasons.

### 2.5 No Right Answer
The game presents dilemmas, not puzzles. There is no optimal strategy — only trade-offs between growth and stability, cultural purity and adaptation, Company loyalty and local integration.

---

## 3. Game Loop

### 3.1 Turn Structure

Each turn represents one season (Spring, Summer, Autumn, Winter). A game year consists of four turns. A typical playthrough spans 50–100 years (200–400 turns).

Each turn follows this sequence:

**Dawn Phase (automatic)** — Age all individuals. Process pregnancies and births. Resolve health and mortality (illness, old age, childbirth risk). Update relationship states. Calculate resource production and consumption.

**Event Phase (player interaction)** — Draw 1–3 events from the event deck. Player makes choices for each event. Immediate consequences are applied.

**Management Phase (player interaction)** — Assign work roles. Arrange marriages and approve courtships. Manage trade with the Company and local tribes. Make construction and expansion decisions. Handle diplomacy with neighbors.

**Dusk Phase (automatic)** — Apply seasonal effects (harvest in Autumn, hardship in Winter). Process trade income and Company quota tracking. Update opinion and relationship modifiers. Advance to next season.

### 3.2 Seasonal Variation

**Spring** — Planting season. New arrivals from the Company (if relations are good). Sauromatian tribes emerge from winter camps. Diplomatic opportunities. Birth season for children conceived in summer.

**Summer** — Peak activity. Trade caravans arrive. Raids are most common. Festivals and ceremonies. The heat tests Imanian settlers. Romance and courtship peak. Essence-sharing festivals occur among Sauromatian neighbours.

**Autumn** — Harvest. The Company ship arrives to collect its quota. Preparations for winter. Marriage season (securing partnerships before the lean months). Political maneuvering as tribes consolidate.

**Winter** — Survival. Reduced food. Illness spreads. Close quarters force social tensions to the surface. Births from spring conceptions. Stories told around fires — culture is reinforced or challenged. Raids are rare but desperate when they come.

---

## 4. Population System

### 4.1 The Individual

Every person in the game is a named individual with biological traits (sex, age, genetics, health, fertility), cultural identity (heritage, languages, religion, self-identification), personality (2–4 fixed traits from the Crusader Kings model), relationships (family bonds, marriages, opinions of others), and a functional role in the settlement.

Children inherit bloodline fractions mathematically from their parents (average of mother and father), but cultural identity is determined by upbringing — which the player influences through education, language teaching, and religious choices.

### 4.2 Heritage: Blood vs. Culture

Heritage has two independent axes that can diverge:

**Bloodline** tracks biological ancestry as fractions (e.g., 50% Imanian, 25% Kiswani Riverfolk, 25% Hanjoda Stormcaller). This drives physical trait inheritance, the Sauromatian gender ratio, and Kethara's fertility bargain.

**Cultural identity** tracks how a person sees themselves and how they behave. A child with majority Sauromatian bloodline raised in an Imanian-run school speaking Imanian might identify as Ansberite. A pure Imanian child raised by a Kiswani foster-mother might identify as Townborn. The player influences this through policy and personal decisions.

### 4.3 Population Scaling

The game must remain playable from 10 people to 500+. The UI adapts through four tiers:

**Intimate (1–30):** Every person visible in a single roster. All decisions are personal.

**Village (31–80):** Family and household grouping becomes the primary view. Individual drill-down still available. Batch operations appear.

**Town (81–200):** Role-based views dominate. Council of elders makes recommendations. Player approves or overrides.

**Settlement (200+):** Demographic dashboard with policy-level decisions. Notable individuals still surface through events.

All views remain available at all sizes — the game defaults to the appropriate level and surfaces the most relevant information.

---

## 5. Genetics System

### 5.1 Design Philosophy

The genetics system tracks visible physical traits and the Sauromatian gender ratio modifier. It is designed with explicit extension points for hidden traits (disease resistance, magical aptitude, lifespan) in future expansions.

### 5.2 Visible Traits

Each person has a genetic profile defining: skin tone (continuous spectrum from palest Imanian to darkest Bayuk), skin undertone (cool pink, warm olive, copper, bronze, neutral), hair color and texture, eye color (brown, grey, blue, amber, green, hazel), build type (lean, athletic, stocky, wiry, heavyset), and height class.

### 5.3 Ethnic Trait Distributions

Each ethnic group defines probability distributions for every visible trait. These are authored directly from the lore documents:

**Imanian:** Fair skin (0.2 on the 0–1 scale), cool pink or neutral undertone, blonde to dark brown hair, straight to wavy texture, blue/grey/green eyes common, variable build, average height.

**Kiswani Riverfolk:** Dark copper skin (0.65), copper undertone dominant, black hair, wavy to curly, remarkably diverse eye colors (the most genetically mixed Kiswani group), athletic build, tall.

**Kiswani Bayuk:** Dark skin (0.8), bronze undertone, black hair often dyed red, curly to coily, distinctive grey eyes, compact/short build, exceptional endurance.

**Kiswani Haisla:** Darkly tanned (0.7), warm undertone, black hair in dreadlocks, grey to blue eyes, lean/muscular build from maritime life, average height.

**Hanjoda Stormcaller:** Notably light skin for Sauromatians (0.35), cool to neutral undertone, blonde hair common, straight to wavy, grey/blue eyes, wiry/gaunt build, very tall.

**Hanjoda Bloodmoon:** Medium-dark skin (0.6) under red ochre dye, warm undertone, dark hair, athletic lean build, average to tall, brown/dark eyes.

**Hanjoda Talon:** Distinctive charcoal-grey skin (0.75), neutral undertone, black hair, amber/yellow eyes (their most distinctive marker — lore suggests non-Sauromatian ancestry), athletic with characteristically wide hips in women, average height.

**Hanjoda Emrasi:** Light tan to deep bronze (0.5, high variance), warm undertone, variable hair, medium athletic build from maritime work, average height.

### 5.4 Inheritance

When a child is born, each visible trait is resolved by sampling from a blended distribution. The blend is weighted 70% from the ethnic population distribution (based on the child's bloodline fractions) and 30% biased toward the actual parent values. This ensures children resemble their specific parents, not just a generic average of their ethnicities. Siblings from the same parents will look recognizably related but individually distinct.

Continuous traits (skin tone) use Gaussian sampling around a blended mean. Discrete traits (eye color) use weighted random selection from a merged probability table.

### 5.5 The Gender Ratio

The single most impactful genetic mechanic in the game. Sauromatian women produce dramatically more daughters than sons — roughly 6 females per 1 male. When a Sauromatian woman has children with an Imanian man, the ratio shifts to approximately 2–3:1. This is calculated per-couple based on both parents' bloodlines.

The practical consequence: if your settlement intermarries heavily with Sauromatians, within two generations you will have far more women than men, and your social structure must adapt. This is not a problem to solve — it is the central demographic reality that drives the entire game's social dynamics.

### 5.6 Extended Fertility (Kethara's Bargain)

Women with any Sauromatian maternal ancestry remain fertile into their early fifties. This is inherited strictly through the maternal line — a daughter always inherits her mother's fertility profile regardless of father. Pure Imanian women see fertility decline sharply after 35.

This creates a significant asymmetry: Sauromatian and mixed-race women can bear children for decades longer, making them more demographically valuable. A settlement with many Sauromatian mothers grows faster than one relying on Imanian women alone.

### 5.7 Portraits

Visible traits drive a procedural portrait system. Phase 1 uses text descriptions. Phase 2 uses layered sprite portraits with pre-drawn base faces, skin tint overlays, hair variants, and accessory layers selected and colored by the genetics. The portrait system reads from visible traits and heritage only — it never touches genetics internals.

---

## 6. Personality System

### 6.1 Traits

Each person has 2–4 permanent personality traits assigned at birth or earned through life events. Traits follow the Crusader Kings model: named labels with mechanical effects on behavior, events, and relationships.

**Personality traits:** Ambitious, Content, Gregarious, Shy, Brave, Craven, Cruel, Kind, Greedy, Generous, Lustful, Chaste, Wrathful, Patient, Deceitful, Honest, Proud, Humble.

**Aptitude traits:** Strong, Weak, Clever, Slow, Beautiful, Plain, Robust, Sickly, Fertile, Barren.

**Cultural traits:** Traditional (resists cultural change), Cosmopolitan (embraces mixing), Devout (strong religious conviction), Skeptical (questions all faiths), Xenophobic (hostile to outsiders), Welcoming (open to strangers).

**Earned traits** (gained through events): Veteran, Scarred, Respected Elder, Scandal, Oath-Breaker, Hero, Coward, Wealthy, Indebted.

Some traits conflict — a person cannot be both Brave and Craven, or both Kind and Cruel. Certain trait combinations create emergent personality archetypes (Ambitious + Cruel = a dangerous schemer; Kind + Brave = a natural leader).

### 6.2 Opinions

Every person holds opinions (-100 to +100) of others they know, modified by shared culture, religion, family bonds, trait interactions, and event history. Opinions drive autonomous behavior at higher population levels and influence event outcomes. Opinions decay toward neutral over time unless reinforced.

### 6.3 Future Expansion

The architecture reserves a module slot for a deeper Dwarf Fortress-style mood/needs system. When built, traits will modify how needs are weighted (a Gregarious person has higher social needs) and how mood is calculated, but the existing trait system won't change.

---

## 7. Economy and Trade

### 7.1 Resources

The settlement tracks nine resource types: food (consumed per person per season), cattle (herd animals that produce a food bonus each season), goods (an abstraction of manufactured and acquired trade goods — furs, herbs, pearls, the Ashmark's currency), steel (Imanian metal goods — enormously valuable to Sauromatians), lumber and stone (construction), medicine (reduces mortality), gold (Company currency), and horses (Sauromatian wealth, needed for caravans and warfare).

### 7.2 The Company Quota

Each year, the Company expects a quota of gold and trade goods. The quota starts low (years 1–3, the establishment period) and ramps up as the Company expects returns.

Failure consequences slide:

- **First miss:** Warning letter. Standing drops. Reduced supplies next year.
- **Second consecutive miss:** Major standing drop. Support level decreases. An inspector arrives.
- **Third miss:** Minimal support. Final warning.
- **Fourth miss:** Abandoned. No more Company resources, reinforcements, or trade. This is not game over — but it fundamentally changes the game. You're on your own.

Exceeding the quota raises standing, unlocks better trade deals, and lets you request specific support (send women, send a blacksmith, send soldiers).

### 7.3 Trade Partners

**The Company:** Reliable but demanding. You sell trade goods and gold; they sell steel, medicine, and manufactured goods. Prices favor the Company.

**Local Sauromatian Tribes:** Barter-based. They want steel, medicine, and manufactured goods. They offer food, horses, furs, herbs, river pearls, and local knowledge. Relationship-dependent.

**Passing Traders:** Event-driven one-off opportunities. A Weri caravan, a Haisla boat crew, a Confederate merchant — these create surprise trade windows.

---

## 8. Event System

### 8.1 Design

Events are the primary gameplay interface — the player's main point of interaction with the world. Each event presents a situation, offers 2–4 choices, and applies consequences. Events are filtered by prerequisites (population, relations, resources, specific people present) and drawn from a weighted deck each turn.

Events are categorized as: diplomacy, domestic, economic, military, cultural, personal, environmental, and company. The deck ensures variety — you won't get three military events during peacetime.

### 8.2 Combat Events

Following the King of Dragon Pass model, combat is handled through events with tactical choices. When a raid occurs, you choose an approach (defend, negotiate, tribute, flee) and assign specific people. You can pick how many fighters to commit and what tactics to use. Resolution is stat-based with narrative output — no tactical map. People can be wounded, killed, or distinguished in battle.

### 8.3 Event Examples

**"The Riverfolk Widow"** — A Kiswani woman with three daughters arrives seeking shelter. Do you welcome her freely, welcome her with conditions (she must marry one of your men), offer temporary shelter, or turn her away? Each choice has demographic, diplomatic, and social consequences.

**"Company Directive: Send Women"** — Imanian women are available for marriage to your settlers at 50 gold each. Do you buy brides, spend the gold on craftsmen instead, or decline? This directly shapes your settlement's genetic and cultural future.

**"The Stormcaller Delegation"** — A Hanjoda tribe offers horses and young men as husbands in exchange for steel. This only fires if you have unmarried Sauromatian women and a Stormcaller tribe in your game. It reverses the usual dynamic — now *you* are receiving husbands.

**"Raid on the Outpost"** — Hostile warriors approach. You choose your response and assign defenders. Combat traits (Strong, Brave, Veteran) and equipment determine odds. The narrative describes what happens. People may die.

### 8.4 Event Chains

Some events trigger follow-ups. Accepting the Riverfolk widow might lead to "Her clan hears of your generosity" a year later — more Kiswani arrive seeking a home. Turning her away might trigger "A trader mentions your outpost turned away women — the tribes think you are cold." Consequences echo.

---

## 9. Cultural Simulation

### 9.1 Language

People speak languages with varying fluency. An Imanian settler with zero Kiswani cannot communicate with a Wildborn wife beyond gestures. Children learn languages from parents and community — strongest influence is the mother's tongue. The player can establish schools to teach specific languages. Tradetalk is a bridge language with limited vocabulary. Over generations, a creole may emerge naturally.

### 9.2 Religion

Three traditions plus a syncretic blend:

**Imanian Orthodoxy:** Formal, hierarchical, patriarchal. The Company expects it.

**Sauromatian Sacred Wheel:** Animist, matriarchal, connected to land and spirits.

**Syncretic (Hidden Wheel):** The Townborn synthesis — Imanian saints mapped onto Sauromatian spirits. Emerges naturally in mixed communities.

Religious tension generates events. An Imanian zealot demands you ban Sauromatian ceremonies. A Sauromatian elder threatens to leave if you enforce Imanian worship. Your choices shape which tradition dominates.

### 9.3 Settlement Culture

The settlement's overall cultural character is an emergent property calculated from population composition, language distribution, religious practice, governance style, and active cultural practices (warrior training, bathhouse culture, chivalric codes, matriarchal/patriarchal households). This profile shifts over time as demographics change — a slow drift that the player can influence but never fully control.

---

## 10. Diplomacy and the External World

### 10.1 Neighboring Tribes

At game start, the player selects 2–4 neighboring Sauromatian groups. Each has a population, disposition toward you, behavioral traits (warlike, peaceful, isolationist), desires (steel, medicine, alliance, men), and offerings (trade goods, warriors, wives, knowledge). Tribes act autonomously — they raid, trade, migrate, split, and are affected by external threats.

### 10.2 The Company

A persistent external entity with its own agenda. It wants gold and trade goods. It sends directives and inspectors. It can provide people, goods, and military support — if your standing is high. It has internal politics that the player glimpses through events.

### 10.3 Game Start Configuration

The player configures: expedition composition (choose starting people from a pool, balancing skills and traits), location along the Northern Tributary, neighboring tribes (2–4 from available pool), and difficulty (Company quota aggressiveness).

---

## 11. Key Design Risks

**Event content bottleneck:** The game needs 100+ well-written events to sustain 400 turns. Mitigation: template variables and chained events multiply content efficiently.

**Genetics feeling wrong:** Mixed-race children must look like plausible blends. Mitigation: parent-biased sampling and extensive multi-generation testing.

**Cultural simulation feeling shallow:** Mitigation: culture tracked across multiple independent axes (language, religion, governance, practices) that drift separately.

**Scope creep:** This is ambitious. Mitigation: strict phasing — the game is playable at the end of every implementation phase.

---

## 12. Inspirations and References

**King of Dragon Pass / Six Ages:** Event-driven clan management with deep lore integration. The model for our event system and turn structure.

**Crusader Kings II/III:** Individual characters with traits, opinions, marriages, and dynastic play. The model for our personality and relationship systems.

**Dwarf Fortress:** Every individual tracked, emergent stories from simulation. The aspiration for our population depth.

**Shadow Empire:** Procedural world generation feeding into governance simulation. Inspiration for how planetary parameters shape gameplay.

**The Ansberry Company setting:** The entire cultural backdrop — the gender ratio, the colonial dynamics, the matriarchal Sauromatian societies, the Townborn synthesis. This is not a generic fantasy setting; the game systems are designed specifically to explore its themes.

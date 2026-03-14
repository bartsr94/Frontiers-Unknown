# Palusteria: Children of the Ashmark — Game Design Document

**Version:** 1.6 (updated after Phase 4.0 — Character Autonomy)  
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

### 4.4 Household System

Households are tracked objects — named social units that form when marriages are arranged and persist as the settlement's basic domestic structure. Each household has a tradition type, a head, a senior wife, a set of members with specific roles, and optional Ashka-Melathi bonds between co-wives.

**Two irreconcilable models coexist in the founding generation.**

The *Sauromatian model* (_ashkaran_): a multi-wife compound where the wife-council holds real authority. The husband is the household's spiritual and legal face, but practical decisions are made by the women collectively. The senior wife speaks for the council. A husband who ignores his wife-council courts open conflict.

The *Imanian model*: a patriarch nominally leads and his word is law. Secondary wives (concubines) are quietly acknowledged, without formal standing. Women manage the household internally but perform public deference to male authority.

A third model emerges from the colonial experience: the *Ansberite hybrid*, in which a hearth-companion relationship (neither wife nor concubine) grants contractual rights to a secondary woman, and tradition itself is explicitly considered contested. Ansberite households are rare in the founding generation but become the settlement's default as the generations pass.

**Household roles:**

| Role | Description |
|------|-------------|
| `head` | The nominal patriarch — typically the husband |
| `senior_wife` | Eldest or highest-standing wife; leads the wife-council |
| `wife` | Full formal wife (blood-wife or formally elevated) |
| `concubine` | Informal but acknowledged; no spouseIds entry |
| `hearth_companion` | Ansberite formalisation — contractual rights without full wife standing |
| `child` | Dependent minor member (under 16) |
| `thrall` | Captive with restricted status; freed by bearing a son or by player choice |

**Thralls** are an acquired social status — never inherited. A thrall woman who bears a son triggers a wife-council event that forces the player to choose her future: elevate her as a wife, free her as a concubine of the household, or free her to make her own way. Her son is born free regardless.

**Keth-Thara duty** is a young man's cultural obligation, observed across all Sauromatian groups. A man between 17 and 30 may be assigned to Keth-Thara service by the player. He is unavailable for other work, events, or actor slots during his service. When his service ends, the event fires and he returns — spiritually fulfilled, culturally legitimate, and somewhat changed. Men who complete Keth-Thara gain social standing with Sauromatian spouses and wives.

**Ashka-Melathi bonds** form automatically between female household members who have been co-residents long enough for genuine closeness to develop. Each season there is a small chance (15%) that any unbonded pair of adult women in the same household forms an Ashka-Melathi bond. These bonds are the emotional centre of the Sauromatian household — they enable wife-council events, create new event prerequisites, and surface in the PersonDetail view.

**Wife-council events** fire when household conditions create tension between the expedition council's authority and the wife-council's practical power. Examples: the wife-council collectively demands the husband give them a formal voice in settlement decisions; two wives clash over the household's cultural tradition; a wife confronts her husband over his refusal to acknowledge an Ashka-Melathi bond as legitimate. These events represent the Sauromatian model pushing back against Imanian norms, and the player's choices gradually establish precedent.

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

**Personality traits:** Ambitious, Content, Gregarious, Shy, Brave, Craven, Cruel, Kind, Greedy, Generous, Lustful, Chaste, Wrathful, Patient, Deceitful, Honest, Proud, Humble, Vengeful, Forgiving, Melancholic, Sanguine, Zealous, Cynical, Curious, Stubborn, Charming, Suspicious, Trusting, Reckless, Envious, Protective.

**Social / relationship traits:** Devoted, Jealous, Fickle, Clingy, Mentor-Hearted, Contrarian.

**Aptitude traits:** Strong, Weak, Clever, Slow, Beautiful, Plain, Robust, Sickly, Fertile, Barren, Gifted Speaker, Green Thumb, Keen Hunter, Iron Constitution, Fleet-Footed.

**Cultural traits:** Traditional (resists cultural change), Cosmopolitan (embraces mixing), Devout (strong religious conviction), Skeptical (questions all faiths), Xenophobic (hostile to outsiders), Welcoming (open to strangers), Syncretist, Folklorist, Linguist, Honor-Bound, Company Man.

**Earned traits** (acquired through events or autonomous play): Veteran, Scarred, Respected Elder, Healer, Negotiator, Storyteller, Midwife, Scandal, Oath-Breaker, Outcast, Kinslayer, Exile, Hero, Coward, Wealthy, Indebted, Ghost-Touched, Blessed Birth, Bereaved.

**Mental state traits** (temporary — expire after a set number of turns): Grieving (8t), Inspired (6t), Restless (12t), Traumatized (12t), Homesick (16t), Bereaved (8t as mental state).

Some traits conflict — a person cannot be both Brave and Craven, or both Kind and Cruel. Certain trait combinations create emergent personality archetypes (Ambitious + Cruel = a dangerous schemer; Kind + Brave = a natural leader; Jealous + Devoted = a faithful but volatile spouse).

Each turn, traits create visible autonomous behaviour: a Jealous wife's opinion of her husband's concubine drifts down by 1 per turn. A Suspicious man's opinions of everyone drift down. A Charming woman's reputation among all settlers slowly improves. An Inspired artist's skills grow faster than normal, but the inspiration fades after six seasons. This makes personality differences observable and consequential without requiring the player to manually track each person's state.

### 6.2 Opinions

Every person holds opinions (-100 to +100) of others they know, modified by shared culture, religion, family bonds, trait interactions, and event history. Opinions decay toward neutral over time unless reinforced.

**Baseline sources:** Shared primary culture (+10), shared religion (+8), no common language above fluency 0.30 (−15), Tradetalk-only bridge (−5), trait conflicts (−10 to −20), shared rare traits (+8 to +12). Baselines are computed once when two people first encounter each other, then drift and decay with each passing turn.

**Per-turn drift:** Same-culture pairs drift +1/turn; pairs with no shared language drift −1/turn. All stored opinions decay 1 point toward 0 each turn and are removed when they reach 0.

**Marriage gate:** Neither party can marry or form an informal union if their opinion of the other is below −30.

**Tracking cap (`OPINION_TRACK_CAP = 150`):** Below this population size all pairs are actively tracked; above it only established entries are updated. This keeps the system performant at larger scales.

Opinions are visible in the PersonDetail panel as colour-coded chips (top‐3 positive in green, top-3 negative in red) with hover tooltips showing the breakdown by source.
**Event-driven decaying modifiers:** Alongside the permanent `relationships` score, each person carries an `opinionModifiers` list of timed experience entries. These model the emotional residue of a shared event — a joint project that succeeded, a bitter quarrel that was never fully resolved, a publicly praised act of generosity. Each modifier has a label, a signed value (positive = favour, negative = disfavour), and a duration: the magnitude of the value is exactly the number of turns the modifier persists, decaying by 1 per turn until it is gone.

New event consequences `modify_opinion_pair` and `modify_opinion_labeled` create timed modifiers. When an event resolves with multiple named actors, a small automatic `+2 "Shared: {event title}"` bond is applied between every co-actor pair unless the choice explicitly opts out (`skipActorBond: true` — used for hostile or quarrel outcomes). The tooltip in PersonDetail shows the countdown: **Joint project: +8 (6t)**.
### 6.3 Character Autonomy

Settlers act on their own. The player is the settlement’s overseer, not its puppet-master. They set conditions, observe what emerges, and intervene when it matters. All autonomous behaviour is visible to the player through PersonDetail badges, the Key Opinions panel, and a settlement-level Activity Feed.

**Ambitions** give each settler one active personal goal at a time:
- `seek_spouse` — an unmarried adult wants to marry
- `seek_council` — a skilled leader or diplomat wants a Council seat
- `seek_seniority` — a wife in a polygamous household wants the senior position
- `seek_cultural_duty` — a Sauromatian man wants to fulfil the keth-thara vow
- `seek_informal_union` — two attracted people want to formalise their bond

Ambitions start at 10% intensity and grow +5% per turn. The `content` trait blocks intensity growth. At 70% intensity (`AMBITION_FIRING_THRESHOLD`), the ambition can trigger one of five autonomous events in `definitions/relationships.ts`. Ambitions are visible as a badge in PersonDetail, colour-coded by intensity (grey → amber → rose).

**Named Relationships** form autonomously based on sustained opinion:
- When two people’s effective opinion of each other stays above threshold (`FRIEND_OPINION_THRESHOLD = 50`) for several consecutive turns (`FRIEND_SUSTAIN_TURNS = 4`), a `friend` bond forms silently.
- Negative sustained opinions form `rival` and `nemesis` bonds.
- Deeper bonds — `confidant`, `mentor`, `student` — form through mentoring schemes reaching their conclusion.
- Bonds dissolve when opinions drop back below threshold.
- At game start, `seedFoundingRelationships()` pre-seeds pairs with high/low opinions so the founding generation arrives with a social texture already in place.

**Schemes** are hidden personal projects each settler can pursue:
- `scheme_court_person` — romantic pursuit; triggered by `passionate`, `romantic`, `lonely` traits
- `scheme_convert_faith` — quiet evangelism; triggered by `devout`, `zealous` traits
- `scheme_befriend_person` — deliberate friendship-building; triggered by `gregarious`, `warm` traits
- `scheme_undermine_person` — sabotage of a competitor; triggered by `ambitious`, `cruel`, `envious` traits
- `scheme_tutor_person` — skill-mentoring; triggered by `mentor_hearted`, `patient` traits

Each scheme advances 1 progress/turn and fires a player-facing climax event when it reaches 100. Courtship, undermining, and faith advocacy climaxes surface as decisions. Befriending and tutoring reach their conclusion silently (a `friend` bond forms or a skill tick is awarded) unless discovered. A scheme badge in PersonDetail shows the player that someone is scheming, even if they can’t see exactly what.

**Factions** form when settlers who share values cluster together and demand a voice:
- `cultural_preservationists` — traditionalists who resist cultural drift
- `company_loyalists` — Imanian settlers prioritising Company standing
- `orthodox_faithful` — Orthodox worshippers opposed to Wheel spread
- `wheel_devotees` — Sacred Wheel practitioners seeking recognition
- `community_elders` — respected elders asserting collective wisdom
- `merchant_bloc` — traders and craftspeople focused on economic policy

A faction forms when at least 3 eligible members exist. At strength ≥ 0.45 (faction strength = member fraction × alignment), the faction generates a player-facing event demand. Factions are visible in the Community tab with strength bars and active demand indicators.

**Community Tab** (`CommunityView`) provides a settlement-level activity overview:
- **Left panel**: living population count, bond distribution (how many friendships, rivalries, mentorships exist)
- **Centre panel**: active factions with strength bars and demands
- **Right panel**: the rolling Activity Feed — a 30-entry log of every autonomous action captured in narrative form (relationship formed/dissolved, scheme started/succeeded/failed, faction formed/dissolved, trait acquired, ambition formed/cleared, role self-assigned)

Activity Feed entries include clickable person name chips that navigate directly to PersonDetail. This is the player’s window into everything that happened without their direct input.

**Shared-Role Opinion Drift**: settlers who share the same work role gain +1 opinion of each other per turn. Co-workers who spend years in the same job quietly become colleagues, then friends.

### 6.4 Future Expansion

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

People speak languages with varying fluency (`0.0`–`1.0`). There are five languages in the game:

- **Imanian** — the colonists' tongue; all founding settlers speak it natively
- **Kiswani** — spoken by the Kiswani Sauromatian groups (Riverfolk, Bayuk, Haisla)
- **Hanjoda** — spoken by the Hanjoda Sauromatian groups (Stormcaller, Bloodmoon, Talon, Emrasi)
- **Tradetalk** — a sparse pidgin used across all groups; limited vocabulary, maximum fluency 0.50
- **Settlement Creole** — emerges organically after ~5 years of sustained bilingualism

#### Acquisition

Fluency drifts upward passively every turn based on community exposure:

> `Δfluency = learningRate(age) × communityFraction × (1 − currentFluency)`

Children acquire languages ~30× faster than elderly adults (age-band rates: 0.040 at birth → 0.001 at 60+). A Sauromatian woman who arrives speaking no Imanian will gradually develop conversational fluency (~0.30) over several years if she lives in a predominantly Imanian-speaking settlement.

#### Child Language Inheritance

Newborns do **not** inherit native fluency from their parents. Instead they start at **0.10** for every language their mother or father speaks at conversational level (≥ 0.30). The community then teaches the child the rest through passive drift. This means a child of a monolingual Imanian father and a Kiswani-speaking mother is born hearing both languages but must grow up to speak them.

#### Tradetalk

Tradetalk is a bridge pidgin — it spreads quickly (2× learning rate bonus) but is permanently capped at 0.50. No one's native tongue; a useful stopgap in multilingual households while true bilingualism develops.

#### Creole Emergence

When ≥ 2 languages each exceed 10% community share for 20 consecutive turns (~5 in-game years), the settlement reaches sustained bilingualism. From that point forward, newborns are born already hearing the settlement creole: they receive `settlement_creole` at 0.10 alongside their inherited languages. The creole is a new tongue that can grow to native fluency through the same drift mechanism.

#### Language Tension

The settlement tracks a `languageTension` value (0.0–1.0) that peaks at 1.0 when the community is split exactly 50/50 between two languages. Tension drops toward zero as one language becomes dominant or the community converges on a single tongue. High tension unlocks cultural conflict events and can be a precondition for faction events.

#### Marriage and Language Barriers

When arranging a marriage, the `MarriageDialog` warns the player if the two people have no common language. Three compatibility levels:

- **Shared** — at least one language both speak at conversational level; no warning shown
- **Partial** — only Tradetalk as a bridge; a grey note points this out
- **None** — no language in common; amber warning flagged

### 9.2 Religion

Three faiths are active in the settlement from the founding generation:

**Imanian Orthodoxy (`imanian_orthodox`):** Formal, hierarchical, patriarchal. The Ansberry Company expects it. Founding traders all practice it. The Company's annual chaplain event attempts to keep it dominant.

**Sauromatian Sacred Wheel (`sacred_wheel`):** Animist, matriarchal, tied to Kethara and the turning of seasons. Every Sauromatian founding woman practices it. Carries the fertility resonance of Kethara's Bargain.

**Syncretic Hidden Wheel (`syncretic_hidden_wheel`):** The Townborn synthesis — Imanian saints mapped onto Sauromatian spirits. Never imported; it *emerges*. After 20 consecutive turns where both Orthodox and Wheel each claim at least 15% of the population, the Hidden Wheel crystallises as a third tradition. Until then it exists only as a counter the player cannot see.

#### Religious Tension

Tension peaks at 1.0 on an exact 50/50 Orthodox/Wheel split and drops as one tradition dominates or as the Hidden Wheel spreads (three-way splits damp the conflict). High tension (> 0.75) gates the `rel_tension_eruption` event. Orthodox + Wheel coexistence that isn’t actively suppressed also advances the divergence counter.

#### Religious Policy

The settlement has a `religiousPolicy` that the player sets from the Religion panel:

| Policy | Effect |
|--------|-------|
| `tolerant` | Default. No bonus, no penalty. Both faiths coexist openly. |
| `orthodox_enforced` | Freezes the Hidden Wheel counter. Eliminates Company pressure drain. Sauromatian women resent it. |
| `wheel_permitted` | Normal Company drain plus a flat −1 standing/year. Sauromatian women gain +5 opinion of the settlement. |
| `hidden_wheel_recognized` | Only available after Hidden Wheel emerges. Doubles Company pressure drain. Doubles Hidden Wheel spread rate. |

#### Company Religious Pressure

Each Winter (at dusk), if Sacred Wheel followers exceed 25% of the population, the Company’s support standing takes an annual drain: `−round((wheelFraction − 0.25) × 10)`, capped at −5 per year. The drain doubles under `hidden_wheel_recognized` and falls to zero under `orthodox_enforced`. This is the invisible long-term cost of welcoming and integrating Sauromatian women without enforcing the Company’s faith.

#### The Hidden Wheel

Once emerged, the Hidden Wheel is a permanent third tradition. The `rel_hidden_wheel_emerges` event fires as a player-facing choice: the player must decide how to respond, which sets the religious policy going forward. Suppression (`set_hidden_wheel_suppressed` consequence) is possible but temporary — unless policy shifts to `orthodox_enforced`, the counter resumes after the suppression period ends.

#### Priesthood Roles

Three work roles represent religious specialists:
- `priest_solar` — Imanian Orthodox. Male, age ≥ 25, leadership ≥ 30.
- `wheel_singer` — Sacred Wheel. Female preferred, age ≥ 20, custom ≥ 30.
- `voice_of_wheel` — Hidden Wheel. Requires `hiddenWheelEmerged`, custom ≥ 40.

Religious tension generates events throughout. An Imanian zealot demands you ban Sauromatian ceremonies. A Sauromatian elder threatens to leave if you enforce Imanian worship. A wheel-singer begins quietly teaching a syncretic synthesis. Your choices shape which tradition eventually defines the settlement’s spiritual identity.

### 9.3 Settlement Culture

The settlement's overall cultural character is an emergent property calculated from population composition, language distribution, religious practice, governance style, and active cultural practices (warrior training, bathhouse culture, chivalric codes, matriarchal/patriarchal households). This profile shifts over time as demographics change — a slow drift that the player can influence but never fully control.

### 9.4 Cultural Identity Pressure

The settlement's **cultural blend** is a continuous value from 0.0 (fully Imanian Ansberite) to 1.0 (fully Sauromatian native). This number emerges from demographics — who is alive, what culture they identify with, and how the settlement's character has drifted over generations.

The blend is not just a statistic. It has external consequences that operate in the background every season.

**Five zones with distinct effects:**

| Zone | Blend range | Company reaction | Tribal reaction |
|------|------------|-----------------|------------------|
| Extreme Ansberite | < 0.10 | +0.5 standing/season | Tribes grow suspicious |
| Soft Ansberite | 0.10–0.25 | +0.25 standing/season | Mild tribal unease |
| Safe | 0.25–0.65 | No effect | No effect |
| Soft Native | 0.65–0.80 | −0.5 standing/season | Tribes warm to you |
| Extreme Native | > 0.80 | −1.5 standing/season | Tribes embrace you fully |

The Company approves of an Imanian-character outpost; too Sauromatian and it begins to question your loyalty. The tribes respond inversely: a settlement that looks and feels like them is a neighbour; a settlement that feels like a foreign enclave is a threat.

Tribal reactions are weighted by each tribe's behavioural traits. Warlike tribes react more strongly to an Imanian-character settlement (they see opportunity). Isolationist tribes ignore cultural signals almost entirely. Peaceful and trader tribes respond modestly.

When the blend has been outside the safe zone for several consecutive seasons, **pressure counters** accumulate. These counters gate a set of identity events that force the player to respond — a Company inspector arrives, an elder extends a tribal invitation, a Sauromatian settler privately expresses feeling like a stranger in their own home.

The player can see the current blend, zone, and pressure counters at any time in the Religion sidebar via the `IdentityScale` widget. The blend itself cannot be directly set — it can only be influenced by event consequences (`modify_cultural_blend`) that represent significant deliberate acts, like hosting a formal Imanian ceremony or a native celebration.

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

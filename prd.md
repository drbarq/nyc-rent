PRD: NYC Move Explorer — Interactive Neighborhood Decision Map

Version: 1.0 · June 2026 Owner: You Built by: Claude Code Status: Ready to build

1. Problem & Goal

I'm moving from Denver to NYC (possibly for just one year). I work in Midtown, I'm 37 and single, I have a cat, I want a 1-bedroom with no roommates at ~$4,000/month, and I want a "cool/hip" neighborhood. I may bring a motorcycle for weekend rides (not commuting).

I need a single interactive map that lets me:

See every candidate neighborhood on a real map of NYC.
See real, current rental data per neighborhood (median 1BR rent, trend, what $4K gets me).
Understand the commute to Midtown at a glance (lines, minutes, transfers).
Score each neighborhood against MY criteria, with weights I can adjust.
Compare tradeoffs fast enough to shortlist 3 neighborhoods for an apartment-hunting trip.
Success = I can open this app, drag a couple of sliders, and confidently say "these are my 3 neighborhoods" with the data to back it up.

2. User & Criteria (the scoring inputs)

One user (me). Hard and soft criteria:

Criterion Type Detail
Budget Hard-ish $4,000/mo target for a solo 1BR. Score how far median 1BR is above/below $4K.
Commute to Midtown Weighted Office near Midtown (assume Bryant Park / 42nd St as anchor point, make it configurable). Door-to-door transit time, # of transfers, line reliability.
Hip / vibe Weighted Nightlife, restaurants, music venues, walkability, "scene." Subjective — use a curated 1–10 score with a written justification per neighborhood (sources cited).
No roommates Hard Only 1BR (and large studio as a labeled fallback) data matters. Never show room-share pricing.
Cat Hard (trivially passable) Cats are accepted almost everywhere in NYC rentals — show as a checkmark, don't score on it.
Motorcycle (optional) Toggle OFF by default. When ON, factor in street-parking viability + typical garage cost ($150–300/mo).
1-year stint Context Bias toward "experience density" — surface a "No-Regrets Index" (vibe × centrality) since this may be a one-year NYC chapter. Also note: FARE Act (2025) = landlords generally pay broker fees now; flag any data on lease-term flexibility. 3. Neighborhoods in scope (v1)

Seed with these 10 (the researched shortlist), architected so adding more is a data-file change, not a code change:

East Village, Lower East Side, Williamsburg, East Williamsburg, Greenpoint, Bushwick, Astoria, Long Island City, Hell's Kitchen, Upper East Side (Yorkville).

4. Data

4.1 Rental data — live where possible, seeded always

Reality check (important): StreetEasy has no public API and blocks scraping. Do not build a scraper against StreetEasy/Zillow HTML — it will break and may violate ToS. Use this strategy instead:

Primary live source: RentCast API (https://developers.rentcast.io) — free tier ~50 req/mo. Pull rental listings + market stats by zip code, aggregate to neighborhood (zip→neighborhood mapping lives in the data file). Cache responses to local JSON; refresh on demand via a "Refresh data" button, never on every page load.
Optional secondary: Zillow or Realtor via RapidAPI (unofficial; treat as best-effort enrichment, never a hard dependency).
Seed/fallback dataset (ships in repo): the June 2026 researched numbers below. The app must be fully functional offline using only this file. Every number displays its source + as-of date.
Seed data (researched June 2026 — median/avg 1BR asking rents):

Neighborhood 1BR median/avg Source & date Notes
East Village ~$4,295 median RentHop, May 2026 Walkups dominate at $4K; large-bldg avgs run ~$5.6K (Zumper)
Lower East Side ~$5,400 avg (skewed) ExtraSpace/market roundup, Jan 2026 Tenement walkups list high-$3Ks; new towers skew avg
Williamsburg ~$4,850 median RentHop, May 2026 Big buildings avg ~$5,286, +12% YoY (RentCafe, Apr 2026)
East Williamsburg ~$4,350 median RentHop +18% YoY — rising fast
Greenpoint ~$4,675 median RentHop, May 2026 Flat YoY
Bushwick ~$3,195 median RentHop, May 2026 $4K rents above-median here
Astoria ~$3,400 median RentHop, June 2026 Zumper shows ~$2,955 avg
Long Island City ~$4,100–4,400 Verify via RentCast at build time Luxury-heavy inventory
Hell's Kitchen ~$4,900 avg Rent.com, June 2026 Walk-to-work premium
UES (Yorkville) ~$4,000–4,300 Zumper UES median $4,725 all-types, Mar 2026 Value pocket of Manhattan
Citywide context to display in the header: NYC median 1BR crossed $4,000 for the first time in 2026; Manhattan median 1BR ≈ $4,400–4,700 and climbing; inventory at a ~4-year low (move fast on good listings).

4.2 Commute data — precomputed matrix, not a routing engine

Do not integrate a live routing API in v1. Ship a curated commute matrix to the Midtown anchor (42nd/Bryant Park), per neighborhood:

Subway lines serving it (render as authentic MTA line bullets — colored circles with the letter/number)
Door-to-door time range (e.g., "20–30 min")
Transfers (0/1/2)
A one-line honest note (e.g., "L + transfer; L is reliable but packed", "G train only — transfer required, plan +10 min")
Curated v1 values (validate/adjust during build):

Neighborhood Lines Time to Midtown Transfers
East Village 6, L, N/R/W (Union Sq) 15–25 min 0–1
Lower East Side F, J/M/Z 20–30 min 0–1
Williamsburg L, J/M; ferry 25–35 min 1
East Williamsburg L 30–40 min 1
Greenpoint G (→E/M or 7) 30–40 min 1
Bushwick L, J/M/Z 35–45 min 1
Astoria N/W 20–30 min 0
Long Island City 7, E/M, G 10–20 min 0
Hell's Kitchen walk / A/C/E, 1 5–15 min 0
UES (Yorkville) Q, 4/5/6 15–25 min 0
v2 (stretch): isochrone overlay via OpenTripPlanner or Mapbox Isochrone API.

4.3 Vibe data — curated, justified, editable

Each neighborhood gets vibeScore (1–10), vibeBlurb (2–3 sentences, written for a 37-year-old single professional — explicitly note where a scene skews early-20s vs. 30s+), and vibeTags (e.g., nightlife, live-music, food, quiet-evenings, moto-culture). Lives in the same JSON data file.

4.4 Geo data

Neighborhood polygons from NYC Open Data — 2020 NTA boundaries (free GeoJSON, no key required). Map candidate neighborhoods to their NTA codes; simplify geometry (mapshaper or turf) so the bundle stays small. Anchor pin at the Midtown office point.

5. Functional requirements

F1 — Map. Full-bleed MapLibre GL (or Leaflet) map of NYC. Candidate neighborhoods rendered as polygons, fill color = current composite score (continuous scale, with a legend). Non-candidate areas dimmed. Midtown anchor pin always visible.

F2 — Score engine. Composite score per neighborhood = weighted sum of normalized sub-scores: Budget Fit, Commute, Vibe, (+ Moto when toggled). Weights controlled by sliders in a panel; map recolors live as sliders move. Default weights: Vibe 40 / Commute 30 / Budget 30. Budget Fit is signed: under $4K scores up, over scores down, with a visible "stretch zone" ($4.0–4.5K) rather than a cliff.

F3 — Neighborhood detail panel. Click a polygon → side panel with: rent stats (median 1BR, trend arrow, source + as-of date), "What $4K gets you here" one-liner, commute card with MTA line bullets + time + transfers, vibe blurb + tags, cat ✓, moto note (if toggled), and the No-Regrets Index. Include a "View live listings" deep-link (StreetEasy search URL pre-filtered to neighborhood + ≤$4,000 + 1BR — linking out is allowed, scraping is not).

F4 — Compare mode. Pin up to 3 neighborhoods → side-by-side comparison table.

F5 — Data refresh. "Refresh rents" button hits RentCast (through a tiny serverless/Express proxy that holds the API key — never expose the key client-side), updates the cache JSON, re-renders. Shows last-refreshed timestamp. Graceful fallback to seed data with a "showing seeded June 2026 data" badge.

F6 — Moto toggle. Off by default. When on: adds parking viability sub-score + typical garage cost per neighborhood to the panel and the composite score.

F7 — Ranked list. A ranked sidebar list (1→10) mirroring the map colors, updating live with weights. Clicking a row flies the map to that neighborhood.

6. Non-functional requirements

Stack: Vite + React + TypeScript. MapLibre GL JS (free, no token) preferred; Leaflet acceptable. Tiny Node/Express (or Vercel function) proxy only for RentCast. Zero-backend mode must still work (seed data).
All data in typed JSON files (/data/neighborhoods.json, /data/commute.json, /data/rents.seed.json) — adding a neighborhood is a data edit.
Loads fast (<2s on broadband); geometry simplified; no map-tile API keys required (use free OSM/Carto tiles with attribution).
Responsive: desktop-first, usable on a phone (panel becomes bottom sheet).
Every rent figure shows source + date. No fabricated numbers — if a field is unknown, show "—" with a tooltip, never an invented value. 7. Design direction (give it a point of view)

Don't ship a default-looking dashboard. Direction: "MTA service-advisory meets apartment hunt." The visual language of the NYC subway is the design system — it's instantly legible to the user and on-subject.

Palette: near-white paper background, ink-black text, and the actual MTA line colors as the only accents (e.g., L gray #A7A9AC, N/Q/R/W yellow #FCCC0A, 4/5/6 green #00933C, A/C/E blue #0039A6). Score gradient on the map: muted red → warm yellow → deep green, desaturated enough to feel printed, not neon.
Type: Helvetica/Inter-class grotesque for everything (the subway face), tight and confident; tabular numerals for all rent figures. One display weight for neighborhood names, set big.
Signature element: commute rendered as an authentic subway "bullet strip" (colored circles with line letters) on every card and in the comparison table — this is the one flourish; keep everything else quiet.
Copy: plain, specific, sentence case. "Refresh rents," not "Sync data." Honest one-liners over marketing tone ("$4K rents above the median here").
Respect reduced motion; visible keyboard focus; map fly-to is the only animation that matters. 8. Milestones

M1 — Static map + seed data: polygons, scores, detail panel, ranked list. (Fully useful with no API keys.)
M2 — Weights + compare mode + moto toggle.
M3 — Live data: RentCast proxy + cache + refresh button + source badges.
M4 (stretch): isochrones, more neighborhoods, listing deep-link previews. 9. Acceptance criteria

[ ] Opens with zero configuration and shows all 10 neighborhoods scored and colored.
[ ] Dragging any weight slider visibly re-ranks and recolors within 100ms.
[ ] Every neighborhood panel shows rent (with source/date), commute bullets + minutes + transfers, vibe blurb, cat ✓.
[ ] Compare mode handles 3 neighborhoods side by side.
[ ] With a RentCast key in .env, "Refresh rents" updates figures and the timestamp; without a key, the app still works on seed data with a clear badge.
[ ] No API keys in client bundle. No scraping of StreetEasy/Zillow.
[ ] Lighthouse perf ≥ 90 desktop.
PASTE-READY CLAUDE CODE PROMPT

Copy everything below the line into Claude Code, in an empty directory, alongside this PRD file (nyc-move-map-prd.md).

Read nyc-move-map-prd.md in this directory — it is the full PRD. Build the app it describes. Key constraints, restated:

You are building NYC Move Explorer: an interactive map app to help me pick an NYC neighborhood. I'm 37, single, moving from Denver, working near Bryant Park in Midtown, budget $4,000/mo for a solo 1BR (no roommates), I have a cat, I might bring a motorcycle (weekend-only), and this may be a 1-year stint so I'm optimizing for experience.

Build order: Work milestone by milestone (M1→M3 in the PRD). After M1, run it and verify the map renders with all 10 seeded neighborhoods before moving on. Commit at each milestone.

Stack: Vite + React + TypeScript, MapLibre GL JS with free OSM/Carto raster tiles (attribution required, no token), data in typed JSON files under /data. For M3, add a minimal Express proxy (/server) that holds the RentCast API key from .env and exposes /api/rents — never put the key in client code. The app must work fully with no .env using the seed data in the PRD, showing a "seeded June 2026 data" badge.

Geo: Download NYC 2020 NTA boundaries GeoJSON from NYC Open Data, map the 10 neighborhoods to NTA codes, simplify the geometry (target <300KB total), and check the processed file into /data. Write the fetch/simplify step as a repeatable script in /scripts.

Hard rules:

Do not scrape StreetEasy or Zillow. Outbound deep-links to StreetEasy search URLs are fine.
Never fabricate a rent number. Unknown = "—" with a tooltip. Every figure renders its source + as-of date from the data file.
Seed all rent, commute, and vibe data exactly from the PRD tables (sections 4.1–4.3), as editable JSON.
Scoring: weighted composite (default Vibe 40 / Commute 30 / Budget 30), live sliders, signed budget-fit with a $4.0–4.5K "stretch zone," motorcycle toggle off by default per PRD F6.
Design: Follow PRD section 7 exactly — subway-service-advisory aesthetic, MTA line colors as the only accents, grotesque type with tabular numerals, subway bullet strips as the signature element, everything else quiet. Before writing UI code, write a short design-tokens file (colors, type scale, spacing) and a 5-line plan; check it against section 7; then build to it. No generic dashboard look: no gradient hero, no card-grid-with-shadows default.

Definition of done: every checkbox in PRD section 9 passes. Then write a README covering: run instructions, how to add a neighborhood (data-only), how to plug in a RentCast key, and what's stubbed for M4.

Start by reading the PRD, then scaffold the project and begin M1.

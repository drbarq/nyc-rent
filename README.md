# NYC Move Explorer

An interactive decision map for picking an NYC neighborhood: 10 candidates scored
against *your* weights (vibe / commute / budget, plus an optional motorcycle factor),
rendered in an MTA-service-advisory visual language. Built from `prd.md`.

The office anchor is **Cyera HQ, 500 7th Ave at W 37th St** (configurable —
see below). An AI judge panel's advisory top 3 ships in `data/judges.json`.

## Run it

```bash
npm install
npm run dev          # app on http://localhost:5173 — works fully offline on seed data
```

Optional live rents (M3):

```bash
cp .env.example .env # add your RentCast key
npm run server       # proxy on http://localhost:4517
# or both at once:
npm run dev:all
```

No `.env`, no proxy, no problem — the app runs on the seeded June 2026 dataset and
says so with a badge. Every figure displays its source and as-of date.

## How scoring works

Composite = weighted sum of normalized sub-scores (defaults Vibe 40 / Commute 30 /
Budget 30; Motorcycle joins at 15 when toggled). Budget fit is signed: under $4K
scores up, the $4.0–4.5K **stretch zone** declines gently, above $4.5K it falls
steeply — no cliff at $4,000. The No-Regrets Index is vibe × centrality, framing a
possible one-year stint. All math lives in `src/lib/score.ts`.

## Add a neighborhood (data only, no code)

1. `data/neighborhoods.json` — add an entry: id, name, borough, zips (primary
   first — that zip is what RentCast queries), `streetEasyArea` slug, `[lng, lat]`
   center, and its 2020 NTA code(s).
2. Add the same id to `NTA_MAP` in `scripts/fetch-geo.mjs`, then `npm run fetch-geo`
   to regenerate `data/neighborhoods.geojson` (downloads NYC Open Data 2020 NTAs,
   filters, dissolves, simplifies to <300KB).
3. Add matching entries in `data/rents.seed.json`, `data/commute.json`,
   `data/vibe.json`, `data/moto.json`. Unknown rent = `null` (renders "—"), never a
   guess. Every figure needs `source` + `asOf`.
4. Add the id to `ALL_IDS` and the `NeighborhoodId` union in `src/lib/types.ts`
   (the one TypeScript formality).

## Move the office anchor

Edit `anchor` in `data/neighborhoods.json` (label + lng/lat). The commute matrix in
`data/commute.json` is curated per-anchor — revalidate lines/times/notes if you move
it materially.

## RentCast key

Free tier at https://developers.rentcast.io (~50 requests/month). One "Refresh
rents" = 10 requests (one per neighborhood's primary zip), so budget ~5 refreshes a
month. The key lives in `.env`, read only by `server/index.mjs` — it is never
bundled client-side. Responses cache to `data/rents.cache.json`; refresh is
on-demand only, never on page load.

## Destinations, settings, and the lifestyle layers

- **Commute to** (in the weights section) swaps the destination the whole app scores
  against: Office, JFK, LaGuardia, Central Park, or Penn Station. The pin moves, the
  ranked list re-sorts, and every commute card updates. Matrices live in
  `data/pois.json` (the office matrix stays in `data/commute.json`).
- **Settings** (top of the rail) sets your budget target — the scoring curve and
  stretch zone re-anchor on it — and the price cap baked into StreetEasy deep links.
  Persisted in localStorage.
- **Going out** (`data/scene.json`): typical casual-dinner cost grounded in named
  restaurants, the singles scene for a mid-30s professional, and a things-to-do
  density score with named venues.
- **Daily life** (`data/amenities.json`): parks, gyms, groceries, WFH coffee
  (1–10 each, citywide-calibrated, real places named) plus the honest in-unit
  washer/dryer outlook for that housing stock.
- **The brief** (`data/briefs.json`): a 100–150-word orientation per neighborhood
  written for someone who has never set foot in NYC, including what you'll complain
  about after three months.

All of these were curated by web-grounded AI agents with independent fact-check
passes (June 2026); every entry carries sources. They're data files — edit freely.

## The AI judge panel

`data/judges.json` is the output of a 4-judge LLM panel (budget hawk, scene
maximalist, commute pragmatist, one-year optimizer) that ranked the neighborhoods
from this repo's own data files, merged by Borda count. It's labeled *advisory* in
the UI — the sliders are the real ranking. Regenerate it by re-running the panel
with your tool of choice; the shape is `JudgesFile` in `src/lib/types.ts`.

## Stubbed / planned for M4

- **Isochrone overlay** (OpenTripPlanner or a routing API) — commute is a curated
  matrix by design in v1.
- **Listing previews** — currently a StreetEasy deep link, pre-filtered to
  neighborhood + 1BR + ≤$4,000 (linking out is allowed; scraping is not).
- **More neighborhoods** — the data files above are the only blocker.
- **Zillow/Realtor enrichment** via RapidAPI as best-effort secondary rent source.

## Hard rules carried from the PRD

No scraping StreetEasy/Zillow. No fabricated rent numbers — unknowns render "—"
with a tooltip. Cats are fine basically everywhere; it's NYC.

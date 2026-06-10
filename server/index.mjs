// Minimal RentCast proxy (PRD F5/M3). Holds the API key server-side — the key
// never reaches the client bundle. The app works fully without this server,
// falling back to /data/rents.seed.json.
//
// GET  /api/rents   → last cached RentCast figures (404 if never refreshed)
// POST /api/refresh → hits RentCast once per neighborhood (primary zip only),
//                     writes the cache, returns the fresh figures.
//
// RentCast free tier is ~50 requests/month; one refresh = 10 requests, so
// budget roughly 5 refreshes a month.

import express from 'express'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const CACHE_FILE = path.join(ROOT, 'data', 'rents.cache.json')
const REGISTRY_FILE = path.join(ROOT, 'data', 'neighborhoods.json')

// Deliberately NOT the generic PORT — that's often globally exported (e.g. for
// another dev server) and would silently collide.
const PORT = Number(process.env.RENT_PROXY_PORT ?? 4517)
const API_KEY = process.env.RENTCAST_API_KEY

const app = express()

app.get('/api/rents', async (_req, res) => {
  try {
    const cache = JSON.parse(await readFile(CACHE_FILE, 'utf8'))
    res.json(cache)
  } catch {
    res.status(404).json({ error: 'No cached live data yet — use Refresh rents.' })
  }
})

app.post('/api/refresh', async (_req, res) => {
  if (!API_KEY) {
    res.status(503).json({
      error: 'No RentCast key configured — copy .env.example to .env and add one. Showing seeded data.',
    })
    return
  }

  try {
    const registry = JSON.parse(await readFile(REGISTRY_FILE, 'utf8'))
    const figures = {}
    const asOf = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    let authFailures = 0

    for (const hood of registry.neighborhoods) {
      const zip = hood.zips[0]
      const url = `https://api.rentcast.io/v1/markets?zipCode=${zip}&dataType=Rental&historyRange=12`
      const resp = await fetch(url, { headers: { 'X-Api-Key': API_KEY, Accept: 'application/json' } })
      if (!resp.ok) {
        if (resp.status === 401 || resp.status === 403) authFailures++
        console.error(`RentCast ${resp.status} for ${hood.id} (zip ${zip})`)
        continue // partial results are fine — client merges over seed data
      }
      const body = await resp.json()
      const byBeds = body?.rentalData?.dataByBedrooms ?? []
      const oneBr = byBeds.find((b) => b.bedrooms === 1)
      if (!oneBr || oneBr.medianRent == null) continue
      figures[hood.id] = {
        median1br: Math.round(oneBr.medianRent),
        basis: 'median',
        rangeLow: null,
        rangeHigh: null,
        trendYoY: null,
        source: `RentCast (zip ${zip})`,
        asOf,
        note: `Live market median for zip ${zip}, ${oneBr.totalListings ?? '?'} active 1BR listings.`,
        whatFourKGets:
          oneBr.medianRent <= 4000
            ? '$4K is at or above the live median here.'
            : '$4K is below the live median here — expect compromises.',
      }
      // Be gentle with the free tier's rate limit.
      await new Promise((r) => setTimeout(r, 350))
    }

    if (Object.keys(figures).length === 0) {
      res.status(502).json({
        error:
          authFailures > 0
            ? `RentCast rejected the API key (${authFailures}× 401/403) — check RENTCAST_API_KEY. Keeping current data.`
            : 'RentCast returned no usable 1BR figures — keeping current data.',
      })
      return
    }

    const payload = { updatedAt: new Date().toISOString(), figures }
    await writeFile(CACHE_FILE, JSON.stringify(payload, null, 2))
    res.json(payload)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Refresh failed — keeping current data.' })
  }
})

app.listen(PORT, () => {
  console.log(
    `Rent proxy on http://localhost:${PORT} — RentCast key ${API_KEY ? 'loaded' : 'NOT set (refresh will 503; seed data still works)'}`,
  )
})

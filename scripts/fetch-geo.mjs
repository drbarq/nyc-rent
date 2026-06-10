#!/usr/bin/env node
// fetch-geo.mjs — NYC Move Explorer geo pipeline (PRD section 4.4).
//
// Repeatable. Run from repo root:  npm run fetch-geo
//
// What it does:
//   1. Downloads the NYC 2020 Neighborhood Tabulation Area (NTA) boundaries
//      GeoJSON from NYC Open Data (free, no API key). The raw ~4.5MB download
//      is cached in scripts/.tmp/ (gitignored) so re-runs skip the network.
//   2. Filters to the NTAs covering our 10 candidate neighborhoods (NTA_MAP),
//      tags each feature with our canonical neighborhood id + display name,
//      dissolves multi-NTA neighborhoods into one feature each, simplifies
//      the geometry with mapshaper, and writes data/neighborhoods.geojson
//      with feature properties { id, name }.
//   3. Writes data/nta-codes.json: { "<id>": ["<nta code>", ...] }.
//   4. Validates the output (10 features, canonical ids, NYC bounds, <300KB).
//
// Requires Node 22+ (global fetch) and network access to npx mapshaper.

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const TMP_DIR = join(ROOT, 'scripts', '.tmp')
const RAW_PATH = join(TMP_DIR, 'nta2020-raw.geojson')
const DATA_DIR = join(ROOT, 'data')
const OUT_GEOJSON = join(DATA_DIR, 'neighborhoods.geojson')
const OUT_NTA_CODES = join(DATA_DIR, 'nta-codes.json')

// NYC Open Data — "2020 Neighborhood Tabulation Areas (NTAs)" (dataset 9nt8-h7nd).
// Primary: the geospatial export endpoint. Fallback: the Socrata resource API
// for the same dataset, which serves identical features as GeoJSON rows.
const SOURCES = [
  'https://data.cityofnewyork.us/api/geospatial/9nt8-h7nd?method=export&format=GeoJSON',
  'https://data.cityofnewyork.us/resource/9nt8-h7nd.geojson?$limit=500',
]

// ---------------------------------------------------------------------------
// NTA_MAP: canonical neighborhood id -> 2020 NTA codes (field "nta2020" in the
// downloaded file; display name lives in "ntaname"). Every code below was
// verified against the actual 2020 NTA file. Where a neighborhood in common
// usage spans multiple NTAs, all of them are listed and later dissolved into
// a single feature.
// ---------------------------------------------------------------------------
const NTA_MAP = {
  'east-village': ['MN0303'], // MN0303 = East Village
  'lower-east-side': ['MN0302'], // MN0302 = Lower East Side
  // BK0102 = Williamsburg (the core/north-side NTA). South Williamsburg
  // (BK0103) is deliberately excluded — it is a distinct rental market and
  // not what "Williamsburg" means in this app's shortlist.
  williamsburg: ['BK0102'],
  'east-williamsburg': ['BK0104'], // BK0104 = East Williamsburg
  greenpoint: ['BK0101'], // BK0101 = Greenpoint
  bushwick: [
    'BK0401', // BK0401 = Bushwick (West)
    'BK0402', // BK0402 = Bushwick (East)
  ],
  astoria: [
    'QN0103', // QN0103 = Astoria (Central)
    'QN0101', // QN0101 = Astoria (North)-Ditmars-Steinway
    // QN0104 "Astoria (East)-Woodside (North)" deliberately excluded (Woodside-leaning).
  ],
  'long-island-city': ['QN0201'], // QN0201 = Long Island City-Hunters Point
  'hells-kitchen': ['MN0402'], // MN0402 = Hell's Kitchen
  yorkville: ['MN0803'], // MN0803 = Upper East Side-Yorkville
}

// Display names for feature properties (PRD section 3 naming).
const DISPLAY_NAMES = {
  'east-village': 'East Village',
  'lower-east-side': 'Lower East Side',
  williamsburg: 'Williamsburg',
  'east-williamsburg': 'East Williamsburg',
  greenpoint: 'Greenpoint',
  bushwick: 'Bushwick',
  astoria: 'Astoria',
  'long-island-city': 'Long Island City',
  'hells-kitchen': "Hell's Kitchen",
  yorkville: 'Yorkville',
}

const ALL_IDS = Object.keys(NTA_MAP)

// --- Step 1: download (with cache) -----------------------------------------

async function download() {
  if (existsSync(RAW_PATH) && statSync(RAW_PATH).size > 100_000) {
    console.log(`[fetch-geo] using cached raw download: ${RAW_PATH}`)
    return
  }
  mkdirSync(TMP_DIR, { recursive: true })
  let lastErr
  for (const url of SOURCES) {
    try {
      console.log(`[fetch-geo] downloading ${url}`)
      const res = await fetch(url, { redirect: 'follow' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const text = await res.text()
      const parsed = JSON.parse(text) // throws if not JSON
      if (parsed.type !== 'FeatureCollection' || !Array.isArray(parsed.features) || parsed.features.length < 100) {
        throw new Error(`unexpected payload (type=${parsed.type}, features=${parsed.features?.length})`)
      }
      writeFileSync(RAW_PATH, text)
      console.log(`[fetch-geo] cached ${parsed.features.length} NTA features -> ${RAW_PATH}`)
      return
    } catch (err) {
      lastErr = err
      console.warn(`[fetch-geo] source failed (${err.message}); trying next...`)
    }
  }
  throw new Error(`all download sources failed: ${lastErr?.message}`)
}

// --- Step 2: verify NTA_MAP codes exist in the real file --------------------

function verifyCodes() {
  const raw = JSON.parse(readFileSync(RAW_PATH, 'utf8'))
  const byCode = new Map(raw.features.map((f) => [f.properties.nta2020, f.properties.ntaname]))
  for (const [id, codes] of Object.entries(NTA_MAP)) {
    for (const code of codes) {
      if (!byCode.has(code)) {
        throw new Error(`NTA_MAP error: code ${code} (for "${id}") not found in downloaded file`)
      }
      console.log(`[fetch-geo] ${id.padEnd(18)} ${code} = ${byCode.get(code)}`)
    }
  }
}

// --- Step 3: filter / tag / dissolve / simplify via mapshaper ---------------

function buildGeo() {
  mkdirSync(DATA_DIR, { recursive: true })

  // code -> neighborhood id lookup, embedded into the mapshaper -each expression.
  const codeToId = {}
  for (const [id, codes] of Object.entries(NTA_MAP)) {
    for (const code of codes) codeToId[code] = id
  }
  const keepCodes = JSON.stringify(Object.keys(codeToId))
  const lookupJson = JSON.stringify(codeToId)
  const namesJson = JSON.stringify(DISPLAY_NAMES)

  const args = [
    'mapshaper',
    RAW_PATH,
    '-filter', `${keepCodes}.indexOf(nta2020) > -1`,
    '-each', `id = ${lookupJson}[nta2020], name = ${namesJson}[id]`,
    '-dissolve2', 'id', 'copy-fields=name',
    '-simplify', '12%', 'keep-shapes',
    '-clean',
    '-filter-fields', 'id,name',
    '-o', `format=geojson`, `precision=0.0001`, OUT_GEOJSON,
  ]
  console.log('[fetch-geo] running mapshaper...')
  execFileSync('npx', args, { cwd: ROOT, stdio: 'inherit' })
}

// --- Step 4: write nta-codes.json -------------------------------------------

function writeNtaCodes() {
  writeFileSync(OUT_NTA_CODES, JSON.stringify(NTA_MAP, null, 2) + '\n')
  console.log(`[fetch-geo] wrote ${OUT_NTA_CODES}`)
}

// --- Step 5: validate output -------------------------------------------------

function validate() {
  const gj = JSON.parse(readFileSync(OUT_GEOJSON, 'utf8'))
  if (gj.type !== 'FeatureCollection') throw new Error('output is not a FeatureCollection')
  if (gj.features.length !== 10) throw new Error(`expected 10 features, got ${gj.features.length}`)

  const ids = gj.features.map((f) => f.properties.id).sort()
  const expected = [...ALL_IDS].sort()
  if (JSON.stringify(ids) !== JSON.stringify(expected)) {
    throw new Error(`feature ids mismatch:\n got ${ids}\n want ${expected}`)
  }

  // NYC bounds sanity check: lng -74.05..-73.7, lat 40.55..40.92.
  const checkCoords = (coords) => {
    if (typeof coords[0] === 'number') {
      const [lng, lat] = coords
      if (lng < -74.05 || lng > -73.7 || lat < 40.55 || lat > 40.92) {
        throw new Error(`coordinate out of NYC bounds: [${lng}, ${lat}]`)
      }
      return
    }
    for (const c of coords) checkCoords(c)
  }
  for (const f of gj.features) {
    if (!['Polygon', 'MultiPolygon'].includes(f.geometry?.type)) {
      throw new Error(`feature ${f.properties.id} has geometry type ${f.geometry?.type}`)
    }
    if (typeof f.properties.name !== 'string' || !f.properties.name) {
      throw new Error(`feature ${f.properties.id} missing display name`)
    }
    checkCoords(f.geometry.coordinates)
  }

  const kb = statSync(OUT_GEOJSON).size / 1024
  if (kb >= 300) throw new Error(`output too large: ${kb.toFixed(1)}KB (must be <300KB)`)
  console.log(`[fetch-geo] OK: 10 features, all ids canonical, all coords in NYC bounds, ${kb.toFixed(1)}KB`)
}

// --- main --------------------------------------------------------------------

await download()
verifyCodes()
buildGeo()
writeNtaCodes()
validate()
console.log('[fetch-geo] done.')

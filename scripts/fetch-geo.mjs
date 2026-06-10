#!/usr/bin/env node
// fetch-geo.mjs — NYC Move Explorer geo pipeline (PRD section 4.4).
//
// Repeatable. Run from repo root:  npm run fetch-geo
//
// What it does:
//   1. Downloads the NYC 2020 Neighborhood Tabulation Area (NTA) boundaries
//      GeoJSON from NYC Open Data (free, no API key). The raw ~4.5MB download
//      is cached in scripts/.tmp/ (gitignored) so re-runs skip the network.
//   2. Filters to the NTAs covering our 18 candidate neighborhoods (NTA_MAP),
//      tags each feature with our canonical neighborhood id + display name,
//      dissolves multi-NTA neighborhoods into one feature each, simplifies
//      the geometry with mapshaper, and writes data/neighborhoods.geojson
//      with feature properties { id, name }.
//   3. Does the same for the 8 considered-but-excluded areas (RULED_OUT) and
//      writes data/ruledout.geojson — drawn on the map with their reasons
//      (the reasons themselves live in data/ruledout.json).
//   4. Writes data/nta-codes.json: { "<id>": ["<nta code>", ...] }.
//   5. Validates the outputs (18 + 8 features, canonical ids, NYC bounds,
//      combined size <300KB).
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
const OUT_RULEDOUT = join(DATA_DIR, 'ruledout.geojson')
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
  harlem: [
    'MN1001', // MN1001 = Harlem (South)
    'MN1002', // MN1002 = Harlem (North)
  ],
  ridgewood: ['QN0502'], // QN0502 = Ridgewood
  'crown-heights': [
    'BK0802', // BK0802 = Crown Heights (North)
    'BK0901', // BK0901 = Crown Heights (South)
  ],
  'prospect-heights': ['BK0801'], // BK0801 = Prospect Heights
  'fort-greene': [
    'BK0203', // BK0203 = Fort Greene
    'BK0204', // BK0204 = Clinton Hill
  ],
  'bed-stuy': [
    'BK0301', // BK0301 = Bedford-Stuyvesant (West)
    'BK0302', // BK0302 = Bedford-Stuyvesant (East)
  ],
  chelsea: ['MN0401'], // MN0401 = Chelsea-Hudson Yards
  'west-village': ['MN0203'], // MN0203 = West Village
}

// Considered-but-excluded areas (PRD-adjacent: shown dashed on the map with a
// stated reason in data/ruledout.json). Codes verified against the 2020 file.
const RULED_OUT = {
  'park-slope': ['BK0602'], // BK0602 = Park Slope
  'murray-hill': ['MN0603'], // MN0603 = Murray Hill-Kips Bay
  fidi: ['MN0101'], // MN0101 = Financial District-Battery Park City
  'washington-heights': [
    'MN1201', // MN1201 = Washington Heights (South)
    'MN1202', // MN1202 = Washington Heights (North)
  ],
  sunnyside: ['QN0202'], // QN0202 = Sunnyside
  'upper-west-side': [
    'MN0701', // MN0701 = Upper West Side-Lincoln Square
    'MN0702', // MN0702 = Upper West Side (Central)
    'MN0703', // MN0703 = Upper West Side-Manhattan Valley
  ],
  'soho-nolita': ['MN0201'], // MN0201 = SoHo-Little Italy-Hudson Square
  dumbo: ['BK0202'], // BK0202 = Downtown Brooklyn-DUMBO-Boerum Hill
}

const RULED_OUT_NAMES = {
  'park-slope': 'Park Slope',
  'murray-hill': 'Murray Hill & Kips Bay',
  fidi: 'Financial District',
  'washington-heights': 'Washington Heights',
  sunnyside: 'Sunnyside',
  'upper-west-side': 'Upper West Side',
  'soho-nolita': 'SoHo & Nolita',
  dumbo: 'DUMBO & Downtown Brooklyn',
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
  harlem: 'Central Harlem',
  ridgewood: 'Ridgewood',
  'crown-heights': 'Crown Heights',
  'prospect-heights': 'Prospect Heights',
  'fort-greene': 'Fort Greene & Clinton Hill',
  'bed-stuy': 'Bedford-Stuyvesant',
  chelsea: 'Chelsea',
  'west-village': 'West Village',
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
  for (const [id, codes] of [...Object.entries(NTA_MAP), ...Object.entries(RULED_OUT)]) {
    for (const code of codes) {
      if (!byCode.has(code)) {
        throw new Error(`NTA map error: code ${code} (for "${id}") not found in downloaded file`)
      }
      console.log(`[fetch-geo] ${id.padEnd(20)} ${code} = ${byCode.get(code)}`)
    }
  }
}

// --- Step 3: filter / tag / dissolve / simplify via mapshaper ---------------

function buildGeo(map, names, outPath) {
  mkdirSync(DATA_DIR, { recursive: true })

  // code -> id lookup, embedded into the mapshaper -each expression.
  const codeToId = {}
  for (const [id, codes] of Object.entries(map)) {
    for (const code of codes) codeToId[code] = id
  }
  const keepCodes = JSON.stringify(Object.keys(codeToId))
  const lookupJson = JSON.stringify(codeToId)
  const namesJson = JSON.stringify(names)

  const args = [
    'mapshaper',
    RAW_PATH,
    '-filter', `${keepCodes}.indexOf(nta2020) > -1`,
    '-each', `id = ${lookupJson}[nta2020], name = ${namesJson}[id]`,
    '-dissolve2', 'id', 'copy-fields=name',
    '-simplify', '12%', 'keep-shapes',
    '-clean',
    '-filter-fields', 'id,name',
    '-o', `format=geojson`, `precision=0.0001`, outPath,
  ]
  console.log(`[fetch-geo] running mapshaper -> ${outPath}`)
  execFileSync('npx', args, { cwd: ROOT, stdio: 'inherit' })
}

// --- Step 4: write nta-codes.json -------------------------------------------

function writeNtaCodes() {
  writeFileSync(OUT_NTA_CODES, JSON.stringify(NTA_MAP, null, 2) + '\n')
  console.log(`[fetch-geo] wrote ${OUT_NTA_CODES}`)
}

// --- Step 5: validate output -------------------------------------------------

function validate(outPath, expectedIds) {
  const gj = JSON.parse(readFileSync(outPath, 'utf8'))
  if (gj.type !== 'FeatureCollection') throw new Error('output is not a FeatureCollection')
  if (gj.features.length !== expectedIds.length) {
    throw new Error(`expected ${expectedIds.length} features in ${outPath}, got ${gj.features.length}`)
  }

  const ids = gj.features.map((f) => f.properties.id).sort()
  const expected = [...expectedIds].sort()
  if (JSON.stringify(ids) !== JSON.stringify(expected)) {
    throw new Error(`feature ids mismatch in ${outPath}:\n got ${ids}\n want ${expected}`)
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
  console.log(`[fetch-geo] OK: ${outPath} — ${gj.features.length} features, ids canonical, coords in bounds`)
}

// --- main --------------------------------------------------------------------

await download()
verifyCodes()
buildGeo(NTA_MAP, DISPLAY_NAMES, OUT_GEOJSON)
buildGeo(RULED_OUT, RULED_OUT_NAMES, OUT_RULEDOUT)
writeNtaCodes()
validate(OUT_GEOJSON, ALL_IDS)
validate(OUT_RULEDOUT, Object.keys(RULED_OUT))
const totalKb = (statSync(OUT_GEOJSON).size + statSync(OUT_RULEDOUT).size) / 1024
if (totalKb >= 300) throw new Error(`combined geo output too large: ${totalKb.toFixed(1)}KB (must be <300KB)`)
console.log(`[fetch-geo] done. combined geo: ${totalKb.toFixed(1)}KB`)

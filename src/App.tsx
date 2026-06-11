import { useEffect, useMemo, useState } from 'react'
import amenitiesJson from '../data/amenities.json'
import briefsJson from '../data/briefs.json'
import commuteJson from '../data/commute.json'
import judgesJson from '../data/judges.json'
import motoJson from '../data/moto.json'
import registryJson from '../data/neighborhoods.json'
import poisJson from '../data/pois.json'
import ruledOutJson from '../data/ruledout.json'
import sceneJson from '../data/scene.json'
import vibeJson from '../data/vibe.json'
import { CompareTable } from './components/CompareTable'
import { DetailPanel } from './components/DetailPanel'
import { JudgesPicks } from './components/JudgesPicks'
import { MapView, type AnchorSpec, type ChipSpec, type LegendSpec } from './components/MapView'
import { RankedList } from './components/RankedList'
import { RuledOutPanel } from './components/RuledOutPanel'
import { SettingsPanel } from './components/SettingsPanel'
import { WeightSliders } from './components/WeightSliders'
import { money, rentShort } from './lib/format'
import { rentForScore, scoreAll, scoreColor } from './lib/score'
import {
  ALL_IDS,
  DEFAULT_WEIGHTS,
  type AmenitiesFile,
  type BriefsFile,
  type CommuteFile,
  type JudgesFile,
  type MotoFile,
  type NeighborhoodId,
  type NeighborhoodsFile,
  type PoisFile,
  type RuledOutFile,
  type SceneFile,
  type VibeFile,
  type Weights,
} from './lib/types'
import { useRents } from './lib/useRents'
import { useSettings } from './lib/useSettings'

const registry = registryJson as unknown as NeighborhoodsFile
const commute = commuteJson as unknown as CommuteFile
const vibe = vibeJson as unknown as VibeFile
const moto = motoJson as unknown as MotoFile
const judges = judgesJson as unknown as JudgesFile
const amenities = amenitiesJson as unknown as AmenitiesFile
const briefs = briefsJson as unknown as BriefsFile
const scene = sceneJson as unknown as SceneFile
const pois = (poisJson as unknown as PoisFile).pois
const ruledOut = (ruledOutJson as unknown as RuledOutFile).areas

/** "Office — Cyera HQ · 500 7th Ave at 37th" → "Cyera HQ" */
const officeShort = registry.anchor.label.replace(/^Office — /, '').split('·')[0].trim()

const poiOptions = [
  { id: 'office', label: `Office — ${officeShort}` },
  ...pois.map((p) => ({ id: p.id, label: p.label })),
]

export default function App() {
  const [weights, setWeights] = useState<Weights>(DEFAULT_WEIGHTS)
  const [motoOn, setMotoOn] = useState(false)
  const [selectedId, setSelectedId] = useState<NeighborhoodId | null>(null)
  const [ruledOutId, setRuledOutId] = useState<string | null>(null)
  const [pinned, setPinned] = useState<NeighborhoodId[]>([])
  const [compareOpen, setCompareOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [focus, setFocus] = useState<{ id: NeighborhoodId; n: number } | null>(null)
  const [mapMode, setMapMode] = useState<'score' | 'rent'>('score')
  const [trains, setTrains] = useState(false)
  const [poiId, setPoiId] = useState('office')
  const [settings, updateSettings] = useSettings()
  const rents = useRents()

  // The active destination drives the commute matrix, the pin, and the scoring.
  const activePoi = poiId === 'office' ? null : pois.find((p) => p.id === poiId) ?? null
  const activeCommute = activePoi?.commute ?? commute
  const anchorShort = activePoi?.short ?? officeShort
  const anchor: AnchorSpec = activePoi
    ? { label: activePoi.label.toUpperCase(), lng: activePoi.lng, lat: activePoi.lat }
    : {
        label: registry.anchor.label.replace('Office — ', 'OFFICE · '),
        lng: registry.anchor.lng,
        lat: registry.anchor.lat,
      }

  const scores = useMemo(
    () =>
      scoreAll(
        ALL_IDS,
        rents.figures,
        activeCommute,
        vibe,
        moto,
        weights,
        motoOn,
        settings.budgetTarget,
      ),
    [rents.figures, activeCommute, weights, motoOn, settings.budgetTarget],
  )

  // Map fill colors + legend for the active mode (score fit vs raw rent).
  const { mapColors, legend } = useMemo((): {
    mapColors: Record<NeighborhoodId, string>
    legend: LegendSpec
  } => {
    if (mapMode === 'score') {
      return {
        mapColors: Object.fromEntries(
          ALL_IDS.map((id) => [id, scores[id].color]),
        ) as Record<NeighborhoodId, string>,
        legend: { title: 'Fit', left: 'weakest', right: 'best', flip: false },
      }
    }
    const known = ALL_IDS.map((id) => rentForScore(rents.figures[id])).filter(
      (n): n is number => n != null,
    )
    const lo = Math.min(...known)
    const hi = Math.max(...known)
    return {
      mapColors: Object.fromEntries(
        ALL_IDS.map((id) => {
          const r = rentForScore(rents.figures[id])
          const t = r == null ? 0.5 : (r - lo) / (hi - lo)
          return [id, scoreColor(1 - t)] // cheap = green, expensive = red
        }),
      ) as Record<NeighborhoodId, string>,
      legend: { title: '1BR rent', left: money(lo), right: money(hi), flip: true },
    }
  }, [mapMode, scores, rents.figures])

  const chips = useMemo(
    () =>
      Object.fromEntries(
        ALL_IDS.map((id) => [
          id,
          {
            label: rentShort(rents.figures[id]),
            top: scores[id].rank <= 3 ? scores[id].rank : null,
          },
        ]),
      ) as Record<NeighborhoodId, ChipSpec>,
    [scores, rents.figures],
  )

  const selectHood = (id: NeighborhoodId) => {
    setRuledOutId(null)
    setSelectedId(id)
    setFocus((f) => ({ id, n: (f?.n ?? 0) + 1 }))
  }

  const togglePin = (id: NeighborhoodId) => {
    setPinned((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id)
      if (prev.length >= 3) return prev // PRD F4: up to 3
      return [...prev, id]
    })
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (settingsOpen) setSettingsOpen(false)
      else if (compareOpen) setCompareOpen(false)
      else if (ruledOutId) setRuledOutId(null)
      else if (selectedId) setSelectedId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [settingsOpen, compareOpen, ruledOutId, selectedId])

  const selectedHood = selectedId
    ? registry.neighborhoods.find((n) => n.id === selectedId)
    : null

  // The judge panel's verdict on the selected neighborhood — pick rationale or the case against.
  const panelVerdict = useMemo(() => {
    if (!selectedId) return null
    const pick = judges.picks.find((p) => p.id === selectedId)
    if (pick) {
      return { kind: 'pick' as const, rank: pick.rank, headline: pick.headline, rationale: pick.rationale }
    }
    const pass = (judges.passes ?? []).find((p) => p.id === selectedId)
    if (pass) {
      return { kind: 'pass' as const, whyNot: pass.whyNot, wouldFlipIf: pass.wouldFlipIf }
    }
    return null
  }, [selectedId])

  return (
    <div className="app">
      <div className="rail">
        <header className="advisory">
          <button
            type="button"
            className="settings-btn"
            onClick={() => setSettingsOpen(true)}
            aria-label="Open settings"
          >
            Settings
          </button>
          <h1>NYC Move Explorer</h1>
          <div className="sub">
            Neighborhood decision map · anchor: {registry.anchor.label.replace('Office — ', '')}
          </div>
        </header>

        <div className="context-strip">
          {rents.citywideContext}
          <div className="data-row">
            {rents.mode === 'seed' ? (
              <span className="badge seeded">Seeded June 2026 data</span>
            ) : (
              <span className="badge live">Live · RentCast</span>
            )}
            {(import.meta.env.DEV || rents.mode === 'live') && (
              <button
                type="button"
                className="btn"
                onClick={rents.refresh}
                disabled={rents.refreshing}
              >
                {rents.refreshing ? 'Refreshing…' : 'Refresh rents'}
              </button>
            )}
            {rents.lastRefreshed && (
              <span className="num" style={{ fontSize: 'var(--fs-micro)' }}>
                refreshed {new Date(rents.lastRefreshed).toLocaleString()}
              </span>
            )}
          </div>
          {rents.error && <div className="refresh-error">{rents.error}</div>}
        </div>

        <JudgesPicks judges={judges} registry={registry} onSelect={selectHood} />

        <WeightSliders
          weights={weights}
          onChange={setWeights}
          motoOn={motoOn}
          onMotoToggle={setMotoOn}
          poiOptions={poiOptions}
          activePoiId={poiId}
          onPoiChange={setPoiId}
        />

        <RankedList
          registry={registry}
          scores={scores}
          rents={rents.figures}
          commute={activeCommute}
          selectedId={selectedId}
          pinned={pinned}
          onSelect={selectHood}
          onTogglePin={togglePin}
        />
      </div>

      <main className="map-wrap">
        <MapView
          scores={scores}
          colors={mapColors}
          chips={chips}
          legend={legend}
          anchor={anchor}
          trains={trains}
          selectedId={selectedId}
          onSelect={(id) => {
            setSelectedId(id)
            if (id) setRuledOutId(null)
          }}
          onSelectRuledOut={setRuledOutId}
          focus={focus}
          registry={registry}
        />

        <div className="map-toggle" role="group" aria-label="Color the map by">
          <button
            type="button"
            className={mapMode === 'score' ? 'on' : ''}
            onClick={() => setMapMode('score')}
            aria-pressed={mapMode === 'score'}
          >
            Score
          </button>
          <button
            type="button"
            className={mapMode === 'rent' ? 'on' : ''}
            onClick={() => setMapMode('rent')}
            aria-pressed={mapMode === 'rent'}
          >
            Rent
          </button>
        </div>

        <div className="map-toggle trains-toggle">
          <button
            type="button"
            className={trains ? 'on' : ''}
            onClick={() => setTrains((t) => !t)}
            aria-pressed={trains}
          >
            Trains
          </button>
        </div>

        {pinned.length > 0 && !compareOpen && (
          <div className="compare-bar">
            <span>
              Pinned:{' '}
              <strong>
                {pinned
                  .map((id) => registry.neighborhoods.find((n) => n.id === id)?.name)
                  .join(' · ')}
              </strong>
            </span>
            <button
              type="button"
              className="btn primary"
              onClick={() => setCompareOpen(true)}
              disabled={pinned.length < 2}
              title={pinned.length < 2 ? 'Pin at least 2 neighborhoods to compare' : undefined}
            >
              Compare ({pinned.length})
            </button>
            <button type="button" className="btn" onClick={() => setPinned([])}>
              Clear
            </button>
          </div>
        )}

        {selectedHood && selectedId && (
          <DetailPanel
            hood={selectedHood}
            scored={scores[selectedId]}
            rent={rents.figures[selectedId]}
            commute={activeCommute[selectedId]}
            vibe={vibe[selectedId]}
            moto={moto[selectedId]}
            amenities={amenities[selectedId]}
            scene={scene[selectedId]}
            brief={briefs[selectedId]}
            motoOn={motoOn}
            anchorShort={anchorShort}
            settings={settings}
            panelVerdict={panelVerdict}
            onClose={() => setSelectedId(null)}
          />
        )}

        {compareOpen && (
          <CompareTable
            pinned={pinned}
            registry={registry}
            scores={scores}
            rents={rents.figures}
            commute={activeCommute}
            vibe={vibe}
            moto={moto}
            amenities={amenities}
            scene={scene}
            motoOn={motoOn}
            onClose={() => setCompareOpen(false)}
            onUnpin={(id) => {
              togglePin(id)
              if (pinned.length <= 2) setCompareOpen(false)
            }}
          />
        )}

        {ruledOutId && !selectedId && (() => {
          const area = ruledOut.find((a) => a.id === ruledOutId)
          return area ? <RuledOutPanel area={area} onClose={() => setRuledOutId(null)} /> : null
        })()}

        {settingsOpen && (
          <SettingsPanel
            settings={settings}
            onChange={updateSettings}
            onClose={() => setSettingsOpen(false)}
          />
        )}
      </main>
    </div>
  )
}

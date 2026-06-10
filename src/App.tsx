import { useEffect, useMemo, useState } from 'react'
import commuteJson from '../data/commute.json'
import motoJson from '../data/moto.json'
import registryJson from '../data/neighborhoods.json'
import vibeJson from '../data/vibe.json'
import { CompareTable } from './components/CompareTable'
import { DetailPanel } from './components/DetailPanel'
import { MapView } from './components/MapView'
import { RankedList } from './components/RankedList'
import { WeightSliders } from './components/WeightSliders'
import { scoreAll } from './lib/score'
import {
  ALL_IDS,
  DEFAULT_WEIGHTS,
  type CommuteFile,
  type MotoFile,
  type NeighborhoodId,
  type NeighborhoodsFile,
  type VibeFile,
  type Weights,
} from './lib/types'
import { useRents } from './lib/useRents'

const registry = registryJson as unknown as NeighborhoodsFile
const commute = commuteJson as unknown as CommuteFile
const vibe = vibeJson as unknown as VibeFile
const moto = motoJson as unknown as MotoFile

export default function App() {
  const [weights, setWeights] = useState<Weights>(DEFAULT_WEIGHTS)
  const [motoOn, setMotoOn] = useState(false)
  const [selectedId, setSelectedId] = useState<NeighborhoodId | null>(null)
  const [pinned, setPinned] = useState<NeighborhoodId[]>([])
  const [compareOpen, setCompareOpen] = useState(false)
  const [focus, setFocus] = useState<{ id: NeighborhoodId; n: number } | null>(null)
  const rents = useRents()

  const scores = useMemo(
    () => scoreAll(ALL_IDS, rents.figures, commute, vibe, moto, weights, motoOn),
    [rents.figures, weights, motoOn],
  )

  const selectHood = (id: NeighborhoodId) => {
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
      if (compareOpen) setCompareOpen(false)
      else if (selectedId) setSelectedId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [compareOpen, selectedId])

  const selectedHood = selectedId
    ? registry.neighborhoods.find((n) => n.id === selectedId)
    : null

  return (
    <div className="app">
      <div className="rail">
        <header className="advisory">
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
            <button
              type="button"
              className="btn"
              onClick={rents.refresh}
              disabled={rents.refreshing}
            >
              {rents.refreshing ? 'Refreshing…' : 'Refresh rents'}
            </button>
            {rents.lastRefreshed && (
              <span className="num" style={{ fontSize: 'var(--fs-micro)' }}>
                refreshed {new Date(rents.lastRefreshed).toLocaleString()}
              </span>
            )}
          </div>
          {rents.error && <div className="refresh-error">{rents.error}</div>}
        </div>

        <WeightSliders
          weights={weights}
          onChange={setWeights}
          motoOn={motoOn}
          onMotoToggle={setMotoOn}
        />

        <RankedList
          registry={registry}
          scores={scores}
          rents={rents.figures}
          commute={commute}
          selectedId={selectedId}
          pinned={pinned}
          onSelect={selectHood}
          onTogglePin={togglePin}
        />
      </div>

      <main className="map-wrap">
        <MapView
          scores={scores}
          selectedId={selectedId}
          onSelect={(id) => setSelectedId(id)}
          focus={focus}
          registry={registry}
        />

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
            commute={commute[selectedId]}
            vibe={vibe[selectedId]}
            moto={moto[selectedId]}
            motoOn={motoOn}
            onClose={() => setSelectedId(null)}
          />
        )}

        {compareOpen && (
          <CompareTable
            pinned={pinned}
            registry={registry}
            scores={scores}
            rents={rents.figures}
            commute={commute}
            vibe={vibe}
            moto={moto}
            motoOn={motoOn}
            onClose={() => setCompareOpen(false)}
            onUnpin={(id) => {
              togglePin(id)
              if (pinned.length <= 2) setCompareOpen(false)
            }}
          />
        )}
      </main>
    </div>
  )
}

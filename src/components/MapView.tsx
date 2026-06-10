import type { FeatureCollection } from 'geojson'
import maplibregl, { Map as MlMap, MapMouseEvent, StyleSpecification } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef, useState } from 'react'
import hoodsRaw from '../../data/neighborhoods.geojson?raw'
import type { Scored } from '../lib/score'
import type { Neighborhood, NeighborhoodId, NeighborhoodsFile } from '../lib/types'

const hoods = JSON.parse(hoodsRaw) as FeatureCollection

const reducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

const isPhone = () => window.matchMedia('(max-width: 860px)').matches

interface Props {
  scores: Record<NeighborhoodId, Scored>
  selectedId: NeighborhoodId | null
  onSelect: (id: NeighborhoodId | null) => void
  /** Bumping `n` flies the map to neighborhood `id` (set by ranked-list clicks). */
  focus: { id: NeighborhoodId; n: number } | null
  registry: NeighborhoodsFile
}

interface Tip {
  x: number
  y: number
  name: string
  rank: number
  composite: number
}

// Free CARTO "light_all" raster tiles — near-white paper, no token (attribution required).
const STYLE: StyleSpecification = {
  version: 8,
  sources: {
    carto: {
      type: 'raster',
      tiles: ['a', 'b', 'c', 'd'].map(
        (s) => `https://${s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png`,
      ),
      tileSize: 256,
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
    },
    // World-covering polygon used to dim everything that isn't a candidate (PRD F1).
    dimmer: {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [-180, 85],
              [180, 85],
              [180, -85],
              [-180, -85],
              [-180, 85],
            ],
          ],
        },
      },
    },
    hoods: { type: 'geojson', data: hoods, promoteId: 'id' },
  },
  layers: [
    { id: 'basemap', type: 'raster', source: 'carto' },
    {
      id: 'dim',
      type: 'fill',
      source: 'dimmer',
      paint: { 'fill-color': '#fafaf7', 'fill-opacity': 0.45 },
    },
    {
      id: 'hood-fill',
      type: 'fill',
      source: 'hoods',
      paint: {
        'fill-color': ['coalesce', ['feature-state', 'color'], '#b9b9b4'],
        'fill-opacity': [
          'case',
          ['boolean', ['feature-state', 'selected'], false],
          0.8,
          ['boolean', ['feature-state', 'hover'], false],
          0.74,
          0.6,
        ],
      },
    },
    {
      id: 'hood-line',
      type: 'line',
      source: 'hoods',
      paint: {
        'line-color': '#0f0f0f',
        'line-width': [
          'case',
          ['boolean', ['feature-state', 'selected'], false],
          2.5,
          1,
        ],
      },
    },
  ],
}

export function MapView({ scores, selectedId, onSelect, focus, registry }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MlMap | null>(null)
  const hoverIdRef = useRef<NeighborhoodId | null>(null)
  const [ready, setReady] = useState(false)
  const [tip, setTip] = useState<Tip | null>(null)

  // Keep latest scores available to event handlers without rebinding them.
  const scoresRef = useRef(scores)
  scoresRef.current = scores
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  useEffect(() => {
    if (!containerRef.current) return
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE,
      center: [-73.94, 40.73],
      zoom: 10.8,
      minZoom: 9.5,
      maxZoom: 16,
      attributionControl: { compact: true },
      // Keep the buffer so cmd-shift-4 / capture tools can grab the map.
      preserveDrawingBuffer: true,
    })
    mapRef.current = map
    map.on('error', (e) => console.error('[map error]', e.error?.message ?? e))
    if (import.meta.env.DEV) {
      ;(window as unknown as { __map?: MlMap }).__map = map
    }

    map.on('load', () => {
      // Frame all candidates + the Midtown anchor.
      map.fitBounds(
        [
          [-74.03, 40.66],
          [-73.85, 40.805],
        ],
        { padding: 28, duration: 0 },
      )
      setReady(true)
    })

    // Midtown anchor pin — always visible (PRD F1).
    const el = document.createElement('div')
    el.className = 'anchor-pin'
    el.innerHTML = `<span class="dot"></span><span class="tag">${registry.anchor.label.replace('Office — ', 'OFFICE · ')}</span>`
    new maplibregl.Marker({ element: el, anchor: 'top' })
      .setLngLat([registry.anchor.lng, registry.anchor.lat])
      .addTo(map)

    const setHover = (id: NeighborhoodId | null) => {
      if (hoverIdRef.current === id) return
      if (hoverIdRef.current) {
        map.setFeatureState({ source: 'hoods', id: hoverIdRef.current }, { hover: false })
      }
      hoverIdRef.current = id
      if (id) map.setFeatureState({ source: 'hoods', id }, { hover: true })
    }

    map.on('mousemove', 'hood-fill', (e: MapMouseEvent) => {
      const feature = map.queryRenderedFeatures(e.point, { layers: ['hood-fill'] })[0]
      if (!feature) return
      const id = feature.properties?.id as NeighborhoodId
      map.getCanvas().style.cursor = 'pointer'
      setHover(id)
      const s = scoresRef.current[id]
      if (s) {
        setTip({
          x: e.point.x,
          y: e.point.y,
          name: String(feature.properties?.name ?? id),
          rank: s.rank,
          composite: s.composite,
        })
      }
    })

    map.on('mouseleave', 'hood-fill', () => {
      map.getCanvas().style.cursor = ''
      setHover(null)
      setTip(null)
    })

    map.on('click', (e: MapMouseEvent) => {
      const feature = map.queryRenderedFeatures(e.point, { layers: ['hood-fill'] })[0]
      onSelectRef.current(feature ? (feature.properties?.id as NeighborhoodId) : null)
    })

    return () => {
      map.remove()
      mapRef.current = null
    }
    // The map is created exactly once; registry is static data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Recolor polygons whenever scores change — feature-state keeps this under 100ms (PRD F2).
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    for (const [id, s] of Object.entries(scores)) {
      map.setFeatureState({ source: 'hoods', id }, { color: s.color })
    }
  }, [scores, ready])

  // Selection outline.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    for (const f of hoods.features) {
      const id = f.properties?.id as NeighborhoodId
      map.setFeatureState({ source: 'hoods', id }, { selected: id === selectedId })
    }
  }, [selectedId, ready])

  // Fly-to from the ranked list — the only animation that matters (PRD §7).
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || !focus) return
    const hood = registry.neighborhoods.find((n: Neighborhood) => n.id === focus.id)
    if (!hood) return
    const padding = isPhone()
      ? { top: 0, left: 0, right: 0, bottom: Math.round(window.innerHeight * 0.5) }
      : { top: 0, left: 0, right: 400, bottom: 0 }
    if (reducedMotion()) {
      map.jumpTo({ center: hood.center, zoom: 12.4, padding })
    } else {
      map.flyTo({ center: hood.center, zoom: 12.4, padding, duration: 1300, essential: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, ready])

  return (
    <>
      <div ref={containerRef} className="map" role="application" aria-label="Map of candidate NYC neighborhoods, colored by composite score" />
      {tip && (
        <div className="map-tip" style={{ left: tip.x, top: tip.y }} aria-hidden="true">
          {tip.name}{' '}
          <span className="tip-score num">
            #{tip.rank} · {Math.round(tip.composite * 100)}
          </span>
        </div>
      )}
      <div className="legend" aria-hidden="true">
        <div className="title">Fit</div>
        <div className="bar" />
        <div className="ends">
          <span>weakest</span>
          <span>best</span>
        </div>
      </div>
    </>
  )
}

import type { Feature, FeatureCollection } from 'geojson'
import maplibregl, { Map as MlMap, MapMouseEvent, StyleSpecification } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef, useState } from 'react'
import { LINE_COLORS } from '../lib/mta'
import hoodsRaw from '../../data/neighborhoods.geojson?raw'
import ruledRaw from '../../data/ruledout.geojson?raw'
import type { Scored } from '../lib/score'
import type { Neighborhood, NeighborhoodId, NeighborhoodsFile } from '../lib/types'

const hoods = JSON.parse(hoodsRaw) as FeatureCollection
const ruled = JSON.parse(ruledRaw) as FeatureCollection

const reducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

const isPhone = () => window.matchMedia('(max-width: 860px)').matches

export interface LegendSpec {
  title: string
  left: string
  right: string
  /** true = reverse the gradient (rent mode: green is cheap, red is expensive). */
  flip: boolean
}

export interface ChipSpec {
  label: string
  /** 1–3 when this neighborhood is a current top pick, else null. */
  top: number | null
}

export interface AnchorSpec {
  label: string
  lng: number
  lat: number
}

interface Props {
  scores: Record<NeighborhoodId, Scored>
  /** Polygon fill per neighborhood — score or rent coloring, computed upstream. */
  colors: Record<NeighborhoodId, string>
  chips: Record<NeighborhoodId, ChipSpec>
  legend: LegendSpec
  /** The active destination — the pin follows it. */
  anchor: AnchorSpec
  /** Show the subway overlay (routes + stations, lazy-loaded). */
  trains: boolean
  selectedId: NeighborhoodId | null
  onSelect: (id: NeighborhoodId | null) => void
  /** A considered-but-excluded area was clicked. */
  onSelectRuledOut: (id: string | null) => void
  /** Bumping `n` flies the map to neighborhood `id` (set by ranked-list clicks). */
  focus: { id: NeighborhoodId; n: number } | null
  registry: NeighborhoodsFile
}

interface Tip {
  x: number
  y: number
  title: string
  body: string
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
    ruled: { type: 'geojson', data: ruled, promoteId: 'id' },
  },
  layers: [
    { id: 'basemap', type: 'raster', source: 'carto' },
    {
      id: 'dim',
      type: 'fill',
      source: 'dimmer',
      paint: { 'fill-color': '#fafaf7', 'fill-opacity': 0.45 },
    },
    // Considered-but-excluded areas: faint ink wash + dashed border.
    {
      id: 'ruled-fill',
      type: 'fill',
      source: 'ruled',
      paint: { 'fill-color': '#0f0f0f', 'fill-opacity': 0.05 },
    },
    {
      id: 'ruled-line',
      type: 'line',
      source: 'ruled',
      paint: {
        'line-color': '#0f0f0f',
        'line-width': 1,
        'line-opacity': 0.55,
        'line-dasharray': [2, 2],
      },
    },
    {
      id: 'hood-fill',
      type: 'fill',
      source: 'hoods',
      paint: {
        // Fallback is --paper-dim so the pre-score flash stays on palette.
        'fill-color': ['coalesce', ['feature-state', 'color'], '#f1f0ea'],
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

export function MapView({
  scores,
  colors,
  chips,
  legend,
  anchor,
  trains,
  selectedId,
  onSelect,
  onSelectRuledOut,
  focus,
  registry,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MlMap | null>(null)
  const hoverIdRef = useRef<NeighborhoodId | null>(null)
  const chipsRef = useRef(new Map<NeighborhoodId, maplibregl.Marker>())
  const anchorRef = useRef<maplibregl.Marker | null>(null)
  const subwayLoadedRef = useRef(false)
  const [ready, setReady] = useState(false)
  const [tip, setTip] = useState<Tip | null>(null)

  // Keep latest scores available to event handlers without rebinding them.
  const scoresRef = useRef(scores)
  scoresRef.current = scores
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const onSelectRuledRef = useRef(onSelectRuledOut)
  onSelectRuledRef.current = onSelectRuledOut

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
      // Frame all candidates (Harlem to Crown Heights) + the office anchor.
      map.fitBounds(
        [
          [-74.04, 40.645],
          [-73.85, 40.845],
        ],
        { padding: 24, duration: 0 },
      )
      setReady(true)
    })

    // Destination anchor pin — always visible (PRD F1); follows the active POI.
    const el = document.createElement('div')
    el.className = 'anchor-pin'
    el.innerHTML = '<span class="dot"></span><span class="tag"></span>'
    anchorRef.current = new maplibregl.Marker({ element: el, anchor: 'top' })
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
          title: String(feature.properties?.name ?? id),
          body: `#${s.rank} · ${Math.round(s.composite * 100)}`,
        })
      }
    })

    map.on('mouseleave', 'hood-fill', () => {
      map.getCanvas().style.cursor = ''
      setHover(null)
      setTip(null)
    })

    // Ruled-out areas: hover names them, click explains them.
    map.on('mousemove', 'ruled-fill', (e: MapMouseEvent) => {
      if (map.queryRenderedFeatures(e.point, { layers: ['hood-fill'] })[0]) return
      const feature = map.queryRenderedFeatures(e.point, { layers: ['ruled-fill'] })[0]
      if (!feature) return
      map.getCanvas().style.cursor = 'pointer'
      setTip({
        x: e.point.x,
        y: e.point.y,
        title: String(feature.properties?.name ?? ''),
        body: 'passed — click for why',
      })
    })

    map.on('mouseleave', 'ruled-fill', () => {
      map.getCanvas().style.cursor = ''
      setTip(null)
    })

    map.on('click', (e: MapMouseEvent) => {
      const hood = map.queryRenderedFeatures(e.point, { layers: ['hood-fill'] })[0]
      if (hood) {
        onSelectRuledRef.current(null)
        onSelectRef.current(hood.properties?.id as NeighborhoodId)
        return
      }
      const out = map.queryRenderedFeatures(e.point, { layers: ['ruled-fill'] })[0]
      if (out) {
        onSelectRef.current(null)
        onSelectRuledRef.current(String(out.properties?.id))
        return
      }
      onSelectRef.current(null)
      onSelectRuledRef.current(null)
    })

    return () => {
      map.remove()
      mapRef.current = null
      chipsRef.current.clear() // markers died with the map (StrictMode remounts)
      anchorRef.current = null
      subwayLoadedRef.current = false
      setReady(false)
    }
    // The map is created exactly once; registry is static data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep the destination pin on the active POI.
  useEffect(() => {
    const marker = anchorRef.current
    if (!marker) return
    marker.setLngLat([anchor.lng, anchor.lat])
    const tag = marker.getElement().querySelector('.tag')
    if (tag) tag.textContent = anchor.label
  }, [anchor, ready])

  // Subway overlay: lazy-load on first toggle, then flip layer visibility.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const setVisibility = (visible: boolean) => {
      for (const id of ['subway-lines', 'subway-stations']) {
        if (map.getLayer(id)) {
          map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none')
        }
      }
    }
    if (!trains || subwayLoadedRef.current) {
      setVisibility(trains)
      return
    }
    subwayLoadedRef.current = true
    Promise.all([
      fetch('/subway-lines.geojson').then((r) => r.json()),
      fetch('/subway-stations.geojson').then((r) => r.json()),
    ])
      .then(([lines, stations]: [FeatureCollection, FeatureCollection]) => {
        if (mapRef.current !== map || map.getSource('subway-lines')) return
        map.addSource('subway-lines', { type: 'geojson', data: lines })
        map.addSource('subway-stations', { type: 'geojson', data: stations })
        // Official MTA route colors, keyed on the dataset's "service" property.
        const colorMatch = [
          'match',
          ['get', 'service'],
          ...Object.entries(LINE_COLORS).flatMap(([line, color]) => [line, color]),
          '#808183', // shuttles and anything unmapped
        ] as unknown as maplibregl.ExpressionSpecification
        map.addLayer(
          {
            id: 'subway-lines',
            type: 'line',
            source: 'subway-lines',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: {
              'line-color': colorMatch,
              'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1, 13, 2.5],
              'line-opacity': 0.85,
            },
          },
          'hood-line',
        )
        map.addLayer(
          {
            id: 'subway-stations',
            type: 'circle',
            source: 'subway-stations',
            minzoom: 11,
            paint: {
              'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 1.4, 14, 4],
              'circle-color': '#ffffff',
              'circle-stroke-color': '#0f0f0f',
              'circle-stroke-width': 1,
            },
          },
          'hood-line',
        )
        map.on('mousemove', 'subway-stations', (e: MapMouseEvent & { features?: Feature[] }) => {
          const f = e.features?.[0]
          if (!f) return
          setTip({
            x: e.point.x,
            y: e.point.y,
            title: String(f.properties?.name ?? ''),
            body: String(f.properties?.line ?? ''),
          })
        })
        map.on('mouseleave', 'subway-stations', () => setTip(null))
      })
      .catch((err) => {
        subwayLoadedRef.current = false
        console.error('[subway] overlay failed to load', err)
      })
  }, [trains, ready])

  // Recolor polygons whenever colors change — feature-state keeps this under 100ms (PRD F2).
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    for (const [id, color] of Object.entries(colors)) {
      map.setFeatureState({ source: 'hoods', id }, { color })
    }
  }, [colors, ready])

  // Rent chips + top-pick badges as DOM markers (no glyph server needed).
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    for (const hood of registry.neighborhoods) {
      let marker = chipsRef.current.get(hood.id)
      if (!marker) {
        const el = document.createElement('button')
        el.type = 'button'
        el.className = 'map-chip'
        el.addEventListener('click', (e) => {
          e.stopPropagation()
          onSelectRef.current(hood.id)
        })
        marker = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat(hood.center)
          .addTo(map)
        chipsRef.current.set(hood.id, marker)
      }
      const chip = chips[hood.id]
      const el = marker.getElement()
      el.classList.toggle('top', chip.top != null)
      el.innerHTML = chip.top != null ? `<b>${chip.top}</b>${chip.label}` : chip.label
      el.setAttribute('aria-label', `${hood.name}: ${chip.label}${chip.top ? `, current pick #${chip.top}` : ''}`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chips, ready])

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
          {tip.title} <span className="tip-score num">{tip.body}</span>
        </div>
      )}
      <div className="legend" aria-hidden="true">
        <div className="title">{legend.title}</div>
        <div className={legend.flip ? 'bar flip' : 'bar'} />
        <div className="ends">
          <span>{legend.left}</span>
          <span>{legend.right}</span>
        </div>
      </div>
    </>
  )
}

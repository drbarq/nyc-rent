import { useCallback, useEffect, useState } from 'react'
import seedJson from '../../data/rents.seed.json'
import type { NeighborhoodId, RentFigure, RentsFile } from './types'

const seed = seedJson as unknown as RentsFile

export interface RentsState {
  figures: Record<NeighborhoodId, RentFigure>
  citywideContext: string
  /** 'seed' = shipped June 2026 data; 'live' = RentCast via the proxy. */
  mode: 'seed' | 'live'
  /** True when the rent proxy answered the mount probe — even with an empty cache. */
  proxyUp: boolean
  lastRefreshed: string | null
  refreshing: boolean
  error: string | null
  refresh: () => void
}

interface LivePayload {
  updatedAt: string
  figures: Partial<Record<NeighborhoodId, RentFigure>>
}

/** Live figures only override seed entries they actually contain — never lose sourced data. */
function mergeLive(payload: LivePayload): Record<NeighborhoodId, RentFigure> {
  return { ...seed.figures, ...payload.figures } as Record<NeighborhoodId, RentFigure>
}

const PROXY_DOWN_MSG = import.meta.env.DEV
  ? 'Rent proxy not running — start it with `npm run server`. Showing current data.'
  : 'Live rent service is offline — showing the most recent data.'

export function useRents(): RentsState {
  const [figures, setFigures] = useState(seed.figures)
  const [mode, setMode] = useState<'seed' | 'live'>('seed')
  const [proxyUp, setProxyUp] = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // On mount, quietly pick up the proxy's *cached* data if the server is running.
  // Never hits RentCast itself — refresh is on-demand only (PRD F5).
  useEffect(() => {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 2500)
    fetch('/api/rents', { signal: ctrl.signal })
      .then((res) => {
        // A JSON answer — even the cold-cache 404 — means the proxy is up and
        // a refresh can succeed. Static hosts 404 with an HTML page instead.
        if (res.headers.get('content-type')?.includes('application/json')) setProxyUp(true)
        return res.ok ? res.json() : null
      })
      .then((payload: LivePayload | null) => {
        if (payload?.figures && payload.updatedAt) {
          setFigures(mergeLive(payload))
          setMode('live')
          setLastRefreshed(payload.updatedAt)
        }
      })
      .catch(() => {
        /* no proxy running — seed data is the offline mode, not an error */
      })
      .finally(() => clearTimeout(t))
    return () => ctrl.abort()
  }, [])

  const refresh = useCallback(() => {
    setRefreshing(true)
    setError(null)
    fetch('/api/refresh', { method: 'POST' })
      .then(async (res) => {
        const body = await res.json().catch(() => null)
        if (!res.ok) {
          // A non-JSON error body means nothing answered behind Vite's proxy.
          throw new Error(body?.error ?? PROXY_DOWN_MSG)
        }
        return body as LivePayload
      })
      .then((payload) => {
        setFigures(mergeLive(payload))
        setMode('live')
        setProxyUp(true)
        setLastRefreshed(payload.updatedAt)
      })
      .catch((err: Error) => {
        setError(err.name === 'TypeError' ? PROXY_DOWN_MSG : err.message)
      })
      .finally(() => setRefreshing(false))
  }, [])

  return {
    figures,
    citywideContext: seed.citywideContext,
    mode,
    proxyUp,
    lastRefreshed,
    refreshing,
    error,
    refresh,
  }
}

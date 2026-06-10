import {
  BUDGET_TARGET,
  STRETCH_ZONE_MAX,
  type CommuteInfo,
  type MotoInfo,
  type NeighborhoodId,
  type RentFigure,
  type VibeInfo,
  type Weights,
} from './types'

export interface Scored {
  id: NeighborhoodId
  /** Sub-scores normalized 0..1. */
  budget: number
  commute: number
  vibe: number
  moto: number
  composite: number
  /** No-Regrets Index, 0..10: vibe × centrality (centrality ≈ commute score). */
  nri: number
  /** Composite min-max normalized across the current set, 0..1 — drives the map color. */
  relative: number
  color: string
  /** Readable text color (ink/white) for use on top of `color`. */
  textColor: string
  rank: number
  rentUsedForScore: number | null
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

/** The number scoring uses: median if known, midpoint of a sourced range otherwise. */
export function rentForScore(f: RentFigure): number | null {
  if (f.median1br != null) return f.median1br
  if (f.rangeLow != null && f.rangeHigh != null) return (f.rangeLow + f.rangeHigh) / 2
  return null
}

/**
 * Signed budget fit, normalized 0..1, anchored on a configurable target.
 * Under target scores up; the target→target+$500 "stretch zone" declines gently;
 * past that it falls off steeply (no cliff at the target itself).
 */
export function budgetScore(rent: number | null, target: number = BUDGET_TARGET): number {
  if (rent == null) return 0.5 // unknown: neutral, never invented
  const stretchMax = target + (STRETCH_ZONE_MAX - BUDGET_TARGET)
  if (rent <= target - 800) return 1
  if (rent <= target) return 1 - ((rent - (target - 800)) / 800) * 0.35 // 1.00 → 0.65
  if (rent <= stretchMax) return 0.65 - ((rent - target) / 500) * 0.2 // 0.65 → 0.45
  return clamp01(0.45 - ((rent - stretchMax) / 1100) * 0.45) // 0.45 → 0 at target+$1.6K
}

/** Door-to-door midpoint mapped so ~10 min ≈ 1.0 and ~45 min ≈ 0, minus a transfer penalty. */
export function commuteScore(c: CommuteInfo): number {
  const mid = (c.timeMin + c.timeMax) / 2
  const transfers = (c.transfersMin + c.transfersMax) / 2
  return clamp01(1 - (mid - 10) / 35 - transfers * 0.06)
}

export function vibeScore(v: VibeInfo): number {
  return clamp01(v.score / 10)
}

/** Street-parking viability (70%) blended with garage cost within the $150–300 band (30%). */
export function motoScore(m: MotoInfo): number {
  const viability = m.parkingViability / 10
  const garageMid =
    m.garageLow != null && m.garageHigh != null ? (m.garageLow + m.garageHigh) / 2 : 225
  const cost = clamp01(1 - (garageMid - 150) / 150)
  return clamp01(0.7 * viability + 0.3 * cost)
}

export function compositeScore(
  subs: { budget: number; commute: number; vibe: number; moto: number },
  weights: Weights,
  motoOn: boolean,
): number {
  const parts: Array<[number, number]> = [
    [weights.vibe, subs.vibe],
    [weights.commute, subs.commute],
    [weights.budget, subs.budget],
  ]
  if (motoOn) parts.push([weights.moto, subs.moto])
  const total = parts.reduce((s, [w]) => s + w, 0)
  if (total === 0) return 0
  return parts.reduce((s, [w, v]) => s + w * v, 0) / total
}

/* ---------- score color: muted red → warm yellow → deep green ---------- */

const STOPS: Array<[number, number, number]> = [
  [0xb5, 0x48, 0x3a],
  [0xd9, 0xa4, 0x41],
  [0x2e, 0x6b, 0x4f],
]

function stopAt(t: number): [number, number, number] {
  const x = clamp01(t) * 2
  const i = x < 1 ? 0 : 1
  const f = x - i
  const [a, b] = [STOPS[i], STOPS[i + 1]]
  return [0, 1, 2].map((k) => Math.round(a[k] + (b[k] - a[k]) * f)) as [number, number, number]
}

export function scoreColor(t: number): string {
  const [r, g, b] = stopAt(t)
  return `rgb(${r}, ${g}, ${b})`
}

/**
 * Ink or white, whichever is readable on scoreColor(t) — the warm-yellow middle
 * of the gradient fails WCAG with white text (same idea as lineTextColor in mta.ts).
 */
export function scoreTextColor(t: number): string {
  const [r, g, b] = stopAt(t)
  const lum = [r, g, b]
    .map((v) => {
      const c = v / 255
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    })
    .reduce((acc, v, i) => acc + v * [0.2126, 0.7152, 0.0722][i], 0)
  return lum > 0.3 ? '#0f0f0f' : '#ffffff'
}

/* ---------- assemble ---------- */

export function scoreAll(
  ids: NeighborhoodId[],
  rents: Record<NeighborhoodId, RentFigure>,
  commute: Record<NeighborhoodId, CommuteInfo>,
  vibe: Record<NeighborhoodId, VibeInfo>,
  moto: Record<NeighborhoodId, MotoInfo>,
  weights: Weights,
  motoOn: boolean,
  budgetTarget: number = BUDGET_TARGET,
): Record<NeighborhoodId, Scored> {
  const rows = ids.map((id) => {
    const rent = rentForScore(rents[id])
    const subs = {
      budget: budgetScore(rent, budgetTarget),
      commute: commuteScore(commute[id]),
      vibe: vibeScore(vibe[id]),
      moto: motoScore(moto[id]),
    }
    const composite = compositeScore(subs, weights, motoOn)
    // Centrality for the No-Regrets Index uses a gentler curve than the commute
    // score — a 40-minute ride shouldn't zero out a great neighborhood's NRI.
    const mid = (commute[id].timeMin + commute[id].timeMax) / 2
    const centrality = Math.min(1, Math.max(0, 1 - (mid - 12) / 45))
    return {
      id,
      ...subs,
      composite,
      nri: Math.round(subs.vibe * centrality * 100) / 10,
      relative: 0,
      color: '',
      textColor: '#ffffff',
      rank: 0,
      rentUsedForScore: rent,
    }
  })

  // Min-max normalize composites for the color scale (pad tiny spreads so the
  // gradient never collapses to a single hue).
  let lo = Math.min(...rows.map((r) => r.composite))
  let hi = Math.max(...rows.map((r) => r.composite))
  if (hi - lo < 0.15) {
    const mid = (hi + lo) / 2
    lo = mid - 0.075
    hi = mid + 0.075
  }
  for (const r of rows) {
    r.relative = clamp01((r.composite - lo) / (hi - lo))
    r.color = scoreColor(r.relative)
    r.textColor = scoreTextColor(r.relative)
  }

  const sorted = [...rows].sort((a, b) => b.composite - a.composite)
  sorted.forEach((r, i) => {
    r.rank = i + 1
  })

  return Object.fromEntries(rows.map((r) => [r.id, r])) as Record<NeighborhoodId, Scored>
}

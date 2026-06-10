import type { RentFigure } from './types'

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

export function money(n: number): string {
  return usd.format(n)
}

/** Display string for a rent figure. Never invents a number: range basis shows the range. */
export function rentDisplay(f: RentFigure): string {
  if (f.basis === 'range' && f.rangeLow != null && f.rangeHigh != null) {
    return `${money(f.rangeLow)}–${usd.format(f.rangeHigh).replace('$', '')}`
  }
  if (f.median1br != null) return money(f.median1br)
  return '—'
}

export function basisLabel(f: RentFigure): string {
  if (f.basis === 'range') return 'est. range, 1BR'
  return f.basis === 'average' ? 'average 1BR' : 'median 1BR'
}

const k = (n: number) => (n / 1000).toFixed(1).replace(/\.0$/, '')

/** Compact figure for map chips: "$4.3K", "$4.1–4.4K", or "—". */
export function rentShort(f: RentFigure): string {
  if (f.basis === 'range' && f.rangeLow != null && f.rangeHigh != null) {
    return `$${k(f.rangeLow)}–${k(f.rangeHigh)}K`
  }
  if (f.median1br != null) return `$${k(f.median1br)}K`
  return '—'
}

export function trendDisplay(trendYoY: number | null): { arrow: string; text: string } | null {
  if (trendYoY == null) return null
  if (trendYoY === 0) return { arrow: '→', text: 'flat YoY' }
  const sign = trendYoY > 0 ? '+' : '−'
  return { arrow: trendYoY > 0 ? '↑' : '↓', text: `${sign}${Math.abs(trendYoY)}% YoY` }
}

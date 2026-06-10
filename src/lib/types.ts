// Shared type contracts for NYC Move Explorer.
// All /data/*.json files must conform to these shapes — adding a neighborhood
// is a data edit (plus a geo re-fetch), never a code change.

export type NeighborhoodId =
  | 'east-village'
  | 'lower-east-side'
  | 'williamsburg'
  | 'east-williamsburg'
  | 'greenpoint'
  | 'bushwick'
  | 'astoria'
  | 'long-island-city'
  | 'hells-kitchen'
  | 'yorkville'

export interface Neighborhood {
  id: NeighborhoodId
  name: string
  borough: 'Manhattan' | 'Brooklyn' | 'Queens'
  /** ZIP codes, primary first — the primary zip is what the RentCast proxy queries. */
  zips: string[]
  /** 2020 NTA codes covering this neighborhood (one neighborhood may span several NTAs). */
  ntaCodes: string[]
  /** Slug for the StreetEasy deep link: streeteasy.com/for-rent/<slug>/... */
  streetEasyArea: string
  /** [lng, lat] used for map fly-to. */
  center: [number, number]
}

export interface NeighborhoodsFile {
  /** Office anchor (configurable): defaults to Cyera HQ, 500 7th Ave at 37th St. */
  anchor: { label: string; lng: number; lat: number }
  neighborhoods: Neighborhood[]
}

export interface RentFigure {
  /** Dollars/month. null = unknown → render "—" with a tooltip, never invent. */
  median1br: number | null
  basis: 'median' | 'average' | 'range'
  rangeLow: number | null
  rangeHigh: number | null
  /** Percent year-over-year, e.g. 12 means +12%. null if unknown. */
  trendYoY: number | null
  source: string
  asOf: string
  note: string
  /** "What $4K gets you here" one-liner. */
  whatFourKGets: string
}

export interface RentsFile {
  citywideContext: string
  seededAsOf: string
  figures: Record<NeighborhoodId, RentFigure>
}

export interface CommuteInfo {
  /** MTA line designations in bullet-strip order, e.g. ["L", "J", "M", "Z"]. */
  lines: string[]
  ferry: boolean
  timeMin: number
  timeMax: number
  transfersMin: number
  transfersMax: number
  /** One honest line, e.g. "L + transfer; L is reliable but packed." */
  note: string
}

export type CommuteFile = Record<NeighborhoodId, CommuteInfo>

export interface VibeInfo {
  /** 1–10 curated score. */
  score: number
  /** 2–3 sentences written for a 37-year-old single professional; notes where a scene skews early-20s vs 30s+. */
  blurb: string
  tags: string[]
  sources: string[]
}

export type VibeFile = Record<NeighborhoodId, VibeInfo>

export interface MotoInfo {
  /** 1–10 street-parking viability for a motorcycle. */
  parkingViability: number
  /** Typical monthly garage cost range in dollars; null = unknown. */
  garageLow: number | null
  garageHigh: number | null
  note: string
}

export type MotoFile = Record<NeighborhoodId, MotoInfo>

export interface JudgePick {
  id: NeighborhoodId
  rank: 1 | 2 | 3
  headline: string
  rationale: string
}

export interface JudgeVoice {
  lens: string
  label: string
  top3: NeighborhoodId[]
  oneLiner: string
}

/** Output of the AI judge panel — advisory, clearly labeled, regenerable. */
export interface JudgesFile {
  generatedAt: string
  method: string
  picks: JudgePick[]
  judges: JudgeVoice[]
  dissent: string
}

export interface Weights {
  vibe: number
  commute: number
  budget: number
  moto: number
}

export const DEFAULT_WEIGHTS: Weights = { vibe: 40, commute: 30, budget: 30, moto: 15 }

export const BUDGET_TARGET = 4000
export const STRETCH_ZONE_MAX = 4500

export const ALL_IDS: NeighborhoodId[] = [
  'east-village',
  'lower-east-side',
  'williamsburg',
  'east-williamsburg',
  'greenpoint',
  'bushwick',
  'astoria',
  'long-island-city',
  'hells-kitchen',
  'yorkville',
]

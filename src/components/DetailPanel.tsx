import { basisLabel, money, rentDisplay, trendDisplay } from '../lib/format'
import type { Scored } from '../lib/score'
import type {
  CommuteInfo,
  MotoInfo,
  Neighborhood,
  RentFigure,
  VibeInfo,
} from '../lib/types'
import { BulletStrip } from './BulletStrip'

interface Props {
  hood: Neighborhood
  scored: Scored
  rent: RentFigure
  commute: CommuteInfo
  vibe: VibeInfo
  moto: MotoInfo
  motoOn: boolean
  onClose: () => void
}

const SCALE_LO = 3000
const SCALE_HI = 5600
const pct = (n: number) =>
  `${Math.min(100, Math.max(0, ((n - SCALE_LO) / (SCALE_HI - SCALE_LO)) * 100))}%`

export function DetailPanel({ hood, scored, rent, commute, vibe, moto, motoOn, onClose }: Props) {
  const trend = trendDisplay(rent.trendYoY)
  const listingsUrl = `https://streeteasy.com/for-rent/${hood.streetEasyArea}/price:-4000%7Cbeds:1`

  return (
    <aside className="detail" role="region" aria-label={`${hood.name} details`}>
      <header className="detail-head">
        <button type="button" className="close-btn" onClick={onClose} aria-label="Close panel">
          ✕
        </button>
        <div className="borough">{hood.borough}</div>
        <h2>{hood.name}</h2>
        <div className="score-line">
          <span className="score-disc num" style={{ background: scored.color }}>
            {Math.round(scored.composite * 100)}
          </span>
          <span>
            Ranked <strong className="num">#{scored.rank}</strong> of 10 by your weights
            <br />
            No-Regrets Index <strong className="num">{scored.nri.toFixed(1)}</strong>/10
            <span title="Vibe × centrality — how much NYC you get per month if this stays a one-year chapter."> ⓘ</span>
          </span>
        </div>
      </header>

      <section className="detail-section" aria-label="Rent">
        <h3>Rent — 1BR only, no roommates</h3>
        <div className="rent-figure">
          {rentDisplay(rent) === '—' ? (
            <span
              className="amount num unknown"
              title="No verified figure for this cut — we never invent numbers."
            >
              —
            </span>
          ) : (
            <span className="amount num">{rentDisplay(rent)}</span>
          )}
          <span className="basis">{basisLabel(rent)}</span>
          {trend && (
            <span className="trend num" title="Asking-rent trend, year over year">
              {trend.arrow} {trend.text}
            </span>
          )}
        </div>
        <div className="source-line">
          {rent.source} · as of {rent.asOf}
        </div>
        {rent.note && <p className="note">{rent.note}</p>}
        <p className="fourk">
          <strong>What $4K gets you:</strong> {rent.whatFourKGets}
        </p>
        <div className="budget-scale" aria-label="Where this rent sits against your $4,000 budget">
          <div className="track">
            <span className="stretch" style={{ left: pct(4000), width: `calc(${pct(4500)} - ${pct(4000)})` }} />
            {scored.rentUsedForScore != null && (
              <span className="marker" style={{ left: pct(scored.rentUsedForScore) }} />
            )}
          </div>
          <div className="labels num">
            <span>{money(SCALE_LO)}</span>
            <span>$4K → $4.5K stretch zone</span>
            <span>{money(SCALE_HI)}</span>
          </div>
        </div>
      </section>

      <section className="detail-section" aria-label="Commute">
        <h3>Commute to {hood.id === 'hells-kitchen' ? 'the office' : 'Bryant Park'}</h3>
        <div className="commute-line">
          <BulletStrip lines={commute.lines} ferry={commute.ferry} />
          <span className="commute-stat num">
            {commute.timeMin}–{commute.timeMax} min
          </span>
          <span className="num">
            {commute.transfersMin === commute.transfersMax
              ? `${commute.transfersMin}`
              : `${commute.transfersMin}–${commute.transfersMax}`}{' '}
            {commute.transfersMax === 1 && commute.transfersMin !== 0 ? 'transfer' : 'transfers'}
          </span>
        </div>
        <p className="note">{commute.note}</p>
      </section>

      <section className="detail-section" aria-label="Vibe">
        <h3>
          Vibe — <span className="vibe-score num">{vibe.score}/10</span>
        </h3>
        <p style={{ margin: 0 }}>{vibe.blurb}</p>
        <div className="tags">
          {vibe.tags.map((t) => (
            <span className="tag" key={t}>
              {t}
            </span>
          ))}
        </div>
        {vibe.sources.length > 0 && (
          <p className="vibe-sources">Sources: {vibe.sources.join(' · ')}</p>
        )}
      </section>

      <section className="detail-section" aria-label="Practicalities">
        <h3>Practicalities</h3>
        <div className="fact-row">
          <span className="k">Cat</span>
          <span className="v">Cats OK ✓ — near-universal in NYC rentals</span>
        </div>
        {motoOn && (
          <>
            <div className="fact-row">
              <span className="k">Moto street parking</span>
              <span className="v num">{moto.parkingViability}/10</span>
            </div>
            <div className="fact-row">
              <span className="k">Garage, typical</span>
              <span className="v num">
                {moto.garageLow != null && moto.garageHigh != null ? (
                  `${money(moto.garageLow)}–${money(moto.garageHigh)}/mo`
                ) : (
                  <span className="unknown" title="No reliable garage figure for this neighborhood.">
                    —
                  </span>
                )}
              </span>
            </div>
            <p className="note">{moto.note}</p>
          </>
        )}
        <a
          className="listings-link"
          href={listingsUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          View live listings on StreetEasy — 1BR under $4,000 ↗
        </a>
      </section>

      <p className="fare-note">
        FARE Act (2025): landlords generally pay broker fees now. Lease-term flexibility varies by
        building — ask about 12-month terms when touring.
      </p>
    </aside>
  )
}

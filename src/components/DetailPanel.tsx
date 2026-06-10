import { basisLabel, money, rentDisplay, trendDisplay } from '../lib/format'
import type { Scored } from '../lib/score'
import type {
  AmenityInfo,
  AppSettings,
  Brief,
  CommuteInfo,
  MotoInfo,
  Neighborhood,
  RentFigure,
  SceneInfo,
  VibeInfo,
} from '../lib/types'
import { BulletStrip } from './BulletStrip'

export type PanelVerdict =
  | { kind: 'pick'; rank: number; headline: string; rationale: string }
  | { kind: 'pass'; whyNot: string; wouldFlipIf: string }

interface Props {
  hood: Neighborhood
  scored: Scored
  rent: RentFigure
  commute: CommuteInfo
  vibe: VibeInfo
  moto: MotoInfo
  amenities: AmenityInfo
  scene: SceneInfo
  brief: Brief
  motoOn: boolean
  anchorShort: string
  settings: AppSettings
  panelVerdict: PanelVerdict | null
  onClose: () => void
}

export function DetailPanel({
  hood,
  scored,
  rent,
  commute,
  vibe,
  moto,
  amenities,
  scene,
  brief,
  motoOn,
  anchorShort,
  settings,
  panelVerdict,
  onClose,
}: Props) {
  const trend = trendDisplay(rent.trendYoY)
  const listingsUrl = `https://streeteasy.com/for-rent/${hood.streetEasyArea}/price:-${settings.linkCap}%7Cbeds:1`

  // Budget scale bounds track the configurable target (stretch zone = target → +$500).
  const scaleLo = settings.budgetTarget - 1000
  const scaleHi = settings.budgetTarget + 1600
  const pct = (n: number) =>
    `${Math.min(100, Math.max(0, ((n - scaleLo) / (scaleHi - scaleLo)) * 100))}%`

  return (
    <aside className="detail" role="region" aria-label={`${hood.name} details`}>
      <header className="detail-head">
        <button type="button" className="close-btn" onClick={onClose} aria-label="Close panel">
          ✕
        </button>
        <div className="borough">{hood.borough}</div>
        <h2>{hood.name}</h2>
        <div className="score-line">
          <span
            className="score-disc num"
            style={{ background: scored.color, color: scored.textColor }}
          >
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

      {panelVerdict && (
        <section className="detail-section" aria-label="AI panel verdict">
          <h3>AI panel verdict</h3>
          {panelVerdict.kind === 'pick' ? (
            <>
              <p style={{ margin: 0 }}>
                <strong className="num">Pick #{panelVerdict.rank}</strong> — {panelVerdict.headline}
              </p>
              <p className="note">{panelVerdict.rationale}</p>
            </>
          ) : (
            <>
              <p style={{ margin: 0 }}>
                <strong>Passed.</strong> {panelVerdict.whyNot}
              </p>
              <p className="note">Would flip if: {panelVerdict.wouldFlipIf}</p>
            </>
          )}
        </section>
      )}

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
          {trend ? (
            <span className="trend num" title="Asking-rent trend, year over year">
              {trend.arrow} {trend.text}
            </span>
          ) : (
            <span className="trend num unknown" title="No verified year-over-year trend for this cut.">
              — YoY
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
        <div
          className="budget-scale"
          aria-label={`Where this rent sits against your ${money(settings.budgetTarget)} budget`}
        >
          <div className="track">
            <span
              className="stretch"
              style={{
                left: pct(settings.budgetTarget),
                width: `calc(${pct(settings.budgetTarget + 500)} - ${pct(settings.budgetTarget)})`,
              }}
            />
            {scored.rentUsedForScore != null && (
              <span className="marker" style={{ left: pct(scored.rentUsedForScore) }} />
            )}
          </div>
          <div className="labels num">
            <span>{money(scaleLo)}</span>
            <span>
              {money(settings.budgetTarget)} → {money(settings.budgetTarget + 500)} stretch zone
            </span>
            <span>{money(scaleHi)}</span>
          </div>
        </div>
      </section>

      <section className="detail-section" aria-label="Commute">
        <h3>Commute to {anchorShort}</h3>
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

      {scene.meal.casual > 0 && (
        <section className="detail-section" aria-label="Going out">
          <h3>Going out</h3>
          <div className="fact-row">
            <span className="k">Casual dinner</span>
            <span className="v num">~${scene.meal.casual}/person</span>
          </div>
          <p className="note">{scene.meal.note}</p>
          <div className="fact-row">
            <span className="k">Singles scene</span>
            <span className="v num">{scene.dating.score}/10</span>
          </div>
          <p className="note">{scene.dating.note}</p>
          <div className="fact-row">
            <span className="k">Things to do</span>
            <span className="v num">{scene.thingsToDo.score}/10</span>
          </div>
          <p className="note">{scene.thingsToDo.note}</p>
          {scene.sources.length > 0 && (
            <p className="vibe-sources">Sources: {scene.sources.join(' · ')}</p>
          )}
        </section>
      )}

      {amenities.sources.length > 0 && (
        <section className="detail-section" aria-label="Daily life">
          <h3>Daily life</h3>
          {(
            [
              ['Parks', amenities.parks],
              ['Gyms', amenities.gyms],
              ['Groceries', amenities.groceries],
              ['Coffee / WFH', amenities.coffee],
            ] as const
          ).map(([label, fact]) => (
            <div key={label}>
              <div className="fact-row">
                <span className="k">{label}</span>
                <span className="v num">{fact.score}/10</span>
              </div>
              <p className="note">{fact.note}</p>
            </div>
          ))}
          <div className="fact-row">
            <span className="k">Washer/dryer</span>
            <span className="v" />
          </div>
          <p className="note">{amenities.laundry.note}</p>
          <p className="vibe-sources">Sources: {amenities.sources.join(' · ')}</p>
        </section>
      )}

      {brief.summary && (
        <section className="detail-section" aria-label="Newcomer brief">
          <details className="brief">
            <summary>The brief — if you know nothing about NYC</summary>
            <p>{brief.summary}</p>
            <p>
              <strong>You'll complain about:</strong> {brief.complaints}
            </p>
            <p>
              <strong>Bottom line for you:</strong> {brief.bottomLine}
            </p>
            {brief.sources.length > 0 && (
              <p className="vibe-sources">Sources: {brief.sources.join(' · ')}</p>
            )}
          </details>
        </section>
      )}

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
          View live listings on StreetEasy — 1BR under {money(settings.linkCap)} ↗
        </a>
      </section>

      <p className="fare-note">
        FARE Act (2025): landlords generally pay broker fees now. Lease-term flexibility varies by
        building — ask about 12-month terms when touring.
      </p>
    </aside>
  )
}

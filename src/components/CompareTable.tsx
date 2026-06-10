import { rentDisplay } from '../lib/format'
import type { Scored } from '../lib/score'
import type {
  CommuteFile,
  MotoFile,
  NeighborhoodId,
  NeighborhoodsFile,
  RentFigure,
  VibeFile,
} from '../lib/types'
import { BulletStrip } from './BulletStrip'

interface Props {
  pinned: NeighborhoodId[]
  registry: NeighborhoodsFile
  scores: Record<NeighborhoodId, Scored>
  rents: Record<NeighborhoodId, RentFigure>
  commute: CommuteFile
  vibe: VibeFile
  moto: MotoFile
  motoOn: boolean
  onClose: () => void
  onUnpin: (id: NeighborhoodId) => void
}

export function CompareTable({
  pinned,
  registry,
  scores,
  rents,
  commute,
  vibe,
  moto,
  motoOn,
  onClose,
  onUnpin,
}: Props) {
  const hoods = pinned
    .map((id) => registry.neighborhoods.find((n) => n.id === id))
    .filter((n): n is NonNullable<typeof n> => n != null)

  return (
    <div className="compare-overlay" role="dialog" aria-modal="true" aria-label="Compare neighborhoods">
      <div className="compare-sheet">
        <div className="sheet-head">
          <h2>Side by side</h2>
          <button type="button" className="btn" onClick={onClose}>
            Close
          </button>
        </div>
        <table className="compare-table">
          <thead>
            <tr>
              <th scope="col" aria-label="Metric" />
              {hoods.map((h) => (
                <th scope="col" key={h.id}>
                  {h.name}
                  <br />
                  <button
                    type="button"
                    className="pin-btn"
                    style={{ position: 'static', marginTop: 4 }}
                    onClick={() => onUnpin(h.id)}
                  >
                    Unpin
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Score</td>
              {hoods.map((h) => (
                <td key={h.id}>
                  <span className="compare-score num" style={{ background: scores[h.id].color }}>
                    {Math.round(scores[h.id].composite * 100)}
                  </span>{' '}
                  <span className="num">#{scores[h.id].rank}</span>
                </td>
              ))}
            </tr>
            <tr>
              <td>1BR rent</td>
              {hoods.map((h) => (
                <td key={h.id}>
                  <strong className="num">{rentDisplay(rents[h.id])}</strong>
                  <br />
                  <span className="source-line">
                    {rents[h.id].source} · {rents[h.id].asOf}
                  </span>
                </td>
              ))}
            </tr>
            <tr>
              <td>Commute</td>
              {hoods.map((h) => (
                <td key={h.id}>
                  <BulletStrip lines={commute[h.id].lines} ferry={commute[h.id].ferry} small />
                  <br />
                  <span className="num">
                    {commute[h.id].timeMin}–{commute[h.id].timeMax} min ·{' '}
                    {commute[h.id].transfersMin}–{commute[h.id].transfersMax} transfers
                  </span>
                </td>
              ))}
            </tr>
            <tr>
              <td>Vibe</td>
              {hoods.map((h) => (
                <td key={h.id}>
                  <strong className="num">{vibe[h.id].score}/10</strong> ·{' '}
                  {vibe[h.id].tags.slice(0, 3).join(', ')}
                </td>
              ))}
            </tr>
            <tr>
              <td>No-Regrets</td>
              {hoods.map((h) => (
                <td key={h.id} className="num">
                  {scores[h.id].nri.toFixed(1)}/10
                </td>
              ))}
            </tr>
            {motoOn && (
              <tr>
                <td>Motorcycle</td>
                {hoods.map((h) => (
                  <td key={h.id}>
                    <span className="num">{moto[h.id].parkingViability}/10 street</span>
                    {moto[h.id].garageLow != null && moto[h.id].garageHigh != null && (
                      <span className="num">
                        {' '}
                        · ${moto[h.id].garageLow}–{moto[h.id].garageHigh}/mo garage
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            )}
            <tr>
              <td>What $4K gets</td>
              {hoods.map((h) => (
                <td key={h.id}>{rents[h.id].whatFourKGets}</td>
              ))}
            </tr>
            <tr>
              <td>Honest note</td>
              {hoods.map((h) => (
                <td key={h.id}>{commute[h.id].note}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

import { useEffect, useRef, type KeyboardEvent } from 'react'
import { rentDisplay } from '../lib/format'
import type { Scored } from '../lib/score'
import type {
  AmenitiesFile,
  CommuteFile,
  MotoFile,
  NeighborhoodId,
  NeighborhoodsFile,
  RentFigure,
  SceneFile,
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
  amenities: AmenitiesFile
  scene: SceneFile
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
  amenities,
  scene,
  motoOn,
  onClose,
  onUnpin,
}: Props) {
  const hoods = pinned
    .map((id) => registry.neighborhoods.find((n) => n.id === id))
    .filter((n): n is NonNullable<typeof n> => n != null)

  const sheetRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  // Modal dialog focus management: focus moves in on open, Tab cycles within.
  useEffect(() => {
    closeRef.current?.focus()
  }, [])

  const trapTab = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || !sheetRef.current) return
    const focusables = sheetRef.current.querySelectorAll<HTMLElement>(
      'button, a[href], [tabindex]:not([tabindex="-1"])',
    )
    if (focusables.length === 0) return
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return (
    <div className="compare-overlay" role="dialog" aria-modal="true" aria-label="Compare neighborhoods">
      <div className="compare-sheet" ref={sheetRef} onKeyDown={trapTab}>
        <div className="sheet-head">
          <h2>Side by side</h2>
          <button type="button" className="btn" onClick={onClose} ref={closeRef}>
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
                    aria-label={`Unpin ${h.name}`}
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
                  <span
                    className="compare-score num"
                    style={{ background: scores[h.id].color, color: scores[h.id].textColor }}
                  >
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
            {hoods.some((h) => scene[h.id].meal.casual > 0) && (
              <>
                <tr>
                  <td>Casual dinner</td>
                  {hoods.map((h) => (
                    <td key={h.id} className="num">
                      ~${scene[h.id].meal.casual}/person
                    </td>
                  ))}
                </tr>
                <tr>
                  <td>Singles / things to do</td>
                  {hoods.map((h) => (
                    <td key={h.id} className="num">
                      {scene[h.id].dating.score}/10 · {scene[h.id].thingsToDo.score}/10
                    </td>
                  ))}
                </tr>
              </>
            )}
            {hoods.some((h) => amenities[h.id].sources.length > 0) && (
              <tr>
                <td>Daily life</td>
                {hoods.map((h) => (
                  <td key={h.id} className="num">
                    Parks {amenities[h.id].parks.score} · Gyms {amenities[h.id].gyms.score} ·
                    Grocery {amenities[h.id].groceries.score} · Coffee{' '}
                    {amenities[h.id].coffee.score}
                  </td>
                ))}
              </tr>
            )}
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

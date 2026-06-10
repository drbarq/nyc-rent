import { rentDisplay } from '../lib/format'
import type { Scored } from '../lib/score'
import type { CommuteFile, NeighborhoodId, NeighborhoodsFile, RentFigure } from '../lib/types'
import { BulletStrip } from './BulletStrip'

interface Props {
  registry: NeighborhoodsFile
  scores: Record<NeighborhoodId, Scored>
  rents: Record<NeighborhoodId, RentFigure>
  commute: CommuteFile
  selectedId: NeighborhoodId | null
  pinned: NeighborhoodId[]
  onSelect: (id: NeighborhoodId) => void
  onTogglePin: (id: NeighborhoodId) => void
}

export function RankedList({
  registry,
  scores,
  rents,
  commute,
  selectedId,
  pinned,
  onSelect,
  onTogglePin,
}: Props) {
  const ordered = [...registry.neighborhoods].sort(
    (a, b) => scores[a.id].rank - scores[b.id].rank,
  )

  return (
    <section className="ranked" aria-label="Neighborhoods ranked by your weights">
      <h2 className="section-title" style={{ padding: 'var(--s3) var(--s4) 0' }}>
        Ranked by your weights
      </h2>
      <ol>
        {ordered.map((hood) => {
          const s = scores[hood.id]
          const isPinned = pinned.includes(hood.id)
          return (
            <li key={hood.id} className="rank-li">
              <button
                type="button"
                className={`rank-row${selectedId === hood.id ? ' selected' : ''}`}
                style={{ borderLeftColor: s.color }}
                onClick={() => onSelect(hood.id)}
                aria-label={`${s.rank}. ${hood.name}, score ${Math.round(s.composite * 100)} of 100, rent ${rentDisplay(rents[hood.id])}`}
              >
                <span className="top">
                  <span className="rank num">{s.rank}</span>
                  <span className="name">{hood.name}</span>
                  <span className="score num">{Math.round(s.composite * 100)}</span>
                </span>
                <span className="bottom">
                  <BulletStrip
                    lines={commute[hood.id].lines}
                    ferry={commute[hood.id].ferry}
                    small
                  />
                  <span className="rent num">{rentDisplay(rents[hood.id])}</span>
                </span>
              </button>
              <button
                type="button"
                className={`pin-btn${isPinned ? ' pinned' : ''}`}
                aria-pressed={isPinned}
                aria-label={isPinned ? `Unpin ${hood.name}` : `Pin ${hood.name} for comparison`}
                onClick={() => onTogglePin(hood.id)}
              >
                {isPinned ? 'Pinned ✓' : 'Pin'}
              </button>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

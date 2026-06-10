import type { JudgesFile, NeighborhoodId, NeighborhoodsFile } from '../lib/types'

interface Props {
  judges: JudgesFile
  registry: NeighborhoodsFile
  onSelect: (id: NeighborhoodId) => void
}

/** The AI judge panel's consensus shortlist — advisory, clearly labeled as such. */
export function JudgesPicks({ judges, registry, onSelect }: Props) {
  if (judges.picks.length === 0) return null
  const name = (id: NeighborhoodId) =>
    registry.neighborhoods.find((n) => n.id === id)?.name ?? id

  return (
    <section className="section judges" aria-label="AI judge panel picks">
      <h2 className="section-title">
        AI panel — top 3 picks <span className="judges-tag">advisory</span>
      </h2>
      <ol className="judge-list">
        {judges.picks.map((p) => (
          <li key={p.id}>
            <button type="button" className="judge-pick" onClick={() => onSelect(p.id)}>
              <span className="judge-rank num">{p.rank}</span>
              <span className="judge-body">
                <strong>{name(p.id)}</strong> — {p.headline}
                <span className="judge-rationale" title={p.rationale}>
                  {p.rationale}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ol>
      <details className="judge-detail">
        <summary>How the panel voted</summary>
        {judges.judges.map((j) => (
          <p key={j.lens} className="judge-voice">
            <strong>{j.label}:</strong> {j.oneLiner}{' '}
            <span className="judge-top3">({j.top3.map(name).join(' → ')})</span>
          </p>
        ))}
        {judges.dissent && (
          <p className="judge-voice">
            <strong>Dissent:</strong> {judges.dissent}
          </p>
        )}
        <p className="judge-method">
          {judges.method} Generated {judges.generatedAt}. Your sliders are the real ranking.
        </p>
      </details>
    </section>
  )
}

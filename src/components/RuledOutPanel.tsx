import type { RuledOut } from '../lib/types'

interface Props {
  area: RuledOut
  onClose: () => void
}

/** Mini panel for a considered-but-excluded area — the reason it didn't make the cut. */
export function RuledOutPanel({ area, onClose }: Props) {
  return (
    <aside className="detail" role="region" aria-label={`${area.name} — considered, not scored`}>
      <header className="detail-head">
        <button type="button" className="close-btn" onClick={onClose} aria-label="Close panel">
          ✕
        </button>
        <div className="borough">Considered — not scored</div>
        <h2>{area.name}</h2>
      </header>
      <section className="detail-section" aria-label="Why it's out">
        <h3>Why it's out</h3>
        <p style={{ margin: 0 }}>{area.reason}</p>
        <p className="note">
          Disagree? Promote it: add full entries to the data files (see the README's
          add-a-neighborhood steps) and it joins the ranked list like the other 18.
        </p>
      </section>
    </aside>
  )
}

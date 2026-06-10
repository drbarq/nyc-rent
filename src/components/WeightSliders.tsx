import type { Weights } from '../lib/types'

interface Props {
  weights: Weights
  onChange: (w: Weights) => void
  motoOn: boolean
  onMotoToggle: (on: boolean) => void
}

const ROWS: Array<{ key: keyof Weights; label: string }> = [
  { key: 'vibe', label: 'Vibe' },
  { key: 'commute', label: 'Commute' },
  { key: 'budget', label: 'Budget fit' },
]

export function WeightSliders({ weights, onChange, motoOn, onMotoToggle }: Props) {
  const rows = motoOn ? [...ROWS, { key: 'moto' as const, label: 'Motorcycle' }] : ROWS
  return (
    <section className="section" aria-label="Score weights">
      <h2 className="section-title">Your weights</h2>
      {rows.map(({ key, label }) => (
        <div className="weight-row" key={key}>
          <label htmlFor={`w-${key}`}>{label}</label>
          <input
            id={`w-${key}`}
            type="range"
            min={0}
            max={100}
            step={5}
            value={weights[key]}
            onChange={(e) => onChange({ ...weights, [key]: Number(e.target.value) })}
          />
          <span className="val num">{weights[key]}</span>
        </div>
      ))}
      <label className="moto-toggle">
        <input
          type="checkbox"
          checked={motoOn}
          onChange={(e) => onMotoToggle(e.target.checked)}
        />
        <span>
          Bringing the motorcycle
          <br />
          <span className="hint">
            Adds street-parking viability and garage cost to the score. Weekend rides, not
            commuting.
          </span>
        </span>
      </label>
    </section>
  )
}

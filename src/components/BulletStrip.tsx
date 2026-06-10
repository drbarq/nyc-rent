import { lineColor, lineTextColor } from '../lib/mta'

interface Props {
  lines: string[]
  ferry?: boolean
  small?: boolean
}

/** Authentic MTA bullet strip — the one flourish (PRD §7). */
export function BulletStrip({ lines, ferry = false, small = false }: Props) {
  return (
    <span className="bullet-strip" role="img" aria-label={`Subway lines ${lines.join(', ')}${ferry ? ', plus ferry' : ''}`}>
      {lines.map((line) => (
        <span
          key={line}
          className={small ? 'bullet sm' : 'bullet'}
          style={{ background: lineColor(line), color: lineTextColor(line) }}
          aria-hidden="true"
        >
          {line}
        </span>
      ))}
      {ferry && (
        <span className="ferry-chip" aria-hidden="true">
          FERRY
        </span>
      )}
    </span>
  )
}

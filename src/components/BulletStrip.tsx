import { LINE_COLORS, lineColor, lineTextColor } from '../lib/mta'

interface Props {
  lines: string[]
  ferry?: boolean
  small?: boolean
}

/**
 * Authentic MTA bullet strip — the one flourish (PRD §7). Single-character MTA
 * designations render as colored bullets; anything else (AIRTRAIN, LIRR, Q70…)
 * renders as a quiet text chip.
 */
export function BulletStrip({ lines, ferry = false, small = false }: Props) {
  return (
    <span className="bullet-strip" role="img" aria-label={`Transit: ${lines.join(', ')}${ferry ? ', plus ferry' : ''}`}>
      {lines.map((line) =>
        LINE_COLORS[line] ? (
          <span
            key={line}
            className={small ? 'bullet sm' : 'bullet'}
            style={{ background: lineColor(line), color: lineTextColor(line) }}
            aria-hidden="true"
          >
            {line}
          </span>
        ) : (
          <span key={line} className="ferry-chip" aria-hidden="true">
            {line}
          </span>
        ),
      )}
      {ferry && (
        <span className="ferry-chip" aria-hidden="true">
          FERRY
        </span>
      )}
    </span>
  )
}

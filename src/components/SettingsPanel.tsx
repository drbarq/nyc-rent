import { useEffect, useRef, type KeyboardEvent } from 'react'
import { money } from '../lib/format'
import { DEFAULT_SETTINGS, type AppSettings } from '../lib/types'

interface Props {
  settings: AppSettings
  onChange: (patch: Partial<AppSettings>) => void
  onClose: () => void
}

export function SettingsPanel({ settings, onChange, onClose }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const firstRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    firstRef.current?.focus()
  }, [])

  const trapTab = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || !sheetRef.current) return
    const focusables = sheetRef.current.querySelectorAll<HTMLElement>(
      'button, input, a[href], [tabindex]:not([tabindex="-1"])',
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
    <div className="compare-overlay" role="dialog" aria-modal="true" aria-label="Settings">
      <div className="compare-sheet settings-sheet" ref={sheetRef} onKeyDown={trapTab}>
        <div className="sheet-head">
          <h2>Settings</h2>
          <button type="button" className="btn" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="settings-body">
          <div className="setting-row">
            <label htmlFor="set-budget">
              Budget target
              <span className="hint">
                Scoring re-anchors here; the stretch zone runs to +$500 past it.
              </span>
            </label>
            <input
              id="set-budget"
              ref={firstRef}
              type="range"
              min={3000}
              max={5500}
              step={100}
              value={settings.budgetTarget}
              onChange={(e) => onChange({ budgetTarget: Number(e.target.value) })}
            />
            <span className="val num">{money(settings.budgetTarget)}</span>
          </div>

          <div className="setting-row">
            <label htmlFor="set-cap">
              Listings link cap
              <span className="hint">Max price baked into the StreetEasy deep links.</span>
            </label>
            <input
              id="set-cap"
              type="range"
              min={2500}
              max={6000}
              step={100}
              value={settings.linkCap}
              onChange={(e) => onChange({ linkCap: Number(e.target.value) })}
            />
            <span className="val num">{money(settings.linkCap)}</span>
          </div>

          <button
            type="button"
            className="btn"
            onClick={() => onChange({ ...DEFAULT_SETTINGS })}
          >
            Reset to defaults
          </button>
        </div>
      </div>
    </div>
  )
}

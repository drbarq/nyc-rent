import { useCallback, useState } from 'react'
import { DEFAULT_SETTINGS, type AppSettings } from './types'

const KEY = 'nyc-move-settings'

export function useSettings(): [AppSettings, (patch: Partial<AppSettings>) => void] {
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
    } catch {
      return DEFAULT_SETTINGS
    }
  })

  const update = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch }
      try {
        localStorage.setItem(KEY, JSON.stringify(next))
      } catch {
        /* private mode — settings just won't persist */
      }
      return next
    })
  }, [])

  return [settings, update]
}

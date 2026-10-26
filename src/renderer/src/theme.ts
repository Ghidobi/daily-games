import { useEffect } from 'react'
import type { ThemeMode } from '@shared/types'

/** Applica il tema chiaro/scuro all'elemento <html>, seguendo il sistema se richiesto. */
export function useResolvedTheme(mode: ThemeMode): void {
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = mode === 'dark' || (mode === 'system' && media.matches)
      document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [mode])
}

/** Testo nero o bianco, quello più leggibile sul colore dato (luminanza WCAG). */
export function onColor(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  const lin = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  const l = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255)
  return l > 0.36 ? '#10131a' : '#ffffff'
}

/** Variabili CSS del tema di un gioco. */
export function gameVars(theme: { accent: string; bg: string }): React.CSSProperties {
  return { '--accent': theme.accent, '--on-accent': onColor(theme.accent), '--game-bg': theme.bg } as React.CSSProperties
}

const DAY_FORMAT = new Intl.DateTimeFormat('it-IT', {
  timeZone: 'Europe/Rome',
  weekday: 'long',
  day: 'numeric',
  month: 'long'
})

/** "lunedì 26 ottobre" a partire da una chiave YYYY-MM-DD. */
export function formatDay(dayKey: string): string {
  return DAY_FORMAT.format(new Date(`${dayKey}T12:00:00Z`))
}

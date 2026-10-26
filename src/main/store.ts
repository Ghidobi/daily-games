import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { DayEntry, Game, ThemeMode } from '@shared/types'
import { DEFAULT_GAMES } from './catalog'

export interface WindowState {
  x?: number
  y?: number
  width: number
  height: number
  maximized: boolean
}

export interface StoreData {
  version: 1
  games: Game[]
  /** days[YYYY-MM-DD][gameId] */
  days: Record<string, Record<string, DayEntry>>
  settings: {
    themeMode: ThemeMode
    window?: WindowState
  }
}

function defaults(): StoreData {
  return {
    version: 1,
    games: structuredClone(DEFAULT_GAMES),
    days: {},
    settings: { themeMode: 'system' }
  }
}

/**
 * Archivio dei dati dell'app: un file JSON nella cartella dati dell'utente
 * (%APPDATA%\Daily Games\data.json), mai nel progetto o nel pacchetto.
 */
export class Store {
  readonly file = join(app.getPath('userData'), 'data.json')
  data: StoreData
  private timer: NodeJS.Timeout | undefined

  constructor() {
    this.data = this.load()
  }

  private load(): StoreData {
    if (!existsSync(this.file)) return defaults()
    try {
      const parsed = JSON.parse(readFileSync(this.file, 'utf8')) as Partial<StoreData>
      const base = defaults()
      return {
        ...base,
        ...parsed,
        settings: { ...base.settings, ...parsed.settings }
      } as StoreData
    } catch (err) {
      // File illeggibile: lo mettiamo da parte invece di perderlo.
      console.error('data.json non valido, ne creo uno nuovo', err)
      renameSync(this.file, `${this.file}.corrotto-${Date.now()}`)
      return defaults()
    }
  }

  /** Salva con un breve ritardo, per raggruppare modifiche ravvicinate. */
  save(): void {
    clearTimeout(this.timer)
    this.timer = setTimeout(() => this.flush(), 300)
  }

  flush(): void {
    clearTimeout(this.timer)
    mkdirSync(dirname(this.file), { recursive: true })
    const tmp = `${this.file}.tmp`
    writeFileSync(tmp, JSON.stringify(this.data, null, 2), 'utf8')
    renameSync(tmp, this.file)
  }

  day(dayKey: string): Record<string, DayEntry> {
    return this.data.days[dayKey] ?? {}
  }

  setPlayed(dayKey: string, gameId: string, played: boolean): void {
    const day = (this.data.days[dayKey] ??= {})
    if (played) day[gameId] = { played: true, at: new Date().toISOString() }
    else delete day[gameId]
    this.save()
  }
}

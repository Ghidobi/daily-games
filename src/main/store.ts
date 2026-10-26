import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { DayEntry, DaysData, Game, GameResult, UserSettings } from '@shared/types'
import { DEFAULT_GAMES } from '@shared/catalog'

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
  days: DaysData
  settings: UserSettings & { window?: WindowState }
  /** Giorno in cui è già partito il promemoria (per non ripeterlo). */
  reminderSentOn?: string
}

function defaults(): StoreData {
  return {
    version: 1,
    games: structuredClone(DEFAULT_GAMES),
    days: {},
    settings: {
      themeMode: 'system',
      reminder: { enabled: false, time: '21:00' },
      closeToTray: true,
      openAtLogin: false
    }
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

/** Completa i dati letti da file (versioni vecchie o file importati) con i valori predefiniti. */
function normalize(parsed: Partial<StoreData>): StoreData {
  const base = defaults()
  return {
    ...base,
    ...parsed,
    games: Array.isArray(parsed.games) ? parsed.games : base.games,
    days: isObj(parsed.days) ? (parsed.days as DaysData) : {},
    settings: {
      ...base.settings,
      ...parsed.settings,
      reminder: { ...base.settings.reminder, ...parsed.settings?.reminder }
    }
  }
}

/** Formato del file di backup esportato. */
export interface ExportFile {
  app: 'daily-games'
  format: 1
  exportedAt: string
  games: Game[]
  days: DaysData
  settings: Omit<UserSettings, 'openAtLogin'>
}

/** Controlla che un file importato sia un backup valido; restituisce un messaggio d'errore o null. */
export function validateExport(v: unknown): string | null {
  if (!isObj(v) || v.app !== 'daily-games') return 'Il file non è un backup di Daily Games.'
  if (!Array.isArray(v.games) || !isObj(v.days)) return 'Il backup è incompleto o danneggiato.'
  const okGame = (g: unknown) =>
    isObj(g) && typeof g.id === 'string' && typeof g.name === 'string' && typeof g.url === 'string' && /^https?:\/\//.test(g.url) && isObj(g.theme)
  if (!v.games.every(okGame)) return 'Il backup contiene giochi non validi.'
  return null
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
      return normalize(JSON.parse(readFileSync(this.file, 'utf8')) as Partial<StoreData>)
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
    if (played) day[gameId] = { ...day[gameId], played: true, at: day[gameId]?.at ?? new Date().toISOString() }
    else delete day[gameId]
    this.save()
  }

  setResult(dayKey: string, gameId: string, result: GameResult): void {
    const day = (this.data.days[dayKey] ??= {})
    day[gameId] = { played: true, at: day[gameId]?.at ?? new Date().toISOString(), result }
    this.save()
  }

  /** Rimette una voce com'era (per "Annulla"). */
  restore(dayKey: string, gameId: string, entry: DayEntry | undefined): void {
    const day = (this.data.days[dayKey] ??= {})
    if (entry) day[gameId] = entry
    else delete day[gameId]
    this.save()
  }

  toExport(): ExportFile {
    const { window: _w, openAtLogin: _o, ...settings } = this.data.settings
    return { app: 'daily-games', format: 1, exportedAt: new Date().toISOString(), games: this.data.games, days: this.data.days, settings }
  }

  /** Sostituisce raccolta, storico e impostazioni con quelli di un backup (già validato). */
  importFrom(file: ExportFile): void {
    this.backup('prima-di-importare')
    const { window, openAtLogin } = this.data.settings
    this.data = normalize({ games: file.games, days: file.days, settings: { ...this.data.settings, ...file.settings, window, openAtLogin } })
    this.flush()
  }

  /** Copia di sicurezza del file dati in userData/backup. */
  backup(label: string): void {
    this.flush()
    const dir = join(dirname(this.file), 'backup')
    mkdirSync(dir, { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    writeFileSync(join(dir, `data-${label}-${stamp}.json`), readFileSync(this.file))
  }
}

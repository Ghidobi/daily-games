// Tipi condivisi tra processo principale, preload e interfaccia.

export interface GameTheme {
  /** Sfondo del sito, usato dietro la vista mentre carica. */
  bg: string
  /** Sfondo dell'intestazione della scheda. */
  header: string
  /** Colore del testo nell'intestazione. */
  headerText: string
  /** Colore d'accento: bordo della scheda, indicatori. */
  accent: string
}

export interface Game {
  id: string
  name: string
  url: string
  category: string
  theme: GameTheme
  hidden?: boolean
}

export type ThemeMode = 'system' | 'light' | 'dark'

export interface DayEntry {
  played: boolean
  /** ISO timestamp di quando è stato segnato come giocato. */
  at?: string
}

/** Stato di una vista di gioco aperta. */
export interface GameViewStatus {
  loaded: boolean
  loading: boolean
  canGoBack: boolean
  error?: string
}

/** Fotografia dello stato che il processo principale invia all'interfaccia. */
export interface AppState {
  games: Game[]
  dayKey: string
  today: Record<string, DayEntry>
  active: 'today' | string
  icons: Record<string, string>
  views: Record<string, GameViewStatus>
  themeMode: ThemeMode
  /** Messaggio da mostrare (es. accesso Google bloccato). */
  notice?: { gameId: string; text: string }
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export type GameAction = 'back' | 'reload' | 'home' | 'external'

export interface Api {
  getState(): Promise<AppState>
  onState(cb: (state: AppState) => void): () => void
  open(target: 'today' | string): void
  next(): void
  setContentBounds(rect: Rect | null): void
  setPlayed(gameId: string, played: boolean): void
  gameAction(gameId: string, action: GameAction): void
  setThemeMode(mode: ThemeMode): void
  dismissNotice(): void
}

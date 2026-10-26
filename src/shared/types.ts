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

/** Risultato di una partita, ricavato dal testo "Condividi" del gioco. */
export interface GameResult {
  /** Testo originale copiato dal gioco. */
  text: string
  /** Numero della partita, se il gioco lo indica (es. "123"). */
  puzzle?: string
  /** true = indovinato, false = perso, assente = non si sa. */
  solved?: boolean
  /** Tentativi usati (meno è meglio). */
  attempts?: number
  maxAttempts?: number
  /** Punteggio numerico (più è meglio), es. km o punti. */
  score?: number
  scoreUnit?: string
  /** Suggerimenti usati. */
  hints?: number
}

export interface DayEntry {
  played: boolean
  /** ISO timestamp di quando è stato segnato come giocato. */
  at?: string
  result?: GameResult
}

/** days[YYYY-MM-DD][gameId] */
export type DaysData = Record<string, Record<string, DayEntry>>

/** Stato di una vista di gioco aperta. */
export interface GameViewStatus {
  loaded: boolean
  loading: boolean
  canGoBack: boolean
  error?: string
}

/** Pagine dell'app oltre alle schede dei giochi. */
export type PageId = 'today' | 'stats'

export interface Toast {
  id: number
  text: string
  gameId?: string
  /** Mostra il pulsante "Annulla" (annulla l'ultimo risultato salvato). */
  undo?: boolean
}

/** Fotografia dello stato che il processo principale invia all'interfaccia. */
export interface AppState {
  games: Game[]
  dayKey: string
  today: Record<string, DayEntry>
  /** Pagina o id del gioco attivo. */
  active: PageId | string
  icons: Record<string, string>
  views: Record<string, GameViewStatus>
  themeMode: ThemeMode
  /** Messaggio da mostrare (es. accesso Google bloccato). */
  notice?: { gameId: string; text: string }
  toast?: Toast
  /** Cresce a ogni modifica dello storico: l'interfaccia lo usa per ricaricarlo. */
  dataVersion: number
  /** Serie di giorni consecutivi (totale e per gioco). */
  streaks: { total: number; games: Record<string, number> }
}

/** Esito dell'analisi di un testo incollato a mano. */
export interface ParsePreview {
  gameId?: string
  result?: GameResult
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
  open(target: PageId | string): void
  next(): void
  setContentBounds(rect: Rect | null): void
  setPlayed(gameId: string, played: boolean): void
  gameAction(gameId: string, action: GameAction): void
  setThemeMode(mode: ThemeMode): void
  dismissNotice(): void
  getDays(): Promise<DaysData>
  parseResult(text: string): Promise<ParsePreview>
  /** Salva un risultato incollato a mano per oggi. */
  saveResult(gameId: string, text: string): void
  undoResult(): void
  dismissToast(id: number): void
  /** Copia negli appunti il riepilogo di oggi; restituisce il testo copiato. */
  shareDay(): Promise<string>
}

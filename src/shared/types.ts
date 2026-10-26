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

/** Impostazioni modificabili dall'utente. */
export interface UserSettings {
  themeMode: ThemeMode
  reminder: { enabled: boolean; /** "HH:MM", ora di Roma */ time: string }
  /** Chiudendo la finestra l'app resta nell'area di notifica. */
  closeToTray: boolean
  /** Avvio automatico con Windows (ridotta nell'area di notifica). */
  openAtLogin: boolean
  adblock: AdblockSettings
}

export interface AdblockSettings {
  /** Interruttore generale. */
  enabled: boolean
  /** Giochi su cui il blocco è spento. */
  disabledGames: string[]
  /** Domini mai bloccati (né le richieste verso di loro, né le loro pagine). */
  allowlist: string[]
}

export interface AdblockState {
  ready: boolean
  updating: boolean
  updatedAt?: string
  filters?: number
  error?: string
  /** Elementi bloccati nella pagina attuale di ogni gioco. */
  blocked: Record<string, number>
}

/** Modifiche consentite a un gioco della raccolta. */
export type GamePatch = Partial<Pick<Game, 'name' | 'category' | 'hidden'>> & { accent?: string }

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
export type PageId = 'today' | 'stats' | 'collection' | 'settings' | 'discover'

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
  settings: UserSettings
  version: string
  /** false in sviluppo (npm run dev): l'avvio con Windows funziona solo nell'app installata. */
  packaged: boolean
  /** true nella versione portatile (le notifiche di Windows potrebbero non comparire). */
  portable: boolean
  /** Messaggio da mostrare (es. accesso Google bloccato, gioco che rileva il blocco pubblicità). */
  notice?: { gameId: string; text: string; kind: 'google' | 'adblock' }
  adblock: AdblockState
  toast?: Toast
  /** Cresce a ogni modifica dello storico: l'interfaccia lo usa per ricaricarlo. */
  dataVersion: number
  discovery: DiscoveryState
  update: UpdateStatus
  /** Gioco aperto in prova (non fa parte della raccolta). */
  trial?: Game
  /** Serie di giorni consecutivi (totale e per gioco). */
  streaks: { total: number; games: Record<string, number> }
}

export type AddGameResult = { ok: true; game: Game; warning?: string } | { ok: false; error: string }

/** Gioco proposto da "Scopri nuovi giochi". */
export interface Suggestion {
  id: string
  name: string
  url: string
  description: string
  category: string
  /** Perché potrebbe piacerti, rispetto ai giochi che hai già. */
  reason?: string
  /** ISO timestamp della ricerca che l'ha trovato. */
  foundAt: string
  status: 'new' | 'added' | 'discarded'
}

export interface DiscoveryState {
  hasKey: boolean
  /** Ultime cifre della chiave salvata, es. "…AbCd". */
  keyHint?: string
  searching: boolean
  error?: string
  /** Stima in dollari del costo dell'ultima ricerca. */
  lastCost?: number
  lastSearchAt?: string
  suggestions: Suggestion[]
}

/** Stato degli aggiornamenti automatici. */
export type UpdateStatus =
  | { state: 'idle' | 'checking' }
  | { state: 'latest'; checkedAt: string }
  | { state: 'downloading'; version: string; percent: number }
  | { state: 'ready'; version: string }
  /** Nuova versione da scaricare a mano (versione portatile o Mac). */
  | { state: 'available'; version: string }
  | { state: 'unsupported'; reason: string }
  | { state: 'error'; error: string }

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
  /** Aggiunge un gioco dal suo indirizzo. */
  addGame(url: string): Promise<AddGameResult>
  updateGame(id: string, patch: GamePatch): void
  reorderGames(ids: string[]): void
  removeGame(id: string, clearLogin: boolean): void
  updateSettings(patch: Partial<Omit<UserSettings, 'themeMode'>>): void
  /** Mostra una notifica di prova del promemoria. */
  testReminder(): void
  exportData(): Promise<{ ok: boolean; path?: string; error?: string }>
  importData(): Promise<{ ok: boolean; error?: string; canceled?: boolean }>
  /** Salva la chiave API (dopo averla verificata con Anthropic). */
  setApiKey(key: string): Promise<{ ok: boolean; error?: string }>
  removeApiKey(): void
  /** Cerca nuovi giochi online. */
  discover(): Promise<{ ok: boolean; count?: number; error?: string }>
  trySuggestion(id: string): void
  addSuggestion(id: string): Promise<AddGameResult>
  discardSuggestion(id: string): void
  restoreSuggestion(id: string): void
  /** Aggiunge alla raccolta il gioco in prova. */
  keepTrial(): Promise<AddGameResult>
  closeTrial(): void
  checkUpdates(): void
  /** Riavvia l'app installando l'aggiornamento scaricato. */
  installUpdate(): void
  /** Apre la pagina di download delle nuove versioni. */
  openReleases(): void
  setAdblock(patch: Partial<Pick<AdblockSettings, 'enabled' | 'allowlist'>>): void
  /** Attiva/disattiva il blocco su un gioco; con `reload` ricarica la pagina. */
  setGameAdblock(gameId: string, active: boolean, reload?: boolean): void
  refreshFilters(): void
}

import { BaseWindow, Menu, WebContentsView, app, dialog, ipcMain, nativeTheme, screen, shell } from 'electron'
import type { Event, Input, Tray } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AddGameResult, AppState, DayEntry, GameAction, GamePatch, PageId, ParsePreview, Rect, ThemeMode, UserSettings } from '@shared/types'
import { compactForShare, detectResult, parseFor, summarize } from '@shared/results'
import { streaks } from '@shared/stats'
import { ClipboardWatcher } from './capture'
import { buildGame, normalizeUrl } from './addGame'
import { DEFAULT_GAMES } from '@shared/catalog'
import { romeDayKey, romeTime, watchDayChange } from './day'
import { GameViews, gameSession } from './gameViews'
import { cachedIcon, fetchIcon, removeCachedIcon } from './icons'
import { Store, validateExport } from './store'
import type { ExportFile } from './store'
import { APP_ID, appIcon, createTray, isPortable, notify, setOpenAtLogin, startedHidden } from './system'
import { chromeUserAgent, isHttp } from './web'

// Profilo separato per prove e sviluppo: DAILY_GAMES_PROFILE=C:\percorso\cartella
if (process.env.DAILY_GAMES_PROFILE) app.setPath('userData', process.env.DAILY_GAMES_PROFILE)

if (!app.requestSingleInstanceLock()) app.quit()

// Anche le richieste fuori dalle viste dei giochi (es. download delle icone) usano un UA standard.
app.userAgentFallback = chromeUserAgent()
app.setAppUserModelId(APP_ID) // necessario per le notifiche di Windows
Menu.setApplicationMenu(null)

let win: BaseWindow
let shellView: WebContentsView
let views: GameViews
let store: Store
let tray: Tray | undefined
let quitting = false
let trayHintShown = false

let active: AppState['active'] = 'today'
let contentBounds: Rect | null = null
let dayKey = romeDayKey()
let notice: AppState['notice']
let toast: AppState['toast']
let toastSeq = 0
let dataVersion = 0
let watcher: ClipboardWatcher
/** Ultimo risultato salvato, per "Annulla". */
let lastCapture: { dayKey: string; gameId: string; previous?: DayEntry } | undefined
const icons: Record<string, string> = {}
const PAGES: PageId[] = ['today', 'stats', 'collection', 'settings']

const visibleGames = () => store.data.games.filter((g) => !g.hidden)
const findGame = (id: string) => store.data.games.find((g) => g.id === id)

function snapshot(): AppState {
  return {
    games: store.data.games,
    dayKey,
    today: store.day(dayKey),
    active,
    icons,
    views: views.status,
    themeMode: store.data.settings.themeMode,
    settings: (({ window: _w, ...rest }) => rest)(store.data.settings),
    version: app.getVersion(),
    packaged: app.isPackaged,
    portable: isPortable,
    notice,
    toast,
    dataVersion,
    streaks: streaks(store.data.days, dayKey, visibleGames().map((g) => g.id))
  }
}

function showToast(text: string, extra: Partial<AppState['toast']> = {}): void {
  toast = { id: ++toastSeq, text, ...extra }
}

function dataChanged(): void {
  dataVersion++
  broadcast()
}

function broadcast(): void {
  if (!shellView.webContents.isDestroyed()) shellView.webContents.send('state', snapshot())
}

/** Posiziona la vista del gioco attivo sopra l'area che l'interfaccia le riserva. */
function applyLayout(): void {
  const game = findGame(active)
  if (game) views.show(game, contentBounds)
  else views.hideAll()
}

function open(target: AppState['active']): void {
  const isPage = (PAGES as string[]).includes(target)
  if (!isPage && !findGame(target)) return
  if (target !== active) contentBounds = null // l'interfaccia invierà la nuova area
  active = target
  notice = undefined
  applyLayout()
  if (isPage) shellView.webContents.focus()
  broadcast()
}

/** Un testo è arrivato dagli appunti o da un gioco: se è un risultato lo salva per oggi. */
function capture(text: string, fromGameId?: string): void {
  const games = visibleGames()
  const found = detectResult(text, games, fromGameId ?? (findGame(active) ? active : undefined))
  if (!found) return
  const previous = store.day(dayKey)[found.gameId]
  if (previous?.result?.text === found.result.text) return // già salvato
  lastCapture = { dayKey, gameId: found.gameId, previous: previous && structuredClone(previous) }
  store.setResult(dayKey, found.gameId, found.result)
  const game = findGame(found.gameId)!
  showToast(`${game.name}: ${summarize(found.result)}`, { gameId: game.id, undo: true })
  dataChanged()
}

function undoCapture(): void {
  if (!lastCapture) return
  store.restore(lastCapture.dayKey, lastCapture.gameId, lastCapture.previous)
  lastCapture = undefined
  showToast('Risultato annullato')
  dataChanged()
}

const DAY_TITLE = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', weekday: 'long', day: 'numeric', month: 'long' })

/** Messaggio unico con i risultati di oggi, pronto da incollare su WhatsApp. */
function buildDayMessage(): string {
  const today = store.day(dayKey)
  const games = visibleGames()
  const played = games.filter((g) => today[g.id]?.played)
  const streak = streaks(store.data.days, dayKey, games.map((g) => g.id)).total
  const lines = [
    `🎮 Daily Games · ${DAY_TITLE.format(new Date(`${dayKey}T12:00:00Z`))}`,
    `${played.length}/${games.length} giochi${streak > 1 ? ` · 🔥 ${streak} giorni di fila` : ''}`
  ]
  for (const g of played) {
    const r = today[g.id].result
    lines.push('', r ? compactForShare(r.text) : `✅ ${g.name}`)
  }
  return lines.join('\n')
}

function openNext(): void {
  const today = store.day(dayKey)
  const next = visibleGames().find((g) => !today[g.id]?.played)
  open(next ? next.id : 'today')
}

function showWindow(): void {
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}

function quitApp(): void {
  quitting = true
  app.quit()
}

// ---- promemoria ----

const remainingGames = () => visibleGames().filter((g) => !store.day(dayKey)[g.id]?.played)

function reminderText(): string {
  const left = remainingGames()
  const names = left.map((g) => g.name)
  const list = names.length > 3 ? `${names.slice(0, 3).join(', ')} e altri ${names.length - 3}` : names.join(', ')
  return left.length === 1 ? `Ti manca ancora ${list}.` : `Ti mancano ancora ${left.length} giochi: ${list}.`
}

/** Notifica all'ora scelta, una volta al giorno, solo se restano giochi da fare. */
function checkReminder(): void {
  const r = store.data.settings.reminder
  if (!r.enabled || store.data.reminderSentOn === dayKey || romeTime() < r.time) return
  store.data.reminderSentOn = dayKey
  store.save()
  if (remainingGames().length === 0) return
  notify('Daily Games', reminderText(), () => {
    showWindow()
    openNext()
  })
}

function updateSettings(patch: Partial<UserSettings>): void {
  const s = store.data.settings
  if (patch.reminder) {
    const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(patch.reminder.time) ? patch.reminder.time : s.reminder.time
    s.reminder = { enabled: !!patch.reminder.enabled, time }
    // Se l'ora di oggi è già passata, il primo promemoria arriva domani.
    store.data.reminderSentOn = romeTime() >= time ? dayKey : undefined
  }
  if (patch.closeToTray !== undefined) s.closeToTray = !!patch.closeToTray
  if (patch.openAtLogin !== undefined) {
    s.openAtLogin = !!patch.openAtLogin
    setOpenAtLogin(s.openAtLogin)
  }
  store.save()
  broadcast()
}

// ---- raccolta ----

function updateGame(id: string, patch: GamePatch): void {
  const game = findGame(id)
  if (!game) return
  if (typeof patch.name === 'string' && patch.name.trim()) game.name = patch.name.trim().slice(0, 40)
  if (typeof patch.category === 'string') game.category = patch.category.trim().slice(0, 30)
  if (patch.hidden !== undefined) game.hidden = !!patch.hidden
  if (typeof patch.accent === 'string' && /^#[0-9a-f]{6}$/i.test(patch.accent)) {
    // L'intestazione resta quella del sito: cambia solo l'accento (bordo e pulsanti).
    game.theme = { ...game.theme, accent: patch.accent.toUpperCase() }
  }
  store.save()
  if (game.hidden && active === id) open('today')
  dataChanged()
}

function reorderGames(ids: string[]): void {
  const current = store.data.games
  if (ids.length !== current.length || !current.every((g) => ids.includes(g.id))) return
  store.data.games = ids.map((id) => current.find((g) => g.id === id)!)
  store.save()
  dataChanged()
}

async function removeGame(id: string, clearLogin: boolean): Promise<void> {
  const game = findGame(id)
  if (!game) return
  if (active === id) open('today')
  views.destroy(id)
  store.data.games = store.data.games.filter((g) => g.id !== id)
  delete icons[id]
  removeCachedIcon(id)
  if (clearLogin) {
    const ses = gameSession(id)
    await ses.clearStorageData()
    await ses.clearCache()
  }
  store.save() // lo storico resta: se riaggiungi il gioco ritrovi le statistiche
  showToast(`${game.name} eliminato dalla raccolta`)
  dataChanged()
}

/** Stesso sito e stessa pagina (ignorando www e la barra finale). */
function samePage(a: string, b: URL): boolean {
  const u = new URL(a)
  const host = (h: string) => h.replace(/^www\./, '')
  const path = (p: string) => p.replace(/\/$/, '')
  return host(u.hostname) === host(b.hostname) && path(u.pathname) === path(b.pathname)
}

async function addGame(input: string): Promise<AddGameResult> {
  const url = normalizeUrl(String(input))
  if (!url) return { ok: false, error: 'Indirizzo non valido. Esempio: https://www.nytimes.com/games/wordle' }
  const dup = store.data.games.find((g) => samePage(g.url, url))
  if (dup) return { ok: false, error: `${dup.name} è già nella raccolta.` }
  let warning: string | undefined
  // Uno dei giochi iniziali eliminato e poi riaggiunto torna con il suo tema curato.
  const known = DEFAULT_GAMES.find((g) => samePage(g.url, url))
  let game = known && structuredClone(known)
  if (game) {
    const g = game
    void fetchIcon(g).then((data) => {
      if (data) {
        icons[g.id] = data
        broadcast()
      }
    })
  } else {
    const built = await buildGame(url, store.data.games)
    game = built.game
    warning = built.warning
    if (built.icon) icons[game.id] = built.icon
  }
  store.data.games.push(game)
  store.save()
  showToast(`${game.name} aggiunto alla raccolta`)
  dataChanged()
  return { ok: true, game, warning }
}

// ---- esporta / importa ----

async function exportData(): Promise<{ ok: boolean; path?: string; error?: string }> {
  const res = await dialog.showSaveDialog(win, {
    title: 'Esporta i dati di Daily Games',
    defaultPath: join(app.getPath('documents'), `daily-games-backup-${dayKey}.json`),
    filters: [{ name: 'Backup Daily Games', extensions: ['json'] }]
  })
  if (res.canceled || !res.filePath) return { ok: false }
  try {
    writeFileSync(res.filePath, JSON.stringify(store.toExport(), null, 2), 'utf8')
    showToast('Dati esportati')
    broadcast()
    return { ok: true, path: res.filePath }
  } catch (err) {
    return { ok: false, error: `Impossibile salvare il file: ${(err as Error).message}` }
  }
}

async function importData(): Promise<{ ok: boolean; error?: string; canceled?: boolean }> {
  const res = await dialog.showOpenDialog(win, {
    title: 'Importa un backup di Daily Games',
    defaultPath: app.getPath('documents'),
    filters: [{ name: 'Backup Daily Games', extensions: ['json'] }],
    properties: ['openFile']
  })
  if (res.canceled || !res.filePaths[0]) return { ok: false, canceled: true }
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(res.filePaths[0], 'utf8'))
  } catch {
    return { ok: false, error: 'Il file non è leggibile (non è un JSON valido).' }
  }
  const problem = validateExport(parsed)
  if (problem) return { ok: false, error: problem }
  const file = parsed as ExportFile
  const confirm = await dialog.showMessageBox(win, {
    type: 'question',
    title: 'Importa backup',
    message: 'Sostituire raccolta, statistiche e impostazioni con quelle del backup?',
    detail: `Il backup contiene ${file.games.length} giochi e ${Object.keys(file.days).length} giorni di storico. I dati attuali vengono prima salvati in una copia di sicurezza. Gli accessi ai giochi non fanno parte del backup.`,
    buttons: ['Importa', 'Annulla'],
    defaultId: 0,
    cancelId: 1
  })
  if (confirm.response !== 0) return { ok: false, canceled: true }
  const before = store.data.games.map((g) => g.id)
  store.importFrom(file)
  for (const id of before) if (!findGame(id)) views.destroy(id)
  nativeTheme.themeSource = store.data.settings.themeMode
  open('today')
  loadIcons()
  showToast('Backup importato')
  dataChanged()
  return { ok: true }
}

/** Scorciatoie valide ovunque, anche quando il focus è dentro un gioco. */
function handleInput(event: Event, input: Input): void {
  if (input.type !== 'keyDown') return
  const ctrl = input.control || input.meta
  const games = visibleGames()
  if (ctrl && input.shift && input.key.toLowerCase() === 's') {
    event.preventDefault()
    open('stats')
    return
  }
  if (ctrl && !input.shift && !input.alt && /^[0-9]$/.test(input.key)) {
    event.preventDefault()
    const n = Number(input.key)
    if (n === 0) open('today')
    else if (games[n - 1]) open(games[n - 1].id)
    return
  }
  if (ctrl && input.key === 'Tab') {
    event.preventDefault()
    const order: AppState['active'][] = ['today', ...games.map((g) => g.id)]
    const i = order.indexOf(active)
    open(order[(i + (input.shift ? -1 : 1) + order.length) % order.length])
    return
  }
  if (ctrl && input.key.toLowerCase() === 'n' && !input.shift) {
    event.preventDefault()
    openNext()
    return
  }
  const game = findGame(active)
  if (game && (input.key === 'F5' || (ctrl && input.key.toLowerCase() === 'r'))) {
    event.preventDefault()
    views.action(game, 'reload')
  } else if (game && input.alt && input.key === 'ArrowLeft') {
    event.preventDefault()
    views.action(game, 'back')
  } else if (input.key === 'F12' || (ctrl && input.shift && input.key.toLowerCase() === 'i')) {
    event.preventDefault()
    if (game) views.toggleDevTools(game.id)
    else shellView.webContents.toggleDevTools()
  }
}

function setThemeMode(mode: ThemeMode): void {
  store.data.settings.themeMode = mode
  nativeTheme.themeSource = mode
  store.save()
  broadcast()
}

function registerIpc(): void {
  ipcMain.handle('get-state', () => snapshot())
  ipcMain.on('open', (_e, target: string) => open(target))
  ipcMain.on('next', () => openNext())
  ipcMain.on('content-bounds', (_e, rect: Rect | null) => {
    contentBounds = rect
    applyLayout()
  })
  ipcMain.on('set-played', (_e, gameId: string, played: boolean) => {
    if (!findGame(gameId)) return
    store.setPlayed(dayKey, gameId, played)
    dataChanged()
  })
  ipcMain.handle('get-days', () => store.data.days)
  ipcMain.handle('parse-result', (_e, text: string): ParsePreview => {
    const found = detectResult(String(text), visibleGames())
    return found ? { gameId: found.gameId, result: found.result } : {}
  })
  ipcMain.on('save-result', (_e, gameId: string, text: string) => {
    const game = findGame(gameId)
    if (!game || !String(text).trim()) return
    const previous = store.day(dayKey)[gameId]
    lastCapture = { dayKey, gameId, previous: previous && structuredClone(previous) }
    const result = parseFor(game, String(text))
    store.setResult(dayKey, gameId, result)
    showToast(`${game.name}: ${summarize(result)}`, { gameId, undo: true })
    dataChanged()
  })
  ipcMain.on('undo-result', () => undoCapture())
  ipcMain.on('dismiss-toast', (_e, id: number) => {
    if (toast?.id !== id) return
    toast = undefined
    broadcast()
  })
  ipcMain.handle('share-day', async () => {
    const text = buildDayMessage()
    await watcher.write(text)
    showToast('Riepilogo copiato: incollalo su WhatsApp')
    broadcast()
    return text
  })
  // Testo copiato da un gioco (dal suo pulsante "Condividi").
  ipcMain.on('game-copy', (e, text: string) => {
    const gameId = views.gameIdOf(e.sender.id)
    if (!gameId || typeof text !== 'string') return
    watcher.seen(text)
    capture(text, gameId)
  })
  ipcMain.on('game-action', (_e, gameId: string, action: GameAction) => {
    const game = findGame(gameId)
    if (game) views.action(game, action)
  })
  ipcMain.on('theme-mode', (_e, mode: ThemeMode) => setThemeMode(mode))
  ipcMain.on('dismiss-notice', () => {
    notice = undefined
    broadcast()
  })
  ipcMain.handle('add-game', (_e, url: string) => addGame(url))
  ipcMain.on('update-game', (_e, id: string, patch: GamePatch) => updateGame(id, patch ?? {}))
  ipcMain.on('reorder-games', (_e, ids: string[]) => Array.isArray(ids) && reorderGames(ids))
  ipcMain.on('remove-game', (_e, id: string, clearLogin: boolean) => void removeGame(id, !!clearLogin))
  ipcMain.on('update-settings', (_e, patch: Partial<UserSettings>) => updateSettings(patch ?? {}))
  ipcMain.on('test-reminder', () =>
    notify('Daily Games', remainingGames().length ? reminderText() : 'Hai già finito i giochi di oggi!', showWindow)
  )
  ipcMain.handle('export-data', () => exportData())
  ipcMain.handle('import-data', () => importData())
}

function loadIcons(): void {
  for (const game of store.data.games) {
    const cached = cachedIcon(game.id)
    if (cached) icons[game.id] = cached
    void fetchIcon(game).then((data) => {
      if (data && data !== icons[game.id]) {
        icons[game.id] = data
        broadcast()
      }
    })
  }
}

function createWindow(): void {
  const saved = store.data.settings.window
  // Se lo schermo salvato non esiste più (es. monitor scollegato) si riparte centrati.
  const onScreen =
    saved?.x !== undefined &&
    saved.y !== undefined &&
    screen.getAllDisplays().some((d) => {
      const a = d.workArea
      return saved.x! >= a.x - 50 && saved.y! >= a.y - 50 && saved.x! < a.x + a.width && saved.y! < a.y + a.height
    })

  win = new BaseWindow({
    width: saved?.width ?? 1280,
    height: saved?.height ?? 820,
    x: onScreen ? saved?.x : undefined,
    y: onScreen ? saved?.y : undefined,
    minWidth: 640,
    minHeight: 480,
    title: 'Daily Games',
    icon: appIcon(),
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0E1116' : '#F6F7F9',
    show: false
  })
  if (saved?.maximized) win.maximize()

  shellView = new WebContentsView({
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  shellView.setBackgroundColor('#00000000')
  win.contentView.addChildView(shellView)
  views = new GameViews(win, {
    onStatus: () => {
      applyLayout()
      broadcast()
    },
    onGoogleBlocked: (gameId) => {
      notice = {
        gameId,
        text: 'Google ha bloccato l’accesso da questa app. Puoi aprire il gioco nel tuo browser.'
      }
      broadcast()
    },
    onInput: handleInput
  })

  const fitShell = () => {
    const { width, height } = win.getContentBounds()
    shellView.setBounds({ x: 0, y: 0, width, height })
  }
  fitShell()
  win.on('resize', fitShell)
  win.on('maximize', fitShell)
  win.on('unmaximize', fitShell)

  const wc = shellView.webContents
  wc.on('before-input-event', handleInput)
  // L'interfaccia non naviga mai altrove: eventuali link vanno nel browser.
  wc.setWindowOpenHandler(({ url }) => {
    if (isHttp(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  wc.on('will-navigate', (e) => e.preventDefault())
  wc.once('did-finish-load', () => {
    if (!startedHidden) win.show()
  })

  watcher = new ClipboardWatcher(win, (text) => capture(text))

  if (process.env.ELECTRON_RENDERER_URL) void wc.loadURL(process.env.ELECTRON_RENDERER_URL)
  else void wc.loadFile(join(__dirname, '../renderer/index.html'))

  win.on('close', (e) => {
    const b = win.getNormalBounds()
    store.data.settings.window = { ...b, maximized: win.isMaximized() }
    store.flush()
    // Con l'opzione attiva la finestra si nasconde: il promemoria continua a funzionare.
    if (!quitting && store.data.settings.closeToTray) {
      e.preventDefault()
      win.hide()
      if (!trayHintShown) {
        trayHintShown = true
        notify('Daily Games è ancora attivo', 'Lo trovi nell’area di notifica, vicino all’orologio. Per chiuderlo davvero: tasto destro → Esci.')
      }
    }
  })
  win.on('closed', () => quitApp())
}

app.on('second-instance', () => {
  if (win) showWindow()
})

app.on('before-quit', () => {
  quitting = true
})

app.whenReady().then(() => {
  store = new Store()
  nativeTheme.themeSource = store.data.settings.themeMode
  nativeTheme.on('updated', () => broadcast())
  registerIpc()
  createWindow()
  tray = createTray({ show: showWindow, next: () => (showWindow(), openNext()), quit: quitApp })
  loadIcons()
  // Allinea l'avvio automatico con l'impostazione (es. dopo aver spostato l'exe).
  if (store.data.settings.openAtLogin) setOpenAtLogin(true)
  watchDayChange((key) => {
    dayKey = key
    lastCapture = undefined
    dataChanged()
  })
  checkReminder()
  setInterval(checkReminder, 30_000)
})

app.on('window-all-closed', () => app.quit())

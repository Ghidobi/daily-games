import { BaseWindow, Menu, WebContentsView, app, ipcMain, nativeTheme, screen, shell } from 'electron'
import type { Event, Input } from 'electron'
import { join } from 'node:path'
import type { AppState, DayEntry, GameAction, PageId, ParsePreview, Rect, ThemeMode } from '@shared/types'
import { compactForShare, detectResult, parseFor, summarize } from '@shared/results'
import { streaks } from '@shared/stats'
import { ClipboardWatcher } from './capture'
import { romeDayKey, watchDayChange } from './day'
import { GameViews } from './gameViews'
import { cachedIcon, fetchIcon } from './icons'
import { Store } from './store'
import { chromeUserAgent, isHttp } from './web'

// Profilo separato per prove e sviluppo: DAILY_GAMES_PROFILE=C:\percorso\cartella
if (process.env.DAILY_GAMES_PROFILE) app.setPath('userData', process.env.DAILY_GAMES_PROFILE)

if (!app.requestSingleInstanceLock()) app.quit()

// Anche le richieste fuori dalle viste dei giochi (es. download delle icone) usano un UA standard.
app.userAgentFallback = chromeUserAgent()
Menu.setApplicationMenu(null)

let win: BaseWindow
let shellView: WebContentsView
let views: GameViews
let store: Store

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
const PAGES: PageId[] = ['today', 'stats']

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
  wc.once('did-finish-load', () => win.show())

  watcher = new ClipboardWatcher(win, (text) => capture(text))

  if (process.env.ELECTRON_RENDERER_URL) void wc.loadURL(process.env.ELECTRON_RENDERER_URL)
  else void wc.loadFile(join(__dirname, '../renderer/index.html'))

  win.on('close', () => {
    const b = win.getNormalBounds()
    store.data.settings.window = { ...b, maximized: win.isMaximized() }
    store.flush()
  })
  win.on('closed', () => app.quit())
}

app.on('second-instance', () => {
  if (!win) return
  if (win.isMinimized()) win.restore()
  win.focus()
})

app.whenReady().then(() => {
  store = new Store()
  nativeTheme.themeSource = store.data.settings.themeMode
  nativeTheme.on('updated', () => broadcast())
  registerIpc()
  createWindow()
  loadIcons()
  watchDayChange((key) => {
    dayKey = key
    lastCapture = undefined
    dataChanged()
  })
})

app.on('window-all-closed', () => app.quit())

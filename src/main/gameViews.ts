import { BaseWindow, BrowserWindow, WebContentsView, dialog, session, shell } from 'electron'
import type { Event, Input, Session, WebContents } from 'electron'
import type { Game, GameAction, GameViewStatus, Rect } from '@shared/types'
import {
  chromeClientHints,
  chromeUserAgent,
  isAuthUrl,
  isGoogleRejection,
  isHttp,
  isSameSite
} from './web'

interface Hooks {
  onStatus(): void
  onGoogleBlocked(gameId: string): void
  onInput(event: Event, input: Input): void
}

const configuredSessions = new WeakSet<Session>()

/** Sessione persistente dedicata a un gioco: cookie e localStorage restano tra un avvio e l'altro. */
export function gameSession(gameId: string): Session {
  const ses = session.fromPartition(`persist:game-${gameId}`)
  if (!configuredSessions.has(ses)) {
    configuredSessions.add(ses)
    ses.setUserAgent(chromeUserAgent())
    // Sulle pagine Google ci presentiamo come un Chrome normale anche negli header Client Hints.
    ses.webRequest.onBeforeSendHeaders({ urls: ['https://*.google.com/*'] }, (details, cb) => {
      const headers = details.requestHeaders
      for (const key of Object.keys(headers)) {
        if (key.toLowerCase() === 'sec-ch-ua') headers[key] = chromeClientHints()
      }
      cb({ requestHeaders: headers })
    })
    // Le viste dei giochi non ricevono permessi speciali (notifiche, posizione, ecc.).
    ses.setPermissionRequestHandler((_wc, permission, cb) =>
      cb(permission === 'clipboard-sanitized-write' || permission === 'fullscreen')
    )
  }
  return ses
}

function openExternal(url: string): void {
  if (isHttp(url)) void shell.openExternal(url)
}

/** Gestisce una WebContentsView per ogni gioco, creata alla prima apertura e poi tenuta viva. */
export class GameViews {
  private views = new Map<string, WebContentsView>()
  readonly status: Record<string, GameViewStatus> = {}
  private visibleId: string | null = null

  constructor(
    private win: BaseWindow,
    private hooks: Hooks
  ) {}

  private create(game: Game): WebContentsView {
    const view = new WebContentsView({
      webPreferences: {
        session: gameSession(game.id),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false
      }
    })
    view.setBackgroundColor(game.theme.bg)
    view.setVisible(false)
    this.win.contentView.addChildView(view)
    this.views.set(game.id, view)
    this.status[game.id] = { loaded: false, loading: true, canGoBack: false }
    this.wire(game, view.webContents)
    void view.webContents.loadURL(game.url)
    return view
  }

  private wire(game: Game, wc: WebContents): void {
    const update = (patch: Partial<GameViewStatus>) => {
      this.status[game.id] = {
        ...this.status[game.id],
        canGoBack: wc.navigationHistory.canGoBack(),
        ...patch
      }
      this.hooks.onStatus()
    }
    wc.on('did-start-loading', () => update({ loading: true, error: undefined }))
    wc.on('did-stop-loading', () => update({ loading: false, loaded: true }))
    wc.on('did-fail-load', (_e, code, description, _url, isMainFrame) => {
      // -3 = caricamento interrotto (es. nuova navigazione): non è un errore.
      if (isMainFrame && code !== -3) update({ loading: false, error: description || `Errore ${code}` })
    })
    wc.on('did-navigate', (_e, url) => {
      update({})
      if (isGoogleRejection(url)) this.hooks.onGoogleBlocked(game.id)
    })
    wc.on('did-navigate-in-page', () => update({}))
    wc.on('before-input-event', this.hooks.onInput)

    // Navigazioni verso altri siti (pubblicità, social) → browser predefinito.
    wc.on('will-navigate', (event) => {
      if (!isSameSite(event.url, game.url) && !isAuthUrl(event.url) && !isSameSite(event.url, wc.getURL())) {
        event.preventDefault()
        openExternal(event.url)
      }
    })

    // Popup: quelli di login restano nell'app, nella stessa sessione del gioco; il resto va nel browser.
    wc.setWindowOpenHandler(({ url }) => {
      if (isAuthUrl(url) || isSameSite(url, game.url)) {
        return {
          action: 'allow',
          overrideBrowserWindowOptions: {
            width: 520,
            height: 720,
            autoHideMenuBar: true,
            title: `Accesso – ${game.name}`,
            backgroundColor: '#ffffff',
            webPreferences: { session: gameSession(game.id), sandbox: true, contextIsolation: true }
          }
        }
      }
      openExternal(url)
      return { action: 'deny' }
    })
    wc.on('did-create-window', (popup) => this.wirePopup(game, popup))
  }

  private wirePopup(game: Game, popup: BrowserWindow): void {
    popup.setMenu(null)
    const wc = popup.webContents
    wc.setWindowOpenHandler(({ url }) => {
      openExternal(url)
      return { action: 'deny' }
    })
    wc.on('did-navigate', (_e, url) => {
      if (!isGoogleRejection(url)) return
      popup.close()
      this.hooks.onGoogleBlocked(game.id)
      void dialog
        .showMessageBox(this.win, {
          type: 'warning',
          title: 'Accesso con Google bloccato',
          message: 'Google non permette l’accesso da questa finestra.',
          detail: `Puoi giocare a ${game.name} nel tuo browser predefinito, dove l’accesso con Google funziona.`,
          buttons: ['Apri nel browser', 'Annulla'],
          defaultId: 0,
          cancelId: 1
        })
        .then(({ response }) => {
          if (response === 0) openExternal(game.url)
        })
    })
  }

  /** Mostra il gioco nell'area indicata (o lo nasconde se `bounds` è null). */
  show(game: Game, bounds: Rect | null): void {
    const view = this.views.get(game.id) ?? this.create(game)
    for (const [id, v] of this.views) if (id !== game.id) v.setVisible(false)
    if (!bounds || this.status[game.id]?.error) {
      view.setVisible(false)
      this.visibleId = null
      return
    }
    view.setBounds(roundRect(bounds))
    view.setVisible(true)
    if (this.visibleId !== game.id) view.webContents.focus()
    this.visibleId = game.id
  }

  hideAll(): void {
    for (const v of this.views.values()) v.setVisible(false)
    this.visibleId = null
  }

  action(game: Game, action: GameAction): void {
    const wc = this.views.get(game.id)?.webContents
    if (action === 'external') {
      openExternal(wc?.getURL() || game.url)
      return
    }
    if (!wc) return
    if (action === 'back' && wc.navigationHistory.canGoBack()) wc.navigationHistory.goBack()
    if (action === 'reload') {
      this.status[game.id] = { ...this.status[game.id], error: undefined }
      wc.getURL() ? wc.reload() : void wc.loadURL(game.url)
    }
    if (action === 'home') void wc.loadURL(game.url)
  }

  toggleDevTools(gameId: string): void {
    this.views.get(gameId)?.webContents.toggleDevTools()
  }

  destroy(gameId: string): void {
    const view = this.views.get(gameId)
    if (!view) return
    this.win.contentView.removeChildView(view)
    view.webContents.close()
    this.views.delete(gameId)
    delete this.status[gameId]
  }
}

function roundRect(r: Rect): Rect {
  return {
    x: Math.round(r.x),
    y: Math.round(r.y),
    width: Math.max(0, Math.round(r.width)),
    height: Math.max(0, Math.round(r.height))
  }
}

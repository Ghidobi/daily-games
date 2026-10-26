import { app, ipcMain, net } from 'electron'
import type { IpcMainInvokeEvent, OnBeforeRequestListenerDetails, OnHeadersReceivedListenerDetails, Session } from 'electron'
import { ElectronBlocker, adsAndTrackingLists, fromElectronDetails } from '@ghostery/adblocker-electron'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// Blocco della pubblicità e dei tracker nelle schede dei giochi, con il motore di
// @ghostery/adblocker-electron. Non usiamo il suo enableBlockingInSession: registra gestori
// IPC globali una volta per sessione (con più sessioni va in errore) e non permette eccezioni.
// Qui ogni sessione di gioco ha i suoi filtri di rete e il preload cosmetico, e ogni richiesta
// passa prima dalle nostre regole (blocco attivo per il gioco? dominio escluso? login del sito?).

/** EasyList, EasyPrivacy, filtri di uBlock Origin (inclusi "unbreak" e "quick-fixes") e Peter Lowe. */
export const FILTER_LISTS = adsAndTrackingLists

/** Domini di accesso esclusi di base (modificabili nelle impostazioni). */
export const DEFAULT_ALLOWLIST = [
  'accounts.google.com',
  'accounts.youtube.com',
  'apis.google.com',
  'www.gstatic.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'firebaseapp.com',
  'appleid.apple.com',
  'appleid.cdn-apple.com',
  'idmsa.apple.com',
  'login.microsoftonline.com',
  'login.live.com',
  'discord.com',
  'github.com'
]

/** Percorsi tipici dei login sul sito stesso del gioco: non vengono mai bloccati. */
const AUTH_PATH = /\/(auth|oauth2?|login|logout|signin|sign-in|signup|session|token|account|identity|sso|callback)\b/i

const DAY = 24 * 60 * 60 * 1000
const dir = () => join(app.getPath('userData'), 'adblock')
const listFile = (i: number) => join(dir(), `list-${i}.txt`)
const engineFile = () => join(dir(), 'engine.bin')

export interface AdblockHooks {
  /** Il blocco è attivo per questo gioco (interruttore generale + interruttore del gioco)? */
  isActive(gameId: string): boolean
  allowlist(): string[]
  /** Indirizzo del gioco (per riconoscere i login sul suo sito). */
  gameUrl(gameId: string): string | undefined
  onBlocked(gameId: string): void
  onStatus(): void
}

export interface AdblockStatus {
  ready: boolean
  updating: boolean
  /** ISO timestamp dell'ultimo aggiornamento riuscito delle liste. */
  updatedAt?: string
  filters?: number
  error?: string
}

const hostOf = (url: string | undefined) => {
  if (!url) return ''
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return ''
  }
}

const siteOf = (host: string) => host.split('.').slice(-2).join('.')

const matchesDomain = (host: string, domains: string[]) =>
  !!host && domains.some((d) => host === d || host.endsWith(`.${d}`))

export class Adblock {
  private engine: ElectronBlocker | undefined
  private sessions = new Map<Session, string>()
  private refreshTimer: NodeJS.Timeout | undefined
  readonly status: AdblockStatus = { ready: false, updating: false }

  constructor(private hooks: AdblockHooks) {
    // Il preload cosmetico di Ghostery chiede gli stili da iniettare con questi due canali.
    ipcMain.handle('@ghostery/adblocker/inject-cosmetic-filters', (event: IpcMainInvokeEvent, url: string, msg?: unknown) => {
      const gameId = this.sessions.get(event.sender.session)
      if (!this.engine || !gameId || !this.allowedToFilter(gameId, url, event.sender.getURL())) return
      return this.engine.onInjectCosmeticFilters(event, url, msg as never)
    })
    ipcMain.handle('@ghostery/adblocker/is-mutation-observer-enabled', () => this.engine?.config.enableMutationObserver ?? false)
  }

  /** Carica il motore salvato (veloce) e programma l'aggiornamento giornaliero delle liste. */
  init(): void {
    try {
      if (existsSync(engineFile())) {
        this.engine = ElectronBlocker.deserialize(new Uint8Array(readFileSync(engineFile())))
        this.status.ready = true
        this.status.updatedAt = statSync(engineFile()).mtime.toISOString()
        this.status.filters = this.countFilters()
      }
    } catch {
      // Cache illeggibile o di una versione precedente della libreria: si ricostruisce.
      this.engine = undefined
    }
    const age = this.status.updatedAt ? Date.now() - Date.parse(this.status.updatedAt) : Infinity
    setTimeout(() => void this.refresh(), age > DAY ? 2_000 : age === Infinity ? 0 : DAY - age)
    this.refreshTimer = setInterval(() => void this.refresh(), DAY)
  }

  private countFilters(): number | undefined {
    try {
      const f = this.engine?.getFilters()
      return f ? f.networkFilters.length + f.cosmeticFilters.length : undefined
    } catch {
      return undefined
    }
  }

  /** Scarica le liste; quelle che non si scaricano restano all'ultima copia salvata. */
  async refresh(): Promise<void> {
    if (this.status.updating) return
    this.status.updating = true
    this.hooks.onStatus()
    mkdirSync(dir(), { recursive: true })
    const texts = await Promise.all(
      FILTER_LISTS.map(async (url, i) => {
        try {
          const res = await net.fetch(url, { signal: AbortSignal.timeout(30_000) })
          if (!res.ok) throw new Error(String(res.status))
          const text = await res.text()
          writeFileSync(listFile(i), text, 'utf8')
          return { text, fresh: true }
        } catch {
          return existsSync(listFile(i)) ? { text: readFileSync(listFile(i), 'utf8'), fresh: false } : { text: '', fresh: false }
        }
      })
    )
    const fresh = texts.filter((t) => t.fresh).length
    try {
      if (fresh > 0 || !this.engine) {
        const all = texts.map((t) => t.text).join('\n')
        if (!all.trim()) throw new Error('nessuna lista disponibile')
        const engine = ElectronBlocker.parse(all, {
          loadCosmeticFilters: true,
          loadNetworkFilters: true,
          enableCompression: true,
          guessRequestTypeFromUrl: true
        })
        writeFileSync(engineFile(), engine.serialize())
        this.engine = engine
        this.status.updatedAt = new Date().toISOString()
        this.status.filters = this.countFilters()
      }
      this.status.ready = true
      this.status.error = fresh === 0 ? 'Liste non aggiornate (niente connessione?): uso l’ultima copia salvata.' : undefined
    } catch (err) {
      this.status.error = `Liste dei filtri non disponibili: ${(err as Error).message}`
    } finally {
      this.status.updating = false
      this.hooks.onStatus()
    }
  }

  /** false se la pagina o il gioco sono esclusi dal blocco. */
  private allowedToFilter(gameId: string, ...urls: (string | undefined)[]): boolean {
    if (!this.hooks.isActive(gameId)) return false
    const allow = this.hooks.allowlist()
    return !urls.some((u) => matchesDomain(hostOf(u), allow))
  }

  /** Collega il blocco alla sessione di un gioco (anche quelli aggiunti dopo o in prova). */
  attach(ses: Session, gameId: string): void {
    if (this.sessions.has(ses)) return
    this.sessions.set(ses, gameId)
    // Il preload cosmetico resta registrato: decide il gestore IPC se iniettare o no.
    ses.registerPreloadScript({ type: 'frame', filePath: require.resolve('@ghostery/adblocker-electron-preload') })
    ses.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, (details, callback) => this.onBeforeRequest(gameId, details, callback))
    ses.webRequest.onHeadersReceived({ urls: ['<all_urls>'] }, (details, callback) => this.onHeadersReceived(gameId, details, callback))
  }

  private onBeforeRequest(
    gameId: string,
    details: OnBeforeRequestListenerDetails,
    callback: (response: Electron.CallbackResponse) => void
  ): void {
    const engine = this.engine
    const page = details.webContents?.getURL()
    if (!engine || details.resourceType === 'mainFrame' || !this.allowedToFilter(gameId, details.url, page, details.frame?.url)) {
      return callback({})
    }
    // I login sul sito stesso del gioco non si toccano.
    const host = hostOf(details.url)
    const game = hostOf(this.hooks.gameUrl(gameId))
    if (game && siteOf(host) === siteOf(game) && AUTH_PATH.test(new URL(details.url).pathname)) return callback({})

    const request = fromElectronDetails(details as never)
    if (request.type === 'other') request.guessTypeOfRequest()
    const { redirect, match } = engine.match(request)
    if (redirect) {
      this.hooks.onBlocked(gameId)
      callback({ redirectURL: redirect.dataUrl })
    } else if (match) {
      this.hooks.onBlocked(gameId)
      callback({ cancel: true })
    } else callback({})
  }

  private onHeadersReceived(
    gameId: string,
    details: OnHeadersReceivedListenerDetails,
    callback: (response: Electron.HeadersReceivedResponse) => void
  ): void {
    if (!this.engine || !this.allowedToFilter(gameId, details.url, details.webContents?.getURL())) return callback({})
    this.engine.onHeadersReceived(details as never, callback)
  }

  dispose(): void {
    clearInterval(this.refreshTimer)
  }
}

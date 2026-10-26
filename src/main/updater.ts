import { app, shell } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { UpdateStatus } from '@shared/types'
import { isPortable } from './system'

// Aggiornamenti tramite GitHub Releases (configurati in package.json → build.publish).
// L'installazione automatica funziona solo con l'installer Windows: la versione portatile e
// quella per Mac (non firmata) ricevono solo l'avviso con il link alla pagina di download.

export const RELEASES_URL = 'https://github.com/Ghidobi/daily-games/releases/latest'

const CHECK_EVERY = 6 * 60 * 60 * 1000

/** true se l'app può scaricare e installare da sola gli aggiornamenti. */
export const canAutoInstall = () => app.isPackaged && process.platform === 'win32' && !isPortable

let status: UpdateStatus = { state: 'idle' }

export function updateStatus(): UpdateStatus {
  return status
}

export function setupUpdater(onChange: () => void): void {
  const set = (s: UpdateStatus) => {
    status = s
    onChange()
  }
  if (!app.isPackaged) {
    status = { state: 'unsupported', reason: 'In modalità sviluppo gli aggiornamenti sono disattivati.' }
    return
  }
  autoUpdater.autoDownload = canAutoInstall()
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.logger = null

  autoUpdater.on('checking-for-update', () => set({ ...status, state: 'checking' }))
  autoUpdater.on('update-not-available', () => set({ state: 'latest', checkedAt: new Date().toISOString() }))
  autoUpdater.on('update-available', (info) =>
    set(canAutoInstall() ? { state: 'downloading', version: info.version, percent: 0 } : { state: 'available', version: info.version })
  )
  autoUpdater.on('download-progress', (p) => {
    if (status.state === 'downloading') set({ ...status, percent: Math.round(p.percent) })
  })
  autoUpdater.on('update-downloaded', (info) => set({ state: 'ready', version: info.version }))
  autoUpdater.on('error', (err) =>
    // Senza connessione o con GitHub irraggiungibile non è un problema: si riprova più tardi.
    set({ state: 'error', error: err?.message?.split('\n')[0] ?? 'Errore sconosciuto' })
  )

  setTimeout(() => void checkForUpdates(), 10_000)
  setInterval(() => void checkForUpdates(), CHECK_EVERY)
}

export async function checkForUpdates(): Promise<void> {
  if (!app.isPackaged || status.state === 'downloading' || status.state === 'ready') return
  try {
    await autoUpdater.checkForUpdates()
  } catch {
    /* già gestito dall'evento 'error' */
  }
}

/** Chiude l'app e installa l'aggiornamento scaricato. */
export function installUpdate(): void {
  if (status.state === 'ready') autoUpdater.quitAndInstall(false, true)
}

export function openReleases(): void {
  void shell.openExternal(RELEASES_URL)
}

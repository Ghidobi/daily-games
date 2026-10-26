import { Menu, Notification, Tray, app, nativeImage } from 'electron'
import type { NativeImage } from 'electron'
import { join } from 'node:path'

// Integrazione con Windows: icona dell'app, area di notifica, notifiche, avvio automatico.

export const APP_ID = 'app.dailygames.desktop'

/** Icona dell'app: build/icon.png in sviluppo, copiata tra le risorse nel pacchetto. */
export function appIcon(): NativeImage {
  const file = app.isPackaged ? join(process.resourcesPath, 'icon.png') : join(app.getAppPath(), 'build', 'icon.png')
  return nativeImage.createFromPath(file)
}

/** Avviata con Windows: parte ridotta nell'area di notifica. */
export const startedHidden = process.argv.includes('--hidden')

/** Percorso dell'exe da avviare con Windows (la versione portatile si estrae ogni volta altrove). */
const launcherPath = () => process.env.PORTABLE_EXECUTABLE_FILE ?? process.execPath
export const isPortable = !!process.env.PORTABLE_EXECUTABLE_FILE

export function setOpenAtLogin(enabled: boolean): void {
  if (!app.isPackaged) return // in sviluppo avvierebbe Electron senza l'app
  app.setLoginItemSettings({ openAtLogin: enabled, path: launcherPath(), args: ['--hidden'] })
}

export interface TrayActions {
  show(): void
  next(): void
  quit(): void
}

export function createTray(actions: TrayActions): Tray {
  const tray = new Tray(appIcon().resize({ width: 32, height: 32 }))
  tray.setToolTip('Daily Games')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Apri Daily Games', click: actions.show },
      { label: 'Prossimo gioco', click: actions.next },
      { type: 'separator' },
      { label: 'Esci', click: actions.quit }
    ])
  )
  tray.on('click', actions.show)
  return tray
}

export function notify(title: string, body: string, onClick?: () => void): void {
  if (!Notification.isSupported()) return
  const n = new Notification({ title, body, icon: appIcon() })
  if (onClick) n.on('click', onClick)
  n.show()
}

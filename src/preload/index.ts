import { contextBridge, ipcRenderer } from 'electron'
import type { Api, AppState } from '@shared/types'

// Unico ponte tra l'interfaccia e il processo principale: solo queste funzioni.
const api: Api = {
  getState: () => ipcRenderer.invoke('get-state'),
  onState: (cb) => {
    const listener = (_e: unknown, state: AppState) => cb(state)
    ipcRenderer.on('state', listener)
    return () => ipcRenderer.removeListener('state', listener)
  },
  open: (target) => ipcRenderer.send('open', target),
  next: () => ipcRenderer.send('next'),
  setContentBounds: (rect) => ipcRenderer.send('content-bounds', rect),
  setPlayed: (gameId, played) => ipcRenderer.send('set-played', gameId, played),
  gameAction: (gameId, action) => ipcRenderer.send('game-action', gameId, action),
  setThemeMode: (mode) => ipcRenderer.send('theme-mode', mode),
  dismissNotice: () => ipcRenderer.send('dismiss-notice'),
  getDays: () => ipcRenderer.invoke('get-days'),
  parseResult: (text) => ipcRenderer.invoke('parse-result', text),
  saveResult: (gameId, text) => ipcRenderer.send('save-result', gameId, text),
  undoResult: () => ipcRenderer.send('undo-result'),
  dismissToast: (id) => ipcRenderer.send('dismiss-toast', id),
  shareDay: () => ipcRenderer.invoke('share-day')
}

contextBridge.exposeInMainWorld('api', api)

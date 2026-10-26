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
  shareDay: () => ipcRenderer.invoke('share-day'),
  addGame: (url) => ipcRenderer.invoke('add-game', url),
  updateGame: (id, patch) => ipcRenderer.send('update-game', id, patch),
  reorderGames: (ids) => ipcRenderer.send('reorder-games', ids),
  removeGame: (id, clearLogin) => ipcRenderer.send('remove-game', id, clearLogin),
  updateSettings: (patch) => ipcRenderer.send('update-settings', patch),
  testReminder: () => ipcRenderer.send('test-reminder'),
  exportData: () => ipcRenderer.invoke('export-data'),
  importData: () => ipcRenderer.invoke('import-data'),
  setApiKey: (key) => ipcRenderer.invoke('set-api-key', key),
  removeApiKey: () => ipcRenderer.send('remove-api-key'),
  discover: () => ipcRenderer.invoke('discover'),
  trySuggestion: (id) => ipcRenderer.send('try-suggestion', id),
  addSuggestion: (id) => ipcRenderer.invoke('add-suggestion', id),
  discardSuggestion: (id) => ipcRenderer.send('discard-suggestion', id),
  restoreSuggestion: (id) => ipcRenderer.send('restore-suggestion', id),
  keepTrial: () => ipcRenderer.invoke('keep-trial'),
  closeTrial: () => ipcRenderer.send('close-trial'),
  checkUpdates: () => ipcRenderer.send('check-updates'),
  installUpdate: () => ipcRenderer.send('install-update'),
  openReleases: () => ipcRenderer.send('open-releases')
}

contextBridge.exposeInMainWorld('api', api)

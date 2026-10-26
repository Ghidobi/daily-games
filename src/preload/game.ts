import { contextBridge, ipcRenderer } from 'electron'

// Preload delle viste dei giochi. Non espone nulla al sito: osserva solo i testi che il
// gioco copia negli appunti, per registrare il risultato quando premi "Condividi".

const CHANNEL = '__dailyGamesCopy'

contextBridge.executeInMainWorld({
  func: (channel: string) => {
    // Su PC la condivisione nativa di Windows non lascia nulla negli appunti: togliendola,
    // i giochi usano il loro ripiego "copia negli appunti".
    const nav = Navigator.prototype as unknown as Record<string, unknown>
    for (const key of ['share', 'canShare']) {
      try {
        Object.defineProperty(nav, key, { value: undefined, configurable: true, writable: true })
      } catch {
        /* ignora */
      }
    }
    const proto = (window as unknown as { Clipboard?: { prototype: { writeText(t: string): Promise<void> } } })
      .Clipboard?.prototype
    if (proto?.writeText) {
      const original = proto.writeText
      proto.writeText = function (text: string) {
        try {
          window.postMessage({ [channel]: String(text) }, location.origin)
        } catch {
          /* ignora */
        }
        return original.call(this, text)
      }
    }
  },
  args: [CHANNEL]
})

window.addEventListener('message', (event) => {
  if (event.source !== window) return
  const text = (event.data as Record<string, unknown> | null)?.[CHANNEL]
  if (typeof text === 'string' && text.length <= 4000) ipcRenderer.send('game-copy', text)
})

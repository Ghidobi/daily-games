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

// Alcuni siti si accorgono del blocco della pubblicità e chiedono di disattivarlo:
// cerchiamo quei messaggi nel testo della pagina e avvisiamo l'app.
const ADBLOCK_WORDS = /ad.?block|blocco (della )?pubblicit|bloccatore di annunci/i
const ADBLOCK_ASK = /(disabl|turn off|whitelist|allowlist|detected|pause|disattiv|rilevat|sospend)/i
function checkAdblockNotice(): void {
  const text = document.body?.innerText?.slice(0, 20000) ?? ''
  for (const line of text.split('\n')) {
    if (ADBLOCK_WORDS.test(line) && ADBLOCK_ASK.test(line)) {
      ipcRenderer.send('adblock-detected', line.slice(0, 200))
      return
    }
  }
}
// Da DOMContentLoaded: l'evento 'load' può tardare molto sulle pagine con tante risorse.
window.addEventListener('DOMContentLoaded', () => {
  for (const ms of [2500, 8000, 20000]) setTimeout(checkAdblockNotice, ms)
})

window.addEventListener('message', (event) => {
  if (event.source !== window) return
  const text = (event.data as Record<string, unknown> | null)?.[CHANNEL]
  if (typeof text === 'string' && text.length <= 4000) ipcRenderer.send('game-copy', text)
})

import { BaseWindow, clipboard } from 'electron'

/**
 * Osserva gli appunti mentre l'app è in primo piano (Electron non ha un evento di modifica,
 * quindi un controllo al secondo). Integra il preload dei giochi, che avvisa subito quando
 * un gioco copia con navigator.clipboard; questo copre anche chi usa execCommand('copy')
 * o un risultato copiato da un gioco aperto nel browser.
 */
export class ClipboardWatcher {
  private last: string | undefined
  private timer: NodeJS.Timeout | undefined
  private busy = false

  constructor(
    win: BaseWindow,
    private onText: (text: string) => void
  ) {
    // Quello che c'era negli appunti all'avvio non è un risultato nuovo.
    void clipboard.readText().then((t) => (this.last ??= t)).catch(() => undefined)
    const start = () => {
      void this.check()
      clearInterval(this.timer)
      this.timer = setInterval(() => void this.check(), 1000)
    }
    win.on('focus', start)
    win.on('blur', () => clearInterval(this.timer))
    win.on('closed', () => clearInterval(this.timer))
    if (win.isFocused()) start()
  }

  /** Segna un testo come già visto (es. già arrivato dal preload di un gioco). */
  seen(text: string): void {
    this.last = text
  }

  private async check(): Promise<void> {
    if (this.busy || this.last === undefined) return
    this.busy = true
    try {
      const text = await clipboard.readText()
      if (text && text !== this.last) {
        this.last = text
        this.onText(text)
      }
    } catch {
      /* appunti occupati da un altro programma: riprova al prossimo giro */
    } finally {
      this.busy = false
    }
  }

  /** Scrive negli appunti senza che l'app lo scambi per un risultato. */
  async write(text: string): Promise<void> {
    this.last = text
    await clipboard.writeText(text)
  }
}

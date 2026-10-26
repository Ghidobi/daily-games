import { useEffect, useRef, useState } from 'react'
import type { Game, ParsePreview } from '@shared/types'
import { summarize } from '@shared/results'
import { Icon } from './Icon'

/** Finestra per incollare a mano il risultato di un gioco. */
export function PasteDialog({ games, gameId, onClose }: { games: Game[]; gameId?: string; onClose: () => void }) {
  const [text, setText] = useState('')
  const [preview, setPreview] = useState<ParsePreview>({})
  const [chosen, setChosen] = useState(gameId ?? '')
  const area = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    area.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Riconosce il gioco mentre scrivi/incolli.
  useEffect(() => {
    if (!text.trim()) {
      setPreview({})
      return
    }
    const t = setTimeout(() => {
      void window.api.parseResult(text).then((p) => {
        setPreview(p)
        if (p.gameId && !gameId) setChosen(p.gameId)
      })
    }, 150)
    return () => clearTimeout(t)
  }, [text, gameId])

  const save = () => {
    if (!chosen || !text.trim()) return
    window.api.saveResult(chosen, text)
    onClose()
  }

  const detected = preview.gameId && preview.gameId === chosen

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="paste-title">
        <header className="dialog-head">
          <h2 id="paste-title">Incolla un risultato</h2>
          <button className="tool plain" onClick={onClose} title="Chiudi">
            <Icon name="close" />
          </button>
        </header>
        <p className="dialog-sub">
          Incolla il testo che il gioco copia quando premi «Condividi». Verrà salvato come risultato di oggi.
        </p>
        <textarea
          ref={area}
          className="paste-area"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'Spotle Movies #321\n⬜⬜⬜🟩'}
          rows={6}
          onKeyDown={(e) => e.key === 'Enter' && e.ctrlKey && save()}
        />
        <div className="dialog-row">
          <label>
            Gioco
            <select value={chosen} onChange={(e) => setChosen(e.target.value)}>
              <option value="" disabled>
                Scegli…
              </option>
              {games.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
          <span className={`detect${detected ? ' ok' : ''}`}>
            {detected ? `Riconosciuto: ${summarize(preview.result)}` : text.trim() ? 'Non riconosciuto: verrà salvato il testo' : ''}
          </span>
        </div>
        <footer className="dialog-foot">
          <button className="btn ghost" onClick={onClose}>
            Annulla
          </button>
          <button className="btn primary" onClick={save} disabled={!chosen || !text.trim()}>
            Salva risultato
          </button>
        </footer>
      </div>
    </div>
  )
}

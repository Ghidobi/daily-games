import { useState } from 'react'
import type { FormEvent } from 'react'
import type { AppState, Game } from '@shared/types'
import { DEFAULT_GAMES } from '@shared/catalog'
import { useDragReorder } from '../dragReorder'
import { GameIcon } from './GameIcon'
import { Icon } from './Icon'

/** Gestione della raccolta: aggiungi da URL, riordina, rinomina, colore, nascondi, elimina. */
export function CollectionPage({ state }: { state: AppState }) {
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'error' | 'warn' | 'ok'; text: string } | null>(null)
  const ids = state.games.map((g) => g.id)
  const { itemProps } = useDragReorder(ids, (next) => window.api.reorderGames(next))

  const add = async (value: string) => {
    setBusy(true)
    setMessage(null)
    const res = await window.api.addGame(value)
    setBusy(false)
    if (!res.ok) return setMessage({ kind: 'error', text: res.error })
    setUrl('')
    setMessage(res.warning ? { kind: 'warn', text: `${res.game.name} aggiunto. ${res.warning}` } : { kind: 'ok', text: `${res.game.name} aggiunto alla raccolta.` })
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (url.trim() && !busy) void add(url)
  }

  const missingDefaults = DEFAULT_GAMES.filter((d) => !state.games.some((g) => g.id === d.id))

  return (
    <div className="page scroll-page">
      <header className="today-head">
        <div>
          <p className="eyebrow">I tuoi giochi</p>
          <h1>Raccolta</h1>
        </div>
      </header>

      <form className="add-card" onSubmit={submit}>
        <label htmlFor="add-url">Aggiungi un gioco incollando il suo indirizzo</label>
        <div className="add-row">
          <input
            id="add-url"
            type="text"
            inputMode="url"
            placeholder="https://www.nytimes.com/games/wordle"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={busy}
            autoComplete="off"
            spellCheck={false}
          />
          <button className="btn primary" type="submit" disabled={busy || !url.trim()}>
            {busy ? <span className="spinner" /> : <Icon name="plus" size={16} />}
            {busy ? 'Leggo il sito…' : 'Aggiungi'}
          </button>
        </div>
        {message && <p className={`form-msg ${message.kind}`}>{message.text}</p>}
      </form>

      <p className="hint top">
        Trascina i giochi per cambiarne l’ordine: vale anche per la barra laterale e per <kbd>Ctrl+1</kbd>…<kbd>Ctrl+9</kbd>.
      </p>

      <ul className="collection">
        {state.games.map((game) => (
          <CollectionRow key={game.id} game={game} icon={state.icons[game.id]} dragProps={itemProps(game.id)} />
        ))}
      </ul>

      {missingDefaults.length > 0 && (
        <section className="suggested">
          <h2 className="section-title">Giochi iniziali eliminati</h2>
          <div className="suggested-list">
            {missingDefaults.map((g) => (
              <button key={g.id} className="btn ghost" onClick={() => void add(g.url)} disabled={busy}>
                <Icon name="plus" size={14} /> {g.name}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function CollectionRow({ game, icon, dragProps }: { game: Game; icon?: string; dragProps: Record<string, unknown> }) {
  const [name, setName] = useState(game.name)
  const [category, setCategory] = useState(game.category)
  const [confirming, setConfirming] = useState(false)
  const [clearLogin, setClearLogin] = useState(false)

  const commit = () => {
    const patch: { name?: string; category?: string } = {}
    if (name.trim() && name !== game.name) patch.name = name
    else setName(game.name)
    if (category !== game.category) patch.category = category
    if (Object.keys(patch).length) window.api.updateGame(game.id, patch)
  }

  return (
    <li className={`coll-row${game.hidden ? ' hidden' : ''}`} {...dragProps}>
      <span className="grip" title="Trascina per riordinare">
        <Icon name="grip" />
      </span>
      <GameIcon game={game} src={icon} size={32} />
      <div className="coll-fields">
        <input
          className="coll-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          aria-label="Nome"
          maxLength={40}
        />
        <div className="coll-meta">
          <input
            className="coll-cat"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            aria-label="Categoria"
            placeholder="Categoria"
            maxLength={30}
          />
          <span className="coll-url" title={game.url}>{new URL(game.url).hostname.replace(/^www\./, '')}</span>
        </div>
      </div>
      {confirming ? (
        <div className="coll-confirm">
          <label>
            <input type="checkbox" checked={clearLogin} onChange={(e) => setClearLogin(e.target.checked)} /> cancella anche l’accesso
          </label>
          <button className="btn danger" onClick={() => window.api.removeGame(game.id, clearLogin)}>Elimina</button>
          <button className="btn ghost" onClick={() => setConfirming(false)}>Annulla</button>
        </div>
      ) : (
        <div className="coll-actions">
          <label className="color-pick" title="Colore della scheda">
            <input
              type="color"
              value={game.theme.accent.toLowerCase()}
              onChange={(e) => window.api.updateGame(game.id, { accent: e.target.value })}
            />
            <span style={{ background: game.theme.accent }} />
          </label>
          <button
            className="tool"
            onClick={() => window.api.updateGame(game.id, { hidden: !game.hidden })}
            title={game.hidden ? 'Mostra nella barra laterale' : 'Nascondi (resta nella raccolta)'}
          >
            <Icon name={game.hidden ? 'eyeOff' : 'eye'} />
          </button>
          <button className="tool danger" onClick={() => setConfirming(true)} title="Elimina dalla raccolta">
            <Icon name="trash" />
          </button>
        </div>
      )}
    </li>
  )
}

import { useState } from 'react'
import type { AppState, Suggestion } from '@shared/types'
import { ApiKeyForm } from './ApiKeyForm'
import { Icon } from './Icon'

const DATE = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
const STATUS: Record<Suggestion['status'], string> = { new: 'Da provare', added: 'Aggiunto', discarded: 'Scartato' }

export function DiscoverPage({ state }: { state: AppState }) {
  const d = state.discovery
  const [message, setMessage] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const fresh = d.suggestions.filter((s) => s.status === 'new').slice().reverse()
  const history = d.suggestions.filter((s) => s.status !== 'new').slice().reverse()

  const search = async () => {
    setMessage(null)
    const res = await window.api.discover()
    if (res.ok && res.count === 0) setMessage('Questa volta non ho trovato giochi nuovi: riprova più avanti.')
  }

  return (
    <div className="page scroll-page">
      <header className="today-head">
        <div>
          <p className="eyebrow">Giochi giornalieri simili ai tuoi</p>
          <h1>Scopri</h1>
        </div>
        {d.hasKey && (
          <button className="btn primary big" onClick={() => void search()} disabled={d.searching}>
            {d.searching ? <span className="spinner" /> : <Icon name="search" />}
            {d.searching ? 'Cerco sul web…' : 'Cerca nuovi giochi'}
          </button>
        )}
      </header>

      {!d.hasKey && (
        <section className="settings-card">
          <h2>Serve una chiave API di Anthropic</h2>
          <p className="dialog-sub">
            La ricerca usa Claude con la ricerca web per trovare giochi giornalieri che esistono davvero e che non hai già.
          </p>
          <ApiKeyForm discovery={d} />
        </section>
      )}

      {d.searching && (
        <div className="searching">
          <span className="spinner big" />
          <div>
            <strong>Sto cercando giochi nuovi…</strong>
            <p>Claude consulta il web e controlla che i giochi siano attivi: di solito ci vuole un minuto o due.</p>
          </div>
        </div>
      )}
      {d.error && !d.searching && <p className="form-msg error block">{d.error}</p>}
      {message && !d.searching && <p className="form-msg warn block">{message}</p>}

      {fresh.length > 0 && (
        <ul className="suggestions">
          {fresh.map((s, i) => (
            <SuggestionCard key={s.id} s={s} delay={i * 50} trying={state.trial?.url === s.url} />
          ))}
        </ul>
      )}

      {d.hasKey && fresh.length === 0 && !d.searching && !d.error && (
        <div className="empty">
          <Icon name="search" size={28} />
          <p>Premi «Cerca nuovi giochi»: troverò indovinelli, quiz su film e serie TV, geografia e giochi di parole che non hai ancora.</p>
        </div>
      )}

      {d.lastSearchAt && (
        <p className="hint">
          Ultima ricerca: {DATE.format(new Date(d.lastSearchAt))}
          {d.lastCost !== undefined && ` · costo stimato ${d.lastCost.toLocaleString('it-IT', { style: 'currency', currency: 'USD' })}`}
        </p>
      )}

      {history.length > 0 && (
        <section className="history">
          <button className="history-toggle" onClick={() => setShowHistory(!showHistory)}>
            <Icon name={showHistory ? 'down' : 'right'} size={16} /> Storico delle scoperte ({history.length})
          </button>
          {showHistory && (
            <ul className="history-list">
              {history.map((s) => (
                <li key={s.id}>
                  <span className={`pill ${s.status === 'added' ? 'ok' : ''}`}>{STATUS[s.status]}</span>
                  <a href={s.url} target="_blank" rel="noreferrer">{s.name}</a>
                  <span className="muted">{s.category} · {DATE.format(new Date(s.foundAt))}</span>
                  {s.status === 'discarded' && (
                    <button className="btn ghost small" onClick={() => window.api.restoreSuggestion(s.id)}>Ripristina</button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}

function SuggestionCard({ s, delay, trying }: { s: Suggestion; delay: number; trying: boolean }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const add = async () => {
    setBusy(true)
    const res = await window.api.addSuggestion(s.id)
    setBusy(false)
    if (!res.ok) setError(res.error)
  }
  return (
    <li className="sugg" style={{ animationDelay: `${delay}ms` }}>
      <div className="sugg-top">
        <span className="chip">{s.category}</span>
        <span className="muted sugg-host">{host(s.url)}</span>
      </div>
      <h3>{s.name}</h3>
      <p>{s.description}</p>
      {s.reason && <p className="sugg-reason">{s.reason}</p>}
      {error && <p className="form-msg error">{error}</p>}
      <div className="sugg-actions">
        <button className="btn ghost" onClick={() => window.api.discardSuggestion(s.id)} title="Non riproporlo più">
          Scarta
        </button>
        <button className="btn ghost" onClick={() => window.api.trySuggestion(s.id)}>
          {trying ? 'In prova' : 'Prova'}
        </button>
        <button className="btn primary" onClick={() => void add()} disabled={busy}>
          {busy ? <span className="spinner" /> : <Icon name="plus" size={15} />} Aggiungi
        </button>
      </div>
    </li>
  )
}

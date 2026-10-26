import { useState } from 'react'
import type { FormEvent } from 'react'
import type { DiscoveryState } from '@shared/types'

/** Inserimento della chiave API di Anthropic, con le istruzioni per ottenerla. */
export function ApiKeyForm({ discovery, compact = false }: { discovery: DiscoveryState; compact?: boolean }) {
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!key.trim() || busy) return
    setBusy(true)
    setError(null)
    const res = await window.api.setApiKey(key)
    setBusy(false)
    if (res.ok) {
      setKey('')
      setEditing(false)
    } else setError(res.error ?? 'Chiave non valida.')
  }

  if (discovery.hasKey && !editing) {
    return (
      <div className="key-saved">
        <span>
          Chiave salvata <code>{discovery.keyHint}</code>, cifrata su questo PC.
        </span>
        <button className="btn ghost" onClick={() => setEditing(true)}>Cambia</button>
        <button className="btn ghost" onClick={() => window.api.removeApiKey()}>Rimuovi</button>
      </div>
    )
  }

  return (
    <div className="key-form">
      {!compact && (
        <ol className="key-steps">
          <li>
            Apri{' '}
            <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">
              console.anthropic.com
            </a>{' '}
            e accedi (o crea un account).
          </li>
          <li>Aggiungi un po’ di credito in «Billing» (bastano pochi euro: ogni ricerca costa qualche decina di centesimi).</li>
          <li>In «API Keys» premi «Create Key», copia la chiave (inizia con <code>sk-ant-</code>) e incollala qui.</li>
        </ol>
      )}
      <form className="add-row" onSubmit={submit}>
        <input
          type="password"
          placeholder="sk-ant-…"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          disabled={busy}
          aria-label="Chiave API di Anthropic"
        />
        <button className="btn primary" type="submit" disabled={busy || !key.trim()}>
          {busy ? <span className="spinner" /> : null}
          {busy ? 'Verifico…' : 'Salva chiave'}
        </button>
        {editing && (
          <button className="btn ghost" type="button" onClick={() => setEditing(false)}>Annulla</button>
        )}
      </form>
      {error && <p className="form-msg error">{error}</p>}
      <p className="key-note">
        La chiave resta solo su questo PC, cifrata da Windows, e non finisce nei backup. Ogni amico usa la propria.
      </p>
    </div>
  )
}

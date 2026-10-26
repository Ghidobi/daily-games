import { useState } from 'react'
import type { FormEvent } from 'react'
import type { AppState } from '@shared/types'
import { GameIcon } from './GameIcon'
import { Icon } from './Icon'

const DATE = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button role="switch" aria-checked={checked} aria-label={label} className={`switch${checked ? ' on' : ''}`} onClick={() => onChange(!checked)}>
      <span />
    </button>
  )
}

/** Sezione "Blocco pubblicità" delle impostazioni. */
export function AdblockSettings({ state }: { state: AppState }) {
  const a = state.settings.adblock
  const s = state.adblock
  const [domain, setDomain] = useState('')

  const add = (e: FormEvent) => {
    e.preventDefault()
    if (!domain.trim()) return
    window.api.setAdblock({ allowlist: [...a.allowlist, domain] })
    setDomain('')
  }

  const statusText = s.updating
    ? 'Aggiorno le liste dei filtri…'
    : s.ready
      ? `${s.filters ? `${s.filters.toLocaleString('it-IT')} filtri` : 'Filtri pronti'}${s.updatedAt ? ` · aggiornati ${DATE.format(new Date(s.updatedAt))}` : ''}`
      : 'Le liste dei filtri non sono ancora state scaricate.'

  return (
    <section className="settings-card">
      <h2>Blocco pubblicità</h2>
      <div className="setting">
        <div>
          <strong>Blocca pubblicità e tracker nei giochi</strong>
          <p>
            Filtri EasyList, EasyPrivacy e uBlock Origin, aggiornati una volta al giorno. Nasconde anche gli spazi vuoti
            lasciati dagli annunci.
          </p>
          <p className={s.error ? 'warn-text' : ''}>{s.error ?? statusText}</p>
        </div>
        <div className="setting-controls">
          <button className="btn ghost" onClick={() => window.api.refreshFilters()} disabled={s.updating}>
            {s.updating ? <span className="spinner" /> : <Icon name="reload" size={15} />} Aggiorna
          </button>
          <Switch label="Blocco pubblicità" checked={a.enabled} onChange={(v) => window.api.setAdblock({ enabled: v })} />
        </div>
      </div>

      <div className={`setting column${a.enabled ? '' : ' off-all'}`}>
        <div>
          <strong>Per gioco</strong>
          <p>Se un sito non funziona bene, spegni il blocco solo lì. Le modifiche valgono dal prossimo caricamento della pagina.</p>
        </div>
        <ul className="ad-games">
          {state.games.map((g) => (
            <li key={g.id}>
              <GameIcon game={g} src={state.icons[g.id]} size={22} />
              <span>{g.name}</span>
              <Switch
                label={`Blocco pubblicità su ${g.name}`}
                checked={!a.disabledGames.includes(g.id)}
                onChange={(v) => window.api.setGameAdblock(g.id, v)}
              />
            </li>
          ))}
        </ul>
      </div>

      <div className={`setting column${a.enabled ? '' : ' off-all'}`}>
        <div>
          <strong>Domini da non bloccare mai</strong>
          <p>
            Né le richieste verso questi domini né le loro pagine vengono filtrate (vale anche per i sottodomini). Ci sono già
            i servizi di accesso più comuni, per non rompere i login.
          </p>
        </div>
        <div className="domain-chips">
          {a.allowlist.map((d) => (
            <span key={d} className="domain-chip">
              {d}
              <button onClick={() => window.api.setAdblock({ allowlist: a.allowlist.filter((x) => x !== d) })} title={`Togli ${d}`}>
                <Icon name="close" size={12} />
              </button>
            </span>
          ))}
        </div>
        <form className="add-row" onSubmit={add}>
          <input
            type="text"
            placeholder="esempio.com"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            spellCheck={false}
            aria-label="Dominio da non bloccare"
          />
          <button className="btn ghost" type="submit" disabled={!domain.trim()}>
            <Icon name="plus" size={15} /> Aggiungi
          </button>
        </form>
      </div>
    </section>
  )
}

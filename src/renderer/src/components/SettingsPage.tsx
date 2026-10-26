import { useState } from 'react'
import type { AppState, ThemeMode } from '@shared/types'
import { Icon } from './Icon'

function Switch({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`switch${checked ? ' on' : ''}`}
      onClick={() => onChange(!checked)}
      disabled={disabled}
    >
      <span />
    </button>
  )
}

const THEMES: { mode: ThemeMode; label: string }[] = [
  { mode: 'light', label: 'Chiaro' },
  { mode: 'system', label: 'Come il sistema' },
  { mode: 'dark', label: 'Scuro' }
]

export function SettingsPage({ state }: { state: AppState }) {
  const s = state.settings
  const [dataMsg, setDataMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  const doExport = async () => {
    const res = await window.api.exportData()
    if (res.ok) setDataMsg({ kind: 'ok', text: `Backup salvato in ${res.path}` })
    else if (res.error) setDataMsg({ kind: 'error', text: res.error })
  }
  const doImport = async () => {
    const res = await window.api.importData()
    if (res.ok) setDataMsg({ kind: 'ok', text: 'Backup importato.' })
    else if (res.error) setDataMsg({ kind: 'error', text: res.error })
  }

  return (
    <div className="page scroll-page">
      <header className="today-head">
        <div>
          <p className="eyebrow">Daily Games {state.version}</p>
          <h1>Impostazioni</h1>
        </div>
      </header>

      <section className="settings-card">
        <h2>Aspetto</h2>
        <div className="setting">
          <div>
            <strong>Tema</strong>
          </div>
          <div className="segmented">
            {THEMES.map((t) => (
              <button key={t.mode} className={state.themeMode === t.mode ? 'on' : ''} onClick={() => window.api.setThemeMode(t.mode)}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="settings-card">
        <h2>Promemoria</h2>
        <div className="setting">
          <div>
            <strong>Avvisami se non ho finito i giochi</strong>
            <p>Una notifica di Windows all’ora scelta (ora italiana), solo se resta qualcosa da giocare.</p>
          </div>
          <Switch
            label="Promemoria"
            checked={s.reminder.enabled}
            onChange={(enabled) => window.api.updateSettings({ reminder: { ...s.reminder, enabled } })}
          />
        </div>
        <div className={`setting${s.reminder.enabled ? '' : ' off'}`}>
          <div>
            <strong>Ora</strong>
          </div>
          <div className="setting-controls">
            <input
              type="time"
              value={s.reminder.time}
              disabled={!s.reminder.enabled}
              onChange={(e) => e.target.value && window.api.updateSettings({ reminder: { ...s.reminder, time: e.target.value } })}
            />
            <button className="btn ghost" onClick={() => window.api.testReminder()}>
              <Icon name="bell" size={15} /> Prova
            </button>
          </div>
        </div>
        {state.portable && (
          <p className="setting-note">
            Nella versione portatile Windows potrebbe non mostrare le notifiche: se non le vedi, usa l’installer.
          </p>
        )}
        {s.reminder.enabled && !s.closeToTray && (
          <p className="setting-note">Il promemoria funziona solo mentre l’app è aperta: attiva «Resta nell’area di notifica».</p>
        )}
      </section>

      <section className="settings-card">
        <h2>Finestra e avvio</h2>
        <div className="setting">
          <div>
            <strong>Resta nell’area di notifica quando chiudi</strong>
            <p>La finestra si nasconde vicino all’orologio; per uscire: tasto destro sull’icona → Esci.</p>
          </div>
          <Switch label="Area di notifica" checked={s.closeToTray} onChange={(v) => window.api.updateSettings({ closeToTray: v })} />
        </div>
        <div className="setting">
          <div>
            <strong>Avvia con Windows</strong>
            <p>
              {state.packaged
                ? 'Parte da sola all’accensione, ridotta nell’area di notifica.'
                : 'Disponibile solo nell’app installata (non in modalità sviluppo).'}
            </p>
          </div>
          <Switch
            label="Avvio con Windows"
            checked={s.openAtLogin}
            disabled={!state.packaged}
            onChange={(v) => window.api.updateSettings({ openAtLogin: v })}
          />
        </div>
      </section>

      <section className="settings-card">
        <h2>Dati</h2>
        <div className="setting">
          <div>
            <strong>Backup</strong>
            <p>
              Raccolta, statistiche e impostazioni in un file, per sicurezza o per passare a un altro PC. Gli accessi ai giochi
              non sono inclusi: su un nuovo PC andranno rifatti.
            </p>
          </div>
          <div className="setting-controls">
            <button className="btn ghost" onClick={() => void doExport()}>
              <Icon name="download" size={15} /> Esporta
            </button>
            <button className="btn ghost" onClick={() => void doImport()}>
              <Icon name="upload" size={15} /> Importa
            </button>
          </div>
        </div>
        {dataMsg && <p className={`form-msg ${dataMsg.kind}`}>{dataMsg.text}</p>}
      </section>
    </div>
  )
}

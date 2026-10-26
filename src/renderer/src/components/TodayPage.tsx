import type { AppState } from '@shared/types'
import { summarize } from '@shared/results'
import { formatDay, gameVars } from '../theme'
import { GameIcon } from './GameIcon'
import { Icon } from './Icon'

export function TodayPage({ state, onPaste }: { state: AppState; onPaste: (gameId?: string) => void }) {
  const games = state.games.filter((g) => !g.hidden)
  const played = games.filter((g) => state.today[g.id]?.played).length
  const allDone = games.length > 0 && played === games.length
  const pct = games.length ? (played / games.length) * 100 : 0
  const streak = state.streaks.total

  return (
    <div className="page today-page">
      <header className="today-head">
        <div>
          <p className="eyebrow">{formatDay(state.dayKey)}</p>
          <h1>Oggi</h1>
        </div>
        <button className="btn primary big" onClick={() => window.api.next()} disabled={allDone}>
          {allDone ? 'Tutto fatto per oggi' : 'Prossimo gioco'}
          {!allDone && <Icon name="arrow" />}
          {!allDone && <kbd>Ctrl+N</kbd>}
        </button>
      </header>

      <section className="progress-card" aria-label="Avanzamento di oggi">
        <div className="progress-top">
          <div className="progress-text">
            <strong>{played}</strong> di {games.length} giocati
            {allDone && <span className="cheer">Ottimo lavoro, a domani!</span>}
          </div>
          <div className={`streak${streak > 0 ? ' on' : ''}`} title="Giorni consecutivi con almeno un gioco">
            <Icon name="flame" size={16} />
            <strong>{streak}</strong> {streak === 1 ? 'giorno' : 'giorni'} di fila
          </div>
        </div>
        <div className="progress-bar">
          <span style={{ width: `${pct}%` }} />
        </div>
        <div className="progress-actions">
          <button className="btn ghost" onClick={() => onPaste()}>
            <Icon name="clipboard" size={16} /> Incolla risultato
          </button>
          <button className="btn ghost" onClick={() => void window.api.shareDay()} disabled={played === 0}>
            <Icon name="share" size={16} /> Condividi la mia giornata
          </button>
        </div>
      </section>

      <ul className="cards">
        {games.map((game, i) => {
          const entry = state.today[game.id]
          const done = !!entry?.played
          const gameStreak = state.streaks.games[game.id] ?? 0
          return (
            <li
              key={game.id}
              className={`card${done ? ' done' : ''}`}
              style={{ ...gameVars(game.theme), animationDelay: `${i * 40}ms` }}
            >
              <button
                className="card-band"
                style={{ background: game.theme.header, color: game.theme.headerText }}
                onClick={() => window.api.open(game.id)}
              >
                <GameIcon game={game} src={state.icons[game.id]} size={40} />
                <span className="card-title">
                  <strong>{game.name}</strong>
                  <small>{game.category}</small>
                </span>
                {gameStreak > 0 && (
                  <span className="card-streak" title={`${gameStreak} giorni di fila`}>
                    <Icon name="flame" size={14} />
                    {gameStreak}
                  </span>
                )}
              </button>
              <div className="card-body">
                <div className="card-status">
                  <span className={`pill${done ? ' ok' : ''}`}>
                    {done ? <><Icon name="check" size={13} /> Giocato</> : 'Da giocare'}
                  </span>
                  {entry?.result && <span className="card-result">{summarize(entry.result)}</span>}
                </div>
                <div className="card-actions">
                  <button
                    className="btn ghost"
                    onClick={() => window.api.setPlayed(game.id, !done)}
                    title={done ? 'Segna come da giocare (cancella il risultato)' : 'Segna come giocato'}
                  >
                    {done ? 'Annulla' : 'Segna giocato'}
                  </button>
                  <button className="btn accent" onClick={() => window.api.open(game.id)}>
                    {done ? 'Apri' : 'Gioca'}
                  </button>
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      <p className="hint">
        Quando premi «Condividi» in un gioco, il risultato viene salvato da solo. Scorciatoie:{' '}
        <kbd>Ctrl+1</kbd>…<kbd>Ctrl+9</kbd> giochi, <kbd>Ctrl+0</kbd> Oggi, <kbd>Ctrl+Shift+S</kbd> Statistiche,{' '}
        <kbd>Ctrl+Tab</kbd> scheda successiva.
      </p>
    </div>
  )
}

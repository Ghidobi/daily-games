import type { AppState } from '@shared/types'
import { formatDay, gameVars } from '../theme'
import { GameIcon } from './GameIcon'
import { Icon } from './Icon'

export function TodayPage({ state }: { state: AppState }) {
  const games = state.games.filter((g) => !g.hidden)
  const played = games.filter((g) => state.today[g.id]?.played).length
  const allDone = games.length > 0 && played === games.length
  const pct = games.length ? (played / games.length) * 100 : 0

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
        <div className="progress-text">
          <strong>{played}</strong> di {games.length} giocati
          {allDone && <span className="cheer">Ottimo lavoro, a domani!</span>}
        </div>
        <div className="progress-bar">
          <span style={{ width: `${pct}%` }} />
        </div>
      </section>

      <ul className="cards">
        {games.map((game, i) => {
          const done = !!state.today[game.id]?.played
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
              </button>
              <div className="card-body">
                <span className={`pill${done ? ' ok' : ''}`}>
                  {done ? <><Icon name="check" size={13} /> Giocato</> : 'Da giocare'}
                </span>
                <div className="card-actions">
                  <button
                    className="btn ghost"
                    onClick={() => window.api.setPlayed(game.id, !done)}
                    title={done ? 'Segna come da giocare' : 'Segna come giocato'}
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
        Scorciatoie: <kbd>Ctrl+1</kbd>…<kbd>Ctrl+9</kbd> per i giochi, <kbd>Ctrl+0</kbd> per Oggi,{' '}
        <kbd>Ctrl+Tab</kbd> per scorrere le schede.
      </p>
    </div>
  )
}

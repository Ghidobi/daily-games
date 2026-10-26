import type { AppState, ThemeMode } from '@shared/types'
import { useDragReorder, withHidden } from '../dragReorder'
import { GameIcon } from './GameIcon'
import { Icon, type IconName } from './Icon'

const THEMES: { mode: ThemeMode; icon: IconName; label: string }[] = [
  { mode: 'light', icon: 'sun', label: 'Tema chiaro' },
  { mode: 'system', icon: 'system', label: 'Tema di sistema' },
  { mode: 'dark', icon: 'moon', label: 'Tema scuro' }
]

export function Sidebar({ state }: { state: AppState }) {
  const games = state.games.filter((g) => !g.hidden)
  const played = games.filter((g) => state.today[g.id]?.played).length
  const visibleIds = games.map((g) => g.id)
  const { itemProps } = useDragReorder(visibleIds, (order) =>
    window.api.reorderGames(withHidden(state.games.map((g) => g.id), order))
  )

  const page = (id: AppState['active'], icon: IconName, label: string, title: string, extra?: React.ReactNode) => (
    <button className={`nav-item${state.active === id ? ' active' : ''}`} onClick={() => window.api.open(id)} title={title}>
      <span className="nav-icon"><Icon name={icon} /></span>
      <span className="nav-label">{label}</span>
      {extra}
    </button>
  )

  return (
    <nav className="sidebar" aria-label="Giochi">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          <i /><i /><i /><i />
        </span>
        <span className="brand-name">Daily Games</span>
      </div>

      {page('today', 'today', 'Oggi', 'Oggi (Ctrl+0)', <span className="nav-count">{played}/{games.length}</span>)}
      {page(
        'stats',
        'chart',
        'Statistiche',
        'Statistiche (Ctrl+Shift+S)',
        state.streaks.total > 0 && (
          <span className="nav-count flame" title="Giorni di fila">
            <Icon name="flame" size={13} />
            {state.streaks.total}
          </span>
        )
      )}

      {page(
        'discover',
        'sparkle',
        'Scopri',
        'Scopri nuovi giochi',
        state.discovery.searching ? (
          <span className="spinner" />
        ) : (
          (() => {
            const n = state.discovery.suggestions.filter((s) => s.status === 'new').length
            return n > 0 ? <span className="nav-count new">{n}</span> : null
          })()
        )
      )}

      {state.trial && (
        <div className={`nav-item trial${state.active === state.trial.id ? ' active' : ''}`}>
          <button className="trial-open" onClick={() => window.api.open(state.trial!.id)} title={`In prova: ${state.trial.name}`}>
            <span className="nav-icon">
              <GameIcon game={state.trial} src={state.icons[state.trial.id]} size={26} />
            </span>
            <span className="nav-label">
              <small>In prova</small>
              {state.trial.name}
            </span>
          </button>
          <button className="trial-close" onClick={() => window.api.closeTrial()} title="Chiudi la prova" aria-label="Chiudi la prova">
            <Icon name="close" size={14} />
          </button>
        </div>
      )}

      <div className="nav-section">I tuoi giochi</div>
      <ul className="game-list">
        {games.map((game, i) => {
          const done = !!state.today[game.id]?.played
          const isActive = state.active === game.id
          return (
            <li key={game.id} {...itemProps(game.id)}>
              <button
                className={`nav-item game${isActive ? ' active' : ''}`}
                style={{ '--accent': game.theme.accent } as React.CSSProperties}
                onClick={() => window.api.open(game.id)}
                title={i < 9 ? `${game.name} (Ctrl+${i + 1}) · trascina per riordinare` : game.name}
              >
                <span className="nav-icon">
                  <GameIcon game={game} src={state.icons[game.id]} size={26} />
                  {done && <span className="done-badge"><Icon name="check" size={10} /></span>}
                </span>
                <span className="nav-label">{game.name}</span>
                {i < 9 && <kbd className="nav-kbd">{i + 1}</kbd>}
              </button>
            </li>
          )
        })}
        <li>
          <button
            className={`nav-item add${state.active === 'collection' ? ' active' : ''}`}
            onClick={() => window.api.open('collection')}
            title="Aggiungi, riordina o nascondi i giochi"
          >
            <span className="nav-icon"><Icon name="plus" /></span>
            <span className="nav-label">Gestisci raccolta</span>
          </button>
        </li>
      </ul>

      <div className="sidebar-foot">
        <div className="theme-switch" role="radiogroup" aria-label="Tema">
          {THEMES.map((t) => (
            <button
              key={t.mode}
              role="radio"
              aria-checked={state.themeMode === t.mode}
              className={state.themeMode === t.mode ? 'on' : ''}
              onClick={() => window.api.setThemeMode(t.mode)}
              title={t.label}
            >
              <Icon name={t.icon} size={16} />
            </button>
          ))}
        </div>
        <button
          className={`gear${state.active === 'settings' ? ' on' : ''}`}
          onClick={() => window.api.open('settings')}
          title="Impostazioni"
          aria-label="Impostazioni"
        >
          <Icon name="gear" size={17} />
        </button>
      </div>
    </nav>
  )
}

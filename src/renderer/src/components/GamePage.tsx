import { useLayoutEffect, useRef } from 'react'
import type { AppState, Game } from '@shared/types'
import { gameVars } from '../theme'
import { GameIcon } from './GameIcon'
import { Icon } from './Icon'

/**
 * Scheda di un gioco: intestazione nei colori del gioco e un riquadro vuoto sopra cui
 * il processo principale posiziona la vista web vera (WebContentsView).
 */
export function GamePage({ game, state }: { game: Game; state: AppState }) {
  const frame = useRef<HTMLDivElement>(null)
  const status = state.views[game.id]
  const done = !!state.today[game.id]?.played
  const notice = state.notice?.gameId === game.id ? state.notice : undefined

  // Comunica al processo principale dove disegnare la vista del gioco.
  useLayoutEffect(() => {
    const el = frame.current
    if (!el) return
    const send = () => {
      const r = el.getBoundingClientRect()
      window.api.setContentBounds({ x: r.left, y: r.top, width: r.width, height: r.height })
    }
    send()
    const ro = new ResizeObserver(send)
    ro.observe(el)
    window.addEventListener('resize', send)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', send)
      window.api.setContentBounds(null)
    }
  }, [game.id])

  const act = (a: Parameters<typeof window.api.gameAction>[1]) => window.api.gameAction(game.id, a)

  return (
    <div className="page game-page" style={gameVars(game.theme)}>
      <header className="game-head" style={{ background: game.theme.header, color: game.theme.headerText }}>
        <div className="game-id">
          <GameIcon game={game} src={state.icons[game.id]} size={30} />
          <div>
            <strong>{game.name}</strong>
            <small>{game.category}</small>
          </div>
          {status?.loading && <span className="spinner" aria-label="Caricamento" />}
        </div>
        <div className="game-tools">
          <button className="tool" onClick={() => act('back')} disabled={!status?.canGoBack} title="Indietro (Alt+←)">
            <Icon name="back" />
          </button>
          <button className="tool" onClick={() => act('reload')} title="Ricarica (F5)">
            <Icon name="reload" />
          </button>
          <button className="tool" onClick={() => act('home')} title="Pagina iniziale del gioco">
            <Icon name="home" />
          </button>
          <button className="tool" onClick={() => act('external')} title="Apri nel browser">
            <Icon name="external" />
          </button>
          <button
            className={`played-toggle${done ? ' on' : ''}`}
            onClick={() => window.api.setPlayed(game.id, !done)}
          >
            <Icon name="check" size={16} />
            <span>{done ? 'Giocato' : 'Segna giocato'}</span>
          </button>
        </div>
      </header>

      {notice && (
        <div className="notice" role="alert">
          <Icon name="alert" />
          <span>{notice.text}</span>
          <button className="btn accent" onClick={() => act('external')}>Apri nel browser</button>
          <button className="tool plain" onClick={() => window.api.dismissNotice()} title="Chiudi">
            <Icon name="close" />
          </button>
        </div>
      )}

      <div className="game-frame">
        <div className="game-surface" ref={frame}>
          {status?.error ? (
            <div className="frame-msg">
              <Icon name="alert" size={28} />
              <p>Impossibile caricare {game.name}.</p>
              <small>{status.error}</small>
              <div className="frame-actions">
                <button className="btn accent" onClick={() => act('reload')}>Riprova</button>
                <button className="btn ghost" onClick={() => act('external')}>Apri nel browser</button>
              </div>
            </div>
          ) : (
            !status?.loaded && <span className="spinner big" aria-label="Caricamento" />
          )}
        </div>
      </div>
    </div>
  )
}

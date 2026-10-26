import type { Game } from '@shared/types'

/** Favicon del gioco (scaricata all'avvio) o, in attesa, l'iniziale sul colore d'accento. */
export function GameIcon({ game, src, size = 28 }: { game: Game; src?: string; size?: number }) {
  return (
    <span
      className="game-icon"
      style={{ width: size, height: size, background: src ? game.theme.bg : game.theme.accent }}
    >
      {src ? (
        <img src={src} alt="" draggable={false} />
      ) : (
        <span style={{ color: game.theme.bg, fontSize: size * 0.5 }}>{game.name[0]}</span>
      )}
    </span>
  )
}

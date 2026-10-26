import { useCallback, useEffect, useState } from 'react'
import type { AppState } from '@shared/types'
import { Sidebar } from './components/Sidebar'
import { TodayPage } from './components/TodayPage'
import { GamePage } from './components/GamePage'
import { StatsPage } from './components/StatsPage'
import { CollectionPage } from './components/CollectionPage'
import { SettingsPage } from './components/SettingsPage'
import { DiscoverPage } from './components/DiscoverPage'
import { PasteDialog } from './components/PasteDialog'
import { Toast } from './components/Toast'
import { useResolvedTheme } from './theme'

/** null = chiusa; stringa vuota = senza gioco preselezionato. */
type PasteTarget = string | null

export function App() {
  const [state, setState] = useState<AppState | null>(null)
  const [paste, setPaste] = useState<PasteTarget>(null)

  useEffect(() => {
    void window.api.getState().then(setState)
    return window.api.onState(setState)
  }, [])

  useResolvedTheme(state?.themeMode ?? 'system')
  const openPaste = useCallback((gameId?: string) => setPaste(gameId ?? ''), [])
  const closePaste = useCallback(() => setPaste(null), [])

  if (!state) return <div className="boot" />

  const game = state.trial?.id === state.active ? state.trial : state.games.find((g) => g.id === state.active)
  const games = state.games.filter((g) => !g.hidden)

  return (
    <div className="app">
      <Sidebar state={state} />
      <main className="main">
        {game ? (
          // La vista del gioco sta sopra l'interfaccia: con una finestra aperta va nascosta.
          <GamePage key={game.id} game={game} state={state} covered={paste !== null} onPaste={openPaste} />
        ) : state.active === 'stats' ? (
          <StatsPage state={state} />
        ) : state.active === 'collection' ? (
          <CollectionPage state={state} />
        ) : state.active === 'settings' ? (
          <SettingsPage state={state} />
        ) : state.active === 'discover' ? (
          <DiscoverPage state={state} />
        ) : (
          <TodayPage state={state} onPaste={openPaste} />
        )}
        {state.toast && !game && <Toast toast={state.toast} />}
      </main>
      {paste !== null && <PasteDialog games={games} gameId={paste || undefined} onClose={closePaste} />}
    </div>
  )
}

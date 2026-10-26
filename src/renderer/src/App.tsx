import { useEffect, useState } from 'react'
import type { AppState } from '@shared/types'
import { Sidebar } from './components/Sidebar'
import { TodayPage } from './components/TodayPage'
import { GamePage } from './components/GamePage'
import { useResolvedTheme } from './theme'

export function App() {
  const [state, setState] = useState<AppState | null>(null)

  useEffect(() => {
    void window.api.getState().then(setState)
    return window.api.onState(setState)
  }, [])

  useResolvedTheme(state?.themeMode ?? 'system')

  if (!state) return <div className="boot" />

  const game = state.active === 'today' ? undefined : state.games.find((g) => g.id === state.active)

  return (
    <div className="app">
      <Sidebar state={state} />
      <main className="main">
        {game ? (
          <GamePage key={game.id} game={game} state={state} />
        ) : (
          <TodayPage state={state} />
        )}
      </main>
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import type { AppState, DaysData, Game } from '@shared/types'
import { summarize } from '@shared/results'
import { gameStats, overallStats, shiftDay } from '@shared/stats'
import { gameVars } from '../theme'
import { GameIcon } from './GameIcon'
import { Icon } from './Icon'

const MONTH = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const SHORT = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const LONG = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
const WEEKDAYS = ['L', 'M', 'M', 'G', 'V', 'S', 'D']

const asDate = (key: string) => new Date(`${key}T12:00:00Z`)
const fmt = (n: number, digits = 0) => n.toLocaleString('it-IT', { maximumFractionDigits: digits })

export function StatsPage({ state }: { state: AppState }) {
  const [days, setDays] = useState<DaysData>({})
  const games = state.games.filter((g) => !g.hidden)
  const ids = games.map((g) => g.id)

  useEffect(() => {
    void window.api.getDays().then(setDays)
  }, [state.dataVersion])

  const overall = useMemo(() => overallStats(days, state.dayKey, ids), [days, state.dayKey, ids.join()])

  return (
    <div className="page stats-page">
      <header className="today-head">
        <div>
          <p className="eyebrow">Il tuo storico</p>
          <h1>Statistiche</h1>
        </div>
      </header>

      <section className="tiles">
        <Tile icon="flame" label="Serie attuale" value={overall.current} unit={overall.current === 1 ? 'giorno' : 'giorni'} />
        <Tile label="Serie migliore" value={overall.best} unit={overall.best === 1 ? 'giorno' : 'giorni'} />
        <Tile label="Giorni giocati" value={overall.daysPlayed} />
        <Tile label="Giornate complete" value={overall.completeDays} />
        <Tile label="Partite totali" value={overall.gamesPlayed} />
      </section>

      <Calendar days={days} today={state.dayKey} games={games} />

      <h2 className="section-title">Per gioco</h2>
      <ul className="game-stats">
        {games.map((g) => (
          <GameStatsCard key={g.id} game={g} icon={state.icons[g.id]} days={days} today={state.dayKey} />
        ))}
      </ul>
    </div>
  )
}

function Tile({ label, value, unit, icon }: { label: string; value: number; unit?: string; icon?: 'flame' }) {
  return (
    <div className={`tile${icon && value > 0 ? ' hot' : ''}`}>
      <span className="tile-label">
        {icon && <Icon name={icon} size={14} />} {label}
      </span>
      <span className="tile-value">
        {fmt(value)}
        {unit && <small> {unit}</small>}
      </span>
    </div>
  )
}

/** Calendario mensile: l'intensità del colore indica quanti giochi hai fatto quel giorno. */
function Calendar({ days, today, games }: { days: DaysData; today: string; games: Game[] }) {
  const [month, setMonth] = useState(today.slice(0, 7))
  const [selected, setSelected] = useState<string | null>(null)

  const cells = useMemo(() => {
    const first = `${month}-01`
    const offset = (asDate(first).getUTCDay() + 6) % 7 // lunedì = 0
    const out: (string | null)[] = Array(offset).fill(null)
    for (let d = first; d.startsWith(month); d = shiftDay(d, 1)) out.push(d)
    return out
  }, [month])

  const move = (delta: number) => {
    const d = asDate(`${month}-15`)
    d.setUTCMonth(d.getUTCMonth() + delta)
    setMonth(d.toISOString().slice(0, 7))
    setSelected(null)
  }

  const countOn = (d: string) => games.filter((g) => days[d]?.[g.id]?.played).length
  const detail = selected ? games.filter((g) => days[selected]?.[g.id]?.played) : []

  return (
    <section className="calendar">
      <header className="calendar-head">
        <button className="tool" onClick={() => move(-1)} title="Mese precedente">
          <Icon name="left" />
        </button>
        <strong>{MONTH.format(asDate(`${month}-15`))}</strong>
        <button className="tool" onClick={() => move(1)} disabled={month >= today.slice(0, 7)} title="Mese successivo">
          <Icon name="right" />
        </button>
      </header>
      <div className="calendar-grid">
        {WEEKDAYS.map((w, i) => (
          <span key={i} className="weekday">{w}</span>
        ))}
        {cells.map((d, i) => {
          if (!d) return <span key={i} />
          const n = countOn(d)
          const level = games.length ? n / games.length : 0
          return (
            <button
              key={d}
              className={`day${d === today ? ' today' : ''}${d > today ? ' future' : ''}${d === selected ? ' sel' : ''}${n ? ' on' : ''}`}
              style={{ '--level': level } as React.CSSProperties}
              disabled={d > today}
              onClick={() => setSelected(d === selected ? null : d)}
              title={`${SHORT.format(asDate(d))}: ${n}/${games.length}`}
            >
              {Number(d.slice(8))}
            </button>
          )
        })}
      </div>
      {selected && (
        <div className="day-detail">
          <strong>{LONG.format(asDate(selected))}</strong>
          {detail.length === 0 ? (
            <span className="muted">Nessun gioco.</span>
          ) : (
            <ul>
              {detail.map((g) => (
                <li key={g.id}>
                  <span className="dot" style={{ background: g.theme.accent }} />
                  {g.name}
                  <span className="muted">{summarize(days[selected][g.id].result) || 'Giocato'}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}

function GameStatsCard({ game, icon, days, today }: { game: Game; icon?: string; days: DaysData; today: string }) {
  const s = useMemo(() => gameStats(days, today, game.id), [days, today, game.id])
  const facts: [string, string][] = [
    ['Giocate', fmt(s.played)],
    ['Serie', fmt(s.current)],
    ['Migliore', fmt(s.best)]
  ]
  if (s.decided) facts.push(['Vittorie', `${fmt((s.won / s.decided) * 100)}%`])
  if (s.avgAttempts !== undefined) facts.push(['Media tentativi', fmt(s.avgAttempts, 1)])
  if (s.avgScore !== undefined) facts.push([`Media ${s.scoreUnit ?? ''}`.trim(), fmt(s.avgScore)])
  if (s.bestScore !== undefined) facts.push(['Record', fmt(s.bestScore)])

  return (
    <li className="gs-card" style={gameVars(game.theme)}>
      <header className="gs-head" style={{ background: game.theme.header, color: game.theme.headerText }}>
        <GameIcon game={game} src={icon} size={30} />
        <strong>{game.name}</strong>
      </header>
      <dl className="gs-facts">
        {facts.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      {s.history.length > 0 ? (
        <ol className="gs-history">
          {s.history.map((h) => (
            <li key={h.day}>
              <span className="muted">{SHORT.format(asDate(h.day))}</span>
              <span>{summarize(h.result) || 'Giocato'}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="gs-empty muted">Ancora nessuna partita registrata.</p>
      )}
    </li>
  )
}

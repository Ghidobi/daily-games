// Calcoli su storico e serie. Modulo puro: le date sono chiavi YYYY-MM-DD (fuso Europe/Rome).
import type { DaysData, GameResult } from './types'

/** Sposta una chiave YYYY-MM-DD di `delta` giorni. */
export function shiftDay(dayKey: string, delta: number): string {
  const d = new Date(`${dayKey}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + delta)
  return d.toISOString().slice(0, 10)
}

type DayTest = (dayKey: string) => boolean

/**
 * Serie attuale: giorni consecutivi che soddisfano `test`, contando fino a oggi.
 * Se oggi non è ancora soddisfatto la serie resta viva, partendo da ieri.
 */
function currentStreak(today: string, test: DayTest): number {
  let day = test(today) ? today : shiftDay(today, -1)
  let n = 0
  while (test(day)) {
    n++
    day = shiftDay(day, -1)
  }
  return n
}

function bestStreak(days: string[], test: DayTest): number {
  const sorted = days.filter(test).sort()
  let best = 0
  let run = 0
  let prev = ''
  for (const d of sorted) {
    run = prev && shiftDay(prev, 1) === d ? run + 1 : 1
    best = Math.max(best, run)
    prev = d
  }
  return best
}

const playedGame = (data: DaysData, gameId: string): DayTest => (d) => !!data[d]?.[gameId]?.played
const playedAny = (data: DaysData): DayTest => (d) => Object.values(data[d] ?? {}).some((e) => e.played)

export function streaks(data: DaysData, today: string, gameIds: string[]) {
  return {
    total: currentStreak(today, playedAny(data)),
    games: Object.fromEntries(gameIds.map((id) => [id, currentStreak(today, playedGame(data, id))]))
  }
}

export interface GameStats {
  played: number
  current: number
  best: number
  /** Partite con esito noto e quante vinte. */
  decided: number
  won: number
  avgAttempts?: number
  avgScore?: number
  bestScore?: number
  scoreUnit?: string
  /** Storico dal più recente: [giorno, risultato]. */
  history: { day: string; result?: GameResult }[]
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined)

export function gameStats(data: DaysData, today: string, gameId: string): GameStats {
  const days = Object.keys(data)
  const test = playedGame(data, gameId)
  const history = days
    .filter(test)
    .sort()
    .reverse()
    .map((day) => ({ day, result: data[day][gameId].result }))
  const results = history.map((h) => h.result).filter((r): r is GameResult => !!r)
  const decided = results.filter((r) => r.solved !== undefined)
  const attempts = results.filter((r) => r.solved && r.attempts !== undefined).map((r) => r.attempts!)
  const scores = results.filter((r) => r.score !== undefined).map((r) => r.score!)
  return {
    played: history.length,
    current: currentStreak(today, test),
    best: bestStreak(days, test),
    decided: decided.length,
    won: decided.filter((r) => r.solved).length,
    avgAttempts: avg(attempts),
    avgScore: avg(scores),
    bestScore: scores.length ? Math.max(...scores) : undefined,
    scoreUnit: results.find((r) => r.scoreUnit)?.scoreUnit,
    history
  }
}

export function overallStats(data: DaysData, today: string, gameIds: string[]) {
  const days = Object.keys(data)
  const any = playedAny(data)
  const complete: DayTest = (d) => gameIds.length > 0 && gameIds.every((id) => data[d]?.[id]?.played)
  return {
    current: currentStreak(today, any),
    best: bestStreak(days, any),
    daysPlayed: days.filter(any).length,
    completeDays: days.filter(complete).length,
    gamesPlayed: days.reduce((n, d) => n + Object.values(data[d]).filter((e) => e.played).length, 0)
  }
}

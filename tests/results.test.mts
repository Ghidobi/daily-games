// Test dei riconoscitori e delle serie: node --test tests/
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compactForShare, detectResult, summarize } from '../src/shared/results.ts'
import { gameStats, overallStats, shiftDay, streaks } from '../src/shared/stats.ts'
import { DEFAULT_GAMES } from '../src/shared/catalog.ts'
import type { DaysData } from '../src/shared/types.ts'

const games = DEFAULT_GAMES

test('Spotle Movies: vinto con un aiuto', () => {
  const r = detectResult('Spotle Movies #321\n⬜⬜ℹ️⬜🟩\n\nhttps://spotle.movie/?d=1', games)
  assert.equal(r?.gameId, 'spotle-movies')
  assert.equal(r?.result.puzzle, '321')
  assert.equal(r?.result.solved, true)
  assert.equal(r?.result.attempts, 4)
  assert.equal(r?.result.hints, 1)
  assert.equal(summarize(r?.result), 'Indovinato in 4/10 · 1 aiuto')
})

test('Spotle Movies: perso', () => {
  const r = detectResult('Spotle Movies #321\n⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜❌\n\nhttps://spotle.movie/', games)
  assert.equal(r?.result.solved, false)
  assert.equal(summarize(r?.result), 'Non indovinato')
})

test('Spotle Movies: le partite private non contano', () => {
  assert.equal(detectResult('Spotle Movies — Private Screening\n⬜🟩\n\nhttps://spotle.movie/', games), null)
})

test('Spotle TV: testo copiato', () => {
  const r = detectResult('I got the TV Spotle Daily in 4/10 guesses! 📺\n\nCan you beat me?\nPlay at: https://www.spotle.tv/', games)
  assert.equal(r?.gameId, 'spotle-tv')
  assert.deepEqual([r?.result.solved, r?.result.attempts, r?.result.maxAttempts], [true, 4, 10])
})

test('Spotle TV: perso e modalità non giornaliere', () => {
  assert.equal(detectResult('I got the TV Spotle Daily in X/10 guesses! 📺', games)?.result.solved, false)
  assert.equal(detectResult('I got the TV Spotle Rewind in 3/10 guesses! 📺', games), null)
})

test('Krillion: punteggio e archivio', () => {
  const r = detectResult('Krillion #88 🦐\n1,240\n\n🟦🟪🟥', games)
  assert.equal(r?.gameId, 'krillion')
  assert.equal(r?.result.score, 1240)
  assert.equal(detectResult('Krillion ⟲ #80 🦐\n900\n\n🟦', games), null)
})

test('Farflung: km', () => {
  const r = detectResult('Farflung · Expedition #22\n12,345 km\nfarflung.game', games)
  assert.equal(r?.gameId, 'farflung')
  assert.equal(r?.result.score, 12345)
  assert.equal(detectResult('Farflung · Expedition #22 replay\n9,000 km', games), null)
})

test('testo qualsiasi non è un risultato', () => {
  assert.equal(detectResult('ciao, ci vediamo alle 8?', games), null)
})

test('gioco aggiunto: riconosciuto da indirizzo, tentativi generici', () => {
  const extra = [...games, { id: 'x', name: 'Wordle', url: 'https://www.nytimes.com/games/wordle', category: '', theme: games[0].theme }]
  const r = detectResult('Wordle 1,234 3/6\n⬛🟨⬛⬛⬛\n🟩🟩🟩🟩🟩', extra)
  assert.equal(r?.gameId, 'x')
  assert.equal(r?.result.attempts, 3)
})

test('compactForShare toglie i link', () => {
  assert.equal(compactForShare('A #1\n⬜🟩\n\nhttps://a.b/c'), 'A #1\n⬜🟩')
})

test('serie e statistiche', () => {
  const today = '2026-10-26'
  const data: DaysData = {}
  for (const d of [-4, -3, -1, 0]) data[shiftDay(today, d)] = { krillion: { played: true, result: { text: '', score: 100 + d } } }
  data[shiftDay(today, -1)]['farflung'] = { played: true }
  const s = streaks(data, today, ['krillion', 'farflung'])
  assert.equal(s.total, 2)
  assert.equal(s.games.krillion, 2)
  assert.equal(s.games.farflung, 1) // giocato ieri, oggi non ancora: la serie resta viva
  const g = gameStats(data, today, 'krillion')
  assert.equal(g.best, 2)
  assert.equal(g.played, 4)
  assert.equal(g.bestScore, 100)
  assert.equal(overallStats(data, today, ['krillion', 'farflung']).completeDays, 1)
  assert.equal(shiftDay('2026-03-29', 1), '2026-03-30')
})

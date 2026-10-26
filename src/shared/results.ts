// Riconoscimento dei testi "Condividi" dei giochi. Modulo puro: nessuna dipendenza da Electron.
import type { Game, GameResult } from './types'

interface Parser {
  /** true se il testo è il risultato di oggi di questo gioco. */
  detect(text: string): boolean
  parse(text: string): Omit<GameResult, 'text'>
}

const count = (text: string, needle: string) => text.split(needle).length - 1
const num = (s: string) => Number(s.replace(/[\s,.  ']/g, ''))

// I formati sono ricavati dal codice dei siti (ottobre 2026).
const PARSERS: Record<string, Parser> = {
  // "Spotle Movies #123\n⬜⬜ℹ️⬜🟩\n\nhttps://spotle.movie/…"  (❌ in coda se perso)
  'spotle-movies': {
    detect: (t) => /Spotle Movies #\d+/.test(t),
    parse: (t) => {
      const grid = t.split('\n').find((l) => /[⬜🟩❌]/u.test(l)) ?? ''
      const solved = grid.includes('🟩') ? true : grid.includes('❌') ? false : undefined
      return {
        puzzle: /Spotle Movies #(\d+)/.exec(t)?.[1],
        solved,
        attempts: count(grid, '⬜') + count(grid, '🟩'),
        maxAttempts: 10,
        hints: count(grid, 'ℹ') || undefined
      }
    }
  },

  // "I got the TV Spotle Daily in 4/10 guesses! 📺 …"  oppure "… in X/10 guesses!"
  // (dalla condivisione con immagine: "… Daily in 4 guesses!" o "The TV Spotle Daily stumped me today!")
  'spotle-tv': {
    detect: (t) => /TV Spotle Daily/.test(t),
    parse: (t) => {
      const m = /TV Spotle Daily in (\d+|X)(?:\/(\d+))? guess/.exec(t)
      if (!m) return /stumped/.test(t) ? { solved: false } : {}
      const solved = m[1] !== 'X'
      return {
        solved,
        attempts: solved ? Number(m[1]) : undefined,
        maxAttempts: m[2] ? Number(m[2]) : 10
      }
    }
  },

  // "Krillion #123 🦐\n870\n\n🟦🟪…"  (le partite d'archivio hanno "Krillion ⟲ #": non contano)
  krillion: {
    detect: (t) => /Krillion #\d+/.test(t),
    parse: (t) => {
      const lines = t.split('\n').map((l) => l.trim())
      const head = lines.findIndex((l) => /Krillion #\d+/.test(l))
      const scoreLine = lines.slice(head + 1).find((l) => l !== '')
      const score = scoreLine && /^[\d][\d.,\s']*$/.test(scoreLine) ? num(scoreLine) : undefined
      return { puzzle: /Krillion #(\d+)/.exec(t)?.[1], score, scoreUnit: 'punti' }
    }
  },

  // "… Expedition #22 … 12,345 km … farflung.game"  (repliche e pratica non contano)
  farflung: {
    detect: (t) =>
      /farflung/i.test(t) && !/replay|practice|unlimited/i.test(t) && (/Expedition #\d+/.test(t) || /\bkm\b/.test(t)),
    parse: (t) => {
      const km = /(\d[\d,.   ]*)\s?km\b/.exec(t)
      return {
        puzzle: /Expedition #(\d+)/.exec(t)?.[1],
        score: km ? num(km[1]) : undefined,
        scoreUnit: 'km'
      }
    }
  }
}

/** Ricava tentativi "n/m" o "X/m" da un testo qualsiasi (giochi aggiunti dall'utente). */
function parseGeneric(text: string): Omit<GameResult, 'text'> {
  const m = /\b(\d{1,2}|X)\s?\/\s?(\d{1,2})\b/.exec(text)
  if (!m) return {}
  const solved = m[1] !== 'X'
  return { solved, attempts: solved ? Number(m[1]) : undefined, maxAttempts: Number(m[2]) }
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

/** Un gioco senza riconoscitore dedicato si riconosce dal suo indirizzo o dal suo nome. */
function genericDetect(game: Game, text: string): boolean {
  const host = hostOf(game.url)
  const lower = text.toLowerCase()
  return (!!host && lower.includes(host)) || lower.includes(game.name.toLowerCase())
}

export function hasDedicatedParser(gameId: string): boolean {
  return gameId in PARSERS
}

function cleanText(text: string): string {
  return text.replace(/\r\n/g, '\n').trim()
}

/** Analizza il testo come risultato di un gioco preciso (anche se non lo riconosce: tiene il testo). */
export function parseFor(game: Game, raw: string): GameResult {
  const text = cleanText(raw)
  const parser = PARSERS[game.id]
  const fields = parser ? (parser.detect(text) ? parser.parse(text) : {}) : parseGeneric(text)
  return { text, ...fields }
}

/**
 * Cerca quale gioco della raccolta ha prodotto il testo. `preferId` (il gioco aperto)
 * viene provato per primo. Restituisce null se il testo non sembra un risultato.
 */
export function detectResult(raw: string, games: Game[], preferId?: string): { gameId: string; result: GameResult } | null {
  const text = cleanText(raw)
  if (text.length < 8 || text.length > 4000) return null
  const ordered = [...games].sort((a, b) => Number(b.id === preferId) - Number(a.id === preferId))
  // Prima i riconoscitori dedicati (precisi), poi indirizzo/nome per gli altri giochi.
  for (const game of ordered) {
    const parser = PARSERS[game.id]
    if (parser?.detect(text)) return { gameId: game.id, result: { text, ...parser.parse(text) } }
  }
  for (const game of ordered) {
    if (!PARSERS[game.id] && genericDetect(game, text)) {
      return { gameId: game.id, result: { text, ...parseGeneric(text) } }
    }
  }
  return null
}

/** Riassunto breve in italiano, es. "Indovinato in 4/10", "12.345 km". */
export function summarize(r: GameResult | undefined): string {
  if (!r) return ''
  const parts: string[] = []
  if (r.solved === false) parts.push('Non indovinato')
  else if (r.attempts !== undefined) parts.push(`${r.solved ? 'Indovinato in ' : ''}${r.attempts}${r.maxAttempts ? `/${r.maxAttempts}` : ''}`)
  else if (r.solved) parts.push('Indovinato')
  if (r.score !== undefined) parts.push(`${r.score.toLocaleString('it-IT')} ${r.scoreUnit ?? 'punti'}`)
  if (r.hints) parts.push(`${r.hints} ${r.hints === 1 ? 'aiuto' : 'aiuti'}`)
  return parts.join(' · ') || 'Risultato salvato'
}

/** Toglie righe con soli link o "Play at:" per un messaggio più compatto. */
export function compactForShare(text: string): string {
  return text
    .split('\n')
    .filter((l) => !/^\s*(play at:?\s*)?https?:\/\/\S+\s*$/i.test(l) && !/^\s*can you beat me\??\s*$/i.test(l))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

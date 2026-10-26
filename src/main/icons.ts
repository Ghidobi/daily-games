import { app, net } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Game } from '@shared/types'

// Le icone dei giochi si scaricano dal sito al momento dell'avvio e si tengono in
// cache nella cartella dati dell'utente: nessun logo di terzi nel pacchetto.

const MAX_BYTES = 512 * 1024
const cacheDir = () => join(app.getPath('userData'), 'icons')
const cacheFile = (id: string) => join(cacheDir(), `${id}.txt`)

export function cachedIcon(id: string): string | undefined {
  const file = cacheFile(id)
  return existsSync(file) ? readFileSync(file, 'utf8') : undefined
}

interface Candidate {
  href: string
  score: number
}

/** Estrae dall'HTML i <link rel="icon"> e assegna un punteggio (svg e icone grandi prima). */
function iconCandidates(html: string, base: string): Candidate[] {
  const out: Candidate[] = []
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const rel = /\brel=["']?([^"'>]+)/i.exec(tag)?.[1]?.toLowerCase() ?? ''
    if (!rel.includes('icon')) continue
    const href = /\bhref=["']?([^"'\s>]+)/i.exec(tag)?.[1]
    if (!href) continue
    const sizes = /\bsizes=["']?(\d+)/i.exec(tag)?.[1]
    let score = sizes ? Math.min(Number(sizes), 256) : 32
    if (/\.svg(\?|$)/i.test(href) || /image\/svg/i.test(tag)) score = 300
    if (rel.includes('apple-touch')) score = Math.max(score, 180)
    try {
      out.push({ href: new URL(href.replace(/&amp;/g, '&'), base).href, score })
    } catch {
      /* href non valido */
    }
  }
  out.sort((a, b) => b.score - a.score)
  out.push({ href: new URL('/favicon.ico', base).href, score: 0 })
  return out
}

async function download(url: string): Promise<string | undefined> {
  const res = await net.fetch(url)
  if (!res.ok) return undefined
  let type = res.headers.get('content-type')?.split(';')[0].trim() ?? ''
  if (!type.startsWith('image/')) {
    if (/\.ico(\?|$)/i.test(url)) type = 'image/x-icon'
    else return undefined
  }
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length === 0 || buf.length > MAX_BYTES) return undefined
  return `data:${type};base64,${buf.toString('base64')}`
}

export async function fetchIcon(game: Game): Promise<string | undefined> {
  try {
    const res = await net.fetch(game.url)
    const html = res.ok ? await res.text() : ''
    for (const c of iconCandidates(html, res.url || game.url)) {
      const data = await download(c.href).catch(() => undefined)
      if (data) {
        mkdirSync(cacheDir(), { recursive: true })
        writeFileSync(cacheFile(game.id), data, 'utf8')
        return data
      }
    }
  } catch (err) {
    console.warn(`Icona non disponibile per ${game.name}`, err)
  }
  return undefined
}

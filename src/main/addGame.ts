import { nativeImage, net } from 'electron'
import type { Game, GameTheme } from '@shared/types'
import { iconFromHtml } from './icons'

// Aggiunta di un gioco qualsiasi dal suo indirizzo: nome, colori e icona ricavati dal sito.

/** Accetta "wordle.com" o un indirizzo completo; restituisce null se non è un sito web. */
export function normalizeUrl(input: string): URL | null {
  const raw = input.trim()
  if (!raw) return null
  try {
    const url = new URL(/^[a-z]+:\/\//i.test(raw) ? raw : `https://${raw}`)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    if (!url.hostname.includes('.')) return null
    return url
  } catch {
    return null
  }
}

// ---- colori ----

const hex2 = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0')
const toHex = (r: number, g: number, b: number) => `#${hex2(r)}${hex2(g)}${hex2(b)}`.toUpperCase()

function parseColor(value: string): [number, number, number] | null {
  const v = value.trim()
  let m = /^#([0-9a-f]{3})$/i.exec(v)
  if (m) return [...m[1]].map((c) => parseInt(c + c, 16)) as [number, number, number]
  m = /^#([0-9a-f]{6})/i.exec(v)
  if (m) return [0, 2, 4].map((i) => parseInt(m![1].slice(i, i + 2), 16)) as [number, number, number]
  m = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(v)
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])]
  return null
}

const mix = (a: number[], b: number[], t: number) => a.map((x, i) => x + (b[i] - x) * t)
const luminance = ([r, g, b]: number[]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255

/**
 * Tema completo: `base` (es. il theme-color del sito) dà il colore dell'intestazione,
 * `accent` (es. il colore dell'icona) quello del bordo e dei pulsanti.
 */
export function themeFromColor(base: string, accentColor = base): GameTheme {
  const rgb = parseColor(base) ?? [91, 91, 240]
  const acc = parseColor(accentColor) ?? rgb
  const ink = [13, 17, 23]
  // Un colore quasi nero o quasi bianco non funziona come accento: lo rendiamo più vivo.
  const accent = luminance(acc) < 0.12 ? mix(acc, [255, 255, 255], 0.45) : luminance(acc) > 0.9 ? mix(acc, ink, 0.4) : acc
  const header = mix(rgb, ink, luminance(rgb) < 0.2 ? 0.2 : 0.62)
  return {
    accent: toHex(...(accent as [number, number, number])),
    header: toHex(...(header as [number, number, number])),
    headerText: '#F5F7FB',
    bg: toHex(...(header as [number, number, number]))
  }
}

/** true se il colore ha abbastanza tinta per fare da accento (non nero, bianco o grigio). */
function isColorful(color: string): boolean {
  const rgb = parseColor(color)
  if (!rgb) return false
  const max = Math.max(...rgb)
  const min = Math.min(...rgb)
  return max > 40 && (max - min) / max > 0.25
}

/** Colore dominante (il più saturo e frequente) di un'icona. */
function dominantColor(dataUrl: string): string | undefined {
  const img = nativeImage.createFromDataURL(dataUrl)
  if (img.isEmpty()) return undefined
  const small = img.resize({ width: 32, height: 32 })
  const px = small.toBitmap() // BGRA
  const buckets = new Map<number, { w: number; r: number; g: number; b: number }>()
  for (let i = 0; i < px.length; i += 4) {
    const [b, g, r, a] = [px[i], px[i + 1], px[i + 2], px[i + 3]]
    if (a < 160) continue
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const sat = max === 0 ? 0 : (max - min) / max
    if (sat < 0.25 || max < 40) continue
    const hue = Math.round((Math.atan2(Math.sqrt(3) * (g - b), 2 * r - g - b) + Math.PI) / (Math.PI / 6)) % 12
    const e = buckets.get(hue) ?? { w: 0, r: 0, g: 0, b: 0 }
    const w = sat
    buckets.set(hue, { w: e.w + w, r: e.r + r * w, g: e.g + g * w, b: e.b + b * w })
  }
  const best = [...buckets.values()].sort((x, y) => y.w - x.w)[0]
  return best ? toHex(best.r / best.w, best.g / best.w, best.b / best.w) : undefined
}

/** Colore di riserva stabile ricavato dal nome del sito. */
function colorFromName(name: string): string {
  const palette = ['#5B5BF0', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#8B5CF6', '#14B8A6']
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return palette[h % palette.length]
}

// ---- lettura della pagina ----

const decode = (s: string) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim()

function meta(html: string, key: string): string | undefined {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const name = /\b(?:name|property)=["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase()
    if (name === key) {
      const content = /\bcontent=["']([^"']*)["']/i.exec(tag)?.[1]
      if (content) return decode(content)
    }
  }
  return undefined
}

/** Nome breve: og:site_name, altrimenti il titolo senza la parte descrittiva ("Wordle - A daily…" → "Wordle"). */
function siteName(html: string, host: string): string {
  const fromMeta = meta(html, 'og:site_name') ?? meta(html, 'application-name') ?? meta(html, 'apple-mobile-web-app-title')
  const title = /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1]
  const name = fromMeta ?? (title ? decode(title).split(/\s+[-–—|·:]\s+/)[0] : '')
  if (name && name.length <= 40) return name
  const label = host.replace(/^www\./, '').split('.')[0]
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function makeId(host: string, taken: Set<string>): string {
  const base = host.replace(/^www\./, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase().replace(/^-|-$/g, '') || 'gioco'
  let id = base
  for (let i = 2; taken.has(id); i++) id = `${base}-${i}`
  return id
}

export interface NewGame {
  game: Game
  icon?: string
  /** Avviso se il sito non si è lasciato leggere (nome e colori di riserva). */
  warning?: string
}

/** Legge il sito e prepara il nuovo gioco. Non lo salva. */
export async function buildGame(url: URL, existing: Game[]): Promise<NewGame> {
  const id = makeId(url.hostname, new Set(existing.map((g) => g.id)))
  let html = ''
  let finalUrl = url.href
  let warning: string | undefined
  try {
    const res = await net.fetch(url.href, { signal: AbortSignal.timeout(10_000) })
    finalUrl = res.url || url.href
    if (res.ok) html = await res.text()
    else warning = `Il sito ha risposto con un errore (${res.status}): controlla nome e colore.`
  } catch {
    warning = 'Non sono riuscito a leggere il sito: controlla nome e colore.'
  }
  const host = new URL(finalUrl).hostname
  const icon = html ? await iconFromHtml(id, html, finalUrl).catch(() => undefined) : undefined
  // Intestazione dal theme-color del sito; accento dal colore dell'icona, che di solito
  // è il più riconoscibile (il theme-color spesso è nero, bianco o grigio).
  const themeColor = meta(html, 'theme-color')
  const iconColor = icon ? dominantColor(icon) : undefined
  const vivid = (c?: string) => (c && isColorful(c) && luminance(parseColor(c)!) >= 0.12 ? c : undefined)
  const accent = vivid(iconColor) ?? vivid(themeColor) ?? colorFromName(host)
  const base = themeColor && parseColor(themeColor) ? themeColor : accent
  const game: Game = {
    id,
    name: siteName(html, host),
    url: url.href,
    category: 'Altro',
    theme: themeFromColor(base, accent)
  }
  return { game, icon, warning }
}

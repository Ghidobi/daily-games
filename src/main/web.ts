// Regole su user agent, domini di login e link esterni per le viste dei giochi.

/**
 * User agent di un Chrome standard con la stessa versione di Chromium di Electron,
 * senza "Electron" né il nome dell'app: Google blocca l'accesso dai browser che
 * si dichiarano incorporati.
 */
export function chromeUserAgent(): string {
  const major = process.versions.chrome.split('.')[0]
  const platform =
    process.platform === 'darwin'
      ? 'Macintosh; Intel Mac OS X 10_15_7'
      : process.platform === 'linux'
        ? 'X11; Linux x86_64'
        : 'Windows NT 10.0; Win64; x64'
  return `Mozilla/5.0 (${platform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Safari/537.36`
}

/** Valore dell'header Sec-CH-UA di un Chrome "vero" (Electron non dichiara il marchio Google Chrome). */
export function chromeClientHints(): string {
  const major = process.versions.chrome.split('.')[0]
  return `"Google Chrome";v="${major}", "Chromium";v="${major}", "Not_A Brand";v="24"`
}

// Domini dei fornitori di login che possono aprirsi dentro l'app (in un popup).
const AUTH_HOSTS = [
  'accounts.google.com',
  'accounts.youtube.com',
  'appleid.apple.com',
  'www.facebook.com',
  'm.facebook.com',
  'login.microsoftonline.com',
  'login.live.com',
  'discord.com',
  'github.com',
  'api.twitter.com',
  'x.com'
]
const AUTH_PATH = /oauth|auth|login|signin|sign-in|dialog/i

export function parseUrl(url: string): URL | null {
  try {
    return new URL(url)
  } catch {
    return null
  }
}

/** Dominio "registrabile" approssimato: ultime due etichette (tre per co.uk, com.au…). */
export function siteOf(host: string): string {
  const parts = host.toLowerCase().split('.')
  const twoLevel = /^(co|com|net|org|gov|ac)$/.test(parts[parts.length - 2] ?? '')
  return parts.slice(twoLevel ? -3 : -2).join('.')
}

export function isSameSite(a: string, b: string): boolean {
  const ua = parseUrl(a)
  const ub = parseUrl(b)
  return !!ua && !!ub && siteOf(ua.hostname) === siteOf(ub.hostname)
}

export function isAuthUrl(url: string): boolean {
  const u = parseUrl(url)
  if (!u) return false
  if (u.hostname === 'accounts.google.com' || u.hostname === 'appleid.apple.com') return true
  return AUTH_HOSTS.includes(u.hostname) && AUTH_PATH.test(u.pathname + u.search)
}

export function isHttp(url: string): boolean {
  const u = parseUrl(url)
  return !!u && (u.protocol === 'https:' || u.protocol === 'http:')
}

/** Riconosce le pagine con cui Google rifiuta l'accesso da un browser incorporato. */
export function isGoogleRejection(url: string): boolean {
  const u = parseUrl(url)
  if (!u || u.hostname !== 'accounts.google.com') return false
  return /\/signin\/rejected|disallowed_useragent/i.test(u.pathname + u.search)
}

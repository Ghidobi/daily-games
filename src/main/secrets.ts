import { app, safeStorage } from 'electron'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

// Chiave API di Anthropic: cifrata con il sistema operativo (DPAPI su Windows, Portachiavi su Mac)
// e salvata in un file separato da data.json, così non finisce mai nei backup esportati.
// Non viene mai inviata all'interfaccia: lì arrivano solo "c'è / non c'è" e le ultime 4 cifre.

const file = () => join(app.getPath('userData'), 'secrets.json')

interface SecretsFile {
  anthropicKey?: string // base64 del testo cifrato
}

function read(): SecretsFile {
  try {
    return existsSync(file()) ? (JSON.parse(readFileSync(file(), 'utf8')) as SecretsFile) : {}
  } catch {
    return {}
  }
}

let cached: string | undefined

export async function getApiKey(): Promise<string | undefined> {
  if (cached) return cached
  const enc = read().anthropicKey
  if (!enc) return undefined
  try {
    const { result, shouldReEncrypt } = await safeStorage.decryptStringAsync(Buffer.from(enc, 'base64'))
    cached = result
    if (shouldReEncrypt) await setApiKey(result)
    return result
  } catch {
    return undefined // cifrata su un altro PC o con un altro utente: va reinserita
  }
}

export async function setApiKey(key: string): Promise<void> {
  if (!(await safeStorage.isAsyncEncryptionAvailable())) {
    throw new Error('Il salvataggio sicuro non è disponibile su questo PC.')
  }
  const enc = await safeStorage.encryptStringAsync(key)
  mkdirSync(dirname(file()), { recursive: true })
  writeFileSync(file(), JSON.stringify({ ...read(), anthropicKey: enc.toString('base64') }), 'utf8')
  cached = key
}

export function removeApiKey(): void {
  cached = undefined
  const { anthropicKey: _k, ...rest } = read()
  if (Object.keys(rest).length) writeFileSync(file(), JSON.stringify(rest), 'utf8')
  else rmSync(file(), { force: true })
}

/** "…AbCd" per mostrare quale chiave è salvata senza rivelarla. */
export function maskKey(key: string | undefined): string | undefined {
  return key ? `…${key.slice(-4)}` : undefined
}

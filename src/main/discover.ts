import Anthropic from '@anthropic-ai/sdk'

// "Scopri nuovi giochi": Claude cerca sul web giochi giornalieri simili a quelli della raccolta.
// Modello e strumento verificati sulla documentazione ufficiale (ottobre 2026).

const MODEL = 'claude-opus-5-5'
// Prezzi di claude-opus-5-5 per la stima del costo mostrata all'utente (USD).
const PRICE = { input: 4 / 1e6, output: 20 / 1e6, cacheRead: 0.2 / 1e6, cacheWrite: 5 / 1e6, search: 10 / 1000 }

export const CATEGORIES = ['Film e TV', 'Geografia', 'Parole', 'Indovinelli', 'Quiz', 'Musica', 'Logica', 'Sport', 'Altro']

export interface Found {
  name: string
  url: string
  description: string
  category: string
  reason?: string
}

export interface DiscoveryContext {
  /** Giochi della raccolta (nome + indirizzo). */
  owned: { name: string; url: string; category: string }[]
  /** Già proposti in passato (scartati o meno): da non riproporre. */
  excluded: { name: string; url: string }[]
}

const REPORT_TOOL: Anthropic.Beta.BetaTool = {
  name: 'report_games',
  description: 'Consegna l’elenco finale dei giochi trovati. Chiamalo una sola volta, alla fine della ricerca.',
  strict: true,
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['games'],
    properties: {
      games: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['name', 'url', 'description', 'category', 'reason'],
          properties: {
            name: { type: 'string', description: 'Nome del gioco' },
            url: { type: 'string', description: 'Indirizzo della pagina dove si gioca (https://…)' },
            description: { type: 'string', description: 'Cosa si fa, in italiano, massimo 160 caratteri' },
            category: { type: 'string', enum: CATEGORIES },
            reason: { type: 'string', description: 'Perché può piacere a chi gioca ai giochi della raccolta, in italiano, massimo 100 caratteri' }
          }
        }
      }
    }
  }
}

const SYSTEM = `Aiuti un giocatore italiano a scoprire nuovi giochi giornalieri sul web: un nuovo enigma ogni giorno, si gioca gratis nel browser senza installare nulla, stile Wordle (quiz su film e serie TV, geografia, parole, indovinelli, logica, musica).

Usa la ricerca web per trovare giochi che esistono davvero e sono attivi oggi. Preferisci giochi che hanno un risultato da condividere. Escludi app solo per telefono, giochi a pagamento, siti di raccolte o elenchi, cloni abbandonati e qualsiasi gioco già posseduto o già proposto. Va bene anche un gioco in inglese.

Alla fine chiama report_games con 6-8 giochi, ognuno con l'indirizzo esatto della pagina dove si gioca.`

function buildPrompt(ctx: DiscoveryContext): string {
  const owned = ctx.owned.map((g) => `- ${g.name} (${g.url}) [${g.category}]`).join('\n')
  const excluded = ctx.excluded.length ? ctx.excluded.map((g) => `- ${g.name} (${g.url})`).join('\n') : '(nessuno)'
  return `Giochi che ho già e mi piacciono:\n${owned}\n\nGià proposti in passato, da NON riproporre:\n${excluded}\n\nTrova nuovi giochi giornalieri simili da provare.`
}

function usageCost(u: Anthropic.Beta.BetaUsage): number {
  return (
    (u.input_tokens ?? 0) * PRICE.input +
    (u.output_tokens ?? 0) * PRICE.output +
    (u.cache_read_input_tokens ?? 0) * PRICE.cacheRead +
    (u.cache_creation_input_tokens ?? 0) * PRICE.cacheWrite +
    (u.server_tool_use?.web_search_requests ?? 0) * PRICE.search
  )
}

/** Controlla a mano l'input del tool (l'SDK non garantisce la forma). */
export function parseGames(input: unknown): Found[] {
  const games = (input as { games?: unknown })?.games
  if (!Array.isArray(games)) return []
  return games.flatMap((g): Found[] => {
    if (!g || typeof g !== 'object') return []
    const { name, url, description, category, reason } = g as Record<string, unknown>
    if (typeof name !== 'string' || typeof url !== 'string' || !/^https?:\/\//.test(url)) return []
    return [
      {
        name: name.trim().slice(0, 40),
        url: url.trim(),
        description: typeof description === 'string' ? description.trim().slice(0, 200) : '',
        category: typeof category === 'string' && CATEGORIES.includes(category) ? category : 'Altro',
        reason: typeof reason === 'string' ? reason.trim().slice(0, 140) : undefined
      }
    ]
  })
}

/** Messaggio in italiano per gli errori dell'API. */
export function explainError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return 'La chiave API non è valida o è stata revocata. Controllala nelle impostazioni.'
  if (err instanceof Anthropic.PermissionDeniedError) return 'La chiave API non ha i permessi necessari (serve l’accesso alla ricerca web).'
  if (err instanceof Anthropic.RateLimitError) return 'Troppe richieste in poco tempo: riprova tra un minuto.'
  if (err instanceof Anthropic.BadRequestError) {
    return /credit|balance|billing/i.test(err.message)
      ? 'Il credito del tuo account Anthropic è esaurito: ricaricalo su console.anthropic.com.'
      : `Richiesta rifiutata da Anthropic: ${err.message}`
  }
  if (err instanceof Anthropic.APIConnectionError) return 'Impossibile contattare Anthropic: controlla la connessione a internet.'
  if (err instanceof Anthropic.APIError) return `Errore del servizio Anthropic (${err.status}). Riprova più tardi.`
  return err instanceof Error ? err.message : `Errore imprevisto: ${String(err)}`
}

/** Verifica che la chiave funzioni (richiesta gratuita all'elenco modelli). */
export async function checkKey(apiKey: string): Promise<void> {
  const client = new Anthropic({ apiKey, maxRetries: 1, timeout: 20_000 })
  await client.models.retrieve(MODEL)
}

/** Esegue la ricerca; restituisce i giochi trovati e una stima del costo. */
export async function runDiscovery(
  apiKey: string,
  ctx: DiscoveryContext,
  /** Solo per i test: sostituisce la connessione di rete. */
  fetchImpl?: typeof fetch
): Promise<{ games: Found[]; cost: number }> {
  const client = new Anthropic({ apiKey, timeout: 5 * 60_000, maxRetries: 2, ...(fetchImpl ? { fetch: fetchImpl } : {}) })
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: 'user', content: buildPrompt(ctx) }]
  let cost = 0
  // La ricerca web può mettere in pausa il turno (pause_turn): si riprende rimandando la risposta.
  for (let round = 0; round < 6; round++) {
    const res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      output_config: { effort: 'medium' },
      // Se il modello rifiuta la richiesta, l'API la ripete su un modello di riserva.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 8 }, REPORT_TOOL],
      messages
    })
    cost += usageCost(res.usage)
    const report = res.content.find(
      (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use' && b.name === 'report_games'
    )
    if (report && res.stop_reason !== 'max_tokens') return { games: parseGames(report.input), cost }
    if (res.stop_reason === 'refusal') throw new Error('La richiesta è stata rifiutata. Riprova più tardi.')
    if (res.stop_reason === 'pause_turn') {
      messages.push({ role: 'assistant', content: res.content })
      continue
    }
    // Ha finito senza consegnare l'elenco: glielo chiediamo esplicitamente una volta.
    messages.push({ role: 'assistant', content: res.content })
    messages.push({ role: 'user', content: 'Ora consegna il risultato chiamando report_games.' })
  }
  throw new Error('La ricerca non ha prodotto risultati. Riprova.')
}

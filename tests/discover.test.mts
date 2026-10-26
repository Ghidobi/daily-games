// Test della ricerca "Scopri" con risposte simulate dell'API (nessuna chiamata vera, nessun costo).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseGames, runDiscovery } from '../src/main/discover.ts'

const ctx = {
  owned: [{ name: 'Spotle Movies', url: 'https://spotle.movie/', category: 'Film' }],
  excluded: [{ name: 'Framed', url: 'https://framed.wtf/' }]
}

const usage = { input_tokens: 10_000, output_tokens: 1_000, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, server_tool_use: { web_search_requests: 3, web_fetch_requests: 0 } }

function message(content: unknown[], stop_reason: string) {
  return { id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content, stop_reason, stop_sequence: null, usage }
}

/** fetch finto: restituisce in ordine le risposte date e registra i corpi delle richieste. */
function fakeFetch(responses: unknown[]) {
  const bodies: any[] = []
  const impl = (async (_url: unknown, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)))
    const next = responses.shift()
    return new Response(JSON.stringify(next), { status: 200, headers: { 'content-type': 'application/json' } })
  }) as typeof fetch
  return { impl, bodies }
}

const report = {
  type: 'tool_use',
  id: 'toolu_1',
  name: 'report_games',
  input: {
    games: [
      { name: 'Movie Grid', url: 'https://moviegrid.io/', description: 'Griglia di film', category: 'Film e TV', reason: 'Come Spotle' },
      { name: 'Senza URL', url: 'non-un-indirizzo', description: 'x', category: 'Quiz', reason: '' },
      { name: 'Worldle', url: 'https://worldle.teuteuf.fr/', description: 'Indovina il paese', category: 'Inventata', reason: 'Geografia' }
    ]
  }
}

test('ricerca: riprende dopo pause_turn e legge report_games', async () => {
  const { impl, bodies } = fakeFetch([
    message([{ type: 'text', text: 'Cerco…' }], 'pause_turn'),
    message([{ type: 'text', text: 'Ecco' }, report], 'tool_use')
  ])
  const { games, cost } = await runDiscovery('sk-ant-test', ctx, impl)
  assert.equal(bodies.length, 2)
  // Richiesta: modello, strumenti e fallback come da documentazione.
  assert.equal(bodies[0].model, 'claude-opus-5-5')
  assert.deepEqual(bodies[0].tools.map((t: any) => t.type ?? t.name), ['web_search_20260209', 'report_games'])
  assert.equal(bodies[0].fallbacks, 'default')
  assert.match(bodies[0].messages[0].content, /Framed/) // esclusi passati al modello
  // Dopo pause_turn la risposta in pausa viene rimandata come turno dell'assistente.
  assert.equal(bodies[1].messages.at(-1).role, 'assistant')
  assert.deepEqual(games.map((g) => g.name), ['Movie Grid', 'Worldle'])
  assert.equal(games[1].category, 'Altro') // categoria fuori elenco
  // Due risposte, ognuna con 10k token in ingresso, 1k in uscita e 3 ricerche.
  assert.ok(Math.abs(cost - 2 * (10_000 * 4e-6 + 1_000 * 20e-6 + 3 * 0.01)) < 1e-9)
})

test('ricerca: se finisce senza elenco, lo chiede una volta', async () => {
  const { impl, bodies } = fakeFetch([message([{ type: 'text', text: 'Ho trovato…' }], 'end_turn'), message([report], 'tool_use')])
  const { games } = await runDiscovery('sk-ant-test', ctx, impl)
  assert.equal(games.length, 2)
  assert.match(bodies[1].messages.at(-1).content, /report_games/)
})

test('parseGames scarta input malformati', () => {
  assert.deepEqual(parseGames(null), [])
  assert.deepEqual(parseGames({ games: 'no' }), [])
  assert.equal(parseGames({ games: [{ name: 'A', url: 'https://a.io' }] })[0].description, '')
})

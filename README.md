# Daily Games

App desktop per Windows (e in futuro Mac) che raccoglie in un unico posto i giochi giornalieri:
ogni gioco si apre in una scheda propria, con il sito originale, i colori del gioco e l'accesso
che resta salvato tra un avvio e l'altro.

Giochi iniziali: [Spotle Movies](https://spotle.movie/), [Farflung](https://farflung.game/),
[Krillion](https://krillion.io/), [Spotle TV](https://www.spotle.tv/).

> **Stato:** fase 4 (scoperta di nuovi giochi). Gli aggiornamenti automatici e la distribuzione
> agli amici arriveranno nella fase 5.

## Cosa fa

- **Una scheda per gioco** con una vista web vera (Electron `WebContentsView`, non iframe),
  intestazione e bordo nei colori del gioco, icona scaricata dalla favicon del sito all'avvio.
- **Accesso persistente:** ogni gioco ha una sessione separata e permanente (cookie, localStorage).
- **Link esterni** (pubblicità, social) e finestre non di login si aprono nel browser predefinito.
- **Pagina "Oggi"** con lo stato di ogni gioco (da giocare / giocato), che si azzera a mezzanotte
  ora di Roma, e il pulsante **Prossimo gioco**.
- **Tema** chiaro, scuro o di sistema; barra laterale compatta sugli schermi piccoli.
- **Risultati salvati da soli:** quando premi «Condividi» in un gioco, l'app riconosce il testo
  copiato, lo salva come risultato di oggi, segna il gioco come giocato e mostra un avviso con
  **Annulla**. Funziona anche se copi un risultato da un gioco aperto nel browser (basta tornare
  sull'app). Puoi sempre **incollarlo a mano** (pulsante «Incolla risultato»).
- **Serie** di giorni consecutivi, totale e per gioco (la serie resta viva finché la giornata non
  è finita).
- **Statistiche:** serie attuale e migliore, giorni giocati, giornate complete, calendario mensile,
  e per ogni gioco storico, percentuale di vittorie, media dei tentativi o dei punteggi.
- **Condividi la mia giornata:** copia negli appunti un unico messaggio con i risultati di oggi,
  pronto da incollare su WhatsApp.
- **Raccolta** («Gestisci raccolta» nella barra laterale):
  - aggiungi un gioco qualsiasi incollando il suo indirizzo: nome, icona e colori vengono letti
    dal sito (puoi correggerli);
  - riordina trascinando, qui o direttamente nella barra laterale;
  - rinomina, cambia categoria e colore, nascondi (resta nella raccolta) o elimina (puoi anche
    cancellarne l'accesso salvato). Lo storico di un gioco eliminato resta: se lo riaggiungi
    ritrovi le statistiche.
- **Impostazioni** (ingranaggio in basso a sinistra):
  - **promemoria**: notifica di Windows all'ora scelta, solo se non hai finito i giochi;
  - **area di notifica**: chiudendo la finestra l'app resta attiva vicino all'orologio (tasto
    destro sull'icona → Esci per chiuderla davvero);
  - **avvio con Windows** (solo nell'app installata), ridotta nell'area di notifica;
  - **esporta / importa** raccolta, statistiche e impostazioni in un file JSON, per backup o per
    passare a un altro PC (incluso lo storico delle scoperte). Gli accessi ai giochi non sono inclusi. Prima di ogni importazione
    l'app salva una copia dei dati attuali in `%APPDATA%\Daily Games\backup\`.

### Scopri nuovi giochi

La pagina **Scopri** usa Claude (modello `claude-opus-5-5`) con lo strumento di ricerca web
(`web_search_20260209`) dell'API di Anthropic per trovare giochi giornalieri simili ai tuoi.

- **Chiave API:** ognuno usa la propria. Si crea su
  [console.anthropic.com](https://console.anthropic.com/settings/keys) (serve un po' di credito in
  «Billing») e si incolla nella pagina Scopri o nelle Impostazioni. L'app la verifica, la cifra con
  Windows (DPAPI) e la salva in `%APPDATA%\Daily Games\secrets.json`: non è nel codice, non va
  nel pacchetto, non finisce nei backup e non viene mai mostrata per intero.
- **Costo:** ogni ricerca costa in genere qualche decina di centesimi di dollaro, addebitati sul
  tuo account Anthropic; dopo ogni ricerca l'app mostra una stima.
- Ogni proposta ha nome, descrizione, categoria, il motivo per cui potrebbe piacerti e tre
  pulsanti: **Prova** (scheda temporanea: gli accessi fatti lì non restano salvati),
  **Aggiungi** alla raccolta, **Scarta** (non verrà più riproposto).
- La ricerca esclude i giochi che hai già e quelli già proposti; lo **storico delle scoperte**
  resta in fondo alla pagina (da lì puoi anche ripristinare un gioco scartato).
- Se il modello rifiuta una richiesta, l'API la ripete da sola su un modello di riserva
  (parametro `fallbacks: "default"`).

### Come vengono riconosciuti i risultati

| Gioco | Testo riconosciuto | Cosa viene salvato |
|---|---|---|
| Spotle Movies | `Spotle Movies #321` + riga di quadrati | tentativi su 10, vinto/perso, aiuti |
| Spotle TV | `I got the TV Spotle Daily in 4/10 guesses!` | tentativi su 10, vinto/perso |
| Krillion | `Krillion #88 🦐` + punteggio | punti |
| Farflung | testo con `Farflung` / `Expedition #` e i km | km |

Le partite di archivio, le repliche e le sfide private non contano come risultato del giorno.
Un gioco aggiunto da te viene riconosciuto dal suo nome o indirizzo nel testo, con i tentativi
nel formato `3/6`.

Nota tecnica: dentro l'app la condivisione nativa di Windows è disattivata per i giochi, così il
pulsante «Condividi» copia sempre il testo negli appunti (dove l'app lo trova, e da dove puoi
incollarlo dove vuoi).

### Scorciatoie da tastiera

| Tasti | Azione |
|---|---|
| `Ctrl+1` … `Ctrl+9` | Apri il gioco n. 1…9 |
| `Ctrl+0` | Pagina Oggi |
| `Ctrl+Tab` / `Ctrl+Shift+Tab` | Scheda successiva / precedente |
| `Ctrl+N` | Prossimo gioco da giocare |
| `Ctrl+Shift+S` | Statistiche |
| `F5` o `Ctrl+R` | Ricarica il gioco |
| `Alt+←` | Indietro nel gioco |
| `F12` | Strumenti per sviluppatori |

## Accesso con Google

Google spesso blocca l'accesso dai browser "incorporati". L'app fa così:

1. Tutte le schede dei giochi si presentano come un **Chrome standard** (user agent e
   intestazioni senza "Electron").
2. Se un gioco apre un **popup di accesso** (Google, Apple, Facebook, Microsoft, Discord…), il
   popup si apre in una finestra dell'app che usa **la stessa sessione del gioco**, così dopo il
   login il gioco ti riconosce.
3. Se Google rifiuta comunque l'accesso, l'app chiude il popup e propone **Apri nel browser**
   (c'è anche sempre il pulsante con la freccia nell'intestazione della scheda). Attenzione: un
   accesso fatto nel browser esterno resta nel browser, non passa all'app.

Nota: i 4 giochi iniziali non richiedono un account; salvano i progressi nel sito stesso
(localStorage), che l'app conserva.

## Avviare l'app in sviluppo

Servono [Node.js](https://nodejs.org/) (versione LTS) e [Git](https://git-scm.com/).

```bash
npm install
```

```bash
npm run dev
```

Se all'avvio compare l'errore "Electron failed to install correctly", scarica il programma
Electron a mano e riprova:

```bash
node node_modules/electron/install.js
```

Altri comandi:

| Comando | Cosa fa |
|---|---|
| `npm run build` | Compila l'app nella cartella `out/` |
| `npm start` | Avvia la versione compilata |
| `npm run typecheck` | Controlla i tipi TypeScript |
| `npm test` | Prova riconoscitori dei risultati, serie e ricerca (con risposte simulate, senza costi) |

Per provare l'app senza toccare i tuoi dati veri, avviala con un profilo separato
(in PowerShell):

```powershell
$env:DAILY_GAMES_PROFILE = "C:\temp\profilo-prova"; npm run dev
```

## Dove sono i dati

Tutti i dati personali restano sul PC, nella cartella dell'utente, **mai nel progetto o nel
pacchetto di installazione**:

- Windows: `%APPDATA%\Daily Games\`
  - `data.json`: raccolta dei giochi, stato dei giorni, risultati, impostazioni
  - `Partitions\game-*`: sessioni e accessi dei singoli giochi
  - `icons\`: icone dei giochi scaricate dai siti
  - `backup\`: copie automatiche fatte prima di importare un backup
  - `secrets.json`: la chiave API di Anthropic, cifrata (se l'hai inserita)

Per ricominciare da zero basta chiudere l'app e cancellare quella cartella.

## Struttura del progetto

```
src/
  main/        processo principale Electron
    index.ts      finestra, scorciatoie, comunicazione con l'interfaccia
    gameViews.ts  una vista web per gioco, popup di login, link esterni
    capture.ts    osservazione degli appunti per i risultati
    addGame.ts    aggiunta di un gioco da URL (nome, icona, colori)
    system.ts     area di notifica, notifiche, avvio con Windows
    discover.ts   ricerca di nuovi giochi con l'API di Anthropic
    secrets.ts    chiave API cifrata (safeStorage)
    web.ts        user agent, domini di login, regole sui link
    store.ts      salvataggio dei dati (data.json)
    day.ts        giornata secondo il fuso Europe/Rome
    icons.ts      download delle favicon
  preload/
    index.ts      ponte sicuro tra interfaccia e processo principale
    game.ts       nei giochi: intercetta il testo copiato da «Condividi»
  renderer/    interfaccia React (barra laterale, Oggi, Statistiche, schede)
  shared/
    types.ts      tipi condivisi
    catalog.ts    i giochi iniziali con i loro colori
    results.ts    riconoscimento dei risultati dei giochi
    stats.ts      serie e statistiche
tests/         test automatici (npm test)
```

## Compilare e installare

```bash
npm run dist
```

Crea nella cartella `release/` due file:

| File | Cosa è |
|---|---|
| `Daily-Games-Setup-<versione>.exe` | **Installer**: installa l'app per il tuo utente, con collegamento sul desktop e nel menu Start. Si disinstalla da Impostazioni → App. |
| `Daily-Games-<versione>-portatile.exe` | **Versione portatile**: un solo file, si avvia con doppio clic senza installare nulla (il primo avvio impiega qualche secondo in più). Windows potrebbe non mostrarne le notifiche del promemoria: per quelle usa l'installer. |

Entrambe usano gli stessi dati in `%APPDATA%\Daily Games\`, quindi accessi e statistiche restano
anche passando da una all'altra o aggiornando.

**Avviso di Windows:** l'app non ha una firma digitale (costa qualche centinaio di euro l'anno),
quindi al primo avvio Windows mostra **"Windows ha protetto il PC"**. Per proseguire clicca
**Ulteriori informazioni → Esegui comunque**. Se il browser segnala il download come insolito,
scegli **Mantieni**.

La distribuzione agli amici e gli aggiornamenti automatici tramite GitHub Releases arriveranno
nella fase 5.

Nota: con le versioni recenti di npm gli script di installazione dei pacchetti sono bloccati
finché non li approvi; se Electron non parte dopo `npm install`, esegui
`node node_modules/electron/install.js` (vedi sopra).

## Idee per il futuro

- Classifiche condivise con gli amici e account online (richiedono un server).

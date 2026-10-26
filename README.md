# Daily Games

App desktop per Windows (e in futuro Mac) che raccoglie in un unico posto i giochi giornalieri:
ogni gioco si apre in una scheda propria, con il sito originale, i colori del gioco e l'accesso
che resta salvato tra un avvio e l'altro.

Giochi iniziali: [Spotle Movies](https://spotle.movie/), [Farflung](https://farflung.game/),
[Krillion](https://krillion.io/), [Spotle TV](https://www.spotle.tv/).

> **Stato:** fase 2 (risultati e statistiche). Gestione della raccolta, promemoria, scoperta di
> nuovi giochi, installer e aggiornamenti automatici arriveranno nelle fasi successive.

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
| `npm test` | Prova i riconoscitori dei risultati e il calcolo delle serie |

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

Per ricominciare da zero basta chiudere l'app e cancellare quella cartella.

## Struttura del progetto

```
src/
  main/        processo principale Electron
    index.ts      finestra, scorciatoie, comunicazione con l'interfaccia
    gameViews.ts  una vista web per gioco, popup di login, link esterni
    capture.ts    osservazione degli appunti per i risultati
    web.ts        user agent, domini di login, regole sui link
    store.ts      salvataggio dei dati (data.json)
    day.ts        giornata secondo il fuso Europe/Rome
    icons.ts      download delle favicon
    catalog.ts    i giochi iniziali con i loro colori
  preload/
    index.ts      ponte sicuro tra interfaccia e processo principale
    game.ts       nei giochi: intercetta il testo copiato da «Condividi»
  renderer/    interfaccia React (barra laterale, Oggi, Statistiche, schede)
  shared/
    types.ts      tipi condivisi
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
| `Daily-Games-<versione>-portatile.exe` | **Versione portatile**: un solo file, si avvia con doppio clic senza installare nulla (il primo avvio impiega qualche secondo in più). |

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

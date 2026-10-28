# NOTE di lavoro – Daily Games

Diario del progetto per riprendere il lavoro da qualsiasi PC.
Aggiornato al **28/10/2026**. Il README spiega *come si usa e come si installa* l'app; questo
file spiega *cosa è stato fatto, perché, e a che punto siamo*.

---

## 1. Cos'è

App desktop (Electron) che raccoglie in un unico posto i giochi giornalieri: ogni gioco si apre
in una scheda propria con il sito originale, nei colori del gioco, con l'accesso che resta
salvato. Giochi iniziali: Spotle Movies, Farflung, Krillion, Spotle TV.

- Interfaccia in **italiano**, Windows. La versione Mac è **sospesa** (vedi sotto).
- Repository **pubblico** (serve per gli aggiornamenti automatici degli amici):
  https://github.com/Ghidobi/daily-games (branch `main`).
- Ultima versione pubblicata: **0.6.0** (26/10/2026) –
  https://github.com/Ghidobi/daily-games/releases/latest
- Licenza MIT. Nessun logo di terzi nel pacchetto: le icone dei giochi si scaricano all'avvio.

---

## 2. Rimettere in piedi l'ambiente su un altro PC

Servono Node.js LTS (≥ 24), Git e, per pubblicare, GitHub CLI.

```powershell
winget install OpenJS.NodeJS.LTS Git.Git GitHub.cli
git clone https://github.com/Ghidobi/daily-games.git
cd daily-games
npm install
# npm ≥ 11 blocca gli script di installazione: Electron va scaricato a mano
node node_modules/electron/install.js
npm run dev
```

Comandi utili:

| Comando | Cosa fa |
|---|---|
| `npm run dev` | Avvia l'app in sviluppo (ricarica al volo l'interfaccia) |
| `npm test` | 14 test: riconoscitori dei risultati, serie, ricerca "Scopri" con API simulata |
| `npm run typecheck` | Controllo dei tipi TypeScript |
| `npm run dist` | Exe Windows in `release/` (installer + portatile) |
| `npm run release` / `release:patch` | Nuova versione minore / correttiva, tag, push → GitHub compila e pubblica |

Profilo separato per le prove (non tocca i dati veri):

```powershell
$env:DAILY_GAMES_PROFILE = "C:\temp\profilo-prova"; npm run dev
```

Per pubblicare: `gh auth login --web` una volta. Autore dei commit impostato nel repository
locale: `Ghidobi <348372989+Ghidobi@users.noreply.github.com>` (indirizzo anonimo di GitHub, la
mail personale non compare). Prima del primo push la cronologia è stata riscritta con questo
autore.

---

## 3. Stack

- **Electron 45** con `BaseWindow` + una `WebContentsView` per l'interfaccia e una per ogni gioco.
- **electron-vite 6** + **Vite 8** + **React 19** + **TypeScript 7**.
- **electron-builder 26** (NSIS + portatile; Mac dmg/zip universale), **electron-updater 6**.
- **@anthropic-ai/sdk 1.3** (incluso nel bundle), **@ghostery/adblocker-electron 2.20**.
- Dati in JSON (`%APPDATA%\Daily Games\data.json`), nessun database nativo.

Struttura: `src/main` (processo principale), `src/preload` (ponte verso l'interfaccia e preload
dei giochi), `src/renderer` (React), `src/shared` (tipi, catalogo, riconoscitori, statistiche),
`tests/`, `.github/workflows/release.yml`.

---

## 4. Diario delle fasi

### Fase 1 – Scheletro (commit `deae5eb`)
- Una `WebContentsView` per gioco, creata alla prima apertura e tenuta viva; l'interfaccia
  riserva un riquadro e il processo principale ci posiziona sopra la vista (le viste stanno
  sopra l'HTML: con una finestra di dialogo aperta la vista del gioco va nascosta).
- Sessione persistente per gioco: `persist:game-<id>`.
- Colori ricavati visitando i siti (sfondo, testo, accento); favicon scaricate all'avvio e in
  cache.
- Pagina "Oggi" con stato giocato/da giocare, azzeramento a mezzanotte **Europe/Rome**
  (controllo ogni 30 s, regge alla sospensione), "Prossimo gioco", Ctrl+1…9, Ctrl+0, Ctrl+Tab,
  Ctrl+N; tema chiaro/scuro/sistema. Direzione grafica scelta: **A "Arcade pulito"**.
- Login Google: UA da Chrome standard + header Sec-CH-UA da Chrome sulle pagine Google; popup
  di login nell'app nella **stessa sessione** del gioco; se Google rifiuta ("signin/rejected",
  "disallowed_useragent") → avviso con "Apri nel browser". Link esterni e pubblicità → browser.

### Fase 2 – Risultati e statistiche (commit `e79fea2`)
- Formati del testo "Condividi" ricavati **leggendo il codice dei siti**:
  Spotle Movies (`Spotle Movies #N` + quadrati, ❌ se perso), Spotle TV
  (`TV Spotle Daily in 4/10`), Krillion (`Krillion #N` + punteggio; `⟲` = archivio, escluso),
  Farflung (riconosciuto da nome/`Expedition #`/km: **formato esatto non verificato**).
- Cattura: il preload dei giochi intercetta `navigator.clipboard.writeText` e **disattiva
  `navigator.share`** (su Windows aprirebbe la condivisione di sistema senza toccare gli
  appunti); in più controllo degli appunti ogni secondo a finestra attiva (copre
  `execCommand('copy')` e i risultati copiati dal browser).
- Electron 45: `clipboard.readText/writeText` sono **asincroni** (Promise).
- Salvataggio automatico con avviso "Annulla", incolla a mano, serie (totale e per gioco),
  statistiche con calendario, "Condividi la mia giornata" per WhatsApp.

### Pacchetto Windows (commit `83ad56b`)
- Installer NSIS per utente + exe portatile; icona propria (`scripts/make-icon.ps1`).
- Dipendenze dell'interfaccia in `devDependencies` (finiscono nel bundle); in `dependencies`
  solo ciò che serve a runtime al processo principale (electron-updater, adblocker).

### Fase 3 – Raccolta e uso quotidiano (commit `78f64f8`)
- Aggiunta da URL: nome da og:site_name/titolo, icona, **intestazione dal theme-color, accento
  dal colore dominante dell'icona** (il theme-color spesso è nero/grigio); i giochi iniziali
  riaggiunti tornano con il tema curato.
- Riordino con trascinamento (raccolta e barra laterale), rinomina, categoria, colore,
  nascondi, elimina (anche cancellando l'accesso). Lo storico dei giochi eliminati resta.
- Promemoria con notifica Windows all'ora scelta (ora di Roma, una volta al giorno, solo se
  restano giochi), area di notifica, avvio con Windows (`--hidden`; nel portatile usa
  `PORTABLE_EXECUTABLE_FILE`), esporta/importa JSON con copia di sicurezza in `backup\`.

### Fase 4 – Scopri nuovi giochi (commit `e480904`)
- Modello `claude-opus-5-5` + strumento `web_search_20260209` (verificati sulla documentazione
  ufficiale), effort `medium`, `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`).
- Il risultato arriva tramite un tool `report_games` con `strict: true` (il tool forzato non è
  ammesso su questo modello: si usa `auto` + istruzione); gestione di `pause_turn`.
- Chiave API: verificata con Anthropic, cifrata con `safeStorage` in `secrets.json` (fuori dai
  backup e dal pacchetto, mai inviata all'interfaccia).
- Prova in scheda temporanea con sessione non persistente (`~trial-…`), scarta, storico, stima
  del costo. Provata dall'utente con una ricerca vera: funziona.

### Fase 5 – Distribuzione (commit `bd87a6f`, `53f2337`)
- electron-updater: controllo all'avvio e ogni 6 ore, download e installazione alla chiusura
  (solo installer Windows); portatile e Mac ricevono l'avviso con il link.
- GitHub Actions su tag `v*`: bozza → Windows (test + build + upload) → pubblicazione.
  Il job Mac (separato, per non bloccare Windows) è stato poi **tolto** il 28/10/2026.
- Repository creato e pubblicato con GitHub CLI; release **0.5.0** pubblicata (solo Windows).

### Blocco pubblicità – versione 0.6.0 (commit `f31542f`, `37ecb90`)
- `@ghostery/adblocker-electron` (il vecchio `@cliqz/...` è deprecato). **Non** si usa il suo
  `enableBlockingInSession`: registra gestori IPC globali per ogni sessione (con più sessioni
  va in errore) e non ammette eccezioni. Si usa il motore e lo si collega a mano in
  `src/main/adblock.ts` (rete, CSP, preload cosmetico).
- Liste `adsAndTrackingLists` (EasyList, EasyPrivacy, uBlock Origin con unbreak/quick-fixes,
  Peter Lowe) dalle copie di Ghostery: il file principale di uBO usa `!#include` che il motore
  non risolve. Cache in `adblock\`, motore serializzato, aggiornamento giornaliero, ultima
  copia se manca la rete. 157.204 filtri.
- Eccezioni: domini di accesso modificabili, pagine aperte su quei domini, percorsi di login
  del sito del gioco. Contatore nell'intestazione (clic = pausa + ricarica), avviso
  "Disattiva per questo sito" se la pagina chiede di togliere l'adblock.
- Test sui 4 giochi con blocco attivo/disattivo: tutti funzionano; bloccati intergient
  (Spotle Movies), mediavine (Krillion), googlesyndication (Spotle TV), niente su Farflung.
  Pagina di accesso di Spotle Movies e pulsante Google di Farflung: 0 richieste bloccate.
- Pubblicata come **0.6.0** (Windows). Il feed `latest.yml` punta alla 0.6.0.

---

## 5. Come si lavora (metodo usato)

- Ogni fase finisce con prova, commit, e un exe da provare.
- Prove automatiche **senza toccare la tastiera del PC**: l'app si avvia con
  `--remote-debugging-port=9333` e un profilo di prova (`DAILY_GAMES_PROFILE`) e si pilota via
  Chrome DevTools Protocol (script Node nella cartella temporanea). Gli screenshot
  dell'interfaccia vengono da `Page.captureScreenshot` sulla vista della shell; le viste dei
  giochi sono target separati.
- Mai inserire credenziali dell'utente: i login veri li prova l'utente.

---

## 6. Problemi aperti e cose da fare

1. **Versione Mac sospesa (decisione del 28/10/2026: per ora non serve).** Tre tentativi su
   GitHub (0.5.0 ×2, 0.6.0) falliti con *"The job was not acquired by Runner of type hosted"*:
   GitHub non aveva Mac liberi. Il job Mac è stato tolto dal workflow, così le release non
   risultano più in errore. Restano nel progetto la configurazione (`build.mac` in
   `package.json`, `npm run dist:mac`) e il codice per il Mac (menu minimo, Dock, firma ad-hoc
   `"-"`), mai provati. Per riattivarla: rimettere un job `macos-latest` con
   `npx electron-builder --mac --publish always` in `release.yml`, oppure compilare su un Mac.
2. **Primo aggiornamento automatico 0.5.0 → 0.6.0** da verificare su un PC con la 0.5.0
   installata dall'installer.
3. **Farflung**: verificare il testo vero del pulsante "Condividi" e sistemare il riconoscitore
   in `src/shared/results.ts`.
4. Blocco pubblicità: non provato il funzionamento senza internet (ultima copia salvata); il
   riconoscimento "il sito rileva l'adblock" è basato sul testo della pagina e può sfuggire.
5. Login veri (Spotle Movies con email, Farflung con Google) da provare con il blocco attivo.
6. Versione portatile: le notifiche di Windows potrebbero non comparire (manca il collegamento
   con l'AppUserModelID); per il promemoria usare l'installer.
7. Colore dei giochi aggiunti: se l'icona è SVG/ICO non leggibile si usa un colore di riserva.

---

## 7. Dati e privacy

Niente dati personali nel repository o nei pacchetti (verificato su `git ls-files` e sul
contenuto di `app.asar`). Tutto sta in `%APPDATA%\Daily Games\`:

| Percorso | Contenuto |
|---|---|
| `data.json` | raccolta, giorni e risultati, impostazioni, storico delle scoperte |
| `Partitions\game-*` | accessi e cookie dei giochi |
| `secrets.json` | chiave API Anthropic cifrata |
| `icons\`, `adblock\`, `backup\` | cache icone, filtri, copie prima di un'importazione |

---

## 8. Idee per il futuro

- Classifiche condivise con gli amici e account online (serve un server).

# De spelserver van Rommelblok

Hiermee spelen en bouwen meerdere spelers samen in één gedeelde wereld. De server is de baas over die wereld; alleen spelen op de pagina heeft hem nooit nodig.

- **De wereld zelf gaat nooit over de lijn.** Iedereen maakt hem zelf uit het zaadje. De server stuurt per stuk alleen wat er anders is dan het zaadje.
- **De server rekent met dezelfde code als de pagina**: `shared/` en de wereldbaas uit `client/src/werkers/werker.js` (in serverstand: licht, water en groei rond alle spelers, zonder 3D-vormen).
- **Elke open wereld draait in een eigen draad** (`src/kamer.js`, met een eigen maker), zodat de andere werelden en het netwerk er niet op wachten.

## Starten

Je hebt Node 22.5 of nieuwer nodig (voor `node:sqlite`).

```bash
cd server
npm ci
cp .env.voorbeeld .env      # en vul het in (in Docker komen de waarden uit het compose-bestand, zie stap 7)
npm start                   # luistert op 127.0.0.1:8090/samen
npm test                    # alle servertests (een echte server op een vrije poort, met nagemaakte spelers)
```

Zelf uitproberen op je eigen computer, met twee browservensters (bijvoorbeeld één gewoon en één privévenster):

```bash
node site/maak-pagina.js                      # (in de hoofdmap) maakt dist/rommelblok.html
cd server && STATISCH=../dist ORIGINS=http://localhost:8090 npm start
# open http://localhost:8090/rommelblok.html?samen=lokaal in beide vensters
```

`STATISCH` laat de server de pagina zelf ook laten zien (alleen om te testen). Met `?samen=lokaal` verbindt de pagina met de server op hetzelfde adres.

## Wat staat waar

| Bestand | Wat |
|---|---|
| `src/start.js` | Leest de instellingen en start de server; stopt netjes (alles bewaren) bij SIGTERM. |
| `src/instellingen.js` | De omgevingsvariabelen (zie `.env.voorbeeld`). Geen geheimen in de code. |
| `src/server.js` | De hoofddraad: http en WebSocket, herkomst, grenzen per verbinding en per adres, `hallo` (een wereld maken of meedoen met een code), het beheer. |
| `src/kamer.js` | Eén gedeelde wereld: spelers en plekken, acties nakijken, spullen op de grond, kisten en ovens, de tijd, opslaan. |
| `src/regels.js` | Wat de server nakijkt (bereik, bewegen, door muren, geldige blokken en spullen), als losse functies. |
| `src/maker.js` | Maakt nieuwe stukken wereld uit het zaadje (dezelfde code als op de pagina). |
| `src/db.js` | De opslag in één SQLite-bestand. |
| `test/` | `alles.js` (alle servertests) en `hulp.js`. |

## Opslag (SQLite, `DB_PAD`)

| Tabel | Wat |
|---|---|
| `werelden` | Zaadje, stand, moeilijkheid, tijd en dag, de regels (wie mag bouwen, gesloten, geweerde spelers) en alleen **hashes** van de uitnodigingscode en van de sleutel van de eigenaar. |
| `stukken` | Per stuk alleen de veranderde blokken: getallen van 32 bits (plek in het stuk × 65536 + blokwaarde). |
| `dingen` | De inhoud van kisten en ovens. |
| `spelers` | Per wereld en speler (onder een hash van het geheim van het apparaat): naam (twee nummers), poppetje, plek, rugzak en levens. |
| `meldingen` | Meldingen van spelers, een week bewaard. |

IP-adressen komen nooit op schijf; ze staan alleen in het geheugen, voor de grenzen.

## Berichten

Kleine JSON-berichten over één WebSocket (`/samen`). De versie staat in `shared/samen.js` (`PROTOCOL`); een oude pagina krijgt `nee` met reden `versie` ("Ververs de pagina").

| Van de pagina | Wat |
|---|---|
| `hallo` | `{ v, geheim, naam: [a, b], pop, taal, straal, code }` of met `maak: { zaad, stand, moeilijk }`; eventueel `sleutel` (eigenaar) |
| `p` | je plek, 10 keer per seconde als er iets verandert: `{ x, y, z, yaw, pitch, f (vlaggen), h (in je hand), a (bewegen), k }` |
| `actie` | wat je deed: `{ nr, t, x, y, z, met, id, gevolg }` (zoals in `p6a_acties.js`) |
| `open`, `dicht` | een kist of oven openen en sluiten |
| `raap` | iets van de grond oppakken (met het nummer van de server) |
| `zeg` | een vast zinnetje (een nummer) |
| `slaap`, `meld`, `beheer`, `bewaar`, `leven` | slapen, iemand melden, de eigenaar, je rugzak bewaren, een teken van leven |

| Van de server | Wat |
|---|---|
| `welkom` | de wereld, of je de eigenaar bent, je plek en rugzak, wie er al is (bij een nieuwe wereld ook de code en de sleutel) |
| `nee` | met `reden`: je mag (er) niet in; met `nr`: je actie is teruggezet (de echte blokken staan erbij) |
| `ja` | je actie is goedgekeurd (met de echte blokken, zodat iedereen gelijk eindigt) |
| `stuk` | de veranderingen van stukken in de buurt |
| `blokken` | veranderingen van anderen, of van de server zelf (water, groei, de oven) |
| `spelers`, `erbij`, `weg` | de plekken van anderen in de buurt, en wie er komt en gaat |
| `zeg`, `tijd`, `slaap`, `los`, `opgeraapt`, `open`, `ding`, `plek`, `regels`, `beheer`, `gemeld` | praten, de tijd, slapen, spullen op de grond, kisten en ovens, terugzetten, wie mag wat |

## Beheer (met `BEHEER`, minstens 12 tekens)

Met de kop `Authorization: Bearer <BEHEER>`:

- `GET /beheer/meldingen`: de meldingen van de afgelopen week;
- `GET /beheer/werelden`: alle gedeelde werelden (zonder codes);
- `POST /beheer/wereld?id=<nummer>&doe=dicht|open|verwijder`.

Na 8 foute wachtwoorden in een kwartier is dat adres even geblokkeerd. `GET /status` is openbaar: de versie en hoeveel werelden en spelers er nu zijn.

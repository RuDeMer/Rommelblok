# Rommelblok

De blokkenwereld van [Ruben's rommelhoekje](https://rubensrommelhoekje.nl/rommelblok.html): een eigen spel met een eigen WebGL2-motor, zonder scripts van buiten. Er is niets van Minecraft overgenomen.

Dit project bevat drie delen, die dezelfde spelregels delen:

- de **browserversie**, voor de site: één bestand, `rommelblok.html`;
- de **desktop-app**, met Tauri (volgt in stap 8);
- de **spelserver** om samen te spelen (`server/`, zie [server/README.md](server/README.md)); op Rubens VPS in Docker volgt in stap 7.

Alleen spelen werkt altijd, ook zonder server en zonder internet.

## Wat staat waar

| Map | Wat |
|---|---|
| `shared/` | De gedeelde code: blokken, voorwerpen, recepten, ruis, vormen, rails en de wereldmaker (`shared/wereld/`). Gewone ES-modules zonder DOM. Ze draaien op de pagina, in de rekenhulpjes (workers), op de server en in de tests. `shared/index.js` geeft `G`: dezelfde namen als vroeger `RB_GEDEELD()`. |
| `client/src/motor/` | De WebGL2-tekenaar, de texturen (met de hand getekend in code) en het geluid (Web Audio: zelfgemaakt, plus opnames uit `client/geluiden/`). |
| `client/geluiden/` | `rommelblok-geluiden.bin`: opnames met de licentie CC0 (Kenney en BigSoundBank) voor hakken, breken, bouwen, stappen, deuren, kisten, vechten en een paar dieren. Een apart bestand naast de pagina, dat pas wordt opgehaald als het spel loopt; zonder dat bestand klinkt alles zelfgemaakt. Bronnen en licentie per opname: [BRONNEN.md](client/geluiden/BRONNEN.md). Opnieuw maken: `node site/maak-geluiden.mjs`. |
| `client/src/werkers/` | De rekenhulpjes. De **wereldbaas** doet licht, water, bewaren en kaartjes; de **makers** maken nieuwe stukken. |
| `client/src/spel/` | Het spel zelf, in volgorde van de bestandsnamen (`p1_kern.js` tot en met `p9_start.js`). Deze delen gebruiken dezelfde gegevens (de open wereld `WD`, de speler `sp`, de instellingen `inst`, de tekenaar `R`). Daarom voegt de bouw ze samen tot één geheel, zoals vroeger in één script. |
| `client/src/stijl/` | `stijl.css` en de HTML van alle schermen (`lichaam.html`). |
| `client/rommelblok-plugin.js` | De bouwsteen voor Vite en voor de site-pagina. `virtual:gedeeld` maakt van `shared/` één functie `RB_GEDEELD`. De pagina roept die aan en geeft zijn tekst mee aan de rekenhulpjes, die zo uit een Blob starten. `virtual:spel` zijn de spelbestanden samen. |
| `site/` | Maakt de pagina voor de site: `pagina.html` (het geraamte), `kop.html` (de `<head>` met het veiligheidsbeleid) en `gedeeld/` (het scorebord-script en de grapjes, **letterlijk** van de site). |
| `server/` | De spelserver: samen in een gedeelde wereld spelen en bouwen. Zie [server/README.md](server/README.md). |
| `test/` | Alle tests. `test/alles.sh` draait ze allemaal. `test/referentie/` bevat de vorige versies van de site-pagina, voor de vergelijking. |

## Werken

Je hebt Node 22 nodig, en voor de browsertests Playwright met Chromium.

```bash
npm install
npm run dev     # Vite op http://localhost:5173 (dezelfde pagina als op de site; herlaadt bij elke wijziging)
npm run bouw    # maakt dist/rommelblok.html, de pagina voor de site
npm test        # alle tests (eerst wordt de pagina gebouwd)
```

- Een testwereld open je met `?test=1&zaad=12345&stand=overleven` achter het adres.
- De testhaak in de pagina is `window.__rommelblok`.

## De pagina voor de site

```bash
node site/maak-pagina.js --gedeeld /pad/naar/mijn-website/rommelblok.html
```

- **`--gedeeld`** haalt eerst het scorebord-script en de grapjes uit de nieuwste versie op de site. Zo krijgt de pagina nooit een verouderde kopie.
- **Twee bestanden:** naast `rommelblok.html` komt `rommelblok-geluiden.bin` (de opnames). Zet ze allebei in dezelfde map op de site.
- **De volgorde** is altijd:
  1. de schermen;
  2. het scorebord-script;
  3. het spel (één `<script>`);
  4. de grapjes, vlak voor `</body>`.
- **Het veiligheidsbeleid** staat in `site/kop.html`.
- **De pagina is niet verkleind**, zodat ze leesbaar blijft.
- **`--samen wss://blok.rubensrommelhoekje.nl/samen`** zet de knop Samen spelen aan, met dat adres. Zonder deze optie staat de knop uit (zo blijft het tot de server echt draait, in stap 7). Om te testen kan het altijd met `?samen=lokaal` (de server op hetzelfde adres als de pagina).

## Bewijs dat de ombouw niets veranderde

- **`test/identiek_wereld.js`:** `shared/` tegen de wereldmaker in de huidige site-pagina. Alle lijsten en functies zijn gelijk, en voor 7 zaadjes, versie 2, versie 3 en een oude wereld zijn alle stukken byte voor byte gelijk.
- **`test/identiek_pagina.js`:** de gebouwde pagina tegen de huidige. Gelijk zijn:
  - de kop, het veiligheidsbeleid en de schermen;
  - de gedeelde blokken en hun plek;
  - de tekst van alle code;
  - de texturen (elke pixel);
  - het licht en de 3D-vormen uit de wereldbaas.
- **`test/schermen_vergelijk.js`:** schermafbeeldingen van alle schermen, op een computer en op een telefoon, pixel voor pixel.
- **`test/oudewereld.js`:** een wereld die met een vorige versie is gemaakt (en geëxporteerd), opent in de nieuwe.
- **`test/standen.js`:** elke blokwaarde past in de indeling met ruimte voor 1024 soorten (`shared/blokwaarde.js`). Er hoeft niets omgezet te worden.

## Opslag

- **localStorage `rommelblok-v3`:** instellingen, de laatste wereld, de bouwbalk, je poppetje, je naam bij samen spelen (`naam`: twee nummers) en de gedeelde werelden die je kent (`samen`: hooguit 10, met de sleutel als je de eigenaar bent). Klein, want het gaat mee met koppelen.
- **localStorage `rommelblok-speler`:** het geheim van dit apparaat voor samen spelen (de server bewaart er alleen een hash van). Bewust niet in `SLEUTELS`: het hoort bij dit apparaat.
- **IndexedDB `rommelblok` (versie 1):**
  - `werelden`;
  - `stukken`: veranderde stukken onder `wereld|cx|cz`, kaartjes onder `kaart|wereld|cx|cz`, en `oud|wereld`.

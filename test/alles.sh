#!/bin/bash
# alle tests achter elkaar; stopt niet bij een fout, maar telt ze
# RB_UIT: map voor de testpagina en de beelden (standaard een tijdelijke map)
# RB_VORIGE: pad naar de vorige rommelblok.html (voor de test met een oude wereld)
cd "$(dirname "$0")/.."
RB_VORIGE="${RB_VORIGE:-$PWD/test/referentie/rommelblok-ronde3.html}"
node site/maak-pagina.js || exit 1
fout=0
loop() { echo "=== $1"; shift; "$@" 2>&1 | tail -${N:-3}; [ ${PIPESTATUS[0]} -eq 0 ] || { echo "!!! MISLUKT"; fout=$((fout+1)); }; }
N=10 loop "zelfde zaadje, zelfde wereld (blok voor blok gelijk aan de site; alleen wat bewust veranderde mag anders)" node test/zelfde_wereld.js
N=6 loop "pagina: veiligheidsbeleid en gedeelde blokken zoals op de site" node test/pagina.js
N=4 loop "geen verwijzingen naar Limburg" node test/geen_limburg.js
N=2 loop "browser: bewoners uit een oudere wereld krijgen eenmalig hun nieuwe naam" node test/namen_omzetten.js
N=2 loop "browser: je poppetje en de drie camera's (computer)" node test/poppetje.js
N=2 loop "browser: je poppetje en de drie camera's (telefoon, 360 punten breed)" node test/poppetje.js telefoon
N=4 loop "blokwaarden: ruimte voor 1024 soorten zonder iets om te zetten" node test/standen.js
N=3 loop "zaadje: zelfde wereld" node test/gen1.js
N=7 loop "landschap: land en zee, oceanen, rivieren, begin op land" node test/landschap.js
N=5 loop "oude wereld: oud landschap blijft, zachte overgang" node test/oudland.js
N=2 loop "naden en licht (zaadje 777)" node test/naden.js 777
N=2 loop "naden en licht (zaadje 4242)" node test/naden.js 4242
N=13 loop "water" node test/water3.js
N=14 loop "bouwwerken: hoe vaak, vast, zonder naden" node test/bouwwerken.js
N=12 loop "dorpjes: hoe vaak, vast, zonder naden, deuren en bedden bereikbaar" node test/dorpen.js
N=1 loop "ruilen: elke ruil eerlijk (iets duurder dan wat je krijgt)" node test/ruilen.js
N=3 loop "recepten" node test/recepten.js
N=2 loop "rails: recht, bocht, helling, aansluiten" node test/spoor.js
N=1 loop "vertaling" node test/vertaling.js
N=1 loop "lint: geen namen die nergens bestaan" node test/lint.js
N=2 loop "geluid" node test/geluid.js
N=1 loop "voetstappen per ondergrond" node test/stappen.js
N=2 loop "duurtest" node test/duur.js
N=3 loop "browser: hakken en bouwen" node test/doen.js
N=2 loop "browser: lopen, vallen, flauwvallen, rugzak" node test/overleef.js
N=2 loop "browser: wandelen en rennen gaan geleidelijk over" node test/rennen.js
N=2 loop "browser: zwemmen, adem, emmer" node test/zwem.js
N=4 loop "browser: rugzak en maken" node test/rugzakui.js
N=4 loop "browser: rugzak: uitleg, verdelen, Shift-klik, Q, kiezen en tikken" node test/rugzak2.js
N=2 loop "browser: bouwmenu (computer en telefoon)" node test/bouwmenu.js
N=2 loop "browser: alle schermen in beeld (computer en telefoon)" node test/interface.js
N=4 loop "browser: oven en kist" node test/oven.js
N=3 loop "browser: gereedschap en alle blokken" node test/palet.js
N=4 loop "browser: telefoon (aanraken)" node test/telefoon.js
N=2 loop "browser: landbouw, eten en smidse" node test/landbouw.js
N=2 loop "browser: oude kisten" node test/buit.js
N=4 loop "browser: rails en karretjes (leggen, afbreken, rijden, stuwspoor, instappen, bewaren)" node test/karretje.js
N=10 loop "browser: bewoners (dagritme, slapen, deuren, ruilen, bewaren)" node test/bewoners.js
N=2 loop "browser: kaart, kompas en logboek" node test/kaart2.js
N=2 loop "browser: kaart en logboek op een telefoon" node test/kaart2.js telefoon
N=2 loop "browser: grote kaart met 22.500 verkende stukken" node test/kaartmeting.js
N=3 loop "browser: acties (opnieuw uitvoeren geeft dezelfde wereld)" node test/acties.js
N=2 loop "browser: een wereld van de vorige versie (ronde 3, ook als export)" node test/oudewereld.js "$RB_VORIGE"
N=2 loop "browser: een wereld van ronde 2 (versie 2 van de wereldmaker, ook als export)" node test/oudewereld.js test/referentie/rommelblok-ronde2.html
N=3 loop "browser: een wereld van ronde 1 (ook als export)" node test/oudewereld.js test/referentie/rommelblok-ronde1.html
N=2 loop "browser: kleine kaart op een telefoon (geen knoppen eronder)" node test/minikaart_beeld.js
N=40 loop "browser: bewaren, opnieuw laden, exporteren, importeren" node test/bewaar.js
echo "=== klaar: $fout mislukt"
exit $fout

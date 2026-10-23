// elke zin heeft een Engelse vertaling
require('./zinnen.js');
const fs = require('fs'), path = require('path');
const EN_ZIN = {}; new Function('EN_ZIN', require('./bron')('p4b_engels.js'))(EN_ZIN);
const zinnen = require(require('path').join(require('./uit'), 'zinnen.json')).filter(z => !['KeyS', 'steen', 'molen'].includes(z));
const extra = ['Je viel van te hoog.', 'Je had geen adem meer.', 'Je had te lang niets gegeten.', 'Een cactus prikte te vaak.', 'Het werd even zwart voor je ogen.', 'Kijkafstand', 'Gezichtsveld', 'Helderheid', 'Geluid', 'Volume', 'Taal', 'Aan', 'Uit',
  // logboek en kaart: rangen, groepen en namen die als losse woorden in lijsten staan
  'Kleine rommelaar', 'Echte houthakker', 'Dappere verkenner', 'Grote avonturier', 'Meester van de rommel', 'Legende van Rommelblok', 'Overleven', 'Verkennen', 'Mijnbouw', 'Sterrenglans', 'Ruïne', 'Oude mijn', 'Sterrenkrater', 'Bouwwerk', 'Jij', 'Thuis', 'Markering',
  // de uitleg bij voorwerpen staat in tabellen
  'Bouwblok', 'Hout', 'Kleur', 'Decoratie', 'Licht', 'Werktuig', 'Eten', 'Spul', 'Natuur', 'Gereedschap', 'Zet hem neer: daaraan maak je dingen van 3 bij 3.', 'Bewaar hier 27 stapels spullen.', 'Wijst naar je bed, je startplek of een markering.', 'Graaft sneller in aarde, zand, grind en sneeuw.', 'Hakt sneller in hout.', 'Snijdt snel door bladeren, planten en spinnenweb.', 'Maakt van gras of aarde een akker om op te zaaien.', 'Zet er een bloem of plantje in.', 'Klim omhoog. Zet hem tegen een muur.'];
const mist = [...zinnen, ...extra].filter(z => EN_ZIN[z] === undefined);
console.log(mist.length ? 'ZONDER VERTALING:\n' + mist.join('\n') : 'alle ' + (zinnen.length + extra.length) + ' zinnen vertaald');
process.exit(mist.length ? 1 : 0);

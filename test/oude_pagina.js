// Haalt de code uit een gebouwde rommelblok.html (bijvoorbeeld de referentie: de versie die nu op de site staat),
// zodat tests de oude en de nieuwe versie naast elkaar kunnen leggen.
//   const OUD = require('./oude_pagina')(pad)   ->  { RB_GEDEELD, RB_MAKER, RB_WERELD, RB_TEXTUREN, RB_GELUID, RB_TEKENAAR, bron }
const fs = require('fs'), path = require('path'), vm = require('vm');
const REFERENTIE = path.join(__dirname, 'referentie', 'rommelblok-ronde3.html');
const NAMEN = ['RB_GEDEELD', 'RB_MAKER', 'RB_WERELD', 'RB_TEXTUREN', 'RB_ICONEN', 'RB_GELUID', 'RB_TEKENAAR'];
// het script van het spel: het <script> waar RB_GEDEELD in staat; de factories staan vóór het blok met de spelcode
function spelScript(html) {
  const i = html.indexOf('function RB_GEDEELD()'); if (i < 0) throw new Error('geen RB_GEDEELD in de pagina');
  const a = html.lastIndexOf('<script>', i) + 8, b = html.indexOf('</script>', i);
  return html.slice(a, b);
}
function laad(pad) {
  const html = fs.readFileSync(pad || REFERENTIE, 'utf8'), code = spelScript(html);
  // in de oude pagina begint de spelcode met een eigen (function () { 'use strict'; ...; in de nieuwe met // ---- p1_kern.js
  let eind = code.indexOf("(function () {\n'use strict';\n// ---- p1_kern.js");
  if (eind < 0) eind = code.indexOf('// ---- p1_kern.js');
  if (eind < 0) throw new Error('begin van de spelcode niet gevonden');
  const fabrieken = code.slice(code.indexOf('function RB_GEDEELD()'), eind);
  // de nieuwe pagina draait alles streng ('use strict' bovenaan de bundel): dan hier ook
  const streng = /^\s*\(function \(\) \{\s*'use strict';/.test(code) ? "'use strict';" : '';
  const uit = vm.runInThisContext('(function(){' + streng + fabrieken + '\n;return {' + NAMEN.filter(n => fabrieken.includes('function ' + n + '(')).join(',') + '};})()', { filename: path.basename(pad || REFERENTIE) });
  uit.bron = code; uit.html = html; uit.fabrieken = fabrieken;
  return uit;
}
laad.REFERENTIE = REFERENTIE;
laad.spelScript = spelScript;
module.exports = laad;

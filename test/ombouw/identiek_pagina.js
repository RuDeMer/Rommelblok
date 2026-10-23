// Bewijs: de gebouwde pagina (dist/rommelblok.html) doet hetzelfde als de huidige rommelblok.html van de site.
//   node test/identiek_pagina.js [nieuwe pagina] [oude pagina]
// 1. kop (veiligheidsbeleid), stijl en HTML van de schermen: letterlijk gelijk
// 2. de gedeelde blokken (scorebord-script en grapjes): letterlijk gelijk en op dezelfde plek (na de schermen, voor en na het spel)
// 3. de code van de motor, de rekenhulpjes en alle spelbestanden: dezelfde tekst (op spaties na)
// 4. de gedeelde code uit de nieuwe pagina: dezelfde lijsten, en voor een paar zaadjes dezelfde stukken
// 5. texturen (elke pixel) en, uit de wereldbaas, licht en 3D-vormen van een stuk wereld: byte voor byte gelijk
const fs = require('fs'), path = require('path');
const laadPagina = require('../oude_pagina');
const NIEUW_PAD = process.argv[2] || path.join(__dirname, '..', '..', 'dist', 'rommelblok.html');
const OUD_PAD = process.argv[3] || laadPagina.REFERENTIE;
const N = laadPagina(NIEUW_PAD), O = laadPagina(OUD_PAD);
let fouten = 0;
const fout = (...a) => { fouten++; if (fouten < 30) console.log('VERSCHIL:', ...a); };
const kort = s => s.replace(/\s+/g, ' ').trim();

// ---------- 1 en 2: de pagina zelf
const deel = (html, a, b) => { const i = html.indexOf(a), j = html.indexOf(b, i + a.length); return i < 0 || j < 0 ? null : html.slice(i, j); };
for (const [naam, a, b] of [['kop en stijl', '<!DOCTYPE html>', '</head>'], ['schermen', '<body', '\n<script>']]) {
  const x = deel(O.html, a, b), y = deel(N.html, a, b);
  if (x === null || x !== y) fout(naam, 'anders'); else console.log(naam + ': gelijk (' + (x.length / 1024).toFixed(0) + ' kB)');
}
const csp = h => (h.match(/Content-Security-Policy" content="([^"]+)"/) || [])[1];
if (csp(O.html) !== csp(N.html)) fout('veiligheidsbeleid anders'); else console.log('veiligheidsbeleid: gelijk');
const { gedeeldeBlokken } = { gedeeldeBlokken: html => { const blok = m => { const i = html.indexOf(m), a = html.lastIndexOf('<script>', i), b = html.indexOf('</script>', i) + 9; return { t: html.slice(a, b), a, b }; }; return { scorebord: blok('const SLEUTELS'), grapjes: blok('GRAPJES: verborgen grapjes'), spel: blok('function RB_GEDEELD()') }; } };
const go = gedeeldeBlokken(O.html), gn = gedeeldeBlokken(N.html);
for (const k of ['scorebord', 'grapjes']) if (go[k].t !== gn[k].t) fout('gedeeld blok', k, 'anders'); else console.log('gedeeld blok ' + k + ': letterlijk gelijk');
// de volgorde: schermen, scorebord-script, spel, grapjes, </body>
const volgorde = g => g.scorebord.a < g.spel.a && g.spel.b < g.grapjes.a;
if (!volgorde(gn) || !N.html.slice(gn.grapjes.b).trim().startsWith('</body>')) fout('de gedeelde blokken staan niet op dezelfde plek'); else console.log('plek van de gedeelde blokken: gelijk (scorebord-script vóór het spel, grapjes erna, vlak voor </body>)');
if (/<script[^>]+src=/i.test(N.html)) fout('script van buiten');

// ---------- 3: de code
for (const naam of ['RB_MAKER', 'RB_WERELD', 'RB_TEXTUREN', 'RB_ICONEN', 'RB_GELUID', 'RB_TEKENAAR']) {
  if (!N[naam] || !O[naam] || kort(N[naam].toString()) !== kort(O[naam].toString())) fout('functie', naam, 'anders');
}
console.log('motor, rekenhulpjes, texturen en geluid: dezelfde tekst');
const spelcode = code => { const i = code.indexOf('// ---- p1_kern.js'); let j = code.lastIndexOf('\nopstarten();'); return code.slice(i, j); };
if (kort(spelcode(O.bron)) !== kort(spelcode(N.bron))) {
  // waar het eerste verschil zit
  const a = kort(spelcode(O.bron)), b = kort(spelcode(N.bron)); let i = 0; while (i < a.length && a[i] === b[i]) i++;
  fout('spelcode anders vanaf', JSON.stringify(a.slice(Math.max(0, i - 80), i + 80)), 'tegen', JSON.stringify(b.slice(Math.max(0, i - 80), i + 80)));
} else console.log('spelcode (19 bestanden): dezelfde tekst (' + (spelcode(N.bron).length / 1024).toFixed(0) + ' kB)');

// ---------- 4: de gedeelde code uit de nieuwe pagina
const GO = O.RB_GEDEELD(), GN = N.RB_GEDEELD();
const lijsten = ['BL', 'IT', 'REC', 'OVEN', 'TEXNAMEN', 'DTEXNAMEN', 'TAG', 'BIOMEN', 'KLEURITEM', 'POTPLANT', 'PALET', 'TEXNR', 'DTEXNR', 'B', 'I', 'KLASSE', 'RICHTING', 'TEXOFS'];
for (const k of lijsten) if (JSON.stringify(GO[k]) !== JSON.stringify(GN[k])) fout('lijst', k);
for (const k of ['DICHT', 'DEMP', 'LICHT', 'VAST', 'LAAG', 'VORM', 'VERVANG']) if (Buffer.compare(Buffer.from(GO[k]), Buffer.from(GN[k]))) fout('tabel', k);
if (Object.keys(GO).join() !== Object.keys(GN).join()) fout('namen in G');
const gelijk = (a, b) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).equals(Buffer.from(b.buffer, b.byteOffset, b.byteLength));
let stukken = 0;
for (const zaad of [12345, 777, GN.zaadVan('Rommelblok')]) for (const opt of [undefined, { gen: 2 }]) {
  const wo = GO.maakWereld(zaad, opt), wn = GN.maakWereld(zaad, opt), s = wo.startPlek();
  if (JSON.stringify(s) !== JSON.stringify(wn.startPlek())) fout('startplek', zaad);
  const cx = Math.floor(s.x) >> 4, cz = Math.floor(s.z) >> 4;
  for (let z = -3; z < 3; z++) for (let x = -3; x < 3; x++) { const a = wo.maakStuk(cx + x, cz + z), b = wn.maakStuk(cx + x, cz + z); stukken++; if (!gelijk(a.d, b.d) || !gelijk(a.biomen, b.biomen) || !gelijk(a.kleur, b.kleur)) fout('stuk', zaad, cx + x, cz + z); }
}
console.log('gedeelde code in de pagina: dezelfde lijsten,', stukken, 'stukken gelijk');

// ---------- 5: texturen, licht en vormen
const TO = O.RB_TEXTUREN(GO), TN = N.RB_TEXTUREN(GN);
if (!gelijk(TO.data, TN.data) || !gelijk(TO.ddata, TN.ddata) || TO.N !== TN.N || TO.ND !== TN.ND) fout('texturen anders'); else console.log('texturen: elke pixel gelijk (' + TN.N + ' + ' + TN.ND + ' lagen)');
function wereldbaas(F, G, zaad, x, z) {
  const berichten = [], Wb = F.RB_WERELD(G, { postMessage: m => berichten.push(m) });
  Wb.start(zaad); Wb.setSpeler(x, z, 3); for (let i = 0; i < 500; i++) Wb.tik();
  const mesh = new Map(); for (const m of berichten) if (m.t === 'mesh') mesh.set(m.cx + ',' + m.cz, m);
  return { Wb, mesh, berichten };
}
for (const zaad of [777, 4242]) {
  const a = wereldbaas(O, GO, zaad, 8, 8), b = wereldbaas(N, GN, zaad, 8, 8);
  let n = 0;
  for (const [k, s] of a.Wb.stukken) {
    const t = b.Wb.stukken.get(k); if (!t) { fout('wereldbaas: stuk ontbreekt', k); continue; }
    if (s.d && (!gelijk(s.d, t.d) || (s.l && !gelijk(s.l, t.l)))) fout('wereldbaas: blokken of licht', k);
    n++;
  }
  let v = 0;
  for (const [k, m] of a.mesh) {
    const m2 = b.mesh.get(k); if (!m2) { fout('vorm ontbreekt', k); continue; }
    for (let l = 0; l < m.lagen.length; l++) if (!m2.lagen[l] !== !m.lagen[l] || (m.lagen[l] && !gelijk(m.lagen[l], m2.lagen[l]))) fout('vorm', k, 'laag', l);
    v++;
  }
  if (a.berichten.length !== b.berichten.length) fout('aantal berichten van de wereldbaas', a.berichten.length, b.berichten.length);
  console.log('wereldbaas zaadje ' + zaad + ':', n, 'stukken (blokken en licht) en', v, '3D-vormen gelijk');
}
console.log(fouten ? 'MISLUKT: ' + fouten + ' verschillen' : 'de nieuwe pagina is gelijk aan de huidige');
process.exit(fouten ? 1 : 0);

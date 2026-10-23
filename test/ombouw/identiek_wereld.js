// Bewijs: de nieuwe gedeelde code (shared/) doet precies hetzelfde als die in de huidige rommelblok.html van de site.
//   node test/identiek_wereld.js [groot]   (groot: meer stukken per zaadje)
// 1. alles wat het spel kent (blokken, voorwerpen, recepten, texturen, ...) is gelijk, ook de tekst van elke functie
// 2. voor een reeks zaadjes zijn alle stukken byte voor byte gelijk (blokken, streken en kleuren), voor versie 2,
//    versie 3 en een oude wereld met een lijst oude stukken; ook startplek, kolommen, bouwwerken en dorpjes
const OUD = require('../oude_pagina')(process.env.RB_REFERENTIE);
const { G: NIEUW } = require('../../shared/index.js');
const GO = OUD.RB_GEDEELD();
const groot = process.argv.includes('groot');
let fouten = 0;
const fout = (...a) => { fouten++; if (fouten < 30) console.log('VERSCHIL:', ...a); };

// ---------- 1. de lijsten en functies
const vorm = f => f.toString().replace(/\s+/g, ' ').trim();
function zelfde(a, b, pad, gezien) {
  if (typeof a === 'function' || typeof b === 'function') { if (typeof a !== typeof b || vorm(a) !== vorm(b)) fout(pad, 'functie anders'); return; }
  if (a === b) return;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') { if (!(Number.isNaN(a) && Number.isNaN(b))) fout(pad, JSON.stringify(a), '<>', JSON.stringify(b)); return; }
  if (gezien.has(a)) return; gezien.add(a);
  if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b) && a.constructor.name !== b.constructor.name) { fout(pad, 'soort', a.constructor.name, b.constructor.name); return; }
  if (ArrayBuffer.isView(a)) { if (a.length !== b.length || a.some((v, i) => v !== b[i])) fout(pad, 'getallen anders'); return; }
  if (a instanceof Set) { const x = [...a], y = [...b]; zelfde(x, y, pad + '{set}', gezien); return; }
  if (a instanceof Map) { zelfde([...a], [...b], pad + '{map}', gezien); return; }
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.join() !== kb.join()) { fout(pad, 'sleutels', ka.filter(k => !kb.includes(k)).slice(0, 5), kb.filter(k => !ka.includes(k)).slice(0, 5)); return; }
  for (const k of ka) zelfde(a[k], b[k], pad + '.' + k, gezien);
}
// maakWereld is nu over losse bestanden in shared/wereld/ verdeeld: die vergelijken we hieronder op wat hij maakt
const { maakWereld: mo, ...restO } = GO, { maakWereld: mn, ...restN } = NIEUW;
zelfde(restO, restN, 'G', new Set());
console.log('lijsten en functies:', fouten ? fouten + ' verschillen' : 'gelijk', '(' + Object.keys(NIEUW).length + ' namen)');

// ---------- 2. werelden
const gelijk = (a, b) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).equals(Buffer.from(b.buffer, b.byteOffset, b.byteLength));
const ZAADJES = [12345, 777, 4242, 0, 4294967295, NIEUW.zaadVan('zolder'), NIEUW.zaadVan('Rommelblok')];
let stukken = 0;
function vergelijk(zaad, opt, naam, plekken) {
  const wo = GO.maakWereld(zaad, opt && Object.assign({}, opt)), wn = NIEUW.maakWereld(zaad, opt && Object.assign({}, opt));
  const so = wo.startPlek(), sn = wn.startPlek();
  if (JSON.stringify(so) !== JSON.stringify(sn)) fout(naam, 'startplek', so, sn);
  for (const [cx, cz] of plekken(so)) {
    const a = wo.maakStuk(cx, cz), b = wn.maakStuk(cx, cz); stukken++;
    if (!gelijk(a.d, b.d)) fout(naam, 'blokken', cx, cz);
    if (!gelijk(a.biomen, b.biomen)) fout(naam, 'streken', cx, cz);
    if (!gelijk(a.kleur, b.kleur)) fout(naam, 'kleuren', cx, cz);
  }
  // kolommen, bouwwerken en dorpjes
  for (let i = 0; i < 200; i++) {
    const x = Math.round(Math.sin(i * 12.9898 + zaad) * 4000), z = Math.round(Math.cos(i * 78.233 + zaad) * 4000);
    if (JSON.stringify(wo.kolom(x, z, {})) !== JSON.stringify(wn.kolom(x, z, {}))) fout(naam, 'kolom', x, z);
  }
  for (let gz = -3; gz <= 3; gz++) for (let gx = -3; gx <= 3; gx++) {
    const a = wo.bouwVak(gx, gz), b = wn.bouwVak(gx, gz);
    if (!gelijk(a.L, b.L) || JSON.stringify(a.soorten) !== JSON.stringify(b.soorten)) fout(naam, 'bouwvak', gx, gz);
    const ga = wo.gebied(gx, gz), gb = wn.gebied(gx, gz);
    if (!gelijk(ga.vormen, gb.vormen) || JSON.stringify(ga.meren) !== JSON.stringify(gb.meren)) fout(naam, 'grotgebied', gx, gz);
  }
  for (let rz = -2; rz <= 2; rz++) for (let rx = -2; rx <= 2; rx++) if (JSON.stringify(wo.dorpVan(rx, rz)) !== JSON.stringify(wn.dorpVan(rx, rz))) fout(naam, 'dorp', rx, rz);
}
const rond = (n) => so => { const cx = Math.floor(so.x) >> 4, cz = Math.floor(so.z) >> 4, uit = []; for (let z = -n; z < n; z++) for (let x = -n; x < n; x++) uit.push([cx + x, cz + z]); return uit; };
const ver = [[6250, -6250], [-6250, 3125], [100000 >> 4, 100000 >> 4], [-(100000 >> 4), 0]];
const t0 = Date.now();
for (const zaad of ZAADJES) {
  const n = groot ? 12 : zaad === 12345 ? 6 : 3;
  vergelijk(zaad, null, 'zaad ' + zaad + ' versie 3', so => rond(n)(so).concat(ver));
  vergelijk(zaad, { gen: 2 }, 'zaad ' + zaad + ' versie 2', so => rond(Math.max(2, n >> 1))(so).concat(ver.slice(0, 2)));
  // een oude wereld: een paar oude stukken rond de start, de rest nieuw (met de overgang van 40 blokken)
  const oud = []; for (let z = -2; z <= 2; z++) for (let x = -2; x <= 2; x++) oud.push(x, z);
  vergelijk(zaad, { gen: 3, oud: Int32Array.from(oud) }, 'zaad ' + zaad + ' oude wereld', () => rond(6)({ x: 8, z: 8 }));
}
console.log('werelden:', stukken, 'stukken vergeleken in', ((Date.now() - t0) / 1000).toFixed(0), 's');
console.log(fouten ? 'MISLUKT: ' + fouten + ' verschillen' : 'zelfde zaadje, zelfde wereld: alles gelijk');
process.exit(fouten ? 1 : 0);

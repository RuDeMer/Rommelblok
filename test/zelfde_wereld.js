// Zelfde zaadje, zelfde wereld: de wereld blijft blok voor blok gelijk aan die van de versie die nu op de site staat
// (test/referentie/rommelblok-ronde3.html), ook na de stappen die namen en tekeningen veranderen.
//   node test/zelfde_wereld.js [groot]
// 1. alle stukken van 7 zaadjes (versie 2, versie 3 en een oude wereld met de overgang): byte voor byte gelijk;
//    ook de startplek, de kolommen, de bouwwerken, de grotgebieden en de dorpjes
// 2. de lijsten van het spel (blokken, voorwerpen, recepten, texturen, vormen): gelijk, op de bewuste veranderingen
//    na (VERANDERD hieronder). Alles wat daar niet staat, moet gelijk zijn.
// 3. de wereldbaas: licht en 3D-vormen van een stuk wereld byte voor byte gelijk; texturen gelijk op de veranderde na
const OUD = require('./oude_pagina')(process.env.RB_REFERENTIE);
const { G: NIEUW } = require('../shared/index.js');
const { RB_WERELD } = require('../client/src/werkers/werker.js');
const { RB_TEXTUREN } = require('../client/src/motor/texturen.js');
const GO = OUD.RB_GEDEELD();
const groot = process.argv.includes('groot');
let fouten = 0;
const fout = (...a) => { fouten++; if (fouten < 30) console.log('VERSCHIL:', ...a); };

// ---------- wat bewust veranderd is (met de stap erbij)
// stap 2, geen Limburg meer: mergel heet kalksteen, vlaai heet taart, en de bewoners hebben nieuwe namen
const SLEUTEL = { mergel: 'kalksteen', mergelblokken: 'kalksteenblokken', vlaai: 'bessentaart', kersenvlaai: 'kersentaart', appelvlaai: 'appeltaart', vlaaipunt: 'taartpunt' };
const TEXTUUR = { mergel: 'kalksteen', mergelblokken: 'kalksteenblokken', vlaai_top: 'bessentaart_top', vlaai_onder: 'taart_onder', vlaai_zij: 'taart_zij', vlaai_binnen: 'taart_binnen', kersenvlaai_top: 'kersentaart_top', appelvlaai_top: 'appeltaart_top', i_vlaaipunt: 'i_taartpunt' };
const VORM = { vlaai: 'taart' };
const VERANDERD = [
  [/^G\.BL\.(23|76|117|168|169)\.(nl|en)$/, 'stap 2: de namen van kalksteen en de taarten'],
  [/^G\.IT\.(23|76|117|168|169|275)\.(nl|en)$/, 'stap 2: de namen van kalksteen en de taarten'],
  [/^G\.REC\.\d+\.(patroon|sleutels)/, 'stap 2: de bessentaart wordt gebakken met suiker en tarwe (was: appels en planken)', r => r.uit === 117],
  [/^G\.(vormDozen|botsDozen|bouwGroep)$/, 'stap 2: de vorm en de groep van de taart heten anders'],
];
const TEXTUUR_ANDERS = new Set(Object.values(TEXTUUR));   // nieuwe tekeningen (stap 2)
// stap 3, je poppetje: twee nieuwe onderdelen achteraan in G, en de plaatjes voor het gezicht en de arm achteraan in de stapel
// stap 4, dieren en griezels: WEZENS achteraan in G; 10 nieuwe voorwerpen (365 tot 374), 2 nieuwe blokken (178 en 179),
// hun recepten en tekeningen, en de stofjes voor de lijven; alles achteraan, zodat alle oude nummers gelijk blijven
const ERBIJ_G = ['POP', 'BLOKWAARDE', 'WEZENS'];
const ERBIJ_DTEX = /^(pop_(ogen|mond)_[a-z]+|pop_(sproetjes|blosjes)|arm_stof|i_(wol|schaar|ei|gebakken_ei|emmer_melk|pannenkoek|leer|boek|spooklicht|kwallengel)|dier_[a-z]+|spook_laken|kwal_lijf|braam_tak)$/;
const ERBIJ_IT = [365, 366, 367, 368, 369, 370, 371, 372, 373, 374], ERBIJ_BL = [178, 179];
// de nieuwe lijsten zonder wat er alleen bij is gekomen (dat moet dan wel precies achteraan staan)
function zonderErbij(G, oudAantalDtex, GO) {
  const kopie = Object.assign({}, G), erbij = [];
  // stap 4: nieuwe voorwerpen en blokken weg, en de lijsten op hun oude lengte
  const it = G.IT.slice(); for (const id of ERBIJ_IT.concat(ERBIJ_BL)) { if (!G.IT[id] || GO.IT[id]) fout('voorwerp ' + id + ' is niet nieuw'); delete it[id]; } kopie.IT = it;
  const bl = G.BL.slice(); for (const id of ERBIJ_BL) { if (!G.BL[id] || GO.BL[id]) fout('blok ' + id + ' is niet nieuw'); bl[id] = null; } kopie.BL = bl;
  const nieuweNamen = new Set([...ERBIJ_IT.map(id => G.IT[id].sleutel), ...ERBIJ_BL.map(id => G.BL[id].sleutel)]);
  kopie.I = Object.fromEntries(Object.entries(G.I).filter(([k]) => !nieuweNamen.has(k)));
  kopie.B = Object.fromEntries(Object.entries(G.B).filter(([k]) => !nieuweNamen.has(k)));
  for (const k of ['DICHT', 'DEMP', 'LICHT', 'VAST', 'LAAG', 'VORM', 'VERVANG']) { const a = G[k].slice(); for (const id of ERBIJ_BL) a[id] = 0; kopie[k] = a; }
  kopie.MAXBLOK = GO.MAXBLOK;
  const nTex = GO.TEXNAMEN.length; kopie.TEXNAMEN = G.TEXNAMEN.slice(0, nTex); kopie.TEXNR = Object.fromEntries(Object.entries(G.TEXNR).filter(([, v]) => v < nTex));
  for (const n of G.TEXNAMEN.slice(nTex)) if (!nieuweNamen.has(n)) fout('nieuwe textuur die er niet bij hoort:', n);
  kopie.REC = G.REC.slice(0, GO.REC.length); kopie.OVEN = G.OVEN.slice(0, GO.OVEN.length);
  erbij.push(ERBIJ_IT.length + ' voorwerpen (' + ERBIJ_IT.map(id => G.IT[id].sleutel).join(', ') + ')', ERBIJ_BL.length + ' blokken (' + ERBIJ_BL.map(id => G.BL[id].sleutel).join(', ') + ')', (G.REC.length - GO.REC.length) + ' recepten', (G.OVEN.length - GO.OVEN.length) + ' ovenrecept');
  const namen = Object.keys(G), staart = namen.slice(namen.length - ERBIJ_G.length);
  if (staart.join() !== ERBIJ_G.join()) fout('de nieuwe onderdelen staan niet achteraan in G:', staart.join());
  for (const k of ERBIJ_G) delete kopie[k];
  const extra = G.DTEXNAMEN.slice(oudAantalDtex);
  for (const n of extra) if (!ERBIJ_DTEX.test(n)) fout('nieuw plaatje dat er niet bij hoort:', n);
  kopie.DTEXNAMEN = G.DTEXNAMEN.slice(0, oudAantalDtex);
  kopie.DTEXNR = Object.fromEntries(Object.entries(G.DTEXNR).filter(([, v]) => v < oudAantalDtex));
  erbij.push(...ERBIJ_G, extra.length + ' plaatjes (' + extra.join(', ') + ')');
  return { kopie, erbij };
}

// de oude lijsten met de nieuwe namen, zodat we de rest precies kunnen vergelijken
const hernoem = (m, s) => (Object.prototype.hasOwnProperty.call(m, s) ? m[s] : s);
const sleutelsHernoemd = (o, m) => Object.fromEntries(Object.entries(o).map(([k, v]) => [hernoem(m, k), v]));
function oudHernoemd(G) {
  const kopie = Object.assign({}, G);
  kopie.BL = G.BL.map(b => (b ? Object.assign({}, b, { sleutel: hernoem(SLEUTEL, b.sleutel), vorm: hernoem(VORM, b.vorm), gebruik: b.gebruik && hernoem(VORM, b.gebruik) }) : b));
  kopie.IT = G.IT.map(it => (it ? Object.assign({}, it, { sleutel: hernoem(SLEUTEL, it.sleutel) }) : it));
  kopie.B = sleutelsHernoemd(G.B, SLEUTEL); kopie.I = sleutelsHernoemd(G.I, SLEUTEL);
  kopie.TEXNAMEN = G.TEXNAMEN.map(n => hernoem(TEXTUUR, n)); kopie.TEXNR = sleutelsHernoemd(G.TEXNR, TEXTUUR);
  kopie.DTEXNAMEN = G.DTEXNAMEN.map(n => hernoem(TEXTUUR, n)); kopie.DTEXNR = sleutelsHernoemd(G.DTEXNR, TEXTUUR);
  kopie.VN = sleutelsHernoemd(G.VN, VORM);
  return kopie;
}
const vorm = f => f.toString().replace(/\s+/g, ' ').trim();
const mag = (pad, ouder) => VERANDERD.find(([re, , als]) => re.test(pad) && (!als || als(ouder)));
const gebruikt = new Set();
function zelfde(a, b, pad, gezien, ouder) {
  if (typeof a === 'function' || typeof b === 'function') { if (typeof a !== typeof b || vorm(a) !== vorm(b)) { const v = mag(pad, ouder); if (v) gebruikt.add(v[1]); else fout(pad, 'functie anders'); } return; }
  if (a === b) return;
  const v = mag(pad, ouder); if (v) { gebruikt.add(v[1]); return; }
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') { if (!(Number.isNaN(a) && Number.isNaN(b))) fout(pad, JSON.stringify(a), '<>', JSON.stringify(b)); return; }
  if (gezien.has(a)) return; gezien.add(a);
  if (ArrayBuffer.isView(a)) { if (a.length !== b.length || a.some((x, i) => x !== b[i])) fout(pad, 'getallen anders'); return; }
  if (a instanceof Set || a instanceof Map) { zelfde([...a], [...b], pad, gezien, a); return; }
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.join() !== kb.join()) { fout(pad, 'sleutels', ka.filter(k => !kb.includes(k)).slice(0, 5), kb.filter(k => !ka.includes(k)).slice(0, 5)); return; }
  for (const k of ka) zelfde(a[k], b[k], pad + '.' + k, gezien, a);
}
// maakWereld is over losse bestanden in shared/wereld/ verdeeld: die vergelijken we op wat hij maakt (deel 1)
const { kopie: NIEUW_ZONDER, erbij: ERBIJ } = zonderErbij(NIEUW, GO.DTEXNAMEN.length, GO);
const { maakWereld: mo, ...restO } = oudHernoemd(GO), { maakWereld: mn, ...restN } = NIEUW_ZONDER;
zelfde(restO, restN, 'G', new Set(), null);
console.log('lijsten en functies:', fouten ? fouten + ' verschillen' : 'gelijk', '(' + Object.keys(NIEUW_ZONDER).length + ' namen)');
for (const r of gebruikt) console.log('  bewust anders:', r);
console.log('  erbij gekomen (stap 3, je poppetje; stap 4, dieren en griezels):', ERBIJ.join(', '));

// ---------- 1. werelden
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
  for (let i = 0; i < 200; i++) {
    const x = Math.round(Math.sin(i * 12.9898 + zaad) * 4000), z = Math.round(Math.cos(i * 78.233 + zaad) * 4000);
    if (JSON.stringify(wo.kolom(x, z, {})) !== JSON.stringify(wn.kolom(x, z, {}))) fout(naam, 'kolom', x, z);
  }
  // de dorpjes: in de beschrijving heet de stijl vakwerk nu 'vakwerk' (was 'mergel'); verder alles gelijk
  const dorpInfo = s => JSON.stringify(s).replace(/"stijl":"mergel"/g, '"stijl":"vakwerk"');
  for (let gz = -3; gz <= 3; gz++) for (let gx = -3; gx <= 3; gx++) {
    const a = wo.bouwVak(gx, gz), b = wn.bouwVak(gx, gz);
    if (!gelijk(a.L, b.L) || dorpInfo(a.soorten) !== dorpInfo(b.soorten)) fout(naam, 'bouwvak', gx, gz);
    const ga = wo.gebied(gx, gz), gb = wn.gebied(gx, gz);
    if (!gelijk(ga.vormen, gb.vormen) || JSON.stringify(ga.meren) !== JSON.stringify(gb.meren)) fout(naam, 'grotgebied', gx, gz);
  }
  for (let rz = -2; rz <= 2; rz++) for (let rx = -2; rx <= 2; rx++) if (JSON.stringify(wo.dorpVan(rx, rz)) !== JSON.stringify(wn.dorpVan(rx, rz))) fout(naam, 'dorp', rx, rz);
}
const rond = n => so => { const cx = Math.floor(so.x) >> 4, cz = Math.floor(so.z) >> 4, uit = []; for (let z = -n; z < n; z++) for (let x = -n; x < n; x++) uit.push([cx + x, cz + z]); return uit; };
const ver = [[6250, -6250], [-6250, 3125], [100000 >> 4, 100000 >> 4], [-(100000 >> 4), 0]];
const t0 = Date.now();
for (const zaad of ZAADJES) {
  const n = groot ? 12 : zaad === 12345 ? 6 : 3;
  vergelijk(zaad, null, 'zaad ' + zaad + ' versie 3', so => rond(n)(so).concat(ver));
  vergelijk(zaad, { gen: 2 }, 'zaad ' + zaad + ' versie 2', so => rond(Math.max(2, n >> 1))(so).concat(ver.slice(0, 2)));
  const oud = []; for (let z = -2; z <= 2; z++) for (let x = -2; x <= 2; x++) oud.push(x, z);
  vergelijk(zaad, { gen: 3, oud: Int32Array.from(oud) }, 'zaad ' + zaad + ' oude wereld', () => rond(6)({ x: 8, z: 8 }));
}
console.log('werelden:', stukken, 'stukken vergeleken in', ((Date.now() - t0) / 1000).toFixed(0), 's');

// ---------- 3. wereldbaas en texturen
function wereldbaas(F, G, zaad) {
  const berichten = [], Wb = F(G, { postMessage: m => berichten.push(m) });
  Wb.start(zaad); Wb.setSpeler(8, 8, 3); for (let i = 0; i < 500; i++) Wb.tik();
  const mesh = new Map(); for (const m of berichten) if (m.t === 'mesh') mesh.set(m.cx + ',' + m.cz, m);
  return { Wb, mesh, berichten };
}
for (const zaad of [777, 4242]) {
  const a = wereldbaas(OUD.RB_WERELD, GO, zaad), b = wereldbaas(RB_WERELD, NIEUW, zaad);
  let n = 0, v = 0;
  for (const [k, s] of a.Wb.stukken) { const t = b.Wb.stukken.get(k); if (!t) { fout('wereldbaas: stuk ontbreekt', k); continue; } if (s.d && (!gelijk(s.d, t.d) || (s.l && !gelijk(s.l, t.l)))) fout('wereldbaas: blokken of licht', k); n++; }
  for (const [k, m] of a.mesh) { const m2 = b.mesh.get(k); if (!m2) { fout('vorm ontbreekt', k); continue; } for (let l = 0; l < m.lagen.length; l++) if (!m2.lagen[l] !== !m.lagen[l] || (m.lagen[l] && !gelijk(m.lagen[l], m2.lagen[l]))) fout('vorm', k, 'laag', l); v++; }
  console.log('wereldbaas zaadje ' + zaad + ':', n, 'stukken (blokken en licht) en', v, '3D-vormen gelijk');
}
const TO = OUD.RB_TEXTUREN(GO), TN = RB_TEXTUREN(NIEUW);
let lagenAnders = 0;
const vergelijkLagen = (namen, a, b, n) => { for (let l = 0; l < n; l++) { const x = a.subarray(l * 1024, (l + 1) * 1024), y = b.subarray(l * 1024, (l + 1) * 1024); if (!gelijk(x, y)) { if (TEXTUUR_ANDERS.has(namen[l])) lagenAnders++; else fout('textuur anders:', namen[l]); } } };
if (TO.N > TN.N || TO.ND > TN.ND) fout('aantal texturen anders', TO.N, TN.N, TO.ND, TN.ND);
else {
  vergelijkLagen(NIEUW.TEXNAMEN, TO.data, TN.data, TO.N); vergelijkLagen(NIEUW.DTEXNAMEN, TO.ddata, TN.ddata, TO.ND);
  for (let l = TO.N; l < TN.N; l++) { const x = TN.data.subarray(l * 1024, (l + 1) * 1024); let vol = 0; for (let i = 3; i < x.length; i += 4) if (x[i] > 0) vol++; if (!vol) fout('nieuwe textuur is leeg:', NIEUW.TEXNAMEN[l]); else lagenAnders++; }
  // de nieuwe plaatjes achteraan zijn echt getekend (niet leeg)
  for (let l = TO.ND; l < TN.ND; l++) { const x = TN.ddata.subarray(l * 1024, (l + 1) * 1024); let vol = 0; for (let i = 3; i < x.length; i += 4) if (x[i] > 0) vol++; if (!vol) fout('nieuw plaatje is leeg:', NIEUW.DTEXNAMEN[l]); else lagenAnders++; }
}
console.log('texturen:', TN.N + TN.ND, 'lagen,', lagenAnders, 'bewust nieuw getekend (' + [...TEXTUUR_ANDERS].join(', ') + ', en ' + (TN.ND - TO.ND + TN.N - TO.N) + ' nieuwe voor je poppetje, de dieren en de nieuwe voorwerpen), de rest elke pixel gelijk');

console.log(fouten ? 'MISLUKT: ' + fouten + ' verschillen' : 'zelfde zaadje, zelfde wereld: alles gelijk, op de bewuste veranderingen na');
process.exit(fouten ? 1 : 0);

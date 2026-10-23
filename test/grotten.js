const UIT = require('./uit');
// meet de grotten in een groot gebied: hoeveel lucht per diepte, ingangen, ravijnen, meren, verbondenheid en erts in de wanden
const fs = require('fs'), path = require('path'), vm = require('vm');
const { gedeeld } = require('./laad.js');
const oud = process.argv.includes('oud');
const G = oud ? vm.runInThisContext('(function(){' + fs.readFileSync(path.join(__dirname, 'gedeeld_oud.js'), 'utf8') + ';return RB_GEDEELD;})()')() : gedeeld();
const zaadTekst = process.argv.find(a => /^z=/.test(a)) ? process.argv.find(a => /^z=/.test(a)).slice(2) : '12345';
const N = +(process.argv.find(a => /^n=/.test(a)) || 'n=20').slice(2); // stukken per kant
const W = G.maakWereld(G.zaadVan(zaadTekst)), B = G.B, WAT = G.W;
const S = N * 16, H = G.HOOG;
const vol = new Uint16Array(S * S * H);
const id = (x, y, z) => (y * S + z) * S + x;
let t0 = Date.now();
for (let cz = 0; cz < N; cz++) for (let cx = 0; cx < N; cx++) {
  const r = W.maakStuk(cx - N / 2, cz - N / 2);
  for (let y = 0; y < H; y++) for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) vol[id(cx * 16 + x, y, cz * 16 + z)] = r.d[(y << 8) | (z << 4) | x];
}
const ms = (Date.now() - t0) / (N * N);
// hoogte van het land per kolom (uit de wereldmaker)
const hoog = new Int16Array(S * S), kol = {};
for (let z = 0; z < S; z++) for (let x = 0; x < S; x++) { const k = W.kolom(x - S / 2, z - S / 2, kol); hoog[z * S + x] = Math.floor(k.h); }
const vast = v => v && v !== WAT && G.VAST[v & 255];
// lucht onder het oppervlak (grot) per laag van 8
const banden = new Array(16).fill(0), totaal = new Array(16).fill(0);
for (let z = 0; z < S; z++) for (let x = 0; x < S; x++) { const h = hoog[z * S + x]; for (let y = 2; y < h - 1; y++) { const b = y >> 3; totaal[b]++; const v = vol[id(x, y, z)] & 255; if (!v || v === WAT && y < 12) banden[b]++; } }
// open plekken aan het oppervlak: waar het bovenste vaste blok door de grotten minstens 2 lager ligt dan zonder grotten
const open = new Uint8Array(S * S);
const W0 = oud ? null : G.maakWereld(G.zaadVan(zaadTekst), { zonderGrotten: true });
const topVan = (d, x, z) => { for (let y = H - 1; y > 0; y--) { const v = d[(y << 8) | (z << 4) | x] & 255; if (v && G.DICHT[v]) return y; } return 0; };
if (W0) for (let cz = 0; cz < N; cz++) for (let cx = 0; cx < N; cx++) {
  const r0 = W0.maakStuk(cx - N / 2, cz - N / 2);
  for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
    const X = cx * 16 + x, Z = cz * 16 + z, t0 = topVan(r0.d, x, z);
    let t1 = 0; for (let y = H - 1; y > 0; y--) { const v = vol[id(X, y, Z)] & 255; if (v && G.DICHT[v]) { t1 = y; break; } }
    if (t0 > G.ZEE && t0 - t1 >= 2) open[Z * S + X] = 1;
  }
}
// groepjes open plekken (aaneengesloten), met hun grootte
const groep = new Int32Array(S * S).fill(-1); const groepen = [];
for (let i = 0; i < S * S; i++) if (open[i] && groep[i] < 0) { let n = 0; const st = [i]; groep[i] = groepen.length; while (st.length) { const j = st.pop(); n++; const x = j % S, z = (j / S) | 0; for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Z = z + dz; if (X < 0 || Z < 0 || X >= S || Z >= S) continue; const k = Z * S + X; if (open[k] && groep[k] < 0) { groep[k] = groepen.length; st.push(k); } } } groepen.push(n); }
const ingangen = groepen.filter(n => n >= 3 && n < 150).length, ravijnenBoven = groepen.filter(n => n >= 150).length;
// verbondenheid: lucht onder het oppervlak (meer dan 3 blokken diep), grootste aaneengesloten deel
const mark = new Uint8Array(S * S * H); let grot = 0; const delen = [];
for (let z = 0; z < S; z++) for (let x = 0; x < S; x++) { const h = hoog[z * S + x]; for (let y = 12; y < h - 3; y++) { const i = id(x, y, z); if (!(vol[i] & 255)) { grot++; mark[i] = 1; } } }
for (let i = 0; i < mark.length; i++) if (mark[i] === 1) { let n = 0; const st = [i]; mark[i] = 2; while (st.length) { const j = st.pop(); n++; const x = j % S, r = (j / S) | 0, z = r % S, y = (r / S) | 0; for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) { const X = x + dx, Y = y + dy, Z = z + dz; if (X < 0 || Z < 0 || X >= S || Z >= S || Y < 0 || Y >= H) continue; const k = id(X, Y, Z); if (mark[k] === 1) { mark[k] = 2; st.push(k); } } } delen.push(n); }
delen.sort((a, b) => b - a);
// zijn de ingangen verbonden met het grote stelsel? Opnieuw vullen, nu met alle lucht onder het land (ook vlak onder het oppervlak)
{
  const m2 = new Int32Array(S * S * H).fill(0); let nr = 0; const groot = [];
  const onder = (x, y, z) => y >= 12 && y <= hoog[z * S + x] && !(vol[id(x, y, z)] & 255);
  for (let z = 0; z < S; z++) for (let x = 0; x < S; x++) for (let y = 12; y <= hoog[z * S + x]; y++) {
    const i = id(x, y, z); if (m2[i] || !onder(x, y, z)) continue;
    nr++; let n = 0; const st = [i]; m2[i] = nr;
    while (st.length) { const j = st.pop(); n++; const X0 = j % S, r = (j / S) | 0, Z0 = r % S, Y0 = (r / S) | 0; for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) { const X = X0 + dx, Y = Y0 + dy, Z = Z0 + dz; if (X < 0 || Z < 0 || X >= S || Z >= S || Y < 12 || Y >= H) continue; const k = id(X, Y, Z); if (!m2[k] && onder(X, Y, Z)) { m2[k] = nr; st.push(k); } } }
    groot[nr] = n;
  }
  let best = 0; for (let k = 1; k <= nr; k++) if (groot[k] > (groot[best] || 0)) best = k;
  // per groepje open plekken: raakt een van de kolommen het grootste stelsel?
  const telG = new Map();
  for (let i = 0; i < S * S; i++) if (groep[i] >= 0 && groepen[groep[i]] >= 3) {
    const x = i % S, z = (i / S) | 0; let raak = false;
    for (let y = 12; y <= hoog[i] && !raak; y++) { const c = m2[id(x, y, z)]; if (c === best) raak = true; }
    telG.set(groep[i], (telG.get(groep[i]) || false) || raak);
  }
  const ja = [...telG.values()].filter(Boolean).length;
  console.log(`ingangen verbonden met het grote stelsel: ${ja} van ${telG.size} (grootste stelsel ${groot[best]} blokken)`);
}
// meren onder de grond: water onder het oppervlak boven het grondwater (y >= 12), niet verbonden met de zee
let meerWater = 0; for (let z = 0; z < S; z++) for (let x = 0; x < S; x++) { const h = hoog[z * S + x]; for (let y = 12; y < h - 6; y++) if ((vol[id(x, y, z)] & 255) === WAT) meerWater++; }
// erts dat aan grotlucht grenst
const ERTS = ['erts_kolen', 'erts_koper', 'erts_ijzer', 'erts_goud', 'erts_robijn', 'erts_ijzer_lei', 'erts_goud_lei'].filter(k => B[k] !== undefined);
const erts = {}, ertsZicht = {};
for (const k of ERTS) { erts[k] = 0; ertsZicht[k] = 0; }
const ertsId = {}; for (const k of ERTS) ertsId[B[k]] = k;
for (let y = 1; y < H - 1; y++) for (let z = 1; z < S - 1; z++) for (let x = 1; x < S - 1; x++) { const v = vol[id(x, y, z)] & 255, k = ertsId[v]; if (!k) continue; erts[k]++; for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) if (!(vol[id(x + dx, y + dy, z + dz)] & 255)) { ertsZicht[k]++; break; } }
const km2 = (S / 1000) ** 2;
console.log(`${oud ? 'OUDE' : 'NIEUWE'} grotten, zaadje ${zaadTekst}, ${S} x ${S} blokken, ${ms.toFixed(1)} ms per stuk`);
console.log('lucht onder het oppervlak per laag (y): ' + banden.map((n, b) => totaal[b] ? `${b * 8}:${(100 * n / totaal[b]).toFixed(1)}%` : '').filter(Boolean).join(' '));
console.log(`ingangen aan het oppervlak: ${ingangen} (${(ingangen / km2).toFixed(1)} per km2, een per ${Math.round(Math.sqrt(S * S / Math.max(1, ingangen)))} x ${Math.round(Math.sqrt(S * S / Math.max(1, ingangen)))} blokken); grote open kloven: ${ravijnenBoven}`);
console.log(`grotlucht: ${grot} blokken, grootste stelsel ${(100 * delen[0] / grot).toFixed(1)}%, top 5: ${delen.slice(0, 5).join(' ')}, aantal losse stukjes: ${delen.length}`);
console.log(`meerwater onder de grond: ${meerWater} blokken`);
console.log('erts (totaal / aan grotlucht): ' + ERTS.map(k => `${k.replace('erts_', '')} ${erts[k]}/${ertsZicht[k]}`).join(', '));
// röntgenkaart: per kolom de diepste lucht onder het oppervlak (grijs), open plekken rood, meren blauw
if (process.argv.includes('kaart')) {
  const { createCanvas } = (() => { try { return require('canvas'); } catch (e) { return {}; } })();
  const rgb = Buffer.alloc(S * S * 3);
  for (let z = 0; z < S; z++) for (let x = 0; x < S; x++) {
    const h = hoog[z * S + x]; let n = 0, w = 0;
    for (let y = 12; y < h - 3; y++) { const v = vol[id(x, y, z)] & 255; if (!v) n++; else if (v === WAT) w++; }
    const j = (z * S + x) * 3, land = h > G.ZEE;
    let c = land ? [70, 90, 60] : [40, 60, 110];
    if (n) c = [Math.min(255, 90 + n * 18), Math.min(255, 90 + n * 18), Math.min(255, 80 + n * 16)];
    if (w) c = [60, 120, 230];
    if (open[z * S + x]) c = [230, 50, 50];
    rgb[j] = c[0]; rgb[j + 1] = c[1]; rgb[j + 2] = c[2];
  }
  fs.writeFileSync(path.join(UIT, 'grotkaart.ppm'), Buffer.concat([Buffer.from(`P6 ${S} ${S} 255\n`), rgb]));
  require('child_process').execSync(`python3 -c "from PIL import Image; Image.open('grotkaart.ppm').save('grotkaart${oud ? '_oud' : ''}.png')"`, { cwd: UIT });
}

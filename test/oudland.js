// een wereld van voor versie 3: de stukken waar je al was, houden precies het oude landschap,
// en daarbuiten gaat het in 40 blokken geleidelijk over in het nieuwe (geen muur of kloof op de grens)
const L = require('./laad'); const G = L.gedeeld();
const zaad = G.zaadVan(process.argv[2] || 'kroket7');
const sk = (cx, cz) => (cx + 32768) * 65536 + (cz + 32768);
// een 'verkend' gebied van 9 x 7 stukken rond het begin, met een uitstulping
const oud = new Set(); for (let cz = -3; cz <= 3; cz++) for (let cx = -4; cx <= 4; cx++) oud.add(sk(cx, cz)); oud.add(sk(5, 0)); oud.add(sk(6, 0));
const W2 = G.maakWereld(zaad, { gen: 2 }), W3 = G.maakWereld(zaad, { gen: 3, oud }), Wn = G.maakWereld(zaad);
let fout = 0;
// 1. de oude stukken zijn blok voor blok gelijk aan de oude versie
let gelijk = 0;
for (const [cx, cz] of [[0, 0], [-4, -3], [4, 3], [6, 0], [-2, 1]]) {
  const a = W2.maakStuk(cx, cz).d, b = W3.maakStuk(cx, cz).d;
  if (Buffer.from(a.buffer).equals(Buffer.from(b.buffer))) gelijk++; else { fout++; console.log('MIS: oud stuk', cx, cz, 'is veranderd'); }
}
console.log('oude stukken gelijk aan de vorige versie:', gelijk, 'van 5');
// 1b. en gelijk aan wat de vorige versie van het spel echt maakte (gedeeld.js van die versie, via RB_VORIGE_GEDEELD)
if (process.env.RB_VORIGE_GEDEELD) {
  const fs = require('fs'), vm = require('vm');
  const GV = vm.runInThisContext('(function(){' + fs.readFileSync(process.env.RB_VORIGE_GEDEELD, 'utf8') + '\n;return RB_GEDEELD;})()')();
  const WV = GV.maakWereld(zaad); let n = 0;
  for (const [cx, cz] of [[0, 0], [-4, -3], [4, 3], [6, 0], [-2, 1], [3, -2]]) { if (Buffer.from(WV.maakStuk(cx, cz).d.buffer).equals(Buffer.from(W3.maakStuk(cx, cz).d.buffer))) n++; else { fout++; console.log('MIS: stuk', cx, cz, 'is anders dan in de vorige versie van het spel'); } }
  console.log('gelijk aan de vorige versie van het spel:', n, 'van 6');
}
// 2. ver weg: precies het nieuwe landschap
const ver = Buffer.from(W3.maakStuk(20, 20).d.buffer).equals(Buffer.from(Wn.maakStuk(20, 20).d.buffer));
console.log('ver weg gelijk aan een nieuwe wereld:', ver); if (!ver) fout++;
// 3. de overgang: de grootste stap in hoogte tussen twee buurkolommen, langs de rand van het oude gebied
let stapOvergang = 0, stapNieuw = 0, stapOud = 0;
const h = (W, x, z) => W.kolom(x, z, {}).h;
for (let x = -120; x < 160; x++) for (const z of [-60, -49, -40, 60, 52]) stapOvergang = Math.max(stapOvergang, Math.abs(h(W3, x, z) - h(W3, x + 1, z)));
for (let z = -100; z < 100; z++) for (const x of [-80, -70, 120, 110]) stapOvergang = Math.max(stapOvergang, Math.abs(h(W3, x, z) - h(W3, x, z + 1)));
// ter vergelijking: dezelfde lijnen in de oude en in de nieuwe wereld zelf
for (let x = -120; x < 160; x++) for (const z of [-60, -49, -40, 60, 52]) { stapNieuw = Math.max(stapNieuw, Math.abs(h(Wn, x, z) - h(Wn, x + 1, z))); stapOud = Math.max(stapOud, Math.abs(h(W2, x, z) - h(W2, x + 1, z))); }
console.log('steilste stap in de overgang', stapOvergang.toFixed(2), '| in de oude wereld', stapOud.toFixed(2), '| in de nieuwe', stapNieuw.toFixed(2));
if (stapOvergang > Math.max(stapOud, stapNieuw) + 1.5) { fout++; console.log('MIS: de overgang is te steil'); }
console.log(fout ? 'NIET GOED' : 'oud landschap: alles goed');
process.exit(fout ? 1 : 0);

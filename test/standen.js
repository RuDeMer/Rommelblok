// Past elke blokwaarde in de indeling met ruimte voor 1024 soorten (shared/blokwaarde.js)?
//   node test/standen.js
// 1. de helpers zijn hun eigen omgekeerde, en geven voor soort < 256 en stand < 64 hetzelfde als v & 255 en v >> 8
// 2. in stukken van een paar zaadjes (versie 2 en 3) is geen stand hoger dan 63
// 3. de standen die het spel zelf maakt (zie p6_doen.js en gedeeld.js) blijven onder de 64
// 4. zolang er een blok 256 of hoger is, mag de oude schrijfwijze v & 255 niet meer in de code staan
const fs = require('fs'), path = require('path');
const { G } = require('../shared/index.js');
const BW = require('../shared/blokwaarde.js');
let fout = 0;
const mis = (...a) => { fout++; console.log('MIS:', ...a); };
// 1.
for (let s = 0; s <= BW.SOORT_MAX; s++) for (const st of [0, 1, 17, 63]) { const v = BW.waarde(s, st); if (BW.soort(v) !== s || BW.stand(v) !== st || v > 65535) mis('helpers', s, st); }
for (let s = 0; s < 256; s++) for (let st = 0; st < 64; st++) { const v = s | (st << 8); if (BW.soort(v) !== (v & 255) || BW.stand(v) !== (v >> 8) || BW.waarde(s, st) !== v) mis('niet gelijk aan de oude indeling', s, st); }
// 2.
let hoogste = 0; const per = {};
for (const zaad of [12345, 777, 4242]) for (const gen of [2, 3]) {
  const W = G.maakWereld(zaad, { gen }), s0 = W.startPlek(), cx = Math.floor(s0.x) >> 4, cz = Math.floor(s0.z) >> 4;
  for (let z = -4; z < 4; z++) for (let x = -4; x < 4; x++) for (const v of W.maakStuk(cx + x, cz + z).d) { const st = v >> 8; if (st > hoogste) hoogste = st; const k = G.BL[v & 255].sleutel; if (st > (per[k] || 0)) per[k] = st; }
}
if (hoogste > BW.STAND_MAX) mis('stand in een gemaakt stuk boven 63:', hoogste);
console.log('hoogste stand in gemaakte stukken:', hoogste, Object.entries(per).filter(e => e[1] > 7).map(e => e.join('=')).join(' '));
// 3. de standen die het spel maakt, per vorm (de grootste waarde volgens de code)
const MAX = {
  richting: 3, trap: 3 | 4, plaat: 2, luik: 3 | 4 | 8, muur: 3, lantaarn: 1, deur: 3 | 4 | 8 | 16, bed: 3 | 4, fakkel: 4, as: 2,
  spoor: 11 | 16, // vorm 0-11, en bit 16: hier staat een karretje uit een mijn (spoorKies neemt de bits boven de 15 van de buur over, en alleen 16 wordt ooit gezet)
  kleur: 11, pot: G.POTPLANT.length - 1, gewas: 3, groei: 3, hap: 3, nat: 1, bessen: 1, water: 7 | 8, kist: 3 | (3 << 2),
};
for (const [k, m] of Object.entries(MAX)) if (m > BW.STAND_MAX) mis('stand van', k, 'kan', m, 'worden');
console.log('standen die het spel maakt: hooguit', Math.max(...Object.values(MAX)));
// 4.
const MAXBLOK = G.MAXBLOK;
if (MAXBLOK > 256) {
  const mappen = ['shared', 'client/src'].map(m => path.join(__dirname, '..', m)), lijst = [];
  const loop = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) loop(p); else if (p.endsWith('.js') && !p.endsWith('blokwaarde.js')) { const t = fs.readFileSync(p, 'utf8'); const n = (t.match(/&\s*255\b/g) || []).length; if (n) lijst.push(path.relative(path.join(__dirname, '..'), p) + ' (' + n + ')'); } } };
  mappen.forEach(loop);
  if (lijst.length) mis('er is een blok boven 255, maar de code leest soorten nog met & 255:', lijst.join(', '));
} else console.log('hoogste bloknummer:', MAXBLOK - 1, '(onder 256: de oude schrijfwijze v & 255 is nog gelijk)');
console.log(fout ? 'MISLUKT' : 'alle blokwaarden passen in de indeling met ruimte voor 1024 soorten, zonder iets om te zetten');
process.exit(fout ? 1 : 0);

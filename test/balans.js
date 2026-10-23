// balans: hoe lang hakken duurt, hoe lang gereedschap meegaat, hoeveel erts er is (en hoeveel je in grotten ziet), en eten
const { gedeeld } = require('./laad.js'); const G = gedeeld(); const { B, I, IT, BL } = G;
const nm = id => IT[id] ? IT[id].sleutel : BL[id].sleutel;
// 1. hakken (zelfde formule als hakTijd, staand op de grond)
const hak = (bid, gid) => { const b = BL[bid], g = gid ? IT[gid] : null, juist = !!(g && g.gereed && b.gereed === g.gereed), oogst = !b.klasse || (juist && g.klasse >= b.klasse); return { t: oogst ? b.hard * 1.5 / (juist ? g.snel : 1) : b.hard * 5, oogst }; };
const blokken = ['aarde', 'stam_eik', 'steen', 'leisteen', 'erts_kolen', 'erts_ijzer', 'erts_goud', 'erts_robijn', 'sterrensteen'];
const houwelen = [0, 'houweel_hout', 'houweel_steen', 'houweel_koper', 'houweel_ijzer', 'houweel_robijn', 'houweel_ijzer_ster', 'houweel_robijn_ster'];
console.log('Hakken in seconden (x = je krijgt niets):');
console.log('gereedschap'.padEnd(22) + blokken.map(b => b.replace('erts_', '').padStart(9)).join(''));
for (const h of houwelen) {
  const gid = h ? I[h] : 0;
  console.log((h || 'hand').padEnd(22) + blokken.map(b => { const r = hak(B[b], gid); return ((r.oogst ? '' : 'x') + r.t.toFixed(2)).padStart(9); }).join('') + (gid ? `   klasse ${IT[gid].klasse}, snel ${IT[gid].snel.toFixed(1)}, gaat mee: ${IT[gid].duur} blokken` : ''));
}
// 2. erts: per stuk, en hoeveel daarvan aan een grot grenst
const zaden = ['777', '4242'];
const tel = {}, ERTS = ['erts_kolen', 'erts_koper', 'erts_ijzer', 'erts_ijzer_lei', 'erts_goud', 'erts_goud_lei', 'erts_robijn', 'sterrensteen'];
for (const e of ERTS) tel[e] = { alles: 0, zicht: 0 };
let stukken = 0;
for (const zt of zaden) {
  const W = G.maakWereld(G.zaadVan(zt));
  for (let cz = -6; cz < 6; cz++) for (let cx = -6; cx < 6; cx++) {
    const { d } = W.maakStuk(cx, cz); stukken++;
    for (let y = 1; y < 127; y++) for (let z = 1; z < 15; z++) for (let x = 1; x < 15; x++) {
      const id = d[(y << 8) | (z << 4) | x] & 255, k = BL[id].sleutel; if (!tel[k]) continue;
      tel[k].alles++;
      const h = Math.floor(W.kolom(cx * 16 + x, cz * 16 + z, {}).h);
      for (const o of [1, -1, 16, -16, 256, -256]) { const n = d[((y << 8) | (z << 4) | x) + o] & 255; if (n === 0 && y < h - 4) { tel[k].zicht++; break; } }
    }
  }
}
console.log(`\nErts per stuk van 16 x 16 (${stukken} stukken, zaadjes ${zaden.join(' en ')}); 'in een grot' = grenst aan lucht onder de grond:`);
for (const [k, v] of Object.entries(tel)) console.log('  ' + k.padEnd(16) + (v.alles / stukken).toFixed(2).padStart(7) + ' per stuk,' + (v.zicht / stukken).toFixed(2).padStart(6) + ' in een grot (' + (v.alles ? (v.zicht / v.alles * 100).toFixed(0) : 0) + '%)');
// 3. eten: hoeveel honger elk eten geeft, en hoe snel honger daalt
console.log('\nEten (honger erbij, van 20):');
console.log('  ' + IT.filter(it => it && it.eten).map(it => it.sleutel + ' ' + it.eten).join(', '));
console.log('Honger daalt 1 punt per 4 uitputting: lopen 0,01 per blok (400 blokken), rennen 0,1 per blok (40 blokken), springen 0,05 (rennend 0,2), hakken 0,005 per blok, genezen 1,5 per half hartje.');

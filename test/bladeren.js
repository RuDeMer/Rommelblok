// Bladeren aan bomen (gedeelde code): node test/bladeren.js
// 1. Elke boom die de wereld maakt (alle soorten, veel zaadjes): alle bladeren hebben stand 1 (van de natuur), en elk
//    blad zit via andere bladeren (ook schuin) vast aan een stam. Anders zou het vanzelf vergaan in een boom waar
//    niemand aan kwam.
// 2. Zo ook in echte stukken wereld in bossen, taiga, moeras en savanne (een blad aan de rand van wat er gemaakt is,
//    telt als vast: daar ligt het buurstuk).
// 3. Bouwwerken (ruïnes, dorpjes) en wat spelers neerzetten krijgen geen stand 1.
const { G } = require('../shared/index.js');
const B = G.B, BL = G.BL;
let fout = 0; const mis = (...a) => { fout++; console.log('MIS:', ...a); };
const BLAD = id => BL[id] && BL[id].sleutel.startsWith('blad_'), STAM = id => BL[id] && BL[id].sleutel.startsWith('stam_');
function los(get, cellen) {
  // welke bladeren zitten niet vast (dezelfde regel als werker.js: door bladeren, ook schuin, naar een stam; onbekend = vast)
  const vast = new Set(), losse = [];
  for (const [x, y, z] of cellen) {
    const k0 = x + ',' + y + ',' + z; if (vast.has(k0)) continue;
    const gezien = new Set([k0]), rij = [[x, y, z]]; let ok = false;
    for (let i = 0; i < rij.length && !ok; i++) for (let dy = -1; dy <= 1 && !ok; dy++) for (let dz = -1; dz <= 1 && !ok; dz++) for (let dx = -1; dx <= 1 && !ok; dx++) {
      const nx = rij[i][0] + dx, ny = rij[i][1] + dy, nz = rij[i][2] + dz, k = nx + ',' + ny + ',' + nz; if (gezien.has(k)) continue; gezien.add(k);
      const v = get(nx, ny, nz); if (v < 0 || STAM(v & 255)) ok = true; else if (BLAD(v & 255)) rij.push([nx, ny, nz]);
    }
    if (ok) for (const k of gezien) vast.add(k); else losse.push([x, y, z]);
  }
  return losse;
}
// 1. losse bomen
const SOORTEN = ['eik', 'grote_eik', 'esdoorn', 'berk', 'spar', 'baobab', 'wilg', 'kers', 'noten', 'struik'];
let bomen = 0, bladeren = 0;
for (const soort of SOORTEN) for (const zaad of [1, 2, 3, 777, 4242, 9001]) {
  const W = G.maakWereld(zaad);
  for (let n = 0; n < 40; n++) {
    const m = new Map(), r = G.rng(zaad * 1000 + n);
    W.zetBoom(soort, 0, 70, 0, r, (x, y, z, v) => { const k = x + ',' + y + ',' + z, oud = m.get(k); if (oud && STAM(oud & 255) && !STAM(v & 255)) return; m.set(k, v); });
    const get = (x, y, z) => m.get(x + ',' + y + ',' + z) || 0, cellen = [];
    for (const [k, v] of m) if (BLAD(v & 255)) { cellen.push(k.split(',').map(Number)); if (((v >> 8) & 63) !== 1) mis(soort, 'blad zonder stand 1:', v); }
    bomen++; bladeren += cellen.length;
    const l = los(get, cellen); if (l.length) mis(soort, 'zaadje', zaad, 'boom', n, ':', l.length, 'losse bladeren, bijvoorbeeld', l[0].join(','));
  }
}
console.log('losse bomen: ' + bomen + ' bomen, ' + bladeren + ' bladeren, allemaal met stand 1 en vast aan een stam');
// 2. echte stukken
let stukken = 0, stukBlad = 0, losTotaal = 0;
for (const zaad of [777, 12345, 4242]) {
  const W = G.maakWereld(zaad);
  // stukken in een raster van 6 x 6 rond een paar plekken; per plek alleen het midden nakijken (de rand heeft buren)
  for (const [px, pz] of [[0, 0], [2000, -1500], [-3000, 800], [5000, 5000]]) {
    const cx0 = px >> 4, cz0 = pz >> 4, st = new Map();
    for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) st.set((cx0 + dx) + ',' + (cz0 + dz), W.maakStuk(cx0 + dx, cz0 + dz).d);
    const get = (x, y, z) => { if (y < 0 || y >= G.HOOG) return 0; const d = st.get((x >> 4) + ',' + (z >> 4)); return d ? d[G.idx(x & 15, y, z & 15)] : -1; };
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
      const cx = cx0 + dx, cz = cz0 + dz, d = st.get(cx + ',' + cz), cellen = [];
      for (let y = 0; y < G.HOOG; y++) for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) { const v = d[G.idx(x, y, z)]; if (BLAD(v & 255) && ((v >> 8) & 1)) cellen.push([cx * 16 + x, y, cz * 16 + z]); }
      stukken++; stukBlad += cellen.length;
      const l = los(get, cellen); losTotaal += l.length;
      if (l.length) mis('zaadje', zaad, 'stuk', cx, cz, ':', l.length, 'losse bladeren, bijvoorbeeld', l[0].join(','));
    }
  }
}
console.log('echte stukken: ' + stukken + ' stukken, ' + stukBlad + ' bladeren van bomen, los: ' + losTotaal);
// 3. bladeren zonder stand 1 in gemaakte stukken (heggen in dorpjes en ruïnes) mogen, maar komen niet uit bomen
console.log(fout ? fout + ' FOUTEN' : 'bladeren aan bomen: alles goed');
process.exit(fout ? 1 : 0);

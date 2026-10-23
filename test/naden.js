// Test: elk zichtbaar vlak precies één keer in de vormen, ook langs de randen van stukken; licht onafhankelijk van de laadvolgorde
const L = require('./laad'); const G = L.gedeeld(); const RB_WERELD = L.laad('werker.js', 'RB_WERELD');
function maak(zaad, x, z, R) { const berichten = []; const Wb = RB_WERELD(G, { postMessage: m => berichten.push(m) }); Wb.start(zaad); Wb.setSpeler(x, z, R); for (let i = 0; i < 600; i++) Wb.tik(); return { Wb, berichten }; }
const zaad = +(process.argv[2] || 777);
const A = maak(zaad, 0, 0, 3);
const B = maak(zaad, 64, -48, 6); // andere volgorde en richting van laden
let fouten = 0;
// 1. licht gelijk voor gedeelde stukken die in beide helemaal belicht zijn (en waarvan alle buren belicht zijn)
let vergeleken = 0;
for (const [k, s] of A.Wb.stukken) {
  const t = B.Wb.stukken.get(k); if (!t || s.fase < 3 || t.fase < 3) continue;
  if (!A.Wb.rondBuren(s, 2) || !B.Wb.rondBuren(t, 2)) continue;
  vergeleken++;
  if (!Buffer.from(s.d.buffer).equals(Buffer.from(t.d.buffer))) { console.log('blokken verschillen', s.cx, s.cz); fouten++; }
  let v = 0; for (let i = 0; i < s.l.length; i++) if (s.l[i] !== t.l[i]) v++;
  if (v) { console.log('licht verschilt in', s.cx, s.cz, v, 'cellen'); fouten++; }
}
console.log('stukken vergeleken:', vergeleken);
// 2. vlakken: uit de vormen terugrekenen en vergelijken met wat zichtbaar zou moeten zijn
const laatste = new Map(); for (const m of A.berichten) if (m.t === 'mesh') laatste.set(m.cx + ',' + m.cz, m);
const NRM = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
let getest = 0;
for (const m of laatste.values()) {
  const s = A.Wb.haal(m.cx, m.cz); if (!s || !A.Wb.rondBuren(s, 2)) continue;
  getest++;
  const X0 = m.cx * 16, Z0 = m.cz * 16;
  const gezien = new Map();
  for (const lg of [0, 1]) {
    const a = m.lagen[lg];
    for (let q = 0; q < a.length; q += 8) {
      const n = a[q] >>> 29; if (n > 5) continue;
      let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
      for (let v = 0; v < 4; v++) { const w = a[q + v * 2]; const p = [((w & 511) - 16) / 16, ((w >>> 18) & 2047) / 16, (((w >>> 9) & 511) - 16) / 16]; for (let i = 0; i < 3; i++) { mn[i] = Math.min(mn[i], p[i]); mx[i] = Math.max(mx[i], p[i]); } }
      // alleen hele kubusvlakken tellen (vormen als trappen en fakkels overslaan)
      const ax = n >> 1; let heel = true; for (let i = 0; i < 3; i++) if (i !== ax && (mn[i] % 1 || mx[i] % 1)) heel = false; if (mn[ax] % 1) heel = false; if (!heel) continue;
      const cel = mn.slice(); if (!(n & 1)) cel[ax] -= 1; // de cel waar het vlak bij hoort
      for (let x = cel[0]; x < (ax === 0 ? cel[0] + 1 : mx[0]); x++) for (let y = cel[1]; y < (ax === 1 ? cel[1] + 1 : mx[1]); y++) for (let z = cel[2]; z < (ax === 2 ? cel[2] + 1 : mx[2]); z++) {
        const key = n + ':' + x + ',' + y + ',' + z; gezien.set(key, (gezien.get(key) || 0) + 1);
      }
    }
  }
  for (const [key, c] of gezien) if (c > 1) { if (fouten < 20) console.log('dubbel vlak', key); fouten++; }
  // wat zou er zichtbaar moeten zijn
  for (let y = 0; y < G.HOOG; y++) for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
    const v = s.d[G.idx(x, y, z)], id = v & 255; if (!id || G.VORM[id] !== 1 || G.LAAG[id] === 2) continue;
    for (let n = 0; n < 6; n++) {
      const [dx, dy, dz] = NRM[n], ny = y + dy; if (ny < 0) continue;
      const nb = ny >= G.HOOG ? 0 : A.Wb.get(X0 + x + dx, ny, Z0 + z + dz), nid = nb & 255;
      let zicht = !G.DICHT[nid];
      if (G.LAAG[id] === 1 && nid === id && (id === G.B.glas || !G.BL[id].zwaai)) zicht = false;
      if (G.LAAG[id] === 0 && nid === id && !G.DICHT[id]) zicht = false;
      const key = n + ':' + x + ',' + y + ',' + z;
      if (zicht && !gezien.has(key)) { if (fouten < 20) console.log('vlak ontbreekt', key, G.BL[id].sleutel, 'buur', G.BL[nid] && G.BL[nid].sleutel); fouten++; }
      if (!zicht && gezien.has(key)) { if (fouten < 20) console.log('vlak teveel', key, G.BL[id].sleutel); fouten++; }
    }
  }
}
console.log('stukken met vlakken getest:', getest, fouten ? 'FOUTEN: ' + fouten : 'alles klopt');
process.exit(fouten ? 1 : 0);

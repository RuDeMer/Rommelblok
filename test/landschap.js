// meet het landschap: hoeveel land en zee, hoe groot de oceanen zijn, waar je begint,
// en hoe de rivieren lopen (diepte, en of de oevers geleidelijk zijn of een kloof vormen)
const L = require('./laad'); const G = L.gedeeld();
const zaden = (process.argv[2] || '777,4242,12345,kroket7,rommelhoekje').split(',');
const R = +(process.argv[3] || 4096), STAP = 16, N = (2 * R) / STAP;
const BI = G.BI, OCEAAN = new Set([BI.oceaan, BI.diepe_oceaan, BI.bevroren_oceaan]);
const ZEE = G.ZEE;
let fout = 0; const alle = [];
for (const zt of zaden) {
  const W = G.maakWereld(G.zaadVan(zt), { gen: +(process.env.RB_GEN || 3) }), t0 = Date.now();
  const zee = new Uint8Array(N * N); let nZee = 0, nRiv = 0, nBerg = 0;
  const bi = {};
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = W.kolom(-R + i * STAP, -R + j * STAP, {});
    if (k.h < ZEE - 0.5 && k.b !== BI.rivier) { zee[j * N + i] = 1; nZee++; }
    if (k.b === BI.rivier) nRiv++;
    if (k.b === BI.bergen || k.b === BI.sneeuwbergen) nBerg++;
    bi[k.b] = (bi[k.b] || 0) + 1;
  }
  // oceanen als samenhangende stukken (in km²)
  const gezien = new Uint8Array(N * N), maten = [];
  for (let s = 0; s < N * N; s++) if (zee[s] && !gezien[s]) {
    let n = 0; const st = [s]; gezien[s] = 1;
    while (st.length) { const p = st.pop(); n++; const x = p % N, y = (p / N) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= N || Y >= N) continue; const q = Y * N + X; if (zee[q] && !gezien[q]) { gezien[q] = 1; st.push(q); } } }
    maten.push(n * STAP * STAP / 1e6);
  }
  maten.sort((a, b) => b - a);
  // rivieren: fijn bemonsterd in een kleiner gebied
  const r2 = 1536, diepten = [], kloof = [], helling = [];
  for (let z = -r2; z < r2; z += 4) for (let x = -r2; x < r2; x += 4) {
    const k = W.kolom(x, z, {}); if (k.b !== BI.rivier || k.rf < 0.8) continue;
    diepten.push(ZEE - k.h);
    // de hoogste grond tot 10 blokken van het midden van de rivier, en de steilste stap van de oever
    let hoog = -1e9, steil = 0;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]]) {
      let vorige = k.h;
      for (let d = 1; d <= 10; d++) { const h = W.kolom(Math.round(x + dx * d), Math.round(z + dz * d), {}).h; hoog = Math.max(hoog, h); if (vorige > ZEE - 1 || h > ZEE) steil = Math.max(steil, h - vorige); vorige = h; }
    }
    kloof.push(hoog - ZEE); helling.push(steil);
  }
  const pct = (a, p) => { if (!a.length) return 0; const b = a.slice().sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(p * b.length))]; };
  const st = W.startPlek(), sk = W.kolom(Math.floor(st.x), Math.floor(st.z), {});
  const r = {
    zaad: zt, zee: +(100 * nZee / (N * N)).toFixed(1), rivier: +(100 * nRiv / (N * N)).toFixed(2), bergen: +(100 * nBerg / (N * N)).toFixed(1),
    oceanen: maten.length, grootste: +(maten[0] || 0).toFixed(1), mediaan: +pct(maten.filter(m => m > 0.5), 0.5).toFixed(2),
    rivierDiepte: [pct(diepten, 0.1), pct(diepten, 0.5), pct(diepten, 0.9)].map(v => +v.toFixed(1)),
    kloof: +(100 * kloof.filter(h => h > 14).length / Math.max(1, kloof.length)).toFixed(1), steilsteOever: [pct(helling, 0.5), pct(helling, 0.9), pct(helling, 0.99)].map(v => +v.toFixed(1)),
    start: [Math.round(st.x), Math.round(st.z), 'h' + Math.floor(sk.h), 'biome ' + sk.b, OCEAAN.has(sk.b) || sk.h < ZEE + 1 ? 'IN HET WATER' : 'op land'], ms: Date.now() - t0,
  };
  alle.push(r); console.log(JSON.stringify(r));
  if (r.start[4] !== 'op land') { fout++; console.log('MIS: begint in het water'); }
  if ((process.env.RB_GEN || 3) == 3) {
    if (r.zee > 20) { fout++; console.log('MIS: te veel water'); }
    if (r.grootste > 1.6) { fout++; console.log('MIS: te grote oceaan'); }
    if (r.kloof > 6) { fout++; console.log('MIS: te veel rivieren in een kloof'); }
    if (r.steilsteOever[1] > 3.5) { fout++; console.log('MIS: rivieroevers te steil'); }
  }
}
const gem = f => +(alle.reduce((a, r) => a + r[f], 0) / alle.length).toFixed(2);
console.log('gemiddeld: zee', gem('zee') + '%, rivier', gem('rivier') + '%, bergen', gem('bergen') + '%, grootste oceaan', gem('grootste'), 'km², kloofrivier', gem('kloof') + '%');
process.exit(fout ? 1 : 0);

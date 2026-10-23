// bouwwerken: hoe vaak, vast per zaadje, zonder naden (ook in een andere volgorde), kisten op een vaste ondergrond, geen lekken
const { gedeeld } = require('./laad.js'); const G = gedeeld(); const { B, W: WATER } = G;
let fouten = 0; const fout = t => { console.log('FOUT ' + t); fouten++; };
const zaden = (process.argv[2] || '777,4242,12345').split(',');
const N = 16; // vakken van 64: -N tot N-1, dus 2048 x 2048 blokken
for (const zt of zaden) {
  const zaad = G.zaadVan(zt), A = G.maakWereld(zaad), Bw = G.maakWereld(zaad);
  const tel = { ruine: 0, mijn: 0, krater: 0, dorp: 0 }, eerste = {}, sp = A.startPlek();
  let t0 = Date.now();
  for (let gz = -N; gz < N; gz++) for (let gx = -N; gx < N; gx++) {
    const v = A.bouwVak(gx, gz), w = Bw.bouwVak(gx, gz);
    if (v.L.length !== w.L.length || v.L.some((x, i) => x !== w.L[i])) fout(`zaad ${zt}: vak ${gx},${gz} niet hetzelfde`);
    for (const s of v.soorten) {
      tel[s[0]]++;
      const af = Math.hypot(s[1] - sp.x, s[3] - sp.z);
      if (!eerste[s[0]] || af < eerste[s[0]].af) eerste[s[0]] = { af: Math.round(af), plek: s.slice(1), vak: [gx, gz] };
    }
  }
  const km2 = (N * 2 * 64 / 1000) ** 2;
  console.log(`zaad ${zt}: per km² ${Object.entries(tel).map(([k, n]) => k + ' ' + (n / km2).toFixed(1)).join(', ')} | dichtstbij de start: ${Object.entries(eerste).map(([k, e]) => k + ' ' + e.af + ' m').join(', ')} (${Date.now() - t0} ms)`);
  // de dichtstbijzijnde van elke soort: alle stukken eromheen maken, in twee volgordes met twee wereld-kopieën
  for (const soort of ['ruine', 'mijn', 'krater']) {
    const e = eerste[soort]; if (!e) { fout(`zaad ${zt}: geen ${soort}`); continue; }
    const [x, y, z] = e.plek, R = soort === 'mijn' ? 3 : 1, cx = Math.floor(x / 16), cz = Math.floor(z / 16);
    const lijst = []; for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) lijst.push([cx + dx, cz + dz]);
    const C = G.maakWereld(zaad), D = G.maakWereld(zaad), K = G.maakWereld(zaad, { zonderBouwwerken: true });
    const a = new Map(), b = new Map(); let ms = 0, msK = 0;
    for (const [i, j] of lijst) { let t = performance.now(); a.set(i + ',' + j, C.maakStuk(i, j).d); ms += performance.now() - t; }
    for (const [i, j] of lijst.slice().reverse()) b.set(i + ',' + j, D.maakStuk(i, j).d);
    for (const [i, j] of lijst) { const t = performance.now(); K.maakStuk(i, j); msK += performance.now() - t; }
    let anders = 0; for (const [k, d] of a) { const d2 = b.get(k); for (let q = 0; q < d.length; q++) if (d[q] !== d2[q]) anders++; }
    if (anders) fout(`zaad ${zt} ${soort}: ${anders} blokken anders in een andere volgorde`);
    const get = (X, Y, Z) => { const d = a.get(Math.floor(X / 16) + ',' + Math.floor(Z / 16)); if (!d || Y < 0 || Y >= 128) return -1; return d[(Y << 8) | ((((Z % 16) + 16) % 16) << 4) | (((X % 16) + 16) % 16)]; };
    // tellen en controleren in het gebied
    const t = { kist: 0, kistZweeft: 0, spoor: 0, bocht: 0, helling: 0, karretje: 0, spoorZweeft: 0, ster: 0, klimop: 0, lek: 0, hek: 0, fakkel: 0 };
    const X0 = (cx - R) * 16, Z0 = (cz - R) * 16, X1 = (cx + R + 1) * 16, Z1 = (cz + R + 1) * 16;
    for (let Z = Z0; Z < Z1; Z++) for (let X = X0; X < X1; X++) for (let Y = 2; Y < 126; Y++) {
      const v = get(X, Y, Z), id = v & 255;
      if (id === B.buitkist) { t.kist++; if (!G.VAST[get(X, Y - 1, Z) & 255]) t.kistZweeft++; }
      else if (id === B.mijnspoor) { t.spoor++; const s = (v >> 8) & 15; if (s >= 8) t.bocht++; else if (s >= 4) t.helling++; if ((v >> 8) & 16) t.karretje++; if (!G.DICHT[get(X, Y - 1, Z) & 255]) t.spoorZweeft++; } else if (id === B.sterrensteen) t.ster++; else if (id === B.klimop) t.klimop++; else if (id === B.hek) t.hek++; else if (id === B.fakkel) t.fakkel++;
      // water naast lucht binnen een mijn (dan stroomt hij leeg)
      if (soort === 'mijn' && id === 0 && Math.abs(Y - y) <= 4) for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, 0, 1], [0, 0, -1]]) if ((get(X + dx, Y + dy, Z + dz) & 255) === WATER) t.lek++;
    }
    console.log(`  ${soort} bij ${e.plek.join(',')} (${e.af} m): ${Object.entries(t).filter(([, n]) => n).map(([k, n]) => k + ' ' + n).join(', ') || 'niets geteld'} | ${lijst.length} stukken in ${ms.toFixed(0)} ms (zonder bouwwerken ${msK.toFixed(0)} ms)`);
    if (t.kistZweeft) fout(`${soort}: ${t.kistZweeft} kisten zonder vaste grond`);
    if (t.spoorZweeft) fout(`${soort}: ${t.spoorZweeft} sporen zonder blok eronder`);
    if (soort === 'krater' && t.ster < 3) fout('krater zonder sterrensteen');
    if (soort === 'mijn' && (t.spoor < 10 || t.hek < 6)) fout('mijn zonder spoor of stutten');
    if (t.lek) fout(`mijn: ${t.lek} keer water naast de gang`);
  }
}
console.log(fouten ? fouten + ' FOUTEN' : 'alle bouwwerktests goed');
process.exit(fouten ? 1 : 0);

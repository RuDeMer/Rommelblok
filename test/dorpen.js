// dorpjes: hoe vaak, hoe ver van de start, vast per zaadje, zonder naden (ook in een andere volgorde),
// deuren en bedden bereikbaar, geen lekkend water, geen bomen in de huizen, en een plattegrond om te bekijken (kaart=1)
const { gedeeld } = require('./laad.js'); const G = gedeeld(); const { B, W: WATER, VAST, DICHT, BL } = G;
let fouten = 0; const fout = t => { console.log('FOUT ' + t); fouten++; };
const zaden = (process.argv[2] || '777,4242,12345').split(','), kaart = process.argv.includes('kaart=1');
const N = 6; // gebieden van 256: -N tot N-1, dus 3 x 3 km
const tel = { totaal: 0, huizen: 0, gebouwen: {}, bedden: 0, stijl: {}, akkers: 0 };
for (const zt of zaden) {
  const zaad = G.zaadVan(zt), A = G.maakWereld(zaad), A2 = G.maakWereld(zaad), sp = A.startPlek();
  const lijst = [];
  let t0 = Date.now();
  for (let rz = -N; rz < N; rz++) for (let rx = -N; rx < N; rx++) {
    const d = A.dorpVan(rx, rz), d2 = A2.dorpVan(rx, rz);
    if (JSON.stringify(d) !== JSON.stringify(d2)) fout(`zaad ${zt}: gebied ${rx},${rz} niet hetzelfde`);
    if (d) lijst.push(d);
  }
  const km2 = (N * 2 * 256 / 1000) ** 2;
  lijst.sort((a, b) => Math.hypot(a.x - sp.x, a.z - sp.z) - Math.hypot(b.x - sp.x, b.z - sp.z));
  console.log(`zaad ${zt}: ${lijst.length} plekken voor een dorpje (${Date.now() - t0} ms)`);
  if (!lijst.length) { fout(`zaad ${zt}: geen dorpjes`); continue; }
  if (Math.hypot(lijst[0].x - sp.x, lijst[0].z - sp.z) < 30) fout(`zaad ${zt}: de start ligt in een dorpje`);
  // wat er in alle dorpjes staat (zonder de stukken te maken)
  const plan = {}, gelukt = lijst.filter(D => A.bouwVak(Math.floor(D.x / 64), Math.floor(D.z / 64)).soorten.some(q => q[0] === 'dorp'));
  for (const D of gelukt) { const info = A.bouwVak(Math.floor(D.x / 64), Math.floor(D.z / 64)).soorten.find(q => q[0] === 'dorp')[5]; for (const g of info.gebouwen) plan[g.soort] = (plan[g.soort] || 0) + 1; plan.akker = (plan.akker || 0) + info.akkers.length; }
  const af = gelukt.length ? Math.round(Math.hypot(gelukt[0].x - sp.x, gelukt[0].z - sp.z)) : -1;
  if (af < 0 || af > 1200) fout(`zaad ${zt}: het dichtstbijzijnde dorpje is ${af} m ver`);
  console.log(`  ${gelukt.length} van de ${lijst.length} plekken werden een dorpje (${(gelukt.length / km2).toFixed(1)} per km², dichtstbij de start ${af} m); samen ${Object.entries(plan).map(([k, n]) => k + ' ' + n).join(', ')}`);
  // de drie dichtstbijzijnde helemaal maken en controleren
  for (const D of gelukt.slice(0, 3)) {
    const gx = Math.floor(D.x / 64), gz = Math.floor(D.z / 64), bv = A.bouwVak(gx, gz), s = bv.soorten.find(q => q[0] === 'dorp');
    const info = s[5], R = s[4], cx = Math.floor(D.x / 16), cz = Math.floor(D.z / 16), K = Math.ceil(R / 16) + 1;
    const C = G.maakWereld(zaad), Dw = G.maakWereld(zaad), stukken = [];
    for (let dz = -K; dz <= K; dz++) for (let dx = -K; dx <= K; dx++) stukken.push([cx + dx, cz + dz]);
    const a = new Map(), b = new Map(); let ms = 0;
    for (const [i, j] of stukken) { const t = performance.now(); a.set(i + ',' + j, C.maakStuk(i, j).d); ms += performance.now() - t; }
    for (const [i, j] of stukken.slice().reverse()) b.set(i + ',' + j, Dw.maakStuk(i, j).d);
    let anders = 0; for (const [k, d] of a) { const d2 = b.get(k); for (let q = 0; q < d.length; q++) if (d[q] !== d2[q]) anders++; }
    if (anders) fout(`dorpje ${info.id}: ${anders} blokken anders in een andere volgorde`);
    const get = (X, Y, Z) => { const d = a.get(Math.floor(X / 16) + ',' + Math.floor(Z / 16)); if (!d || Y < 0 || Y >= 128) return -1; return d[(Y << 8) | ((((Z % 16) + 16) % 16) << 4) | (((X % 16) + 16) % 16)]; };
    const id = (X, Y, Z) => get(X, Y, Z) & 255;
    const vrij = (X, Y, Z) => { const i = id(X, Y, Z); return i === 0 || (!VAST[i] && i !== WATER) || BL[i].vorm === 'deur'; };
    const vloer = (X, Y, Z) => { const i = id(X, Y - 1, Z); return VAST[i] || BL[i].vorm === 'plaat' || BL[i].vorm === 'trap'; };
    // bereikbaar: vanaf de put over de grond lopen (een blok omhoog of drie omlaag per stap)
    const start = [D.x + 2, info.put[1], D.z + 2], gezien = new Set([start.join(',')]), rij = [start];
    while (rij.length) {
      const [x, y, z] = rij.shift();
      for (const [dx, dz] of G.RICHTING) for (const dy of [0, 1, -1, -2, -3]) {
        const X = x + dx, Y = y + dy, Z = z + dz, k = X + ',' + Y + ',' + Z;
        if (Math.hypot(X - D.x, Z - D.z) > R + 4 || gezien.has(k)) continue;
        if (!vrij(X, Y, Z) || !vrij(X, Y + 1, Z) || !vloer(X, Y, Z)) continue;
        if (dy === 1 && !vrij(x, y + 2, z)) continue;
        if (dy < 0) { let ok = true; for (let q = Y + 1; q <= y + 1; q++) if (!vrij(X, q, Z)) ok = false; if (!ok) continue; }
        gezien.add(k); rij.push([X, Y, Z]); break;
      }
    }
    const t = { bedden: 0, bedWeg: 0, deurDicht: 0, werkWeg: 0, lek: 0, boom: 0, deur: 0, gebouwen: info.gebouwen.length };
    for (const g of info.gebouwen) {
      tel.gebouwen[g.soort] = (tel.gebouwen[g.soort] || 0) + 1;
      if (id(...g.deur) !== B.deur) t.deurDicht++; else t.deur++;
      if (!gezien.has(g.buiten.join(',')) || !gezien.has(g.binnen.join(','))) t.deurDicht++;
      for (const bd of g.bedden) { t.bedden++; if (id(...bd) !== B.bed) t.bedWeg++; }
      if (g.werk && !gezien.has(g.werk.join(','))) t.werkWeg++;
    }
    tel.bedden += t.bedden; tel.huizen += info.gebouwen.length; tel.totaal++; tel.stijl[info.stijl] = (tel.stijl[info.stijl] || 0) + 1; tel.akkers += info.akkers.length;
    // water in de put en de sloten mag nergens naast lucht liggen; geen boomstam of blad binnen het dorpje
    for (let Z = D.z - R; Z <= D.z + R; Z++) for (let X = D.x - R; X <= D.x + R; X++) for (let Y = D.h - 12; Y < D.h + 16; Y++) {
      const i = id(X, Y, Z);
      if (i === WATER && Math.hypot(X - D.x, Z - D.z) < R - 4) for (const [dx, dz] of G.RICHTING) if (id(X + dx, Y, Z + dz) === 0) t.lek++;
      if (Math.hypot(X - D.x, Z - D.z) < R - 9 && BL[i] && /^(blad_|stam_(?!eik|spar))/.test(BL[i].sleutel) && Y > D.h - 3) t.boom++;
    }
    console.log(`  dorpje ${info.id} (${info.stijl}, ${Math.round(Math.hypot(D.x - sp.x, D.z - sp.z))} m): ${info.gebouwen.map(g => g.soort).join(' ')}, ${info.akkers.length} akker(s), ${t.bedden} bedden, straal ${R}, ${stukken.length} stukken in ${ms.toFixed(0)} ms`);
    if (t.deurDicht) fout(`dorpje ${info.id}: ${t.deurDicht} deuren niet te bereiken`);
    if (t.bedWeg) fout(`dorpje ${info.id}: ${t.bedWeg} bedden weg`);
    if (t.werkWeg) fout(`dorpje ${info.id}: ${t.werkWeg} werkplekken niet te bereiken`);
    if (t.lek) fout(`dorpje ${info.id}: ${t.lek} keer water naast lucht`);
    if (t.boom) fout(`dorpje ${info.id}: ${t.boom} blokken boom in het dorp`);
    if (t.gebouwen < 3 || t.bedden < 2) fout(`dorpje ${info.id}: te klein (${t.gebouwen} gebouwen, ${t.bedden} bedden)`);
    if (kaart) {
      // van boven: het bovenste vaste blok per kolom
      const TEKEN = { [B.klinkers]: '=', [B.grind]: '=', [B.zandsteen]: 'z', [B.trap_baksteen]: '^', [B.trap_hout]: '^', [B.plaat_baksteen]: '-', [B.plaat_hout]: '-', [B.plaat_zandsteen]: '-', [WATER]: '~', [B.akker]: '#', [B.stam_eik]: 'H', [B.stam_spar]: 'H', [B.gras]: '.', [B.aarde]: ',', [B.hek]: 'i', [B.lantaarn]: '*', [B.deur]: 'D', [B.linnen_rood]: 'L', [B.linnen_geel]: 'L', [B.linnen_blauw]: 'L', [B.linnen_groen]: 'L', [B.linnen_oranje]: 'L', [B.steenstenen]: 'o', [B.kei]: 'o', [B.sneeuwgras]: '.', [B.mergelblokken]: 'm', [B.pleister]: 'p' };
      for (let Z = D.z - R; Z <= D.z + R; Z++) {
        let rijT = '';
        for (let X = D.x - R; X <= D.x + R; X++) {
          let Y = D.h + 14; while (Y > 0 && !(VAST[id(X, Y, Z)] || id(X, Y, Z) === WATER || [B.hek, B.lantaarn].includes(id(X, Y, Z)))) Y--;
          const i = id(X, Y, Z), gw = i >= B.gewas_tarwe && i <= B.gewas_pompoen;
          rijT += gw ? '"' : TEKEN[i] || (BL[i] && BL[i].vorm === 'kruis' ? '\'' : '?');
        }
        console.log('   ' + rijT);
      }
    }
  }
}
console.log(`samen: ${tel.totaal} dorpjes bekeken, ${tel.huizen} gebouwen (${Object.entries(tel.gebouwen).map(([k, n]) => k + ' ' + n).join(', ')}), ${tel.akkers} akkers, ${tel.bedden} bedden; stijlen ${Object.entries(tel.stijl).map(([k, n]) => k + ' ' + n).join(', ')}`);
console.log(fouten ? fouten + ' FOUTEN' : 'dorpjes: alles goed');
process.exit(fouten ? 1 : 0);

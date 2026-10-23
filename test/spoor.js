// rails: vanzelf verbinden (recht, bocht, helling), en de vormen kloppen
const L = require('./laad'); const G = L.gedeeld(); const B = G.B;
const wereld = new Map(); const k = (x, y, z) => x + ',' + y + ',' + z;
const zet = (x, y, z, v) => wereld.set(k(x, y, z), v), get = (x, y, z) => wereld.get(k(x, y, z)) || 0;
function leg(x, y, z, kr, stuw) {
  const buur = (dx, dy, dz) => get(x + dx, y + dy, z + dz);
  const r = G.spoorKies(buur, kr || 0, !!stuw);
  zet(x, y, z, (stuw ? B.stuwspoor : B.mijnspoor) | (r.st << 8));
  for (const [dx, dy, dz, v] of r.buren) zet(x + dx, y + dy, z + dz, v);
  return r.st;
}
const st = (x, y, z) => get(x, y, z) >> 8;
let fout = 0; const ok = (c, m) => { console.log((c ? 'goed ' : 'FOUT ') + m); if (!c) fout++; };
// een rechte lijn langs x
leg(0, 0, 0, 1); leg(1, 0, 0, 1); leg(2, 0, 0, 0);
ok([0, 1, 2].every(x => (st(x, 0, 0) & 15) === 1), 'recht langs x: ' + [0, 1, 2].map(x => st(x, 0, 0)));
// een bocht: verder naar +z vanaf het eind
leg(2, 0, 1, 0);
ok(G.spoorEinden(st(2, 0, 0)).sort().join() === '2,3', 'bocht op het eind (west en zuid): ' + st(2, 0, 0) + ' einden ' + G.spoorEinden(st(2, 0, 0)));
ok((st(2, 0, 1) & 15) === 0, 'na de bocht recht langs z: ' + st(2, 0, 1));
// een helling omhoog: het volgende spoor ligt een blok hoger
leg(2, 1, 2, 0);
ok(G.spoorOp(st(2, 0, 1)) === 2, 'het spoor ervoor wordt een helling omhoog naar het zuiden: ' + st(2, 0, 1));
leg(2, 1, 3, 0);
ok((st(2, 1, 2) & 15) === 0 && (st(2, 1, 3) & 15) === 0, 'boven verder recht');
// een stuwspoor maakt geen bocht
wereld.clear(); leg(0, 0, 0, 1); leg(0, 0, 1, 0, false); const s2 = leg(1, 0, 0, 1, true);
ok(s2 < 4, 'stuwspoor buigt niet: ' + s2);
// vormen: elke stand geeft dozen binnen het blok
let n = 0; for (let s = 0; s < 12; s++) for (const id of [B.mijnspoor, B.stuwspoor]) { const d = G.vormDozen(id | (s << 8), () => 0); if (!d.length || d.some(b => b.slice(0, 6).some(q => q < 0 || q > 16))) { fout++; console.log('FOUT vorm', id, s); } n += d.length; }
ok(true, 'vormen: ' + n + ' dozen voor 24 standen');
// einden van elke stand
for (let s = 0; s < 12; s++) { const e = G.spoorEinden(s); if (e[0] === e[1]) { fout++; console.log('FOUT einden', s, e); } }
// een oude stand (0 tot 3, zoals in mijnen van de vorige versie) blijft recht
ok([0, 1, 2, 3].every(s => G.spoorEinden(s).length === 2 && G.spoorOp(s) < 0), 'oude standen blijven recht');
console.log(fout ? 'NIET GOED' : 'rails: alles goed');
process.exit(fout ? 1 : 0);

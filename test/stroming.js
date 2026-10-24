// Stromend water neemt dieren en griezels mee (gedeelde code): node test/stroming.js
// Een goot van 24 blokken lang met een bron aan het begin: het water stroomt naar +x. Elk dier dat erin staat
// (ook als het stilstaat), drijft mee; wie zweeft (spookje, grotkwal) niet. In stilstaand water (een vijver met
// alleen bronnen) blijft een dier staan waar het staat.
const { G } = require('../shared/index.js');
const WZ = G.WEZENS, B = G.B;
let fouten = 0; const ok = (b, t) => { console.log((b ? 'goed ' : 'FOUT ') + t); if (!b) fouten++; };
function wereld() {
  const m = new Map(), k = (x, y, z) => x + ',' + y + ',' + z;
  const W = {
    zet: (x, y, z, v) => m.set(k(x, y, z), v),
    blok: (x, y, z) => { if (Math.abs(x) > 60 || Math.abs(z) > 60) return -1; const v = m.get(k(x, y, z)); if (v !== undefined) return v; return y < 64 ? B.steen : y === 64 ? B.gras : 0; },
    licht: () => 0xF0, biome: () => G.BI.vlakte, tijd: 0.5, spelers: [], r: G.rng(7), moeilijk: 'vredig',
  };
  return W;
}
// een goot op hoogte 64 (in de grond), van x = 0 tot 24, met water zoals de wereldbaas het laat stromen: bron, dan niveau 1 tot 7 en weer opnieuw
function goot(W) {
  for (let x = -1; x <= 25; x++) for (let z = -2; z <= 2; z++) W.zet(x, 64, z, Math.abs(z) === 2 || x === -1 || x === 25 ? B.steen : 0);
  for (let x = 0; x <= 24; x++) for (let z = -1; z <= 1; z++) W.zet(x, 64, z, x % 8 === 0 ? G.W : G.W | ((x % 8) << 8));
}
const stroomt = WZ.stroming(w => 0, 0, 0, 0);
ok(stroomt[0] === 0 && stroomt[1] === 0, 'geen water: geen stroming');
for (const S of WZ.WEZENS) {
  const W = wereld(); goot(W);
  const w = WZ.nieuwWezen(S.id, 2.5, 64.02, 0.5, 0, 50000 + S.id);
  w.st = 'rust'; w.t = 1e9; w.dx = w.dz = 0;
  // de soort doet niets uit zichzelf (stilstaan); dat stroomt het water drie seconden lang
  const x0 = w.x;
  for (let t = 0; t < 3; t += 0.02) { w.st = 'rust'; w.t = 1e9; w.dx = w.dz = 0; WZ.stap(w, 0.02, W); }
  const verder = w.x - x0;
  if (S.zweeft) ok(Math.abs(verder) < 0.5, `${S.sleutel} zweeft en blijft waar hij is (${verder.toFixed(2)} blok)`);
  else ok(verder > 3, `${S.sleutel} drijft met het water mee (${verder.toFixed(1)} blokken in 3 seconden)`);
}
// stilstaand water: een vijver van alleen bronnen
{
  const W = wereld();
  for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) W.zet(x, 64, z, G.W);
  const w = WZ.nieuwWezen(WZ.WI.eend, 0.5, 64.02, 0.5, 0, 60000);
  for (let t = 0; t < 3; t += 0.02) { w.st = 'rust'; w.t = 1e9; w.dx = w.dz = 0; WZ.stap(w, 0.02, W); }
  ok(Math.hypot(w.x - 0.5, w.z - 0.5) < 0.3, 'in een stille vijver blijft een eend liggen waar hij ligt (' + Math.hypot(w.x - 0.5, w.z - 0.5).toFixed(2) + ')');
}
console.log(fouten ? fouten + ' FOUTEN' : 'het water neemt iedereen mee');
process.exit(fouten ? 1 : 0);

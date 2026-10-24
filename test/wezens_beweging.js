// Dieren en griezels bewegen door de wereld zoals de speler (gedeelde code): node test/wezens_beweging.js
// 1. een tapijtje of mostapijt van één pixel in een gang van twee hoog: ze lopen eroverheen
// 2. een spinnenweb houdt ze bijna vast (spookjes en kwallen zweven er gewoon doorheen)
// 3. op een waterlelie kunnen ze staan
const { G } = require('../shared/index.js');
const WZ = G.WEZENS, B = G.B, WI = WZ.WI;
let fouten = 0; const mis = (...a) => { fouten++; console.log('MIS:', ...a); };
function wereld(extra) {
  const m = new Map(), k = (x, y, z) => x + ',' + y + ',' + z;
  const W = {
    zet: (x, y, z, v) => m.set(k(x, y, z), v),
    blok: (x, y, z) => { if (Math.abs(x) > 60 || Math.abs(z) > 60) return -1; const v = m.get(k(x, y, z)); if (v !== undefined) return v; return y < 64 ? B.steen : y === 64 ? B.gras : 0; },
    licht: () => 0xF0, biome: () => G.BI.vlakte, tijd: 0.5, spelers: [], r: G.rng(7), moeilijk: 'normaal',
  };
  if (extra) extra(W);
  return W;
}
// een wezen een tijdje rechtdoor laten lopen (in +x)
function loopRecht(w, W, sec) { for (let t = 0; t < sec; t += 0.05) { w.st = 'loop'; w.t = 9; w.dx = 1; w.dz = 0; WZ.stap(w, 0.05, W); } }
// 1. een gang van twee hoog (vloer y 64, plafond y 67) met een tapijtje
for (const soort of ['mos', 'tapijt']) {
  const W = wereld(W => { for (let x = -5; x <= 10; x++) { W.zet(x, 67, 0, B.steen); for (const z of [-1, 1]) for (let y = 65; y <= 66; y++) W.zet(x, y, z, B.steen); } for (let x = 0; x <= 2; x++) W.zet(x, 65, 0, B[soort]); });
  for (const s of ['schaap', 'kip']) {
    const w = WZ.nieuwWezen(WI[s], -3.5, 65, 0.5, 0); loopRecht(w, W, 6);
    console.log(soort + ', ' + s + ': x ' + w.x.toFixed(1) + ', y ' + w.y.toFixed(3));
    if (!(w.x > 3)) mis(s + ' bleef steken voor een ' + soort + ' in een lage gang');
  }
}
// 2. een spinnenweb
{
  const W = wereld(W => { for (let x = 0; x <= 6; x++) for (let y = 65; y <= 66; y++) W.zet(x, y, 0, B.spinnenweb); });
  const w = WZ.nieuwWezen(WI.schaap, -0.5, 65, 0.5, 0); loopRecht(w, W, 1); const x0 = w.x; loopRecht(w, W, 2); const inWeb = (w.x - x0) / 2;
  const v = WZ.nieuwWezen(WI.schaap, -10.5, 65, 5.5, 0); loopRecht(v, W, 1); const x1 = v.x; loopRecht(v, W, 2); const zonder = (v.x - x1) / 2;
  console.log('spinnenweb: schaap ' + inWeb.toFixed(2) + ' blok/s, zonder web ' + zonder.toFixed(2));
  if (!(inWeb < zonder * 0.4)) mis('een spinnenweb vertraagt een schaap niet');
  const W2 = wereld(W => { for (let y = 66; y <= 80; y++) W.zet(0, y, 0, B.spinnenweb); });
  const k = WZ.nieuwWezen(WI.kip, 0.5, 82, 0.5, 0); let snel = 0;
  for (let t = 0; t < 4; t += 0.05) { k.st = 'rust'; k.t = 9; WZ.stap(k, 0.05, W2); if (k.y < 79 && k.y > 67) snel = Math.max(snel, -k.vy); }
  console.log('spinnenweb: een kip valt er hooguit ' + snel.toFixed(2) + ' blok/s doorheen');
  if (!(snel <= 1.05)) mis('door een spinnenweb vallen gaat te snel');
}
// 3. een waterlelie
{
  const W = wereld(W => { for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) W.zet(x, 64, z, G.W); W.zet(0, 65, 0, B.waterlelie); });
  const w = WZ.nieuwWezen(WI.kip, 0.5, 67, 0.5, 0);
  for (let t = 0; t < 2; t += 0.05) { w.st = 'rust'; w.t = 9; WZ.stap(w, 0.05, W); }
  console.log('waterlelie: een kip staat op ' + (w.y - 65).toFixed(3) + ' boven de lelie-plek');
  if (!(w.y > 65.04 && w.y < 65.1)) mis('een kip kan niet op een waterlelie staan');
}
console.log(fouten ? fouten + ' FOUTEN' : 'wezens bewegen: alles goed');
process.exit(fouten ? 1 : 0);

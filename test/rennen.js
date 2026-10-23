// wandelen en rennen gaan geleidelijk in elkaar over: snelheid, kijkhoek, passen (en daarmee de arm en het schommelen)
const { open, wachtKlaar } = require('./pw');
(async () => {
  const { page, fouten, sluit } = await open({ q: 'test=1&zaad=12345&stand=overleven&straal=2', ctx: { viewport: { width: 640, height: 400 } } });
  await wachtKlaar(page); await page.waitForTimeout(1200);
  // een vlakke stenen baan hoog in de lucht, zodat niets je afremt
  const [X, Z, proef] = await page.evaluate(() => { const R = window.__rommelblok, B = R.G.B, X = Math.floor(R.sp.x), Z = Math.floor(R.sp.z), a = []; for (let z = 2; z >= -40; z--) for (let x = -2; x <= 2; x++) R.zetBlok(X + x, 100, Z + z, B.steen); return [X, Z, R.blokOp(X, 100, Z)]; });
  await page.waitForTimeout(1500);
  const r = await page.evaluate(([X, Z]) => {
    const R = window.__rommelblok, sp = R.sp, dt = 1 / 60, rij = [];
    R.tekenUit = true; R.zet(X + 0.5, 101.01, Z + 1.5); R.kijk(0, 0); R.sim(30, dt, {});
    const meet = (n, i) => { for (let k = 0; k < n; k++) { R.sim(1, dt, i); rij.push({ v: Math.hypot(sp.vx, sp.vz), fov: sp.fovExtra, mix: sp.renMix, g: sp.opGrond, y: sp.y, z: sp.z }); } };
    meet(60, { voor: 1 });                // 1 s wandelen
    meet(90, { voor: 1, rent: true });    // 1,5 s rennen
    meet(90, { voor: 1 });                // weer wandelen (rennen blijft aan zolang je vooruit loopt; dus loslaten = stoppen met vooruit)
    meet(90, { voor: 0 });                // stilstaan
    return rij;
  }, [X, Z]);
  // glad = geen knik: de verandering per beeldje verandert zelf maar weinig (tweede verschil), vanaf het wandelen tot het stilstaan
const knik = (k, a, b) => Math.max(...r.slice(a, b).map((x, i) => Math.abs(x[k] - 2 * r[a + i - 1][k] + r[a + i - 2][k])));
const sprong = knik('v', 62, 240);
  const fovSprong = knik('fov', 2, r.length);
  const op = i => r[i];
  const uit = { wandel: +op(59).v.toFixed(2), na03: +op(60 + 18).v.toFixed(2), na1: +op(60 + 60).v.toFixed(2), ren: +op(149).v.toFixed(2), fovRen: +op(149).fov.toFixed(2), fovNa05Stop: +op(330 - 60).fov.toFixed(2), eind: +op(329).fov.toFixed(2), snelheidsKnik: +sprong.toFixed(3), kijkhoekKnik: +fovSprong.toFixed(3) };
  console.log(JSON.stringify(uit)); if (process.env.RB_DEBUG) console.log(r.filter((x, i) => i % 10 === 0).map(x => [x.v.toFixed(2), x.g ? 'g' : 'l', x.y.toFixed(2), x.z.toFixed(1)].join(' ')).join(' | '));
  const mis = [];
  if (!(uit.wandel > 4 && uit.wandel < 4.5)) mis.push('wandelsnelheid');
  if (!(uit.ren > 5.5)) mis.push('rensnelheid');
  if (!(uit.na03 > uit.wandel + 0.3 && uit.na03 < uit.ren - 0.15)) mis.push('rennen begint niet geleidelijk');
  if (!(uit.fovRen > 5)) mis.push('kijkhoek bij rennen');
  if (!(uit.eind < 0.5)) mis.push('kijkhoek terug');
  if (uit.snelheidsKnik > 0.08) mis.push('snelheid verspringt');
  if (uit.kijkhoekKnik > 0.08) mis.push('kijkhoek verspringt');
  console.log(mis.length ? 'MIS: ' + mis.join(', ') : 'rennen: alles geleidelijk');
  console.log(fouten.join('\n') || 'geen fouten');
  await sluit(); process.exit(mis.length || fouten.length ? 1 : 0);
})();

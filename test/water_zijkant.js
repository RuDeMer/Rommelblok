// De zijkant van water is in beeld te zien (browser): node test/water_zijkant.js
// Een waterbron in een kuiltje van steen, met een ruit van glas ervoor. Door het glas kijk je recht op de zijkant
// van het water, met de stenen muur erachter. Die zijkant moet het beeld blauwer maken dan zonder water.
// (Vroeger werd hij door de tekenaar weggegooid: dan zag je alleen de muur, alsof er geen water was.)
const { open, wachtKlaar } = require('./pw');
const mis = []; const check = (ok, w) => { console.log((ok ? 'goed ' : 'FOUT ') + w); if (!ok) mis.push(w); };
(async () => {
  const b = await open({ q: 'test=1&zaad=777&stand=bouwen&straal=2&x=51&z=-41&tijd=0.5', ctx: { viewport: { width: 640, height: 400 } } });
  const { page, fouten } = b; await wachtKlaar(page); await page.waitForTimeout(2500);
  const plek = await page.evaluate(() => {
    const R = window.__rommelblok, B = R.G.B, X = Math.floor(R.sp.x), Y = Math.floor(R.sp.y) + 40, Z = Math.floor(R.sp.z);
    for (let x = -1; x <= 4; x++) for (let z = -2; z <= 2; z++) for (let y = -1; y <= 2; y++) R.zetBlok(X + x, Y + y, Z + z, 0);
    for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) R.zetBlok(X + x, Y - 1, Z + z, B.steen);
    R.zetBlok(X - 1, Y, Z, B.steen); R.zetBlok(X, Y, Z - 1, B.steen); R.zetBlok(X, Y, Z + 1, B.steen); R.zetBlok(X + 1, Y, Z, B.glas);
    R.sp.vliegt = true; R.zet(X + 3.5, Y + 0.25 - R.sp.oog, Z + 0.5); R.kijk(Math.PI / 2, 0); R.tijd(0.5);
    return [X, Y, Z];
  });
  // de kleur midden in beeld, een paar beeldjes later (gemiddeld over 9 x 9 punten)
  const kleur = async () => {
    await page.waitForTimeout(2500);
    return page.evaluate(() => {
      const gl = window.__rommelblok.R.gl, w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, a = new Uint8Array(4 * 81);
      gl.readPixels((w >> 1) - 4, (h >> 1) - 4, 9, 9, gl.RGBA, gl.UNSIGNED_BYTE, a);
      const k = [0, 0, 0]; for (let i = 0; i < 81; i++) for (let j = 0; j < 3; j++) k[j] += a[i * 4 + j] / 81;
      return k.map(v => Math.round(v));
    });
  };
  const zonder = await kleur();
  await page.evaluate(p => { const R = window.__rommelblok; R.zetBlok(p[0], p[1], p[2], R.G.W); }, plek);
  const met = await kleur();
  if (process.env.FOTO) await page.screenshot({ path: process.env.FOTO });
  const blauw = k => k[2] - (k[0] + k[1]) / 2;
  console.log('midden in beeld zonder water', zonder.join(','), 'met water', met.join(','));
  check(blauw(met) - blauw(zonder) > 12, 'door het glas zie je de zijkant van het water (blauwer: ' + (blauw(met) - blauw(zonder)).toFixed(0) + ')');
  check(!fouten.length, 'geen fouten in de console' + (fouten.length ? ': ' + fouten.join(' ') : ''));
  await b.sluit();
  console.log(mis.length ? mis.length + ' FOUTEN' : 'de zijkant van water is te zien');
  process.exit(mis.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

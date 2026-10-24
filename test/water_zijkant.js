// Water is van alle kanten te zien (browser): node test/water_zijkant.js
// 1. Een waterbron in een kuiltje van steen, met een ruit van glas ervoor. Door het glas kijk je recht op de zijkant
//    van het water, met de stenen muur erachter. Die zijkant moet het beeld blauwer maken dan zonder water.
//    (Vroeger werd hij door de tekenaar weggegooid: dan zag je alleen de muur, alsof er geen water was.)
// 2. Een trap met stromend water, van onderen gezien (de schuine bovenkanten liggen boven je ooghoogte en hellen naar je
//    toe). Ook daar moet je het water zien. (Vroeger vielen die schuine stukjes boven de horizon weg.)
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
    await page.evaluate(() => window.__rommelblok.wb({ t: 'water', n: 1 }));
    await page.waitForTimeout(4000);
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
  // ---- 2. een trap van 8 treden in +x, 5 breed tussen muurtjes, met bronnen bovenaan en een bak onderaan; je staat
  // achter de bak en kijkt de trap op. In een strook midden in beeld moet bijna alles water zijn: geen donkere banden
  // tussen de treden, waar je door het water heen de rots ziet.
  const trap = await page.evaluate(p => {
    const R = window.__rommelblok, B = R.G.B, [X0, Y0, Z0] = p, X = X0 + 24, Y = Y0 - 4, Z = Z0;
    for (let x = -3; x <= 15; x++) for (let z = -3; z <= 3; z++) for (let y = 0; y <= 13; y++) {
      const top = x <= 0 ? 9 : x <= 8 ? 9 - x : 1, muur = Math.abs(z) === 3 || x === -3 || x === 14, hoog = muur ? Math.max(top, 2) + (x < 0 || x === -3 ? 3 : 1) : top;
      R.zetBlok(X + x, Y + y, Z + z, x === 15 ? 0 : y <= hoog ? B.steen : 0);
    }
    return [X, Y, Z];
  }, plek);
  const strook = async () => {
    await page.evaluate(p => {
      const R = window.__rommelblok, [X, Y, Z] = p, e = [X + 17, Y + 4.4, Z + 0.5], d = [X + 3 - e[0], Y + 9 - e[1], Z + 0.5 - e[2]];
      R.zet(e[0], e[1] - R.sp.oog, e[2]); R.sp.vliegt = true; R.kijk(Math.atan2(-d[0], -d[2]), Math.atan2(d[1], Math.hypot(d[0], d[2])));
    }, trap);
    // wachten tot de wereldbaas klaar is en alle stukken getekend zijn
    await page.evaluate(() => window.__rommelblok.wb({ t: 'water', n: 1 }));
    await page.waitForTimeout(4000);
    return page.evaluate(() => {
      const gl = window.__rommelblok.R.gl, w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, y0 = Math.floor(h * 0.15), n = Math.floor(h * 0.35), a = new Uint8Array(4 * 6 * n);
      gl.readPixels((w >> 1) - 3, y0, 6, n, gl.RGBA, gl.UNSIGNED_BYTE, a);
      let blauw = 0; for (let i = 0; i < 6 * n; i++) if (a[i * 4 + 2] - (a[i * 4] + a[i * 4 + 1]) / 2 > 15) blauw++;
      return blauw / (6 * n);
    });
  };
  const droog = await strook();
  await page.evaluate(p => { const R = window.__rommelblok; for (let z = -2; z <= 2; z++) R.zetBlok(p[0] - 1, p[1] + 10, p[2] + z, R.G.W); }, trap);
  await page.evaluate(() => window.__rommelblok.wb({ t: 'water', n: 120 }));
  const nat = await strook();
  if (process.env.FOTO) await page.screenshot({ path: process.env.FOTO.replace('.png', '-trap.png') });
  console.log('de trap van onderen: water in de strook zonder water ' + (droog * 100).toFixed(0) + '%, met water ' + (nat * 100).toFixed(0) + '%');
  check(droog < 0.2 && nat > 0.8, 'van onderen is het water op de trap één dichte laag (' + (nat * 100).toFixed(0) + '% van de strook is water)');
  check(!fouten.length, 'geen fouten in de console' + (fouten.length ? ': ' + fouten.join(' ') : ''));
  await b.sluit();
  console.log(mis.length ? mis.length + ' FOUTEN' : 'de zijkant van water is te zien');
  process.exit(mis.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

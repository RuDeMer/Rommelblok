// Scherpe pixels van dichtbij, op de stand Hoog (browser): node test/scherpte.js
// 1. De textuurstapel van de blokken krijgt geen anisotrope filtering van de grafische kaart. Op Windows (Chrome via
//    Direct3D) maakt die ook het vergroten zacht, en dan zijn bloemen en gras van dichtbij wazig. Het spel doet de
//    scherpte op afstand zelf (BLOK_FS met scherp).
// 2. Van dichtbij (een muur van planken vlak voor je) zijn de pixels van de textuur hard: tussen twee pixels van de
//    textuur springt de kleur in één keer, zonder zachte overgang.
const { open, wachtKlaar } = require('./pw');
const mis = []; const check = (ok, w) => { console.log((ok ? 'goed ' : 'FOUT ') + w); if (!ok) mis.push(w); };
(async () => {
  const b = await open({ q: 'test=1&zaad=777&stand=bouwen&straal=2&x=51&z=-41&tijd=0.5', ctx: { viewport: { width: 640, height: 400 } } });
  const { page, fouten } = b;
  // elke instelling van een textuur bijhouden, en dan opnieuw laden op de stand Hoog
  await page.addInitScript(() => {
    window.__aniso = [];
    const P = WebGL2RenderingContext.prototype, f = P.texParameterf, i = P.texParameteri;
    P.texParameterf = function (doel, naam, waarde) { if (naam === 0x84FE) window.__aniso.push(waarde); return f.call(this, doel, naam, waarde); };
    P.texParameteri = function (doel, naam, waarde) { if (naam === 0x84FE) window.__aniso.push(waarde); return i.call(this, doel, naam, waarde); };
  });
  await page.evaluate(() => { localStorage.setItem('rommelblok-v3', JSON.stringify({ v: 3, inst: { kwaliteit: 'hoog' } })); });
  await page.reload(); await wachtKlaar(page); await page.waitForTimeout(2000);
  const st = await page.evaluate(() => ({ kw: window.__rommelblok.inst.kwaliteit, aniso: window.__aniso }));
  check(st.kw === 'hoog', 'de stand is Hoog (' + st.kw + ')');
  check(!st.aniso.some(w => w > 1), 'geen anisotrope filtering van de grafische kaart (' + (st.aniso.length ? st.aniso.join(', ') : 'niet ingesteld') + ')');
  // een muur van planken, een halve meter voor je ogen
  await page.evaluate(() => {
    const R = window.__rommelblok, B = R.G.B, X = Math.floor(R.sp.x), Y = Math.floor(R.sp.y) + 40, Z = Math.floor(R.sp.z);
    for (let y = -3; y <= 4; y++) for (let z = -4; z <= 4; z++) { R.zetBlok(X - 1, Y + y, Z + z, B.planken_eik); for (let x = 0; x <= 2; x++) R.zetBlok(X + x, Y + y, Z + z, 0); }
    R.sp.vliegt = true; R.zet(X + 0.55, Y + 0.5 - R.sp.oog, Z + 0.5); R.kijk(Math.PI / 2, 0);
  });
  await page.evaluate(() => window.__rommelblok.wb({ t: 'water', n: 1 }));
  await page.waitForTimeout(4000);
  if (process.env.FOTO) await page.screenshot({ path: process.env.FOTO });
  // een rij pixels midden in beeld: hoeveel van de kleurstappen zijn zacht (een overgang over meerdere schermpixels)?
  const r = await page.evaluate(() => {
    const gl = window.__rommelblok.R.gl, w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, a = new Uint8Array(w * 4 * 5);
    gl.readPixels(0, (h >> 1) - 2, w, 5, gl.RGBA, gl.UNSIGNED_BYTE, a);
    let hard = 0, zacht = 0;
    for (let rij = 0; rij < 5; rij++) for (let x = 1; x < w - 1; x++) {
      const k = i => a[(rij * w + i) * 4] + a[(rij * w + i) * 4 + 1] + a[(rij * w + i) * 4 + 2];
      const d1 = Math.abs(k(x) - k(x - 1)), d2 = Math.abs(k(x + 1) - k(x));
      if (d1 > 24) hard++; else if (d1 > 3 && d2 > 3 && Math.sign(k(x) - k(x - 1)) === Math.sign(k(x + 1) - k(x))) zacht++;
    }
    return { hard, zacht, breed: w };
  });
  console.log('kleurstappen in de rij: hard ' + r.hard + ', zacht ' + r.zacht);
  check(r.hard > 20 && r.zacht < r.hard * 0.5, 'van dichtbij zijn de pixels van de textuur hard (zacht ' + r.zacht + ' tegen hard ' + r.hard + ')');
  check(!fouten.length, 'geen fouten in de console' + (fouten.length ? ': ' + fouten.join(' ') : ''));
  await b.sluit();
  console.log(mis.length ? mis.length + ' FOUTEN' : 'scherp van dichtbij');
  process.exit(mis.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

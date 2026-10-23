const UIT = require('./uit');
const { open, wachtKlaar } = require('./pw');
(async () => {
  for (const [naam, q] of [
    ['w_meer', 'test=1&zaad=12345&x=36&z=2&hoog=1&pitch=-0.45&yaw=4.6&tijd=0.4&straal=4'],
    ['w_val', 'test=1&zaad=12345&x=60&z=-40&tijd=0.47&straal=3'],
  ]) {
    const { page, fouten, sluit } = await open({ q, ctx: { viewport: { width: 720, height: 405 } } });
    await wachtKlaar(page);
    if (naam === 'w_val') {
      await page.evaluate(async () => {
        const R = window.__rommelblok, sp = R.sp; const X = Math.floor(sp.x) + 4, Z = Math.floor(sp.z);
        let y = 110; while (y > 40 && !(R.blokOp(X, y, Z) > 0 && R.G.VAST[R.blokOp(X, y, Z) & 255])) y--;
        const a = []; for (let h = 1; h <= 6; h++) for (let dz = -1; dz <= 1; dz++) a.push(X, y + h, Z + dz, R.G.B.steen);
        a.push(X, y + 7, Z, R.G.W); R.wbWorker.postMessage({ t: 'zet', a });
        R.zet(X - 5.5, y + 3, Z + 0.5); R.kijk(-Math.PI / 2, -0.05); R.WD.inv[0] = { id: R.G.I.emmer_water, n: 1 }; R.kies(0);
      });
      await page.evaluate(() => window.__rommelblok.wb({ t: 'water', n: 24 }));
    }
    await page.waitForTimeout(8000);
    await page.screenshot({ path: UIT + '/' + naam + '.png' }).catch(e => console.log('geen beeld', naam));
    console.log(naam, fouten.join(' ') || 'geen fouten'); await sluit();
  }
})();

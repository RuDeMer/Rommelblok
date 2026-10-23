// het bouwmenu: openen, groepen, zoeken, tikken, slepen, prullenbak, start-snelbalk; en bij overleven gewoon de rugzak
const { open, wachtKlaar } = require('./pw');
(async () => {
  const uit = {};
  for (const [naam, ctx] of [['pc', { viewport: { width: 1100, height: 700 } }], ['tel', { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true }]]) {
    const { page, fouten, sluit } = await open({ q: 'test=1&zaad=777&stand=bouwen&straal=2', ctx });
    await wachtKlaar(page); await page.waitForTimeout(600);
    await page.evaluate(() => { window.__rommelblok.tekenUit = true; window.__rommelblok.openRugzak(); });
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => {
      const R = window.__rommelblok, G = R.G, u = {};
      u.open = !document.getElementById('rb-bouwmenu').hidden && document.getElementById('rb-rugzak').hidden;
      u.alles = document.querySelectorAll('#rb-bm-raster .rb-bm-ding').length;
      const ids = G.IT.map((it, id) => it ? id : -1).filter(id => id > 0 && id !== G.I.rugzak);
      u.zonderGroep = ids.filter(id => !G.bouwGroep(id)).map(id => G.IT[id].sleutel);
      u.perGroep = {}; for (const b of document.querySelectorAll('#rb-bm-tabs button')) { b.click(); u.perGroep[b.textContent] = document.querySelectorAll('#rb-bm-raster .rb-bm-ding').length; }
      document.querySelector('#rb-bm-tabs button').click();
      const z = document.getElementById('rb-bm-zoek'); z.value = 'glas'; z.dispatchEvent(new Event('input')); u.zoekGlas = [...document.querySelectorAll('#rb-bm-raster .rb-bm-ding')].map(b => b.getAttribute('aria-label'));
      z.value = ''; z.dispatchEvent(new Event('input'));
      return u;
    });
    // tikken op een blok: komt in het gekozen vak
    const doos = async (sel, schuif) => page.evaluate(([s, schuif]) => { const e = document.querySelector(s); if (schuif) e.scrollIntoView({ block: 'nearest' }); const b = e.getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; }, [sel, schuif]);
    const fakkel = await page.evaluate(() => window.__rommelblok.G.B.lantaarn);
    let [x, y] = await doos(`#rb-bm-raster .rb-bm-ding[data-id="${fakkel}"]`, true);
    await page.evaluate(() => window.__rommelblok.kies(4));
    if (naam === 'tel') await page.touchscreen.tap(x, y); else await page.mouse.click(x, y);
    r.naTik = await page.evaluate(() => { const s = window.__rommelblok.WD.inv[4]; return s && window.__rommelblok.G.IT[s.id].sleutel; });
    // slepen naar vak 3 (op een telefoon: opzij vegen), en dan vak 3 naar de prullenbak
    const glas = await page.evaluate(() => window.__rommelblok.G.B.boekenkast);
    [x, y] = await doos(`#rb-bm-raster .rb-bm-ding[data-id="${glas}"]`, true);
    const [vx, vy] = await doos('#rb-bm-balk .rb-vak[data-balk="2"]');
    const sleep = async (x0, y0, x1, y1, vinger) => {
      if (!vinger) { await page.mouse.move(x0, y0); await page.mouse.down(); for (let i = 1; i <= 12; i++) await page.mouse.move(x0 + (x1 - x0) * i / 12, y0 + (y1 - y0) * i / 12); await page.mouse.up(); return; }
      const cdp = await page.context().newCDPSession(page);
      const tp = (type, xx, yy) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: xx, y: yy }] });
      await tp('touchStart', x0, y0); for (let i = 1; i <= 4; i++) { await tp('touchMove', x0 + 20 * i, y0); await page.waitForTimeout(20); }
      for (let i = 1; i <= 12; i++) { await tp('touchMove', x0 + 80 + (x1 - x0 - 80) * i / 12, y0 + (y1 - y0) * i / 12); await page.waitForTimeout(16); }
      await tp('touchEnd'); await page.waitForTimeout(50);
    };
    await sleep(x, y, vx, vy, naam === 'tel');
    r.naSlepen = await page.evaluate(() => { const s = window.__rommelblok.WD.inv[2]; return s && window.__rommelblok.G.IT[s.id].sleutel; });
    const [wx, wy] = await doos('#rb-bm-weg');
    await sleep(vx, vy, wx, wy, naam === 'tel');
    r.naPrullenbak = await page.evaluate(() => window.__rommelblok.WD.inv[2]);
    // bewaar als start, en een nieuwe bouwwereld begint met die snelbalk
    await page.evaluate(() => document.getElementById('rb-bm-start').click());
    r.start = await page.evaluate(() => { const R = window.__rommelblok, w = R.nieuweWereldGegevens('x', 'y', 'bouwen'); return w.inv.slice(0, 9).map(s => s ? R.G.IT[s.id].sleutel : null); });
    await page.screenshot({ path: require('./uit') + `/bouwmenu_${naam}.png` });
    // sluiten met Escape
    await page.keyboard.press('Escape'); r.dicht = await page.evaluate(() => document.getElementById('rb-bouwmenu').hidden);
    console.log(naam, JSON.stringify(r)); console.log(fouten.join(' ') || 'geen fouten');
    uit[naam] = r; await sluit();
  }
  // bij overleven: de gewone rugzak
  {
    const { page, fouten, sluit } = await open({ q: 'test=1&zaad=777&stand=overleven&straal=2' });
    await wachtKlaar(page); await page.evaluate(() => { window.__rommelblok.tekenUit = true; window.__rommelblok.openRugzak(); }); await page.waitForTimeout(200);
    const r = await page.evaluate(() => ({ rugzak: !document.getElementById('rb-rugzak').hidden, bouwmenu: !document.getElementById('rb-bouwmenu').hidden }));
    console.log('overleven', JSON.stringify(r), fouten.join(' ') || 'geen fouten'); await sluit();
    if (!r.rugzak || r.bouwmenu) process.exit(1);
  }
  const ok = ['pc', 'tel'].every(n => uit[n].open && uit[n].zonderGroep.length === 0 && uit[n].naTik === 'lantaarn' && uit[n].naSlepen === 'boekenkast' && uit[n].naPrullenbak === null && uit[n].dicht);
  console.log(ok ? 'bouwmenu goed' : 'BOUWMENU NIET GOED'); process.exit(ok ? 0 : 1);
})();

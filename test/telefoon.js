const UIT = require('./uit');
const { open, wachtKlaar } = require('./pw');
const wacht = ms => new Promise(ok => setTimeout(ok, ms));
(async () => {
  for (const [naam, w, h] of [['tel_staand', 390, 844], ['tel_liggend', 844, 390]]) {
    const { page, fouten, sluit } = await open({ q: 'test=1&zaad=777&stand=bouwen&tijd=0.45&straal=3&x=60&z=-40', ctx: { viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } });
    await wachtKlaar(page); await page.waitForTimeout(2000); if (process.argv[2] !== 'tekenen') await page.evaluate(() => { window.__rommelblok.tekenUit = true; });
    const cdp = await page.context().newCDPSession(page);
    const raak = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i })) });
    const info = () => page.evaluate(() => { const R = window.__rommelblok; return { pos: [R.sp.x, R.sp.y, R.sp.z].map(v => +v.toFixed(2)), aanraak: document.body.classList.contains('rb-aanraak'), yaw: +R.sp.yaw.toFixed(2) }; });
    const a = await info();
    // stuurknuppel: links omhoog slepen en vasthouden
    await raak('touchStart', [[w * 0.2, h * 0.7]]); await wacht(100);
    for (let i = 1; i <= 5; i++) { await raak('touchMove', [[w * 0.2, h * 0.7 - i * 12]]); await wacht(60); }
    await wacht(2500); await raak('touchEnd', []); await wacht(300);
    const b = await info();
    // rechts slepen: rondkijken
    await raak('touchStart', [[w * 0.75, h * 0.4]]); for (let i = 1; i <= 6; i++) { await raak('touchMove', [[w * 0.75 - i * 15, h * 0.4]]); await wacht(50); } await raak('touchEnd', []); await wacht(300);
    const c = await info();
    // naar beneden kijken, vasthouden: hakken (bouwstand: meteen weg)
    await page.evaluate(() => window.__rommelblok.kijk(window.__rommelblok.sp.yaw, -1.1)); await wacht(800);
    const doelVoor = await page.evaluate(() => { const d = window.__rommelblok.doel; return d && [d.x, d.y, d.z, d.v & 255]; });
    await raak('touchStart', [[w * 0.5, h * 0.55]]); await wacht(2200); await raak('touchEnd', []); await wacht(500);
    const naHak = await page.evaluate(p => p && window.__rommelblok.blokOp(p[0], p[1], p[2]), doelVoor);
    // tik: bouwen
    await page.evaluate(() => { const R = window.__rommelblok; R.WD.inv[0] = { id: R.G.B.baksteen, n: 64 }; R.kies(0); R.kijk(R.sp.yaw + 1.2, -0.55); }); await wacht(300);
    await raak('touchStart', [[w * 0.5, h * 0.55]]); await wacht(120); await raak('touchEnd', []); await wacht(800);
    const gebouwd = await page.evaluate(() => { let n = 0; const R = window.__rommelblok, X = Math.floor(R.sp.x), Y = Math.floor(R.sp.y), Z = Math.floor(R.sp.z); for (let dx = -5; dx <= 5; dx++) for (let dy = -5; dy <= 3; dy++) for (let dz = -5; dz <= 5; dz++) if ((R.blokOp(X + dx, Y + dy, Z + dz) & 255) === R.G.B.baksteen) n++; return n; });
    console.log(naam, JSON.stringify({ aanraak: a.aanraak, gelopen: +Math.hypot(b.pos[0] - a.pos[0], b.pos[2] - a.pos[2]).toFixed(2), gedraaid: +(c.yaw - b.yaw).toFixed(2), doelVoor, naHak, bakstenen: gebouwd }));
    await page.screenshot({ path: UIT + '/' + naam + '.png' });
    console.log(fouten.join('\n') || 'geen fouten'); await sluit();
  }
})();

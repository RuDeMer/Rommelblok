const UIT = require('./uit');
const { open, wachtKlaar } = require('./pw');
(async () => {
  const { page, fouten, sluit } = await open({ q: 'test=1&zaad=777&stand=overleven&tijd=0.45&straal=3&x=60&z=-40', ctx: { viewport: { width: 1100, height: 700 } } });
  await wachtKlaar(page); await page.waitForTimeout(1500);
  const r = await page.evaluate(async () => {
    const R = window.__rommelblok, G = R.G, sp = R.sp, uit = {};
    const wacht = ms => new Promise(ok => setTimeout(ok, ms));
    // een oven neerzetten voor de speler
    R.WD.inv[0] = { id: G.B.oven, n: 1 }; R.kies(0); R.kijk(0, -0.6); await wacht(200); R.sim(1, 1 / 60, {});
    const d = R.doel; R.gebruik(); await wacht(200);
    const ox = d.x + d.n[0], oy = d.y + d.n[1], oz = d.z + d.n[2];
    uit.oven = R.blokOp(ox, oy, oz) & 255;
    // vullen: 3 ijzerbrokken en 1 kolen
    const o = { soort: 'oven', in: { id: G.I.ijzerbrok, n: 3 }, brand: { id: G.I.kolen, n: 1 }, uit: null, brandTijd: 0, brandMax: 0, kook: 0 };
    R.WD.dingen[ox + ',' + oy + ',' + oz] = o;
    for (let i = 0; i < 30 * 10; i++) R.ovenTik(0.1);
    uit.na30s = { in: o.in, uit: o.uit, brand: o.brand, brandt: o.brandTijd > 0 };
    await wacht(300);
    uit.blokBrandt = (R.blokOp(ox, oy, oz) & 255) === G.B.oven_aan;
    // de oven openen en de staven eruit halen met shift + klik
    R.openBlok('oven', { x: ox, y: oy, z: oz, v: R.blokOp(ox, oy, oz) }); await wacht(300);
    uit.ovenScherm = document.getElementById('rb-rugzak-titel').textContent;
    return uit;
  });
  console.log(JSON.stringify(r));
  await page.keyboard.down('Shift'); await page.click('[data-plek="oven:uit"]'); await page.keyboard.up('Shift'); await page.waitForTimeout(200);
  console.log('ijzerstaven in de rugzak:', await page.evaluate(() => window.__rommelblok.WD.inv.filter(s => s && s.id === window.__rommelblok.G.I.ijzerstaaf).map(s => s.n)));
  await page.screenshot({ path: UIT + '/oven.png' });
  // kist: iets erin, kist kapot, inhoud valt eruit
  const k = await page.evaluate(async () => {
    const R = window.__rommelblok, G = R.G, wacht = ms => new Promise(ok => setTimeout(ok, ms));
    document.querySelector('[data-sluit]').click(); while (!document.getElementById('rb-rugzak').hidden) { document.querySelector('#rb-rugzak [data-sluit]').click(); await wacht(50); }
    R.WD.inv[1] = { id: G.B.kist, n: 1 }; R.kies(1); R.kijk(1.57, -0.6); await wacht(200); R.sim(1, 1 / 60, {});
    const d = R.doel; R.gebruik(); await wacht(200);
    const kx = d.x + d.n[0], ky = d.y + d.n[1], kz = d.z + d.n[2];
    const kist = (R.blokOp(kx, ky, kz) & 255) === G.B.kist;
    R.openBlok('kist', { x: kx, y: ky, z: kz }); await wacht(200);
    R.WD.dingen[kx + ',' + ky + ',' + kz].inhoud[0] = { id: G.I.appel, n: 5 };
    document.querySelector('#rb-rugzak [data-sluit]').click(); await wacht(100);
    const voor = R.losse.length; R.breek({ x: kx, y: ky, z: kz, v: R.blokOp(kx, ky, kz) }, false); await wacht(100);
    return { kist, losseErbij: R.losse.length - voor, dingWeg: !R.WD.dingen[kx + ',' + ky + ',' + kz] };
  });
  console.log('kist:', JSON.stringify(k));
  console.log(fouten.join('\n') || 'geen fouten'); await sluit();
})();

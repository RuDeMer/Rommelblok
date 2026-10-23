const UIT = require('./uit');
const { open, wachtKlaar } = require('./pw');
(async () => {
  const { page, fouten, sluit } = await open({ q: 'test=1&zaad=777&stand=overleven&tijd=0.45&straal=3&x=60&z=-40', ctx: { viewport: { width: 1100, height: 700 } } });
  await wachtKlaar(page); await page.waitForTimeout(1000);
  const t = await page.evaluate(() => {
    const R = window.__rommelblok, G = R.G, I = G.I, B = G.B, uit = {};
    const tijd = (blok, ding) => +R.hakTijd(B[blok], ding ? { id: I[ding], n: 1 } : null).toFixed(2);
    const oogst = (blok, ding) => R.opbrengst(B[blok], ding ? { id: I[ding], n: 1 } : null).map(([id, n]) => G.IT[id].sleutel + ':' + n).join(',') || 'niets';
    uit.steen = { hand: tijd('steen'), houweel_hout: tijd('steen', 'houweel_hout'), houweel_robijn: tijd('steen', 'houweel_robijn'), oogstHand: oogst('steen'), oogstHout: oogst('steen', 'houweel_hout') };
    uit.ijzererts = { houweel_steen: oogst('erts_ijzer', 'houweel_steen'), houweel_koper: oogst('erts_ijzer', 'houweel_koper') };
    uit.robijn = { houweel_koper: oogst('erts_robijn', 'houweel_koper'), houweel_ijzer: oogst('erts_robijn', 'houweel_ijzer') };
    uit.stam = { hand: tijd('stam_eik'), bijl_steen: tijd('stam_eik', 'bijl_steen') };
    uit.aarde = { hand: tijd('aarde'), schop_ijzer: tijd('aarde', 'schop_ijzer') };
    return uit;
  });
  console.log(JSON.stringify(t));
  await sluit();
  // bouwstand: alle blokken
  const b = await open({ q: 'test=1&zaad=777&stand=bouwen&tijd=0.45&straal=3&x=60&z=-40', ctx: { viewport: { width: 1100, height: 700 } } });
  await wachtKlaar(b.page); await b.page.waitForTimeout(1000);
  // in de bouwstand: het bouwmenu met alles
  await b.page.evaluate(() => window.__rommelblok.openRugzak()); await b.page.waitForTimeout(300);
  const n = await b.page.evaluate(() => document.querySelectorAll('#rb-bm-raster .rb-bm-ding').length);
  await b.page.click('#rb-bm-raster [data-id="' + (await b.page.evaluate(() => window.__rommelblok.G.B.tegel_delfts)) + '"]'); await b.page.waitForTimeout(200);
  console.log('bouwmenu:', n, 'voorwerpen; vak 1 is nu:', await b.page.evaluate(() => { const R = window.__rommelblok, s = R.WD.inv[R.WD.kies]; return R.G.IT[s.id].sleutel + ':' + s.n; }));
  await b.page.screenshot({ path: UIT + '/palet.png' });
  console.log(fouten.concat(b.fouten).join('\n') || 'geen fouten'); await b.sluit();
})();

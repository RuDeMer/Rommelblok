const UIT = require('./uit');
// schermafbeelding: de kleine kaart (en het kompas) op een telefoon, staand
const { open, wachtKlaar } = require('./pw');
(async () => {
  const { page, fouten, sluit } = await open({ q: 'test=1&zaad=777&stand=overleven&tijd=0.45&straal=3', ctx: { viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } });
  await wachtKlaar(page); await page.waitForTimeout(2500);
  const r = await page.evaluate(async () => {
    const R = window.__rommelblok; R.geef('kaart', 1); R.kies(R.WD.inv.findIndex(s => s && s.id === R.G.I.kaart)); await new Promise(ok => setTimeout(ok, 800));
    const vak = id => { const e = document.getElementById(id); if (!e || e.hidden) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)]; };
    const m = vak('rb-minikaart'), knoppen = ['tk-menu', 'tk-rugzak', 'tk-gooi', 'tk-spring', 'tk-hak', 'tk-bouw', 'tk-sluip'].map(id => [id, vak(id)]).filter(k => k[1]);
    const raakt = knoppen.filter(([, b]) => m && !(b[2] <= m[0] || b[0] >= m[2] || b[3] <= m[1] || b[1] >= m[3])).map(k => k[0]);
    return { mini: m, raakt };
  });
  await page.screenshot({ path: UIT + '/minikaart_telefoon.png' });
  console.log(JSON.stringify(r)); console.log(fouten.join(' ') || 'geen fouten'); await sluit();
  process.exit(r.mini && !r.raakt.length && !fouten.length ? 0 : 1);
})();

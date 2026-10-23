const UIT = require('./uit');
const { open, wachtKlaar } = require('./pw');
(async () => {
  const { page, fouten, sluit } = await open({ q: 'test=1&zaad=777&stand=overleven&tijd=0.45&straal=3&x=60&z=-40', ctx: { viewport: { width: 1100, height: 700 } } });
  await wachtKlaar(page); await page.waitForTimeout(1500);
  const r = await page.evaluate(async () => {
    const R = window.__rommelblok, G = R.G, uit = {};
    const wacht = ms => new Promise(ok => setTimeout(ok, ms));
    R.geef('stam_eik', 6); R.geef('kei', 12); R.geef('kolen', 3); R.geef('ijzerbrok', 4); R.geef('appel', 2);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }));
    await wacht(300);
    uit.open = !document.getElementById('rb-rugzak').hidden;
    // receptenboek: "wat kan ik maken" en planken maken
    [...document.querySelectorAll('.rb-tabs button')].find(b => b.textContent.includes('kan ik')).click(); await wacht(100);
    uit.kan = [...document.querySelectorAll('#rb-receptlijst .rb-recept')].map(b => b.getAttribute('aria-label'));
    const plank = [...document.querySelectorAll('#rb-receptlijst .rb-recept')].find(b => b.getAttribute('aria-label').startsWith('Eikenplanken'));
    plank.click(); await wacht(50); document.getElementById('rb-maakalles').click(); await wacht(100);
    const tel = k => R.WD.inv.reduce((a, s) => a + (s && s.id === (G.I[k] !== undefined ? G.I[k] : G.B[k]) ? s.n : 0), 0);
    uit.planken = tel('planken_eik'); uit.stammen = tel('stam_eik');
    // werkbank via het 2x2-raster: leg klaar en pak het resultaat
    [...document.querySelectorAll('.rb-tabs button')][0].click(); await wacht(100);
    const wbk = [...document.querySelectorAll('#rb-receptlijst .rb-recept')].find(b => b.getAttribute('aria-label').startsWith('Werkbank'));
    wbk.click(); await wacht(50); document.getElementById('rb-legklaar').click(); await wacht(100);
    const uitVak = document.querySelector('[data-plek="uit"]'); uit.resultaat = uitVak.getAttribute('aria-label');
    return uit;
  });
  console.log(JSON.stringify(r));
  // het resultaat oppakken met de muis en in de snelbalk leggen
  const box = await page.locator('[data-plek="uit"]').boundingBox(); await page.mouse.move(box.x + 20, box.y + 20); await page.mouse.down(); await page.mouse.up();
  const doel = await page.locator('[data-plek="inv:8"]').boundingBox(); await page.mouse.move(doel.x + 20, doel.y + 20); await page.mouse.down(); await page.mouse.up();
  await page.waitForTimeout(300);
  console.log('vak 9:', await page.evaluate(() => { const s = window.__rommelblok.WD.inv[8]; return s && window.__rommelblok.G.IT[s.id].sleutel + ':' + s.n; }));
  // helft oppakken met rechts
  const k = await page.locator('[data-plek="inv:0"]').boundingBox(); await page.mouse.move(k.x + 20, k.y + 20); await page.mouse.down({ button: 'right' }); await page.mouse.up({ button: 'right' });
  console.log('na rechts:', await page.evaluate(() => { const R = window.__rommelblok; return JSON.stringify(R.WD.inv[0]); }));
  await page.mouse.move(600, 300); await page.waitForTimeout(600);
  await page.screenshot({ path: UIT + '/rugzak.png' });
  console.log(fouten.join('\n') || 'geen fouten'); await sluit();
})();

// schermafbeeldingen van alle schermen in de nieuwe stijl, op een computer en op een telefoon
// node test/interface.js [pc|tel]
const UIT = require('./uit');
const { open, wachtKlaar } = require('./pw');
const welk = process.argv[2] || 'pc,tel';
// RB_BESTAND: een andere pagina in RB_UIT (bijvoorbeeld de referentie); RB_VOOR: voorvoegsel van de beelden;
// RB_ZONDER_WERELD=1: het 3D-beeld verbergen, zodat alleen de schermen zelf op de foto staan (om twee versies te vergelijken)
const BESTAND = process.env.RB_BESTAND || 'rommelblok.html', VOOR = process.env.RB_VOOR || 'ui', ZONDER = !!process.env.RB_ZONDER_WERELD;
(async () => {
  const fouten = [];
  for (const soort of welk.split(',')) {
    const tel = soort === 'tel';
    const ctx = tel ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 } : { viewport: { width: 1100, height: 700 } };
    for (const stand of ['overleven', 'bouwen']) {
      const b = await open({ bestand: BESTAND, q: `test=1&zaad=777&stand=${stand}&tijd=0.45&straal=2&x=51&z=-41`, ctx });
      const { page } = b;
      await wachtKlaar(page); await page.waitForTimeout(1200); await page.evaluate(z => { window.__rommelblok.tekenUit = true; if (z) document.getElementById('rb-doek').style.visibility = 'hidden'; }, ZONDER);
      const foto = async n => { await page.waitForTimeout(300); await page.screenshot({ path: `${UIT}/${VOOR}_${soort}_${n}.png` }); };
      const doe = f => page.evaluate(f);
      if (stand === 'overleven') {
        await doe(() => { const R = window.__rommelblok; for (const [k, n] of [['stam_eik', 23], ['kei', 64], ['kolen', 18], ['ijzerstaaf', 7], ['robijn', 2], ['zand', 30], ['appel', 5], ['stok', 16], ['kaart', 1], ['houweel_robijn', 1], ['fakkel', 24], ['planken_eik', 40], ['brood', 6], ['emmer', 1]]) R.geef(k, n); const s = R.WD.inv.find(x => x && x.id === R.G.I.houweel_robijn); if (s) s.dur = 1480; });
        await doe(() => window.__rommelblok.openRugzak()); await foto('rugzak');
        if (!tel) { const v = await page.locator('[data-plek="inv:9"]').boundingBox(); await page.mouse.move(v.x + 24, v.y + 24); await foto('tip'); await page.mouse.move(5, 5); }
        else { await page.tap('[data-plek="inv:9"]'); await foto('gekozen'); await page.tap('#rb-rz-tabs [data-deel="maken"]'); await foto('maken'); }
        await page.click('#rb-rz-tabs [data-deel="recepten"]'); await page.waitForTimeout(150);
        await page.click('#rb-receptlijst .rb-recept.kan'); await foto('recepten');
        await page.click('#rb-rugzak [data-sluit]');
        await doe(() => window.__rommelblok.openRugzak('werkbank')); await foto('werkbank'); await page.click('#rb-rugzak [data-sluit]');
        await doe(() => { const R = window.__rommelblok, sp = R.sp, X = Math.floor(sp.x), Y = Math.floor(sp.y), Z = Math.floor(sp.z); R.WD.dingen[X + ',' + Y + ',' + Z] = { soort: 'kist', inhoud: [{ id: R.G.I.appel, n: 12 }, null, { id: R.G.I.ijzerstaaf, n: 3 }].concat(new Array(24).fill(null)) }; R.openBlok('kist', { x: X, y: Y, z: Z, v: R.G.B.kist }); }); await foto('kist'); await page.click('#rb-rugzak [data-sluit]');
        await doe(() => { const R = window.__rommelblok, sp = R.sp, X = Math.floor(sp.x) + 1, Y = Math.floor(sp.y), Z = Math.floor(sp.z); R.WD.dingen[X + ',' + Y + ',' + Z] = { soort: 'oven', in: { id: R.G.I.koperbrok || R.G.I.ijzerbrok, n: 4 }, brand: { id: R.G.I.kolen, n: 2 }, uit: { id: R.G.I.ijzerstaaf, n: 3 }, brandTijd: 40, brandMax: 80, kook: 4 }; R.openBlok('oven', { x: X, y: Y, z: Z }); R.ovenTik(0.01); }); await foto('oven'); await page.click('#rb-rugzak [data-sluit]');
        await doe(() => { const R = window.__rommelblok, sp = R.sp; R.openBlok('smidse', { x: Math.floor(sp.x) + 2, y: Math.floor(sp.y), z: Math.floor(sp.z) }); }); await foto('smidse'); await page.click('#rb-rugzak [data-sluit]');
        await doe(() => { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' })); }); await foto('menu');
        await page.click('#rb-menu-inst'); await foto('inst'); await page.click('#rb-inst [data-sluit]');
        await page.click('#rb-menu-logboek'); await foto('logboek'); await page.click('#rb-logboek [data-sluit]');
        await page.click('#rb-menu-kaart').catch(() => {}); await page.waitForTimeout(400); await foto('kaart');
        await doe(() => { while (document.querySelector('.rb-scherm:not([hidden])')) { const s = document.querySelector('.rb-scherm:not([hidden]) [data-sluit]'); if (!s) break; s.click(); } });
        await doe(() => window.__rommelblok.flauwvallen('water')); await foto('dood');
      } else {
        await doe(() => window.__rommelblok.openRugzak()); await foto('bouwmenu');
        await page.fill('#rb-bm-zoek', 'glas'); await foto('bouwzoek');
      }
      fouten.push(...b.fouten.map(f => soort + ' ' + stand + ': ' + f)); await b.sluit();
    }
  }
  console.log(fouten.join('\n') || 'geen fouten');
  process.exit(fouten.length ? 1 : 0);
})();

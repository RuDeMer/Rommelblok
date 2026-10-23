const UIT = require('./uit');
const { open, wachtKlaar } = require('./pw');
(async () => {
  const fotos = [];
  for (const stand of ['overleven', 'bouwen']) {
    const { page, fouten, sluit } = await open({ q: `test=1&zaad=777&stand=${stand}&tijd=0.45&straal=3&x=51&z=-41`, ctx: { viewport: { width: 1000, height: 640 } } });
    await wachtKlaar(page); await page.waitForTimeout(1500); await page.evaluate(() => { window.__rommelblok.tekenUit = true; });
    const foto = async n => { await page.waitForTimeout(250); await page.screenshot({ path: UIT + '/s_' + n + '.png' }); fotos.push(n); };
    if (stand === 'overleven') {
      await page.evaluate(() => { const R = window.__rommelblok; R.geef('kolen', 5); R.geef('koperbrok', 7); }); 
      await page.evaluate(() => { const R = window.__rommelblok; window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' })); }); await foto('menu');
      await page.click('#rb-menu-inst'); await foto('inst');
      await page.click('#rb-inst [data-sluit]'); await page.click('#rb-menu-hulp'); await foto('hulp');
      await page.click('#rb-hulp [data-sluit]'); await page.click('#rb-menu [data-sluit]');
      await page.evaluate(() => { const R = window.__rommelblok, sp = R.sp, k = Math.floor(sp.x) + ',' + Math.floor(sp.y) + ',' + Math.floor(sp.z); R.WD.dingen[k] = { soort: 'oven', in: { id: R.G.I.koperbrok, n: 4 }, brand: { id: R.G.I.kolen, n: 2 }, uit: { id: R.G.I.koperstaaf, n: 3 }, brandTijd: 40, brandMax: 80, kook: 4 }; R.openBlok('oven', { x: Math.floor(sp.x), y: Math.floor(sp.y), z: Math.floor(sp.z) }); });
      await page.evaluate(() => window.__rommelblok.ovenTik(0.01)); await foto('oven');
      await page.click('#rb-rugzak [data-sluit]');
      await page.evaluate(() => window.__rommelblok.flauwvallen('water')); await foto('dood');
    } else {
      await page.evaluate(() => window.__rommelblok.openRugzak()); await foto('palet');
    }
    console.log(stand, fouten.join(' ') || 'geen fouten'); await sluit();
  }
  const { execSync } = require('child_process');
  execSync(`python3 -c "
from PIL import Image
n=${JSON.stringify(fotos).replace(/"/g, "'")}
ims=[Image.open('s_%s.png'%x).resize((500,320)) for x in n]
out=Image.new('RGB',(1000,320*((len(ims)+1)//2)))
for i,im in enumerate(ims): out.paste(im,((i%2)*500,(i//2)*320))
out.save('s_samen.png')"`, { cwd: UIT });
})();

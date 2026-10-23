const UIT = require('./uit');
// schermafbeeldingen van de arm in verschillende houdingen (computer en telefoon)
const { open, wachtKlaar } = require('./pw');
const { execSync } = require('child_process');
(async () => {
  const fotos = [];
  for (const [naam, ctx] of [['pc', { viewport: { width: 800, height: 500 } }], ['tel', { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 }]]) {
    if (process.argv.includes('pc') && naam === 'tel') continue;
    const { page, fouten, sluit } = await open({ q: 'test=1&zaad=777&stand=bouwen&tijd=0.45&straal=2&x=60&z=-40', ctx });
    await wachtKlaar(page); await page.waitForTimeout(1500);
    const houdingen = naam === 'pc' ? [['leeg', 0, {}], ['blok', 2, {}], ['houweel', 'houweel_ijzer', {}], ['hak', 'houweel_ijzer', { zwaai: 0.45, soort: 'hak' }], ['bouw', 2, { zwaai: 0.3, soort: 'bouw' }], ['stomp', 0, { zwaai: 0.3, soort: 'bouw' }], ['fakkel', 'fakkel', {}], ['appel', 'appel', {}], ['eten', 'appel', { eet: 0.6 }], ['zwaard', 'zwaard_ijzer', {}], ['kompas', 'kompas', {}], ['ren', 'houweel_ijzer', { ren: 1, schommel: 0.9, fase: 1.2 }]] : [['leeg', 0, {}], ['blok', 2, {}], ['houweel', 'houweel_ijzer', {}], ['hak', 'houweel_ijzer', { zwaai: 0.45, soort: 'hak' }], ['fakkel', 'fakkel', {}], ['appel', 'appel', {}]];
    const alleen = (process.argv.find(a => a.startsWith('alleen=')) || '').slice(7).split(',').filter(Boolean);
    for (const [h, wat, extra] of houdingen) {
      if (alleen.length && !alleen.includes(h)) continue;
      await page.evaluate(([wat, extra]) => {
        const R = window.__rommelblok; R.kijk(0.6, -0.15);
        const G = R.G, id = typeof wat === 'string' ? (G.I[wat] !== undefined ? G.I[wat] : G.B[wat]) : wat;
        R.WD.inv[0] = id ? { id, n: 1 } : null; R.kies(0); R.handProef = Object.assign({ wissel: 0, zwaai: 0 }, extra);
      }, [wat, extra]);
      await page.waitForTimeout(naam === 'pc' ? 1800 : 1500);
      const f = `arm_${naam}_${h}.png`; await page.screenshot({ path: UIT + '/' + f }); fotos.push(f);
    }
    console.log(naam, fouten.join(' ') || 'geen fouten'); await sluit();
  }
  try {
    execSync(`python3 -c "
from PIL import Image
pc=[f for f in ${JSON.stringify(fotos).replace(/"/g, "'")} if '_pc_' in f]; tel=[f for f in ${JSON.stringify(fotos).replace(/"/g, "'")} if '_tel_' in f]
ims=[Image.open(f).resize((400,250)) for f in pc]
out=Image.new('RGB',(800,250*((len(ims)+1)//2)))
for i,im in enumerate(ims): out.paste(im,((i%2)*400,(i//2)*250))
out.save('arm_pc.png')
ims=[Image.open(f).resize((180,370)) for f in tel]
out=Image.new('RGB',(180*len(ims),370))
for i,im in enumerate(ims): out.paste(im,(i*180,0))
out.save('arm_tel.png')"`, { cwd: UIT });
  } catch (e) { console.log('samenvoegen van de beelden lukte niet (PIL?)'); }
})();

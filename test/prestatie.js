// Prestaties: tijd per beeldje op de processor, laden van de wereld, en hoeveel er getekend wordt.
const { open } = require('./pw');
const wacht = ms => new Promise(ok => setTimeout(ok, ms));
(async () => {
  for (const [naam, ctx, rem] of [
    ['computer (1280x720)', { viewport: { width: 1280, height: 720 } }, 1],
    ['telefoon (390x844, processor 4x vertraagd)', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 }, 4],
  ]) {
    const { page, fouten, sluit } = await open({ q: 'test=1&zaad=12345&stand=overleven&tijd=0.45', ctx });
    const cdp = await page.context().newCDPSession(page);
    if (rem > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: rem });
    const t0 = Date.now();
    await page.waitForFunction(() => window.__rommelblok && window.__rommelblok.klaar, null, { timeout: 120000 });
    const klaarNa = Date.now() - t0;
    // laten laden tot de kijkafstand vol is
    const info0 = await page.evaluate(() => ({ straal: window.__rommelblok.straal, kwaliteit: window.__rommelblok.inst.kwaliteit }));
    let rij = [];
    for (let i = 0; i < 40; i++) { await wacht(1000); const n = await page.evaluate(() => window.__rommelblok.R.stukken.size); rij.push(n); if (i > 3 && rij[i] === rij[i - 3]) break; }
    // tijd per beeldje op de processor (zonder te wachten op de grafische kaart): de lus zelf, 120 keer
    const m = await page.evaluate(async () => {
      const R = window.__rommelblok, tijden = [];
      // lopen tijdens het meten, zodat er ook nieuwe stukken bij komen
      for (let i = 0; i < 120; i++) { const t = performance.now(); R.sim(1, 1 / 60, { voor: 1 }); R.R.teken({ x: R.sp.x, y: R.sp.y + 1.62, z: R.sp.z, yaw: R.sp.yaw, pitch: -0.1, fov: 1.3, schaal: 1 }, window.__laatsteL || { zenit: [0.3, 0.5, 0.9], horizon: [0.7, 0.8, 1], zonRicht: [0.3, 0.9, 0.3], maanRicht: [-0.3, -0.9, -0.3], zonGloed: [0.2, 0.2, 0.2], zonKleur: [1, 1, 1], fakKleur: [1, 0.8, 0.5], mistKleur: [0.1, 0.2, 0.3], mist: [80, 140], min: 0.03, flakker: 1, onderWater: false, sterren: 0, maanFase: 0, tijdSec: i / 60, wind: 1, wolkDek: 0.5, wolkKleur: [1, 1, 1], wolkSchaduw: [0.6, 0.6, 0.7], dag: 1 }, null); tijden.push(performance.now() - t); await new Promise(ok => setTimeout(ok, 5)); }
      tijden.sort((a, b) => a - b);
      return { mediaan: tijden[60].toFixed(2), p95: tijden[114].toFixed(2), max: tijden[119].toFixed(2), stats: R.R.stats, gpuMB: R.R.gpuMB.toFixed(1), stukken: R.R.stukken.size, straal: R.straal, frameMsLus: R.frameMs.toFixed(2) };
    });
    console.log(`\n${naam}\n  kwaliteit ${info0.kwaliteit}, kijkafstand ${info0.straal}, eerste grond na ${(klaarNa / 1000).toFixed(1)} s\n  stukken met vormen per seconde: ${rij.join(' ')}\n  processortijd per beeldje (lopen, tekenen): mediaan ${m.mediaan} ms, 95% ${m.p95} ms, max ${m.max} ms\n  per beeld: ${m.stats.stukken} stukken, ${m.stats.draws} tekenopdrachten, ${(m.stats.vlakken / 1000).toFixed(0)}k vlakken (${(m.stats.vlakken * 2 / 1000).toFixed(0)}k driehoeken), ${m.gpuMB} MB op de grafische kaart`);
    console.log('  ' + (fouten.join(' ') || 'geen fouten'));
    await sluit();
  }
})();

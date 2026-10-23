const UIT = require('./uit');
const { open } = require('./pw');
(async () => {
  for (const [naam, ctx] of [['begin_pc', { viewport: { width: 1280, height: 800 } }], ['begin_tel', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]]) {
    const { page, fouten, sluit } = await open({ ctx });
    await page.evaluate(() => localStorage.setItem('rommelblok-v2', '{"oud":1}')); await page.reload();
    await page.waitForTimeout(2500);
    // een wereld maken zodat de lijst iets toont
    await page.click('#rb-nieuw'); await page.waitForTimeout(200);
    await page.screenshot({ path: UIT + '/' + naam + '_maak.png' });
    await page.click('[data-sluit]:visible').catch(() => {});
    await page.evaluate(async () => { const R = window.__rommelblok; const w = R.nieuweWereldGegevens('Zolderland', 'vlaai', 'overleven'); w.speeltijd = 3900; await (async () => { const q = indexedDB.open('rommelblok', 1); await new Promise(ok => q.onsuccess = ok); const tx = q.result.transaction('werelden', 'readwrite'); tx.objectStore('werelden').put(w); await new Promise(ok => tx.oncomplete = ok); })(); });
    await page.reload(); await page.waitForTimeout(2500);
    await page.screenshot({ path: UIT + '/' + naam + '.png', fullPage: false });
    console.log(naam, fouten.join(' ') || 'geen fouten'); await sluit();
  }
})();

const UIT = require('./uit');
const { open } = require('./pw');
const fs = require('fs'), path = require('path');
const wacht = ms => new Promise(ok => setTimeout(ok, ms));
(async () => {
  const { page, fouten, sluit } = await open({ ctx: { viewport: { width: 1000, height: 650 } } });
  await page.waitForTimeout(1500);
  const uit = {};
  // nieuwe wereld via het beginscherm
  await page.click('#rb-nieuw'); await page.fill('#rb-maak-naam', 'Testland'); await page.fill('#rb-maak-zaad', 'kroket7');
  await page.click('.rb-stand[data-stand="overleven"]'); await page.click('#rb-maak-vorm button[type=submit]');
  await page.waitForFunction(() => window.__rommelblok.klaar, null, { timeout: 60000 });
  await page.evaluate(() => { window.__rommelblok.tekenUit = true; window.__rommelblok.straal = 3; });
  await wacht(1500);
  const veranderd = await page.evaluate(async () => {
    const R = window.__rommelblok, sp = R.sp, X = Math.floor(sp.x), Z = Math.floor(sp.z);
    // een torentje van 5 planken naast de speler en een gat
    let y = Math.floor(sp.y); const a = [];
    for (let h = 0; h < 5; h++) a.push(X + 3, y + h, Z, R.G.B.planken_eik);
    a.push(X - 2, y - 1, Z, 0);
    R.wbWorker.postMessage({ t: 'zet', a });
    R.geef('appel', 7); R.geef('houweel_steen', 1);
    await new Promise(ok => setTimeout(ok, 500));
    return { toren: [X + 3, y, Z], gat: [X - 2, y - 1, Z], pos: [sp.x, sp.y, sp.z], id: R.WD.id };
  });
  // naar het beginscherm (bewaart)
  await page.evaluate(() => window.__rommelblok.naarWerelden()); await wacht(1500);
  uit.lijst = await page.$$eval('#rb-werelden .rb-wereld h3', e => e.map(x => x.textContent));
  // opnieuw laden van de hele pagina, en de wereld weer openen
  await page.reload(); await wacht(1500);
  await page.click('#rb-werelden .rb-wereld [data-doe=speel]');
  await page.waitForFunction(() => window.__rommelblok.klaar, null, { timeout: 60000 });
  await page.evaluate(() => { window.__rommelblok.tekenUit = true; }); await wacht(1500);
  uit.terug = await page.evaluate(async v => {
    const R = window.__rommelblok, lees = async (p) => (await R.wb({ t: 'lees', a: p })).a[0];
    return { toren: [0, 1, 2, 3, 4].map(h => R.blokOp(v.toren[0], v.toren[1] + h, v.toren[2]) & 255), gat: await lees(v.gat), appels: R.WD.inv.filter(s => s && s.id === R.G.I.appel).reduce((a, s) => a + s.n, 0), houweel: R.WD.inv.some(s => s && s.id === R.G.I.houweel_steen), pos: [R.sp.x, R.sp.y, R.sp.z].map(x => +x.toFixed(1)), naam: R.WD.naam, zaad: R.WD.zaadTekst };
  }, veranderd);
  uit.planken = await page.evaluate(() => window.__rommelblok.G.B.planken_eik);
  // exporteren en importeren
  await page.evaluate(() => window.__rommelblok.naarWerelden()); await wacht(1200);
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#rb-werelden .rb-wereld [data-doe=export]')]);
  const pad = path.join(UIT, 'export_test.rommelblok'); await download.saveAs(pad);
  uit.export = { naam: download.suggestedFilename(), kB: Math.round(fs.statSync(pad).size / 1024) };
  const bestand = JSON.parse(fs.readFileSync(pad, 'utf8')); uit.exportStukken = bestand.stukken.length;
  await page.setInputFiles('#rb-bestand', pad); await wacht(1500);
  uit.naImport = await page.$$eval('#rb-werelden .rb-wereld h3', e => e.map(x => x.textContent));
  // een kapot bestand wordt geweigerd
  fs.writeFileSync(pad + '.kapot', JSON.stringify(Object.assign({}, bestand, { wereld: Object.assign({}, bestand.wereld, { stand: 'vals' }) })));
  await page.setInputFiles('#rb-bestand', pad + '.kapot'); await wacht(800);
  uit.kapotMelding = await page.$eval('#rb-melding', e => e.textContent);
  uit.localStorage = await page.evaluate(() => ({ v3: localStorage.getItem('rommelblok-v3'), grootte: (localStorage.getItem('rommelblok-v3') || '').length }));
  console.log(JSON.stringify(uit, null, 1)); console.log(fouten.join('\n') || 'geen fouten'); await sluit();
})();

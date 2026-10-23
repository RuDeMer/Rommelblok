const UIT = require('./uit');
// kaart, kompas, logboek: kaartjes komen binnen en worden bewaard, kleine en grote kaart, markering, kompas, bouwwerk vinden, logboek
const { open } = require('./pw');
const wacht = ms => new Promise(ok => setTimeout(ok, ms));
(async () => {
  const breed = process.argv[2] === 'telefoon';
  const { page, fouten, sluit } = await open({ ctx: breed ? { viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1000, height: 650 } } });
  await wacht(1500);
  const uit = {}, mis = [];
  // een echte wereld (die wordt bewaard), via het beginscherm
  await page.click('#rb-nieuw'); await page.fill('#rb-maak-naam', 'Kaartland'); await page.fill('#rb-maak-zaad', '4242');
  await page.click('.rb-stand[data-stand="overleven"]'); await page.click('#rb-maak-vorm button[type=submit]');
  await page.waitForFunction(() => window.__rommelblok.klaar, null, { timeout: 90000 });
  await page.evaluate(() => { window.__rommelblok.straal = 3; window.__rommelblok.valVrij = 600; });
  await page.waitForFunction(() => window.__rommelblok.KAART.size >= 20, null, { timeout: 60000 }).catch(() => {});
  uit.tegels = await page.evaluate(() => window.__rommelblok.KAART.size);
  // de kleine kaart: alleen met een kaart in je hand
  uit.mini = await page.evaluate(async () => {
    const R = window.__rommelblok; R.geef('kaart', 1); R.geef('kompas', 1);
    const j = R.WD.inv.findIndex(s => s && s.id === R.G.I.kaart); R.kies(j); await new Promise(ok => setTimeout(ok, 700));
    const c = document.getElementById('rb-minikaart'), g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height).data; const kleuren = new Set();
    for (let i = 0; i < d.length; i += 64) kleuren.add(d[i] >> 4 << 8 | d[i + 1] >> 4 << 4 | d[i + 2] >> 4);
    return { zichtbaar: !c.hidden && c.offsetWidth > 50, kleuren: kleuren.size };
  });
  // het logboek: kaart en kompas in de rugzak geven al een mijlpaal
  await wacht(800);
  uit.logboek = await page.evaluate(() => Object.keys(window.__rommelblok.WD.logboek || {}));
  // de grote kaart met M (op een telefoon via het menu)
  if (breed) { await page.keyboard.press('Escape'); await wacht(300); await page.click('#rb-menu-kaart'); }
  else { await page.keyboard.press('KeyM'); }
  await wacht(600);
  uit.groot = await page.evaluate(() => { const c = document.getElementById('rb-kaart-doek'), r = c.getBoundingClientRect(); return { open: !document.getElementById('rb-kaart').hidden, w: Math.round(r.width), h: Math.round(r.height), past: document.documentElement.scrollWidth <= innerWidth }; });
  await page.screenshot({ path: UIT + '/' + (breed ? 'kaart_telefoon.png' : 'kaart_groot.png') });
  // markering hier, met een naam
  await page.click('#rb-kaart-hier'); await wacht(300);
  await page.fill('#rb-vraag input', 'Mijn huisje'); await page.click('#rb-vraag .rb-knop.rood'); await wacht(400);
  uit.markering = await page.evaluate(() => { const W = window.__rommelblok.WD; return { n: W.markers.length, naam: W.markers[0] && W.markers[0].naam, doel: W.kompasDoel, kaartOpen: !document.getElementById('rb-kaart').hidden }; });
  // tikken op de kaart: de markering kiezen
  const box = await page.$eval('#rb-kaart-doek', c => { const r = c.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await page.mouse.click(box[0], box[1] - 4); await wacht(300);
  uit.info = await page.$eval('#rb-kaart-info', e => e.textContent);
  await page.screenshot({ path: UIT + '/' + (breed ? 'kaart_telefoon2.png' : 'kaart_groot2.png') });
  await page.keyboard.press('Escape'); await wacht(300);
  if (await page.evaluate(() => !document.getElementById('rb-menu').hidden)) { await page.keyboard.press('Escape'); await wacht(300); }
  // het kompas: wijst naar de markering, met de afstand
  uit.kompas = await page.evaluate(async () => {
    const R = window.__rommelblok; const j = R.WD.inv.findIndex(s => s && s.id === R.G.I.kompas); R.kies(j);
    R.zet(R.sp.x + 30, R.sp.y + 8, R.sp.z); R.sp.vliegt = true; await new Promise(ok => setTimeout(ok, 700));
    return document.getElementById('rb-wijzer').hidden ? null : document.getElementById('rb-wijzer-tekst').textContent;
  });
  // een bouwwerk vinden: de dichtstbijzijnde die de wereldbaas meldt
  await page.waitForFunction(() => window.__rommelblok.BOUWW.size > 0, null, { timeout: 30000 }).catch(() => {});
  uit.bouwwerk = await page.evaluate(async () => {
    const R = window.__rommelblok, lijst = [...R.BOUWW.values()].filter(b => b[0] !== 'mijn').sort((a, b) => Math.hypot(a[1] - R.sp.x, a[3] - R.sp.z) - Math.hypot(b[1] - R.sp.x, b[3] - R.sp.z));
    const b = lijst[0]; if (!b) return null;
    R.zet(b[1] + 0.5, b[2] + 2, b[3] + 0.5);
    for (let i = 0; i < 40 && !(R.WD.gevonden || []).length; i++) await new Promise(ok => setTimeout(ok, 250));
    return { soort: b[0], gevonden: (R.WD.gevonden || []).map(g => g[0]), logboek: !!(R.WD.logboek || {})[b[0]] };
  });
  // het logboekscherm
  await page.evaluate(() => window.__rommelblok.openLogboek()); await wacht(300);
  uit.scherm = await page.evaluate(() => ({ mijlpalen: document.querySelectorAll('#rb-logboek-lijst li').length, verwacht: window.__rommelblok.LOGBOEK.length, gehaald: document.querySelectorAll('#rb-logboek-lijst li.gehaald').length, rang: document.querySelector('.rb-rang-naam').textContent, past: document.documentElement.scrollWidth <= innerWidth }));
  await page.screenshot({ path: UIT + '/' + (breed ? 'logboek_telefoon.png' : 'logboek.png') });
  await page.keyboard.press('Escape'); await wacht(200);
  // bewaren, terug naar de werelden, en de kaartjes weer inlezen
  uit.bewaard = await page.evaluate(async () => {
    const R = window.__rommelblok, id = R.WD.id, n = R.KAART.size;
    await R.naarWerelden(); const leeg = R.KAART.size;
    return { n, leeg, id };
  });
  await page.reload(); await wacht(1500);
  await page.click('#rb-werelden .rb-wereld [data-doe=speel]');
  await page.waitForFunction(() => window.__rommelblok.klaar, null, { timeout: 90000 });
  uit.terug = await page.evaluate(async () => { const R = window.__rommelblok; await new Promise(ok => setTimeout(ok, 500)); return { tegels: R.KAART.size, markers: R.WD.markers.length, gevonden: R.WD.gevonden.length, logboek: Object.keys(R.WD.logboek || {}).length }; });
  console.log(JSON.stringify(uit, null, 1));
  if (uit.tegels < 20) mis.push('kaartjes');
  if (!uit.mini.zichtbaar || uit.mini.kleuren < 4) mis.push('kleine kaart');
  if (!uit.logboek.includes('kaart')) mis.push('logboek kaart');
  if (!uit.groot.open || uit.groot.w < 200 || uit.groot.h < 150 || !uit.groot.past) mis.push('grote kaart');
  if (uit.markering.n !== 1 || uit.markering.naam !== 'Mijn huisje' || uit.markering.doel !== 0) mis.push('markering');
  if (!uit.info.includes('Mijn huisje')) mis.push('markering kiezen');
  if (!uit.kompas || !uit.kompas.includes('Mijn huisje') || !/\d+ m/.test(uit.kompas)) mis.push('kompas');
  if (!uit.bouwwerk || !uit.bouwwerk.gevonden.length || !uit.bouwwerk.logboek) mis.push('bouwwerk vinden');
  if (uit.scherm.mijlpalen !== uit.scherm.verwacht || uit.scherm.verwacht < 38 || !uit.scherm.past) mis.push('logboekscherm');
  if (uit.terug.tegels < uit.bewaard.n * 0.9 || uit.terug.markers !== 1 || !uit.terug.gevonden || !uit.terug.logboek) mis.push('bewaren');
  console.log(mis.length ? 'MIS: ' + mis.join(', ') : 'kaart, kompas en logboek: alles goed');
  console.log(fouten.join(' ') || 'geen fouten'); await sluit();
  process.exit(mis.length || fouten.length ? 1 : 0);
})();

// Samen spelen zonder spelserver: een nette melding, en alleen spelen werkt daarna gewoon.
//   node test/samen_zonder.js
const { open } = require('./pw');
let fouten = 0; const goed = (b, t) => { console.log((b ? 'goed ' : 'FOUT ') + t); if (!b) fouten++; };
(async () => {
  // de pagina met ?samen=lokaal, maar op een adres waar geen spelserver luistert
  const { page, fouten: f, sluit } = await open({ q: 'samen=lokaal' });
  await page.waitForFunction(() => window.__rommelblok && !document.getElementById('rb-begin').hidden, null, { timeout: 60000 });
  await page.click('#rb-samen-knop');
  await page.fill('#rb-samen-code', 'blauwe-lantaarn-egel-42');
  await page.click('#rb-samen-mee button[type=submit]');
  const melding = await page.waitForFunction(() => { const e = document.getElementById('rb-samen-fout'); return !e.hidden && e.textContent; }, null, { timeout: 20000, polling: 100 }).then(h => h.jsonValue(), () => null);
  goed(/Geen verbinding/.test(melding || ''), 'geen spelserver: "' + melding + '"');
  goed(await page.evaluate(() => !window.__rommelblok.samen && !document.body.classList.contains('rb-samen')), 'er is geen gedeelde wereld open');
  // gewoon alleen spelen
  await page.click('#rb-samen .rb-sluit');
  await page.click('#rb-nieuw');
  goed(await page.evaluate(() => !document.getElementById('rb-maak-naam-rij').hidden), 'een eigen wereld heeft weer een naam');
  await page.fill('#rb-maak-zaad', '777');
  await page.click('#rb-maak-vorm button[type=submit]');
  await page.waitForFunction(() => window.__rommelblok.klaar, null, { timeout: 60000, polling: 100 });
  const r = await page.evaluate(() => { const R = window.__rommelblok; return { samen: !!R.WD.samen, id: R.WD.id, wid: !/^samen:/.test(R.WD.id) }; });
  goed(!r.samen && r.wid, 'alleen spelen werkt gewoon (' + r.id + ')');
  // de knop bestaat niet zonder ?samen=lokaal en zonder adres in de pagina (zoals op de site tot stap 7)
  await page.goto(page.url().split('?')[0]);
  await page.waitForFunction(() => window.__rommelblok, null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  goed(await page.evaluate(() => document.getElementById('rb-samen-knop').hidden), 'zonder spelserver staat de knop Samen spelen er niet');
  const echt = f.filter(x => !/WebSocket connection to .* failed/.test(x));
  goed(!echt.length, 'geen andere fouten in de console' + (echt.length ? ': ' + echt.join(' | ') : ''));
  await sluit();
  process.exit(fouten ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

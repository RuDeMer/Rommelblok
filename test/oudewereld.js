const UIT = require('./uit');
// een wereld die met de vorige versie (zoals hij op GitHub staat) is gemaakt, werkt in de nieuwe versie
const { open } = require('./pw');
const fs = require('fs'), path = require('path');
const wacht = ms => new Promise(ok => setTimeout(ok, ms));
// de vorige versie: het pad in RB_VORIGE of als eerste argument (bijvoorbeeld de rommelblok.html die nu op GitHub staat)
const VORIGE = process.argv[2] || process.env.RB_VORIGE;
if (!VORIGE || !fs.existsSync(VORIGE)) { console.log('geen vorige versie opgegeven (RB_VORIGE of een argument): overgeslagen'); process.exit(0); }
(async () => {
  fs.copyFileSync(VORIGE, path.join(UIT, 'vorige.html'));
  const { page, fouten, sluit, url } = await open({ bestand: 'vorige.html', ctx: { viewport: { width: 1000, height: 650 } } });
  await wacht(1500);
  // 1. met de vorige versie: een wereld maken en wat veranderen
  await page.click('#rb-nieuw'); await page.fill('#rb-maak-naam', 'Oudland'); await page.fill('#rb-maak-zaad', 'kroket7');
  await page.click('.rb-stand[data-stand="overleven"]'); await page.click('#rb-maak-vorm button[type=submit]');
  await page.waitForFunction(() => window.__rommelblok.klaar, null, { timeout: 90000 });
  await page.evaluate(() => { window.__rommelblok.straal = 3; }); await wacht(1500);
  const oud = await page.evaluate(async () => {
    const R = window.__rommelblok, sp = R.sp, X = Math.floor(sp.x), Z = Math.floor(sp.z), y = Math.floor(sp.y), B = R.G.B, I = R.G.I;
    const a = [];
    for (let h = 0; h < 5; h++) a.push(X + 3, y + h, Z, B.planken_eik);
    // blokken die sinds stap 2 anders heten (mergel is kalksteen, vlaai is taart): ze moeten blijven staan, met hetzelfde nummer
    a.push(X + 5, y, Z, B.mergel, X + 6, y, Z, B.mergelblokken, X + 7, y, Z, B.vlaai);
    R.WD.logboek = Object.assign(R.WD.logboek || {}, { vlaai: 1 });
    a.push(X - 2, y - 1, Z, 0, X, y, Z + 3, B.kist);
    R.wbWorker.postMessage({ t: 'zet', a });
    R.WD.dingen[X + ',' + y + ',' + (Z + 3)] = { soort: 'kist', inhoud: [{ id: I.appel, n: 5 }, null, { id: I.ijzerstaaf, n: 2 }].concat(new Array(24).fill(null)) };
    R.geef('appel', 7); R.geef('houweel_steen', 1); R.geef('kompas', 1); R.geef('werkbank', 1);
    await new Promise(ok => setTimeout(ok, 600));
    const info = await R.wb({ t: 'info' });
    // de hoogte van het land rond de speler (om te zien of het landschap hetzelfde blijft)
    const hoogte = []; for (let dz = -20; dz <= 20; dz += 4) for (let dx = -20; dx <= 20; dx += 4) { let y = 120; while (y > 1 && !((R.blokOp(X + dx, y, Z + dz) & 255) && R.G.VAST[R.blokOp(X + dx, y, Z + dz) & 255])) y--; hoogte.push(y); }
    return { hoogte, hernoemd: [[X + 5, y, Z, B.mergel], [X + 6, y, Z, B.mergelblokken], [X + 7, y, Z, B.vlaai]], toren: [X + 3, y, Z], gat: [X - 2, y - 1, Z], kist: [X, y, Z + 3], id: R.WD.id, pos: [sp.x, sp.y, sp.z], versieOud: R.WD.grotten || 1, genOud: R.WD.gen || 2, wacht: info.opslaanWacht };
  });
  await page.evaluate(() => window.__rommelblok.naarWerelden()); await wacht(1500);
  // ook een export van de oude versie (een .rommelblok-bestand), om straks in de nieuwe te importeren
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#rb-werelden .rb-wereld [data-doe=export]')]);
  const exportPad = path.join(UIT, 'oude_export.rommelblok'); await download.saveAs(exportPad);
  oud.sleutels = await page.evaluate(() => new Promise(ok => { const q = indexedDB.open('rommelblok', 1); q.onsuccess = () => { const r = q.result.transaction('stukken').objectStore('stukken').getAllKeys(); r.onsuccess = () => ok(r.result.map(String)); }; }));
  // 2. dezelfde browser, dezelfde site: nu de nieuwe versie
  await page.goto(url.replace('vorige.html', 'rommelblok.html')); await wacht(2000);
  const lijst = await page.$$eval('#rb-werelden .rb-wereld h3', e => e.map(x => x.textContent));
  await page.click('#rb-werelden .rb-wereld [data-doe=speel]');
  await page.waitForFunction(() => window.__rommelblok.klaar, null, { timeout: 90000 });
  await page.evaluate(() => { window.__rommelblok.straal = 3; window.__rommelblok.valVrij = 60; });
  // wachten tot alle stukken rond de plek geladen zijn (niet een vaste tijd: op een drukke computer duurt het langer)
  await page.waitForFunction(v => { const R = window.__rommelblok, X = Math.floor(v.pos[0]), Z = Math.floor(v.pos[2]); for (let dz = -20; dz <= 20; dz += 4) for (let dx = -20; dx <= 20; dx += 4) if (R.blokOp(X + dx, 60, Z + dz) < 0) return false; return true; }, oud, { timeout: 60000 });
  await wacht(1500);
  const nieuw = await page.evaluate(async v => {
    const R = window.__rommelblok, I = R.G.I, lees = async p => (await R.wb({ t: 'lees', a: p })).a[0];
    const kist = R.WD.dingen[v.kist.join(',')];
    return {
      naam: R.WD.naam, toren: [0, 1, 2, 3, 4].map(h => R.blokOp(v.toren[0], v.toren[1] + h, v.toren[2]) & 255), gat: await lees(v.gat), kistBlok: R.blokOp(...v.kist) & 255,
      kist: kist ? kist.inhoud.filter(Boolean).map(s => R.G.IT[s.id].sleutel + ':' + s.n).join(' ') : null,
      appels: R.WD.inv.filter(s => s && s.id === I.appel).reduce((a, s) => a + s.n, 0), afstand: Math.hypot(R.sp.x - v.pos[0], R.sp.z - v.pos[2]),
      grotten: R.WD.grotten, melding: document.getElementById('rb-melding').textContent, tegels: R.KAART.size, logboek: Object.keys(R.WD.logboek || {}),
      gen: R.WD.gen, oudStukken: await new Promise(ok => { const q = indexedDB.open('rommelblok', 1); q.onsuccess = () => { const r = q.result.transaction('stukken').objectStore('stukken').get('oud|' + R.WD.id); r.onsuccess = () => ok(r.result ? r.result.length / 2 : 0); r.onerror = () => ok(-1); }; }),
      hoogteAnders: (() => { const X = Math.floor(v.pos[0]), Z = Math.floor(v.pos[2]); let i = 0, n = 0; for (let dz = -20; dz <= 20; dz += 4) for (let dx = -20; dx <= 20; dx += 4) { let y = 120; while (y > 1 && !((R.blokOp(X + dx, y, Z + dz) & 255) && R.G.VAST[R.blokOp(X + dx, y, Z + dz) & 255])) y--; if (y !== v.hoogte[i]) n++; i++; } return n; })(),
      hernoemd: v.hernoemd.map(([x, y, z, id]) => { const b = R.blokOp(x, y, z) & 255; return { zelfde: b === id, naam: R.G.BL[b] ? R.G.BL[b].nl : '?' }; }),
      logboekTaart: R.WD.logboek && R.WD.logboek.taart === 1 && R.WD.logboek.vlaai === undefined,
      torenWerker: await Promise.all([0, 1, 2, 3, 4].map(h => lees([v.toren[0], v.toren[1] + h, v.toren[2]]))), gatPagina: R.blokOp(...v.gat), sp: [R.sp.x, R.sp.y, R.sp.z].map(Math.round),
    };
  }, oud);
  // 3. bewaren met de nieuwe versie en nog een keer openen
  await page.evaluate(() => window.__rommelblok.naarWerelden()); await wacht(1200);
  await page.click('#rb-werelden .rb-wereld [data-doe=speel]');
  await page.waitForFunction(() => window.__rommelblok.klaar, null, { timeout: 90000 }); await wacht(1000);
  const weer = await page.evaluate(() => ({ grotten: window.__rommelblok.WD.grotten, gen: window.__rommelblok.WD.gen, markers: Array.isArray(window.__rommelblok.WD.markers) }));
  console.log(JSON.stringify({ oud, lijst, nieuw, weer }, null, 1));
  const B = await page.evaluate(() => ({ planken: window.__rommelblok.G.B.planken_eik, kist: window.__rommelblok.G.B.kist }));
  const mis = [];
  if (!lijst.includes('Oudland')) mis.push('wereld niet in de lijst');
  if (nieuw.toren.some(b => b !== B.planken)) mis.push('torentje weg');
  if (nieuw.gat !== 0) mis.push('gat dicht');
  if (nieuw.kistBlok !== B.kist || nieuw.kist !== 'appel:5 ijzerstaaf:2') mis.push('kist');
  if (nieuw.appels !== 7) mis.push('rugzak');
  if (nieuw.afstand > 3) mis.push('plek');
  if (nieuw.grotten !== 2 || weer.grotten !== 2) mis.push('grotten niet bijgewerkt');
  if (!nieuw.tegels) mis.push('kaart');
  if (nieuw.gen !== 3 || weer.gen !== 3) mis.push('wereld niet omgezet naar versie 3');
  if (oud.genOud < 3 && !(nieuw.oudStukken > 0)) mis.push('de oude stukken zijn niet vastgelegd');
  // een wereld van de allereerste versie (zonder grottenstelsels, grotten 1) kreeg in ronde 2 bewust een nieuwe bodem en nieuwe grotten
  if (nieuw.hoogteAnders > 0 && oud.versieOud >= 2) mis.push('het landschap waar je al was is veranderd (' + nieuw.hoogteAnders + ' plekken)');
  if (nieuw.hoogteAnders > 0 && oud.versieOud < 2) console.log('(wereld van de eerste versie: het landschap is sinds ronde 2 vernieuwd, op', nieuw.hoogteAnders, 'meetplekken anders; zo bedoeld)');
  if (!nieuw.logboek.includes('werkbank')) mis.push('logboek');
  if (!nieuw.hernoemd.every(h => h.zelfde) || nieuw.hernoemd.map(h => h.naam).join() !== 'Kalksteen,Kalksteenblokken,Bessentaart') mis.push('mergel en vlaai: ' + JSON.stringify(nieuw.hernoemd));
  if (!nieuw.logboekTaart) mis.push('de mijlpaal van de vlaai is niet overgegaan op de taart');
  await page.evaluate(() => window.__rommelblok.naarWerelden()); await wacht(1200);
  const voor = await page.$$eval('#rb-werelden .rb-wereld', e => e.length);
  await page.setInputFiles('#rb-bestand', exportPad);
  await page.waitForFunction(() => /geïmporteerd|geen geldige/.test(document.getElementById('rb-melding').textContent), null, { timeout: 60000 }).catch(() => {});
  await wacht(500); console.log('melding bij importeren:', await page.$eval('#rb-melding', e => e.textContent));
  const na = await page.$$eval('#rb-werelden .rb-wereld h3', e => e.map(x => x.textContent));
  if (na.length !== voor + 1) mis.push('de export van de oude versie is niet geïmporteerd'); else {
    // de geïmporteerde wereld openen: het torentje en de kist moeten er zijn
    const i = na.length - 1 - [...na].reverse().findIndex(n => n.startsWith('Oudland'));
    await page.evaluate(i => document.querySelectorAll('#rb-werelden .rb-wereld [data-doe=speel]')[i].click(), i);
    await page.waitForFunction(() => window.__rommelblok.klaar, null, { timeout: 90000 }); await page.evaluate(() => { window.__rommelblok.straal = 3; window.__rommelblok.valVrij = 60; });
    await page.waitForFunction(v => { const R = window.__rommelblok; return R.blokOp(v.toren[0], v.toren[1], v.toren[2]) >= 0 && R.blokOp(v.kist[0], v.kist[1], v.kist[2]) >= 0; }, oud, { timeout: 60000 }); await wacht(1000);
    const imp = await page.evaluate(v => { const R = window.__rommelblok, kist = R.WD.dingen[v.kist.join(',')]; return { toren: [0, 1, 2, 3, 4].map(h => R.blokOp(v.toren[0], v.toren[1] + h, v.toren[2]) & 255), kist: kist ? kist.inhoud.filter(Boolean).map(s => R.G.IT[s.id].sleutel + ':' + s.n).join(' ') : null }; }, oud);
    console.log('import van de oude export:', JSON.stringify(imp));
    if (imp.toren.some(b => b !== B.planken) || imp.kist !== 'appel:5 ijzerstaaf:2') mis.push('de geïmporteerde oude wereld is niet compleet');
  }
  fs.unlinkSync(exportPad);
  console.log(mis.length ? 'MIS: ' + mis.join(', ') : 'oude wereld (gemaakt met ' + path.basename(VORIGE) + ', versie ' + oud.genOud + ' van de wereldmaker): alles werkt in de nieuwe versie, ook als export');
  console.log(fouten.join(' ') || 'geen fouten'); await sluit();
  fs.unlinkSync(path.join(UIT, 'vorige.html'));
  process.exit(mis.length || fouten.length ? 1 : 0);
})();

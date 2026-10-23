// de nieuwe bediening van de rugzak: uitlegkaart, slepen om te verdelen, Shift-klik, Q, en op een telefoon kiezen en tikken
const { open, wachtKlaar } = require('./pw');
(async () => {
  const mis = [], alleFouten = [];
  // ---- computer (muis)
  {
    const { page, fouten, sluit } = await open({ q: 'test=1&zaad=777&stand=overleven&straal=2', ctx: { viewport: { width: 1100, height: 700 } } });
    await wachtKlaar(page); await page.waitForTimeout(1000);
    const st = () => page.evaluate(() => { const R = window.__rommelblok; return R.WD.inv.map(s => s ? R.G.IT[s.id].sleutel + ':' + s.n : ''); });
    await page.evaluate(() => { const R = window.__rommelblok; R.WD.inv.fill(null); R.WD.inv[9] = { id: R.G.I.appel, n: 30 }; R.WD.inv[10] = { id: R.G.B.kei, n: 10 }; R.WD.inv[11] = { id: R.G.I.houweel_steen, n: 1, dur: 60 }; R.openRugzak(); });
    await page.waitForTimeout(300);
    const box = async p => { const b = await page.locator(`#rb-rugzak [data-plek="${p}"]`).boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };
    // uitlegkaart bij de muis
    let [x, y] = await box('inv:11'); await page.mouse.move(x, y); await page.waitForTimeout(150);
    const tip = await page.evaluate(() => { const t = document.getElementById('rb-tip'); return t.hidden ? null : t.textContent; });
    if (!tip || !tip.includes('Stenen houweel') || !tip.includes('60 van 132')) mis.push('uitlegkaart: ' + tip);
    // appels oppakken en over vier vakken slepen: eerlijk verdeeld
    [x, y] = await box('inv:9'); await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.up();
    const pl = []; for (const p of ['inv:18', 'inv:19', 'inv:20', 'inv:21']) pl.push(await box(p));
    await page.mouse.move(...pl[0]); await page.mouse.down();
    for (const p of pl.slice(1)) await page.mouse.move(...p, { steps: 4 });
    await page.mouse.up(); await page.waitForTimeout(150);
    let s = await st(); const verdeeld = [18, 19, 20, 21].map(i => s[i]).join(' ');
    if (verdeeld !== 'appel:7 appel:7 appel:7 appel:7') mis.push('verdelen: ' + verdeeld);
    const vast = await page.evaluate(() => window.__rommelblok.RZ.vast && window.__rommelblok.RZ.vast.n);
    if (vast !== 2) mis.push('rest in de hand: ' + vast);
    // de rest neerleggen, dan Shift-klik: van de rugzak naar de snelbalk
    [x, y] = await box('inv:22'); await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.up();
    [x, y] = await box('inv:10'); await page.keyboard.down('Shift'); await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.up(); await page.keyboard.up('Shift');
    s = await st(); if (s[0] !== 'kei:10' || s[10]) mis.push('Shift-klik: ' + s[0] + ' / ' + s[10]);
    // Q boven een vak: één weggooien
    [x, y] = await box('inv:22'); await page.mouse.move(x, y); await page.keyboard.press('KeyQ'); await page.waitForTimeout(100);
    s = await st(); if (s[22] !== 'appel:1') mis.push('Q: ' + s[22]);
    const los = await page.evaluate(() => window.__rommelblok.losse.filter(d => !d.rugzak).length);
    if (los < 1) mis.push('Q: niets gevallen');
    console.log('computer:', JSON.stringify({ tip: !!tip, verdeeld, s0: s[0], q: s[22] }));
    alleFouten.push(...fouten); await sluit();
  }
  // ---- telefoon (aanraken)
  {
    const { page, fouten, sluit } = await open({ q: 'test=1&zaad=777&stand=overleven&straal=2', ctx: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } });
    await wachtKlaar(page); await page.waitForTimeout(1000);
    const st = () => page.evaluate(() => { const R = window.__rommelblok; return R.WD.inv.map(s => s ? R.G.IT[s.id].sleutel + ':' + s.n : ''); });
    await page.evaluate(() => { const R = window.__rommelblok; R.WD.inv.fill(null); R.WD.inv[9] = { id: R.G.I.appel, n: 30 }; R.WD.inv[10] = { id: R.G.B.kei, n: 10 }; R.openRugzak(); });
    await page.waitForTimeout(300);
    // kiezen: de kaart laat het zien
    await page.tap('[data-plek="inv:9"]'); await page.waitForTimeout(100);
    const kaart = await page.evaluate(() => document.getElementById('rb-rz-kaart').textContent);
    if (!kaart.includes('Appel') || !kaart.includes('Halveer')) mis.push('kaart: ' + kaart.slice(0, 80));
    // tikken op een ander vak: verplaatsen
    await page.tap('[data-plek="inv:15"]'); await page.waitForTimeout(100);
    let s = await st(); if (s[15] !== 'appel:30' || s[9]) mis.push('kiezen en tikken: ' + s[9] + ' / ' + s[15]);
    // halveren met de knop
    await page.tap('[data-plek="inv:15"]'); await page.waitForTimeout(100);
    await page.getByRole('button', { name: 'Halveer' }).tap(); await page.waitForTimeout(100);
    s = await st(); const appels = s.filter(x => x.startsWith('appel')).join(' ');
    if (appels !== 'appel:15 appel:15') mis.push('halveren: ' + appels);
    // naar de snelbalk met de knop
    await page.tap('[data-plek="inv:10"]'); await page.waitForTimeout(100);
    await page.getByRole('button', { name: 'Naar snelbalk' }).tap(); await page.waitForTimeout(100);
    s = await st(); if (!s.slice(0, 9).includes('kei:10')) mis.push('naar snelbalk');
    // tabbladen
    await page.tap('#rb-rz-tabs [data-deel="maken"]'); await page.waitForTimeout(100);
    const tab = await page.evaluate(() => document.getElementById('rb-rugzak-paneel').dataset.tab);
    if (tab !== 'maken') mis.push('tabblad maken');
    // past op het scherm (geen horizontaal schuiven)
    const breed = await page.evaluate(() => { const p = document.getElementById('rb-rugzak-paneel'); return [p.scrollWidth, p.clientWidth, document.documentElement.scrollWidth, innerWidth]; });
    if (breed[0] > breed[1] + 1 || breed[2] > breed[3]) mis.push('te breed: ' + breed);
    console.log('telefoon:', JSON.stringify({ appels, tab, breed }));
    alleFouten.push(...fouten); await sluit();
  }
  console.log(mis.length ? 'MIS: ' + mis.join(' | ') : 'rugzak: alles goed');
  console.log(alleFouten.join('\n') || 'geen fouten');
  process.exit(mis.length || alleFouten.length ? 1 : 0);
})();

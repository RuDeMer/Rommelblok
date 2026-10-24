// Dieren en griezels in het spel (stap 4): node test/dieren.js [telefoon]
// - dieren verschijnen in de buurt, staan op de grond en zitten nergens in vast
// - vriendelijke dieren doen nooit pijn; geraakt rennen ze weg; verslagen laten ze iets vallen en zijn ze weg
// - melken met een emmer, scheren met een schaar
// - griezels: 's nachts wel, overdag weg, bij 'vredig' en in de bouwstand nooit, en ze doen pijn
// - het stuiterblok: terug omhoog en geen valschade
// - bewaren en opnieuw openen: de dieren en de moeilijkheid blijven; de keuze bij een nieuwe wereld werkt
const { open, wachtKlaar } = require('./pw');
const path = require('path'), UIT = require('./uit');
const tel = process.argv[2] === 'telefoon';
const mis = []; const check = (ok, w) => { if (!ok) mis.push(w); };
const wacht = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const ctx = tel ? { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true } : { viewport: { width: 1000, height: 620 } };
  const b = await open({ q: 'test=1&zaad=777&stand=overleven&straal=3&x=51&z=-41', ctx });
  const { page } = b; await wachtKlaar(page); await wacht(4000);
  await page.evaluate(() => { window.__rommelblok.tekenUit = true; });
  // ---------- 1. dieren in de buurt
  const r1 = await page.evaluate(() => {
    const R = window.__rommelblok, G = R.G;
    const op = R.actief.map(w => { const S = R.WZ.WEZENS[w.s];
      // grond (of water) onder het dier, binnen twee blokken (een konijn kan net midden in een sprongetje zijn)
      let grond = false; for (let d = 0; d <= 2 && !grond; d++) { const o = R.blokOp(Math.floor(w.x), Math.floor(w.y - 0.05) - d, Math.floor(w.z)); grond = o > 0 && (!!G.VAST[o & 255] || (o & 255) === G.W); }
      return { s: S.sleutel, vast: grond, in: R.WZ.raakt(R.wzW, w.x, w.y + 0.02, w.z, S.maat[0], S.maat[1] - 0.04) }; });
    return { n: R.WD.dieren.length, actief: R.actief.length, soorten: [...new Set(op.map(o => o.s))], los: op.filter(o => !o.vast).map(o => o.s), vast: op.filter(o => o.in).map(o => o.s) };
  });
  console.log('dieren:', JSON.stringify(r1));
  check(r1.n >= 3 && r1.actief >= 3, 'te weinig dieren in de buurt: ' + r1.n);
  check(!r1.los.length, 'dieren die niet op de grond staan: ' + r1.los.join(', '));
  check(!r1.vast.length, 'dieren die in een blok zitten: ' + r1.vast.join(', '));
  // een open vlakte boven de bomen om op te testen (gras op Y - 1, lucht erboven), dag, normaal
  const plek = await page.evaluate(async () => {
    const R = window.__rommelblok, sp = R.sp, X = Math.floor(sp.x), Y = Math.floor(sp.y) + 30, Z = Math.floor(sp.z);
    for (let x = -14; x <= 14; x++) for (let z = -14; z <= 14; z++) { R.zetBlok(X + x, Y - 1, Z + z, R.G.B.gras); for (let y = 0; y < 5; y++) R.zetBlok(X + x, Y + y, Z + z, 0); }
    R.valVrij = 600; R.zet(X + 0.5, Y, Z + 0.5); R.kijk(0, 0); R.tijd(0.5); R.WD.moeilijk = 'normaal';
    await new Promise(r => setTimeout(r, 800));
    return [X, Y, Z];
  });
  // ---------- 2. vriendelijke dieren vlak naast je: 20 seconden, geen pijn
  const r2 = await page.evaluate(p => {
    const R = window.__rommelblok, [X, Y, Z] = p;
    R.WD.dieren.length = 0; R.griezels.length = 0;
    R.WZ.WEZENS.forEach((S, i) => { if (S.vriend) R.WD.dieren.push(R.WZ.nieuwWezen(i, X + 0.5 + (i % 3 - 1) * 1.2, Y, Z + 1.5 + Math.floor(i / 3) * 1.2, i)); });
    R.wezensTik(0.6); R.sim(800, 0.025, {});
    return { hp: R.WD.speler.hp, n: R.actief.length };
  }, plek);
  console.log('vriendelijk naast je:', JSON.stringify(r2));
  check(r2.hp === 20, 'een vriendelijk dier deed pijn (levens ' + r2.hp + ')');
  // ---------- 3. raken: een koe wordt je doel en rent geraakt weg; een schaap laat wol vallen; verslagen zijn ze weg
  // (een hert kan hier niet: dat is schuw en rent al weg als je dichtbij komt)
  const r3 = await page.evaluate(p => {
    const R = window.__rommelblok, [X, Y, Z] = p, WZ = R.WZ, I = R.G.I;
    R.WD.dieren.length = 0; R.losse.length = 0;
    R.geef('zwaard_ijzer', 1); R.kies(R.WD.inv.findIndex(s => s && s.id === I.zwaard_ijzer));
    const koe = WZ.nieuwWezen(WZ.WI.koe, X + 0.5, Y, Z - 2.5, 0), schaap = WZ.nieuwWezen(WZ.WI.schaap, X + 3.5, Y, Z - 2.5, 0);
    koe.t = schaap.t = 1e9; R.WD.dieren.push(koe, schaap); R.wezensTik(0.01); R.wezensTik(0.6);
    koe.x = X + 0.5; koe.z = Z - 2.5;
    // richten op de koe: die wordt je doel
    R.zet(X + 0.5, Y, Z + 0.5); R.kijk(0, -0.25); R.spelTik(0.016, performance.now());
    const doel = R.doelWezen && R.WZ.WEZENS[R.doelWezen.s].sleutel;
    const af0 = Math.hypot(koe.x - R.sp.x, koe.z - R.sp.z);
    R.slaWezen(koe); const st = koe.st, hp = koe.hp;
    R.sim(60, 0.025, {});
    const af1 = Math.hypot(koe.x - R.sp.x, koe.z - R.sp.z);
    // het schaap: net zo lang slaan tot het weg is
    // (tussen twee slagen zit een wachttijd, en wie geen levens meer heeft, valt eerst om: de buit valt na 0,8 s)
    for (let i = 0; i < 12 && R.WD.dieren.includes(schaap); i++) { R.slaWezen(schaap); R.sim(25, 0.025, {}); }
    R.sim(40, 0.025, {});
    const wol = R.losse.filter(d => d.id === I.wol).reduce((a, d) => a + d.n, 0);
    for (let i = 0; i < 12 && R.WD.dieren.includes(koe); i++) { R.slaWezen(koe); R.sim(25, 0.025, {}); }
    return { doel, st, hp, af0: +af0.toFixed(1), af1: +af1.toFixed(1), schaapWeg: !R.WD.dieren.includes(schaap), wol, koeWeg: !R.WD.dieren.includes(koe), slijt: R.WD.inv[R.WD.kies] && R.WD.inv[R.WD.kies].dur };
  }, plek);
  console.log('raken:', JSON.stringify(r3));
  check(r3.doel === 'koe', 'de koe werd niet je doel (' + r3.doel + ')');
  check(r3.st === 'vlucht' && r3.hp === 3 && r3.af1 > r3.af0 + 2, 'een geraakte koe rende niet weg');
  check(r3.schaapWeg && r3.wol >= 1 && r3.wol <= 2, 'een verslagen schaap liet geen 1 of 2 wol vallen');
  check(r3.koeWeg, 'een verslagen koe is er nog');
  check(r3.slijt > 0 && r3.slijt < 260, 'het zwaard sleet niet');
  // ---------- 4. melken en scheren
  const r4 = await page.evaluate(p => {
    const R = window.__rommelblok, [X, Y, Z] = p, WZ = R.WZ, I = R.G.I;
    R.WD.dieren.length = 0; R.losse.length = 0;
    const koe = WZ.nieuwWezen(WZ.WI.koe, X + 0.5, Y, Z - 2, 0), schaap = WZ.nieuwWezen(WZ.WI.schaap, X + 3, Y, Z - 2, 0);
    R.WD.dieren.push(koe, schaap); R.wezensTik(0.6);
    R.geef('emmer', 1); R.kies(R.WD.inv.findIndex(s => s && s.id === I.emmer));
    const melk = R.wezenGebruik(koe, R.WD.inv[R.WD.kies]);
    const heeftMelk = R.WD.inv.some(s => s && s.id === I.emmer_melk);
    R.geef('schaar', 1); R.kies(R.WD.inv.findIndex(s => s && s.id === I.schaar));
    const scheer = R.wezenGebruik(schaap, R.WD.inv[R.WD.kies]);
    const wol = R.losse.filter(d => d.id === I.wol).reduce((a, d) => a + d.n, 0), kaal = schaap.kaal;
    const nog = R.wezenGebruik(schaap, R.WD.inv[R.WD.kies]);
    const wol2 = R.losse.filter(d => d.id === I.wol).reduce((a, d) => a + d.n, 0);
    return { melk, heeftMelk, scheer, wol, kaal, nog, wol2, logboek: ['melk', 'wol'].filter(k => R.WD.logboek && R.WD.logboek[k]), hp: [koe.hp, schaap.hp] };
  }, plek);
  console.log('melken en scheren:', JSON.stringify(r4));
  check(r4.melk && r4.heeftMelk, 'melken lukte niet');
  check(r4.scheer && r4.wol >= 2 && r4.wol <= 3 && r4.kaal > 0, 'scheren gaf geen 2 of 3 wol');
  check(r4.wol2 === r4.wol, 'een geschoren schaap gaf nog eens wol');
  check(r4.logboek.length === 2, 'geen mijlpalen voor melk en wol');
  check(r4.hp[0] === 10 && r4.hp[1] === 8, 'melken of scheren deed het dier pijn');
  // ---------- 5. griezels
  const r5 = await page.evaluate(async p => {
    const R = window.__rommelblok, [X, Y, Z] = p, WZ = R.WZ, uit = {};
    R.WD.dieren.length = 0; R.griezels.length = 0; R.WD.speler.hp = 20;
    R.tijd(0.9); R.WD.moeilijk = 'normaal';
    // een spookje vlak naast je, 10 seconden stilstaan (het cirkelt eerst en waarschuwt voor het toeslaat)
    R.griezels.push(WZ.nieuwWezen(WZ.WI.spookje, X + 1.5, Y + 0.4, Z + 0.5, 0)); R.wezensTik(0.01);
    for (let i = 0; i < 400; i++) { R.zet(X + 0.5, Y, Z + 0.5); R.sim(1, 0.025, {}); }
    uit.hpNormaal = R.WD.speler.hp;
    // vredig: weg, en er komen er geen bij
    R.WD.speler.hp = 20; R.WD.moeilijk = 'vredig'; R.sim(40, 0.025, {}); uit.vredigNa1s = R.griezels.length;
    R.sim(800, 0.025, {}); uit.vredigNa20s = R.griezels.length; uit.hpVredig = R.WD.speler.hp;
    // normaal, 's nachts: na een tijdje komen ze vanzelf
    R.WD.moeilijk = 'normaal'; let max = 0; for (let i = 0; i < 40 && !max; i++) { R.sim(40, 0.025, {}); max = R.griezels.length; }
    uit.vanzelf = max; uit.soorten = [...new Set(R.griezels.map(w => WZ.WEZENS[w.s].sleutel))];
    // het wordt dag: spookjes en braambollen weg (in een wolkje)
    R.griezels.push(WZ.nieuwWezen(WZ.WI.spookje, X + 6.5, Y + 0.4, Z + 6.5, 0));
    R.tijd(0.5); R.sim(40, 0.025, {}); uit.dag = R.griezels.filter(w => WZ.WEZENS[w.s].nacht).length;
    return uit;
  }, plek);
  console.log('griezels:', JSON.stringify(r5));
  check(r5.hpNormaal < 20, 'een spookje naast je deed geen pijn bij normaal');
  check(r5.vredigNa1s === 0 && r5.vredigNa20s === 0 && r5.hpVredig === 20, 'griezels bij vredig');
  check(r5.vanzelf > 0, 'er kwamen geen griezels vanzelf in de nacht');
  check(r5.dag === 0, 'spookjes bleven overdag');
  // ---------- 6. stuiterblok
  const r6 = await page.evaluate(p => {
    const R = window.__rommelblok, [X, Y, Z] = p;
    R.WD.speler.hp = 20; R.griezels.length = 0; R.tijd(0.5);
    R.zetBlok(X + 8, Y - 1, Z + 8, R.G.B.stuiterblok);
    R.valVrij = 0; R.zet(X + 8.5, Y + 12, Z + 8.5);
    let hoogste = -1, geland = false;
    for (let i = 0; i < 400; i++) { R.sim(1, 0.02, {}); if (R.sp.vy > 0 && R.sp.y < Y + 2) geland = true; if (geland) hoogste = Math.max(hoogste, R.sp.y - Y); }
    return { hp: R.WD.speler.hp, terug: +hoogste.toFixed(1) };
  }, plek);
  console.log('stuiterblok:', JSON.stringify(r6));
  check(r6.hp === 20, 'valschade op een stuiterblok');
  check(r6.terug > 5, 'niet teruggestuiterd (' + r6.terug + ' hoog)');
  await page.evaluate(() => { window.__rommelblok.tekenUit = false; });
  await page.screenshot({ path: path.join(UIT, 'dieren-' + (tel ? 'telefoon' : 'computer') + '.png') });
  // ---------- 7. bewaren en opnieuw openen, met de keuze bij een nieuwe wereld
  await page.goto(b.url.split('?')[0]); await page.waitForSelector('#rb-begin:not([hidden])');
  await page.click('#rb-nieuw'); await page.fill('#rb-maak-naam', 'Dierenland'); await page.fill('#rb-maak-zaad', 'kroket7');
  const knoppen = await page.$$eval('#rb-maak-moeilijk button', l => l.map(e => e.textContent));
  await page.click('#rb-maak-moeilijk button:nth-child(4)');
  const uitleg = await page.textContent('#rb-maak-moeilijk-uitleg');
  await page.click('#rb-maak-vorm button[type=submit]'); await wachtKlaar(page); await wacht(5000);
  const voor = await page.evaluate(() => { const R = window.__rommelblok; return { n: R.WD.dieren.length, moeilijk: R.WD.moeilijk, nrs: R.WD.dieren.map(w => w.n + ':' + w.s).join(',') }; });
  const inst = await page.evaluate(() => { const R = window.__rommelblok; window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' })); return true; }).then(() => page.click('#rb-menu-inst')).then(() => page.$$eval('#inst-moeilijk button', l => l.map(e => e.getAttribute('aria-pressed') + ':' + e.textContent)));
  await page.evaluate(() => window.__rommelblok.naarWerelden()); await wacht(1500);
  await page.reload(); await page.waitForSelector('#rb-begin:not([hidden])'); await wacht(800);
  await page.click('#rb-werelden .rb-wereld [data-doe=speel]'); await wachtKlaar(page); await wacht(1500);
  const na = await page.evaluate(() => { const R = window.__rommelblok; return { n: R.WD.dieren.length, moeilijk: R.WD.moeilijk, nrs: R.WD.dieren.map(w => w.n + ':' + w.s).join(','), naam: R.WD.naam }; });
  console.log('nieuwe wereld:', JSON.stringify({ knoppen, uitleg, voor, inst, na }));
  check(knoppen.length === 4, 'geen vier keuzes voor griezels');
  check(voor.moeilijk === 'moeilijk' && na.moeilijk === 'moeilijk', 'de moeilijkheid is niet bewaard');
  check(inst.some(x => x.startsWith('true:Moeilijk')), 'de instellingen tonen de moeilijkheid niet');
  check(voor.n > 0 && na.n >= voor.n && na.nrs.startsWith(voor.nrs), 'de dieren zijn niet bewaard (' + voor.n + ' en ' + na.n + ')');
  // ---------- 8. een kapot of vreemd dier in de opslag wordt overgeslagen
  const r8 = await page.evaluate(() => { const R = window.__rommelblok; return [R.schoonDier({ n: 3, s: 0, x: 1, y: 64, z: 1, hp: 99 }), R.schoonDier({ n: 3, s: 8, x: 1, y: 64, z: 1 }), R.schoonDier({ n: -1, s: 0, x: 1, y: 64, z: 1 }), R.schoonDier({ n: 4, s: 0, x: 'a', y: 64, z: 1 })].map(w => (w ? w.hp : null)); });
  check(r8[0] === 10 && r8.slice(1).every(v => v === null), 'vreemde dieren in de opslag: ' + JSON.stringify(r8));
  // ---------- 9. de bouwstand: geen griezels
  const r9 = await page.evaluate(() => { const R = window.__rommelblok; R.WD.stand = 'bouwen'; R.tijd(0.9); R.griezels.push(R.WZ.nieuwWezen(R.WZ.WI.spookje, R.sp.x + 2, R.sp.y + 0.5, R.sp.z, 0)); R.sim(400, 0.025, {}); return R.griezels.length; });
  check(r9 === 0, 'griezels in de bouwstand');
  console.log(mis.length ? 'MIS: ' + mis.join(' | ') : 'dieren en griezels: alles goed' + (tel ? ' (telefoon)' : ''));
  console.log(b.fouten.join('\n') || 'geen fouten'); await b.sluit();
  process.exit(mis.length || b.fouten.length ? 1 : 0);
})();

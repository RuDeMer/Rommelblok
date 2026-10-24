// Commando's en weer bij alleen spelen (browser): node test/commando_weer.js
// 1. Commando's: alleen als je ze bij het maken van de wereld toestond; de toets / opent het scherm; elk commando
//    (tijd, weer, stand, ga, geef) doet wat het zegt, foute invoer geeft een duidelijke uitleg, en na het eerste commando
//    telt de wereld niet meer voor het logboek.
// 2. Weer: het weer slaat vanzelf om (regen 0,1 tot 0,25 dag, droog 0,3 tot 0,7 dag); bij regen wordt de lucht donkerder en
//    vallen er druppels; onder een dak ben je binnen; in een koud gebied sneeuwt het.
const { open, wachtKlaar } = require('./pw');
const mis = []; const check = (ok, w) => { console.log((ok ? 'goed ' : 'FOUT ') + w); if (!ok) mis.push(w); };
(async () => {
  const b = await open({ q: 'test=1&zaad=777&stand=overleven&straal=3&x=51&z=-41&tijd=0.5', ctx: { viewport: { width: 640, height: 400 } } });
  const { page, fouten } = b; await wachtKlaar(page); await page.waitForTimeout(1500);
  // ---------- 1. commando's
  const zonder = await page.evaluate(() => {
    const R = window.__rommelblok; R.WD.commandosMag = false; const t0 = R.WD.tijd;
    return { mag: R.cmdMag(), gedaan: R.cmdDoe('/tijd nacht'), tijd: R.WD.tijd === t0, gebruikt: R.WD.commandos };
  });
  check(!zonder.mag && !zonder.gedaan && zonder.tijd && !zonder.gebruikt, 'een wereld zonder commando\'s: /tijd nacht doet niets');
  // geen scherm open (Escape sluit een scherm, maar opent in het spel het menu)
  const geenScherm = async () => { for (let i = 0; i < 5 && await page.evaluate(() => document.querySelectorAll('.rb-scherm:not([hidden])').length); i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(150); } };
  await geenScherm();
  await page.keyboard.press('Slash'); await page.waitForTimeout(300);
  check(await page.evaluate(() => document.getElementById('rb-cmd').hidden), 'en de toets / opent dan geen commandoscherm');
  const lezen = await page.evaluate(() => {
    const R = window.__rommelblok, sp = R.sp, I = id => id, uit = {};
    const g = (s) => { const c = R.cmdLees(s); return c.fout ? 'fout' : JSON.stringify(c); };
    uit.nacht = R.cmdLees('/tijd nacht').tijd; uit.achttien = R.cmdLees('/time 18').tijd; uit.zes = R.cmdLees('/tijd 6u').tijd; uit.te = g('/tijd 25'); uit.leeg = g('/tijd');
    uit.regen = R.cmdLees('/weer regen').regen; uit.helder = R.cmdLees('/weather clear').regen; uit.sneeuw = R.cmdLees('/weer sneeuw').regen;
    uit.bouwen = R.cmdLees('/stand creative').stand; uit.overleven = R.cmdLees('/gamemode s').stand; uit.stand = g('/stand vliegen');
    const p = R.cmdLees('/ga 10 90 -5'); uit.plek = [p.x, p.y, p.z];
    const r = R.cmdLees('/ga ~1 ~0 ~0'); uit.relatief = Math.abs(r.x - (Math.floor(sp.x + 1) + 0.5)) < 1e-9 && Math.abs(r.y - sp.y) < 1e-9;
    const th = R.cmdLees('/ga thuis'), st = R.WD.speler.start; uit.thuis = !!st && th.x === st[0] && th.z === st[2];
    uit.gaFout = g('/ga 1 2'); uit.gaHoog = g('/ga 0 999 0'); uit.gaNaam = g('/ga Piet');
    const f = R.cmdLees('/geef fakkel 16'), f2 = R.cmdLees('/give torch'); uit.fakkel = [f.id === R.G.B.fakkel, f.n, f2.id === R.G.B.fakkel, f2.n];
    uit.appel = R.cmdLees('/geef Appel 3').id === R.G.I.appel; uit.teVeel = g('/geef fakkel 999'); uit.onbekend = g('/geef knuffelbeer'); uit.ander = g('/geef fakkel 2 Piet');
    uit.raar = g('/vlieg'); uit.niets = g('/');
    uit.engels = ['/time day', '/time night', '/time 18', '/weather rain', '/weather clear', '/mode build', '/mode survival', '/goto home', '/goto 0 80 0', '/give torch 16'].filter(s => R.cmdLees(s).fout);
    return uit;
  });
  check(lezen.nacht === 0.85 && lezen.achttien === 0.75 && lezen.zes === 0.25 && lezen.te === 'fout' && lezen.leeg === 'fout', '/tijd: nacht, 18 (ook /time), 6u; 25 of niets is fout');
  check(lezen.regen === true && lezen.helder === false && lezen.sneeuw === true, '/weer: regen, sneeuw en helder (ook /weather clear)');
  check(lezen.bouwen === 'bouwen' && lezen.overleven === 'overleven' && lezen.stand === 'fout', '/stand: bouwen en overleven (ook /gamemode s), iets anders is fout');
  check(lezen.plek.join() === '10.5,90,-4.5' && lezen.relatief && lezen.thuis, '/ga: naar x y z (midden van het blok), ~ vanaf waar je staat, en thuis');
  check(lezen.gaFout === 'fout' && lezen.gaHoog === 'fout' && lezen.gaNaam === 'fout', '/ga met twee getallen, te hoog of een naam (alleen) is fout');
  check(lezen.fakkel.join() === 'true,16,true,1' && lezen.appel, '/geef fakkel 16, /give torch (1) en /geef Appel 3 (hoofdletters maken niet uit)');
  check(!lezen.engels.length, 'de Engelse voorbeelden werken ook' + (lezen.engels.length ? ': ' + lezen.engels.join(', ') : ''));
  check(lezen.teVeel === 'fout' && lezen.onbekend === 'fout' && lezen.ander === 'fout' && lezen.raar === 'fout' && lezen.niets === 'fout', 'te veel, een onbekend voorwerp, geven aan een ander (alleen) en een onbekend commando: fout');
  // nu met commando's (zoals bij het maken van de wereld aangevinkt)
  const lb0 = await page.evaluate(() => { const R = window.__rommelblok; R.WD.commandosMag = true; R.WD.logboek = {}; return R.logboek(R.LOGBOEK[0][0], true); });
  check(lb0, 'voor het eerste commando telt het logboek gewoon');
  await geenScherm();
  await page.keyboard.press('Slash');
  const scherm = await page.waitForSelector('#rb-cmd:not([hidden])', { timeout: 5000 }).then(() => true, () => false);
  check(scherm && await page.evaluate(() => /logboek/.test(document.getElementById('rb-cmd-info').textContent) && document.querySelectorAll('#rb-cmd-hulp button').length >= 8), 'de toets / opent het commandoscherm, met voorbeelden en een waarschuwing over het logboek');
  await page.fill('#rb-cmd-tekst', '/tijd 18000');
  await page.press('#rb-cmd-tekst', 'Enter'); await page.waitForTimeout(200);
  check(await page.evaluate(() => !document.getElementById('rb-cmd').hidden && document.getElementById('rb-cmd-info').classList.contains('fout') && !window.__rommelblok.WD.commandos), 'een fout commando: het scherm blijft open met uitleg, en de wereld telt nog mee');
  await page.fill('#rb-cmd-tekst', '/ti'); await page.press('#rb-cmd-tekst', 'Tab');
  check(await page.inputValue('#rb-cmd-tekst') === '/tijd ', 'Tab vult het commando aan (/ti wordt /tijd)');
  await page.fill('#rb-cmd-tekst', '/tijd nacht'); await page.press('#rb-cmd-tekst', 'Enter'); await page.waitForTimeout(300);
  const na = await page.evaluate(() => { const R = window.__rommelblok; return { tijd: R.WD.tijd, dicht: document.getElementById('rb-cmd').hidden, gebruikt: R.WD.commandos, melding: document.getElementById('rb-melding').textContent }; });
  check(Math.abs(na.tijd - 0.85) < 0.01 && na.dicht && na.gebruikt, '/tijd nacht: het wordt nacht, het scherm gaat dicht, en de wereld telt niet meer voor het logboek');
  const lb = await page.evaluate(() => { const R = window.__rommelblok, id = R.LOGBOEK[1][0]; const ok = R.logboek(id, true); R.openLogboek(); const kop = document.querySelector('#rb-logboek .rb-rang .rb-klein'); const tekst = kop ? kop.textContent : ''; return { ok, erin: !!R.WD.logboek[id], tekst }; });
  check(!lb.ok && !lb.erin && /commando/.test(lb.tekst), 'daarna komt er geen mijlpaal meer bij, en het logboek zegt waarom');
  await geenScherm();
  const doe = await page.evaluate(async () => {
    const R = window.__rommelblok, uit = {}, tel = id => R.WD.inv.reduce((n, s) => n + (s && s.id === id ? s.n : 0), 0);
    R.cmdDoe('/stand bouwen'); uit.bouwen = R.WD.stand; R.cmdDoe('/stand overleven'); uit.overleven = R.WD.stand;
    const f0 = tel(R.G.B.fakkel); R.cmdDoe('/geef fakkel 16'); uit.fakkels = tel(R.G.B.fakkel) - f0;
    R.cmdDoe('/weer regen'); uit.regen = R.WD.weer.regen; R.cmdDoe('/weer helder'); uit.droog = R.WD.weer.regen;
    const x0 = R.sp.x; R.cmdDoe('/ga ~40 ~10 ~0'); uit.ga = [R.sp.x - x0, R.klaar];
    for (let i = 0; i < 300 && !R.klaar; i++) await new Promise(r => setTimeout(r, 100));
    uit.geland = R.klaar;
    return uit;
  });
  check(doe.bouwen === 'bouwen' && doe.overleven === 'overleven', '/stand bouwen en /stand overleven');
  check(doe.fakkels === 16, '/geef fakkel 16: 16 fakkels in de rugzak');
  check(doe.regen === true && doe.droog === false, '/weer regen en /weer helder');
  check(Math.abs(doe.ga[0] - 40) < 1 && doe.ga[1] === false && doe.geland, '/ga ~40 ~10 ~0: 40 blokken verder, de wereld laadt daar en je landt');
  // een nieuwe wereld: het vinkje staat uit, en de keuze komt in de wereld
  const nieuw = await page.evaluate(() => {
    const R = window.__rommelblok;
    return { met: R.nieuweWereldGegevens('A', '1', 'overleven', 'makkelijk', true), zonder: R.nieuweWereldGegevens('B', '1', 'overleven', 'makkelijk') };
  });
  check(nieuw.met.commandosMag === true && nieuw.met.commandos === false && nieuw.zonder.commandosMag === false, 'een nieuwe wereld onthoudt of commando\'s mogen (standaard niet)');

  // ---------- 2. weer
  const kring = await page.evaluate(() => {
    const R = window.__rommelblok, klok = () => R.WD.dag + R.WD.tijd, uit = {};
    R.tijd(0.5); delete R.WD.weer; R.weerTik(0.016); uit.eerst = [R.WD.weer.regen, R.WD.weer.wissel - klok()];
    R.WD.weer.wissel = klok() - 0.001; R.weerTik(0.016); uit.regen = [R.WD.weer.regen, R.WD.weer.wissel - klok()];
    R.WD.weer.wissel = klok() - 0.001; R.weerTik(0.016); uit.droog = [R.WD.weer.regen, R.WD.weer.wissel - klok()];
    // honderd keer omslaan: hoe lang duurt regen en droog?
    let r = [9, 0], d = [9, 0];
    for (let i = 0; i < 200; i++) { R.WD.weer.wissel = klok() - 0.001; R.weerTik(0.016); const dur = R.WD.weer.wissel - klok(), a = R.WD.weer.regen ? r : d; a[0] = Math.min(a[0], dur); a[1] = Math.max(a[1], dur); }
    uit.duur = { regen: r, droog: d };
    return uit;
  });
  check(kring.eerst[0] === false && kring.eerst[1] >= 0.3 && kring.eerst[1] <= 0.7, 'een wereld zonder weer begint droog, en slaat om na 0,3 tot 0,7 dag');
  check(kring.regen[0] === true && kring.droog[0] === false, 'het weer slaat vanzelf om: regen, dan weer droog');
  check(kring.duur.regen[0] >= 0.1 && kring.duur.regen[1] <= 0.25 && kring.duur.droog[0] >= 0.3 && kring.duur.droog[1] <= 0.7, 'regen duurt 0,1 tot 0,25 dag, droog 0,3 tot 0,7 dag (' + kring.duur.regen.map(v => v.toFixed(2)).join('-') + ', ' + kring.duur.droog.map(v => v.toFixed(2)).join('-') + ')');
  const zacht = await page.evaluate(() => {
    const R = window.__rommelblok; R.WD.weer = { regen: true, wissel: R.WD.dag + R.WD.tijd + 0.2 }; R.WEER.mix = 0;
    const mix = []; for (let i = 0; i < 100; i++) { R.weerTik(0.1); if (i % 25 === 24) mix.push(+R.WEER.mix.toFixed(2)); }
    return { mix, teken: R.weerTeken() };
  });
  check(zacht.mix[0] > 0.4 && zacht.mix[0] < 0.8 && zacht.mix[3] > 0.95 && zacht.teken && zacht.teken.sterkte > 0.9, 'de regen komt zacht op (na 2,5 s ' + zacht.mix[0] + ', na 10 s ' + zacht.mix[3] + ')');
  // beeld: een donkerdere lucht en druppels (twee beeldjes met dezelfde camera)
  const beeld = await page.evaluate(async () => {
    const R = window.__rommelblok, gl = R.R.gl, w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, wacht = ms => new Promise(r => setTimeout(r, ms));
    const lees = () => { const a = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, a); return a; };
    const lucht = a => { let s = 0, n = 0; for (let y = Math.floor(h * 0.75); y < h; y++) for (let x = 0; x < w; x++) { const k = (y * w + x) * 4; s += a[k] + a[k + 1] + a[k + 2]; n++; } return s / n / 3; };
    // hoog boven het land (in de bouwstand vliegend): niets boven je, dus overal om je heen regen
    R.WD.stand = 'bouwen'; R.sp.vliegt = true; R.zet(R.sp.x, R.sp.y + 30, R.sp.z); R.kijk(0.6, 0.15); R.tijd(0.5);
    const zet = async regen => { R.WD.weer = { regen, wissel: R.WD.dag + R.WD.tijd + 0.2 }; R.WEER.mix = regen ? 1 : 0; for (let i = 0; i < 40; i++) { R.weerTik(0.016); } R.tekenUit = false; await wacht(1500); R.tekenUit = true; R.tijd(0.5); };
    await zet(false); R.proefBeeld(0, 0, 0, {}); const droog = lees();
    await zet(true); R.proefBeeld(0, 0, 0, {}); const grijs = lees(); R.proefBeeld(0, 0, 0, { neerslag: R.weerTeken() }); const nat = lees();
    let anders = 0; for (let i = 0; i < nat.length; i += 4) if (Math.abs(nat[i] - grijs[i]) + Math.abs(nat[i + 1] - grijs[i + 1]) + Math.abs(nat[i + 2] - grijs[i + 2]) > 24) anders++;
    R.tekenUit = false; R.zet(R.sp.x, R.sp.y - 30, R.sp.z); R.sp.vliegt = false; R.WD.stand = 'overleven';
    return { droog: lucht(droog), grijs: lucht(grijs), druppels: anders / (w * h) };
  });
  check(beeld.grijs < beeld.droog * 0.8, 'bij regen is de lucht grijzer en donkerder (helderheid ' + beeld.droog.toFixed(0) + ' -> ' + beeld.grijs.toFixed(0) + ')');
  check(beeld.druppels > 0.003, 'en er vallen druppels in beeld (' + (beeld.druppels * 100).toFixed(1) + '% van het beeld)');
  await page.screenshot({ path: require('path').join(require('./uit'), 'regen.png') });
  // onder een dak: binnen, en de kaart van daken klopt
  const dak = await page.evaluate(() => {
    const R = window.__rommelblok, B = R.G.B, X = Math.floor(R.sp.x), Y = Math.floor(R.sp.y), Z = Math.floor(R.sp.z);
    const vol = () => { for (let i = 0; i < 9; i++) R.weerTik(0.016); };
    vol(); const buiten = R.WEER.binnen;
    for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) R.zetBlok(X + x, Y + 5, Z + z, B.planken_eik);
    vol(); const k = R.WEER.kaart, i = ((Z - R.WEER.z0) * 32 + (X - R.WEER.x0)) * 2, j = ((Z - R.WEER.z0) * 32 + (X + 6 - R.WEER.x0)) * 2;
    const uit = { buiten, binnen: R.WEER.binnen, dak: k[i], naast: k[j], Y };
    for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) R.zetBlok(X + x, Y + 5, Z + z, 0);
    vol(); uit.weer = R.WEER.binnen;
    return uit;
  });
  check(!dak.buiten && dak.binnen && dak.dak === dak.Y + 5 && dak.naast < dak.Y + 5 && !dak.weer, 'onder een dak ben je binnen (geen regen op die plek), ernaast niet, en zonder dak weer buiten');
  // koud: sneeuw op de sneeuwvlakte (293, 196 bij zaadje 777), niet bij de start
  const koud0 = await page.evaluate(() => window.__rommelblok.WEER.sneeuwHier);
  await page.evaluate(() => { const R = window.__rommelblok; R.WD.stand = 'bouwen'; R.sp.vliegt = true; R.zet(293.5, 90, 196.5); });
  await page.waitForFunction(() => { const R = window.__rommelblok; return R.klaar && R.blokOp(293, 60, 196) >= 0; }, null, { timeout: 60000 });
  const koud = await page.evaluate(() => { const R = window.__rommelblok; for (let i = 0; i < 9; i++) R.weerTik(0.016); return { sneeuw: R.WEER.sneeuwHier, }; });
  check(!koud0 && koud.sneeuw, 'op de sneeuwvlakte sneeuwt het, bij de start regent het');
  await page.evaluate(async () => { const R = window.__rommelblok; R.kijk(0, 0.2); await new Promise(r => setTimeout(r, 2500)); });
  await page.screenshot({ path: require('path').join(require('./uit'), 'sneeuw.png') });
  check(!fouten.length, 'geen fouten in de console' + (fouten.length ? ': ' + fouten.join('; ') : ''));
  await b.sluit();
  console.log(mis.length ? mis.length + ' FOUT' : 'commando\'s en weer: alles goed');
  process.exit(mis.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

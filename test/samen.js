// Samen spelen met echte browsers: een lokale spelserver (server/), die ook de pagina laat zien, en twee of drie spelers.
//   node test/samen.js [3]
// - een gedeelde wereld maken (eigenaar), meedoen met de code, elkaar zien (poppetje en naamkaartje)
// - samen bouwen: breken en bouwen komt bij de ander aan, spullen op de grond krijgt maar één speler
// - praten met vaste zinnetjes, dempen; de eigenaar zet iemand eruit
// - geen fouten in de console en geen overtredingen van het veiligheidsbeleid
const { spawn } = require('child_process');
const net = require('net'), path = require('path'), fs = require('fs'), os = require('os');
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/node22/lib/node_modules/playwright'); } })();
const UIT = require('./uit');
const DRIE = process.argv[2] === '3';
let fouten = 0; const goed = (b, t) => { console.log((b ? 'goed ' : 'FOUT ') + t); if (!b) fouten++; return b; };
const vrijePoort = () => new Promise(ok => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => ok(p)); }); });

(async () => {
  const poort = await vrijePoort(), map = fs.mkdtempSync(path.join(os.tmpdir(), 'rb-samen-'));
  const herkomst = `http://127.0.0.1:${poort}`;
  let serverLog = '', srv = null;
  async function startSrv() {
    const begin = serverLog.length;
    srv = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', path.join(__dirname, '..', 'server', 'src', 'start.js')], {
      env: Object.assign({}, process.env, { PORT: String(poort), DB_PAD: path.join(map, 'samen.db'), ORIGINS: herkomst, STATISCH: UIT, BEHEER: 'een-lang-testwachtwoord' }), stdio: ['ignore', 'pipe', 'pipe'],
    });
    srv.stdout.on('data', d => { serverLog += d; }); srv.stderr.on('data', d => { serverLog += d; });
    for (let i = 0; i < 100 && !/luistert/.test(serverLog.slice(begin)); i++) await new Promise(r => setTimeout(r, 100));
    return /luistert/.test(serverLog.slice(begin));
  }
  const stopSrv = async () => { const s2 = srv; s2.kill('SIGTERM'); await new Promise(r => s2.on('exit', r)); };
  goed(await startSrv(), 'de spelserver draait (' + herkomst + ')');
  let herstart = false; // tijdens een bewuste herstart mag de browser melden dat de verbinding mislukt

  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows'] });
  const spelers = [];
  async function nieuweSpeler(naam, opties = {}) {
    const ctx = await browser.newContext(Object.assign({ viewport: { width: 1024, height: 600 } }, opties.ctx || {}));
    const page = await ctx.newPage();
    await page.route(/workers\.dev|cloudflareinsights|api\.github|fonts\.g|blok\.rubensrommelhoekje/, r => r.abort());
    const f = [];
    page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED|status of 404/.test(m.text()) && !(herstart && /WebSocket connection to .* failed/.test(m.text()))) f.push(naam + ' console: ' + m.text()); });
    page.on('pageerror', e => f.push(naam + ' pageerror: ' + e.message));
    // (een kleine kijkafstand: in deze testomgeving tekent een software-grafische kaart alle spelers tegelijk)
    await page.addInitScript(() => { document.addEventListener('securitypolicyviolation', e => console.error('CSP: ' + e.violatedDirective + ' ' + e.blockedURI)); try { localStorage.setItem('rommelblok-taal', 'nl'); if (!localStorage.getItem('rommelblok-v3')) localStorage.setItem('rommelblok-v3', JSON.stringify({ v: 3, inst: { kijk: 3, kwaliteit: 'laag' } })); } catch (e) {} });
    await page.goto(`${herkomst}/rommelblok.html?samen=lokaal`);
    await page.waitForFunction(() => window.__rommelblok && !document.getElementById('rb-begin').hidden, null, { timeout: 60000 });
    const s = { naam, ctx, page, fouten: f }; spelers.push(s); return s;
  }
  const R = (s, f, a) => s.page.evaluate(f, a);
  const wachtWereld = async s => {
    await s.page.waitForFunction(() => { const R = window.__rommelblok; return R.klaar && R.samen && R.WD && R.WD.samen; }, null, { timeout: 90000, polling: 100 });
    // de berichten van de server bijhouden (voor de test)
    await s.page.evaluate(() => { const ws = window.__rommelblok.samen.ws; window.__ber = []; ws.addEventListener('message', e => { try { window.__ber.push(JSON.parse(e.data)); } catch (er) {} }); });
  };
  // (elke 100 ms kijken, en niet per beeldje: in deze testomgeving komt er soms maar eens per paar seconden een beeldje)
  const wacht = (s, f, a, ms = 15000) => s.page.waitForFunction(f, a, { timeout: ms, polling: 100 }).then(() => true, () => false);

  // ---------------- A maakt een gedeelde wereld
  const A = await nieuweSpeler('A');
  goed(await R(A, () => !document.getElementById('rb-samen-knop').hidden), 'de knop Samen spelen staat er (met ?samen=lokaal)');
  await A.page.click('#rb-samen-knop');
  await A.page.waitForSelector('#rb-samen:not([hidden])');
  await A.page.selectOption('#rb-samen-naam-a', '1'); await A.page.selectOption('#rb-samen-naam-b', '0');
  await A.page.screenshot({ path: path.join(UIT, 'samen-scherm.png') });
  await A.page.click('#rb-samen-maak');
  await A.page.waitForSelector('#rb-maak:not([hidden])');
  goed(await R(A, () => document.getElementById('rb-maak-naam-rij').hidden), 'een gedeelde wereld krijgt geen eigen naam (alleen "De wereld van ...")');
  await A.page.click('.rb-stand[data-stand="overleven"]');
  await A.page.fill('#rb-maak-zaad', 'samen123');
  await A.page.click('#rb-maak-vorm button[type=submit]');
  await wachtWereld(A);
  const info = await R(A, () => { const R = window.__rommelblok; return { code: R.samen.code, eigenaar: R.samen.eigenaar, naam: R.WD.naam, zaad: R.WD.zaad, sleutel: !!R.opslag.samen[0].k, opslag: JSON.stringify(R.opslag).length }; });
  goed(info.eigenaar && /^[a-z]+-[a-z]+-[a-z]+-\d+$/.test(info.code), 'A is eigenaar en heeft een code: ' + info.code);
  goed(info.naam === 'De wereld van Blauwe Egel' && info.zaad === await R(A, () => window.__rommelblok.G.zaadVan('samen123') >>> 0), 'de wereld heet "' + info.naam + '", met het zaadje van A');
  goed(info.sleutel && info.opslag < 1200, 'de sleutel van de eigenaar staat in rommelblok-v3 (' + info.opslag + ' tekens)');

  // ---------------- B doet mee met de code
  const B = await nieuweSpeler('B');
  await B.page.click('#rb-samen-knop'); await B.page.waitForSelector('#rb-samen:not([hidden])');
  await B.page.fill('#rb-samen-code', 'een-foute-code-12');
  await B.page.click('#rb-samen-mee button[type=submit]');
  goed(await wacht(B, () => !document.getElementById('rb-samen-fout').hidden && /klopt niet/.test(document.getElementById('rb-samen-fout').textContent)), 'een foute code: een duidelijke melding');
  await B.page.fill('#rb-samen-code', info.code.toUpperCase());
  await B.page.click('#rb-samen-mee button[type=submit]');
  await wachtWereld(B);
  goed(await R(B, () => !window.__rommelblok.samen.eigenaar && window.__rommelblok.samen.spelers.size === 1), 'B is binnen (geen eigenaar) en ziet A in de lijst');
  goed(await wacht(A, () => window.__rommelblok.samen.spelers.size === 1), 'A ziet B binnenkomen');
  let C = null;
  if (DRIE) {
    C = await nieuweSpeler('C', { ctx: { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true } });
    await C.page.click('#rb-samen-knop'); await C.page.fill('#rb-samen-code', info.code); await C.page.click('#rb-samen-mee button[type=submit]');
    await wachtWereld(C);
    goed(await wacht(A, () => window.__rommelblok.samen.spelers.size === 2) && await R(C, () => window.__rommelblok.samen.spelers.size === 2), 'een derde speler (telefoon, 360 breed) doet mee; iedereen ziet twee anderen');
  }

  // ---------------- elkaar zien: zet B voor A en kijk of A een poppetje en een naamkaartje ziet
  await A.page.waitForTimeout(1500);
  const voorA = await R(A, () => { const R = window.__rommelblok; const p = [R.sp.x - Math.sin(R.sp.yaw) * 3.5, R.sp.y, R.sp.z - Math.cos(R.sp.yaw) * 3.5]; R.kijk(R.sp.yaw, -0.1); return p; });
  await R(B, p => { const R = window.__rommelblok; R.zet(p[0], p[1] + 0.5, p[2]); R.kijk(0, 0); }, voorA);
  const ziet = await wacht(A, () => { const R = window.__rommelblok, o = [...R.samen.spelers.values()][0], el = o && o.el; return !!(el && !el.hidden && /Rode|Blauwe|Snelle|Groene|Gele|Paarse|Vrolijke|Dappere|Slimme|Stille|Grappige|Kleine|Grote|Zonnige|Sterke|Zachte|Gouden|Zilveren|Vliegende|Dansende|Springende|Slaperige|Lieve|Rustige|Gekke|Oranje/.test(el.textContent)); }, null, 8000);
  goed(ziet, 'A ziet het naamkaartje van B boven zijn hoofd');
  await A.page.waitForTimeout(400);
  await A.page.screenshot({ path: path.join(UIT, 'samen-a-ziet-b.png') });

  // ---------------- samen bouwen: B staat naast A; A breekt het blok onder zich, B ziet het
  const plekA = await R(A, () => { const R = window.__rommelblok; return [R.sp.x, R.sp.y, R.sp.z]; });
  await R(B, p => window.__rommelblok.zet(p[0] + 0.7, p[1] + 0.3, p[2]), plekA);
  await B.page.waitForTimeout(800);
  const telA = () => R(A, () => window.__rommelblok.WD.inv.reduce((n, s) => n + (s ? s.n : 0), 0)), telB = () => R(B, () => window.__rommelblok.WD.inv.reduce((n, s) => n + (s ? s.n : 0), 0));
  const tel0 = [await telA(), await telB()];
  const blok = await R(A, async () => {
    const R = window.__rommelblok; R.kijk(R.sp.yaw, -1.45); R.sim(1, 0.001);
    const d = R.doel; if (!d) return null; R.breek(d, false); return { x: d.x, y: d.y, z: d.z, v: d.v };
  });
  goed(!!blok, 'A breekt een blok onder zich');
  goed(await wacht(B, b => window.__rommelblok.blokOp(b.x, b.y, b.z) === 0, blok), 'B ziet het blok verdwijnen');
  const losA = await wacht(A, () => window.__ber.some(m => m.t === 'los'), null, 5000), losB = await wacht(B, () => window.__ber.some(m => m.t === 'los'), null, 5000);
  goed(losA && losB, 'wat eruit valt, komt bij allebei op de grond (met een nummer van de server)');
  // ze staan er allebei naast: wie het krijgt, maakt niet uit, maar het mag er maar één keer bij komen
  // (de spullen bewegen per beeldje; in deze testomgeving zijn dat er maar een paar per seconde, dus even met de hand doorrekenen)
  let opgepakt = false;
  for (let i = 0; i < 40 && !opgepakt; i++) { await R(A, () => window.__rommelblok.sim(4, 0.05)); await R(B, () => window.__rommelblok.sim(4, 0.05)); await A.page.waitForTimeout(150); opgepakt = await R(A, () => window.__ber.some(m => m.t === 'opgeraapt' && m.wie > 0)); }
  goed(opgepakt, 'iemand pakt het op');
  await A.page.waitForTimeout(800);
  const naA = [await telA(), await telB()];
  const erbij = naA[0] - tel0[0] + naA[1] - tel0[1], n = await R(A, () => { const m = window.__ber.find(x => x.t === 'los'); return m.l.reduce((s, r) => s + r[5], 0); });
  goed(erbij === n, 'het komt er precies één keer bij (A +' + (naA[0] - tel0[0]) + ', B +' + (naA[1] - tel0[1]) + ', er viel ' + n + ')');
  goed(await R(A, () => !window.__rommelblok.losse.some(d => d.sid > 0)) && await R(B, () => !window.__rommelblok.losse.some(d => d.sid > 0)), 'en het ligt bij niemand meer op de grond');
  // A bouwt iets (planken), B ziet het
  const bouw = await R(A, async () => {
    const R = window.__rommelblok; R.geef('planken_eik', 4);
    for (let i = 0; i < 9; i++) { if (R.WD.inv[i] && R.WD.inv[i].id === R.G.B.planken_eik) { R.kies(i); break; } }
    // twee blokken naast A (B staat aan de andere kant): recht naar beneden kijken vanaf daar, en erop bouwen
    const d = R.richt([R.sp.x - 2, R.sp.y + 1.6, R.sp.z], [0, -1, 0], 6); if (!d) return null;
    const p = [d.x + d.n[0], d.y + d.n[1], d.z + d.n[2]];
    return R.plaats(d, R.WD.inv[R.WD.kies]) ? p : null;
  });
  const bouwOk = !!bouw && await wacht(B, p => (window.__rommelblok.blokOp(p[0], p[1], p[2]) & 255) === window.__rommelblok.G.B.planken_eik, bouw);
  if (!bouwOk) console.log('bouwen:', JSON.stringify(bouw), JSON.stringify(await R(A, () => ({ ber: window.__ber.filter(m => m.t === 'ja' || m.t === 'nee').slice(-3), inv: window.__rommelblok.WD.inv.slice(0, 9), kies: window.__rommelblok.WD.kies, log: window.__rommelblok.ACTIES.log.slice(-2) }))));
  goed(bouwOk, 'A bouwt met planken, B ziet ze');
  // iets weggooien: het vliegt weg en A pakt het niet meteen zelf weer op
  const gooi = await R(A, async () => {
    const R = window.__rommelblok, tel = () => R.WD.inv.reduce((n, s) => n + (s && s.id === R.G.B.planken_eik ? s.n : 0), 0), voor = tel();
    R.kijk(R.sp.yaw, 0.2); R.gooiWeg(false);
    for (let i = 0; i < 30 && !R.losse.some(d => d.sid > 0); i++) await new Promise(r => setTimeout(r, 100));
    const d = R.losse.find(x => x.sid > 0); if (!d) return null;
    for (let i = 0; i < 4; i++) R.sim(2, 0.05); // 0,4 seconde
    return { voor, na: tel(), ligt: R.losse.some(x => x.sid === d.sid), v: Math.hypot(d.vx, d.vz) };
  });
  goed(!!gooi && gooi.na === gooi.voor - 1 && gooi.ligt, 'A gooit een plank weg: hij ligt op de grond en vliegt niet meteen terug in de rugzak' + (gooi ? ' (' + JSON.stringify(gooi) + ')' : ''));

  // B loopt een stukje weg, naar vrije grond (in een rechte lijn, niet door een heuvel): de server mag hem niet terugzetten
  const correcties = await R(B, () => window.__ber.filter(m => m.t === 'plek').length);
  const weg = await R(B, () => {
    const R = window.__rommelblok, x0 = R.sp.x, y0 = Math.floor(R.sp.y), z0 = R.sp.z, vrij = (x, y, z) => { const v = R.blokOp(Math.floor(x), y, Math.floor(z)); return v === 0 || (v > 0 && !R.G.VAST[v & 255]); };
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4, dx = -Math.sin(a), dz = -Math.cos(a);
      let goed = true; for (let d = 0.5; d <= 3.5 && goed; d += 0.25) goed = vrij(x0 + dx * d, y0, z0 + dz * d) && vrij(x0 + dx * d, y0 + 1, z0 + dz * d);
      const x = x0 + dx * 3.5, z = z0 + dz * 3.5, onder = R.blokOp(Math.floor(x), y0 - 1, Math.floor(z));
      if (goed && onder > 0 && R.G.VAST[onder & 255]) { R.zet(x, y0 + 0.02, z); return [x, y0, z]; }
    }
    return null;
  });
  await B.page.waitForTimeout(1200);
  goed(!!weg && await R(B, n => window.__ber.filter(m => m.t === 'plek').length === n, correcties), 'B loopt een stukje over vrije grond: de server laat dat toe (geen terugzetting)');
  // echt lopen en rennen (met springen over heuveltjes), in gewone tijd: 8 seconden, en de server zet B niet één keer terug
  const loopVan = await R(B, () => { const R = window.__rommelblok; return [R.sp.x, R.sp.z]; });
  // onderweg: ziet A het poppetje van B met zijn gezicht naar voren (de ogen van het model in de richting waarin B kijkt en loopt)?
  const kopVoor = yaw => {
    const R = window.__rommelblok, o = [...R.samen.spelers.values()][0]; if (!o || !o.buf.length) return 'geen B';
    const b = o.buf[o.buf.length - 1], voor = [-Math.sin(yaw), -Math.cos(yaw)];
    const e = R.tekenLijst().filter(e => !/^(wz:|bw_|kar$)/.test(e.model)).sort((p, q) => Math.hypot(p.x - b[1], p.z - b[3]) - Math.hypot(q.x - b[1], q.z - b[3]))[0];
    const og = e && (R.R.modelDelen(e.model) || []).find(d => d.naam === 'ogen'); if (!og) return 'model ' + (e && e.model);
    let x = 0, z = 0; for (const q of og.dozen) { x += (q[0] + q[3]) / 2 / og.dozen.length; z += (q[2] + q[5]) / 2 / og.dozen.length; }
    const wx = x * Math.cos(e.yaw) + z * Math.sin(e.yaw), wz = -x * Math.sin(e.yaw) + z * Math.cos(e.yaw);
    return (wx * voor[0] + wz * voor[1]) / Math.hypot(wx, wz);
  };
  const koppen = [];
  for (let i = 0; i < 80; i++) {
    await R(B, i => { const R = window.__rommelblok; R.kijk(i < 40 ? 0.4 : 0.4 + Math.PI / 2, 0); R.sim(2, 0.05, { voor: 1, rent: i % 20 > 5, spring: i % 7 === 0 }); R.samenTik(0.1, R.camVorige); }, i);
    await B.page.waitForTimeout(100);
    if (i === 30 || i === 70) koppen.push(await R(A, kopVoor, await R(B, () => window.__rommelblok.sp.yaw)));
  }
  goed(koppen.every(k => k > 0.8), 'A ziet het poppetje van B met zijn gezicht naar voren lopen (' + koppen.map(k => typeof k === 'number' ? (k * 100).toFixed(0) + '%' : k).join(', ') + ')');
  const gelopen = await R(B, p => { const R = window.__rommelblok; return Math.hypot(R.sp.x - p[0], R.sp.z - p[1]); }, loopVan);
  await B.page.waitForTimeout(500);
  goed(gelopen > 15 && await R(B, n => window.__ber.filter(m => m.t === 'plek').length === n, correcties), 'B loopt en rent ' + gelopen.toFixed(0) + ' blokken over het land: de server zet hem nergens terug');

  // ---------------- praten
  await R(B, () => window.__rommelblok.samenZeg(0));
  // (in deze trage testomgeving komen er weinig beeldjes, en zit de browser soms even vast: daarom het berichtje en de ballon
  // in één keer nakijken, en A meteen naar B laten kijken en de naamkaartjes bijwerken)
  const praat = () => {
    if (!/Hoi!/.test(document.getElementById('rb-praat').textContent)) return false;
    const R = window.__rommelblok, o = [...R.samen.spelers.values()][0]; if (!o || !o.buf.length) return false;
    const b = o.buf[o.buf.length - 1]; o.x = b[1]; o.y = b[2]; o.z = b[3];
    // naar het naamkaartje van B kijken (ook als B vlak naast A staat)
    R.kijk(Math.atan2(-(o.x - R.sp.x), -(o.z - R.sp.z)), Math.max(-1.4, Math.min(1.4, Math.atan2(o.y + 2.15 - (R.sp.y + 1.62), Math.hypot(o.x - R.sp.x, o.z - R.sp.z))))); R.samenNamen(R.maakCamera(0, 0));
    window.__ballon = !!o.el && !o.el.hidden && !o.el.lastChild.hidden && o.el.lastChild.textContent === 'Hoi!';
    window.__ballonInfo = { el: !!o.el, hidden: o.el && o.el.hidden, bal: o.el && o.el.lastChild.hidden, txt: o.el && o.el.lastChild.textContent, ballon: o.ballon, nu: performance.now(), p: R.samenOpScherm(R.maakCamera(0, 0), o.x, o.y + 2.15, o.z), pos: [o.x, o.y, o.z], sp: [R.sp.x, R.sp.y, R.sp.z], klaar: R.klaar, scherm: document.querySelectorAll('.rb-scherm:not([hidden])').length };
    return true;
  };
  goed(await wacht(A, praat, null, 20000), 'B zegt "Hoi!", A leest het');
  if (!(await R(A, () => window.__ballon))) console.log(JSON.stringify(await R(A, () => window.__ballonInfo)));
  goed(await R(A, () => window.__ballon), 'en ziet het als tekstballon boven B');
  await A.page.screenshot({ path: path.join(UIT, 'samen-praten.png'), timeout: 60000 });
  await R(A, () => { for (const o of window.__rommelblok.samen.spelers.values()) o.stil = true; });
  await B.page.waitForTimeout(2200);
  await R(B, () => window.__rommelblok.samenZeg(3));
  await A.page.waitForTimeout(800);
  goed(!(await R(A, () => /Dank je!/.test(document.getElementById('rb-praat').textContent))), 'na dempen hoort A niets meer van B');
  // het zinnetjesscherm en het spelersscherm
  await R(B, () => window.__rommelblok.openZinnen());
  goed(await R(B, () => document.querySelectorAll('#rb-zinnen-lijst button').length === window.__rommelblok.G.SAMEN.ZINNEN.length), 'het zinnetjesscherm toont alle vaste zinnetjes');
  await B.page.screenshot({ path: path.join(UIT, 'samen-zinnen.png') });
  await B.page.keyboard.press('Escape');
  await R(A, () => window.__rommelblok.openSpelers());
  goed(await R(A, () => document.getElementById('rb-spelers-code').textContent === window.__rommelblok.samen.code && !document.getElementById('rb-spelers-eigenaar').hidden), 'de eigenaar ziet de code en zijn knoppen');
  await A.page.screenshot({ path: path.join(UIT, 'samen-spelers.png') });
  await A.page.keyboard.press('Escape');

  // ---------------- alleen de eigenaar mag bouwen
  await R(A, () => window.__rommelblok.samenStuur({ t: 'beheer', doe: 'bouwen', wie: 'eigenaar' }));
  goed(await wacht(B, () => window.__rommelblok.samen.mag === false), 'A zet bouwen op "Alleen ik": B mag niet meer bouwen');
  const terug = await R(B, async () => {
    const R = window.__rommelblok; R.kijk(R.sp.yaw, -1.3); R.sim(1, 0.001);
    const d = R.doel; if (!d) return null; const v = d.v; R.breek(d, false); return { x: d.x, y: d.y, z: d.z, v };
  });
  goed(!!terug && await wacht(B, d => window.__rommelblok.blokOp(d.x, d.y, d.z) === d.v, terug, 5000), 'B breekt toch iets: de server zet het terug');
  await R(A, () => window.__rommelblok.samenStuur({ t: 'beheer', doe: 'bouwen', wie: 'iedereen' }));

  // ---------------- telefoon
  if (C) {
    await C.page.waitForTimeout(800);
    const tel = await R(C, () => ({ breed: document.documentElement.scrollWidth, praat: getComputedStyle(document.getElementById('tk-praat')).display, wie: getComputedStyle(document.getElementById('tk-spelers')).display }));
    goed(tel.breed <= 360 && tel.praat !== 'none' && tel.wie !== 'none', 'op een telefoon: knoppen voor praten en spelers, niets steekt uit');
    await C.page.screenshot({ path: path.join(UIT, 'samen-telefoon.png') });
    await R(C, () => window.__rommelblok.openSpelers());
    await C.page.screenshot({ path: path.join(UIT, 'samen-telefoon-spelers.png') });
  }

  // ---------------- wegsturen
  const sidB = await R(B, () => window.__rommelblok.samen.jij);
  await R(A, sid => window.__rommelblok.samenStuur({ t: 'beheer', doe: 'weg-sturen', wie: sid }), sidB);
  goed(await wacht(B, () => !document.getElementById('rb-samen').hidden && /eigenaar heeft je/.test(document.getElementById('rb-samen-fout').textContent), null, 10000), 'A stuurt B weg: B staat weer bij Samen spelen, met uitleg');
  goed(await wacht(A, () => window.__rommelblok.samen.spelers.size === (window.DRIE ? 1 : 0), null, 5000) || DRIE, 'A ziet B weggaan');
  // A gaat netjes weg en komt terug: de wereld is zoals hij was
  await R(A, () => window.__rommelblok.naarWerelden());
  await A.page.waitForTimeout(500);
  await R(A, () => window.__rommelblok.openSamen());
  await A.page.click('#rb-samen-lijst .rb-wereld .rb-knop.rood');
  await wachtWereld(A);
  goed(await R(A, () => window.__rommelblok.samen.eigenaar), 'A komt terug in zijn wereld (vanuit de lijst), nog steeds als eigenaar');
  goed(await wacht(A, p => (window.__rommelblok.blokOp(p[0], p[1], p[2]) & 255) === window.__rommelblok.G.B.planken_eik, bouw), 'de planken staan er nog (bewaard op de server)');

  // ---------------- de server valt even weg: de pagina verbindt vanzelf opnieuw, en je houdt wat je had
  const invVoor = await R(A, () => JSON.stringify(window.__rommelblok.WD.inv));
  await R(A, () => { window.__oudeWs = window.__rommelblok.samen.ws; });
  herstart = true;
  await stopSrv();
  goed(await wacht(A, () => /kwijt/.test(document.getElementById('rb-melding').textContent), null, 8000), 'de server valt weg: A ziet dat de verbinding kwijt is');
  await startSrv();
  goed(await wacht(A, () => { const R = window.__rommelblok; return R.samen && R.samen.ws !== window.__oudeWs && R.samen.ws.readyState === 1 && R.klaar; }, null, 60000), 'na de herstart is A vanzelf weer verbonden');
  await A.page.waitForTimeout(1000); herstart = false;
  goed(await R(A, () => JSON.stringify(window.__rommelblok.WD.inv)) === invVoor && await R(A, () => window.__rommelblok.samen.eigenaar), 'met dezelfde rugzak, en nog steeds als eigenaar');
  goed(await wacht(A, p => (window.__rommelblok.blokOp(p[0], p[1], p[2]) & 255) === window.__rommelblok.G.B.planken_eik, bouw), 'en de planken staan er nog');

  // ---------------- geen fouten
  const alle = spelers.flatMap(s => s.fouten);
  goed(!alle.length, 'geen fouten in de console en geen CSP-overtredingen' + (alle.length ? ':\n  ' + alle.join('\n  ') : ''));
  await browser.close();
  await stopSrv();
  if (/Error|fout/i.test(serverLog.replace(/zonder beheer/, ''))) console.log('serverlog:\n' + serverLog);
  console.log(fouten ? 'samen spelen: ' + fouten + ' FOUT' : 'samen spelen: alles goed');
  process.exit(fouten ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

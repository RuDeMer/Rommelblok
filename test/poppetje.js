// Je poppetje en de drie camera's (stap 3): node test/poppetje.js [telefoon]
// - het poppetje staat klein in rommelblok-v3, wordt nagekeken, en blijft na opnieuw laden
// - het kiesscherm: tabbladen, keuzes, Verras me, Klaar; op een telefoon past alles op 360 punten breed
// - de camera's: van achteren en van voren nooit in een muur; in een smalle gang even door je ogen
// - richten: in alle drie de camera's hetzelfde blok
// - de arm in beeld heeft de huidskleur en de mouw van je poppetje
// Schermafbeeldingen in RB_UIT: pop-*.png
const { open, wachtKlaar } = require('./pw');
const path = require('path'), UIT = require('./uit');
const tel = process.argv[2] === 'telefoon';
const mis = []; const check = (ok, w) => { if (!ok) mis.push(w); };
(async () => {
  const ctx = tel ? { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : undefined;
  const b = await open({ q: 'test=1&zaad=777&stand=bouwen&straal=2', ctx });
  const { page } = b; await wachtKlaar(page);
  const foto = n => page.screenshot({ path: path.join(UIT, 'pop-' + (tel ? 'telefoon-' : '') + n + '.png') });
  // 1. de opslag
  const opslag = await page.evaluate(() => {
    const R = window.__rommelblok, P = R.POP;
    const s = localStorage.getItem('rommelblok-v3') || '';
    const v = []; for (let i = 0; i < 200; i++) { const p = P.verrasMe(Math.random); v.push(JSON.stringify(P.schoonPop(p)) === JSON.stringify(p)); }
    return { pop: R.opslag.pop, lengte: JSON.stringify(R.opslag.pop).length, schoon: [P.schoonPop(null), P.schoonPop([1, 99]), P.schoonPop('x'), P.schoonPop([1, 1, 0, 1, 0, 0, 0, 1, 7, 0, 10, 11, 0, 2.5])].map(p => p.join()),
      standaard: P.standaardPop(1).join(), verras: v.every(Boolean), v3: s.length };
  });
  console.log('opslag:', JSON.stringify(opslag));
  check(opslag.lengte < 60, 'het poppetje is te groot in de opslag: ' + opslag.lengte);
  check(opslag.schoon.every(p => p === opslag.standaard), 'een kapot poppetje wordt niet het standaardpoppetje');
  check(opslag.verras, 'Verras me gaf een poppetje dat niet klopt');
  // 2. het kiesscherm
  await page.evaluate(() => window.__rommelblok.openPop()); await page.waitForTimeout(700);
  check(await page.isVisible('#rb-pop'), 'het kiesscherm staat niet in beeld');
  await foto('kiesscherm');
  const tabs = await page.$$eval('#rb-pop-tabs [role=tab]', l => l.map(e => e.textContent));
  check(tabs.length === 4, 'niet vier tabbladen: ' + tabs.join(', '));
  for (const [tab, veld, rij] of [['kleren', 'boven', 1], ['gezicht', 'ogen', 1], ['spullen', 'acc', 1], ['huid', 'haar', 2]]) {
    await page.click('#rb-pop-tab-' + tab);
    const knoppen = await page.$$(`#rb-pop-keuzes .rb-pop-rij:nth-child(${rij}) .rb-keuzes button`);
    await knoppen[knoppen.length - 1].click(); await page.waitForTimeout(150);
    await foto('tab-' + tab);
    const w = await page.evaluate(v => window.__rommelblok.POP.popWaarde(window.__rommelblok.opslag.pop, v), veld);
    const n = await page.evaluate(v => window.__rommelblok.POP.POP_AANTAL[v], veld);
    check(w === n - 1, `tabblad ${tab}: ${veld} werd ${w} in plaats van ${n - 1}`);
  }
  // een kleur
  await page.click('#rb-pop-tab-kleren');
  await page.click('#rb-pop-keuzes .rb-pop-rij:nth-child(2) .rb-kleur:nth-child(5)');
  check(await page.evaluate(() => window.__rommelblok.POP.popWaarde(window.__rommelblok.opslag.pop, 'bovenKleur')) === 4, 'de kleur van je bovenkant veranderde niet');
  // telefoon: niets buiten het scherm, en het poppetje boven de keuzes
  const maat = await page.evaluate(() => {
    const p = document.querySelector('.rb-pop-paneel').getBoundingClientRect(), b = document.querySelector('#rb-pop-buhne').getBoundingClientRect();
    const knoppen = [...document.querySelectorAll('#rb-pop button')].filter(e => e.offsetParent).map(e => e.getBoundingClientRect());
    return { breed: innerWidth, scroll: document.documentElement.scrollWidth, paneel: [p.left, p.top, p.right, p.bottom], buhne: [b.left, b.top, b.right, b.bottom], buiten: knoppen.filter(r => r.left < -1 || r.right > innerWidth + 1).length, klein: knoppen.filter(r => r.width < 30 || r.height < 26).length };
  });
  console.log('maten:', JSON.stringify(maat));
  check(maat.scroll <= maat.breed, 'de pagina is breder dan het scherm');
  check(!maat.buiten, maat.buiten + ' knoppen buiten het scherm');
  check(!maat.klein, maat.klein + ' knoppen te klein om op te tikken');
  if (tel) check(maat.buhne[3] <= maat.paneel[1] + 1, 'op een telefoon staat het poppetje niet boven de keuzes');
  else check(maat.buhne[2] <= maat.paneel[0] + 13, 'op een computer staat het poppetje niet naast de keuzes');
  // het poppetje is echt getekend: midden in het vrije stuk zijn pixels anders dan de lucht
  const beeld = await page.evaluate(() => new Promise(ok => requestAnimationFrame(() => {
    const d = document.getElementById('rb-doek'), r = document.getElementById('rb-pop-buhne').getBoundingClientRect(), s = d.width / d.getBoundingClientRect().width;
    const c = document.createElement('canvas'); c.width = d.width; c.height = d.height; const g = c.getContext('2d'); g.drawImage(d, 0, 0);
    const x = Math.round((r.left + r.width / 2) * s), y = Math.round((r.top + r.height / 2) * s), h = g.getImageData(x, 0, 1, d.height).data;
    // per rij: het midden van het vrije stuk tegen de lucht aan de rand ervan
    const rand = g.getImageData(Math.round((r.left + 4) * s), 0, 1, d.height).data;
    let anders = 0; for (let i = 0; i < d.height; i++) { const k = i * 4; if (Math.abs(h[k] - rand[k]) + Math.abs(h[k + 1] - rand[k + 1]) + Math.abs(h[k + 2] - rand[k + 2]) > 60) anders++; }
    ok({ anders, hoog: d.height, x, y });
  })));
  console.log('poppetje in beeld:', JSON.stringify(beeld));
  check(beeld.anders > beeld.hoog * 0.08, 'geen poppetje te zien in het kiesscherm');
  // Verras me
  const voor = await page.evaluate(() => window.__rommelblok.opslag.pop.join());
  await page.click('#rb-pop-verras'); await page.waitForTimeout(400);
  const na = await page.evaluate(() => window.__rommelblok.opslag.pop.join());
  await foto('verras');
  check(voor !== na, 'Verras me veranderde niets');
  await page.click('#rb-pop-klaar'); await page.waitForTimeout(200);
  check(!(await page.isVisible('#rb-pop')), 'Klaar sluit het kiesscherm niet');
  // bewaard?
  const bewaard = await page.evaluate(() => JSON.parse(localStorage.getItem('rommelblok-v3')).pop.join());
  check(bewaard === na, 'het poppetje is niet bewaard');
  // 3. de arm in beeld: huid en mouw van het poppetje
  const arm = await page.evaluate(() => { const R = window.__rommelblok, h = {}; R.popArm(h); return { huid: h.huid.map(v => v.toFixed(3)).join(), mouw: !!h.mouw, kort: h.kort, boven: R.POP.POP_KEUZES.boven[R.POP.popWaarde(R.opslag.pop, 'boven')][0], huidHex: R.POP.POP_HUID[R.POP.popWaarde(R.opslag.pop, 'huid')] }; });
  const hx = arm.huidHex, hk = [1, 3, 5].map(i => (parseInt(hx.slice(i, i + 2), 16) / 255).toFixed(3)).join();
  check(arm.huid === hk, 'de arm heeft niet de huidskleur van het poppetje');
  check(arm.kort === !['trui', 'hoodie', 'jasje'].includes(arm.boven), 'korte of lange mouw klopt niet bij ' + arm.boven);
  // 4. de camera's, op een open plek
  const plek = await page.evaluate(async () => {
    const R = window.__rommelblok, s = R.sp;
    // een open vlakte maken: een vloer, en daarboven niets
    const X = Math.floor(s.x), Y = Math.floor(s.y) + 20, Z = Math.floor(s.z);
    for (let x = -8; x <= 8; x++) for (let z = -8; z <= 8; z++) { R.zetBlok(X + x, Y - 1, Z + z, R.G.B.steen); for (let y = 0; y < 8; y++) R.zetBlok(X + x, Y + y, Z + z, 0); }
    s.vliegt = false; R.zet(X + 0.5, Y, Z + 0.5); R.kijk(0, -0.3);
    await new Promise(r => setTimeout(r, 600));
    return [X, Y, Z];
  });
  const meet = m => page.evaluate(async m => {
    const R = window.__rommelblok; R.wisselCamera(m);
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const c = R.camPlek, o = R.oogVorige, v = R.blokOp(Math.floor(c[0]), Math.floor(c[1]), Math.floor(c[2]));
    // wat onder het kruisje ligt: van achteren de straal vanaf je schouder (die loopt door het midden van het beeld), anders vanaf je ogen
    const k = R.kijkVector(), van = R.camBeeld() === 1 ? R.camSchouder : o, verwacht = R.richt(van, k, R.BEREIK());
    const lijn = R.camBeeld() === 1 ? (() => { const w = [van[0] - c[0], van[1] - c[1], van[2] - c[2]], t = w[0] * k[0] + w[1] * k[1] + w[2] * k[2]; return Math.hypot(w[0] - k[0] * t, w[1] - k[1] * t, w[2] - k[2] * t); })() : 0;
    return { beeld: R.camBeeld(), afstand: Math.hypot(c[0] - o[0], c[1] - o[1], c[2] - o[2]), inMuur: v < 0 || !!R.G.DICHT[v & 255], doel: R.doel ? [R.doel.x, R.doel.y, R.doel.z].join() : null,
      verwacht: verwacht ? [verwacht.x, verwacht.y, verwacht.z].join() : null, lijn: +lijn.toFixed(4), schouder: R.camBeeld() === 1 ? +Math.hypot(van[0] - o[0], van[2] - o[2]).toFixed(2) : 0,
      voor: document.body.classList.contains('rb-cam-voor'), kruis: getComputedStyle(document.querySelector('.rb-kruis')).display };
  }, m);
  // richten op een muurtje van steen voor je
  await page.evaluate(p => { const R = window.__rommelblok; for (let x = -1; x <= 1; x++) for (let y = 0; y < 2; y++) R.zetBlok(p[0] + x, p[1] + y, p[2] - 5, R.G.B.steen); R.kijk(0, -0.05); }, plek);
  await page.waitForTimeout(300);
  const cams = [];
  for (const m of [0, 1, 2]) { cams.push(await meet(m)); await page.waitForTimeout(250); await foto('camera-' + m); }
  console.log('camera\'s open:', JSON.stringify(cams));
  check(cams[1].beeld === 1 && cams[1].afstand > 3, 'van achteren staat de camera niet achter je');
  check(cams[2].beeld === 2 && cams[2].afstand > 3, 'van voren staat de camera niet voor je');
  check(cams.every(c => !c.inMuur), 'de camera staat in een blok');
  check(cams.every(c => c.doel && c.doel === c.verwacht), 'richten geeft niet het blok onder het kruisje: ' + cams.map(c => c.doel + '/' + c.verwacht).join(' | '));
  check(cams[2].doel === cams[0].doel, 'van voren richt je niet op hetzelfde blok als door je ogen');
  check(cams[1].lijn < 0.01 && cams[1].schouder > 0.4, 'van achteren loopt het midden van het beeld niet langs je schouder');
  check(cams[2].voor && cams[2].kruis === 'none' && !cams[1].voor, 'van voren hoort het kruisje weg te zijn (en alleen dan)');
  // in een smalle gang: muren om je heen, de camera past er niet achter
  await page.evaluate(p => { const R = window.__rommelblok; for (let y = 0; y < 3; y++) for (const [dx, dz] of [[0, 1], [1, 0], [-1, 0], [1, 1], [-1, 1]]) R.zetBlok(p[0] + dx, p[1] + y, p[2] + dz, R.G.B.steen); R.zetBlok(p[0], p[1] + 2, p[2], R.G.B.steen); R.kijk(0, 0); }, plek);
  await page.waitForTimeout(300);
  const gang = [await meet(1), await meet(2)];
  console.log('in een smalle gang:', JSON.stringify(gang));
  await foto('gang');
  check(gang.every(c => !c.inMuur), 'in een gang staat de camera in de muur');
  check(gang[0].beeld === 0 || gang[0].afstand >= 0.8, 'van achteren in een gang: te dichtbij en toch niet door je ogen');
  await page.evaluate(() => window.__rommelblok.wisselCamera(1));
  // 5. de V-toets wisselt
  const v = [];
  for (let i = 0; i < 3; i++) { await page.keyboard.press('KeyV'); v.push(await page.evaluate(() => window.__rommelblok.inst.camera)); }
  check(v.join() === '2,0,1', 'V wisselt niet rond: ' + v.join());
  if (tel) {
    const kb = await page.$('#tk-camera'); check(!!kb && await kb.isVisible(), 'geen cameraknop op een telefoon');
    if (kb) { await kb.tap(); check(await page.evaluate(() => window.__rommelblok.inst.camera) === 2, 'de cameraknop wisselt niet'); }
  }
  // 6. na opnieuw laden: zelfde poppetje en zelfde camera
  const cam = await page.evaluate(() => window.__rommelblok.inst.camera);
  await page.reload(); await wachtKlaar(page);
  const terug = await page.evaluate(() => ({ pop: window.__rommelblok.opslag.pop.join(), cam: window.__rommelblok.inst.camera }));
  check(terug.pop === na && terug.cam === cam, 'na opnieuw laden is het poppetje of de camera anders');
  // het kiesscherm vanaf het beginscherm, en in het Engels
  await page.evaluate(() => { localStorage.setItem('rommelblok-taal', 'en'); }); await page.goto(b.url.split('?')[0]); await page.waitForSelector('#rb-begin:not([hidden])');
  await page.click('#rb-begin-pop'); await page.waitForTimeout(600);
  await foto('beginscherm-en');
  const en = await page.$$eval('#rb-pop-tabs [role=tab]', l => l.map(e => e.textContent).join(','));
  check(en === 'Skin and hair,Face,Clothes,Things', 'tabbladen niet in het Engels: ' + en);
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  check(await page.isVisible('#rb-begin'), 'Escape brengt je niet terug op het beginscherm');
  console.log(mis.length ? 'MIS: ' + mis.join(' | ') : 'poppetje en camera\'s: alles goed' + (tel ? ' (telefoon)' : ''));
  console.log(b.fouten.join('\n') || 'geen fouten'); await b.sluit();
  process.exit(mis.length || b.fouten.length ? 1 : 0);
})();

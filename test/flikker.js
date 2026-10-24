// Geen geflikker, een rustig kader en spooklicht (browser): node test/flikker.js
// 1. Een blok bladeren van dichtbij: twee beeldjes met de camera een haartje verschoven (zelfde tijd, dus zonder wind)
//    mogen bijna niet verschillen. Vroeger lagen tussen twee bladblokken twee vlakken op dezelfde plek die om voorrang
//    vochten: dan klapten hele stukken om.
// 2. Brokjes: ze beginnen nooit in een vast blok, zijn nooit zwart als het er licht is, en liggen op de grond in
//    plaats van erin te steken.
// 3. Het kader om een blok: in het donker zacht (niet fel wit), in het licht goed te zien; de pagina geeft het licht
//    ter plekke mee.
// 4. Een spookje verlicht de muur om zich heen.
const { open, wachtKlaar } = require('./pw');
const mis = []; const check = (ok, w) => { console.log((ok ? 'goed ' : 'FOUT ') + w); if (!ok) mis.push(w); };
(async () => {
  const b = await open({ q: 'test=1&zaad=777&stand=bouwen&straal=2&x=51&z=-41&tijd=0.5', ctx: { viewport: { width: 640, height: 400 } } });
  const { page, fouten } = b; await wachtKlaar(page); await page.waitForTimeout(1500);
  const plek = await page.evaluate(() => {
    const R = window.__rommelblok, B = R.G.B, X = Math.floor(R.sp.x), Y = Math.floor(R.sp.y) + 40, Z = Math.floor(R.sp.z);
    for (let x = -2; x <= 12; x++) for (let y = -2; y <= 6; y++) for (let z = -6; z <= 6; z++) R.zetBlok(X + x, Y + y, Z + z, 0);
    // een blok bladeren met wat gaten en een paar lampen erin: het licht en de schaduw verschillen per blad, zoals in een echte
    // boom, en dan worden de vlakken tussen twee bladeren anders samengevoegd (dat gaf het gevecht om voorrang)
    for (let x = 4; x <= 9; x++) for (let y = -1; y <= 3; y++) for (let z = -3; z <= 3; z++) R.zetBlok(X + x, Y + y, Z + z, ((x * 7 + y * 13 + z * 5) % 11 === 0) ? 0 : B.blad_eik);
    for (const [x, y, z] of [[5, 0, -1], [7, 2, 1], [8, -1, 2], [6, 1, 3]]) R.zetBlok(X + x, Y + y, Z + z, B.spooklamp);
    R.sp.vliegt = true; R.zet(X + 1.3, Y + 0.9 - R.sp.oog, Z + 0.7); R.kijk(-Math.PI / 2 + 0.25, -0.12);
    return [X, Y, Z];
  });
  await page.evaluate(() => window.__rommelblok.wb({ t: 'water', n: 1 })); await page.waitForTimeout(4000);
  if (process.env.FOTO) await page.screenshot({ path: process.env.FOTO });
  // ---------- 1. bladeren
  const flip = await page.evaluate(() => {
    const R = window.__rommelblok, gl = R.R.gl, w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
    R.tekenUit = true;
    const lees = () => { const a = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, a); return a; };
    const uit = [];
    let vorige = null;
    for (let i = 0; i < 6; i++) {
      R.proefBeeld(i * 0.0006, i * 0.0003, -i * 0.0004); const a = lees();
      if (vorige) { let om = 0, n = 0; for (let y = h * 0.2 | 0; y < h * 0.8; y++) for (let x = w * 0.2 | 0; x < w * 0.8; x++) { const k = (y * w + x) * 4; n++; if (Math.abs(a[k] - vorige[k]) + Math.abs(a[k + 1] - vorige[k + 1]) + Math.abs(a[k + 2] - vorige[k + 2]) > 60) om++; } uit.push(om / n); }
      vorige = a;
    }
    R.tekenUit = false;
    return uit;
  });
  const gem = flip.reduce((a, x) => a + x, 0) / flip.length;
  console.log('  bladeren: omgeklapte pixels per beeldje ' + flip.map(x => (x * 100).toFixed(2) + '%').join(', '));
  check(gem < 0.02, 'bladeren flikkeren niet bij een piepkleine camerabeweging (gemiddeld ' + (gem * 100).toFixed(2) + '% van het beeld)');
  // van elk kubusvlak van bladeren alleen de voorkant: met de camera midden in een los bladblok zie je dan alleen
  // achterkanten, dus niets van dat blok. (Zo zie je ook tussen twee bladblokken maar één van de twee vlakken.)
  const binnen = await page.evaluate(([X, Y, Z]) => new Promise(ok => {
    const R = window.__rommelblok, B = R.G.B, gl = R.R.gl, w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
    // het deel van het midden van het beeld dat groen blad is
    const blad = () => { const a = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, a); let n = 0, g = 0; for (let y = h * 0.2 | 0; y < h * 0.8; y++) for (let x = w * 0.2 | 0; x < w * 0.7; x++) { const k = (y * w + x) * 4; n++; if (a[k + 1] - a[k + 2] > 50) g++; } return g / n; };
    const bx = X - 1, by = Y + 2, bz = Z - 6;
    for (let x = -3; x <= 3; x++) for (let y = -3; y <= 3; y++) for (let z = -3; z <= 3; z++) R.zetBlok(bx + x, by + y, bz + z, 0);
    R.zetBlok(bx, by, bz, B.blad_eik);
    setTimeout(() => {
      R.zet(bx + 0.5, by + 0.5 - R.sp.oog, bz + 0.5); R.kijk(0.4, 0.3);
      setTimeout(() => { R.tekenUit = true; R.proefBeeld(0, 0, 0); const erin = blad(); R.proefBeeld(0.74, -0.6, 1.76); const ervoor = blad(); R.tekenUit = false; ok({ erin, ervoor }); }, 800);
    }, 3000);
  }), plek);
  console.log('  een los bladblok: blad in beeld van binnenuit ' + (binnen.erin * 100).toFixed(0) + '%, ervoor ' + (binnen.ervoor * 100).toFixed(0) + '%');
  check(binnen.erin < 0.05 && binnen.ervoor > 0.15, 'van een bladblok teken je alleen de voorkant van elk vlak (van binnenuit zie je er niets van)');
  // ---------- 2. brokjes
  const brok = await page.evaluate(([X, Y, Z]) => {
    const R = window.__rommelblok, B = R.G.B, VAST = R.G.VAST;
    for (let x = -2; x <= 3; x++) for (let z = -6; z <= 6; z++) R.zetBlok(X + x, Y - 1, Z + z, B.steen); // een vloer
    R.zetBlok(X + 2, Y, Z, B.steen);
    const dp = R.deeltjes; dp.length = 0;
    // hakken op de westkant van het blok (normaal -x), en een blok dat helemaal breekt
    for (let i = 0; i < 40; i++) R.brokjes(X + 2, Y, Z, B.steen, 3, { p: [X + 2, Y + 0.2 + Math.random() * 0.6, Z + 0.2 + Math.random() * 0.6], n: [-1, 0, 0] });
    R.brokjes(X, Y, Z + 3, B.blad_eik, 20);
    for (const p of dp) p.max = 5; // lang genoeg om te landen
    const inBlok = p => { const v = R.blokOp(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)); return v > 0 && VAST[v & 255]; };
    let begin = dp.filter(inBlok).length, ooitIn = 0, zwart = 0, gemeten = 0, steekt = 0, groen = 0;
    for (let t = 0; t < 70; t++) {
      R.deeltjesTik(1 / 60);
      ooitIn += dp.filter(inBlok).length;
    }
    // de getallen die naar de tekenaar gaan (9 per brokje): licht op plek 7, kleur op plek 8
    const n = R.deeltjesTik(0.0001), D = R.tekenExtra(0.0001, { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 }).deeltjes.a;
    for (let i = 0; i < dp.length; i++) { gemeten++; if (D[i * 9 + 7] === 0) zwart++; if (D[i * 9 + 8] > 0) groen++; }
    const rust = dp.filter(p => p.rust), opVloer = rust.filter(p => Math.abs((p.y - p.s * 0.5) - Y) < 0.01).length;
    return { begin, ooitIn, zwart, gemeten, rust: rust.length, opVloer, groen, blad: dp.filter(p => p.k).length };
  }, plek);
  console.log('  brokjes: ' + brok.begin + ' begonnen in een vast blok, ' + brok.ooitIn + ' keer erin geweest; zwart ' + brok.zwart + ' van ' + brok.gemeten + '; liggend ' + brok.rust + ', waarvan op de vloer ' + brok.opVloer + '; met kleur ' + brok.groen);
  check(brok.begin === 0 && brok.ooitIn === 0, 'brokjes zitten nooit in een vast blok');
  check(brok.zwart === 0, 'brokjes zijn nooit zwart in het licht');
  check(brok.rust > 0 && brok.opVloer === brok.rust, 'liggende brokjes liggen precies op de vloer');
  check(brok.groen > 0, 'brokjes van bladeren hebben de kleur van bladeren');
  // ---------- 3. het kader
  const kader = await page.evaluate(([X, Y, Z]) => {
    const R = window.__rommelblok, B = R.G.B, gl = R.R.gl, w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
    // een donker hok: een blok steen om naar te kijken, midden in beeld
    for (let x = -1; x <= 3; x++) for (let y = -1; y <= 3; y++) for (let z = -2; z <= 2; z++) R.zetBlok(X + 20 + x, Y + y, Z + z, (x === -1 || x === 3 || y === -1 || y === 3 || Math.abs(z) === 2) ? B.steen : 0);
    R.zetBlok(X + 22, Y + 1, Z, B.steen);
    R.zet(X + 20.5, Y + 1.5 - R.sp.oog, Z + 0.5); R.kijk(-Math.PI / 2, 0);
    return [X + 22, Y + 1, Z];
  }, plek);
  await page.evaluate(() => { window.__rommelblok.tijd(0.0); window.__rommelblok.wb({ t: 'water', n: 1 }); }); await page.waitForTimeout(4000);
  const k = await page.evaluate(([x, y, z]) => {
    const R = window.__rommelblok, gl = R.R.gl, w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
    const ex = R.tekenExtra(0.0001, { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 }), lichtHier = ex.kader ? ex.kader.licht : -1;
    R.tekenUit = true;
    const fel = licht => { R.proefBeeld(0, 0, 0, { kader: { dozen: [[x, y, z, x + 1, y + 1, z + 1]], barst: -1, licht } }); const a = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, a); let m = 0; for (let i = 0; i < a.length; i += 4) m = Math.max(m, a[i] + a[i + 1] + a[i + 2]); return m / 3; };
    R.proefBeeld(0, 0, 0, {}); const a0 = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, a0); let m0 = 0; for (let i = 0; i < a0.length; i += 4) m0 = Math.max(m0, a0[i] + a0[i + 1] + a0[i + 2]);
    const donker = fel(0), licht = fel(1);
    R.tekenUit = false;
    return { lichtHier, zonder: m0 / 3, donker, licht };
  }, kader);
  console.log('  kader: licht ter plekke ' + k.lichtHier.toFixed(2) + '; felste pixel zonder kader ' + k.zonder.toFixed(0) + ', met kader in het donker ' + k.donker.toFixed(0) + ', in het licht ' + k.licht.toFixed(0));
  check(k.lichtHier >= 0 && k.lichtHier < 0.2, 'in een donker hok geeft de pagina weinig licht mee aan het kader');
  check(k.donker > k.zonder + 8 && k.donker < 80, 'in het donker is het kader te zien, maar niet fel');
  check(k.licht > k.donker + 30, 'in het licht is het kader duidelijk lichter');
  // ---------- 4. spooklicht
  const spook = await page.evaluate(([x, y, z]) => {
    const R = window.__rommelblok, gl = R.R.gl, w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
    const gem = extra => { R.proefBeeld(0, 0, 0, extra); const a = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, a); let s = 0; for (let i = 0; i < a.length; i += 4) s += a[i] + a[i + 1] + a[i + 2]; return s / (a.length / 4) / 3; };
    R.tekenUit = true;
    const zonder = gem({}), met = gem({ punten: [[x - 1, y + 0.5, z + 0.5, 5.5]] });
    // en de pagina geeft echte spookjes door
    const g = R.WZ.nieuwWezen(R.WZ.WI.spookje, x - 1, y, z + 0.5, 0); R.griezels.push(g);
    const n = R.spookLichten().length; R.griezels.splice(R.griezels.indexOf(g), 1);
    R.tekenUit = false;
    return { zonder, met, n };
  }, kader);
  console.log('  spooklicht: gemiddelde helderheid zonder spook ' + spook.zonder.toFixed(1) + ', met spook ' + spook.met.toFixed(1) + '; spookjes met licht: ' + spook.n);
  check(spook.met > spook.zonder * 2 && spook.met > spook.zonder + 8, 'een spookje verlicht de muren om zich heen');
  check(spook.n === 1, 'de pagina geeft het licht van spookjes door aan de tekenaar');
  check(!fouten.length, 'geen fouten in de console' + (fouten.length ? ': ' + fouten.join(' ') : ''));
  await b.sluit();
  console.log(mis.length ? mis.length + ' FOUTEN' : 'beeld: alles goed');
  process.exit(mis.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

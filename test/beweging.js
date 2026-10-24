// Bewegen in de wereld (browser): node test/beweging.js
// 1. Springen: bij elk tempo van beeldjes (30 tot 500 per seconde), met de spatiebalk ingedrukt, springt de speler alleen
//    vanaf de grond: nooit in de lucht, en per sprong maar één keer (ook tegen een muur en naast een traptrede).
// 2. Klimop: langs een muur met klimop klim je omhoog (vooruit lopen of springen), sluipen houdt je op je plek, en
//    loslaten laat je langzaam zakken. Net als bij een ladder.
// 3. Spinnenweb: je loopt er heel langzaam doorheen, en je valt er langzaam doorheen.
// 4. Tapijt en mostapijt: in een gang van twee blokken hoog loop je over een tapijtje van één pixel heen, zonder te springen,
//    en je past er staand onder het plafond.
// 5. Waterlelie: je kunt erop staan, op het water.
const { open, wachtKlaar } = require('./pw');
// in de pagina: R.stap(dt, invoer) met alle velden van de invoer ingevuld
const HULP = () => { const R = window.__rommelblok; R.stap = (dt, i) => R.beweeg(dt, Object.assign({ voor: 0, opzij: 0, spring: false, sluip: false, rent: false, omhoog: false, omlaag: false }, i || {})); };
const mis = []; const check = (ok, w) => { console.log((ok ? 'goed ' : 'FOUT ') + w); if (!ok) mis.push(w); };
(async () => {
  const b = await open({ q: 'test=1&zaad=777&stand=bouwen&straal=2&x=51&z=-41&tijd=0.5', ctx: { viewport: { width: 640, height: 400 } } });
  const { page, fouten } = b; await wachtKlaar(page); await page.waitForTimeout(1500); await page.evaluate(HULP);
  // een proefterrein hoog in de lucht: een vloer van steen op Y, met wat er per proef bij komt
  const basis = await page.evaluate(() => {
    const R = window.__rommelblok, B = R.G.B, X = Math.floor(R.sp.x), Y = Math.floor(R.sp.y) + 30, Z = Math.floor(R.sp.z);
    for (let x = -6; x <= 14; x++) for (let z = -6; z <= 6; z++) { R.zetBlok(X + x, Y, Z + z, B.steen); for (let y = 1; y <= 6; y++) R.zetBlok(X + x, Y + y, Z + z, 0); }
    R.sp.vliegt = false; R.tekenUit = true;
    return [X, Y, Z];
  });
  // ---------- 1. springen
  const sprong = await page.evaluate(([X, Y, Z]) => {
    const R = window.__rommelblok, B = R.G.B, sp = R.sp, uit = [];
    // een muur aan de -x kant en een traptrede ernaast
    for (let y = 1; y <= 3; y++) for (let z = -2; z <= 2; z++) R.zetBlok(X - 2, Y + y, Z + z, B.steen);
    R.zetBlok(X + 3, Y + 1, Z, B.plaat_kei);
    const plekken = [['vrij', X + 0.5, Z + 3.5, {}], ['tegen een muur', X - 0.69, Z + 0.5, { voor: 1 }], ['naast een trede', X + 2.69, Z + 0.5, {}]];
    for (const dt of [1 / 30, 1 / 60, 1 / 144, 1 / 240, 1 / 500]) for (const [naam, px, pz, extra] of plekken) {
      R.zet(px, Y + 1.02, pz); R.kijk(naam === 'tegen een muur' ? Math.PI / 2 : 0, 0); sp.vliegt = false;
      for (let i = 0; i < 2 / dt; i++) R.beweeg(dt, { voor: 0, opzij: 0, spring: false, sluip: false, rent: false });
      let inLucht = 0, sprongen = 0, landingen = 0, grondVoor = sp.opGrond, maxH = 0;
      const inv = Object.assign({ voor: 0, opzij: 0, spring: true, sluip: false, rent: false }, extra);
      for (let i = 0; i < 3 / dt; i++) {
        const n0 = sp.sprongen, y0 = sp.y, g0 = sp.opGrond;
        R.beweeg(dt, inv);
        maxH = Math.max(maxH, sp.y - (Y + 1));
        if (sp.sprongen > n0) { sprongen++; if (!(g0 && y0 - (Y + 1) < 0.06)) inLucht++; }
        if (sp.opGrond && !grondVoor) landingen++;
        grondVoor = sp.opGrond;
      }
      uit.push({ dt: Math.round(1 / dt), naam, sprongen, landingen, inLucht, maxH: +maxH.toFixed(2) });
    }
    return uit;
  }, basis);
  for (const s of sprong) console.log('  ' + String(s.dt).padStart(3) + ' beeldjes/s, ' + s.naam.padEnd(15) + ' sprongen ' + s.sprongen + ', landingen ' + s.landingen + ', in de lucht ' + s.inLucht + ', hoogte ' + s.maxH);
  check(sprong.every(s => s.inLucht === 0), 'springen in de lucht kan nooit (bij elk tempo, tegen een muur en naast een trede)');
  check(sprong.every(s => s.sprongen >= 3 && s.sprongen <= s.landingen + 1), 'met de spatiebalk ingedrukt: één sprong per landing');
  const hoog = sprong.map(s => s.maxH);
  check(Math.max(...hoog) - Math.min(...hoog) < 0.12 && Math.min(...hoog) > 1.15, 'elke sprong is even hoog, bij elk tempo (' + Math.min(...hoog) + ' tot ' + Math.max(...hoog) + ' blok)');
  // ---------- 2. klimop
  const klim = await page.evaluate(([X, Y, Z]) => {
    const R = window.__rommelblok, B = R.G.B, sp = R.sp, dt = 1 / 60, X0 = X + 8;
    for (let y = 1; y <= 7; y++) { R.zetBlok(X0, Y + y, Z, B.steen); R.zetBlok(X0 - 1, Y + y, Z, B.klimop); }
    R.zet(X0 - 0.69, Y + 1.02, Z + 0.5); R.kijk(-Math.PI / 2, 0);
    const doe = (sec, inv) => { for (let i = 0; i < sec / dt; i++) R.beweeg(dt, Object.assign({ voor: 0, opzij: 0, spring: false, sluip: false, rent: false }, inv)); return sp.y - (Y + 1); };
    const op = doe(1.2, { voor: 1 }), vast = doe(1, { sluip: true }), stil = op - vast, zak = doe(0.6, {});
    const ladder = [];
    // en een ladder doet hetzelfde
    for (let y = 1; y <= 7; y++) R.zetBlok(X0 - 1, Y + y, Z, B.ladder);
    R.zet(X0 - 0.69, Y + 1.02, Z + 0.5); const opL = doe(1.2, { voor: 1 });
    return { op, stil, zak: vast - zak, opL };
  }, basis);
  console.log('  klimop: in 1,2 s omhoog ' + klim.op.toFixed(2) + ' blok; sluipen zakt ' + klim.stil.toFixed(2) + '; loslaten zakt in 0,6 s ' + klim.zak.toFixed(2) + ' (ladder: ' + klim.opL.toFixed(2) + ')');
  check(klim.op > 3 && Math.abs(klim.op - klim.opL) < 0.3, 'langs klimop klim je omhoog, net zo snel als op een ladder');
  check(Math.abs(klim.stil) < 0.05 && klim.zak > 0.4, 'op klimop blijf je hangen met sluipen, en zak je langzaam als je loslaat');
  // ---------- 3. spinnenweb
  const web = await page.evaluate(([X, Y, Z]) => {
    const R = window.__rommelblok, B = R.G.B, sp = R.sp, dt = 1 / 60;
    for (let x = -4; x <= 4; x++) for (let y = 1; y <= 3; y++) R.zetBlok(X + x, Y + y, Z + 5, B.spinnenweb);
    R.zet(X - 3.5, Y + 1.02, Z + 5.5); R.kijk(-Math.PI / 2, 0);
    for (let i = 0; i < 30; i++) R.stap(dt, {});
    const x0 = sp.x; for (let i = 0; i < 60; i++) R.stap(dt, { voor: 1, rent: true }); const doorWeb = sp.x - x0;
    R.zet(X - 3.5, Y + 1.02, Z + 3.5); const x1 = sp.x; for (let i = 0; i < 60; i++) R.stap(dt, { voor: 1, rent: true }); const zonder = sp.x - x1;
    // vallen: een toren van webben van 12 hoog
    for (let y = 8; y <= 20; y++) R.zetBlok(X + 10, Y + y, Z, B.spinnenweb);
    R.zet(X + 10.5, Y + 22, Z + 0.5); let snelst = 0;
    for (let i = 0; i < 240; i++) { R.stap(dt, {}); if (sp.y < Y + 19 && sp.y > Y + 9) snelst = Math.max(snelst, -sp.vy); }
    return { doorWeb, zonder, snelst };
  }, basis);
  console.log('  spinnenweb: in 1 s rennend ' + web.doorWeb.toFixed(2) + ' blok (zonder web ' + web.zonder.toFixed(2) + '); vallen hooguit ' + web.snelst.toFixed(2) + ' blok/s');
  check(web.doorWeb < web.zonder * 0.25, 'een spinnenweb vertraagt je flink');
  check(web.snelst > 0 && web.snelst <= 1.15, 'door een spinnenweb val je langzaam');
  // ---------- 4. tapijt en mostapijt in een lage gang
  const tapijt = await page.evaluate(([X, Y, Z]) => {
    const R = window.__rommelblok, B = R.G.B, sp = R.sp, dt = 1 / 60, uit = {};
    for (const [soort, z] of [['mos', -3], ['tapijt', -5]]) {
      for (let x = -4; x <= 6; x++) { R.zetBlok(X + x, Y + 3, Z + z, B.steen); R.zetBlok(X + x, Y + 1, Z + z - 1, B.steen); R.zetBlok(X + x, Y + 1, Z + z + 1, B.steen); R.zetBlok(X + x, Y + 2, Z + z - 1, B.steen); R.zetBlok(X + x, Y + 2, Z + z + 1, B.steen); }
      for (let x = 0; x <= 2; x++) R.zetBlok(X + x, Y + 1, Z + z, B[soort]);
      R.zet(X - 3.5, Y + 1.02, Z + z + 0.5); R.kijk(-Math.PI / 2, 0); let sprong = 0, hoogst = 0;
      for (let i = 0; i < 150; i++) { const n = sp.sprongen; R.stap(dt, { voor: 1 }); if (sp.sprongen > n) sprong++; hoogst = Math.max(hoogst, sp.y - (Y + 1)); }
      uit[soort] = { voorbij: sp.x - (X + 3), sprong, hoogst: +hoogst.toFixed(3), past: !R.raakt(X + 1.5, Y + 1 + 1 / 16, Z + z + 0.5, 1.8) };
    }
    return uit;
  }, basis);
  for (const [k, v] of Object.entries(tapijt)) {
    console.log('  ' + k + ': ' + (v.voorbij > 0 ? 'erover gelopen' : 'bleef steken') + ', hoogst ' + v.hoogst + ', sprongen ' + v.sprong + ', past staand eronder: ' + v.past);
    check(v.voorbij > 0 && v.sprong === 0 && v.hoogst < 0.2 && v.past, (k === 'mos' ? 'mostapijt' : 'tapijt') + ': in een gang van twee hoog loop je eroverheen zonder te springen, en je past eronder');
  }
  // ---------- 5. waterlelie
  const lelie = await page.evaluate(([X, Y, Z]) => {
    const R = window.__rommelblok, B = R.G.B, sp = R.sp, dt = 1 / 60, X0 = X + 12;
    for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) { R.zetBlok(X0 + x, Y + 1, Z + z, R.G.W); R.zetBlok(X0 + x, Y + 2, Z + z, 0); }
    R.zetBlok(X0, Y + 2, Z, B.waterlelie);
    R.zet(X0 + 0.5, Y + 4, Z + 0.5);
    for (let i = 0; i < 120; i++) R.stap(dt, {});
    return { boven: sp.y - (Y + 2), water: sp.inWater, grond: sp.opGrond };
  }, basis);
  console.log('  waterlelie: voeten ' + lelie.boven.toFixed(3) + ' boven het water, in het water: ' + lelie.water + ', op de grond: ' + lelie.grond);
  check(lelie.boven > 0.05 && lelie.boven < 0.1 && !lelie.water && lelie.grond, 'je kunt op een waterlelie staan');
  check(!fouten.length, 'geen fouten in de console' + (fouten.length ? ': ' + fouten.join(' ') : ''));
  await b.sluit();
  console.log(mis.length ? mis.length + ' FOUTEN' : 'bewegen: alles goed');
  process.exit(mis.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

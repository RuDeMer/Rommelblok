// Vechten met dieren en griezels (browser): node test/vechten.js
// 1. de raakdoos past bij het model en draait mee: een koe raak je ook aan haar kop en haar achterkant, maar niet naast haar
// 2. tussen twee slagen zit een wachttijd, en een wezen is na een klap even onkwetsbaar (rood, terugduwen, geluid)
// 3. doodgaan: eerst omvallen (het wezen ligt op zijn zij), daarna een wolkje
// 4. spookjes: hooguit 2 tegelijk bij 'normaal', en ze zijn sterker dan vroeger
const { open, wachtKlaar } = require('./pw');
const mis = []; const check = (ok, w) => { console.log((ok ? 'goed ' : 'FOUT ') + w); if (!ok) mis.push(w); };
(async () => {
  const b = await open({ q: 'test=1&zaad=777&stand=overleven&straal=2&x=51&z=-41&tijd=0.5', ctx: { viewport: { width: 640, height: 400 } } });
  const { page, fouten } = b; await wachtKlaar(page); await page.waitForTimeout(2000);
  // een vloer in de lucht, met een koe erop
  const r1 = await page.evaluate(() => {
    const R = window.__rommelblok, B = R.G.B, X = Math.floor(R.sp.x), Y = Math.floor(R.sp.y) + 30, Z = Math.floor(R.sp.z);
    for (let x = -8; x <= 8; x++) for (let z = -8; z <= 8; z++) { R.zetBlok(X + x, Y, Z + z, B.steen); for (let y = 1; y <= 4; y++) R.zetBlok(X + x, Y + y, Z + z, 0); }
    R.zet(X + 0.5, Y + 1.02, Z - 4.5); R.valVrij = 60;
    const koe = R.WZ.nieuwWezen(R.WZ.WI.koe, X + 0.5, Y + 1, Z + 0.5, 0); koe.proef = true; R.WD.dieren.push(koe); R.actief.push(koe); window.__koe = koe;
    const S = R.WZ.WEZENS[koe.s], d = R.wezenDoos(koe);
    // een straal van opzij (vanuit +x naar -x) op hoogte van de kop, op een paar plekken langs de koe
    const raak = (yaw, dz, dx) => { koe.yaw = yaw; const o = [koe.x + dx + 3, koe.y + 1.0, koe.z + dz], r = R.wezenOpStraal(o, [-1, 0, 0], 8); return !!(r && r.wezen === koe); };
    const raakZ = (yaw, dx, dz) => { koe.yaw = yaw; const o = [koe.x + dx, koe.y + 1.0, koe.z + dz + 3], r = R.wezenOpStraal(o, [0, 0, -1], 8); return !!(r && r.wezen === koe); };
    return {
      lang: +(d[5] - d[2]).toFixed(2), breed: +(d[3] - d[0]).toFixed(2), hoog: +(d[4] - d[1]).toFixed(2), oud: S.maat[0] * 2,
      kop: raak(0, 0.95, 0), kont: raak(0, -0.6, 0), naast: raak(0, 1.45, 0),
      kopGedraaid: raakZ(Math.PI / 2, 0.95, 0), naastGedraaid: raakZ(Math.PI / 2, 1.45, 0), staartGedraaid: raakZ(Math.PI / 2, -0.6, 0),
    };
  });
  console.log('  koe: raakdoos ' + r1.lang + ' lang, ' + r1.breed + ' breed, ' + r1.hoog + ' hoog (vroeger een vierkant van ' + r1.oud + ')');
  check(r1.lang > 1.6 && r1.breed < 1 && r1.hoog > 1.3, 'de raakdoos van een koe heeft de maat van het model');
  check(r1.kop && r1.kont && !r1.naast, 'je raakt een koe aan haar kop en haar achterkant, maar niet naast haar');
  check(r1.kopGedraaid && r1.staartGedraaid && !r1.naastGedraaid, 'de raakdoos draait mee als de koe zich omdraait');
  // 2. wachttijd en onkwetsbaar
  const r2 = await page.evaluate(() => {
    const R = window.__rommelblok, koe = window.__koe; koe.yaw = 0;
    const hp0 = koe.hp; let gelukt = 0; for (let i = 0; i < 10; i++) if (R.slaWezen(koe)) gelukt++;
    return { hp0, hp1: koe.hp, gelukt, rood: koe.rood, v: Math.hypot(koe.vx, koe.vz) };
  });
  // de speltijd loopt in een trage testbrowser langzamer dan de klok: wachten tot de koe weer te raken is
  const raakbaar = () => page.waitForFunction(() => { const koe = window.__koe; return koe.hp <= 0 || koe.onkw <= 0; }, null, { timeout: 20000 }).catch(async e => { console.log(await page.evaluate(() => { const R = window.__rommelblok, k = window.__koe; return JSON.stringify({ onkw: k.onkw, hp: k.hp, x: k.x - R.sp.x, y: k.y, z: k.z - R.sp.z, actief: R.actief.includes(k), st: k.st }); })); throw e; }).then(() => page.waitForTimeout(500));
  await raakbaar();
  const r2b = await page.evaluate(() => { const R = window.__rommelblok, koe = window.__koe; const h = koe.hp, ok = R.slaWezen(koe); return { voor: h, na: koe.hp, ok }; });
  console.log('  tien keer snel slaan: ' + r2.gelukt + ' klap, levens ' + r2.hp0 + ' -> ' + r2.hp1 + ' (rood ' + r2.rood.toFixed(2) + ', teruggeduwd ' + r2.v.toFixed(1) + '); daarna nog een klap: ' + r2b.voor + ' -> ' + r2b.na);
  check(r2.gelukt === 1 && r2.hp1 < r2.hp0, 'snel achter elkaar slaan telt maar één keer');
  check(r2.rood > 0 && r2.v > 2, 'een klap: rood oplichten en terugduwen');
  check(r2b.ok && r2b.na < r2b.voor, 'na de wachttijd kun je weer slaan');
  // 3. doodgaan: omvallen, dan een wolkje
  await page.evaluate(() => { window.__koe.hp = 2; });
  for (let i = 0; i < 6; i++) { await raakbaar(); const dood = await page.evaluate(() => { const R = window.__rommelblok, koe = window.__koe; if (koe.hp > 0) R.slaWezen(koe); return koe.hp <= 0; }); if (dood) break; }
  const r3 = await page.evaluate(() => new Promise(ok => {
    const R = window.__rommelblok, n0 = R.deeltjes.length, st = R.stervend.length, nogDaar = R.actief.includes(window.__koe);
    const opZij = () => (R.stervend[0] && R.stervend[0].t < 0.4) ? setTimeout(opZij, 50) : vervolg();
    setTimeout(opZij, 50);
    const vervolg = () => { const l = R.tekenLijst().find(x => x.model === 'wz:koe' && x.rol); const rol = l ? Math.abs(l.rol || 0) : 0;
      const wacht = () => R.stervend.length ? setTimeout(wacht, 100) : ok({ st, nogDaar, rol, na: R.stervend.length, wolk: R.deeltjes.length - n0 }); setTimeout(wacht, 300); };
  }));
  console.log('  doodgaan: stervend ' + r3.st + ', nog bij de levenden ' + r3.nogDaar + ', na 0,4 s speltijd op zijn zij (' + (r3.rol * 180 / Math.PI).toFixed(0) + ' graden), daarna nog stervend ' + r3.na + ', wolkje ' + r3.wolk + ' deeltjes');
  check(r3.st === 1 && !r3.nogDaar, 'een dode koe doet niet meer mee, maar valt eerst om');
  check(r3.rol > 1.4, 'ze ligt op haar zij');
  check(r3.na === 0 && r3.wolk > 5, 'daarna verdwijnt ze in een wolkje');
  // 4. spookjes: hooguit 2 tegelijk bij normaal
  await page.evaluate(() => window.__rommelblok.tijd(0.95)); await page.waitForTimeout(800);
  const r4 = await page.evaluate(() => {
    const R = window.__rommelblok; R.WD.moeilijk = 'normaal';
    const telS = () => R.griezels.filter(w => R.WZ.WEZENS[w.s].sleutel === 'spookje').length;
    for (let i = 0; i < 300; i++) R.griezelErbij(R.WZ.MOEILIJK.normaal.spoken - telS());
    return { spoken: telS(), hp: R.WZ.WEZENS[R.WZ.WI.spookje].hp, schade: R.WZ.WEZENS[R.WZ.WI.spookje].schade };
  });
  console.log('  spookjes na 300 pogingen: ' + r4.spoken + ' (levens ' + r4.hp + ', schade ' + r4.schade + ')');
  check(r4.spoken >= 1 && r4.spoken <= 2, 'bij normaal hooguit twee spookjes tegelijk');
  check(!fouten.length, 'geen fouten in de console' + (fouten.length ? ': ' + fouten.join(' ') : ''));
  await b.sluit();
  console.log(mis.length ? mis.length + ' FOUTEN' : 'vechten: alles goed');
  process.exit(mis.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

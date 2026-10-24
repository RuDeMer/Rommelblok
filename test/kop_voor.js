// De kop zit vooraan: elk dier en elke griezel, de bewoners en je eigen poppetje lopen in vier richtingen,
// en in beeld moet de kop (of het gezicht) steeds aan de kant zitten waar ze heen lopen. node test/kop_voor.js
// Ook: zwemmen, zweven, vluchten, een griezel die je volgt, en een griezel die naar je kijkt voor hij aanstormt.
// En: een bewoner die in stromend water staat, drijft mee.
// (De andere spelers worden net zo getekend als je eigen poppetje; dat staat in test/samen.js.)
const { open, wachtKlaar } = require('./pw');
const mis = []; const check = (ok, w) => { if (!ok) mis.push(w); };
const wacht = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await open({ q: 'test=1&zaad=777&stand=overleven&straal=3&x=51&z=-41', ctx: { viewport: { width: 800, height: 500 } } });
  const { page } = b; await wachtKlaar(page); await wacht(3000);
  await page.evaluate(() => { window.__rommelblok.tekenUit = true; });
  // een vlakte hoog in de lucht, met een vijver om in te zwemmen
  const plek = await page.evaluate(async () => {
    const R = window.__rommelblok, sp = R.sp, X = Math.floor(sp.x), Y = Math.floor(sp.y) + 30, Z = Math.floor(sp.z);
    for (let x = -16; x <= 16; x++) for (let z = -16; z <= 16; z++) { R.zetBlok(X + x, Y - 1, Z + z, R.G.B.gras); for (let y = 0; y < 6; y++) R.zetBlok(X + x, Y + y, Z + z, 0); }
    for (let x = 6; x <= 14; x++) for (let z = 6; z <= 14; z++) for (let y = 1; y <= 3; y++) R.zetBlok(X + x, Y - y, Z + z, R.G.W);
    R.valVrij = 600; R.zet(X + 0.5, Y, Z + 0.5); R.kijk(0, 0); R.tijd(0.5); R.WD.moeilijk = 'normaal';
    await new Promise(r => setTimeout(r, 800));
    return [X, Y, Z];
  });
  const r = await page.evaluate(([X, Y, Z]) => {
    const R = window.__rommelblok, WZ = R.WZ, uit = [];
    // waar de voorkant van een model zit (in zestienden, ten opzichte van het lijf): de ogen, anders de kant van het hoofd
    // met een gezicht, anders de kop; null als het model rond is (geen voor- of achterkant)
    const midden = (delen, namen) => { let x = 0, z = 0, n = 0; for (const d of delen) if (namen.includes(d.naam)) for (const q of d.dozen) { x += (q[0] + q[3]) / 2; z += (q[2] + q[5]) / 2; n++; } return n ? [x / n, z / n] : null; };
    const voorVan = model => {
      const delen = R.R.modelDelen(model); if (!delen) return null;
      let v = midden(delen, ['ogen']);
      if (!v) for (const d of delen) for (const q of d.dozen) {
        if (!Array.isArray(q[6])) continue;
        const kanten = q[6], anders = kanten.findIndex((t, i) => i !== 2 && i !== 3 && kanten.filter(u => u === t).length === 1);
        if (anders >= 0) { const cx = (q[0] + q[3]) / 2, cz = (q[2] + q[5]) / 2; v = anders === 0 ? [q[3], cz] : anders === 1 ? [q[0], cz] : anders === 4 ? [cx, q[5]] : [cx, q[2]]; }
      }
      if (!v) v = midden(delen, ['kop']);
      if (!v) return null;
      const m = midden(delen, ['lijf']) || [0, 0];
      return [v[0] - m[0], v[1] - m[1]];
    };
    // de voorkant in de wereld, met dezelfde draaiing als de tekenaar (stelM: de +z-as van het model wijst naar (sin yaw, cos yaw))
    const inWereld = (v, yaw) => v ? [v[0] * Math.cos(yaw) + v[1] * Math.sin(yaw), -v[0] * Math.sin(yaw) + v[1] * Math.cos(yaw)] : [NaN, NaN];
    const hoek = (a, b) => { const la = Math.hypot(a[0], a[1]), lb = Math.hypot(b[0], b[1]); return la && lb ? (a[0] * b[0] + a[1] * b[1]) / la / lb : NaN; };
    const zoek = (lijst, x, z, eis) => lijst.filter(e => eis(e.model)).sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))[0];
    const RICHT = [[1, 0, '+x'], [-1, 0, '-x'], [0, 1, '+z'], [0, -1, '-z']];
    const W = R.wzW; W.spelers = [];
    // ---- dieren en griezels: lopen (en vluchten) in vier richtingen, op het land, in het water en in de lucht
    R.WD.dieren.length = 0; R.griezels.length = 0;
    WZ.WEZENS.forEach((S, i) => {
      const plekken = [['land', X + 0.5, Y, Z - 6.5]];
      if (S.zwemt) plekken.push(['water', X + 10.5, Y - 1.5, Z + 10.5]);
      if (S.zweeft) plekken.push(['lucht', X - 6.5, Y + 2.5, Z + 6.5]);
      for (const [waar, px, py, pz] of plekken) for (const [dx, dz, naam] of RICHT) {
        const w = WZ.nieuwWezen(i, px, py, pz, Math.PI * 0.75, 9000 + i);
        w.st = S.vriend && dx < 0 ? 'vlucht' : 'loop'; w.t = 1e9; w.dx = dx; w.dz = dz; w.grond = waar === 'land';
        for (let k = 0; k < 60; k++) WZ.stap(w, 0.02, W);
        const x0 = w.x, z0 = w.z; for (let k = 0; k < 20; k++) WZ.stap(w, 0.02, W);
        const loop = [w.x - x0, w.z - z0];
        R.actief.push(w); const e = zoek(R.tekenLijst(), w.x, w.z, m => m.startsWith('wz:')); R.actief.splice(R.actief.indexOf(w), 1);
        const v = e && voorVan(e.model);
        uit.push({ wie: S.sleutel + ' (' + waar + ', ' + (w.st === 'vlucht' ? 'vlucht' : 'loopt') + ' ' + naam + ')', rond: e && !v, d: v ? hoek(inWereld(v, e.yaw), loop) : NaN, l: Math.hypot(loop[0], loop[1]) });
      }
    });
    // ---- een spookje volgt je, en de braambol kijkt je aan voor hij aanstormt
    for (const [dx, dz, naam] of RICHT) {
      const p = { id: 'ik', x: X + 0.5 + dx * 6, y: Y, z: Z + 0.5 + dz * 6 }; W.spelers = [p];
      const sp = WZ.nieuwWezen(WZ.WI.spookje, X + 0.5, Y + 0.5, Z + 0.5, 0, 9500);
      for (let k = 0; k < 30; k++) WZ.stap(sp, 0.02, W);
      const x0 = sp.x, z0 = sp.z; for (let k = 0; k < 10; k++) WZ.stap(sp, 0.02, W);
      R.actief.push(sp); let e = zoek(R.tekenLijst(), sp.x, sp.z, m => m === 'wz:spookje'); R.actief.splice(R.actief.indexOf(sp), 1);
      uit.push({ wie: 'spookje volgt je ' + naam + ' (' + sp.st + ')', d: hoek(inWereld(voorVan(e.model), e.yaw), [sp.x - x0, sp.z - z0]), l: Math.hypot(sp.x - x0, sp.z - z0) });
      const br = WZ.nieuwWezen(WZ.WI.braambol, X + 0.5, Y, Z + 0.5, 0, 9501); br.st = 'rust'; br.t = 0;
      WZ.stap(br, 0.02, W);
      R.actief.push(br); e = zoek(R.tekenLijst(), br.x, br.z, m => m === 'wz:braambol'); R.actief.splice(R.actief.indexOf(br), 1);
      uit.push({ wie: 'braambol kijkt je aan ' + naam + ' (' + br.st + ')', d: hoek(inWereld(voorVan(e.model), e.yaw), [p.x - br.x, p.z - br.z]), l: 1 });
    }
    W.spelers = [];
    // ---- een bewoner loopt een route in vier richtingen
    const fase = R.bwFase(R.WD.tijd);
    for (const [dx, dz, naam] of RICHT) {
      const thuis = [X + 3, Y, Z + 3];
      const k = { id: 99990, dorp: 'test', beroep: 'boer', naam: 'Test', kl: 0, bed: thuis, thuis, deur: thuis, buiten: thuis, werk: null, kijk: null, put: thuis, vak: null, x: X + 0.5, y: Y, z: Z + 0.5, yaw: Math.PI * 0.75, ruil: [], dag: R.WD.dag || 0 };
      R.WD.bewoners.push(k); R.bewonersTik(0); // (een eerste tik: daarna is er geen tijdsprong meer)
      const pad = []; for (let t = 0; t <= 8; t++) pad.push([X + dx * t, Y, Z + dz * t]);
      k.x = X + 0.5; k.y = Y; k.z = Z + 0.5; k.yaw = Math.PI * 0.75;
      R.bwRust.set(k.id, { pad, i: 1, fase, wacht: 0, anim: 0, weg: false, stil: 0 });
      for (let t = 0; t < 30; t++) R.bewonersTik(0.03);
      const x0 = k.x, z0 = k.z; for (let t = 0; t < 10; t++) R.bewonersTik(0.03);
      const e = zoek(R.tekenLijst(), k.x, k.z, m => m.startsWith('bw_'));
      R.WD.bewoners.splice(R.WD.bewoners.indexOf(k), 1); R.bwRust.delete(k.id);
      uit.push({ wie: 'bewoner loopt ' + naam, d: e ? hoek(inWereld(voorVan(e.model), e.yaw), [k.x - x0, k.z - z0]) : NaN, l: Math.hypot(k.x - x0, k.z - z0) });
    }
    // ---- een bewoner die in stromend water staat, drijft mee (een goot van 12 lang met water dat naar +x stroomt)
    {
      for (let x = -1; x <= 13; x++) for (let z = -1; z <= 1; z++) { R.zetBlok(X + x, Y - 1, Z - 9 + z, R.G.B.steen); R.zetBlok(X + x, Y, Z - 9 + z, Math.abs(z) === 1 || x === -1 || x === 13 ? R.G.B.steen : x % 8 === 0 ? R.G.W : R.G.W | ((x % 8) << 8)); }
      const thuis = [X + 3, Y, Z + 3];
      const k = { id: 99991, dorp: 'test', beroep: 'boer', naam: 'Test', kl: 0, bed: thuis, thuis, deur: thuis, buiten: thuis, werk: null, kijk: null, put: thuis, vak: null, x: X + 2.5, y: Y, z: Z - 8.5, yaw: 0, ruil: [], dag: R.WD.dag || 0 };
      R.WD.bewoners.push(k); R.bewonersTik(0);
      k.x = X + 2.5; k.y = Y; k.z = Z - 8.5; R.bwRust.set(k.id, { pad: null, i: 0, fase, wacht: 1e9, anim: 0, weg: false, stil: 0 });
      for (let t = 0; t < 60; t++) { R.bwRust.get(k.id).wacht = 1e9; R.bewonersTik(0.03); }
      uit.push({ stroom: true, wie: 'een bewoner in stromend water', l: k.x - (X + 2.5) });
      R.WD.bewoners.splice(R.WD.bewoners.indexOf(k), 1); R.bwRust.delete(k.id);
    }
    // ---- je eigen poppetje van achteren (de derde persoon): vooruit lopen in vier richtingen
    const camVoor = R.inst.camera; R.wisselCamera(1);
    for (const [yaw, naam] of [[0, '-z'], [Math.PI / 2, '-x'], [Math.PI, '+z'], [-Math.PI / 2, '+x']]) {
      R.zet(X + 0.5, Y, Z + 0.5); R.kijk(yaw, 0);
      R.sim(20, 0.02, { voor: 1 }); const x0 = R.sp.x, z0 = R.sp.z; R.sim(10, 0.02, { voor: 1 });
      R.maakCamera(0, 0);
      const e = zoek(R.tekenLijst(), R.sp.x, R.sp.z, m => !m.startsWith('wz:') && !m.startsWith('bw_') && m !== 'kar');
      uit.push({ wie: 'je eigen poppetje (van achteren) loopt ' + naam, d: e ? hoek(inWereld(voorVan(e.model), e.yaw), [R.sp.x - x0, R.sp.z - z0]) : NaN, l: Math.hypot(R.sp.x - x0, R.sp.z - z0) });
    }
    R.wisselCamera(camVoor); R.maakCamera(0, 0);
    // ---- het karretje: is het voor en achter gelijk? (dan kan het niet verkeerd om rijden)
    const kar = R.R.modelDelen('kar');
    let sym = !!kar;
    if (kar) for (const d of kar) for (const q of d.dozen) if (!d.dozen.some(o => Math.abs(o[0] - q[0]) < 1e-6 && Math.abs(o[3] - q[3]) < 1e-6 && Math.abs(o[2] + q[5]) < 1e-6 && Math.abs(o[5] + q[2]) < 1e-6 && o[1] === q[1] && o[4] === q[4])) sym = false;
    return { uit, kar: sym };
  }, plek);
  for (const u of r.uit) {
    if (u.stroom) { console.log((u.l > 2 ? 'goed ' : 'FOUT ') + u.wie + ' drijft mee (' + u.l.toFixed(1) + ' blokken in 1,8 seconde)'); check(u.l > 2, u.wie + ' drijft niet mee'); continue; }
    if (u.rond) { console.log('  ' + u.wie + ': rond, geen voor- of achterkant'); continue; }
    const goed = u.d > 0.8 && u.l > 0.05;
    console.log((goed ? 'goed ' : 'FOUT ') + u.wie + ': kop in de looprichting ' + (isNaN(u.d) ? '?' : (u.d * 100).toFixed(0) + '%') + (u.l > 0.05 ? '' : ' (beweegt niet)'));
    check(goed, u.wie);
  }
  console.log((r.kar ? 'goed ' : 'FOUT ') + 'het karretje is voor en achter gelijk');
  check(r.kar, 'karretje niet symmetrisch: dan moet de richting nagekeken worden');
  await b.sluit();
  console.log(mis.length ? mis.length + ' FOUTEN: ' + mis.join('; ') : 'de kop zit overal vooraan');
  process.exit(mis.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

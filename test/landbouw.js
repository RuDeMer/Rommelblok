// landbouw en smidse: schoffelen, zaaien, groeien (nat en droog), oogsten, eten met een kom terug, herstellen en sterrenglans
const { open, wachtKlaar } = require('./pw');
(async () => {
  const { page, fouten, sluit } = await open({ q: 'test=1&zaad=777&stand=overleven&tijd=0.45&straal=3&x=60&z=-40' });
  await wachtKlaar(page); await page.waitForTimeout(1500);
  const r = await page.evaluate(async () => {
    const R = window.__rommelblok, G = R.G, B = G.B, I = G.I, sp = R.sp, uit = {};
    const wacht = ms => new Promise(ok => setTimeout(ok, ms));
    R.tekenUit = true;
    // een vlak stukje gras zoeken
    let plek = null;
    for (let r = 0; r < 30 && !plek; r++) for (let dz = -r; dz <= r && !plek; dz++) for (let dx = -r; dx <= r && !plek; dx++) {
      const X = Math.floor(sp.x) + dx, Z = Math.floor(sp.z) + dz;
      for (let y = 100; y > 40; y--) { const v = R.blokOp(X, y, Z); if (v > 0 && G.VAST[v & 255]) { if ((v & 255) === B.gras) { let ok = true; for (let a = -1; a <= 6; a++) for (let b = -1; b <= 3; b++) { if ((R.blokOp(X + a, y, Z + b) & 255) !== B.gras) ok = false; const o = R.blokOp(X + a, y + 1, Z + b) & 255; if (o && G.VAST[o]) ok = false; } if (ok) plek = [X, y, Z]; } break; } }
    }
    uit.plek = plek; const [X, Y, Z] = plek;
    // bloemen en gras boven het stukje weghalen (met een bloem erop kun je niet schoffelen)
    for (let a = -1; a <= 6; a++) for (let b = -1; b <= 3; b++) if (R.blokOp(X + a, Y + 1, Z + b)) R.zetBlok(X + a, Y + 1, Z + b, 0);
    await wacht(300);
    // schoffelen: richt op het gras (van boven) en gebruik de schoffel
    R.geef('schoffel_hout', 1); const si = R.WD.inv.findIndex(s => s && s.id === I.schoffel_hout); R.kies(si);
    const doelOp = (x, y, z) => { R.zet(x + 0.5, y + 3, z + 0.5); R.kijk(0, -1.55); R.spelTik(0.016, performance.now()); };
    for (let a = 0; a < 6; a++) { doelOp(X + a, Y, Z); R.gebruik(); await wacht(40); }
    await wacht(400);
    uit.akkers = [0, 1, 2, 3, 4, 5].filter(a => (R.blokOp(X + a, Y, Z) & 255) === B.akker).length;
    uit.schoffelSleet = R.WD.inv[si] ? R.WD.inv[si].dur : 'kapot';
    // zaaien: tarwezaad, aardappel, wortel, bietenzaad, pompoenpit
    const zaad = ['tarwezaad', 'aardappel', 'wortel', 'bietenzaad', 'pompoenpit'];
    for (const k of zaad) R.geef(k, 2);
    for (let a = 0; a < 5; a++) { const j = R.WD.inv.findIndex(s => s && s.id === I[zaad[a]]); R.kies(j); doelOp(X + a, Y, Z); R.gebruik(); await wacht(40); }
    await wacht(400);
    uit.gezaaid = [0, 1, 2, 3, 4].map(a => G.BL[R.blokOp(X + a, Y + 1, Z) & 255].sleutel);
    // water ernaast: de akker wordt nat
    R.zetBlok(X - 1, Y, Z, G.W | 0); R.zetBlok(X - 1, Y, Z + 1, G.W | 0);
    return { uit, plek };
  });
  // de akker wordt nat en de gewassen groeien: de tijd versnellen (een willekeurige tik is een seconde)
  let groei = null; const kijkGroei = () => page.evaluate(([X, Y, Z]) => { const R = window.__rommelblok; return { nat: [0, 1, 2, 3, 4].map(a => (R.blokOp(X + a, Y, Z) >> 8) & 1), stap: [0, 1, 2, 3, 4].map(a => (R.blokOp(X + a, Y + 1, Z) >> 8) & 3) }; }, r.plek);
  for (let sec = 0; sec < 1800; sec += 30) {
    await page.evaluate(() => window.__rommelblok.wb({ t: 'toeval', n: 30 })); await page.waitForTimeout(60);
    groei = await kijkGroei(); groei.seconden = sec + 30;
    if (groei.stap.every(s => s === 3)) break;
  }
  r.uit.groei = groei;
  const r2 = await page.evaluate(async ([X, Y, Z]) => {
    const R = window.__rommelblok, G = R.G, B = G.B, I = G.I, uit = {};
    const wacht = ms => new Promise(ok => setTimeout(ok, ms));
    // oogsten met de hand
    const voor = R.WD.inv.filter(Boolean).map(s => G.IT[s.id].sleutel + ':' + s.n).join(' ');
    R.kies(8); R.WD.inv[8] = null;
    for (let a = 0; a < 5; a++) { const v = R.blokOp(X + a, Y + 1, Z); R.breek({ x: X + a, y: Y + 1, z: Z, v }, false); }
    await wacht(300);
    uit.opbrengst = R.losse.filter(d => !d.rugzak).map(d => G.IT[d.id].sleutel + ':' + d.n).sort().join(' ');
    // hutspot eten: de kom komt terug
    R.WD.speler.honger = 8; R.geef('hutspot', 1); const j = R.WD.inv.findIndex(s => s && s.id === I.hutspot); R.kies(j);
    R.invoer && 0;
    return uit;
  }, r.plek);
  // eten: vasthouden, zoals de rechtermuisknop of de bouwknop
  await page.evaluate(() => { const R = window.__rommelblok; R.houd = true; R.gebruik(); });
  // de testbrowser tekent maar een paar beeldjes per seconde: wachten tot het op is (hooguit 45 s)
  await page.waitForFunction(() => { const R = window.__rommelblok; return !R.WD.inv.some(s => s && s.id === R.G.I.hutspot); }, null, { timeout: 45000 }).catch(() => {});
  const kom = await page.evaluate(() => { const R = window.__rommelblok; R.houd = false; return { kom: R.WD.inv.some(s => s && s.id === R.G.I.kom), honger: R.WD.speler.honger, hutspotOver: R.WD.inv.some(s => s && s.id === R.G.I.hutspot) }; });
  const r3 = await page.evaluate(async () => {
    const R = window.__rommelblok, G = R.G, I = G.I;
    const wacht = ms => new Promise(ok => setTimeout(ok, ms));
    // de smidse: een versleten ijzeren houweel herstellen met ijzerstaven, en verbeteren met een sterrensplinter
    R.geef('houweel_ijzer', 1); const h = R.WD.inv.find(s => s && s.id === I.houweel_ijzer); h.dur = 40;
    R.geef('ijzerstaaf', 5); R.geef('sterrensplinter', 1);
    R.openRugzak('smidse', [0, 0, 0]); await wacht(100);
    const RZ = R.RZ; const hi = R.WD.inv.indexOf(h); RZ.smidse.gereed = h; R.WD.inv[hi] = null;
    const si = R.WD.inv.findIndex(s => s && s.id === I.ijzerstaaf); RZ.smidse.stof = R.WD.inv[si]; R.WD.inv[si] = null;
    const tekst1 = document.getElementById('rb-smidse-info') ? 1 : 0;
    const klik = p => { const e = document.querySelector(`#rb-rugzak [data-plek="${p}"]`); e.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse', button: 0 })); };
    window.dispatchEvent(new Event('resize'));
    klik('smidse:uit'); await wacht(100);
    const hersteld = RZ.vast ? { id: G.IT[RZ.vast.id].sleutel, dur: RZ.vast.dur } : null;
    const stavenOver = RZ.smidse.stof ? RZ.smidse.stof.n : 0;
    // terugleggen en verbeteren
    RZ.smidse.gereed = RZ.vast; RZ.vast = null;
    const ki = R.WD.inv.findIndex(s => s && s.id === I.sterrensplinter); const stofOud = RZ.smidse.stof; RZ.smidse.stof = R.WD.inv[ki]; R.WD.inv[ki] = stofOud;
    klik('smidse:uit'); await wacht(100);
    const ster = RZ.vast ? { id: G.IT[RZ.vast.id].sleutel, dur: RZ.vast.dur, max: G.IT[RZ.vast.id].duur, snel: G.IT[RZ.vast.id].snel } : null;
    return { tekst1, hersteld, stavenOver, ster };
  });
  const u = Object.assign(r.uit, r2, r3, kom);
  console.log(JSON.stringify(u));
  const fout = [];
  if (u.akkers !== 6) fout.push('schoffelen');
  if (u.gezaaid.join() !== 'gewas_tarwe,gewas_aardappel,gewas_wortel,gewas_biet,gewas_pompoen') fout.push('zaaien');
  if (u.groei.nat.join() !== '1,1,1,1,0') fout.push('nat worden');
  if (!u.groei.stap.every(s => s === 3)) fout.push('groeien');
  for (const k of ['tarwe', 'aardappel', 'wortel', 'suikerbiet', 'pompoen']) if (!u.opbrengst.includes(k + ':')) fout.push('oogst ' + k);
  if (!u.hersteld || u.hersteld.dur !== 260 || u.stavenOver !== 1) fout.push('herstellen');
  if (!u.ster || u.ster.id !== 'houweel_ijzer_ster' || u.ster.dur !== u.ster.max) fout.push('sterrenglans');
  if (!u.kom || u.honger !== 18) fout.push('eten');
  console.log(fout.length ? 'MIS: ' + fout.join(', ') : 'landbouw en smidse: alles goed');
  console.log(fouten.join(' ') || 'geen fouten'); await sluit();
  process.exit(fout.length || fouten.length ? 1 : 0);
})();

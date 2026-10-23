// rails en karretjes in de browser: sporen leggen zichzelf (recht, bocht, helling), een spoor zonder blok eronder breekt af,
// een karretje rolt bergaf sneller en haalt bergop niet alles, rolt uit, een stuwspoor geeft vaart, instappen en uitstappen,
// karretjes uit een mijn, bewaren, en een paar beelden om het model te bekijken
const UIT = require('./uit');
const { open, wachtKlaar } = require('./pw');
const wacht = ms => new Promise(ok => setTimeout(ok, ms));
(async () => {
  const { page, fouten, sluit } = await open({ q: 'test=1&zaad=12345&stand=overleven&straal=3', ctx: { viewport: { width: 900, height: 560 } } });
  await wachtKlaar(page); await wacht(1500);
  const mis = [];
  // een stenen vloer hoog in de lucht, met een trede omhoog naar het westen
  const plek = await page.evaluate(() => {
    const R = window.__rommelblok, B = R.G.B, sp = R.sp, X = Math.floor(sp.x), Z = Math.floor(sp.z), Y = Math.floor(sp.y) + 14;
    for (let x = -12; x <= 16; x++) for (let z = -3; z <= 8; z++) { R.zetBlok(X + x, Y - 1, Z + z, B.steen); for (let y = 0; y < 5; y++) R.zetBlok(X + x, Y + y, Z + z, 0); }
    for (let x = -12; x <= -2; x++) R.zetBlok(X + x, Y, Z, B.steen);
    R.sp.vliegt = false; R.valVrij = 9999; R.zet(X + 0.5, Y + 0.02, Z + 4.5);
    return { X, Y, Z };
  });
  await wacht(800);
  const r = await page.evaluate(({ X, Y, Z }) => {
    const R = window.__rommelblok, G = R.G, B = G.B, I = G.I, uit = {};
    const doel = (x, y, z) => ({ x, y, z, v: R.blokOp(x, y, z), n: [0, 1, 0], p: [x + 0.5, y + 1, z + 0.5] });
    const leg = (x, y, z, soort) => { R.WD.inv[R.WD.kies] = { id: B[soort || 'mijnspoor'], n: 64 }; return R.plaats(doel(x, y - 1, z), R.WD.inv[R.WD.kies]); };
    const st = (x, y, z) => { const v = R.blokOp(x, y, z); return G.isSpoor(v & 255) ? (v >> 8) & 15 : -1; };
    R.kijk(Math.PI / 2, 0); // naar het westen kijken
    // 1. een rechte lijn van oost naar west (x van X+9 tot X)
    for (let x = X + 9; x >= X; x--) leg(x, Y, Z);
    uit.recht = [...Array(10)].map((_, i) => st(X + i, Y, Z));
    // 2. een bocht: vanaf het oostelijke eind naar het zuiden (z+)
    for (let z = Z + 1; z <= Z + 4; z++) leg(X + 9, Y, z);
    uit.bocht = st(X + 9, Y, Z); uit.bochtZuid = [1, 2, 3, 4].map(i => st(X + 9, Y, Z + i));
    // 3. een helling: boven op de trede een spoor, dan het stukje ertussen
    for (let x = X - 8; x <= X - 2; x++) leg(x, Y + 1, Z);
    leg(X - 1, Y, Z);
    uit.helling = st(X - 1, Y, Z); uit.boven = st(X - 2, Y + 1, Z); uit.naHelling = st(X, Y, Z);
    // 4. een spoor zonder blok eronder breekt af en valt als voorwerp
    const voor = R.losse.length;
    R.breek(doel(X + 5, Y - 1, Z), false);
    uit.afgebroken = R.blokOp(X + 5, Y, Z) & 255; uit.gevallen = R.losse.slice(voor).map(l => G.IT[l.id].sleutel);
    R.zetBlok(X + 5, Y - 1, Z, B.steen); leg(X + 5, Y, Z);
    uit.terug = st(X + 5, Y, Z);
    // 5. een karretje neerzetten met het voorwerp uit de rugzak
    R.WD.inv[R.WD.kies] = { id: I.karretje, n: 1 }; R.zet(X + 4.5, Y + 0.02, Z + 2.5); R.kijk(0, -0.9); R.spelTik(0.016, performance.now());
    const k0 = (R.WD.karren || []).length;
    // richten op het spoor op X+4
    const d = doel(X + 4, Y, Z); d.v = R.blokOp(X + 4, Y, Z);
    R.karNieuw(X + 4, Y, Z); R.WD.inv[R.WD.kies] = null;
    uit.karren = R.WD.karren.length - k0;
    return uit;
  }, plek);
  console.log('sporen:', JSON.stringify(r));
  if (r.recht.some(s => s !== 1 && s !== 3 && s !== 10) || r.recht.slice(1, 9).some(s => s !== 1 && s !== 3)) mis.push('rechte lijn: ' + r.recht);
  if (r.bocht !== 10) mis.push('bocht: ' + r.bocht);
  if (r.bochtZuid.some(s => s !== 0 && s !== 2)) mis.push('na de bocht: ' + r.bochtZuid);
  if (r.helling !== 7) mis.push('helling: ' + r.helling);
  if (r.boven !== 1 && r.boven !== 3) mis.push('boven de helling: ' + r.boven);
  if (r.afgebroken !== 0 || !r.gevallen.includes('mijnspoor')) mis.push('spoor zonder steun: ' + r.afgebroken + ' ' + r.gevallen);
  if (r.terug !== 1 && r.terug !== 3) mis.push('opnieuw gelegd: ' + r.terug);

  // rijden: alles met de echte natuurkunde, in stapjes van 1/60 seconde
  const rit = await page.evaluate(({ X, Y, Z }) => {
    const R = window.__rommelblok, B = R.G.B, uit = {};
    const k = R.WD.karren[R.WD.karren.length - 1];
    const stap = (n, f) => { for (let i = 0; i < n; i++) { R.karTik(1 / 60); if (f) f(i); } };
    const zet = (x, y, v, van) => { k.bx = x; k.by = y; k.bz = Z; k.t = 0.5; k.v = v; k.van = van; k.los = false; };
    // a. bergaf: vanaf boven de helling naar het oosten (van = west = 3), met een klein zetje
    zet(X - 4, Y + 1, 1.5, 3);
    let vMax = 0, voorbij = null; stap(60 * 30, () => { vMax = Math.max(vMax, k.v); if (voorbij === null && k.bx >= X) voorbij = k.v; });
    uit.bergaf = { vMax: +vMax.toFixed(2), naHelling: voorbij && +voorbij.toFixed(2), stil: +k.v.toFixed(3), x: k.bx - X, z: k.bz - Z };
    // b. bergop met te weinig vaart: hij rolt terug
    zet(X + 3, Y, 2.5, 1);
    let hoogst = 0, keer = false; stap(60 * 20, () => { hoogst = Math.max(hoogst, k.by - Y); if (k.bx < X - 1) keer = 'over'; });
    uit.bergopZwak = { hoogst, keer, x: k.bx - X, stil: +Math.abs(k.v).toFixed(3) };
    // c. bergop met genoeg vaart: hij haalt de trede
    zet(X + 3, Y, 6, 1); stap(60 * 6);
    uit.bergopSterk = { y: k.by - Y, x: k.bx - X };
    // d. een stuwspoor op X+7: een stilstaand karretje rijdt weg, en vaart neemt toe
    R.zetBlok(X + 7, Y, Z, B.stuwspoor | (1 << 8));
    zet(X + 7, Y, 0, 3); stap(30);
    uit.stuwStart = +k.v.toFixed(2);
    zet(X + 1, Y, 2, 3); let vVoor = 0, vNa = 0; stap(60 * 6, () => { if (k.bx === X + 6) vVoor = k.v; if (k.bx === X + 8) vNa = Math.max(vNa, k.v); });
    uit.stuw = { voor: +vVoor.toFixed(2), na: +vNa.toFixed(2) };
    // e. instappen, een zetje geven, meerijden en uitstappen
    zet(X + 2, Y, 0, 3); R.karTik(1 / 60);
    R.instappen(k); R.kijk(-Math.PI / 2, 0); // naar het oosten kijken
    const inv = { voor: 1, opzij: 0, spring: false, sluip: false, rent: false };
    for (let i = 0; i < 90; i++) { R.beweeg(1 / 60, inv); R.spelTik(1 / 60, performance.now()); }
    uit.rijden = { in: R.rijdtIn === k, v: +k.v.toFixed(2), afstand: +Math.hypot(R.sp.x - k.x, R.sp.z - k.z).toFixed(3), oog: +R.sp.oog.toFixed(2) };
    inv.voor = 0; inv.sluip = true; R.beweeg(1 / 60, inv); inv.sluip = false;
    uit.uit = { in: !!R.rijdtIn, naast: +Math.hypot(R.sp.x - k.x, R.sp.z - k.z).toFixed(2), vrij: !R.raakt(R.sp.x, R.sp.y, R.sp.z, 1.8) };
    // f. tegen het eind van het spoor (zuidelijke tak) stopt hij netjes
    zet(X + 9, Y, 4, 3); stap(60 * 8);
    uit.eind = { z: k.bz - Z, x: k.bx - X, v: +Math.abs(k.v).toFixed(3) };
    // g. een karretje kapot slaan geeft het voorwerp terug
    const voor = R.losse.length; R.karWeg(k, true);
    uit.kapot = { weg: !R.WD.karren.includes(k), voorwerp: R.losse.slice(voor).some(l => l.id === R.G.I.karretje) };
    // h. een karretje uit een mijn: een spoor met merkje wordt een gewoon spoor met een karretje erop
    const cx = (X + 12) >> 4, cz = Z >> 4, d = new Uint16Array(16 * 16 * 128), bx = (X + 12) & 15, bz = Z & 15;
    R.zetBlok(X + 12, Y, Z, B.mijnspoor | (1 << 8));
    d[(Y << 8) | (bz << 4) | bx] = B.mijnspoor | ((1 | 16) << 8);
    const n0 = R.WD.karren.length; R.karrenUitStuk(cx, cz, d); R.karrenUitStuk(cx, cz, d);
    uit.mijn = { erbij: R.WD.karren.length - n0, spoor: R.blokOp(X + 12, Y, Z) >> 8 };
    return uit;
  }, plek);
  console.log('rijden:', JSON.stringify(rit));
  if (!(rit.bergaf.naHelling > 1.6)) mis.push('bergaf geen vaart: ' + rit.bergaf.naHelling);
  if (rit.bergaf.stil > 0.01) mis.push('rolt niet uit');
  if (rit.bergopZwak.keer === 'over' || rit.bergopZwak.stil > 0.01) mis.push('bergop met te weinig vaart: ' + JSON.stringify(rit.bergopZwak));
  if (rit.bergopSterk.y !== 1) mis.push('bergop met vaart: ' + JSON.stringify(rit.bergopSterk));
  if (!(rit.stuwStart > 1)) mis.push('stuwspoor start niet: ' + rit.stuwStart);
  if (!(rit.stuw.na > rit.stuw.voor + 2)) mis.push('stuwspoor geeft geen vaart: ' + JSON.stringify(rit.stuw));
  if (!rit.rijden.in || !(rit.rijden.v > 0.5) || rit.rijden.afstand > 0.01) mis.push('rijden: ' + JSON.stringify(rit.rijden));
  if (rit.uit.in || rit.uit.naast > 1.6 || !rit.uit.vrij) mis.push('uitstappen: ' + JSON.stringify(rit.uit));
  if (rit.eind.v > 0.01 || rit.eind.z < 3) mis.push('eind van het spoor: ' + JSON.stringify(rit.eind));
  if (!rit.kapot.weg || !rit.kapot.voorwerp) mis.push('kapot slaan: ' + JSON.stringify(rit.kapot));
  if (rit.mijn.erbij !== 1 || rit.mijn.spoor & 16) mis.push('mijnkarretje: ' + JSON.stringify(rit.mijn));

  // beelden: karretjes op een bocht, een helling en een stuwspoor
  await page.evaluate(({ X, Y, Z }) => {
    const R = window.__rommelblok;
    R.karNieuw(X + 9, Y, Z); R.karNieuw(X - 1, Y, Z); R.karNieuw(X + 4, Y, Z);
    for (const k of R.WD.karren) k.v = 0;
    R.sp.vliegt = true; R.zet(X + 4.5, Y + 3.2, Z + 5.5); R.kijk(0.15, -0.5); R.tijd(0.4);
  }, plek);
  await wacht(1500); await page.screenshot({ path: UIT + '/karretje_overzicht.png' });
  await page.evaluate(({ X, Y, Z }) => { const R = window.__rommelblok; R.zet(X - 1.5, Y + 1.3, Z + 2.6); R.kijk(0.3, -0.35); }, plek);
  await wacht(1000); await page.screenshot({ path: UIT + '/karretje_helling.png' });
  // bewaren en opnieuw openen: de karretjes blijven staan
  const bewaar = await page.evaluate(async () => {
    const R = window.__rommelblok, n = R.WD.karren.length, ids = R.WD.karren.map(k => k.id).join(',');
    R.WD.id = 'karretjes-proef'; // testwerelden worden niet bewaard
    await R.bewaarWereld(true);
    const w = (await R.alleWerelden()).find(x => x.id === R.WD.id);
    return { n, ids, opgeslagen: w && w.karren ? w.karren.length : -1, velden: w && w.karren && w.karren[0] ? Object.keys(w.karren[0]).join(',') : '' };
  });
  console.log('bewaren:', JSON.stringify(bewaar));
  if (bewaar.opgeslagen !== bewaar.n || bewaar.velden !== 'id,bx,by,bz,van,t,v') mis.push('bewaren: ' + JSON.stringify(bewaar));
  if (fouten.length) mis.push(...fouten);
  console.log(mis.length ? 'FOUT: ' + mis.join(' | ') : 'karretjes: alles goed');
  await sluit();
  process.exit(mis.length ? 1 : 0);
})();

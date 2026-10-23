// ============================================================================
// Rails en karretjes. Een spoor legt zichzelf: recht, in een bocht of als helling, aansluitend op wat er al ligt
// (zie G.spoorKies). Zonder blok eronder breekt een spoor af.
// Een karretje rijdt over het spoor met echte vaart: bergaf sneller, bergop langzamer, en zonder duwtje rolt het uit.
// Een stuwspoor geeft vaart. Karretjes staan in WD.karren, elk met een eigen nummer (voor samen spelen later).
// Een karretje is { id, bx, by, bz, van, t, v, los, x, y, z, yaw, pitch }: het blok met het spoor, het eind waar het
// vandaan komt (een richting 0 tot 3), hoe ver het op dit stukje is (0 tot 1) en de vaart (blokken per seconde).
// ============================================================================
const KAR = { HELLING: 5.2, WRIJVING: 0.2, LUCHT: 0.01, STUW: 11, MAX: 11, STUWMAX: 9.5, DUW: 2.2, ZIT: 0.2, OOG: 1.05 };
let rijdtIn = null, doelKar = null;
// ---------------- het model: een houten bak met ijzeren randen op vier wielen (in zestienden, de lange kant langs z)
let karModelKlaar = false;
function karModel() {
  if (karModelKlaar || !R || !R.model) return; karModelKlaar = true;
  const H = G.TEXNR.spoor_hout, IJ = G.TEXNR.spoor;
  R.model('kar', [
    { naam: 'bak', tex: H, dozen: [[-6, 3, -7, 6, 4, 7], [-6, 4, -7, -5, 10, 7], [5, 4, -7, 6, 10, 7], [-5, 4, -7, 5, 10, -6], [-5, 4, 6, 5, 10, 7]] },
    { naam: 'rand', tex: IJ, dozen: [[-6.5, 9.5, -7.5, 6.5, 10.5, -6.5], [-6.5, 9.5, 6.5, 6.5, 10.5, 7.5], [-6.5, 9.5, -6.5, -5.5, 10.5, 6.5], [5.5, 9.5, -6.5, 6.5, 10.5, 6.5],
      [-6.5, 3, -7.5, -5.5, 9.5, -6.5], [5.5, 3, -7.5, 6.5, 9.5, -6.5], [-6.5, 3, 6.5, -5.5, 9.5, 7.5], [5.5, 3, 6.5, 6.5, 9.5, 7.5], [-6, 2, -5, 6, 3, -4], [-6, 2, 4, 6, 3, 5]] },
    { naam: 'wielen', tex: IJ, kleur: [0.42, 0.42, 0.48], dozen: [[-7.5, 0.5, -6, -6, 4.5, -2], [6, 0.5, -6, 7.5, 4.5, -2], [-7.5, 0.5, 2, -6, 4.5, 6], [6, 0.5, 2, 7.5, 4.5, 6]] },
  ]);
}
// ---------------- de vorm van een stukje spoor: van eind 'van' naar het andere eind, in het blok (0 tot 1)
const eindPunt = e => [0.5 + 0.5 * G.RICHTING[e][0], 0.5 + 0.5 * G.RICHTING[e][1]];
function spoorBaan(st, van) {
  const [a, b] = G.spoorEinden(st), naar = a === van ? b : a, op = G.spoorOp(st);
  const P = eindPunt(van), Q = eindPunt(naar), yP = op === van ? 1 : 0, yQ = op === naar ? 1 : 0;
  if ((st & 15) >= 8) {
    // een kwart cirkel om de hoek tussen de twee einden
    const cx = P[0] + Q[0] - 0.5, cz = P[1] + Q[1] - 0.5, a0 = Math.atan2(P[1] - cz, P[0] - cx);
    let a1 = Math.atan2(Q[1] - cz, Q[0] - cx), da = a1 - a0; if (da > Math.PI) da -= 2 * Math.PI; if (da < -Math.PI) da += 2 * Math.PI;
    return { naar, lengte: Math.PI / 4, punt: t => { const h = a0 + da * t; return [cx + Math.cos(h) * 0.5, 0, cz + Math.sin(h) * 0.5]; }, richting: t => { const h = a0 + da * t, s = Math.sign(da); return [-Math.sin(h) * s, 0, Math.cos(h) * s]; } };
  }
  const dx = Q[0] - P[0], dy = yQ - yP, dz = Q[1] - P[1], l = Math.hypot(dx, dy, dz);
  return { naar, lengte: l, helling: dy, punt: t => [P[0] + dx * t, yP + dy * t, P[1] + dz * t], richting: () => [dx / l, dy / l, dz / l] };
}
const spoorHier = k => { const v = blokOp(k.bx, k.by, k.bz); return v > 0 && G.isSpoor(v & 255) ? v : 0; };
function karPlek(k) {
  const v = spoorHier(k); if (!v) return;
  const st = v >> 8, baan = spoorBaan(st, k.van), p = baan.punt(k.t), r = baan.richting(k.t);
  k.x = k.bx + p[0]; k.y = k.by + p[1] + 2 / 16; k.z = k.bz + p[2];
  k.yaw = Math.atan2(r[0], r[2]); k.pitch = -Math.asin(Math.max(-1, Math.min(1, r[1])));
}
// ---------------- neerzetten en weghalen (acties, zodat samen spelen later kan)
function karData(k) { return { id: k.id, bx: k.bx, by: k.by, bz: k.bz, van: k.van, t: Math.round(k.t * 1000) / 1000, v: Math.round(k.v * 100) / 100 }; }
function karNieuw(x, y, z, bron) {
  const v = blokOp(x, y, z); if (!(v > 0 && G.isSpoor(v & 255))) return null;
  WD.karren = WD.karren || []; WD.karNr = (WD.karNr || 0) + 1;
  const k = { id: WD.karNr, bx: x, by: y, bz: z, van: G.spoorEinden(v >> 8)[0], t: 0.5, v: 0, los: false };
  if (bron) k.bron = bron;
  karPlek(k); WD.karren.push(k); actieGevolg(['e', 'kar', k.id, karData(k)]);
  return k;
}
function karWeg(k, laatVal) {
  if (rijdtIn === k) uitstappen();
  WD.karren = WD.karren.filter(x => x !== k); actieGevolg(['e', 'kar', k.id, null]);
  if (laatVal && wereldStand() !== 'bouwen') laatVallen(k.x, k.y + 0.4, k.z, I.karretje, 1);
}
// van een ander (of de server): een karretje erbij, veranderd of weg
function karOntvang(id, d) {
  WD.karren = WD.karren || [];
  const k = WD.karren.find(x => x.id === id);
  if (!d) { if (k) { if (rijdtIn === k) uitstappen(); WD.karren = WD.karren.filter(x => x !== k); } return; }
  const n = k || { id, los: false }; Object.assign(n, d); if (!k) WD.karren.push(n); WD.karNr = Math.max(WD.karNr || 0, id); karPlek(n);
}
// ---------------- rijden
function karTik(dt) {
  if (!WD || !WD.karren || !WD.karren.length) return;
  karModel();
  for (const k of WD.karren) {
    // te ver weg, of het stuk is er nog niet: wachten
    if (Math.abs(k.bx - sp.x) > 60 || Math.abs(k.bz - sp.z) > 60 || blokOp(k.bx, k.by, k.bz) < 0) continue;
    let stappen = Math.max(1, Math.ceil(Math.abs(k.v) * dt / 0.3)); const h = dt / stappen;
    while (stappen--) karStap(k, h);
    karPlek(k);
  }
  // wie erin zit, gaat mee
  if (rijdtIn) { const k = rijdtIn; sp.x = k.x; sp.y = k.y + KAR.ZIT; sp.z = k.z; sp.vx = sp.vy = sp.vz = 0; sp.valStart = null; sp.opGrond = true; }
}
function karStap(k, dt) {
  const v = spoorHier(k);
  if (!v) { karLos(k, dt); return; }
  let st = v >> 8, [ea, eb] = G.spoorEinden(st);
  // het spoor is veranderd (opnieuw gelegd): weer op het spoor zetten
  if (k.van !== ea && k.van !== eb) { k.van = ea; k.t = 0.5; }
  // altijd vooruit rekenen: rijdt hij achteruit, dan draaien we het om
  if (k.v < 0) { const b0 = spoorBaan(st, k.van); k.van = b0.naar; k.t = 1 - k.t; k.v = -k.v; }
  let baan = spoorBaan(st, k.van), a = 0;
  if (baan.helling) a -= KAR.HELLING * Math.sign(baan.helling) * 0.72;
  const stuw = (v & 255) === B.stuwspoor;
  if (stuw) {
    // stilstaan op een stuwspoor: weg van een muur, of de kant op waar je kijkt
    if (k.v < 0.4) {
      const muur = e => { const [dx, dz] = G.RICHTING[e]; const m = blokOp(k.bx + dx, k.by, k.bz + dz); return m > 0 && G.DICHT[m & 255]; };
      let kant = baan.naar;
      if (muur(baan.naar) && !muur(k.van)) kant = k.van;
      else if (!muur(k.van) && !muur(baan.naar) && rijdtIn === k) { const r = baan.richting(k.t), vx = -Math.sin(sp.yaw), vz = -Math.cos(sp.yaw); if (r[0] * vx + r[2] * vz < 0) kant = k.van; }
      if (kant !== baan.naar) { k.van = baan.naar; k.t = 1 - k.t; baan = spoorBaan(st, k.van); }
      k.v = Math.max(k.v, 1.2); if (rijdtIn === k || Math.hypot(k.x - sp.x, k.z - sp.z) < 24) klank('stuw');
    }
    if (k.v < KAR.STUWMAX) a += KAR.STUW;
  }
  // wie erin zit, kan een klein zetje geven (handig op een vlak stuk)
  if (rijdtIn === k && k.duw) {
    const r = baan.richting(k.t), vx = -Math.sin(sp.yaw), vz = -Math.cos(sp.yaw), mee = r[0] * vx + r[2] * vz;
    if (k.v < 3) { if (mee > 0.2 || k.v < 0.05) a += KAR.DUW * (mee >= 0 ? 1 : -1); }
  }
  a -= (KAR.WRIJVING + KAR.LUCHT * k.v * k.v) * (k.v > 0.01 ? 1 : 0);
  k.v = Math.min(KAR.MAX, k.v + a * dt);
  if (k.v < 0 && !baan.helling) k.v = 0;
  // verder over het spoor; aan het eind naar het volgende stukje
  k.t += k.v * dt / baan.lengte;
  if (k.t > 1) {
    const over = (k.t - 1) * baan.lengte, e = baan.naar, [dx, dz] = G.RICHTING[e], hoog = k.by + G.eindHoogte(st, e), terug = (e + 2) % 4;
    let verder = false;
    for (const ny of [hoog, hoog - 1]) {
      const n = blokOp(k.bx + dx, ny, k.bz + dz);
      if (n > 0 && G.isSpoor(n & 255) && G.heeftEind(n >> 8, terug) && ny + G.eindHoogte(n >> 8, terug) === hoog) {
        k.bx += dx; k.by = ny; k.bz += dz; k.van = terug; k.t = Math.min(0.99, over / spoorBaan(n >> 8, terug).lengte); verder = true;
        if (Math.hypot(k.x - sp.x, k.z - sp.z) < 20 && k.v > 0.6) klank('kar', k.v);
        break;
      }
    }
    // geen spoor meer: hij stoot tegen het eind en kaatst een beetje terug
    if (!verder) { k.t = 1; k.v = -k.v * 0.2; if (Math.abs(k.v) < 0.1) k.v = 0; }
  } else if (k.t < 0) k.t = 0;
}
// zonder spoor: vallen tot er grond is (en weer op een spoor als dat er ligt)
function karLos(k, dt) {
  k.los = true; k.vy = (k.vy || 0) - 20 * dt;
  const ny = k.y + k.vy * dt, onder = blokOp(Math.floor(k.x), Math.floor(ny), Math.floor(k.z));
  if (onder > 0 && G.isSpoor(onder & 255)) { k.bx = Math.floor(k.x); k.by = Math.floor(ny); k.bz = Math.floor(k.z); k.los = false; k.vy = 0; k.van = G.spoorEinden(onder >> 8)[0]; k.t = 0.5; k.v = 0; return; }
  if (onder < 0 || (onder > 0 && G.VAST[onder & 255])) { k.vy = 0; k.y = Math.floor(ny) + 1; k.v = 0; return; }
  k.y = ny; k.bx = Math.floor(k.x); k.by = Math.floor(k.y); k.bz = Math.floor(k.z);
  if (k.y < -20) karWeg(k, false);
}
// ---------------- instappen en uitstappen
function instappen(k) { if (rijdtIn) uitstappen(); rijdtIn = k; sp.vliegt = false; k.v = Math.max(0, k.v); klank('kist', false); melding(aanraak ? t('Je zit in het karretje. Sluip om uit te stappen.') : t('Je zit in het karretje. W geeft een zetje, Shift stapt uit.'), true); if (typeof logboek === 'function') logboek('karretje'); }
function uitstappen() {
  const k = rijdtIn; rijdtIn = null; if (!k) return;
  // naast het karretje gaan staan, op een vrije plek (anders erbovenop)
  const r = Math.abs(Math.sin(k.yaw)) > 0.7 ? [[0, 1], [0, -1]] : [[1, 0], [-1, 0]];
  for (const [dx, dz] of r.concat([[0, 0]])) {
    const x = k.x + dx, z = k.z + dz, y0 = Math.floor(k.y + 0.05);
    for (const y of [y0, y0 + 1]) if (!raakt(x, y + 0.01, z, HO) && (dx || dz ? true : y > y0)) { sp.x = x; sp.y = y + 0.01; sp.z = z; sp.vx = sp.vy = sp.vz = 0; sp.valStart = null; return; }
  }
  sp.y = k.y + 1.2;
}
// vanuit de natuurkunde van de speler: in een karretje lopen we niet zelf
function karBeweeg(dt, inv) {
  const k = rijdtIn; if (!k) return false;
  if (!WD.karren.includes(k)) { rijdtIn = null; return false; }
  if (inv.sluip) { uitstappen(); return true; }
  k.duw = inv.voor > 0.3;
  sp.rent = false; sp.sluipt = false; sp.inWater = false; sp.hoofdOnder = false;
  sp.oog += (KAR.OOG - sp.oog) * (1 - Math.exp(-8 * dt)); sp.stapOp = 0; sp.schommel *= Math.exp(-6 * dt);
  return true;
}
// ---------------- richten op een karretje (een doos rond de bak)
function karOpStraal(o, d, max) {
  let best = null, bt = max;
  for (const k of WD && WD.karren || []) {
    if (k === rijdtIn) continue;
    const lo = [k.x - 0.45, k.y, k.z - 0.45], hi = [k.x + 0.45, k.y + 0.65, k.z + 0.45];
    let t0 = 0, t1 = bt;
    for (let i = 0; i < 3 && t0 <= t1; i++) {
      if (Math.abs(d[i]) < 1e-9) { if (o[i] < lo[i] || o[i] > hi[i]) t0 = Infinity; continue; }
      let a = (lo[i] - o[i]) / d[i], b = (hi[i] - o[i]) / d[i]; if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, b);
    }
    if (t0 <= t1 && t0 < bt) { bt = t0; best = k; }
  }
  return best ? { kar: best, t: bt } : null;
}
// ---------------- een wandelaar duwt een stilstaand karretje vooruit
function karDuwen() {
  if (rijdtIn || !WD.karren) return;
  for (const k of WD.karren) {
    if (k.los || Math.abs(k.x - sp.x) > 0.75 || Math.abs(k.z - sp.z) > 0.75 || sp.y > k.y + 0.6 || sp.y + HO < k.y) continue;
    const v = spoorHier(k); if (!v) continue;
    const baan = spoorBaan(v >> 8, k.van), r = baan.richting(k.t), p = sp.vx * r[0] + sp.vz * r[2];
    if (Math.abs(p) > 0.5 && Math.abs(p) > k.v) { if (p < 0) { k.van = baan.naar; k.t = 1 - k.t; } k.v = Math.min(5, Math.abs(p) * 1.1); }
  }
}
// ---------------- tekenen
function karrenTeken(lijst) {
  if (!WD || !WD.karren) return;
  karModel();
  for (const k of WD.karren) {
    if (Math.abs(k.x - sp.x) > 80 || Math.abs(k.z - sp.z) > 80) continue;
    const l = lichtOp(Math.floor(k.x), Math.floor(k.y + 0.5), Math.floor(k.z));
    lijst.push({ model: 'kar', x: k.x, y: k.y, z: k.z, yaw: k.yaw || 0, pitch: k.pitch || 0, licht: lichtKleur(l) });
  }
}
// ---------------- karretjes uit een nieuwe mijn: een spoor met een merkje (stand + 16) wordt een karretje op gewoon spoor
function karrenUitStuk(cx, cz, d) {
  if (!WD) return;
  for (let i = 0; i < d.length; i++) {
    const v = d[i]; if ((v & 255) !== B.mijnspoor || !((v >> 8) & 16)) continue;
    const x = cx * 16 + (i & 15), z = cz * 16 + ((i >> 4) & 15), y = i >> 8, bron = x + ',' + y + ',' + z;
    WD.karBronnen = WD.karBronnen || [];
    const was = ACTIES.vanBuiten; ACTIES.vanBuiten = true;
    try {
      zetBlok(x, y, z, v & ~(16 << 8));
      if (!WD.karBronnen.includes(bron)) { WD.karBronnen.push(bron); if (WD.karBronnen.length > 400) WD.karBronnen.shift(); karNieuw(x, y, z, bron); }
    } finally { ACTIES.vanBuiten = was; }
    stuurZetten();
  }
}
// een spoor dat net is neergelegd: de stand uit de buren, en de buren draaien mee
function spoorLeg(x, y, z, id, kr) {
  const buur = (dx, dy, dz) => { const v = blokOp(x + dx, y + dy, z + dz); return v < 0 ? 0 : v; };
  return G.spoorKies(buur, kr, id === B.stuwspoor);
}

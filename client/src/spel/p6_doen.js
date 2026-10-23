// ============================================================================
// Doen: richten, hakken, bouwen, gebruiken, deeltjes, losse voorwerpen en overleven
// ============================================================================
let GELUID = null; try { if (typeof RB_GELUID === 'function') GELUID = RB_GELUID(); } catch (e) { GELUID = null; }
function klank(naam, ...a) { if (!GELUID || !inst.geluid) return; try { const f = GELUID[naam]; if (typeof f === 'function') f.apply(GELUID, a); } catch (e) {} }
const mat = v => { const b = BL[v & 255]; return b ? b.geluid : 'steen'; };
// het materiaal onder je voeten: eerst wat je voeten raakt (een plaat, tapijt of trap), anders het blok eronder; op een randje de buurman
function ondergrond() {
  for (const [dx, dz] of [[0, 0], [0.25, 0.25], [-0.25, 0.25], [0.25, -0.25], [-0.25, -0.25]]) {
    const X = Math.floor(sp.x + dx), Z = Math.floor(sp.z + dz);
    for (const dy of [0.05, 0.3]) { const o = blokOp(X, Math.floor(sp.y - dy), Z); if (o > 0 && (o & 255) && (G.VAST[o & 255] || BL[o & 255].vorm === 'tapijt')) return mat(o); }
  }
  return null;
}
function springGeluid() { klank('spring'); uitput(sp.rent ? 0.2 : 0.05); }

// ---------------- richten: welk blok raakt de kijkstraal (ook vormen als trappen en fakkels precies)
function straalDoos(o, d, x0, y0, z0, x1, y1, z1) {
  let tmin = -1e9, tmax = 1e9, as = -1;
  const lo = [x0, y0, z0], hi = [x1, y1, z1];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-9) { if (o[i] < lo[i] || o[i] > hi[i]) return null; continue; }
    let a = (lo[i] - o[i]) / d[i], b = (hi[i] - o[i]) / d[i];
    if (a > b) { const t = a; a = b; b = t; }
    if (a > tmin) { tmin = a; as = i; }
    if (b < tmax) tmax = b;
    if (tmin > tmax) return null;
  }
  if (tmax < 0) return null;
  return [Math.max(0, tmin), as];
}
const buurVan = (X, Y, Z) => (dx, dy, dz) => { const n = blokOp(X + dx, Y + dy, Z + dz); return n < 0 ? 0 : n; };
function richt(o, d, max, metWater) {
  let x = Math.floor(o[0]), y = Math.floor(o[1]), z = Math.floor(o[2]);
  const sx = Math.sign(d[0]) || 1, sy = Math.sign(d[1]) || 1, sz = Math.sign(d[2]) || 1;
  const tdx = Math.abs(1 / (d[0] || 1e-9)), tdy = Math.abs(1 / (d[1] || 1e-9)), tdz = Math.abs(1 / (d[2] || 1e-9));
  let tx = (sx > 0 ? x + 1 - o[0] : o[0] - x) * tdx, ty = (sy > 0 ? y + 1 - o[1] : o[1] - y) * tdy, tz = (sz > 0 ? z + 1 - o[2] : o[2] - z) * tdz;
  for (let i = 0; i < 80; i++) {
    const v = blokOp(x, y, z);
    if (v > 0) {
      const id = v & 255;
      let dozen = null;
      if (id === G.W) { if (metWater && !(v >> 8)) dozen = [[0, 0, 0, 16, 14, 16]]; }
      else dozen = G.kijkDozen(v, buurVan(x, y, z));
      if (dozen) {
        let best = null;
        for (const b of dozen) {
          const r = straalDoos(o, d, x + b[0] / 16, y + b[1] / 16, z + b[2] / 16, x + b[3] / 16, y + b[4] / 16, z + b[5] / 16);
          if (r && (!best || r[0] < best[0])) best = [r[0], r[1], b];
        }
        if (best && best[0] <= max) {
          const n = [0, 0, 0]; n[best[1]] = -Math.sign(d[best[1]]) || 1;
          const p = [o[0] + d[0] * best[0], o[1] + d[1] * best[0], o[2] + d[2] * best[0]];
          return { x, y, z, v, n, t: best[0], p, dozen: dozen.map(b => [x + b[0] / 16, y + b[1] / 16, z + b[2] / 16, x + b[3] / 16, y + b[4] / 16, z + b[5] / 16]) };
        }
      }
    } else if (v < 0) return null;
    let t;
    if (tx < ty && tx < tz) { x += sx; t = tx; tx += tdx; } else if (ty < tz) { y += sy; t = ty; ty += tdy; } else { z += sz; t = tz; tz += tdz; }
    if (t > max) return null;
  }
  return null;
}
let doel = null;
const BEREIK = () => (wereldStand() === 'bouwen' ? 6 : 5);
// je ogen: waar je nu staat, met het schommelen van je hoofd uit het laatste beeldje
function oogPos() { const [bx, by] = camBob; return [sp.x + Math.cos(sp.yaw) * bx, sp.y + sp.oog - sp.stapOp + by, sp.z - Math.sin(sp.yaw) * bx]; }
function kijkVector() { const cp = Math.cos(sp.pitch); return [-Math.sin(sp.yaw) * cp, Math.sin(sp.pitch), -Math.cos(sp.yaw) * cp]; }
let richtScherm = null; // [sx, sy] als je op een telefoon op een plek tikt
function werkDoel() {
  const slot = inHand(), water = slot && slot.id === I.emmer;
  const m = camBeeld(), tik = richtScherm && m !== 2;
  const d = tik ? R.kijkRichting(richtScherm[0], richtScherm[1]) : kijkVector();
  let o = oogPos();
  if (tik && m === 1 && camPlek) {
    // van achteren, tikken: de straal begint bij de camera, maar je bereik telt vanaf je hoofd
    const oog = o, extraAfst = Math.hypot(camPlek[0] - oog[0], camPlek[1] - oog[1], camPlek[2] - oog[2]);
    o = camPlek.slice(); doel = richt(o, d, BEREIK() + extraAfst, water);
    if (doel && Math.hypot(doel.p[0] - oog[0], doel.p[1] - oog[1], doel.p[2] - oog[2]) > BEREIK() + 0.5) doel = null;
  } else {
    // van achteren met het kruisje: vanaf je schouder, precies langs het midden van het beeld
    if (m === 1 && camSchouder) o = [sp.x + camSchouder[0], sp.y + sp.oog + camSchouder[1], sp.z + camSchouder[2]];
    doel = richt(o, d, BEREIK(), water);
  }
  // een karretje dat dichterbij staat dan het blok, gaat voor
  const max = doel ? Math.hypot(doel.p[0] - o[0], doel.p[1] - o[1], doel.p[2] - o[2]) : BEREIK();
  const kk = karOpStraal(o, d, max); doelKar = kk ? kk.kar : null;
  const kb = bewonerOpStraal(o, d, kk ? kk.t : max), was = doelBewoner; doelBewoner = kb ? kb.bewoner : null;
  if (doelBewoner) { doelKar = null; if (doelBewoner !== was) toonNaam(doelBewoner.naam + ' · ' + (TAAL === 'en' ? BEROEP[doelBewoner.beroep].en : BEROEP[doelBewoner.beroep].nl)); }
  if (doelKar || doelBewoner) doel = null;
}

// ---------------- hakken
const hak = { bezig: false, x: 0, y: 0, z: 0, v: -1, voortgang: 0, klop: 0, wacht: 0, zwaai: 0 };
function hakBegin() { hak.bezig = true; hak.voortgang = 0; hak.wacht = 0; zwaai('hak'); }
function hakStop() { hak.bezig = false; hak.voortgang = 0; }
function hakTijd(v, slot) {
  const b = BL[v & 255]; if (!b || b.hard < 0) return -1;
  if (b.hard === 0) return 0;
  const it = slot ? IT[slot.id] : null, g = it && it.gereed ? it : null;
  const juist = !!(g && b.gereed && g.gereed === b.gereed);
  const oogst = !b.klasse || (juist && g.klasse >= b.klasse);
  let t = oogst ? (b.hard * 1.5) / (juist ? g.snel : 1) : b.hard * 5;
  if (!sp.opGrond && !sp.vliegt && !sp.inWater && !sp.opLadder) t *= 2.5;
  if (sp.hoofdOnder) t *= 2;
  return t;
}
function kanOogsten(v, slot) {
  const b = BL[v & 255]; if (!b) return false; if (!b.klasse) return true;
  const it = slot ? IT[slot.id] : null; return !!(it && it.gereed && it.gereed === b.gereed && it.klasse >= b.klasse);
}
function hakTik(dt) {
  if (hak.wacht > 0) hak.wacht -= dt;
  // een bewoner slaan doet geen pijn, maar ze vinden het niet leuk
  if (hak.bezig && doelBewoner && spelActief()) { if (hak.wacht <= 0) { bewonerGetikt(doelBewoner); zwaai('hak'); hak.wacht = 0.8; } return; }
  // een karretje: een paar tikken en het valt los (bij bouwen meteen weg)
  if (hak.bezig && doelKar && spelActief()) {
    if (hak.wacht > 0) return;
    const bouwen = wereldStand() === 'bouwen'; hak.kar = (hak.kar || 0) + dt; hak.klop -= dt;
    if (hak.klop <= 0) { hak.klop = 0.24; klank('hak', 'metaal'); zwaai('hak'); }
    if (bouwen || hak.kar >= 0.6) { const k = doelKar; actie('breek', { kar: k.id }, () => karWeg(k, true)); klank('breek', 'metaal'); hak.kar = 0; hak.wacht = 0.25; doelKar = null; }
    return;
  }
  hak.kar = 0;
  const bezig = hak.bezig && doel && spelActief();
  if (!bezig) { hak.voortgang = 0; hak.v = -1; return; }
  if (doel.x !== hak.x || doel.y !== hak.y || doel.z !== hak.z || doel.v !== hak.v) { hak.x = doel.x; hak.y = doel.y; hak.z = doel.z; hak.v = doel.v; hak.voortgang = 0; }
  if (hak.wacht > 0) return;
  if (wereldStand() === 'bouwen') { breek(doel, true); hak.wacht = 0.22; zwaai('hak'); return; }
  const tijd = hakTijd(doel.v, inHand());
  if (tijd < 0) return;
  hak.voortgang += tijd <= 0 ? 1 : dt / tijd;
  hak.klop -= dt;
  if (hak.klop <= 0) { hak.klop = 0.24; klank('hak', mat(doel.v)); zwaai('hak'); brokjes(doel.x, doel.y, doel.z, doel.v, 2, doel); }
  if (hak.voortgang >= 1) { breek(doel, false); hak.voortgang = 0; hak.wacht = 0.12; uitput(0.005); }
}
// wat levert een blok op
function opbrengst(v, slot) {
  const id = v & 255, b = BL[id], st = v >> 8, r = Math.random;
  if (!b || !kanOogsten(v, slot)) return [];
  const uit = [];
  if (b.sleutel.startsWith('blad_')) {
    const soort = b.sleutel.slice(5).replace(/_oranje|_geel/, '');
    if (r() < 0.06 && B['stekje_' + soort]) uit.push([B['stekje_' + soort], 1]);
    if ((soort === 'eik' || soort === 'esdoorn') && r() < 0.045) uit.push([I.appel, 1]);
    if (soort === 'kers' && r() < 0.09) uit.push([I.kersen, 1]);
    if (soort === 'noten' && r() < 0.07) uit.push([I.walnoot, 1]);
    if (r() < 0.03) uit.push([I.stok, 1]);
    const z = slot && IT[slot.id] && IT[slot.id].gereed === 'zwaard'; if (z && r() < 0.4) uit.push([id, 1]); // met een zwaard krijg je soms de bladeren zelf
    return uit;
  }
  if (id === B.hooggras || id === B.varen) { if (r() < 0.08) uit.push([B.vlas, 1]); if (id === B.hooggras && r() < 0.12) uit.push([I.tarwezaad, 1]); if (id === B.hooggras && r() < 0.03) uit.push([I.bietenzaad, 1]); return uit; }
  if (b.kleur) { uit.push([G.itemVan(v), 1]); if (b.geeft === 0 && b.laag === 1 && b.vorm === 'kubus') uit.length = 0; return uit; }
  if (id === B.bloempot) { uit.push([B.bloempot, 1]); const pl = G.POTPLANT[st]; if (pl) uit.push([pl, 1]); return uit; }
  if (id >= B.gewas_tarwe && id <= B.gewas_pompoen) {
    const rijp = (st & 3) === 3, n2 = (a, b2) => a + Math.floor(r() * (b2 - a + 1));
    if (id === B.gewas_tarwe) { if (rijp) uit.push([I.tarwe, 1], [I.tarwezaad, n2(1, 3)]); else uit.push([I.tarwezaad, 1]); }
    else if (id === B.gewas_aardappel) uit.push([I.aardappel, rijp ? n2(2, 4) : 1]);
    else if (id === B.gewas_wortel) uit.push([I.wortel, rijp ? n2(2, 4) : 1]);
    else if (id === B.gewas_biet) { if (rijp) uit.push([I.suikerbiet, n2(1, 2)], [I.bietenzaad, n2(1, 2)]); else uit.push([I.bietenzaad, 1]); }
    else { if (rijp) { uit.push([B.pompoen, 1]); if (r() < 0.5) uit.push([I.pompoenpit, 1]); } else uit.push([I.pompoenpit, 1]); }
    return uit;
  }
  if (id === B.grind) { uit.push([r() < 0.1 ? I.kolen : B.grind, 1]); return uit; }
  if (id === B.bessenstruik) { uit.push([B.bessenstruik, 1]); if (st & 1) uit.push([I.bessen, 1 + Math.floor(r() * 2)]); return uit; }
  if (b.vorm === 'plaat' && (st & 2)) { uit.push([id, 2]); return uit; }
  if (b.vorm === 'deur' && (st & 8)) return uit; // de onderste helft geeft de deur
  if (b.vorm === 'bed' && (st & 4)) return uit;
  if (id === B.bessentaart) { if (!st) uit.push([B.bessentaart, 1]); return uit; }
  if (id === B.wilgentak && slot && IT[slot.id] && IT[slot.id].gereed === 'zwaard') { uit.push([id, 1]); return uit; }
  const g = b.geeft;
  if (!g) return uit;
  const gid = typeof g === 'string' ? (I[g] !== undefined ? I[g] : B[g]) : g;
  let n = 1;
  if (id === B.erts_kolen) n = 1 + (r() < 0.25 ? 1 : 0);
  if (id === B.erts_koper) n = 1 + Math.floor(r() * 3);
  if (IT[gid]) uit.push([gid, n]);
  return uit;
}
// blokken die van dit blok afhangen (staan erop, hangen eraan)
function afhankelijk(x, y, z) {
  const uit = [];
  const boven = blokOp(x, y + 1, z), bb = BL[boven & 255];
  if (boven > 0 && bb && (bb.vorm === 'kruis' && bb.plaatsOp !== 'hang' || (bb.vorm === 'fakkel' && !(boven >> 8)) || bb.vorm === 'deur' || bb.vorm === 'spoor' || bb.vorm === 'lelie' || bb.vorm === 'cactus' || (bb.vorm === 'lantaarn' && !((boven >> 8) & 1)) || boven === B.bessentaart || (boven & 255) === B.bessentaart)) uit.push([x, y + 1, z]);
  const onder = blokOp(x, y - 1, z), ob = BL[onder & 255];
  if (onder > 0 && ob && ((ob.plaatsOp === 'hang') || (ob.vorm === 'lantaarn' && ((onder >> 8) & 1)))) uit.push([x, y - 1, z]);
  for (let r = 0; r < 4; r++) {
    const [dx, dz] = G.RICHTING[r], n = blokOp(x + dx, y, z + dz), nb = BL[n & 255];
    if (n <= 0 || !nb) continue;
    // fakkel of ladder aan deze muur: die kijkt van de muur af, dus in richting r
    if ((nb.vorm === 'fakkel' && (n >> 8) === r + 1) || (nb.vorm === 'ladder' && ((n >> 8) & 3) === r)) uit.push([x + dx, y, z + dz]);
  }
  return uit;
}
const zetten = [];
function zetBlok(x, y, z, v) { zetKopie(x, y, z, v); zetten.push(x, y, z, v); actieGevolg(['b', x, y, z, v]); }
function stuurZetten() { if (!zetten.length) return; wb.postMessage({ t: 'zet', a: zetten.slice() }); zetten.length = 0; }
// breken, plaatsen en gebruiken zijn acties (zie p6a_acties.js)
function breek(d, bouwen, zonderGeluid, stil) { return actie('breek', { x: d.x, y: d.y, z: d.z, met: inHand() ? inHand().id : 0 }, () => breekNu(d, bouwen, zonderGeluid, stil)); }
function breekNu(d, bouwen, zonderGeluid, stil) {
  const { x, y, z, v } = d, id = v & 255, b = BL[id];
  if (!b || b.hard < 0) return;
  const slot = inHand();
  if (!bouwen) for (const [gid, n] of opbrengst(v, slot)) laatVallen(x + 0.5, y + 0.4, z + 0.5, gid, n);
  if (!bouwen && id >= B.gewas_tarwe && id <= B.gewas_pompoen && ((v >> 8) & 3) === 3 && typeof logboek === 'function') logboek('oogst');
  // ijs smelt tot water als er iets onder ligt
  let nieuw = 0;
  if (id === B.ijs && !bouwen) { const o = blokOp(x, y - 1, z); if (o > 0 && (G.VAST[o & 255] || (o & 255) === G.W)) nieuw = G.W; }
  zetBlok(x, y, z, nieuw);
  // de andere helft van een deur of bed
  if (b.vorm === 'deur') { const oy = (v >> 8) & 8 ? y - 1 : y + 1; if ((blokOp(x, oy, z) & 255) === id) zetBlok(x, oy, z, 0); }
  if (b.vorm === 'bed') { const st = v >> 8, [dx, dz] = G.RICHTING[st & 3], s = st & 4 ? -1 : 1; if ((blokOp(x + dx * s, y, z + dz * s) & 255) === id) zetBlok(x + dx * s, y, z + dz * s, 0); }
  // kist of oven: de inhoud valt eruit (een oude kist die nog dicht was ook)
  if (id === B.buitkist && !bouwen && typeof buitVullen === 'function') buitVullen(x, y, z, v);
  if (typeof inhoudEruit === 'function') inhoudEruit(x, y, z, bouwen);
  for (const [ax, ay, az] of afhankelijk(x, y, z)) { const av = blokOp(ax, ay, az); if (av > 0) breek({ x: ax, y: ay, z: az, v: av }, bouwen, true, true); }
  if (!stil) { brokjes(x, y, z, v, 22); if (!zonderGeluid) klank('breek', mat(v)); }
  if (!bouwen && slot && IT[slot.id] && IT[slot.id].gereed && b.hard > 0) slijt(1);
  stuurZetten();
}

// ---------------- bouwen en gebruiken
function kijkRicht() { const vx = -Math.sin(sp.yaw), vz = -Math.cos(sp.yaw); let best = 0, bd = -2; for (let r = 0; r < 4; r++) { const [dx, dz] = G.RICHTING[r], d = dx * vx + dz * vz; if (d > bd) { bd = d; best = r; } } return best; }
const richtingVan = n => G.RICHTING.findIndex(([dx, dz]) => dx === n[0] && dz === n[2]);
const grondSoort = new Set([B.gras, B.aarde, B.bosgrond, B.sneeuwgras, B.modder]);
function magHier(x, y, z, id) {
  const v = blokOp(x, y, z); if (v < 0) return false;
  const oi = v & 255; if (oi && !BL[oi].vervang) return false;
  if (oi === G.W && BL[id].wasweg) return false;
  if (y <= 0 || y >= HOOG - 1) return false;
  return true;
}
function lijfRaakt(x, y, z, v) {
  const dz = G.botsDozen(v, buurVan(x, y, z)); if (!dz) return false;
  const h = sp.sluipt ? HO_S : HO;
  for (const d of dz) { if (sp.x + BR > x + d[0] / 16 && sp.x - BR < x + d[3] / 16 && sp.y + h > y + d[1] / 16 && sp.y < y + d[4] / 16 && sp.z + BR > z + d[2] / 16 && sp.z - BR < z + d[5] / 16) return true; }
  return false;
}
function plaats(d, slot) { return actie('plaats', { x: d.x, y: d.y, z: d.z, n: d.n, id: slot ? slot.id : 0 }, () => plaatsNu(d, slot)); }
function plaatsNu(d, slot) {
  const it = IT[slot.id]; if (!it || !it.blok) return false;
  const id = it.blok, b = BL[id];
  let x = d.x, y = d.y, z = d.z;
  const tv = d.v, tb = BL[tv & 255];
  const hy = d.p[1] - Math.floor(d.p[1]);
  // halve plaat op een halve plaat van dezelfde soort: een hele
  if (b.vorm === 'plaat' && (tv & 255) === id && !((tv >> 8) & 2)) {
    const boven = (tv >> 8) & 1;
    if ((d.n[1] === 1 && !boven) || (d.n[1] === -1 && boven)) { zetBlok(x, y, z, id | (2 << 8)); klank('plaats', b.geluid); neemUitHand(); stuurZetten(); return true; }
  }
  if (!(tb && tb.vervang && (tv & 255) !== 0 && tv !== 0 && (tv & 255) !== G.W)) { x += d.n[0]; y += d.n[1]; z += d.n[2]; }
  if (!magHier(x, y, z, id)) return false;
  const onder = blokOp(x, y - 1, z), oi = onder & 255, boven = blokOp(x, y + 1, z), bi = boven & 255;
  let st = 0, spoorBuren = null;
  const kr = kijkRicht();
  // waar mag het staan?
  switch (b.plaatsOp) {
    case 'grond': if (!grondSoort.has(oi) && !(id === B.dorre_struik && oi === B.zand)) return false; break;
    case 'zand': if (oi !== B.zand && oi !== id) return false; break;
    case 'vast': if (!G.DICHT[oi] && !(BL[oi] && (BL[oi].vorm === 'tafel' || (BL[oi].vorm === 'plaat' && ((onder >> 8) & 3))))) return false; break;
    case 'akker': if (oi !== B.akker) return false; break;
    case 'vrij': break;
    case 'hang': if (!G.DICHT[bi] && bi !== id) return false; break;
    case 'water': if (oi !== G.W || (onder >> 8)) return false; break;
    case 'riet': { if (oi === id) break; if (!grondSoort.has(oi) && oi !== B.zand) return false; let nat = false; for (const [dx, dz] of G.RICHTING) if ((blokOp(x + dx, y - 1, z + dz) & 255) === G.W) nat = true; if (!nat) return false; break; }
    case 'fakkel': {
      if (d.n[1] === 1 && G.DICHT[oi]) st = 0;
      else if (d.n[1] === 0) { const r = richtingVan(d.n); const muur = blokOp(x - d.n[0], y, z - d.n[2]); if (r < 0 || !G.DICHT[muur & 255]) return false; st = r + 1; }
      else return false;
      break;
    }
  }
  switch (b.stand) {
    case 'richting': st = (kr + 2) % 4; break;
    case 'trap': st = kr | ((d.n[1] === -1 || (d.n[1] === 0 && hy > 0.5)) ? 4 : 0); break;
    case 'plaat': st = (d.n[1] === -1 || (d.n[1] === 0 && hy > 0.5)) ? 1 : 0; break;
    case 'luik': st = ((kr + 2) % 4) | ((d.n[1] === -1 || (d.n[1] === 0 && hy > 0.5)) ? 8 : 0); break;
    case 'muur': { if (d.n[1] !== 0) return false; const r = richtingVan(d.n); const muur = blokOp(x - d.n[0], y, z - d.n[2]); if (!G.DICHT[muur & 255]) return false; st = r; break; }
    case 'lantaarn': st = (d.n[1] === -1 || (!G.VAST[oi] && G.DICHT[bi])) ? 1 : 0; break;
    case 'deur': st = kr; break;
    case 'bed': st = kr; break;
    case 'spoor': { const k = spoorLeg(x, y, z, id, kr); st = k.st; spoorBuren = k.buren; break; }
  }
  if (b.as) st = d.n[0] ? 1 : d.n[2] ? 2 : 0;
  if (it.kleur !== undefined) st = it.kleur;
  const v = id | (st << 8);
  if (G.VAST[id] && lijfRaakt(x, y, z, v)) return false;
  // twee hoog of twee lang
  if (b.vorm === 'deur') {
    if (!magHier(x, y + 1, z, id) || !G.DICHT[oi]) return false;
    const v2 = id | ((st | 8) << 8); if (lijfRaakt(x, y + 1, z, v2)) return false;
    zetBlok(x, y, z, v); zetBlok(x, y + 1, z, v2);
  } else if (b.vorm === 'bed') {
    const [dx, dz] = G.RICHTING[kr]; if (!magHier(x + dx, y, z + dz, id) || !G.VAST[oi] || !G.VAST[blokOp(x + dx, y - 1, z + dz) & 255]) return false;
    zetBlok(x, y, z, v); zetBlok(x + dx, y, z + dz, id | ((st | 4) << 8));
  } else zetBlok(x, y, z, v);
  if (spoorBuren) for (const [dx, dy, dz, w] of spoorBuren) zetBlok(x + dx, y + dy, z + dz, w);
  klank('plaats', b.geluid);
  neemUitHand(); stuurZetten(); zwaai();
  if (typeof telGeplaatst === 'function') { telGeplaatst(); if (b.vorm === 'deur') logboek('deur'); }
  return true;
}
// een bloempot: een plant erin zetten, of de plant er weer uit halen
function potGebruik(d, slot) {
  const st = d.v >> 8;
  if (st) { if (slot && G.POTPLANT.indexOf(slot.id) > 0) return false; zetBlok(d.x, d.y, d.z, B.bloempot); if (wereldStand() !== 'bouwen') laatVallen(d.x + 0.5, d.y + 0.7, d.z + 0.5, G.POTPLANT[st], 1); klank('breek', 'blad'); stuurZetten(); zwaai(); return true; }
  const k = slot ? G.POTPLANT.indexOf(slot.id) : -1;
  if (k <= 0) return false;
  zetBlok(d.x, d.y, d.z, B.bloempot | (k << 8)); neemUitHand(); klank('plaats', 'gras'); stuurZetten(); zwaai(); return true;
}
// met een schoffel maak je van gras of aarde een akker (er moet lucht boven zitten)
function schoffelen(d) {
  if (!d) return;
  const id = d.v & 255; if (id !== B.gras && id !== B.aarde && id !== B.bosgrond && id !== B.sneeuwgras) return;
  const boven = blokOp(d.x, d.y + 1, d.z); if (boven !== 0 && !(BL[boven & 255] && BL[boven & 255].vervang)) return;
  if (boven) zetBlok(d.x, d.y + 1, d.z, 0);
  zetBlok(d.x, d.y, d.z, B.akker); slijt(1); klank('hak', 'aarde'); stuurZetten(); zwaai('hak');
  if (typeof logboek === 'function') logboek('akker');
}
// zaaien: een zaadje (of aardappel, wortel, pit) op een akker
function zaaien(d, slot) {
  const it = IT[slot.id], pb = B[it.plant]; if (!pb) return false;
  let x = d.x, y = d.y, z = d.z;
  if ((d.v & 255) !== B.akker) { if ((blokOp(x, y - 1, z) & 255) === B.akker && (d.v & 255) === 0) y--; else return false; }
  if (blokOp(x, y + 1, z) !== 0) return false;
  zetBlok(x, y + 1, z, pb); neemUitHand(); klank('plaats', 'gras'); stuurZetten(); zwaai();
  return true;
}
function wisselDeur(x, y, z, v) {
  const id = v & 255, st = v >> 8, oy = st & 8 ? y - 1 : y + 1, ander = blokOp(x, oy, z);
  zetBlok(x, y, z, id | ((st ^ 4) << 8));
  if ((ander & 255) === id) zetBlok(x, oy, z, id | (((ander >> 8) ^ 4) << 8));
  klank('deur', !(st & 4)); stuurZetten();
}
function gebruik() { return actie('gebruik', doel ? { x: doel.x, y: doel.y, z: doel.z, met: inHand() ? inHand().id : 0 } : { met: inHand() ? inHand().id : 0 }, gebruikNu); }
function gebruikNu() {
  if (!spelActief() || !wereldKlaar) return;
  const slot = inHand(), it = slot ? IT[slot.id] : null;
  if (doelBewoner) { openRuilen(doelBewoner); return; }
  if (doelKar && !sp.sluipt) { instappen(doelKar); zwaai(); return; }
  if (slot && slot.id === I.karretje) {
    if (doel && G.isSpoor(doel.v & 255) && !(WD.karren || []).some(k => k.bx === doel.x && k.by === doel.y && k.bz === doel.z)) { if (karNieuw(doel.x, doel.y, doel.z)) { neemUitHand(); klank('plaats', 'metaal'); zwaai(); } }
    else if (doel) melding(t('Zet een karretje op een spoor.'), true);
    return;
  }
  // eerst: iets in de wereld dat je kunt gebruiken (sluip om toch te bouwen)
  if (doel && !sp.sluipt) {
    const v = doel.v, id = v & 255, b = BL[id], st = v >> 8;
    if (b.gebruik === 'deur') { wisselDeur(doel.x, doel.y, doel.z, v); zwaai(); return; }
    if (b.gebruik === 'luik') { zetBlok(doel.x, doel.y, doel.z, id | ((st ^ 4) << 8)); klank('deur', !(st & 4)); stuurZetten(); zwaai(); return; }
    if (b.gebruik === 'pot' && potGebruik(doel, slot)) return;
    if (b.gebruik && typeof openBlok === 'function' && openBlok(b.gebruik, doel)) return;
    if (id === B.bessenstruik && (st & 1)) { zetBlok(doel.x, doel.y, doel.z, id); laatVallen(doel.x + 0.5, doel.y + 0.6, doel.z + 0.5, I.bessen, 1 + Math.floor(Math.random() * 2)); klank('breek', 'blad'); stuurZetten(); zwaai(); return; }
  }
  if (!it) return;
  if (it.gereed === 'schoffel') { schoffelen(doel); return; }
  if (it.plant && doel && zaaien(doel, slot)) return;
  if (it.eten) { eetBegin(); return; }
  if (slot.id === I.emmer) {
    if (doel && (doel.v & 255) === G.W && !(doel.v >> 8)) { zetBlok(doel.x, doel.y, doel.z, 0); stuurZetten(); vervangInHand(I.emmer_water); klank('vult'); zwaai(); }
    return;
  }
  if (slot.id === I.emmer_water) {
    if (!doel) return;
    let x = doel.x + doel.n[0], y = doel.y + doel.n[1], z = doel.z + doel.n[2];
    const tb = BL[doel.v & 255]; if (tb && tb.vervang && (doel.v & 255) !== G.W) { x = doel.x; y = doel.y; z = doel.z; }
    const v = blokOp(x, y, z); if (v < 0 || (v && !BL[v & 255].vervang && !BL[v & 255].wasweg)) return;
    if (v && BL[v & 255].wasweg) laatVallen(x + 0.5, y + 0.3, z + 0.5, v);
    zetBlok(x, y, z, G.W); stuurZetten();
    if (wereldStand() !== 'bouwen') vervangInHand(I.emmer);
    klank('giet'); zwaai(); return;
  }
  if (it.blok && doel) plaats(doel, slot);
}
// middelste muisknop: pak het blok waar je naar kijkt (bouwen: altijd; overleven: als je het hebt)
function kiesBlok() {
  if (!doel) return; let id = G.itemVan(doel.v); if (!id) { const g = BL[doel.v & 255] && BL[doel.v & 255].geeft; id = typeof g === 'number' && IT[g] ? g : 0; }
  if (!id) return;
  const i = WD.inv.findIndex((s, j) => j < 9 && s && s.id === id);
  if (i >= 0) { kies(i); return; }
  if (wereldStand() === 'bouwen') { WD.inv[WD.kies] = { id, n: IT[id].stapel || 64 }; rugzakVeranderd(); kies(WD.kies); }
  else { const j = WD.inv.findIndex(s => s && s.id === id); if (j >= 9) { const t = WD.inv[WD.kies]; WD.inv[WD.kies] = WD.inv[j]; WD.inv[j] = t; rugzakVeranderd(); kies(WD.kies); } }
}

// ---------------- eten
const eet = { bezig: false, t: 0 };
function eetBegin() {
  const slot = inHand(); if (!slot || !IT[slot.id].eten) return;
  if (wereldStand() !== 'bouwen' && WD.speler.honger >= 20) { melding(t('Je hebt geen honger.'), true); return; }
  eet.bezig = true; eet.t = 0;
}
function eetTik(dt) {
  if (!eet.bezig) return;
  const slot = inHand();
  if (!slot || !IT[slot.id].eten || !(bouwKnop || houdGebruik)) { eet.bezig = false; return; }
  eet.t += dt; if (Math.floor(eet.t * 5) !== Math.floor((eet.t - dt) * 5)) { klank('eet'); brokjesDing(slot.id); }
  if (eet.t >= 1.3) {
    const it = IT[slot.id]; eet.bezig = false;
    const s = WD.speler; s.honger = Math.min(20, s.honger + it.eten); s.verzadiging = Math.min(s.honger, (s.verzadiging || 0) + it.eten * 0.6);
    neemUitHand(); if (it.rest) geefOfLaatVallen(I[it.rest], 1);
    if (typeof logboek === 'function') logboek('eten');
    klank('slik'); melding(t('Mmm,') + ' ' + naam(it.id).toLowerCase() + '!', true);
  }
}
let houdGebruik = false;

// ---------------- deeltjes (brokjes)
const DEELTJES = new Float32Array(600 * 8), dp = []; // dp: {x,y,z,vx,vy,vz,t,max,laag,u,v,s}
function brokjes(x, y, z, v, n, d) {
  const b = BL[v & 255]; if (!b) return;
  const laag = b.vorm === 'kruis' || b.vorm === 'fakkel' ? b.tz : b.tz;
  for (let i = 0; i < n && dp.length < 600; i++) {
    let px = x + 0.15 + Math.random() * 0.7, py = y + 0.15 + Math.random() * 0.7, pz = z + 0.15 + Math.random() * 0.7;
    if (d && n < 5) { px = d.p[0] + d.n[0] * 0.08 + (Math.random() - 0.5) * 0.3; py = d.p[1] + d.n[1] * 0.08 + (Math.random() - 0.5) * 0.3; pz = d.p[2] + d.n[2] * 0.08 + (Math.random() - 0.5) * 0.3; }
    dp.push({ x: px, y: py, z: pz, vx: (Math.random() - 0.5) * 3, vy: Math.random() * 3 + 1, vz: (Math.random() - 0.5) * 3, t: 0, max: 0.5 + Math.random() * 0.6, laag, u: Math.random() * 0.75, v: Math.random() * 0.75, s: 0.06 + Math.random() * 0.06 });
  }
}
function brokjesDing(id) {
  const it = IT[id]; if (!it) return; const laag = it.ding ? it.tex + 256 : it.tex; const o = oogPos(), k = kijkVector();
  for (let i = 0; i < 4; i++) dp.push({ x: o[0] + k[0] * 0.5, y: o[1] - 0.25 + k[1] * 0.5, z: o[2] + k[2] * 0.5, vx: (Math.random() - 0.5) * 1.5 + k[0], vy: Math.random() * 1.5, vz: (Math.random() - 0.5) * 1.5 + k[2], t: 0, max: 0.5, laag, u: Math.random() * 0.75, v: Math.random() * 0.75, s: 0.05 });
}
function deeltjesTik(dt) {
  let o = 0;
  for (let i = dp.length - 1; i >= 0; i--) {
    const p = dp[i]; p.t += dt; if (p.t > p.max) { dp.splice(i, 1); continue; }
    p.vy -= 16 * dt; const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt, nz = p.z + p.vz * dt;
    const v = blokOp(Math.floor(nx), Math.floor(ny), Math.floor(nz));
    if (v !== 0 && v > 0 && G.VAST[v & 255]) { p.vx *= 0.3; p.vz *= 0.3; p.vy = 0; } else { p.x = nx; p.y = ny; p.z = nz; }
  }
  for (const p of dp) {
    const l = lichtOp(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z));
    DEELTJES[o++] = p.x; DEELTJES[o++] = p.y; DEELTJES[o++] = p.z; DEELTJES[o++] = p.s * (1 - Math.max(0, p.t / p.max - 0.7) * 2);
    DEELTJES[o++] = p.u; DEELTJES[o++] = p.v; DEELTJES[o++] = p.laag; DEELTJES[o++] = (l >> 4) * 16 + (l & 15);
  }
  return dp.length;
}

// ---------------- losse voorwerpen op de grond (en achtergelaten rugzakken)
const losse = [];
function laatVallen(x, y, z, idOfV, n, dur) {
  let id = idOfV;
  if (n === undefined) { // waarde van een weggespoeld blok
    const v = idOfV, opb = opbrengst(v, null); for (const [g, k] of opb) laatVallen(x, y, z, g, k); return;
  }
  if (!IT[id] || wereldStand() === 'bouwen') return;
  actieGevolg(['l', Math.round(x * 100) / 100, Math.round(y * 100) / 100, Math.round(z * 100) / 100, id, n, dur || 0]);
  if (losse.length > 250) losse.shift();
  losse.push({ id, n, dur, x, y, z, vx: (Math.random() - 0.5) * 2.2, vy: 2.5 + Math.random(), vz: (Math.random() - 0.5) * 2.2, leeftijd: 0, wacht: 0.4, draai: Math.random() * 6 });
}
function gooi(slot, n) {
  const k = kijkVector(), o = oogPos();
  actieGevolg(['l', Math.round((o[0] + k[0] * 0.4) * 100) / 100, Math.round((o[1] - 0.3) * 100) / 100, Math.round((o[2] + k[2] * 0.4) * 100) / 100, slot.id, n, slot.dur || 0]);
  losse.push({ id: slot.id, n, dur: slot.dur, x: o[0] + k[0] * 0.4, y: o[1] - 0.3 + k[1] * 0.4, z: o[2] + k[2] * 0.4, vx: k[0] * 5, vy: k[1] * 5 + 1.6, vz: k[2] * 5, leeftijd: 0, wacht: 1.5, draai: 0 });
}
function losseTik(dt) {
  const cx = sp.x, cy = sp.y + 0.8, cz = sp.z;
  for (let i = losse.length - 1; i >= 0; i--) {
    const d = losse[i]; d.leeftijd += dt; d.wacht -= dt; d.draai += dt * 1.6;
    if (d.leeftijd > 300 && !d.rugzak) { losse.splice(i, 1); continue; }
    const dx = cx - d.x, dy = cy - d.y, dz = cz - d.z, af = Math.hypot(dx, dy, dz);
    if (d.wacht <= 0 && af < 2.2 && WD.speler.hp > 0) {
      // naar de speler toe zweven
      d.vx += dx / af * 18 * dt; d.vy += dy / af * 18 * dt; d.vz += dz / af * 18 * dt;
      if (af < 1.0) { if (pakOp(d)) { losse.splice(i, 1); continue; } }
    }
    const v = blokOp(Math.floor(d.x), Math.floor(d.y - 0.12), Math.floor(d.z)), inW = (blokOp(Math.floor(d.x), Math.floor(d.y), Math.floor(d.z)) & 255) === G.W;
    if (inW) { d.vy += (3 - d.vy) * dt * 2; d.vx *= 0.96; d.vz *= 0.96; } else d.vy -= 20 * dt;
    let nx = d.x + d.vx * dt, ny = d.y + d.vy * dt, nz = d.z + d.vz * dt;
    const vast = (x, y, z) => { const b = blokOp(Math.floor(x), Math.floor(y), Math.floor(z)); return b < 0 || (b > 0 && G.VAST[b & 255] && G.DICHT[b & 255]); };
    if (vast(nx, d.y, d.z)) { d.vx *= -0.3; nx = d.x; }
    if (vast(d.x, d.y, nz)) { d.vz *= -0.3; nz = d.z; }
    if (vast(nx, ny - 0.12, nz)) { ny = Math.floor(ny - 0.12) + 1.12; d.vy = 0; d.vx *= 0.82; d.vz *= 0.82; }
    if (vast(nx, ny, nz)) { ny = Math.floor(ny) + 1.12; d.vy = 0; }
    d.x = nx; d.y = ny; d.z = nz;
    if (d.y < -10) losse.splice(i, 1);
  }
}
function pakOp(d) {
  if (d.rugzak) {
    let alles = true;
    for (let i = 0; i < d.inhoud.length; i++) { const s = d.inhoud[i]; if (!s) continue; const rest = geef(s.id, s.n, s.dur); if (rest) { s.n = rest; alles = false; } else d.inhoud[i] = null; }
    if (alles) { WD.rugzakken = (WD.rugzakken || []).filter(r => r !== d.bron); klank('ontdek'); melding(t('Je hebt je rugzak terug!'), false); rugzakVeranderd(); return true; }
    d.wacht = 2; rugzakVeranderd(); melding(t('Je rugzak is vol. Er ligt nog wat in je oude rugzak.'), true); return false;
  }
  const rest = geef(d.id, d.n, d.dur);
  if (rest === d.n) return false;
  klank('oppak');
  if (rest) { d.n = rest; return false; }
  return true;
}
function rugzakkenLaden() {
  for (const r of WD.rugzakken || []) losse.push({ rugzak: true, bron: r, inhoud: r.inhoud, id: I.rugzak, n: 1, x: r.x, y: r.y, z: r.z, vx: 0, vy: 0, vz: 0, leeftijd: 0, wacht: 1, draai: 0 });
}

// ---------------- overleven: levens, honger, adem
function uitput(n) { if (wereldStand() === 'bouwen' || !WD) return; const s = WD.speler; s.uitputting = (s.uitputting || 0) + n; while (s.uitputting >= 4) { s.uitputting -= 4; if ((s.verzadiging || 0) > 0) s.verzadiging = Math.max(0, s.verzadiging - 1); else s.honger = Math.max(0, s.honger - 1); } }
function honger() { return WD ? WD.speler.honger : 20; }
let rood = 0;
function schade(n, reden) {
  if (!WD || wereldStand() === 'bouwen' || WD.speler.hp <= 0 || n <= 0) return;
  const s = WD.speler; s.hp = Math.max(0, s.hp - n); rood = 1; klank('au'); uitput(0.1);
  if (!minderBeweging) schud = 0.25;
  if (s.hp <= 0) flauwvallen(reden);
}
let schud = 0;
function landen(afstand, snelheid) {
  if (afstand > 0.6) klank('land', Math.min(1, afstand / 8));
  if (sp.inWater) { if (afstand > 2) klank('plons', afstand > 6); return; }
  const onder = blokOp(Math.floor(sp.x), Math.floor(sp.y - 0.2), Math.floor(sp.z)) & 255;
  let d = Math.floor(afstand - 3.2);
  if (onder === B.hooi) d = Math.floor(d * 0.2);
  // vlak na het laden van een wereld: geen valschade (bijvoorbeeld als er nu een nieuwe grot onder je plek ligt)
  if (performance.now() < valVrijTot) d = 0;
  if (d > 0) schade(d, 'val');
}
let tik1 = 0, tikAdem = 0, tikCactus = 0, valVrijTot = 0;
function overleefTik(dt) {
  if (!WD || wereldStand() === 'bouwen') return;
  const s = WD.speler; if (s.hp <= 0) return;
  // adem onder water
  if (sp.hoofdOnder) { s.adem = Math.max(0, s.adem - dt / 1.5); if (s.adem <= 0) { tikAdem += dt; if (tikAdem > 1) { tikAdem = 0; schade(2, 'water'); } } }
  else s.adem = Math.min(10, s.adem + dt * 5);
  // cactus prikt
  tikCactus -= dt;
  if (tikCactus <= 0) { for (const [dx, dz] of [[BR + 0.05, 0], [-BR - 0.05, 0], [0, BR + 0.05], [0, -BR - 0.05], [0, 0]]) { const b = blokOp(Math.floor(sp.x + dx), Math.floor(sp.y + (dx || dz ? 0.5 : -0.05)), Math.floor(sp.z + dz)); if ((b & 255) === B.cactus) { schade(1, 'cactus'); tikCactus = 0.6; break; } } }
  // honger en herstel
  const hs = Math.hypot(sp.vx, sp.vz); if (sp.opGrond || sp.inWater) uitput(hs * dt * (sp.rent ? 0.1 : sp.inWater ? 0.015 : 0.01));
  tik1 += dt;
  if (tik1 > 2.5) {
    tik1 = 0;
    if (s.honger >= 18 && s.hp < 20) { s.hp = Math.min(20, s.hp + 1); uitput(1.5); }
    else if (s.honger <= 0 && s.hp > 1) schade(1, 'honger');
  }
}
function flauwvallen(reden) {
  const s = WD.speler;
  // alles blijft achter in een rugzak op de plek waar je viel (in water komt hij boven drijven)
  const inhoud = WD.inv.filter(Boolean).map(x => Object.assign({}, x));
  if (inhoud.length) {
    let y = sp.y + 0.5; for (let i = 0; i < 40 && (blokOp(Math.floor(sp.x), Math.floor(y), Math.floor(sp.z)) & 255) === G.W; i++) y += 1;
    const r = { x: sp.x, y, z: sp.z, inhoud, dag: WD.dag || 0 };
    WD.rugzakken = WD.rugzakken || []; WD.rugzakken.push(r);
    losse.push({ rugzak: true, bron: r, inhoud: r.inhoud, id: I.rugzak, n: 1, x: r.x, y: r.y, z: r.z, vx: 0, vy: 0, vz: 0, leeftijd: 0, wacht: 3, draai: 0 });
  }
  for (let i = 0; i < WD.inv.length; i++) WD.inv[i] = null;
  rugzakVeranderd(); hakStop(); eet.bezig = false;
  klank('dood');
  if (typeof toonDood === 'function') toonDood(reden, inhoud.length > 0);
}
function wakkerWorden() {
  const s = WD.speler; s.hp = 20; s.honger = 20; s.verzadiging = 5; s.adem = 10; s.uitputting = 0;
  const p = s.bed || s.start; sp.x = p[0]; sp.y = p[1]; sp.z = p[2]; sp.vx = sp.vy = sp.vz = 0; sp.valStart = null;
  wereldKlaar = false; vertelPlek(performance.now(), true);
}

// ---------------- zwaaien met je hand, en wat er elk beeldje gebeurt
let zwaaiT = 1, wisselT = 0, vorigeHand = -1, zwaaiSoort = 'bouw';
function zwaai(soort) { if (zwaaiT >= 0.6) { zwaaiT = 0; zwaaiSoort = soort || 'bouw'; } }
// huidskleuren voor de arm (instelling 'huid')
const HUID = ['#F1D3BC', '#E3B591', '#C68C62', '#A36A45', '#7B4B2E', '#4F3020'].map(c => [parseInt(c.slice(1, 3), 16) / 255, parseInt(c.slice(3, 5), 16) / 255, parseInt(c.slice(5, 7), 16) / 255]);
let stapAfstand = 0, vorigeStap = 0;
function spelTik(dt, nu) {
  if (!wereldKlaar) return;
  if (spelActief()) werkDoel(); else doel = null;
  hakTik(dt); eetTik(dt);
  if (bouwKnop && !eet.bezig && nu > bouwHerhaal) { bouwHerhaal = nu + 210; gebruik(); }
  overleefTik(dt);
  losseTik(dt);
  karTik(dt); karDuwen(); bewonersTik(dt);
  zwaaiT = Math.min(1, zwaaiT + dt * 3.2);
  rood = Math.max(0, rood - dt * 2.5); schud = Math.max(0, schud - dt);
  // stappen
  const hs = Math.hypot(sp.vx, sp.vz);
  // een stapgeluid precies als je voet neerkomt: dan staat het hoofd het laagst in de loopschommel
  const stapNr = Math.floor((sp.schommelT - Math.PI / 2) / Math.PI);
  if (stapNr !== vorigeStap) {
    if (stapNr > vorigeStap && sp.opGrond && hs > 0.8 && !sp.vliegt && !sp.hoofdOnder) {
      // door ondiep water plonst het; anders klinkt de ondergrond waar je op staat (ook een tapijt of plaat), en sluipen is zachter
      const m = sp.inWater ? 'water' : ondergrond();
      if (m) klank('stap', m, sp.sluipt ? 0.3 : sp.rent ? 0.62 : 0.55, sp.rent);
    }
    vorigeStap = stapNr;
  }
  if (sp.inWater && !sp.opGrond && hs > 0.8) { stapAfstand += hs * dt; if (stapAfstand > 2.2) { stapAfstand = 0; klank('zwem'); } }
  if (typeof ovenTik === 'function') ovenTik(dt);
}
function tekenExtra(dt, C) {
  const dingen = [];
  for (const d of losse) {
    const l = lichtOp(Math.floor(d.x), Math.floor(d.y + 0.2), Math.floor(d.z)), L = lichtKleur(l);
    const op = Math.sin(d.leeftijd * 2.2 + d.draai) * 0.06;
    dingen.push({ id: d.id, x: d.x, y: d.y + 0.1 + op + (d.rugzak ? 0.15 : 0), z: d.z, schaal: d.rugzak ? 0.55 : 0.26, draai: d.draai, licht: L });
  }
  let kader = null;
  if (doel && spelActief() && !(aanraak && !doelZichtbaar)) kader = { dozen: doel.dozen, barst: hak.bezig && hak.voortgang > 0 && wereldStand() !== 'bouwen' ? Math.floor(hak.voortgang * 10) : -1 };
  else if (doelKar && spelActief() && !(aanraak && !doelZichtbaar)) { const k = doelKar; kader = { dozen: [[k.x - 0.45, k.y, k.z - 0.45, k.x + 0.45, k.y + 0.65, k.z + 0.45]], barst: -1 }; }
  const wezens = []; karrenTeken(wezens); bewonersTeken(wezens);
  // de arm: altijd in beeld, met wat je in de snelbalk hebt gekozen (of een lege hand)
  const slot = inHand(), nuId = slot ? slot.id : 0;
  if (nuId !== vorigeHand) { if (vorigeHand !== -1) wisselT = 1; vorigeHand = nuId; }
  wisselT = Math.max(0, wisselT - dt * 4);
  const l = lichtOp(Math.floor(sp.x), Math.floor(sp.y + 1.2), Math.floor(sp.z));
  const hakt = hak.bezig && wereldStand() !== 'bouwen' && doel;
  const hand = {
    id: nuId, zwaai: hakt ? (performance.now() / 300 % 1) : zwaaiT >= 1 ? 0 : zwaaiT, soort: hakt ? 'hak' : zwaaiSoort,
    fase: sp.schommelT, schommel: schommelSterkte() * sp.schommel, ren: minderBeweging ? 0 : klem(sp.renMix, 0, 1), wissel: wisselT, eet: eet.bezig ? eet.t : -1,
    tijd: performance.now() / 1000, stil: minderBeweging, licht: lichtKleur(l), huid: HUID[inst.huid] || HUID[1],
  };
  popArm(hand);
  if (handProef) Object.assign(hand, handProef);
  // van achteren of van voren zie je jezelf, en geen arm in beeld
  if (camBeeld()) popTeken(wezens, hand.licht, hand);
  const n = deeltjesTik(dt);
  if (schud > 0) C.schud = [(Math.random() - 0.5) * schud * 0.06, (Math.random() - 0.5) * schud * 0.06];
  return { dingen, kader, hand: camBeeld() ? null : hand, wezens, deeltjes: { n, a: DEELTJES } };
}
let doelZichtbaar = true, handProef = null; // handProef: alleen voor tests (een vaste houding van de arm)
// licht op een plek als kleur, voor voorwerpen en de hand
function lichtKleur(l) {
  const L = laatsteLucht || { zonKleur: [1, 1, 1], fakKleur: [1, 0.8, 0.55], min: 0.03 };
  const z = Math.pow(0.8, 15 - (l >> 4)), f = Math.pow(0.8, 15 - (l & 15)) * (L.flakker || 1);
  return [Math.max(L.min, L.zonKleur[0] * z, L.fakKleur[0] * f), Math.max(L.min, L.zonKleur[1] * z, L.fakKleur[1] * f), Math.max(L.min, L.zonKleur[2] * z, L.fakKleur[2] * f)];
}
let laatsteLucht = null;

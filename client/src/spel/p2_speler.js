// ============================================================================
// De speler: lopen, springen, sluipen, zwemmen, klimmen en vliegen, en botsen met de blokken.
// ============================================================================
const sp = {
  x: 0.5, y: 80, z: 0.5, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, opGrond: false, vliegt: false, sluipt: false, rent: false,
  inWater: false, hoofdOnder: false, opLadder: false, inWeb: false, sprongen: 0, valStart: null, oog: 1.62, oogDoel: 1.62, stapOp: 0, schommel: 0, schommelT: 0, loopAfstand: 0,
  renMix: 0, renV: 0, fovExtra: 0, fovV: 0, // zacht overgaan tussen wandelen en rennen (0 = wandelen, 1 = rennen) en de extra kijkhoek daarbij
};
const BR = 0.3, HO = 1.8, HO_S = 1.5;
// de dozen waarmee je kunt botsen rond een plek (in blokken)
function botsBlok(X, Y, Z) {
  const v = blokOp(X, Y, Z);
  if (v < 0) return [[0, 0, 0, 1, 1, 1]]; // nog niet geladen: vast, zodat je nergens doorheen valt
  const id = v & 255; if (!id || !(G.VAST[id] || id === B.waterlelie)) return null;
  const b = BL[id];
  if (b.vorm === 'kubus') return VOLLE;
  const d = G.botsDozen(v, (dx, dy, dz) => { const n = blokOp(X + dx, Y + dy, Z + dz); return n < 0 ? 0 : n; });
  return d ? d.map(a => a.map(q => q / 16)) : null;
}
const VOLLE = [[0, 0, 0, 1, 1, 1]];
function raakt(x, y, z, h) {
  // raakt het lijf (x, y = voeten, z) een blok?
  const x0 = Math.floor(x - BR), x1 = Math.floor(x + BR), y0 = Math.floor(y), y1 = Math.floor(y + h - 0.001), z0 = Math.floor(z - BR), z1 = Math.floor(z + BR);
  for (let X = x0; X <= x1; X++) for (let Y = y0 - 1; Y <= y1; Y++) for (let Z = z0; Z <= z1; Z++) {
    const dz = botsBlok(X, Y, Z); if (!dz) continue;
    for (const d of dz) {
      if (x + BR > X + d[0] && x - BR < X + d[3] && y + h > Y + d[1] && y < Y + d[4] && z + BR > Z + d[2] && z - BR < Z + d[5]) return true;
    }
  }
  return false;
}
function staatOp(x, y, z) { return raakt(x, y - 0.05, z, 0.05); }
// water rond een punt: hoe hoog staat het en welke kant stroomt het op
const WH = [14, 12, 11, 9, 7, 5, 4, 2];
function waterHoogte(X, Y, Z) { const v = blokOp(X, Y, Z); if ((v & 255) !== G.W) return -1; if ((blokOp(X, Y + 1, Z) & 255) === G.W) return 1; return WH[(v >> 8) & 7] / 16; }
function stroming(X, Y, Z) { return G.WEZENS.stroming(blokOp, X, Y, Z); }
function cel(id) { return (x, y, z) => (blokOp(Math.floor(x), Math.floor(y), Math.floor(z)) & 255) === id; }
const isWaterOp = cel(G.W);
// een ladder of klimop vlak bij je lijf: daar kun je langs omhoog en omlaag klimmen
function ladderBij(x, y, z, h) {
  for (let Y = Math.floor(y); Y <= Math.floor(y + h * 0.7); Y++) for (let X = Math.floor(x - BR - 0.05); X <= Math.floor(x + BR + 0.05); X++) for (let Z = Math.floor(z - BR - 0.05); Z <= Math.floor(z + BR + 0.05); Z++) {
    const v = blokOp(X, Y, Z); if (v > 0 && BL[v & 255] && BL[v & 255].klim) return true;
  }
  return false;
}
// zit je lijf in een spinnenweb?
function inWeb(x, y, z, h) {
  for (let Y = Math.floor(y); Y <= Math.floor(y + h - 0.001); Y++) for (let X = Math.floor(x - BR); X <= Math.floor(x + BR); X++) for (let Z = Math.floor(z - BR); Z <= Math.floor(z + BR); Z++) {
    if ((blokOp(X, Y, Z) & 255) === B.spinnenweb) return true;
  }
  return false;
}
// hoe ver je hooguit vanzelf opstapt: eerst een klein beetje (een tapijt of mostapijt van een pixel hoog, ook in een lage
// gang), dan een half blok (platen, traptreden), en een heel blok alleen met de instelling 'Vanzelf opstappen'
const OPSTAP = [0.07, 0.14, 0.27, 0.5, 0.6, 1.0, 1.1];
// ---------------- één stapje natuurkunde
function beweeg(dt, inv) {
  // inv: { voor, opzij (-1..1), spring, sluip, rent, omhoog, omlaag }
  // in een karretje rijdt het karretje, niet jij (zie p6b_karren.js)
  if (rijdtIn && karBeweeg(dt, inv)) return;
  const bouwen = wereldStand() === 'bouwen';
  if (!bouwen) sp.vliegt = false;
  const h = sp.sluipt && !sp.vliegt ? HO_S : HO;
  sp.sluipt = !!inv.sluip && !sp.vliegt;
  const voeten = waterHoogte(Math.floor(sp.x), Math.floor(sp.y + 0.1), Math.floor(sp.z));
  sp.inWater = voeten >= 0 || isWaterOp(sp.x, sp.y + 0.9, sp.z);
  const oogY = sp.y + sp.oog, hw = waterHoogte(Math.floor(sp.x), Math.floor(oogY), Math.floor(sp.z));
  sp.hoofdOnder = hw >= 0 && oogY - Math.floor(oogY) < hw + 0.02;
  sp.opLadder = !sp.vliegt && ladderBij(sp.x, sp.y, sp.z, h);
  sp.inWeb = !sp.vliegt && inWeb(sp.x, sp.y, sp.z, h);
  // gewenste snelheid
  let vw = inv.voor, ow = inv.opzij; const l = Math.hypot(vw, ow); if (l > 1) { vw /= l; ow /= l; }
  sp.rent = (inv.rent || sp.rent) && vw > 0.3 && !sp.sluipt && (bouwen || honger() > 6);
  // de overgang tussen wandelen en rennen gaat geleidelijk (snelheid, kijkhoek, passen en de arm), beide kanten op
  // (een kritisch gedempte veer: begint en eindigt zacht, en schiet nooit door)
  [sp.renMix, sp.renV] = veer(sp.renMix, sp.renV, sp.rent ? 1 : 0, sp.rent ? 7 : 5.5, dt);
  const rm = klem(sp.renMix, 0, 1);
  let snel = sp.vliegt ? 10.5 + 10.5 * rm : sp.inWater ? 2.5 + 1.1 * rm : sp.sluipt ? 1.55 : 4.3 + 1.5 * rm;
  if (sp.inWeb) snel *= 0.18;
  const sy = Math.sin(sp.yaw), cy = Math.cos(sp.yaw);
  const wx = (ow * cy - vw * sy) * snel, wz = (-ow * sy - vw * cy) * snel;
  const grip = sp.vliegt ? 8 : sp.opGrond ? 16 : sp.inWater ? 5 : 2.6;
  const k = 1 - Math.exp(-grip * dt);
  sp.vx += (wx - sp.vx) * k; sp.vz += (wz - sp.vz) * k;
  // verticaal
  if (sp.vliegt) {
    const vy = ((inv.spring || inv.omhoog) ? 9 : 0) - ((inv.sluip || inv.omlaag) ? 9 : 0);
    sp.vy += (vy - sp.vy) * (1 - Math.exp(-10 * dt));
  } else if (sp.opLadder) {
    if (inv.spring || vw > 0.2) sp.vy = 3.2; else if (sp.sluipt) sp.vy = 0; else sp.vy = Math.max(sp.vy - 28 * dt, -2.2);
  } else if (sp.inWater) {
    sp.vy -= 6 * dt; sp.vy *= Math.exp(-2.8 * dt);
    if (inv.spring) sp.vy = Math.min(sp.vy + 26 * dt, 3.6);
    if (inv.sluip) sp.vy = Math.max(sp.vy - 18 * dt, -3.4);
    // stroming neemt je mee
    const [fx, fz] = stroming(Math.floor(sp.x), Math.floor(sp.y + 0.1), Math.floor(sp.z));
    sp.vx += fx * 9 * dt; sp.vz += fz * 9 * dt;
    // net onder het oppervlak tegen de kant: omhoog klauteren
    if (inv.spring && (raakt(sp.x + Math.sign(sp.vx) * 0.12, sp.y, sp.z, h) || raakt(sp.x, sp.y, sp.z + Math.sign(sp.vz) * 0.12, h)) && !isWaterOp(sp.x, sp.y + 1.5, sp.z)) sp.vy = 5.6;
    sp.valStart = null;
  } else {
    sp.vy = Math.max(-50, sp.vy - 28 * dt);
    if (inv.spring && sp.opGrond && !sp.inWeb) { sp.vy = 8.6; sp.opGrond = false; sp.sprongen = (sp.sprongen || 0) + 1; if (sp.rent) { sp.vx += -sy * 1.2; sp.vz += -cy * 1.2; } springGeluid(); }
  }
  // in een spinnenweb kom je bijna niet vooruit, en val je langzaam
  if (sp.inWeb) {
    const hs = Math.hypot(sp.vx, sp.vz), mx = 0.9; if (hs > mx) { sp.vx *= mx / hs; sp.vz *= mx / hs; }
    sp.vy = klem(sp.vy, -1.1, inv.spring || sp.opLadder ? 1.2 : 0.4);
    sp.valStart = null;
  }
  // botsen, as voor as, in kleine stapjes zodat je nergens doorheen schiet
  const stappen = Math.max(1, Math.ceil(Math.max(Math.abs(sp.vx), Math.abs(sp.vy), Math.abs(sp.vz)) * dt / 0.35));
  const sdt = dt / stappen;
  let land = false, valSnelheid = 0;
  for (let s = 0; s < stappen; s++) {
    // y
    let ny = sp.y + sp.vy * sdt;
    if (raakt(sp.x, ny, sp.z, h)) {
      if (sp.vy < 0) { land = true; valSnelheid = sp.vy; let lo = sp.y; for (let i = 0; i < 6 && !raakt(sp.x, lo - 0.02, sp.z, h); i++) lo -= 0.02; ny = lo; }
      else ny = sp.y;
      sp.vy = 0;
    }
    sp.y = ny;
    const grond = land || (sp.vy <= 0 && staatOp(sp.x, sp.y, sp.z));
    // x en z, met opstappen (traptreden, halve blokken) en niet van randjes vallen bij sluipen
    for (const as of ['x', 'z']) {
      const v = as === 'x' ? sp.vx : sp.vz; if (!v) continue;
      const nx = as === 'x' ? sp.x + v * sdt : sp.x, nz = as === 'z' ? sp.z + v * sdt : sp.z;
      if (sp.sluipt && grond && !staatOp(nx, sp.y, nz) && !raakt(nx, sp.y, nz, h)) { if (as === 'x') sp.vx = 0; else sp.vz = 0; continue; }
      if (!raakt(nx, sp.y, nz, h)) { sp.x = nx; sp.z = nz; continue; }
      // opstappen: alleen op halve blokken (platen, traptreden). Een heel blok kan alleen met de instelling 'Vanzelf opstappen'.
      let opgestapt = false;
      if (grond || sp.inWater) for (const op of OPSTAP) {
        if (op >= 1 && !inst.opstappen) break;
        if (!raakt(nx, sp.y + op, nz, h) && !raakt(sp.x, sp.y + op, sp.z, h)) {
          let y2 = sp.y + op; for (let i = 0; i < 30 && !raakt(nx, y2 - 0.02, nz, h); i++) y2 -= 0.02;
          sp.stapOp += y2 - sp.y; sp.y = y2; sp.x = nx; sp.z = nz; opgestapt = true; break;
        }
      }
      if (!opgestapt) { if (as === 'x') sp.vx = 0; else sp.vz = 0; }
    }
  }
  const wasGrond = sp.opGrond;
  // op de grond staan telt alleen als je niet omhoog gaat: vlak na een sprong ben je nog maar een paar centimeter los
  // (op een snel scherm minder dan de 5 cm van staatOp), en dan kon je met de spatiebalk ingedrukt nog een keer springen
  sp.opGrond = sp.vy <= 0 && staatOp(sp.x, sp.y, sp.z);
  if (sp.opGrond && sp.vliegt && !bouwen) sp.vliegt = false;
  // vallen meten
  if (!sp.opGrond && !sp.inWater && !sp.opLadder && !sp.vliegt) { if (sp.valStart === null || sp.y > sp.valStart) sp.valStart = Math.max(sp.valStart === null ? -1e9 : sp.valStart, sp.y); }
  if (sp.opGrond && !wasGrond) { landen(sp.valStart === null ? 0 : sp.valStart - sp.y, valSnelheid); sp.valStart = null; }
  if (sp.inWater || sp.opLadder || sp.vliegt) sp.valStart = null;
  if (sp.y < -40) { sp.y = 140; sp.vy = 0; }
  // ooghoogte, en de camera zacht laten volgen bij opstappen
  sp.oogDoel = sp.sluipt ? 1.28 : 1.62;
  sp.oog += (sp.oogDoel - sp.oog) * (1 - Math.exp(-14 * dt));
  sp.stapOp *= Math.exp(-14 * dt);
  // loopschommel: de fase loopt mee met de afgelegde weg, een halve slag (pi) per stap.
  // Stilstaan laat de fase rustig uitlopen naar de dichtstbijzijnde stap, zodat het hoofd niet blijft hangen.
  const hs = Math.hypot(sp.vx, sp.vz);
  if (sp.opGrond && !sp.vliegt && hs > 0.5) { sp.schommelT += hs * dt / stapLengte() * Math.PI; sp.loopAfstand += hs * dt; }
  else { const doelT = Math.round(sp.schommelT / Math.PI) * Math.PI; sp.schommelT += (doelT - sp.schommelT) * (1 - Math.exp(-6 * dt)); }
  const wil = sp.opGrond && !sp.vliegt ? Math.min(1, hs / 4.3) * (sp.sluipt ? 0.4 : 1 + 0.2 * klem(sp.renMix, 0, 1)) : 0;
  sp.schommel += (wil - sp.schommel) * (1 - Math.exp(-5 * dt));
  // de kijkhoek wordt bij het rennen wat wijder, en zakt daarna rustig terug
  const fovDoel = minderBeweging || !sp.rent ? 0 : sp.vliegt ? 12 : 6;
  [sp.fovExtra, sp.fovV] = veer(sp.fovExtra, sp.fovV, fovDoel, fovDoel > sp.fovExtra ? 7 : 5, dt);
}
// kritisch gedempte veer van x naar doel, met snelheid v en stijfheid w (per seconde); geeft [x, v]
function veer(x, v, doel, w, dt) {
  const e = Math.exp(-w * dt), d = x - doel, a = (v + w * d) * dt;
  return [doel + (d + a) * e, (v - w * a) * e];
}
// hoe ver één stap is (in blokken): rennen maakt langere passen, sluipen kortere
function stapLengte() { return sp.sluipt ? 0.9 : 1.6 + 0.3 * klem(sp.renMix, 0, 1); }
// hoe sterk het hoofd meedeint: de keuze bij de instellingen (0 uit tot 4 sterk), en altijd uit bij minder beweging
const SCHOMMEL = [0, 0.2, 0.4, 0.65, 1];
function schommelSterkte() { return minderBeweging ? 0 : SCHOMMEL[klem(inst.schommel | 0, 0, 4)] || 0; }
// de verschuiving van het hoofd bij het lopen: op en neer bij elke stap, en een halve slag opzij per twee stappen
function hoofdSchommel() {
  const k = schommelSterkte() * sp.schommel; if (k < 0.001) return [0, 0];
  const f = sp.schommelT;
  return [Math.sin(f) * 0.022 * k, -(1 - Math.abs(Math.cos(f))) * 0.045 * k];
}

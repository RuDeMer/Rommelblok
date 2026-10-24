// Dieren en griezels: wie er zijn, waar ze wonen, wat ze laten vallen, en hoe ze bewegen en denken.
// Gedeelde code: draait op de pagina (alleen spelen) en straks op de server (samen spelen), zonder DOM.
//
// Een wezen is een klein object dat alles bevat wat het nodig heeft (ook na bewaren of doorgeven):
//   { n (nummer), s (soort: index in WEZENS), x, y, z (voeten), yaw, hp, vx, vy, vz,
//     st (wat het doet), t (hoelang nog), dx, dz (waarheen), ... }
// De wereld komt binnen als een klein hulpje W:
//   W.blok(x, y, z)   de blokwaarde (-1 als dat stuk nog niet geladen is)
//   W.licht(x, y, z)  het licht: (lucht << 4) | lamp, elk 0..15
//   W.biome(x, z)     de streek (index in BIOMEN), of -1
//   W.tijd            de tijd van de dag (0..1; 0,5 is middag)
//   W.spelers         [{ id, x, y, z }] (spelers in overleven, die je pijn kunt doen)
//   W.r()             toeval van 0 tot 1
//   W.moeilijk        'vredig', 'makkelijk', 'normaal' of 'moeilijk'
// Vriendelijke dieren doen nooit iemand pijn. Spelers kunnen ze wel pijn doen; dan rennen ze weg,
// en als ze geen levens meer hebben, verdwijnen ze in een wolkje en laten ze iets vallen.
import { B, BL, VAST, W as WATER } from './blokken.js';
import { botsDozen } from './vormen.js';
import { hsh, rng } from './toeval.js';
import { BI } from './wereld/biomen.js';
import { dtex } from './blokken.js';

const b = (...k) => k.map(s => BI[s]);
// maat: [halve breedte, hoogte]; snel: wandelen; vlucht: rennen; kudde: [min, max] in een stuk;
// buit: [[voorwerp, min, max]]; plek: 'land', 'water' (zwemt graag) of 'lucht' (zweeft)
export const WEZENS = [
  { sleutel: 'koe', nl: 'Koe', en: 'Cow', vriend: true, biomen: b('vlakte', 'tulpenveld', 'heide', 'savanne'), maat: [0.45, 1.35], hp: 10, snel: 1.5, vlucht: 3.4, kudde: [2, 4], buit: [['leer', 0, 2]], geluid: 'koe' },
  { sleutel: 'schaap', nl: 'Schaap', en: 'Sheep', vriend: true, biomen: b('vlakte', 'heide', 'bergen', 'tulpenveld', 'sneeuwvlakte'), maat: [0.42, 1.25], hp: 8, snel: 1.4, vlucht: 3.4, kudde: [2, 5], buit: [['wol', 1, 2]], geluid: 'schaap' },
  { sleutel: 'kip', nl: 'Kip', en: 'Chicken', vriend: true, biomen: b('vlakte', 'savanne', 'tulpenveld', 'bos'), maat: [0.22, 0.7], hp: 4, snel: 1.3, vlucht: 3.2, kudde: [2, 4], buit: [['ei', 0, 1]], geluid: 'kip', fladdert: true, legt: [300, 480] },
  { sleutel: 'eend', nl: 'Eend', en: 'Duck', vriend: true, biomen: b('rivier', 'moeras'), maat: [0.24, 0.65], hp: 4, snel: 1.2, vlucht: 3, kudde: [2, 4], buit: [['ei', 0, 1]], geluid: 'eend', zwemt: true, fladdert: true },
  { sleutel: 'konijn', nl: 'Konijn', en: 'Rabbit', vriend: true, biomen: b('bos', 'berkenbos', 'herfstbos', 'heide', 'sneeuwvlakte', 'woestijn'), maat: [0.2, 0.5], hp: 3, snel: 2.2, vlucht: 5, kudde: [1, 3], buit: [['wortel', 0, 1]], geluid: 'konijn', schuw: 5, hupt: true },
  { sleutel: 'hert', nl: 'Hert', en: 'Deer', vriend: true, biomen: b('bos', 'herfstbos', 'taiga', 'berkenbos'), maat: [0.4, 1.6], hp: 10, snel: 1.7, vlucht: 5.2, kudde: [1, 3], buit: [['leer', 0, 1]], geluid: 'hert', schuw: 7 },
  { sleutel: 'zeehond', nl: 'Zeehond', en: 'Seal', vriend: true, biomen: b('strand', 'bevroren_oceaan', 'sneeuwvlakte'), maat: [0.38, 0.6], hp: 10, snel: 0.7, vlucht: 1.6, kudde: [1, 3], buit: [], geluid: 'zeehond', zwemt: true, strand: true },
  { sleutel: 'hagedis', nl: 'Hagedis', en: 'Lizard', vriend: true, biomen: b('woestijn', 'savanne'), maat: [0.18, 0.3], hp: 3, snel: 1.8, vlucht: 5, kudde: [1, 2], buit: [], geluid: 'hagedis', schuw: 4 },
  // griezels (eigen ontwerpen): alleen in overleven, en niet bij 'vredig'
  { sleutel: 'spookje', nl: 'Spookje', en: 'Little ghost', vriend: false, maat: [0.32, 1.0], hp: 8, snel: 1.6, schade: 2, bereik: 16, buit: [['spooklicht', 0, 1]], geluid: 'spook', zweeft: true, nacht: true, lichtSchuw: 10 },
  { sleutel: 'grotkwal', nl: 'Grotkwal', en: 'Cave jelly', vriend: false, maat: [0.38, 0.9], hp: 10, snel: 0.9, schade: 3, bereik: 10, buit: [['kwallengel', 0, 2]], geluid: 'kwal', zweeft: true, grot: true },
  { sleutel: 'braambol', nl: 'Braambol', en: 'Bramble ball', vriend: false, biomen: b('bos', 'berkenbos', 'herfstbos', 'taiga', 'heide', 'moeras'), maat: [0.42, 0.85], hp: 12, snel: 1.2, schade: 3, bereik: 12, buit: [['bessen', 1, 2]], geluid: 'braam', nacht: true, stormt: true },
];
export const WI = {}; WEZENS.forEach((w, i) => { w.id = i; WI[w.sleutel] = i; });
export const MOEILIJK = {
  // griezels: hoeveel er hooguit tegelijk zijn (keer het maximum); schade: keer de schade van een griezel
  vredig: { griezels: 0, schade: 0 }, makkelijk: { griezels: 0.5, schade: 0.5 }, normaal: { griezels: 1, schade: 1 }, moeilijk: { griezels: 1.5, schade: 1.5 },
};
export const MOEILIJK_NAMEN = [['vredig', 'Vredig', 'Peaceful'], ['makkelijk', 'Makkelijk', 'Easy'], ['normaal', 'Normaal', 'Normal'], ['moeilijk', 'Moeilijk', 'Hard']];
// wanneer is het nacht (dan komen spookjes en braambollen tevoorschijn)?
export const isNacht = t => t < 0.22 || t > 0.79;

// ---------------- botsen: precies zoals de speler botst (dezelfde vormen, hekjes zijn anderhalf blok hoog)
const VOL = [[0, 0, 0, 1, 1, 1]];
function botsBlok(W, X, Y, Z) {
  const v = W.blok(X, Y, Z);
  if (v < 0) return VOL; // nog niet geladen: vast
  const id = v & 255; if (!id || !(VAST[id] || id === B.waterlelie)) return null;
  if (BL[id].vorm === 'kubus') return VOL;
  const d = botsDozen(v, (dx, dy, dz) => { const n = W.blok(X + dx, Y + dy, Z + dz); return n < 0 ? 0 : n; });
  return d ? d.map(a => a.map(q => q / 16)) : null;
}
export function raakt(W, x, y, z, r, h) {
  const x0 = Math.floor(x - r), x1 = Math.floor(x + r), y0 = Math.floor(y), y1 = Math.floor(y + h - 0.001), z0 = Math.floor(z - r), z1 = Math.floor(z + r);
  for (let X = x0; X <= x1; X++) for (let Y = y0 - 1; Y <= y1; Y++) for (let Z = z0; Z <= z1; Z++) {
    const dz = botsBlok(W, X, Y, Z); if (!dz) continue;
    for (const d of dz) if (x + r > X + d[0] && x - r < X + d[3] && y + h > Y + d[1] && y < Y + d[4] && z + r > Z + d[2] && z - r < Z + d[5]) return true;
  }
  return false;
}
const isW = v => v >= 0 && (v & 255) === WATER;
const inWater = (W, x, y, z) => isW(W.blok(Math.floor(x), Math.floor(y + 0.2), Math.floor(z)));
// Welke kant stroomt het water op in blok X, Y, Z? [fx, fz], met lengte 1 in stromend water en klein in stilstaand water.
// blok(x, y, z) geeft de blokwaarde. Gedeeld: spelers, dieren en griezels, en bewoners worden er allemaal door meegenomen.
const WHOOGTE = [14, 12, 11, 9, 7, 5, 4, 2], BUREN4 = [[0, -1], [1, 0], [0, 1], [-1, 0]];
export function stroming(blok, X, Y, Z) {
  const hoogte = (x, y, z) => { const v = blok(x, y, z); if (!isW(v)) return -1; return isW(blok(x, y + 1, z)) ? 1 : WHOOGTE[(v >> 8) & 7] / 16; };
  const h = hoogte(X, Y, Z); if (h < 0) return [0, 0];
  let fx = 0, fz = 0;
  for (const [dx, dz] of BUREN4) {
    const n = hoogte(X + dx, Y, Z + dz);
    if (n >= 0) { fx += (h - n) * dx; fz += (h - n) * dz; }
    else { const b = blok(X + dx, Y, Z + dz); if (b === 0 || (b > 0 && !VAST[b & 255])) { if (hoogte(X + dx, Y - 1, Z + dz) >= 0 || blok(X + dx, Y - 1, Z + dz) === 0) { fx += dx * 0.6; fz += dz * 0.6; } } }
  }
  const v = blok(X, Y, Z), lv = (v >> 8) & 7;
  if (!lv && !((v >> 8) & 8)) return [fx * 0.2, fz * 0.2];
  const l = Math.hypot(fx, fz); return l > 0.01 ? [fx / l, fz / l] : [0, 0];
}
export const STROOM = 2.4; // hoe hard stromend water een dier of bewoner meeneemt (blokken per seconde)
// de grond onder een plek: hoe ver omlaag is het (0 = je staat erop), en is het water? (tot 4 diep)
function grondOnder(W, x, y, z) {
  const X = Math.floor(x), Z = Math.floor(z);
  for (let d = 0; d <= 4; d++) {
    const v = W.blok(X, Math.floor(y - 0.05) - d, Z);
    if (v < 0) return { diep: 0, water: false, onbekend: true };
    if (isW(v)) return { diep: d, water: true };
    if (v && VAST[v & 255]) return { diep: d, water: false };
  }
  return { diep: 99, water: false };
}

// ---------------- een nieuw wezen
let teller = 1;
export function nieuwWezen(s, x, y, z, yaw, nummer) {
  const S = WEZENS[s];
  return { n: nummer || teller++, s, x, y, z, yaw: yaw || 0, hp: S.hp, vx: 0, vy: 0, vz: 0, st: 'rust', t: 1 + (nummer || 0) % 3, dx: 0, dz: 0, fase: 0, grond: false, wacht: 0, rood: 0 };
}
// de nummers van nieuwe wezens doorlopen na het laden (zodat een nummer nooit dubbel is)
export function zetTeller(n) { if (n >= teller) teller = n + 1; }

// ---------------- elk stapje: denken en bewegen. Geeft gebeurtenissen terug: [{ soort: 'raak', speler, schade }, { soort: 'ei' }]
export function stap(w, dt, W) {
  const S = WEZENS[w.s], uit = [];
  w.rood = Math.max(0, w.rood - dt); w.wacht = Math.max(0, w.wacht - dt); w.t -= dt;
  if (S.vriend) denkDier(w, S, dt, W, uit); else denkGriezel(w, S, dt, W, uit);
  if (S.legt) { if (w.ei === undefined) w.ei = S.legt[0] + W.r() * (S.legt[1] - S.legt[0]); w.ei -= dt; if (w.ei <= 0) { w.ei = S.legt[0] + W.r() * (S.legt[1] - S.legt[0]); uit.push({ soort: 'ei' }); } }
  if (w.kaal > 0) w.kaal = Math.max(0, w.kaal - dt);
  beweeg(w, S, dt, W);
  return uit;
}
// een vriendelijk dier: rondkijken, grazen, een stukje lopen, en wegrennen als iemand het pijn doet (of als het schuw is)
function denkDier(w, S, dt, W, uit) {
  // schuwe dieren (konijn, hert, hagedis) rennen weg als een speler te dichtbij komt
  if (S.schuw && w.st !== 'vlucht') {
    for (const p of W.spelers) { const ax = w.x - p.x, az = w.z - p.z; if (ax * ax + az * az < S.schuw * S.schuw && Math.abs(w.y - p.y) < 4) { vlucht(w, p.x, p.z, 2.5); break; } }
  }
  if (w.st === 'vlucht') { if (w.t <= 0) { w.st = 'rust'; w.t = 1 + W.r() * 2; } return; }
  if (w.st === 'loop') {
    if (w.t <= 0) { w.st = 'rust'; w.t = 2 + W.r() * 5; }
    return;
  }
  // rust: af en toe een nieuw doel, en af en toe een geluidje
  if (w.t <= 0) {
    const h = W.r() * Math.PI * 2;
    w.dx = -Math.sin(h); w.dz = -Math.cos(h); w.st = 'loop'; w.t = 1.5 + W.r() * 3.5;
    if (W.r() < 0.18) uit.push({ soort: 'geluid' });
  }
}
function vlucht(w, vanX, vanZ, sec) {
  let ax = w.x - vanX, az = w.z - vanZ; const l = Math.hypot(ax, az) || 1; ax /= l; az /= l;
  w.dx = ax; w.dz = az; w.st = 'vlucht'; w.t = sec;
}
// een griezel: zoekt de dichtstbijzijnde speler, en raakt hem als hij dichtbij genoeg is
function denkGriezel(w, S, dt, W, uit) {
  let doel = null, best = S.bereik * S.bereik;
  for (const p of W.spelers) { const ax = p.x - w.x, ay = p.y + 0.9 - (w.y + S.maat[1] / 2), az = p.z - w.z, a = ax * ax + ay * ay * 0.5 + az * az; if (a < best) { best = a; doel = p; } }
  if (S.stormt) {
    // de braambol: even stil, dan stormt hij in een rechte lijn op je af, en daarna moet hij uitrusten
    if (w.st === 'storm') { if (w.t <= 0) { w.st = 'moe'; w.t = 2; } }
    else if (w.st === 'moe') { if (w.t <= 0) w.st = 'rust'; }
    else if (w.st === 'aanloop') { if (w.t <= 0) { w.st = 'storm'; w.t = 1.4; if (doel) richt(w, doel); } }
    else if (doel && best < 100) { w.st = 'aanloop'; w.t = 0.8; w.dx = w.dz = 0; if (doel) kijk(w, doel); }
    else if (w.t <= 0) { const h = W.r() * Math.PI * 2; w.dx = -Math.sin(h) * 0.5; w.dz = -Math.cos(h) * 0.5; w.st = 'rust'; w.t = 2 + W.r() * 3; }
  } else if (doel) {
    // spookje: blijft op afstand van een speler die bij een lamp staat
    let weg = false;
    if (S.lichtSchuw) { const l = W.licht(Math.floor(doel.x), Math.floor(doel.y + 1), Math.floor(doel.z)); if (l >= 0 && (l & 15) >= S.lichtSchuw) weg = true; }
    richt(w, doel); w.st = weg ? 'afstand' : 'jaag';
    if (weg && best < 25) { w.dx = -w.dx; w.dz = -w.dz; }
    else if (weg) { w.dx *= 0.15; w.dz *= 0.15; }
  } else if (w.t <= 0) { const h = W.r() * Math.PI * 2; w.dx = -Math.sin(h) * 0.5; w.dz = -Math.cos(h) * 0.5; w.st = 'rust'; w.t = 2 + W.r() * 4; }
  // raken
  if (doel && w.wacht <= 0 && w.st !== 'afstand' && w.st !== 'moe') {
    const r = S.maat[0] + 0.45, ax = doel.x - w.x, az = doel.z - w.z;
    const boven = doel.y < w.y + S.maat[1] + 0.2 && doel.y + 1.8 > w.y - 0.2;
    if (ax * ax + az * az < r * r && boven) {
      const m = (MOEILIJK[W.moeilijk] || MOEILIJK.normaal).schade;
      if (m > 0) uit.push({ soort: 'raak', speler: doel.id, schade: Math.max(1, Math.round(S.schade * m)), wx: w.x, wz: w.z });
      w.wacht = 1.5; // anderhalve seconde tussen twee tikken: tijd om weg te lopen of terug te slaan
      if (S.stormt && w.st === 'storm') { w.st = 'moe'; w.t = 2; }
    }
  }
}
function richt(w, p) { let ax = p.x - w.x, az = p.z - w.z; const l = Math.hypot(ax, az) || 1; w.dx = ax / l; w.dz = az / l; w.dy = Math.max(-1, Math.min(1, (p.y + 1 - (w.y + 0.5)) / 3)); }
// yaw: de kant waar de kop heen wijst, als (sin yaw, cos yaw) in x en z. De modellen hebben hun kop aan de +z-kant
// (net als de bewoners en de poppetjes); de camera gebruikt juist -z als vooruit, en dat liet de dieren achteruit lopen.
function kijk(w, p) { w.yaw = Math.atan2(p.x - w.x, p.z - w.z); }

// ---------------- bewegen en botsen
function beweeg(w, S, dt, W) {
  const r = S.maat[0], h = S.maat[1];
  let snel = 0;
  if (w.st === 'loop') snel = S.snel; else if (w.st === 'vlucht') snel = S.vlucht;
  else if (w.st === 'jaag') snel = S.snel; else if (w.st === 'afstand') snel = S.snel * 0.6;
  else if (w.st === 'storm') snel = S.snel * 5.5; else if (w.st === 'rust' && !S.vriend) snel = S.snel * 0.4;
  const water = inWater(W, w.x, w.y, w.z);
  if (water && !S.zwemt && !S.zweeft) snel *= 0.6;
  // niet het water in (behalve wie zwemt) en niet van een rand af: dan omdraaien
  if (snel > 0 && !S.zweeft && w.grond && (w.dx || w.dz)) {
    const vx = w.x + w.dx * (r + 0.6), vz = w.z + w.dz * (r + 0.6), g = grondOnder(W, vx, w.y, vz);
    const mag = !g.onbekend && (g.water ? (S.zwemt || water) : g.diep <= (w.st === 'vlucht' ? 3 : 1));
    if (!mag) { if (w.st === 'storm') { w.st = 'moe'; w.t = 2; } else { w.dx = -w.dx; w.dz = -w.dz; if (w.st === 'loop') w.t = Math.min(w.t, 1); } snel = 0; }
  }
  // de kant op kijken waar je heen gaat (zacht draaien)
  if (snel > 0 && (w.dx || w.dz)) { const doelYaw = Math.atan2(w.dx, w.dz); let d = doelYaw - w.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); w.yaw += d * Math.min(1, dt * 8); }
  let tx = w.dx * snel, tz = w.dz * snel;
  // stromend water neemt je mee (wie zweeft niet)
  if (water && !S.zweeft) { const [fx, fz] = stroming(W.blok, Math.floor(w.x), Math.floor(w.y + 0.2), Math.floor(w.z)); tx += fx * STROOM; tz += fz * STROOM; }
  const k = Math.min(1, dt * (w.grond || S.zweeft || water ? 10 : 2));
  w.vx += (tx - w.vx) * k; w.vz += (tz - w.vz) * k;
  if (S.zweeft) {
    // zweven: zacht op en neer, en naar de hoogte van de speler die het zoekt
    const op = (w.st === 'jaag' || w.st === 'afstand') && w.dy !== undefined ? w.dy * snel * 0.8 : 0;
    w.vy += ((op + Math.sin((w.n * 1.7 + w.fase) * 1.3) * 0.25) - w.vy) * Math.min(1, dt * 3);
    w.fase += dt;
  } else if (water && S.zwemt) {
    // drijven: naar het wateroppervlak
    const boven = isW(W.blok(Math.floor(w.x), Math.floor(w.y + h * 0.6), Math.floor(w.z)));
    w.vy += ((boven ? 1.2 : 0) - w.vy) * Math.min(1, dt * 4);
  } else {
    w.vy -= (water ? 6 : 24) * dt;
    if (S.fladdert && w.vy < -2.5) w.vy = -2.5; // fladderen: kippen en eenden vallen langzaam
    if (water) w.vy = Math.max(w.vy, -2);
    w.vy = Math.max(w.vy, -40);
  }
  // een spinnenweb houdt je bijna vast (wie zweeft niet: spookjes en kwallen gaan er gewoon doorheen)
  if (!S.zweeft && inWeb(W, w.x, w.y, w.z, r, h)) { const hv = Math.hypot(w.vx, w.vz); if (hv > 0.5) { w.vx *= 0.5 / hv; w.vz *= 0.5 / hv; } w.vy = Math.max(-1, Math.min(w.vy, 0.4)); }
  // per as bewegen en botsen, in stukjes van hooguit 0,3 blok (zo valt niets door een vloer heen, ook niet bij een groot tijdstapje);
  // tegen een blok aan op de grond: één blok opstappen als dat past
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(w.vx), Math.abs(w.vy), Math.abs(w.vz)) * dt / 0.3)), opGrond = w.grond;
  let geraakt = false; w.grond = false;
  for (let i = 0; i < n; i++) {
    const mx = w.vx * dt / n, my = w.vy * dt / n, mz = w.vz * dt / n, stapOp = (opGrond || w.grond || water) && !S.zweeft;
    if (mx) { if (!raakt(W, w.x + mx, w.y, w.z, r, h)) w.x += mx; else { const op = stapOp ? opstap(W, w, mx, 0, r, h) : 0; if (op) { w.y += op; w.x += mx; } else { w.vx = 0; geraakt = true; } } }
    if (mz) { if (!raakt(W, w.x, w.y, w.z + mz, r, h)) w.z += mz; else { const op = stapOp ? opstap(W, w, 0, mz, r, h) : 0; if (op) { w.y += op; w.z += mz; } else { w.vz = 0; geraakt = true; } } }
    if (my) {
      if (!raakt(W, w.x, w.y + my, w.z, r, h)) w.y += my;
      else {
        // tot op de grond (of tegen het plafond) schuiven, in plaats van erboven te blijven hangen
        let lo = 0, hi = my; for (let k = 0; k < 6; k++) { const mid = (lo + hi) / 2; if (raakt(W, w.x, w.y + mid, w.z, r, h)) hi = mid; else lo = mid; }
        w.y += lo; if (my < 0) w.grond = true; w.vy = 0;
      }
    }
  }
  if (!w.grond && raakt(W, w.x, w.y - 0.05, w.z, r, 0.05)) w.grond = true;
  if (geraakt && w.st === 'loop') { w.dx = -w.dx; w.dz = -w.dz; }
  if (geraakt && w.st === 'storm') { w.st = 'moe'; w.t = 2; }
  // konijnen huppen
  if (S.hupt && w.grond && snel > 0) w.vy = 4.5;
  const v = Math.hypot(w.vx, w.vz); w.fase += v * dt * 3.2;
}

// opstappen: de kleinste hoogte waarmee het past (een tapijtje van een pixel ook in een lage gang, een plaat, een heel blok); 0 als het niet kan
const OPSTAP = [0.08, 0.55, 1.05];
function opstap(W, w, mx, mz, r, h) {
  for (const op of OPSTAP) if (!raakt(W, w.x + mx, w.y + op, w.z + mz, r, h) && !raakt(W, w.x, w.y + op, w.z, r, h)) return op;
  return 0;
}
// zit het lijf in een spinnenweb?
function inWeb(W, x, y, z, r, h) {
  for (let Y = Math.floor(y); Y <= Math.floor(y + h - 0.001); Y++) for (let X = Math.floor(x - r); X <= Math.floor(x + r); X++) for (let Z = Math.floor(z - r); Z <= Math.floor(z + r); Z++) {
    const v = W.blok(X, Y, Z); if (v > 0 && (v & 255) === B.spinnenweb) return true;
  }
  return false;
}

// ---------------- geraakt worden door een speler: geeft true als het wezen geen levens meer heeft
export function geraakt(w, schade, vanX, vanZ) {
  const S = WEZENS[w.s];
  w.hp = Math.max(0, w.hp - schade); w.rood = 0.35;
  let ax = w.x - vanX, az = w.z - vanZ; const l = Math.hypot(ax, az) || 1; ax /= l; az /= l;
  w.vx = ax * 6; w.vz = az * 6; if (!S.zweeft) w.vy = 4.5; else w.vy = 1.5;
  if (S.vriend) vlucht(w, vanX, vanZ, 5);
  else if (S.stormt) { w.st = 'moe'; w.t = 1.2; }
  return w.hp <= 0;
}
// wat het laat vallen: [[voorwerp, aantal], ...]
export function buitVan(w, r) {
  const uit = [];
  for (const [k, lo, hi] of WEZENS[w.s].buit) { const n = lo + Math.floor(r() * (hi - lo + 1)); if (n > 0) uit.push([k, n]); }
  return uit;
}
// hoeveel schade een speler doet, met wat hij vasthoudt (gereedschap uit voorwerpen.js: { gereed, klasse, ster })
export function slagSchade(it) {
  if (!it || !it.gereed) return 1;
  const k = it.klasse || 1, ster = it.ster ? 1 : 0;
  if (it.gereed === 'zwaard') return 3 + k + ster;
  if (it.gereed === 'bijl') return 2 + Math.floor(k / 2) + ster;
  return 2 + ster;
}

// ---------------- waar ze wonen
// De dieren van een stuk (16 x 16) staan vast voor een zaadje: de eerste keer dat een speler in de buurt komt,
// komt dit kuddetje tevoorschijn (daarna onthoudt de wereld dat). kolom(x, z) geeft { y (de bovenkant van de grond), blok, water, biome }.
const GROND_VOOR = { land: new Set([B.gras, B.sneeuwgras, B.zand, B.bosgrond, B.aarde, B.sneeuw, B.grind]) };
export function stukDieren(zaad, cx, cz, kolom) {
  const h = hsh(zaad, cx, cz, 0x5d1e);
  if (h % 7 !== 0) return []; // ongeveer één op de zeven stukken heeft een kuddetje
  const r = rng(h), mx = cx * 16 + 8, mz = cz * 16 + 8, k = kolom(mx, mz);
  if (!k || k.biome < 0) return [];
  const kan = [];
  WEZENS.forEach((S, i) => { if (S.vriend && S.biomen.includes(k.biome)) kan.push(i); });
  if (!kan.length) return [];
  const s = kan[Math.floor(r() * kan.length) % kan.length], S = WEZENS[s];
  const n = S.kudde[0] + Math.floor(r() * (S.kudde[1] - S.kudde[0] + 1)), uit = [];
  for (let i = 0; i < n * 3 && uit.length < n; i++) {
    const x = cx * 16 + 2 + Math.floor(r() * 12), z = cz * 16 + 2 + Math.floor(r() * 12), q = kolom(x, z);
    if (!q) continue;
    if (q.water ? !S.zwemt : !GROND_VOOR.land.has(q.blok)) continue;
    if (S.strand && !q.water && q.blok !== B.zand && q.blok !== B.sneeuw && q.blok !== B.sneeuwgras && q.blok !== B.grind) continue;
    uit.push({ s, x: x + 0.5, y: q.y + 1, z: z + 0.5, yaw: r() * Math.PI * 2 });
  }
  return uit;
}
// een griezel voor deze plek (of -1): spookjes en braambollen 's nachts buiten in het donker, grotkwallen diep in donkere grotten
export function griezelVoor(W, x, y, z) {
  const l = W.licht(x, y, z); if (l < 0) return -1;
  const lucht = l >> 4, lamp = l & 15, nacht = isNacht(W.tijd), bi = W.biome(x, z);
  if (lamp >= 6) return -1;
  if (lucht <= 2 && y < 50) return WI.grotkwal;
  if (!nacht || lucht < 12) return -1;
  if (WEZENS[WI.braambol].biomen.includes(bi) && (hsh(x, y, z, 0xb4a) & 3) === 0) return WI.braambol;
  return bi === BI.oceaan || bi === BI.diepe_oceaan || bi === BI.bevroren_oceaan ? -1 : WI.spookje;
}
// verdwijnt dit wezen vanzelf? (spookjes en braambollen als het dag wordt, grotkwallen nooit)
export function verdwijnt(w, W) {
  const S = WEZENS[w.s]; if (S.vriend) return false;
  if (S.nacht && !isNacht(W.tijd)) return true;
  return false;
}

// de stofjes voor de lijven (licht van kleur: elk dier krijgt er zijn eigen kleur overheen); achteraan in de stapel
for (const k of ['dier_vacht', 'dier_wol', 'dier_veren', 'dier_glad', 'dier_schub', 'spook_laken', 'kwal_lijf', 'braam_tak']) dtex(k);

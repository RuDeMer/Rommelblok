// Wat een blok oplevert, de buit van een oude kist en een tik van de oven.
// Gedeelde code: de pagina rekent hiermee bij alleen spelen, en de spelserver bij samen spelen (geen DOM).
// (Tot stap 5 stond dit in p6_doen.js en p7b_ui.js; het rekent nog precies hetzelfde.)
import { B, BL } from './blokken.js';
import { I, IT, itemVan } from './voorwerpen.js';
import { POTPLANT } from './vormen.js';
import { ovenRecept } from './recepten.js';
import { hsh, rng } from './toeval.js';

export const stapelVan = id => (IT[id] ? IT[id].stapel || 64 : 64);

// ---------------- wat levert een blok op (r: het toeval, standaard Math.random)
export function kanOogsten(v, slot) {
  const b = BL[v & 255]; if (!b) return false; if (!b.klasse) return true;
  const it = slot ? IT[slot.id] : null; return !!(it && it.gereed && it.gereed === b.gereed && it.klasse >= b.klasse);
}
export function opbrengst(v, slot, r = Math.random) {
  const id = v & 255, b = BL[id], st = v >> 8;
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
  if (b.kleur) { uit.push([itemVan(v), 1]); if (b.geeft === 0 && b.laag === 1 && b.vorm === 'kubus') uit.length = 0; return uit; }
  if (id === B.bloempot) { uit.push([B.bloempot, 1]); const pl = POTPLANT[st]; if (pl) uit.push([pl, 1]); return uit; }
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

// ---------------- een oude kist (in een ruïne of een mijn) vult zich de eerste keer met buit: vast per wereld en plek.
// Per regel: wat, hoeveel (van, tot) en de kans.
export const BUIT = [
  [['brood', 1, 3, 0.55], ['appel', 2, 4, 0.45], ['kersen', 2, 5, 0.3], ['walnoot', 2, 5, 0.25], ['linnendraad', 2, 5, 0.4], ['papier', 2, 4, 0.35], ['kaart', 1, 1, 0.15],
    ['kolen', 3, 8, 0.4], ['ijzerstaaf', 1, 3, 0.4], ['goudstaaf', 1, 2, 0.18], ['tarwezaad', 2, 5, 0.3], ['pompoenpit', 1, 2, 0.2], ['bietenzaad', 1, 3, 0.2], ['kaars', 1, 3, 0.25],
    ['bloempot', 1, 1, 0.12], ['robijn', 1, 1, 0.04], ['sterrensplinter', 1, 1, 0.1], ['kompas', 1, 1, 0.05]],
  [['kolen', 4, 12, 0.7], ['ijzerstaaf', 2, 5, 0.5], ['koperstaaf', 2, 6, 0.4], ['goudstaaf', 1, 3, 0.28], ['fakkel', 4, 10, 0.5], ['mijnspoor', 4, 12, 0.4], ['brood', 1, 2, 0.35],
    ['gepofte_aardappel', 2, 4, 0.3], ['robijn', 1, 2, 0.07], ['sterrensplinter', 1, 1, 0.12], ['houweel_ijzer', 1, 1, 0.08]],
];
export function buitInhoud(x, y, z, v, zaad) {
  const soort = ((v >> 10) & 3) === 1 ? 1 : 0, r = rng(hsh(zaad >>> 0, x, z, y * 31 + 9001));
  const inhoud = new Array(27).fill(null), vrij = Array.from({ length: 27 }, (_, i) => i);
  const leg = (s, n) => {
    const id = I[s] !== undefined ? I[s] : B[s], j = vrij.splice(Math.floor(r() * vrij.length), 1)[0];
    inhoud[j] = { id, n: Math.min(n, stapelVan(id)) };
    if (IT[id].duur) inhoud[j].dur = Math.max(1, Math.floor(IT[id].duur * (0.3 + r() * 0.4))); // gereedschap is al gebruikt
  };
  for (const [s, a, b2, kans] of BUIT[soort]) if (r() < kans) leg(s, a + Math.floor(r() * (b2 - a + 1)));
  if (vrij.length === 27) leg(soort ? 'kolen' : 'brood', 2 + Math.floor(r() * 3)); // nooit helemaal leeg
  return inhoud;
}

// ---------------- een tik van een oven (d: { in, brand, uit, brandTijd, brandMax, kook }).
// Geeft terug wat er gebeurde: 1 = er ging brandstof op, 2 = er is iets klaar.
export function ovenStap(d, dt) {
  let wat = 0;
  const r = d.in ? ovenRecept(d.in.id) : null;
  const kan = r && (!d.uit || (d.uit.id === r.uit && d.uit.n + r.aantal <= stapelVan(r.uit)));
  if (d.brandTijd > 0) d.brandTijd = Math.max(0, d.brandTijd - dt);
  if (d.brandTijd <= 0 && kan && d.brand) { const b = IT[d.brand.id].brand || 0; if (b) { d.brandTijd = d.brandMax = b; d.brand.n--; if (!d.brand.n) d.brand = null; wat |= 1; } }
  if (d.brandTijd > 0 && kan) {
    d.kook += dt;
    if (d.kook >= 8) { d.kook = 0; d.in.n--; if (!d.in.n) d.in = null; if (d.uit) d.uit.n += r.aantal; else d.uit = { id: r.uit, n: r.aantal }; wat |= 2; }
  } else d.kook = Math.max(0, d.kook - dt * 2);
  return wat;
}

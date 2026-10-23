// ============================================================================
// Rommelblok: de kern op de pagina. Instellingen, tekenaar, rekenhulpjes en de kopie van de wereld.
// ============================================================================
const G = RB_GEDEELD();
const { CH, HOOG, BL, B, IT, I } = G;
const $ = id => document.getElementById(id);
const veld = $('rb-veld'), doek = $('rb-doek');
const aanraak = matchMedia('(pointer: coarse)').matches || ('ontouchstart' in window && navigator.maxTouchPoints > 0);
const minderBeweging = matchMedia('(prefers-reduced-motion: reduce)').matches;
const sk = (cx, cz) => (cx + 32768) * 65536 + (cz + 32768);
const klem = (v, a, b) => (v < a ? a : v > b ? b : v);

// ---------------- instellingen (klein, want dit gaat mee met het koppelen van apparaten)
const INST = 'rommelblok-v3';
const STANDAARD = { kwaliteit: 'auto', kijk: 0, fov: 75, muis: 1, aanraak: 1, geluid: true, volume: 0.7, muziek: false, helder: 0.5, omkeren: false, schommel: minderBeweging ? 0 : 2, opstappen: false, huid: 1, fps: false, richtModus: 'tik' };
let opslag = { v: 3, inst: Object.assign({}, STANDAARD), laatste: null, nieuwGezien: false };
try { const o = JSON.parse(localStorage.getItem(INST) || 'null'); if (o && o.v === 3) { opslag = Object.assign(opslag, o); opslag.inst = Object.assign({}, STANDAARD, o.inst || {}); } } catch (e) {}
// van een oudere versie: schommelen was aan of uit, nu een sterkte van 0 (uit) tot 4 (sterk)
if (typeof opslag.inst.schommel !== 'number') opslag.inst.schommel = opslag.inst.schommel === false || minderBeweging ? 0 : 2;
opslag.inst.schommel = klem(Math.round(opslag.inst.schommel) || 0, 0, 4);
if (!(opslag.inst.huid >= 0 && opslag.inst.huid < 6)) opslag.inst.huid = 1;
const inst = opslag.inst;
function bewaarInst() { try { localStorage.setItem(INST, JSON.stringify(opslag)); } catch (e) {} }

// ---------------- kwaliteit
const telefoon = aanraak && Math.min(screen.width, screen.height) < 820;
const KWAL = {
  laag: { maxDpr: 1.25, straal: 4, wolken: false, aa: false, aniso: false, snelleBladeren: true, schaal: 0.9 },
  midden: { maxDpr: 1.75, straal: 6, wolken: true, aa: false, aniso: false, snelleBladeren: false, schaal: 1 },
  hoog: { maxDpr: 2, straal: 10, wolken: true, aa: true, aniso: true, snelleBladeren: false, schaal: 1 },
};
function kwaliteitNu() {
  if (inst.kwaliteit !== 'auto') return inst.kwaliteit;
  const geheugen = navigator.deviceMemory || 4, kernen = navigator.hardwareConcurrency || 4;
  if (telefoon) return geheugen <= 3 || kernen <= 4 ? 'laag' : 'midden';
  return geheugen <= 2 ? 'midden' : 'hoog';
}
let KW = KWAL[kwaliteitNu()];
const straalNu = () => (inst.kijk ? inst.kijk : KW.straal);

// ---------------- de tekenaar
const TEX = RB_TEXTUREN(G);
let R = null;
try { R = RB_TEKENAAR(G, doek, TEX, { antialias: KW.aa, aniso: KW.aniso, maxDpr: KW.maxDpr, wolken: KW.wolken, bewaarBeeld: /[?&]test/.test(location.search) }); }
catch (e) { console.error(e); R = null; }

// ---------------- rekenhulpjes: één wereldbaas en een paar makers, allemaal uit deze pagina zelf
const bronW = `const G = (${RB_GEDEELD.toString()})();\n(${RB_WERELD.toString()})(G, self);`;
const bronM = `const G = (${RB_GEDEELD.toString()})();\n(${RB_MAKER.toString()})(G, self);`;
const urlW = URL.createObjectURL(new Blob([bronW], { type: 'text/javascript' }));
const urlM = URL.createObjectURL(new Blob([bronM], { type: 'text/javascript' }));
const wb = new Worker(urlW);
const AANTAL_MAKERS = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 4) - 2));
const makerPoorten = [];
for (let i = 0; i < AANTAL_MAKERS; i++) { const w = new Worker(urlM), ch = new MessageChannel(); w.postMessage({ t: 'poort' }, [ch.port1]); makerPoorten.push(ch.port2); }
let poortenGegeven = false;
let vraagNr = 0; const wachten = new Map();
function vraagWb(m, tr) { return new Promise(ok => { const id = ++vraagNr; wachten.set(id, ok); m.id = id; wb.postMessage(m, tr || []); }); }

// ---------------- de kopie van de wereld rond de speler (voor botsen, richten en licht)
const kopie = new Map();
function blokOp(x, y, z) {
  if (y < 0) return B.bodemsteen; if (y >= HOOG) return 0;
  const c = kopie.get(sk(x >> 4, z >> 4)); if (!c) return -1;
  return c.d[(y << 8) | ((z & 15) << 4) | (x & 15)];
}
function lichtOp(x, y, z) {
  if (y >= HOOG) return 0xF0; if (y < 0) return 0;
  const c = kopie.get(sk(x >> 4, z >> 4)); if (!c) return 0xF0;
  return c.l[(y << 8) | ((z & 15) << 4) | (x & 15)];
}
function biomeOp(x, z) { const c = kopie.get(sk(x >> 4, z >> 4)); return c ? c.b[((z & 15) << 4) | (x & 15)] : -1; }
function zetKopie(x, y, z, v) { const c = kopie.get(sk(x >> 4, z >> 4)); if (c && y >= 0 && y < HOOG) c.d[(y << 8) | ((z & 15) << 4) | (x & 15)] = v; }

// ---------------- stukken voor de tekenaar: een rij, een paar per beeldje
const meshRij = new Map();
let kleurGezet = new Set();
function verwerkMeshes(budgetMs, sx, sz) {
  const t0 = performance.now();
  // eerst wat vlakbij is (net veranderd), dan de rest in volgorde van aankomst
  for (const [k, m] of meshRij) {
    const dicht = Math.abs(m.cx - (sx >> 4)) <= 1 && Math.abs(m.cz - (sz >> 4)) <= 1;
    if (!dicht && performance.now() - t0 > budgetMs) break;
    meshRij.delete(k);
    if (m.kl && !kleurGezet.has(k)) { R.zetKleur(m.cx, m.cz, m.kl); kleurGezet.add(k); }
    R.zetStuk(m.cx, m.cz, m.lagen, m.ofs);
  }
}

// ---------------- tijd van de dag en de kleuren van de lucht
const DAGLENGTE = 1200; // seconden voor een hele dag
const mixv = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const glad = (a, b, x) => { const t = klem((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function lucht(t, dag, onderWater, straal, tijdSec) {
  const th = (t - 0.25) * Math.PI * 2, sh = Math.sin(th);
  const zr = [Math.cos(th) * 0.94, sh, 0.34]; const zl = Math.hypot(...zr); zr[0] /= zl; zr[1] /= zl; zr[2] /= zl;
  const d = glad(-0.1, 0.2, sh), tw = Math.exp(-Math.pow(sh / 0.2, 2));
  const helder = inst.helder;
  let zenit = mixv([0.016, 0.024, 0.065], [0.27, 0.52, 0.92], d), horizon = mixv([0.05, 0.07, 0.145], [0.68, 0.83, 0.97], d);
  zenit = mixv(zenit, [0.24, 0.27, 0.52], tw * 0.55); horizon = mixv(horizon, [0.98, 0.56, 0.33], tw * 0.75);
  const zonGloed = [1.0 * (tw * 0.95 + 0.2 * d), (0.62 * tw + 0.19 * d), (0.36 * tw + 0.16 * d)];
  let zonKleur = mixv([0.17, 0.2, 0.33], [1.0, 0.98, 0.93], d); zonKleur = mixv(zonKleur, [1.0, 0.7, 0.48], tw * 0.45);
  const hl = 0.85 + helder * 0.3; zonKleur = zonKleur.map(v => v * hl);
  const fakKleur = [1.0 * hl, 0.8 * hl, 0.54 * hl];
  let wolkKleur = mixv([0.07, 0.08, 0.13], [1, 1, 1], d); wolkKleur = mixv(wolkKleur, [1.0, 0.72, 0.55], tw * 0.6);
  const wolkSchaduw = mixv(wolkKleur.map(v => v * 0.62), [0.45, 0.5, 0.66].map(v => v * (0.2 + 0.8 * d)), 0.4);
  const eind = Math.max(40, (straal - 0.7) * 16);
  const water = [0.04 + 0.08 * d, 0.13 + 0.25 * d, 0.24 + 0.32 * d];
  const flakker = 0.94 + 0.06 * Math.sin(tijdSec * 9.1) * Math.sin(tijdSec * 5.3 + 1);
  return {
    zenit, horizon: onderWater ? water : horizon, zonRicht: zr, maanRicht: [-zr[0], -zr[1], -zr[2]], zonGloed,
    zonKleur, fakKleur, mistKleur: water, mist: [eind * 0.6, eind], min: 0.022 + helder * 0.03, flakker, onderWater,
    sterren: 1 - glad(-0.2, 0.1, sh), maanFase: ((dag % 8) + 4) % 8 / 8, tijdSec, wind: 1, wolkDek: 0.5 + 0.06 * Math.sin(dag * 1.7 + t * 6),
    wolkKleur, wolkSchaduw, dag: d,
  };
}

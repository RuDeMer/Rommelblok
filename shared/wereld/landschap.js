// Klimaat, hoogte en streek van één kolom (versie 2 en 3 van het landschap), en de kleuren van gras, bladeren en water.
// Gedeelde code: draait op de pagina, in de rekenhulpjes en op de server (geen DOM).
import { ZEE } from '../maat.js';
import { glad, mix, spline } from '../ruis.js';
import { BI, kl, rgb565 } from './biomen.js';

// wm: de werkplaats van één wereld (zaadje, ruis en wat de eerdere delen gemaakt hebben)
export function landschap(wm) {
  const {
    opt, nWx, nWz, nCont, nEro, nTemp, nDetail, nVocht, nPiek, nHeuvel, nKlif, nRiv, nVlek, nSeizoen, nBloem,
  } = wm;

  // ---------- klimaat en hoogte van één kolom
  const ZEESCHUIF = 0.22;
  const CONT = [[-1, 22], [-0.62, 30], [-0.42, 41], [-0.3, 49], [-0.21, 54], [-0.14, 58], [-0.04, 62], [0.2, 66], [0.45, 70], [1, 76]];
  // Versie 2 (tot oktober 2026) en versie 3 (meer land, kleinere oceanen, rivieren door dalen).
  // Een wereld van voor versie 3 houdt het oude landschap in de stukken waar je al was (opt.oud), met een
  // zachte overgang van 40 blokken naar het nieuwe landschap.
  const skO = (cx, cz) => (cx + 32768) * 65536 + (cz + 32768);
  // opt.oud: een Set met sleutels, of paren cx, cz achter elkaar (zoals bewaard onder 'oud|<wereld>')
  const naarSet = a => { if (!a || !a.length) return null; const st = new Set(); for (let i = 0; i + 1 < a.length; i += 2) st.add(skO(a[i], a[i + 1])); return st; };
  const GEN = opt.gen || 3, OUD = opt.oud instanceof Set ? (opt.oud.size ? opt.oud : null) : naarSet(opt.oud), OVERGANG = 40;
  function veldenOud(x, z, k) {
    const wx = x + nWx.fbm2(x / 380, z / 380, 2) * 70, wz = z + nWz.fbm2(x / 380 + 9.1, z / 380 - 4.2, 2) * 70;
    const C = Math.max(-1, Math.min(1, nCont.fbm2(wx / 1500, wz / 1500, 6) * 1.8 + 0.1));
    const E = nEro.fbm2(wx / 520, wz / 520, 3) * 1.6;
    const T = nTemp.fbm2(wx / 2300, wz / 2300, 3) * 1.8 + 0.07 + nDetail.r2(x / 70, z / 70) * 0.03;
    const V = nVocht.fbm2(wx / 1800, wz / 1800, 3) * 1.8 + nDetail.r2(z / 66, x / 66) * 0.03;
    const land = glad(-0.3, -0.05, C);
    let h = spline(CONT, C);
    // bergen: waar weinig erosie is, ver van de kust
    const m = glad(-0.08, 0.38, C) * glad(0.15, -0.55, E);
    const piek = nPiek.ribbel(wx / 260, wz / 260, 4);
    h += m * (Math.pow(piek, 1.5) * 66 + 4);
    // heuvels en kleine oneffenheden
    h += nHeuvel.fbm2(wx / 110, wz / 110, 3) * (3 + 7 * glad(-0.6, 0.4, -E)) * (0.35 + 0.65 * land);
    h += nDetail.fbm2(x / 26, z / 26, 2) * 1.6;
    // kliffen: het land in treden
    const klif = glad(0.3, 0.55, nKlif.fbm2(x / 230, z / 230, 2)) * land * (1 - m);
    if (klif > 0 && h > ZEE + 2) { const st = 7, t = (h - ZEE) / st, f = Math.floor(t), r = t - f; const tr = (f + glad(0.35, 0.62, r)) * st + ZEE; h = mix(h, tr, klif); }
    // moeras: warm, nat en laag: plat en net boven het water
    const moe = glad(0.05, 0.35, T) * glad(0.2, 0.5, V) * glad(-0.25, -0.12, C) * glad(0.25, 0.0, C) * (1 - m);
    if (moe > 0) h = mix(h, ZEE + 0.6 + nDetail.r2(x / 9, z / 9) * 1.4, moe * 0.92);
    // rivieren: een kronkelende lijn waar de ruis bijna nul is
    const rv = Math.abs(nRiv.fbm2(wx / 640, wz / 640, 3));
    const rb = 0.026 + 0.012 * nDetail.r2(x / 300, z / 300);
    let rf = (1 - glad(0, rb, rv)) * land * (1 - glad(0.3, 0.6, m));
    const oever = (1 - glad(rb, rb * 2.6, rv)) * land * (1 - glad(0.3, 0.6, m));
    if (oever > 0 && h > ZEE - 1) { h = mix(h, Math.min(h, ZEE + 1.5), oever * 0.85); }
    if (rf > 0) h = mix(h, ZEE - 2.5 - rf * 3, rf);
    k.h = h; k.T = T; k.V = V; k.C = C; k.E = E; k.m = m; k.rf = rf; k.moe = moe; k.land = land;
  }
  function veldenNieuw(x, z, k) {
    const wx = x + nWx.fbm2(x / 380, z / 380, 2) * 70, wz = z + nWz.fbm2(x / 380 + 9.1, z / 380 - 4.2, 2) * 70;
    const C0 = Math.max(-1, Math.min(1, nCont.fbm2(wx / 1500, wz / 1500, 6) * 1.8 + 0.1));
    // meer land: het lage deel van de schaal schuift omhoog, zodat alleen de diepste delen nog zee zijn (kleinere oceanen);
    // het hoge deel (heuvels en bergen) blijft zoals het was
    const C = C0 + ZEESCHUIF * (1 - glad(-0.15, 0.3, C0));
    const E = nEro.fbm2(wx / 520, wz / 520, 3) * 1.6;
    const T = nTemp.fbm2(wx / 2300, wz / 2300, 3) * 1.8 + 0.07 + nDetail.r2(x / 70, z / 70) * 0.03;
    const V = nVocht.fbm2(wx / 1800, wz / 1800, 3) * 1.8 + nDetail.r2(z / 66, x / 66) * 0.03;
    const land = glad(-0.3, -0.05, C);
    let h = spline(CONT, C);
    const m = glad(-0.08, 0.38, C0) * glad(0.15, -0.55, E);
    const piek = nPiek.ribbel(wx / 260, wz / 260, 4);
    h += m * (Math.pow(piek, 1.5) * 66 + 4);
    h += nHeuvel.fbm2(wx / 110, wz / 110, 3) * (3 + 7 * glad(-0.6, 0.4, -E)) * (0.35 + 0.65 * land);
    h += nDetail.fbm2(x / 26, z / 26, 2) * 1.6;
    const klif = glad(0.3, 0.55, nKlif.fbm2(x / 230, z / 230, 2)) * land * (1 - m);
    if (klif > 0 && h > ZEE + 2) { const st = 7, t = (h - ZEE) / st, f = Math.floor(t), r = t - f; const tr = (f + glad(0.35, 0.62, r)) * st + ZEE; h = mix(h, tr, klif); }
    const moe = glad(0.05, 0.35, T) * glad(0.2, 0.5, V) * glad(-0.25, -0.12, C) * glad(0.25, 0.0, C) * (1 - m);
    if (moe > 0) h = mix(h, ZEE + 0.6 + nDetail.r2(x / 9, z / 9) * 1.4, moe * 0.92);
    // rivieren: een kronkelende lijn waar de ruis nul is. De afstand tot die lijn (in blokken) komt uit de helling van de ruis.
    // Rond de rivier ligt een dal dat breder is naarmate het land hoger ligt: de oevers lopen geleidelijk af, zonder kloof.
    let rf = 0;
    const sterk = land * (1 - glad(0.12, 0.42, m));
    if (sterk > 0.001) {
      const f0 = nRiv.fbm2(wx / 640, wz / 640, 3);
      if (Math.abs(f0) < 0.16) {
        const fx = nRiv.fbm2((wx + 1.5) / 640, wz / 640, 3), fz = nRiv.fbm2(wx / 640, (wz + 1.5) / 640, 3);
        const g = Math.hypot(fx - f0, fz - f0) / 1.5, d = Math.abs(f0) / Math.max(g, 1e-6);
        const breed = 0.5 + 0.5 * nDetail.r2(x / 420, z / 420);           // 0..1: smalle beek tot brede rivier
        const wb = 2.5 + 4 * breed, diep = 1.4 + 2.6 * breed;              // halve breedte van het water en diepte in het midden
        const hoog = Math.max(0, h - ZEE), dal = wb + 7 + 2.4 * Math.min(hoog, 34); // halve breedte van het dal
        if (d < dal) {
          // dalbodem net boven het water, met een flauwe oever; daarbuiten loopt het dal langzaam op naar het land
          const v = 1 - glad(wb, dal, d), oeverH = ZEE + 0.6 + 1.2 * glad(wb, wb + 4, d);
          let hd = mix(h, Math.min(h, oeverH), Math.pow(v, 0.8));
          if (d < wb) { const t = d / wb; hd = Math.min(hd, ZEE - 0.4 - diep * (1 - t * t)); }
          h = mix(h, hd, sterk);
          rf = (1 - glad(wb * 0.6, wb + 1, d)) * sterk;
        }
      }
    }
    k.h = h; k.T = T; k.V = V; k.C = C; k.E = E; k.m = m; k.rf = rf; k.moe = moe; k.land = land;
  }
  // hoeveel van het oude landschap op een plek: 1 in de oude stukken, naar 0 op 40 blokken daarvandaan
  const oudBuren = new Map();
  function oudGewicht(x, z) {
    const cx = x >> 4, cz = z >> 4, key = skO(cx, cz);
    if (OUD.has(key)) return 1;
    let L = oudBuren.get(key);
    if (L === undefined) {
      L = null; const R = Math.ceil(OVERGANG / 16);
      for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) if (OUD.has(skO(cx + dx, cz + dz))) (L || (L = [])).push((cx + dx) * 16, (cz + dz) * 16);
      if (oudBuren.size > 4096) oudBuren.clear();
      oudBuren.set(key, L);
    }
    if (!L) return 0;
    const px = x + 0.5, pz = z + 0.5; let best = OVERGANG;
    for (let i = 0; i < L.length; i += 2) { const ax = Math.max(L[i] - px, 0, px - L[i] - 16), az = Math.max(L[i + 1] - pz, 0, pz - L[i + 1] - 16); best = Math.min(best, Math.hypot(ax, az)); }
    return 1 - glad(0, OVERGANG, best);
  }
  const KO = {};
  // ligt er een oud stuk binnen r blokken (dan blijft een bouwwerk daar zoals het was)?
  function oudInBuurt(x, z, r) {
    if (!OUD) return false;
    const a = (x - r) >> 4, b = (x + r) >> 4, c = (z - r) >> 4, d = (z + r) >> 4;
    for (let cz = c; cz <= d; cz++) for (let cx = a; cx <= b; cx++) if (OUD.has(skO(cx, cz))) return true;
    return false;
  }
  function kolom(x, z, k) {
    k = k || {};
    const w = GEN < 3 ? 1 : OUD ? oudGewicht(x, z) : 0;
    if (w >= 1) veldenOud(x, z, k);
    else if (w <= 0) veldenNieuw(x, z, k);
    else {
      veldenOud(x, z, KO); veldenNieuw(x, z, k);
      for (const f of ['h', 'C', 'm', 'rf', 'moe', 'land']) k[f] = mix(k[f], KO[f], w);
    }
    k.oud = w;
    kiesBiome(x, z, k);
    return k;
  }
  function kiesBiome(x, z, k) {
    let b;
    const h = k.h, C = k.C, rf = k.rf, m = k.m, moe = k.moe, T = k.T, V = k.V;
    const hi = Math.floor(h);
    const Tj = T + nVlek.r2(x / 40, z / 40) * 0.05, Vj = V + nVlek.r2(z / 40, x / 40) * 0.05;
    if (C < -0.34 && hi < ZEE) b = Tj < -0.5 ? BI.bevroren_oceaan : C < -0.6 ? BI.diepe_oceaan : BI.oceaan;
    else if (rf > 0.45 && hi < ZEE) b = Tj < -0.5 ? BI.bevroren_oceaan : BI.rivier;
    else if (hi > 96 || (m > 0.5 && hi > 84)) b = Tj < 0.42 ? BI.sneeuwbergen : BI.bergen;
    else if (hi <= ZEE + 1 && C < -0.17 && m < 0.2 && moe < 0.4) b = BI.strand;
    else if (moe > 0.5) b = BI.moeras;
    else if (Tj < -0.56) b = Vj > 0.05 ? BI.taiga : BI.sneeuwvlakte;
    else if (Tj < -0.3) b = Vj < -0.3 ? BI.heide : BI.taiga;
    else if (Tj < 0.28) {
      if (Vj < -0.25) b = BI.vlakte;
      else if (Vj < 0.12) b = BI.bos;
      else { const s = nSeizoen.fbm2(x / 600, z / 600, 2); b = s > 0.1 ? BI.herfstbos : s < -0.14 ? BI.berkenbos : BI.bos; }
    } else if (Tj < 0.52) b = Vj < -0.25 ? BI.savanne : Vj < 0.2 ? BI.vlakte : BI.bos;
    else b = Vj < -0.05 ? BI.woestijn : Vj < 0.3 ? BI.savanne : BI.bos;
    if (b === BI.vlakte && nBloem.fbm2(x / 200, z / 200, 2) > 0.3) b = BI.tulpenveld;
    k.b = b;
    return k;
  }

  // kleuren van gras, bladeren en water: een vloeiende functie van warmte en vocht
  const GR = { koud: kl(0x7FA88A), fris: kl(0x6FA65A), mild: kl(0x62B04A), nat: kl(0x4E9F3A), warm: kl(0xA8B44C), droog: kl(0xC4B05A), heide: kl(0x8C8A4E), moeras: kl(0x5E7A3A) };
  const BLD = { koud: kl(0x5E8C6A), fris: kl(0x4C8A40), mild: kl(0x4A9E36), nat: kl(0x3A8A2A), warm: kl(0x8AA03A), droog: kl(0x9AA046), heide: kl(0x6E8040), moeras: kl(0x4E6A2E) };
  const WAT = { koud: kl(0x3A6FB8), mild: kl(0x3D8FD6), warm: kl(0x3AA8C8), moeras: kl(0x4E7A5A) };
  const KP = [GR, BLD].map(P => [P.koud, P.fris, P.mild, P.nat, P.warm, P.droog, P.heide, P.moeras]);
  const kc = new Float32Array(3), uitK = [0, 0, 0];
  function meng(c, d, t) { c[0] += (d[0] - c[0]) * t; c[1] += (d[1] - c[1]) * t; c[2] += (d[2] - c[2]) * t; }
  function kleuren(k) {
    const T = k.T, V = k.V;
    const w1 = glad(-0.6, -0.3, T), w2 = glad(-0.3, -0.05, T), w3 = glad(0.0, 0.4, V) * glad(-0.3, 0.1, T), w4 = glad(0.2, 0.45, T);
    const w5 = glad(0.35, 0.6, T) * glad(0.0, -0.4, V), w6 = glad(-0.2, -0.4, V) * glad(-0.45, -0.25, T) * glad(0.05, -0.15, T), w7 = k.moe;
    for (let p = 0; p < 2; p++) {
      const P = KP[p];
      kc[0] = P[0][0]; kc[1] = P[0][1]; kc[2] = P[0][2];
      meng(kc, P[1], w1); meng(kc, P[2], w2); meng(kc, P[3], w3); meng(kc, P[4], w4); meng(kc, P[5], w5); meng(kc, P[6], w6); meng(kc, P[7], w7);
      uitK[p] = rgb565(kc[0], kc[1], kc[2]);
    }
    kc[0] = WAT.koud[0]; kc[1] = WAT.koud[1]; kc[2] = WAT.koud[2];
    meng(kc, WAT.mild, glad(-0.6, -0.2, T)); meng(kc, WAT.warm, glad(0.25, 0.6, T)); meng(kc, WAT.moeras, k.moe);
    uitK[2] = rgb565(kc[0], kc[1], kc[2]);
    return uitK;
  }

  Object.assign(wm, {
    ZEESCHUIF, CONT, skO, naarSet, GEN, OUD, OVERGANG, veldenOud, veldenNieuw, oudBuren, oudGewicht, KO,
    oudInBuurt, kolom, kiesBiome, GR, BLD, WAT, KP, kc, uitK, meng, kleuren,
  });
}

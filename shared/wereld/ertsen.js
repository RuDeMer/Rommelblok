// Ertsaders: dezelfde aders, welk stuk ze ook maakt.
// Gedeelde code: draait op de pagina, in de rekenhulpjes en op de server (geen DOM).
import { B } from '../blokken.js';
import { CH, HOOG, idx } from '../maat.js';
import { hsh, rng, kans } from '../toeval.js';

// wm: de werkplaats van één wereld (zaadje, ruis en wat de eerdere delen gemaakt hebben)
export function ertsen(wm) {
  const {
    zaad, opt,
  } = wm;

  // ---------- ertsaders: dezelfde aders, welk stuk ze ook maakt
  const ERTS = [
    // blok, in leisteen, laagste, hoogste, aders per stuk, grootte
    [B.erts_kolen, 0, 8, 118, 16, 10], [B.erts_koper, 0, 22, 92, 9, 8], [B.erts_ijzer, B.erts_ijzer_lei, 3, 66, 8, 7],
    [B.erts_goud, B.erts_goud_lei, 3, 32, 3, 6], [B.erts_robijn, B.erts_robijn, 2, 20, 3, 4], [B.kalksteen, 0, 44, 80, 2, 22], [B.klei, 0, 34, 58, 1, 14], [B.grind, 0, 5, 70, 3, 16],
    [B.graniet, 0, 30, 118, 2, 30], [B.basalt, B.basalt, 3, 30, 1, 18], [B.marmer, 0, 12, 70, 1, 20],
  ];
  const ADER_OFS = [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1];
  function aders(cx, cz, d) {
    const X0 = cx * CH, Z0 = cz * CH;
    for (let bz = -1; bz <= 1; bz++) for (let bx = -1; bx <= 1; bx++) {
      const ax = cx + bx, az = cz + bz;
      for (let e = 0; e < ERTS.length; e++) {
        const [blk, lei, lo, hi, aantal, groot] = ERTS[e];
        const r = rng(hsh(zaad, ax, az, 900 + e));
        for (let a = 0; a < aantal; a++) {
          let x = ax * CH + r() * CH, z = az * CH + r() * CH, y = lo + Math.pow(r(), e === 0 ? 1.4 : 1) * (hi - lo);
          const n = Math.max(1, Math.floor(groot * (0.5 + r())));
          for (let s = 0; s < n; s++) {
            const lx = Math.floor(x) - X0, lz = Math.floor(z) - Z0, ly = Math.floor(y);
            for (let o = 0; o < 12; o += 3) {
              const ox = ADER_OFS[o], oy = ADER_OFS[o + 1], oz = ADER_OFS[o + 2], px = lx + ox, py = ly + oy, pz = lz + oz;
              if (px < 0 || pz < 0 || px >= CH || pz >= CH || py < 1 || py >= HOOG) continue;
              if ((ox || oy || oz) && r() < 0.5) continue;
              const i = idx(px, py, pz), v = d[i];
              if (v === B.steen) d[i] = blk; else if (v === B.leisteen && lei) d[i] = lei;
              else if (v === B.leisteen && blk === B.erts_kolen) { /* geen kolen in leisteen */ }
            }
            x += r() * 2 - 1; y += r() * 1.4 - 0.7; z += r() * 2 - 1;
          }
        }
      }
    }
  }

  // ---------- extra steenkool (oktober 2026): dicht onder de oppervlakte, en in steen aan de lucht (kliffen, grotwanden,
  // ravijnen), zodat je snel licht kunt maken. Alleen in nieuwe stukken: niet in een gedeelde wereld van voor oktober 2026
  // (opt.erts 1), en in een oudere eigen wereld niet in de stukken waar je al was (opt.kolenOud: paren cx, cz, zoals
  // opt.oud bij het landschap). Wat daar ligt, verandert dus nooit.
  const skK = (cx, cz) => (cx + 32768) * 65536 + (cz + 32768);
  const KOLEN_OUD = (() => { const a = opt.kolenOud; if (a instanceof Set) return a.size ? a : null; if (!a || !a.length) return null; const st = new Set(); for (let i = 0; i + 1 < a.length; i += 2) st.add(skK(a[i], a[i + 1])); return st; })();
  const kolenHier = (cx, cz) => (opt.erts || 2) >= 2 && !(KOLEN_OUD && KOLEN_OUD.has(skK(cx, cz)));
  // hoog: de hoogte van de grond per kolom, 18 x 18 met een rand van 1 (zoals in stuk.js)
  function kolenErbij(cx, cz, d, hoog) {
    if (!kolenHier(cx, cz)) return;
    const X0 = cx * CH, Z0 = cz * CH, KOOL = B.erts_kolen, STEEN = B.steen;
    const zet = (x, y, z) => { if (x < 0 || z < 0 || x >= CH || z >= CH || y < 1 || y >= HOOG) return; const i = idx(x, y, z); if (d[i] === STEEN) d[i] = KOOL; };
    // 1. vier kleine aders per stuk, 2 tot 20 blokken onder de grond
    const r = rng(hsh(zaad, cx, cz, 0xc01e));
    for (let a = 0; a < 4; a++) {
      let x = r() * CH, z = r() * CH; const h = hoog[(Math.floor(z) + 1) * 18 + Math.floor(x) + 1];
      let y = h - 2 - r() * 18; const n = 5 + Math.floor(r() * 7);
      for (let s = 0; s < n; s++) {
        const lx = Math.floor(x), ly = Math.floor(y), lz = Math.floor(z);
        for (let o = 0; o < 12; o += 3) { if ((ADER_OFS[o] || ADER_OFS[o + 1] || ADER_OFS[o + 2]) && r() < 0.5) continue; zet(lx + ADER_OFS[o], ly + ADER_OFS[o + 1], lz + ADER_OFS[o + 2]); }
        x += r() * 2 - 1; y += r() * 1.4 - 0.7; z += r() * 2 - 1;
      }
    }
    // 2. steen die aan de lucht grenst, tot 40 blokken onder de grond: af en toe een plekje van een tot vier kolen
    const lucht = (x, y, z) => x >= 0 && z >= 0 && x < CH && z < CH && y > 0 && y < HOOG && d[idx(x, y, z)] === 0;
    for (let z = 0; z < CH; z++) for (let x = 0; x < CH; x++) {
      const h = hoog[(z + 1) * 18 + x + 1];
      for (let y = Math.max(24, h - 40); y <= Math.min(HOOG - 2, h + 20); y++) {
        if (d[idx(x, y, z)] !== STEEN) continue;
        if (!(lucht(x + 1, y, z) || lucht(x - 1, y, z) || lucht(x, y + 1, z) || lucht(x, y - 1, z) || lucht(x, y, z + 1) || lucht(x, y, z - 1))) continue;
        const k = kans(zaad ^ 0x6b01e, X0 + x, y, Z0 + z); if (k > 0.016) continue;
        zet(x, y, z);
        // een paar buren erbij (alleen steen in dit stuk)
        const n = Math.floor(k * 1e4) % 4;
        for (let j = 0; j < n; j++) { const q = hsh(zaad, X0 + x, y + j, Z0 + z) % 6; zet(x + (q === 0) - (q === 1), y + (q === 2) - (q === 3), z + (q === 4) - (q === 5)); }
      }
    }
  }

  Object.assign(wm, {
    ERTS, ADER_OFS, aders, kolenErbij,
  });
}

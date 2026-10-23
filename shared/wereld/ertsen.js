// Ertsaders: dezelfde aders, welk stuk ze ook maakt.
// Gedeelde code: draait op de pagina, in de rekenhulpjes en op de server (geen DOM).
import { B } from '../blokken.js';
import { CH, HOOG, idx } from '../maat.js';
import { hsh, rng } from '../toeval.js';

// wm: de werkplaats van één wereld (zaadje, ruis en wat de eerdere delen gemaakt hebben)
export function ertsen(wm) {
  const {
    zaad,
  } = wm;

  // ---------- ertsaders: dezelfde aders, welk stuk ze ook maakt
  const ERTS = [
    // blok, in leisteen, laagste, hoogste, aders per stuk, grootte
    [B.erts_kolen, 0, 8, 118, 16, 10], [B.erts_koper, 0, 22, 92, 9, 8], [B.erts_ijzer, B.erts_ijzer_lei, 3, 66, 8, 7],
    [B.erts_goud, B.erts_goud_lei, 3, 32, 3, 6], [B.erts_robijn, B.erts_robijn, 2, 20, 3, 4], [B.mergel, 0, 44, 80, 2, 22], [B.klei, 0, 34, 58, 1, 14], [B.grind, 0, 5, 70, 3, 16],
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

  Object.assign(wm, {
    ERTS, ADER_OFS, aders,
  });
}

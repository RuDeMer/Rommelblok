// Simplexruis en kleine rekenhulpjes (glad, mix, spline).
// Gedeelde code: draait op de pagina, in de rekenhulpjes en op de server (geen DOM).
import { rng } from './toeval.js';

// ---------------- simplexruis (naar het openbare voorbeeld van Stefan Gustavson)
const GR3 = new Int8Array([1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0, 1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1, 0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1]);
const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6, F3 = 1 / 3, G3 = 1 / 6;
function ruis(zaad) {
  const r = rng(zaad), p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
  const perm = new Uint8Array(512), m12 = new Uint8Array(512);
  for (let i = 0; i < 512; i++) { perm[i] = p[i & 255]; m12[i] = perm[i] % 12; }
  function r2(xin, yin) {
    const s = (xin + yin) * F2, i = Math.floor(xin + s), j = Math.floor(yin + s), t = (i + j) * G2;
    const x0 = xin - (i - t), y0 = yin - (j - t);
    const i1 = x0 > y0 ? 1 : 0, j1 = 1 - i1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    let n = 0, tt, g;
    tt = 0.5 - x0 * x0 - y0 * y0; if (tt > 0) { g = m12[ii + perm[jj]] * 3; tt *= tt; n += tt * tt * (GR3[g] * x0 + GR3[g + 1] * y0); }
    tt = 0.5 - x1 * x1 - y1 * y1; if (tt > 0) { g = m12[ii + i1 + perm[jj + j1]] * 3; tt *= tt; n += tt * tt * (GR3[g] * x1 + GR3[g + 1] * y1); }
    tt = 0.5 - x2 * x2 - y2 * y2; if (tt > 0) { g = m12[ii + 1 + perm[jj + 1]] * 3; tt *= tt; n += tt * tt * (GR3[g] * x2 + GR3[g + 1] * y2); }
    return 70 * n;
  }
  function r3(xin, yin, zin) {
    const s = (xin + yin + zin) * F3, i = Math.floor(xin + s), j = Math.floor(yin + s), k = Math.floor(zin + s), t = (i + j + k) * G3;
    const x0 = xin - (i - t), y0 = yin - (j - t), z0 = zin - (k - t);
    let i1, j1, k1, i2, j2, k2;
    if (x0 >= y0) { if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; } else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; } else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; } }
    else { if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; } else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; } else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; } }
    const x1 = x0 - i1 + G3, y1 = y0 - j1 + G3, z1 = z0 - k1 + G3, x2 = x0 - i2 + 2 * G3, y2 = y0 - j2 + 2 * G3, z2 = z0 - k2 + 2 * G3, x3 = x0 - 1 + 3 * G3, y3 = y0 - 1 + 3 * G3, z3 = z0 - 1 + 3 * G3;
    const ii = i & 255, jj = j & 255, kk = k & 255;
    let n = 0, tt, g;
    tt = 0.6 - x0 * x0 - y0 * y0 - z0 * z0; if (tt > 0) { g = m12[ii + perm[jj + perm[kk]]] * 3; tt *= tt; n += tt * tt * (GR3[g] * x0 + GR3[g + 1] * y0 + GR3[g + 2] * z0); }
    tt = 0.6 - x1 * x1 - y1 * y1 - z1 * z1; if (tt > 0) { g = m12[ii + i1 + perm[jj + j1 + perm[kk + k1]]] * 3; tt *= tt; n += tt * tt * (GR3[g] * x1 + GR3[g + 1] * y1 + GR3[g + 2] * z1); }
    tt = 0.6 - x2 * x2 - y2 * y2 - z2 * z2; if (tt > 0) { g = m12[ii + i2 + perm[jj + j2 + perm[kk + k2]]] * 3; tt *= tt; n += tt * tt * (GR3[g] * x2 + GR3[g + 1] * y2 + GR3[g + 2] * z2); }
    tt = 0.6 - x3 * x3 - y3 * y3 - z3 * z3; if (tt > 0) { g = m12[ii + 1 + perm[jj + 1 + perm[kk + 1]]] * 3; tt *= tt; n += tt * tt * (GR3[g] * x3 + GR3[g + 1] * y3 + GR3[g + 2] * z3); }
    return 32 * n;
  }
  function fbm2(x, z, oct) { let s = 0, a = 1, f = 1, t = 0; for (let o = 0; o < oct; o++) { s += a * r2(x * f + o * 31.7, z * f - o * 17.3); t += a; a *= 0.5; f *= 2.03; } return s / t; }
  function fbm3(x, y, z, oct) { let s = 0, a = 1, f = 1, t = 0; for (let o = 0; o < oct; o++) { s += a * r3(x * f + o * 31.7, y * f, z * f - o * 17.3); t += a; a *= 0.5; f *= 2.03; } return s / t; }
  function ribbel(x, z, oct) { let s = 0, a = 1, f = 1, t = 0, w = 1; for (let o = 0; o < oct; o++) { let v = 1 - Math.abs(r2(x * f + o * 13.1, z * f + o * 7.7)); v *= v * w; w = Math.min(1, v * 1.6); s += a * v; t += a; a *= 0.5; f *= 2.1; } return s / t; }
  return { r2, r3, fbm2, fbm3, ribbel };
}
const glad = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;
function spline(pt, x) {
  if (x <= pt[0][0]) return pt[0][1];
  for (let i = 1; i < pt.length; i++) if (x < pt[i][0]) { const [x0, y0] = pt[i - 1], [x1, y1] = pt[i]; const t = (x - x0) / (x1 - x0); return y0 + (y1 - y0) * t * t * (3 - 2 * t); }
  return pt[pt.length - 1][1];
}

export {
  GR3, F2, G2, F3, G3, ruis, glad, mix, spline,
};

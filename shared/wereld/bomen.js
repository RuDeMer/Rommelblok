// Bomen, struiken, cactussen en rotsen.
// Gedeelde code: draait op de pagina, in de rekenhulpjes en op de server (geen DOM).
import { B } from '../blokken.js';
import { RICHTING } from '../vormen.js';
import { BI } from './biomen.js';

// wm: de werkplaats van één wereld (zaadje, ruis en wat de eerdere delen gemaakt hebben)
export function bomen(wm) {
  const {
    nBloem,
  } = wm;

  // ---------- bomen
  // zet(x, y, z, waarde, voorrang): voorrang 2 = stam (gaat over bladeren), 1 = bladeren (alleen in lucht of planten)
  function bol(zet, cx, cy, cz, rx, ry, rz, v, r, gat) {
    for (let dy = -Math.ceil(ry); dy <= Math.ceil(ry); dy++) for (let dz = -Math.ceil(rz); dz <= Math.ceil(rz); dz++) for (let dx = -Math.ceil(rx); dx <= Math.ceil(rx); dx++) {
      const d = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) + (dz * dz) / (rz * rz);
      if (d <= 1 && !(d > 0.62 && r() < (gat || 0.22))) zet(cx + dx, cy + dy, cz + dz, v, 1);
    }
  }
  const stamv = (s, as) => B['stam_' + s] | ((as || 0) << 8);
  function zetBoom(soort, x, y, z, r, zet) {
    if (soort === 'eik' || soort === 'esdoorn') {
      const h = 4 + Math.floor(r() * 3) + (soort === 'esdoorn' ? 1 : 0);
      const blad = soort === 'eik' ? B.blad_eik : [B.blad_esdoorn, B.blad_esdoorn_oranje, B.blad_esdoorn_geel][Math.floor(r() * 3)];
      bol(zet, x, y + h, z, 2.6, 2.1, 2.6, blad, r);
      if (r() < 0.5) bol(zet, x + (r() < 0.5 ? -1 : 1), y + h - 1, z + (r() < 0.5 ? -1 : 1), 1.8, 1.4, 1.8, blad, r);
      for (let i = 0; i < h + 1; i++) zet(x, y + i, z, stamv(soort), 2);
    } else if (soort === 'grote_eik') {
      const h = 7 + Math.floor(r() * 4);
      for (let i = 0; i < h; i++) zet(x, y + i, z, stamv('eik'), 2);
      bol(zet, x, y + h + 1, z, 3.2, 2.4, 3.2, B.blad_eik, r);
      const takken = 2 + Math.floor(r() * 3);
      for (let t = 0; t < takken; t++) {
        const a = r() * Math.PI * 2, l = 2 + Math.floor(r() * 3), by = y + h - 3 + Math.floor(r() * 3);
        const ax = Math.cos(a), az = Math.sin(a), as = Math.abs(ax) > Math.abs(az) ? 1 : 2;
        let ex = x, ez = z;
        for (let i = 1; i <= l; i++) { ex = x + Math.round(ax * i); ez = z + Math.round(az * i); zet(ex, by + Math.floor(i / 2), ez, stamv('eik', as), 2); }
        bol(zet, ex, by + Math.floor(l / 2) + 1, ez, 2.2, 1.6, 2.2, B.blad_eik, r);
      }
    } else if (soort === 'kers') {
      // laag en breed, met een kruin van roze bloesem
      const h = 3 + Math.floor(r() * 2);
      for (let i = 0; i < h + 1; i++) zet(x, y + i, z, stamv('kers'), 2);
      for (let t = 0; t < 2; t++) { const ax = r() < 0.5 ? -1 : 1, az = r() < 0.5 ? -1 : 1; zet(x + ax, y + h, z + az, stamv('kers', 1), 2); }
      bol(zet, x, y + h + 1, z, 3.1, 1.9, 3.1, B.blad_kers, r);
    } else if (soort === 'noten') {
      // hoog, met een brede, losse kruin
      const h = 6 + Math.floor(r() * 3);
      for (let i = 0; i < h + 1; i++) zet(x, y + i, z, stamv('noten'), 2);
      bol(zet, x, y + h, z, 3.3, 2.3, 3.3, B.blad_noten, r);
      bol(zet, x + (r() < 0.5 ? -2 : 2), y + h - 2, z + (r() < 0.5 ? -1 : 1), 2.0, 1.5, 2.0, B.blad_noten, r);
    } else if (soort === 'berk') {
      const h = 5 + Math.floor(r() * 3);
      bol(zet, x, y + h, z, 1.9, 2.6, 1.9, B.blad_berk, r, 0.3);
      for (let i = 0; i < h + 1; i++) zet(x, y + i, z, stamv('berk'), 2);
    } else if (soort === 'spar') {
      const h = 7 + Math.floor(r() * 5);
      let rad = 1.2 + h * 0.22;
      for (let i = 2; i <= h + 1; i++) {
        const t = (i - 2) / (h - 1), rr = Math.max(0.6, rad * (1 - t)) * ((i % 2) ? 1 : 0.72);
        const ri = Math.ceil(rr);
        for (let dz = -ri; dz <= ri; dz++) for (let dx = -ri; dx <= ri; dx++) if (dx * dx + dz * dz <= rr * rr + 0.3) zet(x + dx, y + i, z + dz, B.blad_spar, 1);
      }
      zet(x, y + h + 2, z, B.blad_spar, 1);
      for (let i = 0; i < h + 1; i++) zet(x, y + i, z, stamv('spar'), 2);
    } else if (soort === 'baobab') {
      const h = 6 + Math.floor(r() * 3);
      for (let i = -1; i < h; i++) for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) zet(x + dx, y + i, z + dz, stamv('baobab'), 2);
      for (const [dx, dz] of [[-1, 0], [2, 1], [0, -1], [1, 2]]) for (let i = 0; i < 2; i++) zet(x + dx, y + i, z + dz, stamv('baobab'), 2);
      const takken = 3 + Math.floor(r() * 3);
      for (let t = 0; t < takken; t++) {
        const a = (t / takken) * Math.PI * 2 + r(), l = 2 + Math.floor(r() * 2), ax = Math.cos(a), az = Math.sin(a), as = Math.abs(ax) > Math.abs(az) ? 1 : 2;
        let ex = x, ez = z, ey = y + h;
        for (let i = 1; i <= l; i++) { ex = x + Math.round(ax * (i + 0.5)); ez = z + Math.round(az * (i + 0.5)); ey = y + h - 1 + i; zet(ex, ey, ez, stamv('baobab', as), 2); }
        bol(zet, ex, ey + 1, ez, 2.2, 0.9, 2.2, B.blad_baobab, r, 0.15);
      }
    } else if (soort === 'wilg') {
      const h = 4 + Math.floor(r() * 3);
      for (let i = 0; i < h + 1; i++) zet(x, y + i, z, stamv('wilg'), 2);
      // klimop tegen de stam (de stand wijst naar de stam toe)
      for (let k = 0; k < 4; k++) if (r() < 0.35) { const [dx, dz] = RICHTING[k], van = Math.floor(r() * 2); for (let i = van; i < h - 1; i++) zet(x + dx, y + i, z + dz, B.klimop | (k << 8)); }
      const R = 3.4 + r() * 0.8;
      bol(zet, x, y + h, z, R, 1.7, R, B.blad_wilg, r, 0.1);
      // hangende takken langs de onderrand
      for (let a = 0; a < 24; a++) {
        if (r() < 0.45) continue;
        const t = (a / 24) * Math.PI * 2, tx = x + Math.round(Math.cos(t) * (R - 0.4)), tz = z + Math.round(Math.sin(t) * (R - 0.4));
        const l = 1 + Math.floor(r() * 4);
        for (let i = 0; i < l; i++) zet(tx, y + h - 1 - i, tz, B.wilgentak, 1);
      }
    } else if (soort === 'cactus') {
      const h = 2 + Math.floor(r() * 4);
      for (let i = 0; i < h; i++) zet(x, y + i, z, B.cactus, 2);
      if (h >= 4 && r() < 0.6) {
        const [dx, dz] = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(r() * 4)], ay = y + 1 + Math.floor(r() * 2);
        zet(x + dx, ay, z + dz, B.cactus, 2); zet(x + dx, ay + 1, z + dz, B.cactus, 2); if (r() < 0.5) zet(x + dx, ay + 2, z + dz, B.cactus, 2);
      }
    } else if (soort === 'rots') {
      const rr = 1.2 + r() * 1.3, ri = Math.ceil(rr);
      for (let dy = -1; dy <= ri; dy++) for (let dz = -ri; dz <= ri; dz++) for (let dx = -ri; dx <= ri; dx++) {
        if (dx * dx + dz * dz + dy * dy * 1.6 <= rr * rr) zet(x + dx, y + dy, z + dz, r() < 0.5 ? B.mostkei : B.kei, 2);
      }
    } else if (soort === 'struik') {
      bol(zet, x, y, z, 1.3, 1, 1.3, B.blad_eik, r, 0.25); zet(x, y, z, stamv('eik'), 2);
    }
  }
  // boomgaarden: plekken in de vlakte met kersenbomen (wat dichter op elkaar)
  const boomgaard = (x, z) => nBloem.r2(x / 140 + 31.7, z / 140 - 12.3) > 0.42;
  // af en toe een verwilderd gewas in het gras: zo vind je aardappels, wortels, bieten en pompoenen
  const wildGewas = r2 => { const k = Math.floor(r2 * 1e4) % 5; return k === 4 ? B.pompoen : (B.gewas_aardappel + [0, 1, 2, 0][k]) | (3 << 8); };
  function boomVoor(b, x, z, r) {
    // welk soort boom en hoeveel kans per vakje (vakjes van 5 bij 5)
    switch (b) {
      case BI.bos: return r() < 0.15 ? 'grote_eik' : r() < 0.3 ? 'berk' : r() < 0.06 ? 'struik' : r() < 0.1 ? 'noten' : 'eik';
      case BI.berkenbos: return r() < 0.85 ? 'berk' : 'eik';
      case BI.herfstbos: return r() < 0.7 ? 'esdoorn' : r() < 0.3 ? 'noten' : r() < 0.6 ? 'berk' : 'eik';
      case BI.taiga: return r() < 0.06 ? 'rots' : 'spar';
      case BI.sneeuwvlakte: return 'spar';
      case BI.sneeuwbergen: case BI.bergen: return 'spar';
      case BI.vlakte: case BI.tulpenveld: return boomgaard(x, z) ? 'kers' : r() < 0.5 ? 'eik' : 'struik';
      case BI.heide: return r() < 0.5 ? 'berk' : 'struik';
      case BI.savanne: return r() < 0.7 ? 'baobab' : 'struik';
      case BI.moeras: return 'wilg';
      case BI.woestijn: return 'cactus';
      default: return null;
    }
  }
  const BOOMKANS = []; BOOMKANS[BI.bos] = 0.62; BOOMKANS[BI.berkenbos] = 0.6; BOOMKANS[BI.herfstbos] = 0.6; BOOMKANS[BI.taiga] = 0.5; BOOMKANS[BI.sneeuwvlakte] = 0.06;
  BOOMKANS[BI.sneeuwbergen] = 0.07; BOOMKANS[BI.bergen] = 0.06; BOOMKANS[BI.vlakte] = 0.035; BOOMKANS[BI.tulpenveld] = 0.01; BOOMKANS[BI.heide] = 0.05; BOOMKANS[BI.savanne] = 0.06; BOOMKANS[BI.moeras] = 0.28; BOOMKANS[BI.woestijn] = 0.1;

  Object.assign(wm, {
    bol, stamv, zetBoom, boomgaard, wildGewas, boomVoor, BOOMKANS,
  });
}

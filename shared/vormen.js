// Vormen van blokken die geen hele kubus zijn: tekenen, botsen en richten.
// Gedeelde code: draait op de pagina, in de rekenhulpjes en op de server (geen DOM).
import { B, BL, DICHT, tex } from './blokken.js';

// ============================================================================
// Vormen van blokken die geen hele kubus zijn, in zestienden van een blok.
// Een doos is [x0, y0, z0, x1, y1, z1, laag+x, laag-x, laag+y, laag-y, laag+z, laag-z].
// Richting r: 0 noord (-z), 1 oost (+x), 2 zuid (+z), 3 west (-x). Vormen zijn getekend voor noord en worden gedraaid.
// ============================================================================
const RICHTING = [[0, -1], [1, 0], [0, 1], [-1, 0]];
function draai(d, r) {
  if (!r) return d;
  const p = (x, z) => { const dx = x - 8, dz = z - 8; return r === 1 ? [8 - dz, 8 + dx] : r === 2 ? [8 - dx, 8 - dz] : [8 + dz, 8 - dx]; };
  const [ax, az] = p(d[0], d[2]), [bx, bz] = p(d[3], d[5]);
  // de vlakken draaien mee: voor noord is -z de voorkant
  const t = d.slice(6), f = [t[0], t[1], t[2], t[3], t[4], t[5]];
  // volgorde van de zijvlakken bij een kwartslag met de klok mee (van boven gezien): -z -> +x -> +z -> -x -> -z
  const zij = [t[5], t[0], t[4], t[1]]; // -z, +x, +z, -x
  const nz = [];
  for (let i = 0; i < 4; i++) nz[(i + r) % 4] = zij[i];
  f[5] = nz[0]; f[0] = nz[1]; f[4] = nz[2]; f[1] = nz[3];
  const uit = [Math.min(ax, bx), d[1], Math.min(az, bz), Math.max(ax, bx), d[4], Math.max(az, bz)].concat(f);
  if (d.length > 12) uit.push(d[12]);
  return uit;
}
// verschuiving van de textuur voor dozen die elders staan dan hun tekening (in zestienden): fakkel aan de muur, hangende lantaarn
const TEXOFS = [[0, 0, 0], [0, 3, 5], [-5, 3, 0], [0, 3, -5], [5, 3, 0], [0, 1, 0]];
const doos = (x0, y0, z0, x1, y1, z1, t) => [x0, y0, z0, x1, y1, z1].concat(typeof t === 'number' ? [t, t, t, t, t, t] : t);
function vormDozen(v, buur) {
  // buur(dx, dy, dz) geeft de blokwaarde ernaast (alleen nodig voor hekjes)
  const id = v & 255, st = v >> 8, b = BL[id]; if (!b) return [];
  const r = st & 3;
  switch (b.vorm) {
    case 'fakkel': {
      const t = b.tz, th = tex('fakkel_houder');
      if (!st) return [doos(7, 0, 7, 9, 10, 9, [t, t, t, t, t, t])];
      return [draai(doos(7, 3, 12, 9, 13, 14, t).concat([st]), st - 1), draai(doos(6, 4, 14, 10, 6, 16, th), st - 1)];
    }
    case 'lantaarn': {
      const t = b.tz, tt = tex('lantaarn_top'), tk = tex('lantaarn_ketting');
      if (st & 1) return [doos(5, 1, 5, 11, 8, 11, [t, t, tt, tt, t, t]).concat([5]), doos(6, 8, 6, 10, 10, 10, tt).concat([5]), doos(7, 10, 7, 9, 16, 9, tk)];
      return [doos(5, 0, 5, 11, 7, 11, [t, t, tt, tt, t, t]), doos(6, 7, 6, 10, 9, 10, tt), doos(7, 9, 7, 9, 11, 9, tk)];
    }
    case 'plaat': {
      const t = [b.tz, b.tz, b.tb, b.to, b.tz, b.tz];
      if (st & 2) return [doos(0, 0, 0, 16, 16, 16, t)];
      return [st & 1 ? doos(0, 8, 0, 16, 16, 16, t) : doos(0, 0, 0, 16, 8, 16, t)];
    }
    case 'trap': {
      const t = [b.tz, b.tz, b.tb, b.to, b.tz, b.tz], om = st & 4;
      const a = om ? doos(0, 8, 0, 16, 16, 16, t) : doos(0, 0, 0, 16, 8, 16, t);
      const h = om ? doos(0, 0, 0, 16, 8, 8, t) : doos(0, 8, 0, 16, 16, 8, t);
      return [a, draai(h, r)];
    }
    case 'deur': {
      const open = st & 4, boven = st & 8, rechts = st & 16;
      const tv = boven ? tex('deur_boven') : b.tz, tr = tex('planken_eik');
      let d = doos(0, 0, 0, 16, 16, 3, [tr, tr, tr, tr, tv, tv]);
      if (open) d = rechts ? doos(13, 0, 0, 16, 16, 16, [tv, tv, tr, tr, tr, tr]) : doos(0, 0, 0, 3, 16, 16, [tv, tv, tr, tr, tr, tr]);
      return [draai(d, r)];
    }
    case 'luik': {
      const t = b.tz, open = st & 4, boven = st & 8;
      if (open) return [draai(doos(0, 0, 13, 16, 16, 16, t), r)];
      return [boven ? doos(0, 13, 0, 16, 16, 16, t) : doos(0, 0, 0, 16, 3, 16, t)];
    }
    case 'ladder': return [draai(doos(0, 0, 15, 16, 16, 16, b.tz), r)];
    case 'hek': {
      const t = b.tz, uit = [doos(6, 0, 6, 10, 16, 10, t)];
      if (buur) for (let i = 0; i < 4; i++) {
        const [dx, dz] = RICHTING[i], n = buur(dx, 0, dz), ni = n & 255;
        if (ni === id || DICHT[ni]) { uit.push(draai(doos(7, 6, 0, 9, 9, 6, t), i)); uit.push(draai(doos(7, 12, 0, 9, 15, 6, t), i)); }
      }
      return uit;
    }
    case 'bed': {
      const kop = st & 4, tb = kop ? tex('bed_kop') : b.tb, tz = kop ? tex('bed_kop_zij') : b.tz;
      return [doos(0, 0, 0, 16, 9, 16, [tz, tz, tb, b.to, tz, tz])];
    }
    case 'kist': return [draai(doos(1, 0, 1, 15, 14, 15, [b.tz, b.tz, b.tb, b.to, b.ta, b.tv]), r)];
    case 'cactus': return [doos(1, 0, 1, 15, 16, 15, [b.tz, b.tz, b.tb, b.to, b.tz, b.tz])];
    case 'lelie': return [doos(1, -1, 1, 15, -1, 15, b.tz)];
    case 'vlaai': { const h = st & 3; return [doos(1, 0, 1, 15 - h * 3, 8, 15, [h ? tex('vlaai_binnen') : b.tz, b.tz, b.tb, b.to, b.tz, b.tz])]; }
    case 'tapijt': return [doos(0, 0, 0, 16, 1, 16, b.tz)];
    case 'pot': {
      // een pot van terracotta met aarde erin; met een plant (stand) staan er twee platte plantjes in, kruislings
      const t = b.tz, ta = tex('pot_aarde'), uit = [doos(5, 0, 5, 11, 6, 11, [t, t, ta, t, t, t])];
      const pl = POTPLANT[st]; if (pl) { const tp = BL[pl].tz; uit.push(doos(8, 6, 4, 8, 16, 12, tp), doos(4, 6, 8, 12, 16, 8, tp)); }
      return uit;
    }
    case 'kaars': return [doos(7, 0, 7, 9, 5, 9, b.tz), doos(7, 5, 7, 9, 8, 9, b.tz)];
    case 'tafel': { const t = b.tz; return [doos(0, 13, 0, 16, 16, 16, t), doos(1, 0, 1, 3, 13, 3, t), doos(13, 0, 1, 15, 13, 3, t), doos(1, 0, 13, 3, 13, 15, t), doos(13, 0, 13, 15, 13, 15, t)]; }
    case 'stoel': {
      const t = b.tz;
      return [doos(2, 7, 2, 14, 9, 14, t), doos(2, 0, 2, 4, 7, 4, t), doos(12, 0, 2, 14, 7, 4, t), doos(2, 0, 12, 4, 7, 14, t), doos(12, 0, 12, 14, 7, 14, t), doos(2, 9, 12, 14, 16, 14, t)].map(d => draai(d, r));
    }
    case 'spoor': {
      // dwarsliggers van hout en twee rails, recht (0 tot 3), als helling omhoog naar richting d (4 + d), of als bocht tussen richting k en k + 1 (8 + k)
      const th = tex('spoor_hout'), ti = b.tz, s = st & 15, uit = [];
      if (s < 4) {
        for (const z0 of [1, 5, 9, 13]) uit.push(doos(1, 0, z0, 15, 1, z0 + 2, th));
        uit.push(doos(3, 1, 0, 5, 2, 16, ti), doos(11, 1, 0, 13, 2, 16, ti));
        return uit.map(d => draai(d, s & 1));
      }
      if (s < 8) {
        // in treetjes van 2 omhoog naar +z, en dan gedraaid naar de goede kant
        for (let i = 0; i < 4; i++) uit.push(doos(1, i * 4, 1 + i * 4, 15, i * 4 + 1, 3 + i * 4, th));
        for (let i = 0; i < 8; i++) uit.push(doos(3, 1 + i * 2, i * 2, 5, Math.min(16, 3 + i * 2), i * 2 + 2, ti), doos(11, 1 + i * 2, i * 2, 13, Math.min(16, 3 + i * 2), i * 2 + 2, ti));
        return uit.map(d => draai(d, (s - 4 + 2) % 4));
      }
      // bocht van noord (-z) naar oost (+x), om de hoek (16, 0), en dan gedraaid
      uit.push(doos(2, 0, 1, 14, 1, 3, th), doos(13, 0, 2, 15, 1, 14, th), doos(7, 0, 5, 11, 1, 9, th));
      for (const [R, n] of [[4, 5], [12, 11]]) {
        const gezien = new Set();
        for (let i = 0; i <= n; i++) {
          const f = i / n * Math.PI / 2, cx = Math.round(16 - R * Math.cos(f)), cz = Math.round(R * Math.sin(f));
          const x0 = Math.max(0, Math.min(14, cx - 1)), z0 = Math.max(0, Math.min(14, cz - 1)), k = x0 + ',' + z0;
          if (gezien.has(k)) continue; gezien.add(k); uit.push(doos(x0, 1, z0, x0 + 2, 2, z0 + 2, ti));
        }
      }
      return uit.map(d => draai(d, s - 8));
    }
  }
  return [];
}
// planten die in een bloempot passen (stand 1 en hoger)
const POTPLANT = [0, B.tulp_rood, B.tulp_geel, B.tulp_oranje, B.tulp_roze, B.paardenbloem, B.korenbloem, B.klaproos, B.madelief, B.lavendel, B.zonnebloem, B.vergeetmenietje, B.paddenstoel_bruin, B.paddenstoel_rood, B.dorre_struik,
  B.stekje_eik, B.stekje_berk, B.stekje_spar, B.stekje_esdoorn, B.stekje_baobab, B.stekje_wilg, B.stekje_kers, B.stekje_noten];
// botsen: welke dozen houden je tegen (in zestienden)
function botsDozen(v, buur) {
  const id = v & 255, b = BL[id]; if (!b || !b.vast) return null;
  switch (b.vorm) {
    case 'kubus': return [[0, 0, 0, 16, 16, 16]];
    case 'hek': {
      // een paal van 8 breed en anderhalf blok hoog, met armen naar verbonden buren
      const uit = [[4, 0, 4, 12, 24, 12]];
      if (buur) for (let i = 0; i < 4; i++) {
        const [dx, dz] = RICHTING[i], ni = buur(dx, 0, dz) & 255;
        if (ni === id || DICHT[ni]) uit.push(dx ? [dx > 0 ? 12 : 0, 0, 6, dx > 0 ? 16 : 4, 24, 10] : [6, 0, dz > 0 ? 12 : 0, 10, 24, dz > 0 ? 16 : 4]);
      }
      return uit;
    }
    case 'deur': case 'luik': case 'plaat': case 'trap': case 'bed': case 'kist': case 'cactus': case 'vlaai': case 'tafel': case 'stoel': return vormDozen(v, buur).map(d => d.slice(0, 6));
    case 'tapijt': return [[0, 0, 0, 16, 1, 16]];
    case 'pot': return [[5, 0, 5, 11, 6, 11]];
    case 'lantaarn': return null;
  }
  return [[0, 0, 0, 16, 16, 16]];
}
// richten: waar je op kunt klikken
function kijkDozen(v, buur) {
  const id = v & 255, b = BL[id]; if (!b || id === 0 || b.vorm === 'water') return null;
  if (b.vorm === 'kubus') return [[0, 0, 0, 16, 16, 16]];
  if (b.vorm === 'kruis') return [[3, 0, 3, 13, id === B.riet ? 16 : 12, 13]];
  if (b.vorm === 'lelie') return [[1, 0, 1, 15, 1, 15]];
  const d = vormDozen(v, buur).map(x => x.slice(0, 6));
  if (b.vorm === 'pot') return [[5, 0, 5, 11, POTPLANT[v >> 8] ? 14 : 6, 11]];
  if (b.vorm === 'spoor' && ((v >> 8) & 15) >= 4 && ((v >> 8) & 15) < 8) return [[0, 0, 0, 16, 9, 16]];
  if (b.vorm === 'fakkel' || b.vorm === 'lantaarn' || b.vorm === 'kaars' || b.vorm === 'spoor') { let a = [16, 16, 16, 0, 0, 0]; for (const x of d) { for (let i = 0; i < 3; i++) { a[i] = Math.min(a[i], x[i]); a[i + 3] = Math.max(a[i + 3], x[i + 3]); } } return [a]; }
  return d;
}

export {
  RICHTING, draai, TEXOFS, doos, vormDozen, POTPLANT, botsDozen, kijkDozen,
};

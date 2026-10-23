// Ruïnes, oude mijnen en sterrenkraters, en het neerzetten van alle bouwwerken in een stuk.
// Gedeelde code: draait op de pagina, in de rekenhulpjes en op de server (geen DOM).
import { B, LAAG, VAST, VERVANG, W } from '../blokken.js';
import { CH, HOOG, ZEE, idx } from '../maat.js';
import { hsh, rng } from '../toeval.js';
import { RICHTING } from '../vormen.js';
import { BI } from './biomen.js';

// wm: de werkplaats van één wereld (zaadje, ruis en wat de eerdere delen gemaakt hebben)
export function bouwwerken(wm) {
  const {
    bouwVakken, GB, zaad, BOUW, dorpVan, DG, dorp, BW, dorpBij, kolom, bk, NAT_STREEK, hKol, openBoven, VUL,
    OPGROND, GRAAF, GEN, oudInBuurt, ZET,
  } = wm;

  function bouwVak(gx, gz) {
    const sleutel = gx * 100003 + gz; let bv = bouwVakken.get(sleutel); if (bv) return bv;
    if (bouwVakken.size > 160) { let n = 0; for (const k of bouwVakken.keys()) { bouwVakken.delete(k); if (++n >= 40) break; } }
    const lijst = [], soorten = [], vakX = gx * GB, vakZ = gz * GB, r = rng(hsh(zaad, gx, gz, 8101));
    const zet = (x, y, z, v, m) => { if (y >= 2 && y < HOOG - 1) lijst.push(x, y, z, v, m || 0); };
    const keus = r();
    if (keus < BOUW.krater) krater(rng(hsh(zaad, gx, gz, 8102)), vakX, vakZ, zet, soorten);
    else if (keus < BOUW.krater + BOUW.ruine) ruine(rng(hsh(zaad, gx, gz, 8103)), vakX, vakZ, zet, soorten);
    if (r() < BOUW.mijn) mijn(rng(hsh(zaad, gx, gz, 8104)), vakX, vakZ, zet, soorten);
    const dp = dorpVan(Math.floor(gx / DG), Math.floor(gz / DG));
    if (dp && Math.floor(dp.x / GB) === gx && Math.floor(dp.z / GB) === gz) dorp(rng(hsh(zaad, gx, gz, 8105)), dp, zet, soorten);
    // per stuk van 16 x 16 een lijstje (net als bij de grotten)
    const L = Int32Array.from(lijst), emmers = new Map();
    for (let i = 0; i < L.length; i += BW) { const k = (L[i] >> 4) * 100003 + (L[i + 2] >> 4); let e = emmers.get(k); if (!e) emmers.set(k, e = []); e.push(i); }
    for (const [k, e] of emmers) emmers.set(k, Int32Array.from(e));
    bv = { L, emmers, soorten }; bouwVakken.set(sleutel, bv);
    return bv;
  }
  // een oude kist: in de stand staat ook de soort buit (0 ruïne, 1 mijn)
  const kistStand = (richting, soort) => B.buitkist | ((richting | (soort << 2)) << 8);
  function ruine(r, vakX, vakZ, zet, soorten) {
    const toren = r() < 0.3, w = toren ? 5 : 6 + Math.floor(r() * 4), l = toren ? 5 : 6 + Math.floor(r() * 4);
    const x0 = vakX + 8 + Math.floor(r() * (GB - 16 - w)), z0 = vakZ + 8 + Math.floor(r() * (GB - 16 - l));
    const mx = x0 + (w >> 1), mz = z0 + (l >> 1); if (dorpBij(mx, mz, 14)) return;
    const k = kolom(mx, mz, bk), y0 = Math.floor(k.h), streek = k.b;
    if (y0 <= ZEE + 1 || y0 > 100 || k.m > 0.2 || k.rf > 0.05 || NAT_STREEK.has(streek)) return;
    // alleen op een vlak stukje
    const hk = []; let lo = 999, hi = -999;
    for (let z = -1; z <= l; z++) for (let x = -1; x <= w; x++) { const h = hKol(x0 + x, z0 + z); hk.push(h); if (h < lo) lo = h; if (h > hi) hi = h; }
    if (hi - lo > 3 || lo <= ZEE || openBoven(mx, mz, y0)) return;
    const woest = streek === BI.woestijn, H = toren ? 6 + Math.floor(r() * 4) : 3 + Math.floor(r() * 2);
    const steen = () => { const q = r(); return woest ? (q < 0.75 ? B.zandsteen : B.kei) : q < 0.45 ? B.steenstenen : q < 0.72 ? B.gebarsten_steen : q < 0.9 ? B.mostkei : B.kei; };
    // fundering, vloer en ruimte erboven (ook bomen gaan weg)
    for (let z = 0; z < l; z++) for (let x = 0; x < w; x++) {
      const X = x0 + x, Z = z0 + z, h = hk[(z + 1) * (w + 2) + x + 1];
      for (let y = h + 1; y < y0; y++) zet(X, y, Z, steen(), VUL);
      if (h < y0 || r() < 0.8) zet(X, y0, Z, steen()); // soms groeit er nog gras door de vloer
      for (let y = y0 + 1; y <= y0 + 14; y++) zet(X, y, Z, 0);
    }
    // muren: vervallen, de hoeken staan het hoogst; een deuropening en ramen
    const deurKant = Math.floor(r() * 4), klimop = [];
    for (let z = 0; z < l; z++) for (let x = 0; x < w; x++) {
      if (x !== 0 && z !== 0 && x !== w - 1 && z !== l - 1) continue;
      const hoek = (x === 0 || x === w - 1) && (z === 0 || z === l - 1);
      const kant = z === 0 ? 0 : x === w - 1 ? 1 : z === l - 1 ? 2 : 3;
      const midden = kant === 0 || kant === 2 ? x === (w >> 1) : z === (l >> 1);
      const hm = hoek ? H : H - Math.floor(r() * r() * (H + 1));
      const raam = !hoek && !midden && ((x + z) % 3 === 0);
      let top = 0;
      for (let y = 1; y <= hm; y++) {
        if (midden && kant === deurKant && y <= 2) continue;
        if (raam && (y === 2 || (toren && y % 3 === 2))) continue;
        zet(x0 + x, y0 + y, z0 + z, steen()); top = y;
      }
      // klimop langs de buitenkant, van boven naar beneden
      if (!hoek && top >= 2 && r() < 0.35) { const [dx, dz] = RICHTING[kant]; for (let y = top; y >= 1; y--) if (!(raam && y === 2)) klimop.push(x0 + x + dx, y0 + y, z0 + z + dz, kant); }
    }
    for (let i = 0; i < klimop.length; i += 4) zet(klimop[i], klimop[i + 1], klimop[i + 2], B.klimop | (klimop[i + 3] << 8), VUL);
    // binnen: mos, spinnenwebben, soms een boekenkast, en een oude kist
    for (let z = 1; z < l - 1; z++) for (let x = 1; x < w - 1; x++) if (r() < 0.22) zet(x0 + x, y0 + 1, z0 + z, B.mos, OPGROND);
    for (const [x, z] of [[1, 1], [w - 2, 1], [1, l - 2], [w - 2, l - 2]]) if (r() < 0.3) zet(x0 + x, y0 + Math.min(H, 3), z0 + z, B.spinnenweb, VUL);
    if (!toren && r() < 0.4) zet(x0 + w - 2, y0 + 1, z0 + 1, B.boekenkast, OPGROND);
    if (r() < (toren ? 0.65 : 0.8)) {
      // tegen de achtermuur, met de voorkant naar binnen
      const kz = l - 2, kx = 1 + Math.floor(r() * (w - 2));
      zet(x0 + kx, y0 + 1, z0 + kz, kistStand(0, 0), OPGROND);
    }
    soorten.push(['ruine', mx, y0 + 1, mz, Math.max(w, l) / 2 + 4]);
  }
  function mijn(r, vakX, vakZ, zet, soorten) {
    const ox = vakX + 16 + Math.floor(r() * (GB - 32)), oz = vakZ + 16 + Math.floor(r() * (GB - 32)), oy = 16 + Math.floor(r() * 22);
    if (hKol(ox, oz) - oy < 18) return;
    // de zaal in het midden
    for (let y = oy; y <= oy + 3; y++) for (let z = -3; z <= 3; z++) for (let x = -3; x <= 3; x++) zet(ox + x, y, oz + z, 0, GRAAF);
    for (let z = -3; z <= 3; z++) for (let x = -3; x <= 3; x++) zet(ox + x, oy - 1, oz + z, B.planken_eik, VUL);
    // twee lantaarns in de hoeken, zodat je de zaal ziet als je binnenkomt
    zet(ox - 3, oy, oz - 3, B.lantaarn, OPGROND); zet(ox + 3, oy, oz + 3, B.lantaarn, OPGROND);
    const rij = []; let n = 0, totaal = 0;
    for (let rd = 0; rd < 4; rd++) if (r() < 0.8) rij.push([ox + RICHTING[rd][0] * 4, oz + RICHTING[rd][1] * 4, rd, 0]);
    let kisten = 0;
    // Versie 3: in een nieuwe mijn lopen de rails door (met bochten naar zijgangen), en soms staat er een karretje.
    // Een eigen toeval, zodat de mijn zelf er precies zo uitziet als vroeger. Mijnen bij waar je al was, blijven zoals ze waren.
    const nieuw = GEN >= 3 && !oudInBuurt(ox, oz, 64), rs = rng(hsh(zaad, ox, oz, 5151)), sporen = new Map(), koppels = [];
    while (rij.length && n < 18 && totaal < 280) {
      const [sx, sz, rd, diep, koppel] = rij.shift(); n++;
      const metSpoor = nieuw && rs() < 0.75;
      const [dx, dz] = RICHTING[rd], [px, pz] = RICHTING[(rd + 1) % 4], lengte = 8 + Math.floor(r() * 16);
      let s = 0, x = sx, z = sz;
      for (; s < lengte; s++) {
        x = sx + dx * s; z = sz + dz * s;
        if (Math.abs(x - ox) > 44 || Math.abs(z - oz) > 44 || hKol(x, z) - oy < 12) break;
        for (let w = -1; w <= 1; w++) {
          const X = x + px * w, Z = z + pz * w;
          for (let y = oy; y <= oy + 2; y++) zet(X, y, Z, 0, GRAAF);
          zet(X, oy - 1, Z, B.planken_eik, VUL); // een vloertje als de gang door een grot loopt
        }
        if (r() < 0.72 && !nieuw) zet(x, oy, z, B.mijnspoor | ((rd & 1) << 8), OPGROND);
        if (metSpoor && rs() > 0.02) sporen.set(x + ',' + z, rd);
        // stutten om de vier blokken (soms ingezakt), af en toe met een fakkel
        if (s % 4 === 2) {
          const heel = r() > 0.12;
          zet(x + px, oy, z + pz, B.hek); if (heel) zet(x + px, oy + 1, z + pz, B.hek);
          zet(x - px, oy, z - pz, B.hek); if (heel) zet(x - px, oy + 1, z - pz, B.hek);
          if (heel) { for (let w = -1; w <= 1; w++) zet(x + px * w, oy + 2, z + pz * w, B.planken_eik); if (s > 0 && r() < 0.45) zet(x - dx, oy + 2, z - dz, B.fakkel | ((((rd + 2) % 4) + 1) << 8)); }
        }
        if (r() < 0.05) zet(x + px * (r() < 0.5 ? 1 : -1), oy + 2, z + pz * (r() < 0.5 ? 1 : -1), B.spinnenweb, VUL);
      }
      totaal += s;
      if (koppel && s > 0) koppels.push(koppel);
      if (s < 4) continue;
      const ex = sx + dx * (s - 1), ez = sz + dz * (s - 1);
      // aan het eind: verder, een zijgang, of doodlopend met soms een kist
      const vertak = diep < 4 ? r() : 1;
      if (vertak < 0.4) rij.push([ex + dx, ez + dz, rd, diep + 1]);
      if (vertak < 0.75) rij.push([ex + px * 2, ez + pz * 2, (rd + 1) % 4, diep + 1, [ex, ez, ex + px, ez + pz, ex + px * 2, ez + pz * 2]]);
      if (vertak > 0.25 && vertak < 0.95) rij.push([ex - px * 2, ez - pz * 2, (rd + 3) % 4, diep + 1, [ex, ez, ex - px, ez - pz, ex - px * 2, ez - pz * 2]]);
      if (vertak >= 0.75 && kisten < 3 && r() < 0.55) {
        // een nis met een kist, de voorkant naar de gang
        for (let y = oy; y <= oy + 1; y++) zet(ex + dx, y, ez + dz, 0, GRAAF);
        zet(ex + dx, oy, ez + dz, kistStand((rd + 2) % 4, 1), OPGROND); kisten++;
      }
    }
    if (nieuw && sporen.size) {
      // zijgangen aansluiten: een stukje spoor tussen het eind van de gang en het begin van de zijgang
      for (const [ax, az, mx, mz, bx, bz] of koppels) if (sporen.has(ax + ',' + az) && sporen.has(bx + ',' + bz)) sporen.set(mx + ',' + mz, 0);
      // elke rail kijkt naar zijn buren: rechtdoor als dat kan, anders een bocht
      const stand = (x, z, rd) => {
        const om = [0, 1, 2, 3].filter(d => sporen.has((x + RICHTING[d][0]) + ',' + (z + RICHTING[d][1])));
        for (const d of om) if (om.includes((d + 2) % 4)) return d & 1;
        if (om.length >= 2) { const [a, b] = om; return 8 + (((b - a + 4) % 4) === 1 ? a : b); }
        return om.length ? om[0] & 1 : rd & 1;
      };
      const lijst = [...sporen];
      const kar = rs() < 0.55 ? lijst[Math.floor(rs() * lijst.length)][0] : null;
      for (const [k, rd] of lijst) { const [x, z] = k.split(',').map(Number); zet(x, oy, z, B.mijnspoor | ((stand(x, z, rd) | (k === kar ? 16 : 0)) << 8), OPGROND); }
    }
    soorten.push(['mijn', ox, oy, oz]);
  }
  function krater(r, vakX, vakZ, zet, soorten) {
    const R = 4.5 + r() * 3, mx = vakX + 12 + r() * (GB - 24), mz = vakZ + 12 + r() * (GB - 24);
    if (dorpBij(mx, mz, 16)) return;
    const k = kolom(mx, mz, bk), h0 = Math.floor(k.h);
    if (h0 <= ZEE + 3 || h0 > 104 || k.m > 0.2 || k.rf > 0.05 || NAT_STREEK.has(k.b) || openBoven(Math.floor(mx), Math.floor(mz), h0)) return;
    const D = R * 0.6, bodemVan = (x, z, h) => { const d = Math.hypot(x + 0.5 - mx, z + 0.5 - mz); return Math.round((h === undefined ? hKol(x, z) : h) - D * (1 - (d / R) ** 2)); };
    for (let z = Math.floor(mz - R - 2); z <= mz + R + 2; z++) for (let x = Math.floor(mx - R - 2); x <= mx + R + 2; x++) {
      const d = Math.hypot(x + 0.5 - mx, z + 0.5 - mz); if (d > R + 1.6) continue;
      const h = hKol(x, z);
      if (d < R) {
        const bodem = bodemVan(x, z, h);
        for (let y = bodem + 1; y <= h + 10; y++) zet(x, y, z, 0);
        const q = r(); zet(x, bodem, z, q < 0.45 ? B.basalt : q < 0.75 ? B.grind : q < 0.9 ? B.steen : B.graniet);
        if (d < R * 0.6) zet(x, bodem - 1, z, B.basalt);
      } else if (r() < 0.7) zet(x, h + 1, z, r() < 0.5 ? B.grind : B.aarde, VUL); // de opgeworpen rand
    }
    // in het midden de sterrensteen: een klompje van 3 tot 6, half in de bodem
    const n = 3 + Math.floor(r() * 4), bx = Math.floor(mx), bz = Math.floor(mz);
    const plekken = [[0, 0, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [1, -1, 0], [0, -1, 1]];
    for (let i = 0; i < n; i++) { const [px, py, pz] = plekken[i]; zet(bx + px, bodemVan(bx + px, bz + pz) + py, bz + pz, B.sterrensteen); }
    soorten.push(['krater', bx, bodemVan(bx, bz) + 1, bz, R + 5]);
  }

  function bouwVrij(X, Z) {
    const ga = Math.floor(X / GB), gb = Math.floor(Z / GB);
    for (let gz = gb - 1; gz <= gb + 1; gz++) for (let gx = ga - 1; gx <= ga + 1; gx++) for (const s of bouwVak(gx, gz).soorten) if (s[4] && (X + 0.5 - s[1]) ** 2 + (Z + 0.5 - s[3]) ** 2 < s[4] * s[4]) return true;
    return false;
  }
  // de bouwwerken die dit stuk raken erin zetten (na de bomen, zodat een ruïne niet vol takken zit)
  function bouwwerken(cx, cz, d, m) {
    const X0 = cx * CH, Z0 = cz * CH, sleutel = cx * 100003 + cz, ga = Math.floor(X0 / GB), gb = Math.floor(Z0 / GB);
    for (let gz = gb - 1; gz <= gb + 1; gz++) for (let gx = ga - 1; gx <= ga + 1; gx++) {
      const bv = bouwVak(gx, gz), e = bv.emmers.get(sleutel); if (!e) continue;
      const L = bv.L;
      for (let k = 0; k < e.length; k++) {
        const i = e[k], j = idx(L[i] - X0, L[i + 1], L[i + 2] - Z0), v = L[i + 3], wijze = L[i + 4], oi = d[j] & 255;
        const leeg = oi === 0 || (VERVANG[oi] && oi !== W) || (LAAG[oi] === 1 && !VAST[oi]);
        if (wijze === ZET) d[j] = v;
        else if (wijze === VUL) { if (leeg) d[j] = v; }
        else if (wijze === GRAAF) { if (oi !== W && oi !== B.bodemsteen && m[j] !== 3 && m[j] !== 4) d[j] = v; }
        else if (leeg && VAST[d[j - 256] & 255]) d[j] = v;
      }
    }
  }


  Object.assign(wm, {
    bouwVak, kistStand, ruine, mijn, krater, bouwVrij, bouwwerken,
  });
}

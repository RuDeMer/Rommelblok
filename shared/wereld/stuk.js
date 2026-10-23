// Een heel stuk wereld maken, en de startplek zoeken.
// Gedeelde code: draait op de pagina, in de rekenhulpjes en op de server (geen DOM).
import { B, BL, VERVANG, W } from '../blokken.js';
import { CH, HOOG, VOL, ZEE, idx } from '../maat.js';
import { glad } from '../ruis.js';
import { hsh, kans, rng } from '../toeval.js';
import { BI } from './biomen.js';

// wm: de werkplaats van één wereld (zaadje, ruis en wat de eerdere delen gemaakt hebben)
export function stuk(wm) {
  const {
    kolom, rasterRuis, opt, MASKER, graafGrotten, kleuren, zaad, nDiep, lees, gM, nVlek, nBloem, wildGewas, aders,
    nG3, boomgaard, BOOMKANS, boomVoor, zetBoom, bouwwerken, openBoven, bouwVrij, dorpBij,
  } = wm;

  // ---------- drempels voor grotten per hoogte (vooraf uitgerekend)
  const DREMPEL_G = new Float32Array(HOOG), DREMPEL_Z = new Float32Array(HOOG);
  for (let y = 0; y < HOOG; y++) { DREMPEL_G[y] = 0.0065 + 0.004 * glad(60, 20, y); DREMPEL_Z[y] = 0.3 + 0.16 * glad(36, 56, y) + 0.12 * glad(14, 6, y); }
  // ---------- een heel stuk maken
  const kol = new Array(18 * 18); for (let i = 0; i < kol.length; i++) kol[i] = {};
  const hoog = new Int16Array(18 * 18);
  function maakStuk(cx, cz) {
    const d = new Uint16Array(VOL), biomen = new Uint8Array(256), kleur = new Uint16Array(768), X0 = cx * CH, Z0 = cz * CH;
    // kolommen met een rand van 1, voor hellingen
    let berg = false;
    for (let z = -1; z <= CH; z++) for (let x = -1; x <= CH; x++) {
      const k = kolom(X0 + x, Z0 + z, kol[(z + 1) * 18 + x + 1]);
      hoog[(z + 1) * 18 + x + 1] = Math.floor(k.h);
      if (k.m > 0.22) berg = true;
    }
    if (berg) rasterRuis(X0, Z0, true);
    const grotten = opt.zonderGrotten ? MASKER.fill(0) : graafGrotten(cx, cz);
    for (let z = 0; z < CH; z++) for (let x = 0; x < CH; x++) {
      const ki = (z + 1) * 18 + x + 1, k = kol[ki], h = hoog[ki], X = X0 + x, Z = Z0 + z;
      const col = kleuren(k); kleur[z * 16 + x] = col[0]; kleur[256 + z * 16 + x] = col[1]; kleur[512 + z * 16 + x] = col[2];
      biomen[z * 16 + x] = k.b;
      const helling = Math.max(Math.abs(hoog[ki - 1] - hoog[ki + 1]), Math.abs(hoog[ki - 18] - hoog[ki + 18]));
      const b = k.b;
      // bodem
      const bodem = 1 + Math.floor(kans(zaad, X, Z, 5) * 3);
      const leiGrens = 14 + Math.floor(nDiep.fbm2(X / 70, Z / 70, 2) * 6);
      // vast of lucht: hoogte, met in de bergen overhangende rotsen
      const top = Math.min(HOOG - 2, h + (k.m > 0.22 ? 18 : 0));
      for (let y = 0; y <= top; y++) {
        let v = 0;
        if (y < bodem) v = B.bodemsteen;
        else {
          let dicht = y <= h;
          if (k.m > 0.22 && y > h - 22) { const dd = (h - y) / (5 + 9 * k.m) + lees(gM, x, y, z) * 1.25 * glad(0.22, 0.6, k.m); dicht = dd > 0; }
          if (dicht) v = y < leiGrens ? B.leisteen : B.steen;
        }
        d[idx(x, y, z)] = v;
      }
      // grotten (uit het masker van de grottenstelsels)
      const onderWater = h < ZEE + 2;
      // laagste buurkolom onder water: daar naast geen grot tot vlak onder de waterbodem (anders loopt de grot vol)
      let natBuur = 999; for (const o of [-1, 1, -18, 18]) { const hn = hoog[ki + o]; if (hn < ZEE) natBuur = Math.min(natBuur, hn); }
      for (let y = bodem + 2; y <= top; y++) {
        const i = idx(x, y, z), gr = grotten[i]; if (!gr || gr === 4 || !d[i]) continue;
        const diepte = h - y;
        if (onderWater && diepte < 9) continue;
        if (y > natBuur - 4) continue;
        if (gr === 3) { d[i] = W; continue; }
        if (gr === 1 && diepte < 5) continue;
        // onder het grondwater (overal even hoog) staat elke grot vol: dan lekt er nergens water weg
        d[i] = y < 12 ? W : 0;
      }
      // bovenlaag: van boven naar beneden
      let diep = -1, eerste = true, behandel = false;
      const zandig = b === BI.woestijn || b === BI.strand, koud = b === BI.sneeuwvlakte || b === BI.taiga && k.T < -0.42 || b === BI.sneeuwbergen;
      const sneeuwlijn = 92 + Math.floor(k.T * 14);
      for (let y = top; y >= bodem; y--) {
        const i = idx(x, y, z), v = d[i];
        if (v === 0 || v === W) { diep = -1; continue; }
        if (v !== B.steen && v !== B.leisteen) { diep = -1; continue; }
        diep++;
        // een nieuwe laag steen: alleen het echte oppervlak (en wat net onder een overhang ligt) krijgt aarde of zand; grotbodems blijven steen
        if (diep === 0) { const boven = y + 1 < HOOG ? d[idx(x, y + 1, z)] : 0; behandel = eerste || y >= h - 8 || boven === W; eerste = false; }
        if (!behandel || diep > 7) continue;
        const nat = y < ZEE;
        const dikte = 3 + (kans(zaad, X, Z, 11) < 0.5 ? 1 : 0);
        if (diep >= dikte + (zandig ? 3 : 0)) continue;
        let nv = v;
        if (helling >= 4 && b !== BI.woestijn) { if (diep === 0 && y > ZEE + 4 && !koud) nv = kans(zaad, X, Z, 12) < 0.15 ? B.grind : B.steen; else nv = B.steen; if (koud && diep === 0 && y > sneeuwlijn - 10) nv = B.sneeuw; }
        else if (b === BI.sneeuwbergen && y > sneeuwlijn) nv = diep < 2 ? B.sneeuw : B.steen;
        else if (b === BI.bergen && y > 92) nv = diep === 0 && kans(zaad, X, Z, 13) < 0.3 ? B.grind : B.steen;
        else if (zandig) nv = diep < 3 ? B.zand : B.zandsteen;
        else if (b === BI.oceaan || b === BI.diepe_oceaan || b === BI.bevroren_oceaan || b === BI.rivier || (nat && diep < 3)) {
          const s = nVlek.r2(X / 18, Z / 18);
          nv = b === BI.diepe_oceaan ? (s > 0.2 ? B.zand : B.grind) : b === BI.moeras ? (diep === 0 ? B.modder : B.veen) : s > 0.45 ? B.klei : s < -0.45 ? B.grind : B.zand;
          if (diep >= 3) nv = B.steen;
        } else if (diep === 0) {
          if (nat) nv = B.aarde;
          else if (koud) nv = B.sneeuwgras;
          else if (b === BI.taiga && nVlek.r2(X / 12, Z / 12) > 0.15) nv = B.bosgrond;
          else if (b === BI.moeras && nVlek.r2(X / 7, Z / 7) > 0.3) nv = B.modder;
          else nv = B.gras;
        } else nv = b === BI.moeras && diep <= 3 && nVlek.r2(X / 11, Z / 11) > -0.2 ? B.veen : B.aarde;
        d[i] = nv;
      }
      // water tot zeeniveau, met ijs in de kou
      for (let y = h + 1; y <= ZEE; y++) { const i = idx(x, y, z); if (!d[i]) d[i] = (y === ZEE && (b === BI.bevroren_oceaan || (koud && k.T < -0.5))) ? B.ijs : W; }
      // planten
      const hb = h + 1;
      if (hb < HOOG - 2 && hb > 1) {
        const onder = d[idx(x, h, z)], i = idx(x, hb, z);
        if (!d[i]) {
          const r1 = kans(zaad, X, Z, 21), r2 = kans(zaad, X, Z, 22);
          let p = 0;
          if (onder === B.gras || onder === B.bosgrond) {
            if (b === BI.tulpenveld) { const rij = Math.floor((Z + Math.floor(nVlek.r2(X / 60, 0) * 6)) / 3); p = r1 < 0.85 ? [B.tulp_rood, B.tulp_geel, B.tulp_oranje, B.tulp_roze][((rij % 4) + 4) % 4] : r1 < 0.9 ? B.hooggras : 0; }
            else if (b === BI.heide) p = r1 < 0.45 ? B.heide : r1 < 0.6 ? B.hooggras : r1 < 0.62 ? B.lavendel : 0;
            else if (b === BI.vlakte) p = r1 < 0.32 ? B.hooggras : r1 < 0.37 ? [B.paardenbloem, B.korenbloem, B.vlas, B.tulp_rood, B.klaproos, B.madelief, B.madelief, B.zonnebloem][Math.floor(r2 * 8)] : (nBloem.r2(X / 30, Z / 30) > 0.5 && r1 < 0.55) ? B.vlas : r1 > 0.9975 ? wildGewas(r2) : 0;
            else if (b === BI.bos || b === BI.berkenbos) p = r1 < 0.2 ? B.hooggras : r1 < 0.26 ? B.varen : r1 < 0.28 ? [B.paardenbloem, B.korenbloem, B.paddenstoel_bruin, B.vergeetmenietje][Math.floor(r2 * 4)] : r1 < 0.29 ? B.mos : r1 > 0.998 ? wildGewas(r2) : 0;
            else if (b === BI.herfstbos) p = r1 < 0.14 ? B.hooggras : r1 < 0.2 ? B.varen : r1 < 0.225 ? (r2 < 0.5 ? B.paddenstoel_rood : B.paddenstoel_bruin) : 0;
            else if (b === BI.taiga) p = r1 < 0.12 ? B.varen : r1 < 0.2 ? B.hooggras : r1 < 0.215 ? B.bessenstruik | (1 << 8) : 0;
            else if (b === BI.savanne) p = r1 < 0.45 ? B.hooggras : r1 < 0.47 ? B.dorre_struik : r1 < 0.475 ? B.zonnebloem : 0;
            else if (b === BI.moeras) p = r1 < 0.25 ? B.hooggras : r1 < 0.3 ? B.paddenstoel_bruin : r1 < 0.34 ? B.mos : 0;
            else if (b === BI.bergen || b === BI.sneeuwbergen) p = r1 < 0.12 ? B.hooggras : 0;
            else p = r1 < 0.12 ? B.hooggras : 0;
          } else if (onder === B.zand && b === BI.woestijn) p = r1 < 0.012 ? B.dorre_struik : 0;
          if (p) d[i] = p;
          // riet langs het water
          if (!p && (onder === B.gras || onder === B.zand || onder === B.modder) && r1 > 0.9 && h === ZEE && (b !== BI.woestijn)) {
            const n = 1 + Math.floor(r2 * 3); for (let j = 0; j < n; j++) d[idx(x, hb + j, z)] = B.riet;
          }
        }
        // waterlelies in het moeras
        if (b === BI.moeras && h < ZEE && d[idx(x, ZEE, z)] === W && kans(zaad, X, Z, 23) < 0.09 && !d[idx(x, ZEE + 1, z)]) d[idx(x, ZEE + 1, z)] = B.waterlelie;
      }
    }
    aders(cx, cz, d);
    // druipsteen en gloeizwammen in grotten
    for (let y = 6; y < 72; y++) for (let z = 0; z < CH; z++) for (let x = 0; x < CH; x++) {
      const i = idx(x, y, z); if (d[i]) continue;
      const X = X0 + x, Z = Z0 + z, h = hoog[(z + 1) * 18 + x + 1];
      if (y > h - 6) continue;
      const bo = d[i + 256], on = d[i - 256];
      if ((bo === B.steen || bo === B.leisteen) && kans(zaad, X, y, Z) < 0.035) d[i] = B.druipsteen_hang;
      else if ((on === B.steen || on === B.leisteen)) { const r = kans(zaad, Z, y, X); if (r < 0.02) d[i] = B.druipsteen_staand; else if (y < 44 && r < 0.035 && nG3.r2(X / 20, Z / 20) > 0.25) d[i] = B.gloeizwam; }
    }
    // bomen uit dit stuk en de buren, in een vaste volgorde
    const lijst = [];
    for (let bz = -1; bz <= 1; bz++) for (let bx = -1; bx <= 1; bx++) {
      const ax = cx + bx, az = cz + bz;
      for (let gz = 0; gz < 4; gz++) for (let gx = 0; gx < 4; gx++) {
        const r = rng(hsh(zaad, ax * 4 + gx, az * 4 + gz, 77));
        const tx = ax * CH + gx * 4 + Math.floor(r() * 4), tz = az * CH + gz * 4 + Math.floor(r() * 4);
        let k, h;
        const lx = tx - X0, lz = tz - Z0;
        if (lx >= -1 && lz >= -1 && lx <= CH && lz <= CH) { k = kol[(lz + 1) * 18 + lx + 1]; h = hoog[(lz + 1) * 18 + lx + 1]; }
        else { k = kolom(tx, tz, {}); h = Math.floor(k.h); }
        // alleen wat elk stuk op dezelfde manier uitrekent: de kolom zelf, nooit de blokken van een buurstuk
        if (!boomMag(k, h, tx, tz)) continue;
        const kansB = (k.b === BI.vlakte || k.b === BI.tulpenveld) && boomgaard(tx, tz) ? 0.22 : BOOMKANS[k.b] || 0; if (r() > kansB) continue;
        const soort = boomVoor(k.b, tx, tz, r); if (!soort) continue;
        lijst.push([tx, h + 1, tz, soort, hsh(zaad, tx, tz, 78)]);
      }
    }
    // elke buur ziet de bomen in dezelfde volgorde, dan maakt het niet uit welk stuk de overlap tekent
    lijst.sort((a, b) => a[2] - b[2] || a[0] - b[0]);
    const zet = (x, y, z, v, voorrang) => {
      const lx = x - X0, lz = z - Z0; if (lx < 0 || lz < 0 || lx >= CH || lz >= CH || y < 1 || y >= HOOG) return;
      const i = idx(lx, y, lz), oud = d[i], oi = oud & 255;
      if (voorrang === 2) { if (oi === 0 || oi === W || BL[oi].laag === 1 || VERVANG[oi] || oi === B.gras || oi === B.aarde || oi === B.zand) d[i] = v; }
      else if (oi === 0 || (VERVANG[oi] && oi !== W) || oi === B.hooggras) d[i] = v;
    };
    for (const [tx, ty, tz, soort, s] of lijst) {
      const lx = tx - X0, lz = tz - Z0;
      const r = rng(s);
      zetBoom(soort, tx, ty, tz, r, zet);
      // onder de boom wordt gras aarde
      if (lx >= 0 && lz >= 0 && lx < CH && lz < CH && soort !== 'cactus' && soort !== 'rots') { const i = idx(lx, ty - 1, lz); if ((d[i] & 255) === B.gras) d[i] = B.aarde; }
    }
    if (!opt.zonderBouwwerken) bouwwerken(cx, cz, d, grotten);
    return { d, biomen, kleur };
  }
  // mag hier een boom staan? Alleen de kolom telt (hoogte, streek, geen overhang, geen grotingang, geen rivier),
  // zodat elk stuk dat de boom raakt precies hetzelfde besluit.
  function boomMag(k, h, X, Z) {
    if (h <= ZEE && !(k.b === BI.moeras && h >= ZEE - 2)) return false;
    if (k.m >= 0.2 || h > 108 || k.rf > 0.15) return false;
    if (k.b === BI.sneeuwbergen && h > 100) return false;
    if (k.b === BI.strand || k.b === BI.oceaan || k.b === BI.diepe_oceaan || k.b === BI.rivier || k.b === BI.bevroren_oceaan) return false;
    if (openBoven(X, Z, h)) return false;
    if (!opt.zonderBouwwerken && bouwVrij(X, Z)) return false;
    return true;
  }
  function startPlek() {
    // liefst een open landschap (vlakte, tulpen, heide, savanne) dichtbij het midden; anders gewoon land
    const OPEN = new Set([BI.vlakte, BI.tulpenveld, BI.heide, BI.savanne]);
    let reserve = null;
    for (let r = 0; r < 3000; r += 16) for (let a = 0; a < Math.max(1, r / 8); a++) {
      const t = (a / Math.max(1, r / 8)) * Math.PI * 2, x = Math.round(Math.cos(t) * r), z = Math.round(Math.sin(t) * r);
      const k = kolom(x, z, {}); const h = Math.floor(k.h);
      // op land, en niet op een eilandje: rondom (op 40 en 80 blokken) moet ook vooral land zijn
      const rondLand = () => { let n = 0; for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, d = i & 1 ? 80 : 40; if (kolom(Math.round(x + Math.cos(a) * d), Math.round(z + Math.sin(a) * d), {}).h >= ZEE) n++; } return n >= 13; };
      if (h > ZEE + 1 && h < 92 && k.m < 0.2 && k.b !== BI.strand && k.b !== BI.moeras && k.rf < 0.1 && rondLand() && !dorpBij(x, z, 6)) {
        const p = { x: x + 0.5, y: h + 1.05, z: z + 0.5, b: k.b };
        if (OPEN.has(k.b) || r > 700) return OPEN.has(k.b) ? p : (reserve || p);
        if (!reserve) reserve = p;
      }
    }
    return reserve || { x: 0.5, y: 90, z: 0.5, b: 0 };
  }

  Object.assign(wm, {
    DREMPEL_G, DREMPEL_Z, kol, hoog, maakStuk, boomMag, startPlek,
  });
}

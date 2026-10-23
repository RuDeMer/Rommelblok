// Dorpjes: plein, straten, gebouwen en akkers.
// Gedeelde code: draait op de pagina, in de rekenhulpjes en op de server (geen DOM).
import { B, W } from '../blokken.js';
import { ZEE } from '../maat.js';
import { hsh, rng } from '../toeval.js';
import { RICHTING } from '../vormen.js';
import { BI } from './biomen.js';

// wm: de werkplaats van één wereld (zaadje, ruis en wat de eerdere delen gemaakt hebben)
export function dorpen(wm) {
  const {
    kolom, NAT_STREEK, oudInBuurt, openBoven, GEN, zaad, GB, hKol, VUL,
  } = wm;

  // ============================================================================
  // Dorpjes (vanaf versie 3). Per gebied van 4 x 4 vakken (256 x 256 blokken) hooguit één, op een vlak stuk land,
  // ver van stukken die er al waren (oude werelden blijven waar je geweest bent zoals ze waren).
  // Een plein met een put en marktkraampjes, straten van klinkers die de grond volgen (met halve treden waar het
  // oploopt), huizen met de deur naar de straat, een bakkerij, smederij of bibliotheek, akkers met een sloot, en lantaarns.
  // Drie bouwstijlen: vakwerk met mergel (gematigd), blokhutten (koud) en lemen huisjes (warm).
  // Net als bij de andere bouwwerken komt alles alleen uit de kolommen (hoogte en streek): dus geen naden.
  // ============================================================================
  const DG = 4, DORP_KANS = 0.8, DORP_R = 40, dorpen = new Map();
  const KOUD = new Set([BI.taiga, BI.sneeuwvlakte, BI.sneeuwbergen, BI.bergen]), WARM = new Set([BI.woestijn, BI.savanne]);
  function dorpPlek(x, z) {
    const k = kolom(x, z, {}), h0 = Math.floor(k.h);
    if (h0 <= ZEE + 2 || h0 > 96 || k.m > 0.15 || k.rf > 0.01 || k.moe > 0.3 || NAT_STREEK.has(k.b) || k.b === BI.moeras) return null;
    if (oudInBuurt(x, z, DORP_R + 32)) return null;
    // vlak genoeg: de meeste punten rondom liggen niet ver van het midden, en er is geen water of rivier dichtbij
    let goed = 0, n = 0;
    for (let dz = -30; dz <= 30; dz += 7.5) for (let dx = -30; dx <= 30; dx += 7.5) {
      const q = kolom(Math.round(x + dx), Math.round(z + dz), {}), h = Math.floor(q.h), d = Math.hypot(dx, dz); n++;
      if (d <= 24 && (h <= ZEE || q.rf > 0.05)) return null;
      if (Math.abs(h - h0) <= 4) goed++;
    }
    if (goed < n * 0.72 || openBoven(x, z, h0)) return null;
    return { x, z, h: h0, b: k.b };
  }
  function dorpVan(rx, rz) {
    const sleutel = rx * 100003 + rz; if (dorpen.has(sleutel)) return dorpen.get(sleutel);
    if (dorpen.size > 300) dorpen.clear();
    let uit = null;
    if (GEN >= 3) {
      const r = rng(hsh(zaad, rx, rz, 9301));
      if (r() < DORP_KANS) for (let p = 0; p < 4 && !uit; p++) {
        const x = rx * GB * DG + 56 + Math.floor(r() * (GB * DG - 112)), z = rz * GB * DG + 56 + Math.floor(r() * (GB * DG - 112));
        uit = dorpPlek(x, z);
      }
    }
    dorpen.set(sleutel, uit); return uit;
  }
  // ligt er een dorpje binnen marge blokken van (x, z)? (voor ruïnes, kraters en de startplek)
  function dorpBij(x, z, marge) {
    if (GEN < 3) return null;
    const rx = Math.floor(x / (GB * DG)), rz = Math.floor(z / (GB * DG));
    for (let b = rz - 1; b <= rz + 1; b++) for (let a = rx - 1; a <= rx + 1; a++) { const d = dorpVan(a, b); if (d && Math.hypot(x - d.x, z - d.z) < DORP_R + marge) return d; }
    return null;
  }
  const STIJLEN = {
    // vakwerk: een plint van mergel, wit pleisterwerk met eiken balken, een rood pannendak en een puntgevel aan de straat
    mergel: { onder: B.mergelblokken, plint: B.mergelblokken, vul: B.pleister, balk: B.stam_eik, vloer: B.planken_eik, dak: B.trap_dakpannen, nok: B.plaat_dakpannen, gevel: B.pleister, pad: B.klinkers, trede: B.plaat_baksteen, rand: B.steenstenen },
    // blokhut: liggende sparrenstammen op een voet van keien, een houten dak en een schoorsteen
    blokhut: { onder: B.kei, plint: B.kei, vul: B.stam_spar, balk: B.stam_spar, vloer: B.planken_spar, dak: B.trap_hout, nok: B.plaat_hout, gevel: B.planken_spar, pad: B.grind, trede: B.plaat_kei, rand: B.kei },
    // leem: zandsteen met geel pleisterwerk, een plat dak met een randje en een gekleurde luifel boven de deur
    leem: { onder: B.zandsteen, plint: B.zandsteen, vul: B.pleister | (1 << 8), balk: B.zandsteen, vloer: B.planken_baobab, dak: 0, nok: B.plaat_zandsteen, gevel: B.zandsteen, pad: B.zandsteen, trede: B.plaat_zandsteen, rand: B.zandsteen },
  };
  function dorp(r, D, zetEcht, soorten) {
    // eerst alles verzamelen: lukt het niet om minstens drie gebouwen neer te zetten, dan komt er geen dorpje
    const buf = [], zet = (x, y, z, v, m) => { buf.push(x, y, z, v, m || 0); };
    const cx = D.x, cz = D.z, h0 = D.h, stijl = KOUD.has(D.b) ? 'blokhut' : WARM.has(D.b) ? 'leem' : 'mergel', S = STIJLEN[stijl];
    const bezet = new Set(), ks = (x, z) => x + ',' + z, gebouwen = [], akkers = [], deurPad = new Set();
    let R = 8;
    const tel = (x, z) => { const d = Math.hypot(x - cx, z - cz) + 2; if (d > R) R = d; };
    // stevig maken onder (x, y, z): opvullen tot de grond
    const fundeer = (x, z, y, v) => { const h = hKol(x, z); for (let yy = Math.max(h + 1, y - 6); yy < y; yy++) zet(x, yy, z, v, VUL); };
    // ---------------- het plein (9 x 9) met de put in het midden
    for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx, z = cz + dz; bezet.add(ks(x, z));
      fundeer(x, z, h0, B.aarde); zet(x, h0, z, S.pad); for (let y = h0 + 1; y <= h0 + 6; y++) zet(x, y, z, 0);
    }
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const x = cx + dx, z = cz + dz;
      if (dx || dz) { for (let y = h0 - 3; y <= h0 + 1; y++) zet(x, y, z, S.rand); }
      else { zet(x, h0 - 3, z, S.rand); for (let y = h0 - 2; y <= h0; y++) zet(x, y, z, W); }
      if (dx && dz) { zet(x, h0 + 2, z, B.hek); zet(x, h0 + 3, z, B.hek); }
      zet(x, h0 + 4, z, B.plaat_hout);
    }
    zet(cx, h0 + 3, cz, B.lantaarn | (1 << 8));
    // marktkraampjes op een paar hoeken van het plein, met waar op tafel; op de andere hoeken een lantaarn of bloemen
    const LUIFEL = [B.linnen_rood, B.linnen_geel, B.linnen_blauw, B.linnen_groen, B.linnen_oranje], WAAR = [B.pompoen, B.vlaai, B.hooi, B.bloempot | (1 << 8), B.kersenvlaai, B.appelvlaai];
    const hoeken = [[1, 1], [-1, 1], [-1, -1], [1, -1]], kramen = 1 + Math.floor(r() * 2);
    hoeken.forEach(([sx, sz], i) => {
      const x3 = cx + 3 * sx, z3 = cz + 3 * sz, x2 = cx + 2 * sx, z2 = cz + 2 * sz;
      if (i < kramen) {
        const luifel = LUIFEL[Math.floor(r() * LUIFEL.length)];
        zet(x2, h0 + 1, z3, B.tafel); zet(x3, h0 + 1, z2, B.tafel);
        zet(x2, h0 + 2, z3, WAAR[Math.floor(r() * WAAR.length)]); zet(x3, h0 + 2, z2, WAAR[Math.floor(r() * WAAR.length)]);
        zet(x3, h0 + 1, z3, B.hek); zet(x3, h0 + 2, z3, B.hek);
        for (const [a, b] of [[x2, z2], [x3, z2], [x2, z3], [x3, z3]]) zet(a, h0 + 3, b, luifel);
      } else {
        zet(cx + 4 * sx, h0 + 1, cz + 4 * sz, B.hek); zet(cx + 4 * sx, h0 + 2, cz + 4 * sz, B.lantaarn);
        zet(x3, h0 + 1, z3, B.bloempot | ((1 + Math.floor(r() * 11)) << 8));
      }
    });
    // ---------------- straten: 2 tot 4 armen vanaf het plein, die de grond volgen
    const richtingen = [0, 1, 2, 3]; for (let i = 3; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [richtingen[i], richtingen[j]] = [richtingen[j], richtingen[i]]; }
    const armen = [];
    for (const d of richtingen.slice(0, 2 + Math.floor(r() * 3))) {
      const [fx, fz] = RICHTING[d], [px, pz] = RICHTING[(d + 1) % 4], lengte = 16 + Math.floor(r() * 12), hoogte = [];
      let y = h0, t = 5;
      for (; t < 5 + lengte; t++) {
        const x = cx + fx * t, z = cz + fz * t, doel = Math.round((hKol(x, z) + hKol(x + px, z + pz) + hKol(x - px, z - pz)) / 3);
        if (Math.abs(doel - y) > 2 || hKol(x, z) <= ZEE) break;
        const ny = Math.max(y - 1, Math.min(y + 1, doel));
        hoogte.push(ny); y = ny;
      }
      if (hoogte.length < 8) continue;
      armen.push({ d, fx, fz, px, pz, hoogte });
      for (let i = 0; i < hoogte.length; i++) {
        const t = 5 + i, y = hoogte[i];
        for (let o = -1; o <= 1; o++) {
          const x = cx + fx * t + px * o, z = cz + fz * t + pz * o; bezet.add(ks(x, z)); tel(x, z);
          fundeer(x, z, y, B.aarde); zet(x, y, z, S.pad); for (let yy = y + 1; yy <= y + 4; yy++) zet(x, yy, z, 0);
          // een halve trede waar de straat een blok omhoog of omlaag gaat
          const vorig = i ? hoogte[i - 1] : h0, volgend = i + 1 < hoogte.length ? hoogte[i + 1] : y;
          if (volgend === y + 1 || vorig === y + 1) zet(x, y + 1, z, S.trede);
        }
      }
    }
    // ---------------- welke gebouwen: werkplaatsen dicht bij het plein, dan huizen, de akkers het verst
    const werk = ['bakkerij', 'smederij', 'bibliotheek']; for (let i = 2; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [werk[i], werk[j]] = [werk[j], werk[i]]; }
    const plan = werk.slice(0, 1 + Math.floor(r() * 3));
    const nHuis = 2 + Math.floor(r() * 4); for (let i = 0; i < nHuis; i++) plan.push(r() < 0.35 ? 'groot' : 'huis');
    const nAkker = 1 + Math.floor(r() * 3); for (let i = 0; i < nAkker; i++) plan.push('akker');
    const MAAT = { huis: [5, 5 + Math.floor(r() * 2)], groot: [7, 6], bakkerij: [7, 6], smederij: [7, 6], bibliotheek: [7, 7], akker: [9, 7] };
    // plekken langs de straten: om en om links en rechts, van het plein naar buiten
    const plekken = [];
    for (const a of armen) for (const kant of [1, -1]) plekken.push({ a, kant, t: 5 + Math.floor(r() * 2) });
    let poging = 0;
    for (const soort of plan) {
      let gelukt = false;
      for (let tries = 0; tries < plekken.length * 2 && !gelukt; tries++) {
        const p = plekken[(poging++) % plekken.length], [w, l] = MAAT[soort], { a, kant } = p;
        const t0 = p.t, t1 = t0 + w - 1; if (t1 - 5 >= a.hoogte.length) continue;
        p.t = t1 + 3;
        const tm = t0 + (w >> 1), Y = a.hoogte[tm - 5];
        // de hoeken van het grondplan, en of de grond er past
        const cel = (t, o) => [cx + a.fx * t + a.px * o * kant, cz + a.fz * t + a.pz * o * kant];
        let past = true;
        for (let t = t0 - 1; t <= t1 + 1 && past; t++) for (let o = 2; o <= 3 + l; o++) {
          const [x, z] = cel(t, o); if (bezet.has(ks(x, z))) { past = false; break; }
          if (o >= 3 && o < 3 + l && t >= t0 && t <= t1) { const h = hKol(x, z); if (h < Y - 3 || h > Y + 3 || h <= ZEE || Math.hypot(x - cx, z - cz) > DORP_R - 2) { past = false; break; } }
        }
        if (!past) continue;
        for (let t = t0 - 1; t <= t1 + 1; t++) for (let o = 2; o <= 3 + l; o++) { const [x, z] = cel(t, o); bezet.add(ks(x, z)); }
        // het assenstelsel van het gebouw: f is de kant waar de voorkant heen kijkt (naar de straat)
        const f = RICHTING.findIndex(([x, z]) => x === -a.px * kant && z === -a.pz * kant), rr = (f + 1) % 4;
        const A = cel(t0, 3), Bc = cel(t1, 3), [rx, rz] = RICHTING[rr];
        const o0 = A[0] * rx + A[1] * rz < Bc[0] * rx + Bc[1] * rz ? A : Bc;
        if (soort === 'akker') akker(o0[0], o0[1], Y, w, l, f, r, zet, akkers);
        else gebouw(soort, o0[0], o0[1], Y, w, l, f, r, zet, S, stijl, gebouwen, fundeer);
        for (let t = t0; t <= t1; t++) for (let o = 3; o < 3 + l; o++) { const [x, z] = cel(t, o); tel(x, z); }
        // een paadje van de straat naar de deur
        if (soort !== 'akker') { const [x, z] = cel(tm, 2); fundeer(x, z, Y, B.aarde); zet(x, Y, z, S.pad); zet(x, Y + 1, z, 0); zet(x, Y + 2, z, 0); deurPad.add(ks(x, z)); }
        gelukt = true;
      }
    }
    // ---------------- lantaarns langs de straten (niet voor een deur)
    for (const a of armen) for (let i = 2; i < a.hoogte.length; i += 7) {
      const kant = (i / 7) & 1 ? 1 : -1, t = 5 + i, x = cx + a.fx * t + a.px * 2 * kant, z = cz + a.fz * t + a.pz * 2 * kant, y = a.hoogte[i];
      if (deurPad.has(ks(x, z))) continue;
      if (Math.abs(hKol(x, z) - y) > 2) continue;
      fundeer(x, z, y, B.aarde); zet(x, y, z, S.rand); zet(x, y + 1, z, B.hek); zet(x, y + 2, z, B.lantaarn);
    }
    const info = { id: cx + ',' + cz, stijl, put: [cx, h0 + 1, cz], plein: [cx - 4, cz - 4, cx + 4, cz + 4], gebouwen, akkers, straten: armen.map(a => [a.d, a.hoogte.length]) };
    if (gebouwen.length < 3) return;
    for (let i = 0; i < buf.length; i += 5) zetEcht(buf[i], buf[i + 1], buf[i + 2], buf[i + 3], buf[i + 4]);
    soorten.push(['dorp', cx, h0 + 1, cz, Math.ceil(R) + 5, info]);
  }
  // een gebouw: u van links naar rechts (zoals je naar buiten kijkt), v van voor (de straat) naar achter, y vanaf de vloer Y.
  // (ox, oz) is het blok linksvoor. f: de richting waar de voorkant naar wijst.
  function gebouw(soort, ox, oz, Y, w, l, f, r, zet, S, stijl, gebouwen, fundeer) {
    const [fx, fz] = RICHTING[f], [rx, rz] = RICHTING[(f + 1) % 4];
    const P = (u, v) => [ox + u * rx - v * fx, oz + u * rz - v * fz];
    const Z = (u, y, v, b, m) => { const [x, z] = P(u, v); zet(x, Y + y, z, b, m); };
    const VOOR = f, ACHTER = (f + 2) % 4, RECHTS = (f + 1) % 4, LINKS = (f + 3) % 4;
    const asLangs = dir => (RICHTING[dir][0] ? 1 : 2); // een liggende stam langs deze richting
    const stamLangs = (b, dir) => b | (asLangs(dir) << 8);
    // grond: opvullen en ruimte maken (ook voor het dak)
    for (let v = -1; v <= l; v++) for (let u = -1; u <= w; u++) {
      const [x, z] = P(u, v), h = hKol(x, z), binnen = u >= 0 && v >= 0 && u < w && v < l;
      if (binnen) { fundeer(x, z, Y, S.onder); Z(u, 0, v, (u === 0 || v === 0 || u === w - 1 || v === l - 1) ? S.onder : S.vloer); }
      const top = binnen ? Y + 11 : Math.max(Y + 1, Math.min(Y + 11, h + 2));
      for (let y = Y + 1; y <= top; y++) zet(x, y, z, 0);
    }
    // muren
    const deurU = w >> 1, plat = stijl === 'leem';
    for (let v = 0; v < l; v++) for (let u = 0; u < w; u++) {
      const rand = u === 0 || v === 0 || u === w - 1 || v === l - 1; if (!rand) continue;
      const hoek = (u === 0 || u === w - 1) && (v === 0 || v === l - 1), langs = v === 0 || v === l - 1 ? RECHTS : VOOR;
      for (let y = 1; y <= 3; y++) {
        let b;
        if (hoek) b = S.balk;
        else if (stijl === 'blokhut') b = stamLangs(S.balk, langs);
        else if (stijl === 'mergel') b = y === 1 ? S.plint : y === 3 ? stamLangs(S.balk, langs) : S.vul;
        else b = y === 1 ? S.plint : S.vul;
        // ramen: op ooghoogte, om en om, niet bij de deur
        const zij = v === 0 || v === l - 1 ? u : v, lang = v === 0 || v === l - 1 ? w : l;
        if (!hoek && y === 2 && zij % 2 === 1 && zij !== lang - 1 && !(v === 0 && Math.abs(u - deurU) <= 1)) b = B.glas;
        Z(u, y, v, b);
      }
    }
    // de deur (onderste en bovenste helft), met de deur naar binnen gedraaid
    Z(deurU, 1, 0, B.deur | (ACHTER << 8)); Z(deurU, 2, 0, B.deur | ((ACHTER | 8) << 8));
    // het dak
    if (plat) {
      for (let v = 0; v < l; v++) for (let u = 0; u < w; u++) { Z(u, 4, v, S.onder); if (u === 0 || v === 0 || u === w - 1 || v === l - 1) Z(u, 5, v, (u === 0 || u === w - 1) && (v === 0 || v === l - 1) ? S.onder : S.nok); }
      const luifel = [B.linnen_rood, B.linnen_blauw, B.linnen_groen, B.linnen_oranje][Math.floor(r() * 4)];
      for (let u = deurU - 1; u <= deurU + 1; u++) Z(u, 3, -1, luifel);
    } else {
      for (let k = 0; ; k++) {
        const uL = -1 + k, uR = w - k; if (uL > uR) break;
        for (let v = -1; v <= l; v++) {
          if (uL === uR) { Z(uL, 4 + k, v, S.nok); continue; }
          Z(uL, 4 + k, v, S.dak | (RECHTS << 8)); Z(uR, 4 + k, v, S.dak | (LINKS << 8));
          if (v === 0 || v === l - 1) for (let u = uL + 1; u < uR; u++) Z(u, 4 + k, v, stijl === 'mergel' && u === deurU ? S.balk : k === 1 && Math.abs(u - deurU) === 1 && stijl !== 'blokhut' ? B.glas : S.gevel);
        }
      }
      if (stijl === 'blokhut') { const [x, z] = P(w - 1, l); fundeer(x, z, Y, B.kei); for (let y = 0; y <= 4 + (w >> 1) + 1; y++) Z(w - 1, y, l, B.kei); } // de schoorsteen achter
    }
    // binnen: licht, een bed, en wat er bij het gebouw hoort
    const bedden = [], g = { soort, bedden };
    const bed = (u, v) => { Z(u, 1, v, B.bed | (ACHTER << 8)); Z(u, 1, v + 1, B.bed | ((ACHTER | 4) << 8)); const [x, z] = P(u, v); bedden.push([x, Y + 1, z]); };
    const Pw = (u, v) => { const [x, z] = P(u, v); return [x, Y + 1, z]; };
    const kist = (u, v, kijk) => Z(u, 1, v, B.kist | (kijk << 8));
    if (soort === 'huis') {
      bed(1, l - 3); kist(w - 2, l - 2, VOOR); Z(w - 2, 1, 1, B.tafel); Z(w - 2, 2, 1, B.lantaarn);
      if (l >= 6) bed(w - 2, l - 4);
      g.werk = Pw(deurU, 1);
    } else if (soort === 'groot') {
      bed(1, l - 3); bed(w - 2, l - 3); kist(deurU, l - 2, VOOR);
      Z(1, 1, 1, B.tafel); Z(1, 2, 1, B.lantaarn); Z(2, 1, 1, B.stoel | (LINKS << 8)); Z(w - 2, 1, 1, B.bloempot | ((1 + Math.floor(r() * 11)) << 8));
      g.werk = Pw(deurU, 2);
    } else if (soort === 'bakkerij') {
      for (let u = 1; u < w - 1; u++) for (let y = 1; y <= 3; y++) Z(u, y, l - 1, B.tegel_delfts);
      Z(2, 1, l - 2, B.oven | (VOOR << 8)); Z(4, 1, l - 2, B.oven | (VOOR << 8)); Z(3, 1, l - 2, B.tafel); Z(3, 2, l - 2, B.lantaarn);
      Z(1, 1, 1, B.tafel); Z(1, 2, 1, B.vlaai); Z(1, 1, 2, B.tafel); Z(1, 2, 2, r() < 0.5 ? B.kersenvlaai : B.appelvlaai);
      bed(w - 2, 1); kist(w - 2, l - 2, LINKS);
      g.werk = Pw(3, l - 3); g.kijk = Pw(2, l - 2);
    } else if (soort === 'smederij') {
      Z(2, 1, l - 2, B.smidse | (VOOR << 8)); Z(4, 1, l - 2, B.oven | (VOOR << 8)); kist(5, l - 2, VOOR); Z(1, 1, l - 2, B.kolenblok); Z(1, 2, l - 2, B.lantaarn);
      bed(w - 2, 1); Z(1, 1, 1, B.werkbank | (RECHTS << 8));
      g.werk = Pw(2, l - 3); g.kijk = Pw(2, l - 2);
    } else if (soort === 'bibliotheek') {
      for (let u = 1; u < w - 1; u++) for (let y = 1; y <= 2; y++) Z(u, y, l - 2, B.boekenkast);
      for (let v = 2; v < l - 2; v++) Z(1, 1, v, B.boekenkast);
      Z(4, 1, 2, B.tafel); Z(4, 2, 2, B.kaars); Z(4, 1, 1, B.stoel | (ACHTER << 8)); Z(2, 1, 3, B.tafel); Z(2, 2, 3, B.lantaarn);
      bed(w - 2, 3);
      g.werk = Pw(3, l - 3); g.kijk = Pw(3, l - 2);
    }
    const [dx, dz] = P(deurU, 0), [bx, bz] = P(deurU, -1), [ix, iz] = P(deurU, 1);
    g.deur = [dx, Y + 1, dz]; g.buiten = [bx, Y + 1, bz]; g.binnen = [ix, Y + 1, iz]; g.vloer = Y;
    gebouwen.push(g);
  }
  // een akker: een rand van liggende stammen, rijen gewassen en een sloot in het midden (zodat alles nat is)
  function akker(ox, oz, Y, w, l, f, r, zet, akkers) {
    const [fx, fz] = RICHTING[f], [rx, rz] = RICHTING[(f + 1) % 4];
    const P = (u, v) => [ox + u * rx - v * fx, oz + u * rz - v * fz];
    const GEWAS = [B.gewas_tarwe, B.gewas_aardappel, B.gewas_wortel, B.gewas_biet], links = GEWAS[Math.floor(r() * 4)], rechts = GEWAS[Math.floor(r() * 4)];
    const sloot = l >> 1;
    for (let v = 0; v < l; v++) for (let u = 0; u < w; u++) {
      const [x, z] = P(u, v), h = hKol(x, z);
      for (let y = Math.max(h + 1, Y - 6); y < Y; y++) zet(x, y, z, B.aarde, VUL);
      for (let y = Y + 1; y <= Math.max(Y + 2, h + 2); y++) zet(x, y, z, 0);
      const rand = u === 0 || v === 0 || u === w - 1 || v === l - 1;
      if (rand) { zet(x, Y, z, B.stam_eik | ((v === 0 || v === l - 1 ? (RICHTING[(f + 1) % 4][0] ? 1 : 2) : (RICHTING[f][0] ? 1 : 2)) << 8)); continue; }
      if (v === sloot) { zet(x, Y - 1, z, B.klei); zet(x, Y, z, W); continue; }
      zet(x, Y - 1, z, B.aarde); zet(x, Y, z, B.akker);
      zet(x, Y + 1, z, (v < sloot ? links : rechts) | (Math.floor(r() * 4) << 8));
    }
    const [ax, az] = P(0, 0), [bx, bz] = P(w - 1, l - 1), [mx, mz] = P(w >> 1, -1);
    akkers.push({ min: [Math.min(ax, bx), Math.min(az, bz)], max: [Math.max(ax, bx), Math.max(az, bz)], y: Y, rand: [mx, Y + 1, mz] });
  }
  // geen bomen op of vlak naast een ruïne of krater (alleen de kolom telt, net als bij boomMag)

  Object.assign(wm, {
    DG, DORP_KANS, DORP_R, dorpen, KOUD, WARM, dorpPlek, dorpVan, dorpBij, STIJLEN, dorp, gebouw, akker,
  });
}

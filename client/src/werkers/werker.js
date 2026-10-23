// ============================================================================
// Rommelblok: de rekenhulpjes (web workers).
// RB_MAKER: maakt nieuwe stukken wereld uit het zaadje.
// RB_WERELD: de wereldbaas. Houdt de stukken bij, rekent licht en water uit, maakt de 3D-vormen en bewaart.
// ============================================================================
export function RB_MAKER(G, ctx) {
  let wereld = null, zaad = -1;
  function behandel(m, poort) {
    // de wereldbaas vertelt eerst welke wereld het is (met de stukken die het oude landschap houden)
    if (m.t === 'wereld') { wereld = G.maakWereld(m.zaad, { gen: 3, oud: m.oud }); zaad = m.zaad; return; }
    if (m.t !== 'maak') return;
    if (m.zaad !== zaad || !wereld) { wereld = G.maakWereld(m.zaad); zaad = m.zaad; }
    const s = wereld.maakStuk(m.cx, m.cz);
    poort.postMessage({ t: 'stuk', cx: m.cx, cz: m.cz, d: s.d, b: s.biomen, k: s.kleur }, [s.d.buffer, s.biomen.buffer, s.kleur.buffer]);
  }
  ctx.onmessage = e => { const m = e.data; if (m && m.t === 'poort') { const p = e.ports[0]; p.onmessage = ev => behandel(ev.data, p); } };
}

export function RB_WERELD(G, ctx) {
  'use strict';
  const { CH, HOOG, VOL, BL, B, DICHT, DEMP, LICHT, VERVANG, LAAG, VORM, VN, W, idx } = G;
  // elk bericht krijgt het nummer van de wereld waar het bij hoort: zo gooit de pagina late berichten van een vorige wereld weg
  let startNr = 0;
  const post = (m, tr) => { m.g = startNr; ctx.postMessage(m, tr || []); };
  const stukken = new Map();
  const sk = (cx, cz) => (cx + 32768) * 65536 + (cz + 32768);
  const haal = (cx, cz) => stukken.get(sk(cx, cz));
  let laatst = null;
  function stukVan(x, z) {
    const cx = x >> 4, cz = z >> 4;
    if (laatst && laatst.cx === cx && laatst.cz === cz) return laatst;
    const s = stukken.get(sk(cx, cz)); if (s && s.d) laatst = s; return s && s.d ? s : null;
  }
  let zaad = 0, wid = null, straal = 8, pcx = 0, pcz = 0, pX = 0, pY = 64, pZ = 0, wereld = null, actief = false;
  // opties.server: de wereldbaas van een gedeelde wereld op de spelserver (geen 3D-vormen en geen kopieën, wel licht, water en groei);
  //   de middelpunten zijn dan de stukken van alle spelers (centra).
  // opties.samen: de pagina in een gedeelde wereld; water en groei doet de server, dus hier niet.
  // In beide gevallen wordt er niets in IndexedDB bewaard, maar onthoudt de overlay per stuk elk veranderd blok
  // (sleutel van het stuk -> Map(plek in het stuk -> waarde)): een stuk dat opnieuw geladen wordt, krijgt ze terug.
  const opties = { snelleBladeren: false, kopieStraal: 3 };
  let centra = null;
  const overlay = new Map(), overlayVies = new Set();
  const houdBij = () => !!(opties.samen || opties.server);
  function overlayZet(k, i, v) { let o = overlay.get(k); if (!o) overlay.set(k, o = new Map()); o.set(i, v); overlayVies.add(k); }
  // ligt een stuk binnen r stukken van een middelpunt (de speler, of op de server een van de spelers)?
  const naast = (cx, cz, r) => { if (!centra) return Math.abs(cx - pcx) <= r && Math.abs(cz - pcz) <= r; for (const c of centra) if (Math.abs(cx - c[0]) <= r && Math.abs(cz - c[1]) <= r) return true; return false; };
  const makers = []; let makerBeurt = 0;
  const geladen = new Set(); // stukken die op de pagina staan (kopie voor botsen en richten)
  let db = null, opgeslagen = new Set();
  const teBewaren = new Map(); // sleutel -> stuk dat nog naar de opslag moet (ook na weggooien)

  // ============================================================================
  // licht
  // ============================================================================
  const QM = (1 << 19) - 1, QX = new Int32Array(QM + 1), QY = new Int16Array(QM + 1), QZ = new Int32Array(QM + 1), QL = new Uint8Array(QM + 1);
  let qh = 0, qt = 0;
  const RX = new Int32Array(QM + 1), RY = new Int16Array(QM + 1), RZ = new Int32Array(QM + 1), RL = new Uint8Array(QM + 1);
  let rh = 0, rt = 0;
  const DX = [1, -1, 0, 0, 0, 0], DY = [0, 0, 1, -1, 0, 0], DZ = [0, 0, 0, 0, 1, -1];
  function duw(x, y, z) { QX[qt] = x; QY[qt] = y; QZ[qt] = z; qt = (qt + 1) & QM; }
  // markeer de secties die deze cel zien (de cel zelf en buren als hij aan een rand ligt)
  function markeer(x, y, z) {
    const lx = x & 15, ly = y & 15, lz = z & 15;
    const x0 = lx === 0 ? -1 : 0, x1 = lx === 15 ? 1 : 0, y0 = ly === 0 ? -1 : 0, y1 = ly === 15 ? 1 : 0, z0 = lz === 0 ? -1 : 0, z1 = lz === 15 ? 1 : 0;
    for (let dz = z0; dz <= z1; dz++) for (let dx = x0; dx <= x1; dx++) {
      const s = (dx || dz) ? stukVan(x + dx, z + dz) : stukVan(x, z); if (!s) continue;
      for (let dy = y0; dy <= y1; dy++) { const sy = (y + dy) >> 4; if (sy >= 0 && sy < 8) s.vies |= 1 << sy; }
    }
  }
  function verspreid(kan) {
    let gedaan = 0;
    while (qh !== qt) {
      const x = QX[qh], y = QY[qh], z = QZ[qh]; qh = (qh + 1) & QM; gedaan++;
      const s = stukVan(x, z); if (!s || !s.l) continue;
      const i = (y << 8) | ((z & 15) << 4) | (x & 15);
      const l = kan ? s.l[i] & 15 : s.l[i] >> 4;
      if (l <= 1) continue;
      for (let r = 0; r < 6; r++) {
        const ny = y + DY[r]; if (ny < 0 || ny >= HOOG) continue;
        const nx = x + DX[r], nz = z + DZ[r];
        const ns = (DX[r] || DZ[r]) ? stukVan(nx, nz) : s; if (!ns || !ns.l) continue;
        const j = (ny << 8) | ((nz & 15) << 4) | (nx & 15), id = ns.d[j] & 255;
        if (DICHT[id]) continue;
        let nl = l - 1 - DEMP[id];
        if (!kan && r === 3 && l === 15 && !DEMP[id]) nl = 15;
        const oud = ns.l[j], cur = kan ? oud & 15 : oud >> 4;
        if (nl > cur) {
          ns.l[j] = kan ? (oud & 0xF0) | nl : (oud & 15) | (nl << 4);
          if (ns.fase >= 2) markeer(nx, ny, nz);
          duw(nx, ny, nz);
        }
      }
    }
    return gedaan;
  }
  // zonlicht recht naar beneden, bij aankomst van een stuk
  function zonVul(s) {
    const d = s.d, l = s.l || (s.l = new Uint8Array(VOL));
    l.fill(0);
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      let v = 15;
      for (let y = HOOG - 1; y >= 0; y--) {
        const i = (y << 8) | (z << 4) | x, id = d[i] & 255;
        if (DICHT[id]) break;
        v -= DEMP[id]; if (v <= 0) break;
        l[i] = v << 4;
      }
    }
  }
  function belicht(s) {
    const X0 = s.cx * 16, Z0 = s.cz * 16, d = s.d, l = s.l;
    // zon: cellen die licht kunnen doorgeven aan een donkerdere buur
    qh = qt = 0;
    for (let y = 0; y < HOOG; y++) for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      const i = (y << 8) | (z << 4) | x, v = l[i] >> 4;
      if (v < 2) continue;
      let doe = false;
      for (let r = 0; r < 6 && !doe; r++) {
        if (r === 2) continue;
        const nx = x + DX[r], ny = y + DY[r], nz = z + DZ[r]; if (ny < 0 || ny >= HOOG) continue;
        let w, id;
        if (nx >= 0 && nx < 16 && nz >= 0 && nz < 16) { const j = (ny << 8) | (nz << 4) | nx; id = d[j] & 255; w = l[j] >> 4; }
        else { const ns = stukVan(X0 + nx, Z0 + nz); if (!ns || !ns.l) continue; const j = (ny << 8) | ((nz & 15) << 4) | (nx & 15); id = ns.d[j] & 255; w = ns.l[j] >> 4; }
        if (!DICHT[id] && w < v - 1) doe = true;
      }
      if (doe) duw(X0 + x, y, Z0 + z);
    }
    randZaad(s, 0);
    verspreid(0);
    // fakkels, lampen, gloeizwammen
    qh = qt = 0;
    for (let i = 0; i < VOL; i++) { const e = LICHT[d[i] & 255]; if (e) { l[i] = (l[i] & 0xF0) | e; duw(X0 + (i & 15), i >> 8, Z0 + ((i >> 4) & 15)); } }
    randZaad(s, 1);
    verspreid(1);
  }
  // licht van de buren dat dit stuk in moet
  function randZaad(s, kan) {
    for (let r = 0; r < 4; r++) {
      const dx = [1, -1, 0, 0][r], dz = [0, 0, 1, -1][r], n = haal(s.cx + dx, s.cz + dz);
      if (!n || !n.l) continue;
      const NX = n.cx * 16, NZ = n.cz * 16;
      for (let y = 0; y < HOOG; y++) for (let t = 0; t < 16; t++) {
        const x = dx === 1 ? 0 : dx === -1 ? 15 : t, z = dz === 1 ? 0 : dz === -1 ? 15 : t;
        const v = n.l[(y << 8) | (z << 4) | x]; if ((kan ? v & 15 : v >> 4) > 1) duw(NX + x, y, NZ + z);
      }
    }
  }
  function lichtOm(x, y, z) {
    // na een verandering op (x, y, z): eerst licht weghalen dat via hier kwam, dan opnieuw laten stromen
    for (let kan = 0; kan < 2; kan++) {
      const s = stukVan(x, z); if (!s || !s.l) return;
      const i = (y << 8) | ((z & 15) << 4) | (x & 15), id = s.d[i] & 255;
      const oud = kan ? s.l[i] & 15 : s.l[i] >> 4;
      qh = qt = 0; rh = rt = 0;
      if (oud > 0) { s.l[i] = kan ? s.l[i] & 0xF0 : s.l[i] & 15; RX[rt] = x; RY[rt] = y; RZ[rt] = z; RL[rt] = oud; rt = (rt + 1) & QM; markeer(x, y, z); }
      while (rh !== rt) {
        const ax = RX[rh], ay = RY[rh], az = RZ[rh], al = RL[rh]; rh = (rh + 1) & QM;
        for (let r = 0; r < 6; r++) {
          const ny = ay + DY[r]; if (ny < 0 || ny >= HOOG) continue;
          const nx = ax + DX[r], nz = az + DZ[r], ns = stukVan(nx, nz); if (!ns || !ns.l) continue;
          const j = (ny << 8) | ((nz & 15) << 4) | (nx & 15), nv = kan ? ns.l[j] & 15 : ns.l[j] >> 4;
          if (!nv) continue;
          if (nv < al || (!kan && r === 3 && al === 15 && nv === 15)) {
            ns.l[j] = kan ? ns.l[j] & 0xF0 : ns.l[j] & 15; markeer(nx, ny, nz);
            RX[rt] = nx; RY[rt] = ny; RZ[rt] = nz; RL[rt] = nv; rt = (rt + 1) & QM;
          } else duw(nx, ny, nz);
        }
      }
      if (kan && LICHT[id]) { s.l[i] = (s.l[i] & 0xF0) | LICHT[id]; markeer(x, y, z); }
      duw(x, y, z);
      for (let r = 0; r < 6; r++) { const ny = y + DY[r]; if (ny >= 0 && ny < HOOG) duw(x + DX[r], ny, z + DZ[r]); }
      // zonlicht van bovenaf: als er niets boven zit, is het hier vol licht
      if (!kan && !DICHT[id]) {
        let boven = true; for (let yy = y + 1; yy < HOOG; yy++) { const v = s.d[(yy << 8) | ((z & 15) << 4) | (x & 15)] & 255; if (DICHT[v] || DEMP[v]) { boven = false; break; } }
        if (boven && !DEMP[id]) { s.l[i] = (s.l[i] & 15) | 0xF0; markeer(x, y, z); duw(x, y, z); }
      }
      verspreid(kan);
    }
    s_lichtVies(x, z);
  }
  // welke stukken op de pagina hebben nieuw licht nodig
  const lichtNaarPagina = new Set();
  function s_lichtVies(x, z) { for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const s = haal((x >> 4) + dx, (z >> 4) + dz); if (s && geladen.has(s.k)) lichtNaarPagina.add(s.k); } }

  // ============================================================================
  // blokken lezen en zetten
  // ============================================================================
  function get(x, y, z) { if (y < 0) return B.bodemsteen; if (y >= HOOG) return 0; const s = stukVan(x, z); return s ? s.d[(y << 8) | ((z & 15) << 4) | (x & 15)] : -1; }
  const naarPagina = []; // veranderingen die de pagina nog niet weet: x, y, z, waarde
  function zet(x, y, z, v, vanPagina) {
    if (y < 0 || y >= HOOG) return false;
    const s = stukVan(x, z); if (!s) return false;
    const i = (y << 8) | ((z & 15) << 4) | (x & 15), oud = s.d[i];
    if (oud === v) return false;
    s.d[i] = v; s.gewijzigd = true; teBewaren.set(s.k, s);
    if (houdBij()) overlayZet(s.k, i, v);
    markeer(x, y, z);
    const oi = oud & 255, ni = v & 255;
    if (s.l && (DICHT[oi] !== DICHT[ni] || DEMP[oi] !== DEMP[ni] || LICHT[oi] !== LICHT[ni])) lichtOm(x, y, z);
    // water in de buurt moet opnieuw kijken
    if (ni === W || oi === W) plan(x, y, z);
    for (let r = 0; r < 6; r++) { const ny = y + DY[r]; if (ny >= 0 && ny < HOOG && (get(x + DX[r], ny, z + DZ[r]) & 255) === W) plan(x + DX[r], ny, z + DZ[r]); }
    if (!vanPagina && (geladen.has(s.k) || opties.server)) naarPagina.push(x, y, z, v);
    return true;
  }

  // ============================================================================
  // stromend water
  // stand: bits 0-2 niveau (0 = bron, 1 tot 7 steeds zwakker), bit 3 = vallend water
  // ============================================================================
  const WK = (x, y, z) => ((x + 1048576) * 2097152 + (z + 1048576)) * 128 + y;
  let plannen = new Set(), volgende = new Set();
  const plan = (x, y, z) => volgende.add(WK(x, y, z));
  const isW = v => (v & 255) === W;
  const niveau = v => (v >> 8) & 7, valt = v => (v >> 8) & 8;
  const bron = v => isW(v) && !(v >> 8);
  const kanIn = v => v === 0 || (v > 0 && BL[v & 255] && BL[v & 255].wasweg);
  function wegspoelen(x, y, z, v) { const b = BL[v & 255]; if (b && b.wasweg && v) post({ t: 'drop', x, y, z, v }); }
  function gatAfstand(x, y, z, dx, dz, diep) {
    // hoe ver is het (in deze richting beginnend) naar een plek waar het water naar beneden kan
    const nx = x + dx, nz = z + dz, v = get(nx, y, nz);
    if (!(kanIn(v) || (isW(v) && !bron(v)))) return 99;
    const onder = get(nx, y - 1, nz);
    if (kanIn(onder) || (isW(onder) && !bron(onder) )) return diep;
    if (diep >= 4) return 99;
    let best = 99;
    for (let r = 0; r < 4; r++) { const ex = [1, -1, 0, 0][r], ez = [0, 0, 1, -1][r]; if (ex === -dx && ez === -dz) continue; best = Math.min(best, gatAfstand(nx, y, nz, ex, ez, diep + 1)); }
    return best;
  }
  const HX = [1, -1, 0, 0], HZ = [0, 0, 1, -1];
  function waterStap(x, y, z) {
    let v = get(x, y, z); if (v < 0 || !isW(v)) return;
    const boven = get(x, y + 1, z);
    if (!bron(v)) {
      // wat zou dit water moeten zijn?
      let wens;
      if (isW(boven)) wens = W | (8 << 8);
      else {
        let best = 8, bronnen = 0;
        for (let r = 0; r < 4; r++) {
          const n = get(x + HX[r], y, z + HZ[r]); if (!isW(n)) continue;
          if (bron(n)) bronnen++;
          const nl = valt(n) ? 0 : niveau(n); if (nl + 1 < best) best = nl + 1;
        }
        const onder = get(x, y - 1, z);
        if (bronnen >= 2 && (onder >= 0 && (DICHT[onder & 255] || bron(onder)))) wens = W;
        else if (best >= 8) wens = 0;
        else wens = W | (best << 8);
      }
      if (wens !== v) { zet(x, y, z, wens); plan(x, y, z); for (let r = 0; r < 6; r++) plan(x + DX[r], y + DY[r], z + DZ[r]); if (!wens) return; v = wens; }
    }
    // verspreiden
    const onder = get(x, y - 1, z);
    if (y > 0 && onder >= 0 && kanIn(onder)) {
      wegspoelen(x, y - 1, z, onder); zet(x, y - 1, z, W | (8 << 8)); plan(x, y - 1, z);
      return;
    }
    if (y > 0 && onder >= 0 && isW(onder) && !bron(onder) && !valt(onder)) { zet(x, y - 1, z, W | (8 << 8)); plan(x, y - 1, z); return; }
    // op stromend of vallend water: niet opzij (alleen op iets vasts of op een bron)
    if (y > 0 && isW(onder) && !bron(onder)) return;
    const nl = valt(v) ? 1 : niveau(v) + 1;
    if (nl > 7) return;
    // naar het dichtstbijzijnde gat, of alle kanten op
    const afst = [99, 99, 99, 99]; let min = 99;
    for (let r = 0; r < 4; r++) { afst[r] = gatAfstand(x, y, z, HX[r], HZ[r], 1); if (afst[r] < min) min = afst[r]; }
    for (let r = 0; r < 4; r++) {
      if (min < 99 && afst[r] !== min) continue;
      const nx = x + HX[r], nz = z + HZ[r], n = get(nx, y, nz); if (n < 0) continue;
      if (kanIn(n)) { wegspoelen(nx, y, nz, n); zet(nx, y, nz, W | (nl << 8)); plan(nx, y, nz); }
      else if (isW(n) && !bron(n) && !valt(n) && niveau(n) > nl) { zet(nx, y, nz, W | (nl << 8)); plan(nx, y, nz); }
    }
  }
  let waterTeller = 0;
  function waterTik() {
    const nu = volgende; volgende = plannen; volgende.clear(); plannen = nu;
    let n = 0;
    for (const k of nu) {
      if (n++ > 12000) { volgende.add(k); continue; }
      const y = k % 128, r = (k - y) / 128, z = r % 2097152 - 1048576, x = (r - (z + 1048576)) / 2097152 - 1048576;
      waterStap(x, y, z);
    }
    nu.clear();
    waterTeller = n;
  }
  // water dat bij het maken naast lucht ligt (een grot die een meer raakt) gaat stromen zodra de buren er zijn
  function waterWakker(s) {
    const X0 = s.cx * 16, Z0 = s.cz * 16;
    for (let i = 0; i < VOL; i++) {
      if ((s.d[i] & 255) !== W) continue;
      const x = X0 + (i & 15), y = i >> 8, z = Z0 + ((i >> 4) & 15);
      for (let r = 0; r < 6; r++) { if (r === 2) continue; const n = get(x + DX[r], y + DY[r], z + DZ[r]); if (n === 0 || (n > 0 && BL[n & 255] && BL[n & 255].wasweg)) { plan(x, y, z); break; } }
    }
  }

  // ============================================================================
  // vormen maken (greedy meshing)
  // ============================================================================
  class Buf { constructor() { this.a = new Uint32Array(1 << 14); this.n = 0; } leeg() { this.n = 0; } duw(a, b) { if (this.n + 2 > this.a.length) { const z = new Uint32Array(this.a.length * 2); z.set(this.a); this.a = z; } this.a[this.n++] = a; this.a[this.n++] = b; } }
  const LG = [new Buf(), new Buf(), new Buf(), new Buf()]; // vast, uitgesneden, water, ijs (doorzichtige blokken)
  const PS = 18, P = new Uint16Array(PS * PS * PS), PL = new Uint8Array(PS * PS * PS);
  const PB = new Uint16Array(PS * PS); // de laag onder de rand van P (voor het water: ligt er water onder de buur?)
  const pi = (x, y, z) => ((y + 1) * PS + (z + 1)) * PS + (x + 1);
  const PO = [1, -1, PS * PS, -PS * PS, PS, -PS]; // stap in P per richting
  // assen per richting: U en V liggen in het vlak, U x V = normaal
  const UV = [[[0, 1, 0], [0, 0, 1]], [[0, 0, 1], [0, 1, 0]], [[0, 0, 1], [1, 0, 0]], [[1, 0, 0], [0, 0, 1]], [[1, 0, 0], [0, 1, 0]], [[0, 1, 0], [1, 0, 0]]];
  const NRM = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  const buren9 = new Array(9);
  function vulPad(s, sy) {
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) buren9[(dz + 1) * 3 + dx + 1] = (dx || dz) ? haal(s.cx + dx, s.cz + dz) : s;
    const y0 = sy * 16;
    let leeg = true;
    for (let z = -1; z <= 16; z++) {
      const bz = z < 0 ? 0 : z > 15 ? 2 : 1, lz = z & 15, wy = y0 - 2;
      for (let x = -1; x <= 16; x++) {
        const c = buren9[bz * 3 + (x < 0 ? 0 : x > 15 ? 2 : 1)];
        PB[(z + 1) * PS + (x + 1)] = wy < 0 ? B.bodemsteen : (!c || !c.d) ? B.steen : c.d[(wy << 8) | (lz << 4) | (x & 15)];
      }
    }
    for (let y = -1; y <= 16; y++) {
      const wy = y0 + y;
      for (let z = -1; z <= 16; z++) {
        const bz = z < 0 ? 0 : z > 15 ? 2 : 1, lz = z & 15;
        for (let x = -1; x <= 16; x++) {
          const p = ((y + 1) * PS + (z + 1)) * PS + (x + 1);
          if (wy < 0) { P[p] = B.bodemsteen; PL[p] = 0; continue; }
          if (wy >= HOOG) { P[p] = 0; PL[p] = 0xF0; continue; }
          const c = buren9[bz * 3 + (x < 0 ? 0 : x > 15 ? 2 : 1)];
          if (!c || !c.d) { P[p] = B.steen; PL[p] = 0; continue; }
          const i = (wy << 8) | (lz << 4) | (x & 15);
          const v = c.d[i]; P[p] = v; PL[p] = c.l ? c.l[i] : 0xF0;
          if (v && y >= 0 && y < 16 && x >= 0 && x < 16 && z >= 0 && z < 16) leeg = false;
        }
      }
    }
    return leeg;
  }
  function vert(L, x16, y16, z16, n, laag, ao, zon, fak, vl, ex) {
    const w0 = ((x16 + 16) & 511) | (((z16 + 16) & 511) << 9) | ((Math.max(0, Math.min(2047, y16)) & 2047) << 18) | (n << 29);
    const w1 = (laag & 255) | (ao << 8) | (zon << 10) | (fak << 14) | (vl << 18) | ((ex & 255) << 24);
    L.duw(w0 >>> 0, w1 >>> 0);
  }
  const mA = new Uint32Array(256), mL = new Uint32Array(256), mU = new Uint8Array(256);
  const cAO = [0, 0, 0, 0], cZ = [0, 0, 0, 0], cF = [0, 0, 0, 0];
  function vlakData(c, dir, id, st) {
    // laag (texture) en vlaggen voor het vlak van blok id in richting dir
    const b = BL[id];
    let laag = dir === 2 ? b.tb : dir === 3 ? b.to : b.tz, vl = 0;
    if (b.stand === 'richting') { const f = st & 3; const voor = [5, 0, 4, 1][f]; if (dir === voor) laag = b.tv; else if (dir === (voor ^ 1)) laag = b.ta; }
    if (b.as) {
      const as = st & 3; // 0 y, 1 x, 2 z
      if (as === 1) { laag = dir < 2 ? b.tb : b.tz; if (dir >= 2) vl |= 32; }
      else if (as === 2) { laag = dir >= 4 ? b.tb : b.tz; if (dir < 2) vl |= 32; }
    }
    if (b.overlay) { if (dir === 2) vl |= b.tint << 2; else if (dir !== 3) vl |= 2 | (b.tint << 2); }
    else if (b.tint) vl |= b.tint << 2;
    if (b.zwaai) vl |= 1;
    if (b.gloed) vl |= 16;
    if (b.natTex && dir === 2 && (st & 1)) laag = b.natTex;
    // gekleurde blokken: kleur 1 tot 12 in bits 14 tot 17
    const kl = b.kleur ? Math.min(11, st & 15) + 1 : 0;
    return laag | (vl << 8) | (kl << 14);
  }
  function meshSectie(s, sy) {
    LG[0].leeg(); LG[1].leeg(); LG[2].leeg(); LG[3].leeg();
    if (vulPad(s, sy)) return;
    const Y0 = sy * 16;
    // ---------- kubussen, per richting en per plak, samengevoegd
    for (let dir = 0; dir < 6; dir++) {
      const [U, V] = UV[dir], N = NRM[dir], po = PO[dir];
      const ax = N[0] ? 0 : N[1] ? 1 : 2, pos = N[ax] > 0;
      const ua = U[0] ? 0 : U[1] ? 1 : 2, va = V[0] ? 0 : V[1] ? 1 : 2;
      const STR = [1, PS * PS, PS], sA = STR[ax], sU = STR[ua], sV = STR[va], C0 = (PS + 1) * PS + 1;
      const pu = PO[ua * 2], pv = PO[va * 2]; // +U en +V in P
      for (let k = 0; k < 16; k++) {
        let iets = false;
        for (let v = 0; v < 16; v++) for (let u = 0; u < 16; u++) {
          const c = C0 + k * sA + u * sU + v * sV;
          const bv = P[c], id = bv & 255, mi = v * 16 + u;
          mA[mi] = 0;
          if (!id || VORM[id] !== 1) continue;
          const nb = P[c + po], nid = nb & 255;
          const lg = LAAG[id];
          if (DICHT[nid]) continue;
          if (lg === 1) { if (nid === id && (id === B.glas || id === B.glas_kleur || id === B.glas_in_lood || opties.snelleBladeren || BL[id].zwaai === false)) continue; }
          else if (lg === 2) { if (nid === id) continue; }
          else if (lg === 0 && nid === id && !DICHT[id]) continue;
          // licht en schaduw per hoek, gemeten in de cel voor het vlak
          const f = c + po;
          let gelijk = true;
          for (let h = 0; h < 4; h++) {
            const du = (h === 1 || h === 2) ? pu : -pu, dv = (h >= 2) ? pv : -pv;
            const s1 = DICHT[P[f + du] & 255], s2 = DICHT[P[f + dv] & 255], s3 = DICHT[P[f + du + dv] & 255];
            const ao = s1 && s2 ? 0 : 3 - s1 - s2 - s3;
            let zs = PL[f] >> 4, fs = PL[f] & 15, n = 1;
            if (!s1) { zs += PL[f + du] >> 4; fs += PL[f + du] & 15; n++; }
            if (!s2) { zs += PL[f + dv] >> 4; fs += PL[f + dv] & 15; n++; }
            if (!s3 && !(s1 && s2)) { zs += PL[f + du + dv] >> 4; fs += PL[f + du + dv] & 15; n++; }
            cAO[h] = ao; cZ[h] = Math.round(zs / n); cF[h] = Math.round(fs / n);
            if (h && (ao !== cAO[0] || cZ[h] !== cZ[0] || cF[h] !== cF[0])) gelijk = false;
          }
          mA[mi] = (vlakData(c, dir, id, bv >> 8) | (lg << 22)) + 1;
          mL[mi] = cZ[0] | (cZ[1] << 4) | (cZ[2] << 8) | (cZ[3] << 12) | (cF[0] << 16) | (cF[1] << 20) | (cF[2] << 24) | (cF[3] << 28);
          mU[mi] = cAO[0] | (cAO[1] << 2) | (cAO[2] << 4) | (cAO[3] << 6) | (gelijk ? 0 : 0) ;
          if (!gelijk) mA[mi] |= 1 << 30;
          iets = true;
        }
        if (!iets) continue;
        // samenvoegen
        const vlak = k + (pos ? 1 : 0);
        for (let v = 0; v < 16; v++) for (let u = 0; u < 16; ) {
          const mi = v * 16 + u, a = mA[mi];
          if (!a) { u++; continue; }
          let w = 1, h = 1;
          if (!(a & (1 << 30))) {
            const l = mL[mi], o = mU[mi];
            while (u + w < 16 && mA[mi + w] === a && mL[mi + w] === l && mU[mi + w] === o) w++;
            outer: while (v + h < 16) { for (let t = 0; t < w; t++) { const mj = (v + h) * 16 + u + t; if (mA[mj] !== a || mL[mj] !== l || mU[mj] !== o) break outer; } h++; }
          }
          // vlak uitzenden
          const data = (a - 1) & ~(1 << 30), laag = data & 255, vl = (data >> 8) & 63, lg = (data >> 22) & 3, kl = (data >> 14) & 15;
          const l = mL[mi], o = mU[mi], L = LG[lg === 2 ? 3 : lg];
          const ao = [o & 3, (o >> 2) & 3, (o >> 4) & 3, (o >> 6) & 3];
          const zz = [l & 15, (l >> 4) & 15, (l >> 8) & 15, (l >> 12) & 15], ff = [(l >> 16) & 15, (l >> 20) & 15, (l >> 24) & 15, (l >>> 28) & 15];
          const start = (ao[1] + ao[3] > ao[0] + ao[2]) ? 1 : 0;
          for (let hh = 0; hh < 4; hh++) {
            const hk = (hh + start) & 3, cu = u + ((hk === 1 || hk === 2) ? w : 0), cv = v + (hk >= 2 ? h : 0);
            const px = ax === 0 ? vlak : ua === 0 ? cu : cv, py = ax === 1 ? vlak : ua === 1 ? cu : cv, pz = ax === 2 ? vlak : ua === 2 ? cu : cv;
            // ex: welke hoek dit is, zodat de tekenaar het vlak een haartje groter kan maken (geen kiertjes tussen vlakken).
            // Niet bij ijs: doorzichtige vlakken die een haartje overlappen geven lichte lijntjes op de naden.
            vert(L, px * 16, (Y0 + py) * 16, pz * 16, dir, laag, ao[hk], zz[hk], ff[hk], vl, (lg === 2 ? 0 : 4) | ((hk === 1 || hk === 2) ? 1 : 0) | (hk >= 2 ? 2 : 0) | (kl << 3));
          }
          for (let t = 0; t < h; t++) for (let r = 0; r < w; r++) mA[(v + t) * 16 + u + r] = 0;
          u += w;
        }
      }
    }
    // ---------- planten, vormen en water: per cel
    for (let y = 0; y < 16; y++) for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      const c = ((y + 1) * PS + (z + 1)) * PS + (x + 1), bv = P[c], id = bv & 255;
      if (!id) continue;
      const vm = VORM[id];
      if (vm === 1) continue;
      if (vm === VN.water) { meshWater(c, x, Y0 + y, z, bv); continue; }
      if (vm === VN.kruis) { meshKruis(c, x, Y0 + y, z, bv, s); continue; }
      meshVorm(c, x, Y0 + y, z, bv);
    }
  }
  function meshKruis(c, x, y, z, bv, s) {
    const id = bv & 255, b = BL[id];
    let laag = b.tz;
    if (id === B.bessenstruik && (bv >> 8) & 1) laag = b.tex2;
    if (b.standTex) laag = b.standTex[(bv >> 8) & 3];
    const X = s.cx * 16 + x, Z = s.cz * 16 + z;
    const h0 = G.hsh(X, Z, 3, 4);
    const ox = id === B.riet || id === B.druipsteen_hang || id === B.druipsteen_staand ? 0 : (h0 & 7) - 3, oz = id === B.riet ? 0 : ((h0 >> 3) & 7) - 3;
    let vl = 0; if (b.tint) vl |= b.tint << 2; if (b.zwaai) vl |= 1; if (b.gloed) vl |= 16;
    const zon = PL[c] >> 4, fak = PL[c] & 15, L = LG[1];
    const hangt = b.plaatsOp === 'hang';
    const x0 = x * 16 + ox + 1, x1 = x * 16 + ox + 15, z0 = z * 16 + oz + 1, z1 = z * 16 + oz + 15, ya = y * 16, yb = y * 16 + 16;
    const top = hangt ? 0 : 1, bodem = hangt ? 1 : 0;
    vert(L, x0, ya, z0, 6, laag, 3, zon, fak, vl, bodem); vert(L, x1, ya, z1, 6, laag, 3, zon, fak, vl, bodem); vert(L, x1, yb, z1, 6, laag, 3, zon, fak, vl, top); vert(L, x0, yb, z0, 6, laag, 3, zon, fak, vl, top);
    vert(L, x0, ya, z1, 7, laag, 3, zon, fak, vl, bodem); vert(L, x1, ya, z0, 7, laag, 3, zon, fak, vl, bodem); vert(L, x1, yb, z0, 7, laag, 3, zon, fak, vl, top); vert(L, x0, yb, z1, 7, laag, 3, zon, fak, vl, top);
  }
  function meshVorm(c, x, y, z, bv) {
    const id = bv & 255, b = BL[id];
    const buur = (dx, dy, dz) => P[c + dx + dy * PS * PS + dz * PS];
    const dozen = G.vormDozen(bv, buur);
    let vl = 0; if (b.tint) vl |= b.tint << 2; if (b.gloed) vl |= 16; if (b.zwaai) vl |= 1;
    const kl = b.kleur ? (Math.min(11, (bv >> 8) & 15) + 1) << 3 : 0;
    const L = LG[b.laag === 2 ? 3 : b.laag];
    const zon0 = PL[c] >> 4, fak0 = PL[c] & 15;
    for (const d of dozen) {
      for (let dir = 0; dir < 6; dir++) {
        const N = NRM[dir], ax = N[0] ? 0 : N[1] ? 1 : 2, pos = N[ax] > 0;
        const vlakPos = pos ? d[ax + 3] : d[ax];
        const opRand = pos ? vlakPos === 16 : vlakPos === 0;
        let zon = zon0, fak = fak0;
        if (opRand) { const nb = P[c + PO[dir]]; if (DICHT[nb & 255]) continue; zon = PL[c + PO[dir]] >> 4; fak = PL[c + PO[dir]] & 15; }
        if (b.vorm === 'lelie' && dir !== 2) continue;
        const [U, V] = UV[dir], ua = U[0] ? 0 : U[1] ? 1 : 2, va = V[0] ? 0 : V[1] ? 1 : 2;
        if (d[ua] === d[ua + 3] || d[va] === d[va + 3]) continue;
        const laag = d[6 + dir], ex = (d.length > 12 && d[12] ? 128 | d[12] : 0) | kl;
        for (let h = 0; h < 4; h++) {
          const p = [0, 0, 0]; p[ax] = vlakPos; p[ua] = (h === 1 || h === 2) ? d[ua + 3] : d[ua]; p[va] = h >= 2 ? d[va + 3] : d[va];
          vert(L, x * 16 + p[0], y * 16 + p[1], z * 16 + p[2], dir, laag, 3, zon, fak, vl, ex);
        }
      }
    }
  }
  // water: hoogte per hoek uit de buren
  const WH = [14, 12, 11, 9, 7, 5, 4, 2];
  function wHoogte(p) {
    const v = P[p]; if ((v & 255) !== W) return -1;
    if ((P[p + PS * PS] & 255) === W) return 16;
    return WH[(v >> 8) & 7];
  }
  function hoekH(c, ox, oz) {
    // de vier cellen rond de hoek (c is de cel linksvoor van de hoek + ox, oz in {0, 1})
    let som = 0, n = 0;
    for (let a = -1; a <= 0; a++) for (let bb = -1; bb <= 0; bb++) {
      const p = c + (ox + a) + (oz + bb) * PS, h = wHoogte(p);
      if (h === 16) return 16;
      if (h >= 0) { som += h; n++; continue; }
      if (VAST[P[p] & 255]) continue; // een muur telt niet mee
      // Lucht of een plant trekt de hoek alleen omlaag aan een oever (met iets vasts eronder): daar loopt het water
      // dun uit tot op de grond. Boven een trede (lager water of lucht eronder) blijft het oppervlak op hoogte,
      // en loopt een zijkant naar beneden; anders wordt een trap een rij losse puntjes.
      const o = p >= PS * PS ? P[p - PS * PS] : PB[p];
      if (VAST[o & 255] && (o & 255) !== W) n++;
    }
    return n ? som / n : 14;
  }
  const VAST = G.VAST;
  function meshWater(c, x, y, z, bv) {
    const L = LG[2], zon = PL[c] >> 4, fak = PL[c] & 15;
    const vl = 3 << 2;
    const bovenW = (P[c + PS * PS] & 255) === W;
    const h00 = bovenW ? 16 : hoekH(c, 0, 0), h10 = bovenW ? 16 : hoekH(c, 1, 0), h11 = bovenW ? 16 : hoekH(c, 1, 1), h01 = bovenW ? 16 : hoekH(c, 0, 1);
    // stroming: van hoog naar laag
    const fx = (h00 + h01) - (h10 + h11), fz = (h00 + h10) - (h01 + h11);
    const stroomt = ((bv >> 8) !== 0 || Math.abs(fx) + Math.abs(fz) > 0.5) ? 1 : 0;
    let rdir = 0; if (stroomt) { const a = Math.atan2(fz, fx); rdir = ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8; }
    // diepte tot de bodem
    let diep = 0; for (let t = 1; t < 16; t++) { const p = c - t * PS * PS; if (p < 0) break; if ((P[p] & 255) === W) diep++; else break; }
    if (diep >= 15) diep = 15;
    const ex = diep | (rdir << 4) | (stroomt << 7);
    const X = x * 16, Z = z * 16, Y = y * 16;
    if (!bovenW && !DICHT[P[c + PS * PS] & 255]) {
      // bovenkant (richting +y: U = z, V = x); hoe schuin hij is (0 tot 3) gaat mee in vl, zodat een schuin, stromend
      // stuk dezelfde strepen krijgt als vallend water
      const steil = Math.max(h00, h01, h10, h11) - Math.min(h00, h01, h10, h11), vb = vl | ((steil >= 10 ? 3 : steil >= 6 ? 2 : steil >= 3 ? 1 : 0) << 4);
      vert(L, X, Y + h00, Z, 2, 0, 3, zon, fak, vb, ex); vert(L, X, Y + h01, Z + 16, 2, 0, 3, zon, fak, vb, ex);
      vert(L, X + 16, Y + h11, Z + 16, 2, 0, 3, zon, fak, vb, ex); vert(L, X + 16, Y + h10, Z, 2, 0, 3, zon, fak, vb, ex);
    }
    // zijkanten
    // per zijkant: de hoogtes bovenaan (a en b), waar die hoeken liggen, en welke hoeken van het lagere vakje ernaast daar aansluiten
    const zijH = [[h10, h11, 16, 0, 16, 16, 0, 0, 0, 1], [h01, h00, 0, 16, 0, 0, 1, 1, 1, 0], null, null, [h11, h01, 16, 16, 0, 16, 1, 0, 0, 0], [h00, h10, 0, 0, 16, 0, 0, 1, 1, 1]];
    for (let dir = 0; dir < 6; dir++) {
      if (dir === 2) continue;
      const nb = P[c + PO[dir]], ni = nb & 255;
      if (ni === W || DICHT[ni] || ni === B.ijs) continue;
      const nz = PL[c + PO[dir]] >> 4, nf = PL[c + PO[dir]] & 15;
      let exz = (stroomt || bv >> 8 ? 0x80 : 0) | diep;
      if (dir === 3) { vert(L, X, Y, Z, 3, 0, 3, nz, nf, vl, exz); vert(L, X + 16, Y, Z, 3, 0, 3, nz, nf, vl, exz); vert(L, X + 16, Y, Z + 16, 3, 0, 3, nz, nf, vl, exz); vert(L, X, Y, Z + 16, 3, 0, 3, nz, nf, vl, exz); continue; }
      const [ha, hb, xa, za, xb, zb, oxa, oza, oxb, ozb] = zijH[dir];
      if (!ha && !hb) continue; // aan een oever waar het water helemaal uitloopt
      // Gaat het water daarnaast een trede lager verder, dan loopt deze zijkant door tot dat lagere oppervlak:
      // zo sluiten de treden op elkaar aan, als water dat over de rand stroomt (met de strepen van vallend water).
      let la = Y, lb = Y;
      const c2 = c + PO[dir] - PS * PS;
      if ((P[c2] & 255) === W) { la = Y - 16 + hoekH(c2, oxa, oza); lb = Y - 16 + hoekH(c2, oxb, ozb); exz |= 0x80; }
      vert(L, X + xa, la, Z + za, dir, 0, 3, nz, nf, vl, exz); vert(L, X + xb, lb, Z + zb, dir, 0, 3, nz, nf, vl, exz);
      vert(L, X + xb, Y + hb, Z + zb, dir, 0, 3, nz, nf, vl, exz); vert(L, X + xa, Y + ha, Z + za, dir, 0, 3, nz, nf, vl, exz);
    }
  }
  function meshStuk(s) {
    const dicht = Math.abs(s.cx - pcx) <= 3 && Math.abs(s.cz - pcz) <= 3;
    if (dicht && !s.cache) s.cache = new Array(8).fill(null);
    if (!dicht) s.cache = null;
    const delen = [[], [], [], []];
    for (let sy = 0; sy < 8; sy++) {
      if (s.cache && s.cache[sy] && !(s.vies & (1 << sy))) { for (let l = 0; l < 4; l++) delen[l].push(s.cache[sy][l]); continue; }
      meshSectie(s, sy);
      const r = LG.map(g => g.a.slice(0, g.n));
      if (s.cache) s.cache[sy] = r;
      for (let l = 0; l < 4; l++) delen[l].push(r[l]);
    }
    s.vies = 0;
    const uit = [], ofs = [], tr = [];
    for (let l = 0; l < 4; l++) {
      let n = 0; for (const a of delen[l]) n += a.length;
      const buf = new Uint32Array(n), o = new Uint32Array(9); let p = 0;
      for (let sy = 0; sy < 8; sy++) { o[sy] = p / 2; buf.set(delen[l][sy], p); p += delen[l][sy].length; }
      o[8] = p / 2;
      uit.push(buf); ofs.push(o); tr.push(buf.buffer);
    }
    post({ t: 'mesh', cx: s.cx, cz: s.cz, lagen: uit, ofs, kl: s.fase < 3 ? s.kl.slice() : null }, tr);
    s.fase = 3;
    // het kaartje alleen sturen als het anders is dan het vorige
    const tg = kaartTegel(s); let zelfde = !!s.tegel;
    if (zelfde) for (let i = 0; i < 768; i++) if (tg[i] !== s.tegel[i]) { zelfde = false; break; }
    if (!zelfde) { s.tegel = tg; post({ t: 'kaart', cx: s.cx, cz: s.cz, tegel: tg.slice() }); }
  }
  // een kaartje van een stuk: per kolom het bovenste blok (0-255), de hoogte (256-511; bij water de bodem)
  // en de kleur van gras, blad of water als 3-3-2 bits (512-767)
  function kaartTegel(s) {
    const t = new Uint8Array(768), d = s.d, kl = s.kl;
    for (let k = 0; k < 256; k++) {
      let y = HOOG - 1, id = 0;
      for (; y > 0; y--) { id = d[(y << 8) | k] & 255; if (id && (G.VAST[id] || id === W)) break; }
      t[k] = id;
      if (id === W) { let f = y; while (f > 1 && (d[(f << 8) | k] & 255) === W) f--; t[256 + k] = f; } else t[256 + k] = y;
      const tint = BL[id] ? BL[id].tint : 0;
      if (tint && kl) { const c = kl[(tint - 1) * 256 + k]; t[512 + k] = ((c >> 13) << 5) | (((c >> 8) & 7) << 2) | ((c >> 3) & 3); }
    }
    return t;
  }
  // bouwwerken (ruïnes, mijnen, kraters) rond de speler: per vak van 64, één vak per beurt (de eerste keer kost een vak wat rekenwerk)
  const bouwBekend = new Set(), bouwRij = [];
  let bouwVakSpeler = '';
  function bouwTik() {
    const gx = Math.floor(pX / 64), gz = Math.floor(pZ / 64), k = gx + ',' + gz;
    if (k !== bouwVakSpeler) {
      bouwVakSpeler = k; bouwRij.length = 0;
      for (let r = 0; r <= 2; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) if (Math.max(Math.abs(dx), Math.abs(dz)) === r && !bouwBekend.has((gx + dx) + ',' + (gz + dz))) bouwRij.push([gx + dx, gz + dz]);
    }
    const v = bouwRij.shift(); if (!v || !wereld) return;
    bouwBekend.add(v[0] + ',' + v[1]);
    const lijst = wereld.bouwVak(v[0], v[1]).soorten; if (lijst.length) post({ t: 'bouwwerken', lijst });
  }

  // ============================================================================
  // stukken laden, maken en weggooien
  // ============================================================================
  let nodig = [], nodigVoor = '';
  function bepaalNodig() {
    const k = (centra ? centra.join(';') : pcx + ',' + pcz) + ',' + straal; if (k === nodigVoor) return; nodigVoor = k;
    nodig = [];
    const R = straal + 2;
    if (!centra) { for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) { const d2 = dx * dx + dz * dz; if (d2 <= R * R + 2) nodig.push([d2, pcx + dx, pcz + dz]); } }
    else {
      // op de server: rond elke speler, en elk stuk één keer (met de kleinste afstand)
      const al = new Map();
      for (const [ccx, ccz] of centra) for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) { const d2 = dx * dx + dz * dz; if (d2 > R * R + 2) continue; const kk = sk(ccx + dx, ccz + dz), o = al.get(kk); if (!o) { const e = [d2, ccx + dx, ccz + dz]; al.set(kk, e); nodig.push(e); } else if (d2 < o[0]) o[0] = d2; }
    }
    nodig.sort((a, b) => a[0] - b[0]);
  }
  function vraag(cx, cz) {
    const k = sk(cx, cz); if (stukken.has(k)) return;
    // een veranderd stuk dat nog bewaard moet worden: gewoon terugzetten
    const oud = teBewaren.get(k);
    if (oud && oud.d) { oud.fase = 1; oud.vies = 0; oud.cache = null; stukken.set(k, oud); laatst = null; zonVul(oud); return; }
    const s = { k, cx, cz, d: null, l: null, b: null, kl: null, fase: 0, vies: 0, gewijzigd: false, cache: null };
    stukken.set(k, s);
    if (opgeslagen.has(cx + ',' + cz) && db) laadUitOpslag(s);
    else {
      const m = makers[makerBeurt++ % makers.length];
      if (m) { m.bezig++; m.poort.postMessage({ t: 'maak', zaad, cx, cz }); }
      else { const r = wereld.maakStuk(cx, cz); ontvang(cx, cz, r.d, r.biomen, r.kleur); }
    }
  }
  function ontvang(cx, cz, d, b, k) {
    const s = haal(cx, cz); if (!s || s.d) return;
    // bij samen spelen: de veranderingen die al bekend zijn erin (vóór het licht en het water)
    const o = overlay.get(s.k); if (o) for (const [i, v] of o) d[i] = v;
    s.d = d; s.b = b; s.kl = k; s.fase = 1; laatst = null;
    zonVul(s);
  }
  function rondBuren(s, fase) { for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const n = haal(s.cx + dx, s.cz + dz); if (!n || n.fase < fase) return false; } return true; }
  function stuurKopie(s) {
    const d = s.d.slice(), l = s.l.slice();
    post({ t: 'kopie', cx: s.cx, cz: s.cz, d, l, b: s.b.slice(), kl: s.kl.slice() }, [d.buffer, l.buffer]);
    geladen.add(s.k);
  }
  function tik() {
    if (!actief) return;
    const t0 = performance.now();
    bepaalNodig();
    // 1. vragen om stukken die er nog niet zijn
    let inVlucht = 0; for (const m of makers) inVlucht += m.bezig;
    const maxVlucht = Math.max(2, makers.length * 2);
    for (const [, cx, cz] of nodig) { if (inVlucht >= maxVlucht) break; if (!stukken.has(sk(cx, cz))) { vraag(cx, cz); if (makers.length) inVlucht++; } }
    // 2. belichten wat klaar ligt (alle buren aanwezig)
    const R1 = (straal + 1) * (straal + 1) + 2, R0 = straal * straal + 2;
    for (const [d2, cx, cz] of nodig) {
      if (performance.now() - t0 > 7) break;
      if (d2 > R1) break;
      const s = haal(cx, cz); if (!s || s.fase !== 1 || !rondBuren(s, 1)) continue;
      belicht(s); s.fase = 2; waterWakker(s);
    }
    // 3. vormen maken voor stukken waarvan alle buren belicht zijn
    for (const [d2, cx, cz] of nodig) {
      if (performance.now() - t0 > 14) break;
      if (d2 > R0) break;
      const s = haal(cx, cz); if (!s || s.fase < 2) continue;
      // op de server geen 3D-vormen: een belicht stuk met belichte buren is meteen klaar
      if (opties.server) { if (s.fase === 2 && rondBuren(s, 2)) s.fase = 3; continue; }
      if ((s.fase === 2 || s.vies) && rondBuren(s, 2)) meshStuk(s);
    }
    // 4. kopieën voor de pagina (botsen, richten, licht op de speler)
    const KR = opties.server ? -1 : opties.kopieStraal;
    for (let dz = -KR; dz <= KR; dz++) for (let dx = -KR; dx <= KR; dx++) {
      const s = haal(pcx + dx, pcz + dz); if (s && s.fase >= 2 && !geladen.has(s.k)) stuurKopie(s);
    }
    for (const k of geladen) { const s = stukken.get(k); if (!s || Math.abs(s.cx - pcx) > KR + 1 || Math.abs(s.cz - pcz) > KR + 1) geladen.delete(k); }
    // 5. weggooien wat ver weg is
    const RW = straal + 4;
    for (const [k, s] of stukken) {
      if (naast(s.cx, s.cz, RW)) continue;
      if (s.fase === 0) continue; // wacht op de maker
      stukken.delete(k); if (laatst === s) laatst = null;
      if (s.fase >= 3) post({ t: 'weg', cx: s.cx, cz: s.cz });
    }
    // 6. veranderingen naar de pagina
    stuurVeranderingen();
  }
  function stuurVeranderingen() {
    if (naarPagina.length) { const a = new Int32Array(naarPagina); naarPagina.length = 0; post({ t: 'blokken', a }, [a.buffer]); }
    for (const k of lichtNaarPagina) { const s = stukken.get(k); if (s && s.l && geladen.has(k)) { const l = s.l.slice(); post({ t: 'licht', cx: s.cx, cz: s.cz, l }, [l.buffer]); } }
    lichtNaarPagina.clear();
  }
  // ---------- willekeurige tikken: gras groeit, stekjes worden bomen, bessen komen terug
  function willekeurig() {
    const r = Math.random;
    for (const s of stukken.values()) {
      if (s.fase < 3 || !naast(s.cx, s.cz, 6)) continue;
      for (let n = 0; n < 256; n++) {
        const i = Math.floor(r() * VOL), v = s.d[i], id = v & 255;
        if (!id) continue;
        const x = s.cx * 16 + (i & 15), y = i >> 8, z = s.cz * 16 + ((i >> 4) & 15);
        if (id === B.gras) {
          const boven = get(x, y + 1, z); if (boven > 0 && DICHT[boven & 255]) { zet(x, y, z, B.aarde); continue; }
          const nx = x + Math.floor(r() * 3) - 1, ny = y + Math.floor(r() * 5) - 3, nz = z + Math.floor(r() * 3) - 1;
          if ((get(nx, ny, nz) & 255) === B.aarde) { const b = get(nx, ny + 1, nz); const ns = stukVan(nx, nz); const lv = ns && ns.l ? ns.l[((ny + 1) << 8) | ((nz & 15) << 4) | (nx & 15)] >> 4 : 0; if (b >= 0 && !DICHT[b & 255] && (b & 255) !== W && lv >= 9) zet(nx, ny, nz, B.gras); }
        } else if ((id >= B.stekje_eik && id <= B.stekje_wilg) || id === B.stekje_kers || id === B.stekje_noten) {
          const st = (v >> 8) & 7;
          if (r() > 0.25) continue;
          if (st < 3) zet(x, y, z, id | ((st + 1) << 8));
          else groeiBoom(x, y, z, id === B.stekje_kers ? 'kers' : id === B.stekje_noten ? 'noten' : G.HOUT[id - B.stekje_eik][0]);
        } else if (id === B.bessenstruik && !((v >> 8) & 1) && r() < 0.06) zet(x, y, z, id | (1 << 8));
        else if (id >= B.gewas_tarwe && id <= B.gewas_pompoen) {
          // gewassen groeien met licht; op een natte akker ruim twee keer zo snel (nat ongeveer 6 minuten, droog 14)
          const st = (v >> 8) & 3; if (st >= 3) continue;
          const onder = get(x, y - 1, z), nat = (onder & 255) === B.akker && ((onder >> 8) & 1);
          const l = s.l ? s.l[i] : 0xF0; if (Math.max(l >> 4, l & 15) < 9) continue;
          if (r() < (nat ? 1 : 0.45)) zet(x, y, z, id | ((st + 1) << 8));
        } else if (id === B.akker) {
          // nat als er water is binnen 4 blokken (op dezelfde hoogte of een hoger); droog en leeg wordt weer aarde
          let water = false;
          for (let dz = -4; dz <= 4 && !water; dz++) for (let dx = -4; dx <= 4 && !water; dx++) { if ((get(x + dx, y, z + dz) & 255) === W || (get(x + dx, y + 1, z + dz) & 255) === W) water = true; }
          const nat = (v >> 8) & 1, boven = get(x, y + 1, z) & 255;
          if (water && !nat) zet(x, y, z, B.akker | (1 << 8));
          else if (!water && nat && r() < 0.2) zet(x, y, z, B.akker);
          else if (!water && !nat && !(boven >= B.gewas_tarwe && boven <= B.gewas_pompoen) && r() < 0.08) zet(x, y, z, B.aarde);
          else if (boven && DICHT[boven]) zet(x, y, z, B.aarde);
        }
      }
    }
  }
  function groeiBoom(x, y, z, soort) {
    const R = G.rng((x * 73856093) ^ (z * 19349663) ^ (y * 83492791) ^ Date.now());
    const lijst = [];
    const s0 = soort === 'eik' ? (R() < 0.12 ? 'grote_eik' : 'eik') : soort;
    // eerst kijken of er ruimte is (een paar blokken boven het stekje)
    for (let i = 1; i < 5; i++) { const b = get(x, y + i, z); if (b !== 0 && !(b > 0 && BL[b & 255].laag === 1)) return; }
    wereld.zetBoom(s0, x, y, z, R, (xx, yy, zz, v, voorrang) => lijst.push(xx, yy, zz, v, voorrang));
    zet(x, y, z, 0);
    for (let i = 0; i < lijst.length; i += 5) {
      const xx = lijst[i], yy = lijst[i + 1], zz = lijst[i + 2], v = lijst[i + 3], vr = lijst[i + 4], oud = get(xx, yy, zz);
      if (oud < 0) continue; const oi = oud & 255;
      if (vr === 2) { if (oi === 0 || BL[oi].laag === 1 || VERVANG[oi]) zet(xx, yy, zz, v); }
      else if (oi === 0 || (VERVANG[oi] && oi !== W)) zet(xx, yy, zz, v);
    }
  }

  // ============================================================================
  // opslag (IndexedDB), alleen veranderde stukken
  // ============================================================================
  const pak = async (u8) => { if (typeof CompressionStream === 'undefined') return { z: 0, a: u8.buffer.slice(0) }; const s = new Blob([u8]).stream().pipeThrough(new CompressionStream('deflate-raw')); return { z: 1, a: await new Response(s).arrayBuffer() }; };
  const uitpakken = async (r) => { if (!r.z) return new Uint8Array(r.a); const s = new Blob([r.a]).stream().pipeThrough(new DecompressionStream('deflate-raw')); return new Uint8Array(await new Response(s).arrayBuffer()); };
  const dbVraag = (q) => new Promise((ok, nee) => { q.onsuccess = () => ok(q.result); q.onerror = () => nee(q.error); });
  async function openDB() {
    if (typeof indexedDB === 'undefined') return null;
    return new Promise((ok) => {
      const q = indexedDB.open('rommelblok', 1);
      q.onupgradeneeded = () => { const d = q.result; if (!d.objectStoreNames.contains('werelden')) d.createObjectStore('werelden', { keyPath: 'id' }); if (!d.objectStoreNames.contains('stukken')) d.createObjectStore('stukken'); };
      q.onsuccess = () => ok(q.result); q.onerror = () => ok(null); q.onblocked = () => ok(null);
    });
  }
  async function laadUitOpslag(s) {
    try {
      const tx = db.transaction('stukken', 'readonly');
      const r = await dbVraag(tx.objectStore('stukken').get(wid + '|' + s.cx + '|' + s.cz));
      if (!r) throw new Error('weg');
      const d = new Uint16Array((await uitpakken(r.d)).buffer);
      if (d.length !== VOL) throw new Error('kapot');
      ontvang(s.cx, s.cz, d, new Uint8Array(r.b), new Uint16Array(r.k.buffer ? r.k.buffer.slice(0) : r.k));
      const kk = haal(s.cx, s.cz); if (kk) kk.gewijzigd = true;
    } catch (e) {
      opgeslagen.delete(s.cx + ',' + s.cz);
      const r = wereld.maakStuk(s.cx, s.cz); ontvang(s.cx, s.cz, r.d, r.biomen, r.kleur);
    }
  }
  let bewaarBezig = null;
  async function bewaar() {
    if (bewaarBezig) await bewaarBezig;
    if (!db || !teBewaren.size) return 0;
    const lijst = [...teBewaren.values()]; teBewaren.clear();
    const klaar = [];
    for (const s of lijst) { if (!s.d) continue; klaar.push([wid + '|' + s.cx + '|' + s.cz, { d: await pak(new Uint8Array(s.d.buffer.slice(0))), b: s.b.slice(), k: s.kl.slice(), t: Date.now() }]); opgeslagen.add(s.cx + ',' + s.cz); }
    bewaarBezig = new Promise((ok) => {
      const tx = db.transaction('stukken', 'readwrite'), st = tx.objectStore('stukken');
      for (const [k, r] of klaar) st.put(r, k);
      tx.oncomplete = () => ok(klaar.length); tx.onerror = tx.onabort = () => { for (const s of lijst) teBewaren.set(s.k, s); ok(-1); };
    });
    const n = await bewaarBezig; bewaarBezig = null; return n;
  }

  // ============================================================================
  // berichten van de pagina
  // ============================================================================
  let tikker = null, waterKlok = 0, toevalKlok = 0, bouwKlok = 0;
  function lus() {
    tik();
    const nu = performance.now();
    if (!opties.samen && nu - waterKlok > 250) { waterKlok = nu; waterTik(); }
    if (!opties.samen && nu - toevalKlok > 1000) { toevalKlok = nu; willekeurig(); }
    if (actief && !opties.server && nu - bouwKlok > 150) { bouwKlok = nu; bouwTik(); }
    tikker = setTimeout(lus, 12);
  }
  ctx.onmessage = async (e) => {
    const m = e.data;
    if (m.t === 'start') {
      // eerst stilzetten: tot we weten welke stukken bewaard zijn, mag er niets gemaakt worden
      // (anders maakt de lus van de vorige wereld, zoals die van het beginscherm, al stukken uit het zaadje en zie je je bouwwerken niet)
      actief = false; clearTimeout(tikker); startNr = m.nr || 0;
      zaad = m.zaad >>> 0; wid = m.wid; straal = m.straal || 8; Object.assign(opties, { samen: false, server: false }, m.opties || {}); centra = m.centra || null; overlay.clear(); overlayVies.clear();
      wereld = G.maakWereld(zaad); bouwBekend.clear(); bouwRij.length = 0; bouwVakSpeler = '';
      stukken.clear(); laatst = null; geladen.clear(); opgeslagen = new Set(); teBewaren.clear(); plannen.clear(); volgende.clear();
      for (const mk of makers) mk.bezig = 0;
      for (const p of (m.poorten || [])) { const mk = { poort: p, bezig: 0 }; p.onmessage = ev => { mk.bezig = Math.max(0, mk.bezig - 1); const r = ev.data; ontvang(r.cx, r.cz, r.d, r.b, r.k); }; makers.push(mk); }
      pX = m.x; pY = m.y; pZ = m.z; pcx = Math.floor(m.x) >> 4; pcz = Math.floor(m.z) >> 4; nodigVoor = '';
      if (!db) db = await openDB();
      if (db && wid) { try { const keys = await dbVraag(db.transaction('stukken', 'readonly').objectStore('stukken').getAllKeys(IDBKeyRange.bound(wid + '|', wid + '|￿'))); for (const k of keys) { const [, a, b] = String(k).split('|'); opgeslagen.add(a + ',' + b); } } catch (er) {} }
      // Een wereld van voor versie 3 (meer land, rivieren door dalen, dorpjes): de stukken waar je al was (bewaard of op de kaart)
      // houden voorgoed het oude landschap. Die lijst wordt één keer vastgelegd, onder 'oud|<wereld>'.
      let oud = null, oudNieuw = false;
      if (db && wid) {
        try { const r = await dbVraag(db.transaction('stukken', 'readonly').objectStore('stukken').get('oud|' + wid)); if (r instanceof Int32Array) oud = r; } catch (er) {}
        if (!oud && (m.gen || 2) < 3) {
          const paren = new Set(opgeslagen);
          // ook een rand rond wat je bouwde, en rond je plek, je startplek en je bed (een wereld van voor de kaart weet niet waar je allemaal was)
          const rond = (cx, cz, r) => { for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dz * dz <= r * r) paren.add((cx + dx) + ',' + (cz + dz)); };
          for (const p of [...opgeslagen]) { const [a, b] = p.split(','); rond(+a, +b, 4); }
          for (const [x, z] of (m.plekken || [])) if (isFinite(x) && isFinite(z)) rond(Math.floor(x) >> 4, Math.floor(z) >> 4, 8);
          try { const kk = await dbVraag(db.transaction('stukken', 'readonly').objectStore('stukken').getAllKeys(IDBKeyRange.bound('kaart|' + wid + '|', 'kaart|' + wid + '|￿'))); for (const k of kk) { const [, , a, b] = String(k).split('|'); paren.add(a + ',' + b); } } catch (er) {}
          oud = new Int32Array(paren.size * 2); let i = 0; for (const p of paren) { const [a, b] = p.split(','); oud[i++] = +a; oud[i++] = +b; }
          try { const tx = db.transaction('stukken', 'readwrite'); tx.objectStore('stukken').put(oud, 'oud|' + wid); await new Promise(ok => { tx.oncomplete = tx.onerror = tx.onabort = ok; }); } catch (er) {}
          oudNieuw = true;
        }
      }
      wereld = G.maakWereld(zaad, { gen: 3, oud });
      for (const mk of makers) mk.poort.postMessage({ t: 'wereld', zaad, oud });
      actief = true; clearTimeout(tikker); lus();
      post({ t: 'gestart', opgeslagen: opgeslagen.size, oud: oud ? oud.length / 2 : 0, oudNieuw });
    } else if (m.t === 'overlay') {
      // bij samen spelen: de veranderingen van de server voor een paar stukken ([cx, cz, [plek, waarde, plek, waarde, ...]])
      for (const [cx, cz, a] of m.lijst) {
        const s = haal(cx, cz);
        for (let i = 0; i < a.length; i += 2) {
          const p = a[i], v = a[i + 1];
          if (s && s.d) zet(cx * 16 + (p & 15), p >> 8, cz * 16 + ((p >> 4) & 15), v); else overlayZet(sk(cx, cz), p, v);
        }
      }
      stuurVeranderingen();
    } else if (m.t === 'spelers') {
      // op de server: waar alle spelers zijn (de stukken daaromheen blijven geladen)
      centra = m.lijst.map(([x, z]) => [Math.floor(x) >> 4, Math.floor(z) >> 4]); if (m.straal) straal = m.straal;
    } else if (m.t === 'speler') {
      pX = m.x; pY = m.y; pZ = m.z; pcx = Math.floor(m.x) >> 4; pcz = Math.floor(m.z) >> 4; if (m.straal) straal = m.straal;
    } else if (m.t === 'zet') {
      const a = m.a;
      // bij samen spelen: een blok in een stuk dat (nog) niet geladen is, komt in de overlay
      for (let i = 0; i < a.length; i += 4) if (!zet(a[i], a[i + 1], a[i + 2], a[i + 3], true) && houdBij() && a[i + 1] >= 0 && a[i + 1] < HOOG && !stukVan(a[i], a[i + 2])) overlayZet(sk(a[i] >> 4, a[i + 2] >> 4), (a[i + 1] << 8) | ((a[i + 2] & 15) << 4) | (a[i] & 15), a[i + 3]);
      // meteen opnieuw vormen maken waar het blok veranderde, dan voelt het direct (op de server zijn er geen vormen)
      if (!opties.server) for (let i = 0; i < a.length; i += 4) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const s = stukVan(a[i] + dx, a[i + 2] + dz); if (s && s.vies && s.fase >= 3 && rondBuren(s, 2)) meshStuk(s); }
      stuurVeranderingen();
    } else if (m.t === 'bewaar') {
      const n = await bewaar(); post({ t: 'bewaard', n, id: m.id });
    } else if (m.t === 'stop') {
      await bewaar(); actief = false; clearTimeout(tikker); stukken.clear(); geladen.clear(); post({ t: 'gestopt', id: m.id });
    } else if (m.t === 'opties') {
      Object.assign(opties, m.opties || {}); if (m.straal) straal = m.straal;
      if (m.opnieuw) for (const s of stukken.values()) if (s.fase >= 3) { s.vies = 255; s.cache = null; }
    } else if (m.t === 'info') {
      let n = 0, f = [0, 0, 0, 0]; for (const s of stukken.values()) { n++; f[s.fase]++; }
      post({ t: 'info', id: m.id, stukken: n, fasen: f, water: waterTeller, plannen: volgende.size, opslaanWacht: teBewaren.size });
    } else if (m.t === 'water') {
      // test: water een aantal keer laten stromen
      for (let i = 0; i < (m.n || 1); i++) waterTik();
      stuurVeranderingen(); post({ t: 'water', id: m.id, n: waterTeller, plannen: volgende.size });
    } else if (m.t === 'toeval') {
      // test: de tijd voor groeien versnellen
      for (let i = 0; i < (m.n || 1); i++) willekeurig();
      stuurVeranderingen(); post({ t: 'toeval', id: m.id });
    } else if (m.t === 'lees') {
      const uit = []; for (let i = 0; i < m.a.length; i += 3) uit.push(get(m.a[i], m.a[i + 1], m.a[i + 2]));
      post({ t: 'lees', id: m.id, a: uit });
    }
  };
  // voor tests in Node
  return { overlay, overlayVies, waterTeller: () => waterTeller, get, zet, stukken, haal, belicht, zonVul, meshSectie, LG, waterTik, plan, ontvang, vraag, tik, opties, setSpeler: (x, z, r) => { pcx = x >> 4; pcz = z >> 4; if (r) straal = r; nodigVoor = ''; }, start: (z) => { zaad = z; wereld = G.maakWereld(z); actief = true; }, meshStuk, rondBuren };
}

// Grotruis voor de bergen, en de grottenstelsels per gebied van 64 x 64 blokken.
// Gedeelde code: draait op de pagina, in de rekenhulpjes en op de server (geen DOM).
import { CH, HOOG, ZEE } from '../maat.js';
import { mix } from '../ruis.js';
import { hsh, kans, rng } from '../toeval.js';
import { BI } from './biomen.js';

// wm: de werkplaats van één wereld (zaadje, ruis en wat de eerdere delen gemaakt hebben)
export function grotten(wm) {
  const {
    nBerg3, zaad, kolom,
  } = wm;

  // ---------- ruimtelijke grotruis op een grof raster, daarna tussen de punten in rekenen
  const GX = 5, GY = HOOG / 4 + 1; // punten om de 4 blokken
  const gA = new Float32Array(GX * GX * GY), gB = new Float32Array(GX * GX * GY), gC = new Float32Array(GX * GX * GY), gD = new Float32Array(GX * GX * GY), gE = new Float32Array(GX * GX * GY), gM = new Float32Array(GX * GX * GY);
  const gi = (x, y, z) => (y * GX + z) * GX + x;
  function rasterRuis(X0, Z0, metBerg) {
    for (let y = 0; y < GY; y++) for (let z = 0; z < GX; z++) for (let x = 0; x < GX; x++) {
      const X = X0 + x * 4, Y = y * 4, Z = Z0 + z * 4, i = gi(x, y, z);
      gM[i] = nBerg3.fbm3(X / 46, Y / 34, Z / 46, 2);
    }
  }
  function lees(g, fx, y, fz) {
    // fx, fz: 0..15 binnen het stuk; y: 0..HOOG-1
    const x = fx >> 2, z = fz >> 2, yy = y >> 2, tx = (fx & 3) / 4, tz = (fz & 3) / 4, ty = (y & 3) / 4;
    const a = gi(x, yy, z);
    const c00 = mix(g[a], g[a + 1], tx), c10 = mix(g[a + GX], g[a + GX + 1], tx), b = a + GX * GX;
    const c01 = mix(g[b], g[b + 1], tx), c11 = mix(g[b + GX], g[b + GX + 1], tx);
    return mix(mix(c00, c10, tz), mix(c01, c11, tz), ty);
  }

  // ---------- grottenstelsels
  // Per gebied van 64 x 64 blokken: een stelsel van kronkelende gangen vanuit één punt, met splitsingen,
  // doodlopende stukken, soms een zaal (soms met een meer), een gang naar de buren (zo hangt alles aan elkaar),
  // af en toe een ingang aan de oppervlakte en heel af en toe een ravijn. Alles komt uit het zaadje van het
  // gebied, dus elk stuk dat een gang raakt, graaft precies hetzelfde.
  // Een vorm is 10 getallen: [soort, graaf, ...]. soort 0 = ellipsoide [x, y, z, rx, ry, rz], 1 = kloof [x, -, z, halve breedte, bodem, top],
  // 2 = buis van punt [x1, y1, z1] naar [x2, y2, z2] met straal r (iets platter in de hoogte).
  // graaf 1 = gewone gang (blijft 5 blokken onder het oppervlak), 2 = open (mag door het oppervlak breken).
  const GB = 64, REIK = 3, MAXAF = 140, VS = 10, PLAT = 0.82, GROT = { ingang: 0.17, ravijn: 0.07, ravijnBoven: 0.03 };
  const gebieden = new Map();
  function gebied(gx, gz) {
    const sleutel = gx * 100003 + gz;
    let g = gebieden.get(sleutel);
    if (g) return g;
    // de oudste gebieden opruimen (houdt het geheugen per rekenhulpje klein)
    if (gebieden.size >= 160) { let n = 0; for (const k of gebieden.keys()) { gebieden.delete(k); if (++n >= 40) break; } }
    const r = rng(hsh(zaad, gx, gz, 7300));
    const vormen = [], meren = [], open = [];
    let ingangGemaakt = 0, ravijnSoort = 0;
    const vorm = (soort, graaf, a, b, c, d, e, f, q) => { vormen.push(soort, graaf, a, b, c, d, e, f, q || 0, 0); if (graaf === 2) open.push(soort, graaf, a, b, c, d, e, f, q || 0, 0); };
    // het beginpunt van het stelsel in dit gebied (de buren gebruiken dit om een verbindingsgang naartoe te graven)
    const oorsprong = gebiedPunt(gx, gz);
    const midX = (gx + 0.5) * GB, midZ = (gz + 0.5) * GB;
    // een gang: kronkelt door, splitst soms, en eindigt vanzelf (doodlopend) of bij een doel. Elke drie stapjes een buis.
    function gang(x, y, z, yaw, pitch, lengte, straal, diep, doel, graafTot) {
      const daal = pitch, kk = {};
      let dyaw = 0, dpitch = 0, open = (graafTot || 0) > 0;
      const fase = r() * 6.28, kronkel = 0.22 + r() * 0.22;
      let bx = x, by = y, bz = z, bgraaf = open ? 2 : 1, bstraal = 0, bn = 0;
      const buis = () => { if (bn) vorm(2, bgraaf, bx, by, bz, x, y, z, bstraal); bx = x; by = y; bz = z; bstraal = 0; bn = 0; };
      for (let i = 0; i < lengte; i++) {
        const t = i / lengte;
        let rr = straal * (0.78 + 0.3 * Math.sin(i * 0.11 + fase) + 0.12 * Math.sin(i * 0.37 + fase * 2));
        if (!doel && t > 0.8) rr *= 1 - (t - 0.8) * 2.2; // doodlopend: smaller naar het eind
        if (rr < 1.25) rr = 1.25;
        // nooit verder dan MAXAF van het midden van het gebied: dan blijft alles binnen het bereik dat elk stuk bekijkt
        if (Math.hypot(x - midX, z - midZ) > MAXAF) break;
        // een ingang blijft open (mag door het oppervlak) tot hij minstens 7 blokken diep zit; daarna een gewone gang
        if (open && i >= graafTot) { if (kolom(x, z, kk).h - y >= 7 || i > graafTot + 50) open = false; }
        const graaf = open ? 2 : 1;
        if (graaf !== bgraaf) { buis(); bgraaf = graaf; }
        if (rr > bstraal) bstraal = rr;
        dyaw = dyaw * 0.84 + (r() - 0.5) * kronkel; yaw += dyaw * 0.55;
        dpitch = dpitch * 0.8 + (r() - 0.5) * 0.1;
        // een ingang daalt eerst vast af (tot onder het oppervlak), daarna kronkelt hij gewoon verder
        if (i < (graafTot || 0)) pitch = daal + dpitch * 0.3; else if (open) pitch = -0.4 + dpitch * 0.3; else pitch = pitch * 0.9 + dpitch;
        if (doel && i >= (graafTot || 0)) {
          const dx = doel[0] - x, dz = doel[2] - z, af = Math.hypot(dx, dz);
          if (af < 3) break;
          let ver = Math.atan2(dx, dz) - yaw; ver -= Math.round(ver / 6.2832) * 6.2832;
          yaw += ver * 0.09; pitch += (Math.atan2(doel[1] - y, af) - pitch) * 0.08;
        }
        if (y < 9) pitch = Math.abs(pitch) + 0.05; else if (y > 66) pitch = -Math.abs(pitch) - 0.05;
        pitch = Math.max(-0.7, Math.min(0.7, pitch));
        const stap = Math.min(1.0, rr * 0.6);
        x += Math.sin(yaw) * Math.cos(pitch) * stap; z += Math.cos(yaw) * Math.cos(pitch) * stap; y += Math.sin(pitch) * stap;
        if (++bn >= 3) buis();
        // splitsen: een zijgang die een eigen kant op kronkelt
        if (diep < 3 && i > 6 && i < lengte - 6 && r() < 0.036) gang(x, y, z, yaw + (r() < 0.5 ? -1 : 1) * (0.7 + r() * 0.9), pitch * 0.5 + (r() - 0.5) * 0.4, Math.floor(lengte * (0.3 + r() * 0.35)), straal * (0.75 + r() * 0.2), diep + 1, null, 0);
      }
      buis();
      return [x, y, z];
    }
    for (let stelsel = 0; stelsel < 2; stelsel++) {
      if (r() > (stelsel === 0 ? 0.92 : 0.45)) continue;
      // het tweede stelsel ligt op een andere diepte en is met het eerste verbonden
      const [ox, oy, oz] = stelsel === 0 ? oorsprong : [gx * GB + 8 + r() * (GB - 16), 14 + r() * 40, gz * GB + 8 + r() * (GB - 16)];
      if (stelsel === 1) gang(ox, oy, oz, Math.atan2(oorsprong[0] - ox, oorsprong[2] - oz), 0, 160, 1.3 + r() * 0.4, 1, oorsprong, 0);
      // soms een zaal op het beginpunt, en in een diepe zaal soms een meer
      if (r() < 0.3) {
        const rx = 5 + r() * 6, ry = 3.2 + r() * 3, rz = 5 + r() * 6;
        vorm(0, 1, ox, oy, oz, rx, ry, rz);
        if (oy < 44 && oy > 16 && Math.min(rx, rz) > 6 && r() < 0.5) {
          const k = kolom(ox, oz, {});
          if (k.h - (oy + ry) > 10) meren.push(ox, oy, oz, rx, ry, rz, Math.floor(oy - ry * 0.25));
        }
      }
      const n = 3 + Math.floor(r() * 4);
      for (let i = 0; i < n; i++) gang(ox, oy, oz, r() * 6.2832, (r() - 0.5) * 0.5, 55 + Math.floor(r() * 90), 1.3 + r() * 0.8, 0, null, 0);
      // verbindingsgangen naar het stelsel van de buren (oost en zuid), zodat alles één netwerk wordt
      if (stelsel === 0) for (const [bx, bz] of [[1, 0], [0, 1]]) if (kans(zaad, gx * 2 + bx, gz * 2 + bz, 7301) < 0.8) {
        const d = gebiedPunt(gx + bx, gz + bz);
        gang(ox, oy, oz, Math.atan2(d[0] - ox, d[2] - oz), 0, 200, 1.1 + r() * 0.5, 1, d, 0);
      }
      // een ingang aan de oppervlakte: een opening in een heuvel, of een gat in de grond
      if (stelsel === 0 && r() < GROT.ingang) {
        for (let poging = 0; poging < 6; poging++) {
          const ix = gx * GB + 6 + r() * (GB - 12), iz = gz * GB + 6 + r() * (GB - 12), k = kolom(ix, iz, {});
          const h = k.h;
          if (h < ZEE + 4 || k.rf > 0.05 || k.b === BI.strand || k.moe > 0.3 || k.m > 0.6) continue;
          const hx = kolom(ix + 4, iz, {}).h - kolom(ix - 4, iz, {}).h, hz = kolom(ix, iz + 4, {}).h - kolom(ix, iz - 4, {}).h;
          const heuvel = Math.hypot(hx, hz) > 3.5;
          if (!heuvel && poging < 4) continue;
          ingangGemaakt = heuvel ? 2 : 1;
          // in een heuvel: op ooghoogte de helling in, zodat de opening in de helling zelf zit; anders een trechter met een schuine gang omlaag
          if (heuvel) gang(ix, h + 0.6, iz, Math.atan2(hx, hz), -0.07, 160, 1.7 + r() * 0.6, 1, oorsprong, 22);
          else { vorm(0, 2, ix, h - 0.5, iz, 2.8, 2.4, 2.8); gang(ix, h, iz, r() * 6.2832, -0.75, 160, 1.9 + r() * 0.6, 1, oorsprong, 18); }
          break;
        }
      }
    }
    // ravijnen: een lange, smalle, diepe kloof; heel af en toe breekt hij door het oppervlak
    const rv = r(), boven = rv < GROT.ravijnBoven;
    if (boven || rv < GROT.ravijn) {
      let x = gx * GB + r() * GB, z = gz * GB + r() * GB, yaw = r() * 6.2832, dyaw = 0;
      const lengte = 60 + Math.floor(r() * 60), w0 = (boven ? 2.6 : 1.8) + r() * 1.6, bodem = 12 + r() * 14, diepte = 18 + r() * 14;
      let ok = true;
      if (boven) { const k = kolom(x, z, {}); ok = k.h > ZEE + 3 && k.rf < 0.05 && k.m < 0.5; }
      if (ok) ravijnSoort = boven ? 2 : 1;
      if (ok) for (let i = 0; i < lengte; i++) {
        const t = i / lengte, w = w0 * (0.35 + 0.65 * Math.sin(Math.PI * t)) * (0.9 + 0.2 * Math.sin(i * 0.23));
        const top = boven ? kolom(x, z, {}).h + 3 : bodem + diepte * (0.6 + 0.4 * Math.sin(Math.PI * t));
        if (Math.hypot(x - midX, z - midZ) > MAXAF) break;
        vorm(1, boven ? 2 : 1, x, 0, z, w, bodem + (1 - Math.sin(Math.PI * t)) * 6, top);
        dyaw = dyaw * 0.9 + (r() - 0.5) * 0.06; yaw += dyaw;
        x += Math.sin(yaw); z += Math.cos(yaw);
      }
    }
    // per stuk van 16 x 16 een lijstje van de vormen die daar komen (dan hoeft een stuk alleen zijn eigen vormen te bekijken)
    const V = new Float32Array(vormen), emmers = new Map();
    for (let i = 0; i < V.length; i += VS) {
      const [xa, xb, za, zb] = vormVak(V, i);
      for (let cz = Math.floor(za / CH); cz <= Math.floor(zb / CH); cz++) for (let cx = Math.floor(xa / CH); cx <= Math.floor(xb / CH); cx++) {
        const k = cx * 100003 + cz; let e = emmers.get(k); if (!e) emmers.set(k, e = []); e.push(i);
      }
    }
    for (const [k, e] of emmers) emmers.set(k, Int32Array.from(e));
    g = { vormen: V, emmers, open: new Float32Array(open), meren, telling: { ingang: ingangGemaakt, ravijn: ravijnSoort } };
    gebieden.set(sleutel, g);
    return g;
  }
  // het vak (x en z) dat een vorm raakt
  function vormVak(V, i) {
    const s = V[i];
    if (s === 0) return [V[i + 2] - V[i + 5], V[i + 2] + V[i + 5], V[i + 4] - V[i + 7], V[i + 4] + V[i + 7]];
    if (s === 1) return [V[i + 2] - V[i + 5] - 1, V[i + 2] + V[i + 5] + 1, V[i + 4] - V[i + 5] - 1, V[i + 4] + V[i + 5] + 1];
    const rr = V[i + 8];
    return [Math.min(V[i + 2], V[i + 5]) - rr, Math.max(V[i + 2], V[i + 5]) + rr, Math.min(V[i + 4], V[i + 7]) - rr, Math.max(V[i + 4], V[i + 7]) + rr];
  }
  // het beginpunt van een stelsel (vast per gebied, ook als dat gebied nog niet is uitgerekend)
  function gebiedPunt(gx, gz) {
    const r = rng(hsh(zaad, gx, gz, 7302));
    return [gx * GB + 8 + r() * (GB - 16), 12 + Math.pow(r(), 1.3) * 42, gz * GB + 8 + r() * (GB - 16)];
  }
  // één vorm uitgraven in het masker van een stuk
  function graafVorm(m, V, i, X0, Z0) {
    const soort = V[i], graaf = V[i + 1], X1 = X0 + CH, Z1 = Z0 + CH;
    if (soort === 0) {
      const x = V[i + 2], y = V[i + 3], z = V[i + 4], a = V[i + 5], b = V[i + 6], c = V[i + 7];
      const xa = Math.max(X0, Math.ceil(x - a - 0.5)), xb = Math.min(X1 - 1, Math.floor(x + a)), za = Math.max(Z0, Math.ceil(z - c - 0.5)), zb = Math.min(Z1 - 1, Math.floor(z + c));
      const ya = Math.max(1, Math.ceil(y - b - 0.5)), yb = Math.min(HOOG - 2, Math.floor(y + b));
      const ia = 1 / (a * a), ib = 1 / (b * b), ic = 1 / (c * c);
      for (let Y = ya; Y <= yb; Y++) { const dy = (Y + 0.5 - y) * (Y + 0.5 - y) * ib; if (dy > 1) continue;
        for (let Z = za; Z <= zb; Z++) { const dz = (Z + 0.5 - z) * (Z + 0.5 - z) * ic + dy; if (dz > 1) continue;
          for (let X = xa; X <= xb; X++) { if ((X + 0.5 - x) * (X + 0.5 - x) * ia + dz > 1) continue; const j = (Y << 8) | ((Z - Z0) << 4) | (X - X0); if (m[j] < graaf) m[j] = graaf; } } }
    } else if (soort === 1) {
      const x = V[i + 2], z = V[i + 4], a = V[i + 5], b = V[i + 6], c = V[i + 7];
      const ya = Math.max(1, Math.floor(b)), yb = Math.min(HOOG - 2, Math.floor(c));
      for (let Y = ya; Y <= yb; Y++) {
        const u = (Y - b) / Math.max(1, c - b), prof = Math.min(1, Math.sqrt(Math.max(0, u) / 0.16)) * (1 - 0.18 * u);
        const w = a * prof * (1 + 0.16 * Math.sin(Y * 0.9 + x * 0.21)); if (w < 0.5) continue;
        const xa = Math.max(X0, Math.ceil(x - w - 0.5)), xb = Math.min(X1 - 1, Math.floor(x + w)), za = Math.max(Z0, Math.ceil(z - w - 0.5)), zb = Math.min(Z1 - 1, Math.floor(z + w));
        const w2 = w * w;
        for (let Z = za; Z <= zb; Z++) for (let X = xa; X <= xb; X++) { if ((X + 0.5 - x) * (X + 0.5 - x) + (Z + 0.5 - z) * (Z + 0.5 - z) > w2) continue; const j = (Y << 8) | ((Z - Z0) << 4) | (X - X0); if (m[j] < graaf) m[j] = graaf; }
      }
    } else {
      // buis: afstand tot het lijnstuk, met de hoogte een beetje uitgerekt zodat de gang lager dan breed is
      const ax = V[i + 2], ay = V[i + 3] / PLAT, az = V[i + 4], bx = V[i + 5], by = V[i + 6] / PLAT, bz = V[i + 7], rr = V[i + 8], r2 = rr * rr;
      const dx = bx - ax, dy = by - ay, dz = bz - az, ll = dx * dx + dy * dy + dz * dz || 1e-6;
      const xa = Math.max(X0, Math.ceil(Math.min(ax, bx) - rr - 0.5)), xb = Math.min(X1 - 1, Math.floor(Math.max(ax, bx) + rr));
      const za = Math.max(Z0, Math.ceil(Math.min(az, bz) - rr - 0.5)), zb = Math.min(Z1 - 1, Math.floor(Math.max(az, bz) + rr));
      const ya = Math.max(1, Math.ceil((Math.min(ay, by) - rr) * PLAT - 0.5)), yb = Math.min(HOOG - 2, Math.floor((Math.max(ay, by) + rr) * PLAT));
      for (let Y = ya; Y <= yb; Y++) { const py = (Y + 0.5) / PLAT - ay;
        for (let Z = za; Z <= zb; Z++) { const pz = Z + 0.5 - az;
          for (let X = xa; X <= xb; X++) {
            const px = X + 0.5 - ax; let t = (px * dx + py * dy + pz * dz) / ll; t = t < 0 ? 0 : t > 1 ? 1 : t;
            const qx = px - dx * t, qy = py - dy * t, qz = pz - dz * t;
            if (qx * qx + qy * qy + qz * qz > r2) continue;
            const j = (Y << 8) | ((Z - Z0) << 4) | (X - X0); if (m[j] < graaf) m[j] = graaf;
          } } }
    }
  }
  // graaf de grotten van één stuk uit in een masker: 1 gang, 2 open naar boven, 3 meerwater, 4 vaste meeroever
  const MASKER = new Uint8Array(CH * CH * HOOG);
  function graafGrotten(cx, cz) {
    const m = MASKER; m.fill(0);
    const X0 = cx * CH, Z0 = cz * CH, X1 = X0 + CH, Z1 = Z0 + CH, sleutel = cx * 100003 + cz;
    const ga = Math.floor(X0 / GB), gb = Math.floor(Z0 / GB), meren = [];
    for (let gz = gb - REIK; gz <= gb + REIK; gz++) for (let gx = ga - REIK; gx <= ga + REIK; gx++) {
      const g = gebied(gx, gz), e = g.emmers.get(sleutel);
      if (e) for (let k = 0; k < e.length; k++) graafVorm(m, g.vormen, e[k], X0, Z0);
      for (let i = 0; i < g.meren.length; i += 7) { const x = g.meren[i], z = g.meren[i + 2], rx = g.meren[i + 3] + 3, rz = g.meren[i + 5] + 3; if (x + rx >= X0 && x - rx < X1 && z + rz >= Z0 && z - rz < Z1) meren.push(g.meren.slice(i, i + 7)); }
    }
    // meren: eerst een vaste oever (2 blokken dik, tot het waterniveau), dan het water zelf. Zo loopt er nooit water weg.
    for (const [x, y, z, rx, ry, rz, L] of meren) for (let pas = 0; pas < 2; pas++) {
      const e = pas === 0 ? 2.2 : 0, ia = 1 / ((rx + e) * (rx + e)), ib = 1 / ((ry + e) * (ry + e)), ic = 1 / ((rz + e) * (rz + e));
      for (let Y = Math.max(1, Math.floor(y - ry - e)); Y <= Math.min(L, HOOG - 2); Y++) for (let Z = Math.max(Z0, Math.floor(z - rz - e)); Z < Math.min(Z1, z + rz + e + 1); Z++) for (let X = Math.max(X0, Math.floor(x - rx - e)); X < Math.min(X1, x + rx + e + 1); X++) {
        const q = (X + 0.5 - x) * (X + 0.5 - x) * ia + (Y + 0.5 - y) * (Y + 0.5 - y) * ib + (Z + 0.5 - z) * (Z + 0.5 - z) * ic; if (q > 1) continue;
        const j = (Y << 8) | ((Z - Z0) << 4) | (X - X0);
        m[j] = pas === 0 ? 4 : 3;
      }
    }
    return m;
  }
  // ligt het oppervlak hier open door een ingang of ravijn? (voor bomen: alleen de kolom telt, net als elders)
  function openBoven(X, Z, h) {
    const ga = Math.floor(X / GB), gb = Math.floor(Z / GB), px = X + 0.5, pz = Z + 0.5;
    for (let gz = gb - REIK; gz <= gb + REIK; gz++) for (let gx = ga - REIK; gx <= ga + REIK; gx++) {
      const v = gebied(gx, gz).open;
      for (let i = 0; i < v.length; i += VS) {
        const s = v[i];
        if (s === 0) { const q = (px - v[i + 2]) ** 2 / (v[i + 5] ** 2) + (pz - v[i + 4]) ** 2 / (v[i + 7] ** 2); if (q < 1.6 && Math.abs(h - v[i + 3]) < v[i + 6] + 3) return true; }
        else if (s === 1) { if ((px - v[i + 2]) ** 2 + (pz - v[i + 4]) ** 2 < (v[i + 5] + 2) ** 2 && h < v[i + 7] + 1) return true; }
        else {
          // afstand (van boven gezien) tot de buis
          const ax = v[i + 2], az = v[i + 4], dx = v[i + 5] - ax, dz = v[i + 7] - az, ll = dx * dx + dz * dz || 1e-6;
          let t = ((px - ax) * dx + (pz - az) * dz) / ll; t = t < 0 ? 0 : t > 1 ? 1 : t;
          const qx = px - ax - dx * t, qz = pz - az - dz * t, rr = v[i + 8] + 1.2, yy = v[i + 3] + (v[i + 6] - v[i + 3]) * t;
          if (qx * qx + qz * qz < rr * rr && Math.abs(h - yy) < v[i + 8] + 3) return true;
        }
      }
    }
    return false;
  }

  Object.assign(wm, {
    GX, GY, gA, gB, gC, gD, gE, gM, gi, rasterRuis, lees, GB, REIK, MAXAF, VS, PLAT, GROT, gebieden, gebied,
    vormVak, gebiedPunt, graafVorm, MASKER, graafGrotten, openBoven,
  });
}

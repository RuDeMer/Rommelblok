// De vorm van het water: water dat over een trap stroomt moet één doorlopende laag zijn.
// Voor elke opstelling: water laten uitstromen, de watervlakken maken zoals de wereldbaas dat doet, en dan nakijken:
// - elk waterblok naast lucht (of naast een plek waar het water lager verder gaat) heeft daar een zijkant,
//   van zijn eigen oppervlak tot de bodem van het blok, of tot het oppervlak van het lagere water ernaast;
// - de hoeken van buren liggen op dezelfde hoogte (het oppervlak is één doorlopend vlak);
// - een hoek zakt alleen naar beneden aan een echte oever (naast droge grond), nooit boven een trede;
// - tussen twee waterblokken zit nooit een vlak (geen dubbele vlakken in het doorzichtige water).
// node test/water_vorm.js [uitleg]   (met 'uitleg' ook een doorsnede van elke trap)
const L = require('./laad'); const G = L.gedeeld(); const RB_WERELD = L.laad('werker.js', 'RB_WERELD');
const { B, W, VAST, DICHT } = G;
const UITLEG = process.argv.includes('uitleg');
let fouten = 0; const ok = (b, t) => { console.log((b ? 'goed ' : 'FOUT ') + t); if (!b) fouten++; };

// een lege testwereld met stukken uit een functie top(x, z) (steen tot en met die hoogte)
function testWereld(top, r = 2) {
  const Wb = RB_WERELD(G, { postMessage: () => {} }); Wb.start(1); Wb.setSpeler(0, 0, r);
  for (let cz = -r; cz <= r; cz++) for (let cx = -r; cx <= r; cx++) {
    const d = new Uint16Array(G.VOL);
    for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) { const t = top(cx * 16 + lx, cz * 16 + lz); for (let y = 0; y <= t; y++) d[(y << 8) | (lz << 4) | lx] = y === 0 ? B.bodemsteen : B.steen; }
    const s = { k: (cx + 32768) * 65536 + (cz + 32768), cx, cz, d, l: null, b: new Uint8Array(256), kl: new Uint16Array(768), fase: 1, vies: 0, gewijzigd: false, cache: null };
    Wb.stukken.set(s.k, s); Wb.zonVul(s);
  }
  for (const s of Wb.stukken.values()) { Wb.belicht(s); s.fase = 3; }
  return Wb;
}
const isW = v => v > 0 && (v & 255) === W;
const dekt = v => v > 0 && (DICHT[v & 255] || (v & 255) === B.ijs); // een buur waar geen zijkant tegenaan hoeft
const vast = v => v < 0 || (v > 0 && VAST[v & 255]);

// alle watervlakken in een gebied, in wereldcoördinaten (hoogtes in zestienden)
function watervlakken(Wb, x0, x1, z0, z1, y0, y1) {
  const vlakken = [];
  for (let cz = z0 >> 4; cz <= z1 >> 4; cz++) for (let cx = x0 >> 4; cx <= x1 >> 4; cx++) {
    const s = Wb.haal(cx, cz); if (!s) continue;
    for (let sy = y0 >> 4; sy <= y1 >> 4; sy++) {
      Wb.meshSectie(s, sy);
      const Lw = Wb.LG[2], a = Lw.a;
      for (let i = 0; i < Lw.n; i += 8) {
        const h = [];
        for (let j = 0; j < 4; j++) { const w0 = a[i + j * 2]; h.push([cx * 16 * 16 + ((w0 & 511) - 16), (w0 >> 18) & 2047, cz * 16 * 16 + (((w0 >> 9) & 511) - 16)]); }
        vlakken.push({ n: a[i] >>> 29, h });
      }
    }
  }
  return vlakken;
}

function nakijken(naam, Wb, gebied) {
  const [x0, x1, z0, z1, y0, y1] = gebied;
  const vlakken = watervlakken(Wb, x0, x1, z0, z1, y0, y1);
  // bovenkanten per vakje, zijkanten per vlak tussen twee vakjes
  const boven = new Map(), zij = new Map(), onder = new Map();
  const sleutel = (x, y, z) => x + ',' + y + ',' + z;
  for (const v of vlakken) {
    const xs = v.h.map(p => p[0]), ys = v.h.map(p => p[1]), zs = v.h.map(p => p[2]);
    const mx = Math.min(...xs) / 16, mz = Math.min(...zs) / 16;
    if (v.n === 2) {
      const y = Math.ceil(Math.max(...ys) / 16) - 1, hoek = {};
      for (const p of v.h) hoek[(p[0] / 16 - mx) + '' + (p[2] / 16 - mz)] = p[1] - y * 16;
      const k = sleutel(mx, y, mz); if (boven.has(k)) boven.get(k).dubbel = true; else boven.set(k, hoek);
    } else if (v.n === 3) onder.set(sleutel(mx, Math.min(...ys) / 16, mz), true);
    else {
      // zijkant: het vlak ligt op x (richting 0/1) of op z (richting 4/5); per hoekpunt de laagste en hoogste hoogte
      const opX = v.n < 2, vlak = opX ? xs[0] / 16 : zs[0] / 16, langs = opX ? mz : mx;
      const per = {};
      for (const p of v.h) { const t = (opX ? p[2] : p[0]) / 16 - langs; (per[t] = per[t] || []).push(p[1]); }
      const laag = { 0: Math.min(...per[0]), 1: Math.min(...per[1]) }, hoog = { 0: Math.max(...per[0]), 1: Math.max(...per[1]) };
      const k = v.n + ':' + vlak + ',' + langs;
      if (!zij.has(k)) zij.set(k, []);
      zij.get(k).push({ laag, hoog, y: Math.ceil(Math.max(hoog[0], hoog[1]) / 16) - 1 }); // het vakje waar de zijkant bij hoort: daar ligt zijn bovenrand
    }
  }
  const tel = { cellen: 0, oppervlak: 0, zijMist: 0, zijHoogte: 0, zijTeHoog: 0, sluitNiet: 0, waterWater: 0, dubbel: 0, hoekZakt: 0, hoekenNiet: 0, gordijn: 0 };
  const eerste = {}; const meld = (wat, t) => { tel[wat]++; if (!eerste[wat]) eerste[wat] = t; };
  // hoekhoogtes per rasterpunt per laag: alle bovenkanten die daar samenkomen moeten gelijk zijn
  const punt = new Map();
  for (const [k, hoek] of boven) {
    const [x, y, z] = k.split(',').map(Number);
    if (hoek.dubbel) meld('dubbel', k);
    for (const hk of ['00', '10', '01', '11']) { const pk = sleutel(x + +hk[0], y, z + +hk[1]); const l = punt.get(pk) || []; l.push(hoek[hk]); punt.set(pk, l); }
  }
  for (const [pk, l] of punt) if (Math.max(...l) !== Math.min(...l)) meld('hoekenNiet', pk + ' ' + l.join('/'));
  const RICHT = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]], NR = [0, 1, 4, 5];
  for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
    const v = Wb.get(x, y, z); if (!isW(v)) continue;
    tel.cellen++;
    const bovenW = isW(Wb.get(x, y + 1, z)), hoek = boven.get(sleutel(x, y, z));
    if (bovenW && hoek) meld('waterWater', 'bovenkant onder water ' + sleutel(x, y, z));
    if (isW(Wb.get(x, y - 1, z)) && onder.has(sleutel(x, y, z))) meld('waterWater', 'onderkant op water ' + sleutel(x, y, z));
    if (!bovenW && !dekt(Wb.get(x, y + 1, z)) && !hoek) { meld('zijMist', 'geen bovenkant ' + sleutel(x, y, z)); continue; }
    if (hoek) tel.oppervlak++;
    // een hoek zakt alleen omlaag als er naast droge grond (iets wat geen water en niet vast is, met iets vasts eronder) ligt
    if (hoek) for (const hk of ['00', '10', '01', '11']) {
      const px = x + +hk[0], pz = z + +hk[1]; let oever = false, minW = 99;
      for (const [ax, az] of [[px - 1, pz - 1], [px, pz - 1], [px - 1, pz], [px, pz]]) {
        const n = Wb.get(ax, y, az);
        if (isW(n)) { minW = Math.min(minW, isW(Wb.get(ax, y + 1, az)) ? 16 : [14, 12, 11, 9, 7, 5, 4, 2][(n >> 8) & 7]); }
        else if (!vast(n) && vast(Wb.get(ax, y - 1, az))) oever = true;
      }
      if (!oever && hoek[hk] < 16 && hoek[hk] < minW) meld('hoekZakt', sleutel(px, y, pz) + ' zakt naar ' + hoek[hk] + ' (water eromheen minstens ' + minW + ')');
    }
    // de hoogtes van de rand aan elke kant (zestienden boven de bodem van het vakje)
    const rand = (r) => {
      if (bovenW) return [16, 16];
      if (!hoek) return [16, 16];
      return r === 0 ? [hoek['10'], hoek['11']] : r === 1 ? [hoek['00'], hoek['01']] : r === 2 ? [hoek['01'], hoek['11']] : [hoek['00'], hoek['10']];
    };
    for (let r = 0; r < 4; r++) {
      const [dx, , dz] = RICHT[r], n = Wb.get(x + dx, y, z + dz), opX = r < 2;
      const vlak = opX ? x + (dx > 0 ? 1 : 0) : z + (dz > 0 ? 1 : 0), langs = opX ? z : x;
      const hier = (zij.get(NR[r] + ':' + vlak + ',' + langs) || []).filter(f => f.y === y);
      if (isW(n)) { if (hier.length) meld('waterWater', 'zijkant tussen water ' + sleutel(x, y, z) + ' r' + r); continue; }
      if (dekt(n)) continue;
      const [ra, rb] = rand(r);
      if (ra === 0 && rb === 0) continue; // aan een oever die helemaal naar de grond zakt is geen zijkant nodig
      if (!hier.length) { meld('zijMist', sleutel(x, y, z) + ' r' + r); continue; }
      // de zijkant moet tot het oppervlak van het vakje komen, en naar beneden tot de bodem (of het lagere water ernaast)
      const f = hier.reduce((a, b) => (b.hoog[0] + b.hoog[1] > a.hoog[0] + a.hoog[1] ? b : a));
      if (f.hoog[0] !== y * 16 + ra || f.hoog[1] !== y * 16 + rb) meld('zijHoogte', sleutel(x, y, z) + ' r' + r + ' boven ' + (f.hoog[0] - y * 16) + '/' + (f.hoog[1] - y * 16) + ' moet ' + ra + '/' + rb);
      const laagste = [Math.min(...hier.map(h => h.laag[0])), Math.min(...hier.map(h => h.laag[1]))];
      if (laagste[0] > y * 16 || laagste[1] > y * 16) meld('zijHoogte', sleutel(x, y, z) + ' r' + r + ' komt niet tot de bodem');
      // gaat het water daarnaast lager verder? dan sluit de zijkant aan op dat lagere oppervlak (één doorlopende laag)
      const ol = Wb.get(x + dx, y - 1, z + dz);
      if (isW(ol)) {
        tel.gordijn++;
        const ho = boven.get(sleutel(x + dx, y - 1, z + dz));
        if (ho) {
          // de rand van het lagere vakje aan onze kant
          const kant = r === 0 ? ['00', '01'] : r === 1 ? ['10', '11'] : r === 2 ? ['00', '10'] : ['01', '11'];
          const doel = kant.map(k => (y - 1) * 16 + ho[k]);
          if (laagste[0] !== Math.min(doel[0], y * 16) || laagste[1] !== Math.min(doel[1], y * 16)) meld('sluitNiet', sleutel(x, y, z) + ' r' + r + ' zijkant tot ' + (laagste[0] - y * 16) + '/' + (laagste[1] - y * 16) + ', lager water op ' + (doel[0] - y * 16) + '/' + (doel[1] - y * 16));
        }
      }
    }
  }
  const goed = !tel.zijMist && !tel.zijHoogte && !tel.sluitNiet && !tel.waterWater && !tel.dubbel && !tel.hoekZakt && !tel.hoekenNiet;
  ok(goed && tel.oppervlak > 0, `${naam}: ${tel.cellen} waterblokken, ${tel.oppervlak} met een bovenkant, ${tel.gordijn} randen waar het water lager verder gaat; ` +
    `zijkant mist ${tel.zijMist}, zijkant te kort ${tel.zijHoogte}, sluit niet aan op lager water ${tel.sluitNiet}, hoeken van buren niet gelijk ${tel.hoekenNiet}, hoek zakt naar nul ${tel.hoekZakt}, vlak tussen water ${tel.waterWater + tel.dubbel}`);
  if (!goed) for (const [wat, t] of Object.entries(eerste)) console.log('      eerste ' + wat + ': ' + t);
  return tel;
}

const lv = v => (isW(v) ? ((v >> 8) & 8 ? 'v' : String((v >> 8) & 7)) : v === 0 ? '.' : '#');
function doorsnede(Wb, y0, y1, x0, x1, z) {
  if (!UITLEG) return;
  for (let y = y1; y >= y0; y--) { let r = String(y).padStart(4) + ' '; for (let x = x0; x <= x1; x++) r += lv(Wb.get(x, y, z)); console.log(r); }
}
const T = 40;
// 1. een rechte trap van 8 treden, 5 breed, met muurtjes opzij; een rij bronnen bovenaan
{
  const Wb = testWereld((x, z) => (z < -2 || z > 2) ? T + 3 : x <= 0 ? T : x <= 8 ? T - x : T - 9);
  for (let z = -2; z <= 2; z++) Wb.zet(-1, T + 1, z, W);
  for (let i = 0; i < 200; i++) Wb.waterTik();
  doorsnede(Wb, T - 10, T + 2, -2, 12, 0);
  nakijken('rechte trap van 8 treden, 5 breed, tussen muurtjes', Wb, [-3, 14, -3, 3, T - 11, T + 3]);
}
// 2. een brede helling met 8 treden en één bron bovenaan: het water vindt zelf zijn weg, smal, met droge treden ernaast
{
  const Wb = testWereld((x, z) => x <= 0 ? T : x <= 8 ? T - x : T - 9);
  Wb.zet(-1, T + 1, 0, W);
  for (let i = 0; i < 200; i++) Wb.waterTik();
  doorsnede(Wb, T - 10, T + 2, -2, 12, 0);
  nakijken('brede helling van 8 treden, één bron', Wb, [-9, 18, -9, 9, T - 11, T + 3]);
}
// 3. een schuine trap: elke trede is een hoek (naar voren en opzij tegelijk), bron in de hoek
{
  const Wb = testWereld((x, z) => (x < 0 || z < 0) ? T : Math.max(T - 9, T - Math.max(x, z)));
  Wb.zet(0, T + 1, 0, W);
  for (let i = 0; i < 200; i++) Wb.waterTik();
  nakijken('schuine trap van 8 treden, bron in de hoek', Wb, [-8, 18, -8, 18, T - 11, T + 3]);
}
// 4. een trap met treden van twee hoog en een lange trede halverwege
{
  const top = x => x <= 0 ? T : x <= 3 ? T - 2 * x : x <= 7 ? T - 6 : x <= 10 ? T - 6 - 2 * (x - 7) : T - 12;
  const Wb = testWereld((x, z) => (z < -1 || z > 1) ? T + 3 : top(x));
  for (let z = -1; z <= 1; z++) Wb.zet(-1, T + 1, z, W);
  for (let i = 0; i < 300; i++) Wb.waterTik();
  doorsnede(Wb, T - 13, T + 2, -2, 14, 0);
  nakijken('trap met treden van twee hoog', Wb, [-3, 16, -2, 2, T - 14, T + 3]);
}
// 5. een echte helling uit een wereld (zaadje 12345): water uit een emmer bovenop een heuvel
{
  const zaad = G.zaadVan('12345'), Wb = RB_WERELD(G, { postMessage: () => {} });
  Wb.start(zaad); Wb.setSpeler(0, 0, 3); for (let i = 0; i < 1500; i++) Wb.tik();
  const hoogte = (x, z) => { for (let y = 120; y > 0; y--) { const v = Wb.get(x, y, z); if (vast(v) || isW(v)) return isW(v) ? -1 : y; } return -1; };
  // de steilste plek met kleine treetjes: 6 tot 12 lager over 8 blokken, zonder sprongen van meer dan 2
  let best = null;
  for (let z = -40; z <= 40; z++) for (let x = -40; x <= 40; x++) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const h = []; for (let t = 0; t <= 8; t++) h.push(hoogte(x + dx * t, z + dz * t));
    if (h.includes(-1)) continue;
    let goed = true; for (let t = 1; t <= 8; t++) { const d = h[t - 1] - h[t]; if (d < 0 || d > 3) goed = false; }
    const val = h[0] - h[8];
    if (goed && val >= 5 && val <= 14 && (!best || val > best.val)) best = { x, z, y: h[0], val };
  }
  ok(!!best, 'een helling gevonden in de echte wereld' + (best ? ` bij ${best.x}, ${best.y}, ${best.z} (${best.val} lager over 8 blokken)` : ''));
  if (best) {
    Wb.zet(best.x, best.y + 1, best.z, W);
    for (let i = 0; i < 300; i++) Wb.waterTik();
    nakijken('echte helling (zaadje 12345)', Wb, [best.x - 14, best.x + 14, best.z - 14, best.z + 14, best.y - 20, best.y + 2]);
  }
}
console.log(fouten ? fouten + ' FOUTEN' : 'het water ligt overal als één doorlopende laag');
process.exit(fouten ? 1 : 0);

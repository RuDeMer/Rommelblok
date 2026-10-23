// ============================================================================
// Dieren en griezels (stap 4): hier komen ze tevoorschijn, worden ze getekend, en kun je ze raken, melken of scheren.
// Wat ze denken en hoe ze bewegen staat in shared/wezens.js (precies zo straks op de server).
// - Vriendelijke dieren horen bij de wereld: elk stuk heeft voor een zaadje een vast kuddetje, dat tevoorschijn komt
//   als je er voor het eerst in de buurt komt (WD.dierVak onthoudt welke stukken al geweest zijn). Ze worden bewaard
//   in WD.dieren. Ze doen nooit iemand pijn; jij kunt ze wel pijn doen, en dan rennen ze weg.
// - Griezels (spookjes, grotkwallen, braambollen) komen alleen in overleven, in het donker, en niet bij 'vredig'.
//   Ze worden niet bewaard.
// ============================================================================
const WZ = G.WEZENS, SOORT = WZ.WEZENS;
const WZ_MAX = telefoon ? { griezels: 4, teken: 28, actief: 40, stukken: 2 } : { griezels: 8, teken: 44, actief: 56, stukken: 3 };
let griezels = [], actief = [], doelWezen = null, wzKlok = 0, wzSpawnKlok = 0;
const wzLicht = (x, y, z) => (kopie.has(sk(x >> 4, z >> 4)) ? lichtOp(x, y, z) : -1);
const wzW = { blok: blokOp, licht: wzLicht, biome: biomeOp, tijd: 0.5, spelers: [], r: Math.random, moeilijk: 'makkelijk' };
const moeilijkNu = () => (WD && WZ.MOEILIJK[WD.moeilijk] ? WD.moeilijk : 'makkelijk');
// een dier zoals het bewaard wordt (alleen wat nodig is om verder te gaan)
const rond2 = v => Math.round(v * 100) / 100;
function dierData(w) { const d = { n: w.n, s: w.s, x: rond2(w.x), y: rond2(w.y), z: rond2(w.z), yaw: rond2(w.yaw), hp: w.hp }; if (w.kaal) d.kaal = Math.round(w.kaal); if (w.ei) d.ei = Math.round(w.ei); if (w.v) d.v = w.v; return d; }
function schoonDier(d) {
  const getal = (v, dflt) => (typeof v === 'number' && isFinite(v) ? v : dflt);
  if (!d || !Number.isInteger(d.n) || d.n <= 0 || !Number.isInteger(d.s) || !SOORT[d.s] || !SOORT[d.s].vriend) return null;
  if (![d.x, d.y, d.z].every(v => typeof v === 'number' && isFinite(v)) || Math.abs(d.x) > 3e7 || Math.abs(d.z) > 3e7 || d.y < 0 || d.y > 130) return null;
  const w = WZ.nieuwWezen(d.s, d.x, d.y, d.z, getal(d.yaw, 0), d.n);
  w.hp = klem(Math.round(getal(d.hp, SOORT[d.s].hp)), 1, SOORT[d.s].hp);
  if (getal(d.kaal, 0) > 0) w.kaal = Math.min(600, d.kaal);
  if (getal(d.ei, 0) > 0) w.ei = Math.min(600, d.ei);
  if (Number.isInteger(d.v) && d.v >= 0 && d.v < 4) w.v = d.v;
  return w;
}
// bij het openen van een wereld
function wezensLaden() {
  griezels = []; actief = []; doelWezen = null; wzKlok = 0; wzSpawnKlok = 0;
  WD.dieren = (Array.isArray(WD.dieren) ? WD.dieren : []).map(schoonDier).filter(Boolean);
  WD.dierVak = WD.dierVak && typeof WD.dierVak === 'object' ? WD.dierVak : {};
  if (!WZ.MOEILIJK[WD.moeilijk]) WD.moeilijk = 'makkelijk';
  for (const w of WD.dieren) WZ.zetTeller(w.n);
}
// ---------------- welke stukken al een kuddetje hebben gehad: per vak van 8 x 8 stukken twee getallen van 32 bits
function stukGeweest(cx, cz) { const k = (cx >> 3) + ',' + (cz >> 3), i = ((cz & 7) << 3) | (cx & 7), v = WD.dierVak[k]; return !!v && ((v[i >> 5] >>> (i & 31)) & 1) === 1; }
function stukMerk(cx, cz) { const k = (cx >> 3) + ',' + (cz >> 3), i = ((cz & 7) << 3) | (cx & 7), v = WD.dierVak[k] || (WD.dierVak[k] = [0, 0]); v[i >> 5] = (v[i >> 5] | (1 << (i & 31))) >>> 0; }
// de bovenkant van de grond in een kolom (bladeren en planten tellen niet mee)
function wzKolom(x, z) {
  for (let y = HOOG - 1; y > 0; y--) {
    const v = blokOp(x, y, z); if (v < 0) return null; if (!v) continue;
    const id = v & 255;
    if (id === G.W) return { y, blok: id, water: true, biome: biomeOp(x, z) };
    if (!G.VAST[id] || BL[id].sleutel.startsWith('blad_')) continue;
    return { y, blok: id, water: false, biome: biomeOp(x, z) };
  }
  return null;
}
// ---------------- elk beeldje
function wezensTik(dt) {
  if (!WD || !wereldKlaar || !WD.dieren) return;
  const overleven = wereldStand() !== 'bouwen', m = moeilijkNu();
  wzW.tijd = WD.tijd; wzW.moeilijk = m;
  wzW.spelers = overleven && WD.speler.hp > 0 ? [{ id: 'ik', x: sp.x, y: sp.y, z: sp.z }] : [];
  // een paar keer per seconde: nieuwe kuddetjes, wie er meedoet, en griezels erbij of eraf
  wzKlok -= dt;
  if (wzKlok <= 0) {
    wzKlok = 0.5;
    const pcx = Math.floor(sp.x) >> 4, pcz = Math.floor(sp.z) >> 4, R = WZ_MAX.stukken;
    for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
      const cx = pcx + dx, cz = pcz + dz;
      if (!kopie.has(sk(cx, cz)) || stukGeweest(cx, cz)) continue;
      // de buren moeten er ook zijn (een kuddetje aan de rand van het geladen stuk kan anders in het niets lopen)
      if (!kopie.has(sk(cx + 1, cz)) || !kopie.has(sk(cx - 1, cz)) || !kopie.has(sk(cx, cz + 1)) || !kopie.has(sk(cx, cz - 1))) continue;
      stukMerk(cx, cz);
      if (WD.dieren.length >= 6000) continue;
      for (const d of WZ.stukDieren(WD.zaad, cx, cz, wzKolom)) {
        const w = WZ.nieuwWezen(d.s, d.x, d.y, d.z, d.yaw);
        const bi = biomeOp(Math.floor(d.x), Math.floor(d.z));
        // konijnen in de sneeuw zijn wit, in de woestijn zandkleurig
        if (SOORT[d.s].sleutel === 'konijn') w.v = bi === G.BI.sneeuwvlakte ? 1 : bi === G.BI.woestijn ? 2 : 0;
        if (SOORT[d.s].sleutel === 'hert') w.v = (w.n % 3 === 0) ? 1 : 0; // sommige herten hebben een gewei
        WD.dieren.push(w);
      }
    }
    // wie er meedoet: in de buurt, en in een geladen stuk
    const A = WZ_MAX.actief * WZ_MAX.actief;
    actief = WD.dieren.filter(w => { const ax = w.x - sp.x, az = w.z - sp.z; return ax * ax + az * az < A && blokOp(Math.floor(w.x), Math.floor(w.y), Math.floor(w.z)) >= 0; });
    // griezels weg: te ver, of het is dag geworden
    for (let i = griezels.length - 1; i >= 0; i--) {
      const w = griezels[i], ax = w.x - sp.x, az = w.z - sp.z;
      if (!overleven || m === 'vredig' || ax * ax + az * az > 64 * 64 || blokOp(Math.floor(w.x), Math.floor(w.y), Math.floor(w.z)) < 0) { griezels.splice(i, 1); continue; }
      if (WZ.verdwijnt(w, wzW)) { poef(w); griezels.splice(i, 1); }
    }
    // griezels erbij
    wzSpawnKlok -= 0.5;
    const max = Math.round(WZ_MAX.griezels * WZ.MOEILIJK[m].griezels);
    if (overleven && wzSpawnKlok <= 0 && griezels.length < max) { wzSpawnKlok = 1.5; griezelErbij(); }
  }
  // denken en bewegen
  for (const lijst of [actief, griezels]) for (const w of lijst) {
    for (const e of WZ.stap(w, dt, wzW)) {
      if (e.soort === 'raak' && e.speler === 'ik') {
        const S = SOORT[w.s];
        schade(e.schade, S.sleutel);
        // een duwtje weg van de griezel
        let ax = sp.x - e.wx, az = sp.z - e.wz; const l = Math.hypot(ax, az) || 1; sp.vx += ax / l * 5; sp.vz += az / l * 5; if (sp.opGrond) sp.vy = Math.max(sp.vy, 4);
        klank('wezen', S.geluid, true);
      } else if (e.soort === 'ei') { laatVallen(w.x, w.y + 0.3, w.z, I.ei, 1); klank('wezen', 'kip'); }
      else if (e.soort === 'geluid') { const ax = w.x - sp.x, az = w.z - sp.z; if (ax * ax + az * az < 400) klank('wezen', SOORT[w.s].geluid); }
    }
  }
  // het doel van de speler bestaat nog?
  if (doelWezen && doelWezen.hp <= 0) doelWezen = null;
}
// een griezel op een plek in het donker, niet te dichtbij
function griezelErbij() {
  for (let poging = 0; poging < 6; poging++) {
    const h = Math.random() * Math.PI * 2, d = 18 + Math.random() * 18, x = Math.floor(sp.x + Math.sin(h) * d), z = Math.floor(sp.z + Math.cos(h) * d);
    // buiten op de grond, of ergens in een grot in de buurt van je hoogte
    let y;
    if (Math.random() < 0.5) { const k = wzKolom(x, z); if (!k || k.water) continue; y = k.y + 1; }
    else { y = Math.floor(sp.y) + Math.floor(Math.random() * 17) - 8; if (y < 3 || y > 120) continue; }
    const v0 = blokOp(x, y, z), v1 = blokOp(x, y + 1, z), v2 = blokOp(x, y - 1, z);
    if (v0 < 0 || v1 < 0 || (v0 & 255) || (v1 & 255)) continue;
    const s = WZ.griezelVoor(wzW, x, y, z); if (s < 0) continue;
    const S = SOORT[s];
    // wie niet zweeft, moet op iets vasts staan
    if (!S.zweeft && !(v2 > 0 && G.VAST[v2 & 255])) continue;
    griezels.push(WZ.nieuwWezen(s, x + 0.5, y + (S.zweeft ? 0.5 : 0), z + 0.5, Math.random() * 6.28));
    return;
  }
}
// in een wolkje verdwijnen
function poef(w) {
  const S = SOORT[w.s], h = S.maat[1];
  for (let i = 0; i < 14; i++) dp.push({ x: w.x + (Math.random() - 0.5) * S.maat[0] * 2, y: w.y + Math.random() * h, z: w.z + (Math.random() - 0.5) * S.maat[0] * 2, vx: (Math.random() - 0.5) * 1.2, vy: Math.random() * 1.4 + 0.4, vz: (Math.random() - 0.5) * 1.2, t: 0, max: 0.6 + Math.random() * 0.5, laag: G.DTEXNR.spook_laken + 256, u: Math.random() * 0.75, v: Math.random() * 0.75, s: 0.09 + Math.random() * 0.08 });
  klank('wezen', 'poef');
}
// ---------------- richten: welk wezen raakt je kijkstraal het eerst?
function wezenOpStraal(o, d, max) {
  let best = null, bt = max;
  for (const lijst of [actief, griezels]) for (const w of lijst) {
    const S = SOORT[w.s], r = S.maat[0] + 0.08, h = S.maat[1];
    const t = straalDoos(o, d, w.x - r, w.y, w.z - r, w.x + r, w.y + h, w.z + r);
    if (t && t[0] < bt) { bt = t[0]; best = w; }
  }
  return best ? { wezen: best, t: bt } : null;
}
// ---------------- slaan (linkermuisknop, of tikken op een telefoon)
function slaWezen(w) {
  if (!w || w.hp <= 0) return;
  const slot = inHand(), it = slot ? IT[slot.id] : null, S = SOORT[w.s];
  zwaai('hak'); klank('wezen', 'sla');
  const dood = WZ.geraakt(w, WZ.slagSchade(it), sp.x, sp.z);
  if (it && it.duur) slijt(it.gereed === 'zwaard' ? 1 : 2);
  klank('wezen', S.geluid, true);
  if (!dood) return;
  poef(w);
  for (const [k, n] of WZ.buitVan(w, Math.random)) laatVallen(w.x, w.y + 0.4, w.z, I[k] !== undefined ? I[k] : B[k], n);
  if (S.vriend) { const i = WD.dieren.indexOf(w); if (i >= 0) WD.dieren.splice(i, 1); actief = actief.filter(x => x !== w); }
  else { griezels = griezels.filter(x => x !== w); logboek('griezel'); }
  if (doelWezen === w) doelWezen = null;
}
// ---------------- gebruiken: een koe melken met een emmer, een schaap scheren met een schaar. Geeft true als dat lukte.
function wezenGebruik(w, slot) {
  const S = SOORT[w.s];
  if (S.sleutel === 'koe' && slot && slot.id === I.emmer) {
    zwaai(); klank('wezen', 'koe'); klank('vult');
    if (slot.n > 1) { slot.n--; geefOfLaatVallen(I.emmer_melk, 1); } else WD.inv[WD.kies] = { id: I.emmer_melk, n: 1 };
    rugzakVeranderd(); logboek('melk'); return true;
  }
  if (S.sleutel === 'schaap' && slot && slot.id === I.schaar) {
    if (w.kaal > 0) { melding(t('Dit schaap is al geschoren. Zijn wol groeit weer aan.'), true); return true; }
    zwaai(); klank('wezen', 'schaap'); w.kaal = 300;
    laatVallen(w.x, w.y + 0.8, w.z, I.wol, 2 + Math.floor(Math.random() * 2));
    slijt(1); logboek('wol'); return true;
  }
  return false;
}
// ---------------- tekenen
// De modellen zijn van dozen (in zestienden, de voeten op y = 0, de voorkant naar +z), net als de bewoners.
// Een deel draait om zijn spil: poten bij de heup, de kop bij de nek, vleugels bij de schouder.
let wzModelKlaar = false;
const KL = h => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
function wezenModellen() {
  if (wzModelKlaar || !R || !R.model) return; wzModelKlaar = true;
  const D = G.DTEXNR, V = D.dier_vacht, WO = D.dier_wol, VE = D.dier_veren, GL = D.dier_glad, SC = D.dier_schub;
  const d = (naam, tex, kleur, dozen, spil) => ({ naam, dtex: tex, kleur: KL(kleur), dozen, spil: spil || [0, 0, 0] });
  const spiegel = b => [-b[3], b[1], b[2], -b[0], b[4], b[5]];
  const twee = (naam, tex, kleur, doos, spil) => [d(naam + 'L', tex, kleur, [doos], spil), d(naam + 'R', tex, kleur, [spiegel(doos)], [-spil[0], spil[1], spil[2]])];
  const ogen = (y, z, x, kleur, spil) => d('ogen', GL, kleur || '#1a1416', [[-x - 1.2, y, z, -x, y + 1.4, z + 0.15], [x, y, z, x + 1.2, y + 1.4, z + 0.15]], spil);
  const poten = (tex, kleur, x0, x1, zv0, zv1, za0, za1, hoog) => [
    ...twee('pootV', tex, kleur, [x0, 0, zv0, x1, hoog, zv1], [(x0 + x1) / 2, hoog, (zv0 + zv1) / 2]),
    ...twee('pootA', tex, kleur, [x0, 0, za0, x1, hoog, za1], [(x0 + x1) / 2, hoog, (za0 + za1) / 2]),
  ];
  const M = {};
  // koe: zwart-wit gevlekt, met een roze snuit, hoorntjes en een uier
  M.koe = [
    ...poten(V, '#f4f1ea', -5.5, -2.5, 5, 8, -10, -7, 8),
    d('lijf', V, '#f4f1ea', [[-6, 8, -11, 6, 18, 9]]),
    d('vlek', GL, '#232126', [[-6.05, 11, -6, -1, 17, -1], [2, 13, -10, 6.05, 18.05, -3], [-3, 17.9, 2, 3, 18.06, 7], [6.0, 9, 1, 6.06, 14, 6], [-6.06, 9, 4, -5.99, 13, 8]]),
    d('uier', GL, '#f0a8b4', [[-2, 6.6, -5, 2, 8, -1]]),
    d('kop', V, '#f4f1ea', [[-4, 12, 8.5, 4, 20, 15.5], [-6.2, 17.5, 10.5, -4, 19, 12.5], [4, 17.5, 10.5, 6.2, 19, 12.5]], [0, 14, 8.5]),
    d('snuit', GL, '#f0a8b4', [[-3, 12, 15.5, 3, 15.5, 17.2]], [0, 14, 8.5]),
    d('hoorn', GL, '#e8dcb8', [[-3.8, 20, 10.5, -2.8, 22.2, 11.5], [2.8, 20, 10.5, 3.8, 22.2, 11.5]], [0, 14, 8.5]),
    ogen(16.6, 15.55, 1.4, null, [0, 14, 8.5]),
    d('staart', V, '#232126', [[-0.5, 9.5, -11.8, 0.5, 17.5, -11]], [0, 17.5, -11.4]),
  ];
  // schaap: dikke wollen vacht, donkere kop en pootjes
  const schaapKop = [d('kop', GL, '#3a3438', [[-3, 12, 7.5, 3, 18.5, 13.5], [-5, 16, 9, -3, 17.2, 11], [3, 16, 9, 5, 17.2, 11]], [0, 14, 7.5]), ogen(15.4, 13.55, 1, '#f2e8c8', [0, 14, 7.5])];
  M.schaap = [...poten(GL, '#3a3438', -4.5, -2, 4, 6.5, -7.5, -5, 8), d('lijf', WO, '#f6f2e8', [[-6.5, 7, -9, 6.5, 18, 8.5]]), d('kraag', WO, '#f6f2e8', [[-4, 17, 6.5, 4, 19.5, 9.5]]), ...schaapKop, d('staart', WO, '#f6f2e8', [[-1, 12, -10, 1, 15, -8.8]], [0, 15, -9.4])];
  M.schaap_kaal = [...poten(GL, '#3a3438', -4.5, -2, 4, 6.5, -7.5, -5, 8), d('lijf', GL, '#e8d8c0', [[-5, 8, -8, 5, 16, 7.5]]), ...schaapKop, d('staart', GL, '#e8d8c0', [[-0.8, 12, -8.8, 0.8, 14.5, -7.8]], [0, 14.5, -8.3])];
  // kip: wit met een rode kam en lel, een oranje snavel en oranje pootjes
  M.kip = [
    ...twee('pootV', GL, '#f2a41e', [-1.9, 0, -0.4, -1, 4.2, 0.6], [-1.45, 4.2, 0.1]),
    d('lijf', VE, '#fbf8f2', [[-3, 4, -4, 3, 9.5, 4]]),
    d('staart', VE, '#fbf8f2', [[-2, 7, -6, 2, 11.5, -4]], [0, 7, -4]),
    ...twee('vleugel', VE, '#f2ede2', [-3.7, 5, -3, -3, 8.6, 3], [-3.3, 8.6, 0]),
    d('kop', VE, '#fbf8f2', [[-2, 9, 1.5, 2, 13.5, 5]], [0, 9.5, 3]),
    d('snavel', GL, '#f2a41e', [[-0.8, 10.6, 5, 0.8, 11.6, 6.6]], [0, 9.5, 3]),
    d('kam', GL, '#d82a30', [[-0.5, 13.5, 2, 0.5, 15, 4.6], [-0.5, 9.4, 4.8, 0.5, 10.4, 5.4]], [0, 9.5, 3]),
    ogen(11.6, 5.02, 0.8, null, [0, 9.5, 3]),
  ];
  // eend: bruin lijf met een witte rand, een groene kop en een gele snavel
  M.eend = [
    ...twee('pootV', GL, '#f0a020', [-1.8, 0, -0.5, -0.8, 3, 0.8], [-1.3, 3, 0]),
    d('lijf', VE, '#8a6a4a', [[-3, 2.6, -5, 3, 7.6, 4]]),
    d('band', GL, '#f2efe6', [[-3.05, 6.6, 2, 3.05, 7.4, 3]]),
    d('staart', VE, '#3a3a40', [[-1.6, 5, -6.4, 1.6, 7.4, -5]], [0, 5, -5]),
    ...twee('vleugel', VE, '#6a5240', [-3.6, 3.6, -3.6, -3, 6.8, 2.6], [-3.3, 6.8, 0]),
    d('kop', VE, '#2e7a46', [[-2, 7.4, 1.8, 2, 11.6, 5.6]], [0, 8, 3.2]),
    d('snavel', GL, '#f2c21e', [[-1.2, 8.4, 5.6, 1.2, 9.4, 8]], [0, 8, 3.2]),
    ogen(9.8, 5.62, 0.9, null, [0, 8, 3.2]),
  ];
  // konijn: ronde rug, lange oren en een wit staartje (wit in de sneeuw, zandkleurig in de woestijn)
  for (const [v, kl] of [[0, '#9a8268'], [1, '#f4f2ee'], [2, '#d8bc8a']]) M['konijn' + v] = [
    ...twee('pootV', V, kl, [-2, 0, 1, -0.8, 2.4, 2.6], [-1.4, 2.4, 1.8]),
    ...twee('pootA', V, kl, [-2.6, 0, -3.4, -1, 2.2, -0.6], [-1.8, 2.2, -2]),
    d('lijf', V, kl, [[-2.5, 2, -3.6, 2.5, 6.4, 2.4]]),
    d('kop', V, kl, [[-2, 4, 1.6, 2, 7.8, 5.2]], [0, 5, 2.4]),
    d('oren', V, kl, [[-1.7, 7.8, 2.6, -0.7, 12.4, 3.6], [0.7, 7.8, 2.6, 1.7, 12.4, 3.6]], [0, 5, 2.4]),
    d('neus', GL, '#e88c9a', [[-0.4, 5.2, 5.2, 0.4, 5.8, 5.4]], [0, 5, 2.4]),
    d('staart', WO, '#fbfaf6', [[-1, 4, -4.6, 1, 6, -3.4]]),
    ogen(6, 5.22, 0.9, null, [0, 5, 2.4]),
  ];
  // hert: lange pootjes, bruin met een lichte buik en een wit staartje; sommige hebben een gewei
  const hert = [
    ...poten(V, '#8a5a32', -3.6, -1.8, 5, 6.8, -7.6, -5.8, 11),
    d('lijf', V, '#9a6438', [[-4.4, 11, -9, 4.4, 19, 8]]),
    d('buik', V, '#e6d2b4', [[-3.4, 10.9, -6, 3.4, 11.2, 5]]),
    d('nek', V, '#9a6438', [[-2, 16, 5, 2, 23, 9]], [0, 18, 6]),
    d('kop', V, '#9a6438', [[-2.6, 21, 6.5, 2.6, 25.5, 12.5], [-4.6, 24, 7.2, -2.6, 25.2, 9], [2.6, 24, 7.2, 4.6, 25.2, 9]], [0, 18, 6]),
    d('snuit', GL, '#3a2a20', [[-1.2, 21.6, 12.4, 1.2, 23, 13]], [0, 18, 6]),
    ogen(23.4, 12.55, 1.2, null, [0, 18, 6]),
    d('staart', WO, '#fbfaf6', [[-1, 15, -10, 1, 18, -8.8]], [0, 18, -9.4]),
  ];
  M.hert0 = hert;
  M.hert1 = hert.concat([d('gewei', GL, '#d8c8a0', [[-2.4, 25.4, 8.6, -1.6, 29.4, 9.4], [-4.6, 28, 8.6, -1.6, 28.8, 9.4], [-4.6, 28, 8.6, -3.8, 31, 9.4], [1.6, 25.4, 8.6, 2.4, 29.4, 9.4], [1.6, 28, 8.6, 4.6, 28.8, 9.4], [3.8, 28, 8.6, 4.6, 31, 9.4]], [0, 18, 6])]);
  // zeehond: een lang, glad lijf met vlekjes, grote ogen en flippers
  M.zeehond = [
    d('lijf', GL, '#8a929c', [[-4, 0, -9, 4, 6.5, 5]]),
    d('vlek', GL, '#5a626c', [[-2, 6.45, -5, 0, 6.55, -3], [1.5, 6.45, -1, 3, 6.55, 0.5], [-4.05, 2, -2, -3.95, 3.5, -0.5], [3.95, 3, -6, 4.05, 4.5, -4.5]]),
    d('kop', GL, '#9aa2ac', [[-3, 1, 4.5, 3, 8, 10.5]], [0, 3, 5]),
    d('snuit', GL, '#c8ccd2', [[-1.6, 1.6, 10.4, 1.6, 4, 11.6]], [0, 3, 5]),
    ogen(5.4, 10.52, 1.2, '#101014', [0, 3, 5]),
    ...twee('pootV', GL, '#6a727c', [-6.6, 0, 1, -4, 1.4, 4.4], [-4, 1, 2.6]),
    d('staart', GL, '#6a727c', [[-3.4, 0, -12.5, -0.3, 1.2, -9], [0.3, 0, -12.5, 3.4, 1.2, -9]], [0, 1, -9]),
  ];
  // hagedis: plat en groen, met een lange staart
  M.hagedis = [
    d('lijf', SC, '#6aa83a', [[-1.6, 0.6, -4, 1.6, 2.6, 3]]),
    d('kop', SC, '#7ab84a', [[-1.4, 0.6, 3, 1.4, 2.4, 6]], [0, 1.5, 3]),
    ogen(1.8, 6.01, 0.4, '#1a1a10', [0, 1.5, 3]),
    d('staart', SC, '#5a9830', [[-0.8, 0.8, -10, 0.8, 1.9, -4]], [0, 1.4, -4]),
    ...twee('pootV', SC, '#5a9830', [-3.2, 0, 1, -1.6, 1, 2.2], [-1.6, 0.6, 1.6]),
    ...twee('pootA', SC, '#5a9830', [-3.2, 0, -3, -1.6, 1, -1.8], [-1.6, 0.6, -2.4]),
  ];
  // spookje: een laken met een rafelrand, grote ogen, een o-mondje en zwaaiende armpjes
  M.spookje = [
    d('lijf', D.spook_laken, '#eef2ff', [[-5, 3, -5, 5, 14.5, 5], [-4, 14.5, -4, 4, 16.5, 4]]),
    d('rafel', D.spook_laken, '#dfe6ff', [[-5, 0.5, -5, -2.5, 3, -2.5], [2.5, 0, -5, 5, 3, -2.5], [-5, 0, 2.5, -2.5, 3, 5], [2.5, 0.5, 2.5, 5, 3, 5], [-1.2, 1, -1.2, 1.2, 3, 1.2]]),
    d('ogen', GL, '#1a1830', [[-3.4, 9.5, 5, -1.4, 12.6, 5.2], [1.4, 9.5, 5, 3.4, 12.6, 5.2]]),
    d('mond', GL, '#1a1830', [[-0.9, 6.4, 5, 0.9, 8.4, 5.2]]),
    ...twee('arm', D.spook_laken, '#eef2ff', [-6.6, 6, -1, -5, 9.5, 1], [-5, 9.5, 0]),
  ];
  // grotkwal: een paarse stolp met lichtpuntjes en slingerende draden
  const draden = []; for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, x = Math.sin(a) * 3.6, z = Math.cos(a) * 3.6; draden.push(d('draad' + i, D.kwal_lijf, '#c890f0', [[x - 0.5, 0, z - 0.5, x + 0.5, 8.5, z + 0.5]], [x, 8.5, z])); }
  M.grotkwal = [
    d('lijf', D.kwal_lijf, '#a05ad8', [[-6, 8.5, -6, 6, 13.5, 6], [-4.5, 13.5, -4.5, 4.5, 15.5, 4.5]]),
    d('punt', GL, '#f6e8ff', [[-3, 12, 6, -2, 13, 6.1], [2, 10, 6, 3, 11, 6.1], [-6.1, 11, -1, -6, 12, 0], [6, 10.5, 2, 6.1, 11.5, 3], [0, 15.5, -1, 1, 15.6, 0]]),
    ...draden,
  ];
  // braambol: een bal van takken met doorns, bessen en twee gele oogjes
  M.braambol = [
    d('lijf', D.braam_tak, '#ffffff', [[-6, 1, -6, 6, 13, 6], [-7.2, 5, -1.5, -6, 8, 1.5], [6, 5, -1.5, 7.2, 8, 1.5], [-1.5, 5, -7.2, 1.5, 8, -6], [-1.5, 13, -1.5, 1.5, 14.2, 1.5], [-4, 2, 6, -2, 4, 7], [3, 10, -7, 5, 12, -6]], [0, 7, 0]),
    d('bes', GL, '#4a1a5a', [[2, 10, 6, 3.4, 11.4, 6.6], [-6.6, 9, -3, -6, 10.4, -1.6], [4, 3, -6.6, 5.4, 4.4, -6], [6, 2, 3, 6.6, 3.4, 4.4]], [0, 7, 0]),
    d('ogen', GL, '#ffd84a', [[-3.4, 7.6, 6, -1.4, 9, 6.6], [1.4, 7.6, 6, 3.4, 9, 6.6]], [0, 7, 0]),
  ];
  for (const k in M) R.model('wz:' + k, M[k]);
}
function wezenModel(w) {
  const k = SOORT[w.s].sleutel;
  if (k === 'schaap') return 'wz:' + (w.kaal > 0 ? 'schaap_kaal' : 'schaap');
  if (k === 'konijn') return 'wz:konijn' + (w.v || 0);
  if (k === 'hert') return 'wz:hert' + (w.v ? 1 : 0);
  return 'wz:' + k;
}
const ROOD = [1, 0.35, 0.35], ROOD_DELEN = 'lijf kop pootVL pootVR pootAL pootAR vleugelL vleugelR staart nek snuit rafel armL armR kraag oren vlek buik'.split(' ');
function wezensTeken(lijst) {
  if (!WD || !WD.dieren) return;
  wezenModellen();
  const T = WZ_MAX.teken * WZ_MAX.teken, tijd = performance.now() / 1000, stil = minderBeweging;
  for (const groep of [actief, griezels]) for (const w of groep) {
    const ax = w.x - sp.x, az = w.z - sp.z; if (ax * ax + az * az > T) continue;
    const S = SOORT[w.s], v = Math.hypot(w.vx, w.vz), slag = stil ? 0 : Math.sin(w.fase) * Math.min(1, v / Math.max(0.5, S.snel)) * 0.7;
    const delen = { pootVL: [slag, 0, 0], pootVR: [-slag, 0, 0], pootAL: [-slag, 0, 0], pootAR: [slag, 0, 0] };
    // grazen: kop omlaag als het dier stilstaat
    if (S.vriend && w.st === 'rust' && !stil && (w.n % 2 === 0)) delen.kop = delen.snuit = delen.hoorn = delen.nek = delen.gewei = delen.ogen = delen.oren = delen.neus = delen.snavel = delen.kam = [0.5 + Math.sin(tijd * 2 + w.n) * 0.08, 0, 0];
    if (S.vriend && w.st === 'vlucht') delen.staart = [-0.8, 0, 0];
    else if (!stil) delen.staart = [0, Math.sin(tijd * 3 + w.n) * 0.35, 0];
    // vleugels: fladderen in de lucht
    if (S.fladdert) { const f = !w.grond && !stil ? Math.sin(tijd * 30) * 0.9 : 0; delen.vleugelL = [0, 0, -f - 0.05]; delen.vleugelR = [0, 0, f + 0.05]; }
    if (S.sleutel === 'spookje' && !stil) { const a = Math.sin(tijd * 4 + w.n) * 0.5; delen.armL = [0, 0, -0.4 - a]; delen.armR = [0, 0, 0.4 + a]; }
    if (S.sleutel === 'grotkwal' && !stil) for (let i = 0; i < 6; i++) delen['draad' + i] = [Math.sin(tijd * 2 + i) * 0.25, 0, Math.cos(tijd * 1.7 + i * 1.3) * 0.25];
    if (S.sleutel === 'braambol') delen.lijf = delen.bes = delen.ogen = [stil ? 0 : w.fase * 0.8, 0, 0];
    if (S.sleutel === 'hagedis' && !stil) delen.staart = [0, Math.sin(w.fase * 2) * 0.5, 0];
    if (S.sleutel === 'zeehond' && w.st !== 'rust' && !stil) delen.staart = [Math.sin(w.fase * 2) * 0.3, 0, 0];
    // licht: zoals de plek, maar griezels geven hun eigen licht
    let licht = lichtKleur(lichtOp(Math.floor(w.x), Math.floor(w.y + 0.5), Math.floor(w.z)));
    if (S.sleutel === 'spookje' || S.sleutel === 'grotkwal') licht = [Math.max(licht[0], 0.8), Math.max(licht[1], 0.85), Math.max(licht[2], 1)];
    else if (S.sleutel === 'braambol') licht = licht.map(v => Math.max(v, 0.42)); // net genoeg om hem in het donker aan te zien komen
    // even rood als het geraakt is
    let kleuren = null;
    if (w.rood > 0) { kleuren = {}; for (const n of ROOD_DELEN) kleuren[n] = ROOD; }
    const zweef = S.zweeft && !stil ? Math.sin(tijd * 2 + w.n) * 0.06 : 0;
    lijst.push({ model: wezenModel(w), x: w.x, y: w.y + zweef, z: w.z, yaw: w.yaw, pitch: 0, licht, delen, kleuren, schaal: 1 });
  }
}

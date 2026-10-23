// ============================================================================
// De bewoners van de dorpjes. Elke bewoner heeft een eigen nummer, een naam, een beroep, een bed en een dagritme:
// 's nachts slapen ze, overdag werken ze (de boer op de akker, de bakker bij de oven, de smid bij de smidse,
// de bibliothecaris bij de boeken, een dorpeling wandelt wat rond), rond het middaguur kletsen ze bij de put,
// en tegen de avond gaan ze naar huis. Ze lopen een eigen route over de grond (A*), doen deuren open en weer dicht,
// en gaan nooit het water in of van een rand af.
// Ruilen gaat met spullen tegen spullen (RUIL): wat een bewoner geeft is altijd iets minder waard dan wat hij vraagt
// (zie test/ruilen.js), en elke ruil kan een paar keer per dag; 's ochtends is er weer nieuwe voorraad.
// Bewoners staan in WD.bewoners, WD.dorpen onthoudt welke dorpjes al bewoners hebben.
// Een bewoner is { id, dorp, beroep, naam, kl (uiterlijk), bed, thuis, deur, buiten, werk, kijk, put, vak (de akker van een boer),
// x, y, z, yaw, ruil: [[nummer, hoe vaak vandaag], ...], dag }. Alles wat een bewoner nodig heeft staat erin, dus ook na het laden.
// ============================================================================
const BEROEP = {
  boer: { nl: 'Boer', en: 'Farmer' }, bakker: { nl: 'Bakker', en: 'Baker' }, smid: { nl: 'Smid', en: 'Smith' },
  bibliothecaris: { nl: 'Bibliothecaris', en: 'Librarian' }, dorpeling: { nl: 'Dorpeling', en: 'Villager' },
};
const WERKPLAATS = { bakkerij: 'bakker', smederij: 'smid', bibliotheek: 'bibliothecaris' };
// wat ze ruilen: geef = wat jij geeft, krijg = wat jij krijgt, max = hoe vaak per dag. Nooit robijnen of sterrensplinters.
const RUIL = {
  boer: [
    { geef: [['tarwe', 6]], krijg: ['ijzerstaaf', 1], max: 6 },
    { geef: [['aardappel', 8]], krijg: ['appel', 3], max: 6 },
    { geef: [['wortel', 3]], krijg: ['pompoenpit', 2], max: 4 },
    { geef: [['kolen', 2]], krijg: ['brood', 1], max: 8 },
    { geef: [['pompoen', 2]], krijg: ['kersen', 3], max: 4 },
    { geef: [['tarwezaad', 6]], krijg: ['stekje_kers', 1], max: 3 },
    { geef: [['tarwezaad', 6]], krijg: ['stekje_noten', 1], max: 3 },
    { geef: [['ijzerstaaf', 3]], krijg: ['schoffel_ijzer', 1], max: 1 },
  ],
  bakker: [
    { geef: [['tarwe', 10], ['appel', 2]], krijg: ['appelvlaai', 1], max: 3 },
    { geef: [['tarwe', 8], ['kersen', 2]], krijg: ['kersenvlaai', 1], max: 3 },
    { geef: [['suikerbiet', 6]], krijg: ['stroopwafel', 3], max: 6 },
    { geef: [['kolen', 6]], krijg: ['vlaai', 1], max: 2 },
    { geef: [['wortel', 12]], krijg: ['hutspot', 2], max: 4 },
    { geef: [['pompoen', 3]], krijg: ['pompoensoep', 2], max: 4 },
    { geef: [['goudstaaf', 1]], krijg: ['brood', 2], max: 4 },
  ],
  smid: [
    { geef: [['kolen', 10]], krijg: ['houweel_ijzer', 1], max: 1 },
    { geef: [['koperstaaf', 6]], krijg: ['ijzerstaaf', 2], max: 4 },
    { geef: [['kolen', 4]], krijg: ['mijnspoor', 2], max: 8 },
    { geef: [['ijzerbrok', 8]], krijg: ['ijzerstaaf', 6], max: 3 },
    { geef: [['goudstaaf', 3]], krijg: ['stuwspoor', 2], max: 3 },
    { geef: [['kolen', 12]], krijg: ['karretje', 1], max: 1 },
    { geef: [['kolen', 4], ['ijzerstaaf', 2]], krijg: ['lantaarn', 2], max: 4 },
  ],
  bibliothecaris: [
    { geef: [['papier', 5]], krijg: ['kaart', 1], max: 2 },
    { geef: [['goudstaaf', 4], ['kolen', 2]], krijg: ['klok', 1], max: 1 },
    { geef: [['was', 4]], krijg: ['kaars', 4], max: 4 },
    { geef: [['kolen', 4]], krijg: ['lichtblok', 1], max: 3 },
    { geef: [['planken_eik', 16]], krijg: ['schilderij', 1], max: 2 },
    { geef: [['ijzerstaaf', 1]], krijg: ['papier', 6], max: 4 },
  ],
  dorpeling: [
    { geef: [['bessen', 2]], krijg: ['stekje_baobab', 1], max: 3 },
    { geef: [['bessen', 2]], krijg: ['stekje_wilg', 1], max: 3 },
    { geef: [['appel', 1]], krijg: ['zonnebloem', 2], max: 6 },
    { geef: [['appel', 1]], krijg: ['lavendel', 2], max: 6 },
    { geef: [['kolen', 2]], krijg: ['klinkers', 3], max: 16 },
    { geef: [['kolen', 2]], krijg: ['dakpannen', 4], max: 16 },
    { geef: [['ijzerstaaf', 1]], krijg: ['tegel_delfts', 4], max: 8 },
  ],
};
const NAMEN = 'Jeanne Sjeng Fien Lei Door Bertha Toon Netje Gerrit Wiesje Pierre Jo Mariet Huub Trees Giel Annemie Sef Lewie Marieke Thei Mia Funs Lies Hein Bets Jan-Willem Riek Wullem Leentje Sraar Nel Kobus Tine Frits Greet'.split(' ');
const GROET = {
  boer: ['Goeiedag! De oogst staat er mooi bij.', 'Heb je tarwe over? Ik heb ijzer genoeg.', 'Zonder regen geen brood, zeg ik altijd.'],
  bakker: ['Vers uit de oven!', 'Een stukje vlaai? Dat kan geen kwaad.', 'Voor mijn oven heb ik altijd kolen nodig.'],
  smid: ['Pas op, het ijzer is nog heet.', 'Kolen, daar draait mijn smidse op.', 'Spoor nodig? Ik maak het zo.'],
  bibliothecaris: ['Sst, hier wordt gelezen.', 'Een goede kaart is goud waard.', 'Ken je het verhaal van de gevallen ster?'],
  dorpeling: ['Mooi weer vandaag, hè?', 'Ik heb wat moois voor je huis.', 'Kom je van ver?'],
};
const HUIDTINT = [[0.98, 0.86, 0.76], [0.93, 0.76, 0.62], [0.82, 0.62, 0.46], [0.66, 0.46, 0.32], [0.5, 0.33, 0.22], [0.38, 0.25, 0.17]];
const HAARTINT = [[0.22, 0.15, 0.1], [0.42, 0.27, 0.15], [0.72, 0.52, 0.28], [0.9, 0.78, 0.52], [0.62, 0.3, 0.16], [0.75, 0.75, 0.74], [0.12, 0.11, 0.12], [0.88, 0.88, 0.86]];
const KLEDING = { boer: [[0.34, 0.5, 0.72], [0.45, 0.6, 0.38], [0.72, 0.42, 0.3]], bakker: [[0.95, 0.95, 0.93], [0.88, 0.82, 0.68]], smid: [[0.45, 0.42, 0.4], [0.55, 0.32, 0.25]],
  bibliothecaris: [[0.48, 0.36, 0.62], [0.28, 0.42, 0.58], [0.5, 0.25, 0.3]], dorpeling: [[0.8, 0.3, 0.3], [0.86, 0.68, 0.28], [0.3, 0.6, 0.55], [0.85, 0.55, 0.7], [0.4, 0.5, 0.8]] };
const BROEK = [[0.3, 0.27, 0.26], [0.36, 0.3, 0.24], [0.24, 0.3, 0.45], [0.42, 0.38, 0.3]];
const hk = (a, b) => { let h = Math.imul(a | 0, 2654435761) ^ Math.imul((b | 0) + 0x9E37, 1597334677); h = Math.imul(h ^ (h >>> 15), 2246822519); h ^= h >>> 13; return h >>> 0; };
const tekstHash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
let doelBewoner = null;
// ---------------- de modellen: per beroep een eigen hoed of schort, en twee kapsels
let bwModelKlaar = false;
function bewonerModellen() {
  if (bwModelKlaar || !R || !R.model) return; bwModelKlaar = true;
  const T = G.TEXNR, huid = T.bw_huid, gz = T.bw_gezicht;
  const zes = (a, b) => [a, a, a, a, b, a];
  for (const beroep of Object.keys(BEROEP)) for (const kapsel of [0, 1]) {
    const delen = [
      { naam: 'beenL', tex: T.bw_stof, spil: [-2, 8, 0], dozen: [[-3.6, 2, -1.5, -0.4, 8, 1.5]] },
      { naam: 'beenR', tex: T.bw_stof, spil: [2, 8, 0], dozen: [[0.4, 2, -1.5, 3.6, 8, 1.5]] },
      { naam: 'schoenL', tex: T.bw_schoen, kleur: [1, 1, 1], spil: [-2, 8, 0], dozen: [[-3.7, 0, -1.7, -0.3, 2, 2.4]] },
      { naam: 'schoenR', tex: T.bw_schoen, kleur: [1, 1, 1], spil: [2, 8, 0], dozen: [[0.3, 0, -1.7, 3.7, 2, 2.4]] },
      { naam: 'lijf', tex: T.bw_stof, dozen: [[-4, 8, -2, 4, 17, 2]] },
      { naam: 'armL', tex: T.bw_stof, spil: [-5, 16.5, 0], dozen: [[-6.2, 11, -1.4, -4, 17, 1.4]] },
      { naam: 'armR', tex: T.bw_stof, spil: [5, 16.5, 0], dozen: [[4, 11, -1.4, 6.2, 17, 1.4]] },
      { naam: 'handL', tex: huid, spil: [-5, 16.5, 0], dozen: [[-6, 9, -1.2, -4.2, 11, 1.2]] },
      { naam: 'handR', tex: huid, spil: [5, 16.5, 0], dozen: [[4.2, 9, -1.2, 6, 11, 1.2]] },
      { naam: 'hoofd', tex: huid, spil: [0, 17, 0], dozen: [[-4, 17, -4, 4, 25, 4, zes(huid, gz)]] },
      { naam: 'haar', tex: T.bw_haar, spil: [0, 17, 0], dozen: kapsel ? [[-4.4, 23, -4.4, 4.4, 25.6, 4.4], [-4.4, 16, -4.4, 4.4, 23, -3.3], [-4.4, 19, -3.3, -3.6, 23, 2], [3.6, 19, -3.3, 4.4, 23, 2]] : [[-4.3, 23.3, -4.3, 4.3, 25.5, 4.3], [-4.3, 19.5, -4.3, 4.3, 23.3, -3.4], [-4.3, 22, 2.6, 4.3, 23.4, 4.3]] },
    ];
    if (beroep === 'boer') {
      delen.push({ naam: 'hoed', tex: T.hooi_top, kleur: [1, 1, 1], spil: [0, 17, 0], dozen: [[-6.5, 24.6, -6.5, 6.5, 25.4, 6.5], [-3.7, 25.4, -3.7, 3.7, 28, 3.7]] });
      delen.push({ naam: 'schort', tex: G.TEXNR.linnen_blauw, kleur: [1, 1, 1], dozen: [[-3.3, 8, 2, 3.3, 14, 2.5], [-3, 14, 2, -2, 17, 2.5], [2, 14, 2, 3, 17, 2.5]] });
    } else if (beroep === 'bakker') {
      delen.push({ naam: 'hoed', tex: G.TEXNR.linnen_wit, kleur: [1, 1, 1], spil: [0, 17, 0], dozen: [[-4.4, 24, -4.4, 4.4, 25.6, 4.4], [-5, 25.6, -5, 5, 30, 5]] });
      delen.push({ naam: 'schort', tex: G.TEXNR.linnen_wit, kleur: [1, 1, 1], dozen: [[-3.5, 5, 2, 3.5, 15, 2.5]] });
    } else if (beroep === 'smid') {
      delen.push({ naam: 'hoed', tex: G.TEXNR.linnen_zwart, kleur: [1, 1, 1], spil: [0, 17, 0], dozen: [[-4.5, 24, -4.5, 4.5, 26, 4.5], [-3.6, 24, 4.5, 3.6, 24.7, 7]] });
      delen.push({ naam: 'schort', tex: T.bw_leer, kleur: [1, 1, 1], dozen: [[-3.6, 4, 2, 3.6, 16, 2.6]] });
    } else if (beroep === 'bibliothecaris') {
      delen.push({ naam: 'hoed', tex: G.TEXNR.linnen_paars, kleur: [1, 1, 1], spil: [0, 17, 0], dozen: [[-4.7, 24.5, -4.7, 4.7, 26.2, 4.7], [-2, 26.2, -2, 2, 26.8, 2]] });
      delen.push({ naam: 'bril', tex: T.bw_bril, kleur: [1, 1, 1], spil: [0, 17, 0], dozen: [[-3.6, 21.8, 4, -0.6, 22.3, 4.4], [0.6, 21.8, 4, 3.6, 22.3, 4.4], [-3.6, 19.4, 4, -0.6, 19.9, 4.4], [0.6, 19.4, 4, 3.6, 19.9, 4.4], [-3.6, 19.9, 4, -3.1, 21.8, 4.4], [-1.1, 19.9, 4, -0.6, 21.8, 4.4], [0.6, 19.9, 4, 1.1, 21.8, 4.4], [3.1, 19.9, 4, 3.6, 21.8, 4.4], [-0.6, 21.2, 4, 0.6, 21.6, 4.4]] });
    }
    R.model('bw_' + beroep + kapsel, delen);
  }
}
// ---------------- een dorpje krijgt bewoners (één keer per dorpje, als het voor het eerst in de buurt komt)
const DORPINFO = new Map();
function dorpBinnen(s) {
  const info = s[5]; if (!info || !WD) return;
  DORPINFO.set(info.id, info);
  WD.dorpen = WD.dorpen || []; WD.bewoners = WD.bewoners || [];
  if (WD.dorpen.includes(info.id) || ACTIES.vanBuiten) return;
  WD.dorpen.push(info.id);
  const nAkker = info.akkers.length, namen = new Set(); let boeren = 0, nr = 0;
  actie('dorp', { dorp: info.id }, () => {
    info.gebouwen.forEach((g, gi) => g.bedden.forEach((bed, bi) => {
      let beroep = 'dorpeling', werk = null, kijk = null, vak = null;
      if (WERKPLAATS[g.soort] && bi === 0) { beroep = WERKPLAATS[g.soort]; werk = g.werk; kijk = g.kijk; }
      else if (boeren < nAkker) { beroep = 'boer'; vak = info.akkers[boeren++]; }
      const h = hk(tekstHash(info.id), nr++);
      let naam = NAMEN[h % NAMEN.length]; for (let i = 1; namen.has(naam) && i < NAMEN.length; i++) naam = NAMEN[(h + i) % NAMEN.length]; namen.add(naam);
      WD.bewonerNr = (WD.bewonerNr || 0) + 1;
      const k = { id: WD.bewonerNr, dorp: info.id, beroep, naam, kl: h >>> 8, bed, thuis: g.werk && !WERKPLAATS[g.soort] ? g.werk : g.binnen, deur: g.deur, buiten: g.buiten, werk, kijk,
        put: info.put, vak: vak ? { min: vak.min, max: vak.max, y: vak.y, rand: vak.rand } : null, x: bed[0] + 0.5, y: bed[1], z: bed[2] + 0.5, yaw: 0, ruil: kiesRuil(beroep, h), dag: WD.dag || 0 };
      WD.bewoners.push(k); actieGevolg(['e', 'bewoner', k.id, bewonerData(k)]);
    }));
  });
}
// vier ruilen uit de lijst van het beroep (vast per bewoner): [nummer, hoe vaak al vandaag]
function kiesRuil(beroep, h) {
  const lijst = RUIL[beroep].map((_, i) => i);
  for (let i = lijst.length - 1; i > 0; i--) { const j = hk(h, i) % (i + 1); [lijst[i], lijst[j]] = [lijst[j], lijst[i]]; }
  return lijst.slice(0, Math.min(4, lijst.length)).sort((a, b) => a - b).map(i => [i, 0]);
}
const rond = v => Math.round(v * 100) / 100;
function bewonerData(k) {
  return { id: k.id, dorp: k.dorp, beroep: k.beroep, naam: k.naam, kl: k.kl, bed: k.bed, thuis: k.thuis, deur: k.deur, buiten: k.buiten, werk: k.werk, kijk: k.kijk, put: k.put, vak: k.vak,
    x: rond(k.x), y: rond(k.y), z: rond(k.z), yaw: rond(k.yaw || 0), ruil: k.ruil.map(r => r.slice()), dag: k.dag };
}
function bewonerOntvang(id, d) {
  WD.bewoners = WD.bewoners || [];
  const i = WD.bewoners.findIndex(b => b.id === id);
  if (!d) { if (i >= 0) WD.bewoners.splice(i, 1); return; }
  if (i >= 0) Object.assign(WD.bewoners[i], d); else WD.bewoners.push(Object.assign({}, d));
  WD.bewonerNr = Math.max(WD.bewonerNr || 0, id);
}
// ---------------- waar kun je staan? (de hoogte van je voeten, of NaN)
const GEEN_VLOER = new Set('hek deur bed tafel stoel kist lantaarn fakkel kaars pot vlaai cactus luik ladder kruis water spoor'.split(' '));
function bwVrij(v) { if (v < 0) return false; const i = v & 255; if (!i) return true; const b = BL[i]; return i !== G.W && (!G.VAST[i] || b.vorm === 'deur'); }
function staanOp(x, y, z) {
  const v = blokOp(x, y, z); if (v < 0) return NaN;
  const b = BL[v & 255];
  // op een halve plaat (de onderste helft) in dit blok
  if (b && b.vorm === 'plaat' && !((v >> 8) & 3)) return bwVrij(blokOp(x, y + 1, z)) && bwVrij(blokOp(x, y + 2, z)) ? y + 0.5 : NaN;
  if (!bwVrij(v) || !bwVrij(blokOp(x, y + 1, z))) return NaN;
  const o = blokOp(x, y - 1, z); if (o <= 0) return NaN;
  const ob = BL[o & 255]; if (!G.VAST[o & 255] || (o & 255) === G.W || GEEN_VLOER.has(ob.vorm)) return NaN;
  return y;
}
// ---------------- de route (A*): over de grond, een stapje omhoog (hooguit een blok) of omlaag (hooguit twee)
function zoekRoute(van, naar, maxKnopen) {
  const [sx, sy, sz] = van, [tx, ty, tz] = naar, K = (x, y, z) => (x - sx + 512) + (z - sz + 512) * 1024 + y * 1048576;
  if (isNaN(staanOp(tx, ty, tz))) return null;
  const open = [[Math.abs(tx - sx) + Math.abs(tz - sz) + Math.abs(ty - sy), 0, sx, sy, sz]], van2 = new Map(), kost = new Map([[K(sx, sy, sz), 0]]);
  let n = 0;
  while (open.length && n++ < (maxKnopen || 2500)) {
    // de goedkoopste eruit (een kleine lijst: gewoon zoeken is snel genoeg)
    let bi = 0; for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
    const [, g, x, y, z] = open[bi]; open[bi] = open[open.length - 1]; open.pop();
    if (x === tx && z === tz && Math.abs(y - ty) <= 0) {
      const pad = [[x, y, z]]; let k = K(x, y, z);
      while (van2.has(k)) { const p = van2.get(k); pad.push(p); k = K(p[0], p[1], p[2]); }
      return pad.reverse();
    }
    if (g > kost.get(K(x, y, z))) continue;
    const f0 = staanOp(x, y, z);
    for (const [dx, dz] of G.RICHTING) for (const dy of [0, 1, -1, -2]) {
      const X = x + dx, Y = y + dy, Z = z + dz, f = staanOp(X, Y, Z);
      if (isNaN(f) || f - f0 > 1.01) continue;
      if (dy === 1 && !bwVrij(blokOp(x, y + 2, z))) continue;
      if (dy < 0 && !bwVrij(blokOp(X, y + 1, Z))) continue;
      const onder = blokOp(X, Y - 1, Z) & 255, d = BL[blokOp(X, Y, Z) & 255];
      const c = g + 1 + (f - f0 > 0.6 ? 1.5 : 0) + (onder === B.akker ? 3 : 0) + (d && d.vorm === 'deur' ? 0.5 : 0);
      const k = K(X, Y, Z);
      if (c < (kost.has(k) ? kost.get(k) : Infinity)) { kost.set(k, c); van2.set(k, [x, y, z]); open.push([c + Math.abs(tx - X) + Math.abs(tz - Z) + Math.abs(ty - Y), c, X, Y, Z]); }
      break;
    }
  }
  return null;
}
// een plek om te staan bij (x, y, z): die plek zelf, of een buur (bijvoorbeeld naast een bed)
function staPlekBij(p) {
  if (!p) return null;
  const [x, y, z] = p;
  // (nooit in een deuropening blijven staan)
  for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) for (const dy of [0, 1, -1]) if (!isNaN(staanOp(x + dx, y + dy, z + dz)) && (blokOp(x + dx, y + dy, z + dz) & 255) !== B.deur) return [x + dx, y + dy, z + dz];
  return null;
}
// ---------------- het dagritme
function bwFase(t) { return t < 0.23 || t >= 0.77 ? 'slaap' : t < 0.27 ? 'opstaan' : t < 0.46 ? 'werk' : t < 0.54 ? 'pauze' : t < 0.7 ? 'werk' : 'thuis'; }
const bwRust = new Map(); // id -> wat de bewoner nu doet (niet bewaard): { pad, i, doel, fase, wacht, ligt, ... }
function bwDoel(k, fase) {
  const r = Math.random, rondom = (p, d0, d1) => { const a = r() * Math.PI * 2, d = d0 + r() * (d1 - d0); return staPlekBij([Math.round(p[0] + Math.cos(a) * d), p[1], Math.round(p[2] + Math.sin(a) * d)]); };
  if (fase === 'slaap') return { plek: staPlekBij(k.bed), soort: 'bed' };
  // 's avonds naar binnen, naast je eigen bed (zo staan twee bewoners van één huis niet op hetzelfde plekje)
  if (fase === 'thuis') return { plek: staPlekBij(k.bed) || staPlekBij(k.thuis), soort: 'thuis' };
  if (fase === 'opstaan') return { plek: staPlekBij(k.buiten) || staPlekBij(k.thuis), soort: 'thuis' };
  if (fase === 'pauze' && k.put) return { plek: rondom(k.put, 2.5, 4), soort: 'pauze' };
  if (k.vak) {
    // de boer loopt over de rand van zijn akker
    const a = k.vak, langs = r() < 0.5, x = langs ? a.min[0] + Math.floor(r() * (a.max[0] - a.min[0] + 1)) : (r() < 0.5 ? a.min[0] : a.max[0]);
    const z = langs ? (r() < 0.5 ? a.min[1] : a.max[1]) : a.min[1] + Math.floor(r() * (a.max[1] - a.min[1] + 1));
    return { plek: staPlekBij([x, a.y + 1, z]) || staPlekBij(a.rand), soort: 'werk' };
  }
  if (k.werk) return { plek: staPlekBij(k.werk), soort: 'werk' };
  // een dorpeling wandelt wat rond: over het plein of voor zijn huis
  return { plek: rondom(r() < 0.5 && k.buiten ? k.buiten : k.put || k.buiten, 2, 6), soort: 'werk' };
}
// zet een bewoner meteen op de plek waar hij nu hoort (na een tijd weg, of als de nacht is overgeslagen)
function bwMeteen(k, s, fase) {
  const d = bwDoel(k, fase === 'opstaan' ? 'thuis' : fase); s.pad = null; s.doel = d; s.aangekomen = true; s.wacht = 2 + Math.random() * 4;
  if (d.plek) { k.x = d.plek[0] + 0.5; k.y = staanOp(d.plek[0], d.plek[1], d.plek[2]); k.z = d.plek[2] + 0.5; }
  s.ligt = fase === 'slaap' && !!d.plek;
}
let bwZoekKlok = 0, bwTijd = -1;
function bewonersTik(dt) {
  if (!WD || !WD.bewoners || !WD.bewoners.length || !wereldKlaar) return;
  bewonerModellen();
  const fase = bwFase(WD.tijd), nu = performance.now(), dag = WD.dag || 0;
  // is de tijd gesprongen (geslapen)? Dan staat iedereen meteen goed
  let sprong = false; if (bwTijd >= 0) { let d = WD.tijd - bwTijd; if (d < -0.5) d += 1; sprong = d > 0.04 || d < -0.01; } bwTijd = WD.tijd;
  let zoeken = 1;
  for (const k of WD.bewoners) {
    // een nieuwe dag: nieuwe voorraad om te ruilen (pas als ze wakker zijn)
    if (k.dag !== dag && fase !== 'slaap') { k.dag = dag; for (const r of k.ruil) r[1] = 0; }
    let s = bwRust.get(k.id); if (!s) { s = { pad: null, i: 0, fase, wacht: 0, anim: Math.random() * 10, weg: true, stil: 0 }; bwRust.set(k.id, s); }
    if (Math.abs(k.x - sp.x) > 80 || Math.abs(k.z - sp.z) > 80 || blokOp(Math.floor(k.x), Math.floor(k.y + 0.01), Math.floor(k.z)) < 0) { s.weg = true; continue; }
    if (s.weg || sprong) { s.weg = false; s.fase = fase; bwMeteen(k, s, fase); continue; }
    if (fase !== s.fase) { s.fase = fase; s.pad = null; s.doel = null; s.wacht = Math.random() * 4; s.ligt = false; s.aangekomen = false; }
    s.anim += dt;
    if (s.ligt || ruilMet === k && huidigScherm() === 'ruilen') continue;
    // stilstaan, werken of kletsen; daarna een nieuw doel
    if (!s.pad) {
      s.wacht -= dt;
      if (s.wacht > 0 || zoeken <= 0 || nu < bwZoekKlok) continue;
      const d = bwDoel(k, fase); s.doel = d; s.aangekomen = false;
      let van = [Math.floor(k.x), Math.floor(k.y + 0.01), Math.floor(k.z)];
      if (isNaN(staanOp(van[0], van[1], van[2]))) van = staPlekBij(van) || van;
      zoeken--; bwZoekKlok = nu + 30;
      const pad = d.plek ? zoekRoute(van, d.plek) : null;
      if (pad && pad.length > 1) { s.pad = pad; s.i = 1; s.stil = 0; }
      else { s.wacht = 3 + Math.random() * 5; s.aangekomen = !!pad; if (pad && d.soort === 'bed') s.ligt = true; }
      continue;
    }
    // lopen langs de route
    const p = s.pad[s.i], tx = p[0] + 0.5, tz = p[2] + 0.5, ty = staanOp(p[0], p[1], p[2]);
    if (isNaN(ty)) { s.pad = null; s.wacht = 1; continue; } // de wereld is veranderd: een nieuwe route
    const dv = blokOp(p[0], p[1], p[2]);
    if (dv > 0 && (dv & 255) === B.deur && !((dv >> 8) & 4)) deurBewoner(p[0], p[1], p[2], dv, true);
    const dx = tx - k.x, dz = tz - k.z, af = Math.hypot(dx, dz);
    if (af > 0.02) {
      const st = Math.min(af, 1.45 * dt); k.x += dx / af * st; k.z += dz / af * st;
      let dy = Math.atan2(dx, dz) - k.yaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI; k.yaw += dy * Math.min(1, dt * 10);
    }
    k.y += (ty - k.y) * Math.min(1, dt * 12);
    if (af < 0.1) {
      s.i++; s.stil = 0;
      if (s.i >= s.pad.length) { s.pad = null; const d = s.doel; s.wacht = d && (d.soort === 'werk' || d.soort === 'pauze') ? 5 + Math.random() * 8 : 2; s.aangekomen = true; if (d && d.soort === 'bed') s.ligt = true; }
    } else if ((s.stil += dt) > 4) { s.pad = null; s.wacht = 1; } // vast: opnieuw zoeken
  }
  // deuren die een bewoner opendeed: weer dicht zodra er niemand (bewoner of speler) meer in de deuropening staat
  for (const [sl, d] of bwDeuren) {
    if (nu - d.t < 700) continue;
    const bij = (x, z) => Math.abs(x - d.x - 0.5) < 0.75 && Math.abs(z - d.z - 0.5) < 0.75; // iemand staat (deels) in de deuropening
    if (bij(sp.x, sp.z) || WD.bewoners.some(k => bij(k.x, k.z) && Math.abs(k.y - d.y) < 1.5)) continue;
    const w = blokOp(d.x, d.y, d.z); bwDeuren.delete(sl);
    if (w > 0 && (w & 255) === B.deur && ((w >> 8) & 4)) deurBewoner(d.x, d.y, d.z, w, false);
  }
  // niet door de speler heen: een beetje opzij
  for (const k of WD.bewoners) {
    const dx = k.x - sp.x, dz = k.z - sp.z, d = Math.hypot(dx, dz);
    if (d < 0.55 && d > 0.001 && Math.abs(k.y - sp.y) < 1.5) { const nx = k.x + dx / d * (0.55 - d), nz = k.z + dz / d * (0.55 - d); if (!isNaN(staanOp(Math.floor(nx), Math.floor(k.y + 0.01), Math.floor(nz)))) { k.x = nx; k.z = nz; } }
  }
}
const bwDeuren = new Map(); // deuren die een bewoner opendeed: 'x,y,z' -> { x, y, z, t }
function deurBewoner(x, y, z, v, open) {
  const st = v >> 8, nst = open ? st | 4 : st & ~4; if (nst === st) return;
  if (open) bwDeuren.set(x + ',' + y + ',' + z, { x, y, z, t: performance.now() });
  zetBlok(x, y, z, (v & 255) | (nst << 8));
  const oy = st & 8 ? y - 1 : y + 1, w = blokOp(x, oy, z); if ((w & 255) === B.deur) zetBlok(x, oy, z, (w & 255) | ((open ? (w >> 8) | 4 : (w >> 8) & ~4) << 8));
  stuurZetten();
  if (Math.hypot(x + 0.5 - sp.x, z + 0.5 - sp.z) < 16) klank('deur', open);
}
// ---------------- tekenen: lopen, werken, kletsen, slapen, en naar je kijken als je dichtbij bent
function bewonersTeken(lijst) {
  if (!WD || !WD.bewoners) return;
  bewonerModellen();
  const t = performance.now() / 1000, stil = minderBeweging;
  for (const k of WD.bewoners) {
    if (Math.abs(k.x - sp.x) > 72 || Math.abs(k.z - sp.z) > 72) continue;
    const s = bwRust.get(k.id) || {}, kl = k.kl >>> 0, loopt = !!s.pad;
    const ligt = s.ligt && s.fase === 'slaap' && k.bed && (blokOp(k.bed[0], k.bed[1], k.bed[2]) & 255) === B.bed;
    const f = loopt ? s.anim * 7.5 : 0, z = stil ? 0 : Math.sin(f) * 0.6;
    const D = { beenL: [z, 0, 0], beenR: [-z, 0, 0], armL: [-z * 0.8, 0, 0.05], armR: [z * 0.8, 0, -0.05] };
    // bij het werk: elk beroep zijn eigen beweging
    if (!loopt && !ligt && s.doel && s.doel.soort === 'werk' && s.aangekomen && !stil) {
      const w = s.anim;
      if (k.beroep === 'smid') { D.armR = [-1.5 + Math.abs(Math.sin(w * 5)) * 0.9, 0, 0]; D.armL = [-0.6, 0, 0.1]; }
      else if (k.beroep === 'bakker') { D.armL = [-1.1 + Math.sin(w * 4) * 0.25, 0, 0.15]; D.armR = [-1.1 - Math.sin(w * 4) * 0.25, 0, -0.15]; }
      else if (k.beroep === 'boer') { const a = -0.9 + Math.sin(w * 2.2) * 0.45; D.armL = [a, 0, 0.1]; D.armR = [a, 0, -0.1]; }
      else if (k.beroep === 'bibliothecaris') { D.armL = [-0.8, 0, 0.25]; D.armR = [-0.8, 0, -0.25]; }
    } else if (!loopt && s.fase === 'pauze' && !stil) D.armR = [Math.sin(s.anim * 1.3) > 0.7 ? -0.9 + Math.sin(s.anim * 6) * 0.2 : 0, 0, -0.05];
    // het hoofd draait naar de speler als die dichtbij is (en anders af en toe een beetje)
    let hy = stil ? 0 : Math.sin(s.anim * 0.4 + kl) * 0.25, hp = 0;
    const dx = sp.x - k.x, dz = sp.z - k.z, af = Math.hypot(dx, dz);
    if (af < 5 && !ligt) { let a = Math.atan2(dx, dz) - k.yaw; while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; if (Math.abs(a) < 1.9) { hy = Math.max(-1.1, Math.min(1.1, a)); hp = -Math.atan2(sp.y + sp.oog - (k.y + 1.35), af) * 0.6; } }
    if (s.doel && s.doel.soort === 'werk' && s.aangekomen && k.beroep === 'bibliothecaris' && !loopt && af >= 5) hp = 0.35;
    D.hoofd = D.haar = D.hoed = D.bril = [hp, hy, 0];
    D.handL = D.armL; D.handR = D.armR; D.schoenL = D.beenL; D.schoenR = D.beenR;
    const kleren = KLEDING[k.beroep], kleren1 = kleren[kl % kleren.length], huid = HUIDTINT[(kl >> 3) % HUIDTINT.length], haar = HAARTINT[(kl >> 6) % HAARTINT.length], broek = BROEK[(kl >> 9) % BROEK.length];
    const K = { lijf: kleren1, armL: kleren1, armR: kleren1, beenL: broek, beenR: broek, hoofd: huid, handL: huid, handR: huid, haar };
    let x = k.x, y = k.y, zz = k.z, yaw = k.yaw || 0, pitch = 0, bob = loopt && !stil ? Math.abs(Math.sin(f)) * 0.04 : 0;
    if (ligt && k.bed) {
      // in bed: op de rug, met het hoofd naar het kussen
      const bv = blokOp(k.bed[0], k.bed[1], k.bed[2]), r = (bv >> 8) & 3, [rx, rz] = G.RICHTING[r];
      x = k.bed[0] + 0.5 - rx * 0.2; zz = k.bed[2] + 0.5 - rz * 0.2; y = k.bed[1] + 0.62; yaw = Math.atan2(rx, rz); pitch = Math.PI / 2;
      D.armL = D.handL = [0, 0, 0.12]; D.armR = D.handR = [0, 0, -0.12]; D.beenL = D.beenR = D.schoenL = D.schoenR = [0, 0, 0];
    }
    const l = ligt ? lichtOp(k.bed[0], k.bed[1] + 1, k.bed[2]) : lichtOp(Math.floor(k.x), Math.floor(k.y + 1.2), Math.floor(k.z));
    lijst.push({ model: 'bw_' + k.beroep + ((kl >> 12) & 1), x, y: y + bob, z: zz, yaw, pitch, licht: lichtKleur(l), delen: D, kleuren: K, schaal: 1.06 });
  }
}
// ---------------- richten op een bewoner
function bewonerOpStraal(o, d, max) {
  let best = null, bt = max;
  for (const k of WD && WD.bewoners || []) {
    if (Math.abs(k.x - o[0]) > max + 1 || Math.abs(k.z - o[2]) > max + 1) continue;
    const s = bwRust.get(k.id), ligt = s && s.ligt && s.fase === 'slaap';
    const lo = ligt ? [k.bed[0], k.bed[1], k.bed[2]] : [k.x - 0.32, k.y, k.z - 0.32], hi = ligt ? [k.bed[0] + 1, k.bed[1] + 1, k.bed[2] + 1] : [k.x + 0.32, k.y + 1.75, k.z + 0.32];
    let t0 = 0, t1 = bt;
    for (let i = 0; i < 3 && t0 <= t1; i++) {
      if (Math.abs(d[i]) < 1e-9) { if (o[i] < lo[i] || o[i] > hi[i]) t0 = Infinity; continue; }
      let a = (lo[i] - o[i]) / d[i], b = (hi[i] - o[i]) / d[i]; if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, b);
    }
    if (t0 <= t1 && t0 < bt) { bt = t0; best = k; }
  }
  return best ? { bewoner: best, t: bt } : null;
}
// een tik tegen een bewoner: geen schade, wel een opmerking
function bewonerGetikt(k) {
  const s = bwRust.get(k.id); if (s && s.ligt) { melding(t('{0} slaapt.', k.naam), true); return; }
  melding(k.naam + ': ' + t(['Hé! Niet slaan, hoor.', 'Au! Waar was dat voor nodig?', 'Ik ben geen boom!'][Math.floor(Math.random() * 3)]), true); klank('au');
}
// ---------------- ruilen
const ruilSleutel = s => (I[s] !== undefined ? I[s] : B[s]);
let ruilMet = null;
function openRuilen(k) {
  const s = bwRust.get(k.id);
  if (s && s.ligt) { melding(t('{0} slaapt. Kom morgen terug om te ruilen.', k.naam), true); return; }
  ruilMet = k; if (s) { s.pad = null; s.wacht = 8; }
  k.yaw = Math.atan2(sp.x - k.x, sp.z - k.z);
  bouwRuilen(true); openScherm('ruilen'); zwaai();
  if (typeof logboek === 'function') logboek('dorp');
}
function bouwRuilen(groet) {
  const k = ruilMet; if (!k) return;
  $('rb-ruil-naam').textContent = k.naam;
  const zinnen = GROET[k.beroep];
  if (groet) $('rb-ruil-wie').textContent = (TAAL === 'en' ? BEROEP[k.beroep].en : BEROEP[k.beroep].nl) + ' · ' + t(zinnen[(k.kl + (WD.dag || 0)) % zinnen.length]);
  const L = $('rb-ruil-lijst'); L.innerHTML = '';
  for (const r of k.ruil) {
    const a = RUIL[k.beroep][r[0]]; if (!a) continue;
    const over = a.max - r[1], kan = over > 0 && a.geef.every(([s, n]) => tel(ruilSleutel(s)) >= n);
    const rij = el('div', 'rb-ruil-rij' + (over <= 0 ? ' op' : ''));
    const geef = el('div', 'rb-ruil-geef');
    for (const [s, n] of a.geef) { const id = ruilSleutel(s), heb = tel(id); const d = el('div', 'rb-ruil-ding' + (heb < n ? ' tekort' : '')); d.innerHTML = vakHtml({ id, n }); d.title = naam(id) + ' · ' + t('je hebt er {0}', heb); d.setAttribute('aria-label', n + ' ' + naam(id) + ', ' + t('je hebt er {0}', heb)); geef.appendChild(d); }
    const krijg = el('div', 'rb-ruil-ding krijg'), kid = ruilSleutel(a.krijg[0]); krijg.innerHTML = vakHtml({ id: kid, n: a.krijg[1] }); krijg.title = naam(kid); krijg.setAttribute('aria-label', a.krijg[1] + ' ' + naam(kid));
    const pijl = el('div', 'rb-ruil-pijl'); pijl.innerHTML = PIJL;
    const knop = el('button', 'rb-knop' + (kan ? ' rood' : ''), over <= 0 ? t('Op') : t('Ruil')); knop.type = 'button'; knop.disabled = !kan;
    knop.setAttribute('aria-label', t('Ruil {0} voor {1}', a.geef.map(([s, n]) => n + ' ' + naam(ruilSleutel(s))).join(' + '), a.krijg[1] + ' ' + naam(kid)));
    knop.onclick = () => { ruil(k, r[0]); };
    const nog = el('div', 'rb-ruil-nog', over <= 0 ? t('morgen weer') : t('nog {0}×', over));
    const naamK = el('div', 'rb-ruil-naamk', naam(kid));
    rij.append(geef, pijl, krijg, naamK, nog, knop); L.appendChild(rij);
  }
}
function ruil(k, nr) {
  const a = RUIL[k.beroep][nr], r = k.ruil.find(x => x[0] === nr); if (!a || !r || r[1] >= a.max) return;
  if (!a.geef.every(([s, n]) => tel(ruilSleutel(s)) >= n)) return;
  actie('ruil', { bewoner: k.id, nr }, () => {
    for (const [s, n] of a.geef) neem(ruilSleutel(s), n);
    geefOfLaatVallen(ruilSleutel(a.krijg[0]), a.krijg[1]);
    r[1]++; actieGevolg(['e', 'bewoner', k.id, { ruil: k.ruil.map(x => x.slice()), dag: k.dag }]);
  });
  klank('oppak'); klank('nieuw');
  if (typeof logboek === 'function') logboek('ruil');
  bouwRuilen(false);
}
// een andere wereld: alles van de vorige vergeten
function bewonersLaden() { bwRust.clear(); DORPINFO.clear(); bwDeuren.clear(); bwTijd = -1; doelBewoner = null; ruilMet = null; }

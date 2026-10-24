// ============================================================================
// Je eigen poppetje: het model (van dozen, in de stijl van de bewoners), hoe het beweegt, en de drie camera's:
// door je eigen ogen (0), van achteren (1) en van voren (2). Richten gaat altijd vanuit je hoofd.
// Het poppetje staat in de instellingen (rommelblok-v3) als een rijtje keuzes (zie shared/poppetje.js).
// ============================================================================
const POP = G.POP;
opslag.pop = POP.schoonPop(opslag.pop, inst.huid);
if (!(inst.camera >= 0 && inst.camera <= 2)) inst.camera = 0;
const hexKleur = h => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
const donker = (k, f) => [k[0] * f, k[1] * f, k[2] * f];
const popKeuze = (p, veld) => POP.POP_KEUZES[veld][POP.popWaarde(p, veld)][0];
function popKleuren(p) {
  const w = v => POP.popWaarde(p, v);
  return { huid: hexKleur(POP.POP_HUID[w('huid')]), haar: hexKleur(POP.POP_HAARKLEUR[w('haarKleur')]), boven: hexKleur(POP.POP_KLEUR[w('bovenKleur')]),
    onder: hexKleur(POP.POP_KLEUR[w('onderKleur')]), schoen: hexKleur(POP.POP_KLEUR[w('schoenKleur')]), acc: hexKleur(POP.POP_KLEUR[w('accKleur')]) };
}
// waar de delen draaien (in zestienden; de voeten op y = 0, de voorkant naar +z)
const POP_SPIL = { hoofd: [0, 19, 0], armL: [-5.3, 18.4, 0], armR: [5.3, 18.4, 0], beenL: [-1.8, 10, 0], beenR: [1.8, 10, 0], lijf: [0, 0, 0] };
const POP_HUIDDONKER = 0.86; // neus en oogleden: net iets donkerder dan de huid
const POP_SCHAAL = 0.96; // het poppetje is 30 zestienden hoog: zo is het net zo groot als de speler (1,8 blok)
// de hand waar je iets in houdt (in zestienden, in het deel armR~hand)
const POP_HANDPLEK = [5.3, 10.6, 0.6];
// spiegelen van links naar rechts
const spiegel = d => [-d[3], d[1], d[2], -d[0], d[4], d[5]];
// dicht: het model met gesloten ogen (oogleden over de ogen), om mee te knipperen
function popDelen(p, dicht) {
  const T = G.TEXNR, D = G.DTEXNR, k = popKleuren(p), delen = [], groepen = [];
  const boven = popKeuze(p, 'boven'), onder = popKeuze(p, 'onder'), haar = popKeuze(p, 'haar'), acc = popKeuze(p, 'acc');
  const wit = hexKleur('#F2EFE6');
  const deel = (naam, groep, tex, kleur, dozen, dtex) => {
    if (!dozen.length) return;
    delen.push(Object.assign({ naam, tex, kleur, dozen, spil: POP_SPIL[groep] }, dtex !== undefined ? { dtex } : {}));
    groepen.push([naam, groep]);
  };
  const beide = (naam, groep, tex, kleur, dozen) => { deel(naam + 'L', groep + 'L', tex, kleur, dozen); deel(naam + 'R', groep + 'R', tex, kleur, dozen.map(spiegel)); };
  // ---- schoenen en benen
  beide('schoen', 'been', T.bw_stof, k.schoen, [[-3.6, 0.6, -1.8, -0.1, 2, 2.7]]);
  // een zool, een neus aan de schoen en veters
  beide('zool', 'been', T.bw_stof, donker(k.schoen, 0.45), [[-3.7, 0, -1.9, 0, 0.6, 2.85]]);
  beide('veter', 'been', T.bw_stof, hexKleur('#F2EFE6'), [[-2.6, 1.6, 1.2, -1.1, 2.05, 2.75]]);
  const beenKleur = boven === 'overall' ? k.boven : boven === 'jurk' ? k.onder : k.onder;
  if (boven === 'overall' || boven === 'jurk' || onder === 'broek') beide('been', 'been', T.bw_stof, beenKleur, [[-3.4, 2, -1.6, -0.3, 10, 1.6]]);
  else if (onder === 'kort') { beide('been', 'been', T.bw_stof, k.onder, [[-3.5, 6.5, -1.7, -0.2, 10, 1.7]]); beide('kuit', 'been', T.bw_huid, k.huid, [[-3.2, 3.2, -1.4, -0.5, 6.5, 1.4]]); beide('sok', 'been', T.bw_stof, hexKleur('#F2EFE6'), [[-3.3, 2, -1.5, -0.4, 3.2, 1.5]]); }
  else if (onder === 'rok') { beide('been', 'been', T.bw_huid, k.huid, [[-3.2, 3.2, -1.4, -0.5, 10, 1.4]]); beide('sok', 'been', T.bw_stof, hexKleur('#F2EFE6'), [[-3.3, 2, -1.5, -0.4, 3.2, 1.5]]); }
  else { beide('been', 'been', T.bw_stof, k.onder, [[-3.5, 3, -1.7, -0.2, 10, 1.7]]); beide('boord', 'been', T.bw_stof, donker(k.onder, 0.78), [[-3.4, 2, -1.6, -0.3, 3, 1.6]]); }
  // ---- het lijf
  const shirt = boven === 'overall' ? wit : k.boven;
  deel('lijf', 'lijf', T.bw_stof, shirt, [[-4, 10, -2.2, 4, 19, 2.2]]);
  if (boven === 'trui') deel('kraag', 'lijf', T.bw_stof, donker(k.boven, 0.82), [[-2.6, 18.6, -2.4, 2.6, 19.4, 2.4]]);
  if (boven === 'hoodie') { deel('capuchon', 'lijf', T.bw_stof, donker(k.boven, 0.9), [[-3.8, 16.5, -4.3, 3.8, 20.5, -2.2]]); deel('buidel', 'lijf', T.bw_stof, donker(k.boven, 0.8), [[-2.4, 11, 2.2, 2.4, 13.8, 2.5]]); }
  if (boven === 'overall') deel('overall', 'lijf', T.bw_stof, k.boven, [[-2.8, 10.5, 2.2, 2.8, 16.5, 2.5], [-2.8, 16.5, 2.2, -1.8, 19.1, 2.5], [1.8, 16.5, 2.2, 2.8, 19.1, 2.5], [-4.05, 10, -2.25, 4.05, 12, 2.25], [-2.8, 13, -2.5, -1.8, 19.1, -2.2], [1.8, 13, -2.5, 2.8, 19.1, -2.2]]);
  if (boven === 'jasje') { deel('hemd', 'lijf', T.bw_stof, wit, [[-1, 10.5, 2.2, 1, 19, 2.35]]); deel('revers', 'lijf', T.bw_stof, donker(k.boven, 0.75), [[-2.1, 15.5, 2.2, -1, 19, 2.45], [1, 15.5, 2.2, 2.1, 19, 2.45]]); }
  // een riem met een gesp bij een broek of korte broek, een zoom onderaan een shirt, en knoopjes op een jasje
  if (boven !== 'overall' && boven !== 'jurk' && (onder === 'broek' || onder === 'kort')) { deel('riem', 'lijf', T.bw_stof, hexKleur('#4A3426'), [[-4.08, 9.9, -2.28, 4.08, 10.9, 2.28]]); deel('gesp', 'lijf', T.bw_stof, hexKleur('#E9B949'), [[-0.75, 9.75, 2.28, 0.75, 11.05, 2.42]]); }
  if (boven === 'tshirt' || boven === 'trui') deel('zoom', 'lijf', T.bw_stof, donker(k.boven, 0.85), [[-4.04, 10.9, -2.24, 4.04, 11.5, 2.24]]);
  if (boven === 'jasje') deel('knoop', 'lijf', T.bw_stof, donker(k.boven, 0.55), [[-0.35, 12.2, 2.35, 0.35, 12.9, 2.5], [-0.35, 14.4, 2.35, 0.35, 15.1, 2.5]]);
  if (boven === 'hoodie') deel('koord', 'lijf', T.bw_stof, hexKleur('#F2EFE6'), [[-1.6, 15.6, 2.2, -1.2, 18.6, 2.4], [1.2, 15.6, 2.2, 1.6, 18.6, 2.4]]);
  if (boven === 'jurk') deel('rok', 'lijf', T.bw_stof, k.boven, [[-4.7, 6, -2.9, 4.7, 10.5, 2.9]]);
  else if (onder === 'rok' && boven !== 'overall') deel('rok', 'lijf', T.bw_stof, k.onder, [[-4.6, 6, -2.8, 4.6, 10.5, 2.8]]);
  // ---- de armen: lange mouwen (trui, hoodie, jasje) of korte (t-shirt, overall met een hemd, jurk)
  const lang = POP.POP_LANGE_MOUW.has(boven), mouw = boven === 'overall' ? wit : k.boven;
  if (lang) beide('mouw', 'arm', T.bw_stof, mouw, [[-6.6, 11.5, -1.3, -4, 19, 1.3]]);
  else { beide('mouw', 'arm', T.bw_stof, mouw, [[-6.7, 15.5, -1.4, -3.9, 19, 1.4]]); beide('onderarm', 'arm', T.bw_huid, k.huid, [[-6.4, 11.5, -1.1, -4.2, 15.5, 1.1]]); }
  beide('hand', 'arm', T.bw_huid, k.huid, [[-6.4, 9.6, -1.1, -4.2, 11.5, 1.1]]);
  beide('duim', 'arm', T.bw_huid, donker(k.huid, 0.95), [[-4.5, 10.2, 1.1, -3.9, 11.4, 1.7]]);
  // ---- het hoofd, de oren en het gezicht (losse laagjes vlak voor het hoofd)
  deel('hoofd', 'hoofd', T.bw_huid, k.huid, [[-5, 19, -4.5, 5, 29, 4.5], [-5.6, 22.5, -0.8, -5, 24.5, 0.8], [5, 22.5, -0.8, 5.6, 24.5, 0.8]]);
  const gezicht = [[-5, 19, 4.5, 5, 29, 4.51]];
  deel('ogen', 'hoofd', undefined, null, gezicht, D['pop_ogen_' + popKeuze(p, 'ogen')]);
  deel('mond', 'hoofd', undefined, null, gezicht.map(d => [d[0], d[1], d[2] + 0.01, d[3], d[4], d[5] + 0.01]), D['pop_mond_' + popKeuze(p, 'mond')]);
  // een neusje, wenkbrauwen in de kleur van het haar, en bij het knipperen oogleden over de ogen
  // (de ogen zitten op het gezicht op x -3 tot -1 en 1 tot 3, y 23 tot 25)
  deel('neus', 'hoofd', T.bw_huid, donker(k.huid, POP_HUIDDONKER), [[-0.55, 22.2, 4.5, 0.55, 23.3, 5.05]]);
  deel('wenkbrauw', 'hoofd', T.bw_haar, donker(k.haar, 0.85), [[-3.3, 25.6, 4.5, -0.8, 26.15, 4.66], [0.8, 25.6, 4.5, 3.3, 26.15, 4.66]]);
  if (dicht) deel('ooglid', 'hoofd', T.bw_huid, donker(k.huid, POP_HUIDDONKER), [[-3.25, 22.8, 4.5, -0.75, 25.3, 4.62], [0.75, 22.8, 4.5, 3.25, 25.3, 4.62]]);
  const extra = popKeuze(p, 'extra');
  if (extra === 'bril') {
    // een brilletje van dunne staafjes vlak voor het gezicht (de ogen zie je erdoorheen), met pootjes naar je oren
    const w = 0.32, z0 = 4.5, z1 = 4.85, glas = (a, b) => [[a, 25.78, z0, b, 26.1, z1], [a, 22.6, z0, b, 22.92, z1], [a, 22.6, z0, a + w, 26.1, z1], [b - w, 22.6, z0, b, 26.1, z1]];
    deel('bril', 'hoofd', T.bw_stof, hexKleur('#2A2A30'), [...glas(-3.6, -0.6), ...glas(0.6, 3.6), [-0.6, 24.6, z0, 0.6, 24.92, z1],
      [-5.22, 24.6, z0, -3.6, 24.92, z1], [3.6, 24.6, z0, 5.22, 24.92, z1], [-5.22, 24.6, -0.6, -4.98, 24.92, z1], [4.98, 24.6, -0.6, 5.22, 24.92, z1]]);
  } else if (extra !== 'geen') deel('extra', 'hoofd', undefined, null, gezicht.map(d => [d[0], d[1], d[2] + 0.02, d[3], d[4], d[5] + 0.02]), D['pop_' + extra]);
  // ---- het haar
  const KORT = [[-5.3, 27, -4.8, 5.3, 29.8, 4.8], [-5.3, 21.5, -4.8, 5.3, 27, -3.6], [-5.3, 24.5, -3.6, -4.8, 27, 2.5], [4.8, 24.5, -3.6, 5.3, 27, 2.5], [-5.3, 26.4, 4.5, 5.3, 27.4, 4.8]];
  const HAAR = {
    kort: KORT,
    krullen: KORT.concat([[-4, 29.6, -3, -1.6, 31, -0.6], [0.6, 29.6, -1, 3, 31, 1.4], [-2, 29.6, 1.4, 0.4, 30.8, 3.8], [-5.9, 25, -3, -5.1, 27.4, 0.6], [5.1, 25, -1, 5.9, 27.4, 2.6], [-3, 29.6, -4.4, 0, 30.6, -2], [1.4, 29.6, -4.2, 4, 30.7, -1.8]]),
    staart: KORT.concat([[-1.1, 20.5, -6.3, 1.1, 27.4, -4.6], [-1.3, 26.4, -5, 1.3, 27.6, -4.6]]),
    knot: KORT.concat([[-1.9, 29.6, -2.4, 1.9, 32.2, 1.4]]),
    lang: KORT.concat([[-5.3, 14.5, -4.8, 5.3, 21.5, -3.5], [-5.3, 16.5, -3.5, -4.8, 24.5, 3.2], [4.8, 16.5, -3.5, 5.3, 24.5, 3.2]]),
    stekels: [[-5.2, 27.6, -4.7, 5.2, 29.2, 4.7], [-5.2, 22.5, -4.7, 5.2, 27.6, -3.7], [-4, 29.2, -2, -2, 31.6, 0], [-1, 29.2, -3.5, 1, 32.2, -1.5], [2, 29.2, -2, 4, 31.6, 0], [-2.5, 29.2, 1, -0.5, 31.2, 3], [0.5, 29.2, 1, 2.5, 31.4, 3]],
    vlechtjes: KORT.concat([[-5.9, 15.5, -0.7, -4.7, 24, 0.9], [4.7, 15.5, -0.7, 5.9, 24, 0.9], [-6.1, 14.5, -0.9, -4.5, 15.5, 1.1], [4.5, 14.5, -0.9, 6.1, 15.5, 1.1]]),
    kuif: [[-5.2, 27.6, -4.7, 5.2, 28.4, 4.7], [-1.6, 28.4, -4.8, 1.6, 31, 4.9]],
    kaal: [],
  };
  deel('haar', 'hoofd', T.bw_haar, k.haar, HAAR[haar]);
  // ---- het accessoire
  const ACC = {
    geen: [],
    pet: [[-5.5, 28.2, -5, 5.5, 30.6, 5], [-4.4, 28.2, 5, 4.4, 28.9, 7.6]],
    muts: [[-5.6, 26.2, -5.1, 5.6, 30.8, 5.1], [-1.3, 30.8, -1.3, 1.3, 33, 1.3]],
    strik: [[1.4, 29.4, -1.4, 3.6, 31.2, 0.4], [4.6, 29.4, -1.4, 6.8, 31.2, 0.4], [3.6, 29.7, -1.2, 4.6, 30.9, 0.2]],
    koptelefoon: [[-5.7, 29.8, -0.9, 5.7, 30.8, 0.9], [-5.7, 24, -0.9, -5.1, 30.8, 0.9], [5.1, 24, -0.9, 5.7, 30.8, 0.9], [-6.5, 21.6, -1.9, -5.1, 25.2, 1.9], [5.1, 21.6, -1.9, 6.5, 25.2, 1.9]],
    sjaal: [[-4.6, 17.6, -2.7, 4.6, 19.8, 2.7], [1.2, 12, 2.4, 3.2, 17.6, 3.1]],
    rugzakje: [[-3.2, 11.5, -4.4, 3.2, 18.5, -2.2], [-3.4, 16.6, -4.6, 3.4, 18.7, -2]],
    bloem: [[4.8, 25.4, 1.2, 6.4, 27, 2.8], [5.2, 24.6, 1.6, 6, 27.8, 2.4], [5.2, 25.8, 0.4, 6, 26.6, 3.6]],
    hoed: [[-7.6, 27.6, -7.1, 7.6, 28.4, 7.1], [-5.2, 28.4, -4.8, 5.2, 32.4, 4.8]],
    kroontje: [[-3, 29.6, -2.8, 3, 30.8, 2.8], [-3, 30.8, -2.8, -2, 32, -1.8], [2, 30.8, -2.8, 3, 32, -1.8], [-3, 30.8, 1.8, -2, 32, 2.8], [2, 30.8, 1.8, 3, 32, 2.8], [-0.5, 30.8, -0.5, 0.5, 32.4, 0.5]],
  };
  const hoofdAcc = acc !== 'sjaal' && acc !== 'rugzakje';
  deel('acc', hoofdAcc ? 'hoofd' : 'lijf', T.bw_stof, k.acc, ACC[acc]);
  if (acc === 'hoed') deel('accband', 'hoofd', T.bw_stof, donker(k.acc, 0.7), [[-5.25, 28.4, -4.85, 5.25, 29.4, 4.85]]);
  if (acc === 'muts') deel('accrand', 'hoofd', T.bw_stof, donker(k.acc, 0.8), [[-5.7, 26.2, -5.2, 5.7, 27.2, 5.2]]);
  if (acc === 'bloem') deel('acchart', 'hoofd', T.bw_stof, hexKleur('#E9B949'), [[5.6, 25.8, 2.6, 6.6, 26.6, 3]]);
  return { delen, groepen };
}
// de modellen in de tekenaar: één per poppetje (ook straks die van andere spelers); oude worden opgeruimd
const POP_GROEPEN = new Map(), POP_GEBRUIK = new Map();
function popModel(p, dicht) {
  const naam = 'pop:' + p.join(',') + (dicht ? ':dicht' : '');
  if (!R || !R.model) return null;
  if (!POP_GROEPEN.has(naam)) {
    const { delen, groepen } = popDelen(p, dicht);
    R.model(naam, delen); POP_GROEPEN.set(naam, groepen);
    // hooguit 32 tegelijk (16 poppetjes, elk ook met gesloten ogen): de minst recent gebruikte gaat weg
    if (POP_GROEPEN.size > 32) { let oudst = null, t = Infinity; for (const [n, g] of POP_GEBRUIK) if (g < t && n !== naam) { t = g; oudst = n; } if (oudst) { R.modelWeg(oudst); POP_GROEPEN.delete(oudst); POP_GEBRUIK.delete(oudst); } }
  }
  POP_GEBRUIK.set(naam, performance.now());
  return naam;
}
// ---------------- bewegen: de draaiingen per groep, uit wat de speler doet
// s: { v (snelheid), fase, grond, water, ladder, sluip, kar, hak (0..1 of -1), eet (-1 of tijd), zwaai (0..1), pitch, t, vliegt }
function popHouding(s) {
  const g = { hoofd: [0, 0, 0], armL: [0, 0, 0], armR: [0, 0, 0], beenL: [0, 0, 0], beenR: [0, 0, 0], lijf: [0, 0, 0] };
  const stil = minderBeweging;
  const loop = Math.min(1, s.v / 4.3), ren = Math.max(0, Math.min(1, (s.v - 4.4) / 1.4)), slag = stil ? 0 : Math.sin(s.fase);
  let lichaam = 0;
  if (s.kar) { g.beenL[0] = g.beenR[0] = -1.45; g.armL[0] = g.armR[0] = -0.55; }
  else if (s.water) {
    // zwemmen: plat in het water, trappelen en slagen maken
    lichaam = -1.15; const t = stil ? 0 : s.t * 7;
    g.beenL[0] = Math.sin(t) * 0.35; g.beenR[0] = -Math.sin(t) * 0.35;
    g.armL[0] = -2.6 + Math.sin(t * 0.5) * 0.6; g.armR[0] = -2.6 - Math.sin(t * 0.5) * 0.6; g.armL[2] = -0.3; g.armR[2] = 0.3;
  } else if (s.ladder) {
    const t = stil ? 0 : s.t * 6;
    g.armL[0] = -2.4 + Math.sin(t) * 0.4; g.armR[0] = -2.4 - Math.sin(t) * 0.4; g.beenL[0] = -0.5 + Math.sin(t) * 0.4; g.beenR[0] = -0.5 - Math.sin(t) * 0.4;
  } else if (!s.grond && !s.vliegt) {
    // springen of vallen: armen een beetje omhoog, benen uit elkaar
    g.armL[0] = g.armR[0] = -0.9; g.armL[2] = -0.35; g.armR[2] = 0.35; g.beenL[0] = 0.35; g.beenR[0] = -0.3;
  } else {
    const a = (0.55 + 0.35 * ren) * loop;
    g.beenL[0] = slag * a; g.beenR[0] = -slag * a;
    g.armL[0] = -slag * a * 0.8; g.armR[0] = slag * a * 0.8;
    if (s.sluip) { lichaam = 0.28; g.hoofd[0] -= 0.25; g.armL[0] -= 0.3; g.armR[0] -= 0.3; }
    if (ren > 0) lichaam = Math.max(lichaam, 0.12 * ren);
  }
  // hakken (een boog naar beneden), bouwen (een duwtje), eten (de hand naar je mond)
  if (s.eet >= 0) { g.armR[0] = -1.9 + Math.max(0, Math.sin(s.eet * 15)) * 0.15; g.armR[2] = 0.45; }
  else if (s.hak >= 0) { const b = Math.sin(s.hak * Math.PI); g.armR[0] = -2.2 + b * 1.6; g.armR[2] = 0.15; }
  else if (s.zwaai < 1) { const b = Math.sin(s.zwaai * Math.PI); g.armR[0] = Math.min(g.armR[0], -0.4 - b * 1.1); }
  // rustig ademen: de armen bewegen zachtjes mee, en het hoofd een heel klein beetje
  if (!stil && s.t !== undefined && !s.water && !s.ladder && !s.kar) { const a = Math.sin(s.t * 1.7 + (s.n || 0)) * (1 - loop); g.armL[2] -= 0.04 + 0.025 * a; g.armR[2] += 0.04 + 0.025 * a; g.hoofd[0] += 0.015 * a; }
  // het hoofd kijkt helemaal mee omhoog en omlaag, en opzij (kop: hoe ver het hoofd gedraaid is tegenover het lijf)
  g.hoofd[0] += Math.max(-1.35, Math.min(1.35, -s.pitch)) - lichaam * 0.6;
  if (s.kop) g.hoofd[1] += Math.max(-1.1, Math.min(1.1, s.kop));
  return { g, lichaam };
}
// knipperen: elke 3 tot 5,5 seconden heel even dicht (vast per poppetje, zodat ze niet allemaal tegelijk knipperen)
function popKnippert(n, t) { if (minderBeweging) return false; const p = 3 + ((n * 0.6180339) % 1) * 2.5, f = ((t + n * 1.37) % p); return f < 0.13; }
// Het lijf draait pas mee als het hoofd ver opzij kijkt (of als je loopt): o.lijf is de kant van het lijf (zoals yaw),
// terug: hoe ver het hoofd tegenover het lijf gedraaid is. Alles zacht, met een veer.
function popLijf(o, kijk, loopt, dt) {
  const verschil = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
  if (o.lijf === undefined || !isFinite(o.lijf)) o.lijf = kijk;
  const max = loopt ? 0.2 : 0.85, d = verschil(kijk, o.lijf), doel = d > max ? kijk - max : d < -max ? kijk + max : o.lijf;
  o.lijf += verschil(doel, o.lijf) * (1 - Math.exp(-(loopt ? 9 : 7) * Math.max(0, dt)));
  if (loopt) o.lijf += verschil(kijk, o.lijf) * (1 - Math.exp(-3 * Math.max(0, dt)));
  return verschil(kijk, o.lijf);
}
function popDelenHouding(naam, g) {
  const uit = {}; for (const [d, groep] of POP_GROEPEN.get(naam) || []) uit[d] = g[groep]; return uit;
}
// ---------------- de camera
// camSchouder: waar je schouder zit tegenover je ogen (van achteren richt je vanaf daar); camBob: het schommelen van je hoofd
let oogVorige = null, camPlek = null, camNu = 0, camSchouder = null, camBob = [0, 0];
const CAM_AFSTAND = 4, CAM_DICHTST = 0.8, CAM_NAMEN = ['Door je ogen', 'Van achteren', 'Van voren'];
// de gekozen camera, en de camera van dit beeldje (in een smalle gang past de camera niet achter je: dan even door je ogen)
function camModus() { return spelBezig ? inst.camera : 0; }
function camBeeld() { return camNu; }
function wisselCamera(naar) {
  inst.camera = naar === undefined ? (inst.camera + 1) % 3 : naar; bewaarInst();
  lichaamKlassen();
  melding(t('Camera: {0}', t(CAM_NAMEN[inst.camera])), true);
}
// is hier iets waar de camera niet doorheen mag (een blok dat licht tegenhoudt, of iets vasts)?
function camBotst(x, y, z) {
  const v = blokOp(Math.floor(x), Math.floor(y), Math.floor(z)); if (v < 0) return true;
  const id = v & 255; return !!(id && G.DICHT[id]);
}
// de camera achter of voor je, zo ver als kan zonder door een muur te gaan.
// Van achteren kijkt hij over je rechterschouder mee (anders staat je eigen hoofd precies voor wat je richt);
// richten gaat dan vanaf die schouder, langs het kruisje (schouder in het antwoord).
const SCHOUDER = [0.55, 0.12]; // opzij en omhoog
function camAchterVoor(oog, yaw, pitch, voor) {
  const cp = Math.cos(pitch), f = [-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp], s = voor ? 1 : -1;
  let o = oog;
  if (!voor) {
    const rx = Math.cos(yaw), rz = -Math.sin(yaw);
    let z = 0;
    for (; z < SCHOUDER[0]; z += 0.05) if (camBotst(oog[0] + rx * (z + 0.25), oog[1] + SCHOUDER[1] * z / SCHOUDER[0], oog[2] + rz * (z + 0.25))) break;
    z = Math.min(SCHOUDER[0], z);
    o = [oog[0] + rx * z, oog[1] + SCHOUDER[1] * z / SCHOUDER[0], oog[2] + rz * z];
  }
  let d = 0.3;
  for (; d < CAM_AFSTAND; d += 0.1) { if (camBotst(o[0] + f[0] * s * d, o[1] + f[1] * s * d, o[2] + f[2] * s * d)) break; }
  d = Math.max(0.35, d - 0.3);
  return { x: o[0] + f[0] * s * d, y: o[1] + f[1] * s * d, z: o[2] + f[2] * s * d, yaw: voor ? yaw + Math.PI : yaw, pitch: voor ? -pitch : pitch, afstand: d, schouder: o };
}
// de camera voor dit beeldje (de oogplek met het schommelen van je hoofd, en de stand van de camera)
function maakCamera(bobX, bobY) {
  const oog = [sp.x + Math.cos(sp.yaw) * bobX, sp.y + sp.oog - sp.stapOp + bobY, sp.z - Math.sin(sp.yaw) * bobX];
  oogVorige = oog; camBob = [bobX, bobY];
  const C = { x: oog[0], y: oog[1], z: oog[2], yaw: sp.yaw, pitch: sp.pitch, fov: (inst.fov + sp.fovExtra) * Math.PI / 180, schaal: dynSchaal };
  const m = camModus(), vorig = camNu; camNu = 0;
  if (m && wereldKlaar) {
    const o = [sp.x, sp.y + sp.oog, sp.z], c = camAchterVoor(o, sp.yaw, sp.pitch, m === 2);
    // (een beetje speling, zodat hij op de grens niet heen en weer springt)
    if (c.afstand >= (vorig === m ? CAM_DICHTST : CAM_DICHTST + 0.3)) { C.x = c.x; C.y = c.y; C.z = c.z; C.yaw = c.yaw; C.pitch = c.pitch; C.afstand = c.afstand; camNu = m; }
    camSchouder = camNu === 1 ? [c.schouder[0] - o[0], c.schouder[1] - o[1], c.schouder[2] - o[2]] : null;
  } else camSchouder = null;
  if (camNu !== vorig) lichaamKlassen();
  camPlek = [C.x, C.y, C.z];
  return C;
}
// ---------------- jezelf tekenen (van achteren en van voren)
let popZwaai = 1;
const popEigen = { lijf: undefined, t: 0 };
function popTeken(wezens, licht, hand) {
  if (!camBeeld() || !wereldKlaar) return;
  const nu = performance.now() / 1000, dt = popEigen.t ? Math.min(0.1, nu - popEigen.t) : 0; popEigen.t = nu;
  const naam = popModel(opslag.pop, popKnippert(1, nu)); if (!naam) return;
  const v = Math.hypot(sp.vx, sp.vz);
  // in het water, op een ladder of in een karretje draait het lijf meteen mee
  const kop = sp.inWater || sp.opLadder || rijdtIn ? (popEigen.lijf = sp.yaw, 0) : popLijf(popEigen, sp.yaw, v > 0.6, dt);
  const s = { v, fase: sp.schommelT, grond: sp.opGrond, water: sp.inWater && !sp.opGrond, ladder: sp.opLadder, sluip: sp.sluipt, kar: !!rijdtIn,
    hak: hand.soort === 'hak' && hand.zwaai > 0 ? hand.zwaai : -1, eet: hand.eet, zwaai: hand.zwaai || 1, pitch: sp.pitch, kop, t: nu, n: 1, vliegt: sp.vliegt };
  const { g, lichaam } = popHouding(s);
  const w = { model: naam, x: sp.x, y: sp.y + (s.water ? 0.55 : 0), z: sp.z, yaw: popEigen.lijf + Math.PI, pitch: lichaam, delen: popDelenHouding(naam, g), licht, schaal: POP_SCHAAL };
  if (hand.id) { const it = IT[hand.id], bl = it && it.blok ? BL[it.blok] : null; w.vast = { id: hand.id, deel: 'handR', plek: POP_HANDPLEK, soort: it && it.gereed ? 'gereed' : bl && (bl.vorm === 'fakkel' || bl.vorm === 'kaars') ? 'rechtop' : bl ? 'blok' : 'klein' }; }
  wezens.push(w);
}
// de arm in beeld (door je eigen ogen): dezelfde huid, en de mouw van je bovenstuk
function popArm(hand) {
  const p = opslag.pop, k = popKleuren(p), boven = popKeuze(p, 'boven');
  hand.huid = k.huid; hand.mouw = boven === 'overall' ? hexKleur('#F2EFE6') : k.boven; hand.kort = !POP.POP_LANGE_MOUW.has(boven);
}

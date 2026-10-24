// Dieren en griezels, de gedeelde code (stap 4): node test/wezens.js
// 1. de kuddetjes van een stuk staan vast voor een zaadje (zo ziet de server straks hetzelfde)
// 2. op een nagemaakt stukje wereld: dieren blijven in een wei met een hek, gaan niet het water in, vallen niet van een rand
// 3. vriendelijke dieren doen nooit pijn; griezels wel, behalve bij 'vredig', en minder bij 'makkelijk'
// 4. een spookje blijft op afstand van een speler bij een lamp; raken, wegrennen, buit
const { G } = require('../shared/index.js');
const WZ = G.WEZENS, B = G.B, S = WZ.WEZENS, WI = WZ.WI;
let fouten = 0; const mis = (...a) => { fouten++; console.log('MIS:', ...a); };
// ---------- een nagemaakt stukje wereld: een vlakte van gras op hoogte 64 (blokken eronder), met wat je erin zet
function wereld(extra) {
  const m = new Map(), k = (x, y, z) => x + ',' + y + ',' + z;
  const W = {
    zet: (x, y, z, v) => m.set(k(x, y, z), v),
    blok: (x, y, z) => { if (Math.abs(x) > 60 || Math.abs(z) > 60) return -1; const v = m.get(k(x, y, z)); if (v !== undefined) return v; return y < 64 ? B.steen : y === 64 ? B.gras : 0; },
    licht: () => 0xF0, biome: () => G.BI.vlakte, tijd: 0.5, spelers: [], r: rng(7), moeilijk: 'normaal',
  };
  if (extra) extra(W);
  return W;
}
function rng(s) { return G.rng(s); }
const loop = (lijst, W, sec, dt) => { const uit = []; for (let t = 0; t < sec; t += dt) for (const w of lijst) uit.push(...WZ.stap(w, dt, W)); return uit; };
// ---------- 1. vaste kuddetjes
const kolom = () => ({ y: 64, blok: B.gras, water: false, biome: G.BI.vlakte });
const a = [], b = [];
let metKudde = 0;
for (let cx = -20; cx < 20; cx++) for (let cz = -20; cz < 20; cz++) { const d1 = WZ.stukDieren(777, cx, cz, kolom), d2 = WZ.stukDieren(777, cx, cz, kolom); a.push(JSON.stringify(d1)); b.push(JSON.stringify(d2)); if (d1.length) metKudde++; }
if (a.join() !== b.join()) mis('twee keer hetzelfde stuk gaf andere dieren');
const ander = []; for (let cx = -20; cx < 20; cx++) for (let cz = -20; cz < 20; cz++) ander.push(JSON.stringify(WZ.stukDieren(778, cx, cz, kolom)));
if (ander.join() === a.join()) mis('een ander zaadje gaf precies dezelfde dieren');
const deel = metKudde / 1600;
if (deel < 0.08 || deel > 0.22) mis('kuddetjes in ' + (deel * 100).toFixed(1) + '% van de stukken');
console.log('kuddetjes: vast per zaadje; in ' + (deel * 100).toFixed(1) + '% van de stukken (vlakte)');
// welke dieren bij welke streek
const perBiome = {};
for (const [k, i] of Object.entries(G.BI)) { const s = new Set(); for (let c = 0; c < 400; c++) for (const d of WZ.stukDieren(4242, c, 7, () => ({ y: 64, blok: k === 'rivier' || k === 'moeras' ? B.water : k === 'strand' ? B.zand : B.gras, water: k === 'rivier' || k === 'moeras', biome: i }))) s.add(S[d.s].sleutel); perBiome[k] = [...s].join(' ') || '-'; }
console.log('per streek:', Object.entries(perBiome).map(([k, v]) => k + ': ' + v).join(' | '));
if (perBiome.vlakte.split(' ').length < 2) mis('te weinig soorten op de vlakte');
if (!perBiome.rivier.includes('eend')) mis('geen eenden in de rivier');
if (perBiome.oceaan !== '-') mis('dieren in de oceaan: ' + perBiome.oceaan);
// ---------- 2. een wei met een hek: 12 x 12, de dieren erin
{
  const W = wereld(W => { for (let i = -6; i <= 6; i++) for (const [x, z] of [[i, -6], [i, 6], [-6, i], [6, i]]) W.zet(x, 65, z, B.hek); });
  const dieren = []; for (let i = 0; i < 8; i++) dieren.push(WZ.nieuwWezen([WI.koe, WI.schaap, WI.kip, WI.konijn][i % 4], -3 + (i % 4) * 2 + 0.5, 65, -2 + Math.floor(i / 4) * 3 + 0.5, i, 1000 + i));
  loop(dieren, W, 240, 0.05);
  const buiten = dieren.filter(w => Math.abs(w.x) > 5.6 || Math.abs(w.z) > 5.6 || w.y < 64.9 || w.y > 66.2);
  const liep = dieren.filter(w => w.fase > 2).length;
  if (buiten.length) mis('uit de wei:', buiten.map(w => S[w.s].sleutel + ' ' + [w.x, w.y, w.z].map(v => v.toFixed(1)).join(',')).join('; '));
  if (liep < 6) mis('maar ' + liep + ' van de 8 dieren liepen rond');
  console.log('wei met hek: na 4 minuten ' + (8 - buiten.length) + ' van de 8 nog binnen, ' + liep + ' liepen rond');
}
// ---------- 2b. een vijver en een rand: geen landdier in het water, niemand eraf
{
  const W = wereld(W => {
    for (let x = 2; x < 10; x++) for (let z = -4; z < 4; z++) { W.zet(x, 64, z, B.water); W.zet(x, 63, z, B.water); }
    // een plateau van 3 hoog in de hoek
    for (let x = -14; x < -6; x++) for (let z = -4; z < 4; z++) for (let y = 65; y <= 67; y++) W.zet(x, y, z, y === 67 ? B.gras : B.aarde);
  });
  const dieren = [];
  for (let i = 0; i < 6; i++) dieren.push(WZ.nieuwWezen([WI.koe, WI.schaap, WI.kip][i % 3], 0.5, 65, -2 + i * 0.8, i * 1.1, 2000 + i));
  const boven = []; for (let i = 0; i < 4; i++) boven.push(WZ.nieuwWezen([WI.koe, WI.schaap][i % 2], -10.5 + i, 68, 0.5, i, 3000 + i));
  const eenden = [WZ.nieuwWezen(WI.eend, 5.5, 64.5, 0.5, 0, 4000), WZ.nieuwWezen(WI.eend, 6.5, 64.5, -1.5, 1, 4001)];
  loop(dieren.concat(boven, eenden), W, 240, 0.05);
  const nat = dieren.filter(w => w.x > 1.7 && w.x < 10.3 && w.z > -4.3 && w.z < 4.3);
  if (nat.length) mis('landdieren in het water:', nat.map(w => S[w.s].sleutel).join(', '));
  const gevallen = boven.filter(w => w.y < 67.9);
  if (gevallen.length) mis('van het plateau gevallen:', gevallen.map(w => S[w.s].sleutel + ' y ' + w.y.toFixed(1)).join(', '));
  console.log('vijver en rand: ' + nat.length + ' landdieren in het water, ' + gevallen.length + ' van het plateau; eenden drijven op ' + eenden.map(w => w.y.toFixed(2)).join(' en '));
}
// ---------- 2c. vallen op een dunne vloer, ook met grote tijdstapjes: niemand valt erdoorheen
{
  const W = wereld(W => { for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) W.zet(x, 100, z, B.planken_eik); });
  const uit = [];
  for (const dt of [0.016, 0.1, 0.6]) for (const s of [WI.hagedis, WI.kip, WI.koe]) { const w = WZ.nieuwWezen(s, 0.5, 140, 0.5, 0, 9000); w.t = 1e9; for (let t = 0; t < 20; t += dt) WZ.stap(w, dt, W); uit.push(S[s].sleutel + '@' + dt + ':' + w.y.toFixed(2)); if (Math.abs(w.y - 101) > 0.05) mis('door een vloer gevallen: ' + S[s].sleutel + ' bij stapjes van ' + dt + ' s (y ' + w.y.toFixed(2) + ')'); }
  console.log('vallen op een vloer van één blok:', uit.join(' '));
}
// ---------- 3. pijn doen
function naastSpeler(s, moeilijk, lamp, tijd) {
  const W = wereld(); W.moeilijk = moeilijk; W.tijd = tijd === undefined ? 0.9 : tijd;
  W.licht = () => (lamp ? (15 << 4) | lamp : 0xF0);
  W.spelers = [{ id: 'ik', x: 0.5, y: 65, z: 0.5 }];
  const w = WZ.nieuwWezen(s, 2.5, S[s].zweeft ? 65.5 : 65, 0.5, 0, 5000);
  const uit = loop([w], W, 12, 0.05).filter(e => e.soort === 'raak');
  return { n: uit.length, schade: uit.map(e => e.schade), dicht: Math.hypot(w.x - 0.5, w.z - 0.5) };
}
for (const s of S.filter(x => x.vriend)) { const r = naastSpeler(s.id, 'moeilijk'); if (r.n) mis(s.sleutel + ' deed pijn'); }
console.log('vriendelijke dieren: geen enkele keer pijn gedaan (' + S.filter(x => x.vriend).map(x => x.sleutel).join(', ') + ')');
const tabel = {};
for (const g of ['spookje', 'grotkwal', 'braambol']) for (const m of ['vredig', 'makkelijk', 'normaal', 'moeilijk']) { const r = naastSpeler(WI[g], m); tabel[g + ' ' + m] = r.n ? r.n + 'x ' + r.schade[0] : '-'; }
console.log('griezels naast je, 12 seconden:', JSON.stringify(tabel));
for (const g of ['spookje', 'grotkwal', 'braambol']) {
  if (tabel[g + ' vredig'] !== '-') mis(g + ' deed pijn bij vredig');
  if (tabel[g + ' normaal'] === '-') mis(g + ' deed geen pijn bij normaal');
  const s = m => +String(tabel[g + ' ' + m]).split(' ')[1] || 0;
  if (!(s('makkelijk') < s('normaal') && s('normaal') < s('moeilijk'))) mis(g + ': schade loopt niet op met de moeilijkheid');
}
// een spookje en een lamp
const lamp = naastSpeler(WI.spookje, 'normaal', 12);
if (lamp.n) mis('een spookje raakte je terwijl je bij een lamp stond');
console.log('spookje bij een lamp: ' + lamp.n + ' keer geraakt, het bleef ' + lamp.dicht.toFixed(1) + ' blokken weg');
// ---------- 4. raken en buit
{
  const w = WZ.nieuwWezen(WI.koe, 0.5, 65, 0.5, 0, 6000), W = wereld();
  const zwaard = G.IT[G.I.zwaard_ijzer], hand = null;
  const s1 = WZ.slagSchade(hand), s2 = WZ.slagSchade(zwaard);
  if (!(s2 > s1)) mis('een zwaard doet niet meer schade dan je hand');
  WZ.geraakt(w, s1, 3, 0.5);
  if (w.st !== 'vlucht') mis('een geraakte koe rent niet weg');
  loop([w], W, 2, 0.05);
  if (!(w.x < 0)) mis('de koe rende niet van je weg (x ' + w.x.toFixed(1) + ')');
  // vlak na een klap is een wezen even onkwetsbaar: een tweede klap meteen erna doet niets
  const hp0 = w.hp; WZ.geraakt(w, s2, w.x + 2, w.z); const hp1 = w.hp; WZ.geraakt(w, s2, w.x + 2, w.z);
  if (!(hp0 - hp1 > 0) || w.hp !== hp1) mis('een tweede klap vlak na de eerste deed ook schade (' + hp0 + ' -> ' + hp1 + ' -> ' + w.hp + ')');
  let dood = false; for (let i = 0; i < 10 && !dood; i++) { loop([w], W, 0.6, 0.05); dood = WZ.geraakt(w, s2, w.x + 2, w.z); }
  if (!dood) mis('een koe gaat niet dood met een ijzeren zwaard');
  const buit = {}; for (let i = 0; i < 500; i++) for (const [k, n] of WZ.buitVan(WZ.nieuwWezen(WI.schaap, 0, 0, 0), rng(i))) buit[k] = Math.max(buit[k] || 0, n);
  if (!(buit.wol >= 1 && buit.wol <= 2)) mis('schaap geeft geen 1 tot 2 wol');
  console.log('raken: hand ' + s1 + ', ijzeren zwaard ' + s2 + '; een geraakte koe rent weg; een schaap geeft tot ' + buit.wol + ' wol');
}
// een kip legt eieren
{ const w = WZ.nieuwWezen(WI.kip, 0.5, 65, 0.5, 0, 7000), W = wereld(); const e = loop([w], W, 1000, 0.1).filter(x => x.soort === 'ei').length; if (e < 2 || e > 4) mis('een kip legde ' + e + ' eieren in 1000 seconden'); console.log('kip: ' + e + ' eieren in 1000 seconden'); }
// ---------- welke griezel waar
{
  const W = wereld(); W.tijd = 0.9; W.licht = (x, y, z) => (y < 40 ? 0x00 : 0xF0);
  const s1 = WZ.griezelVoor(W, 0, 65, 0); W.tijd = 0.5; const s2 = WZ.griezelVoor(W, 0, 65, 0), s3 = WZ.griezelVoor(W, 0, 30, 0);
  W.licht = () => 0xF8; W.tijd = 0.9; const s4 = WZ.griezelVoor(W, 0, 65, 0);
  if (s1 !== WI.spookje && s1 !== WI.braambol) mis('geen griezel buiten in de nacht');
  if (s2 !== -1) mis('een griezel buiten op klaarlichte dag');
  if (s3 !== WI.grotkwal) mis('geen grotkwal diep in een donkere grot');
  if (s4 !== -1) mis('een griezel in het licht van een lamp');
  console.log('waar: nacht buiten ' + (s1 >= 0 ? S[s1].sleutel : '-') + ', dag buiten -, donkere grot ' + (s3 >= 0 ? S[s3].sleutel : '-') + ', bij een lamp -');
}
// ---------- 5. het spookje: eerst cirkelen, dan een waarschuwing, dan pas een duik; opzij springen ontwijkt het,
// verdwaasd krijgt het dubbele schade, en een fakkel in je hand houdt het op afstand
{
  const nacht = W => { W.tijd = 0.95; W.licht = () => 0xF0 & 0x0F; return W; };
  // a. een speler die stil blijft staan: de eerste tik komt pas na een waarschuwing van minstens 0,8 s
  const W = nacht(wereld()), w = WZ.nieuwWezen(WI.spookje, 6.5, 66, 0.5, 0);
  W.spelers = [{ id: 'ik', x: 0.5, y: 65, z: 0.5 }];
  let t = 0, dreig = -1, eersteTik = -1; const st = new Set();
  for (; t < 30 && eersteTik < 0; t += 0.05) { for (const e of WZ.stap(w, 0.05, W)) { if (e.soort === 'dreig' && dreig < 0) dreig = t; if (e.soort === 'raak' && eersteTik < 0) eersteTik = t; } st.add(w.st); }
  console.log('spookje: standen ' + [...st].join(', ') + '; waarschuwing na ' + dreig.toFixed(1) + ' s, eerste tik na ' + eersteTik.toFixed(1) + ' s');
  if (!(dreig >= 0 && eersteTik >= 0 && eersteTik - dreig >= 0.8)) mis('het spookje tikte zonder eerst te waarschuwen');
  if (!st.has('cirkel')) mis('het spookje cirkelde niet');
  // b. wie bij de duik opzij springt, wordt niet geraakt, en het spookje is daarna verdwaasd
  let geraakt = 0, ontweken = 0, verdwaasd = 0;
  for (let p = 0; p < 20; p++) {
    const W2 = nacht(wereld()), g = WZ.nieuwWezen(WI.spookje, 6.5, 66, 0.5 + p * 0.1, 0), sp = { id: 'ik', x: 0.5, y: 65, z: 0.5 }; W2.spelers = [sp];
    let duik = false, klaar = false;
    for (let tt = 0; tt < 30 && !klaar; tt += 0.05) {
      for (const e of WZ.stap(g, 0.05, W2)) { if (e.soort === 'duik') duik = true; if (e.soort === 'raak') { geraakt++; klaar = true; } if (e.soort === 'gemist') { ontweken++; klaar = true; } }
      // zodra de waarschuwing begint, stapt de speler opzij (2 blokken per seconde, haaks op het spookje)
      if (g.st === 'aanloop' || g.st === 'duik') { const ax = g.x - sp.x, az = g.z - sp.z, l = Math.hypot(ax, az) || 1; sp.x += -az / l * 3 * 0.05; sp.z += ax / l * 3 * 0.05; }
    }
    if (g.st === 'verdwaasd') verdwaasd++;
  }
  console.log('spookje: opzij stappen bij de waarschuwing: ' + ontweken + ' keer ontweken, ' + geraakt + ' keer toch geraakt, daarna ' + verdwaasd + ' keer verdwaasd');
  if (!(ontweken >= 16)) mis('opzij stappen ontwijkt het spookje te weinig');
  // c. verdwaasd: dubbele schade
  const v = WZ.nieuwWezen(WI.spookje, 0, 66, 0, 0); v.st = 'verdwaasd'; v.t = 2; const hp = v.hp; WZ.geraakt(v, 5, 3, 0);
  if (hp - v.hp !== 10) mis('een verdwaasd spookje kreeg geen dubbele schade (' + (hp - v.hp) + ')');
  // d. een fakkel in je hand: het spookje blijft op afstand en tikt niet
  const W3 = nacht(wereld()), f = WZ.nieuwWezen(WI.spookje, 6.5, 66, 0.5, 0); W3.spelers = [{ id: 'ik', x: 0.5, y: 65, z: 0.5, fakkel: true }];
  let tik = 0, dichtst = 99; for (let tt = 0; tt < 20; tt += 0.05) { for (const e of WZ.stap(f, 0.05, W3)) if (e.soort === 'raak') tik++; dichtst = Math.min(dichtst, Math.hypot(f.x - 0.5, f.z - 0.5)); }
  console.log('spookje bij iemand met een fakkel: ' + tik + ' keer geraakt, hooguit ' + dichtst.toFixed(1) + ' blokken dichtbij');
  if (tik || dichtst < 5) mis('een fakkel in je hand houdt het spookje niet op afstand');
  // e. sterker dan vroeger, en maar een paar tegelijk
  if (!(G.WEZENS.WEZENS[WI.spookje].hp >= 20 && G.WEZENS.MOEILIJK.normaal.spoken === 2 && G.WEZENS.MOEILIJK.makkelijk.spoken === 1)) mis('spookjes zijn niet sterker of niet minder');
}
console.log(fouten ? 'MISLUKT: ' + fouten : 'dieren en griezels: alles goed');
process.exit(fouten ? 1 : 0);

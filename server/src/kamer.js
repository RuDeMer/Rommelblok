// Eén gedeelde wereld, in een eigen draad (worker_thread), zodat de andere werelden en het netwerk er niet op wachten.
// - de wereldbaas van de pagina (RB_WERELD) draait hier ook, in serverstand: licht, water en groei rond alle spelers;
//   wat er verandert, komt in zijn overlay (per stuk alles wat anders is dan het zaadje) en gaat naar de database
// - spelers: plekken (nagekeken), zinnetjes, de eigenaar en wat hij mag
// - acties: nagekeken (bereik, tempo, hakken, wie mag bouwen) en doorgestuurd; spullen op de grond met een nummer
// - kisten en ovens staan hier; een kist kan maar door één speler tegelijk open zijn, oude kisten vult de server zelf
// Het netwerk zelf zit in de hoofddraad (ingang.js): die stuurt ons berichten van spelers, en wij sturen tekst terug.
import { parentPort, workerData, Worker, MessageChannel } from 'node:worker_threads';
import { randomInt } from 'node:crypto';
import { G } from '../../shared/index.js';
import { RB_WERELD } from '../../client/src/werkers/werker.js';
import { openDb, hash } from './db.js';
import * as R from './regels.js';

const { wereldId, dbPad, inst } = workerData;
const { B, BL, IT, HOOG } = G;
const S = G.SAMEN, SP = G.SPULLEN;
const db = openDb(dbPad);
let W = db.wereld(wereldId);
const sk = (cx, cz) => (cx + 32768) * 65536 + (cz + 32768);
const plekSleutel = (x, y, z) => x + ',' + y + ',' + z;
const DAGLENGTE = 1200;
const ZICHT = 128;          // spelers en spullen zie je tot zo ver (blokken)
const MAX_LOS = 400;        // hooguit zoveel spullen tegelijk op de grond
const LOS_LEVEN = 330e3;    // daarna zijn ze weg (de pagina gooit ze na 300 s weg)
const AANTAL_MAKERS = 1;

// ---------------- berichten naar de hoofddraad
const post = m => parentPort.postMessage(m);
const tekst = m => JSON.stringify(m);
function stuur(s, m) { post({ t: 'naar', sids: [s.sid], s: typeof m === 'string' ? m : tekst(m) }); }
function stuurAlle(m, behalve) { const sids = []; for (const s of spelers.values()) if (s !== behalve) sids.push(s.sid); if (sids.length) post({ t: 'naar', sids, s: tekst(m) }); }
function stuurWie(lijst, m) { if (lijst.length) post({ t: 'naar', sids: lijst.map(s => s.sid), s: tekst(m) }); }
function sluit(sid, reden) { post({ t: 'sluit', sid, s: tekst({ t: 'nee', reden }) }); }

// ---------------- de wereldbaas, in deze draad
let wbBericht = null;
const ctx = { postMessage: m => vanWereldbaas(m), set onmessage(f) { wbBericht = f; }, get onmessage() { return wbBericht; } };
const WB = RB_WERELD(G, ctx);
const naarWb = m => wbBericht({ data: m });
const makers = [];
const start = G.maakWereld(W.zaad >>> 0).startPlek();
const START = [start.x, start.y, start.z];

// de veranderingen van de server zelf (water, groei, de oven): naar wie die stukken heeft
function vanWereldbaas(m) {
  if (m.t === 'blokken') verstuurBlokken(Array.from(m.a), null);
  else if (m.t === 'drop' && W.stand !== 'bouwen') {
    // weggespoeld door water: wat het blok oplevert, valt op de grond (zoals bij alleen spelen)
    for (const [id, n] of SP.opbrengst(m.v, null)) nieuwLos(m.x + 0.5, m.y + 0.3, m.z + 0.5, id, n, 0);
  }
}
// blokwaarden [x, y, z, v, ...] naar iedereen die dat stuk heeft (behalve wie het zelf deed)
function verstuurBlokken(a, behalve, extra) {
  const per = new Map();
  for (let i = 0; i < a.length; i += 4) {
    const k = sk(a[i] >> 4, a[i + 2] >> 4);
    for (const s of spelers.values()) {
      if (s === behalve || !s.stukken.has(k)) continue;
      let l = per.get(s); if (!l) per.set(s, l = []); l.push(a[i], a[i + 1], a[i + 2], a[i + 3]);
    }
  }
  for (const [s, l] of per) stuur(s, Object.assign({ t: 'blokken', a: l }, extra || {}));
}
// blokken op de server veranderen (zoals de pagina dat doet: in een geladen stuk meteen, anders in de overlay)
const zetBlokken = a => { if (a.length) naarWb({ t: 'zet', a }); };

// ---------------- opslag
const dingen = new Map();   // 'x,y,z' -> { soort: 'kist', inhoud } of { soort: 'oven', in, brand, uit, brandTijd, brandMax, kook }
const dingVies = new Set();
let tijd = W.tijd, dag = W.dag;
function laad() {
  for (const [cx, cz, a] of db.stukken(wereldId)) { const o = new Map(); for (const x of a) o.set(x >>> 16, x & 0xFFFF); WB.overlay.set(sk(cx, cz), o); }
  for (const [x, y, z, d] of db.dingen(wereldId)) dingen.set(plekSleutel(x, y, z), d);
}
function bewaar() {
  const lijst = [];
  for (const k of WB.overlayVies) {
    const o = WB.overlay.get(k); if (!o) continue;
    const a = new Uint32Array(o.size); let i = 0; for (const [p, v] of o) a[i++] = ((p << 16) | v) >>> 0;
    lijst.push([Math.floor(k / 65536) - 32768, (k % 65536) - 32768, a]);
  }
  WB.overlayVies.clear();
  if (lijst.length) db.bewaarStukken(wereldId, lijst);
  if (dingVies.size) { const l = []; for (const k of dingVies) { const [x, y, z] = k.split(',').map(Number); l.push([x, y, z, dingen.get(k) || null]); } dingVies.clear(); db.bewaarDingen(wereldId, l); }
  db.bewaarTijd(wereldId, tijd, dag);
  for (const s of spelers.values()) bewaarSpeler(s);
}
function bewaarSpeler(s) { db.bewaarSpeler(wereldId, s.hash, { naam: s.naam, pop: s.pop, plek: [...s.pos, ...s.kijk].map(v => Math.round(v * 100) / 100), data: s.data }); }

// ---------------- spelers
const spelers = new Map(); // sid -> speler
const magBouwen = s => s.eigenaar || W.regels.bouwen === 'iedereen';
const nabij = (s, p, r) => Math.abs(s.pos[0] - p[0]) <= r && Math.abs(s.pos[2] - p[2]) <= r;
function centraBijwerken() { naarWb({ t: 'spelers', lijst: [...spelers.values()].map(s => [s.pos[0], s.pos[2]]), straal: inst.serverStraal }); }
function geldigePlek(p) { return Array.isArray(p) && p.length >= 3 && R.getal(p[0], -3e7, 3e7) && R.getal(p[1], -64, 400) && R.getal(p[2], -3e7, 3e7); }

function erbij(m) {
  const eigenaar = !!m.sleutel && m.sleutel === W.eigenaar;
  // niet binnen: is er verder niemand, dan mag deze wereld weer dicht
  const weiger = reden => { sluit(m.sid, reden); if (!spelers.size) post({ t: 'leeg' }); };
  if (W.regels.geweerd.some(g => g.h === m.hash)) return weiger('geweerd');
  if (W.regels.dicht && !eigenaar) return weiger('dicht');
  // dezelfde speler nog een keer (een tweede tabblad of apparaat met hetzelfde geheim): de oude verbinding gaat dicht
  for (const o of [...spelers.values()]) if (o.hash === m.hash) { weg(o.sid); sluit(o.sid, 'elders'); }
  if (spelers.size >= inst.grens.spelersPerWereld) return weiger('vol');
  const oud = db.speler(wereldId, m.hash);
  const plek = oud && geldigePlek(oud.plek) ? oud.plek : null;
  const nu = Date.now();
  // de naam: een eigen naam als de eigenaar dat aanzette en deze speler er al een koos, anders de twee woorden;
  // nooit gelijk aan de naam van iemand anders die er nu is (dan andere woorden)
  let woordNaam = m.naam;
  for (let i = 0; i < 50 && naamOnline(naamSleutel(woordNaam)); i++) woordNaam = S.naamWillekeurig(() => randomInt(0, 2 ** 31) / 2 ** 31);
  let naam = woordNaam;
  if (W.regels.namen) { const eigen = db.naamVan(wereldId, m.hash); if (eigen && !naamOnline(S.naamSleutel(eigen))) naam = eigen; }
  const s = {
    sid: m.sid, hash: m.hash, naam, woordNaam, pop: m.pop, taal: m.taal, straal: m.straal, eigenaar,
    pos: plek ? plek.slice(0, 3) : START.slice(), kijk: plek && plek.length >= 5 ? [plek[3], plek[4]] : [Math.PI * 0.25, -0.15],
    f: 0, h: 0, a: 0, gaan: { h: S.SNEL.voorraad, v: S.SNEL.voorraadOmhoog, t: nu }, eerste: true, vrijTot: nu + 15000, corr: 0,
    data: oud ? oud.data : null, stukken: new Set(), midden: '', rij: [], hak: { voorraad: 1.5, t: nu }, open: null, slaapt: 0,
    zinnen: [], recent: [], gemeld: new Map(), bewaard: nu,
  };
  spelers.set(m.sid, s);
  stuur(s, {
    t: 'welkom', v: S.PROTOCOL, jij: s.sid,
    wereld: { id: wereldId, naam: W.naam, zaad: W.zaad >>> 0, stand: W.stand, moeilijk: W.moeilijk, tijd, dag, bouwen: W.regels.bouwen, dicht: W.regels.dicht, erts: W.regels.erts,
      namen: W.regels.namen, typen: W.regels.typen, commandos: W.regels.commandos, regen: weer.regen },
    eigenaar, plek: plek || null, start: START, data: s.data, naam: s.naam,
    nieuw: m.nieuw || null,
    spelers: [...spelers.values()].filter(o => o !== s).map(o => [o.sid, o.naam, o.pop, o.eigenaar ? 1 : 0]),
  });
  if (los.size) stuur(s, { t: 'los', l: [...los.values()].map(losRij) });
  stuurAlle({ t: 'erbij', sid: s.sid, naam: s.naam, pop: s.pop, eigenaar: eigenaar ? 1 : 0 }, s);
  centraBijwerken();
  stukkenTik(s);
}
function weg(sid) {
  const s = spelers.get(sid); if (!s) return;
  bewaarSpeler(s);
  spelers.delete(sid);
  stuurAlle({ t: 'weg', sid });
  centraBijwerken();
  if (!spelers.size) { bewaar(); post({ t: 'leeg' }); }
}

// ---------------- de stukken: wat anders is dan het zaadje, naar wie in de buurt is
// Per speler onthouden we welke stukken hij al kreeg; daarna gaat elke verandering daarin naar hem toe.
// Stukken ver weg vergeten we weer, en komt hij terug, dan krijgt hij het hele stuk opnieuw.
function stukkenTik(s) {
  const pcx = Math.floor(s.pos[0]) >> 4, pcz = Math.floor(s.pos[2]) >> 4, Rr = Math.min(12, s.straal) + 1;
  const midden = pcx + ',' + pcz; if (midden === s.midden) return; // alles in de buurt is al verstuurd
  for (const k of s.stukken) { const cx = Math.floor(k / 65536) - 32768, cz = (k % 65536) - 32768; if (Math.abs(cx - pcx) > Rr + 4 || Math.abs(cz - pcz) > Rr + 4) s.stukken.delete(k); }
  const lijst = []; let n = 0, klaar = true;
  for (let r = 0; r <= Rr && klaar; r++) for (let dz = -r; dz <= r && klaar; dz++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
    const k = sk(pcx + dx, pcz + dz); if (s.stukken.has(k)) continue;
    const o = WB.overlay.get(k);
    if (o && o.size) {
      if (n > 20000) { klaar = false; break; } // de rest bij de volgende tik
      const a = new Array(o.size * 2); let i = 0; for (const [p, v] of o) { a[i++] = p; a[i++] = v; }
      lijst.push([pcx + dx, pcz + dz, a]); n += o.size;
    }
    s.stukken.add(k);
  }
  if (lijst.length) stuur(s, { t: 'stuk', l: lijst });
  if (klaar) s.midden = midden;
}

// ---------------- bewegen
function plek(s, m) {
  const p = [m.x, m.y, m.z];
  if (!geldigePlek(p) || !R.getal(m.yaw, -1e4, 1e4) || !R.getal(m.pitch, -4, 4)) return;
  // na een terugzetting: berichten die nog onderweg waren tellen niet, tot de pagina laat weten dat ze hem kreeg
  if ((m.k | 0) !== s.corr) return;
  const nu = Date.now(), f = m.f | 0, get = WB.get;
  let goed;
  if (f & 16) goed = sprongMag(s, p);
  // de eerste plek na binnenkomen: de pagina zet je eerst op een veilige plek op de grond (niet in een boom), vlak bij je startplek
  else if (s.eerste && nu < s.vrijTot && Math.hypot(p[0] - s.pos[0], p[2] - s.pos[2]) < 48) { goed = true; s.gaan.t = nu; }
  else goed = R.bewegingGoed(s.gaan, s.pos, p, nu, f, W.stand === 'bouwen') && !(R.doorMuur(get, s.pos, p) && !R.zitVast(get, s.pos)) && !(R.zitVast(get, p) && !R.zitVast(get, s.pos));
  if (!goed) {
    s.corr = (s.corr + 1) % 1000; s.gaan = { h: 0, v: 0, t: nu };
    stuur(s, { t: 'plek', x: s.pos[0], y: s.pos[1], z: s.pos[2], k: s.corr });
    return;
  }
  if (f & 16) s.gaan = { h: S.SNEL.voorraad, v: S.SNEL.voorraadOmhoog, t: nu };
  s.eerste = false;
  const oud = (Math.floor(s.pos[0]) >> 4) + ',' + (Math.floor(s.pos[2]) >> 4);
  s.pos = p; s.kijk = [m.yaw, m.pitch]; s.f = f & 0xFF; s.h = R.geheel(m.h, 0, 4095) ? m.h : 0; s.a = R.geheel(m.a, 0, 255) ? m.a : 0;
  if ((Math.floor(p[0]) >> 4) + ',' + (Math.floor(p[2]) >> 4) !== oud) centraBijwerken();
}
// een sprong (na flauwvallen of wakker worden): alleen naar je startplek, of naar een bed dat er echt staat
function sprongMag(s, p) {
  const d = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
  if (d(p, START) < 24) return true;
  const bed = s.data && s.data.speler && s.data.speler.bed;
  if (geldigePlek(bed) && d(p, bed) < 3) {
    const v = WB.get(Math.floor(bed[0]), Math.floor(bed[1]), Math.floor(bed[2]));
    if (v < 0 || BL[v & 255] && BL[v & 255].vorm === 'bed') return true;
    for (const [dx, dz] of G.RICHTING) { const w = WB.get(Math.floor(bed[0]) + dx, Math.floor(bed[1]), Math.floor(bed[2]) + dz); if (w > 0 && BL[w & 255].vorm === 'bed') return true; }
  }
  return false;
}

// ---------------- acties (breken, plaatsen, gebruiken, een kist of oven, iets laten vallen)
// Een actie die een stuk nodig heeft dat de server nog maakt, wacht even in de rij van de speler (de volgorde blijft gelijk).
const SOORTEN = new Set(['breek', 'plaats', 'gebruik', 'kist', 'oven', 'los', 'ruil']);
function inRij(s, m) { s.rij.push({ m, sinds: Date.now() }); rijTik(s); }
function rijTik(s) {
  while (s.rij.length) {
    const r = s.rij[0], uit = verwerk(s, r.m, Date.now() - r.sinds > 15000);
    if (uit === 'wacht') return;
    s.rij.shift();
  }
}
function verwerk(s, m, opgeven) {
  if (m.t === 'actie') {
    // te veel acties per seconde: terugzetten wat de pagina al deed
    if (m.teSnel) return nee(s, m.a, ((m.a && Array.isArray(m.a.gevolg)) ? m.a.gevolg : []).filter(g => Array.isArray(g) && g[0] === 'b' && R.plekGoed(g[1], g[2], g[3])).slice(0, 64).map(g => [g[1], g[2], g[3]]), 'te-snel');
    return actie(s, m.a, opgeven);
  }
  if (m.t === 'open') return openDing(s, m, opgeven);
  if (m.t === 'dicht') { s.open = null; return 'klaar'; }
  return 'klaar';
}
function nee(s, a, posities, reden, extra) {
  const l = [];
  for (const [x, y, z] of posities) { const v = WB.get(x, y, z); if (v >= 0) l.push(x, y, z, v); }
  stuur(s, Object.assign({ t: 'nee', nr: a && R.geheel(a.nr, 0, 1e12) ? a.nr : -1, a: l, reden }, extra || {}));
  return 'klaar';
}
function actie(s, a, opgeven) {
  if (!a || typeof a !== 'object' || !SOORTEN.has(a.t) || !Array.isArray(a.gevolg) || a.gevolg.length > 120) return 'klaar';
  const bouwen = W.stand === 'bouwen';
  // alle blokken van deze actie
  const bl = [], ls = [], ks = [], vs = [];
  for (const g of a.gevolg) {
    if (!Array.isArray(g)) return nee(s, a, [], 'vorm');
    if (g[0] === 'b') { if (!R.plekGoed(g[1], g[2], g[3]) || !R.waardeGoed(g[4])) return nee(s, a, [], 'vorm'); bl.push(g); }
    else if (g[0] === 'l') ls.push(g);
    else if (g[0] === 'k') ks.push(g);
    else if (g[0] === 'v') vs.push(g);
    // 'w' (een kist is weg) rekent de server zelf uit; 'e' (karretjes en bewoners) blijven in stap 5 op je eigen pagina
  }
  if (bl.length > 64 || ls.length > 40 || ks.length > 30) return nee(s, a, bl.map(g => [g[1], g[2], g[3]]), 'te-veel');
  const pos = bl.map(g => [g[1], g[2], g[3]]);
  // is alles er al op de server?
  for (const [x, y, z] of pos) if (WB.get(x, y, z) < 0) return opgeven ? nee(s, a, pos, 'laden') : 'wacht';
  for (const g of vs) if (R.plekGoed(g[1], g[2], g[3]) && WB.get(g[1], g[2], g[3]) < 0) return opgeven ? nee(s, a, pos, 'laden') : 'wacht';
  // wie mag bouwen
  const mag = magBouwen(s);
  if (!mag && (ks.length || vs.length || bl.some(g => !R.alleenDeur(WB.get(g[1], g[2], g[3]), g[4])))) return nee(s, a, pos, 'mag-niet');
  // binnen bereik (met wat extra voor wat ernaast meegaat: de andere helft van een deur of bed, rails die aansluiten)
  for (const [x, y, z] of pos) if (!R.binnenBereik(s.pos, x, y, z, 2.5)) return nee(s, a, pos, 'bereik');
  // geen bodemsteen, en geen vast blok in een andere speler
  for (const g of bl) {
    const oud = WB.get(g[1], g[2], g[3]), ob = BL[oud & 255];
    if (oud > 0 && ob && ob.hard < 0 && g[4] !== oud) return nee(s, a, pos, 'bodem');
    if (g[4] && G.VAST[g[4] & 255] && !(oud > 0 && (oud & 255) === (g[4] & 255))) for (const o of spelers.values()) if (o !== s && inLijf(o.pos, g[1], g[2], g[3])) return nee(s, a, pos, 'speler');
  }
  // breken: niet sneller dan hakken kan (een voorraad van anderhalve seconde voor een haperende verbinding)
  if (a.t === 'breek' && !bouwen && bl.length && R.plekGoed(a.x, a.y, a.z)) {
    const oud = WB.get(a.x, a.y, a.z);
    if (oud <= 0) return nee(s, a, pos, 'weg');
    const min = S.hakMin(oud, R.geheel(a.met, 0, 4095) ? IT[a.met] : null);
    if (min < 0) return nee(s, a, pos, 'bodem');
    // de tijd sinds de vorige keer, plus hooguit anderhalve seconde die over was (voor een haperende verbinding)
    const nu = Date.now(), tijd = Math.min(1.5, s.hak.voorraad) + (nu - s.hak.t) / 1000; s.hak.t = nu;
    if (tijd < min * 0.6 - 0.05) { s.hak.voorraad = Math.max(0, tijd); return nee(s, a, pos, 'te-snel'); }
    s.hak.voorraad = tijd - min * 0.6;
  }
  // spullen op de grond: bestaan ze, en vallen ze vlakbij?
  for (const g of ls) if (!R.losGoed(g[4], g[5], g[6]) || !R.getal(g[1], -3e7, 3e7) || !R.getal(g[2], -64, 400) || !R.getal(g[3], -3e7, 3e7) || !R.binnenBereik(s.pos, g[1] - 0.5, g[2] - 0.5, g[3] - 0.5, 3)) return nee(s, a, pos, 'los');
  // kisten en ovens: alleen die je zelf open hebt
  for (const g of ks) {
    const k = R.plekGoed(g[1], g[2], g[3]) && plekSleutel(g[1], g[2], g[3]);
    const d = k && dingen.get(k);
    const vakOk = d && (d.soort === 'kist' ? R.geheel(g[4], 0, 26) : R.OVENVAK.has(g[4]));
    if (!k || s.open !== k || !d || !vakOk || !R.vakGoed(g[5])) return nee(s, a, pos, 'kist', { d: k && d ? [g[1], g[2], g[3], d] : null });
  }

  // ---- goedgekeurd: uitvoeren, in de volgorde van de pagina
  const voor = new Map(); for (const [x, y, z] of pos) { const k = plekSleutel(x, y, z); if (!voor.has(k)) voor.set(k, WB.get(x, y, z)); }
  for (const g of a.gevolg) {
    if (g[0] === 'b') zetBlokken([g[1], g[2], g[3], g[4]]);
    else if (g[0] === 'k') { const d = dingen.get(plekSleutel(g[1], g[2], g[3])); if (d.soort === 'kist') d.inhoud[g[4]] = R.schoonVak(g[5]); else d[g[4]] = R.schoonVak(g[5]); dingVies.add(plekSleutel(g[1], g[2], g[3])); }
    else if (g[0] === 'v') buitVullen(g[1], g[2], g[3], voor.has(plekSleutel(g[1], g[2], g[3])) ? voor.get(plekSleutel(g[1], g[2], g[3])) : WB.get(g[1], g[2], g[3]));
    else if (g[0] === 'l') nieuwLos(g[1], g[2], g[3], g[4], g[5], g[6] || 0);
  }
  // een kist of oven die weg is: de inhoud valt eruit (wat de server erin heeft, niet wat de pagina dacht)
  for (const [x, y, z] of pos) {
    const k = plekSleutel(x, y, z), d = dingen.get(k); if (!d) continue;
    if (R.soortDing(WB.get(x, y, z)) === d.soort) continue;
    dingen.delete(k); dingVies.add(k);
    for (const o of spelers.values()) if (o.open === k) o.open = null;
    if (!bouwen) for (const v of d.soort === 'kist' ? d.inhoud : [d.in, d.brand, d.uit]) if (v) nieuwLos(x + 0.5, y + 0.5, z + 0.5, v.id, v.n, v.dur || 0);
  }
  // naar de anderen, en de echte waarden terug naar jou (zo eindigt iedereen gelijk, ook als er net iets anders gebeurde)
  const na = []; for (const [x, y, z] of pos) na.push(x, y, z, WB.get(x, y, z));
  if (na.length) {
    const doel = R.plekGoed(a.x, a.y, a.z) ? [a.x, a.y, a.z] : null, v0 = doel ? voor.get(plekSleutel(...doel)) : undefined;
    verstuurBlokken(na, s, { wie: s.sid, s: a.t, p: doel, v: v0 });
  }
  stuur(s, { t: 'ja', nr: R.geheel(a.nr, 0, 1e12) ? a.nr : -1, a: na });
  s.recent.push([a.t, a.x | 0, a.y | 0, a.z | 0, Date.now()]); if (s.recent.length > 30) s.recent.shift();
  return 'klaar';
}
// staat een speler (voeten op p) in het blok x, y, z?
const inLijf = (p, x, y, z) => p[0] + 0.3 > x && p[0] - 0.3 < x + 1 && p[2] + 0.3 > z && p[2] - 0.3 < z + 1 && p[1] + 1.75 > y && p[1] < y + 1;

// ---------------- kisten en ovens
function buitVullen(x, y, z, v) {
  const k = plekSleutel(x, y, z); if (dingen.has(k) || (v & 255) !== B.buitkist) return;
  dingen.set(k, { soort: 'kist', inhoud: SP.buitInhoud(x, y, z, v, W.zaad >>> 0) }); dingVies.add(k);
}
function nieuwDing(soort) { return soort === 'kist' ? { soort, inhoud: new Array(27).fill(null) } : { soort, in: null, brand: null, uit: null, brandTijd: 0, brandMax: 0, kook: 0 }; }
function openDing(s, m, opgeven) {
  if (!R.plekGoed(m.x, m.y, m.z)) return 'klaar';
  const v = WB.get(m.x, m.y, m.z); if (v < 0) { if (!opgeven) return 'wacht'; stuur(s, { t: 'open', x: m.x, y: m.y, z: m.z, ok: false, reden: 'laden' }); return 'klaar'; }
  const k = plekSleutel(m.x, m.y, m.z), soort = R.soortDing(v);
  const weiger = reden => { stuur(s, { t: 'open', x: m.x, y: m.y, z: m.z, ok: false, reden }); return 'klaar'; };
  if (!soort) return weiger('weg');
  if (!R.binnenBereik(s.pos, m.x, m.y, m.z, 1.5)) return weiger('bereik');
  if (!magBouwen(s)) return weiger('mag-niet');
  for (const o of spelers.values()) if (o !== s && o.open === k) return weiger('bezet');
  if ((v & 255) === B.buitkist) buitVullen(m.x, m.y, m.z, v);
  let d = dingen.get(k); if (!d || d.soort !== soort) { d = nieuwDing(soort); dingen.set(k, d); dingVies.add(k); }
  s.open = k;
  stuur(s, { t: 'open', x: m.x, y: m.y, z: m.z, ok: true, d });
  return 'klaar';
}
let ovenKlok = Date.now();
function ovensTik() {
  const nu = Date.now(), dt = Math.min(2, (nu - ovenKlok) / 1000); ovenKlok = nu;
  const blokken = [];
  for (const [k, d] of dingen) {
    if (d.soort !== 'oven' || !(d.brandTijd > 0 || (d.in && d.brand) || d.kook > 0)) continue;
    const brandde = d.brandTijd > 0, wat = SP.ovenStap(d, dt);
    dingVies.add(k);
    const [x, y, z] = k.split(',').map(Number);
    if ((d.brandTijd > 0) !== brandde) {
      const v = WB.get(x, y, z), nv = (d.brandTijd > 0 ? B.oven_aan : B.oven) | (v & 0xFF00);
      if (v > 0 && R.OVEN.has(v & 255) && v !== nv) { zetBlokken([x, y, z, nv]); blokken.push(x, y, z, nv); }
    }
    // wie de oven open heeft, ziet hem werken
    for (const s of spelers.values()) if (s.open === k) stuur(s, { t: 'ding', x, y, z, d, wat });
  }
  if (blokken.length) verstuurBlokken(blokken, null);
}

// ---------------- spullen op de grond: elk met een nummer, zodat maar één speler ze kan oppakken
const los = new Map(); let losNr = 0;
const losRij = l => [l.id, l.x, l.y, l.z, l.item, l.n, l.dur];
function nieuwLos(x, y, z, item, n, dur) {
  if (!R.losGoed(item, n, dur)) return;
  if (los.size >= MAX_LOS) { const eerste = los.keys().next().value; los.delete(eerste); }
  const l = { id: ++losNr, x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, z: Math.round(z * 100) / 100, item, n, dur: dur || 0, tijd: Date.now() };
  los.set(l.id, l);
  nieuweLos.push(losRij(l));
}
let nieuweLos = [];
function raap(s, m) {
  const l = los.get(m.id);
  if (!l) { stuur(s, { t: 'opgeraapt', id: m.id, wie: -1, weg: true }); return; }
  if (Math.hypot(l.x - s.pos[0], l.y - (s.pos[1] + 0.8), l.z - s.pos[2]) > 5) { stuur(s, { t: 'opgeraapt', id: m.id, wie: -1 }); return; }
  los.delete(l.id);
  stuurAlle({ t: 'opgeraapt', id: l.id, wie: s.sid });
}

// ---------------- praten, slapen, melden, en wat de eigenaar mag
function zeg(s, m) {
  // een eigen tekst: alleen als de eigenaar vrij typen aanzette, en door het filter (geen scheldwoorden, links,
  // e-mailadressen of telefoonnummers, hooguit 80 tekens). Wie het stuurde, hoort of het goed was.
  if (typeof m.tekst === 'string') {
    if (!W.regels.typen) return stuur(s, { t: 'zeg-nee', reden: 'uit' });
    const f = S.tekstKlopt(m.tekst);
    if (!f.ok) return stuur(s, { t: 'zeg-nee', reden: f.reden });
    s.zinnen.push([f.tekst, Date.now()]); if (s.zinnen.length > 10) s.zinnen.shift();
    stuur(s, { t: 'zeg-ja', tekst: f.tekst });
    return stuurAlle({ t: 'zeg', wie: s.sid, tekst: f.tekst }, s);
  }
  if (!S.zinKlopt(m.n)) return;
  s.zinnen.push([m.n, Date.now()]); if (s.zinnen.length > 10) s.zinnen.shift();
  stuurAlle({ t: 'zeg', wie: s.sid, n: m.n }, s);
}
// ---------------- namen: twee namen zijn dezelfde als ze plat gelijk zijn ('Rode Vos' en 'rodevos'), ook tussen
// een eigen naam en twee woorden (in het Nederlands en het Engels)
const naamSleutel = n => (Array.isArray(n) ? S.naamSleutel(S.naamVan(n, 'nl')) + '|' + S.naamSleutel(S.naamVan(n, 'en')) : S.naamSleutel(n));
// (ook de twee woorden van wie nu een eigen naam heeft: die krijgt hij terug als de eigenaar eigen namen uitzet)
function naamOnline(sleutel, behalve) {
  const delen = sleutel.split('|'), zelfde = n => n && naamSleutel(n).split('|').some(k => delen.includes(k));
  for (const o of spelers.values()) if (o !== behalve && (zelfde(o.naam) || zelfde(o.woordNaam))) return true;
  return false;
}
// een speler kiest een eigen naam (of met een lege tekst: weer zijn twee woorden)
function kiesNaam(s, m) {
  if (!W.regels.namen) return stuur(s, { t: 'naam-nee', reden: 'uit' });
  if (!m.tekst.trim()) { db.zetNaam(wereldId, s.hash, '', null); return zetNaam(s, s.woordNaam); }
  const f = S.naamTekstKlopt(m.tekst); if (!f.ok) return stuur(s, { t: 'naam-nee', reden: f.reden });
  const sleutel = S.naamSleutel(f.naam), van = db.naamBezet(wereldId, sleutel);
  if ((van && van !== s.hash) || naamOnline(sleutel, s)) return stuur(s, { t: 'naam-nee', reden: 'bezet' });
  db.zetNaam(wereldId, s.hash, sleutel, f.naam);
  zetNaam(s, f.naam);
}
function zetNaam(s, naam) {
  s.naam = naam;
  stuur(s, { t: 'naam-ja', naam });
  stuurAlle({ t: 'naam', wie: s.sid, naam }, s);
}
function slaap(s) {
  const nacht = tijd < 0.23 || tijd > 0.77; if (!nacht) return;
  const nu = Date.now(); s.slaapt = nu;
  const wakker = [...spelers.values()].filter(o => nu - o.slaapt > 8000);
  if (!wakker.length) {
    dag += tijd > 0.5 ? 1 : 0; tijd = 0.255;
    for (const o of spelers.values()) o.slaapt = 0;
    stuurAlle({ t: 'tijd', tijd, dag, ochtend: true });
  } else stuurAlle({ t: 'slaap', wie: s.sid, slapen: spelers.size - wakker.length, van: spelers.size });
}
function meld(s, m) {
  const o = spelers.get(m.wie); if (!o || o === s) return;
  const nu = Date.now(); if (nu - (s.gemeld.get(o.hash) || 0) < 600e3) { stuur(s, { t: 'gemeld', wie: o.sid }); return; }
  s.gemeld.set(o.hash, nu);
  db.melding(wereldId, s.hash, o.hash, o.naam, { zinnen: o.zinnen.map(z => z[0]), acties: o.recent.slice(-20), eigenaar: o.eigenaar });
  stuur(s, { t: 'gemeld', wie: o.sid });
  // de eigenaar hoort het ook (niet wie het meldde)
  for (const e of spelers.values()) if (e.eigenaar && e !== o && e !== s) stuur(e, { t: 'gemeld', over: o.sid });
}
function nieuweCode() {
  for (let i = 0; i < 20; i++) {
    const code = S.maakCode(() => randomInt(0, 2 ** 31) / 2 ** 31);
    try { db.zetCode(wereldId, hash('code', code)); return code; } catch (e) { /* bestaat al: nog een keer */ }
  }
  return null;
}
function regelsNaarIedereen() {
  for (const s of spelers.values()) stuur(s, { t: 'regels', bouwen: W.regels.bouwen, dicht: W.regels.dicht, mag: magBouwen(s), geweerd: s.eigenaar ? W.regels.geweerd.length : undefined, namen: W.regels.namen, typen: W.regels.typen, commandos: W.regels.commandos });
}
function beheer(s, m) {
  if (!s.eigenaar) return;
  const r = W.regels, o = R.geheel(m.wie, 1, 1e12) ? spelers.get(m.wie) : null;
  switch (m.doe) {
    case 'code': { const c = nieuweCode(); stuur(s, { t: 'beheer', doe: 'code', code: c }); break; }
    case 'weg-sturen': if (o && o !== s) { weg(o.sid); sluit(o.sid, 'weggestuurd'); } break;
    case 'weren': if (o && o !== s && !o.eigenaar) { r.geweerd.push({ h: o.hash, n: o.naam }); if (r.geweerd.length > 500) r.geweerd.shift(); db.zetRegels(wereldId, r); weg(o.sid); sluit(o.sid, 'geweerd'); regelsNaarIedereen(); } break;
    case 'niemand-weren': r.geweerd = []; db.zetRegels(wereldId, r); regelsNaarIedereen(); break;
    case 'bouwen': if (m.wie === 'iedereen' || m.wie === 'eigenaar') { r.bouwen = m.wie; db.zetRegels(wereldId, r); regelsNaarIedereen(); } break;
    case 'typen': r.typen = m.aan === true; db.zetRegels(wereldId, r); regelsNaarIedereen(); break;
    case 'namen': {
      r.namen = m.aan === true; db.zetRegels(wereldId, r); regelsNaarIedereen();
      // uit: iedereen weer zijn twee woorden; aan: wie al een eigen naam had in deze wereld, krijgt die terug
      for (const x of spelers.values()) {
        if (!r.namen && typeof x.naam === 'string') zetNaam(x, x.woordNaam);
        else if (r.namen) { const eigen = db.naamVan(wereldId, x.hash); if (eigen && !naamOnline(S.naamSleutel(eigen), x)) zetNaam(x, eigen); }
      }
      break;
    }
    case 'dicht': {
      r.dicht = !!m.aan; db.zetRegels(wereldId, r);
      if (r.dicht) for (const x of [...spelers.values()]) if (!x.eigenaar) { weg(x.sid); sluit(x.sid, 'dicht'); }
      regelsNaarIedereen(); break;
    }
    case 'verwijder': {
      for (const x of [...spelers.values()]) { spelers.delete(x.sid); sluit(x.sid, 'verwijderd'); }
      db.verwijderWereld(wereldId); verwijderd = true; stop(); break;
    }
  }
}

// ---------------- het weer: af en toe regen (in koude streken sneeuw; dat ziet de pagina zelf). Niet bewaard.
const weer = { regen: false, wissel: Date.now() + (6 + Math.random() * 8) * 60e3 };
function weerTik(nu) {
  if (nu < weer.wissel) return;
  weer.regen = !weer.regen; weer.wissel = nu + (weer.regen ? 2 + Math.random() * 3 : 6 + Math.random() * 8) * 60e3;
  stuurAlle({ t: 'weer', regen: weer.regen });
}
// ---------------- commando's: alleen de eigenaar, en de server voert ze zelf uit. Daarna telt de wereld niet meer
// voor het logboek (regels.commandos), zodat overleven zijn uitdaging houdt.
function commando(s, m) {
  if (!s.eigenaar) return stuur(s, { t: 'cmd', ok: false, reden: 'eigenaar' });
  let ok = false;
  switch (m.wat) {
    case 'tijd': if (R.getal(m.tijd, 0, 1)) { tijd = m.tijd; stuurAlle({ t: 'tijd', tijd, dag }); ok = true; } break;
    case 'weer': if (typeof m.regen === 'boolean') { weer.regen = m.regen; weer.wissel = Date.now() + (m.regen ? 5 : 12) * 60e3; stuurAlle({ t: 'weer', regen: weer.regen }); ok = true; } break;
    case 'stand': if (m.stand === 'bouwen' || m.stand === 'overleven') { W.stand = m.stand; db.zetStand(wereldId, m.stand); stuurAlle({ t: 'stand', stand: m.stand }); ok = true; } break;
    case 'ga': {
      // naar een plek, of naar een andere speler
      let p = null;
      if (R.geheel(m.wie, 1, 1e12)) { const o = spelers.get(m.wie); if (o && o !== s) p = o.pos.slice(); }
      else if (geldigePlek([m.x, m.y, m.z])) p = [m.x, m.y, m.z];
      if (p) { s.pos = p; s.corr = (s.corr + 1) % 1000; s.gaan = { h: S.SNEL.voorraad, v: S.SNEL.voorraadOmhoog, t: Date.now() }; stuur(s, { t: 'plek', x: p[0], y: p[1], z: p[2], k: s.corr, ga: true }); centraBijwerken(); s.midden = ''; stukkenTik(s); ok = true; }
      break;
    }
    case 'geef': {
      // een voorwerp voor jezelf of voor een andere speler
      const o = R.geheel(m.wie, 1, 1e12) ? spelers.get(m.wie) : s;
      if (o && R.losGoed(m.id, m.n, 0)) { stuur(o, { t: 'krijg', id: m.id, n: m.n }); ok = true; }
      break;
    }
  }
  if (!ok) return stuur(s, { t: 'cmd', ok: false, reden: 'vorm' });
  if (!W.regels.commandos) { W.regels.commandos = true; db.zetRegels(wereldId, W.regels); regelsNaarIedereen(); }
  stuur(s, { t: 'cmd', ok: true, wat: m.wat });
}

// ---------------- berichten van de hoofddraad
let klaar = false, verwijderd = false, gestopt = false;
const wachtrij = [];
function bericht(m) {
  if (gestopt) return;
  if (!klaar) { wachtrij.push(m); return; }
  if (m.t === 'erbij') return erbij(m);
  if (m.t === 'weg') return weg(m.sid);
  if (m.t === 'stop') return stop();
  if (m.t === 'beheer-dicht') { W.regels.dicht = !!m.aan; db.zetRegels(wereldId, W.regels); if (m.aan) for (const x of [...spelers.values()]) { weg(x.sid); sluit(x.sid, 'dicht'); } return; }
  if (m.t !== 'bericht') return;
  const s = spelers.get(m.sid); if (!s) return;
  const b = m.m;
  switch (b.t) {
    case 'p': plek(s, b); break;
    case 'actie': case 'open': case 'dicht': inRij(s, b); break;
    case 'raap': if (R.geheel(b.id, 1, 1e12)) raap(s, b); break;
    case 'zeg': zeg(s, b); break;
    case 'slaap': slaap(s); break;
    case 'meld': meld(s, b); break;
    case 'beheer': beheer(s, b); break;
    case 'naam': if (typeof b.tekst === 'string') kiesNaam(s, b); break;
    case 'cmd': commando(s, b); break;
    case 'bewaar': if (b.d && typeof b.d === 'object' && !Array.isArray(b.d)) { s.data = b.d; if (Date.now() - s.bewaard > 20000) { s.bewaard = Date.now(); bewaarSpeler(s); } } break;
  }
}
parentPort.on('message', m => { try { bericht(m); } catch (e) { console.error('kamer', wereldId, e); } });

// ---------------- de klok: 20 keer per seconde
let laatsteTik = Date.now(), klokSpelers = 0, klokStukken = 0, klokOven = 0, klokTijd = 0, klokBewaar = Date.now(), tikker = null;
function tik() {
  const nu = Date.now(), dt = (nu - laatsteTik) / 1000; laatsteTik = nu;
  const oud = tijd; tijd = (tijd + dt / DAGLENGTE) % 1; if (tijd < oud) dag++;
  for (const s of spelers.values()) if (s.rij.length) rijTik(s);
  if (nieuweLos.length) { stuurAlle({ t: 'los', l: nieuweLos }); nieuweLos = []; }
  if (nu - klokSpelers >= 100) {
    klokSpelers = nu;
    for (const s of spelers.values()) {
      const l = [];
      for (const o of spelers.values()) if (o !== s && nabij(s, o.pos, ZICHT)) l.push([o.sid, ...o.pos.map(v => Math.round(v * 100) / 100), Math.round(o.kijk[0] * 100) / 100, Math.round(o.kijk[1] * 100) / 100, o.f, o.h, o.a]);
      if (l.length) stuur(s, { t: 'spelers', l });
    }
  }
  if (nu - klokStukken >= 200) { klokStukken = nu; for (const s of spelers.values()) stukkenTik(s); }
  if (nu - klokOven >= 500) {
    klokOven = nu; ovensTik();
    for (const [id, l] of los) if (nu - l.tijd > LOS_LEVEN) los.delete(id);
  }
  if (nu - klokTijd >= 5000) { klokTijd = nu; stuurAlle({ t: 'tijd', tijd, dag }); weerTik(nu); }
  if (nu - klokBewaar >= 10000) { klokBewaar = nu; try { bewaar(); } catch (e) { console.error('bewaren', wereldId, e); } }
}
function stop() {
  if (gestopt) return; gestopt = true;
  clearInterval(tikker); tikker = null;
  if (!verwijderd) { try { bewaar(); } catch (e) { console.error('bewaren', wereldId, e); } }
  try { naarWb({ t: 'stop' }); } catch (e) { /* al gestopt */ }
  for (const m of makers) m.w.terminate();
  db.sluit();
  post({ t: 'gestopt', verwijderd });
  setTimeout(() => process.exit(0), 50);
}

// ---------------- beginnen
for (let i = 0; i < AANTAL_MAKERS; i++) {
  const w = new Worker(new URL('./maker.js', import.meta.url)), ch = new MessageChannel();
  w.postMessage({ t: 'poort', poort: ch.port1 }, [ch.port1]);
  makers.push({ w, poort: ch.port2 });
}
await naarWb({ t: 'start', nr: 1, zaad: W.zaad >>> 0, wid: null, gen: 3, erts: W.regels.erts, straal: inst.serverStraal, x: START[0], y: START[1], z: START[2], opties: { server: true }, centra: [], poorten: makers.map(m => m.poort) });
laad();
klaar = true;
tikker = setInterval(tik, 50);
post({ t: 'klaar' });
for (const m of wachtrij.splice(0)) bericht(m);
// testhaak: hoeveel stukken de wereldbaas nu heeft (alleen via een bericht van de hoofddraad)
export const __kamer = { WB, spelers, dingen, los };

// ============================================================================
// Samen spelen (stap 5): een gedeelde wereld op de spelserver (server/ in de repository).
// Alleen spelen gaat precies zoals altijd: dit deel doet pas iets als je een gedeelde wereld opent.
// - Wat jij doet, zie je meteen. De server keurt het goed ('ja', met de echte blokken) of zet het terug ('nee').
// - Wat anderen doen en wat de server zelf doet (water, groei, de oven), komt binnen als 'blokken'.
// - Spullen op de grond krijgen een nummer van de server: alleen wie de server kiest, krijgt ze.
// - Praten gaat alleen met vaste zinnetjes (een nummer); namen zijn twee woorden uit een lijst (twee nummers).
// - Dieren, karretjes en bewoners blijven in stap 5 nog op je eigen pagina (stap 6 zet ze op de server).
// ============================================================================
// het adres van de spelserver; leeg = de knop Samen spelen staat uit (site/maak-pagina.js --samen vult het in)
const SAMEN_SERVER = '';
function samenAdres() {
  // om te testen: ?samen=lokaal verbindt met de spelserver op hetzelfde adres als de pagina
  try { if (new URLSearchParams(location.search).get('samen') === 'lokaal' && /^https?:$/.test(location.protocol)) return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/samen'; } catch (e) {}
  return SAMEN_SERVER;
}
const SM = G.SAMEN;
const smNaam = n => SM.naamVan(n, TAAL);
const smWereldNaam = n => t('De wereld van {0}', smNaam(n));
const smZin = n => (SM.zinKlopt(n) ? SM.ZINNEN[n][TAAL === 'en' ? 1 : 0] : '');
const r2 = v => Math.round(v * 100) / 100;

// ---------------- wie je bent: een willekeurig geheim op dit apparaat (niet in SLEUTELS), en een naam van twee woorden
function spelerGeheim() {
  let g = null; try { g = localStorage.getItem('rommelblok-speler'); } catch (e) {}
  if (!g || !/^[A-Za-z0-9_-]{16,128}$/.test(g)) {
    const b = new Uint8Array(24); crypto.getRandomValues(b);
    g = btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    try { localStorage.setItem('rommelblok-speler', g); } catch (e) {}
  }
  return g;
}
function mijnNaam() { if (!SM.naamKlopt(opslag.naam)) { opslag.naam = SM.naamWillekeurig(Math.random); bewaarInst(); } return opslag.naam; }
// de gedeelde werelden die je kent (hooguit 10, in rommelblok-v3): { i: nummer, c: code, n: naam van de eigenaar, s: stand, k: sleutel als je de eigenaar bent }
function samenLijst() { if (!Array.isArray(opslag.samen)) opslag.samen = []; opslag.samen = opslag.samen.filter(e => e && Number.isInteger(e.i) && typeof e.c === 'string'); return opslag.samen; }
function samenOnthoud(e) {
  const l = samenLijst(), i = l.findIndex(x => x.i === e.i), oud = i >= 0 ? l.splice(i, 1)[0] : {};
  l.unshift(Object.assign(oud, e)); if (l.length > 10) l.length = 10; bewaarInst();
}
function samenVergeet(id) { opslag.samen = samenLijst().filter(e => e.i !== id); bewaarInst(); }

// ---------------- waarom het niet lukt (de redenen van de server)
const SAMEN_REDEN = {
  versie: 'Er is een nieuwe versie van Rommelblok. Ververs de pagina.',
  code: 'Die code klopt niet. Kijk hem nog eens goed na.',
  vol: 'Deze wereld is vol.',
  geweerd: 'Je mag niet meer in deze wereld komen.',
  dicht: 'Deze wereld is gesloten.',
  weggestuurd: 'De eigenaar heeft je uit de wereld gestuurd.',
  verwijderd: 'Deze wereld is verwijderd.',
  'te-veel': 'Er gingen te veel berichten tegelijk. Probeer het nog eens.',
  'te-veel-codes': 'Te veel foute codes. Probeer het over een kwartier nog eens.',
  'te-veel-werelden': 'Je hebt vandaag al genoeg gedeelde werelden gemaakt. Morgen weer!',
  'vol-server': 'Er kunnen nu geen nieuwe gedeelde werelden bij.',
  druk: 'Het is nu erg druk. Probeer het straks nog eens.',
  elders: 'Je speelt deze wereld nu ergens anders (in een ander tabblad).',
  verbinding: 'Geen verbinding met de spelserver. Probeer het straks nog eens.',
  uit: 'Samen spelen kan hier nog niet.',
};
const samenRedenTekst = r => t(SAMEN_REDEN[r] || 'Er ging iets mis. Probeer het nog eens.');

// ---------------- verbinden
function samenStuur(m) { if (samen && samen.ws.readyState === 1) samen.ws.send(JSON.stringify(m)); }
// hallo: { code } of { maak: { zaad, stand, moeilijk } }; geeft { ws, welkom } of een reden
function samenVerbind(hallo) {
  return new Promise((ok, nee) => {
    const adres = samenAdres(); if (!adres) { nee('uit'); return; }
    let ws; try { ws = new WebSocket(adres); } catch (e) { nee('verbinding'); return; }
    let welkom = null, reden = null; ws._rij = [];
    const klok = setTimeout(() => { if (!welkom) { reden = reden || 'verbinding'; try { ws.close(); } catch (e) {} } }, 15000);
    ws.onopen = () => ws.send(JSON.stringify(Object.assign({ t: 'hallo', v: SM.PROTOCOL, geheim: spelerGeheim(), naam: mijnNaam(), pop: opslag.pop, taal: TAAL, straal: straalNu() }, hallo)));
    ws.onerror = () => {};
    ws.onclose = () => { clearTimeout(klok); if (!welkom) nee(reden || 'verbinding'); else samenVerbindingWeg(ws); };
    ws.onmessage = e => {
      let m; try { m = JSON.parse(e.data); } catch (er) { return; }
      if (!welkom) {
        if (m.t === 'welkom') { welkom = m; clearTimeout(klok); ok({ ws, welkom: m }); } else if (m.t === 'nee') reden = m.reden;
        return;
      }
      // berichten die binnenkomen voordat de wereld klaarstaat, wachten even
      if (samen && samen.ws === ws) samenBericht(m); else ws._rij.push(m);
    };
  });
}
let samenBezig = false;
async function samenGaNaar(hallo, info) {
  if (samenBezig) return; samenBezig = true;
  const fout = $('rb-samen-fout'); fout.hidden = true;
  $('rb-samen').classList.add('bezig');
  try {
    const { ws, welkom } = await samenVerbind(Object.assign({}, hallo, info.sleutel ? { sleutel: info.sleutel } : {}));
    speelSamen(ws, welkom, info);
  } catch (r) {
    const reden = typeof r === 'string' ? r : 'fout';
    if (huidigScherm() !== 'samen' && !spelBezig) openSamen();
    fout.textContent = samenRedenTekst(reden); fout.hidden = false;
    if (reden === 'code' && info.id) toonSamenLijst();
  } finally { samenBezig = false; $('rb-samen').classList.remove('bezig'); }
}
// wat er van jezelf in een gedeelde wereld bewaard wordt (op de server, onder een hash van je geheim)
const SPELER_VELDEN = 'speler inv kies rugzakken markers gevonden logboek geland welkom speeltijd'.split(' ');
function samenSpelerData() {
  const d = {}; for (const k of SPELER_VELDEN) if (WD[k] !== undefined) d[k] = WD[k];
  d.rugzakken = (WD.rugzakken || []).slice(-5);
  let tekst = JSON.stringify(d);
  if (tekst.length > 14000) { d.gevonden = []; d.markers = (d.markers || []).slice(-20); tekst = JSON.stringify(d); }
  if (tekst.length > 14000) d.rugzakken = [];
  return d;
}
// wat de server terugstuurt, is wat de pagina eerder stuurde: toch nakijken voordat het in WD komt
function schoonSpelerData(d) {
  if (!d || typeof d !== 'object') return {};
  const uit = {};
  const vakGoed = s => s === null || (s && IT[s.id] && Number.isInteger(s.n) && s.n > 0 && s.n <= stapelVan(s.id));
  if (Array.isArray(d.inv) && d.inv.length === 36 && d.inv.every(vakGoed)) uit.inv = d.inv.map(s => (s ? Object.assign({ id: s.id, n: s.n }, s.dur != null ? { dur: s.dur } : {}) : null));
  if (d.speler && typeof d.speler === 'object') {
    const s = {};
    for (const k of 'hp honger verzadiging adem uitputting'.split(' ')) if (typeof d.speler[k] === 'number' && isFinite(d.speler[k])) s[k] = klem(d.speler[k], 0, 20);
    for (const k of ['start', 'bed']) { const p = d.speler[k]; if (Array.isArray(p) && p.length === 3 && p.every(v => typeof v === 'number' && isFinite(v))) s[k] = p.slice(); }
    uit.speler = s;
  }
  if (Number.isInteger(d.kies)) uit.kies = klem(d.kies, 0, 8);
  if (Array.isArray(d.rugzakken)) uit.rugzakken = d.rugzakken.filter(r => r && isFinite(r.x) && isFinite(r.y) && isFinite(r.z) && Array.isArray(r.inhoud) && r.inhoud.every(vakGoed)).slice(-5);
  if (Array.isArray(d.markers)) uit.markers = d.markers.slice(0, 50);
  if (Array.isArray(d.gevonden)) uit.gevonden = d.gevonden.slice(0, 500);
  if (d.logboek && typeof d.logboek === 'object') uit.logboek = d.logboek;
  for (const k of ['geland', 'welkom']) if (d[k]) uit[k] = true;
  if (typeof d.speeltijd === 'number') uit.speeltijd = d.speeltijd;
  return uit;
}
// de wereld openen (ook na opnieuw verbinden: dan houd je wat je had)
function speelSamen(ws, wk, info, houd) {
  const w = wk.wereld;
  samen = {
    ws, jij: wk.jij, id: w.id, code: (wk.nieuw && wk.nieuw.code) || info.code, sleutel: (wk.nieuw && wk.nieuw.sleutel) || info.sleutel || null,
    eigenaar: !!wk.eigenaar, regels: { bouwen: w.bouwen, dicht: w.dicht }, naam: w.naam, stand: w.stand,
    spelers: new Map(), acties: new Map(), corr: 0, pT: 0, pSleutel: '', zwaaiN: 0, zwaaiVorig: 1, sprong: false,
    open: null, slaapKlok: null, log: [], bewust: false, geweerd: 0, gegooid: [],
  };
  samen.mag = samen.eigenaar || samen.regels.bouwen === 'iedereen';
  for (const [sid, naam, pop, eig] of wk.spelers || []) samenErbij(sid, naam, pop, eig, true);
  const d = houd || schoonSpelerData(wk.data), st = wk.start;
  const plek = houd ? null : wk.plek;
  const s = Object.assign({ pos: st.slice(), kijk: [Math.PI * 0.25, -0.15], vliegt: false, hp: 20, honger: 20, verzadiging: 5, adem: 10, uitputting: 0, start: st.slice(), bed: null }, d.speler || {});
  if (plek) { s.pos = plek.slice(0, 3); if (plek.length >= 5) s.kijk = [plek[3], plek[4]]; }
  if (houd && WD) { s.pos = [sp.x, sp.y, sp.z]; s.kijk = [sp.yaw, sp.pitch]; }
  const nieuw = {
    id: 'samen:' + w.id, samen: true, versie: 1, naam: smWereldNaam(w.naam), zaad: w.zaad >>> 0, zaadTekst: '', stand: w.stand === 'bouwen' ? 'bouwen' : 'overleven',
    gemaakt: Date.now(), gespeeld: Date.now(), speeltijd: d.speeltijd || 0, tijd: w.tijd, dag: w.dag,
    speler: s, inv: d.inv || beginRugzak(w.stand), kies: d.kies || 0, rugzakken: d.rugzakken || [], dingen: {}, plaatje: 'samen', grotten: 2, gen: 3,
    moeilijk: w.moeilijk, dieren: [], dierVak: {}, markers: d.markers || [], gevonden: d.gevonden || [], logboek: d.logboek, geland: !!d.geland || !!plek, welkom: !!d.welkom,
  };
  samenOnthoud(Object.assign({ i: w.id, c: samen.code, n: w.naam, s: nieuw.stand === 'bouwen' ? 'b' : 'o' }, samen.sleutel ? { k: samen.sleutel } : {}));
  speelWereld(nieuw);
  document.body.classList.add('rb-samen');
  samenHud();
  if (wk.nieuw && wk.nieuw.code) setTimeout(() => melding(t('Je gedeelde wereld is klaar. De uitnodigingscode staat bij Spelers (Tab).')), 2500);
  // wat al binnen was
  for (const m of ws._rij.splice(0)) samenBericht(m);
}
// weg uit de gedeelde wereld (naar je werelden)
function samenStop() {
  if (!samen) return;
  const s = samen; samen = null; s.bewust = true;
  try { s.ws.close(1000); } catch (e) {}
  for (const o of s.spelers.values()) if (o.el) o.el.remove();
  $('rb-praat').innerHTML = '';
  document.body.classList.remove('rb-samen');
}
// de verbinding viel weg (niet omdat je zelf wegging)
let samenOpnieuw = 0;
async function samenVerbindingWeg(ws) {
  if (!samen || samen.ws !== ws || samen.bewust) return;
  const reden = samen.weg || null, info = { id: samen.id, code: samen.code, sleutel: samen.sleutel };
  if (reden && reden !== 'verbinding') { await naarWerelden(); openSamen(); const f = $('rb-samen-fout'); f.textContent = samenRedenTekst(reden); f.hidden = false; return; }
  // eerst stil opnieuw proberen (ruim een halve minuut, bijvoorbeeld als de server even opnieuw start), en anders vragen wat je wilt
  melding(t('Verbinding met de server kwijt. Opnieuw verbinden…'));
  const houd = samenSpelerData();
  for (const wacht of [1500, 3000, 4500, 6000, 8000, 10000]) {
    await new Promise(r => setTimeout(r, wacht));
    if (!WD || !WD.samen) return;
    try { const { ws: w2, welkom } = await samenVerbind({ code: info.code, sleutel: info.sleutel || undefined }); samenStop(); speelSamen(w2, welkom, info, houd); samenOpnieuw++; melding(t('Weer verbonden!'), true); return; } catch (r) { if (r !== 'verbinding') { await naarWerelden(); openSamen(); const f = $('rb-samen-fout'); f.textContent = samenRedenTekst(r); f.hidden = false; return; } }
  }
  if (!WD || !WD.samen) return;
  const nog = await vraag(t('Geen verbinding'), t('De spelserver is even niet bereikbaar. Wat je net deed, is misschien niet bewaard.'), { ja: t('Opnieuw proberen'), nee: t('Naar je werelden') });
  if (nog && WD && WD.samen) { samen.bewust = false; samenVerbindingWeg(ws); } else naarWerelden();
}

// ---------------- berichten van de server
function samenBericht(m) {
  switch (m.t) {
    case 'stuk': wb.postMessage({ t: 'overlay', lijst: m.l }); break;
    case 'blokken': samenBlokken(m); break;
    case 'ja': samenJaNee(m, true); break;
    case 'nee': if (m.nr !== undefined) samenJaNee(m, false); else samen.weg = m.reden; break;
    case 'spelers': samenPlekken(m.l); break;
    case 'erbij': samenErbij(m.sid, m.naam, m.pop, m.eigenaar); break;
    case 'weg': samenWegSpeler(m.sid); break;
    case 'zeg': samenHoort(m.wie, m.n); break;
    case 'tijd': if (WD) { WD.tijd = m.tijd; WD.dag = m.dag; if (m.ochtend) samenOchtend(); } break;
    case 'slaap': if (samen.slaapKlok) $('rb-slaap-tekst').textContent = t('{0} van {1} slapen. Iedereen moet slapen om de nacht over te slaan.', m.slapen, m.van); break;
    case 'los': samenLos(m.l); break;
    case 'opgeraapt': samenOpgeraapt(m); break;
    case 'open': samenOpenAntwoord(m); break;
    case 'ding': samenDing(m); break;
    case 'plek': samenTerug(m); break;
    case 'regels': samenRegels(m); break;
    case 'beheer': if (m.doe === 'code' && m.code) { samen.code = m.code; samenOnthoud({ i: samen.id, c: m.code }); toonSpelers(); melding(t('Nieuwe code: {0}. De oude werkt niet meer.', m.code)); } break;
    case 'gemeld': if (m.over) { const o = samen.spelers.get(m.over); if (o) melding(t('Iemand heeft {0} gemeld.', smNaam(o.naam)), true); } else melding(t('Bedankt. De eigenaar en Ruben kunnen het nakijken.'), true); break;
  }
}
// blokken van anderen en van de server zelf
function samenBlokken(m) {
  const g = []; for (let i = 0; i + 3 < m.a.length; i += 4) g.push(['b', m.a[i], m.a[i + 1], m.a[i + 2], m.a[i + 3]]);
  acties.ontvang({ gevolg: g });
  // brokjes en geluid als iemand vlakbij iets breekt of bouwt
  if (m.p && Math.hypot(m.p[0] + 0.5 - sp.x, m.p[1] - sp.y, m.p[2] + 0.5 - sp.z) < 20) {
    if (m.s === 'breek' && m.v > 0) { brokjes(m.p[0], m.p[1], m.p[2], m.v, 18); klank('breek', mat(m.v)); }
    else if (m.s === 'plaats') { const v = blokOp(m.p[0], m.p[1], m.p[2]); if (v > 0) klank('plaats', mat(v)); }
  }
}
// het antwoord op wat je zelf deed: zo staan de blokken daarna precies zoals op de server
function samenJaNee(m, ja) {
  const a = samen.acties.get(m.nr); samen.acties.delete(m.nr);
  const g = [];
  for (let i = 0; i + 3 < (m.a || []).length; i += 4) { const [x, y, z, v] = [m.a[i], m.a[i + 1], m.a[i + 2], m.a[i + 3]]; if (blokOp(x, y, z) !== v) g.push(['b', x, y, z, v]); }
  if (g.length) acties.ontvang({ gevolg: g });
  if (ja) return;
  // wat je neerzette, krijg je terug (bij bouwen is alles onbeperkt)
  if (a && a.t === 'plaats' && a.id && wereldStand() !== 'bouwen' && IT[a.id]) geef(a.id, 1);
  if (m.d && m.d[3]) samenDing({ x: m.d[0], y: m.d[1], z: m.d[2], d: m.d[3] });
  const nu = performance.now();
  if (nu - (samen.neeT || 0) > 4000) {
    const tekst = { 'mag-niet': 'In deze wereld mag alleen de eigenaar bouwen.', speler: 'Daar staat iemand.' }[m.reden];
    if (tekst) { samen.neeT = nu; melding(t(tekst), true); }
  }
}
// wat je doet, gaat naar de server (karretjes, bewoners en dieren blijven nog op je eigen pagina)
acties.luister(a => {
  if (!samen || !WD || !WD.samen || ACTIES.vanBuiten) return;
  const gevolg = a.gevolg.filter(g => g[0] === 'b' || g[0] === 'k' || g[0] === 'v' || g[0] === 'l');
  if (!gevolg.length) return;
  const uit = { nr: a.nr, t: a.t, gevolg };
  for (const k of 'x y z met id'.split(' ')) if (a[k] !== undefined) uit[k] = a[k];
  samen.acties.set(a.nr, uit); if (samen.acties.size > 200) samen.acties.delete(samen.acties.keys().next().value);
  samenStuur({ t: 'actie', a: uit });
});

// ---------------- andere spelers
function samenErbij(sid, naam, pop, eigenaar, stil) {
  if (!samen || sid === samen.jij) return;
  const o = { sid, naam, pop: G.POP.schoonPop(pop), eigenaar: !!eigenaar, buf: [], x: 0, y: 0, z: 0, fase: 0, zwaaiT: 1, a: 0, stil: false, ballon: null, el: null };
  samen.spelers.set(sid, o);
  if (!stil) { melding(t('{0} doet mee!', smNaam(naam)), true); klank('ontdek'); }
  samenHud();
}
function samenWegSpeler(sid) {
  const o = samen.spelers.get(sid); if (!o) return;
  samen.spelers.delete(sid); if (o.el) o.el.remove();
  melding(t('{0} is weg.', smNaam(o.naam)), true);
  samenHud();
}
function samenPlekken(l) {
  const nu = performance.now();
  for (const r of l) {
    const o = samen.spelers.get(r[0]); if (!o) continue;
    o.buf.push([nu, r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8]]);
    while (o.buf.length > 2 && o.buf[1][0] < nu - 1000) o.buf.shift();
  }
}
const hoekMix = (a, b, t2) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * t2; };
// de andere spelers tekenen: 100 ms achter, en glijden tussen twee berichten in
function samenTeken(wezens, dt) {
  if (!samen || !WD) return;
  const nu = performance.now() - 100;
  for (const o of samen.spelers.values()) {
    if (!o.buf.length) continue;
    let a = o.buf[0], b = o.buf[0];
    for (const q of o.buf) { if (q[0] <= nu) a = q; else { b = q; break; } b = q; }
    const span = b[0] - a[0], f = span > 0 ? klem((nu - a[0]) / span, 0, 1) : 1;
    const x = a[1] + (b[1] - a[1]) * f, y = a[2] + (b[2] - a[2]) * f, z = a[3] + (b[3] - a[3]) * f;
    const yaw = hoekMix(a[4], b[4], f), pitch = a[5] + (b[5] - a[5]) * f, vlag = b[6], hand = b[7], anim = b[8];
    const v = span > 0 ? Math.hypot(b[1] - a[1], b[3] - a[3]) / (span / 1000) : 0;
    o.fase += Math.min(v, 12) * dt / ((vlag & 2) ? 0.9 : 1.6) * Math.PI;
    if ((anim & 31) !== (o.a & 31)) o.zwaaiT = 0;
    o.a = anim; o.zwaaiT = Math.min(1, o.zwaaiT + dt * 3.2);
    o.x = x; o.y = y; o.z = z;
    if (vlag & 128) continue; // flauwgevallen
    const naam = popModel(o.pop); if (!naam) continue;
    const water = !!(vlag & 4);
    const s = { v, fase: o.fase, grond: !!(vlag & 32), water, ladder: !!(vlag & 64), sluip: !!(vlag & 2), kar: !!(vlag & 8), hak: anim & 32 ? (performance.now() / 300) % 1 : -1, eet: anim & 64 ? performance.now() / 1000 : -1, zwaai: o.zwaaiT, pitch, t: performance.now() / 1000, vliegt: !!(vlag & 1) };
    const { g, lichaam } = popHouding(s);
    const l = lichtOp(Math.floor(x), Math.floor(y + 1.2), Math.floor(z));
    const w = { model: naam, x, y: y + (water ? 0.55 : 0), z, yaw: yaw + Math.PI, pitch: lichaam, delen: popDelenHouding(naam, g), licht: lichtKleur(l), schaal: POP_SCHAAL };
    if (hand && IT[hand]) { const it = IT[hand], bl = it.blok ? BL[it.blok] : null; w.vast = { id: hand, deel: 'handR', plek: POP_HANDPLEK, soort: it.gereed ? 'gereed' : bl && (bl.vorm === 'fakkel' || bl.vorm === 'kaars') ? 'rechtop' : bl ? 'blok' : 'klein' }; }
    wezens.push(w);
  }
}
// een plek in de wereld op het scherm (in punten), of null als hij achter je ligt
function samenOpScherm(C, x, y, z) {
  const W = doek.clientWidth, H = doek.clientHeight; if (!W || !H) return null;
  const dx = x - C.x, dy = y - C.y, dz = z - C.z;
  const cy = Math.cos(C.yaw), sy = Math.sin(C.yaw), cp = Math.cos(C.pitch), spi = Math.sin(C.pitch);
  const fx = -sy * cp, fy = spi, fz = -cy * cp, rx = cy, rz = -sy, ux = -rz * fy, uy = rz * fx - rx * fz, uz = rx * fy;
  const voor = dx * fx + dy * fy + dz * fz; if (voor < 0.2) return null;
  const f = 1 / Math.tan(C.fov / 2), nx = (dx * rx + dz * rz) / voor * f / (W / H), ny = (dx * ux + dy * uy + dz * uz) / voor * f;
  if (Math.abs(nx) > 1.2 || Math.abs(ny) > 1.2) return null;
  return [(nx + 1) / 2 * W, (1 - ny) / 2 * H, voor];
}
// naamkaartjes en tekstballonnen boven de hoofden
function samenNamen(C) {
  if (!samen || !C) return; // (direct na een sprong is er nog geen camera van een beeldje)
  const laag = $('rb-namen'), nu = performance.now(), zicht = spelBezig && wereldKlaar && huidigScherm() !== 'kaart';
  for (const o of samen.spelers.values()) {
    if (!o.el) { o.el = document.createElement('div'); o.el.className = 'rb-naamkaart'; o.el.innerHTML = '<b></b><span class="ballon" hidden></span>'; laag.appendChild(o.el); }
    const p = zicht && o.buf.length ? samenOpScherm(C, o.x, o.y + 2.15, o.z) : null;
    const ver = p ? Math.hypot(o.x - sp.x, o.y - sp.y, o.z - sp.z) : 0;
    if (!p || ver > 64) { o.el.hidden = true; continue; }
    o.el.hidden = false;
    const b = o.el.firstChild, tekst = (o.eigenaar ? '👑 ' : '') + smNaam(o.naam); if (b.textContent !== tekst) b.textContent = tekst;
    const bal = o.el.lastChild, toon = o.ballon && o.ballon.tot > nu && !o.stil;
    if (toon && bal.textContent !== o.ballon.tekst) bal.textContent = o.ballon.tekst;
    bal.hidden = !toon;
    o.el.style.transform = `translate(${p[0].toFixed(1)}px, ${p[1].toFixed(1)}px) translate(-50%, -100%)`;
    o.el.style.opacity = ver > 40 ? Math.max(0.25, 1 - (ver - 40) / 24).toFixed(2) : '1';
  }
}

// ---------------- praten: alleen vaste zinnetjes
function samenZeg(n) {
  if (!samen || !SM.zinKlopt(n)) return;
  const nu = performance.now();
  if (nu - (samen.zinT || 0) < 2000) { melding(t('Even wachten…'), true); return; }
  samen.zinT = nu;
  samenStuur({ t: 'zeg', n });
  samenLog(t('Jij'), smZin(n));
  if (huidigScherm() === 'zinnen') sluitScherm();
}
function samenHoort(wie, n) {
  const o = samen.spelers.get(wie); if (!o || o.stil || !SM.zinKlopt(n)) return;
  o.ballon = { tekst: smZin(n), tot: performance.now() + 6000 };
  samenLog(smNaam(o.naam), smZin(n));
  klank('oppak');
}
function samenLog(wie, tekst) {
  const l = $('rb-praat'), r = document.createElement('div');
  r.className = 'rb-praat-regel'; const b = document.createElement('b'); b.textContent = wie + ': '; r.append(b, document.createTextNode(tekst));
  l.appendChild(r); while (l.children.length > 5) l.firstChild.remove();
  setTimeout(() => { r.classList.add('weg'); setTimeout(() => r.remove(), 900); }, 12000);
}
function openZinnen() {
  if (!samen) return;
  const g = $('rb-zinnen-lijst'); g.innerHTML = '';
  SM.ZINNEN.forEach((z, n) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'rb-knop' + (n >= 16 ? ' plaatje' : ''); b.textContent = smZin(n); b.onclick = () => samenZeg(n); g.appendChild(b); });
  openScherm('zinnen');
  setTimeout(() => { const b = g.querySelector('button'); if (b) b.focus(); }, 30);
}

// ---------------- spullen op de grond (met een nummer van de server)
function samenLos(l) {
  const nu = performance.now();
  for (const [id, x, y, z, item, n, dur] of l) {
    if (!IT[item] || losse.some(d => d.sid === id)) continue;
    if (losse.length > 250) losse.shift();
    const d = { sid: id, id: item, n, dur: dur || undefined, x, y, z, vx: (Math.random() - 0.5) * 2.2, vy: 2.5 + Math.random(), vz: (Math.random() - 0.5) * 2.2, leeftijd: 0, wacht: 0.4, draai: Math.random() * 6 };
    // iets wat je net zelf weggooide: het vliegt weg zoals bij alleen spelen, en je pakt het niet meteen weer op
    const g = samen.gegooid.findIndex(q => q.id === item && q.n === n && nu - q.t < 3000);
    if (g >= 0) { const q = samen.gegooid.splice(g, 1)[0]; d.vx = q.v[0]; d.vy = q.v[1]; d.vz = q.v[2]; d.wacht = 1.5; d.draai = 0; }
    losse.push(d);
  }
}
function samenGegooid(id, n, v) { samen.gegooid.push({ id, n, v, t: performance.now() }); if (samen.gegooid.length > 10) samen.gegooid.shift(); }
// past dit (helemaal of een deel) in je rugzak?
function samenPast(id, dur) { const max = stapelVan(id); return WD.inv.some(s => !s || (s.id === id && s.n < max && max > 1)); }
// oppakken bij samen spelen: eerst de server vragen (zo krijgt maar één speler het)
function samenPakOp(d) {
  const nu = performance.now();
  if (d.gevraagd && nu - d.gevraagd < 1500) return false;
  if (!samenPast(d.id, d.dur)) return false;
  d.gevraagd = nu; samenStuur({ t: 'raap', id: d.sid });
  return false;
}
function samenOpgeraapt(m) {
  const i = losse.findIndex(d => d.sid === m.id); if (i < 0) return;
  const d = losse[i];
  if (m.wie === samen.jij) {
    losse.splice(i, 1);
    const rest = geef(d.id, d.n, d.dur); klank('oppak');
    // paste het niet meer helemaal: de rest valt weer (en krijgt een nieuw nummer)
    if (rest) laatVallen(sp.x, sp.y + 1, sp.z, d.id, rest, d.dur);
  } else if (m.wie > 0 || m.weg) losse.splice(i, 1);
  else d.gevraagd = 0;
}

// ---------------- kisten en ovens: op de server, en maar één speler tegelijk
function samenOpenDing(d, soort) {
  if (samen.open) return;
  samen.open = { x: d.x, y: d.y, z: d.z, soort, t: performance.now() };
  // na de actie die nu bezig is (bijvoorbeeld een oude kist die net open gaat)
  queueMicrotask(() => samenStuur({ t: 'open', x: d.x, y: d.y, z: d.z }));
  setTimeout(() => { if (samen && samen.open && performance.now() - samen.open.t > 5900) { samen.open = null; melding(t('De kist reageert niet. Probeer het nog eens.'), true); } }, 6000);
}
function samenOpenAntwoord(m) {
  const o = samen.open; if (!o || o.x !== m.x || o.y !== m.y || o.z !== m.z) { if (m.ok) samenStuur({ t: 'dicht' }); return; }
  samen.open = null;
  if (!m.ok) { melding(t({ bezet: 'Iemand anders kijkt al in deze kist.', 'mag-niet': 'In deze wereld mag alleen de eigenaar bouwen.' }[m.reden] || 'Dat lukt nu niet.'), true); return; }
  const k = sleutelPlek(m.x, m.y, m.z);
  WD.dingen[k] = m.d && m.d.soort === o.soort ? m.d : (o.soort === 'kist' ? { soort: 'kist', inhoud: new Array(27).fill(null) } : { soort: 'oven', in: null, brand: null, uit: null, brandTijd: 0, brandMax: 0, kook: 0 });
  if (wereldKlaar && !schermOpen()) { openRugzak(o.soort, [m.x, m.y, m.z]); zwaai(); } else samenStuur({ t: 'dicht' });
}
// de oven werkt op de server: wie hem open heeft, ziet hem bijwerken
function samenDing(m) {
  const k = sleutelPlek(m.x, m.y, m.z); if (!WD || !m.d) return;
  WD.dingen[k] = m.d;
  if (bak && bak.x === m.x && bak.y === m.y && bak.z === m.z) {
    const was = ACTIES.vanBuiten; ACTIES.vanBuiten = true;
    try { bakBegin(bak.soort, [m.x, m.y, m.z]); rugzakVeranderd(); } finally { ACTIES.vanBuiten = was; }
  }
}

// ---------------- slapen: alleen als iedereen slaapt, gaat de nacht voorbij
function samenSlapen() {
  const z = $('rb-slaap'); z.hidden = false; requestAnimationFrame(() => { z.style.opacity = 1; });
  $('rb-slaap-tekst').textContent = t('Slaap lekker…');
  klank('slaap'); samenStuur({ t: 'slaap' });
  clearTimeout(samen.slaapKlok);
  samen.slaapKlok = setTimeout(() => { samen.slaapKlok = null; z.style.opacity = 0; setTimeout(() => { z.hidden = true; }, 1300); melding(t('Je bent wakker. De nacht gaat pas voorbij als iedereen tegelijk slaapt.')); }, 8000);
}
function samenOchtend() {
  if (!samen.slaapKlok) return;
  clearTimeout(samen.slaapKlok); samen.slaapKlok = null;
  const z = $('rb-slaap'); if (typeof logboek === 'function') logboek('slapen');
  z.style.opacity = 0; setTimeout(() => { z.hidden = true; }, 1300); melding(t('Goedemorgen! Je startplek is nu bij dit bed.'));
}

// ---------------- bewegen: elke 100 ms je plek (alleen als er iets veranderde, en anders elke seconde)
function samenTik(dt, C) {
  if (!samen) return;
  samenNamen(C);
  if (!WD || !WD.samen || !wereldKlaar) return;
  const nu = performance.now();
  if (zwaaiT < samen.zwaaiVorig) samen.zwaaiN++;
  samen.zwaaiVorig = zwaaiT;
  if (nu - samen.pT < 100) return;
  const f = (sp.vliegt ? 1 : 0) | (sp.sluipt ? 2 : 0) | (sp.inWater && !sp.opGrond ? 4 : 0) | (rijdtIn ? 8 : 0) | (samen.sprong ? 16 : 0) | (sp.opGrond ? 32 : 0) | (sp.opLadder ? 64 : 0) | (WD.speler.hp <= 0 ? 128 : 0);
  const slot = inHand(), h = slot ? slot.id : 0;
  const a = (samen.zwaaiN & 31) | (hak.bezig && doel && wereldStand() !== 'bouwen' ? 32 : 0) | (eet.bezig ? 64 : 0);
  const m = { t: 'p', x: r2(sp.x), y: r2(sp.y), z: r2(sp.z), yaw: r2(sp.yaw), pitch: r2(sp.pitch), f, h, a, k: samen.corr };
  const sl = [m.x, m.y, m.z, m.yaw, m.pitch, f, h, a].join();
  if (sl !== samen.pSleutel || nu - samen.pT > 1000) { samenStuur(m); samen.pSleutel = sl; samen.sprong = false; samen.pT = nu; }
}
// de server zette je terug (te snel, of door een muur)
function samenTerug(m) {
  samen.corr = m.k; sp.x = m.x; sp.y = m.y; sp.z = m.z; sp.vx = sp.vy = sp.vz = 0; sp.valStart = null; samen.pSleutel = '';
  vertelPlek(performance.now(), true);
}
// een teken van leven, ook als het tabblad even op de achtergrond staat
setInterval(() => { if (samen) samenStuur({ t: 'leven' }); }, 15000);

// ---------------- wie mag wat, en wat de eigenaar kan
function samenRegels(m) {
  const mag = !!m.mag, was = samen.mag;
  samen.regels = { bouwen: m.bouwen, dicht: m.dicht }; samen.mag = mag;
  if (m.geweerd !== undefined) samen.geweerd = m.geweerd;
  if (was !== mag) melding(mag ? t('Je mag weer bouwen.') : t('Alleen de eigenaar mag nu bouwen.'));
  toonSpelers();
}
function samenHud() {
  const n = samen ? samen.spelers.size + 1 : 1;
  for (const id of ['rb-samen-aantal', 'tk-spelers-aantal']) { const e = $(id); if (e) e.textContent = String(n); }
  if (huidigScherm() === 'spelers') toonSpelers();
}
function openSpelers() { if (!samen) return; toonSpelers(); openScherm('spelers'); }
function smKnop(tekst, klik, soort) { const b = document.createElement('button'); b.type = 'button'; b.className = 'rb-knop klein' + (soort ? ' ' + soort : ''); b.textContent = tekst; b.onclick = klik; return b; }
function toonSpelers() {
  if (!samen) return;
  const l = $('rb-spelers-lijst'); l.innerHTML = '';
  const regel = (naam, extra, knoppen) => { const li = document.createElement('li'); const b = document.createElement('b'); b.textContent = naam; li.appendChild(b); if (extra) { const s = document.createElement('small'); s.textContent = extra; li.appendChild(s); } const k = document.createElement('div'); k.className = 'rb-wereld-knoppen'; for (const x of knoppen) k.appendChild(x); li.appendChild(k); l.appendChild(li); };
  regel((samen.eigenaar ? '👑 ' : '') + smNaam(mijnNaam()), t('jij'), []);
  for (const o of samen.spelers.values()) {
    const k = [smKnop(o.stil ? t('Weer horen') : t('Dempen'), () => { o.stil = !o.stil; toonSpelers(); }), smKnop(t('Melden'), async () => { if (await vraag(t('{0} melden?', smNaam(o.naam)), t('Doet iemand vervelend? De eigenaar en Ruben krijgen een melding (zonder jouw naam).'), { ja: t('Melden') })) samenStuur({ t: 'meld', wie: o.sid }); })];
    if (samen.eigenaar) k.push(smKnop(t('Wegsturen'), () => samenStuur({ t: 'beheer', doe: 'weg-sturen', wie: o.sid })), smKnop(t('Weren'), async () => { if (await vraag(t('{0} weren?', smNaam(o.naam)), t('Die speler kan dan niet meer in deze wereld komen, ook niet met de code.'), { ja: t('Weren'), gevaar: true })) samenStuur({ t: 'beheer', doe: 'weren', wie: o.sid }); }, 'gevaar'));
    regel((o.eigenaar ? '👑 ' : '') + smNaam(o.naam), o.stil ? t('gedempt') : '', k);
  }
  // de code om anderen uit te nodigen
  $('rb-spelers-code').textContent = samen.code || '';
  $('rb-spelers-nieuw').hidden = !samen.eigenaar;
  const e = $('rb-spelers-eigenaar'); e.hidden = !samen.eigenaar;
  if (samen.eigenaar) {
    $('rb-spelers-bouwen-iedereen').setAttribute('aria-pressed', String(samen.regels.bouwen === 'iedereen'));
    $('rb-spelers-bouwen-ik').setAttribute('aria-pressed', String(samen.regels.bouwen === 'eigenaar'));
    $('rb-spelers-dicht').textContent = samen.regels.dicht ? t('Open de wereld weer') : t('Sluit de wereld');
    $('rb-spelers-toelaten').hidden = !samen.geweerd;
  }
  $('rb-spelers-uitleg').textContent = samen.eigenaar ? t('Jij bent de eigenaar. Alleen wie de code heeft, kan erin.') : samen.mag ? t('Iedereen mag hier bouwen.') : t('In deze wereld mag alleen de eigenaar bouwen.');
}
$('rb-spelers-kopie').addEventListener('click', async () => { try { await navigator.clipboard.writeText(samen.code); melding(t('De code is gekopieerd.'), true); } catch (e) { melding(samen.code); } });
$('rb-spelers-nieuw').addEventListener('click', async () => { if (await vraag(t('Nieuwe code?'), t('De oude code werkt dan niet meer. Wie al in de wereld is, blijft erin.'), { ja: t('Nieuwe code') })) samenStuur({ t: 'beheer', doe: 'code' }); });
$('rb-spelers-bouwen-iedereen').addEventListener('click', () => samenStuur({ t: 'beheer', doe: 'bouwen', wie: 'iedereen' }));
$('rb-spelers-bouwen-ik').addEventListener('click', () => samenStuur({ t: 'beheer', doe: 'bouwen', wie: 'eigenaar' }));
$('rb-spelers-dicht').addEventListener('click', () => samenStuur({ t: 'beheer', doe: 'dicht', aan: !samen.regels.dicht }));
$('rb-spelers-toelaten').addEventListener('click', () => samenStuur({ t: 'beheer', doe: 'niemand-weren' }));
$('rb-spelers-weg').addEventListener('click', async () => {
  if (!(await vraag(t('Wereld verwijderen?'), t('De gedeelde wereld is dan voorgoed weg, voor iedereen.'), { ja: t('Verwijder'), gevaar: true }))) return;
  samenVergeet(samen.id); samenStuur({ t: 'beheer', doe: 'verwijder' });
});
$('rb-samen-praat').addEventListener('click', () => openZinnen());
$('rb-samen-wie').addEventListener('click', () => openSpelers());
$('tk-praat').addEventListener('click', () => openZinnen());
$('tk-spelers').addEventListener('click', () => openSpelers());
addEventListener('keydown', e => {
  if (!samen || !spelBezig || (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA'))) return;
  const s = huidigScherm();
  if (e.code === 'KeyT' && (s === null || s === 'zinnen')) { e.preventDefault(); if (s === 'zinnen') sluitScherm(); else openZinnen(); }
  else if (e.code === 'Tab' && (s === null || s === 'spelers')) { e.preventDefault(); if (s === 'spelers') sluitScherm(); else openSpelers(); }
});

// ---------------- het scherm Samen spelen (vanaf het beginscherm)
function openSamen() {
  const a = $('rb-samen-naam-a'), b = $('rb-samen-naam-b'), n = mijnNaam(), en = TAAL === 'en';
  a.innerHTML = ''; b.innerHTML = '';
  const optie = (lijst, w, i) => { const o = document.createElement('option'); o.value = String(i); o.textContent = w[en ? 1 : 0]; lijst.appendChild(o); };
  SM.NAAM_A.forEach((w, i) => optie(a, w, i));
  SM.NAAM_B.forEach((w, i) => optie(b, w, i));
  a.value = n[0]; b.value = n[1];
  $('rb-samen-fout').hidden = true;
  toonSamenLijst();
  openScherm('samen');
}
function toonSamenLijst() {
  const ul = $('rb-samen-lijst'); ul.innerHTML = '';
  const l = samenLijst();
  if (!l.length) { ul.innerHTML = `<li class="rb-leeg">${t('Nog geen gedeelde werelden. Maak er een, of doe mee met een code van een vriend.')}</li>`; return; }
  for (const e of l) {
    const li = document.createElement('li'); li.className = 'rb-wereld';
    li.innerHTML = `<div><h3></h3><p><span class="badge"></span><span class="code"></span></p></div><div class="rb-wereld-knoppen"></div>`;
    li.querySelector('h3').textContent = (e.k ? '👑 ' : '') + smWereldNaam(e.n || [0, 0]);
    const bd = li.querySelector('.badge'); bd.className = 'badge ' + (e.s === 'b' ? 'bouwen' : 'overleven'); bd.textContent = e.s === 'b' ? t('Bouwen') : t('Overleven');
    li.querySelector('.code').textContent = e.c;
    const k = li.querySelector('.rb-wereld-knoppen');
    k.appendChild(smKnop(t('Spelen'), () => samenGaNaar({ code: e.c }, { id: e.i, code: e.c, sleutel: e.k }), 'rood'));
    k.appendChild(smKnop(t('Vergeet'), async () => { if (await vraag(t('Wereld vergeten?'), e.k ? t('Je bent de eigenaar. Als je hem vergeet, kun je hem niet meer beheren (hij blijft wel bestaan).') : t('Hij verdwijnt uit je lijst. Met de code kun je er later weer in.'), { ja: t('Vergeet'), gevaar: !!e.k })) { samenVergeet(e.i); toonSamenLijst(); } }));
    ul.appendChild(li);
  }
}
$('rb-samen-knop').addEventListener('click', () => openSamen());
$('rb-samen-dobbel').addEventListener('click', () => { opslag.naam = SM.naamWillekeurig(Math.random); bewaarInst(); $('rb-samen-naam-a').value = opslag.naam[0]; $('rb-samen-naam-b').value = opslag.naam[1]; });
for (const id of ['rb-samen-naam-a', 'rb-samen-naam-b']) $(id).addEventListener('change', () => { opslag.naam = [+$('rb-samen-naam-a').value, +$('rb-samen-naam-b').value]; bewaarInst(); });
$('rb-samen-mee').addEventListener('submit', e => {
  e.preventDefault();
  const code = SM.schoonCode($('rb-samen-code').value), f = $('rb-samen-fout');
  if (!code) { f.textContent = t('Een code ziet eruit als drie woorden en een getal, bijvoorbeeld blauwe-lantaarn-egel-42.'); f.hidden = false; return; }
  const al = samenLijst().find(x => x.c === code);
  samenGaNaar({ code }, { code, sleutel: al && al.k, id: al && al.i });
});
// een nieuwe gedeelde wereld maken (met het scherm voor een nieuwe wereld, zonder naam: die is 'De wereld van ...')
let maakSamen = false;
$('rb-samen-maak').addEventListener('click', () => {
  maakSamen = true; $('rb-maak-titel').textContent = t('Nieuwe gedeelde wereld'); $('rb-maak-naam-rij').hidden = true; $('rb-maak-naam').required = false;
  $('rb-maak-zaad').value = ''; kiesStand('overleven'); openScherm('maak');
});
function samenMaak(zaadTekst, stand, moeilijk) {
  const tekst = (zaadTekst || '').trim() || String(Math.floor(Math.random() * 2147483647));
  sluitScherm();
  samenGaNaar({ maak: { zaad: G.zaadVan(tekst) >>> 0, stand, moeilijk } }, {});
}
// het scherm voor een nieuwe wereld weer gewoon maken (voor een eigen wereld)
function maakGewoon() { maakSamen = false; $('rb-maak-titel').textContent = t('Nieuwe wereld'); $('rb-maak-naam-rij').hidden = false; $('rb-maak-naam').required = true; }

// ============================================================================
// Werelden: bewaren in IndexedDB (alleen veranderde stukken), het beginscherm, nieuw, exporteren en importeren
// ============================================================================
let db = null;
const dbKlaar = new Promise(ok => {
  try {
    const q = indexedDB.open('rommelblok', 1);
    q.onupgradeneeded = () => { const d = q.result; if (!d.objectStoreNames.contains('werelden')) d.createObjectStore('werelden', { keyPath: 'id' }); if (!d.objectStoreNames.contains('stukken')) d.createObjectStore('stukken'); };
    q.onsuccess = () => { db = q.result; ok(db); }; q.onerror = () => ok(null); q.onblocked = () => ok(null);
  } catch (e) { ok(null); }
});
const idb = q => new Promise((ok, nee) => { q.onsuccess = () => ok(q.result); q.onerror = () => nee(q.error); });
async function alleWerelden() { await dbKlaar; if (!db) return []; try { return await idb(db.transaction('werelden').objectStore('werelden').getAll()); } catch (e) { return []; } }
async function stukBereik(id) { return IDBKeyRange.bound(id + '|', id + '|￿'); }
async function telStukken(id) { if (!db) return 0; try { return await idb(db.transaction('stukken').objectStore('stukken').count(await stukBereik(id))); } catch (e) { return 0; } }
async function schrijfMeta(w) { await dbKlaar; if (!db || /^test/.test(w.id)) return !!db; try { const kopie = JSON.parse(JSON.stringify(w)); await idb(db.transaction('werelden', 'readwrite').objectStore('werelden').put(kopie)); return true; } catch (e) { console.warn(e); return false; } }

// ---------------- bewaren
let bewaarBezig = false, laatstBewaard = 0, plaatjeVragen = false;
function wereldNaarOpslag() {
  const s = WD.speler;
  s.pos = [sp.x, sp.y, sp.z]; s.kijk = [sp.yaw, sp.pitch]; s.vliegt = sp.vliegt;
  WD.gespeeld = Date.now();
  WD.speeltijd = (WD.speeltijd || 0) + Math.round((performance.now() - (WD._sinds || performance.now())) / 1000); WD._sinds = performance.now();
  opslag.laatste = WD.id; bewaarInst();
}
async function bewaarWereld(stil) {
  if (!WD || bewaarBezig || !wereldKlaar) return;
  bewaarBezig = true;
  try {
    // een gedeelde wereld: de wereld bewaart de server; jouw plek en rugzak gaan naar de server, je kaart blijft hier
    if (WD.samen) {
      const s = WD.speler; s.pos = [sp.x, sp.y, sp.z]; s.kijk = [sp.yaw, sp.pitch]; s.vliegt = sp.vliegt;
      WD.speeltijd = (WD.speeltijd || 0) + Math.round((performance.now() - (WD._sinds || performance.now())) / 1000); WD._sinds = performance.now();
      samenStuur({ t: 'bewaar', d: samenSpelerData() });
      if (typeof kaartBewaren === 'function') await kaartBewaren();
      laatstBewaard = performance.now(); return;
    }
    wereldNaarOpslag();
    const kopie = Object.assign({}, WD); delete kopie._sinds;
    if (WD.karren) kopie.karren = WD.karren.map(karData);
    if (WD.bewoners) kopie.bewoners = WD.bewoners.map(bewonerData);
    if (WD.dieren) kopie.dieren = WD.dieren.map(dierData);
    const ok = await schrijfMeta(kopie);
    await vraagWb({ t: 'bewaar' });
    if (typeof kaartBewaren === 'function') await kaartBewaren();
    laatstBewaard = performance.now();
    if (!ok && !stil) melding(t('Bewaren lukt niet in deze browser (privévenster?). Je wereld blijft alleen staan zolang dit tabblad open is.'));
  } finally { bewaarBezig = false; }
}
setInterval(() => { if (spelBezig && wereldKlaar) bewaarWereld(true); }, 30000);
document.addEventListener('visibilitychange', () => { if (document.hidden && spelBezig) { bewaarWereld(true); if (!schermOpen() && !aanraak) openMenu(); } });
addEventListener('pagehide', () => { if (spelBezig) bewaarWereld(true); });

// ---------------- een nieuwe wereld
function nieuweWereldGegevens(naam, zaadTekst, stand, moeilijk) {
  const tekst = (zaadTekst || '').trim() || String(Math.floor(Math.random() * 2147483647));
  const zaad = G.zaadVan(tekst);
  const st = G.maakWereld(zaad).startPlek();
  return {
    id: 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), versie: 1,
    naam: (naam || '').trim().slice(0, 40) || t('Mijn wereld'), zaad, zaadTekst: tekst, stand: stand === 'bouwen' ? 'bouwen' : 'overleven',
    gemaakt: Date.now(), gespeeld: Date.now(), speeltijd: 0, tijd: 0.3, dag: 0,
    speler: { pos: [st.x, st.y, st.z], kijk: [Math.PI * 0.25, -0.15], vliegt: false, hp: 20, honger: 20, verzadiging: 5, adem: 10, uitputting: 0, start: [st.x, st.y, st.z], bed: null },
    inv: beginRugzak(stand), kies: 0, rugzakken: [], dingen: {}, plaatje: null, grotten: 2, gen: 3, erts: 2,
    moeilijk: G.WEZENS.MOEILIJK[moeilijk] ? moeilijk : 'makkelijk', dieren: [], dierVak: {},
  };
}
async function speelWereld(w) {
  sluitAlles(); menuWereld = null;
  losse.length = 0; dp.length = 0;
  WD = w; WD._sinds = performance.now();
  WD.dingen = WD.dingen || {}; WD.rugzakken = WD.rugzakken || []; WD.markers = WD.markers || []; WD.gevonden = WD.gevonden || [];
  bewonersLaden(); WD.bewoners = WD.bewoners || []; WD.dorpen = WD.dorpen || [];
  wezensLaden();
  // uit een wereld van vóór de nieuwe namen: de mijlpaal van de taart heette anders, en de bewoners krijgen eenmalig hun nieuwe naam
  if (WD.logboek && WD.logboek.vlaai !== undefined) { if (WD.logboek.taart === undefined) WD.logboek.taart = WD.logboek.vlaai; delete WD.logboek.vlaai; }
  bewonerNamenOmzetten();
  rijdtIn = null; doelKar = null; WD.karren = (WD.karren || []).map(k => Object.assign({ x: k.bx + 0.5, y: k.by, z: k.bz + 0.5, yaw: 0, pitch: 0, los: false }, k));
  if (typeof kaartLaden === 'function') kaartLaden(w.id);
  // wat bij de vorige wereld hoorde: logboek-klokjes, de open kist, het actielog
  lbKan = -1; lbDag = -1; bak = null; ACTIES.log.length = 0; KM.gekozen = null;
  startWereld(WD);
  rugzakkenLaden();
  tekenBalk(); lichaamKlassen();
  $('rb-laden').hidden = false; $('rb-laden-balk').style.width = '5%';
  if (w.samen) return; // een gedeelde wereld staat niet bij je eigen werelden
  opslag.laatste = w.id; bewaarInst();
  await schrijfMeta(w);
}
// een veilige plek op de grond (niet op een boom, niet in water) vlak bij de startplek
function veiligePlek(x0, z0) {
  const goed = new Set([B.gras, B.aarde, B.zand, B.sneeuwgras, B.bosgrond, B.sneeuw, B.grind, B.steen, B.mostkei, B.modder, B.zandsteen]);
  for (let r = 0; r <= 12; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
    const X = Math.floor(x0) + dx, Z = Math.floor(z0) + dz;
    for (let y = HOOG - 2; y > 1; y--) {
      const v = blokOp(X, y, Z); if (v < 0) break; const id = v & 255;
      if (!id || !G.VAST[id]) { if (id === G.W) break; continue; }
      if (goed.has(id) && !G.VAST[blokOp(X, y + 1, Z) & 255] && (blokOp(X, y + 1, Z) & 255) !== G.W && !G.VAST[blokOp(X, y + 2, Z) & 255]) return [X + 0.5, y + 1.02, Z + 0.5];
      break;
    }
  }
  return null;
}
function naGeladen() {
  $('rb-laden').hidden = true;
  valVrijTot = performance.now() + 6000;
  // nieuwe wereld: neerzetten op de grond in plaats van op een boomkruin
  if (!WD.geland && WD.id !== 'test') { WD.geland = true; const p = veiligePlek(sp.x, sp.z); if (p) { sp.x = p[0]; sp.y = p[1]; sp.z = p[2]; WD.speler.start = p.slice(); } }
  lichaamKlassen();
  if (!aanraak) vraagMuis();
  // een wereld van voor de nieuwe grotten: eerlijk vertellen wat er veranderd is
  if ((WD.grotten || 1) < 2) { const oud = !!WD.welkom; WD.grotten = 2; if (oud) setTimeout(() => melding(t('Nieuw in je wereld: grottenstelsels, ingangen en ravijnen. Waar je al gebouwd had, blijft alles zoals het was.')), 2500); }
  if (!WD.welkom) { WD.welkom = true; melding(WD.stand === 'bouwen' ? t('Bouwen: alles is onbeperkt. Twee keer springen is vliegen.') : (aanraak ? t('Houd je vinger op een boom om hout te hakken. Open je rugzak om planken en een werkbank te maken.') : t('Hak een boom (linkermuisknop ingedrukt) en maak planken en een werkbank in je rugzak (E).'))); }
}
async function naarWerelden() {
  if (WD) { await bewaarWereld(true); plaatjeVragen = false; }
  if (samen) samenStop();
  await vraagWb({ t: 'stop' });
  spelBezig = false; wereldKlaar = false; WD = null; menuWereld = null;
  kopie.clear(); meshRij.clear(); kleurGezet.clear(); R.allesWeg(); losse.length = 0; dp.length = 0;
  KAART.clear(); tegelBeeld.clear(); BOUWW.clear(); kaartVies.clear();
  sluitAlles(); beginScherm();
}

// ---------------- het beginscherm
function datum(ms) { try { return new Date(ms).toLocaleDateString(TAAL === 'en' ? 'en-GB' : 'nl-NL', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return ''; } }
function duur(s) { const u = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return u ? t('{0} u {1} min', u, m) : t('{0} min', Math.max(1, m)); }
async function toonWerelden() {
  const lijst = await alleWerelden();
  lijst.sort((a, b) => (b.gespeeld || 0) - (a.gespeeld || 0));
  const ul = $('rb-werelden'); ul.innerHTML = '';
  if (!lijst.length) { ul.innerHTML = `<li class="rb-leeg">${t('Nog geen werelden. Maak je eerste wereld!')}</li>`; }
  for (const w of lijst) {
    const li = document.createElement('li'); li.className = 'rb-wereld';
    const n = await telStukken(w.id);
    li.innerHTML = `<img class="plaatje" alt="" src="${w.plaatje || icoon(B.gras)}"><div><h3></h3><p><span class="badge ${w.stand}">${w.stand === 'bouwen' ? t('Bouwen') : t('Overleven')}</span>${datum(w.gespeeld)} · ${duur(w.speeltijd || 0)} · ${t('{0} veranderde stukken', n)}</p></div>
      <div class="rb-wereld-knoppen"><button type="button" class="rb-knop rood" data-doe="speel">${t('Spelen')}</button><button type="button" class="rb-knop klein" data-doe="naam">${t('Naam')}</button><button type="button" class="rb-knop klein" data-doe="export">${t('Exporteer')}</button><button type="button" class="rb-knop klein gevaar" data-doe="weg">${t('Verwijder')}</button></div>`;
    li.querySelector('h3').textContent = w.naam;
    li.querySelector('[data-doe=speel]').onclick = () => speelWereld(w);
    li.querySelector('[data-doe=naam]').onclick = async () => { const n2 = await vraag(t('Nieuwe naam'), t('Hoe heet deze wereld?'), { invoer: w.naam, ja: t('Bewaar') }); if (n2) { w.naam = n2.slice(0, 40); await schrijfMeta(w); toonWerelden(); } };
    li.querySelector('[data-doe=export]').onclick = () => exporteer(w);
    li.querySelector('[data-doe=weg]').onclick = async () => { if (await vraag(t('Wereld verwijderen?'), t('"{0}" is dan voorgoed weg. Exporteer hem eerst als je hem wilt bewaren.', w.naam), { ja: t('Verwijder'), gevaar: true })) { await verwijder(w.id); toonWerelden(); } };
    ul.appendChild(li);
  }
  return lijst;
}
function beginScherm() {
  spelBezig = false;
  startMenuWereld();
  // eerlijk vertellen dat de oude wereld niet meegaat
  let oud = null; try { oud = localStorage.getItem('rommelblok-v2'); } catch (e) {}
  const br = $('rb-nieuwtje');
  if (oud && !opslag.nieuwGezien) {
    br.hidden = false;
    br.innerHTML = `<p><b>${t('Rommelblok is helemaal vernieuwd!')}</b></p><p>${t('Een veel grotere wereld met biomen, rivieren, stromend water, grotten en echt craften. Je oude wereld past daar niet in, dus je begint opnieuw. Je oude wereld blijft wel bewaard in je browser.')}</p><p><button type="button" class="rb-knop klein" id="rb-nieuwtje-ok">${t('Begrepen')}</button></p>`;
    $('rb-nieuwtje-ok').onclick = () => { opslag.nieuwGezien = true; bewaarInst(); br.hidden = true; };
  } else br.hidden = true;
  openScherm('begin');
  $('rb-samen-knop').hidden = !samenAdres();
  toonWerelden();
}
$('rb-nieuw').addEventListener('click', () => { maakGewoon(); $('rb-maak-naam').value = t('Mijn wereld'); $('rb-maak-zaad').value = ''; kiesStand('overleven'); openScherm('maak'); setTimeout(() => $('rb-maak-naam').select(), 30); });
$('rb-begin-inst').addEventListener('click', () => openInstellingen());
$('rb-taal').addEventListener('click', () => zetTaal(TAAL === 'en' ? 'nl' : 'en'));
let gekozenStand = 'overleven', gekozenMoeilijk = 'makkelijk';
function kiesStand(s) { gekozenStand = s; for (const b of document.querySelectorAll('.rb-stand')) b.setAttribute('aria-checked', String(b.dataset.stand === s)); $('rb-maak-moeilijk-rij').hidden = s === 'bouwen'; }
// hoeveel griezels er 's nachts en in grotten komen (alleen bij overleven)
const MOEILIJK_UITLEG = { vredig: 'Geen griezels: alleen vriendelijke dieren.', makkelijk: 'Een paar griezels, en ze doen weinig pijn.', normaal: 'Griezels in het donker. Een lamp of fakkel houdt spookjes op afstand.', moeilijk: 'Meer griezels, en ze doen meer pijn.' };
function kiesMoeilijk(m) {
  gekozenMoeilijk = m; const g = $('rb-maak-moeilijk'); g.innerHTML = '';
  for (const [k, nl, en] of G.WEZENS.MOEILIJK_NAMEN) { const b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(k === m)); b.setAttribute('aria-pressed', String(k === m)); b.textContent = TAAL === 'en' ? en : nl; b.onclick = () => kiesMoeilijk(k); g.appendChild(b); }
  $('rb-maak-moeilijk-uitleg').textContent = t(MOEILIJK_UITLEG[m]);
}
kiesMoeilijk('makkelijk');
for (const b of document.querySelectorAll('.rb-stand')) b.addEventListener('click', () => kiesStand(b.dataset.stand));
const ZAADWOORDEN = ['taart', 'rommel', 'molen', 'tulp', 'kraanvogel', 'zolder', 'schuurtje', 'hamer', 'knikker', 'kroket', 'polder', 'duin', 'klomp', 'drop', 'paling', 'heide'];
$('rb-dobbel').addEventListener('click', () => { $('rb-maak-zaad').value = ZAADWOORDEN[Math.floor(Math.random() * ZAADWOORDEN.length)] + Math.floor(Math.random() * 1000); });
$('rb-maak-vorm').addEventListener('submit', e => { e.preventDefault(); if (maakSamen) { samenMaak($('rb-maak-zaad').value, gekozenStand, gekozenMoeilijk); return; } const w = nieuweWereldGegevens($('rb-maak-naam').value, $('rb-maak-zaad').value, gekozenStand, gekozenMoeilijk); speelWereld(w); });

// ---------------- verwijderen, exporteren en importeren
async function verwijder(id) {
  await dbKlaar; if (!db) return;
  const tx = db.transaction(['werelden', 'stukken'], 'readwrite');
  tx.objectStore('werelden').delete(id); tx.objectStore('stukken').delete(await stukBereik(id)); tx.objectStore('stukken').delete(kaartBereik(id)); tx.objectStore('stukken').delete('oud|' + id); tx.objectStore('stukken').delete('kolen|' + id);
  await new Promise(ok => { tx.oncomplete = tx.onerror = tx.onabort = ok; });
  if (opslag.laatste === id) { opslag.laatste = null; bewaarInst(); }
}
const b64 = buf => { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = s => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
async function exporteer(w) {
  await dbKlaar; if (!db) return;
  const sleutels = await idb(db.transaction('stukken').objectStore('stukken').getAllKeys(await stukBereik(w.id)));
  const stukken = [];
  for (const k of sleutels) {
    const r = await idb(db.transaction('stukken').objectStore('stukken').get(k)); if (!r) continue;
    const [, cx, cz] = String(k).split('|');
    stukken.push([+cx, +cz, r.d.z ? 1 : 0, b64(r.d.a), b64(r.b.buffer || r.b), b64(r.k.buffer || r.k)]);
  }
  const kopie = Object.assign({}, w); delete kopie.id; delete kopie._sinds;
  // de stukken die het landschap van voor versie 3 houden (als die er zijn)
  let oud = null; try { const r = await idb(db.transaction('stukken').objectStore('stukken').get('oud|' + w.id)); if (r instanceof Int32Array) oud = Array.from(r); } catch (e) {}
  // en de stukken die hun ertsen van voor oktober 2026 houden
  let kolen = null; try { const r = await idb(db.transaction('stukken').objectStore('stukken').get('kolen|' + w.id)); if (r instanceof Int32Array) kolen = Array.from(r); } catch (e) {}
  const bestand = JSON.stringify(Object.assign({ formaat: 'rommelblok-wereld', versie: 1, wereld: kopie, stukken }, oud ? { oud } : {}, kolen ? { kolen } : {}));
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([bestand], { type: 'application/json' }));
  a.download = (w.naam || 'wereld').replace(/[^\p{L}\p{N} _-]/gu, '').trim().replace(/\s+/g, '-').slice(0, 40) + '.rommelblok';
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  melding(t('Je wereld is als bestand gedownload.'), true);
}
$('rb-import').addEventListener('click', () => $('rb-bestand').click());
$('rb-bestand').addEventListener('change', async e => {
  const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
  if (f.size > 200 * 1048576) { melding(t('Dat bestand is te groot.')); return; }
  try { const n = await importeer(await f.text()); melding(t('Wereld geïmporteerd: {0}', n)); toonWerelden(); }
  catch (er) { console.warn(er); melding(t('Dit is geen geldige Rommelblok-wereld.')); }
});
async function uitpakken(z, u8) { if (!z) return u8; const s = new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate-raw')); return new Uint8Array(await new Response(s).arrayBuffer()); }
// streng controleren: alleen wat Rommelblok zelf maakt
function controleerWereld(w) {
  const getal = v => typeof v === 'number' && isFinite(v);
  if (!w || typeof w !== 'object' || typeof w.naam !== 'string' || !getal(w.zaad) || (w.stand !== 'bouwen' && w.stand !== 'overleven')) return false;
  const s = w.speler; if (!s || !Array.isArray(s.pos) || s.pos.length !== 3 || !s.pos.every(getal) || !Array.isArray(s.kijk) || !s.kijk.every(getal)) return false;
  if (Math.abs(s.pos[0]) > 3e7 || Math.abs(s.pos[2]) > 3e7 || s.pos[1] < -64 || s.pos[1] > 512) return false;
  if (!Array.isArray(w.inv) || w.inv.length !== 36) return false;
  for (const v of w.inv) if (v !== null && !(v && IT[v.id] && Number.isInteger(v.n) && v.n > 0 && v.n <= 64)) return false;
  return true;
}
function schoonWereld(w) {
  const getal = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
  const s = w.speler, vak = v => (v && IT[v.id] && Number.isInteger(v.n) && v.n > 0 && v.n <= 64 ? { id: v.id, n: v.n, ...(getal(v.dur, null) !== null ? { dur: v.dur } : {}) } : null);
  const vakken = (a, n) => Array.from({ length: n }, (_, i) => vak(Array.isArray(a) ? a[i] : null));
  const plek = p => (Array.isArray(p) && p.length === 3 && p.every(v => typeof v === 'number' && isFinite(v)) ? p.slice() : null);
  const dingen = {};
  for (const [k, d] of Object.entries(w.dingen && typeof w.dingen === 'object' ? w.dingen : {})) {
    if (!/^-?\d+,-?\d+,-?\d+$/.test(k) || !d) continue;
    if (d.soort === 'kist') dingen[k] = { soort: 'kist', inhoud: vakken(d.inhoud, 27) };
    else if (d.soort === 'oven') dingen[k] = { soort: 'oven', in: vak(d.in), brand: vak(d.brand), uit: vak(d.uit), brandTijd: getal(d.brandTijd, 0), brandMax: getal(d.brandMax, 0), kook: getal(d.kook, 0) };
  }
  return {
    versie: 1, naam: String(w.naam).slice(0, 40), zaad: w.zaad >>> 0, zaadTekst: String(w.zaadTekst || w.zaad).slice(0, 40), stand: w.stand,
    gemaakt: getal(w.gemaakt, Date.now()), gespeeld: Date.now(), speeltijd: getal(w.speeltijd, 0), tijd: ((getal(w.tijd, 0.3) % 1) + 1) % 1, dag: Math.max(0, Math.floor(getal(w.dag, 0))),
    speler: { pos: s.pos.slice(), kijk: [getal(s.kijk[0], 0), klem(getal(s.kijk[1], 0), -1.55, 1.55)], vliegt: !!s.vliegt, hp: klem(getal(s.hp, 20), 1, 20), honger: klem(getal(s.honger, 20), 0, 20), verzadiging: klem(getal(s.verzadiging, 5), 0, 20), adem: 10, uitputting: 0, start: plek(s.start) || s.pos.slice(), bed: plek(s.bed) },
    inv: vakken(w.inv, 36), kies: klem(Math.floor(getal(w.kies, 0)), 0, 8),
    rugzakken: (Array.isArray(w.rugzakken) ? w.rugzakken : []).slice(0, 20).map(r => ({ x: getal(r.x, 0), y: getal(r.y, 64), z: getal(r.z, 0), inhoud: (Array.isArray(r.inhoud) ? r.inhoud : []).slice(0, 36).map(vak).filter(Boolean), dag: getal(r.dag, 0) })),
    dingen, grotten: w.grotten === 2 ? 2 : 1, gen: w.gen === 3 ? 3 : 2, erts: w.erts === 2 ? 2 : 1, welkom: !!w.welkom,
    markers: (Array.isArray(w.markers) ? w.markers : []).slice(0, MAX_MARKERINGEN).filter(m => m && [m.x, m.y, m.z].every(v => typeof v === 'number' && isFinite(v))).map(m => ({ x: m.x, y: m.y, z: m.z, naam: String(m.naam || '').slice(0, 24) || '?', kleur: Math.abs(Math.floor(getal(m.kleur, 0))) % 6 })),
    kompasDoel: Math.floor(getal(w.kompasDoel, -1)),
    karren: (Array.isArray(w.karren) ? w.karren : []).slice(0, 300).filter(k => k && Number.isInteger(k.id) && k.id > 0 && [k.bx, k.by, k.bz].every(Number.isInteger) && k.by >= 0 && k.by < 128).map(k => ({ id: k.id, bx: k.bx, by: k.by, bz: k.bz, van: Math.abs(Math.floor(getal(k.van, 0))) % 4, t: klem(getal(k.t, 0.5), 0, 1), v: klem(getal(k.v, 0), -11, 11) })),
    bewoners: (Array.isArray(w.bewoners) ? w.bewoners : []).slice(0, 2000).map(schoonBewoner).filter(Boolean),
    dorpen: (Array.isArray(w.dorpen) ? w.dorpen : []).filter(d => typeof d === 'string' && /^-?\d+,-?\d+$/.test(d)).slice(0, 2000), bewonerNr: Math.max(0, Math.floor(getal(w.bewonerNr, 0))),
    karNr: Math.max(0, Math.floor(getal(w.karNr, 0))), karBronnen: (Array.isArray(w.karBronnen) ? w.karBronnen : []).filter(b => typeof b === 'string' && /^-?\d+,-?\d+,-?\d+$/.test(b)).slice(-400),
    gevonden: (Array.isArray(w.gevonden) ? w.gevonden : []).slice(0, 300).filter(g => Array.isArray(g) && /^(ruine|mijn|krater|dorp)$/.test(g[0]) && g.slice(1, 4).every(v => typeof v === 'number' && isFinite(v))).map(g => g.slice(0, 4)),
    logboek: w.logboek && typeof w.logboek === 'object' ? Object.fromEntries(Object.entries(w.logboek).map(([k, v]) => [k === 'vlaai' ? 'taart' : k, v]).filter(([k, v]) => LB[k] && Number.isInteger(v) && v > 0)) : undefined,
    dieren: (Array.isArray(w.dieren) ? w.dieren : []).slice(0, 6000).map(schoonDier).filter(Boolean).map(dierData),
    dierVak: Object.fromEntries(Object.entries(w.dierVak && typeof w.dierVak === 'object' ? w.dierVak : {}).filter(([k, v]) => /^-?\d+,-?\d+$/.test(k) && Array.isArray(v) && v.length === 2 && v.every(n => Number.isInteger(n) && n >= 0 && n < 4294967296)).slice(0, 20000)),
    moeilijk: G.WEZENS.MOEILIJK[w.moeilijk] ? w.moeilijk : 'makkelijk',
    stats: { geplaatst: Math.max(0, Math.floor(getal(w.stats && w.stats.geplaatst, 0))) }, plaatje: typeof w.plaatje === 'string' && /^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(w.plaatje) && w.plaatje.length < 60000 ? w.plaatje : null,
  };
}
// een bewoner uit een bestand: alleen wat klopt (plekken als drie gehele getallen, een bekend beroep, ruilen uit de lijst)
function schoonBewoner(b) {
  if (!b || !Number.isInteger(b.id) || b.id <= 0 || !BEROEP[b.beroep] || typeof b.dorp !== 'string') return null;
  const plek = p => (Array.isArray(p) && p.length === 3 && p.every(Number.isInteger) ? p.slice() : null), getal = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
  const vak = b.vak && typeof b.vak === 'object' && Array.isArray(b.vak.min) && Array.isArray(b.vak.max) && b.vak.min.length === 2 && b.vak.max.length === 2 && [...b.vak.min, ...b.vak.max].every(Number.isInteger) && Number.isInteger(b.vak.y) ? { min: b.vak.min.slice(), max: b.vak.max.slice(), y: b.vak.y, rand: plek(b.vak.rand) } : null;
  const ruil = (Array.isArray(b.ruil) ? b.ruil : []).filter(r => Array.isArray(r) && Number.isInteger(r[0]) && RUIL[b.beroep][r[0]] && Number.isInteger(r[1])).slice(0, 6).map(r => [r[0], klem(r[1], 0, RUIL[b.beroep][r[0]].max)]);
  if (!plek(b.bed)) return null;
  return { id: b.id, dorp: b.dorp.slice(0, 24), beroep: b.beroep, naam: String(b.naam || '?').slice(0, 24), kl: Math.abs(Math.floor(getal(b.kl, 0))) >>> 0, bed: plek(b.bed), thuis: plek(b.thuis), deur: plek(b.deur), buiten: plek(b.buiten), werk: plek(b.werk), kijk: plek(b.kijk), put: plek(b.put), vak,
    x: getal(b.x, b.bed[0] + 0.5), y: klem(getal(b.y, b.bed[1]), 0, 127), z: getal(b.z, b.bed[2] + 0.5), yaw: getal(b.yaw, 0), ruil: ruil.length ? ruil : kiesRuil(b.beroep, b.kl >>> 0), dag: Math.floor(getal(b.dag, 0)) };
}
async function importeer(tekst) {
  const o = JSON.parse(tekst);
  if (!o || o.formaat !== 'rommelblok-wereld' || o.versie !== 1 || !controleerWereld(o.wereld) || !Array.isArray(o.stukken) || o.stukken.length > 200000) throw new Error('formaat');
  const w = schoonWereld(o.wereld);
  w.id = 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  // stukken controleren voordat er iets wordt opgeslagen
  const goed = [];
  for (const s of o.stukken) {
    if (!Array.isArray(s) || s.length !== 6 || !Number.isInteger(s[0]) || !Number.isInteger(s[1]) || Math.abs(s[0]) > 2e6 || Math.abs(s[1]) > 2e6) throw new Error('stuk');
    if (typeof s[3] !== 'string' || typeof s[4] !== 'string' || typeof s[5] !== 'string') throw new Error('stuk');
    const raw = unb64(s[3]), d = await uitpakken(s[2] === 1, raw);
    if (d.length !== G.VOL * 2) throw new Error('stukgrootte');
    const blokken = new Uint16Array(d.buffer.slice(d.byteOffset, d.byteOffset + d.length));
    for (let i = 0; i < blokken.length; i++) { const id = blokken[i] & 255; if (id && !BL[id]) throw new Error('blok'); }
    const b = unb64(s[4]), k = unb64(s[5]); if (b.length !== 256 || k.length !== 1536) throw new Error('kleur');
    goed.push([w.id + '|' + s[0] + '|' + s[1], { d: { z: s[2] === 1 ? 1 : 0, a: raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.length) }, b, k: new Uint16Array(k.buffer.slice(0)), t: Date.now() }]);
  }
  // de stukken met het landschap van voor versie 3: paren gehele getallen
  let oud = null;
  if (o.oud !== undefined) {
    if (!Array.isArray(o.oud) || o.oud.length % 2 || o.oud.length > 800000 || !o.oud.every(v => Number.isInteger(v) && Math.abs(v) <= 2e6)) throw new Error('oud');
    oud = Int32Array.from(o.oud);
  }
  // de stukken met de ertsen van voor oktober 2026 (ook paren gehele getallen)
  let kolen = null;
  if (o.kolen !== undefined) {
    if (!Array.isArray(o.kolen) || o.kolen.length % 2 || o.kolen.length > 800000 || !o.kolen.every(v => Number.isInteger(v) && Math.abs(v) <= 2e6)) throw new Error('kolen');
    kolen = Int32Array.from(o.kolen);
  }
  await dbKlaar; if (!db) throw new Error('opslag');
  await new Promise((ok, nee) => {
    const tx = db.transaction(['werelden', 'stukken'], 'readwrite');
    tx.objectStore('werelden').put(w); const st = tx.objectStore('stukken'); for (const [k, r] of goed) st.put(r, k);
    if (oud) st.put(oud, 'oud|' + w.id);
    if (kolen) st.put(kolen, 'kolen|' + w.id);
    tx.oncomplete = ok; tx.onerror = tx.onabort = () => nee(tx.error);
  });
  return w.naam;
}
// een plaatje van de wereld voor in de lijst (na het tekenen meteen pakken)
function maakPlaatje() {
  try { const c = document.createElement('canvas'); c.width = c.height = 96; const g = c.getContext('2d'); const s = Math.min(doek.width, doek.height); g.drawImage(doek, (doek.width - s) / 2, (doek.height - s) / 2, s, s, 0, 0, 96, 96); WD.plaatje = c.toDataURL('image/jpeg', 0.7); } catch (e) {}
}

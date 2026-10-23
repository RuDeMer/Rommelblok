// ============================================================================
// Schermen en wat er altijd in beeld staat (snelbalk, levens, honger, adem, meldingen)
// ============================================================================
const ICONEN = RB_ICONEN(G, TEX);
const icoon = id => ICONEN.icoon(id, 32);
document.body.classList.toggle('rb-aanraak', aanraak);
// ---------------- schermen op een stapel: het bovenste is zichtbaar
const stapel = [];
function openScherm(naam) {
  for (const n of stapel) { const e = $('rb-' + n); if (e) e.hidden = true; }
  const i = stapel.indexOf(naam); if (i >= 0) stapel.splice(i, 1);
  stapel.push(naam); const el = $('rb-' + naam); if (el) el.hidden = false;
  if (document.pointerLockElement) { try { document.exitPointerLock(); } catch (e) {} }
  for (const k in toets) toets[k] = false; hakKnop = bouwKnop = false; hakStop(); if (typeof aanraakLos === 'function') aanraakLos();
  lichaamKlassen();
  const f = el && el.querySelector('[autofocus], .rb-knop.rood, button'); if (f && !aanraak) setTimeout(() => { try { f.focus({ preventScroll: true }); } catch (e) {} }, 30);
  klank('klik');
}
function sluitScherm() {
  const n = stapel.pop(); const el = n && $('rb-' + n); if (el) el.hidden = true;
  if (n === 'rugzak' && typeof naRugzakDicht === 'function') naRugzakDicht();
  if (n === 'bouwmenu' && typeof bouwmenuDicht === 'function') bouwmenuDicht();
  const boven = stapel[stapel.length - 1]; if (boven) $('rb-' + boven).hidden = false;
  if (!stapel.length && spelBezig) { vraagMuis(); }
  lichaamKlassen();
}
function sluitAlles() { while (stapel.length) sluitScherm(); }
const schermOpen = () => stapel.length > 0;
const huidigScherm = () => stapel[stapel.length - 1] || null;
for (const el of document.querySelectorAll('[data-sluit]')) el.addEventListener('click', () => sluitScherm());
function lichaamKlassen() {
  const c = document.body.classList;
  c.toggle('rb-speelt', spelBezig && wereldKlaar && !schermOpen());
  c.toggle('rb-bouwen', wereldStand() === 'bouwen');
  c.toggle('rb-vliegt', !!sp.vliegt);
  c.toggle('rb-kruismodus', inst.richtModus === 'kruis');
  c.toggle('rb-tikmodus', inst.richtModus !== 'kruis');
}
// ---------------- meldingen
let meldingKlok = null;
function melding(tekst, klein) {
  const m = $('rb-melding'); m.textContent = tekst; m.classList.toggle('klein', !!klein); m.hidden = false;
  clearTimeout(meldingKlok); meldingKlok = setTimeout(() => { m.hidden = true; }, klein ? 2200 : 3600);
}
let naamKlok = null;
function toonNaam(n) { const e = $('rb-naam'); e.textContent = n; e.style.opacity = 1; clearTimeout(naamKlok); naamKlok = setTimeout(() => { e.style.opacity = 0; }, 1800); }
// ---------------- kleine plaatjes voor levens, honger en adem (zelf getekend)
function pix(rijen, kleuren) {
  const c = document.createElement('canvas'); c.width = rijen[0].length; c.height = rijen.length; const g = c.getContext('2d');
  rijen.forEach((r, y) => [...r].forEach((k, x) => { if (k !== '.') { g.fillStyle = kleuren[k]; g.fillRect(x, y, 1, 1); } }));
  return c.toDataURL();
}
const HART = ['..oo.oo..', '.orrorro.', 'orwrrrrro', 'orrrrrrro', 'orrrrrrdo', '.orrrrdo.', '..orrdo..', '...odo...', '....o....'];
const HART_HALF = HART.map(r => r.slice(0, 5).replace(/[rwd]/g, m => m) + r.slice(5).replace(/[rwd]/g, 'e'));
const HART_LEEG = HART.map(r => r.replace(/[rwd]/g, 'e'));
const kH = { o: '#2A1418', r: '#E03A46', w: '#FFC0C0', d: '#9A1E2A', e: '#4A2A30' };
// honger: taartpuntjes (een punt met slagroom en een besje bovenop)
const TAART = ['.....ooo.', '...oowrwo', '.oowwwwwo', 'owwwwwwwo', 'okkkkkkko', 'obbbbbbbo', '.ooooooo.'];
const kV = { o: '#3A2412', w: '#FBF3E2', r: '#C8283A', k: '#B0182E', b: '#D9A35A', e: '#4A3A2A' };
const TAART_LEEG = TAART.map(r => r.replace(/[wrkb]/g, 'e')), TAART_HALF = TAART.map(r => r.slice(0, 4).replace(/[wrkb]/g, 'e') + r.slice(4));
const BEL = ['..ooo..', '.owbbo.', 'owbbbbo', 'obbbbbo', 'obbbbbo', '.obbbo.', '..ooo..'];
const kB = { o: '#1E4A7A', w: '#FFFFFF', b: '#7FC8FF' };
const PL = { hart: pix(HART, kH), hartHalf: pix(HART_HALF, kH), hartLeeg: pix(HART_LEEG, kH), taart: pix(TAART, kV), taartHalf: pix(TAART_HALF, kV), taartLeeg: pix(TAART_LEEG, kV), bel: pix(BEL, kB) };
function rij(el, n, vol, half, leeg, waarde) {
  if (el.children.length !== n) { el.innerHTML = ''; for (let i = 0; i < n; i++) el.appendChild(document.createElement('i')); }
  for (let i = 0; i < n; i++) { const v = waarde - i * 2, u = v >= 2 ? vol : v >= 1 ? half : leeg; const c = el.children[i]; if (c.dataset.u !== u) { c.dataset.u = u; c.style.backgroundImage = u ? `url(${u})` : 'none'; } }
}
// ---------------- de snelbalk
function vakHtml(s, extra) {
  if (!s) return extra || '';
  const it = IT[s.id]; let h = `<img src="${icoon(s.id)}" alt="">`;
  if (s.n > 1) h += `<b>${s.n}</b>`;
  if (it && it.duur && s.dur != null && s.dur < it.duur) { const p = Math.max(0, s.dur / it.duur); h += `<u><i style="width:${(p * 100).toFixed(0)}%;background:hsl(${(p * 120).toFixed(0)},70%,48%)"></i></u>`; }
  return h + (extra || '');
}
function tekenBalk() {
  const b = $('rb-balk'); if (!WD) return;
  if (b.children.length !== 9) { b.innerHTML = ''; for (let i = 0; i < 9; i++) { const k = document.createElement('button'); k.type = 'button'; k.className = 'rb-vak'; k.dataset.i = i; b.appendChild(k); } }
  for (let i = 0; i < 9; i++) {
    const k = b.children[i], s = WD.inv[i], h = vakHtml(s, aanraak ? '' : `<small>${i + 1}</small>`);
    if (k.dataset.h !== h) { k.innerHTML = h; k.dataset.h = h; }
    k.classList.toggle('gekozen', i === WD.kies);
    k.setAttribute('aria-label', (i + 1) + ': ' + (s ? naam(s.id) + (s.n > 1 ? ' (' + s.n + ')' : '') : t('Leeg')));
    k.setAttribute('aria-pressed', i === WD.kies ? 'true' : 'false');
  }
}
$('rb-balk').addEventListener('pointerdown', e => { const k = e.target.closest('.rb-vak'); if (!k) return; e.preventDefault(); e.stopPropagation(); kies(+k.dataset.i); balkHoud = { i: +k.dataset.i, t: performance.now() }; });
let balkHoud = null;
$('rb-balk').addEventListener('pointerup', () => { balkHoud = null; });
// ---------------- elk beeldje
let hudKlok = 0;
function hudTik(dt, L) {
  laatsteLucht = L;
  const nu = performance.now();
  if (typeof miniTik === 'function') { miniTik(nu); vindTik(nu); logboekTik(nu); }
  if (rugzakVies && WD) { rugzakVies = false; tekenBalk(); if (typeof rugzakOpnieuw === 'function') rugzakOpnieuw(); }
  // lang op een vak in de balk drukken: weggooien (aanraken)
  if (balkHoud && performance.now() - balkHoud.t > 650) { balkHoud.t = performance.now() + 9e9; gooiWeg(false); }
  const ov = wereldStand() !== 'bouwen' && WD && wereldKlaar;
  const st = $('rb-status'); st.hidden = !ov;
  if (ov) {
    const s = WD.speler;
    rij($('rb-harten'), 10, PL.hart, PL.hartHalf, PL.hartLeeg, s.hp);
    rij($('rb-honger'), 10, PL.taart, PL.taartHalf, PL.taartLeeg, s.honger);
    const ad = $('rb-adem'); const toon = sp.hoofdOnder || s.adem < 9.9; ad.style.visibility = toon ? 'visible' : 'hidden';
    if (toon) rij(ad, 10, PL.bel, PL.bel, '', Math.ceil(s.adem) * 2);
  }
  // lagen over het hele scherm alleen als ze iets laten zien (anders kosten ze veel op zwakke apparaten)
  laag('rb-rood', rood ? Math.min(1, rood) : (ov && WD.speler.hp <= 4 ? 0.25 + 0.15 * Math.sin(performance.now() / 300) : 0));
  laag('rb-water', sp.hoofdOnder ? 1 : 0);
  // de weg naar je achtergelaten rugzak; met een kompas in je hand anders naar je bed of startplek
  const w = $('rb-wijzer'), rz = WD && WD.rugzakken && WD.rugzakken.length ? WD.rugzakken[WD.rugzakken.length - 1] : null;
  const hand = inHand(), kompas = hand && hand.id === I.kompas && WD, kd = kompas && !rz ? kompasDoel() : null;
  const doelP = rz ? [rz.x, rz.y, rz.z] : kd ? kd.p : null;
  if (doelP && wereldKlaar) {
    const dx = doelP[0] - sp.x, dz = doelP[2] - sp.z, af = Math.hypot(dx, dz);
    const hoek = Math.atan2(dx, -dz) + sp.yaw; // 0 = recht vooruit
    w.hidden = false; w.querySelector('.pijl').style.transform = `rotate(${(hoek * 180 / Math.PI - 90).toFixed(0)}deg)`;
    const m = Math.round(af), dy = Math.round(doelP[1] - sp.y);
    // met het kompas zie je ook of het hoger of lager ligt
    const hoogte = !rz && Math.abs(dy) >= 3 ? ' · ' + (dy > 0 ? t('{0} m hoger', dy) : t('{0} m lager', -dy)) : '';
    const tk = rz ? t('Je rugzak: {0} m', Math.round(Math.hypot(af, doelP[1] - sp.y))) : kd.naam + ': ' + t('{0} m', m) + hoogte;
    if ($('rb-wijzer-tekst').textContent !== tk) $('rb-wijzer-tekst').textContent = tk;
  } else w.hidden = true;
  // een klok in je hand laat de tijd zien
  const s = inHand(), k = $('rb-klok');
  if (s && s.id === I.klok && WD) { const u = (WD.tijd * 24 + 0) % 24; k.hidden = false; k.textContent = '🕰 ' + String(Math.floor(u)).padStart(2, '0') + ':' + String(Math.floor((u % 1) * 60)).padStart(2, '0'); } else k.hidden = true;
  hudKlok += dt;
  if (inst.fps && hudKlok > 0.4) {
    hudKlok = 0; const f = $('rb-fps'); f.hidden = false;
    const b = WD ? biomeOp(Math.floor(sp.x), Math.floor(sp.z)) : -1;
    f.textContent = `${fps.toFixed(0)} fps · ${frameMs.toFixed(1)} ms · schaal ${dynSchaal.toFixed(2)}\n${R.stats.stukken} stukken · ${R.stats.draws} tekenopdrachten · ${(R.stats.vlakken / 1000).toFixed(0)}k vlakken · ${R.gpuMB.toFixed(0)} MB\nx ${sp.x.toFixed(1)} y ${sp.y.toFixed(1)} z ${sp.z.toFixed(1)} · kijkafstand ${huidigeStraal}${b >= 0 ? ' · ' + biomeNaam(b) : ''}`;
  } else if (!inst.fps) $('rb-fps').hidden = true;
  lichaamKlassen();
  if (GELUID && GELUID.omgeving && WD) {
    const l = lichtOp(Math.floor(sp.x), Math.floor(sp.y + 1.6), Math.floor(sp.z)) >> 4;
    try { GELUID.omgeving({ buiten: l / 15, hoogte: sp.y, nacht: 1 - L.dag, onderWater: sp.hoofdOnder, grot: sp.y < 50 && l < 4 ? 1 : 0, waterBij: waterBij(), regen: 0, pauze: schermOpen() || document.hidden }); } catch (e) {}
  }
}
const laagWaarde = {};
function laag(id, o) {
  o = Math.round(o * 50) / 50; if (laagWaarde[id] === o) return; laagWaarde[id] = o;
  const e = $(id); e.hidden = o <= 0; if (o > 0) e.style.opacity = o;
}
let waterBijKlok = 0, waterBijW = 0;
function waterBij() {
  if (performance.now() - waterBijKlok < 500) return waterBijW; waterBijKlok = performance.now();
  let n = 0; const X = Math.floor(sp.x), Y = Math.floor(sp.y), Z = Math.floor(sp.z);
  for (let i = 0; i < 60; i++) { const v = blokOp(X + Math.floor(Math.random() * 13) - 6, Y + Math.floor(Math.random() * 7) - 3, Z + Math.floor(Math.random() * 13) - 6); if ((v & 255) === G.W && (v >> 8)) n++; }
  return (waterBijW = Math.min(1, n / 6));
}
// ---------------- menu
function openMenu() {
  if (!WD) return;
  $('rb-menu-info').textContent = WD.naam + ' · ' + (WD.stand === 'bouwen' ? t('Bouwen') : t('Overleven')) + ' · ' + t('dag {0}', (WD.dag || 0) + 1);
  $('rb-menu-scherm').hidden = !document.fullscreenEnabled && !document.webkitFullscreenEnabled;
  $('rb-menu-logboek').hidden = WD.stand === 'bouwen';
  if (WD.stand !== 'bouwen') { const n = aantalMijlpalen(); $('rb-menu-logboek').textContent = t('Logboek') + ' (' + n + '/' + LOGBOEK.length + ')'; }
  openScherm('menu');
  if (typeof bewaarWereld === 'function') bewaarWereld();
}
$('rb-menu-inst').addEventListener('click', () => openInstellingen());
$('rb-menu-hulp').addEventListener('click', () => openHulp());
$('rb-menu-scherm').addEventListener('click', () => volledigScherm(true));
$('rb-menu-uit').addEventListener('click', () => { if (typeof naarWerelden === 'function') naarWerelden(); });
$('rb-menu-kaart').addEventListener('click', () => openKaart());
$('rb-menu-logboek').addEventListener('click', () => openLogboek());
function volledigScherm(wissel) {
  const d = document, el = d.documentElement;
  try {
    if (d.fullscreenElement || d.webkitFullscreenElement) { if (wissel) (d.exitFullscreen || d.webkitExitFullscreen).call(d); return; }
    const f = el.requestFullscreen || el.webkitRequestFullscreen; if (f) { const p = f.call(el, { navigationUI: 'hide' }); if (p && p.catch) p.catch(() => {}); }
  } catch (e) {}
}
// ---------------- instellingen
const INST_RIJEN = [
  ['kwaliteit', 'Grafische kwaliteit', 'Automatisch past zich aan je apparaat aan.', 'keuze', [['auto', 'Automatisch'], ['laag', 'Laag'], ['midden', 'Midden'], ['hoog', 'Hoog']]],
  ['kijk', 'Kijkafstand', 'Hoe ver je kunt kijken (in stukken van 16 blokken). Automatisch wordt korter als het te traag gaat.', 'schuif', [0, 16, 1]],
  ['fov', 'Gezichtsveld', '', 'schuif', [55, 100, 1]],
  ['muis', 'Gevoeligheid muis', '', 'schuif', [0.2, 3, 0.05]],
  ['aanraak', 'Gevoeligheid aanraken', '', 'schuif', [0.2, 3, 0.05]],
  ['richtModus', 'Richten op een telefoon', 'Tikken waar je wilt, of richten met het kruisje in het midden en knoppen.', 'keuze', [['tik', 'Tikken'], ['kruis', 'Kruisje']]],
  ['omkeren', 'Omhoog en omlaag kijken omdraaien', '', 'aanuit'],
  ['helder', 'Helderheid', 'Hoe licht het is in het donker.', 'schuif', [0, 1, 0.05]],
  ['geluid', 'Geluid', '', 'aanuit'],
  ['volume', 'Volume', '', 'schuif', [0, 1, 0.05]],
  ['muziek', 'Rustige muziek', 'Af en toe een kort, kalm stukje.', 'aanuit'],
  ['schommel', 'Schommelen bij het lopen', 'Hoe sterk je hoofd meedeint met je stappen.', 'niveau', ['Uit', 'Zacht', 'Rustig', 'Normaal', 'Sterk']],
  ['opstappen', 'Vanzelf opstappen', 'Loop vanzelf een blok omhoog, zonder te springen. Halve blokken gaan altijd vanzelf.', 'aanuit'],
  ['huid', 'Huidskleur van je arm', '', 'kleur', ['#F1D3BC', '#E3B591', '#C68C62', '#A36A45', '#7B4B2E', '#4F3020']],
  ['fps', 'Beelden per seconde tonen', '', 'aanuit'],
  ['taal', 'Taal', '', 'keuze', [['nl', 'Nederlands'], ['en', 'English']]],
];
function openInstellingen() {
  const l = $('rb-inst-lijst'); l.innerHTML = '';
  for (const [k, titel, uitleg, soort, extra] of INST_RIJEN) {
    if ((k === 'aanraak' || k === 'richtModus') && !aanraak) continue;
    if (k === 'muis' && aanraak && !matchMedia('(pointer: fine)').matches) continue;
    const r = document.createElement('div'); r.className = 'rb-inst-rij';
    const id = 'inst-' + k;
    r.innerHTML = `<label for="${id}">${t(titel)}${uitleg ? `<small>${t(uitleg)}</small>` : ''}</label><div></div>`;
    const plek = r.lastChild;
    const waarde = k === 'taal' ? TAAL : inst[k];
    if (soort === 'keuze') {
      const g = document.createElement('div'); g.className = 'rb-keuzes'; g.id = id; g.setAttribute('role', 'group');
      for (const [w, nm] of extra) { const b = document.createElement('button'); b.type = 'button'; b.textContent = t(nm); b.setAttribute('aria-pressed', String(waarde === w)); b.onclick = () => { zetInst(k, w); openInstellingen(); }; g.appendChild(b); }
      plek.appendChild(g);
    } else if (soort === 'aanuit') {
      const g = document.createElement('div'); g.className = 'rb-keuzes'; g.id = id;
      for (const [w, nm] of [[true, 'Aan'], [false, 'Uit']]) { const b = document.createElement('button'); b.type = 'button'; b.textContent = t(nm); b.setAttribute('aria-pressed', String(!!waarde === w)); b.onclick = () => { zetInst(k, w); openInstellingen(); }; g.appendChild(b); }
      plek.appendChild(g);
    } else if (soort === 'niveau') {
      // een schuif met namen in plaats van getallen
      const s = document.createElement('input'); s.type = 'range'; s.id = id; s.min = 0; s.max = extra.length - 1; s.step = 1; s.value = waarde;
      const w = document.createElement('small');
      const toon = () => { w.textContent = t(extra[+s.value]); s.setAttribute('aria-valuetext', t(extra[+s.value])); };
      if (k === 'schommel' && minderBeweging) { s.disabled = true; s.value = 0; w.textContent = t('Uit: je apparaat vraagt om minder beweging.'); }
      else { s.oninput = () => { zetInst(k, +s.value); toon(); }; toon(); }
      plek.appendChild(s); plek.appendChild(w);
    } else if (soort === 'kleur') {
      const g = document.createElement('div'); g.className = 'rb-keuzes rb-kleuren'; g.id = id; g.setAttribute('role', 'group');
      extra.forEach((c, i) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'rb-kleur'; b.style.setProperty('--kl', c); b.setAttribute('aria-label', t('Huidskleur {0}', i + 1)); b.setAttribute('aria-pressed', String(waarde === i)); b.onclick = () => { zetInst(k, i); openInstellingen(); }; g.appendChild(b); });
      plek.appendChild(g);
    } else {
      const [lo, hi, st] = extra; const s = document.createElement('input'); s.type = 'range'; s.id = id; s.min = lo; s.max = hi; s.step = st; s.value = waarde;
      const w = document.createElement('small'); const toon = () => { w.textContent = k === 'kijk' ? (+s.value ? s.value : t('Automatisch') + ' (' + huidigeStraal + ')') : k === 'fov' ? s.value + '°' : (+s.value).toFixed(2); };
      s.oninput = () => { zetInst(k, +s.value); toon(); }; toon();
      plek.appendChild(s); plek.appendChild(w);
    }
    l.appendChild(r);
  }
  if (huidigScherm() !== 'inst') openScherm('inst');
}
function zetInst(k, v) {
  if (k === 'taal') { zetTaal(v); return; }
  const oud = inst[k]; inst[k] = v; bewaarInst();
  if (k === 'kwaliteit' && v !== oud) { KW = KWAL[kwaliteitNu()]; dynSchaal = KW.schaal || 1; huidigeStraal = straalNu(); vertelPlek(performance.now(), true); wb.postMessage({ t: 'opties', opties: { snelleBladeren: KW.snelleBladeren }, straal: huidigeStraal, opnieuw: true }); melding(t('Sommige veranderingen zie je pas na opnieuw laden.'), true); }
  if (k === 'kijk') { huidigeStraal = straalNu(); vertelPlek(performance.now(), true); }
  if (k === 'geluid' && GELUID) { GELUID.aan(!!v); if (v) GELUID.ontgrendel(); }
  if (k === 'volume' && GELUID) GELUID.volume(v);
  if (k === 'muziek' && GELUID) GELUID.muziek(!!v);
}
if (GELUID) { try { GELUID.aan(!!inst.geluid); GELUID.volume(inst.volume); GELUID.muziek(!!inst.muziek); } catch (e) {} }
addEventListener('pointerdown', () => { if (GELUID && inst.geluid) try { GELUID.ontgrendel(); } catch (e) {} }, { capture: true });
addEventListener('keydown', () => { if (GELUID && inst.geluid) try { GELUID.ontgrendel(); } catch (e) {} }, { capture: true });
// ---------------- besturing uitleggen
function openHulp() {
  const muis = `<h3>${t('Lopen en kijken')}</h3><ul><li><kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> ${t('lopen, de muis om rond te kijken')}</li><li><kbd>${t('Spatie')}</kbd> ${t('springen (in water: zwemmen)')}</li><li><kbd>Shift</kbd> ${t('sluipen: je valt niet van randjes')}</li><li><kbd>Ctrl</kbd> ${t('of twee keer W: rennen')}</li><li>${t('In de bouwstand: twee keer')} <kbd>${t('Spatie')}</kbd> ${t('om te vliegen; Spatie omhoog, Shift omlaag')}</li></ul>
    <h3>${t('Hakken en bouwen')}</h3><ul><li>${t('Linkermuisknop ingedrukt houden: hakken')}</li><li>${t('Rechtermuisknop: bouwen, eten of iets gebruiken (deur, kist, oven, werkbank, bed)')}</li><li>${t('Shift + rechts: toch bouwen tegen een kist of deur')}</li><li>${t('Middelste muisknop: pak het blok waar je naar kijkt')}</li></ul>
    <h3>${t('Rugzak')}</h3><ul><li><kbd>1</kbd> ${t('tot')} <kbd>9</kbd> ${t('of het muiswiel: kiezen')}</li><li><kbd>E</kbd> ${t('rugzak en maken')}, <kbd>Q</kbd> ${t('weggooien')}</li><li>${t('In de rugzak: klik om op te pakken en neer te leggen, rechts voor de helft of één, Shift + klik om snel te verplaatsen')}</li></ul>
    <h3>${t('Overig')}</h3><ul><li><kbd>M</kbd> ${t('de kaart (als je een kaart hebt)')}, <kbd>L</kbd> ${t('je logboek')}</li><li><kbd>Esc</kbd> ${t('menu')}, <kbd>F3</kbd> ${t('beelden per seconde')}</li></ul>`;
  const tik = `<h3>${t('Lopen en kijken')}</h3><ul><li>${t('Links op het scherm slepen: lopen (helemaal naar voren: rennen)')}</li><li>${t('Rechts slepen: rondkijken')}</li><li>${t('Spring, Sluip en (bij bouwen) Vlieg zijn knoppen rechts')}</li></ul>
    <h3>${t('Hakken en bouwen')}</h3><ul><li>${t('Tik op een blok: bouwen of gebruiken')}</li><li>${t('Houd je vinger op een blok: hakken')}</li><li>${t('In de instellingen kun je ook kiezen voor richten met het kruisje en knoppen')}</li></ul>
    <h3>${t('Rugzak')}</h3><ul><li>${t('Tik op een vak in de snelbalk om te kiezen; houd vast om weg te gooien')}</li><li>${t('In de rugzak: tik om op te pakken en tik om neer te leggen; houd vast voor de helft')}</li></ul>
    <h3>${t('Overig')}</h3><ul><li>${t('Met een kaart in je hand: tik op de kleine kaart voor de grote kaart. De kaart en je logboek staan ook in het menu.')}</li></ul>`;
  $('rb-hulp-inhoud').innerHTML = (aanraak ? tik : muis) + `<p class="rb-klein">${t('Overleven: hak een boom voor hout, maak planken, stokken en een werkbank, en dan je eerste gereedschap. Fakkels maak je van kolen en een stok.')}</p><p class="rb-klein">${t('Karretjes: zet een karretje op een spoor en gebruik het om in te stappen. Vooruit geeft een zetje, sluipen stapt uit. Een stuwspoor geeft vaart.')}</p><p class="rb-klein">${t('Dorpjes: gebruik een bewoner om te ruilen, spullen tegen spullen. Overdag werken ze, rond het middaguur kletsen ze bij de put en \'s nachts slapen ze.')}</p>`;
  openScherm('hulp');
}
// ---------------- flauwgevallen
function toonDood(reden, spullen) {
  const zinnen = { val: 'Je viel van te hoog.', water: 'Je had geen adem meer.', honger: 'Je had te lang niets gegeten.', cactus: 'Een cactus prikte te vaak.' };
  $('rb-dood-tekst').textContent = t(zinnen[reden] || 'Het werd even zwart voor je ogen.');
  $('rb-dood-spullen').textContent = spullen ? t('Je spullen liggen in je rugzak op de plek waar je viel. Een pijltje bovenaan wijst je de weg.') : t('Je had niets bij je.');
  openScherm('dood');
}
$('rb-wakker').addEventListener('click', () => { sluitAlles(); wakkerWorden(); vraagMuis(); });
// ---------------- een vraag stellen (ja/nee of een naam invullen)
function vraag(titel, tekst, opties) {
  opties = opties || {};
  return new Promise(ok => {
    $('rb-vraag-titel').textContent = titel; $('rb-vraag-tekst').textContent = tekst;
    const inv = $('rb-vraag-invoer'); inv.hidden = opties.invoer === undefined; inv.value = opties.invoer || '';
    $('rb-vraag-ja').textContent = opties.ja || t('Ja'); $('rb-vraag-nee').textContent = opties.nee || t('Annuleer');
    $('rb-vraag-ja').className = 'rb-knop ' + (opties.gevaar ? 'gevaar' : 'rood');
    const klaar = w => { $('rb-vraag-ja').onclick = $('rb-vraag-nee').onclick = null; if (huidigScherm() === 'vraag') sluitScherm(); ok(w); };
    $('rb-vraag-ja').onclick = () => klaar(opties.invoer !== undefined ? inv.value.trim() : true);
    $('rb-vraag-nee').onclick = () => klaar(opties.invoer !== undefined ? null : false);
    inv.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); klaar(inv.value.trim()); } };
    openScherm('vraag');
    if (!inv.hidden) setTimeout(() => { inv.focus(); inv.select(); }, 40);
  });
}
// klik op het spel als de muis niet vast zit: verder spelen
doek.addEventListener('click', () => { if (spelBezig && !schermOpen() && !muisVast && !aanraak) vraagMuis(); });
function naTaal() { if (WD) tekenBalk(); if (huidigScherm() === 'inst') openInstellingen(); if (typeof toonWerelden === 'function' && huidigScherm() === 'begin') toonWerelden(); }

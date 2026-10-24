// ============================================================================
// Rugzak, maken (2 x 2 en 3 x 3 aan een werkbank), receptenboek, oven, kist en (bij bouwen) alle blokken
// ============================================================================
const RZ = { modus: 'rugzak', raster: [null, null, null, null], maat: 2, plek: null, vast: null, tab: 'alles', zoek: '', gekozen: null, paletTab: 'alles', smidse: { gereed: null, stof: null }, deel: 'rugzak', keuze: null, zoekRz: '' };
const sleutelPlek = (x, y, z) => x + ',' + y + ',' + z;
function ding(x, y, z, soort) {
  const k = sleutelPlek(x, y, z); let d = WD.dingen[k];
  if (!d || d.soort !== soort) { d = soort === 'kist' ? { soort, inhoud: new Array(27).fill(null) } : { soort, in: null, brand: null, uit: null, brandTijd: 0, brandMax: 0, kook: 0 }; WD.dingen[k] = d; }
  return d;
}
// een oude kist (in een ruïne of een mijn) vult zich de eerste keer met buit: vast per wereld en plek (zie shared/spullen.js)
const buitInhoud = (x, y, z, v, zaad) => G.SPULLEN.buitInhoud(x, y, z, v, zaad);
function buitVullen(x, y, z, v) {
  const k = sleutelPlek(x, y, z); if (WD.dingen[k]) return;
  actieGevolg(['v', x, y, z, v]);
  WD.dingen[k] = { soort: 'kist', inhoud: buitInhoud(x, y, z, v, WD.zaad) };
}
// ---------------- openen
// RZ.deel: welk tabblad open is ('rugzak', 'maken' of 'recepten'). Op een breed scherm staat 'maken' altijd naast je rugzak.
const smal = () => matchMedia('(max-width: 640px)').matches;
function openRugzak(modus, plek) {
  if (!WD || !wereldKlaar) return;
  // in de bouwstand een eigen scherm met alles onbeperkt (ook bij een werkbank: maken is daar niet nodig)
  if (wereldStand() === 'bouwen' && (!modus || modus === 'rugzak' || modus === 'werkbank')) { openBouwmenu(); return; }
  if (huidigScherm() === 'rugzak') { sluitScherm(); return; }
  RZ.modus = modus || 'rugzak'; RZ.plek = plek || null;
  if (RZ.modus === 'rugzak') klank('rugzak');
  RZ.maat = RZ.modus === 'werkbank' ? 3 : 2;
  RZ.raster = new Array(RZ.maat * RZ.maat).fill(null);
  RZ.gekozen = null; RZ.keuze = null; RZ.zoekRz = '';
  // op een telefoon: bij een werkbank, oven, kist of smidse meteen dat tabblad, anders je rugzak
  RZ.deel = RZ.modus === 'rugzak' ? 'rugzak' : 'maken';
  $('rb-rugzak-titel').textContent = { rugzak: t('Rugzak'), werkbank: t('Werkbank'), oven: t('Oven'), kist: t('Kist'), smidse: t('Smidse') }[RZ.modus];
  bouwRugzak();
  openScherm('rugzak');
  bakBegin(RZ.modus, RZ.plek);
  if (RZ.modus === 'kist') klank('kist', true);
}
function openBlok(soort, d) {
  if (soort === 'werkbank') { openRugzak('werkbank'); zwaai(); return true; }
  if (soort === 'kist' && (d.v & 255) === B.buitkist) {
    // een oude kist: de buit erin, en daarna is het een gewone kist
    buitVullen(d.x, d.y, d.z, d.v); zetBlok(d.x, d.y, d.z, B.kist | (((d.v >> 8) & 3) << 8)); stuurZetten();
    if (typeof logboek === 'function') logboek('buit');
  }
  // bij samen spelen staat de inhoud op de server, en kan maar één speler tegelijk erin
  if ((soort === 'oven' || soort === 'kist') && samen && WD.samen) { samenOpenDing(d, soort); zwaai(); return true; }
  if (soort === 'oven' || soort === 'kist') { ding(d.x, d.y, d.z, soort); openRugzak(soort, [d.x, d.y, d.z]); zwaai(); return true; }
  if (soort === 'bed') { slapen(d); return true; }
  if (soort === 'smidse') { openRugzak('smidse', [d.x, d.y, d.z]); zwaai(); klank('kist', true); return true; }
  if (soort === 'taart') {
    if (wereldStand() !== 'bouwen' && WD.speler.honger >= 20) { melding(t('Je hebt geen honger.'), true); return true; }
    const hap = (d.v >> 8) & 3, s = WD.speler; s.honger = Math.min(20, s.honger + 4); s.verzadiging = Math.min(s.honger, (s.verzadiging || 0) + 2);
    zetBlok(d.x, d.y, d.z, hap >= 3 ? 0 : ((d.v & 255) | ((hap + 1) << 8))); stuurZetten(); klank('eet'); zwaai(); if (typeof logboek === 'function') logboek('eten'); return true;
  }
  return false;
}
function naRugzakDicht() {
  bakVergelijk(); bak = null;
  if (samen && WD.samen && (RZ.modus === 'kist' || RZ.modus === 'oven')) samenStuur({ t: 'dicht' });
  // wat nog in het raster of aan de muis hangt, gaat terug in de rugzak (of valt)
  for (let i = 0; i < RZ.raster.length; i++) { const s = RZ.raster[i]; if (s) geefOfLaatVallen(s.id, s.n, s.dur); RZ.raster[i] = null; }
  if (RZ.vast) { geefOfLaatVallen(RZ.vast.id, RZ.vast.n, RZ.vast.dur); RZ.vast = null; }
  for (const k of ['gereed', 'stof']) { const s = RZ.smidse[k]; if (s) geefOfLaatVallen(s.id, s.n, s.dur); RZ.smidse[k] = null; }
  $('rb-vast').style.display = 'none'; RZ.keuze = null; verbergTip();
  if (RZ.modus === 'kist') klank('kist', false);
  rugzakVeranderd();
}
// ---------------- bouwen van het scherm
function vak(plek, s, extraKlasse) {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'rb-vak' + (extraKlasse ? ' ' + extraKlasse : ''); b.dataset.plek = plek;
  b.innerHTML = vakHtml(s); b.setAttribute('aria-label', s ? naam(s.id) + (s.n > 1 ? ' (' + s.n + ')' : '') : t('Leeg vak'));
  return b;
}
function el(tag, cls, tekst) { const e = document.createElement(tag); if (cls) e.className = cls; if (tekst) e.textContent = tekst; return e; }
const PIJL = '<svg width="26" height="20" viewBox="0 0 26 20" aria-hidden="true"><path d="M2 10h18M14 3l7 7-7 7" fill="none" stroke="#8FD3FF" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const BOEK = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8FD3FF" stroke-width="2" aria-hidden="true"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/></svg>';
const sectie = tekst => el('p', 'rb-sectie', tekst);
function bouwRugzak() {
  const P = $('rb-rugzak-paneel'), IN = $('rb-rugzak-inhoud'); IN.innerHTML = '';
  const bouwen = wereldStand() === 'bouwen', boek = RZ.modus === 'rugzak' || RZ.modus === 'werkbank';
  // kist en oven: onder elkaar (de kist is net zo breed als je rugzak); anders naast elkaar
  P.classList.toggle('stapel', RZ.modus === 'kist');
  // ---- de tabbladen
  const tabs = $('rb-rz-tabs'); tabs.innerHTML = '';
  const makenNaam = { rugzak: t('Maken'), werkbank: t('Maken'), oven: t('Oven'), kist: t('Kist'), smidse: t('Smidse') }[RZ.modus];
  const lijst = [['rugzak', t('Rugzak')], ['maken', makenNaam]];
  if (boek || bouwen) lijst.push(['recepten', bouwen ? t('Alle blokken') : t('Receptenboek')]);
  for (const [k, n] of lijst) {
    const b = el('button', k === 'maken' ? 'alleen-smal' : '', n); b.type = 'button'; b.setAttribute('role', 'tab'); b.dataset.deel = k;
    b.onclick = () => { zetDeel(k); klank('klik'); };
    tabs.appendChild(b);
  }
  // ---- maken, of de oven, kist of smidse
  const M = el('section', 'rz-deel'); M.dataset.deel = 'maken';
  if (RZ.modus === 'oven') {
    const d = ding(...RZ.plek, 'oven');
    M.appendChild(sectie(t('Oven')));
    const vl = el('div', 'rb-vlakje'), o = el('div', 'rb-oven');
    o.appendChild(vak('oven:in', d.in)); const pb = el('div', 'rb-pijlbalk'); pb.innerHTML = '<i id="rb-oven-pijl"></i>'; o.appendChild(pb); o.appendChild(vak('oven:uit', d.uit, 'rb-uitvak'));
    const vuur = el('div', 'rb-vuur'); vuur.innerHTML = '<i id="rb-oven-vuur"></i>'; o.appendChild(vuur); o.appendChild(vak('oven:brand', d.brand)); o.appendChild(el('div', ''));
    vl.appendChild(o); M.appendChild(vl);
    M.insertAdjacentHTML('beforeend', `<p class="rb-klein">${t('Boven: wat je wilt smelten of bakken. Onder: brandstof, zoals kolen of hout.')}</p>`);
  } else if (RZ.modus === 'kist') {
    const d = ding(...RZ.plek, 'kist');
    M.appendChild(sectie(t('Kist · 27 vakken')));
    const r = el('div', 'rb-raster r9'); d.inhoud.forEach((s, i) => r.appendChild(vak('kist:' + i, s))); M.appendChild(r);
  } else if (RZ.modus === 'smidse') {
    M.appendChild(sectie(t('Smidse')));
    const vl = el('div', 'rb-vlakje'), m = el('div', 'rb-maken rb-smidse');
    m.appendChild(vak('smidse:gereed', RZ.smidse.gereed)); m.appendChild(el('span', 'rb-plus', '+')); m.appendChild(vak('smidse:stof', RZ.smidse.stof));
    const pl = el('span', 'rb-pijl'); pl.innerHTML = PIJL; m.appendChild(pl);
    const u = smidseUitkomst(); m.appendChild(vak('smidse:uit', u ? u.uit : null, 'rb-uitvak' + (u ? ' kan' : '')));
    vl.appendChild(m); M.appendChild(vl);
    const info = el('p', 'rb-klein'); info.id = 'rb-smidse-info'; info.innerHTML = smidseTekst(); M.appendChild(info);
  } else if (!bouwen) {
    M.appendChild(sectie(RZ.modus === 'werkbank' ? t('Maken · 3 x 3') : t('Maken · 2 x 2')));
    const vl = el('div', 'rb-vlakje'), m = el('div', 'rb-maken');
    const r = el('div', 'rb-raster'); r.style.gridTemplateColumns = `repeat(${RZ.maat}, var(--vm))`;
    RZ.raster.forEach((s, i) => r.appendChild(vak('raster:' + i, s)));
    m.appendChild(r); const pl = el('span', 'rb-pijl'); pl.innerHTML = PIJL; m.appendChild(pl);
    const rec = huidigRecept();
    m.appendChild(vak('uit', rec ? { id: rec.uit, n: rec.aantal } : null, 'rb-uitvak' + (rec ? ' kan' : '')));
    vl.appendChild(m); M.appendChild(vl);
    const uitleg = el('p', 'rb-klein'); uitleg.id = 'rb-maak-uitleg'; M.appendChild(uitleg);
    const kk = el('button', 'rb-knop rb-kanknop'); kk.type = 'button'; kk.id = 'rb-kanknop';
    kk.onclick = () => { RZ.tab = 'kan'; zetDeel('recepten'); };
    M.appendChild(kk);
  }
  IN.appendChild(M);
  // ---- de rugzak en de snelbalk
  const Z = el('section', 'rz-deel'); Z.dataset.deel = 'rugzak';
  Z.appendChild(sectie(t('Rugzak · 27 vakken')));
  const r = el('div', 'rb-raster r9'); for (let i = 9; i < 36; i++) r.appendChild(vak('inv:' + i, WD.inv[i]));
  Z.appendChild(r);
  Z.appendChild(sectie(t('Snelbalk')));
  const b = el('div', 'rb-raster r9 balk'); for (let i = 0; i < 9; i++) b.appendChild(vak('inv:' + i, WD.inv[i], i === WD.kies ? 'gekozen' : ''));
  Z.appendChild(b);
  const vh = el('div', 'rb-vasthouder'); vh.id = 'rb-vasthouder'; Z.appendChild(vh);
  if (bouwen) { const w = vak('weg', null, 'rb-weg'); w.setAttribute('aria-label', t('Weggooien')); vh.prepend(w); }
  IN.appendChild(Z);
  // ---- het receptenboek (of in de bouwstand: alle blokken)
  if (boek || bouwen) {
    const Rt = el('section', 'rz-deel'); Rt.dataset.deel = 'recepten';
    if (bouwen) bouwPalet(Rt); else bouwRecepten(Rt);
    IN.appendChild(Rt);
  }
  // ---- onderaan: hoe het werkt
  $('rb-rz-voet').innerHTML = aanraak ? `<span>${t('Tik op iets om het te kiezen. Tik daarna op een ander vak om het te verplaatsen. Houd vast en sleep om te verdelen.')}</span>`
    : `<span><b>${t('Klik')}</b> ${t('oppakken en neerleggen')}</span><span><b>${t('Shift-klik')}</b> ${t('snel verplaatsen')}</span><span><b>${t('Rechtsklik')}</b> ${t('halveren')}</span><span><b>${t('Slepen')}</b> ${t('verdelen')}</span><span><b>Q</b> ${t('weggooien')}</span>`;
  zetDeel(RZ.deel, true);
  toonVast(); toonKeuze(); maakUitleg();
}
// welk tabblad open is; de zoekbalk zoekt in je rugzak of in de recepten
function zetDeel(k, stil) {
  const P = $('rb-rugzak-paneel'); if (!P.querySelector('.rz-deel[data-deel="' + k + '"]')) k = 'rugzak';
  RZ.deel = k; P.dataset.tab = k;
  for (const b of $('rb-rz-tabs').children) {
    // op een breed scherm staat 'maken' naast de rugzak: dan is het tabblad Rugzak gekozen
    const aan = b.dataset.deel === k || (!smal() && k === 'maken' && b.dataset.deel === 'rugzak');
    b.setAttribute('aria-selected', String(aan));
  }
  const z = $('rb-rz-zoek'), recept = k === 'recepten';
  z.placeholder = recept ? (wereldStand() === 'bouwen' ? t('Zoek een blok') : t('Zoek een recept')) : t('Zoek in je rugzak');
  z.value = recept ? RZ.zoek : RZ.zoekRz;
  if (!stil) { if (recept && typeof tekenRecepten === 'function') tekenRecepten(); zoekRugzak(); }
  verbergTip(); toonKeuze();
}
$('rb-rz-zoek').addEventListener('input', e => {
  if (RZ.deel === 'recepten') { RZ.zoek = e.target.value; if (wereldStand() === 'bouwen') { if (RZ.vulPalet) RZ.vulPalet(); } else tekenRecepten(); }
  else { RZ.zoekRz = e.target.value; zoekRugzak(); }
});
// zoeken in je rugzak: wat niet past, wordt vaag
function zoekRugzak() {
  const zk = (RZ.zoekRz || '').trim().toLowerCase();
  for (const v of document.querySelectorAll('#rb-rugzak-inhoud .rz-deel:not([data-deel="recepten"]) .rb-vak')) {
    const s = v.dataset.plek ? haalPlek(v.dataset.plek) : null;
    v.classList.toggle('dof', !!zk && (!s || !naam(s.id).toLowerCase().includes(zk)));
  }
}
// de regel onder het maken: wat er nu gemaakt wordt, en hoeveel recepten je nu kunt maken
function maakUitleg() {
  const u = $('rb-maak-uitleg'), kk = $('rb-kanknop'); if (!u) return;
  const rec = huidigRecept();
  u.textContent = rec ? t('{0}: klik op het resultaat om het te maken, Shift-klik om er zoveel mogelijk te maken.', naam(rec.uit)) : t('Leg spullen in het raster. Past het bij een recept, dan zie je rechts wat je maakt.');
  if (aanraak && rec) u.textContent = t('{0}: tik op het resultaat om het te maken.', naam(rec.uit));
  if (kk) { const n = aantalKan(); kk.innerHTML = BOEK + ' ' + (n === 1 ? t('1 ding kun je nu maken') : t('{0} dingen kun je nu maken', n)); }
}
function aantalKan() { const m = voorraad(), wb = RZ.modus === 'werkbank'; let n = 0; for (const r of G.REC) if ((wb || !heeftWerkbankNodig(r)) && kanMaken(r, m)) n++; return n; }
function rugzakOpnieuw() {
  if (huidigScherm() !== 'rugzak') return;
  // snel bijwerken: vakken die er al zijn opnieuw vullen
  for (const v of document.querySelectorAll('#rb-rugzak-inhoud .rz-deel:not([data-deel="recepten"]) .rb-vak')) {
    if (!v.dataset.plek) continue;
    const s = haalPlek(v.dataset.plek), h = vakHtml(s);
    if (v.dataset.h !== h) { v.innerHTML = h; v.dataset.h = h; v.setAttribute('aria-label', s ? naam(s.id) + (s.n > 1 ? ' (' + s.n + ')' : '') : t('Leeg vak')); }
    if (v.dataset.plek === 'uit') v.classList.toggle('kan', !!s);
    if (v.dataset.plek.startsWith('inv:')) v.classList.toggle('gekozen', +v.dataset.plek.slice(4) === WD.kies && +v.dataset.plek.slice(4) < 9);
    v.classList.toggle('keuze', RZ.keuze === v.dataset.plek);
  }
  if (RZ.keuze && !haalPlek(RZ.keuze)) RZ.keuze = null;
  if (RZ.boekKlok !== kanTeller) { RZ.boekKlok = kanTeller; const rb = $('rb-receptlijst'); if (rb) tekenRecepten(); maakUitleg(); }
  if (RZ.modus === 'smidse') { const i = $('rb-smidse-info'); if (i) i.innerHTML = smidseTekst(); const u = document.querySelector('#rb-rugzak-inhoud [data-plek="smidse:uit"]'); if (u) u.classList.toggle('kan', !!smidseUitkomst()); }
  zoekRugzak(); toonVast(); toonKeuze();
}
// ---------------- plekken lezen en schrijven
function haalPlek(p) {
  const [a, b] = p.split(':'), i = +b;
  if (a === 'inv') return WD.inv[i];
  if (a === 'raster') return RZ.raster[i];
  if (a === 'uit') { const r = huidigRecept(); return r ? { id: r.uit, n: r.aantal } : null; }
  if (a === 'kist') return ding(...RZ.plek, 'kist').inhoud[i];
  if (a === 'oven') return ding(...RZ.plek, 'oven')[b];
  if (a === 'smidse') { if (b === 'uit') { const u = smidseUitkomst(); return u ? u.uit : null; } return RZ.smidse[b]; }
  return null;
}
function zetPlek(p, s) {
  const [a, b] = p.split(':'), i = +b;
  if (s && s.n <= 0) s = null;
  if (a === 'inv') WD.inv[i] = s; else if (a === 'raster') RZ.raster[i] = s; else if (a === 'kist') ding(...RZ.plek, 'kist').inhoud[i] = s; else if (a === 'oven') ding(...RZ.plek, 'oven')[b] = s; else if (a === 'smidse' && b !== 'uit') RZ.smidse[b] = s;
}
const magIn = (p, s) => { if (!s) return true; if (p === 'oven:brand') return !!IT[s.id].brand; if (p === 'oven:uit' || p === 'uit' || p === 'smidse:uit') return false; if (p === 'smidse:gereed') return !!IT[s.id].duur; return true; };
function huidigRecept() { const ids = RZ.raster.map(s => (s ? s.id : 0)); return G.zoekRecept(ids, RZ.maat); }
// ---------------- klikken op een vak (muis), en het neerleggen bij kiezen-en-tikken en slepen
function klikVak(p, soort, shift) {
  // soort: 'links' (alles), 'rechts' (helft oppakken of één neerleggen)
  if (p === 'weg') { if (RZ.vast) { RZ.vast = null; klank('klik'); } else if (RZ.keuze) { zetPlek(RZ.keuze, null); RZ.keuze = null; klank('klik'); } rugzakVeranderd(); return; }
  if (p.startsWith('palet:')) { paletKlik(+p.slice(6), soort, shift); return; }
  if (p === 'uit') { pakResultaat(shift); return; }
  if (p === 'smidse:uit') { smidsePak(shift); return; }
  if (p === 'oven:uit') { const d = ding(...RZ.plek, 'oven'); if (!d.uit) return; if (shift) { const r = geef(d.uit.id, d.uit.n); d.uit = r ? { id: d.uit.id, n: r } : null; } else if (!RZ.vast || (RZ.vast.id === d.uit.id && RZ.vast.n + d.uit.n <= stapelVan(d.uit.id))) { if (RZ.vast) RZ.vast.n += d.uit.n; else RZ.vast = d.uit; d.uit = null; } rugzakVeranderd(); return; }
  if (shift) { snelVerplaats(p); return; }
  const s = haalPlek(p), v = RZ.vast;
  if (soort === 'links') {
    if (!v) { if (s) { RZ.vast = s; zetPlek(p, null); } }
    else if (!s) { if (magIn(p, v)) { zetPlek(p, v); RZ.vast = null; } }
    else if (s.id === v.id && stapelVan(s.id) > 1) { const m = Math.min(v.n, stapelVan(s.id) - s.n); s.n += m; v.n -= m; if (!v.n) RZ.vast = null; }
    else if (magIn(p, v)) { zetPlek(p, v); RZ.vast = s; }
  } else {
    if (!v) { if (s) { const h = Math.ceil(s.n / 2); RZ.vast = Object.assign({}, s, { n: h }); s.n -= h; if (!s.n) zetPlek(p, null); } }
    else if (magIn(p, v) && (!s || (s.id === v.id && s.n < stapelVan(s.id)))) { if (!s) zetPlek(p, Object.assign({}, v, { n: 1 })); else s.n++; v.n--; if (!v.n) RZ.vast = null; }
  }
  klank('klik'); rugzakVeranderd();
}
// de doelen bij snel verplaatsen: van de rugzak naar de kist of oven (of tussen snelbalk en rugzak), en terug
function snelDoelen(p, s) {
  const [a, b] = p.split(':'), i = +b;
  if (a === 'inv') {
    if (RZ.modus === 'kist') return Array.from({ length: 27 }, (_, k) => 'kist:' + k);
    if (RZ.modus === 'oven') return [IT[s.id].brand && !G.ovenRecept(s.id) ? 'oven:brand' : 'oven:in'];
    if (RZ.modus === 'smidse') return [IT[s.id].duur ? 'smidse:gereed' : 'smidse:stof'];
    return i < 9 ? Array.from({ length: 27 }, (_, k) => 'inv:' + (k + 9)) : Array.from({ length: 9 }, (_, k) => 'inv:' + k);
  }
  return Array.from({ length: 36 }, (_, k) => 'inv:' + ((k + 9) % 36));
}
function snelNaam(p) {
  const [a, b] = p.split(':');
  if (a !== 'inv') return t('Naar je rugzak');
  return { kist: t('Naar de kist'), oven: t('Naar de oven'), smidse: t('Naar de smidse') }[RZ.modus] || (+b < 9 ? t('Naar je rugzak') : t('Naar snelbalk'));
}
function snelVerplaats(p) {
  const s = haalPlek(p); if (!s) return;
  const doelen = snelDoelen(p, s);
  let n = s.n;
  for (const d of doelen) { const t2 = haalPlek(d); if (t2 && t2.id === s.id && t2.n < stapelVan(s.id)) { const m = Math.min(n, stapelVan(s.id) - t2.n); t2.n += m; n -= m; if (!n) break; } }
  for (const d of doelen) { if (!n) break; if (!haalPlek(d) && magIn(d, s)) { zetPlek(d, Object.assign({}, s, { n })); n = 0; } }
  if (n) s.n = n; else zetPlek(p, null);
  klank('klik'); rugzakVeranderd();
}
// van het ene vak naar het andere (kiezen en tikken): samenvoegen, neerleggen of omwisselen
function verplaats(van, naar) {
  if (van === naar) return;
  const s = haalPlek(van), d = haalPlek(naar); if (!s || !magIn(naar, s)) return;
  if (!d) { zetPlek(naar, s); zetPlek(van, null); }
  else if (d.id === s.id && stapelVan(s.id) > 1) { const m = Math.min(s.n, stapelVan(s.id) - d.n); d.n += m; s.n -= m; if (!s.n) zetPlek(van, null); }
  else if (magIn(van, d)) { zetPlek(naar, s); zetPlek(van, d); }
  klank('klik'); rugzakVeranderd();
}
// de helft van een stapel in het eerste lege vak ernaast
function halveer(p) {
  const s = haalPlek(p); if (!s || s.n < 2) return false;
  const [a] = p.split(':'), n = a === 'kist' ? 27 : 36, h = Math.floor(s.n / 2);
  for (let k = 0; k < n; k++) { const q = a === 'kist' ? 'kist:' + k : 'inv:' + ((k + 9) % 36); if (!haalPlek(q)) { zetPlek(q, Object.assign({}, s, { n: h })); s.n -= h; klank('klik'); rugzakVeranderd(); return true; } }
  melding(t('Er is geen leeg vak meer.'), true); return false;
}
// weggooien vanuit de rugzak: het valt voor je neer (in de bouwstand is het gewoon weg)
function gooiUit(p, alles) {
  const s = haalPlek(p); if (!s) return;
  const n = alles ? s.n : 1;
  if (wereldStand() !== 'bouwen') gooi(s, n);
  s.n -= n; if (s.n <= 0) zetPlek(p, null);
  klank('klik'); rugzakVeranderd();
}
// slepen over meerdere vakken: de stapel in je hand eerlijk verdelen (rechts: één per vak)
function verdeel(vakken, eenPer) {
  const v = RZ.vast; if (!v || !vakken.length) return;
  const per = eenPer ? 1 : Math.max(1, Math.floor(v.n / vakken.length));
  for (const p of vakken) {
    if (!v.n) break;
    const s = haalPlek(p), m = Math.min(per, v.n);
    if (!s) { zetPlek(p, Object.assign({}, v, { n: m })); v.n -= m; }
    else if (s.id === v.id) { const k = Math.min(m, stapelVan(s.id) - s.n); s.n += k; v.n -= k; }
  }
  if (!v.n) RZ.vast = null;
  klank('klik'); rugzakVeranderd();
}
const kanVerdelen = (p, v) => { if (!v || !p || /^(uit|weg|palet:|oven:uit|smidse:uit)/.test(p) || !magIn(p, v)) return false; const s = haalPlek(p); return !s || (s.id === v.id && s.n < stapelVan(s.id)); };
function pakResultaat(alles) {
  let keer = 0;
  do {
    const r = huidigRecept(); if (!r) break;
    if (alles) { const rest = geef(r.uit, r.aantal); if (rest) { laatVallen(sp.x, sp.y + 1, sp.z, r.uit, rest); } }
    else { if (RZ.vast && (RZ.vast.id !== r.uit || RZ.vast.n + r.aantal > stapelVan(r.uit))) break; if (RZ.vast) RZ.vast.n += r.aantal; else { RZ.vast = { id: r.uit, n: r.aantal }; if (IT[r.uit].duur) RZ.vast.dur = IT[r.uit].duur; } }
    for (let i = 0; i < RZ.raster.length; i++) { const s = RZ.raster[i]; if (s) { s.n--; if (!s.n) RZ.raster[i] = null; } }
    keer++;
  } while (alles && keer < 64);
  if (keer) { klank('nieuw'); rugzakVeranderd(); maakUitleg(); }
}
// ---------------- het receptenboek
const GROEPEN = [['alles', 'Alles'], ['kan', 'Wat kan ik maken?'], ['basis', 'Basis'], ['gereedschap', 'Gereedschap'], ['bouwen', 'Bouwen'], ['licht', 'Licht'], ['handig', 'Handig'], ['eten', 'Eten'], ['kleur', 'Kleur']];
const heeftWerkbankNodig = r => (r.los ? r.los.length > 4 : r.w > 2 || r.h > 2);
// wat is er nodig: lijst van [sleutel (id of tag), aantal]
function benodigd(r) {
  const tel = new Map();
  if (r.los) for (const s of r.los) tel.set(s, (tel.get(s) || 0) + 1);
  else for (const rij of r.patroon) for (const c of rij) if (c !== ' ') { const s = r.sleutels[c]; tel.set(s, (tel.get(s) || 0) + 1); }
  return [...tel];
}
function voorraad() { const m = new Map(); for (const s of WD.inv) if (s) m.set(s.id, (m.get(s.id) || 0) + s.n); for (const s of RZ.raster) if (s) m.set(s.id, (m.get(s.id) || 0) + s.n); return m; }
function kiesVoor(sleutel, m, n) {
  // welk voorwerp gebruik je voor deze sleutel (bij een groep: waar je het meest van hebt)
  if (typeof sleutel === 'string' && sleutel[0] === '#') { let best = null, bn = 0; for (const id of G.TAG[sleutel]) { const c = m.get(id) || 0; if (c > bn) { bn = c; best = id; } } return bn >= n ? best : null; }
  return (m.get(sleutel) || 0) >= n ? sleutel : null;
}
function kanMaken(r, m) {
  m = m || voorraad();
  const over = new Map(m);
  for (const [s, n] of benodigd(r)) { const id = kiesVoor(s, over, n); if (id == null) return false; over.set(id, over.get(id) - n); }
  return true;
}
function bouwRecepten(Rt) {
  Rt.appendChild(sectie(t('Receptenboek')));
  const tabs = el('div', 'rb-chips rb-tabs'); tabs.setAttribute('role', 'group'); tabs.setAttribute('aria-label', t('Groepen'));
  for (const [k, n] of GROEPEN) { const b = el('button', 'rb-chip', t(n)); b.type = 'button'; b.dataset.groep = k; b.setAttribute('aria-pressed', String(RZ.tab === k)); b.onclick = () => { RZ.tab = k; for (const x of tabs.children) x.setAttribute('aria-pressed', String(x === b)); tekenRecepten(); }; tabs.appendChild(b); }
  Rt.appendChild(tabs);
  const lijst = el('div', 'rb-recepten'); lijst.id = 'rb-receptlijst'; Rt.appendChild(lijst);
  const info = el('div', 'rb-recept-info'); info.id = 'rb-receptinfo'; info.setAttribute('aria-live', 'polite'); Rt.appendChild(info);
  tekenRecepten();
}
function tekenRecepten() {
  const lijst = $('rb-receptlijst'); if (!lijst) return;
  for (const x of document.querySelectorAll('#rb-rugzak .rb-chip[data-groep]')) x.setAttribute('aria-pressed', String(x.dataset.groep === RZ.tab));
  const m = voorraad(), werkbank = RZ.modus === 'werkbank', zoek = RZ.zoek.trim().toLowerCase();
  lijst.innerHTML = '';
  G.REC.forEach((r, i) => {
    if (RZ.tab !== 'alles' && RZ.tab !== 'kan' && r.groep !== RZ.tab) return;
    const kan = kanMaken(r, m) && (werkbank || !heeftWerkbankNodig(r));
    if (RZ.tab === 'kan' && !kan) return;
    if (zoek && !naam(r.uit).toLowerCase().includes(zoek) && !(IT[r.uit].nl.toLowerCase().includes(zoek))) return;
    const b = el('button', 'rb-recept' + (kan ? ' kan' : '') + (heeftWerkbankNodig(r) ? ' werkbank' : '') + (RZ.gekozen === i ? ' gekozen' : '')); b.type = 'button';
    b.innerHTML = `<img src="${icoon(r.uit)}" alt="">${r.aantal > 1 ? `<b>${r.aantal}</b>` : ''}`;
    b.setAttribute('aria-label', naam(r.uit) + (kan ? '' : ' — ' + t('nog niet')));
    b.dataset.recept = i;
    b.onclick = () => { RZ.gekozen = i; for (const x of lijst.children) x.classList.toggle('gekozen', x === b); toonRecept(); };
    lijst.appendChild(b);
  });
  if (!lijst.children.length) lijst.innerHTML = `<p class="rb-klein">${RZ.tab === 'kan' ? t('Je kunt nu nog niets maken. Verzamel eerst wat hout!') : t('Niets gevonden.')}</p>`;
  toonRecept();
}
function toonRecept() {
  const info = $('rb-receptinfo'); if (!info) return;
  const r = RZ.gekozen != null ? G.REC[RZ.gekozen] : null;
  if (!r) { info.innerHTML = `<span class="rb-klein">${t('Kies een recept om te zien wat je nodig hebt.')}${RZ.modus !== 'werkbank' ? ' ' + t('Recepten met een bruin vierkantje maak je aan een werkbank.') : ''}</span>`; return; }
  const m = voorraad(), werkbank = RZ.modus === 'werkbank';
  let h = `<b>${naam(r.uit)}${r.aantal > 1 ? ' × ' + r.aantal : ''}</b><br>`;
  for (const [s, n] of benodigd(r)) {
    const id = kiesVoor(s, m, n), toonId = id != null ? id : (typeof s === 'string' ? G.TAG[s][0] : s);
    const nm = typeof s === 'string' ? ({ '#planken': t('planken (elke soort)'), '#stam': t('boomstam (elke soort)'), '#kolen': t('kolen of houtskool'), '#linnen': t('linnen (elke kleur)') })[s] : naam(s);
    h += `<span class="ing${id == null ? ' mist' : ''}"><img src="${icoon(toonId)}" alt="">${n} × ${nm}</span>`;
  }
  const kan = kanMaken(r, m), wb = heeftWerkbankNodig(r) && !werkbank;
  h += `<div class="rb-knoppen" style="margin-top:.45rem">`;
  if (wb) h += `<span class="rb-klein">${t('Hiervoor heb je een werkbank nodig.')}</span>`;
  else if (kan) h += `<button type="button" class="rb-knop klein" id="rb-legklaar">${t('Leg klaar')}</button><button type="button" class="rb-knop klein rood" id="rb-maak1">${t('Maak')}</button><button type="button" class="rb-knop klein" id="rb-maakalles">${t('Maak alles')}</button>`;
  else h += `<span class="rb-klein">${t('Je hebt nog niet alles.')}</span>`;
  h += '</div>';
  info.innerHTML = h;
  if ($('rb-legklaar')) $('rb-legklaar').onclick = () => { legKlaar(r); zetDeel('maken'); };
  if ($('rb-maak1')) $('rb-maak1').onclick = () => maakDirect(r, 1);
  if ($('rb-maakalles')) $('rb-maakalles').onclick = () => maakDirect(r, 64);
}
function legKlaar(r) {
  for (let i = 0; i < RZ.raster.length; i++) { const s = RZ.raster[i]; if (s) { const rest = geef(s.id, s.n, s.dur); RZ.raster[i] = rest ? Object.assign({}, s, { n: rest }) : null; } }
  const m = voorraad(), plaats = (i, sleutel) => { const id = kiesVoor(sleutel, m, 1); if (id == null) return; neem(id, 1); m.set(id, m.get(id) - 1); RZ.raster[i] = { id, n: 1 }; };
  if (r.los) r.los.forEach((s, i) => plaats(i, s));
  else for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) { const c = r.patroon[y][x]; if (c !== ' ') plaats(y * RZ.maat + x, r.sleutels[c]); }
  klank('klik'); rugzakVeranderd(); bouwRugzak();
}
function maakDirect(r, keer) {
  let n = 0;
  while (n < keer && kanMaken(r, (() => { const m = new Map(); for (const s of WD.inv) if (s) m.set(s.id, (m.get(s.id) || 0) + s.n); return m; })())) {
    const m = new Map(); for (const s of WD.inv) if (s) m.set(s.id, (m.get(s.id) || 0) + s.n);
    for (const [s, k] of benodigd(r)) { const id = kiesVoor(s, m, k); neem(id, k); m.set(id, m.get(id) - k); }
    const rest = geef(r.uit, r.aantal); if (rest) laatVallen(sp.x, sp.y + 1, sp.z, r.uit, rest);
    n++;
  }
  if (n) { klank('nieuw'); melding(t('Gemaakt:') + ' ' + naam(r.uit) + (n * r.aantal > 1 ? ' × ' + n * r.aantal : ''), true); }
  rugzakVeranderd(); toonRecept();
}
// ---------------- alle blokken (bouwstand, bij een kist of oven)
const PALETGROEPEN = [['alles', 'Alles'], ['bouw', 'Bouwblokken'], ['natuur', 'Natuur'], ['planten', 'Planten'], ['licht', 'Licht'], ['dingen', 'Gereedschap en dingen']];
function paletGroep(id) {
  const it = IT[id]; if (!it.blok) return 'dingen';
  const b = BL[it.blok];
  if (b.licht || b.sleutel === 'lichtblok') return 'licht';
  if (b.vorm === 'kruis' || b.vorm === 'lelie' || b.vorm === 'cactus' || b.sleutel.startsWith('blad')) return 'planten';
  if (['gras', 'aarde', 'steen', 'kei', 'zand', 'grind', 'klei', 'sneeuw', 'ijs', 'modder', 'bosgrond', 'leisteen', 'kalksteen', 'sneeuwgras', 'zandsteen'].includes(b.sleutel) || b.sleutel.startsWith('erts') || b.sleutel.startsWith('stam')) return 'natuur';
  return 'bouw';
}
function bouwPalet(Rt) {
  Rt.appendChild(sectie(t('Alle blokken en dingen')));
  Rt.insertAdjacentHTML('beforeend', `<p class="rb-klein">${t('Tik of klik om in het gekozen vak van je snelbalk te zetten. Sleep naar een vak, of naar de prullenbak om weg te gooien.')}</p>`);
  const tabs = el('div', 'rb-chips rb-tabs');
  for (const [k, n] of PALETGROEPEN) { const b = el('button', 'rb-chip', t(n)); b.type = 'button'; b.setAttribute('aria-pressed', String(RZ.paletTab === k)); b.onclick = () => { RZ.paletTab = k; for (const x of tabs.children) x.setAttribute('aria-pressed', String(x === b)); vul(); }; tabs.appendChild(b); }
  Rt.appendChild(tabs);
  const p = el('div', 'rb-recepten rb-palet'); Rt.appendChild(p);
  const ids = IT.map((it, id) => (it ? id : -1)).filter(id => id > 0 && id !== I.rugzak && !IT[id].nietInMenu);
  const vul = () => {
    const zk = RZ.zoek.trim().toLowerCase(); p.innerHTML = '';
    for (const id of ids) { if (RZ.paletTab !== 'alles' && paletGroep(id) !== RZ.paletTab) continue; if (zk && !naam(id).toLowerCase().includes(zk)) continue; p.appendChild(vak('palet:' + id, { id, n: 1 })); }
  };
  RZ.vulPalet = vul; vul();
}
function paletKlik(id, soort, shift) {
  const n = stapelVan(id);
  if (RZ.vast) { RZ.vast = null; }
  if (soort === 'sleep') { RZ.vast = { id, n }; if (IT[id].duur) RZ.vast.dur = IT[id].duur; }
  else { WD.inv[WD.kies] = { id, n }; if (IT[id].duur) WD.inv[WD.kies].dur = IT[id].duur; toonNaam(naam(id)); }
  klank('klik'); rugzakVeranderd();
}
// ---------------- uitleg bij een voorwerp: naam, soort, slijtage en wat je ermee doet
const SOORTNAAM = { bouw: 'Bouwblok', natuur: 'Natuur', hout: 'Hout', kleur: 'Kleur', deco: 'Decoratie', licht: 'Licht', werk: 'Werktuig', eten: 'Eten', spul: 'Spul' };
const UITLEG = {
  werkbank: 'Zet hem neer: daaraan maak je dingen van 3 bij 3.', oven: 'Smelt erts tot staven en bak eten. Brandstof, zoals kolen of hout, gaat onderin.',
  kist: 'Bewaar hier 27 stapels spullen.', bed: 'Slaap de nacht door. Je startplek komt bij je bed.', smidse: 'Herstel en verbeter je gereedschap.',
  kompas: 'Wijst naar je bed, je startplek of een markering.', kaart: 'Laat alles zien wat je hebt gezien. Druk op M of tik op de kleine kaart.', klok: 'Laat zien hoe laat het is.',
  emmer: 'Schep er water mee op.', emmer_water: 'Giet het water ergens uit.', sterrensplinter: 'Verbeter gereedschap in de smidse: het gaat langer mee en hakt sneller.',
  fakkel: 'Geeft licht. Zet hem op de grond of tegen een muur.', papier: 'Maak er een kaart van, met kolen.', stok: 'Voor gereedschap, fakkels en hekken.',
  mijnspoor: 'Legt zichzelf: recht, in een bocht of omhoog. Er moet een blok onder liggen.', stuwspoor: 'Geeft een karretje vaart. Staat het karretje stil, dan rijdt het weg van een muur.',
  karretje: 'Zet hem op een spoor en stap in. Bergaf gaat hij vanzelf; W geeft een zetje.',
  ladder: 'Klim omhoog. Zet hem tegen een muur.', deur: 'Gaat open en dicht als je hem gebruikt.', bloempot: 'Zet er een bloem of plantje in.',
};
const GEREED_UITLEG = { schop: 'Graaft sneller in aarde, zand, grind en sneeuw.', bijl: 'Hakt sneller in hout.', zwaard: 'Snijdt snel door bladeren, planten en spinnenweb.', schoffel: 'Maakt van gras of aarde een akker om op te zaaien.' };
function infoVan(s) {
  const it = IT[s.id]; if (!it) return null;
  const groep = G.bouwGroep(s.id) || 'spul';
  const soort = it.gereed ? t('Gereedschap') : t(SOORTNAAM[groep] || 'Spul');
  const zinnen = [];
  if (it.gereed === 'houweel') { const k = it.klasse || 1; zinnen.push(k >= 4 ? t('Hakt steen en alle erts, ook goud en robijn.') : k === 3 ? t('Hakt steen en erts tot en met ijzer.') : k === 2 ? t('Hakt steen en erts tot en met koper.') : t('Hakt steen en kolen.')); }
  else if (it.gereed) zinnen.push(t(GEREED_UITLEG[it.gereed]));
  if (it.ster) zinnen.push(t('Met sterrenglans: gaat langer mee en hakt sneller.'));
  if (UITLEG[it.sleutel]) zinnen.push(t(UITLEG[it.sleutel]));
  if (it.eten) zinnen.push(t('Eten: vult {0} van je 10 taartpuntjes.', String(Math.max(0.5, it.eten / 2)).replace('.', TAAL === 'en' ? '.' : ',')));
  if (it.plant) zinnen.push(t('Zaai het op een akker. Met water in de buurt groeit het sneller.'));
  const ov = G.ovenRecept(s.id); if (ov) zinnen.push(t('In de oven wordt dit: {0}.', naam(ov.uit).toLowerCase()));
  if (it.brand && !it.gereed) zinnen.push(t('Brandstof: genoeg voor {0} keer bakken.', Math.max(1, Math.round(it.brand / 8))));
  if (it.blok && !zinnen.length) { const b = BL[it.blok]; zinnen.push(b && b.licht ? t('Geeft licht.') : t('Zet het neer om mee te bouwen.')); }
  if (!zinnen.length) zinnen.push(t('Bewaar het: het komt vast nog van pas.'));
  return { naam: naam(s.id), soort, tekst: zinnen.join(' '), dur: it.duur ? [s.dur != null ? s.dur : it.duur, it.duur] : null };
}
function infoHtml(s, hulp) {
  const f = infoVan(s); if (!f) return '';
  let h = `<div class="ik-kop"><span class="ik-naam"></span><span class="ik-soort"></span></div>`;
  if (f.dur) { const p = Math.max(0, f.dur[0] / f.dur[1]); h += `<div class="ik-slijt"><i style="width:${(p * 100).toFixed(0)}%;background:hsl(${(p * 120).toFixed(0)},60%,42%)"></i></div><div class="ik-tekst">${t('{0} van {1}', Math.round(f.dur[0]), f.dur[1])}</div>`; }
  h += `<div class="ik-tekst"></div>`;
  if (hulp) h += `<div class="ik-hulp">${hulp}</div>`;
  return { h, f };
}
function vulInfo(doos, s, hulp) {
  const r = infoHtml(s, hulp); if (!r) { doos.innerHTML = ''; return; }
  doos.innerHTML = r.h; doos.querySelector('.ik-naam').textContent = r.f.naam + (s.n > 1 ? ' × ' + s.n : ''); doos.querySelector('.ik-soort').textContent = r.f.soort;
  const tk = doos.querySelectorAll('.ik-tekst'); tk[tk.length - 1].textContent = r.f.tekst;
}
// de kaart bij de muis
const TIP = $('rb-tip');
function toonTip(v) {
  const p = v && v.dataset.plek; if (!p || RZ.vast || aanraak) { verbergTip(); return; }
  const s = p.startsWith('palet:') ? { id: +p.slice(6), n: 1 } : haalPlek(p); if (!s) { verbergTip(); return; }
  if (TIP.dataset.plek === p && !TIP.hidden && TIP.dataset.h === vakHtml(s)) return;
  TIP.dataset.plek = p; TIP.dataset.h = vakHtml(s);
  const hulp = p.startsWith('palet:') ? '' : p === 'uit' || p.endsWith(':uit') ? `<b>${t('Klik')}</b> ${t('pakken')} · <b>Shift</b> ${t('alles in je rugzak')}` : `<b>${t('Shift-klik')}</b> ${t('snel verplaatsen')} · <b>Q</b> ${t('weggooien')} · <b>1-9</b> ${t('naar de snelbalk')}`;
  TIP.innerHTML = '<div class="rb-infokaart"></div>'; vulInfo(TIP.firstChild, s, hulp);
  TIP.hidden = false;
  const r = v.getBoundingClientRect(), w = TIP.offsetWidth, h = TIP.offsetHeight;
  let x = r.right + 10, y = r.top;
  if (x + w > innerWidth - 8) x = r.left - w - 10;
  if (x < 8) { x = Math.min(innerWidth - w - 8, Math.max(8, r.left)); y = r.bottom + 8; }
  if (y + h > innerHeight - 8) y = Math.max(8, innerHeight - h - 8);
  TIP.style.left = x + 'px'; TIP.style.top = y + 'px';
}
function verbergTip() { if (!TIP.hidden) { TIP.hidden = true; TIP.dataset.plek = ''; } }
// de kaart bovenin bij kiezen-en-tikken (aanraken): wat je hebt gekozen, en knoppen
function toonKeuze() {
  const K = $('rb-rz-kaart'); if (!K) return;
  const toon = (aanraak || smal()) && RZ.deel !== 'recepten'; K.hidden = !toon; if (!toon) return;
  const p = RZ.keuze, s = p ? haalPlek(p) : null;
  if (!s) {
    const h = `<p class="rb-rz-hulp">${aanraak ? t('Tik op iets om het te kiezen. Tik daarna op een ander vak om het te verplaatsen. Houd vast en sleep om te verdelen.') : t('Klik om op te pakken en neer te leggen. Rechts: de helft of één. Shift + klik: snel verplaatsen.')}</p>`;
    if (K.dataset.h !== h) { K.innerHTML = h; K.dataset.h = h; }
    return;
  }
  const sleutel = p + '|' + vakHtml(s); if (K.dataset.h === sleutel) return; K.dataset.h = sleutel;
  K.innerHTML = `<div class="rb-infokaart"><div class="ik-rij"><img src="${icoon(s.id)}" alt=""><div class="ik-doos" style="flex:1;min-width:0"></div></div><div class="ik-knoppen"></div></div>`;
  vulInfo(K.querySelector('.ik-doos'), s);
  const kn = K.querySelector('.ik-knoppen');
  const knop = (tekst, doe) => { const b = el('button', 'rb-knop', tekst); b.type = 'button'; b.onclick = () => { doe(); K.dataset.h = ''; }; kn.appendChild(b); };
  knop(snelNaam(p), () => { snelVerplaats(p); RZ.keuze = null; });
  if (s.n > 1) knop(t('Halveer'), () => { halveer(p); RZ.keuze = null; rugzakVeranderd(); });
  knop(t('Gooi weg'), () => { gooiUit(p, true); RZ.keuze = null; });
}
// ---------------- wat je vasthoudt (aan de muis)
let muisPos = [0, 0];
function toonVast() {
  const v = $('rb-vast'), h = $('rb-vasthouder');
  const weg = h && h.querySelector('.rb-weg');
  if (RZ.vast) {
    v.style.display = 'grid'; v.innerHTML = `<img src="${icoon(RZ.vast.id)}" alt="">${RZ.vast.n > 1 ? `<b>${RZ.vast.n}</b>` : ''}`;
    v.style.left = muisPos[0] + 'px'; v.style.top = muisPos[1] + 'px';
    if (h) { h.innerHTML = `<img src="${icoon(RZ.vast.id)}" alt=""><span>${t('Je hebt vast:')} ${RZ.vast.n} × ${naam(RZ.vast.id)}</span> <button type="button" class="rb-knop klein" id="rb-legterug">${t('Leg terug')}</button>`; if (weg) h.prepend(weg); }
    const lt = $('rb-legterug'); if (lt) lt.onclick = () => { const r = geef(RZ.vast.id, RZ.vast.n, RZ.vast.dur); RZ.vast = r ? Object.assign({}, RZ.vast, { n: r }) : null; rugzakVeranderd(); };
  } else { v.style.display = 'none'; if (h) { h.innerHTML = ''; if (weg) h.prepend(weg); } }
}
// ---------------- muis en aanraken in de rugzak
// Muis: klik pakt op en legt neer, rechts de helft (of één), Shift snel verplaatsen; met iets in je hand over vakken slepen verdeelt het.
// Aanraken: tik kiest, tik op een ander vak verplaatst; vasthouden en slepen pakt de stapel op en verdeelt hem over de vakken waar je langs gaat.
const RP = $('rb-rugzak');
let druk = null;
const vakOnder = (x, y) => { const o = document.elementFromPoint(x, y), v = o && o.closest && o.closest('#rb-rugzak .rb-vak'); return v && v.dataset.plek ? v : null; };
function verdeelLos() { for (const e of document.querySelectorAll('#rb-rugzak .rb-vak.verdeel')) e.classList.remove('verdeel'); }
RP.addEventListener('contextmenu', e => e.preventDefault());
RP.addEventListener('pointerdown', e => {
  const v = e.target.closest('.rb-vak'); muisPos = [e.clientX, e.clientY];
  if (!v || !v.dataset.plek) return;
  e.preventDefault(); verbergTip();
  const p = v.dataset.plek;
  if (e.pointerType === 'mouse') {
    if (p.startsWith('palet:')) { druk = { p, muis: true }; paletKlik(+p.slice(6), e.button === 0 && !e.shiftKey ? 'klik' : 'sleep', e.shiftKey); druk.palet = true; return; }
    // iets in je hand en een vak waar het in kan: misschien verdelen, dat zien we bij het loslaten
    if (RZ.vast && !e.shiftKey && kanVerdelen(p, RZ.vast)) { druk = { p, muis: true, verdeel: [p], knop: e.button }; v.classList.add('verdeel'); return; }
    druk = { p, muis: true };
    klikVak(p, e.button === 2 ? 'rechts' : 'links', e.shiftKey);
  } else {
    druk = { p, t: performance.now(), lang: false, x: e.clientX, y: e.clientY, bewogen: false, verdeel: null };
    // vasthouden: de stapel oppakken om te slepen en te verdelen
    druk.klok = setTimeout(() => {
      if (!druk || druk.bewogen) return; druk.lang = true;
      if (p.startsWith('palet:')) { paletKlik(+p.slice(6), 'sleep'); }
      else if (!/^(uit|weg)$|:uit$/.test(p) && haalPlek(p)) { RZ.keuze = null; RZ.vast = haalPlek(p); zetPlek(p, null); druk.van = p; druk.verdeel = []; rugzakVeranderd(); }
      if (navigator.vibrate) try { navigator.vibrate(15); } catch (er) {}
    }, 380);
  }
});
addEventListener('pointermove', e => {
  muisPos = [e.clientX, e.clientY];
  if (RZ.vast) { const v = $('rb-vast'); v.style.left = e.clientX + 'px'; v.style.top = e.clientY + 'px'; }
  if (huidigScherm() === 'rugzak' && e.pointerType === 'mouse' && !druk) { const v = e.target.closest && e.target.closest('#rb-rugzak .rb-vak'); if (v) toonTip(v); else verbergTip(); }
  if (!druk) return;
  if (!druk.muis && !druk.bewogen && Math.hypot(e.clientX - druk.x, e.clientY - druk.y) > 12) {
    druk.bewogen = true;
    // slepen zonder eerst vast te houden: de hele stapel meenemen
    if (!druk.lang) { clearTimeout(druk.klok); if (druk.p.startsWith('palet:')) paletKlik(+druk.p.slice(6), 'sleep'); else if (!RZ.vast && haalPlek(druk.p) && !/^(uit|weg)$|:uit$/.test(druk.p)) { RZ.keuze = null; RZ.vast = haalPlek(druk.p); zetPlek(druk.p, null); druk.van = druk.p; druk.verdeel = []; rugzakVeranderd(); } }
  }
  if (druk.verdeel && RZ.vast) { const v = vakOnder(e.clientX, e.clientY), p = v && v.dataset.plek; if (p && !druk.verdeel.includes(p) && kanVerdelen(p, RZ.vast)) { druk.verdeel.push(p); v.classList.add('verdeel'); } }
});
addEventListener('pointerup', e => {
  if (!druk) return;
  const d = druk; druk = null; clearTimeout(d.klok); verdeelLos();
  const v = vakOnder(e.clientX, e.clientY), p = v && v.dataset.plek;
  if (d.muis) {
    if (d.verdeel) { if (d.verdeel.length > 1) verdeel(d.verdeel, d.knop === 2); else klikVak(d.p, d.knop === 2 ? 'rechts' : 'links', false); return; }
    if (p && p !== d.p && RZ.vast && !p.startsWith('palet:')) klikVak(p, 'links', false);
    return;
  }
  // aanraken: een stapel losgelaten na slepen
  if (d.verdeel) {
    if (d.verdeel.length > 1) verdeel(d.verdeel, false);
    else if (p && RZ.vast && !p.startsWith('palet:')) klikVak(p, 'links', false);
    // wat over is, terug waar het vandaan kwam (of in je rugzak)
    if (RZ.vast && d.van) { const s = haalPlek(d.van); if (!s) { zetPlek(d.van, RZ.vast); RZ.vast = null; } else if (s.id === RZ.vast.id && s.n + RZ.vast.n <= stapelVan(s.id)) { s.n += RZ.vast.n; RZ.vast = null; } else { const r = geef(RZ.vast.id, RZ.vast.n, RZ.vast.dur); RZ.vast = r ? Object.assign({}, RZ.vast, { n: r }) : null; if (RZ.vast) { gooi(RZ.vast, RZ.vast.n); RZ.vast = null; } } }
    rugzakVeranderd(); return;
  }
  if (d.bewogen || d.lang) { if (p && p !== d.p && RZ.vast && !p.startsWith('palet:')) klikVak(p, 'links', false); return; }
  tikVak(d.p);
});
addEventListener('pointercancel', () => { if (!druk) return; clearTimeout(druk.klok); verdeelLos(); druk = null; });
// een tik (aanraken): kiezen, en dan verplaatsen naar het volgende vak
function tikVak(p) {
  if (p.startsWith('palet:')) { paletKlik(+p.slice(6), 'klik'); return; }
  // resultaten: meteen in je rugzak (en de prullenbak gooit weg wat gekozen is)
  if (p === 'uit' || p === 'oven:uit' || p === 'smidse:uit' || p === 'weg') { RZ.keuze = null; klikVak(p, 'links', p !== 'weg'); return; }
  if (RZ.vast) { klikVak(p, 'links', false); return; }
  if (!RZ.keuze) { if (haalPlek(p)) { RZ.keuze = p; klank('klik'); rugzakVeranderd(); } return; }
  if (RZ.keuze === p) { RZ.keuze = null; rugzakVeranderd(); return; }
  const van = RZ.keuze; RZ.keuze = null; verplaats(van, p);
}
RP.addEventListener('keydown', e => { const v = e.target.closest && e.target.closest('.rb-vak'); if (!v || (e.key !== 'Enter' && e.key !== ' ')) return; e.preventDefault(); const p = v.dataset.plek; if (p.startsWith('palet:')) paletKlik(+p.slice(6), 'klik'); else klikVak(p, 'links', e.shiftKey); });
RP.addEventListener('scroll', verbergTip, true);
RP.addEventListener('pointerleave', verbergTip);
// 1 tot 9 op een vak in de rugzak: naar dat vak van de snelbalk; Q: weggooien (Ctrl+Q: de hele stapel)
addEventListener('keydown', e => {
  if (huidigScherm() !== 'rugzak' || (e.target && e.target.tagName === 'INPUT')) return;
  const v = document.querySelector('#rb-rugzak .rb-vak:hover') || (document.activeElement && document.activeElement.closest && document.activeElement.closest('.rb-vak'));
  if (!v || !v.dataset.plek || v.dataset.plek.startsWith('palet:')) return;
  const p = v.dataset.plek;
  if (e.code === 'KeyQ') { if (p !== 'uit' && !p.endsWith(':uit') && haalPlek(p)) { e.preventDefault(); gooiUit(p, e.ctrlKey || e.metaKey); } return; }
  if (!/^Digit[1-9]$/.test(e.code)) return;
  const j = +e.code.slice(5) - 1, s = haalPlek(p), t2 = WD.inv[j];
  if (p === 'inv:' + j || p === 'uit' || p.endsWith(':uit')) return;
  if (t2 && !magIn(p, t2)) return;
  zetPlek(p, t2); WD.inv[j] = s; rugzakVeranderd();
});

// ---------------- de smidse: herstellen met het eigen materiaal (een kwart per stuk), of verbeteren met een sterrensplinter
function smidseMateriaal(it) { const k = it.klasse && G.KLASSE[it.klasse]; return k ? k[5] : null; }
function smidseUitkomst() {
  const g = RZ.smidse.gereed, s = RZ.smidse.stof; if (!g || !s) return null;
  const it = IT[g.id]; if (!it || !it.duur) return null;
  const dur = g.dur != null ? g.dur : it.duur;
  if (s.id === I.sterrensplinter) {
    if (it.ster || !it.sterVersie) return null;
    const nieuw = IT[it.sterVersie]; return { uit: { id: nieuw.id, n: 1, dur: Math.min(nieuw.duur, Math.round(dur * 1.5)) }, kost: 1 };
  }
  const mat = smidseMateriaal(it); if (!mat) return null;
  const past = mat[0] === '#' ? G.TAG[mat].includes(s.id) : s.id === (I[mat] !== undefined ? I[mat] : B[mat]);
  if (!past || dur >= it.duur) return null;
  const stuk = Math.ceil(it.duur * 0.25), nodig = Math.min(s.n, Math.ceil((it.duur - dur) / stuk));
  return { uit: { id: g.id, n: 1, dur: Math.min(it.duur, dur + nodig * stuk) }, kost: nodig };
}
function smidseTekst() {
  const g = RZ.smidse.gereed, u = smidseUitkomst();
  if (!g) return t('Leg links je gereedschap neer. Rechts het materiaal waarvan het gemaakt is om het te herstellen (elk stuk een kwart), of een sterrensplinter om het te verbeteren: dan gaat het anderhalf keer zo lang mee en hakt het sneller.');
  const it = IT[g.id], dur = g.dur != null ? g.dur : it.duur, mat = smidseMateriaal(it);
  let h = `<b>${naam(g.id)}</b>: ${Math.round(dur)} / ${it.duur}. `;
  if (u) h += u.uit.id !== g.id ? t('Met de sterrensplinter krijgt het sterrenglans.') : t('Herstellen kost {0} × {1}.', u.kost, mat[0] === '#' ? t('planken') : naam(I[mat] !== undefined ? I[mat] : B[mat]).toLowerCase());
  else if (dur >= it.duur && !RZ.smidse.stof) h += t('Het is nog helemaal heel.');
  else h += t('Herstellen kan met: {0}.', mat[0] === '#' ? t('planken') : naam(I[mat] !== undefined ? I[mat] : B[mat]).toLowerCase()) + (it.ster ? '' : ' ' + t('Of verbeter het met een sterrensplinter.'));
  return h;
}
function smidsePak(shift) {
  const u = smidseUitkomst(); if (!u) return;
  if (!shift && RZ.vast) return;
  const verbeterd = RZ.smidse.stof.id === I.sterrensplinter;
  if (shift) { const rest = geef(u.uit.id, 1, u.uit.dur); if (rest) laatVallen(sp.x, sp.y + 1, sp.z, u.uit.id, 1, u.uit.dur); }
  else RZ.vast = u.uit;
  RZ.smidse.gereed = null; const s = RZ.smidse.stof; s.n -= u.kost; if (s.n <= 0) RZ.smidse.stof = null;
  klank(verbeterd ? 'ontdek' : 'nieuw');
  if (typeof logboek === 'function') logboek(verbeterd ? 'sterrenglans' : 'herstel');
  rugzakVeranderd(); bouwRugzak();
}
// ---------------- de oven
// de oven is geen actie van een speler: wat hij doet, wordt niet als actie gemeld (bij samen spelen doet de server dat)
function ovenTik(dt) {
  if (!WD || !WD.dingen) return;
  const was = ACTIES.vanBuiten; ACTIES.vanBuiten = true;
  try { ovenTikNu(dt); } finally { ACTIES.vanBuiten = was; }
  if (bak && bak.soort === 'oven') bakBegin('oven', [bak.x, bak.y, bak.z]);
}
function ovenTikNu(dt) {
  // bij samen spelen werkt de oven op de server (die stuurt de stand terug)
  if (!(samen && WD.samen)) for (const [k, d] of Object.entries(WD.dingen)) {
    if (d.soort !== 'oven') continue;
    // het rekenen staat in de gedeelde code (shared/spullen.js), zodat de server bij samen spelen hetzelfde doet
    const brandde = d.brandTijd > 0, wat = G.SPULLEN.ovenStap(d, dt);
    if ((wat & 1) && huidigScherm() === 'rugzak') rugzakVeranderd();
    if (wat & 2) rugzakVeranderd();
    // het blok laten gloeien als de oven brandt
    const brandt = d.brandTijd > 0;
    if (brandt !== brandde) {
      const [x, y, z] = k.split(',').map(Number), v = blokOp(x, y, z);
      if (v > 0 && ((v & 255) === B.oven || (v & 255) === B.oven_aan)) { zetBlok(x, y, z, (brandt ? B.oven_aan : B.oven) | (v & 0xFF00)); stuurZetten(); if (brandt) klank('oven'); }
    }
  }
  if (huidigScherm() === 'rugzak' && RZ.modus === 'oven') {
    const d = ding(...RZ.plek, 'oven'), p = $('rb-oven-pijl'), f = $('rb-oven-vuur');
    if (p) p.style.width = (d.kook / 8 * 100).toFixed(0) + '%'; if (f) f.style.height = (d.brandMax ? d.brandTijd / d.brandMax * 100 : 0).toFixed(0) + '%';
  }
}
// een kist of oven kapot: de inhoud valt eruit
function inhoudEruit(x, y, z, bouwen) {
  const k = sleutelPlek(x, y, z), d = WD.dingen[k]; if (!d) return;
  delete WD.dingen[k]; actieGevolg(['w', x, y, z]); if (bak && bak.x === x && bak.y === y && bak.z === z) bak = null;
  if (bouwen) return;
  if (samen && WD.samen) return; // de server laat vallen wat er bij hem in zat
  const lijst = d.soort === 'kist' ? d.inhoud : [d.in, d.brand, d.uit];
  for (const s of lijst) if (s) laatVallen(x + 0.5, y + 0.5, z + 0.5, s.id, s.n, s.dur);
}
// ---------------- slapen
function slapen(d) {
  const nacht = WD.tijd < 0.23 || WD.tijd > 0.77;
  const st = d.v >> 8, [dx, dz] = G.RICHTING[st & 3];
  const voet = st & 4 ? [d.x - dx, d.y, d.z - dz] : [d.x, d.y, d.z];
  WD.speler.bed = [voet[0] + 0.5, voet[1] + 0.6, voet[2] + 0.5];
  if (!nacht) { melding(t('Je startplek is nu bij dit bed. Slapen kan alleen als het donker is.')); return; }
  if (samen && WD.samen) { samenSlapen(); return; }
  const z = $('rb-slaap'); z.hidden = false; requestAnimationFrame(() => { z.style.opacity = 1; });
  klank('slaap');
  const nieuweDag = WD.tijd > 0.5 ? 1 : 0;
  setTimeout(() => { WD.tijd = 0.255; WD.dag = (WD.dag || 0) + nieuweDag; if (typeof logboek === 'function') logboek('slapen'); z.style.opacity = 0; setTimeout(() => { z.hidden = true; }, 1300); melding(t('Goedemorgen! Je startplek is nu bij dit bed.')); }, 1500);
}

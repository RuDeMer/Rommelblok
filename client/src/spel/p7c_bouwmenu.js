// ============================================================================
// Het bouwmenu (alleen in de bouwstand): alles onbeperkt, in groepen, met zoeken,
// tikken of slepen naar de snelbalk, en een prullenbak. Geen maken: dat hoort bij overleven.
// ============================================================================
const BOUWGROEPEN = [['alles', 'Alles'], ['bouw', 'Bouwblokken'], ['natuur', 'Natuur'], ['hout', 'Hout'], ['kleur', 'Kleur'], ['deco', 'Decoratie'], ['licht', 'Licht'], ['werk', 'Werktuigen'], ['eten', 'Eten'], ['spul', 'Spullen']];
// een plaatje op elk tabblad
const BOUWICOON = { alles: 'gras', bouw: 'baksteen', natuur: 'gras', hout: 'planken_eik', kleur: 'linnen_rood', deco: 'boekenkast', licht: 'fakkel', werk: 'houweel_ijzer', eten: 'appel', spul: 'stok' };
// een nieuwe wereld in de bouwstand begint met deze snelbalk (tenzij je zelf een start hebt bewaard)
const BOUWBALK = 'gras steen planken_eik stam_eik glas baksteen trap_hout fakkel emmer_water'.split(' ');
const BM = { tab: 'alles', zoek: '', sleep: null };
const idVan = s => (typeof s === 'number' ? s : I[s] !== undefined ? I[s] : B[s]);
let BM_IDS = null;
const bouwIds = () => IT.map((it, id) => (it ? id : -1)).filter(id => id > 0 && id !== I.rugzak && G.bouwGroep(id) && !IT[id].nietInMenu);
function openBouwmenu() {
  if (!WD || !wereldKlaar) return;
  if (huidigScherm() === 'bouwmenu') { sluitScherm(); return; }
  BM_IDS = BM_IDS || bouwIds();
  $('rb-bm-zoek').value = BM.zoek;
  bouwTabs(); vulBouwRaster(); bouwMenuBalk(); vulLaatst();
  openScherm('bouwmenu');
}
function bouwmenuDicht() { const s = BM.sleep; if (s) clearTimeout(s.klok); BM.sleep = null; $('rb-bm-vast').style.display = 'none'; doelWeg(); }
// links de groepen, met hoeveel erin zitten
function bouwTabs() {
  const tabs = $('rb-bm-tabs'); tabs.innerHTML = '';
  const tel = {}; for (const id of BM_IDS) { const g = G.bouwGroep(id); tel[g] = (tel[g] || 0) + 1; }
  for (const [k, n] of BOUWGROEPEN) {
    const b = el('button', 'rb-bm-groep'); b.type = 'button'; b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(BM.tab === k)); b.dataset.groep = k;
    b.innerHTML = `<img src="${icoon(idVan(BOUWICOON[k]))}" alt=""><span></span><span class="n">${k === 'alles' ? BM_IDS.length : tel[k] || 0}</span>`;
    b.children[1].textContent = t(n);
    b.onclick = () => { BM.tab = k; for (const x of tabs.children) x.setAttribute('aria-selected', String(x === b)); vulBouwRaster(); $('rb-bm-raster').scrollTop = 0; klank('klik'); };
    tabs.appendChild(b);
  }
}
function vulBouwRaster() {
  const r = $('rb-bm-raster'), zk = BM.zoek.trim().toLowerCase(); r.innerHTML = '';
  let n = 0;
  for (const id of BM_IDS) {
    if (!zk && BM.tab !== 'alles' && G.bouwGroep(id) !== BM.tab) continue;
    if (zk && !naam(id).toLowerCase().includes(zk) && !IT[id].nl.toLowerCase().includes(zk) && !IT[id].en.toLowerCase().includes(zk)) continue;
    const b = el('button', 'rb-bm-ding' + (naam(id).length > 11 ? ' lang' : '')); b.type = 'button'; b.dataset.id = id; b.setAttribute('aria-label', naam(id));
    b.innerHTML = `<img src="${icoon(id)}" alt=""><span></span>`; b.lastChild.textContent = naam(id); r.appendChild(b); n++;
  }
  if (!n) r.innerHTML = `<p class="rb-bm-leeg">${t('Niets gevonden.')}</p>`;
  // zoeken zoekt overal; anders de naam van de groep
  const g = BOUWGROEPEN.find(x => x[0] === BM.tab);
  $('rb-bm-teller').textContent = (zk ? t('Gevonden') : t(g ? g[1] : 'Alles')) + ' · ' + n;
}
// wat je het laatst in je snelbalk hebt gezet (bewaard, zodat het ook na opnieuw openen klopt)
function vulLaatst() {
  const L = $('rb-bm-laatst'); L.innerHTML = '';
  const lijst = (Array.isArray(opslag.bmLaatst) ? opslag.bmLaatst : []).filter(id => IT[id] && G.bouwGroep(id)).slice(0, 10);
  if (!lijst.length) { L.innerHTML = `<p class="rb-klein">${t('Hier komt wat je het laatst hebt gekozen.')}</p>`; return; }
  for (const id of lijst) { const b = el('button', 'rb-vak rb-bm-ding-klein'); b.type = 'button'; b.dataset.id = id; b.setAttribute('aria-label', naam(id)); b.title = naam(id); b.innerHTML = `<img src="${icoon(id)}" alt="">`; L.appendChild(b); }
}
function onthoudLaatst(id) {
  if (!id) return;
  const l = (Array.isArray(opslag.bmLaatst) ? opslag.bmLaatst : []).filter(x => x !== id); l.unshift(id);
  opslag.bmLaatst = l.slice(0, 10); bewaarInst();
}
function bouwMenuBalk() {
  const bk = $('rb-bm-balk'); bk.innerHTML = '';
  for (let i = 0; i < 9; i++) {
    const s = WD.inv[i], b = el('button', 'rb-vak' + (i === WD.kies ? ' gekozen' : '')); b.type = 'button'; b.dataset.balk = i;
    b.innerHTML = vakHtml(s) + `<span class="nr">${i + 1}</span>`; b.setAttribute('aria-label', t('Vak {0}', i + 1) + ': ' + (s ? naam(s.id) : t('leeg')));
    bk.appendChild(b);
  }
}
function plop(e) { if (!e) return; e.classList.remove('net'); void e.offsetWidth; e.classList.add('net'); }
// iets in een vak van de snelbalk zetten (id 0: het vak leeg maken)
function zetInBalk(i, id) {
  WD.inv[i] = id ? { id, n: stapelVan(id) } : null;
  if (id && IT[id].duur) WD.inv[i].dur = IT[id].duur;
  rugzakVeranderd(); tekenBalk(); bouwMenuBalk(); plop($('rb-bm-balk').children[i]);
  if (id) { toonNaam(naam(id)); onthoudLaatst(id); vulLaatst(); }
  klank('klik');
}
// tikken op iets: in het gekozen vak (met Shift: in het eerste lege vak)
function tikDing(id, leeg, el2) {
  let i = WD.kies;
  if (leeg) { const j = WD.inv.slice(0, 9).findIndex(s => !s); if (j >= 0) i = j; }
  zetInBalk(i, id); plop(el2);
}
// ---------------- slepen (muis en vinger). Op een telefoon scroll je met een veeg omhoog of omlaag;
// slepen begint met een veeg opzij of door even vast te houden.
const BMP = $('rb-bouwmenu');
function doelWeg() { for (const e of document.querySelectorAll('#rb-bouwmenu .doel')) e.classList.remove('doel'); }
function sleepBegin(s) {
  if (!s.id) return false;
  s.bezig = true;
  const v = $('rb-bm-vast'); v.innerHTML = `<img src="${icoon(s.id)}" alt="">`; v.style.display = 'block'; v.style.left = s.x + 'px'; v.style.top = s.y + 'px';
  if (navigator.vibrate && s.vinger) try { navigator.vibrate(12); } catch (er) {}
  return true;
}
function sleepDoel(x, y) {
  const o = document.elementFromPoint(x, y);
  return { vak: o && o.closest && o.closest('#rb-bm-balk .rb-vak'), weg: o && o.closest && o.closest('#rb-bm-weg'), binnen: !!(o && o.closest && o.closest('#rb-bouwmenu-paneel')) };
}
BMP.addEventListener('contextmenu', e => e.preventDefault());
BMP.addEventListener('pointerdown', e => {
  const ding = e.target.closest('.rb-bm-ding, .rb-bm-ding-klein'), vak = e.target.closest('#rb-bm-balk .rb-vak');
  if (!ding && !vak) return;
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  const van = vak ? +vak.dataset.balk : -1, id = ding ? +ding.dataset.id : (WD.inv[van] ? WD.inv[van].id : 0);
  const s = BM.sleep = { id, van, el: ding || vak, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, bezig: false, shift: e.shiftKey, pid: e.pointerId, vinger: e.pointerType !== 'mouse' };
  if (e.pointerType === 'mouse' || vak) e.preventDefault();
  // vasthouden op een vinger: slepen begint ook zonder te bewegen
  if (s.vinger) s.klok = setTimeout(() => { if (BM.sleep === s && !s.bezig) sleepBegin(s); }, 320);
});
addEventListener('pointermove', e => {
  const s = BM.sleep; if (!s || e.pointerId !== s.pid) return;
  s.x = e.clientX; s.y = e.clientY;
  const dx = s.x - s.x0, dy = s.y - s.y0;
  if (!s.bezig) {
    const start = !s.vinger ? Math.hypot(dx, dy) > 6 : s.van >= 0 ? Math.hypot(dx, dy) > 8 : Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.2;
    if (!start) { if (s.vinger && Math.abs(dy) > 10) { clearTimeout(s.klok); BM.sleep = null; } return; }
    clearTimeout(s.klok); if (!sleepBegin(s)) { BM.sleep = null; return; }
  }
  const v = $('rb-bm-vast'); v.style.left = s.x + 'px'; v.style.top = s.y + 'px';
  doelWeg(); const d = sleepDoel(s.x, s.y); if (d.vak) d.vak.classList.add('doel'); else if (d.weg) d.weg.classList.add('doel');
});
addEventListener('pointerup', e => {
  const s = BM.sleep; if (!s || e.pointerId !== s.pid) return;
  BM.sleep = null; clearTimeout(s.klok);
  if (!s.bezig) {
    // een tik
    if (s.van >= 0) { kies(s.van); bouwMenuBalk(); klank('klik'); } else tikDing(s.id, s.shift, s.el);
    return;
  }
  $('rb-bm-vast').style.display = 'none'; doelWeg();
  const d = sleepDoel(e.clientX, e.clientY);
  if (d.vak) {
    const j = +d.vak.dataset.balk;
    if (s.van >= 0) { if (j !== s.van) { const a = WD.inv[s.van]; WD.inv[s.van] = WD.inv[j]; WD.inv[j] = a; rugzakVeranderd(); tekenBalk(); bouwMenuBalk(); plop($('rb-bm-balk').children[j]); klank('klik'); } }
    else zetInBalk(j, s.id);
  } else if (d.weg || (s.van >= 0 && !d.binnen)) { if (s.van >= 0) zetInBalk(s.van, 0); else klank('klik'); }
});
addEventListener('pointercancel', e => { const s = BM.sleep; if (!s || e.pointerId !== s.pid) return; clearTimeout(s.klok); BM.sleep = null; $('rb-bm-vast').style.display = 'none'; doelWeg(); });
// toetsenbord: Enter of spatie op iets zet het in het gekozen vak; 1 tot 9 op iets zet het in dat vak
BMP.addEventListener('click', e => {
  if (e.detail !== 0) return; // alleen klikken van het toetsenbord (muis en vinger gaan via pointerdown/pointerup)
  const ding = e.target.closest('.rb-bm-ding, .rb-bm-ding-klein'), vak = e.target.closest('#rb-bm-balk .rb-vak');
  if (ding) tikDing(+ding.dataset.id, e.shiftKey, ding); else if (vak) { kies(+vak.dataset.balk); bouwMenuBalk(); }
});
addEventListener('keydown', e => {
  if (huidigScherm() !== 'bouwmenu' || !/^Digit[1-9]$/.test(e.code) || (e.target && e.target.tagName === 'INPUT')) return;
  const d = document.querySelector('#rb-bouwmenu .rb-bm-ding:hover, #rb-bouwmenu .rb-bm-ding-klein:hover') || (document.activeElement && document.activeElement.closest && document.activeElement.closest('.rb-bm-ding, .rb-bm-ding-klein'));
  if (!d) return;
  e.preventDefault(); zetInBalk(+e.code.slice(5) - 1, +d.dataset.id);
});
$('rb-bm-zoek').addEventListener('input', e => { BM.zoek = e.target.value; vulBouwRaster(); });
$('rb-bm-start').addEventListener('click', () => {
  opslag.bouwBalk = WD.inv.slice(0, 9).map(s => (s ? s.id : 0)); bewaarInst();
  melding(t('Deze snelbalk krijgt elke nieuwe wereld in de bouwstand.'), true); klank('nieuw');
});
$('rb-bm-leeg').addEventListener('click', () => { for (let i = 0; i < 9; i++) WD.inv[i] = null; rugzakVeranderd(); tekenBalk(); bouwMenuBalk(); klank('klik'); });
// de snelbalk waarmee een nieuwe wereld in de bouwstand begint
function bouwStartBalk() {
  const eigen = Array.isArray(opslag.bouwBalk) && opslag.bouwBalk.length === 9 && opslag.bouwBalk.every(id => id === 0 || (IT[id] && G.bouwGroep(id)));
  return eigen ? opslag.bouwBalk.slice() : BOUWBALK.map(idVan);
}

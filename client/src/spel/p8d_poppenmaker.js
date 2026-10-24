// ============================================================================
// Mijn poppetje: het scherm waar je kiest hoe je eruitziet.
// Het poppetje draait in beeld voor een heldere lucht (de wereld wordt dan niet getekend);
// rechts (op een telefoon onderaan) staan de keuzes in tabbladen. Alles wat je kiest, wordt meteen bewaard.
// ============================================================================
// per tabblad: [sleutel, titel, rijen]; per rij: [veld, soort, titel]
const POP_TABS = [
  ['huid', 'Huid en haar', [['huid', 'huid', 'Huidskleur'], ['haar', 'keuze', 'Kapsel'], ['haarKleur', 'haarkleur', 'Haarkleur']]],
  ['gezicht', 'Gezicht', [['ogen', 'keuze', 'Ogen'], ['mond', 'keuze', 'Mond'], ['extra', 'keuze', 'Extra']]],
  ['kleren', 'Kleren', [['boven', 'keuze', 'Bovenkant'], ['bovenKleur', 'kleur', 'Kleur van je bovenkant'], ['onder', 'keuze', 'Onderkant'], ['onderKleur', 'kleur', 'Kleur van je onderkant'], ['schoenKleur', 'kleur', 'Schoenen']]],
  ['spullen', 'Spullen', [['acc', 'keuze', 'Iets extra'], ['accKleur', 'kleur', 'Kleur']]],
];
// de namen van de haarkleuren (voor voorleessoftware), Nederlands|Engels
const HAARKLEUR_NAAM = 'Zwart|Black,Donkerbruin|Dark brown,Bruin|Brown,Kastanjebruin|Auburn,Rood|Red,Blond|Blond,Lichtblond|Light blond,Grijs|Grey,Blauw|Blue,Roze|Pink'.split(',').map(x => x.split('|'));
// het kiesscherm: waar de camera kijkt, hoe ver het poppetje gedraaid is, en of je het aan het draaien bent
const ST = { camYaw: 0, draai: 0.5, sleep: null, rustTot: 0, hup: 1, tab: 'huid' };
function openPop() {
  ST.camYaw = camVorige ? camVorige.yaw : 0; ST.draai = 0.5; ST.sleep = null; ST.hup = 1;
  tekenPopKeuzes();
  openScherm('pop');
  // het eerste waar je met het toetsenbord bent: het tabblad dat open staat
  if (!aanraak) setTimeout(() => { const b = $('rb-pop-tab-' + ST.tab); if (b && huidigScherm() === 'pop') b.focus({ preventScroll: true }); }, 45);
}
function popZetVeld(veld, v) {
  opslag.pop = POP.popZet(opslag.pop, veld, v);
  // de oude instelling voor de huidskleur van je arm loopt mee (voor zover die kleur er toen al was)
  if (veld === 'huid' && v < 6) inst.huid = v;
  bewaarInst(); tekenPopKeuzes();
}
function verrasPop() {
  opslag.pop = POP.verrasMe(Math.random);
  if (POP.popWaarde(opslag.pop, 'huid') < 6) inst.huid = POP.popWaarde(opslag.pop, 'huid');
  bewaarInst(); ST.hup = 0; tekenPopKeuzes(); klank('klik');
}
// de tabbladen en de keuzes van het tabblad dat open staat
function tekenPopKeuzes() {
  const p = opslag.pop, en = TAAL === 'en';
  const tabs = $('rb-pop-tabs'); tabs.innerHTML = '';
  for (const [k, titel] of POP_TABS) {
    const b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'tab'); b.id = 'rb-pop-tab-' + k; b.setAttribute('aria-controls', 'rb-pop-keuzes');
    b.textContent = t(titel); b.setAttribute('aria-selected', String(k === ST.tab)); b.tabIndex = k === ST.tab ? 0 : -1;
    b.onclick = () => { ST.tab = k; tekenPopKeuzes(); const n = $('rb-pop-tab-' + k); if (n) n.focus({ preventScroll: true }); };
    tabs.appendChild(b);
  }
  const l = $('rb-pop-keuzes'); l.innerHTML = ''; l.setAttribute('aria-labelledby', 'rb-pop-tab-' + ST.tab);
  const rijen = POP_TABS.find(x => x[0] === ST.tab)[2];
  for (const [veld, soort, titel] of rijen) {
    const r = document.createElement('div'); r.className = 'rb-pop-rij';
    const h = document.createElement('h3'); h.id = 'rb-pop-' + veld; h.textContent = t(titel); r.appendChild(h);
    const g = document.createElement('div'); g.className = 'rb-keuzes' + (soort === 'keuze' ? '' : ' rb-kleuren'); g.setAttribute('role', 'group'); g.setAttribute('aria-labelledby', h.id);
    const nu = POP.popWaarde(p, veld);
    const knop = (i, tekst, kleur) => {
      const b = document.createElement('button'); b.type = 'button'; b.setAttribute('aria-pressed', String(i === nu));
      if (kleur) { b.className = 'rb-kleur'; b.style.setProperty('--kl', kleur); b.setAttribute('aria-label', tekst); b.title = tekst; } else b.textContent = tekst;
      b.onclick = () => popZetVeld(veld, i); g.appendChild(b);
    };
    if (soort === 'keuze') POP.POP_KEUZES[veld].forEach((o, i) => knop(i, en ? o[2] : o[1]));
    else if (soort === 'huid') POP.POP_HUID_VOLGORDE.forEach((i, n) => knop(i, t('Huidskleur {0}', n + 1), POP.POP_HUID[i]));
    else if (soort === 'haarkleur') POP.POP_HAARKLEUR.forEach((c, i) => knop(i, en ? HAARKLEUR_NAAM[i][1] : HAARKLEUR_NAAM[i][0], c));
    else POP.POP_KLEUR.forEach((c, i) => knop(i, en ? G.PALET[i][2] : G.PALET[i][1], c));
    r.appendChild(g);
    // bij een jurk of een overall zie je de onderkant niet (wel de kleur, van je benen)
    const boven = popKeuze(p, 'boven');
    if (veld === 'onder' && (boven === 'jurk' || boven === 'overall')) { const s = document.createElement('small'); s.textContent = t('Bij een jurk of een overall zie je dit niet.'); r.appendChild(s); }
    l.appendChild(r);
  }
}
// met de pijltjestoetsen langs de tabbladen
$('rb-pop-tabs').addEventListener('keydown', e => {
  if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
  e.preventDefault();
  const i = POP_TABS.findIndex(x => x[0] === ST.tab), n = (i + (e.key === 'ArrowRight' ? 1 : -1) + POP_TABS.length) % POP_TABS.length;
  ST.tab = POP_TABS[n][0]; tekenPopKeuzes(); $('rb-pop-tab-' + ST.tab).focus({ preventScroll: true });
});
$('rb-pop-verras').addEventListener('click', verrasPop);
$('rb-pop-klaar').addEventListener('click', () => { if (huidigScherm() === 'pop') sluitScherm(); });
$('rb-begin-pop').addEventListener('click', () => openPop());
$('rb-menu-pop').addEventListener('click', () => openPop());
// op het beginscherm luistert het spel niet naar toetsen: Escape sluit dit scherm dan hier
addEventListener('keydown', e => { if (!spelBezig && e.code === 'Escape' && huidigScherm() === 'pop') { e.preventDefault(); sluitScherm(); } });
// draaien: slepen over het poppetje, of de twee knoppen
const buhne = $('rb-pop-buhne');
buhne.addEventListener('pointerdown', e => { e.preventDefault(); ST.sleep = { x: e.clientX, draai: ST.draai, id: e.pointerId }; try { buhne.setPointerCapture(e.pointerId); } catch (er) {} buhne.classList.add('sleept'); });
buhne.addEventListener('pointermove', e => { if (ST.sleep && e.pointerId === ST.sleep.id) ST.draai = ST.sleep.draai + (e.clientX - ST.sleep.x) * 0.012; });
const losPop = () => { ST.sleep = null; ST.rustTot = performance.now() + 2500; buhne.classList.remove('sleept'); };
buhne.addEventListener('pointerup', losPop); buhne.addEventListener('pointercancel', losPop);
$('rb-pop-links').addEventListener('click', () => { ST.draai -= Math.PI / 4; ST.rustTot = performance.now() + 2500; });
$('rb-pop-rechts').addEventListener('click', () => { ST.draai += Math.PI / 4; ST.rustTot = performance.now() + 2500; });
// elk beeldje: de camera en het poppetje, midden in het vrije stuk van het scherm (links van of boven de keuzes)
const POP_HOOG = 2.15, POP_BREED = 1.15;
function popStudio(dt, C0) {
  const nu = performance.now(), tijd = nu / 1000, stil = minderBeweging;
  const C = { x: C0.x, y: C0.y, z: C0.z, yaw: ST.camYaw, pitch: 0, fov: 40 * Math.PI / 180, schaal: C0.schaal };
  const dr = doek.getBoundingClientRect(), r = buhne.getBoundingClientRect();
  const W = Math.max(1, dr.width), H = Math.max(1, dr.height);
  const mx = ((r.left + r.width / 2 - dr.left) / W) * 2 - 1, my = 1 - ((r.top + r.height / 2 - dr.top) / H) * 2;
  const tanV = Math.tan(C.fov / 2), tanH = tanV * W / H;
  const fh = Math.max(0.15, r.height / H), fw = Math.max(0.15, r.width / W);
  // zo ver weg dat het poppetje (met een hoed op) mooi in het vrije stuk past
  const d = klem(Math.max(POP_HOOG / (0.8 * fh * 2 * tanV), POP_BREED / (0.75 * fw * 2 * tanH)), 2.2, 12);
  const fx = -Math.sin(C.yaw), fz = -Math.cos(C.yaw), rx = Math.cos(C.yaw), rz = -Math.sin(C.yaw);
  const ox = mx * d * tanH, oy = my * d * tanV;
  // vanzelf langzaam rond (niet bij minder beweging, en even niet na zelf draaien)
  if (!stil && !ST.sleep && nu > ST.rustTot) ST.draai += dt * 0.45;
  ST.hup = Math.min(1, ST.hup + dt * 1.6);
  const hup = stil ? 0 : Math.sin(ST.hup * Math.PI) * 0.22;
  const naam = popModel(opslag.pop, popKnippert(1, tijd));
  const wezens = [];
  if (naam) {
    const { g } = popHouding({ v: 0, fase: 0, grond: true, water: false, ladder: false, sluip: false, kar: false, hak: -1, eet: -1, zwaai: ST.hup < 1 ? ST.hup : 1, pitch: 0, t: tijd, vliegt: false });
    // rustig ademen en een beetje rondkijken
    if (!stil) { g.armL[2] -= 0.05 + 0.03 * Math.sin(tijd * 1.7); g.armR[2] += 0.05 + 0.03 * Math.sin(tijd * 1.7); g.hoofd[1] += 0.14 * Math.sin(tijd * 0.6); }
    wezens.push({ model: naam, x: C.x + fx * d + rx * ox, y: C.y + oy - POP_HOOG / 2 + 0.05 + hup, z: C.z + fz * d + rz * ox,
      yaw: C.yaw + ST.draai, pitch: 0, delen: popDelenHouding(naam, g), licht: [1, 1, 1], schaal: POP_SCHAAL });
  }
  // een heldere lucht, ook als het in de wereld nacht is of je onder de grond zit
  const L = lucht(0.34, 3, false, Math.max(6, huidigeStraal), tijd); L.mistDonker = 1; L.wolkDek = 0.45;
  return { C, L, extra: { wezens, alleenWezens: true } };
}

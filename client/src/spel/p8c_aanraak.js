// ============================================================================
// Aanraken (telefoon en tablet): links een stuurknuppel, rechts kijken, tikken is bouwen, vasthouden is hakken
// ============================================================================
const AR = { joy: null, kijk: null, knoppen: new Map(), springen: false, sluipen: false, op: false, neer: false, vol: false };
const joyEl = $('rb-joy'), joyKnop = $('rb-joyknop');
function aanraakLos() {
  AR.joy = null; AR.kijk = null; joyEl.style.display = 'none'; richtScherm = null; doelZichtbaar = inst.richtModus === 'kruis';
  AR.springen = AR.op = AR.neer = false; hakKnop = bouwKnop = houdGebruik = false;
  for (const b of document.querySelectorAll('.rb-tk.ingedrukt')) b.classList.remove('ingedrukt');
}
function leesAanraak() {
  if (!aanraak) return;
  if (AR.joy) {
    const j = AR.joy, dx = j.x - j.x0, dy = j.y - j.y0, r = 52, l = Math.hypot(dx, dy), f = Math.min(1, l / r);
    const k = l > 6 ? Math.max(0, (f - 0.12) / 0.88) : 0, ux = l ? dx / l : 0, uy = l ? dy / l : 0;
    inv.opzij = ux * k; inv.voor = -uy * k;
    // helemaal naar voren duwen: rennen
    if (f > 0.96 && -uy > 0.8) { j.ver = (j.ver || 0) + 1; if (j.ver > 18) inv.rent = true; } else j.ver = 0;
  }
  // vasthouden zonder te bewegen: hakken op die plek (of eten). Hier gecontroleerd in plaats van met een klokje,
  // zodat een tik die even op zich laat wachten nooit per ongeluk een hak wordt.
  const k = AR.kijk;
  if (k && !k.bewogen && !k.hakt && !k.eet && inst.richtModus !== 'kruis' && performance.now() - k.tNu > 300) {
    richtScherm = [k.x / innerWidth, k.y / innerHeight]; doelZichtbaar = true; werkDoel();
    const s = inHand();
    if (s && IT[s.id].eten) { k.eet = true; houdGebruik = true; eetBegin(); }
    else { k.hakt = true; hakKnop = true; hakBegin(); hak.wacht = 0.3; if (navigator.vibrate) try { navigator.vibrate(12); } catch (er) {} }
  }
  if (AR.springen) inv.spring = true;
  if (AR.sluipen && !sp.vliegt) inv.sluip = true;
  if (AR.op) inv.spring = true;
  if (AR.neer) inv.sluip = true;
}
// welk deel van het scherm: links lopen, rechts kijken
const linksDeel = x => x < innerWidth * 0.42;
doek.addEventListener('pointerdown', e => {
  if (e.pointerType === 'mouse' || !spelActief() || !wereldKlaar) return;
  e.preventDefault();
  if (!AR.vol && inst.volScherm !== false) { AR.vol = true; volledigScherm(false); }
  try { doek.setPointerCapture(e.pointerId); } catch (er) {}
  if (linksDeel(e.clientX) && !AR.joy) {
    AR.joy = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY };
    joyEl.style.display = 'block'; joyEl.style.left = e.clientX + 'px'; joyEl.style.top = e.clientY + 'px'; joyKnop.style.transform = '';
  } else if (!AR.kijk) {
    AR.kijk = { id: e.pointerId, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t: e.timeStamp, tNu: performance.now(), bewogen: false, hakt: false, eet: false };
  }
}, { passive: false });
doek.addEventListener('pointermove', e => {
  if (e.pointerType === 'mouse') return;
  if (AR.joy && e.pointerId === AR.joy.id) {
    const j = AR.joy; j.x = e.clientX; j.y = e.clientY;
    let dx = j.x - j.x0, dy = j.y - j.y0; const l = Math.hypot(dx, dy), r = 52; if (l > r) { dx = dx / l * r; dy = dy / l * r; }
    joyKnop.style.transform = `translate(${dx}px, ${dy}px)`;
  } else if (AR.kijk && e.pointerId === AR.kijk.id) {
    const k = AR.kijk, dx = e.clientX - k.x, dy = e.clientY - k.y;
    k.x = e.clientX; k.y = e.clientY;
    if (!k.bewogen && !k.hakt && Math.hypot(k.x - k.x0, k.y - k.y0) > 11) k.bewogen = true;
    if (k.hakt) { richtScherm = [k.x / innerWidth, k.y / innerHeight]; return; } // tijdens hakken richt je met je vinger
    if (k.bewogen) {
      const g = 0.0052 * inst.aanraak * (inst.fov / 75);
      sp.yaw -= dx * g; sp.pitch -= dy * g * (inst.omkeren ? -1 : 1); sp.pitch = klem(sp.pitch, -1.55, 1.55);
    }
  }
}, { passive: false });
function aanraakEind(e) {
  if (e.pointerType === 'mouse') return;
  if (AR.joy && e.pointerId === AR.joy.id) { AR.joy = null; joyEl.style.display = 'none'; inv.voor = inv.opzij = 0; inv.rent = false; }
  if (AR.kijk && e.pointerId === AR.kijk.id) {
    const k = AR.kijk; AR.kijk = null;
    const kort = e.timeStamp - k.t < 300; // volgens de tijd van de vinger zelf (niet die van een traag beeldje)
    if (k.hakt) { hakKnop = false; hakStop(); }
    else if (k.eet) { houdGebruik = false; eet.bezig = false; }
    if ((kort || (!k.hakt && !k.eet)) && !k.bewogen && e.timeStamp - k.t < 450 && inst.richtModus !== 'kruis' && e.type === 'pointerup') {
      // korte tik: bouwen of gebruiken op de plek waar je tikte
      richtScherm = [k.x / innerWidth, k.y / innerHeight]; werkDoel(); gebruik();
    }
    richtScherm = null; doelZichtbaar = inst.richtModus === 'kruis';
  }
}
doek.addEventListener('pointerup', aanraakEind);
doek.addEventListener('pointercancel', aanraakEind);
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('dblclick', e => { if (aanraak) e.preventDefault(); });
// ---------------- de knoppen
function knop(id, neer, los) {
  const b = $(id); if (!b) return;
  b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); try { b.setPointerCapture(e.pointerId); } catch (er) {} b.classList.add('ingedrukt'); neer(e); });
  const op = e => { b.classList.remove('ingedrukt'); if (los) los(e); };
  b.addEventListener('pointerup', op); b.addEventListener('pointercancel', op);
  b.addEventListener('contextmenu', e => e.preventDefault());
}
knop('tk-spring', () => { AR.springen = true; }, () => { AR.springen = false; });
knop('tk-sluip', () => { AR.sluipen = !AR.sluipen; $('tk-sluip').setAttribute('aria-pressed', String(AR.sluipen)); });
knop('tk-vlieg', () => { if (wereldStand() !== 'bouwen') return; sp.vliegt = !sp.vliegt; sp.vy = 0; $('tk-vlieg').setAttribute('aria-pressed', String(sp.vliegt)); lichaamKlassen(); });
knop('tk-op', () => { AR.op = true; }, () => { AR.op = false; });
knop('tk-neer', () => { AR.neer = true; }, () => { AR.neer = false; });
knop('tk-hak', () => { hakKnop = true; hakBegin(); }, () => { hakKnop = false; hakStop(); });
knop('tk-bouw', () => { const s = inHand(); if (s && IT[s.id].eten) { houdGebruik = true; eetBegin(); } else { gebruik(); bouwKnop = true; bouwHerhaal = performance.now() + 320; } }, () => { bouwKnop = false; houdGebruik = false; });
knop('tk-rugzak', () => openRugzak());
knop('tk-menu', () => openMenu());
knop('tk-camera', () => wisselCamera());
knop('tk-gooi', () => gooiWeg(false));
// na een draai van het scherm: alles loslaten
addEventListener('orientationchange', aanraakLos);
addEventListener('resize', () => { if (AR.joy) aanraakLos(); });

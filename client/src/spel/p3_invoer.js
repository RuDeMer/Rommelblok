// ============================================================================
// Besturing met toetsenbord en muis
// ============================================================================
const toets = {};
const inv = { voor: 0, opzij: 0, spring: false, sluip: false, rent: false, omhoog: false, omlaag: false };
let muisVast = false, laatsteSpatie = 0, laatsteW = 0, hakKnop = false, bouwKnop = false;
const SPELTOETSEN = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
function spelActief() { return spelBezig && !schermOpen(); }
addEventListener('keydown', e => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
  if (!spelBezig) return;
  if (schermOpen()) { if (e.code === 'Escape' || (e.code === 'KeyE' && huidigScherm() !== 'menu') || (e.code === 'KeyM' && huidigScherm() === 'kaart') || (e.code === 'KeyL' && huidigScherm() === 'logboek')) { e.preventDefault(); sluitScherm(); } return; }
  if (SPELTOETSEN.has(e.code)) e.preventDefault();
  if (e.repeat && e.code !== 'Space') { toets[e.code] = true; return; }
  toets[e.code] = true;
  if (e.code === 'Space') {
    const nu = performance.now();
    if (!e.repeat && wereldStand() === 'bouwen' && nu - laatsteSpatie < 300) { sp.vliegt = !sp.vliegt; sp.vy = 0; melding(sp.vliegt ? t('Je vliegt. Spatie omhoog, Shift omlaag.') : t('Je loopt weer.'), true); laatsteSpatie = 0; }
    else if (!e.repeat) laatsteSpatie = nu;
  }
  if (e.code === 'KeyW' && !e.repeat) { const nu = performance.now(); if (nu - laatsteW < 280) sp.rent = true; laatsteW = nu; }
  if (/^Digit[1-9]$/.test(e.code)) kies(+e.code.slice(5) - 1);
  if (e.code === 'KeyE') { e.preventDefault(); openRugzak(); }
  if (e.code === 'KeyQ') gooiWeg(e.ctrlKey);
  if (e.code === 'KeyM') { e.preventDefault(); openKaart(); }
  if (e.code === 'KeyL') { e.preventDefault(); openLogboek(); }
  if (e.code === 'Escape' || e.code === 'KeyP') { e.preventDefault(); openMenu(); }
  if (e.code === 'F3' || e.code === 'KeyI' && e.altKey) { e.preventDefault(); inst.fps = !inst.fps; bewaarInst(); }
});
addEventListener('keyup', e => { toets[e.code] = false; if (e.code === 'KeyW') sp.rent = false; });
addEventListener('blur', () => { for (const k in toets) toets[k] = false; hakKnop = bouwKnop = false; });
function leesToetsen() {
  inv.voor = (toets.KeyW || toets.ArrowUp ? 1 : 0) - (toets.KeyS || toets.ArrowDown ? 1 : 0);
  inv.opzij = (toets.KeyD || toets.ArrowRight ? 1 : 0) - (toets.KeyA || toets.ArrowLeft ? 1 : 0);
  inv.spring = !!toets.Space; inv.sluip = !!(toets.ShiftLeft || toets.ShiftRight);
  inv.rent = !!(toets.ControlLeft || toets.ControlRight);
  inv.omhoog = false; inv.omlaag = false;
}
// muis: vastzetten om rond te kijken
function vraagMuis() { if (aanraak || !spelBezig) return; try { const p = doek.requestPointerLock && doek.requestPointerLock({ unadjustedMovement: false }); if (p && p.catch) p.catch(() => {}); } catch (e) {} }
document.addEventListener('pointerlockchange', () => {
  muisVast = document.pointerLockElement === doek;
  if (!muisVast && spelBezig && !schermOpen() && !aanraak) openMenu();
  document.body.classList.toggle('rb-muisvast', muisVast);
});
document.addEventListener('mousemove', e => {
  if (!muisVast) return;
  const g = 0.0022 * inst.muis * (inst.fov / 75);
  sp.yaw -= e.movementX * g; sp.pitch -= e.movementY * g * (inst.omkeren ? -1 : 1);
  sp.pitch = klem(sp.pitch, -1.55, 1.55);
});
doek.addEventListener('mousedown', e => {
  if (aanraak) return;
  if (!muisVast) { vraagMuis(); return; }
  if (e.button === 0) { hakKnop = true; hakBegin(); }
  if (e.button === 2) { bouwKnop = true; gebruik(); bouwHerhaal = performance.now() + 260; }
  if (e.button === 1) { e.preventDefault(); kiesBlok(); }
});
addEventListener('mouseup', e => { if (e.button === 0) { hakKnop = false; hakStop(); } if (e.button === 2) bouwKnop = false; });
doek.addEventListener('contextmenu', e => e.preventDefault());
doek.addEventListener('wheel', e => { if (!muisVast) return; e.preventDefault(); kies((WD.kies + (e.deltaY > 0 ? 1 : 8)) % 9); }, { passive: false });
let bouwHerhaal = 0;

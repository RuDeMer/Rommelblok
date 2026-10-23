// ============================================================================
// De rugzak: 9 vakken in de snelbalk (0 tot 8) en 27 vakken erachter (9 tot 35)
// Een vak is null of { id, n, dur } (dur = slijtage voor gereedschap)
// ============================================================================
const stapelVan = id => (IT[id] ? IT[id].stapel || 64 : 64);
function inHand() { return WD ? WD.inv[WD.kies] : null; }
function kies(i) {
  if (!WD) return; WD.kies = klem(i, 0, 8); hak.voortgang = 0; eet.bezig = false;
  if (typeof tekenBalk === 'function') tekenBalk();
  const s = inHand(); if (s && typeof toonNaam === 'function') toonNaam(naam(s.id));
}
// geef iets aan de speler; geeft terug hoeveel er niet meer in paste
function geef(id, n, dur) {
  if (!IT[id] || n <= 0) return 0;
  const max = stapelVan(id), inv = WD.inv;
  if (max > 1) for (let i = 0; i < 36 && n; i++) { const s = inv[i]; if (s && s.id === id && s.n < max) { const m = Math.min(n, max - s.n); s.n += m; n -= m; } }
  for (let i = 0; i < 36 && n; i++) if (!inv[i]) { const m = Math.min(n, max); inv[i] = { id, n: m }; if (IT[id].duur) inv[i].dur = dur != null ? dur : IT[id].duur; n -= m; }
  rugzakVeranderd();
  return n;
}
function geefOfLaatVallen(id, n, dur) { const rest = geef(id, n, dur); if (rest) laatVallen(sp.x, sp.y + 1, sp.z, id, rest, dur); }
function tel(id) { let n = 0; for (const s of WD.inv) if (s && s.id === id) n += s.n; return n; }
function neem(id, n) { for (let i = 35; i >= 0 && n > 0; i--) { const s = WD.inv[i]; if (s && s.id === id) { const m = Math.min(n, s.n); s.n -= m; n -= m; if (!s.n) WD.inv[i] = null; } } rugzakVeranderd(); return n === 0; }
function neemUitHand(n) {
  if (wereldStand() === 'bouwen') return;
  const s = inHand(); if (!s) return; s.n -= n || 1; if (s.n <= 0) WD.inv[WD.kies] = null; rugzakVeranderd();
}
function vervangInHand(id) {
  const s = inHand();
  if (s && s.n > 1) { s.n--; geefOfLaatVallen(id, 1); }
  else WD.inv[WD.kies] = { id, n: 1 };
  rugzakVeranderd();
}
function slijt(n) {
  const s = inHand(); if (!s || !IT[s.id].duur || wereldStand() === 'bouwen') return;
  s.dur = (s.dur == null ? IT[s.id].duur : s.dur) - n;
  if (s.dur <= 0) { WD.inv[WD.kies] = null; klank('stuk'); melding(t('Je {0} is kapot.', naam(s.id).toLowerCase()), true); }
  rugzakVeranderd();
}
function gooiWeg(alles) {
  const s = inHand(); if (!s) return;
  const n = alles ? s.n : 1;
  if (wereldStand() !== 'bouwen') gooi(s, n);
  s.n -= n; if (s.n <= 0) WD.inv[WD.kies] = null; rugzakVeranderd(); zwaai();
}
let rugzakVies = true, kanTeller = 0;
function rugzakVeranderd() { rugzakVies = true; kanTeller++; if (bak) bakVergelijk(); }
// een nieuwe rugzak voor een nieuwe wereld
function beginRugzak(stand) {
  const inv = new Array(36).fill(null);
  if (stand === 'bouwen') bouwStartBalk().forEach((id, i) => { if (id) { inv[i] = { id, n: stapelVan(id) }; if (IT[id].duur) inv[i].dur = IT[id].duur; } });
  return inv;
}

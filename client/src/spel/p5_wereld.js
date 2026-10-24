// ============================================================================
// De wereld die open is: gegevens, berichten van de wereldbaas, tijd van de dag.
// ============================================================================
let WD = null;            // gegevens van de open wereld (naam, zaadje, stand, speler, rugzak, tijd, ...)
let spelBezig = false;    // speelt de speler nu (wereld open en geladen)
let wereldKlaar = false;  // is de grond onder de speler er al
const wereldStand = () => (WD ? WD.stand : 'bouwen');
let sinds = 0;            // tijd sinds de wereld open is (seconden, voor animaties)
let samen = null;         // bij samen spelen: de gedeelde wereld op de spelserver (p8e_samen.js); null bij alleen spelen

let wereldNr = 0;
wb.onmessage = e => {
  const m = e.data;
  // een laat bericht van een vorige wereld (bijvoorbeeld die van het beginscherm): weggooien
  if (m.g !== undefined && m.g !== wereldNr && !(m.id && wachten.has(m.id))) return;
  switch (m.t) {
    case 'mesh': meshRij.set(sk(m.cx, m.cz), m); break;
    case 'weg': { const k = sk(m.cx, m.cz); meshRij.delete(k); R.weg(m.cx, m.cz); kleurGezet.delete(k); break; }
    case 'kopie': kopie.set(sk(m.cx, m.cz), { d: m.d, l: m.l, b: m.b, kl: m.kl }); if (WD) karrenUitStuk(m.cx, m.cz, m.d); break;
    case 'blokken': { const a = m.a; for (let i = 0; i < a.length; i += 4) zetKopie(a[i], a[i + 1], a[i + 2], a[i + 3]); break; }
    case 'licht': { const c = kopie.get(sk(m.cx, m.cz)); if (c) c.l = m.l; break; }
    // weggespoeld door water: dat doet de wereld zelf, het is geen actie van een speler
    case 'drop': if (typeof laatVallen === 'function') { ACTIES.vanBuiten = true; try { laatVallen(m.x + 0.5, m.y + 0.3, m.z + 0.5, m.v); } finally { ACTIES.vanBuiten = false; } } break;
    case 'kaart': if (typeof kaartBinnen === 'function') kaartBinnen(m); break;
    case 'bouwwerken': if (typeof bouwwerkenBinnen === 'function') bouwwerkenBinnen(m.lijst); break;
    // de wereldbaas is begonnen; een wereld van voor versie 3 is nu omgezet (waar je al was, blijft het oude landschap)
    // en een wereld van voor oktober 2026 krijgt meer steenkool, alleen waar je nog niet was
    case 'gestart': if (WD && !WD.samen && (WD.erts || 1) < 2) WD.erts = 2;
      if (WD && (WD.gen || 2) < 3) { WD.gen = 3; if (m.oudNieuw && WD.welkom) setTimeout(() => melding(t('Nieuw in je wereld: dorpjes, rivieren door dalen en meer land. Waar je al geweest bent, blijft alles zoals het was.')), 4000); } break;
    default: if (m.id && wachten.has(m.id)) { const ok = wachten.get(m.id); wachten.delete(m.id); ok(m); }
  }
};
wb.onerror = e => { console.error('Wereldbaas:', e.message); };

function kopieOpruimen() {
  const pcx = Math.floor(sp.x) >> 4, pcz = Math.floor(sp.z) >> 4;
  for (const k of kopie.keys()) { const cx = Math.floor(k / 65536) - 32768, cz = (k % 65536) - 32768; if (Math.abs(cx - pcx) > 4 || Math.abs(cz - pcz) > 4) kopie.delete(k); }
}
let laatsteSpelerBericht = 0, laatsteStuk = '';
function vertelPlek(nu, dwing) {
  const st = (Math.floor(sp.x) >> 4) + ',' + (Math.floor(sp.z) >> 4);
  if (!dwing && st === laatsteStuk && nu - laatsteSpelerBericht < 400) return;
  laatsteStuk = st; laatsteSpelerBericht = nu;
  wb.postMessage({ t: 'speler', x: sp.x, y: sp.y, z: sp.z, straal: huidigeStraal });
}
let huidigeStraal = straalNu();

let menuWereld = null; // de wereld die achter het beginscherm langzaam ronddraait
function startWereld(gegevens, alsMenu) {
  WD = alsMenu ? null : gegevens; menuWereld = alsMenu ? gegevens : null;
  const W0 = gegevens;
  kopie.clear(); meshRij.clear(); kleurGezet.clear(); R.allesWeg();
  const s = W0.speler;
  sp.x = s.pos[0]; sp.y = s.pos[1]; sp.z = s.pos[2]; sp.yaw = s.kijk[0]; sp.pitch = s.kijk[1]; sp.vx = sp.vy = sp.vz = 0; sp.vliegt = !!s.vliegt && W0.stand === 'bouwen'; sp.valStart = null;
  huidigeStraal = alsMenu ? Math.min(straalNu(), telefoon ? 3 : 6) : straalNu();
  const m = { t: 'start', nr: ++wereldNr, zaad: W0.zaad, wid: W0.samen ? null : W0.id, gen: W0.gen || 2, erts: W0.erts || 1, plekken: [s.pos, s.start, s.bed].filter(Boolean).map(p => [p[0], p[2]]), straal: huidigeStraal, x: sp.x, y: sp.y, z: sp.z, opties: { snelleBladeren: KW.snelleBladeren, samen: !!W0.samen } };
  if (!poortenGegeven) { m.poorten = makerPoorten; poortenGegeven = true; wb.postMessage(m, makerPoorten); }
  else wb.postMessage(m);
  wereldKlaar = false; spelBezig = !alsMenu; sinds = 0;
}
// achter het beginscherm: een mooie plek die langzaam ronddraait (alleen kijken, niets wordt bewaard)
function startMenuWereld() {
  if (!R || menuWereld) return;
  const zaad = G.zaadVan('rommelhoekje'), st = G.maakWereld(zaad).startPlek();
  startWereld({ id: 'menu', zaad, gen: 3, erts: 2, stand: 'bouwen', tijd: 0.31, dag: 3, speler: { pos: [st.x, st.y + 14, st.z], kijk: [0.8, -0.18], vliegt: true } }, true);
}
function menuTik(dt, nu) {
  if (!menuWereld) return;
  if (!minderBeweging) sp.yaw += dt * 0.025;
  menuWereld.tijd = (menuWereld.tijd + dt / DAGLENGTE) % 1;
  if (!wereldKlaar && grondKlaar()) wereldKlaar = true;
  vertelPlek(nu);
}
// is de grond onder de speler er (blokken en vormen)?
function grondKlaar() {
  const k = sk(Math.floor(sp.x) >> 4, Math.floor(sp.z) >> 4);
  return kopie.has(k) && R.stukken.has(k);
}
